// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";

import AppHeader from "@/components/app-header";
import AppProviders from "@/components/app-providers";

import "./globals.css";

const themeBootstrapScript = `
  (() => {
    try {
      const storageKey = "omegax-theme";
      const storedTheme = window.localStorage.getItem(storageKey);
      const resolvedTheme =
        storedTheme === "dark" || storedTheme === "light"
          ? storedTheme
          : "light";
      const root = document.documentElement;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.dataset.theme = resolvedTheme;
    } catch (error) {}
  })();
`;

const sansFont = DM_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const displayFont = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const metadataTitle = "OmegaX Protocol";
const metadataDescription =
  "OmegaX pool-first protocol console with guided pool creation and dashboard-based pool operations.";
const sourceRepoUrl =
  (process.env.NEXT_PUBLIC_SOURCE_REPO_URL || "").trim()
  || "https://github.com/OmegaX-Health/omegax-protocol";
const sourceBlobBase = sourceRepoUrl.replace(/\/$/, "");

export const metadata: Metadata = {
  title: metadataTitle,
  description: metadataDescription,
  metadataBase: new URL("https://protocol.omegax.health"),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: metadataTitle,
    description: metadataDescription,
    siteName: metadataTitle,
    url: "https://protocol.omegax.health",
    images: ["/favicon.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: metadataTitle,
    description: metadataDescription,
    images: ["/favicon.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${sansFont.variable} ${displayFont.variable} ${monoFont.variable} bg-[var(--background)] font-sans text-[var(--foreground)] antialiased`}>
        <AppProviders>
          <div className="app-shell-bg min-h-screen">
            <AppHeader />
            <main className="app-main-shell mx-auto w-full max-w-7xl pb-10 pt-6 sm:pb-12 sm:pt-8">{children}</main>
            <footer className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pb-10 text-sm text-[var(--muted-foreground)] sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--card-border)] pt-4">
                <a href={sourceRepoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
                  Source
                </a>
                <a href={`${sourceBlobBase}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
                  License
                </a>
                <a href={`${sourceBlobBase}/blob/main/SECURITY.md`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
                  Security
                </a>
                <a href={`${sourceBlobBase}/blob/main/TRADEMARKS.md`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
                  Trademarks
                </a>
                <Link href="/" className="hover:text-[var(--foreground)]">
                  Protocol Console
                </Link>
              </div>
              <p className="max-w-3xl text-xs leading-5 text-[var(--muted-foreground)]/90">
                OmegaX Protocol is open-source software under the GNU Affero General Public License. Names and logos remain subject to trademark policy.
              </p>
            </footer>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
