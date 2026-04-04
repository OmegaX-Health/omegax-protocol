// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "OmegaX Protocol",
  description:
    "Canonical OmegaX protocol console for health plans, obligations, reserve domains, and capital classes.",
};

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/plans", label: "Health Plans" },
  { href: "/capital", label: "Capital Markets" },
  { href: "/claims", label: "Claims" },
  { href: "/members", label: "Members" },
  { href: "/governance", label: "Governance" },
  { href: "/oracles", label: "Oracles" },
  { href: "/schemas", label: "Schemas" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(12,172,156,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(19,47,76,0.24),_transparent_32%),linear-gradient(180deg,_#071520_0%,_#0b1320_100%)] text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
          <header className="mb-8 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-200/80">
                  OmegaX Protocol
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Shared settlement foundation for health capital markets
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Health plans own sponsor/member liability semantics. Liquidity pools and capital classes own
                  investor exposure. Reserve domains keep settlement truth ring-fenced without fragmenting the
                  protocol.
                </p>
              </div>
              <nav className="flex flex-wrap gap-2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 text-sm text-slate-200 transition hover:border-teal-300/50 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
