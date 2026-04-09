// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  LogOut,
  Settings2,
  Wallet,
  X,
} from "lucide-react";

import { useNetworkContext } from "@/components/network-context";
import { cn } from "@/lib/cn";
import { type NetworkMode, type RpcProfile, validateCustomRpcUrl } from "@/lib/network-config";

function middleTruncate(value: string, start = 6, end = 4): string {
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatNetworkLabel(network: NetworkMode): string {
  return network === "mainnet-beta" ? "Mainnet" : "Devnet";
}

function formatRpcProfileLabel(profile: RpcProfile): string {
  switch (profile) {
    case "helius":
      return "Helius";
    case "custom":
      return "Custom";
    default:
      return "Public";
  }
}

function walletReadyLabel(readyState: WalletReadyState, isCurrent: boolean): string {
  if (isCurrent) return "Selected";
  if (readyState === WalletReadyState.Installed) return "Installed";
  if (readyState === WalletReadyState.Loadable) return "Web only";
  return "Unavailable";
}

function isWalletSelectable(readyState: WalletReadyState): boolean {
  return readyState === WalletReadyState.Installed;
}

function walletUnavailableCaption(readyState: WalletReadyState): string {
  if (readyState === WalletReadyState.Loadable) {
    return "Use the extension or in-wallet browser to connect here";
  }

  return "Install or enable this wallet to use it here";
}

function endpointSummary(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.host || value;
  } catch {
    return value;
  }
}

function connectionMetaLabel(network: NetworkMode, rpcProfile: RpcProfile): string {
  return `${formatNetworkLabel(network).toUpperCase()} // ${formatRpcProfileLabel(rpcProfile).toUpperCase()}`;
}

type WalletButtonProps = {
  className?: string;
  mobile?: boolean;
};

type PanelView = "wallets" | "settings";
type StatusTone = "error" | "success";

