import assert from "node:assert/strict";
import test from "node:test";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import genesisCatalogModule from "../frontend/lib/genesis-protect-acute.ts";
import genesisConsoleModule from "../frontend/lib/genesis-protect-acute-console.ts";
import genesisOperatorModule from "../frontend/lib/genesis-protect-acute-operator.ts";
import protocolModule from "../frontend/lib/protocol.ts";
import type {
  ClaimAttestationSnapshot,
  ClaimCaseSnapshot,
  ObligationSnapshot,
  ProtocolConsoleSnapshot,
} from "../frontend/lib/protocol.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const { GENESIS_PROTECT_ACUTE_SKUS } =
  genesisCatalogModule as typeof import("../frontend/lib/genesis-protect-acute.ts");
const {
  buildGenesisProtectAcuteClaimConsoleModel,
  buildGenesisProtectAcuteReserveConsoleModel,
} = genesisConsoleModule as typeof import("../frontend/lib/genesis-protect-acute-console.ts");
const { buildGenesisProtectAcuteSetupModel } =
  genesisOperatorModule as typeof import("../frontend/lib/genesis-protect-acute-operator.ts");
const {
  CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW,
  CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE,
  CLAIM_INTAKE_APPROVED,
  CLAIM_INTAKE_OPEN,
  CLAIM_INTAKE_SETTLED,
  OBLIGATION_DELIVERY_MODE_CLAIMABLE,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RESERVED,
  OBLIGATION_STATUS_SETTLED,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

function cloneFixtureSnapshot(): ProtocolConsoleSnapshot {
  const snapshot = structuredClone(DEVNET_PROTOCOL_FIXTURE_STATE) as unknown as ProtocolConsoleSnapshot;
  snapshot.claimAttestations = [];
  return snapshot;
}

function buildSetupModel(snapshot: ProtocolConsoleSnapshot) {
  return buildGenesisProtectAcuteSetupModel({
    snapshot,
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
    },
  });
}

