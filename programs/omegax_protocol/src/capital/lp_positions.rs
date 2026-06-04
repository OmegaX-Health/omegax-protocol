// SPDX-License-Identifier: AGPL-3.0-or-later

//! LP-position credentialing and deposit instruction handlers and account validation contexts.

use super::*;

#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
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
fn quasar_checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
fn quasar_require_class_access_mode(restriction_mode: u8, credentialed: bool) -> Result<()> {
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
fn quasar_deposit_shares_for_nav(
    net_amount: u64,
    total_shares: u64,
    nav_assets: u64,
    min_shares_out: u64,
) -> Result<u64> {
    require_quasar_positive_amount(net_amount)?;
    let shares = if total_shares == 0 && nav_assets == 0 {
        net_amount
    } else {
        require!(
            total_shares > 0 && nav_assets > 0,
            OmegaXProtocolError::InvalidCapitalShareState
        );
        let computed = (net_amount as u128)
            .checked_mul(total_shares as u128)
            .ok_or(OmegaXProtocolError::ArithmeticError)?
            .checked_div(nav_assets as u128)
            .ok_or(OmegaXProtocolError::ArithmeticError)?;
        u64::try_from(computed).map_err(|_| OmegaXProtocolError::ArithmeticError)?
    };

    require!(shares > 0, OmegaXProtocolError::InvalidDepositShares);
    if min_shares_out > 0 {
        require!(
            shares >= min_shares_out,
            OmegaXProtocolError::MinimumSharesOutNotMet
        );
    }
    Ok(shares)
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
fn quasar_book_inflow_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.funded = quasar_checked_add(sheet.funded, amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn update_lp_position_credentialing(
    ctx: Context<UpdateLpPositionCredentialing>,
    args: UpdateLpPositionCredentialingArgs,
) -> Result<()> {
    require_curator_control(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;

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
pub(crate) fn update_lp_position_credentialing<'info>(
    ctx: &mut Ctx<'info, UpdateLpPositionCredentialing<'info>>,
    owner: Pubkey,
    credentialed: bool,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_curator_control(&authority, &ctx.accounts.liquidity_pool)?;

    let capital_class = *ctx.accounts.capital_class.address();
    let lp_position = &mut ctx.accounts.lp_position;
    require_keys_eq!(
        lp_position.capital_class,
        capital_class,
        OmegaXProtocolError::Unauthorized
    );
    require_keys_eq!(lp_position.owner, owner, OmegaXProtocolError::Unauthorized);
    if !credentialed {
        require!(
            lp_position.shares.get() == 0
                && lp_position.pending_redemption_shares.get() == 0
                && lp_position.pending_redemption_assets.get() == 0,
            OmegaXProtocolError::LPPositionHasActiveCapital
        );
    }

    let shares = lp_position.shares.get();
    let subscription_basis = lp_position.subscription_basis.get();
    let pending_redemption_shares = lp_position.pending_redemption_shares.get();
    let pending_redemption_assets = lp_position.pending_redemption_assets.get();
    let realized_distributions = lp_position.realized_distributions.get();
    let impaired_principal = lp_position.impaired_principal.get();
    let lockup_ends_at = lp_position.lockup_ends_at.get();
    let queue_status = lp_position.queue_status;
    let redemption_sequence = lp_position.redemption_sequence.get();
    let redemption_requested_at = lp_position.redemption_requested_at.get();
    let bump = lp_position.bump;

    lp_position.set_inner(
        capital_class,
        owner,
        shares,
        subscription_basis,
        pending_redemption_shares,
        pending_redemption_assets,
        realized_distributions,
        impaired_principal,
        lockup_ends_at,
        credentialed,
        queue_status,
        redemption_sequence,
        redemption_requested_at,
        bump,
    );

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn deposit_into_capital_class(
    ctx: Context<DepositIntoCapitalClass>,
    args: DepositIntoCapitalClassArgs,
) -> Result<()> {
    require_positive_amount(args.amount)?;
    require_capital_class_active(&ctx.accounts.capital_class)?;
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
    let net_amount = amount;

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
    pool.total_value_locked = checked_add(pool.total_value_locked, net_amount)?;

    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
    book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
    ctx.accounts.pool_class_ledger.total_shares =
        checked_add(ctx.accounts.pool_class_ledger.total_shares, shares)?;

    emit!(CapitalClassDepositEvent {
        capital_class: capital_class.key(),
        owner: lp_position.owner,
        asset_amount: amount,
        shares,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn deposit_into_capital_class<'info>(
    ctx: &mut Ctx<'info, DepositIntoCapitalClass<'info>>,
    amount: u64,
    min_shares_out: u64,
) -> Result<()> {
    require_quasar_positive_amount(amount)?;
    require_quasar_capital_class_active(&ctx.accounts.capital_class)?;
    require!(
        ctx.accounts.capital_class.pause_flags.get() & PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS == 0,
        OmegaXProtocolError::CapitalSubscriptionsPaused
    );
    transfer_to_domain_vault(
        amount,
        ctx.accounts.owner,
        ctx.accounts.source_token_account,
        ctx.accounts.asset_mint,
        ctx.accounts.vault_token_account,
        ctx.accounts.token_program,
        &ctx.accounts.domain_asset_vault,
    )?;

    let net_amount = amount;
    let shares = quasar_deposit_shares_for_nav(
        net_amount,
        ctx.accounts.capital_class.total_shares.get(),
        ctx.accounts.capital_class.nav_assets.get(),
        min_shares_out,
    )?;

    let owner = *ctx.accounts.owner.address();
    let capital_class_key = *ctx.accounts.capital_class.address();
    let restriction_mode = ctx.accounts.capital_class.restriction_mode;
    let min_lockup_seconds = ctx.accounts.capital_class.min_lockup_seconds.get();
    let now_ts = Clock::get()?.unix_timestamp.get();

    let position = &ctx.accounts.lp_position;
    let is_unbound = position.owner == ZERO_PUBKEY && position.capital_class == ZERO_PUBKEY;
    if !is_unbound {
        require_keys_eq!(
            position.capital_class,
            capital_class_key,
            OmegaXProtocolError::Unauthorized
        );
        require_keys_eq!(position.owner, owner, OmegaXProtocolError::Unauthorized);
    }
    quasar_require_class_access_mode(restriction_mode, position.credentialed.get())?;
    require!(
        min_lockup_seconds >= 0,
        OmegaXProtocolError::InvalidLockupSeconds
    );
    let position_shares = quasar_checked_add(position.shares.get(), shares)?;
    let subscription_basis = quasar_checked_add(position.subscription_basis.get(), net_amount)?;
    let lockup_ends_at = now_ts
        .checked_add(min_lockup_seconds)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let pending_redemption_shares = position.pending_redemption_shares.get();
    let pending_redemption_assets = position.pending_redemption_assets.get();
    let realized_distributions = position.realized_distributions.get();
    let impaired_principal = position.impaired_principal.get();
    let credentialed = position.credentialed.get();
    let queue_status = if is_unbound {
        LP_QUEUE_STATUS_NONE
    } else {
        position.queue_status
    };
    let redemption_sequence = position.redemption_sequence.get();
    let redemption_requested_at = position.redemption_requested_at.get();
    let lp_position_bump = position.bump;

    let new_total_shares =
        quasar_checked_add(ctx.accounts.capital_class.total_shares.get(), shares)?;
    let new_nav_assets =
        quasar_checked_add(ctx.accounts.capital_class.nav_assets.get(), net_amount)?;
    let new_pool_tvl = quasar_checked_add(
        ctx.accounts.liquidity_pool.total_value_locked.get(),
        net_amount,
    )?;
    let new_total_assets =
        quasar_checked_add(ctx.accounts.domain_asset_vault.total_assets.get(), amount)?;
    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut pool_class_sheet = ctx.accounts.pool_class_ledger.sheet;
    quasar_book_inflow_sheet(&mut domain_sheet, amount)?;
    quasar_book_inflow_sheet(&mut pool_class_sheet, amount)?;
    let new_ledger_total_shares =
        quasar_checked_add(ctx.accounts.pool_class_ledger.total_shares.get(), shares)?;

    let lp_position = &mut ctx.accounts.lp_position;
    lp_position.set_inner(
        capital_class_key,
        owner,
        position_shares,
        subscription_basis,
        pending_redemption_shares,
        pending_redemption_assets,
        realized_distributions,
        impaired_principal,
        lockup_ends_at,
        credentialed,
        queue_status,
        redemption_sequence,
        redemption_requested_at,
        lp_position_bump,
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
        new_total_shares,
        new_nav_assets,
        allocated_assets,
        reserved_assets,
        impaired_assets,
        pending_redemptions,
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
    let total_allocated = pool.total_allocated.get();
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
        new_pool_tvl,
        total_allocated,
        total_reserved,
        total_impaired,
        total_pending_redemptions,
        active,
        audit_nonce,
        bump,
        &pool_id,
        &display_name,
        ctx.accounts.owner.to_account_view(),
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
        new_total_assets,
        bump,
    );

    let domain_ledger = &mut ctx.accounts.domain_asset_ledger;
    let reserve_domain = domain_ledger.reserve_domain;
    let asset_mint = domain_ledger.asset_mint;
    let bump = domain_ledger.bump;
    domain_ledger.set_inner(reserve_domain, asset_mint, domain_sheet, bump);

    let class_ledger = &mut ctx.accounts.pool_class_ledger;
    let capital_class = class_ledger.capital_class;
    let asset_mint = class_ledger.asset_mint;
    let realized_yield_amount = class_ledger.realized_yield_amount.get();
    let realized_loss_amount = class_ledger.realized_loss_amount.get();
    let bump = class_ledger.bump;
    class_ledger.set_inner(
        capital_class,
        asset_mint,
        pool_class_sheet,
        new_ledger_total_shares,
        realized_yield_amount,
        realized_loss_amount,
        bump,
    );

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(
    not(feature = "quasar"),
    instruction(args: UpdateLpPositionCredentialingArgs)
)]
pub struct UpdateLpPositionCredentialing<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
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
    #[account(seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
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
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = authority,
            space = 8 + LPPosition::INIT_SPACE,
            seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), args.owner.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub lp_position: Account<'info, LPPosition>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                lp_position.address(),
                &crate::ID,
                &[SEED_LP_POSITION, capital_class.address().as_ref(), lp_position.owner.as_ref()],
                lp_position.bump,
            ) @ OmegaXProtocolError::AllocationPositionMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub lp_position: &'info mut Account<LPPosition>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
#[derive(Accounts)]
pub struct DepositIntoCapitalClass<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub owner: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub owner: &'info Signer,
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
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = owner,
            space = 8 + LPPosition::INIT_SPACE,
            seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), owner.key().as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub lp_position: Box<Account<'info, LPPosition>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                lp_position.address(),
                &crate::ID,
                &[SEED_LP_POSITION, capital_class.address().as_ref(), owner.address().as_ref()],
                lp_position.bump,
            ) @ OmegaXProtocolError::AllocationPositionMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub lp_position: &'info mut Account<LPPosition>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub source_token_account: Account<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub source_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub asset_mint: Account<'info, Mint>,
    #[cfg(feature = "quasar")]
    pub asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Program<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
