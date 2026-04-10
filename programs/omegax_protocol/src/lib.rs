// SPDX-License-Identifier: AGPL-3.0-or-later

//! Canonical OmegaX health capital markets program surface.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

declare_id!("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");

pub const MAX_ID_LEN: usize = 32;
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_LONG_NAME_LEN: usize = 96;
pub const MAX_URI_LEN: usize = 160;
pub const MAX_ORG_REF_LEN: usize = 64;

pub const SEED_PROTOCOL_GOVERNANCE: &[u8] = b"protocol_governance";
pub const SEED_RESERVE_DOMAIN: &[u8] = b"reserve_domain";
pub const SEED_DOMAIN_ASSET_VAULT: &[u8] = b"domain_asset_vault";
pub const SEED_DOMAIN_ASSET_LEDGER: &[u8] = b"domain_asset_ledger";
pub const SEED_HEALTH_PLAN: &[u8] = b"health_plan";
pub const SEED_PLAN_RESERVE_LEDGER: &[u8] = b"plan_reserve_ledger";
pub const SEED_POLICY_SERIES: &[u8] = b"policy_series";
pub const SEED_SERIES_RESERVE_LEDGER: &[u8] = b"series_reserve_ledger";
pub const SEED_MEMBER_POSITION: &[u8] = b"member_position";
pub const SEED_MEMBERSHIP_ANCHOR_SEAT: &[u8] = b"membership_anchor_seat";
pub const SEED_FUNDING_LINE: &[u8] = b"funding_line";
pub const SEED_FUNDING_LINE_LEDGER: &[u8] = b"funding_line_ledger";
pub const SEED_CLAIM_CASE: &[u8] = b"claim_case";
pub const SEED_OBLIGATION: &[u8] = b"obligation";
pub const SEED_LIQUIDITY_POOL: &[u8] = b"liquidity_pool";
pub const SEED_CAPITAL_CLASS: &[u8] = b"capital_class";
pub const SEED_POOL_CLASS_LEDGER: &[u8] = b"pool_class_ledger";
pub const SEED_LP_POSITION: &[u8] = b"lp_position";
pub const SEED_ALLOCATION_POSITION: &[u8] = b"allocation_position";
pub const SEED_ALLOCATION_LEDGER: &[u8] = b"allocation_ledger";

pub const SERIES_MODE_REWARD: u8 = 0;
pub const SERIES_MODE_PROTECTION: u8 = 1;
pub const SERIES_MODE_REIMBURSEMENT: u8 = 2;
pub const SERIES_MODE_PARAMETRIC: u8 = 3;
pub const SERIES_MODE_OTHER: u8 = 255;

pub const SERIES_STATUS_DRAFT: u8 = 0;
pub const SERIES_STATUS_ACTIVE: u8 = 1;
pub const SERIES_STATUS_PAUSED: u8 = 2;
pub const SERIES_STATUS_CLOSED: u8 = 3;

pub const FUNDING_LINE_TYPE_SPONSOR_BUDGET: u8 = 0;
pub const FUNDING_LINE_TYPE_PREMIUM_INCOME: u8 = 1;
pub const FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION: u8 = 2;
pub const FUNDING_LINE_TYPE_BACKSTOP: u8 = 3;
pub const FUNDING_LINE_TYPE_SUBSIDY: u8 = 4;

pub const FUNDING_LINE_STATUS_OPEN: u8 = 0;
pub const FUNDING_LINE_STATUS_PAUSED: u8 = 1;
pub const FUNDING_LINE_STATUS_CLOSED: u8 = 2;

pub const ELIGIBILITY_PENDING: u8 = 0;
pub const ELIGIBILITY_ELIGIBLE: u8 = 1;
pub const ELIGIBILITY_PAUSED: u8 = 2;
pub const ELIGIBILITY_CLOSED: u8 = 3;

pub const MEMBERSHIP_MODE_OPEN: u8 = 0;
pub const MEMBERSHIP_MODE_TOKEN_GATE: u8 = 1;
pub const MEMBERSHIP_MODE_INVITE_ONLY: u8 = 2;

pub const MEMBERSHIP_GATE_KIND_OPEN: u8 = 0;
pub const MEMBERSHIP_GATE_KIND_INVITE_ONLY: u8 = 1;
pub const MEMBERSHIP_GATE_KIND_NFT_ANCHOR: u8 = 2;
pub const MEMBERSHIP_GATE_KIND_STAKE_ANCHOR: u8 = 3;
pub const MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT: u8 = 4;

pub const MEMBERSHIP_PROOF_MODE_OPEN: u8 = 0;
pub const MEMBERSHIP_PROOF_MODE_TOKEN_GATE: u8 = 1;
pub const MEMBERSHIP_PROOF_MODE_INVITE_PERMIT: u8 = 2;

pub const CLAIM_INTAKE_OPEN: u8 = 0;
pub const CLAIM_INTAKE_UNDER_REVIEW: u8 = 1;
pub const CLAIM_INTAKE_APPROVED: u8 = 2;
pub const CLAIM_INTAKE_DENIED: u8 = 3;
pub const CLAIM_INTAKE_SETTLED: u8 = 4;
pub const CLAIM_INTAKE_CLOSED: u8 = 5;

pub const OBLIGATION_STATUS_PROPOSED: u8 = 0;
pub const OBLIGATION_STATUS_RESERVED: u8 = 1;
pub const OBLIGATION_STATUS_CLAIMABLE_PAYABLE: u8 = 2;
pub const OBLIGATION_STATUS_SETTLED: u8 = 3;
pub const OBLIGATION_STATUS_CANCELED: u8 = 4;
pub const OBLIGATION_STATUS_IMPAIRED: u8 = 5;
pub const OBLIGATION_STATUS_RECOVERED: u8 = 6;

pub const OBLIGATION_DELIVERY_MODE_CLAIMABLE: u8 = 0;
pub const OBLIGATION_DELIVERY_MODE_PAYABLE: u8 = 1;

pub const REDEMPTION_POLICY_OPEN: u8 = 0;
pub const REDEMPTION_POLICY_QUEUE_ONLY: u8 = 1;
pub const REDEMPTION_POLICY_PAUSED: u8 = 2;

pub const CAPITAL_CLASS_RESTRICTION_OPEN: u8 = 0;
pub const CAPITAL_CLASS_RESTRICTION_RESTRICTED: u8 = 1;
pub const CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY: u8 = 2;

pub const LP_QUEUE_STATUS_NONE: u8 = 0;
pub const LP_QUEUE_STATUS_PENDING: u8 = 1;
pub const LP_QUEUE_STATUS_PROCESSED: u8 = 2;

pub const PAUSE_FLAG_PROTOCOL_EMERGENCY: u32 = 1 << 0;
pub const PAUSE_FLAG_DOMAIN_RAILS: u32 = 1 << 1;
pub const PAUSE_FLAG_PLAN_OPERATIONS: u32 = 1 << 2;
pub const PAUSE_FLAG_CLAIM_INTAKE: u32 = 1 << 3;
pub const PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS: u32 = 1 << 4;
pub const PAUSE_FLAG_REDEMPTION_QUEUE_ONLY: u32 = 1 << 5;
pub const PAUSE_FLAG_ORACLE_FINALITY_HOLD: u32 = 1 << 6;
pub const PAUSE_FLAG_ALLOCATION_FREEZE: u32 = 1 << 7;

pub const ZERO_PUBKEY: Pubkey = Pubkey::new_from_array([0u8; 32]);

#[program]
pub mod omegax_protocol {
    use super::*;

    pub fn initialize_protocol_governance(
        ctx: Context<InitializeProtocolGovernance>,
        args: InitializeProtocolGovernanceArgs,
    ) -> Result<()> {
        require!(
            args.protocol_fee_bps <= 10_000,
            OmegaXProtocolError::InvalidBps
        );

        let governance = &mut ctx.accounts.protocol_governance;
        governance.governance_authority = ctx.accounts.governance_authority.key();
        governance.protocol_fee_bps = args.protocol_fee_bps;
        governance.emergency_pause = args.emergency_pause;
        governance.audit_nonce = 0;
        governance.bump = ctx.bumps.protocol_governance;

        emit!(ProtocolGovernanceInitializedEvent {
            governance_authority: governance.governance_authority,
            protocol_fee_bps: governance.protocol_fee_bps,
            emergency_pause: governance.emergency_pause,
        });

        Ok(())
    }

    pub fn set_protocol_emergency_pause(
        ctx: Context<SetProtocolEmergencyPause>,
        args: SetProtocolEmergencyPauseArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;
        let governance = &mut ctx.accounts.protocol_governance;
        governance.emergency_pause = args.emergency_pause;
        governance.audit_nonce = governance.audit_nonce.saturating_add(1);

        emit!(ScopedControlChangedEvent {
            scope_kind: ScopeKind::ProtocolGovernance as u8,
            scope: governance.key(),
            authority: ctx.accounts.authority.key(),
            pause_flags: if args.emergency_pause {
                PAUSE_FLAG_PROTOCOL_EMERGENCY
            } else {
                0
            },
            reason_hash: args.reason_hash,
            audit_nonce: governance.audit_nonce,
        });

        Ok(())
    }

    pub fn create_reserve_domain(
        ctx: Context<CreateReserveDomain>,
        args: CreateReserveDomainArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;
        require_id(&args.domain_id)?;

        let domain = &mut ctx.accounts.reserve_domain;
        domain.protocol_governance = ctx.accounts.protocol_governance.key();
        domain.domain_admin = args.domain_admin;
        domain.domain_id = args.domain_id;
        domain.display_name = args.display_name;
        domain.settlement_mode = args.settlement_mode;
        domain.legal_structure_hash = args.legal_structure_hash;
        domain.compliance_baseline_hash = args.compliance_baseline_hash;
        domain.allowed_rail_mask = args.allowed_rail_mask;
        domain.pause_flags = args.pause_flags;
        domain.active = true;
        domain.audit_nonce = 0;
        domain.bump = ctx.bumps.reserve_domain;

        emit!(ReserveDomainCreatedEvent {
            reserve_domain: domain.key(),
            domain_admin: domain.domain_admin,
            settlement_mode: domain.settlement_mode,
        });

        Ok(())
    }

    pub fn update_reserve_domain_controls(
        ctx: Context<UpdateReserveDomainControls>,
        args: UpdateReserveDomainControlsArgs,
    ) -> Result<()> {
        require_domain_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.reserve_domain,
        )?;

        let domain = &mut ctx.accounts.reserve_domain;
        domain.allowed_rail_mask = args.allowed_rail_mask;
        domain.pause_flags = args.pause_flags;
        domain.active = args.active;
        domain.audit_nonce = domain.audit_nonce.saturating_add(1);

        emit!(ScopedControlChangedEvent {
            scope_kind: ScopeKind::ReserveDomain as u8,
            scope: domain.key(),
            authority: ctx.accounts.authority.key(),
            pause_flags: domain.pause_flags,
            reason_hash: args.reason_hash,
            audit_nonce: domain.audit_nonce,
        });

