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
    assert!(require_allocator(&pool.allocator, &governance, &pool).is_ok());
    assert!(require_allocator(&curator, &governance, &pool).is_ok());
    assert!(require_allocator(&sentinel, &governance, &pool).is_err());
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
fn reserve_capacity_rejects_unfunded_non_allocation_obligations() {
    let mut sheet = ReserveBalanceSheet::default();
    book_inflow_sheet(&mut sheet, 100).unwrap();
    assert!(require_obligation_reserve_capacity(&sheet, None, 100).is_ok());
    assert!(require_obligation_reserve_capacity(&sheet, None, 101).is_err());
}

#[test]
fn reserve_capacity_uses_free_lp_allocation_capacity() {
    let allocation = AllocationPosition {
        reserve_domain: Pubkey::new_unique(),
        liquidity_pool: Pubkey::new_unique(),
        capital_class: Pubkey::new_unique(),
        health_plan: Pubkey::new_unique(),
        policy_series: Pubkey::new_unique(),
        funding_line: Pubkey::new_unique(),
        cap_amount: 1_000,
        weight_bps: 10_000,
        allocation_mode: 0,
        allocated_amount: 250,
        utilized_amount: 0,
        reserved_capacity: 200,
        realized_pnl: 0,
        impaired_amount: 0,
        deallocation_only: false,
        active: true,
        bump: 1,
    };
    assert!(require_obligation_reserve_capacity(
        &ReserveBalanceSheet::default(),
        Some(&allocation),
        50
    )
    .is_ok());
    assert!(require_obligation_reserve_capacity(
        &ReserveBalanceSheet::default(),
        Some(&allocation),
        51
    )
    .is_err());
}

#[test]
fn allocation_capacity_uses_redeemable_pool_class_capacity() {
    let mut sheet = ReserveBalanceSheet::default();
    book_inflow_sheet(&mut sheet, 500).unwrap();
    book_allocation(&mut sheet, 400).unwrap();
    assert!(require_allocatable_reserve_capacity(&sheet, 100).is_ok());
    assert!(require_allocatable_reserve_capacity(&sheet, 101).is_err());
}

fn sample_commitment_ledger(campaign: Pubkey, payment_asset_mint: Pubkey) -> CommitmentLedger {
    CommitmentLedger {
        campaign,
        payment_asset_mint,
        pending_amount: 0,
        activated_amount: 0,
        treasury_locked_amount: 0,
        refunded_amount: 0,
        canceled_amount: 0,
        next_queue_index: 0,
        bump: 1,
    }
}

fn sample_commitment_position(
    campaign: Pubkey,
    ledger: Pubkey,
    payment_asset_mint: Pubkey,
    coverage_asset_mint: Pubkey,
    amount: u64,
    coverage_amount: u64,
) -> CommitmentPosition {
    CommitmentPosition {
        campaign,
        ledger,
        depositor: Pubkey::new_unique(),
        beneficiary: Pubkey::new_unique(),
        payment_asset_mint,
        coverage_asset_mint,
        amount,
        coverage_amount,
        queue_index: 0,
        state: COMMITMENT_POSITION_PENDING,
        accepted_terms_hash: [1u8; 32],
        paid_at: 100,
        activated_at: 0,
        refunded_at: 0,
        bump: 1,
    }
}

#[test]
fn pending_commitment_deposit_stays_out_of_reserve_sheets() {
    let mut vault_total_assets = 0;
    let mut domain_sheet = ReserveBalanceSheet::default();
    let mut plan_sheet = ReserveBalanceSheet::default();
    let mut funding_line_sheet = ReserveBalanceSheet::default();

    book_inflow(&mut vault_total_assets, 159_000_000).unwrap();

    assert_eq!(vault_total_assets, 159_000_000);
    assert_eq!(domain_sheet, ReserveBalanceSheet::default());
    assert_eq!(plan_sheet, ReserveBalanceSheet::default());
    assert_eq!(funding_line_sheet, ReserveBalanceSheet::default());

    book_inflow_sheet(&mut domain_sheet, 159_000_000).unwrap();
    book_inflow_sheet(&mut plan_sheet, 159_000_000).unwrap();
    book_inflow_sheet(&mut funding_line_sheet, 159_000_000).unwrap();

    assert_eq!(domain_sheet.funded, 159_000_000);
    assert_eq!(plan_sheet.funded, 159_000_000);
    assert_eq!(funding_line_sheet.funded, 159_000_000);
}

