// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_PLAN_ID,
  GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
  GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_POOL_ID,
  GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_SKUS,
  GENESIS_PROTECT_ACUTE_SPONSOR_LABEL,
  type GenesisProtectAcuteSkuDefinition,
  type GenesisProtectAcuteSkuKey,
} from "@/lib/genesis-protect-acute";
import { defaultPayoutMintForIntent } from "@/lib/plan-launch";
import {
  CAPITAL_CLASS_RESTRICTION_OPEN,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  REDEMPTION_POLICY_QUEUE_ONLY,
  SERIES_MODE_PROTECTION,
  SERIES_STATUS_ACTIVE,
  COMMITMENT_CAMPAIGN_STATUS_ACTIVE,
  COMMITMENT_MODE_DIRECT_PREMIUM,
  COMMITMENT_MODE_TREASURY_CREDIT,
  COMMITMENT_MODE_WATERFALL_RESERVE,
  COMMITMENT_POSITION_PENDING,
  COMMITMENT_POSITION_TREASURY_LOCKED,
  COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED,
  ZERO_PUBKEY,
  bpsRatio,
  deriveAllocationPositionPda,
  deriveCapitalClassPda,
  deriveFundingLinePda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  derivePolicySeriesPda,
  hasObligationImpairment,
  recomputeReserveBalanceSheet,
  toBigIntAmount,
  type AllocationPositionSnapshot,
  type CapitalClassSnapshot,
  type CommitmentCampaignSnapshot,
  type CommitmentLedgerSnapshot,
  type CommitmentPaymentRailSnapshot,
  type CommitmentPositionSnapshot,
  type FundingLineSnapshot,
  type HealthPlanSnapshot,
  type LiquidityPoolSnapshot,
  type PolicySeriesSnapshot,
  type ProtocolConsoleSnapshot,
  type ProtocolReadiness,
} from "@/lib/protocol";

export const GENESIS_PROTECT_ACUTE_TEMPLATE_KEY = "genesis-protect-acute";
export const GENESIS_PROTECT_ACUTE_PRIMARY_SKU = GENESIS_PROTECT_ACUTE_SKUS.travel30;
export const GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU = GENESIS_PROTECT_ACUTE_SKUS.event7;
export const GENESIS_PROTECT_ACUTE_CLASS_MIN_LOCKUP_SECONDS = 2_592_000n;
export const GENESIS_PROTECT_ACUTE_FOUNDER_COMMITMENT_CAMPAIGN_ID = "founder-travel30";

export type GenesisProtectAcuteBootstrapFundingLine = {
  key: string;
  displayName: string;
  lineId: string;
  lineType: number;
  fundingPriority: number;
  policySeriesId: string;
  skuKey: GenesisProtectAcuteSkuKey;
};

export type GenesisProtectAcuteBootstrapCapitalClass = {
  classId: string;
  displayName: string;
  priority: number;
  impairmentRank: number;
  queueOnlyRedemptions: boolean;
  restrictionMode: number;
  minLockupSeconds: bigint;
};

export type GenesisProtectAcuteBootstrapAllocation = {
  key: string;
  classId: string;
  fundingLineId: string;
  policySeriesId: string;
  capAmount: bigint;
  weightBps: number;
};

export type GenesisProtectAcuteArtifactAddresses = {
  healthPlanAddress: string;
  poolAddress: string;
  seriesAddresses: Record<GenesisProtectAcuteSkuKey, string>;
  fundingLineAddresses: Record<string, string>;
  classAddresses: {
    senior: string;
    junior: string;
  };
  allocationAddresses: Record<string, string>;
};

export type GenesisProtectAcuteWizardDefaults = {
  templateKey: typeof GENESIS_PROTECT_ACUTE_TEMPLATE_KEY;
  planId: string;
  displayName: string;
  organizationRef: string;
  metadataUri: string;
  payoutMint: string;
};

export type GenesisProtectAcutePostureState = "healthy" | "caution" | "paused";
export type GenesisProtectAcuteReadinessPhase =
  | "not_created"
  | "shell_incomplete"
  | "reserve_pending"
  | "operator_pending"
  | "issuance_ready"
  | "paused";

export type GenesisProtectAcuteReadinessPhaseCopy = {
  label: string;
  title: string;
  detail: string;
};

export type GenesisProtectAcuteSkuPosture = {
  skuKey: GenesisProtectAcuteSkuKey;
  displayName: string;
  isPrimaryLaunchSku: boolean;
  coverWindowDays: number;
  reimbursementMode: string;
  publicStatusRule: string;
  issueWhen: string[];
  pauseWhen: string[];
  claimsPayingCapital: bigint;
  reservedAmount: bigint;
  pendingPayoutAmount: bigint;
  impairedAmount: bigint;
};

