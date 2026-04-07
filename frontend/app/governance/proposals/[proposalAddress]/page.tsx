// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

import { ProtocolSummaryRail } from "@/components/protocol-summary-rail";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { shortenAddress } from "@/lib/protocol";

const PROPOSAL_TEMPLATE_ROWS = [
  {
    id: "reserve-domain-controls",
    label: "Reserve Domain Controls",
    scope: "Reserve custody, wrapper rails, and domain-only redemptions",
  },
  {
    id: "health-plan-controls",
    label: "Health Plan Controls",
    scope: "Plan operations, series versioning, and sponsor/member rights boundaries",
  },
  {
    id: "capital-class-controls",
    label: "Capital Class Controls",
    scope: "Capital-class exposure controls, queue policy, and wrapper segmentation",
  },
  {
    id: "allocation-freeze",
    label: "Allocation Freeze",
    scope: "Sentinel freezes, impairment response, and exit conditions",
  },
] as const;

const PROPOSAL_STATES = [
  { label: "Active review", tone: "status-ok", stage: "Vote open" },
  { label: "Queued execution", tone: "status-off", stage: "Awaiting execution" },
  { label: "Sentinel escalation", tone: "status-error", stage: "Incident review" },
] as const;

function proposalSeed(value: string): number {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export default function GovernanceProposalPage({
  params,
}: {
  params: { proposalAddress: string };
}) {
  const proposalAddress = params.proposalAddress;
  const seed = proposalSeed(proposalAddress);
  const template = PROPOSAL_TEMPLATE_ROWS[seed % PROPOSAL_TEMPLATE_ROWS.length];
  const ownerWallet =
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets[seed % DEVNET_PROTOCOL_FIXTURE_STATE.wallets.length] ??
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0];
  const roleRow =
    DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.find((row) => row.role === ownerWallet.role) ??
    DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix[0];
  const proposalState = PROPOSAL_STATES[seed % PROPOSAL_STATES.length];
  const voteFor = 52 + (seed % 27);
  const voteAgainst = 100 - voteFor;
  const slot = 453_810_000 + seed * 17;
  const epoch = 1_050 + (seed % 9);
  const instructionRows = [
    {
      label: "Authority fit",
      copy: `Confirm ${ownerWallet.label.toLowerCase()} is the signer lane intended to touch this control family.`,
      review: "Signer review",
    },
    {
      label: "Economic blast radius",
      copy: "Verify the proposal does not backdoor sponsor budgets, historical claims, or capital-class accounting outside its stated scope.",
      review: "Risk review",
    },
    {
      label: "Execution boundary",
      copy: "Document the exact parameter, pause state, or role-scoped action expected to move after approval.",
      review: "Execution review",
    },
    {
      label: "Fallback posture",
      copy: "Explain the recovery lane if the proposal halts live operations or needs a controlled rollback after execution.",
      review: "Ops review",
    },
  ];
  const executionSteps = [
    {
      label: "Template linkage",
      copy: `Tie the proposal body to ${template.label} so reviewers can audit scope before reading executable instructions.`,
    },
    {
      label: "Authority confirmation",
      copy: `${ownerWallet.label} stays visible as the execution lane, with ${roleRow.actions[0] ?? "scoped control"} as the leading action family.`,
    },
    {
      label: "Post-vote action",
      copy: `Apply one bounded change to ${template.scope.toLowerCase()} and keep adjacent ledgers explicitly out of scope.`,
    },
  ];

  return (
    <div className="protocol-page">
      <section className="protocol-hero protocol-hero-bleed">
        <div className="protocol-hero-grid">
          <div className="protocol-hero-copy">
            <p className="protocol-kicker">Governance proposal route</p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-4">
                <h1 className="protocol-title text-[clamp(1.96rem,4.3vw,3.08rem)]">{shortenAddress(proposalAddress, 8)}</h1>
                <p className="protocol-lead">
                  Proposal detail routes should read like operational inspectors: one template, one authority family, one
                  visible blast radius, and one explicit execution boundary.
                </p>
              </div>
              <span className={`status-pill ${proposalState.tone}`}>{proposalState.label}</span>
            </div>
            <div className="protocol-actions">
              <Link href="/governance" className="secondary-button inline-flex">
                Back to governance
              </Link>
              <Link href={`/governance/descriptions/${template.id}`} className="action-button inline-flex">
                Open template
              </Link>
            </div>
            <div className="protocol-metric-band">
              <div className="protocol-band-grid">
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Proposal address</span>
                  <span className="protocol-band-value">{shortenAddress(proposalAddress, 6)}</span>
                </div>
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Execution stage</span>
                  <span className="protocol-band-value">{proposalState.stage}</span>
                </div>
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Review window</span>
                  <span className="protocol-band-value">Epoch {epoch}</span>
                </div>
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Observed slot</span>
                  <span className="protocol-band-value">{slot.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <ProtocolSummaryRail
            title="Route snapshot"
            items={[
              {
                label: "Linked template",
                value: template.label,
                detail: "The proposal inherits one scoped template.",
              },
              {
                label: "Authority lane",
                value: ownerWallet.label,
                detail: "Signer posture stays visible for control-family review.",
              },
              {
                label: "Vote posture",
                value: `${voteFor}% for`,
                detail: `${voteAgainst}% remains against or unresolved.`,
              },
            ]}
          />
        </div>
      </section>

      <section className="protocol-section">
        <div className="protocol-workspace-grid">
          <div className="protocol-workspace-main">
            <div className="surface-card space-y-4">
              <div className="protocol-section-head">
                <div>
                  <p className="protocol-kicker">Review record</p>
                  <h2 className="protocol-section-title">Proposal routes should expose the full review posture before anyone executes a control change.</h2>
                </div>
                <span className="status-pill status-off">{template.id}</span>
              </div>
              <div className="protocol-register">
                {instructionRows.map((row) => (
                  <article key={row.label} className="protocol-register-row">
                    <div>
                      <strong>{row.label}</strong>
                      <p className="protocol-section-copy">{row.copy}</p>
                    </div>
                    <div className="protocol-register-metrics">
                      <span>{row.review}</span>
                      <span>Epoch {epoch}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="surface-card space-y-4">
              <div className="protocol-section-head">
                <div>
                  <p className="protocol-kicker">Execution path</p>
                  <h2 className="protocol-section-title">The route should make the post-vote sequence legible even before a wallet signs.</h2>
                </div>
                <span className={`status-pill ${proposalState.tone}`}>{proposalState.stage}</span>
              </div>
              <div className="protocol-grid-2">
                {executionSteps.map((step) => (
                  <article key={step.label} className="protocol-data-card">
                    <p className="protocol-metric-label">Instruction step</p>
                    <h3 className="text-xl font-semibold">{step.label}</h3>
                    <p className="protocol-section-copy">{step.copy}</p>
                  </article>
                ))}
                <article className="protocol-data-card">
                  <p className="protocol-metric-label">Vote split</p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="protocol-meta">For</span>
                        <span className="protocol-address">{voteFor}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--status-surface)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)] shadow-[0_0_16px_rgba(51,197,244,0.24)]"
                          style={{ width: `${voteFor}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="protocol-meta">Against / unresolved</span>
                        <span className="protocol-address">{voteAgainst}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--status-surface)]">
                        <div
                          className="h-full rounded-full opacity-60"
                          style={{ width: `${voteAgainst}%`, backgroundColor: "var(--muted-foreground)" }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>

          <aside className="protocol-workspace-rail">
            <div className="protocol-signal-card">
              <span className="protocol-meta">Scope doctrine</span>
              <strong>{template.scope}</strong>
              <p className="protocol-section-copy">Proposal text should target one control boundary instead of widening into undifferentiated mutability.</p>
            </div>

            <div className="surface-card space-y-4">
              <div>
                <p className="protocol-metric-label">Authority map</p>
                <p className="protocol-section-copy">The route should show exactly who owns execution and which action family is being invoked.</p>
              </div>
              <div className="protocol-register">
                <article className="protocol-register-row">
                  <div>
                    <strong>{ownerWallet.label}</strong>
                    <p className="protocol-address">{ownerWallet.address}</p>
                  </div>
                  <div className="protocol-register-metrics">
                    <span>{roleRow.role}</span>
                    <span>{proposalState.label}</span>
                  </div>
                </article>
                {roleRow.actions.map((action) => (
                  <article key={action} className="protocol-data-row">
                    <span>{action}</span>
                    <span className="protocol-meta">{shortenAddress(ownerWallet.address, 5)}</span>
                  </article>
                ))}
              </div>
            </div>

            <div className="surface-card space-y-4">
              <div>
                <p className="protocol-metric-label">Linked records</p>
                <p className="protocol-section-copy">Proposal pages should stay stitched to the template and the canonical governance console.</p>
              </div>
              <div className="protocol-data-list">
                <div className="protocol-data-row">
                  <div>
                    <strong>{template.label}</strong>
                    <p className="protocol-section-copy">Template text that defines the scoped wording and blast radius.</p>
                  </div>
                  <Link href={`/governance/descriptions/${template.id}`} className="secondary-button inline-flex w-fit">
                    Template
                  </Link>
                </div>
                <div className="protocol-data-row">
                  <div>
                    <strong>Canonical governance</strong>
                    <p className="protocol-section-copy">Return to the main console for authorities, templates, and scoped controls.</p>
                  </div>
                  <Link href="/governance" className="secondary-button inline-flex w-fit">
                    Console
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
