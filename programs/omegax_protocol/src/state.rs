// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account state and serializable reserve-accounting structs.

use crate::constants::*;
use crate::platform::*;

#[cfg(not(feature = "quasar"))]
#[account]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct ReserveDomain {
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
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub claim_id: String,
    pub claimant: Pubkey,
    pub adjudicator: Pubkey,
    // When settlement transfers SPL out, the recipient is `delegate_recipient`
    // if non-zero, else `claimant`. Off-chain buyer/oracle systems own member
    // eligibility; the protocol only stores the payout claimant.
    pub delegate_recipient: Pubkey,
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

#[cfg(feature = "quasar")]
#[account(discriminator = [7, 178, 225, 1, 54, 47, 117, 180])]
pub struct ClaimCase<'info> {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    pub claimant: Pubkey,
    pub adjudicator: Pubkey,
    // When settlement transfers SPL out, the recipient is `delegate_recipient`
    // if non-zero, else `claimant`. Off-chain buyer/oracle systems own member
    // eligibility; the protocol only stores the payout claimant.
    pub delegate_recipient: Pubkey,
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
#[cfg_attr(feature = "quasar", account(discriminator = [233, 46, 244, 60, 190, 65, 156, 68]))]
#[cfg_attr(not(feature = "quasar"), derive(InitSpace))]
pub struct FundingLineLedger {
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

pub enum FrameworkAccountData {}

pub trait AccountDataLifetime<'info> {
    type ReserveDomain;
    type HealthPlan;
    type PolicySeries;
    type FundingLine;
    type ClaimCase;
    type Obligation;
}

#[cfg(not(feature = "quasar"))]
impl<'info> AccountDataLifetime<'info> for FrameworkAccountData {
    type ReserveDomain = ReserveDomain;
    type HealthPlan = HealthPlan;
    type PolicySeries = PolicySeries;
    type FundingLine = FundingLine;
    type ClaimCase = ClaimCase;
    type Obligation = Obligation;
}

#[cfg(feature = "quasar")]
impl<'info> AccountDataLifetime<'info> for FrameworkAccountData {
    type ReserveDomain = ReserveDomain<'info>;
    type HealthPlan = HealthPlan<'info>;
    type PolicySeries = PolicySeries<'info>;
    type FundingLine = FundingLine<'info>;
    type ClaimCase = ClaimCase<'info>;
    type Obligation = Obligation<'info>;
}

pub type ReserveDomainAccountData<'info> =
    <FrameworkAccountData as AccountDataLifetime<'info>>::ReserveDomain;
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
    DomainAssetVault,
    DomainAssetLedger,
    PlanReserveLedger,
    FundingLineLedger,
);

#[cfg(feature = "quasar")]
impl_quasar_dynamic_init_space!(
    ReserveDomain,
    HealthPlan,
    PolicySeries,
    FundingLine,
    ClaimCase,
    Obligation,
);
