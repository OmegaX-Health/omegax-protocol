// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PublicKey } from "@solana/web3.js";

import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import {
  ORACLE_TYPE_HEALTH_APP,
  ORACLE_TYPE_HOSPITAL_CLINIC,
  ORACLE_TYPE_LAB,
  ORACLE_TYPE_OTHER,
  ORACLE_TYPE_WEARABLE_DATA_PROVIDER,
  buildClaimOracleTx,
  buildRegisterOracleTx,
  buildUpdateOracleProfileTx,
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

type WizardMode = "register" | "update";
type WizardStep = 1 | 2;

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

const ORACLE_TYPES = [
  { value: ORACLE_TYPE_LAB, label: "Lab" },
  { value: ORACLE_TYPE_HOSPITAL_CLINIC, label: "Hospital / Clinic" },
  { value: ORACLE_TYPE_HEALTH_APP, label: "Health App" },
  { value: ORACLE_TYPE_WEARABLE_DATA_PROVIDER, label: "Wearable / Data Provider" },
  { value: ORACLE_TYPE_OTHER, label: "Other" },
] as const;

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
  const option = ORACLE_TYPES.find((row) => row.value === type);
  return option?.label ?? `Type ${type}`;
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
  const [schemasSearch, setSchemasSearch] = useState("");
  const [verifiedOnlySchemas, setVerifiedOnlySchemas] = useState(true);

  const [oracles, setOracles] = useState<OracleWithProfileSummary[]>([]);
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [pools, setPools] = useState<PoolRef[]>([]);
  const [approvals, setApprovals] = useState<PoolOracleApprovalSummary[]>([]);
  const [policies, setPolicies] = useState<PoolOraclePolicySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOracleAddress, setSelectedOracleAddress] = useState("");

  const [wizardMode, setWizardMode] = useState<WizardMode>("register");
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardBusy, setWizardBusy] = useState<string | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardSuccess, setWizardSuccess] = useState<string | null>(null);

  const [oracleAddressInput, setOracleAddressInput] = useState("");
  const [oracleType, setOracleType] = useState<number>(ORACLE_TYPE_LAB);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [logoUri, setLogoUri] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedSchemaHashes, setSelectedSchemaHashes] = useState<string[]>([]);
  const [manualSchemaHash, setManualSchemaHash] = useState("");
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

  const walletAddress = publicKey?.toBase58() ?? "";
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

  useEffect(() => {
    if (!connected) {
      setOracleAddressInput("");
      return;
    }
    if (!oracleAddressInput && walletAddress) {
      setOracleAddressInput(walletAddress);
    }
  }, [connected, oracleAddressInput, walletAddress]);

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

  const filteredRegistry = useMemo(() => {
    const query = normalize(registrySearch).toLowerCase();
    return oracles
      .filter((row) => {
        if (!query) return true;
        const profile = row.profile;
        return (
          row.oracle.toLowerCase().includes(query) ||
          row.address.toLowerCase().includes(query) ||
          (profile?.displayName || "").toLowerCase().includes(query) ||
          (profile?.legalName || "").toLowerCase().includes(query) ||
          (profile?.websiteUrl || "").toLowerCase().includes(query)
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

  const filteredSchemas = useMemo(() => {
    const query = normalize(schemasSearch).toLowerCase();
    return schemas
      .filter((row) => (verifiedOnlySchemas ? row.verified : true))
      .filter((row) => {
        if (!query) return true;
        return (
          row.schemaKey.toLowerCase().includes(query) ||
          row.schemaKeyHashHex.toLowerCase().includes(query) ||
          row.metadataUri.toLowerCase().includes(query)
        );
      });
  }, [schemas, schemasSearch, verifiedOnlySchemas]);

  const schemaByHash = useMemo(() => {
    const map = new Map<string, SchemaSummary>();
    for (const schema of schemas) {
      map.set(normalizeHex32(schema.schemaKeyHashHex), schema);
    }
    return map;
  }, [schemas]);

  const selectedSchemaSet = useMemo(() => new Set(selectedSchemaHashes), [selectedSchemaHashes]);
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

    if (fetched.error) {
      const status: SchemaPreviewStatus =
        fetched.error.code === "fetch_failed" || fetched.error.code === "http_error"
          ? "metadata_unreachable"
          : "metadata_invalid";
      setSchemaPreviewByHash((current) => ({
        ...current,
        [normalizedHash]: {
          status,
          outcomeCount: parsed.outcomes.length,
          templateCount: parsed.outcomeTemplates.length,
          sampleOutcomeIds: parsed.outcomes.slice(0, 5).map((outcome) => outcome.id),
          warning: fetched.error?.message || parsed.warnings[0] || null,
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

  const previewHashes = useMemo(() => {
    return Array.from(
      new Set([
        ...selectedSchemaHashes.map((hash) => normalizeHex32(hash)),
        ...selectedOracleSupportedHashes.map((hash) => normalizeHex32(hash)),
      ]),
    );
  }, [selectedOracleSupportedHashes, selectedSchemaHashes]);

  useEffect(() => {
    for (const hash of previewHashes) {
      if (!schemaPreviewByHash[hash]) {
        void loadSchemaPreview(hash);
      }
    }
  }, [loadSchemaPreview, previewHashes, schemaPreviewByHash]);

  useEffect(() => {
    if (wizardMode !== "register" || wizardStep !== 1) return;
    for (const schema of filteredSchemas.slice(0, 8)) {
      const hash = normalizeHex32(schema.schemaKeyHashHex);
      if (!schemaPreviewByHash[hash]) {
        void loadSchemaPreview(hash);
      }
    }
  }, [filteredSchemas, loadSchemaPreview, schemaPreviewByHash, wizardMode, wizardStep]);

  const selectedSchemaCoverage = useMemo(() => {
    return selectedSchemaHashes.reduce((sum, hash) => {
      const preview = schemaPreviewByHash[normalizeHex32(hash)];
      return sum + (preview?.outcomeCount || 0);
    }, 0);
  }, [schemaPreviewByHash, selectedSchemaHashes]);

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

  const selectedVerificationOracle = useMemo(
    () => oracles.find((row) => row.oracle === verificationOracleAddress) ?? null,
    [oracles, verificationOracleAddress],
  );

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
      // ignore clipboard permission failures
    }
  }, []);

  const toggleSchemaHash = useCallback((hashHex: string) => {
    const normalized = normalizeHex32(hashHex);
    setSelectedSchemaHashes((current) => {
      if (current.includes(normalized)) {
        return current.filter((row) => row !== normalized);
      }
      return [...current, normalized];
    });
  }, []);

  const addManualSchemaHash = useCallback(() => {
    const normalized = normalizeHex32(manualSchemaHash);
    if (!isHex32(normalized)) {
      setWizardError("Manual schema hash must be 32-byte hex (64 chars).");
      return;
    }
    setWizardError(null);
    setSelectedSchemaHashes((current) => {
      if (current.includes(normalized)) return current;
      return [...current, normalized];
    });
    setManualSchemaHash("");
  }, [manualSchemaHash]);

  const resetWizardMessages = useCallback(() => {
    setWizardError(null);
    setWizardSuccess(null);
  }, []);

  const validateStep = useCallback((step: WizardStep): string | null => {
    if (!connected || !publicKey) {
      return "Connect a wallet to continue.";
    }
    if (step >= 1) {
      if (!normalize(oracleAddressInput)) return "Oracle signing pubkey is required.";
      if (!isPublicKey(oracleAddressInput)) return "Oracle signing pubkey is invalid.";
      if (!normalize(displayName)) return "Display name is required.";
      if (selectedSchemaHashes.length > 16) return "Maximum supported schemas is 16.";
    }
    return null;
  }, [connected, displayName, oracleAddressInput, publicKey, selectedSchemaHashes.length]);

  const goNext = useCallback(() => {
    const issue = validateStep(wizardStep);
    if (issue) {
      setWizardError(issue);
      return;
    }
    setWizardError(null);
    setWizardStep((current) => (current === 2 ? current : 2));
  }, [validateStep, wizardStep]);

  const goBack = useCallback(() => {
    setWizardError(null);
    setWizardStep((current) => (current === 1 ? current : 1));
  }, []);

  const registerOracle = useCallback(async () => {
    if (!publicKey || !connected) {
      setWizardError("Connect a wallet before sending transactions.");
      return;
    }
    const validationError = validateStep(2);
    if (validationError) {
      setWizardError(validationError);
      return;
    }

    const normalizedOracle = normalize(oracleAddressInput);
    const oraclePubkey = new PublicKey(normalizedOracle);

    setWizardBusy("register");
    setWizardError(null);
    setWizardSuccess(null);

    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildRegisterOracleTx({
        admin: publicKey,
        oracle: oraclePubkey,
        recentBlockhash: blockhash,
        oracleType,
        displayName,
        legalName,
        websiteUrl,
        appUrl,
        logoUri,
        webhookUrl,
        supportedSchemaKeyHashesHex: selectedSchemaHashes,
      });
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      await refreshData();
      setSelectedOracleAddress(normalizedOracle);
      setWizardSuccess(`Oracle profile registered. Signature: ${signature}`);
    } catch (cause) {
      setWizardError(
        formatRpcError(cause, {
          fallback: "Failed to register oracle profile.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setWizardBusy(null);
    }
  }, [
    appUrl,
    connected,
    connection,
    displayName,
    legalName,
    logoUri,
    oracleAddressInput,
    oracleType,
    publicKey,
    refreshData,
    selectedSchemaHashes,
    sendTransaction,
    validateStep,
    webhookUrl,
    websiteUrl,
  ]);

  const updateOracleProfile = useCallback(async () => {
    if (!publicKey || !connected) {
      setWizardError("Connect a wallet before sending transactions.");
      return;
    }
    const validationError = validateStep(2);
    if (validationError) {
      setWizardError(validationError);
      return;
    }

    const normalizedOracle = normalize(oracleAddressInput);
    const oraclePubkey = new PublicKey(normalizedOracle);

    setWizardBusy("update");
    setWizardError(null);
    setWizardSuccess(null);

    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildUpdateOracleProfileTx({
        authority: publicKey,
        oracle: oraclePubkey,
        recentBlockhash: blockhash,
        oracleType,
        displayName,
        legalName,
        websiteUrl,
        appUrl,
        logoUri,
        webhookUrl,
        supportedSchemaKeyHashesHex: selectedSchemaHashes,
      });
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      await refreshData();
      setSelectedOracleAddress(normalizedOracle);
      setWizardSuccess(`Oracle profile updated. Signature: ${signature}`);
    } catch (cause) {
      setWizardError(
        formatRpcError(cause, {
          fallback: "Failed to update oracle profile.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setWizardBusy(null);
    }
  }, [
    appUrl,
    connected,
    connection,
    displayName,
    legalName,
    logoUri,
    oracleAddressInput,
    oracleType,
    publicKey,
    refreshData,
    selectedSchemaHashes,
    sendTransaction,
    validateStep,
    webhookUrl,
    websiteUrl,
  ]);

  const claimOracle = useCallback(async (oracleAddress: string) => {
    if (!publicKey || !connected) {
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
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      await refreshData();
      setClaimSuccess(`Oracle claimed and activated. Signature: ${signature}`);
    } catch (cause) {
      setClaimError(
        formatRpcError(cause, {
          fallback: "Failed to claim oracle activation.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
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

  const loadSelectedProfileToWizard = useCallback(() => {
    if (!selectedOracle?.profile) return;
    const profile = selectedOracle.profile;
    setWizardMode("update");
    setWizardStep(1);
    setOracleAddressInput(profile.oracle);
    setOracleType(profile.oracleType);
    setDisplayName(profile.displayName);
    setLegalName(profile.legalName);
    setWebsiteUrl(profile.websiteUrl);
    setAppUrl(profile.appUrl);
    setLogoUri(profile.logoUri);
    setWebhookUrl(profile.webhookUrl);
    setSelectedSchemaHashes(
      Array.from(
        new Set(
          profile.supportedSchemaKeyHashesHex
            .map((hash) => normalizeHex32(hash))
            .filter((hash) => isHex32(hash)),
        ),
      ),
    );
    resetWizardMessages();
  }, [resetWizardMessages, selectedOracle]);

  const wizardActionLabel = wizardMode === "register" ? "Register oracle" : "Update profile";

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
              <ShieldCheck className={`h-3.5 w-3.5 ${claimBusy ? "animate-pulse" : ""}`} />
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

        {!loading && filteredRegistry.length === 0 ? (
          <p className="field-help">No oracle profiles match your search.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRegistry.map((row) => {
              const profile = row.profile;
              const isSelected = row.oracle === selectedOracleAddress;
              const oracleApprovals = approvals.filter((entry) => entry.oracle === row.oracle);
              const policiesConfigured = oracleApprovals.filter((entry) =>
                policiesByPool.has(entry.liquidityPool)
              ).length;
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
                <button
                  type="button"
                  className="secondary-button text-sm"
                  onClick={loadSelectedProfileToWizard}
                >
                  Edit profile
                </button>
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
                          {shortAddress(entry.hash)}
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
            <p className="field-help">This oracle has not published a structured profile yet. Use the onboarding flow below to register one and unlock managed capabilities.</p>
          )}
        </section>
      ) : null}

      <section className="surface-card space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="metric-label">Oracle onboarding</p>
            <p className="field-help">
              {wizardMode === "register"
                ? "Registration stays guided, while normal profile edits stay on a single screen."
                : "Edit the profile inline, then save changes without stepping through a wizard."}
            </p>
          </div>
          <div className="inline-flex gap-1 rounded-xl border border-[var(--border)]/60 p-1 bg-[color-mix(in oklab,var(--surface-strong)_82%,transparent)]">
            <button
              type="button"
              className={`segment-button segment-button-compact ${wizardMode === "register" ? "segment-button-active" : ""}`}
              onClick={() => {
                setWizardMode("register");
                setWizardStep(1);
                resetWizardMessages();
              }}
            >
              Register
            </button>
            <button
              type="button"
              className={`segment-button segment-button-compact ${wizardMode === "update" ? "segment-button-active" : ""}`}
              onClick={() => {
                setWizardMode("update");
                setWizardStep(1);
                resetWizardMessages();
              }}
            >
              Update
            </button>
          </div>
        </div>

        {wizardMode === "register" ? (
          <div className="wizard-stepper-shell">
            <div className="wizard-stepper-head">
              <div>
                <p className="metric-label">Register oracle</p>
                <p className="field-help">Start with the profile, then confirm the on-chain registration and claim handoff.</p>
              </div>
            </div>
            <div className="wizard-stepper-list sm:grid-cols-2 xl:grid-cols-2">
              {[1, 2].map((step) => (
                <button
                  key={step}
                  type="button"
                  className={`wizard-step-chip ${wizardStep === step ? "wizard-step-chip-active" : ""}`}
                  onClick={() => {
                    setWizardStep(step as WizardStep);
                    resetWizardMessages();
                  }}
                >
                  <span className="workflow-index">{step}</span>
                  <span className="wizard-step-chip-label">
                    {step === 1 ? "Profile & Capability" : "Review & Activate"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {(wizardMode === "update" || wizardStep === 1) ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="field-help">Admin wallet</span>
                <input className="field-input w-full" value={walletAddress || "Not connected"} readOnly />
              </label>
              <label className="space-y-1 text-sm">
                <span className="field-help">Oracle signing pubkey</span>
                <input
                  className="field-input w-full"
                  value={oracleAddressInput}
                  onChange={(event) => {
                    setOracleAddressInput(event.target.value);
                    resetWizardMessages();
                  }}
                  placeholder="Oracle signer public key"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="field-help">Display name *</span>
                <input className="field-input w-full" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Regional Care Diagnostics" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="field-help">Oracle type</span>
                <select className="field-input w-full" value={String(oracleType)} onChange={(event) => setOracleType(Number.parseInt(event.target.value, 10))}>
                  {ORACLE_TYPES.map((row) => (
                    <option key={row.value} value={row.value}>{row.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="field-help">Legal name</span>
                <input className="field-input w-full" value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Optional legal entity name" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="field-help">Website URL</span>
                <input className="field-input w-full" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://oracle.yourorg.com" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="field-help">App URL</span>
                <input className="field-input w-full" value={appUrl} onChange={(event) => setAppUrl(event.target.value)} placeholder="Optional operator dashboard URL" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="field-help">Logo URI</span>
                <input className="field-input w-full" value={logoUri} onChange={(event) => setLogoUri(event.target.value)} placeholder="ipfs://... or a public HTTPS logo URL" />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="field-input w-full sm:max-w-sm"
                  value={schemasSearch}
                  onChange={(event) => setSchemasSearch(event.target.value)}
                  placeholder="Filter supported schemas"
                />
                <label className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={verifiedOnlySchemas}
                    onChange={(event) => setVerifiedOnlySchemas(event.target.checked)}
                  />
                  Show verified schemas only
                </label>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--border)]/50 divide-y divide-[var(--border)]/40">
                {filteredSchemas.map((schema) => {
                  const normalizedHash = normalizeHex32(schema.schemaKeyHashHex);
                  const selected = selectedSchemaSet.has(normalizedHash);
                  const preview = schemaPreviewByHash[normalizedHash];
                  return (
                    <label key={schema.address} className="flex items-start gap-2 p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSchemaHash(schema.schemaKeyHashHex)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium truncate">{schema.schemaKey} v{schema.version}</span>
                        <span className="block text-[11px] text-[var(--muted-foreground)] font-mono truncate">
                          {shortAddress(schema.schemaKeyHashHex)}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={`status-pill ${preview?.status === "ready" ? "status-ok" : "status-off"}`}>
                            {preview ? previewStatusLabel(preview.status) : "Preview pending"}
                          </span>
                          {preview ? (
                            <span className="text-[var(--muted-foreground)]">
                              {preview.outcomeCount} outcomes • {preview.templateCount} templates
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {!filteredSchemas.length ? <p className="p-3 text-sm text-[var(--muted-foreground)]">No schemas found.</p> : null}
              </div>

              <p className="field-help">
                Selected supported schema hashes: {selectedSchemaHashes.length} / 16 • Previewed outcomes: {selectedSchemaCoverage}
              </p>

              {selectedSchemaHashes.length > 0 ? (
                <div className="space-y-1 rounded-xl border border-[var(--border)]/45 p-2.5 text-xs">
                  {selectedSchemaHashes.map((hash) => {
                    const normalizedHash = normalizeHex32(hash);
                    const preview = schemaPreviewByHash[normalizedHash];
                    const schema = schemaByHash.get(normalizedHash);
                    return (
                      <p key={normalizedHash} className="break-all">
                        <span className="font-medium">{schema ? `${schema.schemaKey} v${schema.version}` : shortAddress(normalizedHash)}</span>
                        {" • "}
                        <span className="text-[var(--muted-foreground)]">
                          {preview ? `${preview.outcomeCount} outcomes, ${preview.templateCount} templates` : "preview pending"}
                        </span>
                      </p>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <details className="rounded-xl border border-[var(--border)]/45 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Advanced fields</summary>
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    className="field-input w-full"
                    value={manualSchemaHash}
                    onChange={(event) => setManualSchemaHash(event.target.value)}
                    placeholder="Manual schema hash (32-byte hex)"
                  />
                  <button type="button" className="secondary-button text-sm" onClick={addManualSchemaHash}>Add</button>
                </div>

                <label className="space-y-1 text-sm">
                  <span className="field-help">Webhook URL</span>
                  <input
                    className="field-input w-full"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    placeholder="https://oracle.company.com/attest"
                  />
                </label>
                <p className="field-help">Webhook URL is public on-chain metadata. Do not include secrets or auth tokens.</p>
              </div>
            </details>

            {wizardMode === "register" ? (
              <div className="flex items-center justify-between gap-2">
                <span />
                <button type="button" className="secondary-button text-sm" onClick={goNext}>
                  Next
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="action-button inline-flex items-center gap-1.5 text-sm"
                  onClick={() => void updateOracleProfile()}
                  disabled={Boolean(wizardBusy)}
                >
                  <ShieldCheck className={`h-3.5 w-3.5 ${wizardBusy ? "animate-pulse" : ""}`} />
                  {wizardBusy ? "Submitting..." : wizardActionLabel}
                </button>
                <button
                  type="button"
                  className="secondary-button text-sm"
                  onClick={() => {
                    if (!oracleAddressInput) return;
                    void claimOracle(oracleAddressInput);
                  }}
                  disabled={Boolean(wizardBusy) || !oracleAddressInput}
                >
                  Claim now
                </button>
              </div>
            )}
          </div>
        ) : null}

        {wizardMode === "register" && wizardStep === 2 ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--border)]/55 p-3 text-sm space-y-1">
              <p><span className="text-[var(--muted-foreground)]">Admin wallet:</span> {shortAddress(walletAddress || "—")}</p>
              <p><span className="text-[var(--muted-foreground)]">Oracle signer:</span> {shortAddress(oracleAddressInput || "—")}</p>
              <p><span className="text-[var(--muted-foreground)]">Display name:</span> {displayName || "—"}</p>
              <p><span className="text-[var(--muted-foreground)]">Type:</span> {oracleTypeLabel(oracleType)}</p>
              <p><span className="text-[var(--muted-foreground)]">Website:</span> {websiteUrl || "—"}</p>
              <p><span className="text-[var(--muted-foreground)]">Supported schemas:</span> {selectedSchemaHashes.length}</p>
              <p><span className="text-[var(--muted-foreground)]">Previewed outcomes:</span> {selectedSchemaCoverage}</p>
              <p><span className="text-[var(--muted-foreground)]">Webhook:</span> {webhookUrl || "—"}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="action-button inline-flex items-center gap-1.5 text-sm"
                onClick={() => void registerOracle()}
                disabled={Boolean(wizardBusy)}
              >
                <ShieldCheck className={`h-3.5 w-3.5 ${wizardBusy ? "animate-pulse" : ""}`} />
                {wizardBusy ? "Submitting..." : wizardActionLabel}
              </button>
              <button type="button" className="secondary-button text-sm" onClick={goBack} disabled={Boolean(wizardBusy)}>
                Back
              </button>
              <button
                type="button"
                className="secondary-button text-sm"
                onClick={() => {
                  if (!oracleAddressInput) return;
                  void claimOracle(oracleAddressInput);
                }}
                disabled={Boolean(wizardBusy) || !oracleAddressInput}
              >
                Claim now
              </button>
            </div>

            {normalize(oracleAddressInput) && walletAddress !== normalize(oracleAddressInput) ? (
              <p className="field-help">
                After registration, have the oracle signer open {" "}
                <Link href={`/oracles?claim=${encodeURIComponent(normalize(oracleAddressInput))}`} className="text-[var(--primary)] underline">
                  /oracles?claim={normalize(oracleAddressInput)}
                </Link>
                {" "}and submit claim.
              </p>
            ) : null}
          </div>
        ) : null}

        {wizardError ? <p className="field-error">{wizardError}</p> : null}
        {wizardSuccess ? <p className="text-sm text-[var(--success)]">{wizardSuccess}</p> : null}
        {claimError ? <p className="field-error">{claimError}</p> : null}
        {claimSuccess ? <p className="text-sm text-[var(--success)]">{claimSuccess}</p> : null}
      </section>

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

          {!verificationApprovals.length && selectedVerificationOracle ? (
            <p className="field-help">
              Selected oracle has no pool approvals yet. Configure pool approval first.
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
