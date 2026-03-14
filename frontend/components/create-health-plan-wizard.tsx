// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { cn } from "@/lib/cn";
import { buildBusinessContextHref, getBusinessEntryContext } from "@/lib/business-entry-context";
import {
  POOL_TYPE_COVERAGE,
  POOL_TYPE_REWARD,
  buildCreatePoolV2Tx,
  buildCreatePolicySeriesTx,
  buildFundPoolSolTx,
  buildFundPoolSplTx,
  buildRegisterInviteIssuerTx,
  buildSetPoolOraclePolicyTx,
  buildSetPoolOracleTx,
  buildSetPolicySeriesOutcomeRuleTx,
  defaultInsurancePayoutMintFromEnv,
  defaultRewardPayoutMintFromEnv,
  defaultTokenGateMintFromEnv,
  derivePoolAssetVaultPda,
  derivePoolOraclePda,
  derivePoolOraclePolicyPda,
  derivePoolPda,
  derivePolicySeriesPda,
  derivePoolRulePda,
  fetchProtocolReadiness,
  getProgramId,
  hashStringTo32Hex,
  isPoolIdSeedSafe,
  listOracles,
  listSchemas,
  PLAN_MODE_PROTECTION,
  PLAN_MODE_REWARD,
  POLICY_SERIES_STATUS_ACTIVE,
  poolIdByteLength,
  SPONSOR_MODE_DIRECT,
  toExplorerLink,
  type OracleSummary,
  type SchemaSummary,
} from "@/lib/protocol";
import { fetchSchemaMetadata, parseSchemaOutcomes, type SchemaOutcomeOption } from "@/lib/schema-metadata";
import { getAssociatedTokenAddress, getMintDecimals, parseUiAmountToBaseUnits } from "@/lib/spl";
import { StepEligibility } from "@/components/plan-wizard/step-eligibility";
import { StepFundingReview } from "@/components/plan-wizard/step-funding-review";
import { StepOutcomesRules } from "@/components/plan-wizard/step-outcomes-rules";
import type { OutcomeRuleRow } from "@/components/plan-wizard/step-outcomes-rules";
import { StepTypeBasics } from "@/components/plan-wizard/step-type-basics";
import { StepVerification } from "@/components/plan-wizard/step-verification";

type PlanType = "rewards" | "insurance" | "hybrid";
type MembershipMode = "open" | "token_gate" | "invite_only";
type PayoutAssetMode = "sol" | "spl";
type CoveragePathway = "" | "defi_native" | "rwa_policy";
type DefiSettlementMode = "" | "onchain_programmatic" | "hybrid_rails";
type StepId = "type-basics" | "eligibility" | "verification" | "outcomes-rules" | "funding-review";
const ENABLE_RWA_POLICY = process.env.NEXT_PUBLIC_ENABLE_RWA_POLICY === "true";

type DefiSettings = {
  settlementMode: DefiSettlementMode;
  technicalTermsUri: string;
  riskDisclosureUri: string;
};

type RwaSettings = {
  legalEntityName: string;
  jurisdiction: string;
  policyTermsUri: string;
  regulatoryLicenseRef: string;
  complianceContact: string;
};

type ActionLog = {
  id: string;
  action: string;
  message: string;
  signature?: string;
  at: number;
};

type RuleEdit = {
  ruleId: string;
  ruleHashOverride: string;
  payoutHashOverride: string;
};

type RulePreview = {
  ruleHashHex: string;
  payoutHashHex: string;
};

const ZERO_PUBKEY = "11111111111111111111111111111111";
const OMEGAX_REWARD_MINT = "4Aar9R14YMbEie6yh8WcH1gWXrBtfucoFjw6SpjXpump";
const ORACLE_CHUNK_SIZE = 4;
const RULE_CHUNK_SIZE = 4;
const STANDARD_SCHEMA_KEY = process.env.NEXT_PUBLIC_STANDARD_SCHEMA_KEY?.trim() || "omegax.standard.health_outcomes";
const LOCAL_STANDARD_SCHEMA_URL = "/schemas/health_outcomes.json";

function normalize(value: string): string {
  return value.trim();
}

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function asBigInt(value: string, fallback = 0n): bigint {
  try {
    return BigInt(normalize(value));
  } catch {
    return fallback;
  }
}

