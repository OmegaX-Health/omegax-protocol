// SPDX-License-Identifier: AGPL-3.0-or-later

import { BN, BorshCoder, Program, type Idl } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import protocolIdl from "../../idl/omegax_protocol.json";

import {
  PROTOCOL_ACCOUNT_DISCRIMINATORS,
  PROTOCOL_INSTRUCTION_ACCOUNTS,
  PROTOCOL_INSTRUCTION_DISCRIMINATORS,
  PROTOCOL_PROGRAM_ID,
  type ProtocolInstructionAccount,
  type ProtocolInstructionName,
} from "./generated/protocol-contract";

export type PublicKeyish = PublicKey | string;
export type BigNumberish = bigint | number | string;

const TEXT_ENCODER = new TextEncoder();
const PROGRAM_ID = new PublicKey(PROTOCOL_PROGRAM_ID);

export const ZERO_PUBKEY = "11111111111111111111111111111111";
export const ZERO_PUBKEY_KEY = new PublicKey(ZERO_PUBKEY);

// Phase 1.7 — wrapped-SOL mint sentinel mirrors the on-chain `NATIVE_SOL_MINT`
// constant in `programs/omegax_protocol/src/lib.rs`. SOL-rail fee vaults use
// this as their `asset_mint` so the on-chain seeds and rail-mismatch guards
// can distinguish lamport accounting from SPL accounting. The pool-treasury
// panel UI surfaces SOL rails as `paymentMint === ZERO_PUBKEY` (a UI-friendly
// sentinel that doesn't depend on the WSOL mint magic string); listers map
// `vault.asset_mint == NATIVE_SOL_MINT` to `paymentMint = ZERO_PUBKEY` in the
// returned summaries.
export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
export const NATIVE_SOL_MINT_KEY = new PublicKey(NATIVE_SOL_MINT);
export const MAX_ID_SEED_BYTES = 32;

export function classicTokenProgramId(tokenProgramId?: PublicKeyish | null): PublicKey {
  const candidate = toPublicKey(tokenProgramId ?? TOKEN_PROGRAM_ID);
  if (!candidate.equals(TOKEN_PROGRAM_ID)) {
    throw new Error("OmegaX Protocol v1 supports only the classic SPL Token program.");
  }
  return candidate;
}

export const SEED_PROTOCOL_GOVERNANCE = "protocol_governance";
export const SEED_RESERVE_DOMAIN = "reserve_domain";
export const SEED_DOMAIN_ASSET_VAULT = "domain_asset_vault";
export const SEED_DOMAIN_ASSET_VAULT_TOKEN = "domain_asset_vault_token";
export const SEED_DOMAIN_ASSET_LEDGER = "domain_asset_ledger";
export const SEED_PROTOCOL_FEE_VAULT = "protocol_fee_vault";
export const SEED_POOL_TREASURY_VAULT = "pool_treasury_vault";
export const SEED_POOL_ORACLE_FEE_VAULT = "pool_oracle_fee_vault";
export const SEED_HEALTH_PLAN = "health_plan";
export const SEED_PLAN_RESERVE_LEDGER = "plan_reserve_ledger";
export const SEED_POLICY_SERIES = "policy_series";
export const SEED_SERIES_RESERVE_LEDGER = "series_reserve_ledger";
export const SEED_MEMBER_POSITION = "member_position";
export const SEED_MEMBERSHIP_ANCHOR_SEAT = "membership_anchor_seat";
export const SEED_FUNDING_LINE = "funding_line";
export const SEED_FUNDING_LINE_LEDGER = "funding_line_ledger";
export const SEED_CLAIM_CASE = "claim_case";
export const SEED_OBLIGATION = "obligation";
export const SEED_LIQUIDITY_POOL = "liquidity_pool";
export const SEED_CAPITAL_CLASS = "capital_class";
export const SEED_POOL_CLASS_LEDGER = "pool_class_ledger";
export const SEED_LP_POSITION = "lp_position";
export const SEED_ALLOCATION_POSITION = "allocation_position";
export const SEED_ALLOCATION_LEDGER = "allocation_ledger";
export const SEED_ORACLE_PROFILE = "oracle_profile";
export const SEED_POOL_ORACLE_APPROVAL = "pool_oracle_approval";
export const SEED_POOL_ORACLE_POLICY = "pool_oracle_policy";
export const SEED_POOL_ORACLE_PERMISSION_SET = "pool_oracle_permission_set";
export const SEED_OUTCOME_SCHEMA = "outcome_schema";
export const SEED_SCHEMA_DEPENDENCY_LEDGER = "schema_dependency_ledger";
export const SEED_CLAIM_ATTESTATION = "claim_attestation";

export const CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE = 0;
export const CLAIM_ATTESTATION_DECISION_SUPPORT_DENY = 1;
export const CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW = 2;
export const CLAIM_ATTESTATION_DECISION_ABSTAIN = 3;

export const MEMBERSHIP_MODE_OPEN = 0;
export const MEMBERSHIP_MODE_TOKEN_GATE = 1;
export const MEMBERSHIP_MODE_INVITE_ONLY = 2;

export const MEMBERSHIP_GATE_KIND_OPEN = 0;
export const MEMBERSHIP_GATE_KIND_INVITE_ONLY = 1;
export const MEMBERSHIP_GATE_KIND_NFT_ANCHOR = 2;
export const MEMBERSHIP_GATE_KIND_STAKE_ANCHOR = 3;
export const MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT = 4;

export const MEMBERSHIP_PROOF_MODE_OPEN = 0;
export const MEMBERSHIP_PROOF_MODE_TOKEN_GATE = 1;
export const MEMBERSHIP_PROOF_MODE_INVITE_PERMIT = 2;

function assertValidClaimAttestationDecision(decision: number): void {
  if (
    decision !== CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE &&
    decision !== CLAIM_ATTESTATION_DECISION_SUPPORT_DENY &&
    decision !== CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW &&
    decision !== CLAIM_ATTESTATION_DECISION_ABSTAIN
  ) {
    throw new Error(
      "claim attestation decision must be one of 0 (approve), 1 (deny), 2 (review), or 3 (abstain)",
    );
  }
}

export const SERIES_MODE_REWARD = 0;
export const SERIES_MODE_PROTECTION = 1;
export const SERIES_MODE_REIMBURSEMENT = 2;
export const SERIES_MODE_PARAMETRIC = 3;
export const SERIES_MODE_OTHER = 255;

export const SERIES_STATUS_DRAFT = 0;
export const SERIES_STATUS_ACTIVE = 1;
export const SERIES_STATUS_PAUSED = 2;
export const SERIES_STATUS_CLOSED = 3;

export const FUNDING_LINE_TYPE_SPONSOR_BUDGET = 0;
export const FUNDING_LINE_TYPE_PREMIUM_INCOME = 1;
export const FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION = 2;
export const FUNDING_LINE_TYPE_BACKSTOP = 3;
export const FUNDING_LINE_TYPE_SUBSIDY = 4;

export const FUNDING_LINE_STATUS_OPEN = 0;
export const FUNDING_LINE_STATUS_PAUSED = 1;
export const FUNDING_LINE_STATUS_CLOSED = 2;

export const ELIGIBILITY_PENDING = 0;
export const ELIGIBILITY_ELIGIBLE = 1;
export const ELIGIBILITY_PAUSED = 2;
export const ELIGIBILITY_CLOSED = 3;

export const CLAIM_INTAKE_OPEN = 0;
export const CLAIM_INTAKE_UNDER_REVIEW = 1;
export const CLAIM_INTAKE_APPROVED = 2;
export const CLAIM_INTAKE_DENIED = 3;
export const CLAIM_INTAKE_SETTLED = 4;
export const CLAIM_INTAKE_CLOSED = 5;

export const OBLIGATION_STATUS_PROPOSED = 0;
export const OBLIGATION_STATUS_RESERVED = 1;
export const OBLIGATION_STATUS_CLAIMABLE_PAYABLE = 2;
export const OBLIGATION_STATUS_SETTLED = 3;
export const OBLIGATION_STATUS_CANCELED = 4;
export const OBLIGATION_STATUS_IMPAIRED = 5;
export const OBLIGATION_STATUS_RECOVERED = 6;

export const OBLIGATION_DELIVERY_MODE_CLAIMABLE = 0;
export const OBLIGATION_DELIVERY_MODE_PAYABLE = 1;

export const REDEMPTION_POLICY_OPEN = 0;
export const REDEMPTION_POLICY_QUEUE_ONLY = 1;
export const REDEMPTION_POLICY_PAUSED = 2;

export const CAPITAL_CLASS_RESTRICTION_OPEN = 0;
export const CAPITAL_CLASS_RESTRICTION_RESTRICTED = 1;
export const CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY = 2;

export const LP_QUEUE_STATUS_NONE = 0;
export const LP_QUEUE_STATUS_PENDING = 1;
export const LP_QUEUE_STATUS_PROCESSED = 2;

export const ORACLE_TYPE_LAB = 0;
export const ORACLE_TYPE_HOSPITAL_CLINIC = 1;
export const ORACLE_TYPE_HEALTH_APP = 2;
export const ORACLE_TYPE_WEARABLE_DATA_PROVIDER = 3;
export const ORACLE_TYPE_OTHER = 255;

export const SCHEMA_FAMILY_KERNEL = 0;
export const SCHEMA_FAMILY_CLINICAL = 1;
export const SCHEMA_FAMILY_CLAIMS_CODING = 2;

export const SCHEMA_VISIBILITY_PUBLIC = 0;
export const SCHEMA_VISIBILITY_PRIVATE = 1;
export const SCHEMA_VISIBILITY_RESTRICTED = 2;

export const PAUSE_FLAG_PROTOCOL_EMERGENCY = 1 << 0;
export const PAUSE_FLAG_DOMAIN_RAILS = 1 << 1;
export const PAUSE_FLAG_PLAN_OPERATIONS = 1 << 2;
export const PAUSE_FLAG_CLAIM_INTAKE = 1 << 3;
export const PAUSE_FLAG_CAPITAL_SUBSCRIPTIONS = 1 << 4;
export const PAUSE_FLAG_REDEMPTION_QUEUE_ONLY = 1 << 5;
export const PAUSE_FLAG_ORACLE_FINALITY_HOLD = 1 << 6;
export const PAUSE_FLAG_ALLOCATION_FREEZE = 1 << 7;

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

// Phase 1.6/1.7 — Fee-vault snapshot types. The panel surfaces SOL rails
// as `paymentMint === ZERO_PUBKEY`; the listers below translate
// `assetMint === NATIVE_SOL_MINT` to that UI sentinel.
export type ProtocolFeeVaultSnapshot = {
  address: string;
  reserveDomain: string;
  assetMint: string;
  feeRecipient: string;
  accruedFees: bigint;
  withdrawnFees: bigint;
  bump: number;
};

export type PoolTreasuryVaultSnapshot = {
  address: string;
  liquidityPool: string;
  assetMint: string;
  feeRecipient: string;
  accruedFees: bigint;
  withdrawnFees: bigint;
  bump: number;
};

