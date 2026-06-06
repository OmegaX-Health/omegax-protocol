// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::*;

const SAMPLE_EVIDENCE_HASH: [u8; 32] = [0x11; 32];
const SAMPLE_DECISION_HASH: [u8; 32] = [0x22; 32];
const SAMPLE_ALT_EVIDENCE_HASH: [u8; 32] = [0x33; 32];

#[test]
fn inactive_health_plan_guard_blocks_fresh_intake() {
    let plan_admin = Pubkey::new_unique();
    let mut plan = sample_health_plan_roles(
        plan_admin,
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    assert!(require_health_plan_active(&plan).is_ok());

    plan.active = false;
    assert_eq!(
        require_health_plan_active(&plan).unwrap_err(),
        OmegaXProtocolError::HealthPlanInactive.into()
    );
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
fn partial_claimable_transition_rejects_without_mutating_obligation() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);

    let status = obligation.status;
    let outstanding_amount = obligation.outstanding_amount;
    let reserved_amount = obligation.reserved_amount;
    let result = require_full_obligation_transition_amount(
        OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
        outstanding_amount - 1,
        &obligation,
    );

    let error = result.unwrap_err();
    assert!(error
        .to_string()
        .contains("Partial obligation lifecycle transitions are not supported"));
    assert_eq!(obligation.status, status);
    assert_eq!(obligation.outstanding_amount, outstanding_amount);
    assert_eq!(obligation.reserved_amount, reserved_amount);
}

#[test]
fn partial_settled_transition_rejects_from_reserved_and_delivery_states() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);

    for status in [
        OBLIGATION_STATUS_RESERVED,
        OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
    ] {
        obligation.status = status;
        let result = require_full_obligation_transition_amount(
            OBLIGATION_STATUS_SETTLED,
            obligation.outstanding_amount - 1,
            &obligation,
        );
        let error = result.unwrap_err();
        assert!(error
            .to_string()
            .contains("Partial obligation lifecycle transitions are not supported"));
    }
}

#[test]
fn partial_canceled_transition_rejects() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);

    let result = require_full_obligation_transition_amount(
        OBLIGATION_STATUS_CANCELED,
        obligation.outstanding_amount - 1,
        &obligation,
    );

    let error = result.unwrap_err();
    assert!(error
        .to_string()
        .contains("Partial obligation lifecycle transitions are not supported"));
}

#[test]
fn full_settlement_and_cancellation_amounts_remain_supported() {
    let reserve_domain = Pubkey::new_unique();
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let funding_line_key = Pubkey::new_unique();

    let mut settlement_line = sample_funding_line(
        reserve_domain,
        health_plan,
        policy_series,
        asset_mint,
        FUNDING_LINE_TYPE_SPONSOR_BUDGET,
    );
    settlement_line.reserved_amount = 60;
    let mut settlement_obligation =
        sample_obligation(health_plan, policy_series, funding_line_key, asset_mint);
    let mut domain_assets = 60;
    let mut domain_sheet = ReserveBalanceSheet {
        funded: 60,
        reserved: 60,
        owed: 60,
        free: 0,
        redeemable: 0,
        ..ReserveBalanceSheet::default()
    };
    let mut plan_sheet = domain_sheet;
    let mut line_sheet = domain_sheet;

    require_full_obligation_transition_amount(
        OBLIGATION_STATUS_SETTLED,
        settlement_obligation.outstanding_amount,
        &settlement_obligation,
    )
    .unwrap();
    settle_delivery(
        &mut domain_assets,
        &mut domain_sheet,
        &mut plan_sheet,
        &mut line_sheet,
        &mut settlement_line,
        60,
        &mut settlement_obligation,
    )
    .unwrap();

    assert_eq!(domain_assets, 0);
    assert_eq!(settlement_obligation.outstanding_amount, 0);
    assert_eq!(settlement_obligation.settled_amount, 100);
    assert_eq!(domain_sheet.settled, 60);

    let mut cancellation_line = sample_funding_line(
        reserve_domain,
        health_plan,
        policy_series,
        asset_mint,
        FUNDING_LINE_TYPE_SPONSOR_BUDGET,
    );
    cancellation_line.reserved_amount = 60;
    let mut cancellation_obligation =
        sample_obligation(health_plan, policy_series, funding_line_key, asset_mint);
    let mut cancel_domain_sheet = ReserveBalanceSheet {
        funded: 60,
        reserved: 60,
        owed: 60,
        free: 0,
        redeemable: 0,
        ..ReserveBalanceSheet::default()
    };
    let mut cancel_plan_sheet = cancel_domain_sheet;
    let mut cancel_line_sheet = cancel_domain_sheet;

    require_full_obligation_transition_amount(
        OBLIGATION_STATUS_CANCELED,
        cancellation_obligation.outstanding_amount,
        &cancellation_obligation,
    )
    .unwrap();
    cancel_outstanding(
        &mut cancel_domain_sheet,
        &mut cancel_plan_sheet,
        &mut cancel_line_sheet,
        &mut cancellation_line,
        60,
        &mut cancellation_obligation,
    )
    .unwrap();

    assert_eq!(cancellation_obligation.outstanding_amount, 0);
    assert_eq!(cancellation_obligation.reserved_amount, 0);
    assert_eq!(cancellation_line.released_amount, 60);
    assert_eq!(cancel_domain_sheet.owed, 0);
}

