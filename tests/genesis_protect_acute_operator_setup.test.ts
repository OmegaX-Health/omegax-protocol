import assert from "node:assert/strict";
import test from "node:test";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import genesisCatalogModule from "../frontend/lib/genesis-protect-acute.ts";
import genesisOperatorModule from "../frontend/lib/genesis-protect-acute-operator.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_PLAN_ID,
  GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
  GENESIS_PROTECT_ACUTE_POOL_ID,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_SKUS,
} = genesisCatalogModule as typeof import("../frontend/lib/genesis-protect-acute.ts");
const {
  buildGenesisProtectAcuteSetupModel,
  buildGenesisProtectAcuteWizardDefaults,
  GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
  genesisProtectAcuteBootstrapAllocations,
  genesisProtectAcuteBootstrapCapitalClasses,
  genesisProtectAcuteBootstrapFundingLines,
} = genesisOperatorModule as typeof import("../frontend/lib/genesis-protect-acute-operator.ts");

function cloneFixtureSnapshot() {
  return structuredClone(DEVNET_PROTOCOL_FIXTURE_STATE);
}

test("Genesis operator bootstrap definitions stay aligned to the canonical launch ids", () => {
  const fundingLines = genesisProtectAcuteBootstrapFundingLines();
  const classes = genesisProtectAcuteBootstrapCapitalClasses();
  const allocations = genesisProtectAcuteBootstrapAllocations();

  assert.deepEqual(
    fundingLines.map((line) => [line.lineId, line.fundingPriority]),
    [
      [GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.sponsor, 0],
      [GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.premium, 1],
      [GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.liquidity, 2],
      [GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium, 3],
      [GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity, 4],
    ],
  );
  assert.deepEqual(
    classes.map((entry) => [entry.classId, entry.priority]),
    [
      [GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID, 0],
      [GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID, 1],
    ],
  );
  assert.deepEqual(
    allocations.map((entry) => [entry.key, entry.classId, entry.fundingLineId, entry.weightBps]),
    [
      ["event7-junior", GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID, GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.liquidity, 2175],
      ["travel30-senior", GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID, GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity, 4350],
      ["travel30-junior", GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID, GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity, 3475],
    ],
  );
});

test("Genesis wizard defaults pin the canonical plan shell", () => {
  const defaults = buildGenesisProtectAcuteWizardDefaults();

  assert.equal(defaults.templateKey, GENESIS_PROTECT_ACUTE_TEMPLATE_KEY);
  assert.equal(defaults.planId, GENESIS_PROTECT_ACUTE_PLAN_ID);
  assert.equal(defaults.displayName, GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME);
  assert.equal(defaults.metadataUri, GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI);
  assert.ok(defaults.payoutMint.length > 0);
});

test("Genesis setup model stays in caution while queue-only launch sleeves remain active", () => {
  const model = buildGenesisProtectAcuteSetupModel({
    snapshot: cloneFixtureSnapshot(),
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
    },
  });

  assert.equal(model.checklist.planShellReady, true);
  assert.equal(model.checklist.event7SeriesReady, true);
  assert.equal(model.checklist.travel30SeriesReady, true);
  assert.equal(model.checklist.fundingLinesReady, true);
  assert.equal(model.checklist.poolReady, true);
  assert.equal(model.posture.state, "caution");
  assert.equal(model.queueOnlyRedemptionsActive, true);
});

test("Genesis setup model can reach healthy when setup is complete and queue-only pressure is cleared", () => {
  const snapshot = cloneFixtureSnapshot();
  const plan = snapshot.healthPlans.find((entry) => entry.planId === GENESIS_PROTECT_ACUTE_PLAN_ID)!;
  const pool = snapshot.liquidityPools.find((entry) => entry.poolId === GENESIS_PROTECT_ACUTE_POOL_ID)!;
  plan.sponsorOperator = "GenSponsor11111111111111111111111111111111";
  plan.claimsOperator = "GenClaims1111111111111111111111111111111";
  plan.oracleAuthority = "GenOracle1111111111111111111111111111111";
  pool.redemptionPolicy = 0;
  for (const capitalClass of snapshot.capitalClasses.filter((entry) => entry.liquidityPool === pool.address)) {
    capitalClass.queueOnlyRedemptions = false;
  }

  const model = buildGenesisProtectAcuteSetupModel({
    snapshot,
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
    },
  });

  assert.equal(model.posture.state, "healthy");
  assert.equal(model.queueOnlyRedemptionsActive, false);
  assert.equal(model.checklist.reserveTargetReviewReady, true);
});

test("Genesis setup model becomes paused when launch controls are paused", () => {
  const snapshot = cloneFixtureSnapshot();
  const pool = snapshot.liquidityPools.find((entry) => entry.poolId === GENESIS_PROTECT_ACUTE_POOL_ID)!;
  pool.pauseFlags = 1;

  const model = buildGenesisProtectAcuteSetupModel({
    snapshot,
    readiness: {
      poolTermsConfigured: true,
      poolOraclePolicyConfigured: true,
    },
  });

  assert.equal(model.posture.state, "paused");
  assert.match(model.posture.reasons.join(" "), /blocking issuance/i);
});
