// SPDX-License-Identifier: AGPL-3.0-or-later

//! Pool configuration, membership, funding, and liquidity handlers.

use super::*;

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
    require!(
        !ctx.accounts.config.emergency_paused,
        OmegaXProtocolError::ProtocolPaused
    );
    require!(
        pool_id.len() <= MAX_POOL_ID_LEN,
        OmegaXProtocolError::PoolIdTooLong
    );
    require!(
        organization_ref.len() <= MAX_ORG_REF_LEN,
        OmegaXProtocolError::OrganizationRefTooLong
    );
    require!(
        payout_lamports_per_pass > 0,
        OmegaXProtocolError::InvalidAmount
    );
    require!(
        membership_mode == MEMBERSHIP_MODE_OPEN
            || membership_mode == MEMBERSHIP_MODE_TOKEN_GATE
            || membership_mode == MEMBERSHIP_MODE_INVITE_ONLY,
        OmegaXProtocolError::InvalidMembershipMode
    );
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        OmegaXProtocolError::MetadataUriTooLong
    );
    require!(
        pool_type == POOL_TYPE_REWARD || pool_type == POOL_TYPE_COVERAGE,
        OmegaXProtocolError::InvalidPoolType
    );
    if membership_mode == MEMBERSHIP_MODE_TOKEN_GATE {
        require!(
            token_gate_mint != ZERO_PUBKEY,
            OmegaXProtocolError::InvalidMembershipConfiguration
        );
        require!(
            token_gate_min_balance > 0,
            OmegaXProtocolError::InvalidMembershipConfiguration
        );
    }
    if membership_mode == MEMBERSHIP_MODE_INVITE_ONLY {
        require!(
            invite_issuer != ZERO_PUBKEY,
            OmegaXProtocolError::InvalidMembershipConfiguration
        );
    }

    let pool = &mut ctx.accounts.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.pool_id = pool_id;
    pool.organization_ref = organization_ref;
    pool.payout_lamports_per_pass = payout_lamports_per_pass;
    pool.membership_mode = membership_mode;
    pool.token_gate_mint = if membership_mode == MEMBERSHIP_MODE_TOKEN_GATE {
        token_gate_mint
    } else {
        ZERO_PUBKEY
    };
    pool.token_gate_min_balance = if membership_mode == MEMBERSHIP_MODE_TOKEN_GATE {
        token_gate_min_balance
    } else {
        0
    };
    pool.invite_issuer = if membership_mode == MEMBERSHIP_MODE_INVITE_ONLY {
        invite_issuer
    } else {
        ZERO_PUBKEY
    };
    pool.status = POOL_STATUS_ACTIVE;
    pool.bump = ctx.bumps.pool;

    let terms = &mut ctx.accounts.pool_terms;
    terms.pool = ctx.accounts.pool.key();
    terms.pool_type = pool_type;
    terms.payout_asset_mint = payout_asset_mint;
    terms.terms_hash = terms_hash;
    terms.payout_policy_hash = payout_policy_hash;
    terms.cycle_mode = cycle_mode;
    terms.metadata_uri = metadata_uri;
    terms.bump = ctx.bumps.pool_terms;

    let policy = &mut ctx.accounts.oracle_policy;
    policy.pool = ctx.accounts.pool.key();
    policy.quorum_m = 1;
    policy.quorum_n = 1;
    policy.require_verified_schema = true;
    policy.oracle_fee_bps = 0;
    policy.allow_delegate_claim = false;
    policy.challenge_window_secs = 0;
    policy.bump = ctx.bumps.oracle_policy;

    Ok(())
}

pub fn set_pool_status(ctx: Context<SetPoolStatus>, status: u8) -> Result<()> {
    require!(
        status == POOL_STATUS_DRAFT || status == POOL_STATUS_ACTIVE || status == POOL_STATUS_CLOSED,
        OmegaXProtocolError::InvalidPoolStatus
    );
    ctx.accounts.pool.status = status;
    Ok(())
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
    require!(quorum_m > 0, OmegaXProtocolError::InvalidQuorum);
    require!(quorum_n > 0, OmegaXProtocolError::InvalidQuorum);
    require!(quorum_m <= quorum_n, OmegaXProtocolError::InvalidQuorum);
    require!(
        oracle_fee_bps <= MAX_PROTOCOL_FEE_BPS,
        OmegaXProtocolError::InvalidOracleFee
    );
    require!(
        u32::from(ctx.accounts.config.protocol_fee_bps)
            .checked_add(u32::from(oracle_fee_bps))
            .ok_or(OmegaXProtocolError::MathOverflow)?
            <= u32::from(MAX_PROTOCOL_FEE_BPS),
        OmegaXProtocolError::InvalidOracleFee
    );
    require!(
        challenge_window_secs >= 0,
        OmegaXProtocolError::InvalidAmount
    );

    let policy = &mut ctx.accounts.oracle_policy;
    policy.pool = ctx.accounts.pool.key();
    policy.quorum_m = quorum_m;
    policy.quorum_n = quorum_n;
    policy.require_verified_schema = require_verified_schema;
    policy.oracle_fee_bps = oracle_fee_bps;
    policy.allow_delegate_claim = allow_delegate_claim;
    policy.challenge_window_secs = challenge_window_secs;
    // Preserve existing bump set at initialization time.

    Ok(())
}

pub fn set_pool_coverage_reserve_floor(
    ctx: Context<SetPoolCoverageReserveFloor>,
    payment_mint: Pubkey,
    amount: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require_keys_eq!(
        ctx.accounts.pool.authority,
        ctx.accounts.authority.key(),
        OmegaXProtocolError::PolicySeriesAdminUnauthorized
    );
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        payment_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;
    ctx.accounts
        .pool_treasury_reserve
        .manual_coverage_reserve_amount = amount;
    touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;
    Ok(())
}