export type GenesisProtectAcuteSetupChecklistState = {
  planShellReady: boolean;
  event7SeriesReady: boolean;
  travel30SeriesReady: boolean;
  fundingLinesReady: boolean;
  poolReady: boolean;
  capitalClassesReady: boolean;
  allocationsReady: boolean;
  reserveTargetReviewReady: boolean;
  planAuthoritiesReady: boolean;
  poolTermsReady: boolean;
  poolOraclePolicyReady: boolean;
};

export type GenesisProtectAcuteCommitmentCampaignRow = {
  address: string;
  campaignId: string;
  displayName: string;
  mode: number;
  status: number;
  paymentAssetMint: string;
  coverageAssetMint: string;
  paymentRailCount: number;
  paymentAssetMints: string[];
  waterfallRailCount: number;
  pendingAmount: bigint;
  activatedAmount: bigint;
  treasuryLockedAmount: bigint;
  refundedAmount: bigint;
  pendingPositions: number;
};

export type GenesisProtectAcuteCommitmentPosture = {
  campaignCount: number;
  activeCampaignCount: number;
  paymentRailCount: number;
  waterfallRailCount: number;
  positionCount: number;
  pendingPositionCount: number;
  pendingCustodyAmount: bigint;
  pendingCoverageAmount: bigint;
  directPremiumActivatedAmount: bigint;
  treasuryInventoryAmount: bigint;
  refundedAmount: bigint;
  claimsPayingReserveImpact: bigint;
  rows: GenesisProtectAcuteCommitmentCampaignRow[];
  warnings: string[];
};

export type GenesisProtectAcuteSetupModel = {
  plan: HealthPlanSnapshot | null;
  pool: LiquidityPoolSnapshot | null;
  seriesBySku: Record<GenesisProtectAcuteSkuKey, PolicySeriesSnapshot | null>;
  fundingLinesById: Record<string, FundingLineSnapshot | null>;
  classes: {
    senior: CapitalClassSnapshot | null;
    junior: CapitalClassSnapshot | null;
  };
  allocationsByKey: Record<string, AllocationPositionSnapshot | null>;
  checklist: GenesisProtectAcuteSetupChecklistState;
  checklistCompleted: number;
  checklistTotal: number;
  perSkuPosture: GenesisProtectAcuteSkuPosture[];
  posture: {
    state: GenesisProtectAcutePostureState;
    reasons: string[];
  };
  readinessPhase: GenesisProtectAcuteReadinessPhase;
  readinessPhaseCopy: GenesisProtectAcuteReadinessPhaseCopy;
  founderCommitments: GenesisProtectAcuteCommitmentPosture;
  claimCount: number;
  reservedAmount: bigint;
  pendingPayoutAmount: bigint;
  claimsPayingCapital: bigint;
  reserveUtilizationBps: bigint | null;
  queueOnlyRedemptionsActive: boolean;
  impairmentActive: boolean;
  missingArtifacts: string[];
};

type GenesisProtectAcuteSetupModelInput = {
  snapshot: ProtocolConsoleSnapshot;
  readiness?: Pick<ProtocolReadiness, "poolTermsConfigured" | "poolOraclePolicyConfigured"> | null;
};

const GENESIS_BOOTSTRAP_FUNDING_LINES: readonly GenesisProtectAcuteBootstrapFundingLine[] = [
  {
    key: "event7-sponsor",
    displayName: "Genesis Event 7 sponsor backstop",
    lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.sponsor!,
    lineType: FUNDING_LINE_TYPE_SPONSOR_BUDGET,
    fundingPriority: 0,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId,
    skuKey: "event7",
  },
  {
    key: "event7-premium",
    displayName: "Genesis Event 7 member premiums",
    lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.premium,
    lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
    fundingPriority: 1,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId,
    skuKey: "event7",
  },
  {
    key: "event7-liquidity",
    displayName: "Genesis Event 7 LP reserve lane",
    lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.liquidity,
    lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
    fundingPriority: 2,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId,
    skuKey: "event7",
  },
  {
    key: "travel30-premium",
    displayName: "Genesis Travel 30 member premiums",
    lineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium,
    lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
    fundingPriority: 3,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
    skuKey: "travel30",
  },
  {
    key: "travel30-liquidity",
    displayName: "Genesis Travel 30 LP reserve lane",
    lineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity,
    lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
    fundingPriority: 4,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
    skuKey: "travel30",
  },
] as const;

