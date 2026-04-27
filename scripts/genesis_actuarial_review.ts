import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SkuKey = "event7" | "travel30";

type SkuAssumption = {
  metadataPath: string;
  simulationProductId: string;
  displayName: string;
  coverWindowDays: number;
  benefitStyle: string;
  retailPremiumUsd: number;
  cohortPremiumUsdMin: number;
  cohortPremiumUsdMax: number;
  maxPayoutUsd: number;
  baselineClaimFrequency: number;
  baselineLossRatio: number;
  claimsPayingReserveUsd: number;
  safeConcurrentMembersVaR99: number;
  hardVenueCapMembers?: number;
  waitingPeriods: {
    illnessDays: number;
    accidentHours: number;
  };
  fundingLanes: string[];
};

type Assumptions = {
  schemaVersion: number;
  reviewId: string;
  purpose: string;
  methodLimitations: string[];
  monteCarlo: {
    seed: number;
    trials: number;
    quantiles: number[];
  };
  reserveModel: Record<string, unknown>;
  skus: Record<SkuKey, SkuAssumption>;
  countryPosture: Record<string, string[]>;
  sourceReferences: string[];
};

type IndependentScenario = {
  id: string;
  type: "independent_claims";
  label: string;
  event7Members: number;
  travel30Members: number;
  frequencyMultiplier: number;
  severityMultiplier: number;
};

type CorrelatedScenario = {
  id: string;
  type: "correlated_event";
  label: string;
  sku: SkuKey;
  members: number;
  affectedRate: number;
  maxBenefitRate?: number;
  customSeverityUsd?: number;
};

type ReserveReductionScenario = {
  id: string;
  type: "reserve_reduction";
  label: string;
  event7Members: number;
  travel30Members: number;
  frequencyMultiplier: number;
  severityMultiplier: number;
  reserveReductionUsd: number;
};

type Scenario = IndependentScenario | CorrelatedScenario | ReserveReductionScenario;

type ScenarioMatrix = {
  schemaVersion: number;
  scenarios: Scenario[];
};

type PublicMetadata = {
  product: {
    displayName: string;
    coverWindowDays: number;
    benefitStyle: string;
    maxPayoutUsd: number;
  };
  pricing: {
    retailUsd: number;
    cohortUsdMin: number;
    cohortUsdMax: number;
  };
  waitingPeriods: {
    illnessDays: number;
    accidentHours: number;
  };
};

type ClaimSimulationFile = {
  event7Scenarios: Array<{ product: string; clinicalSetting: { incidentCountry: string } }>;
  travel30Scenarios: Array<{ product: string; clinicalSetting: { incidentCountry: string } }>;
};

const ROOT = process.cwd();
const REVIEW_DIR = join(ROOT, "examples", "genesis-protect-acute-actuarial-review");
const CLAIM_SIMULATION_PATH = join(
  ROOT,
  "examples",
  "genesis-protect-acute-claims",
  "genesis-acute-claim-simulations-v1.json",
);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function validateMetadata(assumptions: Assumptions): void {
  for (const [skuKey, sku] of Object.entries(assumptions.skus) as Array<[SkuKey, SkuAssumption]>) {
    const metadata = readJson<PublicMetadata>(join(ROOT, sku.metadataPath));
    assertEqual(metadata.product.displayName, sku.displayName, `${skuKey} displayName drift`);
    assertEqual(metadata.product.coverWindowDays, sku.coverWindowDays, `${skuKey} coverWindowDays drift`);
    assertEqual(metadata.product.benefitStyle, sku.benefitStyle, `${skuKey} benefitStyle drift`);
    assertEqual(metadata.product.maxPayoutUsd, sku.maxPayoutUsd, `${skuKey} maxPayoutUsd drift`);
    assertEqual(metadata.pricing.retailUsd, sku.retailPremiumUsd, `${skuKey} retail premium drift`);
    assertEqual(metadata.pricing.cohortUsdMin, sku.cohortPremiumUsdMin, `${skuKey} cohort min drift`);
    assertEqual(metadata.pricing.cohortUsdMax, sku.cohortPremiumUsdMax, `${skuKey} cohort max drift`);
    assertEqual(metadata.waitingPeriods.illnessDays, sku.waitingPeriods.illnessDays, `${skuKey} illness wait drift`);
    assertEqual(metadata.waitingPeriods.accidentHours, sku.waitingPeriods.accidentHours, `${skuKey} accident wait drift`);
  }
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function binomial(n: number, p: number, rng: () => number): number {
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    if (rng() < p) count += 1;
  }
  return count;
}

