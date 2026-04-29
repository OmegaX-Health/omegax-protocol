// SPDX-License-Identifier: AGPL-3.0-or-later

//! Canonical OmegaX health capital markets program surface.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

declare_id!("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");

pub const MAX_ID_LEN: usize = 32;
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_LONG_NAME_LEN: usize = 96;
pub const MAX_URI_LEN: usize = 160;
pub const MAX_ORG_REF_LEN: usize = 64;
pub const MAX_ORACLE_SUPPORTED_SCHEMAS: usize = 16;
pub const MAX_SCHEMA_KEY_LEN: usize = 96;
pub const MAX_SCHEMA_DEPENDENCY_RULES: usize = 32;

pub const SEED_PROTOCOL_GOVERNANCE: &[u8] = b"protocol_governance";
pub const SEED_RESERVE_DOMAIN: &[u8] = b"reserve_domain";
pub const SEED_DOMAIN_ASSET_VAULT: &[u8] = b"domain_asset_vault";
pub const SEED_DOMAIN_ASSET_VAULT_TOKEN: &[u8] = b"domain_asset_vault_token";
pub const SEED_DOMAIN_ASSET_LEDGER: &[u8] = b"domain_asset_ledger";
pub const SEED_PROTOCOL_FEE_VAULT: &[u8] = b"protocol_fee_vault";
pub const SEED_POOL_TREASURY_VAULT: &[u8] = b"pool_treasury_vault";
pub const SEED_POOL_ORACLE_FEE_VAULT: &[u8] = b"pool_oracle_fee_vault";
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
pub const SEED_ORACLE_PROFILE: &[u8] = b"oracle_profile";
pub const SEED_POOL_ORACLE_APPROVAL: &[u8] = b"pool_oracle_approval";
pub const SEED_POOL_ORACLE_POLICY: &[u8] = b"pool_oracle_policy";
pub const SEED_POOL_ORACLE_PERMISSION_SET: &[u8] = b"pool_oracle_permission_set";
pub const SEED_OUTCOME_SCHEMA: &[u8] = b"outcome_schema";
pub const SEED_SCHEMA_DEPENDENCY_LEDGER: &[u8] = b"schema_dependency_ledger";
pub const SEED_CLAIM_ATTESTATION: &[u8] = b"claim_attestation";

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

pub const CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE: u8 = 0;
pub const CLAIM_ATTESTATION_DECISION_SUPPORT_DENY: u8 = 1;
pub const CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW: u8 = 2;
pub const CLAIM_ATTESTATION_DECISION_ABSTAIN: u8 = 3;

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

pub const ORACLE_TYPE_LAB: u8 = 0;
pub const ORACLE_TYPE_HOSPITAL_CLINIC: u8 = 1;
pub const ORACLE_TYPE_HEALTH_APP: u8 = 2;
pub const ORACLE_TYPE_WEARABLE_DATA_PROVIDER: u8 = 3;
pub const ORACLE_TYPE_OTHER: u8 = 255;

pub const SCHEMA_FAMILY_KERNEL: u8 = 0;
pub const SCHEMA_FAMILY_CLINICAL: u8 = 1;
pub const SCHEMA_FAMILY_CLAIMS_CODING: u8 = 2;

pub const SCHEMA_VISIBILITY_PUBLIC: u8 = 0;
pub const SCHEMA_VISIBILITY_PRIVATE: u8 = 1;
pub const SCHEMA_VISIBILITY_RESTRICTED: u8 = 2;

pub const PAUSE_FLAG_PROTOCOL_EMERGENCY: u32 = 1 << 0;
pub const PAUSE_FLAG_DOMAIN_RAILS: u32 = 1 << 1;
pub const PAUSE_FLAG_PLAN_OPERATIONS: u32 = 1 << 2;
pub const PAUSE_FLAG_CLAIM_INTAKE: u32 = 1 << 3;
pub const PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS: u32 = 1 << 4;
pub const PAUSE_FLAG_REDEMPTION_QUEUE_ONLY: u32 = 1 << 5;
pub const PAUSE_FLAG_ORACLE_FINALITY_HOLD: u32 = 1 << 6;
pub const PAUSE_FLAG_ALLOCATION_FREEZE: u32 = 1 << 7;

pub const ZERO_PUBKEY: Pubkey = Pubkey::new_from_array([0u8; 32]);