const GENESIS_BOOTSTRAP_CAPITAL_CLASSES: readonly GenesisProtectAcuteBootstrapCapitalClass[] = [
  {
    classId: GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
    displayName: GENESIS_PROTECT_ACUTE_SENIOR_CLASS_DISPLAY_NAME,
    priority: 0,
    impairmentRank: 0,
    queueOnlyRedemptions: true,
    restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
    minLockupSeconds: GENESIS_PROTECT_ACUTE_CLASS_MIN_LOCKUP_SECONDS,
  },
  {
    classId: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
    displayName: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_DISPLAY_NAME,
    priority: 1,
    impairmentRank: 1,
    queueOnlyRedemptions: true,
    restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
    minLockupSeconds: GENESIS_PROTECT_ACUTE_CLASS_MIN_LOCKUP_SECONDS,
  },
] as const;

const GENESIS_BOOTSTRAP_ALLOCATIONS: readonly GenesisProtectAcuteBootstrapAllocation[] = [
  {
    key: "event7-junior",
    classId: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
    fundingLineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.liquidity,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId,
    capAmount: 15_000n,
    weightBps: 2_175,
  },
  {
    key: "travel30-senior",
    classId: GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
    fundingLineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
    capAmount: 27_500n,
    weightBps: 4_350,
  },
  {
    key: "travel30-junior",
    classId: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
    fundingLineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity,
    policySeriesId: GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
    capAmount: 22_500n,
    weightBps: 3_475,
  },
] as const;

const GENESIS_SHELL_CHECKLIST_KEYS = [
  "planShellReady",
  "event7SeriesReady",
  "travel30SeriesReady",
  "fundingLinesReady",
  "poolReady",
  "capitalClassesReady",
  "allocationsReady",
] as const satisfies readonly (keyof GenesisProtectAcuteSetupChecklistState)[];

const GENESIS_READINESS_PHASE_COPY: Record<GenesisProtectAcuteReadinessPhase, GenesisProtectAcuteReadinessPhaseCopy> = {
  not_created: {
    label: "Not created",
    title: "Genesis shell is not created yet",
    detail: "Create the canonical Genesis Protect Acute shell before calling any launch path live.",
  },
  shell_incomplete: {
    label: "Shell incomplete",
    title: "Canonical launch objects are still missing",
    detail: "Coverage products, reserve lanes, capital sleeves, and allocation positions need to match the Genesis template.",
  },
  reserve_pending: {
    label: "Reserve pending",
    title: "Reserve posture needs operator review",
    detail: "Claims-paying capital, queue-only sleeves, pending payout exposure, and impairment flags must be cleared before issuance.",
  },
  operator_pending: {
    label: "Operator pending",
    title: "Operator sign-off is still incomplete",
    detail: "Sponsor, claims, oracle, pool terms, and oracle-policy controls must be configured before public issuance.",
  },
  issuance_ready: {
    label: "Issuance ready",
    title: "Genesis is ready for bounded issuance",
    detail: "The canonical shell, reserve posture, and operator controls are aligned for the Genesis readiness story.",
  },
  paused: {
    label: "Paused",
    title: "Genesis launch controls are paused",
    detail: "A plan or reserve-pool pause flag is active, so issuance should stay blocked until operators clear it.",
  },
};

export function describeGenesisProtectAcuteReadinessPhase(
  phase: GenesisProtectAcuteReadinessPhase,
): GenesisProtectAcuteReadinessPhaseCopy {
  return GENESIS_READINESS_PHASE_COPY[phase];
}

function deriveGenesisProtectAcuteReadinessPhase(params: {
  plan: HealthPlanSnapshot | null;
  checklist: GenesisProtectAcuteSetupChecklistState;
  claimsPayingCapital: bigint;
  pendingPayoutAmount: bigint;
  queueOnlyRedemptionsActive: boolean;
  impairmentActive: boolean;
  pauseBlocked: boolean;
}): GenesisProtectAcuteReadinessPhase {
  if (!params.plan) return "not_created";
  if (params.pauseBlocked) return "paused";
  if (GENESIS_SHELL_CHECKLIST_KEYS.some((key) => !params.checklist[key])) return "shell_incomplete";
  if (
    params.claimsPayingCapital <= 0n
    || params.pendingPayoutAmount > 0n
    || params.queueOnlyRedemptionsActive
    || params.impairmentActive
  ) {
    return "reserve_pending";
  }
  if (
    !params.checklist.reserveTargetReviewReady
    || !params.checklist.planAuthoritiesReady
    || !params.checklist.poolTermsReady
    || !params.checklist.poolOraclePolicyReady
  ) {
    return "operator_pending";
  }
  return "issuance_ready";
}

function describeReimbursementMode(definition: GenesisProtectAcuteSkuDefinition): string {
  return definition.benefitStyle === "hybrid_fixed_plus_reimbursement"
    ? "Fixed benefit + reimbursement top-up"
    : "Fixed benefit only";
}

function hasConfiguredAuthority(value?: string | null): boolean {
  const normalized = (value ?? "").trim();
  return Boolean(normalized) && normalized !== ZERO_PUBKEY;
}

