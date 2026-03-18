// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for coverage products, policies, premiums, and claims.

use super::*;

#[derive(Accounts)]
#[instruction(series_ref_hash: [u8; 32])]
pub struct RegisterPolicySeriesV2<'info> {
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
        init,
        payer = authority,
        space = PolicySeries::space(),
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &series_ref_hash],
        bump,
    )]
    pub policy_series: Account<'info, PolicySeries>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePolicySeriesV2<'info> {
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
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &policy_series.series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub policy_series: Account<'info, PolicySeries>,
}

#[derive(Accounts)]
#[instruction(payment_mint: Pubkey)]
pub struct UpsertPolicySeriesPaymentOption<'info> {
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
        mut,
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &policy_series.series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub policy_series: Account<'info, PolicySeries>,
    /// CHECK: payment mint may be ZERO_PUBKEY for native SOL payment options.
    pub payment_mint: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PolicySeriesPaymentOption::space(),
        seeds = [SEED_POLICY_SERIES_PAYMENT_OPTION, pool.key().as_ref(), &policy_series.series_ref_hash, payment_mint.key().as_ref()],
        bump,
    )]
    pub policy_series_payment_option: Account<'info, PolicySeriesPaymentOption>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(series_ref_hash: [u8; 32], starts_at: i64)]
pub struct SubscribePolicySeriesV2<'info> {
    #[account(mut)]
    pub member: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.key().as_ref()],
        bump = membership.bump,
    )]
    pub membership: Account<'info, MembershipRecord>,
    #[account(
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &series_ref_hash],
        bump = policy_series.bump,
    )]
    pub policy_series: Account<'info, PolicySeries>,
    #[account(
        init,
        payer = member,
        space = PolicyPosition::space(),
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &series_ref_hash, member.key().as_ref()],
        bump,
    )]
    pub policy_position: Account<'info, PolicyPosition>,
    #[account(
        init,
        payer = member,
        space = PolicyPositionNft::space(MAX_METADATA_URI_LEN),
        seeds = [SEED_POLICY_POSITION_NFT, pool.key().as_ref(), &series_ref_hash, member.key().as_ref()],
        bump,
    )]
    pub policy_position_nft: Account<'info, PolicyPositionNft>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(member: Pubkey, series_ref_hash: [u8; 32], starts_at: i64)]
pub struct IssuePolicyPositionFromProductV2<'info> {
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
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), member.as_ref()],
        bump = membership.bump,
    )]
    pub membership: Account<'info, MembershipRecord>,
    #[account(
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &series_ref_hash],
        bump = policy_series.bump,
    )]
    pub policy_series: Account<'info, PolicySeries>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PolicyPosition::space(),
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &series_ref_hash, member.as_ref()],
        bump,
    )]
    pub policy_position: Account<'info, PolicyPosition>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PolicyPositionNft::space(MAX_METADATA_URI_LEN),
        seeds = [SEED_POLICY_POSITION_NFT, pool.key().as_ref(), &series_ref_hash, member.as_ref()],
        bump,
    )]
    pub policy_position_nft: Account<'info, PolicyPositionNft>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(member: Pubkey, series_ref_hash: [u8; 32], terms_hash: [u8; 32], starts_at: i64, ends_at: i64, premium_due_every_secs: i64, premium_grace_secs: i64)]
pub struct CreatePolicyPosition<'info> {
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
        space = PolicyPosition::space(),
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &series_ref_hash, member.as_ref()],
        bump,
    )]
    pub policy_position: Account<'info, PolicyPosition>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PolicyPositionNft::space(MAX_METADATA_URI_LEN),
        seeds = [SEED_POLICY_POSITION_NFT, pool.key().as_ref(), &series_ref_hash, member.as_ref()],
        bump,
    )]
    pub policy_position_nft: Account<'info, PolicyPositionNft>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintPolicyNft<'info> {
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
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &policy_position.series_ref_hash, policy_position.member.as_ref()],
        bump = policy_position.bump,
    )]
    pub policy_position: Account<'info, PolicyPosition>,
    #[account(
        mut,
        seeds = [SEED_POLICY_POSITION_NFT, pool.key().as_ref(), &policy_position.series_ref_hash, policy_position.member.as_ref()],
        bump = policy_position_nft.bump,
    )]
    pub policy_position_nft: Account<'info, PolicyPositionNft>,
}

