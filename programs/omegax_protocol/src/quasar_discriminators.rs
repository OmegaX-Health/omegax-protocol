// SPDX-License-Identifier: AGPL-3.0-or-later

//! Explicit Quasar discriminators for the public protocol surface.
//!
//! These values are generated from `idl/omegax_protocol.json` so the Quasar
//! migration preserves the existing Anchor instruction/account byte prefixes.

pub mod instruction {
    pub const IX_ADJUDICATE_CLAIM_CASE: [u8; 8] = [146, 99, 255, 26, 223, 88, 235, 114];
    pub const IX_ALLOCATE_CAPITAL: [u8; 8] = [146, 129, 60, 205, 88, 225, 60, 183];
    pub const IX_ATTACH_CLAIM_EVIDENCE_REF: [u8; 8] = [52, 246, 203, 87, 244, 143, 132, 131];
    pub const IX_ATTEST_CLAIM_CASE: [u8; 8] = [111, 40, 46, 51, 76, 157, 214, 136];
    pub const IX_AUTHORIZE_CLAIM_RECIPIENT: [u8; 8] = [112, 97, 129, 42, 125, 165, 226, 163];
    pub const IX_CLAIM_ORACLE: [u8; 8] = [1, 252, 166, 132, 45, 24, 23, 233];
    pub const IX_CONFIGURE_RESERVE_ASSET_RAIL: [u8; 8] = [78, 48, 108, 190, 181, 203, 194, 176];
    pub const IX_CREATE_ALLOCATION_POSITION: [u8; 8] = [165, 80, 76, 13, 12, 202, 112, 31];
    pub const IX_CREATE_CAPITAL_CLASS: [u8; 8] = [0, 161, 244, 112, 151, 137, 35, 221];
    pub const IX_CREATE_DOMAIN_ASSET_VAULT: [u8; 8] = [31, 13, 112, 128, 23, 164, 26, 108];
    pub const IX_CREATE_HEALTH_PLAN: [u8; 8] = [136, 7, 197, 134, 241, 206, 83, 171];
    pub const IX_CREATE_LIQUIDITY_POOL: [u8; 8] = [175, 75, 181, 165, 224, 254, 6, 131];
    pub const IX_CREATE_OBLIGATION: [u8; 8] = [216, 144, 172, 223, 19, 106, 220, 54];
    pub const IX_CREATE_POLICY_SERIES: [u8; 8] = [70, 162, 231, 218, 211, 136, 110, 176];
    pub const IX_CREATE_RESERVE_DOMAIN: [u8; 8] = [222, 2, 8, 218, 45, 157, 193, 246];
    pub const IX_DEALLOCATE_CAPITAL: [u8; 8] = [10, 97, 97, 189, 60, 170, 102, 29];
    pub const IX_DEPOSIT_INTO_CAPITAL_CLASS: [u8; 8] = [40, 215, 33, 115, 185, 101, 196, 167];
    pub const IX_FUND_SPONSOR_BUDGET: [u8; 8] = [150, 210, 161, 31, 50, 12, 224, 32];
    pub const IX_INITIALIZE_SERIES_RESERVE_LEDGER: [u8; 8] =
        [113, 155, 191, 126, 81, 152, 220, 249];
    pub const IX_MARK_IMPAIRMENT: [u8; 8] = [58, 97, 30, 157, 211, 45, 174, 238];
    pub const IX_OPEN_CLAIM_CASE: [u8; 8] = [151, 125, 231, 211, 63, 132, 248, 184];
    pub const IX_OPEN_FUNDING_LINE: [u8; 8] = [231, 140, 66, 127, 163, 1, 197, 9];
    pub const IX_OPEN_MEMBER_POSITION: [u8; 8] = [161, 42, 115, 196, 30, 87, 104, 236];
    pub const IX_PROCESS_REDEMPTION_QUEUE: [u8; 8] = [244, 120, 208, 73, 216, 200, 158, 93];
    pub const IX_PUBLISH_RESERVE_ASSET_RAIL_PRICE: [u8; 8] = [132, 35, 143, 147, 59, 80, 162, 117];
    pub const IX_RECORD_PREMIUM_PAYMENT: [u8; 8] = [196, 182, 182, 56, 146, 87, 170, 29];
    pub const IX_REGISTER_ORACLE: [u8; 8] = [176, 200, 234, 37, 199, 129, 164, 111];
    pub const IX_RELEASE_RESERVE: [u8; 8] = [170, 102, 52, 144, 33, 176, 41, 60];
    pub const IX_REQUEST_REDEMPTION: [u8; 8] = [14, 62, 182, 237, 59, 79, 149, 22];
    pub const IX_RESERVE_OBLIGATION: [u8; 8] = [48, 113, 133, 225, 40, 36, 197, 86];
    pub const IX_SETTLE_CLAIM_CASE: [u8; 8] = [178, 123, 229, 204, 50, 204, 91, 71];
    pub const IX_SETTLE_OBLIGATION: [u8; 8] = [209, 166, 218, 35, 147, 139, 238, 208];
    pub const IX_UPDATE_ALLOCATION_CAPS: [u8; 8] = [224, 101, 103, 146, 78, 5, 48, 132];
    pub const IX_UPDATE_CAPITAL_CLASS_CONTROLS: [u8; 8] = [34, 4, 113, 70, 79, 197, 244, 109];
    pub const IX_UPDATE_HEALTH_PLAN_CONTROLS: [u8; 8] = [108, 11, 28, 140, 226, 164, 239, 113];
    pub const IX_UPDATE_LP_POSITION_CREDENTIALING: [u8; 8] = [54, 194, 211, 94, 197, 61, 228, 202];
    pub const IX_UPDATE_MEMBER_ELIGIBILITY: [u8; 8] = [254, 66, 68, 244, 98, 157, 111, 191];
    pub const IX_UPDATE_ORACLE_PROFILE: [u8; 8] = [175, 66, 157, 51, 96, 190, 163, 98];
    pub const IX_UPDATE_RESERVE_DOMAIN_CONTROLS: [u8; 8] = [3, 60, 38, 233, 198, 167, 116, 197];
    pub const IX_VERSION_POLICY_SERIES: [u8; 8] = [64, 76, 132, 253, 41, 220, 169, 146];
}

