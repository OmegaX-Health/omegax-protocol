import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SkuKey = "event7" | "travel30";
type Gate = "healthy" | "caution" | "pause";

type SeverityModel = {
  minUsd: number;
  modeUsd: number;
  p95Usd: number;
  maxUsd: number;
};

type PricingDesign = {
  candidateRetailPremiumsUsd: number[];
  candidateCapsUsd: number[];
  targetCohortDiscountsPct: number[];
  optimizerScenarioId: string;
};

type ClaimsOpsModel = {
  reviewers: number;
  casesPerReviewerPerWeek: number;
  targetReviewHours: number;
  incompleteEvidenceHoldRate: number;
};

type CapitalStack = {
  premiumReserveUsd: number;
  sponsorBackstopUsd: number;
  juniorFirstLossUsd: number;
  seniorLpReserveUsd: number;
};

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
  severityModel: SeverityModel;
  pricingDesign: PricingDesign;
  capitalStack: CapitalStack;
  fundingLanes: string[];
};

type CountryPosture = Record<"available" | "sponsor_only" | "waitlist" | "unavailable", string[]>;

type Assumptions = {
  schemaVersion: number;
  reviewId: string;
  purpose: string;
  methodLimitations: string[];
  targetSolvencyQuantile: number;
  monteCarlo: {
    seed: number;
    trials: number;
    quantiles: number[];
  };
  reserveModel: Record<string, unknown>;
  approvedCanonicalRedesign?: {
    status: string;
    approvedAt: string;
    approvalBasis: string;
    historicalPriorDesign: Record<SkuKey, {
      retailPremiumUsd: number;
      cohortPremiumUsdMin: number;
      cohortPremiumUsdMax: number;
      maxPayoutUsd: number;
    }>;
    appliedDesign: Record<SkuKey, {
      retailPremiumUsd: number;
      cohortPremiumUsdMin: number;
      cohortPremiumUsdMax: number;
      maxPayoutUsd: number;
    }>;
  };
  claimsOps: ClaimsOpsModel;
  skus: Record<SkuKey, SkuAssumption>;
  countryPosture: CountryPosture;
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
  memberMonths?: number;
  countryTier?: keyof CountryPosture;
  sponsorBackstopUsd?: number;
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

type ClaimsOpsScenario = {
  id: string;
  type: "claims_ops";
  label: string;
  event7Members: number;
  travel30Members: number;
  weeks: number;
  frequencyMultiplier: number;
};

type Scenario = IndependentScenario | CorrelatedScenario | ReserveReductionScenario | ClaimsOpsScenario;

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

type StochasticResult = ReturnType<typeof simulateIndependent>;
type ScenarioResult = StochasticResult | ReturnType<typeof simulateCorrelated> | ReturnType<typeof simulateClaimsOps>;

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

function normalSample(mean: number, standardDeviation: number, rng: () => number): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = Math.max(rng(), Number.EPSILON);
  return mean + standardDeviation * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function claimCount(n: number, p: number, rng: () => number): number {
  const probability = Math.min(0.95, Math.max(0, p));
  if (n <= 220) {
    let count = 0;
    for (let i = 0; i < n; i += 1) {
      if (rng() < probability) count += 1;
    }
    return count;
  }
  const mean = n * probability;
  const sd = Math.sqrt(n * probability * (1 - probability));
  return Math.min(n, Math.max(0, Math.round(normalSample(mean, sd, rng))));
}

function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[index]!;
}

function roundUsd(value: number): number {
  return Math.round(value);
}

function roundPercent(value: number): number {
  return Number((value * 100).toFixed(2));
}

function sampleSeverity(model: SeverityModel, capUsd: number, severityMultiplier: number, rng: () => number): number {
  const u = rng();
  let severity: number;
  if (u < 0.7) {
    severity = model.minUsd + (model.modeUsd - model.minUsd) * Math.sqrt(u / 0.7);
  } else if (u < 0.95) {
    severity = model.modeUsd + (model.p95Usd - model.modeUsd) * ((u - 0.7) / 0.25) ** 1.35;
  } else {
    severity = model.p95Usd + (model.maxUsd - model.p95Usd) * ((u - 0.95) / 0.05) ** 2;
  }
  return Math.min(capUsd, severity * severityMultiplier);
}

