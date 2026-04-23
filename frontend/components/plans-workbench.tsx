// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PlanCoveragePanel } from "@/components/plan-coverage-panel";
import {
  PlanOperatorDrawer,
  type PlanOperatorSection,
} from "@/components/plan-operator-drawer";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { buildCanonicalConsoleStateFromSnapshot } from "@/lib/console-model";
import { formatAmount, plansForPool, seriesOutcomeCount } from "@/lib/canonical-ui";
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
  SERIES_MODE_PROTECTION,
  shortenAddress,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

/* ── Constants ──────────────────────────────────────── */

const SERIES_OPTIONAL_TABS = new Set<PlanTabId>(["members", "claims", "treasury", "overview"]);
const OPERATOR_PERSONAS: ReadonlySet<string> = new Set(["capital", "governance", "sponsor"]);

type TabHero = { eyebrow: string; title: string; emphasis: string; tail: string; subtitle: string };
type PlansRouteMode = "plans" | "claims";

const TAB_HEROES: Record<PlanTabId, TabHero> = {
  overview: {
    eyebrow: "Plan",
    title: "Overview",
    emphasis: "",
    tail: "",
    subtitle: "Capital velocity, claim activity, and reserve depth at a glance.",
  },
  coverage: {
    eyebrow: "Plan",
    title: "Coverage",
    emphasis: "",
    tail: "",
    subtitle: "Protection series, premium schedule, and linked capital for this plan.",
  },
  members: {
    eyebrow: "Plan",
    title: "Members",
    emphasis: "",
    tail: "",
    subtitle: "Enrolled wallets and their eligibility. Enlist new members or review the register.",
  },
  claims: {
    eyebrow: "Plan",
    title: "Claims",
    emphasis: "",
    tail: "",
    subtitle: "Claim cases and outstanding obligations. Trigger reserve and settlement actions.",
  },
  treasury: {
    eyebrow: "Plan",
    title: "Treasury",
    emphasis: "",
    tail: "",
    subtitle: "Funding lines and reserve posture for this plan.",
  },
};

const ROUTE_HEROES: Record<Exclude<PlansRouteMode, "plans">, TabHero> = {
  claims: {
    eyebrow: "Protocol",
    title: "Claims",
    emphasis: "",
    tail: "",
    subtitle: "Claim cases and reserve-linked obligations across every plan.",
  },
};

/* ── Helpers ────────────────────────────────────────── */

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

