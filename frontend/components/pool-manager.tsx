// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Check, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

import { AdvancedOverride } from "@/components/advanced-override";
import { SearchableSelect } from "@/components/searchable-select";
import { cn } from "@/lib/cn";
import { formatRpcError } from "@/lib/rpc-errors";
import {
  buildCreatePoolV2Tx,
  buildCreatePolicySeriesTx,
  buildEnrollMemberTokenGateTx,
  buildFundPoolSolTx,
  buildSetPoolOraclePolicyTx,
  buildSetPoolOracleTx,
  buildSetPolicySeriesOutcomeRuleTx,
  defaultPoolAddressFromEnv,
  defaultTokenGateMintFromEnv,
  derivePoolPda,
  derivePolicySeriesPda,
  fetchProtocolReadiness,
  getProgramId,
  hashStringTo32Hex,
  isPoolIdSeedSafe,
  listOracles,
  listPoolRules,
  listPools,
  listSchemas,
  PLAN_MODE_REWARD,
  POLICY_SERIES_STATUS_ACTIVE,
  poolIdByteLength,
  SPONSOR_MODE_DIRECT,
  toExplorerLink,
  type OracleSummary,
  type PoolSummary,
  type ProtocolReadiness,
  type RuleSummary,
  type SchemaSummary,
} from "@/lib/protocol";
import {
  fetchSchemaMetadata,
  parseSchemaOutcomes,
  type SchemaMetadataFetchErrorCode,
  type SchemaOutcomeOption,
} from "@/lib/schema-metadata";

type PoolManagerProps = {
  initialPoolId?: string;
};

type ActionLog = {
  id: string;
  action: string;
  message: string;
  signature?: string;
  at: number;
};

type WorkflowStepId =
  | "step-create-pool"
  | "step-configure-policy"
  | "step-fund-pool";

type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  done: boolean;
  blockingReason: string | null;
};

type PlanType = "rewards" | "insurance" | "hybrid";
type SchemaMetadataIssueCode = SchemaMetadataFetchErrorCode | "missing_uri" | "empty_outcomes" | null;

const ZERO_PUBKEY = "11111111111111111111111111111111";
const REALMS_CLUSTER =
  process.env.NEXT_PUBLIC_REALMS_CLUSTER?.trim() || process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim() || "devnet";
const REALM_ID = process.env.NEXT_PUBLIC_GOVERNANCE_REALM?.trim() || "";
const MAX_RULES_PER_BATCH = 24;
const STANDARD_SCHEMA_KEY =
  process.env.NEXT_PUBLIC_STANDARD_SCHEMA_KEY?.trim() || "omegax.standard.health_outcomes";
const LOCAL_STANDARD_SCHEMA_URL = "/schemas/health_outcomes.json";

const DEFAULT_READINESS: ProtocolReadiness = {
  configV2Initialized: false,
  poolExists: false,
  poolTermsConfigured: false,
  poolAssetVaultConfigured: false,
  oracleRegistered: false,
  oracleProfileExists: false,
  poolOracleApproved: false,
  poolOraclePolicyConfigured: false,
  oracleStakePositionExists: false,
  inviteIssuerRegistered: false,
  memberEnrolled: false,
  claimDelegateConfigured: false,
  schemaRegistered: false,
  ruleRegistered: false,
  coveragePolicyExists: false,
  coveragePolicyNftExists: false,
  premiumLedgerTracked: false,
  derived: {
    configV2Address: "",
    poolAddress: null,
    poolTermsAddress: null,
    poolAssetVaultAddress: null,
    oracleEntryAddress: null,
    oracleProfileAddress: null,
    poolOracleAddress: null,
    poolOraclePolicyAddress: null,
    oracleStakeAddress: null,
    inviteIssuerAddress: null,
    membershipAddress: null,
    claimDelegateAddress: null,
    schemaAddress: null,
    ruleAddress: null,
    coveragePolicyAddress: null,
    coverageNftAddress: null,
    premiumLedgerAddress: null,
  },
};

function normalize(value: string): string {
  return value.trim();
}

