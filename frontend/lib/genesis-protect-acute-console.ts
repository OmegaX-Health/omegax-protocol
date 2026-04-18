// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CLAIM_ATTESTATION_DECISION_ABSTAIN,
  CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW,
  CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE,
  CLAIM_ATTESTATION_DECISION_SUPPORT_DENY,
  CLAIM_INTAKE_APPROVED,
  CLAIM_INTAKE_CLOSED,
  CLAIM_INTAKE_DENIED,
  CLAIM_INTAKE_OPEN,
  CLAIM_INTAKE_SETTLED,
  CLAIM_INTAKE_UNDER_REVIEW,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  OBLIGATION_STATUS_CANCELED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_IMPAIRED,
  OBLIGATION_STATUS_RESERVED,
  OBLIGATION_STATUS_SETTLED,
  REDEMPTION_POLICY_QUEUE_ONLY,
  availableFundingLineBalance,
  describeClaimStatus,
  describeFundingLineType,
  describeObligationStatus,
  recomputeReserveBalanceSheet,
  toBigIntAmount,
  type AllocationPositionSnapshot,
  type CapitalClassSnapshot,
  type ClaimAttestationSnapshot,
  type ClaimCaseSnapshot,
  type FundingLineSnapshot,
  type LiquidityPoolSnapshot,
  type MemberPositionSnapshot,
  type ObligationSnapshot,
  type PolicySeriesSnapshot,
  type ProtocolConsoleSnapshot,
} from "@/lib/protocol";
import { GENESIS_PROTECT_ACUTE_SKUS, type GenesisProtectAcuteSkuKey } from "@/lib/genesis-protect-acute";
import { type GenesisProtectAcuteSetupModel } from "@/lib/genesis-protect-acute-operator";

export type GenesisProtectAcuteClaimQueueFilter =
  | "all"
  | "operator_review"
  | "attestation_ready"
  | "reserve_active"
  | "payout_active"
  | "closed";

export type GenesisProtectAcuteReserveLaneFilter = "all" | "premium" | "sponsor" | "liquidity";

export type GenesisProtectAcuteClaimQueueStage =
  | "operator_review"
  | "attestation_ready"
  | "reserve_active"
  | "payout_active"
  | "closed";

export type GenesisProtectAcuteClaimActionPanel = "adjudication" | "reserve" | "impairment";

export type GenesisProtectAcuteClaimQueueRow = {
  claimAddress: string;
  claimId: string;
  claimStatusLabel: string;
  stage: GenesisProtectAcuteClaimQueueStage;
  stageLabel: string;
  stageReason: string;
  recommendedPanel: GenesisProtectAcuteClaimActionPanel;
  seriesAddress: string | null;
  skuKey: GenesisProtectAcuteSkuKey | null;
  skuDisplayName: string;
  fundingLineAddress: string;
  fundingLineDisplayName: string;
  fundingLaneType: GenesisProtectAcuteReserveLaneFilter | "other";
  claimant: string;
  memberPositionAddress: string;
  memberWallet: string | null;
  approvedAmount: bigint;
  paidAmount: bigint;
  reservedAmount: bigint;
  payoutInFlightAmount: bigint;
  outstandingAmount: bigint;
  impairedAmount: bigint;
  attestationStatusLabel: string;
  attestationDecision: number | null;
  attestationUpdatedAtTs: number | null;
  linkedObligationAddress: string | null;
  obligationStatus: number | null;
  obligationStatusLabel: string;
  operatorReview: boolean;
  attestationReady: boolean;
  reserveActive: boolean;
  payoutActive: boolean;
  dataWarning: string | null;
};

export type GenesisProtectAcuteClaimConsoleModel = {
  setupModel: GenesisProtectAcuteSetupModel;
  queueFilter: GenesisProtectAcuteClaimQueueFilter;
  rows: GenesisProtectAcuteClaimQueueRow[];
  visibleRows: GenesisProtectAcuteClaimQueueRow[];
  selectedClaim: GenesisProtectAcuteClaimQueueRow | null;
  selectedClaimCase: ClaimCaseSnapshot | null;
  summary: {
    submittedClaims: number;
    operatorReviewLoad: number;
    attestationReadyClaims: number;
    reservedExposure: bigint;
    payoutInFlightCount: number;
    payoutInFlightAmount: bigint;
  };
  warnings: string[];
};

