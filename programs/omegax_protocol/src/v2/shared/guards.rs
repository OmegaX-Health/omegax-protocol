// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) fn assert_governance_or_emergency_admin_signer(
    config: &Account<ProtocolConfigV2>,
    signer: Pubkey,
) -> Result<()> {
    if signer == config.governance_authority {
        return Ok(());
    }
    require!(
        config.emergency_paused && signer == config.admin,
        OmegaXProtocolV2Error::GovernanceUnauthorized
    );
    Ok(())
}

pub(crate) fn assert_governance_signer(
    config: &Account<ProtocolConfigV2>,
    signer: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        signer,
        config.governance_authority,
        OmegaXProtocolV2Error::GovernanceUnauthorized
    );
    Ok(())
}

pub(crate) fn assert_protocol_not_paused(config: &Account<ProtocolConfigV2>) -> Result<()> {
    require!(
        !config.emergency_paused,
        OmegaXProtocolV2Error::ProtocolPaused
    );
    Ok(())
}

pub(crate) fn assert_pool_not_closed(pool: &Account<Pool>) -> Result<()> {
    require!(
        pool.status != POOL_STATUS_CLOSED,
        OmegaXProtocolV2Error::PoolClosed
    );
    Ok(())
}

fn pool_operator_authority_key(
    pool_authority: Pubkey,
    control: Option<&PoolControlAuthority>,
) -> Pubkey {
    control
        .and_then(|control| {
            if control.operator_authority == ZERO_PUBKEY {
                None
            } else {
                Some(control.operator_authority)
            }
        })
        .unwrap_or(pool_authority)
}

fn has_pool_risk_authority_key(
    pool_authority: Pubkey,
    governance_authority: Pubkey,
    admin: Pubkey,
    emergency_paused: bool,
    control: Option<&PoolControlAuthority>,
    signer: Pubkey,
) -> bool {
    if signer == pool_operator_authority_key(pool_authority, control)
        || signer == governance_authority
    {
        return true;
    }
    if let Some(control) = control {
        if control.risk_manager_authority != ZERO_PUBKEY && signer == control.risk_manager_authority
        {
            return true;
        }
        if control.guardian_authority != ZERO_PUBKEY && signer == control.guardian_authority {
            return true;
        }
    }
    emergency_paused && signer == admin
}

pub(crate) fn has_pool_risk_authority(
    pool: &Account<Pool>,
    config: &Account<ProtocolConfigV2>,
    control: Option<&Account<PoolControlAuthority>>,
    signer: Pubkey,
) -> bool {
    has_pool_risk_authority_key(
        pool.authority,
        config.governance_authority,
        config.admin,
        config.emergency_paused,
        control.map(|control| control.as_ref()),
        signer,
    )
}

fn has_pool_compliance_authority_key(
    pool_authority: Pubkey,
    governance_authority: Pubkey,
    admin: Pubkey,
    emergency_paused: bool,
    control: Option<&PoolControlAuthority>,
    signer: Pubkey,
) -> bool {
    if signer == pool_operator_authority_key(pool_authority, control)
        || signer == governance_authority
    {
        return true;
    }
    if let Some(control) = control {
        if control.compliance_authority != ZERO_PUBKEY && signer == control.compliance_authority {
            return true;
        }
        if control.guardian_authority != ZERO_PUBKEY && signer == control.guardian_authority {
            return true;
        }
    }
    emergency_paused && signer == admin
}

pub(crate) fn has_pool_compliance_authority(
    pool: &Account<Pool>,
    config: &Account<ProtocolConfigV2>,
    control: Option<&Account<PoolControlAuthority>>,
    signer: Pubkey,
) -> bool {
    has_pool_compliance_authority_key(
        pool.authority,
        config.governance_authority,
        config.admin,
        config.emergency_paused,
        control.map(|control| control.as_ref()),
        signer,
    )
}

