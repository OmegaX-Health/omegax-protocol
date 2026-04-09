// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  NETWORK_OPTIONS,
  buildRpcEnvironment,
  getRpcProfileOptions,
  hydrateConnectionPreferences,
  resolveRpcEndpoint,
  sanitizeCustomRpcUrl,
  validateCustomRpcUrl,
  type NetworkMode,
  type RpcProfile,
  type RpcProfileOption,
} from "@/lib/network-config";

export type NetworkContextValue = {
  selectedNetwork: NetworkMode;
  setSelectedNetwork: (network: NetworkMode) => void;
  canSelectNetwork: (network: NetworkMode) => boolean;
  selectedRpcProfile: RpcProfile;
  resolvedRpcProfile: RpcProfile;
  setSelectedRpcProfile: (profile: RpcProfile) => void;
  canSelectRpcProfile: (profile: RpcProfile, network?: NetworkMode) => boolean;
  rpcProfileOptions: RpcProfileOption[];
  resolvedEndpoint: string;
  customRpcUrl: string;
  applyCustomRpcUrl: (value: string) => { ok: true } | { ok: false; error: string };
  resetConnectionSettings: () => void;
};

export const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

const NETWORK_STORAGE_KEY = "omegax-network";
const RPC_PROFILE_STORAGE_KEY = "omegax-rpc-profiles";
const CUSTOM_RPC_STORAGE_KEY = "omegax-custom-rpc-endpoints";

type NetworkProviderProps = {
  children: ReactNode;
};

export function NetworkProvider({ children }: NetworkProviderProps) {
  const environment = useMemo(() => buildRpcEnvironment(process.env), []);
  const [selectedNetwork, setSelectedNetworkState] = useState<NetworkMode>("devnet");
  const [rpcProfiles, setRpcProfiles] = useState<Record<NetworkMode, RpcProfile>>({
    devnet: "public",
    "mainnet-beta": "public",
  });
  const [customRpcEndpoints, setCustomRpcEndpoints] = useState<Record<NetworkMode, string>>({
    devnet: "",
    "mainnet-beta": "",
  });
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);

  const canSelectNetwork = (network: NetworkMode): boolean =>
    NETWORK_OPTIONS.some((option) => option.id === network && option.isAvailable);

  const setSelectedNetwork = (network: NetworkMode): void => {
    if (!canSelectNetwork(network)) return;
    setSelectedNetworkState(network);
  };

  useEffect(() => {
    const hydrated = hydrateConnectionPreferences({
      explorerCluster: process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER,
      storedNetwork: window.localStorage.getItem(NETWORK_STORAGE_KEY),
      storedRpcProfiles: window.localStorage.getItem(RPC_PROFILE_STORAGE_KEY),
      storedCustomRpcEndpoints: window.localStorage.getItem(CUSTOM_RPC_STORAGE_KEY),
      environment,
    });

    setSelectedNetworkState(hydrated.selectedNetwork);
    setRpcProfiles(hydrated.rpcProfiles);
    setCustomRpcEndpoints(hydrated.customRpcEndpoints);
    setIsStorageHydrated(true);
  }, [environment]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    window.localStorage.setItem(NETWORK_STORAGE_KEY, selectedNetwork);
    window.localStorage.setItem(RPC_PROFILE_STORAGE_KEY, JSON.stringify(rpcProfiles));
    window.localStorage.setItem(CUSTOM_RPC_STORAGE_KEY, JSON.stringify(customRpcEndpoints));
  }, [customRpcEndpoints, isStorageHydrated, rpcProfiles, selectedNetwork]);

  const selectedRpcProfile = rpcProfiles[selectedNetwork];
  const rpcProfileOptions = useMemo(
    () => getRpcProfileOptions(selectedNetwork, environment, customRpcEndpoints),
    [customRpcEndpoints, environment, selectedNetwork],
  );
  const resolvedConnection = useMemo(
    () => resolveRpcEndpoint(selectedNetwork, selectedRpcProfile, environment, customRpcEndpoints),
    [customRpcEndpoints, environment, selectedNetwork, selectedRpcProfile],
  );

  useEffect(() => {
    if (!isStorageHydrated) return;
    if (resolvedConnection.rpcProfile === selectedRpcProfile) return;

    setRpcProfiles((current) => ({
      ...current,
      [selectedNetwork]: resolvedConnection.rpcProfile,
    }));
  }, [isStorageHydrated, resolvedConnection.rpcProfile, selectedNetwork, selectedRpcProfile]);

  const canSelectRpcProfile = (profile: RpcProfile, network: NetworkMode = selectedNetwork): boolean =>
    getRpcProfileOptions(network, environment, customRpcEndpoints)
      .some((option) => option.id === profile && option.isAvailable);

  const setSelectedRpcProfile = (profile: RpcProfile): void => {
    if (!canSelectRpcProfile(profile)) return;
    setRpcProfiles((current) => ({
      ...current,
      [selectedNetwork]: profile,
    }));
  };

  function applyCustomRpcUrl(value: string): { ok: true } | { ok: false; error: string } {
    const error = validateCustomRpcUrl(value);
    if (error) return { ok: false, error };

    const normalized = sanitizeCustomRpcUrl(value);
    setCustomRpcEndpoints((current) => ({
      ...current,
      [selectedNetwork]: normalized,
    }));
    setRpcProfiles((current) => ({
      ...current,
      [selectedNetwork]: "custom",
    }));
    return { ok: true };
  }

  function resetConnectionSettings(): void {
    setCustomRpcEndpoints((current) => ({
      ...current,
      [selectedNetwork]: "",
    }));
    setRpcProfiles((current) => ({
      ...current,
      [selectedNetwork]: "public",
    }));
  }

  const value = useMemo(
    () => ({
      selectedNetwork,
      setSelectedNetwork,
      canSelectNetwork,
      selectedRpcProfile,
      resolvedRpcProfile: resolvedConnection.rpcProfile,
      setSelectedRpcProfile,
      canSelectRpcProfile,
      rpcProfileOptions,
      resolvedEndpoint: resolvedConnection.endpoint,
      customRpcUrl: customRpcEndpoints[selectedNetwork],
      applyCustomRpcUrl,
      resetConnectionSettings,
    }),
    [
      customRpcEndpoints,
      resolvedConnection.endpoint,
      resolvedConnection.rpcProfile,
      rpcProfileOptions,
      selectedNetwork,
      selectedRpcProfile,
    ],
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
