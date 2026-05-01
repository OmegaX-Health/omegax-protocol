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

const ROOT = process.cwd();
const REVIEW_DIR = join(ROOT, "examples", "nomad-protect-curve-poc");
const ASSUMPTIONS_PATH = join(REVIEW_DIR, "assumptions.json");
const OUTPUT_PATH = join(REVIEW_DIR, "review-output.json");
const MEMO_PATH = join(REVIEW_DIR, "review-memo.md");

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

function simulateClaims(params: {
  assumptions: Assumptions;
  portfolio: Portfolio;
  frequencyMultiplier: number;
  severityMultiplier: number;
  reserveUsd: number;
  seedOffset: number;
}) {
  const rng = createRng((params.assumptions.monteCarlo.seed + params.seedOffset) >>> 0);
  const groups = groupedCaps(params.portfolio.memberQuotes);
  const claims: number[] = [];
  const probability = params.assumptions.baselineClaimFrequency * params.frequencyMultiplier;

  for (let trial = 0; trial < params.assumptions.monteCarlo.trials; trial += 1) {
    let total = 0;
    for (const group of groups) {
      const count = claimCount(group.count, probability, rng);
      for (let i = 0; i < count; i += 1) {
        total += Math.min(
          group.capUsd,
          sampleSeverity(params.assumptions.severityModel, params.severityMultiplier, rng),
        );
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
    averageClaimsUsd: roundUsd(average),
    p95ClaimsUsd: roundUsd(p95),
    p99ClaimsUsd: roundUsd(p99),
    p995ClaimsUsd: roundUsd(p995),
    reserveBreachProbability: Number(breachProbability.toFixed(6)),
  };
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

function buildOutput() {
  const assumptions = readJson<Assumptions>(ASSUMPTIONS_PATH);
  const quoteTables = buildQuoteTables(assumptions);
  const endToEndPoc = buildEndToEndPoc(assumptions);
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
    endToEndPoc,
    methodLimitations: assumptions.methodLimitations,
  };
}

const output = buildOutput();
writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(MEMO_PATH, buildMemo(output, readJson<Assumptions>(ASSUMPTIONS_PATH)));
console.log("Generated examples/nomad-protect-curve-poc/review-output.json");
console.log("Generated examples/nomad-protect-curve-poc/review-memo.md");
