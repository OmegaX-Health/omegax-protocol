// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) fn upsert_pool_treasury_reserve(
    reserve: &mut Account<PoolTreasuryReserve>,
    pool: Pubkey,
    payment_mint: Pubkey,
    bump: u8,
) -> Result<()> {
    if reserve.pool == ZERO_PUBKEY {
        reserve.pool = pool;
        reserve.payment_mint = payment_mint;
        reserve.reserved_refund_amount = 0;
        reserve.reserved_reward_amount = 0;
        reserve.reserved_redistribution_amount = 0;
        reserve.manual_coverage_reserve_amount = 0;
        reserve.reserved_coverage_claim_amount = 0;
        reserve.paid_coverage_claim_amount = 0;
        reserve.recovered_coverage_claim_amount = 0;
        reserve.impaired_amount = 0;
        reserve.last_liability_update_ts = 0;
        reserve.bump = bump;
    } else {
        require_keys_eq!(reserve.pool, pool, OmegaXProtocolError::AccountPoolMismatch);
        require_keys_eq!(
            reserve.payment_mint,
            payment_mint,
            OmegaXProtocolError::PayoutMintMismatch
        );
    }
    Ok(())
}

pub(crate) fn total_reserved_treasury_balance(reserve: &PoolTreasuryReserve) -> Result<u64> {
    reserve
        .reserved_refund_amount
        .checked_add(reserve.reserved_reward_amount)
        .and_then(|value| value.checked_add(reserve.reserved_redistribution_amount))
        .and_then(|value| value.checked_add(reserve.manual_coverage_reserve_amount))
        .and_then(|value| value.checked_add(reserve.reserved_coverage_claim_amount))
        .ok_or(OmegaXProtocolError::MathOverflow.into())
}

pub(crate) fn total_encumbered_treasury_balance(reserve: &PoolTreasuryReserve) -> Result<u64> {
    total_reserved_treasury_balance(reserve)?
        .checked_add(reserve.impaired_amount)
        .ok_or(OmegaXProtocolError::MathOverflow.into())
}

pub(crate) fn upsert_cohort_settlement_root(
    root: &mut Account<CohortSettlementRoot>,
    pool: Pubkey,
    series_ref_hash: [u8; 32],
    payment_mint: Pubkey,
    cohort_hash: [u8; 32],
    outcome_threshold_score: u16,
    bump: u8,
) -> Result<()> {
    if root.pool == ZERO_PUBKEY {
        root.pool = pool;
        root.series_ref_hash = series_ref_hash;
        root.payment_mint = payment_mint;
        root.cohort_hash = cohort_hash;
        root.outcome_threshold_score = outcome_threshold_score;
        root.successful_member_count = 0;
        root.successful_health_alpha_score_sum = 0;
        root.redistributable_failed_bonds_total = 0;
        root.redistribution_claimed_amount = 0;
        root.successful_claim_count = 0;
        root.finalized = false;
        root.zero_success_released = false;
        root.finalized_at = 0;
        root.bump = bump;
    } else {
        require_keys_eq!(root.pool, pool, OmegaXProtocolError::AccountPoolMismatch);
        require!(
            root.series_ref_hash == series_ref_hash,
            OmegaXProtocolError::PolicySeriesIdMismatch
        );
        require_keys_eq!(
            root.payment_mint,
            payment_mint,
            OmegaXProtocolError::PayoutMintMismatch
        );
        require!(
            root.cohort_hash == cohort_hash,
            OmegaXProtocolError::CohortHashMismatch
        );
        require!(
            root.outcome_threshold_score == outcome_threshold_score,
            OmegaXProtocolError::OutcomeThresholdScoreMismatch
        );
    }
    Ok(())
}

