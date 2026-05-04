// SPDX-License-Identifier: AGPL-3.0-or-later

//! Obligation settlement instruction handlers and account validation contexts.

use super::*;

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

    let oracle_fee = resolve_obligation_oracle_fee(
        ctx.accounts.health_plan.key(),
        obligation,
        ctx.accounts.claim_case.as_deref(),
        ctx.accounts.pool_oracle_fee_vault.as_deref(),
        ctx.accounts.pool_oracle_policy.as_deref(),
        ctx.accounts.oracle_fee_attestation.as_deref(),
        amount,
    )?;
    let net_to_recipient = checked_sub(amount, oracle_fee)?;
    require_positive_amount(net_to_recipient)?;

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
    } else if args.next_status == OBLIGATION_STATUS_SETTLED {
        require!(
            ctx.accounts.asset_mint.is_some()
                && ctx.accounts.vault_token_account.is_some()
                && ctx.accounts.recipient_token_account.is_some()
                && ctx.accounts.token_program.is_some(),
            OmegaXProtocolError::SettlementOutflowAccountsRequired
        );
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
            if oracle_fee > 0 {
                ctx.accounts.domain_asset_vault.total_assets =
                    checked_add(ctx.accounts.domain_asset_vault.total_assets, oracle_fee)?;
            }
            obligation.status = OBLIGATION_STATUS_SETTLED;

            // Any asset-backed settlement must include SPL outflow accounts.
            // Linked claims pay the member/delegate recipient; unlinked
            // obligations can only pay a token account owned by the settling
            // authority, avoiding an accounting-only "settled" state.
            let (Some(mint), Some(vault_ta), Some(recipient_ta), Some(token_prog)) = (
                ctx.accounts.asset_mint.as_ref(),
                ctx.accounts.vault_token_account.as_ref(),
                ctx.accounts.recipient_token_account.as_ref(),
                ctx.accounts.token_program.as_ref(),
            ) else {
                return Err(OmegaXProtocolError::SettlementOutflowAccountsRequired.into());
            };
            if let Some(claim_case_ref) = ctx.accounts.claim_case.as_deref() {
                let Some(member_pos) = ctx.accounts.member_position.as_ref() else {
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
            } else {
                require_keys_eq!(
                    recipient_ta.owner,
                    ctx.accounts.authority.key(),
                    OmegaXProtocolError::Unauthorized
                );
            }
            transfer_from_domain_vault(
                net_to_recipient,
                &ctx.accounts.domain_asset_vault,
                vault_ta,
                recipient_ta,
                mint,
                token_prog,
            )?;
            if oracle_fee > 0 {
                if let Some(vault) = ctx.accounts.pool_oracle_fee_vault.as_deref_mut() {
                    let key = vault.key();
                    let mint = vault.asset_mint;
                    let total = accrue_fee(&mut vault.accrued_fees, oracle_fee)?;
                    emit!(FeeAccruedEvent {
                        vault: key,
                        asset_mint: mint,
                        amount: oracle_fee,
                        accrued_total: total,
                    });
                }
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

fn resolve_obligation_oracle_fee(
    health_plan_key: Pubkey,
    obligation: &Obligation,
    claim_case: Option<&Account<ClaimCase>>,
    pool_oracle_fee_vault: Option<&Account<PoolOracleFeeVault>>,
    pool_oracle_policy: Option<&Account<PoolOraclePolicy>>,
    oracle_fee_attestation: Option<&Account<ClaimAttestation>>,
    amount: u64,
) -> Result<u64> {
    match (
        pool_oracle_fee_vault,
        pool_oracle_policy,
        oracle_fee_attestation,
    ) {
        (Some(vault), Some(policy), Some(attestation)) => {
            require!(
                claim_case.is_some(),
                OmegaXProtocolError::ClaimAttestationRequiredForOracleFee
            );
            let claim_case =
                claim_case.ok_or(OmegaXProtocolError::ClaimAttestationRequiredForOracleFee)?;
            require_keys_eq!(
                vault.oracle,
                attestation.oracle,
                OmegaXProtocolError::OracleProfileMismatch
            );
            require_keys_eq!(
                attestation.claim_case,
                claim_case.key(),
                OmegaXProtocolError::Unauthorized
            );
            require_keys_eq!(
                attestation.health_plan,
                health_plan_key,
                OmegaXProtocolError::HealthPlanMismatch
            );
            require_keys_eq!(
                attestation.policy_series,
                claim_case.policy_series,
                OmegaXProtocolError::PolicySeriesMismatch
            );
            require!(
                attestation.evidence_ref_hash == claim_case.evidence_ref_hash,
                OmegaXProtocolError::ClaimEvidenceMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                obligation.asset_mint,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.liquidity_pool,
                policy.liquidity_pool,
                OmegaXProtocolError::LiquidityPoolMismatch
            );
            require_keys_eq!(
                attestation.liquidity_pool,
                policy.liquidity_pool,
                OmegaXProtocolError::LiquidityPoolMismatch
            );
            require_keys_eq!(
                attestation.allocation_position,
                obligation.allocation_position,
                OmegaXProtocolError::AllocationPositionMismatch
            );
            let fee = fee_share_from_bps(amount, policy.oracle_fee_bps)?;
            require!(fee < amount, OmegaXProtocolError::FeeVaultBpsMisconfigured);
            Ok(fee)
        }
        (Some(_), Some(_), None) => {
            err!(OmegaXProtocolError::ClaimAttestationRequiredForOracleFee)
        }
        (None, Some(_), _) => err!(OmegaXProtocolError::FeeVaultRequiredForConfiguredFee),
        (None, None, None) => Ok(0),
        (Some(_), None, _) | (None, None, Some(_)) => {
            err!(OmegaXProtocolError::FeeVaultBpsMisconfigured)
        }
    }
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
    #[account(mut)]
    pub pool_oracle_fee_vault: Option<Box<Account<'info, PoolOracleFeeVault>>>,
    pub pool_oracle_policy: Option<Box<Account<'info, PoolOraclePolicy>>>,
    pub oracle_fee_attestation: Option<Box<Account<'info, ClaimAttestation>>>,
}
