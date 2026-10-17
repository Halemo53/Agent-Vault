<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Contract source lives in contracts/src; the app deploys from src/lib/agentVaultArtifact.ts, so recompile (solcjs) and regenerate that file after any contract change — otherwise UI and chain drift.
- Wallet layer is wagmi + viem with the injected connector on Base Sepolia only (src/lib/web3.ts) — RainbowKit was skipped to keep SSR on workers simple.
- Activity is read straight from contract events (no indexer); known vaults are tracked in localStorage — no backend database needed.
- Primus secrets are read only inside server functions (src/lib/primus.functions.ts) so they never reach the browser.
- One vault serves many agents: agents are registered on-chain (getAgents + agents mapping) and each payment also emits PaymentAttempt so the UI can attribute activity to an agent without an indexer.
- The selected vault is shared across pages via useActiveVault (src/lib/vault-agents.ts) — keeps Vault, Agents and Vendors pages in sync.
