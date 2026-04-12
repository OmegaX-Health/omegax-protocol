// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  ORACLE_TYPE_OTHER,
  buildClaimOracleTx,
  fetchProtocolReadiness,
  listOraclesWithProfiles,
  listPoolOracleApprovals,
  listPoolOraclePolicies,
  listPools,
  listSchemas,
  type OracleWithProfileSummary,
  type PoolOracleApprovalSummary,
  type PoolOraclePolicySummary,
  type ProtocolReadiness,
  type SchemaSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import { fetchSchemaMetadata, parseSchemaOutcomes } from "@/lib/schema-metadata";

type PoolRef = {
  address: string;
  poolId: string;
  organizationRef: string;
};

type SchemaPreviewStatus =
  | "loading"
  | "ready"
  | "metadata_unreachable"
  | "metadata_invalid"
  | "missing_uri"
  | "unknown_schema";

type SchemaPreview = {
  status: SchemaPreviewStatus;
  outcomeCount: number;
  templateCount: number;
  sampleOutcomeIds: string[];
  warning: string | null;
};

function shortAddress(value: string): string {
  if (!value) return value;
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalize(value: string): string {
  return value.trim();
}

function isPublicKey(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(normalize(value));
    return true;
  } catch {
    return false;
  }
}

function isHex32(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(normalize(value).replace(/^0x/, ""));
}

function normalizeHex32(value: string): string {
  return normalize(value).toLowerCase().replace(/^0x/, "");
}

function oracleTypeLabel(type: number): string {
  switch (type) {
    case 0:
      return "Lab";
    case 1:
      return "Hospital / Clinic";
    case 2:
      return "Health App";
    case 3:
      return "Wearable / Data Provider";
    default:
      return `Type ${type ?? ORACLE_TYPE_OTHER}`;
  }
}

function readyBadge(ready: boolean) {
  return ready
    ? "text-green-400 bg-green-500/10 border-green-500/30"
    : "text-red-400 bg-red-500/10 border-red-500/30";
}

function previewStatusLabel(status: SchemaPreviewStatus): string {
  switch (status) {
    case "loading":
      return "Loading preview";
    case "ready":
      return "Metadata ready";
    case "metadata_unreachable":
      return "Metadata private / unreachable";
    case "metadata_invalid":
      return "Metadata invalid";
    case "missing_uri":
      return "Missing metadata URI";
    case "unknown_schema":
      return "Schema hash unresolved";
    default:
      return "Preview unavailable";
  }
}