function sumFundingLineAmounts(
  fundingLines: FundingLineSnapshot[],
  lineIds: Set<string>,
): {
  claimsPayingCapital: bigint;
  reservedAmount: bigint;
  pendingPayoutAmount: bigint;
  impairedAmount: bigint;
} {
  let claimsPayingCapital = 0n;
  let reservedAmount = 0n;
  let pendingPayoutAmount = 0n;
  let impairedAmount = 0n;

  for (const line of fundingLines) {
    if (!lineIds.has(line.lineId)) continue;
    const sheet = recomputeReserveBalanceSheet(line.sheet);
    claimsPayingCapital += sheet.funded;
    reservedAmount += sheet.reserved;
    pendingPayoutAmount += sheet.claimable + sheet.payable;
    impairedAmount += sheet.impaired;
  }

  return {
    claimsPayingCapital,
    reservedAmount,
    pendingPayoutAmount,
    impairedAmount,
  };
}

function commitmentCampaignMatchesFounderTravel30(params: {
  campaign: CommitmentCampaignSnapshot;
  plan: HealthPlanSnapshot | null;
  travel30Series: PolicySeriesSnapshot | null;
  travel30PremiumLine: FundingLineSnapshot | null;
}): boolean {
  if (!params.plan || params.campaign.healthPlan !== params.plan.address) return false;
  return (
    params.campaign.campaignId === GENESIS_PROTECT_ACUTE_FOUNDER_COMMITMENT_CAMPAIGN_ID
    || params.campaign.policySeries === params.travel30Series?.address
    || params.campaign.coverageFundingLine === params.travel30PremiumLine?.address
  );
}

