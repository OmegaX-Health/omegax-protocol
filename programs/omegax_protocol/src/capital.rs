// SPDX-License-Identifier: AGPL-3.0-or-later

//! Liquidity-pool, capital-class, redemption, allocation, and impairment instruction handlers and account validation contexts.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
use crate::types::*;

pub(crate) fn create_liquidity_pool(
    ctx: Context<CreateLiquidityPool>,
    args: CreateLiquidityPoolArgs,
) -> Result<()> {
    require_id(&args.pool_id)?;
    require_domain_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.reserve_domain,
    )?;
    require!(
        ctx.accounts.domain_asset_vault.asset_mint == args.deposit_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let pool = &mut ctx.accounts.liquidity_pool;
    pool.reserve_domain = ctx.accounts.reserve_domain.key();
    pool.curator = args.curator;
    pool.allocator = args.allocator;
    pool.sentinel = args.sentinel;
    pool.pool_id = args.pool_id;
    pool.display_name = args.display_name;
    pool.deposit_asset_mint = args.deposit_asset_mint;
    pool.strategy_hash = args.strategy_hash;
    pool.allowed_exposure_hash = args.allowed_exposure_hash;
    pool.external_yield_adapter_hash = args.external_yield_adapter_hash;
    pool.fee_bps = args.fee_bps;
    pool.redemption_policy = args.redemption_policy;
    pool.pause_flags = args.pause_flags;
    pool.total_value_locked = 0;
    pool.total_allocated = 0;
    pool.total_reserved = 0;
    pool.total_impaired = 0;
    pool.total_pending_redemptions = 0;
    pool.active = true;
    pool.audit_nonce = 0;
    pool.bump = ctx.bumps.liquidity_pool;

    emit!(LiquidityPoolCreatedEvent {
        reserve_domain: pool.reserve_domain,
        liquidity_pool: pool.key(),
        asset_mint: pool.deposit_asset_mint,
    });

    Ok(())
}

pub(crate) fn create_capital_class(
    ctx: Context<CreateCapitalClass>,
    args: CreateCapitalClassArgs,
) -> Result<()> {
    require_id(&args.class_id)?;
    require_pool_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;

    let capital_class = &mut ctx.accounts.capital_class;
    capital_class.reserve_domain = ctx.accounts.liquidity_pool.reserve_domain;
    capital_class.liquidity_pool = ctx.accounts.liquidity_pool.key();
    capital_class.share_mint = args.share_mint;
    capital_class.class_id = args.class_id;
    capital_class.display_name = args.display_name;
    capital_class.priority = args.priority;
    capital_class.impairment_rank = args.impairment_rank;
    capital_class.restriction_mode = args.restriction_mode;
    capital_class.redemption_terms_mode = args.redemption_terms_mode;
    capital_class.wrapper_metadata_hash = args.wrapper_metadata_hash;
    capital_class.permissioning_hash = args.permissioning_hash;
    capital_class.fee_bps = args.fee_bps;
    capital_class.min_lockup_seconds = args.min_lockup_seconds;
    capital_class.pause_flags = args.pause_flags;
    capital_class.queue_only_redemptions = args.pause_flags & PAUSE_FLAG_REDEMPTION_QUEUE_ONLY != 0
        || ctx.accounts.liquidity_pool.redemption_policy == REDEMPTION_POLICY_QUEUE_ONLY;
    capital_class.total_shares = 0;
    capital_class.nav_assets = 0;
    capital_class.allocated_assets = 0;
    capital_class.reserved_assets = 0;
    capital_class.impaired_assets = 0;
    capital_class.pending_redemptions = 0;
    capital_class.active = true;
    capital_class.bump = ctx.bumps.capital_class;

    let ledger = &mut ctx.accounts.pool_class_ledger;
    ledger.capital_class = capital_class.key();
    ledger.asset_mint = ctx.accounts.liquidity_pool.deposit_asset_mint;
    ledger.sheet = ReserveBalanceSheet::default();
    ledger.total_shares = 0;
    ledger.realized_yield_amount = 0;
    ledger.realized_loss_amount = 0;
    ledger.bump = ctx.bumps.pool_class_ledger;

    Ok(())
}

