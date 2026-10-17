import { createServerFn } from "@tanstack/react-start";

const isAddr = (v: unknown) => typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);

/** Signs a Primus zkTLS attestation request server-side. PRIMUS_APP_SECRET never leaves the server. */
export const signZkTlsRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { agentAddress: string; vaultAddress: string; scope: string }) => {
    if (!isAddr(d.agentAddress) || !isAddr(d.vaultAddress)) throw new Error("Invalid address");
    if (typeof d.scope !== "string" || d.scope.length > 64) throw new Error("Invalid scope");
    return d;
  })
  .handler(async ({ data }) => {
    const appId = process.env["PRIMUS_APP_ID"];
    const secret = process.env["PRIMUS_APP_SECRET"];
    if (!appId || !secret) {
      return { error: "Primus credentials are not configured on the server." as const };
    }
    const request = { appId, ...data, timestamp: Date.now() };
    const payload = JSON.stringify(request);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const signature = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { signedRequestStr: JSON.stringify({ attRequest: request, appSignature: signature }) };
  });

export type SimRequest = { vendor: string; amount: number; spentThisHour: number; countThisHour: number };

export const SIM_POLICY = {
  maxPerTransaction: 25,
  rollingBudget: 100,
  maxPaymentsPerHour: 5,
  allowlist: ["0x00000000000000000000000000000000000a1b2c", "0x0000000000000000000000000000000000d47a00"],
};

export function evaluateMock(r: SimRequest): { approved: boolean; reason: string } {
  if (!SIM_POLICY.allowlist.includes(r.vendor.toLowerCase())) return { approved: false, reason: "VENDOR_NOT_ALLOWED" };
  if (r.amount > SIM_POLICY.maxPerTransaction) return { approved: false, reason: "EXCEEDS_MAX_PER_TX" };
  if (r.spentThisHour + r.amount > SIM_POLICY.rollingBudget) return { approved: false, reason: "EXCEEDS_HOURLY_BUDGET" };
  if (r.countThisHour >= SIM_POLICY.maxPaymentsPerHour) return { approved: false, reason: "RATE_LIMITED" };
  return { approved: true, reason: "ALL_RULES_PASSED" };
}

/** Demo-only: simulated policy check against mock rules. */
export const simulatePayment = createServerFn({ method: "POST" })
  .inputValidator((d: SimRequest) => {
    if (typeof d.vendor !== "string" || !Number.isFinite(d.amount) || d.amount < 0) throw new Error("Invalid request");
    return d;
  })
  .handler(async ({ data }) => evaluateMock(data));
