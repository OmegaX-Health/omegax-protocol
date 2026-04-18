// SPDX-License-Identifier: AGPL-3.0-or-later

export type GenesisProtectAcuteSkuKey = "event7" | "travel30";

export type GenesisProtectAcuteTier = {
  id: string;
  label: string;
  trigger: string;
  benefitUsd: number;
};

export type GenesisProtectAcuteEvidenceSchemaBinding = {
  schemaKey: string;
  schemaVersion: number;
  schemaAuthority: "shared_public_contract";
};

export type GenesisProtectAcuteFundingLane = {
  lineId: string;
  reserveRole: string;
};

export type GenesisProtectAcuteIssuanceControls = {
  reserveAttribution: string;
  publicStatusRule: string;
  issueWhen: string[];
  pauseWhen: string[];
};

export type GenesisProtectAcuteLaunchTruth = {
  publicStatus: "end_of_month_mainnet_target";
  primaryLaunchSku: GenesisProtectAcuteSkuKey;
  fastDemoSku: GenesisProtectAcuteSkuKey;
  claimsTrustPhase: "operator_backed_oracle_phase0";
  broadlyLiveInsurance: false;
  predictionMarketsCountAsReserve: false;
  appMembershipBillingSeparate: true;
};

export type GenesisProtectAcuteSkuDefinition = {
  key: GenesisProtectAcuteSkuKey;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  comparabilityKey: string;
  coverWindowDays: number;
  payoutCapUsd: number;
  benefitStyle: "fixed_benefit_only" | "hybrid_fixed_plus_reimbursement";
  pricing: {
    retailUsd: number;
    cohortUsdMin: number;
    cohortUsdMax: number;
    sponsorNote?: string;
  };
  benefitTiers: GenesisProtectAcuteTier[];
  reimbursementTopUp?: {
    aggregateCapUsd: number;
    description: string;
  };
  waitingPeriods: {
    illnessDays: number;
    accidentHours: number;
    sponsorCohortWaiverAllowed: boolean;
  };
  reimbursementPosture: string;
  evidenceSchema: GenesisProtectAcuteEvidenceSchemaBinding;
  fundingLineIds: {
    premium: string;
    liquidity: string;
    sponsor?: string;
  };
  fundingLanes: {
    premium: GenesisProtectAcuteFundingLane;
    liquidity: GenesisProtectAcuteFundingLane;
    sponsor?: GenesisProtectAcuteFundingLane;
  };
  issuanceControls: GenesisProtectAcuteIssuanceControls;
  launchTruth: GenesisProtectAcuteLaunchTruth;
};

export const GENESIS_PROTECT_ACUTE_PLAN_ID = "genesis-protect-acute-v1";
export const GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME = "Genesis Protect Acute";
export const GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI = "/metadata/plans/genesis-protect-acute-v1.json";
export const GENESIS_PROTECT_ACUTE_SPONSOR_LABEL = "Genesis Protect Cohorts";
export const GENESIS_PROTECT_ACUTE_TERMS_VERSION = "genesis-acute-v1";
export const GENESIS_PROTECT_ACUTE_PUBLIC_DISCLOSURE_BASE_URL = "https://protocol.omegax.health";
export const GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_PATH = "/coverage/technical-terms";
export const GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_PATH = "/coverage/risk-disclosures";
export const GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_URL =
  `${GENESIS_PROTECT_ACUTE_PUBLIC_DISCLOSURE_BASE_URL}${GENESIS_PROTECT_ACUTE_TECHNICAL_TERMS_PATH}`;
export const GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_URL =
  `${GENESIS_PROTECT_ACUTE_PUBLIC_DISCLOSURE_BASE_URL}${GENESIS_PROTECT_ACUTE_RISK_DISCLOSURE_PATH}`;
export const GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_KEY = "genesis-protect-acute-claim";
export const GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_VERSION = 1;
export const GENESIS_PROTECT_ACUTE_POOL_ID = "genesis-protect-acute-pool";
export const GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME = "Genesis Protect Acute Pool";
export const GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS =
  "Dedicated acute emergency travel reserve sleeve with explicit Event 7 and Travel 30 attribution.";