export type GenesisProtectAcuteReserveLaneSummary = {
  fundingLineAddress: string;
  lineId: string;
  displayName: string;
  lineType: number;
  lineTypeLabel: string;
  laneType: GenesisProtectAcuteReserveLaneFilter | "other";
  fundingPriority: number;
  seriesAddress: string | null;
  skuKey: GenesisProtectAcuteSkuKey | null;
  skuDisplayName: string;
  claimsPayingCapital: bigint;
  availableAmount: bigint;
  reservedAmount: bigint;
  pendingPayoutAmount: bigint;
  impairedAmount: bigint;
  spentAmount: bigint;
  releasedAmount: bigint;
  linkedPoolDisplayName: string | null;
  linkedCapitalClasses: string[];
  linkedAllocationCount: number;
  queueOnlyRedemptions: boolean;
  hasVisibilityGap: boolean;
  warningReasons: string[];
};

export type GenesisProtectAcuteReserveConsoleModel = {
  setupModel: GenesisProtectAcuteSetupModel;
  laneFilter: GenesisProtectAcuteReserveLaneFilter;
  lanes: GenesisProtectAcuteReserveLaneSummary[];
  visibleLanes: GenesisProtectAcuteReserveLaneSummary[];
  selectedLane: GenesisProtectAcuteReserveLaneSummary | null;
  summary: {
    claimsPayingCapital: bigint;
    reservedAmount: bigint;
    pendingPayoutAmount: bigint;
    reserveUtilizationBps: bigint | null;
    impairedLaneCount: number;
    queueOnlyLaneCount: number;
    visibilityGapCount: number;
  };
  warnings: string[];
};

type GenesisProtectAcuteClaimConsoleInput = {
  snapshot: ProtocolConsoleSnapshot;
  setupModel: GenesisProtectAcuteSetupModel;
  selectedSeriesAddress?: string | null;
  selectedClaimAddress?: string | null;
  queueFilter?: GenesisProtectAcuteClaimQueueFilter;
};

type GenesisProtectAcuteReserveConsoleInput = {
  snapshot: ProtocolConsoleSnapshot;
  setupModel: GenesisProtectAcuteSetupModel;
  selectedSeriesAddress?: string | null;
  selectedFundingLineAddress?: string | null;
  laneFilter?: GenesisProtectAcuteReserveLaneFilter;
};

const GENESIS_CLAIM_QUEUE_FILTERS: readonly GenesisProtectAcuteClaimQueueFilter[] = [
  "all",
  "operator_review",
  "attestation_ready",
  "reserve_active",
  "payout_active",
  "closed",
] as const;

const GENESIS_RESERVE_LANE_FILTERS: readonly GenesisProtectAcuteReserveLaneFilter[] = [
  "all",
  "premium",
  "sponsor",
  "liquidity",
] as const;

function attestationDecisionLabel(decision: number | null | undefined): string {
  switch (decision) {
    case CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE:
      return "Approve";
    case CLAIM_ATTESTATION_DECISION_SUPPORT_DENY:
      return "Deny";
    case CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW:
      return "Review requested";
    case CLAIM_ATTESTATION_DECISION_ABSTAIN:
      return "Abstain";
    default:
      return "No attestation";
  }
}

function fundingLaneType(line: FundingLineSnapshot | null | undefined): GenesisProtectAcuteReserveLaneFilter | "other" {
  switch (line?.lineType) {
    case FUNDING_LINE_TYPE_PREMIUM_INCOME:
      return "premium";
    case FUNDING_LINE_TYPE_SPONSOR_BUDGET:
      return "sponsor";
    case FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION:
      return "liquidity";
    default:
      return "other";
  }
}

