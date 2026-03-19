// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Connection,
  GetProgramAccountsFilter,
  ParsedAccountData,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PROTOCOL_ACCOUNT_DISCRIMINATORS,
  PROTOCOL_INSTRUCTION_DISCRIMINATORS,
  PROTOCOL_PROGRAM_ID,
} from "./generated/protocol-contract";

const SEED_CONFIG = "config";
const SEED_POOL = "pool";
const SEED_ORACLE = "oracle";
const SEED_ORACLE_PROFILE = "oracle_profile";
const SEED_POOL_ORACLE = "pool_oracle";
const SEED_POOL_ORACLE_POLICY = "pool_oracle_policy";
const SEED_POOL_ORACLE_PERMISSIONS = "pool_oracle_permissions";
const SEED_ORACLE_STAKE = "oracle_stake";
const SEED_MEMBERSHIP = "membership";
const SEED_MEMBER_CYCLE = "member_cycle";
const SEED_SCHEMA = "schema";
const SEED_SCHEMA_DEPENDENCY = "schema_dependency";
const SEED_POOL_RULE = "pool_rule";
const SEED_INVITE_ISSUER = "invite_issuer";
const SEED_ENROLLMENT_REPLAY = "enrollment_replay";
const SEED_CYCLE_QUOTE_REPLAY = "cycle_quote_replay";
const SEED_ATTESTATION_VOTE = "attestation_vote";
const SEED_POOL_TERMS = "pool_terms";
const SEED_POOL_ASSET_VAULT = "pool_asset_vault";
const SEED_POOL_RISK_CONFIG = "pool_risk_config";
const SEED_POOL_CAPITAL_CLASS = "pool_capital_class";
const SEED_POLICY_SERIES = "policy_series";
const SEED_POLICY_SERIES_PAYMENT_OPTION = "policy_series_payment_option";
const SEED_POLICY_POSITION = "policy_position";
const SEED_POLICY_POSITION_NFT = "policy_position_nft";
const SEED_POOL_COMPLIANCE_POLICY = "pool_compliance_policy";
const SEED_POOL_CONTROL_AUTHORITY = "pool_control_authority";
const SEED_POOL_AUTOMATION_POLICY = "pool_automation_policy";
const SEED_POOL_LIQUIDITY_CONFIG = "pool_liquidity_config";
const SEED_POOL_SHARE_MINT = "pool_share_mint";
const SEED_POOL_TREASURY_RESERVE = "pool_treasury_reserve";
const SEED_REDEMPTION_REQUEST = "redemption_request";
const SEED_OUTCOME_AGGREGATE = "outcome_agg";
const SEED_CLAIM_DELEGATE = "claim_delegate";
const SEED_CLAIM = "claim";
const SEED_PREMIUM_LEDGER = "premium_ledger";
const SEED_PREMIUM_REPLAY = "premium_replay";
const SEED_COVERAGE_CLAIM = "coverage_claim";
const SEED_COHORT_SETTLEMENT_ROOT = "cohort_settlement_root";
const SEED_PROTOCOL_FEE_VAULT = "protocol_fee_vault";
const SEED_POOL_ORACLE_FEE_VAULT = "pool_oracle_fee_vault";

export const ZERO_PUBKEY = "11111111111111111111111111111111";
const ZERO_PUBKEY_KEY = new PublicKey(ZERO_PUBKEY);
const BPF_UPGRADEABLE_LOADER_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
const MAX_POOL_ID_SEED_BYTES = 32;
const MAX_ORACLE_SUPPORTED_SCHEMAS = 16;
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID_KEY = ASSOCIATED_TOKEN_PROGRAM_ID;
const SLIPPAGE_BPS_DENOMINATOR = 10_000n;
export const REFERENCE_NAV_SCALE = 1_000_000_000n;
export const DEFAULT_LIQUIDITY_SLIPPAGE_BPS = 50;

const IX_INITIALIZE_PROTOCOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.initialize_protocol;
const IX_SET_PROTOCOL_PARAMS =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_protocol_params;
const IX_ROTATE_GOVERNANCE_AUTHORITY =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.rotate_governance_authority;
const IX_REGISTER_ORACLE = PROTOCOL_INSTRUCTION_DISCRIMINATORS.register_oracle;
const IX_CLAIM_ORACLE = PROTOCOL_INSTRUCTION_DISCRIMINATORS.claim_oracle;
const IX_UPDATE_ORACLE_PROFILE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.update_oracle_profile;
const IX_UPDATE_ORACLE_METADATA =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.update_oracle_metadata;
const IX_STAKE_ORACLE = PROTOCOL_INSTRUCTION_DISCRIMINATORS.stake_oracle;
const IX_REQUEST_UNSTAKE = PROTOCOL_INSTRUCTION_DISCRIMINATORS.request_unstake;
const IX_FINALIZE_UNSTAKE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.finalize_unstake;
const IX_SLASH_ORACLE = PROTOCOL_INSTRUCTION_DISCRIMINATORS.slash_oracle;
const IX_SET_POOL_ORACLE = PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_oracle;
const IX_SET_POOL_STATUS = PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_status;
const IX_CREATE_POOL = PROTOCOL_INSTRUCTION_DISCRIMINATORS.create_pool;
const IX_SET_POOL_ORACLE_POLICY =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_oracle_policy;
const IX_SET_POOL_COVERAGE_RESERVE_FLOOR =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_coverage_reserve_floor;
const IX_SET_POOL_RISK_CONTROLS =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_risk_controls;
const IX_SET_POOL_COMPLIANCE_POLICY =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_compliance_policy;
const IX_SET_POOL_CONTROL_AUTHORITIES =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_control_authorities;
const IX_SET_POOL_AUTOMATION_POLICY =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_automation_policy;
const IX_SET_POOL_ORACLE_PERMISSIONS =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_oracle_permissions;
const IX_SET_POOL_TERMS_HASH =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_terms_hash;
const IX_REGISTER_OUTCOME_SCHEMA =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.register_outcome_schema;
const IX_VERIFY_OUTCOME_SCHEMA =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.verify_outcome_schema;
const IX_BACKFILL_SCHEMA_DEPENDENCY_LEDGER =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.backfill_schema_dependency_ledger;
const IX_CLOSE_OUTCOME_SCHEMA =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.close_outcome_schema;
const IX_REGISTER_INVITE_ISSUER =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.register_invite_issuer;
const IX_ENROLL_MEMBER_OPEN =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.enroll_member_open;
const IX_ENROLL_MEMBER_TOKEN_GATE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.enroll_member_token_gate;
const IX_ENROLL_MEMBER_INVITE_PERMIT =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.enroll_member_invite_permit;
const IX_SET_CLAIM_DELEGATE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_claim_delegate;
const IX_FUND_POOL_SOL = PROTOCOL_INSTRUCTION_DISCRIMINATORS.fund_pool_sol;
const IX_FUND_POOL_SPL = PROTOCOL_INSTRUCTION_DISCRIMINATORS.fund_pool_spl;
const IX_INITIALIZE_POOL_LIQUIDITY_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.initialize_pool_liquidity_sol;
const IX_INITIALIZE_POOL_LIQUIDITY_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.initialize_pool_liquidity_spl;
const IX_SET_POOL_LIQUIDITY_ENABLED =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_pool_liquidity_enabled;
const IX_REGISTER_POOL_CAPITAL_CLASS =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.register_pool_capital_class;
const IX_DEPOSIT_POOL_LIQUIDITY_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.deposit_pool_liquidity_sol;
const IX_DEPOSIT_POOL_LIQUIDITY_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.deposit_pool_liquidity_spl;
const IX_REDEEM_POOL_LIQUIDITY_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.redeem_pool_liquidity_sol;
const IX_REDEEM_POOL_LIQUIDITY_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.redeem_pool_liquidity_spl;
const IX_REQUEST_POOL_LIQUIDITY_REDEMPTION =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.request_pool_liquidity_redemption;
const IX_SCHEDULE_POOL_LIQUIDITY_REDEMPTION =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.schedule_pool_liquidity_redemption;
const IX_CANCEL_POOL_LIQUIDITY_REDEMPTION =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.cancel_pool_liquidity_redemption;
const IX_FAIL_POOL_LIQUIDITY_REDEMPTION =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.fail_pool_liquidity_redemption;
const IX_FULFILL_POOL_LIQUIDITY_REDEMPTION_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.fulfill_pool_liquidity_redemption_sol;
const IX_FULFILL_POOL_LIQUIDITY_REDEMPTION_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.fulfill_pool_liquidity_redemption_spl;
const IX_SUBMIT_OUTCOME_ATTESTATION_VOTE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.submit_outcome_attestation_vote;
const IX_FINALIZE_CYCLE_OUTCOME =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.finalize_cycle_outcome;
const IX_OPEN_CYCLE_OUTCOME_DISPUTE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.open_cycle_outcome_dispute;
const IX_RESOLVE_CYCLE_OUTCOME_DISPUTE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.resolve_cycle_outcome_dispute;
const IX_ACTIVATE_CYCLE_WITH_QUOTE_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.activate_cycle_with_quote_sol;
const IX_ACTIVATE_CYCLE_WITH_QUOTE_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.activate_cycle_with_quote_spl;
const IX_SETTLE_CYCLE_COMMITMENT =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.settle_cycle_commitment;
const IX_SETTLE_CYCLE_COMMITMENT_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.settle_cycle_commitment_sol;
const IX_FINALIZE_COHORT_SETTLEMENT_ROOT =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.finalize_cohort_settlement_root;
const IX_SUBMIT_REWARD_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.submit_reward_claim;
const IX_CREATE_POLICY_SERIES =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.create_policy_series;
const IX_UPDATE_POLICY_SERIES =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.update_policy_series;
const IX_UPSERT_POLICY_SERIES_PAYMENT_OPTION =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.upsert_policy_series_payment_option;
const IX_SUBSCRIBE_POLICY_SERIES =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.subscribe_policy_series;
const IX_ISSUE_POLICY_POSITION =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.issue_policy_position;
const IX_SET_POLICY_SERIES_OUTCOME_RULE =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.set_policy_series_outcome_rule;
const IX_MINT_POLICY_NFT = PROTOCOL_INSTRUCTION_DISCRIMINATORS.mint_policy_nft;
const IX_PAY_PREMIUM_SPL = PROTOCOL_INSTRUCTION_DISCRIMINATORS.pay_premium_spl;
const IX_PAY_PREMIUM_SOL = PROTOCOL_INSTRUCTION_DISCRIMINATORS.pay_premium_sol;
const IX_ATTEST_PREMIUM_PAID_OFFCHAIN =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.attest_premium_paid_offchain;
const IX_SUBMIT_COVERAGE_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.submit_coverage_claim;
const IX_REVIEW_COVERAGE_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.review_coverage_claim;
const IX_ATTACH_COVERAGE_CLAIM_DECISION_SUPPORT =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.attach_coverage_claim_decision_support;
const IX_APPROVE_COVERAGE_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.approve_coverage_claim;
const IX_DENY_COVERAGE_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.deny_coverage_claim;
const IX_PAY_COVERAGE_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.pay_coverage_claim;
const IX_CLAIM_APPROVED_COVERAGE_PAYOUT =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.claim_approved_coverage_payout;
const IX_CLOSE_COVERAGE_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.close_coverage_claim;
const IX_SETTLE_COVERAGE_CLAIM =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.settle_coverage_claim;
const IX_WITHDRAW_POOL_TREASURY_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.withdraw_pool_treasury_spl;
const IX_WITHDRAW_POOL_TREASURY_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.withdraw_pool_treasury_sol;
const IX_WITHDRAW_PROTOCOL_FEE_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.withdraw_protocol_fee_spl;
const IX_WITHDRAW_PROTOCOL_FEE_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.withdraw_protocol_fee_sol;
const IX_WITHDRAW_POOL_ORACLE_FEE_SPL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.withdraw_pool_oracle_fee_spl;
const IX_WITHDRAW_POOL_ORACLE_FEE_SOL =
  PROTOCOL_INSTRUCTION_DISCRIMINATORS.withdraw_pool_oracle_fee_sol;

export const MEMBERSHIP_MODE_OPEN = 0;
export const MEMBERSHIP_MODE_TOKEN_GATE = 1;
export const MEMBERSHIP_MODE_INVITE_ONLY = 2;
export const MEMBERSHIP_STATUS_ACTIVE = 1;
export const POOL_STATUS_DRAFT = 0;
export const POOL_STATUS_ACTIVE = 1;
export const POOL_STATUS_CLOSED = 3;

export const POOL_TYPE_REWARD = 0;
export const POOL_TYPE_COVERAGE = 1;
export const POOL_REDEMPTION_MODE_OPEN = 0;
export const POOL_REDEMPTION_MODE_QUEUE_ONLY = 1;
export const POOL_REDEMPTION_MODE_PAUSED = 2;
export const POOL_CLAIM_MODE_OPEN = 0;
export const POOL_CLAIM_MODE_PAUSED = 1;
export const POLICY_SERIES_STATUS_DRAFT = 0;
export const POLICY_SERIES_STATUS_ACTIVE = 1;
export const POLICY_SERIES_STATUS_PAUSED = 2;
export const POLICY_SERIES_STATUS_CLOSED = 3;
export const CAPITAL_CLASS_MODE_NAV = 0;
export const CAPITAL_CLASS_MODE_DISTRIBUTION = 1;
export const CAPITAL_CLASS_MODE_HYBRID = 2;
export const CAPITAL_TRANSFER_MODE_PERMISSIONLESS = 0;
export const CAPITAL_TRANSFER_MODE_RESTRICTED = 1;
export const CAPITAL_TRANSFER_MODE_WRAPPER_ONLY = 2;
export const PLAN_MODE_REWARD = 0;
export const PLAN_MODE_PROTECTION = 1;
export const PLAN_MODE_REIMBURSEMENT = 2;
export const PLAN_MODE_REGULATED = 3;
export const SPONSOR_MODE_DIRECT = 0;
export const SPONSOR_MODE_WRAPPER = 1;
export const SPONSOR_MODE_CARRIER = 2;
export const SCHEMA_FAMILY_KERNEL = 0;
export const SCHEMA_FAMILY_CLINICAL = 1;
export const SCHEMA_FAMILY_CLAIMS_CODING = 2;
export const SCHEMA_VISIBILITY_PUBLIC = 0;
export const SCHEMA_VISIBILITY_PRIVATE = 1;
export const SCHEMA_VISIBILITY_RESTRICTED = 2;
export const COMPLIANCE_ACTION_ENROLL = 1 << 0;
export const COMPLIANCE_ACTION_CLAIM = 1 << 1;
export const COMPLIANCE_ACTION_REDEEM = 1 << 2;
export const COMPLIANCE_ACTION_DEPOSIT = 1 << 3;
export const COMPLIANCE_ACTION_PAYOUT = 1 << 4;
export const COMPLIANCE_BINDING_MODE_NONE = 0;
export const COMPLIANCE_BINDING_MODE_WALLET = 1;
export const COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT = 2;
export const COMPLIANCE_BINDING_MODE_TOKEN_GATE = 3;
export const COMPLIANCE_PROVIDER_MODE_NATIVE = 0;
export const COMPLIANCE_PROVIDER_MODE_EXTERNAL = 1;
export const COMPLIANCE_PROVIDER_MODE_SOLANA_ATTEST = 2;
export const RAIL_MODE_ANY = 0;
export const RAIL_MODE_SPL_ONLY = 1;
export const RAIL_MODE_PERMISSIONED_SPL = 2;
export const AUTOMATION_MODE_DISABLED = 0;
export const AUTOMATION_MODE_ADVISORY = 1;
export const AUTOMATION_MODE_ATTESTED = 2;
export const AUTOMATION_MODE_BOUNDED_AUTONOMOUS = 3;
export const AI_ROLE_NONE = 0;
export const AI_ROLE_UNDERWRITER = 1;
export const AI_ROLE_PRICING_AGENT = 2;
export const AI_ROLE_CLAIM_PROCESSOR = 3;
export const AI_ROLE_SETTLEMENT_PLANNER = 4;
export const AI_ROLE_ORACLE = 5;
export const AI_ROLE_ALL_MASK =
  (1 << AI_ROLE_UNDERWRITER) |
  (1 << AI_ROLE_PRICING_AGENT) |
  (1 << AI_ROLE_CLAIM_PROCESSOR) |
  (1 << AI_ROLE_SETTLEMENT_PLANNER) |
  (1 << AI_ROLE_ORACLE);
export const OUTCOME_REVIEW_STATUS_CLEAR = 0;
export const OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE = 1;
export const OUTCOME_REVIEW_STATUS_CHALLENGED = 2;
export const OUTCOME_REVIEW_STATUS_OVERTURNED = 3;
export const REDEMPTION_REQUEST_STATUS_PENDING = 1;
export const REDEMPTION_REQUEST_STATUS_SCHEDULED = 2;
export const REDEMPTION_REQUEST_STATUS_FULFILLED = 3;
export const REDEMPTION_REQUEST_STATUS_CANCELLED = 4;
export const REDEMPTION_REQUEST_STATUS_FAILED = 5;
export const COVERAGE_CLAIM_STATUS_SUBMITTED = 1;
export const COVERAGE_CLAIM_STATUS_UNDER_REVIEW = 2;
export const COVERAGE_CLAIM_STATUS_APPROVED = 3;
export const COVERAGE_CLAIM_STATUS_PAID = 4;
export const COVERAGE_CLAIM_STATUS_DENIED = 5;
export const COVERAGE_CLAIM_STATUS_CLOSED = 6;
export const COVERAGE_CLAIM_STATUS_PARTIALLY_PAID = 7;
export const COVERAGE_CLAIM_FAMILY_FAST = 0;
export const COVERAGE_CLAIM_FAMILY_REIMBURSEMENT = 1;
export const COVERAGE_CLAIM_FAMILY_REGULATED = 2;
export const ORACLE_TYPE_LAB = 0;
export const ORACLE_TYPE_HOSPITAL_CLINIC = 1;
export const ORACLE_TYPE_HEALTH_APP = 2;
export const ORACLE_TYPE_WEARABLE_DATA_PROVIDER = 3;
export const ORACLE_TYPE_OTHER = 4;
export const ORACLE_PERMISSION_DATA_ATTEST = 1 << 0;
export const ORACLE_PERMISSION_QUOTE = 1 << 1;
export const ORACLE_PERMISSION_CYCLE_SETTLE = 1 << 2;
export const ORACLE_PERMISSION_CLAIM_SETTLE = 1 << 3;
export const ORACLE_PERMISSION_TREASURY_WITHDRAW = 1 << 4;
export const ORACLE_PERMISSION_FEE_WITHDRAW = 1 << 5;
export const ORACLE_PERMISSION_ALL =
  ORACLE_PERMISSION_DATA_ATTEST
  | ORACLE_PERMISSION_QUOTE
  | ORACLE_PERMISSION_CYCLE_SETTLE
  | ORACLE_PERMISSION_CLAIM_SETTLE
  | ORACLE_PERMISSION_TREASURY_WITHDRAW
  | ORACLE_PERMISSION_FEE_WITHDRAW;
export const ORACLE_ROLE_QUOTE_ATTESTER = 1;
export const ORACLE_ROLE_OUTCOME_ATTESTER = 2;
export const ORACLE_ROLE_PREMIUM_ATTESTER = 3;
export const ORACLE_ROLE_CLAIM_ADJUDICATOR = 4;
export const ORACLE_ROLE_TREASURY_OPERATOR = 5;

export const DEFAULT_DEV_GOVERNANCE =
  "BGN6pVpuD9GPSsExtBi7pe4RLCJrkFVsQd9mw7ZdH8Ez";

type Bytes32Input = string | Uint8Array;

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeU16(value: number): Uint8Array {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function encodeU32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function encodeU64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, true);
  return out;
}

function encodeI64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, value, true);
  return out;
}

function encodeString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, bytes.length, true);
  return concat([len, bytes]);
}

function encodeVecBytes32(values: Bytes32Input[]): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, values.length, true);
  const rows = values.map((value) => asBytes32(value));
  return concat([len, ...rows]);
}

function normalizeHex32(hex: string): string {
  const normalized = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Expected 32-byte hex (64 chars)");
  }
  return normalized;
}

function asBytes32(input: Bytes32Input): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length !== 32) throw new Error("Expected 32-byte input");
    return input;
  }
  const normalized = normalizeHex32(input);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function hashStringTo32(value: string): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this environment");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

export async function hashStringTo32Hex(value: string): Promise<string> {
  return Buffer.from(await hashStringTo32(value)).toString("hex");
}

export function computePoolLiquidityDepositSharesOut(params: {
  amountIn: bigint;
  sharesSupply: bigint;
  reservesBefore: bigint;
}): bigint {
  if (params.amountIn <= 0n) return 0n;
  if (params.sharesSupply === 0n) {
    return params.reservesBefore === 0n ? params.amountIn : 0n;
  }
  if (params.reservesBefore <= 0n) return 0n;
  return (params.amountIn * params.sharesSupply) / params.reservesBefore;
}

export function computePoolEncumberedCapital(params: {
  reservedRefundAmount: bigint;
  reservedRewardAmount: bigint;
  reservedRedistributionAmount: bigint;
  manualCoverageReserveAmount: bigint;
  reservedCoverageClaimAmount?: bigint;
  impairedAmount?: bigint;
}): bigint {
  const entries = [
    params.reservedRefundAmount,
    params.reservedRewardAmount,
    params.reservedRedistributionAmount,
    params.manualCoverageReserveAmount,
    params.reservedCoverageClaimAmount ?? 0n,
    params.impairedAmount ?? 0n,
  ];
  return entries.reduce((sum, value) => sum + (value > 0n ? value : 0n), 0n);
}

export function computePoolFreeCapital(params: {
  reservesBefore: bigint;
  encumberedCapital: bigint;
}): bigint {
  if (params.reservesBefore <= 0n) return 0n;
  if (params.encumberedCapital <= 0n) return params.reservesBefore;
  return params.reservesBefore > params.encumberedCapital
    ? params.reservesBefore - params.encumberedCapital
    : 0n;
}

export function computePoolCapitalUtilizationBps(params: {
  reservesBefore: bigint;
  encumberedCapital: bigint;
}): number {
  if (params.reservesBefore <= 0n || params.encumberedCapital <= 0n) return 0;
  const utilization =
    (params.encumberedCapital * SLIPPAGE_BPS_DENOMINATOR) /
    params.reservesBefore;
  return Number(
    utilization > SLIPPAGE_BPS_DENOMINATOR
      ? SLIPPAGE_BPS_DENOMINATOR
      : utilization,
  );
}

export function computePoolReferenceNavScaled(params: {
  freeCapital: bigint;
  shareSupply: bigint;
}): bigint {
  if (params.shareSupply <= 0n) return REFERENCE_NAV_SCALE;
  if (params.freeCapital <= 0n) return 0n;
  return (params.freeCapital * REFERENCE_NAV_SCALE) / params.shareSupply;
}

export function computePoolLiquidityRedeemAmountOut(params: {
  sharesIn: bigint;
  sharesSupply: bigint;
  reservesBefore: bigint;
  encumberedCapital?: bigint;
}): bigint {
  const redeemableReserves = computePoolFreeCapital({
    reservesBefore: params.reservesBefore,
    encumberedCapital: params.encumberedCapital ?? 0n,
  });
  if (
    params.sharesIn <= 0n ||
    params.sharesSupply <= 0n ||
    redeemableReserves <= 0n
  ) {
    return 0n;
  }
  return (params.sharesIn * redeemableReserves) / params.sharesSupply;
}

export function computePoolLiquidityMinOut(
  expectedOut: bigint,
  slippageBps: number,
): bigint {
  if (expectedOut <= 0n) return 0n;
  const normalizedBps = Math.max(0, Math.min(10_000, Math.floor(slippageBps)));
  const keepBps = BigInt(10_000 - normalizedBps);
  return (expectedOut * keepBps) / SLIPPAGE_BPS_DENOMINATOR;
}

export function poolIdByteLength(poolId: string): number {
  return new TextEncoder().encode(poolId).length;
}

export function isPoolIdSeedSafe(poolId: string): boolean {
  return poolIdByteLength(poolId) <= MAX_POOL_ID_SEED_BYTES;
}

export function getProgramId(): PublicKey {
  const fromEnv = process.env.NEXT_PUBLIC_PROTOCOL_PROGRAM_ID;
  return new PublicKey((fromEnv && fromEnv.trim()) || PROTOCOL_PROGRAM_ID);
}

export function deriveConfigPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(SEED_CONFIG)],
    programId,
  )[0];
}

export function deriveProgramDataPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
  )[0];
}

export function derivePoolPda(params: {
  programId: PublicKey;
  authority: PublicKey;
  poolId: string;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL),
      params.authority.toBuffer(),
      new TextEncoder().encode(params.poolId),
    ],
    params.programId,
  )[0];
}

export function deriveOraclePda(params: {
  programId: PublicKey;
  oracle: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(SEED_ORACLE), params.oracle.toBuffer()],
    params.programId,
  )[0];
}

export function deriveOracleProfilePda(params: {
  programId: PublicKey;
  oracle: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(SEED_ORACLE_PROFILE), params.oracle.toBuffer()],
    params.programId,
  )[0];
}

export function derivePoolOraclePda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  oracle: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_ORACLE),
      params.poolAddress.toBuffer(),
      params.oracle.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolOraclePolicyPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_ORACLE_POLICY),
      params.poolAddress.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolOraclePermissionsPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  oracle: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_ORACLE_PERMISSIONS),
      params.poolAddress.toBuffer(),
      params.oracle.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolTermsPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(SEED_POOL_TERMS), params.poolAddress.toBuffer()],
    params.programId,
  )[0];
}