pub fn set_pool_risk_controls(
    ctx: Context<SetPoolRiskControls>,
    redemption_mode: u8,
    claim_mode: u8,
    impaired: bool,
    impairment_amount: u64,
) -> Result<()> {
    require!(
        redemption_mode == POOL_REDEMPTION_MODE_OPEN
            || redemption_mode == POOL_REDEMPTION_MODE_QUEUE_ONLY
            || redemption_mode == POOL_REDEMPTION_MODE_PAUSED,
        OmegaXProtocolError::InvalidPoolRedemptionMode
    );
    require!(
        claim_mode == POOL_CLAIM_MODE_OPEN || claim_mode == POOL_CLAIM_MODE_PAUSED,
        OmegaXProtocolError::InvalidPoolClaimMode
    );
    require!(
        impaired || impairment_amount == 0,
        OmegaXProtocolError::InvalidAmount
    );

    let signer = ctx.accounts.authority.key();
    require!(
        has_pool_risk_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_ref(),
            signer,
        ),
        OmegaXProtocolError::PoolRiskControlUnauthorized
    );

    upsert_pool_risk_config(
        &mut ctx.accounts.pool_risk_config,
        ctx.accounts.pool.key(),
        ctx.bumps.pool_risk_config,
    )?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        ctx.accounts.pool.key(),
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let risk_config = &mut ctx.accounts.pool_risk_config;
    risk_config.redemption_mode = redemption_mode;
    risk_config.claim_mode = claim_mode;
    risk_config.impaired = impaired;
    risk_config.updated_by = signer;
    risk_config.updated_at = now;

    ctx.accounts.pool_treasury_reserve.impaired_amount =
        if impaired { impairment_amount } else { 0 };
    touch_liability_ledger(&mut ctx.accounts.pool_treasury_reserve)?;
    emit!(PoolRiskControlsUpdatedEvent {
        pool: ctx.accounts.pool.key(),
        redemption_mode,
        claim_mode,
        impaired,
        impairment_amount,
        updated_by: signer,
    });
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn set_policy_series(
    ctx: Context<SetPolicySeries>,
    series_ref_hash: [u8; 32],
    interop_profile_hash: [u8; 32],
    oracle_profile_hash: [u8; 32],
    risk_family_hash: [u8; 32],
    issuance_template_hash: [u8; 32],
    comparability_hash: [u8; 32],
    renewal_of_hash: [u8; 32],
    plan_mode: u8,
    sponsor_mode: u8,
    terms_version: u16,
    mapping_version: u16,
) -> Result<()> {
    require!(
        plan_mode == PLAN_MODE_REWARD
            || plan_mode == PLAN_MODE_PROTECTION
            || plan_mode == PLAN_MODE_REIMBURSEMENT
            || plan_mode == PLAN_MODE_REGULATED,
        OmegaXProtocolError::InvalidPlanMode
    );
    require!(
        sponsor_mode == SPONSOR_MODE_DIRECT
            || sponsor_mode == SPONSOR_MODE_WRAPPER
            || sponsor_mode == SPONSOR_MODE_CARRIER,
        OmegaXProtocolError::InvalidSponsorMode
    );

    let signer = ctx.accounts.authority.key();
    require!(
        has_pool_compliance_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_ref(),
            signer,
        ),
        OmegaXProtocolError::CompliancePolicyUnauthorized
    );

    let profile = &mut ctx.accounts.policy_series;
    profile.pool = ctx.accounts.pool.key();
    profile.series_ref_hash = series_ref_hash;
    profile.interop_profile_hash = interop_profile_hash;
    profile.oracle_profile_hash = oracle_profile_hash;
    profile.risk_family_hash = risk_family_hash;
    profile.issuance_template_hash = issuance_template_hash;
    profile.comparability_hash = comparability_hash;
    profile.renewal_of_hash = renewal_of_hash;
    profile.plan_mode = plan_mode;
    profile.sponsor_mode = sponsor_mode;
    profile.terms_version = terms_version;
    profile.mapping_version = mapping_version;
    profile.updated_at_ts = Clock::get()?.unix_timestamp;
    profile.bump = ctx.bumps.policy_series;

    emit!(PolicySeriesUpdatedEvent {
        pool: ctx.accounts.pool.key(),
        series_ref_hash,
        interop_profile_hash,
        issuance_template_hash,
        comparability_hash,
        plan_mode,
        sponsor_mode,
    });
    Ok(())
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
    require!(
        binding_mode == COMPLIANCE_BINDING_MODE_NONE
            || binding_mode == COMPLIANCE_BINDING_MODE_WALLET
            || binding_mode == COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT
            || binding_mode == COMPLIANCE_BINDING_MODE_TOKEN_GATE,
        OmegaXProtocolError::InvalidComplianceBindingMode
    );
    require!(
        provider_mode == COMPLIANCE_PROVIDER_MODE_NATIVE
            || provider_mode == COMPLIANCE_PROVIDER_MODE_EXTERNAL
            || provider_mode == COMPLIANCE_PROVIDER_MODE_SOLANA_ATTEST,
        OmegaXProtocolError::InvalidComplianceProviderMode
    );
    require!(
        capital_rail_mode <= RAIL_MODE_PERMISSIONED_SPL
            && payout_rail_mode <= RAIL_MODE_PERMISSIONED_SPL,
        OmegaXProtocolError::InvalidRailMode
    );

    let signer = ctx.accounts.authority.key();
    require!(
        has_pool_compliance_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_ref(),
            signer,
        ),
        OmegaXProtocolError::CompliancePolicyUnauthorized
    );

    let policy = &mut ctx.accounts.pool_compliance_policy;
    policy.pool = ctx.accounts.pool.key();
    policy.provider_ref_hash = provider_ref_hash;
    policy.credential_type_hash = credential_type_hash;
    policy.revocation_list_hash = revocation_list_hash;
    policy.actions_mask = actions_mask;
    policy.binding_mode = binding_mode;
    policy.provider_mode = provider_mode;
    policy.capital_rail_mode = capital_rail_mode;
    policy.payout_rail_mode = payout_rail_mode;
    policy.active = active;
    policy.updated_by = signer;
    policy.updated_at = Clock::get()?.unix_timestamp;
    policy.bump = ctx.bumps.pool_compliance_policy;

    emit!(PoolCompliancePolicyUpdatedEvent {
        pool: ctx.accounts.pool.key(),
        provider_ref_hash,
        credential_type_hash,
        actions_mask,
        binding_mode,
        provider_mode,
        capital_rail_mode,
        payout_rail_mode,
        active,
    });
    Ok(())
}

pub fn set_pool_control_authorities(
    ctx: Context<SetPoolControlAuthorities>,
    operator_authority: Pubkey,
    risk_manager_authority: Pubkey,
    compliance_authority: Pubkey,
    guardian_authority: Pubkey,
) -> Result<()> {
    let signer = ctx.accounts.authority.key();
    require!(
        signer == ctx.accounts.pool.authority
            || signer == ctx.accounts.config.governance_authority
            || (ctx.accounts.config.emergency_paused && signer == ctx.accounts.config.admin),
        OmegaXProtocolError::ControlAuthorityUnauthorized
    );

    let control = &mut ctx.accounts.pool_control_authority;
    control.pool = ctx.accounts.pool.key();
    control.operator_authority = operator_authority;
    control.risk_manager_authority = risk_manager_authority;
    control.compliance_authority = compliance_authority;
    control.guardian_authority = guardian_authority;
    control.updated_at = Clock::get()?.unix_timestamp;
    control.bump = ctx.bumps.pool_control_authority;

    emit!(PoolControlAuthoritiesUpdatedEvent {
        pool: ctx.accounts.pool.key(),
        operator_authority,
        risk_manager_authority,
        compliance_authority,
        guardian_authority,
    });
    Ok(())
}

pub fn set_pool_automation_policy(
    ctx: Context<SetPoolAutomationPolicy>,
    oracle_automation_mode: u8,
    claim_automation_mode: u8,
    allowed_ai_roles_mask: u16,
    max_auto_claim_amount: u64,
    required_attestation_provider_ref_hash: [u8; 32],
) -> Result<()> {
    require!(
        oracle_automation_mode <= AUTOMATION_MODE_BOUNDED_AUTONOMOUS
            && claim_automation_mode <= AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
        OmegaXProtocolError::InvalidAutomationMode
    );
    let signer = ctx.accounts.authority.key();
    require!(
        has_pool_compliance_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_ref(),
            signer,
        ),
        OmegaXProtocolError::AutomationPolicyUnauthorized
    );

    let policy = &mut ctx.accounts.pool_automation_policy;
    policy.pool = ctx.accounts.pool.key();
    policy.oracle_automation_mode = oracle_automation_mode;
    policy.claim_automation_mode = claim_automation_mode;
    policy.allowed_ai_roles_mask = allowed_ai_roles_mask;
    policy.max_auto_claim_amount = max_auto_claim_amount;
    policy.required_attestation_provider_ref_hash = required_attestation_provider_ref_hash;
    policy.updated_by = signer;
    policy.updated_at = Clock::get()?.unix_timestamp;
    policy.bump = ctx.bumps.pool_automation_policy;

    emit!(PoolAutomationPolicyUpdatedEvent {
        pool: ctx.accounts.pool.key(),
        oracle_automation_mode,
        claim_automation_mode,
        allowed_ai_roles_mask,
        max_auto_claim_amount,
        required_attestation_provider_ref_hash,
    });
    Ok(())
}

