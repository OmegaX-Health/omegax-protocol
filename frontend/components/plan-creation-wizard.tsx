// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

type StepId = "basics" | "membership" | "verification" | "outcome" | "funding";

const STEPS: Array<{ id: StepId; number: string; label: string }> = [
  { id: "basics", number: "01", label: "Basics" },
  { id: "membership", number: "02", label: "Membership" },
  { id: "verification", number: "03", label: "Verification" },
  { id: "outcome", number: "04", label: "Outcome Rules" },
  { id: "funding", number: "05", label: "Funding Review" },
];

const STEP_COPY: Record<StepId, { headline: string; emphasis: string; body: string; tip: string }> = {
  basics: {
    headline: "Define the fundamental objectives for your",
    emphasis: "Clinical Protocol.",
    body: "Every protocol starts with a clear mandate. Establish the identity and scope before configuring membership and outcome logic.",
    tip: "Descriptive titles increase operator clarity by 40%. Use precise medical or administrative nomenclature.",
  },
  membership: {
    headline: "Specify who can enlist into your",
    emphasis: "Cohort.",
    body: "Decide eligibility constraints, delegated rights, and enrolment windows. Membership rules are enforced on-chain at enlistment.",
    tip: "Narrow cohorts with precise rights produce cleaner comparability bands and faster claim adjudication.",
  },
  verification: {
    headline: "Anchor the verification stack for",
    emphasis: "Claims & Outcomes.",
    body: "Pick the oracle attestation path and evidence schema. This determines how submitted claims are trusted by the protocol.",
    tip: "Multi-source verification reduces dispute rate. Pair attestors across jurisdictions when possible.",
  },
  outcome: {
    headline: "Program the comparability logic and",
    emphasis: "Outcome Rules.",
    body: "Bind outcome templates, settlement curves, and payout triggers. These rules form the deterministic core of your plan.",
    tip: "Start with conservative thresholds — outcome rules are harder to amend once the plan is live.",
  },
  funding: {
    headline: "Review the funding surface and commit",
    emphasis: "Capital Lanes.",
    body: "Confirm the reserve domain, funding lines and initial capital commitments. This is the final step before the plan is activated.",
    tip: "All commitments are tracked on-chain. You can add lanes later, but the initial seed shapes early velocity.",
  },
};

type WizardState = {
  label: string;
  velocity: string;
  governance: string;
  jurisdiction: "NORTH_AMERICA" | "ASIA_PACIFIC" | "MIDDLE_EAST";
};