function sampleSkuClaims(
  params: {
    members: number;
    sku: SkuAssumption;
    capUsd: number;
    frequencyMultiplier: number;
    severityMultiplier: number;
  },
  rng: () => number,
): number {
  const claims = claimCount(params.members, params.sku.baselineClaimFrequency * params.frequencyMultiplier, rng);
  let total = 0;
  for (let i = 0; i < claims; i += 1) {
    total += sampleSeverity(params.sku.severityModel, params.capUsd, params.severityMultiplier, rng);
  }
  return total;
}

function expectedClaimCostUsd(sku: SkuAssumption, frequencyMultiplier = 1, severityMultiplier = 1): number {
  return sku.retailPremiumUsd * sku.baselineLossRatio * frequencyMultiplier * severityMultiplier;
}

function evaluateGate(params: { reserveUsd: number; p995ClaimsUsd: number; breachProbability: number }): Gate {
  const marginRatio = (params.reserveUsd - params.p995ClaimsUsd) / params.reserveUsd;
  if (params.breachProbability >= 0.01 || params.p995ClaimsUsd > params.reserveUsd) return "pause";
  if (marginRatio < 0.15 || params.breachProbability > 0) return "caution";
  return "healthy";
}

function simulatePortfolioClaims(
  params: {
    event7Members: number;
    travel30Members: number;
    event7CapUsd: number;
    travel30CapUsd: number;
    frequencyMultiplier: number;
    severityMultiplier: number;
    reserveUsd: number;
  },
  assumptions: Assumptions,
  seedOffset: number,
) {
  const rng = createRng((assumptions.monteCarlo.seed + seedOffset) >>> 0);
  const claims: number[] = [];
  for (let trial = 0; trial < assumptions.monteCarlo.trials; trial += 1) {
    claims.push(
      sampleSkuClaims({
        members: params.event7Members,
        sku: assumptions.skus.event7,
        capUsd: params.event7CapUsd,
        frequencyMultiplier: params.frequencyMultiplier,
        severityMultiplier: params.severityMultiplier,
      }, rng) +
      sampleSkuClaims({
        members: params.travel30Members,
        sku: assumptions.skus.travel30,
        capUsd: params.travel30CapUsd,
        frequencyMultiplier: params.frequencyMultiplier,
        severityMultiplier: params.severityMultiplier,
      }, rng),
    );
  }
  const p95 = quantile(claims, 0.95);
  const p99 = quantile(claims, 0.99);
  const p995 = quantile(claims, assumptions.targetSolvencyQuantile);
  const breachProbability = claims.filter((claim) => claim > params.reserveUsd).length / assumptions.monteCarlo.trials;
  return {
    averageClaimsUsd: roundUsd(claims.reduce((sum, value) => sum + value, 0) / claims.length),
    p95ClaimsUsd: roundUsd(p95),
    p99ClaimsUsd: roundUsd(p99),
    p995ClaimsUsd: roundUsd(p995),
    reserveBreachProbability: Number(breachProbability.toFixed(6)),
  };
}

function scenarioReserveUsd(
  scenario: IndependentScenario | ReserveReductionScenario,
  assumptions: Assumptions,
): number {
  const reserveReductionUsd = "reserveReductionUsd" in scenario ? scenario.reserveReductionUsd : 0;
  const sponsorBackstopUsd = "sponsorBackstopUsd" in scenario ? scenario.sponsorBackstopUsd ?? 0 : 0;
  return (
    (scenario.event7Members > 0 ? assumptions.skus.event7.claimsPayingReserveUsd : 0) +
    (scenario.travel30Members > 0 ? assumptions.skus.travel30.claimsPayingReserveUsd : 0) +
    sponsorBackstopUsd -
    reserveReductionUsd
  );
}