// Native SOL "mint" sentinel used by fee-vault rails to distinguish lamport
// accounting from SPL token accounting. Matches `spl_token::native_mint::ID`
// (canonical wrapped-SOL mint). For SOL fee vaults the lamports physically
// reside on the fee-vault PDA itself and `transfer_lamports_from_fee_vault`
// drains them with rent-exemption preserved. For SPL fee vaults the tokens
// physically reside in the matching `DomainAssetVault.vault_token_account`
// and `transfer_from_domain_vault` (PDA-signed) drains them.
pub const NATIVE_SOL_MINT: Pubkey = anchor_spl::token::spl_token::native_mint::ID;

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

    pub fn rotate_protocol_governance_authority(
        ctx: Context<RotateProtocolGovernanceAuthority>,
        args: RotateProtocolGovernanceAuthorityArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;

        let governance = &mut ctx.accounts.protocol_governance;
        let previous_governance_authority =
            rotate_protocol_governance_authority_state(governance, args.new_governance_authority)?;

        emit!(ProtocolGovernanceAuthorityRotatedEvent {
            previous_governance_authority,
            new_governance_authority: governance.governance_authority,
            authority: ctx.accounts.authority.key(),
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
        require!(
            args.asset_mint != ZERO_PUBKEY,
            OmegaXProtocolError::VaultTokenAccountInvalid
        );

        let vault = &mut ctx.accounts.domain_asset_vault;
        vault.reserve_domain = ctx.accounts.reserve_domain.key();
        vault.asset_mint = args.asset_mint;
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
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

    /// Phase 1.6 — Initialize the protocol-fee vault for a (reserve_domain, asset_mint)
    /// rail. Governance-only; binds the rail to the asset mint at the program edge.
    /// Withdrawal authority is governance (PR2). Accrual is wired in PR1 hooks.
    pub fn init_protocol_fee_vault(
        ctx: Context<InitProtocolFeeVault>,
        args: InitProtocolFeeVaultArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;
        require!(
            args.asset_mint != ZERO_PUBKEY,
            OmegaXProtocolError::AssetMintMismatch
        );
        // SPL rails MUST present a DomainAssetVault; SOL rail keeps lamports on the
        // fee-vault PDA itself.
        if args.asset_mint != NATIVE_SOL_MINT {
            require!(
                ctx.accounts.domain_asset_vault.is_some(),
                OmegaXProtocolError::DomainAssetVaultRequired
            );
        }

        let vault = &mut ctx.accounts.protocol_fee_vault;
        vault.reserve_domain = ctx.accounts.reserve_domain.key();
        vault.asset_mint = args.asset_mint;
        vault.accrued_fees = 0;
        vault.withdrawn_fees = 0;
        vault.bump = ctx.bumps.protocol_fee_vault;

        emit!(FeeVaultInitializedEvent {
            vault: vault.key(),
            scope: vault.reserve_domain,
            asset_mint: vault.asset_mint,
            rail: 0,
        });

        Ok(())
    }

    /// Phase 1.6 — Initialize the pool-treasury vault for a (liquidity_pool, asset_mint)
    /// rail. Governance-only init; pool-admin signs withdrawals (PR2).
    pub fn init_pool_treasury_vault(
        ctx: Context<InitPoolTreasuryVault>,
        args: InitPoolTreasuryVaultArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;
        require!(
            args.asset_mint != ZERO_PUBKEY,
            OmegaXProtocolError::AssetMintMismatch
        );
        // Either SOL rail or matching the pool's SPL deposit mint.
        require!(
            args.asset_mint == NATIVE_SOL_MINT
                || args.asset_mint == ctx.accounts.liquidity_pool.deposit_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
        if args.asset_mint != NATIVE_SOL_MINT {
            require!(
                ctx.accounts.domain_asset_vault.is_some(),
                OmegaXProtocolError::DomainAssetVaultRequired
            );
        }

        let vault = &mut ctx.accounts.pool_treasury_vault;
        vault.liquidity_pool = ctx.accounts.liquidity_pool.key();
        vault.asset_mint = args.asset_mint;
        vault.accrued_fees = 0;
        vault.withdrawn_fees = 0;
        vault.bump = ctx.bumps.pool_treasury_vault;

        emit!(FeeVaultInitializedEvent {
            vault: vault.key(),
            scope: vault.liquidity_pool,
            asset_mint: vault.asset_mint,
            rail: 1,
        });

        Ok(())
    }

    /// Phase 1.6 — Initialize the pool-oracle fee vault for a (liquidity_pool,
    /// oracle, asset_mint) rail. Governance-only init; the registered oracle
    /// wallet (or oracle profile admin) signs withdrawals (PR2).
    pub fn init_pool_oracle_fee_vault(
        ctx: Context<InitPoolOracleFeeVault>,
        args: InitPoolOracleFeeVaultArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;
        require!(
            args.asset_mint != ZERO_PUBKEY,
            OmegaXProtocolError::AssetMintMismatch
        );
        require!(
            args.oracle != ZERO_PUBKEY,
            OmegaXProtocolError::OracleProfileMismatch
        );
        require!(
            ctx.accounts.oracle_profile.active,
            OmegaXProtocolError::OracleProfileInactive
        );
        require!(
            ctx.accounts.oracle_profile.claimed,
            OmegaXProtocolError::OracleProfileUnclaimed
        );
        // Either SOL rail or matching the pool's SPL deposit mint.
        require!(
            args.asset_mint == NATIVE_SOL_MINT
                || args.asset_mint == ctx.accounts.liquidity_pool.deposit_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
        if args.asset_mint != NATIVE_SOL_MINT {
            require!(
                ctx.accounts.domain_asset_vault.is_some(),
                OmegaXProtocolError::DomainAssetVaultRequired
            );
        }

        let vault = &mut ctx.accounts.pool_oracle_fee_vault;
        vault.liquidity_pool = ctx.accounts.liquidity_pool.key();
        vault.oracle = args.oracle;
        vault.asset_mint = args.asset_mint;
        vault.accrued_fees = 0;
        vault.withdrawn_fees = 0;
        vault.bump = ctx.bumps.pool_oracle_fee_vault;

        emit!(FeeVaultInitializedEvent {
            vault: vault.key(),
            scope: vault.liquidity_pool,
            asset_mint: vault.asset_mint,
            rail: 2,
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require_positive_amount(args.amount)?;
        require!(
            ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_SPONSOR_BUDGET,
            OmegaXProtocolError::FundingLineTypeMismatch
        );
        transfer_to_domain_vault(
            args.amount,
            &ctx.accounts.authority,
            &ctx.accounts.source_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.token_program,
            &ctx.accounts.domain_asset_vault,
        )?;
        validate_optional_series_ledger(
            ctx.accounts.series_reserve_ledger.as_deref(),
            ctx.accounts.funding_line.policy_series,
            ctx.accounts.funding_line.asset_mint,
        )?;

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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_plan_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require_positive_amount(args.amount)?;
        require!(
            ctx.accounts.funding_line.line_type == FUNDING_LINE_TYPE_PREMIUM_INCOME,
            OmegaXProtocolError::FundingLineTypeMismatch
        );
        transfer_to_domain_vault(
            args.amount,
            &ctx.accounts.authority,
            &ctx.accounts.source_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.token_program,
            &ctx.accounts.domain_asset_vault,
        )?;
        validate_optional_series_ledger(
            ctx.accounts.series_reserve_ledger.as_deref(),
            ctx.accounts.funding_line.policy_series,
            ctx.accounts.funding_line.asset_mint,
        )?;

        let amount = args.amount;
        // Capture immutable values needed after the mutable borrow on funding_line
        // and during the protocol_fee_vault accrual block below.
        let funding_line_key = ctx.accounts.funding_line.key();
        let funding_line_asset_mint = ctx.accounts.funding_line.asset_mint;
        let health_plan_reserve_domain = ctx.accounts.health_plan.reserve_domain;
        let protocol_fee_bps = ctx.accounts.protocol_governance.protocol_fee_bps;

        let funding_line = &mut ctx.accounts.funding_line;
        funding_line.funded_amount = checked_add(funding_line.funded_amount, amount)?;
        book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
        book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.plan_reserve_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.funding_line_ledger.sheet, amount)?;

        if let Some(series_ledger) = ctx.accounts.series_reserve_ledger.as_deref_mut() {
            book_inflow_sheet(&mut series_ledger.sheet, amount)?;
        }

        // Phase 1.6 — Protocol fee accrual on premium income.
        // The full premium amount is booked into the vault; the fee is an
        // internal claim that decrements `accrued_fees - withdrawn_fees`
        // headroom. No user-facing payout reduction here (premiums are not
        // refundable). Accrual is skipped silently when `protocol_fee_vault`
        // is None to preserve backward compatibility for callers that have
        // not yet initialized the fee infrastructure.
        if let Some(vault) = ctx.accounts.protocol_fee_vault.as_deref_mut() {
            require_keys_eq!(
                vault.reserve_domain,
                health_plan_reserve_domain,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                funding_line_asset_mint,
                OmegaXProtocolError::FeeVaultMismatch
            );
            let fee = fee_share_from_bps(amount, protocol_fee_bps)?;
            if fee > 0 {
                let vault_key = vault.key();
                let vault_mint = vault.asset_mint;
                let accrued_total = accrue_fee(&mut vault.accrued_fees, fee)?;
                emit!(FeeAccruedEvent {
                    vault: vault_key,
                    asset_mint: vault_mint,
                    amount: fee,
                    accrued_total,
                });
            }
        }

        emit!(FundingFlowRecordedEvent {
            funding_line: funding_line_key,
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
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
        require_positive_amount(args.amount)?;
        validate_optional_series_ledger(
            ctx.accounts.series_reserve_ledger.as_deref(),
            args.policy_series,
            args.asset_mint,
        )?;
        validate_optional_pool_class_ledger(
            ctx.accounts.pool_class_ledger.as_deref(),
            args.capital_class,
            args.asset_mint,
        )?;
        validate_optional_allocation_ledger(
            ctx.accounts.allocation_ledger.as_deref(),
            args.allocation_position,
            args.asset_mint,
        )?;

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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        let reserve_amount = args.amount;
        require_positive_amount(reserve_amount)?;
        let now_ts = Clock::get()?.unix_timestamp;
        let obligation = &mut ctx.accounts.obligation;
        let obligation_key = obligation.key();
        require_obligation_reserve_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
            obligation,
        )?;
        require!(
            obligation.status == OBLIGATION_STATUS_PROPOSED,
            OmegaXProtocolError::InvalidObligationStateTransition
        );
        require!(
            reserve_amount <= obligation.outstanding_amount,
            OmegaXProtocolError::AmountExceedsOutstandingObligation
        );
        validate_treasury_mutation_bindings(
            ctx.accounts.series_reserve_ledger.as_deref(),
            ctx.accounts.pool_class_ledger.as_deref(),
            ctx.accounts.allocation_position.as_deref(),
            ctx.accounts.allocation_ledger.as_deref(),
            obligation,
            ctx.accounts.funding_line.key(),
            ctx.accounts.funding_line.asset_mint,
        )?;

        obligation.status = OBLIGATION_STATUS_RESERVED;
        obligation.reserved_amount = reserve_amount;
        obligation.updated_at = now_ts;

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

        if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
            let claim_case_key = claim_case.key();
            sync_linked_claim_case_reserve(
                claim_case,
                claim_case_key,
                obligation,
                obligation_key,
                ctx.accounts.health_plan.key(),
                now_ts,
            )?;
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        let amount = args.amount;
        require_positive_amount(amount)?;
        let now_ts = Clock::get()?.unix_timestamp;
        let obligation = &mut ctx.accounts.obligation;
        let obligation_key = obligation.key();
        require_obligation_settlement_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
            obligation,
        )?;
        require!(
            amount <= obligation.outstanding_amount,
            OmegaXProtocolError::AmountExceedsOutstandingObligation
        );
        validate_treasury_mutation_bindings(
            ctx.accounts.series_reserve_ledger.as_deref(),
            ctx.accounts.pool_class_ledger.as_deref(),
            ctx.accounts.allocation_position.as_deref(),
            ctx.accounts.allocation_ledger.as_deref(),
            obligation,
            ctx.accounts.funding_line.key(),
            ctx.accounts.funding_line.asset_mint,
        )?;

        if let Some(claim_case) = ctx.accounts.claim_case.as_deref() {
            require_matching_linked_claim_case(
                claim_case,
                claim_case.key(),
                obligation,
                obligation.key(),
                ctx.accounts.health_plan.key(),
            )?;
            if args.next_status == OBLIGATION_STATUS_SETTLED {
                require!(
                    amount <= remaining_claim_amount(claim_case),
                    OmegaXProtocolError::AmountExceedsApprovedClaim
                );
            }
        }

        match args.next_status {
            OBLIGATION_STATUS_CLAIMABLE_PAYABLE => {
                require!(
                    obligation.status == OBLIGATION_STATUS_RESERVED,
                    OmegaXProtocolError::InvalidObligationStateTransition
                );
                require!(
                    amount <= obligation.reserved_amount,
                    OmegaXProtocolError::AmountExceedsReservedBalance
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

                // PT-2026-04-27-01/02 fix: SPL outflow CPI for linked-claim
                // settlement. When a claim_case is linked AND all five outflow
                // accounts are supplied, transfer the SPL out of the
                // PDA-owned vault to the resolved recipient. When any are
                // absent (e.g. direct sponsor recoveries that pre-date this
                // surface), fall back to accounting-only — operators using
                // those flows must adapt to a future direct-recipient path.
                if let Some(claim_case_ref) = ctx.accounts.claim_case.as_deref() {
                    if let (
                        Some(member_pos),
                        Some(mint),
                        Some(vault_ta),
                        Some(recipient_ta),
                        Some(token_prog),
                    ) = (
                        ctx.accounts.member_position.as_ref(),
                        ctx.accounts.asset_mint.as_ref(),
                        ctx.accounts.vault_token_account.as_ref(),
                        ctx.accounts.recipient_token_account.as_ref(),
                        ctx.accounts.token_program.as_ref(),
                    ) {
                        require_keys_eq!(
                            member_pos.key(),
                            claim_case_ref.member_position,
                            OmegaXProtocolError::Unauthorized
                        );
                        let resolved_recipient =
                            resolve_claim_settlement_recipient(claim_case_ref, member_pos);
                        require_keys_eq!(
                            recipient_ta.owner,
                            resolved_recipient,
                            OmegaXProtocolError::Unauthorized
                        );
                        transfer_from_domain_vault(
                            amount,
                            &ctx.accounts.domain_asset_vault,
                            vault_ta,
                            recipient_ta,
                            mint,
                            token_prog,
                        )?;
                    }
                }
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
        obligation.updated_at = now_ts;

        if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
            match args.next_status {
                OBLIGATION_STATUS_SETTLED => {
                    let claim_case_key = claim_case.key();
                    sync_linked_claim_case_after_settlement(
                        claim_case,
                        claim_case_key,
                        obligation,
                        obligation_key,
                        ctx.accounts.health_plan.key(),
                        amount,
                        now_ts,
                    )?
                }
                OBLIGATION_STATUS_CLAIMABLE_PAYABLE | OBLIGATION_STATUS_CANCELED => {
                    let claim_case_key = claim_case.key();
                    sync_linked_claim_case_reserve(
                        claim_case,
                        claim_case_key,
                        obligation,
                        obligation_key,
                        ctx.accounts.health_plan.key(),
                        now_ts,
                    )?
                }
                _ => {}
            }
        }

        emit!(ObligationStatusChangedEvent {
            obligation: obligation.key(),
            funding_line: obligation.funding_line,
            status: obligation.status,
            amount,
        });

        Ok(())
    }

    pub fn release_reserve(ctx: Context<ReleaseReserve>, args: ReleaseReserveArgs) -> Result<()> {
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        let amount = args.amount;
        require_positive_amount(amount)?;
        let now_ts = Clock::get()?.unix_timestamp;
        let obligation = &mut ctx.accounts.obligation;
        let obligation_key = obligation.key();
        require_obligation_reserve_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
            obligation,
        )?;
        require!(
            obligation.status == OBLIGATION_STATUS_RESERVED,
            OmegaXProtocolError::InvalidObligationStateTransition
        );
        require!(
            amount <= obligation.reserved_amount,
            OmegaXProtocolError::AmountExceedsReservedBalance
        );
        validate_treasury_mutation_bindings(
            ctx.accounts.series_reserve_ledger.as_deref(),
            ctx.accounts.pool_class_ledger.as_deref(),
            ctx.accounts.allocation_position.as_deref(),
            ctx.accounts.allocation_ledger.as_deref(),
            obligation,
            ctx.accounts.funding_line.key(),
            ctx.accounts.funding_line.asset_mint,
        )?;

        obligation.reserved_amount = checked_sub(obligation.reserved_amount, amount)?;
        obligation.outstanding_amount = checked_sub(obligation.outstanding_amount, amount)?;
        obligation.status = if obligation.reserved_amount == 0 {
            OBLIGATION_STATUS_CANCELED
        } else {
            OBLIGATION_STATUS_RESERVED
        };
        obligation.updated_at = now_ts;

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

        if let Some(claim_case) = ctx.accounts.claim_case.as_deref_mut() {
            let claim_case_key = claim_case.key();
            sync_linked_claim_case_reserve(
                claim_case,
                claim_case_key,
                obligation,
                obligation_key,
                ctx.accounts.health_plan.key(),
                now_ts,
            )?;
        }

        Ok(())
    }

    pub fn open_claim_case(ctx: Context<OpenClaimCase>, args: OpenClaimCaseArgs) -> Result<()> {
        require_id(&args.claim_id)?;
        require!(
            ctx.accounts.health_plan.pause_flags & PAUSE_FLAG_CLAIM_INTAKE == 0,
            OmegaXProtocolError::ClaimIntakePaused
        );
        require_claim_intake_submitter(
            &ctx.accounts.authority.key(),
            &ctx.accounts.health_plan,
            &ctx.accounts.member_position,
            &args,
        )?;

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
        claim_case.delegate_recipient = ZERO_PUBKEY;
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

    pub fn authorize_claim_recipient(
        ctx: Context<AuthorizeClaimRecipient>,
        args: AuthorizeClaimRecipientArgs,
    ) -> Result<()> {
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        // The Anchor context binds member_position.wallet == authority.key()
        // and claim_case.member_position == member_position.key(), so reaching
        // this body means the member of record signed.
        let claim_case = &mut ctx.accounts.claim_case;
        claim_case.delegate_recipient = args.delegate_recipient;
        claim_case.updated_at = Clock::get()?.unix_timestamp;
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_claim_operator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require!(
            args.reserve_amount <= args.approved_amount,
            OmegaXProtocolError::AmountExceedsApprovedClaim
        );

        let claim_case = &mut ctx.accounts.claim_case;
        let claim_case_key = claim_case.key();
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
            let obligation_key = obligation.key();
            sync_adjudicated_claim_liability(
                claim_case,
                claim_case_key,
                Some((obligation, obligation_key)),
                ctx.accounts.health_plan.key(),
                args.approved_amount,
                args.reserve_amount,
            )?;
        } else {
            sync_adjudicated_claim_liability(
                claim_case,
                claim_case_key,
                None,
                ctx.accounts.health_plan.key(),
                args.approved_amount,
                args.reserve_amount,
            )?;
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_claim_operator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require_direct_claim_case_settlement(&ctx.accounts.claim_case)?;
        require!(
            args.amount <= remaining_claim_amount(&ctx.accounts.claim_case),
            OmegaXProtocolError::AmountExceedsApprovedClaim
        );
        require_positive_amount(args.amount)?;
        validate_direct_claim_settlement_bindings(
            ctx.accounts.series_reserve_ledger.as_deref(),
            ctx.accounts.pool_class_ledger.as_deref(),
            ctx.accounts.allocation_position.as_deref(),
            ctx.accounts.allocation_ledger.as_deref(),
            &ctx.accounts.claim_case,
            ctx.accounts.funding_line.key(),
            ctx.accounts.funding_line.asset_mint,
        )?;

        // PT-2026-04-27-01/02 fix: resolve the SPL recipient before mutating
        // the claim_case (Pubkey is Copy so we capture by value).
        let resolved_recipient = resolve_claim_settlement_recipient(
            &ctx.accounts.claim_case,
            &ctx.accounts.member_position,
        );
        require_keys_eq!(
            ctx.accounts.recipient_token_account.owner,
            resolved_recipient,
            OmegaXProtocolError::Unauthorized
        );

        let amount = args.amount;

        // Phase 1.6 — Compute protocol fee + adjudicator-oracle fee carve-outs.
        // The full `amount` is what the claim is settling against (claim_case.paid_amount
        // increments by amount, funding_line.spent_amount increments by amount, sheets
        // record the full obligation delivery). But only `net_to_recipient = amount -
        // total_fee` physically leaves the vault — fee tokens stay as treasury claims.
        let reserve_domain = ctx.accounts.health_plan.reserve_domain;
        let asset_mint_key = ctx.accounts.funding_line.asset_mint;
        let protocol_fee_bps = ctx.accounts.protocol_governance.protocol_fee_bps;

        let protocol_fee = if let Some(vault) = ctx.accounts.protocol_fee_vault.as_deref() {
            require_keys_eq!(
                vault.reserve_domain,
                reserve_domain,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                asset_mint_key,
                OmegaXProtocolError::FeeVaultMismatch
            );
            fee_share_from_bps(amount, protocol_fee_bps)?
        } else {
            0
        };

        // Adjudicator oracle fee: requires BOTH pool_oracle_fee_vault and
        // pool_oracle_policy to be supplied. The vault fixes the recipient
        // oracle's revshare destination; the policy supplies oracle_fee_bps.
        // PR1 single-attester model: caller credits the adjudicator only;
        // multi-attester revshare is a follow-up.
        let oracle_fee = match (
            ctx.accounts.pool_oracle_fee_vault.as_deref(),
            ctx.accounts.pool_oracle_policy.as_deref(),
        ) {
            (Some(vault), Some(policy)) => {
                require_keys_eq!(
                    vault.asset_mint,
                    asset_mint_key,
                    OmegaXProtocolError::FeeVaultMismatch
                );
                require_keys_eq!(
                    vault.liquidity_pool,
                    policy.liquidity_pool,
                    OmegaXProtocolError::LiquidityPoolMismatch
                );
                fee_share_from_bps(amount, policy.oracle_fee_bps)?
            }
            (None, _) => 0,
            (Some(_), None) => {
                // Vault provided without policy is a configuration error;
                // refuse to silently zero the bps.
                return Err(OmegaXProtocolError::FeeVaultBpsMisconfigured.into());
            }
        };

        let total_fee = checked_add(protocol_fee, oracle_fee)?;
        let net_to_recipient = checked_sub(amount, total_fee)?;

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

        // Book the full obligation settlement. This decrements
        // domain_asset_vault.total_assets by `amount`, but only
        // `net_to_recipient` physically leaves the vault. The fee tokens
        // remain in the SPL token account as treasury claims; we add them
        // back to total_assets immediately below to keep the counter in
        // sync with the physical balance.
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
        if total_fee > 0 {
            ctx.accounts.domain_asset_vault.total_assets =
                checked_add(ctx.accounts.domain_asset_vault.total_assets, total_fee)?;
        }

        // PT-01/02 fix: actually move the SPL tokens. The vault token account
        // is owned by the domain_asset_vault PDA, which signs via seeds.
        // Phase 1.6: outflow is net_to_recipient; fee tokens stay in vault.
        transfer_from_domain_vault(
            net_to_recipient,
            &ctx.accounts.domain_asset_vault,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.recipient_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.token_program,
        )?;

        // Accrue the protocol fee carve-out.
        if protocol_fee > 0 {
            if let Some(vault) = ctx.accounts.protocol_fee_vault.as_deref_mut() {
                let key = vault.key();
                let mint = vault.asset_mint;
                let total = accrue_fee(&mut vault.accrued_fees, protocol_fee)?;
                emit!(FeeAccruedEvent {
                    vault: key,
                    asset_mint: mint,
                    amount: protocol_fee,
                    accrued_total: total,
                });
            }
        }

        // Accrue the adjudicator-oracle fee carve-out.
        if oracle_fee > 0 {
            if let Some(vault) = ctx.accounts.pool_oracle_fee_vault.as_deref_mut() {
                let key = vault.key();
                let mint = vault.asset_mint;
                let total = accrue_fee(&mut vault.accrued_fees, oracle_fee)?;
                emit!(FeeAccruedEvent {
                    vault: key,
                    asset_mint: mint,
                    amount: oracle_fee,
                    accrued_total: total,
                });
            }
        }

        let claim_case_key = ctx.accounts.claim_case.key();
        let intake_status = ctx.accounts.claim_case.intake_status;
        let approved_amount = ctx.accounts.claim_case.approved_amount;
        emit!(ClaimCaseStateChangedEvent {
            claim_case: claim_case_key,
            intake_status,
            approved_amount,
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_positive_amount(args.amount)?;
        require!(
            ctx.accounts.capital_class.pause_flags & PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS == 0,
            OmegaXProtocolError::CapitalSubscriptionsPaused
        );
        transfer_to_domain_vault(
            args.amount,
            &ctx.accounts.owner,
            &ctx.accounts.source_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.token_program,
            &ctx.accounts.domain_asset_vault,
        )?;

        let amount = args.amount;

        // Phase 1.6 — Pool-treasury entry fee. Validate the optional fee vault
        // matches (liquidity_pool, deposit_asset_mint), then compute the fee
        // against capital_class.fee_bps. The full `amount` remains physically
        // locked in the DomainAssetVault; the fee carve-out is removed from
        // the LP-side accounting only (subscription_basis, NAV, default shares).
        // pool.total_value_locked still tracks the full physical balance.
        let pool_key = ctx.accounts.liquidity_pool.key();
        let pool_deposit_mint = ctx.accounts.liquidity_pool.deposit_asset_mint;
        let class_fee_bps = ctx.accounts.capital_class.fee_bps;
        let entry_fee = if let Some(vault) = ctx.accounts.pool_treasury_vault.as_deref() {
            require_keys_eq!(
                vault.liquidity_pool,
                pool_key,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                pool_deposit_mint,
                OmegaXProtocolError::FeeVaultMismatch
            );
            fee_share_from_bps(amount, class_fee_bps)?
        } else {
            require!(
                class_fee_bps == 0,
                OmegaXProtocolError::FeeVaultRequiredForConfiguredFee
            );
            0
        };
        let net_amount = checked_sub(amount, entry_fee)?;

        // Default shares track the LP's net contribution (post-fee). Caller-supplied
        // shares are honored verbatim — caller is responsible for accounting.
        let shares = if args.shares == 0 {
            net_amount
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
        apply_lp_position_deposit(lp_position, net_amount, shares, min_lockup_seconds, now_ts)?;

        let capital_class = &mut ctx.accounts.capital_class;
        capital_class.total_shares = checked_add(capital_class.total_shares, shares)?;
        capital_class.nav_assets = checked_add(capital_class.nav_assets, net_amount)?;

        let pool = &mut ctx.accounts.liquidity_pool;
        pool.total_value_locked = checked_add(pool.total_value_locked, amount)?;

        book_inflow(&mut ctx.accounts.domain_asset_vault.total_assets, amount)?;
        book_inflow_sheet(&mut ctx.accounts.domain_asset_ledger.sheet, amount)?;
        book_inflow_sheet(&mut ctx.accounts.pool_class_ledger.sheet, amount)?;
        ctx.accounts.pool_class_ledger.total_shares =
            checked_add(ctx.accounts.pool_class_ledger.total_shares, shares)?;

        // Accrue the entry fee to the pool-treasury vault. SPL tokens already
        // sit in the DomainAssetVault from the transfer above; this only updates
        // the rail's claim counter. Skipped silently when entry_fee == 0 (either
        // pool_treasury_vault is None or capital_class.fee_bps == 0).
        if entry_fee > 0 {
            if let Some(vault) = ctx.accounts.pool_treasury_vault.as_deref_mut() {
                let vault_key = vault.key();
                let vault_mint = vault.asset_mint;
                let accrued_total = accrue_fee(&mut vault.accrued_fees, entry_fee)?;
                emit!(FeeAccruedEvent {
                    vault: vault_key,
                    asset_mint: vault_mint,
                    amount: entry_fee,
                    accrued_total,
                });
            }
        }

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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_positive_amount(args.shares)?;
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

        let asset_amount = redeemable_assets_for_shares(
            args.shares,
            ctx.accounts.capital_class.total_shares,
            ctx.accounts.capital_class.nav_assets,
        )?;
        ctx.accounts.lp_position.pending_redemption_shares = checked_add(
            ctx.accounts.lp_position.pending_redemption_shares,
            args.shares,
        )?;
        ctx.accounts.lp_position.pending_redemption_assets = checked_add(
            ctx.accounts.lp_position.pending_redemption_assets,
            asset_amount,
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_curator_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;
        require_positive_amount(args.shares)?;
        require!(
            args.shares <= ctx.accounts.lp_position.pending_redemption_shares,
            OmegaXProtocolError::AmountExceedsPendingRedemption
        );

        let asset_amount = redemption_assets_to_process(
            args.shares,
            ctx.accounts.lp_position.pending_redemption_shares,
            ctx.accounts.lp_position.pending_redemption_assets,
        )?;

        // Phase 1.6 — Pool-treasury exit fee. Validate the optional fee vault
        // matches (liquidity_pool, deposit_asset_mint), then compute the carve-out.
        // The full pending request is resolved (LP gives up claim on asset_amount),
        // but only `net_to_lp` physically leaves the vault — the fee carve-out
        // stays in the SPL token account as a treasury claim accrued below.
        let pool_key = ctx.accounts.liquidity_pool.key();
        let pool_deposit_mint = ctx.accounts.liquidity_pool.deposit_asset_mint;
        let class_fee_bps = ctx.accounts.capital_class.fee_bps;
        let exit_fee = if let Some(vault) = ctx.accounts.pool_treasury_vault.as_deref() {
            require_keys_eq!(
                vault.liquidity_pool,
                pool_key,
                OmegaXProtocolError::FeeVaultMismatch
            );
            require_keys_eq!(
                vault.asset_mint,
                pool_deposit_mint,
                OmegaXProtocolError::FeeVaultMismatch
            );
            fee_share_from_bps(asset_amount, class_fee_bps)?
        } else {
            0
        };
        let net_to_lp = checked_sub(asset_amount, exit_fee)?;

        ctx.accounts.lp_position.pending_redemption_shares = checked_sub(
            ctx.accounts.lp_position.pending_redemption_shares,
            args.shares,
        )?;
        ctx.accounts.lp_position.pending_redemption_assets = checked_sub(
            ctx.accounts.lp_position.pending_redemption_assets,
            asset_amount,
        )?;
        ctx.accounts.lp_position.shares =
            checked_sub(ctx.accounts.lp_position.shares, args.shares)?;
        // realized_distributions tracks what the LP actually received (post-fee).
        ctx.accounts.lp_position.realized_distributions =
            checked_add(ctx.accounts.lp_position.realized_distributions, net_to_lp)?;
        ctx.accounts.lp_position.queue_status =
            if ctx.accounts.lp_position.pending_redemption_shares == 0 {
                LP_QUEUE_STATUS_PROCESSED
            } else {
                LP_QUEUE_STATUS_PENDING
            };

        // capital_class: LP claim reduced by the full asset_amount (the LP
        // gives up claim on the entire pending payout; the fee portion is
        // reclassified to treasury, not retained by LPs).
        ctx.accounts.capital_class.total_shares =
            checked_sub(ctx.accounts.capital_class.total_shares, args.shares)?;
        ctx.accounts.capital_class.nav_assets =
            checked_sub(ctx.accounts.capital_class.nav_assets, asset_amount)?;
        ctx.accounts.capital_class.pending_redemptions =
            checked_sub(ctx.accounts.capital_class.pending_redemptions, asset_amount)?;
        // pool: total_value_locked tracks physical lock, decreases only by
        // net_to_lp (fee tokens stay locked as treasury claim).
        ctx.accounts.liquidity_pool.total_value_locked =
            checked_sub(ctx.accounts.liquidity_pool.total_value_locked, net_to_lp)?;
        ctx.accounts.liquidity_pool.total_pending_redemptions = checked_sub(
            ctx.accounts.liquidity_pool.total_pending_redemptions,
            asset_amount,
        )?;

        // Physical vault counter — only net_to_lp leaves the SPL token account.
        ctx.accounts.domain_asset_vault.total_assets =
            checked_sub(ctx.accounts.domain_asset_vault.total_assets, net_to_lp)?;

        // Ledger sheets: track the full pending → settled transition. When fee
        // is taken, the sheet temporarily over-states LP outflow vs physical
        // outflow; treasury accrual reconciles via the accrued_fees counter.
        // TODO: fee-aware ledger semantics in a follow-up.
        settle_pending_redemption(
            &mut ctx.accounts.pool_class_ledger,
            asset_amount,
            args.shares,
        )?;
        settle_pending_redemption_domain(
            &mut ctx.accounts.domain_asset_ledger.sheet,
            asset_amount,
        )?;

        // PT-2026-04-27-01/02 fix: redemption pays the LP position's owner.
        // There is no delegate-recipient pattern for LP redemptions — the
        // owner is the only authorised recipient.
        require_keys_eq!(
            ctx.accounts.recipient_token_account.owner,
            ctx.accounts.lp_position.owner,
            OmegaXProtocolError::Unauthorized
        );
        transfer_from_domain_vault(
            net_to_lp,
            &ctx.accounts.domain_asset_vault,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.recipient_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.token_program,
        )?;

        // Accrue the exit fee to the pool-treasury vault. SPL tokens are still
        // physically in the vault_token_account; only the rail's claim counter
        // changes. Skipped silently when exit_fee == 0.
        if exit_fee > 0 {
            if let Some(vault) = ctx.accounts.pool_treasury_vault.as_deref_mut() {
                let vault_key = vault.key();
                let vault_mint = vault.asset_mint;
                let accrued_total = accrue_fee(&mut vault.accrued_fees, exit_fee)?;
                emit!(FeeAccruedEvent {
                    vault: vault_key,
                    asset_mint: vault_mint,
                    amount: exit_fee,
                    accrued_total,
                });
            }
        }

        Ok(())
    }

    // -------- Phase 1.7 — Fee-vault withdraw instructions --------

    /// Sweep accrued protocol fees (SPL rail) to a recipient ATA.
    /// Authority: governance only. Fees physically reside in the matching
    /// DomainAssetVault.vault_token_account; the CPI is PDA-signed via
    /// transfer_from_domain_vault.
    pub fn withdraw_protocol_fee_spl(
        ctx: Context<WithdrawProtocolFeeSpl>,
        args: WithdrawArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;
        let new_withdrawn = require_fee_vault_balance(
            ctx.accounts.protocol_fee_vault.accrued_fees,
            ctx.accounts.protocol_fee_vault.withdrawn_fees,
            args.amount,
        )?;

        transfer_from_domain_vault(
            args.amount,
            &ctx.accounts.domain_asset_vault,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.recipient_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.token_program,
        )?;

        let vault = &mut ctx.accounts.protocol_fee_vault;
        vault.withdrawn_fees = new_withdrawn;
        emit!(FeeWithdrawnEvent {
            vault: vault.key(),
            asset_mint: vault.asset_mint,
            amount: args.amount,
            recipient: ctx.accounts.recipient_token_account.key(),
            withdrawn_total: new_withdrawn,
        });
        Ok(())
    }

    /// Sweep accrued protocol fees (SOL rail) to a recipient system account.
    /// Authority: governance only. Lamports come straight off the fee-vault
    /// PDA; rent-exempt minimum is preserved.
    pub fn withdraw_protocol_fee_sol(
        ctx: Context<WithdrawProtocolFeeSol>,
        args: WithdrawArgs,
    ) -> Result<()> {
        require_governance(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
        )?;
        let new_withdrawn = require_fee_vault_balance(
            ctx.accounts.protocol_fee_vault.accrued_fees,
            ctx.accounts.protocol_fee_vault.withdrawn_fees,
            args.amount,
        )?;

        let rent = Rent::get()?;
        let vault_ai = ctx.accounts.protocol_fee_vault.to_account_info();
        let recipient_ai = ctx.accounts.recipient.to_account_info();
        let vault_data_len = vault_ai.data_len();
        transfer_lamports_from_fee_vault(
            &vault_ai,
            &recipient_ai,
            args.amount,
            &rent,
            vault_data_len,
        )?;

        let vault = &mut ctx.accounts.protocol_fee_vault;
        vault.withdrawn_fees = new_withdrawn;
        emit!(FeeWithdrawnEvent {
            vault: vault.key(),
            asset_mint: vault.asset_mint,
            amount: args.amount,
            recipient: ctx.accounts.recipient.key(),
            withdrawn_total: new_withdrawn,
        });
        Ok(())
    }

    /// Sweep accrued pool-treasury fees (SPL rail).
    /// Authority: pool curator OR governance.
    pub fn withdraw_pool_treasury_spl(
        ctx: Context<WithdrawPoolTreasurySpl>,
        args: WithdrawArgs,
    ) -> Result<()> {
        require_curator_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;
        let new_withdrawn = require_fee_vault_balance(
            ctx.accounts.pool_treasury_vault.accrued_fees,
            ctx.accounts.pool_treasury_vault.withdrawn_fees,
            args.amount,
        )?;

        transfer_from_domain_vault(
            args.amount,
            &ctx.accounts.domain_asset_vault,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.recipient_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.token_program,
        )?;

        let vault = &mut ctx.accounts.pool_treasury_vault;
        vault.withdrawn_fees = new_withdrawn;
        emit!(FeeWithdrawnEvent {
            vault: vault.key(),
            asset_mint: vault.asset_mint,
            amount: args.amount,
            recipient: ctx.accounts.recipient_token_account.key(),
            withdrawn_total: new_withdrawn,
        });
        Ok(())
    }

    /// Sweep accrued pool-treasury fees (SOL rail).
    /// Authority: pool curator OR governance.
    pub fn withdraw_pool_treasury_sol(
        ctx: Context<WithdrawPoolTreasurySol>,
        args: WithdrawArgs,
    ) -> Result<()> {
        require_curator_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;
        let new_withdrawn = require_fee_vault_balance(
            ctx.accounts.pool_treasury_vault.accrued_fees,
            ctx.accounts.pool_treasury_vault.withdrawn_fees,
            args.amount,
        )?;

        let rent = Rent::get()?;
        let vault_ai = ctx.accounts.pool_treasury_vault.to_account_info();
        let recipient_ai = ctx.accounts.recipient.to_account_info();
        let vault_data_len = vault_ai.data_len();
        transfer_lamports_from_fee_vault(
            &vault_ai,
            &recipient_ai,
            args.amount,
            &rent,
            vault_data_len,
        )?;

        let vault = &mut ctx.accounts.pool_treasury_vault;
        vault.withdrawn_fees = new_withdrawn;
        emit!(FeeWithdrawnEvent {
            vault: vault.key(),
            asset_mint: vault.asset_mint,
            amount: args.amount,
            recipient: ctx.accounts.recipient.key(),
            withdrawn_total: new_withdrawn,
        });
        Ok(())
    }

    /// Sweep accrued pool-oracle fees (SPL rail) to a recipient ATA.
    /// Authority: registered oracle wallet OR oracle profile admin OR governance.
    pub fn withdraw_pool_oracle_fee_spl(
        ctx: Context<WithdrawPoolOracleFeeSpl>,
        args: WithdrawArgs,
    ) -> Result<()> {
        require_oracle_profile_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.oracle_profile,
        )?;
        let new_withdrawn = require_fee_vault_balance(
            ctx.accounts.pool_oracle_fee_vault.accrued_fees,
            ctx.accounts.pool_oracle_fee_vault.withdrawn_fees,
            args.amount,
        )?;

        transfer_from_domain_vault(
            args.amount,
            &ctx.accounts.domain_asset_vault,
            &ctx.accounts.vault_token_account,
            &ctx.accounts.recipient_token_account,
            &ctx.accounts.asset_mint,
            &ctx.accounts.token_program,
        )?;

        let vault = &mut ctx.accounts.pool_oracle_fee_vault;
        vault.withdrawn_fees = new_withdrawn;
        emit!(FeeWithdrawnEvent {
            vault: vault.key(),
            asset_mint: vault.asset_mint,
            amount: args.amount,
            recipient: ctx.accounts.recipient_token_account.key(),
            withdrawn_total: new_withdrawn,
        });
        Ok(())
    }

    /// Sweep accrued pool-oracle fees (SOL rail) to a recipient system account.
    /// Authority: registered oracle wallet OR oracle profile admin OR governance.
    pub fn withdraw_pool_oracle_fee_sol(
        ctx: Context<WithdrawPoolOracleFeeSol>,
        args: WithdrawArgs,
    ) -> Result<()> {
        require_oracle_profile_control(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.oracle_profile,
        )?;
        let new_withdrawn = require_fee_vault_balance(
            ctx.accounts.pool_oracle_fee_vault.accrued_fees,
            ctx.accounts.pool_oracle_fee_vault.withdrawn_fees,
            args.amount,
        )?;

        let rent = Rent::get()?;
        let vault_ai = ctx.accounts.pool_oracle_fee_vault.to_account_info();
        let recipient_ai = ctx.accounts.recipient.to_account_info();
        let vault_data_len = vault_ai.data_len();
        transfer_lamports_from_fee_vault(
            &vault_ai,
            &recipient_ai,
            args.amount,
            &rent,
            vault_data_len,
        )?;

        let vault = &mut ctx.accounts.pool_oracle_fee_vault;
        vault.withdrawn_fees = new_withdrawn;
        emit!(FeeWithdrawnEvent {
            vault: vault.key(),
            asset_mint: vault.asset_mint,
            amount: args.amount,
            recipient: ctx.accounts.recipient.key(),
            withdrawn_total: new_withdrawn,
        });
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_allocator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let amount = args.amount;
        require_positive_amount(amount)?;
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_allocator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.liquidity_pool,
        )?;

        let amount = args.amount;
        require_positive_amount(amount)?;
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
        require_protocol_not_paused(&ctx.accounts.protocol_governance)?;
        require_claim_operator(
            &ctx.accounts.authority.key(),
            &ctx.accounts.protocol_governance,
            &ctx.accounts.health_plan,
        )?;
        require_positive_amount(args.amount)?;
        validate_impairment_bindings(
            ctx.accounts.series_reserve_ledger.as_deref(),
            ctx.accounts.pool_class_ledger.as_deref(),
            ctx.accounts.allocation_position.as_deref(),
            ctx.accounts.allocation_ledger.as_deref(),
            ctx.accounts.obligation.as_deref(),
            ctx.accounts.funding_line.key(),
            &ctx.accounts.funding_line,
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

    pub fn register_oracle(ctx: Context<RegisterOracle>, args: RegisterOracleArgs) -> Result<()> {
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

    pub fn claim_oracle(ctx: Context<ClaimOracle>) -> Result<()> {
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

    pub fn update_oracle_profile(
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

    pub fn set_pool_oracle(ctx: Context<SetPoolOracle>, args: SetPoolOracleArgs) -> Result<()> {
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

    pub fn set_pool_oracle_permissions(
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

    pub fn set_pool_oracle_policy(
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
            args.oracle_fee_bps <= 10_000,
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

    pub fn register_outcome_schema(
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

    pub fn verify_outcome_schema(
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

    pub fn backfill_schema_dependency_ledger(
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

    pub fn close_outcome_schema(ctx: Context<CloseOutcomeSchema>) -> Result<()> {
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

    pub fn attest_claim_case(
        ctx: Context<AttestClaimCase>,
        args: AttestClaimCaseArgs,
    ) -> Result<()> {
        require_valid_attestation_decision(args.decision)?;
        require!(
            !is_zero_hash(&args.schema_key_hash),
            OmegaXProtocolError::ClaimAttestationSchemaRequired
        );

        let now_ts = Clock::get()?.unix_timestamp;
        let oracle_profile = &ctx.accounts.oracle_profile;
        let claim_case = &ctx.accounts.claim_case;
        let outcome_schema = &ctx.accounts.outcome_schema;

        require!(
            oracle_profile_supports_schema(oracle_profile, outcome_schema.schema_key_hash),
            OmegaXProtocolError::ClaimAttestationSchemaUnsupported
        );

        let attestation = &mut ctx.accounts.claim_attestation;
        attestation.oracle = oracle_profile.oracle;
        attestation.oracle_profile = oracle_profile.key();
        attestation.claim_case = claim_case.key();
        attestation.health_plan = claim_case.health_plan;
        attestation.policy_series = claim_case.policy_series;
        attestation.decision = args.decision;
        attestation.attestation_hash = args.attestation_hash;
        attestation.attestation_ref_hash = args.attestation_ref_hash;
        attestation.schema_key_hash = outcome_schema.schema_key_hash;
        attestation.created_at_ts = now_ts;
        attestation.updated_at_ts = now_ts;
        attestation.bump = ctx.bumps.claim_attestation;

        emit!(ClaimCaseAttestedEvent {
            claim_attestation: attestation.key(),
            claim_case: claim_case.key(),
            oracle_profile: oracle_profile.key(),
            oracle: oracle_profile.oracle,
            decision: attestation.decision,
            attestation_hash: attestation.attestation_hash,
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
pub struct RotateProtocolGovernanceAuthority<'info> {
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
    // PT-2026-04-27-01/02 fix: vault token account is now PDA-owned and
    // initialized inline. SPL transfers out of this account in
    // settlement / redemption / fee-withdrawal handlers will be signed by the
    // domain_asset_vault PDA via transfer_from_domain_vault (see lib.rs:5463
    // region). Operators no longer pre-create the token account externally.
    #[account(
        constraint = asset_mint.key() == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        seeds = [SEED_DOMAIN_ASSET_VAULT_TOKEN, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump,
        token::mint = asset_mint,
        token::authority = domain_asset_vault,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

// Phase 1.6 — Fee-vault initialization. Three governance-init instructions
// bind the existing `ProtocolFeeVault` / `PoolTreasuryVault` / `PoolOracleFeeVault`
// account types (declared at the bottom of this file) to a specific rail
// scope and asset mint. Withdrawals are gated by per-rail authority in PR2.
//
// SOL rail: `args.asset_mint == NATIVE_SOL_MINT`. The fee-vault PDA stores
// lamports directly (no DomainAssetVault required).
//
// SPL rail: a matching `DomainAssetVault` MUST exist for the (scope, mint)
// pair so accrued fees can be paid out via PDA-signed `transfer_from_domain_vault`.

#[derive(Accounts)]
#[instruction(args: InitProtocolFeeVaultArgs)]
pub struct InitProtocolFeeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Account<'info, ReserveDomain>,
    /// Optional anchor to the SPL-rail DomainAssetVault. Required when
    /// `args.asset_mint != NATIVE_SOL_MINT`; absent for SOL-rail vaults.
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolFeeVault::INIT_SPACE,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), args.asset_mint.as_ref()],
        bump,
    )]
    pub protocol_fee_vault: Account<'info, ProtocolFeeVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: InitPoolTreasuryVaultArgs)]
pub struct InitPoolTreasuryVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    /// Required for SPL rails. Must match (liquidity_pool.reserve_domain, args.asset_mint).
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolTreasuryVault::INIT_SPACE,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), args.asset_mint.as_ref()],
        bump,
    )]
    pub pool_treasury_vault: Account<'info, PoolTreasuryVault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: InitPoolOracleFeeVaultArgs)]
pub struct InitPoolOracleFeeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, args.oracle.as_ref()],
        bump = oracle_profile.bump,
        constraint = oracle_profile.oracle == args.oracle @ OmegaXProtocolError::OracleProfileMismatch,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        seeds = [SEED_POOL_ORACLE_APPROVAL, liquidity_pool.key().as_ref(), args.oracle.as_ref()],
        bump = pool_oracle_approval.bump,
        constraint = pool_oracle_approval.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::LiquidityPoolMismatch,
        constraint = pool_oracle_approval.oracle == args.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_approval.active @ OmegaXProtocolError::PoolOracleApprovalRequired,
    )]
    pub pool_oracle_approval: Box<Account<'info, PoolOracleApproval>>,
    /// Required for SPL rails. The oracle fee vault accrues claims against the
    /// same DomainAssetVault used by the pool.
    #[account(
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), args.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
        constraint = domain_asset_vault.reserve_domain == liquidity_pool.reserve_domain @ OmegaXProtocolError::DomainAssetVaultRequired,
        constraint = domain_asset_vault.asset_mint == args.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub domain_asset_vault: Option<Box<Account<'info, DomainAssetVault>>>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolOracleFeeVault::INIT_SPACE,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), args.oracle.as_ref(), args.asset_mint.as_ref()],
        bump,
    )]
    pub pool_oracle_fee_vault: Account<'info, PoolOracleFeeVault>,
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
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RecordPremiumPayment<'info> {
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
    /// Phase 1.6 — optional protocol fee vault for accrual at premium time.
    /// When supplied, must match (health_plan.reserve_domain, funding_line.asset_mint).
    /// Validated at runtime; absent means premium accrual is skipped (backward compat).
    #[account(mut)]
    pub protocol_fee_vault: Option<Box<Account<'info, ProtocolFeeVault>>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
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
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
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
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
    // PT-2026-04-27-01/02 fix: optional outflow accounts. When all five are
    // provided AND a linked claim_case is present AND next_status is SETTLED,
    // the handler resolves recipient = claim_case.delegate_recipient if
    // non-zero else member.wallet, asserts recipient_token_account.owner ==
    // resolved, and transfers SPL via the domain_asset_vault PDA. When any
    // are absent (e.g. direct sponsor recoveries with no linked claim), the
    // handler falls back to accounting-only behavior to preserve existing
    // operator flows.
    pub member_position: Option<Box<Account<'info, MemberPosition>>>,
    pub asset_mint: Option<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub vault_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub recipient_token_account: Option<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Option<Interface<'info, TokenInterface>>,
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
    #[account(mut, seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), claim_case.claim_id.as_bytes()], bump = claim_case.bump)]
    pub claim_case: Option<Box<Account<'info, ClaimCase>>>,
}

#[derive(Accounts)]
#[instruction(args: OpenClaimCaseArgs)]
pub struct OpenClaimCase<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_HEALTH_PLAN, health_plan.reserve_domain.as_ref(), health_plan.health_plan_id.as_bytes()], bump = health_plan.bump)]
    pub health_plan: Box<Account<'info, HealthPlan>>,
    #[account(
        seeds = [SEED_MEMBER_POSITION, health_plan.key().as_ref(), member_position.wallet.as_ref(), member_position.policy_series.as_ref()],
        bump = member_position.bump,
        constraint = member_position.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = member_position.policy_series == args.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = member_position.active @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.eligibility_status == ELIGIBILITY_ELIGIBLE @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[account(
        seeds = [SEED_FUNDING_LINE, health_plan.key().as_ref(), funding_line.line_id.as_bytes()],
        bump = funding_line.bump,
        constraint = funding_line.health_plan == health_plan.key() @ OmegaXProtocolError::HealthPlanMismatch,
        constraint = funding_line.policy_series == args.policy_series @ OmegaXProtocolError::PolicySeriesMismatch,
        constraint = funding_line.status == FUNDING_LINE_STATUS_OPEN @ OmegaXProtocolError::FundingLineMismatch,
    )]
    pub funding_line: Box<Account<'info, FundingLine>>,
    #[account(
        init,
        payer = authority,
        space = 8 + ClaimCase::INIT_SPACE,
        seeds = [SEED_CLAIM_CASE, health_plan.key().as_ref(), args.claim_id.as_bytes()],
        bump
    )]
    pub claim_case: Box<Account<'info, ClaimCase>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthorizeClaimRecipient<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
    #[account(
        seeds = [
            SEED_MEMBER_POSITION,
            member_position.health_plan.as_ref(),
            member_position.wallet.as_ref(),
            member_position.policy_series.as_ref(),
        ],
        bump = member_position.bump,
        constraint = member_position.wallet == authority.key() @ OmegaXProtocolError::Unauthorized,
        constraint = member_position.active @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[account(
        mut,
        seeds = [SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id.as_bytes()],
        bump = claim_case.bump,
        constraint = claim_case.member_position == member_position.key() @ OmegaXProtocolError::Unauthorized,
    )]
    pub claim_case: Box<Account<'info, ClaimCase>>,
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
#[instruction(args: AttestClaimCaseArgs)]
pub struct AttestClaimCase<'info> {
    #[account(mut)]
    pub oracle: Signer<'info>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
        constraint = oracle_profile.oracle == oracle.key() @ OmegaXProtocolError::Unauthorized,
        constraint = oracle_profile.active @ OmegaXProtocolError::OracleProfileInactive,
        constraint = oracle_profile.claimed @ OmegaXProtocolError::OracleProfileUnclaimed,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        seeds = [SEED_CLAIM_CASE, claim_case.health_plan.as_ref(), claim_case.claim_id.as_bytes()],
        bump = claim_case.bump,
    )]
    pub claim_case: Box<Account<'info, ClaimCase>>,
    #[account(
        seeds = [SEED_OUTCOME_SCHEMA, args.schema_key_hash.as_ref()],
        bump = outcome_schema.bump,
    )]
    pub outcome_schema: Box<Account<'info, OutcomeSchema>>,
    #[account(
        init,
        payer = oracle,
        space = 8 + ClaimAttestation::INIT_SPACE,
        seeds = [SEED_CLAIM_ATTESTATION, claim_case.key().as_ref(), oracle.key().as_ref()],
        bump,
    )]
    pub claim_attestation: Box<Account<'info, ClaimAttestation>>,
    pub system_program: Program<'info, System>,
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
    /// Phase 1.6 — optional protocol fee vault for claim-settlement accrual.
    /// When supplied, must match (health_plan.reserve_domain, funding_line.asset_mint).
    /// Validated at runtime; absent means protocol-fee accrual is skipped (backward compat).
    #[account(mut)]
    pub protocol_fee_vault: Option<Box<Account<'info, ProtocolFeeVault>>>,
    /// Phase 1.6 — optional pool-oracle fee vault for adjudicator revshare.
    /// When supplied alongside `pool_oracle_policy`, the bps from policy is
    /// applied to the gross amount and credited to the supplied oracle vault.
    /// Asset mint must match funding_line.asset_mint; pool ref must match
    /// pool_oracle_policy.liquidity_pool. Single-attester scope: callers
    /// credit the adjudicator (not all M attesters) — multi-attester revshare
    /// is a follow-up beyond PR1 (documented in plan).
    #[account(mut)]
    pub pool_oracle_fee_vault: Option<Box<Account<'info, PoolOracleFeeVault>>>,
    /// Phase 1.6 — pairs with pool_oracle_fee_vault. The handler reads
    /// `oracle_fee_bps` from policy. Required when pool_oracle_fee_vault is Some;
    /// ignored otherwise. Validated at runtime.
    pub pool_oracle_policy: Option<Box<Account<'info, PoolOraclePolicy>>>,
    // PT-2026-04-27-01/02 fix: outflow CPI accounts. The handler resolves the
    // settlement recipient as `claim_case.delegate_recipient` if non-zero,
    // else `member_position.wallet`, and asserts
    // `recipient_token_account.owner` equals that key before transferring SPL
    // out of the PDA-owned vault token account.
    #[account(
        constraint = member_position.key() == claim_case.member_position @ OmegaXProtocolError::Unauthorized,
    )]
    pub member_position: Box<Account<'info, MemberPosition>>,
    #[account(
        constraint = asset_mint.key() == claim_case.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
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
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + LPPosition::INIT_SPACE,
        seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub lp_position: Box<Account<'info, LPPosition>>,
    /// Phase 1.6 — optional pool-treasury vault for entry-fee accrual.
    /// When supplied, must match (liquidity_pool, deposit_asset_mint).
    /// Validated at runtime; absent means entry-fee accrual is skipped (backward compat).
    #[account(mut)]
    pub pool_treasury_vault: Option<Box<Account<'info, PoolTreasuryVault>>>,
    #[account(mut)]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestRedemption<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Account<'info, ProtocolGovernance>,
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
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_vault.bump)]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(mut, seeds = [SEED_DOMAIN_ASSET_LEDGER, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = domain_asset_ledger.bump)]
    pub domain_asset_ledger: Box<Account<'info, DomainAssetLedger>>,
    #[account(mut, seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()], bump = liquidity_pool.bump)]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(mut, seeds = [SEED_CAPITAL_CLASS, liquidity_pool.key().as_ref(), capital_class.class_id.as_bytes()], bump = capital_class.bump)]
    pub capital_class: Box<Account<'info, CapitalClass>>,
    #[account(mut, seeds = [SEED_POOL_CLASS_LEDGER, capital_class.key().as_ref(), liquidity_pool.deposit_asset_mint.as_ref()], bump = pool_class_ledger.bump)]
    pub pool_class_ledger: Box<Account<'info, PoolClassLedger>>,
    #[account(mut, seeds = [SEED_LP_POSITION, capital_class.key().as_ref(), lp_position.owner.as_ref()], bump = lp_position.bump)]
    pub lp_position: Box<Account<'info, LPPosition>>,
    /// Phase 1.6 — optional pool-treasury vault for exit-fee accrual.
    /// When supplied, must match (liquidity_pool, deposit_asset_mint).
    /// Validated at runtime; absent means exit-fee accrual is skipped (backward compat).
    #[account(mut)]
    pub pool_treasury_vault: Option<Box<Account<'info, PoolTreasuryVault>>>,
    // PT-2026-04-27-01/02 fix: outflow CPI accounts. Recipient must be the LP
    // position's owner — there is no delegate-recipient pattern for redemptions.
    #[account(
        constraint = asset_mint.key() == liquidity_pool.deposit_asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