pub(crate) fn require_pool_oracle_permission(
    pool: Pubkey,
    oracle: Pubkey,
    pool_oracle: &PoolOracleApproval,
    pool_oracle_permissions: &PoolOraclePermissionSet,
    required_permission: u32,
) -> Result<()> {
    require!(
        pool_oracle.active,
        OmegaXProtocolV2Error::OracleNotApprovedForPool
    );
    require_keys_eq!(
        pool_oracle.pool,
        pool,
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require_keys_eq!(
        pool_oracle.oracle,
        oracle,
        OmegaXProtocolV2Error::OracleKeyMismatch
    );
    require_keys_eq!(
        pool_oracle_permissions.pool,
        pool,
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require_keys_eq!(
        pool_oracle_permissions.oracle,
        oracle,
        OmegaXProtocolV2Error::OracleKeyMismatch
    );
    require!(
        (pool_oracle_permissions.permissions & required_permission) == required_permission,
        OmegaXProtocolV2Error::OraclePermissionDenied
    );
    Ok(())
}

pub(crate) fn require_pool_oracle_fee_permission(
    pool: Pubkey,
    oracle: Pubkey,
    pool_oracle_permissions: &PoolOraclePermissionSet,
    required_permission: u32,
) -> Result<()> {
    require_keys_eq!(
        pool_oracle_permissions.pool,
        pool,
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    require_keys_eq!(
        pool_oracle_permissions.oracle,
        oracle,
        OmegaXProtocolV2Error::OracleKeyMismatch
    );
    require!(
        (pool_oracle_permissions.permissions & required_permission) == required_permission,
        OmegaXProtocolV2Error::OraclePermissionDenied
    );
    Ok(())
}

pub(crate) fn derive_membership_subject_commitment(pool: Pubkey, member: Pubkey) -> [u8; 32] {
    *blake3::hash(&[pool.as_ref(), member.as_ref()].concat()).as_bytes()
}

pub(crate) fn hash_utf8_string_to_32(value: &str) -> [u8; 32] {
    hashv(&[value.as_bytes()]).to_bytes()
}

pub(crate) fn is_zero_hash(hash: &[u8; 32]) -> bool {
    *hash == ZERO_PUBKEY_BYTES
}

pub(crate) fn member_cycle_uses_health_alpha_outcome(cycle: &MemberCycleState) -> bool {
    cycle.commitment_enabled
        && cycle.outcome_threshold_score > 0
        && !is_zero_hash(&cycle.cohort_hash)
}

pub(crate) fn cycle_bond_refund_eligible(passed: bool, shield_consumed: bool) -> bool {
    passed || shield_consumed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_control() -> PoolControlAuthority {
        PoolControlAuthority {
            pool: Pubkey::new_unique(),
            operator_authority: Pubkey::new_unique(),
            risk_manager_authority: Pubkey::new_unique(),
            compliance_authority: Pubkey::new_unique(),
            guardian_authority: Pubkey::new_unique(),
            updated_at: 0,
            bump: 1,
        }
    }

    #[test]
    fn operator_authority_defaults_to_pool_authority() {
        let pool_authority = Pubkey::new_unique();
        let control = PoolControlAuthority {
            operator_authority: ZERO_PUBKEY,
            ..sample_control()
        };

        assert_eq!(
            pool_operator_authority_key(pool_authority, Some(&control)),
            pool_authority
        );
        assert_eq!(
            pool_operator_authority_key(pool_authority, None),
            pool_authority
        );
    }

    #[test]
    fn risk_authority_includes_operator_governance_guardian_and_emergency_admin() {
        let pool_authority = Pubkey::new_unique();
        let governance_authority = Pubkey::new_unique();
        let admin = Pubkey::new_unique();
        let control = sample_control();

        assert!(has_pool_risk_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            control.operator_authority,
        ));
        assert!(has_pool_risk_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            control.risk_manager_authority,
        ));
        assert!(has_pool_risk_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            control.guardian_authority,
        ));
        assert!(has_pool_risk_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            governance_authority,
        ));
        assert!(!has_pool_risk_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            admin,
        ));
        assert!(has_pool_risk_authority_key(
            pool_authority,
            governance_authority,
            admin,
            true,
            Some(&control),
            admin,
        ));
    }

    #[test]
    fn compliance_authority_uses_dedicated_lane_without_granting_risk_manager_access() {
        let pool_authority = Pubkey::new_unique();
        let governance_authority = Pubkey::new_unique();
        let admin = Pubkey::new_unique();
        let control = sample_control();

        assert!(has_pool_compliance_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            control.compliance_authority,
        ));
        assert!(!has_pool_compliance_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            control.risk_manager_authority,
        ));
        assert!(has_pool_compliance_authority_key(
            pool_authority,
            governance_authority,
            admin,
            false,
            Some(&control),
            control.guardian_authority,
        ));
    }
}
