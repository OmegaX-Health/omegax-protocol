// SPDX-License-Identifier: AGPL-3.0-or-later

//! Redemption instruction handlers and account validation contexts.

use super::*;

#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
pub(crate) fn request_redemption(
    ctx: Context<RequestRedemption>,
    args: RequestRedemptionArgs,
) -> Result<()> {
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
    let now_ts = Clock::get()?.unix_timestamp;
    let redemption_sequence = assign_redemption_queue_ticket(
        &mut ctx.accounts.capital_class,
        &mut ctx.accounts.lp_position,
        now_ts,
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
        redemption_sequence,
        requested_at_ts: now_ts,
    });

    Ok(())
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
fn quasar_checked_u128_to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_curator_control(
    authority: &Pubkey,
    pool: &LiquidityPoolAccountData<'_>,
) -> Result<()> {
    if *authority == pool.curator {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
fn require_quasar_class_access_mode(restriction_mode: u8, credentialed: bool) -> Result<()> {
    match restriction_mode {
        CAPITAL_CLASS_RESTRICTION_OPEN => Ok(()),
        CAPITAL_CLASS_RESTRICTION_RESTRICTED | CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY => {
            require!(credentialed, OmegaXProtocolError::RestrictedCapitalClass);
            Ok(())
        }
        _ => err!(OmegaXProtocolError::RestrictedCapitalClass),
    }
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
fn quasar_book_pending_redemption(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.pending_redemption = quasar_checked_add(sheet.pending_redemption, amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
fn quasar_settle_pending_redemption(
    sheet: &mut ReserveBalanceSheet,
    asset_amount: u64,
) -> Result<()> {
    sheet.pending_redemption = quasar_checked_sub(sheet.pending_redemption, asset_amount)?;
    sheet.funded = quasar_checked_sub(sheet.funded, asset_amount)?;
    sheet.settled = quasar_checked_add(sheet.settled, asset_amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
fn quasar_prorata_amount(numerator: u64, denominator: u64, amount: u64) -> Result<u64> {
    require!(
        numerator > 0 && denominator > 0 && numerator <= denominator,
        OmegaXProtocolError::InvalidRedemptionAmount
    );
    let prorata = (amount as u128)
        .checked_mul(numerator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        .checked_div(denominator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let value = quasar_checked_u128_to_u64(prorata)?;
    require!(value > 0, OmegaXProtocolError::InvalidRedemptionAmount);
    Ok(value)
}

#[cfg(feature = "quasar")]
fn quasar_redemption_assets_to_process(
    shares: u64,
    pending_redemption_shares: u64,
    pending_redemption_assets: u64,
) -> Result<u64> {
    if shares == pending_redemption_shares {
        require!(
            pending_redemption_assets > 0,
            OmegaXProtocolError::InvalidRedemptionAmount
        );
        Ok(pending_redemption_assets)
    } else {
        quasar_prorata_amount(shares, pending_redemption_shares, pending_redemption_assets)
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_redeemable_assets_for_shares(
    shares: u64,
    total_shares: u64,
    nav_assets: u64,
) -> Result<u64> {
    quasar_prorata_amount(shares, total_shares, nav_assets)
}

#[cfg(feature = "quasar")]
pub(crate) fn request_redemption<'info>(
    ctx: &mut Ctx<'info, RequestRedemption<'info>>,
    shares: u64,
) -> Result<()> {
    require_quasar_positive_amount(shares)?;
    require_quasar_class_access_mode(
        ctx.accounts.capital_class.restriction_mode,
        ctx.accounts.lp_position.credentialed.get(),
    )?;
    require!(
        Clock::get()?.unix_timestamp.get() >= ctx.accounts.lp_position.lockup_ends_at.get(),
        OmegaXProtocolError::LockupActive
    );
    require!(
        ctx.accounts.capital_class.restriction_mode != CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY
            || ctx.accounts.lp_position.credentialed.get(),
        OmegaXProtocolError::RestrictedCapitalClass
    );
    require!(
        shares
            <= ctx
                .accounts
                .lp_position
                .shares
                .get()
                .saturating_sub(ctx.accounts.lp_position.pending_redemption_shares.get()),
        OmegaXProtocolError::AmountExceedsAvailableShares
    );

    let asset_amount = quasar_redeemable_assets_for_shares(
        shares,
        ctx.accounts.capital_class.total_shares.get(),
        ctx.accounts.capital_class.nav_assets.get(),
    )?;
    let now_ts = Clock::get()?.unix_timestamp.get();
    let existing_pending_shares = ctx.accounts.lp_position.pending_redemption_shares.get();
    let (redemption_sequence, redemption_requested_at, next_redemption_sequence) =
        if existing_pending_shares == 0 {
            let sequence = ctx.accounts.capital_class.next_redemption_sequence.get();
            (sequence, now_ts, quasar_checked_add(sequence, 1)?)
        } else {
            (
                ctx.accounts.lp_position.redemption_sequence.get(),
                ctx.accounts.lp_position.redemption_requested_at.get(),
                ctx.accounts.capital_class.next_redemption_sequence.get(),
            )
        };
    let pending_redemption_shares = quasar_checked_add(existing_pending_shares, shares)?;
    let pending_redemption_assets = quasar_checked_add(
        ctx.accounts.lp_position.pending_redemption_assets.get(),
        asset_amount,
    )?;
    let class_pending_redemptions = quasar_checked_add(
        ctx.accounts.capital_class.pending_redemptions.get(),
        asset_amount,
    )?;
    let pool_total_pending_redemptions = quasar_checked_add(
        ctx.accounts.liquidity_pool.total_pending_redemptions.get(),
        asset_amount,
    )?;

    let mut pool_class_sheet = ctx.accounts.pool_class_ledger.sheet;
    let mut domain_asset_sheet = ctx.accounts.domain_asset_ledger.sheet;
    quasar_book_pending_redemption(&mut pool_class_sheet, asset_amount)?;
    quasar_book_pending_redemption(&mut domain_asset_sheet, asset_amount)?;

    let lp_position = &mut ctx.accounts.lp_position;
    let capital_class = lp_position.capital_class;
    let owner = lp_position.owner;
    let lp_shares = lp_position.shares.get();
    let subscription_basis = lp_position.subscription_basis.get();
    let realized_distributions = lp_position.realized_distributions.get();
    let impaired_principal = lp_position.impaired_principal.get();
    let lockup_ends_at = lp_position.lockup_ends_at.get();
    let credentialed = lp_position.credentialed.get();
    let bump = lp_position.bump;
    lp_position.set_inner(
        capital_class,
        owner,
        lp_shares,
        subscription_basis,
        pending_redemption_shares,
        pending_redemption_assets,
        realized_distributions,
        impaired_principal,
        lockup_ends_at,
        credentialed,
        LP_QUEUE_STATUS_PENDING,
        redemption_sequence,
        redemption_requested_at,
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
    let allocated_assets = capital_class.allocated_assets.get();
    let reserved_assets = capital_class.reserved_assets.get();
    let impaired_assets = capital_class.impaired_assets.get();
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
        allocated_assets,
        reserved_assets,
        impaired_assets,
        class_pending_redemptions,
        next_redemption_sequence,
        next_redemption_to_process,
        active,
        bump,
        &class_id,
        &display_name,
        ctx.accounts.owner.to_account_view(),
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
    let total_allocated = pool.total_allocated.get();
    let total_reserved = pool.total_reserved.get();
    let total_impaired = pool.total_impaired.get();
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
        total_allocated,
        total_reserved,
        total_impaired,
        pool_total_pending_redemptions,
        active,
        audit_nonce,
        bump,
        &pool_id,
        &display_name,
        ctx.accounts.owner.to_account_view(),
        None,
    )?;

    let pool_class_ledger = &mut ctx.accounts.pool_class_ledger;
    let capital_class = pool_class_ledger.capital_class;
    let asset_mint = pool_class_ledger.asset_mint;
    let total_shares = pool_class_ledger.total_shares.get();
    let realized_yield_amount = pool_class_ledger.realized_yield_amount.get();
    let realized_loss_amount = pool_class_ledger.realized_loss_amount.get();
    let bump = pool_class_ledger.bump;
    pool_class_ledger.set_inner(
        capital_class,
        asset_mint,
        pool_class_sheet,
        total_shares,
        realized_yield_amount,
        realized_loss_amount,
        bump,
    );

    let domain_asset_ledger = &mut ctx.accounts.domain_asset_ledger;
    let reserve_domain = domain_asset_ledger.reserve_domain;
    let asset_mint = domain_asset_ledger.asset_mint;
    let bump = domain_asset_ledger.bump;
    domain_asset_ledger.set_inner(reserve_domain, asset_mint, domain_asset_sheet, bump);

    Ok(())
}
#[cfg(not(feature = "quasar"))]
pub(crate) fn process_redemption_queue(
    ctx: Context<ProcessRedemptionQueue>,
    args: ProcessRedemptionQueueArgs,
) -> Result<()> {
    require_curator_control(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;
    require_positive_amount(args.shares)?;
    require!(
        args.shares <= ctx.accounts.lp_position.pending_redemption_shares,
        OmegaXProtocolError::AmountExceedsPendingRedemption
    );
    require_redemption_queue_head(&ctx.accounts.capital_class, &ctx.accounts.lp_position)?;

    let asset_amount = redemption_assets_to_process(
        args.shares,
        ctx.accounts.lp_position.pending_redemption_shares,
        ctx.accounts.lp_position.pending_redemption_assets,
    )?;

    ctx.accounts.lp_position.pending_redemption_shares = checked_sub(
        ctx.accounts.lp_position.pending_redemption_shares,
        args.shares,
    )?;
    ctx.accounts.lp_position.pending_redemption_assets = checked_sub(
        ctx.accounts.lp_position.pending_redemption_assets,
        asset_amount,
    )?;
    ctx.accounts.lp_position.shares = checked_sub(ctx.accounts.lp_position.shares, args.shares)?;
    ctx.accounts.lp_position.realized_distributions = checked_add(
        ctx.accounts.lp_position.realized_distributions,
        asset_amount,
    )?;
    resolve_redemption_queue_status_after_process(
        &mut ctx.accounts.capital_class,
        &mut ctx.accounts.lp_position,
    )?;

    // capital_class: LP claim reduced by the full asset_amount (the LP
    // gives up claim on the entire pending payout; the fee portion is
    // reclassified to treasury, not retained by LPs).
    ctx.accounts.capital_class.total_shares =
        checked_sub(ctx.accounts.capital_class.total_shares, args.shares)?;
    ctx.accounts.capital_class.nav_assets =
        checked_sub(ctx.accounts.capital_class.nav_assets, asset_amount)?;
    ctx.accounts.capital_class.pending_redemptions =
        checked_sub(ctx.accounts.capital_class.pending_redemptions, asset_amount)?;
    // pool: total_value_locked tracks LP claims-paying capital, so the full
    // redeemed asset amount leaves TVL even though the fee remains physically
    // in custody until fee withdrawal.
    ctx.accounts.liquidity_pool.total_value_locked =
        checked_sub(ctx.accounts.liquidity_pool.total_value_locked, asset_amount)?;
    ctx.accounts.liquidity_pool.total_pending_redemptions = checked_sub(
        ctx.accounts.liquidity_pool.total_pending_redemptions,
        asset_amount,
    )?;

    ctx.accounts.domain_asset_vault.total_assets =
        checked_sub(ctx.accounts.domain_asset_vault.total_assets, asset_amount)?;

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
        asset_amount,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn process_redemption_queue<'info>(
    ctx: &mut Ctx<'info, ProcessRedemptionQueue<'info>>,
    shares: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_curator_control(&authority, &ctx.accounts.liquidity_pool)?;
    require_quasar_positive_amount(shares)?;

    let pending_redemption_shares = ctx.accounts.lp_position.pending_redemption_shares.get();
    let pending_redemption_assets = ctx.accounts.lp_position.pending_redemption_assets.get();
    require!(
        shares <= pending_redemption_shares,
        OmegaXProtocolError::AmountExceedsPendingRedemption
    );
    require!(
        ctx.accounts.lp_position.queue_status == LP_QUEUE_STATUS_PENDING
            && pending_redemption_shares > 0,
        OmegaXProtocolError::AmountExceedsPendingRedemption
    );
    require!(
        ctx.accounts.lp_position.redemption_sequence.get()
            == ctx.accounts.capital_class.next_redemption_to_process.get(),
        OmegaXProtocolError::RedemptionQueueOutOfOrder
    );

    let asset_amount = quasar_redemption_assets_to_process(
        shares,
        pending_redemption_shares,
        pending_redemption_assets,
    )?;
    require_keys_eq!(
        *ctx.accounts.recipient_token_account.owner(),
        ctx.accounts.lp_position.owner,
        OmegaXProtocolError::Unauthorized
    );

    let lp_pending_shares = quasar_checked_sub(pending_redemption_shares, shares)?;
    let lp_pending_assets = quasar_checked_sub(pending_redemption_assets, asset_amount)?;
    let lp_shares = quasar_checked_sub(ctx.accounts.lp_position.shares.get(), shares)?;
    let realized_distributions = quasar_checked_add(
        ctx.accounts.lp_position.realized_distributions.get(),
        asset_amount,
    )?;
    let (queue_status, next_redemption_to_process) = if lp_pending_shares == 0 {
        (
            LP_QUEUE_STATUS_PROCESSED,
            quasar_checked_add(
                ctx.accounts.capital_class.next_redemption_to_process.get(),
                1,
            )?,
        )
    } else {
        (
            LP_QUEUE_STATUS_PENDING,
            ctx.accounts.capital_class.next_redemption_to_process.get(),
        )
    };

    let class_total_shares =
        quasar_checked_sub(ctx.accounts.capital_class.total_shares.get(), shares)?;
    let class_nav_assets =
        quasar_checked_sub(ctx.accounts.capital_class.nav_assets.get(), asset_amount)?;
    let class_pending_redemptions = quasar_checked_sub(
        ctx.accounts.capital_class.pending_redemptions.get(),
        asset_amount,
    )?;
    let pool_total_value_locked = quasar_checked_sub(
        ctx.accounts.liquidity_pool.total_value_locked.get(),
        asset_amount,
    )?;
    let pool_total_pending_redemptions = quasar_checked_sub(
        ctx.accounts.liquidity_pool.total_pending_redemptions.get(),
        asset_amount,
    )?;
    let domain_total_assets = quasar_checked_sub(
        ctx.accounts.domain_asset_vault.total_assets.get(),
        asset_amount,
    )?;

    let mut pool_class_sheet = ctx.accounts.pool_class_ledger.sheet;
    quasar_settle_pending_redemption(&mut pool_class_sheet, asset_amount)?;
    let pool_class_total_shares =
        quasar_checked_sub(ctx.accounts.pool_class_ledger.total_shares.get(), shares)?;
    let mut domain_asset_sheet = ctx.accounts.domain_asset_ledger.sheet;
    quasar_settle_pending_redemption(&mut domain_asset_sheet, asset_amount)?;

    transfer_from_domain_vault(
        asset_amount,
        ctx.accounts.domain_asset_vault,
        ctx.accounts.vault_token_account,
        ctx.accounts.recipient_token_account,
        ctx.accounts.asset_mint,
        ctx.accounts.token_program,
    )?;

    let lp_position = &mut ctx.accounts.lp_position;
    let lp_capital_class = lp_position.capital_class;
    let lp_owner = lp_position.owner;
    let subscription_basis = lp_position.subscription_basis.get();
    let impaired_principal = lp_position.impaired_principal.get();
    let lockup_ends_at = lp_position.lockup_ends_at.get();
    let credentialed = lp_position.credentialed.get();
    let redemption_sequence = lp_position.redemption_sequence.get();
    let redemption_requested_at = lp_position.redemption_requested_at.get();
    let bump = lp_position.bump;
    lp_position.set_inner(
        lp_capital_class,
        lp_owner,
        lp_shares,
        subscription_basis,
        lp_pending_shares,
        lp_pending_assets,
        realized_distributions,
        impaired_principal,
        lockup_ends_at,
        credentialed,
        queue_status,
        redemption_sequence,
        redemption_requested_at,
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
    let allocated_assets = capital_class.allocated_assets.get();
    let reserved_assets = capital_class.reserved_assets.get();
    let impaired_assets = capital_class.impaired_assets.get();
    let next_redemption_sequence = capital_class.next_redemption_sequence.get();
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
        class_total_shares,
        class_nav_assets,
        allocated_assets,
        reserved_assets,
        impaired_assets,
        class_pending_redemptions,
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
    let total_allocated = pool.total_allocated.get();
    let total_reserved = pool.total_reserved.get();
    let total_impaired = pool.total_impaired.get();
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
        pool_total_value_locked,
        total_allocated,
        total_reserved,
        total_impaired,
        pool_total_pending_redemptions,
        active,
        audit_nonce,
        bump,
        &pool_id,
        &display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let domain_vault = &mut ctx.accounts.domain_asset_vault;
    let reserve_domain = domain_vault.reserve_domain;
    let asset_mint = domain_vault.asset_mint;
    let vault_token_account = domain_vault.vault_token_account;
    let bump = domain_vault.bump;
    domain_vault.set_inner(
        reserve_domain,
        asset_mint,
        vault_token_account,
        domain_total_assets,
        bump,
    );

    let pool_class_ledger = &mut ctx.accounts.pool_class_ledger;
    let capital_class = pool_class_ledger.capital_class;
    let asset_mint = pool_class_ledger.asset_mint;
    let realized_yield_amount = pool_class_ledger.realized_yield_amount.get();
    let realized_loss_amount = pool_class_ledger.realized_loss_amount.get();
    let bump = pool_class_ledger.bump;
    pool_class_ledger.set_inner(
        capital_class,
        asset_mint,
        pool_class_sheet,
        pool_class_total_shares,
        realized_yield_amount,
        realized_loss_amount,
        bump,
    );

    let domain_asset_ledger = &mut ctx.accounts.domain_asset_ledger;
    let reserve_domain = domain_asset_ledger.reserve_domain;
    let asset_mint = domain_asset_ledger.asset_mint;
    let bump = domain_asset_ledger.bump;
    domain_asset_ledger.set_inner(reserve_domain, asset_mint, domain_asset_sheet, bump);

    Ok(())
}

#[derive(Accounts)]
pub struct RequestRedemption<'info> {
    #[cfg(not(feature = "quasar"))]
    pub owner: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub owner: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
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
    pub capital_class: Account<'info, CapitalClass>,
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
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
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
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
            domain_asset_ledger.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), owner.key().as_ref()], bump = lp_position.bump, constraint = lp_position.owner == owner.key() @ OmegaXProtocolError::Unauthorized)]
    pub lp_position: Account<'info, LPPosition>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            lp_position.address(),
            &crate::ID,
            &[SEED_LP_POSITION, capital_class.address().as_ref(), owner.address().as_ref()],
            lp_position.bump,
        ) @ OmegaXProtocolError::AllocationPositionMismatch,
        constraint = lp_position.owner == *owner.address() @ OmegaXProtocolError::Unauthorized
    )]
    pub lp_position: &'info mut Account<LPPosition>,
}
#[derive(Accounts)]
pub struct ProcessRedemptionQueue<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
            domain_asset_vault.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_vault: &'info mut Account<DomainAssetVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
            domain_asset_ledger.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
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
    #[account(mut, seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), lp_position.owner.as_ref()], bump = lp_position.bump)]
    pub lp_position: Box<Account<'info, LPPosition>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            lp_position.address(),
            &crate::ID,
            &[SEED_LP_POSITION, capital_class.address().as_ref(), lp_position.owner.as_ref()],
            lp_position.bump,
        ) @ OmegaXProtocolError::AllocationPositionMismatch
    )]
    pub lp_position: &'info mut Account<LPPosition>,
    // PT-2026-04-27-01/02 fix: outflow CPI accounts. Recipient must be the LP
    // position's owner — there is no delegate-recipient pattern for redemptions.
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = asset_mint.key() == liquidity_pool.deposit_asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: Account<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *asset_mint.address() == liquidity_pool.deposit_asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = *vault_token_account.address() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    pub recipient_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Program<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
}
