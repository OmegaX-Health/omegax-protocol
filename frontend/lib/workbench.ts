// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEVNET_PROTOCOL_FIXTURE_STATE, type DevnetFixtureRole } from "./devnet-fixtures";
import {
  availableFundingLineBalance,
  CLAIM_INTAKE_APPROVED,
  LP_QUEUE_STATUS_PENDING,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RESERVED,
  REDEMPTION_POLICY_QUEUE_ONLY,
  describeClaimStatus,
  describeFundingLineType,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  isActiveClaimStatus,
  toBigIntAmount,
} from "./protocol";

import type { GovernanceProposalSummary } from "@/lib/governance-readonly";

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
  const activeClaims = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => isActiveClaimStatus(claim.intakeStatus)).length;
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
): WorkbenchAuditItem[] {
  const metrics = computeWorkbenchMetrics();
  const leadProposal = queue[0] ?? null;
  const largestPool = [...DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools].sort((left, right) =>
    compareAmountsDesc(left.totalValueLocked, right.totalValueLocked),
  )[0] ?? null;
  const activePlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) =>
    DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.some(
      (claim) => claim.healthPlan === plan.address && isActiveClaimStatus(claim.intakeStatus),
    ),
  ) ?? DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0] ?? null;

  if (persona === "capital") {
    const scopedAllocations = largestPool
      ? DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter((allocation) => allocation.liquidityPool === largestPool.address)
      : [];
    const leadAllocation = [...scopedAllocations].sort((left, right) =>
      compareAmountsDesc(left.allocatedAmount, right.allocatedAmount),
    )[0] ?? null;
    const leadSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === leadAllocation?.policySeries) ?? null;

    return [
      createAuditItem({
        seed: `overview:${persona}:queue`,
        index: 0,
        label: metrics.pendingRedemptions > 0 ? "Queue watch" : "Queue clear",
        tone: metrics.pendingRedemptions > 0 ? "pending" : "verified",
        detail: `${metrics.pendingRedemptions} LP queue records still need action across ${metrics.queueOnlyPools} queue-only pool lane${metrics.queueOnlyPools === 1 ? "" : "s"}.`,
      }),
      createAuditItem({
        seed: `overview:${persona}:routing`,
        index: 1,
        label: leadAllocation ? "Routing live" : "Routing idle",
        tone: leadAllocation ? "signal" : "verified",
        detail: leadAllocation && leadSeries && largestPool
          ? `${largestPool.displayName} is led by ${leadSeries.displayName} with ${formatAuditAmount(leadAllocation.allocatedAmount)} allocated and ${formatAuditAmount(leadAllocation.reservedCapacity)} reserved capacity.`
          : "No active allocation lanes are currently registered on the visible capital surface.",
      }),
      createAuditItem({
        seed: `overview:${persona}:governance`,
        index: 2,
        label: leadProposal?.status ?? "Review",
        tone: leadProposal?.status === "Executing" ? "signal" : "pending",
        detail: leadProposal
          ? `${leadProposal.title} is the lead governance item for the shared protocol shell.`
          : "No live governance proposals are currently loaded into the workbench queue.",
      }),
    ];
  }

  if (persona === "governance") {
    return [
      createAuditItem({
        seed: `overview:${persona}:proposal`,
        index: 0,
        label: leadProposal?.status ?? "Review",
        tone: leadProposal?.status === "Executing" ? "signal" : "pending",
        detail: leadProposal
          ? `${leadProposal.title} is currently anchoring the governance queue.`
          : "No live governance proposals are currently loaded into the workbench queue.",
      }),
      createAuditItem({
        seed: `overview:${persona}:claims`,
        index: 1,
        label: metrics.activeClaims > 0 ? "Claims watch" : "Claims clear",
        tone: metrics.activeClaims > 0 ? "pending" : "verified",
        detail: `${metrics.activeClaims} claim lane${metrics.activeClaims === 1 ? "" : "s"} remain open across sponsor and oracle surfaces.`,
      }),
      createAuditItem({
        seed: `overview:${persona}:obligations`,
        index: 2,
        label: metrics.reservedObligations > 0 ? "Reserve watch" : "Reserve clear",
        tone: metrics.reservedObligations > 0 ? "signal" : "verified",
        detail: `${metrics.reservedObligations} obligation lane${metrics.reservedObligations === 1 ? "" : "s"} are still claimable, payable, or reserved.`,
      }),
    ];
  }

  return [
    createAuditItem({
      seed: `overview:${persona}:claims`,
      index: 0,
      label: metrics.approvedClaims > 0 ? "Claims approved" : "Claims quiet",
      tone: metrics.approvedClaims > 0 ? "signal" : "verified",
      detail: `${metrics.approvedClaims} claim lane${metrics.approvedClaims === 1 ? "" : "s"} are approved and waiting for reserve or settlement execution.`,
    }),
    createAuditItem({
      seed: `overview:${persona}:plan`,
      index: 1,
      label: activePlan ? "Plan focus" : "Plans idle",
      tone: activePlan ? "verified" : "signal",
      detail: activePlan
        ? `${activePlan.displayName} is the sponsor lane with the most live claim activity in the current fixture set.`
        : "No plan lanes are currently active in the visible sponsor surface.",
    }),
    createAuditItem({
      seed: `overview:${persona}:capital`,
      index: 2,
      label: metrics.pendingRedemptions > 0 ? "Capital queue" : "Capital clear",
      tone: metrics.pendingRedemptions > 0 ? "pending" : "verified",
      detail: `${metrics.pendingRedemptions} LP queue record${metrics.pendingRedemptions === 1 ? "" : "s"} still need processing across active capital classes.`,
    }),
  ];
}

