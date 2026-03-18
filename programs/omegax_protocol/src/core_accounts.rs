// SPDX-License-Identifier: AGPL-3.0-or-later

//! Root account types shared across the registry approval instructions and the current protocol surface.

use anchor_lang::prelude::*;

use crate::{
    MAX_METADATA_URI_LEN, MAX_ORACLE_DISPLAY_NAME_LEN, MAX_ORACLE_LEGAL_NAME_LEN,
    MAX_ORACLE_LOGO_URI_LEN, MAX_ORACLE_SUPPORTED_SCHEMAS, MAX_ORACLE_URL_LEN,
    MAX_ORACLE_WEBHOOK_URL_LEN, SEED_ORACLE, SEED_POOL_ORACLE,
};

/// Associates an oracle registry entry with a pool for the approval flow.
#[derive(Accounts)]
pub struct SetPoolOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_ORACLE, oracle_entry.oracle.as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolOracleApproval::space(),
        seeds = [SEED_POOL_ORACLE, pool.key().as_ref(), oracle_entry.oracle.as_ref()],
        bump,
    )]
    pub pool_oracle: Account<'info, PoolOracleApproval>,
    pub system_program: Program<'info, System>,
}

/// Core pool account shared by reward, coverage, membership, and liquidity flows.
#[account]
pub struct Pool {
    pub authority: Pubkey,
    pub pool_id: String,
    pub organization_ref: String,
    pub payout_lamports_per_pass: u64,
    pub membership_mode: u8,
    pub token_gate_mint: Pubkey,
    pub token_gate_min_balance: u64,
    pub invite_issuer: Pubkey,
    pub status: u8,
    pub bump: u8,
}

impl Pool {
    /// Includes the discriminator plus the variable-length `pool_id` and `organization_ref`.
    pub fn space(pool_id: &str, organization_ref: &str) -> usize {
        8 + 32 + 4 + pool_id.len() + 4 + organization_ref.len() + 8 + 1 + 32 + 8 + 32 + 1 + 1
    }
}

/// Registry entry that records whether an oracle pubkey is currently active.
#[account]
pub struct OracleRegistryEntry {
    pub oracle: Pubkey,
    pub active: bool,
    pub bump: u8,
    pub metadata_uri: String,
}

impl OracleRegistryEntry {
    /// Includes the discriminator plus the runtime metadata URI length prefix and payload.
    pub fn space(metadata_uri: &str) -> usize {
        8 + 32 + 1 + 1 + 4 + metadata_uri.len()
    }

    /// Reserves space for the largest metadata URI accepted by the program.
    pub fn space_with_max_metadata() -> usize {
        8 + 32 + 1 + 1 + 4 + MAX_METADATA_URI_LEN
    }
}

/// Rich oracle profile used by the oracle onboarding and staking flows.
#[account]
pub struct OracleProfile {
    pub oracle: Pubkey,
    pub admin: Pubkey,
    pub oracle_type: u8,
    pub display_name: String,
    pub legal_name: String,
    pub website_url: String,
    pub app_url: String,
    pub logo_uri: String,
    pub webhook_url: String,
    pub supported_schema_count: u8,
    pub supported_schema_key_hashes: [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS],
    pub claimed: bool,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

impl OracleProfile {
    /// Uses the bounded string lengths enforced by the oracle profile validation helpers.
    pub fn space() -> usize {
        8 + 32
            + 32
            + 1
            + 4
            + MAX_ORACLE_DISPLAY_NAME_LEN
            + 4
            + MAX_ORACLE_LEGAL_NAME_LEN
            + 4
            + MAX_ORACLE_URL_LEN
            + 4
            + MAX_ORACLE_URL_LEN
            + 4
            + MAX_ORACLE_LOGO_URI_LEN
            + 4
            + MAX_ORACLE_WEBHOOK_URL_LEN
            + 1
            + (32 * MAX_ORACLE_SUPPORTED_SCHEMAS)
            + 1
            + 8
            + 8
            + 1
    }
}

/// Approval record that links a pool to an oracle pubkey.
#[account]
pub struct PoolOracleApproval {
    pub pool: Pubkey,
    pub oracle: Pubkey,
    pub active: bool,
    pub bump: u8,
}

impl PoolOracleApproval {
    /// Fixed-size account with only pubkeys, a bool, and a bump.
    pub fn space() -> usize {
        8 + 32 + 32 + 1 + 1
    }
}

/// Member record shared by enrollment, rewards, coverage, and cycle activation flows.
#[account]
pub struct MembershipRecord {
    pub pool: Pubkey,
    pub member: Pubkey,
    pub subject_commitment: [u8; 32],
    pub status: u8,
    pub enrolled_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl MembershipRecord {
    /// Fixed-size membership state keyed by pool and member.
    pub fn space() -> usize {
        8 + 32 + 32 + 32 + 1 + 8 + 8 + 1
    }
}
