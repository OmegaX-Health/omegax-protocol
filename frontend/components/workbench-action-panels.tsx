// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { Transaction } from "@solana/web3.js";

import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  buildAdjudicateClaimCaseTx,
  buildAllocateCapitalTx,
  buildAttachClaimEvidenceRefTx,
  buildCreatePolicySeriesTx,
  buildCreateAllocationPositionTx,
  buildCreateCapitalClassTx,
  buildCreateLiquidityPoolTx,
  buildCreateObligationTx,
  buildDepositIntoCapitalClassTx,
  buildDeallocateCapitalTx,
  buildFundSponsorBudgetTx,
  buildMarkImpairmentTx,
  buildOpenClaimCaseTx,
  buildOpenFundingLineTx,
  buildOpenMemberPositionTx,
  buildProcessRedemptionQueueTx,
  buildRecordPremiumPaymentTx,
  buildReleaseReserveTx,
  buildRequestRedemptionTx,
  buildReserveObligationTx,
  buildSettleClaimCaseTx,
  buildSettleObligationTx,
  buildUpdateAllocationCapsTx,
  buildUpdateCapitalClassControlsTx,
  buildUpdateHealthPlanControlsTx,
  buildUpdateLpPositionCredentialingTx,
  buildUpdateMemberEligibilityTx,
  buildUpdateReserveDomainControlsTx,
  buildVersionPolicySeriesTx,
  CAPITAL_CLASS_RESTRICTION_OPEN,
  CAPITAL_CLASS_RESTRICTION_RESTRICTED,
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
  OBLIGATION_DELIVERY_MODE_CLAIMABLE,
  OBLIGATION_STATUS_CANCELED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_SETTLED,
  PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS,
  PAUSE_FLAG_CLAIM_INTAKE,
  REDEMPTION_POLICY_OPEN,
  REDEMPTION_POLICY_QUEUE_ONLY,
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
  type FundingLineSnapshot,
  type HealthPlanSnapshot,
  type LiquidityPoolSnapshot,
  type LPPositionSnapshot,
  type MemberPositionSnapshot,
  type PolicySeriesSnapshot,
  type ReserveDomainSnapshot,
} from "@/lib/protocol";

const MEMBERSHIP_PROOF_MODE_OPEN = 0;
const MEMBERSHIP_PROOF_MODE_TOKEN_GATE = 1;
const MEMBERSHIP_PROOF_MODE_INVITE_PERMIT = 2;

type ActionStatus = {
  tone: "ok" | "error";
  message: string;
  explorerUrl?: string | null;
} | null;

function parseBigIntInput(value: string): bigint {
  const normalized = value.trim().replace(/[_ ,]/g, "");
  if (!normalized) return 0n;
  return BigInt(normalized);
}

async function hashInputToHex(value: string): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{64}$/.test(normalized)) return normalized;
  return hashStringTo32Hex(trimmed);
}

function selectOptions<T extends { address: string }>(rows: T[], selectedAddress?: string | null): T | null {
  if (!rows.length) return null;
  return rows.find((row) => row.address === selectedAddress) ?? rows[0] ?? null;
}

function StatusBanner({ status }: { status: ActionStatus }) {
  if (!status) return null;
  return (
    <div className="plans-notice liquid-glass" role="status">
      <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">
        {status.tone === "ok" ? "verified" : "error"}
      </span>
      <p>
        {status.message}
        {status.explorerUrl ? (
          <>
            {" "}
            <a href={status.explorerUrl} target="_blank" rel="noreferrer" className="plans-table-link">
              Explorer →
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "search";
}) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{props.label}</span>
      <span className="plans-wizard-field-bar">
        <input
          className="plans-wizard-input"
          type={props.type ?? "text"}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
        />
      </span>
    </label>
  );
}

function ToggleRow(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="plans-settings-row">
      <div>
        <span className="plans-settings-label">{props.label}</span>
        <span className="plans-settings-lane">{props.checked ? "Enabled" : "Disabled"}</span>
      </div>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

function WalletGuard({ ready }: { ready: boolean }) {
  if (ready) return null;
  return (
    <p className="plans-card-body">
      Connect a wallet before submitting protocol transactions from this workspace.
    </p>
  );
}

function membershipProofModeForPlan(plan: HealthPlanSnapshot | null): number {
  if (!plan) return MEMBERSHIP_PROOF_MODE_OPEN;
  if (plan.membershipModel === "invite_only") return MEMBERSHIP_PROOF_MODE_INVITE_PERMIT;
  if (plan.membershipModel === "token_gate") return MEMBERSHIP_PROOF_MODE_TOKEN_GATE;
  return MEMBERSHIP_PROOF_MODE_OPEN;
}

type MemberSelfServePanelProps = {
  plan: HealthPlanSnapshot | null;
  series: PolicySeriesSnapshot | null;
  members: MemberPositionSnapshot[];
  onRefresh?: () => Promise<void> | void;
};

export function MemberSelfServePanel(props: MemberSelfServePanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey && props.plan);
  const walletAddress = publicKey?.toBase58() ?? "";
  const existingPosition = useMemo(
    () =>
      props.members.find((member) =>
        member.wallet === walletAddress && member.policySeries === (props.series?.address ?? ZERO_PUBKEY),
      ) ?? props.members.find((member) => member.wallet === walletAddress) ?? null,
    [props.members, props.series?.address, walletAddress],
  );
  const proofMode = membershipProofModeForPlan(props.plan);
  const requiresTokenGate = props.plan?.membershipModel === "token_gate";
  const requiresInviteAuthority = props.plan?.membershipModel === "invite_only";
  const usesStakeAnchor = props.plan?.membershipGateKind === "stake_anchor";
  const usesNftAnchor = props.plan?.membershipGateKind === "nft_anchor";

  const [status, setStatus] = useState<ActionStatus>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [subjectCommitment, setSubjectCommitment] = useState("");
  const [tokenGateAccount, setTokenGateAccount] = useState("");
  const [tokenGateSnapshot, setTokenGateSnapshot] = useState(String(props.plan?.membershipGateMinAmount ?? 0));
  const [inviteId, setInviteId] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("0");

  useEffect(() => {
    setTokenGateSnapshot(String(props.plan?.membershipGateMinAmount ?? 0));
  }, [props.plan?.membershipGateMinAmount]);

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
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="plans-card heavy-glass">
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">MEMBER_SELF_SERVE</p>
          <h2 className="plans-card-title plans-card-title-display">
            Join this <em>plan</em>
          </h2>
        </div>
      </div>
      <WalletGuard ready={canAct} />
      <StatusBanner status={status} />
      <p className="plans-card-body">
        This card uses the live canonical `open_member_position` flow for the connected wallet only.
      </p>
      {existingPosition ? (
        <div className="plans-notice liquid-glass" role="status">
          <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">person_check</span>
          <p>
            The connected wallet already has a member position for this plan
            {props.series ? " and the selected lane." : "."}
          </p>
        </div>
      ) : null}
      {requiresInviteAuthority && props.plan?.membershipInviteAuthority && props.plan.membershipInviteAuthority !== walletAddress ? (
        <div className="plans-notice liquid-glass" role="status">
          <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">info</span>
          <p>
            Invite-only enrollment must be submitted by the configured invite authority wallet:
            {" "}
            <span className="plans-table-mono">{props.plan.membershipInviteAuthority}</span>
          </p>
        </div>
      ) : null}
      <div className="plans-wizard-row">
        <Field label="CONNECTED_WALLET" value={walletAddress} onChange={() => undefined} />
        <Field
          label="SERIES_SCOPE"
          value={props.series?.displayName ?? "PLAN_ROOT"}
          onChange={() => undefined}
        />
      </div>
      <Field
        label="SUBJECT_COMMITMENT"
        value={subjectCommitment}
        onChange={setSubjectCommitment}
        placeholder="Optional hash seed or 32-byte hex"
      />
      {requiresTokenGate ? (
        <>
          <div className="plans-wizard-row">
            <Field
              label={usesStakeAnchor ? "STAKE_ANCHOR_ACCOUNT" : usesNftAnchor ? "TOKEN_ACCOUNT_WITH_NFT" : "TOKEN_GATE_ACCOUNT"}
              value={tokenGateAccount}
              onChange={setTokenGateAccount}
              placeholder="Token account owned by the connected wallet"
            />
            <Field
              label="TOKEN_GATE_SNAPSHOT"
              value={tokenGateSnapshot}
              onChange={setTokenGateSnapshot}
              placeholder="Observed balance snapshot"
            />
          </div>
          <p className="plans-card-body">
            Token-gated enrollment validates the provided token account against the plan gate before the member
            position opens.
          </p>
        </>
      ) : null}
      {requiresInviteAuthority ? (
        <div className="plans-wizard-row">
          <Field label="INVITE_REFERENCE" value={inviteId} onChange={setInviteId} placeholder="Invite code or digest seed" />
          <Field label="INVITE_EXPIRES_AT" value={inviteExpiresAt} onChange={setInviteExpiresAt} placeholder="Unix timestamp or 0" />
        </div>
      ) : null}
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-primary-cta"
          disabled={
            !canAct
            || Boolean(existingPosition)
            || (requiresTokenGate && !tokenGateAccount.trim())
            || (requiresInviteAuthority
              && props.plan?.membershipInviteAuthority
              && props.plan.membershipInviteAuthority !== walletAddress)
            || busy === "Open member position"
          }
          onClick={() => run("Open member position", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildOpenMemberPositionTx({
              wallet: publicKey!,
              healthPlanAddress: props.plan!.address,
              recentBlockhash: blockhash,
              seriesScopeAddress: props.series?.address ?? ZERO_PUBKEY,
              subjectCommitmentHashHex: await hashInputToHex(subjectCommitment),
              eligibilityStatus: ELIGIBILITY_ELIGIBLE,
              delegatedRightsMask: 0,
              proofMode,
              tokenGateAmountSnapshot: requiresTokenGate ? parseBigIntInput(tokenGateSnapshot) : 0n,
              inviteIdHashHex: requiresInviteAuthority ? await hashInputToHex(inviteId) : undefined,
              inviteExpiresAt: requiresInviteAuthority ? parseBigIntInput(inviteExpiresAt) : 0n,
              anchorRefAddress: usesNftAnchor
                ? props.plan!.membershipGateMint ?? undefined
                : usesStakeAnchor
                  ? tokenGateAccount
                  : undefined,
              tokenGateAccountAddress: requiresTokenGate ? tokenGateAccount : undefined,
              inviteAuthorityAddress: requiresInviteAuthority ? publicKey! : undefined,
            });
          })}
        >
          OPEN_MEMBER_POSITION
        </button>
      </div>
    </article>
  );
}