function queueStageLabel(stage: GenesisProtectAcuteClaimQueueStage): string {
  switch (stage) {
    case "operator_review":
      return "Operator review";
    case "attestation_ready":
      return "Attestation ready";
    case "reserve_active":
      return "Reserve active";
    case "payout_active":
      return "Payout in flight";
    default:
      return "Closed";
  }
}

function claimQueueFilterMatches(
  row: GenesisProtectAcuteClaimQueueRow,
  queueFilter: GenesisProtectAcuteClaimQueueFilter,
): boolean {
  if (queueFilter === "all") return true;
  return row.stage === queueFilter;
}

function isClaimQueueFilter(value: string | null | undefined): value is GenesisProtectAcuteClaimQueueFilter {
  return GENESIS_CLAIM_QUEUE_FILTERS.includes((value ?? "") as GenesisProtectAcuteClaimQueueFilter);
}

function isReserveLaneFilter(value: string | null | undefined): value is GenesisProtectAcuteReserveLaneFilter {
  return GENESIS_RESERVE_LANE_FILTERS.includes((value ?? "") as GenesisProtectAcuteReserveLaneFilter);
}

function primaryAttestation(
  claimAddress: string,
  attestations: ClaimAttestationSnapshot[],
): ClaimAttestationSnapshot | null {
  return attestations
    .filter((entry) => entry.claimCase === claimAddress)
    .sort((left, right) => right.updatedAtTs - left.updatedAtTs)[0]
    ?? null;
}

function primaryObligation(
  claim: ClaimCaseSnapshot,
  obligations: ObligationSnapshot[],
): ObligationSnapshot | null {
  const scoped = obligations.filter((obligation) =>
    obligation.address === claim.linkedObligation || obligation.claimCase === claim.address,
  );
  return scoped.sort((left, right) => {
    const leftScore = obligationPriority(left);
    const rightScore = obligationPriority(right);
    if (leftScore !== rightScore) return rightScore - leftScore;
    const leftAmount = toBigIntAmount(left.outstandingAmount ?? left.payableAmount ?? left.claimableAmount ?? left.reservedAmount);
    const rightAmount = toBigIntAmount(right.outstandingAmount ?? right.payableAmount ?? right.claimableAmount ?? right.reservedAmount);
    if (leftAmount === rightAmount) return 0;
    return leftAmount > rightAmount ? -1 : 1;
  })[0] ?? null;
}

function obligationPriority(obligation: ObligationSnapshot): number {
  switch (obligation.status) {
    case OBLIGATION_STATUS_IMPAIRED:
      return 5;
    case OBLIGATION_STATUS_CLAIMABLE_PAYABLE:
      return 4;
    case OBLIGATION_STATUS_RESERVED:
      return 3;
    case OBLIGATION_STATUS_SETTLED:
      return 2;
    case OBLIGATION_STATUS_CANCELED:
      return 1;
    default:
      return 0;
  }
}

function skuKeyFromSeries(
  seriesAddress: string | null | undefined,
  setupModel: GenesisProtectAcuteSetupModel,
): GenesisProtectAcuteSkuKey | null {
  if (!seriesAddress) return null;
  if (setupModel.seriesBySku.travel30?.address === seriesAddress) return "travel30";
  if (setupModel.seriesBySku.event7?.address === seriesAddress) return "event7";
  return null;
}

function skuDisplayNameFromKey(key: GenesisProtectAcuteSkuKey | null): string {
  if (key === "travel30") return GENESIS_PROTECT_ACUTE_SKUS.travel30.displayName;
  if (key === "event7") return GENESIS_PROTECT_ACUTE_SKUS.event7.displayName;
  return "Plan root";
}

function fundingLineByAddress(
  snapshot: ProtocolConsoleSnapshot,
  address: string | null | undefined,
): FundingLineSnapshot | null {
  if (!address) return null;
  return snapshot.fundingLines.find((entry) => entry.address === address) ?? null;
}

function memberByAddress(
  snapshot: ProtocolConsoleSnapshot,
  address: string | null | undefined,
): MemberPositionSnapshot | null {
  if (!address) return null;
  return snapshot.memberPositions.find((entry) => entry.address === address) ?? null;
}

