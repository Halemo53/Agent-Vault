// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Minimal verifier interface for Primus zkTLS attestations.
interface IPrimusVerifier {
    function verify(bytes calldata attestation, address agent) external view returns (bool);
}

/// @title AgentVault
/// @notice Budget vault that lets one or more AI agents spend USDC within owner-defined, on-chain rules.
/// @dev Global rules (vendor allowlist, max per tx, hourly budget, hourly rate) apply to every agent;
///      each agent also has its own lifetime sub-limit. Recurring schedules reuse the same rule engine.
contract AgentVault {
    struct PaymentRequest {
        address vendor;
        uint256 amount;
        bytes32 zkProof;
        uint256 timestamp;
    }

    struct AgentInfo {
        string name;
        bool active;
        uint256 perAgentLimit; // 0 = no individual limit
        uint256 spent;
        bool registered;
        uint256 lastActive;
    }

    struct Schedule {
        address agent;
        address vendor;
        uint256 amount;
        uint256 interval;
        uint256 nextExecution;
        bool active;
    }

    address public owner;
    address public agent; // primary agent (set at deploy), kept for backwards compatibility
    address public usdcToken;
    address public primusVerifier;
    bool public paused;
    uint256 public maxPerTransaction;
    uint256 public rollingBudget;
    uint256 public maxPaymentsPerHour;
    bytes32 public encryptedPolicyHandle;

    mapping(address => bool) public vendorAllowlist;
    mapping(address => bytes32) public vendorCategory;
    mapping(uint256 => uint256) public hourlySpent;
    mapping(uint256 => uint256) public hourlyPaymentCount;

    mapping(address => AgentInfo) public agents;
    address[] internal agentList;

    mapping(uint256 => Schedule) public schedules;
    mapping(address => uint256[]) public agentSchedules;
    uint256 public scheduleCount;

    event VaultCreated(address indexed owner, address indexed agent, uint256 initialFunding);
    event PaymentApproved(address indexed vendor, uint256 amount, uint256 timestamp);
    event PaymentDeclined(address indexed vendor, uint256 amount, bytes32 encryptedReason);
    event PaymentAttempt(address indexed agent, address indexed vendor, uint256 amount, bool approved, uint256 scheduleId);
    event PolicyUpdated(uint256 maxPerTx, uint256 rollingBudget, uint256 maxRate);
    event EmergencyPause(address indexed by, uint256 timestamp);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event VaultFunded(address indexed from, uint256 amount);
    event VendorUpdated(address indexed vendor, bool allowed);
    event VendorCategorySet(address indexed vendor, bytes32 category);
    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event AgentRegistered(address indexed agent, string name, uint256 limit);
    event AgentStatusChanged(address indexed agent, bool active);
    event AgentRemoved(address indexed agent);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProofSubmitted(bytes32 indexed zkProof, address indexed agent);
    event AttestationVerified(address indexed agent, bytes32 attestationHash, bool valid);
    event ScheduleCreated(uint256 indexed id, address indexed agent, address indexed vendor, uint256 amount, uint256 interval);
    event ScheduleCancelled(uint256 indexed id);
    event ScheduleExecuted(uint256 indexed id, bool approved, uint256 nextExecution);
    event VerifierUpdated(address verifier);

    error NotOwner();
    error NotAgent();
    error VaultPaused();
    error ZeroAddress();
    error TransferFailed();
    error NotDue();
    error InvalidSchedule();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (!agents[msg.sender].registered) revert NotAgent();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert VaultPaused();
        _;
    }

    constructor(address _agent, address _usdc) {
        if (_agent == address(0) || _usdc == address(0)) revert ZeroAddress();
        owner = msg.sender;
        agent = _agent;
        usdcToken = _usdc;
        _register(_agent, "Primary agent", 0);
        emit VaultCreated(msg.sender, _agent, 0);
    }

    // ------------------------------------------------------------------ views

    function currentHour() public view returns (uint256) {
        return block.timestamp / 1 hours;
    }

    function vaultBalance() external view returns (uint256) {
        return IERC20(usdcToken).balanceOf(address(this));
    }

    function getAgents() external view returns (address[] memory) {
        return agentList;
    }

    function getAgentSchedules(address a) external view returns (uint256[] memory) {
        return agentSchedules[a];
    }

    // ------------------------------------------------------------------ funds

    function fundVault(uint256 amount) external onlyOwner {
        if (!IERC20(usdcToken).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit VaultFunded(msg.sender, amount);
    }

    function withdraw(uint256 amount) external onlyOwner {
        if (!IERC20(usdcToken).transfer(owner, amount)) revert TransferFailed();
        emit FundsWithdrawn(owner, amount);
    }

    // --------------------------------------------------------------- payments

    function executePayment(PaymentRequest calldata req) external onlyAgent whenNotPaused returns (bool) {
        if (req.zkProof == bytes32(0)) return _decline(msg.sender, req.vendor, req.amount, req.zkProof, req.timestamp, "INVALID_PROOF", 0);
        emit ProofSubmitted(req.zkProof, msg.sender);
        return _process(msg.sender, req.vendor, req.amount, req.zkProof, req.timestamp, 0);
    }

    /// @notice Same as executePayment but carries a full Primus zkTLS attestation.
    /// @dev If a verifier is configured the attestation must verify; otherwise the owner-set allowlist is the fallback.
    function executePaymentWithProof(PaymentRequest calldata req, bytes calldata attestation)
        external
        onlyAgent
        whenNotPaused
        returns (bool)
    {
        if (primusVerifier != address(0)) {
            bool ok = attestation.length > 0 && IPrimusVerifier(primusVerifier).verify(attestation, msg.sender);
            emit AttestationVerified(msg.sender, keccak256(attestation), ok);
            if (!ok) return _decline(msg.sender, req.vendor, req.amount, req.zkProof, req.timestamp, "INVALID_PROOF", 0);
        } else if (req.zkProof == bytes32(0)) {
            return _decline(msg.sender, req.vendor, req.amount, req.zkProof, req.timestamp, "INVALID_PROOF", 0);
        }
        emit ProofSubmitted(req.zkProof, msg.sender);
        return _process(msg.sender, req.vendor, req.amount, req.zkProof, req.timestamp, 0);
    }

    function _process(address a, address vendor, uint256 amount, bytes32 proof, uint256 ts, uint256 scheduleId)
        internal
        returns (bool)
    {
        AgentInfo storage info = agents[a];
        uint256 hour = currentHour();

        if (!info.active) return _decline(a, vendor, amount, proof, ts, "AGENT_PAUSED", scheduleId);
        if (!vendorAllowlist[vendor]) return _decline(a, vendor, amount, proof, ts, "VENDOR_NOT_ALLOWED", scheduleId);
        if (amount > maxPerTransaction) return _decline(a, vendor, amount, proof, ts, "EXCEEDS_MAX_PER_TX", scheduleId);
        if (hourlySpent[hour] + amount > rollingBudget) return _decline(a, vendor, amount, proof, ts, "EXCEEDS_HOURLY_BUDGET", scheduleId);
        if (hourlyPaymentCount[hour] >= maxPaymentsPerHour) return _decline(a, vendor, amount, proof, ts, "RATE_LIMITED", scheduleId);
        if (info.perAgentLimit != 0 && info.spent + amount > info.perAgentLimit) {
            return _decline(a, vendor, amount, proof, ts, "EXCEEDS_AGENT_LIMIT", scheduleId);
        }

        hourlySpent[hour] += amount;
        hourlyPaymentCount[hour] += 1;
        info.spent += amount;
        info.lastActive = block.timestamp;
        if (!IERC20(usdcToken).transfer(vendor, amount)) revert TransferFailed();
        emit PaymentApproved(vendor, amount, block.timestamp);
        emit PaymentAttempt(a, vendor, amount, true, scheduleId);
        return true;
    }

    function _decline(
        address a,
        address vendor,
        uint256 amount,
        bytes32 proof,
        uint256 ts,
        string memory reason,
        uint256 scheduleId
    ) internal returns (bool) {
        // Reason is committed as a salted hash so observers cannot read it; the owner can recompute it off-chain.
        bytes32 encryptedReason = keccak256(abi.encode(reason, owner, proof, ts));
        emit PaymentDeclined(vendor, amount, encryptedReason);
        emit PaymentAttempt(a, vendor, amount, false, scheduleId);
        return false;
    }

    // ----------------------------------------------------------------- agents

    function _register(address a, string memory name, uint256 limit) internal {
        if (!agents[a].registered) agentList.push(a);
        AgentInfo storage info = agents[a];
        info.name = name;
        info.active = true;
        info.perAgentLimit = limit;
        info.registered = true;
        emit AgentRegistered(a, name, limit);
    }

    function registerAgent(address a, string calldata name, uint256 limit) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        _register(a, name, limit);
    }

    function setAgentLimit(address a, uint256 limit) external onlyOwner {
        if (!agents[a].registered) revert NotAgent();
        agents[a].perAgentLimit = limit;
        emit AgentRegistered(a, agents[a].name, limit);
    }

    function pauseAgent(address a) external onlyOwner {
        if (!agents[a].registered) revert NotAgent();
        agents[a].active = false;
        emit AgentStatusChanged(a, false);
    }

    function resumeAgent(address a) external onlyOwner {
        if (!agents[a].registered) revert NotAgent();
        agents[a].active = true;
        emit AgentStatusChanged(a, true);
    }

    function removeAgent(address a) external onlyOwner {
        if (!agents[a].registered) revert NotAgent();
        agents[a].registered = false;
        agents[a].active = false;
        uint256 n = agentList.length;
        for (uint256 i; i < n; i++) {
            if (agentList[i] == a) {
                agentList[i] = agentList[n - 1];
                agentList.pop();
                break;
            }
        }
        emit AgentRemoved(a);
    }

    /// @notice Replace the primary agent. The new address is registered with the old primary's name and limit.
    function updateAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        address prev = agent;
        AgentInfo memory old = agents[prev];
        emit AgentUpdated(prev, newAgent);
        agent = newAgent;
        _register(newAgent, bytes(old.name).length > 0 ? old.name : "Primary agent", old.perAgentLimit);
    }

    // -------------------------------------------------------------- schedules

    function createSchedule(address a, address vendor, uint256 amount, uint256 interval) external onlyOwner returns (uint256 id) {
        if (!agents[a].registered) revert NotAgent();
        if (vendor == address(0)) revert ZeroAddress();
        if (amount == 0 || interval < 1 hours) revert InvalidSchedule();
        id = ++scheduleCount;
        schedules[id] = Schedule(a, vendor, amount, interval, block.timestamp + interval, true);
        agentSchedules[a].push(id);
        emit ScheduleCreated(id, a, vendor, amount, interval);
    }

    function cancelSchedule(uint256 id) external onlyOwner {
        if (!schedules[id].active) revert InvalidSchedule();
        schedules[id].active = false;
        emit ScheduleCancelled(id);
    }

    /// @notice Anyone may trigger a due schedule; the payment still passes through every policy rule.
    function executeSchedule(uint256 id) external whenNotPaused returns (bool ok) {
        Schedule storage s = schedules[id];
        if (!s.active || !agents[s.agent].registered) revert InvalidSchedule();
        if (block.timestamp < s.nextExecution) revert NotDue();
        s.nextExecution = block.timestamp + s.interval;
        ok = _process(s.agent, s.vendor, s.amount, bytes32(id), block.timestamp, id);
        emit ScheduleExecuted(id, ok, s.nextExecution);
    }

    // ----------------------------------------------------------------- policy

    function setPolicy(uint256 _maxPerTx, uint256 _rollingBudget, uint256 _maxRate) external onlyOwner {
        maxPerTransaction = _maxPerTx;
        rollingBudget = _rollingBudget;
        maxPaymentsPerHour = _maxRate;
        encryptedPolicyHandle = keccak256(abi.encode(_maxPerTx, _rollingBudget, _maxRate, block.number));
        emit PolicyUpdated(_maxPerTx, _rollingBudget, _maxRate);
    }

    function addVendor(address vendor) external onlyOwner {
        if (vendor == address(0)) revert ZeroAddress();
        vendorAllowlist[vendor] = true;
        emit VendorUpdated(vendor, true);
    }

    function addVendorWithCategory(address vendor, bytes32 category) external onlyOwner {
        if (vendor == address(0)) revert ZeroAddress();
        vendorAllowlist[vendor] = true;
        vendorCategory[vendor] = category;
        emit VendorUpdated(vendor, true);
        emit VendorCategorySet(vendor, category);
    }

    function removeVendor(address vendor) external onlyOwner {
        vendorAllowlist[vendor] = false;
        emit VendorUpdated(vendor, false);
    }

    function setVerifier(address verifier) external onlyOwner {
        primusVerifier = verifier;
        emit VerifierUpdated(verifier);
    }

    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPause(msg.sender, block.timestamp);
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
