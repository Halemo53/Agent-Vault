import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ShieldCheck, Power, ArrowRight } from "lucide-react";
import { HeroGeometry, BrokenKeyDiagram } from "@/components/av/Geometry";
import { simulatePayment, SIM_POLICY } from "@/lib/primus.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgentVault — Give your AI agent a wallet, not your private key" },
      { name: "description", content: "Encrypted budgets, per-transaction caps and instant revocation for AI agents, enforced on Base." },
      { property: "og:title", content: "AgentVault — Budget vaults for AI agents" },
      { property: "og:description", content: "Hard on-chain spending limits for autonomous AI agents, built on Primus zkTLS and zkFHE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Lock, title: "Encrypted Budgets", body: "Policy parameters are encrypted with Primus zkFHE. The agent cannot read its own limits, only operate within them." },
  { icon: ShieldCheck, title: "Hard On-Chain Rules", body: "Per-transaction caps, rolling hourly budgets, vendor allowlists, rate limits. Enforced by Solidity, not by trust." },
  { icon: Power, title: "Instant Revocation", body: "One click freezes the vault. Agent authority dies immediately. Withdraw remaining funds anytime." },
];

const steps = [
  ["Connect Wallet", "Connect to Base Sepolia with any EVM wallet.", "~30s"],
  ["Fund the Vault", "Deposit testnet USDC into the vault contract.", "~1min"],
  ["Set Policy Rules", "Configure max-per-tx, hourly budget, rate limit, vendor allowlist.", "~1min"],
  ["Authorize Agent", "Add the agent's wallet address to the vault.", "~30s"],
  ["Monitor Activity", "Watch every payment attempt in real time with private decline reasons.", "Live"],
];

const stats = [
  ["5", "on-chain rules enforced per transaction"],
  ["<200ms", "zkTLS proof verification time"],
  ["0", "private keys exposed to agents"],
  ["100%", "on-chain policy enforcement"],
];

