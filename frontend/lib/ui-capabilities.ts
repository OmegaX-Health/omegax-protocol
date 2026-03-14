// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  MembershipSummary,
  OracleSummary,
  OutcomeAggregateSummary,
  PoolSummary,
  ProtocolReadiness,
} from "@/lib/protocol";

export type PoolWorkspaceSection =
  | "members"
  | "claims"
  | "coverage"
  | "liquidity"
  | "oracle"
  | "settings";

export const POOL_WORKSPACE_SECTIONS: ReadonlyArray<PoolWorkspaceSection> = [
  "members",
  "claims",
  "coverage",
  "liquidity",
  "oracle",
  "settings",
];

export type WalletCapabilities = {
  isConnected: boolean;
  isPoolAuthority: boolean;
  isRegisteredMember: boolean;
  isRegisteredOracle: boolean;
  canCreatePool: boolean;
  canSubmitClaims: boolean;
  canSettleCoverage: boolean;
  canManageOracleStaking: boolean;
};

export type PoolActionQueueItem = {
  id: string;
  title: string;
  detail: string;
  section: PoolWorkspaceSection;
  priority: "high" | "medium" | "low";
};

export type PoolDashboardSnapshot = {
  membersActive: number;
  claimsPending: number;
  readinessChecksPassing: number;
  readinessChecksTotal: number;
  riskFlags: string[];
  queue: PoolActionQueueItem[];
};

export function parseWorkspaceSection(value: string | null | undefined): PoolWorkspaceSection {
  const normalized = (value || "").trim().toLowerCase();
  return (POOL_WORKSPACE_SECTIONS.find((section) => section === normalized) ?? "members") as PoolWorkspaceSection;
}

type WalletCapabilityInput = {
  walletAddress: string | null;
  pool: PoolSummary | null;
  walletMembership: MembershipSummary | null;
  walletOracle: OracleSummary | null;
};

export function deriveWalletCapabilities(input: WalletCapabilityInput): WalletCapabilities {
  const isConnected = Boolean(input.walletAddress);
  const normalizedWallet = input.walletAddress?.trim() ?? "";

  const isPoolAuthority = Boolean(
    normalizedWallet
      && input.pool
      && normalizedWallet === input.pool.authority,
  );
  const isRegisteredMember = Boolean(input.walletMembership);
  const isRegisteredOracle = Boolean(input.walletOracle);

  return {
    isConnected,
    isPoolAuthority,
    isRegisteredMember,
    isRegisteredOracle,
    canCreatePool: isConnected,
    canSubmitClaims: isConnected && isRegisteredMember,
    canSettleCoverage: isPoolAuthority,
    canManageOracleStaking: isConnected && isRegisteredOracle,
  };
}

type DashboardSnapshotInput = {
  readiness: ProtocolReadiness | null;
  activeMemberships: MembershipSummary[];
  finalizedAggregates: OutcomeAggregateSummary[];
  capabilities: WalletCapabilities;
};

export function buildPoolDashboardSnapshot(input: DashboardSnapshotInput): PoolDashboardSnapshot {
  const membersActive = input.activeMemberships.length;
  const claimsPending = input.finalizedAggregates.filter((row) => row.passed && !row.claimed).length;

  const readinessRows = input.readiness
    ? [
        input.readiness.poolExists,
        input.readiness.poolTermsConfigured,
        input.readiness.poolOraclePolicyConfigured,
        input.readiness.poolAssetVaultConfigured,
        input.readiness.coveragePolicyExists,
        input.readiness.premiumLedgerTracked,
      ]
    : [];
  const readinessChecksPassing = readinessRows.filter(Boolean).length;
  const readinessChecksTotal = readinessRows.length;

  const riskFlags: string[] = [];
  if (!input.readiness?.poolOraclePolicyConfigured) {
    riskFlags.push("Oracle policy is not configured.");
  }
  if (!input.readiness?.poolTermsConfigured) {
    riskFlags.push("Plan terms are not configured.");
  }
  if (claimsPending > 0 && !input.capabilities.canSubmitClaims) {
    riskFlags.push("Claims are pending but connected wallet cannot submit claims.");
  }
  if (!input.capabilities.isConnected) {
    riskFlags.push("Connect wallet for operational actions.");
  }

  const queue: PoolActionQueueItem[] = [];

  if (!input.readiness?.poolOraclePolicyConfigured) {
    queue.push({
      id: "configure-policy",
      title: "Configure oracle policy",
      detail: "Plan policy/rule setup is incomplete.",
      section: "settings",
      priority: "high",
    });
  }

  if (claimsPending > 0) {
    queue.push({
      id: "pending-claims",
      title: "Process pending claims",
      detail: `${claimsPending} passed aggregates are unclaimed.`,
      section: "claims",
      priority: "high",
    });
  }

  if (membersActive === 0) {
    queue.push({
      id: "no-members",
      title: "Enroll first member",
      detail: "No active memberships were found for this pool.",
      section: "members",
      priority: "medium",
    });
  }

  return {
    membersActive,
    claimsPending,
    readinessChecksPassing,
    readinessChecksTotal,
    riskFlags,
    queue,
  };
}
