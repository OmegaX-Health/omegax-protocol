// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoonStar, SunMedium } from "lucide-react";

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
  { href: "/pools", label: "Health Plans" },
  { href: "/oracles", label: "Verification" },
  { href: "/schemas", label: "Outcomes" },
  { href: "/governance", label: "Governance" },
  { href: "https://docs.omegax.health", label: "Docs", isExternal: true },
];

const MAX_VISIBLE_TABS = 5;

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
  const headerRef = useRef<HTMLElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const networkMenuRef = useRef<HTMLDivElement>(null);
  const { selectedNetwork, setSelectedNetwork, canSelectNetwork } = useNetworkContext();
  const { mounted, theme, toggleTheme } = useTheme();
  const activeNetwork = NETWORK_OPTIONS.find((item) => item.id === selectedNetwork)?.label ?? "Devnet";
  const isDarkTheme = mounted && theme === "dark";
  const themeLabel = mounted ? (isDarkTheme ? "Dark" : "Light") : "Theme";
  const nextThemeLabel = isDarkTheme ? "light" : "dark";
  const themeActionLabel = isDarkTheme ? "Use light" : "Use dark";
  const ThemeIcon = isDarkTheme ? SunMedium : MoonStar;
  const primaryNavItems = navItems.slice(0, MAX_VISIBLE_TABS);
  const overflowNavItems = navItems.slice(MAX_VISIBLE_TABS);
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
    <header
      ref={headerRef}
      className="topbar-shell"
    >
      <div className="flex h-16 w-full items-center gap-2 px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
        <Link href="/" className="brand-logo-shell shrink-0" aria-label="OmegaX Protocol home">
          <Image src="/favicon.svg" alt="Protocol icon" width={162} height={116} className="brand-logo" priority />
        </Link>

        <nav className="hidden min-w-0 flex-1 md:block" aria-label="Primary navigation">
          <div className="flex min-w-0 items-center gap-2">
            <div className="topbar-tabs no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
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
            </div>

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
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                    className={cn("h-3.5 w-3.5 transition-transform", isMoreOpen && "rotate-180")}
                  >
                    <path d="m5.5 7.5 4.5 5 4.5-5" />
                  </svg>
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
                        {item.isExternal && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 opacity-50"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="topbar-control topbar-theme-toggle hidden md:inline-flex"
            aria-label={`Switch to ${nextThemeLabel} mode`}
            title={`Switch to ${nextThemeLabel} mode`}
          >
            <span className="topbar-theme-toggle-icon" aria-hidden="true">
              <ThemeIcon className="topbar-theme-toggle-glyph" strokeWidth={1.9} />
            </span>
            <span className="hidden lg:inline topbar-control-label" suppressHydrationWarning>
              {themeLabel}
            </span>
          </button>

          <div ref={networkMenuRef} className="relative hidden md:inline-flex">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isNetworkOpen}
              onClick={() => setIsNetworkOpen((prev) => !prev)}
              className="topbar-network-trigger topbar-control pr-2"
              aria-label={`Active network ${activeNetwork}`}
              title="Select network"
            >
              <span className="topbar-control-label">{activeNetwork}</span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
                className={cn("topbar-network-chevron", isNetworkOpen && "rotate-180")}
              >
                <path d="m5.5 7.5 4.5 5 4.5-5" />
              </svg>
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
                      {!canSelect && <span className="topbar-network-option-badge">Coming soon</span>}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <WalletButton className="wallet-button-compact wallet-button-topbar wallet-button-mobile" />
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
            className="topbar-control inline-flex h-9 w-9 items-center justify-center p-0 md:hidden"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-[1.125rem] w-[1.125rem]"
            >
              {isMobileMenuOpen ? (
                <path d="M5.75 5.75 14.25 14.25M14.25 5.75l-8.5 8.5" />
              ) : (
                <path d="M4.75 6.5h10.5M4.75 10h10.5M4.75 13.5h10.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

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

          <div className="mt-4 grid gap-4">
            <div className="surface-card rounded-[1.8rem] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="topbar-mobile-eyebrow">Appearance</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]" suppressHydrationWarning>
                    {themeLabel} mode
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="topbar-control topbar-theme-toggle topbar-theme-toggle-mobile"
                  aria-label={`Switch to ${nextThemeLabel} mode`}
                  title={`Switch to ${nextThemeLabel} mode`}
                >
                  <span className="topbar-theme-toggle-icon" aria-hidden="true">
                    <ThemeIcon className="topbar-theme-toggle-glyph" strokeWidth={1.9} />
                  </span>
                  <span className="topbar-control-label">{themeActionLabel}</span>
                </button>
              </div>
            </div>

            <div className="surface-card space-y-4 rounded-[1.8rem] p-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="topbar-mobile-eyebrow">Network</p>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{activeNetwork}</p>
                  </div>
                  <span className="text-[11px] font-medium text-[var(--muted-foreground)]">Select cluster</span>
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
    </header>
  );
}
