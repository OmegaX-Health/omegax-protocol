// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { PoolSchemasPanel } from "@/components/pool-schemas-panel";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { formatAmount, poolAddressForSeries, seriesOutcomeCount } from "@/lib/canonical-ui";
import { cn } from "@/lib/cn";
import { firstSearchParamValue, type RouteSearchParams, toURLSearchParams } from "@/lib/search-params";
import { useProtocolConsoleSnapshot } from "@/lib/use-protocol-console-snapshot";
import {
  describeSeriesMode,
  describeSeriesStatus,
  shortenAddress,
} from "@/lib/protocol";

type SchemaPanelId = "registry" | "inspector";

type SchemaSelectorOption = {
  address: string;
  label: string;
  meta: string;
};

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

type SchemasWorkbenchProps = {
  searchParams?: RouteSearchParams;
};

const SCHEMA_PANELS: Array<{ id: SchemaPanelId; label: string; icon: string; number: string }> = [
  { id: "registry", label: "Registry", icon: "database", number: "01" },
  { id: "inspector", label: "Inspector", icon: "search", number: "02" },
];

function personaHeroCopy(persona: string): { eyebrow: string; subtitle: string } {
  switch (persona) {
    case "sponsor":
      return {
        eyebrow: "PROTOCOL_CONSOLE // SPONSOR_WORKSPACE",
        subtitle: "Inspect the live series comparability and terms versions that govern plan-side claim and reserve behavior.",
      };
    case "capital":
      return {
        eyebrow: "PROTOCOL_CONSOLE // CAPITAL_WORKSPACE",
        subtitle: "Audit the live schema posture behind every series your capital sleeves can be routed into.",
      };
    case "governance":
      return {
        eyebrow: "PROTOCOL_CONSOLE // GOVERNANCE_WORKSPACE",
        subtitle: "Review versioned series schema posture and comparability drift before any governance or oracle control changes land.",
      };
    default:
      return {
        eyebrow: "PROTOCOL_CONSOLE // OBSERVER_WORKSPACE",
        subtitle: "Live series registry, comparability posture, and schema-linked routing context across the protocol shell.",
      };
  }
}

