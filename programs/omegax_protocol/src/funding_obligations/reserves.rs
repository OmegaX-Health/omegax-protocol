// SPDX-License-Identifier: AGPL-3.0-or-later

//! Obligation reserve instruction handlers and account validation contexts.

use super::*;

pub(crate) fn reserve_obligation(
    ctx: Context<ReserveObligation>,
    args: ReserveObligationArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let reserve_amount = args.amount;
    require_positive_amount(reserve_amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_reserve_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        obligation.status == OBLIGATION_STATUS_PROPOSED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        reserve_amount <= obligation.outstanding_amount,
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    validate_treasury_mutation_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;
    require_obligation_reserve_capacity(
        &ctx.accounts.funding_line_ledger.sheet,
        ctx.accounts
            .allocation_position
            .as_deref()
            .map(|account| &**account),
        reserve_amount,
    )?;

    obligation.status = OBLIGATION_STATUS_RESERVED;
    obligation.reserved_amount = reserve_amount;
    obligation.updated_at = now_ts;

    ctx.accounts.funding_line.reserved_amount =
        checked_add(ctx.accounts.funding_line.reserved_amount, reserve_amount)?;
    book_reserve(&mut ctx.accounts.domain_asset_ledger.sheet, reserve_amount)?;
    book_reserve(&mut ctx.accounts.plan_reserve_ledger.sheet, reserve_amount)?;
    book_reserve(&mut ctx.accounts.funding_line_ledger.sheet, reserve_amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_reserve(&mut series_ledger.sheet, reserve_amount)?;
    }

    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
        book_reserve(&mut pool_class_ledger.sheet, reserve_amount)?;
    }

    if let Some(allocation_position) = ctx.accounts.allocation_position.as_deref_mut() {
        allocation_position.reserved_capacity =
            checked_add(allocation_position.reserved_capacity, reserve_amount)?;
        allocation_position.utilized_amount =
            checked_add(allocation_position.utilized_amount, reserve_amount)?;
    }

    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
        book_reserve(&mut allocation_ledger.sheet, reserve_amount)?;
    }

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        let claim_case_key = claim_case.key();
        sync_linked_claim_case_reserve(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            ctx.accounts.health_plan.key(),
            now_ts,
        )?;
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount: reserve_amount,
    });

    Ok(())
}
pub(crate) fn release_reserve(
    ctx: Context<ReleaseReserve>,
    args: ReleaseReserveArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let amount = args.amount;
    require_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_reserve_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        obligation.status == OBLIGATION_STATUS_RESERVED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        amount <= obligation.reserved_amount,
        OmegaXProtocolError::AmountExceedsReservedBalance
    );
    validate_treasury_mutation_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    obligation.reserved_amount = checked_sub(obligation.reserved_amount, amount)?;
    obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
    obligation.status = if obligation.reserved_amount == 0 {
        OBLIGATION_STATUS_CANCELED
    } else {
        OBLIGATION_STATUS_RESERVED
    };
    obligation.updated_at = now_ts;

    ctx.accounts.funding_line.reserved_amount =
        checked_sub(ctx.accounts.funding_line.reserved_amount, amount)?;
    ctx.accounts.funding_line.released_amount =
        checked_add(ctx.accounts.funding_line.released_amount, amount)?;

    release_reserved_scoped(
        &mut ctx.accounts.domain_asset_ledger.sheet,
        &mut ctx.accounts.plan_reserve_ledger.sheet,
        &mut ctx.accounts.funding_line_ledger.sheet,
        ctx.accounts.series_reserve_ledger.as_deref_mut(),
        ctx.accounts.pool_class_ledger.as_deref_mut(),
        ctx.accounts.allocation_position.as_deref_mut(),
        ctx.accounts.allocation_ledger.as_deref_mut(),
        amount,
    )?;

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        let claim_case_key = claim_case.key();
        sync_linked_claim_case_reserve(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            ctx.accounts.health_plan.key(),
            now_ts,
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ReserveObligation<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
}
#[derive(Accounts)]
pub struct ReleaseReserve<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
}
