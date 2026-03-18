// SPDX-License-Identifier: AGPL-3.0-or-later

//! Treasury withdrawals, premium attestations, and claim-settlement handlers.

use super::*;

fn assert_valid_ai_role(ai_role: u8) -> Result<()> {
    require!(
        ai_role == AI_ROLE_NONE
            || ai_role == AI_ROLE_UNDERWRITER
            || ai_role == AI_ROLE_PRICING_AGENT
            || ai_role == AI_ROLE_CLAIM_PROCESSOR
            || ai_role == AI_ROLE_SETTLEMENT_PLANNER
            || ai_role == AI_ROLE_ORACLE,
        OmegaXProtocolError::InvalidAiRole
    );
    Ok(())
}

fn validate_claim_decision_support_policy(
    policy: &PoolAutomationPolicy,
    requested_amount: u64,
    ai_role: u8,
    automation_mode: u8,
    ai_attestation_ref_hash: [u8; 32],
) -> Result<()> {
    assert_valid_ai_role(ai_role)?;
    require!(
        automation_mode <= AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
        OmegaXProtocolError::InvalidAutomationMode
    );
    require!(
        automation_mode <= policy.claim_automation_mode,
        OmegaXProtocolError::AutomationNotPermitted
    );
    require!(
        ai_role == AI_ROLE_NONE
            || (policy.allowed_ai_roles_mask & (1 << ai_role)) == (1 << ai_role),
        OmegaXProtocolError::AutomationNotPermitted
    );
    if automation_mode == AUTOMATION_MODE_BOUNDED_AUTONOMOUS {
        require!(
            requested_amount <= policy.max_auto_claim_amount,
            OmegaXProtocolError::AutomationNotPermitted
        );
    }
    if !is_zero_hash(&policy.required_attestation_provider_ref_hash) {
        require!(
            policy.required_attestation_provider_ref_hash == ai_attestation_ref_hash,
            OmegaXProtocolError::AutomationNotPermitted
        );
    }
    Ok(())
}

fn assert_active_claim_adjudicator(
    pool: Pubkey,
    oracle: Pubkey,
    oracle_entry: &Account<'_, OracleRegistryEntry>,
    pool_oracle: &Account<'_, PoolOracleApproval>,
    pool_oracle_permissions: &Account<'_, PoolOraclePermissionSet>,
) -> Result<()> {
    require!(
        oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_oracle_claim_settle_permission(pool, oracle, pool_oracle, pool_oracle_permissions)
}

#[allow(clippy::too_many_arguments)]
fn complete_coverage_claim_payout<'info>(
    pool: &Account<'info, Pool>,
    pool_terms: &Account<'info, PoolTerms>,
    pool_treasury_reserve: &mut Account<'info, PoolTreasuryReserve>,
    coverage_claim: &mut Account<'info, CoverageClaimRecord>,
    claimant: Pubkey,
    recipient_system_account: &UncheckedAccount<'info>,
    pool_asset_vault: &Account<'info, PoolAssetVault>,
    pool_vault_token_account: &Account<'info, TokenAccount>,
    recipient_token_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
    payout_amount: u64,
    now: i64,
) -> Result<()> {
    let pool_key = pool.key();

    require_keys_eq!(
        coverage_claim.pool,
        pool_key,
        OmegaXProtocolError::AccountPoolMismatch
    );
    require!(payout_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        coverage_claim.status == COVERAGE_CLAIM_STATUS_APPROVED
            || coverage_claim.status == COVERAGE_CLAIM_STATUS_PARTIALLY_PAID,
        OmegaXProtocolError::InvalidCoverageClaimStateTransition
    );
    require!(
        payout_amount <= coverage_claim.reserved_amount,
        OmegaXProtocolError::CoverageClaimPayoutExceedsReservedAmount
    );

    if pool_terms.payout_asset_mint == ZERO_PUBKEY {
        require_keys_eq!(
            recipient_system_account.key(),
            claimant,
            OmegaXProtocolError::RecipientMismatch
        );
        transfer_program_owned_lamports(
            &pool.to_account_info(),
            &recipient_system_account.to_account_info(),
            payout_amount,
        )?;
    } else {
        require_keys_eq!(
            pool_asset_vault.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require_keys_eq!(
            pool_asset_vault.payout_mint,
            pool_terms.payout_asset_mint,
            OmegaXProtocolError::PayoutMintMismatch
        );
        require!(
            recipient_token_account.owner == claimant,
            OmegaXProtocolError::RecipientMismatch
        );
        transfer_spl_reward(
            pool_asset_vault,
            pool_vault_token_account,
            recipient_token_account,
            token_program,
            payout_amount,
        )?;
    }

    release_coverage_claim_liability(pool_treasury_reserve, payout_amount)?;
    record_paid_coverage_claim(pool_treasury_reserve, payout_amount)?;
    record_coverage_claim_payment(coverage_claim, payout_amount, now)?;
    emit!(CoverageClaimPayoutCompletedEvent {
        pool: pool_key,
        member: coverage_claim.member,
        claimant: coverage_claim.claimant,
        intent_hash: coverage_claim.intent_hash,
        payout_mint: pool_terms.payout_asset_mint,
        paid_amount: payout_amount,
        recovery_amount: 0,
    });
    Ok(())
}

pub fn withdraw_pool_treasury_spl(
    ctx: Context<WithdrawPoolTreasurySpl>,
    amount: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_pool_oracle_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
        ORACLE_PERMISSION_TREASURY_WITHDRAW,
    )?;
    let reserve_bump = ctx.accounts.pool_treasury_reserve.bump;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.payment_mint.key(),
        reserve_bump,
    )?;
    require_keys_eq!(
        ctx.accounts.pool_asset_vault.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.pool_asset_vault.payout_mint,
        ctx.accounts.payment_mint.key(),
        OmegaXProtocolError::PayoutMintMismatch
    );

    let available = available_treasury_balance(
        ctx.accounts.pool_vault_token_account.amount,
        &ctx.accounts.pool_treasury_reserve,
    )?;
    require!(
        amount <= available,
        OmegaXProtocolError::InsufficientUnreservedTreasuryBalance
    );

    transfer_spl_reward(
        &ctx.accounts.pool_asset_vault,
        &ctx.accounts.pool_vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.token_program,
        amount,
    )?;

    Ok(())
}

