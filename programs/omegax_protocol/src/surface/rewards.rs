// SPDX-License-Identifier: AGPL-3.0-or-later

//! Reward attestation, outcome finalization, and reward-claim handlers.

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

fn refresh_outcome_review_state(
    aggregate: &mut Account<CycleOutcomeAggregate>,
    now: i64,
) -> Result<()> {
    if aggregate.review_status == OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE
        && now >= aggregate.challenge_window_ends_at
    {
        aggregate.review_status = OUTCOME_REVIEW_STATUS_CLEAR;
    }
    Ok(())
}

fn ensure_outcome_claimable(
    aggregate: &mut Account<CycleOutcomeAggregate>,
    now: i64,
) -> Result<()> {
    refresh_outcome_review_state(aggregate, now)?;
    match aggregate.review_status {
        OUTCOME_REVIEW_STATUS_CLEAR => Ok(()),
        OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE => {
            err!(OmegaXProtocolError::OutcomeChallengeWindowActive)
        }
        OUTCOME_REVIEW_STATUS_CHALLENGED => err!(OmegaXProtocolError::OutcomeUnderDispute),
        OUTCOME_REVIEW_STATUS_OVERTURNED => err!(OmegaXProtocolError::OutcomeDidNotPass),
        _ => err!(OmegaXProtocolError::InvalidOutcomeReviewState),
    }
}

fn validate_attestation_automation(
    policy: Option<&PoolAutomationPolicy>,
    ai_role: u8,
    automation_mode: u8,
    attestation_provider_ref_hash: [u8; 32],
) -> Result<()> {
    require!(
        automation_mode <= AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
        OmegaXProtocolError::InvalidAutomationMode
    );
    assert_valid_ai_role(ai_role)?;
    if ai_role == AI_ROLE_NONE && automation_mode == AUTOMATION_MODE_DISABLED {
        return Ok(());
    }

    let policy = policy.ok_or(OmegaXProtocolError::AutomationNotPermitted)?;
    require!(
        automation_mode <= policy.oracle_automation_mode,
        OmegaXProtocolError::AutomationNotPermitted
    );
    require!(
        ai_role != AI_ROLE_NONE
            && (policy.allowed_ai_roles_mask & (1 << ai_role)) == (1 << ai_role),
        OmegaXProtocolError::AutomationNotPermitted
    );
    if !is_zero_hash(&policy.required_attestation_provider_ref_hash) {
        require!(
            policy.required_attestation_provider_ref_hash == attestation_provider_ref_hash,
            OmegaXProtocolError::AutomationNotPermitted
        );
    }
    Ok(())
}

