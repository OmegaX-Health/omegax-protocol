import test from "node:test";
import assert from "node:assert/strict";
import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../frontend/lib/protocol.ts";
const { DEVNET_PROTOCOL_FIXTURE_STATE, DEFAULT_HEALTH_PLAN_ADDRESS, DEFAULT_LIQUIDITY_POOL_ADDRESS, } = fixturesModule;
const { deriveHealthPlanPda, deriveLiquidityPoolPda, deriveProtocolGovernancePda, deriveReserveDomainPda, } = protocolModule;
test("fixture addresses stay deterministic under canonical seeds", () => {
    const [openDomain, wrapperDomain] = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains;
    const seekerPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0];
    const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0];
    assert.equal(deriveReserveDomainPda({ domainId: openDomain.domainId }).toBase58(), openDomain.address);
    assert.equal(deriveReserveDomainPda({ domainId: wrapperDomain.domainId }).toBase58(), wrapperDomain.address);
    assert.equal(deriveHealthPlanPda({ reserveDomain: seekerPlan.reserveDomain, planId: seekerPlan.planId }).toBase58(), DEFAULT_HEALTH_PLAN_ADDRESS);
    assert.equal(deriveLiquidityPoolPda({ reserveDomain: pool.reserveDomain, poolId: pool.poolId }).toBase58(), DEFAULT_LIQUIDITY_POOL_ADDRESS);
    assert.match(deriveProtocolGovernancePda().toBase58(), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
});