pub fn withdraw_pool_treasury_sol(
    ctx: Context<WithdrawPoolTreasurySol>,
    amount: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_pool_oracle_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
        ORACLE_PERMISSION_TREASURY_WITHDRAW,
    )?;
    let reserve_bump = ctx.accounts.pool_treasury_reserve.bump;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ZERO_PUBKEY,
        reserve_bump,
    )?;

    let available = available_treasury_balance(
        pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?,
        &ctx.accounts.pool_treasury_reserve,
    )?;
    require!(
        amount <= available,
        OmegaXProtocolError::InsufficientUnreservedTreasuryBalance
    );

    transfer_program_owned_lamports(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.recipient_system_account.to_account_info(),
        amount,
    )?;

    Ok(())
}

pub fn withdraw_protocol_fee_spl(ctx: Context<WithdrawProtocolFeeSpl>, amount: u64) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_governance_signer(
        &ctx.accounts.config,
        ctx.accounts.governance_authority.key(),
    )?;
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require_keys_eq!(
        ctx.accounts.protocol_fee_vault.payment_mint,
        ctx.accounts.payment_mint.key(),
        OmegaXProtocolError::PayoutMintMismatch
    );
    let payment_mint = ctx.accounts.payment_mint.key();

    let signer_seeds: &[&[u8]] = &[
        SEED_PROTOCOL_FEE_VAULT,
        payment_mint.as_ref(),
        &[ctx.accounts.protocol_fee_vault.bump],
    ];
    transfer_spl_from_program_vault(
        &ctx.accounts.protocol_fee_vault.to_account_info(),
        signer_seeds,
        &ctx.accounts.protocol_fee_vault_token_account,
        &ctx.accounts.recipient_token_account,
        payment_mint,
        &ctx.accounts.token_program,
        amount,
    )?;

    Ok(())
}

