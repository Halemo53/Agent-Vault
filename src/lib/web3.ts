import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { createPublicClient, http as viemHttp, parseAbi, type Address } from "viem";

export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
export const USDC_DECIMALS = 6;
export const BASESCAN = "https://sepolia.basescan.org";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: { [baseSepolia.id]: http() },
  ssr: true,
});

export const publicClient = createPublicClient({ chain: baseSepolia, transport: viemHttp() });

export const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

export const DECLINE_REASONS = [
  "VENDOR_NOT_ALLOWED",
  "EXCEEDS_MAX_PER_TX",
  "EXCEEDS_HOURLY_BUDGET",
  "RATE_LIMITED",
  "INVALID_PROOF",
  "AGENT_PAUSED",
  "EXCEEDS_AGENT_LIMIT",
] as const;

export const short = (a?: string, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "—");

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
