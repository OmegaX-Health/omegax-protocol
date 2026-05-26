import assert from "node:assert/strict";
import test from "node:test";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import nsCatalogModule from "../frontend/lib/network-school-acute-assist.ts";
import nsOperatorModule from "../frontend/lib/network-school-acute-assist-operator.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU,
  NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_DISPLAY_NAME,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_METADATA_URI,
  NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_SKUS,
} = nsCatalogModule as typeof import("../frontend/lib/network-school-acute-assist.ts");
const {
  buildNetworkSchoolAcuteAssistSetupModel,
  buildNetworkSchoolAcuteAssistWizardDefaults,
  NETWORK_SCHOOL_ACUTE_ASSIST_TEMPLATE_KEY,
  networkSchoolAcuteAssistBootstrapAllocations,
  networkSchoolAcuteAssistBootstrapCapitalClasses,
  networkSchoolAcuteAssistBootstrapFundingLines,
} = nsOperatorModule as typeof import("../frontend/lib/network-school-acute-assist-operator.ts");
const { hasConfiguredPoolTerms } = protocolModule as typeof import("../frontend/lib/protocol.ts");

function cloneFixtureSnapshot() {
  return structuredClone(DEVNET_PROTOCOL_FIXTURE_STATE);
}

function clearSharedAcuteQueueOnlyPressure(snapshot: ReturnType<typeof cloneFixtureSnapshot>) {
  const pool = snapshot.liquidityPools.find((entry) => entry.poolId === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID)!;
  pool.redemptionPolicy = 0;
  for (const capitalClass of snapshot.capitalClasses.filter((entry) => entry.liquidityPool === pool.address)) {
    capitalClass.queueOnlyRedemptions = false;
  }
}

function configureNetworkSchoolOperators(snapshot: ReturnType<typeof cloneFixtureSnapshot>) {
  const plan = snapshot.healthPlans.find((entry) => entry.planId === NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID)!;
  plan.sponsorOperator = "NsSponsor11111111111111111111111111111111";
  plan.claimsOperator = "NsClaims1111111111111111111111111111111";
  plan.oracleAuthority = "NsOracle1111111111111111111111111111111";
  plan.membershipInviteAuthority = "NsInvite1111111111111111111111111111111";
}

test("Network School operator bootstrap definitions stay aligned to the four tier series", () => {
  const fundingLines = networkSchoolAcuteAssistBootstrapFundingLines();
  const classes = networkSchoolAcuteAssistBootstrapCapitalClasses();
  const allocations = networkSchoolAcuteAssistBootstrapAllocations();

  assert.deepEqual(
    fundingLines.map((line) => [line.lineId, line.fundingPriority]),
    [
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.fundingLineIds.premium, 0],
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.fundingLineIds.liquidity, 1],
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.fundingLineIds.premium, 2],
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.fundingLineIds.liquidity, 3],
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.fundingLineIds.premium, 4],
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.fundingLineIds.liquidity, 5],
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.fundingLineIds.premium, 6],
      [NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.fundingLineIds.liquidity, 7],
    ],
  );
  assert.deepEqual(
    classes.map((entry) => [entry.classId, entry.priority]),
    [
      [NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID, 0],
      [NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID, 1],
    ],
  );
  assert.deepEqual(
    allocations.map((entry) => [entry.key, entry.classId, entry.fundingLineId, entry.weightBps, entry.capAmount]),
    [
      ["lite-junior", NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID, NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.fundingLineIds.liquidity, 1250, 750n],
      ["core-senior", NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID, NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.fundingLineIds.liquidity, 3334, 2000n],
      ["plus-junior", NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID, NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.fundingLineIds.liquidity, 3333, 2000n],
      ["family-core-junior", NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID, NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.fundingLineIds.liquidity, 2083, 1250n],
    ],
  );
  assert.equal(allocations.reduce((sum, entry) => sum + entry.weightBps, 0), 10_000);
  assert.equal(allocations.reduce((sum, entry) => sum + entry.capAmount, 0n), 6_000n);
});

