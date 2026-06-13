// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEVNET_PROTOCOL_FIXTURE_STATE, type DevnetFixtureRole } from "./devnet-fixtures";
import { GENESIS_PROTECT_ACUTE_PLAN_ID } from "./genesis-protect-acute";
import { GENESIS_PROTECT_ACUTE_PRIMARY_SKU } from "./genesis-protect-acute-operator";
import { NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU, NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID } from "./network-school-acute-assist";
import { buildOverviewStats, type OverviewStatsSource } from "./overview-metrics";
import {
  availableFundingLineBalance,
  CLAIM_INTAKE_APPROVED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RESERVED,
  REDEMPTION_POLICY_QUEUE_ONLY,
  SERIES_MODE_PROTECTION,
  describeClaimStatus,
  describeFundingLineType,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  isActiveClaimStatus,
  isObligationOnDisputeWatch,
  toBigIntAmount,
  type ProtocolConsoleSnapshot,
} from "./protocol";

import type { GovernanceProposalSummary } from "@/lib/governance-readonly";

export type WorkbenchSection = "overview" | "plans" | "governance";

export type WorkbenchPersona = "observer" | "sponsor" | "capital" | "governance";

type WorkbenchProtocolSource = Pick<
  ProtocolConsoleSnapshot,
  | "allocationPositions"
  | "capitalClasses"
  | "claimCases"
  | "fundingLines"
  | "healthPlans"
  | "liquidityPools"
  | "lpPositions"
  | "memberPositions"
  | "obligations"
  | "policySeries"
  | "reserveDomains"
>;

export type WorkbenchTab = {
  id: string;
  label: string;
};

export const WORKBENCH_VERSION_STAMP = "Shared protocol operations";

export const WORKBENCH_NAV: Array<{
  id: WorkbenchSection;
  href: `/${WorkbenchSection}`;
  label: string;
  icon: "overview" | "plans" | "governance";
}> = [
  { id: "overview", href: "/overview", label: "Overview", icon: "overview" },
  { id: "plans", href: "/plans", label: "Plans", icon: "plans" },
  { id: "governance", href: "/governance", label: "Governance", icon: "governance" },
] as const;

export const PLAN_TABS = [
  { id: "overview", label: "Overview" },
  { id: "coverage", label: "Coverage" },
  { id: "members", label: "Members" },
  { id: "claims", label: "Claims" },
  { id: "treasury", label: "Treasury" },
] as const satisfies readonly WorkbenchTab[];

export const GOVERNANCE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "queue", label: "Queue" },
  { id: "authorities", label: "Authorities" },
  { id: "templates", label: "Templates" },
] as const satisfies readonly WorkbenchTab[];

export type PlanTabId = (typeof PLAN_TABS)[number]["id"];
export type GovernanceTabId = (typeof GOVERNANCE_TABS)[number]["id"];

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

export type GovernanceQueueStatusCopy = {
  emptyDetail: string;
  emptyMessage: string;
  emptyMeta: string;
  emptyTitle: string;
  metricAriaLabel: string;
  metricValue: string;
};