pub fn withdraw_protocol_fee_sol(ctx: Context<WithdrawProtocolFeeSol>, amount: u64) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_governance_signer(
        &ctx.accounts.config,
        ctx.accounts.governance_authority.key(),
    )?;
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require_keys_eq!(
        ctx.accounts.protocol_fee_vault.payment_mint,
        ZERO_PUBKEY,
        OmegaXProtocolError::PayoutMintMismatch
    );
    let available = pool_withdrawable_lamports(&ctx.accounts.protocol_fee_vault.to_account_info())?;
    require!(
        amount <= available,
        OmegaXProtocolError::InsufficientPoolRentReserve
    );

    transfer_program_owned_lamports(
        &ctx.accounts.protocol_fee_vault.to_account_info(),
        &ctx.accounts.recipient_system_account.to_account_info(),
        amount,
    )?;

    Ok(())
}

pub fn withdraw_pool_oracle_fee_spl(
    ctx: Context<WithdrawPoolOracleFeeSpl>,
    amount: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_pool_oracle_fee_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle_permissions,
        ORACLE_PERMISSION_FEE_WITHDRAW,
    )?;
    require_keys_eq!(
        ctx.accounts.pool_oracle_fee_vault.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.pool_oracle_fee_vault.oracle,
        ctx.accounts.oracle.key(),
        OmegaXProtocolError::OracleKeyMismatch
    );
    require_keys_eq!(
        ctx.accounts.pool_oracle_fee_vault.payment_mint,
        ctx.accounts.payment_mint.key(),
        OmegaXProtocolError::PayoutMintMismatch
    );
    let pool_key = ctx.accounts.pool.key();
    let oracle_key = ctx.accounts.oracle.key();
    let payment_mint = ctx.accounts.payment_mint.key();

    let signer_seeds: &[&[u8]] = &[
        SEED_POOL_ORACLE_FEE_VAULT,
        pool_key.as_ref(),
        oracle_key.as_ref(),
        payment_mint.as_ref(),
        &[ctx.accounts.pool_oracle_fee_vault.bump],
    ];
    transfer_spl_from_program_vault(
        &ctx.accounts.pool_oracle_fee_vault.to_account_info(),
        signer_seeds,
        &ctx.accounts.pool_oracle_fee_vault_token_account,
        &ctx.accounts.recipient_token_account,
        payment_mint,
        &ctx.accounts.token_program,
        amount,
    )?;

    Ok(())
}

pub fn withdraw_pool_oracle_fee_sol(
    ctx: Context<WithdrawPoolOracleFeeSol>,
    amount: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_pool_oracle_fee_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle_permissions,
        ORACLE_PERMISSION_FEE_WITHDRAW,
    )?;
    require_keys_eq!(
        ctx.accounts.pool_oracle_fee_vault.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.pool_oracle_fee_vault.oracle,
        ctx.accounts.oracle.key(),
        OmegaXProtocolError::OracleKeyMismatch
    );
    require_keys_eq!(
        ctx.accounts.pool_oracle_fee_vault.payment_mint,
        ZERO_PUBKEY,
        OmegaXProtocolError::PayoutMintMismatch
    );
    let available =
        pool_withdrawable_lamports(&ctx.accounts.pool_oracle_fee_vault.to_account_info())?;
    require!(
        amount <= available,
        OmegaXProtocolError::InsufficientPoolRentReserve
    );

    transfer_program_owned_lamports(
        &ctx.accounts.pool_oracle_fee_vault.to_account_info(),
        &ctx.accounts.recipient_system_account.to_account_info(),
        amount,
    )?;

    Ok(())
}

