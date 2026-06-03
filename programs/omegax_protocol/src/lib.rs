// SPDX-License-Identifier: AGPL-3.0-or-later

//! Canonical OmegaX health capital markets program surface.

pub mod platform;

use crate::platform::*;

declare_id!("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");

pub mod args;
pub mod capital;
#[cfg(feature = "certora")]
pub mod certora;
pub mod claims;
pub mod constants;
pub mod errors;
pub mod events;
pub mod fees;
pub mod funding_obligations;
pub mod governance;
pub mod kernel;
pub mod oracle_schema;
pub mod plans_membership;
pub mod quasar_discriminators;
pub mod reserve_custody;
pub mod reserve_waterfall;
pub mod state;
pub mod types;

pub use args::*;
pub use capital::*;
pub use claims::*;
pub use constants::*;
pub use errors::*;
pub use events::*;
pub use fees::*;
pub use funding_obligations::*;
pub use governance::*;
#[cfg(test)]
pub(crate) use kernel::*;
pub use oracle_schema::*;
pub use plans_membership::*;
pub use reserve_custody::*;
pub use reserve_waterfall::*;
pub use state::*;
pub use types::*;

// Anchor derives these hidden client-account modules next to each `Accounts`
// context. Re-export them at crate root so Anchor `#[program]` sees the same
// names after moving the contexts into child modules.
#[cfg(not(feature = "quasar"))]
pub(crate) use capital::{
    __client_accounts_allocate_capital, __client_accounts_create_allocation_position,
    __client_accounts_create_capital_class, __client_accounts_create_liquidity_pool,
    __client_accounts_deallocate_capital, __client_accounts_deposit_into_capital_class,
    __client_accounts_mark_impairment, __client_accounts_process_redemption_queue,
    __client_accounts_request_redemption, __client_accounts_update_allocation_caps,
    __client_accounts_update_capital_class_controls,
    __client_accounts_update_lp_position_credentialing,
};
#[cfg(not(feature = "quasar"))]
pub(crate) use claims::__client_accounts_settle_claim_case_selected_asset;
#[cfg(not(feature = "quasar"))]
pub(crate) use funding_obligations::{
    __client_accounts_create_obligation, __client_accounts_fund_sponsor_budget,
    __client_accounts_open_funding_line, __client_accounts_record_premium_payment,
    __client_accounts_release_reserve, __client_accounts_reserve_obligation,
    __client_accounts_settle_obligation,
};
#[cfg(not(feature = "quasar"))]
pub(crate) use reserve_waterfall::{
    __client_accounts_configure_reserve_asset_rail,
    __client_accounts_publish_reserve_asset_rail_price,
};

#[cfg(not(feature = "quasar"))]
#[program]
pub mod omegax_protocol {
    use super::*;

    pub fn initialize_protocol_governance(
        ctx: Context<InitializeProtocolGovernance>,
        args: InitializeProtocolGovernanceArgs,
    ) -> Result<()> {
        crate::governance::initialize_protocol_governance(ctx, args)
    }

    pub fn set_protocol_emergency_pause(
        ctx: Context<SetProtocolEmergencyPause>,
        args: SetProtocolEmergencyPauseArgs,
    ) -> Result<()> {
        crate::governance::set_protocol_emergency_pause(ctx, args)
    }

    pub fn rotate_protocol_governance_authority(
        ctx: Context<RotateProtocolGovernanceAuthority>,
        args: RotateProtocolGovernanceAuthorityArgs,
    ) -> Result<()> {
        crate::governance::rotate_protocol_governance_authority(ctx, args)
    }

    pub fn accept_protocol_governance_authority(
        ctx: Context<AcceptProtocolGovernanceAuthority>,
    ) -> Result<()> {
        crate::governance::accept_protocol_governance_authority(ctx)
    }

    pub fn cancel_protocol_governance_authority_transfer(
        ctx: Context<CancelProtocolGovernanceAuthorityTransfer>,
    ) -> Result<()> {
        crate::governance::cancel_protocol_governance_authority_transfer(ctx)
    }

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

    pub fn configure_reserve_asset_rail(
        ctx: Context<ConfigureReserveAssetRail>,
        args: ConfigureReserveAssetRailArgs,
    ) -> Result<()> {
        crate::reserve_waterfall::configure_reserve_asset_rail(ctx, args)
    }

    pub fn publish_reserve_asset_rail_price(
        ctx: Context<PublishReserveAssetRailPrice>,
        args: PublishReserveAssetRailPriceArgs,
    ) -> Result<()> {
        crate::reserve_waterfall::publish_reserve_asset_rail_price(ctx, args)
    }

    /// Phase 1.6 — Initialize the protocol-fee vault for a (reserve_domain, asset_mint)
    /// rail. Governance-only; binds the rail to the asset mint at the program edge.
    /// Withdrawal authority is governance (PR2). Accrual is wired in PR1 hooks.
    pub fn init_protocol_fee_vault(
        ctx: Context<InitProtocolFeeVault>,
        args: InitProtocolFeeVaultArgs,
    ) -> Result<()> {
        crate::fees::init_protocol_fee_vault(ctx, args)
    }