// Phase 1.7 — Fee-vault withdrawal account structs. Six instructions
// (SOL + SPL × 3 rails) move accrued fee balances out to a recipient
// authorized by the per-rail authority.
//
// Rail authority model:
//   - Protocol fee:        governance authority only (require_governance)
//   - Pool treasury:       pool curator OR governance (require_curator_control)
//   - Pool oracle fee:     oracle wallet OR oracle admin OR governance
//                          (require_oracle_profile_control)
//
// Custody model:
//   - SPL: tokens reside in DomainAssetVault.vault_token_account; CPI is
//          PDA-signed via transfer_from_domain_vault (existing helper).
//   - SOL: lamports reside on the fee-vault PDA itself; transfer_lamports_from_fee_vault
//          mutates lamports directly while preserving rent-exempt minimum.

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSpl<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Box<Account<'info, ReserveDomain>>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(
        constraint = asset_mint.key() == protocol_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawProtocolFeeSol<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(seeds = [SEED_RESERVE_DOMAIN, reserve_domain.domain_id.as_bytes()], bump = reserve_domain.bump)]
    pub reserve_domain: Box<Account<'info, ReserveDomain>>,
    #[account(
        mut,
        seeds = [SEED_PROTOCOL_FEE_VAULT, reserve_domain.key().as_ref(), protocol_fee_vault.asset_mint.as_ref()],
        bump = protocol_fee_vault.bump,
        constraint = protocol_fee_vault.reserve_domain == reserve_domain.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = protocol_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub protocol_fee_vault: Box<Account<'info, ProtocolFeeVault>>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySpl<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(
        constraint = asset_mint.key() == pool_treasury_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawPoolTreasurySol<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        mut,
        seeds = [SEED_POOL_TREASURY_VAULT, liquidity_pool.key().as_ref(), pool_treasury_vault.asset_mint.as_ref()],
        bump = pool_treasury_vault.bump,
        constraint = pool_treasury_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_treasury_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSpl<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = pool_oracle_fee_vault.bump,
        constraint = pool_oracle_fee_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint != NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: Box<Account<'info, PoolOracleFeeVault>>,
    #[account(
        mut,
        seeds = [SEED_DOMAIN_ASSET_VAULT, liquidity_pool.reserve_domain.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = domain_asset_vault.bump,
    )]
    pub domain_asset_vault: Box<Account<'info, DomainAssetVault>>,
    #[account(
        constraint = asset_mint.key() == pool_oracle_fee_vault.asset_mint @ OmegaXProtocolError::AssetMintMismatch,
    )]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        constraint = vault_token_account.key() == domain_asset_vault.vault_token_account @ OmegaXProtocolError::VaultTokenAccountMismatch,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawPoolOracleFeeSol<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [SEED_PROTOCOL_GOVERNANCE], bump = protocol_governance.bump)]
    pub protocol_governance: Box<Account<'info, ProtocolGovernance>>,
    #[account(
        seeds = [SEED_LIQUIDITY_POOL, liquidity_pool.reserve_domain.as_ref(), liquidity_pool.pool_id.as_bytes()],
        bump = liquidity_pool.bump,
    )]
    pub liquidity_pool: Box<Account<'info, LiquidityPool>>,
    #[account(
        seeds = [SEED_ORACLE_PROFILE, oracle_profile.oracle.as_ref()],
        bump = oracle_profile.bump,
    )]
    pub oracle_profile: Box<Account<'info, OracleProfile>>,
    #[account(
        mut,
        seeds = [SEED_POOL_ORACLE_FEE_VAULT, liquidity_pool.key().as_ref(), pool_oracle_fee_vault.oracle.as_ref(), pool_oracle_fee_vault.asset_mint.as_ref()],
        bump = pool_oracle_fee_vault.bump,
        constraint = pool_oracle_fee_vault.liquidity_pool == liquidity_pool.key() @ OmegaXProtocolError::FeeVaultMismatch,
        constraint = pool_oracle_fee_vault.oracle == oracle_profile.oracle @ OmegaXProtocolError::OracleProfileMismatch,
        constraint = pool_oracle_fee_vault.asset_mint == NATIVE_SOL_MINT @ OmegaXProtocolError::FeeVaultRailMismatch,
    )]
    pub pool_oracle_fee_vault: Box<Account<'info, PoolOracleFeeVault>>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
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