type ClaimIntakePanelProps = {
  plan: HealthPlanSnapshot | null;
  series: PolicySeriesSnapshot | null;
  members: MemberPositionSnapshot[];
  fundingLines: FundingLineSnapshot[];
  onRefresh?: () => Promise<void> | void;
};

export function ClaimIntakePanel(props: ClaimIntakePanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey && props.plan);
  const walletAddress = publicKey?.toBase58() ?? "";
  const selfMembers = useMemo(
    () => props.members.filter((member) => member.wallet === walletAddress),
    [props.members, walletAddress],
  );
  const [status, setStatus] = useState<ActionStatus>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [claimId, setClaimId] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [selectedMemberAddress, setSelectedMemberAddress] = useState("");
  const [selectedFundingLineAddress, setSelectedFundingLineAddress] = useState("");

  useEffect(() => {
    if (!claimId) setClaimId(`claim-${Date.now().toString(36)}`);
  }, [claimId]);

  useEffect(() => {
    setSelectedMemberAddress(selfMembers[0]?.address ?? "");
  }, [selfMembers]);

  useEffect(() => {
    setSelectedFundingLineAddress(props.fundingLines[0]?.address ?? "");
  }, [props.fundingLines]);

  const selectedMember = useMemo(
    () => selfMembers.find((member) => member.address === selectedMemberAddress) ?? selfMembers[0] ?? null,
    [selectedMemberAddress, selfMembers],
  );
  const selectedFundingLine = useMemo(
    () => props.fundingLines.find((line) => line.address === selectedFundingLineAddress) ?? props.fundingLines[0] ?? null,
    [props.fundingLines, selectedFundingLineAddress],
  );

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
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="plans-card heavy-glass">
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">CLAIM_SELF_SERVE</p>
          <h2 className="plans-card-title plans-card-title-display">
            Open a new <em>claim</em>
          </h2>
        </div>
      </div>
      <WalletGuard ready={canAct} />
      <StatusBanner status={status} />
      {selfMembers.length === 0 ? (
        <p className="plans-card-body">
          The connected wallet does not currently have an enrolled member position for this plan and selected lane.
        </p>
      ) : null}
      <div className="plans-wizard-row">
        <Field label="CLAIM_ID" value={claimId} onChange={setClaimId} />
        <Field label="CLAIMANT" value={walletAddress} onChange={() => undefined} />
      </div>
      <div className="plans-wizard-row">
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">MEMBER_POSITION</span>
          <span className="plans-wizard-field-bar">
            <select
              className="plans-wizard-input"
              value={selectedMember?.address ?? ""}
              onChange={(event) => setSelectedMemberAddress(event.target.value)}
            >
              {selfMembers.length === 0 ? <option value="">No member positions</option> : null}
              {selfMembers.map((member) => (
                <option key={member.address} value={member.address}>
                  {member.address.slice(0, 8)}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">FUNDING_LINE</span>
          <span className="plans-wizard-field-bar">
            <select
              className="plans-wizard-input"
              value={selectedFundingLine?.address ?? ""}
              onChange={(event) => setSelectedFundingLineAddress(event.target.value)}
            >
              {props.fundingLines.length === 0 ? <option value="">No funding lines</option> : null}
              {props.fundingLines.map((line) => (
                <option key={line.address} value={line.address}>
                  {line.displayName}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <Field label="INITIAL_EVIDENCE_REF" value={evidenceRef} onChange={setEvidenceRef} placeholder="URI, CID, or digest seed" />
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-primary-cta"
          disabled={!canAct || !selectedMember || !selectedFundingLine || busy === "Open claim case"}
          onClick={() => run("Open claim case", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildOpenClaimCaseTx({
              authority: publicKey!,
              healthPlanAddress: props.plan!.address,
              memberPositionAddress: selectedMember.address,
              fundingLineAddress: selectedFundingLine.address,
              recentBlockhash: blockhash,
              claimId,
              policySeriesAddress: props.series?.address ?? selectedFundingLine.policySeries ?? null,
              claimantAddress: publicKey!,
              evidenceRefHashHex: await hashInputToHex(evidenceRef),
            });
          })}
        >
          OPEN_CLAIM_CASE
        </button>
      </div>
    </article>
  );
}

type ClaimsOperatorPanelProps = {
  plan: HealthPlanSnapshot | null;
  series: PolicySeriesSnapshot | null;
  claimCases: ClaimCaseSnapshot[];
  obligations: Array<{
    address: string;
    fundingLine: string;
    claimCase?: string | null;
    policySeries?: string | null;
    capitalClass?: string | null;
    allocationPosition?: string | null;
    assetMint: string;
    status: number;
  }>;
  members: MemberPositionSnapshot[];
  fundingLines: FundingLineSnapshot[];
  allocations: AllocationPositionSnapshot[];
  classes: CapitalClassSnapshot[];
  pools: LiquidityPoolSnapshot[];
  selectedClaimAddress?: string | null;
  selectedPanel?: string | null;
  onSelectClaim?: (address: string | null) => void;
  onSelectPanel?: (panel: string) => void;
  onRefresh?: () => Promise<void> | void;
};

export function ClaimsOperatorPanel(props: ClaimsOperatorPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey && props.plan);
  const claimSelection = selectOptions(props.claimCases, props.selectedClaimAddress);
  const activePanel = props.selectedPanel === "reserve" || props.selectedPanel === "adjudication" || props.selectedPanel === "impairment"
    ? props.selectedPanel
    : "intake";

  const [status, setStatus] = useState<ActionStatus>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
  const [selectedFundingLineAddress, setSelectedFundingLineAddress] = useState("");
  const [selectedMemberAddress, setSelectedMemberAddress] = useState("");
  const [selectedObligationAddress, setSelectedObligationAddress] = useState("");

  useEffect(() => {
    if (publicKey && !claimant) setClaimant(publicKey.toBase58());
    if (publicKey && !beneficiary) setBeneficiary(publicKey.toBase58());
  }, [beneficiary, claimant, publicKey]);

  useEffect(() => {
    if (!claimId) setClaimId(`claim-${Date.now().toString(36)}`);
    if (!obligationId) setObligationId(`obl-${Date.now().toString(36)}`);
  }, [claimId, obligationId]);

  useEffect(() => {
    setSelectedFundingLineAddress(claimSelection?.fundingLine ?? props.fundingLines[0]?.address ?? "");
    setSelectedMemberAddress(claimSelection?.memberPosition ?? props.members[0]?.address ?? "");
    setSelectedObligationAddress(
      claimSelection?.linkedObligation
      ?? props.obligations.find((obligation) => obligation.address === claimSelection?.linkedObligation)?.address
      ?? props.obligations[0]?.address
      ?? "",
    );
    if (claimSelection) setSettleClaimAmount(String(claimSelection.approvedAmount ?? 0));
  }, [claimSelection, props.fundingLines, props.members, props.obligations]);

  const selectedFundingLine = useMemo(
    () => props.fundingLines.find((line) => line.address === selectedFundingLineAddress) ?? props.fundingLines[0] ?? null,
    [props.fundingLines, selectedFundingLineAddress],
  );
  const selectedMember = useMemo(
    () => props.members.find((member) => member.address === selectedMemberAddress) ?? props.members[0] ?? null,
    [props.members, selectedMemberAddress],
  );
  const selectedObligation = useMemo(
    () => props.obligations.find((obligation) => obligation.address === selectedObligationAddress) ?? null,
    [props.obligations, selectedObligationAddress],
  );
  const selectedAllocation = useMemo(
    () => props.allocations.find((allocation) => allocation.address === selectedObligation?.allocationPosition)
      ?? props.allocations.find((allocation) => allocation.fundingLine === selectedFundingLine?.address)
      ?? null,
    [props.allocations, selectedFundingLine?.address, selectedObligation?.allocationPosition],
  );
  const selectedClass = useMemo(
    () => props.classes.find((capitalClass) => capitalClass.address === (selectedObligation?.capitalClass ?? selectedAllocation?.capitalClass))
      ?? null,
    [props.classes, selectedAllocation?.capitalClass, selectedObligation?.capitalClass],
  );
  const selectedPool = useMemo(
    () => props.pools.find((pool) =>
      pool.address === (selectedClass?.liquidityPool ?? selectedAllocation?.liquidityPool),
    )
      ?? props.pools[0]
      ?? null,
    [props.pools, selectedAllocation?.liquidityPool, selectedClass?.liquidityPool],
  );

  async function run(label: string, factory: () => Promise<Transaction>) {
    if (!publicKey || !sendTransaction || !props.plan) return;
    setBusy(label);
    setStatus(null);
    try {
      const tx = await factory();
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label,
      });
      if (!result.ok) {
        setStatus({ tone: "error", message: result.error });
        return;
      }
      setStatus({ tone: "ok", message: result.message, explorerUrl: result.explorerUrl });
      await props.onRefresh?.();
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="plans-card heavy-glass">
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">CLAIM_OPERATOR_CONSOLE</p>
          <h2 className="plans-card-title plans-card-title-display">
            Claim and reserve <em>actions</em>
          </h2>
        </div>
        <div className="protocol-actions">
          {(["intake", "adjudication", "reserve", "impairment"] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              className={panel === activePanel ? "plans-primary-cta" : "plans-secondary-cta"}
              onClick={() => props.onSelectPanel?.(panel)}
            >
              {panel.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <WalletGuard ready={canAct} />
      <StatusBanner status={status} />

      <div className="plans-wizard-row">
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">CLAIM_CASE</span>
          <span className="plans-wizard-field-bar">
            <select
              className="plans-wizard-input"
              value={claimSelection?.address ?? ""}
              onChange={(event) => props.onSelectClaim?.(event.target.value || null)}
            >
              {props.claimCases.length === 0 ? <option value="">No claims</option> : null}
              {props.claimCases.map((claim) => (
                <option key={claim.address} value={claim.address}>
                  {claim.claimId}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">OBLIGATION</span>
          <span className="plans-wizard-field-bar">
            <select
              className="plans-wizard-input"
              value={selectedObligationAddress}
              onChange={(event) => setSelectedObligationAddress(event.target.value)}
            >
              {props.obligations.length === 0 ? <option value="">No obligations</option> : null}
              {props.obligations.map((obligation) => (
                <option key={obligation.address} value={obligation.address}>
                  {obligation.address.slice(0, 8)}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      {activePanel === "intake" ? (
        <>
          <div className="plans-wizard-row">
            <Field label="CLAIM_ID" value={claimId} onChange={setClaimId} />
            <Field label="CLAIMANT" value={claimant} onChange={setClaimant} />
          </div>
          <div className="plans-wizard-row">
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">MEMBER_POSITION</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={selectedMemberAddress} onChange={(event) => setSelectedMemberAddress(event.target.value)}>
                  {props.members.map((member) => (
                    <option key={member.address} value={member.address}>{member.wallet.slice(0, 8)}</option>
                  ))}
                </select>
              </span>
            </label>
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">FUNDING_LINE</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={selectedFundingLineAddress} onChange={(event) => setSelectedFundingLineAddress(event.target.value)}>
                  {props.fundingLines.map((line) => (
                    <option key={line.address} value={line.address}>{line.displayName}</option>
                  ))}
                </select>
              </span>
            </label>
          </div>
          <Field label="EVIDENCE_REF" value={evidenceRef} onChange={setEvidenceRef} placeholder="URI, CID, or digest seed" />
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-primary-cta"
              disabled={!canAct || !selectedMember || !selectedFundingLine || busy === "Open claim case"}
              onClick={() => run("Open claim case", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildOpenClaimCaseTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  memberPositionAddress: selectedMember.address,
                  fundingLineAddress: selectedFundingLine.address,
                  recentBlockhash: blockhash,
                  claimId,
                  policySeriesAddress: props.series?.address ?? selectedFundingLine.policySeries ?? null,
                  claimantAddress: claimant || publicKey!,
                  evidenceRefHashHex: await hashInputToHex(evidenceRef),
                });
              })}
            >
              <span className="material-symbols-outlined">add_circle</span>
              {busy === "Open claim case" ? "SUBMITTING" : "OPEN_CLAIM_CASE"}
            </button>
          </div>
        </>
      ) : null}

      {activePanel === "adjudication" ? (
        <>
          <div className="plans-wizard-row">
            <Field label="EVIDENCE_REF" value={evidenceRef} onChange={setEvidenceRef} />
            <Field label="DECISION_SUPPORT" value={decisionSupport} onChange={setDecisionSupport} />
          </div>
          <div className="plans-wizard-row">
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">REVIEW_STATE</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={reviewState} onChange={(event) => setReviewState(event.target.value)}>
                  <option value={String(CLAIM_INTAKE_UNDER_REVIEW)}>UNDER_REVIEW</option>
                  <option value={String(CLAIM_INTAKE_APPROVED)}>APPROVED</option>
                  <option value={String(CLAIM_INTAKE_DENIED)}>DENIED</option>
                </select>
              </span>
            </label>
            <Field label="APPROVED_AMOUNT" value={approvedAmount} onChange={setApprovedAmount} />
          </div>
          <div className="plans-wizard-row">
            <Field label="DENIED_AMOUNT" value={deniedAmount} onChange={setDeniedAmount} />
            <Field label="RESERVE_AMOUNT" value={reserveAmount} onChange={setReserveAmount} />
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-secondary-cta"
              disabled={!canAct || !claimSelection || busy === "Attach evidence"}
              onClick={() => run("Attach evidence", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildAttachClaimEvidenceRefTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  claimCaseAddress: claimSelection!.address,
                  recentBlockhash: blockhash,
                  evidenceRefHashHex: await hashInputToHex(evidenceRef),
                  decisionSupportHashHex: await hashInputToHex(decisionSupport),
                });
              })}
            >
              ATTACH_EVIDENCE
            </button>
            <button
              type="button"
              className="plans-primary-cta"
              disabled={!canAct || !claimSelection || busy === "Adjudicate claim"}
              onClick={() => run("Adjudicate claim", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildAdjudicateClaimCaseTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  claimCaseAddress: claimSelection!.address,
                  recentBlockhash: blockhash,
                  reviewState: Number.parseInt(reviewState, 10) || CLAIM_INTAKE_UNDER_REVIEW,
                  approvedAmount: parseBigIntInput(approvedAmount),
                  deniedAmount: parseBigIntInput(deniedAmount),
                  reserveAmount: parseBigIntInput(reserveAmount),
                  decisionSupportHashHex: await hashInputToHex(decisionSupport),
                  obligationAddress: selectedObligation?.address ?? null,
                });
              })}
            >
              ADJUDICATE
            </button>
          </div>
        </>
      ) : null}

      {activePanel === "reserve" ? (
        <>
          <div className="plans-wizard-row">
            <Field label="OBLIGATION_ID" value={obligationId} onChange={setObligationId} />
            <Field label="BENEFICIARY" value={beneficiary} onChange={setBeneficiary} />
          </div>
          <div className="plans-wizard-row">
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">DELIVERY_MODE</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value)}>
                  <option value={String(OBLIGATION_DELIVERY_MODE_CLAIMABLE)}>CLAIMABLE</option>
                  <option value="1">PAYABLE</option>
                </select>
              </span>
            </label>
            <Field label="OBLIGATION_AMOUNT" value={obligationAmount} onChange={setObligationAmount} />
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-secondary-cta"
              disabled={!canAct || !selectedFundingLine || busy === "Create obligation"}
              onClick={() => run("Create obligation", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildCreateObligationTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  reserveDomainAddress: props.plan!.reserveDomain,
                  fundingLineAddress: selectedFundingLine!.address,
                  assetMint: selectedFundingLine!.assetMint,
                  recentBlockhash: blockhash,
                  obligationId,
                  policySeriesAddress: props.series?.address ?? selectedFundingLine!.policySeries ?? null,
                  memberWalletAddress: selectedMember?.wallet ?? claimSelection?.claimant ?? null,
                  beneficiaryAddress: beneficiary || publicKey!,
                  claimCaseAddress: claimSelection?.address ?? null,
                  liquidityPoolAddress: selectedPool?.address ?? null,
                  capitalClassAddress: selectedClass?.address ?? null,
                  allocationPositionAddress: selectedAllocation?.address ?? null,
                  deliveryMode: Number.parseInt(deliveryMode, 10) || OBLIGATION_DELIVERY_MODE_CLAIMABLE,
                  amount: parseBigIntInput(obligationAmount),
                  creationReasonHashHex: await hashInputToHex(`${claimId}:${decisionSupport || evidenceRef || obligationId}`),
                  poolAssetMint: selectedPool?.depositAssetMint ?? null,
                });
              })}
            >
              CREATE_OBLIGATION
            </button>
          </div>

          <div className="plans-wizard-row">
            <Field label="RESERVE_FLOW_AMOUNT" value={reserveFlowAmount} onChange={setReserveFlowAmount} />
            <Field label="SETTLE_CLAIM_AMOUNT" value={settleClaimAmount} onChange={setSettleClaimAmount} />
          </div>
          <div className="plans-wizard-row">
            <Field label="SETTLE_OBLIGATION_AMOUNT" value={settleObligationAmount} onChange={setSettleObligationAmount} />
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">NEXT_OBLIGATION_STATUS</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={settleObligationStatus} onChange={(event) => setSettleObligationStatus(event.target.value)}>
                  <option value={String(OBLIGATION_STATUS_CLAIMABLE_PAYABLE)}>CLAIMABLE_PAYABLE</option>
                  <option value={String(OBLIGATION_STATUS_SETTLED)}>SETTLED</option>
                  <option value={String(OBLIGATION_STATUS_CANCELED)}>CANCELED</option>
                </select>
              </span>
            </label>
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-secondary-cta"
              disabled={!canAct || !selectedObligation || !selectedFundingLine || busy === "Reserve obligation"}
              onClick={() => run("Reserve obligation", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildReserveObligationTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  reserveDomainAddress: props.plan!.reserveDomain,
                  fundingLineAddress: selectedFundingLine!.address,
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
              })}
            >
              RESERVE
            </button>
            <button
              type="button"
              className="plans-secondary-cta"
              disabled={!canAct || !selectedObligation || !selectedFundingLine || busy === "Release reserve"}
              onClick={() => run("Release reserve", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildReleaseReserveTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  reserveDomainAddress: props.plan!.reserveDomain,
                  fundingLineAddress: selectedFundingLine!.address,
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
              })}
            >
              RELEASE
            </button>
            <button
              type="button"
              className="plans-secondary-cta"
              disabled={!canAct || !claimSelection || !selectedFundingLine || busy === "Settle claim"}
              onClick={() => run("Settle claim", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildSettleClaimCaseTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  reserveDomainAddress: props.plan!.reserveDomain,
                  fundingLineAddress: selectedFundingLine!.address,
                  assetMint: selectedFundingLine!.assetMint,
                  claimCaseAddress: claimSelection!.address,
                  recentBlockhash: blockhash,
                  amount: parseBigIntInput(settleClaimAmount),
                  policySeriesAddress: claimSelection!.policySeries ?? null,
                  obligationAddress: selectedObligation?.address ?? null,
                  capitalClassAddress: selectedObligation?.capitalClass ?? null,
                  allocationPositionAddress: selectedObligation?.allocationPosition ?? null,
                  poolAssetMint: selectedPool?.depositAssetMint ?? null,
                });
              })}
            >
              SETTLE_CLAIM
            </button>
            <button
              type="button"
              className="plans-primary-cta"
              disabled={!canAct || !selectedObligation || !selectedFundingLine || busy === "Settle obligation"}
              onClick={() => run("Settle obligation", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildSettleObligationTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  reserveDomainAddress: props.plan!.reserveDomain,
                  fundingLineAddress: selectedFundingLine!.address,
                  assetMint: selectedObligation!.assetMint,
                  obligationAddress: selectedObligation!.address,
                  recentBlockhash: blockhash,
                  nextStatus: Number.parseInt(settleObligationStatus, 10) || OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
                  amount: parseBigIntInput(settleObligationAmount),
                  settlementReasonHashHex: await hashInputToHex(decisionSupport || evidenceRef || obligationId),
                  claimCaseAddress: selectedObligation!.claimCase ?? null,
                  policySeriesAddress: selectedObligation!.policySeries ?? null,
                  capitalClassAddress: selectedObligation!.capitalClass ?? null,
                  allocationPositionAddress: selectedObligation!.allocationPosition ?? null,
                  poolAssetMint: selectedPool?.depositAssetMint ?? null,
                });
              })}
            >
              SETTLE_OBLIGATION
            </button>
          </div>
        </>
      ) : null}

      {activePanel === "impairment" ? (
        <>
          <div className="plans-wizard-row">
            <Field label="IMPAIRMENT_AMOUNT" value={impairmentAmount} onChange={setImpairmentAmount} />
            <Field label="IMPAIRMENT_REASON" value={impairmentReason} onChange={setImpairmentReason} placeholder="Reason hash seed or 32-byte hex" />
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-primary-cta"
              disabled={!canAct || !selectedFundingLine || busy === "Mark impairment"}
              onClick={() => run("Mark impairment", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildMarkImpairmentTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  reserveDomainAddress: props.plan!.reserveDomain,
                  fundingLineAddress: selectedFundingLine.address,
                  assetMint: selectedObligation?.assetMint ?? selectedFundingLine.assetMint,
                  recentBlockhash: blockhash,
                  amount: parseBigIntInput(impairmentAmount),
                  reasonHashHex: await hashInputToHex(impairmentReason),
                  policySeriesAddress: selectedObligation?.policySeries ?? selectedFundingLine.policySeries ?? null,
                  capitalClassAddress: selectedObligation?.capitalClass ?? selectedClass?.address ?? null,
                  allocationPositionAddress: selectedObligation?.allocationPosition ?? selectedAllocation?.address ?? null,
                  obligationAddress: selectedObligation?.address ?? null,
                  poolAssetMint: selectedPool?.depositAssetMint ?? null,
                });
              })}
            >
              MARK_IMPAIRMENT
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

