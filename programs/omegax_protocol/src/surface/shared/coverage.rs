// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) fn validate_policy_series_fields(
    display_name: &str,
    metadata_uri: &str,
    duration_secs: i64,
    premium_due_every_secs: i64,
    premium_grace_secs: i64,
    premium_amount: u64,
) -> Result<()> {
    require!(
        display_name.len() <= MAX_COVERAGE_PRODUCT_NAME_LEN,
        OmegaXProtocolError::PolicySeriesNameTooLong
    );
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        OmegaXProtocolError::PolicySeriesMetadataUriTooLong
    );
    require!(
        duration_secs > 0,
        OmegaXProtocolError::PolicySeriesDurationInvalid
    );
    require!(
        premium_due_every_secs > 0 && premium_grace_secs >= 0,
        OmegaXProtocolError::PolicySeriesPremiumScheduleInvalid
    );
    require!(premium_amount > 0, OmegaXProtocolError::InvalidAmount);
    Ok(())
}

pub(crate) fn validate_policy_series_payment_option_fields(
    _payment_mint: Pubkey,
    payment_amount: u64,
    active: bool,
) -> Result<()> {
    if active {
        require!(
            payment_amount > 0,
            OmegaXProtocolError::PolicySeriesPaymentOptionInvalid
        );
    }
    Ok(())
}

pub(crate) fn require_policy_series_active(product: &PolicySeries) -> Result<()> {
    require!(
        product.status == POLICY_SERIES_STATUS_ACTIVE,
        OmegaXProtocolError::PolicySeriesInactive
    );
    Ok(())
}

pub(crate) fn require_policy_series_allows_reward(product: &PolicySeries) -> Result<()> {
    require!(
        product.plan_mode == PLAN_MODE_REWARD,
        OmegaXProtocolError::InvalidPlanMode
    );
    Ok(())
}

pub(crate) fn require_policy_series_allows_coverage(product: &PolicySeries) -> Result<()> {
    require!(
        product.plan_mode == PLAN_MODE_PROTECTION
            || product.plan_mode == PLAN_MODE_REIMBURSEMENT
            || product.plan_mode == PLAN_MODE_REGULATED,
        OmegaXProtocolError::InvalidPlanMode
    );
    Ok(())
}

pub(crate) fn validate_policy_series_matches_policy(
    product: &Account<PolicySeries>,
    policy: &Account<PolicyPosition>,
    pool: Pubkey,
) -> Result<()> {
    require_keys_eq!(product.pool, pool, OmegaXProtocolError::AccountPoolMismatch);
    require_policy_series_active(product)?;
    require!(
        product.series_ref_hash == policy.series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require!(
        product.terms_hash == policy.terms_hash,
        OmegaXProtocolError::PolicySeriesPolicyMismatch
    );
    require!(
        product.premium_due_every_secs == policy.premium_due_every_secs,
        OmegaXProtocolError::PolicySeriesPolicyMismatch
    );
    require!(
        product.premium_grace_secs == policy.premium_grace_secs,
        OmegaXProtocolError::PolicySeriesPolicyMismatch
    );
    Ok(())
}

pub(crate) fn validate_policy_series_state_matches_policy(
    product: &PolicySeries,
    policy: &Account<PolicyPosition>,
    pool: Pubkey,
) -> Result<()> {
    require_keys_eq!(product.pool, pool, OmegaXProtocolError::AccountPoolMismatch);
    require_policy_series_active(product)?;
    require!(
        product.series_ref_hash == policy.series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require!(
        product.terms_hash == policy.terms_hash,
        OmegaXProtocolError::PolicySeriesPolicyMismatch
    );
    require!(
        product.premium_due_every_secs == policy.premium_due_every_secs,
        OmegaXProtocolError::PolicySeriesPolicyMismatch
    );
    require!(
        product.premium_grace_secs == policy.premium_grace_secs,
        OmegaXProtocolError::PolicySeriesPolicyMismatch
    );
    Ok(())
}

pub(crate) fn validate_policy_position_window(
    starts_at: i64,
    ends_at: i64,
    premium_due_every_secs: i64,
    premium_grace_secs: i64,
) -> Result<()> {
    require!(
        starts_at < ends_at,
        OmegaXProtocolError::InvalidCoverageWindow
    );
    require!(
        premium_due_every_secs > 0,
        OmegaXProtocolError::InvalidPremiumSchedule
    );
    require!(
        premium_grace_secs >= 0,
        OmegaXProtocolError::InvalidPremiumSchedule
    );
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn write_policy_position(
    policy_position: &mut Account<PolicyPosition>,
    policy_position_nft: &mut Account<PolicyPositionNft>,
    pool: Pubkey,
    member: Pubkey,
    series_ref_hash: [u8; 32],
    terms_hash: [u8; 32],
    starts_at: i64,
    ends_at: i64,
    premium_due_every_secs: i64,
    premium_grace_secs: i64,
    policy_position_bump: u8,
    policy_position_nft_bump: u8,
) -> Result<()> {
    validate_policy_position_window(
        starts_at,
        ends_at,
        premium_due_every_secs,
        premium_grace_secs,
    )?;

    policy_position.pool = pool;
    policy_position.member = member;
    policy_position.series_ref_hash = series_ref_hash;
    policy_position.terms_hash = terms_hash;
    policy_position.status = COVERAGE_STATUS_ACTIVE;
    policy_position.starts_at = starts_at;
    policy_position.ends_at = ends_at;
    policy_position.premium_due_every_secs = premium_due_every_secs;
    policy_position.premium_grace_secs = premium_grace_secs;
    policy_position.next_due_at = starts_at
        .checked_add(premium_due_every_secs)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    policy_position.nft_mint = ZERO_PUBKEY;
    policy_position.bump = policy_position_bump;

    policy_position_nft.pool = pool;
    policy_position_nft.member = member;
    policy_position_nft.series_ref_hash = series_ref_hash;
    policy_position_nft.nft_mint = ZERO_PUBKEY;
    policy_position_nft.metadata_uri = String::new();
    policy_position_nft.bump = policy_position_nft_bump;

    Ok(())
}

pub(crate) fn require_coverage_active(policy: &PolicyPosition, now: i64) -> Result<()> {
    require!(
        policy.status == COVERAGE_STATUS_ACTIVE,
        OmegaXProtocolError::CoverageNotActive
    );
    require!(
        now >= policy.starts_at,
        OmegaXProtocolError::CoverageNotActive
    );
    require!(
        now <= policy.ends_at,
        OmegaXProtocolError::CoverageNotActive
    );

    let delinquent_after = policy
        .next_due_at
        .checked_add(policy.premium_grace_secs)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    require!(
        now <= delinquent_after,
        OmegaXProtocolError::PremiumDelinquent
    );

    Ok(())
}

pub(crate) fn advance_policy_premium(policy: &mut Account<PolicyPosition>, now: i64) -> Result<()> {
    if now > policy.ends_at {
        policy.status = COVERAGE_STATUS_EXPIRED;
        return Ok(());
    }

    policy.next_due_at = policy
        .next_due_at
        .checked_add(policy.premium_due_every_secs)
        .ok_or(OmegaXProtocolError::MathOverflow)?;

    Ok(())
}