        Ok(())
    }

    pub fn create_domain_asset_vault(
        ctx: Context<CreateDomainAssetVault>,
        args: CreateDomainAssetVaultArgs,
    ) -> Result<()> {
        require_domain_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.reserve_domain,
        )?;

        let vault = &mut ctx.accounts.domain_asset_vault;
        vault.reserve_domain = ctx.accounts.reserve_domain.key();
        vault.asset_mint = args.asset_mint;
        vault.vault_token_account = args.vault_token_account;
        vault.total_assets = 0;
        vault.bump = ctx.bumps.domain_asset_vault;

        let ledger = &mut ctx.accounts.domain_asset_ledger;
        ledger.reserve_domain = ctx.accounts.reserve_domain.key();
        ledger.asset_mint = args.asset_mint;
        ledger.sheet = ReserveBalanceSheet::default();
        ledger.bump = ctx.bumps.domain_asset_ledger;

        emit!(LedgerInitializedEvent {
            scope_kind: ScopeKind::DomainAssetVault as u8,
            scope: vault.key(),
            asset_mint: args.asset_mint,
        });

        Ok(())
    }

    pub fn create_health_plan(
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

    pub fn update_health_plan_controls(
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

    pub fn create_policy_series(
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

    pub fn version_policy_series(
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

    pub fn open_member_position(
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

    pub fn update_member_eligibility(
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

    pub fn open_funding_line(
        ctx: Context<OpenFundingLine>,
        args: OpenFundingLineArgs,
    ) -> Result<()> {
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require_id(&args.line_id)?;
        require!(
            ctx.accounts.domain_asset_vault.asset_mint == args.asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
        require!(
            ctx.accounts.domain_asset_ledger.asset_mint == args.asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );

        let funding_line = &mut ctx.accounts.funding_line;
        funding_line.reserve_domain = ctx.accounts.health_plan.reserve_domain;
        funding_line.health_plan = ctx.accounts.health_plan.key();
        funding_line.policy_series = args.policy_series;
        funding_line.asset_mint = args.asset_mint;
        funding_line.line_id = args.line_id;
        funding_line.line_type = args.line_type;
        funding_line.funding_priority = args.funding_priority;
        funding_line.committed_amount = args.committed_amount;
        funding_line.funded_amount = 0;
        funding_line.reserved_amount = 0;
        funding_line.spent_amount = 0;
        funding_line.released_amount = 0;
        funding_line.returned_amount = 0;
        funding_line.status = FUNDING_LINE_STATUS_OPEN;
        funding_line.caps_hash = args.caps_hash;
        funding_line.bump = ctx.bumps.funding_line;

        let funding_line_ledger = &mut ctx.accounts.funding_line_ledger;
        funding_line_ledger.funding_line = funding_line.key();
        funding_line_ledger.asset_mint = args.asset_mint;
        funding_line_ledger.sheet = ReserveBalanceSheet::default();
        funding_line_ledger.bump = ctx.bumps.funding_line_ledger;

        let plan_ledger = &mut ctx.accounts.plan_reserve_ledger;
        if plan_ledger.health_plan == ZERO_PUBKEY {
            plan_ledger.health_plan = ctx.accounts.health_plan.key();
            plan_ledger.asset_mint = args.asset_mint;
            plan_ledger.sheet = ReserveBalanceSheet::default();
            plan_ledger.bump = ctx.bumps.plan_reserve_ledger;
        }

        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            require!(
                args.policy_series != ZERO_PUBKEY,
                OmegaXProtocolError::SeriesLedgerUnexpected
            );
            require!(
                series_ledger.policy_series == args.policy_series,
                OmegaXProtocolError::PolicySeriesMismatch
            );
            require!(
                series_ledger.asset_mint == args.asset_mint,
                OmegaXProtocolError::AssetMintMismatch
            );
        }

        emit!(FundingLineOpenedEvent {
            health_plan: funding_line.health_plan,
            funding_line: funding_line.key(),
            asset_mint: funding_line.asset_mint,
            line_type: funding_line.line_type,
        });

        Ok(())
    }

    pub fn fund_sponsor_budget(
        ctx: Context<FundSponsorBudget>,
        args: FundSponsorBudgetArgs,
    ) -> Result<()> {
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require!(
            ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_SPONSOR_BUDGET,
            OmegaXProtocolError::FundingLineTypeMismatch
        );

        let amount = args.amount;
        let funding_line = &mut ctx.accounts.funding_line;
        funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
        book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
        book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            require!(
                funding_line.policy_series != ZERO_PUBKEY,
                OmegaXProtocolError::PolicySeriesMissing
            );
            book_inflow_sheet(&mut series_ledger.sheet, amount)?;
        }

        emit!(FundingFlowRecordedEvent {
            funding_line: funding_line.key(),
            amount,
            flow_kind: FundingFlowKind::SponsorBudgetFunded as u8,
        });

        Ok(())
    }

    pub fn record_premium_payment(
        ctx: Context<RecordPremiumPayment>,
        args: RecordPremiumPaymentArgs,
    ) -> Result<()> {
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require!(
            ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_PREMIUM_INCOME,
            OmegaXProtocolError::FundingLineTypeMismatch
        );

        let amount = args.amount;
        let funding_line = &mut ctx.accounts.funding_line;
        funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
        book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
        book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            book_inflow_sheet(&mut series_ledger.sheet, amount)?;
        }

        if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
            pool_class_ledger.realized_yield_amount =
                checked_add(pool_class_ledger.realized_yield_amount, amount)?;
            book_inflow_sheet(&mut pool_class_ledger.sheet, amount)?;
        }

        emit!(FundingFlowRecordedEvent {
            funding_line: funding_line.key(),
            amount,
            flow_kind: FundingFlowKind::PremiumRecorded as u8,
        });

        Ok(())
    }

    pub fn create_obligation(
        ctx: Context<CreateObligation>,
        args: CreateObligationArgs,
    ) -> Result<()> {
        require_id(&args.obligation_id)?;
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require!(
            ctx.accounts.funding_line.health_plan == ctx.accounts.health_plan.key(),
            OmegaXProtocolError::HealthPlanMismatch
        );
        require!(
            ctx.accounts.funding_line.asset_mint == args.asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );

        let obligation = &mut ctx.accounts.obligation;
        obligation.reserve_domain = ctx.accounts.health_plan.reserve_domain;
        obligation.asset_mint = args.asset_mint;
        obligation.health_plan = ctx.accounts.health_plan.key();
        obligation.policy_series = args.policy_series;
        obligation.member_wallet = args.member_wallet;
        obligation.beneficiary = args.beneficiary;
        obligation.funding_line = ctx.accounts.funding_line.key();
        obligation.claim_case = args.claim_case;
        obligation.liquidity_pool = args.liquidity_pool;
        obligation.capital_class = args.capital_class;
        obligation.allocation_position = args.allocation_position;
        obligation.obligation_id = args.obligation_id;
        obligation.creation_reason_hash = args.creation_reason_hash;
        obligation.settlement_reason_hash = [0u8; 32];
        obligation.status = OBLIGATION_STATUS_PROPOSED;
        obligation.delivery_mode = args.delivery_mode;
        obligation.principal_amount = args.amount;
        obligation.outstanding_amount = args.amount;
        obligation.reserved_amount = 0;
        obligation.claimable_amount = 0;
        obligation.payable_amount = 0;
        obligation.settled_amount = 0;
        obligation.impaired_amount = 0;
        obligation.recovered_amount = 0;
        obligation.created_at = Clock::get()?.unix_timestamp;
        obligation.updated_at = obligation.created_at;
        obligation.bump = ctx.bumps.obligation;

        book_owed(&mut ctx.accounts.domain_asset_ledger.sheet, args.amount)?;
        book_owed(&mut ctx.accounts.plan_reserve_ledger.sheet, args.amount)?;
        book_owed(&mut ctx.accounts.funding_line_ledger.sheet, args.amount)?;

        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            book_owed(&mut series_ledger.sheet, args.amount)?;
        }

        if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
            book_owed(&mut pool_class_ledger.sheet, args.amount)?;
        }

        if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
            book_owed(&mut allocation_ledger.sheet, args.amount)?;
        }

        emit!(ObligationStatusChangedEvent {
            obligation: obligation.key(),
            funding_line: obligation.funding_line,
            status: obligation.status,
            amount: obligation.principal_amount,
        });

        Ok(())
    }

    pub fn reserve_obligation(
        ctx: Context<ReserveObligation>,
        args: ReserveObligationArgs,
    ) -> Result<()> {
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        let reserve_amount = args.amount;
        let obligation = &mut ctx.accounts.obligation;
        require!(
            obligation.status == OBLIGATION_STATUS_PROPOSED,
            OmegaXProtocolError::InvalidObligationStateTransition
        );
        require!(
            reserve_amount <= obligation.outstanding_amount,
            OmegaXProtocolError::AmountExceedsOutstandingObligation
        );

        obligation.status = OBLIGATION_STATUS_RESERVED;
        obligation.reserved_amount = reserve_amount;
        obligation.updated_at = Clock::get()?.unix_timestamp;

        ctx.accounts.funding_line.reserved_amount =
            checked_add(ctx.accounts.funding_line.reserved_amount, reserve_amount)?;
        book_reserve(&mut ctx.accounts.domain_asset_ledger.sheet, reserve_amount)?;
        book_reserve(&mut ctx.accounts.plan_reserve_ledger.sheet, reserve_amount)?;
        book_reserve(&mut ctx.accounts.funding_line_ledger.sheet, reserve_amount)?;

        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            book_reserve(&mut series_ledger.sheet, reserve_amount)?;
        }

        if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
            book_reserve(&mut pool_class_ledger.sheet, reserve_amount)?;
        }

        if let Some(allocation_position) = ctx.accounts.allocation_position.as_deref_mut() {
            allocation_position.reserved_capacity =
                checked_add(allocation_position.reserved_capacity, reserve_amount)?;
            allocation_position.utilized_amount =
                checked_add(allocation_position.utilized_amount, reserve_amount)?;
        }

        if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
            book_reserve(&mut allocation_ledger.sheet, reserve_amount)?;
        }

        emit!(ObligationStatusChangedEvent {
            obligation: obligation.key(),
            funding_line: obligation.funding_line,
            status: obligation.status,
            amount: reserve_amount,
        });

        Ok(())
    }

    pub fn settle_obligation(
        ctx: Context<SettleObligation>,
        args: SettleObligationArgs,
    ) -> Result<()> {
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;

        let amount = args.amount;
        let obligation = &mut ctx.accounts.obligation;

        match args.next_status {
            OBLIGATION_STATUS_CLAIMABLE_PAYABLE => {
                require!(
                    obligation.status == OBLIGATION_STATUS_RESERVED,
                    OmegaXProtocolError::InvalidObligationStateTransition
                );
                release_reserved_to_delivery(
                    &mut ctx.accounts.domain_asset_ledger.sheet,
                    &mut ctx.accounts.plan_reserve_ledger.sheet,
                    &mut ctx.accounts.funding_line_ledger.sheet,
                    ctx.accounts.series_reserve_ledger.as_deref_mut(),
                    ctx.accounts.pool_class_ledger.as_deref_mut(),
                    ctx.accounts.allocation_ledger.as_deref_mut(),
                    obligation.delivery_mode,
                    amount,
                )?;
                obligation.status = OBLIGATION_STATUS_CLAIMABLE_PAYABLE;
                obligation.claimable_amount =
                    if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
                        amount
                    } else {
                        0
                    };
                obligation.payable_amount =
                    if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_PAYABLE {
                        amount
                    } else {
                        0
                    };
                obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
            }
            OBLIGATION_STATUS_SETTLED => {
                require!(
                    obligation.status == OBLIGATION_STATUS_CLAIMABLE_PAYABLE
                        || obligation.status == OBLIGATION_STATUS_RESERVED,
                    OmegaXProtocolError::InvalidObligationStateTransition
                );
                settle_delivery(
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
                    obligation,
                )?;
                obligation.status = OBLIGATION_STATUS_SETTLED;
            }
            OBLIGATION_STATUS_CANCELED => {
                cancel_outstanding(
                    &mut ctx.accounts.domain_asset_ledger.sheet,
                    &mut ctx.accounts.plan_reserve_ledger.sheet,
                    &mut ctx.accounts.funding_line_ledger.sheet,
                    ctx.accounts.series_reserve_ledger.as_deref_mut(),
                    ctx.accounts.pool_class_ledger.as_deref_mut(),
                    ctx.accounts.allocation_position.as_deref_mut(),
                    ctx.accounts.allocation_ledger.as_deref_mut(),
                    &mut ctx.accounts.funding_line,
                    amount,
                    obligation,
                )?;
                obligation.status = OBLIGATION_STATUS_CANCELED;
            }
            _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
        }

        obligation.settlement_reason_hash = args.settlement_reason_hash;
        obligation.updated_at = Clock::get()?.unix_timestamp;

        emit!(ObligationStatusChangedEvent {
            obligation: obligation.key(),
            funding_line: obligation.funding_line,
            status: obligation.status,
            amount,
        });

        Ok(())
    }

    pub fn release_reserve(ctx: Context<ReleaseReserve>, args: ReleaseReserveArgs) -> Result<()> {
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;

        let amount = args.amount;
        let obligation = &mut ctx.accounts.obligation;
        require!(
            obligation.status == OBLIGATION_STATUS_RESERVED,
            OmegaXProtocolError::InvalidObligationStateTransition
        );
        require!(
            amount <= obligation.reserved_amount,
            OmegaXProtocolError::AmountExceedsReservedBalance
        );

        obligation.reserved_amount = checked_sub(obligation.reserved_amount, amount)?;
        obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
        obligation.status = if obligation.reserved_amount == 0 {
            OBLIGATION_STATUS_CANCELED
        } else {
            OBLIGATION_STATUS_RESERVED
        };
        obligation.updated_at = Clock::get()?.unix_timestamp;

        ctx.accounts.funding_line.reserved_amount =
            checked_sub(ctx.accounts.funding_line.reserved_amount, amount)?;
        ctx.accounts.funding_line.released_amount =
            checked_add(ctx.accounts.funding_line.released_amount, amount)?;

        release_reserved_scoped(
            &mut ctx.accounts.domain_asset_ledger.sheet,
            &mut ctx.accounts.plan_reserve_ledger.sheet,
            &mut ctx.accounts.funding_line_ledger.sheet,
            ctx.accounts.series_reserve_ledger.as_deref_mut(),
            ctx.accounts.pool_class_ledger.as_deref_mut(),
            ctx.accounts.allocation_position.as_deref_mut(),
            ctx.accounts.allocation_ledger.as_deref_mut(),
            amount,
        )?;

        Ok(())
    }

    pub fn open_claim_case(ctx: Context<OpenClaimCase>, args: OpenClaimCaseArgs) -> Result<()> {
        require_id(&args.claim_id)?;
        require!(
            ctx.accounts.health_plan.pause_flags & PAUSE_FLAG_CLAIM_INTAKE == 0,
            OmegaXProtocolError::ClaimIntakePaused
        );

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

    pub fn attach_claim_evidence_ref(
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

    pub fn adjudicate_claim_case(
        ctx: Context<AdjudicateClaimCase>,
        args: AdjudicateClaimCaseArgs,
    ) -> Result<()> {
        require_claim_operator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;

        let claim_case = &mut ctx.accounts.claim_case;
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
            claim_case.linked_obligation = obligation.key();
            obligation.claim_case = claim_case.key();
        }

        if args.reserve_amount > 0 {
            claim_case.reserved_amount = args.reserve_amount;
        }

        emit!(ClaimCaseStateChangedEvent {
            claim_case: claim_case.key(),
            intake_status: claim_case.intake_status,
            approved_amount: claim_case.approved_amount,
        });

        Ok(())
    }

    pub fn settle_claim_case(
        ctx: Context<SettleClaimCase>,
        args: SettleClaimCaseArgs,
    ) -> Result<()> {
        require_claim_operator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require!(
            args.amount <= ctx.accounts.claim_case.approved_amount,
            OmegaXProtocolError::AmountExceedsApprovedClaim
        );

        let amount = args.amount;
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

        if let Some(obligation) = ctx.accounts.obligation.as_deref_mut() {
            obligation.status = OBLIGATION_STATUS_SETTLED;
            obligation.settled_amount = checked_add(obligation.settled_amount, amount)?;
            obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
            obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
            obligation.payable_amount = obligation.payable_amount.saturating_sub(amount);
            obligation.updated_at = Clock::get()?.unix_timestamp;
        }

        emit!(ClaimCaseStateChangedEvent {
            claim_case: claim_case.key(),
            intake_status: claim_case.intake_status,
            approved_amount: claim_case.approved_amount,
        });

        Ok(())
    }

    pub fn create_liquidity_pool(
        ctx: Context<CreateLiquidityPool>,
        args: CreateLiquidityPoolArgs,
    ) -> Result<()> {
        require_id(&args.pool_id)?;
        require_domain_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.reserve_domain,
        )?;
        require!(
            ctx.accounts.domain_asset_vault.asset_mint == args.deposit_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );

        let pool = &mut ctx.accounts.liquidity_pool;
        pool.reserve_domain = ctx.accounts.reserve_domain.key();
        pool.curator = args.curator;
        pool.allocator = args.allocator;
        pool.sentinel = args.sentinel;
        pool.pool_id = args.pool_id;
        pool.display_name = args.display_name;
        pool.deposit_asset_mint = args.deposit_asset_mint;
        pool.strategy_hash = args.strategy_hash;
        pool.allowed_exposure_hash = args.allowed_exposure_hash;
        pool.external_yield_adapter_hash = args.external_yield_adapter_hash;
        pool.fee_bps = args.fee_bps;
        pool.redemption_policy = args.redemption_policy;
        pool.pause_flags = args.pause_flags;
        pool.total_value_locked = 0;
        pool.total_allocated = 0;
        pool.total_reserved = 0;
        pool.total_impaired = 0;
        pool.total_pending_redemptions = 0;
        pool.active = true;
        pool.audit_nonce = 0;
        pool.bump = ctx.bumps.liquidity_pool;

        emit!(LiquidityPoolCreatedEvent {
            reserve_domain: pool.reserve_domain,
            liquidity_pool: pool.key(),
            asset_mint: pool.deposit_asset_mint,
        });

        Ok(())
    }

    pub fn create_capital_class(
        ctx: Context<CreateCapitalClass>,
        args: CreateCapitalClassArgs,
    ) -> Result<()> {
        require_id(&args.class_id)?;
        require_pool_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let capital_class = &mut ctx.accounts.capital_class;
        capital_class.reserve_domain = ctx.accounts.liquidity_pool.reserve_domain;
        capital_class.liquidity_pool = ctx.accounts.liquidity_pool.key();
        capital_class.share_mint = args.share_mint;
        capital_class.class_id = args.class_id;
        capital_class.display_name = args.display_name;
        capital_class.priority = args.priority;
        capital_class.impairment_rank = args.impairment_rank;
        capital_class.restriction_mode = args.restriction_mode;
        capital_class.redemption_terms_mode = args.redemption_terms_mode;
        capital_class.wrapper_metadata_hash = args.wrapper_metadata_hash;
        capital_class.permissioning_hash = args.permissioning_hash;
        capital_class.fee_bps = args.fee_bps;
        capital_class.min_lockup_seconds = args.min_lockup_seconds;
        capital_class.pause_flags = args.pause_flags;
        capital_class.queue_only_redemptions = args.pause_flags & PAUSE_FLAG_REDEMPTION_QUEUE_ONLY
            != 0
            || ctx.accounts.liquidity_pool.redemption_policy == REDEMPTION_POLICY_QUEUE_ONLY;
        capital_class.total_shares = 0;
        capital_class.nav_assets = 0;
        capital_class.allocated_assets = 0;
        capital_class.reserved_assets = 0;
        capital_class.impaired_assets = 0;
        capital_class.pending_redemptions = 0;
        capital_class.active = true;
        capital_class.bump = ctx.bumps.capital_class;

        let ledger = &mut ctx.accounts.pool_class_ledger;
        ledger.capital_class = capital_class.key();
        ledger.asset_mint = ctx.accounts.liquidity_pool.deposit_asset_mint;
        ledger.sheet = ReserveBalanceSheet::default();
        ledger.total_shares = 0;
        ledger.realized_yield_amount = 0;
        ledger.realized_loss_amount = 0;
        ledger.bump = ctx.bumps.pool_class_ledger;

        Ok(())
    }

    pub fn update_capital_class_controls(
        ctx: Context<UpdateCapitalClassControls>,
        args: UpdateCapitalClassControlsArgs,
    ) -> Result<()> {
        require_pool_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let capital_class = &mut ctx.accounts.capital_class;
        capital_class.pause_flags = args.pause_flags;
        capital_class.queue_only_redemptions = args.queue_only_redemptions;
        capital_class.active = args.active;

        emit!(ScopedControlChangedEvent {
            scope_kind: ScopeKind::CapitalClass as u8,
            scope: capital_class.key(),
            authority: ctx.accounts.authority.key(),
            pause_flags: capital_class.pause_flags,
            reason_hash: args.reason_hash,
            audit_nonce: 0,
        });

        Ok(())
    }

    pub fn update_lp_position_credentialing(
        ctx: Context<UpdateLpPositionCredentialing>,
        args: UpdateLpPositionCredentialingArgs,
    ) -> Result<()> {
        require_curator_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let capital_class_key = ctx.accounts.capital_class.key();
        let lp_position = &mut ctx.accounts.lp_position;
        ensure_lp_position_binding(
            lp_position,
            capital_class_key,
            args.owner,
            ctx.bumps.lp_position,
        )?;
        update_lp_position_credentialing_state(lp_position, args.credentialed)?;

        emit!(LPPositionCredentialingUpdatedEvent {
            capital_class: capital_class_key,
            owner: args.owner,
            authority: ctx.accounts.authority.key(),
            credentialed: args.credentialed,
            reason_hash: args.reason_hash,
        });

        Ok(())
    }

    pub fn deposit_into_capital_class(
        ctx: Context<DepositIntoCapitalClass>,
        args: DepositIntoCapitalClassArgs,
    ) -> Result<()> {
        require!(
            !ctx.accounts.protocol_governance.emergency_pause,
            OmegaXProtocolError::ProtocolEmergencyPaused
        );
        require!(
            ctx.accounts.capital_class.pause_flags & PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS == 0,
            OmegaXProtocolError::CapitalSubscriptionsPaused
        );

        let amount = args.amount;
        let shares = if args.shares == 0 {
            amount
        } else {
            args.shares
        };
        let owner = ctx.accounts.owner.key();
        let capital_class_key = ctx.accounts.capital_class.key();
        let restriction_mode = ctx.accounts.capital_class.restriction_mode;
        let min_lockup_seconds = ctx.accounts.capital_class.min_lockup_seconds;
        let now_ts = Clock::get()?.unix_timestamp;

        let lp_position = &mut ctx.accounts.lp_position;
        ensure_lp_position_binding(lp_position, capital_class_key, owner, ctx.bumps.lp_position)?;
        require_class_access_mode(restriction_mode, lp_position.credentialed)?;
        apply_lp_position_deposit(lp_position, amount, shares, min_lockup_seconds, now_ts)?;

        let capital_class = &mut ctx.accounts.capital_class;
        capital_class.total_shares = checked_add(capital_class.total_shares, shares)?;
        capital_class.nav_assets = checked_add(capital_class.nav_assets, amount)?;

        let pool = &mut ctx.accounts.liquidity_pool;
        pool.total_value_locked = checked_add(pool.total_value_locked, amount)?;

        book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
        book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
        ctx.accounts.pool_class_ledger.total_shares =
            checked_add(ctx.accounts.pool_class_ledger.total_shares, shares)?;

        emit!(CapitalClassDepositEvent {
            capital_class: capital_class.key(),
            owner: lp_position.owner,
            asset_amount: amount,
            shares,
        });

        Ok(())
    }

    pub fn request_redemption(
        ctx: Context<RequestRedemption>,
        args: RequestRedemptionArgs,
    ) -> Result<()> {
        require_class_access(
            &ctx.accounts.capital_class,
            ctx.accounts.lp_position.credentialed,
        )?;
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.lp_position.lockup_ends_at,
            OmegaXProtocolError::LockupActive
        );
        require!(
            ctx.accounts.capital_class.restriction_mode != CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY
                || ctx.accounts.lp_position.credentialed,
            OmegaXProtocolError::RestrictedCapitalClass
        );
        require!(
            args.shares
                <= ctx
                    .accounts
                    .lp_position
                    .shares
                    .saturating_sub(ctx.accounts.lp_position.pending_redemption_shares),
            OmegaXProtocolError::AmountExceedsAvailableShares
        );

        let asset_amount = args.asset_amount;
        ctx.accounts.lp_position.pending_redemption_shares = checked_add(
            ctx.accounts.lp_position.pending_redemption_shares,
            args.shares,
        )?;
        ctx.accounts.lp_position.queue_status = LP_QUEUE_STATUS_PENDING;
        ctx.accounts.capital_class.pending_redemptions =
            checked_add(ctx.accounts.capital_class.pending_redemptions, asset_amount)?;
        ctx.accounts.liquidity_pool.total_pending_redemptions = checked_add(
            ctx.accounts.liquidity_pool.total_pending_redemptions,
            asset_amount,
        )?;

        book_pending_redemption(&mut ctx.accounts.pool_class_ledger.sheet, asset_amount)?;
        book_pending_redemption(&mut ctx.accounts.domain_asset_ledger.sheet, asset_amount)?;

        emit!(RedemptionRequestedEvent {
            capital_class: ctx.accounts.capital_class.key(),
            owner: ctx.accounts.owner.key(),
            shares: args.shares,
            asset_amount,
        });

        Ok(())
    }

    pub fn process_redemption_queue(
        ctx: Context<ProcessRedemptionQueue>,
        args: ProcessRedemptionQueueArgs,
    ) -> Result<()> {
        require_pool_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;
        require!(
            args.shares <= ctx.accounts.lp_position.pending_redemption_shares,
            OmegaXProtocolError::AmountExceedsPendingRedemption
        );

        let asset_amount = args.asset_amount;
        ctx.accounts.lp_position.pending_redemption_shares = checked_sub(
            ctx.accounts.lp_position.pending_redemption_shares,
            args.shares,
        )?;
        ctx.accounts.lp_position.shares =
            checked_sub(ctx.accounts.lp_position.shares, args.shares)?;
        ctx.accounts.lp_position.queue_status = LP_QUEUE_STATUS_PROCESSED;
        ctx.accounts.lp_position.realized_distributions = checked_add(
            ctx.accounts.lp_position.realized_distributions,
            asset_amount,
        )?;

        ctx.accounts.capital_class.total_shares =
            checked_sub(ctx.accounts.capital_class.total_shares, args.shares)?;
        ctx.accounts.capital_class.nav_assets =
            checked_sub(ctx.accounts.capital_class.nav_assets, asset_amount)?;
        ctx.accounts.capital_class.pending_redemptions =
            checked_sub(ctx.accounts.capital_class.pending_redemptions, asset_amount)?;
        ctx.accounts.liquidity_pool.total_value_locked =
            checked_sub(ctx.accounts.liquidity_pool.total_value_locked, asset_amount)?;
        ctx.accounts.liquidity_pool.total_pending_redemptions = checked_sub(
            ctx.accounts.liquidity_pool.total_pending_redemptions,
            asset_amount,
        )?;

        ctx.accounts.domain_asset_vault.total_assets =
            checked_sub(ctx.accounts.domain_asset_vault.total_assets, asset_amount)?;

        settle_pending_redemption(
            &mut ctx.accounts.pool_class_ledger,
            asset_amount,
            args.shares,
        )?;
        settle_pending_redemption_domain(
            &mut ctx.accounts.domain_asset_ledger.sheet,
            asset_amount,
        )?;

        Ok(())
    }

    pub fn create_allocation_position(
        ctx: Context<CreateAllocationPosition>,
        args: CreateAllocationPositionArgs,
    ) -> Result<()> {
        require_pool_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let allocation = &mut ctx.accounts.allocation_position;
        allocation.reserve_domain = ctx.accounts.liquidity_pool.reserve_domain;
        allocation.liquidity_pool = ctx.accounts.liquidity_pool.key();
        allocation.capital_class = ctx.accounts.capital_class.key();
        allocation.health_plan = ctx.accounts.health_plan.key();
        allocation.policy_series = args.policy_series;
        allocation.funding_line = ctx.accounts.funding_line.key();
        allocation.cap_amount = args.cap_amount;
        allocation.weight_bps = args.weight_bps;
        allocation.allocation_mode = args.allocation_mode;
        allocation.allocated_amount = 0;
        allocation.utilized_amount = 0;
        allocation.reserved_capacity = 0;
        allocation.realized_pnl = 0;
        allocation.impaired_amount = 0;
        allocation.deallocation_only = args.deallocation_only;
        allocation.active = true;
        allocation.bump = ctx.bumps.allocation_position;

        let ledger = &mut ctx.accounts.allocation_ledger;
        ledger.allocation_position = allocation.key();
        ledger.asset_mint = ctx.accounts.funding_line.asset_mint;
        ledger.sheet = ReserveBalanceSheet::default();
        ledger.realized_pnl = 0;
        ledger.bump = ctx.bumps.allocation_ledger;

        emit!(AllocationUpdatedEvent {
            allocation_position: allocation.key(),
            capital_class: allocation.capital_class,
            funding_line: allocation.funding_line,
            allocated_amount: allocation.allocated_amount,
            reserved_capacity: allocation.reserved_capacity,
        });

        Ok(())
    }

    pub fn update_allocation_caps(
        ctx: Context<UpdateAllocationCaps>,
        args: UpdateAllocationCapsArgs,
    ) -> Result<()> {
        require_pool_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let allocation = &mut ctx.accounts.allocation_position;
        allocation.cap_amount = args.cap_amount;
        allocation.weight_bps = args.weight_bps;
        allocation.deallocation_only = args.deallocation_only;
        allocation.active = args.active;

        emit!(ScopedControlChangedEvent {
            scope_kind: ScopeKind::AllocationPosition as u8,
            scope: allocation.key(),
            authority: ctx.accounts.authority.key(),
            pause_flags: if allocation.deallocation_only {
                PAUSE_FLAG_ALLOCATION_FREEZE
            } else {
                0
            },
            reason_hash: args.reason_hash,
            audit_nonce: 0,
        });

        Ok(())
    }

    pub fn allocate_capital(
        ctx: Context<AllocateCapital>,
        args: AllocateCapitalArgs,
    ) -> Result<()> {
        require_allocator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let amount = args.amount;
        require!(
            checked_add(ctx.accounts.allocation_position.allocated_amount, amount)?
                <= ctx.accounts.allocation_position.cap_amount,
            OmegaXProtocolError::AllocationCapExceeded
        );

        ctx.accounts.allocation_position.allocated_amount =
            checked_add(ctx.accounts.allocation_position.allocated_amount, amount)?;
        ctx.accounts.capital_class.allocated_assets =
            checked_add(ctx.accounts.capital_class.allocated_assets, amount)?;
        ctx.accounts.liquidity_pool.total_allocated =
            checked_add(ctx.accounts.liquidity_pool.total_allocated, amount)?;

        book_allocation(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
        book_allocation(&mut ctx.accounts.allocation_ledger.sheet, amount)?;

        emit!(AllocationUpdatedEvent {
            allocation_position: ctx.accounts.allocation_position.key(),
            capital_class: ctx.accounts.capital_class.key(),
            funding_line: ctx.accounts.funding_line.key(),
            allocated_amount: ctx.accounts.allocation_position.allocated_amount,
            reserved_capacity: ctx.accounts.allocation_position.reserved_capacity,
        });

        Ok(())
    }

    pub fn deallocate_capital(
        ctx: Context<DeallocateCapital>,
        args: DeallocateCapitalArgs,
    ) -> Result<()> {
        require_allocator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let amount = args.amount;
        let free_allocated = ctx
            .accounts
            .allocation_position
            .allocated_amount
            .saturating_sub(ctx.accounts.allocation_position.reserved_capacity);
        require!(
            amount <= free_allocated,
            OmegaXProtocolError::InsufficientFreeAllocationCapacity
        );

        ctx.accounts.allocation_position.allocated_amount =
            checked_sub(ctx.accounts.allocation_position.allocated_amount, amount)?;
        ctx.accounts.capital_class.allocated_assets =
            checked_sub(ctx.accounts.capital_class.allocated_assets, amount)?;
        ctx.accounts.liquidity_pool.total_allocated =
            checked_sub(ctx.accounts.liquidity_pool.total_allocated, amount)?;

        release_allocation(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
        release_allocation(&mut ctx.accounts.allocation_ledger.sheet, amount)?;

        Ok(())
    }

    pub fn mark_impairment(ctx: Context<MarkImpairment>, args: MarkImpairmentArgs) -> Result<()> {
        require_claim_operator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;

        let amount = args.amount;
        book_impairment(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
        book_impairment(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
        book_impairment(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            book_impairment(&mut series_ledger.sheet, amount)?;
        }
        if let Some(pool_class_ledger) = ctx.accounts.pool_class_ledger.as_deref_mut() {
            book_impairment(&mut pool_class_ledger.sheet, amount)?;
            pool_class_ledger.realized_loss_amount =
                checked_add(pool_class_ledger.realized_loss_amount, amount)?;
        }
        if let Some(allocation_position) = ctx.accounts.allocation_position.as_deref_mut() {
            allocation_position.impaired_amount =
                checked_add(allocation_position.impaired_amount, amount)?;
            allocation_position.realized_pnl = allocation_position
                .realized_pnl
                .saturating_sub(amount as i64);
        }
        if let Some(allocation_ledger) = ctx.accounts.allocation_ledger.as_deref_mut() {
            book_impairment(&mut allocation_ledger.sheet, amount)?;
            allocation_ledger.realized_pnl =
                allocation_ledger.realized_pnl.saturating_sub(amount as i64);
        }
        if let Some(obligation) = ctx.accounts.obligation.as_deref_mut() {
            obligation.status = OBLIGATION_STATUS_IMPAIRED;
            obligation.impaired_amount = checked_add(obligation.impaired_amount, amount)?;
            obligation.updated_at = Clock::get()?.unix_timestamp;
        }

        ctx.accounts.funding_line.released_amount =
            checked_add(ctx.accounts.funding_line.released_amount, amount)?;

        emit!(ImpairmentRecordedEvent {
            funding_line: ctx.accounts.funding_line.key(),
            obligation: ctx
                .accounts
                .obligation
                .as_ref()
                .map(|obligation| obligation.key())
                .unwrap_or(ZERO_PUBKEY),
            amount,
            reason_hash: args.reason_hash,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeProtocolGovernance<'info> {
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(
        init,
        payer = governance_authority,
        space = 8 + ProtocolGovernance::INIT_SPACE,
        seeds = [SEED_PROTOCOL_GOVERNANCE],
        bump
    )]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetProtocolEmergencyPause<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
}

#[derive(Accounts)]
#[instruction(args: CreateReserveDomainArgs)]
pub struct CreateReserveDomain<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        init,
        payer = authority,
        space = 8 + ReserveDomain::INIT_SPACE,
        seeds = [SEED_RESERVE_DOMAIN, args.domain_id.as_bytes()],
        bump
    )]
    pub reserve_domain: Account<'info, ReserveDomain>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReserveDomainControls<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
}

#[derive(Accounts)]
#[instruction(args: CreateDomainAssetVaultArgs)]
pub struct CreateDomainAssetVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[account(
        init,
        payer = authority,
        space = 8 + DomainAssetVault::INIT_SPACE,
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(
        init,
        payer = authority,
        space = 8 + DomainAssetLedger::INIT_SPACE,
        seeds = [SEED_DOMAIN_ASSET_LEDGER, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    pub system_program: Program<'info, System>,
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

#[derive(Accounts)]
#[instruction(args: OpenFundingLineArgs)]
pub struct OpenFundingLine<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(
        init,
        payer = authority,
        space = 8 + FundingLine::INIT_SPACE,
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), args.line_id.as_bytes()],
        bump
    )]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + FundingLineLedger::INIT_SPACE,
        seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + PlanReserveLedger::INIT_SPACE,
        seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()],
        bump
    )]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundSponsorBudget<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Account<'info, FundingLine>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Account<'info, FundingLineLedger>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), funding_line.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Account<'info, PlanReserveLedger>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
}

