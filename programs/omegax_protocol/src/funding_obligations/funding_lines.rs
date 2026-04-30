// SPDX-License-Identifier: AGPL-3.0-or-later

//! Funding-line instruction handlers and account validation contexts.

use super::*;

pub(crate) fn open_funding_line(
    ctx: Context<OpenFundingLine>,
    args: OpenFundingLineArgs,
) -> Result<()> {
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_id(&args.line_id)?;
    require!(
        ctx.accounts.domain_asset_vault.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        ctx.accounts.domain_asset_ledger.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let funding_line = &mut ctx.accounts.funding_line;
    funding_line.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    funding_line.health_plan = ctx.accounts.health_plan.key();
    funding_line.policy_series = args.policy_series;
    funding_line.asset_mint = args.asset_mint;
    funding_line.line_id = args.line_id;
    funding_line.line_type = args.line_type;
    funding_line.funding_priority = args.funding_priority;
    funding_line.committed_amount = args.committed_amount;
    funding_line.funded_amount = 0;
    funding_line.reserved_amount = 0;
    funding_line.spent_amount = 0;
    funding_line.released_amount = 0;
    funding_line.returned_amount = 0;
    funding_line.status = FUNDING_LINE_STATUS_OPEN;
    funding_line.caps_hash = args.caps_hash;
    funding_line.bump = ctx.bumps.funding_line;

    let funding_line_ledger = &mut ctx.accounts.funding_line_ledger;
    funding_line_ledger.funding_line = funding_line.key();
    funding_line_ledger.asset_mint = args.asset_mint;
    funding_line_ledger.sheet = ReserveBalanceSheet::default();
    funding_line_ledger.bump = ctx.bumps.funding_line_ledger;

    let plan_ledger = &mut ctx.accounts.plan_reserve_ledger;
    if plan_ledger.health_plan == ZERO_PUBKEY {
        plan_ledger.health_plan = ctx.accounts.health_plan.key();
        plan_ledger.asset_mint = args.asset_mint;
        plan_ledger.sheet = ReserveBalanceSheet::default();
        plan_ledger.bump = ctx.bumps.plan_reserve_ledger;
    }

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        require!(
            args.policy_series != ZERO_PUBKEY,
            OmegaXProtocolError::SeriesLedgerUnexpected
        );
        require!(
            series_ledger.policy_series == args.policy_series,
            OmegaXProtocolError::PolicySeriesMismatch
        );
        require!(
            series_ledger.asset_mint == args.asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
    }

    emit!(FundingLineOpenedEvent {
        health_plan: funding_line.health_plan,
        funding_line: funding_line.key(),
        asset_mint: funding_line.asset_mint,
        line_type: funding_line.line_type,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: OpenFundingLineArgs)]
pub struct OpenFundingLine<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(
        init,
        payer = authority,
        space = 8 + FundingLine::INIT_SPACE,
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), args.line_id.as_bytes()],
        bump
    )]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + FundingLineLedger::INIT_SPACE,
        seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PlanReserveLedger::INIT_SPACE,
        seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    pub system_program: Program<'info, System>,
}