function humanizeFundingLineType(lineType: number): string {
  const raw = describeFundingLineType(lineType);
  if (raw.startsWith("unknown")) return raw;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    case "sponsor": return "Sponsor";
    case "capital": return "Capital";
    case "governance": return "Governance";
    default: return "Observer";
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
  const router = useRouter();
  const pathname = usePathname();
  const { effectivePersona } = useWorkspacePersona();
  const { snapshot, loading, error, refresh } = useProtocolConsoleSnapshot();
  const consoleState = useMemo(() => buildCanonicalConsoleStateFromSnapshot(snapshot), [snapshot]);
  const routeMode: PlansRouteMode = pathname === "/claims" ? "claims" : "plans";
  const forcedTab: PlanTabId | null = routeMode === "claims" ? "claims" : null;

  /* ── Selection state ── */

  const requestedTab = firstSearchParamValue(searchParams.tab);
  const queryPool = firstSearchParamValue(searchParams.pool)?.trim() ?? "";
  const allPlans = useMemo(
    () => (queryPool ? plansForPool(queryPool, snapshot) : snapshot.healthPlans),
    [queryPool, snapshot],
  );
  const queryPlan = firstSearchParamValue(searchParams.plan)?.trim() ?? "";
  const matchedPlan = useMemo(() => allPlans.find((plan) => plan.address === queryPlan) ?? null, [allPlans, queryPlan]);
  const hasInvalidPlan = Boolean(queryPlan) && !matchedPlan;
  const selectedPlan = useMemo(() => {
    if (hasInvalidPlan) return null;
    return matchedPlan ?? allPlans[0] ?? null;
  }, [allPlans, hasInvalidPlan, matchedPlan]);

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
  const seriesSelectionOptional = SERIES_OPTIONAL_TABS.has(activeTab);
  const matchedSeries = useMemo(
    () => planSeries.find((series) => series.address === querySeries) ?? null,
    [planSeries, querySeries],
  );
  const hasInvalidSeries = Boolean(querySeries) && !matchedSeries;
  const preferredProtectionSeries = useMemo(
    () => planProtectionSeries[0] ?? null,
    [planProtectionSeries],
  );
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
  const selectedClaim = useMemo(
    () => filteredClaims.find((claim) => claim.address === queryClaim) ?? filteredClaims[0] ?? null,
    [filteredClaims, queryClaim],
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
    if (activeTab === "members" && selectedMember && queryMember !== selectedMember.address) {
      nextUpdates.member = selectedMember.address;
    }
    if (activeTab === "members" && !selectedMember && queryMember) nextUpdates.member = null;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, forcedTab, hasInvalidPlan, hasInvalidSeries, queryClaim, queryMember, queryPlan, querySeries, requestedTab, routeMode, selectedClaim, selectedMember, selectedPlan, selectedSeries, updateParams]);

  /* ── Scroll tab into view ── */

  const tabBarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const activeButton = bar.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`);
    if (activeButton) activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTab]);

  /* ── Operator drawer ── */

  const canOperate = OPERATOR_PERSONAS.has(effectivePersona);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [operatorSection, setOperatorSection] = useState<PlanOperatorSection>("funding");

  const openOperator = useCallback((next: PlanOperatorSection) => {
    setOperatorSection(next);
    setOperatorOpen(true);
  }, []);

  const sectionForTab: Record<PlanTabId, PlanOperatorSection> = {
    overview: "funding",
    coverage: "funding",
    members: "members",
    claims: "claims",
    treasury: "funding",
  };

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
              {canOperate ? (
                <button
                  type="button"
                  className="plans-hero-cta"
                  onClick={() => openOperator(sectionForTab[activeTab])}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">tune</span>
                  Operator actions
                </button>
              ) : null}
              <Link
                href={routeMode === "plans" ? "/plans/new" : planWorkspaceHref}
                className={canOperate ? "plans-secondary-cta" : "plans-hero-cta"}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {routeMode === "plans" ? "add" : "arrow_back"}
                </span>
                {routeMode === "plans" ? "New plan" : "Back to plan"}
              </Link>
            </div>
          </div>
        </header>

        {loading || error ? (
          <div className="plans-stack">
            <article className="plans-card liquid-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">Live protocol state</p>
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
              eyebrow="Plan"
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
              eyebrow="Series"
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
                  <article className="plans-card plans-vitality heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">Vitality</p>
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
                          <span className="plans-chart-label">Reserved by series</span>
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
                        <p className="plans-card-eyebrow">Series</p>
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
                  <article className="plans-card heavy-glass">
                    <div className="plans-members-head">
                      <div>
                        <p className="plans-card-eyebrow">Register</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {filteredMembers.length} <em>members</em> enlisted
                        </h2>
                      </div>
                      {canOperate ? (
                        <button
                          type="button"
                          className="plans-primary-cta"
                          onClick={() => openOperator("members")}
                        >
                          <span className="material-symbols-outlined">person_add</span>
                          Enlist member
                        </button>
                      ) : null}
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
                            {key.charAt(0).toUpperCase() + key.slice(1)}
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
                                <span className="plans-member-label">Delegated rights</span>
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
                  <article className="plans-card plans-claims-control heavy-glass">
                        <div className="plans-claims-control-segment">
                          <span className="plans-control-label">Plan</span>
                          <span className="plans-control-value">{selectedPlan?.planId ?? "—"}</span>
                          <span className="plans-control-meta">{selectedPlan?.sponsorLabel ?? ""}</span>
                        </div>
                        <div className="plans-claims-control-divider" aria-hidden="true" />
                        <div className="plans-claims-control-segment">
                          <span className="plans-control-label">Live cases</span>
                          <span className="plans-control-value">{filteredClaims.length}</span>
                          <span className="plans-control-meta">
                            {filteredObligations.length} obligations tracked
                          </span>
                        </div>
                        <div className="plans-claims-control-divider" aria-hidden="true" />
                        <div className="plans-claims-control-segment">
                          <span className="plans-control-label">Status</span>
                          <span className="plans-control-value plans-control-value-accent">
                            <span className="plans-live-dot" aria-hidden="true" />
                            Nominal
                          </span>
                          <span className="plans-control-meta">Adjudication queue live</span>
                        </div>
                        {canOperate ? (
                          <div className="plans-claims-control-actions">
                            <button
                              type="button"
                              className="plans-primary-cta"
                              onClick={() => openOperator("claims")}
                            >
                              <span className="material-symbols-outlined">bolt</span>
                              Initiate reserve
                            </button>
                          </div>
                        ) : null}
                      </article>

                      <article className="plans-card heavy-glass">
                        <div className="plans-card-head">
                          <div>
                            <p className="plans-card-eyebrow">Register</p>
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
                              <p className="plans-card-eyebrow">Obligations</p>
                              <h2 className="plans-card-title plans-card-title-display">
                                Outstanding <em>liabilities</em>
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
                </div>
              ) : null}

              {/* ── TREASURY ── */}
              {activeTab === "treasury" ? (
                <div className="plans-stack">
                  <article className="plans-card heavy-glass">
                      <div className="plans-card-head">
                        <div>
                          <p className="plans-card-eyebrow">Funding lines</p>
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
                                    <span className="plans-funding-type">{humanizeFundingLineType(line.lineType)}</span>
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
                </div>
              ) : null}
            </section>

            {/* ── Rail ───────────────────────── */}
            <aside className="plans-rail">
              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">Sponsor velocity</span>
                  <span className="plans-rail-subtag">
                    <span className="plans-live-dot" aria-hidden="true" />
                    Live
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
                  <span className="plans-rail-tag">Activity</span>
                  <span className="plans-rail-subtag">Live audit</span>
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

      {canOperate ? (
        <PlanOperatorDrawer
          open={operatorOpen}
          initialSection={operatorSection}
          onOpenChange={setOperatorOpen}
          onRefresh={refresh}
          plan={selectedPlan}
          series={selectedSeries}
          reserveDomain={selectedReserveDomain}
          fundingLines={planFundingLines}
          seriesOptions={planSeries}
          members={filteredMembers}
          claimCases={filteredClaims}
          obligations={filteredObligations}
          allocations={snapshot.allocationPositions.filter(
            (allocation) => allocation.healthPlan === selectedPlan?.address,
          )}
          classes={snapshot.capitalClasses}
          pools={snapshot.liquidityPools}
        />
      ) : null}
    </div>
  );
}
