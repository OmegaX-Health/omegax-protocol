// SPDX-License-Identifier: AGPL-3.0-or-later

//! Anchor entrypoint surface for the OmegaX on-chain program.

use anchor_lang::prelude::*;

pub mod core_accounts;
pub use core_accounts::*;

pub mod surface;
use surface::*;

declare_id!("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");

const SEED_POOL: &[u8] = b"pool";
const SEED_ORACLE: &[u8] = b"oracle";
const SEED_ORACLE_PROFILE: &[u8] = b"oracle_profile";
const SEED_POOL_ORACLE: &[u8] = b"pool_oracle";
const SEED_MEMBERSHIP: &[u8] = b"membership";
const SEED_POOL_LIQUIDITY_CONFIG: &[u8] = b"pool_liquidity_config";
const SEED_POOL_SHARE_MINT: &[u8] = b"pool_share_mint";

const MAX_PROTOCOL_FEE_BPS: u16 = 10_000;
const MAX_POOL_ID_LEN: usize = 32;
const MAX_ORG_REF_LEN: usize = 64;
const MAX_METADATA_URI_LEN: usize = 160;
const MAX_ORACLE_SUPPORTED_SCHEMAS: usize = 16;
const MAX_ORACLE_DISPLAY_NAME_LEN: usize = 64;
const MAX_ORACLE_LEGAL_NAME_LEN: usize = 64;
const MAX_ORACLE_URL_LEN: usize = 128;
const MAX_ORACLE_LOGO_URI_LEN: usize = 128;
const MAX_ORACLE_WEBHOOK_URL_LEN: usize = 128;
const MAX_COVERAGE_PRODUCT_NAME_LEN: usize = 64;

const MEMBERSHIP_MODE_OPEN: u8 = 0;
const MEMBERSHIP_MODE_TOKEN_GATE: u8 = 1;
const MEMBERSHIP_MODE_INVITE_ONLY: u8 = 2;

const POOL_STATUS_DRAFT: u8 = 0;
const POOL_STATUS_ACTIVE: u8 = 1;
const POOL_STATUS_CLOSED: u8 = 3;

const MEMBERSHIP_STATUS_ACTIVE: u8 = 1;

#[program]
pub mod omegax_protocol {
    use super::*;

    // Pool-oracle approval surface.

    pub fn set_pool_oracle(ctx: Context<SetPoolOracle>, active: bool) -> Result<()> {
        if active {
            require!(
                ctx.accounts.oracle_entry.active,
                OmegaXProtocolError::OracleRegistryNotActive
            );
        }

        let pool_oracle = &mut ctx.accounts.pool_oracle;
        pool_oracle.pool = ctx.accounts.pool.key();
        pool_oracle.oracle = ctx.accounts.oracle_entry.oracle;
        pool_oracle.active = active;
        pool_oracle.bump = ctx.bumps.pool_oracle;

        Ok(())
    }

    // Governance, oracle onboarding, and staking lifecycle.

    /// Registers a rich oracle profile used by the staking and attestation flows.
    #[allow(clippy::too_many_arguments)]
    pub fn register_oracle(
        ctx: Context<RegisterOracle>,
        oracle_pubkey: Pubkey,
        oracle_type: u8,
        display_name: String,
        legal_name: String,
        website_url: String,
        app_url: String,
        logo_uri: String,
        webhook_url: String,
        supported_schema_key_hashes: Vec<[u8; 32]>,
    ) -> Result<()> {
        surface::register_oracle(
            ctx,
            oracle_pubkey,
            oracle_type,
            display_name,
            legal_name,
            website_url,
            app_url,
            logo_uri,
            webhook_url,
            supported_schema_key_hashes,
        )
    }

