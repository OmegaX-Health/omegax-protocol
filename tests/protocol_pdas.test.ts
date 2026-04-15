import test from "node:test";
import assert from "node:assert/strict";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const {
  DEVNET_PROTOCOL_FIXTURE_STATE,
  DEFAULT_HEALTH_PLAN_ADDRESS,
  DEFAULT_LIQUIDITY_POOL_ADDRESS,
} = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  buildAttestClaimCaseTx,
  deriveClaimAttestationPda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  deriveMembershipAnchorSeatPda,
  deriveOracleProfilePda,
  deriveOutcomeSchemaPda,
  derivePoolOracleApprovalPda,
  derivePoolOraclePolicyPda,
  derivePoolOraclePermissionSetPda,
  deriveProtocolGovernancePda,
  deriveReserveDomainPda,
  deriveSchemaDependencyLedgerPda,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

test("fixture addresses stay deterministic under canonical seeds", () => {
  const [openDomain, wrapperDomain] = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains;
  const seekerPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
  const oracleAddress = DEFAULT_HEALTH_PLAN_ADDRESS;

  assert.equal(
    deriveReserveDomainPda({ domainId: openDomain.domainId }).toBase58(),
    openDomain.address,
  );
  assert.equal(
    deriveReserveDomainPda({ domainId: wrapperDomain.domainId }).toBase58(),
    wrapperDomain.address,
  );
  assert.equal(
    deriveHealthPlanPda({ reserveDomain: seekerPlan.reserveDomain, planId: seekerPlan.planId }).toBase58(),
    DEFAULT_HEALTH_PLAN_ADDRESS,
  );
  assert.equal(
    deriveLiquidityPoolPda({ reserveDomain: pool.reserveDomain, poolId: pool.poolId }).toBase58(),
    DEFAULT_LIQUIDITY_POOL_ADDRESS,
  );
  assert.match(
    deriveMembershipAnchorSeatPda({
      healthPlan: seekerPlan.address,
      anchorRef: seekerPlan.address,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveOracleProfilePda({ oracle: oracleAddress }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    derivePoolOracleApprovalPda({
      liquidityPool: pool.address,
      oracle: oracleAddress,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    derivePoolOraclePolicyPda({ liquidityPool: pool.address }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    derivePoolOraclePermissionSetPda({
      liquidityPool: pool.address,
      oracle: oracleAddress,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveOutcomeSchemaPda({
      schemaKeyHashHex: "11".repeat(32),
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveSchemaDependencyLedgerPda({
      schemaKeyHashHex: "11".repeat(32),
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveClaimAttestationPda({
      claimCase: seekerPlan.address,
      oracle: oracleAddress,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(deriveProtocolGovernancePda().toBase58(), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
});

test("claim attestation builders reject unsupported decisions before chain submission", () => {
  assert.throws(
    () =>
      buildAttestClaimCaseTx({
        oracle: DEFAULT_HEALTH_PLAN_ADDRESS,
        claimCaseAddress: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases[0]!.address,
        recentBlockhash: "11111111111111111111111111111111",
        decision: 99,
        attestationHashHex: "11".repeat(32),
        attestationRefHashHex: "22".repeat(32),
        schemaKeyHashHex: "33".repeat(32),
      }),
    /claim attestation decision must be one of 0/,
  );
});
