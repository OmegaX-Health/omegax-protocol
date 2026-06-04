// SPDX-License-Identifier: AGPL-3.0-or-later

//! Allocation instruction handlers and account validation contexts.

use super::*;

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_allocation_position(
    ctx: Context<CreateAllocationPosition>,
    args: CreateAllocationPositionArgs,
) -> Result<()> {
    require_allocator(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AllocationAssetMismatch
    );
    require_keys_eq!(
        ctx.accounts.capital_class.reserve_domain,
        ctx.accounts.liquidity_pool.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        ctx.accounts.capital_class.liquidity_pool,
        ctx.accounts.liquidity_pool.key(),
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.health_plan.reserve_domain,
        ctx.accounts.liquidity_pool.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.health_plan,
        ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.policy_series,
        args.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        ctx.accounts.funding_line.status == FUNDING_LINE_STATUS_OPEN,
        OmegaXProtocolError::FundingLineMismatch
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

#[cfg(feature = "quasar")]
pub(crate) fn create_allocation_position<'info>(
    ctx: &mut Ctx<'info, CreateAllocationPosition<'info>>,
    policy_series: Pubkey,
    cap_amount: u64,
    weight_bps: u16,
    allocation_mode: u8,
    deallocation_only: bool,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_allocator(&authority, &ctx.accounts.liquidity_pool)?;
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AllocationAssetMismatch
    );
    require_keys_eq!(
        ctx.accounts.capital_class.reserve_domain,
        ctx.accounts.liquidity_pool.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        ctx.accounts.capital_class.liquidity_pool,
        *ctx.accounts.liquidity_pool.address(),
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.health_plan.reserve_domain,
        ctx.accounts.liquidity_pool.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.health_plan,
        *ctx.accounts.health_plan.address(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.policy_series,
        policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        ctx.accounts.funding_line.status == FUNDING_LINE_STATUS_OPEN,
        OmegaXProtocolError::FundingLineMismatch
    );

    let allocation_position_key = *ctx.accounts.allocation_position.address();
    let allocation_position_bump = ctx.accounts.allocation_position.bump;
    ctx.accounts.allocation_position.set_inner(
        ctx.accounts.liquidity_pool.reserve_domain,
        *ctx.accounts.liquidity_pool.address(),
        *ctx.accounts.capital_class.address(),
        *ctx.accounts.health_plan.address(),
        policy_series,
        *ctx.accounts.funding_line.address(),
        cap_amount,
        weight_bps,
        allocation_mode,
        0,
        0,
        0,
        0,
        0,
        deallocation_only,
        true,
        allocation_position_bump,
    );

    let allocation_ledger_bump = ctx.accounts.allocation_ledger.bump;
    ctx.accounts.allocation_ledger.set_inner(
        allocation_position_key,
        ctx.accounts.funding_line.asset_mint,
        ReserveBalanceSheet::default(),
        0,
        allocation_ledger_bump,
    );

    Ok(())
}
#[cfg(not(feature = "quasar"))]
pub(crate) fn update_allocation_caps(
    ctx: Context<UpdateAllocationCaps>,
    args: UpdateAllocationCapsArgs,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.allocation_position.liquidity_pool,
        ctx.accounts.liquidity_pool.key(),
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_allocator(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;

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

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_allocator(authority: &Pubkey, pool: &LiquidityPoolAccountData<'_>) -> Result<()> {
    if *authority == pool.allocator || *authority == pool.curator {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_liquidity_pool_active(pool: &LiquidityPoolAccountData<'_>) -> Result<()> {
    require!(
        pool.active.get(),
        OmegaXProtocolError::LiquidityPoolInactive
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_capital_class_active(capital_class: &CapitalClassAccountData<'_>) -> Result<()> {
    require!(
        capital_class.active.get(),
        OmegaXProtocolError::CapitalClassInactive
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_allocation_position_allocatable(
    allocation_position: &AllocationPosition,
) -> Result<()> {
    require!(
        allocation_position.active.get() && !allocation_position.deallocation_only.get(),
        OmegaXProtocolError::AllocationPositionInactive
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
fn quasar_recompute_sheet(sheet: &mut ReserveBalanceSheet) -> Result<()> {
    let encumbered = sheet
        .reserved
        .checked_add(sheet.claimable)
        .and_then(|value| value.checked_add(sheet.payable))
        .and_then(|value| value.checked_add(sheet.impaired))
        .and_then(|value| value.checked_add(sheet.pending_redemption))
        .and_then(|value| value.checked_add(sheet.restricted))
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.free = sheet.funded.saturating_sub(encumbered);
    let redeemable_encumbered = encumbered
        .checked_add(sheet.allocated)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.redeemable = sheet.funded.saturating_sub(redeemable_encumbered);
    Ok(())
}

#[cfg(feature = "quasar")]
fn quasar_book_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = quasar_checked_add(sheet.allocated, amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
fn quasar_release_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = quasar_checked_sub(sheet.allocated, amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_allocatable_reserve_capacity(
    sheet: &ReserveBalanceSheet,
    amount: u64,
) -> Result<()> {
    require!(
        sheet.redeemable >= amount,
        OmegaXProtocolError::InsufficientFreeReserveCapacity
    );
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn update_allocation_caps<'info>(
    ctx: &mut Ctx<'info, UpdateAllocationCaps<'info>>,
    cap_amount: u64,
    weight_bps: u16,
    deallocation_only: bool,
    active: bool,
) -> Result<()> {
    let liquidity_pool = *ctx.accounts.liquidity_pool.address();
    require_keys_eq!(
        ctx.accounts.allocation_position.liquidity_pool,
        liquidity_pool,
        OmegaXProtocolError::LiquidityPoolMismatch
    );

    let authority = *ctx.accounts.authority.address();
    require_quasar_allocator(&authority, &ctx.accounts.liquidity_pool)?;

    let allocation = &mut ctx.accounts.allocation_position;
    let reserve_domain = allocation.reserve_domain;
    let capital_class = allocation.capital_class;
    let health_plan = allocation.health_plan;
    let policy_series = allocation.policy_series;
    let funding_line = allocation.funding_line;
    let allocation_mode = allocation.allocation_mode;
    let allocated_amount = allocation.allocated_amount.get();
    let utilized_amount = allocation.utilized_amount.get();
    let reserved_capacity = allocation.reserved_capacity.get();
    let realized_pnl = allocation.realized_pnl.get();
    let impaired_amount = allocation.impaired_amount.get();
    let bump = allocation.bump;

    allocation.set_inner(
        reserve_domain,
        liquidity_pool,
        capital_class,
        health_plan,
        policy_series,
        funding_line,
        cap_amount,
        weight_bps,
        allocation_mode,
        allocated_amount,
        utilized_amount,
        reserved_capacity,
        realized_pnl,
        impaired_amount,
        deallocation_only,
        active,
        bump,
    );

    Ok(())
}
#[cfg(not(feature = "quasar"))]
pub(crate) fn allocate_capital(
    ctx: Context<AllocateCapital>,
    args: AllocateCapitalArgs,
) -> Result<()> {
    require_allocator(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;
    require_liquidity_pool_active(&ctx.accounts.liquidity_pool)?;
    require_capital_class_active(&ctx.accounts.capital_class)?;
    require_allocation_position_allocatable(&ctx.accounts.allocation_position)?;

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

#[cfg(feature = "quasar")]
pub(crate) fn allocate_capital<'info>(
    ctx: &mut Ctx<'info, AllocateCapital<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_allocator(&authority, &ctx.accounts.liquidity_pool)?;
    require_quasar_liquidity_pool_active(&ctx.accounts.liquidity_pool)?;
    require_quasar_capital_class_active(&ctx.accounts.capital_class)?;
    require_quasar_allocation_position_allocatable(&ctx.accounts.allocation_position)?;
    require_quasar_positive_amount(amount)?;

    let allocation_position = &ctx.accounts.allocation_position;
    let allocated_amount = allocation_position.allocated_amount.get();
    let reserved_capacity = allocation_position.reserved_capacity.get();
    let new_allocated_amount = quasar_checked_add(allocated_amount, amount)?;
    require!(
        new_allocated_amount <= allocation_position.cap_amount.get(),
        OmegaXProtocolError::AllocationCapExceeded
    );
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AllocationAssetMismatch
    );
    require_quasar_allocatable_reserve_capacity(&ctx.accounts.pool_class_ledger.sheet, amount)?;

    let new_capital_class_allocated_assets =
        quasar_checked_add(ctx.accounts.capital_class.allocated_assets.get(), amount)?;
    let new_pool_total_allocated =
        quasar_checked_add(ctx.accounts.liquidity_pool.total_allocated.get(), amount)?;
    let mut pool_class_sheet = ctx.accounts.pool_class_ledger.sheet;
    let mut allocation_sheet = ctx.accounts.allocation_ledger.sheet;
    quasar_book_allocation(&mut pool_class_sheet, amount)?;
    quasar_book_allocation(&mut allocation_sheet, amount)?;

    let allocation = &mut ctx.accounts.allocation_position;
    let reserve_domain = allocation.reserve_domain;
    let liquidity_pool = allocation.liquidity_pool;
    let capital_class = allocation.capital_class;
    let health_plan = allocation.health_plan;
    let policy_series = allocation.policy_series;
    let funding_line = allocation.funding_line;
    let cap_amount = allocation.cap_amount.get();
    let weight_bps = allocation.weight_bps.get();
    let allocation_mode = allocation.allocation_mode;
    let utilized_amount = allocation.utilized_amount.get();
    let realized_pnl = allocation.realized_pnl.get();
    let impaired_amount = allocation.impaired_amount.get();
    let deallocation_only = allocation.deallocation_only.get();
    let active = allocation.active.get();
    let bump = allocation.bump;
    allocation.set_inner(
        reserve_domain,
        liquidity_pool,
        capital_class,
        health_plan,
        policy_series,
        funding_line,
        cap_amount,
        weight_bps,
        allocation_mode,
        new_allocated_amount,
        utilized_amount,
        reserved_capacity,
        realized_pnl,
        impaired_amount,
        deallocation_only,
        active,
        bump,
    );

    let capital_class = &mut ctx.accounts.capital_class;
    let reserve_domain = capital_class.reserve_domain;
    let liquidity_pool = capital_class.liquidity_pool;
    let share_mint = capital_class.share_mint;
    let priority = capital_class.priority;
    let impairment_rank = capital_class.impairment_rank;
    let restriction_mode = capital_class.restriction_mode;
    let redemption_terms_mode = capital_class.redemption_terms_mode;
    let wrapper_metadata_hash = capital_class.wrapper_metadata_hash;
    let permissioning_hash = capital_class.permissioning_hash;
    let min_lockup_seconds = capital_class.min_lockup_seconds.get();
    let pause_flags = capital_class.pause_flags.get();
    let queue_only_redemptions = capital_class.queue_only_redemptions.get();
    let total_shares = capital_class.total_shares.get();
    let nav_assets = capital_class.nav_assets.get();
    let reserved_assets = capital_class.reserved_assets.get();
    let impaired_assets = capital_class.impaired_assets.get();
    let pending_redemptions = capital_class.pending_redemptions.get();
    let next_redemption_sequence = capital_class.next_redemption_sequence.get();
    let next_redemption_to_process = capital_class.next_redemption_to_process.get();
    let active = capital_class.active.get();
    let bump = capital_class.bump;
    let class_id = capital_class.class_id().to_owned();
    let display_name = capital_class.display_name().to_owned();
    capital_class.set_inner(
        reserve_domain,
        liquidity_pool,
        share_mint,
        priority,
        impairment_rank,
        restriction_mode,
        redemption_terms_mode,
        wrapper_metadata_hash,
        permissioning_hash,
        min_lockup_seconds,
        pause_flags,
        queue_only_redemptions,
        total_shares,
        nav_assets,
        new_capital_class_allocated_assets,
        reserved_assets,
        impaired_assets,
        pending_redemptions,
        next_redemption_sequence,
        next_redemption_to_process,
        active,
        bump,
        &class_id,
        &display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let pool = &mut ctx.accounts.liquidity_pool;
    let reserve_domain = pool.reserve_domain;
    let curator = pool.curator;
    let allocator = pool.allocator;
    let sentinel = pool.sentinel;
    let deposit_asset_mint = pool.deposit_asset_mint;
    let strategy_hash = pool.strategy_hash;
    let allowed_exposure_hash = pool.allowed_exposure_hash;
    let external_yield_adapter_hash = pool.external_yield_adapter_hash;
    let redemption_policy = pool.redemption_policy;
    let pause_flags = pool.pause_flags.get();
    let total_value_locked = pool.total_value_locked.get();
    let total_reserved = pool.total_reserved.get();
    let total_impaired = pool.total_impaired.get();
    let total_pending_redemptions = pool.total_pending_redemptions.get();
    let active = pool.active.get();
    let audit_nonce = pool.audit_nonce.get();
    let bump = pool.bump;
    let pool_id = pool.pool_id().to_owned();
    let display_name = pool.display_name().to_owned();
    pool.set_inner(
        reserve_domain,
        curator,
        allocator,
        sentinel,
        deposit_asset_mint,
        strategy_hash,
        allowed_exposure_hash,
        external_yield_adapter_hash,
        redemption_policy,
        pause_flags,
        total_value_locked,
        new_pool_total_allocated,
        total_reserved,
        total_impaired,
        total_pending_redemptions,
        active,
        audit_nonce,
        bump,
        &pool_id,
        &display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let pool_class_ledger = &mut ctx.accounts.pool_class_ledger;
    let ledger_capital_class = pool_class_ledger.capital_class;
    let ledger_asset_mint = pool_class_ledger.asset_mint;
    let ledger_total_shares = pool_class_ledger.total_shares.get();
    let ledger_realized_yield_amount = pool_class_ledger.realized_yield_amount.get();
    let ledger_realized_loss_amount = pool_class_ledger.realized_loss_amount.get();
    let ledger_bump = pool_class_ledger.bump;
    pool_class_ledger.set_inner(
        ledger_capital_class,
        ledger_asset_mint,
        pool_class_sheet,
        ledger_total_shares,
        ledger_realized_yield_amount,
        ledger_realized_loss_amount,
        ledger_bump,
    );

    let allocation_ledger = &mut ctx.accounts.allocation_ledger;
    let ledger_allocation_position = allocation_ledger.allocation_position;
    let ledger_asset_mint = allocation_ledger.asset_mint;
    let ledger_realized_pnl = allocation_ledger.realized_pnl.get();
    let ledger_bump = allocation_ledger.bump;
    allocation_ledger.set_inner(
        ledger_allocation_position,
        ledger_asset_mint,
        allocation_sheet,
        ledger_realized_pnl,
        ledger_bump,
    );

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn deallocate_capital(
    ctx: Context<DeallocateCapital>,
    args: DeallocateCapitalArgs,
) -> Result<()> {
    require_allocator(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;

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

#[cfg(feature = "quasar")]
pub(crate) fn deallocate_capital<'info>(
    ctx: &mut Ctx<'info, DeallocateCapital<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_allocator(&authority, &ctx.accounts.liquidity_pool)?;
    require_quasar_positive_amount(amount)?;
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AllocationAssetMismatch
    );

    let allocation_position = &ctx.accounts.allocation_position;
    let allocated_amount = allocation_position.allocated_amount.get();
    let reserved_capacity = allocation_position.reserved_capacity.get();
    let free_allocated = allocated_amount.saturating_sub(reserved_capacity);
    require!(
        amount <= free_allocated,
        OmegaXProtocolError::InsufficientFreeAllocationCapacity
    );

    let new_allocated_amount = quasar_checked_sub(allocated_amount, amount)?;
    let new_capital_class_allocated_assets =
        quasar_checked_sub(ctx.accounts.capital_class.allocated_assets.get(), amount)?;
    let new_pool_total_allocated =
        quasar_checked_sub(ctx.accounts.liquidity_pool.total_allocated.get(), amount)?;
    let mut pool_class_sheet = ctx.accounts.pool_class_ledger.sheet;
    let mut allocation_sheet = ctx.accounts.allocation_ledger.sheet;
    quasar_release_allocation(&mut pool_class_sheet, amount)?;
    quasar_release_allocation(&mut allocation_sheet, amount)?;

    let allocation = &mut ctx.accounts.allocation_position;
    let reserve_domain = allocation.reserve_domain;
    let liquidity_pool = allocation.liquidity_pool;
    let capital_class = allocation.capital_class;
    let health_plan = allocation.health_plan;
    let policy_series = allocation.policy_series;
    let funding_line = allocation.funding_line;
    let cap_amount = allocation.cap_amount.get();
    let weight_bps = allocation.weight_bps.get();
    let allocation_mode = allocation.allocation_mode;
    let utilized_amount = allocation.utilized_amount.get();
    let realized_pnl = allocation.realized_pnl.get();
    let impaired_amount = allocation.impaired_amount.get();
    let deallocation_only = allocation.deallocation_only.get();
    let active = allocation.active.get();
    let bump = allocation.bump;
    allocation.set_inner(
        reserve_domain,
        liquidity_pool,
        capital_class,
        health_plan,
        policy_series,
        funding_line,
        cap_amount,
        weight_bps,
        allocation_mode,
        new_allocated_amount,
        utilized_amount,
        reserved_capacity,
        realized_pnl,
        impaired_amount,
        deallocation_only,
        active,
        bump,
    );

    let capital_class = &mut ctx.accounts.capital_class;
    let reserve_domain = capital_class.reserve_domain;
    let liquidity_pool = capital_class.liquidity_pool;
    let share_mint = capital_class.share_mint;
    let priority = capital_class.priority;
    let impairment_rank = capital_class.impairment_rank;
    let restriction_mode = capital_class.restriction_mode;
    let redemption_terms_mode = capital_class.redemption_terms_mode;
    let wrapper_metadata_hash = capital_class.wrapper_metadata_hash;
    let permissioning_hash = capital_class.permissioning_hash;
    let min_lockup_seconds = capital_class.min_lockup_seconds.get();
    let pause_flags = capital_class.pause_flags.get();
    let queue_only_redemptions = capital_class.queue_only_redemptions.get();
    let total_shares = capital_class.total_shares.get();
    let nav_assets = capital_class.nav_assets.get();
    let reserved_assets = capital_class.reserved_assets.get();
    let impaired_assets = capital_class.impaired_assets.get();
    let pending_redemptions = capital_class.pending_redemptions.get();
    let next_redemption_sequence = capital_class.next_redemption_sequence.get();
    let next_redemption_to_process = capital_class.next_redemption_to_process.get();
    let active = capital_class.active.get();
    let bump = capital_class.bump;
    let class_id = capital_class.class_id().to_owned();
    let display_name = capital_class.display_name().to_owned();
    capital_class.set_inner(
        reserve_domain,
        liquidity_pool,
        share_mint,
        priority,
        impairment_rank,
        restriction_mode,
        redemption_terms_mode,
        wrapper_metadata_hash,
        permissioning_hash,
        min_lockup_seconds,
        pause_flags,
        queue_only_redemptions,
        total_shares,
        nav_assets,
        new_capital_class_allocated_assets,
        reserved_assets,
        impaired_assets,
        pending_redemptions,
        next_redemption_sequence,
        next_redemption_to_process,
        active,
        bump,
        &class_id,
        &display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let pool = &mut ctx.accounts.liquidity_pool;
    let reserve_domain = pool.reserve_domain;
    let curator = pool.curator;
    let allocator = pool.allocator;
    let sentinel = pool.sentinel;
    let deposit_asset_mint = pool.deposit_asset_mint;
    let strategy_hash = pool.strategy_hash;
    let allowed_exposure_hash = pool.allowed_exposure_hash;
    let external_yield_adapter_hash = pool.external_yield_adapter_hash;
    let redemption_policy = pool.redemption_policy;
    let pause_flags = pool.pause_flags.get();
    let total_value_locked = pool.total_value_locked.get();
    let total_reserved = pool.total_reserved.get();
    let total_impaired = pool.total_impaired.get();
    let total_pending_redemptions = pool.total_pending_redemptions.get();
    let active = pool.active.get();
    let audit_nonce = pool.audit_nonce.get();
    let bump = pool.bump;
    let pool_id = pool.pool_id().to_owned();
    let display_name = pool.display_name().to_owned();
    pool.set_inner(
        reserve_domain,
        curator,
        allocator,
        sentinel,
        deposit_asset_mint,
        strategy_hash,
        allowed_exposure_hash,
        external_yield_adapter_hash,
        redemption_policy,
        pause_flags,
        total_value_locked,
        new_pool_total_allocated,
        total_reserved,
        total_impaired,
        total_pending_redemptions,
        active,
        audit_nonce,
        bump,
        &pool_id,
        &display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let pool_class_ledger = &mut ctx.accounts.pool_class_ledger;
    let ledger_capital_class = pool_class_ledger.capital_class;
    let ledger_asset_mint = pool_class_ledger.asset_mint;
    let ledger_total_shares = pool_class_ledger.total_shares.get();
    let ledger_realized_yield_amount = pool_class_ledger.realized_yield_amount.get();
    let ledger_realized_loss_amount = pool_class_ledger.realized_loss_amount.get();
    let ledger_bump = pool_class_ledger.bump;
    pool_class_ledger.set_inner(
        ledger_capital_class,
        ledger_asset_mint,
        pool_class_sheet,
        ledger_total_shares,
        ledger_realized_yield_amount,
        ledger_realized_loss_amount,
        ledger_bump,
    );

    let allocation_ledger = &mut ctx.accounts.allocation_ledger;
    let ledger_allocation_position = allocation_ledger.allocation_position;
    let ledger_asset_mint = allocation_ledger.asset_mint;
    let ledger_realized_pnl = allocation_ledger.realized_pnl.get();
    let ledger_bump = allocation_ledger.bump;
    allocation_ledger.set_inner(
        ledger_allocation_position,
        ledger_asset_mint,
        allocation_sheet,
        ledger_realized_pnl,
        ledger_bump,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct CreateAllocationPosition<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            liquidity_pool.address(),
            &crate::ID,
            &[SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id().as_bytes()],
            liquidity_pool.bump,
        ) @ OmegaXProtocolError::LiquidityPoolMismatch
    )]
    pub liquidity_pool: Account<LiquidityPoolAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            capital_class.address(),
            &crate::ID,
            &[SEED_CAPITAL_CLASS, liquidity_pool.address().as_ref(), capital_class.class_id().as_bytes()],
            capital_class.bump,
        ) @ OmegaXProtocolError::CapitalClassMismatch
    )]
    pub capital_class: Account<CapitalClassAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            health_plan.address(),
            &crate::ID,
            &[SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id().as_bytes()],
            health_plan.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch
    )]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            funding_line.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE, health_plan.address().as_ref(), funding_line.line_id().as_bytes()],
            funding_line.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch
    )]
    pub funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + AllocationPosition::INIT_SPACE,
            seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                allocation_position.address(),
                &crate::ID,
                &[SEED_ALLOCATION_POSITION, capital_class.address().as_ref(), funding_line.address().as_ref()],
                allocation_position.bump,
            ) @ OmegaXProtocolError::AllocationPositionMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub allocation_position: &'info mut Account<AllocationPosition>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + AllocationLedger::INIT_SPACE,
            seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                allocation_ledger.address(),
                &crate::ID,
                &[SEED_ALLOCATION_LEDGER, allocation_position.address().as_ref(), funding_line.asset_mint.as_ref()],
                allocation_ledger.bump,
            ) @ OmegaXProtocolError::AllocationPositionMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub allocation_ledger: &'info mut Account<AllocationLedger>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
#[derive(Accounts)]
pub struct UpdateAllocationCaps<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            liquidity_pool.address(),
            &crate::ID,
            &[SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id().as_bytes()],
            liquidity_pool.bump,
        ) @ OmegaXProtocolError::LiquidityPoolMismatch
    )]
    pub liquidity_pool: Account<LiquidityPoolAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, allocation_position.capital_class.as_ref(), allocation_position.funding_line.as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Account<'info, AllocationPosition>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            allocation_position.address(),
            &crate::ID,
            &[SEED_ALLOCATION_POSITION, allocation_position.capital_class.as_ref(), allocation_position.funding_line.as_ref()],
            allocation_position.bump,
        ) @ OmegaXProtocolError::AllocationPositionMismatch
    )]
    pub allocation_position: &'info mut Account<AllocationPosition>,
}
#[derive(Accounts)]
pub struct AllocateCapital<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            liquidity_pool.address(),
            &crate::ID,
            &[SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id().as_bytes()],
            liquidity_pool.bump,
        ) @ OmegaXProtocolError::LiquidityPoolMismatch
    )]
    pub liquidity_pool: Account<LiquidityPoolAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            capital_class.address(),
            &crate::ID,
            &[SEED_CAPITAL_CLASS, liquidity_pool.address().as_ref(), capital_class.class_id().as_bytes()],
            capital_class.bump,
        ) @ OmegaXProtocolError::CapitalClassMismatch
    )]
    pub capital_class: Account<CapitalClassAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            pool_class_ledger.address(),
            &crate::ID,
            &[SEED_POOL_CLASS_LEDGER, capital_class.address().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
            pool_class_ledger.bump,
        ) @ OmegaXProtocolError::CapitalClassMismatch
    )]
    pub pool_class_ledger: &'info mut Account<PoolClassLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            funding_line.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id().as_bytes()],
            funding_line.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch
    )]
    pub funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            allocation_position.address(),
            &crate::ID,
            &[SEED_ALLOCATION_POSITION, capital_class.address().as_ref(), funding_line.address().as_ref()],
            allocation_position.bump,
        ) @ OmegaXProtocolError::AllocationPositionMismatch
    )]
    pub allocation_position: &'info mut Account<AllocationPosition>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()], bump = allocation_ledger.bump)]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            allocation_ledger.address(),
            &crate::ID,
            &[SEED_ALLOCATION_LEDGER, allocation_position.address().as_ref(), funding_line.asset_mint.as_ref()],
            allocation_ledger.bump,
        ) @ OmegaXProtocolError::AllocationPositionMismatch
    )]
    pub allocation_ledger: &'info mut Account<AllocationLedger>,
}
#[derive(Accounts)]
pub struct DeallocateCapital<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            liquidity_pool.address(),
            &crate::ID,
            &[SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id().as_bytes()],
            liquidity_pool.bump,
        ) @ OmegaXProtocolError::LiquidityPoolMismatch
    )]
    pub liquidity_pool: Account<LiquidityPoolAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            capital_class.address(),
            &crate::ID,
            &[SEED_CAPITAL_CLASS, liquidity_pool.address().as_ref(), capital_class.class_id().as_bytes()],
            capital_class.bump,
        ) @ OmegaXProtocolError::CapitalClassMismatch
    )]
    pub capital_class: Account<CapitalClassAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            pool_class_ledger.address(),
            &crate::ID,
            &[SEED_POOL_CLASS_LEDGER, capital_class.address().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
            pool_class_ledger.bump,
        ) @ OmegaXProtocolError::CapitalClassMismatch
    )]
    pub pool_class_ledger: &'info mut Account<PoolClassLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            funding_line.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id().as_bytes()],
            funding_line.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch
    )]
    pub funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            allocation_position.address(),
            &crate::ID,
            &[SEED_ALLOCATION_POSITION, capital_class.address().as_ref(), funding_line.address().as_ref()],
            allocation_position.bump,
        ) @ OmegaXProtocolError::AllocationPositionMismatch
    )]
    pub allocation_position: &'info mut Account<AllocationPosition>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()], bump = allocation_ledger.bump)]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            allocation_ledger.address(),
            &crate::ID,
            &[SEED_ALLOCATION_LEDGER, allocation_position.address().as_ref(), funding_line.asset_mint.as_ref()],
            allocation_ledger.bump,
        ) @ OmegaXProtocolError::AllocationPositionMismatch
    )]
    pub allocation_ledger: &'info mut Account<AllocationLedger>,
}
