// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

#[allow(dead_code)]
pub(crate) const REFERENCE_NAV_SCALE: u128 = 1_000_000_000;

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CapitalClassAccountingSnapshot {
    pub transitional_share_path: bool,
    pub class_mode: u8,
    pub transfer_mode: u8,
    pub restricted: bool,
    pub ring_fenced: bool,
    pub redemption_queue_enabled: bool,
    pub redemption_mode: u8,
    pub claim_mode: u8,
    pub impaired: bool,
    pub reserves: u64,
    pub encumbered_capital: u64,
    pub free_capital: u64,
    pub available_redemption_amount: u64,
    pub distribution_locked_amount: u64,
    pub reference_nav_scaled: u128,
    pub utilization_bps: u16,
}

pub(crate) fn pool_withdrawable_lamports(pool: &AccountInfo<'_>) -> Result<u64> {
    let minimum_balance = Rent::get()?.minimum_balance(pool.data_len());
    pool.lamports()
        .checked_sub(minimum_balance)
        .ok_or_else(|| error!(OmegaXProtocolV2Error::InsufficientPoolRentReserve))
}

pub(crate) fn compute_deposit_shares_out(
    amount_in: u64,
    shares_supply: u64,
    reserves_before: u64,
) -> Result<u64> {
    if shares_supply == 0 {
        require!(
            reserves_before == 0,
            OmegaXProtocolV2Error::PoolLiquidityRequiresZeroTvl
        );
        return Ok(amount_in);
    }

    require!(reserves_before > 0, OmegaXProtocolV2Error::ZeroReserves);

    let shares_out_u128 = (amount_in as u128)
        .checked_mul(shares_supply as u128)
        .ok_or(OmegaXProtocolV2Error::MathOverflow)?
        .checked_div(reserves_before as u128)
        .ok_or(OmegaXProtocolV2Error::MathOverflow)?;
    let shares_out =
        u64::try_from(shares_out_u128).map_err(|_| OmegaXProtocolV2Error::MathOverflow)?;
    require!(shares_out > 0, OmegaXProtocolV2Error::InsufficientSharesOut);
    Ok(shares_out)
}

pub(crate) fn compute_redeem_amount_out(
    shares_in: u64,
    shares_supply: u64,
    reserves_before: u64,
) -> Result<u64> {
    require!(shares_supply > 0, OmegaXProtocolV2Error::ZeroSharesSupply);
    require!(reserves_before > 0, OmegaXProtocolV2Error::ZeroReserves);

    let amount_out_u128 = (shares_in as u128)
        .checked_mul(reserves_before as u128)
        .ok_or(OmegaXProtocolV2Error::MathOverflow)?
        .checked_div(shares_supply as u128)
        .ok_or(OmegaXProtocolV2Error::MathOverflow)?;
    let amount_out =
        u64::try_from(amount_out_u128).map_err(|_| OmegaXProtocolV2Error::MathOverflow)?;
    require!(amount_out > 0, OmegaXProtocolV2Error::SlippageExceeded);
    Ok(amount_out)
}

pub(crate) fn compute_redeem_amount_out_against_free_capital(
    shares_in: u64,
    shares_supply: u64,
    total_balance_before: u64,
    reserve: &PoolTreasuryReserve,
) -> Result<u64> {
    let free_capital_before = free_capital_treasury_balance(total_balance_before, reserve)?;
    compute_redeem_amount_out(shares_in, shares_supply, free_capital_before)
}

