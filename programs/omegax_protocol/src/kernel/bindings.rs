// SPDX-License-Identifier: AGPL-3.0-or-later

//! Optional-account binding validators for treasury, settlement, and impairment paths.

use crate::platform::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

pub(crate) fn validate_optional_policy_series(
    policy_series: Option<&Account<PolicySeriesAccountData<'_>>>,
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

pub(crate) fn validate_obligation_creation_scope(
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
        health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        is_supported_funding_line_type(funding_line.line_type),
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    Ok(())
}

pub(crate) fn validate_treasury_mutation_bindings(
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

pub(crate) fn validate_direct_claim_settlement_bindings(
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
