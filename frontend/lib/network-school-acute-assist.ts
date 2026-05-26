// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_POOL_ID,
  GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
} from "@/lib/genesis-protect-acute";

export type NetworkSchoolAcuteAssistSkuKey = "lite" | "core" | "plus" | "familyCore";

export type NetworkSchoolAcuteAssistSublimit = {
  label: string;
  amountUsd: number;
};

export type NetworkSchoolAcuteAssistEvidenceSchemaBinding = {
  schemaKey: string;
  schemaVersion: number;
  schemaAuthority: "shared_public_contract";
};

export type NetworkSchoolAcuteAssistFundingLane = {
  lineId: string;
  reserveRole: string;
};

export type NetworkSchoolAcuteAssistIssuanceControls = {
  reserveAttribution: string;
  publicStatusRule: string;
  issueWhen: string[];
  pauseWhen: string[];
};

export type NetworkSchoolAcuteAssistLaunchTruth = {
  publicStatus: "network_school_verification_pending";
  primaryLaunchSku: NetworkSchoolAcuteAssistSkuKey;
  claimsTrustPhase: "operator_backed_oracle_phase0";
  broadlyLiveInsurance: false;
  networkSchoolOfficialBenefit: false;
  superteamEligible: false;
  discordVerificationRequired: true;
  rawHealthEvidenceOnchain: false;
};

export type NetworkSchoolAcuteAssistSkuDefinition = {
  key: NetworkSchoolAcuteAssistSkuKey;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  comparabilityKey: string;
  coverWindowDays: number;
  defaultSelection: boolean;
  cohort0Launch: boolean;
  familyPlan: boolean;
  pricing: {
    retailUsd: number;
    termRolBps: number;
    expectedLossUsd: number;
    baseLossRatioPct: number;
    stressLossRatioPct: number;
  };
  supportLimitUsd: number;
  fastLaneUsd: number;
  manualReviewAboveUsd: number;
  reimbursement: {
    excessUsd: number;
    reimbursementPctAfterExcess: number;
    formula: string;
  };
  sublimits: NetworkSchoolAcuteAssistSublimit[];
  householdRules?: {
    includedAdults: number;
    includedChildren: number;
    perPersonMaxUsd: number;
    perEventMaxUsd: number;
    outpatientFamilySublimitUsd: number;
    maxPaidClaimsPerWindow: number;
  };
  waitingPeriods: {
    illnessHours: number;
    accidentHours: number;
    knownSymptomsExcluded: boolean;
  };
  evidenceSchema: NetworkSchoolAcuteAssistEvidenceSchemaBinding;
  fundingLineIds: {
    premium: string;
    liquidity: string;
  };
  fundingLanes: {
    premium: NetworkSchoolAcuteAssistFundingLane;
    liquidity: NetworkSchoolAcuteAssistFundingLane;
  };
  issuanceControls: NetworkSchoolAcuteAssistIssuanceControls;
  launchTruth: NetworkSchoolAcuteAssistLaunchTruth;
};

export const NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_ID = "network-school-acute-assist-v1";
export const NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_DISPLAY_NAME = "Network School Acute Assist";
export const NETWORK_SCHOOL_ACUTE_ASSIST_PLAN_METADATA_URI = "/metadata/plans/network-school-acute-assist-v1.json";
export const NETWORK_SCHOOL_ACUTE_ASSIST_SPONSOR_LABEL = "Network School Verified Members";
export const NETWORK_SCHOOL_ACUTE_ASSIST_TERMS_VERSION = "ns-acute-assist-v1";
export const NETWORK_SCHOOL_ACUTE_ASSIST_PUBLIC_DISCLOSURE_BASE_URL = "https://protocol.omegax.health";
export const NETWORK_SCHOOL_ACUTE_ASSIST_TECHNICAL_TERMS_PATH =
  "/coverage/network-school-acute-assist/technical-terms";
export const NETWORK_SCHOOL_ACUTE_ASSIST_RISK_DISCLOSURE_PATH =
  "/coverage/network-school-acute-assist/risk-disclosures";
export const NETWORK_SCHOOL_ACUTE_ASSIST_TECHNICAL_TERMS_URL =
  `${NETWORK_SCHOOL_ACUTE_ASSIST_PUBLIC_DISCLOSURE_BASE_URL}${NETWORK_SCHOOL_ACUTE_ASSIST_TECHNICAL_TERMS_PATH}`;
