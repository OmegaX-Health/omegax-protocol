// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildCanonicalConsoleState, buildCanonicalConsoleStateFromSnapshot } from "./console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE, type DevnetFixtureWallet } from "./devnet-fixtures";
import type {
  ClaimCaseSnapshot,
  HealthPlanSnapshot,
  PolicySeriesSnapshot,
  ProtocolConsoleSnapshot,
} from "./protocol";

export function formatAmount(value: bigint | number | string | null | undefined): string {
  if (value === null || value === undefined) return "0";
  try {
    return BigInt(value).toLocaleString();
  } catch {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value);
  }
}

export function walletFixtureFor(address?: string | null): DevnetFixtureWallet | null {
  const normalized = (address ?? "").trim();
  if (!normalized) return null;
  return DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.address === normalized) ?? null;
}

export function defaultMemberWalletAddress(): string {
  return (
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "member")?.address
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions[0]?.wallet
    ?? ""
  );
}

type CanonicalUiSource = Pick<
  ProtocolConsoleSnapshot,
  | "allocationPositions"
  | "capitalClasses"
  | "claimCases"
  | "fundingLines"
  | "healthPlans"
  | "liquidityPools"
  | "memberPositions"
  | "obligations"
  | "outcomesBySeries"
  | "planReserveLedgers"
  | "policySeries"
  | "poolClassLedgers"
>;

function fixtureSource(): CanonicalUiSource {
  return {
    allocationPositions: DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions,
    capitalClasses: DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses,
    claimCases: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases,
    fundingLines: DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines,
    healthPlans: DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans,
    liquidityPools: DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools,
    memberPositions: DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions,
    obligations: DEVNET_PROTOCOL_FIXTURE_STATE.obligations,
    outcomesBySeries: DEVNET_PROTOCOL_FIXTURE_STATE.outcomesBySeries,
    planReserveLedgers: DEVNET_PROTOCOL_FIXTURE_STATE.planReserveLedgers,
    policySeries: DEVNET_PROTOCOL_FIXTURE_STATE.policySeries,
    poolClassLedgers: DEVNET_PROTOCOL_FIXTURE_STATE.poolClassLedgers,
  };
}

export function plansForPool(poolAddress?: string | null, source: CanonicalUiSource = fixtureSource()): HealthPlanSnapshot[] {
  const normalized = (poolAddress ?? "").trim();
  if (!normalized) return source.healthPlans;

  const planIds = new Set(
    source.allocationPositions
      .filter((allocation) => allocation.liquidityPool === normalized)
      .map((allocation) => allocation.healthPlan),
  );

  return source.healthPlans.filter((plan) => planIds.has(plan.address));
}

export function seriesForPlan(planAddress?: string | null, source: CanonicalUiSource = fixtureSource()): PolicySeriesSnapshot[] {
  const normalized = (planAddress ?? "").trim();
  if (!normalized) return source.policySeries;
  return source.policySeries.filter((series) => series.healthPlan === normalized);
}

export function seriesForPool(poolAddress?: string | null, source: CanonicalUiSource = fixtureSource()): PolicySeriesSnapshot[] {
  const normalized = (poolAddress ?? "").trim();
  if (!normalized) return source.policySeries;

  const seriesIds = new Set(
    source.allocationPositions
      .filter((allocation) => allocation.liquidityPool === normalized)
      .map((allocation) => allocation.policySeries)
      .filter((seriesAddress): seriesAddress is string => Boolean(seriesAddress)),
  );

  return source.policySeries.filter((series) => seriesIds.has(series.address));
}

export function claimCasesForOracleContext(
  poolAddress?: string | null,
  seriesAddress?: string | null,
  source: CanonicalUiSource = fixtureSource(),
): ClaimCaseSnapshot[] {
  const normalizedPool = (poolAddress ?? "").trim();
  const normalizedSeries = (seriesAddress ?? "").trim();

  if (normalizedSeries) {
    if (normalizedPool) {
      const boundSeriesAddresses = new Set(seriesForPool(normalizedPool, source).map((series) => series.address));
      if (!boundSeriesAddresses.has(normalizedSeries)) return [];
    }

    return source.claimCases.filter((claim) => claim.policySeries === normalizedSeries);
  }

  if (!normalizedPool) return source.claimCases;

  const boundSeriesAddresses = new Set(seriesForPool(normalizedPool, source).map((series) => series.address));
  if (boundSeriesAddresses.size === 0) return [];

  return source.claimCases.filter((claim) =>
    claim.policySeries ? boundSeriesAddresses.has(claim.policySeries) : false,
  );
}

export function poolAddressForSeries(
  seriesAddress?: string | null,
  source: CanonicalUiSource = fixtureSource(),
): string | null {
  const normalized = (seriesAddress ?? "").trim();
  if (!normalized) return null;
  return (
    source.allocationPositions.find((allocation) => allocation.policySeries === normalized)
      ?.liquidityPool
    ?? null
  );
}

export function claimsForPool(poolAddress?: string | null, source: CanonicalUiSource = fixtureSource()) {
  const normalized = (poolAddress ?? "").trim();
  if (!normalized) return source.claimCases;

  const obligations = new Set(
    source.obligations
      .filter((obligation) => obligation.liquidityPool === normalized)
      .map((obligation) => obligation.address),
  );

  return source.claimCases.filter((claim) =>
    claim.linkedObligation ? obligations.has(claim.linkedObligation) : false,
  );
}

export function obligationsForPool(poolAddress?: string | null, source: CanonicalUiSource = fixtureSource()) {
  const normalized = (poolAddress ?? "").trim();
  if (!normalized) return source.obligations;
  return source.obligations.filter((obligation) => obligation.liquidityPool === normalized);
}

export function walletReadModel(address?: string | null, source?: CanonicalUiSource) {
  const normalized = (address ?? "").trim();
  const consoleState = source ? buildCanonicalConsoleStateFromSnapshot(source) : buildCanonicalConsoleState();
  if (!normalized) return null;
  return consoleState.members.find((member) => member.wallet === normalized) ?? null;
}

export function seriesOutcomeCount(seriesAddress?: string | null, source: CanonicalUiSource = fixtureSource()): bigint {
  if (!seriesAddress) return 0n;
  const outcome = source.outcomesBySeries[seriesAddress];
  return outcome ?? 0n;
}
