// SPDX-License-Identifier: AGPL-3.0-or-later

//! Obligation reserve instruction handlers and account validation contexts.

use super::*;

#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
pub(crate) fn reserve_obligation(
    ctx: Context<ReserveObligation>,
    args: ReserveObligationArgs,
) -> Result<()> {
    let reserve_amount = args.amount;
    require_positive_amount(reserve_amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_reserve_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        obligation.status == OBLIGATION_STATUS_PROPOSED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        reserve_amount <= obligation.outstanding_amount,
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    validate_treasury_mutation_bindings(
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;
    require_obligation_reserve_capacity(&ctx.accounts.funding_line_ledger.sheet, reserve_amount)?;

    obligation.status = OBLIGATION_STATUS_RESERVED;
    obligation.reserved_amount = reserve_amount;
    obligation.updated_at = now_ts;

    ctx.accounts.funding_line.reserved_amount =
        checked_add(ctx.accounts.funding_line.reserved_amount, reserve_amount)?;
    book_reserve(&mut ctx.accounts.domain_asset_ledger.sheet, reserve_amount)?;
    book_reserve(&mut ctx.accounts.plan_reserve_ledger.sheet, reserve_amount)?;
    book_reserve(&mut ctx.accounts.funding_line_ledger.sheet, reserve_amount)?;

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        require_claim_proof_fingerprints(
            &claim_case.evidence_ref_hash,
            &claim_case.decision_support_hash,
        )?;
        let claim_case_key = claim_case.key();
        sync_linked_claim_case_reserve(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            ctx.accounts.health_plan.key(),
            now_ts,
        )?;
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount: reserve_amount,
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
#[inline(always)]
fn quasar_checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
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
fn quasar_book_reserve(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = quasar_checked_add(sheet.reserved, amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
fn quasar_release_reserved_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = quasar_checked_sub(sheet.reserved, amount)?;
    quasar_recompute_sheet(sheet)
}

#[cfg(feature = "quasar")]
fn require_quasar_obligation_reserve_capacity(
    line_sheet: &ReserveBalanceSheet,
    amount: u64,
) -> Result<()> {
    require!(
        line_sheet.free >= amount,
        OmegaXProtocolError::InsufficientFreeReserveCapacity
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_obligation_reserve_control(
    authority: &Pubkey,
    plan: &HealthPlanAccountData<'_>,
    obligation: &ObligationAccountData<'_>,
) -> Result<()> {
    if obligation.claim_case != ZERO_PUBKEY {
        if *authority == plan.oracle_authority
            || *authority == plan.claims_operator
            || *authority == plan.plan_admin
        {
            return Ok(());
        }
    } else if *authority == plan.plan_admin || *authority == plan.sponsor_operator {
        return Ok(());
    }

    err!(OmegaXProtocolError::Unauthorized)
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
pub(crate) fn reserve_obligation<'info>(
    ctx: &mut Ctx<'info, ReserveObligation<'info>>,
    reserve_amount: u64,
) -> Result<()> {
    require_quasar_positive_amount(reserve_amount)?;
    let now_ts = Clock::get()?.unix_timestamp.get();
    let obligation_key = *ctx.accounts.obligation.address();
    let authority = *ctx.accounts.authority.address();
    require_quasar_obligation_reserve_control(
        &authority,
        &ctx.accounts.health_plan,
        &ctx.accounts.obligation,
    )?;
    require!(
        ctx.accounts.obligation.status == OBLIGATION_STATUS_PROPOSED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        reserve_amount <= ctx.accounts.obligation.outstanding_amount.get(),
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );

    validate_quasar_treasury_mutation_bindings(
        &ctx.accounts.obligation,
        *ctx.accounts.funding_line.address(),
        ctx.accounts.funding_line.asset_mint,
    )?;
    require_quasar_obligation_reserve_capacity(
        &ctx.accounts.funding_line_ledger.sheet,
        reserve_amount,
    )?;

    let linked_claim_case = if let Some(claim_case) = ctx.accounts.claim_case.as_ref() {
        let claim_case_key = *claim_case.address();
        require_quasar_matching_linked_claim_case(
            claim_case,
            claim_case_key,
            &ctx.accounts.obligation,
            obligation_key,
            *ctx.accounts.health_plan.address(),
        )?;
        require!(
            !claim_case.evidence_ref_hash.iter().all(|byte| *byte == 0)
                && !claim_case
                    .decision_support_hash
                    .iter()
                    .all(|byte| *byte == 0),
            OmegaXProtocolError::ClaimProofFingerprintRequired
        );
        claim_case_key
    } else {
        ctx.accounts.obligation.claim_case
    };

    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.funding_line_ledger.sheet;
    quasar_book_reserve(&mut domain_sheet, reserve_amount)?;
    quasar_book_reserve(&mut plan_sheet, reserve_amount)?;
    quasar_book_reserve(&mut funding_line_sheet, reserve_amount)?;

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

    let obligation = &mut ctx.accounts.obligation;
    let reserve_domain = obligation.reserve_domain;
    let asset_mint = obligation.asset_mint;
    let health_plan = obligation.health_plan;
    let policy_series = obligation.policy_series;
    let member_wallet = obligation.member_wallet;
    let beneficiary = obligation.beneficiary;
    let funding_line = obligation.funding_line;
    let creation_reason_hash = obligation.creation_reason_hash;
    let settlement_reason_hash = obligation.settlement_reason_hash;
    let delivery_mode = obligation.delivery_mode;
    let principal_amount = obligation.principal_amount.get();
    let outstanding_amount = obligation.outstanding_amount.get();
    let claimable_amount = obligation.claimable_amount.get();
    let payable_amount = obligation.payable_amount.get();
    let settled_amount = obligation.settled_amount.get();
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
        linked_claim_case,
        creation_reason_hash,
        settlement_reason_hash,
        OBLIGATION_STATUS_RESERVED,
        delivery_mode,
        principal_amount,
        outstanding_amount,
        reserve_amount,
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

    let funding_line = &mut ctx.accounts.funding_line;
    let reserve_domain = funding_line.reserve_domain;
    let health_plan = funding_line.health_plan;
    let policy_series = funding_line.policy_series;
    let asset_mint = funding_line.asset_mint;
    let line_type = funding_line.line_type;
    let funding_priority = funding_line.funding_priority;
    let committed_amount = funding_line.committed_amount.get();
    let funded_amount = funding_line.funded_amount.get();
    let reserved_amount = quasar_checked_add(funding_line.reserved_amount.get(), reserve_amount)?;
    let spent_amount = funding_line.spent_amount.get();
    let released_amount = funding_line.released_amount.get();
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

    if let Some(claim_case) = ctx.accounts.claim_case.as_mut() {
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
        let intake_status = claim_case.intake_status;
        let review_state = claim_case.review_state;
        let approved_amount = claim_case.approved_amount.get();
        let denied_amount = claim_case.denied_amount.get();
        let paid_amount = claim_case.paid_amount.get();
        let recovered_amount = claim_case.recovered_amount.get();
        let appeal_count = claim_case.appeal_count.get();
        let opened_at = claim_case.opened_at.get();
        let closed_at = claim_case.closed_at.get();
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
            reserve_amount,
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
    }

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn release_reserve<'info>(
    ctx: &mut Ctx<'info, ReleaseReserve<'info>>,
    amount: u64,
) -> Result<()> {
    require_quasar_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp.get();
    let obligation_key = *ctx.accounts.obligation.address();
    let authority = *ctx.accounts.authority.address();
    require_quasar_obligation_reserve_control(
        &authority,
        &ctx.accounts.health_plan,
        &ctx.accounts.obligation,
    )?;
    require!(
        ctx.accounts.obligation.status == OBLIGATION_STATUS_RESERVED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        amount <= ctx.accounts.obligation.reserved_amount.get(),
        OmegaXProtocolError::AmountExceedsReservedBalance
    );

    validate_quasar_treasury_mutation_bindings(
        &ctx.accounts.obligation,
        *ctx.accounts.funding_line.address(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    let linked_claim_case = if let Some(claim_case) = ctx.accounts.claim_case.as_ref() {
        let claim_case_key = *claim_case.address();
        require_quasar_matching_linked_claim_case(
            claim_case,
            claim_case_key,
            &ctx.accounts.obligation,
            obligation_key,
            *ctx.accounts.health_plan.address(),
        )?;
        claim_case_key
    } else {
        ctx.accounts.obligation.claim_case
    };

    let new_obligation_reserved_amount =
        quasar_checked_sub(ctx.accounts.obligation.reserved_amount.get(), amount)?;
    let new_obligation_outstanding_amount =
        quasar_checked_sub(ctx.accounts.obligation.outstanding_amount.get(), amount)?;
    let next_obligation_status = if new_obligation_reserved_amount == 0 {
        OBLIGATION_STATUS_CANCELED
    } else {
        OBLIGATION_STATUS_RESERVED
    };
    let new_funding_line_reserved_amount =
        quasar_checked_sub(ctx.accounts.funding_line.reserved_amount.get(), amount)?;
    let new_funding_line_released_amount =
        quasar_checked_add(ctx.accounts.funding_line.released_amount.get(), amount)?;

    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.funding_line_ledger.sheet;
    quasar_release_reserved_sheet(&mut domain_sheet, amount)?;
    quasar_release_reserved_sheet(&mut plan_sheet, amount)?;
    quasar_release_reserved_sheet(&mut funding_line_sheet, amount)?;

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

    let obligation = &mut ctx.accounts.obligation;
    let reserve_domain = obligation.reserve_domain;
    let asset_mint = obligation.asset_mint;
    let health_plan = obligation.health_plan;
    let policy_series = obligation.policy_series;
    let member_wallet = obligation.member_wallet;
    let beneficiary = obligation.beneficiary;
    let funding_line = obligation.funding_line;
    let creation_reason_hash = obligation.creation_reason_hash;
    let settlement_reason_hash = obligation.settlement_reason_hash;
    let delivery_mode = obligation.delivery_mode;
    let principal_amount = obligation.principal_amount.get();
    let claimable_amount = obligation.claimable_amount.get();
    let payable_amount = obligation.payable_amount.get();
    let settled_amount = obligation.settled_amount.get();
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
        linked_claim_case,
        creation_reason_hash,
        settlement_reason_hash,
        next_obligation_status,
        delivery_mode,
        principal_amount,
        new_obligation_outstanding_amount,
        new_obligation_reserved_amount,
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

    let funding_line = &mut ctx.accounts.funding_line;
    let reserve_domain = funding_line.reserve_domain;
    let health_plan = funding_line.health_plan;
    let policy_series = funding_line.policy_series;
    let asset_mint = funding_line.asset_mint;
    let line_type = funding_line.line_type;
    let funding_priority = funding_line.funding_priority;
    let committed_amount = funding_line.committed_amount.get();
    let funded_amount = funding_line.funded_amount.get();
    let spent_amount = funding_line.spent_amount.get();
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
        new_funding_line_reserved_amount,
        spent_amount,
        new_funding_line_released_amount,
        returned_amount,
        status,
        caps_hash,
        bump,
        &line_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    if let Some(claim_case) = ctx.accounts.claim_case.as_mut() {
        let should_close_claim = next_obligation_status == OBLIGATION_STATUS_CANCELED
            && new_obligation_outstanding_amount == 0;
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
        let intake_status = if should_close_claim {
            CLAIM_INTAKE_CLOSED
        } else {
            claim_case.intake_status
        };
        let review_state = claim_case.review_state;
        let approved_amount = claim_case.approved_amount.get();
        let denied_amount = claim_case.denied_amount.get();
        let paid_amount = claim_case.paid_amount.get();
        let recovered_amount = claim_case.recovered_amount.get();
        let appeal_count = claim_case.appeal_count.get();
        let opened_at = claim_case.opened_at.get();
        let closed_at = if should_close_claim {
            now_ts
        } else {
            claim_case.closed_at.get()
        };
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
            new_obligation_reserved_amount,
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
    }

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn release_reserve(
    ctx: Context<ReleaseReserve>,
    args: ReleaseReserveArgs,
) -> Result<()> {
    let amount = args.amount;
    require_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_reserve_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        obligation.status == OBLIGATION_STATUS_RESERVED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        amount <= obligation.reserved_amount,
        OmegaXProtocolError::AmountExceedsReservedBalance
    );
    validate_treasury_mutation_bindings(
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    obligation.reserved_amount = checked_sub(obligation.reserved_amount, amount)?;
    obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
    obligation.status = if obligation.reserved_amount == 0 {
        OBLIGATION_STATUS_CANCELED
    } else {
        OBLIGATION_STATUS_RESERVED
    };
    obligation.updated_at = now_ts;

    ctx.accounts.funding_line.reserved_amount =
        checked_sub(ctx.accounts.funding_line.reserved_amount, amount)?;
    ctx.accounts.funding_line.released_amount =
        checked_add(ctx.accounts.funding_line.released_amount, amount)?;

    release_reserved_scoped(
        &mut ctx.accounts.domain_asset_ledger.sheet,
        &mut ctx.accounts.plan_reserve_ledger.sheet,
        &mut ctx.accounts.funding_line_ledger.sheet,
        amount,
    )?;

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        let claim_case_key = claim_case.key();
        sync_linked_claim_case_reserve(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            ctx.accounts.health_plan.key(),
            now_ts,
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ReserveObligation<'info> {
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
}
#[derive(Accounts)]
pub struct ReleaseReserve<'info> {
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
}