// Fee accounting account types. SPL tokens for fees physically reside in the
// matching DomainAssetVault.vault_token_account; these accounts track each
// rail's claim against that pool. Withdrawals decrement `withdrawn_fees` and
// transfer SPL out of DomainAssetVault via PDA-signed CPI.

#[account]
#[derive(InitSpace)]
pub struct ProtocolFeeVault {
    pub reserve_domain: Pubkey,
    pub asset_mint: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolTreasuryVault {
    pub liquidity_pool: Pubkey,
    pub asset_mint: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOracleFeeVault {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub asset_mint: Pubkey,
    pub accrued_fees: u64,
    pub withdrawn_fees: u64,
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
    // PT-2026-04-27-04 design: when settlement transfers SPL out, the recipient
    // is `delegate_recipient` if non-zero, else `member_position.wallet`. The
    // `claimant` field above is informational metadata constrained to equal
    // `member_position.wallet` at intake (see require_claim_intake_submitter);
    // routing is exclusively controlled here, set by the member via
    // `authorize_claim_recipient`. ZERO_PUBKEY means "pay member.wallet".
    pub delegate_recipient: Pubkey,
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
    pub pending_redemption_assets: u64,
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

#[account]
#[derive(InitSpace)]
pub struct OracleProfile {
    pub oracle: Pubkey,
    pub admin: Pubkey,
    pub oracle_type: u8,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_LONG_NAME_LEN)]
    pub legal_name: String,
    #[max_len(MAX_URI_LEN)]
    pub website_url: String,
    #[max_len(MAX_URI_LEN)]
    pub app_url: String,
    #[max_len(MAX_URI_LEN)]
    pub logo_uri: String,
    #[max_len(MAX_URI_LEN)]
    pub webhook_url: String,
    pub supported_schema_count: u8,
    pub supported_schema_key_hashes: [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS],
    pub active: bool,
    pub claimed: bool,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOracleApproval {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub active: bool,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOraclePolicy {
    pub liquidity_pool: Pubkey,
    pub quorum_m: u8,
    pub quorum_n: u8,
    pub require_verified_schema: bool,
    pub oracle_fee_bps: u16,
    pub allow_delegate_claim: bool,
    pub challenge_window_secs: u32,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PoolOraclePermissionSet {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub permissions: u32,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimAttestation {
    pub oracle: Pubkey,
    pub oracle_profile: Pubkey,
    pub claim_case: Pubkey,
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub decision: u8,
    pub attestation_hash: [u8; 32],
    pub attestation_ref_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OutcomeSchema {
    pub publisher: Pubkey,
    pub schema_key_hash: [u8; 32],
    #[max_len(MAX_SCHEMA_KEY_LEN)]
    pub schema_key: String,
    pub version: u16,
    pub schema_hash: [u8; 32],
    pub schema_family: u8,
    pub visibility: u8,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
    pub verified: bool,
    pub created_at_ts: i64,
    pub updated_at_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SchemaDependencyLedger {
    pub schema_key_hash: [u8; 32],
    #[max_len(MAX_SCHEMA_DEPENDENCY_RULES)]
    pub pool_rule_addresses: Vec<Pubkey>,
    pub updated_at_ts: i64,
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
pub struct RotateProtocolGovernanceAuthorityArgs {
    pub new_governance_authority: Pubkey,
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
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct InitProtocolFeeVaultArgs {
    /// SPL mint for the fee rail. Pass `NATIVE_SOL_MINT` to bind a SOL-rail vault.
    pub asset_mint: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct InitPoolTreasuryVaultArgs {
    /// Asset mint must equal `liquidity_pool.deposit_asset_mint` for SPL pools, or
    /// `NATIVE_SOL_MINT` for the SOL rail.
    pub asset_mint: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct InitPoolOracleFeeVaultArgs {
    /// Oracle wallet whose fee vault is being initialized. Must match
    /// `oracle_profile.oracle` and have an active `PoolOracleApproval` on the pool.
    pub oracle: Pubkey,
    /// Asset mint of the rail (use `NATIVE_SOL_MINT` for SOL).
    pub asset_mint: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct WithdrawArgs {
    /// Amount to withdraw, in the rail's native units (lamports for SOL,
    /// SPL base units for SPL). Must satisfy
    /// `withdrawn_fees + amount <= accrued_fees` on the rail's fee vault,
    /// and must not breach rent-exemption on the SOL rail.
    pub amount: u64,
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
pub struct AuthorizeClaimRecipientArgs {
    pub delegate_recipient: Pubkey,
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
pub struct AttestClaimCaseArgs {
    pub decision: u8,
    pub attestation_hash: [u8; 32],
    pub attestation_ref_hash: [u8; 32],
    pub schema_key_hash: [u8; 32],
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
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct ProcessRedemptionQueueArgs {
    pub shares: u64,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RegisterOracleArgs {
    pub oracle: Pubkey,
    pub oracle_type: u8,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_LONG_NAME_LEN)]
    pub legal_name: String,
    #[max_len(MAX_URI_LEN)]
    pub website_url: String,
    #[max_len(MAX_URI_LEN)]
    pub app_url: String,
    #[max_len(MAX_URI_LEN)]
    pub logo_uri: String,
    #[max_len(MAX_URI_LEN)]
    pub webhook_url: String,
    #[max_len(MAX_ORACLE_SUPPORTED_SCHEMAS)]
    pub supported_schema_key_hashes: Vec<[u8; 32]>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct UpdateOracleProfileArgs {
    pub oracle_type: u8,
    #[max_len(MAX_NAME_LEN)]
    pub display_name: String,
    #[max_len(MAX_LONG_NAME_LEN)]
    pub legal_name: String,
    #[max_len(MAX_URI_LEN)]
    pub website_url: String,
    #[max_len(MAX_URI_LEN)]
    pub app_url: String,
    #[max_len(MAX_URI_LEN)]
    pub logo_uri: String,
    #[max_len(MAX_URI_LEN)]
    pub webhook_url: String,
    #[max_len(MAX_ORACLE_SUPPORTED_SCHEMAS)]
    pub supported_schema_key_hashes: Vec<[u8; 32]>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct SetPoolOracleArgs {
    pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct SetPoolOraclePermissionsArgs {
    pub permissions: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct SetPoolOraclePolicyArgs {
    pub quorum_m: u8,
    pub quorum_n: u8,
    pub require_verified_schema: bool,
    pub oracle_fee_bps: u16,
    pub allow_delegate_claim: bool,
    pub challenge_window_secs: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RegisterOutcomeSchemaArgs {
    pub schema_key_hash: [u8; 32],
    #[max_len(MAX_SCHEMA_KEY_LEN)]
    pub schema_key: String,
    pub version: u16,
    pub schema_hash: [u8; 32],
    pub schema_family: u8,
    pub visibility: u8,
    #[max_len(MAX_URI_LEN)]
    pub metadata_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct VerifyOutcomeSchemaArgs {
    pub verified: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct BackfillSchemaDependencyLedgerArgs {
    pub schema_key_hash: [u8; 32],
    #[max_len(MAX_SCHEMA_DEPENDENCY_RULES)]
    pub pool_rule_addresses: Vec<Pubkey>,
}

#[event]
pub struct ProtocolGovernanceInitializedEvent {
    pub governance_authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub emergency_pause: bool,
}

#[event]
pub struct ProtocolGovernanceAuthorityRotatedEvent {
    pub previous_governance_authority: Pubkey,
    pub new_governance_authority: Pubkey,
    pub authority: Pubkey,
    pub audit_nonce: u64,
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
pub struct ClaimCaseAttestedEvent {
    pub claim_attestation: Pubkey,
    pub claim_case: Pubkey,
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub decision: u8,
    pub attestation_hash: [u8; 32],
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

#[event]
pub struct FeeVaultInitializedEvent {
    pub vault: Pubkey,
    pub scope: Pubkey,
    pub asset_mint: Pubkey,
    /// 0 = ProtocolFeeVault, 1 = PoolTreasuryVault, 2 = PoolOracleFeeVault.
    pub rail: u8,
}

#[event]
pub struct FeeAccruedEvent {
    pub vault: Pubkey,
    pub asset_mint: Pubkey,
    pub amount: u64,
    pub accrued_total: u64,
}

#[event]
pub struct FeeWithdrawnEvent {
    pub vault: Pubkey,
    pub asset_mint: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
    pub withdrawn_total: u64,
}

#[event]
pub struct OracleProfileRegisteredEvent {
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub admin: Pubkey,
    pub oracle_type: u8,
    pub claimed: bool,
}

#[event]
pub struct OracleProfileClaimedEvent {
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub admin: Pubkey,
}

#[event]
pub struct OracleProfileUpdatedEvent {
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub oracle_type: u8,
}

#[event]
pub struct PoolOracleApprovalChangedEvent {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub active: bool,
}

#[event]
pub struct PoolOraclePermissionsChangedEvent {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub permissions: u32,
}

#[event]
pub struct PoolOraclePolicyChangedEvent {
    pub liquidity_pool: Pubkey,
    pub authority: Pubkey,
    pub quorum_m: u8,
    pub quorum_n: u8,
    pub oracle_fee_bps: u16,
}

#[event]
pub struct OutcomeSchemaRegisteredEvent {
    pub outcome_schema: Pubkey,
    pub publisher: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub version: u16,
}

#[event]
pub struct OutcomeSchemaStateChangedEvent {
    pub outcome_schema: Pubkey,
    pub governance_authority: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub verified: bool,
}

#[event]
pub struct SchemaDependencyLedgerUpdatedEvent {
    pub schema_dependency_ledger: Pubkey,
    pub governance_authority: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub dependency_count: u16,
}

#[event]
pub struct OutcomeSchemaClosedEvent {
    pub outcome_schema: Pubkey,
    pub governance_authority: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub recipient: Pubkey,
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
    #[msg("Governance authority is invalid")]
    InvalidGovernanceAuthority,
    #[msg("Protocol governance is emergency paused")]
    ProtocolEmergencyPaused,
    #[msg("Reserve domain is inactive")]
    ReserveDomainInactive,
    #[msg("Domain asset vault token account is missing or invalid")]
    VaultTokenAccountInvalid,
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
    #[msg("Source token account owner does not match the signer")]
    TokenAccountOwnerMismatch,
    #[msg("Source and vault token accounts must be different accounts")]
    TokenAccountSelfTransferInvalid,
    #[msg("Vault token account does not match the domain asset vault")]
    VaultTokenAccountMismatch,
    #[msg("Funding line mismatch")]
    FundingLineMismatch,
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
    #[msg("Amount must be greater than zero")]
    AmountMustBePositive,
    #[msg("Claim case linkage mismatch")]
    ClaimCaseLinkMismatch,
    #[msg("Linked claims must settle through the obligation path")]
    LinkedClaimMustSettleThroughObligation,
    #[msg("Amount exceeds available shares")]
    AmountExceedsAvailableShares,
    #[msg("Amount exceeds pending redemption")]
    AmountExceedsPendingRedemption,
    #[msg("Redemption amount cannot be derived from the queued share state")]
    InvalidRedemptionAmount,
    #[msg("Restricted capital class access failed")]
    RestrictedCapitalClass,
    #[msg("Capital class ledger mismatch")]
    CapitalClassMismatch,
    #[msg("LP position with active capital cannot be decredentialed")]
    LPPositionHasActiveCapital,
    #[msg("Capital class lockup is still active")]
    LockupActive,
    #[msg("Allocation cap exceeded")]
    AllocationCapExceeded,
    #[msg("Allocation position mismatch")]
    AllocationPositionMismatch,
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
    #[msg("Bounded string field exceeds the canonical maximum")]
    StringTooLong,
    #[msg("Oracle quorum configuration is invalid")]
    InvalidOracleQuorum,
    #[msg("Too many supported schema hashes were provided for one oracle profile")]
    TooManyOracleSupportedSchemas,
    #[msg("Pool oracle approval is required before permissions can be granted")]
    PoolOracleApprovalRequired,
    #[msg("Oracle profile is inactive")]
    OracleProfileInactive,
    #[msg("Oracle profile has not been claimed by its signing key")]
    OracleProfileUnclaimed,
    #[msg("Claim attestation decision is not a recognized value")]
    InvalidClaimAttestationDecision,
    #[msg("Claim attestation must reference a registered schema key hash")]
    ClaimAttestationSchemaRequired,
    #[msg("Oracle profile does not advertise support for the selected claim-attestation schema")]
    ClaimAttestationSchemaUnsupported,
    #[msg("Too many schema dependency addresses were provided")]
    TooManySchemaDependencies,
    #[msg("Fee vault initialization requires the matching domain asset vault to exist")]
    DomainAssetVaultRequired,
    #[msg("Liquidity pool reference does not match the supplied account")]
    LiquidityPoolMismatch,
    #[msg("Oracle profile reference does not match the supplied account")]
    OracleProfileMismatch,
    #[msg("Fee vault account does not match the expected scope")]
    FeeVaultMismatch,
    #[msg("Fee vault has insufficient accrued balance for this withdrawal")]
    FeeVaultInsufficientBalance,
    #[msg("Fee vault withdrawal would breach the rent-exempt minimum balance")]
    FeeVaultRentExemptionBreach,
    #[msg("Fee vault rail and asset mint disagree (SOL vault used on SPL path or vice versa)")]
    FeeVaultRailMismatch,
    #[msg("Configured class entry fee requires the matching pool treasury fee vault account")]
    FeeVaultRequiredForConfiguredFee,
    #[msg("Fee vault basis-points configuration is out of range")]
    FeeVaultBpsMisconfigured,
}

fn require_id(value: &str) -> Result<()> {
    require!(
        value.len() <= MAX_ID_LEN,
        OmegaXProtocolError::IdentifierTooLong
    );
    Ok(())
}

fn require_bounded_string(value: &str, max_len: usize) -> Result<()> {
    require!(value.len() <= max_len, OmegaXProtocolError::StringTooLong);
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

fn require_protocol_not_paused(governance: &ProtocolGovernance) -> Result<()> {
    require!(
        !governance.emergency_pause,
        OmegaXProtocolError::ProtocolEmergencyPaused
    );
    Ok(())
}

fn require_positive_amount(amount: u64) -> Result<()> {
    require!(amount > 0, OmegaXProtocolError::AmountMustBePositive);
    Ok(())
}

fn rotate_protocol_governance_authority_state(
    governance: &mut ProtocolGovernance,
    new_governance_authority: Pubkey,
) -> Result<Pubkey> {
    require!(
        new_governance_authority != ZERO_PUBKEY,
        OmegaXProtocolError::InvalidGovernanceAuthority
    );

    let previous_governance_authority = governance.governance_authority;
    governance.governance_authority = new_governance_authority;
    governance.audit_nonce = governance.audit_nonce.saturating_add(1);
    Ok(previous_governance_authority)
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

fn require_oracle_profile_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    oracle_profile: &OracleProfile,
) -> Result<()> {
    if *authority == oracle_profile.admin
        || *authority == oracle_profile.oracle
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn validate_oracle_profile_fields(args: &RegisterOracleArgs) -> Result<()> {
    validate_oracle_profile_strings(
        &args.display_name,
        &args.legal_name,
        &args.website_url,
        &args.app_url,
        &args.logo_uri,
        &args.webhook_url,
        &args.supported_schema_key_hashes,
    )
}

fn validate_oracle_profile_strings(
    display_name: &str,
    legal_name: &str,
    website_url: &str,
    app_url: &str,
    logo_uri: &str,
    webhook_url: &str,
    supported_schema_key_hashes: &[[u8; 32]],
) -> Result<()> {
    require_bounded_string(display_name, MAX_NAME_LEN)?;
    require_bounded_string(legal_name, MAX_LONG_NAME_LEN)?;
    require_bounded_string(website_url, MAX_URI_LEN)?;
    require_bounded_string(app_url, MAX_URI_LEN)?;
    require_bounded_string(logo_uri, MAX_URI_LEN)?;
    require_bounded_string(webhook_url, MAX_URI_LEN)?;
    require!(
        supported_schema_key_hashes.len() <= MAX_ORACLE_SUPPORTED_SCHEMAS,
        OmegaXProtocolError::TooManyOracleSupportedSchemas
    );
    Ok(())
}

fn validate_oracle_profile_fields_update(args: &UpdateOracleProfileArgs) -> Result<()> {
    validate_oracle_profile_strings(
        &args.display_name,
        &args.legal_name,
        &args.website_url,
        &args.app_url,
        &args.logo_uri,
        &args.webhook_url,
        &args.supported_schema_key_hashes,
    )
}

fn write_supported_schema_hashes(
    destination: &mut [[u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS],
    values: &[[u8; 32]],
) {
    *destination = [[0u8; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS];
    for (index, value) in values.iter().enumerate() {
        destination[index] = *value;
    }
}

fn validate_outcome_schema_fields(args: &RegisterOutcomeSchemaArgs) -> Result<()> {
    require_bounded_string(&args.schema_key, MAX_SCHEMA_KEY_LEN)?;
    require_bounded_string(&args.metadata_uri, MAX_URI_LEN)?;
    Ok(())
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

fn obligation_has_linked_claim_case(obligation: &Obligation) -> bool {
    obligation.claim_case != ZERO_PUBKEY
}

fn require_linked_claim_reserve_operator(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
) -> Result<()> {
    if *authority == plan.oracle_authority
        || *authority == plan.claims_operator
        || *authority == plan.plan_admin
        || *authority == governance.governance_authority
    {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
}

fn require_linked_claim_settlement_operator(
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

fn require_obligation_reserve_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
    obligation: &Obligation,
) -> Result<()> {
    if obligation_has_linked_claim_case(obligation) {
        require_linked_claim_reserve_operator(authority, governance, plan)
    } else {
        require_plan_control(authority, governance, plan)
    }
}

fn require_obligation_settlement_control(
    authority: &Pubkey,
    governance: &ProtocolGovernance,
    plan: &HealthPlan,
    obligation: &Obligation,
) -> Result<()> {
    if obligation_has_linked_claim_case(obligation) {
        require_linked_claim_settlement_operator(authority, governance, plan)
    } else {
        require_plan_control(authority, governance, plan)
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

// Resolve the SPL recipient for a claim settlement. Routing is exclusively
// controlled by the member-set delegate_recipient field on ClaimCase: if it
// is the ZERO_PUBKEY, payouts go to member_position.wallet. The `claimant`
// field on ClaimCase is informational metadata only — it is constrained at
// intake to equal member_position.wallet (PT-2026-04-27-04 fix).
fn resolve_claim_settlement_recipient(
    claim_case: &ClaimCase,
    member_position: &MemberPosition,
) -> Pubkey {
    if claim_case.delegate_recipient != ZERO_PUBKEY {
        claim_case.delegate_recipient
    } else {
        member_position.wallet
    }
}

fn require_claim_intake_submitter(
    authority: &Pubkey,
    plan: &HealthPlan,
    member_position: &MemberPosition,
    args: &OpenClaimCaseArgs,
) -> Result<()> {
    // Both branches require args.claimant == member_position.wallet so the
    // claimant field cannot be used to divert funds when settlement transfers
    // ship. Recipient routing is handled separately via ClaimCase.delegate_recipient
    // (set by the member via `authorize_claim_recipient`).
    let claimant_is_member = args.claimant == member_position.wallet;
    let member_self_submit = *authority == member_position.wallet && claimant_is_member;
    let operator_submit =
        (*authority == plan.claims_operator || *authority == plan.plan_admin) && claimant_is_member;

    if member_self_submit || operator_submit {
        Ok(())
    } else {
        err!(OmegaXProtocolError::Unauthorized)
    }
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

fn require_valid_attestation_decision(decision: u8) -> Result<()> {
    match decision {
        CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE
        | CLAIM_ATTESTATION_DECISION_SUPPORT_DENY
        | CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW
        | CLAIM_ATTESTATION_DECISION_ABSTAIN => Ok(()),
        _ => err!(OmegaXProtocolError::InvalidClaimAttestationDecision),
    }
}

fn is_zero_hash(value: &[u8; 32]) -> bool {
    *value == [0; 32]
}

fn oracle_profile_supports_schema(
    oracle_profile: &OracleProfile,
    schema_key_hash: [u8; 32],
) -> bool {
    if is_zero_hash(&schema_key_hash) {
        return false;
    }

    let supported_count =
        usize::from(oracle_profile.supported_schema_count).min(MAX_ORACLE_SUPPORTED_SCHEMAS);
    if supported_count == 0 {
        return true;
    }

    oracle_profile
        .supported_schema_key_hashes
        .iter()
        .take(supported_count)
        .any(|supported_hash| *supported_hash == schema_key_hash)
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
        lp_position.pending_redemption_assets = 0;
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
            lp_position.shares == 0
                && lp_position.pending_redemption_shares == 0
                && lp_position.pending_redemption_assets == 0,
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

fn checked_u128_to_u64(value: u128) -> Result<u64> {
    u64::try_from(value).map_err(|_| OmegaXProtocolError::ArithmeticError.into())
}

fn prorata_amount(numerator: u64, denominator: u64, amount: u64) -> Result<u64> {
    require!(
        numerator > 0 && denominator > 0 && numerator <= denominator,
        OmegaXProtocolError::InvalidRedemptionAmount
    );
    let prorata = (amount as u128)
        .checked_mul(numerator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        .checked_div(denominator as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let value = checked_u128_to_u64(prorata)?;
    require!(value > 0, OmegaXProtocolError::InvalidRedemptionAmount);
    Ok(value)
}

fn redeemable_assets_for_shares(shares: u64, total_shares: u64, nav_assets: u64) -> Result<u64> {
    prorata_amount(shares, total_shares, nav_assets)
}

fn redemption_assets_to_process(
    shares: u64,
    pending_redemption_shares: u64,
    pending_redemption_assets: u64,
) -> Result<u64> {
    if shares == pending_redemption_shares {
        require!(
            pending_redemption_assets > 0,
            OmegaXProtocolError::InvalidRedemptionAmount
        );
        Ok(pending_redemption_assets)
    } else {
        prorata_amount(shares, pending_redemption_shares, pending_redemption_assets)
    }
}

fn transfer_to_domain_vault<'info>(
    amount: u64,
    authority: &Signer<'info>,
    source_token_account: &InterfaceAccount<'info, TokenAccount>,
    asset_mint: &InterfaceAccount<'info, Mint>,
    vault_token_account: &InterfaceAccount<'info, TokenAccount>,
    token_program: &Interface<'info, TokenInterface>,
    domain_asset_vault: &DomainAssetVault,
) -> Result<()> {
    require_keys_eq!(
        source_token_account.owner,
        authority.key(),
        OmegaXProtocolError::TokenAccountOwnerMismatch
    );
    require_keys_neq!(
        source_token_account.key(),
        vault_token_account.key(),
        OmegaXProtocolError::TokenAccountSelfTransferInvalid
    );
    require_keys_eq!(
        source_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        asset_mint.key(),
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        vault_token_account.key(),
        domain_asset_vault.vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    require_keys_eq!(
        vault_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );

    let accounts = TransferChecked {
        from: source_token_account.to_account_info(),
        mint: asset_mint.to_account_info(),
        to: vault_token_account.to_account_info(),
        authority: authority.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new(token_program.to_account_info(), accounts),
        amount,
        asset_mint.decimals,
    )
}

// Phase 1.6 — Fee accrual helpers. Inflow handlers (record_premium_payment,
// deposit_into_capital_class, process_redemption_queue, settle_claim_case)
// call `fee_share_from_bps` to compute the carve-out from a user-facing
// amount, then `accrue_fee` to credit the vault's `accrued_fees` counter.
// SPL tokens physically remain in the matching `DomainAssetVault.vault_token_account`;
// the fee-vault account only tracks the rail's claim. SOL fees physically
// reside on the fee-vault PDA itself (lamport math, not SPL CPI).
//
// Floors to zero (Solana convention). Returns 0 when bps == 0 or amount == 0,
// so callers can blindly invoke without conditional skips.
fn fee_share_from_bps(amount: u64, bps: u16) -> Result<u64> {
    if bps == 0 || amount == 0 {
        return Ok(0);
    }
    require!(bps <= 10_000, OmegaXProtocolError::FeeVaultBpsMisconfigured);
    let scaled = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?
        .checked_div(10_000u128)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    let fee = checked_u128_to_u64(scaled)?;
    // Defensive: fee can never exceed amount.
    require!(fee <= amount, OmegaXProtocolError::ArithmeticError);
    Ok(fee)
}

// Credits `amount` to the running accrued counter and returns the new total.
// Callers emit `FeeAccruedEvent` with the returned total. No-op when amount == 0
// (still returns the unchanged total) so callers can blindly invoke after a
// `fee_share_from_bps(...)` that may yield zero.
fn accrue_fee(accrued: &mut u64, amount: u64) -> Result<u64> {
    if amount == 0 {
        return Ok(*accrued);
    }
    let new_total = checked_add(*accrued, amount)?;
    *accrued = new_total;
    Ok(new_total)
}

// Phase 1.7 — Verifies a withdrawal amount fits within the vault's claim.
// `withdrawn + requested <= accrued` must hold; otherwise the rail would
// over-withdraw beyond what's been accrued. Returns the new withdrawn total.
fn require_fee_vault_balance(accrued: u64, withdrawn: u64, requested: u64) -> Result<u64> {
    require_positive_amount(requested)?;
    let new_withdrawn = checked_add(withdrawn, requested)?;
    require!(
        new_withdrawn <= accrued,
        OmegaXProtocolError::FeeVaultInsufficientBalance
    );
    Ok(new_withdrawn)
}

// Phase 1.7 — SOL-rail withdrawal. Mutates the fee-vault PDA's lamports
// directly (SystemProgram::transfer cannot move lamports out of program-owned
// accounts). Rejects withdrawals that would breach the PDA's rent-exempt
// minimum so the account stays alive across operations.
//
// Caller must pass `vault_data_len = vault_account.data_len()` so the
// rent-minimum lookup uses the live account size; passing a stale or
// constructed value would mis-compute the rent floor.
fn transfer_lamports_from_fee_vault<'info>(
    vault_ai: &AccountInfo<'info>,
    recipient_ai: &AccountInfo<'info>,
    amount: u64,
    rent: &Rent,
    vault_data_len: usize,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let rent_minimum = rent.minimum_balance(vault_data_len);
    let vault_lamports = vault_ai.lamports();
    let vault_after = vault_lamports
        .checked_sub(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    require!(
        vault_after >= rent_minimum,
        OmegaXProtocolError::FeeVaultRentExemptionBreach
    );
    let recipient_lamports = recipient_ai.lamports();
    let recipient_after = recipient_lamports
        .checked_add(amount)
        .ok_or(OmegaXProtocolError::ArithmeticError)?;
    **vault_ai.try_borrow_mut_lamports()? = vault_after;
    **recipient_ai.try_borrow_mut_lamports()? = recipient_after;
    Ok(())
}

// PDA-signed outflow helper. Unblocks PT-2026-04-27-01 and PT-2026-04-27-02:
// settlement, redemption, release, and fee-withdrawal handlers will call this
// to actually move SPL tokens out of the program-PDA-owned vault token account.
// Authority on the CPI is the `domain_asset_vault` PDA (post vault-custody
// refactor in section 1.2 of the remediation plan).
//
// Caller note: this helper assumes `vault_token_account.owner` is the
// `domain_asset_vault` PDA. That invariant is established once
// `create_domain_asset_vault` is refactored to init the token account with
// `token::authority = domain_asset_vault`. Without that refactor in place the
// CPI will fail at runtime with TokenOwnerMismatch — by design.
#[allow(dead_code)]
fn transfer_from_domain_vault<'info>(
    amount: u64,
    domain_asset_vault: &Account<'info, DomainAssetVault>,
    vault_token_account: &InterfaceAccount<'info, TokenAccount>,
    recipient_token_account: &InterfaceAccount<'info, TokenAccount>,
    asset_mint: &InterfaceAccount<'info, Mint>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    require_keys_eq!(
        vault_token_account.key(),
        domain_asset_vault.vault_token_account,
        OmegaXProtocolError::VaultTokenAccountMismatch
    );
    require_keys_eq!(
        asset_mint.key(),
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        vault_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_eq!(
        recipient_token_account.mint,
        domain_asset_vault.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require_keys_neq!(
        vault_token_account.key(),
        recipient_token_account.key(),
        OmegaXProtocolError::TokenAccountSelfTransferInvalid
    );

    let reserve_domain = domain_asset_vault.reserve_domain;
    let asset_mint_key = domain_asset_vault.asset_mint;
    let bump = domain_asset_vault.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        SEED_DOMAIN_ASSET_VAULT,
        reserve_domain.as_ref(),
        asset_mint_key.as_ref(),
        &[bump],
    ]];

    let accounts = TransferChecked {
        from: vault_token_account.to_account_info(),
        mint: asset_mint.to_account_info(),
        to: recipient_token_account.to_account_info(),
        authority: domain_asset_vault.to_account_info(),
    };
    token_interface::transfer_checked(
        CpiContext::new_with_signer(token_program.to_account_info(), accounts, signer_seeds),
        amount,
        asset_mint.decimals,
    )
}

fn validate_optional_series_ledger(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    expected_policy_series: Pubkey,
    expected_asset_mint: Pubkey,
) -> Result<()> {
    if let Some(ledger) = series_ledger {
        require!(
            expected_policy_series != ZERO_PUBKEY,
            OmegaXProtocolError::PolicySeriesMissing
        );
        require_keys_eq!(
            ledger.policy_series,
            expected_policy_series,
            OmegaXProtocolError::PolicySeriesMismatch
        );
        require_keys_eq!(
            ledger.asset_mint,
            expected_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
    }
    Ok(())
}

fn validate_optional_pool_class_ledger(
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    expected_capital_class: Pubkey,
    expected_asset_mint: Pubkey,
) -> Result<()> {
    if let Some(ledger) = pool_class_ledger {
        require!(
            expected_capital_class != ZERO_PUBKEY,
            OmegaXProtocolError::CapitalClassMismatch
        );
        require_keys_eq!(
            ledger.capital_class,
            expected_capital_class,
            OmegaXProtocolError::CapitalClassMismatch
        );
        require_keys_eq!(
            ledger.asset_mint,
            expected_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
    }
    Ok(())
}

fn validate_optional_allocation_position(
    allocation_position: Option<&Account<AllocationPosition>>,
    expected_allocation_position: Pubkey,
    expected_funding_line: Pubkey,
) -> Result<()> {
    if let Some(position) = allocation_position {
        require!(
            expected_allocation_position != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            position.key(),
            expected_allocation_position,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            position.funding_line,
            expected_funding_line,
            OmegaXProtocolError::FundingLineMismatch
        );
    }
    Ok(())
}

fn validate_optional_allocation_ledger(
    allocation_ledger: Option<&Account<AllocationLedger>>,
    expected_allocation_position: Pubkey,
    expected_asset_mint: Pubkey,
) -> Result<()> {
    if let Some(ledger) = allocation_ledger {
        require!(
            expected_allocation_position != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            ledger.allocation_position,
            expected_allocation_position,
            OmegaXProtocolError::AllocationPositionMismatch
        );
        require_keys_eq!(
            ledger.asset_mint,
            expected_asset_mint,
            OmegaXProtocolError::AssetMintMismatch
        );
    }
    Ok(())
}

fn validate_treasury_mutation_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    obligation: &Obligation,
    funding_line_key: Pubkey,
    funding_line_asset_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        obligation.funding_line,
        funding_line_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        obligation.asset_mint,
        funding_line_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    validate_optional_series_ledger(
        series_ledger,
        obligation.policy_series,
        obligation.asset_mint,
    )?;
    validate_optional_pool_class_ledger(
        pool_class_ledger,
        obligation.capital_class,
        obligation.asset_mint,
    )?;
    validate_optional_allocation_position(
        allocation_position,
        obligation.allocation_position,
        obligation.funding_line,
    )?;
    validate_optional_allocation_ledger(
        allocation_ledger,
        obligation.allocation_position,
        obligation.asset_mint,
    )
}

fn validate_direct_claim_settlement_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    claim_case: &ClaimCase,
    funding_line_key: Pubkey,
    funding_line_asset_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        claim_case.funding_line,
        funding_line_key,
        OmegaXProtocolError::FundingLineMismatch
    );
    require_keys_eq!(
        claim_case.asset_mint,
        funding_line_asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    validate_optional_series_ledger(
        series_ledger,
        claim_case.policy_series,
        claim_case.asset_mint,
    )?;
    if pool_class_ledger.is_some() || allocation_position.is_some() || allocation_ledger.is_some() {
        return err!(OmegaXProtocolError::AllocationPositionMismatch);
    }
    Ok(())
}

fn validate_impairment_bindings(
    series_ledger: Option<&Account<SeriesReserveLedger>>,
    pool_class_ledger: Option<&Account<PoolClassLedger>>,
    allocation_position: Option<&Account<AllocationPosition>>,
    allocation_ledger: Option<&Account<AllocationLedger>>,
    obligation: Option<&Account<Obligation>>,
    funding_line_key: Pubkey,
    funding_line: &FundingLine,
) -> Result<()> {
    validate_optional_series_ledger(
        series_ledger,
        funding_line.policy_series,
        funding_line.asset_mint,
    )?;

    if let Some(obligation) = obligation {
        return validate_treasury_mutation_bindings(
            series_ledger,
            pool_class_ledger,
            allocation_position,
            allocation_ledger,
            obligation,
            funding_line_key,
            funding_line.asset_mint,
        );
    }

    let allocation_key = allocation_position
        .as_ref()
        .map(|position| position.key())
        .unwrap_or(ZERO_PUBKEY);
    if pool_class_ledger.is_some() || allocation_ledger.is_some() {
        require!(
            allocation_key != ZERO_PUBKEY,
            OmegaXProtocolError::AllocationPositionMismatch
        );
    }
    validate_optional_allocation_position(allocation_position, allocation_key, funding_line_key)?;
    if let (Some(class_ledger), Some(position)) = (pool_class_ledger, allocation_position) {
        validate_optional_pool_class_ledger(
            Some(class_ledger),
            position.capital_class,
            funding_line.asset_mint,
        )?;
    } else if pool_class_ledger.is_some() {
        return err!(OmegaXProtocolError::CapitalClassMismatch);
    }
    validate_optional_allocation_ledger(allocation_ledger, allocation_key, funding_line.asset_mint)
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

fn remaining_claim_amount(claim_case: &ClaimCase) -> u64 {
    claim_case
        .approved_amount
        .saturating_sub(claim_case.paid_amount)
}

fn require_direct_claim_case_settlement(claim_case: &ClaimCase) -> Result<()> {
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY,
        OmegaXProtocolError::LinkedClaimMustSettleThroughObligation
    );
    Ok(())
}

fn require_matching_linked_claim_case(
    claim_case: &ClaimCase,
    claim_case_key: Pubkey,
    obligation: &Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
) -> Result<()> {
    require!(
        claim_case.health_plan == health_plan_key && obligation.health_plan == health_plan_key,
        OmegaXProtocolError::HealthPlanMismatch
    );
    require!(
        claim_case.policy_series == obligation.policy_series,
        OmegaXProtocolError::PolicySeriesMismatch
    );
    require!(
        claim_case.funding_line == obligation.funding_line,
        OmegaXProtocolError::FundingLineMismatch
    );
    require!(
        claim_case.asset_mint == obligation.asset_mint,
        OmegaXProtocolError::AssetMintMismatch
    );
    require!(
        obligation.claim_case == ZERO_PUBKEY || obligation.claim_case == claim_case_key,
        OmegaXProtocolError::ClaimCaseLinkMismatch
    );
    require!(
        claim_case.linked_obligation == ZERO_PUBKEY
            || claim_case.linked_obligation == obligation_key,
        OmegaXProtocolError::ClaimCaseLinkMismatch
    );
    Ok(())
}

fn establish_or_validate_claim_obligation_link(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    claim_case.linked_obligation = obligation_key;
    obligation.claim_case = claim_case_key;
    claim_case.reserved_amount = obligation.reserved_amount;
    Ok(())
}

fn sync_adjudicated_claim_liability(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: Option<(&mut Obligation, Pubkey)>,
    health_plan_key: Pubkey,
    approved_amount: u64,
    reserve_amount: u64,
) -> Result<()> {
    if let Some((obligation, obligation_key)) = obligation {
        establish_or_validate_claim_obligation_link(
            claim_case,
            claim_case_key,
            obligation,
            obligation_key,
            health_plan_key,
        )?;
        require!(
            obligation.reserved_amount <= approved_amount,
            OmegaXProtocolError::AmountExceedsApprovedClaim
        );
        claim_case.reserved_amount = obligation.reserved_amount;
    } else {
        require!(
            claim_case.linked_obligation == ZERO_PUBKEY,
            OmegaXProtocolError::ClaimCaseLinkMismatch
        );
        claim_case.reserved_amount = reserve_amount;
    }
    Ok(())
}

fn sync_linked_claim_case_reserve(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
    now_ts: i64,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    obligation.claim_case = claim_case_key;
    claim_case.linked_obligation = obligation_key;
    claim_case.reserved_amount = obligation.reserved_amount;
    if obligation.status == OBLIGATION_STATUS_CANCELED && obligation.outstanding_amount == 0 {
        claim_case.intake_status = CLAIM_INTAKE_CLOSED;
        claim_case.closed_at = now_ts;
    }
    claim_case.updated_at = now_ts;
    Ok(())
}

fn sync_linked_claim_case_after_settlement(
    claim_case: &mut ClaimCase,
    claim_case_key: Pubkey,
    obligation: &mut Obligation,
    obligation_key: Pubkey,
    health_plan_key: Pubkey,
    amount: u64,
    now_ts: i64,
) -> Result<()> {
    require_matching_linked_claim_case(
        claim_case,
        claim_case_key,
        obligation,
        obligation_key,
        health_plan_key,
    )?;
    require!(
        amount <= remaining_claim_amount(claim_case),
        OmegaXProtocolError::AmountExceedsApprovedClaim
    );

    obligation.claim_case = claim_case_key;
    claim_case.linked_obligation = obligation_key;
    claim_case.paid_amount = checked_add(claim_case.paid_amount, amount)?;
    claim_case.reserved_amount = obligation.reserved_amount;
    claim_case.intake_status = if claim_case.paid_amount >= claim_case.approved_amount
        || obligation.outstanding_amount == 0
    {
        CLAIM_INTAKE_SETTLED
    } else {
        CLAIM_INTAKE_APPROVED
    };
    claim_case.closed_at = if claim_case.intake_status == CLAIM_INTAKE_SETTLED {
        now_ts
    } else {
        0
    };
    claim_case.updated_at = now_ts;
    Ok(())
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
            pending_redemption_assets: 1,
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
            pending_redemption_assets: 0,
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
        assert_eq!(lp_position.pending_redemption_assets, 0);
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
            pending_redemption_assets: 18,
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
        assert_eq!(lp_position.pending_redemption_assets, 18);
        assert_eq!(lp_position.realized_distributions, 7);
        assert_eq!(lp_position.impaired_principal, 3);
        assert_eq!(lp_position.queue_status, LP_QUEUE_STATUS_PENDING);
        assert!(lp_position.credentialed);
        assert_eq!(lp_position.lockup_ends_at, 1_120);
    }

    #[test]
    fn redemption_assets_are_derived_from_nav() {
        assert_eq!(redeemable_assets_for_shares(25, 100, 1_000).unwrap(), 250);
        assert_eq!(redeemable_assets_for_shares(3, 7, 700).unwrap(), 300);
        assert!(redeemable_assets_for_shares(1, 0, 100).is_err());
        assert!(redeemable_assets_for_shares(1, 100, 0).is_err());
    }

    #[test]
    fn redemption_processing_uses_queued_assets() {
        assert_eq!(redemption_assets_to_process(4, 10, 250).unwrap(), 100);
        assert_eq!(redemption_assets_to_process(6, 6, 149).unwrap(), 149);
        assert!(redemption_assets_to_process(1, 10, 0).is_err());
        assert!(redemption_assets_to_process(11, 10, 250).is_err());
    }

    #[test]
    fn sentinel_is_not_curator_control() {
        let curator = Pubkey::new_unique();
        let sentinel = Pubkey::new_unique();
        let governance_authority = Pubkey::new_unique();
        let governance = ProtocolGovernance {
            governance_authority,
            protocol_fee_bps: 0,
            emergency_pause: false,
            audit_nonce: 0,
            bump: 1,
        };
        let pool = LiquidityPool {
            reserve_domain: Pubkey::new_unique(),
            curator,
            allocator: Pubkey::new_unique(),
            sentinel,
            pool_id: "pool-001".to_string(),
            display_name: "Protect Pool".to_string(),
            deposit_asset_mint: Pubkey::new_unique(),
            strategy_hash: [0u8; 32],
            allowed_exposure_hash: [0u8; 32],
            external_yield_adapter_hash: [0u8; 32],
            fee_bps: 0,
            redemption_policy: 0,
            pause_flags: 0,
            total_value_locked: 0,
            total_allocated: 0,
            total_reserved: 0,
            total_impaired: 0,
            total_pending_redemptions: 0,
            active: true,
            audit_nonce: 0,
            bump: 1,
        };

        assert!(require_curator_control(&curator, &governance, &pool).is_ok());
        assert!(require_curator_control(&governance_authority, &governance, &pool).is_ok());
        assert!(require_curator_control(&sentinel, &governance, &pool).is_err());
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

    #[test]
    fn rotating_protocol_governance_authority_updates_state_and_nonce() {
        let current_governance_authority = Pubkey::new_unique();
        let next_governance_authority = Pubkey::new_unique();
        let mut governance = ProtocolGovernance {
            governance_authority: current_governance_authority,
            protocol_fee_bps: 50,
            emergency_pause: false,
            audit_nonce: 2,
            bump: 7,
        };

        let previous =
            rotate_protocol_governance_authority_state(&mut governance, next_governance_authority)
                .unwrap();

        assert_eq!(previous, current_governance_authority);
        assert_eq!(governance.governance_authority, next_governance_authority);
        assert_eq!(governance.audit_nonce, 3);
    }

    #[test]
    fn rotating_protocol_governance_authority_rejects_zero_pubkey() {
        let current_governance_authority = Pubkey::new_unique();
        let mut governance = ProtocolGovernance {
            governance_authority: current_governance_authority,
            protocol_fee_bps: 50,
            emergency_pause: false,
            audit_nonce: 2,
            bump: 7,
        };

        let error =
            rotate_protocol_governance_authority_state(&mut governance, ZERO_PUBKEY).unwrap_err();

        assert!(error
            .to_string()
            .contains("Governance authority is invalid"));
        assert_eq!(
            governance.governance_authority,
            current_governance_authority
        );
        assert_eq!(governance.audit_nonce, 2);
    }

    fn sample_claim_case(
        health_plan: Pubkey,
        policy_series: Pubkey,
        funding_line: Pubkey,
        asset_mint: Pubkey,
    ) -> ClaimCase {
        ClaimCase {
            reserve_domain: Pubkey::new_unique(),
            health_plan,
            policy_series,
            member_position: Pubkey::new_unique(),
            funding_line,
            asset_mint,
            claim_id: "claim-protect-001".to_string(),
            claimant: Pubkey::new_unique(),
            adjudicator: ZERO_PUBKEY,
            delegate_recipient: ZERO_PUBKEY,
            evidence_ref_hash: [0u8; 32],
            decision_support_hash: [0u8; 32],
            intake_status: CLAIM_INTAKE_APPROVED,
            review_state: 0,
            approved_amount: 100,
            denied_amount: 0,
            paid_amount: 40,
            reserved_amount: 60,
            recovered_amount: 0,
            appeal_count: 0,
            linked_obligation: ZERO_PUBKEY,
            opened_at: 0,
            updated_at: 0,
            closed_at: 0,
            bump: 0,
        }
    }

    fn sample_obligation(
        health_plan: Pubkey,
        policy_series: Pubkey,
        funding_line: Pubkey,
        asset_mint: Pubkey,
    ) -> Obligation {
        Obligation {
            reserve_domain: Pubkey::new_unique(),
            asset_mint,
            health_plan,
            policy_series,
            member_wallet: Pubkey::new_unique(),
            beneficiary: Pubkey::new_unique(),
            funding_line,
            claim_case: ZERO_PUBKEY,
            liquidity_pool: ZERO_PUBKEY,
            capital_class: ZERO_PUBKEY,
            allocation_position: ZERO_PUBKEY,
            obligation_id: "protection-obligation-001".to_string(),
            creation_reason_hash: [0u8; 32],
            settlement_reason_hash: [0u8; 32],
            status: OBLIGATION_STATUS_RESERVED,
            delivery_mode: OBLIGATION_DELIVERY_MODE_PAYABLE,
            principal_amount: 100,
            outstanding_amount: 60,
            reserved_amount: 60,
            claimable_amount: 0,
            payable_amount: 0,
            settled_amount: 40,
            impaired_amount: 0,
            recovered_amount: 0,
            created_at: 0,
            updated_at: 0,
            bump: 0,
        }
    }

    #[test]
    fn linked_claims_cannot_rebind_to_a_different_obligation() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();
        let obligation_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        let mut obligation =
            sample_obligation(health_plan, policy_series, funding_line, asset_mint);
        claim_case.linked_obligation = Pubkey::new_unique();

        let result = establish_or_validate_claim_obligation_link(
            &mut claim_case,
            claim_case_key,
            &mut obligation,
            obligation_key,
            health_plan,
        );

        let error = result.unwrap_err();
        assert!(error.to_string().contains("Claim case linkage mismatch"));
    }

    #[test]
    fn settling_linked_claims_updates_paid_and_terminal_state() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();
        let obligation_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        let mut obligation =
            sample_obligation(health_plan, policy_series, funding_line, asset_mint);
        obligation.outstanding_amount = 0;
        obligation.reserved_amount = 0;
        obligation.settled_amount = 100;

        sync_linked_claim_case_after_settlement(
            &mut claim_case,
            claim_case_key,
            &mut obligation,
            obligation_key,
            health_plan,
            60,
            777,
        )
        .unwrap();

        assert_eq!(obligation.claim_case, claim_case_key);
        assert_eq!(claim_case.linked_obligation, obligation_key);
        assert_eq!(claim_case.paid_amount, 100);
        assert_eq!(claim_case.reserved_amount, 0);
        assert_eq!(claim_case.intake_status, CLAIM_INTAKE_SETTLED);
        assert_eq!(claim_case.closed_at, 777);
    }

    #[test]
    fn reserve_sync_tracks_obligation_reserve_balance() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();
        let obligation_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        let mut obligation =
            sample_obligation(health_plan, policy_series, funding_line, asset_mint);
        obligation.claim_case = claim_case_key;
        obligation.reserved_amount = 25;
        claim_case.linked_obligation = obligation_key;
        claim_case.reserved_amount = 60;

        sync_linked_claim_case_reserve(
            &mut claim_case,
            claim_case_key,
            &mut obligation,
            obligation_key,
            health_plan,
            555,
        )
        .unwrap();

        assert_eq!(claim_case.reserved_amount, 25);
        assert_eq!(claim_case.updated_at, 555);
    }

    #[test]
    fn linking_obligation_resets_stale_direct_reserve_tracking() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();
        let obligation_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        let mut obligation =
            sample_obligation(health_plan, policy_series, funding_line, asset_mint);
        claim_case.reserved_amount = 60;
        obligation.reserved_amount = 0;

        establish_or_validate_claim_obligation_link(
            &mut claim_case,
            claim_case_key,
            &mut obligation,
            obligation_key,
            health_plan,
        )
        .unwrap();

        assert_eq!(obligation.claim_case, claim_case_key);
        assert_eq!(claim_case.linked_obligation, obligation_key);
        assert_eq!(claim_case.reserved_amount, 0);
    }

    #[test]
    fn canceling_linked_obligation_closes_claim_case() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();
        let obligation_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        let mut obligation =
            sample_obligation(health_plan, policy_series, funding_line, asset_mint);
        obligation.claim_case = claim_case_key;
        obligation.status = OBLIGATION_STATUS_CANCELED;
        obligation.outstanding_amount = 0;
        obligation.reserved_amount = 0;
        claim_case.linked_obligation = obligation_key;
        claim_case.reserved_amount = 60;

        sync_linked_claim_case_reserve(
            &mut claim_case,
            claim_case_key,
            &mut obligation,
            obligation_key,
            health_plan,
            888,
        )
        .unwrap();

        assert_eq!(claim_case.reserved_amount, 0);
        assert_eq!(claim_case.intake_status, CLAIM_INTAKE_CLOSED);
        assert_eq!(claim_case.closed_at, 888);
        assert_eq!(claim_case.updated_at, 888);
    }

    #[test]
    fn direct_claim_settlement_rejects_linked_claim_cases() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        claim_case.linked_obligation = Pubkey::new_unique();

        let result = require_direct_claim_case_settlement(&claim_case);

        let error = result.unwrap_err();
        assert!(error
            .to_string()
            .contains("Linked claims must settle through the obligation path"));
    }

    #[test]
    fn adjudication_requires_linked_obligation_context() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        claim_case.linked_obligation = Pubkey::new_unique();

        let result = sync_adjudicated_claim_liability(
            &mut claim_case,
            claim_case_key,
            None,
            health_plan,
            100,
            0,
        );

        let error = result.unwrap_err();
        assert!(error.to_string().contains("Claim case linkage mismatch"));
    }

    #[test]
    fn adjudication_resets_direct_claim_reserve_to_requested_amount() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        claim_case.reserved_amount = 60;

        sync_adjudicated_claim_liability(
            &mut claim_case,
            claim_case_key,
            None,
            health_plan,
            100,
            0,
        )
        .unwrap();

        assert_eq!(claim_case.reserved_amount, 0);
    }

    #[test]
    fn adjudication_rejects_linked_obligation_reserve_above_approved_amount() {
        let health_plan = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let funding_line = Pubkey::new_unique();
        let asset_mint = Pubkey::new_unique();
        let claim_case_key = Pubkey::new_unique();
        let obligation_key = Pubkey::new_unique();

        let mut claim_case =
            sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
        let mut obligation =
            sample_obligation(health_plan, policy_series, funding_line, asset_mint);
        obligation.reserved_amount = 80;

        let result = sync_adjudicated_claim_liability(
            &mut claim_case,
            claim_case_key,
            Some((&mut obligation, obligation_key)),
            health_plan,
            40,
            0,
        );

        let error = result.unwrap_err();
        assert!(error.to_string().contains("Amount exceeds approved claim"));
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

    fn sample_governance(governance_authority: Pubkey) -> ProtocolGovernance {
        ProtocolGovernance {
            governance_authority,
            protocol_fee_bps: 50,
            emergency_pause: false,
            audit_nonce: 0,
            bump: 1,
        }
    }

    fn sample_health_plan_roles(
        plan_admin: Pubkey,
        sponsor_operator: Pubkey,
        claims_operator: Pubkey,
        oracle_authority: Pubkey,
    ) -> HealthPlan {
        HealthPlan {
            reserve_domain: Pubkey::new_unique(),
            sponsor: Pubkey::new_unique(),
            plan_admin,
            sponsor_operator,
            claims_operator,
            oracle_authority,
            health_plan_id: "sample-plan".to_string(),
            display_name: "Sample Plan".to_string(),
            organization_ref: String::new(),
            metadata_uri: String::new(),
            membership_mode: MEMBERSHIP_MODE_OPEN,
            membership_gate_kind: MEMBERSHIP_GATE_KIND_OPEN,
            membership_gate_mint: ZERO_PUBKEY,
            membership_gate_min_amount: 0,
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

    fn sample_member_position(wallet: Pubkey, policy_series: Pubkey) -> MemberPosition {
        MemberPosition {
            health_plan: Pubkey::new_unique(),
            policy_series,
            wallet,
            subject_commitment: [0u8; 32],
            eligibility_status: ELIGIBILITY_ELIGIBLE,
            delegated_rights: 0,
            enrollment_proof_mode: MEMBERSHIP_PROOF_MODE_OPEN,
            membership_gate_kind: MEMBERSHIP_GATE_KIND_OPEN,
            membership_anchor_ref: ZERO_PUBKEY,
            gate_amount_snapshot: 0,
            invite_id_hash: [0u8; 32],
            active: true,
            opened_at: 1,
            updated_at: 1,
            bump: 1,
        }
    }

    fn sample_open_claim_case_args(claimant: Pubkey, policy_series: Pubkey) -> OpenClaimCaseArgs {
        OpenClaimCaseArgs {
            claim_id: "claim-protect-001".to_string(),
            policy_series,
            claimant,
            evidence_ref_hash: [1u8; 32],
        }
    }

    #[test]
    fn claim_intake_submitter_allows_member_self_submission() {
        let member_wallet = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        let member_position = sample_member_position(member_wallet, policy_series);
        let args = sample_open_claim_case_args(member_wallet, policy_series);

        assert!(
            require_claim_intake_submitter(&member_wallet, &plan, &member_position, &args).is_ok()
        );
    }

    #[test]
    fn claim_intake_submitter_allows_plan_claim_operators() {
        let member_wallet = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let plan_admin = Pubkey::new_unique();
        let claims_operator = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            plan_admin,
            Pubkey::new_unique(),
            claims_operator,
            Pubkey::new_unique(),
        );
        let member_position = sample_member_position(member_wallet, policy_series);
        // PT-2026-04-27-04 fix: operator submissions require args.claimant to
        // equal member_position.wallet. Custom recipient routing is handled by
        // ClaimCase.delegate_recipient instead.
        let args = sample_open_claim_case_args(member_wallet, policy_series);

        assert!(
            require_claim_intake_submitter(&claims_operator, &plan, &member_position, &args)
                .is_ok()
        );
        assert!(
            require_claim_intake_submitter(&plan_admin, &plan, &member_position, &args).is_ok()
        );
    }

    #[test]
    fn claim_intake_submitter_rejects_operator_with_attacker_claimant() {
        // PT-2026-04-27-04 regression test. An operator (claims_operator or
        // plan_admin) cannot mint a claim with an arbitrary attacker pubkey in
        // args.claimant; the gate now requires args.claimant == member.wallet.
        let member_wallet = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let plan_admin = Pubkey::new_unique();
        let claims_operator = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            plan_admin,
            Pubkey::new_unique(),
            claims_operator,
            Pubkey::new_unique(),
        );
        let member_position = sample_member_position(member_wallet, policy_series);
        let attacker = Pubkey::new_unique();
        let args = sample_open_claim_case_args(attacker, policy_series);

        let claims_op_err =
            require_claim_intake_submitter(&claims_operator, &plan, &member_position, &args)
                .unwrap_err();
        assert!(claims_op_err.to_string().contains("Unauthorized"));

        let plan_admin_err =
            require_claim_intake_submitter(&plan_admin, &plan, &member_position, &args)
                .unwrap_err();
        assert!(plan_admin_err.to_string().contains("Unauthorized"));
    }

    #[test]
    fn claim_settlement_routes_to_member_wallet_when_no_delegate() {
        // PT-2026-04-27-04 routing: when delegate_recipient is the ZERO_PUBKEY
        // (the default after open_claim_case) settle_claim_case must pay
        // member_position.wallet's ATA.
        let member_wallet = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let mut claim_case = sample_claim_case(
            Pubkey::new_unique(),
            policy_series,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        claim_case.delegate_recipient = ZERO_PUBKEY;
        let member_position = sample_member_position(member_wallet, policy_series);

        let resolved = resolve_claim_settlement_recipient(&claim_case, &member_position);
        assert_eq!(resolved, member_wallet);
    }

    #[test]
    fn claim_settlement_routes_to_delegate_when_authorized() {
        // PT-2026-04-27-04 routing: when the member has called
        // authorize_claim_recipient with a non-zero delegate,
        // settle_claim_case pays that delegate's ATA instead.
        let member_wallet = Pubkey::new_unique();
        let delegate = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let mut claim_case = sample_claim_case(
            Pubkey::new_unique(),
            policy_series,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        claim_case.delegate_recipient = delegate;
        let member_position = sample_member_position(member_wallet, policy_series);

        let resolved = resolve_claim_settlement_recipient(&claim_case, &member_position);
        assert_eq!(resolved, delegate);
        assert_ne!(resolved, member_wallet);
    }

    #[test]
    fn claim_intake_submitter_rejects_unrelated_signers() {
        let member_wallet = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        let member_position = sample_member_position(member_wallet, policy_series);
        let args = sample_open_claim_case_args(member_wallet, policy_series);
        let attacker = Pubkey::new_unique();

        let error =
            require_claim_intake_submitter(&attacker, &plan, &member_position, &args).unwrap_err();

        assert!(error.to_string().contains("Unauthorized"));
    }

    #[test]
    fn claim_intake_submitter_rejects_member_claimant_override() {
        let member_wallet = Pubkey::new_unique();
        let policy_series = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        let member_position = sample_member_position(member_wallet, policy_series);
        let args = sample_open_claim_case_args(Pubkey::new_unique(), policy_series);

        let error = require_claim_intake_submitter(&member_wallet, &plan, &member_position, &args)
            .unwrap_err();

        assert!(error.to_string().contains("Unauthorized"));
    }

    #[test]
    fn linked_claim_reserve_control_allows_claim_and_oracle_operators() {
        let plan_admin = Pubkey::new_unique();
        let sponsor_operator = Pubkey::new_unique();
        let claims_operator = Pubkey::new_unique();
        let oracle_authority = Pubkey::new_unique();
        let governance_authority = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            plan_admin,
            sponsor_operator,
            claims_operator,
            oracle_authority,
        );
        let governance = sample_governance(governance_authority);
        let mut obligation = sample_obligation(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        obligation.claim_case = Pubkey::new_unique();

        assert!(require_obligation_reserve_control(
            &claims_operator,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());
        assert!(require_obligation_reserve_control(
            &oracle_authority,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());
        assert!(
            require_obligation_reserve_control(&plan_admin, &governance, &plan, &obligation,)
                .is_ok()
        );
        assert!(require_obligation_reserve_control(
            &governance_authority,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());
    }

    #[test]
    fn linked_claim_reserve_control_rejects_sponsor_operator() {
        let plan_admin = Pubkey::new_unique();
        let sponsor_operator = Pubkey::new_unique();
        let claims_operator = Pubkey::new_unique();
        let oracle_authority = Pubkey::new_unique();
        let governance_authority = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            plan_admin,
            sponsor_operator,
            claims_operator,
            oracle_authority,
        );
        let governance = sample_governance(governance_authority);
        let mut obligation = sample_obligation(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        obligation.claim_case = Pubkey::new_unique();

        let error =
            require_obligation_reserve_control(&sponsor_operator, &governance, &plan, &obligation)
                .unwrap_err();

        assert!(error.to_string().contains("Unauthorized"));
    }

    #[test]
    fn linked_claim_settlement_control_is_claim_operator_scoped() {
        let plan_admin = Pubkey::new_unique();
        let sponsor_operator = Pubkey::new_unique();
        let claims_operator = Pubkey::new_unique();
        let oracle_authority = Pubkey::new_unique();
        let governance_authority = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            plan_admin,
            sponsor_operator,
            claims_operator,
            oracle_authority,
        );
        let governance = sample_governance(governance_authority);
        let mut obligation = sample_obligation(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        obligation.claim_case = Pubkey::new_unique();

        assert!(require_obligation_settlement_control(
            &claims_operator,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());
        assert!(require_obligation_settlement_control(
            &plan_admin,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());
        assert!(require_obligation_settlement_control(
            &governance_authority,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());

        let error = require_obligation_settlement_control(
            &oracle_authority,
            &governance,
            &plan,
            &obligation,
        )
        .unwrap_err();
        assert!(error.to_string().contains("Unauthorized"));
    }

    #[test]
    fn unlinked_obligation_reserve_control_preserves_sponsor_operator_path() {
        let plan_admin = Pubkey::new_unique();
        let sponsor_operator = Pubkey::new_unique();
        let claims_operator = Pubkey::new_unique();
        let oracle_authority = Pubkey::new_unique();
        let governance_authority = Pubkey::new_unique();
        let plan = sample_health_plan_roles(
            plan_admin,
            sponsor_operator,
            claims_operator,
            oracle_authority,
        );
        let governance = sample_governance(governance_authority);
        let obligation = sample_obligation(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );

        assert!(require_obligation_reserve_control(
            &sponsor_operator,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());
        assert!(require_obligation_settlement_control(
            &sponsor_operator,
            &governance,
            &plan,
            &obligation,
        )
        .is_ok());
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

    fn oracle_profile_with_supported_schemas(
        supported_schema_key_hashes: &[[u8; 32]],
    ) -> OracleProfile {
        let mut advertised = [[0; 32]; MAX_ORACLE_SUPPORTED_SCHEMAS];
        for (index, schema_key_hash) in supported_schema_key_hashes.iter().enumerate() {
            advertised[index] = *schema_key_hash;
        }

        OracleProfile {
            oracle: Pubkey::new_unique(),
            admin: Pubkey::new_unique(),
            oracle_type: ORACLE_TYPE_LAB,
            display_name: String::new(),
            legal_name: String::new(),
            website_url: String::new(),
            app_url: String::new(),
            logo_uri: String::new(),
            webhook_url: String::new(),
            supported_schema_count: supported_schema_key_hashes.len() as u8,
            supported_schema_key_hashes: advertised,
            active: true,
            claimed: true,
            created_at_ts: 0,
            updated_at_ts: 0,
            bump: 1,
        }
    }

    #[test]
    fn oracle_profile_schema_support_allows_unrestricted_profiles() {
        let schema_key_hash = [7; 32];
        let oracle_profile = oracle_profile_with_supported_schemas(&[]);

        assert!(oracle_profile_supports_schema(
            &oracle_profile,
            schema_key_hash
        ));
    }

    #[test]
    fn oracle_profile_schema_support_rejects_unlisted_schema_hashes() {
        let supported_schema_key_hash = [8; 32];
        let unsupported_schema_key_hash = [9; 32];
        let oracle_profile = oracle_profile_with_supported_schemas(&[supported_schema_key_hash]);

        assert!(oracle_profile_supports_schema(
            &oracle_profile,
            supported_schema_key_hash
        ));
        assert!(!oracle_profile_supports_schema(
            &oracle_profile,
            unsupported_schema_key_hash
        ));
    }

    #[test]
    fn zero_claim_attestation_schema_hash_is_rejected() {
        assert!(is_zero_hash(&[0; 32]));
        assert!(!oracle_profile_supports_schema(
            &oracle_profile_with_supported_schemas(&[]),
            [0; 32]
        ));
    }

    // -------- Phase 1.6 fee-vault helper tests --------

    #[test]
    fn fee_share_from_bps_zero_bps_or_zero_amount_returns_zero() {
        // bps == 0 short-circuits regardless of amount.
        assert_eq!(fee_share_from_bps(1_000_000, 0).unwrap(), 0);
        // amount == 0 short-circuits regardless of bps.
        assert_eq!(fee_share_from_bps(0, 50).unwrap(), 0);
        // both zero is OK too.
        assert_eq!(fee_share_from_bps(0, 0).unwrap(), 0);
    }

    #[test]
    fn fee_share_from_bps_typical_50_bps_yields_half_percent() {
        // 1_000_000_000 lamports * 50 / 10_000 = 5_000_000.
        assert_eq!(fee_share_from_bps(1_000_000_000, 50).unwrap(), 5_000_000);
        // 1_000_000 USDC base units (6 decimals = $1) * 25 / 10_000 = 2_500
        // (= 0.0025 USDC = 0.25%).
        assert_eq!(fee_share_from_bps(1_000_000, 25).unwrap(), 2_500);
    }

    #[test]
    fn fee_share_from_bps_floors_to_zero_below_one_unit() {
        // 100 * 50 / 10_000 = 0.5 — Solana convention floors to zero.
        assert_eq!(fee_share_from_bps(100, 50).unwrap(), 0);
        // 199 * 1 / 10_000 = 0.0199 — also floors to zero.
        assert_eq!(fee_share_from_bps(199, 1).unwrap(), 0);
        // 10_000 * 1 / 10_000 = 1 — first non-zero share.
        assert_eq!(fee_share_from_bps(10_000, 1).unwrap(), 1);
    }

    #[test]
    fn fee_share_from_bps_rejects_bps_above_10000() {
        // 100% (10_000 bps) is the maximum legal bps; anything higher is a
        // configuration error and returns FeeVaultBpsMisconfigured.
        assert_eq!(fee_share_from_bps(1_000_000, 10_000).unwrap(), 1_000_000);
        assert!(fee_share_from_bps(1_000_000, 10_001).is_err());
    }

    #[test]
    fn accrue_fee_increments_running_total() {
        let mut accrued: u64 = 100;
        let new_total = accrue_fee(&mut accrued, 50).unwrap();
        assert_eq!(new_total, 150);
        assert_eq!(accrued, 150);
        // Subsequent accrual continues to add.
        let next = accrue_fee(&mut accrued, 25).unwrap();
        assert_eq!(next, 175);
        assert_eq!(accrued, 175);
    }

    #[test]
    fn accrue_fee_zero_amount_returns_existing_total_unchanged() {
        let mut accrued: u64 = 12_345;
        let total = accrue_fee(&mut accrued, 0).unwrap();
        assert_eq!(total, 12_345);
        assert_eq!(accrued, 12_345);
    }

    #[test]
    fn accrue_fee_overflow_errors() {
        let mut accrued: u64 = u64::MAX - 10;
        // 11 onto MAX-10 overflows.
        assert!(accrue_fee(&mut accrued, 11).is_err());
        // The accrued value is unchanged on error (checked_add returns None).
        assert_eq!(accrued, u64::MAX - 10);
        // Accruing exactly to MAX is allowed.
        let total = accrue_fee(&mut accrued, 10).unwrap();
        assert_eq!(total, u64::MAX);
    }

    // -------- Phase 1.7 withdraw-helper tests --------

    #[test]
    fn fee_vault_balance_accepts_within_headroom() {
        // accrued = 100, withdrawn = 30, requesting 50 → new_withdrawn = 80 ≤ 100.
        let new_withdrawn = require_fee_vault_balance(100, 30, 50).unwrap();
        assert_eq!(new_withdrawn, 80);
    }

    #[test]
    fn fee_vault_balance_accepts_exact_remaining() {
        // Drain to zero remaining headroom in a single call.
        let new_withdrawn = require_fee_vault_balance(1_000, 250, 750).unwrap();
        assert_eq!(new_withdrawn, 1_000);
    }

    #[test]
    fn fee_vault_balance_rejects_overdraw() {
        // accrued = 100, withdrawn = 80, requesting 21 → new_withdrawn = 101 > 100.
        let err = require_fee_vault_balance(100, 80, 21).unwrap_err();
        let msg = format!("{err:?}");
        assert!(
            msg.contains("FeeVaultInsufficientBalance"),
            "expected FeeVaultInsufficientBalance, got: {msg}"
        );
    }

    #[test]
    fn fee_vault_balance_rejects_zero_amount() {
        // Zero-amount withdrawals are rejected by require_positive_amount —
        // matches the existing convention used for premium/deposit/redemption.
        assert!(require_fee_vault_balance(100, 0, 0).is_err());
    }

    #[test]
    fn fee_vault_balance_rejects_overflow_on_withdrawn_sum() {
        // withdrawn near MAX, requesting any positive amount overflows.
        assert!(require_fee_vault_balance(u64::MAX, u64::MAX - 5, 10).is_err());
    }
}