pub fn attest_premium_paid_offchain(
    ctx: Context<AttestPremiumPaidOffchain>,
    member: Pubkey,
    series_ref_hash: [u8; 32],
    period_index: u64,
    replay_hash: [u8; 32],
    amount: u64,
    paid_at_ts: i64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    require!(
        ctx.accounts.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_oracle_data_attest_permission(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
    )?;
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.policy_position.member == member,
        OmegaXProtocolError::MembershipMemberMismatch
    );
    require!(
        ctx.accounts.policy_series.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    validate_policy_series_matches_policy(
        &ctx.accounts.policy_series,
        &ctx.accounts.policy_position,
        ctx.accounts.pool.key(),
    )?;
    require_policy_series_allows_coverage(&ctx.accounts.policy_series)?;

    let now = Clock::get()?.unix_timestamp;
    require_coverage_active(&ctx.accounts.policy_position, now)?;
    validate_premium_period(
        &ctx.accounts.premium_ledger,
        ctx.accounts.pool.key(),
        ctx.accounts.policy_position.series_ref_hash,
        member,
        period_index,
    )?;

    write_premium_ledger(
        &mut ctx.accounts.premium_ledger,
        PremiumLedgerWrite {
            pool: ctx.accounts.pool.key(),
            series_ref_hash: ctx.accounts.policy_position.series_ref_hash,
            member,
            period_index,
            amount,
            source: PREMIUM_SOURCE_OFFCHAIN_ATTESTED,
            paid_at: paid_at_ts,
            bump: ctx.bumps.premium_ledger,
        },
    );

    let replay = &mut ctx.accounts.premium_replay;
    replay.pool = ctx.accounts.pool.key();
    replay.series_ref_hash = ctx.accounts.policy_position.series_ref_hash;
    replay.member = member;
    replay.period_index = period_index;
    replay.replay_hash = replay_hash;
    replay.oracle = ctx.accounts.oracle.key();
    replay.created_at = now;
    replay.bump = ctx.bumps.premium_replay;

    advance_policy_premium(&mut ctx.accounts.policy_position, now)?;
    Ok(())
}

pub fn submit_coverage_claim(
    ctx: Context<SubmitCoverageClaim>,
    member: Pubkey,
    series_ref_hash: [u8; 32],
    intent_hash: [u8; 32],
    event_hash: [u8; 32],
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    require!(
        ctx.accounts.policy_position.member == member,
        OmegaXProtocolError::MembershipMemberMismatch
    );
    require!(
        ctx.accounts.policy_series.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    validate_policy_series_matches_policy(
        &ctx.accounts.policy_series,
        &ctx.accounts.policy_position,
        ctx.accounts.pool.key(),
    )?;
    require_policy_series_allows_coverage(&ctx.accounts.policy_series)?;

    authorize_claim_signer(
        ctx.accounts.claimant.key(),
        ctx.accounts.pool.key(),
        member,
        true,
        ctx.accounts
            .claim_delegate
            .as_deref()
            .map(|account| account.as_ref()),
    )?;
    upsert_pool_risk_config(
        &mut ctx.accounts.pool_risk_config,
        ctx.accounts.pool.key(),
        ctx.bumps.pool_risk_config,
    )?;
    assert_pool_claims_open(&ctx.accounts.pool_risk_config)?;
    assert_action_compliant(
        ctx.accounts
            .pool_compliance_policy
            .as_deref()
            .map(|policy| policy.as_ref()),
        ctx.accounts.pool.key(),
        COMPLIANCE_ACTION_CLAIM,
        ctx.accounts.claimant.key(),
        ZERO_PUBKEY,
        Some(derive_membership_subject_commitment(
            ctx.accounts.pool.key(),
            member,
        )),
        ctx.accounts.pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE,
    )?;

    let now = Clock::get()?.unix_timestamp;
    require_coverage_active(&ctx.accounts.policy_position, now)?;

    let claim = &mut ctx.accounts.coverage_claim;
    claim.pool = ctx.accounts.pool.key();
    claim.series_ref_hash = ctx.accounts.policy_position.series_ref_hash;
    claim.member = member;
    claim.claimant = ctx.accounts.claimant.key();
    claim.intent_hash = intent_hash;
    claim.event_hash = event_hash;
    claim.evidence_hash = ZERO_PUBKEY_BYTES;
    claim.interop_ref_hash = ZERO_PUBKEY_BYTES;
    claim.interop_profile_hash = ZERO_PUBKEY_BYTES;
    claim.code_system_family_hash = ZERO_PUBKEY_BYTES;
    claim.decision_reason_hash = ZERO_PUBKEY_BYTES;
    claim.adjudication_ref_hash = ZERO_PUBKEY_BYTES;
    claim.status = COVERAGE_CLAIM_STATUS_SUBMITTED;
    claim.claim_family = COVERAGE_CLAIM_FAMILY_FAST;
    claim.appeal_count = 0;
    claim.requested_amount = 0;
    claim.approved_amount = 0;
    claim.paid_amount = 0;
    claim.reserved_amount = 0;
    claim.recovery_amount = 0;
    claim.ai_decision_hash = ZERO_PUBKEY_BYTES;
    claim.ai_policy_hash = ZERO_PUBKEY_BYTES;
    claim.ai_execution_environment_hash = ZERO_PUBKEY_BYTES;
    claim.ai_attestation_ref_hash = ZERO_PUBKEY_BYTES;
    claim.ai_automation_mode = AUTOMATION_MODE_DISABLED;
    claim.submitted_at = now;
    claim.reviewed_at = 0;
    claim.settled_at = 0;
    claim.closed_at = 0;
    claim.bump = ctx.bumps.coverage_claim;

    emit!(CoverageClaimStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        member,
        claimant: ctx.accounts.claimant.key(),
        intent_hash,
        status: COVERAGE_CLAIM_STATUS_SUBMITTED,
        claim_family: COVERAGE_CLAIM_FAMILY_FAST,
        requested_amount: 0,
        approved_amount: 0,
        reserved_amount: 0,
        ai_automation_mode: AUTOMATION_MODE_DISABLED,
    });
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn review_coverage_claim(
    ctx: Context<ReviewCoverageClaim>,
    requested_amount: u64,
    evidence_hash: [u8; 32],
    interop_ref_hash: [u8; 32],
    claim_family: u8,
    interop_profile_hash: [u8; 32],
    code_system_family_hash: [u8; 32],
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_active_claim_adjudicator(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.oracle_entry,
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
    )?;

    let now = Clock::get()?.unix_timestamp;
    review_coverage_claim_case(
        &mut ctx.accounts.coverage_claim,
        requested_amount,
        evidence_hash,
        interop_ref_hash,
        claim_family,
        interop_profile_hash,
        code_system_family_hash,
        now,
    )?;
    emit!(CoverageClaimStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        member: ctx.accounts.coverage_claim.member,
        claimant: ctx.accounts.coverage_claim.claimant,
        intent_hash: ctx.accounts.coverage_claim.intent_hash,
        status: ctx.accounts.coverage_claim.status,
        claim_family: ctx.accounts.coverage_claim.claim_family,
        requested_amount,
        approved_amount: ctx.accounts.coverage_claim.approved_amount,
        reserved_amount: ctx.accounts.coverage_claim.reserved_amount,
        ai_automation_mode: ctx.accounts.coverage_claim.ai_automation_mode,
    });
    Ok(())
}

pub fn approve_coverage_claim(
    ctx: Context<ApproveCoverageClaim>,
    approved_amount: u64,
    decision_reason_hash: [u8; 32],
    adjudication_ref_hash: [u8; 32],
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    let pool_key = ctx.accounts.pool.key();
    assert_active_claim_adjudicator(
        pool_key,
        ctx.accounts.oracle.key(),
        &ctx.accounts.oracle_entry,
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
    )?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;

    let free_capital_before = if ctx.accounts.pool_terms.payout_asset_mint == ZERO_PUBKEY {
        free_capital_treasury_balance(
            pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?,
            &ctx.accounts.pool_treasury_reserve,
        )?
    } else {
        require!(
            ctx.accounts.pool_asset_vault.active,
            OmegaXProtocolError::MissingAssetVault
        );
        require_keys_eq!(
            ctx.accounts.pool_asset_vault.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require_keys_eq!(
            ctx.accounts.pool_asset_vault.payout_mint,
            ctx.accounts.pool_terms.payout_asset_mint,
            OmegaXProtocolError::PayoutMintMismatch
        );
        require!(
            ctx.accounts.pool_asset_vault.vault_token_account
                == ctx.accounts.pool_vault_token_account.key(),
            OmegaXProtocolError::VaultTokenAccountMismatch
        );
        free_capital_treasury_balance(
            ctx.accounts.pool_vault_token_account.amount,
            &ctx.accounts.pool_treasury_reserve,
        )?
    };
    require!(
        approved_amount <= free_capital_before,
        OmegaXProtocolError::InsufficientUnreservedTreasuryBalance
    );

    reserve_coverage_claim_liability(&mut ctx.accounts.pool_treasury_reserve, approved_amount)?;
    approve_coverage_claim_case(
        &mut ctx.accounts.coverage_claim,
        approved_amount,
        decision_reason_hash,
        adjudication_ref_hash,
        Clock::get()?.unix_timestamp,
    )?;
    emit!(CoverageClaimStatusChangedEvent {
        pool: pool_key,
        member: ctx.accounts.coverage_claim.member,
        claimant: ctx.accounts.coverage_claim.claimant,
        intent_hash: ctx.accounts.coverage_claim.intent_hash,
        status: ctx.accounts.coverage_claim.status,
        claim_family: ctx.accounts.coverage_claim.claim_family,
        requested_amount: ctx.accounts.coverage_claim.requested_amount,
        approved_amount,
        reserved_amount: ctx.accounts.coverage_claim.reserved_amount,
        ai_automation_mode: ctx.accounts.coverage_claim.ai_automation_mode,
    });
    Ok(())
}

pub fn deny_coverage_claim(
    ctx: Context<DenyCoverageClaim>,
    decision_reason_hash: [u8; 32],
    adjudication_ref_hash: [u8; 32],
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_active_claim_adjudicator(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.oracle_entry,
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
    )?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;

    let release_amount = deny_coverage_claim_case(
        &mut ctx.accounts.coverage_claim,
        decision_reason_hash,
        adjudication_ref_hash,
        Clock::get()?.unix_timestamp,
    )?;
    if release_amount > 0 {
        release_coverage_claim_liability(&mut ctx.accounts.pool_treasury_reserve, release_amount)?;
    }

    emit!(CoverageClaimStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        member: ctx.accounts.coverage_claim.member,
        claimant: ctx.accounts.coverage_claim.claimant,
        intent_hash: ctx.accounts.coverage_claim.intent_hash,
        status: ctx.accounts.coverage_claim.status,
        claim_family: ctx.accounts.coverage_claim.claim_family,
        requested_amount: ctx.accounts.coverage_claim.requested_amount,
        approved_amount: ctx.accounts.coverage_claim.approved_amount,
        reserved_amount: ctx.accounts.coverage_claim.reserved_amount,
        ai_automation_mode: ctx.accounts.coverage_claim.ai_automation_mode,
    });
    Ok(())
}

pub fn pay_coverage_claim(ctx: Context<PayCoverageClaim>, payout_amount: u64) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    let pool_key = ctx.accounts.pool.key();

    require_keys_eq!(
        ctx.accounts.coverage_claim.pool,
        pool_key,
        OmegaXProtocolError::AccountPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_claim.claimant,
        ctx.accounts.claimant.key(),
        OmegaXProtocolError::ClaimantMismatch
    );
    require!(payout_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.coverage_claim.status == COVERAGE_CLAIM_STATUS_APPROVED
            || ctx.accounts.coverage_claim.status == COVERAGE_CLAIM_STATUS_PARTIALLY_PAID,
        OmegaXProtocolError::InvalidCoverageClaimStateTransition
    );
    require!(
        payout_amount <= ctx.accounts.coverage_claim.reserved_amount,
        OmegaXProtocolError::CoverageClaimPayoutExceedsReservedAmount
    );
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;

    complete_coverage_claim_payout(
        &ctx.accounts.pool,
        &ctx.accounts.pool_terms,
        &mut ctx.accounts.pool_treasury_reserve,
        &mut ctx.accounts.coverage_claim,
        ctx.accounts.claimant.key(),
        &ctx.accounts.recipient_system_account,
        &ctx.accounts.pool_asset_vault,
        &ctx.accounts.pool_vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.token_program,
        payout_amount,
        Clock::get()?.unix_timestamp,
    )
}

