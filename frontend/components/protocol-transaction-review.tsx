// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { WizardDetailSheet } from "@/components/wizard-detail-sheet";
import type {
  ProtocolTransactionReview,
  ProtocolTransactionReviewConfirmation,
} from "@/lib/protocol-action";

type PendingReview = {
  review: ProtocolTransactionReview;
  resolve: (approved: boolean) => void;
};

function formatLamports(value: number | null): string {
  if (value === null) return "Unavailable";
  const sol = value / 1_000_000_000;
  return `${value.toLocaleString()} lamports (${sol.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL)`;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="plans-wizard-review-row">
      <span className="plans-wizard-review-label">{label}</span>
      <strong className="plans-wizard-review-value">{value}</strong>
    </div>
  );
}

function ProtocolTransactionReviewSheet({
  pending,
  onDecision,
}: {
  pending: PendingReview | null;
  onDecision: (approved: boolean) => void;
}) {
  const review = pending?.review ?? null;
  return (
    <WizardDetailSheet
      open={Boolean(review)}
      title="Pre-sign review"
      summary="Confirm the transaction details before the wallet signing prompt opens."
      meta={review ? [{ label: review.label, tone: "accent" }] : []}
      size="wide"
      onOpenChange={(open) => {
        if (!open) onDecision(false);
      }}
    >
      {review ? (
        <div className="wizard-detail-stack">
          <section className="wizard-detail-card">
            <div className="wizard-detail-card-head">
              <div>
                <p className="wizard-detail-card-eyebrow">Transaction</p>
                <h3 className="wizard-detail-card-title">{review.label}</h3>
              </div>
              <span className="wizard-detail-chip wizard-detail-chip-accent">
                {review.simulation.ok ? "Simulation passed" : "Simulation failed"}
              </span>
            </div>
            <div className="plans-wizard-review-grid">
              <ReviewRow label="Authority" value={review.authority} />
              <ReviewRow label="Fee payer" value={review.feePayer} />
              <ReviewRow label="Affected object" value={review.affectedObject} />
              <ReviewRow label="Economic effect" value={review.economicEffect} />
              <ReviewRow label="Estimated fee" value={formatLamports(review.estimatedFeeLamports)} />
              <ReviewRow label="Simulation" value={review.simulation.error ?? "Passed"} />
            </div>
          </section>

          {review.warnings.length > 0 ? (
            <section className="wizard-detail-card">
              <div className="wizard-detail-card-head">
                <div>
                  <p className="wizard-detail-card-eyebrow">Warnings</p>
                  <h3 className="wizard-detail-card-title">Operator checks</h3>
                </div>
                <span className="wizard-detail-chip wizard-detail-chip-muted">{review.warnings.length}</span>
              </div>
              <div className="space-y-2">
                {review.warnings.map((warning) => (
                  <div key={warning} className="plans-notice liquid-glass" role="status">
                    <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">warning</span>
                    <p>{warning}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {review.simulation.logs.length > 0 ? (
            <section className="wizard-detail-card">
              <div className="wizard-detail-card-head">
                <div>
                  <p className="wizard-detail-card-eyebrow">Simulation</p>
                  <h3 className="wizard-detail-card-title">Program logs</h3>
                </div>
                <span className="wizard-detail-chip wizard-detail-chip-muted">{review.simulation.logs.length}</span>
              </div>
              <pre className="wizard-detail-code-block">{review.simulation.logs.slice(0, 20).join("\n")}</pre>
            </section>
          ) : null}

          <div className="operator-drawer-actions">
            <button type="button" className="secondary-button" onClick={() => onDecision(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="plans-wizard-next"
              onClick={() => onDecision(true)}
              disabled={!review.simulation.ok}
            >
              <span className="material-symbols-outlined" aria-hidden="true">account_balance_wallet</span>
              <span className="plans-wizard-next-label">CONTINUE_TO_WALLET</span>
            </button>
          </div>
        </div>
      ) : null}
    </WizardDetailSheet>
  );
}

export function useProtocolTransactionReviewPrompt(): {
  confirmReview: ProtocolTransactionReviewConfirmation;
  reviewPrompt: ReactNode;
} {
  const [pending, setPending] = useState<PendingReview | null>(null);

  const confirmReview = useCallback<ProtocolTransactionReviewConfirmation>((review) => new Promise<boolean>((resolve) => {
    setPending((current) => {
      current?.resolve(false);
      return { review, resolve };
    });
  }), []);

  const onDecision = useCallback((approved: boolean) => {
    setPending((current) => {
      current?.resolve(approved);
      return null;
    });
  }, []);

  const reviewPrompt = useMemo(
    () => <ProtocolTransactionReviewSheet pending={pending} onDecision={onDecision} />,
    [onDecision, pending],
  );

  return { confirmReview, reviewPrompt };
}
