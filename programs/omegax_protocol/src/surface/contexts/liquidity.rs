// SPDX-License-Identifier: AGPL-3.0-or-later

//! Account validation for pool-liquidity bootstrap, deposit, and redeem flows.

use super::*;

#[derive(Accounts)]
pub struct InitializePoolLiquiditySol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(
        init,
        payer = authority,
        space = PoolLiquidityConfig::space(),
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump,
    )]
    pub pool_liquidity_config: Account<'info, PoolLiquidityConfig>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = pool_liquidity_config,
        seeds = [SEED_POOL_SHARE_MINT, pool.key().as_ref()],
        bump,
    )]
    pub pool_share_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = pool_share_mint,
        associated_token::authority = authority,
    )]
    pub authority_share_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePoolLiquiditySpl<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(mut)]
    pub payout_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = authority,
        space = PoolAssetVault::space(),
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payout_mint.key().as_ref()],
        bump,
    )]
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = payout_mint,
        associated_token::authority = pool_asset_vault,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = authority_payout_token_account.owner == authority.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = authority_payout_token_account.mint == payout_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub authority_payout_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = authority,
        space = PoolLiquidityConfig::space(),
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump,
    )]
    pub pool_liquidity_config: Box<Account<'info, PoolLiquidityConfig>>,
    #[account(
        init,
        payer = authority,
        mint::decimals = payout_mint.decimals,
        mint::authority = pool_liquidity_config,
        seeds = [SEED_POOL_SHARE_MINT, pool.key().as_ref()],
        bump,
    )]
    pub pool_share_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = pool_share_mint,
        associated_token::authority = authority,
    )]
    pub authority_share_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolLiquidityEnabled<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump = pool_liquidity_config.bump,
    )]
    pub pool_liquidity_config: Account<'info, PoolLiquidityConfig>,
}

#[derive(Accounts)]
pub struct RegisterPoolCapitalClass<'info> {
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
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump = pool_liquidity_config.bump,
    )]
    pub pool_liquidity_config: Account<'info, PoolLiquidityConfig>,
    #[account(mut)]
    pub pool_share_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = authority,
        space = PoolCapitalClass::space(),
        seeds = [SEED_POOL_CAPITAL_CLASS, pool.key().as_ref(), pool_share_mint.key().as_ref()],
        bump,
    )]
    pub pool_capital_class: Account<'info, PoolCapitalClass>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositPoolLiquiditySol<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(
        mut,
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump = pool_liquidity_config.bump,
    )]
    pub pool_liquidity_config: Account<'info, PoolLiquidityConfig>,
    #[account(mut)]
    pub pool_share_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = pool_share_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_share_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [SEED_POOL_CAPITAL_CLASS, pool.key().as_ref(), pool_share_mint.key().as_ref()],
        bump = pool_capital_class.bump,
    )]
    pub pool_capital_class: Option<Account<'info, PoolCapitalClass>>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Account<'info, PoolCompliancePolicy>>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), depositor.key().as_ref()],
        bump = membership.bump,
    )]
    pub membership: Option<Account<'info, MembershipRecord>>,
}

#[derive(Accounts)]
pub struct DepositPoolLiquiditySpl<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(mut)]
    pub payout_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payout_mint.key().as_ref()],
        bump = pool_asset_vault.bump,
    )]
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(
        mut,
        constraint = pool_vault_token_account.key() == pool_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
        constraint = pool_vault_token_account.mint == payout_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = depositor_payout_token_account.owner == depositor.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = depositor_payout_token_account.mint == payout_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub depositor_payout_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump = pool_liquidity_config.bump,
    )]
    pub pool_liquidity_config: Box<Account<'info, PoolLiquidityConfig>>,
    #[account(mut)]
    pub pool_share_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = pool_share_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_share_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [SEED_POOL_CAPITAL_CLASS, pool.key().as_ref(), pool_share_mint.key().as_ref()],
        bump = pool_capital_class.bump,
    )]
    pub pool_capital_class: Option<Box<Account<'info, PoolCapitalClass>>>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Box<Account<'info, PoolCompliancePolicy>>>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), depositor.key().as_ref()],
        bump = membership.bump,
    )]
    pub membership: Option<Box<Account<'info, MembershipRecord>>>,
}

