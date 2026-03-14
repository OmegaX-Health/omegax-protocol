// SPDX-License-Identifier: AGPL-3.0-or-later

//! v2-owned account layouts and `space()` helpers.
//!
//! Every `space()` helper includes the 8-byte Anchor discriminator. Dynamic
//! string helpers also reserve the 4-byte string length prefix.

use super::*;

#[account]
pub struct ProtocolConfigV2 {
    pub admin: Pubkey,
    pub governance_authority: Pubkey,
    pub governance_realm: Pubkey,
    pub governance_config: Pubkey,
    pub default_stake_mint: Pubkey,
    pub protocol_fee_bps: u16,
    pub min_oracle_stake: u64,
    pub emergency_paused: bool,
    pub allowed_payout_mints_hash: [u8; 32],
    pub bump: u8,
}

impl ProtocolConfigV2 {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 32 + 2 + 8 + 1 + 32 + 1
    }
}

#[account]
pub struct OracleStakePosition {
    pub oracle: Pubkey,
    pub staker: Pubkey,
    pub stake_mint: Pubkey,
    pub stake_vault: Pubkey,
    pub staked_amount: u64,
    pub pending_unstake_amount: u64,
    pub can_finalize_unstake_at: i64,
    pub slash_pending: bool,
    pub bump: u8,
}

impl OracleStakePosition {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1
    }
}

#[account]
pub struct PoolOraclePolicy {
    pub pool: Pubkey,
    pub quorum_m: u8,
    pub quorum_n: u8,
    pub require_verified_schema: bool,
    pub oracle_fee_bps: u16,
    pub allow_delegate_claim: bool,
    pub challenge_window_secs: i64,
    pub bump: u8,
}

impl PoolOraclePolicy {
    pub fn space() -> usize {
        8 + 32 + 1 + 1 + 1 + 2 + 1 + 8 + 1
    }
}

#[account]
pub struct PoolOraclePermissionSet {
    pub pool: Pubkey,
    pub oracle: Pubkey,
    pub permissions: u32,
    pub bump: u8,
}

impl PoolOraclePermissionSet {
    pub fn space() -> usize {
        8 + 32 + 32 + 4 + 1
    }
}

#[account]
pub struct PoolTerms {
    pub pool: Pubkey,
    pub pool_type: u8,
    pub payout_asset_mint: Pubkey,
    pub terms_hash: [u8; 32],
    pub payout_policy_hash: [u8; 32],
    pub cycle_mode: u8,
    pub metadata_uri: String,
    pub bump: u8,
}

impl PoolTerms {
    pub fn space(metadata_uri_max_len: usize) -> usize {
        8 + 32 + 1 + 32 + 32 + 32 + 1 + 4 + metadata_uri_max_len + 1
    }
}

#[account]
pub struct PoolAssetVault {
    pub pool: Pubkey,
    pub payout_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub active: bool,
    pub bump: u8,
}

impl PoolAssetVault {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 1 + 1
    }
}

#[account]
pub struct ProtocolFeeVault {
    pub payment_mint: Pubkey,
    pub bump: u8,
}

impl ProtocolFeeVault {
    pub fn space() -> usize {
        8 + 32 + 1
    }
}

#[account]
pub struct PoolOracleFeeVault {
    pub pool: Pubkey,
    pub oracle: Pubkey,
    pub payment_mint: Pubkey,
    pub bump: u8,
}

impl PoolOracleFeeVault {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 1
    }
}

#[account]
pub struct PoolLiquidityConfig {
    pub pool: Pubkey,
    pub payout_mint: Pubkey,
    pub share_mint: Pubkey,
    pub deposits_enabled: bool,
    pub bump: u8,
}

impl PoolLiquidityConfig {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 1 + 1
    }
}

#[account]
pub struct PoolRiskConfig {
    pub pool: Pubkey,
    pub redemption_mode: u8,
    pub claim_mode: u8,
    pub impaired: bool,
    pub updated_by: Pubkey,
    pub updated_at: i64,
    pub bump: u8,
}

