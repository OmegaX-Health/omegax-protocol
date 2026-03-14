// SPDX-License-Identifier: AGPL-3.0-or-later

//! v2 protocol surface and module index for the OmegaX program.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked, ID as INSTRUCTIONS_SYSVAR_ID,
};
use anchor_lang::system_program::{self, Transfer as SystemTransfer};
use anchor_spl::associated_token::{self, AssociatedToken};
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer as TokenTransfer};
use solana_sdk_ids::ed25519_program;
use solana_sha256_hasher::hashv;

use crate::{
    MembershipRecord, OracleProfile, OracleRegistryEntry, Pool, PoolOracleApproval,
    MAX_COVERAGE_PRODUCT_NAME_LEN, MAX_METADATA_URI_LEN, MAX_ORACLE_DISPLAY_NAME_LEN,
    MAX_ORACLE_LEGAL_NAME_LEN, MAX_ORACLE_LOGO_URI_LEN, MAX_ORACLE_SUPPORTED_SCHEMAS,
    MAX_ORACLE_URL_LEN, MAX_ORACLE_WEBHOOK_URL_LEN, MAX_ORG_REF_LEN, MAX_POOL_ID_LEN,
    MAX_PROTOCOL_FEE_BPS, MEMBERSHIP_MODE_INVITE_ONLY, MEMBERSHIP_MODE_OPEN,
    MEMBERSHIP_MODE_TOKEN_GATE, MEMBERSHIP_STATUS_ACTIVE, POOL_STATUS_ACTIVE, POOL_STATUS_CLOSED,
    POOL_STATUS_DRAFT, SEED_MEMBERSHIP, SEED_POOL, SEED_POOL_ORACLE,
};

mod state;
pub use state::*;

mod errors;
pub use errors::*;

mod contexts;
pub use contexts::*;

mod shared;
pub(crate) use shared::*;

mod events;
pub use events::*;

mod admin;
pub use admin::*;

mod pools;
pub use pools::*;

mod rewards;
pub use rewards::*;

mod coverage;
pub use coverage::*;

mod cycles;
pub use cycles::*;

mod treasury;
pub use treasury::*;

pub const SEED_CONFIG_V2: &[u8] = b"config_v2";
pub const SEED_ORACLE_STAKE: &[u8] = b"oracle_stake";
pub const SEED_POOL_ORACLE_POLICY: &[u8] = b"pool_oracle_policy";
pub const SEED_POOL_TERMS: &[u8] = b"pool_terms";
pub const SEED_POOL_ASSET_VAULT: &[u8] = b"pool_asset_vault";
pub const SEED_POOL_RISK_CONFIG: &[u8] = b"pool_risk_config";
pub const SEED_POOL_CAPITAL_CLASS: &[u8] = b"pool_capital_class";
pub const SEED_POLICY_SERIES: &[u8] = b"policy_series";
pub const SEED_POLICY_SERIES_PAYMENT_OPTION: &[u8] = b"policy_series_payment_option";
pub const SEED_POLICY_POSITION: &[u8] = b"policy_position";
pub const SEED_POLICY_POSITION_NFT: &[u8] = b"policy_position_nft";
pub const SEED_POOL_COMPLIANCE_POLICY: &[u8] = b"pool_compliance_policy";
pub const SEED_POOL_CONTROL_AUTHORITY: &[u8] = b"pool_control_authority";
pub const SEED_POOL_AUTOMATION_POLICY: &[u8] = b"pool_automation_policy";
pub const SEED_REDEMPTION_REQUEST: &[u8] = b"redemption_request";
const SEED_POOL_LIQUIDITY_CONFIG: &[u8] = crate::SEED_POOL_LIQUIDITY_CONFIG;
const SEED_POOL_SHARE_MINT: &[u8] = crate::SEED_POOL_SHARE_MINT;
pub const SEED_SCHEMA: &[u8] = b"schema";
pub const SEED_SCHEMA_DEPENDENCY: &[u8] = b"schema_dependency";
pub const SEED_POOL_RULE: &[u8] = b"pool_rule";
pub const SEED_INVITE_ISSUER: &[u8] = b"invite_issuer";
pub const SEED_ENROLLMENT_REPLAY: &[u8] = b"enrollment_replay";
pub const SEED_ATTESTATION_VOTE: &[u8] = b"attestation_vote";
pub const SEED_OUTCOME_AGGREGATE: &[u8] = b"outcome_agg";
pub const SEED_CLAIM_DELEGATE: &[u8] = b"claim_delegate";
pub const SEED_CLAIM_V2: &[u8] = b"claim_v2";
pub const SEED_PREMIUM_LEDGER: &[u8] = b"premium_ledger";
pub const SEED_PREMIUM_REPLAY: &[u8] = b"premium_replay";
pub const SEED_COVERAGE_CLAIM: &[u8] = b"coverage_claim";
pub const SEED_POOL_ORACLE_PERMISSIONS: &[u8] = b"pool_oracle_permissions";
pub const SEED_MEMBER_CYCLE: &[u8] = b"member_cycle";
pub const SEED_CYCLE_QUOTE_REPLAY: &[u8] = b"cycle_quote_replay";
pub const SEED_POOL_TREASURY_RESERVE: &[u8] = b"pool_treasury_reserve";
pub const SEED_COHORT_SETTLEMENT_ROOT: &[u8] = b"cohort_settlement_root";
pub const SEED_PROTOCOL_FEE_VAULT: &[u8] = b"protocol_fee_vault";
pub const SEED_POOL_ORACLE_FEE_VAULT: &[u8] = b"pool_oracle_fee_vault";

