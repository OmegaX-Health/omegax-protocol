// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEVNET_PROTOCOL_FIXTURE_STATE, type DevnetFixtureRole } from "./devnet-fixtures";
import {
  availableFundingLineBalance,
  CLAIM_INTAKE_APPROVED,
  CLAIM_INTAKE_SETTLED,
  LP_QUEUE_STATUS_PENDING,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RESERVED,
  REDEMPTION_POLICY_QUEUE_ONLY,
  describeClaimStatus,
  describeFundingLineType,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  toBigIntAmount,
} from "./protocol";

import type { GovernanceProposalSummary } from "@/lib/governance";

export type WorkbenchSection = "overview" | "plans" | "capital" | "governance" | "oracles";

export type WorkbenchPersona = "observer" | "sponsor" | "capital" | "governance";

export type WorkbenchTab = {
  id: string;
  label: string;
};

export const WORKBENCH_VERSION_STAMP = "Shared protocol operations";

export const WORKBENCH_NAV: Array<{
  id: WorkbenchSection;
  href: `/${WorkbenchSection}`;
  label: string;
  icon: "overview" | "plans" | "capital" | "governance" | "oracles";
}> = [
  { id: "overview", href: "/overview", label: "Overview", icon: "overview" },
  { id: "plans", href: "/plans", label: "Plans", icon: "plans" },
  { id: "capital", href: "/capital", label: "Capital", icon: "capital" },
  { id: "governance", href: "/governance", label: "Governance", icon: "governance" },
  { id: "oracles", href: "/oracles", label: "Oracles", icon: "oracles" },
] as const;

export const PLAN_TABS = [
  { id: "overview", label: "Overview" },
  { id: "series", label: "Series" },
  { id: "members", label: "Members" },
  { id: "claims", label: "Claims" },
  { id: "schemas", label: "Schemas" },
  { id: "funding", label: "Funding" },
  { id: "settings", label: "Settings" },
] as const satisfies readonly WorkbenchTab[];

export const CAPITAL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "classes", label: "Classes" },
  { id: "allocations", label: "Allocations" },
  { id: "queue", label: "Queue" },
  { id: "linked-plans", label: "Linked plans" },
] as const satisfies readonly WorkbenchTab[];

export const GOVERNANCE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "queue", label: "Queue" },
  { id: "authorities", label: "Authorities" },
  { id: "templates", label: "Templates" },
  { id: "dao-ops", label: "DAO ops" },
] as const satisfies readonly WorkbenchTab[];

export const ORACLE_TABS = [
  { id: "registry", label: "Registry" },
  { id: "bindings", label: "Bindings" },
  { id: "attestations", label: "Attestations" },
  { id: "disputes", label: "Disputes" },
  { id: "staking", label: "Staking" },
] as const satisfies readonly WorkbenchTab[];

export type PlanTabId = (typeof PLAN_TABS)[number]["id"];
export type CapitalTabId = (typeof CAPITAL_TABS)[number]["id"];
export type GovernanceTabId = (typeof GOVERNANCE_TABS)[number]["id"];
export type OracleTabId = (typeof ORACLE_TABS)[number]["id"];

export const GOVERNANCE_TEMPLATE_ROWS = [
  {
    id: "reserve-domain-controls",
    label: "Reserve domain controls",
    authority: "domain_admin",
    blastRadius: "Reserve-only controls",
  },
  {
    id: "health-plan-controls",
    label: "Health plan controls",
    authority: "plan_admin",
    blastRadius: "Plan and series lane",
  },
  {
    id: "capital-class-controls",
    label: "Capital class controls",
    authority: "pool_sentinel",
    blastRadius: "Capital-class posture",
  },
  {
    id: "allocation-freeze",
    label: "Allocation freeze",
    authority: "protocol_governance",
    blastRadius: "Network-wide halt",
  },
] as const;

export type GovernanceQueueItem = {
  proposal: string;
  title: string;
  template: string;
  authority: string;
  status: string;
  stage: string;
};