type MembersOperatorPanelProps = {
  plan: HealthPlanSnapshot | null;
  series: PolicySeriesSnapshot | null;
  members: MemberPositionSnapshot[];
  selectedMemberAddress?: string | null;
  selectedPanel?: string | null;
  onSelectMember?: (address: string | null) => void;
  onSelectPanel?: (panel: string) => void;
  onRefresh?: () => Promise<void> | void;
};

export function MembersOperatorPanel(props: MembersOperatorPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey && props.plan);
  const selectedMember = selectOptions(props.members, props.selectedMemberAddress);
  const activePanel = props.selectedPanel === "review" ? "review" : "enroll";
  const [status, setStatus] = useState<ActionStatus>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [subjectCommitment, setSubjectCommitment] = useState("");
  const [inviteId, setInviteId] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("0");
  const [eligibilityStatus, setEligibilityStatus] = useState(String(ELIGIBILITY_PENDING));
  const [proofMode, setProofMode] = useState("0");
  const [tokenGateAmountSnapshot, setTokenGateAmountSnapshot] = useState("0");
  const [rights, setRights] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (publicKey && !walletAddress) setWalletAddress(publicKey.toBase58());
  }, [publicKey, walletAddress]);

  useEffect(() => {
    if (selectedMember) {
      setEligibilityStatus(String(selectedMember.eligibilityStatus));
      setRights(selectedMember.delegatedRights);
      setActive(selectedMember.active);
    }
  }, [selectedMember]);

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
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusy(null);
    }
  }

  const delegatedRightsMask = rights.reduce((mask, right) => {
    const index = MEMBER_DELEGATED_RIGHT_FLAGS.indexOf(right as (typeof MEMBER_DELEGATED_RIGHT_FLAGS)[number]);
    return index >= 0 ? (mask | (1 << index)) : mask;
  }, 0);

  return (
    <article className="plans-card heavy-glass">
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">MEMBERSHIP_OPERATOR_CONSOLE</p>
          <h2 className="plans-card-title plans-card-title-display">
            Enrollment and delegation <em>actions</em>
          </h2>
        </div>
        <div className="protocol-actions">
          {(["enroll", "review"] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              className={panel === activePanel ? "plans-primary-cta" : "plans-secondary-cta"}
              onClick={() => props.onSelectPanel?.(panel)}
            >
              {panel.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <WalletGuard ready={canAct} />
      <StatusBanner status={status} />

      <label className="plans-wizard-field-group">
        <span className="plans-wizard-field-label">SELECTED_MEMBER</span>
        <span className="plans-wizard-field-bar">
          <select
            className="plans-wizard-input"
            value={selectedMember?.address ?? ""}
            onChange={(event) => props.onSelectMember?.(event.target.value || null)}
          >
            {props.members.length === 0 ? <option value="">No members</option> : null}
            {props.members.map((member) => (
              <option key={member.address} value={member.address}>{member.wallet.slice(0, 8)}</option>
            ))}
          </select>
        </span>
      </label>

      {activePanel === "enroll" ? (
        <>
          <div className="plans-wizard-row">
            <Field label="WALLET" value={walletAddress} onChange={setWalletAddress} />
            <Field label="SUBJECT_COMMITMENT" value={subjectCommitment} onChange={setSubjectCommitment} placeholder="Hash seed or 32-byte hex" />
          </div>
          <div className="plans-wizard-row">
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">ELIGIBILITY</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={eligibilityStatus} onChange={(event) => setEligibilityStatus(event.target.value)}>
                  <option value={String(ELIGIBILITY_PENDING)}>PENDING</option>
                  <option value={String(ELIGIBILITY_ELIGIBLE)}>ELIGIBLE</option>
                </select>
              </span>
            </label>
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">PROOF_MODE</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={proofMode} onChange={(event) => setProofMode(event.target.value)}>
                  <option value="0">OPEN</option>
                  <option value="1">TOKEN_GATE</option>
                  <option value="2">INVITE_PERMIT</option>
                </select>
              </span>
            </label>
          </div>
          <div className="plans-wizard-row">
            <Field label="TOKEN_GATE_SNAPSHOT" value={tokenGateAmountSnapshot} onChange={setTokenGateAmountSnapshot} />
            <Field label="INVITE_ID" value={inviteId} onChange={setInviteId} />
          </div>
          <Field label="INVITE_EXPIRES_AT" value={inviteExpiresAt} onChange={setInviteExpiresAt} />
          <div className="plans-settings-grid">
            {MEMBER_DELEGATED_RIGHT_FLAGS.map((right) => (
              <ToggleRow
                key={right}
                label={right}
                checked={rights.includes(right)}
                onChange={(checked) => setRights((current) => checked ? [...new Set([...current, right])] : current.filter((entry) => entry !== right))}
              />
            ))}
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-primary-cta"
              disabled={!canAct || busy === "Open member position"}
              onClick={() => run("Open member position", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildOpenMemberPositionTx({
                  wallet: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  recentBlockhash: blockhash,
                  seriesScopeAddress: props.series?.address ?? ZERO_PUBKEY,
                  subjectCommitmentHashHex: await hashInputToHex(subjectCommitment),
                  eligibilityStatus: Number.parseInt(eligibilityStatus, 10) || ELIGIBILITY_PENDING,
                  delegatedRightsMask,
                  proofMode: Number.parseInt(proofMode, 10) || 0,
                  tokenGateAmountSnapshot: parseBigIntInput(tokenGateAmountSnapshot),
                  inviteIdHashHex: await hashInputToHex(inviteId),
                  inviteExpiresAt: parseBigIntInput(inviteExpiresAt),
                });
              })}
            >
              OPEN_MEMBER_POSITION
            </button>
          </div>
        </>
      ) : null}

      {activePanel === "review" ? (
        <>
          <div className="plans-wizard-row">
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">ELIGIBILITY</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={eligibilityStatus} onChange={(event) => setEligibilityStatus(event.target.value)}>
                  <option value={String(ELIGIBILITY_PENDING)}>PENDING</option>
                  <option value={String(ELIGIBILITY_ELIGIBLE)}>ELIGIBLE</option>
                  <option value="2">PAUSED</option>
                  <option value="3">CLOSED</option>
                </select>
              </span>
            </label>
            <ToggleRow label="ACTIVE" checked={active} onChange={setActive} />
          </div>
          <div className="plans-settings-grid">
            {MEMBER_DELEGATED_RIGHT_FLAGS.map((right) => (
              <ToggleRow
                key={right}
                label={right}
                checked={rights.includes(right)}
                onChange={(checked) => setRights((current) => checked ? [...new Set([...current, right])] : current.filter((entry) => entry !== right))}
              />
            ))}
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-primary-cta"
              disabled={!canAct || !selectedMember || busy === "Update member eligibility"}
              onClick={() => run("Update member eligibility", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildUpdateMemberEligibilityTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  walletAddress: selectedMember!.wallet,
                  recentBlockhash: blockhash,
                  seriesScopeAddress: selectedMember!.policySeries,
                  eligibilityStatus: Number.parseInt(eligibilityStatus, 10) || ELIGIBILITY_PENDING,
                  delegatedRightsMask,
                  active,
                });
              })}
            >
              UPDATE_ELIGIBILITY
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

type TreasuryOperatorPanelProps = {
  plan: HealthPlanSnapshot | null;
  series: PolicySeriesSnapshot | null;
  seriesOptions: PolicySeriesSnapshot[];
  reserveDomain: ReserveDomainSnapshot | null;
  fundingLines: FundingLineSnapshot[];
  allocations: AllocationPositionSnapshot[];
  classes: CapitalClassSnapshot[];
  pools: LiquidityPoolSnapshot[];
  selectedFundingLineAddress?: string | null;
  onSelectFundingLine?: (address: string) => void;
  onRefresh?: () => Promise<void> | void;
};

export function TreasuryOperatorPanel(props: TreasuryOperatorPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey && props.plan && props.reserveDomain);
  const [status, setStatus] = useState<ActionStatus>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fundingLineAddress, setFundingLineAddress] = useState(
    props.selectedFundingLineAddress ?? props.fundingLines[0]?.address ?? "",
  );
  const [amount, setAmount] = useState("0");
  const [planPauseFlags, setPlanPauseFlags] = useState(String(props.plan?.pauseFlags ?? 0));
  const [domainPauseFlags, setDomainPauseFlags] = useState(String(props.reserveDomain?.pauseFlags ?? 0));
  const [allowedRailMask, setAllowedRailMask] = useState("0");
  const [domainAllowedRailMask, setDomainAllowedRailMask] = useState("65535");
  const [seriesId, setSeriesId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [cycleSeconds, setCycleSeconds] = useState("0");
  const [active, setActive] = useState(props.plan?.active ?? true);
  const [domainActive, setDomainActive] = useState(props.reserveDomain?.active ?? true);
  const [newSeriesId, setNewSeriesId] = useState("");
  const [newSeriesDisplayName, setNewSeriesDisplayName] = useState("");
  const [newSeriesMetadataUri, setNewSeriesMetadataUri] = useState("");
  const [newSeriesAssetMint, setNewSeriesAssetMint] = useState("");
  const [newSeriesMode, setNewSeriesMode] = useState(String(props.series?.mode ?? SERIES_MODE_PROTECTION));
  const [newSeriesStatus, setNewSeriesStatus] = useState(String(props.series?.status ?? SERIES_STATUS_ACTIVE));
  const [newSeriesCycleSeconds, setNewSeriesCycleSeconds] = useState("0");
  const [newFundingLineId, setNewFundingLineId] = useState("");
  const [newFundingLineAssetMint, setNewFundingLineAssetMint] = useState("");
  const [newFundingLineType, setNewFundingLineType] = useState(String(FUNDING_LINE_TYPE_SPONSOR_BUDGET));
  const [newFundingPriority, setNewFundingPriority] = useState("0");
  const [newFundingCommittedAmount, setNewFundingCommittedAmount] = useState("0");
  const [selectedFundingSeriesAddress, setSelectedFundingSeriesAddress] = useState("");

  useEffect(() => {
    setFundingLineAddress(props.selectedFundingLineAddress ?? props.fundingLines[0]?.address ?? "");
    setPlanPauseFlags(String(props.plan?.pauseFlags ?? 0));
    setAllowedRailMask("0");
    setDomainPauseFlags(String(props.reserveDomain?.pauseFlags ?? 0));
    setDomainAllowedRailMask(String(65535));
    setActive(props.plan?.active ?? true);
    setDomainActive(props.reserveDomain?.active ?? true);
    setSeriesId(props.series ? `${props.series.seriesId}-next` : "");
    setDisplayName(props.series?.displayName ?? props.plan?.displayName ?? "");
    setMetadataUri(props.series?.metadataUri ?? "");
    setCycleSeconds(String(props.series?.cycleSeconds ?? 0));
    setNewSeriesId(props.series ? `${props.series.seriesId}-alt` : "");
    setNewSeriesDisplayName(props.plan ? `${props.plan.displayName} Series` : "");
    setNewSeriesMetadataUri(props.series?.metadataUri ?? "");
    setNewSeriesAssetMint(props.series?.assetMint ?? props.fundingLines[0]?.assetMint ?? "");
    setNewSeriesMode(String(props.series?.mode ?? SERIES_MODE_PROTECTION));
    setNewSeriesStatus(String(props.series?.status ?? SERIES_STATUS_ACTIVE));
    setNewSeriesCycleSeconds(String(props.series?.cycleSeconds ?? 0));
    setNewFundingLineId(props.series ? `${props.series.seriesId}-line` : "");
    setNewFundingLineAssetMint(props.series?.assetMint ?? props.fundingLines[0]?.assetMint ?? "");
    setNewFundingLineType(String(props.series?.mode === SERIES_MODE_PROTECTION ? FUNDING_LINE_TYPE_PREMIUM_INCOME : FUNDING_LINE_TYPE_SPONSOR_BUDGET));
    setNewFundingPriority(String(props.fundingLines[0]?.fundingPriority ?? 0));
    setSelectedFundingSeriesAddress(props.series?.address ?? "");
  }, [props.fundingLines, props.plan, props.reserveDomain, props.selectedFundingLineAddress, props.series]);

  const selectedFundingLine = useMemo(
    () => props.fundingLines.find((line) => line.address === fundingLineAddress) ?? props.fundingLines[0] ?? null,
    [fundingLineAddress, props.fundingLines],
  );
  const selectedAllocation = useMemo(
    () => props.allocations.find((allocation) => allocation.fundingLine === selectedFundingLine?.address) ?? null,
    [props.allocations, selectedFundingLine?.address],
  );
  const selectedClass = useMemo(
    () => props.classes.find((capitalClass) => capitalClass.address === selectedAllocation?.capitalClass) ?? null,
    [props.classes, selectedAllocation?.capitalClass],
  );
  const selectedPool = useMemo(
    () => props.pools.find((pool) => pool.address === selectedAllocation?.liquidityPool) ?? null,
    [props.pools, selectedAllocation?.liquidityPool],
  );
  const selectedFundingSeries = useMemo(
    () => props.seriesOptions.find((entry) => entry.address === selectedFundingSeriesAddress) ?? null,
    [props.seriesOptions, selectedFundingSeriesAddress],
  );

  async function run(label: string, factory: () => Promise<Transaction>) {
    if (!publicKey || !sendTransaction) return;
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
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="plans-card heavy-glass">
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">TREASURY_OPERATOR_CONSOLE</p>
          <h2 className="plans-card-title plans-card-title-display">
            Funding and control <em>actions</em>
          </h2>
        </div>
      </div>
      <WalletGuard ready={canAct} />
      <StatusBanner status={status} />

      <div className="plans-wizard-row">
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">FUNDING_LINE</span>
          <span className="plans-wizard-field-bar">
            <select
              className="plans-wizard-input"
              value={fundingLineAddress}
              onChange={(event) => {
                setFundingLineAddress(event.target.value);
                props.onSelectFundingLine?.(event.target.value);
              }}
            >
              {props.fundingLines.map((line) => (
                <option key={line.address} value={line.address}>{line.displayName}</option>
              ))}
            </select>
          </span>
        </label>
        <Field label="AMOUNT" value={amount} onChange={setAmount} />
      </div>
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !selectedFundingLine || selectedFundingLine.lineType !== FUNDING_LINE_TYPE_SPONSOR_BUDGET || busy === "Fund sponsor budget"}
          onClick={() => run("Fund sponsor budget", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildFundSponsorBudgetTx({
              authority: publicKey!,
              healthPlanAddress: props.plan!.address,
              reserveDomainAddress: props.plan!.reserveDomain,
              fundingLineAddress: selectedFundingLine!.address,
              assetMint: selectedFundingLine!.assetMint,
              recentBlockhash: blockhash,
              amount: parseBigIntInput(amount),
              policySeriesAddress: selectedFundingLine!.policySeries ?? null,
            });
          })}
        >
          FUND_SPONSOR_BUDGET
        </button>
        <button
          type="button"
          className="plans-primary-cta"
          disabled={!canAct || !selectedFundingLine || selectedFundingLine.lineType !== FUNDING_LINE_TYPE_PREMIUM_INCOME || busy === "Record premium payment"}
          onClick={() => run("Record premium payment", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildRecordPremiumPaymentTx({
              authority: publicKey!,
              healthPlanAddress: props.plan!.address,
              reserveDomainAddress: props.plan!.reserveDomain,
              fundingLineAddress: selectedFundingLine!.address,
              assetMint: selectedFundingLine!.assetMint,
              recentBlockhash: blockhash,
              amount: parseBigIntInput(amount),
              policySeriesAddress: selectedFundingLine!.policySeries ?? null,
              capitalClassAddress: selectedClass?.address ?? null,
              poolAssetMint: selectedPool?.depositAssetMint ?? null,
            });
          })}
        >
          RECORD_PREMIUM
        </button>
      </div>

      <div className="plans-wizard-divider" />

      <div className="plans-wizard-row">
        <Field label="PLAN_ALLOWED_RAIL_MASK" value={allowedRailMask} onChange={setAllowedRailMask} />
        <Field label="PLAN_PAUSE_FLAGS" value={planPauseFlags} onChange={setPlanPauseFlags} />
      </div>
      <ToggleRow label="PLAN_ACTIVE" checked={active} onChange={setActive} />
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || busy === "Update plan controls"}
          onClick={() => run("Update plan controls", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildUpdateHealthPlanControlsTx({
              authority: publicKey!,
              healthPlanAddress: props.plan!.address,
              recentBlockhash: blockhash,
              sponsorOperator: props.plan!.sponsorOperator,
              claimsOperator: props.plan!.claimsOperator,
              oracleAuthority: props.plan!.oracleAuthority ?? ZERO_PUBKEY,
              membershipMode: props.plan!.membershipModel === "open" ? 0 : props.plan!.membershipModel === "invite_only" ? 2 : 1,
              membershipGateKind: props.plan!.membershipGateKind === "invite_only" ? 1 : props.plan!.membershipModel === "token_gate" ? 4 : 0,
              membershipGateMint: props.plan!.membershipGateMint ?? ZERO_PUBKEY,
              membershipGateMinAmount: BigInt(props.plan!.membershipGateMinAmount ?? 0),
              membershipInviteAuthority: props.plan!.membershipInviteAuthority ?? ZERO_PUBKEY,
              allowedRailMask: Number.parseInt(allowedRailMask, 10) || 0,
              defaultFundingPriority: props.fundingLines[0]?.fundingPriority ?? 0,
              pauseFlags: Number.parseInt(planPauseFlags, 10) || 0,
              active,
            });
          })}
        >
          UPDATE_PLAN_CONTROLS
        </button>
      </div>

      <div className="plans-wizard-row">
        <Field label="DOMAIN_ALLOWED_RAIL_MASK" value={domainAllowedRailMask} onChange={setDomainAllowedRailMask} />
        <Field label="DOMAIN_PAUSE_FLAGS" value={domainPauseFlags} onChange={setDomainPauseFlags} />
      </div>
      <ToggleRow label="DOMAIN_ACTIVE" checked={domainActive} onChange={setDomainActive} />
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.reserveDomain || busy === "Update reserve domain"}
          onClick={() => run("Update reserve domain", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildUpdateReserveDomainControlsTx({
              authority: publicKey!,
              reserveDomainAddress: props.reserveDomain!.address,
              recentBlockhash: blockhash,
              allowedRailMask: Number.parseInt(domainAllowedRailMask, 10) || 0,
              pauseFlags: Number.parseInt(domainPauseFlags, 10) || 0,
              active: domainActive,
            });
          })}
        >
          UPDATE_DOMAIN_CONTROLS
        </button>
      </div>

      <>
          <div className="plans-wizard-divider" />
          <div className="plans-wizard-row">
            <Field label="NEW_SERIES_ID" value={newSeriesId} onChange={setNewSeriesId} />
            <Field label="NEW_SERIES_DISPLAY_NAME" value={newSeriesDisplayName} onChange={setNewSeriesDisplayName} />
          </div>
          <div className="plans-wizard-row">
            <Field label="NEW_SERIES_METADATA_URI" value={newSeriesMetadataUri} onChange={setNewSeriesMetadataUri} />
            <Field label="NEW_SERIES_ASSET_MINT" value={newSeriesAssetMint} onChange={setNewSeriesAssetMint} />
          </div>
          <div className="plans-wizard-row">
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">NEW_SERIES_MODE</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={newSeriesMode} onChange={(event) => setNewSeriesMode(event.target.value)}>
                  <option value={String(SERIES_MODE_REWARD)}>REWARD</option>
                  <option value={String(SERIES_MODE_PROTECTION)}>PROTECTION</option>
                  <option value={String(SERIES_MODE_REIMBURSEMENT)}>REIMBURSEMENT</option>
                  <option value={String(SERIES_MODE_PARAMETRIC)}>PARAMETRIC</option>
                  <option value={String(SERIES_MODE_OTHER)}>OTHER</option>
                </select>
              </span>
            </label>
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">NEW_SERIES_STATUS</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={newSeriesStatus} onChange={(event) => setNewSeriesStatus(event.target.value)}>
                  <option value={String(SERIES_STATUS_DRAFT)}>DRAFT</option>
                  <option value={String(SERIES_STATUS_ACTIVE)}>ACTIVE</option>
                  <option value={String(SERIES_STATUS_PAUSED)}>PAUSED</option>
                  <option value={String(SERIES_STATUS_CLOSED)}>CLOSED</option>
                </select>
              </span>
            </label>
          </div>
          <div className="plans-wizard-row">
            <Field label="NEW_SERIES_CYCLE_SECONDS" value={newSeriesCycleSeconds} onChange={setNewSeriesCycleSeconds} />
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-secondary-cta"
              disabled={!canAct || !newSeriesAssetMint || busy === "Create policy series"}
              onClick={() => run("Create policy series", async () => {
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
              })}
            >
              CREATE_POLICY_SERIES
            </button>
          </div>

          {props.series ? (
            <>
              <div className="plans-wizard-divider" />
              <div className="plans-wizard-row">
                <Field label="NEXT_SERIES_ID" value={seriesId} onChange={setSeriesId} />
                <Field label="DISPLAY_NAME" value={displayName} onChange={setDisplayName} />
              </div>
              <div className="plans-wizard-row">
                <Field label="METADATA_URI" value={metadataUri} onChange={setMetadataUri} />
                <Field label="CYCLE_SECONDS" value={cycleSeconds} onChange={setCycleSeconds} />
              </div>
              <div className="protocol-actions">
                <button
                  type="button"
                  className="plans-primary-cta"
                  disabled={!canAct || busy === "Version policy series"}
                  onClick={() => run("Version policy series", async () => {
                    const { blockhash } = await connection.getLatestBlockhash("confirmed");
                    return buildVersionPolicySeriesTx({
                      authority: publicKey!,
                      healthPlanAddress: props.plan!.address,
                      currentPolicySeriesAddress: props.series!.address,
                      assetMint: props.series!.assetMint,
                      recentBlockhash: blockhash,
                      seriesId,
                      displayName,
                      metadataUri,
                      status: props.series!.status,
                      adjudicationMode: 0,
                      cycleSeconds: parseBigIntInput(cycleSeconds),
                    });
                  })}
                >
                  VERSION_POLICY_SERIES
                </button>
              </div>
            </>
          ) : null}

          <div className="plans-wizard-divider" />
          <div className="plans-wizard-row">
            <Field label="NEW_FUNDING_LINE_ID" value={newFundingLineId} onChange={setNewFundingLineId} />
            <Field label="NEW_FUNDING_LINE_ASSET_MINT" value={newFundingLineAssetMint} onChange={setNewFundingLineAssetMint} />
          </div>
          <div className="plans-wizard-row">
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">POLICY_SERIES</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={selectedFundingSeriesAddress} onChange={(event) => setSelectedFundingSeriesAddress(event.target.value)}>
                  <option value="">PLAN_ROOT</option>
                  {props.seriesOptions.map((entry) => (
                    <option key={entry.address} value={entry.address}>{entry.displayName}</option>
                  ))}
                </select>
              </span>
            </label>
            <label className="plans-wizard-field-group">
              <span className="plans-wizard-field-label">LINE_TYPE</span>
              <span className="plans-wizard-field-bar">
                <select className="plans-wizard-input" value={newFundingLineType} onChange={(event) => setNewFundingLineType(event.target.value)}>
                  <option value={String(FUNDING_LINE_TYPE_SPONSOR_BUDGET)}>SPONSOR_BUDGET</option>
                  <option value={String(FUNDING_LINE_TYPE_PREMIUM_INCOME)}>PREMIUM_INCOME</option>
                  <option value={String(FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION)}>POOL_ALLOCATION</option>
                  <option value={String(FUNDING_LINE_TYPE_BACKSTOP)}>BACKSTOP</option>
                  <option value={String(FUNDING_LINE_TYPE_SUBSIDY)}>SUBSIDY</option>
                </select>
              </span>
            </label>
          </div>
          <div className="plans-wizard-row">
            <Field label="FUNDING_PRIORITY" value={newFundingPriority} onChange={setNewFundingPriority} />
            <Field label="COMMITTED_AMOUNT" value={newFundingCommittedAmount} onChange={setNewFundingCommittedAmount} />
          </div>
          <div className="protocol-actions">
            <button
              type="button"
              className="plans-primary-cta"
              disabled={!canAct || !newFundingLineAssetMint || busy === "Open funding line"}
              onClick={() => run("Open funding line", async () => {
                const { blockhash } = await connection.getLatestBlockhash("confirmed");
                return buildOpenFundingLineTx({
                  authority: publicKey!,
                  healthPlanAddress: props.plan!.address,
                  reserveDomainAddress: props.plan!.reserveDomain,
                  assetMint: newFundingLineAssetMint,
                  recentBlockhash: blockhash,
                  lineId: newFundingLineId,
                  policySeriesAddress: selectedFundingSeries?.address ?? null,
                  lineType: Number.parseInt(newFundingLineType, 10) || FUNDING_LINE_TYPE_SPONSOR_BUDGET,
                  fundingPriority: Number.parseInt(newFundingPriority, 10) || 0,
                  committedAmount: parseBigIntInput(newFundingCommittedAmount),
                });
              })}
            >
              OPEN_FUNDING_LINE
            </button>
          </div>
        </>
    </article>
  );
}

