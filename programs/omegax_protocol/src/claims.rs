// SPDX-License-Identifier: AGPL-3.0-or-later

//! Claim lifecycle instruction handlers and account validation contexts.

#[cfg(not(feature = "quasar"))]
use crate::classic_token::{Mint, TokenAccount, TokenInterface};
use crate::platform::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

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
fn require_quasar_health_plan_active(plan: &HealthPlanAccountData<'_>) -> Result<()> {
    require!(plan.active.get(), OmegaXProtocolError::HealthPlanInactive);
    Ok(())
}

#[cfg(feature = "quasar")]
fn require_quasar_claim_operator(
    authority: &Pubkey,
    plan: &HealthPlanAccountData<'_>,
) -> Result<()> {
    if *authority == plan.claims_operator || *authority == plan.plan_admin {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
fn require_quasar_claim_intake_submitter(
    authority: &Pubkey,
    plan: &HealthPlanAccountData<'_>,
    claimant: Pubkey,
) -> Result<()> {
    let claimant_present = claimant != ZERO_PUBKEY;
    let claimant_self_submit = *authority == claimant && claimant_present;
    let operator_submit =
        (*authority == plan.claims_operator || *authority == plan.plan_admin) && claimant_present;

    if claimant_self_submit || operator_submit {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
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
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn quasar_claim_proof_hash_is_zero(hash: &[u8; 32]) -> bool {
    hash.iter().all(|byte| *byte == 0)
}

#[cfg(feature = "quasar")]
fn require_quasar_claim_proof_fingerprints(
    evidence_ref_hash: &[u8; 32],
    decision_support_hash: &[u8; 32],
) -> Result<()> {
    require!(
        !quasar_claim_proof_hash_is_zero(evidence_ref_hash)
            && !quasar_claim_proof_hash_is_zero(decision_support_hash),
        OmegaXProtocolError::ClaimProofFingerprintRequired
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn resolve_quasar_claim_proof_fingerprints(
    claim_case: &ClaimCaseAccountData<'_>,
    evidence_ref_hash: [u8; 32],
    decision_support_hash: [u8; 32],
    requires_final_proof: bool,
    proof_locked: bool,
) -> Result<([u8; 32], [u8; 32])> {
    if proof_locked {
        require!(
            quasar_claim_proof_hash_is_zero(&evidence_ref_hash)
                || quasar_claim_proof_hash_is_zero(&claim_case.evidence_ref_hash)
                || evidence_ref_hash == claim_case.evidence_ref_hash,
            OmegaXProtocolError::ClaimProofFingerprintLocked
        );
        require!(
            quasar_claim_proof_hash_is_zero(&decision_support_hash)
                || quasar_claim_proof_hash_is_zero(&claim_case.decision_support_hash)
                || decision_support_hash == claim_case.decision_support_hash,
            OmegaXProtocolError::ClaimProofFingerprintLocked
        );
    }

    let final_evidence_ref_hash = if quasar_claim_proof_hash_is_zero(&evidence_ref_hash) {
        claim_case.evidence_ref_hash
    } else {
        evidence_ref_hash
    };
    let final_decision_support_hash = if quasar_claim_proof_hash_is_zero(&decision_support_hash) {
        claim_case.decision_support_hash
    } else {
        decision_support_hash
    };

    if requires_final_proof {
        require_quasar_claim_proof_fingerprints(
            &final_evidence_ref_hash,
            &final_decision_support_hash,
        )?;
    }

    Ok((final_evidence_ref_hash, final_decision_support_hash))
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
#[inline(always)]
fn require_quasar_direct_claim_case_settlement(
    claim_case: &ClaimCaseAccountData<'_>,
) -> Result<()> {
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY,
        OmegaXProtocolError::LinkedClaimMustSettleThroughObligation
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn validate_quasar_direct_claim_settlement_bindings(
    claim_case: &ClaimCaseAccountData<'_>,
    funding_line_key: Pubkey,
    funding_line_asset_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        claim_case.funding_line,
        funding_line_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        claim_case.asset_mint,
        funding_line_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_free_reserve_capacity(sheet: &ReserveBalanceSheet, amount: u64) -> Result<()> {
    require!(
        sheet.free >= amount,
        OmegaXProtocolError::InsufficientFreeReserveCapacity
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn book_quasar_direct_claim_payout(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    funding_spent_amount: &mut u64,
    amount: u64,
) -> Result<()> {
    require_quasar_free_reserve_capacity(domain_sheet, amount)?;
    require_quasar_free_reserve_capacity(plan_sheet, amount)?;
    require_quasar_free_reserve_capacity(line_sheet, amount)?;

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
    *funding_spent_amount = checked_add(*funding_spent_amount, amount)?;
    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn open_claim_case(ctx: Context<OpenClaimCase>, args: OpenClaimCaseArgs) -> Result<()> {
    require_id(&args.claim_id)?;
    require_health_plan_active(&ctx.accounts.health_plan)?;
    require!(
        ctx.accounts.health_plan.pause_flags & PAUSE_FLAG_CLAIM_INTAKE == 0,
        OmegaXProtocolError::ClaimIntakePaused
    );
    require_claim_intake_submitter(
        &ctx.accounts.authority.key(),
        &ctx.accounts.health_plan,
        args.claimant,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    claim_case.health_plan = ctx.accounts.health_plan.key();
    claim_case.policy_series = args.policy_series;
    claim_case.funding_line = ctx.accounts.funding_line.key();
    claim_case.asset_mint = ctx.accounts.funding_line.asset_mint;
    claim_case.claim_id = args.claim_id;
    claim_case.claimant = args.claimant;
    claim_case.adjudicator = ZERO_PUBKEY;
    claim_case.delegate_recipient = ZERO_PUBKEY;
    claim_case.evidence_ref_hash = args.evidence_ref_hash;
    claim_case.decision_support_hash = [0u8; 32];
    claim_case.intake_status = CLAIM_INTAKE_OPEN;
    claim_case.review_state = 0;
    claim_case.approved_amount = 0;
    claim_case.denied_amount = 0;
    claim_case.paid_amount = 0;
    claim_case.reserved_amount = 0;
    claim_case.recovered_amount = 0;
    claim_case.appeal_count = 0;
    claim_case.linked_obligation = ZERO_PUBKEY;
    claim_case.opened_at = Clock::get()?.unix_timestamp;
    claim_case.updated_at = claim_case.opened_at;
    claim_case.closed_at = 0;
    claim_case.bump = ctx.bumps.claim_case;

    emit!(ClaimCaseStateChangedEvent {
        claim_case: claim_case.key(),
        intake_status: claim_case.intake_status,
        approved_amount: claim_case.approved_amount,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn open_claim_case<'info>(
    ctx: &mut Ctx<'info, OpenClaimCase<'info>>,
    policy_series: Pubkey,
    claimant: Pubkey,
    evidence_ref_hash: [u8; 32],
    claim_id: &str,
) -> Result<()> {
    require_quasar_id(claim_id)?;
    require_quasar_health_plan_active(&ctx.accounts.health_plan)?;
    require!(
        ctx.accounts.health_plan.pause_flags.get() & PAUSE_FLAG_CLAIM_INTAKE == 0,
        OmegaXProtocolError::ClaimIntakePaused
    );
    let authority = *ctx.accounts.authority.address();
    require_quasar_claim_intake_submitter(&authority, &ctx.accounts.health_plan, claimant)?;

    let opened_at = Clock::get()?.unix_timestamp.get();
    let claim_case_bump = ctx.accounts.claim_case.bump;
    ctx.accounts.claim_case.set_inner(
        ctx.accounts.health_plan.reserve_domain,
        *ctx.accounts.health_plan.address(),
        policy_series,
        *ctx.accounts.funding_line.address(),
        ctx.accounts.funding_line.asset_mint,
        claimant,
        ZERO_PUBKEY,
        ZERO_PUBKEY,
        evidence_ref_hash,
        [0u8; 32],
        CLAIM_INTAKE_OPEN,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        ZERO_PUBKEY,
        opened_at,
        opened_at,
        0,
        claim_case_bump,
        claim_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn authorize_claim_recipient(
    ctx: Context<AuthorizeClaimRecipient>,
    args: AuthorizeClaimRecipientArgs,
) -> Result<()> {
    // The account context binds authority to claim_case.claimant, so reaching
    // this body means the claimant of record signed.
    let claim_case = &mut ctx.accounts.claim_case;
    require!(
        claim_case.intake_status < CLAIM_INTAKE_APPROVED && claim_case.paid_amount == 0,
        OmegaXProtocolError::ClaimRecipientLocked
    );
    claim_case.delegate_recipient = args.delegate_recipient;
    claim_case.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn authorize_claim_recipient<'info>(
    ctx: &mut Ctx<'info, AuthorizeClaimRecipient<'info>>,
    delegate_recipient: Pubkey,
) -> Result<()> {
    let claim_case = &mut ctx.accounts.claim_case;
    require!(
        claim_case.intake_status < CLAIM_INTAKE_APPROVED && claim_case.paid_amount.get() == 0,
        OmegaXProtocolError::ClaimRecipientLocked
    );

    let updated_at = Clock::get()?.unix_timestamp.get();
    let reserve_domain = claim_case.reserve_domain;
    let health_plan = claim_case.health_plan;
    let policy_series = claim_case.policy_series;
    let funding_line = claim_case.funding_line;
    let asset_mint = claim_case.asset_mint;
    let claimant = claim_case.claimant;
    let adjudicator = claim_case.adjudicator;
    let evidence_ref_hash = claim_case.evidence_ref_hash;
    let decision_support_hash = claim_case.decision_support_hash;
    let intake_status = claim_case.intake_status;
    let review_state = claim_case.review_state;
    let approved_amount = claim_case.approved_amount.get();
    let denied_amount = claim_case.denied_amount.get();
    let paid_amount = claim_case.paid_amount.get();
    let reserved_amount = claim_case.reserved_amount.get();
    let recovered_amount = claim_case.recovered_amount.get();
    let appeal_count = claim_case.appeal_count.get();
    let linked_obligation = claim_case.linked_obligation;
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
        reserved_amount,
        recovered_amount,
        appeal_count,
        linked_obligation,
        opened_at,
        updated_at,
        closed_at,
        bump,
        &claim_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn adjudicate_claim_case(
    ctx: Context<AdjudicateClaimCase>,
    args: AdjudicateClaimCaseArgs,
) -> Result<()> {
    require_claim_operator(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;
    require!(
        args.reserve_amount <= args.approved_amount,
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );

    let claim_case = &mut ctx.accounts.claim_case;
    let adjudication_obligation = ctx.accounts.obligation.as_ref().map(|obligation| {
        let obligation: &ObligationAccountData<'_> = obligation;
        obligation
    });
    require_claim_adjudication_mutable(claim_case, adjudication_obligation)?;
    let obligation_has_money_state = adjudication_obligation
        .map(|obligation| obligation.reserved_amount > 0 || obligation.settled_amount > 0)
        .unwrap_or(false);
    let (evidence_ref_hash, decision_support_hash) = resolve_claim_proof_fingerprints(
        claim_case,
        args.evidence_ref_hash,
        args.decision_support_hash,
        args.approved_amount > 0 || args.reserve_amount > 0 || obligation_has_money_state,
        claim_case.reserved_amount > 0 || claim_case.paid_amount > 0 || obligation_has_money_state,
    )?;
    let claim_case_key = claim_case.key();
    claim_case.adjudicator = ctx.accounts.authority.key();
    claim_case.evidence_ref_hash = evidence_ref_hash;
    claim_case.decision_support_hash = decision_support_hash;
    claim_case.review_state = args.review_state;
    claim_case.approved_amount = args.approved_amount;
    claim_case.denied_amount = args.denied_amount;
    claim_case.intake_status = if args.approved_amount > 0 {
        CLAIM_INTAKE_APPROVED
    } else {
        CLAIM_INTAKE_DENIED
    };
    claim_case.updated_at = Clock::get()?.unix_timestamp;

    if let Some(obligation) = ctx.accounts.obligation.as_deref_mut() {
        let obligation_key = obligation.key();
        sync_adjudicated_claim_liability(
            claim_case,
            claim_case_key,
            Some((obligation, obligation_key)),
            ctx.accounts.health_plan.key(),
            args.approved_amount,
            args.reserve_amount,
        )?;
    } else {
        sync_adjudicated_claim_liability(
            claim_case,
            claim_case_key,
            None,
            ctx.accounts.health_plan.key(),
            args.approved_amount,
            args.reserve_amount,
        )?;
    }

    emit!(ClaimCaseStateChangedEvent {
        claim_case: claim_case.key(),
        intake_status: claim_case.intake_status,
        approved_amount: claim_case.approved_amount,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
fn require_quasar_claim_adjudication_mutable(
    claim_case: &ClaimCaseAccountData<'_>,
    obligation: Option<&ObligationAccountData<'_>>,
) -> Result<()> {
    require!(
        claim_case.paid_amount.get() == 0 && claim_case.intake_status < CLAIM_INTAKE_SETTLED,
        OmegaXProtocolError::ClaimAdjudicationLocked
    );
    if let Some(obligation) = obligation {
        require!(
            obligation.status < OBLIGATION_STATUS_SETTLED && obligation.settled_amount.get() == 0,
            OmegaXProtocolError::ClaimAdjudicationLocked
        );
    }
    Ok(())
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
pub(crate) fn adjudicate_claim_case<'info>(
    ctx: &mut Ctx<'info, AdjudicateClaimCase<'info>>,
    review_state: u8,
    approved_amount: u64,
    denied_amount: u64,
    reserve_amount: u64,
    evidence_ref_hash: [u8; 32],
    decision_support_hash: [u8; 32],
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_claim_operator(&authority, &ctx.accounts.health_plan)?;
    require!(
        reserve_amount <= approved_amount,
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );

    let claim_case_key = *ctx.accounts.claim_case.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
    let now_ts = Clock::get()?.unix_timestamp.get();
    let intake_status = if approved_amount > 0 {
        CLAIM_INTAKE_APPROVED
    } else {
        CLAIM_INTAKE_DENIED
    };

    require_quasar_claim_adjudication_mutable(
        &ctx.accounts.claim_case,
        ctx.accounts
            .obligation
            .as_ref()
            .map(|obligation| &**obligation),
    )?;
    let obligation_has_money_state = ctx
        .accounts
        .obligation
        .as_ref()
        .map(|obligation| {
            obligation.reserved_amount.get() > 0 || obligation.settled_amount.get() > 0
        })
        .unwrap_or(false);
    let (evidence_ref_hash, decision_support_hash) = resolve_quasar_claim_proof_fingerprints(
        &ctx.accounts.claim_case,
        evidence_ref_hash,
        decision_support_hash,
        approved_amount > 0 || reserve_amount > 0 || obligation_has_money_state,
        ctx.accounts.claim_case.reserved_amount.get() > 0
            || ctx.accounts.claim_case.paid_amount.get() > 0
            || obligation_has_money_state,
    )?;

    let (linked_obligation, adjudicated_reserved_amount) =
        if let Some(obligation) = ctx.accounts.obligation.as_mut() {
            let obligation_key = *obligation.address();
            require_quasar_matching_linked_claim_case(
                &ctx.accounts.claim_case,
                claim_case_key,
                obligation,
                obligation_key,
                health_plan_key,
            )?;
            require!(
                obligation.reserved_amount.get() <= approved_amount,
                OmegaXProtocolError::AmountExceedsApprovedClaim
            );

            let reserve_domain = obligation.reserve_domain;
            let asset_mint = obligation.asset_mint;
            let health_plan = obligation.health_plan;
            let policy_series = obligation.policy_series;
            let member_wallet = obligation.member_wallet;
            let beneficiary = obligation.beneficiary;
            let funding_line = obligation.funding_line;
            let creation_reason_hash = obligation.creation_reason_hash;
            let settlement_reason_hash = obligation.settlement_reason_hash;
            let status = obligation.status;
            let delivery_mode = obligation.delivery_mode;
            let principal_amount = obligation.principal_amount.get();
            let outstanding_amount = obligation.outstanding_amount.get();
            let reserved_amount = obligation.reserved_amount.get();
            let claimable_amount = obligation.claimable_amount.get();
            let payable_amount = obligation.payable_amount.get();
            let settled_amount = obligation.settled_amount.get();
            let impaired_amount = obligation.impaired_amount.get();
            let recovered_amount = obligation.recovered_amount.get();
            let created_at = obligation.created_at.get();
            let updated_at = obligation.updated_at.get();
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
                claim_case_key,
                creation_reason_hash,
                settlement_reason_hash,
                status,
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
                updated_at,
                bump,
                &obligation_id,
                ctx.accounts.authority.to_account_view(),
                None,
            )?;

            (obligation_key, reserved_amount)
        } else {
            require!(
                ctx.accounts.claim_case.linked_obligation == ZERO_PUBKEY,
                OmegaXProtocolError::ClaimCaseLinkMismatch
            );
            require!(
                reserve_amount == 0,
                OmegaXProtocolError::DirectClaimReserveUnsupported
            );
            (ZERO_PUBKEY, 0)
        };

    let claim_case = &mut ctx.accounts.claim_case;
    let reserve_domain = claim_case.reserve_domain;
    let health_plan = claim_case.health_plan;
    let policy_series = claim_case.policy_series;
    let funding_line = claim_case.funding_line;
    let asset_mint = claim_case.asset_mint;
    let claimant = claim_case.claimant;
    let delegate_recipient = claim_case.delegate_recipient;
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
        authority,
        delegate_recipient,
        evidence_ref_hash,
        decision_support_hash,
        intake_status,
        review_state,
        approved_amount,
        denied_amount,
        paid_amount,
        adjudicated_reserved_amount,
        recovered_amount,
        appeal_count,
        linked_obligation,
        opened_at,
        now_ts,
        closed_at,
        bump,
        &claim_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn settle_claim_case(
    ctx: Context<SettleClaimCase>,
    args: SettleClaimCaseArgs,
) -> Result<()> {
    require_claim_operator(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;
    require_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
    require!(
        args.amount <= remaining_claim_amount(&ctx.accounts.claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );
    require_claim_proof_fingerprints(
        &ctx.accounts.claim_case.evidence_ref_hash,
        &ctx.accounts.claim_case.decision_support_hash,
    )?;
    require_positive_amount(args.amount)?;
    validate_direct_claim_settlement_bindings(
        &ctx.accounts.claim_case,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    // PT-2026-04-27-01/02 fix: resolve the SPL recipient before mutating
    // the claim_case (Pubkey is Copy so we capture by value).
    let resolved_recipient = resolve_claim_settlement_recipient(&ctx.accounts.claim_case);
    require_keys_eq!(
        ctx.accounts.recipient_token_account.owner,
        resolved_recipient,
        OmegaXProtocolError::Unauthorized
    );

    let amount = args.amount;

    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.paid_amount = checked_add(claim_case.paid_amount, amount)?;
    claim_case.reserved_amount = claim_case.reserved_amount.saturating_sub(amount);
    claim_case.intake_status = if claim_case.paid_amount >= claim_case.approved_amount {
        CLAIM_INTAKE_SETTLED
    } else {
        CLAIM_INTAKE_APPROVED
    };
    claim_case.closed_at = if claim_case.intake_status == CLAIM_INTAKE_SETTLED {
        Clock::get()?.unix_timestamp
    } else {
        0
    };
    claim_case.updated_at = Clock::get()?.unix_timestamp;

    // Book the full direct-claim payout from free reserve. Only linked
    // obligations may consume claimable/payable delivery buckets; direct
    // claims have no reserved delivery ledger to settle from.
    book_direct_claim_payout(
        &mut ctx.accounts.domain_asset_vault.total_assets,
        &mut ctx.accounts.domain_asset_ledger.sheet,
        &mut ctx.accounts.plan_reserve_ledger.sheet,
        &mut ctx.accounts.funding_line_ledger.sheet,
        &mut ctx.accounts.funding_line,
        amount,
    )?;

    // PT-01/02 fix: actually move the SPL tokens. The vault token account
    // is owned by the domain_asset_vault PDA, which signs via seeds.
    transfer_from_domain_vault(
        amount,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;

    let claim_case_key = ctx.accounts.claim_case.key();
    let intake_status = ctx.accounts.claim_case.intake_status;
    let approved_amount = ctx.accounts.claim_case.approved_amount;
    emit!(ClaimCaseStateChangedEvent {
        claim_case: claim_case_key,
        intake_status,
        approved_amount,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn settle_claim_case<'info>(
    ctx: &mut Ctx<'info, SettleClaimCase<'info>>,
    amount: u64,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    let funding_line_key = *ctx.accounts.funding_line.address();
    require_quasar_claim_operator(&authority, &ctx.accounts.health_plan)?;
    require_quasar_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
    let now_ts = Clock::get()?.unix_timestamp.get();
    require!(
        amount <= quasar_remaining_claim_amount(&ctx.accounts.claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );
    require_quasar_claim_proof_fingerprints(
        &ctx.accounts.claim_case.evidence_ref_hash,
        &ctx.accounts.claim_case.decision_support_hash,
    )?;
    require_quasar_positive_amount(amount)?;

    validate_quasar_direct_claim_settlement_bindings(
        &ctx.accounts.claim_case,
        funding_line_key,
        ctx.accounts.funding_line.asset_mint,
    )?;

    let resolved_recipient = if ctx.accounts.claim_case.delegate_recipient != ZERO_PUBKEY {
        ctx.accounts.claim_case.delegate_recipient
    } else {
        ctx.accounts.claim_case.claimant
    };
    require_keys_eq!(
        *ctx.accounts.recipient_token_account.owner(),
        resolved_recipient,
        OmegaXProtocolError::Unauthorized
    );

    let mut domain_total_assets = ctx.accounts.domain_asset_vault.total_assets.get();
    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.funding_line_ledger.sheet;
    let mut funding_spent_amount = ctx.accounts.funding_line.spent_amount.get();
    book_quasar_direct_claim_payout(
        &mut domain_total_assets,
        &mut domain_sheet,
        &mut plan_sheet,
        &mut funding_line_sheet,
        &mut funding_spent_amount,
        amount,
    )?;

    transfer_from_domain_vault(
        amount,
        ctx.accounts.domain_asset_vault,
        ctx.accounts.vault_token_account,
        ctx.accounts.recipient_token_account,
        ctx.accounts.asset_mint,
        ctx.accounts.token_program,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
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
    let paid_amount = checked_add(claim_case.paid_amount.get(), amount)?;
    let reserved_amount = claim_case.reserved_amount.get().saturating_sub(amount);
    let recovered_amount = claim_case.recovered_amount.get();
    let appeal_count = claim_case.appeal_count.get();
    let linked_obligation = claim_case.linked_obligation;
    let opened_at = claim_case.opened_at.get();
    let intake_status = if paid_amount >= approved_amount {
        CLAIM_INTAKE_SETTLED
    } else {
        CLAIM_INTAKE_APPROVED
    };
    let closed_at = if intake_status == CLAIM_INTAKE_SETTLED {
        now_ts
    } else {
        0
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
        reserved_amount,
        recovered_amount,
        appeal_count,
        linked_obligation,
        opened_at,
        now_ts,
        closed_at,
        bump,
        &claim_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

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
    let reserved_amount = funding_line.reserved_amount.get();
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
        funding_spent_amount,
        released_amount,
        returned_amount,
        status,
        caps_hash,
        bump,
        &line_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: OpenClaimCaseArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        policy_series: Pubkey,
        _claimant: Pubkey,
        _evidence_ref_hash: [u8; 32],
        claim_id: String<u32, 32>
    )
)]
pub struct OpenClaimCase<'info> {
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
    #[account(
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()],
        bump = funding_line.bump,
        constraint = funding_line.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = funding_line.policy_series == args.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = funding_line.status == FUNDING_LINE_STATUS_OPEN @ OmegaXProtocolError::FundingLineMismatch,
    )]
    #[cfg(not(feature = "quasar"))]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            funding_line.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE, health_plan.address().as_ref(), funding_line.line_id().as_bytes()],
            funding_line.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch,
        constraint = funding_line.health_plan == *health_plan.address() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = funding_line.policy_series == policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = funding_line.status == FUNDING_LINE_STATUS_OPEN @ OmegaXProtocolError::FundingLineMismatch,
    )]
    pub funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + ClaimCase::INIT_SPACE,
            seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), args.claim_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub claim_case: Box<Account<'info, ClaimCase>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                claim_case.address(),
                &crate::ID,
                &[SEED_CLAIM_CASE, health_plan.address().as_ref(), claim_id],
                claim_case.bump,
            ) @ OmegaXProtocolError::ClaimCaseLinkMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub claim_case: Account<ClaimCaseAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct AuthorizeClaimRecipient<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[account(
        mut,
        seeds = [SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id.as_bytes()],
        bump = claim_case.bump,
        constraint = claim_case.claimant == authority.key() @ OmegaXProtocolError::Unauthorized,
    )]
    #[cfg(not(feature = "quasar"))]
    pub claim_case: Box<Account<'info, ClaimCase>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            claim_case.address(),
            &crate::ID,
            &[SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id().as_bytes()],
            claim_case.bump,
        ) @ OmegaXProtocolError::ClaimCaseLinkMismatch,
        constraint = claim_case.claimant == *authority.address() @ OmegaXProtocolError::Unauthorized,
    )]
    pub claim_case: Account<ClaimCaseAccountData<'info>>,
}

#[derive(Accounts)]
pub struct AdjudicateClaimCase<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
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
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Account<'info, ClaimCase>,
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
    pub claim_case: Account<ClaimCaseAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub obligation: Option<Box<Account<'info, Obligation>>>,
    #[cfg(feature = "quasar")]
    #[account(mut)]
    pub obligation: Option<Account<ObligationAccountData<'info>>>,
}

#[derive(Accounts)]
pub struct SettleClaimCase<'info> {
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
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
            domain_asset_vault.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub domain_asset_vault: &'info mut Account<DomainAssetVault>,
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
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Box<Account<'info, ClaimCase>>,
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
    pub claim_case: Account<ClaimCaseAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub obligation: Option<Box<Account<'info, Obligation>>>,
    #[cfg(feature = "quasar")]
    pub obligation: Option<Account<ObligationAccountData<'info>>>,
    // The handler resolves the settlement recipient as
    // `claim_case.delegate_recipient` if non-zero, else `claim_case.claimant`,
    // and asserts `recipient_token_account.owner` equals that key before
    // transferring SPL out of the PDA-owned vault token account.
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = asset_mint.key() == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: Account<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *asset_mint.address() == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *vault_token_account.address() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    pub recipient_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Program<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
}
