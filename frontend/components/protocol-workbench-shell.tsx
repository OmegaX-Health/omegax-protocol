// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import { ChevronDown, Menu, MoonStar, SunMedium, Users, X } from "lucide-react";

import { useNetworkContext } from "@/components/network-context";
import { useTheme } from "@/components/theme-provider";
import { WalletButton } from "@/components/wallet-providers";
import { useWorkspacePersona } from "@/components/workspace-persona";
import frontendPackage from "@/package.json";
import { NETWORK_OPTIONS, normalizeExplorerCluster } from "@/lib/network-config";
import { cn } from "@/lib/cn";
import { computeWorkbenchMetrics, WORKBENCH_NAV } from "@/lib/workbench";

const MOBILE_NAV_ID = "protocol-mobile-nav";
const SOURCE_REPO_URL = process.env.NEXT_PUBLIC_SOURCE_REPO_URL ?? "https://github.com/OmegaX-Health/omegax-protocol";
const SDK_PACKAGE_URL = "https://www.npmjs.com/package/@omegax/protocol-sdk";
const DOCS_URL = "https://docs.omegax.health";
const SECURITY_AUDITS_URL = "https://omegax.health/protocol/audit";

function buildFooterMetadata(): { version: string; networkLabel: string } {
  const configuredCluster = normalizeExplorerCluster(process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER);
  const networkLabel = NETWORK_OPTIONS.find((option) => option.id === configuredCluster)?.label ?? "Devnet";
  const protocolVersion = (process.env.NEXT_PUBLIC_PROTOCOL_BUILD_VERSION || "").trim() || frontendPackage.version;
  return { version: `v${protocolVersion}`, networkLabel };
}

function personaBadgeForNav(sectionId: (typeof WORKBENCH_NAV)[number]["id"], persona: string) {
  const metrics = computeWorkbenchMetrics();

  if (persona === "sponsor" && sectionId === "plans") return String(metrics.activeClaims);
  if (persona === "capital" && sectionId === "capital") return String(metrics.pendingRedemptions);
  if (persona === "governance" && sectionId === "governance") return "4";
  if (persona === "governance" && sectionId === "oracles") return String(metrics.reservedObligations);
  return null;
}

function sectionLabelForPersona(persona: string) {
  switch (persona) {
    case "sponsor":
      return "Sponsor / operator";
    case "capital":
      return "Capital provider";
    case "governance":
      return "Governance / operator";
    default:
      return "Observer";
  }
}

