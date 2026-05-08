// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CLAIM_INTAKE_APPROVED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RESERVED,
  describeClaimStatus,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  isActiveClaimStatus,
  REDEMPTION_POLICY_QUEUE_ONLY,
  hasPendingRedemptionQueue,
  toBigIntAmount,
  type CapitalClassSnapshot,
  type ClaimCaseSnapshot,
  type AllocationPositionSnapshot,
  type HealthPlanSnapshot,
  type LiquidityPoolSnapshot,
  type LPPositionSnapshot,
  type MemberPositionSnapshot,
  type ObligationSnapshot,
  type PolicySeriesSnapshot,
  type ProtocolConsoleSnapshot,
  type ReserveDomainSnapshot,
} from "@/lib/protocol";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";

export type OverviewStatsSource = Pick<
  ProtocolConsoleSnapshot,
  | "capitalClasses"
  | "claimCases"
  | "healthPlans"
  | "liquidityPools"
  | "lpPositions"
  | "memberPositions"
  | "obligations"
  | "policySeries"
  | "reserveDomains"
> & {
  oracleProfiles?: ProtocolConsoleSnapshot["oracleProfiles"];
  allocationPositions?: AllocationPositionSnapshot[];
  wallets?: ReadonlyArray<{ role?: string | null }>;
};

export type OverviewStats = {
  tvl: bigint;
  allocated: bigint;
  available: bigint;
  utilization: number;
  pendingRedemptions: bigint;
  poolCount: number;
  classCount: number;
  planCount: number;
  seriesCount: number;
  domainCount: number;
  oracleCount: number;
  obligationCount: number;
  memberCount: number;
  seriesModes: Record<string, number>;
  seriesStatuses: Record<string, number>;
  obligationStatuses: Record<string, number>;
  totalObligationPrincipal: bigint;
  totalReservedAmount: bigint;
  claimStatuses: Record<string, number>;
  totalApprovedAmount: bigint;
  activeClaimCount: number;
  approvedClaimCount: number;
  pendingRedemptionCount: number;
  reservedObligationCount: number;
  queueOnlyPoolCount: number;
  classBreakdown: Array<{
    name: string;
    nav: bigint;
    allocated: bigint;
    shares: bigint;
    priority: number;
  }>;
  plans: Array<{
    name: string;
    sponsor: string;
  }>;
};

export const EMPTY_OVERVIEW_STATS_SOURCE: OverviewStatsSource = {
  capitalClasses: [] as CapitalClassSnapshot[],
  claimCases: [] as ClaimCaseSnapshot[],
  healthPlans: [] as HealthPlanSnapshot[],
  liquidityPools: [] as LiquidityPoolSnapshot[],
  lpPositions: [] as LPPositionSnapshot[],
  memberPositions: [] as MemberPositionSnapshot[],
  obligations: [] as ObligationSnapshot[],
  policySeries: [] as PolicySeriesSnapshot[],
  reserveDomains: [] as ReserveDomainSnapshot[],
};

export type OverviewStatsMode = "live" | "demo";

export function overviewStatsModeFromDemoFlag(demo: boolean): OverviewStatsMode {
  return demo ? "demo" : "live";
}

export function resolveOverviewStatsSource(params: {
  demo: boolean;
  snapshot: OverviewStatsSource;
}): OverviewStatsSource {
  return params.demo ? DEVNET_PROTOCOL_FIXTURE_STATE : params.snapshot;
}

export function countPendingRedemptionSources(
  source: Pick<ProtocolConsoleSnapshot, "capitalClasses" | "liquidityPools"> & {
    lpPositions?: LPPositionSnapshot[];
  },
): number {
  const pendingPositions = source.lpPositions?.filter(hasPendingRedemptionQueue) ?? [];
  const pendingPositionClassIds = new Set(pendingPositions.map((position) => position.capitalClass));
  const pendingClassIds = new Set<string>();
  const pendingPoolIds = new Set<string>();

  for (const capitalClass of source.capitalClasses) {
    if (toBigIntAmount(capitalClass.pendingRedemptions) <= 0n) continue;
    pendingClassIds.add(capitalClass.address);
    pendingPoolIds.add(capitalClass.liquidityPool);
  }

  let sourceCount = pendingPositions.length;
  for (const capitalClassId of pendingClassIds) {
    if (!pendingPositionClassIds.has(capitalClassId)) {
      sourceCount += 1;
    }
  }

  for (const pool of source.liquidityPools) {
    if (toBigIntAmount(pool.totalPendingRedemptions) <= 0n) continue;
    if (pendingPoolIds.has(pool.address)) continue;
    if (pendingPositions.some((position) => {
      const capitalClass = source.capitalClasses.find((candidate) => candidate.address === position.capitalClass);
      return capitalClass?.liquidityPool === pool.address;
    })) continue;
    sourceCount += 1;
  }

  return sourceCount;
}

