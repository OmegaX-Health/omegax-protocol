import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import nsCatalogModule from "../frontend/lib/network-school-acute-assist.ts";
import planLaunchModule from "../frontend/lib/plan-launch.ts";
import schemaMetadataModule from "../frontend/lib/schema-metadata.ts";
import workbenchModule from "../frontend/lib/workbench.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  NETWORK_SCHOOL_ACUTE_ASSIST_COHORT0_HARD_PAYOUT_CAP_USD,
  NETWORK_SCHOOL_ACUTE_ASSIST_COHORT0_POLICY_CAP,
  NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU,
  NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_KEY,
  NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_VERSION,
  NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_METADATA_URI,
  NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_RISK_DISCLOSURE_URL,
  NETWORK_SCHOOL_ACUTE_ASSIST_SKU_LIST,
  NETWORK_SCHOOL_ACUTE_ASSIST_SKUS,
  NETWORK_SCHOOL_ACUTE_ASSIST_TECHNICAL_TERMS_URL,
} = nsCatalogModule as typeof import("../frontend/lib/network-school-acute-assist.ts");
const { parseProtectionPosture } = planLaunchModule as typeof import("../frontend/lib/plan-launch.ts");
const { fetchSchemaMetadata } = schemaMetadataModule as typeof import("../frontend/lib/schema-metadata.ts");
const { firstProtectionSeriesAddressForPlan, linkedContextForPool } =
  workbenchModule as typeof import("../frontend/lib/workbench.ts");

type NetworkSchoolProtectionMetadataDocument = {
  version: number;
  lane: "protection";
  metadataUri: string;
  coveragePathway: "defi_native";
  defi: {
    settlementStyle: "onchain_programmatic";
    technicalTermsUri: string;
    riskDisclosureUri: string;
  };
  product: {
    sku: string;
    displayName: string;
    coverWindowDays: number;
    maxPayoutUsd: number;
    defaultSelection: boolean;
    familyPlan: boolean;
  };
  eligibility: {
    eligibleMembers: string[];
    gate: string;
    superteamEligible: boolean;
    officialNetworkSchoolBenefit: boolean;
    failClosedWhenVerifierMissing: boolean;
  };
  pricing: {
    retailUsd: number;
    termRolBps: number;
    expectedLossUsd: number;
  };
  benefitSchedule: {
    excessUsd: number;
    reimbursementPctAfterExcess: number;
    fastLaneUsd: number;
    manualReviewAboveUsd: number;
    sublimits: Array<{ label: string; amountUsd: number }>;
    householdRules?: {
      includedAdults: number;
      includedChildren: number;
      maxPaidClaimsPerWindow: number;
    };
  };
  waitingPeriods: {
    illnessHours: number;
    accidentHours: number;
    knownSymptomsExcluded: boolean;
  };
  evidenceSchema: {
    schemaKey: string;
    schemaVersion: number;
    schemaAuthority: string;
  };
  fundingLanes: {
    premium: { lineId: string; reserveRole: string };
    liquidity: { lineId: string; reserveRole: string };
  };
  issuanceControls: {
    reserveAttribution: string;
    publicStatusRule: string;
    issueWhen: string[];
    pauseWhen: string[];
  };
  launchTruth: {
    publicStatus: string;
    primaryLaunchSku: string;
    claimsTrustPhase: string;
    broadlyLiveInsurance: boolean;
    networkSchoolOfficialBenefit: boolean;
    superteamEligible: boolean;
    discordVerificationRequired: boolean;
    rawHealthEvidenceOnchain: boolean;
  };
};

function loadProtectionDocument(pathname: string): NetworkSchoolProtectionMetadataDocument {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "frontend/public", pathname.replace(/^\//, "")), "utf8"),
  ) as NetworkSchoolProtectionMetadataDocument;
}

function loadPlanDocument(pathname: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "frontend/public", pathname.replace(/^\//, "")), "utf8"),
  ) as Record<string, unknown>;
}