#[derive(Accounts)]
pub struct RedeemPoolLiquiditySol<'info> {
    #[account(mut)]
    pub redeemer: Signer<'info>,
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
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump = pool_liquidity_config.bump,
    )]
    pub pool_liquidity_config: Box<Account<'info, PoolLiquidityConfig>>,
    #[account(
        init_if_needed,
        payer = redeemer,
        space = PoolRiskConfig::space(),
        seeds = [SEED_POOL_RISK_CONFIG, pool.key().as_ref()],
        bump,
    )]
    pub pool_risk_config: Box<Account<'info, PoolRiskConfig>>,
    #[account(
        init_if_needed,
        payer = redeemer,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), ZERO_PUBKEY.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(mut)]
    pub pool_share_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = redeemer_share_token_account.owner == redeemer.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = redeemer_share_token_account.mint == pool_share_mint.key() @ OmegaXProtocolError::ShareMintMismatch,
    )]
    pub redeemer_share_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [SEED_POOL_CAPITAL_CLASS, pool.key().as_ref(), pool_share_mint.key().as_ref()],
        bump = pool_capital_class.bump,
    )]
    pub pool_capital_class: Option<Box<Account<'info, PoolCapitalClass>>>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Box<Account<'info, PoolCompliancePolicy>>>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), redeemer.key().as_ref()],
        bump = membership.bump,
    )]
    pub membership: Option<Box<Account<'info, MembershipRecord>>>,
}

#[derive(Accounts)]
pub struct RedeemPoolLiquiditySpl<'info> {
    #[account(mut)]
    pub redeemer: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(mut)]
    pub payout_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payout_mint.key().as_ref()],
        bump = pool_asset_vault.bump,
    )]
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(
        mut,
        constraint = pool_vault_token_account.key() == pool_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
        constraint = pool_vault_token_account.mint == payout_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = redeemer_payout_token_account.owner == redeemer.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = redeemer_payout_token_account.mint == payout_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub redeemer_payout_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump = pool_liquidity_config.bump,
    )]
    pub pool_liquidity_config: Box<Account<'info, PoolLiquidityConfig>>,
    #[account(
        init_if_needed,
        payer = redeemer,
        space = PoolRiskConfig::space(),
        seeds = [SEED_POOL_RISK_CONFIG, pool.key().as_ref()],
        bump,
    )]
    pub pool_risk_config: Box<Account<'info, PoolRiskConfig>>,
    #[account(
        init_if_needed,
        payer = redeemer,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), payout_mint.key().as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(mut)]
    pub pool_share_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = redeemer_share_token_account.owner == redeemer.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = redeemer_share_token_account.mint == pool_share_mint.key() @ OmegaXProtocolError::ShareMintMismatch,
    )]
    pub redeemer_share_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [SEED_POOL_CAPITAL_CLASS, pool.key().as_ref(), pool_share_mint.key().as_ref()],
        bump = pool_capital_class.bump,
    )]
    pub pool_capital_class: Option<Box<Account<'info, PoolCapitalClass>>>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Box<Account<'info, PoolCompliancePolicy>>>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), redeemer.key().as_ref()],
        bump = membership.bump,
    )]
    pub membership: Option<Box<Account<'info, MembershipRecord>>>,
}

#[derive(Accounts)]
#[instruction(request_hash: [u8; 32])]
pub struct RequestPoolLiquidityRedemption<'info> {
    #[account(mut)]
    pub redeemer: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(
        seeds = [SEED_POOL_LIQUIDITY_CONFIG, pool.key().as_ref()],
        bump = pool_liquidity_config.bump,
    )]
    pub pool_liquidity_config: Box<Account<'info, PoolLiquidityConfig>>,
    #[account(
        init_if_needed,
        payer = redeemer,
        space = PoolRiskConfig::space(),
        seeds = [SEED_POOL_RISK_CONFIG, pool.key().as_ref()],
        bump,
    )]
    pub pool_risk_config: Box<Account<'info, PoolRiskConfig>>,
    #[account(
        init_if_needed,
        payer = redeemer,
        space = PoolTreasuryReserve::space(),
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), pool_terms.payout_asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(mut)]
    pub pool_share_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = redeemer_share_token_account.owner == redeemer.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = redeemer_share_token_account.mint == pool_share_mint.key() @ OmegaXProtocolError::ShareMintMismatch,
    )]
    pub redeemer_share_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = redeemer,
        space = PoolRedemptionRequest::space(),
        seeds = [SEED_REDEMPTION_REQUEST, pool.key().as_ref(), redeemer.key().as_ref(), &request_hash],
        bump,
    )]
    pub redemption_request: Box<Account<'info, PoolRedemptionRequest>>,
    #[account(
        init,
        payer = redeemer,
        associated_token::mint = pool_share_mint,
        associated_token::authority = redemption_request,
    )]
    pub redemption_request_share_escrow: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [SEED_POOL_CAPITAL_CLASS, pool.key().as_ref(), pool_share_mint.key().as_ref()],
        bump = pool_capital_class.bump,
    )]
    pub pool_capital_class: Option<Box<Account<'info, PoolCapitalClass>>>,
    #[account(
        seeds = [SEED_POOL_COMPLIANCE_POLICY, pool.key().as_ref()],
        bump = pool_compliance_policy.bump,
    )]
    pub pool_compliance_policy: Option<Box<Account<'info, PoolCompliancePolicy>>>,
    #[account(
        seeds = [SEED_MEMBERSHIP, pool.key().as_ref(), redeemer.key().as_ref()],
        bump = membership.bump,
    )]
    pub membership: Option<Box<Account<'info, MembershipRecord>>>,
}