pub const POOL_TYPE_REWARD: u8 = 0;
pub const POOL_TYPE_COVERAGE: u8 = 1;
pub const POOL_REDEMPTION_MODE_OPEN: u8 = 0;
pub const POOL_REDEMPTION_MODE_QUEUE_ONLY: u8 = 1;
pub const POOL_REDEMPTION_MODE_PAUSED: u8 = 2;
pub const POOL_CLAIM_MODE_OPEN: u8 = 0;
pub const POOL_CLAIM_MODE_PAUSED: u8 = 1;
pub const CAPITAL_CLASS_MODE_NAV: u8 = 0;
pub const CAPITAL_CLASS_MODE_DISTRIBUTION: u8 = 1;
pub const CAPITAL_CLASS_MODE_HYBRID: u8 = 2;
pub const CAPITAL_TRANSFER_MODE_PERMISSIONLESS: u8 = 0;
pub const CAPITAL_TRANSFER_MODE_RESTRICTED: u8 = 1;
pub const CAPITAL_TRANSFER_MODE_WRAPPER_ONLY: u8 = 2;
pub const PLAN_MODE_REWARD: u8 = 0;
pub const PLAN_MODE_PROTECTION: u8 = 1;
pub const PLAN_MODE_REIMBURSEMENT: u8 = 2;
pub const PLAN_MODE_REGULATED: u8 = 3;
pub const POLICY_SERIES_STATUS_DRAFT: u8 = 0;
pub const POLICY_SERIES_STATUS_ACTIVE: u8 = 1;
pub const POLICY_SERIES_STATUS_PAUSED: u8 = 2;
pub const POLICY_SERIES_STATUS_CLOSED: u8 = 3;
pub const SPONSOR_MODE_DIRECT: u8 = 0;
pub const SPONSOR_MODE_WRAPPER: u8 = 1;
pub const SPONSOR_MODE_CARRIER: u8 = 2;
pub const SCHEMA_FAMILY_KERNEL: u8 = 0;
pub const SCHEMA_FAMILY_CLINICAL: u8 = 1;
pub const SCHEMA_FAMILY_CLAIMS_CODING: u8 = 2;
pub const SCHEMA_VISIBILITY_PUBLIC: u8 = 0;
pub const SCHEMA_VISIBILITY_PRIVATE: u8 = 1;
pub const SCHEMA_VISIBILITY_RESTRICTED: u8 = 2;
pub const COMPLIANCE_ACTION_ENROLL: u16 = 1 << 0;
pub const COMPLIANCE_ACTION_CLAIM: u16 = 1 << 1;
pub const COMPLIANCE_ACTION_REDEEM: u16 = 1 << 2;
pub const COMPLIANCE_ACTION_DEPOSIT: u16 = 1 << 3;
pub const COMPLIANCE_ACTION_PAYOUT: u16 = 1 << 4;
pub const COMPLIANCE_BINDING_MODE_NONE: u8 = 0;
pub const COMPLIANCE_BINDING_MODE_WALLET: u8 = 1;
pub const COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT: u8 = 2;
pub const COMPLIANCE_BINDING_MODE_TOKEN_GATE: u8 = 3;
pub const COMPLIANCE_PROVIDER_MODE_NATIVE: u8 = 0;
pub const COMPLIANCE_PROVIDER_MODE_EXTERNAL: u8 = 1;
pub const COMPLIANCE_PROVIDER_MODE_SOLANA_ATTEST: u8 = 2;
pub const RAIL_MODE_ANY: u8 = 0;
pub const RAIL_MODE_SPL_ONLY: u8 = 1;
pub const RAIL_MODE_PERMISSIONED_SPL: u8 = 2;
pub const AUTOMATION_MODE_DISABLED: u8 = 0;
pub const AUTOMATION_MODE_ADVISORY: u8 = 1;
pub const AUTOMATION_MODE_ATTESTED: u8 = 2;
pub const AUTOMATION_MODE_BOUNDED_AUTONOMOUS: u8 = 3;
pub const AI_ROLE_NONE: u8 = 0;
pub const AI_ROLE_UNDERWRITER: u8 = 1;
pub const AI_ROLE_PRICING_AGENT: u8 = 2;
pub const AI_ROLE_CLAIM_PROCESSOR: u8 = 3;
pub const AI_ROLE_SETTLEMENT_PLANNER: u8 = 4;
pub const AI_ROLE_ORACLE: u8 = 5;
pub const AI_ROLE_ALL_MASK: u16 = (1 << AI_ROLE_UNDERWRITER)
    | (1 << AI_ROLE_PRICING_AGENT)
    | (1 << AI_ROLE_CLAIM_PROCESSOR)
    | (1 << AI_ROLE_SETTLEMENT_PLANNER)
    | (1 << AI_ROLE_ORACLE);
