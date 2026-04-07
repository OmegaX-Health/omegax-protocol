// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ExternalLink, LoaderCircle, Vote as VoteIcon } from "lucide-react";

import {
  formatGovernanceAmount,
  loadGovernanceProposalDetail,
  type GovernanceProposalDetailSummary,
} from "@/lib/governance-readonly";
import { toExplorerAddressLink } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type GovernanceProposalReadonlyPanelProps = {
  proposalAddress: string;
};

function shortAddress(value: string | null | undefined): string {
  if (!value) return "n/a";
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function GovernanceProposalReadonlyPanel({
  proposalAddress,
}: GovernanceProposalReadonlyPanelProps) {
  const { connection } = useConnection();
  const [detail, setDetail] = useState<GovernanceProposalDetailSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const nextDetail = await loadGovernanceProposalDetail({
        connection,
        proposalAddress: new PublicKey(proposalAddress),
      });
      setDetail(nextDetail);
    } catch (cause) {
      setStatus(formatRpcError(cause, {
        fallback: "Failed to load proposal details.",
        rpcEndpoint: connection.rpcEndpoint,
      }));
    } finally {
      setLoading(false);
    }
  }, [connection, proposalAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decimals = detail?.tokenDecimals ?? 0;
  const primaryOption = useMemo(() => detail?.proposal.options[0] ?? null, [detail]);

  if (loading && !detail) {
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
        {status ? <p className="field-error">{status}</p> : null}
      </section>
    );
  }

  return (
    <section className="surface-card space-y-5">
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

        <a
          href={toExplorerAddressLink(detail.proposal.address)}
          target="_blank"
          rel="noreferrer"
          className="secondary-button inline-flex w-fit items-center gap-2"
        >
          Explorer
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
          <p className="metric-label">Yes / deny</p>
          <p className="mt-2 text-lg font-semibold">
            {formatGovernanceAmount(primaryOption?.voteWeightRaw ?? 0n, decimals)}
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
          <p className="metric-label">Voting closed</p>
          <p className="mt-2 text-lg font-semibold">
            {detail.proposal.votingCompletedAtIso
              ? new Date(detail.proposal.votingCompletedAtIso).toLocaleDateString()
              : "Open"}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {detail.proposal.votingCompletedAtIso
              ? new Date(detail.proposal.votingCompletedAtIso).toLocaleTimeString()
              : "Voting is still active or not yet complete."}
          </p>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr,0.95fr]">
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
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
          <p className="metric-label">Vote breakdown</p>
          <div className="grid gap-2 text-sm text-[var(--muted-foreground)]">
            <p>Yes: <span className="text-[var(--foreground)]">{formatGovernanceAmount(primaryOption?.voteWeightRaw ?? 0n, decimals)}</span></p>
            <p>Deny: <span className="text-[var(--foreground)]">{formatGovernanceAmount(detail.proposal.denyVoteWeightRaw ?? 0n, decimals)}</span></p>
            <p>Abstain: <span className="text-[var(--foreground)]">{formatGovernanceAmount(detail.proposal.abstainVoteWeightRaw ?? 0n, decimals)}</span></p>
            <p>Veto: <span className="text-[var(--foreground)]">{formatGovernanceAmount(detail.proposal.vetoVoteWeightRaw, decimals)}</span></p>
            <p>Max vote weight: <span className="text-[var(--foreground)]">{formatGovernanceAmount(detail.proposal.maxVoteWeightRaw ?? 0n, decimals)}</span></p>
          </div>
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
          <p className="field-help">This proposal does not currently expose any queued transactions.</p>
        )}
      </article>

      {status ? <p className="field-error">{status}</p> : null}
    </section>
  );
}
