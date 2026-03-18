// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for outcome schema registration and rule-binding flows.

use super::*;

#[derive(Accounts)]
#[instruction(
    schema_key_hash: [u8; 32],
    schema_key: String,
    version: u16,
    schema_hash: [u8; 32],
    schema_family: u8,
    visibility: u8,
    interop_profile_hash: [u8; 32],
    code_system_family_hash: [u8; 32],
    mapping_version: u16,
    metadata_uri: String
)]
pub struct RegisterOutcomeSchema<'info> {
    #[account(mut)]
    pub publisher: Signer<'info>,
    #[account(
        init,
        payer = publisher,
        space = OutcomeSchemaRegistryEntry::space(&schema_key, &metadata_uri),
        seeds = [SEED_SCHEMA, &schema_key_hash],
        bump,
    )]
    pub schema_entry: Account<'info, OutcomeSchemaRegistryEntry>,
    #[account(
        init,
        payer = publisher,
        space = SchemaDependencyLedger::space(),
        seeds = [SEED_SCHEMA_DEPENDENCY, &schema_key_hash],
        bump,
    )]
    pub schema_dependency: Account<'info, SchemaDependencyLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyOutcomeSchema<'info> {
    pub governance_authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub schema_entry: Account<'info, OutcomeSchemaRegistryEntry>,
}

#[derive(Accounts)]
#[instruction(schema_key_hash: [u8; 32])]
pub struct BackfillSchemaDependencyLedger<'info> {
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [SEED_SCHEMA, &schema_key_hash],
        bump = schema_entry.bump,
    )]
    pub schema_entry: Account<'info, OutcomeSchemaRegistryEntry>,
    #[account(
        init_if_needed,
        payer = governance_authority,
        space = SchemaDependencyLedger::space(),
        seeds = [SEED_SCHEMA_DEPENDENCY, &schema_key_hash],
        bump,
    )]
    pub schema_dependency: Account<'info, SchemaDependencyLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseOutcomeSchema<'info> {
    pub governance_authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, close = recipient_system_account)]
    pub schema_entry: Account<'info, OutcomeSchemaRegistryEntry>,
    #[account(
        mut,
        close = recipient_system_account,
        seeds = [SEED_SCHEMA_DEPENDENCY, &schema_entry.schema_key_hash],
        bump = schema_dependency.bump,
    )]
    pub schema_dependency: Account<'info, SchemaDependencyLedger>,
    /// CHECK: reserved for forward-compatible schema close recipient wiring.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(
    series_ref_hash: [u8; 32],
    rule_hash: [u8; 32],
    schema_key_hash: [u8; 32],
    rule_id: String,
    schema_key: String,
    schema_version: u16,
    interop_profile_hash: [u8; 32],
    code_system_family_hash: [u8; 32],
    mapping_version: u16,
    payout_hash: [u8; 32],
    enabled: bool
)]
pub struct SetPoolOutcomeRule<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub policy_series: Account<'info, PolicySeries>,
    #[account(
        seeds = [SEED_SCHEMA, &schema_key_hash],
        bump = schema_entry.bump,
    )]
    pub schema_entry: Account<'info, OutcomeSchemaRegistryEntry>,
    #[account(
        mut,
        seeds = [SEED_SCHEMA_DEPENDENCY, &schema_key_hash],
        bump = schema_dependency.bump,
    )]
    pub schema_dependency: Account<'info, SchemaDependencyLedger>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolOutcomeRule::space(&rule_id, &schema_key),
        seeds = [SEED_POOL_RULE, pool.key().as_ref(), &series_ref_hash, &rule_hash],
        bump,
    )]
    pub pool_rule: Account<'info, PoolOutcomeRule>,
    pub system_program: Program<'info, System>,
}
