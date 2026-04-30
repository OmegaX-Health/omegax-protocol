// SPDX-License-Identifier: AGPL-3.0-or-later

//! Capital-class instruction handlers and account validation contexts.

use super::*;

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
