// SPDX-License-Identifier: AGPL-3.0-or-later

//! Canonical OmegaX health capital markets program surface.

pub mod platform;

use crate::platform::*;

declare_id!("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");

pub mod args;
#[cfg(feature = "certora")]
pub mod certora;
pub mod claims;
#[cfg(not(feature = "quasar"))]
pub mod classic_token;
pub mod constants;
pub mod errors;
pub mod events;
pub mod funding_obligations;
pub mod kernel;
pub mod plans_membership;
pub mod quasar_discriminators;
pub mod reserve_custody;
pub mod state;
pub mod types;

pub use args::*;
pub use claims::*;
pub use constants::*;
pub use errors::*;
pub use events::*;
pub use funding_obligations::*;
#[cfg(test)]
pub(crate) use kernel::*;
pub use plans_membership::*;
pub use reserve_custody::*;
pub use state::*;
pub use types::*;

// Anchor derives these hidden client-account modules next to each `Accounts`
// context. Re-export them at crate root so Anchor `#[program]` sees the same
// names after moving the contexts into child modules.
#[cfg(not(feature = "quasar"))]
pub(crate) use funding_obligations::{
    __client_accounts_create_obligation, __client_accounts_fund_sponsor_budget,
    __client_accounts_open_funding_line, __client_accounts_record_premium_payment,
    __client_accounts_release_reserve, __client_accounts_reserve_obligation,
    __client_accounts_settle_obligation,
};
#[cfg(not(feature = "quasar"))]
#[program]
pub mod omegax_protocol {
    use super::*;

    pub fn create_reserve_domain(
        ctx: Context<CreateReserveDomain>,
        args: CreateReserveDomainArgs,
    ) -> Result<()> {
        crate::reserve_custody::create_reserve_domain(ctx, args)
    }

    pub fn update_reserve_domain_controls(
        ctx: Context<UpdateReserveDomainControls>,
        args: UpdateReserveDomainControlsArgs,
    ) -> Result<()> {
        crate::reserve_custody::update_reserve_domain_controls(ctx, args)
    }

    pub fn create_domain_asset_vault(
        ctx: Context<CreateDomainAssetVault>,
        args: CreateDomainAssetVaultArgs,
    ) -> Result<()> {
        crate::reserve_custody::create_domain_asset_vault(ctx, args)
    }

    pub fn create_health_plan(
        ctx: Context<CreateHealthPlan>,
        args: CreateHealthPlanArgs,
    ) -> Result<()> {
        crate::plans_membership::create_health_plan(ctx, args)
    }

    pub fn update_health_plan_controls(
        ctx: Context<UpdateHealthPlanControls>,
        args: UpdateHealthPlanControlsArgs,
    ) -> Result<()> {
        crate::plans_membership::update_health_plan_controls(ctx, args)
    }

    pub fn create_policy_series(
        ctx: Context<CreatePolicySeries>,
        args: CreatePolicySeriesArgs,
    ) -> Result<()> {
        crate::plans_membership::create_policy_series(ctx, args)
    }

    pub fn version_policy_series(
        ctx: Context<VersionPolicySeries>,
        args: VersionPolicySeriesArgs,
    ) -> Result<()> {
        crate::plans_membership::version_policy_series(ctx, args)
    }

    pub fn open_funding_line(
        ctx: Context<OpenFundingLine>,
        args: OpenFundingLineArgs,
    ) -> Result<()> {
        crate::funding_obligations::open_funding_line(ctx, args)
    }

    pub fn fund_sponsor_budget(
        ctx: Context<FundSponsorBudget>,
        args: FundSponsorBudgetArgs,
    ) -> Result<()> {
        crate::funding_obligations::fund_sponsor_budget(ctx, args)
    }

    pub fn record_premium_payment(
        ctx: Context<RecordPremiumPayment>,
        args: RecordPremiumPaymentArgs,
    ) -> Result<()> {
        crate::funding_obligations::record_premium_payment(ctx, args)
    }

    pub fn create_obligation(
        ctx: Context<CreateObligation>,
        args: CreateObligationArgs,
    ) -> Result<()> {
        crate::funding_obligations::create_obligation(ctx, args)
    }

