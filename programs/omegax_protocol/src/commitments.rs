// SPDX-License-Identifier: AGPL-3.0-or-later

//! Founder commitment campaign instruction handlers and account validation contexts.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::reserve_waterfall::{
    require_reserve_asset_rail_capacity_enabled, require_reserve_asset_rail_deposit_enabled,
};
use crate::state::*;
use crate::types::*;

pub(crate) fn create_commitment_campaign(
    ctx: Context<CreateCommitmentCampaign>,
    args: CreateCommitmentCampaignArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_id(&args.campaign_id)?;
    require_bounded_string(&args.display_name, MAX_NAME_LEN)?;
    require_bounded_string(&args.metadata_uri, MAX_URI_LEN)?;
    require_commitment_mode(args.mode)?;
    require_positive_amount(args.deposit_amount)?;
    require_positive_amount(args.coverage_amount)?;
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.health_plan,
        ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.asset_mint,
        args.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.key(),
        ctx.accounts.coverage_funding_line_ledger.funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require!(
        ctx.accounts.coverage_funding_line.line_type == FUNDING_LINE_TYPE_PREMIUM_INCOME,
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    require_keys_eq!(
        ctx.accounts.payment_domain_asset_vault.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.payment_domain_asset_vault.asset_mint,
        args.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.reserve_asset_rail.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_keys_eq!(
        ctx.accounts.reserve_asset_rail.asset_mint,
        args.payment_asset_mint,
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_reserve_asset_rail_deposit_enabled(&ctx.accounts.reserve_asset_rail)?;
    require_keys_eq!(
        ctx.accounts.coverage_domain_asset_ledger.asset_mint,
        args.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_plan_reserve_ledger.asset_mint,
        args.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line_ledger.asset_mint,
        args.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    if args.mode == COMMITMENT_MODE_TREASURY_CREDIT {
        require_keys_neq!(
            args.payment_asset_mint,
            args.coverage_asset_mint,
            OmegaXProtocolError::TreasuryCreditAssetMismatch
        );
    }

    let campaign = &mut ctx.accounts.campaign;
    campaign.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    campaign.health_plan = ctx.accounts.health_plan.key();
    campaign.policy_series = ctx.accounts.coverage_funding_line.policy_series;
    campaign.coverage_funding_line = ctx.accounts.coverage_funding_line.key();
    campaign.payment_asset_mint = args.payment_asset_mint;
    campaign.coverage_asset_mint = args.coverage_asset_mint;
    campaign.activation_authority = args.activation_authority;
    campaign.campaign_id = args.campaign_id;
    campaign.display_name = args.display_name;
    campaign.metadata_uri = args.metadata_uri;
    campaign.mode = args.mode;
    campaign.status = COMMITMENT_CAMPAIGN_STATUS_ACTIVE;
    campaign.deposit_amount = args.deposit_amount;
    campaign.coverage_amount = args.coverage_amount;
    campaign.hard_cap_amount = args.hard_cap_amount;
    campaign.starts_at_ts = args.starts_at_ts;
    campaign.refund_after_ts = args.refund_after_ts;
    campaign.expires_at_ts = args.expires_at_ts;
    campaign.terms_hash = args.terms_hash;
    campaign.audit_nonce = 0;
    campaign.bump = ctx.bumps.campaign;

    let ledger = &mut ctx.accounts.ledger;
    ledger.campaign = campaign.key();
    ledger.payment_asset_mint = campaign.payment_asset_mint;
    ledger.pending_amount = 0;
    ledger.activated_amount = 0;
    ledger.treasury_locked_amount = 0;
    ledger.refunded_amount = 0;
    ledger.canceled_amount = 0;
    ledger.next_queue_index = 0;
    ledger.bump = ctx.bumps.ledger;

    let payment_rail = &mut ctx.accounts.payment_rail;
    payment_rail.campaign = campaign.key();
    payment_rail.reserve_domain = campaign.reserve_domain;
    payment_rail.payment_asset_mint = campaign.payment_asset_mint;
    payment_rail.coverage_asset_mint = campaign.coverage_asset_mint;
    payment_rail.reserve_asset_rail = ctx.accounts.reserve_asset_rail.key();
    payment_rail.coverage_funding_line = campaign.coverage_funding_line;
    payment_rail.mode = campaign.mode;
    payment_rail.status = COMMITMENT_CAMPAIGN_STATUS_ACTIVE;
    payment_rail.deposit_amount = campaign.deposit_amount;
    payment_rail.coverage_amount = campaign.coverage_amount;
    payment_rail.hard_cap_amount = campaign.hard_cap_amount;
    payment_rail.audit_nonce = 0;
    payment_rail.bump = ctx.bumps.payment_rail;

    emit!(CommitmentCampaignCreatedEvent {
        campaign: campaign.key(),
        health_plan: campaign.health_plan,
        funding_line: campaign.coverage_funding_line,
        payment_asset_mint: campaign.payment_asset_mint,
        coverage_asset_mint: campaign.coverage_asset_mint,
        mode: campaign.mode,
    });
    emit!(CommitmentPaymentRailCreatedEvent {
        campaign: campaign.key(),
        payment_rail: payment_rail.key(),
        payment_asset_mint: payment_rail.payment_asset_mint,
        coverage_asset_mint: payment_rail.coverage_asset_mint,
        reserve_asset_rail: payment_rail.reserve_asset_rail,
        mode: payment_rail.mode,
    });

    Ok(())
}

pub(crate) fn create_commitment_payment_rail(
    ctx: Context<CreateCommitmentPaymentRail>,
    args: CreateCommitmentPaymentRailArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_commitment_mode(args.mode)?;
    require_positive_amount(args.deposit_amount)?;
    require_positive_amount(args.coverage_amount)?;
    require_keys_eq!(
        ctx.accounts.campaign.health_plan,
        ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.campaign.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.payment_domain_asset_vault.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.payment_domain_asset_vault.asset_mint,
        args.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.reserve_asset_rail.reserve_domain,
        ctx.accounts.health_plan.reserve_domain,
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_keys_eq!(
        ctx.accounts.reserve_asset_rail.asset_mint,
        args.payment_asset_mint,
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_reserve_asset_rail_deposit_enabled(&ctx.accounts.reserve_asset_rail)?;
    require_keys_eq!(
        args.reserve_asset_rail,
        ctx.accounts.reserve_asset_rail.key(),
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.health_plan,
        ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.key(),
        args.coverage_funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.asset_mint,
        args.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        ctx.accounts.coverage_funding_line.line_type == FUNDING_LINE_TYPE_PREMIUM_INCOME,
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    if args.mode == COMMITMENT_MODE_TREASURY_CREDIT {
        require_keys_neq!(
            args.payment_asset_mint,
            args.coverage_asset_mint,
            OmegaXProtocolError::TreasuryCreditAssetMismatch
        );
    }

    let payment_rail = &mut ctx.accounts.payment_rail;
    payment_rail.campaign = ctx.accounts.campaign.key();
    payment_rail.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    payment_rail.payment_asset_mint = args.payment_asset_mint;
    payment_rail.coverage_asset_mint = args.coverage_asset_mint;
    payment_rail.reserve_asset_rail = args.reserve_asset_rail;
    payment_rail.coverage_funding_line = args.coverage_funding_line;
    payment_rail.mode = args.mode;
    payment_rail.status = COMMITMENT_CAMPAIGN_STATUS_ACTIVE;
    payment_rail.deposit_amount = args.deposit_amount;
    payment_rail.coverage_amount = args.coverage_amount;
    payment_rail.hard_cap_amount = args.hard_cap_amount;
    payment_rail.audit_nonce = 0;
    payment_rail.bump = ctx.bumps.payment_rail;

    let ledger = &mut ctx.accounts.ledger;
    ledger.campaign = ctx.accounts.campaign.key();
    ledger.payment_asset_mint = payment_rail.payment_asset_mint;
    ledger.pending_amount = 0;
    ledger.activated_amount = 0;
    ledger.treasury_locked_amount = 0;
    ledger.refunded_amount = 0;
    ledger.canceled_amount = 0;
    ledger.next_queue_index = 0;
    ledger.bump = ctx.bumps.ledger;

    emit!(CommitmentPaymentRailCreatedEvent {
        campaign: ctx.accounts.campaign.key(),
        payment_rail: payment_rail.key(),
        payment_asset_mint: payment_rail.payment_asset_mint,
        coverage_asset_mint: payment_rail.coverage_asset_mint,
        reserve_asset_rail: payment_rail.reserve_asset_rail,
        mode: payment_rail.mode,
    });

    Ok(())
}

pub(crate) fn deposit_commitment(
    ctx: Context<DepositCommitment>,
    args: DepositCommitmentArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_commitment_campaign_active(&ctx.accounts.campaign)?;
    require!(
        args.accepted_terms_hash == ctx.accounts.campaign.terms_hash,
        OmegaXProtocolError::CommitmentTermsMismatch
    );
    require_commitment_payment_rail_active(&ctx.accounts.payment_rail)?;
    require_matching_payment_rail(
        ctx.accounts.campaign.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
    )?;
    require_reserve_asset_rail_deposit_enabled(&ctx.accounts.reserve_asset_rail)?;
    require_keys_eq!(
        ctx.accounts.payment_rail.reserve_asset_rail,
        ctx.accounts.reserve_asset_rail.key(),
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_keys_eq!(
        ctx.accounts.ledger.campaign,
        ctx.accounts.campaign.key(),
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        ctx.accounts.ledger.payment_asset_mint,
        ctx.accounts.payment_rail.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.domain_asset_vault.asset_mint,
        ctx.accounts.payment_rail.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.asset_mint.key(),
        ctx.accounts.payment_rail.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        args.beneficiary != ZERO_PUBKEY,
        OmegaXProtocolError::Unauthorized
    );

    let amount = ctx.accounts.payment_rail.deposit_amount;
    transfer_to_domain_vault(
        amount,
        &ctx.accounts.depositor,
        &ctx.accounts.source_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        &ctx.accounts.domain_asset_vault,
    )?;
    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;

    let now_ts = Clock::get()?.unix_timestamp;
    let queue_index = ctx.accounts.ledger.next_queue_index;
    let accepted_amount = accepted_commitment_amount(&ctx.accounts.ledger)?;
    if ctx.accounts.payment_rail.hard_cap_amount > 0 {
        require!(
            checked_add(accepted_amount, amount)? <= ctx.accounts.payment_rail.hard_cap_amount,
            OmegaXProtocolError::CommitmentCapExceeded
        );
    }

    let ledger_key = ctx.accounts.ledger.key();
    let ledger = &mut ctx.accounts.ledger;
    ledger.pending_amount = checked_add(ledger.pending_amount, amount)?;
    ledger.next_queue_index = checked_add(ledger.next_queue_index, 1)?;

    let position = &mut ctx.accounts.position;
    position.campaign = ctx.accounts.campaign.key();
    position.ledger = ledger_key;
    position.depositor = ctx.accounts.depositor.key();
    position.beneficiary = args.beneficiary;
    position.payment_asset_mint = ctx.accounts.payment_rail.payment_asset_mint;
    position.coverage_asset_mint = ctx.accounts.payment_rail.coverage_asset_mint;
    position.amount = amount;
    position.coverage_amount = ctx.accounts.payment_rail.coverage_amount;
    position.queue_index = queue_index;
    position.state = COMMITMENT_POSITION_PENDING;
    position.accepted_terms_hash = args.accepted_terms_hash;
    position.paid_at = now_ts;
    position.activated_at = 0;
    position.refunded_at = 0;
    position.bump = ctx.bumps.position;

    emit!(CommitmentDepositedEvent {
        campaign: ctx.accounts.campaign.key(),
        position: position.key(),
        depositor: position.depositor,
        beneficiary: position.beneficiary,
        amount,
        queue_index,
    });

    Ok(())
}

pub(crate) fn activate_direct_premium_commitment(
    ctx: Context<ActivateDirectPremiumCommitment>,
    _args: ActivateCommitmentArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_commitment_activation_authority(
        &ctx.accounts.activation_authority.key(),
        &ctx.accounts.campaign,
    )?;
    require!(
        ctx.accounts.payment_rail.mode == COMMITMENT_MODE_DIRECT_PREMIUM,
        OmegaXProtocolError::InvalidCommitmentCampaignMode
    );
    require_matching_payment_rail(
        ctx.accounts.campaign.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
    )?;
    require_pending_commitment_position(&ctx.accounts.position)?;
    require_matching_position(
        ctx.accounts.campaign.key(),
        ctx.accounts.ledger.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
        &ctx.accounts.ledger,
        &ctx.accounts.position,
    )?;
    require_matching_coverage_line(
        ctx.accounts.health_plan.key(),
        ctx.accounts.coverage_funding_line.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
        &ctx.accounts.coverage_funding_line,
        &ctx.accounts.coverage_domain_asset_ledger,
        &ctx.accounts.coverage_plan_reserve_ledger,
        &ctx.accounts.coverage_funding_line_ledger,
    )?;
    validate_optional_series_ledger(
        ctx.accounts.coverage_series_reserve_ledger.as_deref(),
        ctx.accounts.coverage_funding_line.policy_series,
        ctx.accounts.coverage_funding_line.asset_mint,
    )?;
    require_keys_eq!(
        ctx.accounts.position.payment_asset_mint,
        ctx.accounts.position.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let amount = ctx.accounts.position.amount;
    let funding_line_key = ctx.accounts.coverage_funding_line.key();
    let funding_line = &mut ctx.accounts.coverage_funding_line;
    funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
    book_inflow_sheet(&mut ctx.accounts.coverage_domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.coverage_plan_reserve_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.coverage_funding_line_ledger.sheet, amount)?;
    if let Some(series_ledger) = ctx.accounts.coverage_series_reserve_ledger.as_deref_mut() {
        book_inflow_sheet(&mut series_ledger.sheet, amount)?;
    }

    activate_commitment_position(
        &mut ctx.accounts.ledger,
        &mut ctx.accounts.position,
        COMMITMENT_POSITION_DIRECT_PREMIUM_ACTIVATED,
        amount,
    )?;

    emit!(FundingFlowRecordedEvent {
        funding_line: funding_line_key,
        amount,
        flow_kind: FundingFlowKind::PremiumRecorded as u8,
    });
    emit!(CommitmentActivatedEvent {
        campaign: ctx.accounts.campaign.key(),
        position: ctx.accounts.position.key(),
        beneficiary: ctx.accounts.position.beneficiary,
        payment_amount: amount,
        coverage_amount: ctx.accounts.position.coverage_amount,
        mode: ctx.accounts.payment_rail.mode,
    });

    Ok(())
}

pub(crate) fn activate_treasury_credit_commitment(
    ctx: Context<ActivateTreasuryCreditCommitment>,
    _args: ActivateCommitmentArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_commitment_activation_authority(
        &ctx.accounts.activation_authority.key(),
        &ctx.accounts.campaign,
    )?;
    require!(
        ctx.accounts.payment_rail.mode == COMMITMENT_MODE_TREASURY_CREDIT,
        OmegaXProtocolError::InvalidCommitmentCampaignMode
    );
    require_keys_neq!(
        ctx.accounts.payment_rail.payment_asset_mint,
        ctx.accounts.payment_rail.coverage_asset_mint,
        OmegaXProtocolError::TreasuryCreditAssetMismatch
    );
    require_matching_payment_rail(
        ctx.accounts.campaign.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
    )?;
    require_pending_commitment_position(&ctx.accounts.position)?;
    require_matching_position(
        ctx.accounts.campaign.key(),
        ctx.accounts.ledger.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
        &ctx.accounts.ledger,
        &ctx.accounts.position,
    )?;
    require_matching_coverage_line(
        ctx.accounts.health_plan.key(),
        ctx.accounts.coverage_funding_line.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
        &ctx.accounts.coverage_funding_line,
        &ctx.accounts.coverage_domain_asset_ledger,
        &ctx.accounts.coverage_plan_reserve_ledger,
        &ctx.accounts.coverage_funding_line_ledger,
    )?;
    validate_optional_series_ledger(
        ctx.accounts.coverage_series_reserve_ledger.as_deref(),
        ctx.accounts.coverage_funding_line.policy_series,
        ctx.accounts.coverage_funding_line.asset_mint,
    )?;

    let amount = ctx.accounts.position.amount;
    let coverage_amount = ctx.accounts.position.coverage_amount;
    book_restricted_sheet(
        &mut ctx.accounts.coverage_domain_asset_ledger.sheet,
        coverage_amount,
    )?;
    book_restricted_sheet(
        &mut ctx.accounts.coverage_plan_reserve_ledger.sheet,
        coverage_amount,
    )?;
    book_restricted_sheet(
        &mut ctx.accounts.coverage_funding_line_ledger.sheet,
        coverage_amount,
    )?;
    if let Some(series_ledger) = ctx.accounts.coverage_series_reserve_ledger.as_deref_mut() {
        book_restricted_sheet(&mut series_ledger.sheet, coverage_amount)?;
    }

    activate_commitment_position(
        &mut ctx.accounts.ledger,
        &mut ctx.accounts.position,
        COMMITMENT_POSITION_TREASURY_LOCKED,
        amount,
    )?;

    emit!(CommitmentActivatedEvent {
        campaign: ctx.accounts.campaign.key(),
        position: ctx.accounts.position.key(),
        beneficiary: ctx.accounts.position.beneficiary,
        payment_amount: amount,
        coverage_amount,
        mode: ctx.accounts.payment_rail.mode,
    });

    Ok(())
}

pub(crate) fn activate_waterfall_commitment(
    ctx: Context<ActivateWaterfallCommitment>,
    _args: ActivateCommitmentArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_commitment_activation_authority(
        &ctx.accounts.activation_authority.key(),
        &ctx.accounts.campaign,
    )?;
    require_matching_payment_rail(
        ctx.accounts.campaign.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
    )?;
    require!(
        ctx.accounts.payment_rail.mode == COMMITMENT_MODE_WATERFALL_RESERVE
            || ctx.accounts.payment_rail.mode == COMMITMENT_MODE_DIRECT_PREMIUM,
        OmegaXProtocolError::InvalidCommitmentCampaignMode
    );
    require_pending_commitment_position(&ctx.accounts.position)?;
    require_matching_position(
        ctx.accounts.campaign.key(),
        ctx.accounts.ledger.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
        &ctx.accounts.ledger,
        &ctx.accounts.position,
    )?;
    require_keys_eq!(
        ctx.accounts.reserve_asset_rail.key(),
        ctx.accounts.payment_rail.reserve_asset_rail,
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_keys_eq!(
        ctx.accounts.reserve_asset_rail.asset_mint,
        ctx.accounts.position.payment_asset_mint,
        OmegaXProtocolError::ReserveAssetRailMismatch
    );
    require_reserve_asset_rail_capacity_enabled(&ctx.accounts.reserve_asset_rail)?;
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.key(),
        ctx.accounts.payment_rail.coverage_funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.asset_mint,
        ctx.accounts.position.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line.key(),
        ctx.accounts.coverage_funding_line_ledger.funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_domain_asset_ledger.asset_mint,
        ctx.accounts.position.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_plan_reserve_ledger.asset_mint,
        ctx.accounts.position.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_funding_line_ledger.asset_mint,
        ctx.accounts.position.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    validate_optional_series_ledger(
        ctx.accounts.coverage_series_reserve_ledger.as_deref(),
        ctx.accounts.coverage_funding_line.policy_series,
        ctx.accounts.position.payment_asset_mint,
    )?;

    let amount = ctx.accounts.position.amount;
    let funding_line_key = ctx.accounts.coverage_funding_line.key();
    let funding_line = &mut ctx.accounts.coverage_funding_line;
    funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
    book_inflow_sheet(&mut ctx.accounts.coverage_domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.coverage_plan_reserve_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.coverage_funding_line_ledger.sheet, amount)?;
    if let Some(series_ledger) = ctx.accounts.coverage_series_reserve_ledger.as_deref_mut() {
        book_inflow_sheet(&mut series_ledger.sheet, amount)?;
    }

    activate_commitment_position(
        &mut ctx.accounts.ledger,
        &mut ctx.accounts.position,
        COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED,
        amount,
    )?;

    emit!(FundingFlowRecordedEvent {
        funding_line: funding_line_key,
        amount,
        flow_kind: FundingFlowKind::PremiumRecorded as u8,
    });
    emit!(CommitmentActivatedEvent {
        campaign: ctx.accounts.campaign.key(),
        position: ctx.accounts.position.key(),
        beneficiary: ctx.accounts.position.beneficiary,
        payment_amount: amount,
        coverage_amount: ctx.accounts.position.coverage_amount,
        mode: ctx.accounts.payment_rail.mode,
    });

    Ok(())
}

pub(crate) fn refund_commitment(
    ctx: Context<RefundCommitment>,
    args: RefundCommitmentArgs,
) -> Result<()> {
    let _reason_hash = args.refund_reason_hash;
    require_pending_commitment_position(&ctx.accounts.position)?;
    require_matching_payment_rail(
        ctx.accounts.campaign.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
    )?;
    require_matching_position(
        ctx.accounts.campaign.key(),
        ctx.accounts.ledger.key(),
        &ctx.accounts.campaign,
        &ctx.accounts.payment_rail,
        &ctx.accounts.ledger,
        &ctx.accounts.position,
    )?;
    require_refund_allowed(&ctx.accounts.campaign)?;
    require_keys_eq!(
        ctx.accounts.depositor.key(),
        ctx.accounts.position.depositor,
        OmegaXProtocolError::Unauthorized
    );
    require_keys_eq!(
        ctx.accounts.recipient_token_account.owner,
        ctx.accounts.position.depositor,
        OmegaXProtocolError::TokenAccountOwnerMismatch
    );
    require_keys_eq!(
        ctx.accounts.asset_mint.key(),
        ctx.accounts.position.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ctx.accounts.domain_asset_vault.asset_mint,
        ctx.accounts.position.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let amount = ctx.accounts.position.amount;
    transfer_from_domain_vault(
        amount,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;
    ctx.accounts.domain_asset_vault.total_assets =
        checked_sub(ctx.accounts.domain_asset_vault.total_assets, amount)?;

    let ledger = &mut ctx.accounts.ledger;
    ledger.pending_amount = checked_sub(ledger.pending_amount, amount)?;
    ledger.refunded_amount = checked_add(ledger.refunded_amount, amount)?;

    let now_ts = Clock::get()?.unix_timestamp;
    let position = &mut ctx.accounts.position;
    position.state = COMMITMENT_POSITION_REFUNDED;
    position.refunded_at = now_ts;

    emit!(CommitmentRefundedEvent {
        campaign: ctx.accounts.campaign.key(),
        position: position.key(),
        depositor: position.depositor,
        amount,
    });

    Ok(())
}

pub(crate) fn pause_commitment_campaign(
    ctx: Context<PauseCommitmentCampaign>,
    args: PauseCommitmentCampaignArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_valid_commitment_status(args.status)?;
    require_keys_eq!(
        ctx.accounts.campaign.health_plan,
        ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );

    let campaign = &mut ctx.accounts.campaign;
    campaign.status = args.status;
    campaign.audit_nonce = campaign.audit_nonce.saturating_add(1);

    emit!(CommitmentCampaignStatusChangedEvent {
        campaign: campaign.key(),
        status: campaign.status,
        authority: ctx.accounts.authority.key(),
        reason_hash: args.reason_hash,
    });

    Ok(())
}

fn require_commitment_mode(mode: u8) -> Result<()> {
    match mode {
        COMMITMENT_MODE_DIRECT_PREMIUM
        | COMMITMENT_MODE_TREASURY_CREDIT
        | COMMITMENT_MODE_WATERFALL_RESERVE => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidCommitmentCampaignMode),
    }
}

fn require_valid_commitment_status(status: u8) -> Result<()> {
    match status {
        COMMITMENT_CAMPAIGN_STATUS_DRAFT
        | COMMITMENT_CAMPAIGN_STATUS_ACTIVE
        | COMMITMENT_CAMPAIGN_STATUS_PAUSED
        | COMMITMENT_CAMPAIGN_STATUS_CANCELED
        | COMMITMENT_CAMPAIGN_STATUS_CLOSED => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidCommitmentCampaignStatus),
    }
}

fn require_commitment_campaign_active(campaign: &CommitmentCampaign) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;
    require!(
        campaign.status == COMMITMENT_CAMPAIGN_STATUS_ACTIVE,
        OmegaXProtocolError::CommitmentCampaignInactive
    );
    require!(
        campaign.starts_at_ts <= now_ts
            && (campaign.expires_at_ts == 0 || now_ts <= campaign.expires_at_ts),
        OmegaXProtocolError::CommitmentCampaignInactive
    );
    Ok(())
}

fn require_refund_allowed(campaign: &CommitmentCampaign) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;
    require!(
        campaign.status == COMMITMENT_CAMPAIGN_STATUS_CANCELED
            || (campaign.refund_after_ts > 0 && now_ts >= campaign.refund_after_ts),
        OmegaXProtocolError::CommitmentNotRefundable
    );
    Ok(())
}

fn require_commitment_activation_authority(
    authority: &Pubkey,
    campaign: &CommitmentCampaign,
) -> Result<()> {
    require_keys_eq!(
        *authority,
        campaign.activation_authority,
        OmegaXProtocolError::CommitmentActivationAuthorityMismatch
    );
    Ok(())
}

pub(crate) fn require_pending_commitment_position(position: &CommitmentPosition) -> Result<()> {
    require!(
        position.state == COMMITMENT_POSITION_PENDING,
        OmegaXProtocolError::CommitmentPositionNotPending
    );
    Ok(())
}

fn require_commitment_payment_rail_active(rail: &CommitmentPaymentRail) -> Result<()> {
    require!(
        rail.status == COMMITMENT_CAMPAIGN_STATUS_ACTIVE,
        OmegaXProtocolError::CommitmentPaymentRailInactive
    );
    Ok(())
}

fn require_matching_payment_rail(
    campaign_key: Pubkey,
    campaign: &CommitmentCampaign,
    payment_rail: &CommitmentPaymentRail,
) -> Result<()> {
    require_keys_eq!(
        payment_rail.campaign,
        campaign_key,
        OmegaXProtocolError::CommitmentPaymentRailMismatch
    );
    require_keys_eq!(
        payment_rail.reserve_domain,
        campaign.reserve_domain,
        OmegaXProtocolError::HealthPlanMismatch
    );
    Ok(())
}

fn require_matching_position(
    campaign_key: Pubkey,
    ledger_key: Pubkey,
    _campaign: &CommitmentCampaign,
    payment_rail: &CommitmentPaymentRail,
    ledger: &CommitmentLedger,
    position: &CommitmentPosition,
) -> Result<()> {
    require_keys_eq!(
        ledger.campaign,
        campaign_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        position.campaign,
        campaign_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        position.ledger,
        ledger_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        position.payment_asset_mint,
        payment_rail.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        position.coverage_asset_mint,
        payment_rail.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        ledger.payment_asset_mint,
        payment_rail.payment_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    Ok(())
}

fn require_matching_coverage_line(
    health_plan_key: Pubkey,
    funding_line_key: Pubkey,
    campaign: &CommitmentCampaign,
    payment_rail: &CommitmentPaymentRail,
    funding_line: &FundingLine,
    domain_ledger: &DomainAssetLedger,
    plan_ledger: &PlanReserveLedger,
    funding_line_ledger: &FundingLineLedger,
) -> Result<()> {
    require_keys_eq!(
        campaign.health_plan,
        health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        payment_rail.coverage_funding_line,
        funding_line_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        funding_line.health_plan,
        health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        funding_line.asset_mint,
        payment_rail.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        funding_line.line_type == FUNDING_LINE_TYPE_PREMIUM_INCOME,
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    require_keys_eq!(
        domain_ledger.reserve_domain,
        campaign.reserve_domain,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        domain_ledger.asset_mint,
        payment_rail.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        plan_ledger.health_plan,
        health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_keys_eq!(
        plan_ledger.asset_mint,
        payment_rail.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        funding_line_ledger.funding_line,
        funding_line_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        funding_line_ledger.asset_mint,
        payment_rail.coverage_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    Ok(())
}

pub(crate) fn accepted_commitment_amount(ledger: &CommitmentLedger) -> Result<u64> {
    checked_add(
        checked_add(ledger.pending_amount, ledger.activated_amount)?,
        ledger.treasury_locked_amount,
    )
}

pub(crate) fn activate_commitment_position(
    ledger: &mut CommitmentLedger,
    position: &mut CommitmentPosition,
    state: u8,
    amount: u64,
) -> Result<()> {
    let now_ts = Clock::get()?.unix_timestamp;
    activate_commitment_position_at(ledger, position, state, amount, now_ts)
}

pub(crate) fn activate_commitment_position_at(
    ledger: &mut CommitmentLedger,
    position: &mut CommitmentPosition,
    state: u8,
    amount: u64,
    now_ts: i64,
) -> Result<()> {
    ledger.pending_amount = checked_sub(ledger.pending_amount, amount)?;
    match state {
        COMMITMENT_POSITION_DIRECT_PREMIUM_ACTIVATED => {
            ledger.activated_amount = checked_add(ledger.activated_amount, amount)?;
        }
        COMMITMENT_POSITION_TREASURY_LOCKED => {
            ledger.treasury_locked_amount = checked_add(ledger.treasury_locked_amount, amount)?;
        }
        COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED => {
            ledger.activated_amount = checked_add(ledger.activated_amount, amount)?;
        }
        _ => return err!(OmegaXProtocolError::InvalidCommitmentCampaignStatus),
    }
    position.state = state;
    position.activated_at = now_ts;
    Ok(())
}

#[derive(Accounts)]
#[instruction(args: CreateCommitmentCampaignArgs)]
pub struct CreateCommitmentCampaign<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), args.payment_asset_mint.as_ref()], bump = payment_domain_asset_vault.bump)]
    pub payment_domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(seeds = [SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), args.payment_asset_mint.as_ref()], bump = reserve_asset_rail.bump)]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.coverage_asset_mint.as_ref()], bump = coverage_domain_asset_ledger.bump)]
    pub coverage_domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), coverage_funding_line.line_id.as_bytes()], bump = coverage_funding_line.bump)]
    pub coverage_funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, coverage_funding_line.key().as_ref(), args.coverage_asset_mint.as_ref()], bump = coverage_funding_line_ledger.bump)]
    pub coverage_funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.coverage_asset_mint.as_ref()], bump = coverage_plan_reserve_ledger.bump)]
    pub coverage_plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(
        init,
        payer = authority,
        space = 8 + CommitmentCampaign::INIT_SPACE,
        seeds = [SEED_COMMITMENT_CAMPAIGN, health_plan.key().as_ref(), args.campaign_id.as_bytes()],
        bump
    )]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
    #[account(
        init,
        payer = authority,
        space = 8 + CommitmentPaymentRail::INIT_SPACE,
        seeds = [SEED_COMMITMENT_PAYMENT_RAIL, campaign.key().as_ref(), args.payment_asset_mint.as_ref()],
        bump
    )]
    pub payment_rail: Box<Account<'info, CommitmentPaymentRail>>,
    #[account(
        init,
        payer = authority,
        space = 8 + CommitmentLedger::INIT_SPACE,
        seeds = [SEED_COMMITMENT_LEDGER, campaign.key().as_ref(), args.payment_asset_mint.as_ref()],
        bump
    )]
    pub ledger: Box<Account<'info, CommitmentLedger>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: CreateCommitmentPaymentRailArgs)]
