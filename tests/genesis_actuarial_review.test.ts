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
    assert.equal(metadata.waitingPeriods.illnessDays, model.waitingPeriods.illnessDays, `${sku} illness wait drift`);
    assert.equal(metadata.waitingPeriods.accidentHours, model.waitingPeriods.accidentHours, `${sku} accident wait drift`);
  }
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

test("Genesis launch-gate baseline stays inside reserve while over-threshold pauses", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const byId = Object.fromEntries(output.scenarioResults.map((result: any) => [result.id, result]));

  assert.equal(byId["public-open-1000-e7-500-t30"].launchGate, "healthy");
  assert.ok(byId["public-open-1000-e7-500-t30"].p99ClaimsUsd < byId["public-open-1000-e7-500-t30"].claimsPayingReserveUsd);
  assert.equal(byId["over-threshold-3000-e7-1000-t30"].launchGate, "pause");
  assert.ok(byId["over-threshold-3000-e7-1000-t30"].reserveBreachProbability > 0.9);
});

test("Genesis correlated Event 7 venue stress enforces the hard cap", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const byId = Object.fromEntries(output.scenarioResults.map((result: any) => [result.id, result]));

  assert.equal(output.recommendedLaunchGates.event7SameVenueHardCapMembers, 50);
  assert.equal(byId["event7-same-venue-50"].launchGate, "healthy");
  assert.equal(byId["event7-same-venue-75"].launchGate, "caution");
  assert.equal(byId["event7-same-venue-100"].launchGate, "pause");
});

test("Genesis Travel 30 adverse scenarios require backstop review before broader issuance", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const byId = Object.fromEntries(output.scenarioResults.map((result: any) => [result.id, result]));

  assert.equal(byId["travel30-only-500"].launchGate, "caution");
  assert.equal(byId["travel30-only-adverse-500"].launchGate, "pause");
  assert.equal(byId["travel30-illness-cluster-100"].launchGate, "caution");
  assert.equal(byId["travel30-illness-cluster-200"].launchGate, "pause");
});
