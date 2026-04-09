import assert from "node:assert/strict";
import test from "node:test";
import canonicalRoutesModule from "../frontend/lib/canonical-routes.ts";
import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import workbenchModule from "../frontend/lib/workbench.ts";
const { buildCanonicalPoolHref } = canonicalRoutesModule;
const { DEVNET_PROTOCOL_FIXTURE_STATE } = fixturesModule;
const { firstSeriesAddressForPlan, linkedContextForPool } = workbenchModule;
test("linked pool context keeps a unique plan but does not invent a series for multi-series pools", () => {
    const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((entry) => entry.poolId === "omega-health-income");
    const blendedPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((entry) => entry.planId === "nexus-protect-plus");
    assert(pool, "expected income pool fixture");
    assert(blendedPlan, "expected blended plan fixture");
    assert.deepEqual(linkedContextForPool(pool.address), {
        plan: blendedPlan.address,
        series: null,
    });
});
test("canonical claims links omit ambiguous series context", () => {
    const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((entry) => entry.poolId === "omega-health-income");
    assert(pool, "expected income pool fixture");
    const href = buildCanonicalPoolHref(pool.address, { section: "claims" });
    const url = new URL(href, "https://protocol.omegax.health");
    assert.equal(url.pathname, "/plans");
    assert.equal(url.searchParams.get("tab"), "claims");
    assert.equal(url.searchParams.get("plan"), DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((entry) => entry.planId === "nexus-protect-plus")?.address ?? null);
    assert.equal(url.searchParams.get("series"), null);
});
test("canonical schema links pick a deterministic series when only the plan is unique", () => {
    const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((entry) => entry.poolId === "omega-health-income");
    const blendedPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((entry) => entry.planId === "nexus-protect-plus");
    assert(pool, "expected income pool fixture");
    assert(blendedPlan, "expected blended plan fixture");
    const href = buildCanonicalPoolHref(pool.address, { section: "schemas" });
    const url = new URL(href, "https://protocol.omegax.health");
    assert.equal(url.pathname, "/plans");
    assert.equal(url.searchParams.get("tab"), "schemas");
    assert.equal(url.searchParams.get("plan"), blendedPlan.address);
    assert.equal(url.searchParams.get("series"), firstSeriesAddressForPlan(blendedPlan.address));
});
