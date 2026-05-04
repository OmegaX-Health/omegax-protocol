import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REVIEW_DIR = join(process.cwd(), "examples", "genesis-protect-acute-actuarial-review");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

test("Genesis actuarial assumptions match public metadata", () => {
  const assumptions = readJson<any>(join(REVIEW_DIR, "assumptions.json"));

  for (const [sku, model] of Object.entries<any>(assumptions.skus)) {
    const metadata = readJson<any>(join(process.cwd(), model.metadataPath));
    assert.equal(metadata.product.coverWindowDays, model.coverWindowDays, `${sku} cover window drift`);
    assert.equal(metadata.product.benefitStyle, model.benefitStyle, `${sku} benefit style drift`);
    assert.equal(metadata.product.maxPayoutUsd, model.maxPayoutUsd, `${sku} max payout drift`);
    assert.equal(metadata.pricing.retailUsd, model.retailPremiumUsd, `${sku} retail premium drift`);
    assert.equal(metadata.pricing.cohortUsdMin, model.cohortPremiumUsdMin, `${sku} cohort min drift`);
    assert.equal(metadata.pricing.cohortUsdMax, model.cohortPremiumUsdMax, `${sku} cohort max drift`);
    assert.equal(metadata.waitingPeriods.illnessDays, model.waitingPeriods.illnessDays, `${sku} illness wait drift`);
    assert.equal(metadata.waitingPeriods.accidentHours, model.waitingPeriods.accidentHours, `${sku} accident wait drift`);
  }

  assert.deepEqual(assumptions.approvedCanonicalRedesign.historicalPriorDesign.event7, {
    retailPremiumUsd: 39,
    cohortPremiumUsdMin: 28,
    cohortPremiumUsdMax: 36,
    maxPayoutUsd: 1000,
  });
  assert.deepEqual(assumptions.approvedCanonicalRedesign.historicalPriorDesign.travel30, {
    retailPremiumUsd: 159,
    cohortPremiumUsdMin: 112,
    cohortPremiumUsdMax: 144,
    maxPayoutUsd: 3000,
  });
});

test("Genesis actuarial review generator is deterministic", () => {
  execFileSync("node", ["--import", "tsx", "scripts/genesis_actuarial_review.ts"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const first = readFileSync(join(REVIEW_DIR, "review-output.json"), "utf8");

  execFileSync("node", ["--import", "tsx", "scripts/genesis_actuarial_review.ts"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const second = readFileSync(join(REVIEW_DIR, "review-output.json"), "utf8");

  assert.equal(first, second);
});

test("Genesis launch-gate baseline and approved adverse design stay inside reserve while impairment pauses", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const byId = Object.fromEntries(output.scenarioResults.map((result: any) => [result.id, result]));

  assert.equal(byId["public-open-1000-e7-500-t30"].launchGate, "healthy");
  assert.ok(byId["public-open-1000-e7-500-t30"].p995ClaimsUsd < byId["public-open-1000-e7-500-t30"].claimsPayingReserveUsd);
  assert.equal(byId["adverse-1000-e7-500-t30"].launchGate, "healthy");
  assert.equal(byId["lp-exit-1000-e7"].launchGate, "pause");
  assert.ok(byId["lp-exit-1000-e7"].additionalReserveNeededUsd > 0);
});

test("Genesis stochastic scenarios carry the p99.5 target quantile", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  assert.equal(output.targetSolvencyQuantile, 0.995);

  const stochasticResults = output.scenarioResults.filter((result: any) =>
    ["independent_claims", "reserve_reduction"].includes(result.type),
  );
  assert.ok(stochasticResults.length >= 10);
  for (const result of stochasticResults) {
    assert.equal(typeof result.p995ClaimsUsd, "number", `${result.id} missing p99.5 claims`);
    assert.ok(result.p995ClaimsUsd >= result.p99ClaimsUsd, `${result.id} p99.5 should be >= p99`);
  }
});

test("Genesis correlated Event 7 venue stress enforces the hard cap", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const byId = Object.fromEntries(output.scenarioResults.map((result: any) => [result.id, result]));

  assert.equal(output.recommendedLaunchGates.event7SameVenueHardCapMembers, 50);
  assert.equal(byId["event7-same-venue-50"].launchGate, "healthy");
  assert.equal(byId["event7-same-venue-75"].launchGate, "caution");
  assert.equal(byId["event7-same-venue-100"].launchGate, "caution");
});

test("Genesis Travel 30 approved design clears adverse issuance while regional clusters still pause", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const byId = Object.fromEntries(output.scenarioResults.map((result: any) => [result.id, result]));

  assert.equal(byId["travel30-only-500"].launchGate, "healthy");
  assert.equal(byId["travel30-only-adverse-500"].launchGate, "healthy");
  assert.equal(byId["travel30-regional-illness-cluster-100"].launchGate, "healthy");
  assert.equal(byId["travel30-regional-illness-cluster-200"].launchGate, "pause");
});

