// SPDX-License-Identifier: AGPL-3.0-or-later

//! Claim lifecycle and claim-attestation instruction handlers and account validation contexts.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;

pub(crate) fn open_claim_case(ctx: Context<OpenClaimCase>, args: OpenClaimCaseArgs) -> Result<()> {
    require_id(&args.claim_id)?;
    require!(
        ctx.accounts.health_plan.pause_flags & PAUSE_FLAG_CLAIM_INTAKE == 0,
        OmegaXProtocolError::ClaimIntakePaused
    );
    require_claim_intake_submitter(
        &ctx.accounts.authority.key(),
        &ctx.accounts.health_plan,
        &ctx.accounts.member_position,
        &args,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    claim_case.health_plan = ctx.accounts.health_plan.key();
    claim_case.policy_series = args.policy_series;
    claim_case.member_position = ctx.accounts.member_position.key();
    claim_case.funding_line = ctx.accounts.funding_line.key();
    claim_case.asset_mint = ctx.accounts.funding_line.asset_mint;
    claim_case.claim_id = args.claim_id;
    claim_case.claimant = args.claimant;
    claim_case.adjudicator = ZERO_PUBKEY;
    claim_case.delegate_recipient = ZERO_PUBKEY;
    claim_case.evidence_ref_hash = args.evidence_ref_hash;
    claim_case.decision_support_hash = [0u8; 32];
    claim_case.intake_status = CLAIM_INTAKE_OPEN;
    claim_case.review_state = 0;
    claim_case.approved_amount = 0;
    claim_case.denied_amount = 0;
    claim_case.paid_amount = 0;
    claim_case.reserved_amount = 0;
    claim_case.recovered_amount = 0;
    claim_case.appeal_count = 0;
    claim_case.linked_obligation = ZERO_PUBKEY;
    claim_case.opened_at = Clock::get()?.unix_timestamp;
    claim_case.updated_at = claim_case.opened_at;
    claim_case.closed_at = 0;
    claim_case.bump = ctx.bumps.claim_case;

    emit!(ClaimCaseStateChangedEvent {
        claim_case: claim_case.key(),
        intake_status: claim_case.intake_status,
        approved_amount: claim_case.approved_amount,
    });

    Ok(())
}

pub(crate) fn authorize_claim_recipient(
    ctx: Context<AuthorizeClaimRecipient>,
    args: AuthorizeClaimRecipientArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    // The Anchor context binds member_position.wallet == authority.key()
    // and claim_case.member_position == member_position.key(), so reaching
    // this body means the member of record signed.
    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.delegate_recipient = args.delegate_recipient;
    claim_case.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

pub(crate) fn attach_claim_evidence_ref(
    ctx: Context<AttachClaimEvidenceRef>,
    args: AttachClaimEvidenceRefArgs,
) -> Result<()> {
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;

    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.evidence_ref_hash = args.evidence_ref_hash;
    claim_case.decision_support_hash = args.decision_support_hash;
    claim_case.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

pub(crate) fn adjudicate_claim_case(
    ctx: Context<AdjudicateClaimCase>,
    args: AdjudicateClaimCaseArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require!(
        args.reserve_amount <= args.approved_amount,
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );

    let claim_case = &mut ctx.accounts.claim_case;
    let claim_case_key = claim_case.key();
    claim_case.adjudicator = ctx.accounts.authority.key();
    claim_case.review_state = args.review_state;
    claim_case.approved_amount = args.approved_amount;
    claim_case.denied_amount = args.denied_amount;
    claim_case.decision_support_hash = args.decision_support_hash;
    claim_case.intake_status = if args.approved_amount > 0 {
        CLAIM_INTAKE_APPROVED
    } else {
        CLAIM_INTAKE_DENIED
    };
    claim_case.updated_at = Clock::get()?.unix_timestamp;

    if let Some(obligation) = ctx.accounts.obligation.as_deref_mut() {
        let obligation_key = obligation.key();
        sync_adjudicated_claim_liability(
            claim_case,
            claim_case_key,
            Some((obligation, obligation_key)),
            ctx.accounts.health_plan.key(),
            args.approved_amount,
            args.reserve_amount,
        )?;
    } else {
        sync_adjudicated_claim_liability(
            claim_case,
            claim_case_key,
            None,
            ctx.accounts.health_plan.key(),
            args.approved_amount,
            args.reserve_amount,
        )?;
    }

    emit!(ClaimCaseStateChangedEvent {
        claim_case: claim_case.key(),
        intake_status: claim_case.intake_status,
        approved_amount: claim_case.approved_amount,
    });

    Ok(())
}

pub(crate) fn settle_claim_case(
    ctx: Context<SettleClaimCase>,
    args: SettleClaimCaseArgs,
) -> Result<()> {
    require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
    require_claim_operator(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
    require!(
        args.amount <= remaining_claim_amount(&ctx.accounts.claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );
    require_positive_amount(args.amount)?;
    validate_direct_claim_settlement_bindings(
        ctx.accounts.series_reserve_ledger.as_deref(),
        ctx.accounts.pool_class_ledger.as_deref(),
        ctx.accounts.allocation_position.as_deref(),
        ctx.accounts.allocation_ledger.as_deref(),
        &ctx.accounts.claim_case,
        ctx.accounts.funding_line.key(),
        ctx.accounts.funding_line.asset_mint,
    )?;

    // PT-2026-04-27-01/02 fix: resolve the SPL recipient before mutating
    // the claim_case (Pubkey is Copy so we capture by value).
    let resolved_recipient =
        resolve_claim_settlement_recipient(&ctx.accounts.claim_case, &ctx.accounts.member_position);
    require_keys_eq!(
        ctx.accounts.recipient_token_account.owner,
        resolved_recipient,
        OmegaXProtocolError::Unauthorized
    );

    let amount = args.amount;

    // Phase 1.6 — Compute protocol fee + adjudicator-oracle fee carve-outs.
    // The full `amount` is what the claim is settling against (claim_case.paid_amount
    // increments by amount, funding_line.spent_amount increments by amount, sheets
    // record the full obligation delivery). But only `net_to_recipient = amount -
    // total_fee` physically leaves the vault — fee tokens stay as treasury claims.
    let reserve_domain = ctx.accounts.health_plan.reserve_domain;
    let asset_mint_key = ctx.accounts.funding_line.asset_mint;
    let protocol_fee_bps = ctx.accounts.protocol_governance.protocol_fee_bps;

    let protocol_fee_vault = &ctx.accounts.protocol_fee_vault;
    require_keys_eq!(
        protocol_fee_vault.reserve_domain,
        reserve_domain,
        OmegaXProtocolError::FeeVaultMismatch
    );
    require_keys_eq!(
        protocol_fee_vault.asset_mint,
        asset_mint_key,
        OmegaXProtocolError::FeeVaultMismatch
    );
    let protocol_fee = fee_share_from_bps(amount, protocol_fee_bps)?;

    // Adjudicator oracle fee: requires BOTH pool_oracle_fee_vault and
    // pool_oracle_policy to be supplied. The vault fixes the recipient
    // oracle's revshare destination; the policy supplies oracle_fee_bps.
    // PR1 single-attester model: caller credits the adjudicator only;
    // multi-attester revshare is a follow-up.
    let oracle_fee = match (
        ctx.accounts.pool_oracle_fee_vault.as_deref(),
        ctx.accounts.pool_oracle_policy.as_deref(),
    ) {
        (Some(vault), Some(policy)) => {
            require_keys_eq!(
                vault.oracle,
                ctx.accounts.claim_case.adjudicator,
                OmegaXProtocolError::Unauthorized
            );
            require_keys_eq!(
                vault.asset_mint,
                asset_mint_key,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.liquidity_pool,
                policy.liquidity_pool,
                OmegaXProtocolError::LiquidityPoolMismatch
            );
            fee_share_from_bps(amount, policy.oracle_fee_bps)?
        }
        (None, Some(_)) => {
            return Err(OmegaXProtocolError::FeeVaultRequiredForConfiguredFee.into());
        }
        (None, None) => 0,
        (Some(_), None) => {
            // Vault provided without policy is a configuration error;
            // refuse to silently zero the bps.
            return Err(OmegaXProtocolError::FeeVaultBpsMisconfigured.into());
        }
    };

    let total_fee = checked_add(protocol_fee, oracle_fee)?;
    let net_to_recipient = checked_sub(amount, total_fee)?;

    let claim_case = &mut ctx.accounts.claim_case;
    claim_case.paid_amount = checked_add(claim_case.paid_amount, amount)?;
    claim_case.reserved_amount = claim_case.reserved_amount.saturating_sub(amount);
    claim_case.intake_status = if claim_case.paid_amount >= claim_case.approved_amount {
        CLAIM_INTAKE_SETTLED
    } else {
        CLAIM_INTAKE_APPROVED
    };
    claim_case.closed_at = if claim_case.intake_status == CLAIM_INTAKE_SETTLED {
        Clock::get()?.unix_timestamp
    } else {
        0
    };
    claim_case.updated_at = Clock::get()?.unix_timestamp;

    // Book the full obligation settlement. This decrements
    // domain_asset_vault.total_assets by `amount`, but only
    // `net_to_recipient` physically leaves the vault. The fee tokens
    // remain in the SPL token account as treasury claims; we add them
    // back to total_assets immediately below to keep the counter in
    // sync with the physical balance.
    book_settlement_from_delivery(
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
    )?;
    if total_fee > 0 {
        ctx.accounts.domain_asset_vault.total_assets =
            checked_add(ctx.accounts.domain_asset_vault.total_assets, total_fee)?;
    }

    // PT-01/02 fix: actually move the SPL tokens. The vault token account
    // is owned by the domain_asset_vault PDA, which signs via seeds.
    // Phase 1.6: outflow is net_to_recipient; fee tokens stay in vault.
    transfer_from_domain_vault(
        net_to_recipient,
        &ctx.accounts.domain_asset_vault,
        &ctx.accounts.vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.asset_mint,
        &ctx.accounts.token_program,
    )?;

    // Accrue the protocol fee carve-out.
    if protocol_fee > 0 {
        let vault = &mut ctx.accounts.protocol_fee_vault;
        let key = vault.key();
        let mint = vault.asset_mint;
        let total = accrue_fee(&mut vault.accrued_fees, protocol_fee)?;
        emit!(FeeAccruedEvent {
            vault: key,
            asset_mint: mint,
            amount: protocol_fee,
            accrued_total: total,
        });
    }

    // Accrue the adjudicator-oracle fee carve-out.
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

    let claim_case_key = ctx.accounts.claim_case.key();
    let intake_status = ctx.accounts.claim_case.intake_status;
    let approved_amount = ctx.accounts.claim_case.approved_amount;
    emit!(ClaimCaseStateChangedEvent {
        claim_case: claim_case_key,
        intake_status,
        approved_amount,
    });

    Ok(())
}

pub(crate) fn attest_claim_case(
    ctx: Context<AttestClaimCase>,
    args: AttestClaimCaseArgs,
) -> Result<()> {
    require_valid_attestation_decision(args.decision)?;
    require!(
        !is_zero_hash(&args.schema_key_hash),
        OmegaXProtocolError::ClaimAttestationSchemaRequired
    );

    let now_ts = Clock::get()?.unix_timestamp;
    let oracle_profile = &ctx.accounts.oracle_profile;
    let claim_case = &ctx.accounts.claim_case;
    let outcome_schema = &ctx.accounts.outcome_schema;

    require!(
        oracle_profile_supports_schema(oracle_profile, outcome_schema.schema_key_hash),
        OmegaXProtocolError::ClaimAttestationSchemaUnsupported
    );

    let attestation = &mut ctx.accounts.claim_attestation;
    attestation.oracle = oracle_profile.oracle;
    attestation.oracle_profile = oracle_profile.key();
    attestation.claim_case = claim_case.key();
    attestation.health_plan = claim_case.health_plan;
    attestation.policy_series = claim_case.policy_series;
    attestation.decision = args.decision;
    attestation.attestation_hash = args.attestation_hash;
    attestation.attestation_ref_hash = args.attestation_ref_hash;
    attestation.schema_key_hash = outcome_schema.schema_key_hash;
    attestation.created_at_ts = now_ts;
    attestation.updated_at_ts = now_ts;
    attestation.bump = ctx.bumps.claim_attestation;

    emit!(ClaimCaseAttestedEvent {
        claim_attestation: attestation.key(),
        claim_case: claim_case.key(),
        oracle_profile: oracle_profile.key(),
        oracle: oracle_profile.oracle,
        decision: attestation.decision,
        attestation_hash: attestation.attestation_hash,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: OpenClaimCaseArgs)]
pub struct OpenClaimCase<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(
        seeds = [SEED_MEMBER_POSITION, health_plan.key().as_ref(), member_position.wallet.as_ref(), member_position.policy_series.as_ref()],
        bump = member_position.bump,
        constraint = member_position.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = member_position.policy_series == args.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = member_position.active @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.eligibility_status == ELIGIBILITY_ELIGIBLE @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[account(
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()],
        bump = funding_line.bump,
        constraint = funding_line.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = funding_line.policy_series == args.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = funding_line.status == FUNDING_LINE_STATUS_OPEN @ OmegaXProtocolError::FundingLineMismatch,
    )]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + ClaimCase::INIT_SPACE,
        seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), args.claim_id.as_bytes()],
        bump
    )]
    pub claim_case: Box<Account<'info, ClaimCase>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthorizeClaimRecipient<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [
            SEED_MEMBER_POSITION,
            member_position.health_plan.as_ref(),
            member_position.wallet.as_ref(),
            member_position.policy_series.as_ref(),
        ],
        bump = member_position.bump,
        constraint = member_position.wallet == authority.key() @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.active @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[account(
        mut,
        seeds = [SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id.as_bytes()],
        bump = claim_case.bump,
        constraint = claim_case.member_position == member_position.key() @ OmegaXProtocolError::Unauthorized,
    )]
    pub claim_case: Box<Account<'info, ClaimCase>>,
}