pub fn set_pool_oracle_permissions(
    ctx: Context<SetPoolOraclePermissions>,
    permissions: u32,
) -> Result<()> {
    let record = &mut ctx.accounts.pool_oracle_permissions;
    record.pool = ctx.accounts.pool.key();
    record.oracle = ctx.accounts.oracle_entry.oracle;
    record.permissions = permissions;
    record.bump = ctx.bumps.pool_oracle_permissions;
    Ok(())
}

pub fn set_pool_terms_hash(
    ctx: Context<SetPoolTermsHash>,
    terms_hash: [u8; 32],
    payout_policy_hash: [u8; 32],
    cycle_mode: u8,
    metadata_uri: String,
) -> Result<()> {
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        OmegaXProtocolError::MetadataUriTooLong
    );

    let terms = &mut ctx.accounts.pool_terms;
    terms.terms_hash = terms_hash;
    terms.payout_policy_hash = payout_policy_hash;
    terms.cycle_mode = cycle_mode;
    terms.metadata_uri = metadata_uri;

    Ok(())
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
    require!(
        schema_key.len() <= 64,
        OmegaXProtocolError::SchemaKeyTooLong
    );
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        OmegaXProtocolError::MetadataUriTooLong
    );
    require!(
        schema_family == SCHEMA_FAMILY_KERNEL
            || schema_family == SCHEMA_FAMILY_CLINICAL
            || schema_family == SCHEMA_FAMILY_CLAIMS_CODING,
        OmegaXProtocolError::InvalidSchemaFamily
    );
    require!(
        visibility == SCHEMA_VISIBILITY_PUBLIC
            || visibility == SCHEMA_VISIBILITY_PRIVATE
            || visibility == SCHEMA_VISIBILITY_RESTRICTED,
        OmegaXProtocolError::InvalidSchemaVisibility
    );

    let entry = &mut ctx.accounts.schema_entry;
    entry.schema_key_hash = schema_key_hash;
    entry.schema_key = schema_key;
    entry.version = version;
    entry.schema_hash = schema_hash;
    entry.publisher = ctx.accounts.publisher.key();
    entry.verified = false;
    entry.schema_family = schema_family;
    entry.visibility = visibility;
    entry.interop_profile_hash = interop_profile_hash;
    entry.code_system_family_hash = code_system_family_hash;
    entry.mapping_version = mapping_version;
    entry.metadata_uri = metadata_uri;
    entry.bump = ctx.bumps.schema_entry;
    ctx.accounts.schema_dependency.schema_key_hash = schema_key_hash;
    ctx.accounts.schema_dependency.active_rule_refcount = 0;
    ctx.accounts.schema_dependency.bump = ctx.bumps.schema_dependency;

    Ok(())
}

pub fn verify_outcome_schema(ctx: Context<VerifyOutcomeSchema>, verified: bool) -> Result<()> {
    let signer = ctx.accounts.governance_authority.key();
    let config = &ctx.accounts.config;
    assert_governance_signer(config, signer)?;

    ctx.accounts.schema_entry.verified = verified;
    Ok(())
}

pub fn backfill_schema_dependency_ledger(
    ctx: Context<BackfillSchemaDependencyLedger>,
    schema_key_hash: [u8; 32],
) -> Result<()> {
    let signer = ctx.accounts.governance_authority.key();
    let config = &ctx.accounts.config;
    assert_governance_signer(config, signer)?;

    require!(
        ctx.accounts.schema_entry.schema_key_hash == schema_key_hash,
        OmegaXProtocolError::InvalidProgramAccountData
    );

    let mut active_rule_refcount: u32 = 0;
    for account in ctx.remaining_accounts.iter() {
        require_keys_eq!(
            *account.owner,
            crate::ID,
            OmegaXProtocolError::InvalidProgramAccountData
        );
        let data = account.try_borrow_data()?;
        let mut data_slice: &[u8] = &data;
        let rule = PoolOutcomeRule::try_deserialize(&mut data_slice)
            .map_err(|_| OmegaXProtocolError::InvalidProgramAccountData)?;
        require!(
            rule.pool != Pubkey::default(),
            OmegaXProtocolError::InvalidProgramAccountData
        );
        require!(
            rule.schema_key_hash == schema_key_hash,
            OmegaXProtocolError::InvalidProgramAccountData
        );
        if rule.enabled {
            active_rule_refcount = active_rule_refcount
                .checked_add(1)
                .ok_or(OmegaXProtocolError::MathOverflow)?;
        }
    }

    ctx.accounts.schema_dependency.schema_key_hash = schema_key_hash;
    ctx.accounts.schema_dependency.active_rule_refcount = active_rule_refcount;
    ctx.accounts.schema_dependency.bump = ctx.bumps.schema_dependency;
    Ok(())
}

pub fn close_outcome_schema(ctx: Context<CloseOutcomeSchema>) -> Result<()> {
    let signer = ctx.accounts.governance_authority.key();
    let config = &ctx.accounts.config;
    assert_governance_signer(config, signer)?;

    require!(
        !ctx.accounts.schema_entry.verified,
        OmegaXProtocolError::SchemaCloseRequiresUnverified
    );
    require!(
        ctx.accounts.schema_dependency.schema_key_hash == ctx.accounts.schema_entry.schema_key_hash,
        OmegaXProtocolError::InvalidProgramAccountData
    );
    require!(
        ctx.accounts.schema_dependency.active_rule_refcount == 0,
        OmegaXProtocolError::SchemaRuleReferencesOutstanding
    );

    Ok(())
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
    require!(
        ctx.accounts.policy_series.series_ref_hash == series_ref_hash,
        OmegaXProtocolError::PolicySeriesIdMismatch
    );
    require_policy_series_allows_reward(&ctx.accounts.policy_series)?;
    let is_existing_rule = ctx.accounts.pool_rule.pool != Pubkey::default();
    let was_enabled = is_existing_rule && ctx.accounts.pool_rule.enabled;
    require!(
        ctx.accounts.schema_dependency.schema_key_hash == schema_key_hash,
        OmegaXProtocolError::InvalidProgramAccountData
    );
    if is_existing_rule {
        require_keys_eq!(
            ctx.accounts.pool_rule.pool,
            ctx.accounts.pool.key(),
            OmegaXProtocolError::AccountPoolMismatch
        );
        require!(
            ctx.accounts.pool_rule.rule_hash == rule_hash,
            OmegaXProtocolError::RuleHashMismatch
        );
        require!(
            ctx.accounts.pool_rule.schema_key_hash == schema_key_hash,
            OmegaXProtocolError::InvalidProgramAccountData
        );
        require!(
            ctx.accounts.pool_rule.series_ref_hash == series_ref_hash,
            OmegaXProtocolError::PolicySeriesIdMismatch
        );
    }
    let spec = PoolOutcomeRuleSpec {
        series_ref_hash,
        rule_hash,
        schema_key_hash,
        rule_id: &rule_id,
        schema_key: &schema_key,
        schema_version,
        interop_profile_hash,
        code_system_family_hash,
        mapping_version,
        payout_hash,
        enabled,
    };
    spec.validate_lengths()?;
    validate_pool_rule_schema_binding(&ctx.accounts.schema_entry, &spec)?;
    if !was_enabled && enabled {
        ctx.accounts.schema_dependency.active_rule_refcount = ctx
            .accounts
            .schema_dependency
            .active_rule_refcount
            .checked_add(1)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
    } else if was_enabled && !enabled {
        ctx.accounts.schema_dependency.active_rule_refcount = ctx
            .accounts
            .schema_dependency
            .active_rule_refcount
            .checked_sub(1)
            .ok_or(OmegaXProtocolError::MathOverflow)?;
    }
    write_pool_outcome_rule(
        &mut ctx.accounts.pool_rule,
        ctx.accounts.pool.key(),
        &spec,
        ctx.bumps.pool_rule,
    );

    Ok(())
}