type CapitalOperatorPanelProps = {
  reserveDomains: ReserveDomainSnapshot[];
  pools: LiquidityPoolSnapshot[];
  selectedPool: LiquidityPoolSnapshot | null;
  selectedClass: CapitalClassSnapshot | null;
  classes: CapitalClassSnapshot[];
  lpPositions: LPPositionSnapshot[];
  allocations: AllocationPositionSnapshot[];
  plans: HealthPlanSnapshot[];
  fundingLines: FundingLineSnapshot[];
  series: PolicySeriesSnapshot[];
  onRefresh?: () => Promise<void> | void;
};

export function CapitalOperatorPanel(props: CapitalOperatorPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const canAct = Boolean(publicKey);
  const [status, setStatus] = useState<ActionStatus>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reserveDomainAddress, setReserveDomainAddress] = useState(props.selectedPool?.reserveDomain ?? props.reserveDomains[0]?.address ?? "");
  const [poolId, setPoolId] = useState("");
  const [poolDisplayName, setPoolDisplayName] = useState("");
  const [classId, setClassId] = useState("");
  const [classDisplayName, setClassDisplayName] = useState("");
  const [depositAmount, setDepositAmount] = useState("0");
  const [depositShares, setDepositShares] = useState("0");
  const [queueShares, setQueueShares] = useState("0");
  const [queueAssets, setQueueAssets] = useState("0");
  const [allocationCap, setAllocationCap] = useState("0");
  const [allocationWeight, setAllocationWeight] = useState("5000");
  const [allocationAmount, setAllocationAmount] = useState("0");
  const [selectedHealthPlanAddress, setSelectedHealthPlanAddress] = useState(props.plans[0]?.address ?? "");
  const [selectedFundingLineAddress, setSelectedFundingLineAddress] = useState(props.fundingLines[0]?.address ?? "");
  const [selectedLpOwner, setSelectedLpOwner] = useState(props.lpPositions[0]?.owner ?? publicKey?.toBase58() ?? "");
  const [lpCredentialed, setLpCredentialed] = useState(props.lpPositions[0]?.credentialed ?? true);
  const [lpCredentialingReason, setLpCredentialingReason] = useState("");
  const [queueOnly, setQueueOnly] = useState(props.selectedClass?.queueOnlyRedemptions ?? false);
  const [classActive, setClassActive] = useState(props.selectedClass?.active ?? true);
  const [classPauseFlags, setClassPauseFlags] = useState(String(props.selectedClass?.active ? 0 : PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS));

  useEffect(() => {
    setReserveDomainAddress(props.selectedPool?.reserveDomain ?? props.reserveDomains[0]?.address ?? "");
    setSelectedHealthPlanAddress(props.plans[0]?.address ?? "");
    setSelectedFundingLineAddress(props.fundingLines[0]?.address ?? "");
    setSelectedLpOwner(props.lpPositions[0]?.owner ?? publicKey?.toBase58() ?? "");
    setLpCredentialed(props.lpPositions[0]?.credentialed ?? true);
    setQueueOnly(props.selectedClass?.queueOnlyRedemptions ?? false);
    setClassActive(props.selectedClass?.active ?? true);
  }, [props.fundingLines, props.lpPositions, props.plans, props.reserveDomains, props.selectedClass, props.selectedPool, publicKey]);

  const selectedFundingLine = useMemo(
    () => props.fundingLines.find((line) => line.address === selectedFundingLineAddress) ?? props.fundingLines[0] ?? null,
    [props.fundingLines, selectedFundingLineAddress],
  );

  async function run(label: string, factory: () => Promise<Transaction>) {
    if (!publicKey || !sendTransaction) return;
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
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : `${label} failed.` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="plans-card heavy-glass">
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">CAPITAL_OPERATOR_CONSOLE</p>
          <h2 className="plans-card-title plans-card-title-display">
            Pool, class, LP, and allocation <em>actions</em>
          </h2>
        </div>
      </div>
      <WalletGuard ready={canAct} />
      <StatusBanner status={status} />

      <div className="plans-wizard-row">
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">RESERVE_DOMAIN</span>
          <span className="plans-wizard-field-bar">
            <select className="plans-wizard-input" value={reserveDomainAddress} onChange={(event) => setReserveDomainAddress(event.target.value)}>
              {props.reserveDomains.map((domain) => (
                <option key={domain.address} value={domain.address}>{domain.displayName || domain.domainId}</option>
              ))}
            </select>
          </span>
        </label>
        <Field label="POOL_ID" value={poolId} onChange={setPoolId} />
      </div>
      <Field label="POOL_DISPLAY_NAME" value={poolDisplayName} onChange={setPoolDisplayName} />
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !reserveDomainAddress || !props.selectedPool?.depositAssetMint || busy === "Create liquidity pool"}
          onClick={() => run("Create liquidity pool", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildCreateLiquidityPoolTx({
              authority: publicKey!,
              reserveDomainAddress,
              recentBlockhash: blockhash,
              poolId,
              displayName: poolDisplayName || poolId,
              depositAssetMint: props.selectedPool?.depositAssetMint ?? props.fundingLines[0]?.assetMint ?? ZERO_PUBKEY,
              redemptionPolicy: REDEMPTION_POLICY_OPEN,
              feeBps: 0,
              pauseFlags: 0,
            });
          })}
        >
          CREATE_POOL
        </button>
      </div>

      <div className="plans-wizard-divider" />

      <div className="plans-wizard-row">
        <Field label="CLASS_ID" value={classId} onChange={setClassId} />
        <Field label="CLASS_DISPLAY_NAME" value={classDisplayName} onChange={setClassDisplayName} />
      </div>
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || busy === "Create capital class"}
          onClick={() => run("Create capital class", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildCreateCapitalClassTx({
              authority: publicKey!,
              poolAddress: props.selectedPool!.address,
              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
              recentBlockhash: blockhash,
              classId,
              displayName: classDisplayName || classId,
              priority: 1,
              impairmentRank: 1,
              restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
              redemptionTermsMode: 0,
              feeBps: 0,
              minLockupSeconds: 0n,
              pauseFlags: 0,
            });
          })}
        >
          CREATE_CLASS
        </button>
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || busy === "Update capital class controls"}
          onClick={() => run("Update capital class controls", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildUpdateCapitalClassControlsTx({
              authority: publicKey!,
              poolAddress: props.selectedPool!.address,
              capitalClassAddress: props.selectedClass!.address,
              recentBlockhash: blockhash,
              pauseFlags: Number.parseInt(classPauseFlags, 10) || 0,
              queueOnlyRedemptions: queueOnly,
              active: classActive,
            });
          })}
        >
          UPDATE_CLASS_CONTROLS
        </button>
      </div>
      <div className="plans-settings-grid">
        <ToggleRow label="QUEUE_ONLY_REDEMPTIONS" checked={queueOnly} onChange={setQueueOnly} />
        <ToggleRow label="CLASS_ACTIVE" checked={classActive} onChange={setClassActive} />
      </div>
      <Field label="CLASS_PAUSE_FLAGS" value={classPauseFlags} onChange={setClassPauseFlags} />

      <div className="plans-wizard-divider" />

      <div className="plans-wizard-row">
        <Field label="DEPOSIT_AMOUNT" value={depositAmount} onChange={setDepositAmount} />
        <Field label="DEPOSIT_SHARES" value={depositShares} onChange={setDepositShares} />
      </div>
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-primary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || busy === "Deposit into capital class"}
          onClick={() => run("Deposit into capital class", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildDepositIntoCapitalClassTx({
              owner: publicKey!,
              reserveDomainAddress: props.selectedPool!.reserveDomain,
              poolAddress: props.selectedPool!.address,
              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
              capitalClassAddress: props.selectedClass!.address,
              recentBlockhash: blockhash,
              amount: parseBigIntInput(depositAmount),
              shares: parseBigIntInput(depositShares),
            });
          })}
        >
          DEPOSIT
        </button>
      </div>

      <div className="plans-wizard-row">
        <Field label="REDEMPTION_SHARES" value={queueShares} onChange={setQueueShares} />
        <Field label="REDEMPTION_ASSETS" value={queueAssets} onChange={setQueueAssets} />
      </div>
      <div className="plans-wizard-row">
        <Field label="LP_OWNER" value={selectedLpOwner} onChange={setSelectedLpOwner} />
        <Field label="LP_CREDENTIAL_REASON" value={lpCredentialingReason} onChange={setLpCredentialingReason} />
      </div>
      <ToggleRow label="LP_CREDENTIALED" checked={lpCredentialed} onChange={setLpCredentialed} />
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || !selectedLpOwner || busy === "Update LP credentialing"}
          onClick={() => run("Update LP credentialing", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildUpdateLpPositionCredentialingTx({
              authority: publicKey!,
              poolAddress: props.selectedPool!.address,
              capitalClassAddress: props.selectedClass!.address,
              ownerAddress: selectedLpOwner,
              recentBlockhash: blockhash,
              credentialed: lpCredentialed,
              reasonHashHex: await hashInputToHex(lpCredentialingReason),
            });
          })}
        >
          UPDATE_LP_CREDENTIALING
        </button>
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || busy === "Request redemption"}
          onClick={() => run("Request redemption", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildRequestRedemptionTx({
              owner: publicKey!,
              reserveDomainAddress: props.selectedPool!.reserveDomain,
              poolAddress: props.selectedPool!.address,
              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
              capitalClassAddress: props.selectedClass!.address,
              recentBlockhash: blockhash,
              shares: parseBigIntInput(queueShares),
              assetAmount: parseBigIntInput(queueAssets),
            });
          })}
        >
          REQUEST_REDEMPTION
        </button>
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || !selectedLpOwner || busy === "Process redemption queue"}
          onClick={() => run("Process redemption queue", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildProcessRedemptionQueueTx({
              authority: publicKey!,
              reserveDomainAddress: props.selectedPool!.reserveDomain,
              poolAddress: props.selectedPool!.address,
              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
              capitalClassAddress: props.selectedClass!.address,
              lpOwnerAddress: selectedLpOwner,
              recentBlockhash: blockhash,
              shares: parseBigIntInput(queueShares),
              assetAmount: parseBigIntInput(queueAssets),
            });
          })}
        >
          PROCESS_QUEUE
        </button>
      </div>

      <div className="plans-wizard-divider" />

      <div className="plans-wizard-row">
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">HEALTH_PLAN</span>
          <span className="plans-wizard-field-bar">
            <select className="plans-wizard-input" value={selectedHealthPlanAddress} onChange={(event) => setSelectedHealthPlanAddress(event.target.value)}>
              {props.plans.map((plan) => (
                <option key={plan.address} value={plan.address}>{plan.displayName}</option>
              ))}
            </select>
          </span>
        </label>
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">FUNDING_LINE</span>
          <span className="plans-wizard-field-bar">
            <select className="plans-wizard-input" value={selectedFundingLineAddress} onChange={(event) => setSelectedFundingLineAddress(event.target.value)}>
              {props.fundingLines
                .filter((line) => !selectedHealthPlanAddress || line.healthPlan === selectedHealthPlanAddress)
                .map((line) => (
                  <option key={line.address} value={line.address}>{line.displayName}</option>
                ))}
            </select>
          </span>
        </label>
      </div>
      <div className="plans-wizard-row">
        <Field label="ALLOCATION_CAP" value={allocationCap} onChange={setAllocationCap} />
        <Field label="WEIGHT_BPS" value={allocationWeight} onChange={setAllocationWeight} />
      </div>
      <Field label="ALLOCATION_AMOUNT" value={allocationAmount} onChange={setAllocationAmount} />
      <div className="protocol-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || !selectedFundingLine || busy === "Create allocation position"}
          onClick={() => run("Create allocation position", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildCreateAllocationPositionTx({
              authority: publicKey!,
              poolAddress: props.selectedPool!.address,
              capitalClassAddress: props.selectedClass!.address,
              healthPlanAddress: selectedHealthPlanAddress,
              fundingLineAddress: selectedFundingLine!.address,
              fundingLineAssetMint: selectedFundingLine!.assetMint,
              recentBlockhash: blockhash,
              policySeriesAddress: selectedFundingLine!.policySeries ?? null,
              capAmount: parseBigIntInput(allocationCap),
              weightBps: Number.parseInt(allocationWeight, 10) || 0,
              allocationMode: 0,
              deallocationOnly: false,
            });
          })}
        >
          CREATE_ALLOCATION
        </button>
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || !selectedFundingLine || busy === "Update allocation caps"}
          onClick={() => run("Update allocation caps", async () => {
            const allocation = props.allocations.find((entry) =>
              entry.capitalClass === props.selectedClass!.address && entry.fundingLine === selectedFundingLine!.address,
            );
            if (!allocation) throw new Error("Create the allocation lane first.");
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildUpdateAllocationCapsTx({
              authority: publicKey!,
              poolAddress: props.selectedPool!.address,
              allocationPositionAddress: allocation.address,
              recentBlockhash: blockhash,
              capAmount: parseBigIntInput(allocationCap),
              weightBps: Number.parseInt(allocationWeight, 10) || 0,
              deallocationOnly: false,
              active: true,
            });
          })}
        >
          UPDATE_CAPS
        </button>
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || !selectedFundingLine || busy === "Allocate capital"}
          onClick={() => run("Allocate capital", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildAllocateCapitalTx({
              authority: publicKey!,
              poolAddress: props.selectedPool!.address,
              capitalClassAddress: props.selectedClass!.address,
              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
              fundingLineAddress: selectedFundingLine!.address,
              fundingLineAssetMint: selectedFundingLine!.assetMint,
              recentBlockhash: blockhash,
              amount: parseBigIntInput(allocationAmount),
            });
          })}
        >
          ALLOCATE
        </button>
        <button
          type="button"
          className="plans-primary-cta"
          disabled={!canAct || !props.selectedPool || !props.selectedClass || !selectedFundingLine || busy === "Deallocate capital"}
          onClick={() => run("Deallocate capital", async () => {
            const { blockhash } = await connection.getLatestBlockhash("confirmed");
            return buildDeallocateCapitalTx({
              authority: publicKey!,
              poolAddress: props.selectedPool!.address,
              capitalClassAddress: props.selectedClass!.address,
              poolDepositAssetMint: props.selectedPool!.depositAssetMint,
              fundingLineAddress: selectedFundingLine!.address,
              fundingLineAssetMint: selectedFundingLine!.assetMint,
              recentBlockhash: blockhash,
              amount: parseBigIntInput(allocationAmount),
            });
          })}
        >
          DEALLOCATE
        </button>
      </div>
    </article>
  );
}
