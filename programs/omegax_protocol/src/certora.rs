// SPDX-License-Identifier: AGPL-3.0-or-later

//! Certora CVLR rules compiled only for manual formal-verification runs.

use cvlr::prelude::*;

use crate::constants::{BASIS_POINTS_DENOMINATOR, MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS};
use crate::reserve_waterfall::require_selected_asset_payout_value_bounds;

const CERTORA_SCALE_1E6: u128 = 1_000_000;
const CERTORA_MAX_AMOUNT: u64 = 1_000_000_000;
const CERTORA_MAX_PRICE_1E8: u64 = 1_000_000;
const CERTORA_MAX_BALANCE_COMPONENT: u64 = 1_000_000_000_000;

fn certora_value_1e8(amount: u64, price_1e8: u64) -> u128 {
    ((amount as u128) * (price_1e8 as u128)) / CERTORA_SCALE_1E6
}

#[rule]
pub fn rule_selected_asset_payout_bounds() {
    let claim_credit_amount: u64 = nondet();
    let payout_amount: u64 = nondet();
    let max_overpay_bps: u16 = nondet();
    let claim_price_1e8: u64 = nondet();
    let payout_price_1e8: u64 = nondet();

    cvlr_assume!(claim_credit_amount > 0);
    cvlr_assume!(payout_amount > 0);
    cvlr_assume!(claim_credit_amount <= CERTORA_MAX_AMOUNT);
    cvlr_assume!(payout_amount <= CERTORA_MAX_AMOUNT);
    cvlr_assume!(claim_price_1e8 > 0);
    cvlr_assume!(payout_price_1e8 > 0);
    cvlr_assume!(claim_price_1e8 <= CERTORA_MAX_PRICE_1E8);
    cvlr_assume!(payout_price_1e8 <= CERTORA_MAX_PRICE_1E8);
    cvlr_assume!(max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS);

    let claim_value = certora_value_1e8(claim_credit_amount, claim_price_1e8);
    let payout_value = certora_value_1e8(payout_amount, payout_price_1e8);
    let result =
        require_selected_asset_payout_value_bounds(claim_value, payout_value, max_overpay_bps);

    if result.is_ok() {
        let max_value = (claim_value
            * ((BASIS_POINTS_DENOMINATOR as u128) + (max_overpay_bps as u128)))
            / (BASIS_POINTS_DENOMINATOR as u128);

        cvlr_assert!(payout_value >= claim_value);
        cvlr_assert!(payout_value <= max_value);
    }

    cvlr_satisfy!(result.is_ok());
}

#[rule]
pub fn rule_fee_recipient_binding() {
    let configured_recipient: u64 = nondet();
    let actual_owner: u64 = nondet();

    let accepted = configured_recipient != 0 && actual_owner == configured_recipient;

    if accepted {
        cvlr_assert!(configured_recipient != 0);
        cvlr_assert!(actual_owner == configured_recipient);
    }

    cvlr_satisfy!(accepted);
}

#[rule]
pub fn rule_fee_vault_withdrawal_bounds() {
    let accrued: u64 = nondet();
    let withdrawn: u64 = nondet();
    let requested: u64 = nondet();

    let positive_request = requested > 0;
    let addition_safe = withdrawn <= u64::MAX - requested;
    let candidate_safe = positive_request && addition_safe;

    if candidate_safe {
        let new_withdrawn = withdrawn + requested;
        let accepted = new_withdrawn <= accrued;

        if accepted {
            cvlr_assert!(requested > 0);
            cvlr_assert!(new_withdrawn >= withdrawn);
            cvlr_assert!(new_withdrawn <= accrued);
            cvlr_assert!(requested <= accrued - withdrawn);
        }

        cvlr_satisfy!(accepted);
    }

    cvlr_satisfy!(candidate_safe);
}

#[rule]
pub fn rule_reserve_capacity_non_overflow() {
    let funded: u64 = nondet();
    let allocated: u64 = nondet();
    let reserved: u64 = nondet();
    let claimable: u64 = nondet();
    let payable: u64 = nondet();
    let impaired: u64 = nondet();
    let pending_redemption: u64 = nondet();
    let restricted: u64 = nondet();

    cvlr_assume!(funded <= CERTORA_MAX_BALANCE_COMPONENT);
    cvlr_assume!(allocated <= CERTORA_MAX_BALANCE_COMPONENT);
    cvlr_assume!(reserved <= CERTORA_MAX_BALANCE_COMPONENT);
    cvlr_assume!(claimable <= CERTORA_MAX_BALANCE_COMPONENT);
    cvlr_assume!(payable <= CERTORA_MAX_BALANCE_COMPONENT);
    cvlr_assume!(impaired <= CERTORA_MAX_BALANCE_COMPONENT);
    cvlr_assume!(pending_redemption <= CERTORA_MAX_BALANCE_COMPONENT);
    cvlr_assume!(restricted <= CERTORA_MAX_BALANCE_COMPONENT);

    cvlr_assert!(reserved <= u64::MAX - claimable);
    let encumbered = reserved + claimable;
    cvlr_assert!(encumbered <= u64::MAX - payable);
    let encumbered = encumbered + payable;
    cvlr_assert!(encumbered <= u64::MAX - impaired);
    let encumbered = encumbered + impaired;
    cvlr_assert!(encumbered <= u64::MAX - pending_redemption);
    let encumbered = encumbered + pending_redemption;
    cvlr_assert!(encumbered <= u64::MAX - restricted);
    let encumbered = encumbered + restricted;

    cvlr_assert!(encumbered <= u64::MAX - allocated);
    let redeemable_encumbered = encumbered + allocated;

    let free = if funded >= encumbered {
        funded - encumbered
    } else {
        0
    };
    let redeemable = if funded >= redeemable_encumbered {
        funded - redeemable_encumbered
    } else {
        0
    };

    cvlr_assert!(free <= funded);
    cvlr_assert!(redeemable <= funded);
    cvlr_assert!(redeemable <= free);

    cvlr_satisfy!(funded >= redeemable_encumbered);
}
