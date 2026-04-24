// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Transaction } from "@solana/web3.js";

import { WizardDetailSheet } from "@/components/wizard-detail-sheet";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  buildAdjudicateClaimCaseTx,
  buildAttachClaimEvidenceRefTx,
  buildCreateObligationTx,
  buildCreatePolicySeriesTx,
  buildFundSponsorBudgetTx,
  buildMarkImpairmentTx,
  buildOpenClaimCaseTx,
  buildOpenFundingLineTx,
  buildOpenMemberPositionTx,
  buildRecordPremiumPaymentTx,
  buildReleaseReserveTx,
  buildReserveObligationTx,
  buildSettleClaimCaseTx,
  buildSettleObligationTx,
  buildUpdateHealthPlanControlsTx,
  buildUpdateMemberEligibilityTx,
  buildUpdateReserveDomainControlsTx,
  buildVersionPolicySeriesTx,
  CLAIM_INTAKE_APPROVED,
  CLAIM_INTAKE_DENIED,
  CLAIM_INTAKE_UNDER_REVIEW,
  ELIGIBILITY_ELIGIBLE,
  ELIGIBILITY_PENDING,
  FUNDING_LINE_TYPE_BACKSTOP,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  FUNDING_LINE_TYPE_SUBSIDY,
  MEMBER_DELEGATED_RIGHT_FLAGS,
  MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT,
  MEMBERSHIP_GATE_KIND_INVITE_ONLY,
  MEMBERSHIP_GATE_KIND_NFT_ANCHOR,
  MEMBERSHIP_GATE_KIND_OPEN,
  MEMBERSHIP_GATE_KIND_STAKE_ANCHOR,
  MEMBERSHIP_MODE_INVITE_ONLY,
  MEMBERSHIP_MODE_OPEN,
  MEMBERSHIP_MODE_TOKEN_GATE,
  MEMBERSHIP_PROOF_MODE_INVITE_PERMIT,
  MEMBERSHIP_PROOF_MODE_OPEN,
  MEMBERSHIP_PROOF_MODE_TOKEN_GATE,
  OBLIGATION_DELIVERY_MODE_CLAIMABLE,
  OBLIGATION_STATUS_CANCELED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_SETTLED,
  SERIES_MODE_OTHER,
  SERIES_MODE_PARAMETRIC,
  SERIES_MODE_PROTECTION,
  SERIES_MODE_REIMBURSEMENT,
  SERIES_MODE_REWARD,
  SERIES_STATUS_ACTIVE,
  SERIES_STATUS_CLOSED,
  SERIES_STATUS_DRAFT,
  SERIES_STATUS_PAUSED,
  ZERO_PUBKEY,
  hashStringTo32Hex,
  type AllocationPositionSnapshot,
  type CapitalClassSnapshot,
  type ClaimCaseSnapshot,
  type DomainAssetVaultSnapshot,
  type FundingLineSnapshot,
  type HealthPlanSnapshot,
  type LiquidityPoolSnapshot,
  type MemberPositionSnapshot,
  type ObligationSnapshot,
  type PolicySeriesSnapshot,
  type ReserveDomainSnapshot,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

export type PlanOperatorSection = "funding" | "claims" | "members" | "controls";

type Status = {
  tone: "ok" | "error";
  message: string;
  explorerUrl?: string | null;
} | null;

type PlanOperatorDrawerProps = {
  open: boolean;
  initialSection?: PlanOperatorSection;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => Promise<void> | void;
  plan: HealthPlanSnapshot | null;
  series: PolicySeriesSnapshot | null;
  reserveDomain: ReserveDomainSnapshot | null;
  fundingLines: FundingLineSnapshot[];
  seriesOptions: PolicySeriesSnapshot[];
  members: MemberPositionSnapshot[];
  claimCases: ClaimCaseSnapshot[];
  obligations: ObligationSnapshot[];
  allocations: AllocationPositionSnapshot[];
  classes: CapitalClassSnapshot[];
  pools: LiquidityPoolSnapshot[];
  domainAssetVaults: DomainAssetVaultSnapshot[];
};

const SECTIONS: Array<{ id: PlanOperatorSection; label: string; blurb: string }> = [
  {
    id: "funding",
    label: "Funding flows",
    blurb: "Fund sponsor budgets and record premium inflows.",
  },
  {
    id: "claims",
    label: "Claims",
    blurb: "Open cases, adjudicate, reserve, settle, and mark impairment.",
  },
  {
    id: "members",
    label: "Members",
    blurb: "Enroll members and review eligibility or delegation.",
  },
  {
    id: "controls",
    label: "Protocol controls",
    blurb: "Plan and domain posture, new series, and funding lines.",
  },
];

const CLAIM_SUB_TABS = [
  { id: "intake", label: "Intake" },
  { id: "adjudication", label: "Adjudicate" },
  { id: "reserve", label: "Reserve & settle" },
  { id: "impairment", label: "Impairment" },
] as const;
type ClaimSubTab = (typeof CLAIM_SUB_TABS)[number]["id"];

const MEMBER_SUB_TABS = [
  { id: "enroll", label: "Enroll" },
  { id: "review", label: "Review" },
] as const;
type MemberSubTab = (typeof MEMBER_SUB_TABS)[number]["id"];

const CONTROLS_SUB_TABS = [
  { id: "plan", label: "Plan" },
  { id: "domain", label: "Domain" },
  { id: "series", label: "Policy series" },
  { id: "line", label: "Funding line" },
] as const;
type ControlsSubTab = (typeof CONTROLS_SUB_TABS)[number]["id"];

const DELEGATED_RIGHT_COPY: Record<string, string> = {
  delegate_claim_filing: "Delegate claim filing",
  delegate_evidence_upload: "Delegate evidence upload",
  delegate_premium_payment: "Delegate premium payment",
  delegate_benefit_receipt: "Delegate benefit receipt",
  delegate_governance_vote: "Delegate governance vote",
};

function delegatedRightLabel(flag: string): string {
  return DELEGATED_RIGHT_COPY[flag] ?? flag.replace(/_/g, " ");
}

function parseBigIntInput(value: string): bigint {
  const normalized = value.trim().replace(/[_ ,]/g, "");
  if (!normalized) return 0n;
  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
}

async function hashReason(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{64}$/.test(normalized)) return normalized;
  return hashStringTo32Hex(trimmed);
}

