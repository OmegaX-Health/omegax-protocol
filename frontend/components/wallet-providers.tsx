// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Check, ChevronDown, Copy, LogOut, Wallet } from "lucide-react";

import { useNetworkContext } from "@/components/network-context";
import { cn } from "@/lib/cn";

import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

function middleTruncate(value: string, start = 6, end = 4): string {
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const { selectedNetwork } = useNetworkContext();
  const sharedEndpoint = (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "").trim();
  const devnetEndpoint =
    (process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL || "").trim()
    || sharedEndpoint
    || DEFAULT_DEVNET_RPC_URL;
  const mainnetEndpoint =
    (process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL || "").trim()
    || sharedEndpoint
    || DEFAULT_MAINNET_RPC_URL;
  const endpoint = selectedNetwork === "mainnet-beta" ? mainnetEndpoint : devnetEndpoint;
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setVisible } = useWalletModal();
  const { wallet, publicKey, connected, connecting, connect, disconnect, disconnecting } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const walletName = wallet?.adapter.name ?? "Wallet";
  const walletIcon = wallet?.adapter.icon;
  const connectedAddress = publicKey?.toBase58() ?? "";
  const connectedLabel = connectedAddress ? middleTruncate(connectedAddress, 4, 4) : walletName;
  const buttonLabel = !mounted
    ? "Connect wallet"
    : connecting
      ? "Connecting..."
      : connected
        ? connectedLabel
        : "Connect wallet";

  async function handlePrimaryClick() {
    if (!mounted) return;

    if (connected) {
      setMenuOpen((current) => !current);
      return;
    }

    if (!wallet) {
      setVisible(true);
      return;
    }

    try {
      await connect();
    } catch {
      setVisible(true);
    }
  }

  async function handleCopyAddress() {
    if (!connectedAddress) return;
    await navigator.clipboard.writeText(connectedAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div ref={menuRef} className={cn("wallet-connect-shell", className)}>
      <button
        type="button"
        className={cn(
          "wallet-control-button",
          connected && "wallet-control-button-connected",
        )}
        aria-haspopup={connected ? "menu" : undefined}
        aria-expanded={connected ? menuOpen : undefined}
        aria-label={connected ? `${walletName} connected wallet menu` : "Connect wallet"}
        onClick={() => {
          void handlePrimaryClick();
        }}
        disabled={disconnecting}
      >
        <span className="wallet-control-leading" aria-hidden="true">
          {walletIcon ? (
            <img src={walletIcon} alt="" className="wallet-control-icon" />
          ) : (
            <Wallet className="wallet-control-fallback-icon" strokeWidth={1.9} />
          )}
          {connected ? <span className="wallet-control-status-dot" /> : null}
        </span>
        <span className="wallet-control-copy">
          <span className="wallet-control-title">{buttonLabel}</span>
          {connectedAddress ? (
            <span className="wallet-control-subtitle">{walletName}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("wallet-control-chevron", connected && menuOpen && "rotate-180")}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {connected && menuOpen ? (
        <div className="wallet-control-menu" role="menu" aria-label="Wallet menu">
          <div className="wallet-control-menu-head">
            <span className="wallet-control-menu-label">{walletName}</span>
            <span className="wallet-control-menu-address">{connectedAddress}</span>
          </div>

          <button type="button" className="wallet-control-menu-item" role="menuitem" onClick={() => void handleCopyAddress()}>
            {copied ? <Check className="wallet-control-menu-icon" strokeWidth={1.9} /> : <Copy className="wallet-control-menu-icon" strokeWidth={1.9} />}
            <span>{copied ? "Address copied" : "Copy address"}</span>
          </button>

          <button
            type="button"
            className="wallet-control-menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setVisible(true);
            }}
          >
            <Wallet className="wallet-control-menu-icon" strokeWidth={1.9} />
            <span>Switch wallet</span>
          </button>

          <button
            type="button"
            className="wallet-control-menu-item wallet-control-menu-item-danger"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              void disconnect();
            }}
          >
            <LogOut className="wallet-control-menu-icon" strokeWidth={1.9} />
            <span>Disconnect</span>
          </button>
        </div>
      ) : null}

      {!mounted ? (
        <button
          className="wallet-adapter-button wallet-adapter-button-trigger sr-only"
          disabled
        >
          Connect wallet
        </button>
      ) : null}
    </div>
  );
}
