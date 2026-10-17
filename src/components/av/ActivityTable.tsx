import { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchActivity, decryptReason, type Activity } from "@/lib/vault-activity";
import { BASESCAN, short, USDC_DECIMALS } from "@/lib/web3";
import { EmptyGeometry } from "./Geometry";
import { vendorName } from "@/lib/vendors";

export function useActivity(vault?: Address) {
  return useQuery({
    queryKey: ["activity", vault],
    queryFn: () => fetchActivity(vault!),
    enabled: !!vault,
    refetchInterval: 15_000,
  });
}

export function ActivityTable({ vault, owner, canDecrypt, agentFilter, agentNames }: { vault: Address; owner?: Address | undefined; canDecrypt?: boolean; agentFilter?: Address | undefined; agentNames?: Record<string, string> }) {
  const q = useActivity(vault);
  const rows = (q.data ?? []).filter((a) => !agentFilter || a.agent?.toLowerCase() === agentFilter.toLowerCase());
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function decrypt(a: Activity) {
    if (!owner) return;
    setReasons((r) => ({ ...r, [a.txHash]: "Decrypting…" }));
    try {
      const res = await decryptReason(a, owner);
      setReasons((r) => ({ ...r, [a.txHash]: res }));
    } catch {
      setReasons((r) => ({ ...r, [a.txHash]: "Failed to decrypt" }));
    }
  }

  return (
    <div className="card-av overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <span className="label-av">Payment attempts · live</span>
        <button className="text-muted-foreground hover:text-primary" onClick={() => q.refetch()} title="Refresh">
          <RefreshCw size={14} strokeWidth={1.5} className={q.isFetching ? "animate-spin" : ""} />
        </button>
      </div>
      {q.isLoading ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Reading on-chain events…</p>
      ) : !rows.length ? (
        <EmptyGeometry label="No activity yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr className="label-av">
                {["Time", "Agent", "Vendor", "Amount", "Status", "Reason"].map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y font-mono text-xs">
              {rows.map((a) => (
                <tr key={a.txHash + a.status}>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <a href={`${BASESCAN}/tx/${a.txHash}`} target="_blank" rel="noreferrer" className="hover:text-primary">
                      {new Date(a.time).toLocaleString()}
                    </a>
                  </td>
                  <td className="px-5 py-3">{a.agent ? (agentNames?.[a.agent.toLowerCase()] || short(a.agent)) : "—"}{a.scheduleId ? <span className="ml-1 text-muted-foreground">· sched #{a.scheduleId.toString()}</span> : null}</td>
                  <td className="px-5 py-3 text-ink">{vendorName(a.vendor) ?? short(a.vendor)}</td>
                  <td className="px-5 py-3 text-ink">${formatUnits(a.amount, USDC_DECIMALS)}</td>
                  <td className="px-5 py-3">
                    <span className={`flex items-center gap-2 ${a.status === "APPROVED" ? "text-success" : "text-primary"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${a.status === "APPROVED" ? "bg-success" : "bg-primary"}`} />
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {a.status === "APPROVED" ? <span className="text-muted-foreground">—</span>
                      : reasons[a.txHash] ? <span className="text-ink">{reasons[a.txHash]}</span>
                      : canDecrypt ? <button className="text-primary underline underline-offset-4" onClick={() => decrypt(a)}>Encrypted — click to decrypt</button>
                      : <span className="text-muted-foreground">{short(a.encryptedReason, 6)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
