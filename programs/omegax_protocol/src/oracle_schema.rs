// SPDX-License-Identifier: AGPL-3.0-or-later

//! Oracle registry, pool-oracle policy, and outcome-schema instruction handlers and account validation contexts.

use crate::platform::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;

#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
pub(crate) fn register_oracle(
    ctx: Context<RegisterOracle>,
    args: RegisterOracleArgs,
) -> Result<()> {
    // PT-2026-04-27-07 fix: the signer registering the profile must be the
    // oracle key itself. Closes the squat-then-recover gap where any wallet
    // could pre-register an oracle profile under a target oracle's pubkey
    // and control the metadata until the rightful oracle ran claim_oracle.
    require_keys_eq!(
        ctx.accounts.admin.key(),
        args.oracle,
        OmegaXProtocolError::Unauthorized
    );
    validate_oracle_profile_fields(&args)?;

    let now_ts = Clock::get()?.unix_timestamp;
    let profile = &mut ctx.accounts.oracle_profile;
    profile.oracle = args.oracle;
    profile.admin = ctx.accounts.admin.key();
    profile.oracle_type = args.oracle_type;
    profile.display_name = args.display_name;
    profile.legal_name = args.legal_name;
    profile.website_url = args.website_url;
    profile.app_url = args.app_url;
    profile.logo_uri = args.logo_uri;
    profile.webhook_url = args.webhook_url;
    profile.supported_schema_count = args.supported_schema_key_hashes.len() as u8;
    write_supported_schema_hashes(
        &mut profile.supported_schema_key_hashes,
        &args.supported_schema_key_hashes,
    );
    profile.active = true;
    profile.claimed = ctx.accounts.admin.key() == args.oracle;
    profile.created_at_ts = now_ts;
    profile.updated_at_ts = now_ts;
    profile.bump = ctx.bumps.oracle_profile;

    emit!(OracleProfileRegisteredEvent {
        oracle_profile: profile.key(),
        oracle: profile.oracle,
        admin: profile.admin,
        oracle_type: profile.oracle_type,
        claimed: profile.claimed,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn claim_oracle(ctx: Context<ClaimOracle>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.oracle.key(),
        ctx.accounts.oracle_profile.oracle,
        OmegaXProtocolError::Unauthorized
    );

    let profile = &mut ctx.accounts.oracle_profile;
    profile.admin = ctx.accounts.oracle.key();
    profile.claimed = true;
    profile.updated_at_ts = Clock::get()?.unix_timestamp;

    emit!(OracleProfileClaimedEvent {
        oracle_profile: profile.key(),
        oracle: profile.oracle,
        admin: profile.admin,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn claim_oracle<'info>(ctx: &mut Ctx<'info, ClaimOracle<'info>>) -> Result<()> {
    let oracle = *ctx.accounts.oracle.address();
    require_keys_eq!(
        oracle,
        ctx.accounts.oracle_profile.oracle,
        OmegaXProtocolError::Unauthorized
    );

    let profile = &mut ctx.accounts.oracle_profile;
    let oracle_type = profile.oracle_type;
    let supported_schema_count = profile.supported_schema_count;
    let supported_schema_key_hashes = profile.supported_schema_key_hashes;
    let active = profile.active.get();
    let created_at_ts = profile.created_at_ts.get();
    let updated_at_ts = Clock::get()?.unix_timestamp.get();
    let bump = profile.bump;
    let display_name = profile.display_name().to_owned();
    let legal_name = profile.legal_name().to_owned();
    let website_url = profile.website_url().to_owned();
    let app_url = profile.app_url().to_owned();
    let logo_uri = profile.logo_uri().to_owned();
    let webhook_url = profile.webhook_url().to_owned();

    profile.set_inner(
        oracle,
        oracle,
        oracle_type,
        supported_schema_count,
        supported_schema_key_hashes,
        active,
        true,
        created_at_ts,
        updated_at_ts,
        bump,
        &display_name,
        &legal_name,
        &website_url,
        &app_url,
        &logo_uri,
        &webhook_url,
        ctx.accounts.oracle.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn update_oracle_profile(
    ctx: Context<UpdateOracleProfile>,
    args: UpdateOracleProfileArgs,
) -> Result<()> {
    require_oracle_profile_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.oracle_profile,
    )?;
    validate_oracle_profile_fields_update(&args)?;

    let profile = &mut ctx.accounts.oracle_profile;
    profile.oracle_type = args.oracle_type;
    profile.display_name = args.display_name;
    profile.legal_name = args.legal_name;
    profile.website_url = args.website_url;
    profile.app_url = args.app_url;
    profile.logo_uri = args.logo_uri;
    profile.webhook_url = args.webhook_url;
    profile.supported_schema_count = args.supported_schema_key_hashes.len() as u8;
    write_supported_schema_hashes(
        &mut profile.supported_schema_key_hashes,
        &args.supported_schema_key_hashes,
    );
    profile.updated_at_ts = Clock::get()?.unix_timestamp;

    emit!(OracleProfileUpdatedEvent {
        oracle_profile: profile.key(),
        oracle: profile.oracle,
        authority: ctx.accounts.authority.key(),
        oracle_type: profile.oracle_type,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn set_pool_oracle(ctx: Context<SetPoolOracle>, args: SetPoolOracleArgs) -> Result<()> {
    require_curator_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    if args.active {
        require!(
            ctx.accounts.oracle_profile.active,
            OmegaXProtocolError::OracleProfileInactive
        );
    }

    let approval = &mut ctx.accounts.pool_oracle_approval;
    approval.liquidity_pool = ctx.accounts.liquidity_pool.key();
    approval.oracle = ctx.accounts.oracle_profile.oracle;
    approval.active = args.active;
    approval.updated_at_ts = Clock::get()?.unix_timestamp;
    approval.bump = ctx.bumps.pool_oracle_approval;

    emit!(PoolOracleApprovalChangedEvent {
        liquidity_pool: approval.liquidity_pool,
        oracle: approval.oracle,
        authority: ctx.accounts.authority.key(),
        active: approval.active,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn set_pool_oracle_permissions(
    ctx: Context<SetPoolOraclePermissions>,
    args: SetPoolOraclePermissionsArgs,
) -> Result<()> {
    require_curator_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    require!(
        ctx.accounts.pool_oracle_approval.active || args.permissions == 0,
        OmegaXProtocolError::PoolOracleApprovalRequired
    );

    let permission_set = &mut ctx.accounts.pool_oracle_permission_set;
    permission_set.liquidity_pool = ctx.accounts.liquidity_pool.key();
    permission_set.oracle = ctx.accounts.oracle_profile.oracle;
    permission_set.permissions = args.permissions;
    permission_set.updated_at_ts = Clock::get()?.unix_timestamp;
    permission_set.bump = ctx.bumps.pool_oracle_permission_set;

    emit!(PoolOraclePermissionsChangedEvent {
        liquidity_pool: permission_set.liquidity_pool,
        oracle: permission_set.oracle,
        authority: ctx.accounts.authority.key(),
        permissions: permission_set.permissions,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn set_pool_oracle_policy(
    ctx: Context<SetPoolOraclePolicy>,
    args: SetPoolOraclePolicyArgs,
) -> Result<()> {
    require_curator_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.liquidity_pool,
    )?;
    require!(
        args.quorum_m > 0 && args.quorum_n > 0 && args.quorum_m <= args.quorum_n,
        OmegaXProtocolError::InvalidOracleQuorum
    );
    require!(
        args.oracle_fee_bps <= MAX_CONFIGURED_FEE_BPS,
        OmegaXProtocolError::InvalidBps
    );

    let policy = &mut ctx.accounts.pool_oracle_policy;
    policy.liquidity_pool = ctx.accounts.liquidity_pool.key();
    policy.quorum_m = args.quorum_m;
    policy.quorum_n = args.quorum_n;
    policy.require_verified_schema = args.require_verified_schema;
    policy.oracle_fee_bps = args.oracle_fee_bps;
    policy.allow_delegate_claim = args.allow_delegate_claim;
    policy.challenge_window_secs = args.challenge_window_secs;
    policy.updated_at_ts = Clock::get()?.unix_timestamp;
    policy.bump = ctx.bumps.pool_oracle_policy;

    emit!(PoolOraclePolicyChangedEvent {
        liquidity_pool: policy.liquidity_pool,
        authority: ctx.accounts.authority.key(),
        quorum_m: policy.quorum_m,
        quorum_n: policy.quorum_n,
        oracle_fee_bps: policy.oracle_fee_bps,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn register_outcome_schema(
    ctx: Context<RegisterOutcomeSchema>,
    args: RegisterOutcomeSchemaArgs,
) -> Result<()> {
    validate_outcome_schema_fields(&args)?;

    let now_ts = Clock::get()?.unix_timestamp;
    let schema = &mut ctx.accounts.outcome_schema;
    schema.publisher = ctx.accounts.publisher.key();
    schema.schema_key_hash = args.schema_key_hash;
    schema.schema_key = args.schema_key;
    schema.version = args.version;
    schema.schema_hash = args.schema_hash;
    schema.schema_family = args.schema_family;
    schema.visibility = args.visibility;
    schema.metadata_uri = args.metadata_uri;
    schema.verified = false;
    schema.created_at_ts = now_ts;
    schema.updated_at_ts = now_ts;
    schema.bump = ctx.bumps.outcome_schema;

    let dependency_ledger = &mut ctx.accounts.schema_dependency_ledger;
    dependency_ledger.schema_key_hash = args.schema_key_hash;
    dependency_ledger.pool_rule_addresses = Vec::new();
    dependency_ledger.updated_at_ts = now_ts;
    dependency_ledger.bump = ctx.bumps.schema_dependency_ledger;

    emit!(OutcomeSchemaRegisteredEvent {
        outcome_schema: schema.key(),
        publisher: schema.publisher,
        schema_key_hash: schema.schema_key_hash,
        version: schema.version,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn verify_outcome_schema(
    ctx: Context<VerifyOutcomeSchema>,
    args: VerifyOutcomeSchemaArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.governance_authority.key(),
        &ctx.accounts.protocol_governance,
    )?;

    let schema = &mut ctx.accounts.outcome_schema;
    schema.verified = args.verified;
    schema.updated_at_ts = Clock::get()?.unix_timestamp;

    emit!(OutcomeSchemaStateChangedEvent {
        outcome_schema: schema.key(),
        governance_authority: ctx.accounts.governance_authority.key(),
        schema_key_hash: schema.schema_key_hash,
        verified: schema.verified,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_governance(authority: &Pubkey, governance: &ProtocolGovernance) -> Result<()> {
    require_keys_eq!(
        *authority,
        governance.governance_authority,
        OmegaXProtocolError::Unauthorized
    );
    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn verify_outcome_schema<'info>(
    ctx: &mut Ctx<'info, VerifyOutcomeSchema<'info>>,
    verified: bool,
) -> Result<()> {
    let authority = *ctx.accounts.governance_authority.address();
    require_quasar_governance(&authority, &ctx.accounts.protocol_governance)?;

    let schema = &mut ctx.accounts.outcome_schema;
    let publisher = schema.publisher;
    let schema_key_hash = schema.schema_key_hash;
    let version = schema.version.get();
    let schema_hash = schema.schema_hash;
    let schema_family = schema.schema_family;
    let visibility = schema.visibility;
    let created_at_ts = schema.created_at_ts.get();
    let updated_at_ts = Clock::get()?.unix_timestamp.get();
    let bump = schema.bump;
    let schema_key = schema.schema_key().to_owned();
    let metadata_uri = schema.metadata_uri().to_owned();

    schema.set_inner(
        publisher,
        schema_key_hash,
        version,
        schema_hash,
        schema_family,
        visibility,
        verified,
        created_at_ts,
        updated_at_ts,
        bump,
        &schema_key,
        &metadata_uri,
        ctx.accounts.governance_authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn backfill_schema_dependency_ledger(
    ctx: Context<BackfillSchemaDependencyLedger>,
    args: BackfillSchemaDependencyLedgerArgs,
) -> Result<()> {
    require_governance(
        &ctx.accounts.governance_authority.key(),
        &ctx.accounts.protocol_governance,
    )?;
    require!(
        args.pool_rule_addresses.len() <= MAX_SCHEMA_DEPENDENCY_RULES,
        OmegaXProtocolError::TooManySchemaDependencies
    );

    let ledger = &mut ctx.accounts.schema_dependency_ledger;
    ledger.schema_key_hash = ctx.accounts.outcome_schema.schema_key_hash;
    ledger.pool_rule_addresses = args.pool_rule_addresses;
    ledger.updated_at_ts = Clock::get()?.unix_timestamp;
    ledger.bump = ctx.bumps.schema_dependency_ledger;

    emit!(SchemaDependencyLedgerUpdatedEvent {
        schema_dependency_ledger: ledger.key(),
        governance_authority: ctx.accounts.governance_authority.key(),
        schema_key_hash: ledger.schema_key_hash,
        dependency_count: ledger.pool_rule_addresses.len() as u16,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn close_outcome_schema(ctx: Context<CloseOutcomeSchema>) -> Result<()> {
    require_governance(
        &ctx.accounts.governance_authority.key(),
        &ctx.accounts.protocol_governance,
    )?;

    emit!(OutcomeSchemaClosedEvent {
        outcome_schema: ctx.accounts.outcome_schema.key(),
        governance_authority: ctx.accounts.governance_authority.key(),
        schema_key_hash: ctx.accounts.outcome_schema.schema_key_hash,
        recipient: ctx.accounts.recipient_system_account.key(),
    });

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn close_outcome_schema<'info>(
    ctx: &mut Ctx<'info, CloseOutcomeSchema<'info>>,
) -> Result<()> {
    let authority = *ctx.accounts.governance_authority.address();
    require_quasar_governance(&authority, &ctx.accounts.protocol_governance)?;
    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: RegisterOracleArgs))]
#[cfg_attr(feature = "quasar", instruction(oracle: Pubkey))]
pub struct RegisterOracle<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub admin: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub admin: &'info Signer,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = admin,
            space = 8 + OracleProfile::INIT_SPACE,
            seeds = [SEED_ORACLE_PROFILE, args.oracle.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                oracle_profile.address(),
                &crate::ID,
                &[SEED_ORACLE_PROFILE, oracle.as_ref()],
                oracle_profile.bump,
            ) @ OmegaXProtocolError::OracleProfileMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct ClaimOracle<'info> {
    #[cfg(not(feature = "quasar"))]
    pub oracle: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub oracle: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
}

#[derive(Accounts)]
pub struct UpdateOracleProfile<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
}

#[derive(Accounts)]
pub struct SetPoolOracle<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            liquidity_pool.address(),
            &crate::ID,
            &[SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id().as_bytes()],
            liquidity_pool.bump,
        ) @ OmegaXProtocolError::LiquidityPoolMismatch
    )]
    pub liquidity_pool: Account<LiquidityPoolAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = authority,
            space = 8 + PoolOracleApproval::INIT_SPACE,
            seeds = [SEED_POOL_ORACLE_APPROVAL, liquidity_pool.key().as_ref(), oracle_profile.oracle.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_approval: Account<'info, PoolOracleApproval>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                pool_oracle_approval.address(),
                &crate::ID,
                &[SEED_POOL_ORACLE_APPROVAL, liquidity_pool.address().as_ref(), oracle_profile.oracle.as_ref()],
                pool_oracle_approval.bump,
            ) @ OmegaXProtocolError::PoolOracleApprovalRequired
        )
    )]
    #[cfg(feature = "quasar")]
    pub pool_oracle_approval: &'info Account<PoolOracleApproval>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct SetPoolOraclePermissions<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            liquidity_pool.address(),
            &crate::ID,
            &[SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id().as_bytes()],
            liquidity_pool.bump,
        ) @ OmegaXProtocolError::LiquidityPoolMismatch
    )]
    pub liquidity_pool: Account<LiquidityPoolAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            oracle_profile.address(),
            &crate::ID,
            &[SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
            oracle_profile.bump,
        ) @ OmegaXProtocolError::OracleProfileMismatch
    )]
    pub oracle_profile: Account<OracleProfileAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_POOL_ORACLE_APPROVAL, liquidity_pool.key().as_ref(), oracle_profile.oracle.as_ref()],
        bump = pool_oracle_approval.bump
    )]
    pub pool_oracle_approval: Account<'info, PoolOracleApproval>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            pool_oracle_approval.address(),
            &crate::ID,
            &[SEED_POOL_ORACLE_APPROVAL, liquidity_pool.address().as_ref(), oracle_profile.oracle.as_ref()],
            pool_oracle_approval.bump,
        ) @ OmegaXProtocolError::PoolOracleApprovalRequired
    )]
    pub pool_oracle_approval: &'info Account<PoolOracleApproval>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = authority,
            space = 8 + PoolOraclePermissionSet::INIT_SPACE,
            seeds = [SEED_POOL_ORACLE_PERMISSION_SET, liquidity_pool.key().as_ref(), oracle_profile.oracle.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_permission_set: Account<'info, PoolOraclePermissionSet>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                pool_oracle_permission_set.address(),
                &crate::ID,
                &[SEED_POOL_ORACLE_PERMISSION_SET, liquidity_pool.address().as_ref(), oracle_profile.oracle.as_ref()],
                pool_oracle_permission_set.bump,
            ) @ OmegaXProtocolError::PoolOraclePermissionRequired
        )
    )]
    #[cfg(feature = "quasar")]
    pub pool_oracle_permission_set: &'info Account<PoolOraclePermissionSet>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct SetPoolOraclePolicy<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            liquidity_pool.address(),
            &crate::ID,
            &[SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id().as_bytes()],
            liquidity_pool.bump,
        ) @ OmegaXProtocolError::LiquidityPoolMismatch
    )]
    pub liquidity_pool: Account<LiquidityPoolAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = authority,
            space = 8 + PoolOraclePolicy::INIT_SPACE,
            seeds = [SEED_POOL_ORACLE_POLICY, liquidity_pool.key().as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub pool_oracle_policy: Account<'info, PoolOraclePolicy>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                pool_oracle_policy.address(),
                &crate::ID,
                &[SEED_POOL_ORACLE_POLICY, liquidity_pool.address().as_ref()],
                pool_oracle_policy.bump,
            ) @ OmegaXProtocolError::PoolOracleApprovalRequired
        )
    )]
    #[cfg(feature = "quasar")]
    pub pool_oracle_policy: &'info Account<PoolOraclePolicy>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: RegisterOutcomeSchemaArgs))]
