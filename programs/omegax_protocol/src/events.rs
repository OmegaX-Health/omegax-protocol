// SPDX-License-Identifier: AGPL-3.0-or-later

//! Public event types emitted by the protocol.

use crate::platform::*;

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ReserveDomainCreatedEvent {
    pub reserve_domain: Pubkey,
    pub domain_admin: Pubkey,
    pub settlement_mode: u8,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [138, 101, 116, 228, 188, 195, 89, 37]))]
pub struct ReserveDomainCreatedEvent {
    pub reserve_domain: Address,
    pub domain_admin: Address,
    pub settlement_mode: u8,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct HealthPlanCreatedEvent {
    pub reserve_domain: Pubkey,
    pub health_plan: Pubkey,
    pub sponsor: Pubkey,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [160, 200, 242, 77, 168, 222, 253, 22]))]
pub struct HealthPlanCreatedEvent {
    pub reserve_domain: Address,
    pub health_plan: Address,
    pub sponsor: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct PolicySeriesCreatedEvent {
    pub health_plan: Pubkey,
    pub policy_series: Pubkey,
    pub asset_mint: Pubkey,
    pub mode: u8,
    pub terms_version: u16,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [106, 212, 178, 224, 202, 185, 17, 157]))]
pub struct PolicySeriesCreatedEvent {
    pub health_plan: Address,
    pub policy_series: Address,
    pub asset_mint: Address,
    pub mode: u8,
    pub terms_version: u16,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct PolicySeriesVersionedEvent {
    pub prior_series: Pubkey,
    pub next_series: Pubkey,
    pub new_terms_version: u16,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [37, 154, 96, 209, 46, 91, 162, 255]))]
pub struct PolicySeriesVersionedEvent {
    pub prior_series: Address,
    pub next_series: Address,
    pub new_terms_version: u16,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct FundingLineOpenedEvent {
    pub health_plan: Pubkey,
    pub funding_line: Pubkey,
    pub asset_mint: Pubkey,
    pub line_type: u8,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [47, 172, 14, 218, 139, 94, 10, 145]))]
pub struct FundingLineOpenedEvent {
    pub health_plan: Address,
    pub funding_line: Address,
    pub asset_mint: Address,
    pub line_type: u8,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct FundingFlowRecordedEvent {
    pub funding_line: Pubkey,
    pub amount: u64,
    pub flow_kind: u8,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [207, 159, 154, 43, 193, 239, 239, 163]))]
pub struct FundingFlowRecordedEvent {
    pub funding_line: Address,
    pub amount: u64,
    pub flow_kind: u8,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ReserveAssetRailConfiguredEvent {
    pub reserve_domain: Pubkey,
    pub reserve_asset_rail: Pubkey,
    pub asset_mint: Pubkey,
    pub role: u8,
    pub payout_priority: u8,
    pub oracle_source: u8,
    pub active: bool,
    pub reason_hash: [u8; 32],
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [33, 112, 220, 210, 144, 2, 40, 234]))]
pub struct ReserveAssetRailConfiguredEvent {
    pub reserve_domain: Address,
    pub reserve_asset_rail: Address,
    pub asset_mint: Address,
    pub role: u8,
    pub payout_priority: u8,
    pub oracle_source: u8,
    pub active: bool,
    pub reason_hash: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ReserveAssetRailPricePublishedEvent {
    pub reserve_asset_rail: Pubkey,
    pub asset_mint: Pubkey,
    pub oracle_authority: Pubkey,
    pub price_usd_1e8: u64,
    pub confidence_bps: u16,
    pub published_at_ts: i64,
    pub proof_hash: [u8; 32],
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [161, 207, 64, 197, 138, 47, 213, 44]))]
pub struct ReserveAssetRailPricePublishedEvent {
    pub reserve_asset_rail: Address,
    pub asset_mint: Address,
    pub oracle_authority: Address,
    pub price_usd_1e8: u64,
    pub confidence_bps: u16,
    pub published_at_ts: i64,
    pub proof_hash: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct LiquidityPoolCreatedEvent {
    pub reserve_domain: Pubkey,
    pub liquidity_pool: Pubkey,
    pub asset_mint: Pubkey,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [176, 183, 7, 238, 193, 97, 177, 135]))]
pub struct LiquidityPoolCreatedEvent {
    pub reserve_domain: Address,
    pub liquidity_pool: Address,
    pub asset_mint: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct CapitalClassDepositEvent {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub asset_amount: u64,
    pub shares: u64,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [40, 60, 140, 213, 128, 24, 42, 251]))]