pub(crate) fn update_capital_class_controls(
    ctx: Context<UpdateCapitalClassControls>,
    args: UpdateCapitalClassControlsArgs,
) -> Result<()> {
    require_pool_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;

    let capital_class = &mut ctx.accounts.capital_class;
    capital_class.pause_flags = args.pause_flags;
    capital_class.queue_only_redemptions = args.queue_only_redemptions;
    capital_class.active = args.active;

    emit!(ScopedControlChangedEvent {
        scope_kind: ScopeKind::CapitalClass as u8,
        scope: capital_class.key(),
        authority: ctx.accounts.authority.key(),
        pause_flags: capital_class.pause_flags,
        reason_hash: args.reason_hash,
        audit_nonce: 0,
    });

    Ok(())
}

pub(crate) fn update_lp_position_credentialing(
    ctx: Context<UpdateLpPositionCredentialing>,
    args: UpdateLpPositionCredentialingArgs,
) -> Result<()> {
    require_curator_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;

    let capital_class_key = ctx.accounts.capital_class.key();
    let lp_position = &mut ctx.accounts.lp_position;
    ensure_lp_position_binding(
        lp_position,
        capital_class_key,
        args.owner,
        ctx.bumps.lp_position,
    )?;
    update_lp_position_credentialing_state(lp_position, args.credentialed)?;

    emit!(LPPositionCredentialingUpdatedEvent {
        capital_class: capital_class_key,
        owner: args.owner,
        authority: ctx.accounts.authority.key(),
        credentialed: args.credentialed,
        reason_hash: args.reason_hash,
    });

    Ok(())
}

