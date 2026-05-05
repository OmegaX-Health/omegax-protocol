// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NetworkMode } from "@/lib/network-config";

export type GenesisPhase0SurfaceState = "live" | "disabled_preview" | "hidden";
export type GenesisPhase0ReadSurfaceState = "read_only";

export type GenesisPhase0LaunchProfile = {
  id: "genesis-phase0";
  network: NetworkMode;
  description: string;
  lpDeposits: GenesisPhase0SurfaceState;
  lpRedemptionRequests: GenesisPhase0SurfaceState;
  capitalDashboard: GenesisPhase0ReadSurfaceState;
  reserveDashboard: GenesisPhase0ReadSurfaceState;
  claimsDashboard: GenesisPhase0ReadSurfaceState;
  oracleDashboard: GenesisPhase0ReadSurfaceState;
  commitmentsDashboard: GenesisPhase0ReadSurfaceState;
  operatorSettlementVisibility: GenesisPhase0ReadSurfaceState;
  rewardLaunch: GenesisPhase0SurfaceState;
  rwaPolicyLaunch: GenesisPhase0SurfaceState;
  hybridLaunch: GenesisPhase0SurfaceState;
  daoFallback: GenesisPhase0SurfaceState;
  capitalAdminActions: GenesisPhase0SurfaceState;
  policyAdminActions: GenesisPhase0SurfaceState;
  futureLaunchChoices: GenesisPhase0SurfaceState;
  disabledSurfaces: string[];
  hiddenSurfaces: string[];
  mainnetPlanAssertions: string[];
};

type EnvLike = Partial<Record<string, string | undefined>>;

export const GENESIS_PHASE0_ADMIN_FLAG = "NEXT_PUBLIC_ENABLE_PROTOCOL_OPERATOR_ACTIONS";
export const GENESIS_PHASE0_MAINNET_FUTURE_SURFACES_FLAG = "NEXT_PUBLIC_ALLOW_MAINNET_FUTURE_SURFACES";
export const GENESIS_PHASE0_REWARD_FLAG = "NEXT_PUBLIC_ENABLE_REWARD_LAUNCH";
export const GENESIS_PHASE0_RWA_FLAG = "NEXT_PUBLIC_ENABLE_RWA_POLICY";
export const GENESIS_PHASE0_HYBRID_FLAG = "NEXT_PUBLIC_ENABLE_HYBRID_LAUNCH";
export const GENESIS_PHASE0_DAO_FLAG = "NEXT_PUBLIC_ENABLE_DAO_FALLBACK";

export const GENESIS_PHASE0_CLIENT_ENV: EnvLike = {
  NEXT_PUBLIC_ALLOW_MAINNET_FUTURE_SURFACES: process.env.NEXT_PUBLIC_ALLOW_MAINNET_FUTURE_SURFACES,
  NEXT_PUBLIC_ENABLE_DAO_FALLBACK: process.env.NEXT_PUBLIC_ENABLE_DAO_FALLBACK,
  NEXT_PUBLIC_ENABLE_HYBRID_LAUNCH: process.env.NEXT_PUBLIC_ENABLE_HYBRID_LAUNCH,
  NEXT_PUBLIC_ENABLE_PROTOCOL_OPERATOR_ACTIONS: process.env.NEXT_PUBLIC_ENABLE_PROTOCOL_OPERATOR_ACTIONS,
  NEXT_PUBLIC_ENABLE_REWARD_LAUNCH: process.env.NEXT_PUBLIC_ENABLE_REWARD_LAUNCH,
  NEXT_PUBLIC_ENABLE_RWA_POLICY: process.env.NEXT_PUBLIC_ENABLE_RWA_POLICY,
};