#[cfg_attr(feature = "quasar", instruction(schema_key_hash: [u8; 32]))]
pub struct RegisterOutcomeSchema<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub publisher: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub publisher: &'info Signer,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = publisher,
            space = 8 + OutcomeSchema::INIT_SPACE,
            seeds = [SEED_OUTCOME_SCHEMA, args.schema_key_hash.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub outcome_schema: Account<'info, OutcomeSchema>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                outcome_schema.address(),
                &crate::ID,
                &[SEED_OUTCOME_SCHEMA, schema_key_hash.as_ref()],
                outcome_schema.bump,
            ) @ OmegaXProtocolError::ClaimAttestationSchemaRequired
        )
    )]
    #[cfg(feature = "quasar")]
    pub outcome_schema: Account<OutcomeSchemaAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = publisher,
            space = 8 + SchemaDependencyLedger::INIT_SPACE,
            seeds = [SEED_SCHEMA_DEPENDENCY_LEDGER, args.schema_key_hash.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub schema_dependency_ledger: Account<'info, SchemaDependencyLedger>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                schema_dependency_ledger.address(),
                &crate::ID,
                &[SEED_SCHEMA_DEPENDENCY_LEDGER, schema_key_hash.as_ref()],
                schema_dependency_ledger.bump,
            ) @ OmegaXProtocolError::TooManySchemaDependencies
        )
    )]
    #[cfg(feature = "quasar")]
    pub schema_dependency_ledger: Account<SchemaDependencyLedgerAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct VerifyOutcomeSchema<'info> {
    #[cfg(not(feature = "quasar"))]
    pub governance_authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub governance_authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_OUTCOME_SCHEMA, outcome_schema.schema_key_hash.as_ref()],
        bump = outcome_schema.bump
    )]
    pub outcome_schema: Account<'info, OutcomeSchema>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            outcome_schema.address(),
            &crate::ID,
            &[SEED_OUTCOME_SCHEMA, outcome_schema.schema_key_hash.as_ref()],
            outcome_schema.bump,
        ) @ OmegaXProtocolError::ClaimAttestationSchemaRequired
    )]
    pub outcome_schema: Account<OutcomeSchemaAccountData<'info>>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: BackfillSchemaDependencyLedgerArgs))]