function reserveLaneWarnings(params: {
  fundingLine: FundingLineSnapshot;
  linkedPool: LiquidityPoolSnapshot | null;
  linkedClasses: CapitalClassSnapshot[];
  allocationCount: number;
}): string[] {
  const warnings: string[] = [];
  const sheet = params.fundingLine.sheet ? recomputeReserveBalanceSheet(params.fundingLine.sheet) : null;
  if (!params.fundingLine.sheet) warnings.push("Live reserve sheet is missing for this lane.");
  if (sheet && sheet.impaired > 0n) warnings.push("Impairment is active on this reserve lane.");
  if (sheet && (sheet.claimable > 0n || sheet.payable > 0n)) warnings.push("Pending payout exposure is live on this reserve lane.");
  if (params.linkedPool?.redemptionPolicy === REDEMPTION_POLICY_QUEUE_ONLY) warnings.push("The linked pool is still queue-only for redemptions.");
  if (params.linkedClasses.some((entry) => entry.queueOnlyRedemptions)) warnings.push("A linked capital class is still queue-only.");
  if (fundingLaneType(params.fundingLine) === "liquidity" && params.allocationCount === 0) {
    warnings.push("No allocation position is linked to this liquidity reserve lane.");
  }
  return warnings;
}

function effectiveLinkedReserveAmount(
  claim: ClaimCaseSnapshot,
  obligation: ObligationSnapshot | null,
): bigint {
  const claimReserved = toBigIntAmount(claim.reservedAmount);
  const obligationReserved = toBigIntAmount(obligation?.reservedAmount);
  return claimReserved > obligationReserved ? claimReserved : obligationReserved;
}

function claimQueueStage(params: {
  claim: ClaimCaseSnapshot;
  obligation: ObligationSnapshot | null;
  attestation: ClaimAttestationSnapshot | null;
  payoutInFlightAmount: bigint;
  reservedAmount: bigint;
  impairedAmount: bigint;
  dataWarning: string | null;
}): { stage: GenesisProtectAcuteClaimQueueStage; recommendedPanel: GenesisProtectAcuteClaimActionPanel; reason: string } {
  const reviewDecision = params.attestation?.decision === CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW
    || params.attestation?.decision === CLAIM_ATTESTATION_DECISION_ABSTAIN;
  const operatorReview = params.claim.intakeStatus === CLAIM_INTAKE_OPEN
    || params.claim.intakeStatus === CLAIM_INTAKE_UNDER_REVIEW
    || reviewDecision
    || params.dataWarning !== null;
  const closed = params.claim.intakeStatus === CLAIM_INTAKE_SETTLED
    || params.claim.intakeStatus === CLAIM_INTAKE_CLOSED
    || params.claim.intakeStatus === CLAIM_INTAKE_DENIED
    || params.obligation?.status === OBLIGATION_STATUS_SETTLED
    || params.obligation?.status === OBLIGATION_STATUS_CANCELED;
  const payoutActive = params.payoutInFlightAmount > 0n
    || params.obligation?.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE;
  const reserveActive = params.reservedAmount > 0n
    || params.obligation?.status === OBLIGATION_STATUS_RESERVED;
  const attestationReady = params.claim.intakeStatus === CLAIM_INTAKE_APPROVED
    && params.attestation === null
    && !payoutActive
    && !reserveActive;

  if (closed) {
    return {
      stage: "closed",
      recommendedPanel: "reserve",
      reason: "The claim and linked liability path are already settled, denied, or closed.",
    };
  }
  if (operatorReview) {
    return {
      stage: "operator_review",
      recommendedPanel: params.impairedAmount > 0n ? "impairment" : "adjudication",
      reason: reviewDecision
        ? "The claim has an attestation feed asking for operator review before reserve actions continue."
        : params.dataWarning
          ? params.dataWarning
          : "The claim is still open or under review and needs operator casework first.",
    };
  }
  if (attestationReady) {
    return {
      stage: "attestation_ready",
      recommendedPanel: "adjudication",
      reason: "The claim is approved but still has no published claim attestation on the visible protocol surface.",
    };
  }
  if (payoutActive) {
    return {
      stage: "payout_active",
      recommendedPanel: params.impairedAmount > 0n ? "impairment" : "reserve",
      reason: params.impairedAmount > 0n
        ? "The linked obligation is carrying impairment or dispute-watch pressure."
        : "The linked obligation is claimable or payable and still needs settlement follow-through.",
    };
  }
  if (reserveActive) {
    return {
      stage: "reserve_active",
      recommendedPanel: "reserve",
      reason: "Capital is reserved against the case and still needs reserve-lane monitoring or release.",
    };
  }
  return {
    stage: "reserve_active",
    recommendedPanel: "reserve",
    reason: "The claim is approved and should stay visible in the reserve console until the liability path is explicit.",
  };
}

