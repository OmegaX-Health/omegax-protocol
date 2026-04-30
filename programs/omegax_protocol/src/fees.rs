// SPDX-License-Identifier: AGPL-3.0-or-later

//! Fee-vault initialization and withdrawal instruction handlers and account validation contexts.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;

pub(crate) fn init_protocol_fee_vault(
    ctx: Context<InitProtocolFeeVault>,
    args: InitProtocolFeeVaultArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    require!(
        args.asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::AssetMintMismatch
    );
    // SPL rails MUST present a DomainAssetVault; SOL rail keeps lamports on the
    // fee-vault PDA itself.
    if args.asset_mint != NATIVE_SOL_MINT {
        require!(
            ctx.accounts.domain_asset_vault.is_some(),
            OmegaXProtocolError::DomainAssetVaultRequired
        );
    }

    let vault = &mut ctx.accounts.protocol_fee_vault;
    vault.reserve_domain = ctx.accounts.reserve_domain.key();
    vault.asset_mint = args.asset_mint;
    vault.fee_recipient = require_configured_fee_recipient(args.fee_recipient)?;
    vault.accrued_fees = 0;
    vault.withdrawn_fees = 0;
    vault.bump = ctx.bumps.protocol_fee_vault;

    emit!(FeeVaultInitializedEvent {
        vault: vault.key(),
        scope: vault.reserve_domain,
        asset_mint: vault.asset_mint,
        fee_recipient: vault.fee_recipient,
        rail: 0,
    });

    Ok(())
}

