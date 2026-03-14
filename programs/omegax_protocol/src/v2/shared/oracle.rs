// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) struct OracleProfileFields<'a> {
    pub(crate) oracle_type: u8,
    pub(crate) display_name: &'a str,
    pub(crate) legal_name: &'a str,
    pub(crate) website_url: &'a str,
    pub(crate) app_url: &'a str,
    pub(crate) logo_uri: &'a str,
    pub(crate) webhook_url: &'a str,
    pub(crate) supported_schema_key_hashes: &'a [[u8; 32]],
}

impl OracleProfileFields<'_> {
    pub(crate) fn validate(&self) -> Result<()> {
        require!(
            self.oracle_type <= ORACLE_TYPE_OTHER,
            OmegaXProtocolV2Error::InvalidOracleType
        );
        require!(
            self.display_name.len() <= MAX_ORACLE_DISPLAY_NAME_LEN,
            OmegaXProtocolV2Error::OracleDisplayNameTooLong
        );
        require!(
            self.legal_name.len() <= MAX_ORACLE_LEGAL_NAME_LEN,
            OmegaXProtocolV2Error::OracleLegalNameTooLong
        );
        require!(
            self.website_url.len() <= MAX_ORACLE_URL_LEN,
            OmegaXProtocolV2Error::OracleUrlTooLong
        );
        require!(
            self.app_url.len() <= MAX_ORACLE_URL_LEN,
            OmegaXProtocolV2Error::OracleUrlTooLong
        );
        require!(
            self.logo_uri.len() <= MAX_ORACLE_LOGO_URI_LEN,
            OmegaXProtocolV2Error::OracleLogoUriTooLong
        );
        require!(
            self.webhook_url.len() <= MAX_ORACLE_WEBHOOK_URL_LEN,
            OmegaXProtocolV2Error::OracleWebhookUrlTooLong
        );
        require!(
            self.supported_schema_key_hashes.len() <= MAX_ORACLE_SUPPORTED_SCHEMAS,
            OmegaXProtocolV2Error::OracleSupportedSchemaLimitExceeded
        );
        Ok(())
    }
}

pub(crate) fn supported_schema_array(
    supported_schema_key_hashes: &[[u8; 32]],
) -> [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS] {
    let mut out = [[0u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS];
    for (idx, hash) in supported_schema_key_hashes.iter().enumerate() {
        out[idx] = *hash;
    }
    out
}

pub(crate) fn require_oracle_data_attest_permission(
    pool: Pubkey,
    oracle: Pubkey,
    pool_oracle: &PoolOracleApproval,
    pool_oracle_permissions: &PoolOraclePermissionSet,
) -> Result<()> {
    require_pool_oracle_permission(
        pool,
        oracle,
        pool_oracle,
        pool_oracle_permissions,
        ORACLE_PERMISSION_DATA_ATTEST,
    )
}

#[allow(dead_code)]
pub(crate) fn oracle_role_required_permission(role: u8) -> Result<u32> {
    match role {
        ORACLE_ROLE_QUOTE_ATTESTER => Ok(ORACLE_PERMISSION_QUOTE),
        ORACLE_ROLE_OUTCOME_ATTESTER => Ok(ORACLE_PERMISSION_DATA_ATTEST),
        ORACLE_ROLE_PREMIUM_ATTESTER => Ok(ORACLE_PERMISSION_DATA_ATTEST),
        ORACLE_ROLE_CLAIM_ADJUDICATOR => Ok(ORACLE_PERMISSION_CLAIM_SETTLE),
        ORACLE_ROLE_TREASURY_OPERATOR => Ok(ORACLE_PERMISSION_TREASURY_WITHDRAW),
        _ => err!(OmegaXProtocolV2Error::InvalidOracleRole),
    }
}

#[allow(dead_code)]
pub(crate) fn oracle_permission_covers_role(permissions: u32, role: u8) -> Result<bool> {
    let required_permission = oracle_role_required_permission(role)?;
    Ok((permissions & required_permission) == required_permission)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_pool_oracle(pool: Pubkey, oracle: Pubkey, active: bool) -> PoolOracleApproval {
        PoolOracleApproval {
            pool,
            oracle,
            active,
            bump: 1,
        }
    }

    fn sample_permission_set(
        pool: Pubkey,
        oracle: Pubkey,
        permissions: u32,
    ) -> PoolOraclePermissionSet {
        PoolOraclePermissionSet {
            pool,
            oracle,
            permissions,
            bump: 2,
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

    #[test]
    fn accepts_oracles_with_data_attest_permission() {
        let pool = Pubkey::new_unique();
        let oracle = Pubkey::new_unique();
        let pool_oracle = sample_pool_oracle(pool, oracle, true);
        let permissions = sample_permission_set(pool, oracle, ORACLE_PERMISSION_DATA_ATTEST);

        assert!(
            require_oracle_data_attest_permission(pool, oracle, &pool_oracle, &permissions).is_ok()
        );
    }

    #[test]
    fn rejects_oracles_without_data_attest_permission() {
        let pool = Pubkey::new_unique();
        let oracle = Pubkey::new_unique();
        let pool_oracle = sample_pool_oracle(pool, oracle, true);
        let permissions = sample_permission_set(pool, oracle, ORACLE_PERMISSION_QUOTE);

        let error = require_oracle_data_attest_permission(pool, oracle, &pool_oracle, &permissions)
            .unwrap_err();

        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolV2Error::OraclePermissionDenied)
        );
    }

    #[test]
    fn oracle_role_vocabulary_maps_to_distinct_permission_families() {
        assert_eq!(
            oracle_role_required_permission(ORACLE_ROLE_QUOTE_ATTESTER).unwrap(),
            ORACLE_PERMISSION_QUOTE
        );
        assert_eq!(
            oracle_role_required_permission(ORACLE_ROLE_OUTCOME_ATTESTER).unwrap(),
            ORACLE_PERMISSION_DATA_ATTEST
        );
        assert_eq!(
            oracle_role_required_permission(ORACLE_ROLE_CLAIM_ADJUDICATOR).unwrap(),
            ORACLE_PERMISSION_CLAIM_SETTLE
        );
        assert_eq!(
            oracle_role_required_permission(ORACLE_ROLE_TREASURY_OPERATOR).unwrap(),
            ORACLE_PERMISSION_TREASURY_WITHDRAW
        );
    }

    #[test]
    fn oracle_permission_helper_distinguishes_quote_from_claim_roles() {
        let quote_only = ORACLE_PERMISSION_QUOTE;
        assert!(oracle_permission_covers_role(quote_only, ORACLE_ROLE_QUOTE_ATTESTER).unwrap());
        assert!(!oracle_permission_covers_role(quote_only, ORACLE_ROLE_CLAIM_ADJUDICATOR).unwrap());
    }
}
