// SPDX-License-Identifier: AGPL-3.0-or-later

//! Membership gate, proof, and anchor-seat helpers.

use anchor_lang::prelude::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::plans_membership::OpenMemberPosition;
use crate::state::*;

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