function buildGenesisProtectAcuteCommitmentPosture(params: {
  plan: HealthPlanSnapshot | null;
  travel30Series: PolicySeriesSnapshot | null;
  travel30PremiumLine: FundingLineSnapshot | null;
  campaigns: CommitmentCampaignSnapshot[];
  paymentRails: CommitmentPaymentRailSnapshot[];
  ledgers: CommitmentLedgerSnapshot[];
  positions: CommitmentPositionSnapshot[];
}): GenesisProtectAcuteCommitmentPosture {
  const campaigns = params.campaigns.filter((campaign) =>
    commitmentCampaignMatchesFounderTravel30({
      campaign,
      plan: params.plan,
      travel30Series: params.travel30Series,
      travel30PremiumLine: params.travel30PremiumLine,
    }),
  );
  const campaignAddresses = new Set(campaigns.map((campaign) => campaign.address));
  const paymentRails = params.paymentRails.filter((rail) => campaignAddresses.has(rail.campaign));
  const ledgers = params.ledgers.filter((ledger) => campaignAddresses.has(ledger.campaign));
  const positions = params.positions.filter((position) => campaignAddresses.has(position.campaign));
  const railsByCampaign = new Map<string, CommitmentPaymentRailSnapshot[]>();
  for (const rail of paymentRails) {
    const current = railsByCampaign.get(rail.campaign) ?? [];
    current.push(rail);
    railsByCampaign.set(rail.campaign, current);
  }
  const positionsByCampaign = new Map<string, CommitmentPositionSnapshot[]>();
  for (const position of positions) {
    const current = positionsByCampaign.get(position.campaign) ?? [];
    current.push(position);
    positionsByCampaign.set(position.campaign, current);
  }
  const ledgersByCampaign = new Map<string, CommitmentLedgerSnapshot[]>();
  for (const ledger of ledgers) {
    const current = ledgersByCampaign.get(ledger.campaign) ?? [];
    current.push(ledger);
    ledgersByCampaign.set(ledger.campaign, current);
  }

  const rows = campaigns.map((campaign) => {
    const campaignRails = railsByCampaign.get(campaign.address) ?? [];
    const campaignLedgers = ledgersByCampaign.get(campaign.address) ?? [];
    const campaignPositions = positionsByCampaign.get(campaign.address) ?? [];
    const paymentAssetMints = Array.from(new Set([
      campaign.paymentAssetMint,
      ...campaignRails.map((rail) => rail.paymentAssetMint),
    ])).sort();
    const waterfallRailCount = campaignRails.filter((rail) => rail.mode === COMMITMENT_MODE_WATERFALL_RESERVE).length
      + (campaign.mode === COMMITMENT_MODE_WATERFALL_RESERVE && !campaignRails.some((rail) => rail.paymentAssetMint === campaign.paymentAssetMint) ? 1 : 0);
    return {
      address: campaign.address,
      campaignId: campaign.campaignId,
      displayName: campaign.displayName || campaign.campaignId,
      mode: campaign.mode,
      status: campaign.status,
      paymentAssetMint: campaign.paymentAssetMint,
      coverageAssetMint: campaign.coverageAssetMint,
      paymentRailCount: paymentAssetMints.length,
      paymentAssetMints,
      waterfallRailCount,
      pendingAmount: campaignLedgers.reduce((sum, ledger) => sum + toBigIntAmount(ledger.pendingAmount), 0n),
      activatedAmount: campaignLedgers.reduce((sum, ledger) => sum + toBigIntAmount(ledger.activatedAmount), 0n),
      treasuryLockedAmount: campaignLedgers.reduce(
        (sum, ledger) => sum + toBigIntAmount(ledger.treasuryLockedAmount),
        0n,
      ),
      refundedAmount: campaignLedgers.reduce((sum, ledger) => sum + toBigIntAmount(ledger.refundedAmount), 0n),
      pendingPositions: campaignPositions.filter((position) => position.state === COMMITMENT_POSITION_PENDING).length,
    } satisfies GenesisProtectAcuteCommitmentCampaignRow;
  });

  const pendingPositions = positions.filter((position) => position.state === COMMITMENT_POSITION_PENDING);
  const directPremiumActivatedAmount = ledgers.reduce((sum, ledger) => sum + toBigIntAmount(ledger.activatedAmount), 0n);
  const treasuryInventoryAmount = ledgers.reduce((sum, ledger) => sum + toBigIntAmount(ledger.treasuryLockedAmount), 0n);
  const refundedAmount = ledgers.reduce((sum, ledger) => sum + toBigIntAmount(ledger.refundedAmount), 0n);
  const pendingCustodyAmount = ledgers.reduce((sum, ledger) => sum + toBigIntAmount(ledger.pendingAmount), 0n);
  const pendingCoverageAmount = pendingPositions.reduce(
    (sum, position) => sum + toBigIntAmount(position.coverageAmount),
    0n,
  );

  const warnings: string[] = [];
  if (pendingCustodyAmount > 0n || pendingPositions.length > 0) {
    warnings.push("Pending Founder commitments are custody-only and do not count as claims-paying reserve.");
  }
  if (
    campaigns.some((campaign) => campaign.mode === COMMITMENT_MODE_TREASURY_CREDIT)
    || paymentRails.some((rail) => rail.mode === COMMITMENT_MODE_TREASURY_CREDIT)
    || positions.some((position) => position.state === COMMITMENT_POSITION_TREASURY_LOCKED)
    || treasuryInventoryAmount > 0n
  ) {
    warnings.push("Legacy treasury-credit inventory stays PDA-held and does not become active coverage by itself.");
  }
  if (
    campaigns.some((campaign) => campaign.mode === COMMITMENT_MODE_WATERFALL_RESERVE)
    || paymentRails.some((rail) => rail.mode === COMMITMENT_MODE_WATERFALL_RESERVE)
    || positions.some((position) => position.state === COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED)
  ) {
    warnings.push("Waterfall reserve commitments activate only after rail pricing, freshness, haircut, and exposure controls pass; stable rails pay first and OMEGAX-style rails remain last.");
  }
  if (
    campaigns.some((campaign) => campaign.mode === COMMITMENT_MODE_DIRECT_PREMIUM)
    || paymentRails.some((rail) => rail.mode === COMMITMENT_MODE_DIRECT_PREMIUM)
  ) {
    warnings.push("Direct-premium commitments activate into reserve accounting only after the activation authority executes the campaign transition.");
  }

  return {
    campaignCount: campaigns.length,
    activeCampaignCount: campaigns.filter((campaign) => campaign.status === COMMITMENT_CAMPAIGN_STATUS_ACTIVE).length,
    paymentRailCount: paymentRails.length,
    waterfallRailCount: paymentRails.filter((rail) => rail.mode === COMMITMENT_MODE_WATERFALL_RESERVE).length,
    positionCount: positions.length,
    pendingPositionCount: pendingPositions.length,
    pendingCustodyAmount,
    pendingCoverageAmount,
    directPremiumActivatedAmount,
    treasuryInventoryAmount,
    refundedAmount,
    claimsPayingReserveImpact: 0n,
    rows,
    warnings,
  };
}

export function buildGenesisProtectAcuteWizardDefaults(_reserveDomainAddress = ""): GenesisProtectAcuteWizardDefaults {
  return {
    templateKey: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
    planId: GENESIS_PROTECT_ACUTE_PLAN_ID,
    displayName: GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME,
    organizationRef: GENESIS_PROTECT_ACUTE_SPONSOR_LABEL,
    metadataUri: GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
    payoutMint: defaultPayoutMintForIntent("insurance"),
  };
}

