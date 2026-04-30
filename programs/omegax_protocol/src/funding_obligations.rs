// SPDX-License-Identifier: AGPL-3.0-or-later

//! Funding-line, obligation, reserve, and obligation-settlement instruction handlers and account validation contexts.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
use crate::types::*;

pub(crate) fn open_funding_line(
    ctx: Context<OpenFundingLine>,
    args: OpenFundingLineArgs,
) -> Result<()> {
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_id(&args.line_id)?;
    require!(
        ctx.accounts.domain_asset_vault.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        ctx.accounts.domain_asset_ledger.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let funding_line = &mut ctx.accounts.funding_line;
    funding_line.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    funding_line.health_plan = ctx.accounts.health_plan.key();
    funding_line.policy_series = args.policy_series;
    funding_line.asset_mint = args.asset_mint;
    funding_line.line_id = args.line_id;
    funding_line.line_type = args.line_type;
    funding_line.funding_priority = args.funding_priority;
    funding_line.committed_amount = args.committed_amount;
    funding_line.funded_amount = 0;
    funding_line.reserved_amount = 0;
    funding_line.spent_amount = 0;
    funding_line.released_amount = 0;
    funding_line.returned_amount = 0;
    funding_line.status = FUNDING_LINE_STATUS_OPEN;
    funding_line.caps_hash = args.caps_hash;
    funding_line.bump = ctx.bumps.funding_line;

    let funding_line_ledger = &mut ctx.accounts.funding_line_ledger;
    funding_line_ledger.funding_line = funding_line.key();
    funding_line_ledger.asset_mint = args.asset_mint;
    funding_line_ledger.sheet = ReserveBalanceSheet::default();
    funding_line_ledger.bump = ctx.bumps.funding_line_ledger;

    let plan_ledger = &mut ctx.accounts.plan_reserve_ledger;
    if plan_ledger.health_plan == ZERO_PUBKEY {
        plan_ledger.health_plan = ctx.accounts.health_plan.key();
        plan_ledger.asset_mint = args.asset_mint;
        plan_ledger.sheet = ReserveBalanceSheet::default();
        plan_ledger.bump = ctx.bumps.plan_reserve_ledger;
    }

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        require!(
            args.policy_series != ZERO_PUBKEY,
            OmegaXProtocolError::SeriesLedgerUnexpected
        );
        require!(
            series_ledger.policy_series == args.policy_series,
            OmegaXProtocolError::PolicySeriesMismatch
        );
        require!(
            series_ledger.asset_mint == args.asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
    }

    emit!(FundingLineOpenedEvent {
        health_plan: funding_line.health_plan,
        funding_line: funding_line.key(),
        asset_mint: funding_line.asset_mint,
        line_type: funding_line.line_type,
    });

    Ok(())
}

pub(crate) fn fund_sponsor_budget(
    ctx: Context<FundSponsorBudget>,
    args: FundSponsorBudgetArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_positive_amount(args.amount)?;
    require!(
        ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_SPONSOR_BUDGET,
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    transfer_to_domain_vault(
        args.amount,
        &ctx.accounts.authority,
        &ctx.accounts.source_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        &ctx.accounts.domain_asset_vault,
    )?;
    validate_optional_series_ledger(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.funding_line.policy_series,
        ctx.accounts.funding_line.asset_mint,
    )?;

    let amount = args.amount;
    let funding_line = &mut ctx.accounts.funding_line;
    funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
    book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_inflow_sheet(&mut series_ledger.sheet, amount)?;
    }

    emit!(FundingFlowRecordedEvent {
        funding_line: funding_line.key(),
        amount,
        flow_kind: FundingFlowKind::SponsorBudgetFunded as u8,
    });

    Ok(())
}

pub(crate) fn record_premium_payment(
    ctx: Context<RecordPremiumPayment>,
    args: RecordPremiumPaymentArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_positive_amount(args.amount)?;
    require!(
        ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_PREMIUM_INCOME,
        OmegaXProtocolError::FundingLineTypeMismatch
    );
    transfer_to_domain_vault(
        args.amount,
        &ctx.accounts.authority,
        &ctx.accounts.source_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.token_program,
        &ctx.accounts.domain_asset_vault,
    )?;
    validate_optional_series_ledger(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.funding_line.policy_series,
        ctx.accounts.funding_line.asset_mint,
    )?;

    let amount = args.amount;
    // Capture immutable values needed after the mutable borrow on funding_line
    // and during the protocol_fee_vault accrual block below.
    let funding_line_key = ctx.accounts.funding_line.key();
    let funding_line_asset_mint = ctx.accounts.funding_line.asset_mint;
    let health_plan_reserve_domain = ctx.accounts.health_plan.reserve_domain;
    let protocol_fee_bps = ctx.accounts.protocol_governance.protocol_fee_bps;

    let funding_line = &mut ctx.accounts.funding_line;
    funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
    book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
    book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
    book_inflow_sheet(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_inflow_sheet(&mut series_ledger.sheet, amount)?;
    }

    // Phase 1.6 — Protocol fee accrual on premium income.
    // The full premium amount is booked into the vault; the fee is an
    // internal claim that decrements `accrued_fees - withdrawn_fees`
    // headroom. No user-facing payout reduction here (premiums are not
    // refundable).
    let vault = &mut ctx.accounts.protocol_fee_vault;
    require_keys_eq!(
        vault.reserve_domain,
        health_plan_reserve_domain,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require_keys_eq!(
        vault.asset_mint,
        funding_line_asset_mint,
        OmegaXProtocolError::FeeVaultMismatch
    );
    let fee = fee_share_from_bps(amount, protocol_fee_bps)?;
    if fee > 0 {
        let vault_key = vault.key();
        let vault_mint = vault.asset_mint;
        let accrued_total = accrue_fee(&mut vault.accrued_fees, fee)?;
        emit!(FeeAccruedEvent {
            vault: vault_key,
            asset_mint: vault_mint,
            amount: fee,
            accrued_total,
        });
    }

    emit!(FundingFlowRecordedEvent {
        funding_line: funding_line_key,
        amount,
        flow_kind: FundingFlowKind::PremiumRecorded as u8,
    });

    Ok(())
}

pub(crate) fn create_obligation(
    ctx: Context<CreateObligation>,
    args: CreateObligationArgs,
) -> Result<()> {
    require_id(&args.obligation_id)?;
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require!(
        ctx.accounts.funding_line.health_plan == ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        ctx.accounts.funding_line.asset_mint == args.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_positive_amount(args.amount)?;
    validate_optional_series_ledger(
        ctx.accounts.series_reserve_ledger.as_deref(),
        args.policy_series,
        args.asset_mint,
    )?;
    validate_optional_pool_class_ledger(
        ctx.accounts.pool_class_ledger.as_deref(),
        args.capital_class,
        args.asset_mint,
    )?;
    validate_optional_allocation_ledger(
        ctx.accounts.allocation_ledger.as_deref(),
        args.allocation_position,
        args.asset_mint,
    )?;

    let obligation = &mut ctx.accounts.obligation;
    obligation.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    obligation.asset_mint = args.asset_mint;
    obligation.health_plan = ctx.accounts.health_plan.key();
    obligation.policy_series = args.policy_series;
    obligation.member_wallet = args.member_wallet;
    obligation.beneficiary = args.beneficiary;
    obligation.funding_line = ctx.accounts.funding_line.key();
    obligation.claim_case = args.claim_case;
    obligation.liquidity_pool = args.liquidity_pool;
    obligation.capital_class = args.capital_class;
    obligation.allocation_position = args.allocation_position;
    obligation.obligation_id = args.obligation_id;
    obligation.creation_reason_hash = args.creation_reason_hash;
    obligation.settlement_reason_hash = [0u8; 32];
    obligation.status = OBLIGATION_STATUS_PROPOSED;
    obligation.delivery_mode = args.delivery_mode;
    obligation.principal_amount = args.amount;
    obligation.outstanding_amount = args.amount;
    obligation.reserved_amount = 0;
    obligation.claimable_amount = 0;
    obligation.payable_amount = 0;
    obligation.settled_amount = 0;
    obligation.impaired_amount = 0;
    obligation.recovered_amount = 0;
    obligation.created_at = Clock::get()?.unix_timestamp;
    obligation.updated_at = obligation.created_at;
    obligation.bump = ctx.bumps.obligation;

    book_owed(&mut ctx.accounts.domain_asset_ledger.sheet, args.amount)?;
    book_owed(&mut ctx.accounts.plan_reserve_ledger.sheet, args.amount)?;
    book_owed(&mut ctx.accounts.funding_line_ledger.sheet, args.amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_owed(&mut series_ledger.sheet, args.amount)?;
    }

    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
        book_owed(&mut pool_class_ledger.sheet, args.amount)?;
    }

    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
        book_owed(&mut allocation_ledger.sheet, args.amount)?;
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount: obligation.principal_amount,
    });

    Ok(())
}