impl PoolRiskConfig {
    pub fn space() -> usize {
        8 + 32 + 1 + 1 + 1 + 32 + 8 + 1
    }
}

#[account]
pub struct PoolCapitalClass {
    pub pool: Pubkey,
    pub share_mint: Pubkey,
    pub payout_mint: Pubkey,
    pub class_id_hash: [u8; 32],
    pub series_ref_hash: [u8; 32],
    pub compliance_profile_hash: [u8; 32],
    pub class_mode: u8,
    pub class_priority: u8,
    pub transfer_mode: u8,
    pub restricted: bool,
    pub redemption_queue_enabled: bool,
    pub ring_fenced: bool,
    pub lockup_secs: i64,
    pub redemption_notice_secs: i64,
    pub vintage_index: u16,
    pub issued_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl PoolCapitalClass {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 32 + 32 + 1 + 1 + 1 + 1 + 1 + 1 + 8 + 8 + 2 + 8 + 8 + 1
    }
}

#[account]
pub struct PolicySeries {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub status: u8,
    pub plan_mode: u8,
    pub sponsor_mode: u8,
    pub display_name: String,
    pub metadata_uri: String,
    pub terms_hash: [u8; 32],
    pub duration_secs: i64,
    pub premium_due_every_secs: i64,
    pub premium_grace_secs: i64,
    pub premium_amount: u64,
    pub interop_profile_hash: [u8; 32],
    pub oracle_profile_hash: [u8; 32],
    pub risk_family_hash: [u8; 32],
    pub issuance_template_hash: [u8; 32],
    pub comparability_hash: [u8; 32],
    pub renewal_of_hash: [u8; 32],
    pub terms_version: u16,
    pub mapping_version: u16,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

impl PolicySeries {
    pub fn space() -> usize {
        8 + 32
            + 32
            + 1
            + 1
            + 1
            + 4
            + MAX_COVERAGE_PRODUCT_NAME_LEN
            + 4
            + MAX_METADATA_URI_LEN
            + 32
            + 8
            + 8
            + 8
            + 8
            + 32
            + 32
            + 32
            + 32
            + 32
            + 32
            + 2
            + 2
            + 8
            + 8
            + 1
    }
}

#[account]
pub struct PoolCompliancePolicy {
    pub pool: Pubkey,
    pub provider_ref_hash: [u8; 32],
    pub credential_type_hash: [u8; 32],
    pub revocation_list_hash: [u8; 32],
    pub actions_mask: u16,
    pub binding_mode: u8,
    pub provider_mode: u8,
    pub capital_rail_mode: u8,
    pub payout_rail_mode: u8,
    pub active: bool,
    pub updated_by: Pubkey,
    pub updated_at: i64,
    pub bump: u8,
}

impl PoolCompliancePolicy {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 2 + 1 + 1 + 1 + 1 + 1 + 32 + 8 + 1
    }
}

#[account]
pub struct PoolControlAuthority {
    pub pool: Pubkey,
    pub operator_authority: Pubkey,
    pub risk_manager_authority: Pubkey,
    pub compliance_authority: Pubkey,
    pub guardian_authority: Pubkey,
    pub updated_at: i64,
    pub bump: u8,
}

impl PoolControlAuthority {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 32 + 8 + 1
    }
}

#[account]
pub struct PoolAutomationPolicy {
    pub pool: Pubkey,
    pub oracle_automation_mode: u8,
    pub claim_automation_mode: u8,
    pub allowed_ai_roles_mask: u16,
    pub max_auto_claim_amount: u64,
    pub required_attestation_provider_ref_hash: [u8; 32],
    pub updated_by: Pubkey,
    pub updated_at: i64,
    pub bump: u8,
}

impl PoolAutomationPolicy {
    pub fn space() -> usize {
        8 + 32 + 1 + 1 + 2 + 8 + 32 + 32 + 8 + 1
    }
}

