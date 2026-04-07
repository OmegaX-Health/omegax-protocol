// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

import { ProtocolSummaryRail } from "@/components/protocol-summary-rail";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { shortenAddress } from "@/lib/protocol";

function humanizeTemplate(template: string): string {
  return template
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const TEMPLATE_FIXTURES = {
  "reserve-domain-controls": {
    label: "Reserve Domain Controls",
    protocolTag: "Reserve domain template",
    version: "v2026.1",
    reviewLane: "Reserve domain authority",
    blastRadius: "Reserve-only",
    recordClass: "Custody and redemption rails",
    ownerRole: "domain_admin",
    lead:
      "Reserve-domain governance should describe exactly which rail changes, which reserve stays ring-fenced, and which historical ledgers remain untouched before the proposal enters the vote queue.",
    sections: [
      {
        label: "Control scope",
        copy: "Name the reserve domain, custody path, wrapper gate, or redemption rail being changed.",
        requirement: "Required",
      },
      {
        label: "Economic boundary",
        copy: "Spell out which plan ledgers, capital classes, and member positions stay outside the proposal blast radius.",
        requirement: "Required",
      },
      {
        label: "Execution path",
        copy: "Describe the exact authority, parameter, or pause gate expected to change after approval.",
        requirement: "Required",
      },
      {
        label: "Recovery posture",
        copy: "Define the rollback or exit condition for emergency rails so the domain does not stay in a paused state by accident.",
        requirement: "Required",
      },
    ],
    guardrails: [
      {
        title: "Historical capital stays intact",
        copy: "Do not use a reserve-domain template to rewrite settled NAV, completed redemptions, or sponsor budget history.",
      },
      {
        title: "Member obligations remain explicit",
        copy: "If claims or payout timing are affected, the proposal text must point to the precise obligation ledger or policy-series constraint.",
      },
      {
        title: "Wrapper rules stay ring-fenced",
        copy: "Wrapper-only controls must stay scoped to the wrapper lane and never silently spill into open-capital rights.",
      },
      {
        title: "Emergency wording expires cleanly",
        copy: "Temporary freeze language should include the exit rule, responsible signer, and visible review window.",
      },
    ],
  },
  "health-plan-controls": {
    label: "Health Plan Controls",
    protocolTag: "Plan operations template",
    version: "v2026.1",
    reviewLane: "Plan administration",
    blastRadius: "Plan lane",
    recordClass: "Series and sponsor controls",
    ownerRole: "plan_admin",
    lead:
      "Health-plan governance should read like a plan operations record: what plan lane changes, which policy series shift with it, and which sponsor/member rights deliberately do not move.",
    sections: [
      {
        label: "Plan lane",
        copy: "State the exact plan, policy-series family, or plan control being versioned.",
        requirement: "Required",
      },
      {
        label: "Sponsor and member boundary",
        copy: "Document which sponsor budgets, premium paths, and member rights remain unchanged.",
        requirement: "Required",
      },
      {
        label: "Linked series revisions",
        copy: "Name any terms-version or outcome comparability updates that ride alongside the control change.",
        requirement: "Required",
      },
      {
        label: "Operational owner",
        copy: "Identify the plan admin or governance signer responsible for the follow-through after execution.",
        requirement: "Required",
      },
    ],
    guardrails: [
      {
        title: "Plan text is not economic backfill",
        copy: "Avoid vague language that could be interpreted as retroactively mutating sponsor spend or member claim outcomes.",
      },
      {
        title: "Series versioning stays visible",
        copy: "Any terms or outcome change should surface the version jump and comparability key in the proposal body.",
      },
      {
        title: "One control family per proposal",
        copy: "If the change touches both plan operations and capital rails, split the record rather than widening the proposal text.",
      },
      {
        title: "Delegate rights stay explicit",
        copy: "Claims delegates and member agents must be named if the control change affects who can submit or review actions.",
      },
    ],
  },
  "capital-class-controls": {
    label: "Capital Class Controls",
    protocolTag: "Capital class template",
    version: "v2026.1",
    reviewLane: "Curation and allocation",
    blastRadius: "Capital class",
    recordClass: "Exposure and redemption policy",
    ownerRole: "pool_curator",
    lead:
      "Capital-class governance should isolate exposure policy, redemption behavior, and wrapper rules to the class being touched without creating a vague escape hatch for broader accounting changes.",
    sections: [
      {
        label: "Capital class",
        copy: "Identify the exact class, queue, or redemption rail in scope.",
        requirement: "Required",
      },
      {
        label: "Exposure thesis",
        copy: "Explain why the class needs a policy change and what risk posture the change is preserving.",
        requirement: "Required",
      },
      {
        label: "Investor boundary",
        copy: "List which holder rights, wrapper constraints, or queue positions remain unchanged.",
        requirement: "Required",
      },
      {
        label: "Execution metric",
        copy: "Name the specific class parameter, queue state, or allocation cap expected to move after approval.",
        requirement: "Required",
      },
    ],
    guardrails: [
      {
        title: "No hidden redemption policy drift",
        copy: "Queue-only mode, pause language, and wrapper rules should be surfaced as first-class changes, not tucked into generic proposal text.",
      },
      {
        title: "NAV history stays observable",
        copy: "The template should preserve historical share pricing and past allocation decisions even when forward controls change.",
      },
      {
        title: "Wrapper and open classes stay separate",
        copy: "If a wrapper class is involved, note the ring-fence explicitly so LP rights are not blurred.",
      },
      {
        title: "Allocator changes stay scoped",
        copy: "Allocation caps or impairment triggers should map to one class or thesis lane at a time.",
      },
    ],
  },
  "allocation-freeze": {
    label: "Allocation Freeze",
    protocolTag: "Sentinel freeze template",
    version: "v2026.1",
    reviewLane: "Sentinel escalation",
    blastRadius: "Allocation lane",
    recordClass: "Sentinel and impairment controls",
    ownerRole: "pool_sentinel",
    lead:
      "Freeze records should read like monitored incident controls: when the freeze starts, what it blocks, which exposures remain observable, and how the protocol returns to normal once the lane is safe again.",
    sections: [
      {
        label: "Freeze trigger",
        copy: "Describe the specific impairment, queue, oracle, or settlement condition that activated the freeze.",
        requirement: "Required",
      },
      {
        label: "Blocked actions",
        copy: "List the allocations, redemptions, or transitions that will stop while the freeze is active.",
        requirement: "Required",
      },
      {
        label: "Observation lane",
        copy: "State which ledgers, proofs, or dashboards remain live while the freeze holds.",
        requirement: "Required",
      },
      {
        label: "Exit condition",
        copy: "Name the evidence, signer, or window required to lift the freeze without ambiguity.",
        requirement: "Required",
      },
    ],
    guardrails: [
      {
        title: "Freeze wording is temporary by design",
        copy: "Emergency controls should include expiry or review rules so a sentinel action does not become indefinite policy.",
      },
      {
        title: "Claims and sponsor lanes stay legible",
        copy: "If member or sponsor surfaces are affected, the record should explain the operational fallback path explicitly.",
      },
      {
        title: "Evidence remains inspectable",
        copy: "Freezes should point to oracle evidence or impairment rationale rather than burying the reason in shorthand.",
      },
      {
        title: "Allocator authority stays narrow",
        copy: "A freeze proposal should not quietly widen who can re-open or redirect capital after the incident is contained.",
      },
    ],
  },
} as const;

function resolveTemplateFixture(template: string) {
  return (
    TEMPLATE_FIXTURES[template as keyof typeof TEMPLATE_FIXTURES] ?? {
      label: humanizeTemplate(template),
      protocolTag: "Governance template",
      version: "v2026.1",
      reviewLane: "Scoped control family",
      blastRadius: "Bounded surface",
      recordClass: "Protocol change record",
      ownerRole: "protocol_governance",
      lead:
        "Governance descriptions should stay narrow: identify the exact control family, list the blast radius, and describe what stays intentionally out of scope before a proposal enters the vote queue.",
      sections: [
        {
          label: "Control scope",
          copy: "Name the exact protocol surface being touched before any signer begins drafting proposal text.",
          requirement: "Required",
        },
        {
          label: "Out-of-scope protections",
          copy: "Document which adjacent ledgers, rights, or economics stay intentionally unchanged.",
          requirement: "Required",
        },
        {
          label: "Execution summary",
          copy: "Describe the explicit control or parameter expected to move after approval.",
          requirement: "Required",
        },
      ],
      guardrails: [
        {
          title: "One authority lane",
          copy: "Proposal text should stay inside one signer family and one clearly bounded control surface.",
        },
        {
          title: "Historical state stays visible",
          copy: "Never let generic wording imply silent changes to already-settled economics or obligations.",
        },
      ],
    }
  );
}

export default function GovernanceDescriptionTemplatePage({
  params,
}: {
  params: { template: string };
}) {
  const template = resolveTemplateFixture(params.template);
  const ownerWallet =
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === template.ownerRole) ??
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0];
  const roleRow =
    DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.find((row) => row.role === template.ownerRole) ??
    DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix[0];

  return (
    <div className="protocol-page">
      <section className="protocol-hero protocol-hero-bleed">
        <div className="protocol-hero-grid">
          <div className="protocol-hero-copy">
            <p className="protocol-kicker">{template.protocolTag}</p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-4">
                <h1 className="protocol-title text-[clamp(2rem,4.5vw,3.2rem)]">{template.label}</h1>
                <p className="protocol-lead">{template.lead}</p>
              </div>
              <span className="status-pill status-ok">{template.version}</span>
            </div>
            <div className="protocol-actions">
              <Link href="/governance" className="secondary-button inline-flex">
                Back to governance
              </Link>
              <Link
                href="/governance?tab=queue"
                className="action-button inline-flex"
              >
                Open live queue
              </Link>
            </div>
            <div className="protocol-metric-band">
              <div className="protocol-band-grid">
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Template id</span>
                  <span className="protocol-band-value">{params.template}</span>
                </div>
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Review lane</span>
                  <span className="protocol-band-value">{template.reviewLane}</span>
                </div>
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Blast radius</span>
                  <span className="protocol-band-value">{template.blastRadius}</span>
                </div>
                <div className="protocol-band-cell">
                  <span className="protocol-band-label">Owner wallet</span>
                  <span className="protocol-band-value">{shortenAddress(ownerWallet.address, 6)}</span>
                </div>
              </div>
            </div>
          </div>

          <ProtocolSummaryRail
            title="Route snapshot"
            items={[
              {
                label: "Template id",
                value: params.template,
                detail: "Route-safe record key for this scoped governance template.",
              },
              {
                label: "Control family",
                value: template.recordClass,
                detail: "The record reads like one bounded control family.",
              },
              {
                label: "Authority lane",
                value: ownerWallet.label,
                detail: "Execution responsibility stays visible before the vote.",
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
                  <p className="protocol-kicker">Policy record</p>
                  <h2 className="protocol-section-title">Template sections that must stay explicit before the vote queue opens.</h2>
                </div>
                <span className="status-pill status-off">{template.recordClass}</span>
              </div>
              <div className="protocol-register">
                {template.sections.map((section) => (
                  <article key={section.label} className="protocol-register-row">
                    <div>
                      <strong>{section.label}</strong>
                      <p className="protocol-section-copy">{section.copy}</p>
                    </div>
                    <div className="protocol-register-metrics">
                      <span>{section.requirement}</span>
                      <span>{template.version}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="surface-card space-y-4">
              <div className="protocol-section-head">
                <div>
                  <p className="protocol-kicker">Guardrail language</p>
                  <h2 className="protocol-section-title">The template should make the protected surfaces obvious to reviewers.</h2>
                </div>
                <span className="status-pill status-ok">Scoped only</span>
              </div>
              <div className="protocol-grid-2">
                {template.guardrails.map((guardrail) => (
                  <article key={guardrail.title} className="protocol-data-card">
                    <p className="protocol-metric-label">Protected scope</p>
                    <h3 className="text-xl font-semibold">{guardrail.title}</h3>
                    <p className="protocol-section-copy">{guardrail.copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="protocol-workspace-rail">
            <div className="protocol-signal-card">
              <span className="protocol-meta">Record posture</span>
              <strong>{template.blastRadius}</strong>
              <p className="protocol-section-copy">Templates should document the exact blast radius before any signer starts drafting executable text.</p>
            </div>

            <div className="surface-card space-y-4">
              <div className="protocol-section-head">
                <div>
                  <p className="protocol-metric-label">Authority map</p>
                  <p className="protocol-section-copy">Reviewers should see the owner wallet and the action family immediately.</p>
                </div>
              </div>
              <div className="protocol-register">
                <article className="protocol-register-row">
                  <div>
                    <strong>{ownerWallet.label}</strong>
                    <p className="protocol-address">{ownerWallet.address}</p>
                  </div>
                  <div className="protocol-register-metrics">
                    <span>{template.reviewLane}</span>
                    <span>{template.version}</span>
                  </div>
                </article>
                {(roleRow.actions ?? []).map((action) => (
                  <article key={action} className="protocol-data-row">
                    <span>{action}</span>
                    <span className="protocol-meta">{roleRow.role}</span>
                  </article>
                ))}
              </div>
            </div>

            <div className="surface-card space-y-4">
              <div>
                <p className="protocol-metric-label">Linked routes</p>
                <p className="protocol-section-copy">Keep the template stitched into the canonical governance surfaces.</p>
              </div>
              <div className="protocol-data-list">
                <div className="protocol-data-row">
                  <div>
                    <strong>Canonical governance</strong>
                    <p className="protocol-section-copy">Authority map, templates, and scoped controls.</p>
                  </div>
                  <Link href="/governance" className="secondary-button inline-flex w-fit">
                    Open
                  </Link>
                </div>
                <div className="protocol-data-row">
                  <div>
                    <strong>Live proposal queue</strong>
                    <p className="protocol-section-copy">Open the live governance queue before drilling into a real proposal account.</p>
                  </div>
                  <Link
                    href="/governance?tab=queue"
                    className="secondary-button inline-flex w-fit"
                  >
                    Open
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
