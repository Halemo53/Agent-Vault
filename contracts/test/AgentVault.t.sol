// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AgentVault.sol";

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) { balanceOf[msg.sender] -= a; balanceOf[to] += a; return true; }
    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[to] += a; return true;
    }
}

contract AgentVaultTest is Test {
    AgentVault vault;
    MockUSDC usdc;
    address agent = address(0xA9);
    address vendor = address(0xBE);
    bytes32 proof = keccak256("proof");

    function setUp() public {
        usdc = new MockUSDC();
        vault = new AgentVault(agent, address(usdc));
        usdc.mint(address(this), 1_000e6);
        usdc.approve(address(vault), 1_000e6);
        vault.fundVault(500e6);
        vault.setPolicy(25e6, 100e6, 3);
        vault.addVendor(vendor);
    }

    function req(address v, uint256 amt) internal view returns (AgentVault.PaymentRequest memory) {
        return AgentVault.PaymentRequest(v, amt, proof, block.timestamp);
    }

    function testApprovedPayment() public {
        vm.prank(agent);
        assertTrue(vault.executePayment(req(vendor, 10e6)));
        assertEq(usdc.balanceOf(vendor), 10e6);
    }

    function testDeclinesUnknownVendor() public {
        vm.prank(agent);
        assertFalse(vault.executePayment(req(address(0xDEAD), 1e6)));
    }

    function testDeclinesOverMaxPerTx() public {
        vm.prank(agent);
        assertFalse(vault.executePayment(req(vendor, 26e6)));
    }

    function testDeclinesOverHourlyBudget() public {
        vault.setPolicy(60e6, 100e6, 10);
        vm.startPrank(agent);
        assertTrue(vault.executePayment(req(vendor, 60e6)));
        assertFalse(vault.executePayment(req(vendor, 41e6)));
        vm.stopPrank();
    }

    function testDeclinesOverRate() public {
        vm.startPrank(agent);
        for (uint256 i; i < 3; i++) assertTrue(vault.executePayment(req(vendor, 1e6)));
        assertFalse(vault.executePayment(req(vendor, 1e6)));
        vm.stopPrank();
    }

    function testDeclinesEmptyProof() public {
        AgentVault.PaymentRequest memory r = req(vendor, 1e6);
        r.zkProof = bytes32(0);
        vm.prank(agent);
        assertFalse(vault.executePayment(r));
    }

    function testOnlyAgent() public {
        vm.expectRevert(AgentVault.NotAgent.selector);
        vault.executePayment(req(vendor, 1e6));
    }

    function testPauseBlocksAgent() public {
        vault.pause();
        vm.prank(agent);
        vm.expectRevert(AgentVault.VaultPaused.selector);
        vault.executePayment(req(vendor, 1e6));

    // ---------------------------------------------------------- multi-agent

    address agent2 = address(0xA2);

    function testSecondAgentCanPay() public {
        vault.registerAgent(agent2, "Scraper", 0);
        vm.prank(agent2);
        assertTrue(vault.executePayment(req(vendor, 5e6)));
        (, , , uint256 spent, , ) = vault.agents(agent2);
        assertEq(spent, 5e6);
    }

    function testPerAgentLimit() public {
        vault.registerAgent(agent2, "Capped", 8e6);
        vm.startPrank(agent2);
        assertTrue(vault.executePayment(req(vendor, 5e6)));
        assertFalse(vault.executePayment(req(vendor, 5e6)));
        vm.stopPrank();
    }

    function testPausedAgentDeclined() public {
        vault.pauseAgent(agent);
        vm.prank(agent);
        assertFalse(vault.executePayment(req(vendor, 1e6)));
        vault.resumeAgent(agent);
        vm.prank(agent);
        assertTrue(vault.executePayment(req(vendor, 1e6)));
    }

    function testRemovedAgentReverts() public {
        vault.registerAgent(agent2, "Temp", 0);
        vault.removeAgent(agent2);
        vm.prank(agent2);
        vm.expectRevert(AgentVault.NotAgent.selector);
        vault.executePayment(req(vendor, 1e6));
        assertEq(vault.getAgents().length, 1);
    }

    // ------------------------------------------------------------ schedules

    function testScheduleExecutesWhenDue() public {
        uint256 id = vault.createSchedule(agent, vendor, 2e6, 1 days);
        vm.expectRevert(AgentVault.NotDue.selector);
        vault.executeSchedule(id);
        vm.warp(block.timestamp + 1 days);
        vm.prank(address(0xCAFE));
        assertTrue(vault.executeSchedule(id));
        assertEq(usdc.balanceOf(vendor), 2e6);
    }

    function testScheduleRespectsPolicy() public {
        uint256 id = vault.createSchedule(agent, vendor, 30e6, 1 hours);
        vm.warp(block.timestamp + 1 hours);
        assertFalse(vault.executeSchedule(id));
    }

    function testCancelledSchedule() public {
        uint256 id = vault.createSchedule(agent, vendor, 1e6, 1 hours);
        vault.cancelSchedule(id);
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(AgentVault.InvalidSchedule.selector);
        vault.executeSchedule(id);
    }

    function testVendorCategory() public {
        bytes32 cat = keccak256("LLM");
        vault.addVendorWithCategory(address(0xF00), cat);
        assertTrue(vault.vendorAllowlist(address(0xF00)));
        assertEq(vault.vendorCategory(address(0xF00)), cat);
    }
}

    function testWithdraw() public {
        vault.withdraw(500e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function testOnlyOwnerPolicy() public {
        vm.prank(agent);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.setPolicy(1, 1, 1);
    }
}