pub struct CreateCommitmentPaymentRail<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_COMMITMENT_CAMPAIGN, health_plan.key().as_ref(), campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), args.payment_asset_mint.as_ref()], bump = payment_domain_asset_vault.bump)]
    pub payment_domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(seeds = [SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), args.payment_asset_mint.as_ref()], bump = reserve_asset_rail.bump)]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[account(seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), coverage_funding_line.line_id.as_bytes()], bump = coverage_funding_line.bump)]
    pub coverage_funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + CommitmentPaymentRail::INIT_SPACE,
        seeds = [SEED_COMMITMENT_PAYMENT_RAIL, campaign.key().as_ref(), args.payment_asset_mint.as_ref()],
        bump
    )]
    pub payment_rail: Box<Account<'info, CommitmentPaymentRail>>,
    #[account(
        init,
        payer = authority,
        space = 8 + CommitmentLedger::INIT_SPACE,
        seeds = [SEED_COMMITMENT_LEDGER, campaign.key().as_ref(), args.payment_asset_mint.as_ref()],
        bump
    )]
    pub ledger: Box<Account<'info, CommitmentLedger>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: DepositCommitmentArgs)]
pub struct DepositCommitment<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_COMMITMENT_CAMPAIGN, campaign.health_plan.as_ref(), campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
    #[account(seeds = [SEED_COMMITMENT_PAYMENT_RAIL, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = payment_rail.bump)]
    pub payment_rail: Box<Account<'info, CommitmentPaymentRail>>,
    #[account(seeds = [SEED_RESERVE_ASSET_RAIL, campaign.reserve_domain.as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = reserve_asset_rail.bump)]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[account(mut, seeds = [SEED_COMMITMENT_LEDGER, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = ledger.bump)]
    pub ledger: Box<Account<'info, CommitmentLedger>>,
    #[account(
        init,
        payer = depositor,
        space = 8 + CommitmentPosition::INIT_SPACE,
        seeds = [SEED_COMMITMENT_POSITION, campaign.key().as_ref(), depositor.key().as_ref(), args.beneficiary.as_ref()],
        bump
    )]
    pub position: Box<Account<'info, CommitmentPosition>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, campaign.reserve_domain.as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ActivateDirectPremiumCommitment<'info> {
    pub activation_authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_COMMITMENT_CAMPAIGN, health_plan.key().as_ref(), campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
    #[account(seeds = [SEED_COMMITMENT_PAYMENT_RAIL, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = payment_rail.bump)]
    pub payment_rail: Box<Account<'info, CommitmentPaymentRail>>,
    #[account(mut, seeds = [SEED_COMMITMENT_LEDGER, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = ledger.bump)]
    pub ledger: Box<Account<'info, CommitmentLedger>>,
    #[account(mut, seeds = [SEED_COMMITMENT_POSITION, campaign.key().as_ref(), position.depositor.as_ref(), position.beneficiary.as_ref()], bump = position.bump)]
    pub position: Box<Account<'info, CommitmentPosition>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), payment_rail.coverage_asset_mint.as_ref()], bump = coverage_domain_asset_ledger.bump)]
    pub coverage_domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), coverage_funding_line.line_id.as_bytes()], bump = coverage_funding_line.bump)]
    pub coverage_funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, coverage_funding_line.key().as_ref(), payment_rail.coverage_asset_mint.as_ref()], bump = coverage_funding_line_ledger.bump)]
    pub coverage_funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), payment_rail.coverage_asset_mint.as_ref()], bump = coverage_plan_reserve_ledger.bump)]
    pub coverage_plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub coverage_series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
}

