// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";

import { AdvancedOverride } from "@/components/advanced-override";
import { SearchableSelect } from "@/components/searchable-select";
import {
  defaultOracleAddressFromEnv,
  defaultPoolAddressFromEnv,
  fetchProtocolReadiness,
  listMemberships,
  listOracles,
  listPoolRules,
  listPools,
  listSchemas,
  type MembershipSummary,
  type OracleSummary,
  type PoolSummary,
  type ProtocolReadiness,
  type RuleSummary,
  type SchemaSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type OperatorLens = "oracles" | "schemas" | "coverage";

type OperatorVisibilityPanelProps = {
  lens: OperatorLens;
  initialPoolAddress?: string;
  lockPoolSelection?: boolean;
  initialOracleAddress?: string;
  lockOracleSelection?: boolean;
  sectionMode?: "standalone" | "embedded";
};

const lensMeta: Record<OperatorLens, { title: string; copy: string; focusRows: string[] }> = {
  oracles: {
    title: "Live Oracle Registry Visibility",
    copy:
      "Inspect oracle registrations, approvals, and staking footprint in read-only mode using chain-discovered selectors.",
    focusRows: ["oracleRegistered", "poolOracleApproved", "poolOraclePolicyConfigured", "oracleStakePositionExists"],
  },
  schemas: {
    title: "Live Schema Registry Visibility",
    copy:
      "Inspect schema and rule readiness from verified, on-chain schema selections. Publication and verification remain governance-proposal only.",
    focusRows: ["schemaRegistered", "ruleRegistered", "poolTermsConfigured", "poolOraclePolicyConfigured"],
  },
  coverage: {
    title: "Coverage and Claims Visibility",
    copy:
      "Inspect coverage policy, premium ledger, and settlement support state without raw address or hash entry.",
    focusRows: ["coveragePolicyExists", "coveragePolicyNftExists", "premiumLedgerTracked", "poolAssetVaultConfigured"],
  },
};

function normalize(value: string): string {
  return value.trim();
}

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function isPubkey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function assertPubkey(value: string, label: string): void {
  try {
    new PublicKey(value);
  } catch {
    throw new Error(`${label} must be a valid public key.`);
  }
}

function assertHex32(value: string, label: string): void {
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${label} must be 32-byte hex (64 characters).`);
  }
}

function toPoolOptions(rows: PoolSummary[]) {
  return rows.map((row) => ({
    value: row.address,
    label: `${row.poolId} (${shortAddress(row.address)})`,
    hint: `Org ${row.organizationRef} | Authority ${shortAddress(row.authority)}`,
  }));
}

function toOracleOptions(rows: OracleSummary[]) {
  return rows.map((row) => ({
    value: row.oracle,
    label: `${shortAddress(row.oracle)}${row.active ? "" : " (inactive)"}`,
    hint: row.metadataUri || "No metadata URI",
  }));
}

function toSchemaOptions(rows: SchemaSummary[]) {
  return rows.map((row) => ({
    value: row.address,
    label: `${row.schemaKey} v${row.version}`,
    hint: `${row.verified ? "Verified" : "Unverified"} | ${shortAddress(row.schemaKeyHashHex)}`,
  }));
}

function toRuleOptions(rows: RuleSummary[]) {
  return rows.map((row) => ({
    value: row.address,
    label: `${row.ruleId}${row.enabled ? "" : " (disabled)"}`,
    hint: `${shortAddress(row.ruleHashHex)} | ${row.schemaKey}`,
  }));
}

function toMembershipOptions(rows: MembershipSummary[]) {
  return rows.map((row) => ({
    value: row.member,
    label: `${shortAddress(row.member)} (${shortAddress(row.address)})`,
    hint: `Status ${row.status} | Subject ${shortAddress(row.subjectCommitmentHex)}`,
  }));
}

export function OperatorVisibilityPanel({
  lens,
  initialPoolAddress,
  lockPoolSelection = false,
  initialOracleAddress,
  lockOracleSelection = false,
  sectionMode = "standalone",
}: OperatorVisibilityPanelProps) {
  const { connection } = useConnection();
  const meta = lensMeta[lens];
  const embedded = sectionMode === "embedded";
  const normalizedInitialPoolAddress = normalize(initialPoolAddress ?? defaultPoolAddressFromEnv() ?? "");
  const normalizedInitialOracleAddress = normalize(initialOracleAddress ?? defaultOracleAddressFromEnv() ?? "");
  const poolLocked = lockPoolSelection && isPubkey(normalizedInitialPoolAddress);
  const oracleLocked = lockOracleSelection && isPubkey(normalizedInitialOracleAddress);

  const [search, setSearch] = useState({
    pools: "",
    oracles: "",
    members: "",
    schemas: "",
    rules: "",
  });
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [oracles, setOracles] = useState<OracleSummary[]>([]);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [rules, setRules] = useState<RuleSummary[]>([]);

  const [selectedPoolAddress, setSelectedPoolAddress] = useState(normalizedInitialPoolAddress);
  const [selectedOracleAddress, setSelectedOracleAddress] = useState(normalizedInitialOracleAddress);
  const [selectedMemberAddress, setSelectedMemberAddress] = useState("");
  const [selectedSchemaAddress, setSelectedSchemaAddress] = useState("");
  const [selectedRuleAddress, setSelectedRuleAddress] = useState("");

  const [manualPoolAddress, setManualPoolAddress] = useState(normalizedInitialPoolAddress);
  const [manualOracleAddress, setManualOracleAddress] = useState(normalizedInitialOracleAddress);
  const [manualMemberAddress, setManualMemberAddress] = useState("");
  const [manualSchemaKeyHash, setManualSchemaKeyHash] = useState("");
  const [manualRuleHashHex, setManualRuleHashHex] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProtocolReadiness | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const selectedSchema = useMemo(
    () => schemas.find((row) => row.address === selectedSchemaAddress) ?? null,
    [schemas, selectedSchemaAddress],
  );
  const selectedRule = useMemo(
    () => rules.find((row) => row.address === selectedRuleAddress) ?? null,
    [rules, selectedRuleAddress],
  );

  const activePoolAddress = normalize(
    poolLocked
      ? normalizedInitialPoolAddress
      : overrideEnabled
        ? manualPoolAddress
        : selectedPoolAddress || manualPoolAddress,
  );
  const activeOracleAddress = normalize(
    oracleLocked
      ? normalizedInitialOracleAddress
      : overrideEnabled
        ? manualOracleAddress
        : selectedOracleAddress || manualOracleAddress,
  );
  const activeMemberAddress = normalize(overrideEnabled ? manualMemberAddress : selectedMemberAddress || manualMemberAddress);
  const activeSchemaKeyHash = normalize(
    (overrideEnabled ? manualSchemaKeyHash : selectedSchema?.schemaKeyHashHex || manualSchemaKeyHash).replace(/^0x/i, ""),
  ).toLowerCase();
  const activeRuleHash = normalize(
    (overrideEnabled ? manualRuleHashHex : selectedRule?.ruleHashHex || manualRuleHashHex).replace(/^0x/i, ""),
  ).toLowerCase();

  const refreshSelectors = useCallback(async () => {
    setSelectorLoading(true);
    setSelectorError(null);
    try {
      const nextPools = await listPools({ connection, search: search.pools || null });
      setPools(nextPools);

      const resolvedPool =
        poolLocked
        ? normalizedInitialPoolAddress
        : (selectedPoolAddress && nextPools.some((row) => row.address === selectedPoolAddress) ? selectedPoolAddress : "")
        || nextPools[0]?.address
        || "";
      if (poolLocked) {
        setSelectedPoolAddress(normalizedInitialPoolAddress);
      } else if (resolvedPool !== selectedPoolAddress) {
        setSelectedPoolAddress(resolvedPool);
      }

      const [nextOracles, nextSchemas, nextRules, nextMemberships] = await Promise.all([
        listOracles({ connection, activeOnly: true, search: search.oracles || null }),
        listSchemas({ connection, verifiedOnly: true, search: search.schemas || null }),
        resolvedPool
          ? listPoolRules({ connection, poolAddress: resolvedPool, enabledOnly: true, search: search.rules || null })
          : Promise.resolve([]),
        resolvedPool
          ? listMemberships({ connection, poolAddress: resolvedPool, activeOnly: true, search: search.members || null })
          : Promise.resolve([]),
      ]);

      setOracles(nextOracles);
      setSchemas(nextSchemas);
      setRules(nextRules);
      setMemberships(nextMemberships);

      setSelectedOracleAddress((prev) =>
        oracleLocked
          ? normalizedInitialOracleAddress
          : (nextOracles.some((row) => row.oracle === prev) ? prev : (nextOracles[0]?.oracle ?? "")),
      );
      setSelectedSchemaAddress((prev) =>
        nextSchemas.some((row) => row.address === prev) ? prev : (nextSchemas[0]?.address ?? ""),
      );
      setSelectedRuleAddress((prev) =>
        nextRules.some((row) => row.address === prev) ? prev : (nextRules[0]?.address ?? ""),
      );
      setSelectedMemberAddress((prev) =>
        nextMemberships.some((row) => row.member === prev) ? prev : (nextMemberships[0]?.member ?? ""),
      );
    } catch (cause) {
      const message = formatRpcError(cause, {
        fallback: "Failed to load selector options from chain.",
        rpcEndpoint: connection.rpcEndpoint,
      });
      setSelectorError(message);
    } finally {
      setSelectorLoading(false);
    }
  }, [
    connection,
    normalizedInitialOracleAddress,
    normalizedInitialPoolAddress,
    oracleLocked,
    poolLocked,
    search.members,
    search.oracles,
    search.pools,
    search.rules,
    search.schemas,
    selectedPoolAddress,
  ]);

  useEffect(() => {
    void refreshSelectors();
  }, [refreshSelectors]);

  useEffect(() => {
    if (!poolLocked) return;
    setSelectedPoolAddress(normalizedInitialPoolAddress);
    setManualPoolAddress(normalizedInitialPoolAddress);
  }, [normalizedInitialPoolAddress, poolLocked]);

  useEffect(() => {
    if (!oracleLocked) return;
    setSelectedOracleAddress(normalizedInitialOracleAddress);
    setManualOracleAddress(normalizedInitialOracleAddress);
  }, [normalizedInitialOracleAddress, oracleLocked]);

  const statusRows = useMemo(
    () =>
      snapshot
        ? [
            { id: "configInitialized", label: "Protocol config initialized", value: snapshot.configInitialized },
            { id: "poolExists", label: "Pool exists", value: snapshot.poolExists },
            { id: "oracleRegistered", label: "Oracle registered", value: snapshot.oracleRegistered },
            { id: "poolOracleApproved", label: "Oracle approved for pool", value: snapshot.poolOracleApproved },
            {
              id: "poolOraclePolicyConfigured",
              label: "Oracle policy configured",
              value: snapshot.poolOraclePolicyConfigured,
            },
            {
              id: "oracleStakePositionExists",
              label: "Oracle stake position present",
              value: snapshot.oracleStakePositionExists,
            },
            { id: "inviteIssuerRegistered", label: "Invite issuer registered", value: snapshot.inviteIssuerRegistered },
            { id: "schemaRegistered", label: "Schema registered", value: snapshot.schemaRegistered },
            { id: "ruleRegistered", label: "Rule registered", value: snapshot.ruleRegistered },
            { id: "memberEnrolled", label: "Member enrollment record", value: snapshot.memberEnrolled },
            { id: "claimDelegateConfigured", label: "Claim delegate record", value: snapshot.claimDelegateConfigured },
            { id: "poolTermsConfigured", label: "Pool terms configured", value: snapshot.poolTermsConfigured },
            {
              id: "poolAssetVaultConfigured",
              label: "SPL asset vault configured",
              value: snapshot.poolAssetVaultConfigured,
            },
            { id: "coveragePolicyExists", label: "Coverage policy exists", value: snapshot.coveragePolicyExists },
            { id: "coveragePolicyNftExists", label: "Coverage NFT record exists", value: snapshot.coveragePolicyNftExists },
            { id: "premiumLedgerTracked", label: "Premium ledger tracked", value: snapshot.premiumLedgerTracked },
          ]
        : [],
    [snapshot],
  );

  const visibleCount = statusRows.filter((row) => row.value).length;
  const focusedReadyCount = statusRows.filter((row) => meta.focusRows.includes(row.id) && row.value).length;

  const refreshSnapshot = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!activePoolAddress) {
        throw new Error("Pool is required to load visibility details.");
      }
      assertPubkey(activePoolAddress, "Pool address");

      if (activeOracleAddress) {
        assertPubkey(activeOracleAddress, "Oracle address");
      }
      if (activeMemberAddress) {
        assertPubkey(activeMemberAddress, "Member address");
      }
      if (activeSchemaKeyHash) {
        assertHex32(activeSchemaKeyHash, "Schema key hash");
      }
      if (activeRuleHash) {
        assertHex32(activeRuleHash, "Rule hash");
      }

      const nextSnapshot = await fetchProtocolReadiness({
        connection,
        poolAddress: activePoolAddress,
        oracleAddress: activeOracleAddress || null,
        memberAddress: activeMemberAddress || null,
        schemaKeyHashHex: activeSchemaKeyHash || null,
        ruleHashHex: activeRuleHash || null,
      });
      setSnapshot(nextSnapshot);
      setLastUpdatedAt(Date.now());
    } catch (cause) {
      const message = formatRpcError(cause, {
        fallback: "Failed to fetch protocol visibility snapshot.",
        rpcEndpoint: connection.rpcEndpoint,
      });
      setError(message);
      setSnapshot(null);
      setLastUpdatedAt(null);
    } finally {
      setBusy(false);
    }
  }, [activeMemberAddress, activeOracleAddress, activePoolAddress, activeRuleHash, activeSchemaKeyHash, connection]);

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="hero-title">{meta.title}</h2>
          <p className="hero-copy">{meta.copy}</p>
        </div>
      ) : null}

      {selectorError ? <p className="field-error">{selectorError}</p> : null}
      {selectorError && !overrideEnabled ? (
        <p className="field-help">If RPC discovery is incomplete, switch to manual inputs to paste exact addresses or hashes.</p>
      ) : null}

      {poolLocked ? (
        <div className="surface-card-soft space-y-1">
          <p className="metric-label">Pool</p>
          <p className="field-help font-mono">{normalizedInitialPoolAddress}</p>
        </div>
      ) : (
        <SearchableSelect
          label="Pool"
          value={selectedPoolAddress}
          options={toPoolOptions(pools)}
          onChange={setSelectedPoolAddress}
          searchValue={search.pools}
          onSearchChange={(value) => setSearch((prev) => ({ ...prev, pools: value }))}
          loading={selectorLoading}
          disabled={overrideEnabled}
          disabledHint="Selector is disabled while manual inputs are active."
          placeholder="Select pool"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {oracleLocked ? (
          <div className="surface-card-soft space-y-1">
            <p className="metric-label">Oracle</p>
            <p className="field-help font-mono">{normalizedInitialOracleAddress}</p>
          </div>
        ) : (
          <SearchableSelect
            label="Oracle (optional)"
            value={selectedOracleAddress}
            options={toOracleOptions(oracles)}
            onChange={setSelectedOracleAddress}
            searchValue={search.oracles}
            onSearchChange={(value) => setSearch((prev) => ({ ...prev, oracles: value }))}
            loading={selectorLoading}
            disabled={overrideEnabled}
            disabledHint="Selector is disabled while manual inputs are active."
            placeholder="Select oracle"
          />
        )}

        <SearchableSelect
          label="Member (optional)"
          value={selectedMemberAddress}
          options={toMembershipOptions(memberships)}
          onChange={setSelectedMemberAddress}
          searchValue={search.members}
          onSearchChange={(value) => setSearch((prev) => ({ ...prev, members: value }))}
          loading={selectorLoading}
          disabled={overrideEnabled}
          disabledHint="Selector is disabled while manual inputs are active."
          placeholder="Select member"
        />

        <SearchableSelect
          label="Schema (verified only)"
          value={selectedSchemaAddress}
          options={toSchemaOptions(schemas)}
          onChange={setSelectedSchemaAddress}
          searchValue={search.schemas}
          onSearchChange={(value) => setSearch((prev) => ({ ...prev, schemas: value }))}
          loading={selectorLoading}
          disabled={overrideEnabled}
          disabledHint="Selector is disabled while manual inputs are active."
          placeholder="Select schema"
        />

        <SearchableSelect
          label="Rule (pool scoped)"
          value={selectedRuleAddress}
          options={toRuleOptions(rules)}
          onChange={setSelectedRuleAddress}
          searchValue={search.rules}
          onSearchChange={(value) => setSearch((prev) => ({ ...prev, rules: value }))}
          loading={selectorLoading}
          disabled={overrideEnabled}
          disabledHint="Selector is disabled while manual inputs are active."
          placeholder="Select rule"
          emptyMessage="No enabled rules found for selected pool."
        />
      </div>

      <AdvancedOverride
        title="Manual visibility inputs"
        description="Use manual inputs only when selector-driven discovery is missing the exact pool, oracle, member, schema, or rule you need to inspect."
        enabled={overrideEnabled}
        onToggle={setOverrideEnabled}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {poolLocked ? null : (
            <label className="field-label">
              Pool address override
              <input
                className="field-input"
                value={manualPoolAddress}
                onChange={(event) => setManualPoolAddress(event.target.value)}
                placeholder="Pool pubkey"
              />
            </label>
          )}
          {oracleLocked ? null : (
            <label className="field-label">
              Oracle address override
              <input
                className="field-input"
                value={manualOracleAddress}
                onChange={(event) => setManualOracleAddress(event.target.value)}
                placeholder="Oracle pubkey"
              />
            </label>
          )}
          <label className="field-label">
            Member address override
            <input
              className="field-input"
              value={manualMemberAddress}
              onChange={(event) => setManualMemberAddress(event.target.value)}
              placeholder="Member pubkey"
            />
          </label>
          <label className="field-label">
            Schema key hash override
            <input
              className="field-input font-mono"
              value={manualSchemaKeyHash}
              onChange={(event) => setManualSchemaKeyHash(event.target.value)}
              placeholder="64-char hex"
            />
          </label>
          <label className="field-label sm:col-span-2">
            Rule hash override
            <input
              className="field-input font-mono"
              value={manualRuleHashHex}
              onChange={(event) => setManualRuleHashHex(event.target.value)}
              placeholder="64-char hex"
            />
          </label>
        </div>
      </AdvancedOverride>

      <p className="field-help font-mono">
        Resolved schema key hash: {activeSchemaKeyHash || "n/a"}
        <br />
        Resolved rule hash: {activeRuleHash || "n/a"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button className="secondary-button px-4 py-2" type="button" onClick={() => void refreshSelectors()} disabled={selectorLoading}>
          {selectorLoading ? "Refreshing selectors..." : "Refresh selectors"}
        </button>
        <button className="action-button" onClick={() => void refreshSnapshot()} disabled={busy}>
          {busy ? "Refreshing snapshot..." : "Refresh snapshot"}
        </button>
        <span className="status-pill status-off">Read-only mode</span>
        {lastUpdatedAt ? <span className="field-help">Last refresh: {new Date(lastUpdatedAt).toLocaleString()}</span> : null}
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      {snapshot ? (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <p className="metric-label">Checks passing</p>
              <p className="metric-value">
                {visibleCount}/{statusRows.length}
              </p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Focus checks ready</p>
              <p className="metric-value">
                {focusedReadyCount}/{meta.focusRows.length}
              </p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Last update</p>
              <p className="metric-value text-base">{lastUpdatedAt ? "Loaded" : "Not loaded"}</p>
            </div>
          </div>

          <div className="monitor-grid">
            {statusRows.map((row) => {
              const isFocusRow = meta.focusRows.includes(row.id);
              return (
                <div key={row.id} className={`monitor-row ${isFocusRow ? "monitor-row-focus" : ""}`}>
                  <span className="font-medium">{row.label}</span>
                  <span className={`status-pill ${row.value ? "status-ok" : "status-off"}`}>
                    {row.value ? "Present" : "Missing"}
                  </span>
                </div>
              );
            })}
          </div>

          <details className="surface-card-soft p-3 sm:p-3.5">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Show derived addresses</summary>
            <div className="address-stack pt-3">
              <div className="mini-address">Protocol config: {snapshot.derived.configAddress || "n/a"}</div>
              <div className="mini-address">Pool: {snapshot.derived.poolAddress || "n/a"}</div>
              <div className="mini-address">Pool terms: {snapshot.derived.poolTermsAddress || "n/a"}</div>
              <div className="mini-address">Pool asset vault: {snapshot.derived.poolAssetVaultAddress || "n/a"}</div>
              <div className="mini-address">Oracle entry: {snapshot.derived.oracleEntryAddress || "n/a"}</div>
              <div className="mini-address">Pool oracle: {snapshot.derived.poolOracleAddress || "n/a"}</div>
              <div className="mini-address">Oracle policy: {snapshot.derived.poolOraclePolicyAddress || "n/a"}</div>
              <div className="mini-address">Oracle stake: {snapshot.derived.oracleStakeAddress || "n/a"}</div>
              <div className="mini-address">Invite issuer: {snapshot.derived.inviteIssuerAddress || "n/a"}</div>
              <div className="mini-address">Membership: {snapshot.derived.membershipAddress || "n/a"}</div>
              <div className="mini-address">Claim delegate: {snapshot.derived.claimDelegateAddress || "n/a"}</div>
              <div className="mini-address">Schema: {snapshot.derived.schemaAddress || "n/a"}</div>
              <div className="mini-address">Rule: {snapshot.derived.ruleAddress || "n/a"}</div>
              <div className="mini-address">Coverage policy: {snapshot.derived.coveragePolicyAddress || "n/a"}</div>
              <div className="mini-address">Coverage NFT: {snapshot.derived.coverageNftAddress || "n/a"}</div>
              <div className="mini-address">Premium ledger: {snapshot.derived.premiumLedgerAddress || "n/a"}</div>
            </div>
          </details>
        </>
      ) : (
        <p className="hero-copy">Load a snapshot to inspect current on-chain protocol registry details.</p>
      )}
    </section>
  );
}
