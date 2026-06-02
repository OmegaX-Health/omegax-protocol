// SPDX-License-Identifier: AGPL-3.0-or-later

//! Capital access, LP-position, checked arithmetic, NAV, and redemption helpers.

use crate::platform::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

use super::require_positive_amount;

pub(crate) fn require_class_access(
    capital_class: &CapitalClassAccountData<'_>,
    credentialed: bool,
) -> Result<()> {
    require_class_access_mode(capital_class.restriction_mode, credentialed)
}

pub(crate) fn require_class_access_mode(restriction_mode: u8, credentialed: bool) -> Result<()> {
    match restriction_mode {
        CAPITAL_CLASS_RESTRICTION_OPEN => Ok(()),
        CAPITAL_CLASS_RESTRICTION_RESTRICTED | CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY => {
            require!(credentialed, OmegaXProtocolError::RestrictedCapitalClass);
            Ok(())
        }
        _ => err!(OmegaXProtocolError::RestrictedCapitalClass),
    }
}

pub(crate) fn derive_queue_only_redemptions(pause_flags: u32, redemption_policy: u8) -> bool {
    pause_flags & PAUSE_FLAG_REDEMPTION_QUEUE_ONLY != 0
        || redemption_policy == REDEMPTION_POLICY_QUEUE_ONLY
}

