// SPDX-License-Identifier: AGPL-3.0-or-later

//! Authorization, authority, and bounded-field validation helpers.

use anchor_lang::prelude::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::state::*;

pub(crate) fn require_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

pub(crate) fn require_bounded_string(value: &str, max_len: usize) -> Result<()> {
    require!(value.len() <= max_len, OmegaXProtocolError::StringTooLong);
    Ok(())
}

pub(crate) fn require_governance(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
) -> Result<()> {
    require_keys_eq!(
        *authority,
        governance.governance_authority,
        OmegaXProtocolError::Unauthorized
    );
    Ok(())
}

pub(crate) fn require_protocol_not_paused(governance: &ProtocolGovernance) -> Result<()> {
    require!(
        !governance.emergency_pause,
        OmegaXProtocolError::ProtocolEmergencyPaused
    );
    Ok(())
}

pub(crate) fn require_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

pub(crate) fn rotate_protocol_governance_authority_state(
    governance: &mut ProtocolGovernance,
    new_governance_authority: Pubkey,
) -> Result<Pubkey> {
    require!(
        new_governance_authority != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidGovernanceAuthority
    );

    let previous_governance_authority = governance.governance_authority;
    governance.governance_authority = new_governance_authority;
    governance.audit_nonce = governance.audit_nonce.saturating_add(1);
    Ok(previous_governance_authority)
}

