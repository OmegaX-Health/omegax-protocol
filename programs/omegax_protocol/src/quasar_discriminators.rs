// SPDX-License-Identifier: AGPL-3.0-or-later

//! Explicit Quasar discriminators for the public protocol surface.
//!
//! These values are generated from `idl/omegax_protocol.json` so the Quasar
//! migration preserves the existing Anchor instruction/account byte prefixes.

pub mod instruction {
    pub const IX_ADJUDICATE_CLAIM_CASE: [u8; 8] = [146, 99, 255, 26, 223, 88, 235, 114];
    pub const IX_AUTHORIZE_CLAIM_RECIPIENT: [u8; 8] = [112, 97, 129, 42, 125, 165, 226, 163];
    pub const IX_CREATE_DOMAIN_ASSET_VAULT: [u8; 8] = [31, 13, 112, 128, 23, 164, 26, 108];
    pub const IX_CREATE_HEALTH_PLAN: [u8; 8] = [136, 7, 197, 134, 241, 206, 83, 171];
    pub const IX_CREATE_OBLIGATION: [u8; 8] = [216, 144, 172, 223, 19, 106, 220, 54];
    pub const IX_CREATE_POLICY_SERIES: [u8; 8] = [70, 162, 231, 218, 211, 136, 110, 176];
    pub const IX_CREATE_RESERVE_DOMAIN: [u8; 8] = [222, 2, 8, 218, 45, 157, 193, 246];
    pub const IX_FUND_SPONSOR_BUDGET: [u8; 8] = [150, 210, 161, 31, 50, 12, 224, 32];
    pub const IX_OPEN_CLAIM_CASE: [u8; 8] = [151, 125, 231, 211, 63, 132, 248, 184];
    pub const IX_OPEN_FUNDING_LINE: [u8; 8] = [231, 140, 66, 127, 163, 1, 197, 9];
    pub const IX_RECORD_PREMIUM_PAYMENT: [u8; 8] = [196, 182, 182, 56, 146, 87, 170, 29];
    pub const IX_RELEASE_RESERVE: [u8; 8] = [170, 102, 52, 144, 33, 176, 41, 60];
    pub const IX_RESERVE_OBLIGATION: [u8; 8] = [48, 113, 133, 225, 40, 36, 197, 86];
    pub const IX_SETTLE_CLAIM_CASE: [u8; 8] = [178, 123, 229, 204, 50, 204, 91, 71];
    pub const IX_SETTLE_OBLIGATION: [u8; 8] = [209, 166, 218, 35, 147, 139, 238, 208];
    pub const IX_UPDATE_HEALTH_PLAN_CONTROLS: [u8; 8] = [108, 11, 28, 140, 226, 164, 239, 113];
    pub const IX_UPDATE_RESERVE_DOMAIN_CONTROLS: [u8; 8] = [3, 60, 38, 233, 198, 167, 116, 197];
    pub const IX_VERSION_POLICY_SERIES: [u8; 8] = [64, 76, 132, 253, 41, 220, 169, 146];
}

pub mod account {
    pub const ACCOUNT_CLAIM_CASE: [u8; 8] = [7, 178, 225, 1, 54, 47, 117, 180];
    pub const ACCOUNT_DOMAIN_ASSET_LEDGER: [u8; 8] = [82, 42, 164, 106, 70, 160, 154, 99];
    pub const ACCOUNT_DOMAIN_ASSET_VAULT: [u8; 8] = [105, 110, 75, 179, 247, 58, 135, 229];
    pub const ACCOUNT_FUNDING_LINE: [u8; 8] = [112, 72, 52, 244, 254, 229, 217, 235];
    pub const ACCOUNT_FUNDING_LINE_LEDGER: [u8; 8] = [233, 46, 244, 60, 190, 65, 156, 68];
    pub const ACCOUNT_HEALTH_PLAN: [u8; 8] = [66, 134, 136, 77, 63, 55, 103, 191];
    pub const ACCOUNT_OBLIGATION: [u8; 8] = [168, 206, 141, 106, 88, 76, 172, 167];
    pub const ACCOUNT_PLAN_RESERVE_LEDGER: [u8; 8] = [243, 245, 230, 224, 27, 105, 48, 128];
    pub const ACCOUNT_POLICY_SERIES: [u8; 8] = [196, 117, 121, 249, 37, 71, 245, 23];
    pub const ACCOUNT_RESERVE_DOMAIN: [u8; 8] = [119, 76, 223, 192, 177, 116, 88, 178];
}

pub mod event {
    pub const EVENT_CLAIM_CASE_STATE_CHANGED_EVENT: [u8; 8] =
        [162, 195, 160, 236, 219, 18, 240, 208];
    pub const EVENT_FUNDING_FLOW_RECORDED_EVENT: [u8; 8] = [207, 159, 154, 43, 193, 239, 239, 163];
    pub const EVENT_FUNDING_LINE_OPENED_EVENT: [u8; 8] = [47, 172, 14, 218, 139, 94, 10, 145];
    pub const EVENT_HEALTH_PLAN_CREATED_EVENT: [u8; 8] = [160, 200, 242, 77, 168, 222, 253, 22];
    pub const EVENT_LEDGER_INITIALIZED_EVENT: [u8; 8] = [155, 186, 165, 141, 70, 86, 207, 246];
    pub const EVENT_OBLIGATION_STATUS_CHANGED_EVENT: [u8; 8] =
        [173, 116, 84, 221, 225, 109, 198, 74];
    pub const EVENT_POLICY_SERIES_CREATED_EVENT: [u8; 8] = [106, 212, 178, 224, 202, 185, 17, 157];
    pub const EVENT_POLICY_SERIES_VERSIONED_EVENT: [u8; 8] = [37, 154, 96, 209, 46, 91, 162, 255];
    pub const EVENT_RESERVE_DOMAIN_CREATED_EVENT: [u8; 8] = [138, 101, 116, 228, 188, 195, 89, 37];
    pub const EVENT_SCOPED_CONTROL_CHANGED_EVENT: [u8; 8] = [103, 133, 3, 156, 72, 49, 119, 157];
}