export type GovernanceStatusVariant = "success" | "warning" | "danger" | "info" | "muted";

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
    source?: OverviewStatsSource;
    demo?: boolean;
  }
  | {
    section: "plans";
    planAddress?: string | null;
    seriesAddress?: string | null;
    source?: WorkbenchProtocolSource;
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

function countBe(count: number): string {
  return count === 1 ? "is" : "are";
}

function countRemain(count: number): string {
  return count === 1 ? "remains" : "remain";
}

function humanFundingLineType(lineType: number): string {
  return describeFundingLineType(lineType).replace(/_/g, " ");
}

function primaryDisplayName(value: string): string {
  return value.split("·")[0]?.trim() || value;
}

function joinWithConjunction(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

const GOVERNANCE_QUEUE_STATE_ORDER = ["Voting", "Executing", "Completed"] as const;

function describeGovernanceQueueStates(queueStateCounts: Record<string, number>): string {
  return joinWithConjunction(
    Object.entries(queueStateCounts)
      .sort(([leftStatus], [rightStatus]) => {
        const leftIndex = GOVERNANCE_QUEUE_STATE_ORDER.indexOf(leftStatus as (typeof GOVERNANCE_QUEUE_STATE_ORDER)[number]);
        const rightIndex = GOVERNANCE_QUEUE_STATE_ORDER.indexOf(rightStatus as (typeof GOVERNANCE_QUEUE_STATE_ORDER)[number]);

        if (leftIndex !== -1 || rightIndex !== -1) {
          if (leftIndex === -1) return 1;
          if (rightIndex === -1) return -1;
          return leftIndex - rightIndex;
        }

        return leftStatus.localeCompare(rightStatus);
      })
      .map(([status, count]) => `${count} ${status.toLowerCase()}`),
  );
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

export function describeGovernanceQueueStatus(input: {
  count: number;
  failed: boolean;
  failureDetail?: string | null;
  loaded: boolean;
}): GovernanceQueueStatusCopy {
  if (!input.loaded) {
    return {
      emptyDetail: "Loading live governance proposals from SPL Governance.",
      emptyMessage: "Loading live governance proposals...",
      emptyMeta: "Fetching",
      emptyTitle: "Loading governance queue",
      metricAriaLabel: "Fetching live governance proposals.",
      metricValue: "Fetching",
    };
  }

  if (input.failed) {
    const failureDetail = input.failureDetail?.trim()
      || "Live governance proposals could not be loaded from SPL Governance. Check the RPC connection and try again.";
    return {
      emptyDetail: failureDetail,
      emptyMessage: failureDetail,
      emptyMeta: "RPC failed",
      emptyTitle: "Governance queue unavailable",
      metricAriaLabel: "Live governance proposal fetch failed.",
      metricValue: "RPC failed",
    };
  }

  const proposalLabel = input.count === 1 ? "proposal" : "proposals";
  return {
    emptyDetail: "No active proposals are waiting right now. Review templates or authorities to prepare the next governance change.",
    emptyMessage: "No active proposals are waiting right now. Review templates or authorities to prepare the next governance change.",
    emptyMeta: "No proposals",
    emptyTitle: "Live governance queue",
    metricAriaLabel: `${input.count} live governance ${proposalLabel}.`,
    metricValue: input.count.toString(),
  };
}

export function governanceStatusVariant(label: string): GovernanceStatusVariant {
  const normalizedLabel = label.toLowerCase();
  if (
    normalizedLabel.includes("error")
    || normalizedLabel.includes("fail")
    || normalizedLabel.includes("defeat")
    || normalizedLabel.includes("cancel")
    || normalizedLabel.includes("veto")
  ) {
    return "danger";
  }
  if (
    normalizedLabel.includes("succeed")
    || normalizedLabel.includes("approved")
    || normalizedLabel.includes("completed")
  ) {
    return "success";
  }
  if (normalizedLabel.includes("execut") || normalizedLabel.includes("vot") || normalizedLabel.includes("active")) {
    return "info";
  }
  if (normalizedLabel.includes("draft") || normalizedLabel.includes("review") || normalizedLabel.includes("signing")) {
    return "warning";
  }
  return "muted";
}

export function resolveGovernanceProposalSelection(
  queue: GovernanceQueueItem[],
  queryProposal?: string | null,
): GovernanceQueueItem | null {
  const normalizedProposal = queryProposal?.trim() ?? "";
  return queue.find((proposal) => proposal.proposal === normalizedProposal) ?? queue[0] ?? null;
}

export function canonicalizeGovernanceWorkbenchParams(input: {
  activeTab: GovernanceTabId;
  loaded: boolean;
  queryProposal?: string | null;
  requestedTab?: string | null;
  selectedProposal: GovernanceQueueItem | null;
}): Record<string, string | null | undefined> {
  const nextUpdates: Record<string, string | null | undefined> = {};
  if (input.requestedTab !== input.activeTab) nextUpdates.tab = input.activeTab;

  const normalizedProposal = input.queryProposal?.trim() ?? "";
  if (input.selectedProposal) {
    if (normalizedProposal !== input.selectedProposal.proposal) {
      nextUpdates.proposal = input.selectedProposal.proposal;
    }
  } else if (input.loaded && normalizedProposal) {
    nextUpdates.proposal = null;
  }

  return nextUpdates;
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
  if (pathname.startsWith("/governance")) return "governance";
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
    case "governance":
      return {
        title: "Governance",
        eyebrow: "Proposal queue and scoped control lanes",
        description: "Coordinate proposals, templates, and authority posture without fragmenting the operating model.",
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
    if (persona === "capital") return "treasury";
    if (persona === "governance") return "claims";
    return "overview";
  }

  // governance
  if (persona === "capital") return "templates";
  return "queue";
}

export function linkedContextForPool(poolAddress?: string | null): {
  plan: string | null;
  series: string | null;
} {
  const allocations = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
    (row) => row.liquidityPool === (poolAddress ?? ""),
  );
  const plans = [...new Set(allocations.map((row) => row.healthPlan).filter(Boolean))];
  const series = [...new Set(allocations.map((row) => row.policySeries).filter(Boolean))];

  return {
    plan: plans.length === 1 ? plans[0] ?? null : null,
    series: series.length === 1 ? series[0] ?? null : null,
  };
}

export function planAddressForSeries(seriesAddress?: string | null): string | null {
  return (
    DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === (seriesAddress ?? ""))?.healthPlan
    ?? null
  );
}

export function firstSeriesAddressForPlan(planAddress?: string | null): string | null {
  return (
    DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.healthPlan === (planAddress ?? ""))?.address
    ?? null
  );
}

