import assert from "node:assert/strict";
import test from "node:test";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import overviewMetricsModule from "../frontend/lib/overview-metrics.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  EMPTY_OVERVIEW_STATS_SOURCE,
  buildOverviewStats,
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
