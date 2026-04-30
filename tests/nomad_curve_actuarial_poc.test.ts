import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const REVIEW_DIR = join(process.cwd(), "examples", "nomad-protect-curve-poc");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

test("Nomad curve PoC generator is deterministic", () => {
  execFileSync("node", ["--import", "tsx", "scripts/nomad_curve_actuarial_poc.ts"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const first = readFileSync(join(REVIEW_DIR, "review-output.json"), "utf8");

  execFileSync("node", ["--import", "tsx", "scripts/nomad_curve_actuarial_poc.ts"], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
  const second = readFileSync(join(REVIEW_DIR, "review-output.json"), "utf8");

  assert.equal(first, second);
});

test("Nomad curve quote table makes 15 USD micro-cover bounded and reserve-sensitive", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const fresh = output.quoteTables.find((entry: any) => entry.id === "empty-market");
  const warm = output.quoteTables.find((entry: any) => entry.id === "warm-market");
  const stressed = output.quoteTables.find((entry: any) => entry.id === "stressed-market");

  const freshMicro = fresh.quotes.find((quote: any) => quote.budgetUsd === 15);
  const warmMicro = warm.quotes.find((quote: any) => quote.budgetUsd === 15);
  const stressedMicro = stressed.quotes.find((quote: any) => quote.budgetUsd === 15);

  assert.equal(output.status, "experimental_poc_not_genesis_v1_pricing");
  assert.equal(freshMicro.premiumUsedUsd, 15);
  assert(freshMicro.coverageCapUsd > 200);
  assert(freshMicro.coverageCapUsd < output.product.maxMemberCapUsd);
  assert(warmMicro.coverageCapUsd < freshMicro.coverageCapUsd);
  assert(stressedMicro.coverageCapUsd < warmMicro.coverageCapUsd);
  assert(stressedMicro.reserveStressMultiplier > freshMicro.reserveStressMultiplier);
});

test("Nomad curve scenarios include healthy, reserve-floor caution, and correlated pause gates", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const byId = Object.fromEntries(output.scenarioResults.map((result: any) => [result.id, result]));

  assert.equal(byId["micro-bootstrap-200"].launchGate, "healthy");
  assert.equal(byId["mixed-nomad-launch-500"].launchGate, "healthy");
  assert.equal(byId["market-backed-growth-1500"].launchGate, "healthy");
  assert.equal(byId["thin-market-growth-1500"].launchGate, "caution");
  assert(byId["thin-market-growth-1500"].reserveFloorAdditionalNeededUsd > 0);
  assert.equal(byId["nomad-hub-cluster-600"].launchGate, "pause");
  assert(byId["nomad-hub-cluster-600"].stressedClaimsUsd > byId["nomad-hub-cluster-600"].claimsPayingReserveUsd);
});

test("Nomad curve PoC keeps risk-backer capital separate from member quote budgets", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const marketBacked = output.scenarioResults.find((result: any) => result.id === "market-backed-growth-1500");
  const thinMarket = output.scenarioResults.find((result: any) => result.id === "thin-market-growth-1500");

  assert.equal(marketBacked.members, thinMarket.members);
  assert(marketBacked.riskBackerCapitalUsd > thinMarket.riskBackerCapitalUsd);
  assert(marketBacked.claimsPayingReserveUsd > thinMarket.claimsPayingReserveUsd);
  assert(marketBacked.activeCoverageLimitUsd >= thinMarket.activeCoverageLimitUsd);
  assert.equal(marketBacked.launchGate, "healthy");
  assert.equal(thinMarket.launchGate, "caution");
});
