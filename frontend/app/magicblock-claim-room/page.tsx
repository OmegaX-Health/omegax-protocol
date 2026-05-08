// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  Network,
  ReceiptText,
} from "lucide-react";

const REVIEW_PROGRAM_ID = "FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn";

const proofSteps = [
  {
    label: "Prepare",
    title: "Redacted evidence packet",
    detail:
      "Medical documents stay private. The room keeps only safe metadata and a bundle checksum for audit.",
  },
  {
    label: "Open",
    title: "Public review session",
    detail:
      "Solana anchors the claim case, schema hash, and evidence checksum without exposing the documents.",
  },
  {
    label: "Delegate",
    title: "Private execution lane",
    detail:
      "MagicBlock runs the private review session where reviewer output can be prepared quickly.",
  },
  {
    label: "Review",
    title: "Private reviewer output",
    detail:
      "The reviewer checks completeness and emits only result hashes and artifact references.",
  },
  {
    label: "Pay",
    title: "Private payment preview",
    detail:
      "A devnet reimbursement preview confirms the private payment rail was invoked.",
  },
  {
    label: "Commit",
    title: "Public proof out",
    detail:
      "The room commits a public proof that the claim attestation and settlement flow can use.",
  },
] as const;

const proofSignals = [
  {
    icon: <EyeOff className="h-4 w-4" strokeWidth={1.9} />,
    label: "Evidence privacy",
    value: "Private docs",
  },
  {
    icon: <Network className="h-4 w-4" strokeWidth={1.9} />,
    label: "Review session",
    value: "Room review",
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />,
    label: "Public output",
    value: "Solana proof",
  },
  {
    icon: <ReceiptText className="h-4 w-4" strokeWidth={1.9} />,
    label: "Settlement",
    value: "Proof linked",
  },
] as const;

const auditRows = [
  {
    label: "Review program",
    value: REVIEW_PROGRAM_ID,
    detail: "Public program anchoring the demo proof trail.",
  },
  {
    label: "Private intake",
    value: "Evidence checksum",
    detail: "Medical records remain off-chain and private to the review room.",
  },
  {
    label: "Public attestation",
    value: "Claim proof",
    detail: "The public record receives the final review proof, not the raw packet.",
  },
] as const;

export const metadata: Metadata = {
  title: "MagicBlock Claim Room | OmegaX Protocol",
  description:
    "A MagicBlock-powered private claim review room for OmegaX Protect medical claims.",
};

export default function MagicBlockClaimRoomPage() {
  return (
    <div className="plans-shell">
      <div className="plans-scroll">
        <header className="plans-hero">
          <div className="plans-hero-glow" aria-hidden="true" />
          <div className="plans-hero-head">
            <div className="plans-hero-copy">
              <span className="plans-hero-eyebrow">Private claim review</span>
              <h1 className="plans-hero-title">
                OmegaX private <em>claim room</em>
              </h1>
              <p className="plans-hero-subtitle">
                A MagicBlock review room keeps medical evidence private while Solana receives the proof needed for public settlement.
              </p>
            </div>
            <div className="plans-hero-actions">
              <span className="plans-secondary-cta plans-action-disabled" aria-disabled="true">
                <LockKeyhole className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                Demo surface
              </span>
            </div>
          </div>
        </header>

        <section className="plans-kpi-strip" aria-label="Private claim room guarantees">
          {proofSignals.map((signal) => (
            <div key={signal.label} className="plans-kpi-metric">
              <span className="plans-kpi-label">{signal.label}</span>
              <span className="plans-kpi-value">
                {signal.icon}
                {signal.value}
              </span>
              <span className="plans-kpi-meta">claim-room guarantee</span>
            </div>
          ))}
        </section>

        <div className="plans-body">
          <section className="plans-main">
            <article className="plans-card heavy-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">Proof flow</p>
                  <h2 className="plans-card-title plans-card-title-display">
                    Private review, <em>public proof</em>
                  </h2>
                </div>
                <span className="plans-card-meta">
                  <span className="plans-live-dot" aria-hidden="true" />
                  Demo
                </span>
              </div>
              <p className="plans-card-body">
                The room separates medical evidence from settlement evidence. Operators can verify the proof trail without publishing the source documents.
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
                <span className="plans-rail-subtag">Public proof</span>
              </div>
              <div className="plans-rail-hero">
                <span className="plans-rail-hero-val">Claim proof trail</span>
                <span className="plans-rail-hero-sub">
                  Private evidence in. Public proof out. Settlement stays on Solana.
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
                <span className="plans-rail-tag">Demo posture</span>
                <Fingerprint
                  className="h-5 w-5 text-[color:var(--accent)]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
              <p className="plans-rail-empty-copy">
                Operator APIs remain private; this public view shows the proof record only.
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
          <ArrowRight
            className="h-4 w-4 text-[color:var(--muted-foreground)]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
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
          <FileCheck2 className="h-3.5 w-3.5 text-[color:var(--accent)]" strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="plans-rail-event-detail">{detail}</p>
        <p className="mt-1 break-all font-mono text-[0.66rem] leading-5 text-[color:var(--foreground)]">
          {value}
        </p>
      </div>
    </div>
  );
}