export type PoolOracleFeeVaultSnapshot = {
  address: string;
  liquidityPool: string;
  oracle: string;
  assetMint: string;
  feeRecipient: string;
  accruedFees: bigint;
  withdrawnFees: bigint;
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
  feeBps?: number;
  totalShares: BigNumberish;
  navAssets: BigNumberish;
  allocatedAssets?: BigNumberish;
  pendingRedemptions?: BigNumberish;
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
  protocolFeeBps: number;
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

export type PoolOracleApprovalSnapshot = {
  address: string;
  liquidityPool: string;
  oracle: string;
  active: boolean;
  updatedAtTs: number;
  bump: number;
};

export type PoolOraclePolicySnapshot = {
  address: string;
  liquidityPool: string;
  quorumM: number;
  quorumN: number;
  requireVerifiedSchema: boolean;
  oracleFeeBps: number;
  allowDelegateClaim: boolean;
  challengeWindowSecs: number;
  updatedAtTs: number;
  bump: number;
};

export type PoolOraclePermissionSetSnapshot = {
  address: string;
  liquidityPool: string;
  oracle: string;
  permissions: number;
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
  schemaKeyHashHex: string;
  createdAtTs: number;
  updatedAtTs: number;
  bump: number;
};

export type ProtocolConsoleSnapshot = {
  protocolGovernance: ProtocolGovernanceSnapshot | null;
  reserveDomains: ReserveDomainSnapshot[];
  domainAssetVaults: DomainAssetVaultSnapshot[];
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
  poolOracleApprovals: PoolOracleApprovalSnapshot[];
  poolOraclePolicies: PoolOraclePolicySnapshot[];
  poolOraclePermissionSets: PoolOraclePermissionSetSnapshot[];
  outcomeSchemas: OutcomeSchemaSnapshot[];
  schemaDependencyLedgers: SchemaDependencyLedgerSnapshot[];
  claimAttestations: ClaimAttestationSnapshot[];
  protocolFeeVaults: ProtocolFeeVaultSnapshot[];
  poolTreasuryVaults: PoolTreasuryVaultSnapshot[];
  poolOracleFeeVaults: PoolOracleFeeVaultSnapshot[];
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

export type PoolOracleApprovalSummary = PoolOracleApprovalSnapshot;

export type PoolOraclePolicySummary = PoolOraclePolicySnapshot;

export type PoolOraclePermissionSetSummary = PoolOraclePermissionSetSnapshot;

// Phase 1.6/1.7 — Fee-vault summaries surfaced to the pool-treasury panel.
//
// `paymentMint` is the panel's UI sentinel: SOL rails expose
// `paymentMint === ZERO_PUBKEY` (the all-zeros system program key, not the
// real wrapped-SOL mint). Listers translate the on-chain
// `assetMint === NATIVE_SOL_MINT` to that sentinel so the panel's
// `paymentMint === ZERO_PUBKEY ? sol : spl` switching code can stay simple.
//
// `availableFees = accruedFees - withdrawnFees` is the safe withdrawable
// headroom; computed via saturating subtraction so a misordered chain read
// (e.g., withdrawn briefly leading accrued during indexing) doesn't surface
// as a bigint underflow in the UI.

export type ProtocolFeeVaultSummary = {
  address: string;
  reserveDomain: string;
  /** ZERO_PUBKEY for SOL rails, the real SPL mint otherwise. */
  paymentMint: string;
  feeRecipient: string;
  accruedFees: bigint;
  withdrawnFees: bigint;
  availableFees: bigint;
  bump: number;
};

export type PoolTreasuryReserveSummary = {
  address: string;
  /** Pool the treasury vault is scoped to. */
  pool: string;
  reserveDomain: string;
  /** ZERO_PUBKEY for SOL rails, the real SPL mint otherwise. */
  paymentMint: string;
  feeRecipient: string;
  accruedFees: bigint;
  withdrawnFees: bigint;
  availableFees: bigint;
  // Display-only ledger counters surfaced by the panel. The on-chain
  // PoolTreasuryVault tracks only accrued/withdrawn fees — these aliases
  // are populated by joining DomainAssetLedger / PolicySeries / Obligation
  // sums in a follow-up. PR3 ships them as 0n placeholders so the panel
  // renders zeros without crashing; they are NOT used for any withdrawal
  // safety check (only `availableFees` gates the panel).
  reservedRewardAmount: bigint;
  reservedCoverageClaimAmount: bigint;
  paidCoverageClaimAmount: bigint;
  impairedAmount: bigint;
  bump: number;
};

export type PoolOracleFeeVaultSummary = {
  address: string;
  /** Pool the oracle-fee vault is scoped to. */
  pool: string;
  /** Reserve domain (joined via the pool's `liquidityPool.reserveDomain`).
   *  Required by SPL withdraw builders to derive the matching DomainAssetVault. */
  reserveDomain: string;
  /** Registered oracle wallet receiving the fee accruals. */
  oracle: string;
  /** ZERO_PUBKEY for SOL rails, the real SPL mint otherwise. */
  paymentMint: string;
  feeRecipient: string;
  accruedFees: bigint;
  withdrawnFees: bigint;
  availableFees: bigint;
  bump: number;
};

export type SchemaSummary = OutcomeSchemaSnapshot;

export type SchemaDependencyLedgerSummary = SchemaDependencyLedgerSnapshot;

export type ProtocolConfigSummary = {
  address: string;
  admin: string;
  governanceAuthority: string;
  governanceRealm: string;
  governanceConfig: string;
  protocolFeeBps: number;
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

export function getProgramId(): PublicKey {
  return PROGRAM_ID;
}

export function listProtocolInstructionNames(): ProtocolInstructionName[] {
  return Object.keys(PROTOCOL_INSTRUCTION_DISCRIMINATORS) as ProtocolInstructionName[];
}

export function listProtocolInstructionAccounts(
  instructionName: ProtocolInstructionName,
): ProtocolInstructionAccount[] {
  return PROTOCOL_INSTRUCTION_ACCOUNTS[instructionName] ?? [];
}

export function listProtocolAccountNames(): string[] {
  return Object.keys(PROTOCOL_ACCOUNT_DISCRIMINATORS).sort();
}

export async function accountExists(connection: Connection, address: PublicKeyish): Promise<boolean> {
  const info = await connection.getAccountInfo(toPublicKey(address), "confirmed");
  return info !== null;
}

export function utf8ByteLength(value: string): number {
  return TEXT_ENCODER.encode(value).length;
}

export function isSeedIdSafe(value: string): boolean {
  const length = utf8ByteLength(value);
  return length > 0 && length <= MAX_ID_SEED_BYTES;
}

export function assertSeedId(value: string, label = "seed id"): void {
  if (!isSeedIdSafe(value)) {
    throw new Error(`${label} must be 1..${MAX_ID_SEED_BYTES} UTF-8 bytes.`);
  }
}

export function toPublicKey(value: PublicKeyish): PublicKey {
  return value instanceof PublicKey ? value : new PublicKey(value);
}

export function normalizeAddress(value: PublicKeyish): string {
  return toPublicKey(value).toBase58();
}

function derivePda(seeds: Uint8Array[], programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function stringSeed(value: string, label: string): Uint8Array {
  assertSeedId(value, label);
  return TEXT_ENCODER.encode(value);
}

export function deriveProtocolGovernancePda(programId = PROGRAM_ID): PublicKey {
  return derivePda([TEXT_ENCODER.encode(SEED_PROTOCOL_GOVERNANCE)], programId);
}

export function deriveReserveDomainPda(params: {
  domainId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [TEXT_ENCODER.encode(SEED_RESERVE_DOMAIN), stringSeed(params.domainId, "domain id")],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveDomainAssetVaultPda(params: {
  reserveDomain: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_DOMAIN_ASSET_VAULT),
      toPublicKey(params.reserveDomain).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

// PDA-derived address for the SPL token account that holds vault assets. The
// program initialises this account with `token::authority = domain_asset_vault`
// (see CreateDomainAssetVault context) so outflow CPIs can sign as the vault
// PDA. Operators no longer pre-create this token account.
export function deriveDomainAssetVaultTokenAccountPda(params: {
  reserveDomain: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_DOMAIN_ASSET_VAULT_TOKEN),
      toPublicKey(params.reserveDomain).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveDomainAssetLedgerPda(params: {
  reserveDomain: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_DOMAIN_ASSET_LEDGER),
      toPublicKey(params.reserveDomain).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

// Phase 1.6/1.7 — Fee-vault PDA derivers. SPL rails pass `assetMint = the
// SPL mint pubkey`; SOL rails pass `assetMint = NATIVE_SOL_MINT_KEY` (the
// canonical wrapped-SOL mint). The on-chain seeds are identical for both
// rails — the rail is selected at withdraw time by which asset_mint the
// vault was initialized with.

export function deriveProtocolFeeVaultPda(params: {
  reserveDomain: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_PROTOCOL_FEE_VAULT),
      toPublicKey(params.reserveDomain).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePoolTreasuryVaultPda(params: {
  liquidityPool: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POOL_TREASURY_VAULT),
      toPublicKey(params.liquidityPool).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePoolOracleFeeVaultPda(params: {
  liquidityPool: PublicKeyish;
  oracle: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POOL_ORACLE_FEE_VAULT),
      toPublicKey(params.liquidityPool).toBytes(),
      toPublicKey(params.oracle).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveHealthPlanPda(params: {
  reserveDomain: PublicKeyish;
  planId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_HEALTH_PLAN),
      toPublicKey(params.reserveDomain).toBytes(),
      stringSeed(params.planId, "plan id"),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePlanReserveLedgerPda(params: {
  healthPlan: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_PLAN_RESERVE_LEDGER),
      toPublicKey(params.healthPlan).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePolicySeriesPda(params: {
  healthPlan: PublicKeyish;
  seriesId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POLICY_SERIES),
      toPublicKey(params.healthPlan).toBytes(),
      stringSeed(params.seriesId, "series id"),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveSeriesReserveLedgerPda(params: {
  policySeries: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_SERIES_RESERVE_LEDGER),
      toPublicKey(params.policySeries).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveMemberPositionPda(params: {
  healthPlan: PublicKeyish;
  wallet: PublicKeyish;
  seriesScope?: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_MEMBER_POSITION),
      toPublicKey(params.healthPlan).toBytes(),
      toPublicKey(params.wallet).toBytes(),
      toPublicKey(params.seriesScope ?? ZERO_PUBKEY_KEY).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveMembershipAnchorSeatPda(params: {
  healthPlan: PublicKeyish;
  anchorRef: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_MEMBERSHIP_ANCHOR_SEAT),
      toPublicKey(params.healthPlan).toBytes(),
      toPublicKey(params.anchorRef).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveFundingLinePda(params: {
  healthPlan: PublicKeyish;
  lineId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_FUNDING_LINE),
      toPublicKey(params.healthPlan).toBytes(),
      stringSeed(params.lineId, "funding line id"),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveFundingLineLedgerPda(params: {
  fundingLine: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_FUNDING_LINE_LEDGER),
      toPublicKey(params.fundingLine).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveClaimCasePda(params: {
  healthPlan: PublicKeyish;
  claimId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_CLAIM_CASE),
      toPublicKey(params.healthPlan).toBytes(),
      stringSeed(params.claimId, "claim id"),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveObligationPda(params: {
  fundingLine: PublicKeyish;
  obligationId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_OBLIGATION),
      toPublicKey(params.fundingLine).toBytes(),
      stringSeed(params.obligationId, "obligation id"),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveLiquidityPoolPda(params: {
  reserveDomain: PublicKeyish;
  poolId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_LIQUIDITY_POOL),
      toPublicKey(params.reserveDomain).toBytes(),
      stringSeed(params.poolId, "pool id"),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveCapitalClassPda(params: {
  liquidityPool: PublicKeyish;
  classId: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_CAPITAL_CLASS),
      toPublicKey(params.liquidityPool).toBytes(),
      stringSeed(params.classId, "capital class id"),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePoolClassLedgerPda(params: {
  capitalClass: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POOL_CLASS_LEDGER),
      toPublicKey(params.capitalClass).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveLpPositionPda(params: {
  capitalClass: PublicKeyish;
  owner: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_LP_POSITION),
      toPublicKey(params.capitalClass).toBytes(),
      toPublicKey(params.owner).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveAllocationPositionPda(params: {
  capitalClass: PublicKeyish;
  fundingLine: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_ALLOCATION_POSITION),
      toPublicKey(params.capitalClass).toBytes(),
      toPublicKey(params.fundingLine).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveAllocationLedgerPda(params: {
  allocationPosition: PublicKeyish;
  assetMint: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_ALLOCATION_LEDGER),
      toPublicKey(params.allocationPosition).toBytes(),
      toPublicKey(params.assetMint).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveOracleProfilePda(params: {
  oracle: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [TEXT_ENCODER.encode(SEED_ORACLE_PROFILE), toPublicKey(params.oracle).toBytes()],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePoolOracleApprovalPda(params: {
  liquidityPool: PublicKeyish;
  oracle: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POOL_ORACLE_APPROVAL),
      toPublicKey(params.liquidityPool).toBytes(),
      toPublicKey(params.oracle).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePoolOraclePolicyPda(params: {
  liquidityPool: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [TEXT_ENCODER.encode(SEED_POOL_ORACLE_POLICY), toPublicKey(params.liquidityPool).toBytes()],
    params.programId ?? PROGRAM_ID,
  );
}

export function derivePoolOraclePermissionSetPda(params: {
  liquidityPool: PublicKeyish;
  oracle: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_POOL_ORACLE_PERMISSION_SET),
      toPublicKey(params.liquidityPool).toBytes(),
      toPublicKey(params.oracle).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveOutcomeSchemaPda(params: {
  schemaKeyHashHex: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [TEXT_ENCODER.encode(SEED_OUTCOME_SCHEMA), hexToFixedBytes(params.schemaKeyHashHex, 32)],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveSchemaDependencyLedgerPda(params: {
  schemaKeyHashHex: string;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [TEXT_ENCODER.encode(SEED_SCHEMA_DEPENDENCY_LEDGER), hexToFixedBytes(params.schemaKeyHashHex, 32)],
    params.programId ?? PROGRAM_ID,
  );
}

export function deriveClaimAttestationPda(params: {
  claimCase: PublicKeyish;
  oracle: PublicKeyish;
  programId?: PublicKey;
}): PublicKey {
  return derivePda(
    [
      TEXT_ENCODER.encode(SEED_CLAIM_ATTESTATION),
      toPublicKey(params.claimCase).toBytes(),
      toPublicKey(params.oracle).toBytes(),
    ],
    params.programId ?? PROGRAM_ID,
  );
}

export function toBigIntAmount(value: BigNumberish | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  return BigInt(value);
}

export function recomputeReserveBalanceSheet(
  input: PartialReserveBalanceSheet = {},
): ReserveBalanceSheet {
  const funded = toBigIntAmount(input.funded);
  const allocated = toBigIntAmount(input.allocated);
  const reserved = toBigIntAmount(input.reserved);
  const owed = toBigIntAmount(input.owed);
  const claimable = toBigIntAmount(input.claimable);
  const payable = toBigIntAmount(input.payable);
  const settled = toBigIntAmount(input.settled);
  const impaired = toBigIntAmount(input.impaired);
  const pendingRedemption = toBigIntAmount(input.pendingRedemption ?? input.pending_redemption);
  const restricted = toBigIntAmount(input.restricted);
  const encumbered = reserved + claimable + payable + impaired + pendingRedemption + restricted;
  const free = funded > encumbered ? funded - encumbered : 0n;
  const redeemableEncumbered = encumbered + allocated;
  const redeemable = funded > redeemableEncumbered ? funded - redeemableEncumbered : 0n;

  return {
    funded,
    allocated,
    reserved,
    owed,
    claimable,
    payable,
    settled,
    impaired,
    pendingRedemption,
    restricted,
    free,
    redeemable,
  };
}

export function sumReserveBalanceSheets(
  sheets: Array<PartialReserveBalanceSheet | undefined | null>,
): ReserveBalanceSheet {
  const total = {
    funded: 0n,
    allocated: 0n,
    reserved: 0n,
    owed: 0n,
    claimable: 0n,
    payable: 0n,
    settled: 0n,
    impaired: 0n,
    pendingRedemption: 0n,
    restricted: 0n,
  };

  for (const sheet of sheets) {
    if (!sheet) continue;
    const normalized = recomputeReserveBalanceSheet(sheet);
    total.funded += normalized.funded;
    total.allocated += normalized.allocated;
    total.reserved += normalized.reserved;
    total.owed += normalized.owed;
    total.claimable += normalized.claimable;
    total.payable += normalized.payable;
    total.settled += normalized.settled;
    total.impaired += normalized.impaired;
    total.pendingRedemption += normalized.pendingRedemption;
    total.restricted += normalized.restricted;
  }

  return recomputeReserveBalanceSheet(total);
}

// Funding-line availability should come from the reserve sheet when present,
// so read models and UI surfaces don't drift onto incompatible "remaining" math.
export function availableFundingLineBalance(
  line: Pick<FundingLineSnapshot, "sheet" | "fundedAmount" | "spentAmount">,
): bigint {
  if (line.sheet) return recomputeReserveBalanceSheet(line.sheet).free;
  return toBigIntAmount(line.fundedAmount) - toBigIntAmount(line.spentAmount);
}

export function describeSeriesMode(mode: number): string {
  switch (mode) {
    case SERIES_MODE_REWARD:
      return "reward";
    case SERIES_MODE_PROTECTION:
      return "protection";
    case SERIES_MODE_REIMBURSEMENT:
      return "reimbursement";
    case SERIES_MODE_PARAMETRIC:
      return "parametric";
    default:
      return "other";
  }
}

export function describeSeriesStatus(status: number): string {
  switch (status) {
    case SERIES_STATUS_DRAFT:
      return "draft";
    case SERIES_STATUS_ACTIVE:
      return "active";
    case SERIES_STATUS_PAUSED:
      return "paused";
    case SERIES_STATUS_CLOSED:
      return "closed";
    default:
      return `unknown(${status})`;
  }
}

export function describeFundingLineType(lineType: number): string {
  switch (lineType) {
    case FUNDING_LINE_TYPE_SPONSOR_BUDGET:
      return "sponsor_budget";
    case FUNDING_LINE_TYPE_PREMIUM_INCOME:
      return "premium_income";
    case FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION:
      return "liquidity_pool_allocation";
    case FUNDING_LINE_TYPE_BACKSTOP:
      return "backstop";
    case FUNDING_LINE_TYPE_SUBSIDY:
      return "subsidy";
    default:
      return `unknown(${lineType})`;
  }
}

export function describeEligibilityStatus(status: number): string {
  switch (status) {
    case ELIGIBILITY_PENDING:
      return "pending";
    case ELIGIBILITY_ELIGIBLE:
      return "eligible";
    case ELIGIBILITY_PAUSED:
      return "paused";
    case ELIGIBILITY_CLOSED:
      return "closed";
    default:
      return `unknown(${status})`;
  }
}

export function describeClaimStatus(status: number): string {
  switch (status) {
    case CLAIM_INTAKE_OPEN:
      return "open";
    case CLAIM_INTAKE_UNDER_REVIEW:
      return "under_review";
    case CLAIM_INTAKE_APPROVED:
      return "approved";
    case CLAIM_INTAKE_DENIED:
      return "denied";
    case CLAIM_INTAKE_SETTLED:
      return "settled";
    case CLAIM_INTAKE_CLOSED:
      return "closed";
    default:
      return `unknown(${status})`;
  }
}

export function isActiveClaimStatus(status: number): boolean {
  return status === CLAIM_INTAKE_OPEN || status === CLAIM_INTAKE_UNDER_REVIEW || status === CLAIM_INTAKE_APPROVED;
}

export function describeObligationStatus(status: number): string {
  switch (status) {
    case OBLIGATION_STATUS_PROPOSED:
      return "proposed";
    case OBLIGATION_STATUS_RESERVED:
      return "reserved";
    case OBLIGATION_STATUS_CLAIMABLE_PAYABLE:
      return "claimable_or_payable";
    case OBLIGATION_STATUS_SETTLED:
      return "settled";
    case OBLIGATION_STATUS_CANCELED:
      return "canceled";
    case OBLIGATION_STATUS_IMPAIRED:
      return "impaired";
    case OBLIGATION_STATUS_RECOVERED:
      return "recovered";
    default:
      return `unknown(${status})`;
  }
}

export function hasObligationImpairment(
  obligation: Pick<ObligationSnapshot, "status" | "impairedAmount">,
): boolean {
  return obligation.status === OBLIGATION_STATUS_IMPAIRED || toBigIntAmount(obligation.impairedAmount) > 0n;
}

export function hasPendingRedemptionQueue(
  position: Pick<LPPositionSnapshot, "queueStatus" | "pendingRedemptionShares">,
): boolean {
  return position.queueStatus === LP_QUEUE_STATUS_PENDING || toBigIntAmount(position.pendingRedemptionShares) > 0n;
}

export function describeLpQueueStatus(
  position: Pick<LPPositionSnapshot, "queueStatus" | "pendingRedemptionShares">,
): string {
  if (position.queueStatus === LP_QUEUE_STATUS_PENDING) return "pending";
  if (toBigIntAmount(position.pendingRedemptionShares) > 0n) return "requested";
  return "clear";
}

export function isObligationOnDisputeWatch(
  obligation: Pick<ObligationSnapshot, "status" | "impairedAmount">,
): boolean {
  return obligation.status === OBLIGATION_STATUS_RESERVED
    || obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE
    || hasObligationImpairment(obligation);
}

export function describeCapitalRestriction(restrictionMode: number): string {
  switch (restrictionMode) {
    case CAPITAL_CLASS_RESTRICTION_OPEN:
      return "open";
    case CAPITAL_CLASS_RESTRICTION_RESTRICTED:
      return "restricted";
    case CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY:
      return "wrapper_only";
    default:
      return `unknown(${restrictionMode})`;
  }
}

export function bpsRatio(numerator: bigint, denominator: bigint): bigint | null {
  if (denominator <= 0n) return null;
  return (numerator * 10_000n) / denominator;
}

export function buildSponsorReadModel(params: {
  healthPlan: HealthPlanSnapshot;
  policySeries: PolicySeriesSnapshot[];
  fundingLines: FundingLineSnapshot[];
  obligations: ObligationSnapshot[];
  claimCases: ClaimCaseSnapshot[];
  planLedger?: PartialReserveBalanceSheet;
  outcomesBySeries?: Record<string, BigNumberish>;
}): SponsorReadModel {
  const sponsorLines = params.fundingLines.filter(
    (line) => line.healthPlan === params.healthPlan.address && line.lineType === FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  );
  const planSeries = params.policySeries.filter((series) => series.healthPlan === params.healthPlan.address);
  const planObligations = params.obligations.filter((obligation) => obligation.healthPlan === params.healthPlan.address);
  const planClaims = params.claimCases.filter((claimCase) => claimCase.healthPlan === params.healthPlan.address);
  const planLedger = recomputeReserveBalanceSheet(params.planLedger);

  const fundedSponsorBudget = sponsorLines.reduce(
    (sum, line) => sum + toBigIntAmount(line.fundedAmount),
    0n,
  );
  const remainingSponsorBudget = sponsorLines.reduce(
    (sum, line) => sum + availableFundingLineBalance(line),
    0n,
  );
  const committedSponsorBudget = fundedSponsorBudget - remainingSponsorBudget;

  const accruedRewards = planObligations
    .filter((obligation) => {
      const series = planSeries.find((candidate) => candidate.address === obligation.policySeries);
      return series?.mode === SERIES_MODE_REWARD;
    })
    .reduce((sum, obligation) => {
      const outstanding = toBigIntAmount(obligation.outstandingAmount ?? obligation.principalAmount);
      return sum + outstanding;
    }, 0n);

  const paidRewards = planObligations
    .filter((obligation) => {
      const series = planSeries.find((candidate) => candidate.address === obligation.policySeries);
      return series?.mode === SERIES_MODE_REWARD;
    })
    .reduce((sum, obligation) => sum + toBigIntAmount(obligation.settledAmount), 0n);

  const claimCounts = planClaims.reduce<Record<string, number>>((accumulator, claimCase) => {
    const label = describeClaimStatus(claimCase.intakeStatus);
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});
  const activeClaimCount = planClaims.filter((claimCase) => isActiveClaimStatus(claimCase.intakeStatus)).length;

  const perSeriesPerformance = planSeries.map((series) => {
    const obligations = planObligations.filter((obligation) => obligation.policySeries === series.address);
    const claims = planClaims.filter((claimCase) => claimCase.policySeries === series.address);
    const settled = obligations.reduce((sum, obligation) => sum + toBigIntAmount(obligation.settledAmount), 0n);
    const reserved = obligations.reduce((sum, obligation) => sum + toBigIntAmount(obligation.reservedAmount), 0n);
    const approvedClaims = claims.reduce((sum, claimCase) => sum + toBigIntAmount(claimCase.approvedAmount), 0n);
    const paidClaims = claims.reduce((sum, claimCase) => sum + toBigIntAmount(claimCase.paidAmount), 0n);
    const outcomes = toBigIntAmount(params.outcomesBySeries?.[series.address]);

    return {
      policySeries: series.address,
      seriesId: series.seriesId,
      mode: describeSeriesMode(series.mode),
      obligations: obligations.length,
      settled,
      reserved,
      claimCount: claims.length,
      approvedClaims,
      paidClaims,
      costPerOutcome: outcomes > 0n ? settled / outcomes : null,
    };
  });

  return {
    healthPlanAddress: params.healthPlan.address,
    planId: params.healthPlan.planId,
    fundedSponsorBudget,
    remainingSponsorBudget,
    accruedRewards,
    paidRewards,
    reserveCoverageBps: bpsRatio(planLedger.funded, planLedger.reserved + planLedger.claimable + planLedger.payable),
    claimCounts,
    activeClaimCount,
    committedSponsorBudget,
    perSeriesPerformance,
  };
}

export function buildCapitalReadModel(params: {
  liquidityPool: LiquidityPoolSnapshot;
  capitalClasses: CapitalClassSnapshot[];
  classLedgers: PoolClassLedgerSnapshot[];
  allocations: AllocationPositionSnapshot[];
}): CapitalReadModel {
  const classes = params.capitalClasses
    .filter((capitalClass) => capitalClass.liquidityPool === params.liquidityPool.address)
    .map((capitalClass) => {
      const ledger = params.classLedgers.find((candidate) => candidate.capitalClass === capitalClass.address);
      const sheet = recomputeReserveBalanceSheet(ledger?.sheet);
      const exposures = params.allocations
        .filter((allocation) => allocation.capitalClass === capitalClass.address)
        .map((allocation) => ({
          healthPlan: allocation.healthPlan,
          policySeries: allocation.policySeries ?? null,
          fundingLine: allocation.fundingLine,
          allocatedAmount: toBigIntAmount(allocation.allocatedAmount),
          reservedCapacity: toBigIntAmount(allocation.reservedCapacity),
          weightBps: allocation.weightBps,
        }));

      return {
        capitalClass: capitalClass.address,
        classId: capitalClass.classId,
        nav: toBigIntAmount(capitalClass.navAssets),
        redeemable: sheet.redeemable,
        allocated: toBigIntAmount(capitalClass.allocatedAssets),
        reservedLiabilities: sheet.reserved + sheet.claimable + sheet.payable,
        pendingRedemptions: toBigIntAmount(capitalClass.pendingRedemptions),
        realizedYield: toBigIntAmount(ledger?.realizedYieldAmount),
        impairments: sheet.impaired,
        restriction: describeCapitalRestriction(capitalClass.restrictionMode),
        exposureMix: exposures,
      };
    });

  return {
    liquidityPoolAddress: params.liquidityPool.address,
    poolId: params.liquidityPool.poolId,
    totalNav: classes.reduce((sum, capitalClass) => sum + capitalClass.nav, 0n),
    totalAllocated: classes.reduce((sum, capitalClass) => sum + capitalClass.allocated, 0n),
    totalUnallocated: classes.reduce((sum, capitalClass) => sum + (capitalClass.nav - capitalClass.allocated), 0n),
    totalPendingRedemptions: classes.reduce(
      (sum, capitalClass) => sum + capitalClass.pendingRedemptions,
      0n,
    ),
    classes,
  };
}

export function buildMemberReadModel(params: {
  wallet: PublicKeyish;
  memberPositions: MemberPositionSnapshot[];
  obligations: ObligationSnapshot[];
  claimCases: ClaimCaseSnapshot[];
}): MemberReadModel {
  const wallet = normalizeAddress(params.wallet);
  const positions = params.memberPositions.filter((position) => position.wallet === wallet);

  return {
    wallet,
    planParticipations: positions.map((position) => {
      const memberObligations = params.obligations.filter(
        (obligation) => obligation.memberWallet === wallet && obligation.policySeries === position.policySeries,
      );
      const claimCases = params.claimCases.filter(
        (claimCase) => claimCase.memberPosition === position.address,
      );
      const claimStatusCounts = claimCases.reduce<Record<string, number>>((accumulator, claimCase) => {
        const label = describeClaimStatus(claimCase.intakeStatus);
        accumulator[label] = (accumulator[label] ?? 0) + 1;
        return accumulator;
      }, {});

      return {
        healthPlan: position.healthPlan,
        policySeries: position.policySeries,
        eligibility: describeEligibilityStatus(position.eligibilityStatus),
        delegatedRights: [...position.delegatedRights],
        claimableRewards: memberObligations.reduce(
          (sum, obligation) => sum + toBigIntAmount(obligation.claimableAmount),
          0n,
        ),
        payableClaims: memberObligations.reduce(
          (sum, obligation) => sum + toBigIntAmount(obligation.payableAmount),
          0n,
        ),
        payoutHistory: memberObligations.reduce(
          (sum, obligation) => sum + toBigIntAmount(obligation.settledAmount),
          0n,
        ),
        claimStatusCounts,
      };
    }),
  };
}

export function shortenAddress(address: string, size = 4): string {
  if (!address || address.length <= size * 2 + 1) return address;
  return `${address.slice(0, size)}...${address.slice(-size)}`;
}

function explorerClusterSuffix(cluster?: string | null): string {
  const normalized = (
    cluster?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim()
    || process.env.NEXT_PUBLIC_REALMS_CLUSTER?.trim()
    || "devnet"
  );
  return normalized === "mainnet-beta" ? "" : `?cluster=${encodeURIComponent(normalized)}`;
}

export function toExplorerLink(signature: string, cluster?: string | null): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${explorerClusterSuffix(cluster)}`;
}

export function toExplorerAddressLink(address: string, cluster?: string | null): string {
  return `https://explorer.solana.com/address/${encodeURIComponent(address)}${explorerClusterSuffix(cluster)}`;
}

const PROTOCOL_IDL = protocolIdl as Idl;
const PROTOCOL_CODER = new BorshCoder(PROTOCOL_IDL);
const PROTOCOL_ACCOUNT_NAME_BY_DISCRIMINATOR = new Map<string, string>(
  Object.entries(PROTOCOL_ACCOUNT_DISCRIMINATORS).map(([name, discriminator]) => [
    Array.from(discriminator).join(","),
    name,
  ]),
);

export const MEMBER_DELEGATED_RIGHT_FLAGS = [
  "claim_reward",
  "view_payout_history",
  "open_claim_case",
  "appoint_delegate",
  "review_decisions",
] as const;

const ZERO_HASH_HEX = "00".repeat(32);

function accountDiscriminatorKey(data: Uint8Array): string | null {
  if (data.length < 8) return null;
  return Array.from(data.subarray(0, 8)).join(",");
}

function snakeCaseKey(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function decodedField<T = unknown>(
  decoded: Record<string, unknown>,
  key: string,
  alternateKey?: string,
): T | undefined {
  const snakeKey = alternateKey ?? snakeCaseKey(key);
  return (decoded[key] ?? decoded[snakeKey]) as T | undefined;
}

function resolveProtocolAccountName(data: Uint8Array): string | null {
  const key = accountDiscriminatorKey(data);
  if (!key) return null;
  return PROTOCOL_ACCOUNT_NAME_BY_DISCRIMINATOR.get(key) ?? null;
}

function createReadonlyProtocolProgram(connection: Connection): Program {
  return new Program(PROTOCOL_IDL, { connection });
}

function asPublicKey(value: unknown): PublicKey {
  if (value instanceof PublicKey) return value;
  if (typeof value === "string") return new PublicKey(value);
  if (value instanceof Uint8Array || Array.isArray(value)) return new PublicKey(value);
  if (value && typeof value === "object" && "toBase58" in value && typeof value.toBase58 === "function") {
    return new PublicKey(value.toBase58());
  }
  throw new Error("Invalid public key value.");
}

function asAddress(value: unknown): string {
  return asPublicKey(value).toBase58();
}

function asOptionalAddress(value: unknown): string | null {
  const address = asAddress(value);
  return address === ZERO_PUBKEY ? null : address;
}

function bigintFromAnchorValue(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return BigInt(value.toString());
  }
  return 0n;
}

function numberFromAnchorValue(value: unknown): number {
  return Number(bigintFromAnchorValue(value));
}

function stringFromAnchorValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return "";
}

function bytesToHex(value: unknown): string {
  if (value instanceof Uint8Array) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  if (Array.isArray(value)) {
    return Array.from(value, (byte) => Number(byte).toString(16).padStart(2, "0")).join("");
  }
  return "";
}

function normalizeHex32(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Expected a 32-byte hex string.");
  }
  return normalized;
}

function normalizeOptionalHex32(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return ZERO_HASH_HEX;
  return normalizeHex32(trimmed);
}

function hexToFixedBytes(value: string, size: number): Uint8Array {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  const expectedLength = size * 2;
  if (!new RegExp(`^[0-9a-f]{${expectedLength}}$`).test(normalized)) {
    throw new Error(`Expected a ${size}-byte hex string.`);
  }
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function membershipModelLabel(membershipMode: number, membershipGateKind: number): string {
  if (membershipMode === 1 || membershipGateKind === 2 || membershipGateKind === 3 || membershipGateKind === 4) {
    return "token_gate";
  }
  if (membershipMode === 2 || membershipGateKind === 1) return "invite_only";
  return "open";
}

function membershipGateKindLabel(membershipGateKind: number): string {
  switch (membershipGateKind) {
    case MEMBERSHIP_GATE_KIND_INVITE_ONLY:
      return "invite_only";
    case MEMBERSHIP_GATE_KIND_NFT_ANCHOR:
      return "nft_anchor";
    case MEMBERSHIP_GATE_KIND_STAKE_ANCHOR:
      return "stake_anchor";
    case MEMBERSHIP_GATE_KIND_FUNGIBLE_SNAPSHOT:
      return "fungible_snapshot";
    case MEMBERSHIP_GATE_KIND_OPEN:
    default:
      return "open";
  }
}

function delegatedRightsFromMask(mask: number): string[] {
  const rights: string[] = [];
  for (let index = 0; index < MEMBER_DELEGATED_RIGHT_FLAGS.length; index += 1) {
    if ((mask & (1 << index)) !== 0) rights.push(MEMBER_DELEGATED_RIGHT_FLAGS[index]!);
  }
  return rights;
}

function reserveLedgerSnapshot(params: {
  address: string;
  reserveDomain: string;
  assetMint: string;
  sheet: unknown;
}): ReserveScopedSnapshot {
  return {
    address: params.address,
    reserveDomain: params.reserveDomain,
    assetMint: params.assetMint,
    sheet: params.sheet as PartialReserveBalanceSheet,
  };
}

function sortByLabel<T>(rows: T[], label: (value: T) => string): T[] {
  return [...rows].sort((left, right) => label(left).localeCompare(label(right)));
}

export async function hashStringTo32Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function loadProtocolConsoleSnapshot(connection: Connection): Promise<ProtocolConsoleSnapshot> {
  const accounts = await connection.getProgramAccounts(getProgramId(), { commitment: "confirmed" });
  const snapshot: ProtocolConsoleSnapshot = {
    protocolGovernance: null,
    reserveDomains: [],
    domainAssetVaults: [],
    domainAssetLedgers: [],
    healthPlans: [],
    policySeries: [],
    memberPositions: [],
    fundingLines: [],
    claimCases: [],
    obligations: [],
    liquidityPools: [],
    capitalClasses: [],
    lpPositions: [],
    allocationPositions: [],
    planReserveLedgers: [],
    seriesReserveLedgers: [],
    fundingLineLedgers: [],
    poolClassLedgers: [],
    allocationLedgers: [],
    outcomesBySeries: {},
    oracleProfiles: [],
    poolOracleApprovals: [],
    poolOraclePolicies: [],
    poolOraclePermissionSets: [],
    outcomeSchemas: [],
    schemaDependencyLedgers: [],
    claimAttestations: [],
    protocolFeeVaults: [],
    poolTreasuryVaults: [],
    poolOracleFeeVaults: [],
  };

  const planLedgersRaw: Array<{ address: string; healthPlan: string; assetMint: string; sheet: unknown }> = [];
  const seriesLedgersRaw: Array<{ address: string; policySeries: string; assetMint: string; sheet: unknown }> = [];
  const lineLedgersRaw: Array<{ address: string; fundingLine: string; assetMint: string; sheet: unknown }> = [];

  for (const row of accounts) {
    const accountName = resolveProtocolAccountName(row.account.data);
    if (!accountName) continue;
    let decoded: Record<string, unknown>;
    try {
      decoded = PROTOCOL_CODER.accounts.decode(accountName, Buffer.from(row.account.data)) as Record<string, unknown>;
    } catch {
      continue;
    }
    const address = row.pubkey.toBase58();

    switch (accountName) {
      case "ProtocolGovernance":
        snapshot.protocolGovernance = {
          address,
          governanceAuthority: asAddress(decodedField(decoded, "governanceAuthority")),
          protocolFeeBps: Number(decodedField(decoded, "protocolFeeBps") ?? 0),
          emergencyPause: Boolean(decodedField(decoded, "emergencyPause")),
          auditNonce: bigintFromAnchorValue(decodedField(decoded, "auditNonce")),
        };
        break;
      case "ReserveDomain":
        snapshot.reserveDomains.push({
          address,
          domainId: stringFromAnchorValue(decodedField(decoded, "domainId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          domainAdmin: asAddress(decodedField(decoded, "domainAdmin")),
          settlementMode: Number(decodedField(decoded, "settlementMode") ?? 0),
          active: Boolean(decodedField(decoded, "active")),
          pauseFlags: Number(decodedField(decoded, "pauseFlags") ?? 0),
        });
        break;
      case "DomainAssetVault":
        snapshot.domainAssetVaults.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          vaultTokenAccount: asAddress(decodedField(decoded, "vaultTokenAccount")),
          totalAssets: bigintFromAnchorValue(decodedField(decoded, "totalAssets")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "ProtocolFeeVault":
        snapshot.protocolFeeVaults.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          feeRecipient: asAddress(decodedField(decoded, "feeRecipient")),
          accruedFees: bigintFromAnchorValue(decodedField(decoded, "accruedFees")),
          withdrawnFees: bigintFromAnchorValue(decodedField(decoded, "withdrawnFees")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "PoolTreasuryVault":
        snapshot.poolTreasuryVaults.push({
          address,
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          feeRecipient: asAddress(decodedField(decoded, "feeRecipient")),
          accruedFees: bigintFromAnchorValue(decodedField(decoded, "accruedFees")),
          withdrawnFees: bigintFromAnchorValue(decodedField(decoded, "withdrawnFees")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "PoolOracleFeeVault":
        snapshot.poolOracleFeeVaults.push({
          address,
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          oracle: asAddress(decodedField(decoded, "oracle")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          feeRecipient: asAddress(decodedField(decoded, "feeRecipient")),
          accruedFees: bigintFromAnchorValue(decodedField(decoded, "accruedFees")),
          withdrawnFees: bigintFromAnchorValue(decodedField(decoded, "withdrawnFees")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "DomainAssetLedger":
        snapshot.domainAssetLedgers.push(
          reserveLedgerSnapshot({
            address,
            reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
            assetMint: asAddress(decodedField(decoded, "assetMint")),
            sheet: decoded.sheet,
          }),
        );
        break;
      case "HealthPlan":
        {
          const membershipModeValue = Number(decodedField(decoded, "membershipMode") ?? 0);
          const membershipGateKindValue = Number(decodedField(decoded, "membershipGateKind") ?? 0);
          snapshot.healthPlans.push({
            address,
            reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
            planId: stringFromAnchorValue(decodedField(decoded, "healthPlanId", "health_plan_id")),
            displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
            sponsorLabel: stringFromAnchorValue(decodedField(decoded, "organizationRef"))
              || shortenAddress(asAddress(decodedField(decoded, "sponsor")), 6),
            planAdmin: asAddress(decodedField(decoded, "planAdmin")),
            sponsorOperator: asAddress(decodedField(decoded, "sponsorOperator")),
            claimsOperator: asAddress(decodedField(decoded, "claimsOperator")),
            oracleAuthority: asAddress(decodedField(decoded, "oracleAuthority")),
            membershipModel: membershipModelLabel(membershipModeValue, membershipGateKindValue),
            membershipGateKind: membershipGateKindLabel(membershipGateKindValue),
            membershipModeValue,
            membershipGateKindValue,
            membershipGateMint: asAddress(decodedField(decoded, "membershipGateMint")),
            membershipGateMinAmount: bigintFromAnchorValue(decodedField(decoded, "membershipGateMinAmount")),
            membershipInviteAuthority: asAddress(decodedField(decoded, "membershipInviteAuthority")),
            pauseFlags: Number(decodedField(decoded, "pauseFlags") ?? 0),
            active: Boolean(decodedField(decoded, "active")),
          });
          break;
        }
      case "PolicySeries":
        {
          const comparabilityHashHex = bytesToHex(decodedField(decoded, "comparabilityHash"));
        snapshot.policySeries.push({
          address,
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          seriesId: stringFromAnchorValue(decodedField(decoded, "seriesId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          metadataUri: stringFromAnchorValue(decodedField(decoded, "metadataUri")),
          mode: Number(decodedField(decoded, "mode") ?? 0),
          status: Number(decodedField(decoded, "status") ?? 0),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          cycleSeconds: numberFromAnchorValue(decodedField(decoded, "cycleSeconds")),
          termsVersion: stringFromAnchorValue(decodedField(decoded, "termsVersion")),
          comparabilityKey: comparabilityHashHex.slice(0, 12) || "unbound",
          comparabilityHashHex,
        });
        break;
        }
      case "MemberPosition":
        snapshot.memberPositions.push({
          address,
          wallet: asAddress(decodedField(decoded, "wallet")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asAddress(decodedField(decoded, "policySeries")),
          eligibilityStatus: Number(decodedField(decoded, "eligibilityStatus") ?? 0),
          delegatedRights: delegatedRightsFromMask(Number(decodedField(decoded, "delegatedRights") ?? 0)),
          active: Boolean(decodedField(decoded, "active")),
        });
        break;
      case "FundingLine":
        snapshot.fundingLines.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          lineId: stringFromAnchorValue(decodedField(decoded, "lineId")),
          displayName: `${describeFundingLineType(Number(decodedField(decoded, "lineType") ?? 0)).replace(/_/g, " ")} · ${stringFromAnchorValue(decodedField(decoded, "lineId"))}`,
          lineType: Number(decodedField(decoded, "lineType") ?? 0),
          fundingPriority: Number(decodedField(decoded, "fundingPriority") ?? 0),
          fundedAmount: bigintFromAnchorValue(decodedField(decoded, "fundedAmount")),
          reservedAmount: bigintFromAnchorValue(decodedField(decoded, "reservedAmount")),
          spentAmount: bigintFromAnchorValue(decodedField(decoded, "spentAmount")),
          releasedAmount: bigintFromAnchorValue(decodedField(decoded, "releasedAmount")),
          returnedAmount: bigintFromAnchorValue(decodedField(decoded, "returnedAmount")),
          status: Number(decodedField(decoded, "status") ?? 0),
        });
        break;
      case "ClaimCase":
        snapshot.claimCases.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          fundingLine: asAddress(decodedField(decoded, "fundingLine")),
          memberPosition: asAddress(decodedField(decoded, "memberPosition")),
          claimant: asAddress(decodedField(decoded, "claimant")),
          adjudicator: asOptionalAddress(decodedField(decoded, "adjudicator")),
          claimId: stringFromAnchorValue(decodedField(decoded, "claimId")),
          intakeStatus: Number(decodedField(decoded, "intakeStatus") ?? 0),
          approvedAmount: bigintFromAnchorValue(decodedField(decoded, "approvedAmount")),
          deniedAmount: bigintFromAnchorValue(decodedField(decoded, "deniedAmount")),
          paidAmount: bigintFromAnchorValue(decodedField(decoded, "paidAmount")),
          reservedAmount: bigintFromAnchorValue(decodedField(decoded, "reservedAmount")),
          linkedObligation: asOptionalAddress(decodedField(decoded, "linkedObligation")),
        });
        break;
      case "Obligation":
        snapshot.obligations.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          assetMint: asAddress(decodedField(decoded, "assetMint")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          memberWallet: asOptionalAddress(decodedField(decoded, "memberWallet")),
          beneficiary: asOptionalAddress(decodedField(decoded, "beneficiary")),
          fundingLine: asAddress(decodedField(decoded, "fundingLine")),
          claimCase: asOptionalAddress(decodedField(decoded, "claimCase")),
          liquidityPool: asOptionalAddress(decodedField(decoded, "liquidityPool")),
          capitalClass: asOptionalAddress(decodedField(decoded, "capitalClass")),
          allocationPosition: asOptionalAddress(decodedField(decoded, "allocationPosition")),
          obligationId: stringFromAnchorValue(decodedField(decoded, "obligationId")),
          status: Number(decodedField(decoded, "status") ?? 0),
          deliveryMode: Number(decodedField(decoded, "deliveryMode") ?? 0),
          principalAmount: bigintFromAnchorValue(decodedField(decoded, "principalAmount")),
          outstandingAmount: bigintFromAnchorValue(decodedField(decoded, "outstandingAmount")),
          reservedAmount: bigintFromAnchorValue(decodedField(decoded, "reservedAmount")),
          claimableAmount: bigintFromAnchorValue(decodedField(decoded, "claimableAmount")),
          payableAmount: bigintFromAnchorValue(decodedField(decoded, "payableAmount")),
          settledAmount: bigintFromAnchorValue(decodedField(decoded, "settledAmount")),
          impairedAmount: bigintFromAnchorValue(decodedField(decoded, "impairedAmount")),
          recoveredAmount: bigintFromAnchorValue(decodedField(decoded, "recoveredAmount")),
        });
        break;
      case "LiquidityPool":
        {
          const strategyHashHex = bytesToHex(decodedField(decoded, "strategyHash"));
          const allowedExposureHashHex = bytesToHex(decodedField(decoded, "allowedExposureHash"));
          const externalYieldAdapterHashHex = bytesToHex(decodedField(decoded, "externalYieldAdapterHash"));
        snapshot.liquidityPools.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          curator: asAddress(decodedField(decoded, "curator")),
          allocator: asAddress(decodedField(decoded, "allocator")),
          sentinel: asAddress(decodedField(decoded, "sentinel")),
          poolId: stringFromAnchorValue(decodedField(decoded, "poolId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          depositAssetMint: asAddress(decodedField(decoded, "depositAssetMint")),
          strategyThesis: isNonZeroHashHex(strategyHashHex)
            ? `strategy:${strategyHashHex.slice(0, 16)}`
            : "canonical_pool",
          strategyHashHex,
          allowedExposureHashHex,
          externalYieldAdapterHashHex,
          redemptionPolicy: Number(decodedField(decoded, "redemptionPolicy") ?? 0),
          pauseFlags: Number(decodedField(decoded, "pauseFlags") ?? 0),
          totalValueLocked: bigintFromAnchorValue(decodedField(decoded, "totalValueLocked")),
          totalAllocated: bigintFromAnchorValue(decodedField(decoded, "totalAllocated")),
          totalReserved: bigintFromAnchorValue(decodedField(decoded, "totalReserved")),
          totalImpaired: bigintFromAnchorValue(decodedField(decoded, "totalImpaired")),
          totalPendingRedemptions: bigintFromAnchorValue(decodedField(decoded, "totalPendingRedemptions")),
          active: Boolean(decodedField(decoded, "active")),
        });
        }
        break;
      case "CapitalClass":
        snapshot.capitalClasses.push({
          address,
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          classId: stringFromAnchorValue(decodedField(decoded, "classId")),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          priority: Number(decodedField(decoded, "priority") ?? 0),
          restrictionMode: Number(decodedField(decoded, "restrictionMode") ?? 0),
          feeBps: Number(decodedField(decoded, "feeBps") ?? decodedField(decoded, "fee_bps") ?? 0),
          totalShares: bigintFromAnchorValue(decodedField(decoded, "totalShares")),
          navAssets: bigintFromAnchorValue(decodedField(decoded, "navAssets")),
          allocatedAssets: bigintFromAnchorValue(decodedField(decoded, "allocatedAssets")),
          pendingRedemptions: bigintFromAnchorValue(decodedField(decoded, "pendingRedemptions")),
          minLockupSeconds: numberFromAnchorValue(decodedField(decoded, "minLockupSeconds")),
          queueOnlyRedemptions: Boolean(decodedField(decoded, "queueOnlyRedemptions")),
          active: Boolean(decodedField(decoded, "active")),
        });
        break;
      case "LPPosition":
        snapshot.lpPositions.push({
          address,
          owner: asAddress(decodedField(decoded, "owner")),
          capitalClass: asAddress(decodedField(decoded, "capitalClass")),
          shares: bigintFromAnchorValue(decodedField(decoded, "shares")),
          subscriptionBasis: bigintFromAnchorValue(decodedField(decoded, "subscriptionBasis")),
          pendingRedemptionShares: bigintFromAnchorValue(decodedField(decoded, "pendingRedemptionShares")),
          pendingRedemptionAssets: bigintFromAnchorValue(decodedField(decoded, "pendingRedemptionAssets")),
          realizedDistributions: bigintFromAnchorValue(decodedField(decoded, "realizedDistributions")),
          impairedPrincipal: bigintFromAnchorValue(decodedField(decoded, "impairedPrincipal")),
          lockupEndsAt: numberFromAnchorValue(decodedField(decoded, "lockupEndsAt")),
          credentialed: Boolean(decodedField(decoded, "credentialed")),
          queueStatus: Number(decodedField(decoded, "queueStatus") ?? 0),
        });
        break;
      case "AllocationPosition":
        snapshot.allocationPositions.push({
          address,
          reserveDomain: asAddress(decodedField(decoded, "reserveDomain")),
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          capitalClass: asAddress(decodedField(decoded, "capitalClass")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan")),
          policySeries: asOptionalAddress(decodedField(decoded, "policySeries")),
          fundingLine: asAddress(decodedField(decoded, "fundingLine")),
          capAmount: bigintFromAnchorValue(decodedField(decoded, "capAmount")),
          weightBps: Number(decodedField(decoded, "weightBps") ?? 0),
          allocatedAmount: bigintFromAnchorValue(decodedField(decoded, "allocatedAmount")),
          utilizedAmount: bigintFromAnchorValue(decodedField(decoded, "utilizedAmount")),
          reservedCapacity: bigintFromAnchorValue(decodedField(decoded, "reservedCapacity")),
          realizedPnl: bigintFromAnchorValue(decodedField(decoded, "realizedPnl")),
          impairedAmount: bigintFromAnchorValue(decodedField(decoded, "impairedAmount")),
          deallocationOnly: Boolean(decodedField(decoded, "deallocationOnly")),
          active: Boolean(decodedField(decoded, "active")),
        });
        break;
      case "PlanReserveLedger":
        planLedgersRaw.push({
          address,
          healthPlan: asAddress(decodedField(decoded, "healthPlan", "health_plan")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet,
        });
        break;
      case "SeriesReserveLedger":
        seriesLedgersRaw.push({
          address,
          policySeries: asAddress(decodedField(decoded, "policySeries", "policy_series")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet,
        });
        break;
      case "FundingLineLedger":
        lineLedgersRaw.push({
          address,
          fundingLine: asAddress(decodedField(decoded, "fundingLine", "funding_line")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet,
        });
        break;
      case "PoolClassLedger":
        snapshot.poolClassLedgers.push({
          address,
          capitalClass: asAddress(decodedField(decoded, "capitalClass", "capital_class")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet as PartialReserveBalanceSheet,
          totalShares: bigintFromAnchorValue(decodedField(decoded, "totalShares", "total_shares")),
          realizedYieldAmount: bigintFromAnchorValue(decodedField(decoded, "realizedYieldAmount", "realized_yield_amount")),
          realizedLossAmount: bigintFromAnchorValue(decodedField(decoded, "realizedLossAmount", "realized_loss_amount")),
        });
        break;
      case "AllocationLedger":
        snapshot.allocationLedgers.push({
          address,
          allocationPosition: asAddress(decodedField(decoded, "allocationPosition", "allocation_position")),
          assetMint: asAddress(decodedField(decoded, "assetMint", "asset_mint")),
          sheet: decoded.sheet as PartialReserveBalanceSheet,
          realizedPnl: bigintFromAnchorValue(decodedField(decoded, "realizedPnl", "realized_pnl")),
        });
        break;
      case "OracleProfile":
        snapshot.oracleProfiles.push({
          address,
          oracle: asAddress(decodedField(decoded, "oracle")),
          admin: asAddress(decodedField(decoded, "admin")),
          oracleType: Number(decodedField(decoded, "oracleType") ?? 0),
          displayName: stringFromAnchorValue(decodedField(decoded, "displayName")),
          legalName: stringFromAnchorValue(decodedField(decoded, "legalName")),
          websiteUrl: stringFromAnchorValue(decodedField(decoded, "websiteUrl")),
          appUrl: stringFromAnchorValue(decodedField(decoded, "appUrl")),
          logoUri: stringFromAnchorValue(decodedField(decoded, "logoUri")),
          webhookUrl: stringFromAnchorValue(decodedField(decoded, "webhookUrl")),
          supportedSchemaCount: Number(decodedField(decoded, "supportedSchemaCount") ?? 0),
          supportedSchemaKeyHashesHex: Array.isArray(decodedField(decoded, "supportedSchemaKeyHashes"))
            ? decodedField<Array<Uint8Array | number[]>>(decoded, "supportedSchemaKeyHashes")!
              .map((value) => bytesToHex(value))
              .filter(Boolean)
              .slice(0, Number(decodedField(decoded, "supportedSchemaCount") ?? 0) || undefined)
            : [],
          active: Boolean(decodedField(decoded, "active")),
          claimed: Boolean(decodedField(decoded, "claimed")),
          createdAtTs: numberFromAnchorValue(decodedField(decoded, "createdAtTs")),
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "PoolOracleApproval":
        snapshot.poolOracleApprovals.push({
          address,
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          oracle: asAddress(decodedField(decoded, "oracle")),
          active: Boolean(decodedField(decoded, "active")),
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "PoolOraclePolicy":
        snapshot.poolOraclePolicies.push({
          address,
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          quorumM: Number(decodedField(decoded, "quorumM") ?? 0),
          quorumN: Number(decodedField(decoded, "quorumN") ?? 0),
          requireVerifiedSchema: Boolean(decodedField(decoded, "requireVerifiedSchema")),
          oracleFeeBps: Number(decodedField(decoded, "oracleFeeBps") ?? 0),
          allowDelegateClaim: Boolean(decodedField(decoded, "allowDelegateClaim")),
          challengeWindowSecs: Number(decodedField(decoded, "challengeWindowSecs") ?? 0),
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "PoolOraclePermissionSet":
        snapshot.poolOraclePermissionSets.push({
          address,
          liquidityPool: asAddress(decodedField(decoded, "liquidityPool")),
          oracle: asAddress(decodedField(decoded, "oracle")),
          permissions: Number(decodedField(decoded, "permissions") ?? 0),
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "OutcomeSchema":
        snapshot.outcomeSchemas.push({
          address,
          publisher: asAddress(decodedField(decoded, "publisher")),
          schemaKeyHashHex: bytesToHex(decodedField(decoded, "schemaKeyHash", "schema_key_hash")),
          schemaKey: stringFromAnchorValue(decodedField(decoded, "schemaKey", "schema_key")),
          version: Number(decodedField(decoded, "version") ?? 0),
          schemaHashHex: bytesToHex(decodedField(decoded, "schemaHash", "schema_hash")),
          schemaFamily: Number(decodedField(decoded, "schemaFamily", "schema_family") ?? 0),
          visibility: Number(decodedField(decoded, "visibility") ?? 0),
          metadataUri: stringFromAnchorValue(decodedField(decoded, "metadataUri", "metadata_uri")),
          verified: Boolean(decodedField(decoded, "verified")),
          createdAtTs: numberFromAnchorValue(decodedField(decoded, "createdAtTs", "created_at_ts")),
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs", "updated_at_ts")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "SchemaDependencyLedger":
        snapshot.schemaDependencyLedgers.push({
          address,
          schemaKeyHashHex: bytesToHex(decodedField(decoded, "schemaKeyHash", "schema_key_hash")),
          poolRuleAddresses: Array.isArray(decodedField(decoded, "poolRuleAddresses", "pool_rule_addresses"))
            ? decodedField<Array<PublicKeyish>>(decoded, "poolRuleAddresses", "pool_rule_addresses")!
              .map((value) => asAddress(value))
            : [],
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs", "updated_at_ts")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      case "ClaimAttestation": {
        const policySeriesValue = decodedField(decoded, "policySeries", "policy_series");
        const policySeries = policySeriesValue ? asAddress(policySeriesValue) : null;
        snapshot.claimAttestations.push({
          address,
          oracle: asAddress(decodedField(decoded, "oracle")),
          oracleProfile: asAddress(decodedField(decoded, "oracleProfile", "oracle_profile")),
          claimCase: asAddress(decodedField(decoded, "claimCase", "claim_case")),
          healthPlan: asAddress(decodedField(decoded, "healthPlan", "health_plan")),
          policySeries: policySeries && policySeries !== ZERO_PUBKEY ? policySeries : null,
          decision: Number(decodedField(decoded, "decision") ?? 0),
          attestationHashHex: bytesToHex(decodedField(decoded, "attestationHash", "attestation_hash")),
          attestationRefHashHex: bytesToHex(
            decodedField(decoded, "attestationRefHash", "attestation_ref_hash"),
          ),
          schemaKeyHashHex: bytesToHex(decodedField(decoded, "schemaKeyHash", "schema_key_hash")),
          createdAtTs: numberFromAnchorValue(decodedField(decoded, "createdAtTs", "created_at_ts")),
          updatedAtTs: numberFromAnchorValue(decodedField(decoded, "updatedAtTs", "updated_at_ts")),
          bump: Number(decodedField(decoded, "bump") ?? 0),
        });
        break;
      }
      default:
        break;
    }
  }

  const planToDomain = new Map(snapshot.healthPlans.map((plan) => [plan.address, plan.reserveDomain]));
  const seriesToDomain = new Map(
    snapshot.policySeries.map((series) => [series.address, planToDomain.get(series.healthPlan) ?? ZERO_PUBKEY]),
  );
  const lineToDomain = new Map(snapshot.fundingLines.map((line) => [line.address, line.reserveDomain]));

  snapshot.planReserveLedgers = planLedgersRaw.map((ledger) =>
    reserveLedgerSnapshot({
      address: ledger.address,
      reserveDomain: planToDomain.get(ledger.healthPlan) ?? ZERO_PUBKEY,
      assetMint: ledger.assetMint,
      sheet: ledger.sheet,
    }),
  );
  snapshot.seriesReserveLedgers = seriesLedgersRaw.map((ledger) =>
    reserveLedgerSnapshot({
      address: ledger.address,
      reserveDomain: seriesToDomain.get(ledger.policySeries) ?? ZERO_PUBKEY,
      assetMint: ledger.assetMint,
      sheet: ledger.sheet,
    }),
  );
  snapshot.fundingLineLedgers = lineLedgersRaw.map((ledger) =>
    reserveLedgerSnapshot({
      address: ledger.address,
      reserveDomain: lineToDomain.get(ledger.fundingLine) ?? ZERO_PUBKEY,
      assetMint: ledger.assetMint,
      sheet: ledger.sheet,
    }),
  );

  snapshot.reserveDomains = sortByLabel(snapshot.reserveDomains, (row) => row.displayName || row.domainId);
  snapshot.domainAssetVaults = sortByLabel(
    snapshot.domainAssetVaults,
    (row) => `${row.reserveDomain}:${row.assetMint}`,
  );
  snapshot.healthPlans = sortByLabel(snapshot.healthPlans, (row) => row.displayName || row.planId);
  snapshot.policySeries = sortByLabel(snapshot.policySeries, (row) => row.displayName || row.seriesId);
  snapshot.fundingLines = sortByLabel(snapshot.fundingLines, (row) => row.displayName || row.lineId);
  snapshot.claimCases = sortByLabel(snapshot.claimCases, (row) => row.claimId);
  snapshot.obligations = sortByLabel(snapshot.obligations, (row) => row.obligationId);
  snapshot.liquidityPools = sortByLabel(snapshot.liquidityPools, (row) => row.displayName || row.poolId);
  snapshot.capitalClasses = sortByLabel(snapshot.capitalClasses, (row) => row.displayName || row.classId);
  snapshot.memberPositions = sortByLabel(snapshot.memberPositions, (row) => `${row.healthPlan}:${row.wallet}`);
  snapshot.lpPositions = sortByLabel(snapshot.lpPositions, (row) => `${row.capitalClass}:${row.owner}`);
  snapshot.allocationPositions = sortByLabel(snapshot.allocationPositions, (row) => `${row.capitalClass}:${row.fundingLine}`);
  snapshot.oracleProfiles = sortByLabel(snapshot.oracleProfiles, (row) => row.displayName || row.oracle);
  snapshot.poolOracleApprovals = sortByLabel(snapshot.poolOracleApprovals, (row) => `${row.liquidityPool}:${row.oracle}`);
  snapshot.poolOraclePolicies = sortByLabel(snapshot.poolOraclePolicies, (row) => row.liquidityPool);
  snapshot.poolOraclePermissionSets = sortByLabel(snapshot.poolOraclePermissionSets, (row) => `${row.liquidityPool}:${row.oracle}`);
  snapshot.outcomeSchemas = sortByLabel(snapshot.outcomeSchemas, (row) => `${row.schemaKey}:${row.version}`);
  snapshot.schemaDependencyLedgers = sortByLabel(snapshot.schemaDependencyLedgers, (row) => row.schemaKeyHashHex);
  snapshot.claimAttestations.sort((left, right) =>
    right.createdAtTs - left.createdAtTs || left.address.localeCompare(right.address),
  );

  return snapshot;
}

function matchesSearch(haystacks: Array<string | null | undefined>, search?: string | null): boolean {
  const needle = search?.trim().toLowerCase();
  if (!needle) return true;
  return haystacks.some((value) => value?.toLowerCase().includes(needle));
}

function buildInstructionAccounts(
  accounts: Array<{ pubkey: PublicKeyish; isSigner?: boolean; isWritable?: boolean }>,
) {
  return accounts.map((account) => ({
    pubkey: toPublicKey(account.pubkey),
    isSigner: Boolean(account.isSigner),
    isWritable: Boolean(account.isWritable),
  }));
}

function buildProtocolInstruction(
  name: string,
  args: Record<string, unknown>,
  accounts: Array<{ pubkey: PublicKeyish; isSigner?: boolean; isWritable?: boolean }>,
): TransactionInstruction {
  const definition = PROTOCOL_IDL.instructions.find((instruction) => instruction.name === name);
  const normalizedArgs = definition?.args?.length === 1
    && definition.args[0]?.name === "args"
    && !Object.prototype.hasOwnProperty.call(args, "args")
    ? { args }
    : args;
  const encodedArgs = normalizeInstructionArgsValue(normalizedArgs);
  return new TransactionInstruction({
    programId: getProgramId(),
    keys: buildInstructionAccounts(accounts),
    data: PROTOCOL_CODER.instruction.encode(name, encodedArgs),
  });
}

function normalizeInstructionArgsValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return new BN(value.toString());
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeInstructionArgsValue(item));
  }
  if (
    value instanceof PublicKey
    || (
      value
      && typeof value === "object"
      && "toBuffer" in value
      && typeof value.toBuffer === "function"
      && "toBase58" in value
      && typeof value.toBase58 === "function"
    )
    || value instanceof Uint8Array
    || Buffer.isBuffer(value)
    || value === null
    || value === undefined
  ) {
    return value;
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, normalizeInstructionArgsValue(currentValue)]),
    );
  }
  return value;
}

function buildProtocolTransaction(params: {
  feePayer: PublicKeyish;
  recentBlockhash: string;
  instructions: TransactionInstruction[];
}): Transaction {
  return new Transaction({
    feePayer: toPublicKey(params.feePayer),
    recentBlockhash: params.recentBlockhash,
  }).add(...params.instructions);
}

export type ProtocolInstructionAccountInput = {
  pubkey?: PublicKeyish | null;
  isSigner?: boolean;
  isWritable?: boolean;
};

function normalizeProtocolInstructionAccounts(
  accounts: ProtocolInstructionAccountInput[],
): Array<{ pubkey: PublicKeyish; isSigner?: boolean; isWritable?: boolean }> {
  return accounts.map((account) => {
    const pubkey = account.pubkey ?? getProgramId();
    return {
      pubkey,
      isSigner: account.pubkey ? Boolean(account.isSigner) : false,
      isWritable: account.pubkey ? Boolean(account.isWritable) : false,
    };
  });
}

function optionalProtocolAccount(
  pubkey?: PublicKeyish | null,
  isWritable = false,
): ProtocolInstructionAccountInput {
  return pubkey
    ? { pubkey, isWritable }
    : { pubkey: undefined, isWritable: false };
}

function optionalSeriesReserveLedgerAccount(
  policySeriesAddress: PublicKeyish | null | undefined,
  assetMint: PublicKeyish | null | undefined,
): ProtocolInstructionAccountInput {
  if (!policySeriesAddress || !assetMint) return optionalProtocolAccount(undefined);
  return optionalProtocolAccount(
    deriveSeriesReserveLedgerPda({ policySeries: policySeriesAddress, assetMint }),
    true,
  );
}

function optionalPoolClassLedgerAccount(
  capitalClassAddress: PublicKeyish | null | undefined,
  poolAssetMint: PublicKeyish | null | undefined,
): ProtocolInstructionAccountInput {
  if (!capitalClassAddress || !poolAssetMint) return optionalProtocolAccount(undefined);
  return optionalProtocolAccount(
    derivePoolClassLedgerPda({ capitalClass: capitalClassAddress, assetMint: poolAssetMint }),
    true,
  );
}

function optionalAllocationLedgerAccount(
  allocationPositionAddress: PublicKeyish | null | undefined,
  assetMint: PublicKeyish | null | undefined,
): ProtocolInstructionAccountInput {
  if (!allocationPositionAddress || !assetMint) return optionalProtocolAccount(undefined);
  return optionalProtocolAccount(
    deriveAllocationLedgerPda({ allocationPosition: allocationPositionAddress, assetMint }),
    true,
  );
}

export function buildProtocolTransactionFromInstruction(params: {
  feePayer: PublicKeyish;
  recentBlockhash: string;
  instructionName: string;
  args: Record<string, unknown>;
  accounts: ProtocolInstructionAccountInput[];
}): Transaction {
  const instruction = buildProtocolInstruction(
    params.instructionName,
    params.args,
    normalizeProtocolInstructionAccounts(params.accounts),
  );
  return buildProtocolTransaction({
    feePayer: params.feePayer,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

function oracleMetadataUri(profile: OracleProfileSummary): string {
  return profile.logoUri || profile.websiteUrl || profile.appUrl || "";
}

function mapOracleSummary(profile: OracleProfileSummary): OracleWithProfileSummary {
  return {
    address: profile.address,
    oracle: profile.oracle,
    active: profile.active,
    claimed: profile.claimed,
    admin: profile.admin,
    bump: profile.bump,
    metadataUri: oracleMetadataUri(profile),
    profile,
  };
}

function configuredPublicKeyFromEnv(value?: string | null): string {
  const normalized = value?.trim();
  if (!normalized) return ZERO_PUBKEY;
  try {
    return new PublicKey(normalized).toBase58();
  } catch {
    return ZERO_PUBKEY;
  }
}

function poolAddressForSeriesInSnapshot(
  seriesAddress: string,
  snapshot: Pick<ProtocolConsoleSnapshot, "allocationPositions">,
): string | null {
  return snapshot.allocationPositions.find((allocation) => allocation.policySeries === seriesAddress)?.liquidityPool ?? null;
}

function schemaVersionForSeries(
  series: PolicySeriesSnapshot,
  snapshot: Pick<ProtocolConsoleSnapshot, "outcomeSchemas">,
): number {
  const directMatch = series.comparabilityHashHex
    ? snapshot.outcomeSchemas.find((schema) =>
      schema.schemaKeyHashHex === series.comparabilityHashHex
      && schema.version === Number.parseInt(series.termsVersion, 10),
    ) ?? snapshot.outcomeSchemas.find((schema) => schema.schemaKeyHashHex === series.comparabilityHashHex) ?? null
    : null;
  if (directMatch) return directMatch.version;
  const parsedVersion = Number.parseInt(series.termsVersion, 10);
  return Number.isFinite(parsedVersion) ? parsedVersion : 0;
}

function isNonZeroHashHex(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase().replace(/^0x/, "") ?? "";
  return /^[0-9a-f]{64}$/.test(normalized) && normalized !== ZERO_HASH_HEX;
}

export function hasConfiguredPoolTerms(
  pool?: Pick<LiquidityPoolSnapshot, "strategyHashHex" | "allowedExposureHashHex" | "externalYieldAdapterHashHex"> | null,
): boolean {
  return Boolean(
    pool
    && isNonZeroHashHex(pool.strategyHashHex)
    && isNonZeroHashHex(pool.allowedExposureHashHex)
    && isNonZeroHashHex(pool.externalYieldAdapterHashHex),
  );
}

function protocolConfigFromSnapshot(snapshot: ProtocolConsoleSnapshot): ProtocolConfigSummary | null {
  if (!snapshot.protocolGovernance) return null;
  const governanceRealm = configuredPublicKeyFromEnv(process.env.NEXT_PUBLIC_GOVERNANCE_REALM);
  const governanceConfig = configuredPublicKeyFromEnv(process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG);
  return {
    address: snapshot.protocolGovernance.address,
    admin: snapshot.protocolGovernance.governanceAuthority,
    governanceAuthority: snapshot.protocolGovernance.governanceAuthority,
    governanceRealm,
    governanceConfig,
    protocolFeeBps: snapshot.protocolGovernance.protocolFeeBps,
    defaultStakeMint: ZERO_PUBKEY,
    minOracleStake: 0n,
    emergencyPaused: snapshot.protocolGovernance.emergencyPause,
    allowedPayoutMintsHashHex: ZERO_HASH_HEX,
  };
}

function poolOrganizationRef(
  pool: LiquidityPoolSnapshot,
  snapshot: Pick<ProtocolConsoleSnapshot, "reserveDomains" | "allocationPositions" | "healthPlans">,
): string {
  const fundingAllocation = snapshot.allocationPositions.find((allocation) => allocation.liquidityPool === pool.address);
  const sponsorLabel = fundingAllocation
    ? snapshot.healthPlans.find((plan) => plan.address === fundingAllocation.healthPlan)?.sponsorLabel ?? null
    : null;
  if (sponsorLabel) return sponsorLabel;
  return snapshot.reserveDomains.find((domain) => domain.address === pool.reserveDomain)?.displayName ?? pool.displayName;
}

function mapPoolSummary(
  pool: LiquidityPoolSnapshot,
  snapshot: Pick<ProtocolConsoleSnapshot, "reserveDomains" | "allocationPositions" | "healthPlans">,
): PoolSummary {
  return {
    address: pool.address,
    poolId: pool.poolId,
    displayName: pool.displayName,
    reserveDomain: pool.reserveDomain,
    depositAssetMint: pool.depositAssetMint,
    authority: pool.curator || pool.allocator || pool.sentinel || ZERO_PUBKEY,
    organizationRef: poolOrganizationRef(pool, snapshot),
    active: pool.active,
  };
}

export type ProtocolReadiness = {
  protocolConfigExists: boolean;
  /** Alias of protocolConfigExists for legacy ui-capabilities call sites. */
  configInitialized?: boolean;
  poolExists: boolean;
  oracleRegistered: boolean;
  oracleProfileExists: boolean;
  poolOracleApproved: boolean;
  poolOraclePolicyConfigured: boolean;
  oracleStakePositionExists: boolean;
  inviteIssuerRegistered: boolean;
  schemaRegistered: boolean;
  ruleRegistered: boolean;
  memberEnrolled: boolean;
  claimDelegateConfigured: boolean;
  poolTermsConfigured: boolean;
  poolAssetVaultConfigured: boolean;
  coveragePolicyExists: boolean;
  coveragePolicyNftExists: boolean;
  premiumLedgerTracked: boolean;
  derived: {
    configAddress: string | null;
    poolAddress: string | null;
    poolTermsAddress: string | null;
    poolAssetVaultAddress: string | null;
    oracleEntryAddress: string | null;
    oracleProfileAddress: string | null;
    poolOracleAddress: string | null;
    poolOraclePolicyAddress: string | null;
    oracleStakeAddress: string | null;
    inviteIssuerAddress: string | null;
    membershipAddress: string | null;
    claimDelegateAddress: string | null;
    schemaAddress: string | null;
    ruleAddress: string | null;
    coveragePolicyAddress: string | null;
    coverageNftAddress: string | null;
    premiumLedgerAddress: string | null;
  };
};

export function clearProtocolDiscoveryCache(): void {
  // The canonical adapter currently reads live chain state directly for every discovery request.
}

export async function listOraclesWithProfiles(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<OracleWithProfileSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.oracleProfiles
    .map(mapOracleSummary)
    .filter((oracle) => !params.activeOnly || oracle.active)
    .filter((oracle) =>
      matchesSearch(
        [
          oracle.oracle,
          oracle.admin,
          oracle.profile?.displayName,
          oracle.profile?.legalName,
          oracle.profile?.websiteUrl,
          oracle.profile?.appUrl,
          oracle.metadataUri,
          oracle.claimed ? "claimed" : "unclaimed",
        ],
        params.search,
      ),
    );
}

export async function listOracles(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<OracleSummary[]> {
  return listOraclesWithProfiles(params);
}

export async function listPoolOracleApprovals(params: {
  connection: Connection;
  poolAddress?: string | null;
  activeOnly?: boolean;
}): Promise<PoolOracleApprovalSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.poolOracleApprovals.filter((approval) =>
    (!params.poolAddress || approval.liquidityPool === params.poolAddress)
    && (!params.activeOnly || approval.active),
  );
}

// Phase 1.6/1.7 — Fee-vault listers. All three follow the snapshot-derived
// pattern (one chain read in `loadProtocolConsoleSnapshot`, then in-memory
// filtering). `paymentMint` is mapped: NATIVE_SOL_MINT → ZERO_PUBKEY for the
// panel's SOL detection; everything else passes through verbatim.

function paymentMintForUi(assetMint: string): string {
  return assetMint === NATIVE_SOL_MINT ? ZERO_PUBKEY : assetMint;
}

function feeVaultAvailable(accrued: bigint, withdrawn: bigint): bigint {
  // Saturating sub: defends against a transient indexing race where the
  // chain reads `withdrawn > accrued` momentarily.
  return withdrawn >= accrued ? 0n : accrued - withdrawn;
}

export async function listProtocolFeeVaults(params: {
  connection: Connection;
  reserveDomainAddress?: string | null;
  paymentMint?: string | null;
}): Promise<ProtocolFeeVaultSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.protocolFeeVaults
    .filter((vault) => !params.reserveDomainAddress || vault.reserveDomain === params.reserveDomainAddress)
    .filter((vault) => !params.paymentMint || paymentMintForUi(vault.assetMint) === params.paymentMint)
    .map((vault) => ({
      address: vault.address,
      reserveDomain: vault.reserveDomain,
      paymentMint: paymentMintForUi(vault.assetMint),
      feeRecipient: vault.feeRecipient,
      accruedFees: vault.accruedFees,
      withdrawnFees: vault.withdrawnFees,
      availableFees: feeVaultAvailable(vault.accruedFees, vault.withdrawnFees),
      bump: vault.bump,
    }));
}

export async function listPoolTreasuryReserves(params: {
  connection: Connection;
  poolAddress: string;
  paymentMint?: string | null;
}): Promise<PoolTreasuryReserveSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  // Resolve reserve domain for each pool by joining with the pool snapshot.
  const poolByAddress = new Map(snapshot.liquidityPools.map((pool) => [pool.address, pool]));
  return snapshot.poolTreasuryVaults
    .filter((vault) => vault.liquidityPool === params.poolAddress)
    .filter((vault) => !params.paymentMint || paymentMintForUi(vault.assetMint) === params.paymentMint)
    .map((vault) => ({
      address: vault.address,
      pool: vault.liquidityPool,
      reserveDomain: poolByAddress.get(vault.liquidityPool)?.reserveDomain ?? ZERO_PUBKEY,
      paymentMint: paymentMintForUi(vault.assetMint),
      feeRecipient: vault.feeRecipient,
      accruedFees: vault.accruedFees,
      withdrawnFees: vault.withdrawnFees,
      availableFees: feeVaultAvailable(vault.accruedFees, vault.withdrawnFees),
      // TODO (PR3 follow-up): populate by joining DomainAssetLedger sheets
      // for the matching (reserve_domain, asset_mint) so the panel's display
      // counters match the on-chain ledger. The panel renders these read-only
      // and PR3 ships them as 0n so the UI doesn't crash.
      reservedRewardAmount: 0n,
      reservedCoverageClaimAmount: 0n,
      paidCoverageClaimAmount: 0n,
      impairedAmount: 0n,
      bump: vault.bump,
    }));
}

export async function listPoolOracleFeeVaults(params: {
  connection: Connection;
  poolAddress: string;
  oracleAddress?: string | null;
  paymentMint?: string | null;
}): Promise<PoolOracleFeeVaultSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const poolByAddress = new Map(snapshot.liquidityPools.map((pool) => [pool.address, pool]));
  return snapshot.poolOracleFeeVaults
    .filter((vault) => vault.liquidityPool === params.poolAddress)
    .filter((vault) => !params.oracleAddress || vault.oracle === params.oracleAddress)
    .filter((vault) => !params.paymentMint || paymentMintForUi(vault.assetMint) === params.paymentMint)
    .map((vault) => ({
      address: vault.address,
      pool: vault.liquidityPool,
      reserveDomain: poolByAddress.get(vault.liquidityPool)?.reserveDomain ?? ZERO_PUBKEY,
      oracle: vault.oracle,
      paymentMint: paymentMintForUi(vault.assetMint),
      feeRecipient: vault.feeRecipient,
      accruedFees: vault.accruedFees,
      withdrawnFees: vault.withdrawnFees,
      availableFees: feeVaultAvailable(vault.accruedFees, vault.withdrawnFees),
      bump: vault.bump,
    }));
}

export async function listPoolOraclePolicies(params: {
  connection: Connection;
  poolAddress?: string | null;
}): Promise<PoolOraclePolicySummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.poolOraclePolicies.filter((policy) =>
    !params.poolAddress || policy.liquidityPool === params.poolAddress,
  );
}

export async function listPoolOraclePermissionSets(params: {
  connection: Connection;
  poolAddress?: string | null;
}): Promise<PoolOraclePermissionSetSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.poolOraclePermissionSets.filter((permissionSet) =>
    !params.poolAddress || permissionSet.liquidityPool === params.poolAddress,
  );
}

export async function fetchProtocolConfig(params: {
  connection: Connection;
}): Promise<ProtocolConfigSummary | null> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return protocolConfigFromSnapshot(snapshot);
}

export async function listProtocolConfig(params: {
  connection: Connection;
}): Promise<ProtocolConfigSummary[]> {
  const config = await fetchProtocolConfig(params);
  return config ? [config] : [];
}

export async function listPools(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<PoolSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.liquidityPools
    .map((pool) => mapPoolSummary(pool, snapshot))
    .filter((pool) => !params.activeOnly || pool.active)
    .filter((pool) =>
      matchesSearch(
        [
          pool.address,
          pool.poolId,
          pool.displayName,
          pool.reserveDomain,
          pool.depositAssetMint,
          pool.organizationRef,
          pool.authority,
          pool.active ? "active" : "inactive",
        ],
        params.search,
      ),
    );
}

export async function listReserveDomains(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<ReserveDomainSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.reserveDomains
    .filter((domain) => !params.activeOnly || domain.active)
    .filter((domain) =>
      matchesSearch(
        [
          domain.domainId,
          domain.displayName,
          domain.domainAdmin,
          domain.active ? "active" : "inactive",
        ],
        params.search,
      ),
    );
}

export async function listDomainAssetVaults(params: {
  connection: Connection;
  reserveDomainAddress?: string | null;
  assetMint?: string | null;
  search?: string | null;
}): Promise<DomainAssetVaultSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const reserveDomainAddress = params.reserveDomainAddress?.trim();
  const assetMint = params.assetMint?.trim();
  return snapshot.domainAssetVaults
    .filter((vault) => !reserveDomainAddress || vault.reserveDomain === reserveDomainAddress)
    .filter((vault) => !assetMint || vault.assetMint === assetMint)
    .filter((vault) =>
      matchesSearch(
        [
          vault.address,
          vault.reserveDomain,
          vault.assetMint,
          vault.vaultTokenAccount,
        ],
        params.search,
      ),
    );
}

export async function listSchemas(params: {
  connection: Connection;
  verifiedOnly?: boolean;
  search?: string | null;
}): Promise<SchemaSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  return snapshot.outcomeSchemas
    .filter((schema) => !params.verifiedOnly || schema.verified)
    .filter((schema) =>
      matchesSearch(
        [
          schema.schemaKey,
          schema.schemaKeyHashHex,
          schema.schemaHashHex,
          schema.metadataUri,
          schema.verified ? "verified" : "unverified",
        ],
        params.search,
      ),
    );
}

export async function listSchemaDependencyLedgers(params: {
  connection: Connection;
  schemaKeyHashHex?: string | null;
}): Promise<SchemaDependencyLedgerSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const targetHash = params.schemaKeyHashHex?.trim().toLowerCase();
  return snapshot.schemaDependencyLedgers.filter((ledger) =>
    !targetHash || ledger.schemaKeyHashHex.toLowerCase() === targetHash,
  );
}

export async function listPoolRules(params: {
  connection: Connection;
  poolAddress?: string | null;
  schemaKeyHashHex?: string | null;
  enabledOnly?: boolean;
  search?: string | null;
}): Promise<RuleSummary[]> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const rules: RuleSummary[] = snapshot.policySeries
    .map<RuleSummary | null>((series) => {
      const pool = poolAddressForSeriesInSnapshot(series.address, snapshot);
      if (!pool || !series.comparabilityHashHex) return null;
      const version = schemaVersionForSeries(series, snapshot);
      return {
        address: series.address,
        ruleId: `${series.seriesId}:v${version}`,
        pool,
        schemaKeyHashHex: series.comparabilityHashHex,
        schemaVersion: version,
        enabled: true,
        policySeries: series.address,
        healthPlan: series.healthPlan,
      };
    })
    .filter((rule): rule is RuleSummary => rule !== null);
  return rules
    .filter((rule) => !params.poolAddress || rule.pool === params.poolAddress)
    .filter((rule) => !params.schemaKeyHashHex || rule.schemaKeyHashHex.toLowerCase() === params.schemaKeyHashHex.trim().toLowerCase())
    .filter((rule) => !params.enabledOnly || rule.enabled)
    .filter((rule) =>
      matchesSearch(
        [
          rule.ruleId,
          rule.address,
          rule.pool,
          rule.policySeries,
          rule.healthPlan,
          rule.schemaKeyHashHex,
          rule.enabled ? "enabled" : "disabled",
        ],
        params.search,
      ),
    );
}

export async function fetchProtocolReadiness(params: {
  connection: Connection;
  poolAddress?: string | null;
  oracleAddress?: string | null;
  memberAddress?: string | null;
  stakerAddress?: string | null;
  schemaKeyHashHex?: string | null;
  ruleHashHex?: string | null;
}): Promise<ProtocolReadiness> {
  const snapshot = await loadProtocolConsoleSnapshot(params.connection);
  const poolAddress = params.poolAddress?.trim() || null;
  const oracleAddress = params.oracleAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const schemaKeyHashHex = normalizeOptionalHex32(params.schemaKeyHashHex);
  const ruleHashHex = normalizeOptionalHex32(params.ruleHashHex);

  const pool = poolAddress
    ? snapshot.liquidityPools.find((entry) => entry.address === poolAddress) ?? null
    : null;
  const oracleProfile = oracleAddress
    ? snapshot.oracleProfiles.find((entry) => entry.oracle === oracleAddress || entry.address === oracleAddress) ?? null
    : null;
  const poolOracleApproval = pool && oracleAddress
    ? snapshot.poolOracleApprovals.find((entry) => entry.liquidityPool === pool.address && entry.oracle === oracleAddress)
      ?? null
    : null;
  const poolOraclePolicy = pool
    ? snapshot.poolOraclePolicies.find((entry) => entry.liquidityPool === pool.address) ?? null
    : null;
  const matchingSchema = schemaKeyHashHex
    ? snapshot.outcomeSchemas.find((entry) => entry.schemaKeyHashHex.toLowerCase() === schemaKeyHashHex) ?? null
    : null;
  const matchingRuleSeries = snapshot.policySeries.find((series) => {
    const poolMatches = !pool || poolAddressForSeriesInSnapshot(series.address, snapshot) === pool.address;
    const schemaMatches = !schemaKeyHashHex
      || series.comparabilityHashHex?.toLowerCase() === schemaKeyHashHex;
    const ruleMatches = !ruleHashHex || series.comparabilityHashHex?.toLowerCase() === ruleHashHex;
    return poolMatches && schemaMatches && ruleMatches;
  }) ?? null;
  const memberPosition = memberAddress
    ? snapshot.memberPositions.find((entry) => entry.wallet === memberAddress)
      ?? null
    : null;
  const matchingFundingLine = pool
    ? snapshot.allocationPositions.find((entry) => entry.liquidityPool === pool.address)?.fundingLine ?? null
    : null;
  const domainAssetVault = pool
    ? snapshot.domainAssetVaults.find((entry) =>
      entry.reserveDomain === pool.reserveDomain && entry.assetMint === pool.depositAssetMint,
    ) ?? null
    : null;
  const poolHasCoverageFlow = pool
    ? snapshot.allocationPositions.some((entry) => entry.liquidityPool === pool.address)
    : false;
  const premiumIncomeTracked = pool && matchingFundingLine
    ? snapshot.fundingLines.some((line) =>
      line.address === matchingFundingLine && line.lineType === FUNDING_LINE_TYPE_PREMIUM_INCOME,
    )
    : false;
  const poolTermsConfigured = hasConfiguredPoolTerms(pool);

  return {
    protocolConfigExists: Boolean(snapshot.protocolGovernance),
    poolExists: Boolean(pool),
    oracleRegistered: Boolean(oracleProfile),
    oracleProfileExists: Boolean(oracleProfile),
    poolOracleApproved: Boolean(poolOracleApproval?.active),
    poolOraclePolicyConfigured: Boolean(poolOraclePolicy),
    oracleStakePositionExists: false,
    inviteIssuerRegistered: false,
    schemaRegistered: Boolean(matchingSchema),
    ruleRegistered: Boolean(matchingRuleSeries),
    memberEnrolled: Boolean(memberPosition),
    claimDelegateConfigured: false,
    poolTermsConfigured,
    poolAssetVaultConfigured: Boolean(domainAssetVault),
    coveragePolicyExists: poolHasCoverageFlow,
    coveragePolicyNftExists: false,
    premiumLedgerTracked: premiumIncomeTracked,
    derived: {
      configAddress: snapshot.protocolGovernance?.address ?? null,
      poolAddress: pool?.address ?? poolAddress,
      poolTermsAddress: poolTermsConfigured ? pool?.address ?? null : null,
      poolAssetVaultAddress: domainAssetVault?.address ?? null,
      oracleEntryAddress: oracleProfile?.address ?? null,
      oracleProfileAddress: oracleProfile?.address ?? null,
      poolOracleAddress: poolOracleApproval?.address ?? null,
      poolOraclePolicyAddress: poolOraclePolicy?.address ?? null,
      oracleStakeAddress: params.stakerAddress?.trim() || null,
      inviteIssuerAddress: null,
      membershipAddress: memberPosition?.address ?? null,
      claimDelegateAddress: null,
      schemaAddress: matchingSchema?.address ?? null,
      ruleAddress: matchingRuleSeries?.address ?? null,
      coveragePolicyAddress: matchingFundingLine,
      coverageNftAddress: null,
      premiumLedgerAddress: premiumIncomeTracked ? matchingFundingLine : null,
    },
  };
}

export function buildInitializeProtocolGovernanceTx(params: {
  governanceAuthority: PublicKeyish;
  recentBlockhash: string;
  protocolFeeBps: number;
  emergencyPaused: boolean;
}): Transaction {
  const governanceAuthority = toPublicKey(params.governanceAuthority);
  return buildProtocolTransactionFromInstruction({
    feePayer: governanceAuthority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "initialize_protocol_governance",
    args: {
      protocol_fee_bps: params.protocolFeeBps,
      emergency_pause: params.emergencyPaused,
    },
    accounts: [
      { pubkey: governanceAuthority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda(), isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildRotateGovernanceAuthorityTx(params: {
  governanceAuthority: PublicKeyish;
  newAuthority: PublicKeyish;
  recentBlockhash: string;
}): Transaction {
  const governanceAuthority = toPublicKey(params.governanceAuthority);
  const newAuthority = toPublicKey(params.newAuthority);
  return buildProtocolTransactionFromInstruction({
    feePayer: governanceAuthority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "rotate_protocol_governance_authority",
    args: {
      new_governance_authority: newAuthority,
    },
    accounts: [
      { pubkey: governanceAuthority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda(), isWritable: true },
    ],
  });
}

export function buildCreateReserveDomainTx(params: {
  authority: PublicKeyish;
  recentBlockhash: string;
  domainId: string;
  displayName: string;
  domainAdmin?: PublicKeyish | null;
  settlementMode: number;
  legalStructureHashHex?: string | null;
  complianceBaselineHashHex?: string | null;
  allowedRailMask: number;
  pauseFlags: number;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_reserve_domain",
    args: {
      domain_id: params.domainId,
      display_name: params.displayName,
      domain_admin: toPublicKey(params.domainAdmin ?? authority),
      settlement_mode: params.settlementMode,
      legal_structure_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.legalStructureHashHex), 32)),
      compliance_baseline_hash: Array.from(
        hexToFixedBytes(normalizeOptionalHex32(params.complianceBaselineHashHex), 32),
      ),
      allowed_rail_mask: params.allowedRailMask,
      pause_flags: params.pauseFlags,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      {
        pubkey: deriveReserveDomainPda({ domainId: params.domainId }),
        isWritable: true,
      },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildCreateDomainAssetVaultTx(params: {
  authority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  tokenProgramId?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const assetMint = toPublicKey(params.assetMint);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_domain_asset_vault",
    args: {
      asset_mint: assetMint,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.reserveDomainAddress, isWritable: true },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      { pubkey: assetMint },
      {
        pubkey: deriveDomainAssetVaultTokenAccountPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      { pubkey: tokenProgramId },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildSetProtocolEmergencyPauseTx(params: {
  authority: PublicKeyish;
  recentBlockhash: string;
  emergencyPaused: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "set_protocol_emergency_pause",
    args: {
      emergency_pause: params.emergencyPaused,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda(), isWritable: true },
    ],
  });
}

// Phase 1.6/1.7 — Fee-vault withdrawal builders.
//
// Six builders mirror the on-chain instruction matrix (SOL + SPL × 3 rails).
// Each takes the per-rail authority as the signer + fee payer, plus the
// rail-scope identifier (reserve_domain / liquidity_pool / oracle), the
// payment mint, the recipient, and the amount.
//
// Per-rail authority (enforced on-chain by PR2):
//   - withdraw_protocol_fee_*       → governance authority
//   - withdraw_pool_treasury_*      → pool curator OR governance
//   - withdraw_pool_oracle_fee_*    → oracle wallet OR oracle admin OR governance
//
// The pool-treasury panel calls these builders with `oracle: publicKey`
// (the connected wallet) for treasury+oracle-fee flows. That naming is a
// vestige of the panel's first draft; semantically the param is the rail's
// authority signer. Tests should use the builders with whichever wallet
// matches the on-chain authority requirement above.
//
// SPL builders need `reserveDomainAddress` to derive the matching
// `DomainAssetVault` and `DomainAssetLedger` (where SPL fee tokens physically
// reside and where funded-balance accounting is reduced). SOL builders don't
// reference DomainAssetVault — lamports come straight off the fee-vault PDA
// via `transfer_lamports_from_fee_vault`.

export function buildWithdrawProtocolFeeSplTx(params: {
  governanceAuthority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  paymentMint: PublicKeyish;
  recipientTokenAccount: PublicKeyish;
  amount: bigint;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
}): Transaction {
  const authority = toPublicKey(params.governanceAuthority);
  const reserveDomain = toPublicKey(params.reserveDomainAddress);
  const assetMint = toPublicKey(params.paymentMint);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "withdraw_protocol_fee_spl",
    args: {
      amount: params.amount,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: reserveDomain },
      {
        pubkey: deriveProtocolFeeVaultPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetVaultPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      { pubkey: assetMint },
      {
        pubkey: deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      { pubkey: params.recipientTokenAccount, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildWithdrawProtocolFeeSolTx(params: {
  governanceAuthority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  recipientSystemAccount: PublicKeyish;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const authority = toPublicKey(params.governanceAuthority);
  const reserveDomain = toPublicKey(params.reserveDomainAddress);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "withdraw_protocol_fee_sol",
    args: {
      amount: params.amount,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: reserveDomain },
      {
        pubkey: deriveProtocolFeeVaultPda({
          reserveDomain,
          assetMint: NATIVE_SOL_MINT_KEY,
        }),
        isWritable: true,
      },
      { pubkey: params.recipientSystemAccount, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildWithdrawPoolTreasurySplTx(params: {
  /** Pool authority signer (curator or governance). Named `oracle` historically
   *  to match the dead pool-treasury-panel first draft; semantically this is
   *  the rail authority, not the registered oracle wallet. */
  oracle: PublicKeyish;
  poolAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  paymentMint: PublicKeyish;
  recipientTokenAccount: PublicKeyish;
  amount: bigint;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
}): Transaction {
  const authority = toPublicKey(params.oracle);
  const pool = toPublicKey(params.poolAddress);
  const reserveDomain = toPublicKey(params.reserveDomainAddress);
  const assetMint = toPublicKey(params.paymentMint);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "withdraw_pool_treasury_spl",
    args: {
      amount: params.amount,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: pool },
      {
        pubkey: derivePoolTreasuryVaultPda({ liquidityPool: pool, assetMint }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetVaultPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      { pubkey: assetMint },
      {
        pubkey: deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      { pubkey: params.recipientTokenAccount, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildWithdrawPoolTreasurySolTx(params: {
  /** Pool authority signer; see naming note on the SPL variant. */
  oracle: PublicKeyish;
  poolAddress: PublicKeyish;
  recipientSystemAccount: PublicKeyish;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const authority = toPublicKey(params.oracle);
  const pool = toPublicKey(params.poolAddress);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "withdraw_pool_treasury_sol",
    args: {
      amount: params.amount,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: pool },
      {
        pubkey: derivePoolTreasuryVaultPda({
          liquidityPool: pool,
          assetMint: NATIVE_SOL_MINT_KEY,
        }),
        isWritable: true,
      },
      { pubkey: params.recipientSystemAccount, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildWithdrawPoolOracleFeeSplTx(params: {
  /** Oracle authority signer (oracle wallet, oracle admin, or governance).
   *  By default this also identifies the registered oracle whose vault is
   *  being drained — pass `oracleAddress` separately if the signer is an
   *  admin/governance rather than the oracle wallet itself. */
  oracle: PublicKeyish;
  oracleAddress?: PublicKeyish;
  poolAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  paymentMint: PublicKeyish;
  recipientTokenAccount: PublicKeyish;
  amount: bigint;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
}): Transaction {
  const authority = toPublicKey(params.oracle);
  const oracleKey = toPublicKey(params.oracleAddress ?? params.oracle);
  const pool = toPublicKey(params.poolAddress);
  const reserveDomain = toPublicKey(params.reserveDomainAddress);
  const assetMint = toPublicKey(params.paymentMint);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "withdraw_pool_oracle_fee_spl",
    args: {
      amount: params.amount,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: pool },
      { pubkey: deriveOracleProfilePda({ oracle: oracleKey }) },
      {
        pubkey: derivePoolOracleFeeVaultPda({
          liquidityPool: pool,
          oracle: oracleKey,
          assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetVaultPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      { pubkey: assetMint },
      {
        pubkey: deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint }),
        isWritable: true,
      },
      { pubkey: params.recipientTokenAccount, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildWithdrawPoolOracleFeeSolTx(params: {
  /** Oracle authority signer; see naming note on the SPL variant. */
  oracle: PublicKeyish;
  oracleAddress?: PublicKeyish;
  poolAddress: PublicKeyish;
  recipientSystemAccount: PublicKeyish;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const authority = toPublicKey(params.oracle);
  const oracleKey = toPublicKey(params.oracleAddress ?? params.oracle);
  const pool = toPublicKey(params.poolAddress);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "withdraw_pool_oracle_fee_sol",
    args: {
      amount: params.amount,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: pool },
      { pubkey: deriveOracleProfilePda({ oracle: oracleKey }) },
      {
        pubkey: derivePoolOracleFeeVaultPda({
          liquidityPool: pool,
          oracle: oracleKey,
          assetMint: NATIVE_SOL_MINT_KEY,
        }),
        isWritable: true,
      },
      { pubkey: params.recipientSystemAccount, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildUpdateReserveDomainControlsTx(params: {
  authority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  recentBlockhash: string;
  allowedRailMask: number;
  pauseFlags: number;
  active: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_reserve_domain_controls",
    args: {
      allowed_rail_mask: params.allowedRailMask,
      pause_flags: params.pauseFlags,
      active: params.active,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.reserveDomainAddress, isWritable: true },
    ],
  });
}

export function buildUpdateHealthPlanControlsTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  recentBlockhash: string;
  sponsorOperator: PublicKeyish;
  claimsOperator: PublicKeyish;
  oracleAuthority: PublicKeyish | null | undefined;
  membershipMode: number;
  membershipGateKind: number;
  membershipGateMint: PublicKeyish | null | undefined;
  membershipGateMinAmount: bigint;
  membershipInviteAuthority: PublicKeyish | null | undefined;
  allowedRailMask: number;
  defaultFundingPriority: number;
  oraclePolicyHashHex?: string | null;
  schemaBindingHashHex?: string | null;
  complianceBaselineHashHex?: string | null;
  pauseFlags: number;
  active: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_health_plan_controls",
    args: {
      sponsor_operator: toPublicKey(params.sponsorOperator),
      claims_operator: toPublicKey(params.claimsOperator),
      oracle_authority: toPublicKey(params.oracleAuthority ?? ZERO_PUBKEY_KEY),
      membership_mode: params.membershipMode,
      membership_gate_kind: params.membershipGateKind,
      membership_gate_mint: toPublicKey(params.membershipGateMint ?? ZERO_PUBKEY_KEY),
      membership_gate_min_amount: params.membershipGateMinAmount,
      membership_invite_authority: toPublicKey(params.membershipInviteAuthority ?? ZERO_PUBKEY_KEY),
      allowed_rail_mask: params.allowedRailMask,
      default_funding_priority: params.defaultFundingPriority,
      oracle_policy_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.oraclePolicyHashHex), 32)),
      schema_binding_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.schemaBindingHashHex), 32)),
      compliance_baseline_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.complianceBaselineHashHex), 32)),
      pause_flags: params.pauseFlags,
      active: params.active,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress, isWritable: true },
    ],
  });
}

export function buildVersionPolicySeriesTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  currentPolicySeriesAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  status: number;
  adjudicationMode: number;
  termsHashHex?: string | null;
  pricingHashHex?: string | null;
  payoutHashHex?: string | null;
  reserveModelHashHex?: string | null;
  evidenceRequirementsHashHex?: string | null;
  comparabilityHashHex?: string | null;
  policyOverridesHashHex?: string | null;
  cycleSeconds: bigint;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const nextPolicySeries = derivePolicySeriesPda({
    healthPlan: params.healthPlanAddress,
    seriesId: params.seriesId,
  });
  const nextSeriesReserveLedger = deriveSeriesReserveLedgerPda({
    policySeries: nextPolicySeries,
    assetMint: params.assetMint,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "version_policy_series",
    args: {
      series_id: params.seriesId,
      display_name: params.displayName,
      metadata_uri: params.metadataUri,
      status: params.status,
      adjudication_mode: params.adjudicationMode,
      terms_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.termsHashHex), 32)),
      pricing_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.pricingHashHex), 32)),
      payout_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.payoutHashHex), 32)),
      reserve_model_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reserveModelHashHex), 32)),
      evidence_requirements_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.evidenceRequirementsHashHex), 32)),
      comparability_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.comparabilityHashHex), 32)),
      policy_overrides_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.policyOverridesHashHex), 32)),
      cycle_seconds: params.cycleSeconds,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.currentPolicySeriesAddress, isWritable: true },
      { pubkey: nextPolicySeries, isWritable: true },
      { pubkey: nextSeriesReserveLedger, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildCreatePolicySeriesTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  seriesId: string;
  displayName: string;
  metadataUri: string;
  mode: number;
  status: number;
  adjudicationMode: number;
  termsHashHex?: string | null;
  pricingHashHex?: string | null;
  payoutHashHex?: string | null;
  reserveModelHashHex?: string | null;
  evidenceRequirementsHashHex?: string | null;
  comparabilityHashHex?: string | null;
  policyOverridesHashHex?: string | null;
  cycleSeconds: bigint;
  termsVersion: number;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const policySeries = derivePolicySeriesPda({
    healthPlan: params.healthPlanAddress,
    seriesId: params.seriesId,
  });
  const seriesReserveLedger = deriveSeriesReserveLedgerPda({
    policySeries,
    assetMint: params.assetMint,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_policy_series",
    args: {
      series_id: params.seriesId,
      display_name: params.displayName,
      metadata_uri: params.metadataUri,
      asset_mint: toPublicKey(params.assetMint),
      mode: params.mode,
      status: params.status,
      adjudication_mode: params.adjudicationMode,
      terms_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.termsHashHex), 32)),
      pricing_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.pricingHashHex), 32)),
      payout_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.payoutHashHex), 32)),
      reserve_model_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reserveModelHashHex), 32)),
      evidence_requirements_hash: Array.from(
        hexToFixedBytes(normalizeOptionalHex32(params.evidenceRequirementsHashHex), 32),
      ),
      comparability_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.comparabilityHashHex), 32)),
      policy_overrides_hash: Array.from(
        hexToFixedBytes(normalizeOptionalHex32(params.policyOverridesHashHex), 32),
      ),
      cycle_seconds: params.cycleSeconds,
      terms_version: params.termsVersion,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      { pubkey: policySeries, isWritable: true },
      { pubkey: seriesReserveLedger, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildOpenFundingLineTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  lineId: string;
  policySeriesAddress?: PublicKeyish | null;
  lineType: number;
  fundingPriority: number;
  committedAmount: bigint;
  capsHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const assetMint = toPublicKey(params.assetMint);
  const fundingLine = deriveFundingLinePda({
    healthPlan: params.healthPlanAddress,
    lineId: params.lineId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "open_funding_line",
    args: {
      line_id: params.lineId,
      policy_series: toPublicKey(params.policySeriesAddress ?? ZERO_PUBKEY_KEY),
      asset_mint: assetMint,
      line_type: params.lineType,
      funding_priority: params.fundingPriority,
      committed_amount: params.committedAmount,
      caps_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.capsHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint,
        }),
        isWritable: true,
      },
      { pubkey: fundingLine, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine,
          assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint,
        }),
        isWritable: true,
      },
      optionalSeriesReserveLedgerAccount(params.policySeriesAddress, assetMint),
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildOpenMemberPositionTx(params: {
  wallet: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  recentBlockhash: string;
  seriesScopeAddress?: PublicKeyish | null;
  subjectCommitmentHashHex?: string | null;
  eligibilityStatus: number;
  delegatedRightsMask: number;
  proofMode: number;
  tokenGateAmountSnapshot: bigint;
  inviteIdHashHex?: string | null;
  inviteExpiresAt: bigint;
  anchorRefAddress?: PublicKeyish | null;
  tokenGateAccountAddress?: PublicKeyish | null;
  inviteAuthorityAddress?: PublicKeyish | null;
}): Transaction {
  const wallet = toPublicKey(params.wallet);
  const seriesScope = toPublicKey(params.seriesScopeAddress ?? ZERO_PUBKEY_KEY);
  const anchorRef = toPublicKey(params.anchorRefAddress ?? ZERO_PUBKEY_KEY);
  const memberPosition = deriveMemberPositionPda({
    healthPlan: params.healthPlanAddress,
    wallet,
    seriesScope,
  });
  const membershipAnchorSeat = !anchorRef.equals(ZERO_PUBKEY_KEY)
    ? deriveMembershipAnchorSeatPda({ healthPlan: params.healthPlanAddress, anchorRef })
    : undefined;

  return buildProtocolTransactionFromInstruction({
    feePayer: wallet,
    recentBlockhash: params.recentBlockhash,
    instructionName: "open_member_position",
    args: {
      series_scope: seriesScope,
      subject_commitment: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.subjectCommitmentHashHex), 32)),
      eligibility_status: params.eligibilityStatus,
      delegated_rights: params.delegatedRightsMask,
      proof_mode: params.proofMode,
      token_gate_amount_snapshot: params.tokenGateAmountSnapshot,
      invite_id_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.inviteIdHashHex), 32)),
      invite_expires_at: params.inviteExpiresAt,
      anchor_ref: anchorRef,
    },
    accounts: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      { pubkey: memberPosition, isWritable: true },
      optionalProtocolAccount(membershipAnchorSeat, true),
      optionalProtocolAccount(params.tokenGateAccountAddress),
      params.inviteAuthorityAddress
        ? { pubkey: params.inviteAuthorityAddress, isSigner: true }
        : optionalProtocolAccount(undefined),
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildUpdateMemberEligibilityTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  walletAddress: PublicKeyish;
  recentBlockhash: string;
  seriesScopeAddress?: PublicKeyish | null;
  eligibilityStatus: number;
  delegatedRightsMask: number;
  active: boolean;
  membershipAnchorRefAddress?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const seriesScope = toPublicKey(params.seriesScopeAddress ?? ZERO_PUBKEY_KEY);
  const memberPosition = deriveMemberPositionPda({
    healthPlan: params.healthPlanAddress,
    wallet: params.walletAddress,
    seriesScope,
  });
  const membershipAnchorSeat = params.membershipAnchorRefAddress
    ? deriveMembershipAnchorSeatPda({
      healthPlan: params.healthPlanAddress,
      anchorRef: params.membershipAnchorRefAddress,
    })
    : undefined;
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_member_eligibility",
    args: {
      eligibility_status: params.eligibilityStatus,
      delegated_rights: params.delegatedRightsMask,
      active: params.active,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      { pubkey: memberPosition, isWritable: true },
      optionalProtocolAccount(membershipAnchorSeat, true),
    ],
  });
}

export function buildFundSponsorBudgetTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  sourceTokenAccountAddress: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  policySeriesAddress?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "fund_sponsor_budget",
    args: { amount: params.amount },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      optionalSeriesReserveLedgerAccount(params.policySeriesAddress, params.assetMint),
      { pubkey: params.sourceTokenAccountAddress, isWritable: true },
      { pubkey: params.assetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildRecordPremiumPaymentTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  sourceTokenAccountAddress: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
  protocolFeeVaultAddress?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "record_premium_payment",
    args: { amount: params.amount },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      optionalSeriesReserveLedgerAccount(params.policySeriesAddress, params.assetMint),
      optionalProtocolAccount(params.protocolFeeVaultAddress, true),
      { pubkey: params.sourceTokenAccountAddress, isWritable: true },
      { pubkey: params.assetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildCreateObligationTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  obligationId: string;
  policySeriesAddress?: PublicKeyish | null;
  memberWalletAddress?: PublicKeyish | null;
  beneficiaryAddress?: PublicKeyish | null;
  claimCaseAddress?: PublicKeyish | null;
  liquidityPoolAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  deliveryMode: number;
  amount: bigint;
  creationReasonHashHex?: string | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const obligation = deriveObligationPda({
    fundingLine: params.fundingLineAddress,
    obligationId: params.obligationId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_obligation",
    args: {
      obligation_id: params.obligationId,
      asset_mint: toPublicKey(params.assetMint),
      policy_series: toPublicKey(params.policySeriesAddress ?? ZERO_PUBKEY_KEY),
      member_wallet: toPublicKey(params.memberWalletAddress ?? ZERO_PUBKEY_KEY),
      beneficiary: toPublicKey(params.beneficiaryAddress ?? ZERO_PUBKEY_KEY),
      claim_case: toPublicKey(params.claimCaseAddress ?? ZERO_PUBKEY_KEY),
      liquidity_pool: toPublicKey(params.liquidityPoolAddress ?? ZERO_PUBKEY_KEY),
      capital_class: toPublicKey(params.capitalClassAddress ?? ZERO_PUBKEY_KEY),
      allocation_position: toPublicKey(params.allocationPositionAddress ?? ZERO_PUBKEY_KEY),
      delivery_mode: params.deliveryMode,
      amount: params.amount,
      creation_reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.creationReasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      optionalSeriesReserveLedgerAccount(params.policySeriesAddress, params.assetMint),
      optionalPoolClassLedgerAccount(params.capitalClassAddress, params.poolAssetMint),
      optionalAllocationLedgerAccount(params.allocationPositionAddress, params.assetMint),
      { pubkey: obligation, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildOpenClaimCaseTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  memberPositionAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  recentBlockhash: string;
  claimId: string;
  policySeriesAddress?: PublicKeyish | null;
  claimantAddress?: PublicKeyish | null;
  evidenceRefHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const claimCase = deriveClaimCasePda({
    healthPlan: params.healthPlanAddress,
    claimId: params.claimId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "open_claim_case",
    args: {
      claim_id: params.claimId,
      policy_series: toPublicKey(params.policySeriesAddress ?? ZERO_PUBKEY_KEY),
      claimant: toPublicKey(params.claimantAddress ?? authority),
      evidence_ref_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.evidenceRefHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.memberPositionAddress },
      { pubkey: params.fundingLineAddress },
      { pubkey: claimCase, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildAttachClaimEvidenceRefTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  claimCaseAddress: PublicKeyish;
  recentBlockhash: string;
  evidenceRefHashHex?: string | null;
  decisionSupportHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "attach_claim_evidence_ref",
    args: {
      evidence_ref_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.evidenceRefHashHex), 32)),
      decision_support_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.decisionSupportHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.claimCaseAddress, isWritable: true },
    ],
  });
}

export function buildAttestClaimCaseTx(params: {
  oracle: PublicKeyish;
  claimCaseAddress: PublicKeyish;
  recentBlockhash: string;
  decision: number;
  attestationHashHex: string;
  attestationRefHashHex?: string | null;
  schemaKeyHashHex: string;
}): Transaction {
  const oracle = toPublicKey(params.oracle);
  assertValidClaimAttestationDecision(params.decision);
  const oracleProfile = deriveOracleProfilePda({ oracle });
  const normalizedSchemaKeyHashHex = normalizeHex32(params.schemaKeyHashHex);
  const claimAttestation = deriveClaimAttestationPda({
    claimCase: params.claimCaseAddress,
    oracle,
  });
  const outcomeSchema = deriveOutcomeSchemaPda({
    schemaKeyHashHex: normalizedSchemaKeyHashHex,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: oracle,
    recentBlockhash: params.recentBlockhash,
    instructionName: "attest_claim_case",
    args: {
      decision: params.decision,
      attestation_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.attestationHashHex), 32)),
      attestation_ref_hash: Array.from(
        hexToFixedBytes(normalizeOptionalHex32(params.attestationRefHashHex), 32),
      ),
      schema_key_hash: Array.from(
        hexToFixedBytes(normalizedSchemaKeyHashHex, 32),
      ),
    },
    accounts: [
      { pubkey: oracle, isSigner: true, isWritable: true },
      { pubkey: oracleProfile },
      { pubkey: params.claimCaseAddress },
      { pubkey: outcomeSchema },
      { pubkey: claimAttestation, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildAdjudicateClaimCaseTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  claimCaseAddress: PublicKeyish;
  recentBlockhash: string;
  reviewState: number;
  approvedAmount: bigint;
  deniedAmount: bigint;
  reserveAmount: bigint;
  decisionSupportHashHex?: string | null;
  obligationAddress?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "adjudicate_claim_case",
    args: {
      review_state: params.reviewState,
      approved_amount: params.approvedAmount,
      denied_amount: params.deniedAmount,
      reserve_amount: params.reserveAmount,
      decision_support_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.decisionSupportHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.claimCaseAddress, isWritable: true },
      optionalProtocolAccount(params.obligationAddress, true),
    ],
  });
}

function buildObligationFlowTx(params: {
  instructionName: "reserve_obligation" | "release_reserve" | "settle_obligation";
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
  memberPositionAddress?: PublicKeyish | null;
  vaultTokenAccountAddress?: PublicKeyish | null;
  recipientTokenAccountAddress?: PublicKeyish | null;
  tokenProgramId?: PublicKeyish | null;
  args: Record<string, unknown>;
  includeVault?: boolean;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const includeSettlementOutflow = Boolean(
    params.memberPositionAddress
      && params.vaultTokenAccountAddress
      && params.recipientTokenAccountAddress,
  );
  const settlementOutflowAccounts: ProtocolInstructionAccountInput[] =
    params.instructionName === "settle_obligation"
      ? includeSettlementOutflow
        ? [
          { pubkey: params.memberPositionAddress },
          { pubkey: params.assetMint },
          { pubkey: params.vaultTokenAccountAddress, isWritable: true },
          { pubkey: params.recipientTokenAccountAddress, isWritable: true },
          { pubkey: classicTokenProgramId(params.tokenProgramId) },
        ]
        : [
          optionalProtocolAccount(undefined),
          optionalProtocolAccount(undefined),
          optionalProtocolAccount(undefined),
          optionalProtocolAccount(undefined),
          optionalProtocolAccount(undefined),
        ]
      : [];
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: params.instructionName,
    args: params.args,
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      ...(params.includeVault ? [{
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      }] : []),
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      optionalSeriesReserveLedgerAccount(params.policySeriesAddress, params.assetMint),
      optionalPoolClassLedgerAccount(params.capitalClassAddress, params.poolAssetMint),
      optionalProtocolAccount(params.allocationPositionAddress, true),
      optionalAllocationLedgerAccount(params.allocationPositionAddress, params.assetMint),
      { pubkey: params.obligationAddress, isWritable: true },
      optionalProtocolAccount(params.claimCaseAddress, true),
      ...settlementOutflowAccounts,
    ],
  });
}

export function buildReserveObligationTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  return buildObligationFlowTx({
    ...params,
    instructionName: "reserve_obligation",
    args: { amount: params.amount },
  });
}

export function buildReleaseReserveTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  return buildObligationFlowTx({
    ...params,
    instructionName: "release_reserve",
    args: { amount: params.amount },
  });
}

export function buildSettleObligationTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  obligationAddress: PublicKeyish;
  recentBlockhash: string;
  nextStatus: number;
  amount: bigint;
  settlementReasonHashHex?: string | null;
  claimCaseAddress?: PublicKeyish | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
  memberPositionAddress?: PublicKeyish | null;
  vaultTokenAccountAddress?: PublicKeyish | null;
  recipientTokenAccountAddress?: PublicKeyish | null;
  tokenProgramId?: PublicKeyish | null;
}): Transaction {
  return buildObligationFlowTx({
    ...params,
    instructionName: "settle_obligation",
    includeVault: true,
    args: {
      next_status: params.nextStatus,
      amount: params.amount,
      settlement_reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.settlementReasonHashHex), 32)),
    },
  });
}

export function buildSettleClaimCaseTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  claimCaseAddress: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
  policySeriesAddress?: PublicKeyish | null;
  obligationAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
  protocolFeeVaultAddress?: PublicKeyish | null;
  poolOracleFeeVaultAddress?: PublicKeyish | null;
  poolOraclePolicyAddress?: PublicKeyish | null;
  memberPositionAddress?: PublicKeyish | null;
  vaultTokenAccountAddress?: PublicKeyish | null;
  recipientTokenAccountAddress?: PublicKeyish | null;
  tokenProgramId?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "settle_claim_case",
    args: { amount: params.amount },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      optionalSeriesReserveLedgerAccount(params.policySeriesAddress, params.assetMint),
      optionalPoolClassLedgerAccount(params.capitalClassAddress, params.poolAssetMint),
      optionalProtocolAccount(params.allocationPositionAddress, true),
      optionalAllocationLedgerAccount(params.allocationPositionAddress, params.assetMint),
      { pubkey: params.claimCaseAddress, isWritable: true },
      optionalProtocolAccount(params.obligationAddress, true),
      optionalProtocolAccount(params.protocolFeeVaultAddress, true),
      optionalProtocolAccount(params.poolOracleFeeVaultAddress, true),
      optionalProtocolAccount(params.poolOraclePolicyAddress),
      optionalProtocolAccount(params.memberPositionAddress),
      { pubkey: params.assetMint },
      optionalProtocolAccount(params.vaultTokenAccountAddress, true),
      optionalProtocolAccount(params.recipientTokenAccountAddress, true),
      { pubkey: params.memberPositionAddress && params.vaultTokenAccountAddress && params.recipientTokenAccountAddress ? tokenProgramId : getProgramId() },
    ],
  });
}

export function buildCreateLiquidityPoolTx(params: {
  authority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  recentBlockhash: string;
  poolId: string;
  displayName: string;
  curator?: PublicKeyish | null;
  allocator?: PublicKeyish | null;
  sentinel?: PublicKeyish | null;
  depositAssetMint: PublicKeyish;
  strategyHashHex?: string | null;
  allowedExposureHashHex?: string | null;
  externalYieldAdapterHashHex?: string | null;
  feeBps: number;
  redemptionPolicy: number;
  pauseFlags: number;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const liquidityPool = deriveLiquidityPoolPda({
    reserveDomain: params.reserveDomainAddress,
    poolId: params.poolId,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_liquidity_pool",
    args: {
      pool_id: params.poolId,
      display_name: params.displayName,
      curator: toPublicKey(params.curator ?? authority),
      allocator: toPublicKey(params.allocator ?? authority),
      sentinel: toPublicKey(params.sentinel ?? authority),
      deposit_asset_mint: toPublicKey(params.depositAssetMint),
      strategy_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.strategyHashHex), 32)),
      allowed_exposure_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.allowedExposureHashHex), 32)),
      external_yield_adapter_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.externalYieldAdapterHashHex), 32)),
      fee_bps: params.feeBps,
      redemption_policy: params.redemptionPolicy,
      pause_flags: params.pauseFlags,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.reserveDomainAddress },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.depositAssetMint,
        }),
      },
      { pubkey: liquidityPool, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildCreateCapitalClassTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  poolDepositAssetMint: PublicKeyish;
  recentBlockhash: string;
  classId: string;
  displayName: string;
  shareMint?: PublicKeyish | null;
  priority: number;
  impairmentRank: number;
  restrictionMode: number;
  redemptionTermsMode: number;
  wrapperMetadataHashHex?: string | null;
  permissioningHashHex?: string | null;
  feeBps: number;
  minLockupSeconds: bigint;
  pauseFlags: number;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const capitalClass = deriveCapitalClassPda({
    liquidityPool: params.poolAddress,
    classId: params.classId,
  });
  const poolClassLedger = derivePoolClassLedgerPda({
    capitalClass,
    assetMint: params.poolDepositAssetMint,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_capital_class",
    args: {
      class_id: params.classId,
      display_name: params.displayName,
      share_mint: toPublicKey(params.shareMint ?? ZERO_PUBKEY_KEY),
      priority: params.priority,
      impairment_rank: params.impairmentRank,
      restriction_mode: params.restrictionMode,
      redemption_terms_mode: params.redemptionTermsMode,
      wrapper_metadata_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.wrapperMetadataHashHex), 32)),
      permissioning_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.permissioningHashHex), 32)),
      fee_bps: params.feeBps,
      min_lockup_seconds: params.minLockupSeconds,
      pause_flags: params.pauseFlags,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.poolAddress },
      { pubkey: capitalClass, isWritable: true },
      { pubkey: poolClassLedger, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildUpdateCapitalClassControlsTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  recentBlockhash: string;
  pauseFlags: number;
  queueOnlyRedemptions: boolean;
  active: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_capital_class_controls",
    args: {
      pause_flags: params.pauseFlags,
      queue_only_redemptions: params.queueOnlyRedemptions,
      active: params.active,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.poolAddress },
      { pubkey: params.capitalClassAddress, isWritable: true },
    ],
  });
}

