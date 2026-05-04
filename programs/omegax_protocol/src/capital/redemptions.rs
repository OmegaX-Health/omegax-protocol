// SPDX-License-Identifier: AGPL-3.0-or-later

//! Redemption instruction handlers and account validation contexts.

use super::*;

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
    require!(
        exit_fee < asset_amount,
        OmegaXProtocolError::FeeVaultBpsMisconfigured
    );
    let net_to_lp = checked_sub(asset_amount, exit_fee)?;
    require_positive_amount(net_to_lp)?;

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
    // pool: total_value_locked tracks LP claims-paying capital, so the full
    // redeemed asset amount leaves TVL even though the fee remains physically
    // in custody until fee withdrawal.
    ctx.accounts.liquidity_pool.total_value_locked =
        checked_sub(ctx.accounts.liquidity_pool.total_value_locked, asset_amount)?;
    ctx.accounts.liquidity_pool.total_pending_redemptions = checked_sub(
        ctx.accounts.liquidity_pool.total_pending_redemptions,
        asset_amount,
    )?;

    // Physical vault counter — only net_to_lp leaves the SPL token account.
    ctx.accounts.domain_asset_vault.total_assets =
        checked_sub(ctx.accounts.domain_asset_vault.total_assets, net_to_lp)?;

    // Ledger sheets track the full pending -> settled transition. The fee
    // remains in DomainAssetVault.total_assets until withdrawn but is no
    // longer LP reserve capacity.
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