pub(crate) fn require_domain_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    domain: &ReserveDomain,
) -> Result<()> {
    if *authority == domain.domain_admin || *authority == governance.governance_authority {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn require_oracle_profile_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    oracle_profile: &OracleProfile,
) -> Result<()> {
    if *authority == oracle_profile.admin
        || *authority == oracle_profile.oracle
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn validate_oracle_profile_fields(args: &RegisterOracleArgs) -> Result<()> {
    validate_oracle_profile_strings(
        &args.display_name,
        &args.legal_name,
        &args.website_url,
        &args.app_url,
        &args.logo_uri,
        &args.webhook_url,
        &args.supported_schema_key_hashes,
    )
}

pub(crate) fn validate_oracle_profile_strings(
    display_name: &str,
    legal_name: &str,
    website_url: &str,
    app_url: &str,
    logo_uri: &str,
    webhook_url: &str,
    supported_schema_key_hashes: &[[u8; 32]],
) -> Result<()> {
    require_bounded_string(display_name, MAX_NAME_LEN)?;
    require_bounded_string(legal_name, MAX_LONG_NAME_LEN)?;
    require_bounded_string(website_url, MAX_URI_LEN)?;
    require_bounded_string(app_url, MAX_URI_LEN)?;
    require_bounded_string(logo_uri, MAX_URI_LEN)?;
    require_bounded_string(webhook_url, MAX_URI_LEN)?;
    require!(
        supported_schema_key_hashes.len() <= MAX_ORACLE_SUPPORTED_SCHEMAS,
        OmegaXProtocolError::TooManyOracleSupportedSchemas
    );
    Ok(())
}

pub(crate) fn validate_oracle_profile_fields_update(args: &UpdateOracleProfileArgs) -> Result<()> {
    validate_oracle_profile_strings(
        &args.display_name,
        &args.legal_name,
        &args.website_url,
        &args.app_url,
        &args.logo_uri,
        &args.webhook_url,
        &args.supported_schema_key_hashes,
    )
}

pub(crate) fn write_supported_schema_hashes(
    destination: &mut [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS],
    values: &[[u8; 32]],
) {
    *destination = [[0u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS];
    for (index, value) in values.iter().enumerate() {
        destination[index] = *value;
    }
}

pub(crate) fn validate_outcome_schema_fields(args: &RegisterOutcomeSchemaArgs) -> Result<()> {
    require_bounded_string(&args.schema_key, MAX_SCHEMA_KEY_LEN)?;
    require_bounded_string(&args.metadata_uri, MAX_URI_LEN)?;
    Ok(())
}

pub(crate) fn require_plan_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
) -> Result<()> {
    if *authority == plan.plan_admin
        || *authority == plan.sponsor_operator
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn obligation_has_linked_claim_case(obligation: &Obligation) -> bool {
    obligation.claim_case != ZERO_PUBKEY
}

pub(crate) fn require_linked_claim_reserve_operator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
) -> Result<()> {
    if *authority == plan.oracle_authority
        || *authority == plan.claims_operator
        || *authority == plan.plan_admin
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn require_linked_claim_settlement_operator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
) -> Result<()> {
    if *authority == plan.claims_operator
        || *authority == plan.plan_admin
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn require_obligation_reserve_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
    obligation: &Obligation,
) -> Result<()> {
    if obligation_has_linked_claim_case(obligation) {
        require_linked_claim_reserve_operator(authority, governance, plan)
    } else {
        require_plan_control(authority, governance, plan)
    }
}

pub(crate) fn require_obligation_settlement_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
    obligation: &Obligation,
) -> Result<()> {
    if obligation_has_linked_claim_case(obligation) {
        require_linked_claim_settlement_operator(authority, governance, plan)
    } else {
        require_plan_control(authority, governance, plan)
    }
}

// Resolve the SPL recipient for a claim settlement. Routing is exclusively
// controlled by the member-set delegate_recipient field on ClaimCase: if it
// is the ZERO_PUBKEY, payouts go to member_position.wallet. The `claimant`
// field on ClaimCase is informational metadata only — it is constrained at
// intake to equal member_position.wallet (PT-2026-04-27-04 fix).
pub(crate) fn resolve_claim_settlement_recipient(
    claim_case: &ClaimCase,
    member_position: &MemberPosition,
) -> Pubkey {
    if claim_case.delegate_recipient != ZERO_PUBKEY {
        claim_case.delegate_recipient
    } else {
        member_position.wallet
    }
}

pub(crate) fn require_claim_intake_submitter(
    authority: &Pubkey,
    plan: &HealthPlan,
    member_position: &MemberPosition,
    args: &OpenClaimCaseArgs,
) -> Result<()> {
    // Both branches require args.claimant == member_position.wallet so the
    // claimant field cannot be used to divert funds when settlement transfers
    // ship. Recipient routing is handled separately via ClaimCase.delegate_recipient
    // (set by the member via `authorize_claim_recipient`).
    let claimant_is_member = args.claimant == member_position.wallet;
    let member_self_submit = *authority == member_position.wallet && claimant_is_member;
    let operator_submit =
        (*authority == plan.claims_operator || *authority == plan.plan_admin) && claimant_is_member;

    if member_self_submit || operator_submit {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn require_claim_operator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
) -> Result<()> {
    if *authority == plan.claims_operator
        || *authority == plan.plan_admin
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn require_valid_attestation_decision(decision: u8) -> Result<()> {
    match decision {
        CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE
        | CLAIM_ATTESTATION_DECISION_SUPPORT_DENY
        | CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW
        | CLAIM_ATTESTATION_DECISION_ABSTAIN => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidClaimAttestationDecision),
    }
}

pub(crate) fn is_zero_hash(value: &[u8; 32]) -> bool {
    *value == [0; 32]
}

pub(crate) fn oracle_profile_supports_schema(
    oracle_profile: &OracleProfile,
    schema_key_hash: [u8; 32],
) -> bool {
    if is_zero_hash(&schema_key_hash) {
        return false;
    }

    let supported_count =
        usize::from(oracle_profile.supported_schema_count).min(MAX_ORACLE_SUPPORTED_SCHEMAS);
    if supported_count == 0 {
        return true;
    }

    oracle_profile
        .supported_schema_key_hashes
        .iter()
        .take(supported_count)
        .any(|supported_hash| *supported_hash == schema_key_hash)
}

pub(crate) fn require_pool_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    pool: &LiquidityPool,
) -> Result<()> {
    if *authority == pool.curator
        || *authority == pool.allocator
        || *authority == pool.sentinel
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn require_curator_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    pool: &LiquidityPool,
) -> Result<()> {
    if *authority == pool.curator || *authority == governance.governance_authority {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

pub(crate) fn require_allocator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    pool: &LiquidityPool,
) -> Result<()> {
    if *authority == pool.allocator
        || *authority == pool.curator
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}