pub(crate) fn reserve_obligation(
    ctx: Context<ReserveObligation>,
    args: ReserveObligationArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let reserve_amount = args.amount;
    require_positive_amount(reserve_amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_reserve_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        obligation.status == OBLIGATION_STATUS_PROPOSED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        reserve_amount <= obligation.outstanding_amount,
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    validate_treasury_mutation_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    obligation.status = OBLIGATION_STATUS_RESERVED;
    obligation.reserved_amount = reserve_amount;
    obligation.updated_at = now_ts;

    ctx.accounts.funding_line.reserved_amount =
        checked_add(ctx.accounts.funding_line.reserved_amount, reserve_amount)?;
    book_reserve(&mut ctx.accounts.domain_asset_ledger.sheet, reserve_amount)?;
    book_reserve(&mut ctx.accounts.plan_reserve_ledger.sheet, reserve_amount)?;
    book_reserve(&mut ctx.accounts.funding_line_ledger.sheet, reserve_amount)?;

    if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
        book_reserve(&mut series_ledger.sheet, reserve_amount)?;
    }

    if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
        book_reserve(&mut pool_class_ledger.sheet, reserve_amount)?;
    }

    if let Some(allocation_position) = ctx.accounts.allocation_position.as_deref_mut() {
        allocation_position.reserved_capacity =
            checked_add(allocation_position.reserved_capacity, reserve_amount)?;
        allocation_position.utilized_amount =
            checked_add(allocation_position.utilized_amount, reserve_amount)?;
    }

    if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
        book_reserve(&mut allocation_ledger.sheet, reserve_amount)?;
    }

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        let claim_case_key = claim_case.key();
        sync_linked_claim_case_reserve(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            ctx.accounts.health_plan.key(),
            now_ts,
        )?;
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount: reserve_amount,
    });

    Ok(())
}

