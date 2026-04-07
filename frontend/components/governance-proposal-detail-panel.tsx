// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { CheckCircle2, ExternalLink, LoaderCircle, Vote as VoteIcon } from "lucide-react";

import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  buildCastGovernanceVoteTx,
  buildExecuteGovernanceTransactionTx,
  buildRelinquishGovernanceVoteTx,
  formatGovernanceAmount,
  loadGovernanceProposalDetail,
  type GovernanceProposalDetailSummary,
} from "@/lib/governance";
import { formatRpcError } from "@/lib/rpc-errors";
import { toExplorerAddressLink } from "@/lib/protocol";

type GovernanceProposalDetailPanelProps = {
  proposalAddress: string;
  sectionMode?: "inline" | "page";
};

function shortAddress(value: string | null | undefined): string {
  if (!value) return "n/a";
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function GovernanceProposalDetailPanel({
  proposalAddress,
  sectionMode = "inline",
}: GovernanceProposalDetailPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [detail, setDetail] = useState<GovernanceProposalDetailSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const nextDetail = await loadGovernanceProposalDetail({
        connection,
        proposalAddress: new PublicKey(proposalAddress),
        walletAddress: publicKey ?? null,
      });
      setDetail(nextDetail);
    } catch (cause) {
      setStatus(formatRpcError(cause, {
        fallback: "Failed to load proposal details.",
        rpcEndpoint: connection.rpcEndpoint,
      }));
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  }, [connection, proposalAddress, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const walletGuard = useMemo(() => {
    if (!publicKey || !sendTransaction) {
      return "Connect the governance wallet to vote or execute transactions.";
    }
    return null;
  }, [publicKey, sendTransaction]);

  async function onCastVote(approve: boolean) {
    if (!publicKey || !sendTransaction) return;
    setBusy(approve ? "vote-yes" : "vote-no");
    setStatus(null);
    setTxUrl(null);
    try {
      const tx = await buildCastGovernanceVoteTx({
        approve,
        connection,
        owner: publicKey,
        proposalAddress: new PublicKey(proposalAddress),
      });
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: approve ? "Cast yes vote" : "Cast no vote",
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
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Vote submission failed.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onRelinquishVote() {
    if (!publicKey || !sendTransaction) return;
    setBusy("relinquish");
    setStatus(null);
    setTxUrl(null);
    try {
      const tx = await buildRelinquishGovernanceVoteTx({
        connection,
        owner: publicKey,
        proposalAddress: new PublicKey(proposalAddress),
      });
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: "Relinquish vote",
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
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Relinquish vote failed.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onExecuteTransaction(transactionAddress: string) {
    if (!detail || !publicKey || !sendTransaction) return;
    const proposalTransaction = detail.proposalTransactions.find((row) => row.address === transactionAddress);
    if (!proposalTransaction) return;
    setBusy(`execute:${transactionAddress}`);
    setStatus(null);
    setTxUrl(null);
    try {
      const tx = await buildExecuteGovernanceTransactionTx({
        connection,
        proposalAddress: new PublicKey(proposalAddress),
        proposalTransactionAddress: new PublicKey(transactionAddress),
        rawInstructions: proposalTransaction.rawInstructions,
        walletAddress: publicKey,
      });
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: `Execute instruction ${proposalTransaction.instructionIndex + 1}`,
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
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Execution failed.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="surface-card space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading proposal details...
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="surface-card space-y-3">
        <p className="metric-label">Proposal detail</p>
        <p className="field-help">Proposal details are unavailable for this network configuration.</p>
        {status ? <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p> : null}
      </section>
    );
  }

  const decimals = detail.tokenDecimals;
  const currentVote = detail.proposal.currentWalletVote;
  const canVote = detail.proposal.proposalState === 2;
  const pendingTransactions = detail.proposalTransactions.filter((row) => row.executionStatus !== 1);

  return (
    <section className={`surface-card ${sectionMode === "page" ? "space-y-5" : "space-y-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <VoteIcon className="h-4 w-4 text-[var(--accent)]" />
            <p className="metric-label">Proposal detail</p>
            <span className={`status-pill ${detail.proposal.group === "failed" ? "status-error" : "status-ok"}`}>
              {detail.proposal.stateLabel}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{detail.proposal.name}</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Proposal {shortAddress(detail.proposal.address)} by {shortAddress(detail.proposal.ownerWalletAddress)}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={toExplorerAddressLink(detail.proposal.address)}
            target="_blank"
            rel="noreferrer"
            className="secondary-button inline-flex w-fit items-center gap-2"
          >
            Explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {sectionMode === "inline" ? (
            <Link
              href={`/governance/proposals/${detail.proposal.address}`}
              className="secondary-button inline-flex w-fit"
            >
              Open page
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
          <p className="metric-label">Yes / deny</p>
          <p className="mt-2 text-lg font-semibold">
            {formatGovernanceAmount(detail.proposal.options[0]?.voteWeightRaw ?? 0n, decimals)}
            <span className="text-sm font-normal text-[var(--muted-foreground)]"> yes</span>
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {formatGovernanceAmount(detail.proposal.denyVoteWeightRaw ?? 0n, decimals)} deny
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
          <p className="metric-label">Instructions</p>
          <p className="mt-2 text-lg font-semibold">
            {detail.proposal.instructionExecutedCount}/{detail.proposal.instructionCount}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">Executed / total</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
          <p className="metric-label">Threshold</p>
          <p className="mt-2 text-lg font-semibold">
            {detail.proposal.voteThresholdPct != null ? `${detail.proposal.voteThresholdPct}%` : "n/a"}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">Community approval threshold</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
          <p className="metric-label">Your vote</p>
          <p className="mt-2 text-lg font-semibold">
            {currentVote?.isRelinquished ? "Relinquished" : currentVote?.choice ? currentVote.choice.toUpperCase() : "Not cast"}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {currentVote?.voterWeightRaw != null
              ? `${formatGovernanceAmount(currentVote.voterWeightRaw, decimals)} voting weight`
              : walletGuard ?? "Connect a wallet to vote."}
          </p>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.25fr,0.95fr]">
        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="metric-label">Description</p>
            {detail.proposal.descriptionLink ? (
              <a
                href={detail.proposal.descriptionLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Open description
              </a>
            ) : null}
          </div>
          <div className="grid gap-2 text-sm text-[var(--muted-foreground)]">
            <p>Proposal owner: <span className="font-mono text-[var(--foreground)]">{detail.proposalOwnerRecord?.governingTokenOwner ?? "Unavailable"}</span></p>
            <p>Realm: <span className="font-mono text-[var(--foreground)]">{detail.realmAddress}</span></p>
            <p>Governance: <span className="font-mono text-[var(--foreground)]">{detail.governanceAddress}</span></p>
            <p>Native treasury: <span className="font-mono text-[var(--foreground)]">{detail.nativeTreasuryAddress}</span></p>
            {detail.proposal.votingCompletedAtIso ? (
              <p>Voting completed: <span className="text-[var(--foreground)]">{new Date(detail.proposal.votingCompletedAtIso).toLocaleString()}</span></p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
          <p className="metric-label">Actions</p>
          {canVote ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="action-button"
                onClick={() => void onCastVote(true)}
                disabled={Boolean(walletGuard) || busy != null}
              >
                {busy === "vote-yes" ? "Submitting..." : "Vote yes"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onCastVote(false)}
                disabled={Boolean(walletGuard) || busy != null}
              >
                {busy === "vote-no" ? "Submitting..." : "Vote no"}
              </button>
              {currentVote ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void onRelinquishVote()}
                  disabled={Boolean(walletGuard) || busy != null}
                >
                  {busy === "relinquish" ? "Submitting..." : "Relinquish vote"}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="field-help">Voting is only available while the proposal is in the voting state.</p>
          )}

          {pendingTransactions.length > 0 ? (
            <div className="space-y-2">
              <p className="metric-label">Execution queue</p>
              {pendingTransactions.map((row) => (
                <div key={row.address} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)]/60 px-3 py-2">
                  <div className="text-sm text-[var(--muted-foreground)]">
                    Instruction {row.instructionIndex + 1} • {row.executionStatusLabel}
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onExecuteTransaction(row.address)}
                    disabled={Boolean(walletGuard) || busy != null}
                  >
                    {busy === `execute:${row.address}` ? "Executing..." : "Execute"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
                No pending execution steps remain for this proposal.
              </div>
            </div>
          )}

          {walletGuard ? <p className="field-help">{walletGuard}</p> : null}
          {status ? <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p> : null}
          {txUrl ? (
            <a href={txUrl} target="_blank" rel="noreferrer" className="secondary-button inline-flex w-fit">
              View transaction
            </a>
          ) : null}
        </article>
      </div>

      <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
        <p className="metric-label">Proposal transactions</p>
        {detail.proposalTransactions.length > 0 ? (
          <div className="space-y-2">
            {detail.proposalTransactions.map((row) => (
              <div key={row.address} className="rounded-2xl border border-[var(--border)]/60 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Instruction {row.instructionIndex + 1}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {row.executionStatusLabel} • hold-up {row.holdUpTimeSeconds}s • {shortAddress(row.address)}
                    </p>
                  </div>
                  <a
                    href={toExplorerAddressLink(row.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--accent)] hover:underline"
                  >
                    Explorer
                  </a>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {row.instructions.map((instruction, index) => (
                    <div key={`${row.address}:${index}`} className="rounded-2xl border border-[var(--border)]/50 bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
                      <p className="font-mono text-[var(--foreground)]">{instruction.programId}</p>
                      <p>{instruction.accountCount} accounts • {instruction.dataLength} bytes</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="field-help">This proposal does not expose any inserted transactions yet.</p>
        )}
      </article>
    </section>
  );
}
