// SPDX-License-Identifier: AGPL-3.0-or-later

//! Mixed reserve asset rails and oracle-priced waterfall controls.

use anchor_lang::prelude::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;

pub(crate) fn configure_reserve_asset_rail(
    ctx: Context<ConfigureReserveAssetRail>,
    args: ConfigureReserveAssetRailArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_domain_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.reserve_domain,
    )?;
    require_id(&args.asset_symbol)?;
    require_valid_reserve_asset_role(args.role)?;
    require_valid_reserve_oracle_source(args.oracle_source)?;
    require_bps(args.haircut_bps)?;
    require_bps(args.max_exposure_bps)?;
    require!(
        args.max_staleness_seconds >= 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    if args.capacity_enabled {
        require!(
            args.oracle_source != RESERVE_ORACLE_SOURCE_NONE,
            OmegaXProtocolError::InvalidReserveOracleSource
        );
        require!(
            args.oracle_authority != ZERO_PUBKEY,
            OmegaXProtocolError::Unauthorized
        );
    }

    let rail = &mut ctx.accounts.reserve_asset_rail;
    let already_initialized = rail.reserve_domain != ZERO_PUBKEY;
    if already_initialized {
        require_keys_eq!(
            rail.reserve_domain,
            ctx.accounts.reserve_domain.key(),
            OmegaXProtocolError::ReserveAssetRailMismatch
        );
        require_keys_eq!(
            rail.asset_mint,
            args.asset_mint,
            OmegaXProtocolError::ReserveAssetRailMismatch
        );
    }

    rail.reserve_domain = ctx.accounts.reserve_domain.key();
    rail.asset_mint = args.asset_mint;
    rail.oracle_authority = args.oracle_authority;
    rail.asset_symbol = args.asset_symbol;
    rail.role = args.role;
    rail.payout_priority = args.payout_priority;
    rail.oracle_source = args.oracle_source;
    rail.oracle_feed_id = args.oracle_feed_id;
    rail.max_staleness_seconds = args.max_staleness_seconds;
    rail.haircut_bps = args.haircut_bps;
    rail.max_exposure_bps = args.max_exposure_bps;
    rail.deposit_enabled = args.deposit_enabled;
    rail.payout_enabled = args.payout_enabled;
    rail.capacity_enabled = args.capacity_enabled;
    rail.active = args.active;
    rail.audit_nonce = rail.audit_nonce.saturating_add(1);
    rail.bump = ctx.bumps.reserve_asset_rail;

    emit!(ReserveAssetRailConfiguredEvent {
        reserve_domain: rail.reserve_domain,
        reserve_asset_rail: rail.key(),
        asset_mint: rail.asset_mint,
        role: rail.role,
        payout_priority: rail.payout_priority,
        oracle_source: rail.oracle_source,
        active: rail.active,
        reason_hash: args.reason_hash,
    });

    Ok(())
}

pub(crate) fn publish_reserve_asset_rail_price(
    ctx: Context<PublishReserveAssetRailPrice>,
    args: PublishReserveAssetRailPriceArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_positive_amount(args.price_usd_1e8)?;
    require_bps(args.confidence_bps)?;

    let authority = ctx.accounts.authority.key();
    require!(
        authority == ctx.accounts.reserve_asset_rail.oracle_authority
            || authority == ctx.accounts.protocol_governance.governance_authority,
        OmegaXProtocolError::Unauthorized
    );
    require_reserve_asset_rail_active(&ctx.accounts.reserve_asset_rail)?;
    require!(
        ctx.accounts.reserve_asset_rail.capacity_enabled,
        OmegaXProtocolError::ReserveAssetRailCapacityDisabled
    );

    let rail = &mut ctx.accounts.reserve_asset_rail;
    rail.last_price_usd_1e8 = args.price_usd_1e8;
    rail.last_price_confidence_bps = args.confidence_bps;
    rail.last_price_published_at_ts = args.published_at_ts;
    rail.last_price_slot = Clock::get()?.slot;
    rail.last_price_proof_hash = args.proof_hash;
    rail.audit_nonce = rail.audit_nonce.saturating_add(1);

    emit!(ReserveAssetRailPricePublishedEvent {
        reserve_asset_rail: rail.key(),
        asset_mint: rail.asset_mint,
        oracle_authority: authority,
        price_usd_1e8: rail.last_price_usd_1e8,
        confidence_bps: rail.last_price_confidence_bps,
        published_at_ts: rail.last_price_published_at_ts,
        proof_hash: rail.last_price_proof_hash,
    });

    Ok(())
}

pub(crate) fn require_valid_reserve_asset_role(role: u8) -> Result<()> {
    match role {
        RESERVE_ASSET_ROLE_PRIMARY_STABLE
        | RESERVE_ASSET_ROLE_SECONDARY_STABLE
        | RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL
        | RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidReserveAssetRole),
    }
}

pub(crate) fn require_valid_reserve_oracle_source(source: u8) -> Result<()> {
    match source {
        RESERVE_ORACLE_SOURCE_NONE
        | RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_STREAM
        | RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_FEED
        | RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidReserveOracleSource),
    }
}

pub(crate) fn require_reserve_asset_rail_active(rail: &ReserveAssetRail) -> Result<()> {
    require!(rail.active, OmegaXProtocolError::ReserveAssetRailInactive);
    Ok(())
}

pub(crate) fn require_reserve_asset_rail_deposit_enabled(rail: &ReserveAssetRail) -> Result<()> {
    require_reserve_asset_rail_active(rail)?;
    require!(
        rail.deposit_enabled,
        OmegaXProtocolError::ReserveAssetRailDepositDisabled
    );
    Ok(())
}

pub(crate) fn require_reserve_asset_rail_capacity_enabled(rail: &ReserveAssetRail) -> Result<()> {
    require_reserve_asset_rail_active(rail)?;
    require!(
        rail.capacity_enabled,
        OmegaXProtocolError::ReserveAssetRailCapacityDisabled
    );
    require!(
        rail.last_price_usd_1e8 > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    if rail.max_staleness_seconds > 0 {
        let now = Clock::get()?.unix_timestamp;
        require!(
            rail.last_price_published_at_ts > 0 && rail.last_price_published_at_ts <= now,
            OmegaXProtocolError::ReserveAssetPriceStale
        );
        let age = checked_sub_i64(now, rail.last_price_published_at_ts)?;
        require!(
            age <= rail.max_staleness_seconds,
            OmegaXProtocolError::ReserveAssetPriceStale
        );
    }
    Ok(())
}

fn require_bps(value: u16) -> Result<()> {
    require!(value <= 10_000, OmegaXProtocolError::InvalidBps);
    Ok(())
}

fn checked_sub_i64(left: i64, right: i64) -> Result<i64> {
    left.checked_sub(right)
        .ok_or(error!(OmegaXProtocolError::ArithmeticError))
}

#[derive(Accounts)]
#[instruction(args: ConfigureReserveAssetRailArgs)]
pub struct ConfigureReserveAssetRail<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()],
        bump = reserve_domain.bump,
    )]
    pub reserve_domain: Box<Account<'info, ReserveDomain>>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + ReserveAssetRail::INIT_SPACE,
        seeds = [SEED_RESERVE_ASSET_RAIL, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump,
    )]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PublishReserveAssetRailPrice<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        mut,
        seeds = [
            SEED_RESERVE_ASSET_RAIL,
            reserve_asset_rail.reserve_domain.as_ref(),
            reserve_asset_rail.asset_mint.as_ref(),
        ],
        bump = reserve_asset_rail.bump,
    )]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
}
