// SPDX-License-Identifier: AGPL-3.0-or-later

//! LP-position credentialing and deposit instruction handlers and account validation contexts.

use super::*;

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
    // against capital_class.fee_bps. DomainAssetVault.total_assets tracks the
    // full physical balance until withdrawal; LP reserve ledgers and pool TVL
    // track net claims-paying capital.
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
    pool.total_value_locked = checked_add(pool.total_value_locked, net_amount)?;

    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
    book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
    if entry_fee > 0 {
        book_fee_accrual_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, entry_fee)?;
        book_fee_accrual_sheet(&mut ctx.accounts.pool_class_ledger.sheet, entry_fee)?;
    }
    ctx.accounts.pool_class_ledger.total_shares =
        checked_add(ctx.accounts.pool_class_ledger.total_shares, shares)?;

    // Accrue the entry fee to the pool-treasury vault. SPL tokens already
    // sit in the DomainAssetVault from the transfer above; reserve capacity
    // was netted above, and this updates the rail's claim counter.
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