test("Genesis claim console groups the operator queue by attestation and liability state", () => {
  const snapshot = cloneFixtureSnapshot();
  const initialSetupModel = buildSetupModel(snapshot);
  const genesisPlan = initialSetupModel.plan;
  const event7Series = initialSetupModel.seriesBySku.event7;
  const travel30Series = initialSetupModel.seriesBySku.travel30;
  const event7PremiumLine = initialSetupModel.fundingLinesById[GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.premium];
  const event7SponsorLine = initialSetupModel.fundingLinesById[GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.sponsor!];
  const travel30PremiumLine = initialSetupModel.fundingLinesById[GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium];
  const travel30LiquidityLine = initialSetupModel.fundingLinesById[GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity];
  const member = snapshot.memberPositions[0];

  assert(genesisPlan, "expected Genesis health plan");
  assert(event7Series, "expected Genesis Event 7 series");
  assert(travel30Series, "expected Genesis Travel 30 series");
  assert(event7PremiumLine, "expected Genesis Event 7 premium line");
  assert(event7SponsorLine, "expected Genesis Event 7 sponsor line");
  assert(travel30PremiumLine, "expected Genesis Travel 30 premium line");
  assert(travel30LiquidityLine, "expected Genesis Travel 30 liquidity line");
  assert(member, "expected at least one member position fixture");

  const reviewClaim: ClaimCaseSnapshot = {
    address: "GenesisClaimReview111111111111111111111111111111",
    reserveDomain: genesisPlan.reserveDomain,
    healthPlan: genesisPlan.address,
    policySeries: event7Series.address,
    fundingLine: event7PremiumLine.address,
    memberPosition: member.address,
    claimant: member.wallet,
    claimId: "genesis-review-001",
    intakeStatus: CLAIM_INTAKE_APPROVED,
    approvedAmount: 250n,
  };
  const readyClaim: ClaimCaseSnapshot = {
    address: "GenesisClaimReady1111111111111111111111111111111",
    reserveDomain: genesisPlan.reserveDomain,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    fundingLine: travel30PremiumLine.address,
    memberPosition: member.address,
    claimant: member.wallet,
    claimId: "genesis-ready-001",
    intakeStatus: CLAIM_INTAKE_APPROVED,
    approvedAmount: 600n,
  };
  const reserveClaim: ClaimCaseSnapshot = {
    address: "GenesisClaimReserve1111111111111111111111111111",
    reserveDomain: genesisPlan.reserveDomain,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    fundingLine: travel30LiquidityLine.address,
    memberPosition: member.address,
    claimant: member.wallet,
    claimId: "genesis-reserve-001",
    intakeStatus: CLAIM_INTAKE_APPROVED,
    approvedAmount: 500n,
    linkedObligation: "GenesisObligationReserve11111111111111111111111",
  };
  const payoutClaim: ClaimCaseSnapshot = {
    address: "GenesisClaimPayout11111111111111111111111111111",
    reserveDomain: genesisPlan.reserveDomain,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    fundingLine: travel30LiquidityLine.address,
    memberPosition: member.address,
    claimant: member.wallet,
    claimId: "genesis-payout-001",
    intakeStatus: CLAIM_INTAKE_APPROVED,
    approvedAmount: 400n,
    linkedObligation: "GenesisObligationPayout111111111111111111111111",
  };
  const closedClaim: ClaimCaseSnapshot = {
    address: "GenesisClaimClosed11111111111111111111111111111",
    reserveDomain: genesisPlan.reserveDomain,
    healthPlan: genesisPlan.address,
    policySeries: event7Series.address,
    fundingLine: event7SponsorLine.address,
    memberPosition: member.address,
    claimant: member.wallet,
    claimId: "genesis-closed-001",
    intakeStatus: CLAIM_INTAKE_SETTLED,
    approvedAmount: 150n,
    paidAmount: 150n,
    linkedObligation: "GenesisObligationClosed111111111111111111111111",
  };

  const reserveObligation: ObligationSnapshot = {
    address: reserveClaim.linkedObligation!,
    reserveDomain: genesisPlan.reserveDomain,
    assetMint: travel30LiquidityLine.assetMint,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    memberWallet: member.wallet,
    fundingLine: travel30LiquidityLine.address,
    claimCase: reserveClaim.address,
    liquidityPool: initialSetupModel.pool?.address ?? null,
    obligationId: "genesis-reserve-obligation-001",
    status: OBLIGATION_STATUS_RESERVED,
    deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
    principalAmount: 500n,
    outstandingAmount: 500n,
    reservedAmount: 500n,
  };
  const payoutObligation: ObligationSnapshot = {
    address: payoutClaim.linkedObligation!,
    reserveDomain: genesisPlan.reserveDomain,
    assetMint: travel30LiquidityLine.assetMint,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    memberWallet: member.wallet,
    fundingLine: travel30LiquidityLine.address,
    claimCase: payoutClaim.address,
    liquidityPool: initialSetupModel.pool?.address ?? null,
    obligationId: "genesis-payout-obligation-001",
    status: OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
    deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
    principalAmount: 400n,
    outstandingAmount: 200n,
    reservedAmount: 300n,
    claimableAmount: 150n,
    payableAmount: 50n,
  };
  const closedObligation: ObligationSnapshot = {
    address: closedClaim.linkedObligation!,
    reserveDomain: genesisPlan.reserveDomain,
    assetMint: event7SponsorLine.assetMint,
    healthPlan: genesisPlan.address,
    policySeries: event7Series.address,
    memberWallet: member.wallet,
    fundingLine: event7SponsorLine.address,
    claimCase: closedClaim.address,
    obligationId: "genesis-closed-obligation-001",
    status: OBLIGATION_STATUS_SETTLED,
    deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
    principalAmount: 150n,
    outstandingAmount: 0n,
    settledAmount: 150n,
  };

  const reviewAttestation: ClaimAttestationSnapshot = {
    address: "GenesisAttestationReview111111111111111111111111",
    oracle: "GenesisOracle111111111111111111111111111111111",
    oracleProfile: "GenesisOracleProfile111111111111111111111111",
    claimCase: reviewClaim.address,
    healthPlan: genesisPlan.address,
    policySeries: event7Series.address,
    decision: CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW,
    attestationHashHex: "11".repeat(32),
    attestationRefHashHex: "22".repeat(32),
    schemaKeyHashHex: "33".repeat(32),
    createdAtTs: 1_710_000_001,
    updatedAtTs: 1_710_000_101,
    bump: 1,
  };
  const reserveAttestation: ClaimAttestationSnapshot = {
    address: "GenesisAttestationReserve11111111111111111111111",
    oracle: "GenesisOracle111111111111111111111111111111111",
    oracleProfile: "GenesisOracleProfile111111111111111111111111",
    claimCase: reserveClaim.address,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    decision: CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE,
    attestationHashHex: "44".repeat(32),
    attestationRefHashHex: "55".repeat(32),
    schemaKeyHashHex: "66".repeat(32),
    createdAtTs: 1_710_000_002,
    updatedAtTs: 1_710_000_202,
    bump: 1,
  };
  const payoutAttestation: ClaimAttestationSnapshot = {
    address: "GenesisAttestationPayout111111111111111111111111",
    oracle: "GenesisOracle111111111111111111111111111111111",
    oracleProfile: "GenesisOracleProfile111111111111111111111111",
    claimCase: payoutClaim.address,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    decision: CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE,
    attestationHashHex: "77".repeat(32),
    attestationRefHashHex: "88".repeat(32),
    schemaKeyHashHex: "99".repeat(32),
    createdAtTs: 1_710_000_003,
    updatedAtTs: 1_710_000_303,
    bump: 1,
  };

  snapshot.claimCases.push(reviewClaim, readyClaim, reserveClaim, payoutClaim, closedClaim);
  snapshot.obligations.push(reserveObligation, payoutObligation, closedObligation);
  snapshot.claimAttestations.push(reviewAttestation, reserveAttestation, payoutAttestation);

  const setupModel = buildSetupModel(snapshot);
  const model = buildGenesisProtectAcuteClaimConsoleModel({
    snapshot,
    setupModel,
  });
  const rowsById = Object.fromEntries(model.rows.map((row) => [row.claimId, row]));

  assert.equal(rowsById["genesis-review-001"]?.stage, "operator_review");
  assert.equal(rowsById["genesis-ready-001"]?.stage, "attestation_ready");
  assert.equal(rowsById["genesis-reserve-001"]?.stage, "reserve_active");
  assert.equal(rowsById["genesis-payout-001"]?.stage, "payout_active");
  assert.equal(rowsById["genesis-closed-001"]?.stage, "closed");

  assert.equal(model.summary.submittedClaims, 0);
  assert.equal(model.summary.operatorReviewLoad, 1);
  assert.equal(model.summary.attestationReadyClaims, 1);
  assert.equal(model.summary.payoutInFlightCount, 1);
  assert.equal(model.summary.reservedExposure, 800n);
  assert.equal(model.summary.payoutInFlightAmount, 200n);
  assert.equal(model.rows.length, 5);
  assert.ok(model.warnings.some((warning) => setupModel.posture.reasons.includes(warning)));

  const payoutOnly = buildGenesisProtectAcuteClaimConsoleModel({
    snapshot,
    setupModel,
    queueFilter: "payout_active",
  });
  assert.deepEqual(payoutOnly.visibleRows.map((row) => row.claimId), ["genesis-payout-001"]);
  assert.equal(payoutOnly.selectedClaim?.recommendedPanel, "reserve");
});

