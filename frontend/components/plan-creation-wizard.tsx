// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { MultiOraclePicker, type MultiOracleOption } from "@/components/multi-oracle-picker";
import { WizardDetailSheet, WizardDetailTriggerRow, type WizardDetailMetaItem } from "@/components/wizard-detail-sheet";
import { cn } from "@/lib/cn";
import {
  buildCreateHealthPlanInstruction,
  buildCreatePolicySeriesInstruction,
  buildOpenFundingLineInstruction,
  deriveLaunchLedgerAddresses,
} from "@/lib/plan-launch-tx";
import {
  buildGenesisProtectAcuteArtifactAddresses,
  buildGenesisProtectAcuteWizardDefaults,
  genesisProtectAcuteBootstrapAllocations,
  genesisProtectAcuteBootstrapCapitalClasses,
  genesisProtectAcuteBootstrapFundingLines,
  GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU,
  GENESIS_PROTECT_ACUTE_PRIMARY_SKU,
  GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
} from "@/lib/genesis-protect-acute-operator";
import {
  GENESIS_PROTECT_ACUTE_PLAN_ID,
  GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
  GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_POOL_ID,
  GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS,
} from "@/lib/genesis-protect-acute";
import {
  buildLaunchAddressPreview,
  buildLaunchReviewLinks,
  deriveLaunchPreflightAccountAddresses,
  dedupeOracleOptions,
  requiresProtectionLane,
  requiresRewardLane,
  serializeProtectionPosture,
  validateLaunchBasics,
  validateLaunchMembership,
  validateLaunchVerification,
  validateProtectionLane,
  validateRewardLane,
  type CoveragePathway,
  type DefiSettlementMode,
  type LaunchIntent,
  type MembershipGateKind,
  type MembershipMode,
  type PayoutAssetMode,
} from "@/lib/plan-launch";
import {
  fetchProtectionMetadataDocument,
  validateProtectionMetadataAgainstPosture,
} from "@/lib/protection-metadata";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  buildCreateAllocationPositionTx,
  buildCreateCapitalClassTx,
  buildCreateLiquidityPoolTx,
  buildUpdateCapitalClassControlsTx,
  CAPITAL_CLASS_RESTRICTION_OPEN,
  deriveFundingLinePda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  derivePolicySeriesPda,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  REDEMPTION_POLICY_QUEUE_ONLY,
  SERIES_MODE_PROTECTION,
  SERIES_MODE_REWARD,
  SERIES_STATUS_ACTIVE,
  toExplorerAddressLink,
  ZERO_PUBKEY,
} from "@/lib/protocol";
import {
  fetchSchemaMetadata,
  parseSchemaOutcomes,
  type SchemaOutcomeOption,
} from "@/lib/schema-metadata";
import { getMintDecimals, parseUiAmountToBaseUnits } from "@/lib/spl";
import { stableSha256Hex, stableStringify } from "@/lib/stable-hash";
import { useProtocolConsoleSnapshot } from "@/lib/use-protocol-console-snapshot";

type StepId =
  | "basics"
  | "membership"
  | "verification"
  | "reward-lane"
  | "protection-lane"
  | "review";

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

type ActionLog = {
  id: string;
  action: string;
  message: string;
  explorerUrl?: string;
  signature?: string;
};

type CreatedArtifacts = {
  healthPlanAddress: string;
  rewardSeriesAddress: string | null;
  protectionSeriesAddress: string | null;
  rewardFundingLineAddress: string | null;
  protectionFundingLineAddress: string | null;
  poolAddress?: string | null;
  capitalClassAddresses?: string[];
  allocationAddresses?: string[];
  extraSeriesAddresses?: string[];
  extraFundingLineAddresses?: string[];
};

type RulePreview = {
  derivedRuleHashHex: string;
  derivedPayoutHashHex: string;
};

type WizardDetailState =
  | { key: "launch-preview" }
  | { key: "rule-commitments"; outcomeId: string }
  | { key: "protection-posture" };

const ZERO_HASH = "0".repeat(64);
const SOL_DECIMALS = 9;
const DEFAULT_PROTECTION_METADATA_URIS = {
  defi_native: "/metadata/protection/default-defi-v1.json",
  rwa_policy: "/metadata/protection/default-rwa-v1.json",
} as const;

function defaultProtectionMetadataUri(pathway: Exclude<CoveragePathway, "">): string {
  return DEFAULT_PROTECTION_METADATA_URIS[pathway];
}

function isGenesisProtectAcuteTemplate(value: string | null): boolean {
  return (value ?? "").trim() === GENESIS_PROTECT_ACUTE_TEMPLATE_KEY;
}

const STEP_COPY: Record<StepId, StepCopy> = {
  basics: {
    headline: "Set up the foundation for your",
    emphasis: "Health Plan.",
    body: "Start with the core details for your plan. You’ll choose the reward and protection options it should launch with in the next steps.",
    tip: "Choose a plan name, reserve domain, and public metadata you’ll be comfortable keeping long term. You can fine-tune rewards and coverage after this.",
  },
  membership: {
    headline: "Set the enrollment posture for your",
    emphasis: "Membership Surface.",
    body: "Enrollment rules live on the plan root and apply before members can participate in any attached reward or protection lane.",
    tip: "Keep the first launch simple. You can tighten enrollment later, but confusing membership posture creates support load immediately.",
  },
  verification: {
    headline: "Anchor a real verifier set for",
    emphasis: "Oracle Policy.",
    body: "The selected verifiers and quorum are committed into plan-level policy hashes so lane behavior stays tied back to one verification baseline.",
    tip: "Pick enough verifiers to avoid single-operator fragility, but keep quorum understandable for launch-day operations.",
  },
  "reward-lane": {
    headline: "Create the initial incentive lane for",
    emphasis: "Rewards.",
    body: "Reward lanes carry outcome selection, rule IDs, payout commitments, and the sponsor-budget line that will fund incentives later.",
    tip: "Keep the first reward lane narrow. It is better to launch one crisp outcome lane than a broad lane with muddy comparability.",
  },
  "protection-lane": {
    headline: "Wire the first premium rail for",
    emphasis: "Protection.",
    body: "Protection posture stays real through structured metadata commitments, a protection policy series, and an initial premium-income funding line.",
    tip: "Use public terms and disclosure links that people can actually inspect. The hashes should commit to something humans can read.",
  },
  review: {
    headline: "Review every lane, address, and",
    emphasis: "Launch Artifact.",
    body: "The final launch sends only canonical plan, series, and funding-line instructions. No stale pool typing survives this step.",
    tip: "If creation partially succeeds, rerunning is safe for account creation. Existing plan, series, and funding lines are skipped automatically.",
  },
};

function normalize(value: string): string {
  return value.trim();
}

function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "n/a";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function firstError(errors: string[]): string | null {
  return errors[0] ?? null;
}