pub(crate) fn require_cohort_settlement_root_matches_cycle(
    root: &CohortSettlementRoot,
    pool: Pubkey,
    payment_mint: Pubkey,
    cycle: &MemberCycleState,
) -> Result<()> {
    require_keys_eq!(root.pool, pool, OmegaXProtocolError::AccountPoolMismatch);
    require!(
        root.series_ref_hash == cycle.series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require_keys_eq!(
        root.payment_mint,
        payment_mint,
        OmegaXProtocolError::PayoutMintMismatch
    );
    require!(
        root.cohort_hash == cycle.cohort_hash,
        OmegaXProtocolError::CohortHashMismatch
    );
    require!(
        root.outcome_threshold_score == cycle.outcome_threshold_score,
        OmegaXProtocolError::OutcomeThresholdScoreMismatch
    );
    Ok(())
}

pub(crate) fn compute_member_redistribution_share(
    root: &CohortSettlementRoot,
    cycle: &MemberCycleState,
) -> Result<u64> {
    if root.redistributable_failed_bonds_total == 0 {
        return Ok(0);
    }
    require!(
        root.successful_member_count > 0,
        OmegaXProtocolError::CohortSettlementNotFinalized
    );
    require!(
        root.successful_health_alpha_score_sum > 0,
        OmegaXProtocolError::HealthAlphaScoreRequired
    );
    require!(
        cycle.settled_health_alpha_score > 0,
        OmegaXProtocolError::HealthAlphaScoreRequired
    );

    if root.successful_claim_count + 1 == root.successful_member_count {
        return root
            .redistributable_failed_bonds_total
            .checked_sub(root.redistribution_claimed_amount)
            .ok_or(OmegaXProtocolError::MathOverflow.into());
    }

    let numerator = u128::from(root.redistributable_failed_bonds_total)
        .checked_mul(u128::from(cycle.settled_health_alpha_score))
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    let share = numerator
        .checked_div(u128::from(root.successful_health_alpha_score_sum))
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    u64::try_from(share).map_err(|_| OmegaXProtocolError::MathOverflow.into())
}

pub(crate) fn available_treasury_balance(
    total_balance: u64,
    reserve: &PoolTreasuryReserve,
) -> Result<u64> {
    total_balance
        .checked_sub(total_encumbered_treasury_balance(reserve)?)
        .ok_or(OmegaXProtocolError::InsufficientUnreservedTreasuryBalance.into())
}

pub(crate) fn free_capital_treasury_balance(
    total_balance: u64,
    reserve: &PoolTreasuryReserve,
) -> Result<u64> {
    available_treasury_balance(total_balance, reserve)
}

pub(crate) fn touch_liability_ledger(reserve: &mut Account<PoolTreasuryReserve>) -> Result<()> {
    reserve.last_liability_update_ts = Clock::get()?.unix_timestamp;
    Ok(())
}

pub(crate) fn reward_claim_receipt_rent_lamports(payout_mint: Pubkey) -> Result<u64> {
    if payout_mint == ZERO_PUBKEY {
        return Ok(Rent::get()?.minimum_balance(ClaimRecord::space()));
    }
    Ok(0)
}

pub(crate) fn reward_claim_liability_amount(
    payout_mint: Pubkey,
    payout_amount: u64,
) -> Result<u64> {
    payout_amount
        .checked_add(reward_claim_receipt_rent_lamports(payout_mint)?)
        .ok_or(OmegaXProtocolError::MathOverflow.into())
}

pub(crate) fn reserve_reward_liability_if_needed(
    aggregate: &mut Account<CycleOutcomeAggregate>,
    reserve: &mut Account<PoolTreasuryReserve>,
    liability_amount: u64,
) -> Result<()> {
    if aggregate.finalized
        && aggregate.passed
        && !aggregate.claimed
        && !aggregate.reward_liability_reserved
    {
        reserve.reserved_reward_amount = reserve
            .reserved_reward_amount
            .checked_add(liability_amount)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
        aggregate.reward_liability_reserved = true;
        touch_liability_ledger(reserve)?;
    }
    Ok(())
}

pub(crate) fn release_reward_liability_if_needed(
    aggregate: &mut Account<CycleOutcomeAggregate>,
    reserve: &mut Account<PoolTreasuryReserve>,
    liability_amount: u64,
) -> Result<()> {
    if aggregate.reward_liability_reserved {
        reserve.reserved_reward_amount = reserve
            .reserved_reward_amount
            .checked_sub(liability_amount)
            .ok_or(OmegaXProtocolError::InsufficientReservedRewardBalance)?;
        aggregate.reward_liability_reserved = false;
        touch_liability_ledger(reserve)?;
    }
    Ok(())
}

pub(crate) fn reserve_coverage_claim_liability(
    reserve: &mut Account<PoolTreasuryReserve>,
    liability_amount: u64,
) -> Result<()> {
    reserve.reserved_coverage_claim_amount = reserve
        .reserved_coverage_claim_amount
        .checked_add(liability_amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    touch_liability_ledger(reserve)
}

pub(crate) fn release_coverage_claim_liability(
    reserve: &mut Account<PoolTreasuryReserve>,
    liability_amount: u64,
) -> Result<()> {
    reserve.reserved_coverage_claim_amount = reserve
        .reserved_coverage_claim_amount
        .checked_sub(liability_amount)
        .ok_or(OmegaXProtocolError::InsufficientReservedCoverageClaimBalance)?;
    touch_liability_ledger(reserve)
}

pub(crate) fn record_paid_coverage_claim(
    reserve: &mut Account<PoolTreasuryReserve>,
    amount: u64,
) -> Result<()> {
    reserve.paid_coverage_claim_amount = reserve
        .paid_coverage_claim_amount
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    touch_liability_ledger(reserve)
}

pub(crate) fn record_recovered_coverage_claim(
    reserve: &mut Account<PoolTreasuryReserve>,
    amount: u64,
) -> Result<()> {
    reserve.recovered_coverage_claim_amount = reserve
        .recovered_coverage_claim_amount
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    touch_liability_ledger(reserve)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn review_coverage_claim_case(
    claim: &mut CoverageClaimRecord,
    requested_amount: u64,
    evidence_hash: [u8; 32],
    interop_ref_hash: [u8; 32],
    claim_family: u8,
    interop_profile_hash: [u8; 32],
    code_system_family_hash: [u8; 32],
    now: i64,
) -> Result<()> {
    require!(requested_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        claim_family == COVERAGE_CLAIM_FAMILY_FAST
            || claim_family == COVERAGE_CLAIM_FAMILY_REIMBURSEMENT
            || claim_family == COVERAGE_CLAIM_FAMILY_REGULATED,
        OmegaXProtocolError::InvalidCoverageClaimFamily
    );
    require!(
        claim.status == COVERAGE_CLAIM_STATUS_SUBMITTED
            || claim.status == COVERAGE_CLAIM_STATUS_DENIED,
        OmegaXProtocolError::InvalidCoverageClaimStateTransition
    );

    if claim.status == COVERAGE_CLAIM_STATUS_DENIED {
        claim.appeal_count = claim
            .appeal_count
            .checked_add(1)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
    }

    claim.status = COVERAGE_CLAIM_STATUS_UNDER_REVIEW;
    claim.claim_family = claim_family;
    claim.requested_amount = requested_amount;
    claim.evidence_hash = evidence_hash;
    claim.interop_ref_hash = interop_ref_hash;
    claim.interop_profile_hash = interop_profile_hash;
    claim.code_system_family_hash = code_system_family_hash;
    claim.decision_reason_hash = ZERO_PUBKEY_BYTES;
    claim.adjudication_ref_hash = ZERO_PUBKEY_BYTES;
    claim.reviewed_at = now;
    claim.closed_at = 0;

    Ok(())
}

pub(crate) fn approve_coverage_claim_case(
    claim: &mut CoverageClaimRecord,
    approved_amount: u64,
    decision_reason_hash: [u8; 32],
    adjudication_ref_hash: [u8; 32],
    now: i64,
) -> Result<()> {
    require!(approved_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        claim.status == COVERAGE_CLAIM_STATUS_UNDER_REVIEW,
        OmegaXProtocolError::InvalidCoverageClaimStateTransition
    );

    claim.status = COVERAGE_CLAIM_STATUS_APPROVED;
    claim.approved_amount = approved_amount;
    claim.reserved_amount = approved_amount;
    claim.decision_reason_hash = decision_reason_hash;
    claim.adjudication_ref_hash = adjudication_ref_hash;
    claim.reviewed_at = now;
    claim.closed_at = 0;

    Ok(())
}

pub(crate) fn deny_coverage_claim_case(
    claim: &mut CoverageClaimRecord,
    decision_reason_hash: [u8; 32],
    adjudication_ref_hash: [u8; 32],
    now: i64,
) -> Result<u64> {
    require!(
        claim.status == COVERAGE_CLAIM_STATUS_SUBMITTED
            || claim.status == COVERAGE_CLAIM_STATUS_UNDER_REVIEW
            || claim.status == COVERAGE_CLAIM_STATUS_APPROVED
            || claim.status == COVERAGE_CLAIM_STATUS_PARTIALLY_PAID,
        OmegaXProtocolError::InvalidCoverageClaimStateTransition
    );

    let reserve_release = claim.reserved_amount;
    claim.status = COVERAGE_CLAIM_STATUS_DENIED;
    claim.reserved_amount = 0;
    claim.decision_reason_hash = decision_reason_hash;
    claim.adjudication_ref_hash = adjudication_ref_hash;
    claim.reviewed_at = now;
    claim.closed_at = 0;

    Ok(reserve_release)
}

pub(crate) fn record_coverage_claim_payment(
    claim: &mut CoverageClaimRecord,
    payout_amount: u64,
    now: i64,
) -> Result<()> {
    require!(payout_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        claim.status == COVERAGE_CLAIM_STATUS_APPROVED
            || claim.status == COVERAGE_CLAIM_STATUS_PARTIALLY_PAID,
        OmegaXProtocolError::InvalidCoverageClaimStateTransition
    );
    require!(
        payout_amount <= claim.reserved_amount,
        OmegaXProtocolError::CoverageClaimPayoutExceedsReservedAmount
    );

    claim.paid_amount = claim
        .paid_amount
        .checked_add(payout_amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    claim.reserved_amount = claim
        .reserved_amount
        .checked_sub(payout_amount)
        .ok_or(OmegaXProtocolError::CoverageClaimPayoutExceedsReservedAmount)?;

    if claim.reserved_amount > 0 {
        claim.status = COVERAGE_CLAIM_STATUS_PARTIALLY_PAID;
    } else {
        claim.status = COVERAGE_CLAIM_STATUS_PAID;
        claim.settled_at = now;
        claim.closed_at = now;
    }

    Ok(())
}

pub(crate) fn close_coverage_claim_case(
    claim: &mut CoverageClaimRecord,
    recovery_amount: u64,
    now: i64,
) -> Result<u64> {
    require!(
        claim.status != COVERAGE_CLAIM_STATUS_CLOSED,
        OmegaXProtocolError::CoverageClaimAlreadyClosed
    );
    require!(
        claim.status == COVERAGE_CLAIM_STATUS_DENIED
            || claim.status == COVERAGE_CLAIM_STATUS_APPROVED
            || claim.status == COVERAGE_CLAIM_STATUS_PARTIALLY_PAID
            || claim.status == COVERAGE_CLAIM_STATUS_PAID,
        OmegaXProtocolError::InvalidCoverageClaimStateTransition
    );

    let reserve_release = claim.reserved_amount;
    claim.reserved_amount = 0;
    if recovery_amount > 0 {
        let next_recovery_amount = claim
            .recovery_amount
            .checked_add(recovery_amount)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
        require!(
            next_recovery_amount <= claim.paid_amount,
            OmegaXProtocolError::CoverageClaimRecoveryExceedsPaidAmount
        );
        claim.recovery_amount = next_recovery_amount;
    }
    claim.status = COVERAGE_CLAIM_STATUS_CLOSED;
    claim.closed_at = now;

    Ok(reserve_release)
}

pub(crate) fn upsert_protocol_fee_vault(
    vault: &mut Account<ProtocolFeeVault>,
    payment_mint: Pubkey,
    bump: u8,
) {
    vault.payment_mint = payment_mint;
    vault.bump = bump;
}

pub(crate) fn upsert_pool_oracle_fee_vault(
    vault: &mut Account<PoolOracleFeeVault>,
    pool: Pubkey,
    oracle: Pubkey,
    payment_mint: Pubkey,
    bump: u8,
) {
    vault.pool = pool;
    vault.oracle = oracle;
    vault.payment_mint = payment_mint;
    vault.bump = bump;
}

pub(crate) fn write_protocol_fee_vault_account(
    account_info: &AccountInfo<'_>,
    payment_mint: Pubkey,
    bump: u8,
) -> Result<()> {
    let mut data = account_info.try_borrow_mut_data()?;
    let mut src: &[u8] = &data;
    match ProtocolFeeVault::try_deserialize(&mut src) {
        Ok(existing) => {
            require_keys_eq!(
                existing.payment_mint,
                payment_mint,
                OmegaXProtocolError::PayoutMintMismatch
            );
            require!(
                existing.bump == bump,
                OmegaXProtocolError::InvalidCycleQuote
            );
        }
        Err(_) => {
            let account = ProtocolFeeVault { payment_mint, bump };
            let mut dst: &mut [u8] = &mut data;
            account.try_serialize(&mut dst)?;
        }
    }
    Ok(())
}

pub(crate) fn write_pool_oracle_fee_vault_account(
    account_info: &AccountInfo<'_>,
    pool: Pubkey,
    oracle: Pubkey,
    payment_mint: Pubkey,
    bump: u8,
) -> Result<()> {
    let mut data = account_info.try_borrow_mut_data()?;
    let mut src: &[u8] = &data;
    match PoolOracleFeeVault::try_deserialize(&mut src) {
        Ok(existing) => {
            require_keys_eq!(
                existing.pool,
                pool,
                OmegaXProtocolError::AccountPoolMismatch
            );
            require_keys_eq!(
                existing.oracle,
                oracle,
                OmegaXProtocolError::OracleKeyMismatch
            );
            require_keys_eq!(
                existing.payment_mint,
                payment_mint,
                OmegaXProtocolError::PayoutMintMismatch
            );
            require!(
                existing.bump == bump,
                OmegaXProtocolError::InvalidCycleQuote
            );
        }
        Err(_) => {
            let account = PoolOracleFeeVault {
                pool,
                oracle,
                payment_mint,
                bump,
            };
            let mut dst: &mut [u8] = &mut data;
            account.try_serialize(&mut dst)?;
        }
    }
    Ok(())
}

pub(crate) fn write_pool_asset_vault_account(
    account_info: &AccountInfo<'_>,
    pool: Pubkey,
    payout_mint: Pubkey,
    vault_token_account: Pubkey,
    active: bool,
    bump: u8,
) -> Result<()> {
    let mut data = account_info.try_borrow_mut_data()?;
    let mut src: &[u8] = &data;
    match PoolAssetVault::try_deserialize(&mut src) {
        Ok(existing) => {
            require_keys_eq!(
                existing.pool,
                pool,
                OmegaXProtocolError::AccountPoolMismatch
            );
            require_keys_eq!(
                existing.payout_mint,
                payout_mint,
                OmegaXProtocolError::PayoutMintMismatch
            );
            require!(
                existing.vault_token_account == vault_token_account,
                OmegaXProtocolError::VaultTokenAccountMismatch
            );
            require!(
                existing.bump == bump,
                OmegaXProtocolError::InvalidCycleQuote
            );
        }
        Err(_) => {
            let account = PoolAssetVault {
                pool,
                payout_mint,
                vault_token_account,
                active,
                bump,
            };
            let mut dst: &mut [u8] = &mut data;
            account.try_serialize(&mut dst)?;
        }
    }
    Ok(())
}

pub(crate) fn transfer_sol_reward(
    ctx: &Context<SubmitRewardClaim>,
    payout_amount: u64,
) -> Result<()> {
    transfer_program_owned_lamports(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.recipient_system_account.to_account_info(),
        payout_amount,
    )
}

pub(crate) fn transfer_program_owned_lamports(
    from: &AccountInfo<'_>,
    to: &AccountInfo<'_>,
    amount: u64,
) -> Result<()> {
    let from_balance = from.lamports();
    require!(
        from_balance >= amount,
        OmegaXProtocolError::InsufficientPoolBalance
    );
    let minimum_balance = Rent::get()?.minimum_balance(from.data_len());
    let remaining = from_balance
        .checked_sub(amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    require!(
        remaining >= minimum_balance,
        OmegaXProtocolError::InsufficientPoolRentReserve
    );

    **from.try_borrow_mut_lamports()? = remaining;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    Ok(())
}

pub(crate) fn transfer_spl_reward<'info>(
    asset_vault: &Account<'info, PoolAssetVault>,
    pool_vault_token_account: &Account<'info, TokenAccount>,
    recipient_token_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    payout_amount: u64,
) -> Result<()> {
    require!(asset_vault.active, OmegaXProtocolError::MissingAssetVault);
    require!(
        asset_vault.vault_token_account == pool_vault_token_account.key(),
        OmegaXProtocolError::PayoutMintMismatch
    );
    require!(
        pool_vault_token_account.mint == asset_vault.payout_mint,
        OmegaXProtocolError::PayoutMintMismatch
    );
    require!(
        recipient_token_account.mint == asset_vault.payout_mint,
        OmegaXProtocolError::PayoutMintMismatch
    );

    let signer_seeds: &[&[u8]] = &[
        SEED_POOL_ASSET_VAULT,
        asset_vault.pool.as_ref(),
        asset_vault.payout_mint.as_ref(),
        &[asset_vault.bump],
    ];
    let signer_groups = [signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        TokenTransfer {
            from: pool_vault_token_account.to_account_info(),
            to: recipient_token_account.to_account_info(),
            authority: asset_vault.to_account_info(),
        },
        &signer_groups,
    );
    token::transfer(cpi_ctx, payout_amount)
}

pub(crate) fn transfer_spl_from_program_vault<'info>(
    authority_account: &AccountInfo<'info>,
    authority_seeds: &[&[u8]],
    source_token_account: &Account<'info, TokenAccount>,
    recipient_token_account: &Account<'info, TokenAccount>,
    payout_mint: Pubkey,
    token_program: &Program<'info, Token>,
    payout_amount: u64,
) -> Result<()> {
    require!(
        source_token_account.mint == payout_mint,
        OmegaXProtocolError::PayoutMintMismatch
    );
    require!(
        recipient_token_account.mint == payout_mint,
        OmegaXProtocolError::PayoutMintMismatch
    );

    let signer_groups = [authority_seeds];
    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        TokenTransfer {
            from: source_token_account.to_account_info(),
            to: recipient_token_account.to_account_info(),
            authority: authority_account.clone(),
        },
        &signer_groups,
    );
    token::transfer(cpi_ctx, payout_amount)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_reserve() -> PoolTreasuryReserve {
        PoolTreasuryReserve {
            pool: Pubkey::new_unique(),
            payment_mint: Pubkey::new_unique(),
            reserved_refund_amount: 100,
            reserved_reward_amount: 200,
            reserved_redistribution_amount: 50,
            manual_coverage_reserve_amount: 150,
            reserved_coverage_claim_amount: 75,
            paid_coverage_claim_amount: 20,
            recovered_coverage_claim_amount: 5,
            impaired_amount: 25,
            last_liability_update_ts: 0,
            bump: 1,
        }
    }

    fn sample_claim() -> CoverageClaimRecord {
        CoverageClaimRecord {
            pool: Pubkey::new_unique(),
            series_ref_hash: [11u8; 32],
            member: Pubkey::new_unique(),
            claimant: Pubkey::new_unique(),
            intent_hash: [1u8; 32],
            event_hash: [2u8; 32],
            evidence_hash: ZERO_PUBKEY_BYTES,
            interop_ref_hash: ZERO_PUBKEY_BYTES,
            interop_profile_hash: ZERO_PUBKEY_BYTES,
            code_system_family_hash: ZERO_PUBKEY_BYTES,
            decision_reason_hash: ZERO_PUBKEY_BYTES,
            adjudication_ref_hash: ZERO_PUBKEY_BYTES,
            status: COVERAGE_CLAIM_STATUS_SUBMITTED,
            claim_family: COVERAGE_CLAIM_FAMILY_FAST,
            appeal_count: 0,
            requested_amount: 0,
            approved_amount: 0,
            paid_amount: 0,
            reserved_amount: 0,
            recovery_amount: 0,
            ai_decision_hash: ZERO_PUBKEY_BYTES,
            ai_policy_hash: ZERO_PUBKEY_BYTES,
            ai_execution_environment_hash: ZERO_PUBKEY_BYTES,
            ai_attestation_ref_hash: ZERO_PUBKEY_BYTES,
            ai_automation_mode: AUTOMATION_MODE_DISABLED,
            submitted_at: 100,
            reviewed_at: 0,
            settled_at: 0,
            closed_at: 0,
            bump: 1,
        }
    }

    #[test]
    fn total_reserved_and_encumbered_balances_include_claim_and_impairment_state() {
        let reserve = sample_reserve();
        assert_eq!(total_reserved_treasury_balance(&reserve).unwrap(), 575);
        assert_eq!(total_encumbered_treasury_balance(&reserve).unwrap(), 600);
        assert_eq!(
            free_capital_treasury_balance(2_000, &reserve).unwrap(),
            1_400
        );
    }

    #[test]
    fn free_capital_underflow_returns_existing_liquidity_error() {
        let reserve = sample_reserve();
        assert!(free_capital_treasury_balance(500, &reserve).is_err());
    }

    #[test]
    fn review_can_reopen_denied_claim_as_an_appeal() {
        let mut claim = sample_claim();
        claim.status = COVERAGE_CLAIM_STATUS_DENIED;

        review_coverage_claim_case(
            &mut claim,
            250,
            [9u8; 32],
            [8u8; 32],
            COVERAGE_CLAIM_FAMILY_REIMBURSEMENT,
            [7u8; 32],
            [6u8; 32],
            500,
        )
        .unwrap();

        assert_eq!(claim.status, COVERAGE_CLAIM_STATUS_UNDER_REVIEW);
        assert_eq!(claim.appeal_count, 1);
        assert_eq!(claim.requested_amount, 250);
        assert_eq!(claim.evidence_hash, [9u8; 32]);
        assert_eq!(claim.interop_profile_hash, [7u8; 32]);
        assert_eq!(claim.code_system_family_hash, [6u8; 32]);
        assert_eq!(claim.claim_family, COVERAGE_CLAIM_FAMILY_REIMBURSEMENT);
    }

    #[test]
    fn partial_then_full_payment_updates_claim_case_state() {
        let mut claim = sample_claim();
        review_coverage_claim_case(
            &mut claim,
            400,
            ZERO_PUBKEY_BYTES,
            ZERO_PUBKEY_BYTES,
            COVERAGE_CLAIM_FAMILY_FAST,
            ZERO_PUBKEY_BYTES,
            ZERO_PUBKEY_BYTES,
            200,
        )
        .unwrap();
        approve_coverage_claim_case(&mut claim, 400, [3u8; 32], [4u8; 32], 300).unwrap();

        record_coverage_claim_payment(&mut claim, 150, 400).unwrap();
        assert_eq!(claim.status, COVERAGE_CLAIM_STATUS_PARTIALLY_PAID);
        assert_eq!(claim.paid_amount, 150);
        assert_eq!(claim.reserved_amount, 250);

        record_coverage_claim_payment(&mut claim, 250, 500).unwrap();
        assert_eq!(claim.status, COVERAGE_CLAIM_STATUS_PAID);
        assert_eq!(claim.paid_amount, 400);
        assert_eq!(claim.reserved_amount, 0);
        assert_eq!(claim.settled_at, 500);
    }

    #[test]
    fn close_tracks_recovery_and_releases_remaining_reserve() {
        let mut claim = sample_claim();
        review_coverage_claim_case(
            &mut claim,
            600,
            ZERO_PUBKEY_BYTES,
            ZERO_PUBKEY_BYTES,
            COVERAGE_CLAIM_FAMILY_REGULATED,
            ZERO_PUBKEY_BYTES,
            ZERO_PUBKEY_BYTES,
            200,
        )
        .unwrap();
        approve_coverage_claim_case(&mut claim, 600, [5u8; 32], [6u8; 32], 250).unwrap();
        record_coverage_claim_payment(&mut claim, 400, 300).unwrap();

        let reserve_release = close_coverage_claim_case(&mut claim, 100, 350).unwrap();
        assert_eq!(reserve_release, 200);
        assert_eq!(claim.status, COVERAGE_CLAIM_STATUS_CLOSED);
        assert_eq!(claim.reserved_amount, 0);
        assert_eq!(claim.recovery_amount, 100);
        assert_eq!(claim.closed_at, 350);
    }
}
