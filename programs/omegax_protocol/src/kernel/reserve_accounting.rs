// SPDX-License-Identifier: AGPL-3.0-or-later

//! Reserve balance-sheet mutation and claim-obligation synchronization helpers.

use crate::platform::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

pub(crate) fn checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn recompute_sheet(sheet: &mut ReserveBalanceSheet) -> Result<()> {
    let encumbered = sheet
        .reserved
        .checked_add(sheet.claimable)
        .and_then(|value| value.checked_add(sheet.payable))
        .and_then(|value| value.checked_add(sheet.impaired))
        .and_then(|value| value.checked_add(sheet.pending_redemption))
        .and_then(|value| value.checked_add(sheet.restricted))
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.free = sheet.funded.saturating_sub(encumbered);
    let redeemable_encumbered = encumbered
        .checked_add(sheet.allocated)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.redeemable = sheet.funded.saturating_sub(redeemable_encumbered);
    Ok(())
}

pub(crate) fn book_inflow(target: &mut u64, amount: u64) -> Result<()> {
    *target = checked_add(*target, amount)?;
    Ok(())
}

pub(crate) fn book_inflow_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.funded = checked_add(sheet.funded, amount)?;
    recompute_sheet(sheet)
}

#[cfg(test)]
pub(crate) fn book_restricted_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    require!(
        sheet.free >= amount,
        OmegaXProtocolError::InsufficientStableCoverageCapacity
    );
    sheet.restricted = checked_add(sheet.restricted, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_owed(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.owed = checked_add(sheet.owed, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn require_free_reserve_capacity(
    sheet: &ReserveBalanceSheet,
    amount: u64,
) -> Result<()> {
    require!(
        sheet.free >= amount,
        OmegaXProtocolError::InsufficientFreeReserveCapacity
    );
    Ok(())
}

pub(crate) fn require_obligation_reserve_capacity(
    line_sheet: &ReserveBalanceSheet,
    amount: u64,
) -> Result<()> {
    require_free_reserve_capacity(line_sheet, amount)
}

pub(crate) fn remaining_claim_amount(claim_case: &ClaimCaseAccountData<'_>) -> u64 {
    claim_case
        .approved_amount
        .saturating_sub(claim_case.paid_amount)
}

pub(crate) fn require_direct_claim_case_settlement(
    claim_case: &ClaimCaseAccountData<'_>,
) -> Result<()> {
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY,
        OmegaXProtocolError::LinkedClaimMustSettleThroughObligation
    );
    Ok(())
}

pub(crate) fn claim_proof_hash_is_zero(hash: &[u8; 32]) -> bool {
    hash.iter().all(|byte| *byte == 0)
}

pub(crate) fn require_claim_proof_fingerprints(
    evidence_ref_hash: &[u8; 32],
    decision_support_hash: &[u8; 32],
) -> Result<()> {
    require!(
        !claim_proof_hash_is_zero(evidence_ref_hash)
            && !claim_proof_hash_is_zero(decision_support_hash),
        OmegaXProtocolError::ClaimProofFingerprintRequired
    );
    Ok(())
}

pub(crate) fn resolve_claim_proof_fingerprints(
    claim_case: &ClaimCaseAccountData<'_>,
    evidence_ref_hash: [u8; 32],
    decision_support_hash: [u8; 32],
    requires_final_proof: bool,
    proof_locked: bool,
) -> Result<([u8; 32], [u8; 32])> {
    if proof_locked {
        require!(
            claim_proof_hash_is_zero(&evidence_ref_hash)
                || claim_proof_hash_is_zero(&claim_case.evidence_ref_hash)
                || evidence_ref_hash == claim_case.evidence_ref_hash,
            OmegaXProtocolError::ClaimProofFingerprintLocked
        );
        require!(
            claim_proof_hash_is_zero(&decision_support_hash)
                || claim_proof_hash_is_zero(&claim_case.decision_support_hash)
                || decision_support_hash == claim_case.decision_support_hash,
            OmegaXProtocolError::ClaimProofFingerprintLocked
        );
    }

    let final_evidence_ref_hash = if claim_proof_hash_is_zero(&evidence_ref_hash) {
        claim_case.evidence_ref_hash
    } else {
        evidence_ref_hash
    };
    let final_decision_support_hash = if claim_proof_hash_is_zero(&decision_support_hash) {
        claim_case.decision_support_hash
    } else {
        decision_support_hash
    };

    if requires_final_proof {
        require_claim_proof_fingerprints(&final_evidence_ref_hash, &final_decision_support_hash)?;
    }

    Ok((final_evidence_ref_hash, final_decision_support_hash))
}

pub(crate) fn require_matching_linked_claim_case(
    claim_case: &ClaimCaseAccountData<'_>,
    claim_case_key: Pubkey,
    obligation: &ObligationAccountData<'_>,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
) -> Result<()> {
    require!(
        claim_case.health_plan == health_plan_key && obligation.health_plan == health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        claim_case.policy_series == obligation.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        claim_case.funding_line == obligation.funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require!(
        claim_case.asset_mint == obligation.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        obligation.claim_case == ZERO_PUBKEY || obligation.claim_case == claim_case_key,
        OmegaXProtocolError::ClaimCaseLinkMismatch
    );
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY
            || claim_case.linked_obligation == obligation_key,
        OmegaXProtocolError::ClaimCaseLinkMismatch
    );
    Ok(())
}

pub(crate) fn establish_or_validate_claim_obligation_link(
    claim_case: &mut ClaimCaseAccountData<'_>,
    claim_case_key: Pubkey,
    obligation: &mut ObligationAccountData<'_>,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    claim_case.linked_obligation = obligation_key;
    obligation.claim_case = claim_case_key;
    claim_case.reserved_amount = obligation.reserved_amount;
    Ok(())
}

pub(crate) fn sync_adjudicated_claim_liability(
    claim_case: &mut ClaimCaseAccountData<'_>,
    claim_case_key: Pubkey,
    obligation: Option<(&mut ObligationAccountData<'_>, Pubkey)>,
    health_plan_key: Pubkey,
    approved_amount: u64,
    reserve_amount: u64,
) -> Result<()> {
    if let Some((obligation, obligation_key)) = obligation {
        establish_or_validate_claim_obligation_link(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            health_plan_key,
        )?;
        require!(
            obligation.reserved_amount <= approved_amount,
            OmegaXProtocolError::AmountExceedsApprovedClaim
        );
        claim_case.reserved_amount = obligation.reserved_amount;
    } else {
        require!(
            claim_case.linked_obligation == ZERO_PUBKEY,
            OmegaXProtocolError::ClaimCaseLinkMismatch
        );
        require!(
            reserve_amount == 0,
            OmegaXProtocolError::DirectClaimReserveUnsupported
        );
        claim_case.reserved_amount = 0;
    }
    Ok(())
}

pub(crate) fn require_claim_adjudication_mutable(
    claim_case: &ClaimCaseAccountData<'_>,
    obligation: Option<&ObligationAccountData<'_>>,
) -> Result<()> {
    require!(
        claim_case.paid_amount == 0 && claim_case.intake_status < CLAIM_INTAKE_SETTLED,
        OmegaXProtocolError::ClaimAdjudicationLocked
    );
    if let Some(obligation) = obligation {
        require!(
            obligation.status < OBLIGATION_STATUS_SETTLED && obligation.settled_amount == 0,
            OmegaXProtocolError::ClaimAdjudicationLocked
        );
    }
    Ok(())
}

pub(crate) fn require_supported_obligation_delivery_mode(delivery_mode: u8) -> Result<()> {
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE | OBLIGATION_DELIVERY_MODE_PAYABLE => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidObligationDeliveryMode),
    }
}

pub(crate) fn require_full_obligation_transition_amount(
    next_status: u8,
    amount: u64,
    obligation: &ObligationAccountData<'_>,
) -> Result<()> {
    match next_status {
        OBLIGATION_STATUS_CLAIMABLE_PAYABLE
        | OBLIGATION_STATUS_SETTLED
        | OBLIGATION_STATUS_CANCELED => {
            require!(
                amount == obligation.outstanding_amount,
                OmegaXProtocolError::PartialObligationTransitionUnsupported
            );
            Ok(())
        }
        _ => Ok(()),
    }
}

pub(crate) fn sync_linked_claim_case_reserve(
    claim_case: &mut ClaimCaseAccountData<'_>,
    claim_case_key: Pubkey,
    obligation: &mut ObligationAccountData<'_>,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
    now_ts: i64,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    obligation.claim_case = claim_case_key;
    claim_case.linked_obligation = obligation_key;
    claim_case.reserved_amount = obligation.reserved_amount;
    if obligation.status == OBLIGATION_STATUS_CANCELED && obligation.outstanding_amount == 0 {
        claim_case.intake_status = CLAIM_INTAKE_CLOSED;
        claim_case.closed_at = now_ts;
    }
    claim_case.updated_at = now_ts;
    Ok(())
}

pub(crate) fn sync_linked_claim_case_after_settlement(
    claim_case: &mut ClaimCaseAccountData<'_>,
    claim_case_key: Pubkey,
    obligation: &mut ObligationAccountData<'_>,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
    amount: u64,
    now_ts: i64,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    require!(
        amount <= remaining_claim_amount(claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );

    obligation.claim_case = claim_case_key;
    claim_case.linked_obligation = obligation_key;
    claim_case.paid_amount = checked_add(claim_case.paid_amount, amount)?;
    claim_case.reserved_amount = obligation.reserved_amount;
    claim_case.intake_status = if claim_case.paid_amount >= claim_case.approved_amount
        || obligation.outstanding_amount == 0
    {
        CLAIM_INTAKE_SETTLED
    } else {
        CLAIM_INTAKE_APPROVED
    };
    claim_case.closed_at = if claim_case.intake_status == CLAIM_INTAKE_SETTLED {
        now_ts
    } else {
        0
    };
    claim_case.updated_at = now_ts;
    Ok(())
}

pub(crate) fn book_reserve(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = checked_add(sheet.reserved, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn release_reserved_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = checked_sub(sheet.reserved, amount)?;
    sheet.owed = sheet.owed.saturating_sub(amount);
    recompute_sheet(sheet)
}

pub(crate) fn release_to_claimable_or_payable(
    sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    sheet.reserved = checked_sub(sheet.reserved, amount)?;
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE => {
            sheet.claimable = checked_add(sheet.claimable, amount)?;
        }
        OBLIGATION_DELIVERY_MODE_PAYABLE => {
            sheet.payable = checked_add(sheet.payable, amount)?;
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }
    recompute_sheet(sheet)
}

pub(crate) fn settle_from_sheet(
    sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE => {
            if sheet.claimable >= amount {
                sheet.claimable = checked_sub(sheet.claimable, amount)?;
            } else if sheet.reserved >= amount {
                sheet.reserved = checked_sub(sheet.reserved, amount)?;
            } else {
                return err!(OmegaXProtocolError::AmountExceedsReservedBalance);
            }
        }
        OBLIGATION_DELIVERY_MODE_PAYABLE => {
            if sheet.payable >= amount {
                sheet.payable = checked_sub(sheet.payable, amount)?;
            } else if sheet.reserved >= amount {
                sheet.reserved = checked_sub(sheet.reserved, amount)?;
            } else {
                return err!(OmegaXProtocolError::AmountExceedsReservedBalance);
            }
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }
    sheet.funded = checked_sub(sheet.funded, amount)?;
    sheet.owed = sheet.owed.saturating_sub(amount);
    sheet.settled = checked_add(sheet.settled, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn release_reserved_scoped(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    amount: u64,
) -> Result<()> {
    release_reserved_sheet(domain_sheet, amount)?;
    release_reserved_sheet(plan_sheet, amount)?;
    release_reserved_sheet(line_sheet, amount)?;
    Ok(())
}

pub(crate) fn release_reserved_to_delivery(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    release_to_claimable_or_payable(domain_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(plan_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(line_sheet, delivery_mode, amount)?;
    Ok(())
}

pub(crate) fn settle_delivery(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    funding_line: &mut FundingLineAccountData<'_>,
    amount: u64,
    obligation: &mut ObligationAccountData<'_>,
) -> Result<()> {
    settle_from_sheet(domain_sheet, obligation.delivery_mode, amount)?;
    settle_from_sheet(plan_sheet, obligation.delivery_mode, amount)?;
    settle_from_sheet(line_sheet, obligation.delivery_mode, amount)?;
    *domain_assets = checked_sub(*domain_assets, amount)?;
    funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
    funding_line.spent_amount = checked_add(funding_line.spent_amount, amount)?;
    obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
    obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
    obligation.payable_amount = obligation.payable_amount.saturating_sub(amount);
    obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
    obligation.settled_amount = checked_add(obligation.settled_amount, amount)?;
    Ok(())
}

pub(crate) fn cancel_outstanding(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    funding_line: &mut FundingLineAccountData<'_>,
    amount: u64,
    obligation: &mut ObligationAccountData<'_>,
) -> Result<()> {
    if obligation.reserved_amount >= amount {
        release_reserved_sheet(domain_sheet, amount)?;
        release_reserved_sheet(plan_sheet, amount)?;
        release_reserved_sheet(line_sheet, amount)?;
        funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
        funding_line.released_amount = checked_add(funding_line.released_amount, amount)?;
        obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
    } else if obligation.claimable_amount >= amount || obligation.payable_amount >= amount {
        if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
            domain_sheet.claimable = domain_sheet.claimable.saturating_sub(amount);
            plan_sheet.claimable = plan_sheet.claimable.saturating_sub(amount);
            line_sheet.claimable = line_sheet.claimable.saturating_sub(amount);
            obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
        } else {
            domain_sheet.payable = domain_sheet.payable.saturating_sub(amount);
            plan_sheet.payable = plan_sheet.payable.saturating_sub(amount);
            line_sheet.payable = line_sheet.payable.saturating_sub(amount);
            obligation.payable_amount = obligation.payable_amount.saturating_sub(amount);
        }
        domain_sheet.owed = domain_sheet.owed.saturating_sub(amount);
        plan_sheet.owed = plan_sheet.owed.saturating_sub(amount);
        line_sheet.owed = line_sheet.owed.saturating_sub(amount);
        recompute_sheet(domain_sheet)?;
        recompute_sheet(plan_sheet)?;
        recompute_sheet(line_sheet)?;
    } else {
        return err!(OmegaXProtocolError::InvalidObligationStateTransition);
    }
    obligation.outstanding_amount = obligation.outstanding_amount.saturating_sub(amount);
    Ok(())
}

pub(crate) fn book_direct_claim_payout(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    funding_line: &mut FundingLineAccountData<'_>,
    amount: u64,
) -> Result<()> {
    require_free_reserve_capacity(domain_sheet, amount)?;
    require_free_reserve_capacity(plan_sheet, amount)?;
    require_free_reserve_capacity(line_sheet, amount)?;

    domain_sheet.funded = checked_sub(domain_sheet.funded, amount)?;
    domain_sheet.settled = checked_add(domain_sheet.settled, amount)?;
    recompute_sheet(domain_sheet)?;

    plan_sheet.funded = checked_sub(plan_sheet.funded, amount)?;
    plan_sheet.settled = checked_add(plan_sheet.settled, amount)?;
    recompute_sheet(plan_sheet)?;

    line_sheet.funded = checked_sub(line_sheet.funded, amount)?;
    line_sheet.settled = checked_add(line_sheet.settled, amount)?;
    recompute_sheet(line_sheet)?;

    *domain_assets = checked_sub(*domain_assets, amount)?;
    funding_line.spent_amount = checked_add(funding_line.spent_amount, amount)?;
    Ok(())
}