export function buildGenesisProtectAcuteArtifactAddresses(reserveDomainAddress: string): GenesisProtectAcuteArtifactAddresses {
  const healthPlanAddress = deriveHealthPlanPda({
    reserveDomain: reserveDomainAddress,
    planId: GENESIS_PROTECT_ACUTE_PLAN_ID,
  }).toBase58();
  const poolAddress = deriveLiquidityPoolPda({
    reserveDomain: reserveDomainAddress,
    poolId: GENESIS_PROTECT_ACUTE_POOL_ID,
  }).toBase58();
  const seriesAddresses = {
    event7: derivePolicySeriesPda({
      healthPlan: healthPlanAddress,
      seriesId: GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId,
    }).toBase58(),
    travel30: derivePolicySeriesPda({
      healthPlan: healthPlanAddress,
      seriesId: GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
    }).toBase58(),
  } satisfies Record<GenesisProtectAcuteSkuKey, string>;
  const fundingLineAddresses = Object.fromEntries(
    GENESIS_BOOTSTRAP_FUNDING_LINES.map((line) => [
      line.lineId,
      deriveFundingLinePda({
        healthPlan: healthPlanAddress,
        lineId: line.lineId,
      }).toBase58(),
    ]),
  ) as Record<string, string>;
  const classAddresses = {
    senior: deriveCapitalClassPda({
      liquidityPool: poolAddress,
      classId: GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
    }).toBase58(),
    junior: deriveCapitalClassPda({
      liquidityPool: poolAddress,
      classId: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
    }).toBase58(),
  };
  const allocationAddresses = Object.fromEntries(
    GENESIS_BOOTSTRAP_ALLOCATIONS.map((allocation) => [
      allocation.key,
      deriveAllocationPositionPda({
        capitalClass: allocation.classId === GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID
          ? classAddresses.senior
          : classAddresses.junior,
        fundingLine: fundingLineAddresses[allocation.fundingLineId]!,
      }).toBase58(),
    ]),
  ) as Record<string, string>;

  return {
    healthPlanAddress,
    poolAddress,
    seriesAddresses,
    fundingLineAddresses,
    classAddresses,
    allocationAddresses,
  };
}

export function genesisProtectAcuteBootstrapFundingLines(): readonly GenesisProtectAcuteBootstrapFundingLine[] {
  return GENESIS_BOOTSTRAP_FUNDING_LINES;
}

export function genesisProtectAcuteBootstrapCapitalClasses(): readonly GenesisProtectAcuteBootstrapCapitalClass[] {
  return GENESIS_BOOTSTRAP_CAPITAL_CLASSES;
}

export function genesisProtectAcuteBootstrapAllocations(): readonly GenesisProtectAcuteBootstrapAllocation[] {
  return GENESIS_BOOTSTRAP_ALLOCATIONS;
}

export function isGenesisProtectAcutePlan(plan?: Pick<HealthPlanSnapshot, "planId"> | null): boolean {
  return plan?.planId === GENESIS_PROTECT_ACUTE_PLAN_ID;
}