function simulateIndependent(
  scenario: IndependentScenario | ReserveReductionScenario,
  assumptions: Assumptions,
  seedOffset: number,
) {
  const event7 = assumptions.skus.event7;
  const travel30 = assumptions.skus.travel30;
  const reserveUsd = scenarioReserveUsd(scenario, assumptions);
  const result = simulatePortfolioClaims({
    event7Members: scenario.event7Members,
    travel30Members: scenario.travel30Members,
    event7CapUsd: event7.maxPayoutUsd,
    travel30CapUsd: travel30.maxPayoutUsd,
    frequencyMultiplier: scenario.frequencyMultiplier,
    severityMultiplier: scenario.severityMultiplier,
    reserveUsd,
  }, assumptions, seedOffset);
  const grossPremiumUsd =
    scenario.event7Members * event7.retailPremiumUsd + scenario.travel30Members * travel30.retailPremiumUsd;
  const expectedClaimsUsd =
    scenario.event7Members * expectedClaimCostUsd(event7, scenario.frequencyMultiplier, scenario.severityMultiplier) +
    scenario.travel30Members * expectedClaimCostUsd(travel30, scenario.frequencyMultiplier, scenario.severityMultiplier);
  const capitalRequiredAtTargetUsd = Math.max(0, result.p995ClaimsUsd - grossPremiumUsd);
  const additionalReserveNeededUsd = Math.max(0, result.p995ClaimsUsd - reserveUsd);
  const reserveReductionUsd = "reserveReductionUsd" in scenario ? scenario.reserveReductionUsd : 0;
  const sponsorBackstopUsd = "sponsorBackstopUsd" in scenario ? scenario.sponsorBackstopUsd ?? 0 : 0;

  return {
    id: scenario.id,
    type: scenario.type,
    label: scenario.label,
    event7Members: scenario.event7Members,
    travel30Members: scenario.travel30Members,
    countryTier: "countryTier" in scenario ? scenario.countryTier ?? null : null,
    grossPremiumUsd: roundUsd(grossPremiumUsd),
    expectedClaimsUsd: roundUsd(expectedClaimsUsd),
    expectedSurplusUsd: roundUsd(grossPremiumUsd - expectedClaimsUsd),
    averageSimulatedClaimsUsd: result.averageClaimsUsd,
    claimsPayingReserveUsd: roundUsd(reserveUsd),
    reserveReductionUsd,
    sponsorBackstopUsd,
    p95ClaimsUsd: result.p95ClaimsUsd,
    p99ClaimsUsd: result.p99ClaimsUsd,
    p995ClaimsUsd: result.p995ClaimsUsd,
    capitalRequiredAtTargetUsd,
    additionalReserveNeededUsd,
    reserveBreachProbability: result.reserveBreachProbability,
    launchGate: evaluateGate({ reserveUsd, p995ClaimsUsd: result.p995ClaimsUsd, breachProbability: result.reserveBreachProbability }),
  };
}

