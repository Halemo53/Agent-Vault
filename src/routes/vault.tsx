import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount, useReadContracts, useConfig } from "wagmi";
import { getWalletClient, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import { Copy, ExternalLink, Plus, X, Check } from "lucide-react";
import { agentVaultAbi, agentVaultBytecode } from "@/lib/agentVaultArtifact";
import { BASESCAN, USDC_ADDRESS, USDC_DECIMALS, erc20Abi, short } from "@/lib/web3";
import { useVaultRegistry } from "@/lib/vault-registry";
import { ActivityTable } from "@/components/av/ActivityTable";
import { ConnectButton } from "@/components/av/ConnectButton";
import { useActiveVault, useVaultAgents } from "@/lib/vault-agents";
import { SchedulesPanel } from "@/components/av/SchedulesPanel";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Vault Dashboard — AgentVault" },
      { name: "description", content: "Deploy, fund and configure an AgentVault for your AI agent on Base Sepolia." },
      { property: "og:title", content: "Vault Dashboard — AgentVault" },
      { property: "og:description", content: "Owner dashboard: policies, vendor allowlist, emergency pause and activity log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VaultPage,
});

type Tab = "manage" | "activity" | "schedules" | "settings";

function useTx() {
  const config = useConfig();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(label: string, fn: () => Promise<`0x${string}` | void>, after?: () => void) {
    setBusy(label); setMsg(null);
    try {
      const hash = await fn();
      if (hash) await waitForTransactionReceipt(config, { hash });
      setMsg({ ok: true, text: `${label}: confirmed` });
      after?.();
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string });
      setMsg({ ok: false, text: `${label}: ${m.shortMessage ?? m.message ?? "failed"}` });
    } finally { setBusy(null); }
  }
  return { busy, msg, run, config };
}

