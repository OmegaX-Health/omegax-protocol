import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Gate = "healthy" | "caution" | "pause";

type SeverityModel = {
  minUsd: number;
  modeUsd: number;
  p95Usd: number;
  maxUsd: number;
};

type ProductAssumptions = {
  displayName: string;
  coverWindowDays: number;
  unitSizeUsd: number;
  minMemberBudgetUsd: number;
  maxMemberCapUsd: number;
  baseUnitPremiumUsd: number;
  curveDepthUnits: number;
  curveGamma: number;
  targetReserveToLimitRatio: number;
  reserveStressGamma: number;
  maxReserveStressMultiplier: number;
  claimsReserveShareOfPremium: number;
  premiumShareToRiskBackers: number;
  waitingPeriods: {
    illnessDays: number;
    accidentHours: number;
  };
  coverageScope: string[];
  excludedScope: string[];
};

type BudgetMix = Array<{
  budgetUsd: number;
  weight: number;
}>;

type QuoteSample = {
  id: string;
  label: string;
  soldCoverageUsd: number;
  claimsPayingReserveUsd: number;
  riskMultiplier: number;
};

type IndependentScenario = {
  id: string;
  type: "independent_claims";
  label: string;
  members: number;
  budgetMix: BudgetMix;
  riskMultiplier: number;
  frequencyMultiplier: number;
  severityMultiplier: number;
  riskBackerCapitalUsd: number;
};

type CorrelatedScenario = {
  id: string;
  type: "correlated_event";
  label: string;
  members: number;
  budgetMix: BudgetMix;
  riskMultiplier: number;
  affectedRate: number;
  maxBenefitRate: number;
  riskBackerCapitalUsd: number;
};

type Scenario = IndependentScenario | CorrelatedScenario;

type RiskBackerDeposit = {
  backer: string;
  depositUsd: number;
  class: "junior_backstop";
};

type QuoteRequest = {
  member: string;
  budgetUsd: number;
  riskMultiplier: number;
  residenceCountry: string;
  destinationCountry: string;
};

type ClaimDrill = {
  claimId: string;
  member: string;
  eventKind: "accident" | "illness";
  eventAt: string;
  submittedAt: string;
  requestedUsd: number;
  operatorRecommendedUsd: number;
  coveredEvent: boolean;
  evidenceComplete: boolean;
  expectedOutcome: string;
};

type EndToEndPocAssumptions = {
  quoteSigner: string;
  pricingCurveHash: string;
  termsHash: string;
  reserveSnapshotHash: string;
  quoteTtlMinutes: number;
  issuedAt: string;
  windowStart: string;
  riskBackerDeposits: RiskBackerDeposit[];
  quoteRequests: QuoteRequest[];
  claimDrills: ClaimDrill[];
};

type HybridModelKind =
  | "separated_backstop_market"
  | "loss_ratio_event_market"
  | "collateralized_sidecar"
  | "parametric_fast_cash"
  | "member_mutual_rebate"
  | "calibrated_pay_anything_curve"
  | "underwriting_prediction_tranche"
  | "member_health_bond"
  | "full_stack_market_mutual"
  | "pure_pay_anything_pool";

type HybridScaleAssumptions = {
  members: number;
  budgetMix: BudgetMix;
  riskMultiplier: number;
  frequencyMultiplier: number;
  severityMultiplier: number;
  riskBackerCapitalUsd: number;
};

type HybridModelAssumptions = {
  id: string;
  name: string;
  kind: HybridModelKind;
  oneLine: string;
  memberOffering: string;
  marketMechanism: string;
  productionBoundary: string;
  scale: HybridScaleAssumptions;
  market?: {
    eventThresholdLossRatio: number;
    liquidityUsd: number;
    marketProbabilityBiasPct: number;
    quoteAdjustmentSensitivity: number;
  };
  tranches?: Array<{
    id: string;
    label: string;
    capitalUsd: number;
    couponSharePct: number;
  }>;
  parametric?: {
    benefitUsd: number;
    eventFrequency: number;
    premiumPerMemberUsd: number;
  };
  rebate?: {
    memberSurplusSharePct: number;
    backerSurplusSharePct: number;
    protocolSurplusSharePct: number;
  };
  underwritingMarket?: {
    predictorCount: number;
    averageStakeUsd: number;
    claimsTrancheSharePct: number;
    signalAccuracyPct: number;
    wrongStakePenaltyPct: number;
    yieldAprPct: number;
    pricingFeePct: number;
    rewardSurplusSharePct: number;
    eventThresholdLossRatio: number;
  };
  healthBond?: {
    adoptionRate: number;
    averageStakeUsd: number;
    claimForfeiturePct: number;
    moralHazardFrequencyReductionPct: number;
    noClaimRewardSharePct: number;
  };
  purePool?: {
    promisedCapUsd: number;
  };
};

type Assumptions = {
  schemaVersion: number;
  reviewId: string;
  purpose: string;
  status: string;
  targetSolvencyQuantile: number;
  methodLimitations: string[];
  monteCarlo: {
    seed: number;
    trials: number;
    quantiles: number[];
  };
  product: ProductAssumptions;
  severityModel: SeverityModel;
  baselineClaimFrequency: number;
  openingProtocolReserveUsd: number;
  quoteSamples: QuoteSample[];
  memberBudgetsUsd: number[];
  hybridModels: HybridModelAssumptions[];
  endToEndPoc: EndToEndPocAssumptions;
  scenarios: Scenario[];
};

type QuoteState = {
  soldUnits: number;
  claimsPayingReserveUsd: number;
};

type MemberQuote = {
  budgetUsd: number;
  premiumUsedUsd: number;
  coverageCapUsd: number;
  units: number;
  averageUnitPriceUsd: number;
  marginalUnitPriceUsd: number;
  reserveStressMultiplier: number;
  impliedPremiumRatePct: number;
};

type Portfolio = {
  memberQuotes: MemberQuote[];
  grossPremiumUsd: number;
  claimsReserveFromPremiumUsd: number;
  activeCoverageLimitUsd: number;
  averagePremiumUsd: number;
  averageCoverageCapUsd: number;
  finalMarginalUnitPriceUsd: number;
};

type RiskBackerPosition = RiskBackerDeposit & {
  positionId: string;
  shares: number;
  sharePct: number;
};

type SignedQuoteReceipt = QuoteRequest & MemberQuote & {
  quoteId: string;
  product: string;
  coverageWindowDays: number;
  windowStart: string;
  windowEnd: string;
  termsHash: string;
  pricingCurveHash: string;
  reserveSnapshotHash: string;
  issuedAt: string;
  expiresAt: string;
  signer: string;
  signature: string;
};

type CoverageEntitlement = {
  entitlementId: string;
  quoteId: string;
  member: string;
  premiumPaidUsd: number;
  coverageCapUsd: number;
  remainingCapUsd: number;
  windowStart: string;
  windowEnd: string;
  accidentWaitUntil: string;
  illnessWaitUntil: string;
  termsHash: string;
  pricingCurveHash: string;
  status: "active" | "exhausted";
};

type ClaimDecision = ClaimDrill & {
  entitlementId: string | null;
  decision: "approved" | "denied";
  denialReason: string | null;
  approvedUsd: number;
  deniedOverCapUsd: number;
  remainingCapAfterUsd: number;
  reserveAfterUsd: number;
  stateTrail: string[];
};

type EndToEndPocOutput = {
  productionLogic: string[];
  riskBackerMarket: {
    totalBackerCapitalUsd: number;
    sharePriceUsd: number;
    positions: RiskBackerPosition[];
  };
  quoteReceipts: SignedQuoteReceipt[];
  entitlements: CoverageEntitlement[];
  claimDecisions: ClaimDecision[];
  finalReserveUsd: number;
  paidClaimsUsd: number;
  activeCoverageLimitUsd: number;
  remainingCoverageLimitUsd: number;
};

type ClaimDistribution = {
  claims: number[];
  averageClaimsUsd: number;
  p95ClaimsUsd: number;
  p99ClaimsUsd: number;
  p995ClaimsUsd: number;
  reserveBreachProbability: number;
};

type HybridScaleCheck = {
  label: string;
  members: number;
  riskBackerCapitalUsd: number;
  grossPremiumUsd: number;
  activeCoverageLimitUsd: number;
  claimsPayingReserveUsd: number;
  p995ClaimsUsd: number;
  reserveToActiveLimitPct: number;
  launchGate: Gate;
};

type HybridModelResult = {
  id: string;
  name: string;
  kind: HybridModelKind;
  verdict: "ship_candidate" | "needs_wrapper" | "research_only" | "reject";
  launchGate: Gate;
  oneLine: string;
  memberOffering: string;
  marketMechanism: string;
  productionBoundary: string;
  firstPrinciples: string[];
  policyDesign: string[];
  offering: {
    members: number;
    averagePremiumUsd: number;
    averageCoverageCapUsd: number;
    activeCoverageLimitUsd: number;
    memberBudgetRangeUsd: [number, number];
  };
  actuarial: {
    grossPremiumUsd: number;
    claimsPayingReserveUsd: number;
    expectedClaimsUsd: number;
    expectedLossRatioPct: number;
    p95ClaimsUsd: number;
    p99ClaimsUsd: number;
    p995ClaimsUsd: number;
    reserveBreachProbability: number;
    reserveToActiveLimitPct: number;
    additionalReserveNeededUsd: number;
    reserveFloorAdditionalNeededUsd: number;
    expectedSurplusUsd: number;
  };
  market: Record<string, number | string | null>;
  scaleChecks: HybridScaleCheck[];
  notes: string[];
};