function toPositiveInt(value: string): number {
  const parsed = Number.parseInt(normalize(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function protocolToken(value: string): string {
  const normalized = normalize(value)
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return normalized || "PENDING";
}

function seedDefault(value: string, fallback: string): string {
  const normalized = normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (normalized || fallback).slice(0, 32);
}

function seriesDisplayDefault(planDisplayName: string, suffix: string): string {
  const normalized = normalize(planDisplayName);
  return normalized ? `${normalized} ${suffix}` : `OmegaX ${suffix}`;
}

function toAssetPublicKey(value: string): PublicKey | null {
  try {
    return new PublicKey(normalize(value));
  } catch {
    return null;
  }
}

function toUiAmountBaseUnits(value: string, mode: PayoutAssetMode, splDecimals: number | null): bigint {
  if (mode === "sol") {
    return parseUiAmountToBaseUnits(value, SOL_DECIMALS);
  }
  if (splDecimals === null) {
    throw new Error("Token decimals are not loaded yet.");
  }
  return parseUiAmountToBaseUnits(value, splDecimals);
}

function baseUnitsPreview(value: string, mode: PayoutAssetMode, splDecimals: number | null): string {
  try {
    return toUiAmountBaseUnits(value, mode, splDecimals).toString();
  } catch {
    return "n/a";
  }
}

function buildWorkflowSteps(intent: LaunchIntent, genesisTemplateMode = false): StepDescriptor[] {
  const steps: StepDescriptor[] = [
    { id: "basics", number: "01", label: "Basics" },
    { id: "membership", number: "02", label: "Membership" },
    { id: "verification", number: "03", label: "Verification" },
  ];
  if (genesisTemplateMode) {
    steps.push({ id: "review", number: String(steps.length + 1).padStart(2, "0"), label: "Review" });
    return steps;
  }
  if (requiresRewardLane(intent)) {
    steps.push({ id: "reward-lane", number: String(steps.length + 1).padStart(2, "0"), label: "Reward Lane" });
  }
  if (requiresProtectionLane(intent)) {
    steps.push({ id: "protection-lane", number: String(steps.length + 1).padStart(2, "0"), label: "Protection Lane" });
  }
  steps.push({ id: "review", number: String(steps.length + 1).padStart(2, "0"), label: "Review" });
  return steps;
}

function buildLaunchOracleOptions(
  liveProfiles: Array<{ oracle: string; active: boolean; metadataUri: string }>,
  selectedOracles: string[],
): MultiOracleOption[] {
  const options = new Map<string, MultiOracleOption>();

  for (const profile of liveProfiles) {
    options.set(profile.oracle, {
      oracle: profile.oracle,
      active: profile.active,
      metadataUri: profile.metadataUri,
    });
  }

  for (const oracle of selectedOracles) {
    if (!options.has(oracle)) {
      options.set(oracle, {
        oracle,
        active: true,
        metadataUri: "Manual oracle entry",
      });
    }
  }

  return [...options.values()];
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

function LaunchPreviewMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="plans-launch-preview-metric">
      <span className="plans-launch-preview-metric-label">{label}</span>
      <strong className="plans-launch-preview-metric-value">{value}</strong>
      <span className="plans-launch-preview-metric-detail">{detail}</span>
    </div>
  );
}

function wizardDetailKey(detail: WizardDetailState): string {
  return detail.key === "rule-commitments" ? `rule-commitments:${detail.outcomeId}` : detail.key;
}

export function PlanCreationWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { snapshot } = useProtocolConsoleSnapshot();
  const genesisTemplateMode = isGenesisProtectAcuteTemplate(searchParams.get("template"));

  const [launchIntent, setLaunchIntent] = useState<LaunchIntent>("hybrid");
  const [stepIndex, setStepIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);
  const [createdArtifacts, setCreatedArtifacts] = useState<CreatedArtifacts | null>(null);

  const [planId, setPlanId] = useState("nexus-protect-plus");
  const [displayName, setDisplayName] = useState("Nexus Protect Plus");
  const [organizationRef, setOrganizationRef] = useState("OmegaX Sponsor Desk");
  const [reserveDomainAddress, setReserveDomainAddress] = useState("");
  const [planMetadataUri, setPlanMetadataUri] = useState("https://protocol.omegax.health/plans/holder");
  const [payoutAssetMode, setPayoutAssetMode] = useState<PayoutAssetMode>("spl");
  const [payoutMint, setPayoutMint] = useState("");
  const [rewardPayoutUi, setRewardPayoutUi] = useState("25");
  const [termsHashHex, setTermsHashHex] = useState("");
  const [payoutPolicyHashHex, setPayoutPolicyHashHex] = useState("");

  const [coveragePathway, setCoveragePathway] = useState<CoveragePathway>("defi_native");
  const [defiSettlementMode, setDefiSettlementMode] = useState<DefiSettlementMode>("onchain_programmatic");
  const [defiTechnicalTermsUri, setDefiTechnicalTermsUri] = useState("https://protocol.omegax.health/coverage/technical-terms");
  const [defiRiskDisclosureUri, setDefiRiskDisclosureUri] = useState("https://protocol.omegax.health/coverage/risk-disclosures");
  const [rwaLegalEntityName, setRwaLegalEntityName] = useState("");
  const [rwaJurisdiction, setRwaJurisdiction] = useState("");
  const [rwaPolicyTermsUri, setRwaPolicyTermsUri] = useState("");
  const [rwaRegulatoryLicenseRef, setRwaRegulatoryLicenseRef] = useState("");
  const [rwaComplianceContact, setRwaComplianceContact] = useState("");

  const [membershipMode, setMembershipMode] = useState<MembershipMode>("open");
  const [membershipGateKind, setMembershipGateKind] = useState<MembershipGateKind>("open");
  const [tokenGateMint, setTokenGateMint] = useState("");
  const [tokenGateMinBalance, setTokenGateMinBalance] = useState("1");
  const [inviteIssuer, setInviteIssuer] = useState("");

  const [selectedOracles, setSelectedOracles] = useState<string[]>([]);
  const [oracleSearch, setOracleSearch] = useState("");
  const [quorumM, setQuorumM] = useState("1");
  const [requireVerifiedSchema, setRequireVerifiedSchema] = useState(true);
  const [allowDelegatedClaims, setAllowDelegatedClaims] = useState(false);
  const [selectedSchemaAddress, setSelectedSchemaAddress] = useState("");
  const [showAllSchemas, setShowAllSchemas] = useState(false);

  const [schemaOutcomes, setSchemaOutcomes] = useState<SchemaOutcomeOption[]>([]);
  const [schemaWarnings, setSchemaWarnings] = useState<string[]>([]);
  const [schemaMetadataLoading, setSchemaMetadataLoading] = useState(false);
  const [selectedOutcomeIds, setSelectedOutcomeIds] = useState<string[]>([]);
  const [outcomeSearch, setOutcomeSearch] = useState("");
  const [ruleIdsByOutcome, setRuleIdsByOutcome] = useState<Record<string, string>>({});
  const [ruleHashOverridesByOutcome, setRuleHashOverridesByOutcome] = useState<Record<string, string>>({});
  const [payoutHashOverridesByOutcome, setPayoutHashOverridesByOutcome] = useState<Record<string, string>>({});
  const [rulePreviewMap, setRulePreviewMap] = useState<Record<string, RulePreview>>({});

  const [rewardSeriesId, setRewardSeriesId] = useState("");
  const [rewardSeriesDisplayName, setRewardSeriesDisplayName] = useState("");
  const [rewardSeriesMetadataUri, setRewardSeriesMetadataUri] = useState("https://protocol.omegax.health/series/rewards");
  const [rewardFundingLineId, setRewardFundingLineId] = useState("");
  const [rewardCommittedBudgetUi, setRewardCommittedBudgetUi] = useState("1000");

  const [protectionSeriesId, setProtectionSeriesId] = useState("");
  const [protectionSeriesDisplayName, setProtectionSeriesDisplayName] = useState("");
  const [protectionSeriesMetadataUri, setProtectionSeriesMetadataUri] = useState(defaultProtectionMetadataUri("defi_native"));
  const [protectionFundingLineId, setProtectionFundingLineId] = useState("");
  const [protectionCadenceDays, setProtectionCadenceDays] = useState("30");
  const [protectionExpectedPremiumUi, setProtectionExpectedPremiumUi] = useState("250");

  const [splDecimals, setSplDecimals] = useState<number | null>(null);
  const [activeDetail, setActiveDetail] = useState<WizardDetailState | null>(null);
  const detailTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const walletAddress = publicKey?.toBase58() ?? "";
  const liveReserveDomains = useMemo(
    () => snapshot.reserveDomains.filter((domain) => domain.active),
    [snapshot.reserveDomains],
  );
  const liveReserveDomainOptions = liveReserveDomains.length > 0 ? liveReserveDomains : snapshot.reserveDomains;
  const liveDomainAssetVaults = snapshot.domainAssetVaults;
  const liveSchemaOptions = useMemo(
    () => (showAllSchemas ? snapshot.outcomeSchemas : snapshot.outcomeSchemas.filter((schema) => schema.verified)),
    [showAllSchemas, snapshot.outcomeSchemas],
  );
  const selectedSchema = useMemo(
    () => liveSchemaOptions.find((schema) => schema.address === selectedSchemaAddress)
      ?? snapshot.outcomeSchemas.find((schema) => schema.address === selectedSchemaAddress)
      ?? null,
    [liveSchemaOptions, selectedSchemaAddress, snapshot.outcomeSchemas],
  );
  const liveOracleProfiles = useMemo(
    () => snapshot.oracleProfiles
      .filter((profile) => profile.claimed)
      .map((profile) => ({
        oracle: profile.oracle,
        active: profile.active,
        metadataUri: profile.displayName || profile.websiteUrl || profile.appUrl || profile.legalName || profile.oracle,
      })),
    [snapshot.oracleProfiles],
  );
  const genesisWizardDefaults = useMemo(
    () => buildGenesisProtectAcuteWizardDefaults(reserveDomainAddress),
    [reserveDomainAddress],
  );
  const steps = useMemo(() => buildWorkflowSteps(launchIntent, genesisTemplateMode), [genesisTemplateMode, launchIntent]);
  const activeStep = steps[stepIndex] ?? steps[0]!;
  const isFirstStep = stepIndex === 0;
  const progressPct = ((stepIndex + 1) / steps.length) * 100;
  const copy = STEP_COPY[activeStep.id];
  const rewardLaneRequired = !genesisTemplateMode && requiresRewardLane(launchIntent);
  const protectionLaneRequired = !genesisTemplateMode && requiresProtectionLane(launchIntent);
  const payoutAssetAddress = payoutAssetMode === "spl" ? payoutMint : ZERO_PUBKEY;
  const reserveDomainPk = toAssetPublicKey(reserveDomainAddress);
  const payoutMintPk = toAssetPublicKey(payoutAssetAddress);
  const availableRailMints = useMemo(
    () => {
      const seen = new Set<string>();
      const mints: string[] = [];
      for (const vault of liveDomainAssetVaults) {
        if (vault.reserveDomain !== reserveDomainAddress) continue;
        if (seen.has(vault.assetMint)) continue;
        seen.add(vault.assetMint);
        mints.push(vault.assetMint);
      }
      return mints;
    },
    [liveDomainAssetVaults, reserveDomainAddress],
  );

  const openDetail = useCallback((detail: WizardDetailState, trigger: HTMLButtonElement) => {
    detailTriggerRefs.current[wizardDetailKey(detail)] = trigger;
    setActiveDetail(detail);
  }, []);

  const handleMembershipModeChange = useCallback((nextMode: MembershipMode) => {
    setMembershipMode(nextMode);
    if (nextMode === "open") {
      setMembershipGateKind("open");
      return;
    }
    if (nextMode === "invite_only") {
      setMembershipGateKind("invite_only");
      return;
    }
    setMembershipGateKind((current) =>
      current === "nft_anchor" || current === "stake_anchor" || current === "fungible_snapshot"
        ? current
        : "fungible_snapshot");
  }, []);

  const handleCoveragePathwayChange = useCallback((nextPathway: Exclude<CoveragePathway, "">) => {
    setCoveragePathway(nextPathway);
    setProtectionSeriesMetadataUri((current) => {
      const normalizedCurrent = normalize(current);
      if (
        !normalizedCurrent
        || normalizedCurrent === normalize(defaultProtectionMetadataUri("defi_native"))
        || normalizedCurrent === normalize(defaultProtectionMetadataUri("rwa_policy"))
      ) {
        return defaultProtectionMetadataUri(nextPathway);
      }
      return current;
    });
  }, []);

  const closeActiveDetail = useCallback(() => {
    if (!activeDetail) return;
    const trigger = detailTriggerRefs.current[wizardDetailKey(activeDetail)];
    setActiveDetail(null);
    window.requestAnimationFrame(() => {
      trigger?.focus();
    });
  }, [activeDetail]);

  useEffect(() => {
    if (reserveDomainAddress) return;
    const nextReserveDomain = liveReserveDomainOptions[0]?.address ?? "";
    if (nextReserveDomain) {
      setReserveDomainAddress(nextReserveDomain);
    }
  }, [liveReserveDomainOptions, reserveDomainAddress]);

  useEffect(() => {
    if (!selectedSchemaAddress) {
      const preferredSchema = snapshot.outcomeSchemas.find((schema) => schema.verified) ?? snapshot.outcomeSchemas[0] ?? null;
      if (preferredSchema) {
        setSelectedSchemaAddress(preferredSchema.address);
      }
    }
  }, [selectedSchemaAddress, snapshot.outcomeSchemas]);

  useEffect(() => {
    if (payoutMint && availableRailMints.includes(payoutMint)) return;
    if (availableRailMints[0]) {
      setPayoutMint(availableRailMints[0]);
    }
  }, [availableRailMints, payoutMint]);

  useEffect(() => {
    if (!genesisTemplateMode) return;
    setLaunchIntent("insurance");
    setPlanId(genesisWizardDefaults.planId);
    setDisplayName(genesisWizardDefaults.displayName);
    setOrganizationRef(genesisWizardDefaults.organizationRef);
    setPlanMetadataUri(GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI);
    setPayoutAssetMode("spl");
    if (genesisWizardDefaults.payoutMint) {
      setPayoutMint(genesisWizardDefaults.payoutMint);
    }
    setCoveragePathway("defi_native");
    setDefiSettlementMode("onchain_programmatic");
  }, [genesisTemplateMode, genesisWizardDefaults]);

  useEffect(() => {
    if (!rewardSeriesId) {
      setRewardSeriesId(seedDefault(`${planId}-rewards`, "reward-series"));
    }
  }, [planId, rewardSeriesId]);

  useEffect(() => {
    if (!rewardFundingLineId) {
      setRewardFundingLineId(seedDefault(`${planId}-sponsor-budget`, "reward-budget"));
    }
  }, [planId, rewardFundingLineId]);

  useEffect(() => {
    if (!rewardSeriesDisplayName) {
      setRewardSeriesDisplayName(seriesDisplayDefault(displayName, "Rewards"));
    }
  }, [displayName, rewardSeriesDisplayName]);

  useEffect(() => {
    if (!protectionSeriesId) {
      setProtectionSeriesId(seedDefault(`${planId}-protection`, "protection-series"));
    }
  }, [planId, protectionSeriesId]);

  useEffect(() => {
    if (!protectionFundingLineId) {
      setProtectionFundingLineId(seedDefault(`${planId}-member-premiums`, "premium-income"));
    }
  }, [planId, protectionFundingLineId]);

  useEffect(() => {
    if (!protectionSeriesDisplayName) {
      setProtectionSeriesDisplayName(seriesDisplayDefault(displayName, "Protection"));
    }
  }, [displayName, protectionSeriesDisplayName]);

  useEffect(() => {
    if (selectedOracles.length > 0) return;
    const initial = dedupeOracleOptions(
      liveOracleProfiles.filter((profile) => profile.active).map((profile) => profile.oracle),
    );
    if (initial.length > 0) {
      setSelectedOracles(initial);
      setQuorumM("1");
    }
  }, [liveOracleProfiles, selectedOracles.length]);

  useEffect(() => {
    let cancelled = false;
    setSchemaMetadataLoading(true);
    void (async () => {
      if (!selectedSchema?.metadataUri) {
        setSchemaWarnings(["Select an outcome schema with a reachable metadata URI before configuring reward lanes."]);
        setSchemaOutcomes([]);
        setSchemaMetadataLoading(false);
        return;
      }
      const fetchResult = await fetchSchemaMetadata(selectedSchema.metadataUri);
      if (cancelled) return;
      if (fetchResult.error) {
        setSchemaWarnings([fetchResult.error.message]);
        setSchemaOutcomes([]);
        setSchemaMetadataLoading(false);
        return;
      }
      const parsed = parseSchemaOutcomes(fetchResult.metadata);
      setSchemaOutcomes(parsed.outcomes);
      setSchemaWarnings(parsed.warnings);
      setSchemaMetadataLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSchema?.metadataUri]);

  useEffect(() => {
    setSelectedOutcomeIds([]);
    setRuleIdsByOutcome({});
    setRuleHashOverridesByOutcome({});
    setPayoutHashOverridesByOutcome({});
  }, [selectedSchemaAddress]);

  useEffect(() => {
    if (payoutAssetMode === "sol") {
      setSplDecimals(SOL_DECIMALS);
      return;
    }
    if (!payoutMintPk) {
      setSplDecimals(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const decimals = await getMintDecimals(connection, payoutMintPk);
        if (!cancelled) {
          setSplDecimals(decimals);
        }
      } catch {
        if (!cancelled) {
          setSplDecimals(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, payoutAssetMode, payoutMintPk]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nextPreview: Record<string, RulePreview> = {};
      for (const outcomeId of selectedOutcomeIds) {
        const outcome = schemaOutcomes.find((entry) => entry.id === outcomeId);
        const ruleId = normalize(ruleIdsByOutcome[outcomeId] ?? "") || seedDefault(outcomeId, "reward-rule");
        const ruleOverride = normalize(ruleHashOverridesByOutcome[outcomeId] ?? "");
        const payoutOverride = normalize(payoutHashOverridesByOutcome[outcomeId] ?? "");
        const derivedRuleHashHex = ruleOverride || await stableSha256Hex({
          schemaKey: selectedSchema?.schemaKey ?? "",
          outcomeId,
          ruleId,
          launchIntent,
        });
        const derivedPayoutHashHex = payoutOverride || await stableSha256Hex({
          schemaKey: selectedSchema?.schemaKey ?? "",
          outcomeId,
          rewardPayoutUi: normalize(rewardPayoutUi),
          outcomeLabel: outcome?.label ?? outcomeId,
        });
        nextPreview[outcomeId] = {
          derivedRuleHashHex,
          derivedPayoutHashHex,
        };
      }
      if (!cancelled) {
        setRulePreviewMap(nextPreview);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    launchIntent,
    payoutHashOverridesByOutcome,
    rewardPayoutUi,
    ruleHashOverridesByOutcome,
    ruleIdsByOutcome,
    schemaOutcomes,
    selectedSchema?.schemaKey,
    selectedOutcomeIds,
  ]);

  useEffect(() => {
    if (stepIndex <= steps.length - 1) return;
    setStepIndex(steps.length - 1);
  }, [stepIndex, steps.length]);

  useEffect(() => {
    setActiveDetail(null);
  }, [activeStep.id]);

  const addressPreview = useMemo(
    () => buildLaunchAddressPreview({
      reserveDomainAddress,
      planId,
      rewardSeriesId: rewardLaneRequired ? rewardSeriesId : null,
      protectionSeriesId: protectionLaneRequired ? protectionSeriesId : null,
      rewardLineId: rewardLaneRequired ? rewardFundingLineId : null,
      protectionLineId: protectionLaneRequired ? protectionFundingLineId : null,
    }),
    [
      planId,
      protectionFundingLineId,
      protectionLaneRequired,
      protectionSeriesId,
      reserveDomainAddress,
      rewardFundingLineId,
      rewardLaneRequired,
      rewardSeriesId,
    ],
  );
  const genesisArtifactPreview = useMemo(
    () => (genesisTemplateMode && reserveDomainPk
      ? buildGenesisProtectAcuteArtifactAddresses(reserveDomainPk.toBase58())
      : null),
    [genesisTemplateMode, reserveDomainPk],
  );

  const protectionPosture = useMemo(
    () => serializeProtectionPosture({
      coveragePathway,
      defiSettlementMode,
      defiTechnicalTermsUri,
      defiRiskDisclosureUri,
      rwaLegalEntityName,
      rwaJurisdiction,
      rwaPolicyTermsUri,
      rwaRegulatoryLicenseRef,
      rwaComplianceContact,
      protectionMetadataUri: protectionSeriesMetadataUri,
    }),
    [
      coveragePathway,
      defiRiskDisclosureUri,
      defiSettlementMode,
      defiTechnicalTermsUri,
      protectionSeriesMetadataUri,
      rwaComplianceContact,
      rwaJurisdiction,
      rwaLegalEntityName,
      rwaPolicyTermsUri,
      rwaRegulatoryLicenseRef,
    ],
  );

  const filteredOutcomes = useMemo(() => {
    const needle = normalize(outcomeSearch).toLowerCase();
    if (!needle) return schemaOutcomes;
    return schemaOutcomes.filter((outcome) =>
      [outcome.id, outcome.label].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [outcomeSearch, schemaOutcomes]);

  const oracleOptions = useMemo(
    () => buildLaunchOracleOptions(liveOracleProfiles, selectedOracles),
    [liveOracleProfiles, selectedOracles],
  );

  const basicsErrors = useMemo(
    () => validateLaunchBasics({
      launchIntent,
      planId,
      displayName,
      organizationRef,
      reserveDomainAddress,
      metadataUri: planMetadataUri,
      payoutAssetMode,
      payoutMint,
      rewardPayoutUi,
      termsHashHex,
      payoutPolicyHashHex,
      coveragePathway,
      defiSettlementMode,
      defiTechnicalTermsUri,
      defiRiskDisclosureUri,
      rwaLegalEntityName,
      rwaJurisdiction,
      rwaPolicyTermsUri,
      rwaRegulatoryLicenseRef,
      rwaComplianceContact,
    }),
    [
      coveragePathway,
      defiRiskDisclosureUri,
      defiSettlementMode,
      defiTechnicalTermsUri,
      displayName,
      launchIntent,
      organizationRef,
      payoutAssetMode,
      payoutMint,
      payoutPolicyHashHex,
      planId,
      planMetadataUri,
      reserveDomainAddress,
      rewardPayoutUi,
      rwaComplianceContact,
      rwaJurisdiction,
      rwaLegalEntityName,
      rwaPolicyTermsUri,
      rwaRegulatoryLicenseRef,
      termsHashHex,
    ],
  );

  const membershipErrors = useMemo(
    () => validateLaunchMembership({
      launchIntent,
      membershipMode,
      membershipGateKind,
      tokenGateMint,
      tokenGateMinBalance,
      inviteIssuer,
    }),
    [inviteIssuer, launchIntent, membershipGateKind, membershipMode, tokenGateMinBalance, tokenGateMint],
  );

  const verificationErrors = useMemo(
    () => validateLaunchVerification({
      selectedOracles,
      quorumM,
    }),
    [quorumM, selectedOracles],
  );

  const rewardLaneErrors = useMemo(
    () => validateRewardLane({
      required: rewardLaneRequired,
      seriesId: rewardSeriesId,
      displayName: rewardSeriesDisplayName,
      metadataUri: rewardSeriesMetadataUri,
      sponsorLineId: rewardFundingLineId,
      selectedOutcomeIds,
      ruleIdsByOutcome,
      ruleHashOverridesByOutcome,
      payoutHashOverridesByOutcome,
    }),
    [
      payoutHashOverridesByOutcome,
      rewardFundingLineId,
      rewardLaneRequired,
      rewardSeriesDisplayName,
      rewardSeriesId,
      rewardSeriesMetadataUri,
      ruleHashOverridesByOutcome,
      ruleIdsByOutcome,
      selectedOutcomeIds,
    ],
  );

  const protectionLaneErrors = useMemo(
    () => validateProtectionLane({
      required: protectionLaneRequired,
      seriesId: protectionSeriesId,
      displayName: protectionSeriesDisplayName,
      metadataUri: protectionSeriesMetadataUri,
      premiumLineId: protectionFundingLineId,
      cadenceDays: protectionCadenceDays,
      expectedPremiumUi: protectionExpectedPremiumUi,
      posture: {
        coveragePathway,
        defiSettlementMode,
        defiTechnicalTermsUri,
        defiRiskDisclosureUri,
        rwaLegalEntityName,
        rwaJurisdiction,
        rwaPolicyTermsUri,
        rwaRegulatoryLicenseRef,
        rwaComplianceContact,
        protectionMetadataUri: protectionSeriesMetadataUri,
      },
    }),
    [
      coveragePathway,
      defiRiskDisclosureUri,
      defiSettlementMode,
      defiTechnicalTermsUri,
      protectionCadenceDays,
      protectionExpectedPremiumUi,
      protectionFundingLineId,
      protectionLaneRequired,
      protectionSeriesDisplayName,
      protectionSeriesId,
      protectionSeriesMetadataUri,
      rwaComplianceContact,
      rwaJurisdiction,
      rwaLegalEntityName,
      rwaPolicyTermsUri,
      rwaRegulatoryLicenseRef,
    ],
  );

  const reviewErrors = useMemo(() => {
    const errors = [
      ...basicsErrors,
      ...membershipErrors,
      ...verificationErrors,
      ...rewardLaneErrors,
      ...protectionLaneErrors,
    ];

    if (!connected || !publicKey || !sendTransaction) {
      errors.push("Connect a wallet with plan-control authority before launch.");
    }
    if (!addressPreview.healthPlanAddress) {
      errors.push("Plan address preview is unavailable. Check the plan ID and reserve domain.");
    }

    if (!payoutMintPk) {
      errors.push("Selected payout asset is invalid.");
    } else if (reserveDomainPk && !availableRailMints.includes(payoutMintPk.toBase58())) {
      errors.push("The selected reserve domain does not currently expose a launch rail for the chosen payout mint.");
    }

    if (rewardLaneRequired && !selectedSchema) {
      errors.push("Select a live outcome schema for the reward lane.");
    }

    if (payoutAssetMode === "spl" && splDecimals === null) {
      errors.push("Token mint decimals are not available yet.");
    }

    return errors;
  }, [
    addressPreview.healthPlanAddress,
    basicsErrors,
    connected,
    membershipErrors,
    payoutAssetMode,
    payoutMintPk,
    protectionLaneErrors,
    publicKey,
    reserveDomainAddress,
    reserveDomainPk,
    availableRailMints,
    rewardLaneErrors,
    rewardLaneRequired,
    sendTransaction,
    selectedSchema,
    splDecimals,
    verificationErrors,
  ]);

  const currentStepErrors = useMemo(() => {
    switch (activeStep.id) {
      case "basics":
        return basicsErrors;
      case "membership":
        return membershipErrors;
      case "verification":
        return verificationErrors;
      case "reward-lane":
        return rewardLaneErrors;
      case "protection-lane":
        return protectionLaneErrors;
      case "review":
        return reviewErrors;
      default:
        return [];
    }
  }, [
    activeStep.id,
    basicsErrors,
    membershipErrors,
    protectionLaneErrors,
    reviewErrors,
    rewardLaneErrors,
    verificationErrors,
  ]);

  const reviewLinks = useMemo(() => {
    if (!createdArtifacts) return null;
    if (genesisTemplateMode) {
      const primarySeries = createdArtifacts.protectionSeriesAddress;
      const encodedPlan = encodeURIComponent(createdArtifacts.healthPlanAddress);
      const encodedSeries = primarySeries ? encodeURIComponent(primarySeries) : null;
      return {
        workspaceHref: `/plans?plan=${encodedPlan}${encodedSeries ? `&series=${encodedSeries}` : ""}&tab=overview&setup=${GENESIS_PROTECT_ACUTE_TEMPLATE_KEY}`,
        rewardLaneHref: null,
        protectionLaneHref: encodedSeries
          ? `/plans?plan=${encodedPlan}&series=${encodedSeries}&tab=coverage&setup=${GENESIS_PROTECT_ACUTE_TEMPLATE_KEY}`
          : null,
        coverageWorkspaceHref: encodedSeries
          ? `/plans?plan=${encodedPlan}&series=${encodedSeries}&tab=coverage&setup=${GENESIS_PROTECT_ACUTE_TEMPLATE_KEY}`
          : null,
      };
    }
    return buildLaunchReviewLinks({
      launchIntent,
      healthPlanAddress: createdArtifacts.healthPlanAddress,
      rewardSeriesAddress: createdArtifacts.rewardSeriesAddress,
      protectionSeriesAddress: createdArtifacts.protectionSeriesAddress,
    });
  }, [createdArtifacts, genesisTemplateMode, launchIntent]);

  const launchPreviewMeta: WizardDetailMetaItem[] = [
    {
      label: `LANES ${String(genesisTemplateMode ? 2 : Number(rewardLaneRequired) + Number(protectionLaneRequired)).padStart(2, "0")}`,
      tone: "accent",
    },
    {
      label: `RAILS ${String(availableRailMints.length).padStart(2, "0")}`,
    },
    {
      label: `QUORUM ${toPositiveInt(quorumM)}/${selectedOracles.length || 0}`,
      tone: "muted",
    },
  ];

  const activeRuleOutcomeId = activeDetail?.key === "rule-commitments" ? activeDetail.outcomeId : null;
  const activeRuleOutcome = activeRuleOutcomeId
    ? schemaOutcomes.find((entry) => entry.id === activeRuleOutcomeId) ?? null
    : null;
  const activeRulePreview = activeRuleOutcomeId ? rulePreviewMap[activeRuleOutcomeId] ?? null : null;
  const activeRuleOverrideCount = activeRuleOutcomeId
    ? Number(Boolean(normalize(ruleHashOverridesByOutcome[activeRuleOutcomeId] ?? ""))) +
      Number(Boolean(normalize(payoutHashOverridesByOutcome[activeRuleOutcomeId] ?? "")))
    : 0;

  const activeDetailTitle =
    activeDetail?.key === "launch-preview"
      ? "Launch Preview"
      : activeDetail?.key === "rule-commitments"
        ? `${activeRuleOutcome?.label ?? activeRuleOutcomeId ?? "Outcome"} rule commitments`
        : activeDetail?.key === "protection-posture"
          ? "Protection posture"
          : "";

  const activeDetailSummary =
    activeDetail?.key === "launch-preview"
      ? "Review the technical plan, lane, rail, and commitment values derived from the launch form before you confirm."
      : activeDetail?.key === "rule-commitments"
        ? "Review the derived hashes for this outcome and only set overrides if you need to pin exact commitment values."
        : activeDetail?.key === "protection-posture"
          ? "Inspect the structured coverage payload this protection lane will commit to through public metadata and hashes."
          : undefined;

  const activeDetailMeta: WizardDetailMetaItem[] =
    activeDetail?.key === "launch-preview"
      ? launchPreviewMeta
      : activeDetail?.key === "rule-commitments"
        ? [
          {
            label: activeRulePreview ? "DERIVED READY" : "HASHES PENDING",
            tone: activeRulePreview ? "accent" : "muted",
          },
          {
            label: `OVERRIDES ${activeRuleOverrideCount}`,
            tone: activeRuleOverrideCount > 0 ? "accent" : "muted",
          },
        ]
        : activeDetail?.key === "protection-posture"
          ? [
            {
              label: `PATH ${protocolToken(coveragePathway)}`,
              tone: "accent",
            },
            {
              label: `SETTLEMENT ${protocolToken(
                coveragePathway === "defi_native" ? defiSettlementMode : coveragePathway,
              )}`,
            },
          ]
          : [];

  const addActionLog = useCallback((entry: Omit<ActionLog, "id">) => {
    setActionLog((current) => [
      {
        id: randomId(),
        ...entry,
      },
      ...current,
    ]);
  }, []);

  const handleToggleOracle = useCallback((oracle: string) => {
    setSelectedOracles((current) => {
      const exists = current.includes(oracle);
      const next = exists
        ? current.filter((entry) => entry !== oracle)
        : [...current, oracle];
      return dedupeOracleOptions(next);
    });
  }, []);

  const handleToggleOutcome = useCallback((outcomeId: string) => {
    setSelectedOutcomeIds((current) => {
      const exists = current.includes(outcomeId);
      if (exists) {
        return current.filter((entry) => entry !== outcomeId);
      }
      return [...current, outcomeId];
    });
    setRuleIdsByOutcome((current) =>
      current[outcomeId]
        ? current
        : {
          ...current,
          [outcomeId]: seedDefault(outcomeId, "reward-rule"),
        });
  }, []);

  const openFirstFailingStep = useCallback(() => {
    const candidates: Array<{ id: StepId; errors: string[] }> = [
      { id: "basics", errors: basicsErrors },
      { id: "membership", errors: membershipErrors },
      { id: "verification", errors: verificationErrors },
      { id: "reward-lane", errors: rewardLaneErrors },
      { id: "protection-lane", errors: protectionLaneErrors },
      { id: "review", errors: reviewErrors },
    ];
    const failing = candidates.find((candidate) => candidate.errors.length > 0 && steps.some((step) => step.id === candidate.id));
    if (!failing) return;
    const index = steps.findIndex((step) => step.id === failing.id);
    if (index >= 0) setStepIndex(index);
  }, [
    basicsErrors,
    membershipErrors,
    protectionLaneErrors,
    reviewErrors,
    rewardLaneErrors,
    steps,
    verificationErrors,
  ]);

  const handleLaunch = useCallback(async () => {
    if (reviewErrors.length > 0) {
      openFirstFailingStep();
      setStatusTone("error");
      setStatusMessage(firstError(reviewErrors));
      return;
    }
    if (!publicKey || !sendTransaction || !reserveDomainPk || !payoutMintPk) {
      setStatusTone("error");
      setStatusMessage("Connect a wallet and resolve the reserve domain and payout mint before launch.");
      return;
    }
    if (rewardLaneRequired && !selectedSchema) {
      setStatusTone("error");
      setStatusMessage("Select a live outcome schema before launching a reward lane.");
      return;
    }
    if (!addressPreview.healthPlanAddress) {
      setStatusTone("error");
      setStatusMessage("Plan address preview is unavailable.");
      return;
    }

    const normalizedPlanId = normalize(planId);
    const normalizedRewardSeriesId = normalize(rewardSeriesId);
    const normalizedProtectionSeriesId = normalize(protectionSeriesId);
    const normalizedRewardFundingLineId = normalize(rewardFundingLineId);
    const normalizedProtectionFundingLineId = normalize(protectionFundingLineId);

    const healthPlanPk = deriveHealthPlanPda({
      reserveDomain: reserveDomainPk,
      planId: normalizedPlanId,
    });

    const rewardSeriesPk = rewardLaneRequired
      ? derivePolicySeriesPda({
        healthPlan: healthPlanPk,
        seriesId: normalizedRewardSeriesId,
      })
      : null;
    const protectionSeriesPk = protectionLaneRequired
      ? derivePolicySeriesPda({
        healthPlan: healthPlanPk,
        seriesId: normalizedProtectionSeriesId,
      })
      : null;
    const rewardFundingLinePk = rewardLaneRequired
      ? deriveFundingLinePda({
        healthPlan: healthPlanPk,
        lineId: normalizedRewardFundingLineId,
      })
      : null;
    const protectionFundingLinePk = protectionLaneRequired
      ? deriveFundingLinePda({
        healthPlan: healthPlanPk,
        lineId: normalizedProtectionFundingLineId,
      })
      : null;

    const assetMintPk = payoutMintPk;

    const createTransaction = async (label: string, instruction: ReturnType<typeof buildCreateHealthPlanInstruction>) => {
      const tx = new Transaction({ feePayer: publicKey }).add(instruction);
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      addActionLog({
        action: label,
        message: result.message,
        explorerUrl: result.explorerUrl,
        signature: result.signature,
      });
    };
    const createBuiltTransaction = async (label: string, tx: Transaction) => {
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      addActionLog({
        action: label,
        message: result.message,
        explorerUrl: result.explorerUrl,
        signature: result.signature,
      });
    };
    const nextRecentBlockhash = async () => (await connection.getLatestBlockhash("confirmed")).blockhash;

    try {
      setBusyAction("Launching canonical health plan");
      setStatusMessage(null);
      setStatusTone(null);

      const preflightTargets = deriveLaunchPreflightAccountAddresses({
        reserveDomain: reserveDomainPk,
        healthPlan: healthPlanPk,
        assetMint: assetMintPk,
        rewardSeries: rewardSeriesPk,
        rewardFundingLine: rewardFundingLinePk,
        protectionSeries: protectionSeriesPk,
        protectionFundingLine: protectionFundingLinePk,
      });
      const preflightInfos = await connection.getMultipleAccountsInfo(preflightTargets, "confirmed");
      if (preflightInfos[0] === null) {
        throw new Error("The selected reserve domain account is not available on the connected cluster.");
      }
      const missingRailIndex = preflightInfos.findIndex((info, index) => index > 0 && info === null);
      if (missingRailIndex >= 0) {
        throw new Error("The selected reserve domain does not expose the required domain asset vault and ledger for this launch asset.");
      }

      const artifactTargets = [
        healthPlanPk,
        rewardSeriesPk,
        protectionSeriesPk,
        rewardFundingLinePk,
        protectionFundingLinePk,
      ].filter((pk): pk is PublicKey => Boolean(pk));
      const artifactInfos = await connection.getMultipleAccountsInfo(artifactTargets, "confirmed");
      const artifactExists = new Map<string, boolean>();
      artifactTargets.forEach((pk, index) => {
        artifactExists.set(pk.toBase58(), artifactInfos[index] !== null);
      });

      const rewardCommittedAmount = rewardLaneRequired
        ? toUiAmountBaseUnits(rewardCommittedBudgetUi, payoutAssetMode, splDecimals)
        : 0n;
      const protectionCommittedAmount = protectionLaneRequired
        ? toUiAmountBaseUnits(protectionExpectedPremiumUi, payoutAssetMode, splDecimals)
        : 0n;
      const membershipGateMintPk = membershipMode === "token_gate"
        ? new PublicKey(normalize(tokenGateMint))
        : new PublicKey(ZERO_PUBKEY);
      const membershipInviteAuthorityPk = membershipMode === "invite_only"
        ? new PublicKey(normalize(inviteIssuer))
        : new PublicKey(ZERO_PUBKEY);
      const membershipGateMinAmount = membershipMode === "token_gate"
        ? BigInt(normalize(tokenGateMinBalance) || "0")
        : 0n;
      const validatedProtectionMetadata = protectionLaneRequired
        ? await validateProtectionMetadataAgainstPosture(
          normalize(protectionSeriesMetadataUri),
          {
            coveragePathway,
            defiSettlementMode,
            defiTechnicalTermsUri,
            defiRiskDisclosureUri,
            rwaLegalEntityName,
            rwaJurisdiction,
            rwaPolicyTermsUri,
            rwaRegulatoryLicenseRef,
            rwaComplianceContact,
            protectionMetadataUri: protectionSeriesMetadataUri,
          },
        )
        : null;
      if (protectionLaneRequired && (!validatedProtectionMetadata || validatedProtectionMetadata.error || !validatedProtectionMetadata.document)) {
        throw new Error(
          `Protection metadata validation failed: ${validatedProtectionMetadata?.error?.message ?? "The protection metadata URI must resolve to a matching structured JSON document."}`,
        );
      }

      const oracleAuthority = new PublicKey(selectedOracles[0]!);
      const oraclePolicyHashHex = await stableSha256Hex({
        verifiers: [...selectedOracles].sort(),
        quorumM: toPositiveInt(quorumM),
        requireVerifiedSchema,
        allowDelegatedClaims,
      });

      if (genesisTemplateMode) {
        const genesisArtifacts = buildGenesisProtectAcuteArtifactAddresses(reserveDomainPk.toBase58());
        const genesisPlanPk = new PublicKey(genesisArtifacts.healthPlanAddress);
        const genesisPoolPk = new PublicKey(genesisArtifacts.poolAddress);
        const genesisSeriesDefinitions = [
          GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU,
          GENESIS_PROTECT_ACUTE_PRIMARY_SKU,
        ] as const;
        const genesisSeriesBySku = {
          event7: new PublicKey(genesisArtifacts.seriesAddresses.event7),
          travel30: new PublicKey(genesisArtifacts.seriesAddresses.travel30),
        } as const;
        const genesisFundingLineDefinitions = genesisProtectAcuteBootstrapFundingLines();
        const genesisFundingLineById = Object.fromEntries(
          Object.entries(genesisArtifacts.fundingLineAddresses).map(([lineId, address]) => [lineId, new PublicKey(address)]),
        ) as Record<string, PublicKey>;
        const genesisClassDefinitions = genesisProtectAcuteBootstrapCapitalClasses();
        const genesisClassById = {
          [genesisClassDefinitions[0]!.classId]: new PublicKey(genesisArtifacts.classAddresses.senior),
          [genesisClassDefinitions[1]!.classId]: new PublicKey(genesisArtifacts.classAddresses.junior),
        } as Record<string, PublicKey>;
        const genesisAllocationDefinitions = genesisProtectAcuteBootstrapAllocations();
        const genesisAllocationByKey = Object.fromEntries(
          Object.entries(genesisArtifacts.allocationAddresses).map(([key, address]) => [key, new PublicKey(address)]),
        ) as Record<string, PublicKey>;
        const genesisDocuments = Object.fromEntries(
          await Promise.all(
            genesisSeriesDefinitions.map(async (definition) => {
              const fetched = await fetchProtectionMetadataDocument(definition.metadataUri);
              if (fetched.error || !fetched.document) {
                throw new Error(
                  `Genesis protection metadata is unavailable for ${definition.displayName}: ${fetched.error?.message ?? "missing document"}`,
                );
              }
              return [definition.key, fetched.document] as const;
            }),
          ),
        ) as Record<(typeof genesisSeriesDefinitions)[number]["key"], Awaited<ReturnType<typeof fetchProtectionMetadataDocument>>["document"]>;

        const genesisPreflightTargets = deriveLaunchPreflightAccountAddresses({
          reserveDomain: reserveDomainPk,
          healthPlan: genesisPlanPk,
          assetMint: assetMintPk,
          protectionSeries: genesisSeriesBySku.travel30,
          protectionFundingLine: genesisFundingLineById[GENESIS_PROTECT_ACUTE_PRIMARY_SKU.fundingLineIds.premium]!,
        });
        const genesisPreflightInfos = await connection.getMultipleAccountsInfo(genesisPreflightTargets, "confirmed");
        if (genesisPreflightInfos[0] === null) {
          throw new Error("The selected reserve domain account is not available on the connected cluster.");
        }
        const missingGenesisRailIndex = genesisPreflightInfos.findIndex((info, index) => index > 0 && info === null);
        if (missingGenesisRailIndex >= 0) {
          throw new Error("The selected reserve domain does not expose the required domain asset vault and ledger for the Genesis payout rail.");
        }

        const genesisArtifactTargets = [
          genesisPlanPk,
          genesisPoolPk,
          ...Object.values(genesisSeriesBySku),
          ...Object.values(genesisFundingLineById),
          ...Object.values(genesisClassById),
          ...Object.values(genesisAllocationByKey),
        ];
        const genesisArtifactInfos = await connection.getMultipleAccountsInfo(genesisArtifactTargets, "confirmed");
        const genesisArtifactExists = new Map<string, boolean>();
        genesisArtifactTargets.forEach((pk, index) => {
          genesisArtifactExists.set(pk.toBase58(), genesisArtifactInfos[index] !== null);
        });

        const genesisMembershipGateMintPk = membershipMode === "token_gate"
          ? new PublicKey(normalize(tokenGateMint))
          : new PublicKey(ZERO_PUBKEY);
        const genesisMembershipInviteAuthorityPk = membershipMode === "invite_only"
          ? new PublicKey(normalize(inviteIssuer))
          : new PublicKey(ZERO_PUBKEY);
        const genesisMembershipGateMinAmount = membershipMode === "token_gate"
          ? BigInt(normalize(tokenGateMinBalance) || "0")
          : 0n;
        const genesisSchemaBindingHashHex = await stableSha256Hex({
          schemaKey: GENESIS_PROTECT_ACUTE_PRIMARY_SKU.evidenceSchema.schemaKey,
          schemaVersion: GENESIS_PROTECT_ACUTE_PRIMARY_SKU.evidenceSchema.schemaVersion,
          skuKeys: genesisSeriesDefinitions.map((definition) => definition.key),
        });
        const genesisComplianceBaselineHashHex = await stableSha256Hex({
          template: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
          membershipMode,
          membershipGateKind,
          membershipGateMint: genesisMembershipGateMintPk.toBase58(),
          membershipGateMinAmount: genesisMembershipGateMinAmount.toString(),
          membershipInviteAuthority: genesisMembershipInviteAuthorityPk.toBase58(),
          reserveDomainAddress,
          payoutMint: payoutAssetAddress,
        });

        if (!genesisArtifactExists.get(genesisPlanPk.toBase58())) {
          await createTransaction(
            "Create Genesis health plan",
            buildCreateHealthPlanInstruction({
              planAdmin: publicKey,
              reserveDomain: reserveDomainPk,
              healthPlan: genesisPlanPk,
              args: {
                planId: GENESIS_PROTECT_ACUTE_PLAN_ID,
                displayName: genesisWizardDefaults.displayName,
                organizationRef: genesisWizardDefaults.organizationRef,
                metadataUri: GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
                sponsor: publicKey,
                sponsorOperator: publicKey,
                claimsOperator: publicKey,
                oracleAuthority,
                membershipMode,
                membershipGateKind,
                membershipGateMint: genesisMembershipGateMintPk,
                membershipGateMinAmount: genesisMembershipGateMinAmount,
                membershipInviteAuthority: genesisMembershipInviteAuthorityPk,
                allowedRailMask: 0xffff,
                defaultFundingPriority: 0,
                oraclePolicyHashHex,
                schemaBindingHashHex: genesisSchemaBindingHashHex,
                complianceBaselineHashHex: genesisComplianceBaselineHashHex,
                pauseFlags: 0,
              },
            }),
          );
        } else {
          addActionLog({
            action: "Create Genesis health plan",
            message: "Skipped because the Genesis health plan PDA already exists.",
          });
        }

        for (const definition of genesisSeriesDefinitions) {
          const seriesPk = genesisSeriesBySku[definition.key];
          const document = genesisDocuments[definition.key];
          const protectionTermsHashHex = await stableSha256Hex({
            template: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
            planId: GENESIS_PROTECT_ACUTE_PLAN_ID,
            seriesId: definition.seriesId,
            metadata: document,
          });
          const protectionPricingHashHex = await stableSha256Hex({
            skuKey: definition.key,
            pricing: definition.pricing,
            waitingPeriods: definition.waitingPeriods,
          });
          const protectionPayoutHashHex = await stableSha256Hex({
            skuKey: definition.key,
            benefitTiers: definition.benefitTiers,
            reimbursementTopUp: definition.reimbursementTopUp ?? null,
          });
          const protectionReserveModelHashHex = await stableSha256Hex({
            skuKey: definition.key,
            reserveAttribution: definition.issuanceControls.reserveAttribution,
            fundingLineIds: definition.fundingLineIds,
          });
          const protectionEvidenceHashHex = await stableSha256Hex({
            skuKey: definition.key,
            evidenceSchema: definition.evidenceSchema,
          });
          const protectionComparabilityHashHex = await stableSha256Hex({
            comparabilityKey: definition.comparabilityKey,
          });
          const protectionPolicyOverridesHashHex = await stableSha256Hex({
            publicStatusRule: definition.issuanceControls.publicStatusRule,
            launchTruth: definition.launchTruth,
          });

          if (!genesisArtifactExists.get(seriesPk.toBase58())) {
            const leadFundingLine = genesisFundingLineDefinitions.find((line) => line.skuKey === definition.key)!;
            const seriesLedgers = deriveLaunchLedgerAddresses({
              reserveDomain: reserveDomainPk,
              healthPlan: genesisPlanPk,
              assetMint: assetMintPk,
              policySeries: seriesPk,
              fundingLine: genesisFundingLineById[leadFundingLine.lineId]!,
            });

            await createTransaction(
              `Create ${definition.displayName}`,
              buildCreatePolicySeriesInstruction({
                authority: publicKey,
                healthPlan: genesisPlanPk,
                policySeries: seriesPk,
                seriesReserveLedger: seriesLedgers.seriesReserveLedger,
                args: {
                  seriesId: definition.seriesId,
                  displayName: definition.displayName,
                  metadataUri: definition.metadataUri,
                  assetMint: assetMintPk,
                  mode: SERIES_MODE_PROTECTION,
                  status: SERIES_STATUS_ACTIVE,
                  adjudicationMode: 0,
                  termsHashHex: protectionTermsHashHex,
                  pricingHashHex: protectionPricingHashHex,
                  payoutHashHex: protectionPayoutHashHex,
                  reserveModelHashHex: protectionReserveModelHashHex,
                  evidenceRequirementsHashHex: protectionEvidenceHashHex,
                  comparabilityHashHex: protectionComparabilityHashHex,
                  policyOverridesHashHex: protectionPolicyOverridesHashHex,
                  cycleSeconds: BigInt(definition.coverWindowDays * 86_400),
                  termsVersion: 1,
                },
              }),
            );
          } else {
            addActionLog({
              action: `Create ${definition.displayName}`,
              message: "Skipped because the protection policy series PDA already exists.",
            });
          }

          for (const fundingLine of genesisFundingLineDefinitions.filter((line) => line.skuKey === definition.key)) {
            const fundingLinePk = genesisFundingLineById[fundingLine.lineId]!;
            if (genesisArtifactExists.get(fundingLinePk.toBase58())) {
              addActionLog({
                action: `Open ${fundingLine.displayName}`,
                message: "Skipped because the Genesis funding line PDA already exists.",
              });
              continue;
            }
            const ledgers = deriveLaunchLedgerAddresses({
              reserveDomain: reserveDomainPk,
              healthPlan: genesisPlanPk,
              assetMint: assetMintPk,
              policySeries: seriesPk,
              fundingLine: fundingLinePk,
            });
            await createTransaction(
              `Open ${fundingLine.displayName}`,
              buildOpenFundingLineInstruction({
                authority: publicKey,
                reserveDomain: reserveDomainPk,
                healthPlan: genesisPlanPk,
                assetMint: assetMintPk,
                fundingLine: fundingLinePk,
                fundingLineLedger: ledgers.fundingLineLedger,
                planReserveLedger: ledgers.planReserveLedger,
                seriesReserveLedger: ledgers.seriesReserveLedger,
                args: {
                  lineId: fundingLine.lineId,
                  policySeries: seriesPk,
                  lineType: fundingLine.lineType,
                  fundingPriority: fundingLine.fundingPriority,
                  committedAmount: 0n,
                  capsHashHex: await stableSha256Hex({
                    template: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
                    skuKey: definition.key,
                    lineId: fundingLine.lineId,
                    reserveRole: fundingLine.displayName,
                  }),
                },
              }),
            );
          }
        }

        if (!genesisArtifactExists.get(genesisPoolPk.toBase58())) {
          await createBuiltTransaction(
            "Create Genesis liquidity pool",
            buildCreateLiquidityPoolTx({
              authority: publicKey,
              reserveDomainAddress: reserveDomainPk,
              recentBlockhash: await nextRecentBlockhash(),
              poolId: GENESIS_PROTECT_ACUTE_POOL_ID,
              displayName: GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME,
              curator: publicKey,
              allocator: publicKey,
              sentinel: publicKey,
              depositAssetMint: assetMintPk,
              strategyHashHex: await stableSha256Hex({
                template: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
                strategyThesis: GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS,
              }),
              feeBps: 0,
              redemptionPolicy: REDEMPTION_POLICY_QUEUE_ONLY,
              pauseFlags: 0,
            }),
          );
        } else {
          addActionLog({
            action: "Create Genesis liquidity pool",
            message: "Skipped because the Genesis liquidity pool PDA already exists.",
          });
        }

        for (const classDefinition of genesisClassDefinitions) {
          const capitalClassPk = genesisClassById[classDefinition.classId]!;
          if (genesisArtifactExists.get(capitalClassPk.toBase58())) {
            addActionLog({
              action: `Create ${classDefinition.displayName}`,
              message: "Skipped because the Genesis capital class PDA already exists.",
            });
            continue;
          }
          await createBuiltTransaction(
            `Create ${classDefinition.displayName}`,
            buildCreateCapitalClassTx({
              authority: publicKey,
              poolAddress: genesisPoolPk,
              poolDepositAssetMint: assetMintPk,
              recentBlockhash: await nextRecentBlockhash(),
              classId: classDefinition.classId,
              displayName: classDefinition.displayName,
              priority: classDefinition.priority,
              impairmentRank: classDefinition.impairmentRank,
              restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
              redemptionTermsMode: 0,
              feeBps: 0,
              minLockupSeconds: classDefinition.minLockupSeconds,
              pauseFlags: 0,
            }),
          );
          await createBuiltTransaction(
            `Configure ${classDefinition.displayName} controls`,
            buildUpdateCapitalClassControlsTx({
              authority: publicKey,
              poolAddress: genesisPoolPk,
              capitalClassAddress: capitalClassPk,
              recentBlockhash: await nextRecentBlockhash(),
              pauseFlags: 0,
              queueOnlyRedemptions: classDefinition.queueOnlyRedemptions,
              active: true,
              reasonHashHex: await stableSha256Hex({
                template: GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
                classId: classDefinition.classId,
                queueOnlyRedemptions: classDefinition.queueOnlyRedemptions,
              }),
            }),
          );
        }

        for (const allocation of genesisAllocationDefinitions) {
          const allocationPk = genesisAllocationByKey[allocation.key]!;
          if (genesisArtifactExists.get(allocationPk.toBase58())) {
            addActionLog({
              action: `Create ${allocation.key} allocation`,
              message: "Skipped because the Genesis allocation position PDA already exists.",
            });
            continue;
          }
          const allocationSeriesPk = allocation.policySeriesId === GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU.seriesId
            ? genesisSeriesBySku.event7
            : genesisSeriesBySku.travel30;
          await createBuiltTransaction(
            `Create ${allocation.key} allocation`,
            buildCreateAllocationPositionTx({
              authority: publicKey,
              poolAddress: genesisPoolPk,
              capitalClassAddress: genesisClassById[allocation.classId]!,
              healthPlanAddress: genesisPlanPk,
              fundingLineAddress: genesisFundingLineById[allocation.fundingLineId]!,
              fundingLineAssetMint: assetMintPk,
              recentBlockhash: await nextRecentBlockhash(),
              policySeriesAddress: allocationSeriesPk,
              capAmount: allocation.capAmount,
              weightBps: allocation.weightBps,
              allocationMode: 0,
              deallocationOnly: false,
            }),
          );
        }

        const nextArtifacts: CreatedArtifacts = {
          healthPlanAddress: genesisPlanPk.toBase58(),
          rewardSeriesAddress: null,
          protectionSeriesAddress: genesisSeriesBySku.travel30.toBase58(),
          rewardFundingLineAddress: null,
          protectionFundingLineAddress: genesisFundingLineById[GENESIS_PROTECT_ACUTE_PRIMARY_SKU.fundingLineIds.premium]!.toBase58(),
          poolAddress: genesisPoolPk.toBase58(),
          capitalClassAddresses: Object.values(genesisClassById).map((entry) => entry.toBase58()),
          allocationAddresses: Object.values(genesisAllocationByKey).map((entry) => entry.toBase58()),
          extraSeriesAddresses: Object.values(genesisSeriesBySku).map((entry) => entry.toBase58()),
          extraFundingLineAddresses: Object.values(genesisFundingLineById).map((entry) => entry.toBase58()),
        };
        setCreatedArtifacts(nextArtifacts);
        setStatusTone("ok");
        setStatusMessage(
          "Genesis Protect Acute shell bootstrap completed. This is still launch-readiness setup: reserve posting, oracle policy, pool settings, and final operator sign-off remain outstanding.",
        );
        return;
      }

      const schemaBindingHashHex = rewardLaneRequired
        ? await stableSha256Hex({
          schemaKey: selectedSchema?.schemaKey ?? "",
          version: selectedSchema?.version ?? 0,
          outcomes: [...selectedOutcomeIds].sort(),
        })
        : ZERO_HASH;
      const complianceBaselineHashHex = await stableSha256Hex({
        launchIntent,
        membershipMode,
        membershipGateKind,
        membershipGateMint: membershipGateMintPk.toBase58(),
        membershipGateMinAmount: membershipGateMinAmount.toString(),
        membershipInviteAuthority: membershipInviteAuthorityPk.toBase58(),
        coveragePathway,
        reserveDomainAddress,
        payoutAssetMode,
        payoutMint: payoutAssetAddress,
      });

      if (!artifactExists.get(healthPlanPk.toBase58())) {
        await createTransaction(
          "Create health plan",
          buildCreateHealthPlanInstruction({
            planAdmin: publicKey,
            reserveDomain: reserveDomainPk,
            healthPlan: healthPlanPk,
            args: {
              planId: normalizedPlanId,
              displayName: normalize(displayName),
              organizationRef: normalize(organizationRef),
              metadataUri: normalize(planMetadataUri),
              sponsor: publicKey,
              sponsorOperator: publicKey,
              claimsOperator: publicKey,
              oracleAuthority,
              membershipMode,
              membershipGateKind,
              membershipGateMint: membershipGateMintPk,
              membershipGateMinAmount,
              membershipInviteAuthority: membershipInviteAuthorityPk,
              allowedRailMask: 0xffff,
              defaultFundingPriority: 0,
              oraclePolicyHashHex,
              schemaBindingHashHex,
              complianceBaselineHashHex,
              pauseFlags: 0,
            },
          }),
        );
      } else {
        addActionLog({
          action: "Create health plan",
          message: "Skipped because the health plan PDA already exists.",
        });
      }

      if (rewardLaneRequired && rewardSeriesPk && rewardFundingLinePk) {
        const rewardRuleCommitments = await Promise.all(selectedOutcomeIds.map(async (outcomeId) => ({
          outcomeId,
          ruleId: normalize(ruleIdsByOutcome[outcomeId] ?? "") || seedDefault(outcomeId, "reward-rule"),
          ruleHashHex: normalize(ruleHashOverridesByOutcome[outcomeId] ?? "") || rulePreviewMap[outcomeId]?.derivedRuleHashHex || await stableSha256Hex({ outcomeId, ruleIdsByOutcome }),
          payoutHashHex: normalize(payoutHashOverridesByOutcome[outcomeId] ?? "") || rulePreviewMap[outcomeId]?.derivedPayoutHashHex || await stableSha256Hex({ outcomeId, rewardPayoutUi }),
        })));

        const rewardTermsHashHex = normalize(termsHashHex) || await stableSha256Hex({
          planId: normalizedPlanId,
          rewardSeriesId: normalizedRewardSeriesId,
          metadataUri: normalize(rewardSeriesMetadataUri),
        });
        const rewardPayoutHashHex = normalize(payoutPolicyHashHex) || await stableSha256Hex({
          rewardPayoutUi: normalize(rewardPayoutUi),
          rewardRuleCommitments,
        });
        const rewardPricingHashHex = await stableSha256Hex({
          committedBudgetUi: normalize(rewardCommittedBudgetUi),
          payoutAssetAddress,
        });
        const rewardEvidenceHashHex = await stableSha256Hex({
          oraclePolicyHashHex,
          schema: selectedSchema?.schemaKey ?? "",
          outcomes: selectedOutcomeIds,
        });
        const rewardComparabilityHashHex = await stableSha256Hex({
          selectedOutcomes: selectedOutcomeIds,
        });
        const rewardPolicyOverridesHashHex = await stableSha256Hex({
          ruleHashOverridesByOutcome,
          payoutHashOverridesByOutcome,
        });
        const rewardReserveModelHashHex = await stableSha256Hex({
          lineType: "sponsor_budget",
          committedAmount: rewardCommittedAmount.toString(),
          payoutAssetAddress,
        });

        const rewardLedgers = deriveLaunchLedgerAddresses({
          reserveDomain: reserveDomainPk,
          healthPlan: healthPlanPk,
          assetMint: assetMintPk,
          policySeries: rewardSeriesPk,
          fundingLine: rewardFundingLinePk,
        });

        if (!artifactExists.get(rewardSeriesPk.toBase58())) {
          await createTransaction(
            "Create reward lane",
            buildCreatePolicySeriesInstruction({
              authority: publicKey,
              healthPlan: healthPlanPk,
              policySeries: rewardSeriesPk,
              seriesReserveLedger: rewardLedgers.seriesReserveLedger,
              args: {
                seriesId: normalizedRewardSeriesId,
                displayName: normalize(rewardSeriesDisplayName),
                metadataUri: normalize(rewardSeriesMetadataUri),
                assetMint: assetMintPk,
                mode: SERIES_MODE_REWARD,
                status: SERIES_STATUS_ACTIVE,
                adjudicationMode: 0,
                termsHashHex: rewardTermsHashHex,
                pricingHashHex: rewardPricingHashHex,
                payoutHashHex: rewardPayoutHashHex,
                reserveModelHashHex: rewardReserveModelHashHex,
                evidenceRequirementsHashHex: rewardEvidenceHashHex,
                comparabilityHashHex: rewardComparabilityHashHex,
                policyOverridesHashHex: rewardPolicyOverridesHashHex,
                cycleSeconds: BigInt(30 * 86_400),
                termsVersion: 1,
              },
            }),
          );
        } else {
          addActionLog({
            action: "Create reward lane",
            message: "Skipped because the reward policy series PDA already exists.",
          });
        }

        if (!artifactExists.get(rewardFundingLinePk.toBase58())) {
          await createTransaction(
            "Open sponsor budget line",
            buildOpenFundingLineInstruction({
              authority: publicKey,
              reserveDomain: reserveDomainPk,
              healthPlan: healthPlanPk,
              assetMint: assetMintPk,
              fundingLine: rewardFundingLinePk,
              fundingLineLedger: rewardLedgers.fundingLineLedger,
              planReserveLedger: rewardLedgers.planReserveLedger,
              seriesReserveLedger: rewardLedgers.seriesReserveLedger,
              args: {
                lineId: normalizedRewardFundingLineId,
                policySeries: rewardSeriesPk,
                lineType: FUNDING_LINE_TYPE_SPONSOR_BUDGET,
                fundingPriority: 0,
                committedAmount: rewardCommittedAmount,
                capsHashHex: await stableSha256Hex({
                  lineId: normalizedRewardFundingLineId,
                  commitment: rewardCommittedAmount.toString(),
                }),
              },
            }),
          );
        } else {
          addActionLog({
            action: "Open sponsor budget line",
            message: "Skipped because the sponsor funding line PDA already exists.",
          });
        }
      }

      if (
        protectionLaneRequired
        && protectionSeriesPk
        && protectionFundingLinePk
        && protectionPosture
        && validatedProtectionMetadata?.document
      ) {
        const protectionTermsHashHex = normalize(termsHashHex) || await stableSha256Hex({
          planId: normalizedPlanId,
          protectionSeriesId: normalizedProtectionSeriesId,
          protectionMetadata: validatedProtectionMetadata.document,
        });
        const protectionPricingHashHex = await stableSha256Hex({
          cadenceDays: toPositiveInt(protectionCadenceDays),
          expectedPremiumUi: normalize(protectionExpectedPremiumUi),
          payoutAssetAddress,
        });
        const protectionPayoutHashHex = normalize(payoutPolicyHashHex) || await stableSha256Hex(validatedProtectionMetadata.document);
        const protectionEvidenceHashHex = await stableSha256Hex({
          oraclePolicyHashHex,
          protectionMetadata: validatedProtectionMetadata.document,
        });
        const protectionComparabilityHashHex = await stableSha256Hex({
          lane: "protection",
          coveragePathway: validatedProtectionMetadata.document.coveragePathway,
          metadataUri: validatedProtectionMetadata.document.metadataUri,
          reserveDomainAddress,
        });
        const protectionPolicyOverridesHashHex = await stableSha256Hex(validatedProtectionMetadata.document);
        const protectionReserveModelHashHex = await stableSha256Hex({
          lineType: "premium_income",
          cadenceDays: toPositiveInt(protectionCadenceDays),
          commitment: protectionCommittedAmount.toString(),
        });

        const protectionLedgers = deriveLaunchLedgerAddresses({
          reserveDomain: reserveDomainPk,
          healthPlan: healthPlanPk,
          assetMint: assetMintPk,
          policySeries: protectionSeriesPk,
          fundingLine: protectionFundingLinePk,
        });

        if (!artifactExists.get(protectionSeriesPk.toBase58())) {
          await createTransaction(
            "Create protection lane",
            buildCreatePolicySeriesInstruction({
              authority: publicKey,
              healthPlan: healthPlanPk,
              policySeries: protectionSeriesPk,
              seriesReserveLedger: protectionLedgers.seriesReserveLedger,
              args: {
                seriesId: normalizedProtectionSeriesId,
                displayName: normalize(protectionSeriesDisplayName),
                metadataUri: normalize(protectionSeriesMetadataUri),
                assetMint: assetMintPk,
                mode: SERIES_MODE_PROTECTION,
                status: SERIES_STATUS_ACTIVE,
                adjudicationMode: 0,
                termsHashHex: protectionTermsHashHex,
                pricingHashHex: protectionPricingHashHex,
                payoutHashHex: protectionPayoutHashHex,
                reserveModelHashHex: protectionReserveModelHashHex,
                evidenceRequirementsHashHex: protectionEvidenceHashHex,
                comparabilityHashHex: protectionComparabilityHashHex,
                policyOverridesHashHex: protectionPolicyOverridesHashHex,
                cycleSeconds: BigInt(toPositiveInt(protectionCadenceDays) * 86_400),
                termsVersion: 1,
              },
            }),
          );
        } else {
          addActionLog({
            action: "Create protection lane",
            message: "Skipped because the protection policy series PDA already exists.",
          });
        }

        if (!artifactExists.get(protectionFundingLinePk.toBase58())) {
          await createTransaction(
            "Open premium income line",
            buildOpenFundingLineInstruction({
              authority: publicKey,
              reserveDomain: reserveDomainPk,
              healthPlan: healthPlanPk,
              assetMint: assetMintPk,
              fundingLine: protectionFundingLinePk,
              fundingLineLedger: protectionLedgers.fundingLineLedger,
              planReserveLedger: protectionLedgers.planReserveLedger,
              seriesReserveLedger: protectionLedgers.seriesReserveLedger,
              args: {
                lineId: normalizedProtectionFundingLineId,
                policySeries: protectionSeriesPk,
                lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
                fundingPriority: 1,
                committedAmount: protectionCommittedAmount,
                capsHashHex: await stableSha256Hex({
                  lineId: normalizedProtectionFundingLineId,
                  cadenceDays: toPositiveInt(protectionCadenceDays),
                  commitment: protectionCommittedAmount.toString(),
                }),
              },
            }),
          );
        } else {
          addActionLog({
            action: "Open premium income line",
            message: "Skipped because the premium funding line PDA already exists.",
          });
        }
      }

      const nextArtifacts: CreatedArtifacts = {
        healthPlanAddress: healthPlanPk.toBase58(),
        rewardSeriesAddress: rewardSeriesPk?.toBase58() ?? null,
        protectionSeriesAddress: protectionSeriesPk?.toBase58() ?? null,
        rewardFundingLineAddress: rewardFundingLinePk?.toBase58() ?? null,
        protectionFundingLineAddress: protectionFundingLinePk?.toBase58() ?? null,
      };
      setCreatedArtifacts(nextArtifacts);
      setStatusTone("ok");
      setStatusMessage("Canonical health plan launch completed.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Canonical health plan launch failed.";
      setStatusTone("error");
      setStatusMessage(message);
      if (actionLog.length > 0) {
        addActionLog({
          action: "Launch note",
          message: "Some creation steps already succeeded. Rerunning will skip existing plan, series, and funding-line PDAs.",
        });
      }
    } finally {
      setBusyAction(null);
    }
  }, [
    actionLog.length,
    addActionLog,
    addressPreview.healthPlanAddress,
    allowDelegatedClaims,
    connection,
    coveragePathway,
    defiSettlementMode,
    displayName,
    inviteIssuer,
    membershipGateKind,
    membershipMode,
    openFirstFailingStep,
    organizationRef,
    payoutAssetAddress,
    payoutAssetMode,
    payoutHashOverridesByOutcome,
    payoutMintPk,
    payoutPolicyHashHex,
    planId,
    planMetadataUri,
    protectionCadenceDays,
    protectionExpectedPremiumUi,
    protectionFundingLineId,
    protectionLaneRequired,
    protectionPosture,
    protectionSeriesDisplayName,
    protectionSeriesId,
    protectionSeriesMetadataUri,
    publicKey,
    quorumM,
    requireVerifiedSchema,
    reserveDomainAddress,
    reserveDomainPk,
    reviewErrors,
    rewardCommittedBudgetUi,
    rewardFundingLineId,
    rewardLaneRequired,
    rewardPayoutUi,
    rewardSeriesDisplayName,
    rewardSeriesId,
    rewardSeriesMetadataUri,
    ruleHashOverridesByOutcome,
    ruleIdsByOutcome,
    rulePreviewMap,
    rwaComplianceContact,
    rwaJurisdiction,
    rwaLegalEntityName,
    rwaPolicyTermsUri,
    rwaRegulatoryLicenseRef,
    selectedSchema,
    selectedOracles,
    selectedOutcomeIds,
    sendTransaction,
    splDecimals,
    tokenGateMinBalance,
    tokenGateMint,
    termsHashHex,
  ]);

  const handleNext = useCallback(() => {
    if (activeStep.id === "review") {
      if (createdArtifacts && reviewLinks) {
        router.push(reviewLinks.workspaceHref);
        return;
      }
      void handleLaunch();
      return;
    }

    if (currentStepErrors.length > 0) {
      setStatusTone("error");
      setStatusMessage(firstError(currentStepErrors));
      return;
    }

    setStatusMessage(null);
    setStatusTone(null);
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  }, [
    activeStep.id,
    createdArtifacts,
    currentStepErrors,
    handleLaunch,
    reviewLinks,
    router,
    steps.length,
  ]);

  const handleBack = useCallback(() => {
    if (isFirstStep) return;
    setStatusMessage(null);
    setStatusTone(null);
    setStepIndex((current) => Math.max(0, current - 1));
  }, [isFirstStep]);

  return (
    <div className="plans-shell">
      <div className="plans-wizard-scroll">
        <header className="plans-wizard-header">
          <div className="plans-wizard-header-ident">
            <span className="plans-wizard-wordmark">PROTOCOL_CONSOLE</span>
            <span className="plans-wizard-header-divider" aria-hidden="true" />
            <span className="plans-wizard-header-label">Canonical Plan Launch</span>
          </div>
          <Link href="/plans" className="plans-wizard-cancel">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
            CANCEL_FLOW
          </Link>
        </header>

        <nav className="plans-wizard-progress-wrap" aria-label="Plan wizard steps">
          <div className="plans-wizard-progress liquid-glass">
            <div
              className="plans-wizard-progress-indicator"
              style={{ width: `${100 / steps.length}%`, transform: `translateX(${stepIndex * 100}%)` }}
              aria-hidden="true"
            />
            {steps.map((step, index) => {
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
                  onClick={() => setStepIndex(index)}
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
              <span className="plans-wizard-tip-label">[PROTOCOL_TIP]</span>
              <p>{copy.tip}</p>
            </div>
          </aside>

          <div className="plans-wizard-form heavy-glass">
            {statusMessage ? (
              <div className={cn(
                "mb-5 rounded-2xl border px-4 py-3 text-sm",
                statusTone === "error"
                  ? "border-[rgba(186,26,26,0.22)] bg-[rgba(186,26,26,0.08)] text-[var(--danger)]"
                  : "border-[rgba(25,180,122,0.2)] bg-[rgba(25,180,122,0.08)] text-[var(--success)]",
              )}>
                {statusMessage}
              </div>
            ) : null}

            {activeStep.id === "basics" ? (
              <div className="plans-wizard-step-body">
                {genesisTemplateMode ? (
                  <div className="plans-notice liquid-glass" role="status">
                    <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">check_circle</span>
                    <p>
                      Genesis template mode locks the canonical plan identity and SKU shell. Reserve domain, payout rail,
                      operator quorum, and final treasury settings stay configurable for this launch-readiness flow.
                    </p>
                  </div>
                ) : null}
                <FieldGroup label="Launch Intent">
                  <div className="flex flex-wrap gap-2">
                    {(["rewards", "insurance", "hybrid"] as const).map((intent) => (
                      <button
                        key={intent}
                        type="button"
                        className={cn("plans-wizard-chip", launchIntent === intent && "plans-wizard-chip-active")}
                        onClick={() => setLaunchIntent(intent)}
                        disabled={genesisTemplateMode}
                      >
                        {intent.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </FieldGroup>

                <div className="plans-wizard-row">
                  <FieldGroup label="Plan ID">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={planId}
                      onChange={(event) => setPlanId(event.target.value)}
                      disabled={genesisTemplateMode}
                    />
                  </FieldGroup>
                  <FieldGroup label="Display Name">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      disabled={genesisTemplateMode}
                    />
                  </FieldGroup>
                </div>

                <div className="plans-wizard-row">
                  <FieldGroup label="Sponsor Label / Organization Reference">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={organizationRef}
                      onChange={(event) => setOrganizationRef(event.target.value)}
                      disabled={genesisTemplateMode}
                    />
                  </FieldGroup>
                  <FieldGroup label="Reserve Domain">
                    <select
                      className="plans-wizard-input"
                      value={reserveDomainAddress}
                      onChange={(event) => setReserveDomainAddress(event.target.value)}
                    >
                      {liveReserveDomainOptions.length === 0 ? <option value="">No live reserve domains</option> : null}
                      {liveReserveDomainOptions.map((domain) => (
                        <option key={domain.address} value={domain.address}>
                          {domain.displayName} · {shortAddress(domain.address)}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>
                </div>

                <FieldGroup label="Plan Metadata URI">
                  <input
                    type="text"
                    className="plans-wizard-input plans-wizard-input-lg"
                    value={planMetadataUri}
                    onChange={(event) => setPlanMetadataUri(event.target.value)}
                    disabled={genesisTemplateMode}
                  />
                </FieldGroup>

                <div className="plans-wizard-divider" aria-hidden="true" />

                <div className="plans-wizard-row">
                  <FieldGroup label="Payout Asset Mode">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={cn("plans-wizard-chip", payoutAssetMode === "sol" && "plans-wizard-chip-active")}
                        onClick={() => setPayoutAssetMode("sol")}
                      >
                        SOL
                      </button>
                      <button
                        type="button"
                        className={cn("plans-wizard-chip", payoutAssetMode === "spl" && "plans-wizard-chip-active")}
                        onClick={() => setPayoutAssetMode("spl")}
                      >
                        SPL TOKEN
                      </button>
                    </div>
                  </FieldGroup>
                  <FieldGroup label="Payout Mint">
                    <div className="space-y-2">
                      <input
                        type="text"
                        className="plans-wizard-input"
                        value={payoutAssetMode === "spl" ? payoutMint : ZERO_PUBKEY}
                        onChange={(event) => setPayoutMint(event.target.value)}
                        disabled={payoutAssetMode === "sol"}
                      />
                      <button
                        type="button"
                        className="secondary-button w-fit"
                        onClick={() => setPayoutMint(availableRailMints[0] ?? "")}
                      >
                        Use domain rail
                      </button>
                    </div>
                  </FieldGroup>
                </div>

                {rewardLaneRequired ? (
                  <FieldGroup label="Reward Payout Amount">
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      className="plans-wizard-input"
                      value={rewardPayoutUi}
                      onChange={(event) => setRewardPayoutUi(event.target.value)}
                    />
                  </FieldGroup>
                ) : null}

                {protectionLaneRequired ? (
                  <>
                    <div className="plans-wizard-divider" aria-hidden="true" />
                    <FieldGroup label="Coverage Path">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={cn("plans-wizard-chip", coveragePathway === "defi_native" && "plans-wizard-chip-active")}
                          onClick={() => handleCoveragePathwayChange("defi_native")}
                        >
                          DEFI_NATIVE
                        </button>
                        <button
                          type="button"
                          className={cn("plans-wizard-chip", coveragePathway === "rwa_policy" && "plans-wizard-chip-active")}
                          onClick={() => handleCoveragePathwayChange("rwa_policy")}
                        >
                          RWA_POLICY
                        </button>
                      </div>
                    </FieldGroup>

                    {coveragePathway === "defi_native" ? (
                      <>
                        <FieldGroup label="Settlement Style">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={cn("plans-wizard-chip", defiSettlementMode === "onchain_programmatic" && "plans-wizard-chip-active")}
                              onClick={() => setDefiSettlementMode("onchain_programmatic")}
                            >
                              ONCHAIN_PROGRAMMATIC
                            </button>
                            <button
                              type="button"
                              className={cn("plans-wizard-chip", defiSettlementMode === "hybrid_rails" && "plans-wizard-chip-active")}
                              onClick={() => setDefiSettlementMode("hybrid_rails")}
                            >
                              HYBRID_RAILS
                            </button>
                          </div>
                        </FieldGroup>

                        <div className="plans-wizard-row">
                          <FieldGroup label="Technical Terms URL">
                            <input
                              type="text"
                              className="plans-wizard-input"
                              value={defiTechnicalTermsUri}
                              onChange={(event) => setDefiTechnicalTermsUri(event.target.value)}
                            />
                          </FieldGroup>
                          <FieldGroup label="Risk Disclosure URL">
                            <input
                              type="text"
                              className="plans-wizard-input"
                              value={defiRiskDisclosureUri}
                              onChange={(event) => setDefiRiskDisclosureUri(event.target.value)}
                            />
                          </FieldGroup>
                        </div>
                      </>
                    ) : null}

                    {coveragePathway === "rwa_policy" ? (
                      <>
                        <div className="plans-wizard-row">
                          <FieldGroup label="Issuer Legal Name">
                            <input
                              type="text"
                              className="plans-wizard-input"
                              value={rwaLegalEntityName}
                              onChange={(event) => setRwaLegalEntityName(event.target.value)}
                            />
                          </FieldGroup>
                          <FieldGroup label="Jurisdiction">
                            <input
                              type="text"
                              className="plans-wizard-input"
                              value={rwaJurisdiction}
                              onChange={(event) => setRwaJurisdiction(event.target.value)}
                            />
                          </FieldGroup>
                        </div>
                        <div className="plans-wizard-row">
                          <FieldGroup label="Policy Terms URI">
                            <input
                              type="text"
                              className="plans-wizard-input"
                              value={rwaPolicyTermsUri}
                              onChange={(event) => setRwaPolicyTermsUri(event.target.value)}
                            />
                          </FieldGroup>
                          <FieldGroup label="License Reference">
                            <input
                              type="text"
                              className="plans-wizard-input"
                              value={rwaRegulatoryLicenseRef}
                              onChange={(event) => setRwaRegulatoryLicenseRef(event.target.value)}
                            />
                          </FieldGroup>
                        </div>
                        <FieldGroup label="Compliance Contact">
                          <input
                            type="text"
                            className="plans-wizard-input"
                            value={rwaComplianceContact}
                            onChange={(event) => setRwaComplianceContact(event.target.value)}
                          />
                        </FieldGroup>
                      </>
                    ) : null}
                  </>
                ) : null}

                <WizardDetailTriggerRow
                  title="Launch Preview"
                  summary="See the technical plan, lane, rail, and commitment values derived from your current setup."
                  meta={launchPreviewMeta}
                  triggerRef={(node) => {
                    detailTriggerRefs.current["launch-preview"] = node;
                  }}
                  onOpen={(trigger) => openDetail({ key: "launch-preview" }, trigger)}
                />
              </div>
            ) : null}

            {activeStep.id === "membership" ? (
              <div className="plans-wizard-step-body">
                <FieldGroup label="Membership Mode">
                  <div className="flex flex-wrap gap-2">
                    {(["open", "token_gate", "invite_only"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={cn("plans-wizard-chip", membershipMode === mode && "plans-wizard-chip-active")}
                        onClick={() => handleMembershipModeChange(mode)}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </FieldGroup>

                {membershipMode === "token_gate" ? (
                  <>
                    <FieldGroup label="Token Gate Class">
                      <div className="flex flex-wrap gap-2">
                        {([
                          { value: "fungible_snapshot", label: "FUNGIBLE SNAPSHOT" },
                          { value: "nft_anchor", label: "NFT ANCHOR" },
                          { value: "stake_anchor", label: "STAKE ANCHOR" },
                        ] as const).map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={cn("plans-wizard-chip", membershipGateKind === option.value && "plans-wizard-chip-active")}
                            onClick={() => setMembershipGateKind(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </FieldGroup>
                    <div className="plans-wizard-row">
                      <FieldGroup label="Token Gate Mint">
                        <input
                          type="text"
                          className="plans-wizard-input"
                          value={tokenGateMint}
                          onChange={(event) => setTokenGateMint(event.target.value)}
                        />
                      </FieldGroup>
                      <FieldGroup label={membershipGateKind === "fungible_snapshot" ? "Minimum Balance" : "Minimum Locked Amount"}>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="plans-wizard-input"
                          value={tokenGateMinBalance}
                          onChange={(event) => setTokenGateMinBalance(event.target.value)}
                        />
                      </FieldGroup>
                    </div>
                    <p className="plans-wizard-inline-copy">
                      {membershipGateKind === "fungible_snapshot"
                        ? "Rewards-only launches may use a simple balance snapshot gate. Protection launches must use open, invite-only, NFT anchor, or stake anchor enrollment."
                        : membershipGateKind === "nft_anchor"
                          ? "NFT anchor protection uses one active coverage seat per configured NFT anchor. Claims depend on active coverage state, not live possession checks at claim time."
                          : "Stake anchor protection binds one active coverage seat to the chosen stake account anchor until the seat is deactivated."}
                    </p>
                  </>
                ) : null}

                {membershipMode === "invite_only" ? (
                  <>
                    <FieldGroup label="Invite Issuer Wallet">
                      <input
                        type="text"
                        className="plans-wizard-input"
                        value={inviteIssuer}
                        onChange={(event) => setInviteIssuer(event.target.value)}
                      />
                    </FieldGroup>
                    <p className="plans-wizard-inline-copy">
                      Invite-only protection still evaluates claims against active coverage and premium status. The invite gate decides who can enroll, not whether an active member can claim mid-cycle.
                    </p>
                  </>
                ) : null}

                <div className="plans-wizard-review-grid">
                  <ReviewRow label="MEMBERSHIP_POSTURE" value={membershipMode.toUpperCase()} />
                  <ReviewRow label="GATE_CLASS" value={membershipGateKind.toUpperCase()} />
                  <ReviewRow
                    label="JOIN_GATING"
                    value={
                      membershipMode === "token_gate"
                        ? `${membershipGateKind.toUpperCase()} · ${shortAddress(tokenGateMint)} · ${tokenGateMinBalance}`
                        : membershipMode === "invite_only"
                          ? shortAddress(inviteIssuer)
                          : "OPEN"
                    }
                  />
                </div>
              </div>
            ) : null}

            {activeStep.id === "verification" ? (
              <div className="plans-wizard-step-body">
                <div className="space-y-4">
                  {liveOracleProfiles.length === 0 ? (
                    <p className="wizard-inline-copy">
                      No claimed oracle profiles are currently visible on-chain. Register and claim an oracle from{" "}
                      <Link href="/oracles" className="plans-table-link">/oracles</Link> before launch.
                    </p>
                  ) : null}
                  <MultiOraclePicker
                    options={oracleOptions}
                    search={oracleSearch}
                    onSearchChange={setOracleSearch}
                    selected={selectedOracles}
                    onToggle={handleToggleOracle}
                  />

                  <div className="plans-wizard-row">
                    <FieldGroup label="Required Confirmations">
                      <input
                        type="number"
                        min="1"
                        className="plans-wizard-input"
                        value={quorumM}
                        onChange={(event) => setQuorumM(event.target.value)}
                      />
                    </FieldGroup>
                    <FieldGroup label="Selected Verifier Count">
                      <input
                        type="number"
                        min="1"
                        className="plans-wizard-input"
                        value={String(selectedOracles.length)}
                        disabled
                      />
                    </FieldGroup>
                  </div>

                  <label className="wizard-toggle-row">
                    <span className="wizard-toggle-copy">
                      <span className="wizard-section-label">Only use verified schemas</span>
                      <span className="wizard-toggle-title-row">
                        <span className="wizard-inline-copy block">
                          Reward lanes keep their schema commitments tied to the verified catalog.
                        </span>
                        <span className="wizard-toggle-badge">
                          {requireVerifiedSchema ? "ENFORCED" : "OPTIONAL"}
                        </span>
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="wizard-toggle-switch"
                      checked={requireVerifiedSchema}
                      onChange={(event) => setRequireVerifiedSchema(event.target.checked)}
                    />
                  </label>

                  <label className="wizard-toggle-row">
                    <span className="wizard-toggle-copy">
                      <span className="wizard-section-label">Allow delegated reward claims</span>
                      <span className="wizard-toggle-title-row">
                        <span className="wizard-inline-copy block">
                          Permit sponsor-side services to initiate reward claims when the lane allows it.
                        </span>
                        <span className="wizard-toggle-badge">
                          {allowDelegatedClaims ? "ENABLED" : "LOCKED"}
                        </span>
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="wizard-toggle-switch"
                      checked={allowDelegatedClaims}
                      onChange={(event) => setAllowDelegatedClaims(event.target.checked)}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeStep.id === "reward-lane" ? (
              <div className="plans-wizard-step-body">
                <div className="plans-wizard-row">
                  <FieldGroup label="Reward Series ID">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={rewardSeriesId}
                      onChange={(event) => setRewardSeriesId(event.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Reward Display Name">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={rewardSeriesDisplayName}
                      onChange={(event) => setRewardSeriesDisplayName(event.target.value)}
                    />
                  </FieldGroup>
                </div>

                <div className="plans-wizard-row">
                  <FieldGroup label="Reward Metadata URI">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={rewardSeriesMetadataUri}
                      onChange={(event) => setRewardSeriesMetadataUri(event.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Sponsor Funding Line ID">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={rewardFundingLineId}
                      onChange={(event) => setRewardFundingLineId(event.target.value)}
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="Committed Sponsor Budget">
                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    className="plans-wizard-input"
                    value={rewardCommittedBudgetUi}
                    onChange={(event) => setRewardCommittedBudgetUi(event.target.value)}
                  />
                </FieldGroup>

                <div className="plans-wizard-divider" aria-hidden="true" />

                <div className="space-y-3">
                  {snapshot.outcomeSchemas.length === 0 ? (
                    <p className="wizard-inline-copy">
                      No outcome schemas are visible on-chain. Register and verify a schema from{" "}
                      <Link href="/schemas" className="plans-table-link">/schemas</Link> before launching a reward lane.
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <span className="plans-wizard-field-label">Outcome Schema</span>
                    <span className={`status-pill ${selectedSchema?.verified ? "status-ok" : "status-off"}`}>
                      {selectedSchema?.verified ? "VERIFIED" : "UNVERIFIED"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <select
                      className="plans-wizard-input"
                      value={selectedSchemaAddress}
                      onChange={(event) => setSelectedSchemaAddress(event.target.value)}
                    >
                      {liveSchemaOptions.length === 0 ? <option value="">No live schemas</option> : null}
                      {liveSchemaOptions.map((schema) => (
                        <option key={schema.address} value={schema.address}>
                          {schema.schemaKey} · v{schema.version} · {schema.verified ? "verified" : "unverified"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="secondary-button w-fit"
                      onClick={() => setShowAllSchemas((current) => !current)}
                    >
                      {showAllSchemas ? "Show verified only" : "Manual override: show all schemas"}
                    </button>
                  </div>
                  {selectedSchema ? (
                    <p className="wizard-inline-copy">
                      {selectedSchema.schemaKey} · version {selectedSchema.version}
                      {selectedSchema.metadataUri ? ` · ${selectedSchema.metadataUri}` : ""}
                    </p>
                  ) : null}
                  {schemaMetadataLoading ? <p className="wizard-inline-copy">Loading selected outcome schema…</p> : null}
                  {schemaWarnings.length > 0 ? (
                    <div className="wizard-note">
                      {schemaWarnings.map((warning) => (
                        <p key={warning} className="wizard-inline-copy">{warning}</p>
                      ))}
                    </div>
                  ) : null}
                  <input
                    className="field-input"
                    value={outcomeSearch}
                    onChange={(event) => setOutcomeSearch(event.target.value)}
                    placeholder="Filter outcomes by name or ID"
                  />
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {filteredOutcomes.length === 0 ? (
                      <p className="wizard-inline-copy">No outcomes match the current filter.</p>
                    ) : null}
                    {filteredOutcomes.map((outcome) => {
                      const isSelected = selectedOutcomeIds.includes(outcome.id);
                      return (
                        <button
                          key={outcome.id}
                          type="button"
                          className={cn("wizard-select-row", isSelected && "wizard-select-row-active")}
                          onClick={() => handleToggleOutcome(outcome.id)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--foreground)]">{outcome.label}</p>
                            {isSelected ? <span className="status-pill status-ok">Selected</span> : null}
                          </div>
                          <p className="wizard-inline-copy mt-1">{outcome.id}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedOutcomeIds.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOutcomeIds.map((outcomeId) => {
                      const outcome = schemaOutcomes.find((entry) => entry.id === outcomeId);
                      const preview = rulePreviewMap[outcomeId];
                      return (
                        <div key={outcomeId} className="wizard-rule-row">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[var(--foreground)]">{outcome?.label ?? outcomeId}</p>
                            <p className="wizard-inline-copy">{outcomeId}</p>
                          </div>
                          <label className="field-label">
                            Rule ID
                            <input
                              className="field-input"
                              value={ruleIdsByOutcome[outcomeId] ?? ""}
                              onChange={(event) =>
                                setRuleIdsByOutcome((current) => ({ ...current, [outcomeId]: event.target.value }))}
                            />
                          </label>
                          <WizardDetailTriggerRow
                            title="Rule commitments"
                            summary="Open the derived hashes and optional overrides for this outcome."
                            meta={[
                              {
                                label: preview ? "DERIVED READY" : "HASHES PENDING",
                                tone: preview ? "accent" : "muted",
                              },
                              {
                                label: `OVERRIDES ${
                                  Number(Boolean(normalize(ruleHashOverridesByOutcome[outcomeId] ?? ""))) +
                                  Number(Boolean(normalize(payoutHashOverridesByOutcome[outcomeId] ?? "")))
                                }`,
                                tone:
                                  normalize(ruleHashOverridesByOutcome[outcomeId] ?? "") ||
                                  normalize(payoutHashOverridesByOutcome[outcomeId] ?? "")
                                    ? "accent"
                                    : "muted",
                              },
                            ]}
                            className="wizard-detail-trigger-compact"
                            triggerRef={(node) => {
                              detailTriggerRefs.current[`rule-commitments:${outcomeId}`] = node;
                            }}
                            onOpen={(trigger) => openDetail({ key: "rule-commitments", outcomeId }, trigger)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeStep.id === "protection-lane" ? (
              <div className="plans-wizard-step-body">
                <div className="plans-wizard-row">
                  <FieldGroup label="Protection Series ID">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={protectionSeriesId}
                      onChange={(event) => setProtectionSeriesId(event.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Protection Display Name">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={protectionSeriesDisplayName}
                      onChange={(event) => setProtectionSeriesDisplayName(event.target.value)}
                    />
                  </FieldGroup>
                </div>

                <div className="plans-wizard-row">
                  <FieldGroup label="Protection Metadata URI">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={protectionSeriesMetadataUri}
                      onChange={(event) => setProtectionSeriesMetadataUri(event.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Premium Funding Line ID">
                    <input
                      type="text"
                      className="plans-wizard-input"
                      value={protectionFundingLineId}
                      onChange={(event) => setProtectionFundingLineId(event.target.value)}
                    />
                  </FieldGroup>
                </div>

                <div className="plans-wizard-row">
                  <FieldGroup label="Premium Cadence (Days)">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="plans-wizard-input"
                      value={protectionCadenceDays}
                      onChange={(event) => setProtectionCadenceDays(event.target.value)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Expected First-Cycle Premium Volume">
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      className="plans-wizard-input"
                      value={protectionExpectedPremiumUi}
                      onChange={(event) => setProtectionExpectedPremiumUi(event.target.value)}
                    />
                  </FieldGroup>
                </div>

                <WizardDetailTriggerRow
                  title="Protection posture"
                  summary="Review the structured coverage payload this protection lane will commit to."
                  meta={[
                    {
                      label: `PATH ${protocolToken(coveragePathway)}`,
                      tone: "accent",
                    },
                    {
                      label: `SETTLEMENT ${protocolToken(
                        coveragePathway === "defi_native" ? defiSettlementMode : coveragePathway,
                      )}`,
                    },
                  ]}
                  triggerRef={(node) => {
                    detailTriggerRefs.current["protection-posture"] = node;
                  }}
                  onOpen={(trigger) => openDetail({ key: "protection-posture" }, trigger)}
                />
              </div>
            ) : null}

            {activeStep.id === "review" ? (
              <div className="plans-wizard-step-body">
                <div className="plans-wizard-review-grid">
                  <ReviewRow label="LAUNCH_INTENT" value={launchIntent.toUpperCase()} />
                  <ReviewRow
                    label="LANES"
                    value={
                      genesisTemplateMode
                        ? "EVENT 7 + TRAVEL 30"
                        : requiresRewardLane(launchIntent) && requiresProtectionLane(launchIntent)
                          ? "REWARD + PROTECTION"
                          : requiresRewardLane(launchIntent)
                            ? "REWARD"
                            : "PROTECTION"
                    }
                  />
                  <ReviewRow
                    label="HEALTH_PLAN"
                    value={genesisTemplateMode ? genesisArtifactPreview?.healthPlanAddress ?? "pending" : addressPreview.healthPlanAddress ?? "pending"}
                    muted={genesisTemplateMode ? !genesisArtifactPreview?.healthPlanAddress : !addressPreview.healthPlanAddress}
                  />
                  {genesisTemplateMode ? (
                    <>
                      <ReviewRow label="EVENT7_SERIES" value={genesisArtifactPreview?.seriesAddresses.event7 ?? "pending"} muted={!genesisArtifactPreview?.seriesAddresses.event7} />
                      <ReviewRow label="TRAVEL30_SERIES" value={genesisArtifactPreview?.seriesAddresses.travel30 ?? "pending"} muted={!genesisArtifactPreview?.seriesAddresses.travel30} />
                      <ReviewRow label="GENESIS_POOL" value={genesisArtifactPreview?.poolAddress ?? "pending"} muted={!genesisArtifactPreview?.poolAddress} />
                      <ReviewRow label="FUNDING_LINES" value={String(Object.keys(genesisArtifactPreview?.fundingLineAddresses ?? {}).length)} muted={!genesisArtifactPreview} />
                      <ReviewRow label="CAPITAL_CLASSES" value={String(genesisProtectAcuteBootstrapCapitalClasses().length)} muted={!genesisArtifactPreview} />
                      <ReviewRow label="ALLOCATIONS" value={String(genesisProtectAcuteBootstrapAllocations().length)} muted={!genesisArtifactPreview} />
                    </>
                  ) : (
                    <>
                      <ReviewRow label="REWARD_SERIES" value={addressPreview.rewardSeriesAddress ?? "n/a"} muted={!addressPreview.rewardSeriesAddress} />
                      <ReviewRow label="PROTECTION_SERIES" value={addressPreview.protectionSeriesAddress ?? "n/a"} muted={!addressPreview.protectionSeriesAddress} />
                      <ReviewRow label="SPONSOR_LINE" value={addressPreview.rewardFundingLineAddress ?? "n/a"} muted={!addressPreview.rewardFundingLineAddress} />
                      <ReviewRow label="PREMIUM_LINE" value={addressPreview.protectionFundingLineAddress ?? "n/a"} muted={!addressPreview.protectionFundingLineAddress} />
                      <ReviewRow label="REWARD_COMMITMENT" value={rewardLaneRequired ? baseUnitsPreview(rewardCommittedBudgetUi, payoutAssetMode, splDecimals) : "n/a"} muted={!rewardLaneRequired} />
                      <ReviewRow label="PREMIUM_COMMITMENT" value={protectionLaneRequired ? baseUnitsPreview(protectionExpectedPremiumUi, payoutAssetMode, splDecimals) : "n/a"} muted={!protectionLaneRequired} />
                    </>
                  )}
                </div>

                <div className="plans-wizard-divider" aria-hidden="true" />

                <div className="plans-wizard-support-grid">
                  <section className="plans-wizard-support-card">
                    <div className="space-y-1">
                      <h3 className="plans-wizard-support-title">Review links</h3>
                      <p className="plans-wizard-support-copy">
                        {genesisTemplateMode
                          ? "Genesis template runs land in the bounded-launch workspace so the remaining treasury, reserve, and oracle items stay visible."
                          : "New artifacts open with the created plan and series context after the launch confirms."}
                      </p>
                    </div>
                    {reviewLinks ? (
                      <div className="plans-wizard-support-actions">
                        <Link href={reviewLinks.workspaceHref} className="secondary-button inline-flex w-fit">
                          Open plan workspace
                        </Link>
                        {reviewLinks.rewardLaneHref ? (
                          <Link href={reviewLinks.rewardLaneHref} className="secondary-button inline-flex w-fit">
                            Open reward lane context
                          </Link>
                        ) : null}
                        {reviewLinks.coverageWorkspaceHref ? (
                          <Link href={reviewLinks.coverageWorkspaceHref} className="secondary-button inline-flex w-fit">
                            Open coverage workspace
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <p className="plans-wizard-support-note">Links appear after the launch confirms.</p>
                    )}
                  </section>

                  <section className="plans-wizard-support-card">
                    <div className="space-y-1">
                      <h3 className="plans-wizard-support-title">Membership and transaction trail</h3>
                      <p className="plans-wizard-support-copy">
                        {genesisTemplateMode
                          ? "Bootstrap transactions only create the canonical Genesis shell. Reserve posting, pool settings, and final operator sign-off still happen from the live workspace before any bounded launch window opens."
                          : "Protection enrollment gates decide who can activate coverage seats. Active-cycle claim rights follow coverage and premium status, not live wallet possession checks at claim time."}
                      </p>
                    </div>
                    {createdArtifacts ? (
                      <div className="plans-wizard-support-actions">
                        <a href={toExplorerAddressLink(createdArtifacts.healthPlanAddress)} target="_blank" rel="noreferrer" className="secondary-button inline-flex w-fit">
                          View health plan on explorer
                        </a>
                        {createdArtifacts.poolAddress ? (
                          <a href={toExplorerAddressLink(createdArtifacts.poolAddress)} target="_blank" rel="noreferrer" className="secondary-button inline-flex w-fit">
                            View liquidity pool on explorer
                          </a>
                        ) : null}
                        {createdArtifacts.rewardSeriesAddress ? (
                          <a href={toExplorerAddressLink(createdArtifacts.rewardSeriesAddress)} target="_blank" rel="noreferrer" className="secondary-button inline-flex w-fit">
                            View reward series on explorer
                          </a>
                        ) : null}
                        {createdArtifacts.protectionSeriesAddress ? (
                          <a href={toExplorerAddressLink(createdArtifacts.protectionSeriesAddress)} target="_blank" rel="noreferrer" className="secondary-button inline-flex w-fit">
                            View protection series on explorer
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {actionLog.length === 0 ? (
                      <p className="plans-wizard-support-note">No launch transactions yet.</p>
                    ) : (
                      <div className="plans-wizard-log-list">
                        {actionLog.map((entry) => (
                          <div key={entry.id} className="plans-wizard-log-card">
                            <p className="text-sm font-semibold text-[var(--foreground)]">{entry.action}</p>
                            <p className="wizard-inline-copy">{entry.message}</p>
                            {entry.explorerUrl ? (
                              <a href={entry.explorerUrl} target="_blank" rel="noreferrer" className="wizard-inline-copy inline-flex">
                                View transaction
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            ) : null}

            <div className="plans-wizard-footer">
              <button
                type="button"
                className="plans-wizard-back"
                onClick={handleBack}
                disabled={isFirstStep || Boolean(busyAction)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                PREVIOUS
              </button>
              <button
                type="button"
                className="plans-wizard-next"
                onClick={handleNext}
                disabled={Boolean(busyAction)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {activeStep.id === "review" ? (createdArtifacts ? "open_in_new" : "bolt") : "arrow_forward"}
                </span>
                <span className="plans-wizard-next-label">
                  {busyAction
                    ? busyAction.toUpperCase()
                    : activeStep.id === "review"
                      ? createdArtifacts
                        ? "OPEN_WORKSPACE"
                        : "LAUNCH_CANONICAL_PLAN"
                      : `NEXT · ${steps[stepIndex + 1]!.label.toUpperCase()}`}
                </span>
              </button>
            </div>
          </div>
        </section>

        <div className="plans-wizard-progress-meta" aria-hidden="true">
          <span>STEP {activeStep.number} / {String(steps.length).padStart(2, "0")}</span>
          <span>{Math.round(progressPct)}% COMPLETE</span>
        </div>
      </div>

      <WizardDetailSheet
        title={activeDetailTitle}
        summary={activeDetailSummary}
        meta={activeDetailMeta}
        open={Boolean(activeDetail)}
        size={activeDetail?.key === "launch-preview" ? "wide" : "default"}
        onOpenChange={(open) => {
          if (!open) {
            closeActiveDetail();
          }
        }}
      >
        {activeDetail?.key === "launch-preview" ? (
          <div className="plans-launch-preview-shell">
            <section className="plans-launch-preview-compact-head">
              <div className="plans-launch-preview-heading">
                <div className="space-y-2">
                  <p className="plans-launch-preview-eyebrow">LAUNCH_PREVIEW</p>
                  <h3 className="plans-launch-preview-title">
                    {displayName || "Awaiting plan identity"}
                  </h3>
                </div>
                <div className="plans-launch-preview-tags">
                  <span className="plans-launch-preview-tag">{protocolToken(launchIntent)}</span>
                  <span className="plans-launch-preview-tag">{protocolToken(membershipMode)}</span>
                  <span className="plans-launch-preview-tag">
                    {toPositiveInt(quorumM)}-OF-{selectedOracles.length || 0}
                  </span>
                </div>
              </div>
              <div className="plans-launch-preview-metrics">
                <LaunchPreviewMetric
                  label="Plan"
                  value={
                    genesisTemplateMode
                      ? genesisArtifactPreview?.healthPlanAddress
                        ? shortAddress(genesisArtifactPreview.healthPlanAddress)
                        : "Pending"
                      : addressPreview.healthPlanAddress
                        ? shortAddress(addressPreview.healthPlanAddress)
                        : "Pending"
                  }
                  detail={protocolToken(planId)}
                />
                <LaunchPreviewMetric
                  label="Lanes"
                  value={String(genesisTemplateMode ? 2 : Number(rewardLaneRequired) + Number(protectionLaneRequired)).padStart(2, "0")}
                  detail={
                    genesisTemplateMode
                      ? "Event 7 + Travel 30"
                      : rewardLaneRequired && protectionLaneRequired
                      ? "Reward + Protection"
                      : rewardLaneRequired
                        ? "Reward only"
                        : protectionLaneRequired
                          ? "Protection only"
                          : "Root only"
                  }
                />
                <LaunchPreviewMetric
                  label="Rails"
                  value={String(availableRailMints.length).padStart(2, "0")}
                  detail={availableRailMints.length > 0 ? availableRailMints.join(" // ") : "None exposed"}
                />
                <LaunchPreviewMetric
                  label="Payout"
                  value={payoutAssetMode === "sol" ? "SOL" : "SPL"}
                  detail={genesisTemplateMode ? shortAddress(payoutAssetAddress) : baseUnitsPreview(rewardPayoutUi, payoutAssetMode, splDecimals)}
                />
              </div>
            </section>

            <div className="plans-launch-preview-grid">
              <article className="plans-launch-preview-panel">
                <div className="plans-launch-preview-panel-head">
                  <div>
                    <p className="plans-launch-preview-panel-eyebrow">PLAN_ROOT</p>
                    <h4 className="plans-launch-preview-panel-title">Canonical health plan</h4>
                  </div>
                  <span className="plans-launch-preview-panel-badge">{protocolToken(organizationRef || "sponsor")}</span>
                </div>
                <div className="plans-launch-preview-list">
                  <div className="plans-launch-preview-row">
                    <span>Health plan PDA</span>
                    <span className="protocol-address">{addressPreview.healthPlanAddress ?? "pending"}</span>
                  </div>
                  <div className="plans-launch-preview-row">
                    <span>Reserve domain</span>
                    <span className="protocol-address">{reserveDomainAddress}</span>
                  </div>
                  <div className="plans-launch-preview-row">
                    <span>Metadata URI</span>
                    <span className="plans-launch-preview-value">{planMetadataUri}</span>
                  </div>
                </div>
              </article>

              {genesisTemplateMode && genesisArtifactPreview ? (
                <>
                  <article className="plans-launch-preview-panel">
                    <div className="plans-launch-preview-panel-head">
                      <div>
                        <p className="plans-launch-preview-panel-eyebrow">EVENT7_SKU</p>
                        <h4 className="plans-launch-preview-panel-title">{GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU.displayName}</h4>
                      </div>
                      <span className="plans-launch-preview-panel-badge">FAST DEMO</span>
                    </div>
                    <div className="plans-launch-preview-list">
                      <div className="plans-launch-preview-row">
                        <span>Series PDA</span>
                        <span className="protocol-address">{genesisArtifactPreview.seriesAddresses.event7}</span>
                      </div>
                      <div className="plans-launch-preview-row">
                        <span>Funding lanes</span>
                        <span className="plans-launch-preview-value">Premium · Sponsor · Liquidity</span>
                      </div>
                      <div className="plans-launch-preview-row">
                        <span>Window</span>
                        <span className="plans-launch-preview-value">{GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU.coverWindowDays} days</span>
                      </div>
                    </div>
                  </article>

                  <article className="plans-launch-preview-panel">
                    <div className="plans-launch-preview-panel-head">
                      <div>
                        <p className="plans-launch-preview-panel-eyebrow">TRAVEL30_SKU</p>
                        <h4 className="plans-launch-preview-panel-title">{GENESIS_PROTECT_ACUTE_PRIMARY_SKU.displayName}</h4>
                      </div>
                      <span className="plans-launch-preview-panel-badge">PRIMARY LAUNCH</span>
                    </div>
                    <div className="plans-launch-preview-list">
                      <div className="plans-launch-preview-row">
                        <span>Series PDA</span>
                        <span className="protocol-address">{genesisArtifactPreview.seriesAddresses.travel30}</span>
                      </div>
                      <div className="plans-launch-preview-row">
                        <span>Funding lanes</span>
                        <span className="plans-launch-preview-value">Premium · Liquidity</span>
                      </div>
                      <div className="plans-launch-preview-row">
                        <span>Window</span>
                        <span className="plans-launch-preview-value">{GENESIS_PROTECT_ACUTE_PRIMARY_SKU.coverWindowDays} days</span>
                      </div>
                    </div>
                  </article>

                  <article className="plans-launch-preview-panel">
                    <div className="plans-launch-preview-panel-head">
                      <div>
                        <p className="plans-launch-preview-panel-eyebrow">POOL_AND_CLASSES</p>
                        <h4 className="plans-launch-preview-panel-title">{GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME}</h4>
                      </div>
                      <span className="plans-launch-preview-panel-badge">QUEUE ONLY</span>
                    </div>
                    <div className="plans-launch-preview-list">
                      <div className="plans-launch-preview-row">
                        <span>Pool PDA</span>
                        <span className="protocol-address">{genesisArtifactPreview.poolAddress}</span>
                      </div>
                      <div className="plans-launch-preview-row">
                        <span>Capital classes</span>
                        <span className="plans-launch-preview-value">{genesisProtectAcuteBootstrapCapitalClasses().length}</span>
                      </div>
                      <div className="plans-launch-preview-row">
                        <span>Allocations</span>
                        <span className="plans-launch-preview-value">{genesisProtectAcuteBootstrapAllocations().length}</span>
                      </div>
                    </div>
                  </article>
                </>
              ) : null}

              {!genesisTemplateMode && rewardLaneRequired ? (
                <article className="plans-launch-preview-panel">
                  <div className="plans-launch-preview-panel-head">
                    <div>
                      <p className="plans-launch-preview-panel-eyebrow">REWARD_LANE</p>
                      <h4 className="plans-launch-preview-panel-title">{rewardSeriesDisplayName || "Reward lane pending"}</h4>
                    </div>
                    <span className="plans-launch-preview-panel-badge">{selectedOutcomeIds.length} outcomes</span>
                  </div>
                  <div className="plans-launch-preview-list">
                    <div className="plans-launch-preview-row">
                      <span>Series PDA</span>
                      <span className="protocol-address">{addressPreview.rewardSeriesAddress ?? "pending"}</span>
                    </div>
                    <div className="plans-launch-preview-row">
                      <span>Sponsor line</span>
                      <span className="protocol-address">{addressPreview.rewardFundingLineAddress ?? "pending"}</span>
                    </div>
                    <div className="plans-launch-preview-row">
                      <span>Rule namespace</span>
                      <span className="plans-launch-preview-value">{protocolToken(rewardSeriesId || "reward-series")}</span>
                    </div>
                  </div>
                </article>
              ) : null}

              {protectionLaneRequired ? (
                <article className="plans-launch-preview-panel">
                  <div className="plans-launch-preview-panel-head">
                    <div>
                      <p className="plans-launch-preview-panel-eyebrow">PROTECTION_LANE</p>
                      <h4 className="plans-launch-preview-panel-title">
                        {protectionSeriesDisplayName || "Protection lane pending"}
                      </h4>
                    </div>
                    <span className="plans-launch-preview-panel-badge">{protocolToken(coveragePathway)}</span>
                  </div>
                  <div className="plans-launch-preview-list">
                    <div className="plans-launch-preview-row">
                      <span>Series PDA</span>
                      <span className="protocol-address">{addressPreview.protectionSeriesAddress ?? "pending"}</span>
                    </div>
                    <div className="plans-launch-preview-row">
                      <span>Premium line</span>
                      <span className="protocol-address">{addressPreview.protectionFundingLineAddress ?? "pending"}</span>
                    </div>
                    <div className="plans-launch-preview-row">
                      <span>Settlement posture</span>
                      <span className="plans-launch-preview-value">
                        {coveragePathway === "defi_native" ? protocolToken(defiSettlementMode) : protocolToken(coveragePathway)}
                      </span>
                    </div>
                  </div>
                </article>
              ) : null}

              <article className="plans-launch-preview-panel plans-launch-preview-panel-rails">
                <div className="plans-launch-preview-panel-head">
                  <div>
                    <p className="plans-launch-preview-panel-eyebrow">RAIL_SUPPORT</p>
                    <h4 className="plans-launch-preview-panel-title">Reserve-domain launch rails</h4>
                  </div>
                  <span className="plans-launch-preview-panel-badge">{availableRailMints.length || 0} live</span>
                </div>
                <div className="plans-launch-preview-rail-list">
                  {availableRailMints.length > 0 ? (
                    availableRailMints.map((mint) => (
                      <span key={mint} className="plans-launch-preview-rail-chip">
                        {mint}
                      </span>
                    ))
                  ) : (
                    <span className="plans-launch-preview-empty">No reserve rails exposed yet.</span>
                  )}
                </div>
              </article>
            </div>

            <section className="plans-launch-preview-overrides">
              <div className="plans-launch-preview-overrides-head">
                <div>
                  <p className="plans-launch-preview-panel-eyebrow">COMMITMENT_OVERRIDES</p>
                  <h4 className="plans-launch-preview-panel-title">Protocol hash overrides</h4>
                </div>
                <span className="plans-launch-preview-overrides-copy">Optional 32-byte hex values</span>
              </div>
              <div className="plans-wizard-row">
                <FieldGroup label="Terms hash override">
                  <input
                    className="plans-wizard-input"
                    value={termsHashHex}
                    onChange={(event) => setTermsHashHex(event.target.value)}
                    placeholder="Optional 32-byte hex"
                  />
                </FieldGroup>
                <FieldGroup label="Payout policy hash override">
                  <input
                    className="plans-wizard-input"
                    value={payoutPolicyHashHex}
                    onChange={(event) => setPayoutPolicyHashHex(event.target.value)}
                    placeholder="Optional 32-byte hex"
                  />
                </FieldGroup>
              </div>
            </section>
          </div>
        ) : null}

        {activeDetail?.key === "rule-commitments" ? (
          <div className="wizard-detail-stack">
            <div className="wizard-detail-card-grid">
              <article className="wizard-detail-card">
                <div className="wizard-detail-card-head">
                  <div>
                    <p className="wizard-detail-card-eyebrow">DERIVED_RULE_HASH</p>
                    <h3 className="wizard-detail-card-title">Outcome rule commitment</h3>
                  </div>
                  <span className="wizard-detail-chip wizard-detail-chip-accent">AUTO</span>
                </div>
                <p className="wizard-detail-hash">{activeRulePreview?.derivedRuleHashHex ?? "pending"}</p>
              </article>

              <article className="wizard-detail-card">
                <div className="wizard-detail-card-head">
                  <div>
                    <p className="wizard-detail-card-eyebrow">DERIVED_PAYOUT_HASH</p>
                    <h3 className="wizard-detail-card-title">Payout commitment</h3>
                  </div>
                  <span className="wizard-detail-chip wizard-detail-chip-accent">AUTO</span>
                </div>
                <p className="wizard-detail-hash">{activeRulePreview?.derivedPayoutHashHex ?? "pending"}</p>
              </article>
            </div>

            {activeRuleOutcomeId ? (
              <div className="plans-wizard-row wizard-detail-form-row">
                <FieldGroup label="Rule hash override">
                  <input
                    className="plans-wizard-input"
                    value={ruleHashOverridesByOutcome[activeRuleOutcomeId] ?? ""}
                    onChange={(event) =>
                      setRuleHashOverridesByOutcome((current) => ({ ...current, [activeRuleOutcomeId]: event.target.value }))}
                    placeholder="Optional 32-byte hex"
                  />
                </FieldGroup>
                <FieldGroup label="Payout hash override">
                  <input
                    className="plans-wizard-input"
                    value={payoutHashOverridesByOutcome[activeRuleOutcomeId] ?? ""}
                    onChange={(event) =>
                      setPayoutHashOverridesByOutcome((current) => ({ ...current, [activeRuleOutcomeId]: event.target.value }))}
                    placeholder="Optional 32-byte hex"
                  />
                </FieldGroup>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeDetail?.key === "protection-posture" ? (
          <div className="wizard-detail-stack">
            <article className="wizard-detail-card">
              <div className="wizard-detail-card-head">
                <div>
                  <p className="wizard-detail-card-eyebrow">POSTURE_PAYLOAD</p>
                  <h3 className="wizard-detail-card-title">Structured protection commitment</h3>
                </div>
                <span className={cn("wizard-detail-chip", protectionPosture ? "wizard-detail-chip-accent" : "wizard-detail-chip-muted")}>
                  {protectionPosture ? "READY" : "INCOMPLETE"}
                </span>
              </div>
              <pre className="wizard-detail-code-block">
                {protectionPosture ? stableStringify(protectionPosture) : "Protection posture is incomplete."}
              </pre>
            </article>
          </div>
        ) : null}
      </WizardDetailSheet>
    </div>
  );
}