export const NETWORK_SCHOOL_ACUTE_ASSIST_RISK_DISCLOSURE_URL =
  `${NETWORK_SCHOOL_ACUTE_ASSIST_PUBLIC_DISCLOSURE_BASE_URL}${NETWORK_SCHOOL_ACUTE_ASSIST_RISK_DISCLOSURE_PATH}`;
export const NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_KEY = "network-school-acute-assist-claim";
export const NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_VERSION = 1;
export const NETWORK_SCHOOL_ACUTE_ASSIST_POOL_ID = GENESIS_PROTECT_ACUTE_POOL_ID;
export const NETWORK_SCHOOL_ACUTE_ASSIST_POOL_DISPLAY_NAME = GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME;
export const NETWORK_SCHOOL_ACUTE_ASSIST_POOL_STRATEGY_THESIS = GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS;
export const NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_ID = GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID;
export const NETWORK_SCHOOL_ACUTE_ASSIST_SENIOR_CLASS_DISPLAY_NAME =
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_DISPLAY_NAME;
export const NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_ID = GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID;
export const NETWORK_SCHOOL_ACUTE_ASSIST_JUNIOR_CLASS_DISPLAY_NAME =
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_DISPLAY_NAME;
export const NETWORK_SCHOOL_ACUTE_ASSIST_COHORT0_POLICY_CAP = 250;
export const NETWORK_SCHOOL_ACUTE_ASSIST_COHORT0_HARD_PAYOUT_CAP_USD = 6_000;

export const NETWORK_SCHOOL_ACUTE_ASSIST_METADATA_URIS = {
  lite: "/metadata/protection/ns-acute-assist-lite-30-v1.json",
  core: "/metadata/protection/ns-acute-assist-core-30-v1.json",
  plus: "/metadata/protection/ns-acute-assist-plus-30-v1.json",
  familyCore: "/metadata/protection/ns-acute-assist-family-core-30-v1.json",
} as const satisfies Record<NetworkSchoolAcuteAssistSkuKey, string>;

export const NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA: NetworkSchoolAcuteAssistEvidenceSchemaBinding = {
  schemaKey: NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_KEY,
  schemaVersion: NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA_VERSION,
  schemaAuthority: "shared_public_contract",
};

export const NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH: NetworkSchoolAcuteAssistLaunchTruth = {
  publicStatus: "network_school_verification_pending",
  primaryLaunchSku: "core",
  claimsTrustPhase: "operator_backed_oracle_phase0",
  broadlyLiveInsurance: false,
  networkSchoolOfficialBenefit: false,
  superteamEligible: false,
  discordVerificationRequired: true,
  rawHealthEvidenceOnchain: false,
};

const NETWORK_SCHOOL_ACUTE_ASSIST_REIMBURSEMENT = {
  excessUsd: 50,
  reimbursementPctAfterExcess: 80,
  formula: "min(plan_limit, sublimit, remaining_member_limit, remaining_pool_cap, max(0, (eligible_bill - 50) * 0.80))",
} as const;

const NETWORK_SCHOOL_ACUTE_ASSIST_WAITING_PERIODS = {
  illnessHours: 24,
  accidentHours: 0,
  knownSymptomsExcluded: true,
} as const;

function fundingLanesFor(linePrefix: string, displayName: string) {
  const premium = `${linePrefix}-premiums`;
  const liquidity = `${linePrefix}-liquidity`;
  return {
    fundingLineIds: {
      premium,
      liquidity,
    },
    fundingLanes: {
      premium: {
        lineId: premium,
        reserveRole: `Collected 30-day member premiums attributed to ${displayName}.`,
      },
      liquidity: {
        lineId: liquidity,
        reserveRole: `Posted acute-pool capital allocated to approved ${displayName} obligations.`,
      },
    },
  } as const;
}

function cohort0IssuanceControls(displayName: string, fastLaneUsd: number): NetworkSchoolAcuteAssistIssuanceControls {
  return {
    reserveAttribution:
      "Only posted acute-pool capital and collected premiums count as claims-paying reserve; token treasury marks do not count without a disclosed haircut.",
    publicStatusRule:
      "Keep this as a Network School-only limited pilot. Do not present it as official Network School coverage, Superteam coverage, broad public insurance, or guaranteed payout insurance.",
    issueWhen: [
      "Network School membership verification has succeeded through the off-chain Discord/member verifier.",
      "The member activates the 30-day window before symptoms, injury, or the acute event.",
      "Usable claim-paying reserve supports the active Cohort 0 product ladder and aggregate payout cap.",
      "Claims operators can review evidence manually above the fast-lane threshold.",
    ],
    pauseWhen: [
      "Discord or Network School membership verification is unavailable, unconfigured, or stale.",
      "Paid claims exceed 50% of the monthly payout cap or hit the hard aggregate cap.",
      `Any ${displayName} claim exceeds the fast-lane threshold of ${fastLaneUsd} USD without manual review.`,
      "Provider evidence, pricing, reserve controls, or public terms drift from the published metadata.",
    ],
  };
}

