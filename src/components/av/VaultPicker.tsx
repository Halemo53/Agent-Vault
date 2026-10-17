import { useState } from "react";
import { isAddress, type Address } from "viem";
import { Link } from "@tanstack/react-router";
import { useVaultRegistry } from "@/lib/vault-registry";
import { useActiveVault } from "@/lib/vault-agents";
import { short } from "@/lib/web3";

/** Selects which vault a page works on; shares the selection with the Vault dashboard. */
export function VaultPicker() {
  const { vaults } = useVaultRegistry();
  const [vault, setVault] = useActiveVault();
  const [lookup, setLookup] = useState("");
  return (
    <div className="card-av flex flex-wrap items-end gap-4 p-5">
      <label className="block min-w-[220px] flex-1">
        <span className="label-av">Vault</span>
        <select className="input-av mt-2 font-mono text-xs" value={vault ?? ""} onChange={(e) => setVault((e.target.value || undefined) as Address | undefined)}>
          <option value="">Select a vault…</option>
          {vault && !vaults.some((v) => v.address.toLowerCase() === vault.toLowerCase()) && <option value={vault}>{short(vault, 6)}</option>}
          {vaults.map((v) => <option key={v.address} value={v.address}>{short(v.address, 6)}</option>)}
        </select>
      </label>
      <div className="flex flex-1 gap-2">
        <input className="input-av font-mono text-xs" placeholder="Or load vault 0x…" value={lookup} onChange={(e) => setLookup(e.target.value.trim())} />
        <button className="btn-av btn-outline shrink-0" disabled={!isAddress(lookup)} onClick={() => { setVault(lookup as Address); setLookup(""); }}>Load</button>
      </div>
      {!vaults.length && !vault && <Link to="/vault" className="text-sm text-primary underline underline-offset-4">Deploy a vault</Link>}
    </div>
  );
}