function Index() {
  return (
    <>
      <section className="section-av grid-paper border-b">
        <div className="container-av grid items-center gap-16 md:grid-cols-2">
          <div className="animate-fade-up">
            <span className="pill-av"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Primus Ecosystem · Builder Track</span>
            <h1 className="mt-8 text-[clamp(44px,6vw,76px)] leading-[1.05] tracking-[-0.03em]">Give your AI agent a wallet. Not your private key.</h1>
            <p className="mt-6 max-w-xl text-lg md:text-xl">
              AgentVault enforces hard spending limits on autonomous AI agents. Encrypted budgets, per-transaction caps, instant revocation all enforced on-chain.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/vault" className="btn-av btn-primary">Launch App <ArrowRight size={16} strokeWidth={1.5} /></Link>
              <Link to="/docs" className="btn-av btn-outline">Read Docs</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Built on Primus", "Base Sepolia testnet"].map((b) => (
                <span key={b} className="pill-av rounded-none border-l-2 border-l-primary bg-background">{b}</span>
              ))}
            </div>
          </div>
          <HeroGeometry />
        </div>
      </section>
      <Ticker />

      <section className="section-av bg-surface-alt border-b">
        <div className="container-av grid items-center gap-16 md:grid-cols-2">
          <div>
            <span className="rule-av mb-5" aria-hidden /><p className="label-av">The problem</p>
            <h2 className="mt-4 text-4xl md:text-5xl">One prompt injection. Total loss.</h2>
            <div className="mt-8 space-y-5">
              <p>AI agents increasingly pay for APIs, data and compute on their own. Today the only way to let them do that is to hand over a private key.</p>
              <p>A private key is all-or-nothing. A single injected instruction, a hallucinated invoice or a compromised tool can move every token in the wallet in one transaction.</p>
              <p>There is no native way to say "spend up to this much, only with these vendors, and stop when I say so." AgentVault adds that missing layer.</p>
            </div>
          </div>
          <div className="flex justify-center md:justify-end"><BrokenKeyDiagram /></div>
        </div>
      </section>

      <section className="section-av border-b">
        <div className="container-av">
          <span className="rule-av mb-5" aria-hidden /><p className="label-av">Core features</p>
          <h2 className="mt-4 max-w-2xl text-4xl md:text-5xl">Spending power, without control.</h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="card-av card-feature group p-8">
                <svg className="absolute right-4 top-4" width="24" height="24" aria-hidden>
                  <path d="M0 0.5 H23.5 V24" fill="none" className="stroke-primary" strokeWidth="1" />
                </svg>
                <div className="icon-box group-hover:border-primary group-hover:text-primary">
                  <Icon size={20} strokeWidth={1.5} aria-hidden />
                </div>
                <p className="mt-8 font-mono text-xs text-muted-foreground">// {String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 text-xl">{title}</h3>
                <p className="mt-3 text-[15px]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-av bg-surface-alt border-b">
        <div className="container-av grid gap-16 md:grid-cols-2">
          <div className="order-2 md:order-1"><Demo /></div>
          <div className="order-1 md:order-2">
            <span className="rule-av mb-5" aria-hidden /><p className="label-av">How it works</p>
            <h2 className="mt-4 text-4xl md:text-5xl">Five steps to a bounded agent.</h2>
            <ol className="relative mt-12 space-y-12 border-l pl-10">
              <span className="animate-travel absolute -left-[3.5px] h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {steps.map(([t, d, time], i) => (
                <li key={t} className="relative">
                  <span className="absolute -left-[43.5px] top-2 h-1.5 w-1.5 rounded-full bg-primary ring-4 ring-surface-alt" aria-hidden />
                  <span className="pointer-events-none absolute -top-4 left-0 select-none font-display text-5xl font-bold text-border" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="relative flex flex-wrap items-center gap-3 pl-14">
                    <h3 className="text-xl font-semibold">{t}</h3>
                    <span className="pill-av">{time}</span>
                  </div>
                  <p className="relative mt-1 max-w-[520px] pl-14 text-[15px]">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="container-av grid grid-cols-2 md:grid-cols-4">
          {stats.map(([n, l], i) => (
            <div key={l} className={`py-14 pr-6 ${i > 0 ? "md:border-l md:pl-8" : ""} ${i % 2 === 1 ? "border-l pl-6" : ""}`}>
              <div className="tabular font-display text-5xl font-bold tracking-tight text-ink md:text-[64px]">{n}</div>
              <p className="mt-3 text-sm text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-av">
        <div className="container-av flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <h2 className="max-w-2xl text-4xl md:text-5xl">Ready to deploy your first agent vault?</h2>
          <Link to="/vault" className="btn-av btn-primary">Launch App <ArrowRight size={16} strokeWidth={1.5} /></Link>
        </div>
      </section>
    </>
  );
}

function Demo() {
  const [vendor, setVendor] = useState<string>(SIM_POLICY.allowlist[0]!);
  const [amount, setAmount] = useState("10");
  const [spent, setSpent] = useState(0);
  const [count, setCount] = useState(0);
  const [log, setLog] = useState<{ amount: number; approved: boolean; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const amt = Number(amount);
    const res = await simulatePayment({ data: { vendor, amount: amt, spentThisHour: spent, countThisHour: count } });
    if (res.approved) { setSpent((s) => s + amt); setCount((c) => c + 1); }
    setLog((l) => [{ amount: amt, ...res }, ...l].slice(0, 5));
    setBusy(false);
  }

  return (
    <div className="card-av p-6 md:p-8">
      <div className="flex items-center justify-between">
        <span className="rule-av mb-5" aria-hidden /><p className="label-av">Try demo · simulated agent</p>
        <span className="pill-av">Mock policy</span>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 border-y py-4 font-mono text-xs">
        <div><div className="text-muted-foreground">MAX / TX</div><div className="text-ink">${SIM_POLICY.maxPerTransaction}</div></div>
        <div><div className="text-muted-foreground">HOURLY</div><div className="text-ink">${spent} / ${SIM_POLICY.rollingBudget}</div></div>
        <div><div className="text-muted-foreground">RATE</div><div className="text-ink">{count} / {SIM_POLICY.maxPaymentsPerHour}</div></div>
      </div>
      <label className="label-av mt-6 block">Vendor</label>
      <select className="input-av mt-2 font-mono text-xs" value={vendor} onChange={(e) => setVendor(e.target.value)}>
        {SIM_POLICY.allowlist.map((v) => <option key={v} value={v}>{v} (allowlisted)</option>)}
        <option value="0x000000000000000000000000000000000badbeef">0x…badbeef (unknown)</option>
      </select>
      <label className="label-av mt-4 block">Amount (USDC)</label>
      <input className="input-av mt-2" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button className="btn-av btn-primary mt-6 w-full" disabled={busy} onClick={run}>Agent requests payment</button>
      <ul className="mt-6 divide-y border-t">
        {log.map((l, i) => (
          <li key={i} className="flex items-center justify-between py-2.5 font-mono text-xs">
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${l.approved ? "bg-success" : "bg-primary"}`} />
              <span className={l.approved ? "text-success" : "text-primary"}>{l.approved ? "APPROVED" : "DECLINED"}</span>
            </span>
            <span className="text-muted-foreground">{l.reason}</span>
            <span className="text-ink">${l.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const tickerEvents = [
  ["0x7a…3f2", "0.12", "openai.api", "2s"],
  ["0x91…c4e", "0.04", "coingecko.api", "9s"],
  ["0x3b…a17", "1.50", "anthropic.api", "14s"],
  ["0x7a…3f2", "0.30", "alchemy.rpc", "21s"],
  ["0xe2…09d", "0.08", "replicate.run", "33s"],
  ["0x91…c4e", "0.25", "openai.api", "48s"],
];

function Ticker() {
  const items = [...tickerEvents, ...tickerEvents];
  return (
    <div className="overflow-hidden border-b bg-background py-3" aria-label="Example vault activity">
      <div className="animate-ticker flex w-max">
        {items.map(([a, amt, v, t], i) => (
          <span key={i} className="whitespace-nowrap border-r px-6 font-mono text-[13px] text-muted-foreground">
            <span className="text-ink">{a}</span> PAID <span className="text-primary">{amt} USDC</span> TO {v} — {t} ago
          </span>
        ))}
      </div>
    </div>
  );
}
