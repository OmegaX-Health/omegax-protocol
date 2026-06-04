// SPDX-License-Identifier: AGPL-3.0-or-later

//! Reserve-domain and custody-vault instruction handlers and account validation contexts.

#[cfg(not(feature = "quasar"))]
use crate::classic_token::{Mint, TokenAccount, TokenInterface};
use crate::platform::*;
#[cfg(not(feature = "quasar"))]
use anchor_spl::token::{self, InitializeAccount3};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
#[cfg(not(feature = "quasar"))]
use crate::kernel::*;
use crate::state::*;
use crate::types::*;

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_domain_control(
    authority: &Pubkey,
    domain: &ReserveDomainAccountData<'_>,
) -> Result<()> {
    if *authority == domain.domain_admin {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_domain_admin(authority: &Pubkey, domain_admin: &Pubkey) -> Result<()> {
    require_keys_eq!(*authority, *domain_admin, OmegaXProtocolError::Unauthorized);
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_reserve_domain(
    ctx: Context<CreateReserveDomain>,
    args: CreateReserveDomainArgs,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.authority.key(),
        args.domain_admin,
        OmegaXProtocolError::Unauthorized
    );
    require_id(&args.domain_id)?;

    let domain = &mut ctx.accounts.reserve_domain;
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

#[cfg(not(feature = "quasar"))]
pub(crate) fn update_reserve_domain_controls(
    ctx: Context<UpdateReserveDomainControls>,
    args: UpdateReserveDomainControlsArgs,
) -> Result<()> {
    require_domain_control(&ctx.accounts.authority.key(), &ctx.accounts.reserve_domain)?;

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

#[cfg(feature = "quasar")]
pub(crate) fn create_reserve_domain<'info>(
    ctx: &mut Ctx<'info, CreateReserveDomain<'info>>,
    domain_admin: Pubkey,
    settlement_mode: u8,
    legal_structure_hash: [u8; 32],
    compliance_baseline_hash: [u8; 32],
    allowed_rail_mask: u16,
    pause_flags: u32,
    domain_id: &str,
    display_name: &str,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_domain_admin(&authority, &domain_admin)?;
    require_quasar_id(domain_id)?;

    let bump = ctx.accounts.reserve_domain.bump;
    ctx.accounts.reserve_domain.set_inner(
        domain_admin,
        settlement_mode,
        legal_structure_hash,
        compliance_baseline_hash,
        allowed_rail_mask,
        pause_flags,
        true,
        0,
        bump,
        domain_id,
        display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn update_reserve_domain_controls<'info>(
    ctx: &mut Ctx<'info, UpdateReserveDomainControls<'info>>,
    allowed_rail_mask: u16,
    pause_flags: u32,
    active: bool,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_domain_control(&authority, &ctx.accounts.reserve_domain)?;

    let domain = &mut ctx.accounts.reserve_domain;
    let domain_admin = domain.domain_admin;
    let settlement_mode = domain.settlement_mode;
    let legal_structure_hash = domain.legal_structure_hash;
    let compliance_baseline_hash = domain.compliance_baseline_hash;
    let audit_nonce = domain.audit_nonce.get().saturating_add(1);
    let bump = domain.bump;
    let domain_id = domain.domain_id().to_owned();
    let display_name = domain.display_name().to_owned();

    domain.set_inner(
        domain_admin,
        settlement_mode,
        legal_structure_hash,
        compliance_baseline_hash,
        allowed_rail_mask,
        pause_flags,
        active,
        audit_nonce,
        bump,
        &domain_id,
        &display_name,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_domain_asset_vault(
    ctx: Context<CreateDomainAssetVault>,
    args: CreateDomainAssetVaultArgs,
) -> Result<()> {
    require_domain_control(&ctx.accounts.authority.key(), &ctx.accounts.reserve_domain)?;
    require!(
        args.asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::VaultTokenAccountInvalid
    );
    require_classic_spl_token(&ctx.accounts.asset_mint, &ctx.accounts.token_program)?;

    let reserve_domain_key = ctx.accounts.reserve_domain.key();
    let token_account_bump = ctx.bumps.vault_token_account;
    let token_account_seeds: &[&[&[u8]]] = &[&[
        SEED_DOMAIN_ASSET_VAULT_TOKEN,
        reserve_domain_key.as_ref(),
        args.asset_mint.as_ref(),
        &[token_account_bump],
    ]];
    let token_account_lamports = Rent::get()?.minimum_balance(TokenAccount::LEN);
    anchor_lang::system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
            },
            token_account_seeds,
        ),
        token_account_lamports,
        TokenAccount::LEN as u64,
        &anchor_spl::token::ID,
    )?;
    token::initialize_account3(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        InitializeAccount3 {
            account: ctx.accounts.vault_token_account.to_account_info(),
            mint: ctx.accounts.asset_mint.to_account_info(),
            authority: ctx.accounts.domain_asset_vault.to_account_info(),
        },
    ))?;

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

#[cfg(feature = "quasar")]
pub(crate) fn create_domain_asset_vault<'info>(
    ctx: &mut Ctx<'info, CreateDomainAssetVault<'info>>,
    asset_mint_key: Pubkey,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_domain_control(&authority, &ctx.accounts.reserve_domain)?;
    require!(
        asset_mint_key != ZERO_PUBKEY,
        OmegaXProtocolError::VaultTokenAccountInvalid
    );

    ctx.accounts.domain_asset_vault.set_inner(
        *ctx.accounts.reserve_domain.address(),
        asset_mint_key,
        *ctx.accounts.vault_token_account.address(),
        0,
        ctx.bumps.domain_asset_vault,
    );

    ctx.accounts.domain_asset_ledger.set_inner(
        *ctx.accounts.reserve_domain.address(),
        asset_mint_key,
        ReserveBalanceSheet::default(),
        ctx.bumps.domain_asset_ledger,
    );

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: CreateReserveDomainArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _domain_admin: Pubkey,
        _settlement_mode: u8,
        _legal_structure_hash: [u8; 32],
        _compliance_baseline_hash: [u8; 32],
        _allowed_rail_mask: u16,
        _pause_flags: u32,
        domain_id: String<u32, 32>
    )
)]
pub struct CreateReserveDomain<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + ReserveDomain::INIT_SPACE,
            seeds = [SEED_RESERVE_DOMAIN, args.domain_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                reserve_domain.address(),
                &crate::ID,
                &[SEED_RESERVE_DOMAIN, domain_id],
                reserve_domain.bump,
            ) @ OmegaXProtocolError::ReserveDomainMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub reserve_domain: Account<ReserveDomainAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct UpdateReserveDomainControls<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            reserve_domain.address(),
            &crate::ID,
            &[SEED_RESERVE_DOMAIN, reserve_domain.domain_id().as_bytes()],
            reserve_domain.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub reserve_domain: Account<ReserveDomainAccountData<'info>>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: CreateDomainAssetVaultArgs))]