export function PlanCreationWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>({
    label: "",
    velocity: "Standard Monitoring",
    governance: "Automated (Oracle Driven)",
    jurisdiction: "NORTH_AMERICA",
  });

  const activeStep = STEPS[stepIndex]!;
  const copy = STEP_COPY[activeStep.id];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      router.push("/plans");
      return;
    }
    setStepIndex((index) => Math.min(STEPS.length - 1, index + 1));
  };

  const handleBack = () => {
    if (isFirstStep) return;
    setStepIndex((index) => Math.max(0, index - 1));
  };

  return (
    <div className="plans-shell">
      <div className="plans-wizard-scroll">
        {/* ── Wizard header strip ─────────── */}
        <header className="plans-wizard-header">
          <div className="plans-wizard-header-ident">
            <span className="plans-wizard-wordmark">PROTOCOL_CONSOLE</span>
            <span className="plans-wizard-header-divider" aria-hidden="true" />
            <span className="plans-wizard-header-label">New Health Plan Wizard</span>
          </div>
          <Link href="/plans" className="plans-wizard-cancel">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
            CANCEL_FLOW
          </Link>
        </header>

        {/* ── Progress pill ───────────────── */}
        <nav className="plans-wizard-progress-wrap" aria-label="Plan wizard steps">
          <div className="plans-wizard-progress liquid-glass">
            <div
              className="plans-wizard-progress-indicator"
              style={{ width: `${100 / STEPS.length}%`, transform: `translateX(${stepIndex * 100}%)` }}
              aria-hidden="true"
            />
            {STEPS.map((step, index) => {
              const isActive = index === stepIndex;
              const isPast = index < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={cn(
                    "plans-wizard-step",
                    isActive && "plans-wizard-step-active",
                    isPast && "plans-wizard-step-past",
                  )}
                  onClick={() => setStepIndex(index)}
                >
                  <span className="plans-wizard-step-number">{step.number}</span>
                  <span className="plans-wizard-step-label">{step.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Body: contextual prompt + form ── */}
        <section className="plans-wizard-body">
          <aside className="plans-wizard-prompt">
            <h1 className="plans-wizard-headline">
              {copy.headline} <em>{copy.emphasis}</em>
            </h1>
            <p className="plans-wizard-body-text">{copy.body}</p>
            <div className="plans-wizard-tip">
              <span className="plans-wizard-tip-label">[PROTOCOL_TIP]</span>
              <p>{copy.tip}</p>
            </div>
          </aside>

          <div className="plans-wizard-form heavy-glass">
            {activeStep.id === "basics" ? <BasicsStep state={state} setState={setState} /> : null}
            {activeStep.id === "membership" ? <MembershipStep /> : null}
            {activeStep.id === "verification" ? <VerificationStep /> : null}
            {activeStep.id === "outcome" ? <OutcomeStep /> : null}
            {activeStep.id === "funding" ? <FundingStep state={state} /> : null}

            <div className="plans-wizard-footer">
              <button
                type="button"
                className="plans-wizard-back"
                onClick={handleBack}
                disabled={isFirstStep}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                {isFirstStep ? "SAVE_AS_DRAFT" : "PREVIOUS"}
              </button>
              <button type="button" className="plans-wizard-next" onClick={handleNext}>
                <span className="material-symbols-outlined" aria-hidden="true">{isLastStep ? "bolt" : "arrow_forward"}</span>
                <span className="plans-wizard-next-label">
                  {isLastStep ? "ACTIVATE_PLAN" : `NEXT · ${STEPS[stepIndex + 1]!.label.toUpperCase()}`}
                </span>
              </button>
            </div>
          </div>
        </section>

        <div className="plans-wizard-progress-meta" aria-hidden="true">
          <span>STEP {activeStep.number} / 05</span>
          <span>{Math.round(progressPct)}% COMPLETE</span>
        </div>
      </div>
    </div>
  );
}

/* ── Step bodies ────────────────────────── */

function BasicsStep({ state, setState }: { state: WizardState; setState: (update: (prev: WizardState) => WizardState) => void }) {
  return (
    <div className="plans-wizard-step-body">
      <FieldGroup label="Plan Identity Label">
        <div className="plans-wizard-field plans-wizard-field-bar">
          <input
            type="text"
            className="plans-wizard-input plans-wizard-input-lg"
            placeholder="e.g. OMEGA-IV-DIABETES-REDUCTION"
            value={state.label}
            onChange={(event) => setState((prev) => ({ ...prev, label: event.target.value }))}
          />
        </div>
      </FieldGroup>

      <div className="plans-wizard-row">
        <FieldGroup label="Protocol Velocity">
          <select
            className="plans-wizard-input"
            value={state.velocity}
            onChange={(event) => setState((prev) => ({ ...prev, velocity: event.target.value }))}
          >
            <option>Standard Monitoring</option>
            <option>High-Intensity (Real-time)</option>
            <option>Long-tail (Quarterly)</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Governance Level">
          <select
            className="plans-wizard-input"
            value={state.governance}
            onChange={(event) => setState((prev) => ({ ...prev, governance: event.target.value }))}
          >
            <option>Automated (Oracle Driven)</option>
            <option>Human-in-the-loop</option>
            <option>Peer Review Consensus</option>
          </select>
        </FieldGroup>
      </div>

      <div className="plans-wizard-divider" aria-hidden="true" />

      <h3 className="plans-wizard-section-label">REGIONAL_COMPLIANCE</h3>

      <div className="plans-wizard-disabled-card">
        <div className="plans-wizard-disabled-head">
          <div>
            <span className="plans-wizard-field-label">Cross-Border Verification</span>
            <div className="plans-wizard-disabled-value">
              <span className="material-symbols-outlined" aria-hidden="true">lock</span>
              European Economic Area (EEA)
            </div>
          </div>
          <span className="plans-wizard-disabled-badge">Disabled</span>
        </div>
        <p className="plans-wizard-disabled-reason">
          REASON: Data residency module for EEA requires &apos;Level 3 Encryption&apos; certification which is currently missing from your
          laboratory profile.
        </p>
      </div>

      <FieldGroup label="Primary Jurisdiction">
        <div className="plans-wizard-chips">
          {(["NORTH_AMERICA", "ASIA_PACIFIC", "MIDDLE_EAST"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={cn("plans-wizard-chip", state.jurisdiction === key && "plans-wizard-chip-active")}
              onClick={() => setState((prev) => ({ ...prev, jurisdiction: key }))}
            >
              {key}
            </button>
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

function MembershipStep() {
  return (
    <div className="plans-wizard-step-body">
      <FieldGroup label="Cohort Strategy">
        <select className="plans-wizard-input" defaultValue="Open Enrolment">
          <option>Open Enrolment</option>
          <option>Invite Only</option>
          <option>Governance Gated</option>
        </select>
      </FieldGroup>

      <div className="plans-wizard-row">
        <FieldGroup label="Max Cohort Size">
          <input type="number" className="plans-wizard-input" placeholder="e.g. 5000" defaultValue="5000" />
        </FieldGroup>
        <FieldGroup label="Delegated Rights">
          <select className="plans-wizard-input" defaultValue="Read · Claim">
            <option>Read · Claim</option>
            <option>Read · Claim · Attest</option>
            <option>Read Only</option>
          </select>
        </FieldGroup>
      </div>

      <FieldGroup label="Enrolment Window">
        <div className="plans-wizard-row">
          <input type="date" className="plans-wizard-input" defaultValue="2026-04-15" />
          <input type="date" className="plans-wizard-input" defaultValue="2026-10-15" />
        </div>
      </FieldGroup>
    </div>
  );
}

function VerificationStep() {
  return (
    <div className="plans-wizard-step-body">
      <FieldGroup label="Attestation Source">
        <select className="plans-wizard-input" defaultValue="Multi-source Oracle (recommended)">
          <option>Multi-source Oracle (recommended)</option>
          <option>Single Trusted Attestor</option>
          <option>Peer Network Consensus</option>
        </select>
      </FieldGroup>

      <FieldGroup label="Evidence Schema">
        <select className="plans-wizard-input" defaultValue="Clinical Outcome v2">
          <option>Clinical Outcome v2</option>
          <option>Research Milestone v1</option>
          <option>Custom Schema</option>
        </select>
      </FieldGroup>

      <FieldGroup label="Dispute Window (hours)">
        <input type="number" className="plans-wizard-input" placeholder="72" defaultValue="72" />
      </FieldGroup>
    </div>
  );
}

function OutcomeStep() {
  return (
    <div className="plans-wizard-step-body">
      <FieldGroup label="Comparability Key">
        <input type="text" className="plans-wizard-input" placeholder="e.g. HbA1c_REDUCTION_90D" defaultValue="HbA1c_REDUCTION_90D" />
      </FieldGroup>

      <div className="plans-wizard-row">
        <FieldGroup label="Settlement Curve">
          <select className="plans-wizard-input" defaultValue="Linear">
            <option>Linear</option>
            <option>Stepped</option>
            <option>Bonded</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Payout Trigger">
          <select className="plans-wizard-input" defaultValue="Outcome Verified">
            <option>Outcome Verified</option>
            <option>Time-based Unlock</option>
            <option>Hybrid</option>
          </select>
        </FieldGroup>
      </div>

      <FieldGroup label="Outcome Count">
        <input type="number" className="plans-wizard-input" placeholder="e.g. 3" defaultValue="3" />
      </FieldGroup>
    </div>
  );
}

function FundingStep({ state }: { state: WizardState }) {
  return (
    <div className="plans-wizard-step-body">
      <div className="plans-wizard-review-grid">
        <ReviewRow label="PLAN_IDENTITY" value={state.label || "— not set —"} />
        <ReviewRow label="PROTOCOL_VELOCITY" value={state.velocity} />
        <ReviewRow label="GOVERNANCE" value={state.governance} />
        <ReviewRow label="JURISDICTION" value={state.jurisdiction} />
      </div>

      <div className="plans-wizard-divider" aria-hidden="true" />

      <FieldGroup label="Initial Commitment (USDC)">
        <input type="number" className="plans-wizard-input plans-wizard-input-lg" placeholder="250000" defaultValue="250000" />
      </FieldGroup>

      <div className="plans-wizard-row">
        <FieldGroup label="Reserve Domain">
          <select className="plans-wizard-input" defaultValue="Auto (sponsor operator)">
            <option>Auto (sponsor operator)</option>
            <option>Shared Domain</option>
            <option>Custom Domain</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Funding Line Type">
          <select className="plans-wizard-input" defaultValue="Primary Reserve">
            <option>Primary Reserve</option>
            <option>Catastrophe Layer</option>
            <option>Dispute Buffer</option>
          </select>
        </FieldGroup>
      </div>
    </div>
  );
}

/* ── Reusable bits ──────────────────────── */

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="plans-wizard-review-row">
      <span className="plans-wizard-review-label">{label}</span>
      <strong className="plans-wizard-review-value">{value}</strong>
    </div>
  );
}
