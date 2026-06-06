// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PublicKey } from "@solana/web3.js";

export type PublicKeyish = PublicKey | string;
export type BigNumberish = bigint | number | string;

export type ReserveBalanceSheet = {
  funded: bigint;
  allocated: bigint;
  reserved: bigint;
  owed: bigint;
  claimable: bigint;
  payable: bigint;
  settled: bigint;
  impaired: bigint;
  pendingRedemption: bigint;
  restricted: bigint;
  free: bigint;
  redeemable: bigint;
};

export type PartialReserveBalanceSheet = Partial<ReserveBalanceSheet> & {
  pending_redemption?: BigNumberish;
};

export type ReserveScopedSnapshot = {
  address: string;
  reserveDomain: string;
  assetMint: string;
  sheet?: PartialReserveBalanceSheet;
};

export type ReserveDomainSnapshot = {
  address: string;
  domainId: string;
  displayName: string;
  domainAdmin?: string;
  settlementMode: number;
  active: boolean;
  pauseFlags?: number;
};

export type DomainAssetVaultSnapshot = {
  address: string;
  reserveDomain: string;
  assetMint: string;
  vaultTokenAccount: string;
  totalAssets: BigNumberish;
  bump: number;
};

export type ReserveAssetRailSnapshot = {
  address: string;
  reserveDomain: string;
  assetMint: string;
  oracleAuthority: string;
  assetSymbol: string;
  role: number;
  payoutPriority: number;
  oracleSource: number;
  oracleFeedIdHex: string;
  maxStalenessSeconds: number;
  maxConfidenceBps: number;
  haircutBps: number;
  maxExposureBps: number;
  depositEnabled: boolean;
  payoutEnabled: boolean;
  capacityEnabled: boolean;
  active: boolean;
  lastPriceUsd1e8: BigNumberish;
  lastPriceConfidenceBps: number;
  lastPricePublishedAtTs: number;
  lastPriceSlot: BigNumberish;
  lastPriceProofHashHex: string;
  auditNonce: BigNumberish;
  bump: number;
};

export type HealthPlanSnapshot = {
  address: string;
  reserveDomain: string;
  planId: string;
  displayName: string;
  sponsorLabel: string;
  planAdmin: string;
  sponsorOperator: string;
  claimsOperator: string;
  oracleAuthority?: string;
  membershipModel: string;
  membershipGateKind?: string;
  membershipModeValue?: number;
  membershipGateKindValue?: number;
  membershipGateMint?: string;
  membershipGateMinAmount?: BigNumberish;
  membershipInviteAuthority?: string;
  pauseFlags?: number;
  active: boolean;
};

export type PolicySeriesSnapshot = {
  address: string;
  healthPlan: string;
  seriesId: string;
  displayName: string;
  metadataUri?: string;
  mode: number;
  status: number;
  assetMint: string;
  cycleSeconds?: number;
  termsVersion: string;
  comparabilityKey: string;
  comparabilityHashHex?: string;
};

export type MemberPositionSnapshot = {
  address: string;
  wallet: string;
  healthPlan: string;
  policySeries: string;
  eligibilityStatus: number;
  delegatedRights: string[];
  active: boolean;
};

export type FundingLineSnapshot = {
  address: string;
  reserveDomain: string;
  healthPlan: string;
  policySeries?: string | null;
  assetMint: string;
  lineId: string;
  displayName: string;
  lineType: number;
  fundingPriority: number;
  fundedAmount: BigNumberish;
  reservedAmount?: BigNumberish;
  spentAmount?: BigNumberish;
  releasedAmount?: BigNumberish;
  returnedAmount?: BigNumberish;
  status: number;
  sheet?: PartialReserveBalanceSheet;
};

export type ClaimCaseSnapshot = {
  address: string;
  reserveDomain: string;
  healthPlan: string;
  policySeries?: string | null;
  fundingLine: string;
  memberPosition: string;
  claimant: string;
  adjudicator?: string | null;
  claimId: string;
  evidenceRefHashHex?: string;
  decisionSupportHashHex?: string;
  intakeStatus: number;
  approvedAmount: BigNumberish;
  deniedAmount?: BigNumberish;
  paidAmount?: BigNumberish;
  reservedAmount?: BigNumberish;
  linkedObligation?: string | null;
};