#[derive(Accounts)]
pub struct AttachClaimEvidenceRef<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Account<'info, ClaimCase>,
}

#[derive(Accounts)]
pub struct AdjudicateClaimCase<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Account<'info, ClaimCase>,
    #[account(mut)]
    pub obligation: Option<Box<Account<'info, Obligation>>>,
}

#[derive(Accounts)]
pub struct SettleClaimCase<'info> {
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
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Box<Account<'info, ClaimCase>>,
    #[account(mut)]
    pub obligation: Option<Box<Account<'info, Obligation>>>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == health_plan.reserve_domain @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == funding_line.asset_mint @ OmegaXProtocolError::FeeVaultMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    /// Phase 1.6 — optional pool-oracle fee vault for adjudicator revshare.
    /// When supplied alongside `pool_oracle_policy`, the bps from policy is
    /// applied to the gross amount and credited to the supplied oracle vault.
    /// Asset mint must match funding_line.asset_mint; pool ref must match
    /// pool_oracle_policy.liquidity_pool. Single-attester scope: callers
    /// credit the adjudicator (not all M attesters) — multi-attester revshare
    /// is a follow-up beyond PR1 (documented in plan).
    #[account(mut)]
    pub pool_oracle_fee_vault: Option<Box<Account<'info, PoolOracleFeeVault>>>,
    /// Phase 1.6 — pairs with pool_oracle_fee_vault. The handler reads
    /// `oracle_fee_bps` from policy. Required when pool_oracle_fee_vault is Some;
    /// ignored otherwise. Validated at runtime.
    pub pool_oracle_policy: Option<Box<Account<'info, PoolOraclePolicy>>>,
    // PT-2026-04-27-01/02 fix: outflow CPI accounts. The handler resolves the
    // settlement recipient as `claim_case.delegate_recipient` if non-zero,
    // else `member_position.wallet`, and asserts
    // `recipient_token_account.owner` equals that key before transferring SPL
    // out of the PDA-owned vault token account.
    #[account(
        constraint = member_position.key() == claim_case.member_position @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[account(
        constraint = asset_mint.key() == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(args: AttestClaimCaseArgs)]
pub struct AttestClaimCase<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
        constraint = oracle_profile.oracle == oracle.key() @ OmegaXProtocolError::Unauthorized,
        constraint = oracle_profile.active @ OmegaXProtocolError::OracleProfileInactive,
        constraint = oracle_profile.claimed @ OmegaXProtocolError::OracleProfileUnclaimed,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        seeds = [SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id.as_bytes()],
        bump = claim_case.bump,
    )]
    pub claim_case: Box<Account<'info, ClaimCase>>,
    #[account(
        seeds = [SEED_OUTCOME_SCHEMA, args.schema_key_hash.as_ref()],
        bump = outcome_schema.bump,
    )]
    pub outcome_schema: Box<Account<'info, OutcomeSchema>>,
    #[account(
        init,
        payer = oracle,
        space = 8 + ClaimAttestation::INIT_SPACE,
        seeds = [SEED_CLAIM_ATTESTATION, claim_case.key().as_ref(), oracle.key().as_ref()],
        bump,
    )]
    pub claim_attestation: Box<Account<'info, ClaimAttestation>>,
    pub system_program: Program<'info, System>,
}
