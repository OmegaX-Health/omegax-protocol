// SPDX-License-Identifier: AGPL-3.0-or-later

//! Mixed reserve asset rails and oracle-priced waterfall controls.

use crate::platform::*;

#[cfg(not(feature = "quasar"))]
use crate::args::*;
use crate::constants::*;
use crate::errors::*;
#[cfg(not(feature = "quasar"))]
use crate::events::*;
#[cfg(not(feature = "quasar"))]
use crate::kernel::*;
use crate::state::*;
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
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
    require_bps(args.max_confidence_bps)?;
    let price_required = args.capacity_enabled || args.payout_enabled;
    require!(
        args.max_staleness_seconds >= 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    if price_required {
        require!(
            args.oracle_source != RESERVE_ORACLE_SOURCE_NONE,
            OmegaXProtocolError::InvalidReserveOracleSource
        );
        require!(
            args.oracle_authority != ZERO_PUBKEY,
            OmegaXProtocolError::Unauthorized
        );
        require!(
            args.max_staleness_seconds > 0,
            OmegaXProtocolError::ReserveAssetPriceInvalid
        );
        require!(
            args.max_confidence_bps > 0,
            OmegaXProtocolError::ReserveAssetPriceInvalid
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
    rail.max_confidence_bps = args.max_confidence_bps;
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

#[cfg(not(feature = "quasar"))]
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
        ctx.accounts.reserve_asset_rail.capacity_enabled
            || ctx.accounts.reserve_asset_rail.payout_enabled,
        OmegaXProtocolError::ReserveAssetRailCapacityDisabled
    );
    require!(
        ctx.accounts.reserve_asset_rail.max_confidence_bps > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        args.confidence_bps <= ctx.accounts.reserve_asset_rail.max_confidence_bps,
        OmegaXProtocolError::ReserveAssetPriceConfidenceTooWide
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

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_protocol_not_paused(governance: &ProtocolGovernance) -> Result<()> {
    require!(
        !governance.emergency_pause.get(),
        OmegaXProtocolError::ProtocolEmergencyPaused
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_bps(value: u16) -> Result<()> {
    require!(value <= 10_000, OmegaXProtocolError::InvalidBps);
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_reserve_asset_rail_active(rail: &ReserveAssetRailAccountData<'_>) -> Result<()> {
    require!(
        rail.active.get(),
        OmegaXProtocolError::ReserveAssetRailInactive
    );
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn publish_reserve_asset_rail_price<'info>(
    ctx: &mut Ctx<'info, PublishReserveAssetRailPrice<'info>>,
    price_usd_1e8: u64,
    confidence_bps: u16,
    published_at_ts: i64,
    proof_hash: [u8; 32],
) -> Result<()> {
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_quasar_positive_amount(price_usd_1e8)?;
    require_quasar_bps(confidence_bps)?;

    let authority = *ctx.accounts.authority.address();
    require!(
        authority == ctx.accounts.reserve_asset_rail.oracle_authority
            || authority == ctx.accounts.protocol_governance.governance_authority,
        OmegaXProtocolError::Unauthorized
    );
    require_quasar_reserve_asset_rail_active(&ctx.accounts.reserve_asset_rail)?;
    require!(
        ctx.accounts.reserve_asset_rail.capacity_enabled.get()
            || ctx.accounts.reserve_asset_rail.payout_enabled.get(),
        OmegaXProtocolError::ReserveAssetRailCapacityDisabled
    );
    require!(
        ctx.accounts.reserve_asset_rail.max_confidence_bps.get() > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        confidence_bps <= ctx.accounts.reserve_asset_rail.max_confidence_bps.get(),
        OmegaXProtocolError::ReserveAssetPriceConfidenceTooWide
    );

    let rail = &mut ctx.accounts.reserve_asset_rail;
    let reserve_domain = rail.reserve_domain;
    let asset_mint = rail.asset_mint;
    let oracle_authority = rail.oracle_authority;
    let role = rail.role;
    let payout_priority = rail.payout_priority;
    let oracle_source = rail.oracle_source;
    let oracle_feed_id = rail.oracle_feed_id;
    let max_staleness_seconds = rail.max_staleness_seconds.get();
    let max_confidence_bps = rail.max_confidence_bps.get();
    let haircut_bps = rail.haircut_bps.get();
    let max_exposure_bps = rail.max_exposure_bps.get();
    let deposit_enabled = rail.deposit_enabled.get();
    let payout_enabled = rail.payout_enabled.get();
    let capacity_enabled = rail.capacity_enabled.get();
    let active = rail.active.get();
    let audit_nonce = rail.audit_nonce.get().saturating_add(1);
    let bump = rail.bump;
    let asset_symbol = rail.asset_symbol().to_owned();
    let last_price_slot = Clock::get()?.slot.get();

    rail.set_inner(
        reserve_domain,
        asset_mint,
        oracle_authority,
        role,
        payout_priority,
        oracle_source,
        oracle_feed_id,
        max_staleness_seconds,
        max_confidence_bps,
        haircut_bps,
        max_exposure_bps,
        deposit_enabled,
        payout_enabled,
        capacity_enabled,
        active,
        price_usd_1e8,
        confidence_bps,
        published_at_ts,
        last_price_slot,
        proof_hash,
        audit_nonce,
        bump,
        &asset_symbol,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_valid_reserve_asset_role(role: u8) -> Result<()> {
    match role {
        RESERVE_ASSET_ROLE_PRIMARY_STABLE
        | RESERVE_ASSET_ROLE_SECONDARY_STABLE
        | RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL
        | RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidReserveAssetRole),
    }
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_valid_reserve_oracle_source(source: u8) -> Result<()> {
    match source {
        RESERVE_ORACLE_SOURCE_NONE
        | RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_STREAM
        | RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_FEED
        | RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidReserveOracleSource),
    }
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_reserve_asset_rail_active(
    rail: &ReserveAssetRailAccountData<'_>,
) -> Result<()> {
    require!(rail.active, OmegaXProtocolError::ReserveAssetRailInactive);
    Ok(())
}

#[cfg(test)]
#[cfg(all(test, not(feature = "quasar")))]
pub(crate) fn require_reserve_asset_rail_capacity_enabled(
    rail: &ReserveAssetRailAccountData<'_>,
) -> Result<()> {
    require_reserve_asset_rail_active(rail)?;
    require!(
        rail.capacity_enabled,
        OmegaXProtocolError::ReserveAssetRailCapacityDisabled
    );
    require_fresh_reserve_asset_price(rail)
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_reserve_asset_rail_payout_enabled(
    rail: &ReserveAssetRailAccountData<'_>,
) -> Result<()> {
    require_reserve_asset_rail_active(rail)?;
    require!(
        rail.payout_enabled,
        OmegaXProtocolError::ReserveAssetRailPayoutDisabled
    );
    require_fresh_reserve_asset_price(rail)
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_fresh_reserve_asset_price(
    rail: &ReserveAssetRailAccountData<'_>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require_fresh_reserve_asset_price_at(rail, now)
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_fresh_reserve_asset_price_at(
    rail: &ReserveAssetRailAccountData<'_>,
    now: i64,
) -> Result<()> {
    require!(
        rail.last_price_usd_1e8 > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        rail.max_staleness_seconds > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        rail.max_confidence_bps > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        rail.last_price_confidence_bps <= rail.max_confidence_bps,
        OmegaXProtocolError::ReserveAssetPriceConfidenceTooWide
    );
    require!(
        rail.last_price_published_at_ts > 0 && rail.last_price_published_at_ts <= now,
        OmegaXProtocolError::ReserveAssetPriceStale
    );
    let age = checked_sub_i64(now, rail.last_price_published_at_ts)?;
    require!(
        age <= rail.max_staleness_seconds,
        OmegaXProtocolError::ReserveAssetPriceStale
    );
    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn reserve_asset_value_usd_1e8_at(
    amount: u64,
    mint_decimals: u8,
    rail: &ReserveAssetRailAccountData<'_>,
    now: i64,
) -> Result<u128> {
    require_fresh_reserve_asset_price_at(rail, now)?;
    let decimal_scale = checked_pow10_u128(mint_decimals)?;
    let scaled = (amount as u128)
        .checked_mul(rail.last_price_usd_1e8 as u128)
        .ok_or(error!(OmegaXProtocolError::ArithmeticError))?;
    scaled
        .checked_div(decimal_scale)
        .ok_or(error!(OmegaXProtocolError::ArithmeticError))
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_selected_asset_payout_value(
    claim_credit_amount: u64,
    claim_mint_decimals: u8,
    claim_asset_rail: &ReserveAssetRailAccountData<'_>,
    payout_amount: u64,
    payout_mint_decimals: u8,
    payout_asset_rail: &ReserveAssetRailAccountData<'_>,
    max_overpay_bps: u16,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require_selected_asset_payout_value_at(
        claim_credit_amount,
        claim_mint_decimals,
        claim_asset_rail,
        payout_amount,
        payout_mint_decimals,
        payout_asset_rail,
        max_overpay_bps,
        now,
    )
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_selected_asset_payout_value_at(
    claim_credit_amount: u64,
    claim_mint_decimals: u8,
    claim_asset_rail: &ReserveAssetRailAccountData<'_>,
    payout_amount: u64,
    payout_mint_decimals: u8,
    payout_asset_rail: &ReserveAssetRailAccountData<'_>,
    max_overpay_bps: u16,
    now: i64,
) -> Result<()> {
    require!(
        max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS,
        OmegaXProtocolError::SelectedAssetOverpayBpsTooHigh
    );
    let claim_value = reserve_asset_value_usd_1e8_at(
        claim_credit_amount,
        claim_mint_decimals,
        claim_asset_rail,
        now,
    )?;
    let payout_value = reserve_asset_value_usd_1e8_at(
        payout_amount,
        payout_mint_decimals,
        payout_asset_rail,
        now,
    )?;
    require_selected_asset_payout_value_bounds(claim_value, payout_value, max_overpay_bps)
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_selected_asset_payout_value_bounds(
    claim_value: u128,
    payout_value: u128,
    max_overpay_bps: u16,
) -> Result<()> {
    require!(
        max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS,
        OmegaXProtocolError::SelectedAssetOverpayBpsTooHigh
    );
    require!(
        payout_value >= claim_value,
        OmegaXProtocolError::SelectedAssetPayoutUnderpaid
    );
    let multiplier = (BASIS_POINTS_DENOMINATOR as u128) + (max_overpay_bps as u128);
    let multiplied = match claim_value.checked_mul(multiplier) {
        Some(value) => value,
        None => return err!(OmegaXProtocolError::ArithmeticError),
    };
    let max_value = multiplied / (BASIS_POINTS_DENOMINATOR as u128);
    require!(
        payout_value <= max_value,
        OmegaXProtocolError::SelectedAssetPayoutOverpaid
    );
    Ok(())
}

#[cfg(not(feature = "quasar"))]
fn require_bps(value: u16) -> Result<()> {
    require!(value <= 10_000, OmegaXProtocolError::InvalidBps);
    Ok(())
}

#[cfg(not(feature = "quasar"))]
fn checked_pow10_u128(decimals: u8) -> Result<u128> {
    require!(
        decimals <= 18,
        OmegaXProtocolError::ReserveAssetMintDecimalsUnsupported
    );
    let mut value = 1u128;
    for _ in 0..decimals {
        value = value
            .checked_mul(10)
            .ok_or(error!(OmegaXProtocolError::ArithmeticError))?;
    }
    Ok(value)
}

#[cfg(not(feature = "quasar"))]
fn checked_sub_i64(left: i64, right: i64) -> Result<i64> {
    left.checked_sub(right)
        .ok_or(error!(OmegaXProtocolError::ArithmeticError))
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: ConfigureReserveAssetRailArgs))]
#[cfg_attr(feature = "quasar", instruction(asset_mint_key: Pubkey))]
pub struct ConfigureReserveAssetRail<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()],
        bump = reserve_domain.bump,
    )]
    pub reserve_domain: Box<Account<'info, ReserveDomain>>,
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
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = authority,
            space = 8 + ReserveAssetRail::INIT_SPACE,
            seeds = [SEED_RESERVE_ASSET_RAIL, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
            bump,
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                reserve_asset_rail.address(),
                &crate::ID,
                &[SEED_RESERVE_ASSET_RAIL, reserve_domain.address().as_ref(), asset_mint_key.as_ref()],
                reserve_asset_rail.bump,
            ) @ OmegaXProtocolError::ReserveAssetRailMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub reserve_asset_rail: Account<ReserveAssetRailAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct PublishReserveAssetRailPrice<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
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
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            reserve_asset_rail.address(),
            &crate::ID,
            &[SEED_RESERVE_ASSET_RAIL, reserve_asset_rail.reserve_domain.as_ref(), reserve_asset_rail.asset_mint.as_ref()],
            reserve_asset_rail.bump,
        ) @ OmegaXProtocolError::ReserveAssetRailMismatch
    )]
    pub reserve_asset_rail: Account<ReserveAssetRailAccountData<'info>>,
}