#[test]
fn invalid_obligation_delivery_mode_rejects() {
    let mut sheet = ReserveBalanceSheet::default();
    book_inflow_sheet(&mut sheet, 500).unwrap();
    let funded_before = sheet.funded;
    let free_before = sheet.free;

    let result = require_supported_obligation_delivery_mode(99);

    let error = result.unwrap_err();
    assert!(error
        .to_string()
        .contains("Invalid obligation delivery mode"));
    assert_eq!(sheet.funded, funded_before);
    assert_eq!(sheet.free, free_before);
    assert!(require_supported_obligation_delivery_mode(OBLIGATION_DELIVERY_MODE_CLAIMABLE).is_ok());
    assert!(require_supported_obligation_delivery_mode(OBLIGATION_DELIVERY_MODE_PAYABLE).is_ok());
}

#[test]
fn reserve_capacity_rejects_unfunded_non_allocation_obligations() {
    let mut sheet = ReserveBalanceSheet::default();
    book_inflow_sheet(&mut sheet, 100).unwrap();
    assert!(require_obligation_reserve_capacity(&sheet, 100).is_ok());
    assert!(require_obligation_reserve_capacity(&sheet, 101).is_err());
}

#[test]
fn restricted_reserve_locks_only_existing_stable_capacity() {
    let mut stable_sheet = ReserveBalanceSheet::default();
    assert!(book_restricted_sheet(&mut stable_sheet, 99_000_000).is_err());
    assert_eq!(stable_sheet, ReserveBalanceSheet::default());

    book_inflow_sheet(&mut stable_sheet, 250_000_000).unwrap();
    book_restricted_sheet(&mut stable_sheet, 99_000_000).unwrap();

    assert_eq!(stable_sheet.funded, 250_000_000);
    assert_eq!(stable_sheet.restricted, 99_000_000);
    assert_eq!(stable_sheet.free, 151_000_000);
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
        funding_line,
        asset_mint,
        claim_id: "claim-protect-001".to_string(),
        claimant: Pubkey::new_unique(),
        adjudicator: ZERO_PUBKEY,
        delegate_recipient: ZERO_PUBKEY,
        evidence_ref_hash: SAMPLE_EVIDENCE_HASH,
        decision_support_hash: SAMPLE_DECISION_HASH,
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
fn direct_claim_adjudication_rejects_unbooked_reserve_amounts() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let claim_case_key = Pubkey::new_unique();

    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);

    let result = sync_adjudicated_claim_liability(
        &mut claim_case,
        claim_case_key,
        None,
        health_plan,
        100,
        1,
    );

    let error = result.unwrap_err();
    assert!(error
        .to_string()
        .contains("Direct claim reserves require linked obligation settlement"));
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

#[test]
fn post_payout_claim_adjudication_rejects() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    claim_case.paid_amount = 1;

    let result = require_claim_adjudication_mutable(&claim_case, None);

    let error = result.unwrap_err();
    assert!(error
        .to_string()
        .contains("Claim adjudication is locked after payout or terminal state"));
}

#[test]
fn settled_or_closed_claim_adjudication_rejects() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    claim_case.paid_amount = 0;

    for intake_status in [CLAIM_INTAKE_SETTLED, CLAIM_INTAKE_CLOSED] {
        claim_case.intake_status = intake_status;
        let result = require_claim_adjudication_mutable(&claim_case, None);
        let error = result.unwrap_err();
        assert!(error
            .to_string()
            .contains("Claim adjudication is locked after payout or terminal state"));
    }
}

