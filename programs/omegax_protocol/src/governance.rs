// SPDX-License-Identifier: AGPL-3.0-or-later

//! Governance instruction handlers and account validation contexts.

use anchor_lang::prelude::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
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
    let previous_governance_authority =
        rotate_protocol_governance_authority_state(governance, args.new_governance_authority)?;

    emit!(ProtocolGovernanceAuthorityRotatedEvent {
        previous_governance_authority,
        new_governance_authority: governance.governance_authority,
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
