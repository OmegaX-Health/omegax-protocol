// SPDX-License-Identifier: AGPL-3.0-or-later

//! Classic SPL-token custody checks and vault transfer helpers.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

pub(crate) fn require_classic_token_program_keys(
    mint_owner: Pubkey,
    token_program: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        mint_owner,
        anchor_spl::token::ID,
        OmegaXProtocolError::Token2022NotSupported
    );
    require_keys_eq!(
        token_program,
        anchor_spl::token::ID,
        OmegaXProtocolError::Token2022NotSupported
    );
    Ok(())
}

pub(crate) fn require_classic_spl_token<'info>(
    asset_mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    require_classic_token_program_keys(*asset_mint.to_account_info().owner, token_program.key())
}

pub(crate) fn transfer_to_domain_vault<'info>(
    amount: u64,
    authority: &Signer<'info>,
    source_token_account: &InterfaceAccount<'info, TokenAccount>,
    asset_mint: &InterfaceAccount<'info, Mint>,
    vault_token_account: &InterfaceAccount<'info, TokenAccount>,
    token_program: &Interface<'info, TokenInterface>,
    domain_asset_vault: &DomainAssetVault,
) -> Result<()> {
    require_classic_spl_token(asset_mint, token_program)?;
    require_keys_eq!(
        source_token_account.owner,
        authority.key(),
        OmegaXProtocolError::TokenAccountOwnerMismatch
    );
    require_keys_neq!(
        source_token_account.key(),
        vault_token_account.key(),
        OmegaXProtocolError::TokenAccountSelfTransferInvalid
    );
    require_keys_eq!(
        source_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        asset_mint.key(),
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        vault_token_account.key(),
        domain_asset_vault.vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    require_keys_eq!(
        vault_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let accounts = TransferChecked {
        from: source_token_account.to_account_info(),
        mint: asset_mint.to_account_info(),
        to: vault_token_account.to_account_info(),
        authority: authority.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new(token_program.to_account_info(), accounts),
        amount,
        asset_mint.decimals,
    )
}

// PDA-signed outflow helper. Unblocks PT-2026-04-27-01 and PT-2026-04-27-02:
// settlement, redemption, release, and fee-withdrawal handlers will call this
// to actually move SPL tokens out of the program-PDA-owned vault token account.
// Authority on the CPI is the `domain_asset_vault` PDA (post vault-custody
// refactor in section 1.2 of the remediation plan).
//
// Caller note: this helper assumes `vault_token_account.owner` is the
// `domain_asset_vault` PDA. That invariant is established once
// `create_domain_asset_vault` is refactored to init the token account with
// `token::authority = domain_asset_vault`. Without that refactor in place the
// CPI will fail at runtime with TokenOwnerMismatch — by design.
#[allow(dead_code)]
pub(crate) fn transfer_from_domain_vault<'info>(
    amount: u64,
    domain_asset_vault: &Account<'info, DomainAssetVault>,
    vault_token_account: &InterfaceAccount<'info, TokenAccount>,
    recipient_token_account: &InterfaceAccount<'info, TokenAccount>,
    asset_mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    require_classic_spl_token(asset_mint, token_program)?;
    require_keys_eq!(
        vault_token_account.key(),
        domain_asset_vault.vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    require_keys_eq!(
        asset_mint.key(),
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        vault_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        recipient_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_neq!(
        vault_token_account.key(),
        recipient_token_account.key(),
        OmegaXProtocolError::TokenAccountSelfTransferInvalid
    );

    let reserve_domain = domain_asset_vault.reserve_domain;
    let asset_mint_key = domain_asset_vault.asset_mint;
    let bump = domain_asset_vault.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        SEED_DOMAIN_ASSET_VAULT,
        reserve_domain.as_ref(),
        asset_mint_key.as_ref(),
        &[bump],
    ]];

    let accounts = TransferChecked {
        from: vault_token_account.to_account_info(),
        mint: asset_mint.to_account_info(),
        to: recipient_token_account.to_account_info(),
        authority: domain_asset_vault.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new_with_signer(token_program.to_account_info(), accounts, signer_seeds),
        amount,
        asset_mint.decimals,
    )
}
