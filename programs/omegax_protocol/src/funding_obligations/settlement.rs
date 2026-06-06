// SPDX-License-Identifier: AGPL-3.0-or-later

//! Obligation settlement instruction handlers and account validation contexts.

use super::*;
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
pub(crate) fn settle_obligation(
    ctx: Context<SettleObligation>,
    args: SettleObligationArgs,
) -> Result<()> {
    let amount = args.amount;
    require_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_settlement_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        amount <= obligation.outstanding_amount,
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    require_full_obligation_transition_amount(args.next_status, amount, obligation)?;
    validate_treasury_mutation_bindings(
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    let obligation_is_linked = obligation_has_linked_claim_case(obligation);

    if obligation_is_linked {
        require!(
            ctx.accounts.claim_case.is_some(),
            OmegaXProtocolError::SettlementOutflowAccountsRequired
        );
    }

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref() {
        require_matching_linked_claim_case(
            claim_case,
            claim_case.key(),
            obligation,
            obligation.key(),
            ctx.accounts.health_plan.key(),
        )?;
        if args.next_status == OBLIGATION_STATUS_SETTLED {
            require!(
                amount <= remaining_claim_amount(claim_case),
                OmegaXProtocolError::AmountExceedsApprovedClaim
            );
            require_claim_proof_fingerprints(
                &claim_case.evidence_ref_hash,
                &claim_case.decision_support_hash,
            )?;
            require!(
                ctx.accounts.asset_mint.is_some()
                    && ctx.accounts.vault_token_account.is_some()
                    && ctx.accounts.recipient_token_account.is_some()
                    && ctx.accounts.token_program.is_some(),
                OmegaXProtocolError::SettlementOutflowAccountsRequired
            );
        }
    } else if args.next_status == OBLIGATION_STATUS_SETTLED {
        require!(
            ctx.accounts.asset_mint.is_some()
                && ctx.accounts.vault_token_account.is_some()
                && ctx.accounts.recipient_token_account.is_some()
                && ctx.accounts.token_program.is_some(),
            OmegaXProtocolError::SettlementOutflowAccountsRequired
        );
    }

    match args.next_status {
        OBLIGATION_STATUS_CLAIMABLE_PAYABLE => {
            require!(
                obligation.status == OBLIGATION_STATUS_RESERVED,
                OmegaXProtocolError::InvalidObligationStateTransition
            );
            require!(
                amount <= obligation.reserved_amount,
                OmegaXProtocolError::AmountExceedsReservedBalance
            );
            release_reserved_to_delivery(
                &mut ctx.accounts.domain_asset_ledger.sheet,
                &mut ctx.accounts.plan_reserve_ledger.sheet,
                &mut ctx.accounts.funding_line_ledger.sheet,
                obligation.delivery_mode,
                amount,
            )?;
            obligation.status = OBLIGATION_STATUS_CLAIMABLE_PAYABLE;
            obligation.claimable_amount =
                if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
                    amount
                } else {
                    0
                };
            obligation.payable_amount =
                if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_PAYABLE {
                    amount
                } else {
                    0
                };
            obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
        }
        OBLIGATION_STATUS_SETTLED => {
            require!(
                obligation.status == OBLIGATION_STATUS_CLAIMABLE_PAYABLE
                    || obligation.status == OBLIGATION_STATUS_RESERVED,
                OmegaXProtocolError::InvalidObligationStateTransition
            );
            settle_delivery(
                &mut ctx.accounts.domain_asset_vault.total_assets,
                &mut ctx.accounts.domain_asset_ledger.sheet,
                &mut ctx.accounts.plan_reserve_ledger.sheet,
                &mut ctx.accounts.funding_line_ledger.sheet,
                &mut ctx.accounts.funding_line,
                amount,
                obligation,
            )?;
            obligation.status = OBLIGATION_STATUS_SETTLED;

            // Any asset-backed settlement must include SPL outflow accounts.
            // Linked claims pay the member/delegate recipient; unlinked
            // obligations can only pay a token account owned by the settling
            // authority, avoiding an accounting-only "settled" state.
            let (Some(mint), Some(vault_ta), Some(recipient_ta), Some(token_prog)) = (
                ctx.accounts.asset_mint.as_ref(),
                ctx.accounts.vault_token_account.as_ref(),
                ctx.accounts.recipient_token_account.as_ref(),
                ctx.accounts.token_program.as_ref(),
            ) else {
                return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
            };
            if let Some(claim_case_ref) = ctx.accounts.claim_case.as_deref() {
                let resolved_recipient = resolve_claim_settlement_recipient(claim_case_ref);
                require_keys_eq!(
                    recipient_ta.owner,
                    resolved_recipient,
                    OmegaXProtocolError::Unauthorized
                );
            } else if obligation_is_linked {
                return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
            } else {
                require_keys_eq!(
                    recipient_ta.owner,
                    ctx.accounts.authority.key(),
                    OmegaXProtocolError::Unauthorized
                );
            }
            transfer_from_domain_vault(
                amount,
                &ctx.accounts.domain_asset_vault,
                vault_ta,
                recipient_ta,
                mint,
                token_prog,
            )?;
        }
        OBLIGATION_STATUS_CANCELED => {
            cancel_outstanding(
                &mut ctx.accounts.domain_asset_ledger.sheet,
                &mut ctx.accounts.plan_reserve_ledger.sheet,
                &mut ctx.accounts.funding_line_ledger.sheet,
                &mut ctx.accounts.funding_line,
                amount,
                obligation,
            )?;
            obligation.status = OBLIGATION_STATUS_CANCELED;
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }

    obligation.settlement_reason_hash = args.settlement_reason_hash;
    obligation.updated_at = now_ts;

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        match args.next_status {
            OBLIGATION_STATUS_SETTLED => {
                let claim_case_key = claim_case.key();
                sync_linked_claim_case_after_settlement(
                    claim_case,
                    claim_case_key,
                    obligation,
                    obligation_key,
                    ctx.accounts.health_plan.key(),
                    amount,
                    now_ts,
                )?
            }
            OBLIGATION_STATUS_CLAIMABLE_PAYABLE | OBLIGATION_STATUS_CANCELED => {
                let claim_case_key = claim_case.key();
                sync_linked_claim_case_reserve(
                    claim_case,
                    claim_case_key,
                    obligation,
                    obligation_key,
                    ctx.accounts.health_plan.key(),
                    now_ts,
                )?
            }
            _ => {}
        }
    } else if obligation_is_linked
        && matches!(
            args.next_status,
            OBLIGATION_STATUS_SETTLED
                | OBLIGATION_STATUS_CLAIMABLE_PAYABLE
                | OBLIGATION_STATUS_CANCELED
        )
    {
        return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
fn recompute_sheet(sheet: &mut ReserveBalanceSheet) -> Result<()> {
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

#[cfg(feature = "quasar")]
fn release_reserved_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = checked_sub(sheet.reserved, amount)?;
    sheet.owed = sheet.owed.saturating_sub(amount);
    recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
fn release_to_claimable_or_payable(
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

#[cfg(feature = "quasar")]
fn settle_from_sheet(
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

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
fn require_quasar_obligation_settlement_control(
    authority: &Pubkey,
    plan: &HealthPlanAccountData<'_>,
    obligation: &ObligationAccountData<'_>,
) -> Result<()> {
    if obligation.claim_case != ZERO_PUBKEY {
        if *authority == plan.claims_operator || *authority == plan.plan_admin {
            return Ok(());
        }
    } else if *authority == plan.plan_admin || *authority == plan.sponsor_operator {
        return Ok(());
    }

    err!(OmegaXProtocolError::Unauthorized)
}

#[cfg(feature = "quasar")]
fn require_quasar_full_obligation_transition_amount(
    next_status: u8,
    amount: u64,
    obligation: &ObligationAccountData<'_>,
) -> Result<()> {
    match next_status {
        OBLIGATION_STATUS_CLAIMABLE_PAYABLE
        | OBLIGATION_STATUS_SETTLED
        | OBLIGATION_STATUS_CANCELED => {
            require!(
                amount == obligation.outstanding_amount.get(),
                OmegaXProtocolError::PartialObligationTransitionUnsupported
            );
            Ok(())
        }
        _ => Ok(()),
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_remaining_claim_amount(claim_case: &ClaimCaseAccountData<'_>) -> u64 {
    claim_case
        .approved_amount
        .get()
        .saturating_sub(claim_case.paid_amount.get())
}

#[cfg(feature = "quasar")]
fn require_quasar_matching_linked_claim_case(
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

#[cfg(feature = "quasar")]
fn validate_quasar_treasury_mutation_bindings(
    obligation: &ObligationAccountData<'_>,
    funding_line_key: Pubkey,
    funding_line_asset_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        obligation.funding_line,
        funding_line_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        obligation.asset_mint,
        funding_line_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn quasar_cancel_delivery_bucket(
    sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE => {
            sheet.claimable = sheet.claimable.saturating_sub(amount);
        }
        OBLIGATION_DELIVERY_MODE_PAYABLE => {
            sheet.payable = sheet.payable.saturating_sub(amount);
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }
    recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
pub(crate) fn settle_obligation<'info>(
    ctx: &mut Ctx<'info, SettleObligation<'info>>,
    next_status: u8,
    amount: u64,
    settlement_reason_hash: [u8; 32],
) -> Result<()> {
    require_quasar_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp.get();
    let authority = *ctx.accounts.authority.address();
    let obligation_key = *ctx.accounts.obligation.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
    require_quasar_obligation_settlement_control(
        &authority,
        &ctx.accounts.health_plan,
        &ctx.accounts.obligation,
    )?;
    require!(
        amount <= ctx.accounts.obligation.outstanding_amount.get(),
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    require_quasar_full_obligation_transition_amount(
        next_status,
        amount,
        &ctx.accounts.obligation,
    )?;

    validate_quasar_treasury_mutation_bindings(
        &ctx.accounts.obligation,
        *ctx.accounts.funding_line.address(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    let obligation_is_linked = ctx.accounts.obligation.claim_case != ZERO_PUBKEY;

    if obligation_is_linked {
        require!(
            ctx.accounts.claim_case.is_some(),
            OmegaXProtocolError::SettlementOutflowAccountsRequired
        );
    }

    if let Some(claim_case) = ctx.accounts.claim_case.as_ref() {
        let claim_case_key = *claim_case.address();
        require_quasar_matching_linked_claim_case(
            claim_case,
            claim_case_key,
            &ctx.accounts.obligation,
            obligation_key,
            health_plan_key,
        )?;
        if next_status == OBLIGATION_STATUS_SETTLED {
            require!(
                amount <= quasar_remaining_claim_amount(claim_case),
                OmegaXProtocolError::AmountExceedsApprovedClaim
            );
            require!(
                !claim_case.evidence_ref_hash.iter().all(|byte| *byte == 0)
                    && !claim_case
                        .decision_support_hash
                        .iter()
                        .all(|byte| *byte == 0),
                OmegaXProtocolError::ClaimProofFingerprintRequired
            );
            require!(
                ctx.accounts.asset_mint.is_some()
                    && ctx.accounts.vault_token_account.is_some()
                    && ctx.accounts.recipient_token_account.is_some()
                    && ctx.accounts.token_program.is_some(),
                OmegaXProtocolError::SettlementOutflowAccountsRequired
            );
        }
    } else if next_status == OBLIGATION_STATUS_SETTLED {
        require!(
            ctx.accounts.asset_mint.is_some()
                && ctx.accounts.vault_token_account.is_some()
                && ctx.accounts.recipient_token_account.is_some()
                && ctx.accounts.token_program.is_some(),
            OmegaXProtocolError::SettlementOutflowAccountsRequired
        );
    }

    let delivery_mode = ctx.accounts.obligation.delivery_mode;
    let mut domain_total_assets = ctx.accounts.domain_asset_vault.total_assets.get();
    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.funding_line_ledger.sheet;
    let mut funding_reserved_amount = ctx.accounts.funding_line.reserved_amount.get();
    let mut funding_spent_amount = ctx.accounts.funding_line.spent_amount.get();
    let mut funding_released_amount = ctx.accounts.funding_line.released_amount.get();

    let obligation_status: u8;
    let mut obligation_claim_case = ctx.accounts.obligation.claim_case;
    let mut obligation_outstanding_amount = ctx.accounts.obligation.outstanding_amount.get();
    let mut obligation_reserved_amount = ctx.accounts.obligation.reserved_amount.get();
    let mut obligation_claimable_amount = ctx.accounts.obligation.claimable_amount.get();
    let mut obligation_payable_amount = ctx.accounts.obligation.payable_amount.get();
    let mut obligation_settled_amount = ctx.accounts.obligation.settled_amount.get();

    match next_status {
        OBLIGATION_STATUS_CLAIMABLE_PAYABLE => {
            require!(
                ctx.accounts.obligation.status == OBLIGATION_STATUS_RESERVED,
                OmegaXProtocolError::InvalidObligationStateTransition
            );
            require!(
                amount <= obligation_reserved_amount,
                OmegaXProtocolError::AmountExceedsReservedBalance
            );
            release_to_claimable_or_payable(&mut domain_sheet, delivery_mode, amount)?;
            release_to_claimable_or_payable(&mut plan_sheet, delivery_mode, amount)?;
            release_to_claimable_or_payable(&mut funding_line_sheet, delivery_mode, amount)?;
            obligation_status = OBLIGATION_STATUS_CLAIMABLE_PAYABLE;
            obligation_claimable_amount = if delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
                amount
            } else {
                0
            };
            obligation_payable_amount = if delivery_mode == OBLIGATION_DELIVERY_MODE_PAYABLE {
                amount
            } else {
                0
            };
            obligation_reserved_amount = obligation_reserved_amount.saturating_sub(amount);
        }
        OBLIGATION_STATUS_SETTLED => {
            require!(
                ctx.accounts.obligation.status == OBLIGATION_STATUS_CLAIMABLE_PAYABLE
                    || ctx.accounts.obligation.status == OBLIGATION_STATUS_RESERVED,
                OmegaXProtocolError::InvalidObligationStateTransition
            );
            settle_from_sheet(&mut domain_sheet, delivery_mode, amount)?;
            settle_from_sheet(&mut plan_sheet, delivery_mode, amount)?;
            settle_from_sheet(&mut funding_line_sheet, delivery_mode, amount)?;
            domain_total_assets = checked_sub(domain_total_assets, amount)?;
            funding_reserved_amount = funding_reserved_amount.saturating_sub(amount);
            funding_spent_amount = checked_add(funding_spent_amount, amount)?;
            obligation_outstanding_amount = checked_sub(obligation_outstanding_amount, amount)?;
            obligation_claimable_amount = obligation_claimable_amount.saturating_sub(amount);
            obligation_payable_amount = obligation_payable_amount.saturating_sub(amount);
            obligation_reserved_amount = obligation_reserved_amount.saturating_sub(amount);
            obligation_settled_amount = checked_add(obligation_settled_amount, amount)?;
            obligation_status = OBLIGATION_STATUS_SETTLED;

            let (Some(mint), Some(vault_ta), Some(recipient_ta), Some(token_prog)) = (
                ctx.accounts.asset_mint.as_ref(),
                ctx.accounts.vault_token_account.as_ref(),
                ctx.accounts.recipient_token_account.as_ref(),
                ctx.accounts.token_program.as_ref(),
            ) else {
                return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
            };
            if let Some(claim_case_ref) = ctx.accounts.claim_case.as_ref() {
                let resolved_recipient = if claim_case_ref.delegate_recipient != ZERO_PUBKEY {
                    claim_case_ref.delegate_recipient
                } else {
                    claim_case_ref.claimant
                };
                require_keys_eq!(
                    *recipient_ta.owner(),
                    resolved_recipient,
                    OmegaXProtocolError::Unauthorized
                );
            } else if obligation_is_linked {
                return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
            } else {
                require_keys_eq!(
                    *recipient_ta.owner(),
                    authority,
                    OmegaXProtocolError::Unauthorized
                );
            }
            transfer_from_domain_vault(
                amount,
                ctx.accounts.domain_asset_vault,
                vault_ta,
                recipient_ta,
                mint,
                token_prog,
            )?;
        }
        OBLIGATION_STATUS_CANCELED => {
            if obligation_reserved_amount >= amount {
                release_reserved_sheet(&mut domain_sheet, amount)?;
                release_reserved_sheet(&mut plan_sheet, amount)?;
                release_reserved_sheet(&mut funding_line_sheet, amount)?;
                funding_reserved_amount = funding_reserved_amount.saturating_sub(amount);
                funding_released_amount = checked_add(funding_released_amount, amount)?;
                obligation_reserved_amount = obligation_reserved_amount.saturating_sub(amount);
            } else if obligation_claimable_amount >= amount || obligation_payable_amount >= amount {
                quasar_cancel_delivery_bucket(&mut domain_sheet, delivery_mode, amount)?;
                quasar_cancel_delivery_bucket(&mut plan_sheet, delivery_mode, amount)?;
                quasar_cancel_delivery_bucket(&mut funding_line_sheet, delivery_mode, amount)?;
                if delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
                    obligation_claimable_amount =
                        obligation_claimable_amount.saturating_sub(amount);
                } else {
                    obligation_payable_amount = obligation_payable_amount.saturating_sub(amount);
                }
                domain_sheet.owed = domain_sheet.owed.saturating_sub(amount);
                plan_sheet.owed = plan_sheet.owed.saturating_sub(amount);
                funding_line_sheet.owed = funding_line_sheet.owed.saturating_sub(amount);
                recompute_sheet(&mut domain_sheet)?;
                recompute_sheet(&mut plan_sheet)?;
                recompute_sheet(&mut funding_line_sheet)?;
            } else {
                return err!(OmegaXProtocolError::InvalidObligationStateTransition);
            }
            obligation_outstanding_amount = obligation_outstanding_amount.saturating_sub(amount);
            obligation_status = OBLIGATION_STATUS_CANCELED;
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }

    if let Some(claim_case) = ctx.accounts.claim_case.as_mut() {
        let claim_case_key = *claim_case.address();
        require_quasar_matching_linked_claim_case(
            claim_case,
            claim_case_key,
            &ctx.accounts.obligation,
            obligation_key,
            health_plan_key,
        )?;
        obligation_claim_case = claim_case_key;

        let mut paid_amount = claim_case.paid_amount.get();
        let mut reserved_amount = claim_case.reserved_amount.get();
        let mut intake_status = claim_case.intake_status;
        let mut closed_at = claim_case.closed_at.get();
        if next_status == OBLIGATION_STATUS_SETTLED {
            require!(
                amount <= quasar_remaining_claim_amount(claim_case),
                OmegaXProtocolError::AmountExceedsApprovedClaim
            );
            paid_amount = checked_add(paid_amount, amount)?;
            reserved_amount = obligation_reserved_amount;
            intake_status = if paid_amount >= claim_case.approved_amount.get()
                || obligation_outstanding_amount == 0
            {
                CLAIM_INTAKE_SETTLED
            } else {
                CLAIM_INTAKE_APPROVED
            };
            closed_at = if intake_status == CLAIM_INTAKE_SETTLED {
                now_ts
            } else {
                0
            };
        } else if matches!(
            next_status,
            OBLIGATION_STATUS_CLAIMABLE_PAYABLE | OBLIGATION_STATUS_CANCELED
        ) {
            reserved_amount = obligation_reserved_amount;
            if obligation_status == OBLIGATION_STATUS_CANCELED && obligation_outstanding_amount == 0
            {
                intake_status = CLAIM_INTAKE_CLOSED;
                closed_at = now_ts;
            }
        }

        let reserve_domain = claim_case.reserve_domain;
        let health_plan = claim_case.health_plan;
        let policy_series = claim_case.policy_series;
        let funding_line = claim_case.funding_line;
        let asset_mint = claim_case.asset_mint;
        let claimant = claim_case.claimant;
        let adjudicator = claim_case.adjudicator;
        let delegate_recipient = claim_case.delegate_recipient;
        let evidence_ref_hash = claim_case.evidence_ref_hash;
        let decision_support_hash = claim_case.decision_support_hash;
        let review_state = claim_case.review_state;
        let approved_amount = claim_case.approved_amount.get();
        let denied_amount = claim_case.denied_amount.get();
        let recovered_amount = claim_case.recovered_amount.get();
        let appeal_count = claim_case.appeal_count.get();
        let opened_at = claim_case.opened_at.get();
        let bump = claim_case.bump;
        let claim_id = claim_case.claim_id().to_owned();
        claim_case.set_inner(
            reserve_domain,
            health_plan,
            policy_series,
            funding_line,
            asset_mint,
            claimant,
            adjudicator,
            delegate_recipient,
            evidence_ref_hash,
            decision_support_hash,
            intake_status,
            review_state,
            approved_amount,
            denied_amount,
            paid_amount,
            reserved_amount,
            recovered_amount,
            appeal_count,
            obligation_key,
            opened_at,
            now_ts,
            closed_at,
            bump,
            &claim_id,
            ctx.accounts.authority.to_account_view(),
            None,
        )?;
    } else if obligation_is_linked
        && matches!(
            next_status,
            OBLIGATION_STATUS_SETTLED
                | OBLIGATION_STATUS_CLAIMABLE_PAYABLE
                | OBLIGATION_STATUS_CANCELED
        )
    {
        return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
    }

    let domain_asset_vault = &mut ctx.accounts.domain_asset_vault;
    let reserve_domain = domain_asset_vault.reserve_domain;
    let asset_mint = domain_asset_vault.asset_mint;
    let vault_token_account = domain_asset_vault.vault_token_account;
    let bump = domain_asset_vault.bump;
    domain_asset_vault.set_inner(
        reserve_domain,
        asset_mint,
        vault_token_account,
        domain_total_assets,
        bump,
    );

    let domain_asset_ledger = &mut ctx.accounts.domain_asset_ledger;
    let reserve_domain = domain_asset_ledger.reserve_domain;
    let asset_mint = domain_asset_ledger.asset_mint;
    let bump = domain_asset_ledger.bump;
    domain_asset_ledger.set_inner(reserve_domain, asset_mint, domain_sheet, bump);

    let plan_reserve_ledger = &mut ctx.accounts.plan_reserve_ledger;
    let health_plan = plan_reserve_ledger.health_plan;
    let asset_mint = plan_reserve_ledger.asset_mint;
    let bump = plan_reserve_ledger.bump;
    plan_reserve_ledger.set_inner(health_plan, asset_mint, plan_sheet, bump);

    let funding_line_ledger = &mut ctx.accounts.funding_line_ledger;
    let funding_line_key = funding_line_ledger.funding_line;
    let asset_mint = funding_line_ledger.asset_mint;
    let bump = funding_line_ledger.bump;
    funding_line_ledger.set_inner(funding_line_key, asset_mint, funding_line_sheet, bump);

    let funding_line = &mut ctx.accounts.funding_line;
    let reserve_domain = funding_line.reserve_domain;
    let health_plan = funding_line.health_plan;
    let policy_series = funding_line.policy_series;
    let asset_mint = funding_line.asset_mint;
    let line_type = funding_line.line_type;
    let funding_priority = funding_line.funding_priority;
    let committed_amount = funding_line.committed_amount.get();
    let funded_amount = funding_line.funded_amount.get();
    let returned_amount = funding_line.returned_amount.get();
    let status = funding_line.status;
    let caps_hash = funding_line.caps_hash;
    let bump = funding_line.bump;
    let line_id = funding_line.line_id().to_owned();
    funding_line.set_inner(
        reserve_domain,
        health_plan,
        policy_series,
        asset_mint,
        line_type,
        funding_priority,
        committed_amount,
        funded_amount,
        funding_reserved_amount,
        funding_spent_amount,
        funding_released_amount,
        returned_amount,
        status,
        caps_hash,
        bump,
        &line_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let obligation = &mut ctx.accounts.obligation;
    let reserve_domain = obligation.reserve_domain;
    let asset_mint = obligation.asset_mint;
    let health_plan = obligation.health_plan;
    let policy_series = obligation.policy_series;
    let member_wallet = obligation.member_wallet;
    let beneficiary = obligation.beneficiary;
    let funding_line = obligation.funding_line;
    let creation_reason_hash = obligation.creation_reason_hash;
    let delivery_mode = obligation.delivery_mode;
    let principal_amount = obligation.principal_amount.get();
    let impaired_amount = obligation.impaired_amount.get();
    let recovered_amount = obligation.recovered_amount.get();
    let created_at = obligation.created_at.get();
    let bump = obligation.bump;
    let obligation_id = obligation.obligation_id().to_owned();
    obligation.set_inner(
        reserve_domain,
        asset_mint,
        health_plan,
        policy_series,
        member_wallet,
        beneficiary,
        funding_line,
        obligation_claim_case,
        creation_reason_hash,
        settlement_reason_hash,
        obligation_status,
        delivery_mode,
        principal_amount,
        obligation_outstanding_amount,
        obligation_reserved_amount,
        obligation_claimable_amount,
        obligation_payable_amount,
        obligation_settled_amount,
        impaired_amount,
        recovered_amount,
        created_at,
        now_ts,
        bump,
        &obligation_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct SettleObligation<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            health_plan.address(),
            &crate::ID,
            &[SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id().as_bytes()],
            health_plan.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch
    )]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()],
            domain_asset_vault.bump,
        ) @ OmegaXProtocolError::DomainAssetVaultRequired
    )]
    pub domain_asset_vault: &'info mut Account<DomainAssetVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()],
            domain_asset_ledger.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            funding_line.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE, health_plan.address().as_ref(), funding_line.line_id().as_bytes()],
            funding_line.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch
    )]
    pub funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            funding_line_ledger.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE_LEDGER, funding_line.address().as_ref(), funding_line.asset_mint.as_ref()],
            funding_line_ledger.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch
    )]
    pub funding_line_ledger: &'info mut Account<FundingLineLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            plan_reserve_ledger.address(),
            &crate::ID,
            &[SEED_PLAN_RESERVE_LEDGER, health_plan.address().as_ref(), obligation.asset_mint.as_ref()],
            plan_reserve_ledger.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch
    )]
    pub plan_reserve_ledger: &'info mut Account<PlanReserveLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            obligation.address(),
            &crate::ID,
            &[SEED_OBLIGATION, funding_line.address().as_ref(), obligation.obligation_id().as_bytes()],
            obligation.bump,
        ) @ OmegaXProtocolError::ObligationMismatch
    )]
    pub obligation: Account<ObligationAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            claim_case.address(),
            &crate::ID,
            &[SEED_CLAIM_CASE, health_plan.address().as_ref(), claim_case.claim_id().as_bytes()],
            claim_case.bump,
        ) @ OmegaXProtocolError::ClaimCaseLinkMismatch
    )]
    pub claim_case: Option<Account<ClaimCaseAccountData<'info>>>,
    // Optional for non-claim obligation transitions, but the SPL outflow
    // accounts are required when a linked claim is being marked SETTLED.
    #[cfg(not(feature = "quasar"))]
    pub asset_mint: Option<Account<'info, Mint>>,
    #[cfg(feature = "quasar")]
    pub asset_mint: Option<&'info InterfaceAccount<Mint>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,
    #[cfg(feature = "quasar")]
    pub vault_token_account: Option<&'info mut InterfaceAccount<TokenAccount>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: Option<Account<'info, TokenAccount>>,
    #[cfg(feature = "quasar")]
    pub recipient_token_account: Option<&'info mut InterfaceAccount<TokenAccount>>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Option<Program<'info, TokenInterface>>,
    #[cfg(feature = "quasar")]
    pub token_program: Option<&'info Interface<TokenInterface>>,
}
