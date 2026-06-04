// SPDX-License-Identifier: AGPL-3.0-or-later

//! Impairment instruction handlers and account validation contexts.

use super::*;

#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
pub(crate) fn mark_impairment(
    ctx: Context<MarkImpairment>,
    args: MarkImpairmentArgs,
) -> Result<()> {
    require_claim_operator(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;
    require_positive_amount(args.amount)?;
    validate_impairment_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        ctx.accounts.obligation.as_deref(),
        ctx.accounts.funding_line.key(),
        &ctx.accounts.funding_line,
    )?;

    let amount = args.amount;
    book_impairment(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_impairment(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
    book_impairment(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_impairment(&mut series_ledger.sheet, amount)?;
    }
    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
        book_impairment(&mut pool_class_ledger.sheet, amount)?;
        pool_class_ledger.realized_loss_amount =
            checked_add(pool_class_ledger.realized_loss_amount, amount)?;
    }
    if let Some(allocation_position) = ctx.accounts.allocation_position.as_deref_mut() {
        allocation_position.impaired_amount =
            checked_add(allocation_position.impaired_amount, amount)?;
        allocation_position.realized_pnl =
            debit_realized_pnl_for_loss(allocation_position.realized_pnl, amount)?;
    }
    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
        book_impairment(&mut allocation_ledger.sheet, amount)?;
        allocation_ledger.realized_pnl =
            debit_realized_pnl_for_loss(allocation_ledger.realized_pnl, amount)?;
    }
    if let Some(obligation) = ctx.accounts.obligation.as_deref_mut() {
        obligation.status = OBLIGATION_STATUS_IMPAIRED;
        obligation.impaired_amount = checked_add(obligation.impaired_amount, amount)?;
        obligation.updated_at = Clock::get()?.unix_timestamp;
    }

    ctx.accounts.funding_line.released_amount =
        checked_add(ctx.accounts.funding_line.released_amount, amount)?;

    emit!(ImpairmentRecordedEvent {
        funding_line: ctx.accounts.funding_line.key(),
        obligation: ctx
            .accounts
            .obligation
            .as_ref()
            .map(|obligation| obligation.key())
            .unwrap_or(ZERO_PUBKEY),
        amount,
        reason_hash: args.reason_hash,
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
fn quasar_debit_realized_pnl_for_loss(realized_pnl: i64, amount: u64) -> Result<i64> {
    let amount = i64::try_from(amount).map_err(|_| OmegaXProtocolError::ArithmeticError)?;
    realized_pnl
        .checked_sub(amount)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_claim_operator(
    authority: &Pubkey,
    plan: &HealthPlanAccountData<'_>,
) -> Result<()> {
    if *authority == plan.claims_operator || *authority == plan.plan_admin {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
fn quasar_recompute_sheet(sheet: &mut ReserveBalanceSheet) -> Result<()> {
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
fn quasar_book_impairment(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.impaired = quasar_checked_add(sheet.impaired, amount)?;
    quasar_recompute_sheet(sheet)
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
fn validate_quasar_obligation_binding(
    obligation: &Account<ObligationAccountData<'_>>,
    expected_funding_line: Pubkey,
    funding_line: &FundingLineAccountData<'_>,
) -> Result<()> {
    require_keys_eq!(
        obligation.funding_line,
        expected_funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        obligation.asset_mint,
        funding_line.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        obligation.reserve_domain,
        funding_line.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        obligation.health_plan,
        funding_line.health_plan,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        obligation.policy_series,
        funding_line.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );

    require!(
        quasar_pda_matches(
            obligation.address(),
            &crate::ID,
            &[
                SEED_OBLIGATION,
                expected_funding_line.as_ref(),
                obligation.obligation_id().as_bytes(),
            ],
            obligation.bump,
        ),
        OmegaXProtocolError::ObligationMismatch
    );

    Ok(())
}

#[cfg(feature = "quasar")]
fn validate_quasar_treasury_mutation_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    obligation: &Account<ObligationAccountData<'_>>,
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
fn validate_quasar_impairment_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    obligation: Option<&Account<ObligationAccountData<'_>>>,
    funding_line_key: Pubkey,
    funding_line: &FundingLineAccountData<'_>,
) -> Result<()> {
    validate_quasar_optional_series_ledger(
        series_ledger,
        funding_line.policy_series,
        funding_line.asset_mint,
    )?;

    if let Some(obligation) = obligation {
        validate_quasar_obligation_binding(obligation, funding_line_key, funding_line)?;
        return validate_quasar_treasury_mutation_bindings(
            series_ledger,
            pool_class_ledger,
            allocation_position,
            allocation_ledger,
            obligation,
            funding_line_key,
            funding_line.asset_mint,
        );
    }

    if funding_line.line_type == FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION {
        require!(
            pool_class_ledger.is_some(),
            OmegaXProtocolError::CapitalClassMismatch
        );
        require!(
            allocation_position.is_some() && allocation_ledger.is_some(),
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }

    let allocation_key = allocation_position
        .as_ref()
        .map(|position| *position.address())
        .unwrap_or(ZERO_PUBKEY);
    if pool_class_ledger.is_some() || allocation_ledger.is_some() {
        require!(
            allocation_key != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }
    validate_quasar_optional_allocation_position(
        allocation_position,
        allocation_key,
        funding_line_key,
    )?;
    if let (Some(class_ledger), Some(position)) = (pool_class_ledger, allocation_position) {
        require_keys_eq!(
            position.reserve_domain,
            funding_line.reserve_domain,
            OmegaXProtocolError::ReserveDomainMismatch
        );
        require_keys_eq!(
            position.health_plan,
            funding_line.health_plan,
            OmegaXProtocolError::HealthPlanMismatch
        );
        require_keys_eq!(
            position.policy_series,
            funding_line.policy_series,
            OmegaXProtocolError::PolicySeriesMismatch
        );
        require!(
            position.active.get(),
            OmegaXProtocolError::AllocationPositionMismatch
        );
        validate_quasar_optional_pool_class_ledger(
            Some(class_ledger),
            position.capital_class,
            funding_line.asset_mint,
        )?;
    } else if pool_class_ledger.is_some() {
        return err!(OmegaXProtocolError::CapitalClassMismatch);
    }
    validate_quasar_optional_allocation_ledger(
        allocation_ledger,
        allocation_key,
        funding_line.asset_mint,
    )
}

#[cfg(feature = "quasar")]
pub(crate) fn mark_impairment<'info>(
    ctx: &mut Ctx<'info, MarkImpairment<'info>>,
    amount: u64,
    reason_hash: [u8; 32],
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_claim_operator(&authority, &ctx.accounts.health_plan)?;
    require_quasar_positive_amount(amount)?;

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
    validate_quasar_impairment_bindings(
        series_ledger,
        pool_class_ledger,
        allocation_position,
        allocation_ledger,
        ctx.accounts.obligation.as_ref(),
        *ctx.accounts.funding_line.address(),
        &ctx.accounts.funding_line,
    )?;

    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.funding_line_ledger.sheet;
    quasar_book_impairment(&mut domain_sheet, amount)?;
    quasar_book_impairment(&mut plan_sheet, amount)?;
    quasar_book_impairment(&mut funding_line_sheet, amount)?;

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

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_mut() {
        let series_ledger = &mut **series_ledger;
        let mut sheet = series_ledger.sheet;
        quasar_book_impairment(&mut sheet, amount)?;
        let policy_series = series_ledger.policy_series;
        let asset_mint = series_ledger.asset_mint;
        let bump = series_ledger.bump;
        series_ledger.set_inner(policy_series, asset_mint, sheet, bump);
    }

    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_mut() {
        let pool_class_ledger = &mut **pool_class_ledger;
        let mut sheet = pool_class_ledger.sheet;
        quasar_book_impairment(&mut sheet, amount)?;
        let capital_class = pool_class_ledger.capital_class;
        let asset_mint = pool_class_ledger.asset_mint;
        let total_shares = pool_class_ledger.total_shares.get();
        let realized_yield_amount = pool_class_ledger.realized_yield_amount.get();
        let realized_loss_amount =
            quasar_checked_add(pool_class_ledger.realized_loss_amount.get(), amount)?;
        let bump = pool_class_ledger.bump;
        pool_class_ledger.set_inner(
            capital_class,
            asset_mint,
            sheet,
            total_shares,
            realized_yield_amount,
            realized_loss_amount,
            bump,
        );
    }

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
        let utilized_amount = allocation_position.utilized_amount.get();
        let reserved_capacity = allocation_position.reserved_capacity.get();
        let realized_pnl =
            quasar_debit_realized_pnl_for_loss(allocation_position.realized_pnl.get(), amount)?;
        let impaired_amount =
            quasar_checked_add(allocation_position.impaired_amount.get(), amount)?;
        let deallocation_only = allocation_position.deallocation_only.get();
        let active = allocation_position.active.get();
        let bump = allocation_position.bump;
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

    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_mut() {
        let allocation_ledger = &mut **allocation_ledger;
        let mut sheet = allocation_ledger.sheet;
        quasar_book_impairment(&mut sheet, amount)?;
        let allocation_position = allocation_ledger.allocation_position;
        let asset_mint = allocation_ledger.asset_mint;
        let realized_pnl =
            quasar_debit_realized_pnl_for_loss(allocation_ledger.realized_pnl.get(), amount)?;
        let bump = allocation_ledger.bump;
        allocation_ledger.set_inner(allocation_position, asset_mint, sheet, realized_pnl, bump);
    }

    let now_ts = Clock::get()?.unix_timestamp.get();
    if let Some(obligation) = ctx.accounts.obligation.as_mut() {
        let reserve_domain = obligation.reserve_domain;
        let asset_mint = obligation.asset_mint;
        let health_plan = obligation.health_plan;
        let policy_series = obligation.policy_series;
        let member_wallet = obligation.member_wallet;
        let beneficiary = obligation.beneficiary;
        let funding_line = obligation.funding_line;
        let claim_case = obligation.claim_case;
        let liquidity_pool = obligation.liquidity_pool;
        let capital_class = obligation.capital_class;
        let allocation_position = obligation.allocation_position;
        let creation_reason_hash = obligation.creation_reason_hash;
        let settlement_reason_hash = obligation.settlement_reason_hash;
        let delivery_mode = obligation.delivery_mode;
        let principal_amount = obligation.principal_amount.get();
        let outstanding_amount = obligation.outstanding_amount.get();
        let reserved_amount = obligation.reserved_amount.get();
        let claimable_amount = obligation.claimable_amount.get();
        let payable_amount = obligation.payable_amount.get();
        let settled_amount = obligation.settled_amount.get();
        let impaired_amount = quasar_checked_add(obligation.impaired_amount.get(), amount)?;
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
            claim_case,
            liquidity_pool,
            capital_class,
            allocation_position,
            creation_reason_hash,
            settlement_reason_hash,
            OBLIGATION_STATUS_IMPAIRED,
            delivery_mode,
            principal_amount,
            outstanding_amount,
            reserved_amount,
            claimable_amount,
            payable_amount,
            settled_amount,
            impaired_amount,
            recovered_amount,
            created_at,
            now_ts,
            bump,
            &obligation_id,
            ctx.accounts.authority.to_account_view(),
            None,
        )?;
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
    let reserved_amount = funding_line.reserved_amount.get();
    let spent_amount = funding_line.spent_amount.get();
    let released_amount = quasar_checked_add(funding_line.released_amount.get(), amount)?;
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
        reserved_amount,
        spent_amount,
        released_amount,
        returned_amount,
        status,
        caps_hash,
        bump,
        &line_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let _ = reason_hash;

    Ok(())
}

#[derive(Accounts)]
pub struct MarkImpairment<'info> {
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
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
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
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), funding_line.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            plan_reserve_ledger.address(),
            &crate::ID,
            &[SEED_PLAN_RESERVE_LEDGER, health_plan.address().as_ref(), funding_line.asset_mint.as_ref()],
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
    #[account(mut)]
    pub obligation: Option<Box<Account<'info, Obligation>>>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub obligation: Option<Account<ObligationAccountData<'info>>>,
}
