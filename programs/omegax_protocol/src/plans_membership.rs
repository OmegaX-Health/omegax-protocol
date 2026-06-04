// SPDX-License-Identifier: AGPL-3.0-or-later

//! Health-plan and policy-series instruction handlers and account validation contexts.

use crate::platform::*;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
use crate::types::*;
#[cfg(feature = "quasar")]
use quasar_lang::sysvars::Sysvar;

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_health_plan(
    ctx: Context<CreateHealthPlan>,
    args: CreateHealthPlanArgs,
) -> Result<()> {
    require_id(&args.plan_id)?;
    require!(
        ctx.accounts.reserve_domain.active,
        OmegaXProtocolError::ReserveDomainInactive
    );
    require_domain_control(&ctx.accounts.plan_admin.key(), &ctx.accounts.reserve_domain)?;

    let plan = &mut ctx.accounts.health_plan;
    plan.reserve_domain = ctx.accounts.reserve_domain.key();
    plan.sponsor = args.sponsor;
    plan.plan_admin = ctx.accounts.plan_admin.key();
    plan.sponsor_operator = args.sponsor_operator;
    plan.claims_operator = args.claims_operator;
    plan.oracle_authority = args.oracle_authority;
    plan.health_plan_id = args.plan_id;
    plan.display_name = args.display_name;
    plan.organization_ref = args.organization_ref;
    plan.metadata_uri = args.metadata_uri;
    plan.allowed_rail_mask = args.allowed_rail_mask;
    plan.default_funding_priority = args.default_funding_priority;
    plan.oracle_policy_hash = args.oracle_policy_hash;
    plan.schema_binding_hash = args.schema_binding_hash;
    plan.compliance_baseline_hash = args.compliance_baseline_hash;
    plan.pause_flags = args.pause_flags;
    plan.active = true;
    plan.audit_nonce = 0;
    plan.bump = ctx.bumps.health_plan;

    emit!(HealthPlanCreatedEvent {
        reserve_domain: plan.reserve_domain,
        health_plan: plan.key(),
        sponsor: plan.sponsor,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn update_health_plan_controls(
    ctx: Context<UpdateHealthPlanControls>,
    args: UpdateHealthPlanControlsArgs,
) -> Result<()> {
    require_plan_control(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;

    let plan = &mut ctx.accounts.health_plan;
    plan.sponsor_operator = args.sponsor_operator;
    plan.claims_operator = args.claims_operator;
    plan.oracle_authority = args.oracle_authority;
    plan.allowed_rail_mask = args.allowed_rail_mask;
    plan.default_funding_priority = args.default_funding_priority;
    plan.oracle_policy_hash = args.oracle_policy_hash;
    plan.schema_binding_hash = args.schema_binding_hash;
    plan.compliance_baseline_hash = args.compliance_baseline_hash;
    plan.pause_flags = args.pause_flags;
    plan.active = args.active;
    plan.audit_nonce = plan.audit_nonce.saturating_add(1);

    emit!(ScopedControlChangedEvent {
        scope_kind: ScopeKind::HealthPlan as u8,
        scope: plan.key(),
        authority: ctx.accounts.authority.key(),
        pause_flags: plan.pause_flags,
        reason_hash: args.reason_hash,
        audit_nonce: plan.audit_nonce,
    });

    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_plan_control(authority: &Pubkey, plan: &HealthPlanAccountData<'_>) -> Result<()> {
    if *authority == plan.plan_admin || *authority == plan.sponsor_operator {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

#[cfg(feature = "quasar")]
#[inline(always)]
fn require_quasar_domain_control(
    authority: &Pubkey,
    domain: &ReserveDomainAccountData<'_>,
) -> Result<()> {
    if *authority == domain.domain_admin {
        Ok(())
    } else {
        Err(OmegaXProtocolError::Unauthorized.into())
    }
}

#[cfg(feature = "quasar")]
pub(crate) fn update_health_plan_controls<'info>(
    ctx: &mut Ctx<'info, UpdateHealthPlanControls<'info>>,
    sponsor_operator: Pubkey,
    claims_operator: Pubkey,
    oracle_authority: Pubkey,
    allowed_rail_mask: u16,
    default_funding_priority: u8,
    oracle_policy_hash: [u8; 32],
    schema_binding_hash: [u8; 32],
    compliance_baseline_hash: [u8; 32],
    pause_flags: u32,
    active: bool,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_plan_control(&authority, &ctx.accounts.health_plan)?;

    let plan = &mut ctx.accounts.health_plan;
    let reserve_domain = plan.reserve_domain;
    let sponsor = plan.sponsor;
    let plan_admin = plan.plan_admin;
    let audit_nonce = plan.audit_nonce.get().saturating_add(1);
    let bump = plan.bump;
    let health_plan_id = plan.health_plan_id().to_owned();
    let display_name = plan.display_name().to_owned();
    let organization_ref = plan.organization_ref().to_owned();
    let metadata_uri = plan.metadata_uri().to_owned();

    plan.set_inner(
        reserve_domain,
        sponsor,
        plan_admin,
        sponsor_operator,
        claims_operator,
        oracle_authority,
        allowed_rail_mask,
        default_funding_priority,
        oracle_policy_hash,
        schema_binding_hash,
        compliance_baseline_hash,
        pause_flags,
        active,
        audit_nonce,
        bump,
        &health_plan_id,
        &display_name,
        &organization_ref,
        &metadata_uri,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn create_health_plan<'info>(
    ctx: &mut Ctx<'info, CreateHealthPlan<'info>>,
    sponsor: Pubkey,
    sponsor_operator: Pubkey,
    claims_operator: Pubkey,
    oracle_authority: Pubkey,
    allowed_rail_mask: u16,
    default_funding_priority: u8,
    oracle_policy_hash: [u8; 32],
    schema_binding_hash: [u8; 32],
    compliance_baseline_hash: [u8; 32],
    pause_flags: u32,
    plan_id: &str,
    display_name: &str,
    organization_ref: &str,
    metadata_uri: &str,
) -> Result<()> {
    require_quasar_id(plan_id)?;
    require!(
        ctx.accounts.reserve_domain.active.get(),
        OmegaXProtocolError::ReserveDomainInactive
    );
    let plan_admin = *ctx.accounts.plan_admin.address();
    require_quasar_domain_control(&plan_admin, &ctx.accounts.reserve_domain)?;

    let bump = ctx.accounts.health_plan.bump;
    ctx.accounts.health_plan.set_inner(
        *ctx.accounts.reserve_domain.address(),
        sponsor,
        plan_admin,
        sponsor_operator,
        claims_operator,
        oracle_authority,
        allowed_rail_mask,
        default_funding_priority,
        oracle_policy_hash,
        schema_binding_hash,
        compliance_baseline_hash,
        pause_flags,
        true,
        0,
        bump,
        plan_id,
        display_name,
        organization_ref,
        metadata_uri,
        ctx.accounts.plan_admin.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn create_policy_series<'info>(
    ctx: &mut Ctx<'info, CreatePolicySeries<'info>>,
    asset_mint: Pubkey,
    mode: u8,
    status: u8,
    adjudication_mode: u8,
    terms_hash: [u8; 32],
    pricing_hash: [u8; 32],
    payout_hash: [u8; 32],
    reserve_model_hash: [u8; 32],
    comparability_hash: [u8; 32],
    policy_overrides_hash: [u8; 32],
    cycle_seconds: i64,
    terms_version: u16,
    series_id: &str,
    display_name: &str,
    metadata_uri: &str,
) -> Result<()> {
    require_quasar_id(series_id)?;
    let authority = *ctx.accounts.authority.address();
    require_quasar_plan_control(&authority, &ctx.accounts.health_plan)?;

    let live_since_ts = if status == SERIES_STATUS_ACTIVE {
        Clock::get()?.unix_timestamp.get()
    } else {
        0
    };
    let policy_series_bump = ctx.accounts.policy_series.bump;
    ctx.accounts.policy_series.set_inner(
        ctx.accounts.health_plan.reserve_domain,
        *ctx.accounts.health_plan.address(),
        asset_mint,
        mode,
        status,
        adjudication_mode,
        terms_hash,
        pricing_hash,
        payout_hash,
        reserve_model_hash,
        comparability_hash,
        policy_overrides_hash,
        cycle_seconds,
        terms_version,
        ZERO_PUBKEY,
        ZERO_PUBKEY,
        live_since_ts,
        status == SERIES_STATUS_ACTIVE,
        policy_series_bump,
        series_id,
        display_name,
        metadata_uri,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(feature = "quasar")]
pub(crate) fn version_policy_series<'info>(
    ctx: &mut Ctx<'info, VersionPolicySeries<'info>>,
    status: u8,
    adjudication_mode: u8,
    terms_hash: [u8; 32],
    pricing_hash: [u8; 32],
    payout_hash: [u8; 32],
    reserve_model_hash: [u8; 32],
    comparability_hash: [u8; 32],
    policy_overrides_hash: [u8; 32],
    cycle_seconds: i64,
    series_id: &str,
    display_name: &str,
    metadata_uri: &str,
) -> Result<()> {
    let authority = *ctx.accounts.authority.address();
    require_quasar_plan_control(&authority, &ctx.accounts.health_plan)?;
    require!(
        ctx.accounts.current_policy_series.health_plan == *ctx.accounts.health_plan.address(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_quasar_id(series_id)?;

    let current_key = *ctx.accounts.current_policy_series.address();
    let next_key = *ctx.accounts.next_policy_series.address();
    let current_reserve_domain = ctx.accounts.current_policy_series.reserve_domain;
    let current_health_plan = ctx.accounts.current_policy_series.health_plan;
    let current_asset_mint = ctx.accounts.current_policy_series.asset_mint;
    let current_mode = ctx.accounts.current_policy_series.mode;
    let current_adjudication_mode = ctx.accounts.current_policy_series.adjudication_mode;
    let current_terms_hash = ctx.accounts.current_policy_series.terms_hash;
    let current_pricing_hash = ctx.accounts.current_policy_series.pricing_hash;
    let current_payout_hash = ctx.accounts.current_policy_series.payout_hash;
    let current_reserve_model_hash = ctx.accounts.current_policy_series.reserve_model_hash;
    let current_comparability_hash = ctx.accounts.current_policy_series.comparability_hash;
    let current_policy_overrides_hash = ctx.accounts.current_policy_series.policy_overrides_hash;
    let current_cycle_seconds = ctx.accounts.current_policy_series.cycle_seconds.get();
    let current_terms_version = ctx.accounts.current_policy_series.terms_version.get();
    let current_prior_series = ctx.accounts.current_policy_series.prior_series;
    let current_live_since_ts = ctx.accounts.current_policy_series.live_since_ts.get();
    let current_material_locked = ctx.accounts.current_policy_series.material_locked.get();
    let current_bump = ctx.accounts.current_policy_series.bump;
    let current_series_id = ctx.accounts.current_policy_series.series_id().to_owned();
    let current_display_name = ctx.accounts.current_policy_series.display_name().to_owned();
    let current_metadata_uri = ctx.accounts.current_policy_series.metadata_uri().to_owned();

    ctx.accounts.current_policy_series.set_inner(
        current_reserve_domain,
        current_health_plan,
        current_asset_mint,
        current_mode,
        SERIES_STATUS_CLOSED,
        current_adjudication_mode,
        current_terms_hash,
        current_pricing_hash,
        current_payout_hash,
        current_reserve_model_hash,
        current_comparability_hash,
        current_policy_overrides_hash,
        current_cycle_seconds,
        current_terms_version,
        current_prior_series,
        next_key,
        current_live_since_ts,
        current_material_locked,
        current_bump,
        &current_series_id,
        &current_display_name,
        &current_metadata_uri,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    let live_since_ts = if status == SERIES_STATUS_ACTIVE {
        Clock::get()?.unix_timestamp.get()
    } else {
        0
    };
    let next_bump = ctx.accounts.next_policy_series.bump;
    let next_terms_version = current_terms_version.saturating_add(1);
    ctx.accounts.next_policy_series.set_inner(
        current_reserve_domain,
        current_health_plan,
        current_asset_mint,
        current_mode,
        status,
        adjudication_mode,
        terms_hash,
        pricing_hash,
        payout_hash,
        reserve_model_hash,
        comparability_hash,
        policy_overrides_hash,
        cycle_seconds,
        next_terms_version,
        current_key,
        ZERO_PUBKEY,
        live_since_ts,
        status == SERIES_STATUS_ACTIVE,
        next_bump,
        series_id,
        display_name,
        metadata_uri,
        ctx.accounts.authority.to_account_view(),
        None,
    )?;

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn create_policy_series(
    ctx: Context<CreatePolicySeries>,
    args: CreatePolicySeriesArgs,
) -> Result<()> {
    require_id(&args.series_id)?;
    require_plan_control(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;

    let series = &mut ctx.accounts.policy_series;
    series.reserve_domain = ctx.accounts.health_plan.reserve_domain;
    series.health_plan = ctx.accounts.health_plan.key();
    series.asset_mint = args.asset_mint;
    series.series_id = args.series_id;
    series.display_name = args.display_name;
    series.metadata_uri = args.metadata_uri;
    series.mode = args.mode;
    series.status = args.status;
    series.adjudication_mode = args.adjudication_mode;
    series.terms_hash = args.terms_hash;
    series.pricing_hash = args.pricing_hash;
    series.payout_hash = args.payout_hash;
    series.reserve_model_hash = args.reserve_model_hash;
    series.comparability_hash = args.comparability_hash;
    series.policy_overrides_hash = args.policy_overrides_hash;
    series.cycle_seconds = args.cycle_seconds;
    series.terms_version = args.terms_version;
    series.prior_series = ZERO_PUBKEY;
    series.successor_series = ZERO_PUBKEY;
    series.live_since_ts = if args.status == SERIES_STATUS_ACTIVE {
        Clock::get()?.unix_timestamp
    } else {
        0
    };
    series.material_locked = args.status == SERIES_STATUS_ACTIVE;
    series.bump = ctx.bumps.policy_series;

    emit!(PolicySeriesCreatedEvent {
        health_plan: series.health_plan,
        policy_series: series.key(),
        asset_mint: series.asset_mint,
        mode: series.mode,
        terms_version: series.terms_version,
    });

    Ok(())
}

#[cfg(not(feature = "quasar"))]
pub(crate) fn version_policy_series(
    ctx: Context<VersionPolicySeries>,
    args: VersionPolicySeriesArgs,
) -> Result<()> {
    require_plan_control(&ctx.accounts.authority.key(), &ctx.accounts.health_plan)?;
    require!(
        ctx.accounts.current_policy_series.health_plan == ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );
    require_id(&args.series_id)?;

    let current = &mut ctx.accounts.current_policy_series;
    current.successor_series = ctx.accounts.next_policy_series.key();
    current.status = SERIES_STATUS_CLOSED;

    let next = &mut ctx.accounts.next_policy_series;
    next.reserve_domain = current.reserve_domain;
    next.health_plan = current.health_plan;
    next.asset_mint = current.asset_mint;
    next.series_id = args.series_id;
    next.display_name = args.display_name;
    next.metadata_uri = args.metadata_uri;
    next.mode = current.mode;
    next.status = args.status;
    next.adjudication_mode = args.adjudication_mode;
    next.terms_hash = args.terms_hash;
    next.pricing_hash = args.pricing_hash;
    next.payout_hash = args.payout_hash;
    next.reserve_model_hash = args.reserve_model_hash;
    next.comparability_hash = args.comparability_hash;
    next.policy_overrides_hash = args.policy_overrides_hash;
    next.cycle_seconds = args.cycle_seconds;
    next.terms_version = current.terms_version.saturating_add(1);
    next.prior_series = current.key();
    next.successor_series = ZERO_PUBKEY;
    next.live_since_ts = if args.status == SERIES_STATUS_ACTIVE {
        Clock::get()?.unix_timestamp
    } else {
        0
    };
    next.material_locked = args.status == SERIES_STATUS_ACTIVE;
    next.bump = ctx.bumps.next_policy_series;

    emit!(PolicySeriesVersionedEvent {
        prior_series: current.key(),
        next_series: next.key(),
        new_terms_version: next.terms_version,
    });

    Ok(())
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: CreateHealthPlanArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _sponsor: Pubkey,
        _sponsor_operator: Pubkey,
        _claims_operator: Pubkey,
        _oracle_authority: Pubkey,
        _allowed_rail_mask: u16,
        _default_funding_priority: u8,
        _oracle_policy_hash: [u8; 32],
        _schema_binding_hash: [u8; 32],
        _compliance_baseline_hash: [u8; 32],
        _pause_flags: u32,
        plan_id: String<u32, 32>
    )
)]
pub struct CreateHealthPlan<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub plan_admin: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub plan_admin: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            reserve_domain.address(),
            &crate::ID,
            &[SEED_RESERVE_DOMAIN, reserve_domain.domain_id().as_bytes()],
            reserve_domain.bump,
        ) @ OmegaXProtocolError::ReserveDomainMismatch
    )]
    pub reserve_domain: Account<ReserveDomainAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = plan_admin,
            space = 8 + HealthPlan::INIT_SPACE,
            seeds = [SEED_HEALTH_PLAN, reserve_domain.key().as_ref(), args.plan_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub health_plan: Account<'info, HealthPlan>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                health_plan.address(),
                &crate::ID,
                &[SEED_HEALTH_PLAN, reserve_domain.address().as_ref(), plan_id],
                health_plan.bump,
            ) @ OmegaXProtocolError::HealthPlanMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
pub struct UpdateHealthPlanControls<'info> {
    #[cfg(not(feature = "quasar"))]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            health_plan.address(),
            &crate::ID,
            &[SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id().as_bytes()],
            health_plan.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch
    )]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: CreatePolicySeriesArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _asset_mint: Pubkey,
        _mode: u8,
        _status: u8,
        _adjudication_mode: u8,
        _terms_hash: [u8; 32],
        _pricing_hash: [u8; 32],
        _payout_hash: [u8; 32],
        _reserve_model_hash: [u8; 32],
        _comparability_hash: [u8; 32],
        _policy_overrides_hash: [u8; 32],
        _cycle_seconds: i64,
        _terms_version: u16,
        series_id: String<u32, 32>
    )
)]
pub struct CreatePolicySeries<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            health_plan.address(),
            &crate::ID,
            &[SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id().as_bytes()],
            health_plan.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch
    )]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + PolicySeries::INIT_SPACE,
            seeds = [SEED_POLICY_SERIES, health_plan.key().as_ref(), args.series_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub policy_series: Account<'info, PolicySeries>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                policy_series.address(),
                &crate::ID,
                &[SEED_POLICY_SERIES, health_plan.address().as_ref(), series_id],
                policy_series.bump,
            ) @ OmegaXProtocolError::PolicySeriesMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub policy_series: Account<PolicySeriesAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}

