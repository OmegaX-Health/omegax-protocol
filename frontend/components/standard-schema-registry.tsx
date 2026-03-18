// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { AlertCircle, CheckCircle2, Copy, FileJson, RefreshCw } from "lucide-react";

import { listSchemas, type SchemaSummary } from "@/lib/protocol";
import {
  fetchSchemaMetadata,
  parseSchemaOutcomes,
  type ParsedSchemaOutcomes,
} from "@/lib/schema-metadata";
import { formatRpcError } from "@/lib/rpc-errors";
import { stableSha256Hex } from "@/lib/stable-hash";

const STANDARD_SCHEMA_KEY =
  process.env.NEXT_PUBLIC_STANDARD_SCHEMA_KEY?.trim() || "omegax.standard.health_outcomes";
const LOCAL_STANDARD_SCHEMA_URL = "/schemas/health_outcomes.json";
const LOCAL_CACHE_KEY = "__local_standard_schema__";
const MAX_DIFF_ROWS = 12;

type MetadataState = {
  loading: boolean;
  parsed: ParsedSchemaOutcomes;
  rawMetadata: unknown | null;
  metadataError: string | null;
  sourceUrl: string;
  sourceType: "onchain" | "local";
  computedSchemaHashHex: string | null;
  computedContentHashHex: string | null;
  integrityMatches: boolean | null;
  integrityMatchSource: "payload" | "content" | null;
};

function shortHash(value: string): string {
  if (!value) return "n/a";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-10)}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function sortSchemaRows(rows: SchemaSummary[]): SchemaSummary[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.verified) - Number(a.verified)
      || b.version - a.version
      || a.address.localeCompare(b.address),
  );
}

function noMetadataState(sourceUrl: string, sourceType: MetadataState["sourceType"], message: string): MetadataState {
  return {
    loading: false,
    parsed: { outcomes: [], outcomeTemplates: [], warnings: [] },
    rawMetadata: null,
    metadataError: message,
    sourceUrl,
    sourceType,
    computedSchemaHashHex: null,
    computedContentHashHex: null,
    integrityMatches: null,
    integrityMatchSource: null,
  };
}

function stripEmbeddedSchemaHashes(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }
  const source = metadata as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "schemaHashHex" || key === "schemaKeyHashHex") continue;
    next[key] = value;
  }
  return next;
}

function toConditionLabel(comparator?: string, threshold?: number, unit?: string): string {
  if (!comparator || threshold === undefined || threshold === null) return "n/a";
  return `${comparator} ${threshold}${unit ? ` ${unit}` : ""}`;
}