export default function ProtocolWorkbenchShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connection } = useConnection();
  const { mounted, theme, toggleTheme } = useTheme();
  const { selectedNetwork, setSelectedNetwork, canSelectNetwork } = useNetworkContext();
  const { effectivePersona, previewPersona, setPreviewPersona, canPreviewPersona } = useWorkspacePersona();
  const isOverviewRoute = pathname === "/overview" || pathname.startsWith("/overview/");
  const useFullscreenWorkbenchChrome = [
    "/overview",
    "/plans",
    "/capital",
    "/governance",
    "/oracles",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const networkMenuRef = useRef<HTMLDivElement | null>(null);
  const personaMenuRef = useRef<HTMLDivElement | null>(null);

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNetworkMenuOpen, setIsNetworkMenuOpen] = useState(false);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const [epoch, setEpoch] = useState("--");
  const [slot, setSlot] = useState("--");
  const [isLive, setIsLive] = useState(false);

  const isDarkTheme = mounted && theme === "dark";
  const ThemeIcon = isDarkTheme ? SunMedium : MoonStar;
  const nextThemeLabel = isDarkTheme ? "light" : "dark";
  const footerMetadata = buildFooterMetadata();

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsNetworkMenuOpen(false);
    setIsPersonaMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isNetworkMenuOpen && !isPersonaMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (isNetworkMenuOpen && networkMenuRef.current && !networkMenuRef.current.contains(target)) {
        setIsNetworkMenuOpen(false);
      }
      if (isPersonaMenuOpen && personaMenuRef.current && !personaMenuRef.current.contains(target)) {
        setIsPersonaMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsNetworkMenuOpen(false);
        setIsPersonaMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isNetworkMenuOpen, isPersonaMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function refreshStatus() {
      try {
        const [nextSlot, nextEpochInfo] = await Promise.all([
          connection.getSlot("confirmed"),
          connection.getEpochInfo("confirmed"),
        ]);

        if (cancelled) return;
        setSlot(nextSlot.toLocaleString());
        setEpoch(nextEpochInfo.epoch.toLocaleString());
        setIsLive(true);
      } catch {
        if (cancelled) return;
        setSlot("--");
        setEpoch("--");
        setIsLive(false);
      }
    }

    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection, selectedNetwork]);

  return (
    <div
      className={cn(
        "protocol-workbench-shell relative",
        useFullscreenWorkbenchChrome && "protocol-workbench-shell-fullscreen",
        isOverviewRoute && "protocol-workbench-shell-overview",
      )}
    >
      {isOverviewRoute ? null : <div className="absolute inset-0 misty-cyan-glow pointer-events-none z-0" />}

      <header className="protocol-topbar">
        <div className="protocol-topbar-row">
          <div className="protocol-topbar-left">
            <button
              type="button"
              className="protocol-topbar-menu-button"
              aria-controls={MOBILE_NAV_ID}
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              aria-label={isMobileNavOpen ? "Close navigation" : "Open navigation"}
            >
              {isMobileNavOpen
                ? <X className="h-4 w-4" strokeWidth={1.9} />
                : <Menu className="h-4 w-4" strokeWidth={1.9} />}
            </button>

            <Link href="/overview" className="protocol-topbar-wordmark" aria-label="OmegaX workbench home">
              <Image
                src="/brand/wordmark-horizontal.svg"
                alt="OmegaX"
                width={158}
                height={10}
                className="protocol-topbar-wordmark-image"
                priority
              />
            </Link>

            <nav className="protocol-topbar-nav" aria-label="Primary navigation">
              {WORKBENCH_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = personaBadgeForNav(item.id, effectivePersona);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("protocol-topbar-tab", active && "protocol-topbar-tab-active")}
                  >
                    {item.label}
                    {badge ? <span className="protocol-topbar-badge">{badge}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="protocol-topbar-controls">
            <div ref={networkMenuRef} className="protocol-toolbar-dropdown">
              <button
                type="button"
                className="protocol-toolbar-button"
                aria-haspopup="menu"
                aria-expanded={isNetworkMenuOpen}
                onClick={() => {
                  setIsNetworkMenuOpen((prev) => !prev);
                  setIsPersonaMenuOpen(false);
                }}
                aria-label={`Network: ${selectedNetwork === "mainnet-beta" ? "Mainnet" : "Devnet"}`}
              >
                <span className={cn("protocol-toolbar-network-dot", isLive && "protocol-toolbar-network-dot-live")} aria-hidden="true" />
                <span>{selectedNetwork === "mainnet-beta" ? "Mainnet" : "Devnet"}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", isNetworkMenuOpen && "rotate-180")} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {isNetworkMenuOpen ? (
                <div className="protocol-toolbar-menu" role="menu" aria-label="Network selection">
                  {NETWORK_OPTIONS.map((network) => {
                    const isCurrent = network.id === selectedNetwork;
                    const canSelect = canSelectNetwork(network.id);

                    return (
                      <button
                        key={network.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isCurrent}
                        aria-disabled={!canSelect}
                        disabled={!canSelect}
                        onClick={() => {
                          if (!canSelect) return;
                          setSelectedNetwork(network.id);
                          setIsNetworkMenuOpen(false);
                        }}
                        className={cn(
                          "protocol-toolbar-menu-item",
                          isCurrent && "protocol-toolbar-menu-item-active",
                          !canSelect && "protocol-toolbar-menu-item-disabled",
                        )}
                      >
                        <span>{network.label}</span>
                        {!canSelect ? <span className="protocol-toolbar-menu-badge">Coming soon</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {canPreviewPersona ? (
              <div ref={personaMenuRef} className="protocol-toolbar-dropdown">
                <button
                  type="button"
                  className="protocol-toolbar-icon-button"
                  aria-haspopup="menu"
                  aria-expanded={isPersonaMenuOpen}
                  onClick={() => {
                    setIsPersonaMenuOpen((prev) => !prev);
                    setIsNetworkMenuOpen(false);
                  }}
                  aria-label={`Persona: ${sectionLabelForPersona(effectivePersona)}`}
                  title="Preview persona"
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                </button>
                {isPersonaMenuOpen ? (
                  <div className="protocol-toolbar-menu" role="menu" aria-label="Persona selection">
                    {(["auto", "sponsor", "capital", "governance"] as const).map((persona) => (
                      <button
                        key={persona}
                        type="button"
                        role="menuitemradio"
                        aria-checked={previewPersona === persona}
                        onClick={() => {
                          setPreviewPersona(persona);
                          setIsPersonaMenuOpen(false);
                        }}
                        className={cn(
                          "protocol-toolbar-menu-item",
                          previewPersona === persona && "protocol-toolbar-menu-item-active",
                        )}
                      >
                        {persona === "auto" ? "Auto" : sectionLabelForPersona(persona)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              className="protocol-toolbar-icon-button"
              onClick={toggleTheme}
              aria-label={`Switch to ${nextThemeLabel} mode`}
              title={`Switch to ${nextThemeLabel} mode`}
            >
              <ThemeIcon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
            </button>

            <WalletButton className="protocol-topbar-wallet" />
          </div>
        </div>

        <div className="protocol-topbar-status-row">
          <div className="protocol-topbar-status-pill">
            <div className="protocol-topbar-status-left">
              <span className="protocol-topbar-status-item">
                <span className="protocol-topbar-status-key">Epoch</span>
                <span className="protocol-topbar-status-val">{epoch}</span>
              </span>
              <span className="protocol-topbar-status-item">
                <span className="protocol-topbar-status-key">Block</span>
                <span className="protocol-topbar-status-val">{slot}</span>
              </span>
            </div>
            <div className="protocol-topbar-status-right">
              <span className={cn("protocol-topbar-sync-dot", isLive && "is-live")} aria-hidden="true" />
              <span className={cn("protocol-topbar-sync-label", isLive && "is-live")}>
                {isLive ? "System Synced" : "Retrying"}
              </span>
              {isLive ? (
                <span className="material-symbols-outlined protocol-topbar-sync-icon" aria-hidden="true">sync</span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {isMobileNavOpen ? (
        <nav id={MOBILE_NAV_ID} className="protocol-mobile-nav" aria-label="Mobile navigation">
          {WORKBENCH_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("protocol-mobile-nav-link", active && "protocol-mobile-nav-link-active")}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="protocol-mobile-nav-divider" aria-hidden="true" />
          <div className="protocol-mobile-wallet">
            <WalletButton className="w-full" mobile />
          </div>
        </nav>
      ) : null}

      <main
        className={cn(
          "protocol-workbench-content micro-etch",
          useFullscreenWorkbenchChrome && "protocol-workbench-content-fullscreen",
          isOverviewRoute && "protocol-workbench-content-overview",
        )}
      >
        {children}
      </main>

      <footer
        className={cn(
          "protocol-footer",
          useFullscreenWorkbenchChrome && "protocol-footer-fullscreen",
          isOverviewRoute && "protocol-footer-overview",
        )}
      >
        <div className="protocol-footer-identity">
          <span className="protocol-footer-mark">OmegaX Protocol</span>
          <span className="protocol-footer-legal">
            &copy; 2026 OmegaX Health Capital Markets · All rights reserved
          </span>
        </div>

        <nav className="protocol-footer-links" aria-label="Resources">
          <Link href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer" className="protocol-footer-link">
            Source
          </Link>
          <Link href={SDK_PACKAGE_URL} target="_blank" rel="noopener noreferrer" className="protocol-footer-link">
            SDK
          </Link>
          <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="protocol-footer-link">
            Docs
          </Link>
          <Link href="/network-health" className="protocol-footer-link">
            Status
          </Link>
          <Link href={SECURITY_AUDITS_URL} target="_blank" rel="noopener noreferrer" className="protocol-footer-link">
            Audits
          </Link>
        </nav>

        <div className="protocol-footer-build" aria-label="Build">
          <span className="protocol-footer-build-version">{footerMetadata.version}</span>
          <span className="protocol-footer-build-sep" aria-hidden="true" />
          <span className="protocol-footer-build-network">{footerMetadata.networkLabel}</span>
        </div>
      </footer>
    </div>
  );
}