function asInt(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBigInt(value: string, fallback = 0n): bigint {
  try {
    return BigInt(value.trim());
  } catch {
    return fallback;
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function firstBlockingReason(reasons: Array<string | null>): string | null {
  for (const reason of reasons) {
    if (reason) return reason;
  }
  return null;
}

function isPublicKey(value: string): boolean {
  try {
    new PublicKey(value.trim());
    return true;
  } catch {
    return false;
  }
}

async function resolveHex32(rawHex: string, fallbackSeed: string, label: string): Promise<string> {
  const normalized = rawHex.trim().toLowerCase().replace(/^0x/, "");
  if (normalized) {
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error(`${label} must be 32-byte hex (64 chars).`);
    }
    return normalized;
  }
  if (!fallbackSeed.trim()) {
    throw new Error(`${label} is required.`);
  }
  return hashStringTo32Hex(fallbackSeed.trim());
}

function toBytes32(hex32: string): Uint8Array {
  const normalized = hex32.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Expected 32-byte hex.");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function defaultPolicySeriesSeed(poolSeed: string): string {
  return `${normalize(poolSeed)}:reward:series`;
}

function realmsProposalLink(): string {
  if (REALM_ID && REALM_ID !== ZERO_PUBKEY) {
    return `https://app.realms.today/dao/${REALM_ID}?cluster=${encodeURIComponent(REALMS_CLUSTER)}`;
  }
  return `https://app.realms.today/?cluster=${encodeURIComponent(REALMS_CLUSTER)}`;
}

function toPoolOptions(rows: PoolSummary[]) {
  return rows.map((row) => ({
    value: row.address,
    label: `${row.poolId} (${shortAddress(row.address)})`,
    hint: `Org: ${row.organizationRef} | Authority: ${shortAddress(row.authority)}`,
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
    label: `${row.schemaKey} v${row.version}${row.verified ? "" : " (unverified)"}`,
    hint: `${shortAddress(row.address)} | ${row.metadataUri || "No metadata URI"}`,
  }));
}

function toRuleOptions(rows: RuleSummary[]) {
  return rows.map((row) => ({
    value: row.address,
    label: `${row.ruleId}${row.enabled ? "" : " (disabled)"}`,
    hint: `${shortAddress(row.address)} | ${row.schemaKey}`,
  }));
}

function schemaMetadataStatus(issue: SchemaMetadataIssueCode, warningsCount: number): string {
  if (!issue) {
    return warningsCount > 0 ? "Loaded with warnings" : "Loaded";
  }
  switch (issue) {
    case "missing_uri":
      return "Missing metadata URL";
    case "fetch_failed":
      return "Metadata private / unreachable";
    case "http_error":
      return "Metadata URL error";
    case "invalid_json":
      return "Invalid metadata JSON";
    case "non_json_content_type":
      return "Metadata is not JSON";
    case "invalid_uri":
      return "Invalid metadata URL";
    case "unsupported_protocol":
      return "Unsupported metadata URL protocol";
    case "empty_outcomes":
      return "No outcomes in metadata";
    default:
      return "Metadata unavailable";
  }
}

function schemaMetadataHelp(issue: SchemaMetadataIssueCode): string | null {
  switch (issue) {
    case null:
      return null;
    case "missing_uri":
      return "This schema has no metadata URL. Add one in governance, or use raw Rule ID mode for now.";
    case "fetch_failed":
      return "Metadata could not be reached from this app (often private or blocked). Use raw Rule ID mode or publish a public JSON endpoint.";
    case "http_error":
      return "Metadata endpoint returned an HTTP error. Verify the URL and access policy.";
    case "invalid_json":
      return "Metadata endpoint returned invalid JSON. Fix the payload format to enable outcome selection.";
    case "non_json_content_type":
      return "Metadata endpoint did not return JSON (for example HTML). Point to a raw JSON URL.";
    case "invalid_uri":
      return "Schema metadata URL is invalid.";
    case "unsupported_protocol":
      return "Schema metadata URL must use http(s) or ipfs://.";
    case "empty_outcomes":
      return "Metadata loaded, but no valid outcomes were parsed. Use raw Rule ID mode or update schema metadata.";
    default:
      return null;
  }
}

export function PoolManager({ initialPoolId }: PoolManagerProps) {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();

  const [advancedMode, setAdvancedMode] = useState(false);
  const [openStepId, setOpenStepId] = useState<WorkflowStepId>("step-create-pool");
  const [planType, setPlanType] = useState<PlanType>("hybrid");

  const [poolId, setPoolId] = useState(initialPoolId ?? "omegax-wellness-pool");
  const [organizationRef, setOrganizationRef] = useState("Corporate-HR-XYZ");
  const [payoutLamportsPerPass, setPayoutLamportsPerPass] = useState("1000000");
  const [tokenGateMint, setTokenGateMint] = useState(defaultTokenGateMintFromEnv() ?? "");
  const [tokenGateMinBalance, setTokenGateMinBalance] = useState("1");
  const [poolMetadataUri, setPoolMetadataUri] = useState("https://protocol.omegax.health/pools/holder");
  const [termsHashHex, setTermsHashHex] = useState("");
  const [payoutPolicyHashHex, setPayoutPolicyHashHex] = useState("");

  const [quorumM, setQuorumM] = useState("1");
  const [quorumN, setQuorumN] = useState("1");
  const [requireVerifiedSchema, setRequireVerifiedSchema] = useState(true);
  const [allowDelegateClaim, setAllowDelegateClaim] = useState(false);

  const [manualPoolAddress, setManualPoolAddress] = useState(defaultPoolAddressFromEnv() ?? "");
  const [manualOracleAddress, setManualOracleAddress] = useState("");
  const [recentCreatedPoolAddress, setRecentCreatedPoolAddress] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [schemaVersionOverride, setSchemaVersionOverride] = useState("");
  const [ruleHashHex, setRuleHashHex] = useState("");
  const [payoutHashHex, setPayoutHashHex] = useState("");

  const [fundLamports, setFundLamports] = useState("10000000");

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);
  const [readiness, setReadiness] = useState<ProtocolReadiness>(DEFAULT_READINESS);

  const [selectorSearch, setSelectorSearch] = useState({
    pools: "",
    oracles: "",
    schemas: "",
    rules: "",
  });
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorOverrideEnabled, setSelectorOverrideEnabled] = useState(false);

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [oracles, setOracles] = useState<OracleSummary[]>([]);
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [rules, setRules] = useState<RuleSummary[]>([]);

  const [selectedPoolAddress, setSelectedPoolAddress] = useState("");
  const [selectedOracleAddress, setSelectedOracleAddress] = useState("");
  const [selectedOracleAddresses, setSelectedOracleAddresses] = useState<string[]>([]);
  const [selectedSchemaAddress, setSelectedSchemaAddress] = useState("");
  const [selectedRuleAddress, setSelectedRuleAddress] = useState("");

  const [schemaOutcomes, setSchemaOutcomes] = useState<SchemaOutcomeOption[]>([]);
  const [schemaWarnings, setSchemaWarnings] = useState<string[]>([]);
  const [schemaMetadataIssue, setSchemaMetadataIssue] = useState<SchemaMetadataIssueCode>(null);
  const [schemaMetadataStatusText, setSchemaMetadataStatusText] = useState("Not loaded");
  const [selectedOutcomeIds, setSelectedOutcomeIds] = useState<string[]>([]);
  const [outcomeSearch, setOutcomeSearch] = useState("");
  const [outcomeDomainFilter, setOutcomeDomainFilter] = useState("all");
  const [schemaMetadataLoading, setSchemaMetadataLoading] = useState(false);

  const walletAddress = publicKey?.toBase58() ?? "";
  const normalizedPoolId = normalize(poolId);
  const poolIdBytes = poolIdByteLength(normalizedPoolId);
  const insuranceOnlyPlan = planType === "insurance";

  const selectedSchema = useMemo(
    () => schemas.find((row) => row.address === selectedSchemaAddress) ?? null,
    [schemas, selectedSchemaAddress],
  );
  const selectedRule = useMemo(
    () => rules.find((row) => row.address === selectedRuleAddress) ?? null,
    [rules, selectedRuleAddress],
  );
  const selectedOutcomeSet = useMemo(() => new Set(selectedOutcomeIds), [selectedOutcomeIds]);

  const predictedPoolAddress = useMemo(() => {
    if (!publicKey || !normalizedPoolId || !isPoolIdSeedSafe(normalizedPoolId)) return null;
    return derivePoolPda({
      programId: getProgramId(),
      authority: publicKey,
      poolId: normalizedPoolId,
    }).toBase58();
  }, [normalizedPoolId, publicKey]);

  useEffect(() => {
    if (!selectorOverrideEnabled && !selectedPoolAddress && predictedPoolAddress) {
      setSelectedPoolAddress(predictedPoolAddress);
    }
  }, [predictedPoolAddress, selectedPoolAddress, selectorOverrideEnabled]);

  const activePoolAddress = normalize(
    selectorOverrideEnabled ? manualPoolAddress : selectedPoolAddress || manualPoolAddress || predictedPoolAddress || "",
  );
  const activeOracleAddress = normalize(selectorOverrideEnabled ? manualOracleAddress : selectedOracleAddress || manualOracleAddress);
  const selectedOracleCoverageAddresses = useMemo(() => {
    const deduped = new Set(
      (selectorOverrideEnabled
        ? [activeOracleAddress]
        : (selectedOracleAddresses.length > 0 ? selectedOracleAddresses : [selectedOracleAddress]))
        .map((value) => normalize(value))
        .filter(Boolean),
    );
    return Array.from(deduped);
  }, [activeOracleAddress, selectedOracleAddress, selectedOracleAddresses, selectorOverrideEnabled]);
  const oracleSelectionRows = useMemo(() => {
    const query = normalize(selectorSearch.oracles).toLowerCase();
    return oracles.filter((oracle) => {
      if (!query) return true;
      return (
        oracle.oracle.toLowerCase().includes(query)
        || oracle.address.toLowerCase().includes(query)
        || oracle.metadataUri.toLowerCase().includes(query)
      );
    });
  }, [oracles, selectorSearch.oracles]);
  const readinessOracleAddress = selectedOracleCoverageAddresses[0] || activeOracleAddress;

  const appendLog = useCallback((log: Omit<ActionLog, "id" | "at">) => {
    setActionLog((prev) => [{ id: randomId(), at: Date.now(), ...log }, ...prev].slice(0, 40));
  }, []);

  const refreshSelectors = useCallback(async () => {
    setSelectorLoading(true);
    setSelectorError(null);
    try {
      const [nextPools, nextOracles, verifiedSchemas, nextRules] = await Promise.all([
        listPools({ connection, search: selectorSearch.pools || null }),
        listOracles({ connection, search: selectorSearch.oracles || null, activeOnly: false }),
        listSchemas({ connection, search: selectorSearch.schemas || null, verifiedOnly: true }),
        listPoolRules({ connection, poolAddress: activePoolAddress || null, search: selectorSearch.rules || null, enabledOnly: false }),
      ]);
      const nextSchemas = verifiedSchemas.length > 0
        ? verifiedSchemas
        : await listSchemas({ connection, search: selectorSearch.schemas || null, verifiedOnly: false });
      setPools(nextPools);
      setOracles(nextOracles);
      setSchemas(nextSchemas);
      setRules(nextRules);

      if (!selectorOverrideEnabled) {
        if (!selectedPoolAddress && nextPools.length > 0) setSelectedPoolAddress(nextPools[0]!.address);
        if (!selectedOracleAddress && nextOracles.length > 0) setSelectedOracleAddress(nextOracles[0]!.oracle);
        const schemaStillAvailable = nextSchemas.some((row) => row.address === selectedSchemaAddress);
        if (!schemaStillAvailable) {
          const preferred = nextSchemas.find((row) => row.verified) ?? nextSchemas[0];
          setSelectedSchemaAddress(preferred?.address || "");
        }
      }
    } catch (error) {
      setSelectorError(
        formatRpcError(error, {
          fallback: "Failed to load selector data from chain.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setSelectorLoading(false);
    }
  }, [
    activePoolAddress,
    connection,
    selectedOracleAddress,
    selectedPoolAddress,
    selectedSchemaAddress,
    selectorOverrideEnabled,
    selectorSearch.oracles,
    selectorSearch.pools,
    selectorSearch.rules,
    selectorSearch.schemas,
  ]);

  useEffect(() => {
    void refreshSelectors();
  }, [refreshSelectors]);

  useEffect(() => {
    if (selectorOverrideEnabled) return;
    const normalized = normalize(selectedOracleAddress);
    if (!normalized) return;
    setSelectedOracleAddresses((current) => {
      if (current.includes(normalized)) return current;
      return [normalized, ...current];
    });
  }, [selectedOracleAddress, selectorOverrideEnabled]);

  useEffect(() => {
    if (selectorOverrideEnabled) return;
    const available = new Set(oracles.map((oracle) => oracle.oracle));
    setSelectedOracleAddresses((current) => current.filter((address) => available.has(address)));
  }, [oracles, selectorOverrideEnabled]);

  useEffect(() => {
    async function loadSchemaOutcomes() {
      setSchemaOutcomes([]);
      setSchemaWarnings([]);
      setSchemaMetadataIssue(null);
      setSchemaMetadataStatusText("Not loaded");
      setSelectedOutcomeIds([]);
      setOutcomeSearch("");
      setOutcomeDomainFilter("all");

      const localFallbackAllowed =
        !selectedSchema
        || normalize(selectedSchema.schemaKey).toLowerCase() === normalize(STANDARD_SCHEMA_KEY).toLowerCase();

      const loadLocalFallback = async (reason: string): Promise<boolean> => {
        try {
          const response = await fetch(LOCAL_STANDARD_SCHEMA_URL, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`Local schema file responded with HTTP ${response.status}.`);
          }
          const metadata = (await response.json()) as unknown;
          const parsed = parseSchemaOutcomes(metadata);
          const warnings = [reason, ...parsed.warnings].filter(Boolean);
          setSchemaOutcomes(parsed.outcomes);
          setSchemaWarnings(warnings);
          if (parsed.outcomes.length === 0) {
            setSchemaMetadataIssue("empty_outcomes");
            setSchemaMetadataStatusText("Local fallback loaded (no outcomes)");
          } else {
            setSchemaMetadataIssue(null);
            setSchemaMetadataStatusText(parsed.warnings.length > 0 ? "Local fallback loaded (with warnings)" : "Local fallback loaded");
          }
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load local fallback schema.";
          setSchemaWarnings((current) => [...current, message]);
          return false;
        }
      };

      setSchemaMetadataLoading(true);
      try {
        if (!selectedSchema) {
          if (localFallbackAllowed) {
            const loaded = await loadLocalFallback(
              "No on-chain schema selected. Showing local standard schema outcomes.",
            );
            if (loaded) return;
          }
          setSchemaMetadataStatusText("Select schema");
          return;
        }

        if (!selectedSchema.metadataUri) {
          if (localFallbackAllowed) {
            const loaded = await loadLocalFallback(
              "Selected schema has no metadata URI. Showing local standard schema outcomes.",
            );
            if (loaded) return;
          }
          setSchemaMetadataIssue("missing_uri");
          setSchemaMetadataStatusText(schemaMetadataStatus("missing_uri", 0));
          setSchemaWarnings(["Selected schema has no metadata URI; using on-chain schema fields only."]);
          return;
        }

        setSchemaMetadataStatusText("Loading metadata...");
        const fetched = await fetchSchemaMetadata(selectedSchema.metadataUri);
        const parsed = parseSchemaOutcomes(fetched.metadata);
        const warnings = fetched.error ? [fetched.error.message, ...parsed.warnings] : parsed.warnings;

        if (fetched.error) {
          if (localFallbackAllowed) {
            const loaded = await loadLocalFallback(
              `Metadata fetch failed (${fetched.error.code}). Showing local standard schema outcomes.`,
            );
            if (loaded) return;
          }
          setSchemaOutcomes(parsed.outcomes);
          setSchemaWarnings(warnings);
          setSchemaMetadataIssue(fetched.error.code);
          setSchemaMetadataStatusText(schemaMetadataStatus(fetched.error.code, parsed.warnings.length));
          return;
        }

        if (parsed.outcomes.length === 0) {
          if (localFallbackAllowed) {
            const loaded = await loadLocalFallback(
              "Metadata returned no valid outcomes. Showing local standard schema outcomes.",
            );
            if (loaded) return;
          }
          setSchemaOutcomes(parsed.outcomes);
          setSchemaWarnings(warnings);
          setSchemaMetadataIssue("empty_outcomes");
          setSchemaMetadataStatusText(schemaMetadataStatus("empty_outcomes", parsed.warnings.length));
          return;
        }

        setSchemaOutcomes(parsed.outcomes);
        setSchemaWarnings(warnings);
        setSchemaMetadataIssue(null);
        setSchemaMetadataStatusText(schemaMetadataStatus(null, parsed.warnings.length));
      } finally {
        setSchemaMetadataLoading(false);
      }
    }

    void loadSchemaOutcomes();
  }, [selectedSchema]);

  const schemaOutcomeDomains = useMemo(() => {
    const unique = new Set<string>();
    for (const outcome of schemaOutcomes) {
      if (outcome.domain) unique.add(outcome.domain);
    }
    return ["all", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [schemaOutcomes]);

  const filteredSchemaOutcomes = useMemo(() => {
    const needle = normalize(outcomeSearch).toLowerCase();
    return schemaOutcomes.filter((outcome) => {
      if (outcomeDomainFilter !== "all" && normalize(outcome.domain || "") !== normalize(outcomeDomainFilter)) {
        return false;
      }
      if (!needle) return true;
      return [
        outcome.id,
        outcome.label,
        outcome.description || "",
        outcome.metricId || "",
        outcome.domain || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [outcomeDomainFilter, outcomeSearch, schemaOutcomes]);

  const refreshReadiness = useCallback(async () => {
    try {
      const schemaHash = selectedSchema?.schemaKeyHashHex || null;
      const ruleHash = selectedRule?.ruleHashHex || normalize(ruleHashHex) || null;
      const snapshot = await fetchProtocolReadiness({
        connection,
        poolAddress: activePoolAddress || null,
        oracleAddress: readinessOracleAddress || null,
        memberAddress: null,
        schemaKeyHashHex: schemaHash,
        ruleHashHex: ruleHash,
      });
      setReadiness(snapshot);
    } catch {
      // Readiness is used to drive step state; ignore transient read errors in wizard view.
    }
  }, [activePoolAddress, connection, readinessOracleAddress, ruleHashHex, selectedRule, selectedSchema]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  async function signAndConfirm(action: string, tx: Transaction): Promise<string> {
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    appendLog({
      action,
      message: `Confirmed ${shortAddress(signature)}`,
      signature,
    });
    return signature;
  }

  async function runAction(action: string, handler: () => Promise<void>) {
    setBusyAction(action);
    try {
      await handler();
      await Promise.all([refreshReadiness(), refreshSelectors()]);
    } catch (error) {
      appendLog({
        action,
        message: formatRpcError(error, {
          fallback: `${action} failed. Please retry.`,
          rpcEndpoint: connection.rpcEndpoint,
        }),
      });
    } finally {
      setBusyAction(null);
    }
  }

  const toggleOracleCoverageAddress = useCallback((oracleAddress: string) => {
    const normalized = normalize(oracleAddress);
    if (!normalized) return;
    setSelectedOracleAddresses((current) => {
      if (current.includes(normalized)) {
        return current.filter((value) => value !== normalized);
      }
      return [...current, normalized];
    });
  }, []);

  const toggleOutcomeSelection = useCallback((outcomeId: string) => {
    const normalized = normalize(outcomeId);
    if (!normalized) return;
    setSelectedOutcomeIds((current) => {
      if (current.includes(normalized)) {
        return current.filter((value) => value !== normalized);
      }
      return [...current, normalized];
    });
  }, []);

  const normalizedTokenGateMint = normalize(tokenGateMint);
  const hasBusyAction = Boolean(busyAction);

  const governanceSignerReady = connected && !!publicKey;
  const selectedVerifierCount = selectedOracleCoverageAddresses.length;
  const parsedQuorumM = asInt(quorumM, 1);
  const parsedQuorumN = asInt(quorumN, 1);
  const schemaMetadataHelpText = schemaMetadataHelp(schemaMetadataIssue);
  const quorumConfigIssue = useMemo(() => {
    if (selectedVerifierCount === 0) return "Select at least one verifier to set quorum.";
    if (parsedQuorumM <= 0 || parsedQuorumN <= 0) {
      return "Quorum values must both be greater than zero.";
    }
    if (parsedQuorumN > selectedVerifierCount) {
      return `Verification Network size (${parsedQuorumN}) exceeds selected verifiers (${selectedVerifierCount}).`;
    }
    if (parsedQuorumM > parsedQuorumN) {
      return `Minimum confirmations (${parsedQuorumM}) exceed network size (${parsedQuorumN}).`;
    }
    return null;
  }, [parsedQuorumM, parsedQuorumN, selectedVerifierCount]);
  const autoFixQuorum = useCallback(() => {
    if (selectedVerifierCount <= 0) return;
    const nextN = Math.min(Math.max(1, parsedQuorumN), selectedVerifierCount);
    const nextM = Math.min(Math.max(1, parsedQuorumM), nextN);
    setQuorumN(String(nextN));
    setQuorumM(String(nextM));
  }, [parsedQuorumM, parsedQuorumN, selectedVerifierCount]);

  const createPoolBlockingReason = firstBlockingReason([
    connected ? null : "Connect wallet to create pool.",
    governanceSignerReady ? null : "Switch to governance wallet to create pool.",
    normalizedPoolId ? null : "Pool id is required.",
    isPoolIdSeedSafe(normalizedPoolId) ? null : `Pool id exceeds 32 bytes (${poolIdBytes}/32).`,
    asBigInt(payoutLamportsPerPass, 0n) > 0n ? null : "Reward amount must be greater than zero.",
    asBigInt(tokenGateMinBalance, 0n) > 0n ? null : "Token gate minimum balance must be greater than zero.",
    isPublicKey(normalizedTokenGateMint) ? null : "Token gate mint must be a valid public key.",
  ]);

  const explicitRuleId = normalize(ruleId);
  const fallbackRuleId = explicitRuleId || normalize(selectedRule?.ruleId || "");
  const intendedRuleCount = selectedOutcomeIds.length > 0
    ? selectedOutcomeIds.length
    : fallbackRuleId
      ? 1
      : 0;

  const setPolicyBlockingReason = firstBlockingReason([
    connected ? null : "Connect wallet to configure policy.",
    governanceSignerReady ? null : "Switch to governance wallet to configure policy.",
    isPublicKey(activePoolAddress) ? null : "Pool address must be valid.",
    selectedOracleCoverageAddresses.length > 0 ? null : "Select at least one oracle for this plan.",
    selectedOracleCoverageAddresses.every((address) => isPublicKey(address)) ? null : "One or more selected oracle addresses are invalid.",
    asInt(quorumM, 1) > 0 ? null : "Minimum verifier confirmations must be greater than zero.",
    asInt(quorumN, 1) >= asInt(quorumM, 1)
      ? null
      : "Verification Network size must be greater than or equal to minimum confirmations.",
    asInt(quorumN, 1) <= selectedVerifierCount
      ? null
      : `Verification Network size (${asInt(quorumN, 1)}) cannot exceed selected verifier count (${selectedVerifierCount}).`,
    selectedSchema
      ? null
      : "Select a verified schema from chain before setting pool rule.",
    intendedRuleCount > 0
      ? null
      : "Select one or more schema outcomes (or provide a raw rule ID) before configuring rules.",
    intendedRuleCount <= MAX_RULES_PER_BATCH
      ? null
      : `You selected ${intendedRuleCount} outcomes. Configure at most ${MAX_RULES_PER_BATCH} outcomes per submission.`,
  ]);

  const fundPoolBlockingReason = firstBlockingReason([
    connected ? null : "Connect wallet to fund pool.",
    isPublicKey(activePoolAddress) ? null : "Pool address must be valid.",
    asBigInt(fundLamports, 0n) > 0n ? null : "Fund amount must be greater than zero.",
  ]);

  const createPoolDisabled = hasBusyAction || Boolean(createPoolBlockingReason);
  const setPolicyDisabled = hasBusyAction || Boolean(setPolicyBlockingReason);
  const fundPoolDisabled = hasBusyAction || Boolean(fundPoolBlockingReason);

  const onCreatePool = useCallback(async () => {
    await runAction("Create pool", async () => {
      if (!connected || !publicKey) throw new Error("Connect wallet first.");
      const resolvedTermsHash = await resolveHex32(termsHashHex, `${normalizedPoolId}:terms`, "Terms hash");
      const resolvedPolicyHash = await resolveHex32(
        payoutPolicyHashHex,
        `${normalizedPoolId}:payout-policy`,
        "Payout policy hash",
      );
      const blockhash = await connection.getLatestBlockhash("confirmed");
      const { tx, poolAddress } = buildCreatePoolV2Tx({
        authority: publicKey,
        recentBlockhash: blockhash.blockhash,
        poolId: normalizedPoolId,
        organizationRef: normalize(organizationRef),
        payoutLamportsPerPass: asBigInt(payoutLamportsPerPass, 0n),
        membershipMode: 1,
        tokenGateMint: normalizedTokenGateMint,
        tokenGateMinBalance: asBigInt(tokenGateMinBalance, 1n),
        metadataUri: normalize(poolMetadataUri),
        termsHashHex: resolvedTermsHash,
        payoutPolicyHashHex: resolvedPolicyHash,
      });
      await signAndConfirm("Create pool", tx);
      setManualPoolAddress(poolAddress.toBase58());
      setSelectedPoolAddress(poolAddress.toBase58());
      setRecentCreatedPoolAddress(poolAddress.toBase58());
      setTermsHashHex(resolvedTermsHash);
      setPayoutPolicyHashHex(resolvedPolicyHash);
    });
  }, [
    connected,
    connection,
    normalizedPoolId,
    normalizedTokenGateMint,
    organizationRef,
    payoutLamportsPerPass,
    payoutPolicyHashHex,
    poolMetadataUri,
    publicKey,
    termsHashHex,
    tokenGateMinBalance,
  ]);

  const onConfigurePolicyAndRule = useCallback(async () => {
    await runAction("Configure policy + rule", async () => {
      if (!connected || !publicKey) throw new Error("Connect wallet first.");
      if (!isPublicKey(activePoolAddress)) {
        throw new Error("Select a valid pool.");
      }

      const oracleAddresses = selectedOracleCoverageAddresses;
      if (oracleAddresses.length === 0 || oracleAddresses.some((address) => !isPublicKey(address))) {
        throw new Error("Select at least one valid oracle.");
      }
      if (asInt(quorumN, 1) > oracleAddresses.length) {
        throw new Error("Verification Network size cannot exceed selected oracle count.");
      }

      const schemaForRule = selectedSchema;
      if (!schemaForRule) {
        throw new Error("Select a verified schema before setting pool rule.");
      }

      const effectiveSchemaKey = schemaForRule?.schemaKey || "";
      const effectiveSchemaVersion = schemaForRule?.version ?? asInt(schemaVersionOverride, 1);
      const effectiveSchemaKeyHash = schemaForRule?.schemaKeyHashHex || "";

      if (!effectiveSchemaKey || !effectiveSchemaKeyHash || effectiveSchemaVersion <= 0) {
        throw new Error("Resolved schema is invalid. Select a verified schema or use advanced override.");
      }

      const requestedOutcomeIds = Array.from(
        new Set(selectedOutcomeIds.map((outcomeId) => normalize(outcomeId)).filter(Boolean)),
      );
      const explicitRule = normalize(ruleId) || normalize(selectedRule?.ruleId || "");

      if (requestedOutcomeIds.length > MAX_RULES_PER_BATCH) {
        throw new Error(`Configure at most ${MAX_RULES_PER_BATCH} outcomes per submission.`);
      }
      if (requestedOutcomeIds.length === 0 && !explicitRule) {
        throw new Error("Select one or more schema outcomes (or provide a raw rule ID).");
      }

      const ruleSpecs = requestedOutcomeIds.length > 0
        ? requestedOutcomeIds.map((outcomeId) => ({
            outcomeId,
            ruleId: requestedOutcomeIds.length === 1 && explicitRule ? explicitRule : outcomeId,
          }))
        : [{ outcomeId: null as string | null, ruleId: explicitRule }];

      const hasRuleHashOverride = Boolean(normalize(ruleHashHex));
      const hasPayoutHashOverride = Boolean(normalize(payoutHashHex));
      if ((hasRuleHashOverride || hasPayoutHashOverride) && ruleSpecs.length > 1) {
        throw new Error("Rule/payout hash overrides can only be used when submitting one rule at a time.");
      }

      const poolAddress = new PublicKey(activePoolAddress);

      for (const oracleAddress of oracleAddresses) {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const approveOracleTx = buildSetPoolOracleTx({
          authority: publicKey,
          poolAddress,
          oracle: new PublicKey(oracleAddress),
          recentBlockhash: blockhash,
          active: true,
        });
        await signAndConfirm(`Approve oracle ${shortAddress(oracleAddress)}`, approveOracleTx);
      }

      const { blockhash: policyBlockhash } = await connection.getLatestBlockhash("confirmed");
      const policyTx = buildSetPoolOraclePolicyTx({
        authority: publicKey,
        poolAddress,
        recentBlockhash: policyBlockhash,
        quorumM: asInt(quorumM, 1),
        quorumN: asInt(quorumN, 1),
        requireVerifiedSchema,
        allowDelegateClaim,
      });
      await signAndConfirm("Set oracle policy", policyTx);

      const seriesRefHashHex = await hashStringTo32Hex(
        defaultPolicySeriesSeed(normalizedPoolId || activePoolAddress),
      );
      const seriesAddress = derivePolicySeriesPda({
        programId: getProgramId(),
        poolAddress,
        seriesRefHash: toBytes32(seriesRefHashHex),
      });
      if (!(await connection.getAccountInfo(seriesAddress, "confirmed"))) {
        const seriesTx = buildCreatePolicySeriesTx({
          authority: publicKey,
          poolAddress,
          seriesRefHashHex,
          status: POLICY_SERIES_STATUS_ACTIVE,
          planMode: PLAN_MODE_REWARD,
          sponsorMode: SPONSOR_MODE_DIRECT,
          displayName: `${normalize(organizationRef) || normalize(normalizedPoolId) || "OmegaX"} Reward Series`,
          metadataUri: normalize(poolMetadataUri) || "https://protocol.omegax.health/policy-series/default",
          termsHashHex: await resolveHex32(termsHashHex, `${normalizedPoolId || activePoolAddress}:terms`, "Terms hash"),
          durationSecs: 365n * 86_400n,
          premiumDueEverySecs: 30n * 86_400n,
          premiumGraceSecs: 7n * 86_400n,
          premiumAmount: 1n,
          termsVersion: 1,
          mappingVersion: 0,
          recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
        });
        await signAndConfirm("Create reward series", seriesTx);
      }

      let lastRuleId = ruleSpecs[0]?.ruleId || explicitRule || "default-rule";

      for (const spec of ruleSpecs) {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const ruleSeed = `${effectiveSchemaKey}:${spec.ruleId}`;
        const payoutSeed = spec.outcomeId
          ? `${effectiveSchemaKey}:${spec.outcomeId}:payout`
          : `${ruleSeed}:payout`;
        const resolvedRuleHash = await resolveHex32(ruleHashHex, ruleSeed, "Rule hash");
        const resolvedPayoutHash = await resolveHex32(payoutHashHex, payoutSeed, "Payout hash");

        const ruleTx = buildSetPolicySeriesOutcomeRuleTx({
          authority: publicKey,
          poolAddress,
          seriesRefHashHex,
          recentBlockhash: blockhash,
          ruleHashHex: resolvedRuleHash,
          schemaKeyHashHex: effectiveSchemaKeyHash,
          ruleId: spec.ruleId,
          schemaKey: effectiveSchemaKey,
          schemaVersion: effectiveSchemaVersion,
          payoutHashHex: resolvedPayoutHash,
          enabled: true,
        });
        await signAndConfirm(`Set pool rule ${spec.ruleId}`, ruleTx);
        lastRuleId = spec.ruleId;
      }

      setRuleId(lastRuleId);
    });
  }, [
    activePoolAddress,
    allowDelegateClaim,
    connected,
    connection,
    normalizedPoolId,
    organizationRef,
    payoutHashHex,
    poolMetadataUri,
    publicKey,
    quorumM,
    quorumN,
    requireVerifiedSchema,
    ruleHashHex,
    ruleId,
    schemaVersionOverride,
    selectedRule,
    selectedOracleCoverageAddresses,
    selectedOutcomeIds,
    selectedSchema,
    termsHashHex,
  ]);

  const onFundPool = useCallback(async () => {
    await runAction("Fund pool", async () => {
      if (!connected || !publicKey) throw new Error("Connect wallet first.");
      const lamports = asBigInt(fundLamports, 0n);
      const blockhash = await connection.getLatestBlockhash("confirmed");
      const tx = buildFundPoolSolTx({
        funder: publicKey,
        poolAddress: new PublicKey(activePoolAddress),
        recentBlockhash: blockhash.blockhash,
        lamports,
      });
      await signAndConfirm("Fund pool", tx);
    });
  }, [activePoolAddress, connected, connection, fundLamports, publicKey]);

  const fundingCompleted = actionLog.some((entry) => entry.action === "Fund pool" && Boolean(entry.signature));
  const workflowSteps: WorkflowStep[] = [
    {
      id: "step-create-pool",
      label: "Create health plan",
      done: readiness.poolExists,
      blockingReason: createPoolBlockingReason,
    },
    {
      id: "step-configure-policy",
      label: "Define Oracles, Outcomes & Rewards",
      done:
        readiness.schemaRegistered &&
        readiness.poolOracleApproved &&
        readiness.poolOraclePolicyConfigured &&
        readiness.ruleRegistered,
      blockingReason: setPolicyBlockingReason,
    },
    {
      id: "step-fund-pool",
      label: "Fund plan vault",
      done: fundingCompleted,
      blockingReason: fundPoolBlockingReason,
    },
  ];
  const completedSteps = workflowSteps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedSteps / workflowSteps.length) * 100);
  const nextOpenStep = workflowSteps.find((step) => !step.done);
  const nextStepBlocker = nextOpenStep?.blockingReason ?? null;
  const defaultOpenStepId = nextOpenStep?.id ?? workflowSteps[workflowSteps.length - 1]!.id;
  const stepCreatePool = workflowSteps[0]!;
  const stepConfigurePolicy = workflowSteps[1]!;
  const stepFundPool = workflowSteps[2]!;

  const stepSummaries: Record<WorkflowStep["id"], string> = {
    "step-create-pool": "Create the health plan and baseline metadata.",
    "step-configure-policy": "Select the Verification Network, Health Outcomes, and Rewards.",
    "step-fund-pool": "Fund the plan vault so coverage and rewards can settle.",
  };

  // Track whether the user explicitly chose a step (prevents auto-advance from overriding navigation)
  const userOverrodeStepRef = useRef(false);
  const prevDoneMapRef = useRef<Record<string, boolean>>({});

  const handleStepClick = useCallback((id: WorkflowStepId) => {
    userOverrodeStepRef.current = true;
    setOpenStepId(id);
  }, []);

  useEffect(() => {
    // Build a done-map for transition detection
    const doneMap: Record<string, boolean> = {};
    for (const step of workflowSteps) doneMap[step.id] = step.done;
    const prevDone = prevDoneMapRef.current;
    prevDoneMapRef.current = doneMap;

    const active = workflowSteps.find((step) => step.id === openStepId);
    if (!active) {
      setOpenStepId(defaultOpenStepId);
      return;
    }

    // If the user explicitly navigated, respect their choice
    if (userOverrodeStepRef.current) {
      userOverrodeStepRef.current = false;
      return;
    }

    // Auto-advance only when the current step *just* transitioned to done
    const justCompleted = active.done && prevDone[active.id] === false;
    if (!justCompleted) return;

    const activeIndex = workflowSteps.findIndex((step) => step.id === openStepId);
    const nextIncomplete =
      workflowSteps.slice(activeIndex + 1).find((step) => !step.done) ?? workflowSteps.find((step) => !step.done);
    if (nextIncomplete && nextIncomplete.id !== openStepId) {
      setOpenStepId(nextIncomplete.id);
    }
  }, [defaultOpenStepId, openStepId, workflowSteps]);

  const activeStep = workflowSteps.find((step) => step.id === openStepId) ?? workflowSteps[0]!;
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === activeStep.id);
  const previousStepId = activeStepIndex > 0 ? workflowSteps[activeStepIndex - 1]!.id : null;
  const nextStepId = activeStepIndex < workflowSteps.length - 1 ? workflowSteps[activeStepIndex + 1]!.id : null;
  const activeStepSummary = stepSummaries[activeStep.id];

  const stepHeadings: Record<string, string> = {
    "step-create-pool": "First, align your health plan",
    "step-configure-policy": "Next, define Oracles, Outcomes & Rewards",
    "step-fund-pool": "Finally, fund the plan vault",
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
      {/* ── Left column: vertical stepper + info cards ── */}
      <div className="w-full lg:w-[300px] lg:shrink-0 flex flex-col gap-5">

        {/* Vertical stepper card */}
        <div className="surface-card-soft rounded-2xl p-5 space-y-0">
          {workflowSteps.map((step, index) => {
            const isActive = openStepId === step.id;
            const isDone = step.done;
            const isLast = index === workflowSteps.length - 1;
            return (
              <div key={step.id}>
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className={cn(
                    "flex items-start gap-4 w-full text-left py-1 group transition-opacity",
                    !isActive && !isDone && "opacity-80 hover:opacity-100",
                  )}
                >
                  <div className={cn(
                    "flex-none w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all mt-0.5",
                    isActive
                      ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg shadow-[var(--primary)]/30"
                      : isDone
                        ? "bg-transparent border-emerald-500 text-emerald-500"
                        : "bg-[var(--surface-raised)] border-[var(--border)]/60 text-[var(--muted-foreground)]/60",
                  )}>
                    {isDone ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="pt-0.5">
                    <p className={cn(
                      "text-[11px] uppercase tracking-wider mb-0.5",
                      isActive ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                    )}>
                      Step {index + 1}
                    </p>
                    <p className={cn(
                      "text-sm font-semibold leading-snug",
                      isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
                    )}>
                      {step.label}
                    </p>
                  </div>
                </button>
                {!isLast && (
                  <div className="ml-[15px] w-[2px] h-6 bg-[var(--border)]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Protocol readiness */}
        <div className="surface-card-soft rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-[var(--primary)]" />
            <p className="text-sm font-semibold text-[var(--foreground)]">Protocol Readiness</p>
          </div>
          <div className="space-y-2 text-sm">
            {([
              { label: "Pool", ok: readiness.poolExists },
              { label: "Oracle", ok: readiness.poolOracleApproved },
              { label: "Policy", ok: readiness.poolOraclePolicyConfigured },
              { label: "Rule", ok: readiness.ruleRegistered },
            ] as const).map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span className={cn(
                  "font-medium",
                  ok ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
                )}>
                  {label}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    ok ? "bg-emerald-500" : "bg-amber-500"
                  )} />
                  <span className={cn(
                    "text-[11px] font-bold tracking-wider uppercase",
                    ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-100"
                  )}>
                    {ok ? "Ready" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Execution context */}
        <div className="surface-card-soft rounded-2xl p-5 space-y-2.5">
          <p className="text-xs font-semibold tracking-wider uppercase text-[var(--foreground)]">Execution Context</p>
          <div className="space-y-3 pt-1">
            <div>
              <p className="text-[10px] text-[var(--foreground)] mb-0.5 uppercase tracking-widest font-semibold">Wallet</p>
              <p className="text-xs font-mono font-medium text-[var(--primary)] truncate" title={walletAddress || "not connected"}>
                {shortAddress(walletAddress) || "none"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--foreground)] mb-0.5 uppercase tracking-widest font-semibold">Pool</p>
              <p className="text-xs font-mono font-medium text-[var(--primary)] truncate" title={activePoolAddress || "not selected"}>
                {shortAddress(activePoolAddress) || "none"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--foreground)] mb-0.5 uppercase tracking-widest font-semibold">Verification Network</p>
              <p className="text-xs font-mono font-medium text-[var(--primary)] truncate" title={activeOracleAddress || "not selected"}>
                {shortAddress(activeOracleAddress) || "none"}
              </p>
            </div>
          </div>
        </div>

        {/* Audit trail */}
        {actionLog.length > 0 && (
          <div className="surface-card-soft rounded-2xl p-5 space-y-3 max-h-[300px] overflow-y-auto">
            <p className="text-xs font-semibold tracking-wider uppercase text-[var(--muted)]">Audit Trail</p>
            {actionLog.map((log) => (
              <div key={log.id} className="relative pl-3 border-l-2 border-[var(--border)] py-0.5">
                <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-[var(--primary)]" />
                <div className="flex justify-between items-baseline gap-2 mb-0.5">
                  <span className="font-semibold text-xs text-[var(--foreground)] truncate">{log.action}</span>
                  <span className="text-[10px] text-[var(--muted)] whitespace-nowrap shrink-0">
                    {new Date(log.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {log.signature ? (
                  <a href={toExplorerLink(log.signature, REALMS_CLUSTER)} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--primary)] hover:underline block truncate">
                    Tx: {shortAddress(log.signature)}
                  </a>
                ) : (
                  <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-snug">{log.message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right column: step heading + step content ── */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {stepHeadings[activeStep.id] ?? activeStep.label}
          </h2>
          <div className="flex gap-2 shrink-0">
            <button className="secondary-button py-1.5 px-3 text-sm" onClick={() => void refreshSelectors()} disabled={hasBusyAction}>
              Refresh
            </button>
            <button className="secondary-button py-1.5 px-3 text-sm" onClick={() => setAdvancedMode((prev) => !prev)} disabled={hasBusyAction}>
              {advancedMode ? "Simple Mode" : "Expert Mode"}
            </button>
          </div>
        </div>
        {selectorError ? <p className="field-error">{selectorError}</p> : null}

        {openStepId === stepCreatePool.id ? (
          <section id="step-create-pool" className="surface-card step-card space-y-3">
            <div className="step-head">
              <h3 className="step-title">1. Create Health Plan</h3>
              <span className={`status-pill ${stepCreatePool.done ? "status-ok" : "status-off"}`}>
                {stepCreatePool.done ? "Completed" : "Pending"}
              </span>
            </div>
            <p className="field-help">Signer needed: governance wallet (connected wallet becomes pool authority).</p>
            <div className="space-y-1">
              <p className="metric-label">Plan Type</p>
              <div className="inline-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`segment-button ${planType === "rewards" ? "segment-button-active" : ""}`}
                  onClick={() => setPlanType("rewards")}
                >
                  Rewards
                </button>
                <button
                  type="button"
                  className={`segment-button ${planType === "insurance" ? "segment-button-active" : ""}`}
                  onClick={() => setPlanType("insurance")}
                >
                  Insurance
                </button>
                <button
                  type="button"
                  className={`segment-button ${planType === "hybrid" ? "segment-button-active" : ""}`}
                  onClick={() => setPlanType("hybrid")}
                >
                  Hybrid
                </button>
              </div>
              <p className="field-help">
                Insurance-first plans hide reward inputs from the main form, while keeping them available in advanced settings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Health Plan ID ({poolIdBytes}/32 bytes)
                <input className="field-input" value={poolId} onChange={(event) => setPoolId(event.target.value)} />
              </label>
              <label className="field-label">
                Organization / Employer Name
                <input
                  className="field-input"
                  value={organizationRef}
                  onChange={(event) => setOrganizationRef(event.target.value)}
                />
              </label>
              {!insuranceOnlyPlan ? (
                <>
                  <label className="field-label">
                    Reward Amount per Success (Tokens)
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={Number(payoutLamportsPerPass) / LAMPORTS_PER_SOL || 0}
                      onChange={(event) => {
                        const lamports = Math.floor(Number(event.target.value) * LAMPORTS_PER_SOL);
                        setPayoutLamportsPerPass(lamports.toString());
                      }}
                    />
                  </label>
                  <label className="field-label">
                    Reward Token Mint Address
                    <input className="field-input" value={tokenGateMint} onChange={(event) => setTokenGateMint(event.target.value)} />
                  </label>
                </>
              ) : (
                <div className="surface-card-soft p-3 sm:col-span-2">
                  <p className="field-help">
                    Reward configuration is collapsed for insurance-first plans. Expand advanced settings below to edit reward fields.
                  </p>
                </div>
              )}
            </div>

            <AdvancedOverride title="Advanced Plan Configuration">
              <div className="grid gap-3 sm:grid-cols-2">
                {insuranceOnlyPlan ? (
                  <>
                    <label className="field-label">
                      Reward Amount per Success (Tokens)
                      <input
                        className="field-input"
                        type="number"
                        min="0"
                        step="0.1"
                        value={Number(payoutLamportsPerPass) / LAMPORTS_PER_SOL || 0}
                        onChange={(event) => {
                          const lamports = Math.floor(Number(event.target.value) * LAMPORTS_PER_SOL);
                          setPayoutLamportsPerPass(lamports.toString());
                        }}
                      />
                    </label>
                    <label className="field-label">
                      Reward Token Mint Address
                      <input className="field-input" value={tokenGateMint} onChange={(event) => setTokenGateMint(event.target.value)} />
                    </label>
                  </>
                ) : null}
                <label className="field-label">
                  Token gate minimum balance
                  <input
                    className="field-input"
                    value={tokenGateMinBalance}
                    onChange={(event) => setTokenGateMinBalance(event.target.value)}
                  />
                </label>
                <label className="field-label">
                  Pool metadata URI
                  <input
                    className="field-input"
                    value={poolMetadataUri}
                    onChange={(event) => setPoolMetadataUri(event.target.value)}
                  />
                </label>
                <label className="field-label">
                  Terms hash override
                  <input className="field-input" value={termsHashHex} onChange={(event) => setTermsHashHex(event.target.value)} />
                </label>
                <label className="field-label">
                  Payout policy hash override
                  <input
                    className="field-input"
                    value={payoutPolicyHashHex}
                    onChange={(event) => setPayoutPolicyHashHex(event.target.value)}
                  />
                </label>
              </div>
            </AdvancedOverride>
            {predictedPoolAddress ? <p className="field-help">Predicted pool PDA: {predictedPoolAddress}</p> : null}
            <button className="action-button" disabled={createPoolDisabled} onClick={() => void onCreatePool()}>
              {busyAction === "Create pool" ? "Creating..." : "Create health plan"}
            </button>
            {recentCreatedPoolAddress ? (
              <Link href={`/pools/${recentCreatedPoolAddress}`} className="secondary-button inline-flex w-fit">
                Open created pool dashboard
              </Link>
            ) : null}
            <p className="field-help">
              Member enrollment is managed after deployment in the Pool Dashboard (token-gated, premium-paid, or verifier-assisted).
            </p>
            {!hasBusyAction && createPoolBlockingReason ? <p className="field-error">{createPoolBlockingReason}</p> : null}
            {/* Step navigation */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]/40 mt-4">
              {nextStepId && (
                <button className="secondary-button py-1.5 px-4 text-sm inline-flex items-center gap-1.5" onClick={() => handleStepClick(nextStepId)}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </section>
        ) : null
        }

        {
          openStepId === stepConfigurePolicy.id ? (
            <section id="step-configure-policy" className="surface-card step-card space-y-3">
              <div className="step-head">
                <h3 className="step-title">2. Define Oracles, Outcomes & Rewards</h3>
                <span className={`status-pill ${stepConfigurePolicy.done ? "status-ok" : "status-off"}`}>
                  {stepConfigurePolicy.done ? "Completed" : "Pending"}
                </span>
              </div>
              <p className="field-help">
                Schema publish/verify actions are governance proposal-only. Create schema proposals in Realms and select the
                verified schema here.
              </p>
              <a className="secondary-button inline-flex w-fit py-2" href={realmsProposalLink()} target="_blank" rel="noreferrer">
                Open Realms proposal workspace
              </a>

              <div className="grid gap-4 lg:grid-cols-2">
                <SearchableSelect
                  label="Pool"
                  value={selectedPoolAddress}
                  options={toPoolOptions(pools)}
                  onChange={setSelectedPoolAddress}
                  searchValue={selectorSearch.pools}
                  onSearchChange={(value) => setSelectorSearch((prev) => ({ ...prev, pools: value }))}
                  loading={selectorLoading}
                  disabled={selectorOverrideEnabled}
                  disabledHint="Selector is disabled while advanced override is enabled."
                  placeholder="Select pool from chain"
                />

                <SearchableSelect
                  label="Primary Verification Network Oracle"
                  value={selectedOracleAddress}
                  options={toOracleOptions(oracles)}
                  onChange={setSelectedOracleAddress}
                  searchValue={selectorSearch.oracles}
                  onSearchChange={(value) => setSelectorSearch((prev) => ({ ...prev, oracles: value }))}
                  loading={selectorLoading}
                  disabled={selectorOverrideEnabled}
                  disabledHint="Selector is disabled while advanced override is enabled."
                  placeholder="Select verifier from chain"
                />

                <div className="surface-card-soft space-y-2 p-3 lg:col-span-2">
                  <p className="metric-label">Verification network members</p>
                  <p className="field-help">
                    Choose all oracle members that can attest outcomes for this health plan.
                  </p>
                  {selectorOverrideEnabled ? (
                    <p className="field-help">Advanced override is enabled. Oracle coverage uses the manual oracle address only.</p>
                  ) : (
                    <>
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border)]/45 divide-y divide-[var(--border)]/35">
                        {oracleSelectionRows.map((oracle) => {
                          const checked = selectedOracleCoverageAddresses.includes(oracle.oracle);
                          return (
                            <label key={oracle.address} className="flex items-start gap-2 p-2 text-sm">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={() => toggleOracleCoverageAddress(oracle.oracle)}
                              />
                              <span className="min-w-0">
                                <span className="block font-medium font-mono">{shortAddress(oracle.oracle)}</span>
                                <span className="block text-[11px] text-[var(--muted-foreground)] truncate">
                                  {oracle.metadataUri || "No metadata URI"} {oracle.active ? "" : " • inactive"}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                        {oracleSelectionRows.length === 0 ? (
                          <p className="p-2 text-sm text-[var(--muted-foreground)]">No oracles match the current selector search.</p>
                        ) : null}
                      </div>
                      <p className="field-help">
                        Selected verifiers: {selectedOracleCoverageAddresses.length}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`field-help ${quorumConfigIssue ? "text-[var(--danger)]" : ""}`}>
                          {quorumConfigIssue
                            ? quorumConfigIssue
                            : `Quorum is configured as ${parsedQuorumM} of ${parsedQuorumN}.`}
                        </p>
                        {quorumConfigIssue && selectedVerifierCount > 0 ? (
                          <button
                            type="button"
                            className="secondary-button text-xs px-2 py-1"
                            onClick={autoFixQuorum}
                          >
                            Auto-fix quorum
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <SearchableSelect
                    label="Health Outcomes Schema"
                    value={selectedSchemaAddress}
                    options={toSchemaOptions(schemas)}
                    onChange={setSelectedSchemaAddress}
                    searchValue={selectorSearch.schemas}
                    onSearchChange={(value) => setSelectorSearch((prev) => ({ ...prev, schemas: value }))}
                    loading={selectorLoading}
                    disabled={selectorOverrideEnabled}
                    disabledHint="Selector is disabled while advanced override is enabled."
                    placeholder="Select verified schema"
                  />
                  {selectedSchema?.metadataUri && (
                    <a
                      href={selectedSchema.metadataUri}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute right-0 top-0 text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1"
                    >
                      View JSON Schema
                    </a>
                  )}
                </div>

                <SearchableSelect
                  label="Existing rule (optional)"
                  value={selectedRuleAddress}
                  options={toRuleOptions(rules)}
                  onChange={setSelectedRuleAddress}
                  searchValue={selectorSearch.rules}
                  onSearchChange={(value) => setSelectorSearch((prev) => ({ ...prev, rules: value }))}
                  loading={selectorLoading}
                  disabled={selectorOverrideEnabled}
                  disabledHint="Selector is disabled while advanced override is enabled."
                  placeholder="Select existing rule"
                />
              </div>

              <AdvancedOverride
                enabled={selectorOverrideEnabled}
                onToggle={setSelectorOverrideEnabled}
                title="Advanced override (raw addresses / hashes)"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-label">
                    Pool address
                    <input
                      className="field-input"
                      value={manualPoolAddress}
                      onChange={(event) => setManualPoolAddress(event.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    Oracle address
                    <input
                      className="field-input"
                      value={manualOracleAddress}
                      onChange={(event) => setManualOracleAddress(event.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    Schema version override
                    <input
                      className="field-input"
                      value={schemaVersionOverride}
                      onChange={(event) => setSchemaVersionOverride(event.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    Rule hash override
                    <input className="field-input" value={ruleHashHex} onChange={(event) => setRuleHashHex(event.target.value)} />
                  </label>
                  <label className="field-label">
                    Payout hash override
                    <input className="field-input" value={payoutHashHex} onChange={(event) => setPayoutHashHex(event.target.value)} />
                  </label>
                </div>
              </AdvancedOverride>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="surface-card-soft space-y-2 p-3 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="metric-label">Schema outcomes for attestation</p>
                    <span className="field-help">
                      Selected outcomes: {selectedOutcomeIds.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`status-pill ${!schemaMetadataLoading && !schemaMetadataIssue ? "status-ok" : "status-off"}`}>
                      {schemaMetadataStatusText}
                    </span>
                    {schemaMetadataHelpText ? <span className="field-help">{schemaMetadataHelpText}</span> : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[2fr,1fr,auto]">
                    <label className="field-label">
                      Search outcomes
                      <input
                        className="field-input"
                        value={outcomeSearch}
                        onChange={(event) => setOutcomeSearch(event.target.value)}
                        placeholder="Search by ID, label, metric, or domain"
                      />
                    </label>
                    <label className="field-label">
                      Domain
                      <select
                        className="field-input"
                        value={outcomeDomainFilter}
                        onChange={(event) => setOutcomeDomainFilter(event.target.value)}
                      >
                        {schemaOutcomeDomains.map((domain) => (
                          <option key={domain} value={domain}>
                            {domain === "all" ? "All domains" : domain}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-end gap-2 pb-0.5">
                      <button
                        type="button"
                        className="secondary-button text-xs px-2 py-1"
                        onClick={() => setSelectedOutcomeIds(filteredSchemaOutcomes.map((outcome) => outcome.id))}
                        disabled={filteredSchemaOutcomes.length === 0}
                      >
                        Select filtered
                      </button>
                      <button
                        type="button"
                        className="secondary-button text-xs px-2 py-1"
                        onClick={() => setSelectedOutcomeIds([])}
                        disabled={selectedOutcomeIds.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {schemaMetadataLoading ? <p className="field-help">Loading schema metadata outcomes...</p> : null}
                  {!schemaMetadataLoading && schemaOutcomes.length === 0 ? (
                    <p className="field-help">No schema outcomes available from metadata. Use raw Rule ID mode below if needed.</p>
                  ) : null}
                  {!schemaMetadataLoading && schemaOutcomes.length > 0 ? (
                    filteredSchemaOutcomes.length === 0 ? (
                      <p className="field-help">No outcomes match the current filters.</p>
                    ) : (
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--border)]/45 divide-y divide-[var(--border)]/35">
                        {filteredSchemaOutcomes.map((outcome) => (
                          <label key={outcome.id} className="flex items-start gap-2 p-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={selectedOutcomeSet.has(outcome.id)}
                              onChange={() => toggleOutcomeSelection(outcome.id)}
                            />
                            <span className="min-w-0">
                              <span className="block font-medium truncate">{outcome.label}</span>
                              <span className="block text-[11px] text-[var(--muted-foreground)] font-mono truncate">
                                {outcome.id}
                              </span>
                              <span className="block text-[11px] text-[var(--muted-foreground)] truncate">
                                {outcome.metricId || "metric n/a"}
                                {outcome.comparator && typeof outcome.threshold === "number"
                                  ? ` • ${outcome.comparator} ${outcome.threshold}${outcome.unit ? ` ${outcome.unit}` : ""}`
                                  : ""}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )
                  ) : null}
                  <p className="field-help">
                    Each selected outcome writes one on-chain pool rule in this submission (limit {MAX_RULES_PER_BATCH} per run).
                  </p>
                </div>
                <label className="field-label">
                  Minimum verifier confirmations
                  <input
                    className="field-input mt-1"
                    type="number"
                    min="1"
                    value={quorumM}
                    onChange={(event) => setQuorumM(event.target.value)}
                  />
                  <span className="field-help mt-1 block">
                    Set how many verification signatures are required to confirm an outcome.
                  </span>
                </label>
                <label className="field-label">
                  Verification Network size
                  <input
                    className="field-input mt-1"
                    type="number"
                    min="1"
                    value={quorumN}
                    onChange={(event) => setQuorumN(event.target.value)}
                  />
                  <span className="field-help mt-1 block">
                    Total verifiers participating in this plan's consensus network (max {selectedOracleCoverageAddresses.length} selected).
                  </span>
                </label>
              </div>

              <AdvancedOverride title="Advanced Verification Policy">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-label">
                    Rule ID override (optional)
                    <input className="field-input" value={ruleId} onChange={(event) => setRuleId(event.target.value)} />
                    <span className="field-help mt-1 block">
                      Used as raw rule ID when no schema outcomes are selected, or as override when exactly one outcome is selected.
                    </span>
                    {!explicitRuleId && selectedRule?.ruleId ? (
                      <span className="field-help mt-1 block">
                        Using selected existing rule ID fallback: <span className="font-mono">{selectedRule.ruleId}</span>
                      </span>
                    ) : null}
                  </label>
                  <label className="field-label">
                    Require verified schema
                    <select
                      className="field-input"
                      value={requireVerifiedSchema ? "1" : "0"}
                      onChange={(event) => setRequireVerifiedSchema(event.target.value === "1")}
                    >
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  </label>
                  <label className="field-label">
                    Allow delegate claim
                    <select
                      className="field-input"
                      value={allowDelegateClaim ? "1" : "0"}
                      onChange={(event) => setAllowDelegateClaim(event.target.value === "1")}
                    >
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  </label>
                </div>
              </AdvancedOverride>

              {schemaWarnings.map((warning) => (
                <p key={warning} className="field-help">
                  {warning}
                </p>
              ))}

              <button className="action-button" disabled={setPolicyDisabled} onClick={() => void onConfigurePolicyAndRule()}>
                {busyAction === "Configure policy + rule" ? "Configuring..." : "Confirm Oracles & Outcomes"}
              </button>
              {!hasBusyAction && setPolicyBlockingReason ? <p className="field-error">{setPolicyBlockingReason}</p> : null}
              {/* Step navigation */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border)]/40 mt-4">
                {previousStepId && (
                  <button className="secondary-button py-1.5 px-4 text-sm inline-flex items-center gap-1.5" onClick={() => handleStepClick(previousStepId)}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Back
                  </button>
                )}
                <div className="flex-1" />
                {nextStepId && (
                  <button className="secondary-button py-1.5 px-4 text-sm inline-flex items-center gap-1.5" onClick={() => handleStepClick(nextStepId)}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </section>
          ) : null
        }

        {
          openStepId === stepFundPool.id ? (
            <section id="step-fund-pool" className="surface-card step-card space-y-3">
              <div className="step-head">
                <h3 className="step-title">3. Fund Plan Vault</h3>
                <span className={`status-pill ${stepFundPool.done ? "status-ok" : "status-off"}`}>
                  {stepFundPool.done ? "Completed" : "Pending"}
                </span>
              </div>
              <p className="field-help">Signer needed: any wallet funding the plan vault.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field-label">
                  Funding Amount (Tokens)
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={Number(fundLamports) / LAMPORTS_PER_SOL || 0}
                    onChange={(event) => {
                      const lamports = Math.floor(Number(event.target.value) * LAMPORTS_PER_SOL);
                      setFundLamports(lamports.toString());
                    }}
                  />
                </label>
              </div>
              <button className="action-button" disabled={fundPoolDisabled} onClick={() => void onFundPool()}>
                {busyAction === "Fund pool" ? "Funding..." : "Fund pool"}
              </button>
              {!hasBusyAction && fundPoolBlockingReason ? <p className="field-error">{fundPoolBlockingReason}</p> : null}
              {/* Step navigation */}
              <div className="flex items-center justify-start gap-3 pt-3 border-t border-[var(--border)]/40 mt-4">
                {previousStepId && (
                  <button className="secondary-button py-1.5 px-4 text-sm inline-flex items-center gap-1.5" onClick={() => handleStepClick(previousStepId)}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Back
                  </button>
                )}
              </div>
            </section>
          ) : null
        }

      </div>
    </div >
  );
}
