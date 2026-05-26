// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU,
  NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_DISPLAY_NAME,
  NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_DISPLAY_NAME,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_METADATA_URI,
  NETWORK_SCHOOL_ACUTE_ASSIST_POOL_DISPLAY_NAME,
  NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_POOL_STRATEGY_THESIS,
  NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_DISPLAY_NAME,
  NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID,
  NETWORK_SCHOOL_ACUTE_ASSIST_SKUS,
  NETWORK_SCHOOL_ACUTE_ASSIST_SPONSOR_LABEL,
  type NetworkSchoolAcuteAssistSkuKey,
} from "@/lib/network-school-acute-assist";
import { defaultPayoutMintForIntent } from "@/lib/plan-launch";
import {
  CAPITAL_CLASS_RESTRICTION_OPEN,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  REDEMPTION_POLICY_QUEUE_ONLY,
  SERIES_MODE_PROTECTION,
  SERIES_STATUS_ACTIVE,
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
  type AllocationPositionSnapshot,
  type CapitalClassSnapshot,
  type FundingLineSnapshot,
  type HealthPlanSnapshot,
  type LiquidityPoolSnapshot,
  type PolicySeriesSnapshot,
  type ProtocolConsoleSnapshot,
  type ProtocolReadiness,
} from "@/lib/protocol";

export const NETWORK_SCHOOL_ACUTE_ASSIST_TEMPLATE_KEY = "network-school-acute-assist";
export const NETWORK_SCHOOL_ACUTE_ASSIST_CLASS_MIN_LOCKUP_SECONDS = 2_592_000n;

export type NetworkSchoolAcuteAssistBootstrapFundingLine = {
  key: string;
  displayName: string;
  lineId: string;
  lineType: number;
  fundingPriority: number;
  policySeriesId: string;
  skuKey: NetworkSchoolAcuteAssistSkuKey;
};

export type NetworkSchoolAcuteAssistBootstrapCapitalClass = {
  classId: string;
  displayName: string;
  priority: number;
  impairmentRank: number;
  queueOnlyRedemptions: boolean;
  restrictionMode: number;
  minLockupSeconds: bigint;
};

export type NetworkSchoolAcuteAssistBootstrapAllocation = {
  key: string;
  classId: string;
  fundingLineId: string;
  policySeriesId: string;
  skuKey: NetworkSchoolAcuteAssistSkuKey;
  capAmount: bigint;
  weightBps: number;
};

export type NetworkSchoolAcuteAssistArtifactAddresses = {
  healthPlanAddress: string;
  poolAddress: string;
  seriesAddresses: Record<NetworkSchoolAcuteAssistSkuKey, string>;
  fundingLineAddresses: Record<string, string>;
  classAddresses: {
    senior: string;
    junior: string;
  };
  allocationAddresses: Record<string, string>;
};

export type NetworkSchoolAcuteAssistWizardDefaults = {
  templateKey: typeof NETWORK_SCHOOL_ACUTE_ASSIST_TEMPLATE_KEY;
  planId: string;
  displayName: string;
  organizationRef: string;
  metadataUri: string;
  payoutMint: string;
  membershipMode: "invite_only";
  membershipGateKind: "invite_only";
};

export type NetworkSchoolAcuteAssistPostureState = "healthy" | "caution" | "paused";
export type NetworkSchoolAcuteAssistReadinessPhase =
  | "not_created"
  | "shell_incomplete"
  | "verifier_pending"
  | "reserve_pending"
  | "operator_pending"
  | "issuance_ready"
  | "paused";

export type NetworkSchoolAcuteAssistReadinessPhaseCopy = {
  label: string;
  title: string;
  detail: string;
};

export type NetworkSchoolAcuteAssistSetupChecklistState = {
  planShellReady: boolean;
  inviteGateReady: boolean;
  seriesReady: boolean;
  fundingLinesReady: boolean;
  sharedPoolReady: boolean;
  capitalClassesReady: boolean;
  allocationsReady: boolean;
  reserveTargetReviewReady: boolean;
  planAuthoritiesReady: boolean;
  discordVerifierConfigured: boolean;
  poolTermsReady: boolean;
  poolOraclePolicyReady: boolean;
};

