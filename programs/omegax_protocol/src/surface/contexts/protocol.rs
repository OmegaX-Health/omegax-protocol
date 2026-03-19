// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for protocol-level governance configuration.

use super::*;

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key())
    )]
    pub program: Program<'info, crate::program::OmegaxProtocol>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(admin.key())
    )]
    pub program_data: Account<'info, ProgramData>,
    #[account(
        init,
        payer = admin,
        space = ProtocolConfig::space(),
        seeds = [SEED_CONFIG],
        bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetProtocolParams<'info> {
    pub governance_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct RotateGovernanceAuthority<'info> {
    pub governance_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
}