export type ObligationSnapshot = {
  address: string;
  reserveDomain: string;
  assetMint: string;
  healthPlan: string;
  policySeries?: string | null;
  memberWallet?: string | null;
  beneficiary?: string | null;
  fundingLine: string;
  claimCase?: string | null;
  liquidityPool?: string | null;
  capitalClass?: string | null;
  allocationPosition?: string | null;
  obligationId: string;
  status: number;
  deliveryMode: number;
  principalAmount: BigNumberish;
  outstandingAmount?: BigNumberish;
  reservedAmount?: BigNumberish;
  claimableAmount?: BigNumberish;
  payableAmount?: BigNumberish;
  settledAmount?: BigNumberish;
  impairedAmount?: BigNumberish;
  recoveredAmount?: BigNumberish;
};

export type LiquidityPoolSnapshot = {
  address: string;
  reserveDomain: string;
  curator?: string;
  allocator?: string;
  sentinel?: string;
  poolId: string;
  displayName: string;
  depositAssetMint: string;
  strategyThesis: string;
  strategyHashHex?: string;
  allowedExposureHashHex?: string;
  externalYieldAdapterHashHex?: string;
  redemptionPolicy: number;
  pauseFlags?: number;
  totalValueLocked: BigNumberish;
  totalAllocated?: BigNumberish;
  totalReserved?: BigNumberish;
  totalImpaired?: BigNumberish;
  totalPendingRedemptions?: BigNumberish;
  active: boolean;
};

export type CapitalClassSnapshot = {
  address: string;
  liquidityPool: string;
  classId: string;
  displayName: string;
  priority: number;
  restrictionMode: number;
  totalShares: BigNumberish;
  navAssets: BigNumberish;
  allocatedAssets?: BigNumberish;
  pendingRedemptions?: BigNumberish;
  nextRedemptionSequence?: BigNumberish;
  nextRedemptionToProcess?: BigNumberish;
  minLockupSeconds?: number;
  queueOnlyRedemptions?: boolean;
  active: boolean;
};

export type PoolClassLedgerSnapshot = {
  address: string;
  capitalClass: string;
  assetMint: string;
  sheet: PartialReserveBalanceSheet;
  totalShares: BigNumberish;
  realizedYieldAmount?: BigNumberish;
  realizedLossAmount?: BigNumberish;
};

export type LPPositionSnapshot = {
  address: string;
  owner: string;
  capitalClass: string;
  shares: BigNumberish;
  subscriptionBasis: BigNumberish;
  pendingRedemptionShares?: BigNumberish;
  pendingRedemptionAssets?: BigNumberish;
  realizedDistributions?: BigNumberish;
  impairedPrincipal?: BigNumberish;
  lockupEndsAt?: number;
  credentialed?: boolean;
  queueStatus?: number;
  redemptionSequence?: BigNumberish;
  redemptionRequestedAt?: number;
};

export type AllocationPositionSnapshot = {
  address: string;
  reserveDomain: string;
  liquidityPool: string;
  capitalClass: string;
  healthPlan: string;
  policySeries?: string | null;
  fundingLine: string;
  capAmount: BigNumberish;
  weightBps: number;
  allocatedAmount?: BigNumberish;
  utilizedAmount?: BigNumberish;
  reservedCapacity?: BigNumberish;
  realizedPnl?: BigNumberish;
  impairedAmount?: BigNumberish;
  deallocationOnly?: boolean;
  active: boolean;
};

export type AllocationLedgerSnapshot = {
  address: string;
  allocationPosition: string;
  assetMint: string;
  sheet: PartialReserveBalanceSheet;
  realizedPnl?: BigNumberish;
};

export type ProtocolGovernanceSnapshot = {
  address: string;
  governanceAuthority: string;
  emergencyPause: boolean;
  auditNonce: BigNumberish;
};

export type OracleProfileSnapshot = {
  address: string;
  oracle: string;
  admin: string;
  oracleType: number;
  displayName: string;
  legalName: string;
  websiteUrl: string;
  appUrl: string;
  logoUri: string;
  webhookUrl: string;
  supportedSchemaCount: number;
  supportedSchemaKeyHashesHex: string[];
  active: boolean;
  claimed: boolean;
  createdAtTs: number;
  updatedAtTs: number;
  bump: number;
};

export type OutcomeSchemaSnapshot = {
  address: string;
  publisher: string;
  schemaKeyHashHex: string;
  schemaKey: string;
  version: number;
  schemaHashHex: string;
  schemaFamily: number;
  visibility: number;
  metadataUri: string;
  verified: boolean;
  createdAtTs: number;
  updatedAtTs: number;
  bump: number;
};

export type SchemaDependencyLedgerSnapshot = {
  address: string;
  schemaKeyHashHex: string;
  poolRuleAddresses: string[];
  updatedAtTs: number;
  bump: number;
};