test("Genesis pricing recommendations satisfy the p99.5 solvency gate while preserving current-state classification", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));

  for (const recommendation of output.pricingRecommendations) {
    assert.ok(recommendation.current.launchGate);
    assert.equal(recommendation.recommended.launchGate, "healthy");
    assert.ok(recommendation.recommended.p995ClaimsUsd < recommendation.recommended.claimsPayingReserveUsd);
    assert.equal(recommendation.recommended.premiumUsd, recommendation.current.premiumUsd);
    assert.equal(recommendation.recommended.capUsd, recommendation.current.capUsd);
  }

  const travel30 = output.pricingRecommendations.find((entry: any) => entry.sku === "travel30");
  assert.equal(travel30.current.launchGate, "healthy");
  assert.equal(travel30.current.premiumUsd, 99);
  assert.equal(travel30.current.capUsd, 3000);
});

test("Genesis generated memo and canonical plan agree with JSON headline gates", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const memo = readFileSync(join(REVIEW_DIR, "review-memo.md"), "utf8");
  const canonicalPlan = readFileSync(join(REVIEW_DIR, "canonical-update-plan.md"), "utf8");

  assert.match(memo, new RegExp(`Public-open ceiling remains ${output.recommendedLaunchGates.publicOpenCeiling.event7Members}`));
  assert.match(memo, /p99\.5/i);
  assert.match(canonicalPlan, new RegExp(output.canonicalUpdatePlan.status));
  assert.equal(output.canonicalUpdatePlan.status, "approved_applied_in_repo");
  assert.equal(output.canonicalUpdatePlan.historicalPriorDesign.travel30.retailPremiumUsd, 159);
  assert.equal(output.canonicalUpdatePlan.appliedDesign.travel30.retailPremiumUsd, 99);
  for (const change of output.canonicalUpdatePlan.changes) {
    assert.match(canonicalPlan, new RegExp(change.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Genesis claim simulations do not approve or reserve above approved caps", () => {
  const simulations = readJson<any>(
    join(process.cwd(), "examples", "genesis-protect-acute-claims", "genesis-acute-claim-simulations-v1.json"),
  );
  const capByCollection: Record<string, number> = {
    event7Scenarios: 1000,
    travel30Scenarios: 3000,
  };
  const cappedPayoutKeys = new Set([
    "amountClaimed",
    "amountApproved",
    "amountReserved",
    "approvedAmountUsdc",
    "paidAmountUsdc",
    "reservedAmountUsdc",
    "payableAmountUsdc",
  ]);

  for (const [collection, cap] of Object.entries(capByCollection)) {
    for (const scenario of simulations[collection]) {
      assert.equal(scenario.claimFinancials.productMaxBenefit, cap);
      const stack = [scenario.claimFinancials, scenario.onChainOutcome];
      while (stack.length > 0) {
        const value = stack.pop();
        if (!value || typeof value !== "object") continue;
        for (const [key, nested] of Object.entries(value)) {
          if (typeof nested === "number" && cappedPayoutKeys.has(key)) {
            assert.ok(nested <= cap, `${scenario.scenarioId}.${key} exceeds ${cap}`);
          } else if (nested && typeof nested === "object") {
            stack.push(nested);
          }
        }
      }
    }
  }
});
