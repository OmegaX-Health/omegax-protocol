// SPDX-License-Identifier: AGPL-3.0-or-later

//! Claim lifecycle and claim-attestation instruction handlers and account validation contexts.

use crate::platform::*;
#[cfg(not(feature = "quasar"))]
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(feature = "quasar")]
fn require_quasar_protocol_not_paused(governance: &ProtocolGovernance) -> Result<()> {
    require!(
        !governance.emergency_pause.get(),
        OmegaXProtocolError::ProtocolEmergencyPaused
    );
    Ok(())
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
fn require_quasar_health_plan_active(plan: &HealthPlanAccountData<'_>) -> Result<()> {
    require!(plan.active.get(), OmegaXProtocolError::HealthPlanInactive);
    Ok(())
}

#[cfg(feature = "quasar")]
fn require_quasar_claim_operator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlanAccountData<'_>,
) -> Result<()> {
    if *authority == plan.claims_operator
        || *authority == plan.plan_admin
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
fn require_quasar_claim_intake_submitter(
    authority: &Pubkey,
    plan: &HealthPlanAccountData<'_>,
    member_position: &MemberPosition,
    claimant: Pubkey,
) -> Result<()> {
    let claimant_is_member = claimant == member_position.wallet;
    let member_self_submit = *authority == member_position.wallet && claimant_is_member;
    let operator_submit =
        (*authority == plan.claims_operator || *authority == plan.plan_admin) && claimant_is_member;

    if member_self_submit || operator_submit {
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
#[inline(always)]
fn require_quasar_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
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
fn require_quasar_reserve_asset_rail_payout_enabled(
    rail: &ReserveAssetRailAccountData<'_>,
    now_ts: i64,
) -> Result<()> {
    require_quasar_reserve_asset_rail_active(rail)?;
    require!(
        rail.payout_enabled.get(),
        OmegaXProtocolError::ReserveAssetRailPayoutDisabled
    );
    require_quasar_fresh_reserve_asset_price_at(rail, now_ts)
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_reserve_asset_rail_active(rail: &ReserveAssetRailAccountData<'_>) -> Result<()> {
    require!(
        rail.active.get(),
        OmegaXProtocolError::ReserveAssetRailInactive
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn require_quasar_fresh_reserve_asset_price_at(
    rail: &ReserveAssetRailAccountData<'_>,
    now_ts: i64,
) -> Result<()> {
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
fn checked_pow10_u128(decimals: u8) -> Result<u128> {
    require!(
        decimals <= 18,
        OmegaXProtocolError::ReserveAssetMintDecimalsUnsupported
    );
    let mut value = 1u128;
    for _ in 0..decimals {
        value = value
            .checked_mul(10)
            .ok_or(OmegaXProtocolError::ArithmeticError)?;
    }
    Ok(value)
}

#[cfg(feature = "quasar")]
fn quasar_reserve_asset_value_usd_1e8_at(
    amount: u64,
    mint_decimals: u8,
    rail: &ReserveAssetRailAccountData<'_>,
    now_ts: i64,
) -> Result<u128> {
    require_quasar_fresh_reserve_asset_price_at(rail, now_ts)?;
    let decimal_scale = checked_pow10_u128(mint_decimals)?;
    let scaled = (amount as u128)
        .checked_mul(rail.last_price_usd_1e8.get() as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    scaled
        .checked_div(decimal_scale)
        .ok_or(OmegaXProtocolError::ArithmeticError.into())
}

#[cfg(feature = "quasar")]
fn require_quasar_selected_asset_payout_value(
    claim_credit_amount: u64,
    claim_mint_decimals: u8,
    claim_asset_rail: &ReserveAssetRailAccountData<'_>,
    payout_amount: u64,
    payout_mint_decimals: u8,
    payout_asset_rail: &ReserveAssetRailAccountData<'_>,
    max_overpay_bps: u16,
    now_ts: i64,
) -> Result<()> {
    require!(
        max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS,
        OmegaXProtocolError::SelectedAssetOverpayBpsTooHigh
    );
    let claim_value = quasar_reserve_asset_value_usd_1e8_at(
        claim_credit_amount,
        claim_mint_decimals,
        claim_asset_rail,
        now_ts,
    )?;
    let payout_value = quasar_reserve_asset_value_usd_1e8_at(
        payout_amount,
        payout_mint_decimals,
        payout_asset_rail,
        now_ts,
    )?;
    require!(
        payout_value >= claim_value,
        OmegaXProtocolError::SelectedAssetPayoutUnderpaid
    );
    let multiplier = (BASIS_POINTS_DENOMINATOR as u128) + (max_overpay_bps as u128);
    let max_value = claim_value
        .checked_mul(multiplier)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        / (BASIS_POINTS_DENOMINATOR as u128);
    require!(
        payout_value <= max_value,
        OmegaXProtocolError::SelectedAssetPayoutOverpaid
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
fn validate_quasar_direct_claim_settlement_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
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
    validate_quasar_optional_series_ledger(
        series_ledger,
        claim_case.policy_series,
        claim_case.asset_mint,
    )?;
    if pool_class_ledger.is_some() || allocation_position.is_some() || allocation_ledger.is_some() {
        return err!(OmegaXProtocolError::AllocationPositionMismatch);
    }
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
    series_sheet: Option<&mut ReserveBalanceSheet>,
    funding_spent_amount: &mut u64,
    amount: u64,
) -> Result<()> {
    require_quasar_free_reserve_capacity(domain_sheet, amount)?;
    require_quasar_free_reserve_capacity(plan_sheet, amount)?;
    require_quasar_free_reserve_capacity(line_sheet, amount)?;
    if let Some(series) = series_sheet.as_ref() {
        require_quasar_free_reserve_capacity(series, amount)?;
    }

    domain_sheet.funded = checked_sub(domain_sheet.funded, amount)?;
    domain_sheet.settled = checked_add(domain_sheet.settled, amount)?;
    recompute_sheet(domain_sheet)?;

    plan_sheet.funded = checked_sub(plan_sheet.funded, amount)?;
    plan_sheet.settled = checked_add(plan_sheet.settled, amount)?;
    recompute_sheet(plan_sheet)?;

    line_sheet.funded = checked_sub(line_sheet.funded, amount)?;
    line_sheet.settled = checked_add(line_sheet.settled, amount)?;
    recompute_sheet(line_sheet)?;

    if let Some(series) = series_sheet {
        series.funded = checked_sub(series.funded, amount)?;
        series.settled = checked_add(series.settled, amount)?;
        recompute_sheet(series)?;
    }

    *domain_assets = checked_sub(*domain_assets, amount)?;
    *funding_spent_amount = checked_add(*funding_spent_amount, amount)?;
    Ok(())
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
fn resolve_quasar_claim_oracle_fee(
    health_plan_key: Pubkey,
    claim_case: &Account<ClaimCaseAccountData<'_>>,
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
            let claim_case_key = *claim_case.address();
            require_quasar_oracle_fee_accounts_canonical(
                vault,
                policy,
                attestation,
                claim_case_key,
                claim_case.asset_mint,
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
                claim_case.asset_mint,
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
            fee_share_from_bps(amount, policy.oracle_fee_bps.get())
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

#[cfg(not(feature = "quasar"))]
pub(crate) fn open_claim_case(ctx: Context<OpenClaimCase>, args: OpenClaimCaseArgs) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_id(&args.claim_id)?;
    require_health_plan_active(&ctx.accounts.health_plan)?;
    require!(
        ctx.accounts.health_plan.pause_flags & PAUSE_FLAG_CLAIM_INTAKE == 0,
        OmegaXProtocolError::ClaimIntakePaused
    );
    require_claim_intake_submitter(
        &ctx.accounts.authority.key(),
        &ctx.accounts.health_plan,
        &ctx.accounts.member_position,
        &args,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    claim_case.health_plan = ctx.accounts.health_plan.key();
    claim_case.policy_series = args.policy_series;
    claim_case.member_position = ctx.accounts.member_position.key();
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
    claim_case.attestation_count = 0;
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
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_quasar_id(claim_id)?;
    require_quasar_health_plan_active(&ctx.accounts.health_plan)?;
    require!(
        ctx.accounts.health_plan.pause_flags.get() & PAUSE_FLAG_CLAIM_INTAKE == 0,
        OmegaXProtocolError::ClaimIntakePaused
    );
    let authority = *ctx.accounts.authority.address();
    require_quasar_claim_intake_submitter(
        &authority,
        &ctx.accounts.health_plan,
        &ctx.accounts.member_position,
        claimant,
    )?;

    let opened_at = Clock::get()?.unix_timestamp.get();
    let claim_case_bump = ctx.accounts.claim_case.bump;
    ctx.accounts.claim_case.set_inner(
        ctx.accounts.health_plan.reserve_domain,
        *ctx.accounts.health_plan.address(),
        policy_series,
        *ctx.accounts.member_position.address(),
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
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    // The Anchor context binds member_position.wallet == authority.key()
    // and claim_case.member_position == member_position.key(), so reaching
    // this body means the member of record signed.
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
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;

    let claim_case = &mut ctx.accounts.claim_case;
    require!(
        claim_case.intake_status < CLAIM_INTAKE_APPROVED && claim_case.paid_amount.get() == 0,
        OmegaXProtocolError::ClaimRecipientLocked
    );

    let updated_at = Clock::get()?.unix_timestamp.get();
    let reserve_domain = claim_case.reserve_domain;
    let health_plan = claim_case.health_plan;
    let policy_series = claim_case.policy_series;
    let member_position = claim_case.member_position;
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
    let attestation_count = claim_case.attestation_count.get();
    let linked_obligation = claim_case.linked_obligation;
    let opened_at = claim_case.opened_at.get();
    let closed_at = claim_case.closed_at.get();
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
pub(crate) fn attach_claim_evidence_ref(
    ctx: Context<AttachClaimEvidenceRef>,
    args: AttachClaimEvidenceRefArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
    require_claim_evidence_mutable(claim_case)?;
    claim_case.evidence_ref_hash = args.evidence_ref_hash;
    claim_case.decision_support_hash = args.decision_support_hash;
    claim_case.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn attach_claim_evidence_ref<'info>(
    ctx: &mut Ctx<'info, AttachClaimEvidenceRef<'info>>,
    evidence_ref_hash: [u8; 32],
    decision_support_hash: [u8; 32],
) -> Result<()> {
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let authority = *ctx.accounts.authority.address();
    require_quasar_claim_operator(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
    require_quasar_claim_evidence_mutable(claim_case)?;

    let updated_at = Clock::get()?.unix_timestamp.get();
    let reserve_domain = claim_case.reserve_domain;
    let health_plan = claim_case.health_plan;
    let policy_series = claim_case.policy_series;
    let member_position = claim_case.member_position;
    let funding_line = claim_case.funding_line;
    let asset_mint = claim_case.asset_mint;
    let claimant = claim_case.claimant;
    let adjudicator = claim_case.adjudicator;
    let delegate_recipient = claim_case.delegate_recipient;
    let intake_status = claim_case.intake_status;
    let review_state = claim_case.review_state;
    let approved_amount = claim_case.approved_amount.get();
    let denied_amount = claim_case.denied_amount.get();
    let paid_amount = claim_case.paid_amount.get();
    let reserved_amount = claim_case.reserved_amount.get();
    let recovered_amount = claim_case.recovered_amount.get();
    let appeal_count = claim_case.appeal_count.get();
    let attestation_count = claim_case.attestation_count.get();
    let linked_obligation = claim_case.linked_obligation;
    let opened_at = claim_case.opened_at.get();
    let closed_at = claim_case.closed_at.get();
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
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
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
    let claim_case_key = claim_case.key();
    claim_case.adjudicator = ctx.accounts.authority.key();
    claim_case.review_state = args.review_state;
    claim_case.approved_amount = args.approved_amount;
    claim_case.denied_amount = args.denied_amount;
    claim_case.decision_support_hash = args.decision_support_hash;
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
    decision_support_hash: [u8; 32],
) -> Result<()> {
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let authority = *ctx.accounts.authority.address();
    require_quasar_claim_operator(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
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
            let liquidity_pool = obligation.liquidity_pool;
            let capital_class = obligation.capital_class;
            let allocation_position = obligation.allocation_position;
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
                liquidity_pool,
                capital_class,
                allocation_position,
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
    let member_position = claim_case.member_position;
    let funding_line = claim_case.funding_line;
    let asset_mint = claim_case.asset_mint;
    let claimant = claim_case.claimant;
    let delegate_recipient = claim_case.delegate_recipient;
    let evidence_ref_hash = claim_case.evidence_ref_hash;
    let paid_amount = claim_case.paid_amount.get();
    let recovered_amount = claim_case.recovered_amount.get();
    let appeal_count = claim_case.appeal_count.get();
    let attestation_count = claim_case.attestation_count.get();
    let opened_at = claim_case.opened_at.get();
    let closed_at = claim_case.closed_at.get();
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
        attestation_count,
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
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
    crate::reserve_waterfall::require_reserve_asset_rail_payout_enabled(
        &ctx.accounts.reserve_asset_rail,
    )?;
    require!(
        args.amount <= remaining_claim_amount(&ctx.accounts.claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );
    require_positive_amount(args.amount)?;
    validate_direct_claim_settlement_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        &ctx.accounts.claim_case,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    // PT-2026-04-27-01/02 fix: resolve the SPL recipient before mutating
    // the claim_case (Pubkey is Copy so we capture by value).
    let resolved_recipient =
        resolve_claim_settlement_recipient(&ctx.accounts.claim_case, &ctx.accounts.member_position);
    require_keys_eq!(
        ctx.accounts.recipient_token_account.owner,
        resolved_recipient,
        OmegaXProtocolError::Unauthorized
    );

    let amount = args.amount;

    // Phase 1.6 — Compute protocol fee + adjudicator-oracle fee carve-outs.
    // The full `amount` is what the claim is settling against (claim_case.paid_amount
    // increments by amount, funding_line.spent_amount increments by amount, sheets
    // record the full obligation delivery). But only `net_to_recipient = amount -
    // total_fee` physically leaves the vault — fee tokens stay as treasury claims.
    let reserve_domain = ctx.accounts.health_plan.reserve_domain;
    let asset_mint_key = ctx.accounts.funding_line.asset_mint;
    let protocol_fee_bps = ctx.accounts.protocol_governance.protocol_fee_bps;

    let protocol_fee_vault = &ctx.accounts.protocol_fee_vault;
    require_keys_eq!(
        protocol_fee_vault.reserve_domain,
        reserve_domain,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require_keys_eq!(
        protocol_fee_vault.asset_mint,
        asset_mint_key,
        OmegaXProtocolError::FeeVaultMismatch
    );
    let protocol_fee = fee_share_from_bps(amount, protocol_fee_bps)?;

    // Oracle fee: requires the fee vault, policy, and a matching attestation.
    // The attestation binds the revshare recipient to the oracle that actually
    // attested this claim case.
    let oracle_fee = match (
        ctx.accounts.pool_oracle_fee_vault.as_deref(),
        ctx.accounts.pool_oracle_policy.as_deref(),
        ctx.accounts.oracle_fee_attestation.as_deref(),
    ) {
        (Some(vault), Some(policy), Some(attestation)) => {
            require_oracle_fee_accounts_canonical(
                vault,
                policy,
                attestation,
                ctx.accounts.claim_case.key(),
                asset_mint_key,
            )?;
            require_keys_eq!(
                vault.oracle,
                attestation.oracle,
                OmegaXProtocolError::OracleProfileMismatch
            );
            require_keys_eq!(
                attestation.claim_case,
                ctx.accounts.claim_case.key(),
                OmegaXProtocolError::Unauthorized
            );
            require_keys_eq!(
                attestation.health_plan,
                ctx.accounts.health_plan.key(),
                OmegaXProtocolError::HealthPlanMismatch
            );
            require_keys_eq!(
                attestation.policy_series,
                ctx.accounts.claim_case.policy_series,
                OmegaXProtocolError::PolicySeriesMismatch
            );
            require!(
                attestation.evidence_ref_hash == ctx.accounts.claim_case.evidence_ref_hash,
                OmegaXProtocolError::ClaimEvidenceMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                asset_mint_key,
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
            fee_share_from_bps(amount, policy.oracle_fee_bps)?
        }
        (Some(_), Some(_), None) => {
            return Err(OmegaXProtocolError::ClaimAttestationRequiredForOracleFee.into());
        }
        (None, Some(_), _) => {
            return Err(OmegaXProtocolError::FeeVaultRequiredForConfiguredFee.into());
        }
        (None, None, None) => 0,
        (Some(_), None, _) | (None, None, Some(_)) => {
            // Vault provided without policy is a configuration error;
            // refuse to silently zero the bps.
            return Err(OmegaXProtocolError::FeeVaultBpsMisconfigured.into());
        }
    };

    let total_fee = checked_add(protocol_fee, oracle_fee)?;
    require!(
        total_fee < amount,
        OmegaXProtocolError::FeeVaultBpsMisconfigured
    );
    let net_to_recipient = checked_sub(amount, total_fee)?;
    require_positive_amount(net_to_recipient)?;

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
        ctx.accounts.series_reserve_ledger.as_deref_mut(),
        &mut ctx.accounts.funding_line,
        amount,
    )?;
    if total_fee > 0 {
        ctx.accounts.domain_asset_vault.total_assets =
            checked_add(ctx.accounts.domain_asset_vault.total_assets, total_fee)?;
    }

    // PT-01/02 fix: actually move the SPL tokens. The vault token account
    // is owned by the domain_asset_vault PDA, which signs via seeds.
    // Phase 1.6: outflow is net_to_recipient; fee tokens stay in vault.
    transfer_from_domain_vault(
        net_to_recipient,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;

    // Accrue the protocol fee carve-out.
    if protocol_fee > 0 {
        let vault = &mut ctx.accounts.protocol_fee_vault;
        let key = vault.key();
        let mint = vault.asset_mint;
        let total = accrue_fee(&mut vault.accrued_fees, protocol_fee)?;
        emit!(FeeAccruedEvent {
            vault: key,
            asset_mint: mint,
            amount: protocol_fee,
            accrued_total: total,
        });
    }

    // Accrue the adjudicator-oracle fee carve-out.
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
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let authority = *ctx.accounts.authority.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
    let funding_line_key = *ctx.accounts.funding_line.address();
    require_quasar_claim_operator(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_quasar_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
    let now_ts = Clock::get()?.unix_timestamp.get();
    require_quasar_reserve_asset_rail_payout_enabled(&ctx.accounts.reserve_asset_rail, now_ts)?;
    require!(
        amount <= quasar_remaining_claim_amount(&ctx.accounts.claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
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
    validate_quasar_direct_claim_settlement_bindings(
        series_ledger,
        pool_class_ledger,
        allocation_position,
        allocation_ledger,
        &ctx.accounts.claim_case,
        funding_line_key,
        ctx.accounts.funding_line.asset_mint,
    )?;

    let resolved_recipient = if ctx.accounts.claim_case.delegate_recipient != ZERO_PUBKEY {
        ctx.accounts.claim_case.delegate_recipient
    } else {
        ctx.accounts.member_position.wallet
    };
    require_keys_eq!(
        *ctx.accounts.recipient_token_account.owner(),
        resolved_recipient,
        OmegaXProtocolError::Unauthorized
    );

    let reserve_domain = ctx.accounts.health_plan.reserve_domain;
    let asset_mint_key = ctx.accounts.funding_line.asset_mint;
    require_keys_eq!(
        ctx.accounts.protocol_fee_vault.reserve_domain,
        reserve_domain,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require_keys_eq!(
        ctx.accounts.protocol_fee_vault.asset_mint,
        asset_mint_key,
        OmegaXProtocolError::FeeVaultMismatch
    );
    let protocol_fee = fee_share_from_bps(
        amount,
        ctx.accounts.protocol_governance.protocol_fee_bps.get(),
    )?;

    let pool_oracle_fee_vault = ctx
        .accounts
        .pool_oracle_fee_vault
        .as_ref()
        .map(|vault| &**vault);
    let oracle_fee = resolve_quasar_claim_oracle_fee(
        health_plan_key,
        &ctx.accounts.claim_case,
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

    let total_fee = checked_add(protocol_fee, oracle_fee)?;
    require!(
        total_fee < amount,
        OmegaXProtocolError::FeeVaultBpsMisconfigured
    );
    let net_to_recipient = checked_sub(amount, total_fee)?;
    require_quasar_positive_amount(net_to_recipient)?;

    let mut domain_total_assets = ctx.accounts.domain_asset_vault.total_assets.get();
    let mut domain_sheet = ctx.accounts.domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.funding_line_ledger.sheet;
    let mut series_sheet = ctx
        .accounts
        .series_reserve_ledger
        .as_ref()
        .map(|ledger| ledger.sheet);
    let mut funding_spent_amount = ctx.accounts.funding_line.spent_amount.get();
    book_quasar_direct_claim_payout(
        &mut domain_total_assets,
        &mut domain_sheet,
        &mut plan_sheet,
        &mut funding_line_sheet,
        series_sheet.as_mut(),
        &mut funding_spent_amount,
        amount,
    )?;
    if total_fee > 0 {
        domain_total_assets = checked_add(domain_total_assets, total_fee)?;
    }

    transfer_from_domain_vault(
        net_to_recipient,
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
    let paid_amount = checked_add(claim_case.paid_amount.get(), amount)?;
    let reserved_amount = claim_case.reserved_amount.get().saturating_sub(amount);
    let recovered_amount = claim_case.recovered_amount.get();
    let appeal_count = claim_case.appeal_count.get();
    let attestation_count = claim_case.attestation_count.get();
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

    if protocol_fee > 0 {
        let vault = &mut ctx.accounts.protocol_fee_vault;
        let reserve_domain = vault.reserve_domain;
        let asset_mint = vault.asset_mint;
        let fee_recipient = vault.fee_recipient;
        let accrued_fees = checked_add(vault.accrued_fees.get(), protocol_fee)?;
        let withdrawn_fees = vault.withdrawn_fees.get();
        let bump = vault.bump;
        vault.set_inner(
            reserve_domain,
            asset_mint,
            fee_recipient,
            accrued_fees,
            withdrawn_fees,
            bump,
        );
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

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_oracle_fee_accounts_canonical(
    vault: &Account<PoolOracleFeeVault>,
    policy: &Account<PoolOraclePolicy>,
    attestation: &Account<ClaimAttestation>,
    claim_case: Pubkey,
    asset_mint: Pubkey,
) -> Result<()> {
    let (expected_policy, expected_policy_bump) = Pubkey::find_program_address(
        &[SEED_POOL_ORACLE_POLICY, policy.liquidity_pool.as_ref()],
        &crate::ID,
    );
    require_keys_eq!(
        policy.key(),
        expected_policy,
        OmegaXProtocolError::PoolOracleApprovalRequired
    );
    require!(
        policy.bump == expected_policy_bump,
        OmegaXProtocolError::PoolOracleApprovalRequired
    );

    let (expected_attestation, expected_attestation_bump) = Pubkey::find_program_address(
        &[
            SEED_CLAIM_ATTESTATION,
            claim_case.as_ref(),
            attestation.oracle.as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        attestation.key(),
        expected_attestation,
        OmegaXProtocolError::Unauthorized
    );
    require!(
        attestation.bump == expected_attestation_bump,
        OmegaXProtocolError::Unauthorized
    );

    let (expected_vault, expected_vault_bump) = Pubkey::find_program_address(
        &[
            SEED_POOL_ORACLE_FEE_VAULT,
            policy.liquidity_pool.as_ref(),
            attestation.oracle.as_ref(),
            asset_mint.as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        vault.key(),
        expected_vault,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require!(
        vault.bump == expected_vault_bump,
        OmegaXProtocolError::FeeVaultMismatch
    );

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn settle_claim_case_selected_asset(
    ctx: Context<SettleClaimCaseSelectedAsset>,
    args: SettleClaimCaseSelectedAssetArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
    require_positive_amount(args.claim_credit_amount)?;
    require_positive_amount(args.payout_amount)?;
    require!(
        args.claim_credit_amount <= remaining_claim_amount(&ctx.accounts.claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );
    require!(
        args.max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS,
        OmegaXProtocolError::SelectedAssetOverpayBpsTooHigh
    );
    require_keys_eq!(
        ctx.accounts.payout_funding_line.health_plan,
        ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.payout_funding_line.policy_series,
        ctx.accounts.claim_case.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        ctx.accounts.payout_funding_line.status == FUNDING_LINE_STATUS_OPEN,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_neq!(
        ctx.accounts.claim_case.asset_mint,
        ctx.accounts.payout_funding_line.asset_mint,
        OmegaXProtocolError::SelectedAssetPayoutSameMint
    );
    validate_optional_series_ledger(
        ctx.accounts.payout_series_reserve_ledger.as_deref(),
        ctx.accounts.claim_case.policy_series,
        ctx.accounts.payout_funding_line.asset_mint,
    )?;
    crate::reserve_waterfall::require_reserve_asset_rail_active(&ctx.accounts.claim_asset_rail)?;
    crate::reserve_waterfall::require_reserve_asset_rail_payout_enabled(
        &ctx.accounts.payout_asset_rail,
    )?;
    require_classic_spl_token(&ctx.accounts.claim_asset_mint, &ctx.accounts.token_program)?;
    crate::reserve_waterfall::require_selected_asset_payout_value(
        args.claim_credit_amount,
        ctx.accounts.claim_asset_mint.decimals,
        &ctx.accounts.claim_asset_rail,
        args.payout_amount,
        ctx.accounts.payout_asset_mint.decimals,
        &ctx.accounts.payout_asset_rail,
        args.max_overpay_bps,
    )?;

    let resolved_recipient =
        resolve_claim_settlement_recipient(&ctx.accounts.claim_case, &ctx.accounts.member_position);
    require_keys_eq!(
        ctx.accounts.recipient_token_account.owner,
        resolved_recipient,
        OmegaXProtocolError::Unauthorized
    );

    let now_ts = Clock::get()?.unix_timestamp;
    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.paid_amount = checked_add(claim_case.paid_amount, args.claim_credit_amount)?;
    claim_case.reserved_amount = claim_case
        .reserved_amount
        .saturating_sub(args.claim_credit_amount);
    claim_case.intake_status = if claim_case.paid_amount >= claim_case.approved_amount {
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

    book_selected_asset_claim_payout(
        &mut ctx.accounts.payout_domain_asset_vault.total_assets,
        &mut ctx.accounts.payout_domain_asset_ledger.sheet,
        &mut ctx.accounts.payout_plan_reserve_ledger.sheet,
        &mut ctx.accounts.payout_funding_line_ledger.sheet,
        ctx.accounts.payout_series_reserve_ledger.as_deref_mut(),
        &mut ctx.accounts.payout_funding_line,
        args.payout_amount,
    )?;

    transfer_from_domain_vault(
        args.payout_amount,
        &ctx.accounts.payout_domain_asset_vault,
        &ctx.accounts.payout_vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.payout_asset_mint,
        &ctx.accounts.token_program,
    )?;

    emit!(ClaimCaseSelectedAssetPayoutEvent {
        claim_case: ctx.accounts.claim_case.key(),
        claim_asset_mint: ctx.accounts.claim_case.asset_mint,
        payout_asset_mint: ctx.accounts.payout_funding_line.asset_mint,
        claim_credit_amount: args.claim_credit_amount,
        payout_amount: args.payout_amount,
        settlement_reason_hash: args.settlement_reason_hash,
    });
    emit!(ClaimCaseStateChangedEvent {
        claim_case: ctx.accounts.claim_case.key(),
        intake_status: ctx.accounts.claim_case.intake_status,
        approved_amount: ctx.accounts.claim_case.approved_amount,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn settle_claim_case_selected_asset<'info>(
    ctx: &mut Ctx<'info, SettleClaimCaseSelectedAsset<'info>>,
    claim_credit_amount: u64,
    payout_amount: u64,
    max_overpay_bps: u16,
    settlement_reason_hash: [u8; 32],
) -> Result<()> {
    let _ = settlement_reason_hash;
    require_quasar_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let authority = *ctx.accounts.authority.address();
    let health_plan_key = *ctx.accounts.health_plan.address();
    require_quasar_claim_operator(
        &authority,
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_quasar_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
    require_quasar_positive_amount(claim_credit_amount)?;
    require_quasar_positive_amount(payout_amount)?;
    require!(
        claim_credit_amount <= quasar_remaining_claim_amount(&ctx.accounts.claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );
    require!(
        max_overpay_bps <= MAX_SELECTED_ASSET_PAYOUT_OVERPAY_BPS,
        OmegaXProtocolError::SelectedAssetOverpayBpsTooHigh
    );
    require_keys_eq!(
        ctx.accounts.payout_funding_line.health_plan,
        health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.payout_funding_line.policy_series,
        ctx.accounts.claim_case.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        ctx.accounts.payout_funding_line.status == FUNDING_LINE_STATUS_OPEN,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_neq!(
        ctx.accounts.claim_case.asset_mint,
        ctx.accounts.payout_funding_line.asset_mint,
        OmegaXProtocolError::SelectedAssetPayoutSameMint
    );

    validate_quasar_optional_series_ledger(
        ctx.accounts
            .payout_series_reserve_ledger
            .as_ref()
            .map(|ledger| &**ledger),
        ctx.accounts.claim_case.policy_series,
        ctx.accounts.payout_funding_line.asset_mint,
    )?;

    let now_ts = Clock::get()?.unix_timestamp.get();
    require_quasar_reserve_asset_rail_active(&ctx.accounts.claim_asset_rail)?;
    require_quasar_reserve_asset_rail_payout_enabled(&ctx.accounts.payout_asset_rail, now_ts)?;
    require_classic_spl_token(ctx.accounts.claim_asset_mint, ctx.accounts.token_program)?;
    require_quasar_selected_asset_payout_value(
        claim_credit_amount,
        ctx.accounts.claim_asset_mint.decimals(),
        &ctx.accounts.claim_asset_rail,
        payout_amount,
        ctx.accounts.payout_asset_mint.decimals(),
        &ctx.accounts.payout_asset_rail,
        max_overpay_bps,
        now_ts,
    )?;

    let resolved_recipient = if ctx.accounts.claim_case.delegate_recipient != ZERO_PUBKEY {
        ctx.accounts.claim_case.delegate_recipient
    } else {
        ctx.accounts.member_position.wallet
    };
    require_keys_eq!(
        *ctx.accounts.recipient_token_account.owner(),
        resolved_recipient,
        OmegaXProtocolError::Unauthorized
    );

    let mut domain_total_assets = ctx.accounts.payout_domain_asset_vault.total_assets.get();
    let mut domain_sheet = ctx.accounts.payout_domain_asset_ledger.sheet;
    let mut plan_sheet = ctx.accounts.payout_plan_reserve_ledger.sheet;
    let mut funding_line_sheet = ctx.accounts.payout_funding_line_ledger.sheet;
    let mut series_sheet = ctx
        .accounts
        .payout_series_reserve_ledger
        .as_ref()
        .map(|ledger| ledger.sheet);
    let mut funding_spent_amount = ctx.accounts.payout_funding_line.spent_amount.get();
    book_quasar_direct_claim_payout(
        &mut domain_total_assets,
        &mut domain_sheet,
        &mut plan_sheet,
        &mut funding_line_sheet,
        series_sheet.as_mut(),
        &mut funding_spent_amount,
        payout_amount,
    )?;

    transfer_from_domain_vault(
        payout_amount,
        ctx.accounts.payout_domain_asset_vault,
        ctx.accounts.payout_vault_token_account,
        ctx.accounts.recipient_token_account,
        ctx.accounts.payout_asset_mint,
        ctx.accounts.token_program,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
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
    let paid_amount = checked_add(claim_case.paid_amount.get(), claim_credit_amount)?;
    let reserved_amount = claim_case
        .reserved_amount
        .get()
        .saturating_sub(claim_credit_amount);
    let recovered_amount = claim_case.recovered_amount.get();
    let appeal_count = claim_case.appeal_count.get();
    let attestation_count = claim_case.attestation_count.get();
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
        linked_obligation,
        opened_at,
        now_ts,
        closed_at,
        bump,
        &claim_id,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let domain_asset_vault = &mut ctx.accounts.payout_domain_asset_vault;
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

    let domain_asset_ledger = &mut ctx.accounts.payout_domain_asset_ledger;
    let reserve_domain = domain_asset_ledger.reserve_domain;
    let asset_mint = domain_asset_ledger.asset_mint;
    let bump = domain_asset_ledger.bump;
    domain_asset_ledger.set_inner(reserve_domain, asset_mint, domain_sheet, bump);

    let plan_reserve_ledger = &mut ctx.accounts.payout_plan_reserve_ledger;
    let health_plan = plan_reserve_ledger.health_plan;
    let asset_mint = plan_reserve_ledger.asset_mint;
    let bump = plan_reserve_ledger.bump;
    plan_reserve_ledger.set_inner(health_plan, asset_mint, plan_sheet, bump);

    let funding_line_ledger = &mut ctx.accounts.payout_funding_line_ledger;
    let funding_line_key = funding_line_ledger.funding_line;
    let asset_mint = funding_line_ledger.asset_mint;
    let bump = funding_line_ledger.bump;
    funding_line_ledger.set_inner(funding_line_key, asset_mint, funding_line_sheet, bump);

    if let (Some(series_ledger), Some(sheet)) = (
        ctx.accounts.payout_series_reserve_ledger.as_mut(),
        series_sheet.as_ref(),
    ) {
        let series_ledger = &mut **series_ledger;
        let policy_series = series_ledger.policy_series;
        let asset_mint = series_ledger.asset_mint;
        let bump = series_ledger.bump;
        series_ledger.set_inner(policy_series, asset_mint, *sheet, bump);
    }

    let funding_line = &mut ctx.accounts.payout_funding_line;
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

#[cfg(not(feature = "quasar"))]
pub(crate) fn attest_claim_case(
    ctx: Context<AttestClaimCase>,
    args: AttestClaimCaseArgs,
) -> Result<()> {
    require_valid_attestation_decision(args.decision)?;
    require!(
        !is_zero_hash(&args.schema_key_hash),
        OmegaXProtocolError::ClaimAttestationSchemaRequired
    );

    let now_ts = Clock::get()?.unix_timestamp;
    let oracle_profile = &ctx.accounts.oracle_profile;
    let outcome_schema = &ctx.accounts.outcome_schema;
    let claim_case_key = ctx.accounts.claim_case.key();

    validate_claim_attestation_common(
        &ctx.accounts.protocol_governance,
        ctx.accounts.health_plan.key(),
        &ctx.accounts.health_plan,
        ctx.accounts.funding_line.key(),
        &ctx.accounts.funding_line,
        &ctx.accounts.claim_case,
        outcome_schema,
        oracle_profile,
        &args,
    )?;

    let (liquidity_pool, allocation_position) =
        validate_claim_attestation_pool_scope(ctx.accounts)?;

    let attestation = &mut ctx.accounts.claim_attestation;
    attestation.oracle = oracle_profile.oracle;
    attestation.oracle_profile = oracle_profile.key();
    attestation.claim_case = claim_case_key;
    attestation.health_plan = ctx.accounts.claim_case.health_plan;
    attestation.policy_series = ctx.accounts.claim_case.policy_series;
    attestation.decision = args.decision;
    attestation.attestation_hash = args.attestation_hash;
    attestation.attestation_ref_hash = args.attestation_ref_hash;
    attestation.evidence_ref_hash = ctx.accounts.claim_case.evidence_ref_hash;
    attestation.decision_support_hash = ctx.accounts.claim_case.decision_support_hash;
    attestation.schema_key_hash = outcome_schema.schema_key_hash;
    attestation.schema_hash = outcome_schema.schema_hash;
    attestation.schema_version = outcome_schema.version;
    attestation.liquidity_pool = liquidity_pool;
    attestation.allocation_position = allocation_position;
    attestation.created_at_ts = now_ts;
    attestation.updated_at_ts = now_ts;
    attestation.bump = ctx.bumps.claim_attestation;

    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.attestation_count = claim_case
        .attestation_count
        .checked_add(1)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    claim_case.updated_at = now_ts;

    emit!(ClaimCaseAttestedEvent {
        claim_attestation: attestation.key(),
        claim_case: claim_case_key,
        oracle_profile: oracle_profile.key(),
        oracle: oracle_profile.oracle,
        decision: attestation.decision,
        attestation_hash: attestation.attestation_hash,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn require_claim_evidence_mutable(claim_case: &ClaimCaseAccountData<'_>) -> Result<()> {
    require!(
        claim_case.attestation_count == 0,
        OmegaXProtocolError::ClaimEvidenceLocked
    );
    Ok(())
}

#[cfg(feature = "quasar")]
fn require_quasar_claim_evidence_mutable(claim_case: &ClaimCaseAccountData<'_>) -> Result<()> {
    require!(
        claim_case.attestation_count.get() == 0,
        OmegaXProtocolError::ClaimEvidenceLocked
    );
    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn validate_claim_attestation_common(
    protocol_governance: &ProtocolGovernance,
    health_plan_key: Pubkey,
    health_plan: &HealthPlanAccountData<'_>,
    funding_line_key: Pubkey,
    funding_line: &FundingLineAccountData<'_>,
    claim_case: &ClaimCaseAccountData<'_>,
    outcome_schema: &OutcomeSchemaAccountData<'_>,
    oracle_profile: &OracleProfileAccountData<'_>,
    args: &AttestClaimCaseArgs,
) -> Result<()> {
    require_protocol_not_paused(protocol_governance)?;
    require!(
        health_plan.pause_flags & PAUSE_FLAG_ORACLE_FINALITY_HOLD == 0,
        OmegaXProtocolError::OracleFinalityHeld
    );
    require!(
        !is_zero_hash(&claim_case.evidence_ref_hash),
        OmegaXProtocolError::ClaimEvidenceRequired
    );
    require!(
        args.attestation_ref_hash == claim_case.evidence_ref_hash,
        OmegaXProtocolError::ClaimEvidenceMismatch
    );
    require!(
        outcome_schema.verified,
        OmegaXProtocolError::OutcomeSchemaUnverified
    );
    require!(
        oracle_profile_supports_schema(oracle_profile, outcome_schema.schema_key_hash),
        OmegaXProtocolError::ClaimAttestationSchemaUnsupported
    );
    require_keys_eq!(
        claim_case.health_plan,
        funding_line.health_plan,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        health_plan.reserve_domain,
        funding_line.reserve_domain,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        health_plan_key,
        claim_case.health_plan,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        funding_line_key,
        claim_case.funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        funding_line.policy_series,
        claim_case.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require_keys_eq!(
        funding_line.asset_mint,
        claim_case.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        funding_line.status == FUNDING_LINE_STATUS_OPEN,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_claim_attestation_oracle_authority(health_plan, funding_line, oracle_profile)?;
    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) struct ClaimAttestationPoolScope<'a> {
    pub liquidity_pool_key: Pubkey,
    pub liquidity_pool: &'a LiquidityPoolAccountData<'a>,
    pub capital_class_key: Pubkey,
    pub capital_class: &'a CapitalClassAccountData<'a>,
    pub allocation_position_key: Pubkey,
    pub allocation_position: &'a AllocationPosition,
    pub funding_line_key: Pubkey,
    pub pool_oracle_approval_key: Pubkey,
    pub pool_oracle_approval: &'a PoolOracleApproval,
    pub pool_oracle_permission_set_key: Pubkey,
    pub pool_oracle_permission_set: &'a PoolOraclePermissionSet,
    pub pool_oracle_policy_key: Pubkey,
    pub pool_oracle_policy: &'a PoolOraclePolicy,
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn validate_lp_claim_attestation_scope(
    health_plan: &HealthPlanAccountData<'_>,
    funding_line: &FundingLineAccountData<'_>,
    claim_case: &ClaimCaseAccountData<'_>,
    oracle_profile: &OracleProfileAccountData<'_>,
    scope: ClaimAttestationPoolScope<'_>,
) -> Result<()> {
    let (expected_liquidity_pool, _) = Pubkey::find_program_address(
        &[
            SEED_LIQUIDITY_POOL,
            scope.liquidity_pool.reserve_domain.as_ref(),
            scope.liquidity_pool.pool_id.as_bytes(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        scope.liquidity_pool_key,
        expected_liquidity_pool,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        scope.liquidity_pool.reserve_domain,
        health_plan.reserve_domain,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        scope.liquidity_pool.deposit_asset_mint,
        funding_line.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    let (expected_capital_class, _) = Pubkey::find_program_address(
        &[
            SEED_CAPITAL_CLASS,
            scope.liquidity_pool_key.as_ref(),
            scope.capital_class.class_id.as_bytes(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        scope.capital_class_key,
        expected_capital_class,
        OmegaXProtocolError::CapitalClassMismatch
    );
    require_keys_eq!(
        scope.capital_class.reserve_domain,
        health_plan.reserve_domain,
        OmegaXProtocolError::CapitalClassMismatch
    );
    require_keys_eq!(
        scope.capital_class.liquidity_pool,
        scope.liquidity_pool_key,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        scope.allocation_position.reserve_domain,
        health_plan.reserve_domain,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    require_keys_eq!(
        scope.allocation_position.liquidity_pool,
        scope.liquidity_pool_key,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    require_keys_eq!(
        scope.allocation_position.capital_class,
        scope.capital_class_key,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    let (expected_allocation_position, _) = Pubkey::find_program_address(
        &[
            SEED_ALLOCATION_POSITION,
            scope.capital_class_key.as_ref(),
            scope.funding_line_key.as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        scope.allocation_position_key,
        expected_allocation_position,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    require_keys_eq!(
        scope.allocation_position.health_plan,
        claim_case.health_plan,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    require_keys_eq!(
        scope.allocation_position.policy_series,
        claim_case.policy_series,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    require_keys_eq!(
        scope.allocation_position.funding_line,
        scope.funding_line_key,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    require!(
        scope.allocation_position.active,
        OmegaXProtocolError::AllocationPositionMismatch
    );
    let (expected_pool_oracle_approval, _) = Pubkey::find_program_address(
        &[
            SEED_POOL_ORACLE_APPROVAL,
            scope.liquidity_pool_key.as_ref(),
            oracle_profile.oracle.as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        scope.pool_oracle_approval_key,
        expected_pool_oracle_approval,
        OmegaXProtocolError::PoolOracleApprovalRequired
    );
    require_keys_eq!(
        scope.pool_oracle_approval.liquidity_pool,
        scope.liquidity_pool_key,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        scope.pool_oracle_approval.oracle,
        oracle_profile.oracle,
        OmegaXProtocolError::OracleProfileMismatch
    );
    require!(
        scope.pool_oracle_approval.active,
        OmegaXProtocolError::PoolOracleApprovalRequired
    );
    let (expected_pool_oracle_permission_set, _) = Pubkey::find_program_address(
        &[
            SEED_POOL_ORACLE_PERMISSION_SET,
            scope.liquidity_pool_key.as_ref(),
            oracle_profile.oracle.as_ref(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        scope.pool_oracle_permission_set_key,
        expected_pool_oracle_permission_set,
        OmegaXProtocolError::PoolOraclePermissionRequired
    );
    require_keys_eq!(
        scope.pool_oracle_permission_set.liquidity_pool,
        scope.liquidity_pool_key,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        scope.pool_oracle_permission_set.oracle,
        oracle_profile.oracle,
        OmegaXProtocolError::OracleProfileMismatch
    );
    require!(
        scope.pool_oracle_permission_set.permissions & POOL_ORACLE_PERMISSION_ATTEST_CLAIM != 0,
        OmegaXProtocolError::PoolOraclePermissionRequired
    );
    let (expected_pool_oracle_policy, _) = Pubkey::find_program_address(
        &[SEED_POOL_ORACLE_POLICY, scope.liquidity_pool_key.as_ref()],
        &crate::ID,
    );
    require_keys_eq!(
        scope.pool_oracle_policy_key,
        expected_pool_oracle_policy,
        OmegaXProtocolError::PoolOracleApprovalRequired
    );
    require_keys_eq!(
        scope.pool_oracle_policy.liquidity_pool,
        scope.liquidity_pool_key,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    Ok(())
}

#[cfg(not(feature = "quasar"))]
fn validate_claim_attestation_pool_scope(
    accounts: &AttestClaimCase<'_>,
) -> Result<(Pubkey, Pubkey)> {
    if accounts.funding_line.line_type != FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION {
        require!(
            accounts.liquidity_pool.is_none()
                && accounts.capital_class.is_none()
                && accounts.allocation_position.is_none()
                && accounts.pool_oracle_approval.is_none()
                && accounts.pool_oracle_permission_set.is_none()
                && accounts.pool_oracle_policy.is_none(),
            OmegaXProtocolError::FundingLineTypeMismatch
        );
        return Ok((ZERO_PUBKEY, ZERO_PUBKEY));
    }

    let Some(liquidity_pool) = accounts.liquidity_pool.as_deref() else {
        return err!(OmegaXProtocolError::LiquidityPoolMismatch);
    };
    let Some(capital_class) = accounts.capital_class.as_deref() else {
        return err!(OmegaXProtocolError::CapitalClassMismatch);
    };
    let Some(allocation_position) = accounts.allocation_position.as_deref() else {
        return err!(OmegaXProtocolError::AllocationPositionMismatch);
    };
    let Some(pool_oracle_approval) = accounts.pool_oracle_approval.as_deref() else {
        return err!(OmegaXProtocolError::PoolOracleApprovalRequired);
    };
    let Some(pool_oracle_permission_set) = accounts.pool_oracle_permission_set.as_deref() else {
        return err!(OmegaXProtocolError::PoolOraclePermissionRequired);
    };
    let Some(pool_oracle_policy) = accounts.pool_oracle_policy.as_deref() else {
        return err!(OmegaXProtocolError::PoolOracleApprovalRequired);
    };

    let liquidity_pool_key = liquidity_pool.key();
    let allocation_position_key = allocation_position.key();
    validate_lp_claim_attestation_scope(
        &accounts.health_plan,
        &accounts.funding_line,
        &accounts.claim_case,
        &accounts.oracle_profile,
        ClaimAttestationPoolScope {
            liquidity_pool_key,
            liquidity_pool,
            capital_class_key: capital_class.key(),
            capital_class,
            allocation_position_key,
            allocation_position,
            funding_line_key: accounts.funding_line.key(),
            pool_oracle_approval_key: pool_oracle_approval.key(),
            pool_oracle_approval,
            pool_oracle_permission_set_key: pool_oracle_permission_set.key(),
            pool_oracle_permission_set,
            pool_oracle_policy_key: pool_oracle_policy.key(),
            pool_oracle_policy,
        },
    )?;

    Ok((liquidity_pool_key, allocation_position_key))
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
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
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
    #[account(
        seeds = [SEED_MEMBER_POSITION, health_plan.key().as_ref(), member_position.wallet.as_ref(), member_position.policy_series.as_ref()],
        bump = member_position.bump,
        constraint = member_position.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = member_position.policy_series == args.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = member_position.active @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.eligibility_status == ELIGIBILITY_ELIGIBLE @ OmegaXProtocolError::Unauthorized,
    )]
    #[cfg(not(feature = "quasar"))]
    pub member_position: Box<Account<'info, MemberPosition>>,
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
            member_position.address(),
            &crate::ID,
            &[SEED_MEMBER_POSITION, health_plan.address().as_ref(), member_position.wallet.as_ref(), member_position.policy_series.as_ref()],
            member_position.bump,
        ) @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.health_plan == *health_plan.address() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = member_position.policy_series == policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = member_position.active.get() @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.eligibility_status == ELIGIBILITY_ELIGIBLE @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: &'info Account<MemberPosition>,
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
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[account(
        seeds = [
            SEED_MEMBER_POSITION,
            member_position.health_plan.as_ref(),
            member_position.wallet.as_ref(),
            member_position.policy_series.as_ref(),
        ],
        bump = member_position.bump,
        constraint = member_position.wallet == authority.key() @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.active @ OmegaXProtocolError::Unauthorized,
    )]
    #[cfg(not(feature = "quasar"))]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            member_position.address(),
            &crate::ID,
            &[SEED_MEMBER_POSITION, member_position.health_plan.as_ref(), member_position.wallet.as_ref(), member_position.policy_series.as_ref()],
            member_position.bump,
        ) @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.wallet == *authority.address() @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.active.get() @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: &'info Account<MemberPosition>,
    #[account(
        mut,
        seeds = [SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id.as_bytes()],
        bump = claim_case.bump,
        constraint = claim_case.member_position == member_position.key() @ OmegaXProtocolError::Unauthorized,
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
        constraint = claim_case.member_position == *member_position.address() @ OmegaXProtocolError::Unauthorized,
    )]
    pub claim_case: Account<ClaimCaseAccountData<'info>>,
}

#[derive(Accounts)]
pub struct AttachClaimEvidenceRef<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
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
}

#[derive(Accounts)]
pub struct AdjudicateClaimCase<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
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
        seeds = [SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
        bump = reserve_asset_rail.bump,
        constraint = reserve_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = reserve_asset_rail.asset_mint == funding_line.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            reserve_asset_rail.address(),
            &crate::ID,
            &[SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
            reserve_asset_rail.bump,
        ) @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = reserve_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = reserve_asset_rail.asset_mint == funding_line.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub reserve_asset_rail: Account<ReserveAssetRailAccountData<'info>>,
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
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == funding_line.asset_mint @ OmegaXProtocolError::FeeVaultMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            protocol_fee_vault.address(),
            &crate::ID,
            &[SEED_PROTOCOL_FEE_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
            protocol_fee_vault.bump,
        ) @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == funding_line.asset_mint @ OmegaXProtocolError::FeeVaultMismatch,
    )]
    pub protocol_fee_vault: &'info mut Account<ProtocolFeeVault>,
    /// Phase 1.6 — optional pool-oracle fee vault for attesting-oracle revshare.
    /// When supplied alongside `pool_oracle_policy` and `oracle_fee_attestation`,
    /// the bps from policy is applied to the gross amount and credited to the
    /// oracle that signed the supplied attestation.
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub pool_oracle_fee_vault: Option<Box<Account<'info, PoolOracleFeeVault>>>,
    #[cfg(feature = "quasar")]
    pub pool_oracle_fee_vault: Option<&'info mut Account<PoolOracleFeeVault>>,
    /// Phase 1.6 — pairs with pool_oracle_fee_vault. The handler reads
    /// `oracle_fee_bps` from policy. Required when pool_oracle_fee_vault is Some;
    /// ignored otherwise. Validated at runtime.
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_policy: Option<Box<Account<'info, PoolOraclePolicy>>>,
    #[cfg(feature = "quasar")]
    pub pool_oracle_policy: Option<&'info Account<PoolOraclePolicy>>,
    /// Phase 1.6 — matching claim attestation for the oracle fee recipient.
    /// Required when pool_oracle_fee_vault and pool_oracle_policy are supplied.
    #[cfg(not(feature = "quasar"))]
    pub oracle_fee_attestation: Option<Box<Account<'info, ClaimAttestation>>>,
    #[cfg(feature = "quasar")]
    pub oracle_fee_attestation: Option<&'info Account<ClaimAttestation>>,
    // PT-2026-04-27-01/02 fix: outflow CPI accounts. The handler resolves the
    // settlement recipient as `claim_case.delegate_recipient` if non-zero,
    // else `member_position.wallet`, and asserts
    // `recipient_token_account.owner` equals that key before transferring SPL
    // out of the PDA-owned vault token account.
    #[account(
        constraint = member_position.key() == claim_case.member_position @ OmegaXProtocolError::Unauthorized,
    )]
    #[cfg(not(feature = "quasar"))]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *member_position.address() == claim_case.member_position @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: &'info Account<MemberPosition>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = asset_mint.key() == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
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
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *vault_token_account.address() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    pub recipient_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Interface<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
}

#[derive(Accounts)]
pub struct SettleClaimCaseSelectedAsset<'info> {
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
        seeds = [SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), claim_case.asset_mint.as_ref()],
        bump = claim_asset_rail.bump,
        constraint = claim_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = claim_asset_rail.asset_mint == claim_case.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub claim_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            claim_asset_rail.address(),
            &crate::ID,
            &[SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), claim_case.asset_mint.as_ref()],
            claim_asset_rail.bump,
        ) @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = claim_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = claim_asset_rail.asset_mint == claim_case.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub claim_asset_rail: Account<ReserveAssetRailAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), payout_funding_line.asset_mint.as_ref()],
        bump = payout_asset_rail.bump,
        constraint = payout_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = payout_asset_rail.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub payout_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            payout_asset_rail.address(),
            &crate::ID,
            &[SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), payout_funding_line.asset_mint.as_ref()],
            payout_asset_rail.bump,
        ) @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = payout_asset_rail.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveAssetRailMismatch,
        constraint = payout_asset_rail.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::ReserveAssetRailMismatch,
    )]
    pub payout_asset_rail: Account<ReserveAssetRailAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), payout_funding_line.asset_mint.as_ref()],
        bump = payout_domain_asset_vault.bump,
        constraint = payout_domain_asset_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveDomainMismatch,
        constraint = payout_domain_asset_vault.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            payout_domain_asset_vault.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), payout_funding_line.asset_mint.as_ref()],
            payout_domain_asset_vault.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch,
        constraint = payout_domain_asset_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveDomainMismatch,
        constraint = payout_domain_asset_vault.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_domain_asset_vault: &'info mut Account<DomainAssetVault>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), payout_funding_line.asset_mint.as_ref()],
        bump = payout_domain_asset_ledger.bump,
        constraint = payout_domain_asset_ledger.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveDomainMismatch,
        constraint = payout_domain_asset_ledger.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            payout_domain_asset_ledger.address(),
            &crate::ID,
            &[SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), payout_funding_line.asset_mint.as_ref()],
            payout_domain_asset_ledger.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch,
        constraint = payout_domain_asset_ledger.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::ReserveDomainMismatch,
        constraint = payout_domain_asset_ledger.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), payout_funding_line.line_id.as_bytes()],
        bump = payout_funding_line.bump,
    )]
    pub payout_funding_line: Box<Account<'info, FundingLine>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            payout_funding_line.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE, health_plan.address().as_ref(), payout_funding_line.line_id().as_bytes()],
            payout_funding_line.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch
    )]
    pub payout_funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_FUNDING_LINE_LEDGER, payout_funding_line.key().as_ref(), payout_funding_line.asset_mint.as_ref()],
        bump = payout_funding_line_ledger.bump,
        constraint = payout_funding_line_ledger.funding_line == payout_funding_line.key() @ OmegaXProtocolError::FundingLineMismatch,
        constraint = payout_funding_line_ledger.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            payout_funding_line_ledger.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE_LEDGER, payout_funding_line.address().as_ref(), payout_funding_line.asset_mint.as_ref()],
            payout_funding_line_ledger.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch,
        constraint = payout_funding_line_ledger.funding_line == *payout_funding_line.address() @ OmegaXProtocolError::FundingLineMismatch,
        constraint = payout_funding_line_ledger.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_funding_line_ledger: &'info mut Account<FundingLineLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), payout_funding_line.asset_mint.as_ref()],
        bump = payout_plan_reserve_ledger.bump,
        constraint = payout_plan_reserve_ledger.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = payout_plan_reserve_ledger.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            payout_plan_reserve_ledger.address(),
            &crate::ID,
            &[SEED_PLAN_RESERVE_LEDGER, health_plan.address().as_ref(), payout_funding_line.asset_mint.as_ref()],
            payout_plan_reserve_ledger.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = payout_plan_reserve_ledger.health_plan == *health_plan.address() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = payout_plan_reserve_ledger.asset_mint == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_plan_reserve_ledger: &'info mut Account<PlanReserveLedger>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub payout_series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[cfg(feature = "quasar")]
    pub payout_series_reserve_ledger: Option<&'info mut Account<SeriesReserveLedger>>,
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
    #[account(
        constraint = member_position.key() == claim_case.member_position @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *member_position.address() == claim_case.member_position @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: &'info Account<MemberPosition>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = claim_asset_mint.key() == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub claim_asset_mint: InterfaceAccount<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *claim_asset_mint.address() == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub claim_asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = payout_asset_mint.key() == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_asset_mint: InterfaceAccount<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *payout_asset_mint.address() == payout_funding_line.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub payout_asset_mint: &'info InterfaceAccount<Mint>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        constraint = payout_vault_token_account.key() == payout_domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub payout_vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *payout_vault_token_account.address() == payout_domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub payout_vault_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    #[cfg(feature = "quasar")]
    pub recipient_token_account: &'info mut InterfaceAccount<TokenAccount>,
    #[cfg(not(feature = "quasar"))]
    pub token_program: Interface<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Interface<TokenInterface>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: AttestClaimCaseArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _decision: u8,
        _attestation_hash: [u8; 32],
        _attestation_ref_hash: [u8; 32],
        schema_key_hash: [u8; 32]
    )
)]
pub struct AttestClaimCase<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub oracle: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()],
        bump = health_plan.bump,
        constraint = health_plan.active @ OmegaXProtocolError::HealthPlanPaused,
    )]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            health_plan.address(),
            &crate::ID,
            &[SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id().as_bytes()],
            health_plan.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = health_plan.active.get() @ OmegaXProtocolError::HealthPlanPaused,
    )]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
        constraint = oracle_profile.oracle == oracle.key() @ OmegaXProtocolError::Unauthorized,
        constraint = oracle_profile.active @ OmegaXProtocolError::OracleProfileInactive,
        constraint = oracle_profile.claimed @ OmegaXProtocolError::OracleProfileUnclaimed,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = oracle_profile.oracle == *oracle.address() @ OmegaXProtocolError::Unauthorized,
        constraint = oracle_profile.active.get() @ OmegaXProtocolError::OracleProfileInactive,
        constraint = oracle_profile.claimed.get() @ OmegaXProtocolError::OracleProfileUnclaimed,
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id.as_bytes()],
        bump = claim_case.bump,
        constraint = claim_case.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
    )]
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
        constraint = claim_case.health_plan == *health_plan.address() @ OmegaXProtocolError::HealthPlanMismatch,
    )]
    pub claim_case: Account<ClaimCaseAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()],
        bump = funding_line.bump,
        constraint = funding_line.key() == claim_case.funding_line @ OmegaXProtocolError::FundingLineMismatch,
        constraint = funding_line.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = funding_line.policy_series == claim_case.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = funding_line.asset_mint == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            funding_line.address(),
            &crate::ID,
            &[SEED_FUNDING_LINE, health_plan.address().as_ref(), funding_line.line_id().as_bytes()],
            funding_line.bump,
        ) @ OmegaXProtocolError::FundingLineMismatch,
        constraint = *funding_line.address() == claim_case.funding_line @ OmegaXProtocolError::FundingLineMismatch,
        constraint = funding_line.health_plan == *health_plan.address() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = funding_line.policy_series == claim_case.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = funding_line.asset_mint == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub funding_line: Account<FundingLineAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_OUTCOME_SCHEMA, args.schema_key_hash.as_ref()],
        bump = outcome_schema.bump,
    )]
    pub outcome_schema: Box<Account<'info, OutcomeSchema>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            outcome_schema.address(),
            &crate::ID,
            &[SEED_OUTCOME_SCHEMA, schema_key_hash.as_ref()],
            outcome_schema.bump,
        ) @ OmegaXProtocolError::ClaimAttestationSchemaRequired
    )]
    pub outcome_schema: Account<OutcomeSchemaAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub liquidity_pool: Option<Box<Account<'info, LiquidityPool>>>,
    #[cfg(feature = "quasar")]
    pub liquidity_pool: Option<Account<LiquidityPoolAccountData<'info>>>,
    #[cfg(not(feature = "quasar"))]
    pub capital_class: Option<Box<Account<'info, CapitalClass>>>,
    #[cfg(feature = "quasar")]
    pub capital_class: Option<Account<CapitalClassAccountData<'info>>>,
    #[cfg(not(feature = "quasar"))]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[cfg(feature = "quasar")]
    pub allocation_position: Option<&'info Account<AllocationPosition>>,
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_approval: Option<Box<Account<'info, PoolOracleApproval>>>,
    #[cfg(feature = "quasar")]
    pub pool_oracle_approval: Option<&'info Account<PoolOracleApproval>>,
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_permission_set: Option<Box<Account<'info, PoolOraclePermissionSet>>>,
    #[cfg(feature = "quasar")]
    pub pool_oracle_permission_set: Option<&'info Account<PoolOraclePermissionSet>>,
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_policy: Option<Box<Account<'info, PoolOraclePolicy>>>,
    #[cfg(feature = "quasar")]
    pub pool_oracle_policy: Option<&'info Account<PoolOraclePolicy>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = oracle,
            space = 8 + ClaimAttestation::INIT_SPACE,
            seeds = [SEED_CLAIM_ATTESTATION, claim_case.key().as_ref(), oracle.key().as_ref()],
            bump,
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub claim_attestation: Box<Account<'info, ClaimAttestation>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                claim_attestation.address(),
                &crate::ID,
                &[SEED_CLAIM_ATTESTATION, claim_case.address().as_ref(), oracle.address().as_ref()],
                claim_attestation.bump,
            ) @ OmegaXProtocolError::ClaimCaseLinkMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub claim_attestation: &'info Account<ClaimAttestation>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
