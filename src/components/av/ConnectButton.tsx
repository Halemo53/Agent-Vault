import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Wallet } from "lucide-react";
import { short } from "@/lib/web3";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (isConnected && chainId !== baseSepolia.id) {
    return (
      <button className="btn-av btn-danger h-10 text-sm" onClick={() => switchChain({ chainId: baseSepolia.id })}>
        Switch to Base Sepolia
      </button>
    );
  }
  if (isConnected) {
    return (
      <button className="btn-av btn-outline h-10 rounded-full font-mono text-xs hover:border-primary hover:text-primary" onClick={() => disconnect()} title="Disconnect" aria-label="Disconnect wallet">
        <span className="animate-dot h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        {short(address)}
      </button>
    );
  }
  return (
    <button
      className="btn-av btn-outline h-10 rounded-full text-sm hover:border-primary hover:text-primary"
      aria-label="Connect wallet"
      disabled={isPending}
      onClick={() => {
        const c = connectors[0];
        if (!c) return alert("No EVM wallet found. Install MetaMask, Rabby or Coinbase Wallet.");
        connect({ connector: c, chainId: baseSepolia.id });
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
      <Wallet size={16} strokeWidth={1.5} aria-hidden />
      {isPending ? "Connecting" : "Connect Wallet"}
    </button>
  );
}