test("Network School Acute Assist fixtures add an invite-gated plan and four tier series on the shared acute pool", () => {
  const nsPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.planId === NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID);
  const sharedPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((pool) => pool.poolId === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID);
  const nsSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => series.healthPlan === nsPlan?.address);
  const nsFundingLines = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.filter((line) => line.healthPlan === nsPlan?.address);
  const nsAllocations = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
    (allocation) => allocation.healthPlan === nsPlan?.address,
  );

  assert(nsPlan, "expected Network School Acute Assist plan fixture");
  assert(sharedPool, "expected shared acute pool fixture");
  assert.equal(nsPlan.membershipGateKind, "invite_only");
  assert.equal(nsPlan.membershipModel, "invite-only-network-school-discord");
  assert.equal(nsPlan.membershipModeValue, 2);
  assert.equal(nsPlan.membershipGateKindValue, 1);
  assert.equal(nsSeries.length, 4);
  assert.deepEqual(nsSeries.map((series) => series.seriesId), NETWORK_SCHOOL_ACUTE_ASSIST_SKU_LIST.map((sku) => sku.seriesId));
  assert.deepEqual(nsSeries.map((series) => series.metadataUri), NETWORK_SCHOOL_ACUTE_ASSIST_SKU_LIST.map((sku) => sku.metadataUri));
  assert.equal(nsFundingLines.length, 8);
  assert.equal(nsAllocations.length, 4);
  assert.equal(nsAllocations.reduce((sum, allocation) => sum + BigInt(allocation.allocatedAmount ?? 0n), 0n), 6_000n);
  assert.equal(sharedPool.totalValueLocked, 63_500n);
  assert.equal(sharedPool.totalAllocated, 63_500n);
});

test("Network School Acute Assist metadata documents encode NS-only launch truth", () => {
  for (const definition of NETWORK_SCHOOL_ACUTE_ASSIST_SKU_LIST) {
    const document = loadProtectionDocument(definition.metadataUri);
    const parsed = parseProtectionPosture(document);

    assert(parsed, `expected ${definition.key} protection posture document`);
    assert.equal(document.metadataUri, definition.metadataUri);
    assert.equal(document.product.displayName, definition.displayName);
    assert.equal(document.product.coverWindowDays, definition.coverWindowDays);
    assert.equal(document.product.maxPayoutUsd, definition.supportLimitUsd);
    assert.equal(document.product.defaultSelection, definition.defaultSelection);
    assert.equal(document.product.familyPlan, definition.familyPlan);
    assert.equal(document.pricing.retailUsd, definition.pricing.retailUsd);
    assert.equal(document.pricing.termRolBps, definition.pricing.termRolBps);
    assert.equal(document.pricing.expectedLossUsd, definition.pricing.expectedLossUsd);
    assert.equal(document.benefitSchedule.excessUsd, definition.reimbursement.excessUsd);
    assert.equal(document.benefitSchedule.reimbursementPctAfterExcess, definition.reimbursement.reimbursementPctAfterExcess);
    assert.equal(document.benefitSchedule.fastLaneUsd, definition.fastLaneUsd);
    assert.equal(document.benefitSchedule.manualReviewAboveUsd, definition.manualReviewAboveUsd);
    assert.deepEqual(
      document.benefitSchedule.sublimits.map((sublimit) => sublimit.amountUsd),
      definition.sublimits.map((sublimit) => sublimit.amountUsd),
    );
    assert.equal(document.waitingPeriods.illnessHours, definition.waitingPeriods.illnessHours);
    assert.equal(document.waitingPeriods.accidentHours, definition.waitingPeriods.accidentHours);
    assert.equal(document.waitingPeriods.knownSymptomsExcluded, true);
    assert.equal(document.evidenceSchema.schemaKey, NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_KEY);
    assert.equal(document.evidenceSchema.schemaVersion, NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_VERSION);
    assert.equal(parsed?.defi?.technicalTermsUri, NETWORK_SCHOOL_ACUTE_ASSIST_TECHNICAL_TERMS_URL);
    assert.equal(parsed?.defi?.riskDisclosureUri, NETWORK_SCHOOL_ACUTE_ASSIST_RISK_DISCLOSURE_URL);
    assert.equal(document.fundingLanes.premium.lineId, definition.fundingLineIds.premium);
    assert.equal(document.fundingLanes.liquidity.lineId, definition.fundingLineIds.liquidity);
    assert.equal(document.eligibility.gate, "invite_only_network_school_discord");
    assert.equal(document.eligibility.superteamEligible, false);
    assert.equal(document.eligibility.officialNetworkSchoolBenefit, false);
    assert.equal(document.eligibility.failClosedWhenVerifierMissing, true);
    assert(document.eligibility.eligibleMembers.some((entry) => /short-term/.test(entry)));
    assert(document.eligibility.eligibleMembers.some((entry) => /long-term/.test(entry)));
    assert.equal(document.launchTruth.primaryLaunchSku, NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH.primaryLaunchSku);
    assert.equal(document.launchTruth.claimsTrustPhase, NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH.claimsTrustPhase);
    assert.equal(document.launchTruth.broadlyLiveInsurance, false);
    assert.equal(document.launchTruth.networkSchoolOfficialBenefit, false);
    assert.equal(document.launchTruth.superteamEligible, false);
    assert.equal(document.launchTruth.discordVerificationRequired, true);
    assert.equal(document.launchTruth.rawHealthEvidenceOnchain, false);
  }
});

