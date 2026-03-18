// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  COVERAGE_CLAIM_STATUS_APPROVED,
  COVERAGE_CLAIM_STATUS_PAID,
  COVERAGE_CLAIM_STATUS_UNDER_REVIEW,
  OUTCOME_REVIEW_STATUS_CHALLENGED,
  OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE,
  REDEMPTION_REQUEST_STATUS_CANCELLED,
  REDEMPTION_REQUEST_STATUS_FAILED,
  REDEMPTION_REQUEST_STATUS_FULFILLED,
  REDEMPTION_REQUEST_STATUS_PENDING,
  REDEMPTION_REQUEST_STATUS_SCHEDULED,
  ZERO_PUBKEY,
  type CoverageClaimSummary,
  type MemberCycleStateSummary,
  type OutcomeAggregateSummary,
  type PoolAssetVaultSummary,
  type PoolCapitalClassSummary,
  type PoolRedemptionRequestSummary,
  type PoolTermsSummary,
} from "@/lib/protocol";

export type CoverageClaimActionDraft = {
  payoutMint: string;
  claimantRecipientSystemAccount: string;
  claimantRecipientTokenAccount: string | null;
  poolAssetVault: string | null;
  poolVaultTokenAccount: string | null;
  reviewRequestedAmount: bigint;
  approveAmount: bigint;
  payoutAmount: bigint;
  recoveryAmount: bigint;
  claimStatusLabel: string;
  recommendedOperatorAction: "review" | "support" | "approve" | "deny" | "pay" | "close" | "settle";
};

export type RedemptionQueueActionDraft = {
  payoutMint: string;
  classLabel: string;
  queueEnabled: boolean;
  noticeWindowSecs: bigint;
  requestStatusLabel: string;
  recommendedAction: "request" | "schedule" | "cancel" | "fail" | "fulfill" | "none";
  canRequest: boolean;
  canSchedule: boolean;
  canCancel: boolean;
  canFail: boolean;
  canFulfill: boolean;
};

export type OracleSettlementActionDraft = {
  payoutMint: string;
  payoutRail: "sol" | "spl";
  recommendedAction: "vote" | "finalize" | "dispute" | "resolve" | "settle" | "finalize_root" | "none";
  disputeOpen: boolean;
  settlementRootFinalized: boolean;
  cyclePassed: boolean;
};

function coverageClaimStatusLabel(status: number): string {
  switch (status) {
    case COVERAGE_CLAIM_STATUS_UNDER_REVIEW:
      return "Under review";
    case COVERAGE_CLAIM_STATUS_APPROVED:
      return "Approved";
    case COVERAGE_CLAIM_STATUS_PAID:
      return "Paid";
    default:
      return "Submitted";
  }
}

function redemptionStatusLabel(status: number): string {
  switch (status) {
    case REDEMPTION_REQUEST_STATUS_PENDING:
      return "Pending";
    case REDEMPTION_REQUEST_STATUS_SCHEDULED:
      return "Scheduled";
    case REDEMPTION_REQUEST_STATUS_FULFILLED:
      return "Fulfilled";
    case REDEMPTION_REQUEST_STATUS_CANCELLED:
      return "Cancelled";
    case REDEMPTION_REQUEST_STATUS_FAILED:
      return "Failed";
    default:
      return `Status ${status}`;
  }
}

