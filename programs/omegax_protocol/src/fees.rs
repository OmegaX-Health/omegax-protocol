// SPDX-License-Identifier: AGPL-3.0-or-later

//! Fee-vault initialization and withdrawal instruction handlers and account validation contexts.

use crate::platform::*;
#[cfg(not(feature = "quasar"))]
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;

#[cfg(not(feature = "quasar"))]
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
#[cfg(not(feature = "quasar"))]
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
#[cfg(not(feature = "quasar"))]
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

#[cfg(not(feature = "quasar"))]
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
#[cfg(not(feature = "quasar"))]
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
#[cfg(not(feature = "quasar"))]
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
#[cfg(not(feature = "quasar"))]
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
#[cfg(not(feature = "quasar"))]
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
#[cfg(not(feature = "quasar"))]
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

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_governance(authority: &Pubkey, governance: &ProtocolGovernance) -> Result<()> {
    require_keys_eq!(
        *authority,
        governance.governance_authority,
        OmegaXProtocolError::Unauthorized
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_curator_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    pool: &LiquidityPoolAccountData<'_>,
) -> Result<()> {
    if *authority == pool.curator || *authority == governance.governance_authority {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_oracle_profile_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    oracle_profile: &OracleProfileAccountData<'_>,
) -> Result<()> {
    if *authority == oracle_profile.admin
        || *authority == oracle_profile.oracle
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

#[cfg(feature = "quasar")]
fn require_quasar_fee_vault_balance(accrued: u64, withdrawn: u64, requested: u64) -> Result<u64> {
    require_quasar_positive_amount(requested)?;
    let new_withdrawn = quasar_checked_add(withdrawn, requested)?;
    require!(
        new_withdrawn <= accrued,
        OmegaXProtocolError::FeeVaultInsufficientBalance
    );
    Ok(new_withdrawn)
}

#[cfg(feature = "quasar")]
fn require_quasar_configured_fee_recipient(fee_recipient: Pubkey) -> Result<Pubkey> {
    require!(
        fee_recipient != ZERO_PUBKEY,
        OmegaXProtocolError::FeeRecipientInvalid
    );
    Ok(fee_recipient)
}

#[cfg(feature = "quasar")]
fn require_quasar_fee_recipient_owner(
    actual_owner: Pubkey,
    configured_recipient: Pubkey,
) -> Result<()> {
    require_quasar_configured_fee_recipient(configured_recipient)?;
    require_keys_eq!(
        actual_owner,
        configured_recipient,
        OmegaXProtocolError::FeeRecipientMismatch
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn require_quasar_fee_recipient_token_owner(
    recipient_token_account: &InterfaceAccount<TokenAccount>,
    configured_recipient: Pubkey,
) -> Result<()> {
    require_quasar_fee_recipient_owner(*recipient_token_account.owner(), configured_recipient)
}

#[cfg(feature = "quasar")]
fn quasar_transfer_lamports_from_fee_vault(
    vault: &impl quasar_lang::traits::AsAccountView,
    recipient: &impl quasar_lang::traits::AsAccountView,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let vault_view = vault.to_account_view();
    let recipient_view = recipient.to_account_view();
    let rent_minimum = Rent::get()?.try_minimum_balance(vault_view.data_len())?;
    let vault_after = vault_view
        .lamports()
        .checked_sub(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    require!(
        vault_after >= rent_minimum,
        OmegaXProtocolError::FeeVaultRentExemptionBreach
    );
    let recipient_after = recipient_view
        .lamports()
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    quasar_lang::accounts::account::set_lamports(vault_view, vault_after);
    quasar_lang::accounts::account::set_lamports(recipient_view, recipient_after);
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn withdraw_protocol_fee_spl<'info>(
    ctx: &mut Ctx<'info, WithdrawProtocolFeeSpl<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_governance(&authority, &ctx.accounts.protocol_governance)?;
    let new_withdrawn = require_quasar_fee_vault_balance(
        ctx.accounts.protocol_fee_vault.accrued_fees.get(),
        ctx.accounts.protocol_fee_vault.withdrawn_fees.get(),
        amount,
    )?;
    require_quasar_fee_recipient_token_owner(
        ctx.accounts.recipient_token_account,
        ctx.accounts.protocol_fee_vault.fee_recipient,
    )?;

    transfer_from_domain_vault(
        amount,
        ctx.accounts.domain_asset_vault,
        ctx.accounts.vault_token_account,
        ctx.accounts.recipient_token_account,
        ctx.accounts.asset_mint,
        ctx.accounts.token_program,
    )?;

    let new_total_assets =
        quasar_checked_sub(ctx.accounts.domain_asset_vault.total_assets.get(), amount)?;
    let domain_vault = &mut ctx.accounts.domain_asset_vault;
    let reserve_domain = domain_vault.reserve_domain;
    let asset_mint = domain_vault.asset_mint;
    let vault_token_account = domain_vault.vault_token_account;
    let bump = domain_vault.bump;
    domain_vault.set_inner(
        reserve_domain,
        asset_mint,
        vault_token_account,
        new_total_assets,
        bump,
    );

    let fee_vault = &mut ctx.accounts.protocol_fee_vault;
    let reserve_domain = fee_vault.reserve_domain;
    let asset_mint = fee_vault.asset_mint;
    let fee_recipient = fee_vault.fee_recipient;
    let accrued_fees = fee_vault.accrued_fees.get();
    let bump = fee_vault.bump;
    fee_vault.set_inner(
        reserve_domain,
        asset_mint,
        fee_recipient,
        accrued_fees,
        new_withdrawn,
        bump,
    );

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn withdraw_protocol_fee_sol<'info>(
    ctx: &mut Ctx<'info, WithdrawProtocolFeeSol<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_governance(&authority, &ctx.accounts.protocol_governance)?;
    let new_withdrawn = require_quasar_fee_vault_balance(
        ctx.accounts.protocol_fee_vault.accrued_fees.get(),
        ctx.accounts.protocol_fee_vault.withdrawn_fees.get(),
        amount,
    )?;
    require_quasar_fee_recipient_owner(
        *ctx.accounts.recipient.address(),
        ctx.accounts.protocol_fee_vault.fee_recipient,
    )?;

    quasar_transfer_lamports_from_fee_vault(
        ctx.accounts.protocol_fee_vault,
        ctx.accounts.recipient,
        amount,
    )?;

    let fee_vault = &mut ctx.accounts.protocol_fee_vault;
    let reserve_domain = fee_vault.reserve_domain;
    let asset_mint = fee_vault.asset_mint;
    let fee_recipient = fee_vault.fee_recipient;
    let accrued_fees = fee_vault.accrued_fees.get();
    let bump = fee_vault.bump;
    fee_vault.set_inner(
        reserve_domain,
        asset_mint,
        fee_recipient,
        accrued_fees,
        new_withdrawn,
        bump,
    );

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn withdraw_pool_treasury_spl<'info>(
    ctx: &mut Ctx<'info, WithdrawPoolTreasurySpl<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_curator_control(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    let new_withdrawn = require_quasar_fee_vault_balance(
        ctx.accounts.pool_treasury_vault.accrued_fees.get(),
        ctx.accounts.pool_treasury_vault.withdrawn_fees.get(),
        amount,
    )?;
    require_quasar_fee_recipient_token_owner(
        ctx.accounts.recipient_token_account,
        ctx.accounts.pool_treasury_vault.fee_recipient,
    )?;

    transfer_from_domain_vault(
        amount,
        ctx.accounts.domain_asset_vault,
        ctx.accounts.vault_token_account,
        ctx.accounts.recipient_token_account,
        ctx.accounts.asset_mint,
        ctx.accounts.token_program,
    )?;

    let new_total_assets =
        quasar_checked_sub(ctx.accounts.domain_asset_vault.total_assets.get(), amount)?;
    let domain_vault = &mut ctx.accounts.domain_asset_vault;
    let reserve_domain = domain_vault.reserve_domain;
    let asset_mint = domain_vault.asset_mint;
    let vault_token_account = domain_vault.vault_token_account;
    let bump = domain_vault.bump;
    domain_vault.set_inner(
        reserve_domain,
        asset_mint,
        vault_token_account,
        new_total_assets,
        bump,
    );

    let fee_vault = &mut ctx.accounts.pool_treasury_vault;
    let liquidity_pool = fee_vault.liquidity_pool;
    let asset_mint = fee_vault.asset_mint;
    let fee_recipient = fee_vault.fee_recipient;
    let accrued_fees = fee_vault.accrued_fees.get();
    let bump = fee_vault.bump;
    fee_vault.set_inner(
        liquidity_pool,
        asset_mint,
        fee_recipient,
        accrued_fees,
        new_withdrawn,
        bump,
    );

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn withdraw_pool_treasury_sol<'info>(
    ctx: &mut Ctx<'info, WithdrawPoolTreasurySol<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_curator_control(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    let new_withdrawn = require_quasar_fee_vault_balance(
        ctx.accounts.pool_treasury_vault.accrued_fees.get(),
        ctx.accounts.pool_treasury_vault.withdrawn_fees.get(),
        amount,
    )?;
    require_quasar_fee_recipient_owner(
        *ctx.accounts.recipient.address(),
        ctx.accounts.pool_treasury_vault.fee_recipient,
    )?;

    quasar_transfer_lamports_from_fee_vault(
        ctx.accounts.pool_treasury_vault,
        ctx.accounts.recipient,
        amount,
    )?;

    let fee_vault = &mut ctx.accounts.pool_treasury_vault;
    let liquidity_pool = fee_vault.liquidity_pool;
    let asset_mint = fee_vault.asset_mint;
    let fee_recipient = fee_vault.fee_recipient;
    let accrued_fees = fee_vault.accrued_fees.get();
    let bump = fee_vault.bump;
    fee_vault.set_inner(
        liquidity_pool,
        asset_mint,
        fee_recipient,
        accrued_fees,
        new_withdrawn,
        bump,
    );

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn withdraw_pool_oracle_fee_spl<'info>(
    ctx: &mut Ctx<'info, WithdrawPoolOracleFeeSpl<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_oracle_profile_control(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.oracle_profile,
    )?;
    let new_withdrawn = require_quasar_fee_vault_balance(
        ctx.accounts.pool_oracle_fee_vault.accrued_fees.get(),
        ctx.accounts.pool_oracle_fee_vault.withdrawn_fees.get(),
        amount,
    )?;
    require_quasar_fee_recipient_token_owner(
        ctx.accounts.recipient_token_account,
        ctx.accounts.pool_oracle_fee_vault.fee_recipient,
    )?;

    transfer_from_domain_vault(
        amount,
        ctx.accounts.domain_asset_vault,
        ctx.accounts.vault_token_account,
        ctx.accounts.recipient_token_account,
        ctx.accounts.asset_mint,
        ctx.accounts.token_program,
    )?;

    let new_total_assets =
        quasar_checked_sub(ctx.accounts.domain_asset_vault.total_assets.get(), amount)?;
    let domain_vault = &mut ctx.accounts.domain_asset_vault;
    let reserve_domain = domain_vault.reserve_domain;
    let asset_mint = domain_vault.asset_mint;
    let vault_token_account = domain_vault.vault_token_account;
    let bump = domain_vault.bump;
    domain_vault.set_inner(
        reserve_domain,
        asset_mint,
        vault_token_account,
        new_total_assets,
        bump,
    );

    let fee_vault = &mut ctx.accounts.pool_oracle_fee_vault;
    let liquidity_pool = fee_vault.liquidity_pool;
    let oracle = fee_vault.oracle;
    let asset_mint = fee_vault.asset_mint;
    let fee_recipient = fee_vault.fee_recipient;
    let accrued_fees = fee_vault.accrued_fees.get();
    let bump = fee_vault.bump;
    fee_vault.set_inner(
        liquidity_pool,
        oracle,
        asset_mint,
        fee_recipient,
        accrued_fees,
        new_withdrawn,
        bump,
    );

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn withdraw_pool_oracle_fee_sol<'info>(
    ctx: &mut Ctx<'info, WithdrawPoolOracleFeeSol<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_oracle_profile_control(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.oracle_profile,
    )?;
    let new_withdrawn = require_quasar_fee_vault_balance(
        ctx.accounts.pool_oracle_fee_vault.accrued_fees.get(),
        ctx.accounts.pool_oracle_fee_vault.withdrawn_fees.get(),
        amount,
    )?;
    require_quasar_fee_recipient_owner(
        *ctx.accounts.recipient.address(),
        ctx.accounts.pool_oracle_fee_vault.fee_recipient,
    )?;

    quasar_transfer_lamports_from_fee_vault(
        ctx.accounts.pool_oracle_fee_vault,
        ctx.accounts.recipient,
        amount,
    )?;

    let fee_vault = &mut ctx.accounts.pool_oracle_fee_vault;
    let liquidity_pool = fee_vault.liquidity_pool;
    let oracle = fee_vault.oracle;
    let asset_mint = fee_vault.asset_mint;
    let fee_recipient = fee_vault.fee_recipient;
    let accrued_fees = fee_vault.accrued_fees.get();
    let bump = fee_vault.bump;
    fee_vault.set_inner(
        liquidity_pool,
        oracle,
        asset_mint,
        fee_recipient,
        accrued_fees,
        new_withdrawn,
        bump,
    );

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: InitProtocolFeeVaultArgs))]
#[cfg_attr(feature = "quasar", instruction(asset_mint: Pubkey, _fee_recipient: Pubkey))]
pub struct InitProtocolFeeVault<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
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
    /// Optional anchor to the SPL-rail DomainAssetVault. Required when
    /// `args.asset_mint != NATIVE_SOL_MINT`; absent for SOL-rail vaults.
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[cfg(feature = "quasar")]
    #[account(
            constraint = quasar_pda_matches(
                domain_asset_vault.address(),
                &crate::ID,
                &[SEED_DOMAIN_ASSET_VAULT, reserve_domain.address().as_ref(), asset_mint.as_ref()],
                domain_asset_vault.bump,
            ) @ OmegaXProtocolError::DomainAssetVaultRequired,
            constraint = domain_asset_vault.reserve_domain == *reserve_domain.address() @ OmegaXProtocolError::DomainAssetVaultRequired,
            constraint = domain_asset_vault.asset_mint == asset_mint @ OmegaXProtocolError::AssetMintMismatch,
        )]
    pub domain_asset_vault: Option<&'info Account<DomainAssetVault>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + ProtocolFeeVault::INIT_SPACE,
            seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
            bump,
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub protocol_fee_vault: Account<'info, ProtocolFeeVault>,
    #[cfg_attr(
        feature = "quasar",
        account(
            constraint = quasar_pda_matches(
                protocol_fee_vault.address(),
                &crate::ID,
                &[SEED_PROTOCOL_FEE_VAULT, reserve_domain.address().as_ref(), asset_mint.as_ref()],
                protocol_fee_vault.bump,
            ) @ OmegaXProtocolError::FeeVaultMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub protocol_fee_vault: &'info Account<ProtocolFeeVault>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: InitPoolTreasuryVaultArgs))]
#[cfg_attr(feature = "quasar", instruction(asset_mint: Pubkey, _fee_recipient: Pubkey))]
pub struct InitPoolTreasuryVault<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
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
    /// Required for SPL rails. Must match (liquidity_pool.reserve_domain, args.asset_mint).
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[cfg(feature = "quasar")]
    #[account(
            constraint = quasar_pda_matches(
                domain_asset_vault.address(),
                &crate::ID,
                &[SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), asset_mint.as_ref()],
                domain_asset_vault.bump,
            ) @ OmegaXProtocolError::DomainAssetVaultRequired,
            constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
            constraint = domain_asset_vault.asset_mint == asset_mint @ OmegaXProtocolError::AssetMintMismatch,
        )]
    pub domain_asset_vault: Option<&'info Account<DomainAssetVault>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + PoolTreasuryVault::INIT_SPACE,
            seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), args.asset_mint.as_ref()],
            bump,
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub pool_treasury_vault: Account<'info, PoolTreasuryVault>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                pool_treasury_vault.address(),
                &crate::ID,
                &[SEED_POOL_TREASURY_VAULT, liquidity_pool.address().as_ref(), asset_mint.as_ref()],
                pool_treasury_vault.bump,
            ) @ OmegaXProtocolError::FeeVaultMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub pool_treasury_vault: &'info Account<PoolTreasuryVault>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: InitPoolOracleFeeVaultArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(oracle: Pubkey, asset_mint: Pubkey, _fee_recipient: Pubkey)
)]
pub struct InitPoolOracleFeeVault<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
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
    #[account(
        seeds = [SEED_ORACLE_PROFILE, args.oracle.as_ref()],
        bump = oracle_profile.bump,
        constraint = oracle_profile.oracle == args.oracle @ OmegaXProtocolError::OracleProfileMismatch,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[cfg(feature = "quasar")]
    #[account(
            constraint = quasar_pda_matches(
                oracle_profile.address(),
                &crate::ID,
                &[SEED_ORACLE_PROFILE, oracle.as_ref()],
                oracle_profile.bump,
            ) @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = oracle_profile.oracle == oracle @ OmegaXProtocolError::OracleProfileMismatch,
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_POOL_ORACLE_APPROVAL, liquidity_pool.key().as_ref(), args.oracle.as_ref()],
        bump = pool_oracle_approval.bump,
        constraint = pool_oracle_approval.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::LiquidityPoolMismatch,
        constraint = pool_oracle_approval.oracle == args.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_approval.active @ OmegaXProtocolError::PoolOracleApprovalRequired,
    )]
    pub pool_oracle_approval: Box<Account<'info, PoolOracleApproval>>,
    #[cfg(feature = "quasar")]
    #[account(
            constraint = quasar_pda_matches(
                pool_oracle_approval.address(),
                &crate::ID,
                &[SEED_POOL_ORACLE_APPROVAL, liquidity_pool.address().as_ref(), oracle.as_ref()],
                pool_oracle_approval.bump,
            ) @ OmegaXProtocolError::LiquidityPoolMismatch,
            constraint = pool_oracle_approval.liquidity_pool == *liquidity_pool.address() @ OmegaXProtocolError::LiquidityPoolMismatch,
        constraint = pool_oracle_approval.oracle == oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_approval.active.get() @ OmegaXProtocolError::PoolOracleApprovalRequired,
    )]
    pub pool_oracle_approval: &'info Account<PoolOracleApproval>,
    /// Required for SPL rails. The oracle fee vault accrues claims against the
    /// same DomainAssetVault used by the pool.
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[cfg(feature = "quasar")]
    #[account(
            constraint = quasar_pda_matches(
                domain_asset_vault.address(),
                &crate::ID,
                &[SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), asset_mint.as_ref()],
                domain_asset_vault.bump,
            ) @ OmegaXProtocolError::DomainAssetVaultRequired,
            constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
            constraint = domain_asset_vault.asset_mint == asset_mint @ OmegaXProtocolError::AssetMintMismatch,
        )]
    pub domain_asset_vault: Option<&'info Account<DomainAssetVault>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + PoolOracleFeeVault::INIT_SPACE,
            seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), args.oracle.as_ref(), args.asset_mint.as_ref()],
            bump,
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_fee_vault: Account<'info, PoolOracleFeeVault>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                pool_oracle_fee_vault.address(),
                &crate::ID,
                &[SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.address().as_ref(), oracle.as_ref(), asset_mint.as_ref()],
                pool_oracle_fee_vault.bump,
            ) @ OmegaXProtocolError::FeeVaultMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub pool_oracle_fee_vault: &'info Account<PoolOracleFeeVault>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSpl<'info> {
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
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
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
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            protocol_fee_vault.address(),
            &crate::ID,
            &[SEED_PROTOCOL_FEE_VAULT, reserve_domain.address().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
            protocol_fee_vault.bump,
        ) @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.reserve_domain == *reserve_domain.address() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: &'info mut Account<ProtocolFeeVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, reserve_domain.address().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
            domain_asset_vault.bump,
        ) @ OmegaXProtocolError::DomainAssetVaultRequired
    )]
    pub domain_asset_vault: &'info mut Account<DomainAssetVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_ledger.bump,
    )]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, reserve_domain.address().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
            domain_asset_ledger.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = asset_mint.key() == protocol_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *asset_mint.address() == protocol_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = *vault_token_account.address() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub recipient_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Interface<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSol<'info> {
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
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
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
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            protocol_fee_vault.address(),
            &crate::ID,
            &[SEED_PROTOCOL_FEE_VAULT, reserve_domain.address().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
            protocol_fee_vault.bump,
        ) @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.reserve_domain == *reserve_domain.address() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: &'info mut Account<ProtocolFeeVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub recipient: &'info mut SystemAccount,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySpl<'info> {
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
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
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
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            pool_treasury_vault.address(),
            &crate::ID,
            &[SEED_POOL_TREASURY_VAULT, liquidity_pool.address().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
            pool_treasury_vault.bump,
        ) @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.liquidity_pool == *liquidity_pool.address() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: &'info mut Account<PoolTreasuryVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_treasury_vault.asset_mint.as_ref()],
            domain_asset_vault.bump,
        ) @ OmegaXProtocolError::DomainAssetVaultRequired
    )]
    pub domain_asset_vault: &'info mut Account<DomainAssetVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = domain_asset_ledger.bump,
    )]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), pool_treasury_vault.asset_mint.as_ref()],
            domain_asset_ledger.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = asset_mint.key() == pool_treasury_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *asset_mint.address() == pool_treasury_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = *vault_token_account.address() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub recipient_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Interface<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySol<'info> {
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
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
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
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            pool_treasury_vault.address(),
            &crate::ID,
            &[SEED_POOL_TREASURY_VAULT, liquidity_pool.address().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
            pool_treasury_vault.bump,
        ) @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.liquidity_pool == *liquidity_pool.address() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: &'info mut Account<PoolTreasuryVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub recipient: &'info mut SystemAccount,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSpl<'info> {
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
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
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
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = pool_oracle_fee_vault.bump,
        constraint = pool_oracle_fee_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: Box<Account<'info, PoolOracleFeeVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            pool_oracle_fee_vault.address(),
            &crate::ID,
            &[SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.address().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
            pool_oracle_fee_vault.bump,
        ) @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.liquidity_pool == *liquidity_pool.address() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: &'info mut Account<PoolOracleFeeVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
            domain_asset_vault.bump,
        ) @ OmegaXProtocolError::DomainAssetVaultRequired
    )]
    pub domain_asset_vault: &'info mut Account<DomainAssetVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_ledger.bump,
    )]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
            domain_asset_ledger.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = asset_mint.key() == pool_oracle_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *asset_mint.address() == pool_oracle_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = *vault_token_account.address() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub recipient_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Interface<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSol<'info> {
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
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
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
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = pool_oracle_fee_vault.bump,
        constraint = pool_oracle_fee_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: Box<Account<'info, PoolOracleFeeVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            pool_oracle_fee_vault.address(),
            &crate::ID,
            &[SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.address().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
            pool_oracle_fee_vault.bump,
        ) @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.liquidity_pool == *liquidity_pool.address() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: &'info mut Account<PoolOracleFeeVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub recipient: &'info mut SystemAccount,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
