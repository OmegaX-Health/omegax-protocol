// SPDX-License-Identifier: AGPL-3.0-or-later

//! Governance instruction handlers and account validation contexts.

use crate::platform::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
#[cfg(not(feature = "quasar"))]
use crate::program::OmegaxProtocol;
use crate::state::*;
use crate::types::*;
#[cfg(feature = "quasar")]
use crate::OmegaxProtocol;
#[cfg(not(feature = "quasar"))]
use anchor_lang::ProgramData;

#[cfg(not(feature = "quasar"))]
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

#[cfg(not(feature = "quasar"))]
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

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_governance(authority: &Pubkey, governance: &ProtocolGovernance) -> Result<()> {
    require_keys_eq!(
        *authority,
        governance.governance_authority,
        OmegaXProtocolError::Unauthorized
    );
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn initialize_protocol_governance<'info>(
    ctx: &mut Ctx<'info, InitializeProtocolGovernance<'info>>,
    protocol_fee_bps: u16,
    emergency_pause: bool,
) -> Result<()> {
    require!(
        protocol_fee_bps <= MAX_CONFIGURED_FEE_BPS,
        OmegaXProtocolError::InvalidBps
    );

    ctx.accounts.protocol_governance.set_inner(
        *ctx.accounts.governance_authority.address(),
        protocol_fee_bps,
        emergency_pause,
        0,
        ctx.bumps.protocol_governance,
    );

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn set_protocol_emergency_pause<'info>(
    ctx: &mut Ctx<'info, SetProtocolEmergencyPause<'info>>,
    emergency_pause: bool,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    let governance = &mut ctx.accounts.protocol_governance;
    require_quasar_governance(&authority, governance)?;
    let governance_authority = governance.governance_authority;
    let protocol_fee_bps = governance.protocol_fee_bps.get();
    let audit_nonce = governance.audit_nonce.get().saturating_add(1);
    let bump = governance.bump;

    governance.set_inner(
        governance_authority,
        protocol_fee_bps,
        emergency_pause,
        audit_nonce,
        bump,
    );

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeProtocolGovernance<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub governance_authority: &'info Signer,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = governance_authority,
            space = 8 + ProtocolGovernance::INIT_SPACE,
            seeds = [SEED_PROTOCOL_GOVERNANCE],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            init,
            payer = governance_authority,
            space = 8 + ProtocolGovernance::INIT_SPACE,
            seeds = [SEED_PROTOCOL_GOVERNANCE],
            bump
        )
    )]
    #[cfg(feature = "quasar")]
    pub protocol_governance: &'info mut Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ OmegaXProtocolError::Unauthorized
    )]
    pub program: Program<'info, OmegaxProtocol>,
    #[cfg(feature = "quasar")]
    pub program: &'info Program<OmegaxProtocol>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = program_data.upgrade_authority_address == Some(governance_authority.key()) @ OmegaXProtocolError::Unauthorized
    )]
    pub program_data: Account<'info, ProgramData>,
    #[cfg(feature = "quasar")]
    pub program_data: &'info UncheckedAccount,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct SetProtocolEmergencyPause<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(mut, seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info mut Account<ProtocolGovernance>,
}