    pub fn reserve_obligation(
        ctx: Context<ReserveObligation>,
        args: ReserveObligationArgs,
    ) -> Result<()> {
        crate::funding_obligations::reserve_obligation(ctx, args)
    }

    pub fn settle_obligation(
        ctx: Context<SettleObligation>,
        args: SettleObligationArgs,
    ) -> Result<()> {
        crate::funding_obligations::settle_obligation(ctx, args)
    }

    pub fn release_reserve(ctx: Context<ReleaseReserve>, args: ReleaseReserveArgs) -> Result<()> {
        crate::funding_obligations::release_reserve(ctx, args)
    }

    pub fn open_claim_case(ctx: Context<OpenClaimCase>, args: OpenClaimCaseArgs) -> Result<()> {
        crate::claims::open_claim_case(ctx, args)
    }

    pub fn authorize_claim_recipient(
        ctx: Context<AuthorizeClaimRecipient>,
        args: AuthorizeClaimRecipientArgs,
    ) -> Result<()> {
        crate::claims::authorize_claim_recipient(ctx, args)
    }

    pub fn adjudicate_claim_case(
        ctx: Context<AdjudicateClaimCase>,
        args: AdjudicateClaimCaseArgs,
    ) -> Result<()> {
        crate::claims::adjudicate_claim_case(ctx, args)
    }

    pub fn settle_claim_case(
        ctx: Context<SettleClaimCase>,
        args: SettleClaimCaseArgs,
    ) -> Result<()> {
        crate::claims::settle_claim_case(ctx, args)
    }
}

#[cfg(feature = "quasar")]
#[program]
pub mod omegax_protocol {
    use super::*;
    #[inline(always)]
    fn quasar_handler_port_pending() -> Result<()> {
        Err(ProgramError::InvalidInstructionData)
    }

    #[instruction(discriminator = [222, 2, 8, 218, 45, 157, 193, 246])]
    pub fn create_reserve_domain(
        ctx: Ctx<CreateReserveDomain>,
        domain_admin: Pubkey,
        settlement_mode: u8,
        legal_structure_hash: [u8; 32],
        compliance_baseline_hash: [u8; 32],
        allowed_rail_mask: u16,
        pause_flags: u32,
        domain_id: String<u32, 32>,
        display_name: String<u32, 64>,
    ) -> Result<()> {
        crate::reserve_custody::create_reserve_domain(
            &mut ctx,
            domain_admin,
            settlement_mode,
            legal_structure_hash,
            compliance_baseline_hash,
            allowed_rail_mask,
            pause_flags,
            domain_id,
            display_name,
        )
    }

    #[instruction(discriminator = [3, 60, 38, 233, 198, 167, 116, 197])]
    pub fn update_reserve_domain_controls(
        ctx: Ctx<UpdateReserveDomainControls>,
        allowed_rail_mask: u16,
        pause_flags: u32,
        active: bool,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = &reason_hash;
        crate::reserve_custody::update_reserve_domain_controls(
            &mut ctx,
            allowed_rail_mask,
            pause_flags,
            active,
        )
    }

    #[instruction(discriminator = [31, 13, 112, 128, 23, 164, 26, 108])]
    pub fn create_domain_asset_vault(
        ctx: Ctx<CreateDomainAssetVault>,
        asset_mint_key: Pubkey,
    ) -> Result<()> {
        crate::reserve_custody::create_domain_asset_vault(&mut ctx, asset_mint_key)
    }

    #[instruction(discriminator = [136, 7, 197, 134, 241, 206, 83, 171])]
    pub fn create_health_plan(
        ctx: Ctx<CreateHealthPlan>,
        sponsor: Pubkey,
        sponsor_operator: Pubkey,
        claims_operator: Pubkey,
        oracle_authority: Pubkey,
        allowed_rail_mask: u16,
        default_funding_priority: u8,
        oracle_policy_hash: [u8; 32],
        schema_binding_hash: [u8; 32],
        compliance_baseline_hash: [u8; 32],
        pause_flags: u32,
        plan_id: String<u32, 32>,
        display_name: String<u32, 64>,
        organization_ref: String<u32, 64>,
        metadata_uri: String<u32, 160>,
    ) -> Result<()> {
        crate::plans_membership::create_health_plan(
            &mut ctx,
            sponsor,
            sponsor_operator,
            claims_operator,
            oracle_authority,
            allowed_rail_mask,
            default_funding_priority,
            oracle_policy_hash,
            schema_binding_hash,
            compliance_baseline_hash,
            pause_flags,
            plan_id,
            display_name,
            organization_ref,
            metadata_uri,
        )
    }