#[derive(Accounts)]
pub struct PayPremiumSpl<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        mut,
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &policy_series.series_ref_hash, member.key().as_ref()],
        bump = policy_position.bump,
    )]
    pub policy_position: Box<Account<'info, PolicyPosition>>,
    /// CHECK: member key used for policy PDA and ledger identity.
    pub member: UncheckedAccount<'info>,
    #[account(
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &policy_series.series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub policy_series: Box<Account<'info, PolicySeries>>,
    #[account(
        seeds = [SEED_POLICY_SERIES_PAYMENT_OPTION, pool.key().as_ref(), &policy_series.series_ref_hash, payment_mint.key().as_ref()],
        bump = policy_series_payment_option.bump,
    )]
    pub policy_series_payment_option: Box<Account<'info, PolicySeriesPaymentOption>>,
    #[account(mut)]
    pub payment_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PremiumLedger::space(),
        seeds = [SEED_PREMIUM_LEDGER, pool.key().as_ref(), &policy_series.series_ref_hash, member.key().as_ref()],
        bump,
    )]
    pub premium_ledger: Box<Account<'info, PremiumLedger>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PoolAssetVault::space(),
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payment_mint.key().as_ref()],
        bump,
    )]
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = payment_mint,
        associated_token::authority = pool_asset_vault,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = payer_token_account.owner == payer.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = payer_token_account.mint == payment_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub payer_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayPremiumSol<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &policy_series.series_ref_hash, member.key().as_ref()],
        bump = policy_position.bump,
    )]
    pub policy_position: Account<'info, PolicyPosition>,
    /// CHECK: member key used for policy PDA and ledger identity.
    pub member: UncheckedAccount<'info>,
    #[account(
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &policy_series.series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub policy_series: Account<'info, PolicySeries>,
    #[account(
        seeds = [SEED_POLICY_SERIES_PAYMENT_OPTION, pool.key().as_ref(), &policy_series.series_ref_hash, &ZERO_PUBKEY_BYTES],
        bump = policy_series_payment_option.bump,
    )]
    pub policy_series_payment_option: Account<'info, PolicySeriesPaymentOption>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PremiumLedger::space(),
        seeds = [SEED_PREMIUM_LEDGER, pool.key().as_ref(), &policy_series.series_ref_hash, member.key().as_ref()],
        bump,
    )]
    pub premium_ledger: Account<'info, PremiumLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(member: Pubkey, series_ref_hash: [u8; 32], period_index: u64, replay_hash: [u8; 32], amount: u64, paid_at_ts: i64)]
pub struct AttestPremiumPaidOffchain<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
    pub pool: Box<Account<'info, Pool>>,
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
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub policy_series: Box<Account<'info, PolicySeries>>,
    #[account(
        mut,
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &series_ref_hash, member.as_ref()],
        bump = policy_position.bump,
    )]
    pub policy_position: Box<Account<'info, PolicyPosition>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = PremiumLedger::space(),
        seeds = [SEED_PREMIUM_LEDGER, pool.key().as_ref(), &series_ref_hash, member.as_ref()],
        bump,
    )]
    pub premium_ledger: Box<Account<'info, PremiumLedger>>,
    #[account(
        init,
        payer = oracle,
        space = PremiumAttestationReplay::space(),
        seeds = [SEED_PREMIUM_REPLAY, pool.key().as_ref(), &series_ref_hash, member.as_ref(), &replay_hash],
        bump,
    )]
    pub premium_replay: Box<Account<'info, PremiumAttestationReplay>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(member: Pubkey, series_ref_hash: [u8; 32], intent_hash: [u8; 32], event_hash: [u8; 32])]
