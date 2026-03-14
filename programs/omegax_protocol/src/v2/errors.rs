// SPDX-License-Identifier: AGPL-3.0-or-later

//! Error codes returned by the v2 protocol surface.

use super::*;

#[error_code]
pub enum OmegaXProtocolV2Error {
    #[msg("Invalid protocol fee basis points")]
    InvalidProtocolFee,
    #[msg("Invalid oracle fee basis points")]
    InvalidOracleFee,
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Pool id exceeds maximum seed length")]
    PoolIdTooLong,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid stake mint")]
    InvalidStakeMint,
    #[msg("Invalid stake position state")]
    InvalidStakePosition,
    #[msg("Stake vault mismatch")]
    StakeVaultMismatch,
    #[msg("Oracle has insufficient stake")]
    OracleInsufficientStake,
    #[msg("Insufficient stake balance")]
    InsufficientStakeBalance,
    #[msg("No pending unstake")]
    NoPendingUnstake,
    #[msg("Unstake cooldown not met")]
    UnstakeCooldownNotMet,
    #[msg("Invalid cooldown")]
    InvalidCooldown,
    #[msg("Governance unauthorized")]
    GovernanceUnauthorized,
    #[msg("Invalid governance authority")]
    InvalidGovernanceAuthority,
    #[msg("Invalid governance realm")]
    InvalidGovernanceRealm,
    #[msg("Invalid governance config")]
    InvalidGovernanceConfig,
    #[msg("Invalid emergency governance recovery target")]
    InvalidGovernanceRecoveryTarget,
    #[msg("Metadata URI too long")]
    MetadataUriTooLong,
    #[msg("Invalid pool type")]
    InvalidPoolType,
    #[msg("Invalid quorum configuration")]
    InvalidQuorum,
    #[msg("Schema key too long")]
    SchemaKeyTooLong,
    #[msg("Rule id too long")]
    RuleIdTooLong,
    #[msg("Invite issuer not active")]
    InviteIssuerNotActive,
    #[msg("Invite issuer mismatch")]
    InviteIssuerMismatch,
    #[msg("Permit expired")]
    PermitExpired,
    #[msg("Pool is not open for enrollment")]
    PoolNotOpenForEnrollment,
    #[msg("Invalid membership mode")]
    InvalidMembershipMode,
    #[msg("Invalid membership configuration")]
    InvalidMembershipConfiguration,
    #[msg("Token gate owner mismatch")]
    TokenGateOwnerMismatch,
    #[msg("Token gate mint mismatch")]
    TokenGateMintMismatch,
    #[msg("Token gate balance too low")]
    TokenGateBalanceTooLow,
    #[msg("Pool is not active")]
    PoolNotActive,
    #[msg("Oracle not approved for pool")]
    OracleNotApprovedForPool,
    #[msg("Oracle registry entry is not active")]
    OracleRegistryNotActive,
    #[msg("Membership member mismatch")]
    MembershipMemberMismatch,
    #[msg("Membership not active")]
    MembershipNotActive,
    #[msg("Rule is disabled")]
    RuleDisabled,
    #[msg("Schema is not verified")]
    SchemaUnverified,
    #[msg("Rule hash mismatch")]
    RuleHashMismatch,
    #[msg("Outcome aggregate is already finalized")]
    OutcomeAlreadyFinalized,
    #[msg("Outcome aggregate reached maximum vote window")]
    OracleVoteWindowClosed,
    #[msg("Oracle quorum not met")]
    OracleQuorumNotMet,
    #[msg("Outcome did not pass")]
    OutcomeDidNotPass,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Cycle hash mismatch")]
    CycleHashMismatch,
    #[msg("Delegate not authorized")]
    DelegateNotAuthorized,
    #[msg("Recipient mismatch")]
    RecipientMismatch,
    #[msg("Payout asset not configured")]
    PayoutAssetNotConfigured,
    #[msg("Payout mint mismatch")]
    PayoutMintMismatch,
    #[msg("Payout amount must match pool payout configuration")]
    PayoutAmountMismatch,
    #[msg("Missing asset vault")]
    MissingAssetVault,
    #[msg("Vault token account mismatch")]
    VaultTokenAccountMismatch,
    #[msg("Account pool mismatch")]
    AccountPoolMismatch,
    #[msg("Missing token account")]
    MissingTokenAccount,
    #[msg("Insufficient pool balance")]
    InsufficientPoolBalance,
    #[msg("Payout would violate pool rent reserve")]
    InsufficientPoolRentReserve,
    #[msg("Token account owner mismatch")]
    TokenAccountOwnerMismatch,
    #[msg("Invalid coverage window")]
    InvalidCoverageWindow,
    #[msg("Invalid premium schedule")]
    InvalidPremiumSchedule,
    #[msg("Coverage product name too long")]
    PolicySeriesNameTooLong,
    #[msg("Coverage product metadata URI too long")]
    PolicySeriesMetadataUriTooLong,
    #[msg("Coverage product duration is invalid")]
    PolicySeriesDurationInvalid,
    #[msg("Coverage product premium schedule is invalid")]
    PolicySeriesPremiumScheduleInvalid,
    #[msg("Coverage product is inactive")]
    PolicySeriesInactive,
    #[msg("Coverage product id mismatch")]
    PolicySeriesIdMismatch,
    #[msg("Coverage product update is unauthorized")]
    PolicySeriesAdminUnauthorized,
    #[msg("Coverage product payment option is invalid")]
    PolicySeriesPaymentOptionInvalid,
    #[msg("Coverage product payment option is inactive")]
    PolicySeriesPaymentOptionInactive,
    #[msg("Coverage product does not match the active policy terms")]
    PolicySeriesPolicyMismatch,
    #[msg("Invalid premium period index")]
    InvalidPremiumPeriodIndex,
    #[msg("Coverage is not active")]
    CoverageNotActive,
    #[msg("Premium is delinquent")]
    PremiumDelinquent,
    #[msg("Coverage claim not submitted")]
    CoverageClaimNotSubmitted,
    #[msg("Coverage claimant mismatch")]
    ClaimantMismatch,
    #[msg("Invalid oracle type")]
    InvalidOracleType,
    #[msg("Oracle display name too long")]
    OracleDisplayNameTooLong,
    #[msg("Oracle legal name too long")]
    OracleLegalNameTooLong,
    #[msg("Oracle URL too long")]
    OracleUrlTooLong,
    #[msg("Oracle logo URI too long")]
    OracleLogoUriTooLong,
    #[msg("Oracle webhook URL too long")]
    OracleWebhookUrlTooLong,
    #[msg("Oracle supported schema list exceeds maximum")]
    OracleSupportedSchemaLimitExceeded,
    #[msg("Oracle profile update is unauthorized")]
    OracleProfileUnauthorized,
    #[msg("Oracle key mismatch")]
    OracleKeyMismatch,
    #[msg("Invalid pool status")]
    InvalidPoolStatus,
    #[msg("Pool is closed")]
    PoolClosed,
    #[msg("Liquidity deposits are disabled")]
    LiquidityDepositsDisabled,
    #[msg("Pool liquidity configuration does not match expected pool asset state")]
    LiquidityConfigMismatch,
    #[msg("Pool share mint does not match liquidity configuration")]
    ShareMintMismatch,
    #[msg("Pool share supply is zero")]
    ZeroSharesSupply,
    #[msg("Pool reserves are zero")]
    ZeroReserves,
    #[msg("Insufficient shares out for requested deposit")]
    InsufficientSharesOut,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Pool liquidity bootstrap requires zero TVL")]
    PoolLiquidityRequiresZeroTvl,
    #[msg("Invalid payout asset for liquidity flow")]
    InvalidPayoutAssetForLiquidity,
    #[msg("Schema must be unverified before close")]
    SchemaCloseRequiresUnverified,
    #[msg("Schema close is disabled until dependency tracking is implemented")]
    SchemaCloseDisabled,
    #[msg("Oracle permission denied")]
    OraclePermissionDenied,
    #[msg("Invalid quote signature instruction")]
    InvalidQuoteSignatureInstruction,
    #[msg("Invalid instructions sysvar account")]
    InvalidInstructionSysvar,
    #[msg("Missing quote signature verification instruction")]
    MissingQuoteSignature,
    #[msg("Quote message mismatch")]
    QuoteMessageMismatch,
    #[msg("Insufficient unreserved treasury balance")]
    InsufficientUnreservedTreasuryBalance,
    #[msg("Member and payer must match for this flow")]
    MemberPayerMismatch,
    #[msg("Quoted amount exceeds the configured base payment amount")]
    QuoteAmountExceedsConfiguredBase,
    #[msg("Invalid cycle quote")]
    InvalidCycleQuote,
    #[msg("Quote expired")]
    QuoteExpired,
    #[msg("Member cycle already exists for this period")]
    MemberCycleAlreadyExists,
    #[msg("Member cycle already settled")]
    MemberCycleAlreadySettled,
    #[msg("Commitment is not enabled for this cycle")]
    CycleCommitmentNotEnabled,
    #[msg("Shield is not available for this cycle")]
    ShieldNotAvailable,
    #[msg("Insufficient reserved refund balance")]
    InsufficientReservedRefundBalance,
    #[msg("Insufficient reserved reward balance")]
    InsufficientReservedRewardBalance,
    #[msg("Insufficient reserved redistribution balance")]
    InsufficientReservedRedistributionBalance,
    #[msg("Insufficient reserved coverage-claim balance")]
    InsufficientReservedCoverageClaimBalance,
    #[msg("Cohort settlement root is already finalized")]
    CohortSettlementAlreadyFinalized,
    #[msg("Cohort settlement root must be finalized before claim")]
    CohortSettlementNotFinalized,
    #[msg("Cohort settlement root is invalid")]
    InvalidCohortSettlementRoot,
    #[msg("Cohort hash mismatch")]
    CohortHashMismatch,
    #[msg("Outcome threshold score mismatch")]
    OutcomeThresholdScoreMismatch,
    #[msg("Settled health alpha score does not match the declared outcome")]
    HealthAlphaOutcomeMismatch,
    #[msg("Settled health alpha score is required")]
    HealthAlphaScoreRequired,
    #[msg("Redistribution amount mismatch")]
    RedistributionAmountMismatch,
    #[msg("Cohort claim count exceeded successful member count")]
    CohortClaimCountExceeded,
    #[msg("Invalid program account data")]
    InvalidProgramAccountData,
    #[msg("Organization reference too long")]
    OrganizationRefTooLong,
    #[msg("Invalid pool redemption mode")]
    InvalidPoolRedemptionMode,
    #[msg("Invalid pool claim mode")]
    InvalidPoolClaimMode,
    #[msg("Pool risk control update is unauthorized")]
    PoolRiskControlUnauthorized,
    #[msg("Pool claim intake is paused")]
    PoolClaimIntakePaused,
    #[msg("Pool redemptions are paused")]
    PoolRedemptionsPaused,
    #[msg("Pool redemptions are queue-only")]
    PoolRedemptionsQueueOnly,
    #[msg("Attestation evidence commitment does not match the aggregate")]
    AttestationEvidenceMismatch,
    #[msg("Attestation external reference does not match the aggregate")]
    AttestationExternalReferenceMismatch,
    #[msg("Coverage claim state transition is invalid")]
    InvalidCoverageClaimStateTransition,
    #[msg("Coverage claim family is invalid")]
    InvalidCoverageClaimFamily,
    #[msg("Coverage claim payout exceeds the reserved amount")]
    CoverageClaimPayoutExceedsReservedAmount,
    #[msg("Coverage claim recovery exceeds the paid amount")]
    CoverageClaimRecoveryExceedsPaidAmount,
    #[msg("Coverage claim is already closed")]
    CoverageClaimAlreadyClosed,
    #[msg("Capital class mode is invalid")]
    InvalidCapitalClassMode,
    #[msg("Capital transfer mode is invalid")]
    InvalidCapitalTransferMode,
    #[msg("Schema family is invalid")]
    InvalidSchemaFamily,
    #[msg("Schema visibility is invalid")]
    InvalidSchemaVisibility,
    #[msg("Plan mode is invalid")]
    InvalidPlanMode,
    #[msg("Sponsor mode is invalid")]
    InvalidSponsorMode,
    #[msg("Compliance binding mode is invalid")]
    InvalidComplianceBindingMode,
    #[msg("Compliance provider mode is invalid")]
    InvalidComplianceProviderMode,
    #[msg("Rail mode is invalid")]
    InvalidRailMode,
    #[msg("Compliance binding is required for this action")]
    ComplianceBindingRequired,
    #[msg("Compliance rail restriction blocks this action")]
    ComplianceRailRestriction,
    #[msg("Compliance policy update is unauthorized")]
    CompliancePolicyUnauthorized,
    #[msg("Control-authority update is unauthorized")]
    ControlAuthorityUnauthorized,
    #[msg("Automation mode is invalid")]
    InvalidAutomationMode,
    #[msg("AI role is invalid")]
    InvalidAiRole,
    #[msg("Oracle role is invalid")]
    InvalidOracleRole,
    #[msg("Automation policy update is unauthorized")]
    AutomationPolicyUnauthorized,
    #[msg("Automation metadata is not permitted for this pool")]
    AutomationNotPermitted,
    #[msg("Outcome challenge window is still active")]
    OutcomeChallengeWindowActive,
    #[msg("Outcome is under dispute")]
    OutcomeUnderDispute,
    #[msg("Outcome dispute window is closed")]
    OutcomeDisputeWindowClosed,
    #[msg("Outcome dispute is already open")]
    OutcomeDisputeAlreadyOpen,
    #[msg("Outcome dispute is not open")]
    OutcomeDisputeNotOpen,
    #[msg("Outcome review state is invalid")]
    InvalidOutcomeReviewState,
    #[msg("Redemption request state is invalid")]
    InvalidRedemptionRequestState,
    #[msg("Redemption request action is unauthorized")]
    RedemptionRequestUnauthorized,
    #[msg("Redemption request notice period has not matured")]
    RedemptionRequestNotMatured,
    #[msg("Schema still has enabled pool-rule references")]
    SchemaRuleReferencesOutstanding,
}
