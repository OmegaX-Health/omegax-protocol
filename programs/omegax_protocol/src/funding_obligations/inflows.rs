// SPDX-License-Identifier: AGPL-3.0-or-later

//! Funding and premium inflow instruction handlers and account validation contexts.

use super::*;

pub(crate) fn fund_sponsor_budget(
    ctx: Context<FundSponsorBudget>,
    args: FundSponsorBudgetArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_positive_amount(args.amount)?;
    require!(
        ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_SPONSOR_BUDGET,
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    transfer_to_domain_vault(
        args.amount,
        &ctx.accounts.authority,
        &ctx.accounts.source_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        &ctx.accounts.domain_asset_vault,
    )?;
    validate_optional_series_ledger(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.funding_line.policy_series,
        ctx.accounts.funding_line.asset_mint,
    )?;

    let amount = args.amount;
    let funding_line = &mut ctx.accounts.funding_line;
    funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
    book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_inflow_sheet(&mut series_ledger.sheet, amount)?;
    }

    emit!(FundingFlowRecordedEvent {
        funding_line: funding_line.key(),
        amount,
        flow_kind: FundingFlowKind::SponsorBudgetFunded as u8,
    });

    Ok(())
}
pub(crate) fn record_premium_payment(
    ctx: Context<RecordPremiumPayment>,
    args: RecordPremiumPaymentArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_positive_amount(args.amount)?;
    require!(
        ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_PREMIUM_INCOME,
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    transfer_to_domain_vault(
        args.amount,
        &ctx.accounts.authority,
        &ctx.accounts.source_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        &ctx.accounts.domain_asset_vault,
    )?;
    validate_optional_series_ledger(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.funding_line.policy_series,
        ctx.accounts.funding_line.asset_mint,
    )?;

    let amount = args.amount;
    // Capture immutable values needed after the mutable borrow on funding_line
    // and during the protocol_fee_vault accrual block below.
    let funding_line_key = ctx.accounts.funding_line.key();
    let funding_line_asset_mint = ctx.accounts.funding_line.asset_mint;
    let health_plan_reserve_domain = ctx.accounts.health_plan.reserve_domain;
    let protocol_fee_bps = ctx.accounts.protocol_governance.protocol_fee_bps;
    let fee = fee_share_from_bps(amount, protocol_fee_bps)?;

    let funding_line = &mut ctx.accounts.funding_line;
    funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
    book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_inflow_sheet(&mut series_ledger.sheet, amount)?;
    }

    if fee > 0 {
        book_fee_accrual_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, fee)?;
        book_fee_accrual_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, fee)?;
        book_fee_accrual_sheet(&mut ctx.accounts.funding_line_ledger.sheet, fee)?;
        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            book_fee_accrual_sheet(&mut series_ledger.sheet, fee)?;
        }
    }

    // Phase 1.6 — Protocol fee accrual on premium income.
    // The full premium amount stays physically in the vault until withdrawal,
    // but the fee carve-out leaves reserve capacity at accrual time.
    let vault = &mut ctx.accounts.protocol_fee_vault;
    require_keys_eq!(
        vault.reserve_domain,
        health_plan_reserve_domain,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require_keys_eq!(
        vault.asset_mint,
        funding_line_asset_mint,
        OmegaXProtocolError::FeeVaultMismatch
    );
    if fee > 0 {
        let vault_key = vault.key();
        let vault_mint = vault.asset_mint;
        let accrued_total = accrue_fee(&mut vault.accrued_fees, fee)?;
        emit!(FeeAccruedEvent {
            vault: vault_key,
            asset_mint: vault_mint,
            amount: fee,
            accrued_total,
        });
    }

    emit!(FundingFlowRecordedEvent {
        funding_line: funding_line_key,
        amount,
        flow_kind: FundingFlowKind::PremiumRecorded as u8,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct FundSponsorBudget<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), funding_line.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}
#[derive(Accounts)]
pub struct RecordPremiumPayment<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), funding_line.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == funding_line.asset_mint @ OmegaXProtocolError::FeeVaultMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}
