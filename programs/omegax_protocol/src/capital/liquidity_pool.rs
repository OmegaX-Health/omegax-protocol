// SPDX-License-Identifier: AGPL-3.0-or-later

//! Liquidity-pool instruction handlers and account validation contexts.

use super::*;

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
    require!(
        args.fee_bps <= MAX_CONFIGURED_FEE_BPS,
        OmegaXProtocolError::InvalidBps
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