export function deriveCoverageClaimActionDraft(params: {
  claim: CoverageClaimSummary;
  poolTerms: PoolTermsSummary | null;
  poolAssetVault: PoolAssetVaultSummary | null;
  claimantTokenAccount?: string | null;
}): CoverageClaimActionDraft {
  const payoutMint = params.poolTerms?.payoutAssetMint ?? ZERO_PUBKEY;
  let recommendedOperatorAction: CoverageClaimActionDraft["recommendedOperatorAction"] = "review";
  if (params.claim.status === COVERAGE_CLAIM_STATUS_UNDER_REVIEW) {
    recommendedOperatorAction = "support";
  } else if (params.claim.status === COVERAGE_CLAIM_STATUS_APPROVED) {
    recommendedOperatorAction = "pay";
  } else if (params.claim.status === COVERAGE_CLAIM_STATUS_PAID) {
    recommendedOperatorAction = "close";
  }
  return {
    payoutMint,
    claimantRecipientSystemAccount: params.claim.claimant,
    claimantRecipientTokenAccount: params.claimantTokenAccount ?? null,
    poolAssetVault: params.poolAssetVault?.address ?? null,
    poolVaultTokenAccount: params.poolAssetVault?.vaultTokenAccount ?? null,
    reviewRequestedAmount: params.claim.requestedAmount,
    approveAmount: params.claim.approvedAmount > 0n ? params.claim.approvedAmount : params.claim.requestedAmount,
    payoutAmount: params.claim.approvedAmount > 0n ? params.claim.approvedAmount : params.claim.requestedAmount,
    recoveryAmount: params.claim.recoveryAmount,
    claimStatusLabel: coverageClaimStatusLabel(params.claim.status),
    recommendedOperatorAction,
  };
}

export function deriveRedemptionQueueActionDraft(params: {
  request: PoolRedemptionRequestSummary | null;
  capitalClass: PoolCapitalClassSummary | null;
}): RedemptionQueueActionDraft {
  const queueEnabled = Boolean(params.capitalClass?.redemptionQueueEnabled);
  const requestStatus = params.request?.status ?? 0;
  const recommendedAction =
    !params.request ? "request"
      : requestStatus === REDEMPTION_REQUEST_STATUS_PENDING ? "schedule"
        : requestStatus === REDEMPTION_REQUEST_STATUS_SCHEDULED ? "fulfill"
          : "none";
  return {
    payoutMint: params.request?.payoutMint ?? params.capitalClass?.payoutMint ?? ZERO_PUBKEY,
    classLabel: params.capitalClass
      ? `${params.capitalClass.classIdHashHex.slice(0, 8)} • priority ${params.capitalClass.classPriority}`
      : "Compatibility share class",
    queueEnabled,
    noticeWindowSecs: params.capitalClass?.redemptionNoticeSecs ?? 0n,
    requestStatusLabel: params.request ? redemptionStatusLabel(params.request.status) : "No request selected",
    recommendedAction,
    canRequest: queueEnabled,
    canSchedule: requestStatus === REDEMPTION_REQUEST_STATUS_PENDING,
    canCancel:
      requestStatus === REDEMPTION_REQUEST_STATUS_PENDING
      || requestStatus === REDEMPTION_REQUEST_STATUS_SCHEDULED,
    canFail: requestStatus === REDEMPTION_REQUEST_STATUS_PENDING || requestStatus === REDEMPTION_REQUEST_STATUS_SCHEDULED,
    canFulfill: requestStatus === REDEMPTION_REQUEST_STATUS_SCHEDULED,
  };
}

export function deriveOracleSettlementActionDraft(params: {
  memberCycle: MemberCycleStateSummary | null;
  aggregate: OutcomeAggregateSummary | null;
  poolTerms: PoolTermsSummary | null;
  settlementRootFinalized?: boolean;
}): OracleSettlementActionDraft {
  const payoutMint = params.memberCycle?.paymentMint ?? params.poolTerms?.payoutAssetMint ?? ZERO_PUBKEY;
  const disputeOpen =
    params.aggregate?.reviewStatus === OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE
    || params.aggregate?.reviewStatus === OUTCOME_REVIEW_STATUS_CHALLENGED;
  const recommendedAction =
    !params.aggregate ? "vote"
      : disputeOpen ? "resolve"
        : !params.aggregate.finalized ? "finalize"
          : !params.memberCycle?.settledAt ? "settle"
            : params.settlementRootFinalized ? "none" : "finalize_root";
  return {
    payoutMint,
    payoutRail: payoutMint === ZERO_PUBKEY ? "sol" : "spl",
    recommendedAction,
    disputeOpen,
    settlementRootFinalized: Boolean(params.settlementRootFinalized),
    cyclePassed: Boolean(params.memberCycle?.passed ?? params.aggregate?.passed),
  };
}
