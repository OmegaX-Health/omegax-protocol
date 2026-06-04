// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";

export const BPF_UPGRADEABLE_LOADER_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);

export const ZERO_PUBKEY = "11111111111111111111111111111111";
export const ZERO_PUBKEY_KEY = new PublicKey(ZERO_PUBKEY);

export const MAX_ID_SEED_BYTES = 32;

export const SEED_PROTOCOL_GOVERNANCE = "protocol_governance";
export const SEED_RESERVE_DOMAIN = "reserve_domain";
export const SEED_DOMAIN_ASSET_VAULT = "domain_asset_vault";
export const SEED_DOMAIN_ASSET_VAULT_TOKEN = "domain_asset_vault_token";
export const SEED_DOMAIN_ASSET_LEDGER = "domain_asset_ledger";
export const SEED_HEALTH_PLAN = "health_plan";
export const SEED_PLAN_RESERVE_LEDGER = "plan_reserve_ledger";
export const SEED_POLICY_SERIES = "policy_series";
export const SEED_MEMBER_POSITION = "member_position";
export const SEED_MEMBERSHIP_ANCHOR_SEAT = "membership_anchor_seat";
export const SEED_FUNDING_LINE = "funding_line";
export const SEED_FUNDING_LINE_LEDGER = "funding_line_ledger";
export const SEED_CLAIM_CASE = "claim_case";
export const SEED_OBLIGATION = "obligation";
export const SEED_LIQUIDITY_POOL = "liquidity_pool";
export const SEED_CAPITAL_CLASS = "capital_class";
export const SEED_POOL_CLASS_LEDGER = "pool_class_ledger";
export const SEED_LP_POSITION = "lp_position";
export const SEED_ALLOCATION_POSITION = "allocation_position";
export const SEED_ALLOCATION_LEDGER = "allocation_ledger";
export const SEED_ORACLE_PROFILE = "oracle_profile";

export const CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE = 0;
export const CLAIM_ATTESTATION_DECISION_SUPPORT_DENY = 1;
export const CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW = 2;
export const CLAIM_ATTESTATION_DECISION_ABSTAIN = 3;

export const MEMBERSHIP_MODE_OPEN = 0;
export const MEMBERSHIP_MODE_TOKEN_GATE = 1;
export const MEMBERSHIP_MODE_INVITE_ONLY = 2;

export const MEMBERSHIP_GATE_KIND_OPEN = 0;
export const MEMBERSHIP_GATE_KIND_INVITE_ONLY = 1;
export const MEMBERSHIP_GATE_KIND_NFT_ANCHOR = 2;
export const MEMBERSHIP_GATE_KIND_STAKE_ANCHOR = 3;
export const MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT = 4;

export const MEMBERSHIP_PROOF_MODE_OPEN = 0;
export const MEMBERSHIP_PROOF_MODE_TOKEN_GATE = 1;
export const MEMBERSHIP_PROOF_MODE_INVITE_PERMIT = 2;

export const SERIES_MODE_REWARD = 0;
export const SERIES_MODE_PROTECTION = 1;
export const SERIES_MODE_REIMBURSEMENT = 2;
export const SERIES_MODE_PARAMETRIC = 3;
export const SERIES_MODE_OTHER = 255;

export const SERIES_STATUS_DRAFT = 0;
export const SERIES_STATUS_ACTIVE = 1;
export const SERIES_STATUS_PAUSED = 2;
export const SERIES_STATUS_CLOSED = 3;

export const FUNDING_LINE_TYPE_SPONSOR_BUDGET = 0;
export const FUNDING_LINE_TYPE_PREMIUM_INCOME = 1;
export const FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION = 2;
export const FUNDING_LINE_TYPE_BACKSTOP = 3;
export const FUNDING_LINE_TYPE_SUBSIDY = 4;

export const FUNDING_LINE_STATUS_OPEN = 0;
export const FUNDING_LINE_STATUS_PAUSED = 1;
export const FUNDING_LINE_STATUS_CLOSED = 2;

export const ELIGIBILITY_PENDING = 0;
export const ELIGIBILITY_ELIGIBLE = 1;
export const ELIGIBILITY_PAUSED = 2;
export const ELIGIBILITY_CLOSED = 3;

export const CLAIM_INTAKE_OPEN = 0;
export const CLAIM_INTAKE_UNDER_REVIEW = 1;
export const CLAIM_INTAKE_APPROVED = 2;
export const CLAIM_INTAKE_DENIED = 3;
export const CLAIM_INTAKE_SETTLED = 4;
export const CLAIM_INTAKE_CLOSED = 5;

export const OBLIGATION_STATUS_PROPOSED = 0;
export const OBLIGATION_STATUS_RESERVED = 1;
export const OBLIGATION_STATUS_CLAIMABLE_PAYABLE = 2;
export const OBLIGATION_STATUS_SETTLED = 3;
export const OBLIGATION_STATUS_CANCELED = 4;
export const OBLIGATION_STATUS_IMPAIRED = 5;
export const OBLIGATION_STATUS_RECOVERED = 6;

export const OBLIGATION_DELIVERY_MODE_CLAIMABLE = 0;
export const OBLIGATION_DELIVERY_MODE_PAYABLE = 1;

export const REDEMPTION_POLICY_OPEN = 0;
export const REDEMPTION_POLICY_QUEUE_ONLY = 1;
export const REDEMPTION_POLICY_PAUSED = 2;

export const CAPITAL_CLASS_RESTRICTION_OPEN = 0;
export const CAPITAL_CLASS_RESTRICTION_RESTRICTED = 1;
export const CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY = 2;

export const LP_QUEUE_STATUS_NONE = 0;
export const LP_QUEUE_STATUS_PENDING = 1;
export const LP_QUEUE_STATUS_PROCESSED = 2;

export const ORACLE_TYPE_LAB = 0;
export const ORACLE_TYPE_HOSPITAL_CLINIC = 1;
export const ORACLE_TYPE_HEALTH_APP = 2;
export const ORACLE_TYPE_WEARABLE_DATA_PROVIDER = 3;
export const ORACLE_TYPE_OTHER = 255;

export const SCHEMA_FAMILY_KERNEL = 0;
export const SCHEMA_FAMILY_CLINICAL = 1;
export const SCHEMA_FAMILY_CLAIMS_CODING = 2;

export const SCHEMA_VISIBILITY_PUBLIC = 0;
export const SCHEMA_VISIBILITY_PRIVATE = 1;
export const SCHEMA_VISIBILITY_RESTRICTED = 2;

export const PAUSE_FLAG_PROTOCOL_EMERGENCY = 1 << 0;
export const PAUSE_FLAG_DOMAIN_RAILS = 1 << 1;
export const PAUSE_FLAG_PLAN_OPERATIONS = 1 << 2;
export const PAUSE_FLAG_CLAIM_INTAKE = 1 << 3;
export const PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS = 1 << 4;
export const PAUSE_FLAG_REDEMPTION_QUEUE_ONLY = 1 << 5;
export const PAUSE_FLAG_ORACLE_FINALITY_HOLD = 1 << 6;
export const PAUSE_FLAG_ALLOCATION_FREEZE = 1 << 7;