export type NetworkSchoolAcuteAssistSkuPosture = {
  skuKey: NetworkSchoolAcuteAssistSkuKey;
  displayName: string;
  isDefaultSelection: boolean;
  coverWindowDays: number;
  retailUsd: number;
  supportLimitUsd: number;
  fastLaneUsd: number;
  publicStatusRule: string;
  issueWhen: string[];
  pauseWhen: string[];
  claimsPayingCapital: bigint;
  reservedAmount: bigint;
  pendingPayoutAmount: bigint;
  impairedAmount: bigint;
};

export type NetworkSchoolAcuteAssistSetupModel = {
  plan: HealthPlanSnapshot | null;
  pool: LiquidityPoolSnapshot | null;
  seriesBySku: Record<NetworkSchoolAcuteAssistSkuKey, PolicySeriesSnapshot | null>;
  fundingLinesById: Record<string, FundingLineSnapshot | null>;
  classes: {
    senior: CapitalClassSnapshot | null;
    junior: CapitalClassSnapshot | null;
  };
  allocationsByKey: Record<string, AllocationPositionSnapshot | null>;
  checklist: NetworkSchoolAcuteAssistSetupChecklistState;
  checklistCompleted: number;
  checklistTotal: number;
  perSkuPosture: NetworkSchoolAcuteAssistSkuPosture[];
  posture: {
    state: NetworkSchoolAcuteAssistPostureState;
    reasons: string[];
  };
  readinessPhase: NetworkSchoolAcuteAssistReadinessPhase;
  readinessPhaseCopy: NetworkSchoolAcuteAssistReadinessPhaseCopy;
  claimCount: number;
  reservedAmount: bigint;
  pendingPayoutAmount: bigint;
  claimsPayingCapital: bigint;
  reserveUtilizationBps: bigint | null;
  queueOnlyRedemptionsActive: boolean;
  impairmentActive: boolean;
  missingArtifacts: string[];
};

type NetworkSchoolAcuteAssistSetupModelInput = {
  snapshot: ProtocolConsoleSnapshot;
  readiness?: Pick<ProtocolReadiness, "poolTermsConfigured" | "poolOraclePolicyConfigured"> & {
    discordVerifierConfigured?: boolean;
  } | null;
};

const NETWORK_SCHOOL_BOOTSTRAP_FUNDING_LINES: readonly NetworkSchoolAcuteAssistBootstrapFundingLine[] = [
  {
    key: "lite-premium",
    displayName: "NS Lite 30 member premiums",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.fundingLineIds.premium,
    lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
    fundingPriority: 0,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.seriesId,
    skuKey: "lite",
  },
  {
    key: "lite-liquidity",
    displayName: "NS Lite 30 acute-pool reserve lane",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.fundingLineIds.liquidity,
    lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
    fundingPriority: 1,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.seriesId,
    skuKey: "lite",
  },
  {
    key: "core-premium",
    displayName: "NS Core 30 member premiums",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.fundingLineIds.premium,
    lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
    fundingPriority: 2,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.seriesId,
    skuKey: "core",
  },
  {
    key: "core-liquidity",
    displayName: "NS Core 30 acute-pool reserve lane",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.fundingLineIds.liquidity,
    lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
    fundingPriority: 3,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.seriesId,
    skuKey: "core",
  },
  {
    key: "plus-premium",
    displayName: "NS Plus 30 member premiums",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.fundingLineIds.premium,
    lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
    fundingPriority: 4,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.seriesId,
    skuKey: "plus",
  },
  {
    key: "plus-liquidity",
    displayName: "NS Plus 30 acute-pool reserve lane",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.fundingLineIds.liquidity,
    lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
    fundingPriority: 5,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.seriesId,
    skuKey: "plus",
  },
  {
    key: "family-core-premium",
    displayName: "NS Family Core 30 member premiums",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.fundingLineIds.premium,
    lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
    fundingPriority: 6,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.seriesId,
    skuKey: "familyCore",
  },
  {
    key: "family-core-liquidity",
    displayName: "NS Family Core 30 acute-pool reserve lane",
    lineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.fundingLineIds.liquidity,
    lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
    fundingPriority: 7,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.seriesId,
    skuKey: "familyCore",
  },
] as const;

