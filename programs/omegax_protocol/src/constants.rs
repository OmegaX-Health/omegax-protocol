// SPDX-License-Identifier: AGPL-3.0-or-later

//! Public constants, seeds, mode values, and pause flags for the protocol surface.

use anchor_lang::prelude::*;

pub const MAX_ID_LEN: usize = 32;
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_LONG_NAME_LEN: usize = 96;
pub const MAX_URI_LEN: usize = 160;
pub const MAX_ORG_REF_LEN: usize = 64;
pub const MAX_ORACLE_SUPPORTED_SCHEMAS: usize = 16;
pub const MAX_SCHEMA_KEY_LEN: usize = 96;
pub const MAX_SCHEMA_DEPENDENCY_RULES: usize = 32;

pub const SEED_PROTOCOL_GOVERNANCE: &[u8] = b"protocol_governance";
pub const SEED_RESERVE_DOMAIN: &[u8] = b"reserve_domain";
pub const SEED_DOMAIN_ASSET_VAULT: &[u8] = b"domain_asset_vault";
pub const SEED_DOMAIN_ASSET_VAULT_TOKEN: &[u8] = b"domain_asset_vault_token";
pub const SEED_DOMAIN_ASSET_LEDGER: &[u8] = b"domain_asset_ledger";
pub const SEED_RESERVE_ASSET_RAIL: &[u8] = b"reserve_asset_rail";
pub const SEED_PROTOCOL_FEE_VAULT: &[u8] = b"protocol_fee_vault";
pub const SEED_POOL_TREASURY_VAULT: &[u8] = b"pool_treasury_vault";
pub const SEED_POOL_ORACLE_FEE_VAULT: &[u8] = b"pool_oracle_fee_vault";
pub const SEED_HEALTH_PLAN: &[u8] = b"health_plan";
pub const SEED_PLAN_RESERVE_LEDGER: &[u8] = b"plan_reserve_ledger";
pub const SEED_POLICY_SERIES: &[u8] = b"policy_series";
pub const SEED_SERIES_RESERVE_LEDGER: &[u8] = b"series_reserve_ledger";
pub const SEED_MEMBER_POSITION: &[u8] = b"member_position";
pub const SEED_MEMBERSHIP_ANCHOR_SEAT: &[u8] = b"membership_anchor_seat";
pub const SEED_FUNDING_LINE: &[u8] = b"funding_line";
pub const SEED_FUNDING_LINE_LEDGER: &[u8] = b"funding_line_ledger";
pub const SEED_COMMITMENT_CAMPAIGN: &[u8] = b"commitment_campaign";
pub const SEED_COMMITMENT_PAYMENT_RAIL: &[u8] = b"commitment_payment_rail";
pub const SEED_COMMITMENT_LEDGER: &[u8] = b"commitment_ledger";
pub const SEED_COMMITMENT_POSITION: &[u8] = b"commitment_position";
pub const SEED_CLAIM_CASE: &[u8] = b"claim_case";
pub const SEED_OBLIGATION: &[u8] = b"obligation";
pub const SEED_LIQUIDITY_POOL: &[u8] = b"liquidity_pool";
pub const SEED_CAPITAL_CLASS: &[u8] = b"capital_class";
pub const SEED_POOL_CLASS_LEDGER: &[u8] = b"pool_class_ledger";
pub const SEED_LP_POSITION: &[u8] = b"lp_position";
pub const SEED_ALLOCATION_POSITION: &[u8] = b"allocation_position";
pub const SEED_ALLOCATION_LEDGER: &[u8] = b"allocation_ledger";
pub const SEED_ORACLE_PROFILE: &[u8] = b"oracle_profile";
pub const SEED_POOL_ORACLE_APPROVAL: &[u8] = b"pool_oracle_approval";
pub const SEED_POOL_ORACLE_POLICY: &[u8] = b"pool_oracle_policy";
pub const SEED_POOL_ORACLE_PERMISSION_SET: &[u8] = b"pool_oracle_permission_set";
pub const SEED_OUTCOME_SCHEMA: &[u8] = b"outcome_schema";
pub const SEED_SCHEMA_DEPENDENCY_LEDGER: &[u8] = b"schema_dependency_ledger";
pub const SEED_CLAIM_ATTESTATION: &[u8] = b"claim_attestation";

