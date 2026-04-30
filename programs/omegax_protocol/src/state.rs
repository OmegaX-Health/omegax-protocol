// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account state and serializable reserve-accounting structs.

use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProtocolGovernance {
    pub governance_authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub emergency_pause: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReserveDomain {
    pub protocol_governance: Pubkey,
    pub domain_admin: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub domain_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub settlement_mode: u8,
    pub legal_structure_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub allowed_rail_mask: u16,
    pub pause_flags: u32,
    pub active: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DomainAssetVault {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub total_assets: u64,
    pub bump: u8,
}

// Fee accounting account types. SPL tokens for fees physically reside in the
// matching DomainAssetVault.vault_token_account; these accounts track each
// rail's claim against that pool. Withdrawals decrement `withdrawn_fees` and
// transfer SPL out of DomainAssetVault via PDA-signed CPI.

#[account]
#[derive(InitSpace)]
pub struct ProtocolFeeVault {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub fee_recipient: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolTreasuryVault {
    pub liquidity_pool: Pubkey,
    pub asset_mint: Pubkey,
    pub fee_recipient: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOracleFeeVault {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub asset_mint: Pubkey,
    pub fee_recipient: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HealthPlan {
    pub reserve_domain: Pubkey,
    pub sponsor: Pubkey,
    pub plan_admin: Pubkey,
    pub sponsor_operator: Pubkey,
    pub claims_operator: Pubkey,
    pub oracle_authority: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub health_plan_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_ORG_REF_LEN)]
    pub organization_ref: String,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub membership_mode: u8,
    pub membership_gate_kind: u8,
    pub membership_gate_mint: Pubkey,
    pub membership_gate_min_amount: u64,
    pub membership_invite_authority: Pubkey,
    pub allowed_rail_mask: u16,
    pub default_funding_priority: u8,
    pub oracle_policy_hash: [u8; 32],
    pub schema_binding_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub pause_flags: u32,
    pub active: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PolicySeries {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub asset_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub series_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub mode: u8,
    pub status: u8,
    pub adjudication_mode: u8,
    pub terms_hash: [u8; 32],
    pub pricing_hash: [u8; 32],
    pub payout_hash: [u8; 32],
    pub reserve_model_hash: [u8; 32],
    pub evidence_requirements_hash: [u8; 32],
    pub comparability_hash: [u8; 32],
    pub policy_overrides_hash: [u8; 32],
    pub cycle_seconds: i64,
    pub terms_version: u16,
    pub prior_series: Pubkey,
    pub successor_series: Pubkey,
    pub live_since_ts: i64,
    pub material_locked: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MemberPosition {
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub wallet: Pubkey,
    pub subject_commitment: [u8; 32],
    pub eligibility_status: u8,
    pub delegated_rights: u32,
    pub enrollment_proof_mode: u8,
    pub membership_gate_kind: u8,
    pub membership_anchor_ref: Pubkey,
    pub gate_amount_snapshot: u64,
    pub invite_id_hash: [u8; 32],
    pub active: bool,
    pub opened_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MembershipAnchorSeat {
    pub health_plan: Pubkey,
    pub anchor_ref: Pubkey,
    pub gate_kind: u8,
    pub holder_wallet: Pubkey,
    pub member_position: Pubkey,
    pub active: bool,
    pub opened_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FundingLine {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub line_id: String,
    pub line_type: u8,
    pub funding_priority: u8,
    pub committed_amount: u64,
    pub funded_amount: u64,
    pub reserved_amount: u64,
    pub spent_amount: u64,
    pub released_amount: u64,
    pub returned_amount: u64,
    pub status: u8,
    pub caps_hash: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimCase {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub member_position: Pubkey,
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub claim_id: String,
    pub claimant: Pubkey,
    pub adjudicator: Pubkey,
    // PT-2026-04-27-04 design: when settlement transfers SPL out, the recipient
    // is `delegate_recipient` if non-zero, else `member_position.wallet`. The
    // `claimant` field above is informational metadata constrained to equal
    // `member_position.wallet` at intake (see require_claim_intake_submitter);
    // routing is exclusively controlled here, set by the member via
    // `authorize_claim_recipient`. ZERO_PUBKEY means "pay member.wallet".
    pub delegate_recipient: Pubkey,
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
    pub intake_status: u8,
    pub review_state: u8,
    pub approved_amount: u64,
    pub denied_amount: u64,
    pub paid_amount: u64,
    pub reserved_amount: u64,
    pub recovered_amount: u64,
    pub appeal_count: u16,
    pub linked_obligation: Pubkey,
    pub opened_at: i64,
    pub updated_at: i64,
    pub closed_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Obligation {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub member_wallet: Pubkey,
    pub beneficiary: Pubkey,
    pub funding_line: Pubkey,
    pub claim_case: Pubkey,
    pub liquidity_pool: Pubkey,
    pub capital_class: Pubkey,
    pub allocation_position: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub obligation_id: String,
    pub creation_reason_hash: [u8; 32],
    pub settlement_reason_hash: [u8; 32],
    pub status: u8,
    pub delivery_mode: u8,
    pub principal_amount: u64,
    pub outstanding_amount: u64,
    pub reserved_amount: u64,
    pub claimable_amount: u64,
    pub payable_amount: u64,
    pub settled_amount: u64,
    pub impaired_amount: u64,
    pub recovered_amount: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LiquidityPool {
    pub reserve_domain: Pubkey,
    pub curator: Pubkey,
    pub allocator: Pubkey,
    pub sentinel: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub pool_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub deposit_asset_mint: Pubkey,
    pub strategy_hash: [u8; 32],
    pub allowed_exposure_hash: [u8; 32],
    pub external_yield_adapter_hash: [u8; 32],
    pub fee_bps: u16,
    pub redemption_policy: u8,
    pub pause_flags: u32,
    pub total_value_locked: u64,
    pub total_allocated: u64,
    pub total_reserved: u64,
    pub total_impaired: u64,
    pub total_pending_redemptions: u64,
    pub active: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CapitalClass {
    pub reserve_domain: Pubkey,
    pub liquidity_pool: Pubkey,
    pub share_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub class_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub priority: u8,
    pub impairment_rank: u8,
    pub restriction_mode: u8,
    pub redemption_terms_mode: u8,
    pub wrapper_metadata_hash: [u8; 32],
    pub permissioning_hash: [u8; 32],
    pub fee_bps: u16,
    pub min_lockup_seconds: i64,
    pub pause_flags: u32,
    pub queue_only_redemptions: bool,
    pub total_shares: u64,
    pub nav_assets: u64,
    pub allocated_assets: u64,
    pub reserved_assets: u64,
    pub impaired_assets: u64,
    pub pending_redemptions: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LPPosition {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub subscription_basis: u64,
    pub pending_redemption_shares: u64,
    pub pending_redemption_assets: u64,
    pub realized_distributions: u64,
    pub impaired_principal: u64,
    pub lockup_ends_at: i64,
    pub credentialed: bool,
    pub queue_status: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AllocationPosition {
    pub reserve_domain: Pubkey,
    pub liquidity_pool: Pubkey,
    pub capital_class: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub funding_line: Pubkey,
    pub cap_amount: u64,
    pub weight_bps: u16,
    pub allocation_mode: u8,
    pub allocated_amount: u64,
    pub utilized_amount: u64,
    pub reserved_capacity: u64,
    pub realized_pnl: i64,
    pub impaired_amount: u64,
    pub deallocation_only: bool,
    pub active: bool,
    pub bump: u8,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, PartialEq, Eq, InitSpace,
)]
pub struct ReserveBalanceSheet {
    pub funded: u64,
    pub allocated: u64,
    pub reserved: u64,
    pub owed: u64,
    pub claimable: u64,
    pub payable: u64,
    pub settled: u64,
    pub impaired: u64,
    pub pending_redemption: u64,
    pub restricted: u64,
    pub free: u64,
    pub redeemable: u64,
}

#[account]
#[derive(InitSpace)]
pub struct DomainAssetLedger {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlanReserveLedger {
    pub health_plan: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SeriesReserveLedger {
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FundingLineLedger {
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolClassLedger {
    pub capital_class: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub total_shares: u64,
    pub realized_yield_amount: u64,
    pub realized_loss_amount: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AllocationLedger {
    pub allocation_position: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub realized_pnl: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OracleProfile {
    pub oracle: Pubkey,
    pub admin: Pubkey,
    pub oracle_type: u8,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_LONG_NAME_LEN)]
    pub legal_name: String,
    #[max_len(MAX_URI_LEN)]
    pub website_url: String,
    #[max_len(MAX_URI_LEN)]
    pub app_url: String,
    #[max_len(MAX_URI_LEN)]
    pub logo_uri: String,
    #[max_len(MAX_URI_LEN)]
    pub webhook_url: String,
    pub supported_schema_count: u8,
    pub supported_schema_key_hashes: [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS],
    pub active: bool,
    pub claimed: bool,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOracleApproval {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub active: bool,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOraclePolicy {
    pub liquidity_pool: Pubkey,
    pub quorum_m: u8,
    pub quorum_n: u8,
    pub require_verified_schema: bool,
    pub oracle_fee_bps: u16,
    pub allow_delegate_claim: bool,
    pub challenge_window_secs: u32,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOraclePermissionSet {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub permissions: u32,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimAttestation {
    pub oracle: Pubkey,
    pub oracle_profile: Pubkey,
    pub claim_case: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub decision: u8,
    pub attestation_hash: [u8; 32],
    pub attestation_ref_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OutcomeSchema {
    pub publisher: Pubkey,
    pub schema_key_hash: [u8; 32],
    #[max_len(MAX_SCHEMA_KEY_LEN)]
    pub schema_key: String,
    pub version: u16,
    pub schema_hash: [u8; 32],
    pub schema_family: u8,
    pub visibility: u8,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub verified: bool,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SchemaDependencyLedger {
    pub schema_key_hash: [u8; 32],
    #[max_len(MAX_SCHEMA_DEPENDENCY_RULES)]
    pub pool_rule_addresses: Vec<Pubkey>,
    pub updated_at_ts: i64,
    pub bump: u8,
}