export function buildDepositIntoCapitalClassTx(params: {
  owner: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  poolAddress: PublicKeyish;
  poolDepositAssetMint: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  sourceTokenAccountAddress: PublicKeyish;
  vaultTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
  recentBlockhash: string;
  amount: bigint;
  /** Backward-compatible wire field. On-chain this is min_shares_out; 0n means no minimum. */
  shares: bigint;
  poolTreasuryVaultAddress?: PublicKeyish | null;
}): Transaction {
  const owner = toPublicKey(params.owner);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  const lpPosition = deriveLpPositionPda({
    capitalClass: params.capitalClassAddress,
    owner,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: owner,
    recentBlockhash: params.recentBlockhash,
    instructionName: "deposit_into_capital_class",
    args: {
      amount: params.amount,
      shares: params.shares,
    },
    accounts: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.poolAddress, isWritable: true },
      { pubkey: params.capitalClassAddress, isWritable: true },
      {
        pubkey: derivePoolClassLedgerPda({
          capitalClass: params.capitalClassAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      { pubkey: lpPosition, isWritable: true },
      optionalProtocolAccount(params.poolTreasuryVaultAddress, true),
      { pubkey: params.sourceTokenAccountAddress, isWritable: true },
      { pubkey: params.poolDepositAssetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildUpdateLpPositionCredentialingTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  ownerAddress: PublicKeyish;
  recentBlockhash: string;
  credentialed: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_lp_position_credentialing",
    args: {
      owner: toPublicKey(params.ownerAddress),
      credentialed: params.credentialed,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.poolAddress },
      { pubkey: params.capitalClassAddress },
      {
        pubkey: deriveLpPositionPda({
          capitalClass: params.capitalClassAddress,
          owner: params.ownerAddress,
        }),
        isWritable: true,
      },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildRequestRedemptionTx(params: {
  owner: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  poolAddress: PublicKeyish;
  poolDepositAssetMint: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  recentBlockhash: string;
  shares: bigint;
  assetAmount?: bigint;
}): Transaction {
  const owner = toPublicKey(params.owner);
  const lpPosition = deriveLpPositionPda({
    capitalClass: params.capitalClassAddress,
    owner,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: owner,
    recentBlockhash: params.recentBlockhash,
    instructionName: "request_redemption",
    args: {
      shares: params.shares,
    },
    accounts: [
      { pubkey: owner, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.poolAddress, isWritable: true },
      { pubkey: params.capitalClassAddress, isWritable: true },
      {
        pubkey: derivePoolClassLedgerPda({
          capitalClass: params.capitalClassAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      { pubkey: lpPosition, isWritable: true },
    ],
  });
}

export function buildProcessRedemptionQueueTx(params: {
  authority: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  poolAddress: PublicKeyish;
  poolDepositAssetMint: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  lpOwnerAddress: PublicKeyish;
  recentBlockhash: string;
  shares: bigint;
  assetAmount?: bigint;
  poolTreasuryVaultAddress?: PublicKeyish | null;
  vaultTokenAccountAddress: PublicKeyish;
  recipientTokenAccountAddress: PublicKeyish;
  tokenProgramId?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const tokenProgramId = classicTokenProgramId(params.tokenProgramId);
  const lpPosition = deriveLpPositionPda({
    capitalClass: params.capitalClassAddress,
    owner: params.lpOwnerAddress,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "process_redemption_queue",
    args: {
      shares: params.shares,
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.poolAddress, isWritable: true },
      { pubkey: params.capitalClassAddress, isWritable: true },
      {
        pubkey: derivePoolClassLedgerPda({
          capitalClass: params.capitalClassAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      { pubkey: lpPosition, isWritable: true },
      optionalProtocolAccount(params.poolTreasuryVaultAddress, true),
      { pubkey: params.poolDepositAssetMint },
      { pubkey: params.vaultTokenAccountAddress, isWritable: true },
      { pubkey: params.recipientTokenAccountAddress, isWritable: true },
      { pubkey: tokenProgramId },
    ],
  });
}

export function buildCreateAllocationPositionTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  fundingLineAssetMint: PublicKeyish;
  recentBlockhash: string;
  policySeriesAddress?: PublicKeyish | null;
  capAmount: bigint;
  weightBps: number;
  allocationMode: number;
  deallocationOnly: boolean;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const allocationPosition = deriveAllocationPositionPda({
    capitalClass: params.capitalClassAddress,
    fundingLine: params.fundingLineAddress,
  });
  const allocationLedger = deriveAllocationLedgerPda({
    allocationPosition,
    assetMint: params.fundingLineAssetMint,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_allocation_position",
    args: {
      policy_series: toPublicKey(params.policySeriesAddress ?? ZERO_PUBKEY_KEY),
      cap_amount: params.capAmount,
      weight_bps: params.weightBps,
      allocation_mode: params.allocationMode,
      deallocation_only: params.deallocationOnly,
    },
    accounts: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.poolAddress },
      { pubkey: params.capitalClassAddress },
      { pubkey: params.healthPlanAddress },
      { pubkey: params.fundingLineAddress },
      { pubkey: allocationPosition, isWritable: true },
      { pubkey: allocationLedger, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

export function buildUpdateAllocationCapsTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  allocationPositionAddress: PublicKeyish;
  recentBlockhash: string;
  capAmount: bigint;
  weightBps: number;
  deallocationOnly: boolean;
  active: boolean;
  reasonHashHex?: string | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "update_allocation_caps",
    args: {
      cap_amount: params.capAmount,
      weight_bps: params.weightBps,
      deallocation_only: params.deallocationOnly,
      active: params.active,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.poolAddress },
      { pubkey: params.allocationPositionAddress, isWritable: true },
    ],
  });
}

function buildAllocationCapitalFlowTx(params: {
  instructionName: "allocate_capital" | "deallocate_capital";
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  poolDepositAssetMint: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  fundingLineAssetMint: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const allocationPosition = deriveAllocationPositionPda({
    capitalClass: params.capitalClassAddress,
    fundingLine: params.fundingLineAddress,
  });
  const allocationLedger = deriveAllocationLedgerPda({
    allocationPosition,
    assetMint: params.fundingLineAssetMint,
  });
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: params.instructionName,
    args: { amount: params.amount },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.poolAddress, isWritable: true },
      { pubkey: params.capitalClassAddress, isWritable: true },
      {
        pubkey: derivePoolClassLedgerPda({
          capitalClass: params.capitalClassAddress,
          assetMint: params.poolDepositAssetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress },
      { pubkey: allocationPosition, isWritable: true },
      { pubkey: allocationLedger, isWritable: true },
    ],
  });
}

export function buildAllocateCapitalTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  poolDepositAssetMint: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  fundingLineAssetMint: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
}): Transaction {
  return buildAllocationCapitalFlowTx({
    ...params,
    instructionName: "allocate_capital",
  });
}

export function buildDeallocateCapitalTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  capitalClassAddress: PublicKeyish;
  poolDepositAssetMint: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  fundingLineAssetMint: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
}): Transaction {
  return buildAllocationCapitalFlowTx({
    ...params,
    instructionName: "deallocate_capital",
  });
}

export function buildMarkImpairmentTx(params: {
  authority: PublicKeyish;
  healthPlanAddress: PublicKeyish;
  reserveDomainAddress: PublicKeyish;
  fundingLineAddress: PublicKeyish;
  assetMint: PublicKeyish;
  recentBlockhash: string;
  amount: bigint;
  reasonHashHex?: string | null;
  policySeriesAddress?: PublicKeyish | null;
  capitalClassAddress?: PublicKeyish | null;
  allocationPositionAddress?: PublicKeyish | null;
  obligationAddress?: PublicKeyish | null;
  poolAssetMint?: PublicKeyish | null;
}): Transaction {
  const authority = toPublicKey(params.authority);
  return buildProtocolTransactionFromInstruction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "mark_impairment",
    args: {
      amount: params.amount,
      reason_hash: Array.from(hexToFixedBytes(normalizeOptionalHex32(params.reasonHashHex), 32)),
    },
    accounts: [
      { pubkey: authority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.healthPlanAddress },
      {
        pubkey: deriveDomainAssetLedgerPda({
          reserveDomain: params.reserveDomainAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: params.fundingLineAddress, isWritable: true },
      {
        pubkey: deriveFundingLineLedgerPda({
          fundingLine: params.fundingLineAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      {
        pubkey: derivePlanReserveLedgerPda({
          healthPlan: params.healthPlanAddress,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      optionalSeriesReserveLedgerAccount(params.policySeriesAddress, params.assetMint),
      optionalPoolClassLedgerAccount(params.capitalClassAddress, params.poolAssetMint),
      optionalProtocolAccount(params.allocationPositionAddress, true),
      optionalAllocationLedgerAccount(params.allocationPositionAddress, params.assetMint),
      optionalProtocolAccount(params.obligationAddress, true),
    ],
  });
}

export function buildRegisterOracleTx(params: {
  admin: PublicKeyish;
  oracle: PublicKeyish;
  recentBlockhash: string;
  oracleType: number;
  displayName: string;
  legalName: string;
  websiteUrl: string;
  appUrl: string;
  logoUri: string;
  webhookUrl: string;
  supportedSchemaKeyHashesHex: string[];
}): Transaction {
  const admin = toPublicKey(params.admin);
  const oracle = toPublicKey(params.oracle);
  const oracleProfile = deriveOracleProfilePda({ oracle });
  const instruction = buildProtocolInstruction(
    "register_oracle",
    {
      oracle,
      oracle_type: params.oracleType,
      display_name: params.displayName,
      legal_name: params.legalName,
      website_url: params.websiteUrl,
      app_url: params.appUrl,
      logo_uri: params.logoUri,
      webhook_url: params.webhookUrl,
      supported_schema_key_hashes: params.supportedSchemaKeyHashesHex.map((value) => Array.from(hexToFixedBytes(value, 32))),
    },
    [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: oracleProfile, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  );
  return buildProtocolTransaction({
    feePayer: admin,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildClaimOracleTx(params: {
  oracle: PublicKeyish;
  recentBlockhash: string;
}): Transaction {
  const oracle = toPublicKey(params.oracle);
  const oracleProfile = deriveOracleProfilePda({ oracle });
  const instruction = buildProtocolInstruction(
    "claim_oracle",
    {},
    [
      { pubkey: oracle, isSigner: true },
      { pubkey: oracleProfile, isWritable: true },
    ],
  );
  return buildProtocolTransaction({
    feePayer: oracle,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildUpdateOracleProfileTx(params: {
  authority: PublicKeyish;
  oracle: PublicKeyish;
  recentBlockhash: string;
  oracleType: number;
  displayName: string;
  legalName: string;
  websiteUrl: string;
  appUrl: string;
  logoUri: string;
  webhookUrl: string;
  supportedSchemaKeyHashesHex: string[];
}): Transaction {
  const authority = toPublicKey(params.authority);
  const protocolGovernance = deriveProtocolGovernancePda();
  const oracleProfile = deriveOracleProfilePda({ oracle: params.oracle });
  const instruction = buildProtocolInstruction(
    "update_oracle_profile",
    {
      oracle_type: params.oracleType,
      display_name: params.displayName,
      legal_name: params.legalName,
      website_url: params.websiteUrl,
      app_url: params.appUrl,
      logo_uri: params.logoUri,
      webhook_url: params.webhookUrl,
      supported_schema_key_hashes: params.supportedSchemaKeyHashesHex.map((value) => Array.from(hexToFixedBytes(value, 32))),
    },
    [
      { pubkey: authority, isSigner: true },
      { pubkey: protocolGovernance },
      { pubkey: oracleProfile, isWritable: true },
    ],
  );
  return buildProtocolTransaction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildSetPoolOracleTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  oracle: PublicKeyish;
  recentBlockhash: string;
  active: boolean;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const pool = toPublicKey(params.poolAddress);
  const oracleProfile = deriveOracleProfilePda({ oracle: params.oracle });
  const approval = derivePoolOracleApprovalPda({ liquidityPool: pool, oracle: params.oracle });
  const instruction = buildProtocolInstruction(
    "set_pool_oracle",
    { active: params.active },
    [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: pool },
      { pubkey: oracleProfile },
      { pubkey: approval, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  );
  return buildProtocolTransaction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildSetPoolOraclePermissionsTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  oracle: PublicKeyish;
  permissions: number;
  recentBlockhash: string;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const pool = toPublicKey(params.poolAddress);
  const oracleProfile = deriveOracleProfilePda({ oracle: params.oracle });
  const approval = derivePoolOracleApprovalPda({ liquidityPool: pool, oracle: params.oracle });
  const permissionSet = derivePoolOraclePermissionSetPda({ liquidityPool: pool, oracle: params.oracle });
  const instruction = buildProtocolInstruction(
    "set_pool_oracle_permissions",
    { permissions: params.permissions },
    [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: pool },
      { pubkey: oracleProfile },
      { pubkey: approval },
      { pubkey: permissionSet, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  );
  return buildProtocolTransaction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildSetPoolOraclePolicyTx(params: {
  authority: PublicKeyish;
  poolAddress: PublicKeyish;
  recentBlockhash: string;
  quorumM: number;
  quorumN: number;
  requireVerifiedSchema: boolean;
  oracleFeeBps: number;
  allowDelegateClaim: boolean;
  challengeWindowSecs: number;
}): Transaction {
  const authority = toPublicKey(params.authority);
  const pool = toPublicKey(params.poolAddress);
  const policy = derivePoolOraclePolicyPda({ liquidityPool: pool });
  const instruction = buildProtocolInstruction(
    "set_pool_oracle_policy",
    {
      quorum_m: params.quorumM,
      quorum_n: params.quorumN,
      require_verified_schema: params.requireVerifiedSchema,
      oracle_fee_bps: params.oracleFeeBps,
      allow_delegate_claim: params.allowDelegateClaim,
      challenge_window_secs: params.challengeWindowSecs,
    },
    [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: pool },
      { pubkey: policy, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  );
  return buildProtocolTransaction({
    feePayer: authority,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildRegisterOutcomeSchemaTx(params: {
  publisher: PublicKeyish;
  recentBlockhash: string;
  schemaKeyHashHex: string;
  schemaKey: string;
  version: number;
  schemaHashHex: string;
  schemaFamily: number;
  visibility: number;
  metadataUri: string;
}): Transaction {
  const publisher = toPublicKey(params.publisher);
  const normalizedHash = normalizeHex32(params.schemaKeyHashHex);
  const outcomeSchema = deriveOutcomeSchemaPda({ schemaKeyHashHex: normalizedHash });
  const dependencyLedger = deriveSchemaDependencyLedgerPda({ schemaKeyHashHex: normalizedHash });
  const instruction = buildProtocolInstruction(
    "register_outcome_schema",
    {
      schema_key_hash: Array.from(hexToFixedBytes(normalizedHash, 32)),
      schema_key: params.schemaKey,
      version: params.version,
      schema_hash: Array.from(hexToFixedBytes(params.schemaHashHex, 32)),
      schema_family: params.schemaFamily,
      visibility: params.visibility,
      metadata_uri: params.metadataUri,
    },
    [
      { pubkey: publisher, isSigner: true, isWritable: true },
      { pubkey: outcomeSchema, isWritable: true },
      { pubkey: dependencyLedger, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  );
  return buildProtocolTransaction({
    feePayer: publisher,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildVerifyOutcomeSchemaTx(params: {
  governanceAuthority: PublicKeyish;
  recentBlockhash: string;
  schemaKeyHashHex: string;
  verified: boolean;
}): Transaction {
  const governanceAuthority = toPublicKey(params.governanceAuthority);
  const outcomeSchema = deriveOutcomeSchemaPda({ schemaKeyHashHex: params.schemaKeyHashHex });
  const instruction = buildProtocolInstruction(
    "verify_outcome_schema",
    { verified: params.verified },
    [
      { pubkey: governanceAuthority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: outcomeSchema, isWritable: true },
    ],
  );
  return buildProtocolTransaction({
    feePayer: governanceAuthority,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildBackfillSchemaDependencyLedgerTx(params: {
  governanceAuthority: PublicKeyish;
  recentBlockhash: string;
  schemaKeyHashHex: string;
  poolRuleAddresses: PublicKeyish[];
}): Transaction {
  const governanceAuthority = toPublicKey(params.governanceAuthority);
  const normalizedHash = normalizeHex32(params.schemaKeyHashHex);
  const outcomeSchema = deriveOutcomeSchemaPda({ schemaKeyHashHex: normalizedHash });
  const dependencyLedger = deriveSchemaDependencyLedgerPda({ schemaKeyHashHex: normalizedHash });
  const instruction = buildProtocolInstruction(
    "backfill_schema_dependency_ledger",
    {
      schema_key_hash: Array.from(hexToFixedBytes(normalizedHash, 32)),
      pool_rule_addresses: params.poolRuleAddresses.map((value) => toPublicKey(value)),
    },
    [
      { pubkey: governanceAuthority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: outcomeSchema },
      { pubkey: dependencyLedger, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  );
  return buildProtocolTransaction({
    feePayer: governanceAuthority,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export function buildCloseOutcomeSchemaTx(params: {
  governanceAuthority: PublicKeyish;
  recipientSystemAccount: PublicKeyish;
  recentBlockhash: string;
  schemaKeyHashHex: string;
}): Transaction {
  const governanceAuthority = toPublicKey(params.governanceAuthority);
  const normalizedHash = normalizeHex32(params.schemaKeyHashHex);
  const outcomeSchema = deriveOutcomeSchemaPda({ schemaKeyHashHex: normalizedHash });
  const dependencyLedger = deriveSchemaDependencyLedgerPda({ schemaKeyHashHex: normalizedHash });
  const recipient = toPublicKey(params.recipientSystemAccount);
  const instruction = buildProtocolInstruction(
    "close_outcome_schema",
    {},
    [
      { pubkey: governanceAuthority, isSigner: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: outcomeSchema, isWritable: true },
      { pubkey: dependencyLedger, isWritable: true },
      { pubkey: recipient, isWritable: true },
    ],
  );
  return buildProtocolTransaction({
    feePayer: governanceAuthority,
    recentBlockhash: params.recentBlockhash,
    instructions: [instruction],
  });
}

export {
  PROTOCOL_ACCOUNT_DISCRIMINATORS,
  PROTOCOL_INSTRUCTION_ACCOUNTS,
  PROTOCOL_INSTRUCTION_DISCRIMINATORS,
  PROTOCOL_PROGRAM_ID,
};