    #[instruction(discriminator = [108, 11, 28, 140, 226, 164, 239, 113])]
    pub fn update_health_plan_controls(
        ctx: Ctx<UpdateHealthPlanControls>,
        sponsor_operator: Pubkey,
        claims_operator: Pubkey,
        oracle_authority: Pubkey,
        allowed_rail_mask: u16,
        default_funding_priority: u8,
        oracle_policy_hash: [u8; 32],
        schema_binding_hash: [u8; 32],
        compliance_baseline_hash: [u8; 32],
        pause_flags: u32,
        active: bool,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = &reason_hash;
        crate::plans_membership::update_health_plan_controls(
            &mut ctx,
            sponsor_operator,
            claims_operator,
            oracle_authority,
            allowed_rail_mask,
            default_funding_priority,
            oracle_policy_hash,
            schema_binding_hash,
            compliance_baseline_hash,
            pause_flags,
            active,
        )
    }

    #[instruction(discriminator = [70, 162, 231, 218, 211, 136, 110, 176])]
    pub fn create_policy_series(
        ctx: Ctx<CreatePolicySeries>,
        asset_mint: Pubkey,
        mode: u8,
        status: u8,
        adjudication_mode: u8,
        terms_hash: [u8; 32],
        pricing_hash: [u8; 32],
        payout_hash: [u8; 32],
        reserve_model_hash: [u8; 32],
        comparability_hash: [u8; 32],
        policy_overrides_hash: [u8; 32],
        cycle_seconds: i64,
        terms_version: u16,
        series_id: String<u32, 32>,
        display_name: String<u32, 64>,
        metadata_uri: String<u32, 160>,
    ) -> Result<()> {
        crate::plans_membership::create_policy_series(
            &mut ctx,
            asset_mint,
            mode,
            status,
            adjudication_mode,
            terms_hash,
            pricing_hash,
            payout_hash,
            reserve_model_hash,
            comparability_hash,
            policy_overrides_hash,
            cycle_seconds,
            terms_version,
            series_id,
            display_name,
            metadata_uri,
        )
    }

    #[instruction(discriminator = [64, 76, 132, 253, 41, 220, 169, 146])]
    pub fn version_policy_series(
        ctx: Ctx<VersionPolicySeries>,
        status: u8,
        adjudication_mode: u8,
        terms_hash: [u8; 32],
        pricing_hash: [u8; 32],
        payout_hash: [u8; 32],
        reserve_model_hash: [u8; 32],
        comparability_hash: [u8; 32],
        policy_overrides_hash: [u8; 32],
        cycle_seconds: i64,
        series_id: String<u32, 32>,
        display_name: String<u32, 64>,
        metadata_uri: String<u32, 160>,
    ) -> Result<()> {
        crate::plans_membership::version_policy_series(
            &mut ctx,
            status,
            adjudication_mode,
            terms_hash,
            pricing_hash,
            payout_hash,
            reserve_model_hash,
            comparability_hash,
            policy_overrides_hash,
            cycle_seconds,
            series_id,
            display_name,
            metadata_uri,
        )
    }

    #[instruction(discriminator = [231, 140, 66, 127, 163, 1, 197, 9])]
    pub fn open_funding_line(
        ctx: Ctx<OpenFundingLine>,
        policy_series_arg: Pubkey,
        asset_mint: Pubkey,
        line_type: u8,
        funding_priority: u8,
        committed_amount: u64,
        caps_hash: [u8; 32],
        line_id: String<u32, 32>,
    ) -> Result<()> {
        crate::funding_obligations::open_funding_line(
            &mut ctx,
            policy_series_arg,
            asset_mint,
            line_type,
            funding_priority,
            committed_amount,
            caps_hash,
            &line_id,
        )
    }

