// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) fn upsert_pool_risk_config(
    config: &mut Account<PoolRiskConfig>,
    pool: Pubkey,
    bump: u8,
) -> Result<()> {
    if config.pool == ZERO_PUBKEY {
        config.pool = pool;
        config.redemption_mode = POOL_REDEMPTION_MODE_OPEN;
        config.claim_mode = POOL_CLAIM_MODE_OPEN;
        config.impaired = false;
        config.updated_by = ZERO_PUBKEY;
        config.updated_at = 0;
        config.bump = bump;
    } else {
        require_keys_eq!(
            config.pool,
            pool,
            OmegaXProtocolV2Error::AccountPoolMismatch
        );
    }
    Ok(())
}

pub(crate) fn assert_pool_claims_open(config: &PoolRiskConfig) -> Result<()> {
    match config.claim_mode {
        POOL_CLAIM_MODE_OPEN => Ok(()),
        POOL_CLAIM_MODE_PAUSED => Err(OmegaXProtocolV2Error::PoolClaimIntakePaused.into()),
        _ => Err(OmegaXProtocolV2Error::InvalidPoolClaimMode.into()),
    }
}

pub(crate) fn assert_pool_redemptions_open(config: &PoolRiskConfig) -> Result<()> {
    match config.redemption_mode {
        POOL_REDEMPTION_MODE_OPEN => Ok(()),
        POOL_REDEMPTION_MODE_QUEUE_ONLY => {
            Err(OmegaXProtocolV2Error::PoolRedemptionsQueueOnly.into())
        }
        POOL_REDEMPTION_MODE_PAUSED => Err(OmegaXProtocolV2Error::PoolRedemptionsPaused.into()),
        _ => Err(OmegaXProtocolV2Error::InvalidPoolRedemptionMode.into()),
    }
}
