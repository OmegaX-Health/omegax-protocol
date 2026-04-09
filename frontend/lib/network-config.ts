// SPDX-License-Identifier: AGPL-3.0-or-later

export type NetworkMode = "devnet" | "mainnet-beta";
export type RpcProfile = "public" | "helius" | "custom";

export type NetworkOption = {
  id: NetworkMode;
  label: string;
  explorerCluster: string;
  isAvailable: boolean;
};

export type RpcProfileOption = {
  id: RpcProfile;
  label: string;
  description: string;
  isAvailable: boolean;
  reason?: string;
  endpoint?: string;
};

export type RpcEnvironment = {
  publicEndpoints: Record<NetworkMode, string>;
  heliusEndpoints: Partial<Record<NetworkMode, string>>;
};

export type ConnectionPreferenceState = {
  selectedNetwork: NetworkMode;
  rpcProfiles: Record<NetworkMode, RpcProfile>;
  customRpcEndpoints: Record<NetworkMode, string>;
};

const PUBLIC_RPC_ENDPOINTS: Record<NetworkMode, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

const DEFAULT_RPC_PROFILE: RpcProfile = "public";
const NETWORK_ORDER: readonly NetworkMode[] = ["devnet", "mainnet-beta"] as const;

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
    isAvailable: true,
  },
] as const;

export function normalizeExplorerCluster(value?: string): NetworkMode {
  const normalized = (value ?? "devnet").trim().toLowerCase();
  if (normalized.includes("mainnet")) return "mainnet-beta";
  return "devnet";
}

export function normalizeRpcProfile(value?: string | null): RpcProfile | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "public" || normalized === "helius" || normalized === "custom") return normalized;
  return null;
}

export function sanitizeCustomRpcUrl(value?: string | null): string {
  return (value ?? "").trim();
}

export function isValidCustomRpcUrl(value?: string | null): boolean {
  const normalized = sanitizeCustomRpcUrl(value);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateCustomRpcUrl(value?: string | null): string | null {
  const normalized = sanitizeCustomRpcUrl(value);
  if (!isValidCustomRpcUrl(normalized)) return "Use a valid http:// or https:// RPC endpoint.";
  return null;
}

export function buildRpcEnvironment(env: Partial<Record<string, string | undefined>>): RpcEnvironment {
  const sharedEndpoint = sanitizeCustomRpcUrl(env.NEXT_PUBLIC_SOLANA_RPC_URL);
  const devnetEndpoint = sanitizeCustomRpcUrl(env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL);
  const mainnetEndpoint = sanitizeCustomRpcUrl(env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL);
  const keyedDevnetEndpoint = sanitizeCustomRpcUrl(env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL_WITH_KEY);
  const keyedMainnetEndpoint = sanitizeCustomRpcUrl(env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL_WITH_KEY);

  return {
    publicEndpoints: {
      devnet: PUBLIC_RPC_ENDPOINTS.devnet,
      "mainnet-beta": PUBLIC_RPC_ENDPOINTS["mainnet-beta"],
    },
    heliusEndpoints: {
      devnet: keyedDevnetEndpoint || pickHeliusEndpoint(devnetEndpoint || sharedEndpoint),
      "mainnet-beta": keyedMainnetEndpoint || pickHeliusEndpoint(mainnetEndpoint || sharedEndpoint),
    },
  };
}

export function getRpcProfileOptions(
  network: NetworkMode,
  environment: RpcEnvironment,
  customRpcEndpoints: Record<NetworkMode, string>,
): RpcProfileOption[] {
  const publicEndpoint = environment.publicEndpoints[network];
  const heliusEndpoint = sanitizeCustomRpcUrl(environment.heliusEndpoints[network]);
  const customEndpoint = sanitizeCustomRpcUrl(customRpcEndpoints[network]);

  return [
    {
      id: "public",
      label: "Solana Public",
      description: "Canonical public Solana RPC.",
      isAvailable: true,
      endpoint: publicEndpoint,
    },
    {
      id: "helius",
      label: "Helius",
      description: "Configured Helius endpoint for this cluster.",
      isAvailable: Boolean(heliusEndpoint),
      reason: heliusEndpoint ? undefined : "Helius is not configured for this cluster.",
      endpoint: heliusEndpoint || undefined,
    },
    {
      id: "custom",
      label: "Custom RPC",
      description: "Stored locally in this browser.",
      isAvailable: isValidCustomRpcUrl(customEndpoint),
      reason: customEndpoint
        ? "The saved custom RPC URL is invalid."
        : "Add a custom RPC URL to enable this profile.",
      endpoint: customEndpoint || undefined,
    },
  ];
}

export function resolveRpcEndpoint(
  network: NetworkMode,
  rpcProfile: RpcProfile,
  environment: RpcEnvironment,
  customRpcEndpoints: Record<NetworkMode, string>,
): { endpoint: string; rpcProfile: RpcProfile } {
  const options = getRpcProfileOptions(network, environment, customRpcEndpoints);
  const current = options.find((option) => option.id === rpcProfile);

  if (current?.isAvailable && current.endpoint) {
    return {
      endpoint: current.endpoint,
      rpcProfile: current.id,
    };
  }

  return {
    endpoint: environment.publicEndpoints[network],
    rpcProfile: "public",
  };
}

export function hydrateConnectionPreferences(params: {
  explorerCluster?: string;
  storedNetwork?: string | null;
  storedRpcProfiles?: string | null;
  storedCustomRpcEndpoints?: string | null;
  environment: RpcEnvironment;
}): ConnectionPreferenceState {
  const customRpcEndpoints = createEmptyNetworkRecord("");
  const rawCustoms = parseStoredRecord(params.storedCustomRpcEndpoints);
  const rawProfiles = parseStoredRecord(params.storedRpcProfiles);

  for (const network of NETWORK_ORDER) {
    customRpcEndpoints[network] = sanitizeCustomRpcUrl(rawCustoms[network]);
  }

  const rpcProfiles = createEmptyNetworkRecord<RpcProfile>(DEFAULT_RPC_PROFILE);
  for (const network of NETWORK_ORDER) {
    const storedProfile = normalizeRpcProfile(rawProfiles[network]);
    const desiredProfile = storedProfile ?? DEFAULT_RPC_PROFILE;
    rpcProfiles[network] = resolveRpcEndpoint(network, desiredProfile, params.environment, customRpcEndpoints).rpcProfile;
  }

  const selectedNetwork = normalizeStoredNetwork(params.storedNetwork) ?? normalizeExplorerCluster(params.explorerCluster);

  return {
    selectedNetwork,
    rpcProfiles,
    customRpcEndpoints,
  };
}

function normalizeStoredNetwork(value?: string | null): NetworkMode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "devnet" || normalized === "mainnet-beta") return normalized;
  return null;
}

function parseStoredRecord(value?: string | null): Partial<Record<NetworkMode, string>> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      devnet: typeof parsed.devnet === "string" ? parsed.devnet : undefined,
      "mainnet-beta": typeof parsed["mainnet-beta"] === "string" ? parsed["mainnet-beta"] : undefined,
    };
  } catch {
    return {};
  }
}

function createEmptyNetworkRecord<T>(initialValue: T): Record<NetworkMode, T> {
  return {
    devnet: initialValue,
    "mainnet-beta": initialValue,
  };
}

function pickHeliusEndpoint(value?: string | null): string {
  const normalized = sanitizeCustomRpcUrl(value);
  return normalized && normalized.toLowerCase().includes("helius") ? normalized : "";
}
