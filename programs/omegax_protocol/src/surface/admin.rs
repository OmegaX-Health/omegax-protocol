// SPDX-License-Identifier: AGPL-3.0-or-later

//! Governance, oracle onboarding, and staking handlers.

use super::*;

pub fn initialize_protocol(
    ctx: Context<InitializeProtocol>,
    protocol_fee_bps: u16,
    governance_realm: Pubkey,
    governance_config: Pubkey,
    default_stake_mint: Pubkey,
    min_oracle_stake: u64,
) -> Result<()> {
    require!(
        protocol_fee_bps <= MAX_PROTOCOL_FEE_BPS,
        OmegaXProtocolError::InvalidProtocolFee
    );
    require!(
        governance_realm != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidGovernanceRealm
    );
    require!(
        governance_config != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidGovernanceConfig
    );
    require!(
        default_stake_mint != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidStakeMint
    );
    require!(min_oracle_stake > 0, OmegaXProtocolError::InvalidAmount);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.governance_authority = ctx.accounts.admin.key();
    config.governance_realm = governance_realm;
    config.governance_config = governance_config;
    config.default_stake_mint = default_stake_mint;
    config.protocol_fee_bps = protocol_fee_bps;
    config.min_oracle_stake = min_oracle_stake;
    config.emergency_paused = false;
    config.allowed_payout_mints_hash = [0u8; 32];
    config.bump = ctx.bumps.config;

    Ok(())
}

pub fn set_protocol_params(
    ctx: Context<SetProtocolParams>,
    protocol_fee_bps: u16,
    allowed_payout_mints_hash: [u8; 32],
    default_stake_mint: Pubkey,
    min_oracle_stake: u64,
    emergency_paused: bool,
) -> Result<()> {
    require!(
        protocol_fee_bps <= MAX_PROTOCOL_FEE_BPS,
        OmegaXProtocolError::InvalidProtocolFee
    );
    require!(
        default_stake_mint != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidStakeMint
    );
    require!(min_oracle_stake > 0, OmegaXProtocolError::InvalidAmount);

    let signer = ctx.accounts.governance_authority.key();
    let config = &mut ctx.accounts.config;
    if signer == config.governance_authority {
        // Normal governance-controlled update path.
    } else {
        let stake_config_invalid =
            config.default_stake_mint == ZERO_PUBKEY || config.min_oracle_stake == 0;
        require_keys_eq!(
            signer,
            config.admin,
            OmegaXProtocolError::GovernanceUnauthorized
        );
        if stake_config_invalid {
            // One-time repair path for older devnet configs that were initialized
            // before stake defaults became required.
            require!(
                protocol_fee_bps == config.protocol_fee_bps
                    && allowed_payout_mints_hash == config.allowed_payout_mints_hash
                    && emergency_paused == config.emergency_paused,
                OmegaXProtocolError::GovernanceUnauthorized
            );
        } else {
            // Emergency-only admin path used to freeze protocol and recover governance.
            require!(
                emergency_paused,
                OmegaXProtocolError::GovernanceUnauthorized
            );
            require!(
                protocol_fee_bps == config.protocol_fee_bps
                    && allowed_payout_mints_hash == config.allowed_payout_mints_hash
                    && default_stake_mint == config.default_stake_mint
                    && min_oracle_stake == config.min_oracle_stake,
                OmegaXProtocolError::GovernanceUnauthorized
            );
        }
    }

    config.protocol_fee_bps = protocol_fee_bps;
    config.allowed_payout_mints_hash = allowed_payout_mints_hash;
    config.default_stake_mint = default_stake_mint;
    config.min_oracle_stake = min_oracle_stake;
    config.emergency_paused = emergency_paused;

    Ok(())
}

pub fn rotate_governance_authority(
    ctx: Context<RotateGovernanceAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    require!(
        new_authority != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidGovernanceAuthority
    );

    let signer = ctx.accounts.governance_authority.key();
    let config = &mut ctx.accounts.config;
    if signer == config.governance_authority {
        // Governance can rotate to any non-zero authority.
    } else {
        // Emergency recovery path: admin may only recover authority back to configured governance.
        assert_governance_or_emergency_admin_signer(config, signer)?;
        require!(
            config.governance_config != ZERO_PUBKEY,
            OmegaXProtocolError::InvalidGovernanceRecoveryTarget
        );
        require_keys_eq!(
            new_authority,
            config.governance_config,
            OmegaXProtocolError::InvalidGovernanceRecoveryTarget
        );
    }
    config.governance_authority = new_authority;

    Ok(())
}