#[test]
fn commitment_activation_and_refund_are_one_way_states() {
    let campaign = Pubkey::new_unique();
    let ledger_key = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut ledger = sample_commitment_ledger(campaign, asset_mint);
    ledger.pending_amount = 159_000_000;
    let mut position =
        sample_commitment_position(campaign, ledger_key, asset_mint, asset_mint, 159_000_000, 0);

    commitments::require_pending_commitment_position(&position).unwrap();
    commitments::activate_commitment_position_at(
        &mut ledger,
        &mut position,
        COMMITMENT_POSITION_DIRECT_PREMIUM_ACTIVATED,
        159_000_000,
        200,
    )
    .unwrap();

    assert_eq!(ledger.pending_amount, 0);
    assert_eq!(ledger.activated_amount, 159_000_000);
    assert_eq!(position.state, COMMITMENT_POSITION_DIRECT_PREMIUM_ACTIVATED);
    assert!(commitments::require_pending_commitment_position(&position).is_err());

    position.state = COMMITMENT_POSITION_REFUNDED;
    assert!(commitments::require_pending_commitment_position(&position).is_err());
}

#[test]
fn treasury_credit_locks_only_existing_stable_capacity() {
    let mut stable_sheet = ReserveBalanceSheet::default();
    assert!(book_restricted_sheet(&mut stable_sheet, 159_000_000).is_err());
    assert_eq!(stable_sheet, ReserveBalanceSheet::default());

    book_inflow_sheet(&mut stable_sheet, 250_000_000).unwrap();
    book_restricted_sheet(&mut stable_sheet, 159_000_000).unwrap();

    assert_eq!(stable_sheet.funded, 250_000_000);
    assert_eq!(stable_sheet.restricted, 159_000_000);
    assert_eq!(stable_sheet.free, 91_000_000);
}

#[test]
fn treasury_credit_commitment_never_counts_omegax_as_stable_reserve() {
    let omegax_mint = Pubkey::new_unique();
    let stable_mint = Pubkey::new_unique();
    let campaign = Pubkey::new_unique();
    let ledger_key = Pubkey::new_unique();
    let mut omegax_vault_total_assets = 0;
    let mut stable_sheet = ReserveBalanceSheet::default();
    let mut ledger = sample_commitment_ledger(campaign, omegax_mint);
    let mut position = sample_commitment_position(
        campaign,
        ledger_key,
        omegax_mint,
        stable_mint,
        10_000_000_000,
        159_000_000,
    );

    book_inflow(&mut omegax_vault_total_assets, position.amount).unwrap();
    ledger.pending_amount = position.amount;
    assert_eq!(stable_sheet.funded, 0);

    book_inflow_sheet(&mut stable_sheet, 159_000_000).unwrap();
    book_restricted_sheet(&mut stable_sheet, position.coverage_amount).unwrap();
    commitments::activate_commitment_position_at(
        &mut ledger,
        &mut position,
        COMMITMENT_POSITION_TREASURY_LOCKED,
        10_000_000_000,
        200,
    )
    .unwrap();

    assert_eq!(omegax_vault_total_assets, 10_000_000_000);
    assert_eq!(stable_sheet.funded, 159_000_000);
    assert_eq!(stable_sheet.restricted, 159_000_000);
    assert_eq!(ledger.treasury_locked_amount, 10_000_000_000);
    assert_eq!(ledger.activated_amount, 0);
}

