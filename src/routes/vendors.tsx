import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { isAddress, type Address } from "viem";
import { Plus, Search, X, Check } from "lucide-react";
import { agentVaultAbi } from "@/lib/agentVaultArtifact";
import { categoryHash, readVendors, rememberVendor, useActiveVault } from "@/lib/vault-agents";
import { VENDOR_CATALOG, VENDOR_CATEGORIES, saveVendorLabel, type Vendor } from "@/lib/vendors";
import { useTx } from "@/lib/use-tx";
import { short } from "@/lib/web3";
import { VaultPicker } from "@/components/av/VaultPicker";

export const Route = createFileRoute("/vendors")({
  head: () => ({
    meta: [
      { title: "Vendor Marketplace — AgentVault" },
      { name: "description", content: "Browse common AI service vendors and add them to your vault's on-chain allowlist with a category tag." },
      { property: "og:title", content: "Vendor Marketplace — AgentVault" },
      { property: "og:description", content: "LLM, data, compute and RPC vendors, one click to allowlist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VendorsPage,
});

function Shape({ i }: { i: number }) {
  const k = i % 4;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <rect x="0.5" y="0.5" width="35" height="35" rx="8" fill="none" className="stroke-border" />
      {k === 0 && <circle cx="18" cy="18" r="8" className="fill-primary" />}
      {k === 1 && <rect x="10" y="10" width="16" height="16" className="fill-ink" />}
      {k === 2 && <path d="M18 9 L27 26 L9 26 Z" className="fill-primary" />}
      {k === 3 && <circle cx="18" cy="18" r="8" fill="none" className="stroke-ink" strokeWidth="2" />}
    </svg>
  );
}

function VendorsPage() {
  const [vault] = useActiveVault();
  const { address } = useAccount();
  const owner = useReadContract({ address: vault, abi: agentVaultAbi, functionName: "owner", query: { enabled: !!vault } });
  const isOwner = !!address && !!owner.data && (owner.data as string).toLowerCase() === address.toLowerCase();
  const { busy, msg, run, write } = useTx();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [added, setAdded] = useState<string[]>([]);
  const [modal, setModal] = useState(false);

  useEffect(() => { setAdded(vault ? readVendors(vault).map((v) => v.toLowerCase()) : []); }, [vault]);

  const list = VENDOR_CATALOG.filter((v) => (cat === "All" || v.category === cat) && v.name.toLowerCase().includes(q.toLowerCase()));

  function add(addr: Address, category: string, label: string) {
    if (!vault) return;
    run(`Add ${label}`, () => write(vault, "addVendorWithCategory", [addr, categoryHash(category)]), () => {
      rememberVendor(vault, addr);
      setAdded((a) => [...a, addr.toLowerCase()]);
    });
  }

  return (
    <div className="container-av py-12 md:py-16">
      <p className="label-av">Allowlist marketplace</p>
      <h1 className="mt-4 text-4xl md:text-5xl">Vendors</h1>
      <p className="mt-3 max-w-xl">Pick the services your agents may pay. Each vendor is added to the vault allowlist on-chain with a category tag.</p>
      <div className="mt-10"><VaultPicker /></div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="input-av pl-10 text-sm" placeholder="Search vendors" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {["All", ...VENDOR_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`pill-av ${cat === c ? "border-primary text-primary" : "text-body"}`}>{c}</button>
        ))}
        <button className="btn-av btn-outline ml-auto" disabled={!isOwner} onClick={() => setModal(true)}><Plus size={16} strokeWidth={1.5} /> Add Custom Vendor</button>
      </div>
      {vault && !isOwner && <p className="mt-4 text-sm text-muted-foreground">Connect the owner wallet of this vault to add vendors.</p>}
      {msg && <p className={`mt-4 font-mono text-xs ${msg.ok ? "text-success" : "text-primary"}`}>{msg.text}</p>}

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {list.map((v, i) => <VendorCard key={v.id} v={v} i={i} added={added.includes(v.address.toLowerCase())} disabled={!isOwner || !!busy} busy={busy === `Add ${v.name}`} onAdd={() => add(v.address, v.category, v.name)} />)}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">These services do not publish on-chain payout addresses, so each card uses a fixed demo address for testnet use. Use Add Custom Vendor for a real address.</p>

      {modal && <CustomModal onClose={() => setModal(false)} onSave={(addr, label, c) => { saveVendorLabel(addr, label, c); add(addr, c, label); setModal(false); }} />}
    </div>
  );
}

function VendorCard({ v, i, added, disabled, busy, onAdd }: { v: Vendor; i: number; added: boolean; disabled: boolean; busy: boolean; onAdd: () => void }) {
  return (
    <div className="card-av flex flex-col p-6">
      <div className="flex items-center gap-4">
        <Shape i={i} />
        <div>
          <h3 className="font-display text-lg font-bold text-ink">{v.name}</h3>
          <span className="label-av">{v.category}</span>
        </div>
      </div>
      <p className="mt-4 text-sm">{v.cost}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{short(v.address, 6)}</p>
      <button className={`btn-av mt-5 ${added ? "btn-outline" : "btn-primary"}`} disabled={added || disabled} onClick={onAdd}>
        {added ? <><Check size={16} strokeWidth={1.5} /> Added</> : busy ? "Waiting for wallet…" : "Add to Vault"}
      </button>
    </div>
  );
}

function CustomModal({ onClose, onSave }: { onClose: () => void; onSave: (a: Address, label: string, cat: string) => void }) {
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");
  const [cat, setCat] = useState<string>("LLM");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card-av w-full max-w-md bg-background p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-2xl">Custom vendor</h2><button onClick={onClose} className="hover:text-primary"><X size={18} strokeWidth={1.5} /></button></div>
        <div className="mt-6 space-y-4">
          <input className="input-av font-mono text-xs" placeholder="Vendor address 0x…" value={addr} onChange={(e) => setAddr(e.target.value.trim())} />
          <input className="input-av" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select className="input-av" value={cat} onChange={(e) => setCat(e.target.value)}>
            {VENDOR_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn-av btn-primary mt-6 w-full" disabled={!isAddress(addr) || !label.trim()} onClick={() => onSave(addr as Address, label.trim(), cat)}>Add to Vault</button>
      </div>
    </div>
  );
}
