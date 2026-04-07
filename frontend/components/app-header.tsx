// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, MoonStar, SunMedium, X } from "lucide-react";

import { ProtocolStatusBar } from "@/components/protocol-status-bar";
import { useTheme } from "@/components/theme-provider";
import { WalletButton } from "@/components/wallet-providers";
import { useNetworkContext } from "@/components/network-context";
import { NETWORK_OPTIONS } from "@/lib/network-config";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  isExternal?: boolean;
};

const navItems: NavItem[] = [
  { href: "/plans", label: "Plans" },
  { href: "/capital", label: "Capital" },
  { href: "/claims", label: "Claims" },
  { href: "/members", label: "Members" },
  { href: "/governance", label: "Governance" },
  { href: "/oracles", label: "Oracles" },
  { href: "/schemas", label: "Schemas" },
  { href: "https://docs.omegax.health", label: "Docs", isExternal: true },
];

function getMaxVisibleTabs(width: number): number {
  if (width >= 1500) return 7;
  if (width >= 1320) return 6;
  return 5;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}

export default function AppHeader() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [maxVisibleTabs, setMaxVisibleTabs] = useState(5);
  const headerRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const networkMenuRef = useRef<HTMLDivElement>(null);
  const { selectedNetwork, setSelectedNetwork, canSelectNetwork } = useNetworkContext();
  const { mounted, theme, toggleTheme } = useTheme();
  const activeNetwork = NETWORK_OPTIONS.find((item) => item.id === selectedNetwork)?.label ?? "Devnet";
  const isDarkTheme = mounted && theme === "dark";
  const themeLabel = mounted ? (isDarkTheme ? "Dark" : "Light") : "System";
  const nextThemeLabel = isDarkTheme ? "light" : "dark";
  const themeActionLabel = isDarkTheme ? "Switch to light" : "Switch to dark";
  const ThemeIcon = isDarkTheme ? SunMedium : MoonStar;
  const primaryNavItems = navItems.slice(0, maxVisibleTabs);
  const overflowNavItems = navItems.slice(maxVisibleTabs);
  const overflowHasActiveTab = overflowNavItems.some((item) => !item.isExternal && isActive(pathname, item.href));

  useEffect(() => {
    setIsMoreOpen(false);
    setIsNetworkOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }

      setMaxVisibleTabs(getMaxVisibleTabs(window.innerWidth));
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isMoreOpen && !isNetworkOpen && !isMobileMenuOpen) return;

    function handleDocumentPointerDown(event: PointerEvent) {
      const menuTarget = event.target as Node;
      const headerRoot = headerRef.current;
      const moreRoot = moreMenuRef.current;
      const networkRoot = networkMenuRef.current;
      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];

      const interactedInsideMobileMenu =
        isMobileMenuOpen &&
        !!headerRoot &&
        (eventPath.length > 0 ? eventPath.includes(headerRoot) : headerRoot.contains(menuTarget));

      const interactedInsideMoreMenu =
        isMoreOpen &&
        !!moreRoot &&
        (eventPath.length > 0 ? eventPath.includes(moreRoot) : moreRoot.contains(menuTarget));

      const interactedInsideNetworkMenu =
        isNetworkOpen &&
        !!networkRoot &&
        (eventPath.length > 0 ? eventPath.includes(networkRoot) : networkRoot.contains(menuTarget));

      if (!interactedInsideMobileMenu && !interactedInsideMoreMenu && !interactedInsideNetworkMenu) {
        setIsMoreOpen(false);
        setIsNetworkOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
        setIsNetworkOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isMobileMenuOpen, isMoreOpen, isNetworkOpen]);

  return (
    <div ref={headerRef} className="topbar-shell">
      <header>
        <div className="topbar-row">
          <Link href="/plans" className="brand-wordmark-shell shrink-0" aria-label="OmegaX Protocol home">
            <Image
              src="/brand/logo-mark.svg"
              alt="OmegaX"
              width={40}
              height={40}
              className="brand-wordmark"
              priority
            />
          </Link>

          <nav className="hidden min-w-0 flex-1 md:block" aria-label="Primary navigation">
            <div className="flex min-w-0 items-center">
              <div className="topbar-tabs no-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
                {primaryNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.isExternal ? "_blank" : undefined}
                    rel={item.isExternal ? "noopener noreferrer" : undefined}
                    aria-current={!item.isExternal && isActive(pathname, item.href) ? "page" : undefined}
                    className={cn("nav-link", !item.isExternal && isActive(pathname, item.href) && "nav-link-active")}
                  >
                    {item.label}
                  </Link>
                ))}

                {overflowNavItems.length > 0 ? (
                  <div ref={moreMenuRef} className="relative shrink-0">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isMoreOpen}
                      onClick={() => setIsMoreOpen((prev) => !prev)}
                      className={cn("nav-link inline-flex items-center gap-1.5", overflowHasActiveTab && "nav-link-active")}
                    >
                      More
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isMoreOpen && "rotate-180")} strokeWidth={1.8} />
                    </button>

                    {isMoreOpen ? (
                      <div className="topbar-more-menu" role="menu" aria-label="More navigation">
                        {overflowNavItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            target={item.isExternal ? "_blank" : undefined}
                            rel={item.isExternal ? "noopener noreferrer" : undefined}
                            role="menuitem"
                            aria-current={!item.isExternal && isActive(pathname, item.href) ? "page" : undefined}
                            onClick={() => {
                              setIsMoreOpen(false);
                            }}
                            className={cn(
                              "topbar-more-link",
                              !item.isExternal && isActive(pathname, item.href) && "topbar-more-link-active",
                              item.isExternal && "flex items-center justify-between"
                            )}
                          >
                            {item.label}
                            {item.isExternal ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 opacity-50"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="topbar-icon-button hidden md:inline-flex"
              aria-label={`Switch to ${nextThemeLabel} mode`}
              title={`Switch to ${nextThemeLabel} mode`}
            >
              <ThemeIcon className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.9} aria-hidden="true" />
            </button>

            <div ref={networkMenuRef} className="relative hidden md:block">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isNetworkOpen}
                onClick={() => setIsNetworkOpen((prev) => !prev)}
                className="topbar-network-trigger"
                aria-label={`Active network ${activeNetwork}`}
                title="Select network"
              >
                <span className="topbar-network-dot" aria-hidden="true" />
                <span className="topbar-network-label">{activeNetwork}</span>
                <ChevronDown
                  className={cn("topbar-network-chevron", isNetworkOpen && "rotate-180")}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>

              {isNetworkOpen ? (
                <div className="topbar-network-menu topbar-more-menu" role="menu" aria-label="Network selection">
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
                          setIsNetworkOpen(false);
                        }}
                        className={cn(
                          "topbar-network-option",
                          isCurrent && "topbar-network-option-active",
                          !canSelect && "topbar-network-option-disabled",
                        )}
                      >
                        <span>{network.label}</span>
                        {!canSelect ? <span className="topbar-network-option-badge">Coming soon</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <WalletButton className="topbar-wallet hidden md:flex" />
            <button
              type="button"
              aria-controls="mobile-primary-menu"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => {
                setIsMoreOpen(false);
                setIsNetworkOpen(false);
                setIsMobileMenuOpen((prev) => !prev);
              }}
              className="topbar-icon-button inline-flex md:hidden"
            >
              {isMobileMenuOpen ? (
                <X className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.9} aria-hidden="true" />
              ) : (
                <Menu className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.9} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      <ProtocolStatusBar />

      {isMobileMenuOpen ? (
        <div
          id="mobile-primary-menu"
          className="topbar-mobile-panel px-4 pb-4 pt-3 md:hidden motion-safe:animate-[surface-rise_180ms_ease-out]"
        >
          <nav aria-label="Mobile primary navigation" className="grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                target={item.isExternal ? "_blank" : undefined}
                rel={item.isExternal ? "noopener noreferrer" : undefined}
                aria-current={!item.isExternal && isActive(pathname, item.href) ? "page" : undefined}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "topbar-mobile-link",
                  !item.isExternal && isActive(pathname, item.href) && "topbar-mobile-link-active",
                  item.isExternal && "topbar-mobile-link-external",
                )}
              >
                <span>{item.label}</span>
                {item.isExternal ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4 opacity-55"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="topbar-mobile-sections">
            <div className="topbar-mobile-section">
              <div className="topbar-mobile-section-head">
                <div>
                  <p className="topbar-mobile-eyebrow">Appearance</p>
                  <p className="topbar-mobile-copy" suppressHydrationWarning>{themeLabel} theme active</p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="topbar-mobile-action"
                  aria-label={`Switch to ${nextThemeLabel} mode`}
                  title={`Switch to ${nextThemeLabel} mode`}
                >
                  <ThemeIcon className="h-[0.95rem] w-[0.95rem]" strokeWidth={1.9} aria-hidden="true" />
                  <span>{themeActionLabel}</span>
                </button>
              </div>
            </div>

            <div className="topbar-mobile-section">
              <div className="grid gap-3">
                <div>
                  <p className="topbar-mobile-eyebrow">Wallet</p>
                  <p className="topbar-mobile-copy">Connect to unlock wallet-aware protocol actions.</p>
                </div>
                <WalletButton className="w-full" />
              </div>
            </div>

            <div className="topbar-mobile-section">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="topbar-mobile-eyebrow">Network</p>
                    <p className="topbar-mobile-copy">{activeNetwork}</p>
                  </div>
                  <span className="topbar-mobile-meta">Select cluster</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {NETWORK_OPTIONS.map((network) => {
                    const isCurrent = network.id === selectedNetwork;
                    const canSelect = canSelectNetwork(network.id);

                    return (
                      <button
                        key={network.id}
                        type="button"
                        aria-pressed={isCurrent}
                        aria-disabled={!canSelect}
                        disabled={!canSelect}
                        onClick={() => {
                          if (!canSelect) return;
                          setSelectedNetwork(network.id);
                        }}
                        className={cn(
                          "topbar-mobile-network-option",
                          isCurrent && "topbar-mobile-network-option-active",
                          !canSelect && "topbar-network-option-disabled",
                        )}
                      >
                        <span>{network.label}</span>
                        {!canSelect ? <span className="topbar-network-option-badge">Coming soon</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
