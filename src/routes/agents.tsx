import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import { Plus } from "lucide-react";
import { agentVaultAbi } from "@/lib/agentVaultArtifact";
import { useActiveVault, useAgentDescriptions, useVaultAgents, type AgentRow } from "@/lib/vault-agents";
import { useTx } from "@/lib/use-tx";
import { short, USDC_DECIMALS } from "@/lib/web3";
import { VaultPicker } from "@/components/av/VaultPicker";
import { EmptyGeometry } from "@/components/av/Geometry";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agent Registry — AgentVault" },
      { name: "description", content: "Register multiple AI agents on one vault, each with its own spending sub-limit, and pause or remove them on-chain." },
      { property: "og:title", content: "Agent Registry — AgentVault" },
      { property: "og:description", content: "One vault, many agents, individual on-chain limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentsPage,
});

const usd = (v: bigint) => `$${Number(formatUnits(v, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function AgentsPage() {
  const [vault] = useActiveVault();
  const { address } = useAccount();
  const { agents, supported, isLoading, refetch } = useVaultAgents(vault);
  const owner = useReadContract({ address: vault, abi: agentVaultAbi, functionName: "owner", query: { enabled: !!vault } });
  const isOwner = !!address && !!owner.data && (owner.data as string).toLowerCase() === address.toLowerCase();
  const desc = useAgentDescriptions();

  return (
    <div className="container-av py-12 md:py-16">
      <p className="label-av">Agent registry</p>
      <h1 className="mt-4 text-4xl md:text-5xl">Agents</h1>
      <p className="mt-3 max-w-xl">Share one vault across several agents. Global rules apply to all of them, and each agent also has its own spending limit.</p>
      <div className="mt-10"><VaultPicker /></div>

      {!vault ? (
        <EmptyGeometry label="Select or load a vault to see its agents" />
      ) : !supported ? (
        <p className="mt-10 text-muted-foreground">This vault was deployed before multi-agent support. Deploy a new vault from the Vault page to use the registry.</p>
      ) : (
        <>
          {isOwner && <RegisterForm vault={vault} onDone={refetch} setDesc={desc.set} />}
          {isLoading ? <p className="mt-10 text-muted-foreground">Reading agents…</p> : agents.length === 0 ? (
            <EmptyGeometry label="No agents registered" />
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((a) => <AgentCard key={a.address} vault={vault} a={a} description={desc.get(a.address)} isOwner={isOwner} onDone={refetch} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RegisterForm({ vault, onDone, setDesc }: { vault: Address; onDone: () => void; setDesc: (a: string, d: string) => void }) {
  const { busy, msg, run, write } = useTx();
  const [addr, setAddr] = useState("");
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [d, setD] = useState("");
  return (
    <div className="card-av mt-6 p-6">
      <h2 className="text-xl">Register an agent</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <input className="input-av font-mono text-xs" placeholder="Agent wallet 0x…" value={addr} onChange={(e) => setAddr(e.target.value.trim())} />
        <input className="input-av" placeholder="Name, e.g. Research bot" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input-av" type="number" min="0" placeholder="Total limit $ (0 = none)" value={limit} onChange={(e) => setLimit(e.target.value)} />
        <input className="input-av" placeholder="Description (optional)" value={d} onChange={(e) => setD(e.target.value)} />
      </div>
      <button className="btn-av btn-primary mt-5" disabled={!isAddress(addr) || !name.trim() || !!busy}
        onClick={() => run("Register agent", () => write(vault, "registerAgent", [addr, name.trim(), parseUnits(limit || "0", USDC_DECIMALS)]), () => {
          if (d.trim()) setDesc(addr, d.trim());
          setAddr(""); setName(""); setLimit(""); setD(""); onDone();
        })}>
        <Plus size={16} strokeWidth={1.5} /> {busy ? "Waiting for wallet…" : "Register Agent"}
      </button>
      {msg && <p className={`mt-3 font-mono text-xs ${msg.ok ? "text-success" : "text-primary"}`}>{msg.text}</p>}
    </div>
  );
}

function AgentCard({ vault, a, description, isOwner, onDone }: { vault: Address; a: AgentRow; description: string; isOwner: boolean; onDone: () => void }) {
  const { busy, msg, run, write } = useTx();
  const [limit, setLimit] = useState("");
  const pct = a.limit > 0n ? Math.min(100, Number((a.spent * 100n) / a.limit)) : 0;
  return (
    <div className="card-av flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[20px] font-bold text-ink">{a.name || "Unnamed agent"}</h3>
        <span className={`pill-av ${a.active ? "border-primary text-primary" : "text-muted-foreground"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${a.active ? "bg-primary" : "bg-muted-foreground"}`} />
          {a.active ? "ACTIVE" : "PAUSED"}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground" title={a.address}>{short(a.address, 6)}</p>
      {description && <p className="mt-3 text-sm">{description}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div><p className="label-av">Total spent</p><p className="mt-1 font-display text-xl font-bold text-ink">{usd(a.spent)}</p></div>
        <div><p className="label-av">Limit</p><p className="mt-1 font-display text-xl font-bold text-ink">{a.limit > 0n ? usd(a.limit) : "None"}</p></div>
      </div>
      {a.limit > 0n && <div className="mt-3 h-1 w-full bg-muted"><div className="h-1 bg-primary" style={{ width: `${pct}%` }} /></div>}
      <p className="mt-4 text-xs text-muted-foreground">Last active: {a.lastActive ? new Date(a.lastActive).toLocaleString() : "never"}</p>
      {isOwner && (
        <div className="mt-5 space-y-3 border-t pt-4">
          <div className="flex gap-2">
            <input className="input-av h-9 text-xs" type="number" min="0" placeholder="New limit $" value={limit} onChange={(e) => setLimit(e.target.value)} />
            <button className="btn-av btn-outline h-9 shrink-0 px-3 text-xs" disabled={limit === "" || !!busy}
              onClick={() => run("Set limit", () => write(vault, "setAgentLimit", [a.address, parseUnits(limit, USDC_DECIMALS)]), () => { setLimit(""); onDone(); })}>Set</button>
          </div>
          <div className="flex gap-2">
            {a.active
              ? <button className="btn-av btn-outline h-9 flex-1 text-xs" disabled={!!busy} onClick={() => run("Pause agent", () => write(vault, "pauseAgent", [a.address]), onDone)}>Pause</button>
              : <button className="btn-av btn-primary h-9 flex-1 text-xs" disabled={!!busy} onClick={() => run("Resume agent", () => write(vault, "resumeAgent", [a.address]), onDone)}>Resume</button>}
            <button className="btn-av btn-danger h-9 flex-1 text-xs" disabled={!!busy} onClick={() => run("Remove agent", () => write(vault, "removeAgent", [a.address]), onDone)}>Remove</button>
          </div>
        </div>
      )}
      {busy && <p className="mt-3 font-mono text-xs text-muted-foreground">{busy}: waiting…</p>}
      {msg && <p className={`mt-3 font-mono text-xs ${msg.ok ? "text-success" : "text-primary"}`}>{msg.text}</p>}
    </div>
  );
}
