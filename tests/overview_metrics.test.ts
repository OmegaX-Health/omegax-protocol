import assert from "node:assert/strict";
import test from "node:test";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import overviewMetricsModule from "../frontend/lib/overview-metrics.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  EMPTY_OVERVIEW_STATS_SOURCE,
  buildOverviewStats,
  countPendingRedemptionSources,
  resolveOverviewStatsSource,
} = overviewMetricsModule as typeof import("../frontend/lib/overview-metrics.ts");

test("overview metrics use the live snapshot source without fixture fallback", () => {
  const source = resolveOverviewStatsSource({
    demo: false,
    snapshot: EMPTY_OVERVIEW_STATS_SOURCE,
  });
  const stats = buildOverviewStats(source);

  assert.equal(source, EMPTY_OVERVIEW_STATS_SOURCE);
  assert.equal(stats.planCount, 0);
  assert.equal(stats.seriesCount, 0);
  assert.equal(stats.tvl, 0n);
});

test("overview metrics use fixture values only when demo mode is explicit", () => {
  const source = resolveOverviewStatsSource({
    demo: true,
    snapshot: EMPTY_OVERVIEW_STATS_SOURCE,
  });
  const stats = buildOverviewStats(source);

  assert.equal(source, DEVNET_PROTOCOL_FIXTURE_STATE);
  assert.ok(stats.planCount > 0);
  assert.ok(stats.tvl > 0n);
});

test("overview queue metrics count class-ledger redemption sources", () => {
  const source = {
    ...EMPTY_OVERVIEW_STATS_SOURCE,
    liquidityPools: [{
      address: "pool-1",
      poolId: "pool-1",
      displayName: "Pool 1",
      depositAssetMint: "asset-1",
      strategyThesis: "Queue test",
      redemptionPolicy: 1,
      totalValueLocked: 100_000n,
      totalAllocated: 25_000n,
      totalPendingRedemptions: 0n,
      active: true,
    }],
    capitalClasses: [{
      address: "class-1",
      liquidityPool: "pool-1",
      classId: "senior",
      displayName: "Senior",
      priority: 1,
      restrictionMode: 0,
      totalShares: 100_000n,
      navAssets: 100_000n,
      allocatedAssets: 25_000n,
      pendingRedemptions: 25_000n,
      active: true,
    }],
    lpPositions: [],
  };
  const stats = buildOverviewStats(source);

  assert.equal(countPendingRedemptionSources(source), 1);
  assert.equal(stats.pendingRedemptionCount, 1);
  assert.equal(stats.pendingRedemptions, 25_000n);
});

test("overview queue metrics do not double-count LP positions already backing a class ledger", () => {
  const source = {
    ...EMPTY_OVERVIEW_STATS_SOURCE,
    liquidityPools: [{
      address: "pool-1",
      poolId: "pool-1",
      displayName: "Pool 1",
      depositAssetMint: "asset-1",
      strategyThesis: "Queue test",
      redemptionPolicy: 1,
      totalValueLocked: 100_000n,
      totalAllocated: 25_000n,
      totalPendingRedemptions: 0n,
      active: true,
    }],
    capitalClasses: [{
      address: "class-1",
      liquidityPool: "pool-1",
      classId: "senior",
      displayName: "Senior",
      priority: 1,
      restrictionMode: 0,
      totalShares: 100_000n,
      navAssets: 100_000n,
      allocatedAssets: 25_000n,
      pendingRedemptions: 25_000n,
      active: true,
    }],
    lpPositions: [{
      address: "lp-1",
      owner: "owner-1",
      capitalClass: "class-1",
      shares: 50_000n,
      subscriptionBasis: 50_000n,
      pendingRedemptionShares: 25_000n,
      queueStatus: 1,
    }],
  };

  assert.equal(countPendingRedemptionSources(source), 1);
  assert.equal(buildOverviewStats(source).pendingRedemptionCount, 1);
});