#[test]
fn pre_payout_claim_adjudication_remains_mutable() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    claim_case.paid_amount = 0;

    for intake_status in [
        CLAIM_INTAKE_OPEN,
        CLAIM_INTAKE_UNDER_REVIEW,
        CLAIM_INTAKE_APPROVED,
        CLAIM_INTAKE_DENIED,
    ] {
        claim_case.intake_status = intake_status;
        require_claim_adjudication_mutable(&claim_case, None).unwrap();
    }
}

#[test]
fn terminal_or_settled_obligation_locks_adjudication() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    let mut obligation = sample_obligation(health_plan, policy_series, funding_line, asset_mint);
    claim_case.paid_amount = 0;
    claim_case.intake_status = CLAIM_INTAKE_APPROVED;

    obligation.status = OBLIGATION_STATUS_SETTLED;
    let terminal_result = require_claim_adjudication_mutable(&claim_case, Some(&obligation));
    let terminal_error = terminal_result.unwrap_err();
    assert!(terminal_error
        .to_string()
        .contains("Claim adjudication is locked after payout or terminal state"));

    obligation.status = OBLIGATION_STATUS_RESERVED;
    obligation.settled_amount = 1;
    let settled_result = require_claim_adjudication_mutable(&claim_case, Some(&obligation));
    let settled_error = settled_result.unwrap_err();
    assert!(settled_error
        .to_string()
        .contains("Claim adjudication is locked after payout or terminal state"));
}

#[test]
fn claim_proof_fingerprints_require_both_hashes() {
    require_claim_proof_fingerprints(&SAMPLE_EVIDENCE_HASH, &SAMPLE_DECISION_HASH).unwrap();

    let missing_evidence =
        require_claim_proof_fingerprints(&[0u8; 32], &SAMPLE_DECISION_HASH).unwrap_err();
    assert!(missing_evidence
        .to_string()
        .contains("Claim proof fingerprints are required"));

    let missing_decision =
        require_claim_proof_fingerprints(&SAMPLE_EVIDENCE_HASH, &[0u8; 32]).unwrap_err();
    assert!(missing_decision
        .to_string()
        .contains("Claim proof fingerprints are required"));
}

#[test]
fn adjudication_can_set_final_fingerprints_before_money_moves() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    claim_case.evidence_ref_hash = [0u8; 32];
    claim_case.decision_support_hash = [0u8; 32];
    claim_case.reserved_amount = 0;
    claim_case.paid_amount = 0;

    let (evidence_ref_hash, decision_support_hash) = resolve_claim_proof_fingerprints(
        &claim_case,
        SAMPLE_EVIDENCE_HASH,
        SAMPLE_DECISION_HASH,
        true,
        false,
    )
    .unwrap();

    assert_eq!(evidence_ref_hash, SAMPLE_EVIDENCE_HASH);
    assert_eq!(decision_support_hash, SAMPLE_DECISION_HASH);
}

#[test]
fn positive_adjudication_rejects_missing_fingerprints() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    claim_case.evidence_ref_hash = [0u8; 32];
    claim_case.decision_support_hash = [0u8; 32];
    claim_case.reserved_amount = 0;
    claim_case.paid_amount = 0;

    let error = resolve_claim_proof_fingerprints(&claim_case, [0u8; 32], [0u8; 32], true, false)
        .unwrap_err();
    assert!(error
        .to_string()
        .contains("Claim proof fingerprints are required"));
}