function VaultPage() {
  const { address, isConnected } = useAccount();
  const { vaults, add } = useVaultRegistry();
  const [vault, setVault] = useActiveVault();
  const [agentSel, setAgentSel] = useState<string>("");
  const va = useVaultAgents(vault);
  const agentNames = Object.fromEntries(va.agents.map((a) => [a.address.toLowerCase(), a.name]));
  const selAgent = va.agents.find((a) => a.address === agentSel);
  const [tab, setTab] = useState<Tab>("manage");
  const [lookup, setLookup] = useState("");

  useEffect(() => { setAgentSel(""); }, [vault]);

  const reads = useReadContracts({
    allowFailure: true,
    query: { enabled: !!vault, refetchInterval: 12_000 },
    contracts: vault ? [
      { address: vault, abi: agentVaultAbi, functionName: "owner" },
      { address: vault, abi: agentVaultAbi, functionName: "agent" },
      { address: vault, abi: agentVaultAbi, functionName: "paused" },
      { address: vault, abi: agentVaultAbi, functionName: "maxPerTransaction" },
      { address: vault, abi: agentVaultAbi, functionName: "rollingBudget" },
      { address: vault, abi: agentVaultAbi, functionName: "maxPaymentsPerHour" },
      { address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [vault] },
    ] : [],
  });
  const d = reads.data?.map((r) => r.result);
  const state = d && d[0] ? {
    owner: d[0] as Address, agent: d[1] as Address, paused: d[2] as boolean,
    maxPerTx: d[3] as bigint, budget: d[4] as bigint, rate: d[5] as bigint, balance: (d[6] as bigint) ?? 0n,
  } : undefined;
  const isOwner = !!state && !!address && state.owner.toLowerCase() === address.toLowerCase();

  if (!isConnected) {
    return (
      <div className="container-av section-av">
        <div className="card-av mx-auto max-w-lg p-10 text-center">
          <p className="label-av">Owner dashboard</p>
          <h1 className="mt-4 text-3xl">Connect your wallet</h1>
          <p className="mt-3">Connect an EVM wallet on Base Sepolia to deploy and manage your agent vault.</p>
          <div className="mt-8 flex justify-center"><ConnectButton /></div>
        </div>
      </div>
    );
  }

  const mine = vaults.filter((v) => v.owner.toLowerCase() === address!.toLowerCase());

  return (
    <div className="container-av py-12 md:py-16">
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-av divide-y">
            <SideRow label="Vault contract">
              {vault ? <CopyAddr value={vault} /> : <span className="text-muted-foreground">Not selected</span>}
            </SideRow>
            <SideRow label="Status">
              {state ? (
                <span className={`pill-av ${state.paused ? "text-muted-foreground" : "border-primary text-primary"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${state.paused ? "bg-muted-foreground" : "bg-primary"}`} />
                  {state.paused ? "Paused" : "Active"}
                </span>
              ) : <span className="text-muted-foreground">—</span>}
            </SideRow>
            <SideRow label="Owner">{state ? <CopyAddr value={state.owner} /> : "—"}</SideRow>
            <SideRow label="Agent">
              {!state ? "—" : va.supported && va.agents.length > 0 ? (
                <div className="space-y-2">
                  <select className="input-av h-9 text-xs" value={agentSel} onChange={(e) => setAgentSel(e.target.value)}>
                    <option value="">All agents ({va.agents.length})</option>
                    {va.agents.map((a) => <option key={a.address} value={a.address}>{a.name || short(a.address)}</option>)}
                  </select>
                  {selAgent ? (
                    <div className="space-y-1 text-xs">
                      <CopyAddr value={selAgent.address} />
                      <p>{selAgent.active ? "Active" : "Paused"} · spent ${formatUnits(selAgent.spent, USDC_DECIMALS)}{selAgent.limit > 0n ? ` of $${formatUnits(selAgent.limit, USDC_DECIMALS)}` : ""}</p>
                    </div>
                  ) : <CopyAddr value={state.agent} />}
                </div>
              ) : <CopyAddr value={state.agent} />}
            </SideRow>
            <SideRow label="USDC balance">
              <span className="font-display text-3xl font-bold text-ink">
                {state ? `$${Number(formatUnits(state.balance, USDC_DECIMALS)).toLocaleString()}` : "—"}
              </span>
            </SideRow>
          </div>
          <div className="card-av mt-4 p-5">
            <p className="label-av">Your vaults</p>
            <div className="mt-3 space-y-1">
              {mine.length === 0 && <p className="text-sm text-muted-foreground">None deployed from this browser.</p>}
              {mine.map((v) => (
                <button key={v.address} onClick={() => setVault(v.address)}
                  className={`block w-full rounded-md px-2 py-1.5 text-left font-mono text-xs ${v.address === vault ? "bg-accent text-primary" : "hover:bg-muted"}`}>
                  {short(v.address, 6)}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input className="input-av h-9 font-mono text-xs" placeholder="Load vault 0x…" value={lookup} onChange={(e) => setLookup(e.target.value)} />
              <button className="btn-av btn-outline h-9 px-3 text-xs" disabled={!isAddress(lookup)} onClick={() => { setVault(lookup as Address); setLookup(""); }}>Load</button>
            </div>
            {vault && <button className="mt-3 text-xs text-primary underline underline-offset-4" onClick={() => setVault(undefined)}>+ Deploy a new vault</button>}
          </div>
        </aside>

        <section>
          <div className="flex flex-wrap gap-1 border-b">
            {([["manage", "Create / Manage Vault"], ["activity", "Activity Log"], ["schedules", "Schedules"], ["settings", "Settings"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] transition-colors ${tab === k ? "border-primary text-ink" : "border-transparent text-muted-foreground hover:text-ink"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="mt-8 animate-fade-up" key={tab}>
            {tab === "manage" && (!vault
              ? <DeployForm owner={address!} onDeployed={(v, agent) => { add({ address: v, owner: address!, agent, createdAt: Date.now() }); setVault(v); }} />
              : state ? <ManagePanel vault={vault} state={state} isOwner={isOwner} refetch={() => reads.refetch()} />
              : <p className="text-muted-foreground">{reads.isLoading ? "Loading vault…" : "This address is not an AgentVault on Base Sepolia."}</p>)}
            {tab === "activity" && (vault ? <ActivityTable vault={vault} owner={state?.owner} canDecrypt={isOwner} agentFilter={(agentSel || undefined) as Address | undefined} agentNames={agentNames} /> : <p className="text-muted-foreground">Deploy or load a vault first.</p>)}
            {tab === "schedules" && (vault && state ? <SchedulesPanel vault={vault} isOwner={isOwner} agents={va.agents} supported={va.supported} /> : <p className="text-muted-foreground">Deploy or load a vault first.</p>)}
            {tab === "settings" && (vault && state ? <SettingsPanel vault={vault} isOwner={isOwner} refetch={() => reads.refetch()} /> : <p className="text-muted-foreground">Deploy or load a vault first.</p>)}
          </div>
        </section>
      </div>
    </div>
  );
}

function SideRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="p-5"><p className="label-av mb-2">{label}</p><div className="text-sm">{children}</div></div>;
}

function CopyAddr({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="flex items-center gap-2 font-mono text-xs text-ink hover:text-primary" title={value}
      onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); }}>
      {short(value, 6)} {ok ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
    </button>
  );
}

function Field({ label, prefix, children }: { label: string; prefix?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-av">{label}</span>
      <div className="relative mt-2">
        {prefix && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{prefix}</span>}
        {children}
      </div>
    </label>
  );
}

function Status({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return <p className={`mt-4 font-mono text-xs ${msg.ok ? "text-success" : "text-primary"}`}>{msg.text}</p>;
}

function DeployForm({ owner, onDeployed }: { owner: Address; onDeployed: (v: Address, agent: Address) => void }) {
  const [agent, setAgent] = useState("");
  const [fund, setFund] = useState("");
  const { busy, msg, run, config } = useTx();
  const [step, setStep] = useState("");
  const valid = isAddress(agent) && (fund === "" || Number(fund) >= 0);

  async function deploy() {
    await run("Deploy Vault", async () => {
      const wallet = await getWalletClient(config);
      setStep("1/3 Deploying contract");
      const hash = await wallet.deployContract({ abi: agentVaultAbi, bytecode: agentVaultBytecode, args: [agent as Address, USDC_ADDRESS] });
      const rc = await waitForTransactionReceipt(config, { hash });
      const v = rc.contractAddress as Address;
      const amount = fund ? parseUnits(fund, USDC_DECIMALS) : 0n;
      if (amount > 0n) {
        setStep("2/3 Approving USDC");
        const a = await writeContract(config, { address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [v, amount] });
        await waitForTransactionReceipt(config, { hash: a });
        setStep("3/3 Funding vault");
        const f = await writeContract(config, { address: v, abi: agentVaultAbi, functionName: "fundVault", args: [amount] });
        await waitForTransactionReceipt(config, { hash: f });
      }
      setStep("");
      onDeployed(v, agent as Address);
    });
    setStep("");
  }

  return (
    <div className="card-av max-w-xl p-8">
      <h2 className="text-2xl">Deploy a new vault</h2>
      <p className="mt-2 text-sm">You ({short(owner)}) become the owner. The agent can only spend within the rules you set next.</p>
      <div className="mt-8 space-y-5">
        <Field label="Agent wallet address"><input className="input-av font-mono text-sm" placeholder="0x…" value={agent} onChange={(e) => setAgent(e.target.value.trim())} /></Field>
        <Field label="Initial USDC funding (optional)" prefix="$"><input className="input-av pl-7" type="number" min="0" placeholder="0.00" value={fund} onChange={(e) => setFund(e.target.value)} /></Field>
      </div>
      <button className="btn-av btn-primary mt-8 w-full" disabled={!valid || !!busy} onClick={deploy}>{busy ? step || "Waiting for wallet" : "Deploy Vault"}</button>
      <p className="mt-4 text-xs text-muted-foreground">Need testnet USDC? Use the Circle faucet at faucet.circle.com (Base Sepolia).</p>
      <Status msg={msg} />
    </div>
  );
}

type VState = { owner: Address; agent: Address; paused: boolean; maxPerTx: bigint; budget: bigint; rate: bigint; balance: bigint };

function ManagePanel({ vault, state, isOwner, refetch }: { vault: Address; state: VState; isOwner: boolean; refetch: () => void }) {
  const { busy, msg, run, config } = useTx();
  const [maxTx, setMaxTx] = useState(formatUnits(state.maxPerTx, USDC_DECIMALS));
  const [budget, setBudget] = useState(formatUnits(state.budget, USDC_DECIMALS));
  const [rate, setRate] = useState(state.rate.toString());
  const [vendors, setVendors] = useState<Address[]>(() => JSON.parse(globalThis.localStorage?.getItem(`agentvault:vendors:${vault}`) || "[]"));
  const [newVendor, setNewVendor] = useState("");
  const [deposit, setDeposit] = useState("");
  const saveVendors = (v: Address[]) => { setVendors(v); localStorage.setItem(`agentvault:vendors:${vault}`, JSON.stringify(v)); };
  const w = (functionName: string, args: unknown[] = []) =>
    writeContract(config, { address: vault, abi: agentVaultAbi, functionName, args } as never);

  if (!isOwner) return <p className="text-muted-foreground">Connected wallet is not the owner of this vault. Switch account to manage it.</p>;

  return (
    <div className="space-y-6">
      <div className="card-av p-8">
        <h2 className="text-2xl">Policy rules</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Field label="Max per transaction" prefix="$"><input className="input-av pl-7" type="number" min="0" value={maxTx} onChange={(e) => setMaxTx(e.target.value)} /></Field>
          <Field label="Rolling hourly budget" prefix="$"><input className="input-av pl-7" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
          <Field label="Max payments / hour"><input className="input-av" type="number" min="0" step="1" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
        </div>
        <button className="btn-av btn-primary mt-8" disabled={!!busy}
          onClick={() => run("Update Policy", () => w("setPolicy", [parseUnits(maxTx || "0", USDC_DECIMALS), parseUnits(budget || "0", USDC_DECIMALS), BigInt(Math.floor(Number(rate) || 0))]), refetch)}>
          Update Policy
        </button>
      </div>

      <div className="card-av p-8">
        <h2 className="text-2xl">Vendor allowlist</h2>
        <div className="mt-6 flex gap-2">
          <input className="input-av font-mono text-sm" placeholder="Vendor address 0x…" value={newVendor} onChange={(e) => setNewVendor(e.target.value.trim())} />
          <button className="btn-av btn-outline shrink-0" disabled={!isAddress(newVendor) || !!busy}
            onClick={() => run("Add vendor", () => w("addVendor", [newVendor]), () => { saveVendors([...vendors.filter((x) => x !== newVendor), newVendor as Address]); setNewVendor(""); })}>
            <Plus size={16} strokeWidth={1.5} /> Add
          </button>
        </div>
        <ul className="mt-4 divide-y border-t">
          {vendors.length === 0 && <li className="py-3 text-sm text-muted-foreground">No vendors allowlisted. Every payment will be declined.</li>}
          {vendors.map((v) => (
            <li key={v} className="flex items-center justify-between py-3 font-mono text-xs text-ink">
              {v}
              <button className="text-muted-foreground hover:text-primary" disabled={!!busy} title="Remove"
                onClick={() => run("Remove vendor", () => w("removeVendor", [v]), () => saveVendors(vendors.filter((x) => x !== v)))}>
                <X size={14} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card-av p-8">
        <h2 className="text-2xl">Funds and control</h2>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-48"><Field label="Deposit USDC" prefix="$"><input className="input-av pl-7" type="number" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></Field></div>
          <button className="btn-av btn-outline" disabled={!Number(deposit) || !!busy}
            onClick={() => run("Fund vault", async () => {
              const amt = parseUnits(deposit, USDC_DECIMALS);
              const a = await writeContract(config, { address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [vault, amt] });
              await waitForTransactionReceipt(config, { hash: a });
              return w("fundVault", [amt]);
            }, () => { setDeposit(""); refetch(); })}>Fund Vault</button>
        </div>
        <div className="mt-8 flex flex-wrap gap-3 border-t pt-8">
          {state.paused
            ? <button className="btn-av btn-primary" disabled={!!busy} onClick={() => run("Unpause", () => w("unpause"), refetch)}>Resume Vault</button>
            : <button className="btn-av btn-danger" disabled={!!busy} onClick={() => run("Emergency Pause", () => w("pause"), refetch)}>Emergency Pause</button>}
          <button className="btn-av btn-outline" disabled={!!busy || state.balance === 0n}
            onClick={() => run("Withdraw", () => w("withdraw", [state.balance]), refetch)}>Withdraw All Funds</button>
        </div>
        {busy && <p className="mt-4 font-mono text-xs text-muted-foreground">{busy}: waiting for confirmation…</p>}
        <Status msg={msg} />
      </div>
    </div>
  );
}

function SettingsPanel({ vault, isOwner, refetch }: { vault: Address; isOwner: boolean; refetch: () => void }) {
  const { busy, msg, run, config } = useTx();
  const [agent, setAgent] = useState("");
  const [owner, setOwner] = useState("");
  const w = (functionName: string, args: unknown[]) => writeContract(config, { address: vault, abi: agentVaultAbi, functionName, args } as never);
  return (
    <div className="space-y-6">
      <div className="card-av p-8">
        <h2 className="text-2xl">Update agent address</h2>
        <div className="mt-6 flex gap-2">
          <input className="input-av font-mono text-sm" placeholder="New agent 0x…" value={agent} onChange={(e) => setAgent(e.target.value.trim())} />
          <button className="btn-av btn-primary shrink-0" disabled={!isOwner || !isAddress(agent) || !!busy} onClick={() => run("Update agent", () => w("updateAgent", [agent]), refetch)}>Update</button>
        </div>
      </div>
      <div className="card-av p-8">
        <h2 className="text-2xl">Transfer ownership</h2>
        <p className="mt-2 text-sm">Irreversible. The new owner gains full control of policy and funds.</p>
        <div className="mt-6 flex gap-2">
          <input className="input-av font-mono text-sm" placeholder="New owner 0x…" value={owner} onChange={(e) => setOwner(e.target.value.trim())} />
          <button className="btn-av btn-danger shrink-0" disabled={!isOwner || !isAddress(owner) || !!busy} onClick={() => run("Transfer ownership", () => w("transferOwnership", [owner]), refetch)}>Transfer</button>
        </div>
      </div>
      <div className="card-av flex items-center justify-between p-8">
        <div><h2 className="text-2xl">View on BaseScan</h2><p className="mt-1 font-mono text-xs">{vault}</p></div>
        <a className="btn-av btn-outline" href={`${BASESCAN}/address/${vault}`} target="_blank" rel="noreferrer">Open <ExternalLink size={14} strokeWidth={1.5} /></a>
      </div>
      {!isOwner && <p className="text-sm text-muted-foreground">Only the owner can change these settings.</p>}
      <Status msg={msg} />
    </div>
  );
}
