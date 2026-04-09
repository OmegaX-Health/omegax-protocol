// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import { Suspense } from "react";
import { Fira_Code, Newsreader, Space_Grotesk } from "next/font/google";

import AppProviders from "@/components/app-providers";
import ProtocolWorkbenchShell from "@/components/protocol-workbench-shell";
import "./globals.css";

const display = Newsreader({
  adjustFontFallback: false,
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "OmegaX Protocol",
  description:
    "Canonical OmegaX protocol console for health plans, obligations, reserve domains, and capital classes.",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/icon-primary-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProviders>
          <Suspense
            fallback={
              <div className="protocol-workbench-shell relative">
                <div className="absolute inset-0 misty-cyan-glow pointer-events-none z-0" />
              </div>
            }
          >
            <ProtocolWorkbenchShell>{children}</ProtocolWorkbenchShell>
          </Suspense>
        </AppProviders>
      </body>
    </html>
  );
}
