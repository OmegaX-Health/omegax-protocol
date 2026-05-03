// SPDX-License-Identifier: AGPL-3.0-or-later

//! Canonical OmegaX health capital markets program surface.

use anchor_lang::prelude::*;

declare_id!("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");

pub mod args;
pub mod capital;
pub mod claims;
pub mod commitments;
pub mod constants;
pub mod errors;
pub mod events;
pub mod fees;
pub mod funding_obligations;
pub mod governance;
pub mod kernel;
pub mod oracle_schema;
pub mod plans_membership;
pub mod reserve_custody;
pub mod reserve_waterfall;
pub mod state;
pub mod types;

pub use args::*;
pub use capital::*;
pub use claims::*;
pub use commitments::*;
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
// context. Re-export them at crate root so `#[program]` sees the same names
// after moving the contexts into child modules.
pub(crate) use capital::{
    __client_accounts_allocate_capital, __client_accounts_create_allocation_position,
    __client_accounts_create_capital_class, __client_accounts_create_liquidity_pool,
    __client_accounts_deallocate_capital, __client_accounts_deposit_into_capital_class,
    __client_accounts_mark_impairment, __client_accounts_process_redemption_queue,
    __client_accounts_request_redemption, __client_accounts_update_allocation_caps,
    __client_accounts_update_capital_class_controls,
    __client_accounts_update_lp_position_credentialing,
};
pub(crate) use commitments::{
    __client_accounts_activate_direct_premium_commitment,
    __client_accounts_activate_treasury_credit_commitment,
    __client_accounts_activate_waterfall_commitment, __client_accounts_create_commitment_campaign,
    __client_accounts_create_commitment_payment_rail, __client_accounts_deposit_commitment,
    __client_accounts_pause_commitment_campaign, __client_accounts_refund_commitment,
};
pub(crate) use funding_obligations::{
    __client_accounts_create_obligation, __client_accounts_fund_sponsor_budget,
    __client_accounts_open_funding_line, __client_accounts_record_premium_payment,
    __client_accounts_release_reserve, __client_accounts_reserve_obligation,
    __client_accounts_settle_obligation,
};
pub(crate) use reserve_waterfall::{
    __client_accounts_configure_reserve_asset_rail,
    __client_accounts_publish_reserve_asset_rail_price,
};

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

    pub fn create_commitment_campaign(
        ctx: Context<CreateCommitmentCampaign>,
        args: CreateCommitmentCampaignArgs,
    ) -> Result<()> {
        crate::commitments::create_commitment_campaign(ctx, args)
    }

    pub fn create_commitment_payment_rail(
        ctx: Context<CreateCommitmentPaymentRail>,
        args: CreateCommitmentPaymentRailArgs,
    ) -> Result<()> {
        crate::commitments::create_commitment_payment_rail(ctx, args)
    }

    pub fn deposit_commitment(
        ctx: Context<DepositCommitment>,
        args: DepositCommitmentArgs,
    ) -> Result<()> {
        crate::commitments::deposit_commitment(ctx, args)
    }

    pub fn activate_direct_premium_commitment(
        ctx: Context<ActivateDirectPremiumCommitment>,
        args: ActivateCommitmentArgs,
    ) -> Result<()> {
        crate::commitments::activate_direct_premium_commitment(ctx, args)
    }

    pub fn activate_treasury_credit_commitment(
        ctx: Context<ActivateTreasuryCreditCommitment>,
        args: ActivateCommitmentArgs,
    ) -> Result<()> {
        crate::commitments::activate_treasury_credit_commitment(ctx, args)
    }

    pub fn activate_waterfall_commitment(
        ctx: Context<ActivateWaterfallCommitment>,
        args: ActivateCommitmentArgs,
    ) -> Result<()> {
        crate::commitments::activate_waterfall_commitment(ctx, args)
    }

    pub fn refund_commitment(
        ctx: Context<RefundCommitment>,
        args: RefundCommitmentArgs,
    ) -> Result<()> {
        crate::commitments::refund_commitment(ctx, args)
    }

    pub fn pause_commitment_campaign(
        ctx: Context<PauseCommitmentCampaign>,
        args: PauseCommitmentCampaignArgs,
    ) -> Result<()> {
        crate::commitments::pause_commitment_campaign(ctx, args)
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

#[cfg(test)]
mod tests;
