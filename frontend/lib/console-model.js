// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildCapitalReadModel, buildMemberReadModel, buildSponsorReadModel, CLAIM_INTAKE_SETTLED, derivePlanReserveLedgerPda, shortenAddress, } from "./protocol";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "./devnet-fixtures";
function planLedgerFor(plan) {
    const assetMint = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find((line) => line.healthPlan === plan.address)?.assetMint;
    if (!assetMint)
        return undefined;
    const address = derivePlanReserveLedgerPda({
        healthPlan: plan.address,
        assetMint,
    }).toBase58();
    return DEVNET_PROTOCOL_FIXTURE_STATE.planReserveLedgers.find((ledger) => ledger.address === address)?.sheet;
}
function sponsorViews() {
    return DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.map((plan) => buildSponsorReadModel({
        healthPlan: plan,
        policySeries: DEVNET_PROTOCOL_FIXTURE_STATE.policySeries,
        fundingLines: DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines,
        obligations: DEVNET_PROTOCOL_FIXTURE_STATE.obligations,
        claimCases: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases,
        planLedger: planLedgerFor(plan),
        outcomesBySeries: DEVNET_PROTOCOL_FIXTURE_STATE.outcomesBySeries,
    }));
}
function capitalViews() {
    return DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.map((pool) => buildCapitalReadModel({
        liquidityPool: pool,
        capitalClasses: DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses,
        classLedgers: DEVNET_PROTOCOL_FIXTURE_STATE.poolClassLedgers,
        allocations: DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions,
    }));
}
function memberViews() {
    const uniqueWallets = new Set(DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.map((position) => position.wallet));
    return [...uniqueWallets].map((wallet) => buildMemberReadModel({
        wallet,
        memberPositions: DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions,
        obligations: DEVNET_PROTOCOL_FIXTURE_STATE.obligations,
        claimCases: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases,
    }));
}
export function buildCanonicalConsoleState() {
    return {
        sponsors: sponsorViews(),
        capital: capitalViews(),
        members: memberViews(),
        activeClaims: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => claim.intakeStatus !== CLAIM_INTAKE_SETTLED),
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
export function sponsorLabel(model) {
    return `${model.planId} · ${shortenAddress(model.healthPlanAddress)}`;
}
export function poolLabel(pool) {
    return `${pool.poolId} · ${shortenAddress(pool.address)}`;
}
