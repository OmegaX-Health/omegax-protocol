// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for treasury and fee-withdrawal flows.

use super::*;

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySpl<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        seeds = [SEED_POOL_ORACLE, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle.bump,
    )]
    pub pool_oracle: Account<'info, PoolOracleApproval>,
    #[account(
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle_permissions.bump,
    )]
    pub pool_oracle_permissions: Account<'info, PoolOraclePermissionSet>,
    #[account(mut)]
    pub payment_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), payment_mint.key().as_ref()],
        bump = pool_treasury_reserve.bump,
    )]
    pub pool_treasury_reserve: Account<'info, PoolTreasuryReserve>,
    #[account(
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payment_mint.key().as_ref()],
        bump = pool_asset_vault.bump,
    )]
    pub pool_asset_vault: Account<'info, PoolAssetVault>,
    #[account(
        mut,
        constraint = pool_vault_token_account.key() == pool_asset_vault.vault_token_account @ OmegaXProtocolV2Error::VaultTokenAccountMismatch,
        constraint = pool_vault_token_account.mint == payment_mint.key() @ OmegaXProtocolV2Error::PayoutMintMismatch,
    )]
    pub pool_vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySol<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        seeds = [SEED_POOL_ORACLE, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle.bump,
    )]
    pub pool_oracle: Account<'info, PoolOracleApproval>,
    #[account(
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle_permissions.bump,
    )]
    pub pool_oracle_permissions: Account<'info, PoolOraclePermissionSet>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), &ZERO_PUBKEY_BYTES],
        bump = pool_treasury_reserve.bump,
    )]
    pub pool_treasury_reserve: Account<'info, PoolTreasuryReserve>,
    /// CHECK: recipient only receives lamports.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSpl<'info> {
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    #[account(mut)]
    pub payment_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, payment_mint.key().as_ref()],
        bump = protocol_fee_vault.bump,
    )]
    pub protocol_fee_vault: Account<'info, ProtocolFeeVault>,
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = protocol_fee_vault,
    )]
    pub protocol_fee_vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = recipient_token_account.mint == payment_mint.key() @ OmegaXProtocolV2Error::PayoutMintMismatch,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSol<'info> {
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, &ZERO_PUBKEY_BYTES],
        bump = protocol_fee_vault.bump,
    )]
    pub protocol_fee_vault: Account<'info, ProtocolFeeVault>,
    /// CHECK: recipient only receives lamports.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSpl<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle_permissions.bump,
    )]
    pub pool_oracle_permissions: Account<'info, PoolOraclePermissionSet>,
    #[account(mut)]
    pub payment_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, pool.key().as_ref(), oracle.key().as_ref(), payment_mint.key().as_ref()],
        bump = pool_oracle_fee_vault.bump,
    )]
    pub pool_oracle_fee_vault: Account<'info, PoolOracleFeeVault>,
    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = pool_oracle_fee_vault,
    )]
    pub pool_oracle_fee_vault_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = recipient_token_account.mint == payment_mint.key() @ OmegaXProtocolV2Error::PayoutMintMismatch,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSol<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle_permissions.bump,
    )]
    pub pool_oracle_permissions: Account<'info, PoolOraclePermissionSet>,
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, pool.key().as_ref(), oracle.key().as_ref(), &ZERO_PUBKEY_BYTES],
        bump = pool_oracle_fee_vault.bump,
    )]
    pub pool_oracle_fee_vault: Account<'info, PoolOracleFeeVault>,
    /// CHECK: recipient only receives lamports.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
}
