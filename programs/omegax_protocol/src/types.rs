// SPDX-License-Identifier: AGPL-3.0-or-later

//! Small internal enum-like discriminants used by events and helpers.

pub enum ScopeKind {
    ReserveDomain = 0,
    DomainAssetVault = 1,
    HealthPlan = 2,
    PolicySeries = 3,
    FundingLine = 4,
    LiquidityPool = 5,
    CapitalClass = 6,
    AllocationPosition = 7,
}

#[derive(Clone, Copy)]
pub enum FundingFlowKind {
    SponsorBudgetFunded = 0,
    PremiumRecorded = 1,
}
