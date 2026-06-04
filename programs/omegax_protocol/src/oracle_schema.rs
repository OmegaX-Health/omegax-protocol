// SPDX-License-Identifier: AGPL-3.0-or-later

//! Oracle registry, pool-oracle policy, and outcome-schema instruction handlers and account validation contexts.

use crate::platform::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;

#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
pub(crate) fn register_oracle(
    ctx: Context<RegisterOracle>,
    args: RegisterOracleArgs,
) -> Result<()> {
    // PT-2026-04-27-07 fix: the signer registering the profile must be the
    // oracle key itself. Closes the squat-then-recover gap where any wallet
    // could pre-register an oracle profile under a target oracle's pubkey
    // and control the metadata until the rightful oracle ran claim_oracle.
    require_keys_eq!(
        ctx.accounts.admin.key(),
        args.oracle,
        OmegaXProtocolError::Unauthorized
    );
    validate_oracle_profile_fields(&args)?;

    let now_ts = Clock::get()?.unix_timestamp;
    let profile = &mut ctx.accounts.oracle_profile;
    profile.oracle = args.oracle;
    profile.admin = ctx.accounts.admin.key();
    profile.oracle_type = args.oracle_type;
    profile.display_name = args.display_name;
    profile.legal_name = args.legal_name;
    profile.website_url = args.website_url;
    profile.app_url = args.app_url;
    profile.logo_uri = args.logo_uri;
    profile.webhook_url = args.webhook_url;
    profile.supported_schema_count = args.supported_schema_key_hashes.len() as u8;
    write_supported_schema_hashes(
        &mut profile.supported_schema_key_hashes,
        &args.supported_schema_key_hashes,
    );
    profile.active = true;
    profile.claimed = ctx.accounts.admin.key() == args.oracle;
    profile.created_at_ts = now_ts;
    profile.updated_at_ts = now_ts;
    profile.bump = ctx.bumps.oracle_profile;

    emit!(OracleProfileRegisteredEvent {
        oracle_profile: profile.key(),
        oracle: profile.oracle,
        admin: profile.admin,
        oracle_type: profile.oracle_type,
        claimed: profile.claimed,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn register_oracle<'info>(
    ctx: &mut Ctx<'info, RegisterOracle<'info>>,
    oracle: Pubkey,
    oracle_type: u8,
    display_name: &str,
    legal_name: &str,
    website_url: &str,
    app_url: &str,
    logo_uri: &str,
    webhook_url: &str,
    supported_schema_key_hashes: &[[u8; 32]],
) -> Result<()> {
    let admin = *ctx.accounts.admin.address();
    require_keys_eq!(admin, oracle, OmegaXProtocolError::Unauthorized);
    validate_quasar_oracle_profile_update_fields(
        display_name,
        legal_name,
        website_url,
        app_url,
        logo_uri,
        webhook_url,
        supported_schema_key_hashes.len(),
    )?;

    let now_ts = Clock::get()?.unix_timestamp.get();
    let supported_schema_count = supported_schema_key_hashes.len() as u8;
    let supported_schema_key_hashes =
        build_quasar_supported_schema_hashes(supported_schema_key_hashes);
    let oracle_profile_bump = ctx.accounts.oracle_profile.bump;

    ctx.accounts.oracle_profile.set_inner(
        oracle,
        admin,
        oracle_type,
        supported_schema_count,
        supported_schema_key_hashes,
        true,
        true,
        now_ts,
        now_ts,
        oracle_profile_bump,
        display_name,
        legal_name,
        website_url,
        app_url,
        logo_uri,
        webhook_url,
        ctx.accounts.admin.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn claim_oracle(ctx: Context<ClaimOracle>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.oracle_profile.oracle,
        OmegaXProtocolError::Unauthorized
    );

    let profile = &mut ctx.accounts.oracle_profile;
    profile.admin = ctx.accounts.oracle.key();
    profile.claimed = true;
    profile.updated_at_ts = Clock::get()?.unix_timestamp;

    emit!(OracleProfileClaimedEvent {
        oracle_profile: profile.key(),
        oracle: profile.oracle,
        admin: profile.admin,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn claim_oracle<'info>(ctx: &mut Ctx<'info, ClaimOracle<'info>>) -> Result<()> {
    let oracle = *ctx.accounts.oracle.address();
    require_keys_eq!(
        oracle,
        ctx.accounts.oracle_profile.oracle,
        OmegaXProtocolError::Unauthorized
    );

    let profile = &mut ctx.accounts.oracle_profile;
    let oracle_type = profile.oracle_type;
    let supported_schema_count = profile.supported_schema_count;
    let supported_schema_key_hashes = profile.supported_schema_key_hashes;
    let active = profile.active.get();
    let created_at_ts = profile.created_at_ts.get();
    let updated_at_ts = Clock::get()?.unix_timestamp.get();
    let bump = profile.bump;
    let display_name = profile.display_name().to_owned();
    let legal_name = profile.legal_name().to_owned();
    let website_url = profile.website_url().to_owned();
    let app_url = profile.app_url().to_owned();
    let logo_uri = profile.logo_uri().to_owned();
    let webhook_url = profile.webhook_url().to_owned();

    profile.set_inner(
        oracle,
        oracle,
        oracle_type,
        supported_schema_count,
        supported_schema_key_hashes,
        active,
        true,
        created_at_ts,
        updated_at_ts,
        bump,
        &display_name,
        &legal_name,
        &website_url,
        &app_url,
        &logo_uri,
        &webhook_url,
        ctx.accounts.oracle.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn update_oracle_profile(
    ctx: Context<UpdateOracleProfile>,
    args: UpdateOracleProfileArgs,
) -> Result<()> {
    require_oracle_profile_control(&ctx.accounts.authority.key(), &ctx.accounts.oracle_profile)?;
    validate_oracle_profile_fields_update(&args)?;

    let profile = &mut ctx.accounts.oracle_profile;
    profile.oracle_type = args.oracle_type;
    profile.display_name = args.display_name;
    profile.legal_name = args.legal_name;
    profile.website_url = args.website_url;
    profile.app_url = args.app_url;
    profile.logo_uri = args.logo_uri;
    profile.webhook_url = args.webhook_url;
    profile.supported_schema_count = args.supported_schema_key_hashes.len() as u8;
    write_supported_schema_hashes(
        &mut profile.supported_schema_key_hashes,
        &args.supported_schema_key_hashes,
    );
    profile.updated_at_ts = Clock::get()?.unix_timestamp;

    emit!(OracleProfileUpdatedEvent {
        oracle_profile: profile.key(),
        oracle: profile.oracle,
        authority: ctx.accounts.authority.key(),
        oracle_type: profile.oracle_type,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_oracle_profile_control(
    authority: &Pubkey,
    oracle_profile: &OracleProfileAccountData<'_>,
) -> Result<()> {
    if *authority == oracle_profile.admin || *authority == oracle_profile.oracle {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
fn validate_quasar_oracle_profile_update_fields(
    display_name: &str,
    legal_name: &str,
    website_url: &str,
    app_url: &str,
    logo_uri: &str,
    webhook_url: &str,
    supported_schema_count: usize,
) -> Result<()> {
    require!(
        display_name.len() <= MAX_NAME_LEN,
        OmegaXProtocolError::StringTooLong
    );
    require!(
        legal_name.len() <= MAX_LONG_NAME_LEN,
        OmegaXProtocolError::StringTooLong
    );
    require!(
        website_url.len() <= MAX_URI_LEN,
        OmegaXProtocolError::StringTooLong
    );
    require!(
        app_url.len() <= MAX_URI_LEN,
        OmegaXProtocolError::StringTooLong
    );
    require!(
        logo_uri.len() <= MAX_URI_LEN,
        OmegaXProtocolError::StringTooLong
    );
    require!(
        webhook_url.len() <= MAX_URI_LEN,
        OmegaXProtocolError::StringTooLong
    );
    require!(
        supported_schema_count <= MAX_ORACLE_SUPPORTED_SCHEMAS,
        OmegaXProtocolError::TooManyOracleSupportedSchemas
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn build_quasar_supported_schema_hashes(
    values: &[[u8; 32]],
) -> [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS] {
    let mut destination = [[0u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS];
    for (index, value) in values.iter().enumerate() {
        destination[index] = *value;
    }
    destination
}

#[cfg(feature = "quasar")]
pub(crate) fn update_oracle_profile<'info>(
    ctx: &mut Ctx<'info, UpdateOracleProfile<'info>>,
    oracle_type: u8,
    display_name: &str,
    legal_name: &str,
    website_url: &str,
    app_url: &str,
    logo_uri: &str,
    webhook_url: &str,
    supported_schema_key_hashes: &[[u8; 32]],
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_oracle_profile_control(&authority, &ctx.accounts.oracle_profile)?;
    validate_quasar_oracle_profile_update_fields(
        display_name,
        legal_name,
        website_url,
        app_url,
        logo_uri,
        webhook_url,
        supported_schema_key_hashes.len(),
    )?;

    let supported_schema_count = supported_schema_key_hashes.len() as u8;
    let supported_schema_key_hashes =
        build_quasar_supported_schema_hashes(supported_schema_key_hashes);
    let updated_at_ts = Clock::get()?.unix_timestamp.get();

    let profile = &mut ctx.accounts.oracle_profile;
    let oracle = profile.oracle;
    let admin = profile.admin;
    let active = profile.active.get();
    let claimed = profile.claimed.get();
    let created_at_ts = profile.created_at_ts.get();
    let bump = profile.bump;

    profile.set_inner(
        oracle,
        admin,
        oracle_type,
        supported_schema_count,
        supported_schema_key_hashes,
        active,
        claimed,
        created_at_ts,
        updated_at_ts,
        bump,
        display_name,
        legal_name,
        website_url,
        app_url,
        logo_uri,
        webhook_url,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: RegisterOracleArgs))]
#[cfg_attr(feature = "quasar", instruction(oracle: Pubkey))]
pub struct RegisterOracle<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub admin: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub admin: &'info Signer,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = admin,
            space = 8 + OracleProfile::INIT_SPACE,
            seeds = [SEED_ORACLE_PROFILE, args.oracle.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                oracle_profile.address(),
                &crate::ID,
                &[SEED_ORACLE_PROFILE, oracle.as_ref()],
                oracle_profile.bump,
            ) @ OmegaXProtocolError::OracleProfileMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct ClaimOracle<'info> {
    #[cfg(not(feature = "quasar"))]
    pub oracle: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub oracle: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
}

#[derive(Accounts)]
pub struct UpdateOracleProfile<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
}
