// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { NETWORK_OPTIONS, normalizeExplorerCluster, type NetworkMode } from "@/lib/network-config";

export type NetworkContextValue = {
  selectedNetwork: NetworkMode;
  setSelectedNetwork: (network: NetworkMode) => void;
  canSelectNetwork: (network: NetworkMode) => boolean;
};

export const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

type NetworkProviderProps = {
  children: ReactNode;
};

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [selectedNetwork, setSelectedNetworkState] = useState<NetworkMode>(() =>
    normalizeExplorerCluster(process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER),
  );

  const canSelectNetwork = (network: NetworkMode): boolean =>
    NETWORK_OPTIONS.some((option) => option.id === network && option.isAvailable);

  const setSelectedNetwork = (network: NetworkMode): void => {
    if (!canSelectNetwork(network)) return;
    setSelectedNetworkState(network);
  };

  const value = useMemo(
    () => ({
      selectedNetwork,
      setSelectedNetwork,
      canSelectNetwork,
    }),
    [selectedNetwork],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkContext(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetworkContext must be used within NetworkProvider.");
  }
  return context;
}