#[derive(Accounts)]
pub struct SchedulePoolLiquidityRedemption<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        constraint = redemption_request.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub redemption_request: Account<'info, PoolRedemptionRequest>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Account<'info, PoolControlAuthority>>,
}

#[derive(Accounts)]
pub struct CancelPoolLiquidityRedemption<'info> {
    #[account(mut)]
    pub redeemer: Signer<'info>,
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        constraint = redemption_request.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
        constraint = redemption_request.redeemer == redeemer.key() @ OmegaXProtocolError::RedemptionRequestUnauthorized,
    )]
    pub redemption_request: Account<'info, PoolRedemptionRequest>,
    #[account(mut)]
    pub pool_share_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = pool_share_mint,
        associated_token::authority = redemption_request,
    )]
    pub redemption_request_share_escrow: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = redeemer_share_token_account.owner == redeemer.key() @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = redeemer_share_token_account.mint == pool_share_mint.key() @ OmegaXProtocolError::ShareMintMismatch,
    )]
    pub redeemer_share_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FailPoolLiquidityRedemption<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        constraint = redemption_request.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub redemption_request: Account<'info, PoolRedemptionRequest>,
    #[account(mut)]
    pub pool_share_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = pool_share_mint,
        associated_token::authority = redemption_request,
    )]
    pub redemption_request_share_escrow: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = redeemer_share_token_account.owner == redemption_request.redeemer @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = redeemer_share_token_account.mint == pool_share_mint.key() @ OmegaXProtocolError::ShareMintMismatch,
    )]
    pub redeemer_share_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Account<'info, PoolControlAuthority>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FulfillPoolLiquidityRedemptionSol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), ZERO_PUBKEY.as_ref()],
        bump = pool_treasury_reserve.bump,
    )]
    pub pool_treasury_reserve: Account<'info, PoolTreasuryReserve>,
    #[account(
        mut,
        constraint = redemption_request.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub redemption_request: Account<'info, PoolRedemptionRequest>,
    #[account(mut)]
    pub pool_share_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = pool_share_mint,
        associated_token::authority = redemption_request,
    )]
    pub redemption_request_share_escrow: Account<'info, TokenAccount>,
    /// CHECK: recipient only receives lamports and must match the request redeemer.
    #[account(mut)]
    pub redeemer_system_account: UncheckedAccount<'info>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Account<'info, PoolControlAuthority>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FulfillPoolLiquidityRedemptionSpl<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, ProtocolConfig>>,
    pub pool: Box<Account<'info, Pool>>,
    #[account(
        seeds = [SEED_POOL_TERMS, pool.key().as_ref()],
        bump = pool_terms.bump,
    )]
    pub pool_terms: Box<Account<'info, PoolTerms>>,
    #[account(mut)]
    pub payout_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [SEED_POOL_ASSET_VAULT, pool.key().as_ref(), payout_mint.key().as_ref()],
        bump = pool_asset_vault.bump,
    )]
    pub pool_asset_vault: Box<Account<'info, PoolAssetVault>>,
    #[account(
        mut,
        constraint = pool_vault_token_account.key() == pool_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
        constraint = pool_vault_token_account.mint == payout_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub pool_vault_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_RESERVE, pool.key().as_ref(), payout_mint.key().as_ref()],
        bump = pool_treasury_reserve.bump,
    )]
    pub pool_treasury_reserve: Box<Account<'info, PoolTreasuryReserve>>,
    #[account(
        mut,
        constraint = redemption_request.pool == pool.key() @ OmegaXProtocolError::AccountPoolMismatch,
    )]
    pub redemption_request: Box<Account<'info, PoolRedemptionRequest>>,
    #[account(mut)]
    pub pool_share_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = pool_share_mint,
        associated_token::authority = redemption_request,
    )]
    pub redemption_request_share_escrow: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = redeemer_payout_token_account.owner == redemption_request.redeemer @ OmegaXProtocolError::TokenAccountOwnerMismatch,
        constraint = redeemer_payout_token_account.mint == payout_mint.key() @ OmegaXProtocolError::PayoutMintMismatch,
    )]
    pub redeemer_payout_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        seeds = [SEED_POOL_CONTROL_AUTHORITY, pool.key().as_ref()],
        bump = pool_control_authority.bump,
    )]
    pub pool_control_authority: Option<Box<Account<'info, PoolControlAuthority>>>,
    pub token_program: Program<'info, Token>,
}