#[account]
pub struct OutcomeSchemaRegistryEntry {
    pub schema_key_hash: [u8; 32],
    pub schema_key: String,
    pub version: u16,
    pub schema_hash: [u8; 32],
    pub publisher: Pubkey,
    pub verified: bool,
    pub schema_family: u8,
    pub visibility: u8,
    pub interop_profile_hash: [u8; 32],
    pub code_system_family_hash: [u8; 32],
    pub mapping_version: u16,
    pub metadata_uri: String,
    pub bump: u8,
}

impl OutcomeSchemaRegistryEntry {
    pub fn space(schema_key: &str, metadata_uri: &str) -> usize {
        8 + 32
            + 4
            + schema_key.len()
            + 2
            + 32
            + 32
            + 1
            + 1
            + 1
            + 32
            + 32
            + 2
            + 4
            + metadata_uri.len()
            + 1
    }
}

#[account]
pub struct SchemaDependencyLedger {
    pub schema_key_hash: [u8; 32],
    pub active_rule_refcount: u32,
    pub bump: u8,
}

impl SchemaDependencyLedger {
    pub fn space() -> usize {
        8 + 32 + 4 + 1
    }
}

#[account]
pub struct PoolOutcomeRule {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub rule_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
    pub rule_id: String,
    pub schema_key: String,
    pub schema_version: u16,
    pub interop_profile_hash: [u8; 32],
    pub code_system_family_hash: [u8; 32],
    pub mapping_version: u16,
    pub payout_hash: [u8; 32],
    pub enabled: bool,
    pub bump: u8,
}

impl PoolOutcomeRule {
    pub fn space(rule_id: &str, schema_key: &str) -> usize {
        8 + 32
            + 32
            + 32
            + 32
            + 4
            + rule_id.len()
            + 4
            + schema_key.len()
            + 2
            + 32
            + 32
            + 2
            + 32
            + 1
            + 1
    }
}

#[account]
pub struct InviteIssuerRegistryEntry {
    pub issuer: Pubkey,
    pub organization_ref: String,
    pub metadata_uri: String,
    pub active: bool,
    pub bump: u8,
}

impl InviteIssuerRegistryEntry {
    pub fn space(org_ref_max_len: usize, metadata_uri_max_len: usize) -> usize {
        8 + 32 + 4 + org_ref_max_len + 4 + metadata_uri_max_len + 1 + 1
    }
}

#[account]
pub struct EnrollmentPermitReplay {
    pub pool: Pubkey,
    pub issuer: Pubkey,
    pub member: Pubkey,
    pub nonce_hash: [u8; 32],
    pub invite_id_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

impl EnrollmentPermitReplay {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 32 + 8 + 1
    }
}

#[account]
pub struct AttestationVote {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub member: Pubkey,
    pub cycle_hash: [u8; 32],
    pub rule_hash: [u8; 32],
    pub oracle: Pubkey,
    pub passed: bool,
    pub attestation_digest: [u8; 32],
    pub observed_value_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub external_attestation_ref_hash: [u8; 32],
    pub ai_role: u8,
    pub automation_mode: u8,
    pub model_version_hash: [u8; 32],
    pub policy_version_hash: [u8; 32],
    pub execution_environment_hash: [u8; 32],
    pub attestation_provider_ref_hash: [u8; 32],
    pub as_of_ts: i64,
    pub bump: u8,
}

impl AttestationVote {
    pub fn space() -> usize {
        8 + 512
    }
}

