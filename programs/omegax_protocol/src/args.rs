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
    pub comparability_hash: [u8; 32],
    pub policy_overrides_hash: [u8; 32],
    pub cycle_seconds: i64,
    pub terms_version: u16,
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
    pub comparability_hash: [u8; 32],
    pub policy_overrides_hash: [u8; 32],
    pub cycle_seconds: i64,
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
pub struct AdjudicateClaimCaseArgs {
    pub review_state: u8,
    pub approved_amount: u64,
    pub denied_amount: u64,
    pub reserve_amount: u64,
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
}

#[cfg_attr(
    not(feature = "quasar"),
    derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)
)]
pub struct SettleClaimCaseArgs {
    pub amount: u64,
}
