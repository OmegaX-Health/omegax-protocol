// SPDX-License-Identifier: AGPL-3.0-or-later

//! Coverage product, policy issuance, and premium-payment handlers.

use super::*;

pub fn create_policy_position(
    ctx: Context<CreatePolicyPosition>,
    member: Pubkey,
    series_ref_hash: [u8; 32],
    terms_hash: [u8; 32],
    starts_at: i64,
    ends_at: i64,
    premium_due_every_secs: i64,
    premium_grace_secs: i64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    write_policy_position(
        &mut ctx.accounts.policy_position,
        &mut ctx.accounts.policy_position_nft,
        ctx.accounts.pool.key(),
        member,
        series_ref_hash,
        terms_hash,
        starts_at,
        ends_at,
        premium_due_every_secs,
        premium_grace_secs,
        ctx.bumps.policy_position,
        ctx.bumps.policy_position_nft,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn create_policy_series(
    ctx: Context<RegisterPolicySeriesV2>,
    series_ref_hash: [u8; 32],
    status: u8,
    plan_mode: u8,
    sponsor_mode: u8,
    display_name: String,
    metadata_uri: String,
    terms_hash: [u8; 32],
    duration_secs: i64,
    premium_due_every_secs: i64,
    premium_grace_secs: i64,
    premium_amount: u64,
    interop_profile_hash: [u8; 32],
    oracle_profile_hash: [u8; 32],
    risk_family_hash: [u8; 32],
    issuance_template_hash: [u8; 32],
    comparability_hash: [u8; 32],
    renewal_of_hash: [u8; 32],
    terms_version: u16,
    mapping_version: u16,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    require!(
        status <= POLICY_SERIES_STATUS_CLOSED,
        OmegaXProtocolV2Error::InvalidProgramAccountData
    );
    require!(
        plan_mode == PLAN_MODE_REWARD
            || plan_mode == PLAN_MODE_PROTECTION
            || plan_mode == PLAN_MODE_REIMBURSEMENT
            || plan_mode == PLAN_MODE_REGULATED,
        OmegaXProtocolV2Error::InvalidPlanMode
    );
    require!(
        sponsor_mode == SPONSOR_MODE_DIRECT
            || sponsor_mode == SPONSOR_MODE_WRAPPER
            || sponsor_mode == SPONSOR_MODE_CARRIER,
        OmegaXProtocolV2Error::InvalidSponsorMode
    );
    validate_policy_series_fields(
        &display_name,
        &metadata_uri,
        duration_secs,
        premium_due_every_secs,
        premium_grace_secs,
        premium_amount,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let product = &mut ctx.accounts.policy_series;
    product.pool = ctx.accounts.pool.key();
    product.series_ref_hash = series_ref_hash;
    product.status = status;
    product.plan_mode = plan_mode;
    product.sponsor_mode = sponsor_mode;
    product.display_name = display_name;
    product.metadata_uri = metadata_uri;
    product.terms_hash = terms_hash;
    product.duration_secs = duration_secs;
    product.premium_due_every_secs = premium_due_every_secs;
    product.premium_grace_secs = premium_grace_secs;
    product.premium_amount = premium_amount;
    product.interop_profile_hash = interop_profile_hash;
    product.oracle_profile_hash = oracle_profile_hash;
    product.risk_family_hash = risk_family_hash;
    product.issuance_template_hash = issuance_template_hash;
    product.comparability_hash = comparability_hash;
    product.renewal_of_hash = renewal_of_hash;
    product.terms_version = terms_version;
    product.mapping_version = mapping_version;
    product.created_at_ts = now;
    product.updated_at_ts = now;
    product.bump = ctx.bumps.policy_series;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update_policy_series(
    ctx: Context<UpdatePolicySeriesV2>,
    status: u8,
    plan_mode: u8,
    sponsor_mode: u8,
    display_name: String,
    metadata_uri: String,
    terms_hash: [u8; 32],
    duration_secs: i64,
    premium_due_every_secs: i64,
    premium_grace_secs: i64,
    premium_amount: u64,
    interop_profile_hash: [u8; 32],
    oracle_profile_hash: [u8; 32],
    risk_family_hash: [u8; 32],
    issuance_template_hash: [u8; 32],
    comparability_hash: [u8; 32],
    renewal_of_hash: [u8; 32],
    terms_version: u16,
    mapping_version: u16,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    require!(
        status <= POLICY_SERIES_STATUS_CLOSED,
        OmegaXProtocolV2Error::InvalidProgramAccountData
    );
    require!(
        plan_mode == PLAN_MODE_REWARD
            || plan_mode == PLAN_MODE_PROTECTION
            || plan_mode == PLAN_MODE_REIMBURSEMENT
            || plan_mode == PLAN_MODE_REGULATED,
        OmegaXProtocolV2Error::InvalidPlanMode
    );
    require!(
        sponsor_mode == SPONSOR_MODE_DIRECT
            || sponsor_mode == SPONSOR_MODE_WRAPPER
            || sponsor_mode == SPONSOR_MODE_CARRIER,
        OmegaXProtocolV2Error::InvalidSponsorMode
    );
    validate_policy_series_fields(
        &display_name,
        &metadata_uri,
        duration_secs,
        premium_due_every_secs,
        premium_grace_secs,
        premium_amount,
    )?;

    let product = &mut ctx.accounts.policy_series;
    product.status = status;
    product.plan_mode = plan_mode;
    product.sponsor_mode = sponsor_mode;
    product.display_name = display_name;
    product.metadata_uri = metadata_uri;
    product.terms_hash = terms_hash;
    product.duration_secs = duration_secs;
    product.premium_due_every_secs = premium_due_every_secs;
    product.premium_grace_secs = premium_grace_secs;
    product.premium_amount = premium_amount;
    product.interop_profile_hash = interop_profile_hash;
    product.oracle_profile_hash = oracle_profile_hash;
    product.risk_family_hash = risk_family_hash;
    product.issuance_template_hash = issuance_template_hash;
    product.comparability_hash = comparability_hash;
    product.renewal_of_hash = renewal_of_hash;
    product.terms_version = terms_version;
    product.mapping_version = mapping_version;
    product.updated_at_ts = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn upsert_policy_series_payment_option(
    ctx: Context<UpsertPolicySeriesPaymentOption>,
    payment_mint: Pubkey,
    payment_amount: u64,
    active: bool,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    require_keys_eq!(
        ctx.accounts.policy_series.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require!(
        payment_mint == ctx.accounts.payment_mint.key(),
        OmegaXProtocolV2Error::PayoutMintMismatch
    );
    validate_policy_series_payment_option_fields(payment_mint, payment_amount, active)?;

    let option = &mut ctx.accounts.policy_series_payment_option;
    option.pool = ctx.accounts.pool.key();
    option.series_ref_hash = ctx.accounts.policy_series.series_ref_hash;
    option.payment_mint = payment_mint;
    option.payment_amount = payment_amount;
    option.active = active;
    option.bump = ctx.bumps.policy_series_payment_option;

    Ok(())
}

pub fn subscribe_policy_series(
    ctx: Context<SubscribePolicySeriesV2>,
    series_ref_hash: [u8; 32],
    starts_at: i64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    require!(
        ctx.accounts.membership.status == MEMBERSHIP_STATUS_ACTIVE,
        OmegaXProtocolV2Error::MembershipNotActive
    );
    require!(
        ctx.accounts.policy_series.pool == ctx.accounts.pool.key(),
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require!(
        ctx.accounts.policy_series.series_ref_hash == series_ref_hash,
        OmegaXProtocolV2Error::PolicySeriesIdMismatch
    );
    require_policy_series_active(&ctx.accounts.policy_series)?;
    require_policy_series_allows_coverage(&ctx.accounts.policy_series)?;

    let now = Clock::get()?.unix_timestamp;
    let effective_starts_at = if starts_at > 0 { starts_at } else { now };
    let ends_at = effective_starts_at
        .checked_add(ctx.accounts.policy_series.duration_secs)
        .ok_or(OmegaXProtocolV2Error::MathOverflow)?;

    write_policy_position(
        &mut ctx.accounts.policy_position,
        &mut ctx.accounts.policy_position_nft,
        ctx.accounts.pool.key(),
        ctx.accounts.member.key(),
        series_ref_hash,
        ctx.accounts.policy_series.terms_hash,
        effective_starts_at,
        ends_at,
        ctx.accounts.policy_series.premium_due_every_secs,
        ctx.accounts.policy_series.premium_grace_secs,
        ctx.bumps.policy_position,
        ctx.bumps.policy_position_nft,
    )
}

pub fn issue_policy_position(
    ctx: Context<IssuePolicyPositionFromProductV2>,
    member: Pubkey,
    series_ref_hash: [u8; 32],
    starts_at: i64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    require!(
        ctx.accounts.membership.status == MEMBERSHIP_STATUS_ACTIVE,
        OmegaXProtocolV2Error::MembershipNotActive
    );
    require!(
        ctx.accounts.policy_series.pool == ctx.accounts.pool.key(),
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require!(
        ctx.accounts.policy_series.series_ref_hash == series_ref_hash,
        OmegaXProtocolV2Error::PolicySeriesIdMismatch
    );
    require_policy_series_active(&ctx.accounts.policy_series)?;
    require_policy_series_allows_coverage(&ctx.accounts.policy_series)?;

    let now = Clock::get()?.unix_timestamp;
    let effective_starts_at = if starts_at > 0 { starts_at } else { now };
    let ends_at = effective_starts_at
        .checked_add(ctx.accounts.policy_series.duration_secs)
        .ok_or(OmegaXProtocolV2Error::MathOverflow)?;

    write_policy_position(
        &mut ctx.accounts.policy_position,
        &mut ctx.accounts.policy_position_nft,
        ctx.accounts.pool.key(),
        member,
        series_ref_hash,
        ctx.accounts.policy_series.terms_hash,
        effective_starts_at,
        ends_at,
        ctx.accounts.policy_series.premium_due_every_secs,
        ctx.accounts.policy_series.premium_grace_secs,
        ctx.bumps.policy_position,
        ctx.bumps.policy_position_nft,
    )
}

pub fn mint_policy_nft(
    ctx: Context<MintPolicyNft>,
    nft_mint: Pubkey,
    metadata_uri: String,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        OmegaXProtocolV2Error::MetadataUriTooLong
    );

    ctx.accounts.policy_position.nft_mint = nft_mint;
    ctx.accounts.policy_position_nft.nft_mint = nft_mint;
    ctx.accounts.policy_position_nft.metadata_uri = metadata_uri;

    Ok(())
}

pub fn pay_premium_spl_v2(ctx: Context<PayPremiumSplV2>, period_index: u64) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    validate_policy_series_matches_policy(
        &ctx.accounts.policy_series,
        &ctx.accounts.policy_position,
        ctx.accounts.pool.key(),
    )?;
    require_policy_series_allows_coverage(&ctx.accounts.policy_series)?;
    require!(
        ctx.accounts.policy_series_payment_option.active,
        OmegaXProtocolV2Error::PolicySeriesPaymentOptionInactive
    );
    require_keys_eq!(
        ctx.accounts.policy_series_payment_option.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require!(
        ctx.accounts.policy_series_payment_option.series_ref_hash
            == ctx.accounts.policy_series.series_ref_hash,
        OmegaXProtocolV2Error::PolicySeriesIdMismatch
    );
    require_keys_eq!(
        ctx.accounts.policy_series_payment_option.payment_mint,
        ctx.accounts.payment_mint.key(),
        OmegaXProtocolV2Error::PayoutMintMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    require_coverage_active(&ctx.accounts.policy_position, now)?;
    validate_premium_period(
        &ctx.accounts.premium_ledger,
        ctx.accounts.pool.key(),
        ctx.accounts.policy_series.series_ref_hash,
        ctx.accounts.member.key(),
        period_index,
    )?;

    let vault = &mut ctx.accounts.pool_asset_vault;
    if vault.pool == ZERO_PUBKEY {
        vault.pool = ctx.accounts.pool.key();
        vault.payout_mint = ctx.accounts.payment_mint.key();
        vault.vault_token_account = ctx.accounts.pool_vault_token_account.key();
        vault.active = true;
        vault.bump = ctx.bumps.pool_asset_vault;
    } else {
        require_keys_eq!(
            vault.pool,
            ctx.accounts.pool.key(),
            OmegaXProtocolV2Error::AccountPoolMismatch
        );
        require_keys_eq!(
            vault.payout_mint,
            ctx.accounts.payment_mint.key(),
            OmegaXProtocolV2Error::PayoutMintMismatch
        );
        require!(
            vault.vault_token_account == ctx.accounts.pool_vault_token_account.key(),
            OmegaXProtocolV2Error::VaultTokenAccountMismatch
        );
        require!(vault.active, OmegaXProtocolV2Error::MissingAssetVault);
    }

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.pool_vault_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    );
    token::transfer(
        cpi_ctx,
        ctx.accounts.policy_series_payment_option.payment_amount,
    )?;

    write_premium_ledger(
        &mut ctx.accounts.premium_ledger,
        PremiumLedgerWrite {
            pool: ctx.accounts.pool.key(),
            series_ref_hash: ctx.accounts.policy_series.series_ref_hash,
            member: ctx.accounts.member.key(),
            period_index,
            amount: ctx.accounts.policy_series.premium_amount,
            source: PREMIUM_SOURCE_ONCHAIN,
            paid_at: now,
            bump: ctx.bumps.premium_ledger,
        },
    );

    advance_policy_premium(&mut ctx.accounts.policy_position, now)?;
    Ok(())
}

pub fn pay_premium_sol_v2(ctx: Context<PayPremiumSolV2>, period_index: u64) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config_v2)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    validate_policy_series_matches_policy(
        &ctx.accounts.policy_series,
        &ctx.accounts.policy_position,
        ctx.accounts.pool.key(),
    )?;
    require_policy_series_allows_coverage(&ctx.accounts.policy_series)?;
    require!(
        ctx.accounts.policy_series_payment_option.active,
        OmegaXProtocolV2Error::PolicySeriesPaymentOptionInactive
    );
    require_keys_eq!(
        ctx.accounts.policy_series_payment_option.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require!(
        ctx.accounts.policy_series_payment_option.series_ref_hash
            == ctx.accounts.policy_series.series_ref_hash,
        OmegaXProtocolV2Error::PolicySeriesIdMismatch
    );
    require!(
        ctx.accounts.policy_series_payment_option.payment_mint == ZERO_PUBKEY,
        OmegaXProtocolV2Error::PolicySeriesPaymentOptionInvalid
    );

    let now = Clock::get()?.unix_timestamp;
    require_coverage_active(&ctx.accounts.policy_position, now)?;
    validate_premium_period(
        &ctx.accounts.premium_ledger,
        ctx.accounts.pool.key(),
        ctx.accounts.policy_series.series_ref_hash,
        ctx.accounts.member.key(),
        period_index,
    )?;

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        SystemTransfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.pool.to_account_info(),
        },
    );
    system_program::transfer(
        cpi_ctx,
        ctx.accounts.policy_series_payment_option.payment_amount,
    )?;

    write_premium_ledger(
        &mut ctx.accounts.premium_ledger,
        PremiumLedgerWrite {
            pool: ctx.accounts.pool.key(),
            series_ref_hash: ctx.accounts.policy_series.series_ref_hash,
            member: ctx.accounts.member.key(),
            period_index,
            amount: ctx.accounts.policy_series.premium_amount,
            source: PREMIUM_SOURCE_ONCHAIN,
            paid_at: now,
            bump: ctx.bumps.premium_ledger,
        },
    );

    advance_policy_premium(&mut ctx.accounts.policy_position, now)?;
    Ok(())
}