export type ClaimAttestationSnapshot = {
  address: string;
  oracle: string;
  oracleProfile: string;
  claimCase: string;
  healthPlan: string;
  policySeries?: string | null;
  decision: number;
  attestationHashHex: string;
  attestationRefHashHex: string;
  evidenceRefHashHex?: string;
  decisionSupportHashHex?: string;
  schemaKeyHashHex: string;
  schemaHashHex?: string;
  schemaVersion?: number;
  createdAtTs: number;
  updatedAtTs: number;
  bump: number;
};

export type ProtocolConsoleSnapshot = {
  protocolGovernance: ProtocolGovernanceSnapshot | null;
  reserveDomains: ReserveDomainSnapshot[];
  domainAssetVaults: DomainAssetVaultSnapshot[];
  reserveAssetRails: ReserveAssetRailSnapshot[];
  domainAssetLedgers: ReserveScopedSnapshot[];
  healthPlans: HealthPlanSnapshot[];
  policySeries: PolicySeriesSnapshot[];
  memberPositions: MemberPositionSnapshot[];
  fundingLines: FundingLineSnapshot[];
  claimCases: ClaimCaseSnapshot[];
  obligations: ObligationSnapshot[];
  liquidityPools: LiquidityPoolSnapshot[];
  capitalClasses: CapitalClassSnapshot[];
  lpPositions: LPPositionSnapshot[];
  allocationPositions: AllocationPositionSnapshot[];
  planReserveLedgers: ReserveScopedSnapshot[];
  seriesReserveLedgers: ReserveScopedSnapshot[];
  fundingLineLedgers: ReserveScopedSnapshot[];
  poolClassLedgers: PoolClassLedgerSnapshot[];
  allocationLedgers: AllocationLedgerSnapshot[];
  outcomesBySeries: Record<string, bigint>;
  oracleProfiles: OracleProfileSnapshot[];
  outcomeSchemas: OutcomeSchemaSnapshot[];
  schemaDependencyLedgers: SchemaDependencyLedgerSnapshot[];
  claimAttestations: ClaimAttestationSnapshot[];
};

export type SponsorReadModel = {
  healthPlanAddress: string;
  planId: string;
  fundedSponsorBudget: bigint;
  remainingSponsorBudget: bigint;
  accruedRewards: bigint;
  paidRewards: bigint;
  reserveCoverageBps: bigint | null;
  claimCounts: Record<string, number>;
  activeClaimCount: number;
  committedSponsorBudget: bigint;
  perSeriesPerformance: Array<{
    policySeries: string;
    seriesId: string;
    mode: string;
    obligations: number;
    settled: bigint;
    reserved: bigint;
    claimCount: number;
    approvedClaims: bigint;
    paidClaims: bigint;
    costPerOutcome: bigint | null;
  }>;
};

export type CapitalReadModel = {
  liquidityPoolAddress: string;
  poolId: string;
  totalNav: bigint;
  totalAllocated: bigint;
  totalUnallocated: bigint;
  totalPendingRedemptions: bigint;
  classes: Array<{
    capitalClass: string;
    classId: string;
    nav: bigint;
    redeemable: bigint;
    allocated: bigint;
    reservedLiabilities: bigint;
    pendingRedemptions: bigint;
    realizedYield: bigint;
    impairments: bigint;
    restriction: string;
    exposureMix: Array<{
      healthPlan: string;
      policySeries: string | null;
      fundingLine: string;
      allocatedAmount: bigint;
      reservedCapacity: bigint;
      weightBps: number;
    }>;
  }>;
};

export type MixedReserveWaterfallRail = {
  reserveAssetRail: string;
  reserveDomain: string;
  assetMint: string;
  assetSymbol: string;
  role: number;
  payoutPriority: number;
  payoutEnabled: boolean;
  capacityEnabled: boolean;
  active: boolean;
  oracleSource: number;
  oracleFeedIdHex: string;
  priceFresh: boolean;
  priceUsd1e8: bigint;
  freeAmountRaw: bigint;
  haircutBps: number;
  maxExposureBps: number;
  effectiveCapacityUsd1e8: bigint;
};

export type MixedReserveWaterfallModel = {
  reserveDomain: string;
  totalEffectiveCapacityUsd1e8: bigint;
  payoutOrder: MixedReserveWaterfallRail[];
};

export type ClaimFundingReadinessState =
  | "settle_now"
  | "reserve_then_settle"
  | "queue_or_refund"
  | "operator_action_required";