test("Network School wizard defaults pin invite-only Core as the product default", () => {
  const defaults = buildNetworkSchoolAcuteAssistWizardDefaults();

  assert.equal(defaults.templateKey, NETWORK_SCHOOL_ACUTE_ASSIST_TEMPLATE_KEY);
  assert.equal(defaults.planId, NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID);
  assert.equal(defaults.displayName, NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_DISPLAY_NAME);
  assert.equal(defaults.metadataUri, NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_METADATA_URI);
  assert.equal(defaults.membershipMode, "invite_only");
  assert.equal(defaults.membershipGateKind, "invite_only");
  assert.equal(NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU.key, "core");
  assert.ok(defaults.payoutMint.length > 0);
});

test("Network School setup model fails closed while the Discord verifier is unconfigured", () => {
  const snapshot = cloneFixtureSnapshot();
  configureNetworkSchoolOperators(snapshot);

  const model = buildNetworkSchoolAcuteAssistSetupModel({
    snapshot,
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
      discordVerifierConfigured: false,
    },
  });

  assert.equal(model.checklist.planShellReady, true);
  assert.equal(model.checklist.inviteGateReady, true);
  assert.equal(model.checklist.seriesReady, true);
  assert.equal(model.checklist.fundingLinesReady, true);
  assert.equal(model.checklist.sharedPoolReady, true);
  assert.equal(model.checklist.allocationsReady, true);
  assert.equal(model.checklist.discordVerifierConfigured, false);
  assert.equal(model.posture.state, "caution");
  assert.equal(model.readinessPhase, "verifier_pending");
  assert(model.missingArtifacts.includes("network_school_discord_verifier"));
});

test("Network School setup model stays reserve_pending while shared acute sleeves are queue-only", () => {
  const snapshot = cloneFixtureSnapshot();
  configureNetworkSchoolOperators(snapshot);

  const model = buildNetworkSchoolAcuteAssistSetupModel({
    snapshot,
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
      discordVerifierConfigured: true,
    },
  });

  assert.equal(model.queueOnlyRedemptionsActive, true);
  assert.equal(model.claimsPayingCapital, 8_800n);
  assert.equal(model.readinessPhase, "reserve_pending");
});

test("Network School setup model can reach healthy when verifier, operators, reserve, and pool controls are ready", () => {
  const snapshot = cloneFixtureSnapshot();
  configureNetworkSchoolOperators(snapshot);
  clearSharedAcuteQueueOnlyPressure(snapshot);

  const model = buildNetworkSchoolAcuteAssistSetupModel({
    snapshot,
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
      discordVerifierConfigured: true,
    },
  });

  assert.equal(model.posture.state, "healthy");
  assert.equal(model.readinessPhase, "issuance_ready");
  assert.equal(model.queueOnlyRedemptionsActive, false);
  assert.equal(model.checklist.reserveTargetReviewReady, true);
});

test("Network School setup becomes paused when shared acute-pool controls are paused", () => {
  const snapshot = cloneFixtureSnapshot();
  configureNetworkSchoolOperators(snapshot);
  clearSharedAcuteQueueOnlyPressure(snapshot);
  const pool = snapshot.liquidityPools.find((entry) => entry.poolId === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID)!;
  pool.pauseFlags = 1;

  const model = buildNetworkSchoolAcuteAssistSetupModel({
    snapshot,
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
      discordVerifierConfigured: true,
    },
  });

  assert.equal(model.posture.state, "paused");
  assert.equal(model.readinessPhase, "paused");
  assert.match(model.posture.reasons.join(" "), /blocking issuance/i);
});

test("Network School setup does not treat an unconfigured shared pool as live pool terms", () => {
  const snapshot = cloneFixtureSnapshot();
  const pool = snapshot.liquidityPools.find((entry) => entry.poolId === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID)!;

  assert.equal(hasConfiguredPoolTerms(pool), false);
  assert.equal(hasConfiguredPoolTerms({
    ...pool,
    strategyHashHex: "11".repeat(32),
    allowedExposureHashHex: "22".repeat(32),
    externalYieldAdapterHashHex: "33".repeat(32),
  }), true);
});

