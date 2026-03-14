// SPDX-License-Identifier: AGPL-3.0-or-later

export type NetworkMode = "devnet" | "mainnet-beta";

export type NetworkOption = {
  id: NetworkMode;
  label: string;
  explorerCluster: string;
  isAvailable: boolean;
};

export const NETWORK_OPTIONS: readonly NetworkOption[] = [
  {
    id: "devnet",
    label: "Devnet",
    explorerCluster: "devnet",
    isAvailable: true,
  },
  {
    id: "mainnet-beta",
    label: "Mainnet",
    explorerCluster: "mainnet-beta",
    isAvailable: false,
  },
] as const;

export function normalizeExplorerCluster(value?: string): NetworkMode {
  const normalized = (value ?? "devnet").trim().toLowerCase();
  if (normalized.includes("mainnet")) return "mainnet-beta";
  return "devnet";
}
