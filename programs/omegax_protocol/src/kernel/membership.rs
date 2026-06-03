// SPDX-License-Identifier: AGPL-3.0-or-later

//! Membership gate, proof, and anchor-seat helpers.

use crate::platform::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;

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

pub(crate) struct MembershipProofValidationInput {
    pub(crate) membership_mode: u8,
    pub(crate) membership_invite_authority: Pubkey,
    pub(crate) proof_mode: u8,
    pub(crate) invite_expires_at: i64,
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
        _ => return err!(OmegaXProtocolError::MembershipGateConfigurationInvalid),
    }

    Ok(())
}