/// Phase 1.6 — Initialize the pool-treasury vault for a (liquidity_pool, asset_mint)
/// rail. Governance-only init; pool-admin signs withdrawals (PR2).
pub(crate) fn init_pool_treasury_vault(
    ctx: Context<InitPoolTreasuryVault>,
    args: InitPoolTreasuryVaultArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    require!(
        args.asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::AssetMintMismatch
    );
    // Either SOL rail or matching the pool's SPL deposit mint.
    require!(
        args.asset_mint == NATIVE_SOL_MINT
            || args.asset_mint == ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    if args.asset_mint != NATIVE_SOL_MINT {
        require!(
            ctx.accounts.domain_asset_vault.is_some(),
            OmegaXProtocolError::DomainAssetVaultRequired
        );
    }

    let vault = &mut ctx.accounts.pool_treasury_vault;
    vault.liquidity_pool = ctx.accounts.liquidity_pool.key();
    vault.asset_mint = args.asset_mint;
    vault.fee_recipient = require_configured_fee_recipient(args.fee_recipient)?;
    vault.accrued_fees = 0;
    vault.withdrawn_fees = 0;
    vault.bump = ctx.bumps.pool_treasury_vault;

    emit!(FeeVaultInitializedEvent {
        vault: vault.key(),
        scope: vault.liquidity_pool,
        asset_mint: vault.asset_mint,
        fee_recipient: vault.fee_recipient,
        rail: 1,
    });

    Ok(())
}

/// Phase 1.6 — Initialize the pool-oracle fee vault for a (liquidity_pool,
/// oracle, asset_mint) rail. Governance-only init; the registered oracle
/// wallet (or oracle profile admin) signs withdrawals (PR2).
pub(crate) fn init_pool_oracle_fee_vault(
    ctx: Context<InitPoolOracleFeeVault>,
    args: InitPoolOracleFeeVaultArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    require!(
        args.asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        args.oracle != ZERO_PUBKEY,
        OmegaXProtocolError::OracleProfileMismatch
    );
    require!(
        ctx.accounts.oracle_profile.active,
        OmegaXProtocolError::OracleProfileInactive
    );
    require!(
        ctx.accounts.oracle_profile.claimed,
        OmegaXProtocolError::OracleProfileUnclaimed
    );
    // Either SOL rail or matching the pool's SPL deposit mint.
    require!(
        args.asset_mint == NATIVE_SOL_MINT
            || args.asset_mint == ctx.accounts.liquidity_pool.deposit_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    if args.asset_mint != NATIVE_SOL_MINT {
        require!(
            ctx.accounts.domain_asset_vault.is_some(),
            OmegaXProtocolError::DomainAssetVaultRequired
        );
    }

    let vault = &mut ctx.accounts.pool_oracle_fee_vault;
    vault.liquidity_pool = ctx.accounts.liquidity_pool.key();
    vault.oracle = args.oracle;
    vault.asset_mint = args.asset_mint;
    vault.fee_recipient = require_configured_fee_recipient(args.fee_recipient)?;
    vault.accrued_fees = 0;
    vault.withdrawn_fees = 0;
    vault.bump = ctx.bumps.pool_oracle_fee_vault;

    emit!(FeeVaultInitializedEvent {
        vault: vault.key(),
        scope: vault.liquidity_pool,
        asset_mint: vault.asset_mint,
        fee_recipient: vault.fee_recipient,
        rail: 2,
    });

    Ok(())
}

pub(crate) fn withdraw_protocol_fee_spl(
    ctx: Context<WithdrawProtocolFeeSpl>,
    args: WithdrawArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    let new_withdrawn = require_fee_vault_balance(
        ctx.accounts.protocol_fee_vault.accrued_fees,
        ctx.accounts.protocol_fee_vault.withdrawn_fees,
        args.amount,
    )?;
    require_fee_recipient_token_owner(
        &ctx.accounts.recipient_token_account,
        ctx.accounts.protocol_fee_vault.fee_recipient,
    )?;

    transfer_from_domain_vault(
        args.amount,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;
    book_fee_withdrawal(
        &mut ctx.accounts.domain_asset_vault.total_assets,
        &mut ctx.accounts.domain_asset_ledger.sheet,
        args.amount,
    )?;

    let vault = &mut ctx.accounts.protocol_fee_vault;
    vault.withdrawn_fees = new_withdrawn;
    emit!(FeeWithdrawnEvent {
        vault: vault.key(),
        asset_mint: vault.asset_mint,
        amount: args.amount,
        configured_recipient: vault.fee_recipient,
        recipient: ctx.accounts.recipient_token_account.key(),
        withdrawn_total: new_withdrawn,
    });
    Ok(())
}

/// Sweep accrued protocol fees (SOL rail) to a recipient system account.
/// Authority: governance only. Lamports come straight off the fee-vault
/// PDA; rent-exempt minimum is preserved.
pub(crate) fn withdraw_protocol_fee_sol(
    ctx: Context<WithdrawProtocolFeeSol>,
    args: WithdrawArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    let new_withdrawn = require_fee_vault_balance(
        ctx.accounts.protocol_fee_vault.accrued_fees,
        ctx.accounts.protocol_fee_vault.withdrawn_fees,
        args.amount,
    )?;
    require_fee_recipient_owner(
        ctx.accounts.recipient.key(),
        ctx.accounts.protocol_fee_vault.fee_recipient,
    )?;

    let rent = Rent::get()?;
    let vault_ai = ctx.accounts.protocol_fee_vault.to_account_info();
    let recipient_ai = ctx.accounts.recipient.to_account_info();
    let vault_data_len = vault_ai.data_len();
    transfer_lamports_from_fee_vault(&vault_ai, &recipient_ai, args.amount, &rent, vault_data_len)?;

    let vault = &mut ctx.accounts.protocol_fee_vault;
    vault.withdrawn_fees = new_withdrawn;
    emit!(FeeWithdrawnEvent {
        vault: vault.key(),
        asset_mint: vault.asset_mint,
        amount: args.amount,
        configured_recipient: vault.fee_recipient,
        recipient: ctx.accounts.recipient.key(),
        withdrawn_total: new_withdrawn,
    });
    Ok(())
}

/// Sweep accrued pool-treasury fees (SPL rail).
/// Authority: pool curator OR governance.
pub(crate) fn withdraw_pool_treasury_spl(
    ctx: Context<WithdrawPoolTreasurySpl>,
    args: WithdrawArgs,
) -> Result<()> {
    require_curator_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    let new_withdrawn = require_fee_vault_balance(
        ctx.accounts.pool_treasury_vault.accrued_fees,
        ctx.accounts.pool_treasury_vault.withdrawn_fees,
        args.amount,
    )?;
    require_fee_recipient_token_owner(
        &ctx.accounts.recipient_token_account,
        ctx.accounts.pool_treasury_vault.fee_recipient,
    )?;

    transfer_from_domain_vault(
        args.amount,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;
    book_fee_withdrawal(
        &mut ctx.accounts.domain_asset_vault.total_assets,
        &mut ctx.accounts.domain_asset_ledger.sheet,
        args.amount,
    )?;

    let vault = &mut ctx.accounts.pool_treasury_vault;
    vault.withdrawn_fees = new_withdrawn;
    emit!(FeeWithdrawnEvent {
        vault: vault.key(),
        asset_mint: vault.asset_mint,
        amount: args.amount,
        configured_recipient: vault.fee_recipient,
        recipient: ctx.accounts.recipient_token_account.key(),
        withdrawn_total: new_withdrawn,
    });
    Ok(())
}

/// Sweep accrued pool-treasury fees (SOL rail).
/// Authority: pool curator OR governance.
pub(crate) fn withdraw_pool_treasury_sol(
    ctx: Context<WithdrawPoolTreasurySol>,
    args: WithdrawArgs,
) -> Result<()> {
    require_curator_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    let new_withdrawn = require_fee_vault_balance(
        ctx.accounts.pool_treasury_vault.accrued_fees,
        ctx.accounts.pool_treasury_vault.withdrawn_fees,
        args.amount,
    )?;
    require_fee_recipient_owner(
        ctx.accounts.recipient.key(),
        ctx.accounts.pool_treasury_vault.fee_recipient,
    )?;

    let rent = Rent::get()?;
    let vault_ai = ctx.accounts.pool_treasury_vault.to_account_info();
    let recipient_ai = ctx.accounts.recipient.to_account_info();
    let vault_data_len = vault_ai.data_len();
    transfer_lamports_from_fee_vault(&vault_ai, &recipient_ai, args.amount, &rent, vault_data_len)?;

    let vault = &mut ctx.accounts.pool_treasury_vault;
    vault.withdrawn_fees = new_withdrawn;
    emit!(FeeWithdrawnEvent {
        vault: vault.key(),
        asset_mint: vault.asset_mint,
        amount: args.amount,
        configured_recipient: vault.fee_recipient,
        recipient: ctx.accounts.recipient.key(),
        withdrawn_total: new_withdrawn,
    });
    Ok(())
}

/// Sweep accrued pool-oracle fees (SPL rail) to a recipient ATA.
/// Authority: registered oracle wallet OR oracle profile admin OR governance.
pub(crate) fn withdraw_pool_oracle_fee_spl(
    ctx: Context<WithdrawPoolOracleFeeSpl>,
    args: WithdrawArgs,
) -> Result<()> {
    require_oracle_profile_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.oracle_profile,
    )?;
    let new_withdrawn = require_fee_vault_balance(
        ctx.accounts.pool_oracle_fee_vault.accrued_fees,
        ctx.accounts.pool_oracle_fee_vault.withdrawn_fees,
        args.amount,
    )?;
    require_fee_recipient_token_owner(
        &ctx.accounts.recipient_token_account,
        ctx.accounts.pool_oracle_fee_vault.fee_recipient,
    )?;

    transfer_from_domain_vault(
        args.amount,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;
    book_fee_withdrawal(
        &mut ctx.accounts.domain_asset_vault.total_assets,
        &mut ctx.accounts.domain_asset_ledger.sheet,
        args.amount,
    )?;

    let vault = &mut ctx.accounts.pool_oracle_fee_vault;
    vault.withdrawn_fees = new_withdrawn;
    emit!(FeeWithdrawnEvent {
        vault: vault.key(),
        asset_mint: vault.asset_mint,
        amount: args.amount,
        configured_recipient: vault.fee_recipient,
        recipient: ctx.accounts.recipient_token_account.key(),
        withdrawn_total: new_withdrawn,
    });
    Ok(())
}

/// Sweep accrued pool-oracle fees (SOL rail) to a recipient system account.
/// Authority: registered oracle wallet OR oracle profile admin OR governance.
pub(crate) fn withdraw_pool_oracle_fee_sol(
    ctx: Context<WithdrawPoolOracleFeeSol>,
    args: WithdrawArgs,
) -> Result<()> {
    require_oracle_profile_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.oracle_profile,
    )?;
    let new_withdrawn = require_fee_vault_balance(
        ctx.accounts.pool_oracle_fee_vault.accrued_fees,
        ctx.accounts.pool_oracle_fee_vault.withdrawn_fees,
        args.amount,
    )?;
    require_fee_recipient_owner(
        ctx.accounts.recipient.key(),
        ctx.accounts.pool_oracle_fee_vault.fee_recipient,
    )?;

    let rent = Rent::get()?;
    let vault_ai = ctx.accounts.pool_oracle_fee_vault.to_account_info();
    let recipient_ai = ctx.accounts.recipient.to_account_info();
    let vault_data_len = vault_ai.data_len();
    transfer_lamports_from_fee_vault(&vault_ai, &recipient_ai, args.amount, &rent, vault_data_len)?;

    let vault = &mut ctx.accounts.pool_oracle_fee_vault;
    vault.withdrawn_fees = new_withdrawn;
    emit!(FeeWithdrawnEvent {
        vault: vault.key(),
        asset_mint: vault.asset_mint,
        amount: args.amount,
        configured_recipient: vault.fee_recipient,
        recipient: ctx.accounts.recipient.key(),
        withdrawn_total: new_withdrawn,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(args: InitProtocolFeeVaultArgs)]
pub struct InitProtocolFeeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    /// Optional anchor to the SPL-rail DomainAssetVault. Required when
    /// `args.asset_mint != NATIVE_SOL_MINT`; absent for SOL-rail vaults.
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolFeeVault::INIT_SPACE,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump,
    )]
    pub protocol_fee_vault: Account<'info, ProtocolFeeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: InitPoolTreasuryVaultArgs)]
pub struct InitPoolTreasuryVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    /// Required for SPL rails. Must match (liquidity_pool.reserve_domain, args.asset_mint).
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolTreasuryVault::INIT_SPACE,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), args.asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_vault: Account<'info, PoolTreasuryVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: InitPoolOracleFeeVaultArgs)]
pub struct InitPoolOracleFeeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, args.oracle.as_ref()],
        bump = oracle_profile.bump,
        constraint = oracle_profile.oracle == args.oracle @ OmegaXProtocolError::OracleProfileMismatch,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        seeds = [SEED_POOL_ORACLE_APPROVAL, liquidity_pool.key().as_ref(), args.oracle.as_ref()],
        bump = pool_oracle_approval.bump,
        constraint = pool_oracle_approval.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::LiquidityPoolMismatch,
        constraint = pool_oracle_approval.oracle == args.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_approval.active @ OmegaXProtocolError::PoolOracleApprovalRequired,
    )]
    pub pool_oracle_approval: Box<Account<'info, PoolOracleApproval>>,
    /// Required for SPL rails. The oracle fee vault accrues claims against the
    /// same DomainAssetVault used by the pool.
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolOracleFeeVault::INIT_SPACE,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), args.oracle.as_ref(), args.asset_mint.as_ref()],
        bump,
    )]
    pub pool_oracle_fee_vault: Account<'info, PoolOracleFeeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSpl<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Box<Account<'info, ReserveDomain>>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_ledger.bump,
    )]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(
        constraint = asset_mint.key() == protocol_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSol<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Box<Account<'info, ReserveDomain>>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySpl<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = domain_asset_ledger.bump,
    )]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(
        constraint = asset_mint.key() == pool_treasury_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySol<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSpl<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = pool_oracle_fee_vault.bump,
        constraint = pool_oracle_fee_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: Box<Account<'info, PoolOracleFeeVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_ledger.bump,
    )]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(
        constraint = asset_mint.key() == pool_oracle_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSol<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = pool_oracle_fee_vault.bump,
        constraint = pool_oracle_fee_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: Box<Account<'info, PoolOracleFeeVault>>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