export function deriveMembershipPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_MEMBERSHIP),
      params.poolAddress.toBuffer(),
      params.member.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function deriveMemberCyclePda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  periodIndex: bigint;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_MEMBER_CYCLE),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
      encodeU64(params.periodIndex),
    ],
    params.programId,
  )[0];
}

export function deriveSchemaPda(params: {
  programId: PublicKey;
  schemaKeyHash: Uint8Array;
}): PublicKey {
  if (params.schemaKeyHash.length !== 32) {
    throw new Error("schemaKeyHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(SEED_SCHEMA), Buffer.from(params.schemaKeyHash)],
    params.programId,
  )[0];
}

export function deriveSchemaDependencyPda(params: {
  programId: PublicKey;
  schemaKeyHash: Uint8Array;
}): PublicKey {
  if (params.schemaKeyHash.length !== 32) {
    throw new Error("schemaKeyHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_SCHEMA_DEPENDENCY),
      Buffer.from(params.schemaKeyHash),
    ],
    params.programId,
  )[0];
}

export function derivePoolRulePda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  ruleHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  if (params.ruleHash.length !== 32) {
    throw new Error("ruleHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_RULE),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      Buffer.from(params.ruleHash),
    ],
    params.programId,
  )[0];
}

export function deriveOutcomeAggregatePda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  cycleHash: Uint8Array;
  ruleHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_OUTCOME_AGGREGATE),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
      Buffer.from(params.cycleHash),
      Buffer.from(params.ruleHash),
    ],
    params.programId,
  )[0];
}

export function deriveOracleStakePda(params: {
  programId: PublicKey;
  oracle: PublicKey;
  staker: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_ORACLE_STAKE),
      params.oracle.toBuffer(),
      params.staker.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function deriveInviteIssuerPda(params: {
  programId: PublicKey;
  issuer: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(SEED_INVITE_ISSUER), params.issuer.toBuffer()],
    params.programId,
  )[0];
}

export function deriveEnrollmentReplayPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  nonceHash: Uint8Array;
}): PublicKey {
  if (params.nonceHash.length !== 32) {
    throw new Error("nonceHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_ENROLLMENT_REPLAY),
      params.poolAddress.toBuffer(),
      params.member.toBuffer(),
      Buffer.from(params.nonceHash),
    ],
    params.programId,
  )[0];
}

export function deriveCycleQuoteReplayPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  nonceHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  if (params.nonceHash.length !== 32) {
    throw new Error("nonceHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_CYCLE_QUOTE_REPLAY),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
      Buffer.from(params.nonceHash),
    ],
    params.programId,
  )[0];
}

export function deriveAttestationVotePda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  cycleHash: Uint8Array;
  ruleHash: Uint8Array;
  oracle: PublicKey;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_ATTESTATION_VOTE),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
      Buffer.from(params.cycleHash),
      Buffer.from(params.ruleHash),
      params.oracle.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function deriveClaimDelegatePda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_CLAIM_DELEGATE),
      params.poolAddress.toBuffer(),
      params.member.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function deriveClaimPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  cycleHash: Uint8Array;
  ruleHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_CLAIM),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
      Buffer.from(params.cycleHash),
      Buffer.from(params.ruleHash),
    ],
    params.programId,
  )[0];
}

export function derivePoolAssetVaultPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_ASSET_VAULT),
      params.poolAddress.toBuffer(),
      params.payoutMint.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolRiskConfigPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_RISK_CONFIG),
      params.poolAddress.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolLiquidityConfigPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_LIQUIDITY_CONFIG),
      params.poolAddress.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolCapitalClassPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  shareMint: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_CAPITAL_CLASS),
      params.poolAddress.toBuffer(),
      params.shareMint.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePolicySeriesPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POLICY_SERIES),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
    ],
    params.programId,
  )[0];
}

export function derivePoolCompliancePolicyPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_COMPLIANCE_POLICY),
      params.poolAddress.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolControlAuthorityPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_CONTROL_AUTHORITY),
      params.poolAddress.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolAutomationPolicyPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_AUTOMATION_POLICY),
      params.poolAddress.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolTreasuryReservePda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  paymentMint: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_TREASURY_RESERVE),
      params.poolAddress.toBuffer(),
      params.paymentMint.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolShareMintPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_SHARE_MINT),
      params.poolAddress.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function deriveRedemptionRequestPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  redeemer: PublicKey;
  requestHash: Uint8Array;
}): PublicKey {
  if (params.requestHash.length !== 32) {
    throw new Error("requestHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_REDEMPTION_REQUEST),
      params.poolAddress.toBuffer(),
      params.redeemer.toBuffer(),
      Buffer.from(params.requestHash),
    ],
    params.programId,
  )[0];
}

export function derivePolicyPositionPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POLICY_POSITION),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePolicyPositionNftPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POLICY_POSITION_NFT),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePolicySeriesPaymentOptionPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  paymentMint: PublicKey;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POLICY_SERIES_PAYMENT_OPTION),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.paymentMint.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePremiumLedgerPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_PREMIUM_LEDGER),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePremiumReplayPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  replayHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_PREMIUM_REPLAY),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
      Buffer.from(params.replayHash),
    ],
    params.programId,
  )[0];
}

export function deriveCoverageClaimPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  intentHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_COVERAGE_CLAIM),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      params.member.toBuffer(),
      Buffer.from(params.intentHash),
    ],
    params.programId,
  )[0];
}

export function deriveCohortSettlementRootPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  seriesRefHash: Uint8Array;
  cohortHash: Uint8Array;
}): PublicKey {
  if (params.seriesRefHash.length !== 32) {
    throw new Error("seriesRefHash must be exactly 32 bytes");
  }
  if (params.cohortHash.length !== 32) {
    throw new Error("cohortHash must be exactly 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_COHORT_SETTLEMENT_ROOT),
      params.poolAddress.toBuffer(),
      Buffer.from(params.seriesRefHash),
      Buffer.from(params.cohortHash),
    ],
    params.programId,
  )[0];
}

export function deriveProtocolFeeVaultPda(params: {
  programId: PublicKey;
  paymentMint: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_PROTOCOL_FEE_VAULT),
      params.paymentMint.toBuffer(),
    ],
    params.programId,
  )[0];
}

export function derivePoolOracleFeeVaultPda(params: {
  programId: PublicKey;
  poolAddress: PublicKey;
  oracle: PublicKey;
  paymentMint: PublicKey;
}): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(SEED_POOL_ORACLE_FEE_VAULT),
      params.poolAddress.toBuffer(),
      params.oracle.toBuffer(),
      params.paymentMint.toBuffer(),
    ],
    params.programId,
  )[0];
}