pub fn claim_approved_coverage_payout(
    ctx: Context<ClaimApprovedCoveragePayout>,
    payout_amount: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    let claim_delegate = match ctx.accounts.claim_delegate.as_ref() {
        Some(account) => {
            let account_info = account.to_account_info();
            if account_info.owner == &anchor_lang::system_program::ID
                && account_info.data_is_empty()
            {
                None
            } else {
                deserialize_optional_program_account::<ClaimDelegateAuthorization>(&account_info)?
            }
        }
        None => None,
    };

    authorize_claim_signer(
        ctx.accounts.claim_signer.key(),
        ctx.accounts.pool.key(),
        ctx.accounts.claimant.key(),
        true,
        claim_delegate.as_ref(),
    )?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;

    complete_coverage_claim_payout(
        &ctx.accounts.pool,
        &ctx.accounts.pool_terms,
        &mut ctx.accounts.pool_treasury_reserve,
        &mut ctx.accounts.coverage_claim,
        ctx.accounts.claimant.key(),
        &ctx.accounts.recipient_system_account,
        &ctx.accounts.pool_asset_vault,
        &ctx.accounts.pool_vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.token_program,
        payout_amount,
        Clock::get()?.unix_timestamp,
    )
}

pub fn close_coverage_claim(ctx: Context<CloseCoverageClaim>, recovery_amount: u64) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;

    let release_amount = close_coverage_claim_case(
        &mut ctx.accounts.coverage_claim,
        recovery_amount,
        Clock::get()?.unix_timestamp,
    )?;
    if release_amount > 0 {
        release_coverage_claim_liability(&mut ctx.accounts.pool_treasury_reserve, release_amount)?;
    }
    if recovery_amount > 0 {
        record_recovered_coverage_claim(&mut ctx.accounts.pool_treasury_reserve, recovery_amount)?;
    }

    emit!(CoverageClaimStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        member: ctx.accounts.coverage_claim.member,
        claimant: ctx.accounts.coverage_claim.claimant,
        intent_hash: ctx.accounts.coverage_claim.intent_hash,
        status: ctx.accounts.coverage_claim.status,
        claim_family: ctx.accounts.coverage_claim.claim_family,
        requested_amount: ctx.accounts.coverage_claim.requested_amount,
        approved_amount: ctx.accounts.coverage_claim.approved_amount,
        reserved_amount: ctx.accounts.coverage_claim.reserved_amount,
        ai_automation_mode: ctx.accounts.coverage_claim.ai_automation_mode,
    });
    Ok(())
}

