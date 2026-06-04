// SPDX-License-Identifier: AGPL-3.0-or-later

//! Liquidity-pool instruction handlers and account validation contexts.

use super::*;

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_domain_control(
    authority: &Pubkey,
    domain: &ReserveDomainAccountData<'_>,
) -> Result<()> {
    if *authority == domain.domain_admin {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_liquidity_pool(
    ctx: Context<CreateLiquidityPool>,
    args: CreateLiquidityPoolArgs,
) -> Result<()> {
    require_id(&args.pool_id)?;
    require_domain_control(&ctx.accounts.authority.key(), &ctx.accounts.reserve_domain)?;
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

#[cfg(feature = "quasar")]
pub(crate) fn create_liquidity_pool<'info>(
    ctx: &mut Ctx<'info, CreateLiquidityPool<'info>>,
    curator: Pubkey,
    allocator: Pubkey,
    sentinel: Pubkey,
    deposit_asset_mint: Pubkey,
    strategy_hash: [u8; 32],
    allowed_exposure_hash: [u8; 32],
    external_yield_adapter_hash: [u8; 32],
    redemption_policy: u8,
    pause_flags: u32,
    pool_id: &str,
    display_name: &str,
) -> Result<()> {
    require_quasar_id(pool_id)?;
    let authority = *ctx.accounts.authority.address();
    require_quasar_domain_control(&authority, &ctx.accounts.reserve_domain)?;
    require!(
        ctx.accounts.domain_asset_vault.asset_mint == deposit_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    let bump = ctx.accounts.liquidity_pool.bump;
    ctx.accounts.liquidity_pool.set_inner(
        *ctx.accounts.reserve_domain.address(),
        curator,
        allocator,
        sentinel,
        deposit_asset_mint,
        strategy_hash,
        allowed_exposure_hash,
        external_yield_adapter_hash,
        redemption_policy,
        pause_flags,
        0,
        0,
        0,
        0,
        0,
        true,
        0,
        bump,
        pool_id,
        display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: CreateLiquidityPoolArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _curator: Pubkey,
        _allocator: Pubkey,
        _sentinel: Pubkey,
        deposit_asset_mint: Pubkey,
        _strategy_hash: [u8; 32],
        _allowed_exposure_hash: [u8; 32],
        _external_yield_adapter_hash: [u8; 32],
        _redemption_policy: u8,
        _pause_flags: u32,
        pool_id: String<u32, 32>
    )
)]
pub struct CreateLiquidityPool<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            reserve_domain.address(),
            &crate::ID,
            &[SEED_RESERVE_DOMAIN, reserve_domain.domain_id().as_bytes()],
            reserve_domain.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub reserve_domain: Account<ReserveDomainAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, reserve_domain.address().as_ref(), deposit_asset_mint.as_ref()],
            domain_asset_vault.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_vault: &'info Account<DomainAssetVault>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + LiquidityPool::INIT_SPACE,
            seeds = [SEED_LIQUIDITY_POOL, reserve_domain.key().as_ref(), args.pool_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                liquidity_pool.address(),
                &crate::ID,
                &[SEED_LIQUIDITY_POOL, reserve_domain.address().as_ref(), pool_id],
                liquidity_pool.bump,
            ) @ OmegaXProtocolError::LiquidityPoolMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub liquidity_pool: Account<LiquidityPool<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
