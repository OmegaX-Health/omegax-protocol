// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for quoted cycle activation and settlement flows.

use super::*;

#[derive(Accounts)]
pub struct ActivateCycleWithQuoteSplSubject<'info> {
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: member identity is validated against payer and PDA seeds.
    pub member: UncheckedAccount<'info>,
    /// CHECK: oracle identity is validated via the registry and detached quote verification.
    pub oracle: UncheckedAccount<'info>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
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
}

#[derive(Accounts)]
#[instruction(
    series_ref_hash: [u8; 32],
    period_index: u64,
    nonce_hash: [u8; 32],
)]
pub struct ActivateCycleWithQuoteSpl<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Box<Account<'info, ProtocolConfigV2>>,
    pub subject: ActivateCycleWithQuoteSplSubject<'info>,
    #[account(
        seeds = [SEED_POOL_ORACLE_POLICY, subject.pool.key().as_ref()],
        bump = oracle_policy.bump,
    )]
    pub oracle_policy: Box<Account<'info, PoolOraclePolicy>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = MembershipRecord::space(),
        seeds = [SEED_MEMBERSHIP, subject.pool.key().as_ref(), subject.member.key().as_ref()],
        bump,
    )]
    pub membership: Box<Account<'info, MembershipRecord>>,
    #[account(
        seeds = [SEED_POLICY_SERIES, subject.pool.key().as_ref(), &series_ref_hash],
        bump,
    )]
    /// CHECK: PDA is verified by seeds and deserialized in-instruction for validation.
    pub policy_series: UncheckedAccount<'info>,
    #[account(
        seeds = [SEED_POLICY_SERIES_PAYMENT_OPTION, subject.pool.key().as_ref(), &series_ref_hash, payment_mint.key().as_ref()],
        bump,
    )]
    /// CHECK: PDA is verified by seeds and deserialized in-instruction for validation.
    pub policy_series_payment_option: UncheckedAccount<'info>,
    /// CHECK: payment mint is validated by quote/product payment option and only passed through to CPI account metas.
    pub payment_mint: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PolicyPosition::space(),
        seeds = [SEED_POLICY_POSITION, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref()],
        bump,
    )]
    pub policy_position: Box<Account<'info, PolicyPosition>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PolicyPositionNft::space(MAX_METADATA_URI_LEN),
        seeds = [SEED_POLICY_POSITION_NFT, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref()],
        bump,
    )]
    pub policy_position_nft: Box<Account<'info, PolicyPositionNft>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PremiumLedger::space(),
        seeds = [SEED_PREMIUM_LEDGER, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref()],
        bump,
    )]
    pub premium_ledger: Box<Account<'info, PremiumLedger>>,
    /// CHECK: PDA is verified by seeds and initialized by the instruction when empty.
    #[account(
        mut,
        seeds = [SEED_POOL_ASSET_VAULT, subject.pool.key().as_ref(), payment_mint.key().as_ref()],
        bump,
    )]
    pub pool_asset_vault: UncheckedAccount<'info>,
    /// CHECK: ATA address is verified against the pool asset vault authority and created when empty.
    #[account(mut)]
    pub pool_vault_token_account: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = payer_token_account.owner == payer.key() @ OmegaXProtocolV2Error::TokenAccountOwnerMismatch,
        constraint = payer_token_account.mint == payment_mint.key() @ OmegaXProtocolV2Error::PayoutMintMismatch,
    )]
    pub payer_token_account: Box<Account<'info, TokenAccount>>,
    /// CHECK: PDA is verified by seeds and initialized by the instruction when empty.
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, payment_mint.key().as_ref()],
        bump,
    )]
    pub protocol_fee_vault: UncheckedAccount<'info>,
    /// CHECK: ATA address is verified against the protocol fee vault authority and created when empty.
    #[account(mut)]
    pub protocol_fee_vault_token_account: UncheckedAccount<'info>,
    /// CHECK: PDA is verified by seeds and initialized by the instruction when empty.
    #[account(
        mut,
        seeds = [
            SEED_POOL_ORACLE_FEE_VAULT,
            subject.pool.key().as_ref(),
            subject.oracle.key().as_ref(),
            payment_mint.key().as_ref(),
        ],
        bump,
    )]
    pub pool_oracle_fee_vault: UncheckedAccount<'info>,
    /// CHECK: ATA address is verified against the oracle fee vault authority and created when empty.
    #[account(mut)]
    pub pool_oracle_fee_vault_token_account: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, subject.pool.key().as_ref(), payment_mint.key().as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(
        init,
        payer = payer,
        space = MemberCycleState::space(),
        seeds = [SEED_MEMBER_CYCLE, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref(), &period_index.to_le_bytes()],
        bump,
    )]
    pub member_cycle: Box<Account<'info, MemberCycleState>>,
    #[account(
        init,
        payer = payer,
        space = CycleQuoteReplay::space(),
        seeds = [SEED_CYCLE_QUOTE_REPLAY, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref(), &nonce_hash],
        bump,
    )]
    pub cycle_quote_replay: Box<Account<'info, CycleQuoteReplay>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActivateCycleWithQuoteSolSubject<'info> {
    #[account(mut)]
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: member identity is validated against payer and PDA seeds.
    pub member: UncheckedAccount<'info>,
    /// CHECK: oracle identity is validated via the registry and detached quote verification.
    pub oracle: UncheckedAccount<'info>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
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
        seeds = [SEED_POOL_ORACLE_POLICY, pool.key().as_ref()],
        bump = oracle_policy.bump,
    )]
    pub oracle_policy: Box<Account<'info, PoolOraclePolicy>>,
}