const NETWORK_SCHOOL_BOOTSTRAP_CAPITAL_CLASSES: readonly NetworkSchoolAcuteAssistBootstrapCapitalClass[] = [
  {
    classId: NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID,
    displayName: NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_DISPLAY_NAME,
    priority: 0,
    impairmentRank: 0,
    queueOnlyRedemptions: true,
    restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
    minLockupSeconds: NETWORK_SCHOOL_ACUTE_ASSIST_CLASS_MIN_LOCKUP_SECONDS,
  },
  {
    classId: NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
    displayName: NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_DISPLAY_NAME,
    priority: 1,
    impairmentRank: 1,
    queueOnlyRedemptions: true,
    restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
    minLockupSeconds: NETWORK_SCHOOL_ACUTE_ASSIST_CLASS_MIN_LOCKUP_SECONDS,
  },
] as const;

const NETWORK_SCHOOL_BOOTSTRAP_ALLOCATIONS: readonly NetworkSchoolAcuteAssistBootstrapAllocation[] = [
  {
    key: "lite-junior",
    classId: NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
    fundingLineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.fundingLineIds.liquidity,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite.seriesId,
    skuKey: "lite",
    capAmount: 750n,
    weightBps: 1_250,
  },
  {
    key: "core-senior",
    classId: NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID,
    fundingLineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.fundingLineIds.liquidity,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core.seriesId,
    skuKey: "core",
    capAmount: 2_000n,
    weightBps: 3_334,
  },
  {
    key: "plus-junior",
    classId: NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
    fundingLineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.fundingLineIds.liquidity,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus.seriesId,
    skuKey: "plus",
    capAmount: 2_000n,
    weightBps: 3_333,
  },
  {
    key: "family-core-junior",
    classId: NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
    fundingLineId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.fundingLineIds.liquidity,
    policySeriesId: NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore.seriesId,
    skuKey: "familyCore",
    capAmount: 1_250n,
    weightBps: 2_083,
  },
] as const;

const NETWORK_SCHOOL_SHELL_CHECKLIST_KEYS = [
  "planShellReady",
  "inviteGateReady",
  "seriesReady",
  "fundingLinesReady",
  "sharedPoolReady",
  "capitalClassesReady",
  "allocationsReady",
] as const satisfies readonly (keyof NetworkSchoolAcuteAssistSetupChecklistState)[];

const NETWORK_SCHOOL_READINESS_PHASE_COPY: Record<
  NetworkSchoolAcuteAssistReadinessPhase,
  NetworkSchoolAcuteAssistReadinessPhaseCopy
> = {
  not_created: {
    label: "Not created",
    title: "Network School Acute Assist shell is not created yet",
    detail: "Create the invite-gated plan, four tier series, funding lines, and acute-pool allocations first.",
  },
  shell_incomplete: {
    label: "Shell incomplete",
    title: "Canonical NS Acute objects are still missing",
    detail: "The plan, tier series, funding lines, shared pool, classes, and allocation positions must match the template.",
  },
  verifier_pending: {
    label: "Verifier pending",
    title: "Network School verification is fail-closed",
    detail: "Discord or Network School membership verification is not configured, so issuance must stay unavailable.",
  },
  reserve_pending: {
    label: "Reserve pending",
    title: "Cohort 0 reserve posture needs operator review",
    detail: "Claims-paying capital, queue-only sleeves, pending payout exposure, and impairment flags must clear before issuance.",
  },
  operator_pending: {
    label: "Operator pending",
    title: "Operator sign-off is incomplete",
    detail: "Claims, oracle, pool terms, and pool oracle policy controls must be ready before member issuance.",
  },
  issuance_ready: {
    label: "Issuance ready",
    title: "NS Acute Assist is ready for bounded issuance",
    detail: "The shell, NS verification, reserve posture, and operator controls are aligned for the Cohort 0 pilot.",
  },
  paused: {
    label: "Paused",
    title: "NS Acute Assist controls are paused",
    detail: "A plan or shared-pool pause flag is active, so issuance should stay blocked until operators clear it.",
  },
};

export function describeNetworkSchoolAcuteAssistReadinessPhase(
  phase: NetworkSchoolAcuteAssistReadinessPhase,
): NetworkSchoolAcuteAssistReadinessPhaseCopy {
  return NETWORK_SCHOOL_READINESS_PHASE_COPY[phase];
}

