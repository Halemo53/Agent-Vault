import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatUnits, isAddress, type Address } from "viem";
import { Search, ArrowLeft } from "lucide-react";
import { useVaultRegistry } from "@/lib/vault-registry";
import { ActivityTable, useActivity } from "@/components/av/ActivityTable";
import { EmptyGeometry } from "@/components/av/Geometry";
import { short, USDC_DECIMALS } from "@/lib/web3";
import { useVaultAgents } from "@/lib/vault-agents";

export const Route = createFileRoute("/monitor")({
  head: () => ({
    meta: [
      { title: "Public Monitor — AgentVault" },
      { name: "description", content: "Read-only public feed of AgentVault deployments and their payment activity on Base Sepolia." },
      { property: "og:title", content: "Public Monitor — AgentVault" },
      { property: "og:description", content: "Every agent payment attempt, approved or declined, verifiable on-chain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Monitor,
});

function Monitor() {
  const { vaults } = useVaultRegistry();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Address | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = vaults.filter((v) => !s || v.address.toLowerCase().includes(s) || v.agent.toLowerCase().includes(s));
    if (isAddress(s) && !filtered.length) return [{ address: s as Address, agent: undefined }];
    return filtered.map((v) => ({ address: v.address, agent: v.agent as Address | undefined }));
  }, [vaults, q]);

  if (open) {
    return (
      <div className="container-av py-12 md:py-16">
        <button className="flex items-center gap-2 text-sm hover:text-primary" onClick={() => setOpen(null)}><ArrowLeft size={14} strokeWidth={1.5} /> All vaults</button>
        <h1 className="mt-6 text-3xl">Vault <span className="font-mono text-xl">{short(open, 8)}</span></h1>
        <AgentFilteredActivity vault={open} />
      </div>
    );
  }

  return (
    <div className="container-av py-12 md:py-16">
      <p className="label-av">Public activity</p>
      <h1 className="mt-4 text-4xl md:text-5xl">Monitor</h1>
      <p className="mt-3 max-w-xl">Every payment attempt is an on-chain event. Search any vault or agent address to audit it. Decline reasons stay encrypted.</p>
      <div className="relative mt-10 max-w-xl">
        <Search size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input className="input-av pl-10 font-mono text-sm" placeholder="Search by vault or agent address" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <EmptyGeometry label="No vaults found — paste a vault address" />
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => <VaultCard key={v.address} address={v.address} agent={v.agent} onOpen={() => setOpen(v.address)} />)}
        </div>
      )}
    </div>
  );
}

function VaultCard({ address, agent, onOpen }: { address: Address; agent?: Address | undefined; onOpen: () => void }) {
  const { data, isLoading } = useActivity(address);
  const approved = data?.filter((a) => a.status === "APPROVED") ?? [];
  const declined = (data?.length ?? 0) - approved.length;
  const spent = approved.reduce((s, a) => s + a.amount, 0n);
  return (
    <button onClick={onOpen} className="card-av p-6 text-left transition-colors hover:border-primary">
      <p className="label-av">Vault</p>
      <p className="mt-1 font-mono text-sm text-ink">{short(address, 6)}</p>
      {agent && <p className="mt-1 font-mono text-xs text-muted-foreground">agent {short(agent)}</p>}
      <div className="mt-6 grid grid-cols-3 gap-2 border-t pt-4">
        <Stat label="Approved" value={isLoading ? "…" : String(approved.length)} cls="text-success" />
        <Stat label="Declined" value={isLoading ? "…" : String(declined)} cls="text-primary" />
        <Stat label="Spent" value={isLoading ? "…" : `$${Number(formatUnits(spent, USDC_DECIMALS)).toFixed(2)}`} cls="text-ink" />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Last activity: {data?.[0] ? new Date(data[0].time).toLocaleString() : "—"}</p>
    </button>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return <div><div className={`font-display text-2xl font-bold ${cls}`}>{value}</div><div className="label-av mt-1">{label}</div></div>;
}

function AgentFilteredActivity({ vault }: { vault: Address }) {
  const { agents } = useVaultAgents(vault);
  const [agent, setAgent] = useState("");
  const names = Object.fromEntries(agents.map((a) => [a.address.toLowerCase(), a.name]));
  return (
    <div className="mt-8">
      {agents.length > 0 && (
        <label className="mb-4 block max-w-xs">
          <span className="label-av">Filter by agent</span>
          <select className="input-av mt-2 text-sm" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">All agents</option>
            {agents.map((a) => <option key={a.address} value={a.address}>{a.name || short(a.address)}</option>)}
          </select>
        </label>
      )}
      <ActivityTable vault={vault} agentFilter={(agent || undefined) as Address | undefined} agentNames={names} />
    </div>
  );
}
