// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import {
  CheckCircle2,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Network,
  ReceiptText,
} from "lucide-react";

import { useNetworkContext } from "@/components/network-context";

const DEVNET_REVIEW_PROGRAM_ID = "FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn";

const proofSignals = [
  {
    icon: <EyeOff className="h-4 w-4" strokeWidth={1.9} />,
    label: "Evidence privacy",
    value: "Private docs",
    meta: "Raw files stay off-chain",
  },
  {
    icon: <Network className="h-4 w-4" strokeWidth={1.9} />,
    label: "Review lane",
    value: "Devnet ER",
    meta: "Session PDA only",
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />,
    label: "Public output",
    value: "Hash receipt",
    meta: "No clinical content",
  },
  {
    icon: <ReceiptText className="h-4 w-4" strokeWidth={1.9} />,
    label: "Settlement",
    value: "Solana kernel",
    meta: "Standard reserve path",
  },
] as const;

const proofSteps = [
  {
    label: "Prepare",
    title: "Evidence packet",
    detail:
      "Medical documents stay inside the review workspace. The public trail keeps safe metadata and a checksum.",
  },
  {
    label: "Open",
    title: "Base-layer session",
    detail:
      "Solana anchors the review-session PDA, schema hash, and evidence checksum without exposing source documents.",
  },
  {
    label: "Delegate",
    title: "Devnet review lane",
    detail:
      "Only the review-session PDA is delegated to MagicBlock. Claim cases, reserves, vaults, and obligations stay on the standard protocol.",
  },
  {
    label: "Review",
    title: "Reviewer result",
    detail:
      "The reviewer checks completeness and emits result hashes plus artifact references. Raw PHI is never published here.",
  },
  {
    label: "Reference",
    title: "Payment ref preview",
    detail:
      "Payment-reference storage is devnet demo evidence only. Production reimbursement still uses the normal reserve and claim-settlement kernel.",
  },
  {
    label: "Commit",
    title: "Public receipt out",
    detail:
      "The session commits a review receipt that claim operators can verify before using the normal attestation path.",
  },
] as const;

const visibleRecords = [
  {
    label: "Devnet review program",
    value: DEVNET_REVIEW_PROGRAM_ID,
    detail: "Public devnet program anchoring the demo review receipt.",
  },
  {
    label: "Private intake",
    value: "Evidence checksum",
    detail: "Medical records remain off-chain and private to the review workspace.",
  },
  {
    label: "Public attestation input",
    value: "Review receipt",
    detail: "The public record receives the final review hash receipt, not the raw packet.",
  },
] as const;

export function MagicBlockClaimRoomWorkbench() {
  const { selectedNetwork } = useNetworkContext();
  const isMainnet = selectedNetwork === "mainnet-beta";
  const networkLabel = isMainnet ? "Mainnet" : "Devnet";
  const postureLabel = isMainnet ? "Mainnet preview" : "Devnet demo";
  const postureCopy = isMainnet
    ? "No MagicBlock private-review program is configured on mainnet. Production claims stay on the standard Solana claim, oracle, and reserve-settlement path."
    : "The MagicBlock adjunct is available as a devnet-only private-review demo. It is not an authoritative public claim action surface.";

  const auditRows = isMainnet
    ? [
        {
          label: "Mainnet status",
          value: "Not configured",
          detail: "This route intentionally fails closed on mainnet until a separate production review program is approved.",
        },
        ...visibleRecords.slice(1),
      ]
    : visibleRecords;

  return (
    <div className="plans-shell">
      <div className="plans-scroll">
        <header className="plans-hero">
          <div className="plans-hero-glow" aria-hidden="true" />
          <div className="plans-hero-head">
            <div className="plans-hero-copy">
              <span className="plans-hero-eyebrow">Private claim review</span>
              <h1 className="plans-hero-title">
                MagicBlock review <em>receipt</em>
              </h1>
              <p className="plans-hero-subtitle">
                {postureCopy}
              </p>
            </div>
            <div className="plans-hero-actions">
              <span className="plans-secondary-cta plans-action-disabled" aria-disabled="true">
                <LockKeyhole className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                {postureLabel}
              </span>
            </div>
          </div>
        </header>

        <section className="plans-kpi-strip" aria-label="Claim privacy audit signals">
          {proofSignals.map((signal) => (
            <div key={signal.label} className="plans-kpi-metric">
              <span className="plans-kpi-label">{signal.label}</span>
              <span className="plans-kpi-value">
                {signal.icon}
                {signal.value}
              </span>
              <span className="plans-kpi-meta">{signal.meta}</span>
            </div>
          ))}
        </section>

        <div className="plans-body">
          <section className="plans-main">
            <article className="plans-card heavy-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">Review flow</p>
                  <h2 className="plans-card-title plans-card-title-display">
                    Private review, <em>public receipt</em>
                  </h2>
                </div>
                <span className="plans-card-meta">
                  <span className="plans-live-dot" aria-hidden="true" />
                  {networkLabel}
                </span>
              </div>
              <p className="plans-card-body">
                This public page is a receipt-inspection and architecture surface. It does not create claims, upload documents, or move reimbursement funds.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {proofSteps.map((step, index) => (
                  <ProofStep key={step.label} step={step} index={index} />
                ))}
              </div>
            </article>
          </section>

          <aside className="plans-rail">
            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">Audit anchor</span>
                <span className="plans-rail-subtag">{postureLabel}</span>
              </div>
              <div className="plans-rail-hero">
                <span className="plans-rail-hero-val">Claim review trail</span>
                <span className="plans-rail-hero-sub">
                  Private evidence in. Public receipt out. Settlement stays on Solana.
                </span>
              </div>
            </section>

            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">Visible records</span>
                <span className="plans-rail-subtag">No documents</span>
              </div>
              <div className="plans-rail-trail">
                {auditRows.map((row) => (
                  <ProofRow key={row.label} {...row} />
                ))}
              </div>
            </section>

            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">Boundary</span>
                <Fingerprint
                  className="h-5 w-5 text-[color:var(--accent)]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
              <p className="plans-rail-empty-copy">
                Operator APIs remain private; this public view shows only receipt posture and safe audit metadata.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProofStep({
  step,
  index,
}: {
  step: (typeof proofSteps)[number];
  index: number;
}) {
  return (
    <div className="workbench-inline-card">
      <div className="flex items-center justify-between gap-3">
        <span className="workbench-card-meta">{String(index + 1).padStart(2, "0")}</span>
        {index < proofSteps.length - 1 ? (
          <span className="claim-room-step-rule" aria-hidden="true" />
        ) : (
          <ReceiptText
            className="h-4 w-4 text-[color:var(--accent)]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        )}
      </div>
      <p className="mt-4 workbench-panel-eyebrow">{step.label}</p>
      <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
        {step.detail}
      </p>
    </div>
  );
}

function ProofRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="plans-rail-event plans-rail-event-verified">
      <span className="plans-rail-event-dot" aria-hidden="true" />
      <div className="plans-rail-event-copy">
        <div className="plans-rail-event-row">
          <strong className="plans-rail-event-label">{label}</strong>
        </div>
        <p className="plans-rail-event-detail">{detail}</p>
        <p className="mt-1 break-all font-mono text-[0.66rem] leading-5 text-[color:var(--foreground)]">
          {value}
        </p>
      </div>
    </div>
  );
}