export type WorkbenchAuditItem = {
  id: string;
  tone: "verified" | "pending" | "signal";
  label: string;
  timestamp: string;
  detail: string;
};

type BuildAuditTrailInput =
  | {
    section?: "overview";
    persona?: WorkbenchPersona;
    queue?: GovernanceQueueItem[];
  }
  | {
    section: "capital";
    poolAddress?: string | null;
    classAddress?: string | null;
  }
  | {
    section: "plans";
    planAddress?: string | null;
    seriesAddress?: string | null;
  }
  | {
    section: "oracles";
    poolAddress?: string | null;
    seriesAddress?: string | null;
  }
  | {
    section: "governance";
    queue?: GovernanceQueueItem[];
    proposal?: GovernanceQueueItem | null;
  };

function humanizeTokenLabel(value: string): string {
  return value
    .split("-")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function shortenGovernanceAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function templateLabelForProposal(descriptionLink: string): string {
  if (!descriptionLink) return "No description";
  try {
    const parsed = new URL(descriptionLink, "https://protocol.omegax.health");
    const match = parsed.pathname.match(/^\/governance\/descriptions\/([^/]+)$/);
    if (match?.[1]) {
      return humanizeTokenLabel(decodeURIComponent(match[1]));
    }
  } catch {
    return "External description";
  }
  return "External description";
}

function authorityLabelForProposal(proposal: GovernanceProposalSummary): string {
  if (proposal.ownerWalletAddress) return shortenGovernanceAddress(proposal.ownerWalletAddress);
  if (proposal.ownerRecordAddress) return `Record ${shortenGovernanceAddress(proposal.ownerRecordAddress)}`;
  return "Unavailable";
}

function stageLabelForProposal(proposal: GovernanceProposalSummary): string {
  const instructionProgress = proposal.instructionCount > 0
    ? `${proposal.instructionExecutedCount}/${proposal.instructionCount} instructions`
    : "No instructions";

  switch (proposal.stateLabel) {
    case "Draft":
      return "Draft lane";
    case "Signing off":
      return "Sign-off lane";
    case "Voting":
      return "Voting window";
    case "Succeeded":
      return `Ready to execute · ${instructionProgress}`;
    case "Executing":
      return `Execution in flight · ${instructionProgress}`;
    case "Completed":
      return `Execution complete · ${instructionProgress}`;
    case "Executing with errors":
      return `Execution errors · ${instructionProgress}`;
    case "Cancelled":
    case "Defeated":
    case "Vetoed":
      return "Closed without execution";
    default:
      return proposal.stateLabel;
  }
}

export function sectionFromPathname(pathname: string): WorkbenchSection {
  if (pathname.startsWith("/capital")) return "capital";
  if (pathname.startsWith("/governance")) return "governance";
  if (pathname.startsWith("/oracles")) return "oracles";
  if (pathname.startsWith("/plans")) return "plans";
  return "overview";
}

export function sectionChrome(section: WorkbenchSection): {
  title: string;
  eyebrow: string;
  description: string;
} {
  switch (section) {
    case "plans":
      return {
        title: "Plans",
        eyebrow: "Sponsor, series, claims, and funding lanes",
        description: "Manage health plans as one continuous operational surface.",
      };
    case "capital":
      return {
        title: "Capital",
        eyebrow: "Liquidity pools, classes, and queue posture",
        description: "Keep pool mechanics, class posture, and allocation routing in one stable context.",
      };
    case "governance":
      return {
        title: "Governance",
        eyebrow: "Proposal queue and scoped control lanes",
        description: "Coordinate proposals, templates, and authority posture without fragmenting the operating model.",
      };
    case "oracles":
      return {
        title: "Oracles",
        eyebrow: "Registry, attestations, and dispute posture",
        description: "Track verification operators and settlement-sensitive bindings without exposing raw health data.",
      };
    case "overview":
    default:
      return {
        title: "Overview",
        eyebrow: "Shared system health and operator worklists",
        description: "One live protocol dashboard for sponsor, capital, and governance flows.",
      };
  }
}

export function derivePersonaFromRole(role?: DevnetFixtureRole | null): WorkbenchPersona {
  switch (role) {
    case "protocol_governance":
    case "oracle_operator":
    case "pool_sentinel":
      return "governance";
    case "pool_curator":
    case "pool_allocator":
    case "lp_provider":
    case "wrapper_provider":
      return "capital";
    case "domain_admin":
    case "plan_admin":
    case "sponsor_operator":
    case "claims_operator":
    case "member":
    case "member_delegate":
      return "sponsor";
    default:
      return "observer";
  }
}

export function defaultTabForPersona(
  section: Exclude<WorkbenchSection, "overview">,
  persona: WorkbenchPersona,
): string {
  if (section === "plans") {
    if (persona === "capital") return "funding";
    if (persona === "governance") return "claims";
    return "overview";
  }

  if (section === "capital") {
    if (persona === "sponsor") return "linked-plans";
    if (persona === "governance") return "queue";
    return "overview";
  }

  if (section === "governance") {
    if (persona === "capital") return "templates";
    return "queue";
  }

  if (persona === "governance") return "attestations";
  if (persona === "capital") return "bindings";
  return "registry";
}

export function linkedContextForPool(poolAddress?: string | null): {
  plan: string | null;
  series: string | null;
} {
  const allocation = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.find(
    (row) => row.liquidityPool === (poolAddress ?? ""),
  );

  return {
    plan: allocation?.healthPlan ?? null,
    series: allocation?.policySeries ?? null,
  };
}

export function planAddressForSeries(seriesAddress?: string | null): string | null {
  return (
    DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === (seriesAddress ?? ""))?.healthPlan
    ?? null
  );
}