#[derive(Accounts)]
pub struct RecordPremiumPayment<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), funding_line.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Account<'info, FundingLine>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Account<'info, FundingLineLedger>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), funding_line.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Account<'info, PlanReserveLedger>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
}

#[derive(Accounts)]
#[instruction(args: CreateObligationArgs)]
pub struct CreateObligation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), args.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), args.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + Obligation::INIT_SPACE,
        seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), args.obligation_id.as_bytes()],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReserveObligation<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
}

#[derive(Accounts)]
pub struct SettleObligation<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
}

#[derive(Accounts)]
pub struct ReleaseReserve<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, health_plan.reserve_domain.as_ref(), obligation.asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_FUNDING_LINE_LEDGER, funding_line.key().as_ref(), funding_line.asset_mint.as_ref()], bump = funding_line_ledger.bump)]
    pub funding_line_ledger: Box<Account<'info, FundingLineLedger>>,
    #[account(mut, seeds = [SEED_PLAN_RESERVE_LEDGER, health_plan.key().as_ref(), obligation.asset_mint.as_ref()], bump = plan_reserve_ledger.bump)]
    pub plan_reserve_ledger: Box<Account<'info, PlanReserveLedger>>,
    #[account(mut)]
    pub series_reserve_ledger: Option<Box<Account<'info, SeriesReserveLedger>>>,
    #[account(mut)]
    pub pool_class_ledger: Option<Box<Account<'info, PoolClassLedger>>>,
    #[account(mut)]
    pub allocation_position: Option<Box<Account<'info, AllocationPosition>>>,
    #[account(mut)]
    pub allocation_ledger: Option<Box<Account<'info, AllocationLedger>>>,
    #[account(mut, seeds = [SEED_OBLIGATION, funding_line.key().as_ref(), obligation.obligation_id.as_bytes()], bump = obligation.bump)]
    pub obligation: Box<Account<'info, Obligation>>,
}

