// SPDX-License-Identifier: AGPL-3.0-or-later

//! Oracle registry, pool-oracle policy, and outcome-schema instruction handlers and account validation contexts.

use anchor_lang::prelude::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;

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

pub(crate) fn set_pool_oracle(ctx: Context<SetPoolOracle>, args: SetPoolOracleArgs) -> Result<()> {
    require_pool_control(
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

pub(crate) fn set_pool_oracle_permissions(
    ctx: Context<SetPoolOraclePermissions>,
    args: SetPoolOraclePermissionsArgs,
) -> Result<()> {
    require_pool_control(
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

pub(crate) fn set_pool_oracle_policy(
    ctx: Context<SetPoolOraclePolicy>,
    args: SetPoolOraclePolicyArgs,
) -> Result<()> {
    require_pool_control(
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

#[derive(Accounts)]
#[instruction(args: RegisterOracleArgs)]
pub struct RegisterOracle<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + OracleProfile::INIT_SPACE,
        seeds = [SEED_ORACLE_PROFILE, args.oracle.as_ref()],
        bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimOracle<'info> {
    pub oracle: Signer<'info>,
    #[account(
        mut,
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
}

#[derive(Accounts)]
pub struct UpdateOracleProfile<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        mut,
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
}

#[derive(Accounts)]
pub struct SetPoolOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PoolOracleApproval::INIT_SPACE,
        seeds = [SEED_POOL_ORACLE_APPROVAL, liquidity_pool.key().as_ref(), oracle_profile.oracle.as_ref()],
        bump
    )]
    pub pool_oracle_approval: Account<'info, PoolOracleApproval>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolOraclePermissions<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump
    )]
    pub oracle_profile: Account<'info, OracleProfile>,
    #[account(
        seeds = [SEED_POOL_ORACLE_APPROVAL, liquidity_pool.key().as_ref(), oracle_profile.oracle.as_ref()],
        bump = pool_oracle_approval.bump
    )]
    pub pool_oracle_approval: Account<'info, PoolOracleApproval>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PoolOraclePermissionSet::INIT_SPACE,
        seeds = [SEED_POOL_ORACLE_PERMISSION_SET, liquidity_pool.key().as_ref(), oracle_profile.oracle.as_ref()],
        bump
    )]
    pub pool_oracle_permission_set: Account<'info, PoolOraclePermissionSet>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPoolOraclePolicy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PoolOraclePolicy::INIT_SPACE,
        seeds = [SEED_POOL_ORACLE_POLICY, liquidity_pool.key().as_ref()],
        bump
    )]
    pub pool_oracle_policy: Account<'info, PoolOraclePolicy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: RegisterOutcomeSchemaArgs)]
pub struct RegisterOutcomeSchema<'info> {
    #[account(mut)]
    pub publisher: Signer<'info>,
    #[account(
        init,
        payer = publisher,
        space = 8 + OutcomeSchema::INIT_SPACE,
        seeds = [SEED_OUTCOME_SCHEMA, args.schema_key_hash.as_ref()],
        bump
    )]
    pub outcome_schema: Account<'info, OutcomeSchema>,
    #[account(
        init,
        payer = publisher,
        space = 8 + SchemaDependencyLedger::INIT_SPACE,
        seeds = [SEED_SCHEMA_DEPENDENCY_LEDGER, args.schema_key_hash.as_ref()],
        bump
    )]
    pub schema_dependency_ledger: Account<'info, SchemaDependencyLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyOutcomeSchema<'info> {
    pub governance_authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        mut,
        seeds = [SEED_OUTCOME_SCHEMA, outcome_schema.schema_key_hash.as_ref()],
        bump = outcome_schema.bump
    )]
    pub outcome_schema: Account<'info, OutcomeSchema>,
}

#[derive(Accounts)]
#[instruction(args: BackfillSchemaDependencyLedgerArgs)]
pub struct BackfillSchemaDependencyLedger<'info> {
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_OUTCOME_SCHEMA, args.schema_key_hash.as_ref()],
        bump = outcome_schema.bump
    )]
    pub outcome_schema: Account<'info, OutcomeSchema>,
    #[account(
        init_if_needed,
        payer = governance_authority,
        space = 8 + SchemaDependencyLedger::INIT_SPACE,
        seeds = [SEED_SCHEMA_DEPENDENCY_LEDGER, args.schema_key_hash.as_ref()],
        bump
    )]
    pub schema_dependency_ledger: Account<'info, SchemaDependencyLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseOutcomeSchema<'info> {
    pub governance_authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        mut,
        seeds = [SEED_OUTCOME_SCHEMA, outcome_schema.schema_key_hash.as_ref()],
        bump = outcome_schema.bump,
        close = recipient_system_account
    )]
    pub outcome_schema: Account<'info, OutcomeSchema>,
    #[account(
        mut,
        seeds = [SEED_SCHEMA_DEPENDENCY_LEDGER, outcome_schema.schema_key_hash.as_ref()],
        bump = schema_dependency_ledger.bump,
        close = recipient_system_account
    )]
    pub schema_dependency_ledger: Account<'info, SchemaDependencyLedger>,
    #[account(mut)]
    pub recipient_system_account: SystemAccount<'info>,
}
