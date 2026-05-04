// SPDX-License-Identifier: AGPL-3.0-or-later

//! Optional-account binding validators for treasury, settlement, and impairment paths.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

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
    }
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
