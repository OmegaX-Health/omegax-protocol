// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::*;

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
fn deposit_shares_bootstrap_one_to_one_only_from_empty_nav() {
    assert_eq!(deposit_shares_for_nav(250, 0, 0, 0).unwrap(), 250);
    assert!(deposit_shares_for_nav(250, 0, 1, 0).is_err());
    assert!(deposit_shares_for_nav(250, 1, 0, 0).is_err());
}

#[test]
fn deposit_shares_are_priced_from_current_nav() {
    assert_eq!(deposit_shares_for_nav(50, 1_000, 500, 0).unwrap(), 100);
    assert_eq!(
        deposit_shares_for_nav(1, 1_000_000, 1_000_000, 0).unwrap(),
        1
    );
}

#[test]
fn deposit_shares_reject_zero_out_and_minimum_miss() {
    assert!(deposit_shares_for_nav(1, 1, 1_000_000, 0).is_err());
    assert!(deposit_shares_for_nav(100, 1_000, 1_000, 101).is_err());
    assert_eq!(deposit_shares_for_nav(100, 1_000, 1_000, 100).unwrap(), 100);
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
    release_to_claimable_or_payable(&mut sheet, OBLIGATION_DELIVERY_MODE_CLAIMABLE, 120).unwrap();
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    claim_case.reserved_amount = 60;

    sync_adjudicated_claim_liability(&mut claim_case, claim_case_key, None, health_plan, 100, 0)
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

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);
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

fn membership_proof_input(membership_mode: u8, proof_mode: u8) -> MembershipProofValidationInput {
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

    assert!(require_claim_intake_submitter(&member_wallet, &plan, &member_position, &args).is_ok());
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
        require_claim_intake_submitter(&claims_operator, &plan, &member_position, &args).is_ok()
    );
    assert!(require_claim_intake_submitter(&plan_admin, &plan, &member_position, &args).is_ok());
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
        require_claim_intake_submitter(&plan_admin, &plan, &member_position, &args).unwrap_err();
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

    let error =
        require_claim_intake_submitter(&member_wallet, &plan, &member_position, &args).unwrap_err();

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

    assert!(
        require_obligation_reserve_control(&claims_operator, &governance, &plan, &obligation,)
            .is_ok()
    );
    assert!(
        require_obligation_reserve_control(&oracle_authority, &governance, &plan, &obligation,)
            .is_ok()
    );
    assert!(
        require_obligation_reserve_control(&plan_admin, &governance, &plan, &obligation,).is_ok()
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
    assert!(
        require_obligation_settlement_control(&plan_admin, &governance, &plan, &obligation,)
            .is_ok()
    );
    assert!(require_obligation_settlement_control(
        &governance_authority,
        &governance,
        &plan,
        &obligation,
    )
    .is_ok());

    let error =
        require_obligation_settlement_control(&oracle_authority, &governance, &plan, &obligation)
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

    assert!(
        require_obligation_reserve_control(&sponsor_operator, &governance, &plan, &obligation,)
            .is_ok()
    );
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

#[test]
fn configured_fee_recipient_must_be_nonzero_and_match() {
    let recipient = Pubkey::new_unique();
    let attacker = Pubkey::new_unique();

    assert_eq!(
        require_configured_fee_recipient(recipient).unwrap(),
        recipient
    );
    assert!(require_configured_fee_recipient(ZERO_PUBKEY).is_err());
    assert!(require_fee_recipient_owner(recipient, recipient).is_ok());
    assert!(require_fee_recipient_owner(attacker, recipient).is_err());
}

#[test]
fn token_program_guard_rejects_non_classic_spl_token() {
    assert!(
        require_classic_token_program_keys(anchor_spl::token::ID, anchor_spl::token::ID).is_ok()
    );
    assert!(
        require_classic_token_program_keys(Pubkey::new_unique(), anchor_spl::token::ID).is_err()
    );
    assert!(
        require_classic_token_program_keys(anchor_spl::token::ID, Pubkey::new_unique()).is_err()
    );
}
