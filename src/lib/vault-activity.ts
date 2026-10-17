import { decodeFunctionData, encodeAbiParameters, keccak256, pad, toHex, type Address, type Hash } from "viem";
import { agentVaultAbi } from "./agentVaultArtifact";
import { DECLINE_REASONS, publicClient } from "./web3";

export type Activity = {
  txHash: Hash;
  block: bigint;
  time: number;
  vendor: Address;
  amount: bigint;
  status: "APPROVED" | "DECLINED";
  encryptedReason?: Hash;
  /** Agent that made the attempt (vaults deployed before multi-agent support leave this empty). */
  agent?: Address;
  scheduleId?: bigint;
};

const CHUNK = 9_000n;
const LOOKBACK = 90_000n; // ~2 days on Base Sepolia

export async function fetchActivity(vault: Address): Promise<Activity[]> {
  const latest = await publicClient.getBlockNumber();
  const start = latest > LOOKBACK ? latest - LOOKBACK : 0n;
  const ranges: [bigint, bigint][] = [];
  for (let from = start; from <= latest; from += CHUNK + 1n) {
    const to = from + CHUNK > latest ? latest : from + CHUNK;
    ranges.push([from, to]);
  }
  const chunks = await Promise.all(
    ranges.map(([fromBlock, toBlock]) =>
      publicClient
        .getContractEvents({ address: vault, abi: agentVaultAbi, fromBlock, toBlock })
        .catch(() => []),
    ),
  );
  const all = chunks.flat();
  // PaymentAttempt is emitted right after PaymentApproved/Declined in the same tx.
  const attempts = new Map<string, { agent: Address; scheduleId: bigint }>();
  for (const l of all) {
    if (l.eventName === "PaymentAttempt") {
      const a = l.args as { agent: Address; scheduleId: bigint };
      attempts.set(`${l.transactionHash}:${(l.logIndex ?? 0) - 1}`, { agent: a.agent, scheduleId: a.scheduleId });
    }
  }
  const logs = all.filter((l) => l.eventName === "PaymentApproved" || l.eventName === "PaymentDeclined");
  const blockTimes = new Map<bigint, number>();
  await Promise.all(
    [...new Set(logs.map((l) => l.blockNumber))].map(async (b) => {
      const blk = await publicClient.getBlock({ blockNumber: b });
      blockTimes.set(b, Number(blk.timestamp) * 1000);
    }),
  );
  return logs
    .map((l) => {
      const args = l.args as { vendor: Address; amount: bigint; encryptedReason?: Hash };
      const att = attempts.get(`${l.transactionHash}:${l.logIndex}`);
      return {
        txHash: l.transactionHash,
        block: l.blockNumber,
        time: blockTimes.get(l.blockNumber) ?? 0,
        vendor: args.vendor,
        amount: args.amount,
        status: l.eventName === "PaymentApproved" ? "APPROVED" : "DECLINED",
        encryptedReason: args.encryptedReason,
        agent: att?.agent,
        scheduleId: att && att.scheduleId > 0n ? att.scheduleId : undefined,
      } as Activity;
    })
    .sort((a, b) => Number(b.block - a.block));
}

/** Owner-side decryption: recompute the salted reason commitment from the original calldata. */
export async function decryptReason(a: Activity, owner: Address): Promise<string> {
  const tx = await publicClient.getTransaction({ hash: a.txHash });
  const { functionName, args } = decodeFunctionData({ abi: agentVaultAbi, data: tx.input });
  let proof: Hash;
  let ts: bigint;
  if (functionName === "executeSchedule") {
    // Schedules commit with bytes32(scheduleId) and the block timestamp.
    proof = pad(toHex((args as unknown as [bigint])[0]), { size: 32 });
    ts = BigInt(Math.floor(a.time / 1000));
  } else {
    const req = (args as unknown as [{ zkProof: Hash; timestamp: bigint }])[0];
    proof = req.zkProof;
    ts = req.timestamp;
  }
  for (const reason of DECLINE_REASONS) {
    const h = keccak256(
      encodeAbiParameters(
        [{ type: "string" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }],
        [reason, owner, proof, ts],
      ),
    );
    if (h === a.encryptedReason) return reason;
  }
  return "UNKNOWN (only the vault owner key matches)";
}
