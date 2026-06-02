// SPDX-License-Identifier: AGPL-3.0-or-later

//! Optional-account binding validators for treasury, settlement, and impairment paths.

use crate::platform::*;

use super::{
    require_allocation_position_allocatable, require_capital_class_active,
    require_liquidity_pool_active,
};
use crate::constants::*;
use crate::errors::*;
use crate::state::*;

pub(crate) fn validate_optional_policy_series(
    policy_series: Option<&Account<PolicySeries>>,
    expected_policy_series: Pubkey,
    expected_health_plan: Pubkey,
    require_active: bool,
) -> Result<()> {
    if expected_policy_series == ZERO_PUBKEY {
        require!(
            policy_series.is_none(),
            OmegaXProtocolError::PolicySeriesMismatch
        );
        return Ok(());
    }

    let series = policy_series.ok_or(OmegaXProtocolError::PolicySeriesMissing)?;
    require_keys_eq!(
        series.key(),
        expected_policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require_keys_eq!(
        series.health_plan,
        expected_health_plan,
        OmegaXProtocolError::HealthPlanMismatch
    );
    let (expected_series, expected_bump) = Pubkey::find_program_address(
        &[
            SEED_POLICY_SERIES,
            expected_health_plan.as_ref(),
            series.series_id.as_bytes(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        series.key(),
        expected_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        series.bump == expected_bump,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    if require_active {
        require!(
            series.status == SERIES_STATUS_ACTIVE,
            OmegaXProtocolError::PolicySeriesMismatch
        );
    }

    Ok(())
}

pub(crate) fn validate_optional_series_ledger(
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
        let (expected_ledger, expected_bump) = Pubkey::find_program_address(
            &[
                SEED_SERIES_RESERVE_LEDGER,
                expected_policy_series.as_ref(),
                expected_asset_mint.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(
            ledger.key(),
            expected_ledger,
            OmegaXProtocolError::PolicySeriesMismatch
        );
        require!(
            ledger.bump == expected_bump,
            OmegaXProtocolError::PolicySeriesMismatch
        );
    }
    Ok(())
}

pub(crate) fn validate_optional_pool_class_ledger(
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
        let (expected_ledger, expected_bump) = Pubkey::find_program_address(
            &[
                SEED_POOL_CLASS_LEDGER,
                expected_capital_class.as_ref(),
                expected_asset_mint.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(
            ledger.key(),
            expected_ledger,
            OmegaXProtocolError::CapitalClassMismatch
        );
        require!(
            ledger.bump == expected_bump,
            OmegaXProtocolError::CapitalClassMismatch
        );
    }
    Ok(())
}

pub(crate) fn validate_optional_allocation_position(
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
            position.key(),
            expected_allocation_position,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            position.funding_line,
            expected_funding_line,
            OmegaXProtocolError::FundingLineMismatch
        );
        let (expected_position, expected_bump) = Pubkey::find_program_address(
            &[
                SEED_ALLOCATION_POSITION,
                position.capital_class.as_ref(),
                expected_funding_line.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(
            position.key(),
            expected_position,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require!(
            position.bump == expected_bump,
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }
    Ok(())
}

pub(crate) fn validate_optional_allocation_ledger(
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
        let (expected_ledger, expected_bump) = Pubkey::find_program_address(
            &[
                SEED_ALLOCATION_LEDGER,
                expected_allocation_position.as_ref(),
                expected_asset_mint.as_ref(),
            ],
            &crate::ID,
        );
        require_keys_eq!(
            ledger.key(),
            expected_ledger,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require!(
            ledger.bump == expected_bump,
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }
    Ok(())
}

pub(crate) fn validate_obligation_creation_scope(
    liquidity_pool: Option<&Account<LiquidityPool>>,
    capital_class: Option<&Account<CapitalClass>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    health_plan: &Account<HealthPlan>,
    funding_line_key: Pubkey,
    funding_line: &FundingLine,
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
        health_plan.key(),
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
        pool.key(),
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
    let (expected_pool_pda, expected_pool_bump) = Pubkey::find_program_address(
        &[
            SEED_LIQUIDITY_POOL,
            health_plan.reserve_domain.as_ref(),
            pool.pool_id.as_bytes(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        pool.key(),
        expected_pool_pda,
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require!(
        pool.bump == expected_pool_bump,
        OmegaXProtocolError::LiquidityPoolMismatch
    );

    require_keys_eq!(
        class.key(),
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
        pool.key(),
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    let (expected_class_pda, expected_class_bump) = Pubkey::find_program_address(
        &[
            SEED_CAPITAL_CLASS,
            pool.key().as_ref(),
            class.class_id.as_bytes(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        class.key(),
        expected_class_pda,
        OmegaXProtocolError::CapitalClassMismatch
    );
    require!(
        class.bump == expected_class_bump,
        OmegaXProtocolError::CapitalClassMismatch
    );

    validate_optional_pool_class_ledger(
        pool_class_ledger,
        expected_capital_class,
        funding_line.asset_mint,
    )?;
    validate_optional_allocation_position(
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
        pool.key(),
        OmegaXProtocolError::LiquidityPoolMismatch
    );
    require_keys_eq!(
        position.capital_class,
        class.key(),
        OmegaXProtocolError::CapitalClassMismatch
    );
    require_liquidity_pool_active(pool)?;
    require_capital_class_active(class)?;
    require_allocation_position_allocatable(position)?;
    validate_optional_allocation_ledger(
        allocation_ledger,
        expected_allocation_position,
        funding_line.asset_mint,
    )
}

pub(crate) fn validate_obligation_binding(
    obligation: &Account<Obligation>,
    expected_funding_line: Pubkey,
    funding_line: &FundingLine,
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

    let (expected_obligation, expected_bump) = Pubkey::find_program_address(
        &[
            SEED_OBLIGATION,
            expected_funding_line.as_ref(),
            obligation.obligation_id.as_bytes(),
        ],
        &crate::ID,
    );
    require_keys_eq!(
        obligation.key(),
        expected_obligation,
        OmegaXProtocolError::ObligationMismatch
    );
    require!(
        obligation.bump == expected_bump,
        OmegaXProtocolError::ObligationMismatch
    );

    Ok(())
}

pub(crate) fn validate_treasury_mutation_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    obligation: &Obligation,
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

    validate_optional_series_ledger(
        series_ledger,
        obligation.policy_series,
        obligation.asset_mint,
    )?;
    validate_optional_pool_class_ledger(
        pool_class_ledger,
        obligation.capital_class,
        obligation.asset_mint,
    )?;
    validate_optional_allocation_position(
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
    validate_optional_allocation_ledger(
        allocation_ledger,
        obligation.allocation_position,
        obligation.asset_mint,
    )
}

pub(crate) fn validate_direct_claim_settlement_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    claim_case: &ClaimCase,
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
    validate_optional_series_ledger(
        series_ledger,
        claim_case.policy_series,
        claim_case.asset_mint,
    )?;
    if pool_class_ledger.is_some() || allocation_position.is_some() || allocation_ledger.is_some() {
        return err!(OmegaXProtocolError::AllocationPositionMismatch);
    }
    Ok(())
}

pub(crate) fn validate_impairment_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    obligation: Option<&Account<Obligation>>,
    funding_line_key: Pubkey,
    funding_line: &FundingLine,
) -> Result<()> {
    validate_optional_series_ledger(
        series_ledger,
        funding_line.policy_series,
        funding_line.asset_mint,
    )?;

    if let Some(obligation) = obligation {
        validate_obligation_binding(obligation, funding_line_key, funding_line)?;
        return validate_treasury_mutation_bindings(
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
        .map(|position| position.key())
        .unwrap_or(ZERO_PUBKEY);
    if pool_class_ledger.is_some() || allocation_ledger.is_some() {
        require!(
            allocation_key != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }
    validate_optional_allocation_position(allocation_position, allocation_key, funding_line_key)?;
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
            position.active,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        validate_optional_pool_class_ledger(
            Some(class_ledger),
            position.capital_class,
            funding_line.asset_mint,
        )?;
    } else if pool_class_ledger.is_some() {
        return err!(OmegaXProtocolError::CapitalClassMismatch);
    }
    validate_optional_allocation_ledger(allocation_ledger, allocation_key, funding_line.asset_mint)
}