#[derive(Accounts)]
#[instruction(
    series_ref_hash: [u8; 32],
    period_index: u64,
    nonce_hash: [u8; 32],
)]
pub struct ActivateCycleWithQuoteSol<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Box<Account<'info, ProtocolConfigV2>>,
    pub subject: ActivateCycleWithQuoteSolSubject<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        space = MembershipRecord::space(),
        seeds = [SEED_MEMBERSHIP, subject.pool.key().as_ref(), subject.member.key().as_ref()],
        bump,
    )]
    pub membership: Box<Account<'info, MembershipRecord>>,
    #[account(
        seeds = [SEED_POLICY_SERIES, subject.pool.key().as_ref(), &series_ref_hash],
        bump = policy_series.bump,
        constraint = policy_series.pool == subject.pool.key() @ OmegaXProtocolV2Error::AccountPoolMismatch,
    )]
    pub policy_series: Box<Account<'info, PolicySeries>>,
    #[account(
        seeds = [SEED_POLICY_SERIES_PAYMENT_OPTION, subject.pool.key().as_ref(), &series_ref_hash, &ZERO_PUBKEY_BYTES],
        bump = policy_series_payment_option.bump,
    )]
    pub policy_series_payment_option: Box<Account<'info, PolicySeriesPaymentOption>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PolicyPosition::space(),
        seeds = [SEED_POLICY_POSITION, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref()],
        bump,
    )]
    pub policy_position: Box<Account<'info, PolicyPosition>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PolicyPositionNft::space(MAX_METADATA_URI_LEN),
        seeds = [SEED_POLICY_POSITION_NFT, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref()],
        bump,
    )]
    pub policy_position_nft: Box<Account<'info, PolicyPositionNft>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PremiumLedger::space(),
        seeds = [SEED_PREMIUM_LEDGER, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref()],
        bump,
    )]
    pub premium_ledger: Box<Account<'info, PremiumLedger>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = ProtocolFeeVault::space(),
        seeds = [SEED_PROTOCOL_FEE_VAULT, &ZERO_PUBKEY_BYTES],
        bump,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PoolOracleFeeVault::space(),
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, subject.pool.key().as_ref(), subject.oracle.key().as_ref(), &ZERO_PUBKEY_BYTES],
        bump,
    )]
    pub pool_oracle_fee_vault: Box<Account<'info, PoolOracleFeeVault>>,
    #[account(
        init_if_needed,
        payer = payer,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, subject.pool.key().as_ref(), &ZERO_PUBKEY_BYTES],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(
        init,
        payer = payer,
        space = MemberCycleState::space(),
        seeds = [SEED_MEMBER_CYCLE, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref(), &period_index.to_le_bytes()],
        bump,
    )]
    pub member_cycle: Box<Account<'info, MemberCycleState>>,
    #[account(
        init,
        payer = payer,
        space = CycleQuoteReplay::space(),
        seeds = [SEED_CYCLE_QUOTE_REPLAY, subject.pool.key().as_ref(), &series_ref_hash, subject.member.key().as_ref(), &nonce_hash],
        bump,
    )]
    pub cycle_quote_replay: Box<Account<'info, CycleQuoteReplay>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(series_ref_hash: [u8; 32], period_index: u64)]