#[derive(Accounts)]
#[cfg_attr(not(feature = "quasar"), instruction(args: VersionPolicySeriesArgs))]
#[cfg_attr(
    feature = "quasar",
    instruction(
        _status: u8,
        _adjudication_mode: u8,
        _terms_hash: [u8; 32],
        _pricing_hash: [u8; 32],
        _payout_hash: [u8; 32],
        _reserve_model_hash: [u8; 32],
        _comparability_hash: [u8; 32],
        _policy_overrides_hash: [u8; 32],
        _cycle_seconds: i64,
        series_id: String<u32, 32>
    )
)]
pub struct VersionPolicySeries<'info> {
    #[cfg(not(feature = "quasar"))]
    #[account(mut)]
    pub authority: Signer<'info>,
    #[cfg(feature = "quasar")]
    pub authority: &'info Signer,
    #[cfg(not(feature = "quasar"))]
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[cfg(feature = "quasar")]
    #[account(
        constraint = quasar_pda_matches(
            health_plan.address(),
            &crate::ID,
            &[SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id().as_bytes()],
            health_plan.bump,
        ) @ OmegaXProtocolError::HealthPlanMismatch
    )]
    pub health_plan: Account<HealthPlanAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    #[account(mut, seeds = [SEED_POLICY_SERIES, health_plan.key().as_ref(), current_policy_series.series_id.as_bytes()], bump = current_policy_series.bump)]
    pub current_policy_series: Box<Account<'info, PolicySeries>>,
    #[cfg(feature = "quasar")]
    #[account(
        mut,
        constraint = quasar_pda_matches(
            current_policy_series.address(),
            &crate::ID,
            &[SEED_POLICY_SERIES, health_plan.address().as_ref(), current_policy_series.series_id().as_bytes()],
            current_policy_series.bump,
        ) @ OmegaXProtocolError::PolicySeriesMismatch
    )]
    pub current_policy_series: Account<PolicySeriesAccountData<'info>>,
    #[cfg_attr(
        not(feature = "quasar"),
        account(
            init,
            payer = authority,
            space = 8 + PolicySeries::INIT_SPACE,
            seeds = [SEED_POLICY_SERIES, health_plan.key().as_ref(), args.series_id.as_bytes()],
            bump
        )
    )]
    #[cfg(not(feature = "quasar"))]
    pub next_policy_series: Box<Account<'info, PolicySeries>>,
    #[cfg_attr(
        feature = "quasar",
        account(
            mut,
            constraint = quasar_pda_matches(
                next_policy_series.address(),
                &crate::ID,
                &[SEED_POLICY_SERIES, health_plan.address().as_ref(), series_id],
                next_policy_series.bump,
            ) @ OmegaXProtocolError::PolicySeriesMismatch
        )
    )]
    #[cfg(feature = "quasar")]
    pub next_policy_series: Account<PolicySeriesAccountData<'info>>,
    #[cfg(not(feature = "quasar"))]
    pub system_program: Program<'info, System>,
    #[cfg(feature = "quasar")]
    pub system_program: &'info Program<System>,
}