test("Genesis claim console does not double-count mirrored reserve and keeps closed cases closed", () => {
  const snapshot = cloneFixtureSnapshot();
  const initialSetupModel = buildSetupModel(snapshot);
  const genesisPlan = initialSetupModel.plan;
  const travel30Series = initialSetupModel.seriesBySku.travel30;
  const travel30LiquidityLine = initialSetupModel.fundingLinesById[GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity];
  const member = snapshot.memberPositions[0];

  assert(genesisPlan, "expected Genesis health plan");
  assert(travel30Series, "expected Genesis Travel 30 series");
  assert(travel30LiquidityLine, "expected Genesis Travel 30 liquidity line");
  assert(member, "expected at least one member position fixture");

  const mirroredReserveClaim: ClaimCaseSnapshot = {
    address: "GenesisClaimMirrored1111111111111111111111111111",
    reserveDomain: genesisPlan.reserveDomain,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    fundingLine: travel30LiquidityLine.address,
    memberPosition: member.address,
    claimant: member.wallet,
    claimId: "genesis-mirrored-001",
    intakeStatus: CLAIM_INTAKE_APPROVED,
    approvedAmount: 700n,
    reservedAmount: 450n,
    linkedObligation: "GenesisObligationMirrored1111111111111111111111",
  };
  const mirroredReserveObligation: ObligationSnapshot = {
    address: mirroredReserveClaim.linkedObligation!,
    reserveDomain: genesisPlan.reserveDomain,
    assetMint: travel30LiquidityLine.assetMint,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    memberWallet: member.wallet,
    fundingLine: travel30LiquidityLine.address,
    claimCase: mirroredReserveClaim.address,
    obligationId: "genesis-mirrored-obligation-001",
    status: OBLIGATION_STATUS_RESERVED,
    deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
    principalAmount: 700n,
    outstandingAmount: 450n,
    reservedAmount: 450n,
  };
  const closedClaim: ClaimCaseSnapshot = {
    address: "GenesisClaimSettledReview111111111111111111111111",
    reserveDomain: genesisPlan.reserveDomain,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    fundingLine: travel30LiquidityLine.address,
    memberPosition: member.address,
    claimant: member.wallet,
    claimId: "genesis-settled-review-001",
    intakeStatus: CLAIM_INTAKE_SETTLED,
    approvedAmount: 200n,
    paidAmount: 200n,
    linkedObligation: "GenesisObligationSettledReview111111111111111111",
  };
  const closedObligation: ObligationSnapshot = {
    address: closedClaim.linkedObligation!,
    reserveDomain: genesisPlan.reserveDomain,
    assetMint: travel30LiquidityLine.assetMint,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    memberWallet: member.wallet,
    fundingLine: travel30LiquidityLine.address,
    claimCase: closedClaim.address,
    obligationId: "genesis-settled-review-obligation-001",
    status: OBLIGATION_STATUS_SETTLED,
    deliveryMode: OBLIGATION_DELIVERY_MODE_CLAIMABLE,
    principalAmount: 200n,
    outstandingAmount: 0n,
    settledAmount: 200n,
  };
  const staleReviewAttestation: ClaimAttestationSnapshot = {
    address: "GenesisAttestationSettledReview111111111111111111",
    oracle: "GenesisOracle111111111111111111111111111111111",
    oracleProfile: "GenesisOracleProfile111111111111111111111111",
    claimCase: closedClaim.address,
    healthPlan: genesisPlan.address,
    policySeries: travel30Series.address,
    decision: CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW,
    attestationHashHex: "aa".repeat(32),
    attestationRefHashHex: "bb".repeat(32),
    schemaKeyHashHex: "cc".repeat(32),
    createdAtTs: 1_710_000_401,
    updatedAtTs: 1_710_000_501,
    bump: 1,
  };

  snapshot.claimCases.push(mirroredReserveClaim, closedClaim);
  snapshot.obligations.push(mirroredReserveObligation, closedObligation);
  snapshot.claimAttestations.push(staleReviewAttestation);

  const model = buildGenesisProtectAcuteClaimConsoleModel({
    snapshot,
    setupModel: buildSetupModel(snapshot),
  });
  const rowsById = Object.fromEntries(model.rows.map((row) => [row.claimId, row]));

  assert.equal(rowsById["genesis-mirrored-001"]?.reservedAmount, 450n);
  assert.equal(rowsById["genesis-mirrored-001"]?.stage, "reserve_active");
  assert.equal(rowsById["genesis-settled-review-001"]?.stage, "closed");
  assert.equal(model.summary.reservedExposure, 450n);
});