#[cfg_attr(feature = "quasar", instruction(asset_mint_key: Pubkey))]
pub struct CreateDomainAssetVault<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            reserve_domain.address(),
            &crate::ID,
            &[SEED_RESERVE_DOMAIN, reserve_domain.domain_id().as_bytes()],
            reserve_domain.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub reserve_domain: Account<ReserveDomainAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + DomainAssetVault::INIT_SPACE,
            seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[cfg_attr(
        feature = "quasar",
        account(
            init,
            payer = authority,
            seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain, asset_mint],
            bump
        )
    )]
    #[cfg(feature = "quasar")]
    pub domain_asset_vault: &'info mut Account<DomainAssetVault>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + DomainAssetLedger::INIT_SPACE,
            seeds = [SEED_DOMAIN_ASSET_LEDGER, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[cfg_attr(
        feature = "quasar",
        account(
            init,
            payer = authority,
            seeds = [SEED_DOMAIN_ASSET_LEDGER, reserve_domain, asset_mint],
            bump
        )
    )]
    #[cfg(feature = "quasar")]
    pub domain_asset_ledger: &'info mut Account<DomainAssetLedger>,
    // PT-2026-04-27-01/02 fix: vault token account is now PDA-owned and
    // initialized inline. SPL transfers out of this account in
    // settlement / redemption / fee-withdrawal handlers will be signed by the
    // domain_asset_vault PDA via transfer_from_domain_vault (see lib.rs:5463
    // region). Operators no longer pre-create the token account externally.
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = asset_mint.key() == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
        constraint = asset_mint.to_account_info().owner == &anchor_spl::token::ID @ OmegaXProtocolError::Token2022NotSupported,
    )]
    pub asset_mint: Account<'info, Mint>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = *asset_mint.address() == asset_mint_key @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: &'info Account<quasar_spl::Mint>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            mut,
            seeds = [SEED_DOMAIN_ASSET_VAULT_TOKEN, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
            bump,
        )
    )]
    #[cfg(not(feature = "quasar"))]
    /// CHECK: Created and initialized as a classic SPL token account in the handler.
    pub vault_token_account: AccountInfo<'info>,
    #[cfg_attr(
        feature = "quasar",
        account(
            init,
            payer = authority,
            seeds = [SEED_DOMAIN_ASSET_VAULT_TOKEN, reserve_domain, asset_mint],
            bump,
            token::mint = asset_mint,
            token::authority = domain_asset_vault
        )
    )]
    #[cfg(feature = "quasar")]
    pub vault_token_account: &'info mut Account<quasar_spl::Token>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        constraint = token_program.key() == anchor_spl::token::ID @ OmegaXProtocolError::Token2022NotSupported,
    )]
    pub token_program: Program<'info, TokenInterface>,
    #[cfg(feature = "quasar")]
    pub token_program: &'info Program<quasar_spl::Token>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