#[test]
fn settled_or_reserved_claim_proof_fingerprints_are_locked() {
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let funding_line = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(health_plan, policy_series, funding_line, asset_mint);
    claim_case.reserved_amount = 1;
    claim_case.paid_amount = 0;

    let error = resolve_claim_proof_fingerprints(
        &claim_case,
        SAMPLE_ALT_EVIDENCE_HASH,
        SAMPLE_DECISION_HASH,
        true,
        true,
    )
    .unwrap_err();
    assert!(error
        .to_string()
        .contains("Claim proof fingerprints are locked"));

    let (evidence_ref_hash, decision_support_hash) =
        resolve_claim_proof_fingerprints(&claim_case, [0u8; 32], [0u8; 32], true, true).unwrap();
    assert_eq!(evidence_ref_hash, SAMPLE_EVIDENCE_HASH);
    assert_eq!(decision_support_hash, SAMPLE_DECISION_HASH);
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

fn sample_open_claim_case_args(claimant: Pubkey, policy_series: Pubkey) -> OpenClaimCaseArgs {
    OpenClaimCaseArgs {
        claim_id: "claim-protect-001".to_string(),
        policy_series,
        claimant,
        evidence_ref_hash: [0u8; 32],
    }
}

#[allow(dead_code)]
fn sample_funding_line(
    reserve_domain: Pubkey,
    health_plan: Pubkey,
    policy_series: Pubkey,
    asset_mint: Pubkey,
    line_type: u8,
) -> FundingLine {
    FundingLine {
        reserve_domain,
        health_plan,
        policy_series,
        asset_mint,
        line_id: "claim-line".to_string(),
        line_type,
        funding_priority: 0,
        committed_amount: 100,
        funded_amount: 100,
        reserved_amount: 0,
        spent_amount: 0,
        released_amount: 0,
        returned_amount: 0,
        status: FUNDING_LINE_STATUS_OPEN,
        caps_hash: [0; 32],
        bump: 1,
    }
}

#[test]
fn claim_intake_submitter_allows_claimant_self_submission() {
    let claimant = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    let args = sample_open_claim_case_args(claimant, policy_series);

    assert!(require_claim_intake_submitter(&claimant, &plan, args.claimant).is_ok());
}

#[test]
fn claim_intake_submitter_allows_plan_claim_operators() {
    let claimant = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let plan_admin = Pubkey::new_unique();
    let claims_operator = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        plan_admin,
        Pubkey::new_unique(),
        claims_operator,
        Pubkey::new_unique(),
    );
    let args = sample_open_claim_case_args(claimant, policy_series);

    assert!(require_claim_intake_submitter(&claims_operator, &plan, args.claimant).is_ok());
    assert!(require_claim_intake_submitter(&plan_admin, &plan, args.claimant).is_ok());
}

#[test]
fn claim_intake_submitter_allows_operator_for_explicit_claimant() {
    let claimant = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let plan_admin = Pubkey::new_unique();
    let claims_operator = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        plan_admin,
        Pubkey::new_unique(),
        claims_operator,
        Pubkey::new_unique(),
    );
    let args = sample_open_claim_case_args(claimant, policy_series);

    assert!(require_claim_intake_submitter(&claims_operator, &plan, args.claimant).is_ok());
    assert!(require_claim_intake_submitter(&plan_admin, &plan, args.claimant).is_ok());
}