pub(crate) fn deposit_into_capital_class(
    ctx: Context<DepositIntoCapitalClass>,
    args: DepositIntoCapitalClassArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_positive_amount(args.amount)?;
    require!(
        ctx.accounts.capital_class.pause_flags & PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS == 0,
        OmegaXProtocolError::CapitalSubscriptionsPaused
    );
    transfer_to_domain_vault(
        args.amount,
        &ctx.accounts.owner,
        &ctx.accounts.source_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        &ctx.accounts.domain_asset_vault,
    )?;

    let amount = args.amount;

    // Phase 1.6 — Pool-treasury entry fee. Validate the canonical fee vault
    // matches (liquidity_pool, deposit_asset_mint), then compute the fee
    // against capital_class.fee_bps. The full `amount` remains physically
    // locked in the DomainAssetVault; the fee carve-out is removed from
    // the LP-side accounting only (subscription_basis, NAV, default shares).
    // pool.total_value_locked still tracks the full physical balance.
    let pool_key = ctx.accounts.liquidity_pool.key();
    let pool_deposit_mint = ctx.accounts.liquidity_pool.deposit_asset_mint;
    let class_fee_bps = ctx.accounts.capital_class.fee_bps;
    let pool_treasury_vault = &ctx.accounts.pool_treasury_vault;
    require_keys_eq!(
        pool_treasury_vault.liquidity_pool,
        pool_key,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require_keys_eq!(
        pool_treasury_vault.asset_mint,
        pool_deposit_mint,
        OmegaXProtocolError::FeeVaultMismatch
    );
    let entry_fee = fee_share_from_bps(amount, class_fee_bps)?;
    let net_amount = checked_sub(amount, entry_fee)?;

    let shares = deposit_shares_for_nav(
        net_amount,
        ctx.accounts.capital_class.total_shares,
        ctx.accounts.capital_class.nav_assets,
        args.shares,
    )?;
    let owner = ctx.accounts.owner.key();
    let capital_class_key = ctx.accounts.capital_class.key();
    let restriction_mode = ctx.accounts.capital_class.restriction_mode;
    let min_lockup_seconds = ctx.accounts.capital_class.min_lockup_seconds;
    let now_ts = Clock::get()?.unix_timestamp;

    let lp_position = &mut ctx.accounts.lp_position;
    ensure_lp_position_binding(lp_position, capital_class_key, owner, ctx.bumps.lp_position)?;
    require_class_access_mode(restriction_mode, lp_position.credentialed)?;
    apply_lp_position_deposit(lp_position, net_amount, shares, min_lockup_seconds, now_ts)?;

    let capital_class = &mut ctx.accounts.capital_class;
    capital_class.total_shares = checked_add(capital_class.total_shares, shares)?;
    capital_class.nav_assets = checked_add(capital_class.nav_assets, net_amount)?;

    let pool = &mut ctx.accounts.liquidity_pool;
    pool.total_value_locked = checked_add(pool.total_value_locked, amount)?;

    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
    book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
    ctx.accounts.pool_class_ledger.total_shares =
        checked_add(ctx.accounts.pool_class_ledger.total_shares, shares)?;

    // Accrue the entry fee to the pool-treasury vault. SPL tokens already
    // sit in the DomainAssetVault from the transfer above; this only updates
    // the rail's claim counter.
    if entry_fee > 0 {
        let vault = &mut ctx.accounts.pool_treasury_vault;
        let vault_key = vault.key();
        let vault_mint = vault.asset_mint;
        let accrued_total = accrue_fee(&mut vault.accrued_fees, entry_fee)?;
        emit!(FeeAccruedEvent {
            vault: vault_key,
            asset_mint: vault_mint,
            amount: entry_fee,
            accrued_total,
        });
    }

    emit!(CapitalClassDepositEvent {
        capital_class: capital_class.key(),
        owner: lp_position.owner,
        asset_amount: amount,
        shares,
    });

    Ok(())
}

pub(crate) fn request_redemption(
    ctx: Context<RequestRedemption>,
    args: RequestRedemptionArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_positive_amount(args.shares)?;
    require_class_access(
        &ctx.accounts.capital_class,
        ctx.accounts.lp_position.credentialed,
    )?;
    require!(
        Clock::get()?.unix_timestamp >= ctx.accounts.lp_position.lockup_ends_at,
        OmegaXProtocolError::LockupActive
    );
    require!(
        ctx.accounts.capital_class.restriction_mode != CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY
            || ctx.accounts.lp_position.credentialed,
        OmegaXProtocolError::RestrictedCapitalClass
    );
    require!(
        args.shares
            <= ctx
                .accounts
                .lp_position
                .shares
                .saturating_sub(ctx.accounts.lp_position.pending_redemption_shares),
        OmegaXProtocolError::AmountExceedsAvailableShares
    );

    let asset_amount = redeemable_assets_for_shares(
        args.shares,
        ctx.accounts.capital_class.total_shares,
        ctx.accounts.capital_class.nav_assets,
    )?;
    ctx.accounts.lp_position.pending_redemption_shares = checked_add(
        ctx.accounts.lp_position.pending_redemption_shares,
        args.shares,
    )?;
    ctx.accounts.lp_position.pending_redemption_assets = checked_add(
        ctx.accounts.lp_position.pending_redemption_assets,
        asset_amount,
    )?;
    ctx.accounts.lp_position.queue_status = LP_QUEUE_STATUS_PENDING;
    ctx.accounts.capital_class.pending_redemptions =
        checked_add(ctx.accounts.capital_class.pending_redemptions, asset_amount)?;
    ctx.accounts.liquidity_pool.total_pending_redemptions = checked_add(
        ctx.accounts.liquidity_pool.total_pending_redemptions,
        asset_amount,
    )?;

    book_pending_redemption(&mut ctx.accounts.pool_class_ledger.sheet, asset_amount)?;
    book_pending_redemption(&mut ctx.accounts.domain_asset_ledger.sheet, asset_amount)?;

    emit!(RedemptionRequestedEvent {
        capital_class: ctx.accounts.capital_class.key(),
        owner: ctx.accounts.owner.key(),
        shares: args.shares,
        asset_amount,
    });

    Ok(())
}

pub(crate) fn process_redemption_queue(
    ctx: Context<ProcessRedemptionQueue>,
    args: ProcessRedemptionQueueArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_curator_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    require_positive_amount(args.shares)?;
    require!(
        args.shares <= ctx.accounts.lp_position.pending_redemption_shares,
        OmegaXProtocolError::AmountExceedsPendingRedemption
    );

    let asset_amount = redemption_assets_to_process(
        args.shares,
        ctx.accounts.lp_position.pending_redemption_shares,
        ctx.accounts.lp_position.pending_redemption_assets,
    )?;

    // Phase 1.6 — Pool-treasury exit fee. Validate the canonical fee vault
    // matches (liquidity_pool, deposit_asset_mint), then compute the carve-out.
    // The full pending request is resolved (LP gives up claim on asset_amount),
    // but only `net_to_lp` physically leaves the vault — the fee carve-out
    // stays in the SPL token account as a treasury claim accrued below.
    let pool_key = ctx.accounts.liquidity_pool.key();
    let pool_deposit_mint = ctx.accounts.liquidity_pool.deposit_asset_mint;
    let class_fee_bps = ctx.accounts.capital_class.fee_bps;
    let pool_treasury_vault = &ctx.accounts.pool_treasury_vault;
    require_keys_eq!(
        pool_treasury_vault.liquidity_pool,
        pool_key,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require_keys_eq!(
        pool_treasury_vault.asset_mint,
        pool_deposit_mint,
        OmegaXProtocolError::FeeVaultMismatch
    );
    let exit_fee = fee_share_from_bps(asset_amount, class_fee_bps)?;
    let net_to_lp = checked_sub(asset_amount, exit_fee)?;

    ctx.accounts.lp_position.pending_redemption_shares = checked_sub(
        ctx.accounts.lp_position.pending_redemption_shares,
        args.shares,
    )?;
    ctx.accounts.lp_position.pending_redemption_assets = checked_sub(
        ctx.accounts.lp_position.pending_redemption_assets,
        asset_amount,
    )?;
    ctx.accounts.lp_position.shares = checked_sub(ctx.accounts.lp_position.shares, args.shares)?;
    // realized_distributions tracks what the LP actually received (post-fee).
    ctx.accounts.lp_position.realized_distributions =
        checked_add(ctx.accounts.lp_position.realized_distributions, net_to_lp)?;
    ctx.accounts.lp_position.queue_status =
        if ctx.accounts.lp_position.pending_redemption_shares == 0 {
            LP_QUEUE_STATUS_PROCESSED
        } else {
            LP_QUEUE_STATUS_PENDING
        };

    // capital_class: LP claim reduced by the full asset_amount (the LP
    // gives up claim on the entire pending payout; the fee portion is
    // reclassified to treasury, not retained by LPs).
    ctx.accounts.capital_class.total_shares =
        checked_sub(ctx.accounts.capital_class.total_shares, args.shares)?;
    ctx.accounts.capital_class.nav_assets =
        checked_sub(ctx.accounts.capital_class.nav_assets, asset_amount)?;
    ctx.accounts.capital_class.pending_redemptions =
        checked_sub(ctx.accounts.capital_class.pending_redemptions, asset_amount)?;
    // pool: total_value_locked tracks physical lock, decreases only by
    // net_to_lp (fee tokens stay locked as treasury claim).
    ctx.accounts.liquidity_pool.total_value_locked =
        checked_sub(ctx.accounts.liquidity_pool.total_value_locked, net_to_lp)?;
    ctx.accounts.liquidity_pool.total_pending_redemptions = checked_sub(
        ctx.accounts.liquidity_pool.total_pending_redemptions,
        asset_amount,
    )?;

    // Physical vault counter — only net_to_lp leaves the SPL token account.
    ctx.accounts.domain_asset_vault.total_assets =
        checked_sub(ctx.accounts.domain_asset_vault.total_assets, net_to_lp)?;

    // Ledger sheets: track the full pending → settled transition. When fee
    // is taken, the sheet temporarily over-states LP outflow vs physical
    // outflow; treasury accrual reconciles via the accrued_fees counter.
    // TODO: fee-aware ledger semantics in a follow-up.
    settle_pending_redemption(
        &mut ctx.accounts.pool_class_ledger,
        asset_amount,
        args.shares,
    )?;
    settle_pending_redemption_domain(&mut ctx.accounts.domain_asset_ledger.sheet, asset_amount)?;

    // PT-2026-04-27-01/02 fix: redemption pays the LP position's owner.
    // There is no delegate-recipient pattern for LP redemptions — the
    // owner is the only authorised recipient.
    require_keys_eq!(
        ctx.accounts.recipient_token_account.owner,
        ctx.accounts.lp_position.owner,
        OmegaXProtocolError::Unauthorized
    );
    transfer_from_domain_vault(
        net_to_lp,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;

    // Accrue the exit fee to the pool-treasury vault. SPL tokens are still
    // physically in the vault_token_account; only the rail's claim counter
    // changes.
    if exit_fee > 0 {
        let vault = &mut ctx.accounts.pool_treasury_vault;
        let vault_key = vault.key();
        let vault_mint = vault.asset_mint;
        let accrued_total = accrue_fee(&mut vault.accrued_fees, exit_fee)?;
        emit!(FeeAccruedEvent {
            vault: vault_key,
            asset_mint: vault_mint,
            amount: exit_fee,
            accrued_total,
        });
    }

    Ok(())
}

pub(crate) fn create_allocation_position(
    ctx: Context<CreateAllocationPosition>,
    args: CreateAllocationPositionArgs,
) -> Result<()> {
    require_pool_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;

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
    require_pool_control(
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

pub(crate) fn mark_impairment(
    ctx: Context<MarkImpairment>,
    args: MarkImpairmentArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_positive_amount(args.amount)?;
    validate_impairment_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        ctx.accounts.obligation.as_deref(),
        ctx.accounts.funding_line.key(),
        &ctx.accounts.funding_line,
    )?;

    let amount = args.amount;
    book_impairment(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_impairment(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
    book_impairment(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_impairment(&mut series_ledger.sheet, amount)?;
    }
    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
        book_impairment(&mut pool_class_ledger.sheet, amount)?;
        pool_class_ledger.realized_loss_amount =
            checked_add(pool_class_ledger.realized_loss_amount, amount)?;
    }
    if let Some(allocation_position) = ctx.accounts.allocation_position.as_deref_mut() {
        allocation_position.impaired_amount =
            checked_add(allocation_position.impaired_amount, amount)?;
        allocation_position.realized_pnl = allocation_position
            .realized_pnl
            .saturating_sub(amount as i64);
    }
    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
        book_impairment(&mut allocation_ledger.sheet, amount)?;
        allocation_ledger.realized_pnl =
            allocation_ledger.realized_pnl.saturating_sub(amount as i64);
    }
    if let Some(obligation) = ctx.accounts.obligation.as_deref_mut() {
        obligation.status = OBLIGATION_STATUS_IMPAIRED;
        obligation.impaired_amount = checked_add(obligation.impaired_amount, amount)?;
        obligation.updated_at = Clock::get()?.unix_timestamp;
    }

    ctx.accounts.funding_line.released_amount =
        checked_add(ctx.accounts.funding_line.released_amount, amount)?;

    emit!(ImpairmentRecordedEvent {
        funding_line: ctx.accounts.funding_line.key(),
        obligation: ctx
            .accounts
            .obligation
            .as_ref()
            .map(|obligation| obligation.key())
            .unwrap_or(ZERO_PUBKEY),
        amount,
        reason_hash: args.reason_hash,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: CreateLiquidityPoolArgs)]
pub struct CreateLiquidityPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(
        init,
        payer = authority,
        space = 8 + LiquidityPool::INIT_SPACE,
        seeds = [SEED_LIQUIDITY_POOL, reserve_domain.key().as_ref(), args.pool_id.as_bytes()],
        bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: CreateCapitalClassArgs)]
pub struct CreateCapitalClass<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(
        init,
        payer = authority,
        space = 8 + CapitalClass::INIT_SPACE,
        seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), args.class_id.as_bytes()],
        bump
    )]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolClassLedger::INIT_SPACE,
        seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
        bump
    )]
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCapitalClassControls<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
}