#[account]
pub struct CycleOutcomeAggregate {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub member: Pubkey,
    pub cycle_hash: [u8; 32],
    pub rule_hash: [u8; 32],
    pub pass_votes: u16,
    pub fail_votes: u16,
    pub quorum_m: u8,
    pub quorum_n: u8,
    pub finalized: bool,
    pub passed: bool,
    pub claimed: bool,
    pub reward_liability_reserved: bool,
    pub evidence_hash: [u8; 32],
    pub external_attestation_ref_hash: [u8; 32],
    pub review_status: u8,
    pub challenge_window_ends_at: i64,
    pub dispute_reason_hash: [u8; 32],
    pub disputed_by: Pubkey,
    pub resolved_by: Pubkey,
    pub resolved_at: i64,
    pub ai_role: u8,
    pub automation_mode: u8,
    pub model_version_hash: [u8; 32],
    pub policy_version_hash: [u8; 32],
    pub execution_environment_hash: [u8; 32],
    pub attestation_provider_ref_hash: [u8; 32],
    pub latest_as_of_ts: i64,
    pub bump: u8,
}

impl CycleOutcomeAggregate {
    pub fn space() -> usize {
        8 + 768
    }
}

#[account]
pub struct ClaimDelegateAuthorization {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub delegate: Pubkey,
    pub active: bool,
    pub updated_at: i64,
    pub bump: u8,
}

impl ClaimDelegateAuthorization {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 1 + 8 + 1
    }
}

#[account]
pub struct ClaimRecordV2 {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub member: Pubkey,
    pub claimant: Pubkey,
    pub cycle_hash: [u8; 32],
    pub rule_hash: [u8; 32],
    pub intent_hash: [u8; 32],
    pub payout_mint: Pubkey,
    pub payout_amount: u64,
    pub recipient: Pubkey,
    pub submitted_at: i64,
    pub bump: u8,
}

impl ClaimRecordV2 {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 32 + 8 + 32 + 8 + 1
    }
}

#[account]
pub struct PolicySeriesPaymentOption {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub payment_mint: Pubkey,
    pub payment_amount: u64,
    pub active: bool,
    pub bump: u8,
}

impl PolicySeriesPaymentOption {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 8 + 1 + 1
    }
}

#[account]
pub struct PolicyPosition {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub terms_hash: [u8; 32],
    pub status: u8,
    pub starts_at: i64,
    pub ends_at: i64,
    pub premium_due_every_secs: i64,
    pub premium_grace_secs: i64,
    pub next_due_at: i64,
    pub nft_mint: Pubkey,
    pub bump: u8,
}

impl PolicyPosition {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 32 + 1
    }
}

#[account]
pub struct PolicyPositionNft {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub nft_mint: Pubkey,
    pub metadata_uri: String,
    pub bump: u8,
}

impl PolicyPositionNft {
    pub fn space(metadata_uri_max_len: usize) -> usize {
        8 + 32 + 32 + 32 + 32 + 1 + 4 + metadata_uri_max_len
    }
}

#[account]
pub struct PremiumLedger {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub member: Pubkey,
    pub period_index: u64,
    pub amount: u64,
    pub source: u8,
    pub paid_at: i64,
    pub bump: u8,
}

impl PremiumLedger {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 8 + 8 + 1 + 8 + 1
    }
}

#[account]
pub struct PremiumAttestationReplay {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub member: Pubkey,
    pub period_index: u64,
    pub replay_hash: [u8; 32],
    pub oracle: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

impl PremiumAttestationReplay {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 8 + 32 + 32 + 8 + 1
    }
}

#[account]
pub struct MemberCycleState {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub period_index: u64,
    pub payment_mint: Pubkey,
    pub premium_amount_raw: u64,
    pub bond_amount_raw: u64,
    pub shield_fee_raw: u64,
    pub protocol_fee_raw: u64,
    pub oracle_fee_raw: u64,
    pub net_pool_premium_raw: u64,
    pub total_amount_raw: u64,
    pub canonical_premium_amount: u64,
    pub commitment_enabled: bool,
    pub threshold_bps: u16,
    pub outcome_threshold_score: u16,
    pub cohort_hash: [u8; 32],
    pub settled_health_alpha_score: u16,
    pub included_shield_count: u8,
    pub shield_consumed: bool,
    pub status: u8,
    pub passed: bool,
    pub activated_at: i64,
    pub settled_at: i64,
    pub quote_hash: [u8; 32],
    pub bump: u8,
}

