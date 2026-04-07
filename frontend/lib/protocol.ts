// SPDX-License-Identifier: AGPL-3.0-or-later

import { Connection, PublicKey } from "@solana/web3.js";

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
export const MAX_ID_SEED_BYTES = 32;

export const SEED_PROTOCOL_GOVERNANCE = "protocol_governance";
export const SEED_RESERVE_DOMAIN = "reserve_domain";
export const SEED_DOMAIN_ASSET_VAULT = "domain_asset_vault";
export const SEED_DOMAIN_ASSET_LEDGER = "domain_asset_ledger";
export const SEED_HEALTH_PLAN = "health_plan";
export const SEED_PLAN_RESERVE_LEDGER = "plan_reserve_ledger";
export const SEED_POLICY_SERIES = "policy_series";
export const SEED_SERIES_RESERVE_LEDGER = "series_reserve_ledger";
export const SEED_MEMBER_POSITION = "member_position";
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
  settlementMode: number;
  active: boolean;
  pauseFlags?: number;
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
  membershipModel: string;
  pauseFlags?: number;
  active: boolean;
};

export type PolicySeriesSnapshot = {
  address: string;
  healthPlan: string;
  seriesId: string;
  displayName: string;
  mode: number;
  status: number;
  assetMint: string;
  termsVersion: string;
  comparabilityKey: string;
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
  poolId: string;
  displayName: string;
  depositAssetMint: string;
  strategyThesis: string;
  redemptionPolicy: number;
  totalValueLocked: BigNumberish;
  totalAllocated?: BigNumberish;
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

export type SponsorReadModel = {
  healthPlanAddress: string;
  planId: string;
  fundedSponsorBudget: bigint;
  remainingSponsorBudget: bigint;
  accruedRewards: bigint;
  paidRewards: bigint;
  reserveCoverageBps: bigint | null;
  claimCounts: Record<string, number>;
  budgetBurn: bigint;
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
    budgetBurn: fundedSponsorBudget - remainingSponsorBudget,
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

export {
  PROTOCOL_ACCOUNT_DISCRIMINATORS,
  PROTOCOL_INSTRUCTION_ACCOUNTS,
  PROTOCOL_INSTRUCTION_DISCRIMINATORS,
  PROTOCOL_PROGRAM_ID,
};