test("Network School Acute Assist plan metadata preserves the Cohort 0 gate and reserve controls", () => {
  const document = loadPlanDocument(NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_METADATA_URI);
  const cohort0 = document.cohort0 as {
    policyOrHouseholdCap: number;
    hardAggregatePayoutCapUsd: number;
    defaultSku: string;
    launchSkus: string[];
    excludedSkus: string[];
  };
  const membership = document.membership as {
    mode: string;
    gateKind: string;
    failClosedWhenUnconfigured: boolean;
    eligibleMembers: string[];
    excludedCommunities: string[];
  };

  assert.equal(document.planId, NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID);
  assert.equal(membership.mode, "invite_only");
  assert.equal(membership.gateKind, "invite_only");
  assert.equal(membership.failClosedWhenUnconfigured, true);
  assert.deepEqual(membership.excludedCommunities, ["Superteam"]);
  assert(membership.eligibleMembers.some((entry) => /short-term/.test(entry)));
  assert(membership.eligibleMembers.some((entry) => /long-term/.test(entry)));
  assert.equal(cohort0.policyOrHouseholdCap, NETWORK_SCHOOL_ACUTE_ASSIST_COHORT0_POLICY_CAP);
  assert.equal(cohort0.hardAggregatePayoutCapUsd, NETWORK_SCHOOL_ACUTE_ASSIST_COHORT0_HARD_PAYOUT_CAP_USD);
  assert.equal(cohort0.defaultSku, NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU.key);
  assert.deepEqual(cohort0.launchSkus, ["lite", "core", "plus", "familyCore"]);
  assert.deepEqual(cohort0.excludedSkus, ["familyPlus"]);
});

test("Network School Acute Assist keeps shared-pool navigation explicit", () => {
  const nsPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.planId === NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID)!;
  const sharedPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((pool) => pool.poolId === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID)!;
  const coreSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find(
    (series) => series.seriesId === NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.seriesId,
  )!;

  assert.deepEqual(linkedContextForPool(sharedPool.address), {
    plan: null,
    series: null,
  });
  assert.equal(firstProtectionSeriesAddressForPlan(nsPlan.address), coreSeries.address);
});

test("Network School Acute Assist claim schema is bundled for server-side metadata fetches", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("fetch should not run for bundled schema metadata");
  };

  try {
    const result = await fetchSchemaMetadata(
      "https://protocol.omegax.health/schemas/network-school-acute-assist-claim-v1.json",
    );

    assert.equal(calls, 0);
    assert.equal(result.error, null);
    assert.equal((result.metadata as { schemaKey?: string } | null)?.schemaKey, NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_KEY);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