#[allow(dead_code)]
pub(crate) fn build_capital_class_accounting_snapshot(
    capital_class: Option<&PoolCapitalClass>,
    risk_config: Option<&PoolRiskConfig>,
    reserve: &PoolTreasuryReserve,
    total_balance_before: u64,
    share_supply: u64,
) -> Result<CapitalClassAccountingSnapshot> {
    let transitional_share_path = capital_class.is_none();
    // The current share mint remains the compatibility baseline until a pool opts into
    // explicit capital-class metadata; once present, the class becomes the canonical
    // source for payout, restriction, and accrual semantics.
    let class_mode = capital_class
        .map(|class| class.class_mode)
        .unwrap_or(CAPITAL_CLASS_MODE_NAV);
    let transfer_mode = capital_class
        .map(|class| class.transfer_mode)
        .unwrap_or(CAPITAL_TRANSFER_MODE_PERMISSIONLESS);
    let restricted = capital_class.map(|class| class.restricted).unwrap_or(false);
    let ring_fenced = capital_class
        .map(|class| class.ring_fenced)
        .unwrap_or(false);
    let redemption_queue_enabled = capital_class
        .map(|class| class.redemption_queue_enabled)
        .unwrap_or(false);
    let redemption_mode = risk_config
        .map(|risk| risk.redemption_mode)
        .unwrap_or(POOL_REDEMPTION_MODE_OPEN);
    let claim_mode = risk_config
        .map(|risk| risk.claim_mode)
        .unwrap_or(POOL_CLAIM_MODE_OPEN);
    let impaired =
        risk_config.map(|risk| risk.impaired).unwrap_or(false) || reserve.impaired_amount > 0;
    let encumbered_capital = total_encumbered_treasury_balance(reserve)?;
    let free_capital = free_capital_treasury_balance(total_balance_before, reserve)?;
    let queue_only = redemption_queue_enabled || redemption_mode == POOL_REDEMPTION_MODE_QUEUE_ONLY;
    let available_redemption_amount =
        if queue_only || redemption_mode == POOL_REDEMPTION_MODE_PAUSED {
            0
        } else {
            free_capital
        };
    let distribution_locked_amount = if class_mode == CAPITAL_CLASS_MODE_DISTRIBUTION
        || class_mode == CAPITAL_CLASS_MODE_HYBRID
    {
        reserve.reserved_redistribution_amount
    } else {
        0
    };
    let reference_nav_scaled = if share_supply == 0 {
        REFERENCE_NAV_SCALE
    } else {
        (free_capital as u128)
            .checked_mul(REFERENCE_NAV_SCALE)
            .ok_or(OmegaXProtocolV2Error::MathOverflow)?
            .checked_div(share_supply as u128)
            .ok_or(OmegaXProtocolV2Error::MathOverflow)?
    };
    let utilization_bps = if total_balance_before == 0 {
        0
    } else {
        let utilization = (encumbered_capital as u128)
            .checked_mul(10_000)
            .ok_or(OmegaXProtocolV2Error::MathOverflow)?
            .checked_div(total_balance_before as u128)
            .ok_or(OmegaXProtocolV2Error::MathOverflow)?
            .min(10_000);
        u16::try_from(utilization).map_err(|_| OmegaXProtocolV2Error::MathOverflow)?
    };

    Ok(CapitalClassAccountingSnapshot {
        transitional_share_path,
        class_mode,
        transfer_mode,
        restricted,
        ring_fenced,
        redemption_queue_enabled,
        redemption_mode,
        claim_mode,
        impaired,
        reserves: total_balance_before,
        encumbered_capital,
        free_capital,
        available_redemption_amount,
        distribution_locked_amount,
        reference_nav_scaled,
        utilization_bps,
    })
}

pub(crate) fn assert_pool_liquidity_config(
    pool_liquidity_config: &Account<PoolLiquidityConfig>,
    pool: Pubkey,
    payout_mint: Pubkey,
    share_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        pool_liquidity_config.pool,
        pool,
        OmegaXProtocolV2Error::LiquidityConfigMismatch
    );
    require_keys_eq!(
        pool_liquidity_config.payout_mint,
        payout_mint,
        OmegaXProtocolV2Error::LiquidityConfigMismatch
    );
    require_keys_eq!(
        pool_liquidity_config.share_mint,
        share_mint,
        OmegaXProtocolV2Error::ShareMintMismatch
    );
    Ok(())
}