#[derive(Accounts)]
#[instruction(args: OpenClaimCaseArgs)]
pub struct OpenClaimCase<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Account<'info, HealthPlan>,
    #[account(seeds = [SEED_MEMBER_POSITION, health_plan.key().as_ref(), member_position.wallet.as_ref(), member_position.policy_series.as_ref()], bump = member_position.bump)]
    pub member_position: Account<'info, MemberPosition>,
    #[account(seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Account<'info, FundingLine>,
    #[account(
        init,
        payer = authority,
        space = 8 + ClaimCase::INIT_SPACE,
        seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), args.claim_id.as_bytes()],
        bump
    )]
    pub claim_case: Account<'info, ClaimCase>,
    pub system_program: Program<'info, System>,
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
}

#[derive(Accounts)]
#[instruction(args: CreateLiquidityPoolArgs)]
pub struct CreateLiquidityPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    #[account(seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(
        init,
        payer = authority,
        space = 8 + LiquidityPool::INIT_SPACE,
        seeds = [SEED_LIQUIDITY_POOL, reserve_domain.key().as_ref(), args.pool_id.as_bytes()],
        bump
    )]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: CreateCapitalClassArgs)]
pub struct CreateCapitalClass<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(
        init,
        payer = authority,
        space = 8 + CapitalClass::INIT_SPACE,
        seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), args.class_id.as_bytes()],
        bump
    )]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolClassLedger::INIT_SPACE,
        seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()],
        bump
    )]
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateCapitalClassControls<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
}

#[derive(Accounts)]
#[instruction(args: UpdateLpPositionCredentialingArgs)]
pub struct UpdateLpPositionCredentialing<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), args.owner.as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LPPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositIntoCapitalClass<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub lp_position: Account<'info, LPPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestRedemption<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[account(mut, seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), owner.key().as_ref()], bump = lp_position.bump, constraint = lp_position.owner == owner.key() @ OmegaXProtocolError::Unauthorized)]
    pub lp_position: Account<'info, LPPosition>,
}

#[derive(Accounts)]
pub struct ProcessRedemptionQueue<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Account<'info, DomainAssetVault>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Account<'info, DomainAssetLedger>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Account<'info, CapitalClass>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Account<'info, PoolClassLedger>,
    #[account(mut, seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), lp_position.owner.as_ref()], bump = lp_position.bump)]
    pub lp_position: Account<'info, LPPosition>,
}

#[derive(Accounts)]
pub struct CreateAllocationPosition<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + AllocationPosition::INIT_SPACE,
        seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()],
        bump
    )]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[account(
        init,
        payer = authority,
        space = 8 + AllocationLedger::INIT_SPACE,
        seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()],
        bump
    )]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAllocationCaps<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Account<'info, LiquidityPool>,
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, allocation_position.capital_class.as_ref(), allocation_position.funding_line.as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Account<'info, AllocationPosition>,
}

#[derive(Accounts)]
pub struct AllocateCapital<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(seeds = [SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[account(mut, seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()], bump = allocation_ledger.bump)]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
}

#[derive(Accounts)]
pub struct DeallocateCapital<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(seeds = [SEED_FUNDING_LINE, allocation_position.health_plan.as_ref(), funding_line.line_id.as_bytes()], bump = funding_line.bump)]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(mut, seeds = [SEED_ALLOCATION_POSITION, capital_class.key().as_ref(), funding_line.key().as_ref()], bump = allocation_position.bump)]
    pub allocation_position: Box<Account<'info, AllocationPosition>>,
    #[account(mut, seeds = [SEED_ALLOCATION_LEDGER, allocation_position.key().as_ref(), funding_line.asset_mint.as_ref()], bump = allocation_ledger.bump)]
    pub allocation_ledger: Box<Account<'info, AllocationLedger>>,
}

#[derive(Accounts)]
pub struct MarkImpairment<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
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
    #[account(mut)]
    pub obligation: Option<Box<Account<'info, Obligation>>>,
}