pub fn register_invite_issuer(
    ctx: Context<RegisterInviteIssuer>,
    organization_ref: String,
    metadata_uri: String,
    active: bool,
) -> Result<()> {
    require!(
        organization_ref.len() <= MAX_ORG_REF_LEN,
        OmegaXProtocolError::OrganizationRefTooLong
    );
    require!(
        metadata_uri.len() <= MAX_METADATA_URI_LEN,
        OmegaXProtocolError::MetadataUriTooLong
    );

    let issuer = &mut ctx.accounts.invite_issuer_entry;
    issuer.issuer = ctx.accounts.issuer.key();
    issuer.organization_ref = organization_ref;
    issuer.metadata_uri = metadata_uri;
    issuer.active = active;
    issuer.bump = ctx.bumps.invite_issuer_entry;

    Ok(())
}

pub fn enroll_member_open(
    ctx: Context<EnrollMemberOpen>,
    subject_commitment: [u8; 32],
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(
        pool.status == POOL_STATUS_ACTIVE || pool.status == POOL_STATUS_DRAFT,
        OmegaXProtocolError::PoolNotOpenForEnrollment
    );
    require!(
        pool.membership_mode == MEMBERSHIP_MODE_OPEN,
        OmegaXProtocolError::InvalidMembershipMode
    );
    write_membership(
        &mut ctx.accounts.membership,
        pool.key(),
        ctx.accounts.member.key(),
        subject_commitment,
        ctx.bumps.membership,
    )
}

pub fn enroll_member_token_gate(
    ctx: Context<EnrollMemberTokenGate>,
    subject_commitment: [u8; 32],
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(
        pool.status == POOL_STATUS_ACTIVE || pool.status == POOL_STATUS_DRAFT,
        OmegaXProtocolError::PoolNotOpenForEnrollment
    );
    require!(
        pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE,
        OmegaXProtocolError::InvalidMembershipMode
    );
    require!(
        ctx.accounts.token_gate_account.owner == ctx.accounts.member.key(),
        OmegaXProtocolError::TokenGateOwnerMismatch
    );
    require!(
        ctx.accounts.token_gate_account.mint == pool.token_gate_mint,
        OmegaXProtocolError::TokenGateMintMismatch
    );
    require!(
        ctx.accounts.token_gate_account.amount >= pool.token_gate_min_balance,
        OmegaXProtocolError::TokenGateBalanceTooLow
    );

    write_membership(
        &mut ctx.accounts.membership,
        pool.key(),
        ctx.accounts.member.key(),
        subject_commitment,
        ctx.bumps.membership,
    )
}

pub fn enroll_member_invite_permit(
    ctx: Context<EnrollMemberInvitePermit>,
    subject_commitment: [u8; 32],
    nonce_hash: [u8; 32],
    invite_id_hash: [u8; 32],
    expires_at_ts: i64,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(
        pool.status == POOL_STATUS_ACTIVE || pool.status == POOL_STATUS_DRAFT,
        OmegaXProtocolError::PoolNotOpenForEnrollment
    );
    require!(
        pool.membership_mode == MEMBERSHIP_MODE_INVITE_ONLY,
        OmegaXProtocolError::InvalidMembershipMode
    );
    require!(
        ctx.accounts.invite_issuer_entry.active,
        OmegaXProtocolError::InviteIssuerNotActive
    );
    require!(
        pool.invite_issuer == ctx.accounts.issuer.key(),
        OmegaXProtocolError::InviteIssuerMismatch
    );

    let now = Clock::get()?.unix_timestamp;
    require!(now <= expires_at_ts, OmegaXProtocolError::PermitExpired);

    write_membership(
        &mut ctx.accounts.membership,
        pool.key(),
        ctx.accounts.member.key(),
        subject_commitment,
        ctx.bumps.membership,
    )?;

    let replay = &mut ctx.accounts.enrollment_replay;
    replay.pool = pool.key();
    replay.issuer = ctx.accounts.issuer.key();
    replay.member = ctx.accounts.member.key();
    replay.nonce_hash = nonce_hash;
    replay.invite_id_hash = invite_id_hash;
    replay.created_at = now;
    replay.bump = ctx.bumps.enrollment_replay;

    Ok(())
}

pub fn set_claim_delegate(
    ctx: Context<SetClaimDelegate>,
    delegate: Pubkey,
    active: bool,
) -> Result<()> {
    require!(
        ctx.accounts.membership.status == MEMBERSHIP_STATUS_ACTIVE,
        OmegaXProtocolError::MembershipNotActive
    );

    let record = &mut ctx.accounts.claim_delegate;
    record.pool = ctx.accounts.pool.key();
    record.member = ctx.accounts.member.key();
    record.delegate = delegate;
    record.active = active;
    record.updated_at = Clock::get()?.unix_timestamp;
    record.bump = ctx.bumps.claim_delegate;

    Ok(())
}

pub fn fund_pool_sol(ctx: Context<FundPoolSol>, lamports: u64) -> Result<()> {
    require!(lamports > 0, OmegaXProtocolError::InvalidAmount);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        SystemTransfer {
            from: ctx.accounts.funder.to_account_info(),
            to: ctx.accounts.pool.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, lamports)
}

pub fn fund_pool_spl(ctx: Context<FundPoolSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.pool_terms.payout_asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::PayoutAssetNotConfigured
    );
    require!(
        ctx.accounts.pool_terms.payout_asset_mint == ctx.accounts.payout_mint.key(),
        OmegaXProtocolError::PayoutMintMismatch
    );

    let vault = &mut ctx.accounts.pool_asset_vault;
    if vault.pool == ZERO_PUBKEY {
        vault.pool = ctx.accounts.pool.key();
        vault.payout_mint = ctx.accounts.payout_mint.key();
        vault.vault_token_account = ctx.accounts.pool_vault_token_account.key();
        vault.active = true;
        vault.bump = ctx.bumps.pool_asset_vault;
    } else {
        require_keys_eq!(
            vault.pool,
            ctx.accounts.pool.key(),
            OmegaXProtocolError::AccountPoolMismatch
        );
        require_keys_eq!(
            vault.payout_mint,
            ctx.accounts.payout_mint.key(),
            OmegaXProtocolError::PayoutMintMismatch
        );
        require_keys_eq!(
            vault.vault_token_account,
            ctx.accounts.pool_vault_token_account.key(),
            OmegaXProtocolError::VaultTokenAccountMismatch
        );
        vault.active = true;
    }

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.funder_token_account.to_account_info(),
            to: ctx.accounts.pool_vault_token_account.to_account_info(),
            authority: ctx.accounts.funder.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}