pub const OUTCOME_REVIEW_STATUS_CLEAR: u8 = 0;
pub const OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE: u8 = 1;
pub const OUTCOME_REVIEW_STATUS_CHALLENGED: u8 = 2;
pub const OUTCOME_REVIEW_STATUS_OVERTURNED: u8 = 3;
pub const REDEMPTION_REQUEST_STATUS_PENDING: u8 = 1;
pub const REDEMPTION_REQUEST_STATUS_SCHEDULED: u8 = 2;
pub const REDEMPTION_REQUEST_STATUS_FULFILLED: u8 = 3;
pub const REDEMPTION_REQUEST_STATUS_CANCELLED: u8 = 4;
pub const REDEMPTION_REQUEST_STATUS_FAILED: u8 = 5;

pub const COVERAGE_STATUS_ACTIVE: u8 = 1;
pub const COVERAGE_STATUS_DELINQUENT: u8 = 2;
pub const COVERAGE_STATUS_EXPIRED: u8 = 3;

pub const COVERAGE_CLAIM_STATUS_SUBMITTED: u8 = 1;
pub const COVERAGE_CLAIM_STATUS_UNDER_REVIEW: u8 = 2;
pub const COVERAGE_CLAIM_STATUS_APPROVED: u8 = 3;
pub const COVERAGE_CLAIM_STATUS_PAID: u8 = 4;
pub const COVERAGE_CLAIM_STATUS_DENIED: u8 = 5;
pub const COVERAGE_CLAIM_STATUS_CLOSED: u8 = 6;
pub const COVERAGE_CLAIM_STATUS_PARTIALLY_PAID: u8 = 7;
pub const COVERAGE_CLAIM_STATUS_SETTLED: u8 = COVERAGE_CLAIM_STATUS_PAID;
pub const COVERAGE_CLAIM_FAMILY_FAST: u8 = 0;
pub const COVERAGE_CLAIM_FAMILY_REIMBURSEMENT: u8 = 1;
pub const COVERAGE_CLAIM_FAMILY_REGULATED: u8 = 2;

pub const PREMIUM_SOURCE_ONCHAIN: u8 = 1;
pub const PREMIUM_SOURCE_OFFCHAIN_ATTESTED: u8 = 2;
pub const MEMBER_CYCLE_STATUS_ACTIVE: u8 = 1;
pub const MEMBER_CYCLE_STATUS_SETTLED: u8 = 2;
pub const ORACLE_PERMISSION_DATA_ATTEST: u32 = 1 << 0;
pub const ORACLE_PERMISSION_QUOTE: u32 = 1 << 1;
pub const ORACLE_PERMISSION_CYCLE_SETTLE: u32 = 1 << 2;
pub const ORACLE_PERMISSION_CLAIM_SETTLE: u32 = 1 << 3;
pub const ORACLE_PERMISSION_TREASURY_WITHDRAW: u32 = 1 << 4;
pub const ORACLE_PERMISSION_FEE_WITHDRAW: u32 = 1 << 5;
pub const ORACLE_PERMISSION_ALL: u32 = ORACLE_PERMISSION_DATA_ATTEST
    | ORACLE_PERMISSION_QUOTE
    | ORACLE_PERMISSION_CYCLE_SETTLE
    | ORACLE_PERMISSION_CLAIM_SETTLE
    | ORACLE_PERMISSION_TREASURY_WITHDRAW
    | ORACLE_PERMISSION_FEE_WITHDRAW;
pub const ORACLE_ROLE_QUOTE_ATTESTER: u8 = 1;
pub const ORACLE_ROLE_OUTCOME_ATTESTER: u8 = 2;
pub const ORACLE_ROLE_PREMIUM_ATTESTER: u8 = 3;
pub const ORACLE_ROLE_CLAIM_ADJUDICATOR: u8 = 4;
pub const ORACLE_ROLE_TREASURY_OPERATOR: u8 = 5;

pub const ZERO_PUBKEY_BYTES: [u8; 32] = [0u8; 32];
pub const ZERO_PUBKEY: Pubkey = Pubkey::new_from_array([0u8; 32]);
pub const ORACLE_TYPE_LAB: u8 = 0;
pub const ORACLE_TYPE_HOSPITAL_CLINIC: u8 = 1;
pub const ORACLE_TYPE_HEALTH_APP: u8 = 2;
pub const ORACLE_TYPE_WEARABLE_DATA_PROVIDER: u8 = 3;
pub const ORACLE_TYPE_OTHER: u8 = 4;