    /// Phase 1.6 — Initialize the pool-treasury vault for a (liquidity_pool, asset_mint)
    /// rail. Governance-only init; pool-admin signs withdrawals (PR2).
    pub fn init_pool_treasury_vault(
        ctx: Context<InitPoolTreasuryVault>,
        args: InitPoolTreasuryVaultArgs,
    ) -> Result<()> {
        crate::fees::init_pool_treasury_vault(ctx, args)
    }

    /// Phase 1.6 — Initialize the pool-oracle fee vault for a (liquidity_pool,
    /// oracle, asset_mint) rail. Governance-only init; the registered oracle
    /// wallet (or oracle profile admin) signs withdrawals (PR2).
    pub fn init_pool_oracle_fee_vault(
        ctx: Context<InitPoolOracleFeeVault>,
        args: InitPoolOracleFeeVaultArgs,
    ) -> Result<()> {
        crate::fees::init_pool_oracle_fee_vault(ctx, args)
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

    pub fn initialize_series_reserve_ledger(
        ctx: Context<InitializeSeriesReserveLedger>,
        args: InitializeSeriesReserveLedgerArgs,
    ) -> Result<()> {
        crate::plans_membership::initialize_series_reserve_ledger(ctx, args)
    }

    pub fn version_policy_series(
        ctx: Context<VersionPolicySeries>,
        args: VersionPolicySeriesArgs,
    ) -> Result<()> {
        crate::plans_membership::version_policy_series(ctx, args)
    }

    pub fn open_member_position(
        ctx: Context<OpenMemberPosition>,
        args: OpenMemberPositionArgs,
    ) -> Result<()> {
        crate::plans_membership::open_member_position(ctx, args)
    }

    pub fn update_member_eligibility(
        ctx: Context<UpdateMemberEligibility>,
        args: UpdateMemberEligibilityArgs,
    ) -> Result<()> {
        crate::plans_membership::update_member_eligibility(ctx, args)
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

    pub fn attach_claim_evidence_ref(
        ctx: Context<AttachClaimEvidenceRef>,
        args: AttachClaimEvidenceRefArgs,
    ) -> Result<()> {
        crate::claims::attach_claim_evidence_ref(ctx, args)
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

    pub fn settle_claim_case_selected_asset(
        ctx: Context<SettleClaimCaseSelectedAsset>,
        args: SettleClaimCaseSelectedAssetArgs,
    ) -> Result<()> {
        crate::claims::settle_claim_case_selected_asset(ctx, args)
    }

    pub fn create_liquidity_pool(
        ctx: Context<CreateLiquidityPool>,
        args: CreateLiquidityPoolArgs,
    ) -> Result<()> {
        crate::capital::create_liquidity_pool(ctx, args)
    }

    pub fn create_capital_class(
        ctx: Context<CreateCapitalClass>,
        args: CreateCapitalClassArgs,
    ) -> Result<()> {
        crate::capital::create_capital_class(ctx, args)
    }

    pub fn update_capital_class_controls(
        ctx: Context<UpdateCapitalClassControls>,
        args: UpdateCapitalClassControlsArgs,
    ) -> Result<()> {
        crate::capital::update_capital_class_controls(ctx, args)
    }

    pub fn update_lp_position_credentialing(
        ctx: Context<UpdateLpPositionCredentialing>,
        args: UpdateLpPositionCredentialingArgs,
    ) -> Result<()> {
        crate::capital::update_lp_position_credentialing(ctx, args)
    }

    pub fn deposit_into_capital_class(
        ctx: Context<DepositIntoCapitalClass>,
        args: DepositIntoCapitalClassArgs,
    ) -> Result<()> {
        crate::capital::deposit_into_capital_class(ctx, args)
    }

    pub fn request_redemption(
        ctx: Context<RequestRedemption>,
        args: RequestRedemptionArgs,
    ) -> Result<()> {
        crate::capital::request_redemption(ctx, args)
    }

    pub fn process_redemption_queue(
        ctx: Context<ProcessRedemptionQueue>,
        args: ProcessRedemptionQueueArgs,
    ) -> Result<()> {
        crate::capital::process_redemption_queue(ctx, args)
    }

    /// Sweep accrued protocol fees (SPL rail) to a recipient ATA.
    /// Authority: governance only. Fees physically reside in the matching
    /// DomainAssetVault.vault_token_account; the CPI is PDA-signed via
    /// transfer_from_domain_vault.
    pub fn withdraw_protocol_fee_spl(
        ctx: Context<WithdrawProtocolFeeSpl>,
        args: WithdrawArgs,
    ) -> Result<()> {
        crate::fees::withdraw_protocol_fee_spl(ctx, args)
    }

    /// Sweep accrued protocol fees (SOL rail) to a recipient system account.
    /// Authority: governance only. Lamports come straight off the fee-vault
    /// PDA; rent-exempt minimum is preserved.
    pub fn withdraw_protocol_fee_sol(
        ctx: Context<WithdrawProtocolFeeSol>,
        args: WithdrawArgs,
    ) -> Result<()> {
        crate::fees::withdraw_protocol_fee_sol(ctx, args)
    }

    /// Sweep accrued pool-treasury fees (SPL rail).
    /// Authority: pool curator OR governance.
    pub fn withdraw_pool_treasury_spl(
        ctx: Context<WithdrawPoolTreasurySpl>,
        args: WithdrawArgs,
    ) -> Result<()> {
        crate::fees::withdraw_pool_treasury_spl(ctx, args)
    }

    /// Sweep accrued pool-treasury fees (SOL rail).
    /// Authority: pool curator OR governance.
    pub fn withdraw_pool_treasury_sol(
        ctx: Context<WithdrawPoolTreasurySol>,
        args: WithdrawArgs,
    ) -> Result<()> {
        crate::fees::withdraw_pool_treasury_sol(ctx, args)
    }

    /// Sweep accrued pool-oracle fees (SPL rail) to a recipient ATA.
    /// Authority: registered oracle wallet OR oracle profile admin OR governance.
    pub fn withdraw_pool_oracle_fee_spl(
        ctx: Context<WithdrawPoolOracleFeeSpl>,
        args: WithdrawArgs,
    ) -> Result<()> {
        crate::fees::withdraw_pool_oracle_fee_spl(ctx, args)
    }

    /// Sweep accrued pool-oracle fees (SOL rail) to a recipient system account.
    /// Authority: registered oracle wallet OR oracle profile admin OR governance.
    pub fn withdraw_pool_oracle_fee_sol(
        ctx: Context<WithdrawPoolOracleFeeSol>,
        args: WithdrawArgs,
    ) -> Result<()> {
        crate::fees::withdraw_pool_oracle_fee_sol(ctx, args)
    }

    pub fn create_allocation_position(
        ctx: Context<CreateAllocationPosition>,
        args: CreateAllocationPositionArgs,
    ) -> Result<()> {
        crate::capital::create_allocation_position(ctx, args)
    }

    pub fn update_allocation_caps(
        ctx: Context<UpdateAllocationCaps>,
        args: UpdateAllocationCapsArgs,
    ) -> Result<()> {
        crate::capital::update_allocation_caps(ctx, args)
    }

    pub fn allocate_capital(
        ctx: Context<AllocateCapital>,
        args: AllocateCapitalArgs,
    ) -> Result<()> {
        crate::capital::allocate_capital(ctx, args)
    }

    pub fn deallocate_capital(
        ctx: Context<DeallocateCapital>,
        args: DeallocateCapitalArgs,
    ) -> Result<()> {
        crate::capital::deallocate_capital(ctx, args)
    }

    pub fn mark_impairment(ctx: Context<MarkImpairment>, args: MarkImpairmentArgs) -> Result<()> {
        crate::capital::mark_impairment(ctx, args)
    }

    pub fn register_oracle(ctx: Context<RegisterOracle>, args: RegisterOracleArgs) -> Result<()> {
        crate::oracle_schema::register_oracle(ctx, args)
    }

    pub fn claim_oracle(ctx: Context<ClaimOracle>) -> Result<()> {
        crate::oracle_schema::claim_oracle(ctx)
    }

    pub fn update_oracle_profile(
        ctx: Context<UpdateOracleProfile>,
        args: UpdateOracleProfileArgs,
    ) -> Result<()> {
        crate::oracle_schema::update_oracle_profile(ctx, args)
    }

    pub fn set_pool_oracle(ctx: Context<SetPoolOracle>, args: SetPoolOracleArgs) -> Result<()> {
        crate::oracle_schema::set_pool_oracle(ctx, args)
    }

    pub fn set_pool_oracle_permissions(
        ctx: Context<SetPoolOraclePermissions>,
        args: SetPoolOraclePermissionsArgs,
    ) -> Result<()> {
        crate::oracle_schema::set_pool_oracle_permissions(ctx, args)
    }

    pub fn set_pool_oracle_policy(
        ctx: Context<SetPoolOraclePolicy>,
        args: SetPoolOraclePolicyArgs,
    ) -> Result<()> {
        crate::oracle_schema::set_pool_oracle_policy(ctx, args)
    }

    pub fn register_outcome_schema(
        ctx: Context<RegisterOutcomeSchema>,
        args: RegisterOutcomeSchemaArgs,
    ) -> Result<()> {
        crate::oracle_schema::register_outcome_schema(ctx, args)
    }

    pub fn verify_outcome_schema(
        ctx: Context<VerifyOutcomeSchema>,
        args: VerifyOutcomeSchemaArgs,
    ) -> Result<()> {
        crate::oracle_schema::verify_outcome_schema(ctx, args)
    }

    pub fn backfill_schema_dependency_ledger(
        ctx: Context<BackfillSchemaDependencyLedger>,
        args: BackfillSchemaDependencyLedgerArgs,
    ) -> Result<()> {
        crate::oracle_schema::backfill_schema_dependency_ledger(ctx, args)
    }

    pub fn close_outcome_schema(ctx: Context<CloseOutcomeSchema>) -> Result<()> {
        crate::oracle_schema::close_outcome_schema(ctx)
    }

    pub fn attest_claim_case(
        ctx: Context<AttestClaimCase>,
        args: AttestClaimCaseArgs,
    ) -> Result<()> {
        crate::claims::attest_claim_case(ctx, args)
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

    #[instruction(discriminator = [220, 188, 231, 198, 20, 71, 42, 123])]
    pub fn initialize_protocol_governance(
        ctx: Ctx<InitializeProtocolGovernance>,
        protocol_fee_bps: u16,
        emergency_pause: bool,
    ) -> Result<()> {
        crate::governance::initialize_protocol_governance(
            &mut ctx,
            protocol_fee_bps,
            emergency_pause,
        )
    }

    #[instruction(discriminator = [180, 209, 92, 144, 227, 14, 97, 94])]
    pub fn set_protocol_emergency_pause(
        ctx: Ctx<SetProtocolEmergencyPause>,
        emergency_pause: bool,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = &reason_hash;
        crate::governance::set_protocol_emergency_pause(&mut ctx, emergency_pause)
    }

    #[instruction(discriminator = [173, 25, 179, 236, 198, 190, 207, 98])]
    pub fn rotate_protocol_governance_authority(
        ctx: Ctx<RotateProtocolGovernanceAuthority>,
        new_governance_authority: Pubkey,
    ) -> Result<()> {
        crate::governance::rotate_protocol_governance_authority(&mut ctx, new_governance_authority)
    }

    #[instruction(discriminator = [202, 235, 28, 119, 167, 24, 81, 85])]
    pub fn accept_protocol_governance_authority(
        ctx: Ctx<AcceptProtocolGovernanceAuthority>,
    ) -> Result<()> {
        crate::governance::accept_protocol_governance_authority(&mut ctx)
    }

    #[instruction(discriminator = [113, 25, 246, 12, 38, 35, 223, 114])]
    pub fn cancel_protocol_governance_authority_transfer(
        ctx: Ctx<CancelProtocolGovernanceAuthorityTransfer>,
    ) -> Result<()> {
        crate::governance::cancel_protocol_governance_authority_transfer(&mut ctx)
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
        let _ = (
            &ctx,
            &domain_admin,
            &settlement_mode,
            &legal_structure_hash,
            &compliance_baseline_hash,
            &allowed_rail_mask,
            &pause_flags,
            &domain_id,
            &display_name,
        );
        quasar_handler_port_pending()
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

    #[instruction(discriminator = [78, 48, 108, 190, 181, 203, 194, 176])]
    pub fn configure_reserve_asset_rail(
        ctx: Ctx<ConfigureReserveAssetRail>,
        asset_mint: Pubkey,
        oracle_authority: Pubkey,
        role: u8,
        payout_priority: u8,
        oracle_source: u8,
        oracle_feed_id: [u8; 32],
        max_staleness_seconds: i64,
        max_confidence_bps: u16,
        haircut_bps: u16,
        max_exposure_bps: u16,
        deposit_enabled: bool,
        payout_enabled: bool,
        capacity_enabled: bool,
        active: bool,
        reason_hash: [u8; 32],
        asset_symbol: String<u32, 32>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &asset_mint,
            &oracle_authority,
            &role,
            &payout_priority,
            &oracle_source,
            &oracle_feed_id,
            &max_staleness_seconds,
            &max_confidence_bps,
            &haircut_bps,
            &max_exposure_bps,
            &deposit_enabled,
            &payout_enabled,
            &capacity_enabled,
            &active,
            &reason_hash,
            &asset_symbol,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [132, 35, 143, 147, 59, 80, 162, 117])]
    pub fn publish_reserve_asset_rail_price(
        ctx: Ctx<PublishReserveAssetRailPrice>,
        price_usd_1e8: u64,
        confidence_bps: u16,
        published_at_ts: i64,
        proof_hash: [u8; 32],
    ) -> Result<()> {
        crate::reserve_waterfall::publish_reserve_asset_rail_price(
            &mut ctx,
            price_usd_1e8,
            confidence_bps,
            published_at_ts,
            proof_hash,
        )
    }

    #[instruction(discriminator = [212, 235, 61, 42, 96, 183, 225, 57])]
    pub fn init_protocol_fee_vault(
        ctx: Ctx<InitProtocolFeeVault>,
        asset_mint: Pubkey,
        fee_recipient: Pubkey,
    ) -> Result<()> {
        let _ = (&ctx, &asset_mint, &fee_recipient);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [96, 169, 51, 224, 0, 207, 141, 47])]
    pub fn init_pool_treasury_vault(
        ctx: Ctx<InitPoolTreasuryVault>,
        asset_mint: Pubkey,
        fee_recipient: Pubkey,
    ) -> Result<()> {
        let _ = (&ctx, &asset_mint, &fee_recipient);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [68, 122, 148, 84, 91, 98, 198, 167])]
    pub fn init_pool_oracle_fee_vault(
        ctx: Ctx<InitPoolOracleFeeVault>,
        oracle: Pubkey,
        asset_mint: Pubkey,
        fee_recipient: Pubkey,
    ) -> Result<()> {
        let _ = (&ctx, &oracle, &asset_mint, &fee_recipient);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [136, 7, 197, 134, 241, 206, 83, 171])]
    pub fn create_health_plan(
        ctx: Ctx<CreateHealthPlan>,
        sponsor: Pubkey,
        sponsor_operator: Pubkey,
        claims_operator: Pubkey,
        oracle_authority: Pubkey,
        membership_mode: u8,
        membership_gate_kind: u8,
        membership_gate_mint: Pubkey,
        membership_gate_min_amount: u64,
        membership_invite_authority: Pubkey,
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
        let _ = (
            &ctx,
            &sponsor,
            &sponsor_operator,
            &claims_operator,
            &oracle_authority,
            &membership_mode,
            &membership_gate_kind,
            &membership_gate_mint,
            &membership_gate_min_amount,
            &membership_invite_authority,
            &allowed_rail_mask,
            &default_funding_priority,
            &oracle_policy_hash,
            &schema_binding_hash,
            &compliance_baseline_hash,
            &pause_flags,
            &plan_id,
            &display_name,
            &organization_ref,
            &metadata_uri,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [108, 11, 28, 140, 226, 164, 239, 113])]
    pub fn update_health_plan_controls(
        ctx: Ctx<UpdateHealthPlanControls>,
        sponsor_operator: Pubkey,
        claims_operator: Pubkey,
        oracle_authority: Pubkey,
        membership_mode: u8,
        membership_gate_kind: u8,
        membership_gate_mint: Pubkey,
        membership_gate_min_amount: u64,
        membership_invite_authority: Pubkey,
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
            membership_mode,
            membership_gate_kind,
            membership_gate_mint,
            membership_gate_min_amount,
            membership_invite_authority,
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
        evidence_requirements_hash: [u8; 32],
        comparability_hash: [u8; 32],
        policy_overrides_hash: [u8; 32],
        cycle_seconds: i64,
        terms_version: u16,
        series_id: String<u32, 32>,
        display_name: String<u32, 64>,
        metadata_uri: String<u32, 160>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &asset_mint,
            &mode,
            &status,
            &adjudication_mode,
            &terms_hash,
            &pricing_hash,
            &payout_hash,
            &reserve_model_hash,
            &evidence_requirements_hash,
            &comparability_hash,
            &policy_overrides_hash,
            &cycle_seconds,
            &terms_version,
            &series_id,
            &display_name,
            &metadata_uri,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [113, 155, 191, 126, 81, 152, 220, 249])]
    pub fn initialize_series_reserve_ledger(
        ctx: Ctx<InitializeSeriesReserveLedger>,
        asset_mint: Pubkey,
    ) -> Result<()> {
        let _ = (&ctx, &asset_mint);
        quasar_handler_port_pending()
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
        evidence_requirements_hash: [u8; 32],
        comparability_hash: [u8; 32],
        policy_overrides_hash: [u8; 32],
        cycle_seconds: i64,
        series_id: String<u32, 32>,
        display_name: String<u32, 64>,
        metadata_uri: String<u32, 160>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &status,
            &adjudication_mode,
            &terms_hash,
            &pricing_hash,
            &payout_hash,
            &reserve_model_hash,
            &evidence_requirements_hash,
            &comparability_hash,
            &policy_overrides_hash,
            &cycle_seconds,
            &series_id,
            &display_name,
            &metadata_uri,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [161, 42, 115, 196, 30, 87, 104, 236])]
    pub fn open_member_position(
        ctx: Ctx<OpenMemberPosition>,
        series_scope: Pubkey,
        subject_commitment: [u8; 32],
        eligibility_status: u8,
        delegated_rights: u32,
        proof_mode: u8,
        token_gate_amount_snapshot: u64,
        invite_id_hash: [u8; 32],
        invite_expires_at: i64,
        anchor_ref: Pubkey,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &series_scope,
            &subject_commitment,
            &eligibility_status,
            &delegated_rights,
            &proof_mode,
            &token_gate_amount_snapshot,
            &invite_id_hash,
            &invite_expires_at,
            &anchor_ref,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [254, 66, 68, 244, 98, 157, 111, 191])]
    pub fn update_member_eligibility(
        ctx: Ctx<UpdateMemberEligibility>,
        eligibility_status: u8,
        delegated_rights: u32,
        active: bool,
    ) -> Result<()> {
        let _ = (&ctx, &eligibility_status, &delegated_rights, &active);
        quasar_handler_port_pending()
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
        let _ = (
            &ctx,
            &policy_series_arg,
            &asset_mint,
            &line_type,
            &funding_priority,
            &committed_amount,
            &caps_hash,
            &line_id,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [150, 210, 161, 31, 50, 12, 224, 32])]
    pub fn fund_sponsor_budget(ctx: Ctx<FundSponsorBudget>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [196, 182, 182, 56, 146, 87, 170, 29])]
    pub fn record_premium_payment(ctx: Ctx<RecordPremiumPayment>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [216, 144, 172, 223, 19, 106, 220, 54])]
    pub fn create_obligation(
        ctx: Ctx<CreateObligation>,
        asset_mint: Pubkey,
        policy_series: Pubkey,
        member_wallet: Pubkey,
        beneficiary: Pubkey,
        claim_case: Pubkey,
        liquidity_pool_arg: Pubkey,
        capital_class_arg: Pubkey,
        allocation_position_arg: Pubkey,
        delivery_mode: u8,
        amount: u64,
        creation_reason_hash: [u8; 32],
        obligation_id: String<u32, 32>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &asset_mint,
            &policy_series,
            &member_wallet,
            &beneficiary,
            &claim_case,
            &liquidity_pool_arg,
            &capital_class_arg,
            &allocation_position_arg,
            &delivery_mode,
            &amount,
            &creation_reason_hash,
            &obligation_id,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [48, 113, 133, 225, 40, 36, 197, 86])]
    pub fn reserve_obligation(ctx: Ctx<ReserveObligation>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [209, 166, 218, 35, 147, 139, 238, 208])]
    pub fn settle_obligation(
        ctx: Ctx<SettleObligation>,
        next_status: u8,
        amount: u64,
        settlement_reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (&ctx, &next_status, &amount, &settlement_reason_hash);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [170, 102, 52, 144, 33, 176, 41, 60])]
    pub fn release_reserve(ctx: Ctx<ReleaseReserve>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [151, 125, 231, 211, 63, 132, 248, 184])]
    pub fn open_claim_case(
        ctx: Ctx<OpenClaimCase>,
        policy_series: Pubkey,
        claimant: Pubkey,
        evidence_ref_hash: [u8; 32],
        claim_id: String<u32, 32>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &policy_series,
            &claimant,
            &evidence_ref_hash,
            &claim_id,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [112, 97, 129, 42, 125, 165, 226, 163])]
    pub fn authorize_claim_recipient(
        ctx: Ctx<AuthorizeClaimRecipient>,
        delegate_recipient: Pubkey,
    ) -> Result<()> {
        let _ = (&ctx, &delegate_recipient);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [52, 246, 203, 87, 244, 143, 132, 131])]
    pub fn attach_claim_evidence_ref(
        ctx: Ctx<AttachClaimEvidenceRef>,
        evidence_ref_hash: [u8; 32],
        decision_support_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (&ctx, &evidence_ref_hash, &decision_support_hash);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [146, 99, 255, 26, 223, 88, 235, 114])]
    pub fn adjudicate_claim_case(
        ctx: Ctx<AdjudicateClaimCase>,
        review_state: u8,
        approved_amount: u64,
        denied_amount: u64,
        reserve_amount: u64,
        decision_support_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (
            &ctx,
            &review_state,
            &approved_amount,
            &denied_amount,
            &reserve_amount,
            &decision_support_hash,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [178, 123, 229, 204, 50, 204, 91, 71])]
    pub fn settle_claim_case(ctx: Ctx<SettleClaimCase>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [21, 218, 248, 73, 41, 97, 47, 212])]
    pub fn settle_claim_case_selected_asset(
        ctx: Ctx<SettleClaimCaseSelectedAsset>,
        claim_credit_amount: u64,
        payout_amount: u64,
        max_overpay_bps: u16,
        settlement_reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (
            &ctx,
            &claim_credit_amount,
            &payout_amount,
            &max_overpay_bps,
            &settlement_reason_hash,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [175, 75, 181, 165, 224, 254, 6, 131])]
    pub fn create_liquidity_pool(
        ctx: Ctx<CreateLiquidityPool>,
        curator: Pubkey,
        allocator: Pubkey,
        sentinel: Pubkey,
        deposit_asset_mint: Pubkey,
        strategy_hash: [u8; 32],
        allowed_exposure_hash: [u8; 32],
        external_yield_adapter_hash: [u8; 32],
        fee_bps: u16,
        redemption_policy: u8,
        pause_flags: u32,
        pool_id: String<u32, 32>,
        display_name: String<u32, 64>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &curator,
            &allocator,
            &sentinel,
            &deposit_asset_mint,
            &strategy_hash,
            &allowed_exposure_hash,
            &external_yield_adapter_hash,
            &fee_bps,
            &redemption_policy,
            &pause_flags,
            &pool_id,
            &display_name,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [0, 161, 244, 112, 151, 137, 35, 221])]
    pub fn create_capital_class(
        ctx: Ctx<CreateCapitalClass>,
        share_mint: Pubkey,
        priority: u8,
        impairment_rank: u8,
        restriction_mode: u8,
        redemption_terms_mode: u8,
        wrapper_metadata_hash: [u8; 32],
        permissioning_hash: [u8; 32],
        fee_bps: u16,
        min_lockup_seconds: i64,
        pause_flags: u32,
        class_id: String<u32, 32>,
        display_name: String<u32, 64>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &share_mint,
            &priority,
            &impairment_rank,
            &restriction_mode,
            &redemption_terms_mode,
            &wrapper_metadata_hash,
            &permissioning_hash,
            &fee_bps,
            &min_lockup_seconds,
            &pause_flags,
            &class_id,
            &display_name,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [34, 4, 113, 70, 79, 197, 244, 109])]
    pub fn update_capital_class_controls(
        ctx: Ctx<UpdateCapitalClassControls>,
        pause_flags: u32,
        queue_only_redemptions: bool,
        active: bool,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (&queue_only_redemptions, &reason_hash);
        crate::capital::update_capital_class_controls(&mut ctx, pause_flags, active)
    }

    #[instruction(discriminator = [54, 194, 211, 94, 197, 61, 228, 202])]
    pub fn update_lp_position_credentialing(
        ctx: Ctx<UpdateLpPositionCredentialing>,
        owner: Pubkey,
        credentialed: bool,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (&ctx, &owner, &credentialed, &reason_hash);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [40, 215, 33, 115, 185, 101, 196, 167])]
    pub fn deposit_into_capital_class(
        ctx: Ctx<DepositIntoCapitalClass>,
        amount: u64,
        shares: u64,
    ) -> Result<()> {
        let _ = (&ctx, &amount, &shares);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [14, 62, 182, 237, 59, 79, 149, 22])]
    pub fn request_redemption(ctx: Ctx<RequestRedemption>, shares: u64) -> Result<()> {
        let _ = (&ctx, &shares);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [244, 120, 208, 73, 216, 200, 158, 93])]
    pub fn process_redemption_queue(ctx: Ctx<ProcessRedemptionQueue>, shares: u64) -> Result<()> {
        let _ = (&ctx, &shares);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [120, 62, 236, 14, 227, 240, 52, 253])]
    pub fn withdraw_protocol_fee_spl(ctx: Ctx<WithdrawProtocolFeeSpl>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [193, 33, 140, 185, 45, 190, 112, 7])]
    pub fn withdraw_protocol_fee_sol(ctx: Ctx<WithdrawProtocolFeeSol>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [43, 146, 116, 123, 106, 69, 242, 104])]
    pub fn withdraw_pool_treasury_spl(
        ctx: Ctx<WithdrawPoolTreasurySpl>,
        amount: u64,
    ) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [50, 115, 51, 120, 221, 37, 200, 169])]
    pub fn withdraw_pool_treasury_sol(
        ctx: Ctx<WithdrawPoolTreasurySol>,
        amount: u64,
    ) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [242, 75, 247, 122, 255, 183, 48, 189])]
    pub fn withdraw_pool_oracle_fee_spl(
        ctx: Ctx<WithdrawPoolOracleFeeSpl>,
        amount: u64,
    ) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [208, 223, 250, 62, 199, 8, 221, 185])]
    pub fn withdraw_pool_oracle_fee_sol(
        ctx: Ctx<WithdrawPoolOracleFeeSol>,
        amount: u64,
    ) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [165, 80, 76, 13, 12, 202, 112, 31])]
    pub fn create_allocation_position(
        ctx: Ctx<CreateAllocationPosition>,
        policy_series: Pubkey,
        cap_amount: u64,
        weight_bps: u16,
        allocation_mode: u8,
        deallocation_only: bool,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &policy_series,
            &cap_amount,
            &weight_bps,
            &allocation_mode,
            &deallocation_only,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [224, 101, 103, 146, 78, 5, 48, 132])]
    pub fn update_allocation_caps(
        ctx: Ctx<UpdateAllocationCaps>,
        cap_amount: u64,
        weight_bps: u16,
        deallocation_only: bool,
        active: bool,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = &reason_hash;
        crate::capital::update_allocation_caps(
            &mut ctx,
            cap_amount,
            weight_bps,
            deallocation_only,
            active,
        )
    }

    #[instruction(discriminator = [146, 129, 60, 205, 88, 225, 60, 183])]
    pub fn allocate_capital(ctx: Ctx<AllocateCapital>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [10, 97, 97, 189, 60, 170, 102, 29])]
    pub fn deallocate_capital(ctx: Ctx<DeallocateCapital>, amount: u64) -> Result<()> {
        let _ = (&ctx, &amount);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [58, 97, 30, 157, 211, 45, 174, 238])]
    pub fn mark_impairment(
        ctx: Ctx<MarkImpairment>,
        amount: u64,
        reason_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (&ctx, &amount, &reason_hash);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [176, 200, 234, 37, 199, 129, 164, 111])]
    pub fn register_oracle(
        ctx: Ctx<RegisterOracle>,
        oracle: Pubkey,
        oracle_type: u8,
        display_name: String<u32, 64>,
        legal_name: String<u32, 96>,
        website_url: String<u32, 160>,
        app_url: String<u32, 160>,
        logo_uri: String<u32, 160>,
        webhook_url: String<u32, 160>,
        supported_schema_key_hashes: Vec<[u8; 32], u32, 16>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &oracle,
            &oracle_type,
            &display_name,
            &legal_name,
            &website_url,
            &app_url,
            &logo_uri,
            &webhook_url,
            &supported_schema_key_hashes,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [1, 252, 166, 132, 45, 24, 23, 233])]
    pub fn claim_oracle(ctx: Ctx<ClaimOracle>) -> Result<()> {
        let _ = &ctx;
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [175, 66, 157, 51, 96, 190, 163, 98])]
    pub fn update_oracle_profile(
        ctx: Ctx<UpdateOracleProfile>,
        oracle_type: u8,
        display_name: String<u32, 64>,
        legal_name: String<u32, 96>,
        website_url: String<u32, 160>,
        app_url: String<u32, 160>,
        logo_uri: String<u32, 160>,
        webhook_url: String<u32, 160>,
        supported_schema_key_hashes: Vec<[u8; 32], u32, 16>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &oracle_type,
            &display_name,
            &legal_name,
            &website_url,
            &app_url,
            &logo_uri,
            &webhook_url,
            &supported_schema_key_hashes,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [140, 225, 146, 45, 210, 81, 225, 223])]
    pub fn set_pool_oracle(ctx: Ctx<SetPoolOracle>, active: bool) -> Result<()> {
        let _ = (&ctx, &active);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [168, 14, 22, 106, 118, 145, 105, 44])]
    pub fn set_pool_oracle_permissions(
        ctx: Ctx<SetPoolOraclePermissions>,
        permissions: u32,
    ) -> Result<()> {
        let _ = (&ctx, &permissions);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [190, 13, 51, 113, 230, 140, 103, 82])]
    pub fn set_pool_oracle_policy(
        ctx: Ctx<SetPoolOraclePolicy>,
        quorum_m: u8,
        quorum_n: u8,
        require_verified_schema: bool,
        oracle_fee_bps: u16,
        allow_delegate_claim: bool,
        challenge_window_secs: u32,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &quorum_m,
            &quorum_n,
            &require_verified_schema,
            &oracle_fee_bps,
            &allow_delegate_claim,
            &challenge_window_secs,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [187, 68, 109, 211, 168, 181, 105, 32])]
    pub fn register_outcome_schema(
        ctx: Ctx<RegisterOutcomeSchema>,
        schema_key_hash: [u8; 32],
        version: u16,
        schema_hash: [u8; 32],
        schema_family: u8,
        visibility: u8,
        schema_key: String<u32, 96>,
        metadata_uri: String<u32, 160>,
    ) -> Result<()> {
        let _ = (
            &ctx,
            &schema_key_hash,
            &version,
            &schema_hash,
            &schema_family,
            &visibility,
            &schema_key,
            &metadata_uri,
        );
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [221, 10, 144, 137, 106, 214, 205, 170])]
    pub fn verify_outcome_schema(ctx: Ctx<VerifyOutcomeSchema>, verified: bool) -> Result<()> {
        let _ = (&ctx, &verified);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [109, 109, 247, 151, 229, 78, 52, 167])]
    pub fn backfill_schema_dependency_ledger(
        ctx: Ctx<BackfillSchemaDependencyLedger>,
        schema_key_hash: [u8; 32],
        pool_rule_addresses: Vec<Pubkey, u32, 32>,
    ) -> Result<()> {
        let _ = (&ctx, &schema_key_hash, &pool_rule_addresses);
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [196, 81, 8, 61, 95, 145, 225, 2])]
    pub fn close_outcome_schema(ctx: Ctx<CloseOutcomeSchema>) -> Result<()> {
        let _ = &ctx;
        quasar_handler_port_pending()
    }

    #[instruction(discriminator = [111, 40, 46, 51, 76, 157, 214, 136])]
    pub fn attest_claim_case(
        ctx: Ctx<AttestClaimCase>,
        decision: u8,
        attestation_hash: [u8; 32],
        attestation_ref_hash: [u8; 32],
        schema_key_hash: [u8; 32],
    ) -> Result<()> {
        let _ = (
            &ctx,
            &decision,
            &attestation_hash,
            &attestation_ref_hash,
            &schema_key_hash,
        );
        quasar_handler_port_pending()
    }
}

#[cfg(test)]
mod tests;
