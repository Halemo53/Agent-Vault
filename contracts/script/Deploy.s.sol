// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentVault.sol";

contract Deploy is Script {
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        address agent = vm.envAddress("AGENT_ADDRESS");
        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        AgentVault vault = new AgentVault(agent, USDC);
        vault.setPolicy(25e6, 100e6, 10);
        vm.stopBroadcast();
        console.log("AgentVault deployed at", address(vault));
    }
}
