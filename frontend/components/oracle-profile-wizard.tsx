// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  resolveOracleWizardBootstrapState,
  type OracleWizardBlockingError,
} from "@/lib/oracle-profile-wizard-bootstrap";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  ORACLE_TYPE_HEALTH_APP,
  ORACLE_TYPE_HOSPITAL_CLINIC,
  ORACLE_TYPE_LAB,
  ORACLE_TYPE_OTHER,
  ORACLE_TYPE_WEARABLE_DATA_PROVIDER,
  buildClaimOracleTx,
  buildRegisterOracleTx,
  buildUpdateOracleProfileTx,
  listOraclesWithProfiles,
  listSchemas,
  type OracleWithProfileSummary,
  type SchemaSummary,
} from "@/lib/protocol";
import { fetchSchemaMetadata, parseSchemaOutcomes } from "@/lib/schema-metadata";

type WizardMode = "register" | "update";
type StepId = "basics" | "capabilities" | "review";
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

type StepDescriptor = {
  id: StepId;
  number: string;
  label: string;
};

type StepCopy = {
  headline: string;
  emphasis: string;
  body: string;
  tip: string;
};

const ORACLE_TYPES = [
  { value: ORACLE_TYPE_LAB, label: "Lab" },
  { value: ORACLE_TYPE_HOSPITAL_CLINIC, label: "Hospital / Clinic" },
  { value: ORACLE_TYPE_HEALTH_APP, label: "Health App" },
  { value: ORACLE_TYPE_WEARABLE_DATA_PROVIDER, label: "Wearable / Data Provider" },
  { value: ORACLE_TYPE_OTHER, label: "Other" },
] as const;

const STEPS: StepDescriptor[] = [
  { id: "basics", number: "01", label: "Basics" },
  { id: "capabilities", number: "02", label: "Capabilities" },
  { id: "review", number: "03", label: "Review" },
];

const STEP_COPY: Record<WizardMode, Record<StepId, StepCopy>> = {
  register: {
    basics: {
      headline: "Publish the identity for a new",
      emphasis: "Oracle Operator.",
      body: "Start with the signer, display name, and public-facing organization details that will anchor this operator on-chain.",
      tip: "Treat the signer and display name as durable public identifiers. This route is for publishing a real operator profile, not a temporary sandbox alias.",
    },
    capabilities: {
      headline: "Describe the metadata and schema",
      emphasis: "Coverage Surface.",
      body: "Attach the URLs, webhook target, and supported outcome schemas that define what this oracle can attest to inside OmegaX.",
      tip: "Keep the supported schema set narrow and understandable. A crisp capability surface is easier to audit than a broad but vague operator profile.",
    },
    review: {
      headline: "Review the profile, confirm the record, and plan the",
      emphasis: "Claim Handoff.",
      body: "Registration creates the structured on-chain profile. Claim activation still belongs to the oracle signing wallet after the profile confirms.",
      tip: "If the connected wallet is not the signer wallet, send the claim handoff link immediately after confirmation so the profile does not remain unclaimed.",
    },
  },
  update: {
    basics: {
      headline: "Inspect the locked operator identity before editing the live",
      emphasis: "Profile Record.",
      body: "Update mode preserves the selected oracle signer and lets you revise the published organization details around that identity.",
      tip: "Do not treat update as identity rotation. If the signer must change, create the replacement operator explicitly rather than mutating the existing one.",
    },
    capabilities: {
      headline: "Refine the metadata and schema",
      emphasis: "Capability Surface.",
      body: "Adjust the public links, webhook target, and supported schema commitments without changing the underlying oracle identity.",
      tip: "Use update to sharpen the operator’s published capabilities, not to turn one oracle into a catch-all profile for unrelated attestations.",
    },
    review: {
      headline: "Review the live changes before you",
      emphasis: "Save Profile.",
      body: "The final step summarizes the edited record, shows current claim posture, and lets you submit the updated profile in one scoped action.",
      tip: "If the profile is still unclaimed, use this checkpoint to coordinate the claim flow with the signer wallet after the update is saved.",
    },
  },
};

function normalize(value: string): string {
  return value.trim();
}

function shortAddress(value: string): string {
  if (!value) return "n/a";
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="plans-wizard-field-group">
      <span className="plans-wizard-field-label">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="plans-wizard-review-row">
      <span className="plans-wizard-review-label">{label}</span>
      <strong className={cn("plans-wizard-review-value", muted && "opacity-70")}>{value}</strong>
    </div>
  );
}

type OracleProfileWizardProps = {
  mode: WizardMode;
  oracleAddress?: string;
};

