// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  buildCapitalReadModel,
  buildMemberReadModel,
  buildSponsorReadModel,
  derivePlanReserveLedgerPda,
  isActiveClaimStatus,
  shortenAddress,
  type CapitalReadModel,
  type ClaimCaseSnapshot,
  type HealthPlanSnapshot,
  type LiquidityPoolSnapshot,
  type MemberReadModel,
  type ProtocolConsoleSnapshot,
  type SponsorReadModel,
} from "./protocol";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "./devnet-fixtures";

export type ConsoleGlossaryRow = {
  noun: string;
  meaning: string;
};

export type CanonicalConsoleState = {
  sponsors: SponsorReadModel[];
  capital: CapitalReadModel[];
  members: MemberReadModel[];
  activeClaims: ClaimCaseSnapshot[];
  glossary: ConsoleGlossaryRow[];
};

type CanonicalConsoleSource = Pick<
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

function fixtureConsoleSource(): CanonicalConsoleSource {
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

function planLedgerFor(plan: HealthPlanSnapshot, source: CanonicalConsoleSource) {
  const assetMint = source.fundingLines.find(
    (line) => line.healthPlan === plan.address,
  )?.assetMint;
  if (!assetMint) return undefined;
  const address = derivePlanReserveLedgerPda({
    healthPlan: plan.address,
    assetMint,
  }).toBase58();
  return source.planReserveLedgers.find((ledger) => ledger.address === address)?.sheet;
}

function sponsorViews(source: CanonicalConsoleSource): SponsorReadModel[] {
  return source.healthPlans.map((plan) =>
    buildSponsorReadModel({
      healthPlan: plan,
      policySeries: source.policySeries,
      fundingLines: source.fundingLines,
      obligations: source.obligations,
      claimCases: source.claimCases,
      planLedger: planLedgerFor(plan, source),
      outcomesBySeries: source.outcomesBySeries,
    }),
  );
}

function capitalViews(source: CanonicalConsoleSource): CapitalReadModel[] {
  return source.liquidityPools.map((pool) =>
    buildCapitalReadModel({
      liquidityPool: pool,
      capitalClasses: source.capitalClasses,
      classLedgers: source.poolClassLedgers,
      allocations: source.allocationPositions,
    }),
  );
}

function memberViews(source: CanonicalConsoleSource): MemberReadModel[] {
  const uniqueWallets = new Set(source.memberPositions.map((position) => position.wallet));
  return [...uniqueWallets].map((wallet) =>
    buildMemberReadModel({
      wallet,
      memberPositions: source.memberPositions,
      obligations: source.obligations,
      claimCases: source.claimCases,
    }),
  );
}

export function buildCanonicalConsoleStateFromSnapshot(source: CanonicalConsoleSource): CanonicalConsoleState {
  return {
    sponsors: sponsorViews(source),
    capital: capitalViews(source),
    members: memberViews(source),
    activeClaims: source.claimCases.filter((claim) => isActiveClaimStatus(claim.intakeStatus)),
    glossary: [
      { noun: "ReserveDomain", meaning: "Hard custody, settlement, and legal segregation boundary." },
      { noun: "HealthPlan", meaning: "Sponsor/member/liability root for a public program." },
      { noun: "PolicySeries", meaning: "Versioned product lane with explicit reward or protection semantics." },
      { noun: "FundingLine", meaning: "Plan-side money source, distinct from investor capital rights." },
      { noun: "LiquidityPool", meaning: "LP-facing capital sleeve that can fund multiple plans and series." },
      { noun: "CapitalClass", meaning: "Investor instrument with its own restrictions, redemption terms, and waterfall." },
      { noun: "AllocationPosition", meaning: "Explicit bridge from a capital class into a funding line." },
      { noun: "Obligation", meaning: "Canonical liability unit from accrual through reserve, payout, settlement, or impairment." },
    ],
  };
}

export function buildCanonicalConsoleState(): CanonicalConsoleState {
  return buildCanonicalConsoleStateFromSnapshot(fixtureConsoleSource());
}

export function sponsorLabel(model: SponsorReadModel): string {
  return `${model.planId} · ${shortenAddress(model.healthPlanAddress)}`;
}

export function poolLabel(pool: LiquidityPoolSnapshot): string {
  return `${pool.poolId} · ${shortenAddress(pool.address)}`;
}
