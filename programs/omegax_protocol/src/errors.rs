// SPDX-License-Identifier: AGPL-3.0-or-later

//! Protocol error codes.

use anchor_lang::prelude::*;

#[error_code]
pub enum OmegaXProtocolError {
    #[msg("Caller is not authorized for this scope")]
    Unauthorized,
    #[msg("Governance authority is invalid")]
    InvalidGovernanceAuthority,
    #[msg("Protocol governance is emergency paused")]
    ProtocolEmergencyPaused,
    #[msg("Reserve domain is inactive")]
    ReserveDomainInactive,
    #[msg("Domain asset vault token account is missing or invalid")]
    VaultTokenAccountInvalid,
    #[msg("Health plan is paused")]
    HealthPlanPaused,
    #[msg("Claim intake is paused")]
    ClaimIntakePaused,
    #[msg("Capital subscriptions are paused")]
    CapitalSubscriptionsPaused,
    #[msg("Invalid basis points value")]
    InvalidBps,
    #[msg("Identifier length exceeds the canonical maximum")]
    IdentifierTooLong,
    #[msg("Health plan mismatch")]
    HealthPlanMismatch,
    #[msg("Policy series mismatch")]
    PolicySeriesMismatch,
    #[msg("Policy series is missing where one is required")]
    PolicySeriesMissing,
    #[msg("Unexpected series ledger was provided")]
    SeriesLedgerUnexpected,
    #[msg("Asset mint mismatch")]
    AssetMintMismatch,
    #[msg("Source token account owner does not match the signer")]
    TokenAccountOwnerMismatch,
    #[msg("Source and vault token accounts must be different accounts")]
    TokenAccountSelfTransferInvalid,
    #[msg("Vault token account does not match the domain asset vault")]
    VaultTokenAccountMismatch,
    #[msg("Token-2022 custody rails are not supported by this protocol version")]
    Token2022NotSupported,
    #[msg("Configured fee recipient is missing or invalid")]
    FeeRecipientInvalid,
    #[msg("Fee withdrawal recipient does not match the configured fee recipient")]
    FeeRecipientMismatch,
    #[msg("Funding line mismatch")]
    FundingLineMismatch,
    #[msg("Funding line type mismatch")]
    FundingLineTypeMismatch,
    #[msg("Invalid obligation state transition")]
    InvalidObligationStateTransition,
    #[msg("Amount exceeds outstanding obligation")]
    AmountExceedsOutstandingObligation,
    #[msg("Amount exceeds reserved balance")]
    AmountExceedsReservedBalance,
    #[msg("Amount exceeds approved claim")]
    AmountExceedsApprovedClaim,
    #[msg("Amount must be greater than zero")]
    AmountMustBePositive,
    #[msg("Claim case linkage mismatch")]
    ClaimCaseLinkMismatch,
    #[msg("Linked claims must settle through the obligation path")]
    LinkedClaimMustSettleThroughObligation,
    #[msg("Amount exceeds available shares")]
    AmountExceedsAvailableShares,
    #[msg("Amount exceeds pending redemption")]
    AmountExceedsPendingRedemption,
    #[msg("Redemption amount cannot be derived from the queued share state")]
    InvalidRedemptionAmount,
    #[msg("Deposit shares cannot be derived from the capital class NAV state")]
    InvalidCapitalShareState,
    #[msg("Deposit would mint zero shares")]
    InvalidDepositShares,
    #[msg("Computed deposit shares are below the requested minimum")]
    MinimumSharesOutNotMet,
    #[msg("Restricted capital class access failed")]
    RestrictedCapitalClass,
    #[msg("Capital class ledger mismatch")]
    CapitalClassMismatch,
    #[msg("LP position with active capital cannot be decredentialed")]
    LPPositionHasActiveCapital,
    #[msg("Capital class lockup is still active")]
    LockupActive,
    #[msg("Allocation cap exceeded")]
    AllocationCapExceeded,
    #[msg("Allocation position mismatch")]
    AllocationPositionMismatch,
    #[msg("Insufficient free allocation capacity")]
    InsufficientFreeAllocationCapacity,
    #[msg("Arithmetic overflow or underflow")]
    ArithmeticError,
    #[msg("Membership gate configuration is invalid")]
    MembershipGateConfigurationInvalid,
    #[msg("Membership proof mode does not match the configured plan posture")]
    MembershipProofModeMismatch,
    #[msg("Invite authority is missing or invalid for this plan")]
    MembershipInviteAuthorityInvalid,
    #[msg("Invite permit is expired")]
    MembershipInvitePermitExpired,
    #[msg("Token-gate proof account is missing")]
    MembershipTokenGateAccountMissing,
    #[msg("Token-gate proof account owner does not match the enrolling wallet")]
    MembershipTokenGateOwnerMismatch,
    #[msg("Token-gate proof account mint does not match the configured gate mint")]
    MembershipTokenGateMintMismatch,
    #[msg("Token-gate proof amount is below the configured minimum")]
    MembershipTokenGateAmountTooLow,
    #[msg("Anchor-backed membership requires an anchor seat account")]
    MembershipAnchorSeatRequired,
    #[msg("Anchor-backed membership seat is already active")]
    MembershipAnchorSeatAlreadyActive,
    #[msg("Anchor-backed membership seat does not match the provided anchor reference")]
    MembershipAnchorSeatMismatch,
    #[msg("Anchor-backed membership requires a non-zero anchor reference")]
    MembershipAnchorReferenceMissing,
    #[msg("Bounded string field exceeds the canonical maximum")]
    StringTooLong,
    #[msg("Oracle quorum configuration is invalid")]
    InvalidOracleQuorum,
    #[msg("Too many supported schema hashes were provided for one oracle profile")]
    TooManyOracleSupportedSchemas,
    #[msg("Pool oracle approval is required before permissions can be granted")]
    PoolOracleApprovalRequired,
    #[msg("Oracle profile is inactive")]
    OracleProfileInactive,
    #[msg("Oracle profile has not been claimed by its signing key")]
    OracleProfileUnclaimed,
    #[msg("Claim attestation decision is not a recognized value")]
    InvalidClaimAttestationDecision,
    #[msg("Claim attestation must reference a registered schema key hash")]
    ClaimAttestationSchemaRequired,
    #[msg("Oracle profile does not advertise support for the selected claim-attestation schema")]
    ClaimAttestationSchemaUnsupported,
    #[msg("Too many schema dependency addresses were provided")]
    TooManySchemaDependencies,
    #[msg("Fee vault initialization requires the matching domain asset vault to exist")]
    DomainAssetVaultRequired,
    #[msg("Liquidity pool reference does not match the supplied account")]
    LiquidityPoolMismatch,
    #[msg("Oracle profile reference does not match the supplied account")]
    OracleProfileMismatch,
    #[msg("Fee vault account does not match the expected scope")]
    FeeVaultMismatch,
    #[msg("Fee vault has insufficient accrued balance for this withdrawal")]
    FeeVaultInsufficientBalance,
    #[msg("Fee vault withdrawal would breach the rent-exempt minimum balance")]
    FeeVaultRentExemptionBreach,
    #[msg("Fee vault rail and asset mint disagree (SOL vault used on SPL path or vice versa)")]
    FeeVaultRailMismatch,
    #[msg("Fee vault basis-points configuration is out of range")]
    FeeVaultBpsMisconfigured,
    #[msg("Linked claim settlement requires the member, mint, vault token, recipient token, and token program accounts")]
    SettlementOutflowAccountsRequired,
    #[msg("Configured fee basis points require the matching fee vault account")]
    FeeVaultRequiredForConfiguredFee,
    #[msg("Commitment campaign mode is invalid")]
    InvalidCommitmentCampaignMode,
    #[msg("Commitment campaign status is invalid")]
    InvalidCommitmentCampaignStatus,
    #[msg("Commitment campaign is not active")]
    CommitmentCampaignInactive,
    #[msg("Commitment campaign is not refundable yet")]
    CommitmentNotRefundable,
    #[msg("Commitment position is not pending")]
    CommitmentPositionNotPending,
    #[msg("Commitment terms hash mismatch")]
    CommitmentTermsMismatch,
    #[msg("Commitment cap exceeded")]
    CommitmentCapExceeded,
    #[msg("Commitment activation authority mismatch")]
    CommitmentActivationAuthorityMismatch,
    #[msg("Stable coverage capacity is insufficient")]
    InsufficientStableCoverageCapacity,
    #[msg("Treasury-credit commitments require distinct payment and coverage assets")]
    TreasuryCreditAssetMismatch,
    #[msg("Reserve asset role is invalid")]
    InvalidReserveAssetRole,
    #[msg("Reserve asset oracle source is invalid")]
    InvalidReserveOracleSource,
    #[msg("Reserve asset rail mismatch")]
    ReserveAssetRailMismatch,
    #[msg("Reserve asset rail is inactive")]
    ReserveAssetRailInactive,
    #[msg("Reserve asset rail does not allow deposits")]
    ReserveAssetRailDepositDisabled,
    #[msg("Reserve asset rail does not allow claims payout")]
    ReserveAssetRailPayoutDisabled,
    #[msg("Reserve asset rail cannot count toward claims capacity")]
    ReserveAssetRailCapacityDisabled,
    #[msg("Reserve asset oracle price is stale or missing")]
    ReserveAssetPriceStale,
    #[msg("Reserve asset oracle price is invalid")]
    ReserveAssetPriceInvalid,
    #[msg("Commitment payment rail mismatch")]
    CommitmentPaymentRailMismatch,
    #[msg("Commitment payment rail is inactive")]
    CommitmentPaymentRailInactive,
}