pub(crate) fn schedule_redemption_request(
    request: &mut PoolRedemptionRequest,
    now: i64,
) -> Result<()> {
    require!(
        request.status == REDEMPTION_REQUEST_STATUS_PENDING,
        OmegaXProtocolV2Error::InvalidRedemptionRequestState
    );
    require!(
        now >= request.notice_matures_at,
        OmegaXProtocolV2Error::RedemptionRequestNotMatured
    );
    request.status = REDEMPTION_REQUEST_STATUS_SCHEDULED;
    request.scheduled_at = now;
    Ok(())
}

fn assert_live_redemption_request(request: &PoolRedemptionRequest) -> Result<()> {
    require!(
        request.status == REDEMPTION_REQUEST_STATUS_PENDING
            || request.status == REDEMPTION_REQUEST_STATUS_SCHEDULED,
        OmegaXProtocolV2Error::InvalidRedemptionRequestState
    );
    Ok(())
}

pub(crate) fn cancel_redemption_request(
    request: &mut PoolRedemptionRequest,
    now: i64,
) -> Result<()> {
    assert_live_redemption_request(request)?;
    request.status = REDEMPTION_REQUEST_STATUS_CANCELLED;
    request.cancelled_at = now;
    Ok(())
}

pub(crate) fn fail_redemption_request(
    request: &mut PoolRedemptionRequest,
    now: i64,
    failure_code: u16,
) -> Result<()> {
    assert_live_redemption_request(request)?;
    request.status = REDEMPTION_REQUEST_STATUS_FAILED;
    request.failed_at = now;
    request.failure_code = failure_code;
    Ok(())
}

pub(crate) fn fulfill_redemption_request(
    request: &mut PoolRedemptionRequest,
    now: i64,
    amount_out: u64,
) -> Result<()> {
    assert_live_redemption_request(request)?;
    require!(
        now >= request.notice_matures_at,
        OmegaXProtocolV2Error::RedemptionRequestNotMatured
    );
    request.status = REDEMPTION_REQUEST_STATUS_FULFILLED;
    request.fulfilled_at = now;
    request.expected_amount_out = amount_out;
    request.failure_code = 0;
    Ok(())
}