#[derive(Accounts)]
pub struct ActivateTreasuryCreditCommitment<'info> {
    pub activation_authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_COMMITMENT_CAMPAIGN, health_plan.key().as_ref(), campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
    #[account(seeds = [SEED_COMMITMENT_PAYMENT_RAIL, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = payment_rail.bump)]
    pub payment_rail: Box<Account<'info, CommitmentPaymentRail>>,
    #[account(mut, seeds = [SEED_COMMITMENT_LEDGER, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = ledger.bump)]
    pub ledger: Box<Account<'info, CommitmentLedger>>,
    #[account(mut, seeds = [SEED_COMMITMENT_POSITION, campaign.key().as_ref(), position.depositor.as_ref(), position.beneficiary.as_ref()], bump = position.bump)]
    pub position: Box<Account<'info, CommitmentPosition>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), payment_rail.coverage_asset_mint.as_ref()], bump = coverage_domain_asset_ledger.bump)]
    pub coverage_domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), coverage_funding_line.line_id.as_bytes()], bump = coverage_funding_line.bump)]
    pub coverage_funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, coverage_funding_line.key().as_ref(), payment_rail.coverage_asset_mint.as_ref()], bump = coverage_funding_line_ledger.bump)]
    pub coverage_funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), payment_rail.coverage_asset_mint.as_ref()], bump = coverage_plan_reserve_ledger.bump)]
    pub coverage_plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub coverage_series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
}

