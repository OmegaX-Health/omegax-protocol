// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for oracle registration, metadata, and staking flows.

use super::*;

#[derive(Accounts)]
#[instruction(metadata_uri: String, active: bool)]
pub struct UpdateOracleMetadata<'info> {
    pub oracle: Signer<'info>,
    #[account(
        mut,
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
}

#[derive(Accounts)]
#[instruction(oracle_pubkey: Pubkey)]
pub struct RegisterOracle<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init_if_needed,
        payer = admin,
        space = OracleRegistryEntry::space_with_max_metadata(),
        seeds = [crate::SEED_ORACLE, oracle_pubkey.as_ref()],
        bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        init,
        payer = admin,
        space = OracleProfile::space(),
        seeds = [crate::SEED_ORACLE_PROFILE, oracle_pubkey.as_ref()],
        bump,
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimOracle<'info> {
    pub oracle: Signer<'info>,
    #[account(
        mut,
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        mut,
        seeds = [crate::SEED_ORACLE_PROFILE, oracle.key().as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
}

#[derive(Accounts)]
pub struct UpdateOracleProfile<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [crate::SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
}

#[derive(Accounts)]
pub struct StakeOracle<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle_entry.oracle.as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        init_if_needed,
        payer = staker,
        space = OracleStakePosition::space(),
        seeds = [SEED_ORACLE_STAKE, oracle_entry.oracle.as_ref(), staker.key().as_ref()],
        bump,
    )]
    pub stake_position: Account<'info, OracleStakePosition>,
    #[account(mut)]
    pub stake_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = staker,
        token::mint = stake_mint,
        token::authority = stake_position,
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staker_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestUnstake<'info> {
    pub staker: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_ORACLE_STAKE, stake_position.oracle.as_ref(), staker.key().as_ref()],
        bump = stake_position.bump,
        constraint = stake_position.staker == staker.key(),
    )]
    pub stake_position: Account<'info, OracleStakePosition>,
}

#[derive(Accounts)]
pub struct FinalizeUnstake<'info> {
    pub staker: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_ORACLE_STAKE, stake_position.oracle.as_ref(), staker.key().as_ref()],
        bump = stake_position.bump,
        constraint = stake_position.staker == staker.key(),
    )]
    pub stake_position: Account<'info, OracleStakePosition>,
    #[account(
        mut,
        constraint = stake_vault.key() == stake_position.stake_vault,
        constraint = stake_vault.owner == stake_position.key() @ OmegaXProtocolError::StakeVaultMismatch,
        constraint = stake_vault.mint == stake_position.stake_mint @ OmegaXProtocolError::InvalidStakeMint,
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = destination_token_account.mint == stake_position.stake_mint @ OmegaXProtocolError::InvalidStakeMint,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SlashOracle<'info> {
    pub governance_authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [SEED_ORACLE_STAKE, stake_position.oracle.as_ref(), stake_position.staker.as_ref()],
        bump = stake_position.bump,
    )]
    pub stake_position: Account<'info, OracleStakePosition>,
    #[account(
        mut,
        constraint = stake_vault.key() == stake_position.stake_vault,
        constraint = stake_vault.owner == stake_position.key() @ OmegaXProtocolError::StakeVaultMismatch,
        constraint = stake_vault.mint == stake_position.stake_mint @ OmegaXProtocolError::InvalidStakeMint,
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = slash_treasury_token_account.mint == stake_position.stake_mint @ OmegaXProtocolError::InvalidStakeMint,
    )]
    pub slash_treasury_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