function buildCapitalAuditTrail(poolAddress?: string | null, classAddress?: string | null): WorkbenchAuditItem[] {
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((candidate) => candidate.address === (poolAddress ?? ""))
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]
    ?? null;
  if (!pool) return buildOverviewAuditTrail("capital");

  const poolClasses = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.filter((capitalClass) => capitalClass.liquidityPool === pool.address);
  const selectedClass = poolClasses.find((capitalClass) => capitalClass.address === (classAddress ?? ""))
    ?? poolClasses[0]
    ?? null;
  const scopedAllocations = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter((allocation) =>
    selectedClass ? allocation.capitalClass === selectedClass.address : allocation.liquidityPool === pool.address,
  );
  const leadAllocation = [...scopedAllocations].sort((left, right) =>
    compareAmountsDesc(left.allocatedAmount, right.allocatedAmount),
  )[0] ?? null;
  const leadSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === leadAllocation?.policySeries) ?? null;
  const leadPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.address === leadAllocation?.healthPlan) ?? null;
  const scopedObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) =>
    obligation.liquidityPool === pool.address && (!selectedClass || obligation.capitalClass === selectedClass.address),
  );
  const payableObligations = scopedObligations.filter((obligation) => obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE);
  const payableAmount = payableObligations.reduce(
    (sum, obligation) => sum + toBigIntAmount(obligation.payableAmount ?? obligation.outstandingAmount),
    0n,
  );
  const impairedAllocations = scopedAllocations.filter((allocation) => toBigIntAmount(allocation.impairedAmount) > 0n);
  const totalImpairedAmount = impairedAllocations.reduce((sum, allocation) => sum + toBigIntAmount(allocation.impairedAmount), 0n);
  const leadImpairedAllocation = [...impairedAllocations].sort((left, right) =>
    compareAmountsDesc(left.impairedAmount, right.impairedAmount),
  )[0] ?? null;
  const leadImpairedSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === leadImpairedAllocation?.policySeries) ?? null;
  const linkedPlanCount = new Set(scopedAllocations.map((allocation) => allocation.healthPlan)).size;
  const pendingRedemptions = toBigIntAmount(selectedClass?.pendingRedemptions ?? pool.totalPendingRedemptions);
  const queueScope = selectedClass?.displayName ?? pool.displayName;
  const exitMode = selectedClass?.queueOnlyRedemptions || pool.redemptionPolicy === REDEMPTION_POLICY_QUEUE_ONLY
    ? "queue_only"
    : "open";

  return [
    createAuditItem({
      seed: `capital:${queueScope}:queue`,
      index: 0,
      label: pendingRedemptions > 0n ? "Queue watch" : "Queue clear",
      tone: pendingRedemptions > 0n ? "pending" : "verified",
      detail: `${queueScope} is running ${exitMode} exits with ${formatAuditAmount(pendingRedemptions)} shares waiting in the redemption queue.`,
    }),
    createAuditItem({
      seed: `capital:${queueScope}:routing`,
      index: 1,
      label: leadAllocation ? "Routing live" : "Routing idle",
      tone: leadAllocation ? "signal" : "verified",
      detail: leadAllocation && leadSeries && leadPlan
        ? `${leadSeries.displayName} in ${leadPlan.displayName} is the largest live routing lane with ${formatAuditAmount(leadAllocation.allocatedAmount)} allocated and ${formatAuditAmount(leadAllocation.reservedCapacity)} reserved capacity.`
        : `No active plan allocations are currently linked to ${queueScope}.`,
    }),
    createAuditItem({
      seed: `capital:${queueScope}:risk`,
      index: 2,
      label: totalImpairedAmount > 0n ? "Impairment watch" : payableAmount > 0n ? "Settlement watch" : "Plan linkage",
      tone: totalImpairedAmount > 0n ? "pending" : payableAmount > 0n ? "signal" : "verified",
      detail: totalImpairedAmount > 0n
        ? `${queueScope} is carrying ${formatAuditAmount(totalImpairedAmount)} impaired exposure, led by ${leadImpairedSeries?.displayName ?? "the top allocation"} at ${formatAuditAmount(leadImpairedAllocation?.impairedAmount)}.`
        : payableAmount > 0n
          ? `${payableObligations.length} obligation lane${payableObligations.length === 1 ? "" : "s"} remain ${describeObligationStatus(OBLIGATION_STATUS_CLAIMABLE_PAYABLE)} with ${formatAuditAmount(payableAmount)} still scheduled for settlement.`
          : `${linkedPlanCount} linked plan lane${linkedPlanCount === 1 ? "" : "s"} currently draw on ${pool.displayName}, and none are carrying impaired or payable exposure.`,
    }),
  ];
}

