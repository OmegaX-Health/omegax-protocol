// SPDX-License-Identifier: AGPL-3.0-or-later

//! Allocation instruction handlers and account validation contexts.

use super::*;

pub(crate) fn create_allocation_position(
    ctx: Context<CreateAllocationPosition>,
    args: CreateAllocationPositionArgs,
) -> Result<()> {
    require_allocator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AllocationAssetMismatch
    );

    let allocation = &mut ctx.accounts.allocation_position;
    allocation.reserve_domain = ctx.accounts.liquidity_pool.reserve_domain;
    allocation.liquidity_pool = ctx.accounts.liquidity_pool.key();
    allocation.capital_class = ctx.accounts.capital_class.key();
    allocation.health_plan = ctx.accounts.health_plan.key();
    allocation.policy_series = args.policy_series;
    allocation.funding_line = ctx.accounts.funding_line.key();
    allocation.cap_amount = args.cap_amount;
    allocation.weight_bps = args.weight_bps;
    allocation.allocation_mode = args.allocation_mode;
    allocation.allocated_amount = 0;
    allocation.utilized_amount = 0;
    allocation.reserved_capacity = 0;
    allocation.realized_pnl = 0;
    allocation.impaired_amount = 0;
    allocation.deallocation_only = args.deallocation_only;
    allocation.active = true;
    allocation.bump = ctx.bumps.allocation_position;

    let ledger = &mut ctx.accounts.allocation_ledger;
    ledger.allocation_position = allocation.key();
    ledger.asset_mint = ctx.accounts.funding_line.asset_mint;
    ledger.sheet = ReserveBalanceSheet::default();
    ledger.realized_pnl = 0;
    ledger.bump = ctx.bumps.allocation_ledger;

    emit!(AllocationUpdatedEvent {
        allocation_position: allocation.key(),
        capital_class: allocation.capital_class,
        funding_line: allocation.funding_line,
        allocated_amount: allocation.allocated_amount,
        reserved_capacity: allocation.reserved_capacity,
    });

    Ok(())
}
pub(crate) fn update_allocation_caps(
    ctx: Context<UpdateAllocationCaps>,
    args: UpdateAllocationCapsArgs,
) -> Result<()> {
    require_allocator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;

    let allocation = &mut ctx.accounts.allocation_position;
    allocation.cap_amount = args.cap_amount;
    allocation.weight_bps = args.weight_bps;
    allocation.deallocation_only = args.deallocation_only;
    allocation.active = args.active;

    emit!(ScopedControlChangedEvent {
        scope_kind: ScopeKind::AllocationPosition as u8,
        scope: allocation.key(),
        authority: ctx.accounts.authority.key(),
        pause_flags: if allocation.deallocation_only {
            PAUSE_FLAG_ALLOCATION_FREEZE
        } else {
            0
        },
        reason_hash: args.reason_hash,
        audit_nonce: 0,
    });

    Ok(())
}
pub(crate) fn allocate_capital(
    ctx: Context<AllocateCapital>,
    args: AllocateCapitalArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_allocator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;

    let amount = args.amount;
    require_positive_amount(amount)?;
    require!(
        checked_add(ctx.accounts.allocation_position.allocated_amount, amount)?
            <= ctx.accounts.allocation_position.cap_amount,
        OmegaXProtocolError::AllocationCapExceeded
    );
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AllocationAssetMismatch
    );
    require_allocatable_reserve_capacity(&ctx.accounts.pool_class_ledger.sheet, amount)?;

    ctx.accounts.allocation_position.allocated_amount =
        checked_add(ctx.accounts.allocation_position.allocated_amount, amount)?;
    ctx.accounts.capital_class.allocated_assets =
        checked_add(ctx.accounts.capital_class.allocated_assets, amount)?;
    ctx.accounts.liquidity_pool.total_allocated =
        checked_add(ctx.accounts.liquidity_pool.total_allocated, amount)?;

    book_allocation(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
    book_allocation(&mut ctx.accounts.allocation_ledger.sheet, amount)?;

    emit!(AllocationUpdatedEvent {
        allocation_position: ctx.accounts.allocation_position.key(),
        capital_class: ctx.accounts.capital_class.key(),
        funding_line: ctx.accounts.funding_line.key(),
        allocated_amount: ctx.accounts.allocation_position.allocated_amount,
        reserved_capacity: ctx.accounts.allocation_position.reserved_capacity,
    });

    Ok(())
}
pub(crate) fn deallocate_capital(
    ctx: Context<DeallocateCapital>,
    args: DeallocateCapitalArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_allocator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;

    let amount = args.amount;
    require_positive_amount(amount)?;
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AllocationAssetMismatch
    );
    let free_allocated = ctx
        .accounts
        .allocation_position
        .allocated_amount
        .saturating_sub(ctx.accounts.allocation_position.reserved_capacity);
    require!(
        amount <= free_allocated,
        OmegaXProtocolError::InsufficientFreeAllocationCapacity
    );

    ctx.accounts.allocation_position.allocated_amount =
        checked_sub(ctx.accounts.allocation_position.allocated_amount, amount)?;
    ctx.accounts.capital_class.allocated_assets =
        checked_sub(ctx.accounts.capital_class.allocated_assets, amount)?;
    ctx.accounts.liquidity_pool.total_allocated =
        checked_sub(ctx.accounts.liquidity_pool.total_allocated, amount)?;

    release_allocation(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
    release_allocation(&mut ctx.accounts.allocation_ledger.sheet, amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct CreateAllocationPosition<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + AllocationPosition::INIT_SPACE,
        seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()],
        bump
    )]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[account(
        init,
        payer = authority,
        space = 8 + AllocationLedger::INIT_SPACE,
        seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()],
        bump
    )]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct UpdateAllocationCaps<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, allocation_position.capital_class.as_ref(), allocation_position.funding_line.as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Account<'info, AllocationPosition>,
}
#[derive(Accounts)]
pub struct AllocateCapital<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(seeds = [SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[account(mut, seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()], bump = allocation_ledger.bump)]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
}
#[derive(Accounts)]
pub struct DeallocateCapital<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(seeds = [SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[account(mut, seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()], bump = allocation_ledger.bump)]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
}