function simulateCorrelated(scenario: CorrelatedScenario, assumptions: Assumptions) {
  const sku = assumptions.skus[scenario.sku];
  const severityUsd = scenario.customSeverityUsd ?? sku.maxPayoutUsd * (scenario.maxBenefitRate ?? 1);
  const stressedClaimsUsd = scenario.members * scenario.affectedRate * severityUsd;
  const marginRatio = (sku.claimsPayingReserveUsd - stressedClaimsUsd) / sku.claimsPayingReserveUsd;
  const launchGate: Gate =
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

function simulateClaimsOps(scenario: ClaimsOpsScenario, assumptions: Assumptions) {
  const event7ExpectedClaims = scenario.event7Members * assumptions.skus.event7.baselineClaimFrequency * scenario.frequencyMultiplier;
  const travel30ExpectedClaims = scenario.travel30Members * assumptions.skus.travel30.baselineClaimFrequency * scenario.frequencyMultiplier;
  const expectedCases = event7ExpectedClaims + travel30ExpectedClaims;
  const availableCapacity = assumptions.claimsOps.reviewers * assumptions.claimsOps.casesPerReviewerPerWeek * scenario.weeks;
  const evidenceHoldCases = expectedCases * assumptions.claimsOps.incompleteEvidenceHoldRate;
  const utilization = expectedCases / availableCapacity;
  const launchGate: Gate = utilization > 1 ? "pause" : utilization > 0.8 || evidenceHoldCases > availableCapacity * 0.25 ? "caution" : "healthy";

  return {
    id: scenario.id,
    type: scenario.type,
    label: scenario.label,
    weeks: scenario.weeks,
    expectedCases: Number(expectedCases.toFixed(2)),
    evidenceHoldCases: Number(evidenceHoldCases.toFixed(2)),
    operatorCapacityCases: availableCapacity,
    operatorUtilizationPct: Number((utilization * 100).toFixed(2)),
    targetReviewHours: assumptions.claimsOps.targetReviewHours,
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

function scoreCountryPosture(assumptions: Assumptions) {
  const tierScores: Record<keyof CountryPosture, number> = {
    available: 90,
    sponsor_only: 68,
    waitlist: 45,
    unavailable: 10,
  };
  return Object.fromEntries(
    Object.entries(assumptions.countryPosture).map(([tier, countries]) => [
      tier,
      countries.map((country) => ({
        country,
        operationalReadinessScore: tierScores[tier as keyof CountryPosture],
        posture: tier,
      })),
    ]),
  );
}

function scenarioById(matrix: ScenarioMatrix, id: string): IndependentScenario {
  const scenario = matrix.scenarios.find((entry) => entry.id === id);
  if (!scenario || scenario.type !== "independent_claims") {
    throw new Error(`Expected independent pricing optimizer scenario: ${id}`);
  }
  return scenario;
}

function optimizeSkuPricing(skuKey: SkuKey, assumptions: Assumptions, matrix: ScenarioMatrix, seedOffset: number) {
  const sku = assumptions.skus[skuKey];
  const event7 = assumptions.skus.event7;
  const travel30 = assumptions.skus.travel30;
  const optimizerScenario = scenarioById(matrix, sku.pricingDesign.optimizerScenarioId);
  const members = skuKey === "event7" ? optimizerScenario.event7Members : optimizerScenario.travel30Members;
  const currentPremium = sku.retailPremiumUsd;
  const currentCap = sku.maxPayoutUsd;
  const candidates = sku.pricingDesign.candidateRetailPremiumsUsd.flatMap((premium) =>
    sku.pricingDesign.candidateCapsUsd.map((cap) => ({ premium, cap })),
  );
  let currentEvaluation: ReturnType<typeof evaluateCandidate> | null = null;
  const evaluations = candidates.map((candidate, index) => {
    const evaluation = evaluateCandidate({
      skuKey,
      premiumUsd: candidate.premium,
      capUsd: candidate.cap,
      scenario: optimizerScenario,
      assumptions,
      seedOffset: seedOffset + index * 97,
    });
    if (candidate.premium === currentPremium && candidate.cap === currentCap) currentEvaluation = evaluation;
    return evaluation;
  });
  const healthyCandidates = evaluations.filter((entry) => entry.launchGate === "healthy");
  const recommended = currentEvaluation?.launchGate === "healthy"
    ? currentEvaluation
    : healthyCandidates.sort((left, right) =>
      left.premiumUsd - right.premiumUsd || left.capUsd - right.capUsd,
    )[0] ?? evaluations.sort((left, right) => left.additionalReserveNeededUsd - right.additionalReserveNeededUsd)[0]!;
  const cohortBands = sku.pricingDesign.targetCohortDiscountsPct.map((discount) => ({
    discountPct: roundPercent(discount),
    cohortPremiumUsd: Math.ceil(recommended.premiumUsd * (1 - discount)),
  }));
  const currentReserve = sku.claimsPayingReserveUsd;
  const currentStack = sku.capitalStack;
  const lpCapital = currentStack.juniorFirstLossUsd + currentStack.seniorLpReserveUsd;
  const expectedAnnualSurplusAtRecommended =
    members * (recommended.premiumUsd - expectedClaimCostUsd(sku, optimizerScenario.frequencyMultiplier, optimizerScenario.severityMultiplier));

  return {
    sku: skuKey,
    optimizerScenarioId: optimizerScenario.id,
    members,
    current: currentEvaluation,
    recommended,
    cohortBands,
    currentReserveUsd: currentReserve,
    additionalReserveNeededAtRecommendedUsd: recommended.additionalReserveNeededUsd,
    lpApyBandPct: {
      conservative: lpCapital > 0 ? roundPercent((expectedAnnualSurplusAtRecommended * 0.6) / lpCapital) : 0,
      modeled: lpCapital > 0 ? roundPercent(expectedAnnualSurplusAtRecommended / lpCapital) : 0,
      aggressive: lpCapital > 0 ? roundPercent((expectedAnnualSurplusAtRecommended * 1.25) / lpCapital) : 0,
    },
    event7CurrentPremiumUsd: event7.retailPremiumUsd,
    travel30CurrentPremiumUsd: travel30.retailPremiumUsd,
  };
}

function evaluateCandidate(params: {
  skuKey: SkuKey;
  premiumUsd: number;
  capUsd: number;
  scenario: IndependentScenario;
  assumptions: Assumptions;
  seedOffset: number;
}) {
  const sku = params.assumptions.skus[params.skuKey];
  const memberCount = params.skuKey === "event7" ? params.scenario.event7Members : params.scenario.travel30Members;
  const reserveUsd = sku.claimsPayingReserveUsd + memberCount * (params.premiumUsd - sku.retailPremiumUsd);
  const result = simulatePortfolioClaims({
    event7Members: params.skuKey === "event7" ? memberCount : 0,
    travel30Members: params.skuKey === "travel30" ? memberCount : 0,
    event7CapUsd: params.skuKey === "event7" ? params.capUsd : params.assumptions.skus.event7.maxPayoutUsd,
    travel30CapUsd: params.skuKey === "travel30" ? params.capUsd : params.assumptions.skus.travel30.maxPayoutUsd,
    frequencyMultiplier: params.scenario.frequencyMultiplier,
    severityMultiplier: params.scenario.severityMultiplier,
    reserveUsd,
  }, params.assumptions, params.seedOffset);
  const expectedClaimsUsd = memberCount * expectedClaimCostUsd(sku, params.scenario.frequencyMultiplier, params.scenario.severityMultiplier);
  const grossPremiumUsd = memberCount * params.premiumUsd;
  return {
    premiumUsd: params.premiumUsd,
    capUsd: params.capUsd,
    grossPremiumUsd: roundUsd(grossPremiumUsd),
    expectedClaimsUsd: roundUsd(expectedClaimsUsd),
    expectedSurplusUsd: roundUsd(grossPremiumUsd - expectedClaimsUsd),
    claimsPayingReserveUsd: roundUsd(reserveUsd),
    p95ClaimsUsd: result.p95ClaimsUsd,
    p99ClaimsUsd: result.p99ClaimsUsd,
    p995ClaimsUsd: result.p995ClaimsUsd,
    reserveBreachProbability: result.reserveBreachProbability,
    additionalReserveNeededUsd: Math.max(0, result.p995ClaimsUsd - reserveUsd),
    launchGate: evaluateGate({ reserveUsd, p995ClaimsUsd: result.p995ClaimsUsd, breachProbability: result.reserveBreachProbability }),
  };
}

function buildCanonicalUpdatePlan(
  pricingRecommendations: ReturnType<typeof optimizeSkuPricing>[],
  assumptions: Assumptions,
) {
  const redesign = assumptions.approvedCanonicalRedesign;
  const appliedChanges = redesign
    ? (Object.keys(redesign.appliedDesign) as SkuKey[]).flatMap((skuKey) => {
      const prior = redesign.historicalPriorDesign[skuKey];
      const applied = redesign.appliedDesign[skuKey];
      const skuName = skuKey === "event7" ? "Event 7" : "Travel 30";
      const entries: string[] = [];
      if (prior.retailPremiumUsd !== applied.retailPremiumUsd) {
        entries.push(`${skuName}: retail premium ${prior.retailPremiumUsd} -> ${applied.retailPremiumUsd} USD.`);
      }
      if (prior.cohortPremiumUsdMin !== applied.cohortPremiumUsdMin || prior.cohortPremiumUsdMax !== applied.cohortPremiumUsdMax) {
        entries.push(`${skuName}: cohort band ${prior.cohortPremiumUsdMin}-${prior.cohortPremiumUsdMax} -> ${applied.cohortPremiumUsdMin}-${applied.cohortPremiumUsdMax} USD.`);
      }
      if (prior.maxPayoutUsd !== applied.maxPayoutUsd) {
        entries.push(`${skuName}: max payout cap ${prior.maxPayoutUsd} -> ${applied.maxPayoutUsd} USD.`);
      }
      return entries;
    })
    : [];
  const recommendedChanges = pricingRecommendations.flatMap((recommendation) => {
    const currentPremium = recommendation.current?.premiumUsd ?? 0;
    const currentCap = recommendation.current?.capUsd ?? 0;
    const recommended = recommendation.recommended;
    const skuName = recommendation.sku === "event7" ? "Event 7" : "Travel 30";
    const entries: string[] = [];
    if (recommended.premiumUsd !== currentPremium) {
      entries.push(`${skuName}: review retail premium ${currentPremium} -> ${recommended.premiumUsd} USD.`);
    }
    if (recommended.capUsd !== currentCap) {
      entries.push(`${skuName}: review max payout cap ${currentCap} -> ${recommended.capUsd} USD.`);
    }
    return entries;
  });
  const changes = redesign ? appliedChanges : recommendedChanges;
  return {
    status: redesign?.status ?? (changes.length > 0 ? "approval_required" : "no_canonical_change_recommended"),
    approvedAt: redesign?.approvedAt ?? null,
    approvalBasis: redesign?.approvalBasis ?? null,
    historicalPriorDesign: redesign?.historicalPriorDesign ?? null,
    appliedDesign: redesign?.appliedDesign ?? null,
    changes,
    requiredSurfaces: [
      "frontend public Genesis metadata",
      "Genesis Protect Acute canonical Notion plan",
      "Decision log",
      "Docs and messaging audit",
      "Dev Tracker pricing/reserve threshold task",
      "public docs and FAQ after doctrine approval",
    ],
    rule: redesign
      ? "Approved canonical pricing redesign is applied in repo metadata; keep Notion and public copy synchronized to this artifact."
      : "Do not apply these canonical changes automatically from the actuarial workbook.",
  };
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function buildMarkdownReview(output: any) {
  const stochasticRows = output.scenarioResults
    .filter((result: any) => "p995ClaimsUsd" in result)
    .map((result: any) => [
      result.id,
      result.launchGate,
      result.grossPremiumUsd,
      result.p995ClaimsUsd,
      result.claimsPayingReserveUsd,
      result.additionalReserveNeededUsd,
    ]);
  const pricingRows = output.pricingRecommendations.map((entry: any) => [
    entry.sku,
    entry.current?.premiumUsd ?? "n/a",
    entry.current?.launchGate ?? "n/a",
    entry.recommended.premiumUsd,
    entry.recommended.capUsd,
    entry.recommended.launchGate,
  ]);

  return `# Genesis Protect Acute End-to-End Actuarial Workbook

Generated: ${output.generatedAt}

## Headline

- Target solvency gate: p${Math.round(output.targetSolvencyQuantile * 1000) / 10}.
- Public-open ceiling remains ${output.recommendedLaunchGates.publicOpenCeiling.event7Members} Event 7 + ${output.recommendedLaunchGates.publicOpenCeiling.travel30Members} Travel 30 at baseline.
- Event 7 same-venue cap remains ${output.recommendedLaunchGates.event7SameVenueHardCapMembers}.
- Travel 30 sponsor/backstop review threshold remains ${output.recommendedLaunchGates.travel30SponsorReviewThresholdMembers}.
- Canonical redesign status: ${output.canonicalUpdatePlan.status}; see canonical-update-plan.md.

## Scenario Gates

${markdownTable(["Scenario", "Gate", "Premium", "p99.5 Claims", "Reserve", "Extra Reserve"], stochasticRows)}

## Pricing Recommendations

${markdownTable(["SKU", "Current Premium", "Current Gate", "Recommended Premium", "Recommended Cap", "Recommended Gate"], pricingRows)}

## Limits

${output.limitations.map((limitation: string) => `- ${limitation}`).join("\n")}
`;
}

function buildCanonicalMarkdown(plan: ReturnType<typeof buildCanonicalUpdatePlan>) {
  return `# Genesis Protect Acute Canonical Update Plan

Status: ${plan.status}

${plan.approvedAt ? `Approved: ${plan.approvedAt}\n\nBasis: ${plan.approvalBasis}\n\nThis records the approved canonical pricing redesign now applied in repo metadata.` : "This is a non-mutating approval plan. It records what should change only if the pricing redesign is approved."}

## Canonical Changes

${plan.changes.length > 0 ? plan.changes.map((change) => `- ${change}`).join("\n") : "- No canonical pricing or cap changes recommended."}

## Surfaces To Keep Synchronized

${plan.requiredSurfaces.map((surface) => `- ${surface}`).join("\n")}

## Rule

${plan.rule}
`;
}

function buildReviewOutput() {
  const assumptions = readJson<Assumptions>(join(REVIEW_DIR, "assumptions.json"));
  const matrix = readJson<ScenarioMatrix>(join(REVIEW_DIR, "scenario-matrix.json"));
  validateMetadata(assumptions);
  const scenarioResults: ScenarioResult[] = matrix.scenarios.map((scenario, index) => {
    if (scenario.type === "correlated_event") return simulateCorrelated(scenario, assumptions);
    if (scenario.type === "claims_ops") return simulateClaimsOps(scenario, assumptions);
    return simulateIndependent(scenario, assumptions, index * 7919);
  });
  const claimSimulationCoverage = summarizeClaimSimulations(assumptions);
  const pricingRecommendations = (Object.keys(assumptions.skus) as SkuKey[]).map((sku, index) =>
    optimizeSkuPricing(sku, assumptions, matrix, 100000 + index * 10000),
  );
  const canonicalUpdatePlan = buildCanonicalUpdatePlan(pricingRecommendations, assumptions);

  return {
    generated: true,
    generatedAt: "2026-04-27T00:00:00.000Z",
    reviewId: assumptions.reviewId,
    purpose: assumptions.purpose,
    targetSolvencyQuantile: assumptions.targetSolvencyQuantile,
    validation: {
      metadataAligned: true,
      claimSimulationCoverage,
    },
    scenarioResults,
    pricingRecommendations,
    countryScoring: scoreCountryPosture(assumptions),
    recommendedLaunchGates: {
      publicOpenCeiling: {
        event7Members: 1000,
        travel30Members: 500,
        rationale: "Baseline p99.5 remains inside the current combined reserve, while adverse sensitivity already requires caution or repricing.",
      },
      event7SameVenueHardCapMembers: assumptions.skus.event7.hardVenueCapMembers,
      travel30SponsorReviewThresholdMembers: 100,
      reserveStateThresholds: {
        healthy: "p99.5 claims remain at least 15% below claims-paying reserve and breach probability is zero in the deterministic run",
        caution: "p99.5 reserve margin is below 15%, any modeled breach occurs below 1%, or correlated scenario exceeds an operational cap",
        pause: "p99.5 claims exceed claims-paying reserve or modeled breach probability is at least 1%",
      },
      countryPosture: assumptions.countryPosture,
    },
    canonicalUpdatePlan,
    approvedCanonicalRedesign: assumptions.approvedCanonicalRedesign ?? null,
    limitations: assumptions.methodLimitations,
    sourceReferences: assumptions.sourceReferences,
  };
}

const output = buildReviewOutput();
writeFileSync(join(REVIEW_DIR, "review-output.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(join(REVIEW_DIR, "review-memo.md"), buildMarkdownReview(output));
writeFileSync(join(REVIEW_DIR, "canonical-update-plan.md"), buildCanonicalMarkdown(output.canonicalUpdatePlan));
console.log(`Generated ${join("examples", "genesis-protect-acute-actuarial-review", "review-output.json")}`);
console.log(`Generated ${join("examples", "genesis-protect-acute-actuarial-review", "review-memo.md")}`);
console.log(`Generated ${join("examples", "genesis-protect-acute-actuarial-review", "canonical-update-plan.md")}`);