fn validate_outcome_dispute_openable(aggregate: &CycleOutcomeAggregate, now: i64) -> Result<()> {
    require!(aggregate.finalized, OmegaXProtocolError::OracleQuorumNotMet);
    require!(
        aggregate.review_status != OUTCOME_REVIEW_STATUS_CHALLENGED,
        OmegaXProtocolError::OutcomeDisputeAlreadyOpen
    );
    require!(
        aggregate.challenge_window_ends_at == 0 || now <= aggregate.challenge_window_ends_at,
        OmegaXProtocolError::OutcomeDisputeWindowClosed
    );
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn submit_outcome_attestation_vote(
    ctx: Context<SubmitOutcomeAttestationVote>,
    member: Pubkey,
    cycle_hash: [u8; 32],
    rule_hash: [u8; 32],
    attestation_digest: [u8; 32],
    observed_value_hash: [u8; 32],
    evidence_hash: [u8; 32],
    external_attestation_ref_hash: [u8; 32],
    ai_role: u8,
    automation_mode: u8,
    model_version_hash: [u8; 32],
    policy_version_hash: [u8; 32],
    execution_environment_hash: [u8; 32],
    attestation_provider_ref_hash: [u8; 32],
    as_of_ts: i64,
    passed: bool,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(
        ctx.accounts.pool.status == POOL_STATUS_ACTIVE,
        OmegaXProtocolError::PoolNotActive
    );
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
    require!(
        ctx.accounts.membership.member == member,
        OmegaXProtocolError::MembershipMemberMismatch
    );
    require!(
        ctx.accounts.membership.status == MEMBERSHIP_STATUS_ACTIVE,
        OmegaXProtocolError::MembershipNotActive
    );
    require!(
        ctx.accounts.pool_rule.enabled,
        OmegaXProtocolError::RuleDisabled
    );
    require!(
        ctx.accounts.pool_rule.rule_hash == rule_hash,
        OmegaXProtocolError::RuleHashMismatch
    );
    let (expected_stake_position, _) = Pubkey::find_program_address(
        &[
            SEED_ORACLE_STAKE,
            ctx.accounts.oracle.key().as_ref(),
            ctx.accounts.oracle.key().as_ref(),
        ],
        ctx.program_id,
    );
    require_keys_eq!(
        ctx.accounts.stake_position.key(),
        expected_stake_position,
        OmegaXProtocolError::InvalidStakePosition
    );
    if ctx.accounts.config.min_oracle_stake > 0
        || !ctx
            .accounts
            .stake_position
            .to_account_info()
            .data_is_empty()
    {
        let stake_position_info = ctx.accounts.stake_position.to_account_info();
        require_keys_eq!(
            *stake_position_info.owner,
            *ctx.program_id,
            OmegaXProtocolError::InvalidStakePosition
        );
        let stake_position = {
            let data = stake_position_info.try_borrow_data()?;
            let mut slice: &[u8] = &data;
            OracleStakePosition::try_deserialize(&mut slice)?
        };
        require_keys_eq!(
            stake_position.oracle,
            ctx.accounts.oracle.key(),
            OmegaXProtocolError::InvalidStakePosition
        );
        require_keys_eq!(
            stake_position.staker,
            ctx.accounts.oracle.key(),
            OmegaXProtocolError::InvalidStakePosition
        );
        require!(
            stake_position.staked_amount >= ctx.accounts.config.min_oracle_stake,
            OmegaXProtocolError::OracleInsufficientStake
        );
    }
    require_keys_eq!(
        ctx.accounts.pool_terms.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );

    if ctx.accounts.oracle_policy.require_verified_schema {
        require!(
            ctx.accounts.schema_entry.verified,
            OmegaXProtocolError::SchemaUnverified
        );
    }
    validate_attestation_automation(
        ctx.accounts
            .pool_automation_policy
            .as_ref()
            .map(|policy| policy.as_ref().as_ref()),
        ai_role,
        automation_mode,
        attestation_provider_ref_hash,
    )?;

    let vote = &mut ctx.accounts.vote;
    vote.pool = ctx.accounts.pool.key();
    vote.series_ref_hash = ctx.accounts.pool_rule.series_ref_hash;
    vote.member = member;
    vote.cycle_hash = cycle_hash;
    vote.rule_hash = rule_hash;
    vote.oracle = ctx.accounts.oracle.key();
    vote.passed = passed;
    vote.attestation_digest = attestation_digest;
    vote.observed_value_hash = observed_value_hash;
    vote.evidence_hash = evidence_hash;
    vote.external_attestation_ref_hash = external_attestation_ref_hash;
    vote.ai_role = ai_role;
    vote.automation_mode = automation_mode;
    vote.model_version_hash = model_version_hash;
    vote.policy_version_hash = policy_version_hash;
    vote.execution_environment_hash = execution_environment_hash;
    vote.attestation_provider_ref_hash = attestation_provider_ref_hash;
    vote.as_of_ts = as_of_ts;
    vote.bump = ctx.bumps.vote;

    let aggregate = &mut ctx.accounts.aggregate;
    if aggregate.quorum_n == 0 {
        aggregate.pool = ctx.accounts.pool.key();
        aggregate.series_ref_hash = ctx.accounts.pool_rule.series_ref_hash;
        aggregate.member = member;
        aggregate.cycle_hash = cycle_hash;
        aggregate.rule_hash = rule_hash;
        aggregate.pass_votes = 0;
        aggregate.fail_votes = 0;
        aggregate.quorum_m = ctx.accounts.oracle_policy.quorum_m;
        aggregate.quorum_n = ctx.accounts.oracle_policy.quorum_n;
        aggregate.finalized = false;
        aggregate.passed = false;
        aggregate.claimed = false;
        aggregate.reward_liability_reserved = false;
        aggregate.evidence_hash = evidence_hash;
        aggregate.external_attestation_ref_hash = external_attestation_ref_hash;
        aggregate.review_status = OUTCOME_REVIEW_STATUS_CLEAR;
        aggregate.challenge_window_ends_at = 0;
        aggregate.dispute_reason_hash = ZERO_PUBKEY_BYTES;
        aggregate.disputed_by = ZERO_PUBKEY;
        aggregate.resolved_by = ZERO_PUBKEY;
        aggregate.resolved_at = 0;
        aggregate.ai_role = ai_role;
        aggregate.automation_mode = automation_mode;
        aggregate.model_version_hash = model_version_hash;
        aggregate.policy_version_hash = policy_version_hash;
        aggregate.execution_environment_hash = execution_environment_hash;
        aggregate.attestation_provider_ref_hash = attestation_provider_ref_hash;
        aggregate.latest_as_of_ts = as_of_ts;
        aggregate.bump = ctx.bumps.aggregate;
    } else {
        if !is_zero_hash(&aggregate.evidence_hash) && !is_zero_hash(&evidence_hash) {
            require!(
                aggregate.evidence_hash == evidence_hash,
                OmegaXProtocolError::AttestationEvidenceMismatch
            );
        } else if is_zero_hash(&aggregate.evidence_hash) && !is_zero_hash(&evidence_hash) {
            aggregate.evidence_hash = evidence_hash;
        }

        if !is_zero_hash(&aggregate.external_attestation_ref_hash)
            && !is_zero_hash(&external_attestation_ref_hash)
        {
            require!(
                aggregate.external_attestation_ref_hash == external_attestation_ref_hash,
                OmegaXProtocolError::AttestationExternalReferenceMismatch
            );
        } else if is_zero_hash(&aggregate.external_attestation_ref_hash)
            && !is_zero_hash(&external_attestation_ref_hash)
        {
            aggregate.external_attestation_ref_hash = external_attestation_ref_hash;
        }
        if ai_role != AI_ROLE_NONE && aggregate.ai_role != AI_ROLE_NONE {
            require!(
                aggregate.ai_role == ai_role,
                OmegaXProtocolError::AutomationNotPermitted
            );
        } else if aggregate.ai_role == AI_ROLE_NONE {
            aggregate.ai_role = ai_role;
        }
        if automation_mode > aggregate.automation_mode {
            aggregate.automation_mode = automation_mode;
        }
        if !is_zero_hash(&aggregate.model_version_hash) && !is_zero_hash(&model_version_hash) {
            require!(
                aggregate.model_version_hash == model_version_hash,
                OmegaXProtocolError::AutomationNotPermitted
            );
        } else if is_zero_hash(&aggregate.model_version_hash) && !is_zero_hash(&model_version_hash)
        {
            aggregate.model_version_hash = model_version_hash;
        }
        if !is_zero_hash(&aggregate.policy_version_hash) && !is_zero_hash(&policy_version_hash) {
            require!(
                aggregate.policy_version_hash == policy_version_hash,
                OmegaXProtocolError::AutomationNotPermitted
            );
        } else if is_zero_hash(&aggregate.policy_version_hash)
            && !is_zero_hash(&policy_version_hash)
        {
            aggregate.policy_version_hash = policy_version_hash;
        }
        if !is_zero_hash(&aggregate.execution_environment_hash)
            && !is_zero_hash(&execution_environment_hash)
        {
            require!(
                aggregate.execution_environment_hash == execution_environment_hash,
                OmegaXProtocolError::AutomationNotPermitted
            );
        } else if is_zero_hash(&aggregate.execution_environment_hash)
            && !is_zero_hash(&execution_environment_hash)
        {
            aggregate.execution_environment_hash = execution_environment_hash;
        }
        if !is_zero_hash(&aggregate.attestation_provider_ref_hash)
            && !is_zero_hash(&attestation_provider_ref_hash)
        {
            require!(
                aggregate.attestation_provider_ref_hash == attestation_provider_ref_hash,
                OmegaXProtocolError::AutomationNotPermitted
            );
        } else if is_zero_hash(&aggregate.attestation_provider_ref_hash)
            && !is_zero_hash(&attestation_provider_ref_hash)
        {
            aggregate.attestation_provider_ref_hash = attestation_provider_ref_hash;
        }
    }
    require!(
        !aggregate.finalized,
        OmegaXProtocolError::OutcomeAlreadyFinalized
    );
    let total_votes_before = aggregate
        .pass_votes
        .checked_add(aggregate.fail_votes)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    require!(
        total_votes_before < u16::from(aggregate.quorum_n),
        OmegaXProtocolError::OracleVoteWindowClosed
    );

    if passed {
        aggregate.pass_votes = aggregate
            .pass_votes
            .checked_add(1)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
    } else {
        aggregate.fail_votes = aggregate
            .fail_votes
            .checked_add(1)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
    }

    if as_of_ts > aggregate.latest_as_of_ts {
        aggregate.latest_as_of_ts = as_of_ts;
    }

    finalize_if_quorum_reached(aggregate);
    if aggregate.finalized && aggregate.review_status == OUTCOME_REVIEW_STATUS_CLEAR {
        let challenge_window_secs = ctx.accounts.oracle_policy.challenge_window_secs;
        if challenge_window_secs > 0 {
            aggregate.review_status = OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE;
            aggregate.challenge_window_ends_at = as_of_ts
                .checked_add(challenge_window_secs)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
        }
    }
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;
    let reward_liability_amount = reward_claim_liability_amount(
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.accounts.pool.payout_lamports_per_pass,
    )?;
    reserve_reward_liability_if_needed(
        aggregate,
        &mut ctx.accounts.pool_treasury_reserve,
        reward_liability_amount,
    )?;
    emit!(OutcomeAttestationSubmittedEvent {
        pool: ctx.accounts.pool.key(),
        member,
        oracle: ctx.accounts.oracle.key(),
        cycle_hash,
        rule_hash,
        passed,
        evidence_hash,
        external_attestation_ref_hash,
        ai_role,
        automation_mode,
        model_version_hash,
        policy_version_hash,
        execution_environment_hash,
        attestation_provider_ref_hash,
    });
    Ok(())
}

pub fn finalize_cycle_outcome(ctx: Context<FinalizeCycleOutcome>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.pool_terms.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::AccountPoolMismatch
    );
    finalize_if_quorum_reached(&mut ctx.accounts.aggregate);
    if ctx.accounts.aggregate.finalized
        && ctx.accounts.aggregate.review_status == OUTCOME_REVIEW_STATUS_CLEAR
        && ctx.accounts.oracle_policy.challenge_window_secs > 0
    {
        ctx.accounts.aggregate.review_status = OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE;
        ctx.accounts.aggregate.challenge_window_ends_at = ctx
            .accounts
            .aggregate
            .latest_as_of_ts
            .checked_add(ctx.accounts.oracle_policy.challenge_window_secs)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
    }
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;
    let reward_liability_amount = reward_claim_liability_amount(
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.accounts.pool.payout_lamports_per_pass,
    )?;
    reserve_reward_liability_if_needed(
        &mut ctx.accounts.aggregate,
        &mut ctx.accounts.pool_treasury_reserve,
        reward_liability_amount,
    )?;
    require!(
        ctx.accounts.aggregate.finalized,
        OmegaXProtocolError::OracleQuorumNotMet
    );
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn submit_reward_claim(
    ctx: Context<SubmitRewardClaim>,
    member: Pubkey,
    cycle_hash: [u8; 32],
    rule_hash: [u8; 32],
    intent_hash: [u8; 32],
    payout_amount: u64,
    recipient: Pubkey,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_pool_not_closed(&ctx.accounts.pool)?;
    let pool_key = ctx.accounts.pool.key();
    let base_payout_amount = ctx.accounts.pool.payout_lamports_per_pass;
    let mut redistribution_amount = 0u64;
    let mut maybe_updated_cohort_root: Option<CohortSettlementRoot> = None;

    require!(payout_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.membership.member == member,
        OmegaXProtocolError::MembershipMemberMismatch
    );
    require!(
        ctx.accounts.membership.status == MEMBERSHIP_STATUS_ACTIVE,
        OmegaXProtocolError::MembershipNotActive
    );
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;
    let now = Clock::get()?.unix_timestamp;
    ensure_outcome_claimable(&mut ctx.accounts.aggregate, now)?;

    require!(
        ctx.accounts.aggregate.finalized,
        OmegaXProtocolError::OracleQuorumNotMet
    );
    require!(
        ctx.accounts.aggregate.passed,
        OmegaXProtocolError::OutcomeDidNotPass
    );
    require!(
        !ctx.accounts.aggregate.claimed,
        OmegaXProtocolError::AlreadyClaimed
    );
    require!(
        ctx.accounts.aggregate.cycle_hash == cycle_hash,
        OmegaXProtocolError::CycleHashMismatch
    );
    require!(
        ctx.accounts.aggregate.rule_hash == rule_hash,
        OmegaXProtocolError::RuleHashMismatch
    );
    require!(
        ctx.accounts.aggregate.series_ref_hash == ctx.accounts.claim_record.series_ref_hash
            || ctx.accounts.claim_record.pool == ZERO_PUBKEY,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );

    if let Some(member_cycle) = deserialize_optional_program_account::<MemberCycleState>(
        &ctx.accounts.member_cycle.to_account_info(),
    )? {
        require!(
            hash_utf8_string_to_32(&ctx.accounts.member_cycle.key().to_string()) == cycle_hash,
            OmegaXProtocolError::CycleHashMismatch
        );
        require_keys_eq!(
            member_cycle.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require!(
            member_cycle.member == member,
            OmegaXProtocolError::MembershipMemberMismatch
        );
        require!(
            member_cycle.series_ref_hash == ctx.accounts.aggregate.series_ref_hash,
            OmegaXProtocolError::PolicySeriesIdMismatch
        );
        if member_cycle_uses_health_alpha_outcome(&member_cycle) {
            require!(member_cycle.passed, OmegaXProtocolError::OutcomeDidNotPass);
            let mut cohort_root = deserialize_optional_program_account::<CohortSettlementRoot>(
                &ctx.accounts.cohort_settlement_root.to_account_info(),
            )?
            .ok_or(OmegaXProtocolError::InvalidCohortSettlementRoot)?;
            require_cohort_settlement_root_matches_cycle(
                &cohort_root,
                pool_key,
                ctx.accounts.pool_terms.payout_asset_mint,
                &member_cycle,
            )?;
            require!(
                cohort_root.finalized,
                OmegaXProtocolError::CohortSettlementNotFinalized
            );
            redistribution_amount =
                compute_member_redistribution_share(&cohort_root, &member_cycle)?;
            cohort_root.successful_claim_count = cohort_root
                .successful_claim_count
                .checked_add(1)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
            require!(
                cohort_root.successful_claim_count <= cohort_root.successful_member_count,
                OmegaXProtocolError::CohortClaimCountExceeded
            );
            cohort_root.redistribution_claimed_amount = cohort_root
                .redistribution_claimed_amount
                .checked_add(redistribution_amount)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
            require!(
                cohort_root.redistribution_claimed_amount
                    <= cohort_root.redistributable_failed_bonds_total,
                OmegaXProtocolError::RedistributionAmountMismatch
            );
            maybe_updated_cohort_root = Some(cohort_root);
        }
    }
    let expected_payout_amount = base_payout_amount
        .checked_add(redistribution_amount)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    require!(
        payout_amount == expected_payout_amount,
        OmegaXProtocolError::PayoutAmountMismatch
    );

    authorize_claim_signer(
        ctx.accounts.claimant.key(),
        pool_key,
        member,
        ctx.accounts.oracle_policy.allow_delegate_claim,
        ctx.accounts
            .claim_delegate
            .as_deref()
            .map(|account| account.as_ref()),
    )?;
    assert_action_compliant(
        ctx.accounts
            .pool_compliance_policy
            .as_ref()
            .map(|policy| policy.as_ref().as_ref()),
        pool_key,
        COMPLIANCE_ACTION_PAYOUT,
        ctx.accounts.claimant.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        Some(ctx.accounts.membership.subject_commitment),
        ctx.accounts.pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE,
    )?;
    let reward_liability_amount = reward_claim_liability_amount(
        ctx.accounts.pool_terms.payout_asset_mint,
        base_payout_amount,
    )?;
    release_reward_liability_if_needed(
        &mut ctx.accounts.aggregate,
        &mut ctx.accounts.pool_treasury_reserve,
        reward_liability_amount,
    )?;
    if redistribution_amount > 0 {
        ctx.accounts
            .pool_treasury_reserve
            .reserved_redistribution_amount = ctx
            .accounts
            .pool_treasury_reserve
            .reserved_redistribution_amount
            .checked_sub(redistribution_amount)
            .ok_or(OmegaXProtocolError::InsufficientReservedRedistributionBalance)?;
        touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;
    }

    if ctx.accounts.pool_terms.payout_asset_mint == ZERO_PUBKEY {
        require!(
            recipient == ctx.accounts.recipient_system_account.key(),
            OmegaXProtocolError::RecipientMismatch
        );
        transfer_sol_reward(&ctx, payout_amount)?;
        let claim_receipt_rent_lamports =
            reward_claim_receipt_rent_lamports(ctx.accounts.pool_terms.payout_asset_mint)?;
        if claim_receipt_rent_lamports > 0 {
            transfer_program_owned_lamports(
                &ctx.accounts.pool.to_account_info(),
                &ctx.accounts.claimant.to_account_info(),
                claim_receipt_rent_lamports,
            )?;
        }
    } else {
        let asset_vault = ctx
            .accounts
            .pool_asset_vault
            .as_ref()
            .ok_or(OmegaXProtocolError::MissingAssetVault)?;
        let pool_vault_token_account = ctx
            .accounts
            .pool_vault_token_account
            .as_ref()
            .ok_or(OmegaXProtocolError::MissingTokenAccount)?;
        let recipient_token_account = ctx
            .accounts
            .recipient_token_account
            .as_ref()
            .ok_or(OmegaXProtocolError::MissingTokenAccount)?;
        require_keys_eq!(
            asset_vault.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require_keys_eq!(
            asset_vault.payout_mint,
            ctx.accounts.pool_terms.payout_asset_mint,
            OmegaXProtocolError::PayoutMintMismatch
        );
        require!(
            recipient_token_account.owner == recipient,
            OmegaXProtocolError::RecipientMismatch
        );

        transfer_spl_reward(
            asset_vault,
            pool_vault_token_account,
            recipient_token_account,
            &ctx.accounts.token_program,
            payout_amount,
        )?;
    }

    ctx.accounts.aggregate.claimed = true;
    if let Some(cohort_root) = maybe_updated_cohort_root.as_ref() {
        serialize_program_account(
            &ctx.accounts.cohort_settlement_root.to_account_info(),
            cohort_root,
        )?;
    }

    let record = &mut ctx.accounts.claim_record;
    record.pool = ctx.accounts.pool.key();
    record.series_ref_hash = ctx.accounts.aggregate.series_ref_hash;
    record.member = member;
    record.claimant = ctx.accounts.claimant.key();
    record.cycle_hash = cycle_hash;
    record.rule_hash = rule_hash;
    record.intent_hash = intent_hash;
    record.payout_mint = ctx.accounts.pool_terms.payout_asset_mint;
    record.payout_amount = payout_amount;
    record.recipient = recipient;
    record.submitted_at = Clock::get()?.unix_timestamp;
    record.bump = ctx.bumps.claim_record;

    emit!(RewardClaimSubmittedEvent {
        pool: pool_key,
        member,
        claimant: ctx.accounts.claimant.key(),
        cycle_hash,
        rule_hash,
        payout_mint: ctx.accounts.pool_terms.payout_asset_mint,
        payout_amount,
        recipient,
    });
    Ok(())
}

pub fn open_cycle_outcome_dispute(
    ctx: Context<OpenCycleOutcomeDispute>,
    dispute_reason_hash: [u8; 32],
) -> Result<()> {
    let signer = ctx.accounts.authority.key();
    require!(
        signer == ctx.accounts.pool.authority
            || signer == ctx.accounts.config.governance_authority
            || (ctx.accounts.config.emergency_paused && signer == ctx.accounts.config.admin),
        OmegaXProtocolError::GovernanceUnauthorized
    );
    let now = Clock::get()?.unix_timestamp;
    validate_outcome_dispute_openable(&ctx.accounts.aggregate, now)?;

    ctx.accounts.aggregate.review_status = OUTCOME_REVIEW_STATUS_CHALLENGED;
    ctx.accounts.aggregate.dispute_reason_hash = dispute_reason_hash;
    ctx.accounts.aggregate.disputed_by = signer;
    ctx.accounts.aggregate.resolved_by = ZERO_PUBKEY;
    ctx.accounts.aggregate.resolved_at = 0;

    emit!(OutcomeReviewStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        member: ctx.accounts.aggregate.member,
        cycle_hash: ctx.accounts.aggregate.cycle_hash,
        rule_hash: ctx.accounts.aggregate.rule_hash,
        review_status: OUTCOME_REVIEW_STATUS_CHALLENGED,
        challenge_window_ends_at: ctx.accounts.aggregate.challenge_window_ends_at,
        dispute_reason_hash,
        acted_by: signer,
    });
    Ok(())
}

pub fn resolve_cycle_outcome_dispute(
    ctx: Context<ResolveCycleOutcomeDispute>,
    sustain_original_outcome: bool,
) -> Result<()> {
    assert_governance_signer(
        &ctx.accounts.config,
        ctx.accounts.governance_authority.key(),
    )?;
    require!(
        ctx.accounts.aggregate.review_status == OUTCOME_REVIEW_STATUS_CHALLENGED,
        OmegaXProtocolError::OutcomeDisputeNotOpen
    );

    let review_status = if sustain_original_outcome {
        OUTCOME_REVIEW_STATUS_CLEAR
    } else {
        let reward_liability_amount = reward_claim_liability_amount(
            ctx.accounts.pool_terms.payout_asset_mint,
            ctx.accounts.pool.payout_lamports_per_pass,
        )?;
        release_reward_liability_if_needed(
            &mut ctx.accounts.aggregate,
            &mut ctx.accounts.pool_treasury_reserve,
            reward_liability_amount,
        )?;
        ctx.accounts.aggregate.passed = false;
        OUTCOME_REVIEW_STATUS_OVERTURNED
    };

    ctx.accounts.aggregate.review_status = review_status;
    ctx.accounts.aggregate.resolved_by = ctx.accounts.governance_authority.key();
    ctx.accounts.aggregate.resolved_at = Clock::get()?.unix_timestamp;

    emit!(OutcomeReviewStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        member: ctx.accounts.aggregate.member,
        cycle_hash: ctx.accounts.aggregate.cycle_hash,
        rule_hash: ctx.accounts.aggregate.rule_hash,
        review_status,
        challenge_window_ends_at: ctx.accounts.aggregate.challenge_window_ends_at,
        dispute_reason_hash: ctx.accounts.aggregate.dispute_reason_hash,
        acted_by: ctx.accounts.governance_authority.key(),
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_automation_policy() -> PoolAutomationPolicy {
        PoolAutomationPolicy {
            pool: Pubkey::new_unique(),
            oracle_automation_mode: AUTOMATION_MODE_ATTESTED,
            claim_automation_mode: AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
            allowed_ai_roles_mask: AI_ROLE_ALL_MASK,
            max_auto_claim_amount: 500,
            required_attestation_provider_ref_hash: [9; 32],
            updated_by: Pubkey::new_unique(),
            updated_at: 0,
            bump: 1,
        }
    }

    fn sample_aggregate() -> CycleOutcomeAggregate {
        CycleOutcomeAggregate {
            pool: Pubkey::new_unique(),
            series_ref_hash: [10; 32],
            member: Pubkey::new_unique(),
            cycle_hash: [1; 32],
            rule_hash: [2; 32],
            pass_votes: 2,
            fail_votes: 0,
            quorum_m: 2,
            quorum_n: 3,
            finalized: true,
            passed: true,
            claimed: false,
            reward_liability_reserved: true,
            evidence_hash: [3; 32],
            external_attestation_ref_hash: [4; 32],
            review_status: OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE,
            challenge_window_ends_at: 100,
            dispute_reason_hash: ZERO_PUBKEY_BYTES,
            disputed_by: ZERO_PUBKEY,
            resolved_by: ZERO_PUBKEY,
            resolved_at: 0,
            ai_role: AI_ROLE_ORACLE,
            automation_mode: AUTOMATION_MODE_ATTESTED,
            model_version_hash: [5; 32],
            policy_version_hash: [6; 32],
            execution_environment_hash: [7; 32],
            attestation_provider_ref_hash: [8; 32],
            latest_as_of_ts: 10,
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
    fn attestation_automation_rejects_missing_policy_and_provider_mismatch() {
        let error = validate_attestation_automation(
            None,
            AI_ROLE_ORACLE,
            AUTOMATION_MODE_ATTESTED,
            ZERO_PUBKEY_BYTES,
        )
        .unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::AutomationNotPermitted)
        );

        let policy = sample_automation_policy();
        let error = validate_attestation_automation(
            Some(&policy),
            AI_ROLE_ORACLE,
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
    fn attestation_automation_accepts_allowed_ai_role_and_provider_binding() {
        let policy = sample_automation_policy();
        validate_attestation_automation(
            Some(&policy),
            AI_ROLE_ORACLE,
            AUTOMATION_MODE_ATTESTED,
            policy.required_attestation_provider_ref_hash,
        )
        .unwrap();
    }

    #[test]
    fn outcome_dispute_openable_respects_window_and_existing_state() {
        let aggregate = sample_aggregate();
        validate_outcome_dispute_openable(&aggregate, 100).unwrap();

        let mut stale = sample_aggregate();
        let error = validate_outcome_dispute_openable(&stale, 101).unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::OutcomeDisputeWindowClosed)
        );

        stale.review_status = OUTCOME_REVIEW_STATUS_CHALLENGED;
        let error = validate_outcome_dispute_openable(&stale, 100).unwrap_err();
        assert_eq!(
            error_code(error),
            omega_error_code(OmegaXProtocolError::OutcomeDisputeAlreadyOpen)
        );
    }
}