export const GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID = "genesis-senior-class";
export const GENESIS_PROTECT_ACUTE_SENIOR_CLASS_DISPLAY_NAME = "Genesis Acute Senior Class";
export const GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID = "genesis-junior-class";
export const GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_DISPLAY_NAME = "Genesis Acute First-Loss Class";

export const GENESIS_PROTECT_ACUTE_METADATA_URIS = {
  event7: "/metadata/protection/genesis-protect-acute-event-7-v1.json",
  travel30: "/metadata/protection/genesis-protect-acute-travel-30-v1.json",
} as const;

export const GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA: GenesisProtectAcuteEvidenceSchemaBinding = {
  schemaKey: GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_KEY,
  schemaVersion: GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_VERSION,
  schemaAuthority: "shared_public_contract",
};

export const GENESIS_PROTECT_ACUTE_LAUNCH_TRUTH: GenesisProtectAcuteLaunchTruth = {
  publicStatus: "end_of_month_mainnet_target",
  primaryLaunchSku: "travel30",
  fastDemoSku: "event7",
  claimsTrustPhase: "operator_backed_oracle_phase0",
  broadlyLiveInsurance: false,
  predictionMarketsCountAsReserve: false,
  appMembershipBillingSeparate: true,
};

export const GENESIS_PROTECT_ACUTE_SKUS: Record<GenesisProtectAcuteSkuKey, GenesisProtectAcuteSkuDefinition> = {
  event7: {
    key: "event7",
    seriesId: "genesis-event-7-v1",
    displayName: "Genesis Protect Acute - Event 7",
    metadataUri: GENESIS_PROTECT_ACUTE_METADATA_URIS.event7,
    comparabilityKey: "genesis-acute-event-7",
    coverWindowDays: 7,
    payoutCapUsd: 1_500,
    benefitStyle: "fixed_benefit_only",
    pricing: {
      retailUsd: 39,
      cohortUsdMin: 29,
      cohortUsdMax: 35,
    },
    benefitTiers: [
      {
        id: "tier_1",
        label: "Tier 1",
        trigger: "ER or urgent hospital evaluation with same-day discharge",
        benefitUsd: 150,
      },
      {
        id: "tier_2",
        label: "Tier 2",
        trigger: "Overnight admission",
        benefitUsd: 500,
      },
      {
        id: "tier_3",
        label: "Tier 3",
        trigger: "Surgery, ICU, or 2+ nights",
        benefitUsd: 1_500,
      },
    ],
    waitingPeriods: {
      illnessDays: 7,
      accidentHours: 24,
      sponsorCohortWaiverAllowed: true,
    },
    reimbursementPosture: "Fixed-benefit-only protection. No reimbursement top-up applies to Event 7.",
    evidenceSchema: GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA,
    fundingLineIds: {
      premium: "genesis-event7-premiums",
      sponsor: "genesis-event7-sponsor",
      liquidity: "genesis-event7-liquidity",
    },
    fundingLanes: {
      premium: {
        lineId: "genesis-event7-premiums",
        reserveRole: "Collected premiums attributed to the Event 7 reserve lane.",
      },
      sponsor: {
        lineId: "genesis-event7-sponsor",
        reserveRole: "Explicit sponsor subsidy or backstop capital for approved cohort issuance.",
      },
      liquidity: {
        lineId: "genesis-event7-liquidity",
        reserveRole: "Posted LP and backstop capital that supports Event 7 obligations.",
      },
    },
    issuanceControls: {
      reserveAttribution: "Only posted capital, collected premiums, and explicit sponsor or backstop funds count as claims-paying reserve.",
      publicStatusRule:
        "Keep Event 7 positioned as the fast-demo SKU for a bounded end-of-month mainnet launch target. Do not describe it as broadly live insurance today.",
      issueWhen: [
        "Event 7 reserve lanes are funded onchain or by explicit sponsor/backstop posting.",
        "Operator-backed claim review is staffed for the active issuance window.",
        "The shared public evidence schema stays aligned with the published metadata document.",
      ],
      pauseWhen: [
        "Posted reserve no longer covers the marketed issuance window.",
        "Claims operator or oracle staffing falls below the required phase-0 review readiness.",
        "Schema, pricing, or benefit truth drifts from the published Genesis metadata.",
      ],
    },
    launchTruth: GENESIS_PROTECT_ACUTE_LAUNCH_TRUTH,
  },
  travel30: {
    key: "travel30",
    seriesId: "genesis-travel-30-v1",
    displayName: "Genesis Protect Acute - Travel 30",
    metadataUri: GENESIS_PROTECT_ACUTE_METADATA_URIS.travel30,
    comparabilityKey: "genesis-acute-travel-30",
    coverWindowDays: 30,
    payoutCapUsd: 5_000,
    benefitStyle: "hybrid_fixed_plus_reimbursement",
    pricing: {
      retailUsd: 99,
      cohortUsdMin: 69,
      cohortUsdMax: 89,
      sponsorNote: "Sponsor pricing is negotiated for larger cohorts.",
    },
    benefitTiers: [
      {
        id: "tier_1",
        label: "Tier 1",
        trigger: "ER or urgent hospital evaluation with same-day discharge",
        benefitUsd: 250,
      },
      {
        id: "tier_2",
        label: "Tier 2",
        trigger: "Overnight admission",
        benefitUsd: 1_000,
      },
      {
        id: "tier_3",
        label: "Tier 3",
        trigger: "Surgery, ICU, or 2+ nights",
        benefitUsd: 2_500,
      },
    ],
    reimbursementTopUp: {
      aggregateCapUsd: 5_000,
      description: "Actual acute emergency medical spend above the fixed tier benefit, capped at the aggregate maximum.",
    },
    waitingPeriods: {
      illnessDays: 7,
      accidentHours: 24,
      sponsorCohortWaiverAllowed: true,
    },
    reimbursementPosture:
      "Hybrid fixed-benefit plus reimbursement top-up for acute emergency medical spend, capped at the aggregate maximum.",
    evidenceSchema: GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA,
    fundingLineIds: {
      premium: "genesis-travel30-premiums",
      liquidity: "genesis-travel30-liquidity",
    },
    fundingLanes: {
      premium: {
        lineId: "genesis-travel30-premiums",
        reserveRole: "Collected premiums attributed to the Travel 30 protection reserve lane.",
      },
      liquidity: {
        lineId: "genesis-travel30-liquidity",
        reserveRole: "Posted LP and backstop capital that supports Travel 30 obligations.",
      },
    },
    issuanceControls: {
      reserveAttribution: "Only posted capital, collected premiums, and explicit backstop funds count as claims-paying reserve.",
      publicStatusRule:
        "Keep Travel 30 positioned as the primary SKU for a bounded end-of-month mainnet launch target. Do not describe it as broadly live insurance today.",
      issueWhen: [
        "Travel 30 reserve lanes are funded onchain with published premium and liquidity support.",
        "Operator-backed claim review is staffed for the active issuance window.",
        "The shared public evidence schema stays aligned with the published metadata document.",
      ],
      pauseWhen: [
        "Posted reserve no longer covers the marketed issuance window.",
        "Claims operator or oracle staffing falls below the required phase-0 review readiness.",
        "Schema, pricing, or benefit truth drifts from the published Genesis metadata.",
      ],
    },
    launchTruth: GENESIS_PROTECT_ACUTE_LAUNCH_TRUTH,
  },
};

export const GENESIS_PROTECT_ACUTE_SKU_LIST = [
  GENESIS_PROTECT_ACUTE_SKUS.event7,
  GENESIS_PROTECT_ACUTE_SKUS.travel30,
] as const;

export const GENESIS_PROTECT_ACUTE_COMMON_EXCLUSIONS = [
  "chronic and pre-existing conditions",
  "pregnancy, maternity, fertility, and neonatal care",
  "routine outpatient and elective procedures",
  "preventive care, screening, wellness checks, and standard medication refills",
  "ongoing mental health treatment",
  "dental, optical, and hearing care unless a later trauma rider is added",
  "evacuation, repatriation, baggage, and trip cancellation",
  "substance-related events, self-harm, fraud, criminal acts, and sanctions-excluded scenarios",
] as const;