pub(crate) fn mint_pool_shares<'info>(
    pool: Pubkey,
    pool_liquidity_config: &Account<'info, PoolLiquidityConfig>,
    pool_share_mint: &Account<'info, Mint>,
    destination_share_token_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    shares_out: u64,
) -> Result<()> {
    let signer_seeds: &[&[u8]] = &[
        SEED_POOL_LIQUIDITY_CONFIG,
        pool.as_ref(),
        &[pool_liquidity_config.bump],
    ];
    let signer_groups = [signer_seeds];

    let cpi_ctx = CpiContext::new_with_signer(
        token_program.to_account_info(),
        MintTo {
            mint: pool_share_mint.to_account_info(),
            to: destination_share_token_account.to_account_info(),
            authority: pool_liquidity_config.to_account_info(),
        },
        &signer_groups,
    );
    token::mint_to(cpi_ctx, shares_out)
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
            paid_coverage_claim_amount: 0,
            recovered_coverage_claim_amount: 0,
            impaired_amount: 25,
            last_liability_update_ts: 0,
            bump: 1,
        }
    }

    fn sample_capital_class(class_mode: u8) -> PoolCapitalClass {
        PoolCapitalClass {
            pool: Pubkey::new_unique(),
            share_mint: Pubkey::new_unique(),
            payout_mint: Pubkey::new_unique(),
            class_id_hash: [11; 32],
            series_ref_hash: [12; 32],
            compliance_profile_hash: [13; 32],
            class_mode,
            class_priority: 1,
            transfer_mode: CAPITAL_TRANSFER_MODE_RESTRICTED,
            restricted: true,
            redemption_queue_enabled: false,
            ring_fenced: true,
            lockup_secs: 86_400,
            redemption_notice_secs: 3_600,
            vintage_index: 4,
            issued_at: 10,
            updated_at: 20,
            bump: 2,
        }
    }

    fn sample_risk_config(redemption_mode: u8) -> PoolRiskConfig {
        PoolRiskConfig {
            pool: Pubkey::new_unique(),
            redemption_mode,
            claim_mode: POOL_CLAIM_MODE_OPEN,
            impaired: false,
            updated_by: Pubkey::new_unique(),
            updated_at: 99,
            bump: 3,
        }
    }

    fn error_code(error: Error) -> u32 {
        match error {
            Error::AnchorError(anchor_error) => anchor_error.error_code_number,
            other => panic!("unexpected error variant: {other:?}"),
        }
    }

    fn omega_error_code(error: OmegaXProtocolV2Error) -> u32 {
        error_code(Error::from(error))
    }

    fn sample_redemption_request(status: u8, notice_matures_at: i64) -> PoolRedemptionRequest {
        PoolRedemptionRequest {
            pool: Pubkey::new_unique(),
            redeemer: Pubkey::new_unique(),
            share_mint: Pubkey::new_unique(),
            payout_mint: Pubkey::new_unique(),
            request_hash: [3; 32],
            share_escrow: Pubkey::new_unique(),
            status,
            shares_requested: 100,
            min_amount_out: 50,
            expected_amount_out: 60,
            notice_matures_at,
            requested_at: 1,
            scheduled_at: 0,
            fulfilled_at: 0,
            cancelled_at: 0,
            failed_at: 0,
            failure_code: 0,
            bump: 4,
        }
    }

    #[test]
    fn redeem_amount_out_uses_only_free_capital() {
        let reserve = sample_reserve();

        assert_eq!(
            compute_redeem_amount_out_against_free_capital(100, 1_000, 2_000, &reserve).unwrap(),
            140
        );
    }

    #[test]
    fn redeem_amount_out_rejects_underwater_treasury() {
        let reserve = sample_reserve();
        let error =
            compute_redeem_amount_out_against_free_capital(100, 1_000, 500, &reserve).unwrap_err();

        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolV2Error::InsufficientUnreservedTreasuryBalance)
        );
    }

    #[test]
    fn redeem_amount_out_rejects_when_no_free_capital_remains() {
        let mut reserve = sample_reserve();
        reserve.impaired_amount = 1_425;
        let error = compute_redeem_amount_out_against_free_capital(100, 1_000, 2_000, &reserve)
            .unwrap_err();

        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolV2Error::ZeroReserves)
        );
    }

    #[test]
    fn nav_class_snapshot_keeps_transitional_share_path_false_and_open_redemption_capacity() {
        let reserve = sample_reserve();
        let class = sample_capital_class(CAPITAL_CLASS_MODE_NAV);
        let risk = sample_risk_config(POOL_REDEMPTION_MODE_OPEN);

        let snapshot = build_capital_class_accounting_snapshot(
            Some(&class),
            Some(&risk),
            &reserve,
            2_000,
            1_000,
        )
        .unwrap();

        assert!(!snapshot.transitional_share_path);
        assert_eq!(snapshot.class_mode, CAPITAL_CLASS_MODE_NAV);
        assert_eq!(snapshot.transfer_mode, CAPITAL_TRANSFER_MODE_RESTRICTED);
        assert!(snapshot.restricted);
        assert!(snapshot.ring_fenced);
        assert_eq!(snapshot.free_capital, 1_400);
        assert_eq!(snapshot.available_redemption_amount, 1_400);
        assert_eq!(snapshot.distribution_locked_amount, 0);
        assert_eq!(snapshot.reference_nav_scaled, 1_400_000_000);
        assert_eq!(snapshot.utilization_bps, 3_000);
    }

    #[test]
    fn distribution_class_snapshot_exposes_locked_distribution_amount_and_queue_state() {
        let reserve = sample_reserve();
        let mut class = sample_capital_class(CAPITAL_CLASS_MODE_DISTRIBUTION);
        class.redemption_queue_enabled = true;
        let risk = sample_risk_config(POOL_REDEMPTION_MODE_QUEUE_ONLY);

        let snapshot = build_capital_class_accounting_snapshot(
            Some(&class),
            Some(&risk),
            &reserve,
            2_000,
            1_000,
        )
        .unwrap();

        assert_eq!(snapshot.class_mode, CAPITAL_CLASS_MODE_DISTRIBUTION);
        assert!(snapshot.redemption_queue_enabled);
        assert_eq!(snapshot.redemption_mode, POOL_REDEMPTION_MODE_QUEUE_ONLY);
        assert_eq!(snapshot.available_redemption_amount, 0);
        assert_eq!(snapshot.distribution_locked_amount, 50);
        assert_eq!(snapshot.reference_nav_scaled, 1_400_000_000);
    }

    #[test]
    fn missing_capital_class_is_explicitly_treated_as_transitional_share_path() {
        let reserve = sample_reserve();
        let snapshot =
            build_capital_class_accounting_snapshot(None, None, &reserve, 2_000, 1_000).unwrap();

        assert!(snapshot.transitional_share_path);
        assert_eq!(snapshot.class_mode, CAPITAL_CLASS_MODE_NAV);
        assert_eq!(snapshot.transfer_mode, CAPITAL_TRANSFER_MODE_PERMISSIONLESS);
        assert_eq!(snapshot.redemption_mode, POOL_REDEMPTION_MODE_OPEN);
        assert_eq!(snapshot.available_redemption_amount, 1_400);
        assert_eq!(snapshot.utilization_bps, 3_000);
    }

    #[test]
    fn redemption_request_schedule_requires_pending_and_mature_notice() {
        let mut request = sample_redemption_request(REDEMPTION_REQUEST_STATUS_PENDING, 100);
        let error = schedule_redemption_request(&mut request, 99).unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolV2Error::RedemptionRequestNotMatured)
        );

        schedule_redemption_request(&mut request, 100).unwrap();
        assert_eq!(request.status, REDEMPTION_REQUEST_STATUS_SCHEDULED);
        assert_eq!(request.scheduled_at, 100);

        let error = schedule_redemption_request(&mut request, 101).unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolV2Error::InvalidRedemptionRequestState)
        );
    }

    #[test]
    fn redemption_request_cancel_and_fail_only_apply_to_live_states() {
        let mut pending = sample_redemption_request(REDEMPTION_REQUEST_STATUS_PENDING, 10);
        cancel_redemption_request(&mut pending, 11).unwrap();
        assert_eq!(pending.status, REDEMPTION_REQUEST_STATUS_CANCELLED);
        assert_eq!(pending.cancelled_at, 11);

        let mut scheduled = sample_redemption_request(REDEMPTION_REQUEST_STATUS_SCHEDULED, 10);
        fail_redemption_request(&mut scheduled, 12, 404).unwrap();
        assert_eq!(scheduled.status, REDEMPTION_REQUEST_STATUS_FAILED);
        assert_eq!(scheduled.failed_at, 12);
        assert_eq!(scheduled.failure_code, 404);

        let mut fulfilled = sample_redemption_request(REDEMPTION_REQUEST_STATUS_FULFILLED, 10);
        let error = cancel_redemption_request(&mut fulfilled, 13).unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolV2Error::InvalidRedemptionRequestState)
        );
    }

    #[test]
    fn redemption_request_fulfill_requires_maturity_and_records_amount_out() {
        let mut request = sample_redemption_request(REDEMPTION_REQUEST_STATUS_SCHEDULED, 50);
        let error = fulfill_redemption_request(&mut request, 49, 77).unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolV2Error::RedemptionRequestNotMatured)
        );

        fulfill_redemption_request(&mut request, 50, 77).unwrap();
        assert_eq!(request.status, REDEMPTION_REQUEST_STATUS_FULFILLED);
        assert_eq!(request.fulfilled_at, 50);
        assert_eq!(request.expected_amount_out, 77);
    }
}
