// SPDX-License-Identifier: AGPL-3.0-or-later

//! Capital-class instruction handlers and account validation contexts.

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

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_capital_class(
    ctx: Context<CreateCapitalClass>,
    args: CreateCapitalClassArgs,
) -> Result<()> {
    require_id(&args.class_id)?;
    require_curator_control(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;
    require!(
        args.min_lockup_seconds >= 0,
        OmegaXProtocolError::InvalidLockupSeconds
    );

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
    capital_class.min_lockup_seconds = args.min_lockup_seconds;
    capital_class.pause_flags = args.pause_flags;
    capital_class.queue_only_redemptions = derive_queue_only_redemptions(
        args.pause_flags,
        ctx.accounts.liquidity_pool.redemption_policy,
    );
    capital_class.total_shares = 0;
    capital_class.nav_assets = 0;
    capital_class.allocated_assets = 0;
    capital_class.reserved_assets = 0;
    capital_class.impaired_assets = 0;
    capital_class.pending_redemptions = 0;
    capital_class.next_redemption_sequence = 0;
    capital_class.next_redemption_to_process = 0;
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
#[cfg(not(feature = "quasar"))]
pub(crate) fn update_capital_class_controls(
    ctx: Context<UpdateCapitalClassControls>,
    args: UpdateCapitalClassControlsArgs,
) -> Result<()> {
    require_curator_control(&ctx.accounts.authority.key(), &ctx.accounts.liquidity_pool)?;

    let capital_class = &mut ctx.accounts.capital_class;
    capital_class.pause_flags = args.pause_flags;
    capital_class.queue_only_redemptions = derive_queue_only_redemptions(
        args.pause_flags,
        ctx.accounts.liquidity_pool.redemption_policy,
    );
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

#[cfg(feature = "quasar")]
pub(crate) fn create_capital_class<'info>(
    ctx: &mut Ctx<'info, CreateCapitalClass<'info>>,
    share_mint: Pubkey,
    priority: u8,
    impairment_rank: u8,
    restriction_mode: u8,
    redemption_terms_mode: u8,
    wrapper_metadata_hash: [u8; 32],
    permissioning_hash: [u8; 32],
    min_lockup_seconds: i64,
    pause_flags: u32,
    class_id: &str,
    display_name: &str,
) -> Result<()> {
    require_quasar_id(class_id)?;
    let authority = *ctx.accounts.authority.address();
    require_quasar_curator_control(&authority, &ctx.accounts.liquidity_pool)?;
    require!(
        min_lockup_seconds >= 0,
        OmegaXProtocolError::InvalidLockupSeconds
    );

    let capital_class_key = *ctx.accounts.capital_class.address();
    let capital_class_bump = ctx.accounts.capital_class.bump;
    let queue_only_redemptions = derive_quasar_queue_only_redemptions(
        pause_flags,
        ctx.accounts.liquidity_pool.redemption_policy,
    );
    ctx.accounts.capital_class.set_inner(
        ctx.accounts.liquidity_pool.reserve_domain,
        *ctx.accounts.liquidity_pool.address(),
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
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        true,
        capital_class_bump,
        class_id,
        display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let pool_class_ledger_bump = ctx.accounts.pool_class_ledger.bump;
    ctx.accounts.pool_class_ledger.set_inner(
        capital_class_key,
        ctx.accounts.liquidity_pool.deposit_asset_mint,
        ReserveBalanceSheet::default(),
        0,
        0,
        0,
        pool_class_ledger_bump,
    );

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
#[inline(always)]
fn derive_quasar_queue_only_redemptions(pause_flags: u32, redemption_policy: u8) -> bool {
    pause_flags & PAUSE_FLAG_REDEMPTION_QUEUE_ONLY != 0
        || redemption_policy == REDEMPTION_POLICY_QUEUE_ONLY
}

#[cfg(feature = "quasar")]
pub(crate) fn update_capital_class_controls<'info>(
    ctx: &mut Ctx<'info, UpdateCapitalClassControls<'info>>,
    pause_flags: u32,
    active: bool,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_curator_control(&authority, &ctx.accounts.liquidity_pool)?;

    let capital_class = &mut ctx.accounts.capital_class;
    let queue_only_redemptions = derive_quasar_queue_only_redemptions(
        pause_flags,
        ctx.accounts.liquidity_pool.redemption_policy,
    );
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
    let total_shares = capital_class.total_shares.get();
    let nav_assets = capital_class.nav_assets.get();
    let allocated_assets = capital_class.allocated_assets.get();
    let reserved_assets = capital_class.reserved_assets.get();
    let impaired_assets = capital_class.impaired_assets.get();
    let pending_redemptions = capital_class.pending_redemptions.get();
    let next_redemption_sequence = capital_class.next_redemption_sequence.get();
    let next_redemption_to_process = capital_class.next_redemption_to_process.get();
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

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: CreateCapitalClassArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _share_mint: Pubkey,
        _priority: u8,
        _impairment_rank: u8,
        _restriction_mode: u8,
        _redemption_terms_mode: u8,
        _wrapper_metadata_hash: [u8; 32],
        _permissioning_hash: [u8; 32],
        _min_lockup_seconds: i64,
        _pause_flags: u32,
        class_id: String<u32, 32>
    )
)]
pub struct CreateCapitalClass<'info> {
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
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + CapitalClass::INIT_SPACE,
            seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), args.class_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub capital_class: Account<'info, CapitalClass>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                capital_class.address(),
                &crate::ID,
                &[SEED_CAPITAL_CLASS, liquidity_pool.address().as_ref(), class_id],
                capital_class.bump,
            ) @ OmegaXProtocolError::CapitalClassMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub capital_class: Account<CapitalClass<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + PoolClassLedger::INIT_SPACE,
            seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                pool_class_ledger.address(),
                &crate::ID,
                &[SEED_POOL_CLASS_LEDGER, capital_class.address().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
                pool_class_ledger.bump,
            ) @ OmegaXProtocolError::CapitalClassMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub pool_class_ledger: &'info mut Account<PoolClassLedger>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
#[derive(Accounts)]
pub struct UpdateCapitalClassControls<'info> {
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
}
