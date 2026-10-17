# AgentVault

A privacy-preserving budget vault for AI agents, built for the Primus Labs ecosystem. Runs on **Base Sepolia** (chain 84532).

## Problem
AI agents need to pay for APIs, data and compute autonomously. Handing them a private key means one prompt injection or hallucination can drain everything.

## Solution
The owner funds a vault contract and sets hard rules. The agent can only call `executePayment`, which checks:
1. vendor allowlist · 2. max per transaction · 3. rolling hourly budget · 4. payments per hour · 5. zkTLS proof present.
Declined attempts emit a hashed reason only the owner can decrypt. The owner can pause, withdraw, or rotate the agent at any time.

## Architecture
```text
 Browser (owner)                    Server functions               Base Sepolia
 ┌──────────────────┐   sign req   ┌──────────────────────┐
 │ /vault dashboard │ ───────────▶ │ signZkTlsRequest     │ (PRIMUS_APP_SECRET)
 │ /monitor feed    │              │ simulatePayment      │ (demo)
 │ wagmi + viem     │ ─── tx ──────────────────────────────────▶ AgentVault.sol ──▶ USDC
 └──────────────────┘ ◀── events (PaymentApproved/Declined) ────
 Agent runtime ── zkTLS proof (Primus) ── executePayment ───────▶ AgentVault.sol
```

## Stack
TanStack Start (React 19, Vite), Tailwind v4, wagmi v2 + viem, lucide-react, Solidity 0.8.24 + Foundry.
(The original brief targeted Next.js; this implementation uses the TanStack Start platform with equivalent server functions.)

## Setup
```bash
bun install
cp .env.example .env   # fill in PRIMUS_APP_ID / PRIMUS_APP_SECRET
bun run dev
```

### Primus credentials
1. Go to https://dev.primuslabs.xyz and sign in.
2. Create a project and copy the **App ID** and **App Secret**.
3. Set `PRIMUS_APP_ID` and `PRIMUS_APP_SECRET` as server secrets. Never expose the secret to the client.

## Contract
The app deploys vaults directly from the browser using the compiled bytecode in `src/lib/agentVaultArtifact.ts`.
To deploy via Foundry instead:
```bash
cd contracts
forge install foundry-rs/forge-std
forge test
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast
```
USDC (Base Sepolia): `0x036CbD53842c5426634e7929541eC2318f3dCF7e` — get test USDC at https://faucet.circle.com.

## Testing the full flow
1. Connect a wallet on Base Sepolia (get ETH from a Base Sepolia faucet).
2. `/vault` → enter agent address and funding → **Deploy Vault**.
3. Set policy and add a vendor.
4. From the agent wallet, call `executePayment` (see /docs integration guide).
5. Watch the Activity Log; click declined reasons to decrypt them. Try **Emergency Pause**.

## Notes
- zkTLS proof verification and zkFHE policy encryption are placeholders on testnet (commitment hashes), pending the Primus on-chain verifier.
- COOP/COEP headers for the Primus WASM SDK are not enabled by default because they block wallet popups; enable them on a dedicated attestation page if you embed the SDK.

## Screenshots
_(placeholder)_

Built for Primus Labs Code Prover builder track.

## Multi-agent vaults, vendors and schedules
- **Agents** (`/agents`): register several agents on one vault, each with a lifetime spending limit; pause, resume or remove them. Payments check global rules and then the agent's own limit.
- **Vendors** (`/vendors`): curated LLM / Data / Compute / RPC vendors (fixed demo payout addresses on testnet) plus custom vendors; added on-chain with a category tag (`addVendorWithCategory`).
- **Schedules** (Vault → Schedules): recurring payments (hourly/daily/weekly/monthly). Anyone can call `executeSchedule` once due; the payment still passes every rule.
- **Optional attestation**: `executePaymentWithProof(req, attestation)` verifies through a Primus verifier contract when one is set (`setVerifier`), otherwise falls back to the allowlist.
Vaults deployed before this upgrade keep working but do not have these features — deploy a new vault to use them.