#[account]
#[derive(InitSpace)]
pub struct ProtocolGovernance {
    pub governance_authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub emergency_pause: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReserveDomain {
    pub protocol_governance: Pubkey,
    pub domain_admin: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub domain_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub settlement_mode: u8,
    pub legal_structure_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub allowed_rail_mask: u16,
    pub pause_flags: u32,
    pub active: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DomainAssetVault {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub total_assets: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HealthPlan {
    pub reserve_domain: Pubkey,
    pub sponsor: Pubkey,
    pub plan_admin: Pubkey,
    pub sponsor_operator: Pubkey,
    pub claims_operator: Pubkey,
    pub oracle_authority: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub health_plan_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_ORG_REF_LEN)]
    pub organization_ref: String,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub membership_mode: u8,
    pub membership_gate_kind: u8,
    pub membership_gate_mint: Pubkey,
    pub membership_gate_min_amount: u64,
    pub membership_invite_authority: Pubkey,
    pub allowed_rail_mask: u16,
    pub default_funding_priority: u8,
    pub oracle_policy_hash: [u8; 32],
    pub schema_binding_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub pause_flags: u32,
    pub active: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PolicySeries {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub asset_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub series_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub mode: u8,
    pub status: u8,
    pub adjudication_mode: u8,
    pub terms_hash: [u8; 32],
    pub pricing_hash: [u8; 32],
    pub payout_hash: [u8; 32],
    pub reserve_model_hash: [u8; 32],
    pub evidence_requirements_hash: [u8; 32],
    pub comparability_hash: [u8; 32],
    pub policy_overrides_hash: [u8; 32],
    pub cycle_seconds: i64,
    pub terms_version: u16,
    pub prior_series: Pubkey,
    pub successor_series: Pubkey,
    pub live_since_ts: i64,
    pub material_locked: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MemberPosition {
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub wallet: Pubkey,
    pub subject_commitment: [u8; 32],
    pub eligibility_status: u8,
    pub delegated_rights: u32,
    pub enrollment_proof_mode: u8,
    pub membership_gate_kind: u8,
    pub membership_anchor_ref: Pubkey,
    pub gate_amount_snapshot: u64,
    pub invite_id_hash: [u8; 32],
    pub active: bool,
    pub opened_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MembershipAnchorSeat {
    pub health_plan: Pubkey,
    pub anchor_ref: Pubkey,
    pub gate_kind: u8,
    pub holder_wallet: Pubkey,
    pub member_position: Pubkey,
    pub active: bool,
    pub opened_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FundingLine {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub line_id: String,
    pub line_type: u8,
    pub funding_priority: u8,
    pub committed_amount: u64,
    pub funded_amount: u64,
    pub reserved_amount: u64,
    pub spent_amount: u64,
    pub released_amount: u64,
    pub returned_amount: u64,
    pub status: u8,
    pub caps_hash: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimCase {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub member_position: Pubkey,
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub claim_id: String,
    pub claimant: Pubkey,
    pub adjudicator: Pubkey,
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
    pub intake_status: u8,
    pub review_state: u8,
    pub approved_amount: u64,
    pub denied_amount: u64,
    pub paid_amount: u64,
    pub reserved_amount: u64,
    pub recovered_amount: u64,
    pub appeal_count: u16,
    pub linked_obligation: Pubkey,
    pub opened_at: i64,
    pub updated_at: i64,
    pub closed_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Obligation {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub member_wallet: Pubkey,
    pub beneficiary: Pubkey,
    pub funding_line: Pubkey,
    pub claim_case: Pubkey,
    pub liquidity_pool: Pubkey,
    pub capital_class: Pubkey,
    pub allocation_position: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub obligation_id: String,
    pub creation_reason_hash: [u8; 32],
    pub settlement_reason_hash: [u8; 32],
    pub status: u8,
    pub delivery_mode: u8,
    pub principal_amount: u64,
    pub outstanding_amount: u64,
    pub reserved_amount: u64,
    pub claimable_amount: u64,
    pub payable_amount: u64,
    pub settled_amount: u64,
    pub impaired_amount: u64,
    pub recovered_amount: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LiquidityPool {
    pub reserve_domain: Pubkey,
    pub curator: Pubkey,
    pub allocator: Pubkey,
    pub sentinel: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub pool_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub deposit_asset_mint: Pubkey,
    pub strategy_hash: [u8; 32],
    pub allowed_exposure_hash: [u8; 32],
    pub external_yield_adapter_hash: [u8; 32],
    pub fee_bps: u16,
    pub redemption_policy: u8,
    pub pause_flags: u32,
    pub total_value_locked: u64,
    pub total_allocated: u64,
    pub total_reserved: u64,
    pub total_impaired: u64,
    pub total_pending_redemptions: u64,
    pub active: bool,
    pub audit_nonce: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CapitalClass {
    pub reserve_domain: Pubkey,
    pub liquidity_pool: Pubkey,
    pub share_mint: Pubkey,
    #[max_len(MAX_ID_LEN)]
    pub class_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub priority: u8,
    pub impairment_rank: u8,
    pub restriction_mode: u8,
    pub redemption_terms_mode: u8,
    pub wrapper_metadata_hash: [u8; 32],
    pub permissioning_hash: [u8; 32],
    pub fee_bps: u16,
    pub min_lockup_seconds: i64,
    pub pause_flags: u32,
    pub queue_only_redemptions: bool,
    pub total_shares: u64,
    pub nav_assets: u64,
    pub allocated_assets: u64,
    pub reserved_assets: u64,
    pub impaired_assets: u64,
    pub pending_redemptions: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LPPosition {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub subscription_basis: u64,
    pub pending_redemption_shares: u64,
    pub realized_distributions: u64,
    pub impaired_principal: u64,
    pub lockup_ends_at: i64,
    pub credentialed: bool,
    pub queue_status: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AllocationPosition {
    pub reserve_domain: Pubkey,
    pub liquidity_pool: Pubkey,
    pub capital_class: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub funding_line: Pubkey,
    pub cap_amount: u64,
    pub weight_bps: u16,
    pub allocation_mode: u8,
    pub allocated_amount: u64,
    pub utilized_amount: u64,
    pub reserved_capacity: u64,
    pub realized_pnl: i64,
    pub impaired_amount: u64,
    pub deallocation_only: bool,
    pub active: bool,
    pub bump: u8,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, Debug, PartialEq, Eq, InitSpace,
)]
pub struct ReserveBalanceSheet {
    pub funded: u64,
    pub allocated: u64,
    pub reserved: u64,
    pub owed: u64,
    pub claimable: u64,
    pub payable: u64,
    pub settled: u64,
    pub impaired: u64,
    pub pending_redemption: u64,
    pub restricted: u64,
    pub free: u64,
    pub redeemable: u64,
}

#[account]
#[derive(InitSpace)]
pub struct DomainAssetLedger {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PlanReserveLedger {
    pub health_plan: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SeriesReserveLedger {
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FundingLineLedger {
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolClassLedger {
    pub capital_class: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub total_shares: u64,
    pub realized_yield_amount: u64,
    pub realized_loss_amount: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AllocationLedger {
    pub allocation_position: Pubkey,
    pub asset_mint: Pubkey,
    pub sheet: ReserveBalanceSheet,
    pub realized_pnl: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct InitializeProtocolGovernanceArgs {
    pub protocol_fee_bps: u16,
    pub emergency_pause: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct SetProtocolEmergencyPauseArgs {
    pub emergency_pause: bool,
    pub reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateReserveDomainArgs {
    #[max_len(MAX_ID_LEN)]
    pub domain_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub domain_admin: Pubkey,
    pub settlement_mode: u8,
    pub legal_structure_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub allowed_rail_mask: u16,
    pub pause_flags: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpdateReserveDomainControlsArgs {
    pub allowed_rail_mask: u16,
    pub pause_flags: u32,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateDomainAssetVaultArgs {
    pub asset_mint: Pubkey,
    pub vault_token_account: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateHealthPlanArgs {
    #[max_len(MAX_ID_LEN)]
    pub plan_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_ORG_REF_LEN)]
    pub organization_ref: String,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub sponsor: Pubkey,
    pub sponsor_operator: Pubkey,
    pub claims_operator: Pubkey,
    pub oracle_authority: Pubkey,
    pub membership_mode: u8,
    pub membership_gate_kind: u8,
    pub membership_gate_mint: Pubkey,
    pub membership_gate_min_amount: u64,
    pub membership_invite_authority: Pubkey,
    pub allowed_rail_mask: u16,
    pub default_funding_priority: u8,
    pub oracle_policy_hash: [u8; 32],
    pub schema_binding_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub pause_flags: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpdateHealthPlanControlsArgs {
    pub sponsor_operator: Pubkey,
    pub claims_operator: Pubkey,
    pub oracle_authority: Pubkey,
    pub membership_mode: u8,
    pub membership_gate_kind: u8,
    pub membership_gate_mint: Pubkey,
    pub membership_gate_min_amount: u64,
    pub membership_invite_authority: Pubkey,
    pub allowed_rail_mask: u16,
    pub default_funding_priority: u8,
    pub oracle_policy_hash: [u8; 32],
    pub schema_binding_hash: [u8; 32],
    pub compliance_baseline_hash: [u8; 32],
    pub pause_flags: u32,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreatePolicySeriesArgs {
    #[max_len(MAX_ID_LEN)]
    pub series_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub asset_mint: Pubkey,
    pub mode: u8,
    pub status: u8,
    pub adjudication_mode: u8,
    pub terms_hash: [u8; 32],
    pub pricing_hash: [u8; 32],
    pub payout_hash: [u8; 32],
    pub reserve_model_hash: [u8; 32],
    pub evidence_requirements_hash: [u8; 32],
    pub comparability_hash: [u8; 32],
    pub policy_overrides_hash: [u8; 32],
    pub cycle_seconds: i64,
    pub terms_version: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct VersionPolicySeriesArgs {
    #[max_len(MAX_ID_LEN)]
    pub series_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub status: u8,
    pub adjudication_mode: u8,
    pub terms_hash: [u8; 32],
    pub pricing_hash: [u8; 32],
    pub payout_hash: [u8; 32],
    pub reserve_model_hash: [u8; 32],
    pub evidence_requirements_hash: [u8; 32],
    pub comparability_hash: [u8; 32],
    pub policy_overrides_hash: [u8; 32],
    pub cycle_seconds: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct OpenMemberPositionArgs {
    pub series_scope: Pubkey,
    pub subject_commitment: [u8; 32],
    pub eligibility_status: u8,
    pub delegated_rights: u32,
    pub proof_mode: u8,
    pub token_gate_amount_snapshot: u64,
    pub invite_id_hash: [u8; 32],
    pub invite_expires_at: i64,
    pub anchor_ref: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpdateMemberEligibilityArgs {
    pub eligibility_status: u8,
    pub delegated_rights: u32,
    pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct OpenFundingLineArgs {
    #[max_len(MAX_ID_LEN)]
    pub line_id: String,
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    pub line_type: u8,
    pub funding_priority: u8,
    pub committed_amount: u64,
    pub caps_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct FundSponsorBudgetArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RecordPremiumPaymentArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateObligationArgs {
    #[max_len(MAX_ID_LEN)]
    pub obligation_id: String,
    pub asset_mint: Pubkey,
    pub policy_series: Pubkey,
    pub member_wallet: Pubkey,
    pub beneficiary: Pubkey,
    pub claim_case: Pubkey,
    pub liquidity_pool: Pubkey,
    pub capital_class: Pubkey,
    pub allocation_position: Pubkey,
    pub delivery_mode: u8,
    pub amount: u64,
    pub creation_reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct ReserveObligationArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct SettleObligationArgs {
    pub next_status: u8,
    pub amount: u64,
    pub settlement_reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct ReleaseReserveArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct OpenClaimCaseArgs {
    #[max_len(MAX_ID_LEN)]
    pub claim_id: String,
    pub policy_series: Pubkey,
    pub claimant: Pubkey,
    pub evidence_ref_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct AttachClaimEvidenceRefArgs {
    pub evidence_ref_hash: [u8; 32],
    pub decision_support_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct AdjudicateClaimCaseArgs {
    pub review_state: u8,
    pub approved_amount: u64,
    pub denied_amount: u64,
    pub reserve_amount: u64,
    pub decision_support_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct SettleClaimCaseArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateLiquidityPoolArgs {
    #[max_len(MAX_ID_LEN)]
    pub pool_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub curator: Pubkey,
    pub allocator: Pubkey,
    pub sentinel: Pubkey,
    pub deposit_asset_mint: Pubkey,
    pub strategy_hash: [u8; 32],
    pub allowed_exposure_hash: [u8; 32],
    pub external_yield_adapter_hash: [u8; 32],
    pub fee_bps: u16,
    pub redemption_policy: u8,
    pub pause_flags: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateCapitalClassArgs {
    #[max_len(MAX_ID_LEN)]
    pub class_id: String,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    pub share_mint: Pubkey,
    pub priority: u8,
    pub impairment_rank: u8,
    pub restriction_mode: u8,
    pub redemption_terms_mode: u8,
    pub wrapper_metadata_hash: [u8; 32],
    pub permissioning_hash: [u8; 32],
    pub fee_bps: u16,
    pub min_lockup_seconds: i64,
    pub pause_flags: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpdateCapitalClassControlsArgs {
    pub pause_flags: u32,
    pub queue_only_redemptions: bool,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpdateLpPositionCredentialingArgs {
    pub owner: Pubkey,
    pub credentialed: bool,
    pub reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct DepositIntoCapitalClassArgs {
    pub amount: u64,
    pub shares: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RequestRedemptionArgs {
    pub shares: u64,
    pub asset_amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct ProcessRedemptionQueueArgs {
    pub shares: u64,
    pub asset_amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct CreateAllocationPositionArgs {
    pub policy_series: Pubkey,
    pub cap_amount: u64,
    pub weight_bps: u16,
    pub allocation_mode: u8,
    pub deallocation_only: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpdateAllocationCapsArgs {
    pub cap_amount: u64,
    pub weight_bps: u16,
    pub deallocation_only: bool,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct AllocateCapitalArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct DeallocateCapitalArgs {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct MarkImpairmentArgs {
    pub amount: u64,
    pub reason_hash: [u8; 32],
}

#[event]
pub struct ProtocolGovernanceInitializedEvent {
    pub governance_authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub emergency_pause: bool,
}

#[event]
pub struct ReserveDomainCreatedEvent {
    pub reserve_domain: Pubkey,
    pub domain_admin: Pubkey,
    pub settlement_mode: u8,
}

#[event]
pub struct HealthPlanCreatedEvent {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub sponsor: Pubkey,
}

#[event]
pub struct PolicySeriesCreatedEvent {
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    pub mode: u8,
    pub terms_version: u16,
}

#[event]
pub struct PolicySeriesVersionedEvent {
    pub prior_series: Pubkey,
    pub next_series: Pubkey,
    pub new_terms_version: u16,
}

#[event]
pub struct FundingLineOpenedEvent {
    pub health_plan: Pubkey,
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    pub line_type: u8,
}

#[event]
pub struct FundingFlowRecordedEvent {
    pub funding_line: Pubkey,
    pub amount: u64,
    pub flow_kind: u8,
}

#[event]
pub struct LiquidityPoolCreatedEvent {
    pub reserve_domain: Pubkey,
    pub liquidity_pool: Pubkey,
    pub asset_mint: Pubkey,
}

#[event]
pub struct CapitalClassDepositEvent {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub asset_amount: u64,
    pub shares: u64,
}

#[event]
pub struct LPPositionCredentialingUpdatedEvent {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub authority: Pubkey,
    pub credentialed: bool,
    pub reason_hash: [u8; 32],
}

#[event]
pub struct RedemptionRequestedEvent {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub asset_amount: u64,
}

#[event]
pub struct ObligationStatusChangedEvent {
    pub obligation: Pubkey,
    pub funding_line: Pubkey,
    pub status: u8,
    pub amount: u64,
}

#[event]
pub struct ClaimCaseStateChangedEvent {
    pub claim_case: Pubkey,
    pub intake_status: u8,
    pub approved_amount: u64,
}

#[event]
pub struct AllocationUpdatedEvent {
    pub allocation_position: Pubkey,
    pub capital_class: Pubkey,
    pub funding_line: Pubkey,
    pub allocated_amount: u64,
    pub reserved_capacity: u64,
}

#[event]
pub struct ImpairmentRecordedEvent {
    pub funding_line: Pubkey,
    pub obligation: Pubkey,
    pub amount: u64,
    pub reason_hash: [u8; 32],
}

#[event]
pub struct ScopedControlChangedEvent {
    pub scope_kind: u8,
    pub scope: Pubkey,
    pub authority: Pubkey,
    pub pause_flags: u32,
    pub reason_hash: [u8; 32],
    pub audit_nonce: u64,
}

#[event]
pub struct LedgerInitializedEvent {
    pub scope_kind: u8,
    pub scope: Pubkey,
    pub asset_mint: Pubkey,
}

#[derive(Clone, Copy)]
pub enum ScopeKind {
    ProtocolGovernance = 0,
    ReserveDomain = 1,
    DomainAssetVault = 2,
    HealthPlan = 3,
    PolicySeries = 4,
    FundingLine = 5,
    LiquidityPool = 6,
    CapitalClass = 7,
    AllocationPosition = 8,
}

#[derive(Clone, Copy)]
pub enum FundingFlowKind {
    SponsorBudgetFunded = 0,
    PremiumRecorded = 1,
}

#[error_code]
pub enum OmegaXProtocolError {
    #[msg("Caller is not authorized for this scope")]
    Unauthorized,
    #[msg("Protocol governance is emergency paused")]
    ProtocolEmergencyPaused,
    #[msg("Reserve domain is inactive")]
    ReserveDomainInactive,
    #[msg("Health plan is paused")]
    HealthPlanPaused,
    #[msg("Claim intake is paused")]
    ClaimIntakePaused,
    #[msg("Capital subscriptions are paused")]
    CapitalSubscriptionsPaused,
    #[msg("Invalid basis points value")]
    InvalidBps,
    #[msg("Identifier length exceeds the canonical maximum")]
    IdentifierTooLong,
    #[msg("Health plan mismatch")]
    HealthPlanMismatch,
    #[msg("Policy series mismatch")]
    PolicySeriesMismatch,
    #[msg("Policy series is missing where one is required")]
    PolicySeriesMissing,
    #[msg("Unexpected series ledger was provided")]
    SeriesLedgerUnexpected,
    #[msg("Asset mint mismatch")]
    AssetMintMismatch,
    #[msg("Funding line type mismatch")]
    FundingLineTypeMismatch,
    #[msg("Invalid obligation state transition")]
    InvalidObligationStateTransition,
    #[msg("Amount exceeds outstanding obligation")]
    AmountExceedsOutstandingObligation,
    #[msg("Amount exceeds reserved balance")]
    AmountExceedsReservedBalance,
    #[msg("Amount exceeds approved claim")]
    AmountExceedsApprovedClaim,
    #[msg("Amount exceeds available shares")]
    AmountExceedsAvailableShares,
    #[msg("Amount exceeds pending redemption")]
    AmountExceedsPendingRedemption,
    #[msg("Restricted capital class access failed")]
    RestrictedCapitalClass,
    #[msg("LP position with active capital cannot be decredentialed")]
    LPPositionHasActiveCapital,
    #[msg("Capital class lockup is still active")]
    LockupActive,
    #[msg("Allocation cap exceeded")]
    AllocationCapExceeded,
    #[msg("Insufficient free allocation capacity")]
    InsufficientFreeAllocationCapacity,
    #[msg("Arithmetic overflow or underflow")]
    ArithmeticError,
    #[msg("Membership gate configuration is invalid")]
    MembershipGateConfigurationInvalid,
    #[msg("Membership proof mode does not match the configured plan posture")]
    MembershipProofModeMismatch,
    #[msg("Invite authority is missing or invalid for this plan")]
    MembershipInviteAuthorityInvalid,
    #[msg("Invite permit is expired")]
    MembershipInvitePermitExpired,
    #[msg("Token-gate proof account is missing")]
    MembershipTokenGateAccountMissing,
    #[msg("Token-gate proof account owner does not match the enrolling wallet")]
    MembershipTokenGateOwnerMismatch,
    #[msg("Token-gate proof account mint does not match the configured gate mint")]
    MembershipTokenGateMintMismatch,
    #[msg("Token-gate proof amount is below the configured minimum")]
    MembershipTokenGateAmountTooLow,
    #[msg("Anchor-backed membership requires an anchor seat account")]
    MembershipAnchorSeatRequired,
    #[msg("Anchor-backed membership seat is already active")]
    MembershipAnchorSeatAlreadyActive,
    #[msg("Anchor-backed membership seat does not match the provided anchor reference")]
    MembershipAnchorSeatMismatch,
    #[msg("Anchor-backed membership requires a non-zero anchor reference")]
    MembershipAnchorReferenceMissing,
}

fn require_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

fn require_governance(authority: &Pubkey, governance: &ProtocolGovernance) -> Result<()> {
    require_keys_eq!(
        *authority,
        governance.governance_authority,
        OmegaXProtocolError::Unauthorized
    );
    Ok(())
}

fn require_domain_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    domain: &ReserveDomain,
) -> Result<()> {
    if *authority == domain.domain_admin || *authority == governance.governance_authority {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn require_plan_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
) -> Result<()> {
    if *authority == plan.plan_admin
        || *authority == plan.sponsor_operator
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn health_plan_membership_mode(plan: &HealthPlan) -> u8 {
    plan.membership_mode
}

fn membership_mode_requires_token_gate(mode: u8) -> bool {
    mode == MEMBERSHIP_MODE_TOKEN_GATE
}

fn membership_gate_kind_requires_anchor_seat(mode: u8, gate_kind: u8) -> bool {
    membership_mode_requires_token_gate(mode)
        && (gate_kind == MEMBERSHIP_GATE_KIND_NFT_ANCHOR
            || gate_kind == MEMBERSHIP_GATE_KIND_STAKE_ANCHOR)
}

fn validate_membership_gate_fields(
    membership_mode: u8,
    membership_gate_kind: u8,
    membership_gate_mint: Pubkey,
    membership_gate_min_amount: u64,
    membership_invite_authority: Pubkey,
) -> Result<()> {
    match membership_mode {
        MEMBERSHIP_MODE_OPEN => {
            require!(
                membership_gate_kind == MEMBERSHIP_GATE_KIND_OPEN
                    && membership_gate_mint == ZERO_PUBKEY
                    && membership_gate_min_amount == 0
                    && membership_invite_authority == ZERO_PUBKEY,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
        }
        MEMBERSHIP_MODE_INVITE_ONLY => {
            require!(
                membership_gate_kind == MEMBERSHIP_GATE_KIND_INVITE_ONLY
                    && membership_gate_mint == ZERO_PUBKEY
                    && membership_gate_min_amount == 0
                    && membership_invite_authority != ZERO_PUBKEY,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
        }
        MEMBERSHIP_MODE_TOKEN_GATE => {
            require!(
                membership_gate_kind == MEMBERSHIP_GATE_KIND_NFT_ANCHOR
                    || membership_gate_kind == MEMBERSHIP_GATE_KIND_STAKE_ANCHOR
                    || membership_gate_kind == MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
            require!(
                membership_gate_mint != ZERO_PUBKEY && membership_gate_min_amount > 0,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
            require!(
                membership_invite_authority == ZERO_PUBKEY,
                OmegaXProtocolError::MembershipGateConfigurationInvalid
            );
        }
        _ => return err!(OmegaXProtocolError::MembershipGateConfigurationInvalid),
    }

    Ok(())
}

fn validate_membership_gate_config(args: &CreateHealthPlanArgs) -> Result<()> {
    validate_membership_gate_fields(
        args.membership_mode,
        args.membership_gate_kind,
        args.membership_gate_mint,
        args.membership_gate_min_amount,
        args.membership_invite_authority,
    )
}

fn validate_membership_gate_update_config(args: &UpdateHealthPlanControlsArgs) -> Result<()> {
    validate_membership_gate_fields(
        args.membership_mode,
        args.membership_gate_kind,
        args.membership_gate_mint,
        args.membership_gate_min_amount,
        args.membership_invite_authority,
    )
}

fn validate_membership_proof(
    ctx: &Context<OpenMemberPosition>,
    args: &OpenMemberPositionArgs,
) -> Result<()> {
    validate_membership_proof_inputs(&MembershipProofValidationInput {
        membership_mode: ctx.accounts.health_plan.membership_mode,
        membership_gate_mint: ctx.accounts.health_plan.membership_gate_mint,
        membership_gate_min_amount: ctx.accounts.health_plan.membership_gate_min_amount,
        membership_invite_authority: ctx.accounts.health_plan.membership_invite_authority,
        wallet: ctx.accounts.wallet.key(),
        proof_mode: args.proof_mode,
        token_gate_amount_snapshot: args.token_gate_amount_snapshot,
        invite_expires_at: args.invite_expires_at,
        token_gate_owner: ctx
            .accounts
            .token_gate_account
            .as_ref()
            .map(|account| account.owner),
        token_gate_mint: ctx
            .accounts
            .token_gate_account
            .as_ref()
            .map(|account| account.mint),
        token_gate_amount: ctx
            .accounts
            .token_gate_account
            .as_ref()
            .map(|account| account.amount),
        invite_authority: ctx
            .accounts
            .invite_authority
            .as_ref()
            .map(|authority| authority.key()),
        now_ts: Clock::get()?.unix_timestamp,
    })
}

struct MembershipProofValidationInput {
    membership_mode: u8,
    membership_gate_mint: Pubkey,
    membership_gate_min_amount: u64,
    membership_invite_authority: Pubkey,
    wallet: Pubkey,
    proof_mode: u8,
    token_gate_amount_snapshot: u64,
    invite_expires_at: i64,
    token_gate_owner: Option<Pubkey>,
    token_gate_mint: Option<Pubkey>,
    token_gate_amount: Option<u64>,
    invite_authority: Option<Pubkey>,
    now_ts: i64,
}

fn validate_membership_proof_inputs(input: &MembershipProofValidationInput) -> Result<()> {
    match input.membership_mode {
        MEMBERSHIP_MODE_OPEN => {
            require!(
                input.proof_mode == MEMBERSHIP_PROOF_MODE_OPEN,
                OmegaXProtocolError::MembershipProofModeMismatch
            );
        }
        MEMBERSHIP_MODE_INVITE_ONLY => {
            require!(
                input.proof_mode == MEMBERSHIP_PROOF_MODE_INVITE_PERMIT,
                OmegaXProtocolError::MembershipProofModeMismatch
            );
            let invite_authority = input
                .invite_authority
                .ok_or(OmegaXProtocolError::MembershipInviteAuthorityInvalid)?;
            require_keys_eq!(
                invite_authority,
                input.membership_invite_authority,
                OmegaXProtocolError::MembershipInviteAuthorityInvalid
            );
            require!(
                input.invite_expires_at == 0 || input.invite_expires_at >= input.now_ts,
                OmegaXProtocolError::MembershipInvitePermitExpired
            );
        }
        MEMBERSHIP_MODE_TOKEN_GATE => {
            require!(
                input.proof_mode == MEMBERSHIP_PROOF_MODE_TOKEN_GATE,
                OmegaXProtocolError::MembershipProofModeMismatch
            );
            let token_gate_owner = input
                .token_gate_owner
                .ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            let token_gate_mint = input
                .token_gate_mint
                .ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            let token_gate_amount = input
                .token_gate_amount
                .ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            require_keys_eq!(
                token_gate_owner,
                input.wallet,
                OmegaXProtocolError::MembershipTokenGateOwnerMismatch
            );
            require_keys_eq!(
                token_gate_mint,
                input.membership_gate_mint,
                OmegaXProtocolError::MembershipTokenGateMintMismatch
            );
            require!(
                token_gate_amount >= input.membership_gate_min_amount,
                OmegaXProtocolError::MembershipTokenGateAmountTooLow
            );
            require!(
                input.token_gate_amount_snapshot >= input.membership_gate_min_amount,
                OmegaXProtocolError::MembershipTokenGateAmountTooLow
            );
        }
        _ => return err!(OmegaXProtocolError::MembershipGateConfigurationInvalid),
    }

    Ok(())
}

fn resolved_membership_anchor_ref(
    plan: &HealthPlan,
    token_gate_account: Option<Pubkey>,
    anchor_ref: Pubkey,
) -> Result<Pubkey> {
    match plan.membership_gate_kind {
        MEMBERSHIP_GATE_KIND_NFT_ANCHOR => {
            require!(
                anchor_ref != ZERO_PUBKEY,
                OmegaXProtocolError::MembershipAnchorReferenceMissing
            );
            require_keys_eq!(
                anchor_ref,
                plan.membership_gate_mint,
                OmegaXProtocolError::MembershipAnchorSeatMismatch
            );
            Ok(anchor_ref)
        }
        MEMBERSHIP_GATE_KIND_STAKE_ANCHOR => {
            let token_gate_account =
                token_gate_account.ok_or(OmegaXProtocolError::MembershipTokenGateAccountMissing)?;
            require!(
                anchor_ref != ZERO_PUBKEY,
                OmegaXProtocolError::MembershipAnchorReferenceMissing
            );
            require_keys_eq!(
                anchor_ref,
                token_gate_account,
                OmegaXProtocolError::MembershipAnchorSeatMismatch
            );
            Ok(anchor_ref)
        }
        _ => Ok(ZERO_PUBKEY),
    }
}

fn activate_membership_anchor_seat(
    anchor_seat: &mut MembershipAnchorSeat,
    health_plan: Pubkey,
    anchor_ref: Pubkey,
    gate_kind: u8,
    holder_wallet: Pubkey,
    member_position: Pubkey,
    now_ts: i64,
    bump: Option<u8>,
) -> Result<()> {
    if anchor_seat.health_plan == ZERO_PUBKEY {
        anchor_seat.health_plan = health_plan;
        anchor_seat.anchor_ref = anchor_ref;
        anchor_seat.gate_kind = gate_kind;
        anchor_seat.holder_wallet = holder_wallet;
        anchor_seat.member_position = member_position;
        anchor_seat.active = true;
        anchor_seat.opened_at = now_ts;
        anchor_seat.updated_at = now_ts;
        anchor_seat.bump = bump.unwrap_or(anchor_seat.bump);
        return Ok(());
    }

    require_keys_eq!(
        anchor_seat.health_plan,
        health_plan,
        OmegaXProtocolError::MembershipAnchorSeatMismatch
    );
    require_keys_eq!(
        anchor_seat.anchor_ref,
        anchor_ref,
        OmegaXProtocolError::MembershipAnchorSeatMismatch
    );
    require!(
        !anchor_seat.active,
        OmegaXProtocolError::MembershipAnchorSeatAlreadyActive
    );
    anchor_seat.gate_kind = gate_kind;
    anchor_seat.holder_wallet = holder_wallet;
    anchor_seat.member_position = member_position;
    anchor_seat.active = true;
    anchor_seat.updated_at = now_ts;
    if anchor_seat.opened_at == 0 {
        anchor_seat.opened_at = now_ts;
    }

    Ok(())
}

fn require_claim_operator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
) -> Result<()> {
    if *authority == plan.claims_operator
        || *authority == plan.plan_admin
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn require_pool_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    pool: &LiquidityPool,
) -> Result<()> {
    if *authority == pool.curator
        || *authority == pool.allocator
        || *authority == pool.sentinel
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn require_curator_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    pool: &LiquidityPool,
) -> Result<()> {
    if *authority == pool.curator || *authority == governance.governance_authority {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn require_allocator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    pool: &LiquidityPool,
) -> Result<()> {
    if *authority == pool.allocator
        || *authority == pool.curator
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn require_class_access(capital_class: &CapitalClass, credentialed: bool) -> Result<()> {
    require_class_access_mode(capital_class.restriction_mode, credentialed)
}

fn require_class_access_mode(restriction_mode: u8, credentialed: bool) -> Result<()> {
    match restriction_mode {
        CAPITAL_CLASS_RESTRICTION_OPEN => Ok(()),
        CAPITAL_CLASS_RESTRICTION_RESTRICTED | CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY => {
            require!(credentialed, OmegaXProtocolError::RestrictedCapitalClass);
            Ok(())
        }
        _ => err!(OmegaXProtocolError::RestrictedCapitalClass),
    }
}

fn ensure_lp_position_binding(
    lp_position: &mut LPPosition,
    capital_class: Pubkey,
    owner: Pubkey,
    bump: u8,
) -> Result<()> {
    if lp_position.owner == ZERO_PUBKEY && lp_position.capital_class == ZERO_PUBKEY {
        lp_position.capital_class = capital_class;
        lp_position.owner = owner;
        lp_position.shares = 0;
        lp_position.subscription_basis = 0;
        lp_position.pending_redemption_shares = 0;
        lp_position.realized_distributions = 0;
        lp_position.impaired_principal = 0;
        lp_position.lockup_ends_at = 0;
        lp_position.credentialed = false;
        lp_position.queue_status = LP_QUEUE_STATUS_NONE;
        lp_position.bump = bump;
        return Ok(());
    }

    require_keys_eq!(
        lp_position.capital_class,
        capital_class,
        OmegaXProtocolError::Unauthorized
    );
    require_keys_eq!(lp_position.owner, owner, OmegaXProtocolError::Unauthorized);

    if lp_position.bump == 0 {
        lp_position.bump = bump;
    }

    Ok(())
}

fn update_lp_position_credentialing_state(
    lp_position: &mut LPPosition,
    credentialed: bool,
) -> Result<()> {
    if !credentialed {
        require!(
            lp_position.shares == 0 && lp_position.pending_redemption_shares == 0,
            OmegaXProtocolError::LPPositionHasActiveCapital
        );
    }

    lp_position.credentialed = credentialed;
    Ok(())
}

fn apply_lp_position_deposit(
    lp_position: &mut LPPosition,
    amount: u64,
    shares: u64,
    min_lockup_seconds: i64,
    now_ts: i64,
) -> Result<()> {
    lp_position.shares = checked_add(lp_position.shares, shares)?;
    lp_position.subscription_basis = checked_add(lp_position.subscription_basis, amount)?;
    lp_position.lockup_ends_at = now_ts
        .checked_add(min_lockup_seconds)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    Ok(())
}

fn checked_add(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

fn checked_sub(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs)
        .ok_or_else(|| OmegaXProtocolError::ArithmeticError.into())
}

fn recompute_sheet(sheet: &mut ReserveBalanceSheet) -> Result<()> {
    let encumbered = sheet
        .reserved
        .checked_add(sheet.claimable)
        .and_then(|value| value.checked_add(sheet.payable))
        .and_then(|value| value.checked_add(sheet.impaired))
        .and_then(|value| value.checked_add(sheet.pending_redemption))
        .and_then(|value| value.checked_add(sheet.restricted))
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.free = sheet.funded.saturating_sub(encumbered);
    let redeemable_encumbered = encumbered
        .checked_add(sheet.allocated)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    sheet.redeemable = sheet.funded.saturating_sub(redeemable_encumbered);
    Ok(())
}

fn book_inflow(target: &mut u64, amount: u64) -> Result<()> {
    *target = checked_add(*target, amount)?;
    Ok(())
}

fn book_inflow_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.funded = checked_add(sheet.funded, amount)?;
    recompute_sheet(sheet)
}

fn book_owed(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.owed = checked_add(sheet.owed, amount)?;
    recompute_sheet(sheet)
}

fn book_reserve(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = checked_add(sheet.reserved, amount)?;
    recompute_sheet(sheet)
}

fn release_reserved_sheet(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.reserved = checked_sub(sheet.reserved, amount)?;
    sheet.owed = sheet.owed.saturating_sub(amount);
    recompute_sheet(sheet)
}

fn release_to_claimable_or_payable(
    sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    sheet.reserved = checked_sub(sheet.reserved, amount)?;
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE => {
            sheet.claimable = checked_add(sheet.claimable, amount)?;
        }
        OBLIGATION_DELIVERY_MODE_PAYABLE => {
            sheet.payable = checked_add(sheet.payable, amount)?;
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }
    recompute_sheet(sheet)
}

fn settle_from_sheet(
    sheet: &mut ReserveBalanceSheet,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    match delivery_mode {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE => {
            if sheet.claimable >= amount {
                sheet.claimable = checked_sub(sheet.claimable, amount)?;
            } else if sheet.reserved >= amount {
                sheet.reserved = checked_sub(sheet.reserved, amount)?;
            } else {
                return err!(OmegaXProtocolError::AmountExceedsReservedBalance);
            }
        }
        OBLIGATION_DELIVERY_MODE_PAYABLE => {
            if sheet.payable >= amount {
                sheet.payable = checked_sub(sheet.payable, amount)?;
            } else if sheet.reserved >= amount {
                sheet.reserved = checked_sub(sheet.reserved, amount)?;
            } else {
                return err!(OmegaXProtocolError::AmountExceedsReservedBalance);
            }
        }
        _ => return err!(OmegaXProtocolError::InvalidObligationStateTransition),
    }
    sheet.funded = checked_sub(sheet.funded, amount)?;
    sheet.owed = sheet.owed.saturating_sub(amount);
    sheet.settled = checked_add(sheet.settled, amount)?;
    recompute_sheet(sheet)
}

fn book_pending_redemption(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.pending_redemption = checked_add(sheet.pending_redemption, amount)?;
    recompute_sheet(sheet)
}

fn settle_pending_redemption(
    ledger: &mut PoolClassLedger,
    asset_amount: u64,
    shares: u64,
) -> Result<()> {
    ledger.sheet.pending_redemption = checked_sub(ledger.sheet.pending_redemption, asset_amount)?;
    ledger.sheet.funded = checked_sub(ledger.sheet.funded, asset_amount)?;
    ledger.sheet.settled = checked_add(ledger.sheet.settled, asset_amount)?;
    ledger.total_shares = checked_sub(ledger.total_shares, shares)?;
    recompute_sheet(&mut ledger.sheet)
}

fn settle_pending_redemption_domain(
    sheet: &mut ReserveBalanceSheet,
    asset_amount: u64,
) -> Result<()> {
    sheet.pending_redemption = checked_sub(sheet.pending_redemption, asset_amount)?;
    sheet.funded = checked_sub(sheet.funded, asset_amount)?;
    sheet.settled = checked_add(sheet.settled, asset_amount)?;
    recompute_sheet(sheet)
}

fn book_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = checked_add(sheet.allocated, amount)?;
    recompute_sheet(sheet)
}

fn release_allocation(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.allocated = checked_sub(sheet.allocated, amount)?;
    recompute_sheet(sheet)
}

fn book_impairment(sheet: &mut ReserveBalanceSheet, amount: u64) -> Result<()> {
    sheet.impaired = checked_add(sheet.impaired, amount)?;
    recompute_sheet(sheet)
}

fn release_reserved_scoped(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    amount: u64,
) -> Result<()> {
    release_reserved_sheet(domain_sheet, amount)?;
    release_reserved_sheet(plan_sheet, amount)?;
    release_reserved_sheet(line_sheet, amount)?;
    if let Some(series) = series_sheet {
        release_reserved_sheet(&mut series.sheet, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        release_reserved_sheet(&mut class_ledger.sheet, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = checked_sub(position.reserved_capacity, amount)?;
        position.utilized_amount = checked_sub(position.utilized_amount, amount)?;
    }
    if let Some(ledger) = allocation_sheet {
        release_reserved_sheet(&mut ledger.sheet, amount)?;
    }
    Ok(())
}

fn release_reserved_to_delivery(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    delivery_mode: u8,
    amount: u64,
) -> Result<()> {
    release_to_claimable_or_payable(domain_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(plan_sheet, delivery_mode, amount)?;
    release_to_claimable_or_payable(line_sheet, delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        release_to_claimable_or_payable(&mut series.sheet, delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        release_to_claimable_or_payable(&mut class_ledger.sheet, delivery_mode, amount)?;
    }
    if let Some(allocation_ledger) = allocation_sheet {
        release_to_claimable_or_payable(&mut allocation_ledger.sheet, delivery_mode, amount)?;
    }
    Ok(())
}

fn settle_delivery(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
    obligation: &mut Obligation,
) -> Result<()> {
    settle_from_sheet(domain_sheet, obligation.delivery_mode, amount)?;
    settle_from_sheet(plan_sheet, obligation.delivery_mode, amount)?;
    settle_from_sheet(line_sheet, obligation.delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        settle_from_sheet(&mut series.sheet, obligation.delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        settle_from_sheet(&mut class_ledger.sheet, obligation.delivery_mode, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
    }
    if let Some(ledger) = allocation_sheet {
        settle_from_sheet(&mut ledger.sheet, obligation.delivery_mode, amount)?;
    }
    *domain_assets = checked_sub(*domain_assets, amount)?;
    funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
    funding_line.spent_amount = checked_add(funding_line.spent_amount, amount)?;
    obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
    obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
    obligation.payable_amount = obligation.payable_amount.saturating_sub(amount);
    obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
    obligation.settled_amount = checked_add(obligation.settled_amount, amount)?;
    Ok(())
}

fn cancel_outstanding(
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
    obligation: &mut Obligation,
) -> Result<()> {
    if obligation.reserved_amount >= amount {
        release_reserved_sheet(domain_sheet, amount)?;
        release_reserved_sheet(plan_sheet, amount)?;
        release_reserved_sheet(line_sheet, amount)?;
        if let Some(series) = series_sheet {
            release_reserved_sheet(&mut series.sheet, amount)?;
        }
        if let Some(class_ledger) = class_sheet {
            release_reserved_sheet(&mut class_ledger.sheet, amount)?;
        }
        if let Some(position) = allocation_position {
            position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
            position.utilized_amount = position.utilized_amount.saturating_sub(amount);
        }
        if let Some(ledger) = allocation_sheet {
            release_reserved_sheet(&mut ledger.sheet, amount)?;
        }
        funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
        funding_line.released_amount = checked_add(funding_line.released_amount, amount)?;
        obligation.reserved_amount = obligation.reserved_amount.saturating_sub(amount);
    } else if obligation.claimable_amount >= amount || obligation.payable_amount >= amount {
        if obligation.delivery_mode == OBLIGATION_DELIVERY_MODE_CLAIMABLE {
            domain_sheet.claimable = domain_sheet.claimable.saturating_sub(amount);
            plan_sheet.claimable = plan_sheet.claimable.saturating_sub(amount);
            line_sheet.claimable = line_sheet.claimable.saturating_sub(amount);
            if let Some(series) = series_sheet {
                series.sheet.claimable = series.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut series.sheet)?;
            }
            if let Some(class_ledger) = class_sheet {
                class_ledger.sheet.claimable = class_ledger.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut class_ledger.sheet)?;
            }
            if let Some(ledger) = allocation_sheet {
                ledger.sheet.claimable = ledger.sheet.claimable.saturating_sub(amount);
                recompute_sheet(&mut ledger.sheet)?;
            }
            obligation.claimable_amount = obligation.claimable_amount.saturating_sub(amount);
        } else {
            domain_sheet.payable = domain_sheet.payable.saturating_sub(amount);
            plan_sheet.payable = plan_sheet.payable.saturating_sub(amount);
            line_sheet.payable = line_sheet.payable.saturating_sub(amount);
            if let Some(series) = series_sheet {
                series.sheet.payable = series.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut series.sheet)?;
            }
            if let Some(class_ledger) = class_sheet {
                class_ledger.sheet.payable = class_ledger.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut class_ledger.sheet)?;
            }
            if let Some(ledger) = allocation_sheet {
                ledger.sheet.payable = ledger.sheet.payable.saturating_sub(amount);
                recompute_sheet(&mut ledger.sheet)?;
            }
            obligation.payable_amount = obligation.payable_amount.saturating_sub(amount);
        }
        domain_sheet.owed = domain_sheet.owed.saturating_sub(amount);
        plan_sheet.owed = plan_sheet.owed.saturating_sub(amount);
        line_sheet.owed = line_sheet.owed.saturating_sub(amount);
        recompute_sheet(domain_sheet)?;
        recompute_sheet(plan_sheet)?;
        recompute_sheet(line_sheet)?;
    } else {
        return err!(OmegaXProtocolError::InvalidObligationStateTransition);
    }
    obligation.outstanding_amount = obligation.outstanding_amount.saturating_sub(amount);
    Ok(())
}

fn book_settlement_from_delivery(
    domain_assets: &mut u64,
    domain_sheet: &mut ReserveBalanceSheet,
    plan_sheet: &mut ReserveBalanceSheet,
    line_sheet: &mut ReserveBalanceSheet,
    series_sheet: Option<&mut Account<SeriesReserveLedger>>,
    class_sheet: Option<&mut Account<PoolClassLedger>>,
    allocation_position: Option<&mut Account<AllocationPosition>>,
    allocation_sheet: Option<&mut Account<AllocationLedger>>,
    funding_line: &mut FundingLine,
    amount: u64,
) -> Result<()> {
    let delivery_mode = if line_sheet.claimable >= amount {
        OBLIGATION_DELIVERY_MODE_CLAIMABLE
    } else {
        OBLIGATION_DELIVERY_MODE_PAYABLE
    };
    settle_from_sheet(domain_sheet, delivery_mode, amount)?;
    settle_from_sheet(plan_sheet, delivery_mode, amount)?;
    settle_from_sheet(line_sheet, delivery_mode, amount)?;
    if let Some(series) = series_sheet {
        settle_from_sheet(&mut series.sheet, delivery_mode, amount)?;
    }
    if let Some(class_ledger) = class_sheet {
        settle_from_sheet(&mut class_ledger.sheet, delivery_mode, amount)?;
    }
    if let Some(position) = allocation_position {
        position.reserved_capacity = position.reserved_capacity.saturating_sub(amount);
    }
    if let Some(ledger) = allocation_sheet {
        settle_from_sheet(&mut ledger.sheet, delivery_mode, amount)?;
    }
    *domain_assets = checked_sub(*domain_assets, amount)?;
    funding_line.reserved_amount = funding_line.reserved_amount.saturating_sub(amount);
    funding_line.spent_amount = checked_add(funding_line.spent_amount, amount)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn class_access_requires_credential_for_restricted_modes() {
        assert!(require_class_access_mode(CAPITAL_CLASS_RESTRICTION_OPEN, false).is_ok());
        assert!(require_class_access_mode(CAPITAL_CLASS_RESTRICTION_RESTRICTED, false).is_err());
        assert!(require_class_access_mode(CAPITAL_CLASS_RESTRICTION_RESTRICTED, true).is_ok());
        assert!(require_class_access_mode(CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY, false).is_err());
        assert!(require_class_access_mode(CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY, true).is_ok());
    }

    #[test]
    fn lp_credentialing_cannot_revoke_active_position() {
        let mut lp_position = LPPosition {
            capital_class: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            shares: 10,
            subscription_basis: 10,
            pending_redemption_shares: 1,
            realized_distributions: 0,
            impaired_principal: 0,
            lockup_ends_at: 0,
            credentialed: true,
            queue_status: LP_QUEUE_STATUS_PENDING,
            bump: 7,
        };

        assert!(update_lp_position_credentialing_state(&mut lp_position, false).is_err());
        assert!(lp_position.credentialed);
    }

    #[test]
    fn lp_position_binding_initializes_fresh_position() {
        let mut lp_position = LPPosition {
            capital_class: ZERO_PUBKEY,
            owner: ZERO_PUBKEY,
            shares: 0,
            subscription_basis: 0,
            pending_redemption_shares: 0,
            realized_distributions: 0,
            impaired_principal: 0,
            lockup_ends_at: 0,
            credentialed: false,
            queue_status: 0,
            bump: 0,
        };
        let capital_class = Pubkey::new_unique();
        let owner = Pubkey::new_unique();

        ensure_lp_position_binding(&mut lp_position, capital_class, owner, 9).unwrap();

        assert_eq!(lp_position.capital_class, capital_class);
        assert_eq!(lp_position.owner, owner);
        assert_eq!(lp_position.queue_status, LP_QUEUE_STATUS_NONE);
        assert_eq!(lp_position.bump, 9);
        assert!(!lp_position.credentialed);
    }

    #[test]
    fn lp_deposit_top_up_preserves_existing_state() {
        let mut lp_position = LPPosition {
            capital_class: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            shares: 100,
            subscription_basis: 90,
            pending_redemption_shares: 12,
            realized_distributions: 7,
            impaired_principal: 3,
            lockup_ends_at: 50,
            credentialed: true,
            queue_status: LP_QUEUE_STATUS_PENDING,
            bump: 4,
        };

        apply_lp_position_deposit(&mut lp_position, 25, 30, 120, 1_000).unwrap();

        assert_eq!(lp_position.shares, 130);
        assert_eq!(lp_position.subscription_basis, 115);
        assert_eq!(lp_position.pending_redemption_shares, 12);
        assert_eq!(lp_position.realized_distributions, 7);
        assert_eq!(lp_position.impaired_principal, 3);
        assert_eq!(lp_position.queue_status, LP_QUEUE_STATUS_PENDING);
        assert!(lp_position.credentialed);
        assert_eq!(lp_position.lockup_ends_at, 1_120);
    }

    #[test]
    fn balance_sheet_recompute_preserves_free_and_redeemable() {
        let mut sheet = ReserveBalanceSheet {
            funded: 1_000,
            allocated: 250,
            reserved: 100,
            owed: 100,
            claimable: 50,
            payable: 25,
            settled: 0,
            impaired: 75,
            pending_redemption: 40,
            restricted: 10,
            free: 0,
            redeemable: 0,
        };
        recompute_sheet(&mut sheet).unwrap();
        assert_eq!(sheet.free, 700);
        assert_eq!(sheet.redeemable, 450);
    }

    #[test]
    fn sponsor_budget_reserve_and_settlement_walks_the_kernel() {
        let mut sheet = ReserveBalanceSheet::default();
        book_inflow_sheet(&mut sheet, 500).unwrap();
        book_owed(&mut sheet, 120).unwrap();
        book_reserve(&mut sheet, 120).unwrap();
        assert_eq!(sheet.free, 380);
        release_to_claimable_or_payable(&mut sheet, OBLIGATION_DELIVERY_MODE_CLAIMABLE, 120)
            .unwrap();
        assert_eq!(sheet.claimable, 120);
        settle_from_sheet(&mut sheet, OBLIGATION_DELIVERY_MODE_CLAIMABLE, 120).unwrap();
        assert_eq!(sheet.funded, 380);
        assert_eq!(sheet.settled, 120);
        assert_eq!(sheet.owed, 0);
    }

    #[test]
    fn allocation_and_impairment_reduce_redeemable_before_free_hits_zero() {
        let mut sheet = ReserveBalanceSheet::default();
        book_inflow_sheet(&mut sheet, 1_000).unwrap();
        book_allocation(&mut sheet, 400).unwrap();
        book_reserve(&mut sheet, 150).unwrap();
        book_impairment(&mut sheet, 100).unwrap();
        assert_eq!(sheet.free, 750);
        assert_eq!(sheet.redeemable, 350);
    }

    fn membership_proof_input(
        membership_mode: u8,
        proof_mode: u8,
    ) -> MembershipProofValidationInput {
        MembershipProofValidationInput {
            membership_mode,
            membership_gate_mint: Pubkey::new_unique(),
            membership_gate_min_amount: 1,
            membership_invite_authority: Pubkey::new_unique(),
            wallet: Pubkey::new_unique(),
            proof_mode,
            token_gate_amount_snapshot: 1,
            invite_expires_at: 0,
            token_gate_owner: None,
            token_gate_mint: None,
            token_gate_amount: None,
            invite_authority: None,
            now_ts: 100,
        }
    }

    fn health_plan_with_membership_gate(gate_kind: u8, gate_mint: Pubkey) -> HealthPlan {
        HealthPlan {
            reserve_domain: Pubkey::new_unique(),
            sponsor: Pubkey::new_unique(),
            plan_admin: Pubkey::new_unique(),
            sponsor_operator: Pubkey::new_unique(),
            claims_operator: Pubkey::new_unique(),
            oracle_authority: Pubkey::new_unique(),
            health_plan_id: String::new(),
            display_name: String::new(),
            organization_ref: String::new(),
            metadata_uri: String::new(),
            membership_mode: MEMBERSHIP_MODE_TOKEN_GATE,
            membership_gate_kind: gate_kind,
            membership_gate_mint: gate_mint,
            membership_gate_min_amount: 1,
            membership_invite_authority: ZERO_PUBKEY,
            allowed_rail_mask: 0,
            default_funding_priority: 0,
            oracle_policy_hash: [0; 32],
            schema_binding_hash: [0; 32],
            compliance_baseline_hash: [0; 32],
            pause_flags: 0,
            active: true,
            audit_nonce: 0,
            bump: 1,
        }
    }

    #[test]
    fn membership_proof_validation_accepts_open_and_invite_modes() {
        let open_input = membership_proof_input(MEMBERSHIP_MODE_OPEN, MEMBERSHIP_PROOF_MODE_OPEN);
        assert!(validate_membership_proof_inputs(&open_input).is_ok());

        let mut invite_input = membership_proof_input(
            MEMBERSHIP_MODE_INVITE_ONLY,
            MEMBERSHIP_PROOF_MODE_INVITE_PERMIT,
        );
        invite_input.invite_authority = Some(invite_input.membership_invite_authority);
        invite_input.invite_expires_at = invite_input.now_ts + 10;
        assert!(validate_membership_proof_inputs(&invite_input).is_ok());
    }

    #[test]
    fn membership_proof_validation_accepts_token_gate_variants() {
        let mut snapshot_input =
            membership_proof_input(MEMBERSHIP_MODE_TOKEN_GATE, MEMBERSHIP_PROOF_MODE_TOKEN_GATE);
        snapshot_input.membership_gate_min_amount = 500;
        snapshot_input.token_gate_amount_snapshot = 500;
        snapshot_input.token_gate_owner = Some(snapshot_input.wallet);
        snapshot_input.token_gate_mint = Some(snapshot_input.membership_gate_mint);
        snapshot_input.token_gate_amount = Some(500);
        assert!(validate_membership_proof_inputs(&snapshot_input).is_ok());

        let nft_anchor_ref = resolved_membership_anchor_ref(
            &health_plan_with_membership_gate(
                MEMBERSHIP_GATE_KIND_NFT_ANCHOR,
                snapshot_input.membership_gate_mint,
            ),
            None,
            snapshot_input.membership_gate_mint,
        )
        .unwrap();
        assert_eq!(nft_anchor_ref, snapshot_input.membership_gate_mint);

        let stake_anchor_account = Pubkey::new_unique();
        let stake_anchor_ref = resolved_membership_anchor_ref(
            &health_plan_with_membership_gate(
                MEMBERSHIP_GATE_KIND_STAKE_ANCHOR,
                snapshot_input.membership_gate_mint,
            ),
            Some(stake_anchor_account),
            stake_anchor_account,
        )
        .unwrap();
        assert_eq!(stake_anchor_ref, stake_anchor_account);
    }

    #[test]
    fn membership_anchor_seat_cannot_be_activated_twice_while_live() {
        let health_plan = Pubkey::new_unique();
        let anchor_ref = Pubkey::new_unique();
        let mut anchor_seat = MembershipAnchorSeat {
            health_plan: ZERO_PUBKEY,
            anchor_ref: ZERO_PUBKEY,
            gate_kind: MEMBERSHIP_GATE_KIND_NFT_ANCHOR,
            holder_wallet: ZERO_PUBKEY,
            member_position: ZERO_PUBKEY,
            active: false,
            opened_at: 0,
            updated_at: 0,
            bump: 0,
        };

        assert!(activate_membership_anchor_seat(
            &mut anchor_seat,
            health_plan,
            anchor_ref,
            MEMBERSHIP_GATE_KIND_NFT_ANCHOR,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            50,
            Some(9),
        )
        .is_ok());
        assert!(anchor_seat.active);
        assert_eq!(anchor_seat.health_plan, health_plan);
        assert_eq!(anchor_seat.anchor_ref, anchor_ref);

        assert!(activate_membership_anchor_seat(
            &mut anchor_seat,
            health_plan,
            anchor_ref,
            MEMBERSHIP_GATE_KIND_NFT_ANCHOR,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            60,
            Some(9),
        )
        .is_err());

        anchor_seat.active = false;
        assert!(activate_membership_anchor_seat(
            &mut anchor_seat,
            health_plan,
            anchor_ref,
            MEMBERSHIP_GATE_KIND_NFT_ANCHOR,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            70,
            Some(9),
        )
        .is_ok());
        assert!(anchor_seat.active);
        assert_eq!(anchor_seat.opened_at, 50);
        assert_eq!(anchor_seat.updated_at, 70);
    }
}