export function normalizeGenesisProtectAcuteClaimQueueFilter(
  value: string | null | undefined,
): GenesisProtectAcuteClaimQueueFilter {
  return isClaimQueueFilter(value) ? value : "all";
}

export function normalizeGenesisProtectAcuteReserveLaneFilter(
  value: string | null | undefined,
): GenesisProtectAcuteReserveLaneFilter {
  return isReserveLaneFilter(value) ? value : "all";
}

export function buildGenesisProtectAcuteClaimConsoleModel(
  input: GenesisProtectAcuteClaimConsoleInput,
): GenesisProtectAcuteClaimConsoleModel {
  const planAddress = input.setupModel.plan?.address ?? null;
  const planClaims = input.snapshot.claimCases.filter((entry) =>
    entry.healthPlan === planAddress
    && (!input.selectedSeriesAddress || entry.policySeries === input.selectedSeriesAddress),
  );
  const planObligations = input.snapshot.obligations.filter((entry) =>
    entry.healthPlan === planAddress
    && (!input.selectedSeriesAddress || entry.policySeries === input.selectedSeriesAddress),
  );
  const queueFilter = input.queueFilter ?? "all";

  const rows = planClaims.map((claim) => {
    const obligation = primaryObligation(claim, planObligations);
    const attestation = primaryAttestation(claim.address, input.snapshot.claimAttestations);
    const fundingLine = fundingLineByAddress(input.snapshot, claim.fundingLine);
    const member = memberByAddress(input.snapshot, claim.memberPosition);
    const skuKey = skuKeyFromSeries(claim.policySeries ?? null, input.setupModel);
    const reservedAmount = effectiveLinkedReserveAmount(claim, obligation);
    const payoutInFlightAmount = toBigIntAmount(obligation?.claimableAmount) + toBigIntAmount(obligation?.payableAmount);
    const outstandingAmount = toBigIntAmount(obligation?.outstandingAmount ?? obligation?.principalAmount);
    const impairedAmount = toBigIntAmount(obligation?.impairedAmount);
    const dataWarning = fundingLine
      ? claim.linkedObligation && !obligation
        ? "The linked obligation reference is missing from the current snapshot."
        : member
          ? null
          : "The linked member position is missing from the current snapshot."
      : "The claim funding line is missing from the current snapshot.";
    const stage = claimQueueStage({
      claim,
      obligation,
      attestation,
      payoutInFlightAmount,
      reservedAmount,
      impairedAmount,
      dataWarning,
    });

    return {
      claimAddress: claim.address,
      claimId: claim.claimId,
      claimStatusLabel: describeClaimStatus(claim.intakeStatus),
      stage: stage.stage,
      stageLabel: queueStageLabel(stage.stage),
      stageReason: stage.reason,
      recommendedPanel: stage.recommendedPanel,
      seriesAddress: claim.policySeries ?? null,
      skuKey,
      skuDisplayName: skuDisplayNameFromKey(skuKey),
      fundingLineAddress: claim.fundingLine,
      fundingLineDisplayName: fundingLine?.displayName ?? "Unknown funding line",
      fundingLaneType: fundingLaneType(fundingLine),
      claimant: claim.claimant,
      memberPositionAddress: claim.memberPosition,
      memberWallet: member?.wallet ?? null,
      approvedAmount: toBigIntAmount(claim.approvedAmount),
      paidAmount: toBigIntAmount(claim.paidAmount),
      reservedAmount,
      payoutInFlightAmount,
      outstandingAmount,
      impairedAmount,
      attestationStatusLabel: attestationDecisionLabel(attestation?.decision),
      attestationDecision: attestation?.decision ?? null,
      attestationUpdatedAtTs: attestation?.updatedAtTs ?? null,
      linkedObligationAddress: obligation?.address ?? claim.linkedObligation ?? null,
      obligationStatus: obligation?.status ?? null,
      obligationStatusLabel: obligation ? describeObligationStatus(obligation.status) : "No linked obligation",
      operatorReview: stage.stage === "operator_review",
      attestationReady: stage.stage === "attestation_ready",
      reserveActive: stage.stage === "reserve_active",
      payoutActive: stage.stage === "payout_active",
      dataWarning,
    } satisfies GenesisProtectAcuteClaimQueueRow;
  }).sort((left, right) => {
    const stageRank = claimStagePriority(right.stage) - claimStagePriority(left.stage);
    if (stageRank !== 0) return stageRank;
    if (left.attestationUpdatedAtTs !== right.attestationUpdatedAtTs) {
      return (right.attestationUpdatedAtTs ?? 0) - (left.attestationUpdatedAtTs ?? 0);
    }
    return left.claimId.localeCompare(right.claimId);
  });

  const visibleRows = rows.filter((row) => claimQueueFilterMatches(row, queueFilter));
  const selectedClaim = visibleRows.find((row) => row.claimAddress === (input.selectedClaimAddress ?? ""))
    ?? visibleRows[0]
    ?? null;
  const selectedClaimCase = selectedClaim
    ? planClaims.find((entry) => entry.address === selectedClaim.claimAddress) ?? null
    : null;
  const warnings = rows
    .map((row) => row.dataWarning)
    .filter((value): value is string => Boolean(value));
  if (input.setupModel.posture.state !== "healthy") {
    warnings.unshift(...input.setupModel.posture.reasons);
  }

  return {
    setupModel: input.setupModel,
    queueFilter,
    rows,
    visibleRows,
    selectedClaim,
    selectedClaimCase,
    summary: {
      submittedClaims: rows.filter((row) =>
        row.claimStatusLabel === describeClaimStatus(CLAIM_INTAKE_OPEN)
        || row.claimStatusLabel === describeClaimStatus(CLAIM_INTAKE_UNDER_REVIEW),
      ).length,
      operatorReviewLoad: rows.filter((row) => row.operatorReview).length,
      attestationReadyClaims: rows.filter((row) => row.attestationReady).length,
      reservedExposure: rows.reduce((sum, row) => sum + row.reservedAmount, 0n),
      payoutInFlightCount: rows.filter((row) => row.payoutActive).length,
      payoutInFlightAmount: rows.reduce((sum, row) => sum + row.payoutInFlightAmount, 0n),
    },
    warnings: [...new Set(warnings)],
  };
}

