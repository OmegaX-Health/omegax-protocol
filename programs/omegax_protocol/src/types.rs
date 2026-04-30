// SPDX-License-Identifier: AGPL-3.0-or-later

//! Small internal enum-like discriminants used by events and helpers.

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