pub fn initialize_pool_liquidity_sol(
    ctx: Context<InitializePoolLiquiditySol>,
    initial_lamports: u64,
) -> Result<()> {
    require!(initial_lamports > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.pool_terms.payout_asset_mint == ZERO_PUBKEY,
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );

    let reserves_before = pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?;
    require!(
        reserves_before == 0,
        OmegaXProtocolError::PoolLiquidityRequiresZeroTvl
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        SystemTransfer {
            from: ctx.accounts.authority.to_account_info(),
            to: ctx.accounts.pool.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, initial_lamports)?;

    let pool_liquidity_config = &mut ctx.accounts.pool_liquidity_config;
    pool_liquidity_config.pool = ctx.accounts.pool.key();
    pool_liquidity_config.payout_mint = ZERO_PUBKEY;
    pool_liquidity_config.share_mint = ctx.accounts.pool_share_mint.key();
    pool_liquidity_config.deposits_enabled = true;
    pool_liquidity_config.bump = ctx.bumps.pool_liquidity_config;

    mint_pool_shares(
        ctx.accounts.pool.key(),
        pool_liquidity_config,
        &ctx.accounts.pool_share_mint,
        &ctx.accounts.authority_share_token_account,
        &ctx.accounts.token_program,
        initial_lamports,
    )?;

    Ok(())
}

pub fn initialize_pool_liquidity_spl(
    ctx: Context<InitializePoolLiquiditySpl>,
    initial_amount: u64,
) -> Result<()> {
    require!(initial_amount > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.pool_terms.payout_asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );
    require_keys_eq!(
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.accounts.payout_mint.key(),
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx
                .accounts
                .authority_payout_token_account
                .to_account_info(),
            to: ctx.accounts.pool_vault_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, initial_amount)?;

    let pool_asset_vault = &mut ctx.accounts.pool_asset_vault;
    pool_asset_vault.pool = ctx.accounts.pool.key();
    pool_asset_vault.payout_mint = ctx.accounts.payout_mint.key();
    pool_asset_vault.vault_token_account = ctx.accounts.pool_vault_token_account.key();
    pool_asset_vault.active = true;
    pool_asset_vault.bump = ctx.bumps.pool_asset_vault;

    let pool_liquidity_config = &mut ctx.accounts.pool_liquidity_config;
    pool_liquidity_config.pool = ctx.accounts.pool.key();
    pool_liquidity_config.payout_mint = ctx.accounts.payout_mint.key();
    pool_liquidity_config.share_mint = ctx.accounts.pool_share_mint.key();
    pool_liquidity_config.deposits_enabled = true;
    pool_liquidity_config.bump = ctx.bumps.pool_liquidity_config;

    mint_pool_shares(
        ctx.accounts.pool.key(),
        pool_liquidity_config,
        &ctx.accounts.pool_share_mint,
        &ctx.accounts.authority_share_token_account,
        &ctx.accounts.token_program,
        initial_amount,
    )?;

    Ok(())
}

pub fn set_pool_liquidity_enabled(
    ctx: Context<SetPoolLiquidityEnabled>,
    enabled: bool,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.pool_liquidity_config.pool,
        ctx.accounts.pool.key(),
        OmegaXProtocolError::LiquidityConfigMismatch
    );
    ctx.accounts.pool_liquidity_config.deposits_enabled = enabled;
    Ok(())
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
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(
        class_mode == CAPITAL_CLASS_MODE_NAV
            || class_mode == CAPITAL_CLASS_MODE_DISTRIBUTION
            || class_mode == CAPITAL_CLASS_MODE_HYBRID,
        OmegaXProtocolError::InvalidCapitalClassMode
    );
    require!(
        transfer_mode == CAPITAL_TRANSFER_MODE_PERMISSIONLESS
            || transfer_mode == CAPITAL_TRANSFER_MODE_RESTRICTED
            || transfer_mode == CAPITAL_TRANSFER_MODE_WRAPPER_ONLY,
        OmegaXProtocolError::InvalidCapitalTransferMode
    );
    require!(
        lockup_secs >= 0 && redemption_notice_secs >= 0,
        OmegaXProtocolError::InvalidAmount
    );
    if restricted || transfer_mode != CAPITAL_TRANSFER_MODE_PERMISSIONLESS {
        require!(
            !is_zero_hash(&compliance_profile_hash),
            OmegaXProtocolError::ComplianceBindingRequired
        );
    }

    let pool_key = ctx.accounts.pool.key();
    let share_mint_key = ctx.accounts.pool_share_mint.key();
    assert_pool_liquidity_config(
        &ctx.accounts.pool_liquidity_config,
        pool_key,
        ctx.accounts.pool_terms.payout_asset_mint,
        share_mint_key,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let capital_class = &mut ctx.accounts.pool_capital_class;
    if capital_class.pool == ZERO_PUBKEY {
        capital_class.pool = pool_key;
        capital_class.share_mint = share_mint_key;
        capital_class.payout_mint = ctx.accounts.pool_terms.payout_asset_mint;
        capital_class.issued_at = now;
        capital_class.bump = ctx.bumps.pool_capital_class;
    } else {
        require_keys_eq!(
            capital_class.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require_keys_eq!(
            capital_class.share_mint,
            share_mint_key,
            OmegaXProtocolError::ShareMintMismatch
        );
        require_keys_eq!(
            capital_class.payout_mint,
            ctx.accounts.pool_terms.payout_asset_mint,
            OmegaXProtocolError::PayoutMintMismatch
        );
    }

    capital_class.class_id_hash = class_id_hash;
    capital_class.series_ref_hash = series_ref_hash;
    capital_class.compliance_profile_hash = compliance_profile_hash;
    capital_class.class_mode = class_mode;
    capital_class.class_priority = class_priority;
    capital_class.transfer_mode = transfer_mode;
    capital_class.restricted = restricted;
    capital_class.redemption_queue_enabled = redemption_queue_enabled;
    capital_class.ring_fenced = ring_fenced;
    capital_class.lockup_secs = lockup_secs;
    capital_class.redemption_notice_secs = redemption_notice_secs;
    capital_class.vintage_index = vintage_index;
    capital_class.updated_at = now;

    emit!(PoolCapitalClassRegisteredEvent {
        pool: pool_key,
        share_mint: share_mint_key,
        class_id_hash,
        series_ref_hash,
        compliance_profile_hash,
        class_mode,
        transfer_mode,
        restricted,
        redemption_queue_enabled,
        vintage_index,
    });
    Ok(())
}

pub fn deposit_pool_liquidity_sol(
    ctx: Context<DepositPoolLiquiditySol>,
    amount_in: u64,
    min_shares_out: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(amount_in > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.pool_terms.payout_asset_mint == ZERO_PUBKEY,
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );

    let pool_key = ctx.accounts.pool.key();
    let share_mint_key = ctx.accounts.pool_share_mint.key();
    assert_pool_liquidity_config(
        &ctx.accounts.pool_liquidity_config,
        pool_key,
        ZERO_PUBKEY,
        share_mint_key,
    )?;
    if let Some(class) = ctx.accounts.pool_capital_class.as_ref() {
        require_keys_eq!(
            class.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require!(
            !class.restricted || ctx.accounts.pool_compliance_policy.is_some(),
            OmegaXProtocolError::ComplianceBindingRequired
        );
    }
    assert_action_compliant(
        ctx.accounts
            .pool_compliance_policy
            .as_ref()
            .map(|policy| policy.as_ref()),
        pool_key,
        COMPLIANCE_ACTION_DEPOSIT,
        ctx.accounts.depositor.key(),
        ZERO_PUBKEY,
        ctx.accounts
            .membership
            .as_ref()
            .map(|membership| membership.subject_commitment),
        ctx.accounts.pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE
            && ctx.accounts.membership.is_some(),
    )?;
    require!(
        ctx.accounts.pool_liquidity_config.deposits_enabled,
        OmegaXProtocolError::LiquidityDepositsDisabled
    );

    let reserves_before = pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?;
    let shares_out = compute_deposit_shares_out(
        amount_in,
        ctx.accounts.pool_share_mint.supply,
        reserves_before,
    )?;
    require!(
        shares_out >= min_shares_out,
        OmegaXProtocolError::SlippageExceeded
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        SystemTransfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.pool.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount_in)?;

    mint_pool_shares(
        pool_key,
        &ctx.accounts.pool_liquidity_config,
        &ctx.accounts.pool_share_mint,
        &ctx.accounts.depositor_share_token_account,
        &ctx.accounts.token_program,
        shares_out,
    )?;

    emit!(PoolLiquidityDepositedEvent {
        pool: pool_key,
        depositor: ctx.accounts.depositor.key(),
        payout_mint: ZERO_PUBKEY,
        amount_in,
        shares_out,
    });
    Ok(())
}

pub fn deposit_pool_liquidity_spl(
    ctx: Context<DepositPoolLiquiditySpl>,
    amount_in: u64,
    min_shares_out: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(amount_in > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.pool_terms.payout_asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );
    require_keys_eq!(
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.accounts.payout_mint.key(),
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );
    require!(
        ctx.accounts.pool_asset_vault.active,
        OmegaXProtocolError::MissingAssetVault
    );

    let pool_key = ctx.accounts.pool.key();
    let share_mint_key = ctx.accounts.pool_share_mint.key();
    assert_pool_liquidity_config(
        &ctx.accounts.pool_liquidity_config,
        pool_key,
        ctx.accounts.payout_mint.key(),
        share_mint_key,
    )?;
    if let Some(class) = ctx.accounts.pool_capital_class.as_ref() {
        require_keys_eq!(
            class.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
        require!(
            !class.restricted || ctx.accounts.pool_compliance_policy.is_some(),
            OmegaXProtocolError::ComplianceBindingRequired
        );
    }
    assert_action_compliant(
        ctx.accounts
            .pool_compliance_policy
            .as_ref()
            .map(|policy| policy.as_ref())
            .map(|policy| policy.as_ref()),
        pool_key,
        COMPLIANCE_ACTION_DEPOSIT,
        ctx.accounts.depositor.key(),
        ctx.accounts.payout_mint.key(),
        ctx.accounts
            .membership
            .as_ref()
            .map(|membership| membership.subject_commitment),
        ctx.accounts.pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE
            && ctx.accounts.membership.is_some(),
    )?;
    require!(
        ctx.accounts.pool_liquidity_config.deposits_enabled,
        OmegaXProtocolError::LiquidityDepositsDisabled
    );

    let shares_out = compute_deposit_shares_out(
        amount_in,
        ctx.accounts.pool_share_mint.supply,
        ctx.accounts.pool_vault_token_account.amount,
    )?;
    require!(
        shares_out >= min_shares_out,
        OmegaXProtocolError::SlippageExceeded
    );

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx
                .accounts
                .depositor_payout_token_account
                .to_account_info(),
            to: ctx.accounts.pool_vault_token_account.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount_in)?;

    mint_pool_shares(
        pool_key,
        &ctx.accounts.pool_liquidity_config,
        &ctx.accounts.pool_share_mint,
        &ctx.accounts.depositor_share_token_account,
        &ctx.accounts.token_program,
        shares_out,
    )?;

    emit!(PoolLiquidityDepositedEvent {
        pool: pool_key,
        depositor: ctx.accounts.depositor.key(),
        payout_mint: ctx.accounts.payout_mint.key(),
        amount_in,
        shares_out,
    });
    Ok(())
}

pub fn redeem_pool_liquidity_sol(
    ctx: Context<RedeemPoolLiquiditySol>,
    shares_in: u64,
    min_amount_out: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(shares_in > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.pool_terms.payout_asset_mint == ZERO_PUBKEY,
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );

    let pool_key = ctx.accounts.pool.key();
    let share_mint_key = ctx.accounts.pool_share_mint.key();
    assert_pool_liquidity_config(
        &ctx.accounts.pool_liquidity_config,
        pool_key,
        ZERO_PUBKEY,
        share_mint_key,
    )?;
    upsert_pool_risk_config(
        &mut ctx.accounts.pool_risk_config,
        pool_key,
        ctx.bumps.pool_risk_config,
    )?;
    if let Some(class) = ctx.accounts.pool_capital_class.as_ref() {
        require!(
            !class.redemption_queue_enabled,
            OmegaXProtocolError::PoolRedemptionsQueueOnly
        );
    }
    assert_action_compliant(
        ctx.accounts
            .pool_compliance_policy
            .as_ref()
            .map(|policy| policy.as_ref())
            .map(|policy| &**policy),
        pool_key,
        COMPLIANCE_ACTION_REDEEM,
        ctx.accounts.redeemer.key(),
        ZERO_PUBKEY,
        ctx.accounts
            .membership
            .as_ref()
            .map(|membership| membership.subject_commitment),
        ctx.accounts.pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE
            && ctx.accounts.membership.is_some(),
    )?;
    assert_pool_redemptions_open(&ctx.accounts.pool_risk_config)?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        ZERO_PUBKEY,
        ctx.bumps.pool_treasury_reserve,
    )?;

    let amount_out = compute_redeem_amount_out_against_free_capital(
        shares_in,
        ctx.accounts.pool_share_mint.supply,
        pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?,
        &ctx.accounts.pool_treasury_reserve,
    )?;
    require!(
        amount_out >= min_amount_out,
        OmegaXProtocolError::SlippageExceeded
    );

    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.pool_share_mint.to_account_info(),
            from: ctx.accounts.redeemer_share_token_account.to_account_info(),
            authority: ctx.accounts.redeemer.to_account_info(),
        },
    );
    token::burn(burn_ctx, shares_in)?;

    transfer_program_owned_lamports(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.redeemer.to_account_info(),
        amount_out,
    )?;

    emit!(PoolLiquidityRedeemedEvent {
        pool: pool_key,
        redeemer: ctx.accounts.redeemer.key(),
        payout_mint: ZERO_PUBKEY,
        shares_in,
        amount_out,
    });
    Ok(())
}

