// SPDX-License-Identifier: AGPL-3.0-or-later

//! Public constants, seeds, mode values, and pause flags for the protocol surface.

use crate::platform::*;

pub const MAX_ID_LEN: usize = 32;
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_LONG_NAME_LEN: usize = 96;
pub const MAX_URI_LEN: usize = 160;
pub const MAX_ORG_REF_LEN: usize = 64;
pub const BASIS_POINTS_DENOMINATOR: u16 = 10_000;

pub const SEED_RESERVE_DOMAIN: &[u8] = b"reserve_domain";
pub const SEED_DOMAIN_ASSET_VAULT: &[u8] = b"domain_asset_vault";
pub const SEED_DOMAIN_ASSET_VAULT_TOKEN: &[u8] = b"domain_asset_vault_token";
pub const SEED_DOMAIN_ASSET_LEDGER: &[u8] = b"domain_asset_ledger";
pub const SEED_HEALTH_PLAN: &[u8] = b"health_plan";
pub const SEED_PLAN_RESERVE_LEDGER: &[u8] = b"plan_reserve_ledger";
pub const SEED_POLICY_SERIES: &[u8] = b"policy_series";
pub const SEED_FUNDING_LINE: &[u8] = b"funding_line";
pub const SEED_FUNDING_LINE_LEDGER: &[u8] = b"funding_line_ledger";
pub const SEED_CLAIM_CASE: &[u8] = b"claim_case";
pub const SEED_OBLIGATION: &[u8] = b"obligation";

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
pub const FUNDING_LINE_TYPE_BACKSTOP: u8 = 3;
pub const FUNDING_LINE_TYPE_SUBSIDY: u8 = 4;

pub(crate) fn is_supported_funding_line_type(line_type: u8) -> bool {
    matches!(
        line_type,
        FUNDING_LINE_TYPE_SPONSOR_BUDGET
            | FUNDING_LINE_TYPE_PREMIUM_INCOME
            | FUNDING_LINE_TYPE_BACKSTOP
            | FUNDING_LINE_TYPE_SUBSIDY
    )
}

pub const FUNDING_LINE_STATUS_OPEN: u8 = 0;
pub const FUNDING_LINE_STATUS_PAUSED: u8 = 1;
pub const FUNDING_LINE_STATUS_CLOSED: u8 = 2;

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

pub const PAUSE_FLAG_PROTOCOL_EMERGENCY: u32 = 1 << 0;
pub const PAUSE_FLAG_DOMAIN_RAILS: u32 = 1 << 1;
pub const PAUSE_FLAG_PLAN_OPERATIONS: u32 = 1 << 2;
pub const PAUSE_FLAG_CLAIM_INTAKE: u32 = 1 << 3;
pub const PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS: u32 = 1 << 4;
pub const PAUSE_FLAG_REDEMPTION_QUEUE_ONLY: u32 = 1 << 5;
pub const PAUSE_FLAG_ORACLE_FINALITY_HOLD: u32 = 1 << 6;
pub const PAUSE_FLAG_ALLOCATION_FREEZE: u32 = 1 << 7;

pub const ZERO_PUBKEY: Pubkey = Pubkey::new_from_array([0u8; 32]);