// Full protocol modules (oracle staking, coverage) are active in the
// public beta entrypoint surface in lib.rs.
#[allow(clippy::too_many_arguments)]
pub fn register_oracle(
    ctx: Context<RegisterOracle>,
    oracle_pubkey: Pubkey,
    oracle_type: u8,
    display_name: String,
    legal_name: String,
    website_url: String,
    app_url: String,
    logo_uri: String,
    webhook_url: String,
    supported_schema_key_hashes: Vec<[u8; 32]>,
) -> Result<()> {
    OracleProfileFields {
        oracle_type,
        display_name: &display_name,
        legal_name: &legal_name,
        website_url: &website_url,
        app_url: &app_url,
        logo_uri: &logo_uri,
        webhook_url: &webhook_url,
        supported_schema_key_hashes: supported_schema_key_hashes.as_slice(),
    }
    .validate()?;

    let now = Clock::get()?.unix_timestamp;

    let entry = &mut ctx.accounts.oracle_entry;
    if entry.oracle == ZERO_PUBKEY {
        entry.oracle = oracle_pubkey;
        entry.active = false;
        entry.metadata_uri = String::new();
        entry.bump = ctx.bumps.oracle_entry;
    } else {
        require_keys_eq!(
            entry.oracle,
            oracle_pubkey,
            OmegaXProtocolError::OracleKeyMismatch
        );
    }

    let profile = &mut ctx.accounts.oracle_profile;
    profile.oracle = oracle_pubkey;
    profile.admin = ctx.accounts.admin.key();
    profile.oracle_type = oracle_type;
    profile.display_name = display_name;
    profile.legal_name = legal_name;
    profile.website_url = website_url;
    profile.app_url = app_url;
    profile.logo_uri = logo_uri;
    profile.webhook_url = webhook_url;
    profile.supported_schema_count = supported_schema_key_hashes.len() as u8;
    profile.supported_schema_key_hashes = supported_schema_array(&supported_schema_key_hashes);
    profile.claimed = false;
    profile.created_at_ts = now;
    profile.updated_at_ts = now;
    profile.bump = ctx.bumps.oracle_profile;

    Ok(())
}

pub fn claim_oracle(ctx: Context<ClaimOracle>) -> Result<()> {
    let oracle = ctx.accounts.oracle.key();
    require_keys_eq!(
        ctx.accounts.oracle_entry.oracle,
        oracle,
        OmegaXProtocolError::OracleKeyMismatch
    );
    require_keys_eq!(
        ctx.accounts.oracle_profile.oracle,
        oracle,
        OmegaXProtocolError::OracleKeyMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.oracle_entry.active = true;
    ctx.accounts.oracle_profile.claimed = true;
    ctx.accounts.oracle_profile.updated_at_ts = now;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update_oracle_profile(
    ctx: Context<UpdateOracleProfile>,
    oracle_type: u8,
    display_name: String,
    legal_name: String,
    website_url: String,
    app_url: String,
    logo_uri: String,
    webhook_url: String,
    supported_schema_key_hashes: Vec<[u8; 32]>,
) -> Result<()> {
    let authority = ctx.accounts.authority.key();
    let profile = &mut ctx.accounts.oracle_profile;
    require!(
        authority == profile.admin || authority == profile.oracle,
        OmegaXProtocolError::OracleProfileUnauthorized
    );

    OracleProfileFields {
        oracle_type,
        display_name: &display_name,
        legal_name: &legal_name,
        website_url: &website_url,
        app_url: &app_url,
        logo_uri: &logo_uri,
        webhook_url: &webhook_url,
        supported_schema_key_hashes: supported_schema_key_hashes.as_slice(),
    }
    .validate()?;

    profile.oracle_type = oracle_type;
    profile.display_name = display_name;
    profile.legal_name = legal_name;
    profile.website_url = website_url;
    profile.app_url = app_url;
    profile.logo_uri = logo_uri;
    profile.webhook_url = webhook_url;
    profile.supported_schema_count = supported_schema_key_hashes.len() as u8;
    profile.supported_schema_key_hashes = supported_schema_array(&supported_schema_key_hashes);
    profile.updated_at_ts = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn update_oracle_metadata(
    ctx: Context<UpdateOracleMetadata>,
    metadata_uri: String,
    active: bool,
) -> Result<()> {
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        OmegaXProtocolError::MetadataUriTooLong
    );

    let entry = &mut ctx.accounts.oracle_entry;
    entry.metadata_uri = metadata_uri;
    entry.active = active;

    Ok(())
}

pub fn stake_oracle(ctx: Context<StakeOracle>, amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.stake_mint.key() == ctx.accounts.config.default_stake_mint,
        OmegaXProtocolError::InvalidStakeMint
    );

    let staker = ctx.accounts.staker.key();
    let oracle = ctx.accounts.oracle_entry.oracle;

    let position = &mut ctx.accounts.stake_position;
    if position.staker == ZERO_PUBKEY {
        position.oracle = oracle;
        position.staker = staker;
        position.stake_mint = ctx.accounts.stake_mint.key();
        position.stake_vault = ctx.accounts.stake_vault.key();
        position.staked_amount = 0;
        position.pending_unstake_amount = 0;
        position.can_finalize_unstake_at = 0;
        position.slash_pending = false;
        position.bump = ctx.bumps.stake_position;
    } else {
        require_keys_eq!(
            position.oracle,
            oracle,
            OmegaXProtocolError::InvalidStakePosition
        );
        require_keys_eq!(
            position.staker,
            staker,
            OmegaXProtocolError::InvalidStakePosition
        );
        require_keys_eq!(
            position.stake_mint,
            ctx.accounts.stake_mint.key(),
            OmegaXProtocolError::InvalidStakeMint
        );
        require_keys_eq!(
            position.stake_vault,
            ctx.accounts.stake_vault.key(),
            OmegaXProtocolError::StakeVaultMismatch
        );
    }

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.staker_token_account.to_account_info(),
            to: ctx.accounts.stake_vault.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    position.staked_amount = position
        .staked_amount
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;

    require!(
        position.staked_amount >= ctx.accounts.config.min_oracle_stake,
        OmegaXProtocolError::OracleInsufficientStake
    );

    Ok(())
}

pub fn request_unstake(
    ctx: Context<RequestUnstake>,
    amount: u64,
    cooldown_seconds: i64,
) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(cooldown_seconds >= 0, OmegaXProtocolError::InvalidCooldown);

    let position = &mut ctx.accounts.stake_position;
    require!(
        amount <= position.staked_amount,
        OmegaXProtocolError::InsufficientStakeBalance
    );

    let now = Clock::get()?.unix_timestamp;
    position.pending_unstake_amount = amount;
    position.can_finalize_unstake_at = now
        .checked_add(cooldown_seconds)
        .ok_or(OmegaXProtocolError::MathOverflow)?;

    Ok(())
}