const liteLanes = fundingLanesFor("ns-acute-lite30", "NS Acute Assist Lite 30");
const coreLanes = fundingLanesFor("ns-acute-core30", "NS Acute Assist Core 30");
const plusLanes = fundingLanesFor("ns-acute-plus30", "NS Acute Assist Plus 30");
const familyCoreLanes = fundingLanesFor("ns-acute-family-core30", "NS Acute Assist Family Core 30");

export const NETWORK_SCHOOL_ACUTE_ASSIST_SKUS: Record<
  NetworkSchoolAcuteAssistSkuKey,
  NetworkSchoolAcuteAssistSkuDefinition
> = {
  lite: {
    key: "lite",
    seriesId: "ns-acute-lite-30-v1",
    displayName: "NS Acute Assist - Lite 30",
    metadataUri: NETWORK_SCHOOL_ACUTE_ASSIST_METADATA_URIS.lite,
    comparabilityKey: "ns-acute-assist-lite-30",
    coverWindowDays: 30,
    defaultSelection: false,
    cohort0Launch: true,
    familyPlan: false,
    pricing: {
      retailUsd: 5,
      termRolBps: 100,
      expectedLossUsd: 0.9,
      baseLossRatioPct: 18,
      stressLossRatioPct: 60,
    },
    supportLimitUsd: 500,
    fastLaneUsd: 150,
    manualReviewAboveUsd: 150,
    reimbursement: NETWORK_SCHOOL_ACUTE_ASSIST_REIMBURSEMENT,
    sublimits: [
      { label: "Clinic, pharmacy, and urgent care", amountUsd: 500 },
    ],
    waitingPeriods: NETWORK_SCHOOL_ACUTE_ASSIST_WAITING_PERIODS,
    evidenceSchema: NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA,
    fundingLineIds: liteLanes.fundingLineIds,
    fundingLanes: liteLanes.fundingLanes,
    issuanceControls: cohort0IssuanceControls("Lite 30", 150),
    launchTruth: NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH,
  },
  core: {
    key: "core",
    seriesId: "ns-acute-core-30-v1",
    displayName: "NS Acute Assist - Core 30",
    metadataUri: NETWORK_SCHOOL_ACUTE_ASSIST_METADATA_URIS.core,
    comparabilityKey: "ns-acute-assist-core-30",
    coverWindowDays: 30,
    defaultSelection: true,
    cohort0Launch: true,
    familyPlan: false,
    pricing: {
      retailUsd: 10,
      termRolBps: 100,
      expectedLossUsd: 3,
      baseLossRatioPct: 30,
      stressLossRatioPct: 90,
    },
    supportLimitUsd: 1_000,
    fastLaneUsd: 250,
    manualReviewAboveUsd: 250,
    reimbursement: NETWORK_SCHOOL_ACUTE_ASSIST_REIMBURSEMENT,
    sublimits: [
      { label: "Clinic, urgent care, diagnostics, prescribed medication, and initial stabilization", amountUsd: 1_000 },
    ],
    waitingPeriods: NETWORK_SCHOOL_ACUTE_ASSIST_WAITING_PERIODS,
    evidenceSchema: NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA,
    fundingLineIds: coreLanes.fundingLineIds,
    fundingLanes: coreLanes.fundingLanes,
    issuanceControls: cohort0IssuanceControls("Core 30", 250),
    launchTruth: NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH,
  },
  plus: {
    key: "plus",
    seriesId: "ns-acute-plus-30-v1",
    displayName: "NS Acute Assist - Plus 30",
    metadataUri: NETWORK_SCHOOL_ACUTE_ASSIST_METADATA_URIS.plus,
    comparabilityKey: "ns-acute-assist-plus-30",
    coverWindowDays: 30,
    defaultSelection: false,
    cohort0Launch: true,
    familyPlan: false,
    pricing: {
      retailUsd: 21,
      termRolBps: 84,
      expectedLossUsd: 6.5,
      baseLossRatioPct: 31,
      stressLossRatioPct: 93,
    },
    supportLimitUsd: 2_500,
    fastLaneUsd: 500,
    manualReviewAboveUsd: 500,
    reimbursement: NETWORK_SCHOOL_ACUTE_ASSIST_REIMBURSEMENT,
    sublimits: [
      { label: "Clinic, outpatient, and pharmacy", amountUsd: 1_000 },
      { label: "Dengue, infection, urgent labs, and observation", amountUsd: 1_500 },
      { label: "ER and hospital stabilization", amountUsd: 2_500 },
    ],
    waitingPeriods: NETWORK_SCHOOL_ACUTE_ASSIST_WAITING_PERIODS,
    evidenceSchema: NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA,
    fundingLineIds: plusLanes.fundingLineIds,
    fundingLanes: plusLanes.fundingLanes,
    issuanceControls: cohort0IssuanceControls("Plus 30", 500),
    launchTruth: NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH,
  },
  familyCore: {
    key: "familyCore",
    seriesId: "ns-acute-family-core-30-v1",
    displayName: "NS Acute Assist - Family Core 30",
    metadataUri: NETWORK_SCHOOL_ACUTE_ASSIST_METADATA_URIS.familyCore,
    comparabilityKey: "ns-acute-assist-family-core-30",
    coverWindowDays: 30,
    defaultSelection: false,
    cohort0Launch: true,
    familyPlan: true,
    pricing: {
      retailUsd: 34,
      termRolBps: 85,
      expectedLossUsd: 14,
      baseLossRatioPct: 41,
      stressLossRatioPct: 124,
    },
    supportLimitUsd: 4_000,
    fastLaneUsd: 500,
    manualReviewAboveUsd: 500,
    reimbursement: NETWORK_SCHOOL_ACUTE_ASSIST_REIMBURSEMENT,
    sublimits: [
      { label: "Shared family aggregate", amountUsd: 4_000 },
      { label: "Per-person maximum", amountUsd: 1_500 },
      { label: "Per-event maximum", amountUsd: 2_000 },
      { label: "Outpatient and clinic family sublimit", amountUsd: 1_000 },
    ],
    householdRules: {
      includedAdults: 2,
      includedChildren: 2,
      perPersonMaxUsd: 1_500,
      perEventMaxUsd: 2_000,
      outpatientFamilySublimitUsd: 1_000,
      maxPaidClaimsPerWindow: 3,
    },
    waitingPeriods: NETWORK_SCHOOL_ACUTE_ASSIST_WAITING_PERIODS,
    evidenceSchema: NETWORK_SCHOOL_ACUTE_ASSIST_EVIDENCE_SCHEMA,
    fundingLineIds: familyCoreLanes.fundingLineIds,
    fundingLanes: familyCoreLanes.fundingLanes,
    issuanceControls: cohort0IssuanceControls("Family Core 30", 500),
    launchTruth: NETWORK_SCHOOL_ACUTE_ASSIST_LAUNCH_TRUTH,
  },
};