function asInt(value: string, fallback = 0): number {
  const parsed = Number.parseInt(normalize(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asFloat(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(normalize(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPublicKey(value: string): boolean {
  try {
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

function isHttpOrIpfsUri(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (normalized.startsWith("ipfs://")) {
    return normalized.length > "ipfs://".length;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(value));
}

function isComplianceContact(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  return isEmail(normalized) || isHttpOrIpfsUri(normalized);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function firstBlockingReason(reasons: Array<string | null>): string | null {
  for (const reason of reasons) {
    if (reason) return reason;
  }
  return null;
}

function toMembershipModeValue(mode: MembershipMode): number {
  if (mode === "open") return 0;
  if (mode === "token_gate") return 1;
  return 2;
}

function toPoolTypeValue(planType: PlanType): number {
  return planType === "insurance" ? POOL_TYPE_COVERAGE : POOL_TYPE_REWARD;
}

function toPolicySeriesPlanMode(planType: PlanType): number {
  return planType === "insurance" ? PLAN_MODE_PROTECTION : PLAN_MODE_REWARD;
}

function defaultPolicySeriesSeed(poolSeed: string, planType: PlanType): string {
  return `${normalize(poolSeed)}:${planType === "insurance" ? "coverage" : "reward"}:series`;
}

function chunk<T>(rows: T[], size: number): T[][] {
  if (size <= 0) return [rows];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

function toBytes32(hex32: string): Uint8Array {
  const normalized = normalizeHex32(hex32);
  if (!isHex32(normalized)) throw new Error("Expected 32-byte hex.");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function resolveHex32(rawHex: string, fallbackSeed: string, label: string): Promise<string> {
  const normalized = normalizeHex32(rawHex);
  if (normalized) {
    if (!isHex32(normalized)) {
      throw new Error(`${label} must be 32-byte hex (64 chars).`);
    }
    return normalized;
  }
  if (!normalize(fallbackSeed)) {
    throw new Error(`${label} is required.`);
  }
  return hashStringTo32Hex(normalize(fallbackSeed));
}

function nextStepId(stepId: StepId): StepId | null {
  if (stepId === "type-basics") return "eligibility";
  if (stepId === "eligibility") return "verification";
  if (stepId === "verification") return "outcomes-rules";
  if (stepId === "outcomes-rules") return "funding-review";
  return null;
}

function previousStepId(stepId: StepId): StepId | null {
  if (stepId === "eligibility") return "type-basics";
  if (stepId === "verification") return "eligibility";
  if (stepId === "outcomes-rules") return "verification";
  if (stepId === "funding-review") return "outcomes-rules";
  return null;
}

function defaultPayoutMintForPlanType(planType: PlanType): string {
  if (planType === "rewards") {
    return defaultRewardPayoutMintFromEnv() || OMEGAX_REWARD_MINT;
  }
  return defaultInsurancePayoutMintFromEnv() || "";
}

function buildCoveragePathwayCommitment(
  planType: PlanType,
  coveragePathway: CoveragePathway,
  defiSettings: DefiSettings,
  rwaSettings: RwaSettings,
): string {
  if (planType === "rewards") return "";
  if (coveragePathway === "defi_native") {
    return JSON.stringify({
      pathway: "defi_native",
      settlementMode: defiSettings.settlementMode,
      technicalTermsUri: normalize(defiSettings.technicalTermsUri),
      riskDisclosureUri: normalize(defiSettings.riskDisclosureUri),
    });
  }
  if (coveragePathway === "rwa_policy") {
    return JSON.stringify({
      pathway: "rwa_policy",
      legalEntityName: normalize(rwaSettings.legalEntityName),
      jurisdiction: normalize(rwaSettings.jurisdiction),
      policyTermsUri: normalize(rwaSettings.policyTermsUri),
      regulatoryLicenseRef: normalize(rwaSettings.regulatoryLicenseRef),
      complianceContact: normalize(rwaSettings.complianceContact),
    });
  }
  return JSON.stringify({ pathway: "unselected" });
}

export function CreateHealthPlanWizard() {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const searchParams = useSearchParams();
  const businessEntry = useMemo(() => getBusinessEntryContext(searchParams), [searchParams]);
  const requiredBusinessOracle = businessEntry.requiredOracleResolved;

  const [expertMode, setExpertMode] = useState(false);
  const [openStep, setOpenStep] = useState<StepId>("type-basics");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);

  const [planType, setPlanType] = useState<PlanType>("hybrid");
  const [poolId, setPoolId] = useState("omegax-wellness-pool");
  const [organizationRef, setOrganizationRef] = useState("Corporate-HR-XYZ");
  const [metadataUri, setMetadataUri] = useState("https://protocol.omegax.health/pools/holder");
  const [payoutAssetMode, setPayoutAssetMode] = useState<PayoutAssetMode>("spl");
  const [payoutMint, setPayoutMint] = useState(defaultPayoutMintForPlanType("hybrid"));
  const [payoutTokens, setPayoutTokens] = useState("1");
  const [termsHashHex, setTermsHashHex] = useState("");
  const [payoutPolicyHashHex, setPayoutPolicyHashHex] = useState("");
  const [coveragePathway, setCoveragePathway] = useState<CoveragePathway>("");
  const [defiSettings, setDefiSettings] = useState<DefiSettings>({
    settlementMode: "",
    technicalTermsUri: "",
    riskDisclosureUri: "",
  });
  const [rwaSettings, setRwaSettings] = useState<RwaSettings>({
    legalEntityName: "",
    jurisdiction: "",
    policyTermsUri: "",
    regulatoryLicenseRef: "",
    complianceContact: "",
  });

  const [membershipMode, setMembershipMode] = useState<MembershipMode>("open");
  const [tokenGateMint, setTokenGateMint] = useState(defaultTokenGateMintFromEnv() ?? "");
  const [tokenGateMinBalance, setTokenGateMinBalance] = useState("1");
  const [inviteIssuer, setInviteIssuer] = useState("");
  const [recentCreatedPoolAddress, setRecentCreatedPoolAddress] = useState("");

  const [oracles, setOracles] = useState<OracleSummary[]>([]);
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [oracleSearch, setOracleSearch] = useState("");
  const [selectedOracles, setSelectedOracles] = useState<string[]>([]);
  const [selectorError, setSelectorError] = useState<string | null>(null);

  const [quorumM, setQuorumM] = useState("1");
  const [quorumN, setQuorumN] = useState("1");
  const [quorumManual, setQuorumManual] = useState(false);
  const [requireVerifiedSchema, setRequireVerifiedSchema] = useState(true);
  const [allowDelegateClaim, setAllowDelegateClaim] = useState(false);

  const [selectedSchemaAddress, setSelectedSchemaAddress] = useState("");
  const [schemaOutcomes, setSchemaOutcomes] = useState<SchemaOutcomeOption[]>([]);
  const [schemaWarnings, setSchemaWarnings] = useState<string[]>([]);
  const [schemaMetadataLoading, setSchemaMetadataLoading] = useState(false);
  const [selectedOutcomeIds, setSelectedOutcomeIds] = useState<string[]>([]);
  const [ruleEdits, setRuleEdits] = useState<Record<string, RuleEdit>>({});
  const [rulePreviewMap, setRulePreviewMap] = useState<Record<string, RulePreview>>({});

  const [fundSol, setFundSol] = useState("1");
  const [fundSpl, setFundSpl] = useState("100");
  const [splDecimals, setSplDecimals] = useState<number | null>(null);

  const [stepReady, setStepReady] = useState({
    pool: false,
    verification: false,
    rules: false,
    funding: false,
    inviteIssuer: false,
  });

  const normalizedPoolId = normalize(poolId);
  const poolIdBytes = poolIdByteLength(normalizedPoolId);
  const hasBusyAction = Boolean(busyAction);
  const requiresCoveragePathway = planType === "insurance" || planType === "hybrid";
  const selectedSchema = useMemo(
    () => schemas.find((entry) => entry.address === selectedSchemaAddress) ?? null,
    [schemas, selectedSchemaAddress],
  );
  const coveragePathwayCommitment = useMemo(
    () => buildCoveragePathwayCommitment(planType, coveragePathway, defiSettings, rwaSettings),
    [coveragePathway, defiSettings, planType, rwaSettings],
  );
  const walletAddress = publicKey?.toBase58() ?? "";
  const predictedPoolAddress = useMemo(() => {
    if (!publicKey || !normalizedPoolId || !isPoolIdSeedSafe(normalizedPoolId)) return null;
    return derivePoolPda({
      programId: getProgramId(),
      authority: publicKey,
      poolId: normalizedPoolId,
    }).toBase58();
  }, [normalizedPoolId, publicKey]);
  const activePoolAddress = normalize(recentCreatedPoolAddress || predictedPoolAddress || "");
  const buildPoolHref = useCallback(
    (poolAddress: string, section?: string) =>
      buildBusinessContextHref(`/pools/${poolAddress}`, businessEntry, section ? { section } : undefined),
    [businessEntry],
  );

  const duplicateRuleIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const outcomeId of selectedOutcomeIds) {
      const entry = ruleEdits[outcomeId];
      const ruleId = normalize(entry?.ruleId || outcomeId);
      if (!ruleId) continue;
      counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([ruleId]) => ruleId);
  }, [ruleEdits, selectedOutcomeIds]);

  const ruleRows = useMemo<OutcomeRuleRow[]>(
    () =>
      selectedOutcomeIds
        .map((outcomeId) => {
          const outcome = schemaOutcomes.find((entry) => entry.id === outcomeId);
          if (!outcome) return null;
          const edit = ruleEdits[outcomeId];
          const preview = rulePreviewMap[outcomeId];
          return {
            outcomeId,
            outcomeLabel: outcome.label,
            ruleId: edit?.ruleId || outcome.id,
            ruleHashOverride: edit?.ruleHashOverride || "",
            payoutHashOverride: edit?.payoutHashOverride || "",
            derivedRuleHashHex: preview?.ruleHashHex || "",
            derivedPayoutHashHex: preview?.payoutHashHex || "",
          };
        })
        .filter((entry): entry is OutcomeRuleRow => Boolean(entry)),
    [ruleEdits, rulePreviewMap, schemaOutcomes, selectedOutcomeIds],
  );

  const payoutMintPublicKey = useMemo(() => {
    try {
      return isPublicKey(payoutMint) ? new PublicKey(normalize(payoutMint)) : null;
    } catch {
      return null;
    }
  }, [payoutMint]);

  const splAmountPreview = useMemo(() => {
    if (splDecimals == null) return "";
    try {
      return parseUiAmountToBaseUnits(fundSpl, splDecimals).toString();
    } catch {
      return "";
    }
  }, [fundSpl, splDecimals]);

  const oraclePickerOptions = useMemo(
    () =>
      oracles.map((entry) => ({
        oracle: entry.oracle,
        active: entry.active,
        metadataUri: entry.metadataUri,
      })),
    [oracles],
  );
  const requiredBusinessOracleDiscovered = useMemo(
    () =>
      requiredBusinessOracle
        ? oracles.some((entry) => entry.oracle === requiredBusinessOracle)
        : false,
    [oracles, requiredBusinessOracle],
  );

  const step1BlockingReason = firstBlockingReason([
    normalizedPoolId ? null : "Health Plan ID is required.",
    isPoolIdSeedSafe(normalizedPoolId) ? null : `Pool ID exceeds 32 bytes (${poolIdBytes}/32).`,
    normalize(organizationRef) ? null : "Organization / sponsor name is required.",
    !requiresCoveragePathway ? null : (coveragePathway ? null : "Coverage pathway is required for insurance/hybrid plans."),
    !requiresCoveragePathway || coveragePathway !== "defi_native"
      ? null
      : (defiSettings.settlementMode ? null : "DeFi pathway requires a settlement mode."),
    !requiresCoveragePathway || coveragePathway !== "defi_native"
      ? null
      : (isHttpOrIpfsUri(defiSettings.technicalTermsUri) ? null : "DeFi technical terms URI must use http(s) or ipfs://."),
    !requiresCoveragePathway || coveragePathway !== "defi_native"
      ? null
      : (isHttpOrIpfsUri(defiSettings.riskDisclosureUri) ? null : "DeFi risk disclosure URI must use http(s) or ipfs://."),
    !ENABLE_RWA_POLICY || !requiresCoveragePathway || coveragePathway !== "rwa_policy"
      ? null
      : (normalize(rwaSettings.legalEntityName) ? null : "RWA pathway requires legal entity name."),
    !ENABLE_RWA_POLICY || !requiresCoveragePathway || coveragePathway !== "rwa_policy"
      ? null
      : (normalize(rwaSettings.jurisdiction) ? null : "RWA pathway requires jurisdiction."),
    !ENABLE_RWA_POLICY || !requiresCoveragePathway || coveragePathway !== "rwa_policy"
      ? null
      : (isHttpOrIpfsUri(rwaSettings.policyTermsUri) ? null : "RWA policy terms URI must use http(s) or ipfs://."),
    !ENABLE_RWA_POLICY || !requiresCoveragePathway || coveragePathway !== "rwa_policy"
      ? null
      : (normalize(rwaSettings.regulatoryLicenseRef) ? null : "RWA pathway requires regulatory/license reference."),
    !ENABLE_RWA_POLICY || !requiresCoveragePathway || coveragePathway !== "rwa_policy"
      ? null
      : (isComplianceContact(rwaSettings.complianceContact) ? null : "RWA compliance contact must be an email or http(s)/ipfs URL."),
    payoutAssetMode === "sol" ? null : (isPublicKey(payoutMint) ? null : "Payout mint must be a valid public key for SPL mode."),
    planType === "insurance" ? null : (asFloat(payoutTokens, 0) > 0 ? null : "Reward payout must be greater than zero."),
  ]);

  const createPlanBlockingReason = firstBlockingReason([
    connected ? null : "Connect wallet to create plan.",
    publicKey ? null : "Wallet signer unavailable.",
    step1BlockingReason,
    membershipMode === "token_gate" ? (isPublicKey(tokenGateMint) ? null : "Token gate mint must be a valid public key.") : null,
    membershipMode === "token_gate" ? (asBigInt(tokenGateMinBalance, 0n) > 0n ? null : "Token gate minimum balance must be greater than zero.") : null,
    membershipMode === "invite_only" ? (isPublicKey(inviteIssuer) ? null : "Invite issuer must be a valid public key.") : null,
  ]);

  const verifyBlockingReason = firstBlockingReason([
    connected ? null : "Connect wallet to configure verification.",
    publicKey ? null : "Wallet signer unavailable.",
    isPublicKey(activePoolAddress) ? null : "Create the plan before configuring verification.",
    businessEntry.isBusinessOrigin
      ? (requiredBusinessOracle
        ? null
        : "Business-origin policy requires a configured required oracle address.")
      : null,
    businessEntry.isBusinessOrigin && requiredBusinessOracle
      ? (requiredBusinessOracleDiscovered ? null : "Required business oracle is not registered on this network.")
      : null,
    businessEntry.isBusinessOrigin && requiredBusinessOracle
      ? (selectedOracles.includes(requiredBusinessOracle)
        ? null
        : "Business-origin policy requires the OmegaX Health oracle verifier to remain selected.")
      : null,
    selectedOracles.length > 0 ? null : "Select at least one oracle.",
    asInt(quorumM, 0) > 0 ? null : "Quorum M must be greater than zero.",
    asInt(quorumN, 0) >= asInt(quorumM, 1) ? null : "Quorum N must be greater than or equal to quorum M.",
  ]);

  const rulesBlockingReason = firstBlockingReason([
    connected ? null : "Connect wallet to configure rules.",
    publicKey ? null : "Wallet signer unavailable.",
    isPublicKey(activePoolAddress) ? null : "Create the plan before configuring rules.",
    selectedSchema ? null : "Select a schema.",
    selectedOutcomeIds.length > 0 ? null : "Select at least one outcome.",
    duplicateRuleIds.length === 0 ? null : `Duplicate rule IDs: ${duplicateRuleIds.join(", ")}`,
  ]);

  const fundBlockingReason = firstBlockingReason([
    connected ? null : "Connect wallet to fund the plan.",
    publicKey ? null : "Wallet signer unavailable.",
    isPublicKey(activePoolAddress) ? null : "Create the plan before funding.",
    payoutAssetMode === "sol"
      ? (asFloat(fundSol, 0) > 0 ? null : "SOL amount must be greater than zero.")
      : (asFloat(fundSpl, 0) > 0 ? null : "SPL amount must be greater than zero."),
    payoutAssetMode === "spl" ? (isPublicKey(payoutMint) ? null : "Payout mint must be a valid SPL mint.") : null,
  ]);

  const workflowSteps = useMemo(
    () => [
      { id: "type-basics" as StepId, label: "Type & Basics", done: !step1BlockingReason, blockingReason: step1BlockingReason },
      {
        id: "eligibility" as StepId,
        label: "Eligibility & Create",
        done: stepReady.pool,
        blockingReason: createPlanBlockingReason,
      },
      {
        id: "verification" as StepId,
        label: "Verification Network",
        done: stepReady.verification,
        blockingReason: verifyBlockingReason,
      },
      {
        id: "outcomes-rules" as StepId,
        label: "Outcomes & Rules",
        done: stepReady.rules,
        blockingReason: rulesBlockingReason,
      },
      {
        id: "funding-review" as StepId,
        label: "Funding & Review",
        done: stepReady.funding,
        blockingReason: fundBlockingReason,
      },
    ],
    [
      createPlanBlockingReason,
      fundBlockingReason,
      rulesBlockingReason,
      step1BlockingReason,
      stepReady.funding,
      stepReady.pool,
      stepReady.rules,
      stepReady.verification,
      verifyBlockingReason,
    ],
  );

  const completedSteps = workflowSteps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedSteps / workflowSteps.length) * 100);
  const activeStep = workflowSteps.find((step) => step.id === openStep) ?? workflowSteps[0]!;
  const nextOpenStep = workflowSteps.find((step) => !step.done);
  const nextStepBlocker = nextOpenStep?.blockingReason ?? null;
  const activeStepSummary = useMemo(() => {
    if (openStep === "type-basics") return "Choose plan type, identity, payout asset, and base metadata.";
    if (openStep === "eligibility") return "Set enrollment mode and create the health plan account.";
    if (openStep === "verification") return "Select verifiers, define quorum, and configure oracle policy.";
    if (openStep === "outcomes-rules") return "Select one schema and configure multiple outcome rules.";
    return "Review plan settings, then fund SOL or SPL vault before launch.";
  }, [openStep]);

  const appendLog = useCallback((log: Omit<ActionLog, "id" | "at">) => {
    setActionLog((prev) => [{ id: randomId(), at: Date.now(), ...log }, ...prev].slice(0, 60));
  }, []);

  const refreshSelectors = useCallback(async () => {
    setSelectorError(null);
    try {
      const [nextOracles, verifiedSchemas] = await Promise.all([
        listOracles({ connection, activeOnly: false, search: oracleSearch || null }),
        listSchemas({ connection, verifiedOnly: true }),
      ]);
      const nextSchemas = verifiedSchemas.length > 0
        ? verifiedSchemas
        : await listSchemas({ connection, verifiedOnly: false });
      setOracles(nextOracles);
      setSchemas(nextSchemas);
      const schemaStillAvailable = nextSchemas.some((row) => row.address === selectedSchemaAddress);
      if (!schemaStillAvailable) {
        const preferred = nextSchemas.find((row) => row.verified) ?? nextSchemas[0];
        setSelectedSchemaAddress(preferred?.address || "");
      }
    } catch (cause) {
      setSelectorError(cause instanceof Error ? cause.message : "Failed to load chain selectors.");
    }
  }, [connection, oracleSearch, selectedSchemaAddress]);

  const refreshReadiness = useCallback(async () => {
    if (!isPublicKey(activePoolAddress)) {
      let inviteIssuerReady = membershipMode !== "invite_only";
      if (membershipMode === "invite_only" && isPublicKey(inviteIssuer)) {
        try {
          const inviteOnlySnapshot = await fetchProtocolReadiness({
            connection,
            inviteIssuerAddress: inviteIssuer,
          });
          inviteIssuerReady = inviteOnlySnapshot.inviteIssuerRegistered;
        } catch {
          inviteIssuerReady = false;
        }
      }
      setStepReady((prev) => ({
        ...prev,
        pool: false,
        verification: false,
        rules: false,
        funding: false,
        inviteIssuer: inviteIssuerReady,
      }));
      return;
    }

    try {
      const snapshot = await fetchProtocolReadiness({
        connection,
        poolAddress: activePoolAddress,
        oracleAddress: selectedOracles[0] || null,
        inviteIssuerAddress: membershipMode === "invite_only" ? inviteIssuer || null : null,
        payoutMintAddress: payoutAssetMode === "spl" && isPublicKey(payoutMint) ? payoutMint : null,
        schemaKeyHashHex: selectedSchema?.schemaKeyHashHex || null,
        ruleHashHex: ruleRows[0]?.derivedRuleHashHex || null,
      });

      const programId = getProgramId();
      const poolKey = new PublicKey(activePoolAddress);
      const seriesRefHash = toBytes32(
        await hashStringTo32Hex(defaultPolicySeriesSeed(normalizedPoolId || activePoolAddress, planType)),
      );

      const policyAddress = derivePoolOraclePolicyPda({ programId, poolAddress: poolKey });
      const policyAccount = await connection.getAccountInfo(policyAddress, "confirmed");

      let allOraclesApproved = selectedOracles.length > 0;
      if (selectedOracles.length > 0) {
        const oracleApprovalAddresses = selectedOracles.map((oracle) =>
          derivePoolOraclePda({
            programId,
            poolAddress: poolKey,
            oracle: new PublicKey(oracle),
          }),
        );
        const approvals = await connection.getMultipleAccountsInfo(oracleApprovalAddresses, "confirmed");
        allOraclesApproved = approvals.every((entry) => entry != null);
      }

      const selectedRuleHashes = ruleRows.map((row) => row.derivedRuleHashHex).filter(isHex32);
      let allRulesPresent = selectedOutcomeIds.length > 0 && selectedRuleHashes.length === selectedOutcomeIds.length;
      if (allRulesPresent) {
        const ruleAddresses = selectedRuleHashes.map((ruleHashHex) =>
          derivePoolRulePda({
            programId,
            poolAddress: poolKey,
            seriesRefHash,
            ruleHash: toBytes32(ruleHashHex),
          }),
        );
        const rules = await connection.getMultipleAccountsInfo(ruleAddresses, "confirmed");
        allRulesPresent = rules.every((entry) => entry != null);
      }

      const fundedByAction = actionLog.some((entry) => entry.action === "Fund plan vault" && Boolean(entry.signature));
      const fundingReady = payoutAssetMode === "spl" ? (snapshot.poolAssetVaultConfigured || fundedByAction) : fundedByAction;

      setStepReady({
        pool: snapshot.poolExists,
        verification: Boolean(policyAccount) && allOraclesApproved && snapshot.poolOraclePolicyConfigured,
        rules: allRulesPresent,
        funding: fundingReady,
        inviteIssuer: membershipMode === "invite_only" ? snapshot.inviteIssuerRegistered : true,
      });
    } catch {
      // readiness is supportive UI state; temporary read failures should not interrupt the wizard.
    }
  }, [
    activePoolAddress,
    actionLog,
    connection,
    inviteIssuer,
    membershipMode,
    normalizedPoolId,
    payoutAssetMode,
    payoutMint,
    planType,
    ruleRows,
    selectedOracles,
    selectedOutcomeIds,
    selectedSchema?.schemaKeyHashHex,
  ]);

  useEffect(() => {
    void refreshSelectors();
  }, [refreshSelectors]);

  useEffect(() => {
    if (!publicKey) return;
    if (!inviteIssuer) {
      setInviteIssuer(publicKey.toBase58());
    }
  }, [inviteIssuer, publicKey]);

  useEffect(() => {
    if (planType === "rewards") {
      if (coveragePathway) setCoveragePathway("");
      return;
    }
    if (!ENABLE_RWA_POLICY && coveragePathway !== "defi_native") {
      setCoveragePathway("defi_native");
    }
  }, [coveragePathway, planType]);

  useEffect(() => {
    if (!businessEntry.isBusinessOrigin || !requiredBusinessOracle) return;
    setSelectedOracles((prev) => (
      prev.includes(requiredBusinessOracle) ? prev : [requiredBusinessOracle, ...prev]
    ));
  }, [businessEntry.isBusinessOrigin, requiredBusinessOracle]);

  useEffect(() => {
    if (selectedOracles.length === 0) {
      setQuorumN("1");
      if (!quorumManual) setQuorumM("1");
      return;
    }
    const n = selectedOracles.length;
    setQuorumN(String(n));
    if (!quorumManual) {
      const majority = n === 1 ? 1 : Math.floor(n / 2) + 1;
      setQuorumM(String(majority));
    }
  }, [quorumManual, selectedOracles]);

  useEffect(() => {
    async function loadSchemaOutcomes() {
      setSchemaOutcomes([]);
      setSchemaWarnings([]);
      setSelectedOutcomeIds([]);
      setRuleEdits({});
      setRulePreviewMap({});

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
          setSchemaOutcomes(parsed.outcomes);
          setSchemaWarnings([reason, ...parsed.warnings].filter(Boolean));
          return parsed.outcomes.length > 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load local fallback schema.";
          setSchemaWarnings([reason, message]);
          return false;
        }
      };

      setSchemaMetadataLoading(true);
      try {
        if (!selectedSchema) {
          if (localFallbackAllowed) {
            await loadLocalFallback("No on-chain schema selected. Showing local standard schema outcomes.");
          }
          return;
        }

        if (!selectedSchema.metadataUri) {
          if (localFallbackAllowed) {
            const loaded = await loadLocalFallback(
              "Selected schema has no metadata URI. Showing local standard schema outcomes.",
            );
            if (loaded) return;
          }
          setSchemaWarnings(["Selected schema has no metadata URI; outcome options are unavailable in this step."]);
          return;
        }

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
          return;
        }

        setSchemaOutcomes(parsed.outcomes);
        setSchemaWarnings(warnings);
      } finally {
        setSchemaMetadataLoading(false);
      }
    }
    void loadSchemaOutcomes();
  }, [selectedSchema]);

  useEffect(() => {
    let cancelled = false;
    async function computeRulePreview() {
      if (!selectedSchema) {
        setRulePreviewMap({});
        return;
      }
      const nextEntries = await Promise.all(
        selectedOutcomeIds.map(async (outcomeId) => {
          const edit = ruleEdits[outcomeId];
          const ruleId = normalize(edit?.ruleId || outcomeId) || outcomeId;
          const ruleHashHex = edit?.ruleHashOverride && isHex32(edit.ruleHashOverride)
            ? normalizeHex32(edit.ruleHashOverride)
            : await hashStringTo32Hex(ruleId);
          const payoutHashHex = edit?.payoutHashOverride && isHex32(edit.payoutHashOverride)
            ? normalizeHex32(edit.payoutHashOverride)
            : await hashStringTo32Hex(`${selectedSchema.schemaKey}:${outcomeId}:payout`);
          return [outcomeId, { ruleHashHex, payoutHashHex }] as const;
        }),
      );
      if (cancelled) return;
      setRulePreviewMap(Object.fromEntries(nextEntries));
    }
    void computeRulePreview();
    return () => {
      cancelled = true;
    };
  }, [ruleEdits, selectedOutcomeIds, selectedSchema]);

  useEffect(() => {
    async function refreshDecimals() {
      if (payoutAssetMode !== "spl" || !payoutMintPublicKey) {
        setSplDecimals(null);
        return;
      }
      try {
        const decimals = await getMintDecimals(connection, payoutMintPublicKey);
        setSplDecimals(decimals);
      } catch {
        setSplDecimals(null);
      }
    }
    void refreshDecimals();
  }, [connection, payoutAssetMode, payoutMintPublicKey]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  async function signAndConfirm(action: string, tx: Transaction, signers?: Keypair[]) {
    const signature = await sendTransaction(tx, connection, signers ? { signers } : undefined);
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
      await refreshReadiness();
    } catch (cause) {
      appendLog({
        action,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusyAction(null);
    }
  }

  const onPlanTypeChange = useCallback((nextPlanType: PlanType) => {
    setPlanType(nextPlanType);
    if (payoutAssetMode === "spl") {
      setPayoutMint(defaultPayoutMintForPlanType(nextPlanType));
    }
  }, [payoutAssetMode]);

  const onUseDefaultPayoutMint = useCallback(() => {
    setPayoutMint(defaultPayoutMintForPlanType(planType));
  }, [planType]);

  const onToggleOracle = useCallback((oracle: string) => {
    setSelectedOracles((prev) => {
      if (prev.includes(oracle)) {
        if (businessEntry.isBusinessOrigin && requiredBusinessOracle && oracle === requiredBusinessOracle) {
          return prev;
        }
        return prev.filter((entry) => entry !== oracle);
      }
      const next = [...prev, oracle];
      if (
        businessEntry.isBusinessOrigin
        && requiredBusinessOracle
        && !next.includes(requiredBusinessOracle)
      ) {
        return [requiredBusinessOracle, ...next];
      }
      return next;
    });
  }, [businessEntry.isBusinessOrigin, requiredBusinessOracle]);

  const onToggleOutcome = useCallback((outcomeId: string) => {
    setSelectedOutcomeIds((prev) => {
      if (prev.includes(outcomeId)) return prev.filter((entry) => entry !== outcomeId);
      return [...prev, outcomeId];
    });
    setRuleEdits((prev) => ({
      ...prev,
      [outcomeId]: prev[outcomeId] ?? { ruleId: outcomeId, ruleHashOverride: "", payoutHashOverride: "" },
    }));
  }, []);

  const onRuleIdChange = useCallback((outcomeId: string, value: string) => {
    setRuleEdits((prev) => ({
      ...prev,
      [outcomeId]: {
        ruleId: value,
        ruleHashOverride: prev[outcomeId]?.ruleHashOverride || "",
        payoutHashOverride: prev[outcomeId]?.payoutHashOverride || "",
      },
    }));
  }, []);

  const onRuleHashOverrideChange = useCallback((outcomeId: string, value: string) => {
    setRuleEdits((prev) => ({
      ...prev,
      [outcomeId]: {
        ruleId: prev[outcomeId]?.ruleId || outcomeId,
        ruleHashOverride: value,
        payoutHashOverride: prev[outcomeId]?.payoutHashOverride || "",
      },
    }));
  }, []);

  const onPayoutHashOverrideChange = useCallback((outcomeId: string, value: string) => {
    setRuleEdits((prev) => ({
      ...prev,
      [outcomeId]: {
        ruleId: prev[outcomeId]?.ruleId || outcomeId,
        ruleHashOverride: prev[outcomeId]?.ruleHashOverride || "",
        payoutHashOverride: value,
      },
    }));
  }, []);

  const onRegisterInviteIssuer = useCallback(async () => {
    await runAction("Register invite issuer", async () => {
      if (!connected || !publicKey) throw new Error("Connect wallet first.");
      if (!isPublicKey(inviteIssuer)) throw new Error("Invite issuer address is invalid.");
      if (normalize(inviteIssuer) !== publicKey.toBase58()) {
        throw new Error("Invite issuer registration requires the connected wallet to match issuer address.");
      }
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildRegisterInviteIssuerTx({
        issuer: publicKey,
        recentBlockhash: blockhash,
        organizationRef: normalize(organizationRef),
        metadataUri: normalize(metadataUri),
        active: true,
      });
      await signAndConfirm("Register invite issuer", tx);
    });
  }, [connected, connection, inviteIssuer, metadataUri, organizationRef, publicKey]);

  const onCreatePlan = useCallback(async () => {
    await runAction("Create plan", async () => {
      if (createPlanBlockingReason) throw new Error(createPlanBlockingReason);
      if (!publicKey) throw new Error("Wallet signer unavailable.");
      const termsFallbackSeed = requiresCoveragePathway
        ? `${normalizedPoolId}:terms:${coveragePathwayCommitment}`
        : `${normalizedPoolId}:terms`;
      const policyFallbackSeed = requiresCoveragePathway
        ? `${normalizedPoolId}:payout-policy:${coveragePathwayCommitment}`
        : `${normalizedPoolId}:payout-policy`;
      const resolvedTermsHash = await resolveHex32(termsHashHex, termsFallbackSeed, "Terms hash");
      const resolvedPolicyHash = await resolveHex32(
        payoutPolicyHashHex,
        policyFallbackSeed,
        "Payout policy hash",
      );
      const payoutLamportsPerPass = BigInt(Math.max(1, Math.floor(asFloat(payoutTokens, 0) * LAMPORTS_PER_SOL)));
      const membershipModeValue = toMembershipModeValue(membershipMode);
      const tokenGateMintForTx = membershipMode === "token_gate" ? normalize(tokenGateMint) : ZERO_PUBKEY;
      const tokenGateMinBalanceForTx = membershipMode === "token_gate" ? asBigInt(tokenGateMinBalance, 1n) : 0n;
      const inviteIssuerForTx = membershipMode === "invite_only" ? normalize(inviteIssuer) : undefined;
      const payoutAssetMint = payoutAssetMode === "spl" ? normalize(payoutMint) : undefined;
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const { tx, poolAddress } = buildCreatePoolV2Tx({
        authority: publicKey,
        recentBlockhash: blockhash,
        poolId: normalizedPoolId,
        organizationRef: normalize(organizationRef),
        payoutLamportsPerPass,
        membershipMode: membershipModeValue,
        tokenGateMint: tokenGateMintForTx,
        tokenGateMinBalance: tokenGateMinBalanceForTx,
        inviteIssuer: inviteIssuerForTx,
        metadataUri: normalize(metadataUri),
        termsHashHex: resolvedTermsHash,
        payoutPolicyHashHex: resolvedPolicyHash,
        poolType: toPoolTypeValue(planType),
        payoutAssetMint,
      });
      await signAndConfirm("Create plan", tx);
      const primarySeriesRefHashHex = await hashStringTo32Hex(defaultPolicySeriesSeed(normalizedPoolId, planType));
      const primarySeriesTx = buildCreatePolicySeriesTx({
        authority: publicKey,
        poolAddress,
        seriesRefHashHex: primarySeriesRefHashHex,
        status: POLICY_SERIES_STATUS_ACTIVE,
        planMode: toPolicySeriesPlanMode(planType),
        sponsorMode: SPONSOR_MODE_DIRECT,
        displayName: `${normalize(organizationRef)} Primary Series`,
        metadataUri: normalize(metadataUri),
        termsHashHex: resolvedTermsHash,
        durationSecs: 365n * 86_400n,
        premiumDueEverySecs: 30n * 86_400n,
        premiumGraceSecs: 7n * 86_400n,
        premiumAmount: 1n,
        termsVersion: 1,
        mappingVersion: 0,
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      });
      await signAndConfirm("Create primary series", primarySeriesTx);
      setRecentCreatedPoolAddress(poolAddress.toBase58());
      setTermsHashHex(resolvedTermsHash);
      setPayoutPolicyHashHex(resolvedPolicyHash);
      setOpenStep("verification");
    });
  }, [
    connection,
    coveragePathwayCommitment,
    createPlanBlockingReason,
    inviteIssuer,
    membershipMode,
    metadataUri,
    normalizedPoolId,
    organizationRef,
    payoutAssetMode,
    payoutMint,
    payoutPolicyHashHex,
    payoutTokens,
    planType,
    publicKey,
    requiresCoveragePathway,
    termsHashHex,
    tokenGateMinBalance,
    tokenGateMint,
  ]);

  const sendInstructionBatch = useCallback(
    async (action: string, instructions: TransactionInstruction[]) => {
      if (!publicKey) throw new Error("Wallet signer unavailable.");
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash });
      for (const instruction of instructions) tx.add(instruction);
      await signAndConfirm(action, tx);
    },
    [connection, publicKey],
  );

  const onConfigureVerification = useCallback(async () => {
    await runAction("Configure verification", async () => {
      if (verifyBlockingReason) throw new Error(verifyBlockingReason);
      if (!publicKey) throw new Error("Wallet signer unavailable.");
      const poolAddress = new PublicKey(activePoolAddress);
      const blockhashInfo = await connection.getLatestBlockhash("confirmed");
      const oracleInstructions = selectedOracles.map((oracle) =>
        buildSetPoolOracleTx({
          authority: publicKey,
          poolAddress,
          oracle: new PublicKey(oracle),
          recentBlockhash: blockhashInfo.blockhash,
          active: true,
        }).instructions[0]!,
      );
      const policyInstruction = buildSetPoolOraclePolicyTx({
        authority: publicKey,
        poolAddress,
        recentBlockhash: blockhashInfo.blockhash,
        quorumM: asInt(quorumM, 1),
        quorumN: asInt(quorumN, selectedOracles.length || 1),
        requireVerifiedSchema,
        allowDelegateClaim,
      }).instructions[0]!;

      const oracleBatches = chunk(oracleInstructions, ORACLE_CHUNK_SIZE);
      if (oracleBatches.length === 0) {
        await sendInstructionBatch("Configure verification", [policyInstruction]);
      } else {
        for (let i = 0; i < oracleBatches.length; i += 1) {
          const ixs = i === oracleBatches.length - 1
            ? [...oracleBatches[i]!, policyInstruction]
            : oracleBatches[i]!;
          await sendInstructionBatch("Configure verification", ixs);
        }
      }
      setOpenStep("outcomes-rules");
    });
  }, [
    activePoolAddress,
    allowDelegateClaim,
    connection,
    publicKey,
    quorumM,
    quorumN,
    requireVerifiedSchema,
    selectedOracles,
    sendInstructionBatch,
    verifyBlockingReason,
  ]);

  const onCreateOrUpdateRules = useCallback(async () => {
    await runAction("Create rules", async () => {
      if (rulesBlockingReason) throw new Error(rulesBlockingReason);
      if (!publicKey || !selectedSchema) throw new Error("Missing signer or schema.");
      const poolAddress = new PublicKey(activePoolAddress);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const seriesRefHashHex = await hashStringTo32Hex(
        defaultPolicySeriesSeed(normalizedPoolId || activePoolAddress, planType),
      );
      const seriesAddress = derivePolicySeriesPda({
        programId: getProgramId(),
        poolAddress,
        seriesRefHash: toBytes32(seriesRefHashHex),
      });
      const instructions: TransactionInstruction[] = [];
      if (!(await connection.getAccountInfo(seriesAddress, "confirmed"))) {
        const seriesTx = buildCreatePolicySeriesTx({
          authority: publicKey,
          poolAddress,
          seriesRefHashHex,
          status: POLICY_SERIES_STATUS_ACTIVE,
          planMode: toPolicySeriesPlanMode(planType),
          sponsorMode: SPONSOR_MODE_DIRECT,
          displayName: `${normalize(organizationRef) || normalize(poolId) || "OmegaX"} Primary Series`,
          metadataUri: normalize(metadataUri) || "https://protocol.omegax.health/policy-series/default",
          termsHashHex: await resolveHex32(termsHashHex, `${normalizedPoolId || activePoolAddress}:terms`, "Terms hash"),
          durationSecs: 365n * 86_400n,
          premiumDueEverySecs: 30n * 86_400n,
          premiumGraceSecs: 7n * 86_400n,
          premiumAmount: 1n,
          termsVersion: 1,
          mappingVersion: 0,
          recentBlockhash: blockhash,
        });
        instructions.push(seriesTx.instructions[0]!);
      }
      for (const row of ruleRows) {
        const resolvedRuleHash = await resolveHex32(
          row.ruleHashOverride,
          normalize(row.ruleId) || row.outcomeId,
          "Rule hash",
        );
        const resolvedPayoutHash = await resolveHex32(
          row.payoutHashOverride,
          `${selectedSchema.schemaKey}:${row.outcomeId}:payout`,
          "Payout hash",
        );
        const tx = buildSetPolicySeriesOutcomeRuleTx({
          authority: publicKey,
          poolAddress,
          seriesRefHashHex,
          recentBlockhash: blockhash,
          ruleHashHex: resolvedRuleHash,
          schemaKeyHashHex: selectedSchema.schemaKeyHashHex,
          ruleId: normalize(row.ruleId) || row.outcomeId,
          schemaKey: selectedSchema.schemaKey,
          schemaVersion: selectedSchema.version,
          payoutHashHex: resolvedPayoutHash,
          enabled: true,
        });
        instructions.push(tx.instructions[0]!);
      }
      for (const batch of chunk(instructions, RULE_CHUNK_SIZE)) {
        await sendInstructionBatch("Create rules", batch);
      }
      setOpenStep("funding-review");
    });
  }, [
    activePoolAddress,
    connection,
    metadataUri,
    normalizedPoolId,
    organizationRef,
    planType,
    poolId,
    publicKey,
    ruleRows,
    rulesBlockingReason,
    selectedSchema,
    sendInstructionBatch,
    termsHashHex,
  ]);

  const onFundPlan = useCallback(async () => {
    await runAction("Fund plan vault", async () => {
      if (fundBlockingReason) throw new Error(fundBlockingReason);
      if (!publicKey) throw new Error("Wallet signer unavailable.");
      const poolAddress = new PublicKey(activePoolAddress);

      if (payoutAssetMode === "sol") {
        const lamports = BigInt(Math.floor(asFloat(fundSol, 0) * LAMPORTS_PER_SOL));
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const tx = buildFundPoolSolTx({
          funder: publicKey,
          poolAddress,
          recentBlockhash: blockhash,
          lamports,
        });
        await signAndConfirm("Fund plan vault", tx);
        return;
      }

      if (!payoutMintPublicKey) throw new Error("Payout mint is invalid.");
      const decimals = await getMintDecimals(connection, payoutMintPublicKey);
      setSplDecimals(decimals);
      const amount = parseUiAmountToBaseUnits(fundSpl, decimals);
      if (amount <= 0n) throw new Error("Funding amount must be greater than zero.");

      const funderTokenAccount = getAssociatedTokenAddress(payoutMintPublicKey, publicKey);
      const funderTokenAccountInfo = await connection.getAccountInfo(funderTokenAccount, "confirmed");
      if (!funderTokenAccountInfo) {
        throw new Error(`Associated token account not found: ${funderTokenAccount.toBase58()}`);
      }
      const tokenBalance = await connection.getTokenAccountBalance(funderTokenAccount, "confirmed");
      const available = BigInt(tokenBalance.value.amount || "0");
      if (available < amount) {
        throw new Error(`Insufficient token balance: have ${available.toString()}, need ${amount.toString()} base units.`);
      }

      const programId = getProgramId();
      const poolAssetVault = derivePoolAssetVaultPda({
        programId,
        poolAddress,
        payoutMint: payoutMintPublicKey,
      });
      const poolAssetVaultInfo = await connection.getAccountInfo(poolAssetVault, "confirmed");

      let poolVaultTokenAccount: PublicKey;
      let extraSigners: Keypair[] | undefined;

      if (poolAssetVaultInfo && poolAssetVaultInfo.data.length >= 104) {
        poolVaultTokenAccount = new PublicKey(poolAssetVaultInfo.data.slice(72, 104));
      } else {
        const vaultTokenAccount = Keypair.generate();
        poolVaultTokenAccount = vaultTokenAccount.publicKey;
        extraSigners = [vaultTokenAccount];
      }

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildFundPoolSplTx({
        funder: publicKey,
        poolAddress,
        payoutMint: payoutMintPublicKey,
        poolVaultTokenAccount,
        poolVaultTokenAccountSigner: !poolAssetVaultInfo,
        funderTokenAccount,
        recentBlockhash: blockhash,
        amount,
      });
      await signAndConfirm("Fund plan vault", tx, extraSigners);
    });
  }, [
    activePoolAddress,
    connection,
    fundBlockingReason,
    fundSol,
    fundSpl,
    payoutAssetMode,
    payoutMintPublicKey,
    publicKey,
  ]);

  const activeStepIndex = workflowSteps.findIndex((step) => step.id === openStep);
  const prevStep = previousStepId(openStep);
  const nextStep = nextStepId(openStep);

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
      <div className="w-full lg:w-[320px] lg:shrink-0 space-y-4">
        <div className="surface-card-soft space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="metric-label">Create Health Plan Wizard</p>
            <button
              className="secondary-button py-1.5 px-3 text-xs"
              onClick={() => setExpertMode((prev) => !prev)}
              disabled={hasBusyAction}
            >
              {expertMode ? "Simple mode" : "Expert mode"}
            </button>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--muted)]/60">
            <div className="h-2 rounded-full bg-[var(--primary)] transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="field-help">{progressPercent}% complete</p>
          <p className="field-help">{activeStepSummary}</p>
          {nextStepBlocker ? <p className="field-error">Next blocker: {nextStepBlocker}</p> : null}
        </div>

        <div className="surface-card-soft rounded-2xl p-4">
          {workflowSteps.map((step, index) => {
            const isActive = openStep === step.id;
            const isDone = step.done;
            const isLast = index === workflowSteps.length - 1;
            return (
              <div key={step.id}>
                <button
                  type="button"
                  onClick={() => setOpenStep(step.id)}
                  className={cn(
                    "flex w-full items-start gap-3 py-1 text-left transition-opacity",
                    !isActive && !isDone && "opacity-85 hover:opacity-100",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold",
                      isActive
                        ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                        : isDone
                          ? "border-emerald-500 text-emerald-500"
                          : "border-[var(--border)]/70 text-[var(--muted-foreground)]",
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">Step {index + 1}</p>
                    <p className={cn("text-sm font-semibold", isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>{step.label}</p>
                  </div>
                </button>
                {!isLast ? <div className="ml-[15px] h-6 w-[2px] bg-[var(--border)]" /> : null}
              </div>
            );
          })}
        </div>

        <div className="surface-card-soft space-y-2">
          <p className="metric-label">Execution Context</p>
          <p className="field-help">Wallet: {walletAddress ? shortAddress(walletAddress) : "not connected"}</p>
          <p className="field-help">Pool: {activePoolAddress ? shortAddress(activePoolAddress) : "not created"}</p>
          <p className="field-help">Selected verifiers: {selectedOracles.length}</p>
        </div>

        {actionLog.length > 0 ? (
          <details className="surface-card-soft">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Audit trail</summary>
            <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto">
              {actionLog.map((log) => (
                <div key={log.id} className="border-l-2 border-[var(--border)] pl-3">
                  <p className="text-xs font-semibold text-[var(--foreground)]">{log.action}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {new Date(log.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {log.signature ? (
                    <a
                      href={toExplorerLink(log.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[var(--primary)] hover:underline"
                    >
                      Tx: {shortAddress(log.signature)}
                    </a>
                  ) : (
                    <p className="text-[11px] text-[var(--muted-foreground)]">{log.message}</p>
                  )}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
            {workflowSteps[activeStepIndex]?.label}
          </h2>
          <button className="secondary-button py-1.5 px-3 text-sm" onClick={() => void refreshSelectors()} disabled={hasBusyAction}>
            Refresh chain selectors
          </button>
        </div>
        {selectorError ? <p className="field-error">{selectorError}</p> : null}
        {schemaWarnings.map((warning) => (
          <p key={warning} className="field-help">
            {warning}
          </p>
        ))}
        {schemaMetadataLoading ? <p className="field-help">Loading schema outcomes...</p> : null}

        {openStep === "type-basics" ? (
          <StepTypeBasics
            planType={planType}
            onPlanTypeChange={onPlanTypeChange}
            poolId={poolId}
            onPoolIdChange={setPoolId}
            poolIdBytes={poolIdBytes}
            organizationRef={organizationRef}
            onOrganizationRefChange={setOrganizationRef}
            metadataUri={metadataUri}
            onMetadataUriChange={setMetadataUri}
            payoutAssetMode={payoutAssetMode}
            onPayoutAssetModeChange={setPayoutAssetMode}
            payoutMint={payoutMint}
            onPayoutMintChange={setPayoutMint}
            onUseDefaultPayoutMint={onUseDefaultPayoutMint}
            payoutTokens={payoutTokens}
            onPayoutTokensChange={setPayoutTokens}
            expertMode={expertMode}
            termsHashHex={termsHashHex}
            onTermsHashHexChange={setTermsHashHex}
            payoutPolicyHashHex={payoutPolicyHashHex}
            onPayoutPolicyHashHexChange={setPayoutPolicyHashHex}
            coveragePathway={coveragePathway}
            onCoveragePathwayChange={setCoveragePathway}
            defiSettlementMode={defiSettings.settlementMode}
            onDefiSettlementModeChange={(value) =>
              setDefiSettings((prev) => ({ ...prev, settlementMode: value }))
            }
            defiTechnicalTermsUri={defiSettings.technicalTermsUri}
            onDefiTechnicalTermsUriChange={(value) =>
              setDefiSettings((prev) => ({ ...prev, technicalTermsUri: value }))
            }
            defiRiskDisclosureUri={defiSettings.riskDisclosureUri}
            onDefiRiskDisclosureUriChange={(value) =>
              setDefiSettings((prev) => ({ ...prev, riskDisclosureUri: value }))
            }
            rwaLegalEntityName={rwaSettings.legalEntityName}
            onRwaLegalEntityNameChange={(value) =>
              setRwaSettings((prev) => ({ ...prev, legalEntityName: value }))
            }
            rwaJurisdiction={rwaSettings.jurisdiction}
            onRwaJurisdictionChange={(value) =>
              setRwaSettings((prev) => ({ ...prev, jurisdiction: value }))
            }
            rwaPolicyTermsUri={rwaSettings.policyTermsUri}
            onRwaPolicyTermsUriChange={(value) =>
              setRwaSettings((prev) => ({ ...prev, policyTermsUri: value }))
            }
            rwaRegulatoryLicenseRef={rwaSettings.regulatoryLicenseRef}
            onRwaRegulatoryLicenseRefChange={(value) =>
              setRwaSettings((prev) => ({ ...prev, regulatoryLicenseRef: value }))
            }
            rwaComplianceContact={rwaSettings.complianceContact}
            onRwaComplianceContactChange={(value) =>
              setRwaSettings((prev) => ({ ...prev, complianceContact: value }))
            }
            predictedPoolAddress={predictedPoolAddress}
          />
        ) : null}

        {openStep === "eligibility" ? (
          <StepEligibility
            membershipMode={membershipMode}
            onMembershipModeChange={setMembershipMode}
            tokenGateMint={tokenGateMint}
            onTokenGateMintChange={setTokenGateMint}
            tokenGateMinBalance={tokenGateMinBalance}
            onTokenGateMinBalanceChange={setTokenGateMinBalance}
            inviteIssuer={inviteIssuer}
            onInviteIssuerChange={setInviteIssuer}
            onRegisterInviteIssuer={() => void onRegisterInviteIssuer()}
            inviteIssuerReady={stepReady.inviteIssuer}
            registerInviteIssuerDisabled={hasBusyAction || membershipMode !== "invite_only"}
            onCreatePlan={() => void onCreatePlan()}
            createPlanDisabled={hasBusyAction || Boolean(createPlanBlockingReason)}
          />
        ) : null}

        {openStep === "verification" ? (
          <StepVerification
            oracles={oraclePickerOptions}
            oracleSearch={oracleSearch}
            onOracleSearchChange={setOracleSearch}
            selectedOracles={selectedOracles}
            onToggleOracle={onToggleOracle}
            requiredOracleAddress={requiredBusinessOracle}
            requiredOracleDiscovered={requiredBusinessOracleDiscovered}
            lockRequiredOracle={businessEntry.isBusinessOrigin}
            quorumM={quorumM}
            onQuorumMChange={(value) => {
              setQuorumManual(true);
              setQuorumM(value);
            }}
            quorumN={quorumN}
            requireVerifiedSchema={requireVerifiedSchema}
            onRequireVerifiedSchemaChange={setRequireVerifiedSchema}
            allowDelegateClaim={allowDelegateClaim}
            onAllowDelegateClaimChange={setAllowDelegateClaim}
            onConfirmVerification={() => void onConfigureVerification()}
            disabledInputs={hasBusyAction}
            confirmDisabled={hasBusyAction || Boolean(verifyBlockingReason)}
          />
        ) : null}

        {openStep === "outcomes-rules" ? (
          <StepOutcomesRules
            schemas={schemas}
            selectedSchemaAddress={selectedSchemaAddress}
            onSelectedSchemaAddressChange={setSelectedSchemaAddress}
            schemaOutcomes={schemaOutcomes}
            selectedOutcomeIds={selectedOutcomeIds}
            onToggleOutcome={onToggleOutcome}
            ruleRows={ruleRows}
            onRuleIdChange={onRuleIdChange}
            onRuleHashOverrideChange={onRuleHashOverrideChange}
            onPayoutHashOverrideChange={onPayoutHashOverrideChange}
            expertMode={expertMode}
            onCreateOrUpdateRules={() => void onCreateOrUpdateRules()}
            disabledInputs={hasBusyAction}
            actionDisabled={hasBusyAction || Boolean(rulesBlockingReason)}
          />
        ) : null}

        {openStep === "funding-review" ? (
          <StepFundingReview
            planType={planType}
            coveragePathway={coveragePathway}
            defiSettlementMode={defiSettings.settlementMode}
            defiTechnicalTermsUri={defiSettings.technicalTermsUri}
            defiRiskDisclosureUri={defiSettings.riskDisclosureUri}
            rwaLegalEntityName={rwaSettings.legalEntityName}
            rwaJurisdiction={rwaSettings.jurisdiction}
            rwaPolicyTermsUri={rwaSettings.policyTermsUri}
            rwaRegulatoryLicenseRef={rwaSettings.regulatoryLicenseRef}
            rwaComplianceContact={rwaSettings.complianceContact}
            poolTypeLabel={toPoolTypeValue(planType) === POOL_TYPE_COVERAGE ? "On-chain pool type: coverage" : "On-chain pool type: reward"}
            payoutAssetMode={payoutAssetMode}
            payoutMint={payoutMint}
            payoutTokens={payoutTokens}
            membershipMode={membershipMode}
            tokenGateMint={tokenGateMint}
            tokenGateMinBalance={tokenGateMinBalance}
            inviteIssuer={inviteIssuer}
            selectedOraclesCount={selectedOracles.length}
            quorumM={quorumM}
            quorumN={quorumN}
            selectedSchemaLabel={selectedSchema ? `${selectedSchema.schemaKey} v${selectedSchema.version}` : ""}
            selectedOutcomesCount={selectedOutcomeIds.length}
            activePoolAddress={recentCreatedPoolAddress}
            buildPoolHref={buildPoolHref}
            fundSol={fundSol}
            onFundSolChange={setFundSol}
            fundSpl={fundSpl}
            onFundSplChange={setFundSpl}
            onFundPlan={() => void onFundPlan()}
            fundDisabled={hasBusyAction || Boolean(fundBlockingReason)}
            splDecimals={splDecimals}
            splAmountPreview={splAmountPreview}
          />
        ) : null}

        {workflowSteps.some((step) => step.blockingReason && step.id === openStep) ? (
          <p className="field-error">{workflowSteps.find((step) => step.id === openStep)?.blockingReason}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/40 pt-3">
          {prevStep ? (
            <button
              type="button"
              className="secondary-button py-1.5 px-4 text-sm inline-flex items-center gap-1.5"
              onClick={() => setOpenStep(prevStep)}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
          ) : (
            <span />
          )}
          {nextStep ? (
            <button
              type="button"
              className="secondary-button py-1.5 px-4 text-sm inline-flex items-center gap-1.5"
              onClick={() => setOpenStep(nextStep)}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