pub fn redeem_pool_liquidity_spl(
    ctx: Context<RedeemPoolLiquiditySpl>,
    shares_in: u64,
    min_amount_out: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(shares_in > 0, OmegaXProtocolError::InvalidAmount);
    require!(
        ctx.accounts.pool_terms.payout_asset_mint != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );
    require_keys_eq!(
        ctx.accounts.pool_terms.payout_asset_mint,
        ctx.accounts.payout_mint.key(),
        OmegaXProtocolError::InvalidPayoutAssetForLiquidity
    );
    require!(
        ctx.accounts.pool_asset_vault.active,
        OmegaXProtocolError::MissingAssetVault
    );

    let pool_key = ctx.accounts.pool.key();
    let share_mint_key = ctx.accounts.pool_share_mint.key();
    assert_pool_liquidity_config(
        &ctx.accounts.pool_liquidity_config,
        pool_key,
        ctx.accounts.payout_mint.key(),
        share_mint_key,
    )?;
    upsert_pool_risk_config(
        &mut ctx.accounts.pool_risk_config,
        pool_key,
        ctx.bumps.pool_risk_config,
    )?;
    if let Some(class) = ctx.accounts.pool_capital_class.as_ref() {
        require!(
            !class.redemption_queue_enabled,
            OmegaXProtocolError::PoolRedemptionsQueueOnly
        );
    }
    assert_action_compliant(
        ctx.accounts
            .pool_compliance_policy
            .as_ref()
            .map(|policy| policy.as_ref())
            .map(|policy| policy.as_ref()),
        pool_key,
        COMPLIANCE_ACTION_REDEEM,
        ctx.accounts.redeemer.key(),
        ctx.accounts.payout_mint.key(),
        ctx.accounts
            .membership
            .as_ref()
            .map(|membership| membership.subject_commitment),
        ctx.accounts.pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE
            && ctx.accounts.membership.is_some(),
    )?;
    assert_pool_redemptions_open(&ctx.accounts.pool_risk_config)?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        ctx.accounts.payout_mint.key(),
        ctx.bumps.pool_treasury_reserve,
    )?;

    let amount_out = compute_redeem_amount_out_against_free_capital(
        shares_in,
        ctx.accounts.pool_share_mint.supply,
        ctx.accounts.pool_vault_token_account.amount,
        &ctx.accounts.pool_treasury_reserve,
    )?;
    require!(
        amount_out >= min_amount_out,
        OmegaXProtocolError::SlippageExceeded
    );

    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.pool_share_mint.to_account_info(),
            from: ctx.accounts.redeemer_share_token_account.to_account_info(),
            authority: ctx.accounts.redeemer.to_account_info(),
        },
    );
    token::burn(burn_ctx, shares_in)?;

    transfer_spl_reward(
        &ctx.accounts.pool_asset_vault,
        &ctx.accounts.pool_vault_token_account,
        &ctx.accounts.redeemer_payout_token_account,
        &ctx.accounts.token_program,
        amount_out,
    )?;

    emit!(PoolLiquidityRedeemedEvent {
        pool: pool_key,
        redeemer: ctx.accounts.redeemer.key(),
        payout_mint: ctx.accounts.payout_mint.key(),
        shares_in,
        amount_out,
    });
    Ok(())
}

