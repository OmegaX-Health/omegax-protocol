// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account state and serializable reserve-accounting structs.

use crate::constants::*;
use crate::platform::*;

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [71, 235, 253, 251, 202, 254, 132, 177]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct ProtocolGovernance {
    pub governance_authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub emergency_pause: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [119, 76, 223, 192, 177, 116, 88, 178])]
pub struct ReserveDomain<'info> {
    pub protocol_governance: Pubkey,
    pub domain_admin: Pubkey,
    pub settlement_mode: u8,
    pub legal_structure_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub allowed_rail_mask: u16,
    pub pause_flags: u32,
    pub active: bool,
    pub audit_nonce: u64,
    pub bump: u8,
    pub domain_id: String<u32, 32>,
    pub display_name: String<u32, 64>,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [105, 110, 75, 179, 247, 58, 135, 229]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct DomainAssetVault {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub total_assets: u64,
    pub bump: u8,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct ReserveAssetRail {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub oracle_authority: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub asset_symbol: String,
    pub role: u8,
    pub payout_priority: u8,
    pub oracle_source: u8,
    pub oracle_feed_id: [u8; 32],
    pub max_staleness_seconds: i64,
    pub max_confidence_bps: u16,
    pub haircut_bps: u16,
    pub max_exposure_bps: u16,
    pub deposit_enabled: bool,
    pub payout_enabled: bool,
    pub capacity_enabled: bool,
    pub active: bool,
    pub last_price_usd_1e8: u64,
    pub last_price_confidence_bps: u16,
    pub last_price_published_at_ts: i64,
    pub last_price_slot: u64,
    pub last_price_proof_hash: [u8; 32],
    pub audit_nonce: u64,
    pub bump: u8,
}

#[cfg(feature = "quasar")]
#[account(discriminator = [48, 92, 233, 170, 158, 126, 122, 67])]
pub struct ReserveAssetRail<'info> {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub oracle_authority: Pubkey,
    pub role: u8,
    pub payout_priority: u8,
    pub oracle_source: u8,
    pub oracle_feed_id: [u8; 32],
    pub max_staleness_seconds: i64,
    pub max_confidence_bps: u16,
    pub haircut_bps: u16,
    pub max_exposure_bps: u16,
    pub deposit_enabled: bool,
    pub payout_enabled: bool,
    pub capacity_enabled: bool,
    pub active: bool,
    pub last_price_usd_1e8: u64,
    pub last_price_confidence_bps: u16,
    pub last_price_published_at_ts: i64,
    pub last_price_slot: u64,
    pub last_price_proof_hash: [u8; 32],
    pub audit_nonce: u64,
    pub bump: u8,
    pub asset_symbol: String<u32, 32>,
}

// Fee accounting account types. SPL tokens for fees physically reside in the
// matching DomainAssetVault.vault_token_account; these accounts track each
// rail's claim against that pool. Withdrawals decrement `withdrawn_fees` and
// transfer SPL out of DomainAssetVault via PDA-signed CPI.

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [199, 15, 107, 45, 108, 244, 162, 105]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct ProtocolFeeVault {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub fee_recipient: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [93, 195, 95, 29, 127, 28, 59, 193]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct PoolTreasuryVault {
    pub liquidity_pool: Pubkey,
    pub asset_mint: Pubkey,
    pub fee_recipient: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [167, 128, 29, 44, 248, 197, 244, 23]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct PoolOracleFeeVault {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub asset_mint: Pubkey,
    pub fee_recipient: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [66, 134, 136, 77, 63, 55, 103, 191])]
pub struct HealthPlan<'info> {
    pub reserve_domain: Pubkey,
    pub sponsor: Pubkey,
    pub plan_admin: Pubkey,
    pub sponsor_operator: Pubkey,
    pub claims_operator: Pubkey,
    pub oracle_authority: Pubkey,
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
    pub health_plan_id: String<u32, 32>,
    pub display_name: String<u32, 64>,
    pub organization_ref: String<u32, 64>,
    pub metadata_uri: String<u32, 160>,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [196, 117, 121, 249, 37, 71, 245, 23])]
pub struct PolicySeries<'info> {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub asset_mint: Pubkey,
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
    pub series_id: String<u32, 32>,
    pub display_name: String<u32, 64>,
    pub metadata_uri: String<u32, 160>,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [88, 118, 224, 251, 240, 186, 123, 175]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct MemberPosition {
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub wallet: Pubkey,
    pub subject_commitment: [u8; 32],
    pub eligibility_status: u8,
    pub delegated_rights: u32,
    pub enrollment_proof_mode: u8,
    pub invite_id_hash: [u8; 32],
    pub active: bool,
    pub opened_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [112, 72, 52, 244, 254, 229, 217, 235])]
pub struct FundingLine<'info> {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
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
    pub line_id: String<u32, 32>,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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
    pub attestation_count: u16,
    pub linked_obligation: Pubkey,
    pub opened_at: i64,
    pub updated_at: i64,
    pub closed_at: i64,
    pub bump: u8,
}

