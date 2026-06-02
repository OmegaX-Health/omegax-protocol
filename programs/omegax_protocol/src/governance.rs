// SPDX-License-Identifier: AGPL-3.0-or-later

//! Governance instruction handlers and account validation contexts.

use crate::platform::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::program::OmegaxProtocol;
use crate::state::*;
use crate::types::*;

pub(crate) fn initialize_protocol_governance(
    ctx: Context<InitializeProtocolGovernance>,
    args: InitializeProtocolGovernanceArgs,
) -> Result<()> {
    require!(
        args.protocol_fee_bps <= MAX_CONFIGURED_FEE_BPS,
        OmegaXProtocolError::InvalidBps
    );

    let governance = &mut ctx.accounts.protocol_governance;
    governance.governance_authority = ctx.accounts.governance_authority.key();
    governance.pending_governance_authority = ZERO_PUBKEY;
    governance.pending_governance_proposed_at = 0;
    governance.pending_governance_expires_at = 0;
    governance.protocol_fee_bps = args.protocol_fee_bps;
    governance.emergency_pause = args.emergency_pause;
    governance.audit_nonce = 0;
    governance.bump = ctx.bumps.protocol_governance;

    emit!(ProtocolGovernanceInitializedEvent {
        governance_authority: governance.governance_authority,
        protocol_fee_bps: governance.protocol_fee_bps,
        emergency_pause: governance.emergency_pause,
    });

    Ok(())
}

pub(crate) fn set_protocol_emergency_pause(
    ctx: Context<SetProtocolEmergencyPause>,
    args: SetProtocolEmergencyPauseArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    let governance = &mut ctx.accounts.protocol_governance;
    governance.emergency_pause = args.emergency_pause;
    governance.audit_nonce = governance.audit_nonce.saturating_add(1);

    emit!(ScopedControlChangedEvent {
        scope_kind: ScopeKind::ProtocolGovernance as u8,
        scope: governance.key(),
        authority: ctx.accounts.authority.key(),
        pause_flags: if args.emergency_pause {
            PAUSE_FLAG_PROTOCOL_EMERGENCY
        } else {
            0
        },
        reason_hash: args.reason_hash,
        audit_nonce: governance.audit_nonce,
    });

    Ok(())
}

pub(crate) fn rotate_protocol_governance_authority(
    ctx: Context<RotateProtocolGovernanceAuthority>,
    args: RotateProtocolGovernanceAuthorityArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;

    let governance = &mut ctx.accounts.protocol_governance;
    let proposed_at_ts = Clock::get()?.unix_timestamp;
    let (current_governance_authority, expires_at_ts) =
        propose_protocol_governance_authority_transfer_state(
            governance,
            args.new_governance_authority,
            proposed_at_ts,
        )?;

    emit!(ProtocolGovernanceAuthorityTransferProposedEvent {
        current_governance_authority,
        pending_governance_authority: governance.pending_governance_authority,
        authority: ctx.accounts.authority.key(),
        proposed_at_ts,
        expires_at_ts,
        audit_nonce: governance.audit_nonce,
    });

    Ok(())
}

pub(crate) fn accept_protocol_governance_authority(
    ctx: Context<AcceptProtocolGovernanceAuthority>,
) -> Result<()> {
    let governance = &mut ctx.accounts.protocol_governance;
    let previous_governance_authority = accept_protocol_governance_authority_transfer_state(
        governance,
        &ctx.accounts.pending_authority.key(),
        Clock::get()?.unix_timestamp,
    )?;

    emit!(ProtocolGovernanceAuthorityRotatedEvent {
        previous_governance_authority,
        new_governance_authority: governance.governance_authority,
        authority: ctx.accounts.pending_authority.key(),
        audit_nonce: governance.audit_nonce,
    });

    Ok(())
}

pub(crate) fn cancel_protocol_governance_authority_transfer(
    ctx: Context<CancelProtocolGovernanceAuthorityTransfer>,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;

    let governance = &mut ctx.accounts.protocol_governance;
    let canceled_governance_authority =
        cancel_protocol_governance_authority_transfer_state(governance)?;

    emit!(ProtocolGovernanceAuthorityTransferCanceledEvent {
        governance_authority: governance.governance_authority,
        canceled_governance_authority,
        authority: ctx.accounts.authority.key(),
        audit_nonce: governance.audit_nonce,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeProtocolGovernance<'info> {
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(
        init,
        payer = governance_authority,
        space = 8 + ProtocolGovernance::INIT_SPACE,
        seeds = [SEED_PROTOCOL_GOVERNANCE],
        bump
    )]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ OmegaXProtocolError::Unauthorized
    )]
    pub program: Program<'info, OmegaxProtocol>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(governance_authority.key()) @ OmegaXProtocolError::Unauthorized
    )]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetProtocolEmergencyPause<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
}

#[derive(Accounts)]
pub struct RotateProtocolGovernanceAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
}

#[derive(Accounts)]
pub struct AcceptProtocolGovernanceAuthority<'info> {
    pub pending_authority: Signer<'info>,
    #[account(mut, seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
}

#[derive(Accounts)]
pub struct CancelProtocolGovernanceAuthorityTransfer<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
}