#[test]
fn reserve_asset_capacity_requires_published_price() {
    let mut rail = ReserveAssetRail {
        reserve_domain: Pubkey::new_unique(),
        asset_mint: Pubkey::new_unique(),
        oracle_authority: Pubkey::new_unique(),
        asset_symbol: "OMEGAX".to_string(),
        role: RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT,
        payout_priority: 4,
        oracle_source: RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_STREAM,
        oracle_feed_id: [7u8; 32],
        max_staleness_seconds: 0,
        haircut_bps: 5_000,
        max_exposure_bps: 1_000,
        deposit_enabled: true,
        payout_enabled: true,
        capacity_enabled: true,
        active: true,
        last_price_usd_1e8: 0,
        last_price_confidence_bps: 0,
        last_price_published_at_ts: 0,
        last_price_slot: 0,
        last_price_proof_hash: [0u8; 32],
        audit_nonce: 0,
        bump: 1,
    };

    assert!(reserve_waterfall::require_reserve_asset_rail_capacity_enabled(&rail).is_err());

    rail.last_price_usd_1e8 = 42_000_000;
    assert!(reserve_waterfall::require_reserve_asset_rail_capacity_enabled(&rail).is_ok());
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
        attestation_count: 0,
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

#[allow(dead_code)]
fn sample_outcome_schema(schema_key_hash: [u8; 32], verified: bool) -> OutcomeSchema {
    OutcomeSchema {
        publisher: Pubkey::new_unique(),
        schema_key_hash,
        schema_key: "claims.schema.v1".to_string(),
        version: 1,
        schema_hash: [4; 32],
        schema_family: SCHEMA_FAMILY_CLAIMS_CODING,
        visibility: SCHEMA_VISIBILITY_PUBLIC,
        metadata_uri: String::new(),
        verified,
        created_at_ts: 0,
        updated_at_ts: 0,
        bump: 1,
    }
}

#[allow(dead_code)]
fn sample_liquidity_pool(reserve_domain: Pubkey, asset_mint: Pubkey) -> LiquidityPool {
    LiquidityPool {
        reserve_domain,
        curator: Pubkey::new_unique(),
        allocator: Pubkey::new_unique(),
        sentinel: Pubkey::new_unique(),
        pool_id: "pool-001".to_string(),
        display_name: "Protection pool".to_string(),
        deposit_asset_mint: asset_mint,
        strategy_hash: [0; 32],
        allowed_exposure_hash: [0; 32],
        external_yield_adapter_hash: [0; 32],
        fee_bps: 0,
        redemption_policy: REDEMPTION_POLICY_OPEN,
        pause_flags: 0,
        total_value_locked: 0,
        total_allocated: 0,
        total_reserved: 0,
        total_impaired: 0,
        total_pending_redemptions: 0,
        active: true,
        audit_nonce: 0,
        bump: 1,
    }
}

#[allow(dead_code)]
fn sample_capital_class(reserve_domain: Pubkey, liquidity_pool: Pubkey) -> CapitalClass {
    CapitalClass {
        reserve_domain,
        liquidity_pool,
        share_mint: Pubkey::new_unique(),
        class_id: "open-class".to_string(),
        display_name: "Open class".to_string(),
        priority: 0,
        impairment_rank: 0,
        restriction_mode: CAPITAL_CLASS_RESTRICTION_OPEN,
        redemption_terms_mode: REDEMPTION_POLICY_OPEN,
        wrapper_metadata_hash: [0; 32],
        permissioning_hash: [0; 32],
        fee_bps: 0,
        min_lockup_seconds: 0,
        pause_flags: 0,
        queue_only_redemptions: false,
        total_shares: 0,
        nav_assets: 0,
        allocated_assets: 0,
        reserved_assets: 0,
        impaired_assets: 0,
        pending_redemptions: 0,
        active: true,
        bump: 1,
    }
}

#[allow(dead_code)]
fn sample_allocation_position(
    reserve_domain: Pubkey,
    liquidity_pool: Pubkey,
    capital_class: Pubkey,
    health_plan: Pubkey,
    policy_series: Pubkey,
    funding_line: Pubkey,
) -> AllocationPosition {
    AllocationPosition {
        reserve_domain,
        liquidity_pool,
        capital_class,
        health_plan,
        policy_series,
        funding_line,
        cap_amount: 100,
        weight_bps: 10_000,
        allocation_mode: 0,
        allocated_amount: 100,
        utilized_amount: 0,
        reserved_capacity: 0,
        realized_pnl: 0,
        impaired_amount: 0,
        deallocation_only: false,
        active: true,
        bump: 1,
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
fn oracle_profile_schema_support_rejects_empty_schema_set() {
    let schema_key_hash = [7; 32];
    let oracle_profile = oracle_profile_with_supported_schemas(&[]);

    assert!(!oracle_profile_supports_schema(
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

#[test]
fn claim_evidence_locks_after_first_attestation() {
    let mut claim_case = sample_claim_case(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    assert!(claims::require_claim_evidence_mutable(&claim_case).is_ok());

    claim_case.attestation_count = 1;
    let error = claims::require_claim_evidence_mutable(&claim_case).unwrap_err();
    assert!(error
        .to_string()
        .contains("Claim evidence cannot be changed after attestations begin"));
}

#[test]
fn claim_attestation_common_rejects_pause_evidence_and_unverified_schema_gaps() {
    let health_plan_key = Pubkey::new_unique();
    let funding_line_key = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let governance_authority = Pubkey::new_unique();
    let mut governance = sample_governance(governance_authority);
    let mut health_plan = sample_health_plan_roles(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    health_plan.reserve_domain = Pubkey::new_unique();
    let funding_line = sample_funding_line(
        health_plan.reserve_domain,
        health_plan_key,
        policy_series,
        asset_mint,
        FUNDING_LINE_TYPE_PREMIUM_INCOME,
    );
    let mut claim_case =
        sample_claim_case(health_plan_key, policy_series, funding_line_key, asset_mint);
    claim_case.evidence_ref_hash = [5; 32];
    let schema_key_hash = [6; 32];
    let schema = sample_outcome_schema(schema_key_hash, true);
    let oracle_profile = oracle_profile_with_supported_schemas(&[schema_key_hash]);
    health_plan.oracle_authority = oracle_profile.oracle;
    let args = AttestClaimCaseArgs {
        decision: CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE,
        attestation_hash: [7; 32],
        attestation_ref_hash: [5; 32],
        schema_key_hash,
    };

    assert!(claims::validate_claim_attestation_common(
        &governance,
        health_plan_key,
        &health_plan,
        funding_line_key,
        &funding_line,
        &claim_case,
        &schema,
        &oracle_profile,
        &args,
    )
    .is_ok());

    governance.emergency_pause = true;
    assert!(claims::validate_claim_attestation_common(
        &governance,
        health_plan_key,
        &health_plan,
        funding_line_key,
        &funding_line,
        &claim_case,
        &schema,
        &oracle_profile,
        &args,
    )
    .unwrap_err()
    .to_string()
    .contains("Protocol governance is emergency paused"));

    governance.emergency_pause = false;
    health_plan.pause_flags = PAUSE_FLAG_ORACLE_FINALITY_HOLD;
    assert!(claims::validate_claim_attestation_common(
        &governance,
        health_plan_key,
        &health_plan,
        funding_line_key,
        &funding_line,
        &claim_case,
        &schema,
        &oracle_profile,
        &args,
    )
    .unwrap_err()
    .to_string()
    .contains("paused oracle finality"));

    health_plan.pause_flags = 0;
    let mut mismatched_args = args.clone();
    mismatched_args.attestation_ref_hash = [9; 32];
    assert!(claims::validate_claim_attestation_common(
        &governance,
        health_plan_key,
        &health_plan,
        funding_line_key,
        &funding_line,
        &claim_case,
        &schema,
        &oracle_profile,
        &mismatched_args,
    )
    .unwrap_err()
    .to_string()
    .contains("evidence reference does not match"));

    let draft_schema = sample_outcome_schema(schema_key_hash, false);
    assert!(claims::validate_claim_attestation_common(
        &governance,
        health_plan_key,
        &health_plan,
        funding_line_key,
        &funding_line,
        &claim_case,
        &draft_schema,
        &oracle_profile,
        &args,
    )
    .unwrap_err()
    .to_string()
    .contains("schema must be governance verified"));

    let unapproved_oracle_profile = oracle_profile_with_supported_schemas(&[schema_key_hash]);
    assert!(claims::validate_claim_attestation_common(
        &governance,
        health_plan_key,
        &health_plan,
        funding_line_key,
        &funding_line,
        &claim_case,
        &schema,
        &unapproved_oracle_profile,
        &args,
    )
    .unwrap_err()
    .to_string()
    .contains("Caller is not authorized"));
}

#[test]
fn lp_claim_attestation_scope_requires_pool_permission() {
    let reserve_domain = Pubkey::new_unique();
    let health_plan_key = Pubkey::new_unique();
    let policy_series = Pubkey::new_unique();
    let asset_mint = Pubkey::new_unique();
    let mut health_plan = sample_health_plan_roles(
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
        Pubkey::new_unique(),
    );
    health_plan.reserve_domain = reserve_domain;
    let funding_line = sample_funding_line(
        reserve_domain,
        health_plan_key,
        policy_series,
        asset_mint,
        FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
    );
    let (funding_line_key, _) = Pubkey::find_program_address(
        &[
            SEED_FUNDING_LINE,
            health_plan_key.as_ref(),
            funding_line.line_id.as_bytes(),
        ],
        &crate::ID,
    );
    let claim_case =
        sample_claim_case(health_plan_key, policy_series, funding_line_key, asset_mint);
    let oracle_profile = oracle_profile_with_supported_schemas(&[]);
    let liquidity_pool = sample_liquidity_pool(reserve_domain, asset_mint);
    let (liquidity_pool_key, _) = Pubkey::find_program_address(
        &[
            SEED_LIQUIDITY_POOL,
            reserve_domain.as_ref(),
            liquidity_pool.pool_id.as_bytes(),
        ],
        &crate::ID,
    );
    let capital_class = sample_capital_class(reserve_domain, liquidity_pool_key);
    let (capital_class_key, _) = Pubkey::find_program_address(
        &[
            SEED_CAPITAL_CLASS,
            liquidity_pool_key.as_ref(),
            capital_class.class_id.as_bytes(),
        ],
        &crate::ID,
    );
    let allocation_position = sample_allocation_position(
        reserve_domain,
        liquidity_pool_key,
        capital_class_key,
        health_plan_key,
        policy_series,
        funding_line_key,
    );
    let (allocation_position_key, _) = Pubkey::find_program_address(
        &[
            SEED_ALLOCATION_POSITION,
            capital_class_key.as_ref(),
            funding_line_key.as_ref(),
        ],
        &crate::ID,
    );
    let (pool_oracle_approval_key, _) = Pubkey::find_program_address(
        &[
            SEED_POOL_ORACLE_APPROVAL,
            liquidity_pool_key.as_ref(),
            oracle_profile.oracle.as_ref(),
        ],
        &crate::ID,
    );
    let approval = PoolOracleApproval {
        liquidity_pool: liquidity_pool_key,
        oracle: oracle_profile.oracle,
        active: true,
        updated_at_ts: 0,
        bump: 1,
    };
    let (pool_oracle_permission_set_key, _) = Pubkey::find_program_address(
        &[
            SEED_POOL_ORACLE_PERMISSION_SET,
            liquidity_pool_key.as_ref(),
            oracle_profile.oracle.as_ref(),
        ],
        &crate::ID,
    );
    let mut permission_set = PoolOraclePermissionSet {
        liquidity_pool: liquidity_pool_key,
        oracle: oracle_profile.oracle,
        permissions: 0,
        updated_at_ts: 0,
        bump: 1,
    };
    let (pool_oracle_policy_key, _) = Pubkey::find_program_address(
        &[SEED_POOL_ORACLE_POLICY, liquidity_pool_key.as_ref()],
        &crate::ID,
    );
    let policy = PoolOraclePolicy {
        liquidity_pool: liquidity_pool_key,
        quorum_m: 1,
        quorum_n: 1,
        require_verified_schema: true,
        oracle_fee_bps: 0,
        allow_delegate_claim: false,
        challenge_window_secs: 0,
        updated_at_ts: 0,
        bump: 1,
    };

    let error = claims::validate_lp_claim_attestation_scope(
        &health_plan,
        &funding_line,
        &claim_case,
        &oracle_profile,
        claims::ClaimAttestationPoolScope {
            liquidity_pool_key,
            liquidity_pool: &liquidity_pool,
            capital_class_key,
            capital_class: &capital_class,
            allocation_position_key,
            allocation_position: &allocation_position,
            funding_line_key,
            pool_oracle_approval_key,
            pool_oracle_approval: &approval,
            pool_oracle_permission_set_key,
            pool_oracle_permission_set: &permission_set,
            pool_oracle_policy_key,
            pool_oracle_policy: &policy,
        },
    )
    .unwrap_err();
    assert!(error
        .to_string()
        .contains("Pool oracle permission is required"));

    permission_set.permissions = POOL_ORACLE_PERMISSION_ATTEST_CLAIM;
    assert!(claims::validate_lp_claim_attestation_scope(
        &health_plan,
        &funding_line,
        &claim_case,
        &oracle_profile,
        claims::ClaimAttestationPoolScope {
            liquidity_pool_key,
            liquidity_pool: &liquidity_pool,
            capital_class_key,
            capital_class: &capital_class,
            allocation_position_key,
            allocation_position: &allocation_position,
            funding_line_key,
            pool_oracle_approval_key,
            pool_oracle_approval: &approval,
            pool_oracle_permission_set_key,
            pool_oracle_permission_set: &permission_set,
            pool_oracle_policy_key,
            pool_oracle_policy: &policy,
        },
    )
    .is_ok());
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

#[test]
fn fee_accrual_removes_inflow_fee_from_reserve_capacity_before_withdrawal() {
    let mut sheet = ReserveBalanceSheet::default();
    book_inflow_sheet(&mut sheet, 1_000).unwrap();

    book_fee_accrual_sheet(&mut sheet, 50).unwrap();

    assert_eq!(sheet.funded, 950);
    assert_eq!(sheet.free, 950);
    assert_eq!(sheet.redeemable, 950);

    let mut domain_assets = 1_000;
    book_fee_withdrawal(&mut domain_assets, 50).unwrap();

    assert_eq!(domain_assets, 950);
    assert_eq!(sheet.funded, 950);
    assert_eq!(sheet.free, 950);
}

#[test]
fn settlement_origin_fee_withdrawal_does_not_double_debit_domain_sheet() {
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
    funding_line.reserved_amount = 100;

    let mut domain_assets = 1_000;
    let mut domain_sheet = ReserveBalanceSheet {
        funded: 1_000,
        claimable: 100,
        free: 900,
        redeemable: 900,
        ..ReserveBalanceSheet::default()
    };
    let mut plan_sheet = domain_sheet;
    let mut line_sheet = domain_sheet;

    book_settlement_from_delivery(
        &mut domain_assets,
        &mut domain_sheet,
        &mut plan_sheet,
        &mut line_sheet,
        None,
        None,
        None,
        None,
        &mut funding_line,
        100,
    )
    .unwrap();

    let fee_kept_in_custody = 10;
    domain_assets = checked_add(domain_assets, fee_kept_in_custody).unwrap();
    assert_eq!(domain_assets, 910);
    assert_eq!(domain_sheet.funded, 900);
    assert_eq!(domain_sheet.settled, 100);

    book_fee_withdrawal(&mut domain_assets, fee_kept_in_custody).unwrap();

    assert_eq!(domain_assets, 900);
    assert_eq!(domain_sheet.funded, 900);
    assert_eq!(domain_sheet.settled, 100);
}

#[test]
fn allocation_ledger_settlement_does_not_require_funded_balance() {
    let mut sheet = ReserveBalanceSheet {
        allocated: 1_000,
        reserved: 500,
        owed: 500,
        free: 0,
        redeemable: 0,
        ..ReserveBalanceSheet::default()
    };

    settle_from_allocation_sheet(&mut sheet, OBLIGATION_DELIVERY_MODE_PAYABLE, 500).unwrap();

    assert_eq!(sheet.funded, 0);
    assert_eq!(sheet.allocated, 1_000);
    assert_eq!(sheet.reserved, 0);
    assert_eq!(sheet.owed, 0);
    assert_eq!(sheet.settled, 500);
}

#[test]
fn redemption_origin_fee_withdrawal_does_not_double_debit_domain_sheet() {
    let mut domain_assets = 1_000;
    let mut domain_sheet = ReserveBalanceSheet::default();
    book_inflow_sheet(&mut domain_sheet, 1_000).unwrap();
    book_pending_redemption(&mut domain_sheet, 100).unwrap();

    let asset_amount = 100;
    let exit_fee = 10;
    let net_to_lp = checked_sub(asset_amount, exit_fee).unwrap();
    domain_assets = checked_sub(domain_assets, net_to_lp).unwrap();
    settle_pending_redemption_domain(&mut domain_sheet, asset_amount).unwrap();

    assert_eq!(domain_assets, 910);
    assert_eq!(domain_sheet.funded, 900);
    assert_eq!(domain_sheet.settled, 100);

    book_fee_withdrawal(&mut domain_assets, exit_fee).unwrap();

    assert_eq!(domain_assets, 900);
    assert_eq!(domain_sheet.funded, 900);
    assert_eq!(domain_sheet.settled, 100);
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