pub struct CapitalClassDepositEvent {
    pub capital_class: Address,
    pub owner: Address,
    pub asset_amount: u64,
    pub shares: u64,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct LPPositionCredentialingUpdatedEvent {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub authority: Pubkey,
    pub credentialed: bool,
    pub reason_hash: [u8; 32],
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [215, 90, 105, 53, 22, 8, 19, 82]))]
pub struct LPPositionCredentialingUpdatedEvent {
    pub capital_class: Address,
    pub owner: Address,
    pub authority: Address,
    pub credentialed: bool,
    pub reason_hash: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct RedemptionRequestedEvent {
    pub capital_class: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub asset_amount: u64,
    pub redemption_sequence: u64,
    pub requested_at_ts: i64,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [202, 47, 51, 231, 221, 144, 164, 57]))]
pub struct RedemptionRequestedEvent {
    pub capital_class: Address,
    pub owner: Address,
    pub shares: u64,
    pub asset_amount: u64,
    pub redemption_sequence: u64,
    pub requested_at_ts: i64,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ObligationStatusChangedEvent {
    pub obligation: Pubkey,
    pub funding_line: Pubkey,
    pub status: u8,
    pub amount: u64,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [173, 116, 84, 221, 225, 109, 198, 74]))]
pub struct ObligationStatusChangedEvent {
    pub obligation: Address,
    pub funding_line: Address,
    pub status: u8,
    pub amount: u64,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ClaimCaseStateChangedEvent {
    pub claim_case: Pubkey,
    pub intake_status: u8,
    pub approved_amount: u64,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [162, 195, 160, 236, 219, 18, 240, 208]))]
pub struct ClaimCaseStateChangedEvent {
    pub claim_case: Address,
    pub intake_status: u8,
    pub approved_amount: u64,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ClaimCaseSelectedAssetPayoutEvent {
    pub claim_case: Pubkey,
    pub claim_asset_mint: Pubkey,
    pub payout_asset_mint: Pubkey,
    pub claim_credit_amount: u64,
    pub payout_amount: u64,
    pub settlement_reason_hash: [u8; 32],
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [15, 13, 219, 43, 68, 58, 135, 157]))]
pub struct ClaimCaseSelectedAssetPayoutEvent {
    pub claim_case: Address,
    pub claim_asset_mint: Address,
    pub payout_asset_mint: Address,
    pub claim_credit_amount: u64,
    pub payout_amount: u64,
    pub settlement_reason_hash: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ClaimCaseAttestedEvent {
    pub claim_attestation: Pubkey,
    pub claim_case: Pubkey,
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub decision: u8,
    pub attestation_hash: [u8; 32],
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [27, 131, 74, 180, 134, 39, 214, 103]))]
pub struct ClaimCaseAttestedEvent {
    pub claim_attestation: Address,
    pub claim_case: Address,
    pub oracle_profile: Address,
    pub oracle: Address,
    pub decision: u8,
    pub attestation_hash: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct AllocationUpdatedEvent {
    pub allocation_position: Pubkey,
    pub capital_class: Pubkey,
    pub funding_line: Pubkey,
    pub allocated_amount: u64,
    pub reserved_capacity: u64,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [158, 67, 83, 155, 181, 84, 246, 37]))]
pub struct AllocationUpdatedEvent {
    pub allocation_position: Address,
    pub capital_class: Address,
    pub funding_line: Address,
    pub allocated_amount: u64,
    pub reserved_capacity: u64,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ImpairmentRecordedEvent {
    pub funding_line: Pubkey,
    pub obligation: Pubkey,
    pub amount: u64,
    pub reason_hash: [u8; 32],
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [16, 0, 176, 178, 185, 80, 121, 39]))]
pub struct ImpairmentRecordedEvent {
    pub funding_line: Address,
    pub obligation: Address,
    pub amount: u64,
    pub reason_hash: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct ScopedControlChangedEvent {
    pub scope_kind: u8,
    pub scope: Pubkey,
    pub authority: Pubkey,
    pub pause_flags: u32,
    pub reason_hash: [u8; 32],
    pub audit_nonce: u64,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [103, 133, 3, 156, 72, 49, 119, 157]))]