pub(crate) fn settle_obligation(
    ctx: Context<SettleObligation>,
    args: SettleObligationArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let amount = args.amount;
    require_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_settlement_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        amount <= obligation.outstanding_amount,
        OmegaXProtocolError::AmountExceedsOutstandingObligation
    );
    validate_treasury_mutation_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref() {
        require_matching_linked_claim_case(
            claim_case,
            claim_case.key(),
            obligation,
            obligation.key(),
            ctx.accounts.health_plan.key(),
        )?;
        if args.next_status == OBLIGATION_STATUS_SETTLED {
            require!(
                amount <= remaining_claim_amount(claim_case),
                OmegaXProtocolError::AmountExceedsApprovedClaim
            );
            require!(
                ctx.accounts.member_position.is_some()
                    && ctx.accounts.asset_mint.is_some()
                    && ctx.accounts.vault_token_account.is_some()
                    && ctx.accounts.recipient_token_account.is_some()
                    && ctx.accounts.token_program.is_some(),
                OmegaXProtocolError::SettlementOutflowAccountsRequired
            );
        }
    }

    match args.next_status {
        OBLIGATION_STATUS_CLAIMABLE_PAYABLE => {
            require!(
                obligation.status == OBLIGATION_STATUS_RESERVED,
                OmegaXProtocolError::InvalidObligationStateTransition
            );
            require!(
                amount <= obligation.reserved_amount,
                OmegaXProtocolError::AmountExceedsReservedBalance
            );
            release_reserved_to_delivery(
                &mut ctx.accounts.domain_asset_ledger.sheet,
                &mut ctx.accounts.plan_reserve_ledger.sheet,
                &mut ctx.accounts.funding_line_ledger.sheet,
                ctx.accounts.series_reserve_ledger.as_deref_mut(),
                ctx.accounts.pool_class_ledger.as_deref_mut(),
                ctx.accounts.allocation_ledger.as_deref_mut(),
                obligation.delivery_mode,
                amount,
            )?;
            obligation.status = OBLIGATION_STATUS_CLAIMABLE_PAYABLE;
            obligation.claimable_amount =
                if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
                    amount
                } else {
                    0
                };
            obligation.payable_amount =
                if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_PAYABLE {
                    amount
                } else {
                    0
                };
            obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
        }
        OBLIGATION_STATUS_SETTLED => {
            require!(
                obligation.status == OBLIGATION_STATUS_CLAIMABLE_PAYABLE
                    || obligation.status == OBLIGATION_STATUS_RESERVED,
                OmegaXProtocolError::InvalidObligationStateTransition
            );
            settle_delivery(
                &mut ctx.accounts.domain_asset_vault.total_assets,
                &mut ctx.accounts.domain_asset_ledger.sheet,
                &mut ctx.accounts.plan_reserve_ledger.sheet,
                &mut ctx.accounts.funding_line_ledger.sheet,
                ctx.accounts.series_reserve_ledger.as_deref_mut(),
                ctx.accounts.pool_class_ledger.as_deref_mut(),
                ctx.accounts.allocation_position.as_deref_mut(),
                ctx.accounts.allocation_ledger.as_deref_mut(),
                &mut ctx.accounts.funding_line,
                amount,
                obligation,
            )?;
            obligation.status = OBLIGATION_STATUS_SETTLED;

            // Linked-claim settlement must include the SPL outflow accounts.
            // Without them, the obligation would be marked settled while
            // the vault balance never leaves custody.
            if let Some(claim_case_ref) = ctx.accounts.claim_case.as_deref() {
                let (
                    Some(member_pos),
                    Some(mint),
                    Some(vault_ta),
                    Some(recipient_ta),
                    Some(token_prog),
                ) = (
                    ctx.accounts.member_position.as_ref(),
                    ctx.accounts.asset_mint.as_ref(),
                    ctx.accounts.vault_token_account.as_ref(),
                    ctx.accounts.recipient_token_account.as_ref(),
                    ctx.accounts.token_program.as_ref(),
                )
                else {
                    return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
                };
                require_keys_eq!(
                    member_pos.key(),
                    claim_case_ref.member_position,
                    OmegaXProtocolError::Unauthorized
                );
                let resolved_recipient =
                    resolve_claim_settlement_recipient(claim_case_ref, member_pos);
                require_keys_eq!(
                    recipient_ta.owner,
                    resolved_recipient,
                    OmegaXProtocolError::Unauthorized
                );
                transfer_from_domain_vault(
                    amount,
                    &ctx.accounts.domain_asset_vault,
                    vault_ta,
                    recipient_ta,
                    mint,
                    token_prog,
                )?;
            }
        }
        OBLIGATION_STATUS_CANCELED => {
            cancel_outstanding(
                &mut ctx.accounts.domain_asset_ledger.sheet,
                &mut ctx.accounts.plan_reserve_ledger.sheet,
                &mut ctx.accounts.funding_line_ledger.sheet,
                ctx.accounts.series_reserve_ledger.as_deref_mut(),
                ctx.accounts.pool_class_ledger.as_deref_mut(),
                ctx.accounts.allocation_position.as_deref_mut(),
                ctx.accounts.allocation_ledger.as_deref_mut(),
                &mut ctx.accounts.funding_line,
                amount,
                obligation,
            )?;
            obligation.status = OBLIGATION_STATUS_CANCELED;
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }

    obligation.settlement_reason_hash = args.settlement_reason_hash;
    obligation.updated_at = now_ts;

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        match args.next_status {
            OBLIGATION_STATUS_SETTLED => {
                let claim_case_key = claim_case.key();
                sync_linked_claim_case_after_settlement(
                    claim_case,
                    claim_case_key,
                    obligation,
                    obligation_key,
                    ctx.accounts.health_plan.key(),
                    amount,
                    now_ts,
                )?
            }
            OBLIGATION_STATUS_CLAIMABLE_PAYABLE | OBLIGATION_STATUS_CANCELED => {
                let claim_case_key = claim_case.key();
                sync_linked_claim_case_reserve(
                    claim_case,
                    claim_case_key,
                    obligation,
                    obligation_key,
                    ctx.accounts.health_plan.key(),
                    now_ts,
                )?
            }
            _ => {}
        }
    }

    emit!(ObligationStatusChangedEvent {
        obligation: obligation.key(),
        funding_line: obligation.funding_line,
        status: obligation.status,
        amount,
    });

    Ok(())
}