pub fn request_pool_liquidity_redemption(
    ctx: Context<RequestPoolLiquidityRedemption>,
    request_hash: [u8; 32],
    shares_in: u64,
    min_amount_out: u64,
) -> Result<()> {
    assert_protocol_not_paused(&ctx.accounts.config)?;
    require!(shares_in > 0, OmegaXProtocolError::InvalidAmount);

    let pool_key = ctx.accounts.pool.key();
    let payout_mint = ctx.accounts.pool_terms.payout_asset_mint;
    upsert_pool_risk_config(
        &mut ctx.accounts.pool_risk_config,
        pool_key,
        ctx.bumps.pool_risk_config,
    )?;
    upsert_pool_treasury_reserve(
        &mut ctx.accounts.pool_treasury_reserve,
        pool_key,
        payout_mint,
        ctx.bumps.pool_treasury_reserve,
    )?;
    assert_action_compliant(
        ctx.accounts
            .pool_compliance_policy
            .as_deref()
            .map(|policy| policy.as_ref()),
        pool_key,
        COMPLIANCE_ACTION_REDEEM,
        ctx.accounts.redeemer.key(),
        payout_mint,
        ctx.accounts
            .membership
            .as_ref()
            .map(|membership| membership.subject_commitment),
        ctx.accounts.pool.membership_mode == MEMBERSHIP_MODE_TOKEN_GATE
            && ctx.accounts.membership.is_some(),
    )?;
    if let Some(class) = ctx.accounts.pool_capital_class.as_ref() {
        require_keys_eq!(
            class.pool,
            pool_key,
            OmegaXProtocolError::AccountPoolMismatch
        );
    }
    require!(
        ctx.accounts.pool_risk_config.redemption_mode != POOL_REDEMPTION_MODE_PAUSED,
        OmegaXProtocolError::PoolRedemptionsPaused
    );

    let expected_amount_out = if payout_mint == ZERO_PUBKEY {
        compute_redeem_amount_out_against_free_capital(
            shares_in,
            ctx.accounts.pool_share_mint.supply,
            pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?,
            &ctx.accounts.pool_treasury_reserve,
        )
        .unwrap_or(0)
    } else {
        0
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.redeemer_share_token_account.to_account_info(),
            to: ctx
                .accounts
                .redemption_request_share_escrow
                .to_account_info(),
            authority: ctx.accounts.redeemer.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, shares_in)?;

    let now = Clock::get()?.unix_timestamp;
    let notice_matures_at = now
        .checked_add(
            ctx.accounts
                .pool_capital_class
                .as_ref()
                .map(|class| class.redemption_notice_secs)
                .unwrap_or(0),
        )
        .ok_or(OmegaXProtocolError::MathOverflow)?;
    let request = &mut ctx.accounts.redemption_request;
    request.pool = pool_key;
    request.redeemer = ctx.accounts.redeemer.key();
    request.share_mint = ctx.accounts.pool_share_mint.key();
    request.payout_mint = payout_mint;
    request.request_hash = request_hash;
    request.share_escrow = ctx.accounts.redemption_request_share_escrow.key();
    request.status = REDEMPTION_REQUEST_STATUS_PENDING;
    request.shares_requested = shares_in;
    request.min_amount_out = min_amount_out;
    request.expected_amount_out = expected_amount_out;
    request.notice_matures_at = notice_matures_at;
    request.requested_at = now;
    request.scheduled_at = 0;
    request.fulfilled_at = 0;
    request.cancelled_at = 0;
    request.failed_at = 0;
    request.failure_code = 0;
    request.bump = ctx.bumps.redemption_request;

    emit!(PoolRedemptionRequestedEvent {
        pool: pool_key,
        redeemer: ctx.accounts.redeemer.key(),
        request_hash,
        payout_mint,
        shares_requested: shares_in,
        expected_amount_out,
        notice_matures_at,
    });
    Ok(())
}

pub fn schedule_pool_liquidity_redemption(
    ctx: Context<SchedulePoolLiquidityRedemption>,
) -> Result<()> {
    require!(
        has_pool_risk_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_ref(),
            ctx.accounts.authority.key(),
        ),
        OmegaXProtocolError::RedemptionRequestUnauthorized
    );
    let now = Clock::get()?.unix_timestamp;
    schedule_redemption_request(&mut ctx.accounts.redemption_request, now)?;
    emit!(PoolRedemptionStatusChangedEvent {
        pool: ctx.accounts.pool.key(),
        redeemer: ctx.accounts.redemption_request.redeemer,
        request_hash: ctx.accounts.redemption_request.request_hash,
        status: REDEMPTION_REQUEST_STATUS_SCHEDULED,
        amount_out: ctx.accounts.redemption_request.expected_amount_out,
        failure_code: 0,
    });
    Ok(())
}

pub fn cancel_pool_liquidity_redemption(ctx: Context<CancelPoolLiquidityRedemption>) -> Result<()> {
    let pool_key = ctx.accounts.pool.key();
    let request_hash = ctx.accounts.redemption_request.request_hash;
    let signer_seeds: &[&[u8]] = &[
        SEED_REDEMPTION_REQUEST,
        pool_key.as_ref(),
        ctx.accounts.redemption_request.redeemer.as_ref(),
        request_hash.as_ref(),
        &[ctx.accounts.redemption_request.bump],
    ];
    let signer_groups = [signer_seeds];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx
                .accounts
                .redemption_request_share_escrow
                .to_account_info(),
            to: ctx.accounts.redeemer_share_token_account.to_account_info(),
            authority: ctx.accounts.redemption_request.to_account_info(),
        },
        &signer_groups,
    );
    token::transfer(cpi_ctx, ctx.accounts.redemption_request.shares_requested)?;
    cancel_redemption_request(
        &mut ctx.accounts.redemption_request,
        Clock::get()?.unix_timestamp,
    )?;
    emit!(PoolRedemptionStatusChangedEvent {
        pool: pool_key,
        redeemer: ctx.accounts.redemption_request.redeemer,
        request_hash,
        status: REDEMPTION_REQUEST_STATUS_CANCELLED,
        amount_out: 0,
        failure_code: 0,
    });
    Ok(())
}

