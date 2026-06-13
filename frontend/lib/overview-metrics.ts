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
  toBigIntAmount,
  type ClaimCaseSnapshot,
  type HealthPlanSnapshot,
  type ObligationSnapshot,
  type PolicySeriesSnapshot,
  type ProtocolConsoleSnapshot,
  type ReserveDomainSnapshot,
} from "@/lib/protocol";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";

export type OverviewStatsSource = Pick<
  ProtocolConsoleSnapshot,
  | "claimCases"
  | "healthPlans"
  | "obligations"
  | "policySeries"
  | "reserveDomains"
>;

export type OverviewStats = {
  planCount: number;
  seriesCount: number;
  domainCount: number;
  obligationCount: number;
  seriesModes: Record<string, number>;
  seriesStatuses: Record<string, number>;
  obligationStatuses: Record<string, number>;
  totalObligationPrincipal: bigint;
  totalReservedAmount: bigint;
  claimStatuses: Record<string, number>;
  totalApprovedAmount: bigint;
  activeClaimCount: number;
  approvedClaimCount: number;
  reservedObligationCount: number;
  plans: Array<{
    name: string;
    sponsor: string;
  }>;
};

export const EMPTY_OVERVIEW_STATS_SOURCE: OverviewStatsSource = {
  claimCases: [] as ClaimCaseSnapshot[],
  healthPlans: [] as HealthPlanSnapshot[],
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

export function buildOverviewStats(source: OverviewStatsSource): OverviewStats {
  const plans = source.healthPlans;
  const series = source.policySeries;
  const obligations = source.obligations;
  const claims = source.claimCases;

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
  const reservedObligationCount = obligations.filter((obligation) =>
    obligation.status === OBLIGATION_STATUS_RESERVED || obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  ).length;

  return {
    planCount: plans.length,
    seriesCount: series.length,
    domainCount: source.reserveDomains.length,
    obligationCount: obligations.length,
    seriesModes,
    seriesStatuses,
    obligationStatuses,
    totalObligationPrincipal,
    totalReservedAmount,
    claimStatuses,
    totalApprovedAmount,
    activeClaimCount,
    approvedClaimCount,
    reservedObligationCount,
    plans: plans.map((plan) => ({ name: plan.displayName, sponsor: plan.sponsorLabel })),
  };
}
