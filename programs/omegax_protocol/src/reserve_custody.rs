// SPDX-License-Identifier: AGPL-3.0-or-later

//! Reserve-domain and custody-vault instruction handlers and account validation contexts.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
use crate::types::*;

pub(crate) fn create_reserve_domain(
    ctx: Context<CreateReserveDomain>,
    args: CreateReserveDomainArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    require_id(&args.domain_id)?;

    let domain = &mut ctx.accounts.reserve_domain;
    domain.protocol_governance = ctx.accounts.protocol_governance.key();
    domain.domain_admin = args.domain_admin;
    domain.domain_id = args.domain_id;
    domain.display_name = args.display_name;
    domain.settlement_mode = args.settlement_mode;
    domain.legal_structure_hash = args.legal_structure_hash;
    domain.compliance_baseline_hash = args.compliance_baseline_hash;
    domain.allowed_rail_mask = args.allowed_rail_mask;
    domain.pause_flags = args.pause_flags;
    domain.active = true;
    domain.audit_nonce = 0;
    domain.bump = ctx.bumps.reserve_domain;

    emit!(ReserveDomainCreatedEvent {
        reserve_domain: domain.key(),
        domain_admin: domain.domain_admin,
        settlement_mode: domain.settlement_mode,
    });

    Ok(())
}

pub(crate) fn update_reserve_domain_controls(
    ctx: Context<UpdateReserveDomainControls>,
    args: UpdateReserveDomainControlsArgs,
) -> Result<()> {
    require_domain_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.reserve_domain,
    )?;

    let domain = &mut ctx.accounts.reserve_domain;
    domain.allowed_rail_mask = args.allowed_rail_mask;
    domain.pause_flags = args.pause_flags;
    domain.active = args.active;
    domain.audit_nonce = domain.audit_nonce.saturating_add(1);

    emit!(ScopedControlChangedEvent {
        scope_kind: ScopeKind::ReserveDomain as u8,
        scope: domain.key(),
        authority: ctx.accounts.authority.key(),
        pause_flags: domain.pause_flags,
        reason_hash: args.reason_hash,
        audit_nonce: domain.audit_nonce,
    });

    Ok(())
}

pub(crate) fn create_domain_asset_vault(
    ctx: Context<CreateDomainAssetVault>,
    args: CreateDomainAssetVaultArgs,
) -> Result<()> {
    require_domain_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.reserve_domain,
    )?;
    require!(
        args.asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::VaultTokenAccountInvalid
    );
    require_classic_spl_token(&ctx.accounts.asset_mint, &ctx.accounts.token_program)?;

    let vault = &mut ctx.accounts.domain_asset_vault;
    vault.reserve_domain = ctx.accounts.reserve_domain.key();
    vault.asset_mint = args.asset_mint;
    vault.vault_token_account = ctx.accounts.vault_token_account.key();
    vault.total_assets = 0;
    vault.bump = ctx.bumps.domain_asset_vault;

    let ledger = &mut ctx.accounts.domain_asset_ledger;
    ledger.reserve_domain = ctx.accounts.reserve_domain.key();
    ledger.asset_mint = args.asset_mint;
    ledger.sheet = ReserveBalanceSheet::default();
    ledger.bump = ctx.bumps.domain_asset_ledger;

    emit!(LedgerInitializedEvent {
        scope_kind: ScopeKind::DomainAssetVault as u8,
        scope: vault.key(),
        asset_mint: args.asset_mint,
    });

    Ok(())
}

/// Phase 1.6 — Initialize the protocol-fee vault for a (reserve_domain, asset_mint)
/// rail. Governance-only; binds the rail to the asset mint at the program edge.
/// Withdrawal authority is governance (PR2). Accrual is wired in PR1 hooks.

#[derive(Accounts)]
#[instruction(args: CreateReserveDomainArgs)]
pub struct CreateReserveDomain<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        init,
        payer = authority,
        space = 8 + ReserveDomain::INIT_SPACE,
        seeds = [SEED_RESERVE_DOMAIN, args.domain_id.as_bytes()],
        bump
    )]
    pub reserve_domain: Account<'info, ReserveDomain>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReserveDomainControls<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
}

#[derive(Accounts)]
#[instruction(args: CreateDomainAssetVaultArgs)]
pub struct CreateDomainAssetVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[account(
        init,
        payer = authority,
        space = 8 + DomainAssetVault::INIT_SPACE,
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(
        init,
        payer = authority,
        space = 8 + DomainAssetLedger::INIT_SPACE,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    // PT-2026-04-27-01/02 fix: vault token account is now PDA-owned and
    // initialized inline. SPL transfers out of this account in
    // settlement / redemption / fee-withdrawal handlers will be signed by the
    // domain_asset_vault PDA via transfer_from_domain_vault (see lib.rs:5463
    // region). Operators no longer pre-create the token account externally.
    #[account(
        constraint = asset_mint.key() == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
        constraint = asset_mint.to_account_info().owner == &anchor_spl::token::ID @ OmegaXProtocolError::Token2022NotSupported,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [SEED_DOMAIN_ASSET_VAULT_TOKEN, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump,
        token::mint = asset_mint,
        token::authority = domain_asset_vault,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        constraint = token_program.key() == anchor_spl::token::ID @ OmegaXProtocolError::Token2022NotSupported,
    )]
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