pub const SERIES_MODE_REWARD: u8 = 0;
pub const SERIES_MODE_PROTECTION: u8 = 1;
pub const SERIES_MODE_REIMBURSEMENT: u8 = 2;
pub const SERIES_MODE_PARAMETRIC: u8 = 3;
pub const SERIES_MODE_OTHER: u8 = 255;

pub const SERIES_STATUS_DRAFT: u8 = 0;
pub const SERIES_STATUS_ACTIVE: u8 = 1;
pub const SERIES_STATUS_PAUSED: u8 = 2;
pub const SERIES_STATUS_CLOSED: u8 = 3;

pub const FUNDING_LINE_TYPE_SPONSOR_BUDGET: u8 = 0;
pub const FUNDING_LINE_TYPE_PREMIUM_INCOME: u8 = 1;
pub const FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION: u8 = 2;
pub const FUNDING_LINE_TYPE_BACKSTOP: u8 = 3;
pub const FUNDING_LINE_TYPE_SUBSIDY: u8 = 4;

pub const FUNDING_LINE_STATUS_OPEN: u8 = 0;
pub const FUNDING_LINE_STATUS_PAUSED: u8 = 1;
pub const FUNDING_LINE_STATUS_CLOSED: u8 = 2;

pub const COMMITMENT_MODE_DIRECT_PREMIUM: u8 = 0;
pub const COMMITMENT_MODE_TREASURY_CREDIT: u8 = 1;
pub const COMMITMENT_MODE_WATERFALL_RESERVE: u8 = 2;

pub const COMMITMENT_CAMPAIGN_STATUS_DRAFT: u8 = 0;
pub const COMMITMENT_CAMPAIGN_STATUS_ACTIVE: u8 = 1;
pub const COMMITMENT_CAMPAIGN_STATUS_PAUSED: u8 = 2;
pub const COMMITMENT_CAMPAIGN_STATUS_CANCELED: u8 = 3;
pub const COMMITMENT_CAMPAIGN_STATUS_CLOSED: u8 = 4;

pub const COMMITMENT_POSITION_PENDING: u8 = 0;
pub const COMMITMENT_POSITION_DIRECT_PREMIUM_ACTIVATED: u8 = 1;
pub const COMMITMENT_POSITION_TREASURY_LOCKED: u8 = 2;
pub const COMMITMENT_POSITION_REFUNDED: u8 = 3;
pub const COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED: u8 = 4;

pub const RESERVE_ASSET_ROLE_PRIMARY_STABLE: u8 = 0;
pub const RESERVE_ASSET_ROLE_SECONDARY_STABLE: u8 = 1;
pub const RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL: u8 = 2;
pub const RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT: u8 = 3;

pub const RESERVE_ORACLE_SOURCE_NONE: u8 = 0;
pub const RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_STREAM: u8 = 1;
pub const RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_FEED: u8 = 2;
pub const RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED: u8 = 3;

pub const ELIGIBILITY_PENDING: u8 = 0;
pub const ELIGIBILITY_ELIGIBLE: u8 = 1;
pub const ELIGIBILITY_PAUSED: u8 = 2;
pub const ELIGIBILITY_CLOSED: u8 = 3;

pub const MEMBERSHIP_MODE_OPEN: u8 = 0;
pub const MEMBERSHIP_MODE_TOKEN_GATE: u8 = 1;
pub const MEMBERSHIP_MODE_INVITE_ONLY: u8 = 2;

pub const MEMBERSHIP_GATE_KIND_OPEN: u8 = 0;
pub const MEMBERSHIP_GATE_KIND_INVITE_ONLY: u8 = 1;
pub const MEMBERSHIP_GATE_KIND_NFT_ANCHOR: u8 = 2;
pub const MEMBERSHIP_GATE_KIND_STAKE_ANCHOR: u8 = 3;
pub const MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT: u8 = 4;

pub const MEMBERSHIP_PROOF_MODE_OPEN: u8 = 0;
pub const MEMBERSHIP_PROOF_MODE_TOKEN_GATE: u8 = 1;
pub const MEMBERSHIP_PROOF_MODE_INVITE_PERMIT: u8 = 2;

pub const CLAIM_INTAKE_OPEN: u8 = 0;
pub const CLAIM_INTAKE_UNDER_REVIEW: u8 = 1;
pub const CLAIM_INTAKE_APPROVED: u8 = 2;
pub const CLAIM_INTAKE_DENIED: u8 = 3;
pub const CLAIM_INTAKE_SETTLED: u8 = 4;
pub const CLAIM_INTAKE_CLOSED: u8 = 5;