pub mod account {
    pub const ACCOUNT_ALLOCATION_LEDGER: [u8; 8] = [53, 81, 62, 163, 68, 200, 187, 50];
    pub const ACCOUNT_ALLOCATION_POSITION: [u8; 8] = [243, 106, 252, 36, 249, 56, 227, 55];
    pub const ACCOUNT_CAPITAL_CLASS: [u8; 8] = [161, 52, 78, 54, 200, 103, 206, 252];
    pub const ACCOUNT_CLAIM_ATTESTATION: [u8; 8] = [93, 71, 134, 41, 234, 89, 150, 80];
    pub const ACCOUNT_CLAIM_CASE: [u8; 8] = [7, 178, 225, 1, 54, 47, 117, 180];
    pub const ACCOUNT_DOMAIN_ASSET_LEDGER: [u8; 8] = [82, 42, 164, 106, 70, 160, 154, 99];
    pub const ACCOUNT_DOMAIN_ASSET_VAULT: [u8; 8] = [105, 110, 75, 179, 247, 58, 135, 229];
    pub const ACCOUNT_FUNDING_LINE: [u8; 8] = [112, 72, 52, 244, 254, 229, 217, 235];
    pub const ACCOUNT_FUNDING_LINE_LEDGER: [u8; 8] = [233, 46, 244, 60, 190, 65, 156, 68];
    pub const ACCOUNT_HEALTH_PLAN: [u8; 8] = [66, 134, 136, 77, 63, 55, 103, 191];
    pub const ACCOUNT_LP_POSITION: [u8; 8] = [196, 56, 115, 198, 14, 117, 32, 224];
    pub const ACCOUNT_LIQUIDITY_POOL: [u8; 8] = [66, 38, 17, 64, 188, 80, 68, 129];
    pub const ACCOUNT_MEMBER_POSITION: [u8; 8] = [88, 118, 224, 251, 240, 186, 123, 175];
    pub const ACCOUNT_OBLIGATION: [u8; 8] = [168, 206, 141, 106, 88, 76, 172, 167];
    pub const ACCOUNT_ORACLE_PROFILE: [u8; 8] = [232, 217, 185, 162, 237, 208, 114, 142];
    pub const ACCOUNT_PLAN_RESERVE_LEDGER: [u8; 8] = [243, 245, 230, 224, 27, 105, 48, 128];
    pub const ACCOUNT_POLICY_SERIES: [u8; 8] = [196, 117, 121, 249, 37, 71, 245, 23];
    pub const ACCOUNT_POOL_CLASS_LEDGER: [u8; 8] = [147, 125, 17, 88, 188, 78, 109, 204];
    pub const ACCOUNT_RESERVE_ASSET_RAIL: [u8; 8] = [48, 92, 233, 170, 158, 126, 122, 67];
    pub const ACCOUNT_RESERVE_DOMAIN: [u8; 8] = [119, 76, 223, 192, 177, 116, 88, 178];
    pub const ACCOUNT_SERIES_RESERVE_LEDGER: [u8; 8] = [0, 109, 195, 30, 140, 79, 210, 234];
}

