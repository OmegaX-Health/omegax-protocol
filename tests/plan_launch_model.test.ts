import test from "node:test";
import assert from "node:assert/strict";

import planLaunchModule from "../frontend/lib/plan-launch.ts";
import type {
  LaunchBasicsValidationInput,
  ProtectionLaneValidationInput,
  ProtectionPostureInput,
  RewardLaneValidationInput,
} from "../frontend/lib/plan-launch.ts";

const {
  buildLaunchReviewLinks,
  parseProtectionPosture,
  requiresProtectionLane,
  requiresRewardLane,
  resolveLaunchLaneBlueprints,
  serializeProtectionPosture,
  validateLaunchBasics,
  validateProtectionLane,
  validateRewardLane,
} = planLaunchModule as typeof import("../frontend/lib/plan-launch.ts");

function createValidBasics(intent: LaunchBasicsValidationInput["launchIntent"]): LaunchBasicsValidationInput {
  return {
    launchIntent: intent,
    planId: "nexus-plan",
    displayName: "Nexus Plan",
    organizationRef: "OmegaX Sponsor Desk",
    reserveDomainAddress: "GjJFUSzbjZZMXySmJdb4pxrnPHDuC8rWN7XQkkQRnM7x",
    metadataUri: "https://protocol.omegax.health/plans/nexus-plan",
    payoutAssetMode: "spl",
    payoutMint: "4Aar9R14YMbEie6yh8WcH1gWXrBtfucoFjw6SpjXpump",
    rewardPayoutUi: "25",
    termsHashHex: "",
    payoutPolicyHashHex: "",
    coveragePathway: "defi_native",
    defiSettlementMode: "onchain_programmatic",
    defiTechnicalTermsUri: "https://protocol.omegax.health/coverage/technical-terms",
    defiRiskDisclosureUri: "https://protocol.omegax.health/coverage/risk-disclosures",
    rwaLegalEntityName: "",
    rwaJurisdiction: "",
    rwaPolicyTermsUri: "",
    rwaRegulatoryLicenseRef: "",
    rwaComplianceContact: "",
  };
}

function createRewardLane(required: boolean): RewardLaneValidationInput {
  return {
    required,
    seriesId: required ? "reward-series" : "",
    displayName: required ? "Reward Series" : "",
    metadataUri: required ? "https://protocol.omegax.health/series/reward" : "",
    sponsorLineId: required ? "reward-budget" : "",
    selectedOutcomeIds: required ? ["walk-10000"] : [],
    ruleIdsByOutcome: required ? { "walk-10000": "rule-walk-10000" } : {},
    ruleHashOverridesByOutcome: {},
    payoutHashOverridesByOutcome: {},
  };
}

function createProtectionPosture(pathway: ProtectionPostureInput["coveragePathway"]): ProtectionPostureInput {
  return {
    coveragePathway: pathway,
    defiSettlementMode: pathway === "defi_native" ? "onchain_programmatic" : "",
    defiTechnicalTermsUri: "https://protocol.omegax.health/coverage/technical-terms",
    defiRiskDisclosureUri: "https://protocol.omegax.health/coverage/risk-disclosures",
    rwaLegalEntityName: pathway === "rwa_policy" ? "OmegaX Risk SPC" : "",
    rwaJurisdiction: pathway === "rwa_policy" ? "ADGM" : "",
    rwaPolicyTermsUri: pathway === "rwa_policy" ? "https://protocol.omegax.health/rwa/policy-terms" : "",
    rwaRegulatoryLicenseRef: pathway === "rwa_policy" ? "FSRA-2026-001" : "",
    rwaComplianceContact: pathway === "rwa_policy" ? "compliance@omegax.health" : "",
    protectionMetadataUri: "https://protocol.omegax.health/series/protection",
  };
}

function createProtectionLane(required: boolean, pathway: ProtectionPostureInput["coveragePathway"] = "defi_native"): ProtectionLaneValidationInput {
  return {
    required,
    seriesId: required ? "protection-series" : "",
    displayName: required ? "Protection Series" : "",
    metadataUri: required ? "https://protocol.omegax.health/series/protection" : "",
    premiumLineId: required ? "premium-income" : "",
    cadenceDays: required ? "30" : "",
    expectedPremiumUi: required ? "250" : "",
    posture: createProtectionPosture(pathway),
  };
}

test("launch intent maps to lane blueprints without reintroducing root product types", () => {
  const rewardLanes = resolveLaunchLaneBlueprints("rewards");
  const insuranceLanes = resolveLaunchLaneBlueprints("insurance");
  const hybridLanes = resolveLaunchLaneBlueprints("hybrid");

  assert.equal(requiresRewardLane("rewards"), true);
  assert.equal(requiresProtectionLane("rewards"), false);
  assert.deepEqual(rewardLanes.map((lane) => lane.kind), ["reward"]);

  assert.equal(requiresRewardLane("insurance"), false);
  assert.equal(requiresProtectionLane("insurance"), true);
  assert.deepEqual(insuranceLanes.map((lane) => lane.kind), ["protection"]);

  assert.equal(requiresRewardLane("hybrid"), true);
  assert.equal(requiresProtectionLane("hybrid"), true);
  assert.deepEqual(hybridLanes.map((lane) => lane.kind), ["reward", "protection"]);

  for (const lane of hybridLanes) {
    assert.equal("poolType" in lane, false);
    assert.equal("planType" in lane, false);
  }
});