pub struct SettleCycleCommitment<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Box<Account<'info, ProtocolConfigV2>>,
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: member key is validated through PDA seeds and cycle state.
    pub member: UncheckedAccount<'info>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
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
    #[account(mut)]
    pub payment_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), payment_mint.key().as_ref()],
        bump = pool_treasury_reserve.bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payment_mint.key().as_ref()],
        bump = pool_asset_vault.bump,
    )]
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(
        mut,
        constraint = pool_vault_token_account.key() == pool_asset_vault.vault_token_account @ OmegaXProtocolV2Error::VaultTokenAccountMismatch,
        constraint = pool_vault_token_account.mint == payment_mint.key() @ OmegaXProtocolV2Error::PayoutMintMismatch,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [SEED_MEMBER_CYCLE, pool.key().as_ref(), &series_ref_hash, member.key().as_ref(), &period_index.to_le_bytes()],
        bump = member_cycle.bump,
    )]
    pub member_cycle: Box<Account<'info, MemberCycleState>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = CohortSettlementRoot::space(),
        seeds = [SEED_COHORT_SETTLEMENT_ROOT, pool.key().as_ref(), &series_ref_hash, &member_cycle.cohort_hash],
        bump,
    )]
    pub cohort_settlement_root: Box<Account<'info, CohortSettlementRoot>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(series_ref_hash: [u8; 32], period_index: u64)]
pub struct SettleCycleCommitmentSol<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Box<Account<'info, ProtocolConfigV2>>,
    #[account(mut)]
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: member key is validated through PDA seeds and cycle state.
    pub member: UncheckedAccount<'info>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Box<Account<'info, OracleRegistryEntry>>,
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
        mut,
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), &ZERO_PUBKEY_BYTES],
        bump = pool_treasury_reserve.bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    /// CHECK: recipient only receives lamports and must match the member.
    #[account(mut)]
    pub recipient_system_account: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [SEED_MEMBER_CYCLE, pool.key().as_ref(), &series_ref_hash, member.key().as_ref(), &period_index.to_le_bytes()],
        bump = member_cycle.bump,
    )]
    pub member_cycle: Box<Account<'info, MemberCycleState>>,
    #[account(
        init_if_needed,
        payer = oracle,
        space = CohortSettlementRoot::space(),
        seeds = [SEED_COHORT_SETTLEMENT_ROOT, pool.key().as_ref(), &series_ref_hash, &member_cycle.cohort_hash],
        bump,
    )]
    pub cohort_settlement_root: Box<Account<'info, CohortSettlementRoot>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(series_ref_hash: [u8; 32], cohort_hash: [u8; 32])]
pub struct FinalizeCohortSettlementRoot<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG_V2],
        bump = config_v2.bump,
    )]
    pub config_v2: Account<'info, ProtocolConfigV2>,
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [crate::SEED_ORACLE, oracle.key().as_ref()],
        bump = oracle_entry.bump,
    )]
    pub oracle_entry: Account<'info, OracleRegistryEntry>,
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
        seeds = [SEED_COHORT_SETTLEMENT_ROOT, pool.key().as_ref(), &series_ref_hash, &cohort_hash],
        bump = cohort_settlement_root.bump,
    )]
    pub cohort_settlement_root: Account<'info, CohortSettlementRoot>,
}
