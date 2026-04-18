import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import genesisCatalogModule from "../frontend/lib/genesis-protect-acute.ts";
import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import planLaunchModule from "../frontend/lib/plan-launch.ts";
import workbenchModule from "../frontend/lib/workbench.ts";

const {
  GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_KEY,
  GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_VERSION,
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_LAUNCH_TRUTH,
  GENESIS_PROTECT_ACUTE_PLAN_ID,
  GENESIS_PROTECT_ACUTE_POOL_ID,
  GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_SKUS,
  GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL,
} = genesisCatalogModule as typeof import("../frontend/lib/genesis-protect-acute.ts");
const { DEVNET_PROTOCOL_FIXTURE_STATE } = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const { parseProtectionPosture } = planLaunchModule as typeof import("../frontend/lib/plan-launch.ts");
const { firstProtectionSeriesAddressForPlan, linkedContextForPool } =
  workbenchModule as typeof import("../frontend/lib/workbench.ts");

type GenesisProtectionMetadataDocument = {
  metadataUri: string;
  product: {
    sku: string;
    displayName: string;
    coverWindowDays: number;
    benefitStyle: string;
    maxPayoutUsd: number;
  };
  pricing: {
    retailUsd: number;
    cohortUsdMin: number;
    cohortUsdMax: number;
    sponsorPricingNote?: string;
  };
  benefitSchedule: {
    tiers: Array<{
      benefitUsd: number;
      trigger: string;
    }>;
    reimbursementTopUp?: {
      aggregateCapUsd: number;
      description: string;
    };
  };
  waitingPeriods: {
    illnessDays: number;
    accidentHours: number;
    sponsorCohortWaiverAllowed: boolean;
  };
  evidenceSchema: {
    schemaKey: string;
    schemaVersion: number;
    schemaAuthority: string;
  };
  fundingLanes: {
    premium: {
      lineId: string;
      reserveRole: string;
    };
    liquidity: {
      lineId: string;
      reserveRole: string;
    };
    sponsor?: {
      lineId: string;
      reserveRole: string;
    };
  };
  claimsTrustModel: {
    phase0: string;
    phase1: string;
    phase2: string;
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
    fastDemoSku: string;
    claimsTrustPhase: string;
    broadlyLiveInsurance: boolean;
    predictionMarketsCountAsReserve: boolean;
    appMembershipBillingSeparate: boolean;
  };
};

function loadProtectionDocument(pathname: string): GenesisProtectionMetadataDocument {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "frontend/public", pathname.replace(/^\//, "")), "utf8"),
  ) as GenesisProtectionMetadataDocument;
}

test("Genesis Protect Acute fixtures add a dedicated launch plan, pool, and two protection series", () => {
  const genesisPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.planId === GENESIS_PROTECT_ACUTE_PLAN_ID);
  const genesisPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((pool) => pool.poolId === GENESIS_PROTECT_ACUTE_POOL_ID);
  const genesisSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => series.healthPlan === genesisPlan?.address);
  const genesisFundingLines = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.filter((line) => line.healthPlan === genesisPlan?.address);
  const genesisClasses = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.filter((capitalClass) => capitalClass.liquidityPool === genesisPool?.address);
  const genesisAllocations = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
    (allocation) => allocation.liquidityPool === genesisPool?.address,
  );

  assert(genesisPlan, "expected Genesis Protect Acute plan fixture");
  assert(genesisPool, "expected Genesis Protect Acute pool fixture");
  assert.equal(genesisSeries.length, 2);
  assert.deepEqual(
    genesisSeries.map((series) => series.seriesId),
    [GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId, GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId],
  );
  assert.deepEqual(
    genesisSeries.map((series) => series.metadataUri),
    [GENESIS_PROTECT_ACUTE_SKUS.event7.metadataUri, GENESIS_PROTECT_ACUTE_SKUS.travel30.metadataUri],
  );
  assert.equal(genesisFundingLines.length, 5);
  assert.deepEqual(
    genesisClasses.map((capitalClass) => capitalClass.classId),
    [GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID, GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID],
  );
  assert.equal(new Set(genesisAllocations.map((allocation) => allocation.healthPlan)).size, 1);
  assert.equal(new Set(genesisAllocations.map((allocation) => allocation.policySeries)).size, 2);
  assert.equal(genesisPool.totalValueLocked, 57_500n);
  assert.equal(genesisPool.totalAllocated, 57_500n);
});

