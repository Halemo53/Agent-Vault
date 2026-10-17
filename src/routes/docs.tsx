import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Documentation — AgentVault" },
      { name: "description", content: "How AgentVault uses Primus zkTLS and zkFHE, contract reference, integration guide and security notes." },
      { property: "og:title", content: "AgentVault Documentation" },
      { property: "og:description", content: "Technical reference for building bounded AI agents with AgentVault on Base." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Docs,
});

const toc = [
  ["intro", "Introduction"],
  ["zktls", "zkTLS agent authorization"],
  ["zkfhe", "zkFHE encrypted budgets"],
  ["reference", "Contract reference"],
  ["integration", "Integration guide"],
  ["security", "Security considerations"],
];

const fns = [
  ["constructor(address agent, address usdc)", "Deploys the vault. msg.sender becomes owner."],
  ["fundVault(uint256 amount)", "Owner deposits USDC. Requires prior ERC-20 approve."],
  ["executePayment(PaymentRequest req) → bool", "Agent-only. Runs five checks; transfers on success, emits PaymentDeclined otherwise."],
  ["setPolicy(uint256 maxPerTx, uint256 rollingBudget, uint256 maxRate)", "Owner-only. Updates limits and the policy handle."],
  ["addVendor(address) / removeVendor(address)", "Owner-only. Manage the vendor allowlist."],
  ["pause() / unpause()", "Owner-only. Pause blocks every executePayment call."],
  ["withdraw(uint256 amount)", "Owner-only. Returns USDC to the owner."],
  ["updateAgent(address) / transferOwnership(address)", "Owner-only. Rotate agent key or hand over the vault."],
];

function Code({ children }: { children: string }) {
  return <pre className="card-av mt-4 overflow-x-auto bg-surface-alt p-5 font-mono text-xs leading-relaxed text-ink">{children}</pre>;
}

function S({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t py-12 first:border-t-0 first:pt-0">
      <h2 className="text-3xl">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Docs() {
  return (
    <div className="container-av py-12 md:py-16">
      <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="label-av">Documentation</p>
          <ul className="mt-4 space-y-2 text-sm">
            {toc.map(([id, l]) => <li key={id}><a href={`#${id}`} className="hover:text-primary">{l}</a></li>)}
          </ul>
        </aside>
        <article className="max-w-3xl">
          <S id="intro" title="Introduction">
            <p>AgentVault is a smart-contract wallet that gives an AI agent a bounded budget instead of a private key. The owner funds the vault and sets rules; the agent can only call <code className="font-mono text-ink">executePayment</code>, which enforces those rules on-chain on Base.</p>
            <p>Every attempt — approved or declined — is logged as an event. Decline reasons are committed as hashes that only the owner can open.</p>
          </S>
          <S id="zktls" title="How zkTLS authorizes agents">
            <p>Before paying, the agent obtains a Primus zkTLS attestation proving it holds a valid session with the vendor (for example, an authenticated API invoice). The app signs the attestation request server-side so the Primus appSecret never reaches the browser.</p>
            <Code>{`Agent            AgentVault App         Primus Network         AgentVault.sol
  |  sign request  -->|                        |                       |
  |                   |-- HMAC(appSecret) ---->|                       |
  |<-- signedRequest -|                        |                       |
  |------------- zkTLS session with vendor --->|                       |
  |<------------- attestation (proof) ---------|                       |
  |-------------------- executePayment(vendor, amount, zkProof) ------>|
  |                                            |   5 rule checks       |
  |<----------------------- PaymentApproved | PaymentDeclined ---------|`}</Code>
          </S>
          <S id="zkfhe" title="How zkFHE encrypts budget parameters">
            <p>Policy values are mirrored as a Primus zkFHE ciphertext referenced by <code className="font-mono text-ink">encryptedPolicyHandle</code>. Comparisons such as <em>amount ≤ remaining budget</em> can be evaluated homomorphically, so the agent learns only "approved" or "declined" — never the actual limits.</p>
            <p>In this testnet build the plaintext limits are also stored for transparent verification; the handle is a commitment placeholder until the Primus FHE coprocessor is wired in.</p>
          </S>
          <S id="reference" title="Smart contract function reference">
            <div className="card-av divide-y">
              {fns.map(([f, d]) => (
                <div key={f} className="p-4"><p className="font-mono text-xs text-ink">{f}</p><p className="mt-1 text-sm">{d}</p></div>
              ))}
            </div>
            <p className="label-av pt-4">Checks inside executePayment, in order</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Vendor is on the allowlist</li><li>Amount ≤ maxPerTransaction</li><li>Hourly spent + amount ≤ rollingBudget</li><li>Hourly count &lt; maxPaymentsPerHour</li><li>zkProof is present and valid</li>
            </ol>
          </S>
          <S id="integration" title="Integration guide">
            <p>From your agent runtime (Node, Python via web3, etc.), sign with the agent key and call the vault:</p>
            <Code>{`import { createWalletClient, http, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const agent = createWalletClient({
  account: privateKeyToAccount(process.env.AGENT_KEY),
  chain: baseSepolia, transport: http(),
});

await agent.writeContract({
  address: VAULT, abi: agentVaultAbi, functionName: "executePayment",
  args: [{ vendor: VENDOR, amount: parseUnits("4.20", 6),
           zkProof: attestationHash, timestamp: BigInt(Date.now()) }],
});`}</Code>
            <p>The agent key holds only gas money. Even if fully compromised, the attacker is bound by the same policy.</p>
          </S>
          <S id="security" title="Security considerations">
            <ul className="list-disc space-y-2 pl-5">
              <li>Keep the owner key in a hardware wallet; the agent key should hold only gas.</li>
              <li>Keep maxPerTransaction small relative to rollingBudget to limit blast radius.</li>
              <li>Declined attempts do not revert, so they are always visible in the activity log.</li>
              <li>Emergency pause takes effect in the next block; withdraw afterwards if compromise is suspected.</li>
              <li>The zkProof check is a placeholder on testnet. Do not use with real funds before integrating the Primus on-chain verifier and an audit.</li>
            </ul>
          </S>
        </article>
      </div>
    </div>
  );
}