function normalizedMembershipLabel(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function membershipModeForPlan(plan: HealthPlanSnapshot): number {
  if (typeof plan.membershipModeValue === "number") return plan.membershipModeValue;
  const label = normalizedMembershipLabel(plan.membershipModel);
  if (label.includes("invite")) return MEMBERSHIP_MODE_INVITE_ONLY;
  if (
    label.includes("token") ||
    label.includes("nft") ||
    label.includes("stake") ||
    label.includes("fungible")
  ) {
    return MEMBERSHIP_MODE_TOKEN_GATE;
  }
  return MEMBERSHIP_MODE_OPEN;
}

function membershipGateKindForPlan(plan: HealthPlanSnapshot): number {
  if (typeof plan.membershipGateKindValue === "number") return plan.membershipGateKindValue;
  const gateLabel = normalizedMembershipLabel(plan.membershipGateKind);
  if (gateLabel.includes("invite")) return MEMBERSHIP_GATE_KIND_INVITE_ONLY;
  if (gateLabel.includes("nft")) return MEMBERSHIP_GATE_KIND_NFT_ANCHOR;
  if (gateLabel.includes("stake")) return MEMBERSHIP_GATE_KIND_STAKE_ANCHOR;
  if (gateLabel.includes("fungible") || gateLabel.includes("token")) {
    return MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT;
  }

  const mode = membershipModeForPlan(plan);
  if (mode === MEMBERSHIP_MODE_INVITE_ONLY) return MEMBERSHIP_GATE_KIND_INVITE_ONLY;
  if (mode === MEMBERSHIP_MODE_TOKEN_GATE) return MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT;
  return MEMBERSHIP_GATE_KIND_OPEN;
}

function proofModeForPlan(plan: HealthPlanSnapshot): number {
  const mode = membershipModeForPlan(plan);
  if (mode === MEMBERSHIP_MODE_INVITE_ONLY) return MEMBERSHIP_PROOF_MODE_INVITE_PERMIT;
  if (mode === MEMBERSHIP_MODE_TOKEN_GATE) return MEMBERSHIP_PROOF_MODE_TOKEN_GATE;
  return MEMBERSHIP_PROOF_MODE_OPEN;
}

export function PlanOperatorDrawer(props: PlanOperatorDrawerProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey && props.plan);

  const [section, setSection] = useState<PlanOperatorSection>(props.initialSection ?? "funding");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (props.open && props.initialSection) setSection(props.initialSection);
  }, [props.open, props.initialSection]);

  // Funding state
  const [fundingLineAddress, setFundingLineAddress] = useState("");
  const [flowAmount, setFlowAmount] = useState("0");
  const [sourceTokenAccount, setSourceTokenAccount] = useState("");
  const [vaultTokenAccount, setVaultTokenAccount] = useState("");

  // Claims state
  const [claimSubTab, setClaimSubTab] = useState<ClaimSubTab>("intake");
  const [selectedClaimAddress, setSelectedClaimAddress] = useState("");
  const [selectedObligationAddress, setSelectedObligationAddress] = useState("");
  const [selectedMemberAddress, setSelectedMemberAddress] = useState("");
  const [selectedFundingLineForClaim, setSelectedFundingLineForClaim] = useState("");
  const [claimId, setClaimId] = useState("");
  const [claimant, setClaimant] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [decisionSupport, setDecisionSupport] = useState("");
  const [reviewState, setReviewState] = useState(String(CLAIM_INTAKE_UNDER_REVIEW));
  const [approvedAmount, setApprovedAmount] = useState("0");
  const [deniedAmount, setDeniedAmount] = useState("0");
  const [reserveAmount, setReserveAmount] = useState("0");
  const [obligationId, setObligationId] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [deliveryMode, setDeliveryMode] = useState(String(OBLIGATION_DELIVERY_MODE_CLAIMABLE));
  const [obligationAmount, setObligationAmount] = useState("0");
  const [reserveFlowAmount, setReserveFlowAmount] = useState("0");
  const [settleClaimAmount, setSettleClaimAmount] = useState("0");
  const [settleObligationAmount, setSettleObligationAmount] = useState("0");
  const [settleObligationStatus, setSettleObligationStatus] = useState(String(OBLIGATION_STATUS_CLAIMABLE_PAYABLE));
  const [impairmentAmount, setImpairmentAmount] = useState("0");
  const [impairmentReason, setImpairmentReason] = useState("");

  // Members state
  const [memberSubTab, setMemberSubTab] = useState<MemberSubTab>("enroll");
  const [memberSelectedAddress, setMemberSelectedAddress] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [subjectCommitment, setSubjectCommitment] = useState("");
  const [eligibilityStatus, setEligibilityStatus] = useState(String(ELIGIBILITY_PENDING));
  const [proofMode, setProofMode] = useState("0");
  const [tokenGateAccountAddress, setTokenGateAccountAddress] = useState("");
  const [membershipAnchorRefAddress, setMembershipAnchorRefAddress] = useState("");
  const [tokenGateSnapshot, setTokenGateSnapshot] = useState("0");
  const [inviteId, setInviteId] = useState("");
  const [inviteAuthorityAddress, setInviteAuthorityAddress] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("0");
  const [delegatedRights, setDelegatedRights] = useState<string[]>([]);
  const [memberActive, setMemberActive] = useState(true);

  // Controls state
  const [controlsSubTab, setControlsSubTab] = useState<ControlsSubTab>("plan");
  const [planAllowedRailMask, setPlanAllowedRailMask] = useState("0");
  const [planPauseFlags, setPlanPauseFlags] = useState("0");
  const [planActive, setPlanActive] = useState(true);
  const [domainAllowedRailMask, setDomainAllowedRailMask] = useState("65535");
  const [domainPauseFlags, setDomainPauseFlags] = useState("0");
  const [domainActive, setDomainActive] = useState(true);

  const [newSeriesId, setNewSeriesId] = useState("");
  const [newSeriesDisplayName, setNewSeriesDisplayName] = useState("");
  const [newSeriesMetadataUri, setNewSeriesMetadataUri] = useState("");
  const [newSeriesAssetMint, setNewSeriesAssetMint] = useState("");
  const [newSeriesMode, setNewSeriesMode] = useState(String(SERIES_MODE_PROTECTION));
  const [newSeriesStatus, setNewSeriesStatus] = useState(String(SERIES_STATUS_ACTIVE));
  const [newSeriesCycleSeconds, setNewSeriesCycleSeconds] = useState("0");

  const [versionSeriesId, setVersionSeriesId] = useState("");
  const [versionDisplayName, setVersionDisplayName] = useState("");
  const [versionMetadataUri, setVersionMetadataUri] = useState("");
  const [versionCycleSeconds, setVersionCycleSeconds] = useState("0");

  const [newFundingLineId, setNewFundingLineId] = useState("");
  const [newFundingLineAssetMint, setNewFundingLineAssetMint] = useState("");
  const [newFundingLinePolicySeriesAddress, setNewFundingLinePolicySeriesAddress] = useState("");
  const [newFundingLineType, setNewFundingLineType] = useState(String(FUNDING_LINE_TYPE_SPONSOR_BUDGET));
  const [newFundingPriority, setNewFundingPriority] = useState("0");
  const [newFundingCommittedAmount, setNewFundingCommittedAmount] = useState("0");

  // Seed defaults from props
  useEffect(() => {
    setFundingLineAddress(props.fundingLines[0]?.address ?? "");
    setSelectedFundingLineForClaim(props.fundingLines[0]?.address ?? "");
  }, [props.fundingLines]);

  useEffect(() => {
    setSelectedClaimAddress(props.claimCases[0]?.address ?? "");
  }, [props.claimCases]);

  useEffect(() => {
    setSelectedObligationAddress(props.obligations[0]?.address ?? "");
  }, [props.obligations]);

  useEffect(() => {
    setSelectedMemberAddress(props.members[0]?.address ?? "");
    setMemberSelectedAddress(props.members[0]?.address ?? "");
  }, [props.members]);

  useEffect(() => {
    if (publicKey && !walletAddress) setWalletAddress(publicKey.toBase58());
    if (publicKey && !claimant) setClaimant(publicKey.toBase58());
  }, [publicKey, walletAddress, claimant]);

  useEffect(() => {
    const member = props.members.find((entry) => entry.address === memberSelectedAddress);
    if (member) {
      setEligibilityStatus(String(member.eligibilityStatus));
      setDelegatedRights(member.delegatedRights);
      setMemberActive(member.active);
    }
  }, [memberSelectedAddress, props.members]);

  useEffect(() => {
    if (!props.plan) return;
    setPlanAllowedRailMask("0");
    setPlanPauseFlags(String(props.plan.pauseFlags ?? 0));
    setPlanActive(props.plan.active);
    setProofMode(String(proofModeForPlan(props.plan)));
    setTokenGateSnapshot(String(props.plan.membershipGateMinAmount ?? 0));
    setInviteAuthorityAddress(
      props.plan.membershipInviteAuthority && props.plan.membershipInviteAuthority !== ZERO_PUBKEY
        ? props.plan.membershipInviteAuthority
        : "",
    );
    setMembershipAnchorRefAddress(
      membershipGateKindForPlan(props.plan) === MEMBERSHIP_GATE_KIND_NFT_ANCHOR
        ? props.plan.membershipGateMint ?? ""
        : "",
    );
  }, [props.plan]);

  useEffect(() => {
    if (!props.reserveDomain) return;
    setDomainAllowedRailMask(String(65535));
    setDomainPauseFlags(String(props.reserveDomain.pauseFlags ?? 0));
    setDomainActive(props.reserveDomain.active);
  }, [props.reserveDomain]);

  useEffect(() => {
    if (!props.plan) return;
    setNewSeriesId(props.series ? `${props.series.seriesId}-alt` : `${props.plan.planId}-series`);
    setNewSeriesDisplayName(`${props.plan.displayName} Series`);
    setNewSeriesMetadataUri(props.series?.metadataUri ?? "");
    setNewSeriesAssetMint(props.series?.assetMint ?? props.fundingLines[0]?.assetMint ?? "");
    setNewSeriesMode(String(props.series?.mode ?? SERIES_MODE_PROTECTION));
    setNewSeriesStatus(String(props.series?.status ?? SERIES_STATUS_ACTIVE));
    setNewSeriesCycleSeconds(String(props.series?.cycleSeconds ?? 0));
  }, [props.plan, props.series, props.fundingLines]);

  useEffect(() => {
    if (!props.series) return;
    setVersionSeriesId(`${props.series.seriesId}-next`);
    setVersionDisplayName(props.series.displayName);
    setVersionMetadataUri(props.series.metadataUri ?? "");
    setVersionCycleSeconds(String(props.series.cycleSeconds ?? 0));
  }, [props.series]);

  useEffect(() => {
    setNewFundingLineAssetMint(props.series?.assetMint ?? props.fundingLines[0]?.assetMint ?? "");
    setNewFundingLinePolicySeriesAddress(props.series?.address ?? "");
  }, [props.series, props.fundingLines]);

  const selectedFundingLine = useMemo(
    () => props.fundingLines.find((line) => line.address === fundingLineAddress) ?? props.fundingLines[0] ?? null,
    [fundingLineAddress, props.fundingLines],
  );
  const selectedClaim = useMemo(
    () => props.claimCases.find((claim) => claim.address === selectedClaimAddress) ?? null,
    [props.claimCases, selectedClaimAddress],
  );
  const selectedObligation = useMemo(
    () => props.obligations.find((obligation) => obligation.address === selectedObligationAddress) ?? null,
    [props.obligations, selectedObligationAddress],
  );
  const selectedMemberForClaim = useMemo(
    () => props.members.find((member) => member.address === selectedMemberAddress) ?? null,
    [props.members, selectedMemberAddress],
  );
  const selectedClaimFundingLineAddress = selectedClaim?.fundingLine ?? null;
  const selectedObligationFundingLineAddress = selectedObligation?.fundingLine ?? null;
  const selectedClaimFundingLine = useMemo(
    () => props.fundingLines.find((line) => line.address === selectedClaimFundingLineAddress) ?? null,
    [props.fundingLines, selectedClaimFundingLineAddress],
  );
  const selectedObligationFundingLine = useMemo(
    () => props.fundingLines.find((line) => line.address === selectedObligationFundingLineAddress) ?? null,
    [props.fundingLines, selectedObligationFundingLineAddress],
  );
  const selectedFundingLineForClaimResolved = useMemo(
    () => {
      if (claimSubTab !== "intake") {
        return selectedObligationFundingLine ?? selectedClaimFundingLine ?? null;
      }
      return props.fundingLines.find((line) => line.address === selectedFundingLineForClaim) ?? null;
    },
    [
      claimSubTab,
      props.fundingLines,
      selectedClaimFundingLine,
      selectedFundingLineForClaim,
      selectedObligationFundingLine,
    ],
  );
  useEffect(() => {
    if (claimSubTab === "intake") return;
    const linkedAddress = selectedObligationFundingLineAddress ?? selectedClaimFundingLineAddress;
    if (!linkedAddress || linkedAddress === selectedFundingLineForClaim) return;
    if (props.fundingLines.some((line) => line.address === linkedAddress)) {
      setSelectedFundingLineForClaim(linkedAddress);
    }
  }, [
    claimSubTab,
    props.fundingLines,
    selectedClaimFundingLineAddress,
    selectedFundingLineForClaim,
    selectedObligationFundingLineAddress,
  ]);
  const selectedMember = useMemo(
    () => props.members.find((member) => member.address === memberSelectedAddress) ?? null,
    [props.members, memberSelectedAddress],
  );
  const createObligationFundingLine = selectedClaimFundingLine ?? selectedFundingLineForClaimResolved;
  const obligationFlowFundingLine = selectedObligationFundingLine;
  const settleClaimFundingLine = selectedClaimFundingLine;
  const impairmentFundingLine = selectedObligationFundingLine ?? selectedFundingLineForClaimResolved;
  const allocationFundingLineAddress =
    section === "funding"
      ? selectedFundingLine?.address
      : (obligationFlowFundingLine ?? settleClaimFundingLine ?? selectedFundingLineForClaimResolved)?.address;
  const selectedAllocation = useMemo(
    () =>
      props.allocations.find((entry) => entry.fundingLine === allocationFundingLineAddress) ??
      null,
    [allocationFundingLineAddress, props.allocations],
  );
  const selectedClass = useMemo(
    () => props.classes.find((capitalClass) => capitalClass.address === selectedAllocation?.capitalClass) ?? null,
    [props.classes, selectedAllocation?.capitalClass],
  );
  const selectedPool = useMemo(
    () => props.pools.find((pool) => pool.address === selectedAllocation?.liquidityPool) ?? null,
    [props.pools, selectedAllocation?.liquidityPool],
  );
  const selectedFundingVault = useMemo(
    () =>
      props.domainAssetVaults.find(
        (vault) =>
          vault.reserveDomain === props.plan?.reserveDomain &&
          vault.assetMint === selectedFundingLine?.assetMint,
      ) ?? null,
    [props.domainAssetVaults, props.plan?.reserveDomain, selectedFundingLine?.assetMint],
  );
  useEffect(() => {
    setVaultTokenAccount(selectedFundingVault?.vaultTokenAccount ?? "");
  }, [selectedFundingVault?.vaultTokenAccount]);
  const selectedFundingSeries = useMemo(
    () =>
      props.seriesOptions.find((entry) => entry.address === newFundingLinePolicySeriesAddress) ?? null,
    [props.seriesOptions, newFundingLinePolicySeriesAddress],
  );

  const delegatedRightsMask = delegatedRights.reduce((mask, right) => {
    const index = MEMBER_DELEGATED_RIGHT_FLAGS.indexOf(right as (typeof MEMBER_DELEGATED_RIGHT_FLAGS)[number]);
    return index >= 0 ? mask | (1 << index) : mask;
  }, 0);
  const connectedWalletAddress = publicKey?.toBase58() ?? "";
  const normalizedMemberWalletAddress = walletAddress.trim();
  const normalizedTokenGateAccountAddress = tokenGateAccountAddress.trim();
  const normalizedMembershipAnchorRefAddress = membershipAnchorRefAddress.trim();
  const normalizedInviteAuthorityAddress = inviteAuthorityAddress.trim();
  const activeMembershipMode = props.plan ? membershipModeForPlan(props.plan) : MEMBERSHIP_MODE_OPEN;
  const activeMembershipGateKind = props.plan
    ? membershipGateKindForPlan(props.plan)
    : MEMBERSHIP_GATE_KIND_OPEN;
  const tokenGateRequired = activeMembershipMode === MEMBERSHIP_MODE_TOKEN_GATE;
  const inviteAuthorityRequired = activeMembershipMode === MEMBERSHIP_MODE_INVITE_ONLY;
  const membershipAnchorRequired =
    tokenGateRequired &&
    (activeMembershipGateKind === MEMBERSHIP_GATE_KIND_NFT_ANCHOR ||
      activeMembershipGateKind === MEMBERSHIP_GATE_KIND_STAKE_ANCHOR);
  const memberWalletMatchesSigner =
    Boolean(connectedWalletAddress) &&
    (normalizedMemberWalletAddress || connectedWalletAddress) === connectedWalletAddress;
  const inviteAuthorityMatchesSigner =
    !inviteAuthorityRequired ||
    (Boolean(normalizedInviteAuthorityAddress) &&
      normalizedInviteAuthorityAddress === connectedWalletAddress);
  const memberProofReady =
    (!tokenGateRequired || Boolean(normalizedTokenGateAccountAddress)) &&
    (!membershipAnchorRequired || Boolean(normalizedMembershipAnchorRefAddress)) &&
    (!inviteAuthorityRequired || Boolean(normalizedInviteAuthorityAddress));

  async function run(label: string, factory: () => Promise<Transaction>) {
    if (!publicKey || !sendTransaction || !props.plan) return;
    setBusy(label);
    setStatus(null);
    try {
      const tx = await factory();
      const result = await executeProtocolTransaction({ connection, sendTransaction, tx, label });
      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }
      setStatus({ tone: "ok", message: result.message, explorerUrl: result.explorerUrl });
      await props.onRefresh?.();
    } catch (err) {
      setStatus({
        tone: "error",
        message: err instanceof Error ? err.message : `${label} failed.`,
      });
    } finally {
      setBusy(null);
    }
  }

  const busyOn = (label: string) => busy === label;

  const sheetMeta = useMemo(() => {
    const meta: Array<{ label: string; tone?: "default" | "accent" | "muted" }> = [];
    if (props.plan) meta.push({ label: props.plan.displayName });
    if (props.series) meta.push({ label: props.series.displayName, tone: "accent" });
    return meta;
  }, [props.plan, props.series]);

  return (
    <WizardDetailSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Operator actions"
      summary="Fund reserves, open and settle claims, enroll members, and adjust plan controls."
      meta={sheetMeta}
      size="wide"
    >
      <div className="operator-drawer">
        <nav className="operator-drawer-nav" aria-label="Plan operator action sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "operator-drawer-nav-item",
                section === item.id && "operator-drawer-nav-item-active",
              )}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <span className="operator-drawer-nav-label">{item.label}</span>
              <span className="operator-drawer-nav-blurb">{item.blurb}</span>
            </button>
          ))}
        </nav>

        <div className="operator-drawer-body">
          {!canAct ? (
            <p className="operator-drawer-hint">
              Connect a wallet and select a plan before submitting protocol transactions.
            </p>
          ) : null}

          {status ? (
            <div className="plans-notice liquid-glass" role="status">
              <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">
                {status.tone === "ok" ? "verified" : "error"}
              </span>
              <p>
                {status.message}
                {status.explorerUrl ? (
                  <>
                    {" "}
                    <a
                      href={status.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="plans-table-link"
                    >
                      Explorer →
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          {/* ── FUNDING ─────────────────────── */}
          {section === "funding" ? (
            <div className="operator-drawer-section">
              <fieldset className="operator-drawer-fieldset">
                <legend className="operator-drawer-legend">Funding line flow</legend>
                {props.fundingLines.length === 0 ? (
                  <p className="operator-drawer-hint">
                    This plan has no funding lines. Open one under Protocol controls first.
                  </p>
                ) : (
                  <>
                    <div className="plans-wizard-row">
                      <SelectField
                        label="Funding line"
                        value={fundingLineAddress}
                        onChange={setFundingLineAddress}
                      >
                        {props.fundingLines.map((line) => (
                          <option key={line.address} value={line.address}>
                            {line.displayName}
                          </option>
                        ))}
                      </SelectField>
                      <TextField label="Amount" value={flowAmount} onChange={setFlowAmount} />
                    </div>
                    <div className="plans-wizard-row">
                      <TextField
                        label="Source token account"
                        value={sourceTokenAccount}
                        onChange={setSourceTokenAccount}
                      />
                      <TextField
                        label="Vault token account"
                        value={vaultTokenAccount}
                        onChange={setVaultTokenAccount}
                      />
                    </div>
                    <p className="operator-drawer-hint">
                      Funding now moves tokens into the registered vault before reserve ledgers
                      increase.
                    </p>
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct ||
                          !selectedFundingLine ||
                          !sourceTokenAccount.trim() ||
                          !vaultTokenAccount.trim() ||
                          selectedFundingLine.lineType !== FUNDING_LINE_TYPE_SPONSOR_BUDGET ||
                          busyOn("Fund sponsor budget")
                        }
                        onClick={() =>
                          run("Fund sponsor budget", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildFundSponsorBudgetTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              reserveDomainAddress: props.plan!.reserveDomain,
                              fundingLineAddress: selectedFundingLine!.address,
                              assetMint: selectedFundingLine!.assetMint,
                              sourceTokenAccountAddress: sourceTokenAccount.trim(),
                              vaultTokenAccountAddress: vaultTokenAccount.trim(),
                              recentBlockhash: blockhash,
                              amount: parseBigIntInput(flowAmount),
                              policySeriesAddress: selectedFundingLine!.policySeries ?? null,
                            });
                          })
                        }
                      >
                        Fund sponsor budget
                      </button>
                      <button
                        type="button"
                        className="plans-primary-cta"
                        disabled={
                          !canAct ||
                          !selectedFundingLine ||
                          !sourceTokenAccount.trim() ||
                          !vaultTokenAccount.trim() ||
                          selectedFundingLine.lineType !== FUNDING_LINE_TYPE_PREMIUM_INCOME ||
                          busyOn("Record premium payment")
                        }
                        onClick={() =>
                          run("Record premium payment", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildRecordPremiumPaymentTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              reserveDomainAddress: props.plan!.reserveDomain,
                              fundingLineAddress: selectedFundingLine!.address,
                              assetMint: selectedFundingLine!.assetMint,
                              sourceTokenAccountAddress: sourceTokenAccount.trim(),
                              vaultTokenAccountAddress: vaultTokenAccount.trim(),
                              recentBlockhash: blockhash,
                              amount: parseBigIntInput(flowAmount),
                              policySeriesAddress: selectedFundingLine!.policySeries ?? null,
                              capitalClassAddress: selectedClass?.address ?? null,
                              poolAssetMint: selectedPool?.depositAssetMint ?? null,
                            });
                          })
                        }
                      >
                        Record premium
                      </button>
                    </div>
                  </>
                )}
              </fieldset>
            </div>
          ) : null}

          {/* ── CLAIMS ─────────────────────── */}
          {section === "claims" ? (
            <div className="operator-drawer-section">
              <SubTabs
                tabs={CLAIM_SUB_TABS}
                active={claimSubTab}
                onChange={(next) => setClaimSubTab(next as ClaimSubTab)}
              />
              <div className="plans-wizard-row">
                <SelectField
                  label="Claim case"
                  value={selectedClaimAddress}
                  onChange={setSelectedClaimAddress}
                >
                  {props.claimCases.length === 0 ? <option value="">No claims</option> : null}
                  {props.claimCases.map((claim) => (
                    <option key={claim.address} value={claim.address}>
                      {claim.claimId}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Obligation"
                  value={selectedObligationAddress}
                  onChange={setSelectedObligationAddress}
                >
                  {props.obligations.length === 0 ? <option value="">No obligations</option> : null}
                  {props.obligations.map((obligation) => (
                    <option key={obligation.address} value={obligation.address}>
                      {obligation.obligationId || obligation.address.slice(0, 8)}
                    </option>
                  ))}
                </SelectField>
              </div>

              {claimSubTab === "intake" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Open a claim case</legend>
                  <div className="plans-wizard-row">
                    <TextField label="Claim ID" value={claimId} onChange={setClaimId} />
                    <TextField label="Claimant" value={claimant} onChange={setClaimant} />
                  </div>
                  <div className="plans-wizard-row">
                    <SelectField
                      label="Member position"
                      value={selectedMemberAddress}
                      onChange={setSelectedMemberAddress}
                    >
                      {props.members.length === 0 ? <option value="">No members</option> : null}
                      {props.members.map((member) => (
                        <option key={member.address} value={member.address}>
                          {member.wallet.slice(0, 8)}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Funding line"
                      value={selectedFundingLineForClaim}
                      onChange={setSelectedFundingLineForClaim}
                    >
                      {props.fundingLines.map((line) => (
                        <option key={line.address} value={line.address}>
                          {line.displayName}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <TextField
                    label="Evidence reference"
                    value={evidenceRef}
                    onChange={setEvidenceRef}
                    placeholder="URI, CID, or digest seed"
                  />
                  <div className="operator-drawer-actions">
                    <button
                      type="button"
                      className="plans-primary-cta"
                      disabled={
                        !canAct ||
                        !selectedMemberForClaim ||
                        !selectedFundingLineForClaimResolved ||
                        busyOn("Open claim case")
                      }
                      onClick={() =>
                        run("Open claim case", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildOpenClaimCaseTx({
                            authority: publicKey!,
                            healthPlanAddress: props.plan!.address,
                            memberPositionAddress: selectedMemberForClaim!.address,
                            fundingLineAddress: selectedFundingLineForClaimResolved!.address,
                            recentBlockhash: blockhash,
                            claimId,
                            policySeriesAddress:
                              props.series?.address ??
                              selectedFundingLineForClaimResolved!.policySeries ??
                              null,
                            claimantAddress: claimant || publicKey!,
                            evidenceRefHashHex: await hashReason(evidenceRef),
                          });
                        })
                      }
                    >
                      Open claim case
                    </button>
                  </div>
                </fieldset>
              ) : null}

              {claimSubTab === "adjudication" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Adjudicate</legend>
                  <div className="plans-wizard-row">
                    <TextField label="Evidence reference" value={evidenceRef} onChange={setEvidenceRef} />
                    <TextField label="Decision support" value={decisionSupport} onChange={setDecisionSupport} />
                  </div>
                  <div className="plans-wizard-row">
                    <SelectField label="Review state" value={reviewState} onChange={setReviewState}>
                      <option value={String(CLAIM_INTAKE_UNDER_REVIEW)}>Under review</option>
                      <option value={String(CLAIM_INTAKE_APPROVED)}>Approved</option>
                      <option value={String(CLAIM_INTAKE_DENIED)}>Denied</option>
                    </SelectField>
                    <TextField label="Approved amount" value={approvedAmount} onChange={setApprovedAmount} />
                  </div>
                  <div className="plans-wizard-row">
                    <TextField label="Denied amount" value={deniedAmount} onChange={setDeniedAmount} />
                    <TextField label="Reserve amount" value={reserveAmount} onChange={setReserveAmount} />
                  </div>
                  <div className="operator-drawer-actions">
                    <button
                      type="button"
                      className="plans-secondary-cta"
                      disabled={!canAct || !selectedClaim || busyOn("Attach evidence")}
                      onClick={() =>
                        run("Attach evidence", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildAttachClaimEvidenceRefTx({
                            authority: publicKey!,
                            healthPlanAddress: props.plan!.address,
                            claimCaseAddress: selectedClaim!.address,
                            recentBlockhash: blockhash,
                            evidenceRefHashHex: await hashReason(evidenceRef),
                            decisionSupportHashHex: await hashReason(decisionSupport),
                          });
                        })
                      }
                    >
                      Attach evidence
                    </button>
                    <button
                      type="button"
                      className="plans-primary-cta"
                      disabled={!canAct || !selectedClaim || busyOn("Adjudicate claim")}
                      onClick={() =>
                        run("Adjudicate claim", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildAdjudicateClaimCaseTx({
                            authority: publicKey!,
                            healthPlanAddress: props.plan!.address,
                            claimCaseAddress: selectedClaim!.address,
                            recentBlockhash: blockhash,
                            reviewState: Number.parseInt(reviewState, 10) || CLAIM_INTAKE_UNDER_REVIEW,
                            approvedAmount: parseBigIntInput(approvedAmount),
                            deniedAmount: parseBigIntInput(deniedAmount),
                            reserveAmount: parseBigIntInput(reserveAmount),
                            decisionSupportHashHex: await hashReason(decisionSupport),
                            obligationAddress: selectedObligation?.address ?? null,
                          });
                        })
                      }
                    >
                      Adjudicate
                    </button>
                  </div>
                </fieldset>
              ) : null}

              {claimSubTab === "reserve" ? (
                <>
                  <fieldset className="operator-drawer-fieldset">
                    <legend className="operator-drawer-legend">Create obligation</legend>
                    <div className="plans-wizard-row">
                      <TextField label="Obligation ID" value={obligationId} onChange={setObligationId} />
                      <TextField label="Beneficiary" value={beneficiary} onChange={setBeneficiary} />
                    </div>
                    <div className="plans-wizard-row">
                      <SelectField label="Delivery mode" value={deliveryMode} onChange={setDeliveryMode}>
                        <option value={String(OBLIGATION_DELIVERY_MODE_CLAIMABLE)}>Claimable</option>
                        <option value="1">Payable</option>
                      </SelectField>
                      <TextField label="Obligation amount" value={obligationAmount} onChange={setObligationAmount} />
                    </div>
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct ||
                          !createObligationFundingLine ||
                          busyOn("Create obligation")
                        }
                        onClick={() =>
                          run("Create obligation", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildCreateObligationTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              reserveDomainAddress: props.plan!.reserveDomain,
                              fundingLineAddress: createObligationFundingLine!.address,
                              assetMint: createObligationFundingLine!.assetMint,
                              recentBlockhash: blockhash,
                              obligationId,
                              policySeriesAddress:
                                props.series?.address ??
                                createObligationFundingLine!.policySeries ??
                                null,
                              memberWalletAddress:
                                selectedMemberForClaim?.wallet ?? selectedClaim?.claimant ?? null,
                              beneficiaryAddress: beneficiary || publicKey!,
                              claimCaseAddress: selectedClaim?.address ?? null,
                              liquidityPoolAddress: selectedPool?.address ?? null,
                              capitalClassAddress: selectedClass?.address ?? null,
                              allocationPositionAddress: selectedAllocation?.address ?? null,
                              deliveryMode:
                                Number.parseInt(deliveryMode, 10) || OBLIGATION_DELIVERY_MODE_CLAIMABLE,
                              amount: parseBigIntInput(obligationAmount),
                              creationReasonHashHex: await hashReason(
                                `${claimId}:${decisionSupport || evidenceRef || obligationId}`,
                              ),
                              poolAssetMint: selectedPool?.depositAssetMint ?? null,
                            });
                          })
                        }
                      >
                        Create obligation
                      </button>
                    </div>
                  </fieldset>

                  <fieldset className="operator-drawer-fieldset">
                    <legend className="operator-drawer-legend">Reserve and settle</legend>
                    <div className="plans-wizard-row">
                      <TextField
                        label="Reserve flow amount"
                        value={reserveFlowAmount}
                        onChange={setReserveFlowAmount}
                      />
                      <TextField
                        label="Settle claim amount"
                        value={settleClaimAmount}
                        onChange={setSettleClaimAmount}
                      />
                    </div>
                    <div className="plans-wizard-row">
                      <TextField
                        label="Settle obligation amount"
                        value={settleObligationAmount}
                        onChange={setSettleObligationAmount}
                      />
                      <SelectField
                        label="Next obligation status"
                        value={settleObligationStatus}
                        onChange={setSettleObligationStatus}
                      >
                        <option value={String(OBLIGATION_STATUS_CLAIMABLE_PAYABLE)}>Claimable / payable</option>
                        <option value={String(OBLIGATION_STATUS_SETTLED)}>Settled</option>
                        <option value={String(OBLIGATION_STATUS_CANCELED)}>Canceled</option>
                      </SelectField>
                    </div>
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct ||
                          !selectedObligation ||
                          !obligationFlowFundingLine ||
                          busyOn("Reserve obligation")
                        }
                        onClick={() =>
                          run("Reserve obligation", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildReserveObligationTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              reserveDomainAddress: props.plan!.reserveDomain,
                              fundingLineAddress: obligationFlowFundingLine!.address,
                              assetMint: selectedObligation!.assetMint,
                              obligationAddress: selectedObligation!.address,
                              recentBlockhash: blockhash,
                              amount: parseBigIntInput(reserveFlowAmount),
                              claimCaseAddress: selectedObligation!.claimCase ?? null,
                              policySeriesAddress: selectedObligation!.policySeries ?? null,
                              capitalClassAddress: selectedObligation!.capitalClass ?? null,
                              allocationPositionAddress: selectedObligation!.allocationPosition ?? null,
                              poolAssetMint: selectedPool?.depositAssetMint ?? null,
                            });
                          })
                        }
                      >
                        Reserve
                      </button>
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct ||
                          !selectedObligation ||
                          !obligationFlowFundingLine ||
                          busyOn("Release reserve")
                        }
                        onClick={() =>
                          run("Release reserve", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildReleaseReserveTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              reserveDomainAddress: props.plan!.reserveDomain,
                              fundingLineAddress: obligationFlowFundingLine!.address,
                              assetMint: selectedObligation!.assetMint,
                              obligationAddress: selectedObligation!.address,
                              recentBlockhash: blockhash,
                              amount: parseBigIntInput(reserveFlowAmount),
                              claimCaseAddress: selectedObligation!.claimCase ?? null,
                              policySeriesAddress: selectedObligation!.policySeries ?? null,
                              capitalClassAddress: selectedObligation!.capitalClass ?? null,
                              allocationPositionAddress: selectedObligation!.allocationPosition ?? null,
                              poolAssetMint: selectedPool?.depositAssetMint ?? null,
                            });
                          })
                        }
                      >
                        Release
                      </button>
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={
                          !canAct ||
                          !selectedClaim ||
                          !settleClaimFundingLine ||
                          busyOn("Settle claim")
                        }
                        onClick={() =>
                          run("Settle claim", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildSettleClaimCaseTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              reserveDomainAddress: props.plan!.reserveDomain,
                              fundingLineAddress: settleClaimFundingLine!.address,
                              assetMint: settleClaimFundingLine!.assetMint,
                              claimCaseAddress: selectedClaim!.address,
                              recentBlockhash: blockhash,
                              amount: parseBigIntInput(settleClaimAmount),
                              policySeriesAddress: selectedClaim!.policySeries ?? null,
                              obligationAddress: selectedObligation?.address ?? null,
                              capitalClassAddress: selectedObligation?.capitalClass ?? null,
                              allocationPositionAddress: selectedObligation?.allocationPosition ?? null,
                              poolAssetMint: selectedPool?.depositAssetMint ?? null,
                            });
                          })
                        }
                      >
                        Settle claim
                      </button>
                      <button
                        type="button"
                        className="plans-primary-cta"
                        disabled={
                          !canAct ||
                          !selectedObligation ||
                          !obligationFlowFundingLine ||
                          busyOn("Settle obligation")
                        }
                        onClick={() =>
                          run("Settle obligation", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildSettleObligationTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              reserveDomainAddress: props.plan!.reserveDomain,
                              fundingLineAddress: obligationFlowFundingLine!.address,
                              assetMint: selectedObligation!.assetMint,
                              obligationAddress: selectedObligation!.address,
                              recentBlockhash: blockhash,
                              nextStatus:
                                Number.parseInt(settleObligationStatus, 10) || OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
                              amount: parseBigIntInput(settleObligationAmount),
                              settlementReasonHashHex: await hashReason(
                                decisionSupport || evidenceRef || obligationId,
                              ),
                              claimCaseAddress: selectedObligation!.claimCase ?? null,
                              policySeriesAddress: selectedObligation!.policySeries ?? null,
                              capitalClassAddress: selectedObligation!.capitalClass ?? null,
                              allocationPositionAddress: selectedObligation!.allocationPosition ?? null,
                              poolAssetMint: selectedPool?.depositAssetMint ?? null,
                            });
                          })
                        }
                      >
                        Settle obligation
                      </button>
                    </div>
                  </fieldset>
                </>
              ) : null}

              {claimSubTab === "impairment" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Mark impairment</legend>
                  <div className="plans-wizard-row">
                    <TextField
                      label="Impairment amount"
                      value={impairmentAmount}
                      onChange={setImpairmentAmount}
                    />
                    <TextField
                      label="Impairment reason"
                      value={impairmentReason}
                      onChange={setImpairmentReason}
                      placeholder="Reason seed or 32-byte hex"
                    />
                  </div>
                  <div className="operator-drawer-actions">
                    <button
                      type="button"
                      className="plans-primary-cta"
                      disabled={
                        !canAct ||
                        !impairmentFundingLine ||
                        busyOn("Mark impairment")
                      }
                      onClick={() =>
                        run("Mark impairment", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildMarkImpairmentTx({
                            authority: publicKey!,
                            healthPlanAddress: props.plan!.address,
                            reserveDomainAddress: props.plan!.reserveDomain,
                            fundingLineAddress: impairmentFundingLine!.address,
                            assetMint:
                              selectedObligation?.assetMint ??
                              impairmentFundingLine!.assetMint,
                            recentBlockhash: blockhash,
                            amount: parseBigIntInput(impairmentAmount),
                            reasonHashHex: await hashReason(impairmentReason),
                            policySeriesAddress:
                              selectedObligation?.policySeries ??
                              impairmentFundingLine!.policySeries ??
                              null,
                            capitalClassAddress:
                              selectedObligation?.capitalClass ?? selectedClass?.address ?? null,
                            allocationPositionAddress:
                              selectedObligation?.allocationPosition ?? selectedAllocation?.address ?? null,
                            obligationAddress: selectedObligation?.address ?? null,
                            poolAssetMint: selectedPool?.depositAssetMint ?? null,
                          });
                        })
                      }
                    >
                      Mark impairment
                    </button>
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {/* ── MEMBERS ─────────────────────── */}
          {section === "members" ? (
            <div className="operator-drawer-section">
              <SubTabs
                tabs={MEMBER_SUB_TABS}
                active={memberSubTab}
                onChange={(next) => setMemberSubTab(next as MemberSubTab)}
              />

              {memberSubTab === "enroll" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Enroll a member</legend>
                  {!memberWalletMatchesSigner ? (
                    <p className="operator-drawer-hint">
                      The member wallet must match the connected signer for this on-chain enrollment.
                    </p>
                  ) : null}
                  {!inviteAuthorityMatchesSigner ? (
                    <p className="operator-drawer-hint">
                      Invite-only enrollment also needs the configured invite authority to sign.
                    </p>
                  ) : null}
                  <div className="plans-wizard-row">
                    <TextField label="Wallet" value={walletAddress} onChange={setWalletAddress} />
                    <TextField
                      label="Subject commitment"
                      value={subjectCommitment}
                      onChange={setSubjectCommitment}
                      placeholder="Hash seed or 32-byte hex"
                    />
                  </div>
                  <div className="plans-wizard-row">
                    <SelectField
                      label="Eligibility"
                      value={eligibilityStatus}
                      onChange={setEligibilityStatus}
                    >
                      <option value={String(ELIGIBILITY_PENDING)}>Pending</option>
                      <option value={String(ELIGIBILITY_ELIGIBLE)}>Eligible</option>
                    </SelectField>
                    <SelectField label="Proof mode" value={proofMode} onChange={setProofMode}>
                      <option value="0">Open</option>
                      <option value="1">Token gate</option>
                      <option value="2">Invite permit</option>
                    </SelectField>
                  </div>
                  {tokenGateRequired ? (
                    <>
                      <div className="plans-wizard-row">
                        <TextField
                          label="Token gate account"
                          value={tokenGateAccountAddress}
                          onChange={setTokenGateAccountAddress}
                          placeholder="Token account owned by the member wallet"
                        />
                        <TextField
                          label="Token gate snapshot"
                          value={tokenGateSnapshot}
                          onChange={setTokenGateSnapshot}
                        />
                      </div>
                      {membershipAnchorRequired ? (
                        <TextField
                          label="Membership anchor ref"
                          value={membershipAnchorRefAddress}
                          onChange={setMembershipAnchorRefAddress}
                          placeholder="NFT mint or stake-token account anchor"
                        />
                      ) : null}
                    </>
                  ) : null}
                  {inviteAuthorityRequired ? (
                    <>
                      <div className="plans-wizard-row">
                        <TextField
                          label="Invite authority"
                          value={inviteAuthorityAddress}
                          onChange={setInviteAuthorityAddress}
                        />
                        <TextField label="Invite ID" value={inviteId} onChange={setInviteId} />
                      </div>
                      <TextField
                        label="Invite expires at (unix seconds)"
                        value={inviteExpiresAt}
                        onChange={setInviteExpiresAt}
                      />
                    </>
                  ) : null}
                  <div className="operator-drawer-rights">
                    {MEMBER_DELEGATED_RIGHT_FLAGS.map((right) => (
                      <Toggle
                        key={right}
                        label={delegatedRightLabel(right)}
                        checked={delegatedRights.includes(right)}
                        onChange={(checked) =>
                          setDelegatedRights((current) =>
                            checked
                              ? [...new Set([...current, right])]
                              : current.filter((entry) => entry !== right),
                          )
                        }
                      />
                    ))}
                  </div>
                  <div className="operator-drawer-actions">
                    <button
                      type="button"
                      className="plans-primary-cta"
                      disabled={
                        !canAct ||
                        !memberWalletMatchesSigner ||
                        !inviteAuthorityMatchesSigner ||
                        !memberProofReady ||
                        busyOn("Open member position")
                      }
                      onClick={() =>
                        run("Open member position", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildOpenMemberPositionTx({
                            wallet: normalizedMemberWalletAddress || publicKey!,
                            healthPlanAddress: props.plan!.address,
                            recentBlockhash: blockhash,
                            seriesScopeAddress: props.series?.address ?? ZERO_PUBKEY,
                            subjectCommitmentHashHex: await hashReason(subjectCommitment),
                            eligibilityStatus:
                              Number.parseInt(eligibilityStatus, 10) || ELIGIBILITY_PENDING,
                            delegatedRightsMask,
                            proofMode: Number.parseInt(proofMode, 10) || 0,
                            tokenGateAmountSnapshot: parseBigIntInput(tokenGateSnapshot),
                            inviteIdHashHex: await hashReason(inviteId),
                            inviteExpiresAt: parseBigIntInput(inviteExpiresAt),
                            tokenGateAccountAddress: tokenGateRequired
                              ? normalizedTokenGateAccountAddress
                              : undefined,
                            anchorRefAddress: membershipAnchorRequired
                              ? normalizedMembershipAnchorRefAddress
                              : undefined,
                            inviteAuthorityAddress: inviteAuthorityRequired
                              ? normalizedInviteAuthorityAddress
                              : undefined,
                          });
                        })
                      }
                    >
                      Open member position
                    </button>
                  </div>
                </fieldset>
              ) : null}

              {memberSubTab === "review" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Review eligibility</legend>
                  <SelectField
                    label="Selected member"
                    value={memberSelectedAddress}
                    onChange={setMemberSelectedAddress}
                  >
                    {props.members.length === 0 ? <option value="">No members</option> : null}
                    {props.members.map((member) => (
                      <option key={member.address} value={member.address}>
                        {member.wallet.slice(0, 8)}
                      </option>
                    ))}
                  </SelectField>
                  <div className="plans-wizard-row">
                    <SelectField
                      label="Eligibility"
                      value={eligibilityStatus}
                      onChange={setEligibilityStatus}
                    >
                      <option value={String(ELIGIBILITY_PENDING)}>Pending</option>
                      <option value={String(ELIGIBILITY_ELIGIBLE)}>Eligible</option>
                      <option value="2">Paused</option>
                      <option value="3">Closed</option>
                    </SelectField>
                    <Toggle
                      label="Member active"
                      description="Disable to suspend this member's position."
                      checked={memberActive}
                      onChange={setMemberActive}
                    />
                  </div>
                  <div className="operator-drawer-rights">
                    {MEMBER_DELEGATED_RIGHT_FLAGS.map((right) => (
                      <Toggle
                        key={right}
                        label={delegatedRightLabel(right)}
                        checked={delegatedRights.includes(right)}
                        onChange={(checked) =>
                          setDelegatedRights((current) =>
                            checked
                              ? [...new Set([...current, right])]
                              : current.filter((entry) => entry !== right),
                          )
                        }
                      />
                    ))}
                  </div>
                  <div className="operator-drawer-actions">
                    <button
                      type="button"
                      className="plans-primary-cta"
                      disabled={!canAct || !selectedMember || busyOn("Update member eligibility")}
                      onClick={() =>
                        run("Update member eligibility", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildUpdateMemberEligibilityTx({
                            authority: publicKey!,
                            healthPlanAddress: props.plan!.address,
                            walletAddress: selectedMember!.wallet,
                            recentBlockhash: blockhash,
                            seriesScopeAddress: selectedMember!.policySeries,
                            eligibilityStatus:
                              Number.parseInt(eligibilityStatus, 10) || ELIGIBILITY_PENDING,
                            delegatedRightsMask,
                            active: memberActive,
                          });
                        })
                      }
                    >
                      Update eligibility
                    </button>
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {/* ── CONTROLS ─────────────────────── */}
          {section === "controls" ? (
            <div className="operator-drawer-section">
              <SubTabs
                tabs={CONTROLS_SUB_TABS}
                active={controlsSubTab}
                onChange={(next) => setControlsSubTab(next as ControlsSubTab)}
              />

              {controlsSubTab === "plan" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Plan controls</legend>
                  <div className="plans-wizard-row">
                    <TextField
                      label="Allowed rails (bitmask)"
                      value={planAllowedRailMask}
                      onChange={setPlanAllowedRailMask}
                    />
                    <TextField
                      label="Pause flags (bitmask)"
                      value={planPauseFlags}
                      onChange={setPlanPauseFlags}
                    />
                  </div>
                  <Toggle
                    label="Plan active"
                    description="Disable to freeze plan-level activity."
                    checked={planActive}
                    onChange={setPlanActive}
                  />
                  <div className="operator-drawer-actions">
                    <button
                      type="button"
                      className="plans-secondary-cta"
                      disabled={!canAct || busyOn("Update plan controls")}
                      onClick={() =>
                        run("Update plan controls", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildUpdateHealthPlanControlsTx({
                            authority: publicKey!,
                            healthPlanAddress: props.plan!.address,
                            recentBlockhash: blockhash,
                            sponsorOperator: props.plan!.sponsorOperator,
                            claimsOperator: props.plan!.claimsOperator,
                            oracleAuthority: props.plan!.oracleAuthority ?? ZERO_PUBKEY,
                            membershipMode: membershipModeForPlan(props.plan!),
                            membershipGateKind: membershipGateKindForPlan(props.plan!),
                            membershipGateMint: props.plan!.membershipGateMint ?? ZERO_PUBKEY,
                            membershipGateMinAmount: BigInt(props.plan!.membershipGateMinAmount ?? 0),
                            membershipInviteAuthority:
                              props.plan!.membershipInviteAuthority ?? ZERO_PUBKEY,
                            allowedRailMask: Number.parseInt(planAllowedRailMask, 10) || 0,
                            defaultFundingPriority: props.fundingLines[0]?.fundingPriority ?? 0,
                            pauseFlags: Number.parseInt(planPauseFlags, 10) || 0,
                            active: planActive,
                          });
                        })
                      }
                    >
                      Save plan controls
                    </button>
                  </div>
                </fieldset>
              ) : null}

              {controlsSubTab === "domain" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Reserve domain controls</legend>
                  {!props.reserveDomain ? (
                    <p className="operator-drawer-hint">
                      This plan is not linked to a reserve domain snapshot.
                    </p>
                  ) : (
                    <>
                      <div className="plans-wizard-row">
                        <TextField
                          label="Allowed rails (bitmask)"
                          value={domainAllowedRailMask}
                          onChange={setDomainAllowedRailMask}
                        />
                        <TextField
                          label="Pause flags (bitmask)"
                          value={domainPauseFlags}
                          onChange={setDomainPauseFlags}
                        />
                      </div>
                      <Toggle
                        label="Domain active"
                        description="Disable to freeze domain-level reserve activity."
                        checked={domainActive}
                        onChange={setDomainActive}
                      />
                      <div className="operator-drawer-actions">
                        <button
                          type="button"
                          className="plans-secondary-cta"
                          disabled={!canAct || busyOn("Update reserve domain")}
                          onClick={() =>
                            run("Update reserve domain", async () => {
                              const { blockhash } = await connection.getLatestBlockhash("confirmed");
                              return buildUpdateReserveDomainControlsTx({
                                authority: publicKey!,
                                reserveDomainAddress: props.reserveDomain!.address,
                                recentBlockhash: blockhash,
                                allowedRailMask: Number.parseInt(domainAllowedRailMask, 10) || 0,
                                pauseFlags: Number.parseInt(domainPauseFlags, 10) || 0,
                                active: domainActive,
                              });
                            })
                          }
                        >
                          Save domain controls
                        </button>
                      </div>
                    </>
                  )}
                </fieldset>
              ) : null}

              {controlsSubTab === "series" ? (
                <>
                  <fieldset className="operator-drawer-fieldset">
                    <legend className="operator-drawer-legend">Create policy series</legend>
                    <div className="plans-wizard-row">
                      <TextField label="Series ID" value={newSeriesId} onChange={setNewSeriesId} />
                      <TextField
                        label="Display name"
                        value={newSeriesDisplayName}
                        onChange={setNewSeriesDisplayName}
                      />
                    </div>
                    <div className="plans-wizard-row">
                      <TextField
                        label="Metadata URI"
                        value={newSeriesMetadataUri}
                        onChange={setNewSeriesMetadataUri}
                      />
                      <TextField
                        label="Asset mint"
                        value={newSeriesAssetMint}
                        onChange={setNewSeriesAssetMint}
                      />
                    </div>
                    <div className="plans-wizard-row">
                      <SelectField label="Mode" value={newSeriesMode} onChange={setNewSeriesMode}>
                        <option value={String(SERIES_MODE_REWARD)}>Reward</option>
                        <option value={String(SERIES_MODE_PROTECTION)}>Protection</option>
                        <option value={String(SERIES_MODE_REIMBURSEMENT)}>Reimbursement</option>
                        <option value={String(SERIES_MODE_PARAMETRIC)}>Parametric</option>
                        <option value={String(SERIES_MODE_OTHER)}>Other</option>
                      </SelectField>
                      <SelectField
                        label="Status"
                        value={newSeriesStatus}
                        onChange={setNewSeriesStatus}
                      >
                        <option value={String(SERIES_STATUS_DRAFT)}>Draft</option>
                        <option value={String(SERIES_STATUS_ACTIVE)}>Active</option>
                        <option value={String(SERIES_STATUS_PAUSED)}>Paused</option>
                        <option value={String(SERIES_STATUS_CLOSED)}>Closed</option>
                      </SelectField>
                    </div>
                    <TextField
                      label="Cycle seconds"
                      value={newSeriesCycleSeconds}
                      onChange={setNewSeriesCycleSeconds}
                    />
                    <div className="operator-drawer-actions">
                      <button
                        type="button"
                        className="plans-secondary-cta"
                        disabled={!canAct || !newSeriesAssetMint || busyOn("Create policy series")}
                        onClick={() =>
                          run("Create policy series", async () => {
                            const { blockhash } = await connection.getLatestBlockhash("confirmed");
                            return buildCreatePolicySeriesTx({
                              authority: publicKey!,
                              healthPlanAddress: props.plan!.address,
                              assetMint: newSeriesAssetMint,
                              recentBlockhash: blockhash,
                              seriesId: newSeriesId,
                              displayName: newSeriesDisplayName || newSeriesId,
                              metadataUri: newSeriesMetadataUri,
                              mode: Number.parseInt(newSeriesMode, 10) || SERIES_MODE_OTHER,
                              status: Number.parseInt(newSeriesStatus, 10) || SERIES_STATUS_DRAFT,
                              adjudicationMode: 0,
                              cycleSeconds: parseBigIntInput(newSeriesCycleSeconds),
                              termsVersion: 1,
                            });
                          })
                        }
                      >
                        Create series
                      </button>
                    </div>
                  </fieldset>

                  {props.series ? (
                    <fieldset className="operator-drawer-fieldset">
                      <legend className="operator-drawer-legend">Version current series</legend>
                      <div className="plans-wizard-row">
                        <TextField
                          label="Next series ID"
                          value={versionSeriesId}
                          onChange={setVersionSeriesId}
                        />
                        <TextField
                          label="Display name"
                          value={versionDisplayName}
                          onChange={setVersionDisplayName}
                        />
                      </div>
                      <div className="plans-wizard-row">
                        <TextField
                          label="Metadata URI"
                          value={versionMetadataUri}
                          onChange={setVersionMetadataUri}
                        />
                        <TextField
                          label="Cycle seconds"
                          value={versionCycleSeconds}
                          onChange={setVersionCycleSeconds}
                        />
                      </div>
                      <div className="operator-drawer-actions">
                        <button
                          type="button"
                          className="plans-primary-cta"
                          disabled={!canAct || busyOn("Version policy series")}
                          onClick={() =>
                            run("Version policy series", async () => {
                              const { blockhash } = await connection.getLatestBlockhash("confirmed");
                              return buildVersionPolicySeriesTx({
                                authority: publicKey!,
                                healthPlanAddress: props.plan!.address,
                                currentPolicySeriesAddress: props.series!.address,
                                assetMint: props.series!.assetMint,
                                recentBlockhash: blockhash,
                                seriesId: versionSeriesId,
                                displayName: versionDisplayName,
                                metadataUri: versionMetadataUri,
                                status: props.series!.status,
                                adjudicationMode: 0,
                                cycleSeconds: parseBigIntInput(versionCycleSeconds),
                              });
                            })
                          }
                        >
                          Version series
                        </button>
                      </div>
                    </fieldset>
                  ) : null}
                </>
              ) : null}

              {controlsSubTab === "line" ? (
                <fieldset className="operator-drawer-fieldset">
                  <legend className="operator-drawer-legend">Open funding line</legend>
                  <div className="plans-wizard-row">
                    <TextField
                      label="Line identifier"
                      value={newFundingLineId}
                      onChange={setNewFundingLineId}
                    />
                    <TextField
                      label="Asset mint"
                      value={newFundingLineAssetMint}
                      onChange={setNewFundingLineAssetMint}
                    />
                  </div>
                  <div className="plans-wizard-row">
                    <SelectField
                      label="Policy series"
                      value={newFundingLinePolicySeriesAddress}
                      onChange={setNewFundingLinePolicySeriesAddress}
                    >
                      <option value="">Plan root</option>
                      {props.seriesOptions.map((entry) => (
                        <option key={entry.address} value={entry.address}>
                          {entry.displayName}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Line type"
                      value={newFundingLineType}
                      onChange={setNewFundingLineType}
                    >
                      <option value={String(FUNDING_LINE_TYPE_SPONSOR_BUDGET)}>Sponsor budget</option>
                      <option value={String(FUNDING_LINE_TYPE_PREMIUM_INCOME)}>Premium income</option>
                      <option value={String(FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION)}>
                        Pool allocation
                      </option>
                      <option value={String(FUNDING_LINE_TYPE_BACKSTOP)}>Backstop</option>
                      <option value={String(FUNDING_LINE_TYPE_SUBSIDY)}>Subsidy</option>
                    </SelectField>
                  </div>
                  <div className="plans-wizard-row">
                    <TextField
                      label="Funding priority"
                      value={newFundingPriority}
                      onChange={setNewFundingPriority}
                    />
                    <TextField
                      label="Committed amount"
                      value={newFundingCommittedAmount}
                      onChange={setNewFundingCommittedAmount}
                    />
                  </div>
                  <div className="operator-drawer-actions">
                    <button
                      type="button"
                      className="plans-primary-cta"
                      disabled={!canAct || !newFundingLineAssetMint || busyOn("Open funding line")}
                      onClick={() =>
                        run("Open funding line", async () => {
                          const { blockhash } = await connection.getLatestBlockhash("confirmed");
                          return buildOpenFundingLineTx({
                            authority: publicKey!,
                            healthPlanAddress: props.plan!.address,
                            reserveDomainAddress: props.plan!.reserveDomain,
                            assetMint: newFundingLineAssetMint,
                            recentBlockhash: blockhash,
                            lineId: newFundingLineId,
                            policySeriesAddress: selectedFundingSeries?.address ?? null,
                            lineType:
                              Number.parseInt(newFundingLineType, 10) || FUNDING_LINE_TYPE_SPONSOR_BUDGET,
                            fundingPriority: Number.parseInt(newFundingPriority, 10) || 0,
                            committedAmount: parseBigIntInput(newFundingCommittedAmount),
                          });
                        })
                      }
                    >
                      Open funding line
                    </button>
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </WizardDetailSheet>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{props.label}</span>
      <span className="plans-wizard-field-bar">
        <input
          className="plans-wizard-input"
          type="text"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
        />
      </span>
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{props.label}</span>
      <span className="plans-wizard-field-bar">
        <select
          className="plans-wizard-input"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {props.children}
        </select>
      </span>
    </label>
  );
}

function Toggle(props: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="plans-settings-row">
      <div>
        <span className="plans-settings-label">{props.label}</span>
        {props.description ? (
          <span className="plans-settings-lane">{props.description}</span>
        ) : null}
      </div>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

function SubTabs<T extends { id: string; label: string }>(props: {
  tabs: readonly T[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="operator-drawer-subtabs" role="tablist">
      {props.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={props.active === tab.id}
          className={cn(
            "operator-drawer-subtab",
            props.active === tab.id && "operator-drawer-subtab-active",
          )}
          onClick={() => props.onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