export function WalletProviders({ children }: { children: React.ReactNode }) {
  const { resolvedEndpoint } = useNetworkContext();
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={resolvedEndpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function WalletButton({ className, mobile = false }: WalletButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeView, setActiveView] = useState<PanelView>("wallets");
  const [pendingWalletName, setPendingWalletName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [walletStatusTone, setWalletStatusTone] = useState<StatusTone>("success");
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [settingsStatusTone, setSettingsStatusTone] = useState<StatusTone>("success");
  const [draftCustomRpcUrl, setDraftCustomRpcUrl] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const {
    selectedNetwork,
    setSelectedNetwork,
    selectedRpcProfile,
    resolvedRpcProfile,
    setSelectedRpcProfile,
    canSelectRpcProfile,
    rpcProfileOptions,
    resolvedEndpoint,
    customRpcUrl,
    applyCustomRpcUrl,
    resetConnectionSettings,
  } = useNetworkContext();
  const {
    wallets,
    wallet,
    publicKey,
    connected,
    connecting,
    connect,
    disconnect,
    disconnecting,
    select,
  } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!panelOpen || mobile) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobile, panelOpen]);

  useEffect(() => {
    if (!panelOpen) {
      setActiveView("wallets");
      setWalletStatus(null);
      setSettingsStatus(null);
    }
  }, [panelOpen]);

  useEffect(() => {
    if (!pendingWalletName) return;
    if (wallet?.adapter.name !== pendingWalletName) return;

    let cancelled = false;

    async function beginConnect() {
      try {
        await connect();
        if (cancelled) return;
        setWalletStatus(null);
        setPanelOpen(false);
      } catch (error) {
        if (cancelled) return;
        setWalletStatus(error instanceof Error ? error.message : "Failed to connect wallet.");
        setWalletStatusTone("error");
      } finally {
        if (!cancelled) {
          setPendingWalletName(null);
        }
      }
    }

    void beginConnect();

    return () => {
      cancelled = true;
    };
  }, [connect, pendingWalletName, wallet?.adapter.name]);

  useEffect(() => {
    if (!panelOpen) return;
    setDraftCustomRpcUrl(customRpcUrl);
    setSettingsStatus(null);
  }, [customRpcUrl, panelOpen, selectedNetwork]);

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
  const buttonMeta = connected
    ? walletName
    : connectionMetaLabel(selectedNetwork, resolvedRpcProfile);
  const installedWallets = useMemo(
    () => sortWallets(wallets.filter((candidate) => candidate.readyState === WalletReadyState.Installed), wallet?.adapter.name),
    [wallet?.adapter.name, wallets],
  );
  const otherWallets = useMemo(
    () => sortWallets(wallets.filter((candidate) => candidate.readyState !== WalletReadyState.Installed), wallet?.adapter.name),
    [wallet?.adapter.name, wallets],
  );
  const buttonDisabled = disconnecting || Boolean(pendingWalletName);

  async function handleCopyAddress() {
    if (!connectedAddress) return;

    try {
      await navigator.clipboard.writeText(connectedAddress);
      setCopied(true);
      setWalletStatus("Address copied.");
      setWalletStatusTone("success");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setWalletStatus("Clipboard access is unavailable in this browser.");
      setWalletStatusTone("error");
    }
  }

  function handlePrimaryClick() {
    if (!mounted) return;
    setPanelOpen((current) => !current);
  }

  function handleWalletChoice(nextWalletName: WalletName<string>) {
    const nextWallet = wallets.find((candidate) => candidate.adapter.name === nextWalletName);
    if (!nextWallet || !isWalletSelectable(nextWallet.readyState)) return;
    if (connecting || disconnecting || pendingWalletName) return;
    if (wallet?.adapter.name === nextWallet.adapter.name && connected) return;

    setWalletStatus(null);
    setWalletStatusTone("success");
    setPendingWalletName(nextWallet.adapter.name);

    if (wallet?.adapter.name !== nextWallet.adapter.name) {
      select(nextWallet.adapter.name);
      return;
    }
  }

  function handleRpcProfileSelect(profile: RpcProfile) {
    if (!canSelectRpcProfile(profile)) return;
    setSelectedRpcProfile(profile);
    setSettingsStatus(`${formatRpcProfileLabel(profile)} RPC is active for ${formatNetworkLabel(selectedNetwork)}.`);
    setSettingsStatusTone("success");
  }

  function handleApplyCustomRpc(url = draftCustomRpcUrl) {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
      resetConnectionSettings();
      setDraftCustomRpcUrl("");
      setSettingsStatus(`Custom RPC cleared; endpoint reset to ${formatRpcProfileLabel("public")} for ${formatNetworkLabel(selectedNetwork)}.`);
      setSettingsStatusTone("success");
      return;
    }

    const validationError = validateCustomRpcUrl(normalizedUrl);
    if (validationError) {
      setSettingsStatus(validationError);
      setSettingsStatusTone("error");
      return;
    }

    const result = applyCustomRpcUrl(normalizedUrl);
    if (!result.ok) {
      setSettingsStatus(result.error);
      setSettingsStatusTone("error");
      return;
    }

    setSettingsStatus(`Custom RPC saved for ${formatNetworkLabel(selectedNetwork)}.`);
    setSettingsStatusTone("success");
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      setPanelOpen(false);
      setWalletStatus(null);
    } catch (error) {
      setWalletStatus(error instanceof Error ? error.message : "Failed to disconnect wallet.");
      setWalletStatusTone("error");
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "wallet-connect-shell",
        mobile && "wallet-connect-shell-mobile",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "wallet-control-button",
          connected && "wallet-control-button-connected",
          mobile && "wallet-control-button-mobile",
        )}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        aria-label={connected ? `${walletName} wallet controls` : "Connect wallet"}
        onClick={handlePrimaryClick}
        disabled={buttonDisabled}
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
          <span className="wallet-control-subtitle">{buttonMeta}</span>
        </span>
        {connecting || pendingWalletName ? (
          <LoaderCircle className="wallet-control-spinner animate-spin" strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <ChevronDown
            className={cn("wallet-control-chevron", panelOpen && "rotate-180")}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        )}
      </button>

      {panelOpen ? (
        <div
          className={cn(
            "wallet-surface-panel",
            mobile && "wallet-surface-panel-mobile",
          )}
          role="dialog"
          aria-label="Wallet and connection settings"
        >
          <div className="wallet-surface-shell">
            <div className="wallet-surface-head">
              <div className="wallet-surface-head-copy">
                <h3
                  className="wallet-surface-title"
                >
                  {activeView === "settings"
                    ? "RPC + cluster"
                    : connected
                      ? (
                          <>
                            Wallet <span className="wallet-surface-title-connected">connected</span>
                          </>
                        )
                      : (
                          <>
                            Connect on <span className="wallet-surface-title-accent">Solana</span>
                          </>
                        )}
                </h3>
              </div>

              <div className="wallet-surface-head-actions">
                {activeView === "settings" ? (
                  <button
                    type="button"
                    className="wallet-surface-icon-button"
                    onClick={() => {
                      setActiveView("wallets");
                      setSettingsStatus(null);
                    }}
                    aria-label="Back to wallet selection"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="wallet-surface-icon-button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close wallet controls"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {activeView === "settings" ? (
              <div className="wallet-surface-body">
                <div className="wallet-surface-readout">
                  <span className="wallet-surface-readout-label">Active endpoint</span>
                  <span className="wallet-surface-readout-value">{resolvedEndpoint}</span>
                </div>

                <div className="wallet-surface-section">
                  <div className="wallet-surface-section-head">
                    <span className="wallet-surface-section-title">Cluster</span>
                  </div>
                  <div className="wallet-segment-row" role="group" aria-label="Cluster selection">
                    {(["devnet", "mainnet-beta"] as const).map((network) => (
                      <button
                        key={network}
                        type="button"
                        className={cn(
                          "wallet-segment-button",
                          selectedNetwork === network && "wallet-segment-button-active",
                        )}
                        onClick={() => setSelectedNetwork(network)}
                      >
                        {formatNetworkLabel(network)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wallet-surface-section">
                  <div className="wallet-surface-section-head">
                    <span className="wallet-surface-section-title">Provider</span>
                    <span className="wallet-surface-section-meta">Choose one RPC profile for this cluster</span>
                  </div>
                  <div className="wallet-rpc-select-wrap">
                    <select
                      className="wallet-rpc-select"
                      value={selectedRpcProfile}
                      onChange={(event) => handleRpcProfileSelect(event.currentTarget.value as RpcProfile)}
                    >
                      {rpcProfileOptions.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={!option.isAvailable}
                        >
                          {option.label} - {option.endpoint ? endpointSummary(option.endpoint) : option.reason}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="wallet-surface-section">
                  <div className="wallet-surface-section-head">
                    <span className="wallet-surface-section-title">Custom RPC</span>
                    <span className="wallet-surface-section-meta">Stored locally in this browser</span>
                  </div>
                  <div className="wallet-custom-rpc-form">
                    <input
                      className="wallet-custom-rpc-input"
                      type="url"
                      inputMode="url"
                      placeholder="https://your-rpc.example.com"
                      value={draftCustomRpcUrl}
                      onChange={(event) => setDraftCustomRpcUrl(event.target.value)}
                      onBlur={() => void handleApplyCustomRpc(draftCustomRpcUrl)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleApplyCustomRpc(draftCustomRpcUrl);
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </div>
                </div>

                {settingsStatus ? (
                  <p className={settingsStatusTone === "error" ? "wallet-surface-feedback wallet-surface-feedback-error" : "wallet-surface-feedback"}>
                    {settingsStatus}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="wallet-surface-body">
                <div className="wallet-surface-summary">
                  <div className="wallet-surface-summary-copy">
                    <span className="wallet-surface-summary-label">{connectionMetaLabel(selectedNetwork, resolvedRpcProfile)}</span>
                    <span className="wallet-surface-summary-title">
                      {connected ? middleTruncate(connectedAddress, 8, 6) : "Choose a wallet to continue"}
                    </span>
                    <span className="wallet-surface-summary-meta">{endpointSummary(resolvedEndpoint)}</span>
                  </div>
                  {walletIcon ? <img src={walletIcon} alt="" className="wallet-surface-summary-icon" /> : <Wallet className="wallet-surface-summary-fallback" strokeWidth={1.8} />}
                </div>

                {connected ? (
                  <div className="wallet-surface-inline-actions">
                    <button type="button" className="wallet-surface-chip" onClick={() => setActiveView("settings")}>
                      <Settings2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      <span>Connection settings</span>
                    </button>
                    <button type="button" className="wallet-surface-chip" onClick={() => void handleCopyAddress()}>
                      {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.8} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />}
                      <span className="sr-only">{copied ? "Copied address" : "Copy address"}</span>
                    </button>
                    <button type="button" className="wallet-surface-chip wallet-surface-chip-danger" onClick={() => void handleDisconnect()}>
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
                      <span className="sr-only">Disconnect</span>
                    </button>
                  </div>
                ) : (
                  <div className="wallet-surface-inline-actions wallet-surface-inline-actions--disconnected">
                    <button type="button" className="wallet-surface-chip" onClick={() => setActiveView("settings")}>
                      <Settings2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      <span>Connection settings</span>
                    </button>
                  </div>
                )}

                <div className="wallet-surface-section">
                  <div className="wallet-surface-section-head">
                    <span className="wallet-surface-section-title">{connected ? "Switch wallet" : "Installed wallets"}</span>
                  </div>
                  <div className="wallet-wallet-list">
                    {installedWallets.length ? installedWallets.map((candidate) => {
                      const isCurrent = wallet?.adapter.name === candidate.adapter.name;
                      const isBusy = pendingWalletName === candidate.adapter.name;

                      return (
                        <button
                          key={candidate.adapter.name}
                          type="button"
                          className={cn(
                            "wallet-wallet-row",
                            isCurrent && "wallet-wallet-row-active",
                          )}
                          onClick={() => handleWalletChoice(candidate.adapter.name)}
                          disabled={connecting || disconnecting || Boolean(pendingWalletName)}
                        >
                          <span className="wallet-wallet-copy">
                            <span className="wallet-wallet-leading">
                              {candidate.adapter.icon ? <img src={candidate.adapter.icon} alt="" className="wallet-wallet-icon" /> : <Wallet className="wallet-wallet-fallback" strokeWidth={1.8} />}
                              <span className="wallet-wallet-name">{candidate.adapter.name}</span>
                            </span>
                            <span className="wallet-wallet-caption">
                              {isCurrent && connected ? "Connected wallet" : "Ready in this browser"}
                            </span>
                          </span>
                          <span className="wallet-wallet-state">
                            {isBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} /> : null}
                            <span>{walletReadyLabel(candidate.readyState, isCurrent)}</span>
                          </span>
                        </button>
                      );
                    }) : (
                      <p className="wallet-surface-empty">No installed wallets detected in this browser.</p>
                    )}
                  </div>
                </div>

                {otherWallets.length ? (
                  <div className="wallet-surface-section">
                    <div className="wallet-surface-section-head">
                      <span className="wallet-surface-section-title">Other providers</span>
                      <span className="wallet-surface-section-meta">Visible, but not available here</span>
                    </div>
                    <div className="wallet-wallet-list">
                      {otherWallets.map((candidate) => {
                        const isCurrent = wallet?.adapter.name === candidate.adapter.name;

                        return (
                          <button
                            key={candidate.adapter.name}
                            type="button"
                            className={cn(
                              "wallet-wallet-row",
                              "wallet-wallet-row-disabled",
                              isCurrent && "wallet-wallet-row-active",
                            )}
                            disabled
                          >
                            <span className="wallet-wallet-copy">
                              <span className="wallet-wallet-leading">
                                {candidate.adapter.icon ? <img src={candidate.adapter.icon} alt="" className="wallet-wallet-icon" /> : <Wallet className="wallet-wallet-fallback" strokeWidth={1.8} />}
                                <span className="wallet-wallet-name">{candidate.adapter.name}</span>
                              </span>
                              <span className="wallet-wallet-caption">
                                {walletUnavailableCaption(candidate.readyState)}
                              </span>
                            </span>
                            <span className="wallet-wallet-state">
                              <span>{walletReadyLabel(candidate.readyState, isCurrent)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {walletStatus ? (
                  <p className={walletStatusTone === "error" ? "wallet-surface-feedback wallet-surface-feedback-error" : "wallet-surface-feedback"}>
                    {walletStatus}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function sortWallets<T extends { adapter: { name: string } }>(wallets: T[], currentWalletName?: string | null): T[] {
  return [...wallets].sort((left, right) => {
    const leftCurrent = left.adapter.name === currentWalletName;
    const rightCurrent = right.adapter.name === currentWalletName;
    if (leftCurrent && !rightCurrent) return -1;
    if (!leftCurrent && rightCurrent) return 1;
    return left.adapter.name.localeCompare(right.adapter.name);
  });
}