#[cfg(feature = "quasar")]
#[account(discriminator = [7, 178, 225, 1, 54, 47, 117, 180])]
pub struct ClaimCase<'info> {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub member_position: Pubkey,
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
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
    pub attestation_count: u16,
    pub linked_obligation: Pubkey,
    pub opened_at: i64,
    pub updated_at: i64,
    pub closed_at: i64,
    pub bump: u8,
    pub claim_id: String<u32, 32>,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [168, 206, 141, 106, 88, 76, 172, 167])]
pub struct Obligation<'info> {
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
    pub obligation_id: String<u32, 32>,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [66, 38, 17, 64, 188, 80, 68, 129])]
pub struct LiquidityPool<'info> {
    pub reserve_domain: Pubkey,
    pub curator: Pubkey,
    pub allocator: Pubkey,
    pub sentinel: Pubkey,
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
    pub pool_id: String<u32, 32>,
    pub display_name: String<u32, 64>,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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
    pub next_redemption_sequence: u64,
    pub next_redemption_to_process: u64,
    pub active: bool,
    pub bump: u8,
}

#[cfg(feature = "quasar")]
#[account(discriminator = [161, 52, 78, 54, 200, 103, 206, 252])]
pub struct CapitalClass<'info> {
    pub reserve_domain: Pubkey,
    pub liquidity_pool: Pubkey,
    pub share_mint: Pubkey,
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
    pub next_redemption_sequence: u64,
    pub next_redemption_to_process: u64,
    pub active: bool,
    pub bump: u8,
    pub class_id: String<u32, 32>,
    pub display_name: String<u32, 64>,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [196, 56, 115, 198, 14, 117, 32, 224]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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
    pub redemption_sequence: u64,
    pub redemption_requested_at: i64,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [243, 106, 252, 36, 249, 56, 227, 55]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg_attr(
    not(feature = "quasar"),
    derive(
        AnchorSerialize,
        AnchorDeserialize,
        Clone,
        Copy,
        Default,
        Debug,
        PartialEq,
        Eq,
        InitSpace
    )
)]
#[cfg_attr(feature = "quasar", derive(Clone, Copy, Default, Debug, PartialEq, Eq))]
#[cfg_attr(feature = "quasar", repr(C, packed))]
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

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [82, 42, 164, 106, 70, 160, 154, 99]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct DomainAssetLedger {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [243, 245, 230, 224, 27, 105, 48, 128]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct PlanReserveLedger {
    pub health_plan: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [0, 109, 195, 30, 140, 79, 210, 234]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct SeriesReserveLedger {
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [233, 46, 244, 60, 190, 65, 156, 68]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct FundingLineLedger {
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [147, 125, 17, 88, 188, 78, 109, 204]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct PoolClassLedger {
    pub capital_class: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub total_shares: u64,
    pub realized_yield_amount: u64,
    pub realized_loss_amount: u64,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [53, 81, 62, 163, 68, 200, 187, 50]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct AllocationLedger {
    pub allocation_position: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub realized_pnl: i64,
    pub bump: u8,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [232, 217, 185, 162, 237, 208, 114, 142])]
pub struct OracleProfile<'info> {
    pub oracle: Pubkey,
    pub admin: Pubkey,
    pub oracle_type: u8,
    pub supported_schema_count: u8,
    pub supported_schema_key_hashes: [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS],
    pub active: bool,
    pub claimed: bool,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
    pub display_name: String<u32, 64>,
    pub legal_name: String<u32, 96>,
    pub website_url: String<u32, 160>,
    pub app_url: String<u32, 160>,
    pub logo_uri: String<u32, 160>,
    pub webhook_url: String<u32, 160>,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [116, 241, 25, 184, 205, 21, 153, 29]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct PoolOracleApproval {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub active: bool,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [246, 134, 133, 108, 100, 203, 226, 43]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [3, 136, 243, 231, 172, 143, 123, 245]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct PoolOraclePermissionSet {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub permissions: u32,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[cfg_attr(not(feature = "quasar"), account)]
#[cfg_attr(feature = "quasar", account(discriminator = [93, 71, 134, 41, 234, 89, 150, 80]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct ClaimAttestation {
    pub oracle: Pubkey,
    pub oracle_profile: Pubkey,
    pub claim_case: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub decision: u8,
    pub attestation_hash: [u8; 32],
    pub attestation_ref_hash: [u8; 32],
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
    pub schema_hash: [u8; 32],
    pub schema_version: u16,
    pub liquidity_pool: Pubkey,
    pub allocation_position: Pubkey,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
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

#[cfg(feature = "quasar")]
#[account(discriminator = [243, 62, 72, 224, 198, 100, 29, 58])]
pub struct OutcomeSchema<'info> {
    pub publisher: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub version: u16,
    pub schema_hash: [u8; 32],
    pub schema_family: u8,
    pub visibility: u8,
    pub verified: bool,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
    pub schema_key: String<u32, 96>,
    pub metadata_uri: String<u32, 160>,
}

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct SchemaDependencyLedger {
    pub schema_key_hash: [u8; 32],
    #[max_len(MAX_SCHEMA_DEPENDENCY_RULES)]
    pub pool_rule_addresses: Vec<Pubkey>,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[cfg(feature = "quasar")]
#[account(discriminator = [87, 115, 211, 54, 36, 177, 77, 131])]
pub struct SchemaDependencyLedger<'info> {
    pub schema_key_hash: [u8; 32],
    pub updated_at_ts: i64,
    pub bump: u8,
    pub pool_rule_addresses: Vec<Pubkey, u32, 32>,
}

pub enum FrameworkAccountData {}

pub trait AccountDataLifetime<'info> {
    type ReserveDomain;
    type ReserveAssetRail;
    type HealthPlan;
    type PolicySeries;
    type FundingLine;
    type ClaimCase;
    type Obligation;
    type LiquidityPool;
    type CapitalClass;
    type OracleProfile;
    type OutcomeSchema;
    type SchemaDependencyLedger;
}

#[cfg(not(feature = "quasar"))]
impl<'info> AccountDataLifetime<'info> for FrameworkAccountData {
    type ReserveDomain = ReserveDomain;
    type ReserveAssetRail = ReserveAssetRail;
    type HealthPlan = HealthPlan;
    type PolicySeries = PolicySeries;
    type FundingLine = FundingLine;
    type ClaimCase = ClaimCase;
    type Obligation = Obligation;
    type LiquidityPool = LiquidityPool;
    type CapitalClass = CapitalClass;
    type OracleProfile = OracleProfile;
    type OutcomeSchema = OutcomeSchema;
    type SchemaDependencyLedger = SchemaDependencyLedger;
}

#[cfg(feature = "quasar")]
impl<'info> AccountDataLifetime<'info> for FrameworkAccountData {
    type ReserveDomain = ReserveDomain<'info>;
    type ReserveAssetRail = ReserveAssetRail<'info>;
    type HealthPlan = HealthPlan<'info>;
    type PolicySeries = PolicySeries<'info>;
    type FundingLine = FundingLine<'info>;
    type ClaimCase = ClaimCase<'info>;
    type Obligation = Obligation<'info>;
    type LiquidityPool = LiquidityPool<'info>;
    type CapitalClass = CapitalClass<'info>;
    type OracleProfile = OracleProfile<'info>;
    type OutcomeSchema = OutcomeSchema<'info>;
    type SchemaDependencyLedger = SchemaDependencyLedger<'info>;
}

pub type ReserveDomainAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::ReserveDomain;
pub type ReserveAssetRailAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::ReserveAssetRail;
pub type HealthPlanAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::HealthPlan;
pub type PolicySeriesAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::PolicySeries;
pub type FundingLineAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::FundingLine;
pub type ClaimCaseAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::ClaimCase;
pub type ObligationAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::Obligation;
pub type LiquidityPoolAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::LiquidityPool;
pub type CapitalClassAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::CapitalClass;
pub type OracleProfileAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::OracleProfile;
pub type OutcomeSchemaAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::OutcomeSchema;
pub type SchemaDependencyLedgerAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::SchemaDependencyLedger;

#[cfg(feature = "quasar")]
macro_rules! impl_quasar_fixed_init_space {
    ($($name:ty),* $(,)?) => {
        $(
            impl $name {
                pub const INIT_SPACE: usize = <Self as Space>::SPACE - 8;
            }
        )*
    };
}

#[cfg(feature = "quasar")]
macro_rules! impl_quasar_dynamic_init_space {
    ($($name:ident),* $(,)?) => {
        $(
            impl $name<'_> {
                pub const INIT_SPACE: usize = Self::MAX_SPACE - 8;
            }
        )*
    };
}

#[cfg(feature = "quasar")]
impl_quasar_fixed_init_space!(
    ProtocolGovernance,
    DomainAssetVault,
    ProtocolFeeVault,
    PoolTreasuryVault,
    PoolOracleFeeVault,
    MemberPosition,
    LPPosition,
    AllocationPosition,
    DomainAssetLedger,
    PlanReserveLedger,
    SeriesReserveLedger,
    FundingLineLedger,
    PoolClassLedger,
    AllocationLedger,
    PoolOracleApproval,
    PoolOraclePolicy,
    PoolOraclePermissionSet,
    ClaimAttestation,
);

#[cfg(feature = "quasar")]
impl_quasar_dynamic_init_space!(
    ReserveDomain,
    ReserveAssetRail,
    HealthPlan,
    PolicySeries,
    FundingLine,
    ClaimCase,
    Obligation,
    LiquidityPool,
    CapitalClass,
    OracleProfile,
    OutcomeSchema,
    SchemaDependencyLedger,
);
