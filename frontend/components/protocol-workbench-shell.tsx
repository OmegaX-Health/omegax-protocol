// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  Activity,
  Droplets,
  Landmark,
  LayoutDashboard,
  Menu,
  MoonStar,
  ShieldCheck,
  SunMedium,
  Wallet,
  X,
} from "lucide-react";

import { useNetworkContext } from "@/components/network-context";
import { useTheme } from "@/components/theme-provider";
import { WalletButton } from "@/components/wallet-providers";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { cn } from "@/lib/cn";
import { computeWorkbenchMetrics, sectionChrome, sectionFromPathname, WORKBENCH_NAV, WORKBENCH_VERSION_STAMP } from "@/lib/workbench";

const MOBILE_SIDEBAR_MEDIA_QUERY = "(max-width: 899px)";
const WORKBENCH_SIDEBAR_ID = "protocol-workbench-sidebar";

type InertHTMLElement = HTMLElement & {
  inert: boolean;
};

function iconForNav(icon: (typeof WORKBENCH_NAV)[number]["icon"]) {
  switch (icon) {
    case "plans":
      return Activity;
    case "capital":
      return Droplets;
    case "governance":
      return Landmark;
    case "oracles":
      return ShieldCheck;
    case "overview":
    default:
      return LayoutDashboard;
  }
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

function buildFooterLinks(sourceRepoUrl: string) {
  return [
    { href: "https://docs.omegax.health/docs/thesis/why-omegax", label: "Whitepaper", external: true },
    { href: "https://docs.omegax.health/docs", label: "Docs", external: true },
    { href: sourceRepoUrl, label: "Source", external: true },
    { href: `${sourceRepoUrl.replace(/\/$/, "")}/blob/main/docs/testing/protocol-surface-audit.md`, label: "Security Audits", external: true },
    { href: "/overview", label: "Network Health", external: false },
  ];
}

export default function ProtocolWorkbenchShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connection } = useConnection();
  const { mounted, theme, toggleTheme } = useTheme();
  const { selectedNetwork, setSelectedNetwork, canSelectNetwork } = useNetworkContext();
  const { effectivePersona, previewPersona, setPreviewPersona, canPreviewPersona } = useWorkspacePersona();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [epoch, setEpoch] = useState("--");
  const [slot, setSlot] = useState("--");
  const [isLive, setIsLive] = useState(false);

  const section = sectionFromPathname(pathname);
  const chrome = sectionChrome(section);
  const sourceRepoUrl = process.env.NEXT_PUBLIC_SOURCE_REPO_URL || "https://github.com/OmegaX-Health/omegax-protocol";
  const footerLinks = useMemo(() => buildFooterLinks(sourceRepoUrl), [sourceRepoUrl]);
  const metrics = computeWorkbenchMetrics();
  const rpcStatus = isLive ? "RPC reachable" : "RPC unavailable";
  const ThemeIcon = mounted && theme === "dark" ? SunMedium : MoonStar;
  const isMobileDrawerHidden = isMobileViewport && !isSidebarOpen;

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_SIDEBAR_MEDIA_QUERY);

    const syncMobileViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
      if (!matches) {
        setIsSidebarOpen(false);
      }
    };

    syncMobileViewport(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncMobileViewport(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current as InertHTMLElement | null;
    if (!sidebar) return;

    sidebar.inert = isMobileDrawerHidden;
    return () => {
      sidebar.inert = false;
    };
  }, [isMobileDrawerHidden]);

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
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection, selectedNetwork]);

  return (
    <div className="protocol-workbench-shell relative">
      <div className="absolute inset-0 misty-cyan-glow pointer-events-none z-0" />
      <aside
        ref={sidebarRef}
        id={WORKBENCH_SIDEBAR_ID}
        aria-hidden={isMobileDrawerHidden}
        data-mobile-hidden={isMobileDrawerHidden ? "true" : "false"}
        className={cn("protocol-sidebar liquid-glass z-10", isSidebarOpen && "protocol-sidebar-open")}
      >
        <div className="protocol-sidebar-brand">
          <Link href="/overview" className="protocol-sidebar-wordmark" aria-label="OmegaX workbench home">
            OmegaX
          </Link>
        </div>

        <nav className="protocol-sidebar-nav" aria-label="Primary navigation">
          {WORKBENCH_NAV.map((item) => {
            const Icon = iconForNav(item.icon);
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badge = personaBadgeForNav(item.id, effectivePersona);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("protocol-sidebar-link", active && "protocol-sidebar-link-active")}
              >
                <span className="protocol-sidebar-link-main">
                  <Icon className="protocol-sidebar-link-icon" strokeWidth={1.9} aria-hidden="true" />
                  <span className="protocol-sidebar-link-label">{item.label}</span>
                </span>
                {badge ? <span className="protocol-sidebar-link-badge">{badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="protocol-sidebar-metrics">
          <div className="protocol-sidebar-metric">
            <span className="protocol-sidebar-metric-label">RPC_STATUS</span>
            <div className="protocol-sidebar-health">
              <span className={cn("protocol-health-dot", isLive && "protocol-health-dot-live")} aria-hidden="true" />
              <strong>{rpcStatus}</strong>
            </div>
          </div>
          <div className="protocol-sidebar-metric">
            <span className="protocol-sidebar-metric-label">ACTIVE_CLAIMS</span>
            <strong className="protocol-sidebar-metric-value">{metrics.activeClaims}</strong>
          </div>
        </div>

        <div className="protocol-sidebar-wallet">
          <WalletButton className="protocol-sidebar-wallet-button" />
        </div>
      </aside>

      {isMobileViewport && isSidebarOpen ? (
        <button
          type="button"
          className="protocol-sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <div className="protocol-workbench-frame">
        <header className="protocol-workbench-header">
          <div className="protocol-workbench-header-main liquid-glass">
            <div className="protocol-workbench-header-title">
              <button
                type="button"
                className="protocol-mobile-menu-button"
                aria-controls={WORKBENCH_SIDEBAR_ID}
                aria-expanded={isSidebarOpen}
                onClick={() => setIsSidebarOpen((current) => !current)}
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {isSidebarOpen ? <X className="h-4 w-4" strokeWidth={1.9} /> : <Menu className="h-4 w-4" strokeWidth={1.9} />}
              </button>
              <div>
                <p className="protocol-header-eyebrow">{chrome.eyebrow}</p>
                <h1 className="protocol-header-title">{chrome.title}</h1>
                <p className="protocol-header-stamp">{WORKBENCH_VERSION_STAMP}</p>
              </div>
            </div>

            <div className="protocol-workbench-controls">
              <div className="protocol-header-stat-group">
                <div className="protocol-header-stat">
                  <span>Epoch</span>
                  <strong>{epoch}</strong>
                </div>
                <div className="protocol-header-stat">
                  <span>Block</span>
                  <strong>{slot}</strong>
                </div>
              </div>

              <div className="protocol-header-pill-cluster">
                <span className="protocol-header-pill">{selectedNetwork === "mainnet-beta" ? "MAINNET" : "DEVNET"}</span>
                <span className="protocol-header-pill">{isLive ? "Live updates" : "Reconnecting"}</span>
              </div>

              <label className="protocol-header-select">
                <span className="sr-only">Network</span>
                <select
                  value={selectedNetwork}
                  onChange={(event) => {
                    const nextValue = event.target.value as "devnet" | "mainnet-beta";
                    if (canSelectNetwork(nextValue)) {
                      setSelectedNetwork(nextValue);
                    }
                  }}
                >
                  <option value="devnet">Devnet</option>
                  <option value="mainnet-beta" disabled={!canSelectNetwork("mainnet-beta")}>Mainnet</option>
                </select>
              </label>

              {canPreviewPersona ? (
                <label className="protocol-header-select">
                  <span className="sr-only">Role preview</span>
                  <select
                    value={previewPersona}
                    onChange={(event) => setPreviewPersona(event.target.value as "auto" | "sponsor" | "capital" | "governance")}
                  >
                    <option value="auto">Auto persona</option>
                    <option value="sponsor">Sponsor / operator</option>
                    <option value="capital">Capital provider</option>
                    <option value="governance">Governance / operator</option>
                  </select>
                </label>
              ) : null}

              <button
                type="button"
                className="protocol-icon-button"
                onClick={toggleTheme}
                aria-label={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                <ThemeIcon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              </button>

              <div className="protocol-wallet-pill">
                <Wallet className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                <span>{sectionLabelForPersona(effectivePersona)}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="protocol-workbench-content micro-etch">{children}</main>

        <footer className="protocol-workbench-footer">
          <div className="protocol-workbench-footer-copy">
            © 2026 OmegaX Health Capital Markets. // Protocol Node: 77.01-B
          </div>
          <div className="protocol-workbench-footer-links">
            {footerLinks.map((link) => (
              link.external ? (
                <Link key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </Link>
              ) : (
                <Link key={link.label} href={link.href}>
                  {link.label}
                </Link>
              )
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