function buildPlansAuditTrail(planAddress?: string | null, seriesAddress?: string | null): WorkbenchAuditItem[] {
  const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((candidate) => candidate.address === (planAddress ?? ""))
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]
    ?? null;
  if (!plan) return buildOverviewAuditTrail("sponsor");

  const planSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => series.healthPlan === plan.address);
  const selectedSeries = planSeries.find((series) => series.address === (seriesAddress ?? "")) ?? null;
  const scopedClaims = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) =>
    claim.healthPlan === plan.address && (!selectedSeries || claim.policySeries === selectedSeries.address),
  );
  const scopedObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) =>
    obligation.healthPlan === plan.address && (!selectedSeries || obligation.policySeries === selectedSeries.address),
  );
  const scopedMembers = DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.filter((member) =>
    member.healthPlan === plan.address && (!selectedSeries || member.policySeries === selectedSeries.address),
  );
  const scopedFundingLines = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.filter((line) =>
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
      detail: `${scopedClaims.length} claim lane${scopedClaims.length === 1 ? "" : "s"} are scoped to ${scopeLabel}; ${approvedClaims.length} approved and ${liveClaims.length} still active.`,
    }),
    createAuditItem({
      seed: `plans:${scopeLabel}:funding`,
      index: 1,
      label: leadFundingLine ? "Funding live" : "Funding idle",
      tone: leadFundingLine ? "signal" : "verified",
      detail: leadFundingLine
        ? `${leadFundingLine.displayName} is the lead ${describeFundingLineType(leadFundingLine.lineType)} lane with ${formatAuditAmount(availableFundingLineBalance(leadFundingLine))} available and ${formatAuditAmount(leadFundingLine.reservedAmount)} reserved.`
        : `No funding lines are currently bound to ${scopeLabel}.`,
    }),
    createAuditItem({
      seed: `plans:${scopeLabel}:series`,
      index: 2,
      label: selectedSeries ? "Series posture" : "Plan posture",
      tone: selectedSeries ? "verified" : "signal",
      detail: selectedSeries
        ? `${selectedSeries.displayName} remains ${describeSeriesStatus(selectedSeries.status)} in ${describeSeriesMode(selectedSeries.mode)} mode with ${scopedMembers.length} member positions and ${scopedObligations.length} obligations in scope.`
        : `${plan.displayName} spans ${planSeries.length} series, ${scopedMembers.length} member positions, and ${formatAuditAmount(outstandingObligations)} in outstanding obligation balance.`,
    }),
  ];
}

