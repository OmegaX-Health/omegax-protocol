// SPDX-License-Identifier: AGPL-3.0-or-later

//! Obligation settlement instruction handlers and account validation contexts.

use super::*;
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
#[cfg(not(feature = "quasar"))]
pub(crate) fn settle_obligation(
    ctx: Context<SettleObligation>,
    args: SettleObligationArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let amount = args.amount;
    require_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_settlement_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
        obligation,
    )?;
    if args.next_status == OBLIGATION_STATUS_SETTLED {
        crate::reserve_waterfall::require_reserve_asset_rail_payout_enabled(
            &ctx.accounts.reserve_asset_rail,
        )?;
    }
    require!(
        amount <= obligation.outstanding_amount,
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    require_full_obligation_transition_amount(args.next_status, amount, obligation)?;
    validate_treasury_mutation_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    let oracle_fee = resolve_obligation_oracle_fee(
        ctx.accounts.health_plan.key(),
        obligation,
        ctx.accounts.claim_case.as_deref(),
        ctx.accounts.pool_oracle_fee_vault.as_deref(),
        ctx.accounts.pool_oracle_policy.as_deref(),
        ctx.accounts.oracle_fee_attestation.as_deref(),
        amount,
    )?;
    let net_to_recipient = checked_sub(amount, oracle_fee)?;
    require_positive_amount(net_to_recipient)?;
    let obligation_is_linked = obligation_has_linked_claim_case(obligation);

    if obligation_is_linked {
        require!(
            ctx.accounts.claim_case.is_some() && ctx.accounts.member_position.is_some(),
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
            require!(
                ctx.accounts.member_position.is_some()
                    && ctx.accounts.asset_mint.is_some()
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
                ctx.accounts.series_reserve_ledger.as_deref_mut(),
                ctx.accounts.pool_class_ledger.as_deref_mut(),
                ctx.accounts.allocation_ledger.as_deref_mut(),
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
                ctx.accounts.series_reserve_ledger.as_deref_mut(),
                ctx.accounts.pool_class_ledger.as_deref_mut(),
                ctx.accounts.allocation_position.as_deref_mut(),
                ctx.accounts.allocation_ledger.as_deref_mut(),
                &mut ctx.accounts.funding_line,
                amount,
                obligation,
            )?;
            if oracle_fee > 0 {
                ctx.accounts.domain_asset_vault.total_assets =
                    checked_add(ctx.accounts.domain_asset_vault.total_assets, oracle_fee)?;
            }
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
                let Some(member_pos) = ctx.accounts.member_position.as_ref() else {
                    return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
                };
                require_keys_eq!(
                    member_pos.key(),
                    claim_case_ref.member_position,
                    OmegaXProtocolError::Unauthorized
                );
                let resolved_recipient =
                    resolve_claim_settlement_recipient(claim_case_ref, member_pos);
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
                net_to_recipient,
                &ctx.accounts.domain_asset_vault,
                vault_ta,
                recipient_ta,
                mint,
                token_prog,
            )?;
            if oracle_fee > 0 {
                if let Some(vault) = ctx.accounts.pool_oracle_fee_vault.as_deref_mut() {
                    let key = vault.key();
                    let mint = vault.asset_mint;
                    let total = accrue_fee(&mut vault.accrued_fees, oracle_fee)?;
                    emit!(FeeAccruedEvent {
                        vault: key,
                        asset_mint: mint,
                        amount: oracle_fee,
                        accrued_total: total,
                    });
                }
            }
        }
        OBLIGATION_STATUS_CANCELED => {
            cancel_outstanding(
                &mut ctx.accounts.domain_asset_ledger.sheet,
                &mut ctx.accounts.plan_reserve_ledger.sheet,
                &mut ctx.accounts.funding_line_ledger.sheet,
                ctx.accounts.series_reserve_ledger.as_deref_mut(),
                ctx.accounts.pool_class_ledger.as_deref_mut(),
                ctx.accounts.allocation_position.as_deref_mut(),
                ctx.accounts.allocation_ledger.as_deref_mut(),
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
#[inline(always)]
fn quasar_checked_sub_i64(lhs: i64, rhs: i64) -> Result<i64> {
    lhs.checked_sub(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn checked_u128_to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
fn fee_share_from_bps(amount: u64, bps: u16) -> Result<u64> {
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
    require!(fee <= amount, OmegaXProtocolError::ArithmeticError);
    Ok(fee)
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
fn settle_from_allocation_sheet(
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

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_protocol_not_paused(governance: &ProtocolGovernance) -> Result<()> {
    require!(
        !governance.emergency_pause.get(),
        OmegaXProtocolError::ProtocolEmergencyPaused
    );
    Ok(())
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
    governance: &ProtocolGovernance,
    plan: &HealthPlanAccountData<'_>,
    obligation: &ObligationAccountData<'_>,
) -> Result<()> {
    if obligation.claim_case != ZERO_PUBKEY {
        if *authority == plan.claims_operator
            || *authority == plan.plan_admin
            || *authority == governance.governance_authority
        {
            return Ok(());
        }
    } else if *authority == plan.plan_admin
        || *authority == plan.sponsor_operator
        || *authority == governance.governance_authority
    {
        return Ok(());
    }

    err!(OmegaXProtocolError::Unauthorized)
}

#[cfg(feature = "quasar")]
fn require_quasar_reserve_asset_rail_payout_enabled(
    rail: &ReserveAssetRailAccountData<'_>,
    now_ts: i64,
) -> Result<()> {
    require!(
        rail.active.get(),
        OmegaXProtocolError::ReserveAssetRailInactive
    );
    require!(
        rail.payout_enabled.get(),
        OmegaXProtocolError::ReserveAssetRailPayoutDisabled
    );
    require!(
        rail.last_price_usd_1e8.get() > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        rail.max_staleness_seconds.get() > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        rail.max_confidence_bps.get() > 0,
        OmegaXProtocolError::ReserveAssetPriceInvalid
    );
    require!(
        rail.last_price_confidence_bps.get() <= rail.max_confidence_bps.get(),
        OmegaXProtocolError::ReserveAssetPriceConfidenceTooWide
    );
    require!(
        rail.last_price_published_at_ts.get() > 0
            && rail.last_price_published_at_ts.get() <= now_ts,
        OmegaXProtocolError::ReserveAssetPriceStale
    );
    let age = quasar_checked_sub_i64(now_ts, rail.last_price_published_at_ts.get())?;
    require!(
        age <= rail.max_staleness_seconds.get(),
        OmegaXProtocolError::ReserveAssetPriceStale
    );
    Ok(())
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
fn validate_quasar_optional_series_ledger(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    expected_policy_series: Pubkey,
    expected_asset_mint: Pubkey,
) -> Result<()> {
    if let Some(ledger) = series_ledger {
        require!(
            expected_policy_series != ZERO_PUBKEY,
            OmegaXProtocolError::PolicySeriesMissing
        );
        require_keys_eq!(
            ledger.policy_series,
            expected_policy_series,
            OmegaXProtocolError::PolicySeriesMismatch
        );
        require_keys_eq!(
            ledger.asset_mint,
            expected_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
        require!(
            quasar_pda_matches(
                ledger.address(),
                &crate::ID,
                &[
                    SEED_SERIES_RESERVE_LEDGER,
                    expected_policy_series.as_ref(),
                    expected_asset_mint.as_ref(),
                ],
                ledger.bump,
            ),
            OmegaXProtocolError::PolicySeriesMismatch
        );
    }
    Ok(())
}

#[cfg(feature = "quasar")]
fn validate_quasar_optional_pool_class_ledger(
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    expected_capital_class: Pubkey,
    expected_asset_mint: Pubkey,
) -> Result<()> {
    if let Some(ledger) = pool_class_ledger {
        require!(
            expected_capital_class != ZERO_PUBKEY,
            OmegaXProtocolError::CapitalClassMismatch
        );
        require_keys_eq!(
            ledger.capital_class,
            expected_capital_class,
            OmegaXProtocolError::CapitalClassMismatch
        );
        require_keys_eq!(
            ledger.asset_mint,
            expected_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
        require!(
            quasar_pda_matches(
                ledger.address(),
                &crate::ID,
                &[
                    SEED_POOL_CLASS_LEDGER,
                    expected_capital_class.as_ref(),
                    expected_asset_mint.as_ref(),
                ],
                ledger.bump,
            ),
            OmegaXProtocolError::CapitalClassMismatch
        );
    }
    Ok(())
}

#[cfg(feature = "quasar")]
fn validate_quasar_optional_allocation_position(
    allocation_position: Option<&Account<AllocationPosition>>,
    expected_allocation_position: Pubkey,
    expected_funding_line: Pubkey,
) -> Result<()> {
    if let Some(position) = allocation_position {
        require!(
            expected_allocation_position != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            *position.address(),
            expected_allocation_position,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            position.funding_line,
            expected_funding_line,
            OmegaXProtocolError::FundingLineMismatch
        );
        require!(
            quasar_pda_matches(
                position.address(),
                &crate::ID,
                &[
                    SEED_ALLOCATION_POSITION,
                    position.capital_class.as_ref(),
                    expected_funding_line.as_ref(),
                ],
                position.bump,
            ),
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }
    Ok(())
}

#[cfg(feature = "quasar")]
fn validate_quasar_optional_allocation_ledger(
    allocation_ledger: Option<&Account<AllocationLedger>>,
    expected_allocation_position: Pubkey,
    expected_asset_mint: Pubkey,
) -> Result<()> {
    if let Some(ledger) = allocation_ledger {
        require!(
            expected_allocation_position != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            ledger.allocation_position,
            expected_allocation_position,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            ledger.asset_mint,
            expected_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
        require!(
            quasar_pda_matches(
                ledger.address(),
                &crate::ID,
                &[
                    SEED_ALLOCATION_LEDGER,
                    expected_allocation_position.as_ref(),
                    expected_asset_mint.as_ref(),
                ],
                ledger.bump,
            ),
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }
    Ok(())
}

#[cfg(feature = "quasar")]
fn validate_quasar_treasury_mutation_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
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

    let allocation_scoped = obligation.liquidity_pool != ZERO_PUBKEY
        || obligation.capital_class != ZERO_PUBKEY
        || obligation.allocation_position != ZERO_PUBKEY;
    if allocation_scoped {
        require!(
            obligation.liquidity_pool != ZERO_PUBKEY
                && obligation.capital_class != ZERO_PUBKEY
                && obligation.allocation_position != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require!(
            pool_class_ledger.is_some(),
            OmegaXProtocolError::CapitalClassMismatch
        );
        require!(
            allocation_position.is_some() && allocation_ledger.is_some(),
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }

    validate_quasar_optional_series_ledger(
        series_ledger,
        obligation.policy_series,
        obligation.asset_mint,
    )?;
    validate_quasar_optional_pool_class_ledger(
        pool_class_ledger,
        obligation.capital_class,
        obligation.asset_mint,
    )?;
    validate_quasar_optional_allocation_position(
        allocation_position,
        obligation.allocation_position,
        obligation.funding_line,
    )?;
    if let Some(position) = allocation_position {
        require_keys_eq!(
            position.liquidity_pool,
            obligation.liquidity_pool,
            OmegaXProtocolError::LiquidityPoolMismatch
        );
        require_keys_eq!(
            position.capital_class,
            obligation.capital_class,
            OmegaXProtocolError::CapitalClassMismatch
        );
        require_keys_eq!(
            position.health_plan,
            obligation.health_plan,
            OmegaXProtocolError::HealthPlanMismatch
        );
    }
    validate_quasar_optional_allocation_ledger(
        allocation_ledger,
        obligation.allocation_position,
        obligation.asset_mint,
    )
}

#[cfg(feature = "quasar")]
fn require_quasar_oracle_fee_accounts_canonical(
    vault: &Account<PoolOracleFeeVault>,
    policy: &Account<PoolOraclePolicy>,
    attestation: &Account<ClaimAttestation>,
    claim_case: Pubkey,
    asset_mint: Pubkey,
) -> Result<()> {
    require!(
        quasar_pda_matches(
            policy.address(),
            &crate::ID,
            &[SEED_POOL_ORACLE_POLICY, policy.liquidity_pool.as_ref()],
            policy.bump,
        ),
        OmegaXProtocolError::PoolOracleApprovalRequired
    );
    require!(
        quasar_pda_matches(
            attestation.address(),
            &crate::ID,
            &[
                SEED_CLAIM_ATTESTATION,
                claim_case.as_ref(),
                attestation.oracle.as_ref(),
            ],
            attestation.bump,
        ),
        OmegaXProtocolError::Unauthorized
    );
    require!(
        quasar_pda_matches(
            vault.address(),
            &crate::ID,
            &[
                SEED_POOL_ORACLE_FEE_VAULT,
                policy.liquidity_pool.as_ref(),
                attestation.oracle.as_ref(),
                asset_mint.as_ref(),
            ],
            vault.bump,
        ),
        OmegaXProtocolError::FeeVaultMismatch
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn resolve_quasar_obligation_oracle_fee(
    health_plan_key: Pubkey,
    obligation: &ObligationAccountData<'_>,
    claim_case: Option<&Account<ClaimCaseAccountData<'_>>>,
    pool_oracle_fee_vault: Option<&Account<PoolOracleFeeVault>>,
    pool_oracle_policy: Option<&Account<PoolOraclePolicy>>,
    oracle_fee_attestation: Option<&Account<ClaimAttestation>>,
    amount: u64,
) -> Result<u64> {
    match (
        pool_oracle_fee_vault,
        pool_oracle_policy,
        oracle_fee_attestation,
    ) {
        (Some(vault), Some(policy), Some(attestation)) => {
            require!(
                claim_case.is_some(),
                OmegaXProtocolError::ClaimAttestationRequiredForOracleFee
            );
            let claim_case =
                claim_case.ok_or(OmegaXProtocolError::ClaimAttestationRequiredForOracleFee)?;
            let claim_case_key = *claim_case.address();
            require_quasar_oracle_fee_accounts_canonical(
                vault,
                policy,
                attestation,
                claim_case_key,
                obligation.asset_mint,
            )?;
            require_keys_eq!(
                vault.oracle,
                attestation.oracle,
                OmegaXProtocolError::OracleProfileMismatch
            );
            require_keys_eq!(
                attestation.claim_case,
                claim_case_key,
                OmegaXProtocolError::Unauthorized
            );
            require_keys_eq!(
                attestation.health_plan,
                health_plan_key,
                OmegaXProtocolError::HealthPlanMismatch
            );
            require_keys_eq!(
                attestation.policy_series,
                claim_case.policy_series,
                OmegaXProtocolError::PolicySeriesMismatch
            );
            require!(
                attestation.evidence_ref_hash == claim_case.evidence_ref_hash,
                OmegaXProtocolError::ClaimEvidenceMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                obligation.asset_mint,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.liquidity_pool,
                policy.liquidity_pool,
                OmegaXProtocolError::LiquidityPoolMismatch
            );
            require_keys_eq!(
                attestation.liquidity_pool,
                policy.liquidity_pool,
                OmegaXProtocolError::LiquidityPoolMismatch
            );
            require_keys_eq!(
                attestation.allocation_position,
                obligation.allocation_position,
                OmegaXProtocolError::AllocationPositionMismatch
            );
            let fee = fee_share_from_bps(amount, policy.oracle_fee_bps.get())?;
            require!(fee < amount, OmegaXProtocolError::FeeVaultBpsMisconfigured);
            Ok(fee)
        }
        (Some(_), Some(_), None) => {
            err!(OmegaXProtocolError::ClaimAttestationRequiredForOracleFee)
        }
        (None, Some(_), _) => err!(OmegaXProtocolError::FeeVaultRequiredForConfiguredFee),
        (None, None, None) => Ok(0),
        (Some(_), None, _) | (None, None, Some(_)) => {
            err!(OmegaXProtocolError::FeeVaultBpsMisconfigured)
        }
    }
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
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_quasar_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp.get();
    let authority = *ctx.accounts.authority.address();
    let obligation_key = *ctx.accounts.obligation.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
    require_quasar_obligation_settlement_control(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
        &ctx.accounts.obligation,
    )?;
    if next_status == OBLIGATION_STATUS_SETTLED {
        require_quasar_reserve_asset_rail_payout_enabled(&ctx.accounts.reserve_asset_rail, now_ts)?;
    }
    require!(
        amount <= ctx.accounts.obligation.outstanding_amount.get(),
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    require_quasar_full_obligation_transition_amount(
        next_status,
        amount,
        &ctx.accounts.obligation,
    )?;

    let series_ledger = ctx
        .accounts
        .series_reserve_ledger
        .as_ref()
        .map(|ledger| &**ledger);
    let pool_class_ledger = ctx
        .accounts
        .pool_class_ledger
        .as_ref()
        .map(|ledger| &**ledger);
    let allocation_position = ctx
        .accounts
        .allocation_position
        .as_ref()
        .map(|position| &**position);
    let allocation_ledger = ctx
        .accounts
        .allocation_ledger
        .as_ref()
        .map(|ledger| &**ledger);
    validate_quasar_treasury_mutation_bindings(
        series_ledger,
        pool_class_ledger,
        allocation_position,
        allocation_ledger,
        &ctx.accounts.obligation,
        *ctx.accounts.funding_line.address(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    let pool_oracle_fee_vault = ctx
        .accounts
        .pool_oracle_fee_vault
        .as_ref()
        .map(|vault| &**vault);
    let oracle_fee = resolve_quasar_obligation_oracle_fee(
        health_plan_key,
        &ctx.accounts.obligation,
        ctx.accounts.claim_case.as_ref(),
        pool_oracle_fee_vault,
        ctx.accounts
            .pool_oracle_policy
            .as_ref()
            .map(|policy| *policy),
        ctx.accounts
            .oracle_fee_attestation
            .as_ref()
            .map(|attestation| *attestation),
        amount,
    )?;
    let net_to_recipient = checked_sub(amount, oracle_fee)?;
    require_quasar_positive_amount(net_to_recipient)?;
    let obligation_is_linked = ctx.accounts.obligation.claim_case != ZERO_PUBKEY;

    if obligation_is_linked {
        require!(
            ctx.accounts.claim_case.is_some() && ctx.accounts.member_position.is_some(),
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
                ctx.accounts.member_position.is_some()
                    && ctx.accounts.asset_mint.is_some()
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
    let mut series_sheet = ctx
        .accounts
        .series_reserve_ledger
        .as_ref()
        .map(|ledger| ledger.sheet);
    let mut pool_class_sheet = ctx
        .accounts
        .pool_class_ledger
        .as_ref()
        .map(|ledger| ledger.sheet);
    let mut allocation_sheet = ctx
        .accounts
        .allocation_ledger
        .as_ref()
        .map(|ledger| ledger.sheet);
    let mut allocation_reserved_capacity = ctx
        .accounts
        .allocation_position
        .as_ref()
        .map(|position| position.reserved_capacity.get());
    let mut allocation_utilized_amount = ctx
        .accounts
        .allocation_position
        .as_ref()
        .map(|position| position.utilized_amount.get());
    let mut allocation_position_changed = false;

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
            if let Some(sheet) = series_sheet.as_mut() {
                release_to_claimable_or_payable(sheet, delivery_mode, amount)?;
            }
            if let Some(sheet) = pool_class_sheet.as_mut() {
                release_to_claimable_or_payable(sheet, delivery_mode, amount)?;
            }
            if let Some(sheet) = allocation_sheet.as_mut() {
                release_to_claimable_or_payable(sheet, delivery_mode, amount)?;
            }
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
            let allocation_scoped = ctx.accounts.allocation_position.is_some()
                || ctx.accounts.allocation_ledger.is_some();
            settle_from_sheet(&mut domain_sheet, delivery_mode, amount)?;
            if allocation_scoped {
                settle_from_allocation_sheet(&mut plan_sheet, delivery_mode, amount)?;
                settle_from_allocation_sheet(&mut funding_line_sheet, delivery_mode, amount)?;
            } else {
                settle_from_sheet(&mut plan_sheet, delivery_mode, amount)?;
                settle_from_sheet(&mut funding_line_sheet, delivery_mode, amount)?;
            }
            if let Some(sheet) = series_sheet.as_mut() {
                if allocation_scoped {
                    settle_from_allocation_sheet(sheet, delivery_mode, amount)?;
                } else {
                    settle_from_sheet(sheet, delivery_mode, amount)?;
                }
            }
            if let Some(sheet) = pool_class_sheet.as_mut() {
                settle_from_sheet(sheet, delivery_mode, amount)?;
            }
            if let Some(reserved_capacity) = allocation_reserved_capacity.as_mut() {
                *reserved_capacity = reserved_capacity.saturating_sub(amount);
                allocation_position_changed = true;
            }
            if let Some(sheet) = allocation_sheet.as_mut() {
                settle_from_allocation_sheet(sheet, delivery_mode, amount)?;
            }
            domain_total_assets = checked_sub(domain_total_assets, amount)?;
            funding_reserved_amount = funding_reserved_amount.saturating_sub(amount);
            funding_spent_amount = checked_add(funding_spent_amount, amount)?;
            obligation_outstanding_amount = checked_sub(obligation_outstanding_amount, amount)?;
            obligation_claimable_amount = obligation_claimable_amount.saturating_sub(amount);
            obligation_payable_amount = obligation_payable_amount.saturating_sub(amount);
            obligation_reserved_amount = obligation_reserved_amount.saturating_sub(amount);
            obligation_settled_amount = checked_add(obligation_settled_amount, amount)?;
            if oracle_fee > 0 {
                domain_total_assets = checked_add(domain_total_assets, oracle_fee)?;
            }
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
                let Some(member_pos) = ctx.accounts.member_position.as_ref() else {
                    return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
                };
                require_keys_eq!(
                    *member_pos.address(),
                    claim_case_ref.member_position,
                    OmegaXProtocolError::Unauthorized
                );
                let resolved_recipient = if claim_case_ref.delegate_recipient != ZERO_PUBKEY {
                    claim_case_ref.delegate_recipient
                } else {
                    member_pos.wallet
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
                net_to_recipient,
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
                if let Some(sheet) = series_sheet.as_mut() {
                    release_reserved_sheet(sheet, amount)?;
                }
                if let Some(sheet) = pool_class_sheet.as_mut() {
                    release_reserved_sheet(sheet, amount)?;
                }
                if let Some(reserved_capacity) = allocation_reserved_capacity.as_mut() {
                    *reserved_capacity = reserved_capacity.saturating_sub(amount);
                    allocation_position_changed = true;
                }
                if let Some(utilized_amount) = allocation_utilized_amount.as_mut() {
                    *utilized_amount = utilized_amount.saturating_sub(amount);
                    allocation_position_changed = true;
                }
                if let Some(sheet) = allocation_sheet.as_mut() {
                    release_reserved_sheet(sheet, amount)?;
                }
                funding_reserved_amount = funding_reserved_amount.saturating_sub(amount);
                funding_released_amount = checked_add(funding_released_amount, amount)?;
                obligation_reserved_amount = obligation_reserved_amount.saturating_sub(amount);
            } else if obligation_claimable_amount >= amount || obligation_payable_amount >= amount {
                quasar_cancel_delivery_bucket(&mut domain_sheet, delivery_mode, amount)?;
                quasar_cancel_delivery_bucket(&mut plan_sheet, delivery_mode, amount)?;
                quasar_cancel_delivery_bucket(&mut funding_line_sheet, delivery_mode, amount)?;
                if let Some(sheet) = series_sheet.as_mut() {
                    quasar_cancel_delivery_bucket(sheet, delivery_mode, amount)?;
                }
                if let Some(sheet) = pool_class_sheet.as_mut() {
                    quasar_cancel_delivery_bucket(sheet, delivery_mode, amount)?;
                }
                if let Some(sheet) = allocation_sheet.as_mut() {
                    quasar_cancel_delivery_bucket(sheet, delivery_mode, amount)?;
                }
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
        let member_position = claim_case.member_position;
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
        let attestation_count = claim_case.attestation_count.get();
        let opened_at = claim_case.opened_at.get();
        let bump = claim_case.bump;
        let claim_id = claim_case.claim_id().to_owned();
        claim_case.set_inner(
            reserve_domain,
            health_plan,
            policy_series,
            member_position,
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
            attestation_count,
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

    if let (Some(series_ledger), Some(sheet)) = (
        ctx.accounts.series_reserve_ledger.as_mut(),
        series_sheet.as_ref(),
    ) {
        let series_ledger = &mut **series_ledger;
        let policy_series = series_ledger.policy_series;
        let asset_mint = series_ledger.asset_mint;
        let bump = series_ledger.bump;
        series_ledger.set_inner(policy_series, asset_mint, *sheet, bump);
    }

    if let (Some(pool_class_ledger), Some(sheet)) = (
        ctx.accounts.pool_class_ledger.as_mut(),
        pool_class_sheet.as_ref(),
    ) {
        let pool_class_ledger = &mut **pool_class_ledger;
        let capital_class = pool_class_ledger.capital_class;
        let asset_mint = pool_class_ledger.asset_mint;
        let total_shares = pool_class_ledger.total_shares.get();
        let realized_yield_amount = pool_class_ledger.realized_yield_amount.get();
        let realized_loss_amount = pool_class_ledger.realized_loss_amount.get();
        let bump = pool_class_ledger.bump;
        pool_class_ledger.set_inner(
            capital_class,
            asset_mint,
            *sheet,
            total_shares,
            realized_yield_amount,
            realized_loss_amount,
            bump,
        );
    }

    if allocation_position_changed {
        if let Some(allocation_position) = ctx.accounts.allocation_position.as_mut() {
            let allocation_position = &mut **allocation_position;
            let reserve_domain = allocation_position.reserve_domain;
            let liquidity_pool = allocation_position.liquidity_pool;
            let capital_class = allocation_position.capital_class;
            let health_plan = allocation_position.health_plan;
            let policy_series = allocation_position.policy_series;
            let funding_line = allocation_position.funding_line;
            let cap_amount = allocation_position.cap_amount.get();
            let weight_bps = allocation_position.weight_bps.get();
            let allocation_mode = allocation_position.allocation_mode;
            let allocated_amount = allocation_position.allocated_amount.get();
            let realized_pnl = allocation_position.realized_pnl.get();
            let impaired_amount = allocation_position.impaired_amount.get();
            let deallocation_only = allocation_position.deallocation_only.get();
            let active = allocation_position.active.get();
            let bump = allocation_position.bump;
            let utilized_amount = allocation_utilized_amount
                .unwrap_or_else(|| allocation_position.utilized_amount.get());
            let reserved_capacity = allocation_reserved_capacity
                .unwrap_or_else(|| allocation_position.reserved_capacity.get());
            allocation_position.set_inner(
                reserve_domain,
                liquidity_pool,
                capital_class,
                health_plan,
                policy_series,
                funding_line,
                cap_amount,
                weight_bps,
                allocation_mode,
                allocated_amount,
                utilized_amount,
                reserved_capacity,
                realized_pnl,
                impaired_amount,
                deallocation_only,
                active,
                bump,
            );
        }
    }

    if let (Some(allocation_ledger), Some(sheet)) = (
        ctx.accounts.allocation_ledger.as_mut(),
        allocation_sheet.as_ref(),
    ) {
        let allocation_ledger = &mut **allocation_ledger;
        let allocation_position = allocation_ledger.allocation_position;
        let asset_mint = allocation_ledger.asset_mint;
        let realized_pnl = allocation_ledger.realized_pnl.get();
        let bump = allocation_ledger.bump;
        allocation_ledger.set_inner(allocation_position, asset_mint, *sheet, realized_pnl, bump);
    }

    if oracle_fee > 0 {
        if let Some(vault) = ctx.accounts.pool_oracle_fee_vault.as_mut() {
            let vault = &mut **vault;
            let liquidity_pool = vault.liquidity_pool;
            let oracle = vault.oracle;
            let asset_mint = vault.asset_mint;
            let fee_recipient = vault.fee_recipient;
            let accrued_fees = checked_add(vault.accrued_fees.get(), oracle_fee)?;
            let withdrawn_fees = vault.withdrawn_fees.get();
            let bump = vault.bump;
            vault.set_inner(
                liquidity_pool,
                oracle,
                asset_mint,
                fee_recipient,
                accrued_fees,
                withdrawn_fees,
                bump,
            );
        }
    }

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
    let liquidity_pool = obligation.liquidity_pool;
    let capital_class = obligation.capital_class;
    let allocation_position = obligation.allocation_position;
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
        liquidity_pool,
        capital_class,
        allocation_position,
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

#[cfg(not(feature = "quasar"))]
fn resolve_obligation_oracle_fee(
    health_plan_key: Pubkey,
    obligation: &ObligationAccountData<'_>,
    claim_case: Option<&Account<ClaimCaseAccountData<'_>>>,
    pool_oracle_fee_vault: Option<&Account<PoolOracleFeeVault>>,
    pool_oracle_policy: Option<&Account<PoolOraclePolicy>>,
    oracle_fee_attestation: Option<&Account<ClaimAttestation>>,
    amount: u64,
) -> Result<u64> {
    match (
        pool_oracle_fee_vault,
        pool_oracle_policy,
        oracle_fee_attestation,
    ) {
        (Some(vault), Some(policy), Some(attestation)) => {
            require!(
                claim_case.is_some(),
                OmegaXProtocolError::ClaimAttestationRequiredForOracleFee
            );
            let claim_case =
                claim_case.ok_or(OmegaXProtocolError::ClaimAttestationRequiredForOracleFee)?;
            crate::claims::require_oracle_fee_accounts_canonical(
                vault,
                policy,
                attestation,
                claim_case.key(),
                obligation.asset_mint,
            )?;
            require_keys_eq!(
                vault.oracle,
                attestation.oracle,
                OmegaXProtocolError::OracleProfileMismatch
            );
            require_keys_eq!(
                attestation.claim_case,
                claim_case.key(),
                OmegaXProtocolError::Unauthorized
            );
            require_keys_eq!(
                attestation.health_plan,
                health_plan_key,
                OmegaXProtocolError::HealthPlanMismatch
            );
            require_keys_eq!(
                attestation.policy_series,
                claim_case.policy_series,
                OmegaXProtocolError::PolicySeriesMismatch
            );
            require!(
                attestation.evidence_ref_hash == claim_case.evidence_ref_hash,
                OmegaXProtocolError::ClaimEvidenceMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                obligation.asset_mint,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.liquidity_pool,
                policy.liquidity_pool,
                OmegaXProtocolError::LiquidityPoolMismatch
            );
            require_keys_eq!(
                attestation.liquidity_pool,
                policy.liquidity_pool,
                OmegaXProtocolError::LiquidityPoolMismatch
            );
            require_keys_eq!(
                attestation.allocation_position,
                obligation.allocation_position,
                OmegaXProtocolError::AllocationPositionMismatch
            );
            let fee = fee_share_from_bps(amount, policy.oracle_fee_bps)?;
            require!(fee < amount, OmegaXProtocolError::FeeVaultBpsMisconfigured);
            Ok(fee)
        }
        (Some(_), Some(_), None) => {
            err!(OmegaXProtocolError::ClaimAttestationRequiredForOracleFee)
        }
        (None, Some(_), _) => err!(OmegaXProtocolError::FeeVaultRequiredForConfiguredFee),
        (None, None, None) => Ok(0),
        (Some(_), None, _) | (None, None, Some(_)) => {
            err!(OmegaXProtocolError::FeeVaultBpsMisconfigured)
        }
    }
}

#[derive(Accounts)]
pub struct SettleObligation<'info> {
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
    #[account(
        seeds = [SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()],
        bump = reserve_asset_rail.bump,
        constraint = reserve_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = reserve_asset_rail.asset_mint == obligation.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            reserve_asset_rail.address(),
            &crate::ID,
            &[SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()],
            reserve_asset_rail.bump,
        ) @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = reserve_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = reserve_asset_rail.asset_mint == obligation.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub reserve_asset_rail: Account<ReserveAssetRailAccountData<'info>>,
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
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[cfg(feature = "quasar")]
    pub series_reserve_ledger: Option<&'info mut Account<SeriesReserveLedger>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[cfg(feature = "quasar")]
    pub pool_class_ledger: Option<&'info mut Account<PoolClassLedger>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[cfg(feature = "quasar")]
    pub allocation_position: Option<&'info mut Account<AllocationPosition>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[cfg(feature = "quasar")]
    pub allocation_ledger: Option<&'info mut Account<AllocationLedger>>,
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
    // Optional for non-claim obligation transitions, but required when a
    // linked claim is being marked SETTLED so accounting cannot move without
    // the matching SPL outflow.
    #[cfg(not(feature = "quasar"))]
    pub member_position: Option<Box<Account<'info, MemberPosition>>>,
    #[cfg(feature = "quasar")]
    pub member_position: Option<&'info Account<MemberPosition>>,
    #[cfg(not(feature = "quasar"))]
    pub asset_mint: Option<InterfaceAccount<'info, Mint>>,
    #[cfg(feature = "quasar")]
    pub asset_mint: Option<&'info InterfaceAccount<Mint>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub vault_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[cfg(feature = "quasar")]
    pub vault_token_account: Option<&'info mut InterfaceAccount<TokenAccount>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[cfg(feature = "quasar")]
    pub recipient_token_account: Option<&'info mut InterfaceAccount<TokenAccount>>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Option<Interface<'info, TokenInterface>>,
    #[cfg(feature = "quasar")]
    pub token_program: Option<&'info Interface<TokenInterface>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub pool_oracle_fee_vault: Option<Box<Account<'info, PoolOracleFeeVault>>>,
    #[cfg(feature = "quasar")]
    pub pool_oracle_fee_vault: Option<&'info mut Account<PoolOracleFeeVault>>,
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_policy: Option<Box<Account<'info, PoolOraclePolicy>>>,
    #[cfg(feature = "quasar")]
    pub pool_oracle_policy: Option<&'info Account<PoolOraclePolicy>>,
    #[cfg(not(feature = "quasar"))]
    pub oracle_fee_attestation: Option<Box<Account<'info, ClaimAttestation>>>,
    #[cfg(feature = "quasar")]
    pub oracle_fee_attestation: Option<&'info Account<ClaimAttestation>>,
}
