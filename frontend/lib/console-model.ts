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

function planLedgerFor(plan: HealthPlanSnapshot) {
  const assetMint = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find(
    (line) => line.healthPlan === plan.address,
  )?.assetMint;
  if (!assetMint) return undefined;
  const address = derivePlanReserveLedgerPda({
    healthPlan: plan.address,
    assetMint,
  }).toBase58();
  return DEVNET_PROTOCOL_FIXTURE_STATE.planReserveLedgers.find((ledger) => ledger.address === address)?.sheet;
}

function sponsorViews(): SponsorReadModel[] {
  return DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.map((plan) =>
    buildSponsorReadModel({
      healthPlan: plan,
      policySeries: DEVNET_PROTOCOL_FIXTURE_STATE.policySeries,
      fundingLines: DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines,
      obligations: DEVNET_PROTOCOL_FIXTURE_STATE.obligations,
      claimCases: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases,
      planLedger: planLedgerFor(plan),
      outcomesBySeries: DEVNET_PROTOCOL_FIXTURE_STATE.outcomesBySeries,
    }),
  );
}

function capitalViews(): CapitalReadModel[] {
  return DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.map((pool) =>
    buildCapitalReadModel({
      liquidityPool: pool,
      capitalClasses: DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses,
      classLedgers: DEVNET_PROTOCOL_FIXTURE_STATE.poolClassLedgers,
      allocations: DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions,
    }),
  );
}

function memberViews(): MemberReadModel[] {
  const uniqueWallets = new Set(DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.map((position) => position.wallet));
  return [...uniqueWallets].map((wallet) =>
    buildMemberReadModel({
      wallet,
      memberPositions: DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions,
      obligations: DEVNET_PROTOCOL_FIXTURE_STATE.obligations,
      claimCases: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases,
    }),
  );
}

export function buildCanonicalConsoleState(): CanonicalConsoleState {
  return {
    sponsors: sponsorViews(),
    capital: capitalViews(),
    members: memberViews(),
    activeClaims: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => isActiveClaimStatus(claim.intakeStatus)),
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

export function sponsorLabel(model: SponsorReadModel): string {
  return `${model.planId} · ${shortenAddress(model.healthPlanAddress)}`;
}

export function poolLabel(pool: LiquidityPoolSnapshot): string {
  return `${pool.poolId} · ${shortenAddress(pool.address)}`;
}
