// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  CapitalOperatorDrawer,
  type CapitalOperatorSection,
} from "@/components/capital-operator-drawer";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { buildCanonicalConsoleStateFromSnapshot } from "@/lib/console-model";
import { formatAmount } from "@/lib/canonical-ui";
import { firstSearchParamValue, type RouteSearchParams, toURLSearchParams } from "@/lib/search-params";
import { useProtocolConsoleSnapshot } from "@/lib/use-protocol-console-snapshot";
import {
  buildAuditTrail,
  CAPITAL_TABS,
  defaultTabForPersona,
  type CapitalTabId,
} from "@/lib/workbench";
import {
  describeCapitalRestriction,
  describeLpQueueStatus,
  hasPendingRedemptionQueue,
  shortenAddress,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

/* ── Constants ──────────────────────────────────────── */

type TabHero = { eyebrow: string; title: string; emphasis: string; tail: string; subtitle: string };

const TAB_HEROES: Record<CapitalTabId, TabHero> = {
  overview: {
    eyebrow: "Reserve treasury",
    title: "Reserve",
    emphasis: "Treasury.",
    tail: "",
    subtitle:
      "Pool depth, class allocation, and redemption pressure across every lane.",
  },
  classes: {
    eyebrow: "Capital classes",
    title: "Capital",
    emphasis: "Classes.",
    tail: "",
    subtitle:
      "Tranche restrictions, NAV depth, and lockup posture for classes in this pool.",
  },
  allocations: {
    eyebrow: "Allocation lanes",
    title: "Allocation",
    emphasis: "Lanes.",
    tail: "",
    subtitle:
      "Capacity deployed from this pool into the plans it currently funds.",
  },
  queue: {
    eyebrow: "Redemption queue",
    title: "Redemption",
    emphasis: "Queue.",
    tail: "",
    subtitle: "Pending exits waiting on protocol processing.",
  },
  "linked-plans": {
    eyebrow: "Linked plans",
    title: "Linked",
    emphasis: "Plans.",
    tail: "",
    subtitle: "Plans currently drawing from this reserve.",
  },
};

const OPERATOR_PERSONAS: ReadonlySet<string> = new Set(["capital", "governance", "sponsor"]);

/* ── Helpers ────────────────────────────────────────── */

function describeRedemptionPolicyInline(queueOnly?: boolean) {
  return queueOnly ? "Queue only" : "Open";
}

function humanizeCapitalRestriction(restrictionMode: number): string {
  switch (describeCapitalRestriction(restrictionMode)) {
    case "open":
      return "Open";
    case "restricted":
      return "Restricted";
    case "wrapper_only":
      return "Wrapper only";
    default:
      return describeCapitalRestriction(restrictionMode);
  }
}

function buildPlansWorkbenchHref(input: {
  plan: string;
  series?: string | null;
  tab: "overview" | "treasury";
}): string {
  const params = new URLSearchParams({
    plan: input.plan,
    tab: input.tab,
  });

  if (input.series) params.set("series", input.series);

  return `/plans?${params.toString()}`;
}

function personaEyebrow(_persona: string): string {
  return "Capital";
}

function CapitalEmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="plans-empty liquid-glass">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
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

type CapitalWorkbenchProps = {
  searchParams?: RouteSearchParams;
};

export function CapitalWorkbench({ searchParams = {} }: CapitalWorkbenchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { effectivePersona } = useWorkspacePersona();
  const { snapshot, loading, error, refresh } = useProtocolConsoleSnapshot();
  const consoleState = useMemo(() => buildCanonicalConsoleStateFromSnapshot(snapshot), [snapshot]);

  /* ── Selection state ── */

  const requestedTab = firstSearchParamValue(searchParams.tab);
  const activeTab = (CAPITAL_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("capital", effectivePersona)) as CapitalTabId;

  const allPools = snapshot.liquidityPools;
  const queryPool = firstSearchParamValue(searchParams.pool)?.trim() ?? "";
  const matchedPool = useMemo(() => allPools.find((pool) => pool.address === queryPool) ?? null, [allPools, queryPool]);
  const hasInvalidPool = Boolean(queryPool) && !matchedPool;
  const selectedPool = useMemo(() => {
    if (hasInvalidPool) return null;
    return matchedPool ?? allPools[0] ?? null;
  }, [allPools, hasInvalidPool, matchedPool]);

  const poolClasses = useMemo(
    () =>
      snapshot.capitalClasses.filter(
        (capitalClass) => capitalClass.liquidityPool === selectedPool?.address,
      ),
    [selectedPool, snapshot.capitalClasses],
  );

  const queryClass = firstSearchParamValue(searchParams.class)?.trim() ?? "";
  const matchedClass = useMemo(
    () => poolClasses.find((capitalClass) => capitalClass.address === queryClass) ?? null,
    [poolClasses, queryClass],
  );
  const hasInvalidClass = Boolean(queryClass) && !matchedClass;
  const selectedClass = useMemo(() => {
    if (hasInvalidClass) return null;
    return matchedClass ?? poolClasses[0] ?? null;
  }, [hasInvalidClass, matchedClass, poolClasses]);

  /* ── Derived data ── */

  const capitalView = useMemo(
    () => consoleState.capital.find((entry) => entry.liquidityPoolAddress === selectedPool?.address) ?? null,
    [consoleState.capital, selectedPool],
  );
  const poolAllocations = useMemo(
    () =>
      snapshot.allocationPositions.filter(
        (allocation) => allocation.liquidityPool === selectedPool?.address,
      ),
    [selectedPool, snapshot.allocationPositions],
  );
  const queueRows = useMemo(() => {
    const classAddresses = new Set(poolClasses.map((capitalClass) => capitalClass.address));
    return snapshot.lpPositions.filter(
      (position) => classAddresses.has(position.capitalClass) && hasPendingRedemptionQueue(position),
    );
  }, [poolClasses, snapshot.lpPositions]);
  const linkedPlanContext = useMemo(() => {
    const planAddresses = [...new Set(poolAllocations.map((allocation) => allocation.healthPlan).filter(Boolean))];
    const seriesAddresses = [...new Set(
      poolAllocations
        .map((allocation) => allocation.policySeries)
        .filter((seriesAddress): seriesAddress is string => Boolean(seriesAddress)),
    )];
    return {
      plan: planAddresses.length === 1 ? (planAddresses[0] ?? null) : null,
      series: seriesAddresses.length === 1 ? (seriesAddresses[0] ?? null) : null,
    };
  }, [poolAllocations]);
  const linkedPlans = useMemo(() => {
    const ids = new Set(poolAllocations.map((allocation) => allocation.healthPlan));
    return snapshot.healthPlans.filter((plan) => ids.has(plan.address));
  }, [poolAllocations, snapshot.healthPlans]);
  const planByAddress = useMemo(
    () => new Map(snapshot.healthPlans.map((plan) => [plan.address, plan])),
    [snapshot.healthPlans],
  );
  const seriesByAddress = useMemo(
    () => new Map(snapshot.policySeries.map((series) => [series.address, series])),
    [snapshot.policySeries],
  );
  const classByAddress = useMemo(
    () => new Map(snapshot.capitalClasses.map((capitalClass) => [capitalClass.address, capitalClass])),
    [snapshot.capitalClasses],
  );
  const auditTrail = useMemo(
    () => buildAuditTrail({
      section: "capital",
      poolAddress: selectedPool?.address,
      classAddress: selectedClass?.address,
    }),
    [selectedClass, selectedPool],
  );

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
    if (hasInvalidPool || hasInvalidClass) return;
    const nextUpdates: Record<string, string> = {};
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedPool && queryPool !== selectedPool.address) nextUpdates.pool = selectedPool.address;
    if (selectedClass && queryClass !== selectedClass.address) nextUpdates.class = selectedClass.address;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [
    activeTab,
    hasInvalidClass,
    hasInvalidPool,
    queryClass,
    queryPool,
    requestedTab,
    selectedClass,
    selectedPool,
    updateParams,
  ]);

  /* ── Derived stats ── */

  const tvl = Number(selectedPool?.totalValueLocked ?? 0);
  const allocated = Number(selectedPool?.totalAllocated ?? 0);
  const pending = Number(selectedPool?.totalPendingRedemptions ?? 0);
  const utilization = tvl > 0 ? Math.round((allocated / tvl) * 100) : 0;
  const totalNav = Number(capitalView?.totalNav ?? 0);
  const unallocated = Number(capitalView?.totalUnallocated ?? Math.max(0, tvl - allocated));

  // Per-class breakdown bars (overview)
  const classBars = useMemo(() => {
    if (poolClasses.length === 0) return [] as Array<{ id: string; name: string; nav: number; allocated: number; ratio: number; pending: number }>;
    const maxNav = poolClasses.reduce((max, c) => Math.max(max, Number(c.navAssets)), 0) || 1;
    return poolClasses.map((capitalClass) => ({
      id: capitalClass.address,
      name: capitalClass.classId,
      nav: Number(capitalClass.navAssets),
      allocated: Number(capitalClass.allocatedAssets),
      pending: Number(capitalClass.pendingRedemptions),
      ratio: Number(capitalClass.navAssets) / maxNav,
    }));
  }, [poolClasses]);

  const hero = TAB_HEROES[activeTab];
  const eyebrow = activeTab === "overview" ? personaEyebrow(effectivePersona) : hero.eyebrow;

  /* ── Operator drawer ── */

  const canOperate = OPERATOR_PERSONAS.has(effectivePersona);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [operatorSection, setOperatorSection] = useState<CapitalOperatorSection>("provision");

  const openOperator = useCallback((section: CapitalOperatorSection) => {
    setOperatorSection(section);
    setOperatorOpen(true);
  }, []);

  const sectionForTab: Record<CapitalTabId, CapitalOperatorSection> = {
    overview: "provision",
    classes: "controls",
    allocations: "allocate",
    queue: "queue",
    "linked-plans": "allocate",
  };

  /* ── Invalid selection guard ── */

  const invalidSelection = hasInvalidPool
    ? {
        title: "Pool not found",
        copy: "The requested liquidity pool is not present in the current live protocol state. Choose another pool to continue.",
      }
    : hasInvalidClass
      ? {
          title: "Capital class not found",
          copy: "The requested capital class is not linked to the selected pool. Choose another class or clear the class filter.",
        }
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
              ) : linkedPlanContext.plan ? (
                <Link
                  href={buildPlansWorkbenchHref({
                    plan: linkedPlanContext.plan,
                    series: linkedPlanContext.series,
                    tab: "treasury",
                  })}
                  className="plans-hero-cta"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">north_east</span>
                  Open plan treasury
                </Link>
              ) : (
                <button
                  type="button"
                  className="plans-hero-cta"
                  onClick={() => updateParams({ tab: "queue" })}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">stacks</span>
                  Review queue
                </button>
              )}
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
                    {loading ? <>Syncing <em>capital</em></> : <>RPC <em>attention</em></>}
                  </h2>
                </div>
              </div>
              <p className="plans-card-body">
                {loading
                  ? "Loading live pool, class, allocation, and LP-position state from the configured RPC endpoint."
                  : error}
              </p>
            </article>
          </div>
        ) : null}

        {/* ── Context bar ────────────────────── */}
        <div className="plans-context-bar">
          <div className="plans-context-selectors liquid-glass">
            <HeroSelector
              eyebrow="LIQUIDITY_POOL"
              label="Liquidity pool"
              value={selectedPool}
              options={allPools}
              renderLabel={(pool) => pool.displayName}
              renderMeta={(pool) => `${pool.poolId} · ${describeRedemptionPolicyInline(pool.redemptionPolicy === 1)}`}
              placeholder="Choose pool"
              onChange={(value) => updateParams({ pool: value, class: null })}
            />
            <span className="plans-context-divider" aria-hidden="true" />
            <HeroSelector
              eyebrow="CAPITAL_CLASS"
              label="Capital class"
              value={selectedClass}
              options={poolClasses}
              renderLabel={(capitalClass) => capitalClass.displayName}
              renderMeta={(capitalClass) =>
                `${capitalClass.classId} · ${humanizeCapitalRestriction(capitalClass.restrictionMode)}`
              }
              placeholder={poolClasses.length > 0 ? "All classes" : "No classes"}
              disabled={!selectedPool || poolClasses.length === 0}
              onChange={(value) => updateParams({ class: value || null })}
            />
          </div>
        </div>

        {/* ── Tab bar ───────────────────────── */}
        <nav className="plans-tabs liquid-glass" aria-label="Capital workspace sections">
          <div className="plans-tabs-inner">
            {CAPITAL_TABS.map((tab) => {
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

        {/* ── Body ──────────────────────────── */}
        {invalidSelection ? (
          <CapitalEmptyState title={invalidSelection.title} copy={invalidSelection.copy} />
        ) : (
          <div className="plans-body">
            <section className="plans-main">
              {/* ── OVERVIEW ── */}
              {activeTab === "overview" ? (
                <div className="plans-stack">
                  <article className="plans-card plans-vitality heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">POOL_VITALITY_INDEX</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {selectedPool?.displayName ?? "Awaiting pool"}
                        </h2>
                      </div>
                      <span className="plans-card-meta">
                        <span className="plans-live-dot" aria-hidden="true" />
                        {selectedPool?.poolId ?? "—"}
                      </span>
                    </div>

                    <div className="plans-vitality-stats">
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value">
                          ${formatAmount(tvl)}
                        </span>
                        <span className="plans-vitality-stat-label">Total value locked</span>
                      </div>
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value">
                          {utilization}<span className="plans-unit">%</span>
                        </span>
                        <span className="plans-vitality-stat-label">Capital deployed</span>
                      </div>
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value">{poolClasses.length}</span>
                        <span className="plans-vitality-stat-label">Active classes</span>
                      </div>
                      <div className="plans-vitality-stat">
                        <span className="plans-vitality-stat-value plans-vitality-stat-value-accent">
                          {queueRows.length}
                        </span>
                        <span className="plans-vitality-stat-label">In redemption queue</span>
                      </div>
                    </div>

                    {classBars.length > 0 ? (
                      <div className="plans-vitality-chart" aria-label="NAV by capital class">
                        <div className="plans-vitality-chart-head">
                          <span className="plans-chart-label">NAV_BY_CLASS</span>
                          <span className="plans-chart-legend">NAV · Allocated</span>
                        </div>
                        <div className="plans-vitality-bars">
                          {classBars.map((bar) => (
                            <div key={bar.id} className="plans-vitality-bar">
                              <div className="plans-vitality-bar-head">
                                <span className="plans-vitality-bar-name">{bar.name}</span>
                                <span className="plans-vitality-bar-val">${formatAmount(bar.nav)}</span>
                              </div>
                              <div className="plans-vitality-bar-track">
                                <div
                                  className="plans-vitality-bar-fill"
                                  style={{ width: `${Math.max(4, bar.ratio * 100)}%` }}
                                />
                              </div>
                              <span className="plans-vitality-bar-claims">
                                ${formatAmount(bar.allocated)} allocated · ${formatAmount(bar.pending)} pending
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>

                  <article className="plans-card plans-lanes heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">CAPITAL_CLASSES</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {poolClasses.length} active <em>{poolClasses.length === 1 ? "class" : "classes"}</em>
                        </h2>
                      </div>
                      <span className="plans-card-meta">{selectedPool?.poolId}</span>
                    </div>
                    {poolClasses.length > 0 ? (
                      <div className="plans-lane-stack">
                        {poolClasses.map((capitalClass) => {
                          const isSelected = selectedClass?.address === capitalClass.address;
                          const lockup = capitalClass.minLockupSeconds
                            ? `${Math.round(capitalClass.minLockupSeconds / 86400)}d lockup`
                            : "no lockup";
                          return (
                            <button
                              type="button"
                              key={capitalClass.address}
                              className={cn("plans-lane", isSelected && "plans-lane-active")}
                              onClick={() =>
                                updateParams({
                                  class: isSelected ? null : capitalClass.address,
                                })
                              }
                            >
                              <div className="plans-lane-info">
                                <span className="plans-lane-name">{capitalClass.displayName}</span>
                                <span className="plans-lane-key">
                                  {capitalClass.classId} · priority {capitalClass.priority} · {lockup}
                                </span>
                              </div>
                              <div className="plans-lane-meta">
                                <span className="plans-lane-mode">
                                  {humanizeCapitalRestriction(capitalClass.restrictionMode)}
                                </span>
                                <span className="plans-lane-outcomes">
                                  ${formatAmount(capitalClass.navAssets)} NAV
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="plans-card-body">
                        No capital classes are currently linked to this pool.
                      </p>
                    )}
                  </article>
                </div>
              ) : null}

              {/* ── CLASSES ── */}
              {activeTab === "classes" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">TRANCHE_REGISTER</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Capital <em>classes</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">{poolClasses.length} tracked</span>
                  </div>

                  {poolClasses.length > 0 ? (
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Class</th>
                            <th>Restriction</th>
                            <th>NAV</th>
                            <th>Pending</th>
                            <th>Lockup</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poolClasses.map((capitalClass) => {
                            const isActive = selectedClass?.address === capitalClass.address;
                            return (
                              <tr
                                key={capitalClass.address}
                                className={cn(isActive && "plans-table-row-active")}
                              >
                                <td data-label="Class">
                                  <button
                                    type="button"
                                    className="plans-table-link"
                                    onClick={() => updateParams({ class: capitalClass.address })}
                                  >
                                    {capitalClass.displayName}
                                  </button>
                                </td>
                                <td data-label="Restriction">
                                  {humanizeCapitalRestriction(capitalClass.restrictionMode)}
                                </td>
                                <td data-label="NAV">
                                  <span className="plans-table-amount">
                                    ${formatAmount(capitalClass.navAssets)}
                                  </span>
                                </td>
                                <td data-label="Pending">
                                  <span className="plans-table-amount">
                                    ${formatAmount(capitalClass.pendingRedemptions)}
                                  </span>
                                </td>
                                <td data-label="Lockup">
                                  <span className="plans-table-mono">
                                    {capitalClass.minLockupSeconds
                                      ? `${Math.round(capitalClass.minLockupSeconds / 86400)}d`
                                      : "—"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <CapitalEmptyState
                      title="No capital classes"
                      copy="Choose another pool or provision a class before continuing."
                    />
                  )}
                </article>
              ) : null}

              {/* ── ALLOCATIONS ── */}
              {activeTab === "allocations" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">ALLOCATION_LANES</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Deployed <em>capacity</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">{poolAllocations.length} tracked</span>
                  </div>

                  {poolAllocations.length > 0 ? (
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Plan</th>
                            <th>Series</th>
                            <th>Class</th>
                            <th>Allocated</th>
                            <th>Reserved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poolAllocations.map((allocation) => {
                            const plan = planByAddress.get(allocation.healthPlan);
                            const series = allocation.policySeries ? seriesByAddress.get(allocation.policySeries) : null;
                            const capitalClass = classByAddress.get(allocation.capitalClass);
                            return (
                              <tr key={allocation.address}>
                                <td data-label="Plan">
                                  {plan ? (
                                    <Link
                                      href={buildPlansWorkbenchHref({
                                        plan: plan.address,
                                        tab: "overview",
                                      })}
                                      className="plans-table-link"
                                    >
                                      {plan.displayName}
                                    </Link>
                                  ) : (
                                    <span className="plans-table-mono">
                                      {shortenAddress(allocation.healthPlan, 6)}
                                    </span>
                                  )}
                                </td>
                                <td data-label="Series">
                                  <span className="plans-table-mono">
                                    {series?.seriesId ?? "Pool-wide"}
                                  </span>
                                </td>
                                <td data-label="Class">
                                  <span className="plans-table-mono">
                                    {capitalClass?.classId ?? shortenAddress(allocation.capitalClass, 6)}
                                  </span>
                                </td>
                                <td data-label="Allocated">
                                  <span className="plans-table-amount">
                                    ${formatAmount(allocation.allocatedAmount)}
                                  </span>
                                </td>
                                <td data-label="Reserved">
                                  <span className="plans-table-amount">
                                    ${formatAmount(allocation.reservedCapacity)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <CapitalEmptyState
                      title="No allocations"
                      copy="This pool has no live allocations into health plan funding lines."
                    />
                  )}
                </article>
              ) : null}

              {/* ── QUEUE ── */}
              {activeTab === "queue" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">REDEMPTION_REGISTER</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Pending <em>redemptions</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">
                      <span className="plans-live-dot" aria-hidden="true" />
                      {queueRows.length} {queueRows.length === 1 ? "lane" : "lanes"}
                    </span>
                  </div>

                  {queueRows.length > 0 ? (
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Owner</th>
                            <th>Class</th>
                            <th>Shares</th>
                            <th>Pending</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queueRows.map((position) => {
                            const capitalClass = classByAddress.get(position.capitalClass);
                            return (
                              <tr key={position.address}>
                                <td data-label="Owner">
                                  <span className="plans-table-mono">
                                    {shortenAddress(position.owner, 6)}
                                  </span>
                                </td>
                                <td data-label="Class">
                                  <span className="plans-table-mono">
                                    {capitalClass?.classId ?? shortenAddress(position.capitalClass, 6)}
                                  </span>
                                </td>
                                <td data-label="Shares">
                                  <span className="plans-table-amount">
                                    {formatAmount(position.shares)}
                                  </span>
                                </td>
                                <td data-label="Pending">
                                  <span className="plans-table-amount">
                                    {formatAmount(position.pendingRedemptionShares)}
                                  </span>
                                </td>
                                <td data-label="Status">
                                  <span className="plans-badge plans-badge-info">
                                    {describeLpQueueStatus(position)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <CapitalEmptyState
                      title="Queue is clear"
                      copy="No LP positions currently need redemption queue review for this pool."
                    />
                  )}
                </article>
              ) : null}

              {/* ── LINKED PLANS ── */}
              {activeTab === "linked-plans" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">FUNDED_PLANS</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Linked <em>plans</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">{linkedPlans.length} tracked</span>
                  </div>

                  {linkedPlans.length > 0 ? (
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Plan</th>
                            <th>Plan id</th>
                            <th>Series lanes</th>
                            <th>Open</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkedPlans.map((plan) => {
                            const seriesCount = snapshot.policySeries.filter(
                              (series) => series.healthPlan === plan.address,
                            ).length;
                            return (
                              <tr key={plan.address}>
                                <td data-label="Plan">{plan.displayName}</td>
                                <td data-label="Plan id">
                                  <span className="plans-table-mono">{plan.planId}</span>
                                </td>
                                <td data-label="Series lanes">
                                  <span className="plans-table-mono">{seriesCount}</span>
                                </td>
                                <td data-label="Open">
                                  <Link
                                    href={buildPlansWorkbenchHref({
                                      plan: plan.address,
                                      tab: "overview",
                                    })}
                                    className="plans-table-link"
                                  >
                                    Open plan →
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <CapitalEmptyState
                      title="No linked plans"
                      copy="This pool does not currently fund any plan lanes."
                    />
                  )}
                </article>
              ) : null}
            </section>

            {/* ── Rail ───────────────────────── */}
            <aside className="plans-rail">
              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">POOL_HEALTH</span>
                  <span className="plans-rail-subtag">
                    <span className="plans-live-dot" aria-hidden="true" />
                    LIVE
                  </span>
                </div>
                <div className="plans-rail-hero">
                  <span className="plans-rail-hero-val">${formatAmount(totalNav || tvl)}</span>
                  <span className="plans-rail-hero-sub">
                    Total NAV · ${formatAmount(unallocated)} unallocated
                  </span>
                </div>
                <div className="plans-rail-bar">
                  <div
                    className="plans-rail-bar-fill"
                    style={{ width: `${Math.min(100, utilization)}%` }}
                  />
                </div>
                <div className="plans-rail-row">
                  <span>Deployed</span>
                  <strong>{utilization}%</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Total allocated</span>
                  <strong>${formatAmount(allocated)}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Pending redemption</span>
                  <strong>${formatAmount(pending)}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Redemption policy</span>
                  <strong>
                    {describeRedemptionPolicyInline(selectedClass?.queueOnlyRedemptions)}
                  </strong>
                </div>
              </section>

              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">SELECTED_CLASS</span>
                  <span className="plans-rail-subtag">{selectedClass?.classId ?? "—"}</span>
                </div>
                {selectedClass ? (
                  <>
                    <div className="plans-rail-hero">
                      <span className="plans-rail-hero-val">
                        ${formatAmount(selectedClass.navAssets)}
                      </span>
                      <span className="plans-rail-hero-sub">{selectedClass.displayName}</span>
                    </div>
                    <div className="plans-rail-row">
                      <span>Restriction</span>
                      <strong>{humanizeCapitalRestriction(selectedClass.restrictionMode)}</strong>
                    </div>
                    <div className="plans-rail-row">
                      <span>Allocated</span>
                      <strong>${formatAmount(selectedClass.allocatedAssets)}</strong>
                    </div>
                    <div className="plans-rail-row">
                      <span>Pending</span>
                      <strong>${formatAmount(selectedClass.pendingRedemptions)}</strong>
                    </div>
                    <div className="plans-rail-row">
                      <span>Lockup</span>
                      <strong>
                        {selectedClass.minLockupSeconds
                          ? `${Math.round(selectedClass.minLockupSeconds / 86400)}d`
                          : "none"}
                      </strong>
                    </div>
                  </>
                ) : (
                  <p className="plans-rail-hero-sub">
                    Select a capital class to inspect tranche posture.
                  </p>
                )}
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

      {canOperate ? (
        <CapitalOperatorDrawer
          open={operatorOpen}
          initialSection={operatorSection}
          onOpenChange={setOperatorOpen}
          onRefresh={refresh}
          reserveDomains={snapshot.reserveDomains}
          selectedPool={selectedPool}
          selectedClass={selectedClass}
          lpPositions={snapshot.lpPositions.filter((position) =>
            poolClasses.some((capitalClass) => capitalClass.address === position.capitalClass),
          )}
          allocations={poolAllocations}
          plans={snapshot.healthPlans}
          fundingLines={snapshot.fundingLines}
        />
      ) : null}
    </div>
  );
}