export function phase0FlagEnabled(env: EnvLike, name: string): boolean {
  const value = String(env[name] ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function normalizeNetwork(network?: NetworkMode | string | null): NetworkMode {
  const normalized = String(network ?? "devnet").trim().toLowerCase();
  return normalized.includes("mainnet") ? "mainnet-beta" : "devnet";
}

function productSurfaceState(params: {
  enabledFlag: string;
  env: EnvLike;
  mainnet: boolean;
}): GenesisPhase0SurfaceState {
  const enabled = phase0FlagEnabled(params.env, params.enabledFlag);
  if (!enabled) return "disabled_preview";
  if (!params.mainnet) return "live";
  return phase0FlagEnabled(params.env, GENESIS_PHASE0_MAINNET_FUTURE_SURFACES_FLAG)
    ? "live"
    : "disabled_preview";
}

function adminSurfaceState(params: {
  env: EnvLike;
  mainnet: boolean;
}): GenesisPhase0SurfaceState {
  const enabled = phase0FlagEnabled(params.env, GENESIS_PHASE0_ADMIN_FLAG);
  if (!enabled) return "hidden";
  if (!params.mainnet) return "live";
  return enabled ? "live" : "hidden";
}

function disabledLabels(profile: Omit<
  GenesisPhase0LaunchProfile,
  "disabledSurfaces" | "hiddenSurfaces" | "mainnetPlanAssertions"
>): string[] {
  const entries: Array<[GenesisPhase0SurfaceState, string]> = [
    [profile.rewardLaunch, "reward launch"],
    [profile.rwaPolicyLaunch, "RWA policy launch"],
    [profile.hybridLaunch, "hybrid launch"],
    [profile.daoFallback, "DAO fallback"],
    [profile.futureLaunchChoices, "future launch choices"],
  ];
  return entries.flatMap(([state, label]) => state === "disabled_preview" ? [label] : []);
}

function hiddenLabels(profile: Omit<
  GenesisPhase0LaunchProfile,
  "disabledSurfaces" | "hiddenSurfaces" | "mainnetPlanAssertions"
>): string[] {
  const entries: Array<[GenesisPhase0SurfaceState, string]> = [
    [profile.capitalAdminActions, "capital admin actions"],
    [profile.policyAdminActions, "policy admin actions"],
  ];
  return entries.flatMap(([state, label]) => state === "hidden" ? [label] : []);
}

export function resolveGenesisPhase0LaunchProfile(params: {
  network?: NetworkMode | string | null;
  env?: EnvLike;
} = {}): GenesisPhase0LaunchProfile {
  const env = params.env ?? GENESIS_PHASE0_CLIENT_ENV;
  const network = normalizeNetwork(params.network);
  const mainnet = network === "mainnet-beta";
  const capitalAdminActions = adminSurfaceState({ env, mainnet });
  const policyAdminActions = adminSurfaceState({ env, mainnet });
  const base = {
    id: "genesis-phase0" as const,
    network,
    description: mainnet
      ? "Phase 0 mainnet profile: LP self-service, read-only reserve/liability visibility, and hidden admin execution by default."
      : "Phase 0 devnet profile: live LP self-service plus explicit rehearsal flags for preview surfaces.",
    lpDeposits: "live" as const,
    lpRedemptionRequests: "live" as const,
    capitalDashboard: "read_only" as const,
    reserveDashboard: "read_only" as const,
    claimsDashboard: "read_only" as const,
    oracleDashboard: "read_only" as const,
    commitmentsDashboard: "read_only" as const,
    operatorSettlementVisibility: "read_only" as const,
    rewardLaunch: productSurfaceState({ enabledFlag: GENESIS_PHASE0_REWARD_FLAG, env, mainnet }),
    rwaPolicyLaunch: productSurfaceState({ enabledFlag: GENESIS_PHASE0_RWA_FLAG, env, mainnet }),
    hybridLaunch: productSurfaceState({ enabledFlag: GENESIS_PHASE0_HYBRID_FLAG, env, mainnet }),
    daoFallback: productSurfaceState({ enabledFlag: GENESIS_PHASE0_DAO_FLAG, env, mainnet }),
    capitalAdminActions,
    policyAdminActions,
    futureLaunchChoices: mainnet ? "disabled_preview" as const : "disabled_preview" as const,
  };

  return {
    ...base,
    disabledSurfaces: disabledLabels(base),
    hiddenSurfaces: hiddenLabels(base),
    mainnetPlanAssertions: [
      "LP classes are open.",
      "LP lockup is 30 days.",
      "LP redemption is queue-only.",
      "Classic SPL Token custody only; Token-2022 remains unsupported.",
      "No reward, RWA, hybrid, DAO, or external yield execution is bootstrapped by default.",
      "No transactions are sent in --plan mode.",
    ],
  };
}

export function isGenesisPhase0SurfaceLive(state: GenesisPhase0SurfaceState): boolean {
  return state === "live";
}

export function isGenesisPhase0SurfaceActionable(
  profile: GenesisPhase0LaunchProfile,
  surface: keyof Pick<
    GenesisPhase0LaunchProfile,
    | "lpDeposits"
    | "lpRedemptionRequests"
    | "rewardLaunch"
    | "rwaPolicyLaunch"
    | "hybridLaunch"
    | "daoFallback"
    | "capitalAdminActions"
    | "policyAdminActions"
    | "futureLaunchChoices"
  >,
): boolean {
  return isGenesisPhase0SurfaceLive(profile[surface]);
}

const genesisPhase0LaunchProfileModule = {
  GENESIS_PHASE0_ADMIN_FLAG,
  GENESIS_PHASE0_DAO_FLAG,
  GENESIS_PHASE0_HYBRID_FLAG,
  GENESIS_PHASE0_MAINNET_FUTURE_SURFACES_FLAG,
  GENESIS_PHASE0_REWARD_FLAG,
  GENESIS_PHASE0_RWA_FLAG,
  isGenesisPhase0SurfaceActionable,
  isGenesisPhase0SurfaceLive,
  phase0FlagEnabled,
  resolveGenesisPhase0LaunchProfile,
};

export default genesisPhase0LaunchProfileModule;