export function buildGenesisProtectAcuteSetupModel(
  input: GenesisProtectAcuteSetupModelInput,
): GenesisProtectAcuteSetupModel {
  const plan = input.snapshot.healthPlans.find((entry) => entry.planId === GENESIS_PROTECT_ACUTE_PLAN_ID) ?? null;
  const pool = input.snapshot.liquidityPools.find((entry) => entry.poolId === GENESIS_PROTECT_ACUTE_POOL_ID) ?? null;
  const seriesBySku = {
    event7: input.snapshot.policySeries.find((entry) => entry.seriesId === GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId) ?? null,
    travel30: input.snapshot.policySeries.find((entry) => entry.seriesId === GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId) ?? null,
  } satisfies Record<GenesisProtectAcuteSkuKey, PolicySeriesSnapshot | null>;
  const fundingLinesById = Object.fromEntries(
    GENESIS_BOOTSTRAP_FUNDING_LINES.map((line) => [
      line.lineId,
      input.snapshot.fundingLines.find((entry) => entry.lineId === line.lineId) ?? null,
    ]),
  ) as Record<string, FundingLineSnapshot | null>;
  const classes = {
    senior: pool
      ? input.snapshot.capitalClasses.find(
        (entry) => entry.liquidityPool === pool.address && entry.classId === GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
      ) ?? null
      : null,
    junior: pool
      ? input.snapshot.capitalClasses.find(
        (entry) => entry.liquidityPool === pool.address && entry.classId === GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
      ) ?? null
      : null,
  };
  const allocationsByKey = Object.fromEntries(
    GENESIS_BOOTSTRAP_ALLOCATIONS.map((allocation) => [
      allocation.key,
      null,
    ]),
  ) as Record<string, AllocationPositionSnapshot | null>;

  for (const allocation of GENESIS_BOOTSTRAP_ALLOCATIONS) {
    allocationsByKey[allocation.key] = input.snapshot.allocationPositions.find((entry) =>
      entry.healthPlan === plan?.address
      && entry.policySeries === seriesBySku[allocation.policySeriesId === GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId ? "event7" : "travel30"]?.address
      && entry.fundingLine === fundingLinesById[allocation.fundingLineId]?.address
      && entry.capitalClass === (
        allocation.classId === GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID
          ? classes.senior?.address
          : classes.junior?.address
      ),
    ) ?? null;
  }

  const event7SeriesReady = Boolean(
    seriesBySku.event7
    && seriesBySku.event7.healthPlan === plan?.address
    && seriesBySku.event7.metadataUri === GENESIS_PROTECT_ACUTE_SKUS.event7.metadataUri
    && seriesBySku.event7.mode === SERIES_MODE_PROTECTION
    && seriesBySku.event7.status === SERIES_STATUS_ACTIVE,
  );
  const travel30SeriesReady = Boolean(
    seriesBySku.travel30
    && seriesBySku.travel30.healthPlan === plan?.address
    && seriesBySku.travel30.metadataUri === GENESIS_PROTECT_ACUTE_SKUS.travel30.metadataUri
    && seriesBySku.travel30.mode === SERIES_MODE_PROTECTION
    && seriesBySku.travel30.status === SERIES_STATUS_ACTIVE,
  );
  const fundingLinesReady = GENESIS_BOOTSTRAP_FUNDING_LINES.every((line) => {
    const fundingLine = fundingLinesById[line.lineId];
    const expectedSeriesAddress = line.skuKey === "event7" ? seriesBySku.event7?.address : seriesBySku.travel30?.address;
    return Boolean(
      fundingLine
      && fundingLine.healthPlan === plan?.address
      && fundingLine.policySeries === expectedSeriesAddress
      && fundingLine.lineType === line.lineType
      && fundingLine.fundingPriority === line.fundingPriority,
    );
  });
  const capitalClassesReady = Boolean(
    classes.senior
    && classes.junior
    && classes.senior.active
    && classes.junior.active,
  );
  const allocationsReady = GENESIS_BOOTSTRAP_ALLOCATIONS.every((allocation) => Boolean(allocationsByKey[allocation.key]));
  const planAuthoritiesReady = Boolean(
    hasConfiguredAuthority(plan?.sponsorOperator)
    && hasConfiguredAuthority(plan?.claimsOperator)
    && hasConfiguredAuthority(plan?.oracleAuthority),
  );
  const founderCommitments = buildGenesisProtectAcuteCommitmentPosture({
    plan,
    travel30Series: seriesBySku.travel30,
    travel30PremiumLine: fundingLinesById[GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium],
    campaigns: input.snapshot.commitmentCampaigns ?? [],
    paymentRails: input.snapshot.commitmentPaymentRails ?? [],
    ledgers: input.snapshot.commitmentLedgers ?? [],
    positions: input.snapshot.commitmentPositions ?? [],
  });

  const perSkuPosture = ([
    GENESIS_PROTECT_ACUTE_SKUS.event7,
    GENESIS_PROTECT_ACUTE_SKUS.travel30,
  ] as const).map((definition) => {
    const lineIds = new Set(
      Object.values(definition.fundingLineIds).filter((value): value is string => Boolean(value)),
    );
    const amounts = sumFundingLineAmounts(input.snapshot.fundingLines, lineIds);
    return {
      skuKey: definition.key,
      displayName: definition.displayName,
      isPrimaryLaunchSku: definition.key === GENESIS_PROTECT_ACUTE_PRIMARY_SKU.key,
      coverWindowDays: definition.coverWindowDays,
      reimbursementMode: describeReimbursementMode(definition),
      publicStatusRule: definition.issuanceControls.publicStatusRule,
      issueWhen: definition.issuanceControls.issueWhen,
      pauseWhen: definition.issuanceControls.pauseWhen,
      claimsPayingCapital: amounts.claimsPayingCapital,
      reservedAmount: amounts.reservedAmount,
      pendingPayoutAmount: amounts.pendingPayoutAmount,
      impairedAmount: amounts.impairedAmount,
    } satisfies GenesisProtectAcuteSkuPosture;
  });

  const relevantFundingLines = GENESIS_BOOTSTRAP_FUNDING_LINES
    .map((line) => fundingLinesById[line.lineId])
    .filter((line): line is FundingLineSnapshot => Boolean(line));
  const reservedAmount = relevantFundingLines.reduce(
    (sum, line) => sum + recomputeReserveBalanceSheet(line.sheet).reserved,
    0n,
  );
  const claimsPayingCapital = perSkuPosture.reduce((sum, sku) => sum + sku.claimsPayingCapital, 0n);
  const pendingPayoutAmount = relevantFundingLines.reduce(
    (sum, line) => {
      const sheet = recomputeReserveBalanceSheet(line.sheet);
      return sum + sheet.claimable + sheet.payable;
    },
    0n,
  );
  const claimCount = input.snapshot.claimCases.filter((claim) => claim.healthPlan === plan?.address).length;
  const queueOnlyRedemptionsActive = Boolean(
    pool?.redemptionPolicy === REDEMPTION_POLICY_QUEUE_ONLY
    || classes.senior?.queueOnlyRedemptions
    || classes.junior?.queueOnlyRedemptions,
  );
  const impairmentActive = relevantFundingLines.some((line) => recomputeReserveBalanceSheet(line.sheet).impaired > 0n)
    || input.snapshot.obligations.some((obligation) =>
      obligation.healthPlan === plan?.address && hasObligationImpairment(obligation),
    );
  const pauseBlocked = Boolean(
    (plan?.pauseFlags ?? 0) > 0
    || (pool?.pauseFlags ?? 0) > 0
    || plan?.active === false
    || pool?.active === false,
  );
  const checklist = {
    planShellReady: Boolean(
      plan
      && plan.displayName === GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME
      && plan.sponsorLabel === GENESIS_PROTECT_ACUTE_SPONSOR_LABEL,
    ),
    event7SeriesReady,
    travel30SeriesReady,
    fundingLinesReady,
    poolReady: Boolean(
      pool
      && pool.displayName === GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME
      && pool.strategyThesis === GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS,
    ),
    capitalClassesReady,
    allocationsReady,
    reserveTargetReviewReady: Boolean(input.readiness?.poolTermsConfigured) && claimsPayingCapital > 0n,
    planAuthoritiesReady,
    poolTermsReady: Boolean(input.readiness?.poolTermsConfigured),
    poolOraclePolicyReady: Boolean(input.readiness?.poolOraclePolicyConfigured),
  } satisfies GenesisProtectAcuteSetupChecklistState;
  const checklistCompleted = Object.values(checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(checklist).length;
  const missingArtifacts: string[] = [];
  if (!checklist.planShellReady) missingArtifacts.push("plan_shell");
  if (!checklist.event7SeriesReady) missingArtifacts.push("event7_series");
  if (!checklist.travel30SeriesReady) missingArtifacts.push("travel30_series");
  if (!checklist.fundingLinesReady) missingArtifacts.push("funding_lines");
  if (!checklist.poolReady) missingArtifacts.push("pool_shell");
  if (!checklist.capitalClassesReady) missingArtifacts.push("capital_classes");
  if (!checklist.allocationsReady) missingArtifacts.push("allocation_positions");

  const postureReasons: string[] = [];
  if (pauseBlocked) postureReasons.push("Pause flags or inactive launch controls are blocking issuance.");
  if (claimsPayingCapital <= 0n) postureReasons.push("No claims-paying capital has been posted yet.");
  if (checklistCompleted < checklistTotal) postureReasons.push("Genesis setup is still missing required launch items.");
  if (pendingPayoutAmount > 0n) postureReasons.push("Pending payout exposure is live on the reserve lanes.");
  if (impairmentActive) postureReasons.push("Impairment is active on at least one linked liability lane.");
  if (queueOnlyRedemptionsActive) postureReasons.push("At least one linked capital sleeve is still queue-only for redemptions.");

  let postureState: GenesisProtectAcutePostureState = "healthy";
  if (pauseBlocked) {
    postureState = "paused";
  } else if (
    claimsPayingCapital <= 0n
    || checklistCompleted < checklistTotal
    || pendingPayoutAmount > 0n
    || impairmentActive
      || queueOnlyRedemptionsActive
  ) {
    postureState = "caution";
  }
  const readinessPhase = deriveGenesisProtectAcuteReadinessPhase({
    plan,
    checklist,
    claimsPayingCapital,
    pendingPayoutAmount,
    queueOnlyRedemptionsActive,
    impairmentActive,
    pauseBlocked,
  });

  return {
    plan,
    pool,
    seriesBySku,
    fundingLinesById,
    classes,
    allocationsByKey,
    checklist,
    checklistCompleted,
    checklistTotal,
    perSkuPosture,
    posture: {
      state: postureState,
      reasons: postureReasons,
    },
    readinessPhase,
    readinessPhaseCopy: describeGenesisProtectAcuteReadinessPhase(readinessPhase),
    founderCommitments,
    claimCount,
    reservedAmount,
    pendingPayoutAmount,
    claimsPayingCapital,
    reserveUtilizationBps: bpsRatio(reservedAmount + pendingPayoutAmount, claimsPayingCapital),
    queueOnlyRedemptionsActive,
    impairmentActive,
    missingArtifacts,
  };
}
