import { useEffect, useState, useCallback } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { isAddress, keccak256, toHex, type Address } from "viem";
import { agentVaultAbi } from "./agentVaultArtifact";

export type AgentRow = {
  address: Address;
  name: string;
  active: boolean;
  limit: bigint;
  spent: bigint;
  lastActive: number; // ms, 0 = never
};

/** Reads every registered agent of a vault. Returns `supported: false` for vaults deployed before multi-agent support. */
export function useVaultAgents(vault?: Address) {
  const list = useReadContract({
    address: vault,
    abi: agentVaultAbi,
    functionName: "getAgents",
    query: { enabled: !!vault, refetchInterval: 15_000 },
  });
  const addrs = (list.data as Address[] | undefined) ?? [];
  const infos = useReadContracts({
    allowFailure: true,
    query: { enabled: !!vault && addrs.length > 0, refetchInterval: 15_000 },
    contracts: addrs.map((a) => ({ address: vault!, abi: agentVaultAbi, functionName: "agents", args: [a] }) as const),
  });
  const agents: AgentRow[] = addrs.map((a, i) => {
    const r = infos.data?.[i]?.result as readonly [string, boolean, bigint, bigint, boolean, bigint] | undefined;
    return {
      address: a,
      name: r?.[0] ?? "",
      active: r?.[1] ?? false,
      limit: r?.[2] ?? 0n,
      spent: r?.[3] ?? 0n,
      lastActive: r ? Number(r[5]) * 1000 : 0,
    };
  });
  return {
    agents,
    supported: !list.isError,
    isLoading: list.isLoading || infos.isLoading,
    refetch: () => { list.refetch(); infos.refetch(); },
  };
}

// Descriptions are an off-chain label only; kept in this browser.
const DESC_KEY = "agentvault:agent-desc";
export function useAgentDescriptions() {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    try { setMap(JSON.parse(localStorage.getItem(DESC_KEY) || "{}")); } catch { /* ignore */ }
  }, []);
  const set = useCallback((addr: string, desc: string) => {
    setMap((m) => {
      const next = { ...m, [addr.toLowerCase()]: desc };
      localStorage.setItem(DESC_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { get: (a: string) => map[a.toLowerCase()] ?? "", set };
}

// The vault currently selected in the dashboard, shared across pages.
export const ACTIVE_KEY = "agentvault:active";
export function useActiveVault() {
  const [vault, setVaultState] = useState<Address | undefined>();
  useEffect(() => {
    const read = () => {
      const s = localStorage.getItem(ACTIVE_KEY);
      setVaultState(s && isAddress(s) ? s : undefined);
    };
    read();
    window.addEventListener("agentvault:active", read);
    return () => window.removeEventListener("agentvault:active", read);
  }, []);
  const setVault = useCallback((v?: Address) => {
    if (v) localStorage.setItem(ACTIVE_KEY, v); else localStorage.removeItem(ACTIVE_KEY);
    setVaultState(v);
    window.dispatchEvent(new Event("agentvault:active"));
  }, []);
  return [vault, setVault] as const;
}

export const categoryHash = (c: string) => keccak256(toHex(c));

// Locally remembered allowlist (the contract stores a mapping, which cannot be enumerated).
export function readVendors(vault: string): Address[] {
  try { return JSON.parse(localStorage.getItem(`agentvault:vendors:${vault}`) || "[]"); } catch { return []; }
}
export function rememberVendor(vault: string, v: Address) {
  const list = readVendors(vault).filter((x) => x.toLowerCase() !== v.toLowerCase());
  list.push(v);
  localStorage.setItem(`agentvault:vendors:${vault}`, JSON.stringify(list));
}