pub fn attach_coverage_claim_decision_support(
    ctx: Context<AttachCoverageClaimDecisionSupport>,
    ai_decision_hash: [u8; 32],
    ai_policy_hash: [u8; 32],
    ai_execution_environment_hash: [u8; 32],
    ai_attestation_ref_hash: [u8; 32],
    ai_role: u8,
    automation_mode: u8,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_active_claim_adjudicator(
        ctx.accounts.pool.key(),
        ctx.accounts.oracle.key(),
        &ctx.accounts.oracle_entry,
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
    )?;
    validate_claim_decision_support_policy(
        &ctx.accounts.pool_automation_policy,
        ctx.accounts.coverage_claim.requested_amount,
        ai_role,
        automation_mode,
        ai_attestation_ref_hash,
    )?;

    ctx.accounts.coverage_claim.ai_decision_hash = ai_decision_hash;
    ctx.accounts.coverage_claim.ai_policy_hash = ai_policy_hash;
    ctx.accounts.coverage_claim.ai_execution_environment_hash = ai_execution_environment_hash;
    ctx.accounts.coverage_claim.ai_attestation_ref_hash = ai_attestation_ref_hash;
    ctx.accounts.coverage_claim.ai_automation_mode = automation_mode;
    emit!(CoverageClaimStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        member: ctx.accounts.coverage_claim.member,
        claimant: ctx.accounts.coverage_claim.claimant,
        intent_hash: ctx.accounts.coverage_claim.intent_hash,
        status: ctx.accounts.coverage_claim.status,
        claim_family: ctx.accounts.coverage_claim.claim_family,
        requested_amount: ctx.accounts.coverage_claim.requested_amount,
        approved_amount: ctx.accounts.coverage_claim.approved_amount,
        reserved_amount: ctx.accounts.coverage_claim.reserved_amount,
        ai_automation_mode: automation_mode,
    });
    Ok(())
}

