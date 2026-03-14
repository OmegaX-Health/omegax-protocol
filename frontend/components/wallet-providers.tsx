// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { BaseWalletMultiButton, WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

import { cn } from "@/lib/cn";

import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

const WALLET_BUTTON_LABELS = {
  "change-wallet": "Switch wallet",
  connecting: "Connecting...",
  "copy-address": "Copy address",
  copied: "Address copied",
  disconnect: "Disconnect",
  "has-wallet": "Connect wallet",
  "no-wallet": "Connect wallet",
};

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const cluster = (process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER || "devnet").trim().toLowerCase();
  const sharedEndpoint = (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "").trim();
  const devnetEndpoint =
    (process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || "").trim()
    || sharedEndpoint
    || DEFAULT_DEVNET_RPC_URL;
  const mainnetEndpoint =
    (process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL || "").trim()
    || sharedEndpoint
    || DEFAULT_MAINNET_RPC_URL;
  const endpoint = cluster.includes("mainnet") ? mainnetEndpoint : devnetEndpoint;
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  // TODO(network-switch): Inject network-specific RPC + program ID mapping when multi-network context is wired.
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider className="omegax-wallet-modal">{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function WalletButton({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("wallet-connect-shell", className)}>
      {mounted ? (
        <BaseWalletMultiButton labels={WALLET_BUTTON_LABELS} />
      ) : (
        <button
          className="wallet-adapter-button wallet-adapter-button-trigger"
          disabled
        >
          {WALLET_BUTTON_LABELS["no-wallet"]}
        </button>
      )}
    </div>
  );
}