function StatusBadge({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const tone = normalized.includes("active")
    ? "success"
    : normalized.includes("paused")
      ? "warning"
      : normalized.includes("closed")
        ? "danger"
        : "muted";
  return <span className={`plans-badge plans-badge-${tone}`}>{label}</span>;
}

function PlansEmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="plans-empty liquid-glass">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

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

function schemaKeyForSeries(series: { termsVersion: string; comparabilityHashHex?: string; comparabilityKey: string }): string {
  return `${series.termsVersion}:${series.comparabilityHashHex ?? series.comparabilityKey}`;
}

export function SchemasWorkbench({ searchParams = {} }: SchemasWorkbenchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { effectivePersona } = useWorkspacePersona();
  const { snapshot, loading, error } = useProtocolConsoleSnapshot();

  const { eyebrow: heroEyebrow, subtitle: heroSubtitle } = personaHeroCopy(effectivePersona);

  const requestedPanel = firstSearchParamValue(searchParams.panel);
  const activePanel = requestedPanel === "inspector" ? "inspector" : "registry";
  const requestedPool = firstSearchParamValue(searchParams.pool)?.trim() ?? "";
  const requestedSeries = firstSearchParamValue(searchParams.series)?.trim() ?? "";
  const requestedSchema = firstSearchParamValue(searchParams.schema)?.trim() ?? "";

  const seriesRows = useMemo(
    () => (requestedPool
      ? snapshot.policySeries.filter((series) => poolAddressForSeries(series.address, snapshot) === requestedPool)
      : snapshot.policySeries),
    [requestedPool, snapshot],
  );

  const schemaForSeries = useCallback(
    (series: (typeof snapshot.policySeries)[number]) => {
      if (!series.comparabilityHashHex) return null;
      const version = Number.parseInt(series.termsVersion, 10) || 0;
      return snapshot.outcomeSchemas.find((schema) =>
        schema.schemaKeyHashHex === series.comparabilityHashHex
        && schema.version === version,
      ) ?? snapshot.outcomeSchemas.find((schema) => schema.schemaKeyHashHex === series.comparabilityHashHex) ?? null;
    },
    [snapshot.outcomeSchemas],
  );

  const schemaOptions = useMemo<SchemaSelectorOption[]>(() => {
    if (snapshot.outcomeSchemas.length > 0) {
      return snapshot.outcomeSchemas
        .map((schema) => ({
          address: schema.address,
          label: schema.schemaKey,
          meta: `v${schema.version} · ${schema.schemaKeyHashHex.slice(0, 12)}`,
        }))
        .sort((left, right) => left.label.localeCompare(right.label) || left.meta.localeCompare(right.meta));
    }

    const registry = new Map<string, SchemaSelectorOption>();
    for (const series of snapshot.policySeries) {
      const key = schemaKeyForSeries(series);
      if (!registry.has(key)) {
        registry.set(key, {
          address: key,
          label: series.termsVersion,
          meta: series.comparabilityKey,
        });
      }
    }
    return [...registry.values()].sort((left, right) => left.address.localeCompare(right.address));
  }, [snapshot.outcomeSchemas, snapshot.policySeries]);

  const selectedSchema = useMemo(
    () => snapshot.outcomeSchemas.find((schema) =>
      schema.address === requestedSchema
      || `${schema.version}:${schema.schemaKeyHashHex}` === requestedSchema,
    ) ?? null,
    [requestedSchema, snapshot.outcomeSchemas],
  );
  const selectedSeries = useMemo(() => {
    if (requestedSeries) return seriesRows.find((series) => series.address === requestedSeries) ?? null;
    if (selectedSchema) return seriesRows.find((series) => schemaForSeries(series)?.address === selectedSchema.address) ?? null;
    return seriesRows[0] ?? null;
  }, [requestedSeries, schemaForSeries, selectedSchema, seriesRows]);

  const hasInvalidSeries = Boolean(requestedSeries) && !selectedSeries;
  const hasInvalidSchema = Boolean(requestedSchema) && snapshot.outcomeSchemas.length > 0 && !selectedSchema;
  const effectiveSchema = selectedSchema ?? (selectedSeries ? schemaForSeries(selectedSeries) : null);
  const effectiveSchemaKey = effectiveSchema?.address ?? (selectedSeries ? schemaKeyForSeries(selectedSeries) : "");
  const selectedSchemaOption = useMemo<SchemaSelectorOption | null>(() => {
    if (effectiveSchema) {
      return {
        address: effectiveSchema.address,
        label: effectiveSchema.schemaKey,
        meta: `v${effectiveSchema.version} · ${effectiveSchema.schemaKeyHashHex.slice(0, 12)}`,
      };
    }
    return effectiveSchemaKey ? schemaOptions.find((option) => option.address === effectiveSchemaKey) ?? null : null;
  }, [effectiveSchema, effectiveSchemaKey, schemaOptions]);
  const scopedSeries = useMemo(
    () => (effectiveSchema
      ? seriesRows.filter((series) => schemaForSeries(series)?.schemaKeyHashHex === effectiveSchema.schemaKeyHashHex)
      : seriesRows),
    [effectiveSchema, schemaForSeries, seriesRows],
  );

  const linkedPoolAddress = selectedSeries ? poolAddressForSeries(selectedSeries.address, snapshot) : null;
  const linkedPool = linkedPoolAddress
    ? snapshot.liquidityPools.find((pool) => pool.address === linkedPoolAddress) ?? null
    : null;
  const selectedPlan = selectedSeries
    ? snapshot.healthPlans.find((plan) => plan.address === selectedSeries.healthPlan) ?? null
    : null;

  const uniqueSchemaCount = snapshot.outcomeSchemas.length > 0 ? snapshot.outcomeSchemas.length : schemaOptions.length;
  const verifiedSchemaCount = snapshot.outcomeSchemas.filter((schema) => schema.verified).length;
  const uniquePlanCount = new Set(snapshot.policySeries.map((series) => series.healthPlan)).size;
  const uniquePoolCount = new Set(
    snapshot.policySeries
      .map((series) => poolAddressForSeries(series.address, snapshot))
      .filter((address): address is string => Boolean(address)),
  ).size;

  const auditTrail = useMemo(() => {
    return [
      {
        id: "schema-version",
        tone: effectiveSchema?.verified ? "verified" : "signal",
        label: effectiveSchema ? "Schema selected" : "Registry live",
        timestamp: "09:12:14",
        detail: effectiveSchema
          ? `${effectiveSchema.schemaKey} v${effectiveSchema.version} is the active on-chain schema selected for this workspace.`
          : `${seriesRows.length} policy series are currently visible in the live schema registry.`,
      },
      {
        id: "comparability",
        tone: scopedSeries.length > 1 ? "signal" : "verified",
        label: scopedSeries.length > 1 ? "Shared comparability" : "Single binding",
        timestamp: "09:18:06",
        detail: effectiveSchema
          ? `${scopedSeries.length} series currently share ${effectiveSchema.schemaKeyHashHex.slice(0, 12)}.`
          : "Select a schema key to inspect shared comparability across versioned series lanes.",
      },
      {
        id: "routing",
        tone: linkedPool ? "signal" : "pending",
        label: linkedPool ? "Pool bound" : "Pool pending",
        timestamp: "09:24:37",
        detail: linkedPool && selectedSeries
          ? `${selectedSeries.displayName} currently routes through ${linkedPool.displayName}.`
          : "The selected series is not currently linked to a visible liquidity-pool allocation lane.",
      },
    ];
  }, [effectiveSchema, linkedPool, scopedSeries.length, selectedSeries, seriesRows.length]);

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
    if (hasInvalidSeries || hasInvalidSchema) return;
    const nextUpdates: Record<string, string | null> = {};
    if (requestedPanel !== activePanel) nextUpdates.panel = activePanel;
    if (selectedSeries && requestedSeries !== selectedSeries.address) nextUpdates.series = selectedSeries.address;
    if (!selectedSeries && requestedSeries) nextUpdates.series = null;
    if (effectiveSchemaKey && requestedSchema !== effectiveSchemaKey) nextUpdates.schema = effectiveSchemaKey;
    if (!effectiveSchemaKey && requestedSchema) nextUpdates.schema = null;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [
    activePanel,
    effectiveSchemaKey,
    hasInvalidSchema,
    hasInvalidSeries,
    requestedPanel,
    requestedSchema,
    requestedSeries,
    selectedSeries,
    updateParams,
  ]);

  const invalidSelection = hasInvalidSeries
    ? {
      title: "Series not found",
      copy: "The requested policy series is not present in the current live schema registry. Choose another series to continue.",
    }
    : hasInvalidSchema
      ? {
        title: "Schema not found",
        copy: "The requested schema key is not present in the current live registry. Choose another schema version to continue.",
      }
      : null;

  const tabBarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const activeButton = bar.querySelector<HTMLButtonElement>(`[data-tab-id="${activePanel}"]`);
    if (activeButton) activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activePanel]);

  return (
    <div className="plans-shell">
      <div className="plans-scroll">

        <header className="plans-hero">
          <div className="plans-hero-glow" aria-hidden="true" />
          <div className="plans-hero-head">
            <div className="plans-hero-copy">
              <span className="plans-hero-eyebrow">{heroEyebrow}</span>
              <h1 className="plans-hero-title">
                Schema <em>Registry</em>
              </h1>
              <p className="plans-hero-subtitle">{heroSubtitle}</p>
            </div>
            <div className="plans-hero-actions">
              <Link href={selectedSeries ? `/plans?plan=${encodeURIComponent(selectedSeries.healthPlan)}&series=${encodeURIComponent(selectedSeries.address)}` : "/plans"} className="plans-hero-cta">
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                OPEN_PLAN_WORKSPACE
              </Link>
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
                    {loading ? <>Syncing <em>schemas</em></> : <>RPC <em>attention</em></>}
                  </h2>
                </div>
              </div>
              <p className="plans-card-body">
                {loading
                  ? "Loading live policy-series comparability and terms-version posture from the configured RPC endpoint."
                  : error}
              </p>
            </article>
          </div>
        ) : null}

        <div className="plans-context-bar">
          <div className="plans-context-selectors liquid-glass">
            <HeroSelector
              eyebrow="POLICY_SERIES"
              label="Policy series"
              value={selectedSeries}
              options={seriesRows}
              renderLabel={(series) => series.displayName}
              renderMeta={(series) => `${series.seriesId} · ${series.termsVersion}`}
              placeholder="Choose policy series"
              disabled={seriesRows.length === 0}
              onChange={(value) => {
                const nextSeries = seriesRows.find((series) => series.address === value) ?? null;
                updateParams({
                  series: value,
                  schema: nextSeries ? (schemaForSeries(nextSeries)?.address ?? schemaKeyForSeries(nextSeries)) : null,
                });
              }}
            />
            <span className="plans-context-divider" aria-hidden="true" />
            <HeroSelector
              eyebrow="SCHEMA_VERSION"
              label="Schema version"
              value={selectedSchemaOption}
              options={schemaOptions}
              renderLabel={(schema) => schema.label}
              renderMeta={(schema) => schema.meta}
              placeholder="Choose schema"
              disabled={schemaOptions.length === 0}
              onChange={(value) => updateParams({ schema: value, series: null })}
            />
          </div>
        </div>

        <section className="plans-kpi-strip" aria-label="Schema workspace telemetry">
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">SCHEMAS</span>
            <span className="plans-kpi-value">{uniqueSchemaCount}</span>
            <span className="plans-kpi-meta">{verifiedSchemaCount} verified on-chain</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">SERIES</span>
            <span className="plans-kpi-value">{snapshot.policySeries.length}</span>
            <span className="plans-kpi-meta">versioned products</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">PLANS</span>
            <span className="plans-kpi-value">{uniquePlanCount}</span>
            <span className="plans-kpi-meta">live sponsor roots</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">BOUND_POOLS</span>
            <span className="plans-kpi-value">{uniquePoolCount}</span>
            <span className="plans-kpi-meta">allocation-linked sleeves</span>
          </div>
        </section>

        <nav className="plans-tabs liquid-glass" aria-label="Schema workspace sections">
          <div ref={tabBarRef} className="plans-tabs-inner">
            {SCHEMA_PANELS.map((panel) => {
              const isActive = activePanel === panel.id;
              return (
                <button
                  key={panel.id}
                  type="button"
                  data-tab-id={panel.id}
                  className={cn("plans-tab", isActive && "plans-tab-active")}
                  onClick={() => updateParams({ panel: panel.id })}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="plans-tab-number">{panel.number}</span>
                  <span className="material-symbols-outlined plans-tab-icon">{panel.icon}</span>
                  <span className="plans-tab-label">{panel.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {invalidSelection ? (
          <PlansEmptyState title={invalidSelection.title} copy={invalidSelection.copy} />
        ) : (
          <div className="plans-body">
            <section className="plans-main">
              {activePanel === "registry" ? (
                <div className="plans-stack">
                  {linkedPool ? <PoolSchemasPanel poolAddress={linkedPool.address} /> : null}
                  <article className="plans-card heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">LIVE_SCHEMA_REGISTRY</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          Versioned <em>schema lanes</em>
                        </h2>
                      </div>
                      <span className="plans-card-meta">
                        <span className="plans-live-dot" aria-hidden="true" />
                        {snapshot.outcomeSchemas.length > 0 ? snapshot.outcomeSchemas.length : scopedSeries.length} in scope
                      </span>
                    </div>
                    {(snapshot.outcomeSchemas.length > 0 ? snapshot.outcomeSchemas : scopedSeries).length > 0 ? (
                      <div className="plans-table-wrap">
                        <table className="plans-table">
                          <thead>
                            <tr>
                              <th>Schema</th>
                              <th>Version</th>
                              <th>Verification</th>
                              <th>Series</th>
                              <th>Dependencies</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(snapshot.outcomeSchemas.length > 0 ? snapshot.outcomeSchemas : []).map((schema) => {
                              const schemaSeries = scopedSeries.filter((series) => schemaForSeries(series)?.address === schema.address);
                              const dependencyLedger = snapshot.schemaDependencyLedgers.find((ledger) => ledger.schemaKeyHashHex === schema.schemaKeyHashHex);
                              return (
                                <tr key={schema.address} className={cn(effectiveSchema?.address === schema.address && "plans-table-row-active")}>
                                  <td data-label="Schema">
                                    <button
                                      type="button"
                                      className="plans-table-link"
                                      onClick={() => updateParams({ schema: schema.address, panel: "inspector" })}
                                    >
                                      {schema.schemaKey}
                                    </button>
                                  </td>
                                  <td data-label="Version"><span className="plans-table-mono">v{schema.version}</span></td>
                                  <td data-label="Verification"><StatusBadge label={schema.verified ? "Verified" : "Unverified"} /></td>
                                  <td data-label="Series">{schemaSeries.length}</td>
                                  <td data-label="Dependencies">
                                    <span className="plans-table-mono">{dependencyLedger?.poolRuleAddresses.length ?? 0}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            {snapshot.outcomeSchemas.length === 0 ? scopedSeries.map((series) => {
                              const plan = snapshot.healthPlans.find((entry) => entry.address === series.healthPlan);
                              return (
                                <tr key={series.address} className={cn(selectedSeries?.address === series.address && "plans-table-row-active")}>
                                  <td data-label="Schema">{series.displayName}</td>
                                  <td data-label="Version"><span className="plans-table-mono">v{series.termsVersion}</span></td>
                                  <td data-label="Verification"><StatusBadge label="Unregistered" /></td>
                                  <td data-label="Series">{plan?.displayName ?? shortenAddress(series.healthPlan, 6)}</td>
                                  <td data-label="Dependencies"><span className="plans-table-mono">0</span></td>
                                </tr>
                              );
                            }) : null}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <PlansEmptyState
                        title="No series in registry"
                        copy="No live policy series are currently visible in the protocol snapshot."
                      />
                    )}
                  </article>
                </div>
              ) : null}

              {activePanel === "inspector" ? (
                <div className="plans-stack">
                  <article className="plans-card heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">SCHEMA_INSPECTOR</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          {effectiveSchema?.schemaKey ?? selectedSeries?.displayName ?? "Awaiting selection"}
                        </h2>
                      </div>
                      <span className="plans-card-meta">{effectiveSchema ? `v${effectiveSchema.version}` : (selectedSeries?.termsVersion ?? "—")}</span>
                    </div>
                    <div className="plans-data-grid">
                      <div className="plans-data-row">
                        <span className="plans-data-label">Schema_Key</span>
                        <span className="plans-data-value">{(effectiveSchema?.schemaKey ?? effectiveSchemaKey) || "—"}</span>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Schema_Hash</span>
                        <span className="plans-data-value">{effectiveSchema?.schemaHashHex.slice(0, 16) ?? selectedSeries?.comparabilityKey ?? "—"}</span>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Mode</span>
                        <span className="plans-data-value">{selectedSeries ? describeSeriesMode(selectedSeries.mode) : "—"}</span>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Verification</span>
                        <span className="plans-data-value">{effectiveSchema ? (effectiveSchema.verified ? "Verified" : "Unverified") : "—"}</span>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Plan</span>
                        <span className="plans-data-value">{selectedPlan?.displayName ?? "—"}</span>
                      </div>
                      <div className="plans-data-row">
                        <span className="plans-data-label">Bound_Pool</span>
                        <span className="plans-data-value">{linkedPool?.displayName ?? "Unbound"}</span>
                      </div>
                    </div>
                  </article>

                  <article className="plans-card heavy-glass">
                    <div className="plans-card-head">
                      <div>
                        <p className="plans-card-eyebrow">SCHEMA_BINDINGS</p>
                        <h2 className="plans-card-title plans-card-title-display">
                          Shared <em>bindings</em>
                        </h2>
                      </div>
                      <span className="plans-card-meta">{scopedSeries.length} series</span>
                    </div>
                    {scopedSeries.length > 0 ? (
                      <div className="plans-table-wrap">
                        <table className="plans-table">
                          <thead>
                            <tr>
                              <th>Series</th>
                              <th>Address</th>
                              <th>Outcomes</th>
                              <th>Open</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scopedSeries.map((series) => {
                              const poolAddress = poolAddressForSeries(series.address, snapshot);
                              return (
                                <tr key={series.address}>
                                  <td data-label="Series">{series.displayName}</td>
                                  <td data-label="Address"><span className="plans-table-mono">{shortenAddress(series.address, 8)}</span></td>
                                  <td data-label="Outcomes"><span className="plans-table-amount">{formatAmount(seriesOutcomeCount(series.address, snapshot))}</span></td>
                                  <td data-label="Open">
                                    {poolAddress ? (
                                      <Link href={`/oracles?pool=${encodeURIComponent(poolAddress)}&series=${encodeURIComponent(series.address)}&tab=bindings`} className="plans-table-link">
                                        Bindings →
                                      </Link>
                                    ) : (
                                      <span className="plans-table-mono">Unbound</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <PlansEmptyState
                        title="No bindings in scope"
                        copy="Choose a schema version or series to inspect the currently linked plan and pool bindings."
                      />
                    )}
                  </article>
                </div>
              ) : null}
            </section>

            <aside className="plans-rail">
              <section className="plans-rail-card heavy-glass">
                <div className="plans-rail-head">
                  <span className="plans-rail-tag">SELECTED_SCHEMA</span>
                  <span className="plans-rail-subtag">
                    <span className="plans-live-dot" aria-hidden="true" />
                    LIVE
                  </span>
                </div>
                <div className="plans-rail-hero">
                  <span className="plans-rail-hero-val">{effectiveSchema ? `v${effectiveSchema.version}` : (selectedSeries?.termsVersion ?? "—")}</span>
                  <span className="plans-rail-hero-sub">{effectiveSchema?.schemaKeyHashHex.slice(0, 12) ?? selectedSeries?.comparabilityKey ?? "Awaiting selection"}</span>
                </div>
                <div className="plans-rail-row">
                  <span>Schema address</span>
                  <strong>{effectiveSchema ? shortenAddress(effectiveSchema.address, 6) : "—"}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Linked pool</span>
                  <strong>{linkedPool?.poolId ?? "Unbound"}</strong>
                </div>
                <div className="plans-rail-row">
                  <span>Series bound</span>
                  <strong>{scopedSeries.length}</strong>
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