export type ClaimFundingReadinessOtherReserveAsset = {
  reserveAssetRail: string | null;
  reserveDomain: string;
  assetMint: string;
  assetSymbol: string;
  payoutEnabled: boolean;
  payoutPriority: number;
  freeAmountRaw: bigint;
  priceFresh: boolean;
  priceUsd1e8: bigint | null;
  haircutBps: number;
  estimatedValueUsd1e8: bigint | null;
  haircutAdjustedValueUsd1e8: bigint | null;
  immediatelySettleable: false;
  warnings: string[];
};

export type ClaimFundingReadiness = {
  reserveDomain: string | null;
  settlementMint: string;
  requestedAmount: bigint;
  directSettlementAssetCapacityAmount: bigint;
  fundingLineAvailableAmount: bigint;
  immediatelySettleableAmount: bigint;
  reservedOrPayableAmount: bigint;
  pendingObligationsAmount: bigint;
  queuedRedemptionsAmount: bigint;
  availableLpAllocationCapacityAmount: bigint;
  otherReserveAssets: ClaimFundingReadinessOtherReserveAsset[];
  readiness: ClaimFundingReadinessState;
  warnings: string[];
};

export type ClaimFundingReadinessInput = {
  snapshot: Pick<
    ProtocolConsoleSnapshot,
    | "domainAssetVaults"
    | "reserveAssetRails"
    | "domainAssetLedgers"
    | "fundingLines"
    | "obligations"
    | "liquidityPools"
    | "capitalClasses"
    | "lpPositions"
    | "allocationPositions"
  >;
  settlementMint: PublicKeyish;
  requestedAmount: BigNumberish;
  reserveDomainAddress?: PublicKeyish | null;
  healthPlanAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  fundingLineAddress?: PublicKeyish | null;
  assetDecimalsByMint?: Record<string, number>;
  nowTs?: number;
};

export type MemberReadModel = {
  wallet: string;
  planParticipations: Array<{
    healthPlan: string;
    policySeries: string;
    eligibility: string;
    delegatedRights: string[];
    claimableRewards: bigint;
    payableClaims: bigint;
    payoutHistory: bigint;
    claimStatusCounts: Record<string, number>;
  }>;
};

export type OracleProfileSummary = OracleProfileSnapshot;

export type ReserveDomainSummary = ReserveDomainSnapshot;

export type DomainAssetVaultSummary = DomainAssetVaultSnapshot;

export type OracleSummary = {
  address: string;
  oracle: string;
  active: boolean;
  claimed: boolean;
  admin: string;
  bump: number;
  metadataUri: string;
  profile?: OracleProfileSummary;
};

export type OracleWithProfileSummary = OracleSummary;

export type SchemaSummary = OutcomeSchemaSnapshot;

export type SchemaDependencyLedgerSummary = SchemaDependencyLedgerSnapshot;

export type ProtocolConfigSummary = {
  address: string;
  admin: string;
  governanceAuthority: string;
  governanceRealm: string;
  governanceConfig: string;
  defaultStakeMint: string;
  minOracleStake: bigint;
  emergencyPaused: boolean;
  allowedPayoutMintsHashHex: string;
};

export type PoolSummary = {
  address: string;
  poolId: string;
  displayName: string;
  reserveDomain: string;
  depositAssetMint: string;
  authority: string;
  organizationRef: string;
  active: boolean;
};

export type RuleSummary = {
  address: string;
  ruleId: string;
  pool: string;
  schemaKeyHashHex: string;
  schemaVersion: number;
  enabled: boolean;
  policySeries: string;
  healthPlan: string;
};

// Phase 1.7 PR4 — Stub summary types referenced by lib/ui-capabilities.ts.
// These were imported there before the file was added to the typecheck graph;
// adding minimal shapes here lets ui-capabilities compile without a separate
// migration. They preserve the structural contract of the field accesses
// already in ui-capabilities (`walletClaimDelegate?.active`, etc.) — wider
// definitions land in a follow-up that wires the actual data sources.

export type ClaimDelegateAuthorizationSummary = {
  active: boolean;
  delegate: string;
};

export type CoverageClaimSummary = {
  address: string;
};

export type MembershipSummary = {
  address: string;
  member: string;
  status?: string;
};

export type OutcomeAggregateSummary = {
  address: string;
  passed?: boolean;
  claimed?: boolean;
};

export type PoolControlAuthoritySummary = {
  operatorAuthority?: string;
  riskManagerAuthority?: string;
  complianceAuthority?: string;
  guardianAuthority?: string;
};

export type PoolRedemptionRequestSummary = {
  address: string;
};

export type WalletPoolPositionSummary = {
  capitalPositionActive: boolean;
  pendingRedemptionRequestCount: number;
  pendingCoverageClaimCount: number;
};