pub struct ScopedControlChangedEvent {
    pub scope_kind: u8,
    pub scope: Address,
    pub authority: Address,
    pub pause_flags: u32,
    pub reason_hash: Address,
    pub audit_nonce: u64,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct LedgerInitializedEvent {
    pub scope_kind: u8,
    pub scope: Pubkey,
    pub asset_mint: Pubkey,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [155, 186, 165, 141, 70, 86, 207, 246]))]
pub struct LedgerInitializedEvent {
    pub scope_kind: u8,
    pub scope: Address,
    pub asset_mint: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct OracleProfileRegisteredEvent {
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub admin: Pubkey,
    pub oracle_type: u8,
    pub claimed: bool,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [114, 97, 218, 155, 43, 175, 101, 227]))]
pub struct OracleProfileRegisteredEvent {
    pub oracle_profile: Address,
    pub oracle: Address,
    pub admin: Address,
    pub oracle_type: u8,
    pub claimed: bool,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct OracleProfileClaimedEvent {
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub admin: Pubkey,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [150, 78, 246, 163, 63, 118, 75, 83]))]
pub struct OracleProfileClaimedEvent {
    pub oracle_profile: Address,
    pub oracle: Address,
    pub admin: Address,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct OracleProfileUpdatedEvent {
    pub oracle_profile: Pubkey,
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub oracle_type: u8,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [187, 146, 36, 213, 31, 160, 208, 86]))]
pub struct OracleProfileUpdatedEvent {
    pub oracle_profile: Address,
    pub oracle: Address,
    pub authority: Address,
    pub oracle_type: u8,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct PoolOracleApprovalChangedEvent {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub active: bool,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [159, 43, 209, 60, 32, 191, 5, 136]))]
pub struct PoolOracleApprovalChangedEvent {
    pub liquidity_pool: Address,
    pub oracle: Address,
    pub authority: Address,
    pub active: bool,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct PoolOraclePermissionsChangedEvent {
    pub liquidity_pool: Pubkey,
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub permissions: u32,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [151, 96, 35, 111, 20, 154, 112, 211]))]
pub struct PoolOraclePermissionsChangedEvent {
    pub liquidity_pool: Address,
    pub oracle: Address,
    pub authority: Address,
    pub permissions: u32,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct PoolOraclePolicyChangedEvent {
    pub liquidity_pool: Pubkey,
    pub authority: Pubkey,
    pub quorum_m: u8,
    pub quorum_n: u8,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [142, 195, 149, 88, 218, 243, 91, 84]))]
pub struct PoolOraclePolicyChangedEvent {
    pub liquidity_pool: Address,
    pub authority: Address,
    pub quorum_m: u8,
    pub quorum_n: u8,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct OutcomeSchemaRegisteredEvent {
    pub outcome_schema: Pubkey,
    pub publisher: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub version: u16,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [243, 156, 15, 145, 167, 84, 187, 209]))]
pub struct OutcomeSchemaRegisteredEvent {
    pub outcome_schema: Address,
    pub publisher: Address,
    pub schema_key_hash: Address,
    pub version: u16,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct OutcomeSchemaStateChangedEvent {
    pub outcome_schema: Pubkey,
    pub governance_authority: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub verified: bool,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [79, 241, 101, 121, 94, 199, 61, 228]))]
pub struct OutcomeSchemaStateChangedEvent {
    pub outcome_schema: Address,
    pub governance_authority: Address,
    pub schema_key_hash: Address,
    pub verified: bool,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct SchemaDependencyLedgerUpdatedEvent {
    pub schema_dependency_ledger: Pubkey,
    pub governance_authority: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub dependency_count: u16,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [159, 128, 141, 211, 86, 155, 144, 70]))]
pub struct SchemaDependencyLedgerUpdatedEvent {
    pub schema_dependency_ledger: Address,
    pub governance_authority: Address,
    pub schema_key_hash: Address,
    pub dependency_count: u16,
}

#[cfg(not(feature = "quasar"))]
#[event]
pub struct OutcomeSchemaClosedEvent {
    pub outcome_schema: Pubkey,
    pub governance_authority: Pubkey,
    pub schema_key_hash: [u8; 32],
    pub recipient: Pubkey,
}

#[cfg(feature = "quasar")]
#[cfg_attr(any(), event(discriminator = [16, 92, 224, 187, 114, 106, 105, 41]))]
pub struct OutcomeSchemaClosedEvent {
    pub outcome_schema: Address,
    pub governance_authority: Address,
    pub schema_key_hash: Address,
    pub recipient: Address,
}
