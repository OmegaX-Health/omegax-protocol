// SPDX-License-Identifier: AGPL-3.0-or-later

use super::*;

pub(crate) fn requires_compliance_action(
    policy: Option<&PoolCompliancePolicy>,
    action_mask: u16,
) -> bool {
    policy
        .map(|policy| policy.active && (policy.actions_mask & action_mask) == action_mask)
        .unwrap_or(false)
}

pub(crate) fn assert_action_compliant(
    policy: Option<&PoolCompliancePolicy>,
    pool: Pubkey,
    action_mask: u16,
    signer: Pubkey,
    payout_mint: Pubkey,
    subject_commitment: Option<[u8; 32]>,
    token_gate_bound: bool,
) -> Result<()> {
    let Some(policy) = policy else {
        return Ok(());
    };
    require_keys_eq!(
        policy.pool,
        pool,
        OmegaXProtocolV2Error::AccountPoolMismatch
    );
    if !requires_compliance_action(Some(policy), action_mask) {
        return Ok(());
    }

    match action_mask {
        COMPLIANCE_ACTION_DEPOSIT | COMPLIANCE_ACTION_REDEEM => {
            assert_capital_rail(policy, payout_mint)?;
        }
        COMPLIANCE_ACTION_CLAIM | COMPLIANCE_ACTION_PAYOUT => {
            assert_payout_rail(policy, payout_mint)?;
        }
        _ => {}
    }

    match policy.binding_mode {
        COMPLIANCE_BINDING_MODE_NONE => Ok(()),
        COMPLIANCE_BINDING_MODE_WALLET => {
            require!(
                signer != ZERO_PUBKEY,
                OmegaXProtocolV2Error::ComplianceBindingRequired
            );
            Ok(())
        }
        COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT => {
            require!(
                subject_commitment
                    .map(|commitment| !is_zero_hash(&commitment))
                    .unwrap_or(false),
                OmegaXProtocolV2Error::ComplianceBindingRequired
            );
            Ok(())
        }
        COMPLIANCE_BINDING_MODE_TOKEN_GATE => {
            require!(
                token_gate_bound,
                OmegaXProtocolV2Error::ComplianceBindingRequired
            );
            Ok(())
        }
        _ => err!(OmegaXProtocolV2Error::InvalidComplianceBindingMode),
    }
}

pub(crate) fn assert_capital_rail(
    policy: &PoolCompliancePolicy,
    payout_mint: Pubkey,
) -> Result<()> {
    match policy.capital_rail_mode {
        RAIL_MODE_ANY => Ok(()),
        RAIL_MODE_SPL_ONLY | RAIL_MODE_PERMISSIONED_SPL => {
            require!(
                payout_mint != ZERO_PUBKEY,
                OmegaXProtocolV2Error::ComplianceRailRestriction
            );
            Ok(())
        }
        _ => err!(OmegaXProtocolV2Error::InvalidRailMode),
    }
}

pub(crate) fn assert_payout_rail(policy: &PoolCompliancePolicy, payout_mint: Pubkey) -> Result<()> {
    match policy.payout_rail_mode {
        RAIL_MODE_ANY => Ok(()),
        RAIL_MODE_SPL_ONLY | RAIL_MODE_PERMISSIONED_SPL => {
            require!(
                payout_mint != ZERO_PUBKEY,
                OmegaXProtocolV2Error::ComplianceRailRestriction
            );
            Ok(())
        }
        _ => err!(OmegaXProtocolV2Error::InvalidRailMode),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_policy(binding_mode: u8, actions_mask: u16) -> PoolCompliancePolicy {
        PoolCompliancePolicy {
            pool: Pubkey::new_unique(),
            provider_ref_hash: [1; 32],
            credential_type_hash: [2; 32],
            revocation_list_hash: [3; 32],
            actions_mask,
            binding_mode,
            provider_mode: COMPLIANCE_PROVIDER_MODE_SOLANA_ATTEST,
            capital_rail_mode: RAIL_MODE_SPL_ONLY,
            payout_rail_mode: RAIL_MODE_ANY,
            active: true,
            updated_by: Pubkey::new_unique(),
            updated_at: 1,
            bump: 1,
        }
    }

    #[test]
    fn subject_binding_requires_non_zero_commitment() {
        let pool = Pubkey::new_unique();
        let mut policy = sample_policy(
            COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT,
            COMPLIANCE_ACTION_CLAIM,
        );
        policy.pool = pool;

        let err = assert_action_compliant(
            Some(&policy),
            pool,
            COMPLIANCE_ACTION_CLAIM,
            Pubkey::new_unique(),
            ZERO_PUBKEY,
            Some(ZERO_PUBKEY_BYTES),
            false,
        )
        .unwrap_err();
        assert!(format!("{err:?}").contains("ComplianceBindingRequired"));
    }

    #[test]
    fn token_gate_binding_accepts_bound_member_action() {
        let pool = Pubkey::new_unique();
        let mut policy =
            sample_policy(COMPLIANCE_BINDING_MODE_TOKEN_GATE, COMPLIANCE_ACTION_ENROLL);
        policy.pool = pool;

        assert!(assert_action_compliant(
            Some(&policy),
            pool,
            COMPLIANCE_ACTION_ENROLL,
            Pubkey::new_unique(),
            ZERO_PUBKEY,
            None,
            true,
        )
        .is_ok());
    }

    #[test]
    fn spl_only_capital_rail_rejects_native_capital_actions() {
        let pool = Pubkey::new_unique();
        let mut policy = sample_policy(COMPLIANCE_BINDING_MODE_WALLET, COMPLIANCE_ACTION_REDEEM);
        policy.pool = pool;

        let err = assert_action_compliant(
            Some(&policy),
            pool,
            COMPLIANCE_ACTION_REDEEM,
            Pubkey::new_unique(),
            ZERO_PUBKEY,
            None,
            false,
        )
        .unwrap_err();
        assert!(format!("{err:?}").contains("ComplianceRailRestriction"));
    }
}