    #[instruction(discriminator = [150, 210, 161, 31, 50, 12, 224, 32])]
    pub fn fund_sponsor_budget(ctx: Ctx<FundSponsorBudget>, amount: u64) -> Result<()> {
        crate::funding_obligations::fund_sponsor_budget(&mut ctx, amount)
    }

    #[instruction(discriminator = [196, 182, 182, 56, 146, 87, 170, 29])]
    pub fn record_premium_payment(ctx: Ctx<RecordPremiumPayment>, amount: u64) -> Result<()> {
        crate::funding_obligations::record_premium_payment(&mut ctx, amount)
    }

    #[instruction(discriminator = [216, 144, 172, 223, 19, 106, 220, 54])]
    pub fn create_obligation(
        ctx: Ctx<CreateObligation>,
        asset_mint: Pubkey,
        policy_series: Pubkey,
        member_wallet: Pubkey,
        beneficiary: Pubkey,
        claim_case: Pubkey,
        delivery_mode: u8,
        amount: u64,
        creation_reason_hash: [u8; 32],
        obligation_id: String<u32, 32>,
    ) -> Result<()> {
        crate::funding_obligations::create_obligation(
            &mut ctx,
            asset_mint,
            policy_series,
            member_wallet,
            beneficiary,
            claim_case,
            delivery_mode,
            amount,
            creation_reason_hash,
            &obligation_id,
        )
    }

    #[instruction(discriminator = [48, 113, 133, 225, 40, 36, 197, 86])]
    pub fn reserve_obligation(ctx: Ctx<ReserveObligation>, amount: u64) -> Result<()> {
        crate::funding_obligations::reserve_obligation(&mut ctx, amount)
    }

    #[instruction(discriminator = [209, 166, 218, 35, 147, 139, 238, 208])]
    pub fn settle_obligation(
        ctx: Ctx<SettleObligation>,
        next_status: u8,
        amount: u64,
        settlement_reason_hash: [u8; 32],
    ) -> Result<()> {
        crate::funding_obligations::settle_obligation(
            &mut ctx,
            next_status,
            amount,
            settlement_reason_hash,
        )
    }

    #[instruction(discriminator = [170, 102, 52, 144, 33, 176, 41, 60])]
    pub fn release_reserve(ctx: Ctx<ReleaseReserve>, amount: u64) -> Result<()> {
        crate::funding_obligations::release_reserve(&mut ctx, amount)
    }

    #[instruction(discriminator = [151, 125, 231, 211, 63, 132, 248, 184])]
    pub fn open_claim_case(
        ctx: Ctx<OpenClaimCase>,
        policy_series: Pubkey,
        claimant: Pubkey,
        evidence_ref_hash: [u8; 32],
        claim_id: String<u32, 32>,
    ) -> Result<()> {
        crate::claims::open_claim_case(
            &mut ctx,
            policy_series,
            claimant,
            evidence_ref_hash,
            claim_id,
        )
    }

    #[instruction(discriminator = [112, 97, 129, 42, 125, 165, 226, 163])]
    pub fn authorize_claim_recipient(
        ctx: Ctx<AuthorizeClaimRecipient>,
        delegate_recipient: Pubkey,
    ) -> Result<()> {
        crate::claims::authorize_claim_recipient(&mut ctx, delegate_recipient)
    }

    #[instruction(discriminator = [146, 99, 255, 26, 223, 88, 235, 114])]
    pub fn adjudicate_claim_case(
        ctx: Ctx<AdjudicateClaimCase>,
        review_state: u8,
        approved_amount: u64,
        denied_amount: u64,
        reserve_amount: u64,
        evidence_ref_hash: [u8; 32],
        decision_support_hash: [u8; 32],
    ) -> Result<()> {
        crate::claims::adjudicate_claim_case(
            &mut ctx,
            review_state,
            approved_amount,
            denied_amount,
            reserve_amount,
            evidence_ref_hash,
            decision_support_hash,
        )
    }

    #[instruction(discriminator = [178, 123, 229, 204, 50, 204, 91, 71])]
    pub fn settle_claim_case(ctx: Ctx<SettleClaimCase>, amount: u64) -> Result<()> {
        crate::claims::settle_claim_case(&mut ctx, amount)
    }
}

#[cfg(test)]
mod tests;
