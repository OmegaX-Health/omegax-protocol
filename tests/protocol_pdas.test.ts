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
  buildAttachClaimEvidenceRefTx,
  buildAttestClaimCaseTx,
  buildAdjudicateClaimCaseTx,
  buildOpenClaimCaseTx,
  buildOpenMemberPositionTx,
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

test("claim evidence and attestation builders are removed with the on-chain attestation surface", () => {
  assert.throws(
    () =>
      buildAttachClaimEvidenceRefTx({
        authority: DEFAULT_HEALTH_PLAN_ADDRESS,
        healthPlanAddress: DEFAULT_HEALTH_PLAN_ADDRESS,
        claimCaseAddress: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases[0]!.address,
        recentBlockhash: "11111111111111111111111111111111",
        evidenceRefHashHex: "11".repeat(32),
        decisionSupportHashHex: "22".repeat(32),
      }),
    /attach_claim_evidence_ref was removed/,
  );

  assert.throws(
    () =>
      buildAttestClaimCaseTx({
        oracle: DEFAULT_HEALTH_PLAN_ADDRESS,
        healthPlanAddress: DEFAULT_HEALTH_PLAN_ADDRESS,
        claimCaseAddress: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases[0]!.address,
        fundingLineAddress: DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines[0]!.address,
        recentBlockhash: "11111111111111111111111111111111",
        decision: 0,
        attestationHashHex: "11".repeat(32),
        attestationRefHashHex: "22".repeat(32),
        schemaKeyHashHex: "33".repeat(32),
      }),
    /attest_claim_case was removed/,
  );
});

test("member enrollment builder is removed with the on-chain membership surface", () => {
  const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const memberWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "member")!.address;
  const inviteAuthority = plan.membershipInviteAuthority!;
  assert.throws(
    () =>
      buildOpenMemberPositionTx({
        wallet: memberWallet,
        healthPlanAddress: plan.address,
        recentBlockhash: "11111111111111111111111111111111",
        seriesScopeAddress: null,
        subjectCommitmentHashHex: "11".repeat(32),
        eligibilityStatus: 0,
        delegatedRightsMask: 0,
        proofMode: 0,
        inviteIdHashHex: "22".repeat(32),
        inviteExpiresAt: 0n,
        inviteAuthorityAddress: inviteAuthority,
      }),
    /open_member_position was removed/,
  );
});