pub(crate) fn release_reserve(
    ctx: Context<ReleaseReserve>,
    args: ReleaseReserveArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    let amount = args.amount;
    require_positive_amount(amount)?;
    let now_ts = Clock::get()?.unix_timestamp;
    let obligation = &mut ctx.accounts.obligation;
    let obligation_key = obligation.key();
    require_obligation_reserve_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
        obligation,
    )?;
    require!(
        obligation.status == OBLIGATION_STATUS_RESERVED,
        OmegaXProtocolError::InvalidObligationStateTransition
    );
    require!(
        amount <= obligation.reserved_amount,
        OmegaXProtocolError::AmountExceedsReservedBalance
    );
    validate_treasury_mutation_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        obligation,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    obligation.reserved_amount = checked_sub(obligation.reserved_amount, amount)?;
    obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
    obligation.status = if obligation.reserved_amount == 0 {
        OBLIGATION_STATUS_CANCELED
    } else {
        OBLIGATION_STATUS_RESERVED
    };
    obligation.updated_at = now_ts;

    ctx.accounts.funding_line.reserved_amount =
        checked_sub(ctx.accounts.funding_line.reserved_amount, amount)?;
    ctx.accounts.funding_line.released_amount =
        checked_add(ctx.accounts.funding_line.released_amount, amount)?;

    release_reserved_scoped(
        &mut ctx.accounts.domain_asset_ledger.sheet,
        &mut ctx.accounts.plan_reserve_ledger.sheet,
        &mut ctx.accounts.funding_line_ledger.sheet,
        ctx.accounts.series_reserve_ledger.as_deref_mut(),
        ctx.accounts.pool_class_ledger.as_deref_mut(),
        ctx.accounts.allocation_position.as_deref_mut(),
        ctx.accounts.allocation_ledger.as_deref_mut(),
        amount,
    )?;

    if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
        let claim_case_key = claim_case.key();
        sync_linked_claim_case_reserve(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            ctx.accounts.health_plan.key(),
            now_ts,
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: OpenFundingLineArgs)]
pub struct OpenFundingLine<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(
        init,
        payer = authority,
        space = 8 + FundingLine::INIT_SPACE,
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), args.line_id.as_bytes()],
        bump
    )]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + FundingLineLedger::INIT_SPACE,
        seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PlanReserveLedger::INIT_SPACE,
        seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundSponsorBudget<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), funding_line.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RecordPremiumPayment<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), funding_line.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == funding_line.asset_mint @ OmegaXProtocolError::FeeVaultMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(args: CreateObligationArgs)]
pub struct CreateObligation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + Obligation::INIT_SPACE,
        seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), args.obligation_id.as_bytes()],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReserveObligation<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
}

#[derive(Accounts)]
pub struct SettleObligation<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
    // Optional for non-claim obligation transitions, but required when a
    // linked claim is being marked SETTLED so accounting cannot move without
    // the matching SPL outflow.
    pub member_position: Option<Box<Account<'info, MemberPosition>>>,
    pub asset_mint: Option<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub vault_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub recipient_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Option<Interface<'info, TokenInterface>>,
}

#[derive(Accounts)]
pub struct ReleaseReserve<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
}