export function OracleProfileWizard({ mode, oracleAddress = "" }: OracleProfileWizardProps) {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();

  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [blockingError, setBlockingError] = useState<OracleWizardBlockingError | null>(null);
  const [schemaCatalogWarning, setSchemaCatalogWarning] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [loadedProfile, setLoadedProfile] = useState<OracleWithProfileSummary | null>(null);

  const [oracleAddressInput, setOracleAddressInput] = useState("");
  const [oracleType, setOracleType] = useState<number>(ORACLE_TYPE_LAB);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [logoUri, setLogoUri] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [schemasSearch, setSchemasSearch] = useState("");
  const [verifiedOnlySchemas, setVerifiedOnlySchemas] = useState(true);
  const [selectedSchemaHashes, setSelectedSchemaHashes] = useState<string[]>([]);
  const [manualSchemaHash, setManualSchemaHash] = useState("");
  const [schemaPreviewByHash, setSchemaPreviewByHash] = useState<Record<string, SchemaPreview>>({});

  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() ?? "";
  const normalizedRouteOracle = normalize(oracleAddress);
  const routeOracleValid = mode === "register" ? true : isPublicKey(normalizedRouteOracle);
  const copy = STEP_COPY[mode][STEPS[stepIndex]?.id ?? "basics"];
  const activeStep = STEPS[stepIndex] ?? STEPS[0];
  const isFirstStep = stepIndex === 0;
  const normalizedOracleAddress = normalize(oracleAddressInput);
  const normalizedSelectedSet = useMemo(() => new Set(selectedSchemaHashes), [selectedSchemaHashes]);
  const submitSucceeded = statusTone === "ok" && Boolean(statusMessage);

  const clearMessages = useCallback(() => {
    setStatusMessage(null);
    setStatusTone(null);
    setTxUrl(null);
    setClaimError(null);
    setClaimSuccess(null);
  }, []);

  const schemaByHash = useMemo(() => {
    const map = new Map<string, SchemaSummary>();
    for (const schema of schemas) {
      map.set(normalizeHex32(schema.schemaKeyHashHex), schema);
    }
    return map;
  }, [schemas]);

  const filteredSchemas = useMemo(() => {
    const query = normalize(schemasSearch).toLowerCase();
    return schemas
      .filter((row) => (verifiedOnlySchemas ? row.verified : true))
      .filter((row) => {
        if (!query) return true;
        return (
          row.schemaKey.toLowerCase().includes(query)
          || row.schemaKeyHashHex.toLowerCase().includes(query)
          || row.metadataUri.toLowerCase().includes(query)
        );
      });
  }, [schemas, schemasSearch, verifiedOnlySchemas]);

  const previewHashes = useMemo(() => Array.from(new Set(selectedSchemaHashes.map((hash) => normalizeHex32(hash)))), [selectedSchemaHashes]);

  const selectedSchemaCoverage = useMemo(
    () => selectedSchemaHashes.reduce((sum, hash) => sum + (schemaPreviewByHash[normalizeHex32(hash)]?.outcomeCount ?? 0), 0),
    [schemaPreviewByHash, selectedSchemaHashes],
  );

  const claimHref = useMemo(
    () => (normalizedOracleAddress ? `/oracles?tab=registry&claim=${encodeURIComponent(normalizedOracleAddress)}` : "/oracles?tab=registry"),
    [normalizedOracleAddress],
  );

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
          warning: "No indexed schema entry is currently visible for this hash.",
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

  const loadWizardData = useCallback(async () => {
    setLoading(true);
    setBlockingError(null);
    setSchemaCatalogWarning(null);
    if (mode === "register") {
      setLoadedProfile(null);
    }
    try {
      const [schemasResult, oraclesResult] = await Promise.allSettled([
        listSchemas({ connection, verifiedOnly: false }),
        mode === "update"
          ? listOraclesWithProfiles({ connection, activeOnly: false })
          : Promise.resolve([] as OracleWithProfileSummary[]),
      ]);
      const nextState = resolveOracleWizardBootstrapState({
        mode,
        normalizedRouteOracle,
        routeOracleValid,
        rpcEndpoint: connection.rpcEndpoint,
        schemasResult,
        oraclesResult,
      });

      setSchemas(nextState.schemas);
      setSchemaCatalogWarning(nextState.schemaCatalogWarning);
      setBlockingError(nextState.blockingError);

      if (nextState.profile) {
        setLoadedProfile(nextState.profile);
        setOracleAddressInput(nextState.profile.profile.oracle);
        setOracleType(nextState.profile.profile.oracleType);
        setDisplayName(nextState.profile.profile.displayName);
        setLegalName(nextState.profile.profile.legalName);
        setWebsiteUrl(nextState.profile.profile.websiteUrl);
        setAppUrl(nextState.profile.profile.appUrl);
        setLogoUri(nextState.profile.profile.logoUri);
        setWebhookUrl(nextState.profile.profile.webhookUrl);
        setSelectedSchemaHashes(
          Array.from(
            new Set(
              nextState.profile.profile.supportedSchemaKeyHashesHex
                .map((hash) => normalizeHex32(hash))
                .filter((hash) => isHex32(hash)),
            ),
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [connection, mode, normalizedRouteOracle, routeOracleValid]);

  useEffect(() => {
    void loadWizardData();
  }, [loadWizardData]);

  useEffect(() => {
    if (!connected || mode !== "register") return;
    if (!oracleAddressInput && walletAddress) {
      setOracleAddressInput(walletAddress);
    }
  }, [connected, mode, oracleAddressInput, walletAddress]);

  useEffect(() => {
    for (const hash of previewHashes) {
      if (!schemaPreviewByHash[hash]) {
        void loadSchemaPreview(hash);
      }
    }
  }, [loadSchemaPreview, previewHashes, schemaPreviewByHash]);

  useEffect(() => {
    if (activeStep.id !== "capabilities") return;
    for (const schema of filteredSchemas.slice(0, 8)) {
      const hash = normalizeHex32(schema.schemaKeyHashHex);
      if (!schemaPreviewByHash[hash]) {
        void loadSchemaPreview(hash);
      }
    }
  }, [activeStep.id, filteredSchemas, loadSchemaPreview, schemaPreviewByHash]);

  const basicsError = useMemo(() => {
    if (!connected || !publicKey || !sendTransaction) return "Connect a wallet to continue.";
    if (!normalizedOracleAddress) return "Oracle signing pubkey is required.";
    if (!isPublicKey(normalizedOracleAddress)) return "Oracle signing pubkey is invalid.";
    if (!normalize(displayName)) return "Display name is required.";
    return null;
  }, [connected, displayName, normalizedOracleAddress, publicKey, sendTransaction]);

  const capabilitiesError = useMemo(() => {
    if (selectedSchemaHashes.length > 16) return "Maximum supported schemas is 16.";
    return null;
  }, [selectedSchemaHashes.length]);

  const validateStep = useCallback((stepId: StepId): string | null => {
    if (stepId === "basics") return basicsError;
    if (stepId === "capabilities") return capabilitiesError;
    return basicsError ?? capabilitiesError;
  }, [basicsError, capabilitiesError]);

  const goToStep = useCallback((nextIndex: number) => {
    if (nextIndex <= stepIndex) {
      setStepIndex(nextIndex);
      return;
    }
    for (let index = stepIndex; index < nextIndex; index += 1) {
      const issue = validateStep(STEPS[index]!.id);
      if (issue) {
        setStatusMessage(issue);
        setStatusTone("error");
        setStepIndex(index);
        return;
      }
    }
    setStatusMessage(null);
    setStatusTone(null);
    setStepIndex(nextIndex);
  }, [stepIndex, validateStep]);

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    clearMessages();
    setStepIndex((current) => Math.max(0, current - 1));
  }, [clearMessages, isFirstStep]);

  const addManualSchemaHash = useCallback(() => {
    const normalizedHash = normalizeHex32(manualSchemaHash);
    if (!isHex32(normalizedHash)) {
      setStatusMessage("Manual schema hash must be 32-byte hex (64 chars).");
      setStatusTone("error");
      return;
    }
    setSelectedSchemaHashes((current) => {
      if (current.includes(normalizedHash)) return current;
      return [...current, normalizedHash];
    });
    setManualSchemaHash("");
    setStatusMessage(null);
    setStatusTone(null);
  }, [manualSchemaHash]);

  const toggleSchemaHash = useCallback((hashHex: string) => {
    const normalizedHash = normalizeHex32(hashHex);
    setSelectedSchemaHashes((current) =>
      current.includes(normalizedHash)
        ? current.filter((row) => row !== normalizedHash)
        : [...current, normalizedHash],
    );
    setStatusMessage(null);
    setStatusTone(null);
  }, []);

  const submitProfile = useCallback(async () => {
    const issue = validateStep("review");
    if (issue) {
      setStatusMessage(issue);
      setStatusTone("error");
      return;
    }
    if (!publicKey || !sendTransaction || !connected) {
      setStatusMessage("Connect a wallet before sending transactions.");
      setStatusTone("error");
      return;
    }

    setBusyAction(mode);
    setClaimError(null);
    setClaimSuccess(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = mode === "register"
        ? buildRegisterOracleTx({
          admin: publicKey,
          oracle: new PublicKey(normalizedOracleAddress),
          recentBlockhash: blockhash,
          oracleType,
          displayName,
          legalName,
          websiteUrl,
          appUrl,
          logoUri,
          webhookUrl,
          supportedSchemaKeyHashesHex: selectedSchemaHashes,
        })
        : buildUpdateOracleProfileTx({
          authority: publicKey,
          oracle: new PublicKey(normalizedRouteOracle),
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

      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: mode === "register" ? "Register oracle profile" : "Update oracle profile",
      });

      if (!result.ok) {
        setStatusMessage(result.error);
        setStatusTone("error");
        setTxUrl(null);
        return;
      }

      setStatusMessage(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
      await loadWizardData();
    } finally {
      setBusyAction(null);
    }
  }, [
    appUrl,
    connected,
    connection,
    displayName,
    legalName,
    loadWizardData,
    logoUri,
    mode,
    normalizedOracleAddress,
    normalizedRouteOracle,
    oracleType,
    publicKey,
    selectedSchemaHashes,
    sendTransaction,
    validateStep,
    webhookUrl,
    websiteUrl,
  ]);

  const claimOracle = useCallback(async () => {
    if (!normalizedOracleAddress || !isPublicKey(normalizedOracleAddress)) return;
    if (!publicKey || !sendTransaction || !connected) {
      setClaimError("Connect the oracle signing wallet to claim activation.");
      return;
    }
    if (walletAddress !== normalizedOracleAddress) {
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
      setTxUrl(result.explorerUrl);
      await loadWizardData();
    } finally {
      setClaimBusy(false);
    }
  }, [connected, connection, loadWizardData, normalizedOracleAddress, publicKey, sendTransaction, walletAddress]);

  const showClaimHelper = useMemo(() => {
    if (!normalizedOracleAddress || !isPublicKey(normalizedOracleAddress)) return false;
    if (mode === "register") return true;
    return Boolean(loadedProfile?.profile && !loadedProfile.profile.claimed);
  }, [loadedProfile?.profile, mode, normalizedOracleAddress]);

  const canClaimDirectly = useMemo(() => {
    if (!showClaimHelper || !connected || !sendTransaction) return false;
    if (walletAddress !== normalizedOracleAddress) return false;
    if (mode === "register") return submitSucceeded;
    return true;
  }, [connected, mode, normalizedOracleAddress, sendTransaction, showClaimHelper, submitSucceeded, walletAddress]);

  const claimHelperCopy = useMemo(() => {
    if (!showClaimHelper) return null;
    if (mode === "register") {
      if (!submitSucceeded) {
        return "Registration creates the profile first. Claim activation unlocks after the registration transaction confirms.";
      }
      if (canClaimDirectly) {
        return "The connected wallet matches the oracle signer, so you can claim activation immediately from this review step.";
      }
      return "The connected wallet does not match the oracle signer. Hand the claim link to the signer wallet after registration confirms.";
    }
    if (canClaimDirectly) {
      return "This profile is still unclaimed and the connected wallet matches the signer, so claim activation can happen immediately.";
    }
    return "This profile is still unclaimed. Hand the claim link to the oracle signer wallet to finish activation.";
  }, [canClaimDirectly, mode, showClaimHelper, submitSucceeded]);

  const reviewExplorerLabel = txUrl && statusTone === "ok" ? "View latest transaction" : "Open explorer";
  const blockingErrorMeta = useMemo(() => {
    if (!blockingError) return null;
    if (blockingError.kind === "invalid_route") {
      return {
        headlinePrefix: "This wizard needs a valid",
        headlineEmphasis: "oracle route.",
        body: "Update mode can only edit a published structured profile for a valid signer address.",
        label: "[ROUTE_CHECK]",
        tip: "The route parameter is not a valid Solana signer address.",
      };
    }
    if (blockingError.kind === "profile_missing") {
      return {
        headlinePrefix: "This wizard needs a published",
        headlineEmphasis: "oracle profile.",
        body: "Update mode can only edit a published structured profile. If this signer does not have one yet, start from the register route instead.",
        label: "[PROFILE_CHECK]",
        tip: "The route is valid, but the profile is not currently visible on this network.",
      };
    }
    return {
      headlinePrefix: "The wizard could not load its live",
      headlineEmphasis: "network context.",
      body: mode === "register"
        ? "Register mode can proceed once the network state is reachable again, but the current RPC endpoint did not return the bootstrap data needed for this session."
        : "Update mode needs live network data before it can safely load the selected operator profile.",
      label: "[NETWORK_CHECK]",
      tip: "Retry once the RPC endpoint recovers or switch to a healthier endpoint.",
    };
  }, [blockingError, mode]);

  if (loading) {
    return (
      <div className="plans-shell">
        <div className="plans-wizard-scroll">
          <header className="plans-wizard-header">
            <div className="plans-wizard-header-ident">
              <span className="plans-wizard-wordmark">PROTOCOL_CONSOLE</span>
              <span className="plans-wizard-header-divider" aria-hidden="true" />
              <span className="plans-wizard-header-label">{mode === "register" ? "Oracle Profile Register" : "Oracle Profile Update"}</span>
            </div>
            <Link href="/oracles?tab=registry" className="plans-wizard-cancel">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
              CANCEL_FLOW
            </Link>
          </header>

          <section className="plans-wizard-body">
            <aside className="plans-wizard-prompt">
              <h1 className="plans-wizard-headline">
                Preparing the <em>oracle wizard.</em>
              </h1>
              <p className="plans-wizard-body-text">
                Loading the public schema catalog, existing profile data, and current network state for this operator flow.
              </p>
            </aside>
            <div className="plans-wizard-form heavy-glass">
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading oracle wizard state...
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (blockingError && blockingErrorMeta) {
    return (
      <div className="plans-shell">
        <div className="plans-wizard-scroll">
          <header className="plans-wizard-header">
            <div className="plans-wizard-header-ident">
              <span className="plans-wizard-wordmark">PROTOCOL_CONSOLE</span>
              <span className="plans-wizard-header-divider" aria-hidden="true" />
              <span className="plans-wizard-header-label">{mode === "register" ? "Oracle Profile Register" : "Oracle Profile Update"}</span>
            </div>
            <Link href="/oracles?tab=registry" className="plans-wizard-cancel">
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
              CANCEL_FLOW
            </Link>
          </header>

          <section className="plans-wizard-body">
            <aside className="plans-wizard-prompt">
              <h1 className="plans-wizard-headline">
                {blockingErrorMeta.headlinePrefix} <em>{blockingErrorMeta.headlineEmphasis}</em>
              </h1>
              <p className="plans-wizard-body-text">{blockingErrorMeta.body}</p>
              <div className="plans-wizard-tip">
                <span className="plans-wizard-tip-label">{blockingErrorMeta.label}</span>
                <p>{blockingErrorMeta.tip}</p>
              </div>
            </aside>

            <div className="plans-wizard-form heavy-glass">
              <div className="plans-wizard-support-grid">
                <article className="plans-wizard-support-card">
                  <h2 className="plans-wizard-support-title">Oracle wizard unavailable</h2>
                  <p className="plans-wizard-support-copy">{blockingError.message}</p>
                  <div className="plans-wizard-support-actions">
                    <Link href="/oracles/register" className="action-button w-fit">
                      Register oracle
                    </Link>
                    <Link href="/oracles?tab=registry" className="secondary-button w-fit">
                      Back to registry
                    </Link>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="plans-shell">
      <div className="plans-wizard-scroll">
        <header className="plans-wizard-header">
          <div className="plans-wizard-header-ident">
            <span className="plans-wizard-wordmark">PROTOCOL_CONSOLE</span>
            <span className="plans-wizard-header-divider" aria-hidden="true" />
            <span className="plans-wizard-header-label">{mode === "register" ? "Oracle Profile Register" : "Oracle Profile Update"}</span>
          </div>
          <Link href="/oracles?tab=registry" className="plans-wizard-cancel">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
            CANCEL_FLOW
          </Link>
        </header>

        <nav className="plans-wizard-progress-wrap" aria-label="Oracle wizard steps">
          <div className="plans-wizard-progress liquid-glass">
            <div
              className="plans-wizard-progress-indicator"
              style={{ width: `${100 / STEPS.length}%`, transform: `translateX(${stepIndex * 100}%)` }}
              aria-hidden="true"
            />
            {STEPS.map((step, index) => {
              const isActive = index === stepIndex;
              const isPast = index < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={cn(
                    "plans-wizard-step",
                    isActive && "plans-wizard-step-active",
                    isPast && "plans-wizard-step-past",
                  )}
                  onClick={() => goToStep(index)}
                  disabled={Boolean(busyAction) || claimBusy}
                >
                  <span className="plans-wizard-step-number">{step.number}</span>
                  <span className="plans-wizard-step-label">{step.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <section className="plans-wizard-body">
          <aside className="plans-wizard-prompt">
            <h1 className="plans-wizard-headline">
              {copy.headline} <em>{copy.emphasis}</em>
            </h1>
            <p className="plans-wizard-body-text">{copy.body}</p>
            <div className="plans-wizard-tip">
              <span className="plans-wizard-tip-label">[ORACLE_TIP]</span>
              <p>{copy.tip}</p>
            </div>
          </aside>

          <div className="plans-wizard-form heavy-glass">
            {schemaCatalogWarning ? (
              <div className="rounded-2xl border border-[rgba(176,112,14,0.26)] bg-[rgba(176,112,14,0.10)] px-4 py-3 text-sm text-[var(--warning)]">
                {schemaCatalogWarning}
              </div>
            ) : null}

            {statusMessage ? (
              <div className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                statusTone === "error"
                  ? "border-[rgba(186,26,26,0.22)] bg-[rgba(186,26,26,0.08)] text-[var(--danger)]"
                  : "border-[rgba(25,180,122,0.2)] bg-[rgba(25,180,122,0.08)] text-[var(--success)]",
              )}>
                {statusMessage}
              </div>
            ) : null}

            {activeStep.id === "basics" ? (
              <div className="plans-wizard-step-body">
                <div className="plans-wizard-row">
                  <FieldGroup label="Admin wallet">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={walletAddress || "Not connected"}
                      readOnly
                    />
                  </FieldGroup>
                  <FieldGroup label="Oracle signing pubkey">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={mode === "update" ? normalizedRouteOracle : oracleAddressInput}
                      onChange={(event) => {
                        if (mode === "update") return;
                        setOracleAddressInput(event.target.value);
                        clearMessages();
                      }}
                      readOnly={mode === "update"}
                    />
                  </FieldGroup>
                </div>

                <div className="plans-wizard-row">
                  <FieldGroup label="Display name">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                        clearMessages();
                      }}
                    />
                  </FieldGroup>
                  <FieldGroup label="Oracle type">
                    <select
                      className="plans-wizard-input"
                      value={String(oracleType)}
                      onChange={(event) => {
                        setOracleType(Number.parseInt(event.target.value, 10));
                        clearMessages();
                      }}
                    >
                      {ORACLE_TYPES.map((row) => (
                        <option key={row.value} value={row.value}>{row.label}</option>
                      ))}
                    </select>
                  </FieldGroup>
                </div>

                <FieldGroup label="Legal name">
                  <input
                    type="text"
                    className="plans-wizard-input plans-wizard-input-lg"
                    value={legalName}
                    onChange={(event) => {
                      setLegalName(event.target.value);
                      clearMessages();
                    }}
                    placeholder="Optional legal entity name"
                  />
                </FieldGroup>

                <div className="plans-wizard-support-grid">
                  <article className="plans-wizard-support-card">
                    <h2 className="plans-wizard-support-title">Operator identity</h2>
                    <p className="plans-wizard-support-copy">
                      {mode === "register"
                        ? "The signer wallet, display name, and oracle type form the stable identity layer for a new operator profile."
                        : "Update mode keeps the signer locked to the selected oracle and only edits the surrounding public profile metadata."}
                    </p>
                  </article>
                </div>
              </div>
            ) : null}

            {activeStep.id === "capabilities" ? (
              <div className="plans-wizard-step-body">
                <div className="plans-wizard-row">
                  <FieldGroup label="Website URL">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={websiteUrl}
                      onChange={(event) => {
                        setWebsiteUrl(event.target.value);
                        clearMessages();
                      }}
                      placeholder="https://oracle.yourorg.com"
                    />
                  </FieldGroup>
                  <FieldGroup label="App URL">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={appUrl}
                      onChange={(event) => {
                        setAppUrl(event.target.value);
                        clearMessages();
                      }}
                      placeholder="Optional operator dashboard URL"
                    />
                  </FieldGroup>
                </div>

                <div className="plans-wizard-row">
                  <FieldGroup label="Logo URI">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={logoUri}
                      onChange={(event) => {
                        setLogoUri(event.target.value);
                        clearMessages();
                      }}
                      placeholder="ipfs://... or a public HTTPS logo URL"
                    />
                  </FieldGroup>
                  <FieldGroup label="Webhook URL">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={webhookUrl}
                      onChange={(event) => {
                        setWebhookUrl(event.target.value);
                        clearMessages();
                      }}
                      placeholder="https://oracle.company.com/attest"
                    />
                  </FieldGroup>
                </div>

                <div className="plans-wizard-divider" aria-hidden="true" />

                <div className="space-y-4">
                  <div className="plans-wizard-row">
                    <FieldGroup label="Filter supported schemas">
                      <input
                        type="text"
                        className="plans-wizard-input"
                        value={schemasSearch}
                        onChange={(event) => setSchemasSearch(event.target.value)}
                        placeholder="Search by schema key, hash, or URI"
                      />
                    </FieldGroup>
                    <FieldGroup label="Verified schema posture">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={cn("plans-wizard-chip", verifiedOnlySchemas && "plans-wizard-chip-active")}
                          onClick={() => setVerifiedOnlySchemas(true)}
                        >
                          VERIFIED_ONLY
                        </button>
                        <button
                          type="button"
                          className={cn("plans-wizard-chip", !verifiedOnlySchemas && "plans-wizard-chip-active")}
                          onClick={() => setVerifiedOnlySchemas(false)}
                        >
                          SHOW_ALL
                        </button>
                      </div>
                    </FieldGroup>
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-[var(--border)]/50 divide-y divide-[var(--border)]/35">
                    {filteredSchemas.map((schema) => {
                      const normalizedHash = normalizeHex32(schema.schemaKeyHashHex);
                      const selected = normalizedSelectedSet.has(normalizedHash);
                      const preview = schemaPreviewByHash[normalizedHash];
                      return (
                        <label key={schema.address} className="flex items-start gap-3 px-4 py-3 text-sm">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSchemaHash(schema.schemaKeyHashHex)}
                          />
                          <span className="min-w-0 space-y-1">
                            <span className="block font-semibold text-[var(--foreground)] truncate">
                              {schema.schemaKey} v{schema.version}
                            </span>
                            <span className="block text-[11px] text-[var(--muted-foreground)] font-mono truncate">
                              {schema.schemaKeyHashHex}
                            </span>
                            <span className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className={`status-pill ${preview?.status === "ready" ? "status-ok" : "status-off"}`}>
                                {preview ? previewStatusLabel(preview.status) : "Preview pending"}
                              </span>
                              <span className="text-[var(--muted-foreground)]">
                                {preview ? `${preview.outcomeCount} outcomes • ${preview.templateCount} templates` : schema.verified ? "Verified schema" : "Unverified schema"}
                              </span>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {filteredSchemas.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[var(--muted-foreground)]">No schemas match the current filter.</p>
                    ) : null}
                  </div>

                  <p className="wizard-inline-copy">
                    Selected supported schema hashes: {selectedSchemaHashes.length} / 16 • Previewed outcomes: {selectedSchemaCoverage}
                  </p>

                  {selectedSchemaHashes.length > 0 ? (
                    <div className="plans-wizard-support-grid">
                      <article className="plans-wizard-support-card">
                        <h2 className="plans-wizard-support-title">Selected schema commitments</h2>
                        <div className="plans-wizard-log-list">
                          {selectedSchemaHashes.map((hash) => {
                            const normalizedHash = normalizeHex32(hash);
                            const preview = schemaPreviewByHash[normalizedHash];
                            const schema = schemaByHash.get(normalizedHash);
                            return (
                              <div key={normalizedHash} className="plans-wizard-log-card">
                                <strong className="text-sm text-[var(--foreground)]">
                                  {schema ? `${schema.schemaKey} v${schema.version}` : normalizedHash}
                                </strong>
                                <p className="plans-wizard-support-note">
                                  {preview ? `${preview.outcomeCount} outcomes • ${preview.templateCount} templates` : "Preview pending"}
                                </p>
                                {preview?.warning ? <p className="plans-wizard-support-note">{preview.warning}</p> : null}
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    </div>
                  ) : null}

                  <details className="rounded-xl border border-[var(--border)]/45 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Advanced fields</summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex gap-2">
                        <input
                          className="plans-wizard-input"
                          value={manualSchemaHash}
                          onChange={(event) => setManualSchemaHash(event.target.value)}
                          placeholder="Manual schema hash (32-byte hex)"
                        />
                        <button type="button" className="secondary-button w-fit" onClick={addManualSchemaHash}>
                          Add
                        </button>
                      </div>
                      <p className="plans-wizard-support-note">
                        Webhook URLs and manual schema hashes are public commitments. Do not include secrets or private infrastructure tokens.
                      </p>
                    </div>
                  </details>
                </div>
              </div>
            ) : null}

            {activeStep.id === "review" ? (
              <div className="plans-wizard-step-body">
                <div className="plans-wizard-support-grid">
                  <article className="plans-wizard-support-card">
                    <h2 className="plans-wizard-support-title">Profile identity</h2>
                    <div className="plans-wizard-review-grid">
                      <ReviewRow label="Admin wallet" value={walletAddress || "Not connected"} muted={!walletAddress} />
                      <ReviewRow label="Oracle signer" value={normalizedOracleAddress || "Missing"} muted={!normalizedOracleAddress} />
                      <ReviewRow label="Display name" value={displayName || "Missing"} muted={!displayName} />
                      <ReviewRow label="Oracle type" value={oracleTypeLabel(oracleType)} />
                      <ReviewRow label="Legal name" value={legalName || "—"} muted={!legalName} />
                    </div>
                  </article>

                  <article className="plans-wizard-support-card">
                    <h2 className="plans-wizard-support-title">Capability surface</h2>
                    <div className="plans-wizard-review-grid">
                      <ReviewRow label="Website" value={websiteUrl || "—"} muted={!websiteUrl} />
                      <ReviewRow label="App URL" value={appUrl || "—"} muted={!appUrl} />
                      <ReviewRow label="Logo URI" value={logoUri || "—"} muted={!logoUri} />
                      <ReviewRow label="Webhook" value={webhookUrl || "—"} muted={!webhookUrl} />
                      <ReviewRow label="Schemas" value={String(selectedSchemaHashes.length)} />
                      <ReviewRow label="Previewed outcomes" value={String(selectedSchemaCoverage)} />
                    </div>
                  </article>
                </div>

                {showClaimHelper ? (
                  <div className="plans-wizard-support-grid">
                    <article className="plans-wizard-support-card">
                      <h2 className="plans-wizard-support-title">Claim posture</h2>
                      <p className="plans-wizard-support-copy">{claimHelperCopy}</p>
                      {mode === "update" ? (
                        <p className="plans-wizard-support-note">
                          Current claim state: {loadedProfile?.profile?.claimed ? "Claimed" : "Pending claim"}.
                        </p>
                      ) : null}
                      <div className="plans-wizard-support-actions">
                        {canClaimDirectly ? (
                          <button
                            type="button"
                            className="action-button w-fit"
                            onClick={() => void claimOracle()}
                            disabled={claimBusy}
                          >
                            {claimBusy ? "Claiming..." : "Claim oracle now"}
                          </button>
                        ) : null}
                        <Link href={claimHref} className="secondary-button w-fit">
                          Open claim handoff
                        </Link>
                      </div>
                    </article>
                  </div>
                ) : null}

                {(submitSucceeded || claimSuccess) ? (
                  <div className="plans-wizard-support-grid">
                    <article className="plans-wizard-support-card">
                      <div className="flex items-center gap-2 text-[var(--success)]">
                        <CheckCircle2 className="h-4 w-4" />
                        <h2 className="plans-wizard-support-title">Latest action confirmed</h2>
                      </div>
                      <p className="plans-wizard-support-copy">{claimSuccess || statusMessage}</p>
                      <div className="plans-wizard-support-actions">
                        <Link href="/oracles?tab=registry" className="secondary-button w-fit">
                          Back to registry
                        </Link>
                        {txUrl ? (
                          <a href={txUrl} target="_blank" rel="noreferrer" className="secondary-button w-fit">
                            {reviewExplorerLabel}
                          </a>
                        ) : null}
                      </div>
                    </article>
                  </div>
                ) : null}
              </div>
            ) : null}

            {claimError ? <p className="field-error">{claimError}</p> : null}

            <footer className="plans-wizard-footer">
              <button
                type="button"
                className="plans-wizard-back"
                onClick={handleBack}
                disabled={isFirstStep || Boolean(busyAction) || claimBusy}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                BACK
              </button>

              {activeStep.id !== "review" ? (
                <button
                  type="button"
                  className="plans-wizard-next"
                  onClick={() => goToStep(stepIndex + 1)}
                  disabled={Boolean(busyAction) || claimBusy}
                >
                  <span className="plans-wizard-next-label">NEXT_STEP</span>
                  <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="plans-wizard-next"
                  onClick={() => void submitProfile()}
                  disabled={Boolean(busyAction) || claimBusy}
                >
                  <span className="plans-wizard-next-label">
                    {busyAction
                      ? "SUBMITTING"
                      : mode === "register"
                        ? "REGISTER_ORACLE"
                        : "SAVE_PROFILE"}
                  </span>
                  <ShieldCheck className="h-4 w-4" />
                </button>
              )}
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}