#[test]
fn claim_settlement_routes_to_claimant_when_no_delegate() {
    let claimant = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(
        Pubkey::new_unique(),
        policy_series,
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    claim_case.claimant = claimant;
    claim_case.delegate_recipient = ZERO_PUBKEY;

    let resolved = resolve_claim_settlement_recipient(&claim_case);
    assert_eq!(resolved, claimant);
}

#[test]
fn claim_settlement_routes_to_delegate_when_authorized() {
    let claimant = Pubkey::new_unique();
    let delegate = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let mut claim_case = sample_claim_case(
        Pubkey::new_unique(),
        policy_series,
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    claim_case.claimant = claimant;
    claim_case.delegate_recipient = delegate;

    let resolved = resolve_claim_settlement_recipient(&claim_case);
    assert_eq!(resolved, delegate);
    assert_ne!(resolved, claimant);
}

#[test]
fn claim_intake_submitter_rejects_unrelated_signers() {
    let claimant = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    let args = sample_open_claim_case_args(claimant, policy_series);
    let attacker = Pubkey::new_unique();

    let error = require_claim_intake_submitter(&attacker, &plan, args.claimant).unwrap_err();

    assert!(error.to_string().contains("Unauthorized"));
}

#[test]
fn claim_intake_submitter_rejects_zero_claimant() {
    let policy_series = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    let args = sample_open_claim_case_args(ZERO_PUBKEY, policy_series);

    let error =
        require_claim_intake_submitter(&plan.claims_operator, &plan, args.claimant).unwrap_err();

    assert!(error.to_string().contains("Unauthorized"));
}

#[test]
fn linked_claim_reserve_control_allows_claim_and_oracle_operators() {
    let plan_admin = Pubkey::new_unique();
    let sponsor_operator = Pubkey::new_unique();
    let claims_operator = Pubkey::new_unique();
    let oracle_authority = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        plan_admin,
        sponsor_operator,
        claims_operator,
        oracle_authority,
    );
    let mut obligation = sample_obligation(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    obligation.claim_case = Pubkey::new_unique();

    assert!(require_obligation_reserve_control(&claims_operator, &plan, &obligation,).is_ok());
    assert!(require_obligation_reserve_control(&oracle_authority, &plan, &obligation,).is_ok());
    assert!(require_obligation_reserve_control(&plan_admin, &plan, &obligation,).is_ok());
}

#[test]
fn linked_claim_reserve_control_rejects_sponsor_operator() {
    let plan_admin = Pubkey::new_unique();
    let sponsor_operator = Pubkey::new_unique();
    let claims_operator = Pubkey::new_unique();
    let oracle_authority = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        plan_admin,
        sponsor_operator,
        claims_operator,
        oracle_authority,
    );
    let mut obligation = sample_obligation(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    obligation.claim_case = Pubkey::new_unique();

    let error =
        require_obligation_reserve_control(&sponsor_operator, &plan, &obligation).unwrap_err();

    assert!(error.to_string().contains("Unauthorized"));
}

#[test]
fn linked_claim_settlement_control_is_claim_operator_scoped() {
    let plan_admin = Pubkey::new_unique();
    let sponsor_operator = Pubkey::new_unique();
    let claims_operator = Pubkey::new_unique();
    let oracle_authority = Pubkey::new_unique();
    let outsider = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        plan_admin,
        sponsor_operator,
        claims_operator,
        oracle_authority,
    );
    let mut obligation = sample_obligation(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    obligation.claim_case = Pubkey::new_unique();

    assert!(require_obligation_settlement_control(&claims_operator, &plan, &obligation,).is_ok());
    assert!(require_obligation_settlement_control(&plan_admin, &plan, &obligation,).is_ok());
    assert!(require_obligation_settlement_control(&outsider, &plan, &obligation,).is_err());

    let error =
        require_obligation_settlement_control(&oracle_authority, &plan, &obligation).unwrap_err();
    assert!(error.to_string().contains("Unauthorized"));
}

#[test]
fn unlinked_obligation_reserve_control_preserves_sponsor_operator_path() {
    let plan_admin = Pubkey::new_unique();
    let sponsor_operator = Pubkey::new_unique();
    let claims_operator = Pubkey::new_unique();
    let oracle_authority = Pubkey::new_unique();
    let plan = sample_health_plan_roles(
        plan_admin,
        sponsor_operator,
        claims_operator,
        oracle_authority,
    );
    let obligation = sample_obligation(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );

    assert!(require_obligation_reserve_control(&sponsor_operator, &plan, &obligation,).is_ok());
    assert!(require_obligation_settlement_control(&sponsor_operator, &plan, &obligation,).is_ok());
}

#[test]
fn direct_claim_payout_debits_free_reserve_without_delivery_buckets() {
    let reserve_domain = Pubkey::new_unique();
    let health_plan = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut funding_line = sample_funding_line(
        reserve_domain,
        health_plan,
        policy_series,
        asset_mint,
        FUNDING_LINE_TYPE_SPONSOR_BUDGET,
    );
    funding_line.reserved_amount = 80;

    let mut domain_assets = 1_000;
    let mut domain_sheet = ReserveBalanceSheet {
        funded: 1_000,
        free: 1_000,
        redeemable: 1_000,
        ..ReserveBalanceSheet::default()
    };
    let mut plan_sheet = domain_sheet;
    let mut line_sheet = domain_sheet;

    book_direct_claim_payout(
        &mut domain_assets,
        &mut domain_sheet,
        &mut plan_sheet,
        &mut line_sheet,
        &mut funding_line,
        250,
    )
    .unwrap();

    assert_eq!(domain_assets, 750);
    assert_eq!(domain_sheet.funded, 750);
    assert_eq!(domain_sheet.claimable, 0);
    assert_eq!(domain_sheet.payable, 0);
    assert_eq!(domain_sheet.settled, 250);
    assert_eq!(plan_sheet.funded, 750);
    assert_eq!(line_sheet.funded, 750);
    assert_eq!(funding_line.reserved_amount, 80);
    assert_eq!(funding_line.spent_amount, 250);

    let mut insufficient_sheet = ReserveBalanceSheet {
        funded: 100,
        reserved: 80,
        free: 20,
        redeemable: 20,
        ..ReserveBalanceSheet::default()
    };
    let mut plan_sheet = insufficient_sheet;
    let mut line_sheet = insufficient_sheet;
    let mut domain_assets = 100;
    assert!(book_direct_claim_payout(
        &mut domain_assets,
        &mut insufficient_sheet,
        &mut plan_sheet,
        &mut line_sheet,
        &mut funding_line,
        50,
    )
    .is_err());
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