pub(crate) fn debit_realized_pnl_for_loss(realized_pnl: i64, amount: u64) -> Result<i64> {
    let amount = i64::try_from(amount).map_err(|_| OmegaXProtocolError::ArithmeticError)?;
    realized_pnl
        .checked_sub(amount)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn ensure_lp_position_binding(
    lp_position: &mut LPPosition,
    capital_class: Pubkey,
    owner: Pubkey,
    bump: u8,
) -> Result<()> {
    if lp_position.owner == ZERO_PUBKEY && lp_position.capital_class == ZERO_PUBKEY {
        lp_position.capital_class = capital_class;
        lp_position.owner = owner;
        lp_position.shares = 0;
        lp_position.subscription_basis = 0;
        lp_position.pending_redemption_shares = 0;
        lp_position.pending_redemption_assets = 0;
        lp_position.realized_distributions = 0;
        lp_position.impaired_principal = 0;
        lp_position.lockup_ends_at = 0;
        lp_position.credentialed = false;
        lp_position.queue_status = LP_QUEUE_STATUS_NONE;
        lp_position.redemption_sequence = 0;
        lp_position.redemption_requested_at = 0;
        lp_position.bump = bump;
        return Ok(());
    }

    require_keys_eq!(
        lp_position.capital_class,
        capital_class,
        OmegaXProtocolError::Unauthorized
    );
    require_keys_eq!(lp_position.owner, owner, OmegaXProtocolError::Unauthorized);

    if lp_position.bump == 0 {
        lp_position.bump = bump;
    }

    Ok(())
}

pub(crate) fn update_lp_position_credentialing_state(
    lp_position: &mut LPPosition,
    credentialed: bool,
) -> Result<()> {
    if !credentialed {
        require!(
            lp_position.shares == 0
                && lp_position.pending_redemption_shares == 0
                && lp_position.pending_redemption_assets == 0,
            OmegaXProtocolError::LPPositionHasActiveCapital
        );
    }

    lp_position.credentialed = credentialed;
    Ok(())
}

pub(crate) fn apply_lp_position_deposit(
    lp_position: &mut LPPosition,
    amount: u64,
    shares: u64,
    min_lockup_seconds: i64,
    now_ts: i64,
) -> Result<()> {
    require!(
        min_lockup_seconds >= 0,
        OmegaXProtocolError::InvalidLockupSeconds
    );
    lp_position.shares = checked_add(lp_position.shares, shares)?;
    lp_position.subscription_basis = checked_add(lp_position.subscription_basis, amount)?;
    lp_position.lockup_ends_at = now_ts
        .checked_add(min_lockup_seconds)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    Ok(())
}

pub(crate) fn checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn checked_u128_to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn deposit_shares_for_nav(
    net_amount: u64,
    total_shares: u64,
    nav_assets: u64,
    min_shares_out: u64,
) -> Result<u64> {
    require_positive_amount(net_amount)?;
    let shares = if total_shares == 0 && nav_assets == 0 {
        net_amount
    } else {
        require!(
            total_shares > 0 && nav_assets > 0,
            OmegaXProtocolError::InvalidCapitalShareState
        );
        let computed = (net_amount as u128)
            .checked_mul(total_shares as u128)
            .ok_or(OmegaXProtocolError::ArithmeticError)?
            .checked_div(nav_assets as u128)
            .ok_or(OmegaXProtocolError::ArithmeticError)?;
        checked_u128_to_u64(computed)?
    };

    require!(shares > 0, OmegaXProtocolError::InvalidDepositShares);
    if min_shares_out > 0 {
        require!(
            shares >= min_shares_out,
            OmegaXProtocolError::MinimumSharesOutNotMet
        );
    }
    Ok(shares)
}

pub(crate) fn prorata_amount(numerator: u64, denominator: u64, amount: u64) -> Result<u64> {
    require!(
        numerator > 0 && denominator > 0 && numerator <= denominator,
        OmegaXProtocolError::InvalidRedemptionAmount
    );
    let prorata = (amount as u128)
        .checked_mul(numerator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        .checked_div(denominator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let value = checked_u128_to_u64(prorata)?;
    require!(value > 0, OmegaXProtocolError::InvalidRedemptionAmount);
    Ok(value)
}

pub(crate) fn redeemable_assets_for_shares(
    shares: u64,
    total_shares: u64,
    nav_assets: u64,
) -> Result<u64> {
    prorata_amount(shares, total_shares, nav_assets)
}

pub(crate) fn redemption_assets_to_process(
    shares: u64,
    pending_redemption_shares: u64,
    pending_redemption_assets: u64,
) -> Result<u64> {
    if shares == pending_redemption_shares {
        require!(
            pending_redemption_assets > 0,
            OmegaXProtocolError::InvalidRedemptionAmount
        );
        Ok(pending_redemption_assets)
    } else {
        prorata_amount(shares, pending_redemption_shares, pending_redemption_assets)
    }
}

pub(crate) fn assign_redemption_queue_ticket(
    capital_class: &mut CapitalClassAccountData<'_>,
    lp_position: &mut LPPosition,
    now_ts: i64,
) -> Result<u64> {
    if lp_position.pending_redemption_shares == 0 {
        let sequence = capital_class.next_redemption_sequence;
        lp_position.redemption_sequence = sequence;
        lp_position.redemption_requested_at = now_ts;
        capital_class.next_redemption_sequence =
            checked_add(capital_class.next_redemption_sequence, 1)?;
        return Ok(sequence);
    }

    Ok(lp_position.redemption_sequence)
}

pub(crate) fn require_redemption_queue_head(
    capital_class: &CapitalClassAccountData<'_>,
    lp_position: &LPPosition,
) -> Result<()> {
    require!(
        lp_position.queue_status == LP_QUEUE_STATUS_PENDING
            && lp_position.pending_redemption_shares > 0,
        OmegaXProtocolError::AmountExceedsPendingRedemption
    );
    require!(
        lp_position.redemption_sequence == capital_class.next_redemption_to_process,
        OmegaXProtocolError::RedemptionQueueOutOfOrder
    );
    Ok(())
}

pub(crate) fn resolve_redemption_queue_status_after_process(
    capital_class: &mut CapitalClassAccountData<'_>,
    lp_position: &mut LPPosition,
) -> Result<()> {
    if lp_position.pending_redemption_shares == 0 {
        lp_position.queue_status = LP_QUEUE_STATUS_PROCESSED;
        capital_class.next_redemption_to_process =
            checked_add(capital_class.next_redemption_to_process, 1)?;
    } else {
        lp_position.queue_status = LP_QUEUE_STATUS_PENDING;
    }

    Ok(())
}
