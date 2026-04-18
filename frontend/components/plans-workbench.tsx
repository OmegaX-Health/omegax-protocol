// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";

import { GenesisProtectAcuteClaimsConsolePanel } from "@/components/genesis-protect-acute-claims-console";
import { GenesisProtectAcuteReserveConsolePanel } from "@/components/genesis-protect-acute-reserve-console";
import { GenesisProtectAcuteSetupPanel } from "@/components/genesis-protect-acute-setup-panel";
import { PlanCoveragePanel } from "@/components/plan-coverage-panel";
import {
  ClaimIntakePanel,
  ClaimsOperatorPanel,
  MemberSelfServePanel,
  MembersOperatorPanel,
  TreasuryOperatorPanel,
} from "@/components/workbench-action-panels";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { buildCanonicalConsoleStateFromSnapshot } from "@/lib/console-model";
import { formatAmount, plansForPool, seriesOutcomeCount } from "@/lib/canonical-ui";
import { GENESIS_PROTECT_ACUTE_PLAN_ID } from "@/lib/genesis-protect-acute";
import {
  buildGenesisProtectAcuteClaimConsoleModel,
  buildGenesisProtectAcuteReserveConsoleModel,
  normalizeGenesisProtectAcuteClaimQueueFilter,
  normalizeGenesisProtectAcuteReserveLaneFilter,
  type GenesisProtectAcuteClaimQueueFilter,
  type GenesisProtectAcuteReserveLaneFilter,
} from "@/lib/genesis-protect-acute-console";
import {
  buildGenesisProtectAcuteSetupModel,
  GENESIS_PROTECT_ACUTE_PRIMARY_SKU,
  GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
} from "@/lib/genesis-protect-acute-operator";
import { isUnsetDevnetWalletAddress } from "@/lib/devnet-fixtures";
import { firstSearchParamValue, type RouteSearchParams, toURLSearchParams } from "@/lib/search-params";
import { useProtocolConsoleSnapshot } from "@/lib/use-protocol-console-snapshot";
import {
  buildAuditTrail,
  defaultTabForPersona,
  PLAN_TABS,
  type PlanTabId,
} from "@/lib/workbench";
import {
  describeClaimStatus,
  describeEligibilityStatus,
  describeFundingLineType,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  fetchProtocolReadiness,
  type ProtocolReadiness,
  SERIES_MODE_PROTECTION,
  shortenAddress,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

/* ── Constants ──────────────────────────────────────── */

const SERIES_OPTIONAL_TABS = new Set<PlanTabId>(["members", "claims", "treasury", "overview"]);

const TAB_NUMBERS: Record<PlanTabId, string> = {
  overview: "01",
  coverage: "02",
  members: "03",
  claims: "04",
  treasury: "05",
};

type TabHero = { eyebrow: string; title: string; emphasis: string; tail: string; subtitle: string };
type PlansRouteMode = "plans" | "claims" | "members";

const TAB_HEROES: Record<PlanTabId, TabHero> = {
  overview: {
    eyebrow: "ACTIVE_WORKSPACE",
    title: "Active",
    emphasis: "Workspace.",
    tail: "",
    subtitle:
      "A single operational heartbeat for your plan — capital velocity, claim activity and reserve depth across every lane.",
  },
  coverage: {
    eyebrow: "PROTECTION_AND_PREMIUM_WORKSPACE",
    title: "Coverage",
    emphasis: "&",
    tail: "Protection.",
    subtitle:
      "Structured protection posture, premium rails, and linked capital context for the active protection lane. This tab only appears when the plan actually has coverage lanes.",
  },
  members: {
    eyebrow: "MEMBER_ELIGIBILITY_REGISTER",
    title: "Member Eligibility",
    emphasis: "&",
    tail: "Register.",
    subtitle:
      "Every wallet enlisted against this plan, with delegated rights and eligibility posture. Enlist new members or inspect the current register.",
  },
  claims: {
    eyebrow: "LIABILITY_MONITOR",
    title: "Liability",
    emphasis: "Monitor.",
    tail: "",
    subtitle:
      "Adjudicated claim cases and outstanding obligations in protocol custody. Trace reserve pressure and initiate settlement actions.",
  },
  treasury: {
    eyebrow: "TREASURY_LANES_AND_CONTROLS",
    title: "Treasury",
    emphasis: "&",
    tail: "Control Lanes.",
    subtitle:
      "Funding lines, reserve posture and every administrative wallet that can act on this plan. The full custody surface.",
  },
};

const ROUTE_HEROES: Record<Exclude<PlansRouteMode, "plans">, TabHero> = {
  claims: {
    eyebrow: "CANONICAL_CLAIMS_ROUTE",
    title: "Claim",
    emphasis: "Ledger.",
    tail: "",
    subtitle:
      "The live liability workspace for adjudicated claim cases and reserve-linked obligations, mounted directly on its own canonical route.",
  },
  members: {
    eyebrow: "CANONICAL_MEMBERS_ROUTE",
    title: "Member",
    emphasis: "Register.",
    tail: "",
    subtitle:
      "The live enrollment and delegation workspace for member positions, mounted directly on its own canonical route without falling back to a redirect.",
  },
};

/* ── Helpers ────────────────────────────────────────── */

function formatControlLaneAddress(address?: string | null, size = 6) {
  return isUnsetDevnetWalletAddress(address) ? "Not configured" : shortenAddress(address ?? "", size);
}

function statusVariant(described: string): "success" | "warning" | "danger" | "info" | "muted" {
  const l = described.toLowerCase();
  if (l.includes("active") || l.includes("eligible") || l.includes("approved") || l.includes("open")) return "success";
  if (l.includes("pending") || l.includes("review") || l.includes("paused")) return "warning";
  if (l.includes("denied") || l.includes("closed") || l.includes("sunset") || l.includes("ineligible")) return "danger";
  if (l.includes("reserved") || l.includes("processing") || l.includes("submitted")) return "info";
  return "muted";
}

function StatusBadge({ label }: { label: string }) {
  return <span className={`plans-badge plans-badge-${statusVariant(label)}`}>{label}</span>;
}

function PlansEmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="plans-empty liquid-glass">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function buildPlansHref(updates: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/plans?${query}` : "/plans";
}

function walletInitials(wallet: string): string {
  const clean = wallet.replace(/[^a-zA-Z0-9]/g, "");
  if (clean.length === 0) return "··";
  return clean.slice(0, 2).toUpperCase();
}

function personaEyebrow(persona: string): string {
  switch (persona) {
    case "sponsor": return "PROTOCOL_CONSOLE // SPONSOR_WORKSPACE";
    case "capital": return "PROTOCOL_CONSOLE // CAPITAL_WORKSPACE";
    case "governance": return "PROTOCOL_CONSOLE // GOVERNANCE_WORKSPACE";
    default: return "PROTOCOL_CONSOLE // OBSERVER_WORKSPACE";
  }
}

type HeroSelectorProps<T extends { address: string }> = {
  eyebrow: string;
  label: string;
  value: T | null;
  options: T[];
  renderLabel: (item: T) => string;
  renderMeta: (item: T) => string;
  placeholder: string;
  disabled?: boolean;
  onChange: (address: string) => void;
};

function HeroSelector<T extends { address: string }>(props: HeroSelectorProps<T>) {
  return (
    <label className={cn("plans-hero-select", props.disabled && "plans-hero-select-disabled")}>
      <span className="plans-hero-select-eyebrow">{props.eyebrow}</span>
      <div className="plans-hero-select-body">
        <div className="plans-hero-select-copy">
          <span className="plans-hero-select-label">
            {props.value ? props.renderLabel(props.value) : props.placeholder}
          </span>
          <span className="plans-hero-select-meta">
            {props.value ? props.renderMeta(props.value) : "—"}
          </span>
        </div>
        <span className="material-symbols-outlined plans-hero-select-caret" aria-hidden="true">unfold_more</span>
      </div>
      <select
        className="plans-hero-select-native"
        value={props.value?.address ?? ""}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        aria-label={props.label}
      >
        {props.value ? null : <option value="">{props.placeholder}</option>}
        {props.options.map((option) => (
          <option key={option.address} value={option.address}>
            {props.renderLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ── Component ──────────────────────────────────────── */

type PlansWorkbenchProps = {
  searchParams?: RouteSearchParams;
};

export function PlansWorkbench({ searchParams = {} }: PlansWorkbenchProps) {
  const { connection } = useConnection();
  const router = useRouter();
  const pathname = usePathname();
  const { effectivePersona } = useWorkspacePersona();
  const { snapshot, loading, error, refresh } = useProtocolConsoleSnapshot();
  const consoleState = useMemo(() => buildCanonicalConsoleStateFromSnapshot(snapshot), [snapshot]);
  const routeMode: PlansRouteMode = pathname === "/claims" ? "claims" : pathname === "/members" ? "members" : "plans";
  const forcedTab: PlanTabId | null = routeMode === "claims" ? "claims" : routeMode === "members" ? "members" : null;

  /* ── Selection state ── */

  const requestedTab = firstSearchParamValue(searchParams.tab);
  const requestedSetup = firstSearchParamValue(searchParams.setup);
  const genesisRequested = requestedSetup === GENESIS_PROTECT_ACUTE_TEMPLATE_KEY;
  const queryPool = firstSearchParamValue(searchParams.pool)?.trim() ?? "";
  const allPlans = useMemo(
    () => (queryPool ? plansForPool(queryPool, snapshot) : snapshot.healthPlans),
    [queryPool, snapshot],
  );
  const queryPlan = firstSearchParamValue(searchParams.plan)?.trim() ?? "";
  const matchedPlan = useMemo(() => allPlans.find((plan) => plan.address === queryPlan) ?? null, [allPlans, queryPlan]);
  const genesisPlan = useMemo(
    () => snapshot.healthPlans.find((plan) => plan.planId === GENESIS_PROTECT_ACUTE_PLAN_ID) ?? null,
    [snapshot.healthPlans],
  );
  const hasInvalidPlan = Boolean(queryPlan) && !matchedPlan;
  const selectedPlan = useMemo(() => {
    if (hasInvalidPlan) return null;
    if (genesisRequested) return genesisPlan;
    return matchedPlan ?? allPlans[0] ?? null;
  }, [allPlans, genesisPlan, genesisRequested, hasInvalidPlan, matchedPlan]);

  const planSeries = useMemo(() => {
    if (!selectedPlan) return [];
    return snapshot.policySeries.filter((series) => series.healthPlan === selectedPlan.address);
  }, [selectedPlan, snapshot.policySeries]);
  const planProtectionSeries = useMemo(
    () => planSeries.filter((series) => series.mode === SERIES_MODE_PROTECTION),
    [planSeries],
  );
  const availablePlanTabs = useMemo(
    () => {
      const baseTabs = PLAN_TABS.filter((tab) => tab.id !== "coverage" || planProtectionSeries.length > 0);
      if (forcedTab) return baseTabs.filter((tab) => tab.id === forcedTab);
      return baseTabs;
    },
    [forcedTab, planProtectionSeries.length],
  );
  const defaultTab = defaultTabForPersona("plans", effectivePersona) as PlanTabId;
  const activeTab = (forcedTab
    ?? availablePlanTabs.find((tab) => tab.id === requestedTab)?.id
    ?? availablePlanTabs.find((tab) => tab.id === defaultTab)?.id
    ?? availablePlanTabs[0]?.id
    ?? "overview") as PlanTabId;

  const querySeries = firstSearchParamValue(searchParams.series)?.trim() ?? "";
  const queryClaim = firstSearchParamValue(searchParams.claim)?.trim() ?? "";
  const queryMember = firstSearchParamValue(searchParams.member)?.trim() ?? "";
  const routePanel = firstSearchParamValue(searchParams.panel)?.trim() ?? "";
  const queryQueue = firstSearchParamValue(searchParams.queue)?.trim() ?? "";
  const queryLaneFilter = firstSearchParamValue(searchParams.lane)?.trim() ?? "";
  const queryLine = firstSearchParamValue(searchParams.line)?.trim() ?? "";
  const genesisClaimQueueFilter = normalizeGenesisProtectAcuteClaimQueueFilter(queryQueue);
  const genesisReserveLaneFilter = normalizeGenesisProtectAcuteReserveLaneFilter(queryLaneFilter);
  const seriesSelectionOptional = SERIES_OPTIONAL_TABS.has(activeTab);
  const matchedSeries = useMemo(
    () => planSeries.find((series) => series.address === querySeries) ?? null,
    [planSeries, querySeries],
  );
  const hasInvalidSeries = Boolean(querySeries) && !matchedSeries;
  const preferredProtectionSeries = useMemo(() => {
    if (selectedPlan?.planId !== GENESIS_PROTECT_ACUTE_PLAN_ID) return planProtectionSeries[0] ?? null;
    return planProtectionSeries.find((series) => series.seriesId === GENESIS_PROTECT_ACUTE_PRIMARY_SKU.seriesId)
      ?? planProtectionSeries[0]
      ?? null;
  }, [planProtectionSeries, selectedPlan?.planId]);
  const selectedSeries = useMemo(() => {
    if (hasInvalidSeries) return null;
    if (matchedSeries && (activeTab !== "coverage" || matchedSeries.mode === SERIES_MODE_PROTECTION)) return matchedSeries;
    if (activeTab === "coverage") return preferredProtectionSeries;
    if (seriesSelectionOptional) return null;
    return planSeries[0] ?? null;
  }, [activeTab, hasInvalidSeries, matchedSeries, planSeries, preferredProtectionSeries, seriesSelectionOptional]);

  /* ── Derived data ── */

  const sponsorView = useMemo(
    () => consoleState.sponsors.find((entry) => entry.healthPlanAddress === selectedPlan?.address) ?? null,
    [consoleState.sponsors, selectedPlan],
  );
  const planFundingLines = useMemo(
    () => snapshot.fundingLines.filter((line) => line.healthPlan === selectedPlan?.address),
    [selectedPlan, snapshot.fundingLines],
  );
  const planClaims = useMemo(
    () => snapshot.claimCases.filter((claim) => claim.healthPlan === selectedPlan?.address),
    [selectedPlan, snapshot.claimCases],
  );
  const filteredClaims = useMemo(
    () => (selectedSeries ? planClaims.filter((claim) => claim.policySeries === selectedSeries.address) : planClaims),
    [planClaims, selectedSeries],
  );
  const planObligations = useMemo(
    () => snapshot.obligations.filter((obligation) => obligation.healthPlan === selectedPlan?.address),
    [selectedPlan, snapshot.obligations],
  );
  const filteredObligations = useMemo(
    () => (selectedSeries ? planObligations.filter((obligation) => obligation.policySeries === selectedSeries.address) : planObligations),
    [planObligations, selectedSeries],
  );
  const planMembers = useMemo(
    () => snapshot.memberPositions.filter((position) => position.healthPlan === selectedPlan?.address),
    [selectedPlan, snapshot.memberPositions],
  );
  const filteredMembers = useMemo(
    () => (selectedSeries ? planMembers.filter((position) => position.policySeries === selectedSeries.address) : planMembers),
    [planMembers, selectedSeries],
  );
  const selectedMember = useMemo(
    () => filteredMembers.find((member) => member.address === queryMember) ?? filteredMembers[0] ?? null,
    [filteredMembers, queryMember],
  );
  const selectedReserveDomain = useMemo(
    () => snapshot.reserveDomains.find((domain) => domain.address === selectedPlan?.reserveDomain) ?? null,
    [selectedPlan?.reserveDomain, snapshot.reserveDomains],
  );
  const genesisSetupVisible = routeMode === "plans"
    && (genesisRequested || selectedPlan?.planId === GENESIS_PROTECT_ACUTE_PLAN_ID || genesisPlan?.address === selectedPlan?.address);
  const genesisActivePlan = selectedPlan?.planId === GENESIS_PROTECT_ACUTE_PLAN_ID;
  const [genesisReadiness, setGenesisReadiness] = useState<ProtocolReadiness | null>(null);
  const genesisSetupModel = useMemo(
    () => buildGenesisProtectAcuteSetupModel({ snapshot, readiness: genesisReadiness }),
    [genesisReadiness, snapshot],
  );
  const genesisPoolAddress = genesisSetupModel.pool?.address ?? null;
  const genesisPlanAddress = genesisSetupModel.plan?.address ?? genesisPlan?.address ?? null;
  const genesisPrimarySeriesAddress = genesisSetupModel.seriesBySku.travel30?.address ?? null;
  const genesisBootstrapHref = `/plans/new?template=${GENESIS_PROTECT_ACUTE_TEMPLATE_KEY}`;
  const genesisWorkspaceHref = buildPlansHref({
    plan: genesisPlanAddress,
    series: genesisPrimarySeriesAddress,
    tab: "overview",
    setup: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
  });
  const genesisClaimsHref = buildPlansHref({
    plan: genesisPlanAddress,
    series: genesisPrimarySeriesAddress,
    tab: "claims",
    setup: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
  });
  const genesisTreasuryHref = buildPlansHref({
    plan: genesisPlanAddress,
    series: genesisPrimarySeriesAddress,
    tab: "treasury",
    setup: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
  });
  const genesisSkuConsoleHrefs = {
    event7: {
      claims: buildPlansHref({
        plan: genesisPlanAddress,
        series: genesisSetupModel.seriesBySku.event7?.address ?? null,
        tab: "claims",
        setup: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
      }),
      treasury: buildPlansHref({
        plan: genesisPlanAddress,
        series: genesisSetupModel.seriesBySku.event7?.address ?? null,
        tab: "treasury",
        setup: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
      }),
    },
    travel30: {
      claims: buildPlansHref({
        plan: genesisPlanAddress,
        series: genesisSetupModel.seriesBySku.travel30?.address ?? null,
        tab: "claims",
        setup: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
      }),
      treasury: buildPlansHref({
        plan: genesisPlanAddress,
        series: genesisSetupModel.seriesBySku.travel30?.address ?? null,
        tab: "treasury",
        setup: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
      }),
    },
  } as const;
  const genesisCapitalClassesHref = genesisPoolAddress
    ? `/capital?pool=${encodeURIComponent(genesisPoolAddress)}&tab=classes`
    : "/capital?tab=classes";
  const genesisCapitalAllocationsHref = genesisPoolAddress
    ? `/capital?pool=${encodeURIComponent(genesisPoolAddress)}&tab=allocations`
    : "/capital?tab=allocations";
  const genesisOracleBindingsHref = "/oracles?tab=bindings";
  const genesisClaimConsoleModel = useMemo(
    () => (genesisActivePlan
      ? buildGenesisProtectAcuteClaimConsoleModel({
        snapshot,
        setupModel: genesisSetupModel,
        selectedSeriesAddress: selectedSeries?.address ?? null,
        selectedClaimAddress: queryClaim || null,
        queueFilter: genesisClaimQueueFilter,
      })
      : null),
    [genesisActivePlan, genesisClaimQueueFilter, genesisSetupModel, queryClaim, selectedSeries?.address, snapshot],
  );
  const genesisReserveConsoleModel = useMemo(
    () => (genesisActivePlan
      ? buildGenesisProtectAcuteReserveConsoleModel({
        snapshot,
        setupModel: genesisSetupModel,
        selectedSeriesAddress: selectedSeries?.address ?? null,
        selectedFundingLineAddress: queryLine || null,
        laneFilter: genesisReserveLaneFilter,
      })
      : null),
    [genesisActivePlan, genesisReserveLaneFilter, genesisSetupModel, queryLine, selectedSeries?.address, snapshot],
  );
  const selectedClaim = useMemo(
    () => {
      if (activeTab === "claims" && genesisClaimConsoleModel) return genesisClaimConsoleModel.selectedClaimCase;
      return filteredClaims.find((claim) => claim.address === queryClaim) ?? filteredClaims[0] ?? null;
    },
    [activeTab, filteredClaims, genesisClaimConsoleModel, queryClaim],
  );
  const seriesSelectorOptions = activeTab === "coverage" ? planProtectionSeries : planSeries;
  const auditTrail = useMemo(
    () => buildAuditTrail({
      section: "plans",
      planAddress: selectedPlan?.address,
      seriesAddress: selectedSeries?.address,
    }),
    [selectedPlan, selectedSeries],
  );

  /* ── Members filter state ── */

  const [memberStatusFilter, setMemberStatusFilter] = useState<"all" | "eligible" | "pending" | "other">("all");
  const [memberSearch, setMemberSearch] = useState("");

  const displayedMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return filteredMembers.filter((member) => {
      if (term && !member.wallet.toLowerCase().includes(term)) return false;
      if (memberStatusFilter === "all") return true;
      const label = describeEligibilityStatus(member.eligibilityStatus).toLowerCase();
      if (memberStatusFilter === "eligible") return label.includes("eligible") || label.includes("active");
      if (memberStatusFilter === "pending") return label.includes("pending") || label.includes("review");
      return !(label.includes("eligible") || label.includes("active") || label.includes("pending") || label.includes("review"));
    });
  }, [filteredMembers, memberSearch, memberStatusFilter]);

  useEffect(() => {
    if (!genesisSetupVisible || !genesisPoolAddress) {
      setGenesisReadiness(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const nextReadiness = await fetchProtocolReadiness({
          connection,
          poolAddress: genesisPoolAddress,
        });
        if (!cancelled) {
          setGenesisReadiness(nextReadiness);
        }
      } catch {
        if (!cancelled) {
          setGenesisReadiness(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, genesisPoolAddress, genesisSetupVisible]);

  /* ── URL sync ── */

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = toURLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (hasInvalidPlan || hasInvalidSeries) return;
    const nextUpdates: Record<string, string | null> = {};
    if (forcedTab) {
      if (requestedTab) nextUpdates.tab = null;
    } else if (requestedTab !== activeTab) {
      nextUpdates.tab = activeTab;
    }
    if (selectedPlan && queryPlan !== selectedPlan.address) nextUpdates.plan = selectedPlan.address;
    if (selectedSeries && querySeries !== selectedSeries.address) nextUpdates.series = selectedSeries.address;
    if (!selectedSeries && querySeries) nextUpdates.series = null;
    if ((routeMode === "claims" || activeTab === "claims") && selectedClaim && queryClaim !== selectedClaim.address) {
      nextUpdates.claim = selectedClaim.address;
    }
    if ((routeMode === "claims" || activeTab === "claims") && !selectedClaim && queryClaim) nextUpdates.claim = null;
    if ((routeMode === "members" || activeTab === "members") && selectedMember && queryMember !== selectedMember.address) {
      nextUpdates.member = selectedMember.address;
    }
    if ((routeMode === "members" || activeTab === "members") && !selectedMember && queryMember) nextUpdates.member = null;
    if (activeTab === "claims" && genesisActivePlan) {
      const desiredQueue = genesisClaimQueueFilter === "all" ? null : genesisClaimQueueFilter;
      if ((queryQueue || null) !== desiredQueue) nextUpdates.queue = desiredQueue;
    } else if (queryQueue) {
      nextUpdates.queue = null;
    }
    if (activeTab === "treasury" && genesisActivePlan) {
      const desiredLane = genesisReserveLaneFilter === "all" ? null : genesisReserveLaneFilter;
      if ((queryLaneFilter || null) !== desiredLane) nextUpdates.lane = desiredLane;
      const selectedFundingLineAddress = genesisReserveConsoleModel?.selectedLane?.fundingLineAddress ?? null;
      if (selectedFundingLineAddress && queryLine !== selectedFundingLineAddress) nextUpdates.line = selectedFundingLineAddress;
      if (!selectedFundingLineAddress && queryLine) nextUpdates.line = null;
    } else {
      if (queryLaneFilter) nextUpdates.lane = null;
      if (queryLine) nextUpdates.line = null;
    }
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, forcedTab, genesisActivePlan, genesisClaimQueueFilter, genesisReserveConsoleModel?.selectedLane?.fundingLineAddress, genesisReserveLaneFilter, hasInvalidPlan, hasInvalidSeries, queryClaim, queryLaneFilter, queryLine, queryMember, queryPlan, queryQueue, querySeries, requestedTab, routeMode, selectedClaim, selectedMember, selectedPlan, selectedSeries, updateParams]);

  /* ── Scroll tab into view ── */

  const tabBarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const activeButton = bar.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`);
    if (activeButton) activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTab]);

  /* ── Derived stats ── */

  const planClaimCount = sponsorView?.activeClaimCount ?? 0;
  const remaining = Number(sponsorView?.remainingSponsorBudget ?? 0);
  const funded = Number(sponsorView?.fundedSponsorBudget ?? 0);
  const deployed = Math.max(0, funded - remaining);
  const deployedPct = funded > 0 ? Math.round((deployed / funded) * 100) : 0;
  const reserveCoverage = Number(sponsorView?.reserveCoverageBps ?? 0);
  const totalFunded = planFundingLines.reduce((sum, line) => sum + Number(line.fundedAmount), 0);
  const totalReserved = planFundingLines.reduce((sum, line) => sum + Number(line.reservedAmount), 0);
  const poolUtilization = totalFunded > 0 ? Math.round((totalReserved / totalFunded) * 100) : 0;

  // Per-series vitality bars (kept on overview)
  const vitalityBars = useMemo(() => {
    const rows = sponsorView?.perSeriesPerformance ?? [];
    if (rows.length === 0) return [] as Array<{ id: string; name: string; value: number; claims: number; ratio: number }>;
    const maxValue = rows.reduce((max, row) => Math.max(max, Number(row.reserved)), 0) || 1;
    return rows.map((row) => ({
      id: row.policySeries,
      name: row.seriesId,
      value: Number(row.reserved),
      claims: row.claimCount,
      ratio: Number(row.reserved) / maxValue,
    }));
  }, [sponsorView]);

  const hero = routeMode === "plans" ? TAB_HEROES[activeTab] : ROUTE_HEROES[routeMode];
  const eyebrow = routeMode === "plans" && activeTab === "overview" ? personaEyebrow(effectivePersona) : hero.eyebrow;
  const planWorkspaceHref = `/plans${selectedPlan || selectedSeries
    ? `?${new URLSearchParams({
      ...(selectedPlan ? { plan: selectedPlan.address } : {}),
      ...(selectedSeries ? { series: selectedSeries.address } : {}),
    }).toString()}`
    : ""}`;

  /* ── Invalid selection guard ── */

  const invalidSelection = hasInvalidPlan
    ? { title: "Plan not found", copy: "The requested health plan is not present in the current live protocol state. Choose another plan to continue." }
    : hasInvalidSeries
      ? { title: "Series not found", copy: "The requested policy series is not linked to the selected plan. Choose another series or clear the series filter." }
      : null;

  /* ── Main render ── */

  return (
    <div className="plans-shell">
      <div className="plans-scroll">

        {/* ── Hero ──────────────────────────── */}
        <header className="plans-hero">
          <div className="plans-hero-glow" aria-hidden="true" />
          <div className="plans-hero-head">
            <div className="plans-hero-copy">
              <span className="plans-hero-eyebrow">{eyebrow}</span>
              <h1 className="plans-hero-title">
                {hero.title}{" "}
                {hero.emphasis ? <em>{hero.emphasis}</em> : null}
                {hero.tail ? <> {hero.tail}</> : null}
              </h1>
              <p className="plans-hero-subtitle">{hero.subtitle}</p>
            </div>
            <div className="plans-hero-actions">
              <Link href={routeMode === "plans" ? "/plans/new" : planWorkspaceHref} className="plans-hero-cta">
                <span className="material-symbols-outlined" aria-hidden="true">
                  {routeMode === "plans" ? "add" : "arrow_back"}
                </span>
                {routeMode === "plans" ? "NEW_PLAN" : "OPEN_PLAN_WORKSPACE"}
              </Link>
              {routeMode === "plans" ? (
                <Link href={genesisPlanAddress ? genesisWorkspaceHref : genesisBootstrapHref} className="plans-hero-cta">
                  <span className="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                  {genesisPlanAddress ? "OPEN_GENESIS" : "GENESIS_TEMPLATE"}
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {loading || error ? (
          <div className="plans-stack">
            <article className="plans-card liquid-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">LIVE_PROTOCOL_STATE</p>
                  <h2 className="plans-card-title plans-card-title-display">
                    {loading ? <>Syncing <em>devnet</em></> : <>RPC <em>attention</em></>}
                  </h2>
                </div>
              </div>
              <p className="plans-card-body">
                {loading
                  ? "Loading live reserve-domain, plan, series, member, claim, and obligation state from the configured RPC endpoint."
                  : error}
              </p>
            </article>
          </div>
        ) : null}

        {/* ── Context bar ────────────────────── */}
        <div className="plans-context-bar">
          <div className="plans-context-selectors liquid-glass">
            <HeroSelector
              eyebrow="HEALTH_PLAN"
              label="Health plan"
              value={selectedPlan}
              options={allPlans}
              renderLabel={(plan) => plan.displayName}
              renderMeta={(plan) => `${plan.planId} · ${plan.sponsorLabel}`}
              placeholder="Choose plan"
              onChange={(value) => updateParams({ plan: value, series: null })}
            />
            <span className="plans-context-divider" aria-hidden="true" />
            <HeroSelector
              eyebrow="POLICY_SERIES"
              label="Policy series"
              value={selectedSeries}
              options={seriesSelectorOptions}
              renderLabel={(series) => series.displayName}
              renderMeta={(series) => `${series.seriesId} · ${describeSeriesMode(series.mode)}`}
              placeholder={seriesSelectorOptions.length > 0 ? (activeTab === "coverage" ? "Choose protection lane" : "All series") : "No series"}
              disabled={!selectedPlan || seriesSelectorOptions.length === 0}
              onChange={(value) => updateParams({ series: value || null })}
            />
          </div>
        </div>

        {/* ── Tab bar ───────────────────────── */}
        {availablePlanTabs.length > 1 ? (
          <nav className="plans-tabs liquid-glass" aria-label="Plan workspace sections">
            <div ref={tabBarRef} className="plans-tabs-inner">
              {availablePlanTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    data-tab-id={tab.id}
                    className={cn("plans-tab", isActive && "plans-tab-active")}
                    onClick={() => updateParams({ tab: tab.id })}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="plans-tab-number">{TAB_NUMBERS[tab.id as PlanTabId]}</span>
                    <span className="plans-tab-label">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        {/* ── Body ──────────────────────────── */}
        {invalidSelection ? (
          <PlansEmptyState title={invalidSelection.title} copy={invalidSelection.copy} />
        ) : (
          <div className="plans-body">
            <section className="plans-main">

              {/* ── OVERVIEW ── */}
              {activeTab === "overview" ? (
                <div className="plans-stack">
                  {genesisSetupVisible ? (
                    <GenesisProtectAcuteSetupPanel
                      model={genesisSetupModel}
                      planAddress={genesisPlanAddress}
                      treasuryHref={genesisTreasuryHref}
                      capitalClassesHref={genesisCapitalClassesHref}
                      capitalAllocationsHref={genesisCapitalAllocationsHref}
                      bootstrapHref={genesisBootstrapHref}
                      oracleBindingsHref={genesisOracleBindingsHref}
                      claimsHref={genesisClaimsHref}
                      skuConsoleHrefs={genesisSkuConsoleHrefs}
                    />
                  ) : null}
                  <article className="plans-card plans-vitality heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">PROTOCOL_VITALITY_INDEX</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {selectedPlan?.displayName ?? "Awaiting plan"}
                        </h2>
                      </div>
                      <span className="plans-card-meta">
                        <span className="plans-live-dot" aria-hidden="true" />
                        {selectedPlan?.planId ?? "—"}
                      </span>
                    </div>

                    <div className="plans-vitality-stats">
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value">{deployedPct}<span className="plans-unit">%</span></span>
                        <span className="plans-vitality-stat-label">Budget deployed</span>
                      </div>
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value">{planSeries.length}</span>
                        <span className="plans-vitality-stat-label">Active lanes</span>
                      </div>
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value plans-vitality-stat-value-accent">
                          {planClaimCount}
                        </span>
                        <span className="plans-vitality-stat-label">Claims live</span>
                      </div>
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value">{poolUtilization}<span className="plans-unit">%</span></span>
                        <span className="plans-vitality-stat-label">Pool utilization</span>
                      </div>
                    </div>

                    {vitalityBars.length > 0 ? (
                      <div className="plans-vitality-chart" aria-label="Per-series reserved capital">
                        <div className="plans-vitality-chart-head">
                          <span className="plans-chart-label">RESERVED_BY_SERIES</span>
                          <span className="plans-chart-legend">Reserved · Claims</span>
                        </div>
                        <div className="plans-vitality-bars">
                          {vitalityBars.map((bar) => (
                            <div key={bar.id} className="plans-vitality-bar">
                              <div className="plans-vitality-bar-head">
                                <span className="plans-vitality-bar-name">{bar.name}</span>
                                <span className="plans-vitality-bar-val">{formatAmount(bar.value)}</span>
                              </div>
                              <div className="plans-vitality-bar-track">
                                <div
                                  className="plans-vitality-bar-fill"
                                  style={{ width: `${Math.max(4, bar.ratio * 100)}%` }}
                                />
                              </div>
                              <span className="plans-vitality-bar-claims">{bar.claims} claim cases</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>

                  <article className="plans-card plans-lanes heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">SERIES_LANES</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {planSeries.length} active <em>{planSeries.length === 1 ? "lane" : "lanes"}</em>
                        </h2>
                      </div>
                      <span className="plans-card-meta">{selectedPlan?.planId}</span>
                    </div>
                    {planSeries.length > 0 ? (
                      <div className="plans-lane-stack">
                        {planSeries.map((series) => {
                          const isSelected = selectedSeries?.address === series.address;
                          return (
                            <button
                              type="button"
                              key={series.address}
                              className={cn("plans-lane", isSelected && "plans-lane-active")}
                              onClick={() => updateParams({ series: isSelected ? null : series.address })}
                            >
                              <div className="plans-lane-info">
                                <span className="plans-lane-name">{series.displayName}</span>
                                <span className="plans-lane-key">
                                  {series.seriesId} · {series.comparabilityKey} · v{series.termsVersion}
                                </span>
                              </div>
                              <div className="plans-lane-meta">
                                <span className="plans-lane-mode">{describeSeriesMode(series.mode)}</span>
                                <span className="plans-lane-outcomes">
                                  {formatAmount(seriesOutcomeCount(series.address, snapshot))} outcomes
                                </span>
                                <StatusBadge label={describeSeriesStatus(series.status)} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="plans-card-body">No policy series are currently configured for this plan.</p>
                    )}
                  </article>
                </div>
              ) : null}

              {/* ── COVERAGE ── */}
              {activeTab === "coverage" && selectedPlan ? (
                <PlanCoveragePanel
                  planAddress={selectedPlan.address}
                  policySeries={planSeries}
                  activeSeriesAddress={selectedSeries?.address}
                  allocationPositions={snapshot.allocationPositions}
                  fundingLines={planFundingLines}
                  liquidityPools={snapshot.liquidityPools}
                />
              ) : null}

              {/* ── MEMBERS ── */}
              {activeTab === "members" ? (
                <div className="plans-stack">
                  <MemberSelfServePanel
                    plan={selectedPlan}
                    series={selectedSeries}
                    members={filteredMembers}
                    onRefresh={refresh}
                  />
                  <MembersOperatorPanel
                    plan={selectedPlan}
                    series={selectedSeries}
                    members={filteredMembers}
                    selectedMemberAddress={selectedMember?.address ?? null}
                    selectedPanel={routePanel}
                    onSelectMember={(address) => updateParams({ member: address, panel: "review" })}
                    onSelectPanel={(panel) => updateParams({ panel })}
                    onRefresh={refresh}
                  />
                  <article className="plans-card heavy-glass">
                    <div className="plans-members-head">
                      <div>
                        <p className="plans-card-eyebrow">ELIGIBILITY_REGISTER</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {filteredMembers.length} <em>members</em> enlisted
                        </h2>
                      </div>
                      <Link
                        href={`/members?${new URLSearchParams({
                          ...(selectedPlan ? { plan: selectedPlan.address } : {}),
                          ...(selectedSeries ? { series: selectedSeries.address } : {}),
                          panel: "enroll",
                        }).toString()}`}
                        className="plans-primary-cta"
                      >
                        <span className="material-symbols-outlined">person_add</span>
                        ENLIST_MEMBER
                      </Link>
                    </div>

                    <div className="plans-members-toolbar">
                      <div className="plans-members-chips">
                        {(["all", "eligible", "pending", "other"] as const).map((key) => (
                          <button
                            key={key}
                            type="button"
                            className={cn("plans-chip", memberStatusFilter === key && "plans-chip-active")}
                            onClick={() => setMemberStatusFilter(key)}
                          >
                            STATUS:{key.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <label className="plans-search">
                        <span className="material-symbols-outlined" aria-hidden="true">search</span>
                        <input
                          type="search"
                          placeholder="Search wallet"
                          value={memberSearch}
                          onChange={(event) => setMemberSearch(event.target.value)}
                          aria-label="Search members by wallet"
                        />
                      </label>
                    </div>

                    {displayedMembers.length > 0 ? (
                      <ul className="plans-member-grid">
                        {displayedMembers.map((member) => {
                          const eligibility = describeEligibilityStatus(member.eligibilityStatus);
                          return (
                            <li key={member.address} className="plans-member-card">
                              <button
                                type="button"
                                className="plans-member-head"
                                onClick={() => updateParams({ member: member.address, panel: "review" })}
                              >
                                <div className="plans-member-avatar" aria-hidden="true">
                                  {walletInitials(member.wallet)}
                                </div>
                                <div className="plans-member-id">
                                  <span className="plans-member-wallet">{shortenAddress(member.wallet, 6)}</span>
                                  <span className="plans-member-position">{shortenAddress(member.address, 4)}</span>
                                </div>
                                <StatusBadge label={eligibility} />
                              </button>
                              <div className="plans-member-meta">
                                <span className="plans-member-label">DELEGATED_RIGHTS</span>
                                <span className="plans-member-rights">
                                  {member.delegatedRights.length > 0 ? member.delegatedRights.join(" · ") : "—"}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <PlansEmptyState
                        title="No members match this filter"
                        copy={memberSearch || memberStatusFilter !== "all"
                          ? "Clear the filters or broaden the search to see enlisted wallets."
                          : "This plan does not currently expose member positions."}
                      />
                    )}
                  </article>
                </div>
              ) : null}

              {/* ── CLAIMS ── */}
              {activeTab === "claims" ? (
                <div className="plans-stack">
                  {genesisActivePlan && genesisClaimConsoleModel ? (
                    <>
                      <GenesisProtectAcuteClaimsConsolePanel
                        model={genesisClaimConsoleModel}
                        poolAddress={genesisPoolAddress}
                        onSelectFilter={(filter: GenesisProtectAcuteClaimQueueFilter) => updateParams({ queue: filter === "all" ? null : filter })}
                        onSelectClaim={(address, panel) => updateParams({ claim: address, panel })}
                      />
                      {routePanel === "intake" || filteredClaims.length === 0 ? (
                        <ClaimIntakePanel
                          plan={selectedPlan}
                          series={selectedSeries}
                          members={filteredMembers}
                          fundingLines={planFundingLines}
                          onRefresh={refresh}
                        />
                      ) : null}
                      {selectedClaim ? (
                        <ClaimsOperatorPanel
                          plan={selectedPlan}
                          series={selectedSeries}
                          claimCases={filteredClaims}
                          obligations={filteredObligations}
                          members={filteredMembers}
                          fundingLines={planFundingLines}
                          allocations={snapshot.allocationPositions}
                          classes={snapshot.capitalClasses}
                          pools={snapshot.liquidityPools}
                          selectedClaimAddress={selectedClaim?.address ?? null}
                          selectedPanel={routePanel}
                          onSelectClaim={(address) => updateParams({ claim: address, panel: "adjudication" })}
                          onSelectPanel={(panel) => updateParams({ panel })}
                          onRefresh={refresh}
                        />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <ClaimIntakePanel
                        plan={selectedPlan}
                        series={selectedSeries}
                        members={filteredMembers}
                        fundingLines={planFundingLines}
                        onRefresh={refresh}
                      />
                      <ClaimsOperatorPanel
                        plan={selectedPlan}
                        series={selectedSeries}
                        claimCases={filteredClaims}
                        obligations={filteredObligations}
                        members={filteredMembers}
                        fundingLines={planFundingLines}
                        allocations={snapshot.allocationPositions}
                        classes={snapshot.capitalClasses}
                        pools={snapshot.liquidityPools}
                        selectedClaimAddress={selectedClaim?.address ?? null}
                        selectedPanel={routePanel}
                        onSelectClaim={(address) => updateParams({ claim: address, panel: "adjudication" })}
                        onSelectPanel={(panel) => updateParams({ panel })}
                        onRefresh={refresh}
                      />
                      <article className="plans-card plans-claims-control heavy-glass">
                        <div className="plans-claims-control-segment">
                          <span className="plans-control-label">ACTIVE_PLAN</span>
                          <span className="plans-control-value">{selectedPlan?.planId ?? "—"}</span>
                          <span className="plans-control-meta">{selectedPlan?.sponsorLabel ?? ""}</span>
                        </div>
                        <div className="plans-claims-control-divider" aria-hidden="true" />
                        <div className="plans-claims-control-segment">
                          <span className="plans-control-label">LIVE_CASES</span>
                          <span className="plans-control-value">{filteredClaims.length}</span>
                          <span className="plans-control-meta">
                            {filteredObligations.length} obligations tracked
                          </span>
                        </div>
                        <div className="plans-claims-control-divider" aria-hidden="true" />
                        <div className="plans-claims-control-segment">
                          <span className="plans-control-label">SYSTEM_STATUS</span>
                          <span className="plans-control-value plans-control-value-accent">
                            <span className="plans-live-dot" aria-hidden="true" />
                            NOMINAL
                          </span>
                          <span className="plans-control-meta">Adjudication queue live</span>
                        </div>
                        <div className="plans-claims-control-actions">
                          <button type="button" className="plans-secondary-cta">
                            <span className="material-symbols-outlined">download</span>
                            EXPORT_CSV
                          </button>
                          <Link
                            href={`/claims?${new URLSearchParams({
                              ...(selectedPlan ? { plan: selectedPlan.address } : {}),
                              ...(selectedSeries ? { series: selectedSeries.address } : {}),
                              ...(selectedClaim ? { claim: selectedClaim.address } : filteredClaims[0] ? { claim: filteredClaims[0].address } : {}),
                              panel: "reserve",
                            }).toString()}`}
                            className="plans-primary-cta"
                          >
                            <span className="material-symbols-outlined">bolt</span>
                            INITIATE_RESERVE
                          </Link>
                        </div>
                      </article>

                      <article className="plans-card heavy-glass">
                        <div className="plans-card-head">
                          <div>
                            <p className="plans-card-eyebrow">ADJUDICATION_REGISTER</p>
                            <h2 className="plans-card-title plans-card-title-display">
                              Claim <em>cases</em>
                            </h2>
                          </div>
                          <span className="plans-card-meta">{filteredClaims.length} tracked</span>
                        </div>
                        {filteredClaims.length > 0 ? (
                          <div className="plans-table-wrap">
                            <table className="plans-table">
                              <thead>
                                <tr>
                                  <th>Claim</th>
                                  <th>Status</th>
                                  <th>Approved</th>
                                  <th>Reserved</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredClaims.map((claim) => (
                                  <tr key={claim.address}>
                                    <td data-label="Claim">
                                      <button
                                        type="button"
                                        className="plans-table-link"
                                        onClick={() => updateParams({ claim: claim.address, panel: "adjudication" })}
                                      >
                                        {claim.claimId}
                                      </button>
                                    </td>
                                    <td data-label="Status"><StatusBadge label={describeClaimStatus(claim.intakeStatus)} /></td>
                                    <td data-label="Approved"><span className="plans-table-amount">{formatAmount(claim.approvedAmount)}</span></td>
                                    <td data-label="Reserved"><span className="plans-table-amount">{formatAmount(claim.reservedAmount)}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <PlansEmptyState
                            title="No claim cases"
                            copy={selectedSeries
                              ? "This series does not currently expose claim cases. Clear the series filter to see plan-wide claims."
                              : "This plan does not currently expose claim cases."}
                          />
                        )}
                      </article>

                      {filteredObligations.length > 0 ? (
                        <article className="plans-card heavy-glass">
                          <div className="plans-card-head">
                            <div>
                              <p className="plans-card-eyebrow">OUTSTANDING_OBLIGATIONS</p>
                              <h2 className="plans-card-title plans-card-title-display">
                                Protocol <em>liabilities</em>
                              </h2>
                            </div>
                            <span className="plans-card-meta">{filteredObligations.length} tracked</span>
                          </div>
                          <div className="plans-table-wrap">
                            <table className="plans-table">
                              <thead>
                                <tr>
                                  <th>Obligation</th>
                                  <th>Status</th>
                                  <th>Principal</th>
                                  <th>Outstanding</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredObligations.map((obligation) => (
                                  <tr key={obligation.address}>
                                    <td data-label="Obligation">
                                      <button
                                        type="button"
                                        className="plans-table-link"
                                        onClick={() => updateParams({ claim: selectedClaim?.address ?? null, panel: "reserve" })}
                                      >
                                        {obligation.obligationId}
                                      </button>
                                    </td>
                                    <td data-label="Status"><StatusBadge label={describeObligationStatus(obligation.status)} /></td>
                                    <td data-label="Principal"><span className="plans-table-amount">{formatAmount(obligation.principalAmount)}</span></td>
                                    <td data-label="Outstanding"><span className="plans-table-amount">{formatAmount(obligation.outstandingAmount)}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </article>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {/* ── TREASURY ── */}
              {activeTab === "treasury" ? (
                <div className="plans-stack">
                  {genesisActivePlan && genesisReserveConsoleModel ? (
                    <>
                      <GenesisProtectAcuteReserveConsolePanel
                        model={genesisReserveConsoleModel}
                        onSelectFilter={(filter: GenesisProtectAcuteReserveLaneFilter) => updateParams({ lane: filter === "all" ? null : filter })}
                        onSelectLane={(fundingLineAddress) => updateParams({ line: fundingLineAddress })}
                      />
                      <article className="plans-card heavy-glass">
                        <div className="plans-card-head">
                          <div>
                            <p className="plans-card-eyebrow">GENESIS_TREASURY_MODE</p>
                            <h2 className="plans-card-title plans-card-title-display">
                              Reserve and <em>launch controls</em>
                            </h2>
                          </div>
                          <span className={`status-pill ${genesisSetupModel.posture.state === "healthy" ? "status-ok" : genesisSetupModel.posture.state === "paused" ? "status-error" : "status-off"}`}>
                            {genesisSetupModel.posture.state.toUpperCase()}
                          </span>
                        </div>
                        <p className="plans-card-body">
                          Reserve posting, premium recording, and pause controls stay in the same mounted Genesis workspace, but they are now scoped from the selected live reserve lane above instead of starting from raw IDs.
                        </p>
                        <div className="plans-wizard-support-actions">
                          <Link href={genesisBootstrapHref} className="secondary-button inline-flex w-fit">
                            Rerun Genesis template
                          </Link>
                          <Link href={genesisCapitalClassesHref} className="secondary-button inline-flex w-fit">
                            Open capital classes
                          </Link>
                          <Link href={genesisCapitalAllocationsHref} className="secondary-button inline-flex w-fit">
                            Open allocations
                          </Link>
                          <Link href={genesisOracleBindingsHref} className="secondary-button inline-flex w-fit">
                            Open oracle bindings
                          </Link>
                        </div>
                      </article>
                    </>
                  ) : genesisSetupVisible ? (
                    <article className="plans-card heavy-glass">
                      <div className="plans-card-head">
                        <div>
                          <p className="plans-card-eyebrow">GENESIS_TREASURY_MODE</p>
                          <h2 className="plans-card-title plans-card-title-display">
                            Reserve and <em>launch controls</em>
                          </h2>
                        </div>
                        <span className={`status-pill ${genesisSetupModel.posture.state === "healthy" ? "status-ok" : genesisSetupModel.posture.state === "paused" ? "status-error" : "status-off"}`}>
                          {genesisSetupModel.posture.state.toUpperCase()}
                        </span>
                      </div>
                      <p className="plans-card-body">
                        Use the existing treasury, capital, and oracle panels below to finish reserve floor review, operator bindings,
                        and issuance posture for the canonical Event 7 and Travel 30 launch shell.
                      </p>
                      <div className="plans-wizard-support-actions">
                        <Link href={genesisBootstrapHref} className="secondary-button inline-flex w-fit">
                          Rerun Genesis template
                        </Link>
                        <Link href={genesisCapitalClassesHref} className="secondary-button inline-flex w-fit">
                          Open capital classes
                        </Link>
                        <Link href={genesisCapitalAllocationsHref} className="secondary-button inline-flex w-fit">
                          Open allocations
                        </Link>
                        <Link href={genesisOracleBindingsHref} className="secondary-button inline-flex w-fit">
                          Open oracle bindings
                        </Link>
                      </div>
                    </article>
                  ) : null}
                  <TreasuryOperatorPanel
                    plan={selectedPlan}
                    series={selectedSeries}
                    seriesOptions={planSeries}
                    reserveDomain={selectedReserveDomain}
                    fundingLines={planFundingLines}
                    allocations={snapshot.allocationPositions.filter((allocation) => allocation.healthPlan === selectedPlan?.address)}
                    classes={snapshot.capitalClasses}
                    pools={snapshot.liquidityPools}
                    selectedFundingLineAddress={genesisActivePlan ? genesisReserveConsoleModel?.selectedLane?.fundingLineAddress ?? null : null}
                    onSelectFundingLine={(fundingLineAddress) => updateParams({ line: fundingLineAddress })}
                    onRefresh={refresh}
                  />
                  {!genesisActivePlan ? (
                    <article className="plans-card heavy-glass">
                      <div className="plans-card-head">
                        <div>
                          <p className="plans-card-eyebrow">FUNDING_LINES</p>
                          <h2 className="plans-card-title plans-card-title-display">
                            Reserve <em>balances</em>
                          </h2>
                        </div>
                        <span className="plans-card-meta">
                          <span className="plans-live-dot" aria-hidden="true" />
                          {planFundingLines.length} {planFundingLines.length === 1 ? "line" : "lines"}
                        </span>
                      </div>
                      {planFundingLines.length > 0 ? (
                        <ul className="plans-funding-list">
                          {planFundingLines.map((line) => {
                            const fundedVal = Number(line.fundedAmount);
                            const reservedVal = Number(line.reservedAmount);
                            const usedPct = fundedVal > 0 ? Math.round((reservedVal / fundedVal) * 100) : 0;
                            return (
                              <li key={line.address} className="plans-funding-row">
                                <div className="plans-funding-row-head">
                                  <div>
                                    <span className="plans-funding-name">{line.displayName}</span>
                                    <span className="plans-funding-type">{describeFundingLineType(line.lineType)}</span>
                                  </div>
                                  <span className="plans-funding-amount">${formatAmount(fundedVal)}</span>
                                </div>
                                <div className="plans-rail-bar plans-rail-bar-sm">
                                  <div className="plans-rail-bar-fill" style={{ width: `${Math.min(100, usedPct)}%` }} />
                                </div>
                                <div className="plans-funding-meta">
                                  <span>${formatAmount(reservedVal)} reserved</span>
                                  <span>{usedPct}% deployed</span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <PlansEmptyState
                          title="No funding lines"
                          copy="This plan has no funding lines configured."
                        />
                      )}
                    </article>
                  ) : null}

                  <article className="plans-card heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">ADMINISTRATION_LANES</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          Control <em>addresses</em>
                        </h2>
                      </div>
                      <span className="plans-card-meta">{selectedPlan?.planId}</span>
                    </div>
                    <div className="plans-settings-grid">
                      <div className="plans-settings-row">
                        <div>
                          <span className="plans-settings-label">RESERVE_DOMAIN</span>
                          <span className="plans-settings-lane">Reserve domain</span>
                        </div>
                        <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.reserveDomain, 6)}</span>
                      </div>
                      <div className="plans-settings-row">
                        <div>
                          <span className="plans-settings-label">PLAN_ADMIN</span>
                          <span className="plans-settings-lane">Plan admin</span>
                        </div>
                        <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.planAdmin, 6)}</span>
                      </div>
                      <div className="plans-settings-row">
                        <div>
                          <span className="plans-settings-label">SPONSOR_OPERATOR</span>
                          <span className="plans-settings-lane">Sponsor operator</span>
                        </div>
                        <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.sponsorOperator, 6)}</span>
                      </div>
                      <div className="plans-settings-row">
                        <div>
                          <span className="plans-settings-label">CLAIMS_OPERATOR</span>
                          <span className="plans-settings-lane">Claims operator</span>
                        </div>
                        <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.claimsOperator, 6)}</span>
                      </div>
                    </div>
                  </article>
                </div>
              ) : null}
            </section>

            {/* ── Rail ───────────────────────── */}
            <aside className="plans-rail">
              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">SPONSOR_VELOCITY</span>
                  <span className="plans-rail-subtag">
                    <span className="plans-live-dot" aria-hidden="true" />
                    LIVE
                  </span>
                </div>
                <div className="plans-rail-hero">
                  <span className="plans-rail-hero-val">${formatAmount(remaining)}</span>
                  <span className="plans-rail-hero-sub">remaining of ${formatAmount(funded)} funded</span>
                </div>
                <div className="plans-rail-bar">
                  <div className="plans-rail-bar-fill" style={{ width: `${Math.min(100, deployedPct)}%` }} />
                </div>
                <div className="plans-rail-row">
                  <span>Deployed</span>
                  <strong>{deployedPct}%</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Reserve coverage</span>
                  <strong>{formatAmount(reserveCoverage)} bps</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Accrued rewards</span>
                  <strong>${formatAmount(sponsorView?.accruedRewards ?? 0)}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Pool utilization</span>
                  <strong>{poolUtilization}%</strong>
                </div>
              </section>

              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">FIELD_LOG</span>
                  <span className="plans-rail-subtag">LIVE_AUDIT</span>
                </div>
                <div className="plans-rail-trail">
                  {auditTrail.map((item) => (
                    <div key={item.id} className={`plans-rail-event plans-rail-event-${item.tone}`}>
                      <span className="plans-rail-event-dot" aria-hidden="true" />
                      <div className="plans-rail-event-copy">
                        <div className="plans-rail-event-row">
                          <strong className="plans-rail-event-label">{item.label}</strong>
                          <time className="plans-rail-event-time">{item.timestamp}</time>
                        </div>
                        <p className="plans-rail-event-detail">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
