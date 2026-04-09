// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useWorkspacePersona } from "@/components/workspace-persona";
import { buildCanonicalConsoleState } from "@/lib/console-model";
import { formatAmount, seriesOutcomeCount } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE, isUnsetDevnetWalletAddress } from "@/lib/devnet-fixtures";
import {
  buildAuditTrail,
  defaultTabForPersona,
  PLAN_TABS,
  type PlanTabId,
} from "@/lib/workbench";
import {
  availableFundingLineBalance,
  describeClaimStatus,
  describeEligibilityStatus,
  describeFundingLineType,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  shortenAddress,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

/* ── Constants ──────────────────────────────────────── */

const SERIES_OPTIONAL_TABS = new Set<PlanTabId>(["claims", "members", "schemas"]);

const TAB_ICONS: Record<PlanTabId, string> = {
  overview: "dashboard",
  series: "category",
  members: "group",
  claims: "gavel",
  schemas: "schema",
  funding: "account_balance",
  settings: "tune",
};

const TAB_NUMBERS: Record<PlanTabId, string> = {
  overview: "01",
  series: "02",
  members: "03",
  claims: "04",
  schemas: "05",
  funding: "06",
  settings: "07",
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

function claimsEmptyCopy(selectedSeries: boolean, planHasClaims: boolean): string {
  if (!selectedSeries) return "This plan does not currently expose claim cases.";
  if (planHasClaims) return "This series filter does not contain the plan's live claims. Choose another series or clear the series filter.";
  return "This series does not currently expose claim cases.";
}

function obligationsEmptyCopy(selectedSeries: boolean, planHasObligations: boolean): string {
  if (!selectedSeries) return "This plan does not currently expose obligations.";
  if (planHasObligations) return "This series filter does not contain the plan's obligations. Choose another series or clear the series filter.";
  return "This series does not currently expose obligations.";
}

function PlansEmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="plans-empty liquid-glass">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

function personaHeroCopy(persona: string): { eyebrow: string; subtitle: string } {
  switch (persona) {
    case "sponsor":
      return {
        eyebrow: "PROTOCOL_CONSOLE // SPONSOR_WORKSPACE",
        subtitle: "Operate the full lifecycle of your clinical plans — budgets, series, members, and claims across a single control plane.",
      };
    case "capital":
      return {
        eyebrow: "PROTOCOL_CONSOLE // CAPITAL_WORKSPACE",
        subtitle: "Inspect how pool allocations flow into each plan and trace reserve coverage across the sponsor rail.",
      };
    case "governance":
      return {
        eyebrow: "PROTOCOL_CONSOLE // GOVERNANCE_WORKSPACE",
        subtitle: "Review plan operations, administration lanes, and settlement history before approving new controls.",
      };
    default:
      return {
        eyebrow: "PROTOCOL_CONSOLE // OBSERVER_WORKSPACE",
        subtitle: "Coverage series, member exposure, and sponsor operations across the public OmegaX protocol surface.",
      };
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

export function PlansWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { effectivePersona } = useWorkspacePersona();
  const consoleState = useMemo(() => buildCanonicalConsoleState(), []);

  /* ── Selection state ── */

  const requestedTab = searchParams.get("tab");
  const activeTab = (PLAN_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("plans", effectivePersona)) as PlanTabId;

  const allPlans = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans;
  const queryPlan = searchParams.get("plan")?.trim() ?? "";
  const matchedPlan = useMemo(() => allPlans.find((plan) => plan.address === queryPlan) ?? null, [allPlans, queryPlan]);
  const hasInvalidPlan = Boolean(queryPlan) && !matchedPlan;
  const selectedPlan = useMemo(() => {
    if (hasInvalidPlan) return null;
    return matchedPlan ?? allPlans[0] ?? null;
  }, [allPlans, hasInvalidPlan, matchedPlan]);

  const planSeries = useMemo(() => {
    if (!selectedPlan) return [];
    return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => series.healthPlan === selectedPlan.address);
  }, [selectedPlan]);

  const querySeries = searchParams.get("series")?.trim() ?? "";
  const seriesSelectionOptional = SERIES_OPTIONAL_TABS.has(activeTab);
  const matchedSeries = useMemo(
    () => planSeries.find((series) => series.address === querySeries) ?? null,
    [planSeries, querySeries],
  );
  const hasInvalidSeries = Boolean(querySeries) && !matchedSeries;
  const selectedSeries = useMemo(() => {
    if (hasInvalidSeries) return null;
    if (matchedSeries) return matchedSeries;
    if (seriesSelectionOptional) return null;
    return planSeries[0] ?? null;
  }, [hasInvalidSeries, matchedSeries, planSeries, seriesSelectionOptional]);

  /* ── Derived data ── */

  const sponsorView = useMemo(
    () => consoleState.sponsors.find((entry) => entry.healthPlanAddress === selectedPlan?.address) ?? null,
    [consoleState.sponsors, selectedPlan],
  );
  const planFundingLines = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.filter((line) => line.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const planClaims = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => claim.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const filteredClaims = useMemo(
    () => (selectedSeries ? planClaims.filter((claim) => claim.policySeries === selectedSeries.address) : planClaims),
    [planClaims, selectedSeries],
  );
  const planObligations = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) => obligation.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const filteredObligations = useMemo(
    () => (selectedSeries ? planObligations.filter((obligation) => obligation.policySeries === selectedSeries.address) : planObligations),
    [planObligations, selectedSeries],
  );
  const planMembers = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.filter((position) => position.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const filteredMembers = useMemo(
    () => (selectedSeries ? planMembers.filter((position) => position.policySeries === selectedSeries.address) : planMembers),
    [planMembers, selectedSeries],
  );
  const auditTrail = useMemo(
    () => buildAuditTrail({
      section: "plans",
      planAddress: selectedPlan?.address,
      seriesAddress: selectedSeries?.address,
    }),
    [selectedPlan, selectedSeries],
  );

  /* ── URL sync ── */

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
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
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedPlan && queryPlan !== selectedPlan.address) nextUpdates.plan = selectedPlan.address;
    if (selectedSeries && querySeries !== selectedSeries.address) nextUpdates.series = selectedSeries.address;
    if (!selectedSeries && querySeries) nextUpdates.series = null;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, hasInvalidPlan, hasInvalidSeries, queryPlan, querySeries, requestedTab, selectedPlan, selectedSeries, updateParams]);

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

  // Protocol Vitality bar chart data (per-series approvals × claim count)
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

  const { eyebrow: heroEyebrow, subtitle: heroSubtitle } = personaHeroCopy(effectivePersona);

  /* ── Invalid selection guard ── */

  const invalidSelection = hasInvalidPlan
    ? { title: "Plan not found", copy: "The requested health plan is not present in the current fixture set. Choose another plan to continue." }
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
          <div className="plans-hero-copy">
            <span className="plans-hero-eyebrow">{heroEyebrow}</span>
            <h1 className="plans-hero-title">
              Active <em>Workspace</em>
            </h1>
            <p className="plans-hero-subtitle">{heroSubtitle}</p>
          </div>

          <div className="plans-hero-selectors liquid-glass">
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
            <span className="plans-hero-selectors-divider" aria-hidden="true" />
            <HeroSelector
              eyebrow="POLICY_SERIES"
              label="Policy series"
              value={selectedSeries}
              options={planSeries}
              renderLabel={(series) => series.displayName}
              renderMeta={(series) => `${series.seriesId} · ${describeSeriesMode(series.mode)}`}
              placeholder={planSeries.length > 0 ? "All series" : "No series"}
              disabled={!selectedPlan || planSeries.length === 0}
              onChange={(value) => updateParams({ series: value || null })}
            />
          </div>
        </header>

        {/* ── KPI strip ─────────────────────── */}
        <section className="plans-kpi-strip" aria-label="Plan workspace telemetry">
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">BUDGET_REMAINING</span>
            <span className="plans-kpi-value">${formatAmount(remaining)}</span>
            <span className="plans-kpi-meta">of ${formatAmount(funded)} funded</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">ACTIVE_SERIES</span>
            <span className="plans-kpi-value">{planSeries.length}</span>
            <span className="plans-kpi-meta">{planMembers.length} member positions</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">CLAIMS_LIVE</span>
            <span className="plans-kpi-value">{planClaimCount}</span>
            <span className="plans-kpi-meta">{planObligations.length} obligations tracked</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">FUNDING_UTILIZATION</span>
            <span className="plans-kpi-value">
              <span className="plans-kpi-pulse" aria-hidden="true" />
              {poolUtilization}%
            </span>
            <span className="plans-kpi-meta">{planFundingLines.length} {planFundingLines.length === 1 ? "line" : "lines"} · {formatAmount(reserveCoverage)} bps</span>
          </div>
        </section>

        {/* ── Tab bar ───────────────────────── */}
        <nav className="plans-tabs liquid-glass" aria-label="Plan workspace sections">
          <div ref={tabBarRef} className="plans-tabs-inner">
            {PLAN_TABS.map((tab) => {
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
                  <span className="material-symbols-outlined plans-tab-icon">{TAB_ICONS[tab.id as PlanTabId]}</span>
                  <span className="plans-tab-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Body ──────────────────────────── */}
        {invalidSelection ? (
          <PlansEmptyState title={invalidSelection.title} copy={invalidSelection.copy} />
        ) : (
          <div className="plans-body">
            <section className="plans-main">

              {/* ── Overview tab ── */}
              {activeTab === "overview" ? (
                <div className="plans-overview-grid">
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
                    <p className="plans-card-body">
                      Capital velocity, claim activity, and reserve depth across every lane of this plan — a single
                      operational heartbeat for the sponsor rail.
                    </p>

                    <div className="plans-vitality-stats">
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value">{deployedPct}%</span>
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

                  <article className="plans-card plans-pressure heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">RESERVE_PRESSURE</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {deployedPct}<span className="plans-pressure-unit">%</span>
                        </h2>
                      </div>
                      <span className={cn("plans-card-meta", deployedPct > 80 && "plans-card-meta-warn")}>
                        {deployedPct > 80 ? "ELEVATED" : "NOMINAL"}
                      </span>
                    </div>
                    <div className="plans-pressure-bar">
                      <div
                        className="plans-pressure-bar-fill"
                        style={{ width: `${Math.min(100, deployedPct)}%` }}
                      />
                    </div>
                    <div className="plans-pressure-meta">
                      <span>${formatAmount(deployed)} deployed</span>
                      <span>${formatAmount(remaining)} remaining</span>
                    </div>
                  </article>

                  <article className="plans-card plans-velocity heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">CLAIMS_VELOCITY</p>
                        <h2 className="plans-card-title plans-card-title-display">{planClaimCount}</h2>
                      </div>
                      <span className="plans-card-meta">
                        <span className="plans-live-dot" aria-hidden="true" />
                        LIVE
                      </span>
                    </div>
                    <p className="plans-card-body">
                      Active adjudications across {planSeries.length} series lanes, with {planObligations.length} obligations
                      in protocol custody.
                    </p>
                    <button
                      type="button"
                      className="plans-inline-action"
                      onClick={() => updateParams({ tab: "claims" })}
                    >
                      INSPECT_CLAIMS
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </article>

                  <article className="plans-card plans-lanes heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">SERIES_LANES</p>
                        <h2 className="plans-card-title">Coverage across the plan</h2>
                      </div>
                      <span className="plans-card-meta">{planSeries.length} active</span>
                    </div>
                    <div className="plans-lane-stack">
                      {planSeries.map((series) => {
                        const isSelected = selectedSeries?.address === series.address;
                        return (
                          <button
                            type="button"
                            key={series.address}
                            className={cn("plans-lane", isSelected && "plans-lane-active")}
                            onClick={() => updateParams({ series: series.address })}
                          >
                            <div className="plans-lane-info">
                              <span className="plans-lane-name">{series.displayName}</span>
                              <span className="plans-lane-key">{series.comparabilityKey}</span>
                            </div>
                            <div className="plans-lane-meta">
                              <span className="plans-lane-mode">{describeSeriesMode(series.mode)}</span>
                              <StatusBadge label={describeSeriesStatus(series.status)} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                </div>
              ) : null}

              {/* ── Series tab ── */}
              {activeTab === "series" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">POLICY_SERIES_REGISTER</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        {planSeries.length} active <em>{planSeries.length === 1 ? "lane" : "lanes"}</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">
                      <span className="plans-live-dot" aria-hidden="true" />
                      {selectedPlan?.planId}
                    </span>
                  </div>
                  <div className="plans-table-wrap">
                    <table className="plans-table">
                      <thead>
                        <tr>
                          <th>Series</th>
                          <th>Version</th>
                          <th>Comparability</th>
                          <th>Outcomes</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planSeries.map((series) => {
                          const isSelected = selectedSeries?.address === series.address;
                          return (
                            <tr key={series.address} className={cn(isSelected && "plans-table-row-active")}>
                              <td data-label="Series">
                                <button
                                  type="button"
                                  className="plans-table-link"
                                  onClick={() => updateParams({ series: series.address })}
                                >
                                  {series.displayName}
                                </button>
                              </td>
                              <td data-label="Version"><span className="plans-table-mono">{series.termsVersion}</span></td>
                              <td data-label="Comparability"><span className="plans-table-mono">{series.comparabilityKey}</span></td>
                              <td data-label="Outcomes"><span className="plans-table-mono">{formatAmount(seriesOutcomeCount(series.address))}</span></td>
                              <td data-label="Status"><StatusBadge label={describeSeriesStatus(series.status)} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              ) : null}

              {/* ── Members tab ── */}
              {activeTab === "members" ? (
                filteredMembers.length > 0 ? (
                  <article className="plans-card heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">ELIGIBILITY_REGISTER</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          Member <em>positions</em>
                        </h2>
                      </div>
                      <span className="plans-card-meta">{filteredMembers.length} tracked</span>
                    </div>
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Wallet</th>
                            <th>Eligibility</th>
                            <th>Delegated rights</th>
                            <th>Position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.map((member) => (
                            <tr key={member.address}>
                              <td data-label="Wallet"><span className="plans-table-mono">{shortenAddress(member.wallet, 6)}</span></td>
                              <td data-label="Eligibility"><StatusBadge label={describeEligibilityStatus(member.eligibilityStatus)} /></td>
                              <td data-label="Delegated rights">{member.delegatedRights.join(", ") || "None"}</td>
                              <td data-label="Position"><span className="plans-table-mono">{shortenAddress(member.address, 6)}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ) : (
                  <PlansEmptyState
                    title="No member positions in this filter"
                    copy={effectivePersona === "sponsor"
                      ? "Choose another series or plan to inspect member rights."
                      : "This plan filter does not currently expose member positions."}
                  />
                )
              ) : null}

              {/* ── Claims tab ── */}
              {activeTab === "claims" ? (
                <div className="plans-stack">
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
                                <td data-label="Claim"><span className="plans-table-mono">{claim.claimId}</span></td>
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
                        title="No claim cases in this filter"
                        copy={claimsEmptyCopy(Boolean(selectedSeries), planClaims.length > 0)}
                      />
                    )}
                  </article>

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
                    {filteredObligations.length > 0 ? (
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
                                <td data-label="Obligation"><span className="plans-table-mono">{obligation.obligationId}</span></td>
                                <td data-label="Status"><StatusBadge label={describeObligationStatus(obligation.status)} /></td>
                                <td data-label="Principal"><span className="plans-table-amount">{formatAmount(obligation.principalAmount)}</span></td>
                                <td data-label="Outstanding"><span className="plans-table-amount">{formatAmount(obligation.outstandingAmount)}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <PlansEmptyState
                        title="No obligations in this filter"
                        copy={obligationsEmptyCopy(Boolean(selectedSeries), planObligations.length > 0)}
                      />
                    )}
                  </article>
                </div>
              ) : null}

              {/* ── Schemas tab ── */}
              {activeTab === "schemas" ? (
                selectedSeries ? (
                  <div className="plans-stack">
                    <article className="plans-card heavy-glass">
                      <div className="plans-card-head">
                        <div>
                          <p className="plans-card-eyebrow">COMPARABILITY_SCHEMA</p>
                          <h2 className="plans-card-title plans-card-title-display">
                            {selectedSeries.displayName}
                          </h2>
                        </div>
                        <span className="plans-card-meta">{selectedSeries.termsVersion}</span>
                      </div>
                      <div className="plans-data-grid">
                        <div className="plans-data-row">
                          <span className="plans-data-label">Comparability_Key</span>
                          <strong className="plans-data-value">{selectedSeries.comparabilityKey}</strong>
                        </div>
                        <div className="plans-data-row">
                          <span className="plans-data-label">Outcome_Count</span>
                          <strong className="plans-data-value">{formatAmount(seriesOutcomeCount(selectedSeries.address))}</strong>
                        </div>
                        <div className="plans-data-row">
                          <span className="plans-data-label">Status</span>
                          <StatusBadge label={describeSeriesStatus(selectedSeries.status)} />
                        </div>
                      </div>
                    </article>

                    <article className="plans-card heavy-glass">
                      <div className="plans-card-head">
                        <div>
                          <p className="plans-card-eyebrow">ON_CHAIN_STATE</p>
                          <h2 className="plans-card-title">Series metadata</h2>
                        </div>
                      </div>
                      <div className="plans-data-grid">
                        <div className="plans-data-row">
                          <span className="plans-data-label">Series_ID</span>
                          <span className="plans-data-value plans-table-mono">{selectedSeries.seriesId}</span>
                        </div>
                        <div className="plans-data-row">
                          <span className="plans-data-label">Mode</span>
                          <span className="plans-data-value">{describeSeriesMode(selectedSeries.mode)}</span>
                        </div>
                        <div className="plans-data-row">
                          <span className="plans-data-label">Terms_Version</span>
                          <span className="plans-data-value plans-table-mono">{selectedSeries.termsVersion}</span>
                        </div>
                        <div className="plans-data-row">
                          <span className="plans-data-label">Address</span>
                          <span className="plans-data-value plans-table-mono">{shortenAddress(selectedSeries.address, 8)}</span>
                        </div>
                      </div>
                    </article>
                  </div>
                ) : (
                  <PlansEmptyState
                    title="No schema context"
                    copy="Choose a policy series to inspect its comparability posture and on-chain metadata."
                  />
                )
              ) : null}

              {/* ── Funding tab ── */}
              {activeTab === "funding" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">FUNDING_LINES</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Balances &amp; <em>reserves</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">
                      <span className="plans-live-dot" aria-hidden="true" />
                      {planFundingLines.length} {planFundingLines.length === 1 ? "line" : "lines"}
                    </span>
                  </div>
                  <div className="plans-table-wrap">
                    <table className="plans-table">
                      <thead>
                        <tr>
                          <th>Funding line</th>
                          <th>Type</th>
                          <th>Funded</th>
                          <th>Reserved</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planFundingLines.map((line) => (
                          <tr key={line.address}>
                            <td data-label="Funding line">{line.displayName}</td>
                            <td data-label="Type">{describeFundingLineType(line.lineType)}</td>
                            <td data-label="Funded"><span className="plans-table-amount">{formatAmount(line.fundedAmount)}</span></td>
                            <td data-label="Reserved"><span className="plans-table-amount">{formatAmount(line.reservedAmount)}</span></td>
                            <td data-label="Status"><StatusBadge label={line.status === 0 ? "Open" : "Managed"} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ) : null}

              {/* ── Settings tab ── */}
              {activeTab === "settings" ? (
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
              </section>

              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">FUNDING_LINES</span>
                  <span className="plans-rail-subtag">{planFundingLines.length} active</span>
                </div>
                <div className="plans-rail-lines">
                  {planFundingLines.map((line) => {
                    const fundedVal = Number(line.fundedAmount);
                    const reservedVal = Number(line.reservedAmount);
                    const available = availableFundingLineBalance(line);
                    const usedPct = fundedVal > 0 ? Math.round((reservedVal / fundedVal) * 100) : 0;
                    return (
                      <div key={line.address} className="plans-rail-line">
                        <div className="plans-rail-row">
                          <span>{line.displayName}</span>
                          <strong>${formatAmount(available)}</strong>
                        </div>
                        <div className="plans-rail-bar plans-rail-bar-sm">
                          <div className="plans-rail-bar-fill" style={{ width: `${Math.min(100, usedPct)}%` }} />
                        </div>
                        <div className="plans-rail-line-meta">
                          <span>${formatAmount(reservedVal)} reserved</span>
                          <span>${formatAmount(fundedVal)} funded</span>
                        </div>
                      </div>
                    );
                  })}
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
