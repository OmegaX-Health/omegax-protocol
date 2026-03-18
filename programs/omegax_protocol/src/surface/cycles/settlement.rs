// SPDX-License-Identifier: AGPL-3.0-or-later

//! Cycle settlement and cohort-finalization handlers.

use super::*;

pub fn settle_cycle_commitment(
    ctx: Context<SettleCycleCommitment>,
    series_ref_hash: [u8; 32],
    period_index: u64,
    passed: bool,
    shield_consumed: bool,
    settled_health_alpha_score: u16,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_pool_oracle_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
        ORACLE_PERMISSION_CYCLE_SETTLE,
    )?;
    let reserve_bump = ctx.accounts.pool_treasury_reserve.bump;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.payment_mint.key(),
        reserve_bump,
    )?;

    let cycle = &mut ctx.accounts.member_cycle;
    require_keys_eq!(
        cycle.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    require!(
        cycle.member == ctx.accounts.member.key(),
        OmegaXProtocolError::MembershipMemberMismatch
    );
    require!(
        cycle.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require!(
        cycle.period_index == period_index,
        OmegaXProtocolError::InvalidPremiumPeriodIndex
    );
    require!(
        cycle.status == MEMBER_CYCLE_STATUS_ACTIVE,
        OmegaXProtocolError::MemberCycleAlreadySettled
    );
    require!(
        cycle.commitment_enabled,
        OmegaXProtocolError::CycleCommitmentNotEnabled
    );
    require_keys_eq!(
        cycle.payment_mint,
        ctx.accounts.payment_mint.key(),
        OmegaXProtocolError::PayoutMintMismatch
    );
    if shield_consumed {
        require!(
            cycle.included_shield_count > 0 || cycle.shield_fee_raw > 0,
            OmegaXProtocolError::ShieldNotAvailable
        );
    }
    if member_cycle_uses_health_alpha_outcome(cycle) {
        let cohort_bump = ctx.bumps.cohort_settlement_root;
        upsert_cohort_settlement_root(
            &mut ctx.accounts.cohort_settlement_root,
            ctx.accounts.pool.key(),
            cycle.series_ref_hash,
            ctx.accounts.payment_mint.key(),
            cycle.cohort_hash,
            cycle.outcome_threshold_score,
            cohort_bump,
        )?;
        require!(
            !ctx.accounts.cohort_settlement_root.finalized,
            OmegaXProtocolError::CohortSettlementAlreadyFinalized
        );
        require!(
            (settled_health_alpha_score >= cycle.outcome_threshold_score) == passed,
            OmegaXProtocolError::HealthAlphaOutcomeMismatch
        );
    } else {
        require!(
            settled_health_alpha_score == 0,
            OmegaXProtocolError::InvalidCycleQuote
        );
    }

    ctx.accounts.pool_treasury_reserve.reserved_refund_amount = ctx
        .accounts
        .pool_treasury_reserve
        .reserved_refund_amount
        .checked_sub(cycle.bond_amount_raw)
        .ok_or(OmegaXProtocolError::InsufficientReservedRefundBalance)?;

    if member_cycle_uses_health_alpha_outcome(cycle) {
        if passed {
            ctx.accounts.cohort_settlement_root.successful_member_count = ctx
                .accounts
                .cohort_settlement_root
                .successful_member_count
                .checked_add(1)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
            ctx.accounts
                .cohort_settlement_root
                .successful_health_alpha_score_sum = ctx
                .accounts
                .cohort_settlement_root
                .successful_health_alpha_score_sum
                .checked_add(u64::from(settled_health_alpha_score))
                .ok_or(OmegaXProtocolError::MathOverflow)?;
        } else if !shield_consumed && cycle.bond_amount_raw > 0 {
            ctx.accounts
                .cohort_settlement_root
                .redistributable_failed_bonds_total = ctx
                .accounts
                .cohort_settlement_root
                .redistributable_failed_bonds_total
                .checked_add(cycle.bond_amount_raw)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
            ctx.accounts
                .pool_treasury_reserve
                .reserved_redistribution_amount = ctx
                .accounts
                .pool_treasury_reserve
                .reserved_redistribution_amount
                .checked_add(cycle.bond_amount_raw)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
        }
    }
    touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;

    if cycle_bond_refund_eligible(passed, shield_consumed) && cycle.bond_amount_raw > 0 {
        require!(
            ctx.accounts.recipient_token_account.owner == ctx.accounts.member.key(),
            OmegaXProtocolError::RecipientMismatch
        );
        transfer_spl_reward(
            &ctx.accounts.pool_asset_vault,
            &ctx.accounts.pool_vault_token_account,
            &ctx.accounts.recipient_token_account,
            &ctx.accounts.token_program,
            cycle.bond_amount_raw,
        )?;
    }

    cycle.status = MEMBER_CYCLE_STATUS_SETTLED;
    cycle.passed = passed;
    cycle.shield_consumed = shield_consumed;
    cycle.settled_health_alpha_score = settled_health_alpha_score;
    cycle.settled_at = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn settle_cycle_commitment_sol(
    ctx: Context<SettleCycleCommitmentSol>,
    series_ref_hash: [u8; 32],
    period_index: u64,
    passed: bool,
    shield_consumed: bool,
    settled_health_alpha_score: u16,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_pool_oracle_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
        ORACLE_PERMISSION_CYCLE_SETTLE,
    )?;
    let reserve_bump = ctx.accounts.pool_treasury_reserve.bump;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ZERO_PUBKEY,
        reserve_bump,
    )?;

    let cycle = &mut ctx.accounts.member_cycle;
    require_keys_eq!(
        cycle.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    require!(
        cycle.member == ctx.accounts.member.key(),
        OmegaXProtocolError::MembershipMemberMismatch
    );
    require!(
        cycle.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require!(
        cycle.period_index == period_index,
        OmegaXProtocolError::InvalidPremiumPeriodIndex
    );
    require!(
        cycle.status == MEMBER_CYCLE_STATUS_ACTIVE,
        OmegaXProtocolError::MemberCycleAlreadySettled
    );
    require!(
        cycle.commitment_enabled,
        OmegaXProtocolError::CycleCommitmentNotEnabled
    );
    require!(
        cycle.payment_mint == ZERO_PUBKEY,
        OmegaXProtocolError::PayoutMintMismatch
    );
    if shield_consumed {
        require!(
            cycle.included_shield_count > 0 || cycle.shield_fee_raw > 0,
            OmegaXProtocolError::ShieldNotAvailable
        );
    }
    if member_cycle_uses_health_alpha_outcome(cycle) {
        let cohort_bump = ctx.bumps.cohort_settlement_root;
        upsert_cohort_settlement_root(
            &mut ctx.accounts.cohort_settlement_root,
            ctx.accounts.pool.key(),
            cycle.series_ref_hash,
            ZERO_PUBKEY,
            cycle.cohort_hash,
            cycle.outcome_threshold_score,
            cohort_bump,
        )?;
        require!(
            !ctx.accounts.cohort_settlement_root.finalized,
            OmegaXProtocolError::CohortSettlementAlreadyFinalized
        );
        require!(
            (settled_health_alpha_score >= cycle.outcome_threshold_score) == passed,
            OmegaXProtocolError::HealthAlphaOutcomeMismatch
        );
    } else {
        require!(
            settled_health_alpha_score == 0,
            OmegaXProtocolError::InvalidCycleQuote
        );
    }

    ctx.accounts.pool_treasury_reserve.reserved_refund_amount = ctx
        .accounts
        .pool_treasury_reserve
        .reserved_refund_amount
        .checked_sub(cycle.bond_amount_raw)
        .ok_or(OmegaXProtocolError::InsufficientReservedRefundBalance)?;

    if member_cycle_uses_health_alpha_outcome(cycle) {
        if passed {
            ctx.accounts.cohort_settlement_root.successful_member_count = ctx
                .accounts
                .cohort_settlement_root
                .successful_member_count
                .checked_add(1)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
            ctx.accounts
                .cohort_settlement_root
                .successful_health_alpha_score_sum = ctx
                .accounts
                .cohort_settlement_root
                .successful_health_alpha_score_sum
                .checked_add(u64::from(settled_health_alpha_score))
                .ok_or(OmegaXProtocolError::MathOverflow)?;
        } else if !shield_consumed && cycle.bond_amount_raw > 0 {
            ctx.accounts
                .cohort_settlement_root
                .redistributable_failed_bonds_total = ctx
                .accounts
                .cohort_settlement_root
                .redistributable_failed_bonds_total
                .checked_add(cycle.bond_amount_raw)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
            ctx.accounts
                .pool_treasury_reserve
                .reserved_redistribution_amount = ctx
                .accounts
                .pool_treasury_reserve
                .reserved_redistribution_amount
                .checked_add(cycle.bond_amount_raw)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
        }
    }
    touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;

    if cycle_bond_refund_eligible(passed, shield_consumed) && cycle.bond_amount_raw > 0 {
        require_keys_eq!(
            ctx.accounts.recipient_system_account.key(),
            ctx.accounts.member.key(),
            OmegaXProtocolError::RecipientMismatch
        );
        transfer_program_owned_lamports(
            &ctx.accounts.pool.to_account_info(),
            &ctx.accounts.recipient_system_account.to_account_info(),
            cycle.bond_amount_raw,
        )?;
    }

    cycle.status = MEMBER_CYCLE_STATUS_SETTLED;
    cycle.passed = passed;
    cycle.shield_consumed = shield_consumed;
    cycle.settled_health_alpha_score = settled_health_alpha_score;
    cycle.settled_at = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn finalize_cohort_settlement_root(
    ctx: Context<FinalizeCohortSettlementRoot>,
    series_ref_hash: [u8; 32],
    cohort_hash: [u8; 32],
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_pool_oracle_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
        ORACLE_PERMISSION_CYCLE_SETTLE,
    )?;
    let reserve_bump = ctx.accounts.pool_treasury_reserve.bump;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        reserve_bump,
    )?;
    require_keys_eq!(
        ctx.accounts.pool_terms.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    require!(
        !ctx.accounts.cohort_settlement_root.finalized,
        OmegaXProtocolError::CohortSettlementAlreadyFinalized
    );
    require!(
        !is_zero_hash(&ctx.accounts.cohort_settlement_root.cohort_hash),
        OmegaXProtocolError::InvalidCohortSettlementRoot
    );
    require!(
        ctx.accounts.cohort_settlement_root.cohort_hash == cohort_hash,
        OmegaXProtocolError::CohortHashMismatch
    );
    require!(
        ctx.accounts.cohort_settlement_root.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require!(
        ctx.accounts.cohort_settlement_root.outcome_threshold_score > 0,
        OmegaXProtocolError::InvalidCohortSettlementRoot
    );
    require_keys_eq!(
        ctx.accounts.cohort_settlement_root.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.cohort_settlement_root.payment_mint,
        ctx.accounts.pool_terms.payout_asset_mint,
        OmegaXProtocolError::PayoutMintMismatch
    );

    if ctx.accounts.cohort_settlement_root.successful_member_count == 0
        && ctx
            .accounts
            .cohort_settlement_root
            .redistributable_failed_bonds_total
            > 0
        && !ctx.accounts.cohort_settlement_root.zero_success_released
    {
        ctx.accounts
            .pool_treasury_reserve
            .reserved_redistribution_amount = ctx
            .accounts
            .pool_treasury_reserve
            .reserved_redistribution_amount
            .checked_sub(
                ctx.accounts
                    .cohort_settlement_root
                    .redistributable_failed_bonds_total,
            )
            .ok_or(OmegaXProtocolError::InsufficientReservedRedistributionBalance)?;
        touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;
        ctx.accounts.cohort_settlement_root.zero_success_released = true;
    }

    ctx.accounts.cohort_settlement_root.finalized = true;
    ctx.accounts.cohort_settlement_root.finalized_at = Clock::get()?.unix_timestamp;

    Ok(())
}