function deriveNetworkSchoolAcuteAssistReadinessPhase(params: {
  plan: HealthPlanSnapshot | null;
  checklist: NetworkSchoolAcuteAssistSetupChecklistState;
  claimsPayingCapital: bigint;
  pendingPayoutAmount: bigint;
  queueOnlyRedemptionsActive: boolean;
  impairmentActive: boolean;
  pauseBlocked: boolean;
}): NetworkSchoolAcuteAssistReadinessPhase {
  if (!params.plan) return "not_created";
  if (params.pauseBlocked) return "paused";
  if (NETWORK_SCHOOL_SHELL_CHECKLIST_KEYS.some((key) => !params.checklist[key])) return "shell_incomplete";
  if (!params.checklist.discordVerifierConfigured) return "verifier_pending";
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

export function buildNetworkSchoolAcuteAssistWizardDefaults(
  _reserveDomainAddress = "",
): NetworkSchoolAcuteAssistWizardDefaults {
  return {
    templateKey: NETWORK_SCHOOL_ACUTE_ASSIST_TEMPLATE_KEY,
    planId: NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID,
    displayName: NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_DISPLAY_NAME,
    organizationRef: NETWORK_SCHOOL_ACUTE_ASSIST_SPONSOR_LABEL,
    metadataUri: NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_METADATA_URI,
    payoutMint: defaultPayoutMintForIntent("insurance"),
    membershipMode: "invite_only",
    membershipGateKind: "invite_only",
  };
}

export function buildNetworkSchoolAcuteAssistArtifactAddresses(
  reserveDomainAddress: string,
): NetworkSchoolAcuteAssistArtifactAddresses {
  const healthPlanAddress = deriveHealthPlanPda({
    reserveDomain: reserveDomainAddress,
    planId: NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID,
  }).toBase58();
  const poolAddress = deriveLiquidityPoolPda({
    reserveDomain: reserveDomainAddress,
    poolId: NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID,
  }).toBase58();
  const seriesAddresses = Object.fromEntries(
    Object.values(NETWORK_SCHOOL_ACUTE_ASSIST_SKUS).map((sku) => [
      sku.key,
      derivePolicySeriesPda({
        healthPlan: healthPlanAddress,
        seriesId: sku.seriesId,
      }).toBase58(),
    ]),
  ) as Record<NetworkSchoolAcuteAssistSkuKey, string>;
  const fundingLineAddresses = Object.fromEntries(
    NETWORK_SCHOOL_BOOTSTRAP_FUNDING_LINES.map((line) => [
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
      classId: NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID,
    }).toBase58(),
    junior: deriveCapitalClassPda({
      liquidityPool: poolAddress,
      classId: NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
    }).toBase58(),
  };
  const allocationAddresses = Object.fromEntries(
    NETWORK_SCHOOL_BOOTSTRAP_ALLOCATIONS.map((allocation) => [
      allocation.key,
      deriveAllocationPositionPda({
        capitalClass: allocation.classId === NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID
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

export function networkSchoolAcuteAssistBootstrapFundingLines(): readonly NetworkSchoolAcuteAssistBootstrapFundingLine[] {
  return NETWORK_SCHOOL_BOOTSTRAP_FUNDING_LINES;
}

export function networkSchoolAcuteAssistBootstrapCapitalClasses(): readonly NetworkSchoolAcuteAssistBootstrapCapitalClass[] {
  return NETWORK_SCHOOL_BOOTSTRAP_CAPITAL_CLASSES;
}

export function networkSchoolAcuteAssistBootstrapAllocations(): readonly NetworkSchoolAcuteAssistBootstrapAllocation[] {
  return NETWORK_SCHOOL_BOOTSTRAP_ALLOCATIONS;
}

export function isNetworkSchoolAcuteAssistPlan(plan?: Pick<HealthPlanSnapshot, "planId"> | null): boolean {
  return plan?.planId === NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID;
}

export function buildNetworkSchoolAcuteAssistSetupModel(
  input: NetworkSchoolAcuteAssistSetupModelInput,
): NetworkSchoolAcuteAssistSetupModel {
  const plan = input.snapshot.healthPlans.find((entry) => entry.planId === NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID) ?? null;
  const pool = input.snapshot.liquidityPools.find((entry) => entry.poolId === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID) ?? null;
  const seriesBySku = Object.fromEntries(
    Object.values(NETWORK_SCHOOL_ACUTE_ASSIST_SKUS).map((sku) => [
      sku.key,
      input.snapshot.policySeries.find((entry) => entry.seriesId === sku.seriesId && entry.healthPlan === plan?.address) ?? null,
    ]),
  ) as Record<NetworkSchoolAcuteAssistSkuKey, PolicySeriesSnapshot | null>;
  const fundingLinesById = Object.fromEntries(
    NETWORK_SCHOOL_BOOTSTRAP_FUNDING_LINES.map((line) => [
      line.lineId,
      input.snapshot.fundingLines.find((entry) => entry.lineId === line.lineId && entry.healthPlan === plan?.address) ?? null,
    ]),
  ) as Record<string, FundingLineSnapshot | null>;
  const classes = {
    senior: pool
      ? input.snapshot.capitalClasses.find(
        (entry) =>
          entry.liquidityPool === pool.address && entry.classId === NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID,
      ) ?? null
      : null,
    junior: pool
      ? input.snapshot.capitalClasses.find(
        (entry) =>
          entry.liquidityPool === pool.address && entry.classId === NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID,
      ) ?? null
      : null,
  };
  const allocationsByKey = Object.fromEntries(
    NETWORK_SCHOOL_BOOTSTRAP_ALLOCATIONS.map((allocation) => [allocation.key, null]),
  ) as Record<string, AllocationPositionSnapshot | null>;

  for (const allocation of NETWORK_SCHOOL_BOOTSTRAP_ALLOCATIONS) {
    allocationsByKey[allocation.key] = input.snapshot.allocationPositions.find((entry) =>
      entry.healthPlan === plan?.address
      && entry.policySeries === seriesBySku[allocation.skuKey]?.address
      && entry.fundingLine === fundingLinesById[allocation.fundingLineId]?.address
      && entry.capitalClass === (
        allocation.classId === NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID
          ? classes.senior?.address
          : classes.junior?.address
      ),
    ) ?? null;
  }

  const seriesReadyBySku = Object.fromEntries(
    Object.values(NETWORK_SCHOOL_ACUTE_ASSIST_SKUS).map((sku) => {
      const series = seriesBySku[sku.key];
      return [
        sku.key,
        Boolean(
          series
          && series.healthPlan === plan?.address
          && series.metadataUri === sku.metadataUri
          && series.mode === SERIES_MODE_PROTECTION
          && series.status === SERIES_STATUS_ACTIVE,
        ),
      ];
    }),
  ) as Record<NetworkSchoolAcuteAssistSkuKey, boolean>;
  const fundingLinesReady = NETWORK_SCHOOL_BOOTSTRAP_FUNDING_LINES.every((line) => {
    const fundingLine = fundingLinesById[line.lineId];
    const expectedSeriesAddress = seriesBySku[line.skuKey]?.address;
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
  const allocationsReady = NETWORK_SCHOOL_BOOTSTRAP_ALLOCATIONS.every((allocation) =>
    Boolean(allocationsByKey[allocation.key])
  );
  const inviteGateReady = Boolean(
    plan
    && plan.membershipGateKind === "invite_only"
    && hasConfiguredAuthority(plan.membershipInviteAuthority),
  );
  const planAuthoritiesReady = Boolean(
    hasConfiguredAuthority(plan?.sponsorOperator)
    && hasConfiguredAuthority(plan?.claimsOperator)
    && hasConfiguredAuthority(plan?.oracleAuthority),
  );
  const perSkuPosture = Object.values(NETWORK_SCHOOL_ACUTE_ASSIST_SKUS).map((definition) => {
    const lineIds = new Set(Object.values(definition.fundingLineIds));
    const amounts = sumFundingLineAmounts(input.snapshot.fundingLines, lineIds);
    return {
      skuKey: definition.key,
      displayName: definition.displayName,
      isDefaultSelection: definition.key === NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU.key,
      coverWindowDays: definition.coverWindowDays,
      retailUsd: definition.pricing.retailUsd,
      supportLimitUsd: definition.supportLimitUsd,
      fastLaneUsd: definition.fastLaneUsd,
      publicStatusRule: definition.issuanceControls.publicStatusRule,
      issueWhen: definition.issuanceControls.issueWhen,
      pauseWhen: definition.issuanceControls.pauseWhen,
      claimsPayingCapital: amounts.claimsPayingCapital,
      reservedAmount: amounts.reservedAmount,
      pendingPayoutAmount: amounts.pendingPayoutAmount,
      impairedAmount: amounts.impairedAmount,
    } satisfies NetworkSchoolAcuteAssistSkuPosture;
  });

  const relevantFundingLines = NETWORK_SCHOOL_BOOTSTRAP_FUNDING_LINES
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
      && plan.displayName === NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_DISPLAY_NAME
      && plan.sponsorLabel === NETWORK_SCHOOL_ACUTE_ASSIST_SPONSOR_LABEL,
    ),
    inviteGateReady,
    seriesReady: Object.values(seriesReadyBySku).every(Boolean),
    fundingLinesReady,
    sharedPoolReady: Boolean(
      pool
      && pool.displayName === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_DISPLAY_NAME
      && pool.strategyThesis === NETWORK_SCHOOL_ACUTE_ASSIST_POOL_STRATEGY_THESIS,
    ),
    capitalClassesReady,
    allocationsReady,
    reserveTargetReviewReady: Boolean(input.readiness?.poolTermsConfigured) && claimsPayingCapital >= 6_000n,
    planAuthoritiesReady,
    discordVerifierConfigured: Boolean(input.readiness?.discordVerifierConfigured),
    poolTermsReady: Boolean(input.readiness?.poolTermsConfigured),
    poolOraclePolicyReady: Boolean(input.readiness?.poolOraclePolicyConfigured),
  } satisfies NetworkSchoolAcuteAssistSetupChecklistState;
  const checklistCompleted = Object.values(checklist).filter(Boolean).length;
  const checklistTotal = Object.keys(checklist).length;
  const missingArtifacts: string[] = [];
  if (!checklist.planShellReady) missingArtifacts.push("plan_shell");
  if (!checklist.inviteGateReady) missingArtifacts.push("invite_gate");
  if (!checklist.seriesReady) missingArtifacts.push("tier_series");
  if (!checklist.fundingLinesReady) missingArtifacts.push("funding_lines");
  if (!checklist.sharedPoolReady) missingArtifacts.push("shared_acute_pool");
  if (!checklist.capitalClassesReady) missingArtifacts.push("capital_classes");
  if (!checklist.allocationsReady) missingArtifacts.push("allocation_positions");
  if (!checklist.discordVerifierConfigured) missingArtifacts.push("network_school_discord_verifier");

  const postureReasons: string[] = [];
  if (pauseBlocked) postureReasons.push("Pause flags or inactive launch controls are blocking issuance.");
  if (!checklist.discordVerifierConfigured) postureReasons.push("Network School Discord verification is not configured, so issuance fails closed.");
  if (claimsPayingCapital <= 0n) postureReasons.push("No NS Acute claims-paying capital has been posted yet.");
  if (checklistCompleted < checklistTotal) postureReasons.push("NS Acute setup is still missing required launch items.");
  if (pendingPayoutAmount > 0n) postureReasons.push("Pending payout exposure is live on the NS reserve lanes.");
  if (impairmentActive) postureReasons.push("Impairment is active on at least one linked NS liability lane.");
  if (queueOnlyRedemptionsActive) postureReasons.push("At least one linked acute-pool sleeve is still queue-only for redemptions.");

  let postureState: NetworkSchoolAcuteAssistPostureState = "healthy";
  if (pauseBlocked) {
    postureState = "paused";
  } else if (
    !checklist.discordVerifierConfigured
    || claimsPayingCapital <= 0n
    || checklistCompleted < checklistTotal
    || pendingPayoutAmount > 0n
    || impairmentActive
    || queueOnlyRedemptionsActive
  ) {
    postureState = "caution";
  }
  const readinessPhase = deriveNetworkSchoolAcuteAssistReadinessPhase({
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
    readinessPhaseCopy: describeNetworkSchoolAcuteAssistReadinessPhase(readinessPhase),
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