test("Genesis Protect Acute metadata documents encode the canonical Event 7 and Travel 30 launch truth", () => {
  const event7Document = loadProtectionDocument(GENESIS_PROTECT_ACUTE_SKUS.event7.metadataUri);
  const travel30Document = loadProtectionDocument(GENESIS_PROTECT_ACUTE_SKUS.travel30.metadataUri);
  const parsedEvent7 = parseProtectionPosture(event7Document);
  const parsedTravel30 = parseProtectionPosture(travel30Document);

  assert(parsedEvent7, "expected Event 7 protection posture document");
  assert(parsedTravel30, "expected Travel 30 protection posture document");

  assert.equal(event7Document.metadataUri, GENESIS_PROTECT_ACUTE_SKUS.event7.metadataUri);
  assert.equal(event7Document.product.sku, "Event 7");
  assert.equal(event7Document.product.coverWindowDays, GENESIS_PROTECT_ACUTE_SKUS.event7.coverWindowDays);
  assert.equal(event7Document.product.benefitStyle, GENESIS_PROTECT_ACUTE_SKUS.event7.benefitStyle);
  assert.equal(event7Document.product.maxPayoutUsd, GENESIS_PROTECT_ACUTE_SKUS.event7.payoutCapUsd);
  assert.equal(event7Document.pricing.retailUsd, GENESIS_PROTECT_ACUTE_SKUS.event7.pricing.retailUsd);
  assert.deepEqual(
    event7Document.benefitSchedule.tiers.map((tier) => tier.benefitUsd),
    GENESIS_PROTECT_ACUTE_SKUS.event7.benefitTiers.map((tier) => tier.benefitUsd),
  );
  assert.equal(event7Document.waitingPeriods.illnessDays, GENESIS_PROTECT_ACUTE_SKUS.event7.waitingPeriods.illnessDays);
  assert.equal(event7Document.waitingPeriods.accidentHours, GENESIS_PROTECT_ACUTE_SKUS.event7.waitingPeriods.accidentHours);
  assert.equal(event7Document.waitingPeriods.sponsorCohortWaiverAllowed, true);
  assert.equal(event7Document.evidenceSchema.schemaKey, GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_KEY);
  assert.equal(event7Document.evidenceSchema.schemaVersion, GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_VERSION);
  assert.equal(parsedEvent7.defi?.technicalTermsUri, GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL);
  assert.equal(parsedEvent7.defi?.riskDisclosureUri, GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL);
  assert.equal(event7Document.fundingLanes.premium.lineId, GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.premium);
  assert.equal(event7Document.fundingLanes.sponsor?.lineId, GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.sponsor);
  assert.equal(event7Document.fundingLanes.liquidity.lineId, GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.liquidity);
  assert.equal(
    event7Document.claimsTrustModel.phase0,
    "OmegaX Health operator-backed oracle review for the current Phase 0 launch window, with internal operator escalation when needed.",
  );
  assert.match(event7Document.claimsTrustModel.phase1, /^Next phase:/);
  assert.match(event7Document.claimsTrustModel.phase2, /^Roadmap:/);
  assert.equal(
    event7Document.issuanceControls.publicStatusRule,
    GENESIS_PROTECT_ACUTE_SKUS.event7.issuanceControls.publicStatusRule,
  );
  assert.equal(event7Document.issuanceControls.issueWhen.length, 3);
  assert.equal(event7Document.issuanceControls.pauseWhen.length, 3);
  assert.equal(event7Document.launchTruth.primaryLaunchSku, GENESIS_PROTECT_ACUTE_LAUNCH_TRUTH.primaryLaunchSku);
  assert.equal(event7Document.launchTruth.fastDemoSku, GENESIS_PROTECT_ACUTE_LAUNCH_TRUTH.fastDemoSku);
  assert.equal(event7Document.launchTruth.claimsTrustPhase, GENESIS_PROTECT_ACUTE_LAUNCH_TRUTH.claimsTrustPhase);
  assert.equal(event7Document.launchTruth.broadlyLiveInsurance, false);
  assert.equal(event7Document.launchTruth.predictionMarketsCountAsReserve, false);
  assert.equal(event7Document.launchTruth.appMembershipBillingSeparate, true);

  assert.equal(travel30Document.metadataUri, GENESIS_PROTECT_ACUTE_SKUS.travel30.metadataUri);
  assert.equal(travel30Document.product.sku, "Travel 30");
  assert.equal(travel30Document.product.coverWindowDays, GENESIS_PROTECT_ACUTE_SKUS.travel30.coverWindowDays);
  assert.equal(travel30Document.product.benefitStyle, GENESIS_PROTECT_ACUTE_SKUS.travel30.benefitStyle);
  assert.equal(travel30Document.product.maxPayoutUsd, GENESIS_PROTECT_ACUTE_SKUS.travel30.payoutCapUsd);
  assert.equal(travel30Document.pricing.retailUsd, GENESIS_PROTECT_ACUTE_SKUS.travel30.pricing.retailUsd);
  assert.deepEqual(
    travel30Document.benefitSchedule.tiers.map((tier) => tier.benefitUsd),
    GENESIS_PROTECT_ACUTE_SKUS.travel30.benefitTiers.map((tier) => tier.benefitUsd),
  );
  assert.equal(
    travel30Document.benefitSchedule.reimbursementTopUp?.aggregateCapUsd,
    GENESIS_PROTECT_ACUTE_SKUS.travel30.reimbursementTopUp?.aggregateCapUsd,
  );
  assert.equal(travel30Document.waitingPeriods.illnessDays, GENESIS_PROTECT_ACUTE_SKUS.travel30.waitingPeriods.illnessDays);
  assert.equal(travel30Document.waitingPeriods.accidentHours, GENESIS_PROTECT_ACUTE_SKUS.travel30.waitingPeriods.accidentHours);
  assert.equal(travel30Document.waitingPeriods.sponsorCohortWaiverAllowed, true);
  assert.equal(travel30Document.evidenceSchema.schemaKey, GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_KEY);
  assert.equal(travel30Document.evidenceSchema.schemaVersion, GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_VERSION);
  assert.equal(parsedTravel30.defi?.technicalTermsUri, GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL);
  assert.equal(parsedTravel30.defi?.riskDisclosureUri, GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL);
  assert.equal(travel30Document.fundingLanes.premium.lineId, GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium);
  assert.equal(travel30Document.fundingLanes.liquidity.lineId, GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity);
  assert.equal(
    travel30Document.claimsTrustModel.phase0,
    "OmegaX Health operator-backed oracle review for the current Phase 0 launch window, with internal operator escalation when needed.",
  );
  assert.match(travel30Document.claimsTrustModel.phase1, /^Next phase:/);
  assert.match(travel30Document.claimsTrustModel.phase2, /^Roadmap:/);
  assert.equal(
    travel30Document.issuanceControls.publicStatusRule,
    GENESIS_PROTECT_ACUTE_SKUS.travel30.issuanceControls.publicStatusRule,
  );
  assert.equal(travel30Document.issuanceControls.issueWhen.length, 3);
  assert.equal(travel30Document.issuanceControls.pauseWhen.length, 3);
  assert.equal(travel30Document.launchTruth.publicStatus, "end_of_month_mainnet_target");
  assert.equal(travel30Document.launchTruth.primaryLaunchSku, "travel30");
  assert.equal(travel30Document.launchTruth.fastDemoSku, "event7");
  assert.equal(travel30Document.launchTruth.claimsTrustPhase, "operator_backed_oracle_phase0");
  assert.equal(travel30Document.launchTruth.broadlyLiveInsurance, false);
  assert.equal(travel30Document.launchTruth.predictionMarketsCountAsReserve, false);
  assert.equal(travel30Document.launchTruth.appMembershipBillingSeparate, true);
});

test("Genesis Protect Acute pool resolves to a unique plan context but keeps series routing explicit", () => {
  const genesisPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.planId === GENESIS_PROTECT_ACUTE_PLAN_ID)!;
  const genesisPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((pool) => pool.poolId === GENESIS_PROTECT_ACUTE_POOL_ID)!;
  const primaryLaunchSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find(
    (series) => series.seriesId === GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
  )!;

  assert.deepEqual(linkedContextForPool(genesisPool.address), {
    plan: genesisPlan.address,
    series: null,
  });
  assert.equal(firstProtectionSeriesAddressForPlan(genesisPlan.address), primaryLaunchSeries.address);
});