export function OracleRegistryVerificationPanel() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const searchParams = useSearchParams();

  const [registrySearch, setRegistrySearch] = useState("");
  const [oracles, setOracles] = useState<OracleWithProfileSummary[]>([]);
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [pools, setPools] = useState<PoolRef[]>([]);
  const [approvals, setApprovals] = useState<PoolOracleApprovalSummary[]>([]);
  const [policies, setPolicies] = useState<PoolOraclePolicySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOracleAddress, setSelectedOracleAddress] = useState("");
  const [schemaPreviewByHash, setSchemaPreviewByHash] = useState<Record<string, SchemaPreview>>({});

  const [verificationOracleAddress, setVerificationOracleAddress] = useState("");
  const [verificationPoolAddress, setVerificationPoolAddress] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProtocolReadiness | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<number | null>(null);

  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  const claimOracleFromQuery = normalize(searchParams.get("claim") || "");

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextOracles, nextSchemas, nextPools, nextApprovals, nextPolicies] = await Promise.all([
        listOraclesWithProfiles({ connection, activeOnly: false }),
        listSchemas({ connection, verifiedOnly: false }),
        listPools({ connection }),
        listPoolOracleApprovals({ connection, activeOnly: false }),
        listPoolOraclePolicies({ connection }),
      ]);
      setOracles(nextOracles);
      setSchemas(nextSchemas);
      setPools(
        nextPools.map((row) => ({
          address: row.address,
          poolId: row.poolId,
          organizationRef: row.organizationRef,
        })),
      );
      setApprovals(nextApprovals);
      setPolicies(nextPolicies);
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load oracle registry data.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const filteredRegistry = useMemo(() => {
    const query = normalize(registrySearch).toLowerCase();
    return oracles
      .filter((row) => {
        if (!query) return true;
        const profile = row.profile;
        return (
          row.oracle.toLowerCase().includes(query)
          || row.address.toLowerCase().includes(query)
          || (profile?.displayName || "").toLowerCase().includes(query)
          || (profile?.legalName || "").toLowerCase().includes(query)
          || (profile?.websiteUrl || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aName = normalize(a.profile?.displayName || "");
        const bName = normalize(b.profile?.displayName || "");
        if (aName && bName) return aName.localeCompare(bName) || a.oracle.localeCompare(b.oracle);
        if (aName) return -1;
        if (bName) return 1;
        return a.oracle.localeCompare(b.oracle);
      });
  }, [oracles, registrySearch]);

  useEffect(() => {
    if (!filteredRegistry.length) {
      setSelectedOracleAddress("");
      return;
    }
    if (!filteredRegistry.some((row) => row.oracle === selectedOracleAddress)) {
      setSelectedOracleAddress(filteredRegistry[0].oracle);
    }
  }, [filteredRegistry, selectedOracleAddress]);

  const selectedOracle = useMemo(
    () => filteredRegistry.find((row) => row.oracle === selectedOracleAddress) ?? null,
    [filteredRegistry, selectedOracleAddress],
  );

  const schemaByHash = useMemo(() => {
    const map = new Map<string, SchemaSummary>();
    for (const schema of schemas) {
      map.set(normalizeHex32(schema.schemaKeyHashHex), schema);
    }
    return map;
  }, [schemas]);

  const selectedOracleSupportedHashes = selectedOracle?.profile?.supportedSchemaKeyHashesHex ?? [];

  const loadSchemaPreview = useCallback(async (schemaHashHex: string) => {
    const normalizedHash = normalizeHex32(schemaHashHex);
    if (schemaPreviewByHash[normalizedHash]?.status) return;

    const matchedSchema = schemaByHash.get(normalizedHash);
    if (!matchedSchema) {
      setSchemaPreviewByHash((current) => ({
        ...current,
        [normalizedHash]: {
          status: "unknown_schema",
          outcomeCount: 0,
          templateCount: 0,
          sampleOutcomeIds: [],
          warning: "No on-chain schema entry is currently indexed for this hash.",
        },
      }));
      return;
    }
    if (!matchedSchema.metadataUri) {
      setSchemaPreviewByHash((current) => ({
        ...current,
        [normalizedHash]: {
          status: "missing_uri",
          outcomeCount: 0,
          templateCount: 0,
          sampleOutcomeIds: [],
          warning: "Schema metadata URI is missing.",
        },
      }));
      return;
    }

    setSchemaPreviewByHash((current) => ({
      ...current,
      [normalizedHash]: {
        status: "loading",
        outcomeCount: 0,
        templateCount: 0,
        sampleOutcomeIds: [],
        warning: null,
      },
    }));

    const fetched = await fetchSchemaMetadata(matchedSchema.metadataUri);
    const parsed = parseSchemaOutcomes(fetched.metadata);

    const fetchError = fetched.error;
    if (fetchError) {
      const status: SchemaPreviewStatus =
        fetchError.code === "fetch_failed" || fetchError.code === "http_error"
          ? "metadata_unreachable"
          : "metadata_invalid";
      setSchemaPreviewByHash((current) => ({
        ...current,
        [normalizedHash]: {
          status,
          outcomeCount: parsed.outcomes.length,
          templateCount: parsed.outcomeTemplates.length,
          sampleOutcomeIds: parsed.outcomes.slice(0, 5).map((outcome) => outcome.id),
          warning: fetchError.message || parsed.warnings[0] || null,
        },
      }));
      return;
    }

    setSchemaPreviewByHash((current) => ({
      ...current,
      [normalizedHash]: {
        status: "ready",
        outcomeCount: parsed.outcomes.length,
        templateCount: parsed.outcomeTemplates.length,
        sampleOutcomeIds: parsed.outcomes.slice(0, 5).map((outcome) => outcome.id),
        warning: parsed.warnings[0] || null,
      },
    }));
  }, [schemaByHash, schemaPreviewByHash]);

  const selectedOracleSupportedSchemas = useMemo(() => {
    return selectedOracleSupportedHashes.map((hash) => {
      const normalizedHash = normalizeHex32(hash);
      return {
        hash: normalizedHash,
        schema: schemaByHash.get(normalizedHash) ?? null,
        preview: schemaPreviewByHash[normalizedHash] ?? null,
      };
    });
  }, [schemaByHash, schemaPreviewByHash, selectedOracleSupportedHashes]);

  useEffect(() => {
    for (const hash of selectedOracleSupportedHashes.map((value) => normalizeHex32(value)).filter((value) => isHex32(value))) {
      if (!schemaPreviewByHash[hash]) {
        void loadSchemaPreview(hash);
      }
    }
  }, [loadSchemaPreview, schemaPreviewByHash, selectedOracleSupportedHashes]);

  const poolByAddress = useMemo(() => {
    const map = new Map<string, PoolRef>();
    for (const pool of pools) {
      map.set(pool.address, pool);
    }
    return map;
  }, [pools]);

  const policiesByPool = useMemo(() => {
    const set = new Set<string>();
    for (const policy of policies) {
      set.add(policy.liquidityPool);
    }
    return set;
  }, [policies]);

  const verificationApprovals = useMemo(
    () => approvals.filter((row) => row.oracle === verificationOracleAddress),
    [approvals, verificationOracleAddress],
  );

  useEffect(() => {
    if (!oracles.length) {
      setVerificationOracleAddress("");
      return;
    }
    if (!verificationOracleAddress || !oracles.some((row) => row.oracle === verificationOracleAddress)) {
      const claimed = oracles.find((row) => row.profile?.claimed);
      setVerificationOracleAddress((claimed || oracles[0]).oracle);
    }
  }, [oracles, verificationOracleAddress]);

  useEffect(() => {
    if (!verificationApprovals.length) {
      setVerificationPoolAddress("");
      setSnapshot(null);
      setSnapshotAt(null);
      return;
    }
    if (!verificationApprovals.some((row) => row.liquidityPool === verificationPoolAddress)) {
      setVerificationPoolAddress(verificationApprovals[0].liquidityPool);
      setSnapshot(null);
      setSnapshotAt(null);
    }
  }, [verificationApprovals, verificationPoolAddress]);

  const copyAddress = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Ignore clipboard permission failures.
    }
  }, []);

  const claimOracle = useCallback(async (oracleAddress: string) => {
    if (!publicKey || !sendTransaction || !connected) {
      setClaimError("Connect the oracle signing wallet to claim activation.");
      return;
    }
    const normalizedOracle = normalize(oracleAddress);
    if (!isPublicKey(normalizedOracle)) {
      setClaimError("Claim oracle pubkey is invalid.");
      return;
    }
    if (publicKey.toBase58() !== normalizedOracle) {
      setClaimError("Connected wallet must match the oracle signing pubkey for claim.");
      return;
    }

    setClaimBusy(true);
    setClaimError(null);
    setClaimSuccess(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildClaimOracleTx({
        oracle: publicKey,
        recentBlockhash: blockhash,
      });
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: "Claim oracle activation",
      });
      if (!result.ok) {
        setClaimError(result.error);
        return;
      }
      setClaimSuccess(result.message);
      await refreshData();
    } finally {
      setClaimBusy(false);
    }
  }, [connected, connection, publicKey, refreshData, sendTransaction]);

  const runVerification = useCallback(async () => {
    if (!verificationOracleAddress || !verificationPoolAddress) return;
    setVerificationBusy(true);
    setVerificationError(null);
    try {
      const next = await fetchProtocolReadiness({
        connection,
        poolAddress: verificationPoolAddress,
        oracleAddress: verificationOracleAddress,
        stakerAddress: verificationOracleAddress,
      });
      setSnapshot(next);
      setSnapshotAt(Date.now());
    } catch (cause) {
      setVerificationError(
        formatRpcError(cause, {
          fallback: "Failed to run verification readiness check.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
      setSnapshot(null);
      setSnapshotAt(null);
    } finally {
      setVerificationBusy(false);
    }
  }, [connection, verificationOracleAddress, verificationPoolAddress]);

  const readinessRows = snapshot
    ? [
      { label: "Oracle registry entry", value: snapshot.oracleRegistered },
      { label: "Oracle profile", value: snapshot.oracleProfileExists },
      { label: "Pool oracle approval", value: snapshot.poolOracleApproved },
      { label: "Pool oracle policy", value: snapshot.poolOraclePolicyConfigured },
      { label: "Oracle stake position", value: snapshot.oracleStakePositionExists },
    ]
    : [];

  return (
    <div className="space-y-5">
      <section className="surface-card space-y-4">
        <div className="space-y-1">
          <p className="metric-label">Professional Oracle Registry</p>
          <p className="field-help">
            Register labs, hospitals, and health apps with structured on-chain profiles, then claim activation from the oracle signing key.
          </p>
        </div>

        {claimOracleFromQuery ? (
          <div className="rounded-xl border border-[var(--border)]/55 bg-[color-mix(in oklab,var(--surface-soft)_75%,transparent)] p-3 space-y-2">
            <p className="metric-label">Claim Oracle Activation</p>
            <p className="field-help">
              Claim requested for oracle <span className="font-mono">{claimOracleFromQuery}</span>. Connect this exact key wallet to activate.
            </p>
            <button
              type="button"
              className="action-button inline-flex items-center gap-1.5 text-sm"
              onClick={() => void claimOracle(claimOracleFromQuery)}
              disabled={claimBusy}
            >
              {claimBusy ? "Claiming..." : "Claim oracle now"}
            </button>
            {claimError ? <p className="field-error">{claimError}</p> : null}
            {claimSuccess ? <p className="text-sm text-[var(--success)]">{claimSuccess}</p> : null}
          </div>
        ) : null}

        {error ? <p className="field-error">{error}</p> : null}
      </section>

      <section className="surface-card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              className="field-input w-full pl-9 text-sm"
              placeholder="Search by name, website, or oracle key"
              value={registrySearch}
              onChange={(event) => setRegistrySearch(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/oracles/register" className="action-button inline-flex items-center gap-1.5 text-sm">
              Register oracle
            </Link>
            <button
              type="button"
              className="secondary-button inline-flex items-center gap-1.5 text-sm"
              onClick={() => void refreshData()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing..." : "Refresh registry"}
            </button>
          </div>
        </div>

        {!loading && filteredRegistry.length === 0 ? (
          <p className="field-help">No oracle profiles match your search.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRegistry.map((row) => {
              const profile = row.profile;
              const isSelected = row.oracle === selectedOracleAddress;
              const oracleApprovals = approvals.filter((entry) => entry.oracle === row.oracle);
              const policiesConfigured = oracleApprovals.filter((entry) => policiesByPool.has(entry.liquidityPool)).length;
              return (
                <button
                  key={row.address}
                  type="button"
                  onClick={() => setSelectedOracleAddress(row.oracle)}
                  className={`surface-card-soft text-left border transition-all ${
                    isSelected
                      ? "border-[var(--primary)] shadow-lg shadow-[var(--primary)]/10"
                      : "border-[var(--border)]/45 hover:border-[var(--primary)]/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--muted-foreground)]">{profile?.displayName || "Unlabeled oracle"}</p>
                      <p className="font-semibold truncate">{shortAddress(row.oracle)}</p>
                      <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                        {profile ? oracleTypeLabel(profile.oracleType) : "Profile pending"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full border ${readyBadge(Boolean(profile?.claimed))}`}>
                        {profile?.claimed ? "Claimed" : "Unclaimed"}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded-full border ${readyBadge(row.active)}`}>
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5 text-xs text-[var(--muted-foreground)]">
                    <p>Approved pools: {oracleApprovals.length}</p>
                    <p>Policies configured: {policiesConfigured}</p>
                    <p>Supported schemas: {profile?.supportedSchemaCount ?? 0}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedOracle ? (
        <section className="surface-card space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="metric-label">Oracle Detail</p>
              <p className="field-help">
                {selectedOracle.profile?.displayName || "Unlabeled oracle"} • {oracleTypeLabel(selectedOracle.profile?.oracleType ?? ORACLE_TYPE_OTHER)}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedOracle.profile ? (
                <Link
                  href={`/oracles/${encodeURIComponent(selectedOracle.oracle)}/update`}
                  className="secondary-button text-sm"
                >
                  Edit profile
                </Link>
              ) : null}
              <button
                type="button"
                className="secondary-button inline-flex items-center gap-1.5 text-sm"
                onClick={() => void copyAddress(selectedOracle.oracle)}
              >
                <ClipboardCopy className="h-3.5 w-3.5" /> Copy oracle key
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)]/45 p-3">
              <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-[0.08em]">Oracle key</p>
              <p className="font-mono text-sm mt-1 break-all">{shortAddress(selectedOracle.oracle)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)]/45 p-3">
              <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-[0.08em]">Website</p>
              <p className="text-sm mt-1 truncate">{selectedOracle.profile?.websiteUrl || "—"}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)]/45 p-3">
              <p className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-[0.08em]">Claim status</p>
              <p className="text-sm mt-1">
                {selectedOracle.profile?.claimed ? "Claimed" : "Pending claim"}
                {selectedOracle.active ? " • Active" : " • Inactive"}
              </p>
            </div>
          </div>

          {selectedOracle.profile ? (
            <details className="rounded-xl border border-[var(--border)]/45 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Profile fields</summary>
              <div className="mt-3 grid gap-2 text-sm">
                <p><span className="text-[var(--muted-foreground)]">Admin:</span> <span className="font-mono break-all">{shortAddress(selectedOracle.profile.admin)}</span></p>
                <p><span className="text-[var(--muted-foreground)]">Legal name:</span> {selectedOracle.profile.legalName || "—"}</p>
                <p><span className="text-[var(--muted-foreground)]">App URL:</span> {selectedOracle.profile.appUrl || "—"}</p>
                <p><span className="text-[var(--muted-foreground)]">Logo URI:</span> {selectedOracle.profile.logoUri || "—"}</p>
                <p><span className="text-[var(--muted-foreground)]">Webhook:</span> {selectedOracle.profile.webhookUrl || "—"}</p>
                <p><span className="text-[var(--muted-foreground)]">Supported schemas:</span> {selectedOracle.profile.supportedSchemaCount}</p>
                {selectedOracleSupportedSchemas.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-[var(--border)]/45 bg-[color-mix(in oklab,var(--surface-soft)_80%,transparent)] p-2.5">
                    {selectedOracleSupportedSchemas.map((entry) => (
                      <div key={entry.hash} className="space-y-1 rounded-lg border border-[var(--border)]/40 p-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`status-pill ${entry.preview?.status === "ready" ? "status-ok" : "status-off"}`}>
                            {previewStatusLabel(entry.preview?.status || "unknown_schema")}
                          </span>
                          {entry.preview ? (
                            <span className="field-help">
                              {entry.preview.outcomeCount} outcomes • {entry.preview.templateCount} templates
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium">
                          {entry.schema ? `${entry.schema.schemaKey} v${entry.schema.version}` : "Unresolved schema hash"}
                        </p>
                        <p className="text-[11px] text-[var(--muted-foreground)] font-mono break-all">
                          {entry.hash}
                        </p>
                        {entry.preview?.sampleOutcomeIds.length ? (
                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            Sample outcomes: {entry.preview.sampleOutcomeIds.join(", ")}
                          </p>
                        ) : null}
                        {entry.preview?.warning ? (
                          <p className="text-[11px] text-[var(--muted-foreground)]">{entry.preview.warning}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="rounded-xl border border-[var(--border)]/45 bg-[color-mix(in oklab,var(--surface-soft)_80%,transparent)] p-2 text-xs font-mono break-all">
                  {selectedOracle.profile.supportedSchemaKeyHashesHex.join("\n") || "none"}
                </div>
              </div>
            </details>
          ) : (
            <div className="space-y-2">
              <p className="field-help">This oracle has not published a structured profile yet. Start from the dedicated register wizard to unlock managed capabilities.</p>
              <Link href="/oracles/register" className="secondary-button inline-flex w-fit text-sm">
                Register oracle
              </Link>
            </div>
          )}
        </section>
      ) : null}

      <details className="surface-card">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
          Verification tools
        </summary>
        <div className="mt-4 space-y-4">
          <p className="field-help">Run oracle and pool readiness checks with human labels and direct fix links.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="field-help">Oracle</span>
              <select
                className="field-input w-full"
                value={verificationOracleAddress}
                onChange={(event) => setVerificationOracleAddress(event.target.value)}
              >
                {oracles.map((oracle) => (
                  <option key={oracle.oracle} value={oracle.oracle}>
                    {(oracle.profile?.displayName || shortAddress(oracle.oracle))} ({oracle.profile?.claimed ? "claimed" : "unclaimed"})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="field-help">Pool</span>
              <select
                className="field-input w-full"
                value={verificationPoolAddress}
                onChange={(event) => setVerificationPoolAddress(event.target.value)}
              >
                {verificationApprovals.map((approval) => {
                  const pool = poolByAddress.get(approval.liquidityPool);
                  return (
                    <option key={approval.address} value={approval.liquidityPool}>
                      {pool?.poolId || shortAddress(approval.liquidityPool)}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="secondary-button inline-flex items-center gap-1.5 text-sm"
              onClick={() => void runVerification()}
              disabled={!verificationOracleAddress || !verificationPoolAddress || verificationBusy}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${verificationBusy ? "animate-spin" : ""}`} />
              {verificationBusy ? "Running..." : "Run readiness check"}
            </button>
            {verificationPoolAddress ? (
              <Link href={buildCanonicalPoolHref(verificationPoolAddress, { section: "oracles", panel: "staking" })} className="secondary-button inline-flex items-center gap-1.5 text-sm">
                Open oracle route <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>

          {verificationError ? <p className="field-error">{verificationError}</p> : null}

          {snapshot ? (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {readinessRows.map((row) => (
                  <div key={row.label} className={`rounded-xl border p-2 ${readyBadge(row.value)}`}>
                    <p className="text-[11px] uppercase tracking-[0.08em]">{row.label}</p>
                    <p className="text-sm font-semibold mt-1 inline-flex items-center gap-1">
                      {row.value ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {row.value ? "Ready" : "Missing"}
                    </p>
                  </div>
                ))}
              </div>

              {!snapshot.poolOracleApproved || !snapshot.poolOraclePolicyConfigured ? (
                <p className="field-help">
                  Missing pool oracle configuration detected. Open the pool workspace and configure oracle approvals and quorum policy.
                </p>
              ) : null}

              {snapshotAt ? (
                <p className="text-[11px] text-[var(--muted-foreground)]">Snapshot: {new Date(snapshotAt).toLocaleString()}</p>
              ) : null}

              <details className="rounded-xl border border-[var(--border)]/45 p-3">
                <summary className="cursor-pointer text-sm font-semibold">Derived addresses</summary>
                <div className="mt-2 font-mono text-xs break-all space-y-1 text-[var(--muted-foreground)]">
                  <p>Oracle entry: {snapshot.derived.oracleEntryAddress || "—"}</p>
                  <p>Oracle profile: {snapshot.derived.oracleProfileAddress || "—"}</p>
                  <p>Pool oracle approval: {snapshot.derived.poolOracleAddress || "—"}</p>
                  <p>Pool oracle policy: {snapshot.derived.poolOraclePolicyAddress || "—"}</p>
                </div>
              </details>
            </div>
          ) : (
            <p className="field-help">No readiness snapshot yet. Select an oracle and pool, then run check.</p>
          )}

          {!verificationApprovals.length && verificationOracleAddress ? (
            <p className="field-help">
              Selected oracle has no pool approvals yet. Configure pool approval first.
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
