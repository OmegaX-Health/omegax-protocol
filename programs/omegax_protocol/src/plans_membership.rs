// SPDX-License-Identifier: AGPL-3.0-or-later

//! Health-plan, policy-series, and member-position instruction handlers and account validation contexts.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::args::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::kernel::*;
use crate::state::*;
use crate::types::*;

pub(crate) fn create_health_plan(
    ctx: Context<CreateHealthPlan>,
    args: CreateHealthPlanArgs,
) -> Result<()> {
    require_id(&args.plan_id)?;
    require!(
        !ctx.accounts.protocol_governance.emergency_pause,
        OmegaXProtocolError::ProtocolEmergencyPaused
    );
    require!(
        ctx.accounts.reserve_domain.active,
        OmegaXProtocolError::ReserveDomainInactive
    );
    validate_membership_gate_config(&args)?;

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
    plan.membership_mode = args.membership_mode;
    plan.membership_gate_kind = args.membership_gate_kind;
    plan.membership_gate_mint = args.membership_gate_mint;
    plan.membership_gate_min_amount = args.membership_gate_min_amount;
    plan.membership_invite_authority = args.membership_invite_authority;
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

pub(crate) fn update_health_plan_controls(
    ctx: Context<UpdateHealthPlanControls>,
    args: UpdateHealthPlanControlsArgs,
) -> Result<()> {
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    validate_membership_gate_update_config(&args)?;

    let plan = &mut ctx.accounts.health_plan;
    plan.sponsor_operator = args.sponsor_operator;
    plan.claims_operator = args.claims_operator;
    plan.oracle_authority = args.oracle_authority;
    plan.membership_mode = args.membership_mode;
    plan.membership_gate_kind = args.membership_gate_kind;
    plan.membership_gate_mint = args.membership_gate_mint;
    plan.membership_gate_min_amount = args.membership_gate_min_amount;
    plan.membership_invite_authority = args.membership_invite_authority;
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

pub(crate) fn create_policy_series(
    ctx: Context<CreatePolicySeries>,
    args: CreatePolicySeriesArgs,
) -> Result<()> {
    require_id(&args.series_id)?;
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;

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
    series.evidence_requirements_hash = args.evidence_requirements_hash;
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

    let ledger = &mut ctx.accounts.series_reserve_ledger;
    ledger.policy_series = series.key();
    ledger.asset_mint = args.asset_mint;
    ledger.sheet = ReserveBalanceSheet::default();
    ledger.bump = ctx.bumps.series_reserve_ledger;

    emit!(PolicySeriesCreatedEvent {
        health_plan: series.health_plan,
        policy_series: series.key(),
        asset_mint: series.asset_mint,
        mode: series.mode,
        terms_version: series.terms_version,
    });

    Ok(())
}

pub(crate) fn initialize_series_reserve_ledger(
    ctx: Context<InitializeSeriesReserveLedger>,
    args: InitializeSeriesReserveLedgerArgs,
) -> Result<()> {
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
    require_keys_eq!(
        ctx.accounts.policy_series.health_plan,
        ctx.accounts.health_plan.key(),
        OmegaXProtocolError::HealthPlanMismatch
    );

    let ledger = &mut ctx.accounts.series_reserve_ledger;
    ledger.policy_series = ctx.accounts.policy_series.key();
    ledger.asset_mint = args.asset_mint;
    ledger.sheet = ReserveBalanceSheet::default();
    ledger.bump = ctx.bumps.series_reserve_ledger;

    emit!(LedgerInitializedEvent {
        scope_kind: ScopeKind::PolicySeries as u8,
        scope: ctx.accounts.policy_series.key(),
        asset_mint: args.asset_mint,
    });

    Ok(())
}

pub(crate) fn version_policy_series(
    ctx: Context<VersionPolicySeries>,
    args: VersionPolicySeriesArgs,
) -> Result<()> {
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;
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
    next.evidence_requirements_hash = args.evidence_requirements_hash;
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

    let ledger = &mut ctx.accounts.next_series_reserve_ledger;
    ledger.policy_series = next.key();
    ledger.asset_mint = next.asset_mint;
    ledger.sheet = ReserveBalanceSheet::default();
    ledger.bump = ctx.bumps.next_series_reserve_ledger;

    emit!(PolicySeriesVersionedEvent {
        prior_series: current.key(),
        next_series: next.key(),
        new_terms_version: next.terms_version,
    });

    Ok(())
}

pub(crate) fn open_member_position(
    ctx: Context<OpenMemberPosition>,
    args: OpenMemberPositionArgs,
) -> Result<()> {
    require!(
        !ctx.accounts.protocol_governance.emergency_pause,
        OmegaXProtocolError::ProtocolEmergencyPaused
    );
    require!(
        ctx.accounts.health_plan.pause_flags & PAUSE_FLAG_PLAN_OPERATIONS == 0,
        OmegaXProtocolError::HealthPlanPaused
    );
    validate_membership_proof(&ctx, &args)?;

    let now_ts = Clock::get()?.unix_timestamp;
    let resolved_anchor_ref = resolved_membership_anchor_ref(
        &ctx.accounts.health_plan,
        ctx.accounts
            .token_gate_account
            .as_ref()
            .map(|account| account.key()),
        args.anchor_ref,
    )?;
    if membership_gate_kind_requires_anchor_seat(
        ctx.accounts.health_plan.membership_mode,
        ctx.accounts.health_plan.membership_gate_kind,
    ) {
        let anchor_seat = ctx
            .accounts
            .membership_anchor_seat
            .as_deref_mut()
            .ok_or(OmegaXProtocolError::MembershipAnchorSeatRequired)?;
        activate_membership_anchor_seat(
            anchor_seat,
            ctx.accounts.health_plan.key(),
            resolved_anchor_ref,
            ctx.accounts.health_plan.membership_gate_kind,
            ctx.accounts.wallet.key(),
            ctx.accounts.member_position.key(),
            now_ts,
            ctx.bumps.membership_anchor_seat,
        )?;
    }

    let member_position = &mut ctx.accounts.member_position;
    member_position.health_plan = ctx.accounts.health_plan.key();
    member_position.policy_series = args.series_scope;
    member_position.wallet = ctx.accounts.wallet.key();
    member_position.subject_commitment = args.subject_commitment;
    member_position.eligibility_status = args.eligibility_status;
    member_position.delegated_rights = args.delegated_rights;
    member_position.enrollment_proof_mode = args.proof_mode;
    member_position.membership_gate_kind = ctx.accounts.health_plan.membership_gate_kind;
    member_position.membership_anchor_ref = resolved_anchor_ref;
    member_position.gate_amount_snapshot = args.token_gate_amount_snapshot;
    member_position.invite_id_hash = args.invite_id_hash;
    member_position.active = true;
    member_position.opened_at = now_ts;
    member_position.updated_at = member_position.opened_at;
    member_position.bump = ctx.bumps.member_position;

    Ok(())
}

pub(crate) fn update_member_eligibility(
    ctx: Context<UpdateMemberEligibility>,
    args: UpdateMemberEligibilityArgs,
) -> Result<()> {
    require_plan_control(
        &ctx.accounts.authority.key(),
        &ctx.accounts.protocol_governance,
        &ctx.accounts.health_plan,
    )?;

    let member_position = &mut ctx.accounts.member_position;
    member_position.eligibility_status = args.eligibility_status;
    member_position.delegated_rights = args.delegated_rights;
    member_position.active = args.active;
    member_position.updated_at = Clock::get()?.unix_timestamp;

    if !args.active
        && membership_gate_kind_requires_anchor_seat(
            health_plan_membership_mode(&ctx.accounts.health_plan),
            member_position.membership_gate_kind,
        )
    {
        let anchor_seat = ctx
            .accounts
            .membership_anchor_seat
            .as_deref_mut()
            .ok_or(OmegaXProtocolError::MembershipAnchorSeatRequired)?;
        require_keys_eq!(
            anchor_seat.health_plan,
            ctx.accounts.health_plan.key(),
            OmegaXProtocolError::MembershipAnchorSeatMismatch
        );
        require_keys_eq!(
            anchor_seat.anchor_ref,
            member_position.membership_anchor_ref,
            OmegaXProtocolError::MembershipAnchorSeatMismatch
        );
        anchor_seat.active = false;
        anchor_seat.updated_at = member_position.updated_at;
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(args: CreateHealthPlanArgs)]
pub struct CreateHealthPlan<'info> {
    #[account(mut)]
    pub plan_admin: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[account(
        init,
        payer = plan_admin,
        space = 8 + HealthPlan::INIT_SPACE,
        seeds = [SEED_HEALTH_PLAN, reserve_domain.key().as_ref(), args.plan_id.as_bytes()],
        bump
    )]
    pub health_plan: Account<'info, HealthPlan>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateHealthPlanControls<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
}

#[derive(Accounts)]
#[instruction(args: CreatePolicySeriesArgs)]
pub struct CreatePolicySeries<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(
        init,
        payer = authority,
        space = 8 + PolicySeries::INIT_SPACE,
        seeds = [SEED_POLICY_SERIES, health_plan.key().as_ref(), args.series_id.as_bytes()],
        bump
    )]
    pub policy_series: Account<'info, PolicySeries>,
    #[account(
        init,
        payer = authority,
        space = 8 + SeriesReserveLedger::INIT_SPACE,
        seeds = [SEED_SERIES_RESERVE_LEDGER, policy_series.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub series_reserve_ledger: Account<'info, SeriesReserveLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: InitializeSeriesReserveLedgerArgs)]
pub struct InitializeSeriesReserveLedger<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(seeds = [SEED_POLICY_SERIES, health_plan.key().as_ref(), policy_series.series_id.as_bytes()], bump = policy_series.bump)]
    pub policy_series: Box<Account<'info, PolicySeries>>,
    #[account(
        init,
        payer = authority,
        space = 8 + SeriesReserveLedger::INIT_SPACE,
        seeds = [SEED_SERIES_RESERVE_LEDGER, policy_series.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub series_reserve_ledger: Box<Account<'info, SeriesReserveLedger>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: VersionPolicySeriesArgs)]
pub struct VersionPolicySeries<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_POLICY_SERIES, health_plan.key().as_ref(), current_policy_series.series_id.as_bytes()], bump = current_policy_series.bump)]
    pub current_policy_series: Box<Account<'info, PolicySeries>>,
    #[account(
        init,
        payer = authority,
        space = 8 + PolicySeries::INIT_SPACE,
        seeds = [SEED_POLICY_SERIES, health_plan.key().as_ref(), args.series_id.as_bytes()],
        bump
    )]
    pub next_policy_series: Box<Account<'info, PolicySeries>>,
    #[account(
        init,
        payer = authority,
        space = 8 + SeriesReserveLedger::INIT_SPACE,
        seeds = [SEED_SERIES_RESERVE_LEDGER, next_policy_series.key().as_ref(), current_policy_series.asset_mint.as_ref()],
        bump
    )]
    pub next_series_reserve_ledger: Box<Account<'info, SeriesReserveLedger>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: OpenMemberPositionArgs)]
pub struct OpenMemberPosition<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(
        init,
        payer = wallet,
        space = 8 + MemberPosition::INIT_SPACE,
        seeds = [SEED_MEMBER_POSITION, health_plan.key().as_ref(), wallet.key().as_ref(), args.series_scope.as_ref()],
        bump
    )]
    pub member_position: Account<'info, MemberPosition>,
    #[account(
        init_if_needed,
        payer = wallet,
        space = 8 + MembershipAnchorSeat::INIT_SPACE,
        seeds = [SEED_MEMBERSHIP_ANCHOR_SEAT, health_plan.key().as_ref(), args.anchor_ref.as_ref()],
        bump
    )]
    pub membership_anchor_seat: Option<Account<'info, MembershipAnchorSeat>>,
    pub token_gate_account: Option<InterfaceAccount<'info, TokenAccount>>,
    pub invite_authority: Option<Signer<'info>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMemberEligibility<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(mut, seeds = [SEED_MEMBER_POSITION, health_plan.key().as_ref(), member_position.wallet.as_ref(), member_position.policy_series.as_ref()], bump = member_position.bump)]
    pub member_position: Account<'info, MemberPosition>,
    pub membership_anchor_seat: Option<Account<'info, MembershipAnchorSeat>>,
}
