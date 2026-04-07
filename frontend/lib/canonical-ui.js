// SPDX-License-Identifier: AGPL-3.0-or-later
import { buildCanonicalConsoleState } from "./console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "./devnet-fixtures";
export function formatAmount(value) {
    if (value === null || value === undefined)
        return "0";
    try {
        return BigInt(value).toLocaleString();
    }
    catch {
        const parsed = Number.parseFloat(String(value));
        return Number.isFinite(parsed) ? parsed.toLocaleString() : String(value);
    }
}
export function walletFixtureFor(address) {
    const normalized = (address ?? "").trim();
    if (!normalized)
        return null;
    return DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.address === normalized) ?? null;
}
export function defaultMemberWalletAddress() {
    return (DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "member")?.address
        ?? DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions[0]?.wallet
        ?? "");
}
export function plansForPool(poolAddress) {
    const normalized = (poolAddress ?? "").trim();
    if (!normalized)
        return DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans;
    const planIds = new Set(DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions
        .filter((allocation) => allocation.liquidityPool === normalized)
        .map((allocation) => allocation.healthPlan));
    return DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.filter((plan) => planIds.has(plan.address));
}
export function seriesForPlan(planAddress) {
    const normalized = (planAddress ?? "").trim();
    if (!normalized)
        return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries;
    return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => series.healthPlan === normalized);
}
export function seriesForPool(poolAddress) {
    const normalized = (poolAddress ?? "").trim();
    if (!normalized)
        return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries;
    const seriesIds = new Set(DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions
        .filter((allocation) => allocation.liquidityPool === normalized)
        .map((allocation) => allocation.policySeries)
        .filter((seriesAddress) => Boolean(seriesAddress)));
    return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => seriesIds.has(series.address));
}
export function claimCasesForOracleContext(poolAddress, seriesAddress) {
    const normalizedPool = (poolAddress ?? "").trim();
    const normalizedSeries = (seriesAddress ?? "").trim();
    if (normalizedSeries) {
        if (normalizedPool) {
            const boundSeriesAddresses = new Set(seriesForPool(normalizedPool).map((series) => series.address));
            if (!boundSeriesAddresses.has(normalizedSeries))
                return [];
        }
        return DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => claim.policySeries === normalizedSeries);
    }
    if (!normalizedPool)
        return DEVNET_PROTOCOL_FIXTURE_STATE.claimCases;
    const boundSeriesAddresses = new Set(seriesForPool(normalizedPool).map((series) => series.address));
    if (boundSeriesAddresses.size === 0)
        return [];
    return DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => claim.policySeries ? boundSeriesAddresses.has(claim.policySeries) : false);
}
export function poolAddressForSeries(seriesAddress) {
    const normalized = (seriesAddress ?? "").trim();
    if (!normalized)
        return null;
    return (DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.find((allocation) => allocation.policySeries === normalized)
        ?.liquidityPool
        ?? null);
}
export function claimsForPool(poolAddress) {
    const normalized = (poolAddress ?? "").trim();
    if (!normalized)
        return DEVNET_PROTOCOL_FIXTURE_STATE.claimCases;
    const obligations = new Set(DEVNET_PROTOCOL_FIXTURE_STATE.obligations
        .filter((obligation) => obligation.liquidityPool === normalized)
        .map((obligation) => obligation.address));
    return DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => claim.linkedObligation ? obligations.has(claim.linkedObligation) : false);
}
export function obligationsForPool(poolAddress) {
    const normalized = (poolAddress ?? "").trim();
    if (!normalized)
        return DEVNET_PROTOCOL_FIXTURE_STATE.obligations;
    return DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) => obligation.liquidityPool === normalized);
}
export function walletReadModel(address) {
    const normalized = (address ?? "").trim();
    const consoleState = buildCanonicalConsoleState();
    if (!normalized)
        return null;
    return consoleState.members.find((member) => member.wallet === normalized) ?? null;
}
export function seriesOutcomeCount(seriesAddress) {
    if (!seriesAddress)
        return 0n;
    const outcome = DEVNET_PROTOCOL_FIXTURE_STATE.outcomesBySeries[seriesAddress];
    return outcome ?? 0n;
}
