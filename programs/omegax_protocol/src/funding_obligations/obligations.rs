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
fn validate_quasar_obligation_creation_scope(
    health_plan: &Account<HealthPlanAccountData<'_>>,
    funding_line: &FundingLineAccountData<'_>,
) -> Result<()> {
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
    require!(
        is_supported_funding_line_type(funding_line.line_type),
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn create_obligation<'info>(
    ctx: &mut Ctx<'info, CreateObligation<'info>>,
    asset_mint: Pubkey,
    policy_series: Pubkey,
    member_wallet: Pubkey,
    beneficiary: Pubkey,
    claim_case: Pubkey,
    delivery_mode: u8,
    amount: u64,
    creation_reason_hash: [u8; 32],
    obligation_id: &str,
) -> Result<()> {
    require_quasar_id(obligation_id)?;
    let authority = *ctx.accounts.authority.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
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

    validate_quasar_obligation_creation_scope(
        &ctx.accounts.health_plan,
        &ctx.accounts.funding_line,
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
        *ctx.accounts.funding_line.address(),
        claim_case,
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
    validate_obligation_creation_scope(&ctx.accounts.health_plan, &ctx.accounts.funding_line)?;
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