export function StandardSchemaRegistry() {
  const { connection } = useConnection();
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [schemasError, setSchemasError] = useState<string | null>(null);
  const [schemaRows, setSchemaRows] = useState<SchemaSummary[]>([]);
  const [showingFallbackSchemaSet, setShowingFallbackSchemaSet] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [metadataByKey, setMetadataByKey] = useState<Record<string, MetadataState>>({});
  const [selectedTab, setSelectedTab] = useState<"outcomes" | "templates">("outcomes");
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    async function loadSchemas() {
      setLoadingSchemas(true);
      setSchemasError(null);
      try {
        const allSchemas = await listSchemas({ connection, verifiedOnly: false });
        const standardSchemas = sortSchemaRows(
          allSchemas.filter((row) => normalize(row.schemaKey) === normalize(STANDARD_SCHEMA_KEY)),
        );
        const chosenRows = standardSchemas.length > 0 ? standardSchemas : sortSchemaRows(allSchemas);
        setSchemaRows(chosenRows);
        setShowingFallbackSchemaSet(standardSchemas.length === 0 && chosenRows.length > 0);
        setSelectedAddress((previous) => {
          if (previous && chosenRows.some((row) => row.address === previous)) return previous;
          const preferredVerified = chosenRows.find((row) => row.verified);
          return preferredVerified?.address || chosenRows[0]?.address || "";
        });
      } catch (error) {
        setSchemasError(
          formatRpcError(error, {
            fallback: "Failed to load standard schema versions from chain.",
            rpcEndpoint: connection.rpcEndpoint,
          }),
        );
        setSchemaRows([]);
        setShowingFallbackSchemaSet(false);
        setSelectedAddress("");
      } finally {
        setLoadingSchemas(false);
      }
    }

    void loadSchemas();
  }, [connection, refreshIndex]);

  const selectedSchema = useMemo(
    () => schemaRows.find((row) => row.address === selectedAddress) ?? null,
    [schemaRows, selectedAddress],
  );

  const previousSchema = useMemo(() => {
    if (!selectedSchema) return null;
    return schemaRows.find(
      (row) => row.version < selectedSchema.version || (row.version === selectedSchema.version && row.address !== selectedSchema.address),
    ) ?? null;
  }, [schemaRows, selectedSchema]);

  const loadLocalFallback = useCallback(async () => {
    setMetadataByKey((prev) => ({
      ...prev,
      [LOCAL_CACHE_KEY]: {
        loading: true,
        parsed: { outcomes: [], outcomeTemplates: [], warnings: [] },
        rawMetadata: null,
        metadataError: null,
        sourceUrl: LOCAL_STANDARD_SCHEMA_URL,
        sourceType: "local",
        computedSchemaHashHex: null,
        computedContentHashHex: null,
        integrityMatches: null,
        integrityMatchSource: null,
      },
    }));
    try {
      const response = await fetch(LOCAL_STANDARD_SCHEMA_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Local schema file responded with HTTP ${response.status}.`);
      }
      const metadata = (await response.json()) as unknown;
      const parsed = parseSchemaOutcomes(metadata);
      const computedHashHex = await stableSha256Hex(metadata);
      const computedContentHashHex = await stableSha256Hex(stripEmbeddedSchemaHashes(metadata));
      const root = typeof metadata === "object" && metadata && !Array.isArray(metadata)
        ? metadata as Record<string, unknown>
        : null;
      const declaredHash = typeof root?.schemaHashHex === "string" ? root.schemaHashHex.trim().toLowerCase() : "";
      const payloadMatch = declaredHash ? declaredHash === computedHashHex.toLowerCase() : false;
      const contentMatch = declaredHash ? declaredHash === computedContentHashHex.toLowerCase() : false;
      setMetadataByKey((prev) => ({
        ...prev,
        [LOCAL_CACHE_KEY]: {
          loading: false,
          parsed,
          rawMetadata: metadata,
          metadataError: null,
          sourceUrl: LOCAL_STANDARD_SCHEMA_URL,
          sourceType: "local",
          computedSchemaHashHex: computedHashHex,
          computedContentHashHex,
          integrityMatches: declaredHash ? (payloadMatch || contentMatch) : null,
          integrityMatchSource: payloadMatch ? "payload" : contentMatch ? "content" : null,
        },
      }));
    } catch (error) {
      setMetadataByKey((prev) => ({
        ...prev,
        [LOCAL_CACHE_KEY]: noMetadataState(
          LOCAL_STANDARD_SCHEMA_URL,
          "local",
          error instanceof Error ? error.message : "Failed to load local standard schema JSON.",
        ),
      }));
    }
  }, []);

  const loadSchemaMetadata = useCallback(async (schema: SchemaSummary) => {
    setMetadataByKey((prev) => ({
      ...prev,
      [schema.address]: {
        loading: true,
        parsed: { outcomes: [], outcomeTemplates: [], warnings: [] },
        rawMetadata: null,
        metadataError: null,
        sourceUrl: schema.metadataUri || "n/a",
        sourceType: "onchain",
        computedSchemaHashHex: null,
        computedContentHashHex: null,
        integrityMatches: null,
        integrityMatchSource: null,
      },
    }));

    if (!schema.metadataUri) {
      setMetadataByKey((prev) => ({
        ...prev,
        [schema.address]: noMetadataState(
          "n/a",
          "onchain",
          "Selected schema has no metadata URI.",
        ),
      }));
      return;
    }

    const fetched = await fetchSchemaMetadata(schema.metadataUri);
    const parsed = parseSchemaOutcomes(fetched.metadata);
    const metadataError = fetched.error
      ? fetched.error.message
      : fetched.metadata
        ? null
        : "Schema metadata response was empty.";

    let computedSchemaHashHex: string | null = null;
    let computedContentHashHex: string | null = null;
    let integrityMatches: boolean | null = null;
    let integrityMatchSource: MetadataState["integrityMatchSource"] = null;
    if (fetched.metadata) {
      computedSchemaHashHex = await stableSha256Hex(fetched.metadata);
      computedContentHashHex = await stableSha256Hex(stripEmbeddedSchemaHashes(fetched.metadata));
      const targetHash = normalize(schema.schemaHashHex);
      if (normalize(computedSchemaHashHex) === targetHash) {
        integrityMatches = true;
        integrityMatchSource = "payload";
      } else if (normalize(computedContentHashHex) === targetHash) {
        integrityMatches = true;
        integrityMatchSource = "content";
      } else {
        integrityMatches = false;
      }
    }

    setMetadataByKey((prev) => ({
      ...prev,
      [schema.address]: {
        loading: false,
        parsed,
        rawMetadata: fetched.metadata,
        metadataError,
        sourceUrl: schema.metadataUri,
        sourceType: "onchain",
        computedSchemaHashHex,
        computedContentHashHex,
        integrityMatches,
        integrityMatchSource,
      },
    }));
  }, []);

  useEffect(() => {
    if (selectedSchema) {
      const existing = metadataByKey[selectedSchema.address];
      if (!existing || (!existing.loading && existing.rawMetadata === null && !existing.metadataError)) {
        void loadSchemaMetadata(selectedSchema);
      }
    } else if (!schemaRows.length) {
      const existingLocal = metadataByKey[LOCAL_CACHE_KEY];
      if (!existingLocal) {
        void loadLocalFallback();
      }
    }
  }, [loadLocalFallback, loadSchemaMetadata, metadataByKey, schemaRows.length, selectedSchema]);

  useEffect(() => {
    if (!previousSchema) return;
    if (metadataByKey[previousSchema.address]) return;
    void loadSchemaMetadata(previousSchema);
  }, [loadSchemaMetadata, metadataByKey, previousSchema]);

  const activeMetadata = selectedSchema
    ? metadataByKey[selectedSchema.address]
    : metadataByKey[LOCAL_CACHE_KEY];
  const previousMetadata = previousSchema ? metadataByKey[previousSchema.address] : undefined;

  const activeOutcomes = activeMetadata?.parsed.outcomes || [];
  const activeTemplates = activeMetadata?.parsed.outcomeTemplates || [];

  const allDomains = useMemo(() => {
    const collected = new Set<string>();
    for (const outcome of activeOutcomes) {
      if (outcome.domain) collected.add(outcome.domain);
    }
    for (const template of activeTemplates) {
      if (template.domain) collected.add(template.domain);
    }
    return ["all", ...Array.from(collected).sort((a, b) => a.localeCompare(b))];
  }, [activeOutcomes, activeTemplates]);

  const filteredOutcomes = useMemo(() => {
    const needle = normalize(search);
    return activeOutcomes.filter((outcome) => {
      const matchesDomain = domainFilter === "all" || normalize(outcome.domain || "") === normalize(domainFilter);
      if (!matchesDomain) return false;
      if (!needle) return true;
      return [
        outcome.id,
        outcome.label,
        outcome.description || "",
        outcome.metricId || "",
        outcome.unit || "",
        ...(outcome.tags || []),
      ].some((value) => normalize(value).includes(needle));
    });
  }, [activeOutcomes, domainFilter, search]);

  const filteredTemplates = useMemo(() => {
    const needle = normalize(search);
    return activeTemplates.filter((template) => {
      const matchesDomain = domainFilter === "all" || normalize(template.domain || "") === normalize(domainFilter);
      if (!matchesDomain) return false;
      if (!needle) return true;
      return [
        template.id,
        template.label,
        template.description || "",
        template.metricId,
        template.unit,
        ...(template.tags || []),
      ].some((value) => normalize(value).includes(needle));
    });
  }, [activeTemplates, domainFilter, search]);

  const diffSummary = useMemo(() => {
    const currentRows = activeMetadata?.parsed.outcomes || [];
    const previousRows = previousMetadata?.parsed.outcomes || [];
    if (currentRows.length === 0 || previousRows.length === 0) {
      return { added: [] as string[], removed: [] as string[], changed: [] as string[] };
    }

    const currentMap = new Map(currentRows.map((row) => [row.id, row]));
    const previousMap = new Map(previousRows.map((row) => [row.id, row]));

    const added = Array.from(currentMap.keys())
      .filter((id) => !previousMap.has(id))
      .sort((a, b) => a.localeCompare(b));
    const removed = Array.from(previousMap.keys())
      .filter((id) => !currentMap.has(id))
      .sort((a, b) => a.localeCompare(b));
    const changed = Array.from(currentMap.keys())
      .filter((id) => previousMap.has(id))
      .filter((id) => {
        const current = currentMap.get(id)!;
        const previous = previousMap.get(id)!;
        const signature = JSON.stringify({
          kind: current.kind,
          metricId: current.metricId,
          metricWindow: current.metricWindow,
          comparator: current.comparator,
          threshold: current.threshold,
          unit: current.unit,
          evidence: current.evidence,
          valueHashHex: current.valueHashHex,
        });
        const previousSignature = JSON.stringify({
          kind: previous.kind,
          metricId: previous.metricId,
          metricWindow: previous.metricWindow,
          comparator: previous.comparator,
          threshold: previous.threshold,
          unit: previous.unit,
          evidence: previous.evidence,
          valueHashHex: previous.valueHashHex,
        });
        return signature !== previousSignature;
      })
      .sort((a, b) => a.localeCompare(b));

    return { added, removed, changed };
  }, [activeMetadata?.parsed.outcomes, previousMetadata?.parsed.outcomes]);

  async function copyValue(key: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField((prev) => (prev === key ? null : prev)), 1200);
    } catch {
      setCopiedField(null);
    }
  }

  const metadataWarnings = activeMetadata?.parsed.warnings || [];
  const metadataStatus = activeMetadata?.metadataError
    ? "Metadata unavailable"
    : activeMetadata?.loading
      ? "Loading metadata..."
      : "Metadata loaded";

  const activeSourceLabel = selectedSchema
    ? "On-chain metadata source"
    : "Local fallback source";

  return (
    <section className="surface-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[var(--foreground)]">OmegaX Standard Health Outcomes</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Canonical schema key: <span className="font-mono text-[var(--foreground)]">{STANDARD_SCHEMA_KEY}</span>
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Verified means governance toggled schema verification on-chain via <span className="font-mono">verify_outcome_schema</span>.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button inline-flex items-center gap-2 px-3 py-2 text-sm"
          onClick={() => {
            setMetadataByKey({});
            setRefreshIndex((prev) => prev + 1);
          }}
          disabled={loadingSchemas}
        >
          <RefreshCw className={`h-4 w-4 ${loadingSchemas ? "animate-spin" : ""}`} />
          {loadingSchemas ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {schemasError ? <p className="field-error">{schemasError}</p> : null}
      {showingFallbackSchemaSet ? (
        <p className="field-help">
          No exact on-chain match for the canonical key on this cluster. Showing available on-chain schema entries by best match.
        </p>
      ) : null}

      {schemaRows.length > 0 ? (
        <label className="field-label">
          Schema version history
          <select
            className="field-input"
            value={selectedAddress}
            onChange={(event) => setSelectedAddress(event.target.value)}
            disabled={loadingSchemas}
          >
            {schemaRows.map((row) => (
              <option key={row.address} value={row.address}>
                {row.schemaKey} • v{row.version} • {row.verified ? "Governance verified" : "Draft"} • {shortHash(row.address)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="field-help">
          No on-chain entries found for this standard schema key on the active cluster. Showing local fallback metadata.
        </p>
      )}

      <div className="surface-card-soft space-y-2 p-3 sm:p-4">
        <p className="metric-label">Source transparency</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Active source: <span className="font-semibold text-[var(--foreground)]">{activeSourceLabel}</span>
        </p>
        {selectedSchema ? (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className={`status-pill ${selectedSchema.verified ? "status-ok" : "status-off"}`}>
                {selectedSchema.verified ? "Governance verified" : "Draft / not verified"}
              </span>
              <span className="field-help">Publisher: {shortHash(selectedSchema.publisher)}</span>
            </div>
            <p className="field-help break-all">Schema key: {selectedSchema.schemaKey}</p>
            <p className="field-help break-all">Schema address: {selectedSchema.address}</p>
            <p className="field-help break-all">Metadata URL: {selectedSchema.metadataUri || "n/a"}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="secondary-button inline-flex items-center gap-2 px-2 py-1 text-xs"
                onClick={() => void copyValue("schema_key_hash", selectedSchema.schemaKeyHashHex)}
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedField === "schema_key_hash" ? "Copied" : "Copy schemaKeyHash"}
              </button>
              <button
                type="button"
                className="secondary-button inline-flex items-center gap-2 px-2 py-1 text-xs"
                onClick={() => void copyValue("schema_hash", selectedSchema.schemaHashHex)}
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedField === "schema_hash" ? "Copied" : "Copy schemaHash"}
              </button>
              {selectedSchema.metadataUri ? (
                <a
                  className="secondary-button inline-flex items-center gap-2 px-2 py-1 text-xs"
                  href={selectedSchema.metadataUri}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileJson className="h-3.5 w-3.5" />
                  Open metadata JSON
                </a>
              ) : null}
            </div>
            <p className="field-help break-all">Schema key hash: {selectedSchema.schemaKeyHashHex}</p>
            <p className="field-help break-all">Declared schema hash: {selectedSchema.schemaHashHex}</p>
          </>
        ) : null}
        <p className="field-help">Metadata status: {metadataStatus}</p>
        {activeMetadata?.computedSchemaHashHex ? (
          <p className="field-help break-all">
            Computed payload hash: {activeMetadata.computedSchemaHashHex}
          </p>
        ) : null}
        {activeMetadata?.computedContentHashHex ? (
          <p className="field-help break-all">
            Computed content hash (without embedded hash fields): {activeMetadata.computedContentHashHex}
          </p>
        ) : null}
        {activeMetadata && activeMetadata.integrityMatches !== null ? (
          <p className="field-help">
            Integrity:{" "}
            <span className={activeMetadata.integrityMatches ? "text-[var(--success)]" : "text-[var(--danger)]"}>
              {activeMetadata.integrityMatches
                ? activeMetadata.integrityMatchSource === "content"
                  ? "hash matches via metadata content hash"
                  : "hash matches on-chain schemaHashHex"
                : "hash mismatch with expected schemaHashHex"}
            </span>
          </p>
        ) : null}
        {activeMetadata?.metadataError ? <p className="field-error">{activeMetadata.metadataError}</p> : null}
        {metadataWarnings.map((warning, index) => (
          <p key={`${warning}-${index}`} className="field-help">{warning}</p>
        ))}
      </div>

      {previousSchema ? (
        <div className="surface-card-soft space-y-2 p-3 sm:p-4">
          <p className="metric-label">
            Version diff vs previous (v{previousSchema.version})
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <p className="field-help">Added outcomes: {diffSummary.added.length}</p>
            <p className="field-help">Removed outcomes: {diffSummary.removed.length}</p>
            <p className="field-help">Changed outcomes: {diffSummary.changed.length}</p>
          </div>
          {diffSummary.added.length > 0 ? (
            <p className="field-help break-all">Added IDs: {diffSummary.added.slice(0, MAX_DIFF_ROWS).join(", ")}</p>
          ) : null}
          {diffSummary.removed.length > 0 ? (
            <p className="field-help break-all">Removed IDs: {diffSummary.removed.slice(0, MAX_DIFF_ROWS).join(", ")}</p>
          ) : null}
          {diffSummary.changed.length > 0 ? (
            <p className="field-help break-all">Changed IDs: {diffSummary.changed.slice(0, MAX_DIFF_ROWS).join(", ")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`segment-button segment-button-compact ${selectedTab === "outcomes" ? "segment-button-active" : ""}`}
          onClick={() => setSelectedTab("outcomes")}
        >
          Outcomes ({activeOutcomes.length})
        </button>
        <button
          type="button"
          className={`segment-button segment-button-compact ${selectedTab === "templates" ? "segment-button-active" : ""}`}
          onClick={() => setSelectedTab("templates")}
        >
          Templates ({activeTemplates.length})
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr,1fr]">
        <label className="field-label">
          Search
          <input
            className="field-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={selectedTab === "outcomes" ? "Search outcomes by id, label, metric..." : "Search templates by id, label, metric..."}
          />
        </label>
        <label className="field-label">
          Domain
          <select className="field-input" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
            {allDomains.map((domain) => (
              <option key={domain} value={domain}>
                {domain === "all" ? "All domains" : domain}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedTab === "outcomes" ? (
        filteredOutcomes.length === 0 ? (
          <p className="field-help">No outcomes match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted-foreground)]">
                  <th className="px-2 py-2">Outcome</th>
                  <th className="px-2 py-2">Metric</th>
                  <th className="px-2 py-2">Condition</th>
                  <th className="px-2 py-2">Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutcomes.map((outcome) => (
                  <tr key={outcome.id} className="border-t border-[var(--border)]/40 align-top">
                    <td className="px-2 py-2">
                      <p className="font-semibold text-[var(--foreground)]">{outcome.label}</p>
                      <p className="field-help font-mono">{outcome.id}</p>
                      {outcome.domain ? <p className="field-help">Domain: {outcome.domain}</p> : null}
                    </td>
                    <td className="px-2 py-2">
                      <p className="field-help font-mono">{outcome.metricId || "n/a"}</p>
                      <p className="field-help">{outcome.metricWindow || "n/a"}</p>
                    </td>
                    <td className="px-2 py-2">
                      <p className="field-help">{toConditionLabel(outcome.comparator, outcome.threshold, outcome.unit)}</p>
                      {outcome.severity ? <p className="field-help">Severity: {outcome.severity}</p> : null}
                    </td>
                    <td className="px-2 py-2">
                      <p className="field-help font-mono">{shortHash(outcome.valueHashHex || "")}</p>
                      {outcome.description ? <p className="field-help">{outcome.description}</p> : null}
                      {outcome.evidence ? (
                        <p className="field-help">
                          Evidence: minSamples {outcome.evidence.minSamples ?? "n/a"}, minDays {outcome.evidence.minDaysCovered ?? "n/a"}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filteredTemplates.length === 0 ? (
        <p className="field-help">No templates match the current filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-2 py-2">Template</th>
                <th className="px-2 py-2">Metric</th>
                <th className="px-2 py-2">Comparator(s)</th>
                <th className="px-2 py-2">Suggested thresholds</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="border-t border-[var(--border)]/40 align-top">
                  <td className="px-2 py-2">
                    <p className="font-semibold text-[var(--foreground)]">{template.label}</p>
                    <p className="field-help font-mono">{template.id}</p>
                    {template.domain ? <p className="field-help">Domain: {template.domain}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    <p className="field-help font-mono">{template.metricId}</p>
                    <p className="field-help">{template.metricWindow}</p>
                    <p className="field-help">{template.unit}</p>
                  </td>
                  <td className="px-2 py-2">
                    <p className="field-help">{template.comparators.join(", ")}</p>
                    {template.severityDefault ? <p className="field-help">Severity default: {template.severityDefault}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    <p className="field-help">{template.thresholdPolicy.suggested.join(", ")}</p>
                    <p className="field-help">
                      Step: {template.thresholdPolicy.step ?? "n/a"} | Decimals: {template.thresholdPolicy.decimals ?? "n/a"}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        {activeMetadata?.metadataError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        <span>
          {activeMetadata?.metadataError
            ? "Metadata must be reachable as JSON for full outcome visibility."
            : "Metadata loaded; outcomes and templates are ready for pool/oracle selection."}
        </span>
      </div>
    </section>
  );
}