function claimStagePriority(stage: GenesisProtectAcuteClaimQueueStage): number {
  switch (stage) {
    case "operator_review":
      return 5;
    case "attestation_ready":
      return 4;
    case "payout_active":
      return 3;
    case "reserve_active":
      return 2;
    default:
      return 1;
  }
}

export function buildGenesisProtectAcuteReserveConsoleModel(
  input: GenesisProtectAcuteReserveConsoleInput,
): GenesisProtectAcuteReserveConsoleModel {
  const planAddress = input.setupModel.plan?.address ?? null;
  const planFundingLines = input.snapshot.fundingLines.filter((entry) =>
    entry.healthPlan === planAddress
    && (!input.selectedSeriesAddress || entry.policySeries === input.selectedSeriesAddress),
  );
  const laneFilter = input.laneFilter ?? "all";

  const lanes = planFundingLines.map((fundingLine) => {
    const allocations = input.snapshot.allocationPositions.filter((allocation) => allocation.fundingLine === fundingLine.address);
    const linkedClasses = allocations
      .map((allocation) => input.snapshot.capitalClasses.find((entry) => entry.address === allocation.capitalClass) ?? null)
      .filter((entry): entry is CapitalClassSnapshot => Boolean(entry));
    const linkedPool = linkedClasses
      .map((capitalClass) => input.snapshot.liquidityPools.find((entry) => entry.address === capitalClass.liquidityPool) ?? null)
      .find((entry): entry is LiquidityPoolSnapshot => Boolean(entry))
      ?? null;
    const warnings = reserveLaneWarnings({
      fundingLine,
      linkedPool,
      linkedClasses,
      allocationCount: allocations.length,
    });
    const skuKey = skuKeyFromSeries(fundingLine.policySeries ?? null, input.setupModel);
    const sheet = fundingLine.sheet ? recomputeReserveBalanceSheet(fundingLine.sheet) : null;
    return {
      fundingLineAddress: fundingLine.address,
      lineId: fundingLine.lineId,
      displayName: fundingLine.displayName,
      lineType: fundingLine.lineType,
      lineTypeLabel: describeFundingLineType(fundingLine.lineType),
      laneType: fundingLaneType(fundingLine),
      fundingPriority: fundingLine.fundingPriority,
      seriesAddress: fundingLine.policySeries ?? null,
      skuKey,
      skuDisplayName: skuDisplayNameFromKey(skuKey),
      claimsPayingCapital: sheet?.funded ?? toBigIntAmount(fundingLine.fundedAmount),
      availableAmount: availableFundingLineBalance(fundingLine),
      reservedAmount: sheet?.reserved ?? toBigIntAmount(fundingLine.reservedAmount),
      pendingPayoutAmount: sheet ? sheet.claimable + sheet.payable : 0n,
      impairedAmount: sheet?.impaired ?? 0n,
      spentAmount: toBigIntAmount(fundingLine.spentAmount),
      releasedAmount: toBigIntAmount(fundingLine.releasedAmount),
      linkedPoolDisplayName: linkedPool?.displayName ?? null,
      linkedCapitalClasses: linkedClasses.map((entry) => entry.displayName),
      linkedAllocationCount: allocations.length,
      queueOnlyRedemptions: Boolean(
        linkedPool?.redemptionPolicy === REDEMPTION_POLICY_QUEUE_ONLY
        || linkedClasses.some((entry) => entry.queueOnlyRedemptions),
      ),
      hasVisibilityGap: warnings.some((reason) => /missing/i.test(reason)),
      warningReasons: warnings,
    } satisfies GenesisProtectAcuteReserveLaneSummary;
  }).sort((left, right) => left.fundingPriority - right.fundingPriority);

  const visibleLanes = lanes.filter((lane) => laneFilter === "all" || lane.laneType === laneFilter);
  const selectedLane = visibleLanes.find((lane) => lane.fundingLineAddress === (input.selectedFundingLineAddress ?? ""))
    ?? visibleLanes[0]
    ?? null;
  const warnings = [...input.setupModel.posture.reasons];
  if (lanes.some((lane) => lane.hasVisibilityGap)) {
    warnings.push("One or more Genesis reserve lanes are missing live balance-sheet or allocation context.");
  }

  return {
    setupModel: input.setupModel,
    laneFilter,
    lanes,
    visibleLanes,
    selectedLane,
    summary: {
      claimsPayingCapital: lanes.reduce((sum, lane) => sum + lane.claimsPayingCapital, 0n),
      reservedAmount: lanes.reduce((sum, lane) => sum + lane.reservedAmount, 0n),
      pendingPayoutAmount: lanes.reduce((sum, lane) => sum + lane.pendingPayoutAmount, 0n),
      reserveUtilizationBps: input.setupModel.reserveUtilizationBps,
      impairedLaneCount: lanes.filter((lane) => lane.impairedAmount > 0n).length,
      queueOnlyLaneCount: lanes.filter((lane) => lane.queueOnlyRedemptions).length,
      visibilityGapCount: lanes.filter((lane) => lane.hasVisibilityGap).length,
    },
    warnings: [...new Set(warnings)],
  };
}
