// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import type { ReactNode } from "react";

import { WalletProviders } from "@/components/wallet-providers";
import { NetworkProvider } from "@/components/network-context";
import { ThemeProvider } from "@/components/theme-provider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NetworkProvider>
        <WalletProviders>{children}</WalletProviders>
      </NetworkProvider>
    </ThemeProvider>
  );
}