pub const CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE: u8 = 0;
pub const CLAIM_ATTESTATION_DECISION_SUPPORT_DENY: u8 = 1;
pub const CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW: u8 = 2;
pub const CLAIM_ATTESTATION_DECISION_ABSTAIN: u8 = 3;

pub const POOL_ORACLE_PERMISSION_ATTEST_CLAIM: u32 = 1 << 0;

pub const OBLIGATION_STATUS_PROPOSED: u8 = 0;
pub const OBLIGATION_STATUS_RESERVED: u8 = 1;
pub const OBLIGATION_STATUS_CLAIMABLE_PAYABLE: u8 = 2;
pub const OBLIGATION_STATUS_SETTLED: u8 = 3;
pub const OBLIGATION_STATUS_CANCELED: u8 = 4;
pub const OBLIGATION_STATUS_IMPAIRED: u8 = 5;
pub const OBLIGATION_STATUS_RECOVERED: u8 = 6;

pub const OBLIGATION_DELIVERY_MODE_CLAIMABLE: u8 = 0;
pub const OBLIGATION_DELIVERY_MODE_PAYABLE: u8 = 1;

pub const REDEMPTION_POLICY_OPEN: u8 = 0;
pub const REDEMPTION_POLICY_QUEUE_ONLY: u8 = 1;
pub const REDEMPTION_POLICY_PAUSED: u8 = 2;

pub const CAPITAL_CLASS_RESTRICTION_OPEN: u8 = 0;
pub const CAPITAL_CLASS_RESTRICTION_RESTRICTED: u8 = 1;
pub const CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY: u8 = 2;

pub const LP_QUEUE_STATUS_NONE: u8 = 0;
pub const LP_QUEUE_STATUS_PENDING: u8 = 1;
pub const LP_QUEUE_STATUS_PROCESSED: u8 = 2;

pub const ORACLE_TYPE_LAB: u8 = 0;
pub const ORACLE_TYPE_HOSPITAL_CLINIC: u8 = 1;
pub const ORACLE_TYPE_HEALTH_APP: u8 = 2;
pub const ORACLE_TYPE_WEARABLE_DATA_PROVIDER: u8 = 3;
pub const ORACLE_TYPE_OTHER: u8 = 255;

pub const SCHEMA_FAMILY_KERNEL: u8 = 0;
pub const SCHEMA_FAMILY_CLINICAL: u8 = 1;
pub const SCHEMA_FAMILY_CLAIMS_CODING: u8 = 2;

pub const SCHEMA_VISIBILITY_PUBLIC: u8 = 0;
pub const SCHEMA_VISIBILITY_PRIVATE: u8 = 1;
pub const SCHEMA_VISIBILITY_RESTRICTED: u8 = 2;

pub const PAUSE_FLAG_PROTOCOL_EMERGENCY: u32 = 1 << 0;
pub const PAUSE_FLAG_DOMAIN_RAILS: u32 = 1 << 1;
pub const PAUSE_FLAG_PLAN_OPERATIONS: u32 = 1 << 2;
pub const PAUSE_FLAG_CLAIM_INTAKE: u32 = 1 << 3;
pub const PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS: u32 = 1 << 4;
pub const PAUSE_FLAG_REDEMPTION_QUEUE_ONLY: u32 = 1 << 5;
pub const PAUSE_FLAG_ORACLE_FINALITY_HOLD: u32 = 1 << 6;
pub const PAUSE_FLAG_ALLOCATION_FREEZE: u32 = 1 << 7;

pub const ZERO_PUBKEY: Pubkey = Pubkey::new_from_array([0u8; 32]);

// Native SOL "mint" sentinel used by fee-vault rails to distinguish lamport
// accounting from SPL token accounting. Matches `spl_token::native_mint::ID`
// (canonical wrapped-SOL mint). For SOL fee vaults the lamports physically
// reside on the fee-vault PDA itself and `transfer_lamports_from_fee_vault`
// drains them with rent-exemption preserved. For SPL fee vaults the tokens
// physically reside in the matching `DomainAssetVault.vault_token_account`
// and `transfer_from_domain_vault` (PDA-signed) drains them.
pub const NATIVE_SOL_MINT: Pubkey = anchor_spl::token::spl_token::native_mint::ID;