#[cfg_attr(feature = "quasar", instruction(schema_key_hash: [u8; 32]))]
pub struct BackfillSchemaDependencyLedger<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub governance_authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        seeds = [SEED_OUTCOME_SCHEMA, args.schema_key_hash.as_ref()],
        bump = outcome_schema.bump
    )]
    pub outcome_schema: Account<'info, OutcomeSchema>,
    #[cfg(feature = "quasar")]
    #[account(
            constraint = quasar_pda_matches(
                outcome_schema.address(),
                &crate::ID,
                &[SEED_OUTCOME_SCHEMA, schema_key_hash.as_ref()],
                outcome_schema.bump,
            ) @ OmegaXProtocolError::ClaimAttestationSchemaRequired
        )]
    pub outcome_schema: Account<OutcomeSchemaAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init_if_needed,
            payer = governance_authority,
            space = 8 + SchemaDependencyLedger::INIT_SPACE,
            seeds = [SEED_SCHEMA_DEPENDENCY_LEDGER, args.schema_key_hash.as_ref()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub schema_dependency_ledger: Account<'info, SchemaDependencyLedger>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                schema_dependency_ledger.address(),
                &crate::ID,
                &[SEED_SCHEMA_DEPENDENCY_LEDGER, schema_key_hash.as_ref()],
                schema_dependency_ledger.bump,
            ) @ OmegaXProtocolError::TooManySchemaDependencies
        )
    )]
    #[cfg(feature = "quasar")]
    pub schema_dependency_ledger: Account<SchemaDependencyLedgerAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct CloseOutcomeSchema<'info> {
    #[cfg(not(feature = "quasar"))]
    pub governance_authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub governance_authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[cfg(feature = "quasar")]
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: &'info Account<ProtocolGovernance>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_OUTCOME_SCHEMA, outcome_schema.schema_key_hash.as_ref()],
        bump = outcome_schema.bump,
        close = recipient_system_account
    )]
    pub outcome_schema: Account<'info, OutcomeSchema>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            outcome_schema.address(),
            &crate::ID,
            &[SEED_OUTCOME_SCHEMA, outcome_schema.schema_key_hash.as_ref()],
            outcome_schema.bump,
        ) @ OmegaXProtocolError::ClaimAttestationSchemaRequired,
        close = recipient_system_account
    )]
    pub outcome_schema: Account<OutcomeSchemaAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(
        mut,
        seeds = [SEED_SCHEMA_DEPENDENCY_LEDGER, outcome_schema.schema_key_hash.as_ref()],
        bump = schema_dependency_ledger.bump,
        close = recipient_system_account
    )]
    pub schema_dependency_ledger: Account<'info, SchemaDependencyLedger>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            schema_dependency_ledger.address(),
            &crate::ID,
            &[SEED_SCHEMA_DEPENDENCY_LEDGER, outcome_schema.schema_key_hash.as_ref()],
            schema_dependency_ledger.bump,
        ) @ OmegaXProtocolError::TooManySchemaDependencies,
        close = recipient_system_account
    )]
    pub schema_dependency_ledger: Account<SchemaDependencyLedgerAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub recipient_system_account: SystemAccount<'info>,
    #[cfg(feature = "quasar")]
    pub recipient_system_account: &'info mut SystemAccount,
}