export function buildGovernanceQueue(proposals: GovernanceProposalSummary[] = []): GovernanceQueueItem[] {
  return proposals.map((proposal) => ({
    proposal: proposal.address,
    title: proposal.name,
    template: templateLabelForProposal(proposal.descriptionLink),
    authority: authorityLabelForProposal(proposal),
    status: proposal.stateLabel,
    stage: stageLabelForProposal(proposal),
  }));
}

export function computeWorkbenchMetrics() {
  const activeClaims = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter(
    (claim) => claim.intakeStatus !== CLAIM_INTAKE_SETTLED,
  ).length;
  const pendingRedemptions = DEVNET_PROTOCOL_FIXTURE_STATE.lpPositions.filter(
    (position) =>
      position.queueStatus === LP_QUEUE_STATUS_PENDING || toBigIntAmount(position.pendingRedemptionShares) > 0n,
  ).length;
  const reservedObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter(
    (obligation) =>
      obligation.status === OBLIGATION_STATUS_RESERVED || obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  ).length;
  const queueOnlyPools = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.filter(
    (pool) => pool.redemptionPolicy === REDEMPTION_POLICY_QUEUE_ONLY,
  ).length;
  const approvedClaims = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter(
    (claim) => claim.intakeStatus === CLAIM_INTAKE_APPROVED,
  ).length;

  return {
    activeClaims,
    approvedClaims,
    pendingRedemptions,
    reservedObligations,
    queueOnlyPools,
  };
}

export function buildAuditTrail(queue: GovernanceQueueItem[] = []) {
  const metrics = computeWorkbenchMetrics();

  return [
    {
      id: "audit-claims",
      tone: "verified" as const,
      label: "Verified",
      timestamp: "14:23:01",
      detail: `${metrics.approvedClaims} claim lanes are approved and waiting for reserve or settlement execution.`,
    },
    {
      id: "audit-queue",
      tone: "pending" as const,
      label: "Pending",
      timestamp: "14:20:44",
      detail: `${metrics.pendingRedemptions} LP queue records still need processing across active classes.`,
    },
    {
      id: "audit-governance",
      tone: "signal" as const,
      label: queue[0]?.status ?? "Review",
      timestamp: "14:15:22",
      detail: queue[0]
        ? `${queue[0].title} is the lead governance item for the current workbench.`
        : "No live governance proposals are currently loaded into the workbench queue.",
    },
  ];
}
