import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const {
  DEVNET_PROTOCOL_FIXTURE_STATE,
  DEFAULT_HEALTH_PLAN_ADDRESS,
  DEFAULT_LIQUIDITY_POOL_ADDRESS,
} = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  buildDepositReserveCapitalTx,
  buildAdjudicateClaimCaseTx,
  buildRecordReserveEarningsTx,
  buildOpenClaimCaseTx,
  buildReturnReserveCapitalTx,
  deriveCapitalContributionPda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  deriveReserveDomainPda,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

test("fixture addresses stay deterministic under canonical seeds", () => {
  const [openDomain, wrapperDomain] = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains;
  const seekerPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;

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
});

test("claim builders serialize proof fingerprints without restoring attestation builders", () => {
  const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const fundingLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines[0]!;
  const claim = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases[0]!;
  const evidenceHashHex = "11".repeat(32);
  const decisionHashHex = "22".repeat(32);

  const openClaim = buildOpenClaimCaseTx({
    authority: DEFAULT_HEALTH_PLAN_ADDRESS,
    healthPlanAddress: plan.address,
    fundingLineAddress: fundingLine.address,
    recentBlockhash: "11111111111111111111111111111111",
    claimId: "claim-proof-001",
    policySeriesAddress: fundingLine.policySeries,
    claimantAddress: claim.claimant,
    evidenceRefHashHex: evidenceHashHex,
  });
  assert.notEqual(openClaim.instructions[0]!.data.indexOf(Buffer.from("11".repeat(32), "hex")), -1);

  const adjudicateClaim = buildAdjudicateClaimCaseTx({
    authority: DEFAULT_HEALTH_PLAN_ADDRESS,
    healthPlanAddress: plan.address,
    claimCaseAddress: claim.address,
    recentBlockhash: "11111111111111111111111111111111",
    reviewState: 1,
    approvedAmount: 100n,
    deniedAmount: 0n,
    reserveAmount: 0n,
    evidenceRefHashHex: evidenceHashHex,
    decisionSupportHashHex: decisionHashHex,
  });
  assert.notEqual(adjudicateClaim.instructions[0]!.data.indexOf(Buffer.from(evidenceHashHex, "hex")), -1);
  assert.notEqual(adjudicateClaim.instructions[0]!.data.indexOf(Buffer.from(decisionHashHex, "hex")), -1);

  const reviewOnlyAdjudication = buildAdjudicateClaimCaseTx({
    authority: DEFAULT_HEALTH_PLAN_ADDRESS,
    healthPlanAddress: plan.address,
    claimCaseAddress: claim.address,
    recentBlockhash: "11111111111111111111111111111111",
    reviewState: 1,
    approvedAmount: 0n,
    deniedAmount: 0n,
    reserveAmount: 0n,
  });
  assert.equal(reviewOnlyAdjudication.instructions.length, 1);

  assert.throws(
    () =>
      buildAdjudicateClaimCaseTx({
        authority: DEFAULT_HEALTH_PLAN_ADDRESS,
        healthPlanAddress: plan.address,
        claimCaseAddress: claim.address,
        recentBlockhash: "11111111111111111111111111111111",
        reviewState: 1,
        approvedAmount: 100n,
        deniedAmount: 0n,
        reserveAmount: 0n,
      }),
    /claim proof fingerprints are required/,
  );
});

test("reserve capital builders serialize contributor and earnings fingerprints", () => {
  const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const fundingLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines[0]!;
  const contributor = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "member")!.address;
  const tokenAccount = DEFAULT_HEALTH_PLAN_ADDRESS;
  const capitalContribution = deriveCapitalContributionPda({
    fundingLine: fundingLine.address,
    contributor,
  });
  const termsHashHex = "44".repeat(32);
  const earningsRefHashHex = "55".repeat(32);

  const deposit = buildDepositReserveCapitalTx({
    contributor,
    healthPlanAddress: plan.address,
    reserveDomainAddress: plan.reserveDomain,
    fundingLineAddress: fundingLine.address,
    assetMint: fundingLine.assetMint,
    sourceTokenAccountAddress: tokenAccount,
    vaultTokenAccountAddress: tokenAccount,
    recentBlockhash: "11111111111111111111111111111111",
    amount: 25n,
    termsHashHex,
  });
  assert.equal(deposit.instructions[0]!.keys[5]!.pubkey.toBase58(), capitalContribution.toBase58());
  assert.notEqual(deposit.instructions[0]!.data.indexOf(Buffer.from(termsHashHex, "hex")), -1);

  const returned = buildReturnReserveCapitalTx({
    authority: DEFAULT_HEALTH_PLAN_ADDRESS,
    contributorAddress: contributor,
    healthPlanAddress: plan.address,
    reserveDomainAddress: plan.reserveDomain,
    fundingLineAddress: fundingLine.address,
    assetMint: fundingLine.assetMint,
    vaultTokenAccountAddress: tokenAccount,
    recipientTokenAccountAddress: tokenAccount,
    recentBlockhash: "11111111111111111111111111111111",
    amount: 10n,
    reasonHashHex: "66".repeat(32),
  });
  assert.equal(returned.instructions[0]!.keys[5]!.pubkey.toBase58(), capitalContribution.toBase58());

  const earnings = buildRecordReserveEarningsTx({
    authority: DEFAULT_HEALTH_PLAN_ADDRESS,
    healthPlanAddress: plan.address,
    reserveDomainAddress: plan.reserveDomain,
    fundingLineAddress: fundingLine.address,
    assetMint: fundingLine.assetMint,
    sourceTokenAccountAddress: tokenAccount,
    vaultTokenAccountAddress: tokenAccount,
    recentBlockhash: "11111111111111111111111111111111",
    amount: 7n,
    earningsRefHashHex,
  });
  assert.notEqual(earnings.instructions[0]!.data.indexOf(Buffer.from(earningsRefHashHex, "hex")), -1);

  assert.throws(
    () =>
      buildRecordReserveEarningsTx({
        authority: DEFAULT_HEALTH_PLAN_ADDRESS,
        healthPlanAddress: plan.address,
        reserveDomainAddress: plan.reserveDomain,
        fundingLineAddress: fundingLine.address,
        assetMint: fundingLine.assetMint,
        sourceTokenAccountAddress: tokenAccount,
        vaultTokenAccountAddress: tokenAccount,
        recentBlockhash: "11111111111111111111111111111111",
        amount: 1n,
        earningsRefHashHex: "00".repeat(32),
      }),
    /earningsRefHashHex must be a nonzero/,
  );
});

// Retired builders (claim attestation, membership) were fully removed from the
// trimmed protocol surface — see the deletion in frontend/lib/protocol.ts.