export const NETWORK_SCHOOL_ACUTE_ASSIST_DEFAULT_SKU = NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core;

export const NETWORK_SCHOOL_ACUTE_ASSIST_SKU_LIST = [
  NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.lite,
  NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.core,
  NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.plus,
  NETWORK_SCHOOL_ACUTE_ASSIST_SKUS.familyCore,
] as const;

export const NETWORK_SCHOOL_ACUTE_ASSIST_COMMON_EXCLUSIONS = [
  "chronic and pre-existing conditions",
  "known symptoms before activation",
  "routine checkups, preventive care, and elective or planned treatment",
  "dental, vision, maternity, fertility, mental health, cosmetic care, and long-term rehabilitation",
  "ongoing medication refills",
  "intoxication-related events, illegal activity, and fraud",
  "high-risk or professional sports unless a later explicit add-on is published",
  "treatment in USA or Canada at launch",
  "evacuation, repatriation, trip cancellation, baggage, delay, and liability",
] as const;

export const NETWORK_SCHOOL_ACUTE_ASSIST_COVERED_EVENTS = [
  "urgent clinic visit",
  "urgent doctor consult",
  "emergency room consult",
  "hospital stabilization within cap",
  "food poisoning or gastroenteritis requiring care",
  "dengue fever evaluation and treatment within cap",
  "fever or infection requiring clinic, labs, or prescribed medication",
  "minor injury, wound care, sprain, or fracture evaluation",
  "doctor-prescribed medication tied to an eligible acute event",
  "basic diagnostics tied directly to an eligible acute event",
] as const;

