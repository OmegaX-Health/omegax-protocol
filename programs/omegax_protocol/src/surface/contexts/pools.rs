// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for pool configuration, funding, and status flows.

use super::*;

#[derive(Accounts)]
#[instruction(pool_id: String, organization_ref: String)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        init,
        payer = authority,
        space = Pool::space(&pool_id, &organization_ref),
        seeds = [SEED_POOL, authority.key().as_ref(), pool_id.as_bytes()],
        bump,
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = authority,
        space = PoolTerms::space(MAX_METADATA_URI_LEN),
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(
        init,
        payer = authority,
        space = PoolOraclePolicy::space(),
        seeds = [SEED_POOL_ORACLE_POLICY, pool.key().as_ref()],
        bump,
    )]
    pub oracle_policy: Account<'info, PoolOraclePolicy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolOraclePolicy<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_POLICY, pool.key().as_ref()],
        bump = oracle_policy.bump,
    )]
    pub oracle_policy: Account<'info, PoolOraclePolicy>,
}

#[derive(Accounts)]
#[instruction(payment_mint: Pubkey)]
pub struct SetPoolCoverageReserveFloor<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), payment_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Account<'info, PoolTreasuryReserve>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolRiskControls<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolRiskConfig::space(),
        seeds = [SEED_POOL_RISK_CONFIG, pool.key().as_ref()],
        bump,
    )]
    pub pool_risk_config: Account<'info, PoolRiskConfig>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Account<'info, PoolTreasuryReserve>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Account<'info, PoolControlAuthority>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(series_ref_hash: [u8; 32])]
pub struct SetPolicySeries<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PolicySeries::space(),
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &series_ref_hash],
        bump,
    )]
    pub policy_series: Account<'info, PolicySeries>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Account<'info, PoolControlAuthority>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolCompliancePolicy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolCompliancePolicy::space(),
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump,
    )]
    pub pool_compliance_policy: Account<'info, PoolCompliancePolicy>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Account<'info, PoolControlAuthority>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolControlAuthorities<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolControlAuthority::space(),
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump,
    )]
    pub pool_control_authority: Account<'info, PoolControlAuthority>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolAutomationPolicy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolAutomationPolicy::space(),
        seeds = [SEED_POOL_AUTOMATION_POLICY, pool.key().as_ref()],
        bump,
    )]
    pub pool_automation_policy: Account<'info, PoolAutomationPolicy>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Account<'info, PoolControlAuthority>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolOraclePermissions<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    /// CHECK: oracle pubkey is verified through the registry PDA.
    pub oracle: UncheckedAccount<'info>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    #[account(
        seeds = [SEED_POOL_ORACLE, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle.bump,
        constraint = pool_oracle.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
        constraint = pool_oracle.oracle == oracle.key() @ OmegaXProtocolError::OracleKeyMismatch,
    )]
    pub pool_oracle: Account<'info, PoolOracleApproval>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolOraclePermissionSet::space(),
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump,
    )]
    pub pool_oracle_permissions: Account<'info, PoolOraclePermissionSet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolStatus<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct SetPoolTermsHash<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
}

#[derive(Accounts)]
pub struct FundPoolSol<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundPoolSpl<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(mut)]
    pub payout_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = funder,
        space = PoolAssetVault::space(),
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payout_mint.key().as_ref()],
        bump,
    )]
    pub pool_asset_vault: Account<'info, PoolAssetVault>,
    #[account(
        init_if_needed,
        payer = funder,
        associated_token::mint = payout_mint,
        associated_token::authority = pool_asset_vault,
    )]
    pub pool_vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub funder_token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
