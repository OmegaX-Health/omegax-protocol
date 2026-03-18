// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) struct PoolOutcomeRuleSpec<'a> {
    pub(crate) series_ref_hash: [u8; 32],
    pub(crate) rule_hash: [u8; 32],
    pub(crate) schema_key_hash: [u8; 32],
    pub(crate) rule_id: &'a str,
    pub(crate) schema_key: &'a str,
    pub(crate) schema_version: u16,
    pub(crate) interop_profile_hash: [u8; 32],
    pub(crate) code_system_family_hash: [u8; 32],
    pub(crate) mapping_version: u16,
    pub(crate) payout_hash: [u8; 32],
    pub(crate) enabled: bool,
}

impl PoolOutcomeRuleSpec<'_> {
    pub(crate) fn validate_lengths(&self) -> Result<()> {
        require!(self.rule_id.len() <= 64, OmegaXProtocolError::RuleIdTooLong);
        require!(
            self.schema_key.len() <= 64,
            OmegaXProtocolError::SchemaKeyTooLong
        );
        Ok(())
    }
}

pub(crate) fn validate_pool_rule_schema_binding(
    schema_entry: &OutcomeSchemaRegistryEntry,
    spec: &PoolOutcomeRuleSpec<'_>,
) -> Result<()> {
    require!(
        schema_entry.schema_key_hash == spec.schema_key_hash,
        OmegaXProtocolError::InvalidProgramAccountData
    );
    require!(
        schema_entry.schema_key == spec.schema_key,
        OmegaXProtocolError::InvalidProgramAccountData
    );
    require!(
        schema_entry.version == spec.schema_version,
        OmegaXProtocolError::InvalidProgramAccountData
    );
    if !is_zero_hash(&spec.interop_profile_hash)
        && !is_zero_hash(&schema_entry.interop_profile_hash)
    {
        require!(
            schema_entry.interop_profile_hash == spec.interop_profile_hash,
            OmegaXProtocolError::InvalidProgramAccountData
        );
    }
    if !is_zero_hash(&spec.code_system_family_hash)
        && !is_zero_hash(&schema_entry.code_system_family_hash)
    {
        require!(
            schema_entry.code_system_family_hash == spec.code_system_family_hash,
            OmegaXProtocolError::InvalidProgramAccountData
        );
    }
    if schema_entry.mapping_version > 0 && spec.mapping_version > 0 {
        require!(
            schema_entry.mapping_version == spec.mapping_version,
            OmegaXProtocolError::InvalidProgramAccountData
        );
    }
    Ok(())
}

pub(crate) fn write_pool_outcome_rule(
    rule: &mut Account<PoolOutcomeRule>,
    pool: Pubkey,
    spec: &PoolOutcomeRuleSpec<'_>,
    bump: u8,
) {
    rule.pool = pool;
    rule.series_ref_hash = spec.series_ref_hash;
    rule.rule_hash = spec.rule_hash;
    rule.schema_key_hash = spec.schema_key_hash;
    rule.rule_id = spec.rule_id.to_owned();
    rule.schema_key = spec.schema_key.to_owned();
    rule.schema_version = spec.schema_version;
    rule.interop_profile_hash = spec.interop_profile_hash;
    rule.code_system_family_hash = spec.code_system_family_hash;
    rule.mapping_version = spec.mapping_version;
    rule.payout_hash = spec.payout_hash;
    rule.enabled = spec.enabled;
    rule.bump = bump;
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::error::Error;

    fn sample_schema_entry() -> OutcomeSchemaRegistryEntry {
        OutcomeSchemaRegistryEntry {
            schema_key_hash: [7u8; 32],
            schema_key: "health-alpha.v1".to_string(),
            version: 1,
            schema_hash: [3u8; 32],
            publisher: Pubkey::new_from_array([9u8; 32]),
            verified: true,
            schema_family: SCHEMA_FAMILY_KERNEL,
            visibility: SCHEMA_VISIBILITY_PUBLIC,
            interop_profile_hash: [0u8; 32],
            code_system_family_hash: [0u8; 32],
            mapping_version: 1,
            metadata_uri: "ipfs://schema".to_string(),
            bump: 254,
        }
    }

    fn sample_spec<'a>() -> PoolOutcomeRuleSpec<'a> {
        PoolOutcomeRuleSpec {
            series_ref_hash: [8u8; 32],
            rule_hash: [1u8; 32],
            schema_key_hash: [7u8; 32],
            rule_id: "health-alpha-pass",
            schema_key: "health-alpha.v1",
            schema_version: 1,
            interop_profile_hash: [0u8; 32],
            code_system_family_hash: [0u8; 32],
            mapping_version: 1,
            payout_hash: [2u8; 32],
            enabled: true,
        }
    }

    fn error_code(error: Error) -> u32 {
        match error {
            Error::AnchorError(anchor_error) => anchor_error.error_code_number,
            other => panic!("unexpected error variant: {other:?}"),
        }
    }

    fn omega_error_code(error: OmegaXProtocolError) -> u32 {
        error_code(Error::from(error))
    }

    #[test]
    fn accepts_matching_schema_binding() {
        let schema_entry = sample_schema_entry();
        let spec = sample_spec();

        assert!(validate_pool_rule_schema_binding(&schema_entry, &spec).is_ok());
    }

    #[test]
    fn rejects_mismatched_schema_binding() {
        let schema_entry = sample_schema_entry();
        let spec = PoolOutcomeRuleSpec {
            schema_version: 2,
            ..sample_spec()
        };

        let error = validate_pool_rule_schema_binding(&schema_entry, &spec).unwrap_err();

        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::InvalidProgramAccountData)
        );
    }

    #[test]
    fn rejects_mismatched_interop_binding() {
        let mut schema_entry = sample_schema_entry();
        schema_entry.interop_profile_hash = [8u8; 32];
        let spec = PoolOutcomeRuleSpec {
            interop_profile_hash: [9u8; 32],
            ..sample_spec()
        };

        let error = validate_pool_rule_schema_binding(&schema_entry, &spec).unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::InvalidProgramAccountData)
        );
    }
}
