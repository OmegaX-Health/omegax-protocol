// SPDX-License-Identifier: AGPL-3.0-or-later

//! Shared authorization, validation, math, token-transfer, and reserve-accounting helpers.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::plans_membership::OpenMemberPosition;
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

pub(crate) fn health_plan_membership_mode(plan: &HealthPlan) -> u8 {
    plan.membership_mode
}

pub(crate) fn membership_mode_requires_token_gate(mode: u8) -> bool {
    mode == MEMBERSHIP_MODE_TOKEN_GATE
}

pub(crate) fn membership_gate_kind_requires_anchor_seat(mode: u8, gate_kind: u8) -> bool {
    membership_mode_requires_token_gate(mode)
        && (gate_kind == MEMBERSHIP_GATE_KIND_NFT_ANCHOR
            || gate_kind == MEMBERSHIP_GATE_KIND_STAKE_ANCHOR)
}

pub(crate) fn validate_membership_gate_fields(
    membership_mode: u8,
    membership_gate_kind: u8,
    membership_gate_mint: Pubkey,
    membership_gate_min_amount: u64,
    membership_invite_authority: Pubkey,
) -> Result<()> {
    match membership_mode {
        MEMBERSHIP_MODE_OPEN => {
            require!(
                membership_gate_kind == MEMBERSHIP_GATE_KIND_OPEN
                    && membership_gate_mint == ZERO_PUBKEY
                    && membership_gate_min_amount == 0
                    && membership_invite_authority == ZERO_PUBKEY,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
        }
        MEMBERSHIP_MODE_INVITE_ONLY => {
            require!(
                membership_gate_kind == MEMBERSHIP_GATE_KIND_INVITE_ONLY
                    && membership_gate_mint == ZERO_PUBKEY
                    && membership_gate_min_amount == 0
                    && membership_invite_authority != ZERO_PUBKEY,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
        }
        MEMBERSHIP_MODE_TOKEN_GATE => {
            require!(
                membership_gate_kind == MEMBERSHIP_GATE_KIND_NFT_ANCHOR
                    || membership_gate_kind == MEMBERSHIP_GATE_KIND_STAKE_ANCHOR
                    || membership_gate_kind == MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
            require!(
                membership_gate_mint != ZERO_PUBKEY && membership_gate_min_amount > 0,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
            require!(
                membership_invite_authority == ZERO_PUBKEY,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
        }
        _ => return err!(OmegaXProtocolError::MembershipGateConfigurationInvalid),
    }

    Ok(())
}

pub(crate) fn validate_membership_gate_config(args: &CreateHealthPlanArgs) -> Result<()> {
    validate_membership_gate_fields(
        args.membership_mode,
        args.membership_gate_kind,
        args.membership_gate_mint,
        args.membership_gate_min_amount,
        args.membership_invite_authority,
    )
}

pub(crate) fn validate_membership_gate_update_config(
    args: &UpdateHealthPlanControlsArgs,
) -> Result<()> {
    validate_membership_gate_fields(
        args.membership_mode,
        args.membership_gate_kind,
        args.membership_gate_mint,
        args.membership_gate_min_amount,
        args.membership_invite_authority,
    )
}

pub(crate) fn validate_membership_proof(
    ctx: &Context<OpenMemberPosition>,
    args: &OpenMemberPositionArgs,
) -> Result<()> {
    validate_membership_proof_inputs(&MembershipProofValidationInput {
        membership_mode: ctx.accounts.health_plan.membership_mode,
        membership_gate_mint: ctx.accounts.health_plan.membership_gate_mint,
        membership_gate_min_amount: ctx.accounts.health_plan.membership_gate_min_amount,
        membership_invite_authority: ctx.accounts.health_plan.membership_invite_authority,
        wallet: ctx.accounts.wallet.key(),
        proof_mode: args.proof_mode,
        token_gate_amount_snapshot: args.token_gate_amount_snapshot,
        invite_expires_at: args.invite_expires_at,
        token_gate_owner: ctx
            .accounts
            .token_gate_account
            .as_ref()
            .map(|account| account.owner),
        token_gate_mint: ctx
            .accounts
            .token_gate_account
            .as_ref()
            .map(|account| account.mint),
        token_gate_amount: ctx
            .accounts
            .token_gate_account
            .as_ref()
            .map(|account| account.amount),
        invite_authority: ctx
            .accounts
            .invite_authority
            .as_ref()
            .map(|authority| authority.key()),
        now_ts: Clock::get()?.unix_timestamp,
    })
}

pub(crate) struct MembershipProofValidationInput {
    pub(crate) membership_mode: u8,
    pub(crate) membership_gate_mint: Pubkey,
    pub(crate) membership_gate_min_amount: u64,
    pub(crate) membership_invite_authority: Pubkey,
    pub(crate) wallet: Pubkey,
    pub(crate) proof_mode: u8,
    pub(crate) token_gate_amount_snapshot: u64,
    pub(crate) invite_expires_at: i64,
    pub(crate) token_gate_owner: Option<Pubkey>,
    pub(crate) token_gate_mint: Option<Pubkey>,
    pub(crate) token_gate_amount: Option<u64>,
    pub(crate) invite_authority: Option<Pubkey>,
    pub(crate) now_ts: i64,
}

pub(crate) fn validate_membership_proof_inputs(
    input: &MembershipProofValidationInput,
) -> Result<()> {
    match input.membership_mode {
        MEMBERSHIP_MODE_OPEN => {
            require!(
                input.proof_mode == MEMBERSHIP_PROOF_MODE_OPEN,
                OmegaXProtocolError::MembershipProofModeMismatch
            );
        }
        MEMBERSHIP_MODE_INVITE_ONLY => {
            require!(
                input.proof_mode == MEMBERSHIP_PROOF_MODE_INVITE_PERMIT,
                OmegaXProtocolError::MembershipProofModeMismatch
            );
            let invite_authority = input
                .invite_authority
                .ok_or(OmegaXProtocolError::MembershipInviteAuthorityInvalid)?;
            require_keys_eq!(
                invite_authority,
                input.membership_invite_authority,
                OmegaXProtocolError::MembershipInviteAuthorityInvalid
            );
            require!(
                input.invite_expires_at == 0 || input.invite_expires_at >= input.now_ts,
                OmegaXProtocolError::MembershipInvitePermitExpired
            );
        }
        MEMBERSHIP_MODE_TOKEN_GATE => {
            require!(
                input.proof_mode == MEMBERSHIP_PROOF_MODE_TOKEN_GATE,
                OmegaXProtocolError::MembershipProofModeMismatch
            );
            let token_gate_owner = input
                .token_gate_owner
                .ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            let token_gate_mint = input
                .token_gate_mint
                .ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            let token_gate_amount = input
                .token_gate_amount
                .ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            require_keys_eq!(
                token_gate_owner,
                input.wallet,
                OmegaXProtocolError::MembershipTokenGateOwnerMismatch
            );
            require_keys_eq!(
                token_gate_mint,
                input.membership_gate_mint,
                OmegaXProtocolError::MembershipTokenGateMintMismatch
            );
            require!(
                token_gate_amount >= input.membership_gate_min_amount,
                OmegaXProtocolError::MembershipTokenGateAmountTooLow
            );
            require!(
                input.token_gate_amount_snapshot >= input.membership_gate_min_amount,
                OmegaXProtocolError::MembershipTokenGateAmountTooLow
            );
        }
        _ => return err!(OmegaXProtocolError::MembershipGateConfigurationInvalid),
    }

    Ok(())
}

pub(crate) fn resolved_membership_anchor_ref(
    plan: &HealthPlan,
    token_gate_account: Option<Pubkey>,
    anchor_ref: Pubkey,
) -> Result<Pubkey> {
    match plan.membership_gate_kind {
        MEMBERSHIP_GATE_KIND_NFT_ANCHOR => {
            require!(
                anchor_ref != ZERO_PUBKEY,
                OmegaXProtocolError::MembershipAnchorReferenceMissing
            );
            require_keys_eq!(
                anchor_ref,
                plan.membership_gate_mint,
                OmegaXProtocolError::MembershipAnchorSeatMismatch
            );
            Ok(anchor_ref)
        }
        MEMBERSHIP_GATE_KIND_STAKE_ANCHOR => {
            let token_gate_account =
                token_gate_account.ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            require!(
                anchor_ref != ZERO_PUBKEY,
                OmegaXProtocolError::MembershipAnchorReferenceMissing
            );
            require_keys_eq!(
                anchor_ref,
                token_gate_account,
                OmegaXProtocolError::MembershipAnchorSeatMismatch
            );
            Ok(anchor_ref)
        }
        _ => Ok(ZERO_PUBKEY),
    }
}

pub(crate) fn activate_membership_anchor_seat(
    anchor_seat: &mut MembershipAnchorSeat,
    health_plan: Pubkey,
    anchor_ref: Pubkey,
    gate_kind: u8,
    holder_wallet: Pubkey,
    member_position: Pubkey,
    now_ts: i64,
    bump: Option<u8>,
) -> Result<()> {
    if anchor_seat.health_plan == ZERO_PUBKEY {
        anchor_seat.health_plan = health_plan;
        anchor_seat.anchor_ref = anchor_ref;
        anchor_seat.gate_kind = gate_kind;
        anchor_seat.holder_wallet = holder_wallet;
        anchor_seat.member_position = member_position;
        anchor_seat.active = true;
        anchor_seat.opened_at = now_ts;
        anchor_seat.updated_at = now_ts;
        anchor_seat.bump = bump.unwrap_or(anchor_seat.bump);
        return Ok(());
    }

    require_keys_eq!(
        anchor_seat.health_plan,
        health_plan,
        OmegaXProtocolError::MembershipAnchorSeatMismatch
    );
    require_keys_eq!(
        anchor_seat.anchor_ref,
        anchor_ref,
        OmegaXProtocolError::MembershipAnchorSeatMismatch
    );
    require!(
        !anchor_seat.active,
        OmegaXProtocolError::MembershipAnchorSeatAlreadyActive
    );
    anchor_seat.gate_kind = gate_kind;
    anchor_seat.holder_wallet = holder_wallet;
    anchor_seat.member_position = member_position;
    anchor_seat.active = true;
    anchor_seat.updated_at = now_ts;
    if anchor_seat.opened_at == 0 {
        anchor_seat.opened_at = now_ts;
    }

    Ok(())
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

pub(crate) fn require_class_access(capital_class: &CapitalClass, credentialed: bool) -> Result<()> {
    require_class_access_mode(capital_class.restriction_mode, credentialed)
}

pub(crate) fn require_class_access_mode(restriction_mode: u8, credentialed: bool) -> Result<()> {
    match restriction_mode {
        CAPITAL_CLASS_RESTRICTION_OPEN => Ok(()),
        CAPITAL_CLASS_RESTRICTION_RESTRICTED | CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY => {
            require!(credentialed, OmegaXProtocolError::RestrictedCapitalClass);
            Ok(())
        }
        _ => err!(OmegaXProtocolError::RestrictedCapitalClass),
    }
}

pub(crate) fn ensure_lp_position_binding(
    lp_position: &mut LPPosition,
    capital_class: Pubkey,
    owner: Pubkey,
    bump: u8,
) -> Result<()> {
    if lp_position.owner == ZERO_PUBKEY && lp_position.capital_class == ZERO_PUBKEY {
        lp_position.capital_class = capital_class;
        lp_position.owner = owner;
        lp_position.shares = 0;
        lp_position.subscription_basis = 0;
        lp_position.pending_redemption_shares = 0;
        lp_position.pending_redemption_assets = 0;
        lp_position.realized_distributions = 0;
        lp_position.impaired_principal = 0;
        lp_position.lockup_ends_at = 0;
        lp_position.credentialed = false;
        lp_position.queue_status = LP_QUEUE_STATUS_NONE;
        lp_position.bump = bump;
        return Ok(());
    }

    require_keys_eq!(
        lp_position.capital_class,
        capital_class,
        OmegaXProtocolError::Unauthorized
    );
    require_keys_eq!(lp_position.owner, owner, OmegaXProtocolError::Unauthorized);

    if lp_position.bump == 0 {
        lp_position.bump = bump;
    }

    Ok(())
}

pub(crate) fn update_lp_position_credentialing_state(
    lp_position: &mut LPPosition,
    credentialed: bool,
) -> Result<()> {
    if !credentialed {
        require!(
            lp_position.shares == 0
                && lp_position.pending_redemption_shares == 0
                && lp_position.pending_redemption_assets == 0,
            OmegaXProtocolError::LPPositionHasActiveCapital
        );
    }

    lp_position.credentialed = credentialed;
    Ok(())
}

pub(crate) fn apply_lp_position_deposit(
    lp_position: &mut LPPosition,
    amount: u64,
    shares: u64,
    min_lockup_seconds: i64,
    now_ts: i64,
) -> Result<()> {
    lp_position.shares = checked_add(lp_position.shares, shares)?;
    lp_position.subscription_basis = checked_add(lp_position.subscription_basis, amount)?;
    lp_position.lockup_ends_at = now_ts
        .checked_add(min_lockup_seconds)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    Ok(())
}

pub(crate) fn checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn checked_u128_to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| OmegaXProtocolError::ArithmeticError.into())
}

pub(crate) fn deposit_shares_for_nav(
    net_amount: u64,
    total_shares: u64,
    nav_assets: u64,
    min_shares_out: u64,
) -> Result<u64> {
    require_positive_amount(net_amount)?;
    let shares = if total_shares == 0 && nav_assets == 0 {
        net_amount
    } else {
        require!(
            total_shares > 0 && nav_assets > 0,
            OmegaXProtocolError::InvalidCapitalShareState
        );
        let computed = (net_amount as u128)
            .checked_mul(total_shares as u128)
            .ok_or(OmegaXProtocolError::ArithmeticError)?
            .checked_div(nav_assets as u128)
            .ok_or(OmegaXProtocolError::ArithmeticError)?;
        checked_u128_to_u64(computed)?
    };

    require!(shares > 0, OmegaXProtocolError::InvalidDepositShares);
    if min_shares_out > 0 {
        require!(
            shares >= min_shares_out,
            OmegaXProtocolError::MinimumSharesOutNotMet
        );
    }
    Ok(shares)
}

pub(crate) fn prorata_amount(numerator: u64, denominator: u64, amount: u64) -> Result<u64> {
    require!(
        numerator > 0 && denominator > 0 && numerator <= denominator,
        OmegaXProtocolError::InvalidRedemptionAmount
    );
    let prorata = (amount as u128)
        .checked_mul(numerator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        .checked_div(denominator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let value = checked_u128_to_u64(prorata)?;
    require!(value > 0, OmegaXProtocolError::InvalidRedemptionAmount);
    Ok(value)
}

pub(crate) fn redeemable_assets_for_shares(
    shares: u64,
    total_shares: u64,
    nav_assets: u64,
) -> Result<u64> {
    prorata_amount(shares, total_shares, nav_assets)
}

pub(crate) fn redemption_assets_to_process(
    shares: u64,
    pending_redemption_shares: u64,
    pending_redemption_assets: u64,
) -> Result<u64> {
    if shares == pending_redemption_shares {
        require!(
            pending_redemption_assets > 0,
            OmegaXProtocolError::InvalidRedemptionAmount
        );
        Ok(pending_redemption_assets)
    } else {
        prorata_amount(shares, pending_redemption_shares, pending_redemption_assets)
    }
}

pub(crate) fn require_classic_token_program_keys(
    mint_owner: Pubkey,
    token_program: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        mint_owner,
        anchor_spl::token::ID,
        OmegaXProtocolError::Token2022NotSupported
    );
    require_keys_eq!(
        token_program,
        anchor_spl::token::ID,
        OmegaXProtocolError::Token2022NotSupported
    );
    Ok(())
}

pub(crate) fn require_classic_spl_token<'info>(
    asset_mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    require_classic_token_program_keys(*asset_mint.to_account_info().owner, token_program.key())
}

pub(crate) fn transfer_to_domain_vault<'info>(
    amount: u64,
    authority: &Signer<'info>,
    source_token_account: &InterfaceAccount<'info, TokenAccount>,
    asset_mint: &InterfaceAccount<'info, Mint>,
    vault_token_account: &InterfaceAccount<'info, TokenAccount>,
    token_program: &Interface<'info, TokenInterface>,
    domain_asset_vault: &DomainAssetVault,
) -> Result<()> {
    require_classic_spl_token(asset_mint, token_program)?;
    require_keys_eq!(
        source_token_account.owner,
        authority.key(),
        OmegaXProtocolError::TokenAccountOwnerMismatch
    );
    require_keys_neq!(
        source_token_account.key(),
        vault_token_account.key(),
        OmegaXProtocolError::TokenAccountSelfTransferInvalid
    );
    require_keys_eq!(
        source_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        asset_mint.key(),
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        vault_token_account.key(),
        domain_asset_vault.vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    require_keys_eq!(
        vault_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let accounts = TransferChecked {
        from: source_token_account.to_account_info(),
        mint: asset_mint.to_account_info(),
        to: vault_token_account.to_account_info(),
        authority: authority.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new(token_program.to_account_info(), accounts),
        amount,
        asset_mint.decimals,
    )
}

// Phase 1.6 — Fee accrual helpers. Inflow handlers (record_premium_payment,
// deposit_into_capital_class, process_redemption_queue, settle_claim_case)
// call `fee_share_from_bps` to compute the carve-out from a user-facing
// amount, then `accrue_fee` to credit the vault's `accrued_fees` counter.
// SPL tokens physically remain in the matching `DomainAssetVault.vault_token_account`;
// the fee-vault account only tracks the rail's claim. SOL fees physically
// reside on the fee-vault PDA itself (lamport math, not SPL CPI).
//
// Floors to zero (Solana convention). Returns 0 when bps == 0 or amount == 0,
// so callers can blindly invoke without conditional skips.
pub(crate) fn fee_share_from_bps(amount: u64, bps: u16) -> Result<u64> {
    if bps == 0 || amount == 0 {
        return Ok(0);
    }
    require!(bps <= 10_000, OmegaXProtocolError::FeeVaultBpsMisconfigured);
    let scaled = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        .checked_div(10_000u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let fee = checked_u128_to_u64(scaled)?;
    // Defensive: fee can never exceed amount.
    require!(fee <= amount, OmegaXProtocolError::ArithmeticError);
    Ok(fee)
}

// Credits `amount` to the running accrued counter and returns the new total.
// Callers emit `FeeAccruedEvent` with the returned total. No-op when amount == 0
// (still returns the unchanged total) so callers can blindly invoke after a
// `fee_share_from_bps(...)` that may yield zero.
pub(crate) fn accrue_fee(accrued: &mut u64, amount: u64) -> Result<u64> {
    if amount == 0 {
        return Ok(*accrued);
    }
    let new_total = checked_add(*accrued, amount)?;
    *accrued = new_total;
    Ok(new_total)
}

// Phase 1.7 — Verifies a withdrawal amount fits within the vault's claim.
// `withdrawn + requested <= accrued` must hold; otherwise the rail would
// over-withdraw beyond what's been accrued. Returns the new withdrawn total.
pub(crate) fn require_fee_vault_balance(
    accrued: u64,
    withdrawn: u64,
    requested: u64,
) -> Result<u64> {
    require_positive_amount(requested)?;
    let new_withdrawn = checked_add(withdrawn, requested)?;
    require!(
        new_withdrawn <= accrued,
        OmegaXProtocolError::FeeVaultInsufficientBalance
    );
    Ok(new_withdrawn)
}

pub(crate) fn require_configured_fee_recipient(fee_recipient: Pubkey) -> Result<Pubkey> {
    require!(
        fee_recipient != ZERO_PUBKEY,
        OmegaXProtocolError::FeeRecipientInvalid
    );
    Ok(fee_recipient)
}

pub(crate) fn require_fee_recipient_owner(
    actual_owner: Pubkey,
    configured_recipient: Pubkey,
) -> Result<()> {
    require_configured_fee_recipient(configured_recipient)?;
    require_keys_eq!(
        actual_owner,
        configured_recipient,
        OmegaXProtocolError::FeeRecipientMismatch
    );
    Ok(())
}

pub(crate) fn require_fee_recipient_token_owner<'info>(
    recipient_token_account: &InterfaceAccount<'info, TokenAccount>,
    configured_recipient: Pubkey,
) -> Result<()> {
    require_fee_recipient_owner(recipient_token_account.owner, configured_recipient)
}

// Phase 1.7 — SOL-rail withdrawal. Mutates the fee-vault PDA's lamports
// directly (SystemProgram::transfer cannot move lamports out of program-owned
// accounts). Rejects withdrawals that would breach the PDA's rent-exempt
// minimum so the account stays alive across operations.
//
// Caller must pass `vault_data_len = vault_account.data_len()` so the
// rent-minimum lookup uses the live account size; passing a stale or
// constructed value would mis-compute the rent floor.
pub(crate) fn transfer_lamports_from_fee_vault<'info>(
    vault_ai: &AccountInfo<'info>,
    recipient_ai: &AccountInfo<'info>,
    amount: u64,
    rent: &Rent,
    vault_data_len: usize,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let rent_minimum = rent.minimum_balance(vault_data_len);
    let vault_lamports = vault_ai.lamports();
    let vault_after = vault_lamports
        .checked_sub(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    require!(
        vault_after >= rent_minimum,
        OmegaXProtocolError::FeeVaultRentExemptionBreach
    );
    let recipient_lamports = recipient_ai.lamports();
    let recipient_after = recipient_lamports
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    **vault_ai.try_borrow_mut_lamports()? = vault_after;
    **recipient_ai.try_borrow_mut_lamports()? = recipient_after;
    Ok(())
}

// PDA-signed outflow helper. Unblocks PT-2026-04-27-01 and PT-2026-04-27-02:
// settlement, redemption, release, and fee-withdrawal handlers will call this
// to actually move SPL tokens out of the program-PDA-owned vault token account.
// Authority on the CPI is the `domain_asset_vault` PDA (post vault-custody
// refactor in section 1.2 of the remediation plan).
//
// Caller note: this helper assumes `vault_token_account.owner` is the
// `domain_asset_vault` PDA. That invariant is established once
// `create_domain_asset_vault` is refactored to init the token account with
// `token::authority = domain_asset_vault`. Without that refactor in place the
// CPI will fail at runtime with TokenOwnerMismatch — by design.
#[allow(dead_code)]
pub(crate) fn transfer_from_domain_vault<'info>(
    amount: u64,
    domain_asset_vault: &Account<'info, DomainAssetVault>,
    vault_token_account: &InterfaceAccount<'info, TokenAccount>,
    recipient_token_account: &InterfaceAccount<'info, TokenAccount>,
    asset_mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    require_classic_spl_token(asset_mint, token_program)?;
    require_keys_eq!(
        vault_token_account.key(),
        domain_asset_vault.vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    require_keys_eq!(
        asset_mint.key(),
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        vault_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        recipient_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_neq!(
        vault_token_account.key(),
        recipient_token_account.key(),
        OmegaXProtocolError::TokenAccountSelfTransferInvalid
    );

    let reserve_domain = domain_asset_vault.reserve_domain;
    let asset_mint_key = domain_asset_vault.asset_mint;
    let bump = domain_asset_vault.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        SEED_DOMAIN_ASSET_VAULT,
        reserve_domain.as_ref(),
        asset_mint_key.as_ref(),
        &[bump],
    ]];

    let accounts = TransferChecked {
        from: vault_token_account.to_account_info(),
        mint: asset_mint.to_account_info(),
        to: recipient_token_account.to_account_info(),
        authority: domain_asset_vault.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new_with_signer(token_program.to_account_info(), accounts, signer_seeds),
        amount,
        asset_mint.decimals,
    )
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

pub(crate) fn recompute_sheet(sheet: &mut ReserveBalanceSheet) -> Result<()> {
    let encumbered = sheet
        .reserved
        .checked_add(sheet.claimable)
        .and_then(|value| value.checked_add(sheet.payable))
        .and_then(|value| value.checked_add(sheet.impaired))
        .and_then(|value| value.checked_add(sheet.pending_redemption))
        .and_then(|value| value.checked_add(sheet.restricted))
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.free = sheet.funded.saturating_sub(encumbered);
    let redeemable_encumbered = encumbered
        .checked_add(sheet.allocated)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.redeemable = sheet.funded.saturating_sub(redeemable_encumbered);
    Ok(())
}

pub(crate) fn book_inflow(target: &mut u64, amount: u64) -> Result<()> {
    *target = checked_add(*target, amount)?;
    Ok(())
}

pub(crate) fn book_inflow_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.funded = checked_add(sheet.funded, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_fee_withdrawal(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    amount: u64,
) -> Result<()> {
    *domain_assets = checked_sub(*domain_assets, amount)?;
    domain_sheet.funded = checked_sub(domain_sheet.funded, amount)?;
    recompute_sheet(domain_sheet)
}

pub(crate) fn book_owed(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.owed = checked_add(sheet.owed, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn remaining_claim_amount(claim_case: &ClaimCase) -> u64 {
    claim_case
        .approved_amount
        .saturating_sub(claim_case.paid_amount)
}

pub(crate) fn require_direct_claim_case_settlement(claim_case: &ClaimCase) -> Result<()> {
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY,
        OmegaXProtocolError::LinkedClaimMustSettleThroughObligation
    );
    Ok(())
}

pub(crate) fn require_matching_linked_claim_case(
    claim_case: &ClaimCase,
    claim_case_key: Pubkey,
    obligation: &Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
) -> Result<()> {
    require!(
        claim_case.health_plan == health_plan_key && obligation.health_plan == health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        claim_case.policy_series == obligation.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        claim_case.funding_line == obligation.funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require!(
        claim_case.asset_mint == obligation.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        obligation.claim_case == ZERO_PUBKEY || obligation.claim_case == claim_case_key,
        OmegaXProtocolError::ClaimCaseLinkMismatch
    );
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY
            || claim_case.linked_obligation == obligation_key,
        OmegaXProtocolError::ClaimCaseLinkMismatch
    );
    Ok(())
}

pub(crate) fn establish_or_validate_claim_obligation_link(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    claim_case.linked_obligation = obligation_key;
    obligation.claim_case = claim_case_key;
    claim_case.reserved_amount = obligation.reserved_amount;
    Ok(())
}

pub(crate) fn sync_adjudicated_claim_liability(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: Option<(&mut Obligation, Pubkey)>,
    health_plan_key: Pubkey,
    approved_amount: u64,
    reserve_amount: u64,
) -> Result<()> {
    if let Some((obligation, obligation_key)) = obligation {
        establish_or_validate_claim_obligation_link(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            health_plan_key,
        )?;
        require!(
            obligation.reserved_amount <= approved_amount,
            OmegaXProtocolError::AmountExceedsApprovedClaim
        );
        claim_case.reserved_amount = obligation.reserved_amount;
    } else {
        require!(
            claim_case.linked_obligation == ZERO_PUBKEY,
            OmegaXProtocolError::ClaimCaseLinkMismatch
        );
        claim_case.reserved_amount = reserve_amount;
    }
    Ok(())
}

pub(crate) fn sync_linked_claim_case_reserve(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
    now_ts: i64,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    obligation.claim_case = claim_case_key;
    claim_case.linked_obligation = obligation_key;
    claim_case.reserved_amount = obligation.reserved_amount;
    if obligation.status == OBLIGATION_STATUS_CANCELED && obligation.outstanding_amount == 0 {
        claim_case.intake_status = CLAIM_INTAKE_CLOSED;
        claim_case.closed_at = now_ts;
    }
    claim_case.updated_at = now_ts;
    Ok(())
}

pub(crate) fn sync_linked_claim_case_after_settlement(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
    amount: u64,
    now_ts: i64,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    require!(
        amount <= remaining_claim_amount(claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );

    obligation.claim_case = claim_case_key;
    claim_case.linked_obligation = obligation_key;
    claim_case.paid_amount = checked_add(claim_case.paid_amount, amount)?;
    claim_case.reserved_amount = obligation.reserved_amount;
    claim_case.intake_status = if claim_case.paid_amount >= claim_case.approved_amount
        || obligation.outstanding_amount == 0
    {
        CLAIM_INTAKE_SETTLED
    } else {
        CLAIM_INTAKE_APPROVED
    };
    claim_case.closed_at = if claim_case.intake_status == CLAIM_INTAKE_SETTLED {
        now_ts
    } else {
        0
    };
    claim_case.updated_at = now_ts;
    Ok(())
}

pub(crate) fn book_reserve(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = checked_add(sheet.reserved, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn release_reserved_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = checked_sub(sheet.reserved, amount)?;
    sheet.owed = sheet.owed.saturating_sub(amount);
    recompute_sheet(sheet)
}

pub(crate) fn release_to_claimable_or_payable(
    sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    sheet.reserved = checked_sub(sheet.reserved, amount)?;
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE => {
            sheet.claimable = checked_add(sheet.claimable, amount)?;
        }
        OBLIGATION_DELIVERY_MODE_PAYABLE => {
            sheet.payable = checked_add(sheet.payable, amount)?;
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }
    recompute_sheet(sheet)
}

pub(crate) fn settle_from_sheet(
    sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE => {
            if sheet.claimable >= amount {
                sheet.claimable = checked_sub(sheet.claimable, amount)?;
            } else if sheet.reserved >= amount {
                sheet.reserved = checked_sub(sheet.reserved, amount)?;
            } else {
                return err!(OmegaXProtocolError::AmountExceedsReservedBalance);
            }
        }
        OBLIGATION_DELIVERY_MODE_PAYABLE => {
            if sheet.payable >= amount {
                sheet.payable = checked_sub(sheet.payable, amount)?;
            } else if sheet.reserved >= amount {
                sheet.reserved = checked_sub(sheet.reserved, amount)?;
            } else {
                return err!(OmegaXProtocolError::AmountExceedsReservedBalance);
            }
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }
    sheet.funded = checked_sub(sheet.funded, amount)?;
    sheet.owed = sheet.owed.saturating_sub(amount);
    sheet.settled = checked_add(sheet.settled, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_pending_redemption(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.pending_redemption = checked_add(sheet.pending_redemption, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn settle_pending_redemption(
    ledger: &mut PoolClassLedger,
    asset_amount: u64,
    shares: u64,
) -> Result<()> {
    ledger.sheet.pending_redemption = checked_sub(ledger.sheet.pending_redemption, asset_amount)?;
    ledger.sheet.funded = checked_sub(ledger.sheet.funded, asset_amount)?;
    ledger.sheet.settled = checked_add(ledger.sheet.settled, asset_amount)?;
    ledger.total_shares = checked_sub(ledger.total_shares, shares)?;
    recompute_sheet(&mut ledger.sheet)
}

pub(crate) fn settle_pending_redemption_domain(
    sheet: &mut ReserveBalanceSheet,
    asset_amount: u64,
) -> Result<()> {
    sheet.pending_redemption = checked_sub(sheet.pending_redemption, asset_amount)?;
    sheet.funded = checked_sub(sheet.funded, asset_amount)?;
    sheet.settled = checked_add(sheet.settled, asset_amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = checked_add(sheet.allocated, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn release_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = checked_sub(sheet.allocated, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn book_impairment(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.impaired = checked_add(sheet.impaired, amount)?;
    recompute_sheet(sheet)
}

pub(crate) fn release_reserved_scoped(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    amount: u64,
) -> Result<()> {
    release_reserved_sheet(domain_sheet, amount)?;
    release_reserved_sheet(plan_sheet, amount)?;
    release_reserved_sheet(line_sheet, amount)?;
    if let Some(series) = series_sheet {
        release_reserved_sheet(&mut series.sheet, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        release_reserved_sheet(&mut class_ledger.sheet, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = checked_sub(position.reserved_capacity, amount)?;
        position.utilized_amount = checked_sub(position.utilized_amount, amount)?;
    }
    if let Some(ledger) = allocation_sheet {
        release_reserved_sheet(&mut ledger.sheet, amount)?;
    }
    Ok(())
}

pub(crate) fn release_reserved_to_delivery(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    release_to_claimable_or_payable(domain_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(plan_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(line_sheet, delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        release_to_claimable_or_payable(&mut series.sheet, delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        release_to_claimable_or_payable(&mut class_ledger.sheet, delivery_mode, amount)?;
    }
    if let Some(allocation_ledger) = allocation_sheet {
        release_to_claimable_or_payable(&mut allocation_ledger.sheet, delivery_mode, amount)?;
    }
    Ok(())
}

pub(crate) fn settle_delivery(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
    obligation: &mut Obligation,
) -> Result<()> {
    settle_from_sheet(domain_sheet, obligation.delivery_mode, amount)?;
    settle_from_sheet(plan_sheet, obligation.delivery_mode, amount)?;
    settle_from_sheet(line_sheet, obligation.delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        settle_from_sheet(&mut series.sheet, obligation.delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        settle_from_sheet(&mut class_ledger.sheet, obligation.delivery_mode, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
    }
    if let Some(ledger) = allocation_sheet {
        settle_from_sheet(&mut ledger.sheet, obligation.delivery_mode, amount)?;
    }
    *domain_assets = checked_sub(*domain_assets, amount)?;
    funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
    funding_line.spent_amount = checked_add(funding_line.spent_amount, amount)?;
    obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
    obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
    obligation.payable_amount = obligation.payable_amount.saturating_sub(amount);
    obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
    obligation.settled_amount = checked_add(obligation.settled_amount, amount)?;
    Ok(())
}

pub(crate) fn cancel_outstanding(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
    obligation: &mut Obligation,
) -> Result<()> {
    if obligation.reserved_amount >= amount {
        release_reserved_sheet(domain_sheet, amount)?;
        release_reserved_sheet(plan_sheet, amount)?;
        release_reserved_sheet(line_sheet, amount)?;
        if let Some(series) = series_sheet {
            release_reserved_sheet(&mut series.sheet, amount)?;
        }
        if let Some(class_ledger) = class_sheet {
            release_reserved_sheet(&mut class_ledger.sheet, amount)?;
        }
        if let Some(position) = allocation_position {
            position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
            position.utilized_amount = position.utilized_amount.saturating_sub(amount);
        }
        if let Some(ledger) = allocation_sheet {
            release_reserved_sheet(&mut ledger.sheet, amount)?;
        }
        funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
        funding_line.released_amount = checked_add(funding_line.released_amount, amount)?;
        obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
    } else if obligation.claimable_amount >= amount || obligation.payable_amount >= amount {
        if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
            domain_sheet.claimable = domain_sheet.claimable.saturating_sub(amount);
            plan_sheet.claimable = plan_sheet.claimable.saturating_sub(amount);
            line_sheet.claimable = line_sheet.claimable.saturating_sub(amount);
            if let Some(series) = series_sheet {
                series.sheet.claimable = series.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut series.sheet)?;
            }
            if let Some(class_ledger) = class_sheet {
                class_ledger.sheet.claimable = class_ledger.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut class_ledger.sheet)?;
            }
            if let Some(ledger) = allocation_sheet {
                ledger.sheet.claimable = ledger.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut ledger.sheet)?;
            }
            obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
        } else {
            domain_sheet.payable = domain_sheet.payable.saturating_sub(amount);
            plan_sheet.payable = plan_sheet.payable.saturating_sub(amount);
            line_sheet.payable = line_sheet.payable.saturating_sub(amount);
            if let Some(series) = series_sheet {
                series.sheet.payable = series.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut series.sheet)?;
            }
            if let Some(class_ledger) = class_sheet {
                class_ledger.sheet.payable = class_ledger.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut class_ledger.sheet)?;
            }
            if let Some(ledger) = allocation_sheet {
                ledger.sheet.payable = ledger.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut ledger.sheet)?;
            }
            obligation.payable_amount = obligation.payable_amount.saturating_sub(amount);
        }
        domain_sheet.owed = domain_sheet.owed.saturating_sub(amount);
        plan_sheet.owed = plan_sheet.owed.saturating_sub(amount);
        line_sheet.owed = line_sheet.owed.saturating_sub(amount);
        recompute_sheet(domain_sheet)?;
        recompute_sheet(plan_sheet)?;
        recompute_sheet(line_sheet)?;
    } else {
        return err!(OmegaXProtocolError::InvalidObligationStateTransition);
    }
    obligation.outstanding_amount = obligation.outstanding_amount.saturating_sub(amount);
    Ok(())
}

pub(crate) fn book_settlement_from_delivery(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
) -> Result<()> {
    let delivery_mode = if line_sheet.claimable >= amount {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE
    } else {
        OBLIGATION_DELIVERY_MODE_PAYABLE
    };
    settle_from_sheet(domain_sheet, delivery_mode, amount)?;
    settle_from_sheet(plan_sheet, delivery_mode, amount)?;
    settle_from_sheet(line_sheet, delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        settle_from_sheet(&mut series.sheet, delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        settle_from_sheet(&mut class_ledger.sheet, delivery_mode, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
    }
    if let Some(ledger) = allocation_sheet {
        settle_from_sheet(&mut ledger.sheet, delivery_mode, amount)?;
    }
    *domain_assets = checked_sub(*domain_assets, amount)?;
    funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
    funding_line.spent_amount = checked_add(funding_line.spent_amount, amount)?;
    Ok(())
}
