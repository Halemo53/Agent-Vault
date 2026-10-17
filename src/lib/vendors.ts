import { getAddress, keccak256, toHex, type Address } from "viem";

export type VendorCategory = "LLM" | "Data" | "Compute" | "RPC";
export const VENDOR_CATEGORIES: VendorCategory[] = ["LLM", "Data", "Compute", "RPC"];

export type Vendor = { id: string; name: string; category: VendorCategory; cost: string; address: Address };

/** Demo payout address derived from the vendor name — these services do not publish on-chain payout addresses. */
const demoAddr = (id: string) => getAddress(`0x${keccak256(toHex(`agentvault:vendor:${id}`)).slice(26)}`);

const RAW: Omit<Vendor, "address">[] = [
  { id: "openai", name: "OpenAI API", category: "LLM", cost: "$0.002 – $0.06 / call" },
  { id: "anthropic", name: "Anthropic API", category: "LLM", cost: "$0.003 – $0.08 / call" },
  { id: "mistral", name: "Mistral API", category: "LLM", cost: "$0.001 – $0.02 / call" },
  { id: "replicate", name: "Replicate", category: "Compute", cost: "$0.01 – $0.50 / run" },
  { id: "huggingface", name: "Hugging Face", category: "Compute", cost: "$0.005 – $0.30 / run" },
  { id: "together", name: "Together AI", category: "Compute", cost: "$0.002 – $0.10 / run" },
  { id: "coingecko", name: "CoinGecko", category: "Data", cost: "$0.001 / request" },
  { id: "chainlink", name: "Chainlink Data Feeds", category: "Data", cost: "$0.01 / request" },
  { id: "serpapi", name: "SerpAPI", category: "Data", cost: "$0.01 / search" },
  { id: "alchemy", name: "Alchemy", category: "RPC", cost: "$0.0001 / compute unit" },
  { id: "infura", name: "Infura", category: "RPC", cost: "$0.0002 / request" },
  { id: "quicknode", name: "QuickNode", category: "RPC", cost: "$0.0002 / request" },
];

export const VENDOR_CATALOG: Vendor[] = RAW.map((v) => ({ ...v, address: demoAddr(v.id) }));

// Custom vendor labels, kept in this browser.
const LABEL_KEY = "agentvault:vendor-labels";
export function readVendorLabels(): Record<string, { label: string; category?: string | undefined }> {
  try { return JSON.parse(localStorage.getItem(LABEL_KEY) || "{}"); } catch { return {}; }
}
export function saveVendorLabel(addr: string, label: string, category?: string) {
  const m = readVendorLabels();
  m[addr.toLowerCase()] = { label, category };
  localStorage.setItem(LABEL_KEY, JSON.stringify(m));
}
export function vendorName(addr: string): string | undefined {
  const c = VENDOR_CATALOG.find((v) => v.address.toLowerCase() === addr.toLowerCase());
  if (c) return c.name;
  if (typeof localStorage === "undefined") return undefined;
  return readVendorLabels()[addr.toLowerCase()]?.label;
}