test("launch validation stays conditional by lane instead of a root pool type", () => {
  const rewardBasics = createValidBasics("rewards");
  rewardBasics.rewardPayoutUi = "";
  assert(validateLaunchBasics(rewardBasics).includes("Reward payout amount is required for reward-bearing launches."));

  const insuranceBasics = createValidBasics("insurance");
  insuranceBasics.rewardPayoutUi = "";
  assert(!validateLaunchBasics(insuranceBasics).includes("Reward payout amount is required for reward-bearing launches."));

  const hybridBasics = createValidBasics("hybrid");
  hybridBasics.coveragePathway = "";
  assert(validateLaunchBasics(hybridBasics).includes("Coverage path is required for insurance and hybrid launches."));

  assert(validateRewardLane(createRewardLane(true)).length === 0);
  assert.deepEqual(validateProtectionLane(createProtectionLane(false)), []);

  assert.deepEqual(validateRewardLane(createRewardLane(false)), []);
  assert(validateProtectionLane(createProtectionLane(true)).length === 0);

  const invalidRewardLane = createRewardLane(true);
  invalidRewardLane.selectedOutcomeIds = [];
  invalidRewardLane.ruleIdsByOutcome = {};
  assert(validateRewardLane(invalidRewardLane).includes("Select at least one reward outcome."));

  const invalidProtectionLane = createProtectionLane(true);
  invalidProtectionLane.premiumLineId = "";
  assert(validateProtectionLane(invalidProtectionLane).includes("Premium funding line ID is required."));
});

test("protection posture metadata survives serialization and parsing for defi and rwa coverage", () => {
  const defiPosture = createProtectionPosture("defi_native");
  const serializedDefi = serializeProtectionPosture(defiPosture);
  assert(serializedDefi);
  assert.equal(serializedDefi.coveragePathway, "defi_native");
  assert.equal(serializedDefi.defi?.settlementStyle, "onchain_programmatic");
  assert.deepEqual(parseProtectionPosture(JSON.parse(JSON.stringify(serializedDefi))), serializedDefi);

  const rwaPosture = createProtectionPosture("rwa_policy");
  const serializedRwa = serializeProtectionPosture(rwaPosture);
  assert(serializedRwa);
  assert.equal(serializedRwa.coveragePathway, "rwa_policy");
  assert.equal(serializedRwa.rwa?.legalEntityName, "OmegaX Risk SPC");
  assert.deepEqual(parseProtectionPosture(JSON.parse(JSON.stringify(serializedRwa))), serializedRwa);
});

test("review links point into the correct workspace context for reward and protection lanes", () => {
  const rewardOnly = buildLaunchReviewLinks({
    launchIntent: "rewards",
    healthPlanAddress: "health-plan-1",
    rewardSeriesAddress: "reward-series-1",
  });
  assert.equal(rewardOnly.workspaceHref, "/plans?plan=health-plan-1&series=reward-series-1&tab=overview");
  assert.equal(rewardOnly.rewardLaneHref, "/plans?plan=health-plan-1&series=reward-series-1&tab=overview");
  assert.equal(rewardOnly.protectionLaneHref, null);
  assert.equal(rewardOnly.coverageWorkspaceHref, null);

  const insuranceOnly = buildLaunchReviewLinks({
    launchIntent: "insurance",
    healthPlanAddress: "health-plan-2",
    protectionSeriesAddress: "protection-series-2",
  });
  assert.equal(insuranceOnly.workspaceHref, "/plans?plan=health-plan-2&series=protection-series-2&tab=overview");
  assert.equal(insuranceOnly.coverageWorkspaceHref, "/plans?plan=health-plan-2&series=protection-series-2&tab=overview");

  const hybrid = buildLaunchReviewLinks({
    launchIntent: "hybrid",
    healthPlanAddress: "health-plan-3",
    rewardSeriesAddress: "reward-series-3",
    protectionSeriesAddress: "protection-series-3",
  });
  assert.equal(hybrid.workspaceHref, "/plans?plan=health-plan-3&series=reward-series-3&tab=overview");
  assert.equal(hybrid.rewardLaneHref, "/plans?plan=health-plan-3&series=reward-series-3&tab=overview");
  assert.equal(hybrid.protectionLaneHref, "/plans?plan=health-plan-3&series=protection-series-3&tab=overview");
  assert.equal(hybrid.coverageWorkspaceHref, "/plans?plan=health-plan-3&series=protection-series-3&tab=overview");
});
