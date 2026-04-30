// SPDX-License-Identifier: AGPL-3.0-or-later

//! Public event types emitted by the protocol.

use anchor_lang::prelude::*;

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
pub struct CommitmentCampaignCreatedEvent {
    pub campaign: Pubkey,
    pub health_plan: Pubkey,
    pub funding_line: Pubkey,
    pub payment_asset_mint: Pubkey,
    pub coverage_asset_mint: Pubkey,
    pub mode: u8,
}

#[event]
pub struct CommitmentDepositedEvent {
    pub campaign: Pubkey,
    pub position: Pubkey,
    pub depositor: Pubkey,
    pub beneficiary: Pubkey,
    pub amount: u64,
    pub queue_index: u64,
}

#[event]
pub struct CommitmentActivatedEvent {
    pub campaign: Pubkey,
    pub position: Pubkey,
    pub beneficiary: Pubkey,
    pub payment_amount: u64,
    pub coverage_amount: u64,
    pub mode: u8,
}

#[event]
pub struct CommitmentRefundedEvent {
    pub campaign: Pubkey,
    pub position: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CommitmentCampaignStatusChangedEvent {
    pub campaign: Pubkey,
    pub status: u8,
    pub authority: Pubkey,
    pub reason_hash: [u8; 32],
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
    pub fee_recipient: Pubkey,
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
    pub configured_recipient: Pubkey,
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