function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[index]!;
}

function roundUsd(value: number): number {
  return Math.round(value);
}

function derivedSku(sku: SkuAssumption) {
  const expectedClaimCostUsd = sku.retailPremiumUsd * sku.baselineLossRatio;
  const conditionalSeverityUsd = expectedClaimCostUsd / sku.baselineClaimFrequency;
  return {
    expectedClaimCostUsd,
    conditionalSeverityUsd,
    surplusPerPolicyUsd: sku.retailPremiumUsd - expectedClaimCostUsd,
  };
}

function evaluateGate(params: { reserveUsd: number; p99ClaimsUsd: number; breachProbability: number }) {
  const marginRatio = (params.reserveUsd - params.p99ClaimsUsd) / params.reserveUsd;
  if (params.breachProbability >= 0.01 || params.p99ClaimsUsd > params.reserveUsd) {
    return "pause";
  }
  if (marginRatio < 0.15 || params.breachProbability > 0) {
    return "caution";
  }
  return "healthy";
}

function simulateIndependent(
  scenario: IndependentScenario | ReserveReductionScenario,
  assumptions: Assumptions,
  rng: () => number,
) {
  const event7 = assumptions.skus.event7;
  const travel30 = assumptions.skus.travel30;
  const event7Derived = derivedSku(event7);
  const travel30Derived = derivedSku(travel30);
  const reserveReductionUsd = "reserveReductionUsd" in scenario ? scenario.reserveReductionUsd : 0;
  const reserveUsd =
    (scenario.event7Members > 0 ? event7.claimsPayingReserveUsd : 0) +
    (scenario.travel30Members > 0 ? travel30.claimsPayingReserveUsd : 0) -
    reserveReductionUsd;
  const claims: number[] = [];

  for (let trial = 0; trial < assumptions.monteCarlo.trials; trial += 1) {
    const event7Claims =
      binomial(
        scenario.event7Members,
        Math.min(0.95, event7.baselineClaimFrequency * scenario.frequencyMultiplier),
        rng,
      ) * Math.min(event7.maxPayoutUsd, event7Derived.conditionalSeverityUsd * scenario.severityMultiplier);
    const travel30Claims =
      binomial(
        scenario.travel30Members,
        Math.min(0.95, travel30.baselineClaimFrequency * scenario.frequencyMultiplier),
        rng,
      ) * Math.min(travel30.maxPayoutUsd, travel30Derived.conditionalSeverityUsd * scenario.severityMultiplier);
    claims.push(event7Claims + travel30Claims);
  }

  const p95 = quantile(claims, 0.95);
  const p99 = quantile(claims, 0.99);
  const p995 = quantile(claims, 0.995);
  const breachProbability = claims.filter((claim) => claim > reserveUsd).length / assumptions.monteCarlo.trials;
  const expectedClaimsUsd =
    scenario.event7Members *
      event7Derived.expectedClaimCostUsd *
      scenario.frequencyMultiplier *
      scenario.severityMultiplier +
    scenario.travel30Members *
      travel30Derived.expectedClaimCostUsd *
      scenario.frequencyMultiplier *
      scenario.severityMultiplier;
  const grossPremiumUsd =
    scenario.event7Members * event7.retailPremiumUsd + scenario.travel30Members * travel30.retailPremiumUsd;

  return {
    id: scenario.id,
    type: scenario.type,
    label: scenario.label,
    event7Members: scenario.event7Members,
    travel30Members: scenario.travel30Members,
    grossPremiumUsd: roundUsd(grossPremiumUsd),
    expectedClaimsUsd: roundUsd(expectedClaimsUsd),
    expectedSurplusUsd: roundUsd(grossPremiumUsd - expectedClaimsUsd),
    claimsPayingReserveUsd: roundUsd(reserveUsd),
    reserveReductionUsd,
    p95ClaimsUsd: roundUsd(p95),
    p99ClaimsUsd: roundUsd(p99),
    p995ClaimsUsd: roundUsd(p995),
    reserveBreachProbability: Number(breachProbability.toFixed(6)),
    launchGate: evaluateGate({ reserveUsd, p99ClaimsUsd: p99, breachProbability }),
  };
}