test("Genesis reserve console summarizes lanes by funding path and flags degraded visibility", () => {
  const snapshot = cloneFixtureSnapshot();
  const setupModel = buildSetupModel(snapshot);
  const travel30LiquidityLine = snapshot.fundingLines.find(
    (entry) => entry.lineId === GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity,
  );

  assert(travel30LiquidityLine, "expected Genesis Travel 30 liquidity line");

  delete travel30LiquidityLine.sheet;

  const model = buildGenesisProtectAcuteReserveConsoleModel({
    snapshot,
    setupModel: buildSetupModel(snapshot),
    selectedFundingLineAddress: travel30LiquidityLine.address,
  });

  assert.equal(model.lanes.length, 5);
  assert.equal(model.lanes.filter((lane) => lane.laneType === "sponsor").length, 1);
  assert.equal(model.lanes.filter((lane) => lane.laneType === "premium").length, 2);
  assert.equal(model.lanes.filter((lane) => lane.laneType === "liquidity").length, 2);

  const sponsorLane = model.lanes.find((lane) => lane.laneType === "sponsor");
  const selectedLane = model.selectedLane;

  assert.equal(sponsorLane?.skuKey, "event7");
  assert.equal(selectedLane?.skuKey, "travel30");
  assert.equal(selectedLane?.hasVisibilityGap, true);
  assert.ok(selectedLane?.warningReasons.some((warning) => /missing/i.test(warning)));
  assert.equal(model.summary.visibilityGapCount, 1);
  assert.ok(
    model.warnings.includes("One or more Genesis reserve lanes are missing live balance-sheet or allocation context."),
  );
  assert.ok(model.warnings.some((warning) => model.setupModel.posture.reasons.includes(warning)));

  const premiumOnly = buildGenesisProtectAcuteReserveConsoleModel({
    snapshot,
    setupModel: model.setupModel,
    laneFilter: "premium",
  });
  assert.equal(premiumOnly.visibleLanes.length, 2);
  assert.ok(premiumOnly.visibleLanes.every((lane) => lane.laneType === "premium"));
});