impl MemberCycleState {
    pub fn space() -> usize {
        8 + 32
            + 32
            + 32
            + 8
            + 32
            + 8
            + 8
            + 8
            + 8
            + 8
            + 8
            + 8
            + 8
            + 1
            + 2
            + 2
            + 32
            + 2
            + 1
            + 1
            + 1
            + 1
            + 8
            + 8
            + 32
            + 1
    }
}

#[account]
pub struct CycleQuoteReplay {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub member: Pubkey,
    pub nonce_hash: [u8; 32],
    pub quote_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

impl CycleQuoteReplay {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 32 + 8 + 1
    }
}

#[account]
pub struct PoolTreasuryReserve {
    pub pool: Pubkey,
    pub payment_mint: Pubkey,
    pub reserved_refund_amount: u64,
    pub reserved_reward_amount: u64,
    pub reserved_redistribution_amount: u64,
    pub manual_coverage_reserve_amount: u64,
    pub reserved_coverage_claim_amount: u64,
    pub paid_coverage_claim_amount: u64,
    pub recovered_coverage_claim_amount: u64,
    pub impaired_amount: u64,
    pub last_liability_update_ts: i64,
    pub bump: u8,
}

impl PoolTreasuryReserve {
    pub fn space() -> usize {
        8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1
    }
}

#[account]
pub struct CohortSettlementRoot {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub payment_mint: Pubkey,
    pub cohort_hash: [u8; 32],
    pub outcome_threshold_score: u16,
    pub successful_member_count: u32,
    pub successful_health_alpha_score_sum: u64,
    pub redistributable_failed_bonds_total: u64,
    pub redistribution_claimed_amount: u64,
    pub successful_claim_count: u32,
    pub finalized: bool,
    pub zero_success_released: bool,
    pub finalized_at: i64,
    pub bump: u8,
}

impl CohortSettlementRoot {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 2 + 4 + 8 + 8 + 8 + 4 + 1 + 1 + 8 + 1
    }
}

#[account]
pub struct CoverageClaimRecord {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub member: Pubkey,
    pub claimant: Pubkey,
    pub intent_hash: [u8; 32],
    pub event_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub interop_ref_hash: [u8; 32],
    pub interop_profile_hash: [u8; 32],
    pub code_system_family_hash: [u8; 32],
    pub decision_reason_hash: [u8; 32],
    pub adjudication_ref_hash: [u8; 32],
    pub status: u8,
    pub claim_family: u8,
    pub appeal_count: u16,
    pub requested_amount: u64,
    pub approved_amount: u64,
    pub paid_amount: u64,
    pub reserved_amount: u64,
    pub recovery_amount: u64,
    pub ai_decision_hash: [u8; 32],
    pub ai_policy_hash: [u8; 32],
    pub ai_execution_environment_hash: [u8; 32],
    pub ai_attestation_ref_hash: [u8; 32],
    pub ai_automation_mode: u8,
    pub submitted_at: i64,
    pub reviewed_at: i64,
    pub settled_at: i64,
    pub closed_at: i64,
    pub bump: u8,
}

impl CoverageClaimRecord {
    pub fn space() -> usize {
        8 + 640
    }
}

#[account]
pub struct PoolRedemptionRequest {
    pub pool: Pubkey,
    pub redeemer: Pubkey,
    pub share_mint: Pubkey,
    pub payout_mint: Pubkey,
    pub request_hash: [u8; 32],
    pub share_escrow: Pubkey,
    pub status: u8,
    pub shares_requested: u64,
    pub min_amount_out: u64,
    pub expected_amount_out: u64,
    pub notice_matures_at: i64,
    pub requested_at: i64,
    pub scheduled_at: i64,
    pub fulfilled_at: i64,
    pub cancelled_at: i64,
    pub failed_at: i64,
    pub failure_code: u16,
    pub bump: u8,
}

impl PoolRedemptionRequest {
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 32 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 2 + 1
    }
}