function sumPendingRedemptions(source: Pick<ProtocolConsoleSnapshot, "capitalClasses" | "liquidityPools">): bigint {
  const classesByPool = new Map<string, CapitalClassSnapshot[]>();
  for (const capitalClass of source.capitalClasses) {
    const rows = classesByPool.get(capitalClass.liquidityPool) ?? [];
    rows.push(capitalClass);
    classesByPool.set(capitalClass.liquidityPool, rows);
  }

  const seenPools = new Set<string>();
  let total = 0n;
  for (const pool of source.liquidityPools) {
    seenPools.add(pool.address);
    const poolPending = toBigIntAmount(pool.totalPendingRedemptions);
    if (poolPending > 0n) {
      total += poolPending;
      continue;
    }
    total += (classesByPool.get(pool.address) ?? []).reduce(
      (sum, capitalClass) => sum + toBigIntAmount(capitalClass.pendingRedemptions),
      0n,
    );
  }

  for (const capitalClass of source.capitalClasses) {
    if (seenPools.has(capitalClass.liquidityPool)) continue;
    total += toBigIntAmount(capitalClass.pendingRedemptions);
  }

  return total;
}

export function buildOverviewStats(source: OverviewStatsSource): OverviewStats {
  const pools = source.liquidityPools;
  const classes = source.capitalClasses;
  const plans = source.healthPlans;
  const series = source.policySeries;
  const obligations = source.obligations;
  const claims = source.claimCases;
  const members = source.memberPositions;

  const tvl = pools.reduce((sum, pool) => sum + toBigIntAmount(pool.totalValueLocked), 0n);
  const allocated = pools.reduce((sum, pool) => sum + toBigIntAmount(pool.totalAllocated), 0n);
  const available = tvl - allocated;
  const utilization = tvl > 0n ? Number((allocated * 100n) / tvl) : 0;
  const pendingRedemptions = sumPendingRedemptions(source);

  const seriesModes: Record<string, number> = {};
  const seriesStatuses: Record<string, number> = {};
  for (const row of series) {
    const mode = describeSeriesMode(row.mode);
    seriesModes[mode] = (seriesModes[mode] || 0) + 1;
    const status = describeSeriesStatus(row.status);
    seriesStatuses[status] = (seriesStatuses[status] || 0) + 1;
  }

  const obligationStatuses: Record<string, number> = {};
  let totalObligationPrincipal = 0n;
  let totalReservedAmount = 0n;
  for (const obligation of obligations) {
    const status = describeObligationStatus(obligation.status);
    obligationStatuses[status] = (obligationStatuses[status] || 0) + 1;
    totalObligationPrincipal += toBigIntAmount(obligation.principalAmount);
    totalReservedAmount += toBigIntAmount(obligation.reservedAmount);
  }

  const claimStatuses: Record<string, number> = {};
  let totalApprovedAmount = 0n;
  for (const claim of claims) {
    const status = describeClaimStatus(claim.intakeStatus);
    claimStatuses[status] = (claimStatuses[status] || 0) + 1;
    totalApprovedAmount += toBigIntAmount(claim.approvedAmount);
  }
  const activeClaimCount = claims.filter((claim) => isActiveClaimStatus(claim.intakeStatus)).length;
  const approvedClaimCount = claims.filter((claim) => claim.intakeStatus === CLAIM_INTAKE_APPROVED).length;
  const pendingRedemptionCount = countPendingRedemptionSources(source);
  const reservedObligationCount = obligations.filter((obligation) =>
    obligation.status === OBLIGATION_STATUS_RESERVED || obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  ).length;
  const queueOnlyPoolCount = pools.filter((pool) => pool.redemptionPolicy === REDEMPTION_POLICY_QUEUE_ONLY).length;

  const classBreakdown = classes.map((capitalClass) => ({
    name: capitalClass.displayName,
    nav: toBigIntAmount(capitalClass.navAssets),
    allocated: toBigIntAmount(capitalClass.allocatedAssets),
    shares: toBigIntAmount(capitalClass.totalShares),
    priority: capitalClass.priority,
  }));

  return {
    tvl,
    allocated,
    available,
    utilization,
    pendingRedemptions,
    poolCount: pools.length,
    classCount: classes.length,
    planCount: plans.length,
    seriesCount: series.length,
    domainCount: source.reserveDomains.length,
    oracleCount: source.oracleProfiles?.length
      ?? source.wallets?.filter((wallet) => wallet.role === "oracle_operator").length
      ?? 0,
    obligationCount: obligations.length,
    memberCount: members.length,
    seriesModes,
    seriesStatuses,
    obligationStatuses,
    totalObligationPrincipal,
    totalReservedAmount,
    claimStatuses,
    totalApprovedAmount,
    activeClaimCount,
    approvedClaimCount,
    pendingRedemptionCount,
    reservedObligationCount,
    queueOnlyPoolCount,
    classBreakdown,
    plans: plans.map((plan) => ({ name: plan.displayName, sponsor: plan.sponsorLabel })),
  };
}