function deriveAssociatedTokenAccount(params: {
  mint: PublicKey;
  authority: PublicKey;
}): PublicKey {
  return getAssociatedTokenAddressSync(
    params.mint,
    params.authority,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
}

type CycleQuoteActivationParams = {
  seriesRefHashHex: string;
  periodIndex: bigint;
  nonceHashHex: string;
  premiumAmountRaw: bigint;
  canonicalPremiumAmount: bigint;
  commitmentEnabled: boolean;
  bondAmountRaw: bigint;
  shieldFeeRaw: bigint;
  protocolFeeRaw: bigint;
  oracleFeeRaw: bigint;
  netPoolPremiumRaw: bigint;
  totalAmountRaw: bigint;
  includedShieldCount: number;
  thresholdBps: number;
  outcomeThresholdScore: number;
  cohortHashHex?: string;
  expiresAtTs: bigint;
  quoteMetaHashHex: string;
};

function encodeCycleQuoteActivationData(
  discriminator: Uint8Array,
  params: CycleQuoteActivationParams,
): Uint8Array {
  return concat([
    discriminator,
    asBytes32(params.seriesRefHashHex),
    encodeU64(params.periodIndex),
    asBytes32(params.nonceHashHex),
    encodeU64(params.premiumAmountRaw),
    encodeU64(params.canonicalPremiumAmount),
    Uint8Array.from([params.commitmentEnabled ? 1 : 0]),
    encodeU64(params.bondAmountRaw),
    encodeU64(params.shieldFeeRaw),
    encodeU64(params.protocolFeeRaw),
    encodeU64(params.oracleFeeRaw),
    encodeU64(params.netPoolPremiumRaw),
    encodeU64(params.totalAmountRaw),
    Uint8Array.from([params.includedShieldCount & 0xff]),
    encodeU16(params.thresholdBps),
    encodeU16(params.outcomeThresholdScore),
    asBytes32(params.cohortHashHex ?? "00".repeat(32)),
    encodeI64(params.expiresAtTs),
    asBytes32(params.quoteMetaHashHex),
  ]);
}

export function buildInitializeProtocolTx(params: {
  admin: PublicKey;
  recentBlockhash: string;
  protocolFeeBps: number;
  governanceRealm: string;
  governanceConfig: string;
  defaultStakeMint: string;
  minOracleStake: bigint;
}): Transaction {
  const programId = getProgramId();
  const programData = deriveProgramDataPda(programId);
  const config = deriveConfigPda(programId);
  const defaultStakeMint = new PublicKey(params.defaultStakeMint);
  const data = concat([
    IX_INITIALIZE_PROTOCOL,
    encodeU16(params.protocolFeeBps),
    new PublicKey(params.governanceRealm).toBytes(),
    new PublicKey(params.governanceConfig).toBytes(),
    defaultStakeMint.toBytes(),
    encodeU64(params.minOracleStake),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: programId, isSigner: false, isWritable: false },
      { pubkey: programData, isSigner: false, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.admin,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetProtocolParamsTx(params: {
  governanceAuthority: PublicKey;
  recentBlockhash: string;
  protocolFeeBps: number;
  allowedPayoutMintsHashHex: string;
  defaultStakeMint: string;
  minOracleStake: bigint;
  emergencyPaused: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const data = concat([
    IX_SET_PROTOCOL_PARAMS,
    encodeU16(params.protocolFeeBps),
    asBytes32(params.allowedPayoutMintsHashHex),
    new PublicKey(params.defaultStakeMint).toBytes(),
    encodeU64(params.minOracleStake),
    Uint8Array.from([params.emergencyPaused ? 1 : 0]),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRotateGovernanceAuthorityTx(params: {
  governanceAuthority: PublicKey;
  newAuthority: PublicKey;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const data = concat([
    IX_ROTATE_GOVERNANCE_AUTHORITY,
    params.newAuthority.toBytes(),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRegisterOracleTx(params: {
  admin: PublicKey;
  oracle: PublicKey;
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
  const programId = getProgramId();
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const oracleProfile = deriveOracleProfilePda({
    programId,
    oracle: params.oracle,
  });
  const data = concat([
    IX_REGISTER_ORACLE,
    params.oracle.toBytes(),
    Uint8Array.from([params.oracleType]),
    encodeString(params.displayName.trim()),
    encodeString(params.legalName.trim()),
    encodeString(params.websiteUrl.trim()),
    encodeString(params.appUrl.trim()),
    encodeString(params.logoUri.trim()),
    encodeString(params.webhookUrl.trim()),
    encodeVecBytes32(params.supportedSchemaKeyHashesHex),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: oracleEntry, isSigner: false, isWritable: true },
      { pubkey: oracleProfile, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.admin,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildClaimOracleTx(params: {
  oracle: PublicKey;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const oracleProfile = deriveOracleProfilePda({
    programId,
    oracle: params.oracle,
  });
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: true },
      { pubkey: oracleProfile, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(IX_CLAIM_ORACLE),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildUpdateOracleProfileTx(params: {
  authority: PublicKey;
  oracle: PublicKey;
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
  const programId = getProgramId();
  const oracleProfile = deriveOracleProfilePda({
    programId,
    oracle: params.oracle,
  });
  const data = concat([
    IX_UPDATE_ORACLE_PROFILE,
    Uint8Array.from([params.oracleType]),
    encodeString(params.displayName.trim()),
    encodeString(params.legalName.trim()),
    encodeString(params.websiteUrl.trim()),
    encodeString(params.appUrl.trim()),
    encodeString(params.logoUri.trim()),
    encodeString(params.webhookUrl.trim()),
    encodeVecBytes32(params.supportedSchemaKeyHashesHex),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: oracleProfile, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildUpdateOracleMetadataTx(params: {
  oracle: PublicKey;
  recentBlockhash: string;
  metadataUri: string;
  active: boolean;
}): Transaction {
  const programId = getProgramId();
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const data = concat([
    IX_UPDATE_ORACLE_METADATA,
    encodeString(params.metadataUri.trim()),
    Uint8Array.from([params.active ? 1 : 0]),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildStakeOracleTx(params: {
  staker: PublicKey;
  oracle: PublicKey;
  stakeMint: PublicKey;
  stakeVault: PublicKey;
  stakerTokenAccount: PublicKey;
  recentBlockhash: string;
  amount: bigint;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const stakePosition = deriveOracleStakePda({
    programId,
    oracle: params.oracle,
    staker: params.staker,
  });
  const data = concat([IX_STAKE_ORACLE, encodeU64(params.amount)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.staker, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: stakePosition, isSigner: false, isWritable: true },
      { pubkey: params.stakeMint, isSigner: false, isWritable: true },
      { pubkey: params.stakeVault, isSigner: true, isWritable: true },
      { pubkey: params.stakerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.staker,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRequestUnstakeTx(params: {
  staker: PublicKey;
  oracle: PublicKey;
  recentBlockhash: string;
  amount: bigint;
  cooldownSeconds: bigint;
}): Transaction {
  const programId = getProgramId();
  const stakePosition = deriveOracleStakePda({
    programId,
    oracle: params.oracle,
    staker: params.staker,
  });
  const data = concat([
    IX_REQUEST_UNSTAKE,
    encodeU64(params.amount),
    encodeI64(params.cooldownSeconds),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.staker, isSigner: true, isWritable: false },
      { pubkey: stakePosition, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.staker,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFinalizeUnstakeTx(params: {
  staker: PublicKey;
  oracle: PublicKey;
  stakeVault: PublicKey;
  destinationTokenAccount: PublicKey;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const stakePosition = deriveOracleStakePda({
    programId,
    oracle: params.oracle,
    staker: params.staker,
  });
  const data = IX_FINALIZE_UNSTAKE;
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.staker, isSigner: true, isWritable: false },
      { pubkey: stakePosition, isSigner: false, isWritable: true },
      { pubkey: params.stakeVault, isSigner: false, isWritable: true },
      {
        pubkey: params.destinationTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.staker,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSlashOracleTx(params: {
  governanceAuthority: PublicKey;
  stakePosition: PublicKey;
  stakeVault: PublicKey;
  slashTreasuryTokenAccount: PublicKey;
  recentBlockhash: string;
  amount: bigint;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const data = concat([IX_SLASH_ORACLE, encodeU64(params.amount)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.stakePosition, isSigner: false, isWritable: true },
      { pubkey: params.stakeVault, isSigner: false, isWritable: true },
      {
        pubkey: params.slashTreasuryTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolOracleTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  oracle: PublicKey;
  recentBlockhash: string;
  active: boolean;
}): Transaction {
  const programId = getProgramId();
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const data = concat([
    IX_SET_POOL_ORACLE,
    Uint8Array.from([params.active ? 1 : 0]),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolStatusTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  status: number;
}): Transaction {
  if (
    params.status !== POOL_STATUS_DRAFT &&
    params.status !== POOL_STATUS_ACTIVE &&
    params.status !== POOL_STATUS_CLOSED
  ) {
    throw new Error(
      "Pool status must be one of DRAFT(0), ACTIVE(1), or CLOSED(3).",
    );
  }
  const data = concat([
    IX_SET_POOL_STATUS,
    Uint8Array.from([params.status & 0xff]),
  ]);
  const ix = new TransactionInstruction({
    programId: getProgramId(),
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildCreatePoolTx(params: {
  authority: PublicKey;
  recentBlockhash: string;
  poolId: string;
  organizationRef: string;
  payoutLamportsPerPass: bigint;
  membershipMode: number;
  tokenGateMint: string;
  tokenGateMinBalance: bigint;
  inviteIssuer?: string;
  metadataUri: string;
  poolType?: number;
  cycleMode?: number;
  termsHashHex: string;
  payoutPolicyHashHex: string;
  payoutAssetMint?: string;
}): { tx: Transaction; poolAddress: PublicKey } {
  const programId = getProgramId();
  const poolAddress = derivePoolPda({
    programId,
    authority: params.authority,
    poolId: params.poolId.trim(),
  });
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({ programId, poolAddress });
  const oraclePolicy = derivePoolOraclePolicyPda({ programId, poolAddress });
  const tokenGateMint = new PublicKey(params.tokenGateMint);
  const inviteIssuer = new PublicKey(params.inviteIssuer ?? ZERO_PUBKEY);
  const payoutAssetMint = new PublicKey(params.payoutAssetMint ?? ZERO_PUBKEY);
  const data = concat([
    IX_CREATE_POOL,
    encodeString(params.poolId.trim()),
    encodeString(params.organizationRef.trim()),
    encodeU64(params.payoutLamportsPerPass),
    Uint8Array.from([params.membershipMode & 0xff]),
    tokenGateMint.toBytes(),
    encodeU64(params.tokenGateMinBalance),
    inviteIssuer.toBytes(),
    Uint8Array.from([(params.poolType ?? POOL_TYPE_REWARD) & 0xff]),
    payoutAssetMint.toBytes(),
    asBytes32(params.termsHashHex),
    asBytes32(params.payoutPolicyHashHex),
    Uint8Array.from([params.cycleMode ?? 0]),
    encodeString(params.metadataUri.trim()),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: poolAddress, isSigner: false, isWritable: true },
      { pubkey: poolTerms, isSigner: false, isWritable: true },
      { pubkey: oraclePolicy, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return {
    tx: new Transaction({
      feePayer: params.authority,
      recentBlockhash: params.recentBlockhash,
    }).add(ix),
    poolAddress,
  };
}

export function buildSetPoolOraclePolicyTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  quorumM: number;
  quorumN: number;
  requireVerifiedSchema: boolean;
  oracleFeeBps?: number;
  allowDelegateClaim: boolean;
  challengeWindowSecs?: bigint;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oraclePolicy = derivePoolOraclePolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const data = concat([
    IX_SET_POOL_ORACLE_POLICY,
    Uint8Array.from([params.quorumM & 0xff]),
    Uint8Array.from([params.quorumN & 0xff]),
    Uint8Array.from([params.requireVerifiedSchema ? 1 : 0]),
    encodeU16(params.oracleFeeBps ?? 0),
    Uint8Array.from([params.allowDelegateClaim ? 1 : 0]),
    encodeI64(params.challengeWindowSecs ?? 0n),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: oraclePolicy, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolCoverageReserveFloorTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  paymentMint: PublicKey;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.paymentMint,
  });
  const data = concat([
    IX_SET_POOL_COVERAGE_RESERVE_FLOOR,
    params.paymentMint.toBytes(),
    encodeU64(params.amount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolOraclePermissionsTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  oracle: PublicKey;
  permissions: number;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const data = concat([
    IX_SET_POOL_ORACLE_PERMISSIONS,
    encodeU32(params.permissions),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: params.oracle, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolRiskControlsTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  recentBlockhash: string;
  redemptionMode: number;
  claimMode: number;
  impaired: boolean;
  impairmentAmount: bigint;
  includePoolControlAuthority?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolRiskConfig = derivePoolRiskConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const data = concat([
    IX_SET_POOL_RISK_CONTROLS,
    Uint8Array.from([params.redemptionMode & 0xff]),
    Uint8Array.from([params.claimMode & 0xff]),
    Uint8Array.from([params.impaired ? 1 : 0]),
    encodeU64(params.impairmentAmount),
  ]);
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: poolRiskConfig, isSigner: false, isWritable: true },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    {
      pubkey: params.includePoolControlAuthority
        ? derivePoolControlAuthorityPda({
            programId,
            poolAddress: params.poolAddress,
          })
        : programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolCompliancePolicyTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  providerRefHashHex?: string;
  credentialTypeHashHex?: string;
  revocationListHashHex?: string;
  actionsMask: number;
  bindingMode: number;
  providerMode: number;
  capitalRailMode: number;
  payoutRailMode: number;
  active: boolean;
  includePoolControlAuthority?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolCompliancePolicy = derivePoolCompliancePolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolCompliancePolicy, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: params.includePoolControlAuthority
      ? derivePoolControlAuthorityPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: SystemProgram.programId,
    isSigner: false,
    isWritable: false,
  });
  const data = concat([
    IX_SET_POOL_COMPLIANCE_POLICY,
    asBytes32(params.providerRefHashHex ?? "00".repeat(32)),
    asBytes32(params.credentialTypeHashHex ?? "00".repeat(32)),
    asBytes32(params.revocationListHashHex ?? "00".repeat(32)),
    encodeU16(params.actionsMask),
    Uint8Array.from([params.bindingMode & 0xff]),
    Uint8Array.from([params.providerMode & 0xff]),
    Uint8Array.from([params.capitalRailMode & 0xff]),
    Uint8Array.from([params.payoutRailMode & 0xff]),
    Uint8Array.from([params.active ? 1 : 0]),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolControlAuthoritiesTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  operatorAuthority: PublicKey;
  riskManagerAuthority: PublicKey;
  complianceAuthority: PublicKey;
  guardianAuthority: PublicKey;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolControlAuthority = derivePoolControlAuthorityPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const data = concat([
    IX_SET_POOL_CONTROL_AUTHORITIES,
    params.operatorAuthority.toBytes(),
    params.riskManagerAuthority.toBytes(),
    params.complianceAuthority.toBytes(),
    params.guardianAuthority.toBytes(),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolControlAuthority, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolAutomationPolicyTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  oracleAutomationMode: number;
  claimAutomationMode: number;
  allowedAiRolesMask: number;
  maxAutoClaimAmount: bigint;
  requiredAttestationProviderRefHashHex?: string;
  includePoolControlAuthority?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolAutomationPolicy = derivePoolAutomationPolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolAutomationPolicy, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: params.includePoolControlAuthority
      ? derivePoolControlAuthorityPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: SystemProgram.programId,
    isSigner: false,
    isWritable: false,
  });
  const data = concat([
    IX_SET_POOL_AUTOMATION_POLICY,
    Uint8Array.from([params.oracleAutomationMode & 0xff]),
    Uint8Array.from([params.claimAutomationMode & 0xff]),
    encodeU16(params.allowedAiRolesMask),
    encodeU64(params.maxAutoClaimAmount),
    asBytes32(params.requiredAttestationProviderRefHashHex ?? "00".repeat(32)),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolTermsHashTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  termsHashHex: string;
  payoutPolicyHashHex: string;
  cycleMode: number;
  metadataUri: string;
}): Transaction {
  const programId = getProgramId();
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const data = concat([
    IX_SET_POOL_TERMS_HASH,
    asBytes32(params.termsHashHex),
    asBytes32(params.payoutPolicyHashHex),
    Uint8Array.from([params.cycleMode & 0xff]),
    encodeString(params.metadataUri.trim()),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRegisterOutcomeSchemaTx(params: {
  publisher: PublicKey;
  recentBlockhash: string;
  schemaKeyHashHex: string;
  schemaKey: string;
  version: number;
  schemaHashHex: string;
  schemaFamily?: number;
  visibility?: number;
  interopProfileHashHex?: string;
  codeSystemFamilyHashHex?: string;
  mappingVersion?: number;
  metadataUri: string;
}): Transaction {
  const programId = getProgramId();
  const schemaKeyHash = asBytes32(params.schemaKeyHashHex);
  const schemaEntry = deriveSchemaPda({ programId, schemaKeyHash });
  const schemaDependency = deriveSchemaDependencyPda({
    programId,
    schemaKeyHash,
  });
  const data = concat([
    IX_REGISTER_OUTCOME_SCHEMA,
    schemaKeyHash,
    encodeString(params.schemaKey.trim()),
    encodeU16(params.version),
    asBytes32(params.schemaHashHex),
    Uint8Array.from([(params.schemaFamily ?? SCHEMA_FAMILY_KERNEL) & 0xff]),
    Uint8Array.from([(params.visibility ?? SCHEMA_VISIBILITY_PUBLIC) & 0xff]),
    asBytes32(params.interopProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.codeSystemFamilyHashHex ?? "00".repeat(32)),
    encodeU16(params.mappingVersion ?? 0),
    encodeString(params.metadataUri.trim()),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.publisher, isSigner: true, isWritable: true },
      { pubkey: schemaEntry, isSigner: false, isWritable: true },
      { pubkey: schemaDependency, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.publisher,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildVerifyOutcomeSchemaTx(params: {
  governanceAuthority: PublicKey;
  recentBlockhash: string;
  schemaKeyHashHex: string;
  verified: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const schemaEntry = deriveSchemaPda({
    programId,
    schemaKeyHash: asBytes32(params.schemaKeyHashHex),
  });
  const data = concat([
    IX_VERIFY_OUTCOME_SCHEMA,
    Uint8Array.from([params.verified ? 1 : 0]),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: schemaEntry, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildCloseOutcomeSchemaTx(params: {
  governanceAuthority: PublicKey;
  recipientSystemAccount: PublicKey;
  recentBlockhash: string;
  schemaKeyHashHex: string;
}): Transaction {
  const programId = getProgramId();
  const schemaKeyHash = asBytes32(params.schemaKeyHashHex);
  const config = deriveConfigPda(programId);
  const schemaEntry = deriveSchemaPda({ programId, schemaKeyHash });
  const schemaDependency = deriveSchemaDependencyPda({
    programId,
    schemaKeyHash,
  });
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: schemaEntry, isSigner: false, isWritable: true },
      { pubkey: schemaDependency, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientSystemAccount,
        isSigner: false,
        isWritable: true,
      },
    ],
    data: Buffer.from(IX_CLOSE_OUTCOME_SCHEMA),
  });

  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildBackfillSchemaDependencyLedgerTx(params: {
  governanceAuthority: PublicKey;
  recentBlockhash: string;
  schemaKeyHashHex: string;
  poolRuleAddresses?: PublicKey[];
}): Transaction {
  const programId = getProgramId();
  const schemaKeyHash = asBytes32(params.schemaKeyHashHex);
  const config = deriveConfigPda(programId);
  const schemaEntry = deriveSchemaPda({ programId, schemaKeyHash });
  const schemaDependency = deriveSchemaDependencyPda({
    programId,
    schemaKeyHash,
  });
  const data = concat([IX_BACKFILL_SCHEMA_DEPENDENCY_LEDGER, schemaKeyHash]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: schemaEntry, isSigner: false, isWritable: false },
      { pubkey: schemaDependency, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ...(params.poolRuleAddresses ?? []).map((pubkey) => ({
        pubkey,
        isSigner: false,
        isWritable: false,
      })),
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPolicySeriesOutcomeRuleTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  seriesRefHashHex: string;
  recentBlockhash: string;
  ruleHashHex: string;
  schemaKeyHashHex: string;
  ruleId: string;
  schemaKey: string;
  schemaVersion: number;
  interopProfileHashHex?: string;
  codeSystemFamilyHashHex?: string;
  mappingVersion?: number;
  payoutHashHex: string;
  enabled: boolean;
}): Transaction {
  const programId = getProgramId();
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const ruleHash = asBytes32(params.ruleHashHex);
  const schemaKeyHash = asBytes32(params.schemaKeyHashHex);
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const schemaEntry = deriveSchemaPda({ programId, schemaKeyHash });
  const schemaDependency = deriveSchemaDependencyPda({
    programId,
    schemaKeyHash,
  });
  const poolRule = derivePoolRulePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    ruleHash,
  });
  const data = concat([
    IX_SET_POLICY_SERIES_OUTCOME_RULE,
    seriesRefHash,
    ruleHash,
    schemaKeyHash,
    encodeString(params.ruleId.trim()),
    encodeString(params.schemaKey.trim()),
    encodeU16(params.schemaVersion),
    asBytes32(params.interopProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.codeSystemFamilyHashHex ?? "00".repeat(32)),
    encodeU16(params.mappingVersion ?? 0),
    asBytes32(params.payoutHashHex),
    Uint8Array.from([params.enabled ? 1 : 0]),
  ]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: policySeries, isSigner: false, isWritable: false },
      { pubkey: schemaEntry, isSigner: false, isWritable: false },
      { pubkey: schemaDependency, isSigner: false, isWritable: true },
      { pubkey: poolRule, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildEnrollMemberTokenGateTx(params: {
  member: PublicKey;
  poolAddress: PublicKey;
  tokenGateAccount: PublicKey;
  recentBlockhash: string;
  subjectCommitmentHex?: string;
  includePoolCompliancePolicy?: boolean;
}): Transaction {
  const programId = getProgramId();
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const subjectCommitment = params.subjectCommitmentHex
    ? asBytes32(params.subjectCommitmentHex)
    : params.member.toBytes();
  const data = concat([IX_ENROLL_MEMBER_TOKEN_GATE, subjectCommitment]);

  const keys = [
    { pubkey: params.member, isSigner: true, isWritable: true },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: membership, isSigner: false, isWritable: true },
    { pubkey: params.tokenGateAccount, isSigner: false, isWritable: false },
  ];
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: SystemProgram.programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.member,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRegisterInviteIssuerTx(params: {
  issuer: PublicKey;
  recentBlockhash: string;
  organizationRef: string;
  metadataUri: string;
  active: boolean;
}): Transaction {
  const programId = getProgramId();
  const inviteIssuerEntry = deriveInviteIssuerPda({
    programId,
    issuer: params.issuer,
  });
  const data = concat([
    IX_REGISTER_INVITE_ISSUER,
    encodeString(params.organizationRef.trim()),
    encodeString(params.metadataUri.trim()),
    Uint8Array.from([params.active ? 1 : 0]),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.issuer, isSigner: true, isWritable: true },
      { pubkey: inviteIssuerEntry, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.issuer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildEnrollMemberOpenTx(params: {
  member: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  subjectCommitmentHex?: string;
  includePoolCompliancePolicy?: boolean;
}): Transaction {
  const programId = getProgramId();
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const subjectCommitment = params.subjectCommitmentHex
    ? asBytes32(params.subjectCommitmentHex)
    : params.member.toBytes();
  const data = concat([IX_ENROLL_MEMBER_OPEN, subjectCommitment]);
  const keys = [
    { pubkey: params.member, isSigner: true, isWritable: true },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: membership, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: SystemProgram.programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.member,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildEnrollMemberInvitePermitTx(params: {
  member: PublicKey;
  poolAddress: PublicKey;
  issuer: PublicKey;
  recentBlockhash: string;
  subjectCommitmentHex?: string;
  nonceHashHex: string;
  inviteIdHashHex: string;
  expiresAtTs: bigint;
  includePoolCompliancePolicy?: boolean;
}): Transaction {
  const programId = getProgramId();
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const inviteIssuerEntry = deriveInviteIssuerPda({
    programId,
    issuer: params.issuer,
  });
  const nonceHash = asBytes32(params.nonceHashHex);
  const enrollmentReplay = deriveEnrollmentReplayPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
    nonceHash,
  });
  const subjectCommitment = params.subjectCommitmentHex
    ? asBytes32(params.subjectCommitmentHex)
    : params.member.toBytes();
  const data = concat([
    IX_ENROLL_MEMBER_INVITE_PERMIT,
    subjectCommitment,
    nonceHash,
    asBytes32(params.inviteIdHashHex),
    encodeI64(params.expiresAtTs),
  ]);
  const keys = [
    { pubkey: params.member, isSigner: true, isWritable: true },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: membership, isSigner: false, isWritable: true },
    { pubkey: params.issuer, isSigner: true, isWritable: false },
    { pubkey: inviteIssuerEntry, isSigner: false, isWritable: false },
    {
      pubkey: params.includePoolCompliancePolicy
        ? derivePoolCompliancePolicyPda({
            programId,
            poolAddress: params.poolAddress,
          })
        : programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: enrollmentReplay, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: SystemProgram.programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.member,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetClaimDelegateTx(params: {
  member: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  delegate: PublicKey;
  active: boolean;
}): Transaction {
  const programId = getProgramId();
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const claimDelegate = deriveClaimDelegatePda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const data = concat([
    IX_SET_CLAIM_DELEGATE,
    params.delegate.toBytes(),
    Uint8Array.from([params.active ? 1 : 0]),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.member, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: membership, isSigner: false, isWritable: false },
      { pubkey: claimDelegate, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.member,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFundPoolSolTx(params: {
  funder: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  lamports: bigint;
}): Transaction {
  const programId = getProgramId();
  const data = concat([IX_FUND_POOL_SOL, encodeU64(params.lamports)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.funder, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return new Transaction({
    feePayer: params.funder,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFundPoolSplTx(params: {
  funder: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  funderTokenAccount: PublicKey;
  recentBlockhash: string;
  amount: bigint;
}): Transaction {
  const programId = getProgramId();
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.payoutMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(
    params.payoutMint,
    poolAssetVault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([IX_FUND_POOL_SPL, encodeU64(params.amount)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.funder, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: params.payoutMint, isSigner: false, isWritable: true },
      { pubkey: poolAssetVault, isSigner: false, isWritable: true },
      { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.funderTokenAccount, isSigner: false, isWritable: true },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.funder,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildInitializePoolLiquiditySolTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  initialLamports: bigint;
}): Transaction {
  const programId = getProgramId();
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const authorityShareTokenAccount = getAssociatedTokenAddressSync(
    poolShareMint,
    params.authority,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([
    IX_INITIALIZE_POOL_LIQUIDITY_SOL,
    encodeU64(params.initialLamports),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: poolLiquidityConfig, isSigner: false, isWritable: true },
      { pubkey: poolShareMint, isSigner: false, isWritable: true },
      { pubkey: authorityShareTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildInitializePoolLiquiditySplTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  authorityPayoutTokenAccount: PublicKey;
  recentBlockhash: string;
  initialAmount: bigint;
}): Transaction {
  const programId = getProgramId();
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.payoutMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(
    params.payoutMint,
    poolAssetVault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const authorityShareTokenAccount = getAssociatedTokenAddressSync(
    poolShareMint,
    params.authority,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([
    IX_INITIALIZE_POOL_LIQUIDITY_SPL,
    encodeU64(params.initialAmount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: params.payoutMint, isSigner: false, isWritable: true },
      { pubkey: poolAssetVault, isSigner: false, isWritable: true },
      { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
      {
        pubkey: params.authorityPayoutTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: poolLiquidityConfig, isSigner: false, isWritable: true },
      { pubkey: poolShareMint, isSigner: false, isWritable: true },
      { pubkey: authorityShareTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSetPoolLiquidityEnabledTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  enabled: boolean;
}): Transaction {
  const programId = getProgramId();
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const data = concat([
    IX_SET_POOL_LIQUIDITY_ENABLED,
    Uint8Array.from([params.enabled ? 1 : 0]),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolLiquidityConfig, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRegisterPoolCapitalClassTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  classIdHashHex: string;
  classMode: number;
  classPriority: number;
  transferMode: number;
  restricted: boolean;
  redemptionQueueEnabled: boolean;
  ringFenced: boolean;
  lockupSecs: bigint;
  redemptionNoticeSecs: bigint;
  complianceProfileHashHex?: string;
  seriesRefHashHex?: string;
  vintageIndex: number;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolCapitalClass = derivePoolCapitalClassPda({
    programId,
    poolAddress: params.poolAddress,
    shareMint: poolShareMint,
  });
  const data = concat([
    IX_REGISTER_POOL_CAPITAL_CLASS,
    asBytes32(params.classIdHashHex),
    Uint8Array.from([params.classMode & 0xff]),
    Uint8Array.from([params.classPriority & 0xff]),
    Uint8Array.from([params.transferMode & 0xff]),
    Uint8Array.from([params.restricted ? 1 : 0]),
    Uint8Array.from([params.redemptionQueueEnabled ? 1 : 0]),
    Uint8Array.from([params.ringFenced ? 1 : 0]),
    encodeI64(params.lockupSecs),
    encodeI64(params.redemptionNoticeSecs),
    asBytes32(params.complianceProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.seriesRefHashHex ?? "00".repeat(32)),
    encodeU16(params.vintageIndex),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: poolLiquidityConfig, isSigner: false, isWritable: false },
      { pubkey: poolShareMint, isSigner: false, isWritable: true },
      { pubkey: poolCapitalClass, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildDepositPoolLiquiditySolTx(params: {
  depositor: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  amountIn: bigint;
  minSharesOut: bigint;
  includePoolCapitalClass?: boolean;
  includePoolCompliancePolicy?: boolean;
  includeMembership?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const depositorShareTokenAccount = getAssociatedTokenAddressSync(
    poolShareMint,
    params.depositor,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([
    IX_DEPOSIT_POOL_LIQUIDITY_SOL,
    encodeU64(params.amountIn),
    encodeU64(params.minSharesOut),
  ]);
  const keys = [
    { pubkey: params.depositor, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: true },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: poolLiquidityConfig, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: depositorShareTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  keys.push({
    pubkey: params.includePoolCapitalClass
      ? derivePoolCapitalClassPda({
          programId,
          poolAddress: params.poolAddress,
          shareMint: poolShareMint,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includeMembership
      ? deriveMembershipPda({
          programId,
          poolAddress: params.poolAddress,
          member: params.depositor,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.depositor,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildDepositPoolLiquiditySplTx(params: {
  depositor: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  depositorPayoutTokenAccount: PublicKey;
  recentBlockhash: string;
  amountIn: bigint;
  minSharesOut: bigint;
  includePoolCapitalClass?: boolean;
  includePoolCompliancePolicy?: boolean;
  includeMembership?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.payoutMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(
    params.payoutMint,
    poolAssetVault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const depositorShareTokenAccount = getAssociatedTokenAddressSync(
    poolShareMint,
    params.depositor,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([
    IX_DEPOSIT_POOL_LIQUIDITY_SPL,
    encodeU64(params.amountIn),
    encodeU64(params.minSharesOut),
  ]);
  const keys = [
    { pubkey: params.depositor, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: params.payoutMint, isSigner: false, isWritable: true },
    { pubkey: poolAssetVault, isSigner: false, isWritable: false },
    { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
    {
      pubkey: params.depositorPayoutTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: poolLiquidityConfig, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: depositorShareTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  keys.push({
    pubkey: params.includePoolCapitalClass
      ? derivePoolCapitalClassPda({
          programId,
          poolAddress: params.poolAddress,
          shareMint: poolShareMint,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includeMembership
      ? deriveMembershipPda({
          programId,
          poolAddress: params.poolAddress,
          member: params.depositor,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.depositor,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRedeemPoolLiquiditySolTx(params: {
  redeemer: PublicKey;
  poolAddress: PublicKey;
  recentBlockhash: string;
  sharesIn: bigint;
  minAmountOut: bigint;
  includePoolCapitalClass?: boolean;
  includePoolCompliancePolicy?: boolean;
  includeMembership?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolRiskConfig = derivePoolRiskConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: new PublicKey(ZERO_PUBKEY),
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const redeemerShareTokenAccount = getAssociatedTokenAddressSync(
    poolShareMint,
    params.redeemer,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([
    IX_REDEEM_POOL_LIQUIDITY_SOL,
    encodeU64(params.sharesIn),
    encodeU64(params.minAmountOut),
  ]);
  const keys = [
    { pubkey: params.redeemer, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: true },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: poolLiquidityConfig, isSigner: false, isWritable: true },
    { pubkey: poolRiskConfig, isSigner: false, isWritable: true },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: redeemerShareTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  keys.push({
    pubkey: params.includePoolCapitalClass
      ? derivePoolCapitalClassPda({
          programId,
          poolAddress: params.poolAddress,
          shareMint: poolShareMint,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includeMembership
      ? deriveMembershipPda({
          programId,
          poolAddress: params.poolAddress,
          member: params.redeemer,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.redeemer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRedeemPoolLiquiditySplTx(params: {
  redeemer: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  redeemerPayoutTokenAccount: PublicKey;
  recentBlockhash: string;
  sharesIn: bigint;
  minAmountOut: bigint;
  includePoolCapitalClass?: boolean;
  includePoolCompliancePolicy?: boolean;
  includeMembership?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.payoutMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(
    params.payoutMint,
    poolAssetVault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolRiskConfig = derivePoolRiskConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const redeemerShareTokenAccount = getAssociatedTokenAddressSync(
    poolShareMint,
    params.redeemer,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([
    IX_REDEEM_POOL_LIQUIDITY_SPL,
    encodeU64(params.sharesIn),
    encodeU64(params.minAmountOut),
  ]);
  const keys = [
    { pubkey: params.redeemer, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: params.payoutMint, isSigner: false, isWritable: true },
    { pubkey: poolAssetVault, isSigner: false, isWritable: false },
    { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
    {
      pubkey: params.redeemerPayoutTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: poolLiquidityConfig, isSigner: false, isWritable: true },
    { pubkey: poolRiskConfig, isSigner: false, isWritable: true },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: redeemerShareTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  keys.push({
    pubkey: params.includePoolCapitalClass
      ? derivePoolCapitalClassPda({
          programId,
          poolAddress: params.poolAddress,
          shareMint: poolShareMint,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includeMembership
      ? deriveMembershipPda({
          programId,
          poolAddress: params.poolAddress,
          member: params.redeemer,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.redeemer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildRequestPoolLiquidityRedemptionTx(params: {
  redeemer: PublicKey;
  poolAddress: PublicKey;
  payoutMint?: PublicKey;
  recentBlockhash: string;
  requestHashHex: string;
  sharesIn: bigint;
  minAmountOut: bigint;
  redeemerShareTokenAccount?: PublicKey;
  includePoolCapitalClass?: boolean;
  includePoolCompliancePolicy?: boolean;
  includeMembership?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolLiquidityConfig = derivePoolLiquidityConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolRiskConfig = derivePoolRiskConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const payoutMint = params.payoutMint ?? new PublicKey(ZERO_PUBKEY);
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: payoutMint,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const redeemerShareTokenAccount =
    params.redeemerShareTokenAccount ??
    getAssociatedTokenAddressSync(
      poolShareMint,
      params.redeemer,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
    );
  const requestHash = asBytes32(params.requestHashHex);
  const redemptionRequest = deriveRedemptionRequestPda({
    programId,
    poolAddress: params.poolAddress,
    redeemer: params.redeemer,
    requestHash,
  });
  const redemptionRequestShareEscrow = getAssociatedTokenAddressSync(
    poolShareMint,
    redemptionRequest,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const data = concat([
    IX_REQUEST_POOL_LIQUIDITY_REDEMPTION,
    requestHash,
    encodeU64(params.sharesIn),
    encodeU64(params.minAmountOut),
  ]);
  const keys = [
    { pubkey: params.redeemer, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: poolLiquidityConfig, isSigner: false, isWritable: false },
    { pubkey: poolRiskConfig, isSigner: false, isWritable: true },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: redeemerShareTokenAccount, isSigner: false, isWritable: true },
    { pubkey: redemptionRequest, isSigner: false, isWritable: true },
    { pubkey: redemptionRequestShareEscrow, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  keys.push({
    pubkey: params.includePoolCapitalClass
      ? derivePoolCapitalClassPda({
          programId,
          poolAddress: params.poolAddress,
          shareMint: poolShareMint,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: params.includeMembership
      ? deriveMembershipPda({
          programId,
          poolAddress: params.poolAddress,
          member: params.redeemer,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.redeemer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSchedulePoolLiquidityRedemptionTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  redemptionRequest: PublicKey;
  recentBlockhash: string;
  includePoolControlAuthority?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: params.redemptionRequest, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: params.includePoolControlAuthority
      ? derivePoolControlAuthorityPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(IX_SCHEDULE_POOL_LIQUIDITY_REDEMPTION),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildCancelPoolLiquidityRedemptionTx(params: {
  redeemer: PublicKey;
  poolAddress: PublicKey;
  redemptionRequest: PublicKey;
  recentBlockhash: string;
  redeemerShareTokenAccount?: PublicKey;
}): Transaction {
  const programId = getProgramId();
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const redemptionRequestShareEscrow = getAssociatedTokenAddressSync(
    poolShareMint,
    params.redemptionRequest,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const redeemerShareTokenAccount =
    params.redeemerShareTokenAccount ??
    getAssociatedTokenAddressSync(
      poolShareMint,
      params.redeemer,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
    );
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.redeemer, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: params.redemptionRequest, isSigner: false, isWritable: true },
      { pubkey: poolShareMint, isSigner: false, isWritable: true },
      {
        pubkey: redemptionRequestShareEscrow,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: redeemerShareTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(IX_CANCEL_POOL_LIQUIDITY_REDEMPTION),
  });
  return new Transaction({
    feePayer: params.redeemer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFailPoolLiquidityRedemptionTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  redemptionRequest: PublicKey;
  redeemer: PublicKey;
  recentBlockhash: string;
  failureCode: number;
  redeemerShareTokenAccount?: PublicKey;
  includePoolControlAuthority?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const redemptionRequestShareEscrow = getAssociatedTokenAddressSync(
    poolShareMint,
    params.redemptionRequest,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const redeemerShareTokenAccount =
    params.redeemerShareTokenAccount ??
    getAssociatedTokenAddressSync(
      poolShareMint,
      params.redeemer,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
    );
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: params.redemptionRequest, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: redemptionRequestShareEscrow, isSigner: false, isWritable: true },
    { pubkey: redeemerShareTokenAccount, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: params.includePoolControlAuthority
      ? derivePoolControlAuthorityPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
  const data = concat([
    IX_FAIL_POOL_LIQUIDITY_REDEMPTION,
    encodeU16(params.failureCode),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFulfillPoolLiquidityRedemptionSolTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  redemptionRequest: PublicKey;
  redeemerSystemAccount: PublicKey;
  recentBlockhash: string;
  includePoolControlAuthority?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: new PublicKey(ZERO_PUBKEY),
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const redemptionRequestShareEscrow = getAssociatedTokenAddressSync(
    poolShareMint,
    params.redemptionRequest,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: true },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    { pubkey: params.redemptionRequest, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: redemptionRequestShareEscrow, isSigner: false, isWritable: true },
    { pubkey: params.redeemerSystemAccount, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: params.includePoolControlAuthority
      ? derivePoolControlAuthorityPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(IX_FULFILL_POOL_LIQUIDITY_REDEMPTION_SOL),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFulfillPoolLiquidityRedemptionSplTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  redemptionRequest: PublicKey;
  redeemerPayoutTokenAccount: PublicKey;
  recentBlockhash: string;
  includePoolControlAuthority?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.payoutMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(
    params.payoutMint,
    poolAssetVault,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const poolShareMint = derivePoolShareMintPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const redemptionRequestShareEscrow = getAssociatedTokenAddressSync(
    poolShareMint,
    params.redemptionRequest,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
  );
  const keys = [
    { pubkey: params.authority, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: params.payoutMint, isSigner: false, isWritable: true },
    { pubkey: poolAssetVault, isSigner: false, isWritable: false },
    { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    { pubkey: params.redemptionRequest, isSigner: false, isWritable: true },
    { pubkey: poolShareMint, isSigner: false, isWritable: true },
    { pubkey: redemptionRequestShareEscrow, isSigner: false, isWritable: true },
    {
      pubkey: params.redeemerPayoutTokenAccount,
      isSigner: false,
      isWritable: true,
    },
  ];
  keys.push({
    pubkey: params.includePoolControlAuthority
      ? derivePoolControlAuthorityPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(IX_FULFILL_POOL_LIQUIDITY_REDEMPTION_SPL),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildActivateCycleWithQuoteSolTx(
  params: CycleQuoteActivationParams & {
    payer: PublicKey;
    poolAddress: PublicKey;
    oracle: PublicKey;
    recentBlockhash: string;
    member?: PublicKey;
    instructionsSysvar?: PublicKey;
    quoteVerificationInstruction?: TransactionInstruction;
  },
): Transaction {
  const programId = getProgramId();
  const member = params.member ?? params.payer;
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const oraclePolicy = derivePoolOraclePolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member,
  });
  const coverageProduct = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const coverageProductPaymentOption = derivePolicySeriesPaymentOptionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
  });
  const coveragePolicyNft = derivePolicyPositionNftPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
  });
  const premiumLedger = derivePremiumLedgerPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
  });
  const protocolFeeVault = deriveProtocolFeeVaultPda({
    programId,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const poolOracleFeeVault = derivePoolOracleFeeVaultPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const memberCycle = deriveMemberCyclePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
    periodIndex: params.periodIndex,
  });
  const cycleQuoteReplay = deriveCycleQuoteReplayPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
    nonceHash: asBytes32(params.nonceHashHex),
  });
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: member, isSigner: false, isWritable: false },
      { pubkey: params.oracle, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: oraclePolicy, isSigner: false, isWritable: false },
      { pubkey: membership, isSigner: false, isWritable: true },
      { pubkey: coverageProduct, isSigner: false, isWritable: false },
      {
        pubkey: coverageProductPaymentOption,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: coveragePolicy, isSigner: false, isWritable: true },
      { pubkey: coveragePolicyNft, isSigner: false, isWritable: true },
      { pubkey: premiumLedger, isSigner: false, isWritable: true },
      { pubkey: protocolFeeVault, isSigner: false, isWritable: true },
      { pubkey: poolOracleFeeVault, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: memberCycle, isSigner: false, isWritable: true },
      { pubkey: cycleQuoteReplay, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      {
        pubkey: params.instructionsSysvar ?? SYSVAR_INSTRUCTIONS_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: Buffer.from(
      encodeCycleQuoteActivationData(IX_ACTIVATE_CYCLE_WITH_QUOTE_SOL, params),
    ),
  });
  const tx = new Transaction({
    feePayer: params.payer,
    recentBlockhash: params.recentBlockhash,
  });
  if (params.quoteVerificationInstruction) {
    tx.add(params.quoteVerificationInstruction);
  }
  return tx.add(ix);
}

export function buildActivateCycleWithQuoteSplTx(
  params: CycleQuoteActivationParams & {
    payer: PublicKey;
    poolAddress: PublicKey;
    oracle: PublicKey;
    paymentMint: PublicKey;
    payerTokenAccount: PublicKey;
    recentBlockhash: string;
    member?: PublicKey;
    instructionsSysvar?: PublicKey;
    quoteVerificationInstruction?: TransactionInstruction;
  },
): Transaction {
  const programId = getProgramId();
  const member = params.member ?? params.payer;
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const oraclePolicy = derivePoolOraclePolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member,
  });
  const coverageProduct = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const coverageProductPaymentOption = derivePolicySeriesPaymentOptionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    paymentMint: params.paymentMint,
  });
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
  });
  const coveragePolicyNft = derivePolicyPositionNftPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
  });
  const premiumLedger = derivePremiumLedgerPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.paymentMint,
  });
  const poolVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: poolAssetVault,
  });
  const protocolFeeVault = deriveProtocolFeeVaultPda({
    programId,
    paymentMint: params.paymentMint,
  });
  const protocolFeeVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: protocolFeeVault,
  });
  const poolOracleFeeVault = derivePoolOracleFeeVaultPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
    paymentMint: params.paymentMint,
  });
  const poolOracleFeeVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: poolOracleFeeVault,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.paymentMint,
  });
  const memberCycle = deriveMemberCyclePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
    periodIndex: params.periodIndex,
  });
  const cycleQuoteReplay = deriveCycleQuoteReplayPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member,
    nonceHash: asBytes32(params.nonceHashHex),
  });
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: member, isSigner: false, isWritable: false },
      { pubkey: params.oracle, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: oraclePolicy, isSigner: false, isWritable: false },
      { pubkey: membership, isSigner: false, isWritable: true },
      { pubkey: coverageProduct, isSigner: false, isWritable: false },
      {
        pubkey: coverageProductPaymentOption,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: params.paymentMint, isSigner: false, isWritable: true },
      { pubkey: coveragePolicy, isSigner: false, isWritable: true },
      { pubkey: coveragePolicyNft, isSigner: false, isWritable: true },
      { pubkey: premiumLedger, isSigner: false, isWritable: true },
      { pubkey: poolAssetVault, isSigner: false, isWritable: true },
      { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.payerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: protocolFeeVault, isSigner: false, isWritable: true },
      {
        pubkey: protocolFeeVaultTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: poolOracleFeeVault, isSigner: false, isWritable: true },
      {
        pubkey: poolOracleFeeVaultTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: memberCycle, isSigner: false, isWritable: true },
      { pubkey: cycleQuoteReplay, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      {
        pubkey: params.instructionsSysvar ?? SYSVAR_INSTRUCTIONS_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: Buffer.from(
      encodeCycleQuoteActivationData(IX_ACTIVATE_CYCLE_WITH_QUOTE_SPL, params),
    ),
  });
  const tx = new Transaction({
    feePayer: params.payer,
    recentBlockhash: params.recentBlockhash,
  });
  if (params.quoteVerificationInstruction) {
    tx.add(params.quoteVerificationInstruction);
  }
  return tx.add(ix);
}

export function buildSettleCycleCommitmentTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  paymentMint: PublicKey;
  periodIndex: bigint;
  passed: boolean;
  shieldConsumed: boolean;
  settledHealthAlphaScore: number;
  recipientTokenAccount: PublicKey;
  recentBlockhash: string;
  cohortHashHex?: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.paymentMint,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.paymentMint,
  });
  const poolVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: poolAssetVault,
  });
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const memberCycle = deriveMemberCyclePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    periodIndex: params.periodIndex,
  });
  const cohortSettlementRoot = deriveCohortSettlementRootPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    cohortHash: asBytes32(params.cohortHashHex ?? "00".repeat(32)),
  });
  const data = concat([
    IX_SETTLE_CYCLE_COMMITMENT,
    asBytes32(params.seriesRefHashHex),
    encodeU64(params.periodIndex),
    Uint8Array.from([params.passed ? 1 : 0]),
    Uint8Array.from([params.shieldConsumed ? 1 : 0]),
    encodeU16(params.settledHealthAlphaScore),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: params.member, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: params.paymentMint, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: poolAssetVault, isSigner: false, isWritable: false },
      { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: memberCycle, isSigner: false, isWritable: true },
      { pubkey: cohortSettlementRoot, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSettleCycleCommitmentSolTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  periodIndex: bigint;
  passed: boolean;
  shieldConsumed: boolean;
  settledHealthAlphaScore: number;
  recipientSystemAccount: PublicKey;
  recentBlockhash: string;
  cohortHashHex?: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const memberCycle = deriveMemberCyclePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    periodIndex: params.periodIndex,
  });
  const cohortSettlementRoot = deriveCohortSettlementRootPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    cohortHash: asBytes32(params.cohortHashHex ?? "00".repeat(32)),
  });
  const data = concat([
    IX_SETTLE_CYCLE_COMMITMENT_SOL,
    asBytes32(params.seriesRefHashHex),
    encodeU64(params.periodIndex),
    Uint8Array.from([params.passed ? 1 : 0]),
    Uint8Array.from([params.shieldConsumed ? 1 : 0]),
    encodeU16(params.settledHealthAlphaScore),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: params.member, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientSystemAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: memberCycle, isSigner: false, isWritable: true },
      { pubkey: cohortSettlementRoot, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFinalizeCohortSettlementRootTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  seriesRefHashHex: string;
  cohortHashHex: string;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const cohortSettlementRoot = deriveCohortSettlementRootPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    cohortHash: asBytes32(params.cohortHashHex),
  });
  const data = concat([
    IX_FINALIZE_COHORT_SETTLEMENT_ROOT,
    seriesRefHash,
    asBytes32(params.cohortHashHex),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: cohortSettlementRoot, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSubmitOutcomeAttestationVoteTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  seriesRefHashHex: string;
  member: PublicKey;
  cycleHashHex: string;
  ruleHashHex: string;
  schemaKeyHashHex: string;
  attestationDigestHex: string;
  observedValueHashHex: string;
  evidenceHashHex?: string;
  externalAttestationRefHashHex?: string;
  aiRole?: number;
  automationMode?: number;
  modelVersionHashHex?: string;
  policyVersionHashHex?: string;
  executionEnvironmentHashHex?: string;
  attestationProviderRefHashHex?: string;
  asOfTs: bigint;
  passed: boolean;
  recentBlockhash: string;
  includePoolAutomationPolicy?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const stakePosition = deriveOracleStakePda({
    programId,
    oracle: params.oracle,
    staker: params.oracle,
  });
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const oraclePolicy = derivePoolOraclePolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const ruleHash = asBytes32(params.ruleHashHex);
  const cycleHash = asBytes32(params.cycleHashHex);
  const poolRule = derivePoolRulePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    ruleHash,
  });
  const aggregate = deriveOutcomeAggregatePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    cycleHash,
    ruleHash,
  });
  const vote = deriveAttestationVotePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    cycleHash,
    ruleHash,
    oracle: params.oracle,
  });
  const schemaEntry = deriveSchemaPda({
    programId,
    schemaKeyHash: asBytes32(params.schemaKeyHashHex),
  });
  const data = concat([
    IX_SUBMIT_OUTCOME_ATTESTATION_VOTE,
    params.member.toBytes(),
    cycleHash,
    ruleHash,
    asBytes32(params.attestationDigestHex),
    asBytes32(params.observedValueHashHex),
    asBytes32(params.evidenceHashHex ?? "00".repeat(32)),
    asBytes32(params.externalAttestationRefHashHex ?? "00".repeat(32)),
    Uint8Array.from([(params.aiRole ?? AI_ROLE_NONE) & 0xff]),
    Uint8Array.from([
      (params.automationMode ?? AUTOMATION_MODE_DISABLED) & 0xff,
    ]),
    asBytes32(params.modelVersionHashHex ?? "00".repeat(32)),
    asBytes32(params.policyVersionHashHex ?? "00".repeat(32)),
    asBytes32(params.executionEnvironmentHashHex ?? "00".repeat(32)),
    asBytes32(params.attestationProviderRefHashHex ?? "00".repeat(32)),
    encodeI64(params.asOfTs),
    Uint8Array.from([params.passed ? 1 : 0]),
  ]);
  const keys = [
    { pubkey: params.oracle, isSigner: true, isWritable: true },
    { pubkey: oracleEntry, isSigner: false, isWritable: false },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: stakePosition, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: oraclePolicy, isSigner: false, isWritable: false },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    { pubkey: poolOracle, isSigner: false, isWritable: false },
    { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
    { pubkey: membership, isSigner: false, isWritable: false },
    { pubkey: poolRule, isSigner: false, isWritable: false },
    { pubkey: schemaEntry, isSigner: false, isWritable: false },
    { pubkey: vote, isSigner: false, isWritable: true },
    { pubkey: aggregate, isSigner: false, isWritable: true },
  ];
  keys.push({
    pubkey: params.includePoolAutomationPolicy
      ? derivePoolAutomationPolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  keys.push({
    pubkey: SystemProgram.programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildFinalizeCycleOutcomeTx(params: {
  feePayer: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  seriesRefHashHex: string;
  member: PublicKey;
  cycleHashHex: string;
  ruleHashHex: string;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const oraclePolicy = derivePoolOraclePolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const aggregate = deriveOutcomeAggregatePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    cycleHash: asBytes32(params.cycleHashHex),
    ruleHash: asBytes32(params.ruleHashHex),
  });
  const data = IX_FINALIZE_CYCLE_OUTCOME;
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.feePayer, isSigner: true, isWritable: true },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: oraclePolicy, isSigner: false, isWritable: false },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: aggregate, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.feePayer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildOpenCycleOutcomeDisputeTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  aggregate: PublicKey;
  disputeReasonHashHex: string;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const data = concat([
    IX_OPEN_CYCLE_OUTCOME_DISPUTE,
    asBytes32(params.disputeReasonHashHex),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: params.aggregate, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildResolveCycleOutcomeDisputeTx(params: {
  governanceAuthority: PublicKey;
  poolAddress: PublicKey;
  payoutMint: PublicKey;
  aggregate: PublicKey;
  sustainOriginalOutcome: boolean;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const data = concat([
    IX_RESOLVE_CYCLE_OUTCOME_DISPUTE,
    Uint8Array.from([params.sustainOriginalOutcome ? 1 : 0]),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: params.aggregate, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSubmitRewardClaimTx(params: {
  claimant: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  cycleHashHex: string;
  ruleHashHex: string;
  intentHashHex: string;
  payoutAmount: bigint;
  recipient: PublicKey;
  recipientSystemAccount: PublicKey;
  recentBlockhash: string;
  payoutMint?: PublicKey;
  memberCycle?: PublicKey;
  cohortSettlementRoot?: PublicKey;
  claimDelegate?: PublicKey;
  poolAssetVault?: PublicKey;
  poolVaultTokenAccount?: PublicKey;
  recipientTokenAccount?: PublicKey;
  includePoolCompliancePolicy?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const cycleHash = asBytes32(params.cycleHashHex);
  const ruleHash = asBytes32(params.ruleHashHex);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const oraclePolicy = derivePoolOraclePolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint ?? new PublicKey(ZERO_PUBKEY),
  });
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const aggregate = deriveOutcomeAggregatePda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    cycleHash,
    ruleHash,
  });
  const claimRecord = deriveClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    cycleHash,
    ruleHash,
  });
  const data = concat([
    IX_SUBMIT_REWARD_CLAIM,
    params.member.toBytes(),
    cycleHash,
    ruleHash,
    asBytes32(params.intentHashHex),
    encodeU64(params.payoutAmount),
    params.recipient.toBytes(),
  ]);
  const keys = [
    { pubkey: params.claimant, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: true },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: oraclePolicy, isSigner: false, isWritable: false },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    { pubkey: membership, isSigner: false, isWritable: false },
    { pubkey: aggregate, isSigner: false, isWritable: true },
    {
      pubkey: params.memberCycle ?? programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: params.cohortSettlementRoot ?? params.poolAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: params.recipientSystemAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: params.claimDelegate ?? programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: params.poolAssetVault ?? programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: params.poolVaultTokenAccount ?? programId,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: params.recipientTokenAccount ?? programId,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: claimRecord, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  keys.push({
    pubkey: params.includePoolCompliancePolicy
      ? derivePoolCompliancePolicyPda({
          programId,
          poolAddress: params.poolAddress,
        })
      : programId,
    isSigner: false,
    isWritable: false,
  });
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.claimant,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildCreatePolicySeriesTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  seriesRefHashHex: string;
  status: number;
  planMode: number;
  sponsorMode: number;
  displayName: string;
  metadataUri: string;
  termsHashHex: string;
  durationSecs: bigint;
  premiumDueEverySecs: bigint;
  premiumGraceSecs: bigint;
  premiumAmount: bigint;
  interopProfileHashHex?: string;
  oracleProfileHashHex?: string;
  riskFamilyHashHex?: string;
  issuanceTemplateHashHex?: string;
  comparabilityHashHex?: string;
  renewalOfHashHex?: string;
  termsVersion: number;
  mappingVersion: number;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const data = concat([
    IX_CREATE_POLICY_SERIES,
    seriesRefHash,
    Uint8Array.from([params.status & 0xff]),
    Uint8Array.from([params.planMode & 0xff]),
    Uint8Array.from([params.sponsorMode & 0xff]),
    encodeString(params.displayName.trim()),
    encodeString(params.metadataUri.trim()),
    asBytes32(params.termsHashHex),
    encodeI64(params.durationSecs),
    encodeI64(params.premiumDueEverySecs),
    encodeI64(params.premiumGraceSecs),
    encodeU64(params.premiumAmount),
    asBytes32(params.interopProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.oracleProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.riskFamilyHashHex ?? "00".repeat(32)),
    asBytes32(params.issuanceTemplateHashHex ?? "00".repeat(32)),
    asBytes32(params.comparabilityHashHex ?? "00".repeat(32)),
    asBytes32(params.renewalOfHashHex ?? "00".repeat(32)),
    encodeU16(params.termsVersion),
    encodeU16(params.mappingVersion),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: policySeries, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildUpdatePolicySeriesTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  seriesRefHashHex: string;
  status: number;
  planMode: number;
  sponsorMode: number;
  displayName: string;
  metadataUri: string;
  termsHashHex: string;
  durationSecs: bigint;
  premiumDueEverySecs: bigint;
  premiumGraceSecs: bigint;
  premiumAmount: bigint;
  interopProfileHashHex?: string;
  oracleProfileHashHex?: string;
  riskFamilyHashHex?: string;
  issuanceTemplateHashHex?: string;
  comparabilityHashHex?: string;
  renewalOfHashHex?: string;
  termsVersion: number;
  mappingVersion: number;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
  });
  const data = concat([
    IX_UPDATE_POLICY_SERIES,
    Uint8Array.from([params.status & 0xff]),
    Uint8Array.from([params.planMode & 0xff]),
    Uint8Array.from([params.sponsorMode & 0xff]),
    encodeString(params.displayName.trim()),
    encodeString(params.metadataUri.trim()),
    asBytes32(params.termsHashHex),
    encodeI64(params.durationSecs),
    encodeI64(params.premiumDueEverySecs),
    encodeI64(params.premiumGraceSecs),
    encodeU64(params.premiumAmount),
    asBytes32(params.interopProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.oracleProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.riskFamilyHashHex ?? "00".repeat(32)),
    asBytes32(params.issuanceTemplateHashHex ?? "00".repeat(32)),
    asBytes32(params.comparabilityHashHex ?? "00".repeat(32)),
    asBytes32(params.renewalOfHashHex ?? "00".repeat(32)),
    encodeU16(params.termsVersion),
    encodeU16(params.mappingVersion),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: policySeries, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildUpsertPolicySeriesPaymentOptionTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  seriesRefHashHex: string;
  paymentMint: PublicKey;
  paymentAmount: bigint;
  active: boolean;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const policySeriesPaymentOption = derivePolicySeriesPaymentOptionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    paymentMint: params.paymentMint,
  });
  const data = concat([
    IX_UPSERT_POLICY_SERIES_PAYMENT_OPTION,
    params.paymentMint.toBytes(),
    encodeU64(params.paymentAmount),
    Uint8Array.from([params.active ? 1 : 0]),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: policySeries, isSigner: false, isWritable: true },
      { pubkey: params.paymentMint, isSigner: false, isWritable: false },
      { pubkey: policySeriesPaymentOption, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSubscribePolicySeriesTx(params: {
  member: PublicKey;
  poolAddress: PublicKey;
  seriesRefHashHex: string;
  startsAtTs: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const policyPosition = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const policyPositionNft = derivePolicyPositionNftPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const data = concat([
    IX_SUBSCRIBE_POLICY_SERIES,
    seriesRefHash,
    encodeI64(params.startsAtTs),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.member, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: membership, isSigner: false, isWritable: false },
      { pubkey: policySeries, isSigner: false, isWritable: false },
      { pubkey: policyPosition, isSigner: false, isWritable: true },
      { pubkey: policyPositionNft, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.member,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildIssuePolicyPositionTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  startsAtTs: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const membership = deriveMembershipPda({
    programId,
    poolAddress: params.poolAddress,
    member: params.member,
  });
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const policyPosition = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const policyPositionNft = derivePolicyPositionNftPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const data = concat([
    IX_ISSUE_POLICY_POSITION,
    params.member.toBytes(),
    seriesRefHash,
    encodeI64(params.startsAtTs),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: membership, isSigner: false, isWritable: false },
      { pubkey: policySeries, isSigner: false, isWritable: false },
      { pubkey: policyPosition, isSigner: false, isWritable: true },
      { pubkey: policyPositionNft, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildMintPolicyNftTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  nftMint: PublicKey;
  metadataUri: string;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const coveragePolicyNft = derivePolicyPositionNftPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const data = concat([
    IX_MINT_POLICY_NFT,
    params.nftMint.toBytes(),
    encodeString(params.metadataUri.trim()),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: coveragePolicy, isSigner: false, isWritable: true },
      { pubkey: coveragePolicyNft, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildPayPremiumSplTx(params: {
  payer: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  paymentMint: PublicKey;
  periodIndex: bigint;
  payerTokenAccount: PublicKey;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const coverageProduct = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const coverageProductPaymentOption = derivePolicySeriesPaymentOptionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    paymentMint: params.paymentMint,
  });
  const premiumLedger = derivePremiumLedgerPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.paymentMint,
  });
  const poolVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: poolAssetVault,
  });
  const data = concat([IX_PAY_PREMIUM_SPL, encodeU64(params.periodIndex)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: coveragePolicy, isSigner: false, isWritable: true },
      { pubkey: params.member, isSigner: false, isWritable: false },
      { pubkey: coverageProduct, isSigner: false, isWritable: false },
      {
        pubkey: coverageProductPaymentOption,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: params.paymentMint, isSigner: false, isWritable: true },
      { pubkey: premiumLedger, isSigner: false, isWritable: true },
      { pubkey: poolAssetVault, isSigner: false, isWritable: true },
      { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.payerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID_KEY,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.payer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildPayPremiumSolTx(params: {
  payer: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  periodIndex: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const coverageProduct = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const coverageProductPaymentOption = derivePolicySeriesPaymentOptionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const premiumLedger = derivePremiumLedgerPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const data = concat([IX_PAY_PREMIUM_SOL, encodeU64(params.periodIndex)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: coveragePolicy, isSigner: false, isWritable: true },
      { pubkey: params.member, isSigner: false, isWritable: false },
      { pubkey: coverageProduct, isSigner: false, isWritable: false },
      {
        pubkey: coverageProductPaymentOption,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: premiumLedger, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.payer,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildAttestPremiumPaidOffchainTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  periodIndex: bigint;
  replayHashHex: string;
  amount: bigint;
  paidAtTs: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const premiumLedger = derivePremiumLedgerPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const replayHash = asBytes32(params.replayHashHex);
  const premiumReplay = derivePremiumReplayPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    replayHash,
  });
  const data = concat([
    IX_ATTEST_PREMIUM_PAID_OFFCHAIN,
    params.member.toBytes(),
    seriesRefHash,
    encodeU64(params.periodIndex),
    replayHash,
    encodeU64(params.amount),
    encodeI64(params.paidAtTs),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: policySeries, isSigner: false, isWritable: false },
      { pubkey: coveragePolicy, isSigner: false, isWritable: true },
      { pubkey: premiumLedger, isSigner: false, isWritable: true },
      { pubkey: premiumReplay, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSubmitCoverageClaimTx(params: {
  claimant: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  eventHashHex: string;
  recentBlockhash: string;
  claimDelegate?: PublicKey;
  includePoolCompliancePolicy?: boolean;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const policySeries = derivePolicySeriesPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
  });
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const poolRiskConfig = derivePoolRiskConfigPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const intentHash = asBytes32(params.intentHashHex);
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    intentHash,
  });
  const data = concat([
    IX_SUBMIT_COVERAGE_CLAIM,
    params.member.toBytes(),
    seriesRefHash,
    intentHash,
    asBytes32(params.eventHashHex),
  ]);
  const keys = [
    { pubkey: params.claimant, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: false },
    { pubkey: policySeries, isSigner: false, isWritable: false },
    { pubkey: coveragePolicy, isSigner: false, isWritable: true },
    { pubkey: poolRiskConfig, isSigner: false, isWritable: true },
    {
      pubkey: params.claimDelegate ?? programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: coverageClaim, isSigner: false, isWritable: true },
    {
      pubkey: params.includePoolCompliancePolicy
        ? derivePoolCompliancePolicyPda({
            programId,
            poolAddress: params.poolAddress,
          })
        : programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.claimant,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildReviewCoverageClaimTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  requestedAmount: bigint;
  evidenceHashHex: string;
  interopRefHashHex: string;
  claimFamily: number;
  interopProfileHashHex?: string;
  codeSystemFamilyHashHex?: string;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const data = concat([
    IX_REVIEW_COVERAGE_CLAIM,
    encodeU64(params.requestedAmount),
    asBytes32(params.evidenceHashHex),
    asBytes32(params.interopRefHashHex),
    Uint8Array.from([params.claimFamily & 0xff]),
    asBytes32(params.interopProfileHashHex ?? "00".repeat(32)),
    asBytes32(params.codeSystemFamilyHashHex ?? "00".repeat(32)),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: coverageClaim, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildAttachCoverageClaimDecisionSupportTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  recentBlockhash: string;
  aiDecisionHashHex?: string;
  aiPolicyHashHex?: string;
  aiExecutionEnvironmentHashHex?: string;
  aiAttestationRefHashHex?: string;
  aiRole?: number;
  automationMode?: number;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const poolAutomationPolicy = derivePoolAutomationPolicyPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const data = concat([
    IX_ATTACH_COVERAGE_CLAIM_DECISION_SUPPORT,
    asBytes32(params.aiDecisionHashHex ?? "00".repeat(32)),
    asBytes32(params.aiPolicyHashHex ?? "00".repeat(32)),
    asBytes32(params.aiExecutionEnvironmentHashHex ?? "00".repeat(32)),
    asBytes32(params.aiAttestationRefHashHex ?? "00".repeat(32)),
    Uint8Array.from([(params.aiRole ?? AI_ROLE_NONE) & 0xff]),
    Uint8Array.from([
      (params.automationMode ?? AUTOMATION_MODE_DISABLED) & 0xff,
    ]),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: coverageClaim, isSigner: false, isWritable: true },
      { pubkey: poolAutomationPolicy, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildApproveCoverageClaimTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  approvedAmount: bigint;
  payoutMint: PublicKey;
  poolAssetVault: PublicKey;
  poolVaultTokenAccount: PublicKey;
  decisionReasonHashHex: string;
  adjudicationRefHashHex?: string;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const data = concat([
    IX_APPROVE_COVERAGE_CLAIM,
    encodeU64(params.approvedAmount),
    asBytes32(params.decisionReasonHashHex),
    asBytes32(params.adjudicationRefHashHex ?? "00".repeat(32)),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: coverageClaim, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: params.poolAssetVault, isSigner: false, isWritable: false },
      {
        pubkey: params.poolVaultTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildDenyCoverageClaimTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  payoutMint: PublicKey;
  decisionReasonHashHex: string;
  adjudicationRefHashHex?: string;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const data = concat([
    IX_DENY_COVERAGE_CLAIM,
    asBytes32(params.decisionReasonHashHex),
    asBytes32(params.adjudicationRefHashHex ?? "00".repeat(32)),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: coverageClaim, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildPayCoverageClaimTx(params: {
  authority: PublicKey;
  claimant: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  payoutAmount: bigint;
  payoutMint: PublicKey;
  recipientSystemAccount: PublicKey;
  poolAssetVault: PublicKey;
  poolVaultTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const data = concat([IX_PAY_COVERAGE_CLAIM, encodeU64(params.payoutAmount)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: coverageClaim, isSigner: false, isWritable: true },
      { pubkey: params.claimant, isSigner: false, isWritable: false },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientSystemAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: params.poolAssetVault, isSigner: false, isWritable: false },
      {
        pubkey: params.poolVaultTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: params.recipientTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildClaimApprovedCoveragePayoutTx(params: {
  claimSigner: PublicKey;
  claimant: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  payoutAmount: bigint;
  payoutMint: PublicKey;
  recipientSystemAccount: PublicKey;
  poolAssetVault: PublicKey;
  poolVaultTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  claimDelegate?: PublicKey;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const claimDelegate = params.claimSigner.equals(params.claimant)
    ? programId
    : (params.claimDelegate ??
      deriveClaimDelegatePda({
        programId,
        poolAddress: params.poolAddress,
        member: params.claimant,
      }));
  const data = concat([
    IX_CLAIM_APPROVED_COVERAGE_PAYOUT,
    encodeU64(params.payoutAmount),
  ]);
  const keys = [
    { pubkey: params.claimSigner, isSigner: true, isWritable: true },
    { pubkey: config, isSigner: false, isWritable: false },
    { pubkey: params.poolAddress, isSigner: false, isWritable: true },
    { pubkey: poolTerms, isSigner: false, isWritable: false },
    { pubkey: coverageClaim, isSigner: false, isWritable: true },
    { pubkey: params.claimant, isSigner: false, isWritable: false },
    { pubkey: claimDelegate, isSigner: false, isWritable: false },
    { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
    {
      pubkey: params.recipientSystemAccount,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: params.poolAssetVault, isSigner: false, isWritable: false },
    { pubkey: params.poolVaultTokenAccount, isSigner: false, isWritable: true },
    { pubkey: params.recipientTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.claimSigner,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildCloseCoverageClaimTx(params: {
  authority: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  payoutMint: PublicKey;
  recoveryAmount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash: asBytes32(params.seriesRefHashHex),
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const data = concat([
    IX_CLOSE_COVERAGE_CLAIM,
    encodeU64(params.recoveryAmount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: coverageClaim, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildSettleCoverageClaimTx(params: {
  oracle: PublicKey;
  claimant: PublicKey;
  poolAddress: PublicKey;
  member: PublicKey;
  seriesRefHashHex: string;
  intentHashHex: string;
  payoutAmount: bigint;
  payoutMint: PublicKey;
  recipientSystemAccount: PublicKey;
  poolAssetVault: PublicKey;
  poolVaultTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTerms = derivePoolTermsPda({
    programId,
    poolAddress: params.poolAddress,
  });
  const seriesRefHash = asBytes32(params.seriesRefHashHex);
  const coveragePolicy = derivePolicyPositionPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
  });
  const coverageClaim = deriveCoverageClaimPda({
    programId,
    poolAddress: params.poolAddress,
    seriesRefHash,
    member: params.member,
    intentHash: asBytes32(params.intentHashHex),
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.payoutMint,
  });
  const data = concat([
    IX_SETTLE_COVERAGE_CLAIM,
    encodeU64(params.payoutAmount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: params.claimant, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: poolTerms, isSigner: false, isWritable: false },
      { pubkey: coverageClaim, isSigner: false, isWritable: true },
      { pubkey: coveragePolicy, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientSystemAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: params.poolAssetVault, isSigner: false, isWritable: false },
      {
        pubkey: params.poolVaultTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: params.recipientTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildWithdrawPoolTreasurySplTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  paymentMint: PublicKey;
  recipientTokenAccount: PublicKey;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: params.paymentMint,
  });
  const poolAssetVault = derivePoolAssetVaultPda({
    programId,
    poolAddress: params.poolAddress,
    payoutMint: params.paymentMint,
  });
  const poolVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: poolAssetVault,
  });
  const data = concat([
    IX_WITHDRAW_POOL_TREASURY_SPL,
    encodeU64(params.amount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: params.paymentMint, isSigner: false, isWritable: true },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      { pubkey: poolAssetVault, isSigner: false, isWritable: false },
      { pubkey: poolVaultTokenAccount, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildWithdrawPoolTreasurySolTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  recipientSystemAccount: PublicKey;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOracle = derivePoolOraclePda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({
    programId,
    poolAddress: params.poolAddress,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const data = concat([
    IX_WITHDRAW_POOL_TREASURY_SOL,
    encodeU64(params.amount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: true },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOracle, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: poolTreasuryReserve, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientSystemAccount,
        isSigner: false,
        isWritable: true,
      },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildWithdrawProtocolFeeSplTx(params: {
  governanceAuthority: PublicKey;
  paymentMint: PublicKey;
  recipientTokenAccount: PublicKey;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const protocolFeeVault = deriveProtocolFeeVaultPda({
    programId,
    paymentMint: params.paymentMint,
  });
  const protocolFeeVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: protocolFeeVault,
  });
  const data = concat([IX_WITHDRAW_PROTOCOL_FEE_SPL, encodeU64(params.amount)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.paymentMint, isSigner: false, isWritable: true },
      { pubkey: protocolFeeVault, isSigner: false, isWritable: true },
      {
        pubkey: protocolFeeVaultTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: params.recipientTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildWithdrawProtocolFeeSolTx(params: {
  governanceAuthority: PublicKey;
  recipientSystemAccount: PublicKey;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const protocolFeeVault = deriveProtocolFeeVaultPda({
    programId,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const data = concat([IX_WITHDRAW_PROTOCOL_FEE_SOL, encodeU64(params.amount)]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.governanceAuthority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: protocolFeeVault, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientSystemAccount,
        isSigner: false,
        isWritable: true,
      },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.governanceAuthority,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildWithdrawPoolOracleFeeSplTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  paymentMint: PublicKey;
  recipientTokenAccount: PublicKey;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOracleFeeVault = derivePoolOracleFeeVaultPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
    paymentMint: params.paymentMint,
  });
  const poolOracleFeeVaultTokenAccount = deriveAssociatedTokenAccount({
    mint: params.paymentMint,
    authority: poolOracleFeeVault,
  });
  const data = concat([
    IX_WITHDRAW_POOL_ORACLE_FEE_SPL,
    encodeU64(params.amount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: params.paymentMint, isSigner: false, isWritable: true },
      { pubkey: poolOracleFeeVault, isSigner: false, isWritable: true },
      {
        pubkey: poolOracleFeeVaultTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: params.recipientTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export function buildWithdrawPoolOracleFeeSolTx(params: {
  oracle: PublicKey;
  poolAddress: PublicKey;
  recipientSystemAccount: PublicKey;
  amount: bigint;
  recentBlockhash: string;
}): Transaction {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);
  const oracleEntry = deriveOraclePda({ programId, oracle: params.oracle });
  const poolOraclePermissions = derivePoolOraclePermissionsPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
  });
  const poolOracleFeeVault = derivePoolOracleFeeVaultPda({
    programId,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
    paymentMint: ZERO_PUBKEY_KEY,
  });
  const data = concat([
    IX_WITHDRAW_POOL_ORACLE_FEE_SOL,
    encodeU64(params.amount),
  ]);
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.oracle, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: params.poolAddress, isSigner: false, isWritable: false },
      { pubkey: oracleEntry, isSigner: false, isWritable: false },
      { pubkey: poolOraclePermissions, isSigner: false, isWritable: false },
      { pubkey: poolOracleFeeVault, isSigner: false, isWritable: true },
      {
        pubkey: params.recipientSystemAccount,
        isSigner: false,
        isWritable: true,
      },
    ],
    data: Buffer.from(data),
  });
  return new Transaction({
    feePayer: params.oracle,
    recentBlockhash: params.recentBlockhash,
  }).add(ix);
}

export type ProtocolReadiness = {
  configInitialized: boolean;
  poolExists: boolean;
  poolTermsConfigured: boolean;
  poolAssetVaultConfigured: boolean;
  oracleRegistered: boolean;
  oracleProfileExists: boolean;
  poolOracleApproved: boolean;
  poolOraclePolicyConfigured: boolean;
  oracleStakePositionExists: boolean;
  inviteIssuerRegistered: boolean;
  memberEnrolled: boolean;
  claimDelegateConfigured: boolean;
  schemaRegistered: boolean;
  ruleRegistered: boolean;
  coveragePolicyExists: boolean;
  coveragePolicyNftExists: boolean;
  premiumLedgerTracked: boolean;
  derived: {
    configAddress: string;
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

async function accountExists(
  connection: Connection,
  address: PublicKey,
): Promise<boolean> {
  return (await connection.getAccountInfo(address, "confirmed")) != null;
}

export async function fetchProtocolReadiness(params: {
  connection: Connection;
  poolAddress?: string | null;
  oracleAddress?: string | null;
  stakerAddress?: string | null;
  inviteIssuerAddress?: string | null;
  memberAddress?: string | null;
  payoutMintAddress?: string | null;
  seriesRefHashHex?: string | null;
  schemaKeyHashHex?: string | null;
  ruleHashHex?: string | null;
}): Promise<ProtocolReadiness> {
  const programId = getProgramId();
  const config = deriveConfigPda(programId);

  const parsedPool = params.poolAddress
    ? new PublicKey(params.poolAddress)
    : null;
  const parsedOracle = params.oracleAddress
    ? new PublicKey(params.oracleAddress)
    : null;
  const parsedStaker = params.stakerAddress
    ? new PublicKey(params.stakerAddress)
    : null;
  const parsedInviteIssuer = params.inviteIssuerAddress
    ? new PublicKey(params.inviteIssuerAddress)
    : null;
  const parsedMember = params.memberAddress
    ? new PublicKey(params.memberAddress)
    : null;
  const parsedPayoutMint = params.payoutMintAddress
    ? new PublicKey(params.payoutMintAddress)
    : null;
  const seriesRefHash = params.seriesRefHashHex
    ? asBytes32(params.seriesRefHashHex)
    : null;
  const schemaKeyHash = params.schemaKeyHashHex
    ? asBytes32(params.schemaKeyHashHex)
    : null;
  const ruleHash = params.ruleHashHex ? asBytes32(params.ruleHashHex) : null;

  const configInitialized = await accountExists(params.connection, config);
  const poolExists = parsedPool
    ? await accountExists(params.connection, parsedPool)
    : false;

  const poolTerms = parsedPool
    ? derivePoolTermsPda({ programId, poolAddress: parsedPool })
    : null;
  const poolTermsInfo = poolTerms
    ? await params.connection.getAccountInfo(poolTerms, "confirmed")
    : null;
  const poolTermsConfigured = Boolean(poolTermsInfo);

  let effectivePayoutMint: PublicKey | null = parsedPayoutMint;
  if (poolTermsInfo?.data && poolTerms) {
    try {
      const decoded = decodePoolTerms(poolTerms.toBase58(), poolTermsInfo.data);
      effectivePayoutMint = new PublicKey(decoded.payoutAssetMint);
    } catch {
      // Keep caller-provided payout mint fallback if pool terms decode fails.
    }
  }

  let poolAssetVault: PublicKey | null = null;
  let poolAssetVaultConfigured = false;
  if (parsedPool && effectivePayoutMint) {
    if (effectivePayoutMint.toBase58() === ZERO_PUBKEY) {
      poolAssetVaultConfigured = true;
    } else {
      poolAssetVault = derivePoolAssetVaultPda({
        programId,
        poolAddress: parsedPool,
        payoutMint: effectivePayoutMint,
      });
      poolAssetVaultConfigured = await accountExists(
        params.connection,
        poolAssetVault,
      );
    }
  }

  const oracleEntry = parsedOracle
    ? deriveOraclePda({ programId, oracle: parsedOracle })
    : null;
  const oracleRegistered = oracleEntry
    ? await accountExists(params.connection, oracleEntry)
    : false;
  const oracleProfile = parsedOracle
    ? deriveOracleProfilePda({ programId, oracle: parsedOracle })
    : null;
  const oracleProfileExists = oracleProfile
    ? await accountExists(params.connection, oracleProfile)
    : false;

  const poolOracle =
    parsedPool && parsedOracle
      ? derivePoolOraclePda({
          programId,
          poolAddress: parsedPool,
          oracle: parsedOracle,
        })
      : null;
  const poolOracleApproved = poolOracle
    ? await accountExists(params.connection, poolOracle)
    : false;

  const poolOraclePolicy = parsedPool
    ? derivePoolOraclePolicyPda({ programId, poolAddress: parsedPool })
    : null;
  const poolOraclePolicyConfigured = poolOraclePolicy
    ? await accountExists(params.connection, poolOraclePolicy)
    : false;

  const oracleStakePosition =
    parsedOracle && parsedStaker
      ? deriveOracleStakePda({
          programId,
          oracle: parsedOracle,
          staker: parsedStaker,
        })
      : null;
  const oracleStakePositionExists = oracleStakePosition
    ? await accountExists(params.connection, oracleStakePosition)
    : false;

  const inviteIssuer = parsedInviteIssuer
    ? deriveInviteIssuerPda({ programId, issuer: parsedInviteIssuer })
    : null;
  const inviteIssuerRegistered = inviteIssuer
    ? await accountExists(params.connection, inviteIssuer)
    : false;

  const membership =
    parsedPool && parsedMember
      ? deriveMembershipPda({
          programId,
          poolAddress: parsedPool,
          member: parsedMember,
        })
      : null;
  const memberEnrolled = membership
    ? await accountExists(params.connection, membership)
    : false;

  const claimDelegate =
    parsedPool && parsedMember
      ? deriveClaimDelegatePda({
          programId,
          poolAddress: parsedPool,
          member: parsedMember,
        })
      : null;
  const claimDelegateConfigured = claimDelegate
    ? await accountExists(params.connection, claimDelegate)
    : false;

  const schema = schemaKeyHash
    ? deriveSchemaPda({ programId, schemaKeyHash })
    : null;
  const schemaRegistered = schema
    ? await accountExists(params.connection, schema)
    : false;

  const rule =
    parsedPool && seriesRefHash && ruleHash
      ? derivePoolRulePda({
          programId,
          poolAddress: parsedPool,
          seriesRefHash,
          ruleHash,
        })
      : null;
  const ruleRegistered = rule
    ? await accountExists(params.connection, rule)
    : false;

  const coveragePolicy =
    parsedPool && seriesRefHash && parsedMember
      ? derivePolicyPositionPda({
          programId,
          poolAddress: parsedPool,
          seriesRefHash,
          member: parsedMember,
        })
      : null;
  const coveragePolicyExists = coveragePolicy
    ? await accountExists(params.connection, coveragePolicy)
    : false;

  const coverageNft =
    parsedPool && seriesRefHash && parsedMember
      ? derivePolicyPositionNftPda({
          programId,
          poolAddress: parsedPool,
          seriesRefHash,
          member: parsedMember,
        })
      : null;
  const coveragePolicyNftExists = coverageNft
    ? await accountExists(params.connection, coverageNft)
    : false;

  const premiumLedger =
    parsedPool && seriesRefHash && parsedMember
      ? derivePremiumLedgerPda({
          programId,
          poolAddress: parsedPool,
          seriesRefHash,
          member: parsedMember,
        })
      : null;
  const premiumLedgerTracked = premiumLedger
    ? await accountExists(params.connection, premiumLedger)
    : false;

  return {
    configInitialized,
    poolExists,
    poolTermsConfigured,
    poolAssetVaultConfigured,
    oracleRegistered,
    oracleProfileExists,
    poolOracleApproved,
    poolOraclePolicyConfigured,
    oracleStakePositionExists,
    inviteIssuerRegistered,
    memberEnrolled,
    claimDelegateConfigured,
    schemaRegistered,
    ruleRegistered,
    coveragePolicyExists,
    coveragePolicyNftExists,
    premiumLedgerTracked,
    derived: {
      configAddress: config.toBase58(),
      poolAddress: parsedPool?.toBase58() ?? null,
      poolTermsAddress: poolTerms?.toBase58() ?? null,
      poolAssetVaultAddress: poolAssetVault?.toBase58() ?? null,
      oracleEntryAddress: oracleEntry?.toBase58() ?? null,
      oracleProfileAddress: oracleProfile?.toBase58() ?? null,
      poolOracleAddress: poolOracle?.toBase58() ?? null,
      poolOraclePolicyAddress: poolOraclePolicy?.toBase58() ?? null,
      oracleStakeAddress: oracleStakePosition?.toBase58() ?? null,
      inviteIssuerAddress: inviteIssuer?.toBase58() ?? null,
      membershipAddress: membership?.toBase58() ?? null,
      claimDelegateAddress: claimDelegate?.toBase58() ?? null,
      schemaAddress: schema?.toBase58() ?? null,
      ruleAddress: rule?.toBase58() ?? null,
      coveragePolicyAddress: coveragePolicy?.toBase58() ?? null,
      coverageNftAddress: coverageNft?.toBase58() ?? null,
      premiumLedgerAddress: premiumLedger?.toBase58() ?? null,
    },
  };
}

const DISCOVERY_CACHE_TTL_MS = 20_000;
const discoveryCache = new Map<string, { expiresAt: number; value: unknown }>();

export type PoolSummary = {
  address: string;
  authority: string;
  poolId: string;
  organizationRef: string;
  payoutLamportsPerPass: bigint;
  membershipMode: number;
  tokenGateMint: string;
  tokenGateMinBalance: bigint;
  inviteIssuer: string;
  status: number;
  bump: number;
};

export type OracleSummary = {
  address: string;
  oracle: string;
  active: boolean;
  bump: number;
  metadataUri: string;
};

export type OracleProfileSummary = {
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
  claimed: boolean;
  createdAtTs: bigint;
  updatedAtTs: bigint;
  bump: number;
};

export type OracleWithProfileSummary = OracleSummary & {
  profile?: OracleProfileSummary;
};

export type PoolOracleApprovalSummary = {
  address: string;
  pool: string;
  oracle: string;
  active: boolean;
  bump: number;
};

export type PoolOraclePolicySummary = {
  address: string;
  pool: string;
  quorumM: number;
  quorumN: number;
  requireVerifiedSchema: boolean;
  oracleFeeBps: number;
  allowDelegateClaim: boolean;
  challengeWindowSecs: bigint;
  bump: number;
};

export type PoolTermsSummary = {
  address: string;
  pool: string;
  poolType: number;
  payoutAssetMint: string;
  termsHashHex: string;
  payoutPolicyHashHex: string;
  cycleMode: number;
  metadataUri: string;
  bump: number;
};

export type PoolAssetVaultSummary = {
  address: string;
  pool: string;
  payoutMint: string;
  vaultTokenAccount: string;
  active: boolean;
  bump: number;
};

export type PoolLiquidityConfigSummary = {
  address: string;
  pool: string;
  payoutMint: string;
  shareMint: string;
  depositsEnabled: boolean;
  bump: number;
};

export type PoolRiskConfigSummary = {
  address: string;
  pool: string;
  redemptionMode: number;
  claimMode: number;
  impaired: boolean;
  updatedBy: string;
  updatedAt: bigint;
  bump: number;
};

export type PoolCapitalClassSummary = {
  address: string;
  pool: string;
  shareMint: string;
  payoutMint: string;
  classIdHashHex: string;
  seriesRefHashHex: string;
  complianceProfileHashHex: string;
  classMode: number;
  classPriority: number;
  transferMode: number;
  restricted: boolean;
  redemptionQueueEnabled: boolean;
  ringFenced: boolean;
  lockupSecs: bigint;
  redemptionNoticeSecs: bigint;
  vintageIndex: number;
  issuedAt: bigint;
  updatedAt: bigint;
  bump: number;
};

export type PolicySeriesSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  status: number;
  displayName: string;
  metadataUri: string;
  termsHashHex: string;
  durationSecs: bigint;
  premiumDueEverySecs: bigint;
  premiumGraceSecs: bigint;
  premiumAmount: bigint;
  interopProfileHashHex: string;
  oracleProfileHashHex: string;
  riskFamilyHashHex: string;
  issuanceTemplateHashHex: string;
  comparabilityHashHex: string;
  renewalOfHashHex: string;
  planMode: number;
  sponsorMode: number;
  termsVersion: number;
  mappingVersion: number;
  createdAtTs: bigint;
  updatedAtTs: bigint;
  bump: number;
};

export type PoolCompliancePolicySummary = {
  address: string;
  pool: string;
  providerRefHashHex: string;
  credentialTypeHashHex: string;
  revocationListHashHex: string;
  actionsMask: number;
  bindingMode: number;
  providerMode: number;
  capitalRailMode: number;
  payoutRailMode: number;
  active: boolean;
  updatedBy: string;
  updatedAt: bigint;
  bump: number;
};

export type PoolControlAuthoritySummary = {
  address: string;
  pool: string;
  operatorAuthority: string;
  riskManagerAuthority: string;
  complianceAuthority: string;
  guardianAuthority: string;
  updatedAt: bigint;
  bump: number;
};

export type PoolAutomationPolicySummary = {
  address: string;
  pool: string;
  oracleAutomationMode: number;
  claimAutomationMode: number;
  allowedAiRolesMask: number;
  maxAutoClaimAmount: bigint;
  requiredAttestationProviderRefHashHex: string;
  updatedBy: string;
  updatedAt: bigint;
  bump: number;
};

export type ProtocolConfigSummary = {
  address: string;
  admin: string;
  governanceAuthority: string;
  governanceRealm: string;
  governanceConfig: string;
  defaultStakeMint: string;
  protocolFeeBps: number;
  minOracleStake: bigint;
  emergencyPaused: boolean;
  allowedPayoutMintsHashHex: string;
  bump: number;
};

export type OracleStakePositionSummary = {
  address: string;
  oracle: string;
  staker: string;
  stakeMint: string;
  stakeVault: string;
  stakedAmount: bigint;
  pendingUnstakeAmount: bigint;
  canFinalizeUnstakeAt: bigint;
  slashPending: boolean;
  bump: number;
};

export type PoolOraclePermissionSetSummary = {
  address: string;
  pool: string;
  oracle: string;
  permissions: number;
  bump: number;
};

export type PolicySeriesPaymentOptionSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  paymentMint: string;
  paymentAmount: bigint;
  active: boolean;
  bump: number;
};

export type PolicyPositionSummary = {
  address: string;
  pool: string;
  member: string;
  seriesRefHashHex: string;
  termsHashHex: string;
  status: number;
  startsAt: bigint;
  endsAt: bigint;
  premiumDueEverySecs: bigint;
  premiumGraceSecs: bigint;
  nextDueAt: bigint;
  nftMint: string;
  bump: number;
};

export type PolicyPositionNftSummary = {
  address: string;
  pool: string;
  member: string;
  seriesRefHashHex: string;
  nftMint: string;
  metadataUri: string;
  bump: number;
};

export type ClaimDelegateAuthorizationSummary = {
  address: string;
  pool: string;
  member: string;
  delegate: string;
  active: boolean;
  updatedAt: bigint;
  bump: number;
};

export type PremiumLedgerSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  member: string;
  periodIndex: bigint;
  amount: bigint;
  source: number;
  paidAt: bigint;
  bump: number;
};

export type PoolCapitalMetricsSummary = {
  transitionalSharePath: boolean;
  pool: string | null;
  shareMint: string | null;
  payoutMint: string | null;
  classIdHashHex: string | null;
  seriesRefHashHex: string | null;
  complianceProfileHashHex: string | null;
  classMode: number;
  classPriority: number | null;
  transferMode: number;
  restricted: boolean;
  redemptionQueueEnabled: boolean;
  ringFenced: boolean;
  vintageIndex: number | null;
  redemptionMode: number;
  claimMode: number;
  impaired: boolean;
  reservesRaw: bigint;
  encumberedCapitalRaw: bigint;
  freeCapitalRaw: bigint;
  availableRedemptionRaw: bigint;
  distributionLockedRaw: bigint;
  referenceNavScaled: bigint;
  utilizationBps: number;
};

export type CapitalClassIntegrationPolicySummary = {
  marketParticipationMode:
    | "transitional"
    | "direct"
    | "restricted"
    | "wrapper-mediated";
  directSecondaryTransfersAllowed: boolean;
  wrapperRequired: boolean;
  restrictionSurvivesTransfer: boolean;
  credentialBound: boolean;
  authoritativeValuationSource: "reference_nav";
  marketPriceAuthoritative: false;
  collateralEligible: false;
  externalYieldAuthoritative: false;
};

export type PoolTreasuryReserveSummary = {
  address: string;
  pool: string;
  paymentMint: string;
  reservedRefundAmount: bigint;
  reservedRewardAmount: bigint;
  reservedRedistributionAmount: bigint;
  manualCoverageReserveAmount: bigint;
  reservedCoverageClaimAmount: bigint;
  paidCoverageClaimAmount: bigint;
  recoveredCoverageClaimAmount: bigint;
  impairedAmount: bigint;
  lastLiabilityUpdateTs: bigint;
  bump: number;
};

export type MemberCycleStateSummary = {
  address: string;
  pool: string;
  member: string;
  seriesRefHashHex: string;
  periodIndex: bigint;
  paymentMint: string;
  premiumAmountRaw: bigint;
  bondAmountRaw: bigint;
  shieldFeeRaw: bigint;
  protocolFeeRaw: bigint;
  oracleFeeRaw: bigint;
  netPoolPremiumRaw: bigint;
  totalAmountRaw: bigint;
  canonicalPremiumAmount: bigint;
  commitmentEnabled: boolean;
  thresholdBps: number;
  outcomeThresholdScore: number;
  cohortHashHex: string;
  settledHealthAlphaScore: number;
  includedShieldCount: number;
  shieldConsumed: boolean;
  status: number;
  passed: boolean;
  activatedAt: bigint;
  settledAt: bigint;
  quoteHashHex: string;
  bump: number;
};

export type CohortSettlementRootSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  paymentMint: string;
  cohortHashHex: string;
  outcomeThresholdScore: number;
  successfulMemberCount: number;
  successfulHealthAlphaScoreSum: bigint;
  redistributableFailedBondsTotal: bigint;
  redistributionClaimedAmount: bigint;
  successfulClaimCount: number;
  finalized: boolean;
  zeroSuccessReleased: boolean;
  finalizedAt: bigint;
  bump: number;
};

export type ProtocolFeeVaultSummary = {
  address: string;
  paymentMint: string;
  bump: number;
};

export type PoolOracleFeeVaultSummary = {
  address: string;
  pool: string;
  oracle: string;
  paymentMint: string;
  bump: number;
};

export type SchemaSummary = {
  address: string;
  schemaKeyHashHex: string;
  schemaKey: string;
  version: number;
  schemaHashHex: string;
  publisher: string;
  verified: boolean;
  schemaFamily: number;
  visibility: number;
  interopProfileHashHex: string;
  codeSystemFamilyHashHex: string;
  mappingVersion: number;
  metadataUri: string;
  bump: number;
};

export type RuleSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  ruleHashHex: string;
  schemaKeyHashHex: string;
  ruleId: string;
  schemaKey: string;
  schemaVersion: number;
  interopProfileHashHex: string;
  codeSystemFamilyHashHex: string;
  mappingVersion: number;
  payoutHashHex: string;
  enabled: boolean;
  bump: number;
};

export type MembershipSummary = {
  address: string;
  pool: string;
  member: string;
  subjectCommitmentHex: string;
  status: number;
  enrolledAt: bigint;
  updatedAt: bigint;
  bump: number;
};

export type InviteIssuerSummary = {
  address: string;
  issuer: string;
  organizationRef: string;
  metadataUri: string;
  active: boolean;
  bump: number;
};

export type AttestationVoteSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  member: string;
  cycleHashHex: string;
  ruleHashHex: string;
  oracle: string;
  passed: boolean;
  attestationDigestHex: string;
  observedValueHashHex: string;
  evidenceHashHex: string;
  externalAttestationRefHashHex: string;
  aiRole: number;
  automationMode: number;
  modelVersionHashHex: string;
  policyVersionHashHex: string;
  executionEnvironmentHashHex: string;
  attestationProviderRefHashHex: string;
  asOfTs: bigint;
  bump: number;
};

export type OutcomeAggregateSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  member: string;
  cycleHashHex: string;
  ruleHashHex: string;
  passVotes: number;
  failVotes: number;
  quorumM: number;
  quorumN: number;
  finalized: boolean;
  passed: boolean;
  claimed: boolean;
  rewardLiabilityReserved: boolean;
  evidenceHashHex: string;
  externalAttestationRefHashHex: string;
  reviewStatus: number;
  challengeWindowEndsAt: bigint;
  disputeReasonHashHex: string;
  disputedBy: string;
  resolvedBy: string;
  resolvedAt: bigint;
  aiRole: number;
  automationMode: number;
  modelVersionHashHex: string;
  policyVersionHashHex: string;
  executionEnvironmentHashHex: string;
  attestationProviderRefHashHex: string;
  latestAsOfTs: bigint;
  bump: number;
};

export type CoverageClaimSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  member: string;
  claimant: string;
  intentHashHex: string;
  eventHashHex: string;
  evidenceHashHex: string;
  interopRefHashHex: string;
  interopProfileHashHex: string;
  codeSystemFamilyHashHex: string;
  decisionReasonHashHex: string;
  adjudicationRefHashHex: string;
  status: number;
  claimFamily: number;
  appealCount: number;
  requestedAmount: bigint;
  approvedAmount: bigint;
  paidAmount: bigint;
  reservedAmount: bigint;
  recoveryAmount: bigint;
  aiDecisionHashHex: string;
  aiPolicyHashHex: string;
  aiExecutionEnvironmentHashHex: string;
  aiAttestationRefHashHex: string;
  aiAutomationMode: number;
  submittedAt: bigint;
  reviewedAt: bigint;
  settledAt: bigint;
  closedAt: bigint;
  bump: number;
};

export type PoolRedemptionRequestSummary = {
  address: string;
  pool: string;
  redeemer: string;
  shareMint: string;
  payoutMint: string;
  requestHashHex: string;
  shareEscrow: string;
  status: number;
  sharesRequested: bigint;
  minAmountOut: bigint;
  expectedAmountOut: bigint;
  noticeMaturesAt: bigint;
  requestedAt: bigint;
  scheduledAt: bigint;
  fulfilledAt: bigint;
  cancelledAt: bigint;
  failedAt: bigint;
  failureCode: number;
  bump: number;
};

export type RewardClaimSummary = {
  address: string;
  pool: string;
  seriesRefHashHex: string;
  member: string;
  claimant: string;
  cycleHashHex: string;
  ruleHashHex: string;
  intentHashHex: string;
  payoutMint: string;
  payoutAmount: bigint;
  recipient: string;
  submittedAt: bigint;
  bump: number;
};

export type SchemaDependencyLedgerSummary = {
  address: string;
  schemaKeyHashHex: string;
  activeRuleRefcount: number;
  bump: number;
};

export type PoolWithPolicySeriesSummary = PoolSummary & {
  policySeries: PolicySeriesSummary[];
  policySeriesCount: number;
  activePolicySeriesCount: number;
};

export type WalletPoolPositionSummary = {
  owner: string;
  pool: string | null;
  memberAddress: string | null;
  memberPositionActive: boolean;
  capitalPositionActive: boolean;
  transitionalSharePath: boolean;
  classMode: number;
  transferMode: number;
  restricted: boolean;
  redemptionMode: number;
  claimMode: number;
  shareBalanceRaw: bigint;
  capitalExposureRaw: bigint;
  currentlyRedeemableRaw: bigint;
  pendingRedemptionRequestCount: number;
  scheduledRedemptionRequestCount: number;
  pendingRedemptionSharesRaw: bigint;
  pendingRedemptionExpectedRaw: bigint;
  pendingCoverageClaimCount: number;
  pendingCoverageExposureRaw: bigint;
  pendingRewardClaimCount: number;
  pendingRewardPayoutRaw: bigint;
};

export function buildPoolCapitalMetrics(params: {
  capitalClass?: PoolCapitalClassSummary | null;
  riskConfig?: PoolRiskConfigSummary | null;
  treasuryReserve?: PoolTreasuryReserveSummary | null;
  reservesRaw: bigint;
  shareSupplyRaw: bigint;
}): PoolCapitalMetricsSummary {
  const encumberedCapitalRaw = params.treasuryReserve
    ? computePoolEncumberedCapital({
        reservedRefundAmount: params.treasuryReserve.reservedRefundAmount,
        reservedRewardAmount: params.treasuryReserve.reservedRewardAmount,
        reservedRedistributionAmount:
          params.treasuryReserve.reservedRedistributionAmount,
        manualCoverageReserveAmount:
          params.treasuryReserve.manualCoverageReserveAmount,
        reservedCoverageClaimAmount:
          params.treasuryReserve.reservedCoverageClaimAmount,
        impairedAmount: params.treasuryReserve.impairedAmount,
      })
    : 0n;
  const freeCapitalRaw = computePoolFreeCapital({
    reservesBefore: params.reservesRaw,
    encumberedCapital: encumberedCapitalRaw,
  });
  const classMode = params.capitalClass?.classMode ?? CAPITAL_CLASS_MODE_NAV;
  const redemptionQueueEnabled =
    params.capitalClass?.redemptionQueueEnabled ?? false;
  const redemptionMode =
    params.riskConfig?.redemptionMode ?? POOL_REDEMPTION_MODE_OPEN;
  const queueOnly =
    redemptionQueueEnabled ||
    redemptionMode === POOL_REDEMPTION_MODE_QUEUE_ONLY;
  const availableRedemptionRaw =
    queueOnly || redemptionMode === POOL_REDEMPTION_MODE_PAUSED
      ? 0n
      : freeCapitalRaw;
  const distributionLockedRaw =
    classMode === CAPITAL_CLASS_MODE_DISTRIBUTION ||
    classMode === CAPITAL_CLASS_MODE_HYBRID
      ? (params.treasuryReserve?.reservedRedistributionAmount ?? 0n)
      : 0n;
  return {
    transitionalSharePath: !params.capitalClass,
    pool:
      params.capitalClass?.pool ??
      params.riskConfig?.pool ??
      params.treasuryReserve?.pool ??
      null,
    shareMint: params.capitalClass?.shareMint ?? null,
    payoutMint:
      params.capitalClass?.payoutMint ??
      params.treasuryReserve?.paymentMint ??
      null,
    classIdHashHex: params.capitalClass?.classIdHashHex ?? null,
    seriesRefHashHex: params.capitalClass?.seriesRefHashHex ?? null,
    complianceProfileHashHex:
      params.capitalClass?.complianceProfileHashHex ?? null,
    classMode,
    classPriority: params.capitalClass?.classPriority ?? null,
    transferMode:
      params.capitalClass?.transferMode ?? CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
    restricted: params.capitalClass?.restricted ?? false,
    redemptionQueueEnabled,
    ringFenced: params.capitalClass?.ringFenced ?? false,
    vintageIndex: params.capitalClass?.vintageIndex ?? null,
    redemptionMode,
    claimMode: params.riskConfig?.claimMode ?? POOL_CLAIM_MODE_OPEN,
    impaired:
      (params.riskConfig?.impaired ?? false) ||
      (params.treasuryReserve?.impairedAmount ?? 0n) > 0n,
    reservesRaw: params.reservesRaw,
    encumberedCapitalRaw,
    freeCapitalRaw,
    availableRedemptionRaw,
    distributionLockedRaw,
    referenceNavScaled: computePoolReferenceNavScaled({
      freeCapital: freeCapitalRaw,
      shareSupply: params.shareSupplyRaw,
    }),
    utilizationBps: computePoolCapitalUtilizationBps({
      reservesBefore: params.reservesRaw,
      encumberedCapital: encumberedCapitalRaw,
    }),
  };
}

function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function coverageClaimOutstandingAmount(claim: CoverageClaimSummary): bigint {
  if (
    claim.status === COVERAGE_CLAIM_STATUS_DENIED ||
    claim.status === COVERAGE_CLAIM_STATUS_CLOSED ||
    claim.status === COVERAGE_CLAIM_STATUS_PAID
  ) {
    return 0n;
  }
  if (
    claim.status === COVERAGE_CLAIM_STATUS_SUBMITTED ||
    claim.status === COVERAGE_CLAIM_STATUS_UNDER_REVIEW
  ) {
    return claim.requestedAmount;
  }
  const unpaidApproved =
    claim.approvedAmount > claim.paidAmount
      ? claim.approvedAmount - claim.paidAmount
      : 0n;
  return maxBigInt(claim.reservedAmount, unpaidApproved);
}

export function buildWalletPoolPositionSummary(params: {
  ownerAddress: string;
  membership?: MembershipSummary | null;
  capitalMetrics: PoolCapitalMetricsSummary;
  shareBalanceRaw: bigint;
  shareSupplyRaw: bigint;
  redemptionRequests?: PoolRedemptionRequestSummary[];
  coverageClaims?: CoverageClaimSummary[];
  rewardClaims?: RewardClaimSummary[];
}): WalletPoolPositionSummary {
  const redemptionRequests = params.redemptionRequests ?? [];
  const coverageClaims = params.coverageClaims ?? [];
  const rewardClaims = params.rewardClaims ?? [];
  const capitalExposureRaw =
    params.shareSupplyRaw > 0n
      ? (params.shareBalanceRaw * params.capitalMetrics.freeCapitalRaw) /
        params.shareSupplyRaw
      : 0n;
  const currentlyRedeemableRaw =
    params.shareSupplyRaw > 0n
      ? (params.shareBalanceRaw *
          params.capitalMetrics.availableRedemptionRaw) /
        params.shareSupplyRaw
      : 0n;

  return {
    owner: params.ownerAddress,
    pool:
      params.capitalMetrics.pool ??
      params.membership?.pool ??
      coverageClaims[0]?.pool ??
      rewardClaims[0]?.pool ??
      null,
    memberAddress:
      params.membership?.member ??
      coverageClaims[0]?.member ??
      rewardClaims[0]?.member ??
      null,
    memberPositionActive:
      params.membership?.status === MEMBERSHIP_STATUS_ACTIVE,
    capitalPositionActive: params.shareBalanceRaw > 0n,
    transitionalSharePath: params.capitalMetrics.transitionalSharePath,
    classMode: params.capitalMetrics.classMode,
    transferMode: params.capitalMetrics.transferMode,
    restricted: params.capitalMetrics.restricted,
    redemptionMode: params.capitalMetrics.redemptionMode,
    claimMode: params.capitalMetrics.claimMode,
    shareBalanceRaw: params.shareBalanceRaw,
    capitalExposureRaw,
    currentlyRedeemableRaw,
    pendingRedemptionRequestCount: redemptionRequests.filter(
      (request) =>
        request.status === REDEMPTION_REQUEST_STATUS_PENDING ||
        request.status === REDEMPTION_REQUEST_STATUS_SCHEDULED,
    ).length,
    scheduledRedemptionRequestCount: redemptionRequests.filter(
      (request) => request.status === REDEMPTION_REQUEST_STATUS_SCHEDULED,
    ).length,
    pendingRedemptionSharesRaw: redemptionRequests.reduce(
      (sum, request) =>
        request.status === REDEMPTION_REQUEST_STATUS_PENDING ||
        request.status === REDEMPTION_REQUEST_STATUS_SCHEDULED
          ? sum + request.sharesRequested
          : sum,
      0n,
    ),
    pendingRedemptionExpectedRaw: redemptionRequests.reduce(
      (sum, request) =>
        request.status === REDEMPTION_REQUEST_STATUS_PENDING ||
        request.status === REDEMPTION_REQUEST_STATUS_SCHEDULED
          ? sum + request.expectedAmountOut
          : sum,
      0n,
    ),
    pendingCoverageClaimCount: coverageClaims.filter(
      (claim) => coverageClaimOutstandingAmount(claim) > 0n,
    ).length,
    pendingCoverageExposureRaw: coverageClaims.reduce(
      (sum, claim) => sum + coverageClaimOutstandingAmount(claim),
      0n,
    ),
    pendingRewardClaimCount: rewardClaims.length,
    pendingRewardPayoutRaw: rewardClaims.reduce(
      (sum, claim) => sum + claim.payoutAmount,
      0n,
    ),
  };
}

export function buildCapitalClassIntegrationPolicy(params: {
  capitalMetrics: PoolCapitalMetricsSummary;
}): CapitalClassIntegrationPolicySummary {
  if (params.capitalMetrics.transitionalSharePath) {
    return {
      marketParticipationMode: "transitional",
      directSecondaryTransfersAllowed: false,
      wrapperRequired: false,
      restrictionSurvivesTransfer: false,
      credentialBound: false,
      authoritativeValuationSource: "reference_nav",
      marketPriceAuthoritative: false,
      collateralEligible: false,
      externalYieldAuthoritative: false,
    };
  }

  if (
    params.capitalMetrics.transferMode === CAPITAL_TRANSFER_MODE_WRAPPER_ONLY
  ) {
    return {
      marketParticipationMode: "wrapper-mediated",
      directSecondaryTransfersAllowed: false,
      wrapperRequired: true,
      restrictionSurvivesTransfer: true,
      credentialBound: true,
      authoritativeValuationSource: "reference_nav",
      marketPriceAuthoritative: false,
      collateralEligible: false,
      externalYieldAuthoritative: false,
    };
  }

  if (
    params.capitalMetrics.transferMode === CAPITAL_TRANSFER_MODE_RESTRICTED ||
    params.capitalMetrics.restricted
  ) {
    return {
      marketParticipationMode: "restricted",
      directSecondaryTransfersAllowed: false,
      wrapperRequired: false,
      restrictionSurvivesTransfer: true,
      credentialBound: true,
      authoritativeValuationSource: "reference_nav",
      marketPriceAuthoritative: false,
      collateralEligible: false,
      externalYieldAuthoritative: false,
    };
  }

  return {
    marketParticipationMode: "direct",
    directSecondaryTransfersAllowed: true,
    wrapperRequired: false,
    restrictionSurvivesTransfer: false,
    credentialBound: false,
    authoritativeValuationSource: "reference_nav",
    marketPriceAuthoritative: false,
    collateralEligible: false,
    externalYieldAuthoritative: false,
  };
}

export type TokenAccountSummary = {
  address: string;
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
  uiAmountString: string;
};

class AccountDecoder {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  private ensure(size: number): void {
    if (this.offset + size > this.bytes.length) {
      throw new Error(
        `Account decode overflow at offset ${this.offset} for size ${size}`,
      );
    }
  }

  readBytes(size: number): Uint8Array {
    this.ensure(size);
    const out = this.bytes.slice(this.offset, this.offset + size);
    this.offset += size;
    return out;
  }

  readU8(): number {
    return this.readBytes(1)[0] ?? 0;
  }

  readBool(): boolean {
    return this.readU8() !== 0;
  }

  readU16(): number {
    this.ensure(2);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      2,
    ).getUint16(0, true);
    this.offset += 2;
    return value;
  }

  readU32(): number {
    this.ensure(4);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      4,
    ).getUint32(0, true);
    this.offset += 4;
    return value;
  }

  readU64(): bigint {
    this.ensure(8);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      8,
    ).getBigUint64(0, true);
    this.offset += 8;
    return value;
  }

  readI64(): bigint {
    this.ensure(8);
    const value = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      8,
    ).getBigInt64(0, true);
    this.offset += 8;
    return value;
  }

  readPubkey(): string {
    return new PublicKey(this.readBytes(32)).toBase58();
  }

  readString(): string {
    const len = this.readU32();
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }

  remaining(): number {
    return this.bytes.length - this.offset;
  }
}

function bytesToHex(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

function encodeBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }

  let encoded = "";
  while (value > 0n) {
    const mod = Number(value % 58n);
    encoded = alphabet[mod] + encoded;
    value /= 58n;
  }

  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeros += 1;
  }
  return `${"1".repeat(leadingZeros)}${encoded || ""}`;
}

function discoveryCacheKey(
  connection: Connection,
  namespace: string,
  options: Record<string, string | number | boolean | null | undefined>,
): string {
  const endpoint =
    (connection as Connection & { rpcEndpoint?: string }).rpcEndpoint ?? "rpc";
  const programId = getProgramId().toBase58();
  const sorted = Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${String(v ?? "")}`)
    .join("|");
  return `${endpoint}|${programId}|${namespace}|${sorted}`;
}

async function withDiscoveryCache<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = discoveryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }
  const value = await loader();
  discoveryCache.set(key, { expiresAt: now + DISCOVERY_CACHE_TTL_MS, value });
  return value;
}

function normalizeSearch(search?: string | null): string {
  return (search ?? "").trim().toLowerCase();
}

function includesSearch(
  fields: Array<string | null | undefined>,
  search?: string | null,
): boolean {
  const normalized = normalizeSearch(search);
  if (!normalized) return true;
  return fields.some((field) =>
    (field ?? "").toLowerCase().includes(normalized),
  );
}

function accountDiscriminator(accountName: string): Uint8Array {
  const discriminator = PROTOCOL_ACCOUNT_DISCRIMINATORS[accountName];
  if (!discriminator) {
    throw new Error(`Missing account discriminator for ${accountName}`);
  }
  return discriminator;
}

function asPubkey(value: string): PublicKey {
  return new PublicKey(value.trim());
}

async function fetchProgramAccounts(
  connection: Connection,
  accountName: string,
  filters: GetProgramAccountsFilter[] = [],
) {
  const discriminator = accountDiscriminator(accountName);
  return connection.getProgramAccounts(getProgramId(), {
    commitment: "confirmed",
    filters: [
      { memcmp: { offset: 0, bytes: encodeBase58(discriminator) } },
      ...filters,
    ],
  });
}

function decodeProtocolConfig(
  address: string,
  data: Uint8Array,
): ProtocolConfigSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    admin: d.readPubkey(),
    governanceAuthority: d.readPubkey(),
    governanceRealm: d.readPubkey(),
    governanceConfig: d.readPubkey(),
    defaultStakeMint: d.readPubkey(),
    protocolFeeBps: d.readU16(),
    minOracleStake: d.readU64(),
    emergencyPaused: d.readBool(),
    allowedPayoutMintsHashHex: bytesToHex(d.readBytes(32)),
    bump: d.readU8(),
  };
}

function decodePool(address: string, data: Uint8Array): PoolSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8); // discriminator
  return {
    address,
    authority: d.readPubkey(),
    poolId: d.readString(),
    organizationRef: d.readString(),
    payoutLamportsPerPass: d.readU64(),
    membershipMode: d.readU8(),
    tokenGateMint: d.readPubkey(),
    tokenGateMinBalance: d.readU64(),
    inviteIssuer: d.readPubkey(),
    status: d.readU8(),
    bump: d.readU8(),
  };
}

function decodeOracle(address: string, data: Uint8Array): OracleSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    oracle: d.readPubkey(),
    active: d.readBool(),
    bump: d.readU8(),
    metadataUri: d.readString(),
  };
}

function decodeOracleProfile(
  address: string,
  data: Uint8Array,
): OracleProfileSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  const oracle = d.readPubkey();
  const admin = d.readPubkey();
  const oracleType = d.readU8();
  const displayName = d.readString();
  const legalName = d.readString();
  const websiteUrl = d.readString();
  const appUrl = d.readString();
  const logoUri = d.readString();
  const webhookUrl = d.readString();
  const supportedSchemaCount = d.readU8();
  const supportedSchemaKeyHashesHex = Array.from({
    length: MAX_ORACLE_SUPPORTED_SCHEMAS,
  })
    .map(() => bytesToHex(d.readBytes(32)))
    .slice(0, supportedSchemaCount);
  return {
    address,
    oracle,
    admin,
    oracleType,
    displayName,
    legalName,
    websiteUrl,
    appUrl,
    logoUri,
    webhookUrl,
    supportedSchemaCount,
    supportedSchemaKeyHashesHex,
    claimed: d.readBool(),
    createdAtTs: d.readI64(),
    updatedAtTs: d.readI64(),
    bump: d.readU8(),
  };
}

function decodeOracleStakePosition(
  address: string,
  data: Uint8Array,
): OracleStakePositionSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    oracle: d.readPubkey(),
    staker: d.readPubkey(),
    stakeMint: d.readPubkey(),
    stakeVault: d.readPubkey(),
    stakedAmount: d.readU64(),
    pendingUnstakeAmount: d.readU64(),
    canFinalizeUnstakeAt: d.readI64(),
    slashPending: d.readBool(),
    bump: d.readU8(),
  };
}

function decodePoolOracleApproval(
  address: string,
  data: Uint8Array,
): PoolOracleApprovalSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    oracle: d.readPubkey(),
    active: d.readBool(),
    bump: d.readU8(),
  };
}

function decodePoolOraclePolicy(
  address: string,
  data: Uint8Array,
): PoolOraclePolicySummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  const pool = d.readPubkey();
  const quorumM = d.readU8();
  const quorumN = d.readU8();
  const requireVerifiedSchema = d.readBool();
  const hasExpandedPolicyFields = d.remaining() >= 12;
  const oracleFeeBps = hasExpandedPolicyFields ? d.readU16() : 0;
  const allowDelegateClaim = d.readBool();
  const challengeWindowSecs = hasExpandedPolicyFields ? d.readI64() : 0n;
  const bump = d.readU8();
  return {
    address,
    pool,
    quorumM,
    quorumN,
    requireVerifiedSchema,
    oracleFeeBps,
    allowDelegateClaim,
    challengeWindowSecs,
    bump,
  };
}

function decodePoolOraclePermissionSet(
  address: string,
  data: Uint8Array,
): PoolOraclePermissionSetSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    oracle: d.readPubkey(),
    permissions: d.readU32(),
    bump: d.readU8(),
  };
}

function decodePoolTerms(address: string, data: Uint8Array): PoolTermsSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    poolType: d.readU8(),
    payoutAssetMint: d.readPubkey(),
    termsHashHex: bytesToHex(d.readBytes(32)),
    payoutPolicyHashHex: bytesToHex(d.readBytes(32)),
    cycleMode: d.readU8(),
    metadataUri: d.readString(),
    bump: d.readU8(),
  };
}

function decodePoolAssetVault(
  address: string,
  data: Uint8Array,
): PoolAssetVaultSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    payoutMint: d.readPubkey(),
    vaultTokenAccount: d.readPubkey(),
    active: d.readBool(),
    bump: d.readU8(),
  };
}

function decodePoolLiquidityConfig(
  address: string,
  data: Uint8Array,
): PoolLiquidityConfigSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    payoutMint: d.readPubkey(),
    shareMint: d.readPubkey(),
    depositsEnabled: d.readBool(),
    bump: d.readU8(),
  };
}

function decodePoolRiskConfig(
  address: string,
  data: Uint8Array,
): PoolRiskConfigSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    redemptionMode: d.readU8(),
    claimMode: d.readU8(),
    impaired: d.readBool(),
    updatedBy: d.readPubkey(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodePoolCapitalClass(
  address: string,
  data: Uint8Array,
): PoolCapitalClassSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    shareMint: d.readPubkey(),
    payoutMint: d.readPubkey(),
    classIdHashHex: bytesToHex(d.readBytes(32)),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    complianceProfileHashHex: bytesToHex(d.readBytes(32)),
    classMode: d.readU8(),
    classPriority: d.readU8(),
    transferMode: d.readU8(),
    restricted: d.readBool(),
    redemptionQueueEnabled: d.readBool(),
    ringFenced: d.readBool(),
    lockupSecs: d.readI64(),
    redemptionNoticeSecs: d.readI64(),
    vintageIndex: d.readU16(),
    issuedAt: d.readI64(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodePolicySeriesPaymentOption(
  address: string,
  data: Uint8Array,
): PolicySeriesPaymentOptionSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    paymentMint: d.readPubkey(),
    paymentAmount: d.readU64(),
    active: d.readBool(),
    bump: d.readU8(),
  };
}

function decodePolicySeries(
  address: string,
  data: Uint8Array,
): PolicySeriesSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    status: d.readU8(),
    planMode: d.readU8(),
    sponsorMode: d.readU8(),
    displayName: d.readString(),
    metadataUri: d.readString(),
    termsHashHex: bytesToHex(d.readBytes(32)),
    durationSecs: d.readI64(),
    premiumDueEverySecs: d.readI64(),
    premiumGraceSecs: d.readI64(),
    premiumAmount: d.readU64(),
    interopProfileHashHex: bytesToHex(d.readBytes(32)),
    oracleProfileHashHex: bytesToHex(d.readBytes(32)),
    riskFamilyHashHex: bytesToHex(d.readBytes(32)),
    issuanceTemplateHashHex: bytesToHex(d.readBytes(32)),
    comparabilityHashHex: bytesToHex(d.readBytes(32)),
    renewalOfHashHex: bytesToHex(d.readBytes(32)),
    termsVersion: d.readU16(),
    mappingVersion: d.readU16(),
    createdAtTs: d.readI64(),
    updatedAtTs: d.readI64(),
    bump: d.readU8(),
  };
}

function decodePolicyPosition(
  address: string,
  data: Uint8Array,
): PolicyPositionSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    member: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    termsHashHex: bytesToHex(d.readBytes(32)),
    status: d.readU8(),
    startsAt: d.readI64(),
    endsAt: d.readI64(),
    premiumDueEverySecs: d.readI64(),
    premiumGraceSecs: d.readI64(),
    nextDueAt: d.readI64(),
    nftMint: d.readPubkey(),
    bump: d.readU8(),
  };
}

function decodePolicyPositionNft(
  address: string,
  data: Uint8Array,
): PolicyPositionNftSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    member: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    nftMint: d.readPubkey(),
    metadataUri: d.readString(),
    bump: d.readU8(),
  };
}

function decodePoolCompliancePolicy(
  address: string,
  data: Uint8Array,
): PoolCompliancePolicySummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    providerRefHashHex: bytesToHex(d.readBytes(32)),
    credentialTypeHashHex: bytesToHex(d.readBytes(32)),
    revocationListHashHex: bytesToHex(d.readBytes(32)),
    actionsMask: d.readU16(),
    bindingMode: d.readU8(),
    providerMode: d.readU8(),
    capitalRailMode: d.readU8(),
    payoutRailMode: d.readU8(),
    active: d.readBool(),
    updatedBy: d.readPubkey(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodePoolControlAuthority(
  address: string,
  data: Uint8Array,
): PoolControlAuthoritySummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    operatorAuthority: d.readPubkey(),
    riskManagerAuthority: d.readPubkey(),
    complianceAuthority: d.readPubkey(),
    guardianAuthority: d.readPubkey(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodePoolAutomationPolicy(
  address: string,
  data: Uint8Array,
): PoolAutomationPolicySummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    oracleAutomationMode: d.readU8(),
    claimAutomationMode: d.readU8(),
    allowedAiRolesMask: d.readU16(),
    maxAutoClaimAmount: d.readU64(),
    requiredAttestationProviderRefHashHex: bytesToHex(d.readBytes(32)),
    updatedBy: d.readPubkey(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodeProtocolFeeVault(
  address: string,
  data: Uint8Array,
): ProtocolFeeVaultSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    paymentMint: d.readPubkey(),
    bump: d.readU8(),
  };
}

function decodePoolOracleFeeVault(
  address: string,
  data: Uint8Array,
): PoolOracleFeeVaultSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    oracle: d.readPubkey(),
    paymentMint: d.readPubkey(),
    bump: d.readU8(),
  };
}

function decodePoolTreasuryReserve(
  address: string,
  data: Uint8Array,
): PoolTreasuryReserveSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  const pool = d.readPubkey();
  const paymentMint = d.readPubkey();
  const reservedRefundAmount = d.readU64();
  const reservedRewardAmount = d.readU64();
  const reservedRedistributionAmount = d.readU64();
  const manualCoverageReserveAmount = d.readU64();
  const reservedCoverageClaimAmount = d.remaining() >= 8 ? d.readU64() : 0n;
  const paidCoverageClaimAmount = d.remaining() >= 8 ? d.readU64() : 0n;
  const recoveredCoverageClaimAmount = d.remaining() >= 8 ? d.readU64() : 0n;
  const impairedAmount = d.remaining() >= 8 ? d.readU64() : 0n;
  const lastLiabilityUpdateTs = d.remaining() >= 8 ? d.readI64() : 0n;
  const bump = d.remaining() >= 1 ? d.readU8() : 0;
  return {
    address,
    pool,
    paymentMint,
    reservedRefundAmount,
    reservedRewardAmount,
    reservedRedistributionAmount,
    manualCoverageReserveAmount,
    reservedCoverageClaimAmount,
    paidCoverageClaimAmount,
    recoveredCoverageClaimAmount,
    impairedAmount,
    lastLiabilityUpdateTs,
    bump,
  };
}

function decodeMemberCycleState(
  address: string,
  data: Uint8Array,
): MemberCycleStateSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    member: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    periodIndex: d.readU64(),
    paymentMint: d.readPubkey(),
    premiumAmountRaw: d.readU64(),
    bondAmountRaw: d.readU64(),
    shieldFeeRaw: d.readU64(),
    protocolFeeRaw: d.readU64(),
    oracleFeeRaw: d.readU64(),
    netPoolPremiumRaw: d.readU64(),
    totalAmountRaw: d.readU64(),
    canonicalPremiumAmount: d.readU64(),
    commitmentEnabled: d.readBool(),
    thresholdBps: d.readU16(),
    outcomeThresholdScore: d.readU16(),
    cohortHashHex: bytesToHex(d.readBytes(32)),
    settledHealthAlphaScore: d.readU16(),
    includedShieldCount: d.readU8(),
    shieldConsumed: d.readBool(),
    status: d.readU8(),
    passed: d.readBool(),
    activatedAt: d.readI64(),
    settledAt: d.readI64(),
    quoteHashHex: bytesToHex(d.readBytes(32)),
    bump: d.readU8(),
  };
}

function decodeCohortSettlementRoot(
  address: string,
  data: Uint8Array,
): CohortSettlementRootSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    paymentMint: d.readPubkey(),
    cohortHashHex: bytesToHex(d.readBytes(32)),
    outcomeThresholdScore: d.readU16(),
    successfulMemberCount: d.readU32(),
    successfulHealthAlphaScoreSum: d.readU64(),
    redistributableFailedBondsTotal: d.readU64(),
    redistributionClaimedAmount: d.readU64(),
    successfulClaimCount: d.readU32(),
    finalized: d.readBool(),
    zeroSuccessReleased: d.readBool(),
    finalizedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodeSchema(address: string, data: Uint8Array): SchemaSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    schemaKeyHashHex: bytesToHex(d.readBytes(32)),
    schemaKey: d.readString(),
    version: d.readU16(),
    schemaHashHex: bytesToHex(d.readBytes(32)),
    publisher: d.readPubkey(),
    verified: d.readBool(),
    schemaFamily: d.readU8(),
    visibility: d.readU8(),
    interopProfileHashHex: bytesToHex(d.readBytes(32)),
    codeSystemFamilyHashHex: bytesToHex(d.readBytes(32)),
    mappingVersion: d.readU16(),
    metadataUri: d.readString(),
    bump: d.readU8(),
  };
}

function decodeRule(address: string, data: Uint8Array): RuleSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  const pool = d.readPubkey();
  const seriesRefHashHex = bytesToHex(d.readBytes(32));
  const ruleHashHex = bytesToHex(d.readBytes(32));
  const schemaKeyHashHex = bytesToHex(d.readBytes(32));
  const ruleId = d.readString();
  const schemaKey = d.readString();
  const schemaVersion = d.readU16();
  const hasExpandedRuleFields = d.remaining() > 34;
  const interopProfileHashHex = hasExpandedRuleFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const codeSystemFamilyHashHex = hasExpandedRuleFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const mappingVersion = hasExpandedRuleFields ? d.readU16() : 0;
  const payoutHashHex = bytesToHex(d.readBytes(32));
  const enabled = d.readBool();
  const bump = d.readU8();
  return {
    address,
    pool,
    seriesRefHashHex,
    ruleHashHex,
    schemaKeyHashHex,
    ruleId,
    schemaKey,
    schemaVersion,
    interopProfileHashHex,
    codeSystemFamilyHashHex,
    mappingVersion,
    payoutHashHex,
    enabled,
    bump,
  };
}

function decodeMembership(
  address: string,
  data: Uint8Array,
): MembershipSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    member: d.readPubkey(),
    subjectCommitmentHex: bytesToHex(d.readBytes(32)),
    status: d.readU8(),
    enrolledAt: d.readI64(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodeClaimDelegateAuthorization(
  address: string,
  data: Uint8Array,
): ClaimDelegateAuthorizationSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    member: d.readPubkey(),
    delegate: d.readPubkey(),
    active: d.readBool(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodeInviteIssuer(
  address: string,
  data: Uint8Array,
): InviteIssuerSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    issuer: d.readPubkey(),
    organizationRef: d.readString(),
    metadataUri: d.readString(),
    active: d.readBool(),
    bump: d.readU8(),
  };
}

function decodePremiumLedger(
  address: string,
  data: Uint8Array,
): PremiumLedgerSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    member: d.readPubkey(),
    periodIndex: d.readU64(),
    amount: d.readU64(),
    source: d.readU8(),
    paidAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodeAttestationVote(
  address: string,
  data: Uint8Array,
): AttestationVoteSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  const pool = d.readPubkey();
  const seriesRefHashHex = bytesToHex(d.readBytes(32));
  const member = d.readPubkey();
  const cycleHashHex = bytesToHex(d.readBytes(32));
  const ruleHashHex = bytesToHex(d.readBytes(32));
  const oracle = d.readPubkey();
  const passed = d.readBool();
  const attestationDigestHex = bytesToHex(d.readBytes(32));
  const observedValueHashHex = bytesToHex(d.readBytes(32));
  const evidenceHashHex =
    d.remaining() >= 32 ? bytesToHex(d.readBytes(32)) : "00".repeat(32);
  const externalAttestationRefHashHex =
    d.remaining() >= 32 ? bytesToHex(d.readBytes(32)) : "00".repeat(32);
  const hasAiFields = d.remaining() > 9;
  const aiRole = hasAiFields ? d.readU8() : AI_ROLE_NONE;
  const automationMode = hasAiFields ? d.readU8() : AUTOMATION_MODE_DISABLED;
  const modelVersionHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const policyVersionHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const executionEnvironmentHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const attestationProviderRefHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const asOfTs = d.remaining() >= 8 ? d.readI64() : 0n;
  const bump = d.remaining() >= 1 ? d.readU8() : 0;
  return {
    address,
    pool,
    seriesRefHashHex,
    member,
    cycleHashHex,
    ruleHashHex,
    oracle,
    passed,
    attestationDigestHex,
    observedValueHashHex,
    evidenceHashHex,
    externalAttestationRefHashHex,
    aiRole,
    automationMode,
    modelVersionHashHex,
    policyVersionHashHex,
    executionEnvironmentHashHex,
    attestationProviderRefHashHex,
    asOfTs,
    bump,
  };
}

function decodeOutcomeAggregate(
  address: string,
  data: Uint8Array,
): OutcomeAggregateSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  const pool = d.readPubkey();
  const seriesRefHashHex = bytesToHex(d.readBytes(32));
  const member = d.readPubkey();
  const cycleHashHex = bytesToHex(d.readBytes(32));
  const ruleHashHex = bytesToHex(d.readBytes(32));
  const passVotes = d.readU16();
  const failVotes = d.readU16();
  const quorumM = d.readU8();
  const quorumN = d.readU8();
  const finalized = d.readBool();
  const passed = d.readBool();
  const claimed = d.readBool();
  const rewardLiabilityReserved = d.readBool();
  const evidenceHashHex =
    d.remaining() >= 32 ? bytesToHex(d.readBytes(32)) : "00".repeat(32);
  const externalAttestationRefHashHex =
    d.remaining() >= 32 ? bytesToHex(d.readBytes(32)) : "00".repeat(32);
  const hasReviewAndAiFields = d.remaining() > 9;
  const reviewStatus = hasReviewAndAiFields
    ? d.readU8()
    : OUTCOME_REVIEW_STATUS_CLEAR;
  const challengeWindowEndsAt = hasReviewAndAiFields ? d.readI64() : 0n;
  const disputeReasonHashHex = hasReviewAndAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const disputedBy = hasReviewAndAiFields ? d.readPubkey() : ZERO_PUBKEY;
  const resolvedBy = hasReviewAndAiFields ? d.readPubkey() : ZERO_PUBKEY;
  const resolvedAt = hasReviewAndAiFields ? d.readI64() : 0n;
  const aiRole = hasReviewAndAiFields ? d.readU8() : AI_ROLE_NONE;
  const automationMode = hasReviewAndAiFields
    ? d.readU8()
    : AUTOMATION_MODE_DISABLED;
  const modelVersionHashHex = hasReviewAndAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const policyVersionHashHex = hasReviewAndAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const executionEnvironmentHashHex = hasReviewAndAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const attestationProviderRefHashHex = hasReviewAndAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const latestAsOfTs = d.remaining() >= 8 ? d.readI64() : 0n;
  const bump = d.remaining() >= 1 ? d.readU8() : 0;
  return {
    address,
    pool,
    seriesRefHashHex,
    member,
    cycleHashHex,
    ruleHashHex,
    passVotes,
    failVotes,
    quorumM,
    quorumN,
    finalized,
    passed,
    claimed,
    rewardLiabilityReserved,
    evidenceHashHex,
    externalAttestationRefHashHex,
    reviewStatus,
    challengeWindowEndsAt,
    disputeReasonHashHex,
    disputedBy,
    resolvedBy,
    resolvedAt,
    aiRole,
    automationMode,
    modelVersionHashHex,
    policyVersionHashHex,
    executionEnvironmentHashHex,
    attestationProviderRefHashHex,
    latestAsOfTs,
    bump,
  };
}

function decodeCoverageClaim(
  address: string,
  data: Uint8Array,
): CoverageClaimSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  const pool = d.readPubkey();
  const seriesRefHashHex = bytesToHex(d.readBytes(32));
  const member = d.readPubkey();
  const claimant = d.readPubkey();
  const intentHashHex = bytesToHex(d.readBytes(32));
  const eventHashHex = bytesToHex(d.readBytes(32));
  const evidenceHashHex = bytesToHex(d.readBytes(32));
  const interopRefHashHex = bytesToHex(d.readBytes(32));
  const hasExpandedCaseFields = d.remaining() >= 205;
  const interopProfileHashHex = hasExpandedCaseFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const codeSystemFamilyHashHex = hasExpandedCaseFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const decisionReasonHashHex = bytesToHex(d.readBytes(32));
  const adjudicationRefHashHex = hasExpandedCaseFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const status = d.readU8();
  const claimFamily = hasExpandedCaseFields
    ? d.readU8()
    : COVERAGE_CLAIM_FAMILY_FAST;
  const appealCount = hasExpandedCaseFields ? d.readU16() : 0;
  const requestedAmount = d.readU64();
  const approvedAmount = d.readU64();
  const paidAmount = d.readU64();
  const reservedAmount = d.readU64();
  const recoveryAmount = hasExpandedCaseFields ? d.readU64() : 0n;
  const hasAiFields = d.remaining() > 33;
  const aiDecisionHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const aiPolicyHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const aiExecutionEnvironmentHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const aiAttestationRefHashHex = hasAiFields
    ? bytesToHex(d.readBytes(32))
    : "00".repeat(32);
  const aiAutomationMode = hasAiFields ? d.readU8() : AUTOMATION_MODE_DISABLED;
  const submittedAt = d.readI64();
  const reviewedAt = d.readI64();
  const settledAt = d.readI64();
  const closedAt = d.readI64();
  const bump = d.readU8();
  return {
    address,
    pool,
    seriesRefHashHex,
    member,
    claimant,
    intentHashHex,
    eventHashHex,
    evidenceHashHex,
    interopRefHashHex,
    interopProfileHashHex,
    codeSystemFamilyHashHex,
    decisionReasonHashHex,
    adjudicationRefHashHex,
    status,
    claimFamily,
    appealCount,
    requestedAmount,
    approvedAmount,
    paidAmount,
    reservedAmount,
    recoveryAmount,
    aiDecisionHashHex,
    aiPolicyHashHex,
    aiExecutionEnvironmentHashHex,
    aiAttestationRefHashHex,
    aiAutomationMode,
    submittedAt,
    reviewedAt,
    settledAt,
    closedAt,
    bump,
  };
}

function decodeRedemptionRequest(
  address: string,
  data: Uint8Array,
): PoolRedemptionRequestSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    redeemer: d.readPubkey(),
    shareMint: d.readPubkey(),
    payoutMint: d.readPubkey(),
    requestHashHex: bytesToHex(d.readBytes(32)),
    shareEscrow: d.readPubkey(),
    status: d.readU8(),
    sharesRequested: d.readU64(),
    minAmountOut: d.readU64(),
    expectedAmountOut: d.readU64(),
    noticeMaturesAt: d.readI64(),
    requestedAt: d.readI64(),
    scheduledAt: d.readI64(),
    fulfilledAt: d.readI64(),
    cancelledAt: d.readI64(),
    failedAt: d.readI64(),
    failureCode: d.readU16(),
    bump: d.readU8(),
  };
}

function decodeRewardClaim(
  address: string,
  data: Uint8Array,
): RewardClaimSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    pool: d.readPubkey(),
    seriesRefHashHex: bytesToHex(d.readBytes(32)),
    member: d.readPubkey(),
    claimant: d.readPubkey(),
    cycleHashHex: bytesToHex(d.readBytes(32)),
    ruleHashHex: bytesToHex(d.readBytes(32)),
    intentHashHex: bytesToHex(d.readBytes(32)),
    payoutMint: d.readPubkey(),
    payoutAmount: d.readU64(),
    recipient: d.readPubkey(),
    submittedAt: d.readI64(),
    bump: d.readU8(),
  };
}

function decodeSchemaDependencyLedger(
  address: string,
  data: Uint8Array,
): SchemaDependencyLedgerSummary {
  const d = new AccountDecoder(data);
  d.readBytes(8);
  return {
    address,
    schemaKeyHashHex: bytesToHex(d.readBytes(32)),
    activeRuleRefcount: d.readU32(),
    bump: d.readU8(),
  };
}

function parseAccounts<T>(
  accounts: Awaited<ReturnType<typeof fetchProgramAccounts>>,
  decoder: (address: string, data: Uint8Array) => T,
): T[] {
  const out: T[] = [];
  for (const account of accounts) {
    try {
      out.push(decoder(account.pubkey.toBase58(), account.account.data));
    } catch {
      // Skip malformed accounts to keep selectors resilient to stale/nonconforming data.
    }
  }
  return out;
}

export function clearProtocolDiscoveryCache(): void {
  discoveryCache.clear();
}

export async function listProtocolConfig(params: {
  connection: Connection;
}): Promise<ProtocolConfigSummary[]> {
  const cacheKey = discoveryCacheKey(params.connection, "protocol-config", {});
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "ProtocolConfig",
    );
    return parseAccounts(accounts, decodeProtocolConfig).sort((a, b) =>
      a.address.localeCompare(b.address),
    );
  });
}

export async function fetchProtocolConfig(params: {
  connection: Connection;
}): Promise<ProtocolConfigSummary | null> {
  const rows = await listProtocolConfig(params);
  return rows[0] ?? null;
}

export async function listPools(params: {
  connection: Connection;
  authority?: string | null;
  search?: string | null;
}): Promise<PoolSummary[]> {
  const authority = params.authority?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "pools", {
    authority,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (authority) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(authority).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "Pool",
      filters,
    );
    const rows = parseAccounts(accounts, decodePool)
      .filter((row) =>
        includesSearch(
          [row.poolId, row.organizationRef, row.address, row.authority],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.poolId.localeCompare(b.poolId) ||
          a.address.localeCompare(b.address),
      );
    return rows;
  });
}

export async function listOracleStakePositions(params: {
  connection: Connection;
  oracleAddress?: string | null;
  stakerAddress?: string | null;
  search?: string | null;
}): Promise<OracleStakePositionSummary[]> {
  const oracleAddress = params.oracleAddress?.trim() || null;
  const stakerAddress = params.stakerAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "oracle-stake-positions",
    {
      oracleAddress,
      stakerAddress,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "OracleStakePosition",
    );
    return parseAccounts(accounts, decodeOracleStakePosition)
      .filter((row) => (oracleAddress ? row.oracle === oracleAddress : true))
      .filter((row) => (stakerAddress ? row.staker === stakerAddress : true))
      .filter((row) =>
        includesSearch(
          [row.oracle, row.staker, row.stakeMint, row.address],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.oracle.localeCompare(b.oracle) || a.staker.localeCompare(b.staker),
      );
  });
}

export async function listPoolTerms(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
}): Promise<PoolTermsSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "pool-terms", {
    poolAddress,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolTerms",
      filters,
    );
    return parseAccounts(accounts, decodePoolTerms)
      .filter((row) =>
        includesSearch([row.pool, row.metadataUri, row.address], params.search),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolAssetVaults(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
}): Promise<PoolAssetVaultSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "pool-asset-vaults", {
    poolAddress,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolAssetVault",
      filters,
    );
    return parseAccounts(accounts, decodePoolAssetVault)
      .filter((row) =>
        includesSearch(
          [row.pool, row.payoutMint, row.vaultTokenAccount, row.address],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolLiquidityConfigs(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
}): Promise<PoolLiquidityConfigSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-liquidity-configs",
    {
      poolAddress,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolLiquidityConfig",
      filters,
    );
    return parseAccounts(accounts, decodePoolLiquidityConfig)
      .filter((row) =>
        includesSearch(
          [row.pool, row.payoutMint, row.shareMint, row.address],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolRiskConfigs(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
}): Promise<PoolRiskConfigSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "pool-risk-configs", {
    poolAddress,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolRiskConfig",
      filters,
    );
    return parseAccounts(accounts, decodePoolRiskConfig)
      .filter((row) =>
        includesSearch([row.pool, row.updatedBy, row.address], params.search),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolCapitalClasses(params: {
  connection: Connection;
  poolAddress?: string | null;
  shareMint?: string | null;
  search?: string | null;
}): Promise<PoolCapitalClassSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const shareMint = params.shareMint?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-capital-classes",
    {
      poolAddress,
      shareMint,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (shareMint) {
      filters.push({
        memcmp: { offset: 40, bytes: asPubkey(shareMint).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolCapitalClass",
      filters,
    );
    return parseAccounts(accounts, decodePoolCapitalClass)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.shareMint,
            row.payoutMint,
            row.classIdHashHex,
            row.complianceProfileHashHex,
            row.address,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) ||
          a.classIdHashHex.localeCompare(b.classIdHashHex),
      );
  });
}

export async function listPolicySeriesPaymentOptions(params: {
  connection: Connection;
  poolAddress?: string | null;
  seriesRefHashHex?: string | null;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<PolicySeriesPaymentOptionSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const seriesRefHashHex =
    params.seriesRefHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "policy-series-payment-options",
    {
      poolAddress,
      seriesRefHashHex,
      activeOnly: Boolean(params.activeOnly),
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PolicySeriesPaymentOption",
    );
    return parseAccounts(accounts, decodePolicySeriesPaymentOption)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) =>
        seriesRefHashHex ? row.seriesRefHashHex === seriesRefHashHex : true,
      )
      .filter((row) => (params.activeOnly ? row.active : true))
      .filter((row) =>
        includesSearch(
          [row.pool, row.paymentMint, row.seriesRefHashHex, row.address],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) ||
          a.seriesRefHashHex.localeCompare(b.seriesRefHashHex),
      );
  });
}

export async function listPolicySeries(params: {
  connection: Connection;
  poolAddress?: string | null;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<PolicySeriesSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "policy-series", {
    poolAddress,
    activeOnly: Boolean(params.activeOnly),
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PolicySeries",
      filters,
    );
    return parseAccounts(accounts, decodePolicySeries)
      .filter((row) =>
        params.activeOnly ? row.status === POLICY_SERIES_STATUS_ACTIVE : true,
      )
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.seriesRefHashHex,
            row.displayName,
            row.metadataUri,
            row.comparabilityHashHex,
            row.address,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          Number(a.status !== POLICY_SERIES_STATUS_ACTIVE) -
            Number(b.status !== POLICY_SERIES_STATUS_ACTIVE) ||
          a.displayName.localeCompare(b.displayName) ||
          a.seriesRefHashHex.localeCompare(b.seriesRefHashHex),
      );
  });
}

export async function listPolicyPositions(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  seriesRefHashHex?: string | null;
  search?: string | null;
}): Promise<PolicyPositionSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const seriesRefHashHex =
    params.seriesRefHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(params.connection, "policy-positions", {
    poolAddress,
    memberAddress,
    seriesRefHashHex,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PolicyPosition",
    );
    return parseAccounts(accounts, decodePolicyPosition)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) => (memberAddress ? row.member === memberAddress : true))
      .filter((row) =>
        seriesRefHashHex ? row.seriesRefHashHex === seriesRefHashHex : true,
      )
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.member,
            row.seriesRefHashHex,
            row.nftMint,
            row.address,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.member.localeCompare(b.member) ||
          a.seriesRefHashHex.localeCompare(b.seriesRefHashHex),
      );
  });
}

export async function listPolicyPositionNfts(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  seriesRefHashHex?: string | null;
  search?: string | null;
}): Promise<PolicyPositionNftSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const seriesRefHashHex =
    params.seriesRefHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "policy-position-nfts",
    {
      poolAddress,
      memberAddress,
      seriesRefHashHex,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PolicyPositionNft",
    );
    return parseAccounts(accounts, decodePolicyPositionNft)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) => (memberAddress ? row.member === memberAddress : true))
      .filter((row) =>
        seriesRefHashHex ? row.seriesRefHashHex === seriesRefHashHex : true,
      )
      .filter((row) =>
        includesSearch(
          [row.pool, row.member, row.nftMint, row.metadataUri, row.address],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.member.localeCompare(b.member) ||
          a.seriesRefHashHex.localeCompare(b.seriesRefHashHex),
      );
  });
}

export async function listPoolCompliancePolicies(params: {
  connection: Connection;
  poolAddress?: string | null;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<PoolCompliancePolicySummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-compliance-policies",
    {
      poolAddress,
      activeOnly: Boolean(params.activeOnly),
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolCompliancePolicy",
      filters,
    );
    return parseAccounts(accounts, decodePoolCompliancePolicy)
      .filter((row) => (params.activeOnly ? row.active : true))
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.providerRefHashHex,
            row.credentialTypeHashHex,
            row.updatedBy,
            row.address,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolControlAuthorities(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
}): Promise<PoolControlAuthoritySummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-control-authorities",
    {
      poolAddress,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolControlAuthority",
      filters,
    );
    return parseAccounts(accounts, decodePoolControlAuthority)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.operatorAuthority,
            row.riskManagerAuthority,
            row.complianceAuthority,
            row.guardianAuthority,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolAutomationPolicies(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
}): Promise<PoolAutomationPolicySummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-automation-policies",
    {
      poolAddress,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolAutomationPolicy",
      filters,
    );
    return parseAccounts(accounts, decodePoolAutomationPolicy)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.requiredAttestationProviderRefHashHex,
            row.updatedBy,
            row.address,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolTreasuryReserves(params: {
  connection: Connection;
  poolAddress?: string | null;
  paymentMint?: string | null;
  search?: string | null;
}): Promise<PoolTreasuryReserveSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const paymentMint = params.paymentMint?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-treasury-reserves",
    {
      poolAddress,
      paymentMint,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (paymentMint) {
      filters.push({
        memcmp: { offset: 40, bytes: asPubkey(paymentMint).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolTreasuryReserve",
      filters,
    );
    return parseAccounts(accounts, decodePoolTreasuryReserve)
      .filter((row) =>
        includesSearch([row.pool, row.paymentMint, row.address], params.search),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.address.localeCompare(b.address),
      );
  });
}

export async function listOracles(params: {
  connection: Connection;
  search?: string | null;
  activeOnly?: boolean;
}): Promise<OracleSummary[]> {
  const cacheKey = discoveryCacheKey(params.connection, "oracles", {
    search: params.search ?? null,
    activeOnly: Boolean(params.activeOnly),
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "OracleRegistryEntry",
    );
    return parseAccounts(accounts, decodeOracle)
      .filter((row) => (params.activeOnly ? row.active : true))
      .filter((row) =>
        includesSearch(
          [row.oracle, row.metadataUri, row.address],
          params.search,
        ),
      )
      .sort((a, b) => a.oracle.localeCompare(b.oracle));
  });
}

export async function listOracleProfiles(params: {
  connection: Connection;
  search?: string | null;
  claimedOnly?: boolean;
}): Promise<OracleProfileSummary[]> {
  const cacheKey = discoveryCacheKey(params.connection, "oracle-profiles", {
    search: params.search ?? null,
    claimedOnly: Boolean(params.claimedOnly),
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "OracleProfile",
    );
    return parseAccounts(accounts, decodeOracleProfile)
      .filter((row) => (params.claimedOnly ? row.claimed : true))
      .filter((row) =>
        includesSearch(
          [
            row.oracle,
            row.admin,
            row.displayName,
            row.legalName,
            row.websiteUrl,
            row.appUrl,
            row.address,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.displayName.localeCompare(b.displayName) ||
          a.oracle.localeCompare(b.oracle),
      );
  });
}

export async function listOraclesWithProfiles(params: {
  connection: Connection;
  search?: string | null;
  activeOnly?: boolean;
  claimedOnly?: boolean;
}): Promise<OracleWithProfileSummary[]> {
  const [oracles, profiles] = await Promise.all([
    listOracles({
      connection: params.connection,
      search: params.search ?? null,
      activeOnly: params.activeOnly,
    }),
    listOracleProfiles({
      connection: params.connection,
      search: params.search ?? null,
      claimedOnly: params.claimedOnly,
    }),
  ]);

  const profileByOracle = new Map<string, OracleProfileSummary>();
  for (const profile of profiles) {
    profileByOracle.set(profile.oracle, profile);
  }

  const rows = oracles.map((oracle) => ({
    ...oracle,
    profile: profileByOracle.get(oracle.oracle),
  }));
  if (!params.claimedOnly) {
    return rows;
  }
  return rows.filter((row) => row.profile?.claimed);
}

export async function listPoolOracleApprovals(params: {
  connection: Connection;
  poolAddress?: string | null;
  oracleAddress?: string | null;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<PoolOracleApprovalSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const oracleAddress = params.oracleAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-oracle-approvals",
    {
      poolAddress,
      oracleAddress,
      activeOnly: Boolean(params.activeOnly),
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (oracleAddress) {
      filters.push({
        memcmp: { offset: 40, bytes: asPubkey(oracleAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolOracleApproval",
      filters,
    );
    return parseAccounts(accounts, decodePoolOracleApproval)
      .filter((row) => (params.activeOnly ? row.active : true))
      .filter((row) =>
        includesSearch([row.pool, row.oracle, row.address], params.search),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.oracle.localeCompare(b.oracle),
      );
  });
}

export async function listPoolOraclePolicies(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
}): Promise<PoolOraclePolicySummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-oracle-policies",
    {
      poolAddress,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolOraclePolicy",
      filters,
    );
    return parseAccounts(accounts, decodePoolOraclePolicy)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            String(row.quorumM),
            String(row.quorumN),
            row.requireVerifiedSchema ? "verified" : "any",
          ],
          params.search,
        ),
      )
      .sort((a, b) => a.pool.localeCompare(b.pool));
  });
}

export async function listPoolOraclePermissionSets(params: {
  connection: Connection;
  poolAddress?: string | null;
  oracleAddress?: string | null;
  search?: string | null;
}): Promise<PoolOraclePermissionSetSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const oracleAddress = params.oracleAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-oracle-permission-sets",
    {
      poolAddress,
      oracleAddress,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolOraclePermissionSet",
    );
    return parseAccounts(accounts, decodePoolOraclePermissionSet)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) => (oracleAddress ? row.oracle === oracleAddress : true))
      .filter((row) =>
        includesSearch([row.pool, row.oracle, row.address], params.search),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.oracle.localeCompare(b.oracle),
      );
  });
}

export async function listSchemas(params: {
  connection: Connection;
  search?: string | null;
  verifiedOnly?: boolean;
}): Promise<SchemaSummary[]> {
  const cacheKey = discoveryCacheKey(params.connection, "schemas", {
    search: params.search ?? null,
    verifiedOnly: Boolean(params.verifiedOnly),
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "OutcomeSchemaRegistryEntry",
    );
    return parseAccounts(accounts, decodeSchema)
      .filter((row) => (params.verifiedOnly ? row.verified : true))
      .filter((row) =>
        includesSearch(
          [row.schemaKey, row.schemaKeyHashHex, row.metadataUri, row.publisher],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          Number(b.verified) - Number(a.verified) ||
          a.schemaKey.localeCompare(b.schemaKey) ||
          b.version - a.version ||
          a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolRules(params: {
  connection: Connection;
  poolAddress?: string | null;
  schemaKeyHashHex?: string | null;
  enabledOnly?: boolean;
  search?: string | null;
}): Promise<RuleSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const schemaKeyHashHex =
    params.schemaKeyHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(params.connection, "pool-rules", {
    poolAddress,
    schemaKeyHashHex,
    enabledOnly: Boolean(params.enabledOnly),
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (schemaKeyHashHex) {
      filters.push({
        memcmp: {
          offset: 104,
          bytes: encodeBase58(asBytes32(schemaKeyHashHex)),
        },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolOutcomeRule",
      filters,
    );
    return parseAccounts(accounts, decodeRule)
      .filter((row) => (params.enabledOnly ? row.enabled : true))
      .filter((row) =>
        includesSearch(
          [row.ruleId, row.schemaKey, row.ruleHashHex, row.pool],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.ruleId.localeCompare(b.ruleId) ||
          a.ruleHashHex.localeCompare(b.ruleHashHex),
      );
  });
}

export async function listMemberships(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<MembershipSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "memberships", {
    poolAddress,
    memberAddress,
    activeOnly: Boolean(params.activeOnly),
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (memberAddress) {
      filters.push({
        memcmp: { offset: 72, bytes: asPubkey(memberAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "MembershipRecord",
      filters,
    );
    return parseAccounts(accounts, decodeMembership)
      .filter((row) =>
        params.activeOnly ? row.status === MEMBERSHIP_STATUS_ACTIVE : true,
      )
      .filter((row) =>
        includesSearch([row.pool, row.member, row.address], params.search),
      )
      .sort(
        (a, b) =>
          a.member.localeCompare(b.member) || a.pool.localeCompare(b.pool),
      );
  });
}

export async function listClaimDelegateAuthorizations(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  delegateAddress?: string | null;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<ClaimDelegateAuthorizationSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const delegateAddress = params.delegateAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "claim-delegate-authorizations",
    {
      poolAddress,
      memberAddress,
      delegateAddress,
      activeOnly: Boolean(params.activeOnly),
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "ClaimDelegateAuthorization",
    );
    return parseAccounts(accounts, decodeClaimDelegateAuthorization)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) => (memberAddress ? row.member === memberAddress : true))
      .filter((row) =>
        delegateAddress ? row.delegate === delegateAddress : true,
      )
      .filter((row) => (params.activeOnly ? row.active : true))
      .filter((row) =>
        includesSearch(
          [row.pool, row.member, row.delegate, row.address],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.member.localeCompare(b.member),
      );
  });
}

export async function listInviteIssuers(params: {
  connection: Connection;
  activeOnly?: boolean;
  search?: string | null;
}): Promise<InviteIssuerSummary[]> {
  const cacheKey = discoveryCacheKey(params.connection, "invite-issuers", {
    activeOnly: Boolean(params.activeOnly),
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "InviteIssuerRegistryEntry",
    );
    return parseAccounts(accounts, decodeInviteIssuer)
      .filter((row) => (params.activeOnly ? row.active : true))
      .filter((row) =>
        includesSearch(
          [row.issuer, row.organizationRef, row.metadataUri],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.organizationRef.localeCompare(b.organizationRef) ||
          a.issuer.localeCompare(b.issuer),
      );
  });
}

export async function listPremiumLedgers(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  seriesRefHashHex?: string | null;
  search?: string | null;
}): Promise<PremiumLedgerSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const seriesRefHashHex =
    params.seriesRefHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(params.connection, "premium-ledgers", {
    poolAddress,
    memberAddress,
    seriesRefHashHex,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PremiumLedger",
    );
    return parseAccounts(accounts, decodePremiumLedger)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) => (memberAddress ? row.member === memberAddress : true))
      .filter((row) =>
        seriesRefHashHex ? row.seriesRefHashHex === seriesRefHashHex : true,
      )
      .filter((row) =>
        includesSearch(
          [row.pool, row.member, row.seriesRefHashHex, row.address],
          params.search,
        ),
      )
      .sort((a, b) => {
        if (a.paidAt === b.paidAt) {
          return a.address.localeCompare(b.address);
        }
        return a.paidAt > b.paidAt ? -1 : 1;
      });
  });
}

export async function listAttestationVotes(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  search?: string | null;
}): Promise<AttestationVoteSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "attestation-votes", {
    poolAddress,
    memberAddress,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (memberAddress) {
      filters.push({
        memcmp: { offset: 72, bytes: asPubkey(memberAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "AttestationVote",
      filters,
    );
    return parseAccounts(accounts, decodeAttestationVote)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.member,
            row.oracle,
            row.cycleHashHex,
            row.ruleHashHex,
            row.address,
          ],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) ||
          a.member.localeCompare(b.member) ||
          a.oracle.localeCompare(b.oracle) ||
          a.address.localeCompare(b.address),
      );
  });
}

export async function listMemberCycles(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  seriesRefHashHex?: string | null;
  search?: string | null;
}): Promise<MemberCycleStateSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const seriesRefHashHex =
    params.seriesRefHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(params.connection, "member-cycles", {
    poolAddress,
    memberAddress,
    seriesRefHashHex,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "MemberCycleState",
    );
    return parseAccounts(accounts, decodeMemberCycleState)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) => (memberAddress ? row.member === memberAddress : true))
      .filter((row) =>
        seriesRefHashHex ? row.seriesRefHashHex === seriesRefHashHex : true,
      )
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.member,
            row.paymentMint,
            row.seriesRefHashHex,
            row.address,
          ],
          params.search,
        ),
      )
      .sort((a, b) => {
        if (a.activatedAt === b.activatedAt) {
          return a.address.localeCompare(b.address);
        }
        return a.activatedAt > b.activatedAt ? -1 : 1;
      });
  });
}

export async function listOutcomeAggregates(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  finalizedOnly?: boolean;
  search?: string | null;
}): Promise<OutcomeAggregateSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "outcome-aggregates", {
    poolAddress,
    memberAddress,
    finalizedOnly: Boolean(params.finalizedOnly),
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (memberAddress) {
      filters.push({
        memcmp: { offset: 72, bytes: asPubkey(memberAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "CycleOutcomeAggregate",
      filters,
    );
    return parseAccounts(accounts, decodeOutcomeAggregate)
      .filter((row) => (params.finalizedOnly ? row.finalized : true))
      .filter((row) =>
        includesSearch(
          [row.member, row.pool, row.ruleHashHex, row.cycleHashHex],
          params.search,
        ),
      )
      .sort((a, b) => {
        if (a.latestAsOfTs === b.latestAsOfTs) {
          return a.address.localeCompare(b.address);
        }
        return a.latestAsOfTs > b.latestAsOfTs ? -1 : 1;
      });
  });
}

export async function listCohortSettlementRoots(params: {
  connection: Connection;
  poolAddress?: string | null;
  seriesRefHashHex?: string | null;
  finalizedOnly?: boolean;
  search?: string | null;
}): Promise<CohortSettlementRootSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const seriesRefHashHex =
    params.seriesRefHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "cohort-settlement-roots",
    {
      poolAddress,
      seriesRefHashHex,
      finalizedOnly: Boolean(params.finalizedOnly),
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "CohortSettlementRoot",
    );
    return parseAccounts(accounts, decodeCohortSettlementRoot)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) =>
        seriesRefHashHex ? row.seriesRefHashHex === seriesRefHashHex : true,
      )
      .filter((row) => (params.finalizedOnly ? row.finalized : true))
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.paymentMint,
            row.seriesRefHashHex,
            row.cohortHashHex,
            row.address,
          ],
          params.search,
        ),
      )
      .sort((a, b) => {
        if (a.finalizedAt === b.finalizedAt) {
          return a.address.localeCompare(b.address);
        }
        return a.finalizedAt > b.finalizedAt ? -1 : 1;
      });
  });
}

export async function listCoverageClaims(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  claimantAddress?: string | null;
  search?: string | null;
}): Promise<CoverageClaimSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const claimantAddress = params.claimantAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "coverage-claims", {
    poolAddress,
    memberAddress,
    claimantAddress,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (memberAddress) {
      filters.push({
        memcmp: { offset: 72, bytes: asPubkey(memberAddress).toBase58() },
      });
    }
    if (claimantAddress) {
      filters.push({
        memcmp: { offset: 104, bytes: asPubkey(claimantAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "CoverageClaimRecord",
      filters,
    );
    return parseAccounts(accounts, decodeCoverageClaim)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.member,
            row.claimant,
            row.intentHashHex,
            row.eventHashHex,
            row.address,
          ],
          params.search,
        ),
      )
      .sort((a, b) => {
        if (a.submittedAt === b.submittedAt) {
          return a.address.localeCompare(b.address);
        }
        return a.submittedAt > b.submittedAt ? -1 : 1;
      });
  });
}

export async function listRewardClaims(params: {
  connection: Connection;
  poolAddress?: string | null;
  memberAddress?: string | null;
  claimantAddress?: string | null;
  search?: string | null;
}): Promise<RewardClaimSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const memberAddress = params.memberAddress?.trim() || null;
  const claimantAddress = params.claimantAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "reward-claims", {
    poolAddress,
    memberAddress,
    claimantAddress,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (memberAddress) {
      filters.push({
        memcmp: { offset: 72, bytes: asPubkey(memberAddress).toBase58() },
      });
    }
    if (claimantAddress) {
      filters.push({
        memcmp: { offset: 104, bytes: asPubkey(claimantAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "ClaimRecord",
      filters,
    );
    return parseAccounts(accounts, decodeRewardClaim)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.member,
            row.claimant,
            row.cycleHashHex,
            row.ruleHashHex,
            row.intentHashHex,
            row.address,
          ],
          params.search,
        ),
      )
      .sort((a, b) => {
        if (a.submittedAt === b.submittedAt) {
          return a.address.localeCompare(b.address);
        }
        return a.submittedAt > b.submittedAt ? -1 : 1;
      });
  });
}

export async function listProtocolFeeVaults(params: {
  connection: Connection;
  paymentMint?: string | null;
  search?: string | null;
}): Promise<ProtocolFeeVaultSummary[]> {
  const paymentMint = params.paymentMint?.trim() || null;
  const cacheKey = discoveryCacheKey(params.connection, "protocol-fee-vaults", {
    paymentMint,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "ProtocolFeeVault",
    );
    return parseAccounts(accounts, decodeProtocolFeeVault)
      .filter((row) => (paymentMint ? row.paymentMint === paymentMint : true))
      .filter((row) =>
        includesSearch([row.paymentMint, row.address], params.search),
      )
      .sort(
        (a, b) =>
          a.paymentMint.localeCompare(b.paymentMint) ||
          a.address.localeCompare(b.address),
      );
  });
}

export async function listPoolOracleFeeVaults(params: {
  connection: Connection;
  poolAddress?: string | null;
  oracleAddress?: string | null;
  paymentMint?: string | null;
  search?: string | null;
}): Promise<PoolOracleFeeVaultSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const oracleAddress = params.oracleAddress?.trim() || null;
  const paymentMint = params.paymentMint?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-oracle-fee-vaults",
    {
      poolAddress,
      oracleAddress,
      paymentMint,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolOracleFeeVault",
    );
    return parseAccounts(accounts, decodePoolOracleFeeVault)
      .filter((row) => (poolAddress ? row.pool === poolAddress : true))
      .filter((row) => (oracleAddress ? row.oracle === oracleAddress : true))
      .filter((row) => (paymentMint ? row.paymentMint === paymentMint : true))
      .filter((row) =>
        includesSearch(
          [row.pool, row.oracle, row.paymentMint, row.address],
          params.search,
        ),
      )
      .sort(
        (a, b) =>
          a.pool.localeCompare(b.pool) || a.oracle.localeCompare(b.oracle),
      );
  });
}

export async function listSchemaDependencyLedgers(params: {
  connection: Connection;
  schemaKeyHashHex?: string | null;
  search?: string | null;
}): Promise<SchemaDependencyLedgerSummary[]> {
  const schemaKeyHashHex =
    params.schemaKeyHashHex?.trim().toLowerCase().replace(/^0x/, "") || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "schema-dependency-ledgers",
    {
      schemaKeyHashHex,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const accounts = await fetchProgramAccounts(
      params.connection,
      "SchemaDependencyLedger",
    );
    return parseAccounts(accounts, decodeSchemaDependencyLedger)
      .filter((row) =>
        schemaKeyHashHex ? row.schemaKeyHashHex === schemaKeyHashHex : true,
      )
      .filter((row) =>
        includesSearch([row.schemaKeyHashHex, row.address], params.search),
      )
      .sort((a, b) => a.schemaKeyHashHex.localeCompare(b.schemaKeyHashHex));
  });
}

export async function listPoolRedemptionRequests(params: {
  connection: Connection;
  poolAddress?: string | null;
  redeemerAddress?: string | null;
  search?: string | null;
}): Promise<PoolRedemptionRequestSummary[]> {
  const poolAddress = params.poolAddress?.trim() || null;
  const redeemerAddress = params.redeemerAddress?.trim() || null;
  const cacheKey = discoveryCacheKey(
    params.connection,
    "pool-redemption-requests",
    {
      poolAddress,
      redeemerAddress,
      search: params.search ?? null,
    },
  );
  return withDiscoveryCache(cacheKey, async () => {
    const filters: GetProgramAccountsFilter[] = [];
    if (poolAddress) {
      filters.push({
        memcmp: { offset: 8, bytes: asPubkey(poolAddress).toBase58() },
      });
    }
    if (redeemerAddress) {
      filters.push({
        memcmp: { offset: 40, bytes: asPubkey(redeemerAddress).toBase58() },
      });
    }
    const accounts = await fetchProgramAccounts(
      params.connection,
      "PoolRedemptionRequest",
      filters,
    );
    return parseAccounts(accounts, decodeRedemptionRequest)
      .filter((row) =>
        includesSearch(
          [
            row.pool,
            row.redeemer,
            row.requestHashHex,
            row.shareMint,
            row.payoutMint,
            row.address,
          ],
          params.search,
        ),
      )
      .sort((a, b) => {
        if (a.requestedAt === b.requestedAt) {
          return a.address.localeCompare(b.address);
        }
        return a.requestedAt > b.requestedAt ? -1 : 1;
      });
  });
}

export async function listPoolsWithPolicySeries(params: {
  connection: Connection;
  poolAddress?: string | null;
  search?: string | null;
  activeOnlySeries?: boolean;
}): Promise<PoolWithPolicySeriesSummary[]> {
  const [pools, series] = await Promise.all([
    listPools({ connection: params.connection, search: params.search ?? null }),
    listPolicySeries({
      connection: params.connection,
      poolAddress: params.poolAddress ?? null,
      activeOnly: params.activeOnlySeries,
      search: params.search ?? null,
    }),
  ]);

  const byPool = new Map<string, PolicySeriesSummary[]>();
  for (const entry of series) {
    const existing = byPool.get(entry.pool) ?? [];
    existing.push(entry);
    byPool.set(entry.pool, existing);
  }

  const filteredPools = params.poolAddress?.trim()
    ? pools.filter((pool) => pool.address === params.poolAddress?.trim())
    : pools;

  return filteredPools.map((pool) => {
    const policySeries = byPool.get(pool.address) ?? [];
    return {
      ...pool,
      policySeries,
      policySeriesCount: policySeries.length,
      activePolicySeriesCount: policySeries.filter(
        (entry) => entry.status === POLICY_SERIES_STATUS_ACTIVE,
      ).length,
    };
  });
}

export async function listWalletTokenAccountsForMint(params: {
  connection: Connection;
  owner: string;
  mint: string;
  search?: string | null;
}): Promise<TokenAccountSummary[]> {
  const owner = asPubkey(params.owner).toBase58();
  const mint = asPubkey(params.mint).toBase58();
  const cacheKey = discoveryCacheKey(params.connection, "token-accounts", {
    owner,
    mint,
    search: params.search ?? null,
  });
  return withDiscoveryCache(cacheKey, async () => {
    const response = await params.connection.getParsedTokenAccountsByOwner(
      new PublicKey(owner),
      { mint: new PublicKey(mint) },
      "confirmed",
    );
    const rows: TokenAccountSummary[] = [];
    for (const entry of response.value) {
      const parsed = entry.account.data as ParsedAccountData;
      const info = parsed?.parsed?.info;
      if (!info?.tokenAmount) continue;
      rows.push({
        address: entry.pubkey.toBase58(),
        mint: String(info.mint),
        owner: String(info.owner),
        amount: String(info.tokenAmount.amount ?? "0"),
        decimals: Number(info.tokenAmount.decimals ?? 0),
        uiAmountString: String(info.tokenAmount.uiAmountString ?? "0"),
      });
    }
    return rows
      .filter((row) =>
        includesSearch(
          [row.address, row.uiAmountString, row.amount],
          params.search,
        ),
      )
      .sort((a, b) => {
        const amountCmp = BigInt(b.amount) - BigInt(a.amount);
        if (amountCmp !== 0n) return amountCmp > 0n ? 1 : -1;
        return a.address.localeCompare(b.address);
      });
  });
}

function resolveExplorerCluster(clusterOverride?: string): string {
  return (
    clusterOverride?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim() ||
    "devnet"
  );
}

export function toExplorerLink(
  signature: string,
  clusterOverride?: string,
): string {
  const cluster = resolveExplorerCluster(clusterOverride);
  const normalizedSignature = signature.trim();
  return `https://explorer.solana.com/tx/${encodeURIComponent(normalizedSignature)}?cluster=${encodeURIComponent(cluster)}`;
}

export function toExplorerAddressLink(
  address: string,
  clusterOverride?: string,
): string {
  const cluster = resolveExplorerCluster(clusterOverride);
  const normalizedAddress = address.trim();
  return `https://explorer.solana.com/address/${encodeURIComponent(normalizedAddress)}?cluster=${encodeURIComponent(cluster)}`;
}

export function defaultPoolAddressFromEnv(): string | null {
  const value = process.env.NEXT_PUBLIC_DEFAULT_POOL_ADDRESS;
  return value?.trim() ? value.trim() : null;
}

export function defaultOracleAddressFromEnv(): string | null {
  const value = process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS;
  return value?.trim() ? value.trim() : null;
}

export function defaultTokenGateMintFromEnv(): string | null {
  const value = process.env.NEXT_PUBLIC_DEFAULT_TOKEN_GATE_MINT;
  return value?.trim() ? value.trim() : null;
}

export function defaultRewardPayoutMintFromEnv(): string | null {
  const direct = process.env.NEXT_PUBLIC_DEFAULT_REWARD_PAYOUT_MINT;
  if (direct?.trim()) return direct.trim();
  const fallback = process.env.NEXT_PUBLIC_DEFAULT_PAYOUT_MINT;
  return fallback?.trim() ? fallback.trim() : null;
}

export function defaultInsurancePayoutMintFromEnv(): string | null {
  const direct = process.env.NEXT_PUBLIC_DEFAULT_INSURANCE_PAYOUT_MINT;
  if (direct?.trim()) return direct.trim();
  const fallback = process.env.NEXT_PUBLIC_DEFAULT_PAYOUT_MINT;
  return fallback?.trim() ? fallback.trim() : null;
}

export function defaultGovernanceRealmFromEnv(): string | null {
  const value = process.env.NEXT_PUBLIC_GOVERNANCE_REALM;
  return value?.trim() ? value.trim() : null;
}

export function defaultGovernanceConfigFromEnv(): string | null {
  const value = process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG;
  return value?.trim() ? value.trim() : null;
}
