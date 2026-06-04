// SPDX-License-Identifier: AGPL-3.0-or-later

//! Obligation creation instruction handlers and account validation contexts.

use super::*;
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
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
fn quasar_book_owed(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.owed = quasar_checked_add(sheet.owed, amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_plan_control(authority: &Pubkey, plan: &HealthPlanAccountData<'_>) -> Result<()> {
    if *authority == plan.plan_admin || *authority == plan.sponsor_operator {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_supported_obligation_delivery_mode(delivery_mode: u8) -> Result<()> {
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE | OBLIGATION_DELIVERY_MODE_PAYABLE => Ok(()),
        _ => Err(OmegaXProtocolError::InvalidObligationDeliveryMode.into()),
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_liquidity_pool_active(pool: &LiquidityPoolAccountData<'_>) -> Result<()> {
    require!(
        pool.active.get(),
        OmegaXProtocolError::LiquidityPoolInactive
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_capital_class_active(capital_class: &CapitalClassAccountData<'_>) -> Result<()> {
    require!(
        capital_class.active.get(),
        OmegaXProtocolError::CapitalClassInactive
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_allocation_position_allocatable(
    allocation_position: &AllocationPosition,
) -> Result<()> {
    require!(
        allocation_position.active.get() && !allocation_position.deallocation_only.get(),
        OmegaXProtocolError::AllocationPositionInactive
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
fn validate_quasar_obligation_creation_scope(
    liquidity_pool: Option<&Account<LiquidityPoolAccountData<'_>>>,
    capital_class: Option<&Account<CapitalClassAccountData<'_>>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    health_plan: &Account<HealthPlanAccountData<'_>>,
    funding_line_key: Pubkey,
    funding_line: &FundingLineAccountData<'_>,
    expected_liquidity_pool: Pubkey,
    expected_capital_class: Pubkey,
    expected_allocation_position: Pubkey,
) -> Result<()> {
    let scope_requested = expected_liquidity_pool != ZERO_PUBKEY
        || expected_capital_class != ZERO_PUBKEY
        || expected_allocation_position != ZERO_PUBKEY
        || liquidity_pool.is_some()
        || capital_class.is_some()
        || allocation_position.is_some()
        || pool_class_ledger.is_some()
        || allocation_ledger.is_some();

    require_keys_eq!(
        funding_line.reserve_domain,
        health_plan.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        funding_line.health_plan,
        *health_plan.address(),
        OmegaXProtocolError::HealthPlanMismatch
    );

    if funding_line.line_type != FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION {
        require!(
            !scope_requested,
            OmegaXProtocolError::FundingLineTypeMismatch
        );
        return Ok(());
    }

    require!(
        expected_liquidity_pool != ZERO_PUBKEY
            && expected_capital_class != ZERO_PUBKEY
            && expected_allocation_position != ZERO_PUBKEY,
        OmegaXProtocolError::AllocationPositionMismatch
    );

    let pool = liquidity_pool.ok_or(OmegaXProtocolError::LiquidityPoolMismatch)?;
    let class = capital_class.ok_or(OmegaXProtocolError::CapitalClassMismatch)?;
    let position = allocation_position.ok_or(OmegaXProtocolError::AllocationPositionMismatch)?;
    require!(
        pool_class_ledger.is_some(),
        OmegaXProtocolError::CapitalClassMismatch
    );
    require!(
        allocation_ledger.is_some(),
        OmegaXProtocolError::AllocationPositionMismatch
    );

    require_keys_eq!(
        *pool.address(),
        expected_liquidity_pool,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        pool.reserve_domain,
        health_plan.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        pool.deposit_asset_mint,
        funding_line.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        quasar_pda_matches(
            pool.address(),
            &crate::ID,
            &[
                SEED_LIQUIDITY_POOL,
                health_plan.reserve_domain.as_ref(),
                pool.pool_id().as_bytes(),
            ],
            pool.bump,
        ),
        OmegaXProtocolError::LiquidityPoolMismatch
    );

    require_keys_eq!(
        *class.address(),
        expected_capital_class,
        OmegaXProtocolError::CapitalClassMismatch
    );
    require_keys_eq!(
        class.reserve_domain,
        health_plan.reserve_domain,
        OmegaXProtocolError::ReserveDomainMismatch
    );
    require_keys_eq!(
        class.liquidity_pool,
        *pool.address(),
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require!(
        quasar_pda_matches(
            class.address(),
            &crate::ID,
            &[
                SEED_CAPITAL_CLASS,
                pool.address().as_ref(),
                class.class_id().as_bytes(),
            ],
            class.bump,
        ),
        OmegaXProtocolError::CapitalClassMismatch
    );

    validate_quasar_optional_pool_class_ledger(
        pool_class_ledger,
        expected_capital_class,
        funding_line.asset_mint,
    )?;
    validate_quasar_optional_allocation_position(
        Some(position),
        expected_allocation_position,
        funding_line_key,
    )?;
    require_keys_eq!(
        position.reserve_domain,
        health_plan.reserve_domain,
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
    require_keys_eq!(
        position.liquidity_pool,
        *pool.address(),
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        position.capital_class,
        *class.address(),
        OmegaXProtocolError::CapitalClassMismatch
    );
    require_quasar_liquidity_pool_active(pool)?;
    require_quasar_capital_class_active(class)?;
    require_quasar_allocation_position_allocatable(position)?;
    validate_quasar_optional_allocation_ledger(
        allocation_ledger,
        expected_allocation_position,
        funding_line.asset_mint,
    )
}

#[cfg(feature = "quasar")]
pub(crate) fn create_obligation<'info>(
    ctx: &mut Ctx<'info, CreateObligation<'info>>,
    asset_mint: Pubkey,
    policy_series: Pubkey,
    member_wallet: Pubkey,
    beneficiary: Pubkey,
    claim_case: Pubkey,
    liquidity_pool_arg: Pubkey,
    capital_class_arg: Pubkey,
    allocation_position_arg: Pubkey,
    delivery_mode: u8,
    amount: u64,
    creation_reason_hash: [u8; 32],
    obligation_id: &str,
) -> Result<()> {
    require_quasar_id(obligation_id)?;
    let authority = *ctx.accounts.authority.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
    let funding_line_key = *ctx.accounts.funding_line.address();
    require_quasar_plan_control(&authority, &ctx.accounts.health_plan)?;
    require_keys_eq!(
        ctx.accounts.funding_line.health_plan,
        health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.asset_mint,
        asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.policy_series,
        policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
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

    validate_quasar_optional_series_ledger(series_ledger, policy_series, asset_mint)?;
    validate_quasar_obligation_creation_scope(
        ctx.accounts.liquidity_pool.as_ref(),
        ctx.accounts.capital_class.as_ref(),
        allocation_position,
        pool_class_ledger,
        allocation_ledger,
        &ctx.accounts.health_plan,
        funding_line_key,
        &ctx.accounts.funding_line,
        liquidity_pool_arg,
        capital_class_arg,
        allocation_position_arg,
    )?;
    require_quasar_supported_obligation_delivery_mode(delivery_mode)?;

    let now_ts = Clock::get()?.unix_timestamp.get();
    let obligation_bump = ctx.accounts.obligation.bump;
    ctx.accounts.obligation.set_inner(
        ctx.accounts.health_plan.reserve_domain,
        asset_mint,
        health_plan_key,
        policy_series,
        member_wallet,
        beneficiary,
        funding_line_key,
        claim_case,
        liquidity_pool_arg,
        capital_class_arg,
        allocation_position_arg,
        creation_reason_hash,
        [0u8; 32],
        OBLIGATION_STATUS_PROPOSED,
        delivery_mode,
        amount,
        amount,
        0,
        0,
        0,
        0,
        0,
        0,
        now_ts,
        now_ts,
        obligation_bump,
        obligation_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.funding_line_ledger.sheet;
    quasar_book_owed(&mut domain_sheet, amount)?;
    quasar_book_owed(&mut plan_sheet, amount)?;
    quasar_book_owed(&mut funding_line_sheet, amount)?;

    let domain_asset_ledger = &mut ctx.accounts.domain_asset_ledger;
    let reserve_domain = domain_asset_ledger.reserve_domain;
    let domain_asset_mint = domain_asset_ledger.asset_mint;
    let domain_bump = domain_asset_ledger.bump;
    domain_asset_ledger.set_inner(reserve_domain, domain_asset_mint, domain_sheet, domain_bump);

    let plan_reserve_ledger = &mut ctx.accounts.plan_reserve_ledger;
    let plan_health_plan = plan_reserve_ledger.health_plan;
    let plan_asset_mint = plan_reserve_ledger.asset_mint;
    let plan_bump = plan_reserve_ledger.bump;
    plan_reserve_ledger.set_inner(plan_health_plan, plan_asset_mint, plan_sheet, plan_bump);

    let funding_line_ledger = &mut ctx.accounts.funding_line_ledger;
    let ledger_funding_line = funding_line_ledger.funding_line;
    let ledger_asset_mint = funding_line_ledger.asset_mint;
    let ledger_bump = funding_line_ledger.bump;
    funding_line_ledger.set_inner(
        ledger_funding_line,
        ledger_asset_mint,
        funding_line_sheet,
        ledger_bump,
    );

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_mut() {
        let series_ledger = &mut **series_ledger;
        let mut sheet = series_ledger.sheet;
        quasar_book_owed(&mut sheet, amount)?;
        let policy_series = series_ledger.policy_series;
        let asset_mint = series_ledger.asset_mint;
        let bump = series_ledger.bump;
        series_ledger.set_inner(policy_series, asset_mint, sheet, bump);
    }

    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_mut() {
        let pool_class_ledger = &mut **pool_class_ledger;
        let mut sheet = pool_class_ledger.sheet;
        quasar_book_owed(&mut sheet, amount)?;
        let capital_class = pool_class_ledger.capital_class;
        let asset_mint = pool_class_ledger.asset_mint;
        let total_shares = pool_class_ledger.total_shares.get();
        let realized_yield_amount = pool_class_ledger.realized_yield_amount.get();
        let realized_loss_amount = pool_class_ledger.realized_loss_amount.get();
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

    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_mut() {
        let allocation_ledger = &mut **allocation_ledger;
        let mut sheet = allocation_ledger.sheet;
        quasar_book_owed(&mut sheet, amount)?;
        let allocation_position = allocation_ledger.allocation_position;
        let asset_mint = allocation_ledger.asset_mint;
        let realized_pnl = allocation_ledger.realized_pnl.get();
        let bump = allocation_ledger.bump;
        allocation_ledger.set_inner(allocation_position, asset_mint, sheet, realized_pnl, bump);
    }

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_obligation(
    ctx: Context<CreateObligation>,
    args: CreateObligationArgs,
) -> Result<()> {
    require_id(&args.obligation_id)?;
    require_plan_control(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;
    require!(
        ctx.accounts.funding_line.health_plan == ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        ctx.accounts.funding_line.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.funding_line.policy_series,
        args.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require_positive_amount(args.amount)?;
    validate_optional_series_ledger(
        ctx.accounts.series_reserve_ledger.as_deref(),
        args.policy_series,
        args.asset_mint,
    )?;
    validate_obligation_creation_scope(
        ctx.accounts.liquidity_pool.as_deref(),
        ctx.accounts.capital_class.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        &ctx.accounts.health_plan,
        ctx.accounts.funding_line.key(),
        &ctx.accounts.funding_line,
        args.liquidity_pool,
        args.capital_class,
        args.allocation_position,
    )?;
    require_supported_obligation_delivery_mode(args.delivery_mode)?;

    let obligation = &mut ctx.accounts.obligation;
    obligation.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    obligation.asset_mint = args.asset_mint;
    obligation.health_plan = ctx.accounts.health_plan.key();
    obligation.policy_series = args.policy_series;
    obligation.member_wallet = args.member_wallet;
    obligation.beneficiary = args.beneficiary;
    obligation.funding_line = ctx.accounts.funding_line.key();
    obligation.claim_case = args.claim_case;
    obligation.liquidity_pool = args.liquidity_pool;
    obligation.capital_class = args.capital_class;
    obligation.allocation_position = args.allocation_position;
    obligation.obligation_id = args.obligation_id;
    obligation.creation_reason_hash = args.creation_reason_hash;
    obligation.settlement_reason_hash = [0u8; 32];
    obligation.status = OBLIGATION_STATUS_PROPOSED;
    obligation.delivery_mode = args.delivery_mode;
    obligation.principal_amount = args.amount;
    obligation.outstanding_amount = args.amount;
    obligation.reserved_amount = 0;
    obligation.claimable_amount = 0;
    obligation.payable_amount = 0;
    obligation.settled_amount = 0;
    obligation.impaired_amount = 0;
    obligation.recovered_amount = 0;
    obligation.created_at = Clock::get()?.unix_timestamp;
    obligation.updated_at = obligation.created_at;
    obligation.bump = ctx.bumps.obligation;

    book_owed(&mut ctx.accounts.domain_asset_ledger.sheet, args.amount)?;
    book_owed(&mut ctx.accounts.plan_reserve_ledger.sheet, args.amount)?;
    book_owed(&mut ctx.accounts.funding_line_ledger.sheet, args.amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_owed(&mut series_ledger.sheet, args.amount)?;
    }

    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
        book_owed(&mut pool_class_ledger.sheet, args.amount)?;
    }

    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
        book_owed(&mut allocation_ledger.sheet, args.amount)?;
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount: obligation.principal_amount,
    });

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: CreateObligationArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        asset_mint: Pubkey,
        _policy_series_arg: Pubkey,
        _member_wallet: Pubkey,
        _beneficiary: Pubkey,
        _claim_case: Pubkey,
        _liquidity_pool_arg: Pubkey,
        _capital_class_arg: Pubkey,
        _allocation_position_arg: Pubkey,
        _delivery_mode: u8,
        _amount: u64,
        _creation_reason_hash: [u8; 32],
        obligation_id: String<u32, 32>
    )
)]
pub struct CreateObligation<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
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
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
            constraint = quasar_pda_matches(
                domain_asset_ledger.address(),
                &crate::ID,
                &[SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), asset_mint.as_ref()],
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
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
            constraint = quasar_pda_matches(
                plan_reserve_ledger.address(),
                &crate::ID,
                &[SEED_PLAN_RESERVE_LEDGER, health_plan.address().as_ref(), asset_mint.as_ref()],
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
    pub liquidity_pool: Option<Box<Account<'info, LiquidityPool>>>,
    #[cfg(feature = "quasar")]
    pub liquidity_pool: Option<Account<LiquidityPoolAccountData<'info>>>,
    #[cfg(not(feature = "quasar"))]
    pub capital_class: Option<Box<Account<'info, CapitalClass>>>,
    #[cfg(feature = "quasar")]
    pub capital_class: Option<Account<CapitalClassAccountData<'info>>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[cfg(feature = "quasar")]
    pub pool_class_ledger: Option<&'info mut Account<PoolClassLedger>>,
    #[cfg(not(feature = "quasar"))]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[cfg(feature = "quasar")]
    pub allocation_position: Option<&'info Account<AllocationPosition>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[cfg(feature = "quasar")]
    pub allocation_ledger: Option<&'info mut Account<AllocationLedger>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + Obligation::INIT_SPACE,
            seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), args.obligation_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub obligation: Box<Account<'info, Obligation>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                obligation.address(),
                &crate::ID,
                &[SEED_OBLIGATION, funding_line.address().as_ref(), obligation_id],
                obligation.bump,
            ) @ OmegaXProtocolError::ObligationMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub obligation: Account<ObligationAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