#[derive(Accounts)]
pub struct ActivateWaterfallCommitment<'info> {
    pub activation_authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_COMMITMENT_CAMPAIGN, health_plan.key().as_ref(), campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
    #[account(seeds = [SEED_COMMITMENT_PAYMENT_RAIL, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = payment_rail.bump)]
    pub payment_rail: Box<Account<'info, CommitmentPaymentRail>>,
    #[account(seeds = [SEED_RESERVE_ASSET_RAIL, health_plan.reserve_domain.as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = reserve_asset_rail.bump)]
    pub reserve_asset_rail: Box<Account<'info, ReserveAssetRail>>,
    #[account(mut, seeds = [SEED_COMMITMENT_LEDGER, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = ledger.bump)]
    pub ledger: Box<Account<'info, CommitmentLedger>>,
    #[account(mut, seeds = [SEED_COMMITMENT_POSITION, campaign.key().as_ref(), position.depositor.as_ref(), position.beneficiary.as_ref()], bump = position.bump)]
    pub position: Box<Account<'info, CommitmentPosition>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = coverage_domain_asset_ledger.bump)]
    pub coverage_domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), coverage_funding_line.line_id.as_bytes()], bump = coverage_funding_line.bump)]
    pub coverage_funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, coverage_funding_line.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = coverage_funding_line_ledger.bump)]
    pub coverage_funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = coverage_plan_reserve_ledger.bump)]
    pub coverage_plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub coverage_series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
}

#[derive(Accounts)]
pub struct RefundCommitment<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(mut, seeds = [SEED_COMMITMENT_CAMPAIGN, campaign.health_plan.as_ref(), campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
    #[account(seeds = [SEED_COMMITMENT_PAYMENT_RAIL, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = payment_rail.bump)]
    pub payment_rail: Box<Account<'info, CommitmentPaymentRail>>,
    #[account(mut, seeds = [SEED_COMMITMENT_LEDGER, campaign.key().as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = ledger.bump)]
    pub ledger: Box<Account<'info, CommitmentLedger>>,
    #[account(mut, seeds = [SEED_COMMITMENT_POSITION, campaign.key().as_ref(), position.depositor.as_ref(), position.beneficiary.as_ref()], bump = position.bump)]
    pub position: Box<Account<'info, CommitmentPosition>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, campaign.reserve_domain.as_ref(), payment_rail.payment_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct PauseCommitmentCampaign<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_COMMITMENT_CAMPAIGN, health_plan.key().as_ref(), campaign.campaign_id.as_bytes()], bump = campaign.bump)]
    pub campaign: Box<Account<'info, CommitmentCampaign>>,
}