function buildOraclesAuditTrail(poolAddress?: string | null, seriesAddress?: string | null): WorkbenchAuditItem[] {
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find((candidate) => candidate.address === (poolAddress ?? ""))
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]
    ?? null;
  if (!pool) return buildOverviewAuditTrail("governance");

  const boundAllocations = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter((allocation) => allocation.liquidityPool === pool.address);
  const boundSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) =>
    boundAllocations.some((allocation) => allocation.policySeries === series.address),
  );
  const selectedSeries = boundSeries.find((series) => series.address === (seriesAddress ?? "")) ?? boundSeries[0] ?? null;
  const scopedClaims = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) =>
    selectedSeries
      ? claim.policySeries === selectedSeries.address
      : boundSeries.some((series) => series.address === claim.policySeries),
  );
  const scopedObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) =>
    selectedSeries
      ? obligation.policySeries === selectedSeries.address
      : obligation.liquidityPool === pool.address,
  );
  const watchlistObligations = scopedObligations.filter((obligation) =>
    obligation.status === OBLIGATION_STATUS_RESERVED
    || obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE
    || toBigIntAmount(obligation.impairedAmount) > 0n,
  );
  const watchlistAmount = watchlistObligations.reduce(
    (sum, obligation) =>
      sum + toBigIntAmount(obligation.reservedAmount) + toBigIntAmount(obligation.payableAmount) + toBigIntAmount(obligation.impairedAmount),
    0n,
  );
  const leadClaim = scopedClaims[0] ?? null;
  const leadClaimSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === leadClaim?.policySeries) ?? selectedSeries;
  const scopeLabel = selectedSeries?.displayName ?? pool.displayName;

  return [
    createAuditItem({
      seed: `oracles:${scopeLabel}:binding`,
      index: 0,
      label: selectedSeries ? "Binding live" : "Pool bindings",
      tone: selectedSeries ? "verified" : "signal",
      detail: selectedSeries
        ? `${selectedSeries.displayName} stays bound to ${pool.displayName} in ${describeSeriesMode(selectedSeries.mode)} mode with terms ${selectedSeries.termsVersion}.`
        : `${boundSeries.length} series are currently bound to ${pool.displayName} for the visible oracle shell.`,
    }),
    createAuditItem({
      seed: `oracles:${scopeLabel}:attestations`,
      index: 1,
      label: scopedClaims.length > 0 ? "Attestation watch" : "Attestations quiet",
      tone: scopedClaims.length > 0 ? "pending" : "verified",
      detail: leadClaim && leadClaimSeries
        ? `${scopedClaims.length} claim lane${scopedClaims.length === 1 ? "" : "s"} are in scope; ${leadClaim.claimId} is ${describeClaimStatus(leadClaim.intakeStatus)} for ${leadClaimSeries.displayName}.`
        : `No claim attestations are currently scoped to ${scopeLabel}.`,
    }),
    createAuditItem({
      seed: `oracles:${scopeLabel}:watchlist`,
      index: 2,
      label: watchlistObligations.length > 0 ? "Dispute watch" : "Disputes clear",
      tone: watchlistObligations.length > 0 ? "signal" : "verified",
      detail: watchlistObligations.length > 0
        ? `${watchlistObligations.length} obligation lane${watchlistObligations.length === 1 ? "" : "s"} remain on the operator watchlist with ${formatAuditAmount(watchlistAmount)} in reserved, payable, or impaired exposure.`
        : `No bound obligations currently need dispute or settlement escalation for ${scopeLabel}.`,
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
        ? `${queue.length} proposal lane${queue.length === 1 ? "" : "s"} are visible: ${queueStateCounts.Voting ?? 0} voting, ${queueStateCounts.Executing ?? 0} executing, and ${queueStateCounts.Completed ?? 0} completed.`
        : "No live governance proposals are currently loaded into the workbench queue.",
    }),
  ];
}

export function buildAuditTrail(input?: BuildAuditTrailInput): WorkbenchAuditItem[] {
  switch (input?.section) {
    case "capital":
      return buildCapitalAuditTrail(input.poolAddress, input.classAddress);
    case "plans":
      return buildPlansAuditTrail(input.planAddress, input.seriesAddress);
    case "oracles":
      return buildOraclesAuditTrail(input.poolAddress, input.seriesAddress);
    case "governance":
      return buildGovernanceAuditTrail(input.queue, input.proposal);
    case "overview":
    default:
      return buildOverviewAuditTrail(input?.persona, input?.queue);
  }
}
