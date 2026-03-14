// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { listPoolRules, listSchemas, type RuleSummary, type SchemaSummary } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import {
  fetchSchemaMetadata,
  parseSchemaOutcomes,
  type SchemaMetadataFetchErrorCode,
  type SchemaOutcomeOption,
} from "@/lib/schema-metadata";

function shortAddress(value: string): string {
  if (!value) return "n/a";
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function normalize(value: string): string {
  return value.trim();
}

function metadataIssueHelp(code: SchemaMetadataFetchErrorCode | "missing_uri" | null): string | null {
  switch (code) {
    case null:
      return null;
    case "missing_uri":
      return "This schema entry has no metadata URL. Register a metadata URI via governance to load outcomes.";
    case "non_json_content_type":
      return "Metadata URL returned HTML/text, not JSON. Update metadata URI to a raw JSON endpoint.";
    case "fetch_failed":
      return "Metadata URL is unreachable from this environment (or private/auth-protected). Use a publicly reachable JSON URL for shared discovery.";
    case "http_error":
      return "Metadata URL returned an HTTP error. Verify the endpoint exists and is publicly accessible.";
    case "invalid_json":
      return "Metadata response is not valid JSON.";
    case "invalid_uri":
      return "Metadata URI on schema entry is invalid.";
    case "unsupported_protocol":
      return "Metadata URI uses an unsupported protocol. Use http(s).";
    default:
      return "Metadata is unavailable.";
  }
}

function metadataIssueLabel(
  code: SchemaMetadataFetchErrorCode | "missing_uri" | null,
  warnings: string[],
): string {
  if (!code) {
    return warnings.length > 0 ? "Loaded with warnings" : "Loaded JSON metadata";
  }
  switch (code) {
    case "missing_uri":
      return "Missing metadata URL";
    case "non_json_content_type":
      return "URL returned HTML, not JSON";
    case "fetch_failed":
      return "Metadata private / unreachable";
    case "http_error":
      return "Metadata URL HTTP error";
    case "invalid_json":
      return "Metadata JSON invalid";
    case "invalid_uri":
      return "Metadata URL invalid";
    case "unsupported_protocol":
      return "Metadata URL protocol unsupported";
    default:
      return "Metadata unavailable";
  }
}

export function SchemaRegistryInspector() {
  const { connection } = useConnection();
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [outcomeSearch, setOutcomeSearch] = useState("");
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [selectedSchemaAddress, setSelectedSchemaAddress] = useState("");
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [schemasError, setSchemasError] = useState<string | null>(null);

  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataHealth, setMetadataHealth] = useState<string>("Not loaded");
  const [metadataIssueCode, setMetadataIssueCode] = useState<SchemaMetadataFetchErrorCode | "missing_uri" | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<SchemaOutcomeOption[]>([]);

  const [schemaRules, setSchemaRules] = useState<RuleSummary[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const selectedSchema = useMemo(
    () => schemas.find((row) => row.address === selectedSchemaAddress) ?? null,
    [schemas, selectedSchemaAddress],
  );

  const verifiedOnly = !includeUnverified;

  const noSchemaMessage = useMemo(() => {
    if (verifiedOnly) {
      return "No verified schemas found. Enable Include unverified to inspect draft entries.";
    }
    return "No schema entries found on chain for this cluster/program.";
  }, [verifiedOnly]);

  const refreshSchemas = useCallback(async () => {
    setSchemasLoading(true);
    setSchemasError(null);
    try {
      const next = await listSchemas({ connection, verifiedOnly });
      setSchemas(next);
      setSelectedSchemaAddress((prev) => (next.some((row) => row.address === prev) ? prev : (next[0]?.address ?? "")));
    } catch (error) {
      setSchemasError(
        formatRpcError(error, {
          fallback: "Failed to load schema registry data.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
      setSchemas([]);
      setSelectedSchemaAddress("");
    } finally {
      setSchemasLoading(false);
    }
  }, [connection, verifiedOnly]);

  useEffect(() => {
    void refreshSchemas();
  }, [refreshSchemas]);

  useEffect(() => {
    async function loadMetadata() {
      setWarnings([]);
      setOutcomes([]);
      setMetadataHealth("Not loaded");
      setMetadataIssueCode(null);

      if (!selectedSchema) return;
      if (!selectedSchema.metadataUri) {
        setMetadataHealth("Missing metadata URL");
        setMetadataIssueCode("missing_uri");
        setWarnings(["Selected schema has no metadata URI."]);
        return;
      }

      setMetadataLoading(true);
      try {
        const fetched = await fetchSchemaMetadata(selectedSchema.metadataUri);
        const parsed = parseSchemaOutcomes(fetched.metadata);
        setOutcomes(parsed.outcomes);

        if (fetched.error) {
          setMetadataIssueCode(fetched.error.code);
          setWarnings(parsed.warnings);
          setMetadataHealth(metadataIssueLabel(fetched.error.code, parsed.warnings));
        } else {
          setMetadataIssueCode(null);
          setWarnings(parsed.warnings);
          setMetadataHealth(metadataIssueLabel(null, parsed.warnings));
        }
      } finally {
        setMetadataLoading(false);
      }
    }

    void loadMetadata();
  }, [selectedSchema]);

  useEffect(() => {
    async function loadRuleMappings() {
      setSchemaRules([]);
      setRulesError(null);
      if (!selectedSchema) return;

      setRulesLoading(true);
      try {
        const allRules = await listPoolRules({ connection, enabledOnly: false });
        const filtered = allRules
          .filter(
            (row) =>
              row.schemaKeyHashHex.toLowerCase() === selectedSchema.schemaKeyHashHex.toLowerCase()
              && row.schemaVersion === selectedSchema.version,
          )
          .sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.pool.localeCompare(b.pool));
        setSchemaRules(filtered);
      } catch (error) {
        setRulesError(
          formatRpcError(error, {
            fallback: "Failed to load schema rule mappings.",
            rpcEndpoint: connection.rpcEndpoint,
          }),
        );
      } finally {
        setRulesLoading(false);
      }
    }

    void loadRuleMappings();
  }, [connection, selectedSchema]);

  const metadataHelp = metadataIssueHelp(metadataIssueCode);
  const metadataStatusClass = metadataIssueCode ? "status-off" : "status-ok";

  const fallbackOutcomesFromRules = useMemo<SchemaOutcomeOption[]>(() => {
    const seen = new Set<string>();
    const derived: SchemaOutcomeOption[] = [];
    for (const rule of schemaRules) {
      const id = rule.ruleId.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      derived.push({
        id,
        label: id,
        description: "Derived from on-chain rule mapping.",
      });
    }
    return derived;
  }, [schemaRules]);

  const displayedOutcomes = outcomes.length > 0 ? outcomes : fallbackOutcomesFromRules;
  const usingRuleFallbackOutcomes = outcomes.length === 0 && fallbackOutcomesFromRules.length > 0;
  const filteredOutcomes = useMemo(() => {
    const needle = normalize(outcomeSearch).toLowerCase();
    if (!needle) return displayedOutcomes;
    return displayedOutcomes.filter((outcome) =>
      [
        outcome.id,
        outcome.label,
        outcome.description || "",
        outcome.metricId || "",
        outcome.domain || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [displayedOutcomes, outcomeSearch]);
  const outcomesByDomain = useMemo(() => {
    const counts = new Map<string, number>();
    for (const outcome of displayedOutcomes) {
      const key = outcome.domain || "uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [displayedOutcomes]);

  return (
    <section className="surface-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="metric-label">Schema</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="secondary-button cursor-pointer px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <input
                className="h-4 w-4 cursor-pointer rounded border-[var(--border)]"
                type="checkbox"
                checked={includeUnverified}
                onChange={(event) => setIncludeUnverified(event.target.checked)}
              />
              Include draft schemas
            </span>
          </label>
          <button className="secondary-button px-4 py-2" type="button" onClick={() => void refreshSchemas()} disabled={schemasLoading}>
            {schemasLoading ? "Refreshing..." : "Refresh schemas"}
          </button>
        </div>
      </div>

      {schemasError ? <p className="field-error">{schemasError}</p> : null}

      <label className="field-label">
        Schema
        <select
          className="field-input"
          value={selectedSchemaAddress}
          onChange={(event) => setSelectedSchemaAddress(event.target.value)}
          disabled={schemasLoading || schemas.length === 0}
        >
          <option value="">Select schema</option>
          {schemas.map((schema) => (
            <option key={schema.address} value={schema.address}>
              {schema.schemaKey} v{schema.version} {schema.verified ? "(verified)" : "(unverified)"}
            </option>
          ))}
        </select>
      </label>

      {selectedSchema ? (
        <div className="surface-card-soft space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{selectedSchema.schemaKey || "n/a"}</span>
            {" "}v{selectedSchema.version}
            {" "}
            <span className={`status-pill ${selectedSchema.verified ? "status-ok" : "status-off"}`}>
              {selectedSchema.verified ? "DAO verified" : "Draft / unverified"}
            </span>
          </p>
          <p className="field-help">
            Verified status is controlled by governance via <span className="font-mono">verify_outcome_schema</span>.
          </p>
          <p className="field-help break-all">Metadata URL: {selectedSchema.metadataUri || "n/a"}</p>
          <details className="pt-1">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--muted-foreground)]">
              Show technical fields
            </summary>
            <div className="address-stack pt-2">
              <div className="mini-address">Schema address: {selectedSchema.address}</div>
              <div className="mini-address">Schema key hash: {selectedSchema.schemaKeyHashHex}</div>
              <div className="mini-address">Schema hash: {selectedSchema.schemaHashHex}</div>
              <div className="mini-address">Publisher: {shortAddress(selectedSchema.publisher)}</div>
            </div>
          </details>
        </div>
      ) : (
        <p className="field-help">{noSchemaMessage}</p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Metadata JSON:</span>
          <span className={`status-pill ${metadataStatusClass}`}>{metadataHealth}</span>
          {metadataLoading ? <span className="field-help">Loading metadata...</span> : null}
        </div>
        {metadataHelp ? <p className="field-help">{metadataHelp}</p> : null}
        {warnings.map((warning, index) => (
          <p key={`${warning}-${index}`} className="field-help">
            {warning}
          </p>
        ))}
      </div>

      <div className="space-y-2">
        <p className="metric-label">Outcomes</p>
        <p className="field-help">
          Showing {filteredOutcomes.length} of {displayedOutcomes.length} outcomes.
        </p>
        {outcomesByDomain.length > 0 ? (
          <p className="field-help break-all">
            Domains: {outcomesByDomain.map(([domain, count]) => `${domain} (${count})`).join(", ")}
          </p>
        ) : null}
        <label className="field-label">
          Search outcomes
          <input
            className="field-input"
            value={outcomeSearch}
            onChange={(event) => setOutcomeSearch(event.target.value)}
            placeholder="Search by outcome id, label, metric, or domain"
          />
        </label>
        {usingRuleFallbackOutcomes ? (
          <p className="field-help">Using on-chain rule IDs as fallback because metadata outcomes are unavailable.</p>
        ) : null}
        {filteredOutcomes.length === 0 ? (
          <p className="field-help">
            {selectedSchema ? "No outcomes match the current filters." : "Select a schema to view outcomes."}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredOutcomes.map((outcome) => (
              <div key={outcome.id} className="surface-card-soft space-y-1 p-3 sm:p-3.5">
                <p className="text-sm">
                  <span className="font-mono font-semibold">{outcome.id}</span>
                  {" "}
                  <span className="text-[var(--muted-foreground)]">- {outcome.label}</span>
                </p>
                {outcome.description ? <p className="field-help">{outcome.description}</p> : null}
                {outcome.domain ? <p className="field-help">Domain: {outcome.domain}</p> : null}
                {outcome.metricId ? <p className="field-help font-mono">metricId: {outcome.metricId}</p> : null}
                {outcome.comparator && typeof outcome.threshold === "number" ? (
                  <p className="field-help">
                    Condition: {outcome.comparator} {outcome.threshold}{outcome.unit ? ` ${outcome.unit}` : ""}
                  </p>
                ) : null}
                {outcome.valueHashHex ? <p className="field-help font-mono">valueHashHex: {outcome.valueHashHex}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="metric-label">Rules (on-chain mappings)</p>
        {rulesLoading ? <p className="field-help">Loading rule mappings...</p> : null}
        {rulesError ? <p className="field-error">{rulesError}</p> : null}
        {!selectedSchema ? (
          <p className="field-help">Select a schema to view mapped rules.</p>
        ) : schemaRules.length === 0 ? (
          <p className="field-help">No pool rules currently reference this schema version.</p>
        ) : (
          <div className="space-y-2">
            {schemaRules.map((rule) => (
              <div key={rule.address} className="surface-card-soft p-3 sm:p-3.5">
                <p className="text-sm">
                  <span className="font-mono font-semibold">{rule.ruleId}</span>
                  {" "}
                  <span className={`status-pill ${rule.enabled ? "status-ok" : "status-off"}`}>
                    {rule.enabled ? "enabled" : "disabled"}
                  </span>
                </p>
                <p className="field-help font-mono">Pool: {shortAddress(rule.pool)}</p>
                <p className="field-help font-mono">ruleHash: {shortAddress(rule.ruleHashHex)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
