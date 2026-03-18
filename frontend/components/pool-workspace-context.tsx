// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { WalletCapabilities } from "@/lib/ui-capabilities";

type PoolWorkspaceContextValue = {
  capabilities: WalletCapabilities;
};

const PoolWorkspaceContext = createContext<PoolWorkspaceContextValue | undefined>(undefined);

type PoolWorkspaceProviderProps = {
  capabilities: WalletCapabilities;
  children: ReactNode;
};

export function PoolWorkspaceProvider({ capabilities, children }: PoolWorkspaceProviderProps) {
  const value = useMemo(() => ({ capabilities }), [capabilities]);
  return <PoolWorkspaceContext.Provider value={value}>{children}</PoolWorkspaceContext.Provider>;
}

export function usePoolWorkspaceContext(): PoolWorkspaceContextValue {
  const context = useContext(PoolWorkspaceContext);
  if (!context) {
    throw new Error("usePoolWorkspaceContext must be used within PoolWorkspaceProvider.");
  }
  return context;
}