    pub fn claim_oracle(ctx: Context<ClaimOracle>) -> Result<()> {
        surface::claim_oracle(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_oracle_profile(
        ctx: Context<UpdateOracleProfile>,
        oracle_type: u8,
        display_name: String,
        legal_name: String,
        website_url: String,
        app_url: String,
        logo_uri: String,
        webhook_url: String,
        supported_schema_key_hashes: Vec<[u8; 32]>,
    ) -> Result<()> {
        surface::update_oracle_profile(
            ctx,
            oracle_type,
            display_name,
            legal_name,
            website_url,
            app_url,
            logo_uri,
            webhook_url,
            supported_schema_key_hashes,
        )
    }

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        protocol_fee_bps: u16,
        governance_realm: Pubkey,
        governance_config: Pubkey,
        default_stake_mint: Pubkey,
        min_oracle_stake: u64,
    ) -> Result<()> {
        surface::initialize_protocol(
            ctx,
            protocol_fee_bps,
            governance_realm,
            governance_config,
            default_stake_mint,
            min_oracle_stake,
        )
    }

    pub fn rotate_governance_authority(
        ctx: Context<RotateGovernanceAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        surface::rotate_governance_authority(ctx, new_authority)
    }

    pub fn update_oracle_metadata(
        ctx: Context<UpdateOracleMetadata>,
        metadata_uri: String,
        active: bool,
    ) -> Result<()> {
        surface::update_oracle_metadata(ctx, metadata_uri, active)
    }

    pub fn stake_oracle(ctx: Context<StakeOracle>, amount: u64) -> Result<()> {
        surface::stake_oracle(ctx, amount)
    }

    pub fn request_unstake(
        ctx: Context<RequestUnstake>,
        amount: u64,
        cooldown_seconds: i64,
    ) -> Result<()> {
        surface::request_unstake(ctx, amount, cooldown_seconds)
    }

    pub fn finalize_unstake(ctx: Context<FinalizeUnstake>) -> Result<()> {
        surface::finalize_unstake(ctx)
    }

    pub fn slash_oracle(ctx: Context<SlashOracle>, amount: u64) -> Result<()> {
        surface::slash_oracle(ctx, amount)
    }

    // Pool creation, membership, and liquidity lifecycle.

    /// Creates the base pool, terms, and oracle-policy accounts for a new protocol pool.
    #[allow(clippy::too_many_arguments)]
    pub fn create_pool(
        ctx: Context<CreatePool>,
        pool_id: String,
        organization_ref: String,
        payout_lamports_per_pass: u64,
        membership_mode: u8,
        token_gate_mint: Pubkey,
        token_gate_min_balance: u64,
        invite_issuer: Pubkey,
        pool_type: u8,
        payout_asset_mint: Pubkey,
        terms_hash: [u8; 32],
        payout_policy_hash: [u8; 32],
        cycle_mode: u8,
        metadata_uri: String,
    ) -> Result<()> {
        surface::create_pool(
            ctx,
            pool_id,
            organization_ref,
            payout_lamports_per_pass,
            membership_mode,
            token_gate_mint,
            token_gate_min_balance,
            invite_issuer,
            pool_type,
            payout_asset_mint,
            terms_hash,
            payout_policy_hash,
            cycle_mode,
            metadata_uri,
        )
    }

    pub fn set_pool_status(ctx: Context<SetPoolStatus>, status: u8) -> Result<()> {
        surface::set_pool_status(ctx, status)
    }

    pub fn set_protocol_params(
        ctx: Context<SetProtocolParams>,
        protocol_fee_bps: u16,
        allowed_payout_mints_hash: [u8; 32],
        default_stake_mint: Pubkey,
        min_oracle_stake: u64,
        emergency_paused: bool,
    ) -> Result<()> {
        surface::set_protocol_params(
            ctx,
            protocol_fee_bps,
            allowed_payout_mints_hash,
            default_stake_mint,
            min_oracle_stake,
            emergency_paused,
        )
    }

    pub fn set_pool_oracle_policy(
        ctx: Context<SetPoolOraclePolicy>,
        quorum_m: u8,
        quorum_n: u8,
        require_verified_schema: bool,
        oracle_fee_bps: u16,
        allow_delegate_claim: bool,
        challenge_window_secs: i64,
    ) -> Result<()> {
        surface::set_pool_oracle_policy(
            ctx,
            quorum_m,
            quorum_n,
            require_verified_schema,
            oracle_fee_bps,
            allow_delegate_claim,
            challenge_window_secs,
        )
    }

    pub fn set_pool_coverage_reserve_floor(
        ctx: Context<SetPoolCoverageReserveFloor>,
        payment_mint: Pubkey,
        amount: u64,
    ) -> Result<()> {
        surface::set_pool_coverage_reserve_floor(ctx, payment_mint, amount)
    }

    pub fn set_pool_risk_controls(
        ctx: Context<SetPoolRiskControls>,
        redemption_mode: u8,
        claim_mode: u8,
        impaired: bool,
        impairment_amount: u64,
    ) -> Result<()> {
        surface::set_pool_risk_controls(
            ctx,
            redemption_mode,
            claim_mode,
            impaired,
            impairment_amount,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn set_pool_compliance_policy(
        ctx: Context<SetPoolCompliancePolicy>,
        provider_ref_hash: [u8; 32],
        credential_type_hash: [u8; 32],
        revocation_list_hash: [u8; 32],
        actions_mask: u16,
        binding_mode: u8,
        provider_mode: u8,
        capital_rail_mode: u8,
        payout_rail_mode: u8,
        active: bool,
    ) -> Result<()> {
        surface::set_pool_compliance_policy(
            ctx,
            provider_ref_hash,
            credential_type_hash,
            revocation_list_hash,
            actions_mask,
            binding_mode,
            provider_mode,
            capital_rail_mode,
            payout_rail_mode,
            active,
        )
    }

    pub fn set_pool_control_authorities(
        ctx: Context<SetPoolControlAuthorities>,
        operator_authority: Pubkey,
        risk_manager_authority: Pubkey,
        compliance_authority: Pubkey,
        guardian_authority: Pubkey,
    ) -> Result<()> {
        surface::set_pool_control_authorities(
            ctx,
            operator_authority,
            risk_manager_authority,
            compliance_authority,
            guardian_authority,
        )
    }

    pub fn set_pool_automation_policy(
        ctx: Context<SetPoolAutomationPolicy>,
        oracle_automation_mode: u8,
        claim_automation_mode: u8,
        allowed_ai_roles_mask: u16,
        max_auto_claim_amount: u64,
        required_attestation_provider_ref_hash: [u8; 32],
    ) -> Result<()> {
        surface::set_pool_automation_policy(
            ctx,
            oracle_automation_mode,
            claim_automation_mode,
            allowed_ai_roles_mask,
            max_auto_claim_amount,
            required_attestation_provider_ref_hash,
        )
    }

    pub fn set_pool_oracle_permissions(
        ctx: Context<SetPoolOraclePermissions>,
        permissions: u32,
    ) -> Result<()> {
        surface::set_pool_oracle_permissions(ctx, permissions)
    }

    pub fn set_pool_terms_hash(
        ctx: Context<SetPoolTermsHash>,
        terms_hash: [u8; 32],
        payout_policy_hash: [u8; 32],
        cycle_mode: u8,
        metadata_uri: String,
    ) -> Result<()> {
        surface::set_pool_terms_hash(
            ctx,
            terms_hash,
            payout_policy_hash,
            cycle_mode,
            metadata_uri,
        )
    }

    pub fn register_outcome_schema(
        ctx: Context<RegisterOutcomeSchema>,
        schema_key_hash: [u8; 32],
        schema_key: String,
        version: u16,
        schema_hash: [u8; 32],
        schema_family: u8,
        visibility: u8,
        interop_profile_hash: [u8; 32],
        code_system_family_hash: [u8; 32],
        mapping_version: u16,
        metadata_uri: String,
    ) -> Result<()> {
        surface::register_outcome_schema(
            ctx,
            schema_key_hash,
            schema_key,
            version,
            schema_hash,
            schema_family,
            visibility,
            interop_profile_hash,
            code_system_family_hash,
            mapping_version,
            metadata_uri,
        )
    }

    pub fn verify_outcome_schema(ctx: Context<VerifyOutcomeSchema>, verified: bool) -> Result<()> {
        surface::verify_outcome_schema(ctx, verified)
    }

    pub fn backfill_schema_dependency_ledger(
        ctx: Context<BackfillSchemaDependencyLedger>,
        schema_key_hash: [u8; 32],
    ) -> Result<()> {
        surface::backfill_schema_dependency_ledger(ctx, schema_key_hash)
    }

    pub fn close_outcome_schema(ctx: Context<CloseOutcomeSchema>) -> Result<()> {
        surface::close_outcome_schema(ctx)
    }

    pub fn set_policy_series_outcome_rule(
        ctx: Context<SetPoolOutcomeRule>,
        series_ref_hash: [u8; 32],
        rule_hash: [u8; 32],
        schema_key_hash: [u8; 32],
        rule_id: String,
        schema_key: String,
        schema_version: u16,
        interop_profile_hash: [u8; 32],
        code_system_family_hash: [u8; 32],
        mapping_version: u16,
        payout_hash: [u8; 32],
        enabled: bool,
    ) -> Result<()> {
        surface::set_policy_series_outcome_rule(
            ctx,
            series_ref_hash,
            rule_hash,
            schema_key_hash,
            rule_id,
            schema_key,
            schema_version,
            interop_profile_hash,
            code_system_family_hash,
            mapping_version,
            payout_hash,
            enabled,
        )
    }

    pub fn register_invite_issuer(
        ctx: Context<RegisterInviteIssuer>,
        organization_ref: String,
        metadata_uri: String,
        active: bool,
    ) -> Result<()> {
        surface::register_invite_issuer(ctx, organization_ref, metadata_uri, active)
    }

    pub fn enroll_member_open(
        ctx: Context<EnrollMemberOpen>,
        subject_commitment: [u8; 32],
    ) -> Result<()> {
        surface::enroll_member_open(ctx, subject_commitment)
    }

    pub fn enroll_member_token_gate(
        ctx: Context<EnrollMemberTokenGate>,
        subject_commitment: [u8; 32],
    ) -> Result<()> {
        surface::enroll_member_token_gate(ctx, subject_commitment)
    }

    pub fn enroll_member_invite_permit(
        ctx: Context<EnrollMemberInvitePermit>,
        subject_commitment: [u8; 32],
        nonce_hash: [u8; 32],
        invite_id_hash: [u8; 32],
        expires_at_ts: i64,
    ) -> Result<()> {
        surface::enroll_member_invite_permit(
            ctx,
            subject_commitment,
            nonce_hash,
            invite_id_hash,
            expires_at_ts,
        )
    }

    pub fn set_claim_delegate(
        ctx: Context<SetClaimDelegate>,
        delegate: Pubkey,
        active: bool,
    ) -> Result<()> {
        surface::set_claim_delegate(ctx, delegate, active)
    }

    pub fn fund_pool_sol(ctx: Context<FundPoolSol>, lamports: u64) -> Result<()> {
        surface::fund_pool_sol(ctx, lamports)
    }

    pub fn fund_pool_spl(ctx: Context<FundPoolSpl>, amount: u64) -> Result<()> {
        surface::fund_pool_spl(ctx, amount)
    }

    pub fn initialize_pool_liquidity_sol(
        ctx: Context<InitializePoolLiquiditySol>,
        initial_lamports: u64,
    ) -> Result<()> {
        surface::initialize_pool_liquidity_sol(ctx, initial_lamports)
    }

    pub fn initialize_pool_liquidity_spl(
        ctx: Context<InitializePoolLiquiditySpl>,
        initial_amount: u64,
    ) -> Result<()> {
        surface::initialize_pool_liquidity_spl(ctx, initial_amount)
    }

    pub fn set_pool_liquidity_enabled(
        ctx: Context<SetPoolLiquidityEnabled>,
        enabled: bool,
    ) -> Result<()> {
        surface::set_pool_liquidity_enabled(ctx, enabled)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn register_pool_capital_class(
        ctx: Context<RegisterPoolCapitalClass>,
        class_id_hash: [u8; 32],
        class_mode: u8,
        class_priority: u8,
        transfer_mode: u8,
        restricted: bool,
        redemption_queue_enabled: bool,
        ring_fenced: bool,
        lockup_secs: i64,
        redemption_notice_secs: i64,
        compliance_profile_hash: [u8; 32],
        series_ref_hash: [u8; 32],
        vintage_index: u16,
    ) -> Result<()> {
        surface::register_pool_capital_class(
            ctx,
            class_id_hash,
            class_mode,
            class_priority,
            transfer_mode,
            restricted,
            redemption_queue_enabled,
            ring_fenced,
            lockup_secs,
            redemption_notice_secs,
            compliance_profile_hash,
            series_ref_hash,
            vintage_index,
        )
    }

    pub fn deposit_pool_liquidity_sol(
        ctx: Context<DepositPoolLiquiditySol>,
        amount_in: u64,
        min_shares_out: u64,
    ) -> Result<()> {
        surface::deposit_pool_liquidity_sol(ctx, amount_in, min_shares_out)
    }

    pub fn deposit_pool_liquidity_spl(
        ctx: Context<DepositPoolLiquiditySpl>,
        amount_in: u64,
        min_shares_out: u64,
    ) -> Result<()> {
        surface::deposit_pool_liquidity_spl(ctx, amount_in, min_shares_out)
    }

    pub fn redeem_pool_liquidity_sol(
        ctx: Context<RedeemPoolLiquiditySol>,
        shares_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        surface::redeem_pool_liquidity_sol(ctx, shares_in, min_amount_out)
    }

    pub fn redeem_pool_liquidity_spl(
        ctx: Context<RedeemPoolLiquiditySpl>,
        shares_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        surface::redeem_pool_liquidity_spl(ctx, shares_in, min_amount_out)
    }

    pub fn request_pool_liquidity_redemption(
        ctx: Context<RequestPoolLiquidityRedemption>,
        request_hash: [u8; 32],
        shares_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        surface::request_pool_liquidity_redemption(ctx, request_hash, shares_in, min_amount_out)
    }

    pub fn schedule_pool_liquidity_redemption(
        ctx: Context<SchedulePoolLiquidityRedemption>,
    ) -> Result<()> {
        surface::schedule_pool_liquidity_redemption(ctx)
    }

    pub fn cancel_pool_liquidity_redemption(
        ctx: Context<CancelPoolLiquidityRedemption>,
    ) -> Result<()> {
        surface::cancel_pool_liquidity_redemption(ctx)
    }

    pub fn fail_pool_liquidity_redemption(
        ctx: Context<FailPoolLiquidityRedemption>,
        failure_code: u16,
    ) -> Result<()> {
        surface::fail_pool_liquidity_redemption(ctx, failure_code)
    }

    pub fn fulfill_pool_liquidity_redemption_sol(
        ctx: Context<FulfillPoolLiquidityRedemptionSol>,
    ) -> Result<()> {
        surface::fulfill_pool_liquidity_redemption_sol(ctx)
    }

    pub fn fulfill_pool_liquidity_redemption_spl(
        ctx: Context<FulfillPoolLiquidityRedemptionSpl>,
    ) -> Result<()> {
        surface::fulfill_pool_liquidity_redemption_spl(ctx)
    }

    // Reward attestation and claim lifecycle.

    /// Records an oracle attestation vote for a member and cycle outcome.
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
        surface::submit_outcome_attestation_vote(
            ctx,
            member,
            cycle_hash,
            rule_hash,
            attestation_digest,
            observed_value_hash,
            evidence_hash,
            external_attestation_ref_hash,
            ai_role,
            automation_mode,
            model_version_hash,
            policy_version_hash,
            execution_environment_hash,
            attestation_provider_ref_hash,
            as_of_ts,
            passed,
        )
    }

    pub fn finalize_cycle_outcome(ctx: Context<FinalizeCycleOutcome>) -> Result<()> {
        surface::finalize_cycle_outcome(ctx)
    }

    pub fn open_cycle_outcome_dispute(
        ctx: Context<OpenCycleOutcomeDispute>,
        dispute_reason_hash: [u8; 32],
    ) -> Result<()> {
        surface::open_cycle_outcome_dispute(ctx, dispute_reason_hash)
    }

    pub fn resolve_cycle_outcome_dispute(
        ctx: Context<ResolveCycleOutcomeDispute>,
        sustain_original_outcome: bool,
    ) -> Result<()> {
        surface::resolve_cycle_outcome_dispute(ctx, sustain_original_outcome)
    }

    pub fn finalize_cohort_settlement_root(
        ctx: Context<FinalizeCohortSettlementRoot>,
        series_ref_hash: [u8; 32],
        cohort_hash: [u8; 32],
    ) -> Result<()> {
        surface::finalize_cohort_settlement_root(ctx, series_ref_hash, cohort_hash)
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
        surface::submit_reward_claim(
            ctx,
            member,
            cycle_hash,
            rule_hash,
            intent_hash,
            payout_amount,
            recipient,
        )
    }

    // Coverage product, policy, and premium lifecycle.

    #[allow(clippy::too_many_arguments)]
    pub fn create_policy_series(
        ctx: Context<RegisterPolicySeriesV2>,
        series_ref_hash: [u8; 32],
        status: u8,
        plan_mode: u8,
        sponsor_mode: u8,
        display_name: String,
        metadata_uri: String,
        terms_hash: [u8; 32],
        duration_secs: i64,
        premium_due_every_secs: i64,
        premium_grace_secs: i64,
        premium_amount: u64,
        interop_profile_hash: [u8; 32],
        oracle_profile_hash: [u8; 32],
        risk_family_hash: [u8; 32],
        issuance_template_hash: [u8; 32],
        comparability_hash: [u8; 32],
        renewal_of_hash: [u8; 32],
        terms_version: u16,
        mapping_version: u16,
    ) -> Result<()> {
        surface::create_policy_series(
            ctx,
            series_ref_hash,
            status,
            plan_mode,
            sponsor_mode,
            display_name,
            metadata_uri,
            terms_hash,
            duration_secs,
            premium_due_every_secs,
            premium_grace_secs,
            premium_amount,
            interop_profile_hash,
            oracle_profile_hash,
            risk_family_hash,
            issuance_template_hash,
            comparability_hash,
            renewal_of_hash,
            terms_version,
            mapping_version,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_policy_series(
        ctx: Context<UpdatePolicySeriesV2>,
        status: u8,
        plan_mode: u8,
        sponsor_mode: u8,
        display_name: String,
        metadata_uri: String,
        terms_hash: [u8; 32],
        duration_secs: i64,
        premium_due_every_secs: i64,
        premium_grace_secs: i64,
        premium_amount: u64,
        interop_profile_hash: [u8; 32],
        oracle_profile_hash: [u8; 32],
        risk_family_hash: [u8; 32],
        issuance_template_hash: [u8; 32],
        comparability_hash: [u8; 32],
        renewal_of_hash: [u8; 32],
        terms_version: u16,
        mapping_version: u16,
    ) -> Result<()> {
        surface::update_policy_series(
            ctx,
            status,
            plan_mode,
            sponsor_mode,
            display_name,
            metadata_uri,
            terms_hash,
            duration_secs,
            premium_due_every_secs,
            premium_grace_secs,
            premium_amount,
            interop_profile_hash,
            oracle_profile_hash,
            risk_family_hash,
            issuance_template_hash,
            comparability_hash,
            renewal_of_hash,
            terms_version,
            mapping_version,
        )
    }

    pub fn upsert_policy_series_payment_option(
        ctx: Context<UpsertPolicySeriesPaymentOption>,
        payment_mint: Pubkey,
        payment_amount: u64,
        active: bool,
    ) -> Result<()> {
        surface::upsert_policy_series_payment_option(ctx, payment_mint, payment_amount, active)
    }

    pub fn subscribe_policy_series(
        ctx: Context<SubscribePolicySeriesV2>,
        series_ref_hash: [u8; 32],
        starts_at: i64,
    ) -> Result<()> {
        surface::subscribe_policy_series(ctx, series_ref_hash, starts_at)
    }

    pub fn issue_policy_position(
        ctx: Context<IssuePolicyPositionFromProductV2>,
        member: Pubkey,
        series_ref_hash: [u8; 32],
        starts_at: i64,
    ) -> Result<()> {
        surface::issue_policy_position(ctx, member, series_ref_hash, starts_at)
    }

    pub fn mint_policy_nft(
        ctx: Context<MintPolicyNft>,
        nft_mint: Pubkey,
        metadata_uri: String,
    ) -> Result<()> {
        surface::mint_policy_nft(ctx, nft_mint, metadata_uri)
    }

    pub fn pay_premium_spl(ctx: Context<PayPremiumSpl>, period_index: u64) -> Result<()> {
        surface::pay_premium_spl(ctx, period_index)
    }

    pub fn pay_premium_sol(ctx: Context<PayPremiumSol>, period_index: u64) -> Result<()> {
        surface::pay_premium_sol(ctx, period_index)
    }

    // Quote activation and cycle settlement lifecycle.

    /// Activates a quoted cycle paid in native SOL and records all treasury side effects.
    #[allow(clippy::too_many_arguments)]
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
        surface::activate_cycle_with_quote_sol(
            ctx,
            series_ref_hash,
            period_index,
            nonce_hash,
            premium_amount_raw,
            canonical_premium_amount,
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
            quote_meta_hash,
        )
    }

    /// Activates a quoted cycle paid in SPL tokens and records all treasury side effects.
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
        surface::activate_cycle_with_quote_spl(
            ctx,
            series_ref_hash,
            period_index,
            nonce_hash,
            premium_amount_raw,
            canonical_premium_amount,
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
            quote_meta_hash,
        )
    }

    /// Settles an SPL-backed cycle commitment after the quoted period closes.
    pub fn settle_cycle_commitment(
        ctx: Context<SettleCycleCommitment>,
        series_ref_hash: [u8; 32],
        period_index: u64,
        passed: bool,
        shield_consumed: bool,
        settled_health_alpha_score: u16,
    ) -> Result<()> {
        surface::settle_cycle_commitment(
            ctx,
            series_ref_hash,
            period_index,
            passed,
            shield_consumed,
            settled_health_alpha_score,
        )
    }

    /// Settles a SOL-backed cycle commitment after the quoted period closes.
    pub fn settle_cycle_commitment_sol(
        ctx: Context<SettleCycleCommitmentSol>,
        series_ref_hash: [u8; 32],
        period_index: u64,
        passed: bool,
        shield_consumed: bool,
        settled_health_alpha_score: u16,
    ) -> Result<()> {
        surface::settle_cycle_commitment_sol(
            ctx,
            series_ref_hash,
            period_index,
            passed,
            shield_consumed,
            settled_health_alpha_score,
        )
    }

    // Treasury withdrawals, premium attestations, and coverage claims.

    pub fn withdraw_pool_treasury_spl(
        ctx: Context<WithdrawPoolTreasurySpl>,
        amount: u64,
    ) -> Result<()> {
        surface::withdraw_pool_treasury_spl(ctx, amount)
    }

    pub fn withdraw_pool_treasury_sol(
        ctx: Context<WithdrawPoolTreasurySol>,
        amount: u64,
    ) -> Result<()> {
        surface::withdraw_pool_treasury_sol(ctx, amount)
    }

    pub fn withdraw_protocol_fee_spl(
        ctx: Context<WithdrawProtocolFeeSpl>,
        amount: u64,
    ) -> Result<()> {
        surface::withdraw_protocol_fee_spl(ctx, amount)
    }

    pub fn withdraw_protocol_fee_sol(
        ctx: Context<WithdrawProtocolFeeSol>,
        amount: u64,
    ) -> Result<()> {
        surface::withdraw_protocol_fee_sol(ctx, amount)
    }

    pub fn withdraw_pool_oracle_fee_spl(
        ctx: Context<WithdrawPoolOracleFeeSpl>,
        amount: u64,
    ) -> Result<()> {
        surface::withdraw_pool_oracle_fee_spl(ctx, amount)
    }

    pub fn withdraw_pool_oracle_fee_sol(
        ctx: Context<WithdrawPoolOracleFeeSol>,
        amount: u64,
    ) -> Result<()> {
        surface::withdraw_pool_oracle_fee_sol(ctx, amount)
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
        surface::attest_premium_paid_offchain(
            ctx,
            member,
            series_ref_hash,
            period_index,
            replay_hash,
            amount,
            paid_at_ts,
        )
    }

    /// Opens a coverage claim tied to the active policy and claimant intent.
    pub fn submit_coverage_claim(
        ctx: Context<SubmitCoverageClaim>,
        member: Pubkey,
        series_ref_hash: [u8; 32],
        intent_hash: [u8; 32],
        event_hash: [u8; 32],
    ) -> Result<()> {
        surface::submit_coverage_claim(ctx, member, series_ref_hash, intent_hash, event_hash)
    }

    pub fn review_coverage_claim(
        ctx: Context<ReviewCoverageClaim>,
        requested_amount: u64,
        evidence_hash: [u8; 32],
        interop_ref_hash: [u8; 32],
        claim_family: u8,
        interop_profile_hash: [u8; 32],
        code_system_family_hash: [u8; 32],
    ) -> Result<()> {
        surface::review_coverage_claim(
            ctx,
            requested_amount,
            evidence_hash,
            interop_ref_hash,
            claim_family,
            interop_profile_hash,
            code_system_family_hash,
        )
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
        surface::attach_coverage_claim_decision_support(
            ctx,
            ai_decision_hash,
            ai_policy_hash,
            ai_execution_environment_hash,
            ai_attestation_ref_hash,
            ai_role,
            automation_mode,
        )
    }

    pub fn approve_coverage_claim(
        ctx: Context<ApproveCoverageClaim>,
        approved_amount: u64,
        decision_reason_hash: [u8; 32],
        adjudication_ref_hash: [u8; 32],
    ) -> Result<()> {
        surface::approve_coverage_claim(
            ctx,
            approved_amount,
            decision_reason_hash,
            adjudication_ref_hash,
        )
    }

    pub fn deny_coverage_claim(
        ctx: Context<DenyCoverageClaim>,
        decision_reason_hash: [u8; 32],
        adjudication_ref_hash: [u8; 32],
    ) -> Result<()> {
        surface::deny_coverage_claim(ctx, decision_reason_hash, adjudication_ref_hash)
    }

    pub fn pay_coverage_claim(ctx: Context<PayCoverageClaim>, payout_amount: u64) -> Result<()> {
        surface::pay_coverage_claim(ctx, payout_amount)
    }

    /// Lets a claimant or active delegate pull an already approved coverage payout.
    pub fn claim_approved_coverage_payout(
        ctx: Context<ClaimApprovedCoveragePayout>,
        payout_amount: u64,
    ) -> Result<()> {
        surface::claim_approved_coverage_payout(ctx, payout_amount)
    }

    pub fn close_coverage_claim(
        ctx: Context<CloseCoverageClaim>,
        recovery_amount: u64,
    ) -> Result<()> {
        surface::close_coverage_claim(ctx, recovery_amount)
    }

    /// Finalizes a coverage claim payout from the pool treasury.
    pub fn settle_coverage_claim(
        ctx: Context<SettleCoverageClaim>,
        payout_amount: u64,
    ) -> Result<()> {
        surface::settle_coverage_claim(ctx, payout_amount)
    }
}