function simulateCorrelated(scenario: CorrelatedScenario, assumptions: Assumptions) {
  const sku = assumptions.skus[scenario.sku];
  const severityUsd = scenario.customSeverityUsd ?? sku.maxPayoutUsd * (scenario.maxBenefitRate ?? 1);
  const stressedClaimsUsd = scenario.members * scenario.affectedRate * severityUsd;
  const marginRatio = (sku.claimsPayingReserveUsd - stressedClaimsUsd) / sku.claimsPayingReserveUsd;
  const launchGate =
    stressedClaimsUsd > sku.claimsPayingReserveUsd
      ? "pause"
      : marginRatio < 0.25 || (scenario.sku === "event7" && scenario.members > (sku.hardVenueCapMembers ?? Infinity))
        ? "caution"
        : "healthy";

  return {
    id: scenario.id,
    type: scenario.type,
    label: scenario.label,
    sku: scenario.sku,
    members: scenario.members,
    affectedRate: scenario.affectedRate,
    severityUsd: roundUsd(severityUsd),
    stressedClaimsUsd: roundUsd(stressedClaimsUsd),
    claimsPayingReserveUsd: sku.claimsPayingReserveUsd,
    reserveMarginUsd: roundUsd(sku.claimsPayingReserveUsd - stressedClaimsUsd),
    launchGate,
  };
}

function summarizeClaimSimulations(assumptions: Assumptions) {
  const simulations = readJson<ClaimSimulationFile>(CLAIM_SIMULATION_PATH);
  const scenarios = [...simulations.event7Scenarios, ...simulations.travel30Scenarios];
  const countries = [...new Set(scenarios.map((scenario) => scenario.clinicalSetting.incidentCountry))].sort();

  return {
    totalScenarios: scenarios.length,
    event7Scenarios: simulations.event7Scenarios.length,
    travel30Scenarios: simulations.travel30Scenarios.length,
    countriesRepresented: countries.length,
    countries,
    productCounts: {
      event7: simulations.event7Scenarios.filter(
        (scenario) => scenario.product === assumptions.skus.event7.simulationProductId,
      ).length,
      travel30: simulations.travel30Scenarios.filter(
        (scenario) => scenario.product === assumptions.skus.travel30.simulationProductId,
      ).length,
    },
  };
}

function buildReviewOutput() {
  const assumptions = readJson<Assumptions>(join(REVIEW_DIR, "assumptions.json"));
  const matrix = readJson<ScenarioMatrix>(join(REVIEW_DIR, "scenario-matrix.json"));
  validateMetadata(assumptions);

  const rng = createRng(assumptions.monteCarlo.seed);
  const scenarioResults = matrix.scenarios.map((scenario) => {
    if (scenario.type === "correlated_event") return simulateCorrelated(scenario, assumptions);
    return simulateIndependent(scenario, assumptions, rng);
  });
  const claimSimulationCoverage = summarizeClaimSimulations(assumptions);
  const derivedAssumptions = Object.fromEntries(
    (Object.entries(assumptions.skus) as Array<[SkuKey, SkuAssumption]>).map(([key, sku]) => [
      key,
      {
        expectedClaimCostUsd: Number(derivedSku(sku).expectedClaimCostUsd.toFixed(2)),
        conditionalSeverityUsd: Number(derivedSku(sku).conditionalSeverityUsd.toFixed(2)),
        surplusPerPolicyUsd: Number(derivedSku(sku).surplusPerPolicyUsd.toFixed(2)),
      },
    ]),
  );

  return {
    generated: true,
    generatedAt: "2026-04-27T00:00:00.000Z",
    reviewId: assumptions.reviewId,
    purpose: assumptions.purpose,
    validation: {
      metadataAligned: true,
      claimSimulationCoverage,
    },
    derivedAssumptions,
    scenarioResults,
    recommendedLaunchGates: {
      publicOpenCeiling: {
        event7Members: 1000,
        travel30Members: 500,
        rationale: "Baseline p99 remains inside the current combined reserve, while adverse sensitivity already requires caution.",
      },
      event7SameVenueHardCapMembers: assumptions.skus.event7.hardVenueCapMembers,
      travel30SponsorReviewThresholdMembers: 100,
      reserveStateThresholds: {
        healthy: "p99 claims remain at least 15% below claims-paying reserve and breach probability is zero in the deterministic run",
        caution: "p99 reserve margin is below 15%, any modeled breach occurs below 1%, or correlated scenario exceeds an operational cap",
        pause: "p99 claims exceed claims-paying reserve or modeled breach probability is at least 1%",
      },
      countryPosture: assumptions.countryPosture,
    },
    limitations: assumptions.methodLimitations,
    sourceReferences: assumptions.sourceReferences,
  };
}

const output = buildReviewOutput();
writeFileSync(join(REVIEW_DIR, "review-output.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated ${join("examples", "genesis-protect-acute-actuarial-review", "review-output.json")}`);
