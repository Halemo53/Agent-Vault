import { useEffect, useState, useCallback } from "react";
import type { Address } from "viem";

// Local registry of known vaults (the dApp has no indexer; vaults are discovered locally or by search).
const KEY = "agentvault:vaults";

export type VaultEntry = { address: Address; owner: Address; agent: Address; createdAt: number };

function read(): VaultEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function useVaultRegistry() {
  const [vaults, setVaults] = useState<VaultEntry[]>([]);
  useEffect(() => {
    setVaults(read());
    const on = () => setVaults(read());
    window.addEventListener("agentvault:registry", on);
    return () => window.removeEventListener("agentvault:registry", on);
  }, []);
  const add = useCallback((v: VaultEntry) => {
    const list = read().filter((x) => x.address.toLowerCase() !== v.address.toLowerCase());
    list.unshift(v);
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("agentvault:registry"));
  }, []);
  return { vaults, add };
}
