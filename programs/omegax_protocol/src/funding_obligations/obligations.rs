// SPDX-License-Identifier: AGPL-3.0-or-later

//! Obligation creation instruction handlers and account validation contexts.

use super::*;

pub(crate) fn create_obligation(
    ctx: Context<CreateObligation>,
    args: CreateObligationArgs,
) -> Result<()> {
    require_id(&args.obligation_id)?;
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require!(
        ctx.accounts.funding_line.health_plan == ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        ctx.accounts.funding_line.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_positive_amount(args.amount)?;
    validate_optional_series_ledger(
        ctx.accounts.series_reserve_ledger.as_deref(),
        args.policy_series,
        args.asset_mint,
    )?;
    validate_optional_pool_class_ledger(
        ctx.accounts.pool_class_ledger.as_deref(),
        args.capital_class,
        args.asset_mint,
    )?;
    validate_optional_allocation_ledger(
        ctx.accounts.allocation_ledger.as_deref(),
        args.allocation_position,
        args.asset_mint,
    )?;

    let obligation = &mut ctx.accounts.obligation;
    obligation.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    obligation.asset_mint = args.asset_mint;
    obligation.health_plan = ctx.accounts.health_plan.key();
    obligation.policy_series = args.policy_series;
    obligation.member_wallet = args.member_wallet;
    obligation.beneficiary = args.beneficiary;
    obligation.funding_line = ctx.accounts.funding_line.key();
    obligation.claim_case = args.claim_case;
    obligation.liquidity_pool = args.liquidity_pool;
    obligation.capital_class = args.capital_class;
    obligation.allocation_position = args.allocation_position;
    obligation.obligation_id = args.obligation_id;
    obligation.creation_reason_hash = args.creation_reason_hash;
    obligation.settlement_reason_hash = [0u8; 32];
    obligation.status = OBLIGATION_STATUS_PROPOSED;
    obligation.delivery_mode = args.delivery_mode;
    obligation.principal_amount = args.amount;
    obligation.outstanding_amount = args.amount;
    obligation.reserved_amount = 0;
    obligation.claimable_amount = 0;
    obligation.payable_amount = 0;
    obligation.settled_amount = 0;
    obligation.impaired_amount = 0;
    obligation.recovered_amount = 0;
    obligation.created_at = Clock::get()?.unix_timestamp;
    obligation.updated_at = obligation.created_at;
    obligation.bump = ctx.bumps.obligation;

    book_owed(&mut ctx.accounts.domain_asset_ledger.sheet, args.amount)?;
    book_owed(&mut ctx.accounts.plan_reserve_ledger.sheet, args.amount)?;
    book_owed(&mut ctx.accounts.funding_line_ledger.sheet, args.amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_owed(&mut series_ledger.sheet, args.amount)?;
    }

    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
        book_owed(&mut pool_class_ledger.sheet, args.amount)?;
    }

    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
        book_owed(&mut allocation_ledger.sheet, args.amount)?;
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount: obligation.principal_amount,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: CreateObligationArgs)]
pub struct CreateObligation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + Obligation::INIT_SPACE,
        seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), args.obligation_id.as_bytes()],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,
    pub system_program: Program<'info, System>,
}
