// SPDX-License-Identifier: AGPL-3.0-or-later

//! Instruction argument types for the public Anchor IDL.

use crate::constants::*;
use crate::platform::*;

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreateReserveDomainArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub domain_id: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    pub domain_admin: Pubkey,
    pub settlement_mode: u8,
    pub legal_structure_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub allowed_rail_mask: u16,
    pub pause_flags: u32,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct UpdateReserveDomainControlsArgs {
    pub allowed_rail_mask: u16,
    pub pause_flags: u32,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreateDomainAssetVaultArgs {
    pub asset_mint: Pubkey,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct ConfigureReserveAssetRailArgs {
    pub asset_mint: Pubkey,
    pub oracle_authority: Pubkey,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
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
    pub reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct PublishReserveAssetRailPriceArgs {
    pub price_usd_1e8: u64,
    pub confidence_bps: u16,
    pub published_at_ts: i64,
    pub proof_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreateHealthPlanArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub plan_id: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ORG_REF_LEN))]
    pub organization_ref: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub metadata_uri: String,
    pub sponsor: Pubkey,
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
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct UpdateHealthPlanControlsArgs {
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
    pub reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreatePolicySeriesArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub series_id: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub metadata_uri: String,
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
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct InitializeSeriesReserveLedgerArgs {
    pub asset_mint: Pubkey,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct VersionPolicySeriesArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub series_id: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub metadata_uri: String,
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
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct OpenMemberPositionArgs {
    pub series_scope: Pubkey,
    pub subject_commitment: [u8; 32],
    pub eligibility_status: u8,
    pub delegated_rights: u32,
    pub proof_mode: u8,
    pub invite_id_hash: [u8; 32],
    pub invite_expires_at: i64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct UpdateMemberEligibilityArgs {
    pub eligibility_status: u8,
    pub delegated_rights: u32,
    pub active: bool,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct OpenFundingLineArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub line_id: String,
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    pub line_type: u8,
    pub funding_priority: u8,
    pub committed_amount: u64,
    pub caps_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct FundSponsorBudgetArgs {
    pub amount: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct RecordPremiumPaymentArgs {
    pub amount: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreateObligationArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub obligation_id: String,
    pub asset_mint: Pubkey,
    pub policy_series: Pubkey,
    pub member_wallet: Pubkey,
    pub beneficiary: Pubkey,
    pub claim_case: Pubkey,
    pub liquidity_pool: Pubkey,
    pub capital_class: Pubkey,
    pub allocation_position: Pubkey,
    pub delivery_mode: u8,
    pub amount: u64,
    pub creation_reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct ReserveObligationArgs {
    pub amount: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct SettleObligationArgs {
    pub next_status: u8,
    pub amount: u64,
    pub settlement_reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct ReleaseReserveArgs {
    pub amount: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct AuthorizeClaimRecipientArgs {
    pub delegate_recipient: Pubkey,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct OpenClaimCaseArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub claim_id: String,
    pub policy_series: Pubkey,
    pub claimant: Pubkey,
    pub evidence_ref_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct AttachClaimEvidenceRefArgs {
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct AttestClaimCaseArgs {
    pub decision: u8,
    pub attestation_hash: [u8; 32],
    pub attestation_ref_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct AdjudicateClaimCaseArgs {
    pub review_state: u8,
    pub approved_amount: u64,
    pub denied_amount: u64,
    pub reserve_amount: u64,
    pub decision_support_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct SettleClaimCaseArgs {
    pub amount: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreateLiquidityPoolArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub pool_id: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    pub curator: Pubkey,
    pub allocator: Pubkey,
    pub sentinel: Pubkey,
    pub deposit_asset_mint: Pubkey,
    pub strategy_hash: [u8; 32],
    pub allowed_exposure_hash: [u8; 32],
    pub external_yield_adapter_hash: [u8; 32],
    pub redemption_policy: u8,
    pub pause_flags: u32,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreateCapitalClassArgs {
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ID_LEN))]
    pub class_id: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    pub share_mint: Pubkey,
    pub priority: u8,
    pub impairment_rank: u8,
    pub restriction_mode: u8,
    pub redemption_terms_mode: u8,
    pub wrapper_metadata_hash: [u8; 32],
    pub permissioning_hash: [u8; 32],
    pub min_lockup_seconds: i64,
    pub pause_flags: u32,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct UpdateCapitalClassControlsArgs {
    pub pause_flags: u32,
    pub queue_only_redemptions: bool,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct UpdateLpPositionCredentialingArgs {
    pub owner: Pubkey,
    pub credentialed: bool,
    pub reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct DepositIntoCapitalClassArgs {
    pub amount: u64,
    /// Minimum accepted shares out; zero means accept the program-derived
    /// NAV share price with no minimum.
    pub shares: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct RequestRedemptionArgs {
    pub shares: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct ProcessRedemptionQueueArgs {
    pub shares: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct CreateAllocationPositionArgs {
    pub policy_series: Pubkey,
    pub cap_amount: u64,
    pub weight_bps: u16,
    pub allocation_mode: u8,
    pub deallocation_only: bool,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct UpdateAllocationCapsArgs {
    pub cap_amount: u64,
    pub weight_bps: u16,
    pub deallocation_only: bool,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct AllocateCapitalArgs {
    pub amount: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct DeallocateCapitalArgs {
    pub amount: u64,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct MarkImpairmentArgs {
    pub amount: u64,
    pub reason_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct RegisterOracleArgs {
    pub oracle: Pubkey,
    pub oracle_type: u8,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_LONG_NAME_LEN))]
    pub legal_name: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub website_url: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub app_url: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub logo_uri: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub webhook_url: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ORACLE_SUPPORTED_SCHEMAS))]
    pub supported_schema_key_hashes: Vec<[u8; 32]>,
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct UpdateOracleProfileArgs {
    pub oracle_type: u8,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_NAME_LEN))]
    pub display_name: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_LONG_NAME_LEN))]
    pub legal_name: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub website_url: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub app_url: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub logo_uri: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_URI_LEN))]
    pub webhook_url: String,
    #[cfg_attr(not(feature = "quasar"), max_len(MAX_ORACLE_SUPPORTED_SCHEMAS))]
    pub supported_schema_key_hashes: Vec<[u8; 32]>,
}
