// SPDX-License-Identifier: AGPL-3.0-or-later

//! Quote-driven cycle activation handlers for SOL and SPL payment flows.

use super::*;

pub fn activate_cycle_with_quote_sol(
    ctx: Context<ActivateCycleWithQuoteSol>,
    series_ref_hash: [u8; 32],
    period_index: u64,
    nonce_hash: [u8; 32],
    premium_amount_raw: u64,
    canonical_premium_amount: u64,
    commitment_enabled: bool,
    bond_amount_raw: u64,
    shield_fee_raw: u64,
    protocol_fee_raw: u64,
    oracle_fee_raw: u64,
    net_pool_premium_raw: u64,
    total_amount_raw: u64,
    included_shield_count: u8,
    threshold_bps: u16,
    outcome_threshold_score: u16,
    cohort_hash: [u8; 32],
    expires_at_ts: i64,
    quote_meta_hash: [u8; 32],
) -> Result<()> {
    let subject = &ctx.accounts.subject;
    let pool = &subject.pool;
    let member = &subject.member;
    let oracle = &subject.oracle;
    let pool_key = pool.key();
    let member_key = member.key();
    let oracle_key = oracle.key();
    let (_, protocol_fee_vault_bump) =
        Pubkey::find_program_address(&[SEED_PROTOCOL_FEE_VAULT, &ZERO_PUBKEY_BYTES], &crate::ID);
    let (_, pool_oracle_fee_vault_bump) = Pubkey::find_program_address(
        &[
            SEED_POOL_ORACLE_FEE_VAULT,
            pool_key.as_ref(),
            oracle_key.as_ref(),
            &ZERO_PUBKEY_BYTES,
        ],
        &crate::ID,
    );
    let (_, pool_treasury_reserve_bump) = Pubkey::find_program_address(
        &[
            SEED_POOL_TREASURY_RESERVE,
            pool_key.as_ref(),
            &ZERO_PUBKEY_BYTES,
        ],
        &crate::ID,
    );

    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_pool_not_closed(pool)?;
    require!(
        subject.oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_keys_eq!(
        member_key,
        ctx.accounts.payer.key(),
        OmegaXProtocolError::MemberPayerMismatch
    );
    require_pool_oracle_permission(
        pool_key,
        oracle_key,
        &subject.pool_oracle,
        &subject.pool_oracle_permissions,
        ORACLE_PERMISSION_QUOTE,
    )?;
    require!(
        ctx.accounts.policy_series_payment_option.active,
        OmegaXProtocolError::PolicySeriesPaymentOptionInactive
    );
    require_keys_eq!(
        ctx.accounts.policy_series_payment_option.pool,
        pool_key,
        OmegaXProtocolError::AccountPoolMismatch
    );
    require!(
        ctx.accounts.policy_series_payment_option.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require!(
        ctx.accounts.policy_series_payment_option.payment_mint == ZERO_PUBKEY,
        OmegaXProtocolError::PolicySeriesPaymentOptionInvalid
    );
    require_policy_series_active(&ctx.accounts.policy_series)?;
    require_policy_series_allows_reward(&ctx.accounts.policy_series)?;
    require!(premium_amount_raw > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        premium_amount_raw <= ctx.accounts.policy_series_payment_option.payment_amount,
        OmegaXProtocolError::QuoteAmountExceedsConfiguredBase
    );
    require!(
        canonical_premium_amount == ctx.accounts.policy_series.premium_amount,
        OmegaXProtocolError::InvalidCycleQuote
    );
    if commitment_enabled {
        let uses_bps_threshold = threshold_bps > 0;
        let uses_health_alpha_outcome = outcome_threshold_score > 0;
        require!(bond_amount_raw > 0, OmegaXProtocolError::InvalidCycleQuote);
        require!(
            uses_bps_threshold ^ uses_health_alpha_outcome,
            OmegaXProtocolError::InvalidCycleQuote
        );
        require!(
            included_shield_count <= 1,
            OmegaXProtocolError::InvalidCycleQuote
        );
        require!(
            !(shield_fee_raw > 0 && included_shield_count > 0),
            OmegaXProtocolError::InvalidCycleQuote
        );
        if uses_health_alpha_outcome {
            require!(
                !is_zero_hash(&cohort_hash),
                OmegaXProtocolError::InvalidCycleQuote
            );
        } else {
            require!(
                is_zero_hash(&cohort_hash) && outcome_threshold_score == 0,
                OmegaXProtocolError::InvalidCycleQuote
            );
        }
    } else {
        require!(
            bond_amount_raw == 0
                && shield_fee_raw == 0
                && included_shield_count == 0
                && threshold_bps == 0
                && outcome_threshold_score == 0
                && is_zero_hash(&cohort_hash),
            OmegaXProtocolError::InvalidCycleQuote
        );
    }

    let now = Clock::get()?.unix_timestamp;
    require!(now <= expires_at_ts, OmegaXProtocolError::QuoteExpired);
    let fee_breakdown = compute_cycle_fee_breakdown(
        &ctx.accounts.config,
        &subject.oracle_policy,
        premium_amount_raw,
        bond_amount_raw,
        shield_fee_raw,
    )?;
    require_cycle_fee_breakdown_matches(
        &fee_breakdown,
        protocol_fee_raw,
        oracle_fee_raw,
        net_pool_premium_raw,
        total_amount_raw,
    )?;

    let quote_fields = CycleQuoteFields {
        pool: pool_key,
        member: member_key,
        series_ref_hash,
        payment_mint: ZERO_PUBKEY,
        premium_amount_raw,
        canonical_premium_amount,
        period_index,
        commitment_enabled,
        bond_amount_raw,
        shield_fee_raw,
        protocol_fee_raw,
        oracle_fee_raw,
        net_pool_premium_raw,
        total_amount_raw,
        included_shield_count,
        threshold_bps,
        outcome_threshold_score,
        cohort_hash,
        expires_at_ts,
        nonce_hash,
        quote_meta_hash,
    };
    let quote_hash = cycle_quote_hash(&quote_fields);
    let quote_signature_message = cycle_quote_signature_message(&quote_hash);
    let instructions_sysvar = ctx
        .remaining_accounts
        .first()
        .ok_or(OmegaXProtocolError::InvalidInstructionSysvar)?;
    verify_quote_signature(instructions_sysvar, oracle_key, &quote_signature_message)?;

    validate_premium_period(
        &ctx.accounts.premium_ledger,
        pool_key,
        series_ref_hash,
        member_key,
        period_index,
    )?;

    if ctx.accounts.membership.pool != ZERO_PUBKEY {
        require_keys_eq!(
            ctx.accounts.membership.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require!(
            ctx.accounts.membership.member == member_key,
            OmegaXProtocolError::MembershipMemberMismatch
        );
    }
    write_membership(
        &mut ctx.accounts.membership,
        pool_key,
        member_key,
        derive_membership_subject_commitment(pool_key, member_key),
        ctx.bumps.membership,
    )?;

    if ctx.accounts.policy_position.pool == ZERO_PUBKEY
        || now > ctx.accounts.policy_position.ends_at
    {
        let ends_at = now
            .checked_add(ctx.accounts.policy_series.duration_secs)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
        write_policy_position(
            &mut ctx.accounts.policy_position,
            &mut ctx.accounts.policy_position_nft,
            pool_key,
            member_key,
            series_ref_hash,
            ctx.accounts.policy_series.terms_hash,
            now,
            ends_at,
            ctx.accounts.policy_series.premium_due_every_secs,
            ctx.accounts.policy_series.premium_grace_secs,
            ctx.bumps.policy_position,
            ctx.bumps.policy_position_nft,
        )?;
    } else {
        validate_policy_series_matches_policy(
            &ctx.accounts.policy_series,
            &ctx.accounts.policy_position,
            pool_key,
        )?;
        require!(
            ctx.accounts.policy_position.member == member_key,
            OmegaXProtocolError::MembershipMemberMismatch
        );
        require_coverage_active(&ctx.accounts.policy_position, now)?;
    }

    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        ZERO_PUBKEY,
        pool_treasury_reserve_bump,
    )?;
    upsert_protocol_fee_vault(
        &mut ctx.accounts.protocol_fee_vault,
        ZERO_PUBKEY,
        protocol_fee_vault_bump,
    );
    upsert_pool_oracle_fee_vault(
        &mut ctx.accounts.pool_oracle_fee_vault,
        pool_key,
        oracle_key,
        ZERO_PUBKEY,
        pool_oracle_fee_vault_bump,
    );

    if fee_breakdown.pool_treasury_amount_raw > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            SystemTransfer {
                from: ctx.accounts.payer.to_account_info(),
                to: pool.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, fee_breakdown.pool_treasury_amount_raw)?;
    }
    if protocol_fee_raw > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            SystemTransfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.protocol_fee_vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, protocol_fee_raw)?;
    }
    if oracle_fee_raw > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            SystemTransfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.pool_oracle_fee_vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, oracle_fee_raw)?;
    }

    ctx.accounts.pool_treasury_reserve.reserved_refund_amount = ctx
        .accounts
        .pool_treasury_reserve
        .reserved_refund_amount
        .checked_add(bond_amount_raw)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;

    let member_cycle = &mut ctx.accounts.member_cycle;
    member_cycle.pool = pool_key;
    member_cycle.member = member_key;
    member_cycle.series_ref_hash = series_ref_hash;
    member_cycle.period_index = period_index;
    member_cycle.payment_mint = ZERO_PUBKEY;
    member_cycle.premium_amount_raw = premium_amount_raw;
    member_cycle.bond_amount_raw = bond_amount_raw;
    member_cycle.shield_fee_raw = shield_fee_raw;
    member_cycle.protocol_fee_raw = protocol_fee_raw;
    member_cycle.oracle_fee_raw = oracle_fee_raw;
    member_cycle.net_pool_premium_raw = net_pool_premium_raw;
    member_cycle.total_amount_raw = total_amount_raw;
    member_cycle.canonical_premium_amount = canonical_premium_amount;
    member_cycle.commitment_enabled = commitment_enabled;
    member_cycle.threshold_bps = threshold_bps;
    member_cycle.outcome_threshold_score = outcome_threshold_score;
    member_cycle.cohort_hash = cohort_hash;
    member_cycle.settled_health_alpha_score = 0;
    member_cycle.included_shield_count = included_shield_count;
    member_cycle.shield_consumed = false;
    member_cycle.status = MEMBER_CYCLE_STATUS_ACTIVE;
    member_cycle.passed = false;
    member_cycle.activated_at = now;
    member_cycle.settled_at = 0;
    member_cycle.quote_hash = quote_hash;
    member_cycle.bump = ctx.bumps.member_cycle;

    let replay = &mut ctx.accounts.cycle_quote_replay;
    replay.pool = pool_key;
    replay.series_ref_hash = series_ref_hash;
    replay.member = member_key;
    replay.nonce_hash = nonce_hash;
    replay.quote_hash = quote_hash;
    replay.created_at = now;
    replay.bump = ctx.bumps.cycle_quote_replay;

    write_premium_ledger(
        &mut ctx.accounts.premium_ledger,
        PremiumLedgerWrite {
            pool: pool_key,
            series_ref_hash,
            member: member_key,
            period_index,
            amount: canonical_premium_amount,
            source: PREMIUM_SOURCE_ONCHAIN,
            paid_at: now,
            bump: ctx.bumps.premium_ledger,
        },
    );
    advance_policy_premium(&mut ctx.accounts.policy_position, now)?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn activate_cycle_with_quote_spl(
    ctx: Context<ActivateCycleWithQuoteSpl>,
    series_ref_hash: [u8; 32],
    period_index: u64,
    nonce_hash: [u8; 32],
    premium_amount_raw: u64,
    canonical_premium_amount: u64,
    commitment_enabled: bool,
    bond_amount_raw: u64,
    shield_fee_raw: u64,
    protocol_fee_raw: u64,
    oracle_fee_raw: u64,
    net_pool_premium_raw: u64,
    total_amount_raw: u64,
    included_shield_count: u8,
    threshold_bps: u16,
    outcome_threshold_score: u16,
    cohort_hash: [u8; 32],
    expires_at_ts: i64,
    quote_meta_hash: [u8; 32],
) -> Result<()> {
    let subject = &ctx.accounts.subject;
    let pool = &subject.pool;
    let member = &subject.member;
    let oracle = &subject.oracle;
    let oracle_entry = &subject.oracle_entry;
    let pool_oracle = &subject.pool_oracle;
    let pool_oracle_permissions = &subject.pool_oracle_permissions;
    let payment_mint = &ctx.accounts.payment_mint;
    let pool_key = pool.key();
    let member_key = member.key();
    let oracle_key = oracle.key();
    let payment_mint_key = payment_mint.key();
    let (_, protocol_fee_vault_bump) = Pubkey::find_program_address(
        &[SEED_PROTOCOL_FEE_VAULT, payment_mint_key.as_ref()],
        &crate::ID,
    );
    let (_, pool_oracle_fee_vault_bump) = Pubkey::find_program_address(
        &[
            SEED_POOL_ORACLE_FEE_VAULT,
            pool_key.as_ref(),
            oracle_key.as_ref(),
            payment_mint_key.as_ref(),
        ],
        &crate::ID,
    );
    let (_, pool_treasury_reserve_bump) = Pubkey::find_program_address(
        &[
            SEED_POOL_TREASURY_RESERVE,
            pool_key.as_ref(),
            payment_mint_key.as_ref(),
        ],
        &crate::ID,
    );
    let (_, pool_asset_vault_bump) = Pubkey::find_program_address(
        &[
            SEED_POOL_ASSET_VAULT,
            pool_key.as_ref(),
            payment_mint_key.as_ref(),
        ],
        &crate::ID,
    );

    assert_protocol_not_paused(&ctx.accounts.config)?;
    assert_pool_not_closed(pool)?;
    let policy_series = {
        let data = ctx.accounts.policy_series.try_borrow_data()?;
        let mut data_slice: &[u8] = &data;
        PolicySeries::try_deserialize(&mut data_slice)?
    };
    let policy_series_payment_option = {
        let data = ctx
            .accounts
            .policy_series_payment_option
            .try_borrow_data()?;
        let mut data_slice: &[u8] = &data;
        PolicySeriesPaymentOption::try_deserialize(&mut data_slice)?
    };
    require!(
        oracle_entry.active,
        OmegaXProtocolError::OracleRegistryNotActive
    );
    require_keys_eq!(
        member_key,
        ctx.accounts.payer.key(),
        OmegaXProtocolError::MemberPayerMismatch
    );
    require_pool_oracle_permission(
        pool_key,
        oracle_key,
        pool_oracle,
        pool_oracle_permissions,
        ORACLE_PERMISSION_QUOTE,
    )?;
    require!(
        policy_series_payment_option.active,
        OmegaXProtocolError::PolicySeriesPaymentOptionInactive
    );
    require_keys_eq!(
        policy_series_payment_option.pool,
        pool_key,
        OmegaXProtocolError::AccountPoolMismatch
    );
    require!(
        policy_series_payment_option.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require_keys_eq!(
        policy_series_payment_option.payment_mint,
        payment_mint_key,
        OmegaXProtocolError::PayoutMintMismatch
    );
    require_policy_series_active(&policy_series)?;
    require_policy_series_allows_reward(&policy_series)?;
    require!(premium_amount_raw > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        premium_amount_raw <= policy_series_payment_option.payment_amount,
        OmegaXProtocolError::QuoteAmountExceedsConfiguredBase
    );
    require!(
        canonical_premium_amount == policy_series.premium_amount,
        OmegaXProtocolError::InvalidCycleQuote
    );
    if commitment_enabled {
        let uses_bps_threshold = threshold_bps > 0;
        let uses_health_alpha_outcome = outcome_threshold_score > 0;
        require!(bond_amount_raw > 0, OmegaXProtocolError::InvalidCycleQuote);
        require!(
            uses_bps_threshold ^ uses_health_alpha_outcome,
            OmegaXProtocolError::InvalidCycleQuote
        );
        require!(
            included_shield_count <= 1,
            OmegaXProtocolError::InvalidCycleQuote
        );
        require!(
            !(shield_fee_raw > 0 && included_shield_count > 0),
            OmegaXProtocolError::InvalidCycleQuote
        );
        if uses_health_alpha_outcome {
            require!(
                !is_zero_hash(&cohort_hash),
                OmegaXProtocolError::InvalidCycleQuote
            );
        } else {
            require!(
                is_zero_hash(&cohort_hash) && outcome_threshold_score == 0,
                OmegaXProtocolError::InvalidCycleQuote
            );
        }
    } else {
        require!(
            bond_amount_raw == 0
                && shield_fee_raw == 0
                && included_shield_count == 0
                && threshold_bps == 0
                && outcome_threshold_score == 0
                && is_zero_hash(&cohort_hash),
            OmegaXProtocolError::InvalidCycleQuote
        );
    }

    let now = Clock::get()?.unix_timestamp;
    require!(now <= expires_at_ts, OmegaXProtocolError::QuoteExpired);
    let fee_breakdown = compute_cycle_fee_breakdown(
        &ctx.accounts.config,
        &ctx.accounts.oracle_policy,
        premium_amount_raw,
        bond_amount_raw,
        shield_fee_raw,
    )?;
    require_cycle_fee_breakdown_matches(
        &fee_breakdown,
        protocol_fee_raw,
        oracle_fee_raw,
        net_pool_premium_raw,
        total_amount_raw,
    )?;

    let quote_fields = CycleQuoteFields {
        pool: pool_key,
        member: member_key,
        series_ref_hash,
        payment_mint: payment_mint_key,
        premium_amount_raw,
        canonical_premium_amount,
        period_index,
        commitment_enabled,
        bond_amount_raw,
        shield_fee_raw,
        protocol_fee_raw,
        oracle_fee_raw,
        net_pool_premium_raw,
        total_amount_raw,
        included_shield_count,
        threshold_bps,
        outcome_threshold_score,
        cohort_hash,
        expires_at_ts,
        nonce_hash,
        quote_meta_hash,
    };
    let quote_hash = cycle_quote_hash(&quote_fields);
    let quote_signature_message = cycle_quote_signature_message(&quote_hash);
    let instructions_sysvar = ctx
        .remaining_accounts
        .first()
        .ok_or(OmegaXProtocolError::InvalidInstructionSysvar)?;
    verify_quote_signature(instructions_sysvar, oracle_key, &quote_signature_message)?;

    validate_premium_period(
        &ctx.accounts.premium_ledger,
        pool_key,
        series_ref_hash,
        member_key,
        period_index,
    )?;

    if ctx.accounts.membership.pool != ZERO_PUBKEY {
        require_keys_eq!(
            ctx.accounts.membership.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require!(
            ctx.accounts.membership.member == member_key,
            OmegaXProtocolError::MembershipMemberMismatch
        );
    }
    write_membership(
        &mut ctx.accounts.membership,
        pool_key,
        member_key,
        derive_membership_subject_commitment(pool_key, member_key),
        ctx.bumps.membership,
    )?;

    if ctx.accounts.policy_position.pool == ZERO_PUBKEY
        || now > ctx.accounts.policy_position.ends_at
    {
        let ends_at = now
            .checked_add(policy_series.duration_secs)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
        write_policy_position(
            &mut ctx.accounts.policy_position,
            &mut ctx.accounts.policy_position_nft,
            pool_key,
            member_key,
            series_ref_hash,
            policy_series.terms_hash,
            now,
            ends_at,
            policy_series.premium_due_every_secs,
            policy_series.premium_grace_secs,
            ctx.bumps.policy_position,
            ctx.bumps.policy_position_nft,
        )?;
    } else {
        validate_policy_series_state_matches_policy(
            &policy_series,
            &ctx.accounts.policy_position,
            pool_key,
        )?;
        require!(
            ctx.accounts.policy_position.member == member_key,
            OmegaXProtocolError::MembershipMemberMismatch
        );
        require_coverage_active(&ctx.accounts.policy_position, now)?;
    }

    let pool_asset_vault_bump_seed = [pool_asset_vault_bump];
    let pool_asset_vault_seeds: &[&[u8]] = &[
        SEED_POOL_ASSET_VAULT,
        pool_key.as_ref(),
        payment_mint_key.as_ref(),
        &pool_asset_vault_bump_seed,
    ];
    ensure_program_account(
        &ctx.accounts.payer,
        &ctx.accounts.pool_asset_vault.to_account_info(),
        pool_asset_vault_seeds,
        PoolAssetVault::space(),
        &ctx.accounts.system_program,
    )?;
    let expected_pool_vault_token_account = associated_token::get_associated_token_address(
        &ctx.accounts.pool_asset_vault.key(),
        &payment_mint_key,
    );
    require_keys_eq!(
        ctx.accounts.pool_vault_token_account.key(),
        expected_pool_vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    ensure_associated_token_account(
        &ctx.accounts.payer,
        &ctx.accounts.pool_vault_token_account.to_account_info(),
        &ctx.accounts.pool_asset_vault.to_account_info(),
        &ctx.accounts.payment_mint.to_account_info(),
        &ctx.accounts.token_program,
        &ctx.accounts.associated_token_program,
        &ctx.accounts.system_program,
    )?;
    write_pool_asset_vault_account(
        &ctx.accounts.pool_asset_vault.to_account_info(),
        pool_key,
        payment_mint_key,
        ctx.accounts.pool_vault_token_account.key(),
        true,
        pool_asset_vault_bump,
    )?;

    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        payment_mint_key,
        pool_treasury_reserve_bump,
    )?;
    let protocol_fee_vault_bump_seed = [protocol_fee_vault_bump];
    let protocol_fee_vault_seeds: &[&[u8]] = &[
        SEED_PROTOCOL_FEE_VAULT,
        payment_mint_key.as_ref(),
        &protocol_fee_vault_bump_seed,
    ];
    ensure_program_account(
        &ctx.accounts.payer,
        &ctx.accounts.protocol_fee_vault.to_account_info(),
        protocol_fee_vault_seeds,
        ProtocolFeeVault::space(),
        &ctx.accounts.system_program,
    )?;
    write_protocol_fee_vault_account(
        &ctx.accounts.protocol_fee_vault.to_account_info(),
        payment_mint_key,
        protocol_fee_vault_bump,
    )?;
    let pool_oracle_fee_vault_bump_seed = [pool_oracle_fee_vault_bump];
    let pool_oracle_fee_vault_seeds: &[&[u8]] = &[
        SEED_POOL_ORACLE_FEE_VAULT,
        pool_key.as_ref(),
        oracle_key.as_ref(),
        payment_mint_key.as_ref(),
        &pool_oracle_fee_vault_bump_seed,
    ];
    ensure_program_account(
        &ctx.accounts.payer,
        &ctx.accounts.pool_oracle_fee_vault.to_account_info(),
        pool_oracle_fee_vault_seeds,
        PoolOracleFeeVault::space(),
        &ctx.accounts.system_program,
    )?;
    write_pool_oracle_fee_vault_account(
        &ctx.accounts.pool_oracle_fee_vault.to_account_info(),
        pool_key,
        oracle_key,
        payment_mint_key,
        pool_oracle_fee_vault_bump,
    )?;
    let expected_protocol_fee_vault_token_account = associated_token::get_associated_token_address(
        &ctx.accounts.protocol_fee_vault.key(),
        &payment_mint_key,
    );
    require_keys_eq!(
        ctx.accounts.protocol_fee_vault_token_account.key(),
        expected_protocol_fee_vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    let expected_pool_oracle_fee_vault_token_account =
        associated_token::get_associated_token_address(
            &ctx.accounts.pool_oracle_fee_vault.key(),
            &payment_mint_key,
        );
    require_keys_eq!(
        ctx.accounts.pool_oracle_fee_vault_token_account.key(),
        expected_pool_oracle_fee_vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    ensure_associated_token_account(
        &ctx.accounts.payer,
        &ctx.accounts
            .protocol_fee_vault_token_account
            .to_account_info(),
        &ctx.accounts.protocol_fee_vault.to_account_info(),
        &ctx.accounts.payment_mint.to_account_info(),
        &ctx.accounts.token_program,
        &ctx.accounts.associated_token_program,
        &ctx.accounts.system_program,
    )?;
    ensure_associated_token_account(
        &ctx.accounts.payer,
        &ctx.accounts
            .pool_oracle_fee_vault_token_account
            .to_account_info(),
        &ctx.accounts.pool_oracle_fee_vault.to_account_info(),
        &ctx.accounts.payment_mint.to_account_info(),
        &ctx.accounts.token_program,
        &ctx.accounts.associated_token_program,
        &ctx.accounts.system_program,
    )?;

    if fee_breakdown.pool_treasury_amount_raw > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx.accounts.pool_vault_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, fee_breakdown.pool_treasury_amount_raw)?;
    }
    if protocol_fee_raw > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx
                    .accounts
                    .protocol_fee_vault_token_account
                    .to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, protocol_fee_raw)?;
    }
    if oracle_fee_raw > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TokenTransfer {
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx
                    .accounts
                    .pool_oracle_fee_vault_token_account
                    .to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, oracle_fee_raw)?;
    }

    ctx.accounts.pool_treasury_reserve.reserved_refund_amount = ctx
        .accounts
        .pool_treasury_reserve
        .reserved_refund_amount
        .checked_add(bond_amount_raw)
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;

    let member_cycle = &mut ctx.accounts.member_cycle;
    member_cycle.pool = pool_key;
    member_cycle.member = member_key;
    member_cycle.series_ref_hash = series_ref_hash;
    member_cycle.period_index = period_index;
    member_cycle.payment_mint = payment_mint_key;
    member_cycle.premium_amount_raw = premium_amount_raw;
    member_cycle.bond_amount_raw = bond_amount_raw;
    member_cycle.shield_fee_raw = shield_fee_raw;
    member_cycle.protocol_fee_raw = protocol_fee_raw;
    member_cycle.oracle_fee_raw = oracle_fee_raw;
    member_cycle.net_pool_premium_raw = net_pool_premium_raw;
    member_cycle.total_amount_raw = total_amount_raw;
    member_cycle.canonical_premium_amount = canonical_premium_amount;
    member_cycle.commitment_enabled = commitment_enabled;
    member_cycle.threshold_bps = threshold_bps;
    member_cycle.outcome_threshold_score = outcome_threshold_score;
    member_cycle.cohort_hash = cohort_hash;
    member_cycle.settled_health_alpha_score = 0;
    member_cycle.included_shield_count = included_shield_count;
    member_cycle.shield_consumed = false;
    member_cycle.status = MEMBER_CYCLE_STATUS_ACTIVE;
    member_cycle.passed = false;
    member_cycle.activated_at = now;
    member_cycle.settled_at = 0;
    member_cycle.quote_hash = quote_hash;
    member_cycle.bump = ctx.bumps.member_cycle;

    let replay = &mut ctx.accounts.cycle_quote_replay;
    replay.pool = pool_key;
    replay.series_ref_hash = series_ref_hash;
    replay.member = member_key;
    replay.nonce_hash = nonce_hash;
    replay.quote_hash = quote_hash;
    replay.created_at = now;
    replay.bump = ctx.bumps.cycle_quote_replay;

    write_premium_ledger(
        &mut ctx.accounts.premium_ledger,
        PremiumLedgerWrite {
            pool: pool_key,
            series_ref_hash,
            member: member_key,
            period_index,
            amount: canonical_premium_amount,
            source: PREMIUM_SOURCE_ONCHAIN,
            paid_at: now,
            bump: ctx.bumps.premium_ledger,
        },
    );
    advance_policy_premium(&mut ctx.accounts.policy_position, now)?;

    Ok(())
}