#[derive(Accounts)]
#[instruction(args: UpdateLpPositionCredentialingArgs)]
pub struct UpdateLpPositionCredentialing<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), args.owner.as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LPPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositIntoCapitalClass<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub lp_position: Box<Account<'info, LPPosition>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint == liquidity_pool.deposit_asset_mint @ OmegaXProtocolError::FeeVaultMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestRedemption<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[account(mut, seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), owner.key().as_ref()], bump = lp_position.bump, constraint = lp_position.owner == owner.key() @ OmegaXProtocolError::Unauthorized)]
    pub lp_position: Account<'info, LPPosition>,
}

#[derive(Accounts)]
pub struct ProcessRedemptionQueue<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(mut, seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), lp_position.owner.as_ref()], bump = lp_position.bump)]
    pub lp_position: Box<Account<'info, LPPosition>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint == liquidity_pool.deposit_asset_mint @ OmegaXProtocolError::FeeVaultMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    // PT-2026-04-27-01/02 fix: outflow CPI accounts. Recipient must be the LP
    // position's owner — there is no delegate-recipient pattern for redemptions.
    #[account(
        constraint = asset_mint.key() == liquidity_pool.deposit_asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
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

#[derive(Accounts)]
pub struct MarkImpairment<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
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
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut)]
    pub obligation: Option<Box<Account<'info, Obligation>>>,
}
