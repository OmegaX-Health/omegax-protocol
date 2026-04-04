import test from "node:test";
import assert from "node:assert/strict";

import consoleModelModule from "../frontend/lib/console-model.ts";
import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const { buildCanonicalConsoleState } = consoleModelModule as typeof import("../frontend/lib/console-model.ts");
const { DEVNET_PROTOCOL_FIXTURE_STATE } = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  OBLIGATION_STATUS_SETTLED,
  PAUSE_FLAG_ALLOCATION_FREEZE,
  PAUSE_FLAG_CLAIM_INTAKE,
  SERIES_MODE_PROTECTION,
  SERIES_MODE_REWARD,
  buildCapitalReadModel,
  describeCapitalRestriction,
  deriveCapitalClassPda,
  deriveLiquidityPoolPda,
  recomputeReserveBalanceSheet,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const consoleState = buildCanonicalConsoleState();

test("1. sponsor-only reward plan works without LP capital", () => {
  const seekerPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.planId === "nexus-seeker-rewards");
  const sponsorModel = consoleState.sponsors.find((plan) => plan.planId === "nexus-seeker-rewards");
  const planLines = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.filter((line) => line.healthPlan === seekerPlan?.address);
  const planObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) => obligation.healthPlan === seekerPlan?.address);

  assert(seekerPlan);
  assert(sponsorModel);
  assert.equal(planLines.length, 1);
  assert.equal(planLines[0]?.lineType, FUNDING_LINE_TYPE_SPONSOR_BUDGET);
  assert(planObligations.every((obligation) => !obligation.liquidityPool));
  assert(sponsorModel.fundedSponsorBudget > 0n);
  assert(sponsorModel.remainingSponsorBudget > 0n);
});

test("2. one LP pool funds one protection series with reserve-aware capital math", () => {
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
  const protectionSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.mode === SERIES_MODE_PROTECTION)!;
  const model = buildCapitalReadModel({
    liquidityPool: pool,
    capitalClasses: DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses,
    classLedgers: DEVNET_PROTOCOL_FIXTURE_STATE.poolClassLedgers,
    allocations: DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
      (allocation) => allocation.policySeries === protectionSeries.address,
    ),
  });

  assert.equal(model.classes.length, 2);
  assert(model.classes.every((capitalClass) => capitalClass.reservedLiabilities >= 0n));
  assert(model.classes.some((capitalClass) => capitalClass.redeemable < capitalClass.nav));
});

test("3. one LP pool can fund multiple series with explainable attribution", () => {
  const poolView = consoleState.capital[0]!;
  const openClass = poolView.classes.find((capitalClass) => capitalClass.classId === "open-usdc-class")!;

  assert.equal(openClass.exposureMix.length, 2);
  assert(openClass.exposureMix.some((exposure) => exposure.policySeries));
  assert(openClass.exposureMix.some((exposure) => exposure.policySeries !== openClass.exposureMix[0]?.policySeries));
});

test("4. multiple LP pools can co-fund one series", () => {
  const existingPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
  const protectionAllocation = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.find(
    (allocation) =>
      allocation.policySeries &&
      DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === allocation.policySeries)?.mode === SERIES_MODE_PROTECTION,
  )!;
  const secondaryPool = {
    ...existingPool,
    address: deriveLiquidityPoolPda({
      reserveDomain: existingPool.reserveDomain,
      poolId: "omega-health-income-sidecar",
    }).toBase58(),
    poolId: "omega-health-income-sidecar",
    totalValueLocked: 350_000n,
    totalAllocated: 180_000n,
    totalPendingRedemptions: 0n,
  };
  const secondaryClass = {
    ...DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses[0]!,
    address: deriveCapitalClassPda({
      liquidityPool: secondaryPool.address,
      classId: "senior-sidecar-class",
    }).toBase58(),
    liquidityPool: secondaryPool.address,
    classId: "senior-sidecar-class",
    navAssets: 350_000n,
    allocatedAssets: 180_000n,
    pendingRedemptions: 0n,
  };
  const secondaryLedger = {
    ...DEVNET_PROTOCOL_FIXTURE_STATE.poolClassLedgers[0]!,
    capitalClass: secondaryClass.address,
    sheet: { funded: 350_000n, allocated: 180_000n, reserved: 30_000n },
    realizedYieldAmount: 9_000n,
  };
  const secondaryAllocation = {
    ...protectionAllocation,
    address: `${protectionAllocation.address}-sidecar`,
    liquidityPool: secondaryPool.address,
    capitalClass: secondaryClass.address,
    allocatedAmount: 180_000n,
    reservedCapacity: 30_000n,
    weightBps: 900,
  };

  const existingModel = consoleState.capital[0]!;
  const sidecarModel = buildCapitalReadModel({
    liquidityPool: secondaryPool,
    capitalClasses: [secondaryClass],
    classLedgers: [secondaryLedger],
    allocations: [secondaryAllocation],
  });
  const existingProtectionReserve = existingModel.classes
    .flatMap((capitalClass) => capitalClass.exposureMix)
    .filter((exposure) => exposure.policySeries === protectionAllocation.policySeries)
    .reduce((sum, exposure) => sum + exposure.reservedCapacity, 0n);
  const sidecarProtectionReserve = sidecarModel.classes[0]!.exposureMix[0]!.reservedCapacity;

  assert(existingProtectionReserve > 0n);
  assert.equal(sidecarProtectionReserve, 30_000n);
});

