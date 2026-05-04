// SPDX-License-Identifier: AGPL-3.0-or-later

//! Reserve balance-sheet mutation and claim-obligation synchronization helpers.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

use super::{checked_add, checked_sub};

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

pub(crate) fn book_restricted_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    require!(
        sheet.free >= amount,
        OmegaXProtocolError::InsufficientStableCoverageCapacity
    );
    sheet.restricted = checked_add(sheet.restricted, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_fee_accrual_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    sheet.funded = checked_sub(sheet.funded, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_fee_withdrawal(domain_assets: &mut u64, amount: u64) -> Result<()> {
    *domain_assets = checked_sub(*domain_assets, amount)?;
    Ok(())
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

pub(crate) fn require_allocatable_reserve_capacity(
    sheet: &ReserveBalanceSheet,
    amount: u64,
) -> Result<()> {
    require!(
        sheet.redeemable >= amount,
        OmegaXProtocolError::InsufficientFreeReserveCapacity
    );
    Ok(())
}

pub(crate) fn require_obligation_reserve_capacity(
    line_sheet: &ReserveBalanceSheet,
    allocation_position: Option<&AllocationPosition>,
    amount: u64,
) -> Result<()> {
    if let Some(position) = allocation_position {
        let free_allocated = position
            .allocated_amount
            .saturating_sub(position.reserved_capacity);
        require!(
            free_allocated >= amount,
            OmegaXProtocolError::InsufficientFreeAllocationCapacity
        );
        return Ok(());
    }

    require_free_reserve_capacity(line_sheet, amount)
}

pub(crate) fn remaining_claim_amount(claim_case: &ClaimCase) -> u64 {
    claim_case
        .approved_amount
        .saturating_sub(claim_case.paid_amount)
}

pub(crate) fn require_direct_claim_case_settlement(claim_case: &ClaimCase) -> Result<()> {
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY,
        OmegaXProtocolError::LinkedClaimMustSettleThroughObligation
    );
    Ok(())
}

pub(crate) fn require_matching_linked_claim_case(
    claim_case: &ClaimCase,
    claim_case_key: Pubkey,
    obligation: &Obligation,
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
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
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
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: Option<(&mut Obligation, Pubkey)>,
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
        claim_case.reserved_amount = reserve_amount;
    }
    Ok(())
}

pub(crate) fn sync_linked_claim_case_reserve(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
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
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
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

pub(crate) fn settle_from_allocation_sheet(
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
    sheet.owed = sheet.owed.saturating_sub(amount);
    sheet.settled = checked_add(sheet.settled, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_pending_redemption(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.pending_redemption = checked_add(sheet.pending_redemption, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn settle_pending_redemption(
    ledger: &mut PoolClassLedger,
    asset_amount: u64,
    shares: u64,
) -> Result<()> {
    ledger.sheet.pending_redemption = checked_sub(ledger.sheet.pending_redemption, asset_amount)?;
    ledger.sheet.funded = checked_sub(ledger.sheet.funded, asset_amount)?;
    ledger.sheet.settled = checked_add(ledger.sheet.settled, asset_amount)?;
    ledger.total_shares = checked_sub(ledger.total_shares, shares)?;
    recompute_sheet(&mut ledger.sheet)
}

pub(crate) fn settle_pending_redemption_domain(
    sheet: &mut ReserveBalanceSheet,
    asset_amount: u64,
) -> Result<()> {
    sheet.pending_redemption = checked_sub(sheet.pending_redemption, asset_amount)?;
    sheet.funded = checked_sub(sheet.funded, asset_amount)?;
    sheet.settled = checked_add(sheet.settled, asset_amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = checked_add(sheet.allocated, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn release_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = checked_sub(sheet.allocated, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_impairment(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.impaired = checked_add(sheet.impaired, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn release_reserved_scoped(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    amount: u64,
) -> Result<()> {
    release_reserved_sheet(domain_sheet, amount)?;
    release_reserved_sheet(plan_sheet, amount)?;
    release_reserved_sheet(line_sheet, amount)?;
    if let Some(series) = series_sheet {
        release_reserved_sheet(&mut series.sheet, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        release_reserved_sheet(&mut class_ledger.sheet, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = checked_sub(position.reserved_capacity, amount)?;
        position.utilized_amount = checked_sub(position.utilized_amount, amount)?;
    }
    if let Some(ledger) = allocation_sheet {
        release_reserved_sheet(&mut ledger.sheet, amount)?;
    }
    Ok(())
}

pub(crate) fn release_reserved_to_delivery(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    release_to_claimable_or_payable(domain_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(plan_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(line_sheet, delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        release_to_claimable_or_payable(&mut series.sheet, delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        release_to_claimable_or_payable(&mut class_ledger.sheet, delivery_mode, amount)?;
    }
    if let Some(allocation_ledger) = allocation_sheet {
        release_to_claimable_or_payable(&mut allocation_ledger.sheet, delivery_mode, amount)?;
    }
    Ok(())
}

pub(crate) fn settle_delivery(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
    obligation: &mut Obligation,
) -> Result<()> {
    let allocation_scoped = allocation_position.is_some() || allocation_sheet.is_some();
    settle_from_sheet(domain_sheet, obligation.delivery_mode, amount)?;
    if allocation_scoped {
        settle_from_allocation_sheet(plan_sheet, obligation.delivery_mode, amount)?;
        settle_from_allocation_sheet(line_sheet, obligation.delivery_mode, amount)?;
    } else {
        settle_from_sheet(plan_sheet, obligation.delivery_mode, amount)?;
        settle_from_sheet(line_sheet, obligation.delivery_mode, amount)?;
    }
    if let Some(series) = series_sheet {
        if allocation_scoped {
            settle_from_allocation_sheet(&mut series.sheet, obligation.delivery_mode, amount)?;
        } else {
            settle_from_sheet(&mut series.sheet, obligation.delivery_mode, amount)?;
        }
    }
    if let Some(class_ledger) = class_sheet {
        settle_from_sheet(&mut class_ledger.sheet, obligation.delivery_mode, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
    }
    if let Some(ledger) = allocation_sheet {
        settle_from_allocation_sheet(&mut ledger.sheet, obligation.delivery_mode, amount)?;
    }
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
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
    obligation: &mut Obligation,
) -> Result<()> {
    if obligation.reserved_amount >= amount {
        release_reserved_sheet(domain_sheet, amount)?;
        release_reserved_sheet(plan_sheet, amount)?;
        release_reserved_sheet(line_sheet, amount)?;
        if let Some(series) = series_sheet {
            release_reserved_sheet(&mut series.sheet, amount)?;
        }
        if let Some(class_ledger) = class_sheet {
            release_reserved_sheet(&mut class_ledger.sheet, amount)?;
        }
        if let Some(position) = allocation_position {
            position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
            position.utilized_amount = position.utilized_amount.saturating_sub(amount);
        }
        if let Some(ledger) = allocation_sheet {
            release_reserved_sheet(&mut ledger.sheet, amount)?;
        }
        funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
        funding_line.released_amount = checked_add(funding_line.released_amount, amount)?;
        obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
    } else if obligation.claimable_amount >= amount || obligation.payable_amount >= amount {
        if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
            domain_sheet.claimable = domain_sheet.claimable.saturating_sub(amount);
            plan_sheet.claimable = plan_sheet.claimable.saturating_sub(amount);
            line_sheet.claimable = line_sheet.claimable.saturating_sub(amount);
            if let Some(series) = series_sheet {
                series.sheet.claimable = series.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut series.sheet)?;
            }
            if let Some(class_ledger) = class_sheet {
                class_ledger.sheet.claimable = class_ledger.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut class_ledger.sheet)?;
            }
            if let Some(ledger) = allocation_sheet {
                ledger.sheet.claimable = ledger.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut ledger.sheet)?;
            }
            obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
        } else {
            domain_sheet.payable = domain_sheet.payable.saturating_sub(amount);
            plan_sheet.payable = plan_sheet.payable.saturating_sub(amount);
            line_sheet.payable = line_sheet.payable.saturating_sub(amount);
            if let Some(series) = series_sheet {
                series.sheet.payable = series.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut series.sheet)?;
            }
            if let Some(class_ledger) = class_sheet {
                class_ledger.sheet.payable = class_ledger.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut class_ledger.sheet)?;
            }
            if let Some(ledger) = allocation_sheet {
                ledger.sheet.payable = ledger.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut ledger.sheet)?;
            }
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

pub(crate) fn book_settlement_from_delivery(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
) -> Result<()> {
    let delivery_mode = if line_sheet.claimable >= amount {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE
    } else {
        OBLIGATION_DELIVERY_MODE_PAYABLE
    };
    settle_from_sheet(domain_sheet, delivery_mode, amount)?;
    settle_from_sheet(plan_sheet, delivery_mode, amount)?;
    settle_from_sheet(line_sheet, delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        settle_from_sheet(&mut series.sheet, delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        settle_from_sheet(&mut class_ledger.sheet, delivery_mode, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
    }
    if let Some(ledger) = allocation_sheet {
        settle_from_allocation_sheet(&mut ledger.sheet, delivery_mode, amount)?;
    }
    *domain_assets = checked_sub(*domain_assets, amount)?;
    funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
    funding_line.spent_amount = checked_add(funding_line.spent_amount, amount)?;
    Ok(())
}