export function firstProtectionSeriesAddressForPlan(planAddress?: string | null): string | null {
  const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((entry) => entry.address === (planAddress ?? "")) ?? null;
  if (plan?.planId === GENESIS_PROTECT_ACUTE_PLAN_ID) {
    return (
      DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find(
        (series) =>
          series.healthPlan === plan.address
          && series.mode === SERIES_MODE_PROTECTION
          && series.seriesId === GENESIS_PROTECT_ACUTE_PRIMARY_SKU.seriesId,
      )?.address
      ?? null
    );
  }
  if (plan?.planId === NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID) {
    return (
      DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find(
        (series) =>
          series.healthPlan === plan.address
          && series.mode === SERIES_MODE_PROTECTION
          && series.seriesId === NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU.seriesId,
      )?.address
      ?? null
    );
  }
  return (
    DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find(
      (series) => series.healthPlan === (planAddress ?? "") && series.mode === SERIES_MODE_PROTECTION,
    )?.address
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

export function computeWorkbenchMetrics(source: WorkbenchProtocolSource = DEVNET_PROTOCOL_FIXTURE_STATE) {
  const activeClaims = source.claimCases.filter((claim) => isActiveClaimStatus(claim.intakeStatus)).length;
  const reservedObligations = source.obligations.filter(
    (obligation) =>
      obligation.status === OBLIGATION_STATUS_RESERVED || obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  ).length;
  const approvedClaims = source.claimCases.filter(
    (claim) => claim.intakeStatus === CLAIM_INTAKE_APPROVED,
  ).length;

  return {
    activeClaims,
    approvedClaims,
    reservedObligations,
  };
}

function compareAmountsDesc(
  left: bigint | number | string | null | undefined,
  right: bigint | number | string | null | undefined,
): number {
  const leftAmount = toBigIntAmount(left);
  const rightAmount = toBigIntAmount(right);
  if (leftAmount === rightAmount) return 0;
  return leftAmount > rightAmount ? -1 : 1;
}

function formatAuditAmount(value: bigint | number | string | null | undefined): string {
  return toBigIntAmount(value).toLocaleString();
}

function buildAuditTimestamp(seed: string, index: number): string {
  let hash = 0;
  for (const character of seed) {
    hash = ((hash * 33) + character.charCodeAt(0)) >>> 0;
  }

  const totalSeconds = ((hash + (index * 641)) % (12 * 60 * 60)) + (8 * 60 * 60);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function createAuditItem(params: {
  seed: string;
  index: number;
  label: string;
  tone: WorkbenchAuditItem["tone"];
  detail: string;
}): WorkbenchAuditItem {
  const slug = params.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `${params.seed}-${slug}`,
    tone: params.tone,
    label: params.label,
    timestamp: buildAuditTimestamp(params.seed, params.index),
    detail: params.detail,
  };
}

function buildOverviewAuditTrail(
  persona: WorkbenchPersona = "observer",
  queue: GovernanceQueueItem[] = [],
  source?: OverviewStatsSource,
  demo = false,
): WorkbenchAuditItem[] {
  const statsSource = source ?? DEVNET_PROTOCOL_FIXTURE_STATE;
  const demoSource = demo || !source;
  const sourceNoun = demoSource ? "explicit demo fixture set" : "live protocol snapshot";
  const metrics = buildOverviewStats(statsSource);
  const leadProposal = queue[0] ?? null;
  const activePlan = statsSource.healthPlans.find((plan) =>
    statsSource.claimCases.some(
      (claim) => claim.healthPlan === plan.address && isActiveClaimStatus(claim.intakeStatus),
    ),
  ) ?? statsSource.healthPlans[0] ?? null;

  if (persona === "governance") {
    return [
      createAuditItem({
        seed: `overview:${persona}:proposal`,
        index: 0,
        label: leadProposal?.status ?? "Review",
        tone: leadProposal?.status === "Executing" ? "signal" : "pending",
        detail: leadProposal
          ? `${leadProposal.title} is currently anchoring the governance queue.`
          : "No active governance proposals are waiting right now.",
      }),
      createAuditItem({
        seed: `overview:${persona}:claims`,
        index: 1,
        label: metrics.activeClaimCount > 0 ? "Claims watch" : "Claims clear",
        tone: metrics.activeClaimCount > 0 ? "pending" : "verified",
        detail: `${metrics.activeClaimCount} claim case${metrics.activeClaimCount === 1 ? "" : "s"} ${countRemain(metrics.activeClaimCount)} open across sponsor and oracle surfaces.`,
      }),
      createAuditItem({
        seed: `overview:${persona}:obligations`,
        index: 2,
        label: metrics.reservedObligationCount > 0 ? "Reserve watch" : "Reserve clear",
        tone: metrics.reservedObligationCount > 0 ? "signal" : "verified",
        detail: `${metrics.reservedObligationCount} obligation lane${metrics.reservedObligationCount === 1 ? "" : "s"} ${countBe(metrics.reservedObligationCount)} still claimable, payable, or reserved.`,
      }),
    ];
  }

  return [
    createAuditItem({
      seed: `overview:${persona}:claims`,
      index: 0,
      label: metrics.approvedClaimCount > 0 ? "Claims approved" : "Claims quiet",
      tone: metrics.approvedClaimCount > 0 ? "signal" : "verified",
      detail: `${metrics.approvedClaimCount} claim case${metrics.approvedClaimCount === 1 ? "" : "s"} ${countBe(metrics.approvedClaimCount)} approved and waiting for reserve or settlement execution.`,
    }),
    createAuditItem({
      seed: `overview:${persona}:plan`,
      index: 1,
      label: activePlan ? "Plan focus" : "Plans idle",
      tone: activePlan ? "verified" : "signal",
      detail: activePlan
        ? `${activePlan.displayName} is the sponsor lane with the most live claim activity in the ${sourceNoun}.`
        : "No plan lanes are currently active in the visible sponsor surface.",
    }),
  ];
}

function buildPlansAuditTrail(
  planAddress?: string | null,
  seriesAddress?: string | null,
  source: WorkbenchProtocolSource = DEVNET_PROTOCOL_FIXTURE_STATE,
): WorkbenchAuditItem[] {
  const plan = source.healthPlans.find((candidate) => candidate.address === (planAddress ?? ""))
    ?? source.healthPlans[0]
    ?? null;
  if (!plan) return buildOverviewAuditTrail("sponsor");

  const planSeries = source.policySeries.filter((series) => series.healthPlan === plan.address);
  const selectedSeries = planSeries.find((series) => series.address === (seriesAddress ?? "")) ?? null;
  const scopedClaims = source.claimCases.filter((claim) =>
    claim.healthPlan === plan.address && (!selectedSeries || claim.policySeries === selectedSeries.address),
  );
  const scopedObligations = source.obligations.filter((obligation) =>
    obligation.healthPlan === plan.address && (!selectedSeries || obligation.policySeries === selectedSeries.address),
  );
  const scopedMemberCount = source.memberPositions.filter((member) =>
    member.healthPlan === plan.address && (!selectedSeries || member.policySeries === selectedSeries.address),
  ).length;
  const scopedFundingLines = source.fundingLines.filter((line) =>
    line.healthPlan === plan.address && (!selectedSeries || line.policySeries === selectedSeries.address),
  );
  const leadFundingLine = [...scopedFundingLines].sort((left, right) =>
    compareAmountsDesc(availableFundingLineBalance(left), availableFundingLineBalance(right)),
  )[0] ?? null;
  const liveClaims = scopedClaims.filter((claim) => isActiveClaimStatus(claim.intakeStatus));
  const approvedClaims = scopedClaims.filter((claim) => claim.intakeStatus === CLAIM_INTAKE_APPROVED);
  const outstandingObligations = scopedObligations.reduce(
    (sum, obligation) => sum + toBigIntAmount(obligation.outstandingAmount ?? obligation.principalAmount),
    0n,
  );
  const scopeLabel = selectedSeries?.displayName ?? plan.displayName;

  return [
    createAuditItem({
      seed: `plans:${scopeLabel}:claims`,
      index: 0,
      label: liveClaims.length > 0 ? "Claims watch" : "Claims quiet",
      tone: liveClaims.length > 0 ? "pending" : "verified",
      detail: `${scopedClaims.length} claim case${scopedClaims.length === 1 ? "" : "s"} ${countBe(scopedClaims.length)} scoped to ${scopeLabel}; ${approvedClaims.length} approved and ${liveClaims.length} still active.`,
    }),
    createAuditItem({
      seed: `plans:${scopeLabel}:funding`,
      index: 1,
      label: leadFundingLine ? "Funding live" : "Funding idle",
      tone: leadFundingLine ? "signal" : "verified",
      detail: leadFundingLine
        ? `${primaryDisplayName(leadFundingLine.displayName)} is the lead ${humanFundingLineType(leadFundingLine.lineType)} lane with ${formatAuditAmount(availableFundingLineBalance(leadFundingLine))} available and ${formatAuditAmount(leadFundingLine.reservedAmount)} reserved.`
        : `No funding lines are currently bound to ${scopeLabel}.`,
    }),
    createAuditItem({
      seed: `plans:${scopeLabel}:series`,
      index: 2,
      label: selectedSeries ? "Series posture" : "Plan posture",
      tone: selectedSeries ? "verified" : "signal",
      detail: selectedSeries
        ? `${selectedSeries.displayName} remains ${describeSeriesStatus(selectedSeries.status)} in ${describeSeriesMode(selectedSeries.mode)} mode with ${scopedMemberCount} member positions and ${scopedObligations.length} obligations in scope.`
        : `${plan.displayName} spans ${planSeries.length} series, ${scopedMemberCount} member positions, and ${formatAuditAmount(outstandingObligations)} in outstanding obligation balance.`,
    }),
  ];
}

function buildGovernanceAuditTrail(
  queue: GovernanceQueueItem[] = [],
  proposal?: GovernanceQueueItem | null,
): WorkbenchAuditItem[] {
  const selectedProposal = proposal ?? queue[0] ?? null;
  const queueStateCounts = queue.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const queueStateSummary = describeGovernanceQueueStates(queueStateCounts);
  const scopeLabel = selectedProposal?.proposal ?? "governance";

  return [
    createAuditItem({
      seed: `governance:${scopeLabel}:proposal`,
      index: 0,
      label: selectedProposal?.status ?? "Review",
      tone: selectedProposal?.status === "Executing" ? "signal" : "pending",
      detail: selectedProposal
        ? `${selectedProposal.title} is ${selectedProposal.status.toLowerCase()} in ${selectedProposal.stage.toLowerCase()} for ${selectedProposal.authority}.`
        : "Proposal queue is awaiting the next scoped governance action.",
    }),
    createAuditItem({
      seed: `governance:${scopeLabel}:authority`,
      index: 1,
      label: selectedProposal ? "Authority scope" : "Authority watch",
      tone: "verified",
      detail: selectedProposal
        ? `${selectedProposal.template} is the current governance lane template and ${selectedProposal.authority} is the acting authority for this proposal.`
        : "Authority coverage is waiting for the currently selected proposal context.",
    }),
    createAuditItem({
      seed: `governance:${scopeLabel}:queue`,
      index: 2,
      label: queue.length > 0 ? "Queue live" : "Queue empty",
      tone: queue.length > 0 ? "signal" : "verified",
      detail: queue.length > 0
        ? `${queue.length} proposal${queue.length === 1 ? "" : "s"} ${countBe(queue.length)} visible${queueStateSummary ? `: ${queueStateSummary}.` : "."}`
        : "No active governance proposals are waiting right now.",
    }),
  ];
}

export function buildAuditTrail(input?: BuildAuditTrailInput): WorkbenchAuditItem[] {
  switch (input?.section) {
    case "plans":
      return buildPlansAuditTrail(input.planAddress, input.seriesAddress, input.source);
    case "governance":
      return buildGovernanceAuditTrail(input.queue, input.proposal);
    case "overview":
    default:
      return buildOverviewAuditTrail(input?.persona, input?.queue, input?.source, input?.demo);
  }
}
