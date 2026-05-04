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

test("Nomad curve end-to-end drill mints signed quotes into capped entitlements", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const e2e = output.endToEndPoc;

  assert(e2e.productionLogic.includes("risk_backers_deposit_any_amount_for_junior_backstop_shares"));
  assert.equal(e2e.riskBackerMarket.positions.length, 3);
  assert.equal(e2e.riskBackerMarket.positions[0].depositUsd, 15);
  assert.equal(e2e.quoteReceipts.length, 3);
  assert.equal(e2e.entitlements.length, 3);

  for (const quote of e2e.quoteReceipts) {
    assert.match(quote.quoteId, /^quote_/);
    assert.match(quote.signature, /^[0-9a-f]{64}$/);
    const entitlement = e2e.entitlements.find((entry: any) => entry.quoteId === quote.quoteId);
    assert(entitlement, `missing entitlement for ${quote.quoteId}`);
    assert.equal(entitlement.coverageCapUsd, quote.coverageCapUsd);
    assert.equal(entitlement.premiumPaidUsd, quote.premiumUsedUsd);
  }
});

test("Nomad curve end-to-end drill enforces caps, waiting periods, and exclusions", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const claims = Object.fromEntries(output.endToEndPoc.claimDecisions.map((claim: any) => [claim.claimId, claim]));
  const entitlements = Object.fromEntries(output.endToEndPoc.entitlements.map((entry: any) => [entry.member, entry]));

  assert.equal(claims.claim_micro_accident_over_cap.decision, "approved");
  assert.equal(claims.claim_micro_accident_over_cap.approvedUsd, entitlements.nomad_micro.coverageCapUsd);
  assert(claims.claim_micro_accident_over_cap.deniedOverCapUsd > 0);
  assert.equal(entitlements.nomad_micro.status, "exhausted");

  assert.equal(claims.claim_standard_illness_wait.decision, "denied");
  assert.equal(claims.claim_standard_illness_wait.denialReason, "illness_waiting_period");
  assert.equal(claims.claim_standard_covered_illness.decision, "approved");
  assert.equal(claims.claim_standard_covered_illness.approvedUsd, 1650);
  assert.equal(claims.claim_budget_routine_denial.denialReason, "not_covered");

  assert.equal(output.endToEndPoc.paidClaimsUsd, 1936);
  assert.equal(output.endToEndPoc.remainingCoverageLimitUsd, 877);
  assert(output.endToEndPoc.finalReserveUsd > 0);
});

test("Nomad hybrid model report compares viable market-insurance mixes", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));
  const report = readFileSync(join(REVIEW_DIR, "hybrid-model-report.md"), "utf8");
  const byId = Object.fromEntries(output.hybridModelResults.map((model: any) => [model.id, model]));

  assert.equal(output.hybridModelResults.length, 10);
  assert.equal(byId["separated-backstop-curve"].verdict, "ship_candidate");
  assert.equal(byId["separated-backstop-curve"].launchGate, "healthy");
  assert.equal(byId["calibrated-pay-anything-curve"].verdict, "ship_candidate");
  assert.equal(byId["calibrated-pay-anything-curve"].launchGate, "healthy");
  assert.equal(byId["loss-ratio-signal-market"].verdict, "needs_wrapper");
  assert(byId["loss-ratio-signal-market"].market.marketProbabilityPct > 0);
  assert.equal(byId["underwriting-prediction-tranche"].verdict, "needs_wrapper");
  assert(byId["underwriting-prediction-tranche"].market.predictionClaimsTrancheUsd > 0);
  assert(byId["underwriting-prediction-tranche"].market.expectedCorrectPredictorRoiPct > 0);
  assert.equal(byId["collateralized-sidecar-vault"].market.trancheCount, 3);
  assert.equal(byId["parametric-fast-cash-overlay"].market.benefitUsd, 250);
  assert(byId["member-mutual-rebate-pool"].market.expectedRebatePerMemberUsd >= 0);
  assert.equal(byId["member-health-bond"].verdict, "ship_candidate");
  assert(byId["member-health-bond"].market.lockedHealthBondUsd > 0);
  assert.equal(byId["full-stack-market-mutual"].verdict, "needs_wrapper");
  assert(byId["full-stack-market-mutual"].market.expectedNoClaimRewardPerHealthyStakerUsd >= 0);
  assert.equal(byId["pure-pay-anything-pool"].verdict, "reject");
  assert.equal(byId["pure-pay-anything-pool"].launchGate, "pause");
  assert(report.includes("## Simple Language Summary"));
});

test("Nomad hybrid scale checks expose thin-capital failure modes", () => {
  const output = readJson<any>(join(REVIEW_DIR, "review-output.json"));

  for (const model of output.hybridModelResults) {
    assert.equal(model.scaleChecks.length, 3);
    assert(model.firstPrinciples.length >= 3);
    assert(model.policyDesign.length >= 3);
  }

  const parametric = output.hybridModelResults.find((model: any) => model.id === "parametric-fast-cash-overlay");
  const scaled = parametric.scaleChecks.find((check: any) => check.label === "3x demand with matching capital");
  const thin = parametric.scaleChecks.find((check: any) => check.label === "3x demand with launch capital");

  assert.equal(scaled.launchGate, "healthy");
  assert.equal(thin.launchGate, "caution");
  assert(thin.reserveToActiveLimitPct < scaled.reserveToActiveLimitPct);
});
