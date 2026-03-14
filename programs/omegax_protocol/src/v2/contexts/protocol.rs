// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for protocol-level governance configuration.

use super::*;

#[derive(Accounts)]
pub struct InitializeProtocolV2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = ProtocolConfigV2::space(),
        seeds = [SEED_CONFIG_V2],
        bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetProtocolParams<'info> {
    pub governance_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
}

#[derive(Accounts)]
pub struct RotateGovernanceAuthority<'info> {
    pub governance_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
}
