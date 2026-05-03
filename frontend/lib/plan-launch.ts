// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";

import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { deriveLaunchLedgerAddresses } from "@/lib/plan-launch-tx";
import {
  deriveFundingLinePda,
  deriveHealthPlanPda,
  derivePolicySeriesPda,
  isSeedIdSafe,
  utf8ByteLength,
} from "@/lib/protocol";
import {
  validateOptionalHex32,
  validatePublicKey,
} from "@/lib/ui-validation";

export type LaunchIntent = "rewards" | "insurance" | "hybrid";
export type LaneKind = "reward" | "protection";
export type MembershipMode = "open" | "token_gate" | "invite_only";
export type MembershipGateKind = "open" | "invite_only" | "nft_anchor" | "stake_anchor" | "fungible_snapshot";
export type PayoutAssetMode = "sol" | "spl";
export type CoveragePathway = "" | "defi_native" | "rwa_policy";
export type DefiSettlementMode = "" | "onchain_programmatic" | "hybrid_rails";

export function isRwaPolicyLaunchEnabled(
  env: { [key: string]: string | undefined } = process.env as { [key: string]: string | undefined },
): boolean {
  const value = String(env.NEXT_PUBLIC_ENABLE_RWA_POLICY ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export type LaunchLaneBlueprint = {
  kind: LaneKind;
  key: string;
  label: string;
};

export type LaunchSchemaOption = {
  id: string;
  label: string;
  schemaKey: string;
  version: number;
  metadataUri: string;
};

export type ProtectionPostureInput = {
  coveragePathway: CoveragePathway;
  defiSettlementMode: DefiSettlementMode;
  defiTechnicalTermsUri: string;
  defiRiskDisclosureUri: string;
  rwaLegalEntityName: string;
  rwaJurisdiction: string;
  rwaPolicyTermsUri: string;
  rwaRegulatoryLicenseRef: string;
  rwaComplianceContact: string;
  protectionMetadataUri: string;
};

export type SerializedProtectionPosture = {
  version: 1;
  lane: "protection";
  metadataUri: string;
  coveragePathway: Exclude<CoveragePathway, "">;
  defi?: {
    settlementStyle: Exclude<DefiSettlementMode, "">;
    technicalTermsUri: string;
    riskDisclosureUri: string;
  };
  rwa?: {
    legalEntityName: string;
    jurisdiction: string;
    policyTermsUri: string;
    regulatoryLicenseRef: string;
    complianceContact: string;
  };
};

export type LaunchReviewLinks = {
  workspaceHref: string;
  rewardLaneHref: string | null;
  protectionLaneHref: string | null;
  coverageWorkspaceHref: string | null;
};

export type LaunchBasicsValidationInput = {
  launchIntent: LaunchIntent;
  planId: string;
  displayName: string;
  organizationRef: string;
  reserveDomainAddress: string;
  metadataUri: string;
  payoutAssetMode: PayoutAssetMode;
  payoutMint: string;
  rewardPayoutUi: string;
  termsHashHex: string;
  payoutPolicyHashHex: string;
  coveragePathway: CoveragePathway;
  defiSettlementMode: DefiSettlementMode;
  defiTechnicalTermsUri: string;
  defiRiskDisclosureUri: string;
  rwaLegalEntityName: string;
  rwaJurisdiction: string;
  rwaPolicyTermsUri: string;
  rwaRegulatoryLicenseRef: string;
  rwaComplianceContact: string;
};

export type LaunchMembershipValidationInput = {
  launchIntent: LaunchIntent;
  membershipMode: MembershipMode;
  membershipGateKind: MembershipGateKind;
  tokenGateMint: string;
  tokenGateMinBalance: string;
  inviteIssuer: string;
};

export type LaunchVerificationValidationInput = {
  selectedOracles: string[];
  quorumM: string;
};

export type RewardLaneValidationInput = {
  required: boolean;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  sponsorLineId: string;
  selectedOutcomeIds: string[];
  ruleIdsByOutcome: Record<string, string>;
  ruleHashOverridesByOutcome: Record<string, string>;
  payoutHashOverridesByOutcome: Record<string, string>;
};

export type ProtectionLaneValidationInput = {
  required: boolean;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  premiumLineId: string;
  cadenceDays: string;
  expectedPremiumUi: string;
  posture: ProtectionPostureInput;
};

export const STANDARD_LAUNCH_SCHEMA: LaunchSchemaOption = {
  id: "omegax-standard-health-outcomes",
  label: "OmegaX Standard Health Outcomes",
  schemaKey: "omegax.standard.health_outcomes",
  version: 1,
  metadataUri: "/schemas/health_outcomes.json",
};

function normalize(value: string): string {
  return value.trim();
}

function isHttpOrIpfsUri(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (normalized.startsWith("/")) {
    return normalized.length > 1;
  }
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

function isPositiveInteger(value: string): boolean {
  if (!/^\d+$/.test(normalize(value))) return false;
  return BigInt(normalize(value)) > 0n;
}

function isNonNegativeDecimal(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  return /^\d+(\.\d+)?$/.test(normalized);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(value));
}

function isComplianceContact(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  return isEmail(normalized) || isHttpOrIpfsUri(normalized);
}

function validateSeedId(value: string, label: string): string | null {
  const normalized = normalize(value);
  if (!normalized) return `${label} is required.`;
  if (!isSeedIdSafe(normalized)) {
    return `${label} must be 1..32 UTF-8 bytes (currently ${utf8ByteLength(normalized)}).`;
  }
  return null;
}

function validateRequiredUri(value: string, label: string): string | null {
  const normalized = normalize(value);
  if (!normalized) return `${label} is required.`;
  if (!isHttpOrIpfsUri(normalized)) return `${label} must be an http(s), ipfs, or root-relative public URI.`;
  return null;
}

export function requiresRewardLane(intent: LaunchIntent): boolean {
  return intent === "rewards" || intent === "hybrid";
}

export function requiresProtectionLane(intent: LaunchIntent): boolean {
  return intent === "insurance" || intent === "hybrid";
}

export function resolveLaunchLaneBlueprints(intent: LaunchIntent): LaunchLaneBlueprint[] {
  const lanes: LaunchLaneBlueprint[] = [];
  if (requiresRewardLane(intent)) {
    lanes.push({
      kind: "reward",
      key: "reward-lane",
      label: "Reward lane",
    });
  }
  if (requiresProtectionLane(intent)) {
    lanes.push({
      kind: "protection",
      key: "protection-lane",
      label: "Protection lane",
    });
  }
  return lanes;
}

export function defaultReserveDomainAddress(): string {
  return DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.find((domain) => domain.active)?.address
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains[0]?.address
    ?? "";
}

export function defaultPayoutMintForIntent(intent: LaunchIntent): string {
  if (intent === "rewards") {
    return DEVNET_PROTOCOL_FIXTURE_STATE.rewardMint;
  }
  return DEVNET_PROTOCOL_FIXTURE_STATE.settlementMint;
}

export function reserveDomainSupportsMint(reserveDomainAddress: string, assetMint: string): boolean {
  return DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetVaults.some((vault) =>
    vault.reserveDomain === reserveDomainAddress && vault.assetMint === assetMint,
  );
}

export function listReserveDomainRailMints(reserveDomainAddress: string): string[] {
  const seen = new Set<string>();
  const mints: string[] = [];
  for (const vault of DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetVaults) {
    if (vault.reserveDomain !== reserveDomainAddress) continue;
    if (seen.has(vault.assetMint)) continue;
    seen.add(vault.assetMint);
    mints.push(vault.assetMint);
  }
  return mints;
}

export function buildLaunchAddressPreview(params: {
  reserveDomainAddress: string;
  planId: string;
  rewardSeriesId?: string | null;
  protectionSeriesId?: string | null;
  rewardLineId?: string | null;
  protectionLineId?: string | null;
}) {
  const planId = normalize(params.planId);
  const reserveDomainAddress = normalize(params.reserveDomainAddress);
  if (!planId || !reserveDomainAddress || !isSeedIdSafe(planId)) {
    return {
      healthPlanAddress: null,
      rewardSeriesAddress: null,
      protectionSeriesAddress: null,
      rewardFundingLineAddress: null,
      protectionFundingLineAddress: null,
    };
  }

  const healthPlanAddress = deriveHealthPlanPda({
    reserveDomain: reserveDomainAddress,
    planId,
  }).toBase58();

  const rewardSeriesId = normalize(params.rewardSeriesId ?? "");
  const protectionSeriesId = normalize(params.protectionSeriesId ?? "");
  const rewardLineId = normalize(params.rewardLineId ?? "");
  const protectionLineId = normalize(params.protectionLineId ?? "");

  const rewardSeriesAddress = rewardSeriesId && isSeedIdSafe(rewardSeriesId)
    ? derivePolicySeriesPda({ healthPlan: healthPlanAddress, seriesId: rewardSeriesId }).toBase58()
    : null;
  const protectionSeriesAddress = protectionSeriesId && isSeedIdSafe(protectionSeriesId)
    ? derivePolicySeriesPda({ healthPlan: healthPlanAddress, seriesId: protectionSeriesId }).toBase58()
    : null;
  const rewardFundingLineAddress = rewardLineId && isSeedIdSafe(rewardLineId)
    ? deriveFundingLinePda({ healthPlan: healthPlanAddress, lineId: rewardLineId }).toBase58()
    : null;
  const protectionFundingLineAddress = protectionLineId && isSeedIdSafe(protectionLineId)
    ? deriveFundingLinePda({ healthPlan: healthPlanAddress, lineId: protectionLineId }).toBase58()
    : null;

  return {
    healthPlanAddress,
    rewardSeriesAddress,
    protectionSeriesAddress,
    rewardFundingLineAddress,
    protectionFundingLineAddress,
  };
}

export function serializeProtectionPosture(
  input: ProtectionPostureInput,
): SerializedProtectionPosture | null {
  if (input.coveragePathway !== "defi_native" && input.coveragePathway !== "rwa_policy") {
    return null;
  }

  const posture: SerializedProtectionPosture = {
    version: 1,
    lane: "protection",
    metadataUri: normalize(input.protectionMetadataUri),
    coveragePathway: input.coveragePathway,
  };

  if (input.coveragePathway === "defi_native") {
    if (!input.defiSettlementMode) return null;
    posture.defi = {
      settlementStyle: input.defiSettlementMode,
      technicalTermsUri: normalize(input.defiTechnicalTermsUri),
      riskDisclosureUri: normalize(input.defiRiskDisclosureUri),
    };
  }

  if (input.coveragePathway === "rwa_policy") {
    posture.rwa = {
      legalEntityName: normalize(input.rwaLegalEntityName),
      jurisdiction: normalize(input.rwaJurisdiction),
      policyTermsUri: normalize(input.rwaPolicyTermsUri),
      regulatoryLicenseRef: normalize(input.rwaRegulatoryLicenseRef),
      complianceContact: normalize(input.rwaComplianceContact),
    };
  }

  return posture;
}

export function parseProtectionPosture(value: unknown): SerializedProtectionPosture | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<SerializedProtectionPosture>;
  if (candidate.version !== 1 || candidate.lane !== "protection") return null;
  if (candidate.coveragePathway !== "defi_native" && candidate.coveragePathway !== "rwa_policy") {
    return null;
  }
  if (typeof candidate.metadataUri !== "string") return null;

  if (candidate.coveragePathway === "defi_native") {
    if (!candidate.defi) return null;
    const settlementStyle = candidate.defi.settlementStyle;
    if (settlementStyle !== "onchain_programmatic" && settlementStyle !== "hybrid_rails") {
      return null;
    }
  }

  if (candidate.coveragePathway === "rwa_policy" && !candidate.rwa) {
    return null;
  }

  return candidate as SerializedProtectionPosture;
}

export function deriveLaunchPreflightAccountAddresses(params: {
  reserveDomain: PublicKey;
  healthPlan: PublicKey;
  assetMint: PublicKey;
  rewardSeries?: PublicKey | null;
  rewardFundingLine?: PublicKey | null;
  protectionSeries?: PublicKey | null;
  protectionFundingLine?: PublicKey | null;
}): PublicKey[] {
  const addresses = new Map<string, PublicKey>();
  addresses.set(params.reserveDomain.toBase58(), params.reserveDomain);

  const registerLane = (policySeries?: PublicKey | null, fundingLine?: PublicKey | null) => {
    if (!policySeries || !fundingLine) return;
    const { domainAssetVault, domainAssetLedger } = deriveLaunchLedgerAddresses({
      reserveDomain: params.reserveDomain,
      healthPlan: params.healthPlan,
      assetMint: params.assetMint,
      policySeries,
      fundingLine,
    });
    addresses.set(domainAssetVault.toBase58(), domainAssetVault);
    addresses.set(domainAssetLedger.toBase58(), domainAssetLedger);
  };

  registerLane(params.rewardSeries, params.rewardFundingLine);
  registerLane(params.protectionSeries, params.protectionFundingLine);

  return [...addresses.values()];
}

export function buildLaunchReviewLinks(params: {
  launchIntent: LaunchIntent;
  healthPlanAddress: string;
  rewardSeriesAddress?: string | null;
  protectionSeriesAddress?: string | null;
}): LaunchReviewLinks {
  const plan = encodeURIComponent(params.healthPlanAddress);
  const rewardSeries = params.rewardSeriesAddress ? encodeURIComponent(params.rewardSeriesAddress) : null;
  const protectionSeries = params.protectionSeriesAddress ? encodeURIComponent(params.protectionSeriesAddress) : null;
  const defaultSeries = params.launchIntent === "insurance"
    ? protectionSeries
    : rewardSeries ?? protectionSeries;
  const workspaceHref = defaultSeries
    ? `/plans?plan=${plan}&series=${defaultSeries}&tab=overview`
    : `/plans?plan=${plan}&tab=overview`;
  const rewardLaneHref = rewardSeries
    ? `/plans?plan=${plan}&series=${rewardSeries}&tab=overview`
    : null;
  const protectionLaneHref = protectionSeries
    ? `/plans?plan=${plan}&series=${protectionSeries}&tab=coverage`
    : null;

  return {
    workspaceHref,
    rewardLaneHref,
    protectionLaneHref,
    coverageWorkspaceHref: protectionLaneHref,
  };
}

export function validateLaunchBasics(input: LaunchBasicsValidationInput): string[] {
  const errors: string[] = [];

  const planIdError = validateSeedId(input.planId, "Plan ID");
  if (planIdError) errors.push(planIdError);
  if (!normalize(input.displayName)) errors.push("Display name is required.");
  if (!normalize(input.organizationRef)) errors.push("Sponsor label or organization reference is required.");
  const reserveDomainResult = validatePublicKey(input.reserveDomainAddress);
  if (!reserveDomainResult.ok) errors.push("Reserve domain must be a valid public key.");
  const metadataUriError = validateRequiredUri(input.metadataUri, "Plan metadata URI");
  if (metadataUriError) errors.push(metadataUriError);

  if (input.payoutAssetMode === "spl") {
    const payoutMintResult = validatePublicKey(input.payoutMint);
    if (!payoutMintResult.ok) errors.push("Payout mint must be a valid SPL mint address.");
  }

  if (requiresRewardLane(input.launchIntent) && !isNonNegativeDecimal(input.rewardPayoutUi)) {
    errors.push("Reward payout amount is required for reward-bearing launches.");
  }

  const termsHashResult = validateOptionalHex32(input.termsHashHex, "Terms hash");
  if (!termsHashResult.ok) errors.push(termsHashResult.message);
  const payoutHashResult = validateOptionalHex32(input.payoutPolicyHashHex, "Payout policy hash");
  if (!payoutHashResult.ok) errors.push(payoutHashResult.message);

  if (requiresProtectionLane(input.launchIntent)) {
    if (!input.coveragePathway) {
      errors.push("Coverage path is required for insurance and hybrid launches.");
    }

    if (input.coveragePathway === "defi_native") {
      if (!input.defiSettlementMode) {
        errors.push("Settlement style is required for DeFi-native coverage.");
      }
      const technicalTermsError = validateRequiredUri(input.defiTechnicalTermsUri, "Technical terms URL");
      if (technicalTermsError) errors.push(technicalTermsError);
      const riskDisclosureError = validateRequiredUri(input.defiRiskDisclosureUri, "Risk disclosure URL");
      if (riskDisclosureError) errors.push(riskDisclosureError);
    }

    if (input.coveragePathway === "rwa_policy") {
      if (!normalize(input.rwaLegalEntityName)) errors.push("RWA issuer legal name is required.");
      if (!normalize(input.rwaJurisdiction)) errors.push("RWA jurisdiction is required.");
      const policyTermsError = validateRequiredUri(input.rwaPolicyTermsUri, "RWA policy terms URI");
      if (policyTermsError) errors.push(policyTermsError);
      if (!normalize(input.rwaRegulatoryLicenseRef)) errors.push("RWA regulatory or license reference is required.");
      if (!isComplianceContact(input.rwaComplianceContact)) {
        errors.push("RWA compliance contact must be an email address or public URL.");
      }
    }
  }

  return errors;
}

export function validateLaunchMembership(input: LaunchMembershipValidationInput): string[] {
  const errors: string[] = [];

  if (input.membershipMode === "open" && input.membershipGateKind !== "open") {
    errors.push("Open enrollment must use the open gate class.");
  }

  if (input.membershipMode === "token_gate") {
    if (!["fungible_snapshot", "nft_anchor", "stake_anchor"].includes(input.membershipGateKind)) {
      errors.push("Choose a token gate class for token-gated enrollment.");
    }
    const mintResult = validatePublicKey(input.tokenGateMint);
    if (!mintResult.ok) errors.push("Token gate mint must be a valid public key.");
    if (!isPositiveInteger(input.tokenGateMinBalance)) {
      errors.push("Token gate minimum balance must be greater than zero.");
    }
    if (requiresProtectionLane(input.launchIntent) && input.membershipGateKind === "fungible_snapshot") {
      errors.push("Protection launches cannot use fungible snapshot gating. Choose NFT anchor, stake anchor, open, or invite-only enrollment.");
    }
  }

  if (input.membershipMode === "invite_only") {
    if (input.membershipGateKind !== "invite_only") {
      errors.push("Invite-only enrollment must use the invite-only gate class.");
    }
    const inviteResult = validatePublicKey(input.inviteIssuer);
    if (!inviteResult.ok) errors.push("Invite issuer must be a valid public key.");
  }

  return errors;
}

export function validateLaunchVerification(input: LaunchVerificationValidationInput): string[] {
  const errors: string[] = [];
  if (input.selectedOracles.length === 0) {
    errors.push("Select at least one oracle authority.");
  }

  for (const oracle of input.selectedOracles) {
    const result = validatePublicKey(oracle);
    if (!result.ok) {
      errors.push(`Oracle address is invalid: ${oracle}`);
      break;
    }
  }

  if (!/^\d+$/.test(normalize(input.quorumM))) {
    errors.push("Required confirmations must be a positive integer.");
  } else {
    const quorum = Number.parseInt(normalize(input.quorumM), 10);
    if (quorum < 1) {
      errors.push("Required confirmations must be at least 1.");
    }
    if (quorum > input.selectedOracles.length) {
      errors.push("Required confirmations cannot exceed the selected oracle count.");
    }
  }

  return errors;
}

export function validateRewardLane(input: RewardLaneValidationInput): string[] {
  if (!input.required) return [];

  const errors: string[] = [];
  const seriesIdError = validateSeedId(input.seriesId, "Reward series ID");
  if (seriesIdError) errors.push(seriesIdError);
  if (!normalize(input.displayName)) errors.push("Reward series display name is required.");
  const metadataUriError = validateRequiredUri(input.metadataUri, "Reward series metadata URI");
  if (metadataUriError) errors.push(metadataUriError);
  const sponsorLineIdError = validateSeedId(input.sponsorLineId, "Sponsor funding line ID");
  if (sponsorLineIdError) errors.push(sponsorLineIdError);
  if (input.selectedOutcomeIds.length === 0) {
    errors.push("Select at least one reward outcome.");
  }

  for (const outcomeId of input.selectedOutcomeIds) {
    const ruleIdError = validateSeedId(input.ruleIdsByOutcome[outcomeId] ?? "", `Rule ID for ${outcomeId}`);
    if (ruleIdError) {
      errors.push(ruleIdError);
      break;
    }
    const ruleHashResult = validateOptionalHex32(
      input.ruleHashOverridesByOutcome[outcomeId] ?? "",
      `Rule hash override for ${outcomeId}`,
    );
    if (!ruleHashResult.ok) {
      errors.push(ruleHashResult.message);
      break;
    }
    const payoutHashResult = validateOptionalHex32(
      input.payoutHashOverridesByOutcome[outcomeId] ?? "",
      `Payout hash override for ${outcomeId}`,
    );
    if (!payoutHashResult.ok) {
      errors.push(payoutHashResult.message);
      break;
    }
  }

  return errors;
}

export function validateProtectionLane(input: ProtectionLaneValidationInput): string[] {
  if (!input.required) return [];

  const errors: string[] = [];
  const seriesIdError = validateSeedId(input.seriesId, "Protection series ID");
  if (seriesIdError) errors.push(seriesIdError);
  if (!normalize(input.displayName)) errors.push("Protection series display name is required.");
  const metadataUriError = validateRequiredUri(input.metadataUri, "Protection series metadata URI");
  if (metadataUriError) errors.push(metadataUriError);
  const premiumLineIdError = validateSeedId(input.premiumLineId, "Premium funding line ID");
  if (premiumLineIdError) errors.push(premiumLineIdError);
  if (!isPositiveInteger(input.cadenceDays)) {
    errors.push("Premium cadence must be greater than zero days.");
  }
  if (!isNonNegativeDecimal(input.expectedPremiumUi)) {
    errors.push("Expected first-cycle premium volume is required.");
  }

  const posture = serializeProtectionPosture(input.posture);
  if (!posture) {
    errors.push("Protection posture is incomplete.");
  }

  const protectionMetadataUriError = validateRequiredUri(
    input.posture.protectionMetadataUri,
    "Protection metadata URI",
  );
  if (protectionMetadataUriError) errors.push(protectionMetadataUriError);

  return errors;
}

export function dedupeOracleOptions(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) continue;
    if (!validatePublicKey(normalized).ok) continue;
    const canonical = new PublicKey(normalized).toBase58();
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    deduped.push(canonical);
  }
  return deduped;
}
