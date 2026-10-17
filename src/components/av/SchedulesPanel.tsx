import { useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import { agentVaultAbi } from "@/lib/agentVaultArtifact";
import { useTx } from "@/lib/use-tx";
import type { AgentRow } from "@/lib/vault-agents";
import { vendorName } from "@/lib/vendors";
import { short, USDC_DECIMALS } from "@/lib/web3";
import { EmptyGeometry } from "./Geometry";

const PRESETS = [
  { label: "Hourly", s: 3600 },
  { label: "Daily", s: 86400 },
  { label: "Weekly", s: 604800 },
  { label: "Monthly", s: 2592000 },
] as const;
const intervalLabel = (s: number) => PRESETS.find((p) => p.s === s)?.label ?? `${Math.round(s / 3600)}h`;

type Sched = { id: bigint; agent: Address; vendor: Address; amount: bigint; interval: number; next: number; active: boolean };

export function SchedulesPanel({ vault, isOwner, agents, supported }: { vault: Address; isOwner: boolean; agents: AgentRow[]; supported: boolean }) {
  const count = useReadContract({ address: vault, abi: agentVaultAbi, functionName: "scheduleCount", query: { refetchInterval: 15_000 } });
  const n = Number((count.data as bigint | undefined) ?? 0n);
  const reads = useReadContracts({
    allowFailure: true,
    query: { enabled: n > 0, refetchInterval: 15_000 },
    contracts: Array.from({ length: n }, (_, i) => ({ address: vault, abi: agentVaultAbi, functionName: "schedules", args: [BigInt(i + 1)] }) as const),
  });
  const list: Sched[] = (reads.data ?? []).flatMap((r, i) => {
    const v = r.result as readonly [Address, Address, bigint, bigint, bigint, boolean] | undefined;
    return v ? [{ id: BigInt(i + 1), agent: v[0], vendor: v[1], amount: v[2], interval: Number(v[3]), next: Number(v[4]) * 1000, active: v[5] }] : [];
  });
  const refetch = () => { count.refetch(); reads.refetch(); };
  const { busy, msg, run, write } = useTx();
  const name = (a: Address) => agents.find((x) => x.address === a)?.name || short(a);

  if (!supported || count.isError) return <p className="text-muted-foreground">This vault was deployed before schedules existed. Deploy a new vault to use recurring payments.</p>;

  return (
    <div className="space-y-6">
      {isOwner && <CreateForm vault={vault} agents={agents} onDone={refetch} />}

      <div className="card-av overflow-hidden">
        <div className="border-b px-5 py-3"><span className="label-av">Schedules</span></div>
        {list.length === 0 ? <EmptyGeometry label="No schedules yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b"><tr className="label-av">{["#", "Agent", "Vendor", "Amount", "Interval", "Next execution", "Status", ""].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y font-mono text-xs">
                {list.map((s) => {
                  const due = s.active && Date.now() >= s.next;
                  return (
                    <tr key={s.id.toString()}>
                      <td className="px-5 py-3">{s.id.toString()}</td>
                      <td className="px-5 py-3 text-ink">{name(s.agent)}</td>
                      <td className="px-5 py-3">{vendorName(s.vendor) ?? short(s.vendor)}</td>
                      <td className="px-5 py-3 text-ink">${formatUnits(s.amount, USDC_DECIMALS)}</td>
                      <td className="px-5 py-3">{intervalLabel(s.interval)}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{s.active ? new Date(s.next).toLocaleString() : "—"}</td>
                      <td className="px-5 py-3"><span className={s.active ? "text-primary" : "text-muted-foreground"}>{s.active ? (due ? "DUE" : "ACTIVE") : "CANCELLED"}</span></td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {due && <button className="mr-3 text-primary underline underline-offset-4" disabled={!!busy} onClick={() => run(`Run #${s.id}`, () => write(vault, "executeSchedule", [s.id]), refetch)}>Run now</button>}
                        {isOwner && s.active && <button className="text-muted-foreground hover:text-primary" disabled={!!busy} onClick={() => run(`Cancel #${s.id}`, () => write(vault, "cancelSchedule", [s.id]), refetch)}>Cancel</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {msg && <p className={`font-mono text-xs ${msg.ok ? "text-success" : "text-primary"}`}>{msg.text}</p>}
      <Timeline list={list.filter((s) => s.active)} name={name} />
    </div>
  );
}

function CreateForm({ vault, agents, onDone }: { vault: Address; agents: AgentRow[]; onDone: () => void }) {
  const { busy, msg, run, write } = useTx();
  const [agent, setAgent] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState<number>(86400);
  const a = agent || agents[0]?.address || "";
  return (
    <div className="card-av p-8">
      <h2 className="text-2xl">Create a recurring payment</h2>
      <p className="mt-2 text-sm">Anyone can trigger a payment once it is due, but it still has to pass every vault rule.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <select className="input-av text-sm" value={a} onChange={(e) => setAgent(e.target.value)}>
          {agents.map((x) => <option key={x.address} value={x.address}>{x.name || short(x.address)}</option>)}
        </select>
        <input className="input-av font-mono text-xs" placeholder="Vendor 0x…" value={vendor} onChange={(e) => setVendor(e.target.value.trim())} />
        <input className="input-av" type="number" min="0" placeholder="Amount $" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => <button key={p.s} onClick={() => setInterval(p.s)} className={`pill-av ${interval === p.s ? "border-primary text-primary" : "text-body"}`}>{p.label}</button>)}
      </div>
      <button className="btn-av btn-primary mt-6" disabled={!isAddress(a) || !isAddress(vendor) || !Number(amount) || !!busy}
        onClick={() => run("Create schedule", () => write(vault, "createSchedule", [a, vendor, parseUnits(amount, USDC_DECIMALS), BigInt(interval)]), () => { setVendor(""); setAmount(""); onDone(); })}>
        {busy ? "Waiting for wallet…" : "Create Schedule"}
      </button>
      {msg && <p className={`mt-3 font-mono text-xs ${msg.ok ? "text-success" : "text-primary"}`}>{msg.text}</p>}
    </div>
  );
}

function Timeline({ list, name }: { list: Sched[]; name: (a: Address) => string }) {
  const now = Date.now();
  const span = 30 * 86400_000;
  const points = list.flatMap((s) => {
    const out: { t: number; s: Sched }[] = [];
    for (let t = Math.max(s.next, now); t <= now + span && out.length < 60; t += s.interval * 1000) out.push({ t, s });
    return out;
  });
  return (
    <div className="card-av p-6">
      <p className="label-av">Upcoming executions · next 30 days</p>
      {points.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nothing scheduled.</p> : (
        <>
          <div className="relative mt-8 h-10">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
            {points.map((p, i) => (
              <span key={i} title={`#${p.s.id} ${name(p.s.agent)} · ${new Date(p.t).toLocaleString()}`}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                style={{ left: `${((p.t - now) / span) * 100}%` }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground"><span>Today</span><span>+15d</span><span>+30d</span></div>
          <p className="mt-4 text-xs text-muted-foreground">{points.length} executions planned</p>
        </>
      )}
    </div>
  );
}