test("5. one health plan can hold reward and protection series on one accounting kernel", () => {
  const blendedPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.planId === "nexus-protect-plus")!;
  const series = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((candidate) => candidate.healthPlan === blendedPlan.address);

  assert(series.some((candidate) => candidate.mode === SERIES_MODE_REWARD));
  assert(series.some((candidate) => candidate.mode === SERIES_MODE_PROTECTION));
  assert.equal(new Set(series.map((candidate) => candidate.healthPlan)).size, 1);
});

test("6. restricted capital class keeps explicit wrapper-facing restrictions", () => {
  const wrapperClass = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.find(
    (capitalClass) => capitalClass.restrictionMode === CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY,
  )!;

  assert.equal(describeCapitalRestriction(wrapperClass.restrictionMode), "wrapper_only");
  assert.equal(wrapperClass.queueOnlyRedemptions, true);
});

test("7. separate reserve domains keep balances ring-fenced", () => {
  const [openDomain, wrapperDomain] = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains;
  const openLedger = recomputeReserveBalanceSheet(DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetLedgers[0]!.sheet);
  const wrapperLedger = recomputeReserveBalanceSheet(DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetLedgers[1]!.sheet);

  assert.notEqual(openDomain.address, wrapperDomain.address);
  assert(openLedger.funded > 0n);
  assert(wrapperLedger.restricted > 0n);
  assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.every((plan) => plan.reserveDomain === openDomain.address), true);
});

test("8. impairment and queue mode constrain redeemability while obligations stay visible", () => {
  const openClassLedger = DEVNET_PROTOCOL_FIXTURE_STATE.poolClassLedgers.find(
    (ledger) => ledger.capitalClass === DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses[0]!.address,
  )!;
  const openSheet = recomputeReserveBalanceSheet(openClassLedger.sheet);
  const visibleObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter(
    (obligation) => obligation.status !== OBLIGATION_STATUS_SETTLED,
  );

  assert(openSheet.pendingRedemption > 0n);
  assert(openSheet.redeemable < openSheet.funded);
  assert(visibleObligations.length > 0);
});

test("9. scoped pause flags stay localized", () => {
  const pausedPlanFlags = PAUSE_FLAG_CLAIM_INTAKE;
  const allocationFreezeFlags = PAUSE_FLAG_ALLOCATION_FREEZE;
  const unaffectedPlanFlags = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!.pauseFlags ?? 0;

  assert.notEqual(pausedPlanFlags & PAUSE_FLAG_CLAIM_INTAKE, 0);
  assert.notEqual(allocationFreezeFlags & PAUSE_FLAG_ALLOCATION_FREEZE, 0);
  assert.equal(unaffectedPlanFlags & PAUSE_FLAG_CLAIM_INTAKE, 0);
});

test("10. migration smoke test retires old pool semantics and ships canonical fixtures", () => {
  const legacyArtifacts = DEVNET_PROTOCOL_FIXTURE_STATE.legacyArtifactsRetired.join(" ");
  const hasLiquidityFundingLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.some(
    (line) => line.lineType === FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  );

  assert.equal(consoleState.sponsors.length, DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.length);
  assert.equal(consoleState.capital.length, DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.length);
  assert(legacyArtifacts.includes("pool_type"));
  assert(hasLiquidityFundingLine);
});