pub struct SubmitCoverageClaim<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POLICY_SERIES, pool.key().as_ref(), &series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub policy_series: Box<Account<'info, PolicySeries>>,
    #[account(
        mut,
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &series_ref_hash, member.as_ref()],
        bump = policy_position.bump,
    )]
    pub policy_position: Box<Account<'info, PolicyPosition>>,
    #[account(
        init_if_needed,
        payer = claimant,
        space = PoolRiskConfig::space(),
        seeds = [SEED_POOL_RISK_CONFIG, pool.key().as_ref()],
        bump,
    )]
    pub pool_risk_config: Box<Account<'info, PoolRiskConfig>>,
    pub claim_delegate: Option<Box<Account<'info, ClaimDelegateAuthorization>>>,
    #[account(
        init,
        payer = claimant,
        space = CoverageClaimRecord::space(),
        seeds = [SEED_COVERAGE_CLAIM, pool.key().as_ref(), &series_ref_hash, member.as_ref(), &intent_hash],
        bump,
    )]
    pub coverage_claim: Box<Account<'info, CoverageClaimRecord>>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Box<Account<'info, PoolCompliancePolicy>>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReviewCoverageClaim<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POOL_ORACLE, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle.bump,
    )]
    pub pool_oracle: Account<'info, PoolOracleApproval>,
    #[account(
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle_permissions.bump,
    )]
    pub pool_oracle_permissions: Account<'info, PoolOraclePermissionSet>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Account<'info, CoverageClaimRecord>,
}

#[derive(Accounts)]
pub struct AttachCoverageClaimDecisionSupport<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POOL_ORACLE, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle.bump,
    )]
    pub pool_oracle: Account<'info, PoolOracleApproval>,
    #[account(
        seeds = [SEED_POOL_ORACLE_PERMISSIONS, pool.key().as_ref(), oracle.key().as_ref()],
        bump = pool_oracle_permissions.bump,
    )]
    pub pool_oracle_permissions: Account<'info, PoolOraclePermissionSet>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Account<'info, CoverageClaimRecord>,
    #[account(
        seeds = [SEED_POOL_AUTOMATION_POLICY, pool.key().as_ref()],
        bump = pool_automation_policy.bump,
    )]
    pub pool_automation_policy: Account<'info, PoolAutomationPolicy>,
}

#[derive(Accounts)]
pub struct ApproveCoverageClaim<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
    pub pool: Box<Account<'info, Pool>>,
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
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Box<Account<'info, CoverageClaimRecord>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(mut)]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DenyCoverageClaim<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
    pub pool: Box<Account<'info, Pool>>,
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
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Box<Account<'info, CoverageClaimRecord>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayCoverageClaim<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = authority)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Box<Account<'info, CoverageClaimRecord>>,
    /// CHECK: claimant is only used for address matching and recipient ownership checks.
    pub claimant: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    /// CHECK: recipient account only receives funds; no data is read.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(mut)]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimApprovedCoveragePayout<'info> {
    #[account(mut)]
    pub claim_signer: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Box<Account<'info, CoverageClaimRecord>>,
    /// CHECK: claimant is only used for address matching and recipient ownership checks.
    #[account(
        constraint = claimant.key() == coverage_claim.claimant @ OmegaXProtocolError::ClaimantMismatch,
    )]
    pub claimant: UncheckedAccount<'info>,
    /// CHECK: optional claim delegate PDA is validated during authorization.
    #[account(
        seeds = [SEED_CLAIM_DELEGATE, pool.key().as_ref(), claimant.key().as_ref()],
        bump,
    )]
    pub claim_delegate: Option<UncheckedAccount<'info>>,
    #[account(
        init_if_needed,
        payer = claim_signer,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    /// CHECK: recipient account only receives funds; no data is read.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(mut)]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseCoverageClaim<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(mut, has_one = authority)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Box<Account<'info, CoverageClaimRecord>>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleCoverageClaim<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub claimant: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
    #[account(mut)]
    pub pool: Box<Account<'info, Pool>>,
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
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        mut,
        constraint = coverage_claim.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub coverage_claim: Box<Account<'info, CoverageClaimRecord>>,
    #[account(
        mut,
        seeds = [SEED_POLICY_POSITION, pool.key().as_ref(), &coverage_claim.series_ref_hash, coverage_claim.member.as_ref()],
        bump = policy_position.bump,
    )]
    pub policy_position: Box<Account<'info, PolicyPosition>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    /// CHECK: recipient account only receives funds; no data is read.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(mut)]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