const ROOT = process.cwd();
const REVIEW_DIR = join(ROOT, "examples", "nomad-protect-curve-poc");
const ASSUMPTIONS_PATH = join(REVIEW_DIR, "assumptions.json");
const OUTPUT_PATH = join(REVIEW_DIR, "review-output.json");
const MEMO_PATH = join(REVIEW_DIR, "review-memo.md");
const HYBRID_REPORT_PATH = join(REVIEW_DIR, "hybrid-model-report.md");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
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

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function roundPercent(value: number): number {
  return Number((value * 100).toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashRecord(prefix: string, value: unknown): string {
  return createHash("sha256")
    .update(`${prefix}:${JSON.stringify(value)}`)
    .digest("hex");
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function addDays(iso: string, days: number): string {
  return addMinutes(iso, days * 24 * 60);
}

function maxIso(left: string, right: string): string {
  return new Date(Math.max(new Date(left).getTime(), new Date(right).getTime())).toISOString();
}

function reserveStressMultiplier(product: ProductAssumptions, state: QuoteState): number {
  const activeLimitUsd = state.soldUnits * product.unitSizeUsd;
  if (activeLimitUsd <= 0) return 1;
  const ratio = state.claimsPayingReserveUsd / activeLimitUsd;
  if (ratio >= product.targetReserveToLimitRatio) return 1;
  return Math.min(
    product.maxReserveStressMultiplier,
    (product.targetReserveToLimitRatio / Math.max(ratio, 0.0001)) ** product.reserveStressGamma,
  );
}

function marginalUnitPrice(
  product: ProductAssumptions,
  state: QuoteState,
  riskMultiplier: number,
): number {
  const reserveStress = reserveStressMultiplier(product, state);
  return product.baseUnitPremiumUsd
    * riskMultiplier
    * reserveStress
    * (1 + state.soldUnits / product.curveDepthUnits) ** product.curveGamma;
}

function premiumForUnits(params: {
  product: ProductAssumptions;
  startUnits: number;
  units: number;
  riskMultiplier: number;
  reserveStress: number;
}): number {
  if (params.units <= 0) return 0;
  const { product, startUnits, units, riskMultiplier, reserveStress } = params;
  const depth = product.curveDepthUnits;
  const gamma = product.curveGamma;
  const from = 1 + startUnits / depth;
  const to = 1 + (startUnits + units) / depth;
  const curveArea = (depth / (gamma + 1)) * (to ** (gamma + 1) - from ** (gamma + 1));
  return product.baseUnitPremiumUsd * riskMultiplier * reserveStress * curveArea;
}

function quoteForBudget(params: {
  product: ProductAssumptions;
  state: QuoteState;
  budgetUsd: number;
  riskMultiplier: number;
}): MemberQuote {
  const { product, state, budgetUsd, riskMultiplier } = params;
  const reserveStress = reserveStressMultiplier(product, state);
  const maxUnits = product.maxMemberCapUsd / product.unitSizeUsd;
  let low = 0;
  let high = maxUnits;
  for (let i = 0; i < 44; i += 1) {
    const mid = (low + high) / 2;
    const premium = premiumForUnits({
      product,
      startUnits: state.soldUnits,
      units: mid,
      riskMultiplier,
      reserveStress,
    });
    if (premium <= budgetUsd) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const units = low;
  const premiumUsedUsd = premiumForUnits({
    product,
    startUnits: state.soldUnits,
    units,
    riskMultiplier,
    reserveStress,
  });
  const coverageCapUsd = units * product.unitSizeUsd;
  const marginal = marginalUnitPrice(
    product,
    { soldUnits: state.soldUnits + units, claimsPayingReserveUsd: state.claimsPayingReserveUsd },
    riskMultiplier,
  );

  return {
    budgetUsd,
    premiumUsedUsd: roundMoney(Math.min(budgetUsd, premiumUsedUsd)),
    coverageCapUsd: roundUsd(coverageCapUsd),
    units: Number(units.toFixed(4)),
    averageUnitPriceUsd: units > 0 ? roundMoney(premiumUsedUsd / units) : 0,
    marginalUnitPriceUsd: roundMoney(marginal),
    reserveStressMultiplier: Number(reserveStress.toFixed(4)),
    impliedPremiumRatePct: coverageCapUsd > 0 ? roundPercent(premiumUsedUsd / coverageCapUsd) : 0,
  };
}

function chooseBudget(mix: BudgetMix, rng: () => number): number {
  const totalWeight = mix.reduce((sum, entry) => sum + entry.weight, 0);
  const draw = rng() * totalWeight;
  let cursor = 0;
  for (const entry of mix) {
    cursor += entry.weight;
    if (draw <= cursor) return entry.budgetUsd;
  }
  return mix[mix.length - 1]!.budgetUsd;
}

function buildPortfolio(params: {
  assumptions: Assumptions;
  members: number;
  budgetMix: BudgetMix;
  riskMultiplier: number;
  riskBackerCapitalUsd: number;
  seedOffset: number;
}): Portfolio {
  const rng = createRng((params.assumptions.monteCarlo.seed + params.seedOffset) >>> 0);
  const state: QuoteState = {
    soldUnits: 0,
    claimsPayingReserveUsd: params.assumptions.openingProtocolReserveUsd + params.riskBackerCapitalUsd,
  };
  const memberQuotes: MemberQuote[] = [];

  for (let i = 0; i < params.members; i += 1) {
    const budgetUsd = chooseBudget(params.budgetMix, rng);
    const quote = quoteForBudget({
      product: params.assumptions.product,
      state,
      budgetUsd,
      riskMultiplier: params.riskMultiplier,
    });
    memberQuotes.push(quote);
    state.soldUnits += quote.units;
    state.claimsPayingReserveUsd += quote.premiumUsedUsd * params.assumptions.product.claimsReserveShareOfPremium;
  }

  const grossPremiumUsd = memberQuotes.reduce((sum, quote) => sum + quote.premiumUsedUsd, 0);
  const activeCoverageLimitUsd = memberQuotes.reduce((sum, quote) => sum + quote.coverageCapUsd, 0);
  return {
    memberQuotes,
    grossPremiumUsd: roundMoney(grossPremiumUsd),
    claimsReserveFromPremiumUsd: roundMoney(grossPremiumUsd * params.assumptions.product.claimsReserveShareOfPremium),
    activeCoverageLimitUsd: roundUsd(activeCoverageLimitUsd),
    averagePremiumUsd: roundMoney(grossPremiumUsd / params.members),
    averageCoverageCapUsd: roundUsd(activeCoverageLimitUsd / params.members),
    finalMarginalUnitPriceUsd: memberQuotes.length > 0 ? memberQuotes[memberQuotes.length - 1]!.marginalUnitPriceUsd : 0,
  };
}

function sampleSeverity(model: SeverityModel, severityMultiplier: number, rng: () => number): number {
  const u = rng();
  let severity: number;
  if (u < 0.65) {
    severity = model.minUsd + (model.modeUsd - model.minUsd) * Math.sqrt(u / 0.65);
  } else if (u < 0.95) {
    severity = model.modeUsd + (model.p95Usd - model.modeUsd) * ((u - 0.65) / 0.3) ** 1.25;
  } else {
    severity = model.p95Usd + (model.maxUsd - model.p95Usd) * ((u - 0.95) / 0.05) ** 2;
  }
  return severity * severityMultiplier;
}

function groupedCaps(memberQuotes: MemberQuote[]): Array<{ capUsd: number; count: number }> {
  const counts = new Map<number, number>();
  for (const quote of memberQuotes) {
    const roundedCap = Math.max(10, Math.round(quote.coverageCapUsd / 10) * 10);
    counts.set(roundedCap, (counts.get(roundedCap) ?? 0) + 1);
  }
  return [...counts.entries()].map(([capUsd, count]) => ({ capUsd, count }));
}

function simulateClaimsDistribution(params: {
  assumptions: Assumptions;
  portfolio: Portfolio;
  frequencyMultiplier: number;
  severityMultiplier: number;
  reserveUsd: number;
  seedOffset: number;
  healthBondMitigation?: {
    adoptionRate: number;
    perClaimForfeitureUsd: number;
    frequencyReductionPct: number;
  };
}): ClaimDistribution {
  const rng = createRng((params.assumptions.monteCarlo.seed + params.seedOffset) >>> 0);
  const groups = groupedCaps(params.portfolio.memberQuotes);
  const claims: number[] = [];
  const mitigation = params.healthBondMitigation;
  const frequencyReduction = mitigation ? clamp(mitigation.frequencyReductionPct, 0, 0.8) : 0;
  const probability = params.assumptions.baselineClaimFrequency
    * params.frequencyMultiplier
    * (1 - frequencyReduction);

  for (let trial = 0; trial < params.assumptions.monteCarlo.trials; trial += 1) {
    let total = 0;
    for (const group of groups) {
      const count = claimCount(group.count, probability, rng);
      for (let i = 0; i < count; i += 1) {
        const grossClaimUsd = Math.min(
          group.capUsd,
          sampleSeverity(params.assumptions.severityModel, params.severityMultiplier, rng),
        );
        const netClaimUsd = mitigation && rng() < mitigation.adoptionRate
          ? Math.max(0, grossClaimUsd - mitigation.perClaimForfeitureUsd)
          : grossClaimUsd;
        total += netClaimUsd;
      }
    }
    claims.push(total);
  }

  const average = claims.reduce((sum, value) => sum + value, 0) / claims.length;
  const p95 = quantile(claims, 0.95);
  const p99 = quantile(claims, 0.99);
  const p995 = quantile(claims, params.assumptions.targetSolvencyQuantile);
  const breachProbability = claims.filter((value) => value > params.reserveUsd).length / claims.length;

  return {
    claims,
    averageClaimsUsd: roundUsd(average),
    p95ClaimsUsd: roundUsd(p95),
    p99ClaimsUsd: roundUsd(p99),
    p995ClaimsUsd: roundUsd(p995),
    reserveBreachProbability: Number(breachProbability.toFixed(6)),
  };
}

function simulateClaims(params: {
  assumptions: Assumptions;
  portfolio: Portfolio;
  frequencyMultiplier: number;
  severityMultiplier: number;
  reserveUsd: number;
  seedOffset: number;
}) {
  const { claims: _claims, ...metrics } = simulateClaimsDistribution(params);
  return metrics;
}

function evaluateGate(params: { reserveUsd: number; p995ClaimsUsd: number; breachProbability: number }): Gate {
  const marginRatio = (params.reserveUsd - params.p995ClaimsUsd) / Math.max(params.reserveUsd, 1);
  if (params.breachProbability >= 0.01 || params.p995ClaimsUsd > params.reserveUsd) return "pause";
  if (marginRatio < 0.15 || params.breachProbability > 0) return "caution";
  return "healthy";
}

function applyReserveFloorGate(params: {
  baseGate: Gate;
  reserveUsd: number;
  activeCoverageLimitUsd: number;
  product: ProductAssumptions;
}): Gate {
  if (params.baseGate === "pause" || params.activeCoverageLimitUsd <= 0) return params.baseGate;
  const ratio = params.reserveUsd / params.activeCoverageLimitUsd;
  if (ratio < params.product.targetReserveToLimitRatio * 0.5) return "pause";
  if (ratio < params.product.targetReserveToLimitRatio) return "caution";
  return params.baseGate;
}

function evaluateIndependentScenario(
  scenario: IndependentScenario,
  assumptions: Assumptions,
  seedOffset: number,
) {
  const portfolio = buildPortfolio({
    assumptions,
    members: scenario.members,
    budgetMix: scenario.budgetMix,
    riskMultiplier: scenario.riskMultiplier,
    riskBackerCapitalUsd: scenario.riskBackerCapitalUsd,
    seedOffset,
  });
  const reserveUsd = roundMoney(
    assumptions.openingProtocolReserveUsd
    + scenario.riskBackerCapitalUsd
    + portfolio.claimsReserveFromPremiumUsd,
  );
  const claims = simulateClaims({
    assumptions,
    portfolio,
    frequencyMultiplier: scenario.frequencyMultiplier,
    severityMultiplier: scenario.severityMultiplier,
    reserveUsd,
    seedOffset: seedOffset + 997,
  });
  const expectedSurplusUsd = roundUsd(portfolio.grossPremiumUsd - claims.averageClaimsUsd);
  const reserveFloorAdditionalNeededUsd = Math.max(
    0,
    roundUsd((assumptions.product.targetReserveToLimitRatio * portfolio.activeCoverageLimitUsd) - reserveUsd),
  );
  const solvencyGate = evaluateGate({
    reserveUsd,
    p995ClaimsUsd: claims.p995ClaimsUsd,
    breachProbability: claims.reserveBreachProbability,
  });
  const backerWindowYieldPct = scenario.riskBackerCapitalUsd > 0
    ? roundPercent((Math.max(0, expectedSurplusUsd) * assumptions.product.premiumShareToRiskBackers) / scenario.riskBackerCapitalUsd)
    : 0;

  return {
    id: scenario.id,
    type: scenario.type,
    label: scenario.label,
    members: scenario.members,
    riskBackerCapitalUsd: scenario.riskBackerCapitalUsd,
    grossPremiumUsd: portfolio.grossPremiumUsd,
    claimsReserveFromPremiumUsd: portfolio.claimsReserveFromPremiumUsd,
    claimsPayingReserveUsd: reserveUsd,
    activeCoverageLimitUsd: portfolio.activeCoverageLimitUsd,
    reserveToActiveLimitPct: portfolio.activeCoverageLimitUsd > 0
      ? roundPercent(reserveUsd / portfolio.activeCoverageLimitUsd)
      : 0,
    averagePremiumUsd: portfolio.averagePremiumUsd,
    averageCoverageCapUsd: portfolio.averageCoverageCapUsd,
    finalMarginalUnitPriceUsd: portfolio.finalMarginalUnitPriceUsd,
    averageClaimsUsd: claims.averageClaimsUsd,
    expectedSurplusUsd,
    p95ClaimsUsd: claims.p95ClaimsUsd,
    p99ClaimsUsd: claims.p99ClaimsUsd,
    p995ClaimsUsd: claims.p995ClaimsUsd,
    reserveBreachProbability: claims.reserveBreachProbability,
    additionalReserveNeededUsd: Math.max(0, claims.p995ClaimsUsd - reserveUsd),
    reserveFloorAdditionalNeededUsd,
    backerOneWindowYieldPct: backerWindowYieldPct,
    backerSimpleAnnualizedYieldPct: Number((backerWindowYieldPct * (365 / assumptions.product.coverWindowDays)).toFixed(2)),
    launchGate: applyReserveFloorGate({
      baseGate: solvencyGate,
      reserveUsd,
      activeCoverageLimitUsd: portfolio.activeCoverageLimitUsd,
      product: assumptions.product,
    }),
  };
}

function evaluateCorrelatedScenario(
  scenario: CorrelatedScenario,
  assumptions: Assumptions,
  seedOffset: number,
) {
  const portfolio = buildPortfolio({
    assumptions,
    members: scenario.members,
    budgetMix: scenario.budgetMix,
    riskMultiplier: scenario.riskMultiplier,
    riskBackerCapitalUsd: scenario.riskBackerCapitalUsd,
    seedOffset,
  });
  const reserveUsd = roundMoney(
    assumptions.openingProtocolReserveUsd
    + scenario.riskBackerCapitalUsd
    + portfolio.claimsReserveFromPremiumUsd,
  );
  const stressedClaimsUsd = roundUsd(portfolio.activeCoverageLimitUsd * scenario.affectedRate * scenario.maxBenefitRate);
  const marginRatio = (reserveUsd - stressedClaimsUsd) / Math.max(reserveUsd, 1);
  const solvencyGate: Gate = stressedClaimsUsd > reserveUsd ? "pause" : marginRatio < 0.2 ? "caution" : "healthy";
  const reserveFloorAdditionalNeededUsd = Math.max(
    0,
    roundUsd((assumptions.product.targetReserveToLimitRatio * portfolio.activeCoverageLimitUsd) - reserveUsd),
  );

  return {
    id: scenario.id,
    type: scenario.type,
    label: scenario.label,
    members: scenario.members,
    riskBackerCapitalUsd: scenario.riskBackerCapitalUsd,
    grossPremiumUsd: portfolio.grossPremiumUsd,
    claimsReserveFromPremiumUsd: portfolio.claimsReserveFromPremiumUsd,
    claimsPayingReserveUsd: reserveUsd,
    activeCoverageLimitUsd: portfolio.activeCoverageLimitUsd,
    reserveToActiveLimitPct: portfolio.activeCoverageLimitUsd > 0
      ? roundPercent(reserveUsd / portfolio.activeCoverageLimitUsd)
      : 0,
    averagePremiumUsd: portfolio.averagePremiumUsd,
    averageCoverageCapUsd: portfolio.averageCoverageCapUsd,
    affectedRate: scenario.affectedRate,
    maxBenefitRate: scenario.maxBenefitRate,
    stressedClaimsUsd,
    reserveMarginUsd: roundUsd(reserveUsd - stressedClaimsUsd),
    reserveFloorAdditionalNeededUsd,
    launchGate: applyReserveFloorGate({
      baseGate: solvencyGate,
      reserveUsd,
      activeCoverageLimitUsd: portfolio.activeCoverageLimitUsd,
      product: assumptions.product,
    }),
  };
}

function buildQuoteTables(assumptions: Assumptions) {
  return assumptions.quoteSamples.map((sample) => {
    const state: QuoteState = {
      soldUnits: sample.soldCoverageUsd / assumptions.product.unitSizeUsd,
      claimsPayingReserveUsd: sample.claimsPayingReserveUsd,
    };
    return {
      id: sample.id,
      label: sample.label,
      soldCoverageUsd: sample.soldCoverageUsd,
      claimsPayingReserveUsd: sample.claimsPayingReserveUsd,
      reserveToActiveLimitPct: sample.soldCoverageUsd > 0
        ? roundPercent(sample.claimsPayingReserveUsd / sample.soldCoverageUsd)
        : null,
      reserveStressMultiplier: Number(reserveStressMultiplier(assumptions.product, state).toFixed(4)),
      quotes: assumptions.memberBudgetsUsd.map((budgetUsd) =>
        quoteForBudget({
          product: assumptions.product,
          state,
          budgetUsd,
          riskMultiplier: sample.riskMultiplier,
        }),
      ),
    };
  });
}

function buildRiskBackerMarket(assumptions: Assumptions) {
  const deposits = assumptions.endToEndPoc.riskBackerDeposits;
  const totalBackerCapitalUsd = roundMoney(deposits.reduce((sum, deposit) => sum + deposit.depositUsd, 0));
  const sharePriceUsd = 1;
  const positions = deposits.map((deposit) => ({
    ...deposit,
    positionId: `rb_${hashRecord("risk-backer", deposit).slice(0, 10)}`,
    shares: roundMoney(deposit.depositUsd / sharePriceUsd),
    sharePct: totalBackerCapitalUsd > 0 ? roundPercent(deposit.depositUsd / totalBackerCapitalUsd) : 0,
  }));

  return {
    totalBackerCapitalUsd,
    sharePriceUsd,
    positions,
  };
}

function buildQuoteAndEntitlement(params: {
  assumptions: Assumptions;
  request: QuoteRequest;
  state: QuoteState;
}): {
  quote: SignedQuoteReceipt;
  entitlement: CoverageEntitlement;
} {
  const { assumptions, request, state } = params;
  const e2e = assumptions.endToEndPoc;
  const quote = quoteForBudget({
    product: assumptions.product,
    state,
    budgetUsd: request.budgetUsd,
    riskMultiplier: request.riskMultiplier,
  });
  const quoteId = `quote_${request.member}_${hashRecord("quote-id", {
    member: request.member,
    issuedAt: e2e.issuedAt,
    budgetUsd: request.budgetUsd,
  }).slice(0, 8)}`;
  const windowEnd = addDays(e2e.windowStart, assumptions.product.coverWindowDays);
  const receiptCore = {
    quoteId,
    member: request.member,
    budgetUsd: request.budgetUsd,
    premiumUsedUsd: quote.premiumUsedUsd,
    coverageCapUsd: quote.coverageCapUsd,
    windowStart: e2e.windowStart,
    windowEnd,
    termsHash: e2e.termsHash,
    pricingCurveHash: e2e.pricingCurveHash,
    reserveSnapshotHash: e2e.reserveSnapshotHash,
  };
  const signedQuote: SignedQuoteReceipt = {
    ...request,
    ...quote,
    quoteId,
    product: assumptions.product.displayName,
    coverageWindowDays: assumptions.product.coverWindowDays,
    windowStart: e2e.windowStart,
    windowEnd,
    termsHash: e2e.termsHash,
    pricingCurveHash: e2e.pricingCurveHash,
    reserveSnapshotHash: e2e.reserveSnapshotHash,
    issuedAt: e2e.issuedAt,
    expiresAt: addMinutes(e2e.issuedAt, e2e.quoteTtlMinutes),
    signer: e2e.quoteSigner,
    signature: hashRecord("signed-quote", {
      ...receiptCore,
      signer: e2e.quoteSigner,
    }),
  };
  const entitlement: CoverageEntitlement = {
    entitlementId: `ent_${request.member}_${hashRecord("entitlement", receiptCore).slice(0, 8)}`,
    quoteId,
    member: request.member,
    premiumPaidUsd: signedQuote.premiumUsedUsd,
    coverageCapUsd: signedQuote.coverageCapUsd,
    remainingCapUsd: signedQuote.coverageCapUsd,
    windowStart: signedQuote.windowStart,
    windowEnd: signedQuote.windowEnd,
    accidentWaitUntil: maxIso(signedQuote.windowStart, addDays(signedQuote.issuedAt, assumptions.product.waitingPeriods.accidentHours / 24)),
    illnessWaitUntil: maxIso(signedQuote.windowStart, addDays(signedQuote.issuedAt, assumptions.product.waitingPeriods.illnessDays)),
    termsHash: signedQuote.termsHash,
    pricingCurveHash: signedQuote.pricingCurveHash,
    status: "active",
  };

  return {
    quote: signedQuote,
    entitlement,
  };
}

function denyClaim(params: {
  drill: ClaimDrill;
  entitlementId: string | null;
  reason: string;
  reserveUsd: number;
  remainingCapUsd: number;
  trail?: string[];
}): ClaimDecision {
  return {
    ...params.drill,
    entitlementId: params.entitlementId,
    decision: "denied",
    denialReason: params.reason,
    approvedUsd: 0,
    deniedOverCapUsd: 0,
    remainingCapAfterUsd: params.remainingCapUsd,
    reserveAfterUsd: roundMoney(params.reserveUsd),
    stateTrail: ["submitted", ...(params.trail ?? []), "denied"],
  };
}

function adjudicateClaim(params: {
  drill: ClaimDrill;
  entitlement: CoverageEntitlement | undefined;
  reserveUsd: number;
}): {
  decision: ClaimDecision;
  reserveUsd: number;
} {
  const { drill, entitlement } = params;
  if (!entitlement) {
    return {
      decision: denyClaim({
        drill,
        entitlementId: null,
        reason: "no_active_entitlement",
        reserveUsd: params.reserveUsd,
        remainingCapUsd: 0,
      }),
      reserveUsd: params.reserveUsd,
    };
  }

  const remainingCapUsd = entitlement.remainingCapUsd;
  const eventAt = new Date(drill.eventAt).getTime();
  if (!drill.evidenceComplete) {
    return {
      decision: denyClaim({
        drill,
        entitlementId: entitlement.entitlementId,
        reason: "incomplete_evidence",
        reserveUsd: params.reserveUsd,
        remainingCapUsd,
        trail: ["evidence_hold"],
      }),
      reserveUsd: params.reserveUsd,
    };
  }
  if (eventAt < new Date(entitlement.windowStart).getTime() || eventAt > new Date(entitlement.windowEnd).getTime()) {
    return {
      decision: denyClaim({
        drill,
        entitlementId: entitlement.entitlementId,
        reason: "outside_coverage_window",
        reserveUsd: params.reserveUsd,
        remainingCapUsd,
      }),
      reserveUsd: params.reserveUsd,
    };
  }
  if (drill.eventKind === "accident" && eventAt < new Date(entitlement.accidentWaitUntil).getTime()) {
    return {
      decision: denyClaim({
        drill,
        entitlementId: entitlement.entitlementId,
        reason: "accident_waiting_period",
        reserveUsd: params.reserveUsd,
        remainingCapUsd,
      }),
      reserveUsd: params.reserveUsd,
    };
  }
  if (drill.eventKind === "illness" && eventAt < new Date(entitlement.illnessWaitUntil).getTime()) {
    return {
      decision: denyClaim({
        drill,
        entitlementId: entitlement.entitlementId,
        reason: "illness_waiting_period",
        reserveUsd: params.reserveUsd,
        remainingCapUsd,
      }),
      reserveUsd: params.reserveUsd,
    };
  }
  if (!drill.coveredEvent || drill.operatorRecommendedUsd <= 0) {
    return {
      decision: denyClaim({
        drill,
        entitlementId: entitlement.entitlementId,
        reason: "not_covered",
        reserveUsd: params.reserveUsd,
        remainingCapUsd,
      }),
      reserveUsd: params.reserveUsd,
    };
  }

  const eligibleUsd = Math.min(drill.requestedUsd, drill.operatorRecommendedUsd);
  const approvedUsd = roundMoney(Math.max(0, Math.min(eligibleUsd, entitlement.remainingCapUsd, params.reserveUsd)));
  if (approvedUsd <= 0) {
    return {
      decision: denyClaim({
        drill,
        entitlementId: entitlement.entitlementId,
        reason: entitlement.remainingCapUsd <= 0 ? "coverage_cap_exhausted" : "reserve_exhausted",
        reserveUsd: params.reserveUsd,
        remainingCapUsd,
      }),
      reserveUsd: params.reserveUsd,
    };
  }

  entitlement.remainingCapUsd = roundMoney(entitlement.remainingCapUsd - approvedUsd);
  entitlement.status = entitlement.remainingCapUsd <= 0 ? "exhausted" : "active";
  const reserveAfterUsd = roundMoney(params.reserveUsd - approvedUsd);

  return {
    decision: {
      ...drill,
      entitlementId: entitlement.entitlementId,
      decision: "approved",
      denialReason: null,
      approvedUsd,
      deniedOverCapUsd: roundMoney(Math.max(0, eligibleUsd - approvedUsd)),
      remainingCapAfterUsd: entitlement.remainingCapUsd,
      reserveAfterUsd,
      stateTrail: [
        "submitted",
        "evidence_attached",
        "operator_recommended",
        "cap_checked",
        "reserve_booked",
        "settled",
      ],
    },
    reserveUsd: reserveAfterUsd,
  };
}

function buildEndToEndPoc(assumptions: Assumptions): EndToEndPocOutput {
  const riskBackerMarket = buildRiskBackerMarket(assumptions);
  const state: QuoteState = {
    soldUnits: 0,
    claimsPayingReserveUsd: assumptions.openingProtocolReserveUsd + riskBackerMarket.totalBackerCapitalUsd,
  };
  let reserveUsd = state.claimsPayingReserveUsd;
  const quoteReceipts: SignedQuoteReceipt[] = [];
  const entitlements: CoverageEntitlement[] = [];

  for (const request of assumptions.endToEndPoc.quoteRequests) {
    const { quote, entitlement } = buildQuoteAndEntitlement({ assumptions, request, state });
    quoteReceipts.push(quote);
    entitlements.push(entitlement);
    state.soldUnits += quote.units;
    const premiumReserveUsd = roundMoney(quote.premiumUsedUsd * assumptions.product.claimsReserveShareOfPremium);
    state.claimsPayingReserveUsd = roundMoney(state.claimsPayingReserveUsd + premiumReserveUsd);
    reserveUsd = state.claimsPayingReserveUsd;
  }

  const claimDecisions: ClaimDecision[] = [];
  let paidClaimsUsd = 0;
  for (const drill of assumptions.endToEndPoc.claimDrills) {
    const entitlement = entitlements.find((entry) => entry.member === drill.member);
    const result = adjudicateClaim({ drill, entitlement, reserveUsd });
    claimDecisions.push(result.decision);
    reserveUsd = result.reserveUsd;
    paidClaimsUsd = roundMoney(paidClaimsUsd + result.decision.approvedUsd);
    state.claimsPayingReserveUsd = reserveUsd;
  }

  return {
    productionLogic: [
      "risk_backers_deposit_any_amount_for_junior_backstop_shares",
      "members_request_signed_quotes_from_curve_and_reserve_snapshot",
      "purchase_activation_mints_coverage_entitlement_with_fixed_cap_and_waiting_periods",
      "claim_adjudication_checks_window_waiting_period_evidence_scope_remaining_cap_and_reserve",
      "approved_claims_reduce_member_remaining_cap_and_claims_paying_reserve",
    ],
    riskBackerMarket,
    quoteReceipts,
    entitlements,
    claimDecisions,
    finalReserveUsd: roundMoney(reserveUsd),
    paidClaimsUsd,
    activeCoverageLimitUsd: entitlements.reduce((sum, entitlement) => sum + entitlement.coverageCapUsd, 0),
    remainingCoverageLimitUsd: roundMoney(entitlements.reduce((sum, entitlement) => sum + entitlement.remainingCapUsd, 0)),
  };
}

function budgetRange(mix: BudgetMix): [number, number] {
  const budgets = mix.map((entry) => entry.budgetUsd);
  return [Math.min(...budgets), Math.max(...budgets)];
}

function buildFlatPromisePortfolio(params: {
  assumptions: Assumptions;
  members: number;
  budgetMix: BudgetMix;
  promisedCapUsd: number;
  seedOffset: number;
}): Portfolio {
  const rng = createRng((params.assumptions.monteCarlo.seed + params.seedOffset) >>> 0);
  const memberQuotes: MemberQuote[] = [];
  for (let i = 0; i < params.members; i += 1) {
    const budgetUsd = chooseBudget(params.budgetMix, rng);
    memberQuotes.push({
      budgetUsd,
      premiumUsedUsd: budgetUsd,
      coverageCapUsd: params.promisedCapUsd,
      units: params.promisedCapUsd / params.assumptions.product.unitSizeUsd,
      averageUnitPriceUsd: roundMoney(budgetUsd / (params.promisedCapUsd / params.assumptions.product.unitSizeUsd)),
      marginalUnitPriceUsd: roundMoney(budgetUsd / (params.promisedCapUsd / params.assumptions.product.unitSizeUsd)),
      reserveStressMultiplier: 1,
      impliedPremiumRatePct: roundPercent(budgetUsd / params.promisedCapUsd),
    });
  }

  const grossPremiumUsd = memberQuotes.reduce((sum, quote) => sum + quote.premiumUsedUsd, 0);
  const activeCoverageLimitUsd = memberQuotes.reduce((sum, quote) => sum + quote.coverageCapUsd, 0);
  return {
    memberQuotes,
    grossPremiumUsd: roundMoney(grossPremiumUsd),
    claimsReserveFromPremiumUsd: roundMoney(grossPremiumUsd * params.assumptions.product.claimsReserveShareOfPremium),
    activeCoverageLimitUsd: roundUsd(activeCoverageLimitUsd),
    averagePremiumUsd: roundMoney(grossPremiumUsd / params.members),
    averageCoverageCapUsd: roundUsd(activeCoverageLimitUsd / params.members),
    finalMarginalUnitPriceUsd: memberQuotes.length > 0 ? memberQuotes[memberQuotes.length - 1]!.marginalUnitPriceUsd : 0,
  };
}

function underwritingCollateral(model: HybridModelAssumptions): {
  totalPredictionCollateralUsd: number;
  claimsTrancheCapitalUsd: number;
  traderPayoutLiabilityUsd: number;
} {
  const market = model.underwritingMarket;
  if (!market) {
    return {
      totalPredictionCollateralUsd: 0,
      claimsTrancheCapitalUsd: 0,
      traderPayoutLiabilityUsd: 0,
    };
  }
  const totalPredictionCollateralUsd = roundMoney(market.predictorCount * market.averageStakeUsd);
  const claimsTrancheCapitalUsd = roundMoney(totalPredictionCollateralUsd * (market.claimsTrancheSharePct / 100));
  return {
    totalPredictionCollateralUsd,
    claimsTrancheCapitalUsd,
    traderPayoutLiabilityUsd: roundMoney(totalPredictionCollateralUsd - claimsTrancheCapitalUsd),
  };
}

function healthBondMitigation(model: HybridModelAssumptions): {
  adoptionRate: number;
  perClaimForfeitureUsd: number;
  frequencyReductionPct: number;
} | undefined {
  if (!model.healthBond) return undefined;
  return {
    adoptionRate: model.healthBond.adoptionRate,
    perClaimForfeitureUsd: roundMoney(model.healthBond.averageStakeUsd * (model.healthBond.claimForfeiturePct / 100)),
    frequencyReductionPct: model.healthBond.adoptionRate
      * (model.healthBond.moralHazardFrequencyReductionPct / 100),
  };
}

function evaluateHybridIndemnity(params: {
  assumptions: Assumptions;
  model: HybridModelAssumptions;
  scale: HybridScaleAssumptions;
  seedOffset: number;
}): {
  portfolio: Portfolio;
  distribution: ClaimDistribution;
  claimsPayingReserveUsd: number;
  launchGate: Gate;
  additionalReserveNeededUsd: number;
  reserveFloorAdditionalNeededUsd: number;
  expectedSurplusUsd: number;
} {
  const { assumptions, model, scale, seedOffset } = params;
  const collateral = underwritingCollateral(model);
  const effectiveRiskBackerCapitalUsd = roundMoney(scale.riskBackerCapitalUsd + collateral.claimsTrancheCapitalUsd);
  const portfolio = model.kind === "pure_pay_anything_pool"
    ? buildFlatPromisePortfolio({
      assumptions,
      members: scale.members,
      budgetMix: scale.budgetMix,
      promisedCapUsd: model.purePool?.promisedCapUsd ?? assumptions.product.maxMemberCapUsd,
      seedOffset,
    })
    : buildPortfolio({
      assumptions,
      members: scale.members,
      budgetMix: scale.budgetMix,
      riskMultiplier: scale.riskMultiplier,
      riskBackerCapitalUsd: effectiveRiskBackerCapitalUsd,
      seedOffset,
    });
  const claimsPayingReserveUsd = roundMoney(
    assumptions.openingProtocolReserveUsd
    + effectiveRiskBackerCapitalUsd
    + portfolio.claimsReserveFromPremiumUsd,
  );
  const distribution = simulateClaimsDistribution({
    assumptions,
    portfolio,
    frequencyMultiplier: scale.frequencyMultiplier,
    severityMultiplier: scale.severityMultiplier,
    reserveUsd: claimsPayingReserveUsd,
    seedOffset: seedOffset + 457,
    healthBondMitigation: healthBondMitigation(model),
  });
  const solvencyGate = evaluateGate({
    reserveUsd: claimsPayingReserveUsd,
    p995ClaimsUsd: distribution.p995ClaimsUsd,
    breachProbability: distribution.reserveBreachProbability,
  });
  const reserveFloorAdditionalNeededUsd = Math.max(
    0,
    roundUsd((assumptions.product.targetReserveToLimitRatio * portfolio.activeCoverageLimitUsd) - claimsPayingReserveUsd),
  );
  const launchGate = applyReserveFloorGate({
    baseGate: solvencyGate,
    reserveUsd: claimsPayingReserveUsd,
    activeCoverageLimitUsd: portfolio.activeCoverageLimitUsd,
    product: assumptions.product,
  });

  return {
    portfolio,
    distribution,
    claimsPayingReserveUsd,
    launchGate,
    additionalReserveNeededUsd: Math.max(0, distribution.p995ClaimsUsd - claimsPayingReserveUsd),
    reserveFloorAdditionalNeededUsd,
    expectedSurplusUsd: roundUsd(portfolio.grossPremiumUsd - distribution.averageClaimsUsd),
  };
}

function simulateParametricDistribution(params: {
  assumptions: Assumptions;
  members: number;
  eventFrequency: number;
  benefitUsd: number;
  reserveUsd: number;
  seedOffset: number;
}): ClaimDistribution {
  const rng = createRng((params.assumptions.monteCarlo.seed + params.seedOffset) >>> 0);
  const claims: number[] = [];
  for (let trial = 0; trial < params.assumptions.monteCarlo.trials; trial += 1) {
    claims.push(claimCount(params.members, params.eventFrequency, rng) * params.benefitUsd);
  }
  const average = claims.reduce((sum, value) => sum + value, 0) / claims.length;
  const p95 = quantile(claims, 0.95);
  const p99 = quantile(claims, 0.99);
  const p995 = quantile(claims, params.assumptions.targetSolvencyQuantile);
  const breachProbability = claims.filter((value) => value > params.reserveUsd).length / claims.length;
  return {
    claims,
    averageClaimsUsd: roundUsd(average),
    p95ClaimsUsd: roundUsd(p95),
    p99ClaimsUsd: roundUsd(p99),
    p995ClaimsUsd: roundUsd(p995),
    reserveBreachProbability: Number(breachProbability.toFixed(6)),
  };
}

function evaluateHybridParametric(params: {
  assumptions: Assumptions;
  model: HybridModelAssumptions;
  scale: HybridScaleAssumptions;
  seedOffset: number;
}) {
  const parametric = params.model.parametric!;
  const grossPremiumUsd = roundMoney(params.scale.members * parametric.premiumPerMemberUsd);
  const claimsReserveFromPremiumUsd = roundMoney(grossPremiumUsd * params.assumptions.product.claimsReserveShareOfPremium);
  const activeCoverageLimitUsd = roundUsd(params.scale.members * parametric.benefitUsd);
  const claimsPayingReserveUsd = roundMoney(
    params.assumptions.openingProtocolReserveUsd
    + params.scale.riskBackerCapitalUsd
    + claimsReserveFromPremiumUsd,
  );
  const distribution = simulateParametricDistribution({
    assumptions: params.assumptions,
    members: params.scale.members,
    eventFrequency: parametric.eventFrequency * params.scale.frequencyMultiplier,
    benefitUsd: parametric.benefitUsd,
    reserveUsd: claimsPayingReserveUsd,
    seedOffset: params.seedOffset + 457,
  });
  const solvencyGate = evaluateGate({
    reserveUsd: claimsPayingReserveUsd,
    p995ClaimsUsd: distribution.p995ClaimsUsd,
    breachProbability: distribution.reserveBreachProbability,
  });
  const reserveFloorAdditionalNeededUsd = Math.max(
    0,
    roundUsd((params.assumptions.product.targetReserveToLimitRatio * activeCoverageLimitUsd) - claimsPayingReserveUsd),
  );
  const launchGate = applyReserveFloorGate({
    baseGate: solvencyGate,
    reserveUsd: claimsPayingReserveUsd,
    activeCoverageLimitUsd,
    product: params.assumptions.product,
  });
  const portfolio: Portfolio = {
    memberQuotes: [],
    grossPremiumUsd,
    claimsReserveFromPremiumUsd,
    activeCoverageLimitUsd,
    averagePremiumUsd: parametric.premiumPerMemberUsd,
    averageCoverageCapUsd: parametric.benefitUsd,
    finalMarginalUnitPriceUsd: parametric.premiumPerMemberUsd,
  };

  return {
    portfolio,
    distribution,
    claimsPayingReserveUsd,
    launchGate,
    additionalReserveNeededUsd: Math.max(0, distribution.p995ClaimsUsd - claimsPayingReserveUsd),
    reserveFloorAdditionalNeededUsd,
    expectedSurplusUsd: roundUsd(grossPremiumUsd - distribution.averageClaimsUsd),
  };
}

function buildScaleCheck(params: {
  assumptions: Assumptions;
  model: HybridModelAssumptions;
  label: string;
  memberFactor: number;
  capitalFactor: number;
  seedOffset: number;
}): HybridScaleCheck {
  const scale: HybridScaleAssumptions = {
    ...params.model.scale,
    members: Math.round(params.model.scale.members * params.memberFactor),
    riskBackerCapitalUsd: roundMoney(params.model.scale.riskBackerCapitalUsd * params.capitalFactor),
  };
  const result = params.model.kind === "parametric_fast_cash"
    ? evaluateHybridParametric({
      assumptions: params.assumptions,
      model: params.model,
      scale,
      seedOffset: params.seedOffset,
    })
    : evaluateHybridIndemnity({
      assumptions: params.assumptions,
      model: params.model,
      scale,
      seedOffset: params.seedOffset,
    });

  return {
    label: params.label,
    members: scale.members,
    riskBackerCapitalUsd: roundMoney(scale.riskBackerCapitalUsd + underwritingCollateral(params.model).claimsTrancheCapitalUsd),
    grossPremiumUsd: result.portfolio.grossPremiumUsd,
    activeCoverageLimitUsd: result.portfolio.activeCoverageLimitUsd,
    claimsPayingReserveUsd: result.claimsPayingReserveUsd,
    p995ClaimsUsd: result.distribution.p995ClaimsUsd,
    reserveToActiveLimitPct: result.portfolio.activeCoverageLimitUsd > 0
      ? roundPercent(result.claimsPayingReserveUsd / result.portfolio.activeCoverageLimitUsd)
      : 0,
    launchGate: result.launchGate,
  };
}

function trancheExpectedLosses(
  claims: number[],
  tranches: NonNullable<HybridModelAssumptions["tranches"]>,
) {
  let attachmentUsd = 0;
  return tranches.map((tranche) => {
    const losses = claims.map((claim) =>
      Math.min(Math.max(claim - attachmentUsd, 0), tranche.capitalUsd),
    );
    const expectedLossUsd = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
    const p995LossUsd = quantile(losses, 0.995);
    const row = {
      id: tranche.id,
      label: tranche.label,
      attachmentUsd,
      capitalUsd: tranche.capitalUsd,
      couponSharePct: tranche.couponSharePct,
      expectedLossPct: roundPercent(expectedLossUsd / Math.max(tranche.capitalUsd, 1)),
      p995LossPct: roundPercent(p995LossUsd / Math.max(tranche.capitalUsd, 1)),
    };
    attachmentUsd += tranche.capitalUsd;
    return row;
  });
}

function hybridFirstPrinciples(model: HybridModelAssumptions): string[] {
  const shared = [
    "A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.",
    "Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.",
    "Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.",
  ];
  if (model.kind === "pure_pay_anything_pool") {
    return [
      "This failure case is a bad curve: every budget receives the same liability, so premium no longer tracks risk.",
      "A viral pool is not the same thing as a solvent insurance product.",
      "Pay-anything can work only when the amount paid maps to a fixed, reserve-gated cap before activation.",
    ];
  }
  if (model.kind === "calibrated_pay_anything_curve") {
    return [
      ...shared,
      "Pay-anything is viable when the curve converts every dollar into an exact cap using current reserve depth.",
      "The member budget is flexible, but the coverage promise is not flexible after purchase.",
    ];
  }
  if (model.kind === "loss_ratio_event_market") {
    return [
      ...shared,
      "A prediction market is useful when it predicts aggregate pool risk instead of individual claim validity.",
      "The event must be objective: for example, pool loss ratio above a published threshold after claim close.",
    ];
  }
  if (model.kind === "underwriting_prediction_tranche") {
    return [
      ...shared,
      "Prediction collateral can count as claims capital only for the slice explicitly locked into the claims waterfall.",
      "Correct predictors should earn from yield, fees, surplus, and wrong-side penalties only after claims reserves clear.",
    ];
  }
  if (model.kind === "member_health_bond") {
    return [
      ...shared,
      "A member can back themselves to avoid claims through a no-claim bond without profiting from being sick.",
      "The bond should reduce net claim cost through forfeiture or deductible mechanics, not replace the coverage promise.",
    ];
  }
  if (model.kind === "full_stack_market_mutual") {
    return [
      ...shared,
      "The strongest architecture combines flexible member pricing, explicit junior capital, predictor scoring, and no-claim incentives.",
      "The UI can stay simple while the protocol separately accounts for reserve, market collateral, and member bond economics.",
    ];
  }
  if (model.kind === "collateralized_sidecar") {
    return [
      ...shared,
      "Backers should know exactly which layer of loss they absorb and when their capital can be released.",
      "This is a capital-markets wrapper around insurance risk, not consumer gambling.",
    ];
  }
  if (model.kind === "parametric_fast_cash") {
    return [
      ...shared,
      "A fixed benefit is easier to price than open-ended reimbursement, but creates basis risk for members.",
      "The trigger must be independently verifiable and hard to manipulate.",
    ];
  }
  if (model.kind === "member_mutual_rebate") {
    return [
      ...shared,
      "Members can share upside from good claims experience without betting against sick members.",
      "Rebates should be discretionary surplus distributions after reserves are satisfied.",
    ];
  }
  return shared;
}

function hybridPolicyDesign(model: HybridModelAssumptions): string[] {
  if (model.kind === "pure_pay_anything_pool") {
    return [
      "Do not ship this flat-promise version.",
      "Use it only as a red-team case proving that the curve must bind budget to cap.",
      "Never represent arbitrary payment as broad 3000 USD cover unless that cap is actually priced and reserved.",
    ];
  }
  if (model.kind === "calibrated_pay_anything_curve") {
    return [
      "Member policy: pay any amount above the floor and receive a signed, fixed cap from the curve.",
      "Pricing rule: the same 15 USD buys less cover when reserve depth is thin or cohort risk is higher.",
      "Issuance rule: no entitlement mints unless p99.5 and reserve-floor gates pass after the quote.",
    ];
  }
  if (model.kind === "loss_ratio_event_market") {
    return [
      "Member policy: fixed 30-day acute emergency entitlement with signed quote receipt.",
      "Market contract: aggregate pool loss ratio above threshold, settled after claim runout.",
      "Claims boundary: AI processors and operators handle claims offchain; market data is aggregate only.",
    ];
  }
  if (model.kind === "underwriting_prediction_tranche") {
    return [
      "Member policy: same capped acute cover.",
      "Market policy: predictors stake on aggregate loss-ratio bands; a fixed share of stake is posted as junior claims capital.",
      "Reward rule: correct predictors earn only after claims, reserve margin, and capital replenishment are satisfied.",
    ];
  }
  if (model.kind === "member_health_bond") {
    return [
      "Member policy: capped cover plus optional no-claim bond.",
      "Bond rule: no claim returns bond plus rebate; a covered claim forfeits the agreed amount into the pool.",
      "Safety rule: members cannot buy uncapped upside from becoming sick.",
    ];
  }
  if (model.kind === "full_stack_market_mutual") {
    return [
      "Member policy: pay-anything quote curve plus optional no-claim bond.",
      "Capital policy: sidecar and prediction collateral form explicit junior reserve layers.",
      "Settlement policy: claims first, reserve margin second, capital replenishment third, predictor/member rewards fourth.",
    ];
  }
  if (model.kind === "collateralized_sidecar") {
    return [
      "Member policy: same capped acute cover.",
      "Capital policy: first-loss sponsor layer, junior sidecar layer, senior sidecar layer.",
      "Release rule: capital unlocks only after claim runout, dispute window, and reserve reconciliation.",
    ];
  }
  if (model.kind === "parametric_fast_cash") {
    return [
      "Member policy: small fixed cash benefit for a named urgent-care or ER trigger.",
      "Claim rule: verified trigger pays fixed benefit without itemized bill reimbursement.",
      "Disclosure: fast cash may be less than the medical bill and is not full health cover.",
    ];
  }
  if (model.kind === "member_mutual_rebate") {
    return [
      "Member policy: capped acute cover plus possible end-of-window surplus rebate.",
      "Rebate rule: paid only after p99.5 reserve, claims runout, and fraud holds are cleared.",
      "Backer rule: backers earn a defined surplus share before protocol margin.",
    ];
  }
  return [
    "Member policy: choose budget, receive capped quote, activate entitlement.",
    "Backer policy: deposit any amount into junior backstop capital.",
    "Issuance rule: pause or reprice when reserve depth falls below target.",
  ];
}

function verdictFor(model: HybridModelAssumptions, launchGate: Gate): HybridModelResult["verdict"] {
  if (model.kind === "pure_pay_anything_pool") return "reject";
  if (launchGate === "pause") return "research_only";
  if (
    model.kind === "loss_ratio_event_market"
    || model.kind === "collateralized_sidecar"
    || model.kind === "underwriting_prediction_tranche"
    || model.kind === "full_stack_market_mutual"
  ) return "needs_wrapper";
  return "ship_candidate";
}

function buildHybridModelResult(
  assumptions: Assumptions,
  model: HybridModelAssumptions,
  index: number,
): HybridModelResult {
  const seedOffset = 20_000 + index * 9_973;
  const evaluated = model.kind === "parametric_fast_cash"
    ? evaluateHybridParametric({
      assumptions,
      model,
      scale: model.scale,
      seedOffset,
    })
    : evaluateHybridIndemnity({
      assumptions,
      model,
      scale: model.scale,
      seedOffset,
    });
  const { portfolio, distribution } = evaluated;
  const expectedLossRatioPct = portfolio.grossPremiumUsd > 0
    ? roundPercent(distribution.averageClaimsUsd / portfolio.grossPremiumUsd)
    : 0;
  const collateral = underwritingCollateral(model);
  const market: Record<string, number | string | null> = {
    baseRiskBackerCapitalUsd: model.scale.riskBackerCapitalUsd,
    effectiveClaimsCapitalUsd: roundMoney(model.scale.riskBackerCapitalUsd + collateral.claimsTrancheCapitalUsd),
  };
  const notes: string[] = [];

  if (model.market) {
    const thresholdClaimsUsd = roundMoney(portfolio.grossPremiumUsd * model.market.eventThresholdLossRatio);
    const fairProbability = distribution.claims.filter((claim) => claim > thresholdClaimsUsd).length / distribution.claims.length;
    const marketProbability = clamp(fairProbability + model.market.marketProbabilityBiasPct / 100, 0.01, 0.99);
    market.eventThresholdLossRatioPct = roundPercent(model.market.eventThresholdLossRatio);
    market.thresholdClaimsUsd = thresholdClaimsUsd;
    market.fairProbabilityPct = roundPercent(fairProbability);
    market.marketProbabilityPct = roundPercent(marketProbability);
    market.yesPriceCents = roundMoney(marketProbability * 100);
    market.liquidityUsd = model.market.liquidityUsd;
    market.quoteAdjustmentPct = roundPercent((marketProbability - fairProbability) * model.market.quoteAdjustmentSensitivity);
    notes.push("Prediction market is modeled as a pricing and monitoring signal unless collateral is explicitly locked into a claims tranche.");
  }

  if (model.underwritingMarket) {
    const underwriting = model.underwritingMarket;
    const grossRewardPoolUsd = roundMoney(
      collateral.claimsTrancheCapitalUsd * (underwriting.yieldAprPct / 100) * (assumptions.product.coverWindowDays / 365)
      + portfolio.grossPremiumUsd * (underwriting.pricingFeePct / 100)
      + Math.max(0, evaluated.expectedSurplusUsd) * (underwriting.rewardSurplusSharePct / 100),
    );
    const wrongStakePenaltyUsd = roundMoney(
      collateral.totalPredictionCollateralUsd
      * (1 - underwriting.signalAccuracyPct / 100)
      * (underwriting.wrongStakePenaltyPct / 100),
    );
    const correctStakeUsd = Math.max(1, collateral.totalPredictionCollateralUsd * (underwriting.signalAccuracyPct / 100));
    const thresholdClaimsUsd = roundMoney(portfolio.grossPremiumUsd * underwriting.eventThresholdLossRatio);
    const fairProbability = distribution.claims.filter((claim) => claim > thresholdClaimsUsd).length / distribution.claims.length;
    market.totalPredictionCollateralUsd = collateral.totalPredictionCollateralUsd;
    market.predictionClaimsTrancheUsd = collateral.claimsTrancheCapitalUsd;
    market.traderPayoutLiabilityUsd = collateral.traderPayoutLiabilityUsd;
    market.eventThresholdLossRatioPct = roundPercent(underwriting.eventThresholdLossRatio);
    market.fairThresholdProbabilityPct = roundPercent(fairProbability);
    market.signalAccuracyPct = underwriting.signalAccuracyPct;
    market.rewardPoolBeforeWrongStakeUsd = grossRewardPoolUsd;
    market.wrongStakePenaltyPoolUsd = wrongStakePenaltyUsd;
    market.expectedCorrectPredictorRoiPct = roundPercent((grossRewardPoolUsd + wrongStakePenaltyUsd) / correctStakeUsd);
    market.expectedWrongPredictorPenaltyPct = underwriting.wrongStakePenaltyPct;
    market.rewardFunding = "reserve_yield_plus_pricing_fees_plus_surplus_plus_wrong_stake_penalties_after_claims";
    notes.push(
      `${collateral.claimsTrancheCapitalUsd} USD of predictor collateral is treated as junior claims capital; ${collateral.traderPayoutLiabilityUsd} USD remains trader payout liability.`,
    );
    notes.push("Correct predictors are paid only after claims, reserve margin, and capital replenishment gates clear.");
  }

  if (model.tranches) {
    const tranches = trancheExpectedLosses(distribution.claims, model.tranches);
    const junior = tranches.find((tranche) => tranche.id === "junior-sidecar");
    const senior = tranches.find((tranche) => tranche.id === "senior-sidecar");
    market.trancheCount = tranches.length;
    market.juniorExpectedLossPct = junior?.expectedLossPct ?? null;
    market.seniorExpectedLossPct = senior?.expectedLossPct ?? null;
    market.maxTrancheP995LossPct = Math.max(...tranches.map((tranche) => tranche.p995LossPct));
    notes.push(...tranches.map((tranche) =>
      `${tranche.label}: attaches at ${tranche.attachmentUsd} USD, expected loss ${tranche.expectedLossPct}%, p99.5 impairment ${tranche.p995LossPct}%.`,
    ));
  }

  if (model.parametric) {
    market.triggerFrequencyPct = roundPercent(model.parametric.eventFrequency * model.scale.frequencyMultiplier);
    market.benefitUsd = model.parametric.benefitUsd;
    market.premiumPerMemberUsd = model.parametric.premiumPerMemberUsd;
    notes.push("Parametric benefit pays fast, but may underpay or overpay relative to the actual medical bill.");
  }

  if (model.rebate) {
    const surplus = Math.max(0, evaluated.expectedSurplusUsd);
    const memberRebatePoolUsd = roundMoney(surplus * (model.rebate.memberSurplusSharePct / 100));
    market.memberRebatePoolUsd = memberRebatePoolUsd;
    market.expectedRebatePerMemberUsd = roundMoney(memberRebatePoolUsd / model.scale.members);
    market.backerSurplusSharePct = model.rebate.backerSurplusSharePct;
    notes.push("Rebate is modeled only from expected surplus; production would pay it after claim runout and reserve lock.");
  }

  if (model.healthBond) {
    const adoptedMembers = Math.round(model.scale.members * model.healthBond.adoptionRate);
    const lockedHealthBondUsd = roundMoney(adoptedMembers * model.healthBond.averageStakeUsd);
    const mitigatedFrequency = assumptions.baselineClaimFrequency
      * model.scale.frequencyMultiplier
      * (1 - model.healthBond.adoptionRate * (model.healthBond.moralHazardFrequencyReductionPct / 100));
    const expectedBondClaims = model.scale.members * mitigatedFrequency * model.healthBond.adoptionRate;
    const expectedForfeitureUsd = roundMoney(
      expectedBondClaims
      * model.healthBond.averageStakeUsd
      * (model.healthBond.claimForfeiturePct / 100),
    );
    const noClaimRewardPoolUsd = roundMoney(
      Math.max(0, evaluated.expectedSurplusUsd) * (model.healthBond.noClaimRewardSharePct / 100),
    );
    const expectedHealthyStakers = Math.max(1, adoptedMembers - expectedBondClaims);
    market.healthBondAdoptedMembers = adoptedMembers;
    market.lockedHealthBondUsd = lockedHealthBondUsd;
    market.perClaimForfeitureUsd = roundMoney(model.healthBond.averageStakeUsd * (model.healthBond.claimForfeiturePct / 100));
    market.modeledFrequencyReductionPct = roundPercent(model.healthBond.adoptionRate * (model.healthBond.moralHazardFrequencyReductionPct / 100));
    market.expectedBondForfeitureUsd = expectedForfeitureUsd;
    market.noClaimRewardPoolUsd = noClaimRewardPoolUsd;
    market.expectedNoClaimRewardPerHealthyStakerUsd = roundMoney(noClaimRewardPoolUsd / expectedHealthyStakers);
    notes.push("Health bonds are modeled as claim-cost mitigation and no-claim rebates, not as a way to profit from illness.");
  }

  if (model.kind === "pure_pay_anything_pool") {
    market.promisedCapUsd = model.purePool?.promisedCapUsd ?? assumptions.product.maxMemberCapUsd;
    market.averagePremiumRatePct = portfolio.activeCoverageLimitUsd > 0
      ? roundPercent(portfolio.grossPremiumUsd / portfolio.activeCoverageLimitUsd)
      : 0;
    notes.push("This intentionally fails because pricing is no longer risk-proportional.");
  }

  return {
    id: model.id,
    name: model.name,
    kind: model.kind,
    verdict: verdictFor(model, evaluated.launchGate),
    launchGate: evaluated.launchGate,
    oneLine: model.oneLine,
    memberOffering: model.memberOffering,
    marketMechanism: model.marketMechanism,
    productionBoundary: model.productionBoundary,
    firstPrinciples: hybridFirstPrinciples(model),
    policyDesign: hybridPolicyDesign(model),
    offering: {
      members: model.scale.members,
      averagePremiumUsd: portfolio.averagePremiumUsd,
      averageCoverageCapUsd: portfolio.averageCoverageCapUsd,
      activeCoverageLimitUsd: portfolio.activeCoverageLimitUsd,
      memberBudgetRangeUsd: budgetRange(model.scale.budgetMix),
    },
    actuarial: {
      grossPremiumUsd: portfolio.grossPremiumUsd,
      claimsPayingReserveUsd: evaluated.claimsPayingReserveUsd,
      expectedClaimsUsd: distribution.averageClaimsUsd,
      expectedLossRatioPct,
      p95ClaimsUsd: distribution.p95ClaimsUsd,
      p99ClaimsUsd: distribution.p99ClaimsUsd,
      p995ClaimsUsd: distribution.p995ClaimsUsd,
      reserveBreachProbability: distribution.reserveBreachProbability,
      reserveToActiveLimitPct: portfolio.activeCoverageLimitUsd > 0
        ? roundPercent(evaluated.claimsPayingReserveUsd / portfolio.activeCoverageLimitUsd)
        : 0,
      additionalReserveNeededUsd: evaluated.additionalReserveNeededUsd,
      reserveFloorAdditionalNeededUsd: evaluated.reserveFloorAdditionalNeededUsd,
      expectedSurplusUsd: evaluated.expectedSurplusUsd,
    },
    market,
    scaleChecks: [
      buildScaleCheck({
        assumptions,
        model,
        label: "launch scale",
        memberFactor: 1,
        capitalFactor: 1,
        seedOffset: seedOffset + 1_000,
      }),
      buildScaleCheck({
        assumptions,
        model,
        label: "3x demand with matching capital",
        memberFactor: 3,
        capitalFactor: 3,
        seedOffset: seedOffset + 2_000,
      }),
      buildScaleCheck({
        assumptions,
        model,
        label: "3x demand with launch capital",
        memberFactor: 3,
        capitalFactor: 1,
        seedOffset: seedOffset + 3_000,
      }),
    ],
    notes,
  };
}

function buildHybridModelResults(assumptions: Assumptions): HybridModelResult[] {
  return assumptions.hybridModels.map((model, index) => buildHybridModelResult(assumptions, model, index));
}

function buildMemo(output: ReturnType<typeof buildOutput>, assumptions: Assumptions): string {
  const sample = output.quoteTables[0]!;
  const micro = sample.quotes.find((quote) => quote.budgetUsd === assumptions.product.minMemberBudgetUsd)!;
  const scenarioRows = output.scenarioResults.map((scenario) => {
    const p995 = "p995ClaimsUsd" in scenario ? scenario.p995ClaimsUsd : scenario.stressedClaimsUsd;
    const solvencyExtra = "additionalReserveNeededUsd" in scenario ? scenario.additionalReserveNeededUsd : Math.max(0, -scenario.reserveMarginUsd);
    const extra = Math.max(solvencyExtra, scenario.reserveFloorAdditionalNeededUsd);
    return `| ${scenario.id} | ${scenario.launchGate} | ${scenario.members} | ${scenario.grossPremiumUsd} | ${scenario.activeCoverageLimitUsd} | ${p995} | ${scenario.claimsPayingReserveUsd} | ${extra} |`;
  }).join("\n");
  const quoteRows = sample.quotes.map((quote) =>
    `| ${quote.budgetUsd} | ${quote.coverageCapUsd} | ${quote.premiumUsedUsd} | ${quote.impliedPremiumRatePct}% |`,
  ).join("\n");
  const backerRows = output.endToEndPoc.riskBackerMarket.positions.map((position) =>
    `| ${position.backer} | ${position.depositUsd} | ${position.shares} | ${position.sharePct}% |`,
  ).join("\n");
  const quoteReceiptRows = output.endToEndPoc.quoteReceipts.map((quote) =>
    `| ${quote.member} | ${quote.budgetUsd} | ${quote.coverageCapUsd} | ${quote.premiumUsedUsd} | ${quote.quoteId} |`,
  ).join("\n");
  const entitlementRows = output.endToEndPoc.entitlements.map((entitlement) =>
    `| ${entitlement.member} | ${entitlement.coverageCapUsd} | ${entitlement.remainingCapUsd} | ${entitlement.accidentWaitUntil} | ${entitlement.illnessWaitUntil} | ${entitlement.status} |`,
  ).join("\n");
  const claimRows = output.endToEndPoc.claimDecisions.map((claim) =>
    `| ${claim.claimId} | ${claim.member} | ${claim.decision} | ${claim.denialReason ?? "none"} | ${claim.approvedUsd} | ${claim.deniedOverCapUsd} | ${claim.remainingCapAfterUsd} |`,
  ).join("\n");
  const hybridRows = output.hybridModelResults.map((model) =>
    `| ${model.name} | ${model.verdict} | ${model.launchGate} | ${model.offering.members} | ${model.offering.averagePremiumUsd} | ${model.offering.averageCoverageCapUsd} | ${model.actuarial.expectedLossRatioPct}% | ${model.actuarial.p995ClaimsUsd} | ${model.actuarial.claimsPayingReserveUsd} |`,
  ).join("\n");

  return `# Nomad Protect Curve PoC

Generated: ${output.generatedAt}

## Headline

- Status: ${assumptions.status}.
- This PoC keeps the useful prediction-market idea on the risk-backer side: anyone can deposit any amount into backstop capital.
- Member coverage is still quoted, capped, and reserve-gated. A ${assumptions.product.minMemberBudgetUsd} USD member budget buys about ${micro.coverageCapUsd} USD of cover in a fresh market, not unlimited insurance.
- Curve: base ${assumptions.product.baseUnitPremiumUsd} USD per ${assumptions.product.unitSizeUsd} USD cover unit, depth ${assumptions.product.curveDepthUnits} units, gamma ${assumptions.product.curveGamma}.
- Solvency gate: p${assumptions.targetSolvencyQuantile * 100}.

## Fresh-Market Quote Table

| Member Budget | Coverage Cap | Premium Used | Premium / Cap |
| --- | ---: | ---: | ---: |
${quoteRows}

## Scenario Gates

| Scenario | Gate | Members | Premium | Active Cover Limit | p99.5 or Stress Claims | Reserve | Extra Reserve |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${scenarioRows}

## Hybrid Model Snapshot

| Model | Verdict | Gate | Members | Avg Premium | Avg Cap | Expected Loss Ratio | p99.5 Claims | Reserve |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${hybridRows}

See \`hybrid-model-report.md\` for the full first-principles model comparison, scale checks, and plain-language explanation.

## End-to-End Production Logic Drill

### Risk Backers

| Backer | Deposit | Shares | Share |
| --- | ---: | ---: | ---: |
${backerRows}

### Signed Quotes

| Member | Budget | Coverage Cap | Premium Used | Quote ID |
| --- | ---: | ---: | ---: | --- |
${quoteReceiptRows}

### Activated Entitlements

| Member | Coverage Cap | Remaining Cap | Accident Active | Illness Active | Status |
| --- | ---: | ---: | --- | --- | --- |
${entitlementRows}

### Claim Decisions

| Claim | Member | Decision | Reason | Approved | Denied Over Cap | Remaining Cap |
| --- | --- | --- | --- | ---: | ---: | ---: |
${claimRows}

Final reserve after the drill: ${output.endToEndPoc.finalReserveUsd} USD. Paid claims: ${output.endToEndPoc.paidClaimsUsd} USD.

## Product Rule

Do not sell this as "put any amount into a pool and you are insured." Sell it as:

> Choose a cover budget. The curve returns the cover cap available at current reserve and demand. Anyone can separately back the market with any amount of risk capital.

## Limits

${assumptions.methodLimitations.map((limit) => `- ${limit}`).join("\n")}
`;
}

function buildHybridModelReport(output: ReturnType<typeof buildOutput>, assumptions: Assumptions): string {
  const rows = output.hybridModelResults.map((model) =>
    `| ${model.name} | ${model.verdict} | ${model.launchGate} | ${model.offering.members} | ${model.offering.averagePremiumUsd} | ${model.offering.averageCoverageCapUsd} | ${model.actuarial.expectedLossRatioPct}% | ${model.actuarial.p995ClaimsUsd} | ${model.actuarial.claimsPayingReserveUsd} |`,
  ).join("\n");
  const scaleRows = output.hybridModelResults.flatMap((model) =>
    model.scaleChecks.map((scale) =>
      `| ${model.name} | ${scale.label} | ${scale.launchGate} | ${scale.members} | ${scale.riskBackerCapitalUsd} | ${scale.activeCoverageLimitUsd} | ${scale.p995ClaimsUsd} | ${scale.claimsPayingReserveUsd} | ${scale.reserveToActiveLimitPct}% |`,
    ),
  ).join("\n");
  const modelSections = output.hybridModelResults.map((model, index) => {
    const marketRows = Object.entries(model.market).map(([key, value]) =>
      `| ${key} | ${value ?? "n/a"} |`,
    ).join("\n");
    return `## Model ${index + 1}: ${model.name}

**Verdict:** ${model.verdict}. **Launch gate:** ${model.launchGate}.

${model.oneLine}

### Offering

- ${model.memberOffering}
- Members modeled: ${model.offering.members}.
- Average premium: ${model.offering.averagePremiumUsd} USD.
- Average coverage cap: ${model.offering.averageCoverageCapUsd} USD.
- Active coverage limit: ${model.offering.activeCoverageLimitUsd} USD.
- Budget range: ${model.offering.memberBudgetRangeUsd[0]}-${model.offering.memberBudgetRangeUsd[1]} USD.

### Market Design

${model.marketMechanism}

Production boundary: ${model.productionBoundary}

| Market Field | Value |
| --- | ---: |
${marketRows}

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | ${model.actuarial.grossPremiumUsd} |
| Expected claims | ${model.actuarial.expectedClaimsUsd} |
| Expected loss ratio | ${model.actuarial.expectedLossRatioPct}% |
| p95 claims | ${model.actuarial.p95ClaimsUsd} |
| p99 claims | ${model.actuarial.p99ClaimsUsd} |
| p99.5 claims | ${model.actuarial.p995ClaimsUsd} |
| Claims-paying reserve | ${model.actuarial.claimsPayingReserveUsd} |
| Reserve breach probability | ${model.actuarial.reserveBreachProbability} |
| Extra p99.5 reserve needed | ${model.actuarial.additionalReserveNeededUsd} |
| Extra reserve-floor capital needed | ${model.actuarial.reserveFloorAdditionalNeededUsd} |
| Expected surplus | ${model.actuarial.expectedSurplusUsd} |

### First Principles

${model.firstPrinciples.map((item) => `- ${item}`).join("\n")}

### Policy Design

${model.policyDesign.map((item) => `- ${item}`).join("\n")}

${model.notes.length > 0 ? `### Notes\n\n${model.notes.map((item) => `- ${item}`).join("\n")}\n` : ""}`;
  }).join("\n");

  return `# Hybrid Insurance + Prediction Market Models

Generated: ${output.generatedAt}

## Decision

A mix is viable, but not as one undifferentiated pool. The first-principles split is:

- Member side: insurance-grade coverage promise with a signed quote, fixed cap, defined window, waiting periods, exclusions, and claims adjudication.
- Market side: prediction/capital mechanism that prices aggregate risk, supplies backstop capital, or distributes surplus, separate from individual claim adjudication.
- Protocol side: reserve gates, p99.5 stress checks, capital release rules, fraud controls, and regulatory wrapper boundaries.

The best product shape is not "prediction market replaces insurance." It is "insurance entitlement plus market-priced risk capital."

## Model Scoreboard

| Model | Verdict | Gate | Members | Avg Premium | Avg Cap | Expected Loss Ratio | p99.5 Claims | Reserve |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Scale Checks

| Model | Scale | Gate | Members | Backer Capital | Active Cover Limit | p99.5 Claims | Reserve | Reserve / Active Limit |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${scaleRows}

${modelSections}

## Simple Language Summary

1. Pay-anything can work if the curve converts every budget into an exact cap before purchase.
2. The bad version is not "pay anything." The bad version is "pay anything and receive the same 3000 USD promise."
3. Predictor collateral can support claims when a defined slice is locked into the junior claims tranche.
4. Correct predictors can be paid from reserve yield, pricing fees, surplus, and wrong-side penalties after claims and reserve gates clear.
5. A member can back themselves through a no-claim health bond. That should reward staying healthy, not create uncapped upside from being sick.
6. The full-stack model is the most powerful, but the production accounting must separate claims reserve, trader payout liability, predictor rewards, and member rebates.

## Source Notes

- NAIC risk-based capital: insurers should hold capital in proportion to size and risk, and capital requirements exist so policyholder promises can be paid.
- NAIC consumer health guidance: health insurance is a premium-for-benefits arrangement, not a promise that every bill is fully paid.
- CFTC prediction-market guidance: event contracts are generally yes/no or outcome-linked contracts whose prices express perceived probabilities; regulated markets are expected to be neutral platforms, not counterparties taking the other side of users.
- CFTC 2026 prediction-market releases: the event-contract framework is actively evolving, so any real deployment needs current legal review.

## Sources

- NAIC Risk-Based Capital: https://content.naic.org/insurance-topics/risk-based-capital
- NAIC Health Insurance Consumer Guide: https://content.naic.org/consumer/health-insurance.htm
- CFTC Prediction Markets and Event Contracts: https://www.cftc.gov/LearnandProtect/PredictionMarkets
- CFTC Prediction Markets Advisory, March 12, 2026: https://www.cftc.gov/PressRoom/PressReleases/9193-26
- CFTC Prediction Markets ANPRM, March 12, 2026: https://www.cftc.gov/PressRoom/PressReleases/9194-26

## Limits

${assumptions.methodLimitations.map((limit) => `- ${limit}`).join("\n")}
`;
}

function buildOutput() {
  const assumptions = readJson<Assumptions>(ASSUMPTIONS_PATH);
  const quoteTables = buildQuoteTables(assumptions);
  const endToEndPoc = buildEndToEndPoc(assumptions);
  const hybridModelResults = buildHybridModelResults(assumptions);
  const scenarioResults = assumptions.scenarios.map((scenario, index) => {
    if (scenario.type === "independent_claims") {
      return evaluateIndependentScenario(scenario, assumptions, 1000 + index * 7919);
    }
    return evaluateCorrelatedScenario(scenario, assumptions, 1000 + index * 7919);
  });

  return {
    generated: true,
    generatedAt: "2026-05-01T00:00:00.000Z",
    reviewId: assumptions.reviewId,
    purpose: assumptions.purpose,
    status: assumptions.status,
    targetSolvencyQuantile: assumptions.targetSolvencyQuantile,
    product: {
      displayName: assumptions.product.displayName,
      coverWindowDays: assumptions.product.coverWindowDays,
      unitSizeUsd: assumptions.product.unitSizeUsd,
      minMemberBudgetUsd: assumptions.product.minMemberBudgetUsd,
      maxMemberCapUsd: assumptions.product.maxMemberCapUsd,
      waitingPeriods: assumptions.product.waitingPeriods,
    },
    quoteCurve: {
      formula: "unit_price(u) = base_unit_premium * risk_multiplier * reserve_stress * (1 + u / curve_depth) ^ gamma",
      baseUnitPremiumUsd: assumptions.product.baseUnitPremiumUsd,
      curveDepthUnits: assumptions.product.curveDepthUnits,
      curveGamma: assumptions.product.curveGamma,
      targetReserveToLimitRatio: assumptions.product.targetReserveToLimitRatio,
      claimsReserveShareOfPremium: assumptions.product.claimsReserveShareOfPremium,
    },
    quoteTables,
    scenarioResults,
    hybridModelResults,
    endToEndPoc,
    methodLimitations: assumptions.methodLimitations,
  };
}

const output = buildOutput();
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(MEMO_PATH, buildMemo(output, readJson<Assumptions>(ASSUMPTIONS_PATH)));
writeFileSync(HYBRID_REPORT_PATH, buildHybridModelReport(output, readJson<Assumptions>(ASSUMPTIONS_PATH)));
console.log("Generated examples/nomad-protect-curve-poc/review-output.json");
console.log("Generated examples/nomad-protect-curve-poc/review-memo.md");
console.log("Generated examples/nomad-protect-curve-poc/hybrid-model-report.md");