pub fn fail_pool_liquidity_redemption(
    ctx: Context<FailPoolLiquidityRedemption>,
    failure_code: u16,
) -> Result<()> {
    require!(
        has_pool_risk_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_ref(),
            ctx.accounts.authority.key(),
        ),
        OmegaXProtocolError::RedemptionRequestUnauthorized
    );
    let pool_key = ctx.accounts.pool.key();
    let request_hash = ctx.accounts.redemption_request.request_hash;
    let signer_seeds: &[&[u8]] = &[
        SEED_REDEMPTION_REQUEST,
        pool_key.as_ref(),
        ctx.accounts.redemption_request.redeemer.as_ref(),
        request_hash.as_ref(),
        &[ctx.accounts.redemption_request.bump],
    ];
    let signer_groups = [signer_seeds];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx
                .accounts
                .redemption_request_share_escrow
                .to_account_info(),
            to: ctx.accounts.redeemer_share_token_account.to_account_info(),
            authority: ctx.accounts.redemption_request.to_account_info(),
        },
        &signer_groups,
    );
    token::transfer(cpi_ctx, ctx.accounts.redemption_request.shares_requested)?;
    fail_redemption_request(
        &mut ctx.accounts.redemption_request,
        Clock::get()?.unix_timestamp,
        failure_code,
    )?;
    emit!(PoolRedemptionStatusChangedEvent {
        pool: pool_key,
        redeemer: ctx.accounts.redemption_request.redeemer,
        request_hash,
        status: REDEMPTION_REQUEST_STATUS_FAILED,
        amount_out: 0,
        failure_code,
    });
    Ok(())
}

pub fn fulfill_pool_liquidity_redemption_sol(
    ctx: Context<FulfillPoolLiquidityRedemptionSol>,
) -> Result<()> {
    require!(
        has_pool_risk_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_ref(),
            ctx.accounts.authority.key(),
        ),
        OmegaXProtocolError::RedemptionRequestUnauthorized
    );
    require!(
        ctx.accounts.redemption_request.payout_mint == ZERO_PUBKEY,
        OmegaXProtocolError::PayoutMintMismatch
    );
    let now = Clock::get()?.unix_timestamp;
    require_keys_eq!(
        ctx.accounts.redeemer_system_account.key(),
        ctx.accounts.redemption_request.redeemer,
        OmegaXProtocolError::RecipientMismatch
    );
    let amount_out = compute_redeem_amount_out_against_free_capital(
        ctx.accounts.redemption_request.shares_requested,
        ctx.accounts.pool_share_mint.supply,
        pool_withdrawable_lamports(&ctx.accounts.pool.to_account_info())?,
        &ctx.accounts.pool_treasury_reserve,
    )?;
    require!(
        amount_out >= ctx.accounts.redemption_request.min_amount_out,
        OmegaXProtocolError::SlippageExceeded
    );

    let pool_key = ctx.accounts.pool.key();
    let request_hash = ctx.accounts.redemption_request.request_hash;
    let signer_seeds: &[&[u8]] = &[
        SEED_REDEMPTION_REQUEST,
        pool_key.as_ref(),
        ctx.accounts.redemption_request.redeemer.as_ref(),
        request_hash.as_ref(),
        &[ctx.accounts.redemption_request.bump],
    ];
    let signer_groups = [signer_seeds];
    let burn_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.pool_share_mint.to_account_info(),
            from: ctx
                .accounts
                .redemption_request_share_escrow
                .to_account_info(),
            authority: ctx.accounts.redemption_request.to_account_info(),
        },
        &signer_groups,
    );
    token::burn(burn_ctx, ctx.accounts.redemption_request.shares_requested)?;
    transfer_program_owned_lamports(
        &ctx.accounts.pool.to_account_info(),
        &ctx.accounts.redeemer_system_account.to_account_info(),
        amount_out,
    )?;

    fulfill_redemption_request(&mut ctx.accounts.redemption_request, now, amount_out)?;
    emit!(PoolRedemptionStatusChangedEvent {
        pool: pool_key,
        redeemer: ctx.accounts.redemption_request.redeemer,
        request_hash,
        status: REDEMPTION_REQUEST_STATUS_FULFILLED,
        amount_out,
        failure_code: 0,
    });
    Ok(())
}

pub fn fulfill_pool_liquidity_redemption_spl(
    ctx: Context<FulfillPoolLiquidityRedemptionSpl>,
) -> Result<()> {
    require!(
        has_pool_risk_authority(
            &ctx.accounts.pool,
            &ctx.accounts.config,
            ctx.accounts.pool_control_authority.as_deref(),
            ctx.accounts.authority.key(),
        ),
        OmegaXProtocolError::RedemptionRequestUnauthorized
    );
    require_keys_eq!(
        ctx.accounts.redemption_request.payout_mint,
        ctx.accounts.payout_mint.key(),
        OmegaXProtocolError::PayoutMintMismatch
    );
    let now = Clock::get()?.unix_timestamp;
    let amount_out = compute_redeem_amount_out_against_free_capital(
        ctx.accounts.redemption_request.shares_requested,
        ctx.accounts.pool_share_mint.supply,
        ctx.accounts.pool_vault_token_account.amount,
        &ctx.accounts.pool_treasury_reserve,
    )?;
    require!(
        amount_out >= ctx.accounts.redemption_request.min_amount_out,
        OmegaXProtocolError::SlippageExceeded
    );

    let pool_key = ctx.accounts.pool.key();
    let request_hash = ctx.accounts.redemption_request.request_hash;
    let signer_seeds: &[&[u8]] = &[
        SEED_REDEMPTION_REQUEST,
        pool_key.as_ref(),
        ctx.accounts.redemption_request.redeemer.as_ref(),
        request_hash.as_ref(),
        &[ctx.accounts.redemption_request.bump],
    ];
    let signer_groups = [signer_seeds];
    let burn_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.pool_share_mint.to_account_info(),
            from: ctx
                .accounts
                .redemption_request_share_escrow
                .to_account_info(),
            authority: ctx.accounts.redemption_request.to_account_info(),
        },
        &signer_groups,
    );
    token::burn(burn_ctx, ctx.accounts.redemption_request.shares_requested)?;
    transfer_spl_reward(
        &ctx.accounts.pool_asset_vault,
        &ctx.accounts.pool_vault_token_account,
        &ctx.accounts.redeemer_payout_token_account,
        &ctx.accounts.token_program,
        amount_out,
    )?;

    fulfill_redemption_request(&mut ctx.accounts.redemption_request, now, amount_out)?;
    emit!(PoolRedemptionStatusChangedEvent {
        pool: pool_key,
        redeemer: ctx.accounts.redemption_request.redeemer,
        request_hash,
        status: REDEMPTION_REQUEST_STATUS_FULFILLED,
        amount_out,
        failure_code: 0,
    });
    Ok(())
}