pub fn settle_coverage_claim(ctx: Context<SettleCoverageClaim>, payout_amount: u64) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    let pool_key = ctx.accounts.pool.key();
    assert_active_claim_adjudicator(
        pool_key,
        ctx.accounts.oracle.key(),
        &ctx.accounts.oracle_entry,
        &ctx.accounts.pool_oracle,
        &ctx.accounts.pool_oracle_permissions,
    )?;

    require!(payout_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.coverage_claim.status == COVERAGE_CLAIM_STATUS_SUBMITTED,
        OmegaXProtocolError::CoverageClaimNotSubmitted
    );
    require_keys_eq!(
        ctx.accounts.policy_position.pool,
        pool_key,
        OmegaXProtocolError::AccountPoolMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_claim.pool,
        pool_key,
        OmegaXProtocolError::AccountPoolMismatch
    );
    require!(
        ctx.accounts.coverage_claim.member == ctx.accounts.policy_position.member,
        OmegaXProtocolError::MembershipMemberMismatch
    );
    require_keys_eq!(
        ctx.accounts.coverage_claim.claimant,
        ctx.accounts.claimant.key(),
        OmegaXProtocolError::ClaimantMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    require_coverage_active(&ctx.accounts.policy_position, now)?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;

    let free_capital_before = if ctx.accounts.pool_terms.payout_asset_mint == ZERO_PUBKEY {
        free_capital_treasury_balance(
            pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?,
            &ctx.accounts.pool_treasury_reserve,
        )?
    } else {
        free_capital_treasury_balance(
            ctx.accounts.pool_vault_token_account.amount,
            &ctx.accounts.pool_treasury_reserve,
        )?
    };
    require!(
        payout_amount <= free_capital_before,
        OmegaXProtocolError::InsufficientUnreservedTreasuryBalance
    );
    review_coverage_claim_case(
        &mut ctx.accounts.coverage_claim,
        payout_amount,
        ZERO_PUBKEY_BYTES,
        ZERO_PUBKEY_BYTES,
        COVERAGE_CLAIM_FAMILY_FAST,
        ZERO_PUBKEY_BYTES,
        ZERO_PUBKEY_BYTES,
        now,
    )?;
    reserve_coverage_claim_liability(&mut ctx.accounts.pool_treasury_reserve, payout_amount)?;
    approve_coverage_claim_case(
        &mut ctx.accounts.coverage_claim,
        payout_amount,
        ZERO_PUBKEY_BYTES,
        ZERO_PUBKEY_BYTES,
        now,
    )?;

    complete_coverage_claim_payout(
        &ctx.accounts.pool,
        &ctx.accounts.pool_terms,
        &mut ctx.accounts.pool_treasury_reserve,
        &mut ctx.accounts.coverage_claim,
        ctx.accounts.claimant.key(),
        &ctx.accounts.recipient_system_account,
        &ctx.accounts.pool_asset_vault,
        &ctx.accounts.pool_vault_token_account,
        &ctx.accounts.recipient_token_account,
        &ctx.accounts.token_program,
        payout_amount,
        now,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_automation_policy() -> PoolAutomationPolicy {
        PoolAutomationPolicy {
            pool: Pubkey::new_unique(),
            oracle_automation_mode: AUTOMATION_MODE_DISABLED,
            claim_automation_mode: AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
            allowed_ai_roles_mask: 1 << AI_ROLE_CLAIM_PROCESSOR,
            max_auto_claim_amount: 250,
            required_attestation_provider_ref_hash: [7; 32],
            updated_by: Pubkey::new_unique(),
            updated_at: 0,
            bump: 1,
        }
    }

    fn error_code(error: Error) -> u32 {
        match error {
            Error::AnchorError(anchor_error) => anchor_error.error_code_number,
            other => panic!("unexpected error variant: {other:?}"),
        }
    }

    fn omega_error_code(error: OmegaXProtocolError) -> u32 {
        error_code(Error::from(error))
    }

    #[test]
    fn claim_decision_support_rejects_invalid_role_limit_and_provider() {
        let policy = sample_automation_policy();

        let error = validate_claim_decision_support_policy(
            &policy,
            300,
            AI_ROLE_CLAIM_PROCESSOR,
            AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
            policy.required_attestation_provider_ref_hash,
        )
        .unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::AutomationNotPermitted)
        );

        let error = validate_claim_decision_support_policy(
            &policy,
            100,
            AI_ROLE_SETTLEMENT_PLANNER,
            AUTOMATION_MODE_ATTESTED,
            policy.required_attestation_provider_ref_hash,
        )
        .unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::AutomationNotPermitted)
        );

        let error = validate_claim_decision_support_policy(
            &policy,
            100,
            AI_ROLE_CLAIM_PROCESSOR,
            AUTOMATION_MODE_ATTESTED,
            ZERO_PUBKEY_BYTES,
        )
        .unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::AutomationNotPermitted)
        );
    }

    #[test]
    fn claim_decision_support_accepts_allowed_claim_processor_metadata() {
        let policy = sample_automation_policy();
        validate_claim_decision_support_policy(
            &policy,
            200,
            AI_ROLE_CLAIM_PROCESSOR,
            AUTOMATION_MODE_ATTESTED,
            policy.required_attestation_provider_ref_hash,
        )
        .unwrap();
    }
}