pub fn finalize_unstake(ctx: Context<FinalizeUnstake>) -> Result<()> {
    let oracle = ctx.accounts.stake_position.oracle;
    let staker = ctx.accounts.stake_position.staker;
    let bump = ctx.accounts.stake_position.bump;
    let amount = ctx.accounts.stake_position.pending_unstake_amount;

    require!(amount > 0, OmegaXProtocolError::NoPendingUnstake);

    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= ctx.accounts.stake_position.can_finalize_unstake_at,
        OmegaXProtocolError::UnstakeCooldownNotMet
    );

    let signer_seeds: &[&[u8]] = &[SEED_ORACLE_STAKE, oracle.as_ref(), staker.as_ref(), &[bump]];
    let signer_groups = [signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.stake_vault.to_account_info(),
            to: ctx.accounts.destination_token_account.to_account_info(),
            authority: ctx.accounts.stake_position.to_account_info(),
        },
        &signer_groups,
    );
    token::transfer(cpi_ctx, amount)?;

    let position = &mut ctx.accounts.stake_position;
    position.staked_amount = position
        .staked_amount
        .checked_sub(amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    position.pending_unstake_amount = 0;
    position.can_finalize_unstake_at = 0;

    Ok(())
}

pub fn slash_oracle(ctx: Context<SlashOracle>, amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);

    let signer = ctx.accounts.governance_authority.key();
    let config = &ctx.accounts.config;
    assert_governance_signer(config, signer)?;

    let oracle = ctx.accounts.stake_position.oracle;
    let staker = ctx.accounts.stake_position.staker;
    let bump = ctx.accounts.stake_position.bump;
    require!(
        amount <= ctx.accounts.stake_position.staked_amount,
        OmegaXProtocolError::InsufficientStakeBalance
    );

    let signer_seeds: &[&[u8]] = &[SEED_ORACLE_STAKE, oracle.as_ref(), staker.as_ref(), &[bump]];
    let signer_groups = [signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.stake_vault.to_account_info(),
            to: ctx.accounts.slash_treasury_token_account.to_account_info(),
            authority: ctx.accounts.stake_position.to_account_info(),
        },
        &signer_groups,
    );
    token::transfer(cpi_ctx, amount)?;

    let position = &mut ctx.accounts.stake_position;
    position.staked_amount = position
        .staked_amount
        .checked_sub(amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    position.slash_pending = false;

    Ok(())
}
