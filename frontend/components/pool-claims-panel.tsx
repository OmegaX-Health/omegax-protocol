// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CheckCircle2, FileText, RefreshCw } from "lucide-react";

import { MemberClaimsPanel } from "@/components/member-claims-panel";
import { usePoolWorkspaceContext } from "@/components/pool-workspace-context";
import { SearchableSelect } from "@/components/searchable-select";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import { deriveCoverageClaimActionDraft } from "@/lib/protocol-workspace-mappers";
import {
  AI_ROLE_CLAIM_PROCESSOR,
  AUTOMATION_MODE_ADVISORY,
  COVERAGE_CLAIM_FAMILY_REIMBURSEMENT,
  COVERAGE_CLAIM_STATUS_APPROVED,
  COVERAGE_CLAIM_STATUS_PARTIALLY_PAID,
  ZERO_PUBKEY,
  buildApproveCoverageClaimTx,
  buildAttachCoverageClaimDecisionSupportTx,
  buildClaimApprovedCoveragePayoutTx,
  buildCloseCoverageClaimTx,
  buildDenyCoverageClaimTx,
  buildPayCoverageClaimTx,
  buildReviewCoverageClaimTx,
  buildSettleCoverageClaimTx,
  listCoverageClaims,
  listMemberCycles,
  listPolicyPositions,
  listPoolAssetVaults,
  listPoolTerms,
  listPremiumLedgers,
  listRewardClaims,
  listWalletTokenAccountsForMint,
  toExplorerLink,
  type CoverageClaimSummary,
  type MemberCycleStateSummary,
  type PolicyPositionSummary,
  type PoolAssetVaultSummary,
  type PoolTermsSummary,
  type PremiumLedgerSummary,
  type RewardClaimSummary,
  type TokenAccountSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import { parseWorkspacePanel, visibleWorkspacePanels, type PoolWorkspacePanel } from "@/lib/ui-capabilities";

type PoolClaimsPanelProps = {
  poolAddress: string;
};

const CLAIM_PANELS: ReadonlyArray<{ value: PoolWorkspacePanel; label: string }> = [
  { value: "member", label: "Member" },
  { value: "operator", label: "Operator" },
];

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatTimestamp(value: bigint): string {
  if (!value || value <= 0n) return "n/a";
  return new Date(Number(value) * 1000).toLocaleString();
}

export function PoolClaimsPanel({ poolAddress }: PoolClaimsPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { capabilities } = usePoolWorkspaceContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedPanel = parseWorkspacePanel("claims", searchParams.get("panel") ?? searchParams.get("mode"));
  const [coverageClaims, setCoverageClaims] = useState<CoverageClaimSummary[]>([]);
  const [rewardClaims, setRewardClaims] = useState<RewardClaimSummary[]>([]);
  const [positions, setPositions] = useState<PolicyPositionSummary[]>([]);
  const [premiumLedgers, setPremiumLedgers] = useState<PremiumLedgerSummary[]>([]);
  const [memberCycles, setMemberCycles] = useState<MemberCycleStateSummary[]>([]);
  const [poolTerms, setPoolTerms] = useState<PoolTermsSummary | null>(null);
  const [poolAssetVaults, setPoolAssetVaults] = useState<PoolAssetVaultSummary[]>([]);
  const [claimantTokenAccounts, setClaimantTokenAccounts] = useState<TokenAccountSummary[]>([]);
  const [selectedClaimAddress, setSelectedClaimAddress] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [selectedClaimantTokenAccount, setSelectedClaimantTokenAccount] = useState("");
  const [selectedMemberClaimAddress, setSelectedMemberClaimAddress] = useState("");
  const [memberClaimantTokenAccounts, setMemberClaimantTokenAccounts] = useState<TokenAccountSummary[]>([]);
  const [selectedMemberClaimantTokenAccount, setSelectedMemberClaimantTokenAccount] = useState("");

  const [requestedAmountInput, setRequestedAmountInput] = useState("0");
  const [evidenceHashInput, setEvidenceHashInput] = useState("");
  const [interopRefHashInput, setInteropRefHashInput] = useState("");
  const [claimFamilyInput, setClaimFamilyInput] = useState(String(COVERAGE_CLAIM_FAMILY_REIMBURSEMENT));
  const [aiDecisionHashInput, setAiDecisionHashInput] = useState("");
  const [aiPolicyHashInput, setAiPolicyHashInput] = useState("");
  const [aiExecutionHashInput, setAiExecutionHashInput] = useState("");
  const [aiAttestationRefInput, setAiAttestationRefInput] = useState("");
  const [approvedAmountInput, setApprovedAmountInput] = useState("0");
  const [decisionReasonHashInput, setDecisionReasonHashInput] = useState("");
  const [adjudicationRefInput, setAdjudicationRefInput] = useState("");
  const [payoutAmountInput, setPayoutAmountInput] = useState("0");
  const [memberPayoutAmountInput, setMemberPayoutAmountInput] = useState("0");
  const [recoveryAmountInput, setRecoveryAmountInput] = useState("0");

  const walletAddress = publicKey?.toBase58() ?? "";
  const visiblePanels = useMemo(
    () => visibleWorkspacePanels("claims", capabilities),
    [capabilities],
  );
  const activePanel = useMemo<PoolWorkspacePanel>(
    () => (requestedPanel && visiblePanels.includes(requestedPanel) ? requestedPanel : visiblePanels[0] ?? "member"),
    [requestedPanel, visiblePanels],
  );
  const panelLead = useMemo(() => {
    if (activePanel === "operator") {
      return "Work from a discovered case row first, then run only the adjudication step you need.";
    }
    return "Use the member surface for submissions, approved payouts, and claim history without switching into operator casework.";
  }, [activePanel]);

  const filteredClaims = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return coverageClaims;
    return coverageClaims.filter((row) =>
      [
        row.member,
        row.claimant,
        row.intentHashHex,
        row.eventHashHex,
        row.seriesRefHashHex,
        row.address,
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [coverageClaims, search]);
  const selectedClaim = useMemo(
    () => filteredClaims.find((row) => row.address === selectedClaimAddress) ?? coverageClaims.find((row) => row.address === selectedClaimAddress) ?? null,
    [coverageClaims, filteredClaims, selectedClaimAddress],
  );
  const selectedPoolAssetVault = useMemo(
    () => poolAssetVaults.find((row) => row.payoutMint === (poolTerms?.payoutAssetMint ?? ZERO_PUBKEY)) ?? null,
    [poolAssetVaults, poolTerms?.payoutAssetMint],
  );
  const claimDraft = useMemo(
    () =>
      selectedClaim
        ? deriveCoverageClaimActionDraft({
          claim: selectedClaim,
          poolTerms,
          poolAssetVault: selectedPoolAssetVault,
          claimantTokenAccount: selectedClaimantTokenAccount || null,
        })
        : null,
    [poolTerms, selectedClaim, selectedClaimantTokenAccount, selectedPoolAssetVault],
  );
  const memberPayoutClaims = useMemo(
    () =>
      coverageClaims.filter((row) =>
        (row.claimant === walletAddress || row.member === walletAddress)
        && (row.status === COVERAGE_CLAIM_STATUS_APPROVED || row.status === COVERAGE_CLAIM_STATUS_PARTIALLY_PAID)),
    [coverageClaims, walletAddress],
  );
  const selectedMemberClaim = useMemo(
    () =>
      memberPayoutClaims.find((row) => row.address === selectedMemberClaimAddress)
      ?? memberPayoutClaims[0]
      ?? null,
    [memberPayoutClaims, selectedMemberClaimAddress],
  );
  const memberClaimDraft = useMemo(
    () =>
      selectedMemberClaim
        ? deriveCoverageClaimActionDraft({
          claim: selectedMemberClaim,
          poolTerms,
          poolAssetVault: selectedPoolAssetVault,
          claimantTokenAccount: selectedMemberClaimantTokenAccount || null,
        })
        : null,
    [poolTerms, selectedMemberClaim, selectedMemberClaimantTokenAccount, selectedPoolAssetVault],
  );
  const claimOptions = useMemo(
    () =>
      filteredClaims.map((row) => ({
        value: row.address,
        label: `${shortAddress(row.claimant)} • ${shortAddress(row.intentHashHex)}`,
        hint: `${row.requestedAmount.toString()} requested • status ${row.status}`,
      })),
    [filteredClaims],
  );

  const setPanel = useCallback((nextPanel: PoolWorkspacePanel) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "claims");
    params.set("panel", nextPanel);
    params.delete("mode");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (requestedPanel === activePanel) return;
    setPanel(activePanel);
  }, [activePanel, requestedPanel, setPanel]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCoverageClaims, nextRewardClaims, nextPositions, nextPremiumLedgers, nextMemberCycles, nextPoolTerms, nextAssetVaults] = await Promise.all([
        listCoverageClaims({ connection, poolAddress, search: null }),
        listRewardClaims({ connection, poolAddress, search: null }),
        listPolicyPositions({ connection, poolAddress, search: null }),
        listPremiumLedgers({ connection, poolAddress, search: null }),
        listMemberCycles({ connection, poolAddress, search: null }),
        listPoolTerms({ connection, poolAddress, search: null }),
        listPoolAssetVaults({ connection, poolAddress, search: null }),
      ]);
      setCoverageClaims(nextCoverageClaims);
      setRewardClaims(nextRewardClaims);
      setPositions(nextPositions);
      setPremiumLedgers(nextPremiumLedgers);
      setMemberCycles(nextMemberCycles);
      setPoolTerms(nextPoolTerms[0] ?? null);
      setPoolAssetVaults(nextAssetVaults);
      setSelectedClaimAddress((current) => current && nextCoverageClaims.some((row) => row.address === current)
        ? current
        : nextCoverageClaims[0]?.address ?? "");
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load claim workspace data.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, poolAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (filteredClaims.length === 0) {
      setSelectedClaimAddress("");
      return;
    }
    setSelectedClaimAddress((current) =>
      current && filteredClaims.some((row) => row.address === current) ? current : filteredClaims[0]!.address);
  }, [filteredClaims]);

  useEffect(() => {
    if (memberPayoutClaims.length === 0) {
      setSelectedMemberClaimAddress("");
      return;
    }
    setSelectedMemberClaimAddress((current) =>
      current && memberPayoutClaims.some((row) => row.address === current) ? current : memberPayoutClaims[0]!.address);
  }, [memberPayoutClaims]);

  useEffect(() => {
    if (!selectedClaim || !poolTerms || poolTerms.payoutAssetMint === ZERO_PUBKEY) {
      setClaimantTokenAccounts([]);
      setSelectedClaimantTokenAccount("");
      return;
    }
    let cancelled = false;
    void listWalletTokenAccountsForMint({
      connection,
      owner: selectedClaim.claimant,
      mint: poolTerms.payoutAssetMint,
      search: null,
    }).then((rows) => {
      if (cancelled) return;
      setClaimantTokenAccounts(rows);
      setSelectedClaimantTokenAccount((current) =>
        current && rows.some((row) => row.address === current) ? current : rows[0]?.address ?? "");
    }).catch(() => {
      if (cancelled) return;
      setClaimantTokenAccounts([]);
      setSelectedClaimantTokenAccount("");
    });
    return () => {
      cancelled = true;
    };
  }, [connection, poolTerms, selectedClaim]);

  useEffect(() => {
    if (!selectedMemberClaim || !poolTerms || poolTerms.payoutAssetMint === ZERO_PUBKEY) {
      setMemberClaimantTokenAccounts([]);
      setSelectedMemberClaimantTokenAccount("");
      return;
    }
    let cancelled = false;
    void listWalletTokenAccountsForMint({
      connection,
      owner: selectedMemberClaim.claimant,
      mint: poolTerms.payoutAssetMint,
      search: null,
    }).then((rows) => {
      if (cancelled) return;
      setMemberClaimantTokenAccounts(rows);
      setSelectedMemberClaimantTokenAccount((current) =>
        current && rows.some((row) => row.address === current) ? current : rows[0]?.address ?? "");
    }).catch(() => {
      if (cancelled) return;
      setMemberClaimantTokenAccounts([]);
      setSelectedMemberClaimantTokenAccount("");
    });
    return () => {
      cancelled = true;
    };
  }, [connection, poolTerms, selectedMemberClaim]);

  useEffect(() => {
    if (!selectedClaim) return;
    setRequestedAmountInput(selectedClaim.requestedAmount.toString());
    setApprovedAmountInput((selectedClaim.approvedAmount > 0n ? selectedClaim.approvedAmount : selectedClaim.requestedAmount).toString());
    setPayoutAmountInput((selectedClaim.approvedAmount > 0n ? selectedClaim.approvedAmount : selectedClaim.requestedAmount).toString());
    setRecoveryAmountInput(selectedClaim.recoveryAmount.toString());
    setEvidenceHashInput(selectedClaim.evidenceHashHex === "0".repeat(64) ? "" : selectedClaim.evidenceHashHex);
    setInteropRefHashInput(selectedClaim.interopRefHashHex === "0".repeat(64) ? "" : selectedClaim.interopRefHashHex);
    setClaimFamilyInput(String(selectedClaim.claimFamily || COVERAGE_CLAIM_FAMILY_REIMBURSEMENT));
    setDecisionReasonHashInput(selectedClaim.decisionReasonHashHex === "0".repeat(64) ? "" : selectedClaim.decisionReasonHashHex);
    setAdjudicationRefInput(selectedClaim.adjudicationRefHashHex === "0".repeat(64) ? "" : selectedClaim.adjudicationRefHashHex);
    setAiDecisionHashInput(selectedClaim.aiDecisionHashHex === "0".repeat(64) ? "" : selectedClaim.aiDecisionHashHex);
    setAiPolicyHashInput(selectedClaim.aiPolicyHashHex === "0".repeat(64) ? "" : selectedClaim.aiPolicyHashHex);
    setAiExecutionHashInput(selectedClaim.aiExecutionEnvironmentHashHex === "0".repeat(64) ? "" : selectedClaim.aiExecutionEnvironmentHashHex);
    setAiAttestationRefInput(selectedClaim.aiAttestationRefHashHex === "0".repeat(64) ? "" : selectedClaim.aiAttestationRefHashHex);
  }, [selectedClaim]);

  useEffect(() => {
    if (!selectedMemberClaim) return;
    setMemberPayoutAmountInput(
      (selectedMemberClaim.reservedAmount > 0n ? selectedMemberClaim.reservedAmount : selectedMemberClaim.approvedAmount).toString(),
    );
  }, [selectedMemberClaim]);

  const reviewGuard = useMemo(() => {
    if (!capabilities.canReviewCoverageClaims) return "Claim review is limited to operator or adjudication wallets.";
    if (!publicKey || !sendTransaction) return "Connect an operator wallet to review claims.";
    if (!selectedClaim) return "Select a claim case first.";
    return "";
  }, [capabilities.canReviewCoverageClaims, publicKey, selectedClaim, sendTransaction]);

  const decisionGuard = useMemo(() => {
    if (!capabilities.canAdjudicateCoverageClaims) return "Claim adjudication is limited to authorized operator wallets.";
    if (reviewGuard) return reviewGuard;
    if (!decisionReasonHashInput.trim()) return "Decision reason hash is required.";
    return "";
  }, [capabilities.canAdjudicateCoverageClaims, decisionReasonHashInput, reviewGuard]);

  const payoutGuard = useMemo(() => {
    if (!capabilities.canAdjudicateCoverageClaims) return "Claim payouts require an adjudication-capable operator wallet.";
    if (decisionGuard) return decisionGuard;
    if (poolTerms?.payoutAssetMint !== ZERO_PUBKEY && !selectedClaimantTokenAccount) {
      return "Select the claimant token account for SPL payout.";
    }
    return "";
  }, [capabilities.canAdjudicateCoverageClaims, decisionGuard, poolTerms?.payoutAssetMint, selectedClaimantTokenAccount]);

  const settleGuard = useMemo(() => {
    if (!capabilities.canSubmitClaims) return "Claim settlement requires the claimant signer wallet.";
    if (payoutGuard) return payoutGuard;
    if (!selectedClaim) return "Select a claim case first.";
    if (walletAddress !== selectedClaim.claimant) {
      return "Settle requires the claimant signer in the current wallet session.";
    }
    return "";
  }, [capabilities.canSubmitClaims, payoutGuard, selectedClaim, walletAddress]);

  const claimApprovedPayoutGuard = useMemo(() => {
    if (!capabilities.canSubmitClaims) return "Approved payout claims require the claimant or an active claim delegate.";
    if (!publicKey || !sendTransaction) return "Connect the claimant wallet to pull an approved payout.";
    if (!selectedMemberClaim || !memberClaimDraft) return "Select an approved claim first.";
    if (
      walletAddress !== selectedMemberClaim.claimant
      && walletAddress !== selectedMemberClaim.member
      && !capabilities.isClaimDelegate
    ) {
      return "Connected wallet must match the claimant or an active claim delegate.";
    }
    if (poolTerms?.payoutAssetMint !== ZERO_PUBKEY && !selectedMemberClaimantTokenAccount) {
      return "Select the claimant token account for SPL payout.";
    }
    return "";
  }, [
    capabilities.canSubmitClaims,
    capabilities.isClaimDelegate,
    memberClaimDraft,
    poolTerms?.payoutAssetMint,
    publicKey,
    selectedMemberClaim,
    selectedMemberClaimantTokenAccount,
    sendTransaction,
    walletAddress,
  ]);

  async function runAction(
    label: string,
    buildTx: (recentBlockhash: string) => ReturnType<typeof buildReviewCoverageClaimTx>,
  ) {
    if (!sendTransaction) return;
    setBusyAction(label);
    setStatus(null);
    setStatusTone(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildTx(blockhash);
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label,
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
      await refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function onReviewClaim() {
    if (reviewGuard || !publicKey || !selectedClaim) return;
    await runAction("Review coverage claim", (recentBlockhash) =>
      buildReviewCoverageClaimTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedClaim.member),
        seriesRefHashHex: selectedClaim.seriesRefHashHex,
        intentHashHex: selectedClaim.intentHashHex,
        requestedAmount: BigInt(requestedAmountInput || "0"),
        evidenceHashHex: evidenceHashInput || "00".repeat(32),
        interopRefHashHex: interopRefHashInput || "00".repeat(32),
        claimFamily: Number.parseInt(claimFamilyInput, 10) || COVERAGE_CLAIM_FAMILY_REIMBURSEMENT,
        interopProfileHashHex: selectedClaim.interopProfileHashHex,
        codeSystemFamilyHashHex: selectedClaim.codeSystemFamilyHashHex,
        recentBlockhash,
      }));
  }

  async function onAttachDecisionSupport() {
    if (reviewGuard || !publicKey || !selectedClaim) return;
    await runAction("Attach decision support", (recentBlockhash) =>
      buildAttachCoverageClaimDecisionSupportTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedClaim.member),
        seriesRefHashHex: selectedClaim.seriesRefHashHex,
        intentHashHex: selectedClaim.intentHashHex,
        aiDecisionHashHex: aiDecisionHashInput || undefined,
        aiPolicyHashHex: aiPolicyHashInput || undefined,
        aiExecutionEnvironmentHashHex: aiExecutionHashInput || undefined,
        aiAttestationRefHashHex: aiAttestationRefInput || undefined,
        aiRole: AI_ROLE_CLAIM_PROCESSOR,
        automationMode: AUTOMATION_MODE_ADVISORY,
        recentBlockhash,
      }));
  }

  async function onApproveClaim() {
    if (decisionGuard || !publicKey || !selectedClaim || !claimDraft) return;
    await runAction("Approve coverage claim", (recentBlockhash) =>
      buildApproveCoverageClaimTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedClaim.member),
        seriesRefHashHex: selectedClaim.seriesRefHashHex,
        intentHashHex: selectedClaim.intentHashHex,
        approvedAmount: BigInt(approvedAmountInput || "0"),
        payoutMint: new PublicKey(claimDraft.payoutMint),
        poolAssetVault: new PublicKey(claimDraft.poolAssetVault ?? poolAddress),
        poolVaultTokenAccount: new PublicKey(claimDraft.poolVaultTokenAccount ?? poolAddress),
        decisionReasonHashHex: decisionReasonHashInput,
        adjudicationRefHashHex: adjudicationRefInput || undefined,
        recentBlockhash,
      }));
  }

  async function onDenyClaim() {
    if (decisionGuard || !publicKey || !selectedClaim || !claimDraft) return;
    await runAction("Deny coverage claim", (recentBlockhash) =>
      buildDenyCoverageClaimTx({
        oracle: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedClaim.member),
        seriesRefHashHex: selectedClaim.seriesRefHashHex,
        intentHashHex: selectedClaim.intentHashHex,
        payoutMint: new PublicKey(claimDraft.payoutMint),
        decisionReasonHashHex: decisionReasonHashInput,
        adjudicationRefHashHex: adjudicationRefInput || undefined,
        recentBlockhash,
      }));
  }

  async function onPayClaim() {
    if (payoutGuard || !publicKey || !selectedClaim || !claimDraft) return;
    await runAction("Pay coverage claim", (recentBlockhash) =>
      publicKey.equals(new PublicKey(selectedClaim.claimant))
        ? buildClaimApprovedCoveragePayoutTx({
          claimSigner: publicKey,
          claimant: new PublicKey(selectedClaim.claimant),
          poolAddress: new PublicKey(poolAddress),
          member: new PublicKey(selectedClaim.member),
          seriesRefHashHex: selectedClaim.seriesRefHashHex,
          intentHashHex: selectedClaim.intentHashHex,
          payoutAmount: BigInt(payoutAmountInput || "0"),
          payoutMint: new PublicKey(claimDraft.payoutMint),
          recipientSystemAccount: new PublicKey(claimDraft.claimantRecipientSystemAccount),
          poolAssetVault: new PublicKey(claimDraft.poolAssetVault ?? poolAddress),
          poolVaultTokenAccount: new PublicKey(claimDraft.poolVaultTokenAccount ?? poolAddress),
          recipientTokenAccount: new PublicKey(claimDraft.claimantRecipientTokenAccount ?? poolAddress),
          recentBlockhash,
        })
        : buildPayCoverageClaimTx({
          authority: publicKey,
          claimant: new PublicKey(selectedClaim.claimant),
          poolAddress: new PublicKey(poolAddress),
          member: new PublicKey(selectedClaim.member),
          seriesRefHashHex: selectedClaim.seriesRefHashHex,
          intentHashHex: selectedClaim.intentHashHex,
          payoutAmount: BigInt(payoutAmountInput || "0"),
          payoutMint: new PublicKey(claimDraft.payoutMint),
          recipientSystemAccount: new PublicKey(claimDraft.claimantRecipientSystemAccount),
          poolAssetVault: new PublicKey(claimDraft.poolAssetVault ?? poolAddress),
          poolVaultTokenAccount: new PublicKey(claimDraft.poolVaultTokenAccount ?? poolAddress),
          recipientTokenAccount: new PublicKey(claimDraft.claimantRecipientTokenAccount ?? poolAddress),
          recentBlockhash,
        }));
  }

  async function onCloseClaim() {
    if (decisionGuard || !publicKey || !selectedClaim || !claimDraft) return;
    await runAction("Close coverage claim", (recentBlockhash) =>
      buildCloseCoverageClaimTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedClaim.member),
        seriesRefHashHex: selectedClaim.seriesRefHashHex,
        intentHashHex: selectedClaim.intentHashHex,
        payoutMint: new PublicKey(claimDraft.payoutMint),
        recoveryAmount: BigInt(recoveryAmountInput || "0"),
        recentBlockhash,
      }));
  }

  async function onSettleClaim() {
    if (settleGuard || !publicKey || !selectedClaim || !claimDraft) return;
    await runAction("Settle coverage claim", (recentBlockhash) =>
      buildSettleCoverageClaimTx({
        oracle: publicKey,
        claimant: publicKey,
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedClaim.member),
        seriesRefHashHex: selectedClaim.seriesRefHashHex,
        intentHashHex: selectedClaim.intentHashHex,
        payoutAmount: BigInt(payoutAmountInput || "0"),
        payoutMint: new PublicKey(claimDraft.payoutMint),
        recipientSystemAccount: new PublicKey(claimDraft.claimantRecipientSystemAccount),
        poolAssetVault: new PublicKey(claimDraft.poolAssetVault ?? poolAddress),
        poolVaultTokenAccount: new PublicKey(claimDraft.poolVaultTokenAccount ?? poolAddress),
        recipientTokenAccount: new PublicKey(claimDraft.claimantRecipientTokenAccount ?? poolAddress),
        recentBlockhash,
      }));
  }

  async function onClaimApprovedPayout() {
    if (claimApprovedPayoutGuard || !publicKey || !selectedMemberClaim || !memberClaimDraft) return;
    await runAction("Claim approved payout", (recentBlockhash) =>
      buildClaimApprovedCoveragePayoutTx({
        claimSigner: publicKey,
        claimant: new PublicKey(selectedMemberClaim.claimant),
        poolAddress: new PublicKey(poolAddress),
        member: new PublicKey(selectedMemberClaim.member),
        seriesRefHashHex: selectedMemberClaim.seriesRefHashHex,
        intentHashHex: selectedMemberClaim.intentHashHex,
        payoutAmount: BigInt(memberPayoutAmountInput || "0"),
        payoutMint: new PublicKey(memberClaimDraft.payoutMint),
        recipientSystemAccount: new PublicKey(memberClaimDraft.claimantRecipientSystemAccount),
        poolAssetVault: new PublicKey(memberClaimDraft.poolAssetVault ?? poolAddress),
        poolVaultTokenAccount: new PublicKey(memberClaimDraft.poolVaultTokenAccount ?? poolAddress),
        recipientTokenAccount: new PublicKey(memberClaimDraft.claimantRecipientTokenAccount ?? poolAddress),
        recentBlockhash,
      }));
  }

  const memberHistoryPositions = useMemo(
    () => positions.filter((row) => row.member === walletAddress).slice(0, 6),
    [positions, walletAddress],
  );
  const memberHistoryPremiums = useMemo(
    () => premiumLedgers.filter((row) => row.member === walletAddress).slice(0, 6),
    [premiumLedgers, walletAddress],
  );
  const memberHistoryCycles = useMemo(
    () => memberCycles.filter((row) => row.member === walletAddress).slice(0, 6),
    [memberCycles, walletAddress],
  );
  const memberCoverageClaims = useMemo(
    () => coverageClaims.filter((row) => row.claimant === walletAddress || row.member === walletAddress).slice(0, 6),
    [coverageClaims, walletAddress],
  );

  return (
    <section className="space-y-4">
      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Claims workspace</p>
          </div>
          <button
            type="button"
            className="secondary-button inline-flex items-center gap-1.5"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="field-help">{panelLead}</p>
        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-off">{coverageClaims.length} coverage claims</span>
          <span className="status-pill status-off">{rewardClaims.length} reward claims</span>
          <span className="status-pill status-off">{memberCycles.length} member cycles</span>
        </div>
      </section>

      {visiblePanels.length > 1 ? (
        <section className="surface-card-soft space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {CLAIM_PANELS.filter((panel) => visiblePanels.includes(panel.value)).map((panel) => (
              <button
                key={panel.value}
                type="button"
                className={`segment-button ${activePanel === panel.value ? "segment-button-active" : ""}`}
                onClick={() => setPanel(panel.value)}
              >
                {panel.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activePanel === "member" ? (
        <>
          <MemberClaimsPanel initialPoolAddress={poolAddress} lockPoolSelection sectionMode="embedded" />

          <section className="surface-card-soft space-y-3">
            <div className="space-y-1">
              <p className="metric-label">Claim approved payout</p>
              <p className="field-help">
                Claimants can pull approved coverage payouts after adjudication. Active claim delegates can use the same flow for delegated wallets.
              </p>
            </div>

            {memberPayoutClaims.length === 0 ? (
              <p className="field-help">No approved or partially paid coverage claims are available for the connected wallet yet.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                  <label className="space-y-1">
                    <span className="metric-label">Approved claim</span>
                    <select
                      className="field-input"
                      value={selectedMemberClaimAddress}
                      onChange={(event) => setSelectedMemberClaimAddress(event.target.value)}
                    >
                      {memberPayoutClaims.map((row) => (
                        <option key={row.address} value={row.address}>
                          {shortAddress(row.intentHashHex)} • reserved {row.reservedAmount.toString()}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedMemberClaim ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="monitor-row">
                        <span>Claimant</span>
                        <span>{shortAddress(selectedMemberClaim.claimant)}</span>
                      </div>
                      <div className="monitor-row">
                        <span>Reserved amount</span>
                        <span>{selectedMemberClaim.reservedAmount.toString()}</span>
                      </div>
                      <div className="monitor-row">
                        <span>Paid amount</span>
                        <span>{selectedMemberClaim.paidAmount.toString()}</span>
                      </div>
                      <div className="monitor-row">
                        <span>Payout rail</span>
                        <span>{poolTerms?.payoutAssetMint === ZERO_PUBKEY ? "SOL" : shortAddress(poolTerms?.payoutAssetMint ?? ZERO_PUBKEY)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <label className="space-y-1">
                    <span className="metric-label">Payout amount</span>
                    <input
                      className="field-input"
                      value={memberPayoutAmountInput}
                      onChange={(event) => setMemberPayoutAmountInput(event.target.value)}
                    />
                  </label>
                  {poolTerms?.payoutAssetMint !== ZERO_PUBKEY ? (
                    <label className="space-y-1">
                      <span className="metric-label">Claimant token account</span>
                      <select
                        className="field-input"
                        value={selectedMemberClaimantTokenAccount}
                        onChange={(event) => setSelectedMemberClaimantTokenAccount(event.target.value)}
                      >
                        <option value="">Select token account</option>
                        {memberClaimantTokenAccounts.map((row) => (
                          <option key={row.address} value={row.address}>
                            {shortAddress(row.address)} • balance {row.amount}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onClaimApprovedPayout()}
                    disabled={Boolean(claimApprovedPayoutGuard) || Boolean(busyAction)}
                  >
                    {busyAction === "Claim approved payout" ? "Claiming..." : "Claim approved payout"}
                  </button>
                  {claimApprovedPayoutGuard ? <p className="field-help">{claimApprovedPayoutGuard}</p> : null}
                </div>
              </div>
            )}
          </section>

          <section className="surface-card-soft space-y-3">
            <p className="metric-label">Member history</p>
            <div className="grid gap-3 xl:grid-cols-2">
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-2">
                <p className="metric-label">Policy positions</p>
                {memberHistoryPositions.length === 0 ? <p className="field-help">No policy positions for the connected wallet.</p> : memberHistoryPositions.map((row) => (
                  <div key={row.address} className="monitor-row">
                    <span>{shortAddress(row.address)}</span>
                    <span>{formatTimestamp(row.nextDueAt)}</span>
                  </div>
                ))}
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-2">
                <p className="metric-label">Premiums</p>
                {memberHistoryPremiums.length === 0 ? <p className="field-help">No premium ledger entries yet.</p> : memberHistoryPremiums.map((row) => (
                  <div key={row.address} className="monitor-row">
                    <span>{row.periodIndex.toString()}</span>
                    <span>{row.amount.toString()}</span>
                  </div>
                ))}
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-2">
                <p className="metric-label">Member cycles</p>
                {memberHistoryCycles.length === 0 ? <p className="field-help">No activated cycles yet.</p> : memberHistoryCycles.map((row) => (
                  <div key={row.address} className="monitor-row">
                    <span>{row.periodIndex.toString()}</span>
                    <span>{row.passed ? "Passed" : "Pending/failed"}</span>
                  </div>
                ))}
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-2">
                <p className="metric-label">Prior claims</p>
                {memberCoverageClaims.length === 0 ? <p className="field-help">No coverage claim history for the connected wallet.</p> : memberCoverageClaims.map((row) => (
                  <div key={row.address} className="monitor-row">
                    <span>{shortAddress(row.intentHashHex)}</span>
                    <span>Status {row.status}</span>
                  </div>
                ))}
              </article>
            </div>
          </section>
        </>
      ) : null}

      {activePanel === "operator" ? (
        <section className="surface-card-soft space-y-4">
          <div className="space-y-2">
            <p className="metric-label">Operator casework</p>
            <p className="field-help">
              Select a discovered coverage claim row. The case panel preloads claimant/member/series/payout context so each action only asks for adjudication-specific fields.
            </p>
          </div>

          <SearchableSelect
            label="Coverage claim case"
            value={selectedClaimAddress}
            options={claimOptions}
            onChange={setSelectedClaimAddress}
            searchValue={search}
            onSearchChange={setSearch}
            loading={loading}
            placeholder="Select claim case"
            emptyMessage="No coverage claims match the current filters."
          />

          {selectedClaim && claimDraft ? (
            <>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <div className="monitor-row">
                  <span>Claimant</span>
                  <span>{shortAddress(selectedClaim.claimant)}</span>
                </div>
                <div className="monitor-row">
                  <span>Member</span>
                  <span>{shortAddress(selectedClaim.member)}</span>
                </div>
                <div className="monitor-row">
                  <span>Payout rail</span>
                  <span>{poolTerms?.payoutAssetMint === ZERO_PUBKEY ? "SOL" : shortAddress(poolTerms?.payoutAssetMint ?? ZERO_PUBKEY)}</span>
                </div>
                <div className="monitor-row">
                  <span>Recommended next step</span>
                  <span>{claimDraft.recommendedOperatorAction}</span>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
                  <p className="metric-label">Review + decision support</p>
                  <label className="space-y-1">
                    <span className="metric-label">Requested amount</span>
                    <input className="field-input" value={requestedAmountInput} onChange={(event) => setRequestedAmountInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Evidence hash</span>
                    <input className="field-input font-mono" value={evidenceHashInput} onChange={(event) => setEvidenceHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Interop reference hash</span>
                    <input className="field-input font-mono" value={interopRefHashInput} onChange={(event) => setInteropRefHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Claim family</span>
                    <select className="field-input" value={claimFamilyInput} onChange={(event) => setClaimFamilyInput(event.target.value)}>
                      <option value="0">Fast</option>
                      <option value="1">Reimbursement</option>
                      <option value="2">Regulated</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="secondary-button" onClick={() => void onReviewClaim()} disabled={Boolean(reviewGuard) || Boolean(busyAction)}>
                      {busyAction === "Review coverage claim" ? "Reviewing..." : "Review claim"}
                    </button>
                  </div>

                  <label className="space-y-1">
                    <span className="metric-label">AI decision hash</span>
                    <input className="field-input font-mono" value={aiDecisionHashInput} onChange={(event) => setAiDecisionHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">AI policy hash</span>
                    <input className="field-input font-mono" value={aiPolicyHashInput} onChange={(event) => setAiPolicyHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">AI execution hash</span>
                    <input className="field-input font-mono" value={aiExecutionHashInput} onChange={(event) => setAiExecutionHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">AI attestation ref</span>
                    <input className="field-input font-mono" value={aiAttestationRefInput} onChange={(event) => setAiAttestationRefInput(event.target.value)} />
                  </label>
                  <button type="button" className="secondary-button" onClick={() => void onAttachDecisionSupport()} disabled={Boolean(reviewGuard) || Boolean(busyAction)}>
                    {busyAction === "Attach decision support" ? "Saving..." : "Attach decision support"}
                  </button>
                </article>

                <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
                  <p className="metric-label">Adjudication + payout</p>
                  <label className="space-y-1">
                    <span className="metric-label">Approved amount</span>
                    <input className="field-input" value={approvedAmountInput} onChange={(event) => setApprovedAmountInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Decision reason hash</span>
                    <input className="field-input font-mono" value={decisionReasonHashInput} onChange={(event) => setDecisionReasonHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Adjudication reference hash</span>
                    <input className="field-input font-mono" value={adjudicationRefInput} onChange={(event) => setAdjudicationRefInput(event.target.value)} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="action-button" onClick={() => void onApproveClaim()} disabled={Boolean(decisionGuard) || Boolean(busyAction)}>
                      {busyAction === "Approve coverage claim" ? "Approving..." : "Approve"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void onDenyClaim()} disabled={Boolean(decisionGuard) || Boolean(busyAction)}>
                      {busyAction === "Deny coverage claim" ? "Denying..." : "Deny"}
                    </button>
                  </div>

                  <label className="space-y-1">
                    <span className="metric-label">Payout amount</span>
                    <input className="field-input" value={payoutAmountInput} onChange={(event) => setPayoutAmountInput(event.target.value)} />
                  </label>
                  {poolTerms?.payoutAssetMint !== ZERO_PUBKEY ? (
                    <label className="space-y-1">
                      <span className="metric-label">Claimant token account</span>
                      <select className="field-input" value={selectedClaimantTokenAccount} onChange={(event) => setSelectedClaimantTokenAccount(event.target.value)}>
                        <option value="">Select token account</option>
                        {claimantTokenAccounts.map((row) => (
                          <option key={row.address} value={row.address}>
                            {shortAddress(row.address)} • balance {row.amount}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="space-y-1">
                    <span className="metric-label">Recovery amount</span>
                    <input className="field-input" value={recoveryAmountInput} onChange={(event) => setRecoveryAmountInput(event.target.value)} />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="secondary-button" onClick={() => void onPayClaim()} disabled={Boolean(payoutGuard) || Boolean(busyAction)}>
                      {busyAction === "Pay coverage claim" ? "Paying..." : "Pay"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void onCloseClaim()} disabled={Boolean(decisionGuard) || Boolean(busyAction)}>
                      {busyAction === "Close coverage claim" ? "Closing..." : "Close"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void onSettleClaim()} disabled={Boolean(settleGuard) || Boolean(busyAction)}>
                      {busyAction === "Settle coverage claim" ? "Settling..." : "Settle"}
                    </button>
                  </div>
                  {reviewGuard || decisionGuard || payoutGuard || settleGuard ? (
                    <p className="field-help">{settleGuard || payoutGuard || decisionGuard || reviewGuard}</p>
                  ) : null}
                </article>
              </div>
            </>
          ) : (
            <p className="field-help">Select a claim case to load operator actions and member routing defaults.</p>
          )}
        </section>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txUrl ? (
            <a className="secondary-button inline-flex w-fit items-center gap-2" href={txUrl} target="_blank" rel="noreferrer">
              <CheckCircle2 className="h-4 w-4" />
              View transaction
            </a>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
