// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

#[event]
pub struct ProtocolParamsUpdatedEvent {
    pub governance_authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub min_oracle_stake: u64,
    pub emergency_paused: bool,
    pub allowed_payout_mints_hash: [u8; 32],
}

#[event]
pub struct GovernanceAuthorityRotatedEvent {
    pub previous_authority: Pubkey,
    pub new_authority: Pubkey,
    pub acted_by: Pubkey,
}

#[event]
pub struct PolicySeriesUpdatedEvent {
    pub pool: Pubkey,
    pub series_ref_hash: [u8; 32],
    pub interop_profile_hash: [u8; 32],
    pub issuance_template_hash: [u8; 32],
    pub comparability_hash: [u8; 32],
    pub plan_mode: u8,
    pub sponsor_mode: u8,
}

#[event]
pub struct PoolCompliancePolicyUpdatedEvent {
    pub pool: Pubkey,
    pub provider_ref_hash: [u8; 32],
    pub credential_type_hash: [u8; 32],
    pub actions_mask: u16,
    pub binding_mode: u8,
    pub provider_mode: u8,
    pub capital_rail_mode: u8,
    pub payout_rail_mode: u8,
    pub active: bool,
}

#[event]
pub struct PoolControlAuthoritiesUpdatedEvent {
    pub pool: Pubkey,
    pub operator_authority: Pubkey,
    pub risk_manager_authority: Pubkey,
    pub compliance_authority: Pubkey,
    pub guardian_authority: Pubkey,
}

#[event]
pub struct PoolAutomationPolicyUpdatedEvent {
    pub pool: Pubkey,
    pub oracle_automation_mode: u8,
    pub claim_automation_mode: u8,
    pub allowed_ai_roles_mask: u16,
    pub max_auto_claim_amount: u64,
    pub required_attestation_provider_ref_hash: [u8; 32],
}

#[event]
pub struct PoolRiskControlsUpdatedEvent {
    pub pool: Pubkey,
    pub redemption_mode: u8,
    pub claim_mode: u8,
    pub impaired: bool,
    pub impairment_amount: u64,
    pub updated_by: Pubkey,
}

#[event]
pub struct PoolCapitalClassRegisteredEvent {
    pub pool: Pubkey,
    pub share_mint: Pubkey,
    pub class_id_hash: [u8; 32],
    pub series_ref_hash: [u8; 32],
    pub compliance_profile_hash: [u8; 32],
    pub class_mode: u8,
    pub transfer_mode: u8,
    pub restricted: bool,
    pub redemption_queue_enabled: bool,
    pub vintage_index: u16,
}

#[event]
pub struct PoolLiquidityDepositedEvent {
    pub pool: Pubkey,
    pub depositor: Pubkey,
    pub payout_mint: Pubkey,
    pub amount_in: u64,
    pub shares_out: u64,
}

#[event]
pub struct PoolLiquidityRedeemedEvent {
    pub pool: Pubkey,
    pub redeemer: Pubkey,
    pub payout_mint: Pubkey,
    pub shares_in: u64,
    pub amount_out: u64,
}

#[event]
pub struct PoolRedemptionRequestedEvent {
    pub pool: Pubkey,
    pub redeemer: Pubkey,
    pub request_hash: [u8; 32],
    pub payout_mint: Pubkey,
    pub shares_requested: u64,
    pub expected_amount_out: u64,
    pub notice_matures_at: i64,
}

#[event]
pub struct PoolRedemptionStatusChangedEvent {
    pub pool: Pubkey,
    pub redeemer: Pubkey,
    pub request_hash: [u8; 32],
    pub status: u8,
    pub amount_out: u64,
    pub failure_code: u16,
}

#[event]
pub struct OutcomeAttestationSubmittedEvent {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub oracle: Pubkey,
    pub cycle_hash: [u8; 32],
    pub rule_hash: [u8; 32],
    pub passed: bool,
    pub evidence_hash: [u8; 32],
    pub external_attestation_ref_hash: [u8; 32],
    pub ai_role: u8,
    pub automation_mode: u8,
    pub model_version_hash: [u8; 32],
    pub policy_version_hash: [u8; 32],
    pub execution_environment_hash: [u8; 32],
    pub attestation_provider_ref_hash: [u8; 32],
}

#[event]
pub struct OutcomeReviewStatusChangedEvent {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub cycle_hash: [u8; 32],
    pub rule_hash: [u8; 32],
    pub review_status: u8,
    pub challenge_window_ends_at: i64,
    pub dispute_reason_hash: [u8; 32],
    pub acted_by: Pubkey,
}

#[event]
pub struct RewardClaimSubmittedEvent {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub claimant: Pubkey,
    pub cycle_hash: [u8; 32],
    pub rule_hash: [u8; 32],
    pub payout_mint: Pubkey,
    pub payout_amount: u64,
    pub recipient: Pubkey,
}

#[event]
pub struct CoverageClaimStatusChangedEvent {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub claimant: Pubkey,
    pub intent_hash: [u8; 32],
    pub status: u8,
    pub claim_family: u8,
    pub requested_amount: u64,
    pub approved_amount: u64,
    pub reserved_amount: u64,
    pub ai_automation_mode: u8,
}

#[event]
pub struct CoverageClaimPayoutCompletedEvent {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub claimant: Pubkey,
    pub intent_hash: [u8; 32],
    pub payout_mint: Pubkey,
    pub paid_amount: u64,
    pub recovery_amount: u64,
}
