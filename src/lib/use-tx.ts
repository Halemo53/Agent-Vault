import { useState } from "react";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import type { Address } from "viem";
import { agentVaultAbi } from "./agentVaultArtifact";

export function useTx() {
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
      const m = e as { shortMessage?: string; message?: string };
      setMsg({ ok: false, text: `${label}: ${m.shortMessage ?? m.message ?? "failed"}` });
    } finally { setBusy(null); }
  }
  const write = (vault: Address, functionName: string, args: unknown[] = []) =>
    writeContract(config, { address: vault, abi: agentVaultAbi, functionName, args } as never);
  return { busy, msg, run, config, write };
}
