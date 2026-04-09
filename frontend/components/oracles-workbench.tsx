// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useWorkspacePersona } from "@/components/workspace-persona";
import { claimCasesForOracleContext, formatAmount, seriesForPool } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE, devnetFixtureWalletKey } from "@/lib/devnet-fixtures";
import { firstSearchParamValue, type RouteSearchParams, toURLSearchParams } from "@/lib/search-params";
import { buildAuditTrail, defaultTabForPersona, ORACLE_TABS, type OracleTabId } from "@/lib/workbench";
import {
  describeClaimStatus,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  isObligationOnDisputeWatch,
  shortenAddress,
  toBigIntAmount,
} from "@/lib/protocol";
import { cn } from "@/lib/cn";

/* ── Constants ──────────────────────────────────────── */

const TAB_ICONS: Record<OracleTabId, string> = {
  registry: "groups",
  bindings: "link",
  attestations: "verified",
  disputes: "gavel",
  staking: "shield",
};

const TAB_NUMBERS: Record<OracleTabId, string> = {
  registry: "01",
  bindings: "02",
  attestations: "03",
  disputes: "04",
  staking: "05",
};

const TAB_LABELS: Record<OracleTabId, string> = {
  registry: "Operators",
  bindings: "Bindings",
  attestations: "Attestations",
  disputes: "Disputes",
  staking: "Posture",
};

/* ── Helpers ────────────────────────────────────────── */

