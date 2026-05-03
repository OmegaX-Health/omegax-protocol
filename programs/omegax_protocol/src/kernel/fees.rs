// SPDX-License-Identifier: AGPL-3.0-or-later

//! Fee accrual, recipient, vault-balance, and SOL-rail transfer helpers.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::constants::*;
use crate::errors::*;

use super::{checked_add, checked_u128_to_u64, require_positive_amount};

// Phase 1.6 — Fee accrual helpers. Inflow handlers (record_premium_payment,
// deposit_into_capital_class, process_redemption_queue, settle_claim_case)
// call `fee_share_from_bps` to compute the carve-out from a user-facing
// amount, then `accrue_fee` to credit the vault's `accrued_fees` counter.
// SPL tokens physically remain in the matching `DomainAssetVault.vault_token_account`;
// the fee-vault account only tracks the rail's claim. SOL fees physically
// reside on the fee-vault PDA itself (lamport math, not SPL CPI).
//
// Floors to zero (Solana convention). Returns 0 when bps == 0 or amount == 0,
// so callers can blindly invoke without conditional skips.
pub(crate) fn fee_share_from_bps(amount: u64, bps: u16) -> Result<u64> {
    if bps == 0 || amount == 0 {
        return Ok(0);
    }
    require!(
        bps <= BASIS_POINTS_DENOMINATOR,
        OmegaXProtocolError::FeeVaultBpsMisconfigured
    );
    let scaled = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        .checked_div(BASIS_POINTS_DENOMINATOR as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let fee = checked_u128_to_u64(scaled)?;
    // Defensive: fee can never exceed amount.
    require!(fee <= amount, OmegaXProtocolError::ArithmeticError);
    Ok(fee)
}

// Credits `amount` to the running accrued counter and returns the new total.
// Callers emit `FeeAccruedEvent` with the returned total. No-op when amount == 0
// (still returns the unchanged total) so callers can blindly invoke after a
// `fee_share_from_bps(...)` that may yield zero.
pub(crate) fn accrue_fee(accrued: &mut u64, amount: u64) -> Result<u64> {
    if amount == 0 {
        return Ok(*accrued);
    }
    let new_total = checked_add(*accrued, amount)?;
    *accrued = new_total;
    Ok(new_total)
}

// Phase 1.7 — Verifies a withdrawal amount fits within the vault's claim.
// `withdrawn + requested <= accrued` must hold; otherwise the rail would
// over-withdraw beyond what's been accrued. Returns the new withdrawn total.
pub(crate) fn require_fee_vault_balance(
    accrued: u64,
    withdrawn: u64,
    requested: u64,
) -> Result<u64> {
    require_positive_amount(requested)?;
    let new_withdrawn = checked_add(withdrawn, requested)?;
    require!(
        new_withdrawn <= accrued,
        OmegaXProtocolError::FeeVaultInsufficientBalance
    );
    Ok(new_withdrawn)
}

pub(crate) fn require_configured_fee_recipient(fee_recipient: Pubkey) -> Result<Pubkey> {
    require!(
        fee_recipient != ZERO_PUBKEY,
        OmegaXProtocolError::FeeRecipientInvalid
    );
    Ok(fee_recipient)
}

pub(crate) fn require_fee_recipient_owner(
    actual_owner: Pubkey,
    configured_recipient: Pubkey,
) -> Result<()> {
    require_configured_fee_recipient(configured_recipient)?;
    require_keys_eq!(
        actual_owner,
        configured_recipient,
        OmegaXProtocolError::FeeRecipientMismatch
    );
    Ok(())
}

pub(crate) fn require_fee_recipient_token_owner<'info>(
    recipient_token_account: &InterfaceAccount<'info, TokenAccount>,
    configured_recipient: Pubkey,
) -> Result<()> {
    require_fee_recipient_owner(recipient_token_account.owner, configured_recipient)
}

// Phase 1.7 — SOL-rail withdrawal. Mutates the fee-vault PDA's lamports
// directly (SystemProgram::transfer cannot move lamports out of program-owned
// accounts). Rejects withdrawals that would breach the PDA's rent-exempt
// minimum so the account stays alive across operations.
//
// Caller must pass `vault_data_len = vault_account.data_len()` so the
// rent-minimum lookup uses the live account size; passing a stale or
// constructed value would mis-compute the rent floor.
pub(crate) fn transfer_lamports_from_fee_vault<'info>(
    vault_ai: &AccountInfo<'info>,
    recipient_ai: &AccountInfo<'info>,
    amount: u64,
    rent: &Rent,
    vault_data_len: usize,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let rent_minimum = rent.minimum_balance(vault_data_len);
    let vault_lamports = vault_ai.lamports();
    let vault_after = vault_lamports
        .checked_sub(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    require!(
        vault_after >= rent_minimum,
        OmegaXProtocolError::FeeVaultRentExemptionBreach
    );
    let recipient_lamports = recipient_ai.lamports();
    let recipient_after = recipient_lamports
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    **vault_ai.try_borrow_mut_lamports()? = vault_after;
    **recipient_ai.try_borrow_mut_lamports()? = recipient_after;
    Ok(())
}
