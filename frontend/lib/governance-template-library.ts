// SPDX-License-Identifier: AGPL-3.0-or-later

export type GovernanceTemplateSection = {
  label: string;
  copy: string;
  requirement: string;
};

export type GovernanceTemplateGuardrail = {
  title: string;
  copy: string;
};

export type GovernanceTemplateLibraryEntry = {
  id: string;
  label: string;
  category: string;
  protocolTag: string;
  version: string;
  reviewLane: string;
  blastRadius: string;
  recordClass: string;
  ownerRole: string;
  purpose: string;
  lead: string;
  sections: GovernanceTemplateSection[];
  guardrails: GovernanceTemplateGuardrail[];
};

function humanizeTemplate(template: string): string {
  return template
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const GOVERNANCE_TEMPLATE_LIBRARY: readonly GovernanceTemplateLibraryEntry[] = [
  {
    id: "reserve-domain-controls",
    label: "Reserve Domain Controls",
    category: "Reserve domain",
    protocolTag: "Reserve domain template",
    version: "v2026.1",
    reviewLane: "Reserve domain authority",
    blastRadius: "Reserve-only",
    recordClass: "Custody and redemption rails",
    ownerRole: "domain_admin",
    purpose: "Constrain custody, wrapper, and redemption rail changes to one reserve domain without contaminating adjacent ledgers.",
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
  {
    id: "health-plan-controls",
    label: "Health Plan Controls",
    category: "Plan operations",
    protocolTag: "Plan operations template",
    version: "v2026.1",
    reviewLane: "Plan administration",
    blastRadius: "Plan lane",
    recordClass: "Series and sponsor controls",
    ownerRole: "plan_admin",
    purpose: "Version plan controls and linked series behavior while keeping sponsor budgets and member rights visibly bounded.",
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
  {
    id: "capital-class-controls",
    label: "Capital Class Controls",
    category: "Capital posture",
    protocolTag: "Capital class template",
    version: "v2026.1",
    reviewLane: "Curation and allocation",
    blastRadius: "Capital class",
    recordClass: "Exposure and redemption policy",
    ownerRole: "pool_curator",
    purpose: "Isolate exposure, redemption, and wrapper changes to one capital class so accounting and investor boundaries stay legible.",
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
  {
    id: "allocation-freeze",
    label: "Allocation Freeze",
    category: "Emergency response",
    protocolTag: "Sentinel freeze template",
    version: "v2026.1",
    reviewLane: "Sentinel escalation",
    blastRadius: "Allocation lane",
    recordClass: "Sentinel and impairment controls",
    ownerRole: "pool_sentinel",
    purpose: "Document emergency freezes as temporary incident controls with explicit blocked actions, live observability, and exit criteria.",
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
] as const;

export function getGovernanceTemplateEntry(templateId: string): GovernanceTemplateLibraryEntry {
  return (
    GOVERNANCE_TEMPLATE_LIBRARY.find((entry) => entry.id === templateId) ?? {
      id: templateId,
      label: humanizeTemplate(templateId),
      category: "Protocol scope",
      protocolTag: "Governance template",
      version: "v2026.1",
      reviewLane: "Scoped control family",
      blastRadius: "Bounded surface",
      recordClass: "Protocol change record",
      ownerRole: "protocol_governance",
      purpose: "Document one bounded protocol change with an explicit owner, blast radius, and protected surfaces.",
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