function statusVariant(described: string): "success" | "warning" | "danger" | "info" | "muted" {
  const l = described.toLowerCase();
  if (l.includes("active") || l.includes("approved") || l.includes("open") || l.includes("verified")) return "success";
  if (l.includes("pending") || l.includes("review") || l.includes("paused") || l.includes("watch")) return "warning";
  if (l.includes("denied") || l.includes("closed") || l.includes("disputed") || l.includes("impaired")) return "danger";
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

function personaHeroCopy(persona: string): { eyebrow: string; subtitle: string } {
  switch (persona) {
    case "sponsor":
      return {
        eyebrow: "PROTOCOL_CONSOLE // SPONSOR_WORKSPACE",
        subtitle: "Track which operators sign your coverage lanes and where the dispute watch is currently elevated.",
      };
    case "capital":
      return {
        eyebrow: "PROTOCOL_CONSOLE // CAPITAL_WORKSPACE",
        subtitle: "Audit oracle bindings, attestation throughput, and reserve obligation integrity across the pool surface.",
      };
    case "governance":
      return {
        eyebrow: "PROTOCOL_CONSOLE // GOVERNANCE_WORKSPACE",
        subtitle: "Operate the attestation mesh — adjudicate disputes, review feeds, and approve operator posture changes.",
      };
    default:
      return {
        eyebrow: "PROTOCOL_CONSOLE // OBSERVER_WORKSPACE",
        subtitle: "Operator coverage, attestation feeds, and dispute watch across the protocol's reserve obligation mesh.",
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

type OraclesWorkbenchProps = {
  searchParams?: RouteSearchParams;
};

export function OraclesWorkbench({ searchParams = {} }: OraclesWorkbenchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { effectivePersona } = useWorkspacePersona();

  /* ── Selection state ── */

  const requestedTab = firstSearchParamValue(searchParams.tab);
  const activeTab = (ORACLE_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("oracles", effectivePersona)) as OracleTabId;

  const allPools = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools;
  const queryPool = firstSearchParamValue(searchParams.pool)?.trim() ?? "";
  const matchedPool = useMemo(() => allPools.find((pool) => pool.address === queryPool) ?? null, [allPools, queryPool]);
  const hasInvalidPool = Boolean(queryPool) && !matchedPool;
  const selectedPool = useMemo(() => {
    if (hasInvalidPool) return null;
    return matchedPool ?? allPools[0] ?? null;
  }, [allPools, hasInvalidPool, matchedPool]);

  const boundSeries = useMemo(() => (selectedPool ? seriesForPool(selectedPool.address) : []), [selectedPool]);
  const querySeries = firstSearchParamValue(searchParams.series)?.trim() ?? "";
  const matchedSeries = useMemo(
    () => boundSeries.find((series) => series.address === querySeries) ?? null,
    [boundSeries, querySeries],
  );
  const hasInvalidSeries = Boolean(querySeries) && !matchedSeries;
  const selectedSeries = useMemo(() => {
    if (hasInvalidSeries) return null;
    return matchedSeries ?? boundSeries[0] ?? null;
  }, [boundSeries, hasInvalidSeries, matchedSeries]);

  /* ── Derived data ── */

  const operatorWallets = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.wallets.filter(
      (wallet) => wallet.role === "oracle_operator" || wallet.role === "claims_operator",
    ),
    [],
  );

  const scopedClaimCases = useMemo(
    () => (selectedPool ? claimCasesForOracleContext(selectedPool.address, selectedSeries?.address) : []),
    [selectedPool, selectedSeries],
  );

  type OracleAttestation = {
    id: string;
    series: string;
    operator: string;
    status: string;
    reference: string;
  };

  const attestations = useMemo<OracleAttestation[]>(() => {
    return scopedClaimCases.map((claim, index) => {
      const series = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((entry) => entry.address === claim.policySeries);
      const operator = operatorWallets[index % operatorWallets.length];
      return {
        id: claim.address,
        series: series?.displayName ?? claim.claimId,
        operator: operator?.label ?? "Oracle operator",
        status: describeClaimStatus(claim.intakeStatus),
        reference: claim.claimId,
      };
    });
  }, [operatorWallets, scopedClaimCases]);

  const attestationScopeLabel = selectedSeries?.displayName ?? selectedPool?.displayName ?? "the selected context";

  const scopedObligations = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) =>
      selectedSeries
        ? obligation.policySeries === selectedSeries.address
        : obligation.liquidityPool === selectedPool?.address,
    ),
    [selectedPool, selectedSeries],
  );
  const disputes = useMemo(() => scopedObligations.filter(isObligationOnDisputeWatch), [scopedObligations]);

  const auditTrail = useMemo(
    () => buildAuditTrail({
      section: "oracles",
      poolAddress: selectedPool?.address,
      seriesAddress: selectedSeries?.address,
    }),
    [selectedPool, selectedSeries],
  );

  /* ── Mesh integrity stats ── */

  const oracleOperators = useMemo(
    () => operatorWallets.filter((wallet) => wallet.role === "oracle_operator"),
    [operatorWallets],
  );
  const claimsOperators = useMemo(
    () => operatorWallets.filter((wallet) => wallet.role === "claims_operator"),
    [operatorWallets],
  );

  const disputeRatio = scopedObligations.length > 0
    ? Math.round((disputes.length / scopedObligations.length) * 100)
    : 0;
  const meshHealthLabel = disputeRatio === 0
    ? "NOMINAL"
    : disputeRatio < 25
      ? "WATCH"
      : "ELEVATED";
  const meshHealthVariant: "success" | "warning" | "danger" = disputeRatio === 0
    ? "success"
    : disputeRatio < 25
      ? "warning"
      : "danger";

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
    if (hasInvalidPool || hasInvalidSeries) return;
    const nextUpdates: Record<string, string> = {};
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedPool && queryPool !== selectedPool.address) nextUpdates.pool = selectedPool.address;
    if (selectedSeries && querySeries !== selectedSeries.address) nextUpdates.series = selectedSeries.address;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, hasInvalidPool, hasInvalidSeries, queryPool, querySeries, requestedTab, selectedPool, selectedSeries, updateParams]);

  /* ── Scroll active tab into view ── */

  const tabBarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const activeButton = bar.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`);
    if (activeButton) activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const { eyebrow: heroEyebrow, subtitle: heroSubtitle } = personaHeroCopy(effectivePersona);

  /* ── Invalid selection guard ── */

  const invalidSelection = hasInvalidPool
    ? { title: "Pool not found", copy: "The requested pool context is not present in the current fixture set. Choose another pool to continue." }
    : hasInvalidSeries
      ? { title: "Series not found", copy: "The requested policy series is not bound to the selected pool. Choose another series or clear the series filter." }
      : null;

  /* ── Render ── */

  return (
    <div className="plans-shell">
      <div className="plans-scroll">

        {/* ── Hero ──────────────────────────── */}
        <header className="plans-hero">
          <div className="plans-hero-glow" aria-hidden="true" />
          <div className="plans-hero-copy">
            <span className="plans-hero-eyebrow">{heroEyebrow}</span>
            <h1 className="plans-hero-title">
              Attestation <em>Mesh</em>
            </h1>
            <p className="plans-hero-subtitle">{heroSubtitle}</p>
          </div>
        </header>

        {/* ── Context bar ────────────────────── */}
        <div className="plans-context-bar">
          <div className="plans-context-selectors liquid-glass">
            <HeroSelector
              eyebrow="POOL_CONTEXT"
              label="Pool context"
              value={selectedPool}
              options={allPools}
              renderLabel={(pool) => pool.displayName}
              renderMeta={(pool) => `${pool.poolId} · ${pool.strategyThesis.split(".")[0]}`}
              placeholder="Choose pool"
              onChange={(value) => updateParams({ pool: value, series: null })}
            />
            <span className="plans-context-divider" aria-hidden="true" />
            <HeroSelector
              eyebrow="POLICY_SERIES"
              label="Policy series"
              value={selectedSeries}
              options={boundSeries}
              renderLabel={(series) => series.displayName}
              renderMeta={(series) => `${series.seriesId} · ${describeSeriesMode(series.mode)}`}
              placeholder={boundSeries.length > 0 ? "All series" : "No bound series"}
              disabled={!selectedPool || boundSeries.length === 0}
              onChange={(value) => updateParams({ series: value })}
            />
          </div>
        </div>

        {/* ── KPI strip ─────────────────────── */}
        <section className="plans-kpi-strip" aria-label="Oracle workspace telemetry">
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">OPERATORS</span>
            <span className="plans-kpi-value">{operatorWallets.length}</span>
            <span className="plans-kpi-meta">{oracleOperators.length} oracle · {claimsOperators.length} claims</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">BOUND_SERIES</span>
            <span className="plans-kpi-value">{boundSeries.length}</span>
            <span className="plans-kpi-meta">linked to {selectedPool?.poolId ?? "—"}</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">ATTESTATIONS_LIVE</span>
            <span className="plans-kpi-value">
              <span className="plans-kpi-pulse" aria-hidden="true" />
              {attestations.length}
            </span>
            <span className="plans-kpi-meta">{scopedClaimCases.length} claim {scopedClaimCases.length === 1 ? "case" : "cases"} in scope</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">DISPUTE_WATCH</span>
            <span className="plans-kpi-value">{disputes.length}</span>
            <span className="plans-kpi-meta">{scopedObligations.length} obligations tracked</span>
          </div>
        </section>

        {/* ── Tab bar ───────────────────────── */}
        <nav className="plans-tabs liquid-glass" aria-label="Oracle workspace sections">
          <div ref={tabBarRef} className="plans-tabs-inner">
            {ORACLE_TABS.map((tab) => {
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
                  <span className="plans-tab-number">{TAB_NUMBERS[tab.id as OracleTabId]}</span>
                  <span className="material-symbols-outlined plans-tab-icon">{TAB_ICONS[tab.id as OracleTabId]}</span>
                  <span className="plans-tab-label">{TAB_LABELS[tab.id as OracleTabId]}</span>
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

              {/* ── Operators / Registry tab ── */}
              {activeTab === "registry" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">OPERATOR_REGISTRY</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Signing <em>operators</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">
                      <span className="plans-live-dot" aria-hidden="true" />
                      {operatorWallets.length} active
                    </span>
                  </div>
                  <p className="plans-card-body">
                    Wallets authorized to sign attestations and claim adjudications across the protocol. Routes are scoped to the selected pool.
                  </p>
                  <div className="plans-table-wrap">
                    <table className="plans-table">
                      <thead>
                        <tr>
                          <th>Operator</th>
                          <th>Role</th>
                          <th>Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operatorWallets.map((wallet) => (
                          <tr key={devnetFixtureWalletKey(wallet)}>
                            <td data-label="Operator">{wallet.label}</td>
                            <td data-label="Role">
                              <StatusBadge label={wallet.role === "oracle_operator" ? "Oracle" : "Claims"} />
                            </td>
                            <td data-label="Address">
                              <span className="plans-table-mono">{shortenAddress(wallet.address, 8)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ) : null}

              {/* ── Bindings tab ── */}
              {activeTab === "bindings" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">SOURCE_BINDINGS</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        {boundSeries.length} bound <em>{boundSeries.length === 1 ? "series" : "series"}</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">{selectedPool?.poolId ?? "—"}</span>
                  </div>
                  {boundSeries.length > 0 ? (
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Series</th>
                            <th>Mode</th>
                            <th>Version</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {boundSeries.map((series) => {
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
                                <td data-label="Mode">{describeSeriesMode(series.mode)}</td>
                                <td data-label="Version">
                                  <span className="plans-table-mono">{series.termsVersion}</span>
                                </td>
                                <td data-label="Status">
                                  <StatusBadge label={describeSeriesStatus(series.status)} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <PlansEmptyState
                      title="No oracle bindings"
                      copy="This pool does not currently bind any policy series."
                    />
                  )}
                </article>
              ) : null}

              {/* ── Attestations tab ── */}
              {activeTab === "attestations" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">ATTESTATION_FEED</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Live <em>signals</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">
                      <span className="plans-live-dot" aria-hidden="true" />
                      {attestations.length} live
                    </span>
                  </div>
                  {attestations.length > 0 ? (
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Series</th>
                            <th>Operator</th>
                            <th>Reference</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attestations.map((attestation) => (
                            <tr key={attestation.id}>
                              <td data-label="Series">{attestation.series}</td>
                              <td data-label="Operator">{attestation.operator}</td>
                              <td data-label="Reference">
                                <span className="plans-table-mono">{attestation.reference}</span>
                              </td>
                              <td data-label="Status"><StatusBadge label={attestation.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <PlansEmptyState
                      title="No live attestations"
                      copy={`No claim attestations are currently scoped to ${attestationScopeLabel}.`}
                    />
                  )}
                </article>
              ) : null}

              {/* ── Disputes tab ── */}
              {activeTab === "disputes" ? (
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">DISPUTE_WATCH</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Escalated <em>obligations</em>
                      </h2>
                    </div>
                    <span className={cn("plans-card-meta", disputes.length > 0 && "plans-card-meta-warn")}>
                      {disputes.length} {disputes.length === 1 ? "case" : "cases"}
                    </span>
                  </div>
                  {disputes.length > 0 ? (
                    <div className="plans-table-wrap">
                      <table className="plans-table">
                        <thead>
                          <tr>
                            <th>Obligation</th>
                            <th>Series</th>
                            <th>Status</th>
                            <th>Watch amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {disputes.map((obligation) => {
                            const series = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((entry) => entry.address === obligation.policySeries);
                            const watch = toBigIntAmount(obligation.reservedAmount)
                              + toBigIntAmount(obligation.payableAmount)
                              + toBigIntAmount(obligation.impairedAmount);
                            return (
                              <tr key={obligation.address}>
                                <td data-label="Obligation">
                                  <span className="plans-table-mono">{obligation.obligationId}</span>
                                </td>
                                <td data-label="Series">{series?.displayName ?? "Pool-wide"}</td>
                                <td data-label="Status">
                                  <StatusBadge label={describeObligationStatus(obligation.status)} />
                                </td>
                                <td data-label="Watch amount">
                                  <span className="plans-table-amount">{formatAmount(watch)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <PlansEmptyState
                      title="No active disputes"
                      copy="No bound obligations currently need dispute or settlement escalation."
                    />
                  )}
                </article>
              ) : null}

              {/* ── Posture / Staking tab ── */}
              {activeTab === "staking" ? (
                <div className="plans-stack">
                  <article className="plans-card heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">ACCESS_POSTURE</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          Operator <em>authority</em>
                        </h2>
                      </div>
                      <span className="plans-card-meta">{selectedPool?.poolId ?? "—"}</span>
                    </div>
                    <div className="plans-data-grid">
                      <div className="plans-data-row">
                        <span className="plans-data-label">Oracle_Operators</span>
                        <strong className="plans-data-value">{oracleOperators.length}</strong>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Claims_Operators</span>
                        <strong className="plans-data-value">{claimsOperators.length}</strong>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Scope</span>
                        <span className="plans-data-value">Attestation &amp; finality</span>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Treasury_Access</span>
                        <span className="plans-data-value">None</span>
                      </div>
                    </div>
                  </article>

                  <article className="plans-card heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">COVERAGE_SURFACE</p>
                        <h2 className="plans-card-title">Mesh reach</h2>
                      </div>
                    </div>
                    <div className="plans-data-grid">
                      <div className="plans-data-row">
                        <span className="plans-data-label">Bound_Series</span>
                        <strong className="plans-data-value">{boundSeries.length}</strong>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Visible_Pools</span>
                        <strong className="plans-data-value">{allPools.length}</strong>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Live_Attestations</span>
                        <strong className="plans-data-value">{attestations.length}</strong>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Active_Disputes</span>
                        <strong className="plans-data-value">{disputes.length}</strong>
                      </div>
                    </div>
                  </article>
                </div>
              ) : null}
            </section>

            {/* ── Rail ───────────────────────── */}
            <aside className="plans-rail">

              {/* Mesh integrity gauge */}
              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">MESH_INTEGRITY</span>
                  <span className={cn("plans-badge", `plans-badge-${meshHealthVariant}`)}>
                    {meshHealthLabel}
                  </span>
                </div>
                <div className="plans-rail-hero">
                  <span className="plans-rail-hero-val">{disputeRatio}%</span>
                  <span className="plans-rail-hero-sub">
                    of obligations on dispute watch
                  </span>
                </div>
                <div className="plans-rail-bar">
                  <div
                    className="plans-rail-bar-fill"
                    style={{ width: `${Math.max(2, Math.min(100, disputeRatio))}%` }}
                  />
                </div>
                <div className="plans-rail-row">
                  <span>Operators</span>
                  <strong>{operatorWallets.length}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Bound series</span>
                  <strong>{boundSeries.length}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Live attestations</span>
                  <strong>{attestations.length}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Dispute watch</span>
                  <strong>{disputes.length}</strong>
                </div>
              </section>

              {/* Selected binding */}
              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">SELECTED_BINDING</span>
                  <span className="plans-rail-subtag">SERIES</span>
                </div>
                {selectedSeries ? (
                  <>
                    <div className="plans-rail-hero">
                      <span className="plans-rail-hero-val plans-rail-hero-val-sm">
                        {selectedSeries.displayName}
                      </span>
                      <span className="plans-rail-hero-sub">{selectedSeries.comparabilityKey}</span>
                    </div>
                    <div className="plans-rail-row">
                      <span>Mode</span>
                      <strong>{describeSeriesMode(selectedSeries.mode)}</strong>
                    </div>
                    <div className="plans-rail-row">
                      <span>Status</span>
                      <strong>{describeSeriesStatus(selectedSeries.status)}</strong>
                    </div>
                    <div className="plans-rail-row">
                      <span>Terms version</span>
                      <strong>{selectedSeries.termsVersion}</strong>
                    </div>
                    <div className="plans-rail-row">
                      <span>Address</span>
                      <strong>{shortenAddress(selectedSeries.address, 6)}</strong>
                    </div>
                  </>
                ) : (
                  <p className="plans-rail-empty-copy">
                    Choose a bound series to inspect its source posture and on-chain identity.
                  </p>
                )}
              </section>

              {/* Field log */}
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
