// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for reward attestations, outcome finalization, and claims.

use super::*;

#[derive(Accounts)]
#[instruction(member: Pubkey, cycle_hash: [u8; 32], rule_hash: [u8; 32], attestation_digest: [u8; 32], observed_value_hash: [u8; 32], evidence_hash: [u8; 32], external_attestation_ref_hash: [u8; 32], ai_role: u8, automation_mode: u8, model_version_hash: [u8; 32], policy_version_hash: [u8; 32], execution_environment_hash: [u8; 32], attestation_provider_ref_hash: [u8; 32], as_of_ts: i64, passed: bool)]
pub struct SubmitOutcomeAttestationVote<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Box<Account<'info, ProtocolConfigV2>>,
    /// CHECK: the oracle self-stake PDA is verified manually so zero-stake pools can attest
    /// without requiring an initialized stake position account.
    pub stake_position: UncheckedAccount<'info>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        seeds = [SEED_POOL_ORACLE_POLICY, pool.key().as_ref()],
        bump = oracle_policy.bump,
    )]
    pub oracle_policy: Box<Account<'info, PoolOraclePolicy>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(
        seeds = [SEED_POOL_ORACLE, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle.bump,
    )]
    pub pool_oracle: Box<Account<'info, PoolOracleApproval>>,
    #[account(
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle_permissions.bump,
    )]
    pub pool_oracle_permissions: Box<Account<'info, PoolOraclePermissionSet>>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.as_ref()],
        bump = membership.bump,
    )]
    pub membership: Box<Account<'info, MembershipRecord>>,
    #[account(
        seeds = [SEED_POOL_RULE, pool.key().as_ref(), &pool_rule.series_ref_hash, &rule_hash],
        bump = pool_rule.bump,
    )]
    pub pool_rule: Box<Account<'info, PoolOutcomeRule>>,
    #[account(
        seeds = [SEED_SCHEMA, &pool_rule.schema_key_hash],
        bump = schema_entry.bump,
    )]
    pub schema_entry: Box<Account<'info, OutcomeSchemaRegistryEntry>>,
    #[account(
        init,
        payer = oracle,
        space = AttestationVote::space(),
        seeds = [SEED_ATTESTATION_VOTE, pool.key().as_ref(), &pool_rule.series_ref_hash, member.as_ref(), &cycle_hash, &rule_hash, oracle.key().as_ref()],
        bump,
    )]
    pub vote: Box<Account<'info, AttestationVote>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = CycleOutcomeAggregate::space(),
        seeds = [SEED_OUTCOME_AGGREGATE, pool.key().as_ref(), &pool_rule.series_ref_hash, member.as_ref(), &cycle_hash, &rule_hash],
        bump,
    )]
    pub aggregate: Box<Account<'info, CycleOutcomeAggregate>>,
    #[account(
        seeds = [SEED_POOL_AUTOMATION_POLICY, pool.key().as_ref()],
        bump = pool_automation_policy.bump,
    )]
    pub pool_automation_policy: Option<Box<Account<'info, PoolAutomationPolicy>>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeCycleOutcome<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        seeds = [SEED_POOL_ORACLE_POLICY, pool.key().as_ref()],
        bump = oracle_policy.bump,
    )]
    pub oracle_policy: Box<Account<'info, PoolOraclePolicy>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(
        mut,
        constraint = aggregate.pool == pool.key() @ OmegaXProtocolV2Error::AccountPoolMismatch,
    )]
    pub aggregate: Box<Account<'info, CycleOutcomeAggregate>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(member: Pubkey, cycle_hash: [u8; 32], rule_hash: [u8; 32], intent_hash: [u8; 32], payout_amount: u64, recipient: Pubkey)]
pub struct SubmitRewardClaim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Box<Account<'info, ProtocolConfigV2>>,
    #[account(mut)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        seeds = [SEED_POOL_ORACLE_POLICY, pool.key().as_ref()],
        bump = oracle_policy.bump,
    )]
    pub oracle_policy: Box<Account<'info, PoolOraclePolicy>>,
    #[account(
        init_if_needed,
        payer = claimant,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.as_ref()],
        bump = membership.bump,
    )]
    pub membership: Box<Account<'info, MembershipRecord>>,
    #[account(
        mut,
        seeds = [SEED_OUTCOME_AGGREGATE, pool.key().as_ref(), &aggregate.series_ref_hash, member.as_ref(), &cycle_hash, &rule_hash],
        bump = aggregate.bump,
    )]
    pub aggregate: Box<Account<'info, CycleOutcomeAggregate>>,
    /// CHECK: optional member-cycle account is validated in the instruction for Seeker claims.
    pub member_cycle: UncheckedAccount<'info>,
    /// CHECK: optional cohort settlement root is validated in the instruction for health-alpha Seeker claims.
    #[account(mut)]
    pub cohort_settlement_root: UncheckedAccount<'info>,
    /// CHECK: recipient is validated against instruction input and only receives payout.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
    pub claim_delegate: Option<Box<Account<'info, ClaimDelegateAuthorization>>>,
    pub pool_asset_vault: Option<Box<Account<'info, PoolAssetVault>>>,
    #[account(mut)]
    pub pool_vault_token_account: Option<Box<Account<'info, TokenAccount>>>,
    #[account(mut)]
    pub recipient_token_account: Option<Box<Account<'info, TokenAccount>>>,
    #[account(
        init,
        payer = claimant,
        space = ClaimRecordV2::space(),
        seeds = [SEED_CLAIM_V2, pool.key().as_ref(), &aggregate.series_ref_hash, member.as_ref(), &cycle_hash, &rule_hash],
        bump,
    )]
    pub claim_record_v2: Box<Account<'info, ClaimRecordV2>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Box<Account<'info, PoolCompliancePolicy>>>,
}

#[derive(Accounts)]
pub struct OpenCycleOutcomeDispute<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        constraint = aggregate.pool == pool.key() @ OmegaXProtocolV2Error::AccountPoolMismatch,
    )]
    pub aggregate: Account<'info, CycleOutcomeAggregate>,
}

#[derive(Accounts)]
pub struct ResolveCycleOutcomeDispute<'info> {
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump = pool_treasury_reserve.bump,
    )]
    pub pool_treasury_reserve: Account<'info, PoolTreasuryReserve>,
    #[account(
        mut,
        constraint = aggregate.pool == pool.key() @ OmegaXProtocolV2Error::AccountPoolMismatch,
    )]
    pub aggregate: Account<'info, CycleOutcomeAggregate>,
}
