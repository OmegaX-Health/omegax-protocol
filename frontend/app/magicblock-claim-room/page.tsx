// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  LockKeyhole,
  Network,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

const REVIEW_PROGRAM_ID = "FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn";

const proofSteps = [
  {
    label: "Prepare",
    title: "Redacted medical packet",
    detail:
      "The claim room hashes the evidence bundle and shows only safe document metadata.",
  },
  {
    label: "Open",
    title: "Base Solana session",
    detail:
      "A public review-session PDA links the claim case, schema hash, and evidence hash.",
  },
  {
    label: "Delegate",
    title: "MagicBlock ER handoff",
    detail:
      "The review session moves into the low-latency MagicBlock execution lane.",
  },
  {
    label: "Review",
    title: "Private reviewer output",
    detail:
      "The TEE reviewer checks completeness and emits result and artifact hashes.",
  },
  {
    label: "Pay",
    title: "Private payment preview",
    detail:
      "A devnet reimbursement preview proves the private payment rail was invoked.",
  },
  {
    label: "Commit",
    title: "Public proof out",
    detail:
      "The session commits back to Solana and the existing claim attestation path consumes it.",
  },
] as const;

export const metadata: Metadata = {
  title: "MagicBlock Claim Room | OmegaX Protocol",
  description:
    "A MagicBlock-powered private claim review room for OmegaX Protect medical claims.",
};

export default function MagicBlockClaimRoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="flex min-h-[28rem] flex-col justify-between rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-6 shadow-[var(--surface-shadow)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--signal-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--accent-strong)]">
              <LockKeyhole className="h-3.5 w-3.5" strokeWidth={1.9} />
              MagicBlock privacy track
            </span>
            <span className="inline-flex rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
              ER + PER + Private Payments
            </span>
          </div>

          <div className="max-w-2xl">
            <h1 className="mt-10 text-balance font-[var(--font-display)] text-4xl font-semibold leading-tight sm:text-5xl">
              OmegaX Private Claim Room
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[color:var(--muted-foreground)]">
              Private medical evidence goes into a MagicBlock claim room; public
              Solana only sees verifiable review and settlement proofs.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <Signal
              icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.9} />}
              label="Private evidence in"
              value="Only hashes on-chain"
            />
            <Signal
              icon={<Network className="h-4 w-4" strokeWidth={1.9} />}
              label="MagicBlock review"
              value="Delegated session PDA"
            />
            <Signal
              icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />}
              label="Public proof out"
              value="attest_claim_case"
            />
          </div>
        </div>

        <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--surface-shadow)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
                Live demo surface
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                Claim-room proof trail
              </h2>
            </div>
            <Fingerprint
              className="h-5 w-5 text-[color:var(--accent)]"
              strokeWidth={1.8}
            />
          </div>

          <div className="mt-5 space-y-3">
            <ProofRow label="Adjunct program" value={REVIEW_PROGRAM_ID} />
            <ProofRow
              label="Base route"
              value="POST /v1/internal/magicblock/claim-room/open"
            />
            <ProofRow
              label="ER route"
              value="POST /v1/internal/magicblock/claim-room/review"
            />
            <ProofRow
              label="Payment route"
              value="POST /v1/internal/magicblock/claim-room/private-payment"
            />
            <ProofRow
              label="Final route"
              value="POST /v1/internal/magicblock/claim-room/commit"
            />
          </div>

          <div className="mt-6 rounded-[8px] border border-[color:var(--border-strong)] bg-[color:var(--status-surface)] p-4">
            <p className="text-sm font-semibold">Judging line</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
              Private evidence in. Public proof out. Settlement stays on Solana.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {proofSteps.map((step, index) => (
          <div
            key={step.label}
            className="flex min-h-[10rem] flex-col justify-between rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[color:var(--signal-soft)] px-2 text-xs font-semibold text-[color:var(--accent-strong)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              {index < proofSteps.length - 1 ? (
                <ArrowRight
                  className="h-4 w-4 text-[color:var(--muted-foreground)]"
                  strokeWidth={1.8}
                />
              ) : (
                <ReceiptText
                  className="h-4 w-4 text-[color:var(--accent)]"
                  strokeWidth={1.8}
                />
              )}
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
                {step.label}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                {step.detail}
              </p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Signal({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <div className="flex items-center gap-2 text-[color:var(--accent)]">
        {icon}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
        {label}
      </span>
      <span className="break-all font-mono text-xs text-[color:var(--foreground)]">
        {value}
      </span>
    </div>
  );
}