pub mod event {
    pub const EVENT_ALLOCATION_UPDATED_EVENT: [u8; 8] = [158, 67, 83, 155, 181, 84, 246, 37];
    pub const EVENT_CAPITAL_CLASS_DEPOSIT_EVENT: [u8; 8] = [40, 60, 140, 213, 128, 24, 42, 251];
    pub const EVENT_CLAIM_CASE_ATTESTED_EVENT: [u8; 8] = [27, 131, 74, 180, 134, 39, 214, 103];
    pub const EVENT_CLAIM_CASE_STATE_CHANGED_EVENT: [u8; 8] =
        [162, 195, 160, 236, 219, 18, 240, 208];
    pub const EVENT_FUNDING_FLOW_RECORDED_EVENT: [u8; 8] = [207, 159, 154, 43, 193, 239, 239, 163];
    pub const EVENT_FUNDING_LINE_OPENED_EVENT: [u8; 8] = [47, 172, 14, 218, 139, 94, 10, 145];
    pub const EVENT_HEALTH_PLAN_CREATED_EVENT: [u8; 8] = [160, 200, 242, 77, 168, 222, 253, 22];
    pub const EVENT_IMPAIRMENT_RECORDED_EVENT: [u8; 8] = [16, 0, 176, 178, 185, 80, 121, 39];
    pub const EVENT_LP_POSITION_CREDENTIALING_UPDATED_EVENT: [u8; 8] =
        [215, 90, 105, 53, 22, 8, 19, 82];
    pub const EVENT_LEDGER_INITIALIZED_EVENT: [u8; 8] = [155, 186, 165, 141, 70, 86, 207, 246];
    pub const EVENT_LIQUIDITY_POOL_CREATED_EVENT: [u8; 8] = [176, 183, 7, 238, 193, 97, 177, 135];
    pub const EVENT_OBLIGATION_STATUS_CHANGED_EVENT: [u8; 8] =
        [173, 116, 84, 221, 225, 109, 198, 74];
    pub const EVENT_ORACLE_PROFILE_CLAIMED_EVENT: [u8; 8] = [150, 78, 246, 163, 63, 118, 75, 83];
    pub const EVENT_ORACLE_PROFILE_REGISTERED_EVENT: [u8; 8] =
        [114, 97, 218, 155, 43, 175, 101, 227];
    pub const EVENT_ORACLE_PROFILE_UPDATED_EVENT: [u8; 8] = [187, 146, 36, 213, 31, 160, 208, 86];
    pub const EVENT_POLICY_SERIES_CREATED_EVENT: [u8; 8] = [106, 212, 178, 224, 202, 185, 17, 157];
    pub const EVENT_POLICY_SERIES_VERSIONED_EVENT: [u8; 8] = [37, 154, 96, 209, 46, 91, 162, 255];
    pub const EVENT_REDEMPTION_REQUESTED_EVENT: [u8; 8] = [202, 47, 51, 231, 221, 144, 164, 57];
    pub const EVENT_RESERVE_ASSET_RAIL_CONFIGURED_EVENT: [u8; 8] =
        [33, 112, 220, 210, 144, 2, 40, 234];
    pub const EVENT_RESERVE_ASSET_RAIL_PRICE_PUBLISHED_EVENT: [u8; 8] =
        [161, 207, 64, 197, 138, 47, 213, 44];
    pub const EVENT_RESERVE_DOMAIN_CREATED_EVENT: [u8; 8] = [138, 101, 116, 228, 188, 195, 89, 37];
    pub const EVENT_SCOPED_CONTROL_CHANGED_EVENT: [u8; 8] = [103, 133, 3, 156, 72, 49, 119, 157];
}
