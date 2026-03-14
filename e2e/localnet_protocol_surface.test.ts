// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createAccount,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
} from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";
import {
  LocalnetHarness,
  ORACLE_PERMISSION_ALL,
  ORACLE_PERMISSION_DATA_ATTEST,
  ORACLE_PERMISSION_CYCLE_SETTLE,
  ORACLE_PERMISSION_QUOTE,
  ZERO_PUBKEY,
  assertChanged,
  assertTokenChanged,
} from "./support/harness.ts";
import {
  COVERED_ERROR_CASES,
  INSTRUCTION_EXCEPTION_REASONS,
  KNOWN_ERROR_NAMES,
  SCENARIO_ORDER,
  SCENARIO_INSTRUCTIONS,
  manifestCoveredErrorCases,
  manifestErrorExceptions,
  manifestInstructionExceptions,
  manifestInstructionAssignments,
  type ScenarioName,
} from "./support/surface_manifest.ts";
import { idlErrors, instructionSurface } from "./support/surface.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");

type GlobalState = {
  originalGovernance: Keypair;
  governanceAuthority: Keypair;
  legacyOracle: Keypair;
  oracle: Keypair;
  operator: Keypair;
  riskManager: Keypair;
  complianceAuthority: Keypair;
  guardianAuthority: Keypair;
  openMember: Keypair;
  tokenMember: Keypair;
  inviteMember: Keypair;
  coverageMember: Keypair;
  alternateMember: Keypair;
  delegate: Keypair;
  stakeMint: PublicKey;
  oracleStakeTokenAccount: PublicKey;
  governanceStakeTreasuryTokenAccount: PublicKey;
  protocolBootstrapped: boolean;
  mainOracleReady: boolean;
  stakeVault: Keypair | null;
};

class AccountDecoder {
  private offset = 0;

  constructor(private readonly bytes: Buffer) {}

  readBytes(size: number): Buffer {
    const value = this.bytes.subarray(this.offset, this.offset + size);
    this.offset += size;
    return value;
  }

  readU8(): number {
    return this.readBytes(1)[0] ?? 0;
  }

  readBool(): boolean {
    return this.readU8() !== 0;
  }

  readU16(): number {
    const value = this.bytes.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readU32(): number {
    const value = this.bytes.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readU64(): bigint {
    const value = this.bytes.readBigUInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readI64(): bigint {
    const value = this.bytes.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readPubkey(): string {
    return new PublicKey(this.readBytes(32)).toBase58();
  }

  readString(): string {
    const length = this.readU32();
    return this.readBytes(length).toString("utf8");
  }
}

function bytesHex(bytes: Buffer) {
  return bytes.toString("hex");
}

async function mustReadAccount(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await connection.getAccountInfo(address, "confirmed");
  assert.ok(info, `expected account ${address.toBase58()} to exist`);
  return info;
}

async function decodeProtocolConfig(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    admin: d.readPubkey(),
    governanceAuthority: d.readPubkey(),
    governanceRealm: d.readPubkey(),
    governanceConfig: d.readPubkey(),
    defaultStakeMint: d.readPubkey(),
    protocolFeeBps: d.readU16(),
    minOracleStake: d.readU64(),
    emergencyPaused: d.readBool(),
    allowedPayoutMintsHashHex: bytesHex(d.readBytes(32)),
    bump: d.readU8(),
  };
}

async function decodePool(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
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

async function decodeSchema(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    schemaKeyHashHex: bytesHex(d.readBytes(32)),
    schemaKey: d.readString(),
    version: d.readU16(),
    schemaHashHex: bytesHex(d.readBytes(32)),
    publisher: d.readPubkey(),
    verified: d.readBool(),
  };
}

async function decodeSchemaDependency(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    schemaKeyHashHex: bytesHex(d.readBytes(32)),
    activeRuleRefcount: d.readU32(),
    bump: d.readU8(),
  };
}

async function decodePoolTerms(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    poolType: d.readU8(),
    payoutAssetMint: d.readPubkey(),
    termsHashHex: bytesHex(d.readBytes(32)),
    payoutPolicyHashHex: bytesHex(d.readBytes(32)),
    cycleMode: d.readU8(),
    metadataUri: d.readString(),
    bump: d.readU8(),
  };
}

async function decodePoolOraclePolicy(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    quorumM: d.readU8(),
    quorumN: d.readU8(),
    requireVerifiedSchema: d.readBool(),
    oracleFeeBps: d.readU16(),
    allowDelegateClaim: d.readBool(),
    challengeWindowSecs: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodePoolOraclePermissions(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    oracle: d.readPubkey(),
    permissions: d.readU32(),
    bump: d.readU8(),
  };
}

async function decodePoolRiskConfig(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    redemptionMode: d.readU8(),
    claimMode: d.readU8(),
    impaired: d.readBool(),
    updatedBy: d.readPubkey(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodePolicySeries(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    status: d.readU8(),
    planMode: d.readU8(),
    sponsorMode: d.readU8(),
    displayName: d.readString(),
    metadataUri: d.readString(),
    termsHashHex: bytesHex(d.readBytes(32)),
    durationSecs: d.readI64(),
    premiumDueEverySecs: d.readI64(),
    premiumGraceSecs: d.readI64(),
    premiumAmount: d.readU64(),
    interopProfileHashHex: bytesHex(d.readBytes(32)),
    oracleProfileHashHex: bytesHex(d.readBytes(32)),
    riskFamilyHashHex: bytesHex(d.readBytes(32)),
    issuanceTemplateHashHex: bytesHex(d.readBytes(32)),
    comparabilityHashHex: bytesHex(d.readBytes(32)),
    renewalOfHashHex: bytesHex(d.readBytes(32)),
    termsVersion: d.readU16(),
    mappingVersion: d.readU16(),
    createdAtTs: d.readI64(),
    updatedAtTs: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodePoolCompliancePolicy(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    providerRefHashHex: bytesHex(d.readBytes(32)),
    credentialTypeHashHex: bytesHex(d.readBytes(32)),
    revocationListHashHex: bytesHex(d.readBytes(32)),
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

async function decodePoolControlAuthority(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    operatorAuthority: d.readPubkey(),
    riskManagerAuthority: d.readPubkey(),
    complianceAuthority: d.readPubkey(),
    guardianAuthority: d.readPubkey(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodePoolAutomationPolicy(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    oracleAutomationMode: d.readU8(),
    claimAutomationMode: d.readU8(),
    allowedAiRolesMask: d.readU16(),
    maxAutoClaimAmount: d.readU64(),
    requiredAttestationProviderRefHashHex: bytesHex(d.readBytes(32)),
    updatedBy: d.readPubkey(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodePoolTreasuryReserve(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    paymentMint: d.readPubkey(),
    reservedRefundAmount: d.readU64(),
    reservedRewardAmount: d.readU64(),
    reservedRedistributionAmount: d.readU64(),
    manualCoverageReserveAmount: d.readU64(),
    reservedCoverageClaimAmount: d.readU64(),
    paidCoverageClaimAmount: d.readU64(),
    recoveredCoverageClaimAmount: d.readU64(),
    impairedAmount: d.readU64(),
    lastLiabilityUpdateTs: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodePoolAssetVault(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    payoutMint: d.readPubkey(),
    vaultTokenAccount: d.readPubkey(),
    active: d.readBool(),
    bump: d.readU8(),
  };
}

async function decodePolicySeriesPaymentOption(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    paymentMint: d.readPubkey(),
    paymentAmount: d.readU64(),
    active: d.readBool(),
    bump: d.readU8(),
  };
}

async function decodePolicyPosition(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    member: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    termsHashHex: bytesHex(d.readBytes(32)),
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

async function decodePolicyPositionNft(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    member: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    nftMint: d.readPubkey(),
    metadataUri: d.readString(),
    bump: d.readU8(),
  };
}

async function decodePremiumLedger(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    member: d.readPubkey(),
    periodIndex: d.readU64(),
    amount: d.readU64(),
    source: d.readU8(),
    paidAt: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodeOutcomeAggregate(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    member: d.readPubkey(),
    cycleHashHex: bytesHex(d.readBytes(32)),
    ruleHashHex: bytesHex(d.readBytes(32)),
    passVotes: d.readU16(),
    failVotes: d.readU16(),
    quorumM: d.readU8(),
    quorumN: d.readU8(),
    finalized: d.readBool(),
    passed: d.readBool(),
    claimed: d.readBool(),
    rewardLiabilityReserved: d.readBool(),
    evidenceHashHex: bytesHex(d.readBytes(32)),
    externalAttestationRefHashHex: bytesHex(d.readBytes(32)),
    reviewStatus: d.readU8(),
    challengeWindowEndsAt: d.readI64(),
    disputeReasonHashHex: bytesHex(d.readBytes(32)),
    disputedBy: d.readPubkey(),
    resolvedBy: d.readPubkey(),
    resolvedAt: d.readI64(),
    aiRole: d.readU8(),
    automationMode: d.readU8(),
    modelVersionHashHex: bytesHex(d.readBytes(32)),
    policyVersionHashHex: bytesHex(d.readBytes(32)),
    executionEnvironmentHashHex: bytesHex(d.readBytes(32)),
    attestationProviderRefHashHex: bytesHex(d.readBytes(32)),
    latestAsOfTs: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodeClaimRecordV2(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    member: d.readPubkey(),
    claimant: d.readPubkey(),
    cycleHashHex: bytesHex(d.readBytes(32)),
    ruleHashHex: bytesHex(d.readBytes(32)),
    intentHashHex: bytesHex(d.readBytes(32)),
    payoutMint: d.readPubkey(),
    payoutAmount: d.readU64(),
    recipient: d.readPubkey(),
    submittedAt: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodeMemberCycle(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    member: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
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
    cohortHashHex: bytesHex(d.readBytes(32)),
    settledHealthAlphaScore: d.readU16(),
    includedShieldCount: d.readU8(),
    shieldConsumed: d.readBool(),
    status: d.readU8(),
    passed: d.readBool(),
    activatedAt: d.readI64(),
    settledAt: d.readI64(),
    quoteHashHex: bytesHex(d.readBytes(32)),
    bump: d.readU8(),
  };
}

async function decodeCohortSettlementRoot(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    paymentMint: d.readPubkey(),
    cohortHashHex: bytesHex(d.readBytes(32)),
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

async function decodeCoverageClaim(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    member: d.readPubkey(),
    claimant: d.readPubkey(),
    intentHashHex: bytesHex(d.readBytes(32)),
    eventHashHex: bytesHex(d.readBytes(32)),
    evidenceHashHex: bytesHex(d.readBytes(32)),
    interopRefHashHex: bytesHex(d.readBytes(32)),
    interopProfileHashHex: bytesHex(d.readBytes(32)),
    codeSystemFamilyHashHex: bytesHex(d.readBytes(32)),
    decisionReasonHashHex: bytesHex(d.readBytes(32)),
    adjudicationRefHashHex: bytesHex(d.readBytes(32)),
    status: d.readU8(),
    claimFamily: d.readU8(),
    appealCount: d.readU16(),
    requestedAmount: d.readU64(),
    approvedAmount: d.readU64(),
    paidAmount: d.readU64(),
    reservedAmount: d.readU64(),
    recoveryAmount: d.readU64(),
    aiDecisionHashHex: bytesHex(d.readBytes(32)),
    aiPolicyHashHex: bytesHex(d.readBytes(32)),
    aiExecutionEnvironmentHashHex: bytesHex(d.readBytes(32)),
    aiAttestationRefHashHex: bytesHex(d.readBytes(32)),
    aiAutomationMode: d.readU8(),
    submittedAt: d.readI64(),
    reviewedAt: d.readI64(),
    settledAt: d.readI64(),
    closedAt: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodeRule(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    ruleHashHex: bytesHex(d.readBytes(32)),
    schemaKeyHashHex: bytesHex(d.readBytes(32)),
    ruleId: d.readString(),
    schemaKey: d.readString(),
    schemaVersion: d.readU16(),
    interopProfileHashHex: bytesHex(d.readBytes(32)),
    codeSystemFamilyHashHex: bytesHex(d.readBytes(32)),
    mappingVersion: d.readU16(),
    payoutHashHex: bytesHex(d.readBytes(32)),
    enabled: d.readBool(),
    bump: d.readU8(),
  };
}

async function decodeMembership(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    member: d.readPubkey(),
    subjectCommitmentHex: bytesHex(d.readBytes(32)),
    status: d.readU8(),
    enrolledAt: d.readI64(),
    updatedAt: d.readI64(),
    bump: d.readU8(),
  };
}

async function decodeInviteIssuer(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    issuer: d.readPubkey(),
    organizationRef: d.readString(),
    metadataUri: d.readString(),
    active: d.readBool(),
    bump: d.readU8(),
  };
}

async function decodePoolLiquidityConfig(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    payoutMint: d.readPubkey(),
    shareMint: d.readPubkey(),
    depositsEnabled: d.readBool(),
    bump: d.readU8(),
  };
}

async function decodePoolCapitalClass(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    shareMint: d.readPubkey(),
    payoutMint: d.readPubkey(),
    classIdHashHex: bytesHex(d.readBytes(32)),
    seriesRefHashHex: bytesHex(d.readBytes(32)),
    complianceProfileHashHex: bytesHex(d.readBytes(32)),
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

async function decodeRedemptionRequest(
  connection: LocalnetHarness["connection"],
  address: PublicKey,
) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
    pool: d.readPubkey(),
    redeemer: d.readPubkey(),
    shareMint: d.readPubkey(),
    payoutMint: d.readPubkey(),
    requestHashHex: bytesHex(d.readBytes(32)),
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

async function decodeOracleStakePosition(connection: LocalnetHarness["connection"], address: PublicKey) {
  const info = await mustReadAccount(connection, address);
  const d = new AccountDecoder(Buffer.from(info.data));
  d.readBytes(8);
  return {
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

async function fundedSigner(harness: LocalnetHarness) {
  return harness.fundedKeypair();
}

function scenarioEnabled(harness: LocalnetHarness, name: ScenarioName) {
  return !harness.selectedScenario || harness.selectedScenario === name;
}

function uniqueLabel(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function nowTs() {
  return BigInt(Math.floor(Date.now() / 1000));
}

function computeCycleFeeBreakdown(params: {
  premiumAmountRaw: bigint;
  bondAmountRaw: bigint;
  shieldFeeRaw: bigint;
  protocolFeeBps: number;
  oracleFeeBps: number;
}) {
  const protocolFeeRaw = (params.premiumAmountRaw * BigInt(params.protocolFeeBps)) / 10_000n;
  const oracleFeeRaw = (params.premiumAmountRaw * BigInt(params.oracleFeeBps)) / 10_000n;
  const netPoolPremiumRaw = params.premiumAmountRaw - protocolFeeRaw - oracleFeeRaw;
  const totalAmountRaw = params.premiumAmountRaw + params.bondAmountRaw + params.shieldFeeRaw;
  return {
    protocolFeeRaw,
    oracleFeeRaw,
    netPoolPremiumRaw,
    totalAmountRaw,
  };
}

function lookupAddressesForTransaction(tx: import("@solana/web3.js").Transaction) {
  return tx.instructions.flatMap((instruction) => [
    instruction.programId,
    ...instruction.keys.map((key) => key.pubkey),
  ]);
}

function addComputeBudget(tx: import("@solana/web3.js").Transaction, units = 400_000) {
  tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units }));
  return tx;
}

async function createGlobalState(harness: LocalnetHarness): Promise<GlobalState> {
  const [
    originalGovernance,
    governanceAuthority,
    legacyOracle,
    oracle,
    operator,
    riskManager,
    complianceAuthority,
    guardianAuthority,
    openMember,
    tokenMember,
    inviteMember,
    coverageMember,
    alternateMember,
    delegate,
  ] = await Promise.all([
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
    fundedSigner(harness),
  ]);

  const stakeMint = await harness.createMint(originalGovernance, 0);
  const oracleStakeTokenAccount = (
    await harness.getOrCreateAta({
      payer: originalGovernance,
      mint: stakeMint,
      owner: oracle.publicKey,
    })
  ).address;
  const governanceStakeTreasuryTokenAccount = (
    await harness.getOrCreateAta({
      payer: originalGovernance,
      mint: stakeMint,
      owner: governanceAuthority.publicKey,
    })
  ).address;
  await harness.mintTo({
    payer: originalGovernance,
    mint: stakeMint,
    destination: oracleStakeTokenAccount,
    authority: originalGovernance,
    amount: 1_000n,
  });

  return {
    originalGovernance,
    governanceAuthority,
    legacyOracle,
    oracle,
    operator,
    riskManager,
    complianceAuthority,
    guardianAuthority,
    openMember,
    tokenMember,
    inviteMember,
    coverageMember,
    alternateMember,
    delegate,
    stakeMint,
    oracleStakeTokenAccount,
    governanceStakeTreasuryTokenAccount,
    protocolBootstrapped: false,
    mainOracleReady: false,
    stakeVault: null,
  };
}

async function ensureProtocolBootstrapped(
  harness: LocalnetHarness,
  state: GlobalState,
  recorder?: ReturnType<LocalnetHarness["beginScenario"]>,
) {
  if (state.protocolBootstrapped) {
    return;
  }

  const configAddress = protocol.deriveConfigV2Pda(harness.programId);
  const beforeConfig = await harness.snapshotAccount(configAddress);
  const initializeTx = protocol.buildInitializeProtocolV2Tx({
    admin: state.originalGovernance.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
    protocolFeeBps: 300,
    governanceRealm: Keypair.generate().publicKey.toBase58(),
    governanceConfig: state.governanceAuthority.publicKey.toBase58(),
    defaultStakeMint: state.stakeMint.toBase58(),
    minOracleStake: 0n,
  });
  const initializeResult = await harness.send(
    "initialize_protocol_v2",
    initializeTx,
    [state.originalGovernance],
  );
  recorder?.recordSuccess(initializeResult);
  assertChanged(beforeConfig, await harness.snapshotAccount(configAddress), "initialize_protocol_v2");

  const paramsBefore = await harness.snapshotAccount(configAddress);
  const setParamsTx = protocol.buildSetProtocolParamsTx({
    governanceAuthority: state.originalGovernance.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
    protocolFeeBps: 300,
    allowedPayoutMintsHashHex: createHash("sha256").update("allowed-payout-mints").digest("hex"),
    minOracleStake: 0n,
    emergencyPaused: false,
  });
  const paramsResult = await harness.send("set_protocol_params", setParamsTx, [state.originalGovernance]);
  recorder?.recordSuccess(paramsResult);
  assertChanged(paramsBefore, await harness.snapshotAccount(configAddress), "set_protocol_params");

  const rotateBefore = await harness.snapshotAccount(configAddress);
  const rotateTx = protocol.buildRotateGovernanceAuthorityTx({
    governanceAuthority: state.originalGovernance.publicKey,
    newAuthority: state.governanceAuthority.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
  });
  const rotateResult = await harness.send(
    "rotate_governance_authority",
    rotateTx,
    [state.originalGovernance],
  );
  recorder?.recordSuccess(rotateResult);
  assertChanged(rotateBefore, await harness.snapshotAccount(configAddress), "rotate_governance_authority");

  const unauthorizedTx = protocol.buildSetProtocolParamsTx({
    governanceAuthority: state.originalGovernance.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
    protocolFeeBps: 200,
    allowedPayoutMintsHashHex: createHash("sha256").update("unauthorized").digest("hex"),
    minOracleStake: 0n,
    emergencyPaused: false,
  });
  await harness.expectCustomError({
    caseId: COVERED_ERROR_CASES.GovernanceUnauthorized ?? "governance-unauthorized-update",
    expectedErrorName: "GovernanceUnauthorized",
    tx: unauthorizedTx,
    signers: [state.originalGovernance],
    unchangedAddresses: [configAddress],
  });
  recorder?.recordFailure(COVERED_ERROR_CASES.GovernanceUnauthorized ?? "governance-unauthorized-update");

  const config = await decodeProtocolConfig(harness.connection, configAddress);
  assert.equal(config.defaultStakeMint, state.stakeMint.toBase58());
  assert.equal(config.governanceAuthority, state.governanceAuthority.publicKey.toBase58());
  state.protocolBootstrapped = true;
}

async function ensureMainOracleReady(
  harness: LocalnetHarness,
  state: GlobalState,
  recorder?: ReturnType<LocalnetHarness["beginScenario"]>,
) {
  await ensureProtocolBootstrapped(harness, state, recorder);
  if (state.mainOracleReady) {
    return;
  }

  const oracleEntry = protocol.deriveOraclePda({
    programId: harness.programId,
    oracle: state.oracle.publicKey,
  });
  const oracleProfile = protocol.deriveOracleProfilePda({
    programId: harness.programId,
    oracle: state.oracle.publicKey,
  });
  const stakePosition = protocol.deriveOracleStakePda({
    programId: harness.programId,
    oracle: state.oracle.publicKey,
    staker: state.oracle.publicKey,
  });
  const stakeVault = Keypair.generate();
  state.stakeVault = stakeVault;

  const registerBefore = await harness.snapshotAccount(oracleProfile);
  const registerTx = protocol.buildRegisterOracleV2Tx({
    admin: state.governanceAuthority.publicKey,
    oracle: state.oracle.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
    oracleType: protocol.ORACLE_TYPE_OTHER,
    displayName: "Localnet Oracle",
    legalName: "Localnet Oracle LLC",
    websiteUrl: "https://oracle.local",
    appUrl: "https://app.oracle.local",
    logoUri: "https://oracle.local/logo.png",
    webhookUrl: "https://oracle.local/hook",
    supportedSchemaKeyHashesHex: [createHash("sha256").update("schema-local").digest("hex")],
  });
  const registerResult = await harness.send(
    "register_oracle_v2",
    registerTx,
    [state.governanceAuthority],
  );
  recorder?.recordSuccess(registerResult);
  assertChanged(registerBefore, await harness.snapshotAccount(oracleProfile), "register_oracle_v2");

  const claimBefore = await harness.snapshotAccount(oracleProfile);
  const claimTx = protocol.buildClaimOracleV2Tx({
    oracle: state.oracle.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
  });
  const claimResult = await harness.send("claim_oracle_v2", claimTx, [state.oracle]);
  recorder?.recordSuccess(claimResult);
  assertChanged(claimBefore, await harness.snapshotAccount(oracleProfile), "claim_oracle_v2");

  const updateProfileBefore = await harness.snapshotAccount(oracleProfile);
  const updateProfileTx = protocol.buildUpdateOracleProfileV2Tx({
    authority: state.oracle.publicKey,
    oracle: state.oracle.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
    oracleType: protocol.ORACLE_TYPE_WEARABLE_DATA_PROVIDER,
    displayName: "Localnet Oracle Updated",
    legalName: "Localnet Oracle Updated LLC",
    websiteUrl: "https://oracle.updated.local",
    appUrl: "https://app.updated.local",
    logoUri: "https://oracle.updated.local/logo.png",
    webhookUrl: "https://oracle.updated.local/hook",
    supportedSchemaKeyHashesHex: [createHash("sha256").update("schema-updated").digest("hex")],
  });
  const updateProfileResult = await harness.send(
    "update_oracle_profile_v2",
    updateProfileTx,
    [state.oracle],
  );
  recorder?.recordSuccess(updateProfileResult);
  assertChanged(
    updateProfileBefore,
    await harness.snapshotAccount(oracleProfile),
    "update_oracle_profile_v2",
  );

  const metadataBefore = await harness.snapshotAccount(oracleEntry);
  const updateMetadataTx = protocol.buildUpdateOracleMetadataTx({
    oracle: state.oracle.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
    metadataUri: "https://oracle.updated.local/metadata",
    active: true,
  });
  const metadataResult = await harness.send("update_oracle_metadata", updateMetadataTx, [state.oracle]);
  recorder?.recordSuccess(metadataResult);
  assertChanged(metadataBefore, await harness.snapshotAccount(oracleEntry), "update_oracle_metadata");

  const stakeBefore = await harness.snapshotAccount(stakePosition);
  const stakeTx = protocol.buildStakeOracleTx({
    staker: state.oracle.publicKey,
    oracle: state.oracle.publicKey,
    stakeMint: state.stakeMint,
    stakeVault: stakeVault.publicKey,
    stakerTokenAccount: state.oracleStakeTokenAccount,
    recentBlockhash: await harness.latestBlockhash(),
    amount: 1_000n,
  });
  const stakeResult = await harness.send("stake_oracle", stakeTx, [state.oracle, stakeVault]);
  recorder?.recordSuccess(stakeResult);
  assertChanged(stakeBefore, await harness.snapshotAccount(stakePosition), "stake_oracle");

  const slashBefore = await harness.snapshotAccount(stakePosition);
  const slashTx = protocol.buildSlashOracleTx({
    governanceAuthority: state.governanceAuthority.publicKey,
    stakePosition,
    stakeVault: stakeVault.publicKey,
    slashTreasuryTokenAccount: state.governanceStakeTreasuryTokenAccount,
    recentBlockhash: await harness.latestBlockhash(),
    amount: 200n,
  });
  const slashResult = await harness.send("slash_oracle", slashTx, [state.governanceAuthority]);
  recorder?.recordSuccess(slashResult);
  assertChanged(slashBefore, await harness.snapshotAccount(stakePosition), "slash_oracle");

  const requestBefore = await harness.snapshotAccount(stakePosition);
  const requestTx = protocol.buildRequestUnstakeTx({
    staker: state.oracle.publicKey,
    oracle: state.oracle.publicKey,
    recentBlockhash: await harness.latestBlockhash(),
    amount: 800n,
    cooldownSeconds: 0n,
  });
  const requestResult = await harness.send("request_unstake", requestTx, [state.oracle]);
  recorder?.recordSuccess(requestResult);
  assertChanged(requestBefore, await harness.snapshotAccount(stakePosition), "request_unstake");

  const finalizeBefore = await harness.snapshotAccount(stakePosition);
  const finalizeTx = protocol.buildFinalizeUnstakeTx({
    staker: state.oracle.publicKey,
    oracle: state.oracle.publicKey,
    stakeVault: stakeVault.publicKey,
    destinationTokenAccount: state.oracleStakeTokenAccount,
    recentBlockhash: await harness.latestBlockhash(),
  });
  const finalizeResult = await harness.send("finalize_unstake", finalizeTx, [state.oracle]);
  recorder?.recordSuccess(finalizeResult);
  assertChanged(finalizeBefore, await harness.snapshotAccount(stakePosition), "finalize_unstake");

  const decodedStake = await decodeOracleStakePosition(harness.connection, stakePosition);
  assert.equal(decodedStake.stakedAmount, 0n);
  state.mainOracleReady = true;
}

async function createPool(params: {
  harness: LocalnetHarness;
  authority: Keypair;
  poolIdPrefix: string;
  organizationRef: string;
  payoutLamportsPerPass: bigint;
  membershipMode: number;
  payoutAssetMint?: PublicKey;
  tokenGateMint?: PublicKey;
  tokenGateMinBalance?: bigint;
  inviteIssuer?: PublicKey;
  poolType?: number;
}) {
  const poolId = uniqueLabel(params.poolIdPrefix);
  const createTx = protocol.buildCreatePoolV2Tx({
    authority: params.authority.publicKey,
    recentBlockhash: await params.harness.latestBlockhash(),
    poolId,
    organizationRef: params.organizationRef,
    payoutLamportsPerPass: params.payoutLamportsPerPass,
    membershipMode: params.membershipMode,
    tokenGateMint: (params.tokenGateMint ?? ZERO_PUBKEY).toBase58(),
    tokenGateMinBalance: params.tokenGateMinBalance ?? 0n,
    inviteIssuer: (params.inviteIssuer ?? ZERO_PUBKEY).toBase58(),
    metadataUri: `https://pool.local/${poolId}`,
    termsHashHex: createHash("sha256").update(`${poolId}:terms`).digest("hex"),
    payoutPolicyHashHex: createHash("sha256").update(`${poolId}:policy`).digest("hex"),
    payoutAssetMint: (params.payoutAssetMint ?? ZERO_PUBKEY).toBase58(),
    poolType: params.poolType,
  });
  const createResult = await params.harness.send("create_pool_v2", createTx.tx, [params.authority]);
  const setStatusTx = protocol.buildSetPoolStatusTx({
    authority: params.authority.publicKey,
    poolAddress: createTx.poolAddress,
    recentBlockhash: await params.harness.latestBlockhash(),
    status: protocol.POOL_STATUS_ACTIVE,
  });
  const statusResult = await params.harness.send("set_pool_status", setStatusTx, [params.authority]);
  return {
    poolAddress: createTx.poolAddress,
    poolId,
    createResult,
    statusResult,
  };
}

async function createPoolOnly(params: {
  harness: LocalnetHarness;
  authority: Keypair;
  poolIdPrefix: string;
  organizationRef: string;
  payoutLamportsPerPass: bigint;
  membershipMode: number;
  payoutAssetMint?: PublicKey;
  tokenGateMint?: PublicKey;
  tokenGateMinBalance?: bigint;
  inviteIssuer?: PublicKey;
  poolType?: number;
}) {
  const poolId = uniqueLabel(params.poolIdPrefix);
  const createTx = protocol.buildCreatePoolV2Tx({
    authority: params.authority.publicKey,
    recentBlockhash: await params.harness.latestBlockhash(),
    poolId,
    organizationRef: params.organizationRef,
    payoutLamportsPerPass: params.payoutLamportsPerPass,
    membershipMode: params.membershipMode,
    tokenGateMint: (params.tokenGateMint ?? ZERO_PUBKEY).toBase58(),
    tokenGateMinBalance: params.tokenGateMinBalance ?? 0n,
    inviteIssuer: (params.inviteIssuer ?? ZERO_PUBKEY).toBase58(),
    metadataUri: `https://pool.local/${poolId}`,
    termsHashHex: createHash("sha256").update(`${poolId}:terms`).digest("hex"),
    payoutPolicyHashHex: createHash("sha256").update(`${poolId}:policy`).digest("hex"),
    payoutAssetMint: (params.payoutAssetMint ?? ZERO_PUBKEY).toBase58(),
    poolType: params.poolType,
  });
  const createResult = await params.harness.send("create_pool_v2", createTx.tx, [params.authority]);
  return {
    poolAddress: createTx.poolAddress,
    poolId,
    createResult,
  };
}

async function setPoolStatusForScenario(params: {
  harness: LocalnetHarness;
  authority: Keypair;
  poolAddress: PublicKey;
  status: number;
}) {
  const tx = protocol.buildSetPoolStatusTx({
    authority: params.authority.publicKey,
    poolAddress: params.poolAddress,
    recentBlockhash: await params.harness.latestBlockhash(),
    status: params.status,
  });
  return params.harness.send("set_pool_status", tx, [params.authority]);
}

async function approveOracleForPool(params: {
  harness: LocalnetHarness;
  authority: Keypair;
  poolAddress: PublicKey;
  oracle: PublicKey;
}) {
  const tx = protocol.buildSetPoolOracleTx({
    authority: params.authority.publicKey,
    poolAddress: params.poolAddress,
    oracle: params.oracle,
    recentBlockhash: await params.harness.latestBlockhash(),
    active: true,
  });
  return params.harness.send("set_pool_oracle", tx, [params.authority]);
}

async function createPolicySeriesForScenario(params: {
  harness: LocalnetHarness;
  authority: Keypair;
  poolAddress: PublicKey;
  seriesRefHashHex: string;
  status?: number;
  planMode: number;
  sponsorMode?: number;
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
  termsVersion?: number;
  mappingVersion?: number;
}) {
  const tx = protocol.buildCreatePolicySeriesTx({
    authority: params.authority.publicKey,
    poolAddress: params.poolAddress,
    seriesRefHashHex: params.seriesRefHashHex,
    status: params.status ?? protocol.POLICY_SERIES_STATUS_ACTIVE,
    planMode: params.planMode,
    sponsorMode: params.sponsorMode ?? protocol.SPONSOR_MODE_DIRECT,
    displayName: params.displayName,
    metadataUri: params.metadataUri,
    termsHashHex: params.termsHashHex,
    durationSecs: params.durationSecs,
    premiumDueEverySecs: params.premiumDueEverySecs,
    premiumGraceSecs: params.premiumGraceSecs,
    premiumAmount: params.premiumAmount,
    interopProfileHashHex: params.interopProfileHashHex,
    oracleProfileHashHex: params.oracleProfileHashHex,
    riskFamilyHashHex: params.riskFamilyHashHex,
    issuanceTemplateHashHex: params.issuanceTemplateHashHex,
    comparabilityHashHex: params.comparabilityHashHex,
    renewalOfHashHex: params.renewalOfHashHex,
    termsVersion: params.termsVersion ?? 1,
    mappingVersion: params.mappingVersion ?? 1,
    recentBlockhash: await params.harness.latestBlockhash(),
  });
  return params.harness.send("create_policy_series", tx, [params.authority]);
}

async function upsertPolicySeriesPaymentOptionForScenario(params: {
  harness: LocalnetHarness;
  authority: Keypair;
  poolAddress: PublicKey;
  seriesRefHashHex: string;
  paymentMint: PublicKey;
  paymentAmount: bigint;
  active?: boolean;
}) {
  const tx = protocol.buildUpsertPolicySeriesPaymentOptionTx({
    authority: params.authority.publicKey,
    poolAddress: params.poolAddress,
    seriesRefHashHex: params.seriesRefHashHex,
    paymentMint: params.paymentMint,
    paymentAmount: params.paymentAmount,
    active: params.active ?? true,
    recentBlockhash: await params.harness.latestBlockhash(),
  });
  return params.harness.send("upsert_policy_series_payment_option", tx, [params.authority]);
}

async function scenarioProtocolGovernanceOracleLifecycle(harness: LocalnetHarness, state: GlobalState) {
  const scenario = harness.beginScenario("protocol-governance-oracle-lifecycle");
  try {
    await ensureMainOracleReady(harness, state, scenario);
  } finally {
    scenario.finish();
  }
}

async function scenarioLegacyRegistryCompatibility(harness: LocalnetHarness, state: GlobalState) {
  const scenario = harness.beginScenario("legacy-registry-compatibility");
  try {
    await ensureProtocolBootstrapped(harness, state);
    const legacyPool = await createPool({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "legacy",
      organizationRef: "legacy-org",
      payoutLamportsPerPass: 1_000_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
    });
    scenario.recordSuccess(legacyPool.createResult);
    scenario.recordSuccess(legacyPool.statusResult);

    const legacyOracleEntry = protocol.deriveOraclePda({
      programId: harness.programId,
      oracle: state.legacyOracle.publicKey,
    });
    const legacyOracleBefore = await harness.snapshotAccount(legacyOracleEntry);
    const registerLegacyTx = protocol.buildRegisterOracleTx({
      oracle: state.legacyOracle.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      metadataUri: "https://legacy.oracle.local/metadata",
    });
    const legacyRegisterResult = await harness.send(
      "register_oracle",
      registerLegacyTx,
      [state.legacyOracle],
    );
    scenario.recordSuccess(legacyRegisterResult);
    assertChanged(legacyOracleBefore, await harness.snapshotAccount(legacyOracleEntry), "register_oracle");

    const poolOracleApproval = protocol.derivePoolOraclePda({
      programId: harness.programId,
      poolAddress: legacyPool.poolAddress,
      oracle: state.legacyOracle.publicKey,
    });
    const approvalBefore = await harness.snapshotAccount(poolOracleApproval);
    const setLegacyPoolOracleTx = protocol.buildSetPoolOracleTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: legacyPool.poolAddress,
      oracle: state.legacyOracle.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      active: true,
    });
    const approvalResult = await harness.send(
      "set_pool_oracle",
      setLegacyPoolOracleTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(approvalResult);
    assertChanged(approvalBefore, await harness.snapshotAccount(poolOracleApproval), "set_pool_oracle");

    const legacySchemaKeyHashHex = String(process.env.OMEGAX_E2E_LEGACY_SCHEMA_KEY_HASH_HEX ?? "").trim().toLowerCase();
    const legacySchemaAddressRaw = String(process.env.OMEGAX_E2E_LEGACY_SCHEMA_ADDRESS ?? "").trim();
    assert.ok(legacySchemaKeyHashHex, "OMEGAX_E2E_LEGACY_SCHEMA_KEY_HASH_HEX must be set by the localnet runner");
    assert.ok(legacySchemaAddressRaw, "OMEGAX_E2E_LEGACY_SCHEMA_ADDRESS must be set by the localnet runner");
    const legacySchemaAddress = new PublicKey(legacySchemaAddressRaw);
    const legacySchemaDependencyAddress = protocol.deriveSchemaDependencyPda({
      programId: harness.programId,
      schemaKeyHash: Buffer.from(legacySchemaKeyHashHex, "hex"),
    });

    const legacySchemaState = await decodeSchema(harness.connection, legacySchemaAddress);
    assert.equal(legacySchemaState.schemaKeyHashHex, legacySchemaKeyHashHex);
    assert.equal(legacySchemaState.verified, false);
    assert.equal((await harness.snapshotAccount(legacySchemaDependencyAddress)).exists, false);

    const dependencyBefore = await harness.snapshotAccount(legacySchemaDependencyAddress);
    const backfillTx = protocol.buildBackfillSchemaDependencyLedgerTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex: legacySchemaKeyHashHex,
    });
    const backfillResult = await harness.send(
      "backfill_schema_dependency_ledger",
      backfillTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(backfillResult);
    assertChanged(
      dependencyBefore,
      await harness.snapshotAccount(legacySchemaDependencyAddress),
      "backfill_schema_dependency_ledger",
    );
    const dependencyState = await decodeSchemaDependency(harness.connection, legacySchemaDependencyAddress);
    assert.equal(dependencyState.schemaKeyHashHex, legacySchemaKeyHashHex);
    assert.equal(dependencyState.activeRuleRefcount, 0);

    const closeSchemaBefore = await harness.snapshotAccount(legacySchemaAddress);
    const closeDependencyBefore = await harness.snapshotAccount(legacySchemaDependencyAddress);
    const closeLegacySchemaTx = protocol.buildCloseOutcomeSchemaTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      recipientSystemAccount: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex: legacySchemaKeyHashHex,
    });
    const closeLegacySchemaResult = await harness.send(
      "close_outcome_schema",
      closeLegacySchemaTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(closeLegacySchemaResult);
    assertChanged(closeSchemaBefore, await harness.snapshotAccount(legacySchemaAddress), "close_outcome_schema legacy");
    assertChanged(
      closeDependencyBefore,
      await harness.snapshotAccount(legacySchemaDependencyAddress),
      "close_outcome_schema legacy dependency",
    );
    assert.equal((await harness.snapshotAccount(legacySchemaAddress)).exists, false);
    assert.equal((await harness.snapshotAccount(legacySchemaDependencyAddress)).exists, false);
  } finally {
    scenario.finish();
  }
}

async function scenarioPoolSchemaMemberLifecycle(harness: LocalnetHarness, state: GlobalState) {
  const scenario = harness.beginScenario("pool-schema-member-lifecycle");
  try {
    await ensureMainOracleReady(harness, state);

    const payoutMint = await harness.createMint(state.governanceAuthority, 6);
    const payoutAuthorityTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.governanceAuthority.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: payoutMint,
      destination: payoutAuthorityTokenAccount,
      authority: state.governanceAuthority,
      amount: 9_000_000n,
    });

    const tokenGateMint = await harness.createMint(state.governanceAuthority, 0);
    const tokenGateAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: tokenGateMint,
        owner: state.tokenMember.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: tokenGateMint,
      destination: tokenGateAccount,
      authority: state.governanceAuthority,
      amount: 5n,
    });

    const mainPool = await createPoolOnly({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "surface-main",
      organizationRef: "surface-main-org",
      payoutLamportsPerPass: 250_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: payoutMint,
      poolType: protocol.POOL_TYPE_COVERAGE,
    });
    scenario.recordSuccess(mainPool.createResult);

    const mainPoolState = await decodePool(harness.connection, mainPool.poolAddress);
    assert.equal(mainPoolState.authority, state.governanceAuthority.publicKey.toBase58());
    assert.equal(mainPoolState.membershipMode, protocol.MEMBERSHIP_MODE_OPEN);

    const poolBeforeDraft = await harness.snapshotAccount(mainPool.poolAddress);
    const draftResult = await setPoolStatusForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: mainPool.poolAddress,
      status: protocol.POOL_STATUS_DRAFT,
    });
    scenario.recordSuccess(draftResult);
    assertChanged(poolBeforeDraft, await harness.snapshotAccount(mainPool.poolAddress), "set_pool_status draft");
    assert.equal(
      (await decodePool(harness.connection, mainPool.poolAddress)).status,
      protocol.POOL_STATUS_DRAFT,
    );

    const poolBeforeActive = await harness.snapshotAccount(mainPool.poolAddress);
    const activeResult = await setPoolStatusForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: mainPool.poolAddress,
      status: protocol.POOL_STATUS_ACTIVE,
    });
    scenario.recordSuccess(activeResult);
    assertChanged(poolBeforeActive, await harness.snapshotAccount(mainPool.poolAddress), "set_pool_status active");
    assert.equal(
      (await decodePool(harness.connection, mainPool.poolAddress)).status,
      protocol.POOL_STATUS_ACTIVE,
    );

    const controlAuthorityAddress = protocol.derivePoolControlAuthorityPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
    });
    const controlBefore = await harness.snapshotAccount(controlAuthorityAddress);
    const controlTx = protocol.buildSetPoolControlAuthoritiesTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      operatorAuthority: state.operator.publicKey,
      riskManagerAuthority: state.riskManager.publicKey,
      complianceAuthority: state.complianceAuthority.publicKey,
      guardianAuthority: state.guardianAuthority.publicKey,
    });
    const controlResult = await harness.send(
      "set_pool_control_authorities",
      controlTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(controlResult);
    assertChanged(
      controlBefore,
      await harness.snapshotAccount(controlAuthorityAddress),
      "set_pool_control_authorities",
    );
    const controlState = await decodePoolControlAuthority(harness.connection, controlAuthorityAddress);
    assert.equal(controlState.operatorAuthority, state.operator.publicKey.toBase58());
    assert.equal(controlState.riskManagerAuthority, state.riskManager.publicKey.toBase58());
    assert.equal(controlState.complianceAuthority, state.complianceAuthority.publicKey.toBase58());
    assert.equal(controlState.guardianAuthority, state.guardianAuthority.publicKey.toBase58());

    const oraclePolicyAddress = protocol.derivePoolOraclePolicyPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
    });
    const oraclePolicyBefore = await harness.snapshotAccount(oraclePolicyAddress);
    const oraclePolicyTx = protocol.buildSetPoolOraclePolicyTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      quorumM: 1,
      quorumN: 1,
      requireVerifiedSchema: true,
      oracleFeeBps: 12,
      allowDelegateClaim: true,
      challengeWindowSecs: 120n,
    });
    const oraclePolicyResult = await harness.send(
      "set_pool_oracle_policy",
      oraclePolicyTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(oraclePolicyResult);
    assertChanged(
      oraclePolicyBefore,
      await harness.snapshotAccount(oraclePolicyAddress),
      "set_pool_oracle_policy",
    );
    const oraclePolicyState = await decodePoolOraclePolicy(harness.connection, oraclePolicyAddress);
    assert.equal(oraclePolicyState.oracleFeeBps, 12);
    assert.equal(oraclePolicyState.challengeWindowSecs, 120n);

    const poolApprovalResult = await approveOracleForPool({
      harness,
      authority: state.governanceAuthority,
      poolAddress: mainPool.poolAddress,
      oracle: state.oracle.publicKey,
    });
    scenario.recordSuccess(poolApprovalResult);

    const poolOraclePermissionsAddress = protocol.derivePoolOraclePermissionsPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
      oracle: state.oracle.publicKey,
    });
    const oraclePermissionsBefore = await harness.snapshotAccount(poolOraclePermissionsAddress);
    const oraclePermissionsTx = protocol.buildSetPoolOraclePermissionsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      oracle: state.oracle.publicKey,
      permissions: ORACLE_PERMISSION_ALL,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const oraclePermissionsResult = await harness.send(
      "set_pool_oracle_permissions",
      oraclePermissionsTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(oraclePermissionsResult);
    assertChanged(
      oraclePermissionsBefore,
      await harness.snapshotAccount(poolOraclePermissionsAddress),
      "set_pool_oracle_permissions",
    );
    assert.equal(
      (await decodePoolOraclePermissions(harness.connection, poolOraclePermissionsAddress)).permissions,
      ORACLE_PERMISSION_ALL,
    );

    const poolReserveAddress = protocol.derivePoolTreasuryReservePda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
      paymentMint: payoutMint,
    });
    const reserveBefore = await harness.snapshotAccount(poolReserveAddress);
    const reserveTx = protocol.buildSetPoolCoverageReserveFloorTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      paymentMint: payoutMint,
      amount: 1_250n,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const reserveResult = await harness.send(
      "set_pool_coverage_reserve_floor",
      reserveTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(reserveResult);
    assertChanged(
      reserveBefore,
      await harness.snapshotAccount(poolReserveAddress),
      "set_pool_coverage_reserve_floor",
    );
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, poolReserveAddress)).manualCoverageReserveAmount,
      1_250n,
    );

    const poolRiskAddress = protocol.derivePoolRiskConfigPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
    });
    const riskBefore = await harness.snapshotAccount(poolRiskAddress);
    const riskTx = protocol.buildSetPoolRiskControlsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      payoutMint,
      recentBlockhash: await harness.latestBlockhash(),
      redemptionMode: protocol.POOL_REDEMPTION_MODE_OPEN,
      claimMode: protocol.POOL_CLAIM_MODE_OPEN,
      impaired: true,
      impairmentAmount: 250n,
    });
    const riskResult = await harness.send("set_pool_risk_controls", riskTx, [state.governanceAuthority]);
    scenario.recordSuccess(riskResult);
    assertChanged(riskBefore, await harness.snapshotAccount(poolRiskAddress), "set_pool_risk_controls");
    const riskState = await decodePoolRiskConfig(harness.connection, poolRiskAddress);
    assert.equal(riskState.redemptionMode, protocol.POOL_REDEMPTION_MODE_OPEN);
    assert.equal(riskState.claimMode, protocol.POOL_CLAIM_MODE_OPEN);
    assert.equal(riskState.impaired, true);

    const seriesRefHashHex = createHash("sha256").update(`${mainPool.poolId}:series`).digest("hex");
    const policySeriesAddress = protocol.derivePolicySeriesPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
      seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
    });
    const policySeriesBefore = await harness.snapshotAccount(policySeriesAddress);
    const createPolicySeriesTx = protocol.buildCreatePolicySeriesTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      seriesRefHashHex,
      status: protocol.POLICY_SERIES_STATUS_ACTIVE,
      planMode: protocol.PLAN_MODE_REWARD,
      sponsorMode: protocol.SPONSOR_MODE_DIRECT,
      displayName: "Surface Reward Series",
      metadataUri: "https://surface.local/policy-series",
      termsHashHex: createHash("sha256").update("surface-series-terms").digest("hex"),
      durationSecs: 7_200n,
      premiumDueEverySecs: 600n,
      premiumGraceSecs: 300n,
      premiumAmount: 1_500n,
      interopProfileHashHex: createHash("sha256").update("interop-profile").digest("hex"),
      oracleProfileHashHex: createHash("sha256").update("oracle-profile").digest("hex"),
      riskFamilyHashHex: createHash("sha256").update("risk-family").digest("hex"),
      issuanceTemplateHashHex: createHash("sha256").update("issuance-template").digest("hex"),
      comparabilityHashHex: createHash("sha256").update("comparability").digest("hex"),
      renewalOfHashHex: createHash("sha256").update("renewal-of").digest("hex"),
      termsVersion: 2,
      mappingVersion: 1,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const createPolicySeriesResult = await harness.send(
      "create_policy_series",
      createPolicySeriesTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(createPolicySeriesResult);
    assertChanged(
      policySeriesBefore,
      await harness.snapshotAccount(policySeriesAddress),
      "create_policy_series",
    );
    const policySeriesState = await decodePolicySeries(harness.connection, policySeriesAddress);
    assert.equal(policySeriesState.seriesRefHashHex, seriesRefHashHex);
    assert.equal(policySeriesState.planMode, protocol.PLAN_MODE_REWARD);

    const compliancePolicyAddress = protocol.derivePoolCompliancePolicyPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
    });
    const complianceBefore = await harness.snapshotAccount(compliancePolicyAddress);
    const complianceTx = protocol.buildSetPoolCompliancePolicyTx({
      authority: state.complianceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      providerRefHashHex: createHash("sha256").update("provider-ref").digest("hex"),
      credentialTypeHashHex: createHash("sha256").update("credential-type").digest("hex"),
      revocationListHashHex: createHash("sha256").update("revocations").digest("hex"),
      actionsMask:
        protocol.COMPLIANCE_ACTION_ENROLL
        | protocol.COMPLIANCE_ACTION_DEPOSIT
        | protocol.COMPLIANCE_ACTION_REDEEM
        | protocol.COMPLIANCE_ACTION_CLAIM
        | protocol.COMPLIANCE_ACTION_PAYOUT,
      bindingMode: protocol.COMPLIANCE_BINDING_MODE_NONE,
      providerMode: protocol.COMPLIANCE_PROVIDER_MODE_NATIVE,
      capitalRailMode: protocol.RAIL_MODE_ANY,
      payoutRailMode: protocol.RAIL_MODE_ANY,
      active: true,
      includePoolControlAuthority: true,
    });
    const complianceResult = await harness.send(
      "set_pool_compliance_policy",
      complianceTx,
      [state.complianceAuthority],
    );
    scenario.recordSuccess(complianceResult);
    assertChanged(
      complianceBefore,
      await harness.snapshotAccount(compliancePolicyAddress),
      "set_pool_compliance_policy",
    );
    const complianceState = await decodePoolCompliancePolicy(harness.connection, compliancePolicyAddress);
    assert.equal(complianceState.bindingMode, protocol.COMPLIANCE_BINDING_MODE_NONE);
    assert.equal(complianceState.active, true);

    const automationPolicyAddress = protocol.derivePoolAutomationPolicyPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
    });
    const automationBefore = await harness.snapshotAccount(automationPolicyAddress);
    const automationTx = protocol.buildSetPoolAutomationPolicyTx({
      authority: state.complianceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      oracleAutomationMode: protocol.AUTOMATION_MODE_ATTESTED,
      claimAutomationMode: protocol.AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
      allowedAiRolesMask: protocol.AI_ROLE_ALL_MASK,
      maxAutoClaimAmount: 50_000n,
      requiredAttestationProviderRefHashHex: createHash("sha256").update("attestation-provider").digest("hex"),
      includePoolControlAuthority: true,
    });
    const automationResult = await harness.send(
      "set_pool_automation_policy",
      automationTx,
      [state.complianceAuthority],
    );
    scenario.recordSuccess(automationResult);
    assertChanged(
      automationBefore,
      await harness.snapshotAccount(automationPolicyAddress),
      "set_pool_automation_policy",
    );
    assert.equal(
      (await decodePoolAutomationPolicy(harness.connection, automationPolicyAddress)).claimAutomationMode,
      protocol.AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
    );

    const poolTermsAddress = protocol.derivePoolTermsPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
    });
    const poolTermsBefore = await harness.snapshotAccount(poolTermsAddress);
    const termsHashHex = createHash("sha256").update("updated-terms").digest("hex");
    const payoutPolicyHashHex = createHash("sha256").update("updated-payout-policy").digest("hex");
    const termsTx = protocol.buildSetPoolTermsHashTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      termsHashHex,
      payoutPolicyHashHex,
      cycleMode: 1,
      metadataUri: "https://pool.local/updated-terms",
    });
    const termsResult = await harness.send("set_pool_terms_hash", termsTx, [state.governanceAuthority]);
    scenario.recordSuccess(termsResult);
    assertChanged(poolTermsBefore, await harness.snapshotAccount(poolTermsAddress), "set_pool_terms_hash");
    const poolTermsState = await decodePoolTerms(harness.connection, poolTermsAddress);
    assert.equal(poolTermsState.termsHashHex, termsHashHex);
    assert.equal(poolTermsState.payoutPolicyHashHex, payoutPolicyHashHex);
    assert.equal(poolTermsState.payoutAssetMint, payoutMint.toBase58());

    const schemaKeyHashHex = createHash("sha256").update("surface-schema-key").digest("hex");
    const schemaAddress = protocol.deriveSchemaPda({
      programId: harness.programId,
      schemaKeyHash: Buffer.from(schemaKeyHashHex, "hex"),
    });
    const schemaBefore = await harness.snapshotAccount(schemaAddress);
    const registerSchemaTx = protocol.buildRegisterOutcomeSchemaTx({
      publisher: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex,
      schemaKey: "s",
      version: 1,
      schemaHashHex: createHash("sha256").update("surface-schema-hash").digest("hex"),
      schemaFamily: protocol.SCHEMA_FAMILY_KERNEL,
      visibility: protocol.SCHEMA_VISIBILITY_PUBLIC,
      interopProfileHashHex: createHash("sha256").update("schema-interop").digest("hex"),
      codeSystemFamilyHashHex: createHash("sha256").update("schema-codes").digest("hex"),
      mappingVersion: 2,
      metadataUri: "s",
    });
    const registerSchemaResult = await harness.send(
      "register_outcome_schema",
      registerSchemaTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(registerSchemaResult);
    assertChanged(
      schemaBefore,
      await harness.snapshotAccount(schemaAddress),
      "register_outcome_schema",
    );

    const verifySchemaBefore = await harness.snapshotAccount(schemaAddress);
    const verifySchemaTx = protocol.buildVerifyOutcomeSchemaTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex,
      verified: true,
    });
    const verifySchemaResult = await harness.send(
      "verify_outcome_schema",
      verifySchemaTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(verifySchemaResult);
    assertChanged(verifySchemaBefore, await harness.snapshotAccount(schemaAddress), "verify_outcome_schema true");
    assert.equal((await decodeSchema(harness.connection, schemaAddress)).verified, true);

    const ruleHashHex = createHash("sha256").update("surface-rule").digest("hex");
    const poolRuleAddress = protocol.derivePoolRulePda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
      seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
      ruleHash: Buffer.from(ruleHashHex, "hex"),
    });
    const ruleBefore = await harness.snapshotAccount(poolRuleAddress);
    const payoutHashHex = createHash("sha256").update("surface-payout").digest("hex");
    const ruleTx = protocol.buildSetPolicySeriesOutcomeRuleTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      seriesRefHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      ruleHashHex,
      schemaKeyHashHex,
      ruleId: "surface.rule",
      schemaKey: "s",
      schemaVersion: 1,
      interopProfileHashHex: createHash("sha256").update("schema-interop").digest("hex"),
      codeSystemFamilyHashHex: createHash("sha256").update("schema-codes").digest("hex"),
      mappingVersion: 2,
      payoutHashHex,
      enabled: true,
    });
    const ruleResult = await harness.send(
      "set_policy_series_outcome_rule",
      ruleTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(ruleResult);
    assertChanged(
      ruleBefore,
      await harness.snapshotAccount(poolRuleAddress),
      "set_policy_series_outcome_rule",
    );
    const ruleState = await decodeRule(harness.connection, poolRuleAddress);
    assert.equal(ruleState.ruleHashHex, ruleHashHex);
    assert.equal(ruleState.enabled, true);
    assert.equal(ruleState.seriesRefHashHex, seriesRefHashHex);

    const unverifyBefore = await harness.snapshotAccount(schemaAddress);
    const unverifySchemaTx = protocol.buildVerifyOutcomeSchemaTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex,
      verified: false,
    });
    const unverifySchemaResult = await harness.send(
      "verify_outcome_schema",
      unverifySchemaTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(unverifySchemaResult);
    assertChanged(unverifyBefore, await harness.snapshotAccount(schemaAddress), "verify_outcome_schema false");
    assert.equal((await decodeSchema(harness.connection, schemaAddress)).verified, false);
    const schemaDependencyAddress = protocol.deriveSchemaDependencyPda({
      programId: harness.programId,
      schemaKeyHash: Buffer.from(schemaKeyHashHex, "hex"),
    });

    const closeSchemaTx = protocol.buildCloseOutcomeSchemaTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      recipientSystemAccount: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex,
    });
    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.SchemaRuleReferencesOutstanding ?? "schema-close-active-rule-reference",
      expectedErrorName: "SchemaRuleReferencesOutstanding",
      tx: closeSchemaTx,
      signers: [state.governanceAuthority],
      unchangedAddresses: [schemaAddress, schemaDependencyAddress],
    });
    scenario.recordFailure(
      COVERED_ERROR_CASES.SchemaRuleReferencesOutstanding ?? "schema-close-active-rule-reference",
    );

    const disableRuleTx = protocol.buildSetPolicySeriesOutcomeRuleTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      seriesRefHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      ruleHashHex,
      schemaKeyHashHex,
      ruleId: "surface.rule",
      schemaKey: "s",
      schemaVersion: 1,
      interopProfileHashHex: createHash("sha256").update("schema-interop").digest("hex"),
      codeSystemFamilyHashHex: createHash("sha256").update("schema-codes").digest("hex"),
      mappingVersion: 2,
      payoutHashHex,
      enabled: false,
    });
    const disableRuleResult = await harness.send(
      "set_policy_series_outcome_rule",
      disableRuleTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(disableRuleResult);
    assert.equal((await decodeRule(harness.connection, poolRuleAddress)).enabled, false);

    const closeSchemaBefore = await harness.snapshotAccount(schemaAddress);
    const closeDependencyBefore = await harness.snapshotAccount(schemaDependencyAddress);
    const closeSchemaSuccessTx = protocol.buildCloseOutcomeSchemaTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      recipientSystemAccount: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex,
    });
    const closeSchemaResult = await harness.send(
      "close_outcome_schema",
      closeSchemaSuccessTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(closeSchemaResult);
    assertChanged(closeSchemaBefore, await harness.snapshotAccount(schemaAddress), "close_outcome_schema schema");
    assertChanged(
      closeDependencyBefore,
      await harness.snapshotAccount(schemaDependencyAddress),
      "close_outcome_schema dependency",
    );
    assert.equal((await harness.snapshotAccount(schemaAddress)).exists, false);
    assert.equal((await harness.snapshotAccount(schemaDependencyAddress)).exists, false);

    const inviteIssuerAddress = protocol.deriveInviteIssuerPda({
      programId: harness.programId,
      issuer: state.guardianAuthority.publicKey,
    });
    const inviteIssuerBefore = await harness.snapshotAccount(inviteIssuerAddress);
    const registerInviteIssuerTx = protocol.buildRegisterInviteIssuerTx({
      issuer: state.guardianAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      organizationRef: "invite-org",
      metadataUri: "https://invite.local/issuer",
      active: true,
    });
    const inviteIssuerResult = await harness.send(
      "register_invite_issuer",
      registerInviteIssuerTx,
      [state.guardianAuthority],
    );
    scenario.recordSuccess(inviteIssuerResult);
    assertChanged(
      inviteIssuerBefore,
      await harness.snapshotAccount(inviteIssuerAddress),
      "register_invite_issuer",
    );
    assert.equal(
      (await decodeInviteIssuer(harness.connection, inviteIssuerAddress)).issuer,
      state.guardianAuthority.publicKey.toBase58(),
    );

    const openMembershipAddress = protocol.deriveMembershipPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
      member: state.openMember.publicKey,
    });
    const openMembershipBefore = await harness.snapshotAccount(openMembershipAddress);
    const enrollOpenTx = protocol.buildEnrollMemberOpenTx({
      member: state.openMember.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      includePoolCompliancePolicy: true,
    });
    const openEnrollResult = await harness.send("enroll_member_open", enrollOpenTx, [state.openMember]);
    scenario.recordSuccess(openEnrollResult);
    assertChanged(
      openMembershipBefore,
      await harness.snapshotAccount(openMembershipAddress),
      "enroll_member_open",
    );
    assert.equal(
      (await decodeMembership(harness.connection, openMembershipAddress)).status,
      protocol.MEMBERSHIP_STATUS_ACTIVE,
    );

    const claimDelegateAddress = protocol.deriveClaimDelegatePda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
      member: state.openMember.publicKey,
    });
    const claimDelegateBefore = await harness.snapshotAccount(claimDelegateAddress);
    const claimDelegateTx = protocol.buildSetClaimDelegateTx({
      member: state.openMember.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      delegate: state.delegate.publicKey,
      active: true,
    });
    const claimDelegateResult = await harness.send("set_claim_delegate", claimDelegateTx, [state.openMember]);
    scenario.recordSuccess(claimDelegateResult);
    assertChanged(
      claimDelegateBefore,
      await harness.snapshotAccount(claimDelegateAddress),
      "set_claim_delegate",
    );

    const tokenGatePool = await createPoolOnly({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "surface-token-gate",
      organizationRef: "surface-token-gate-org",
      payoutLamportsPerPass: 150_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_TOKEN_GATE,
      tokenGateMint,
      tokenGateMinBalance: 1n,
    });
    scenario.recordSuccess(tokenGatePool.createResult);
    const tokenMembershipAddress = protocol.deriveMembershipPda({
      programId: harness.programId,
      poolAddress: tokenGatePool.poolAddress,
      member: state.tokenMember.publicKey,
    });
    const tokenMembershipBefore = await harness.snapshotAccount(tokenMembershipAddress);
    const enrollTokenGateTx = protocol.buildEnrollMemberTokenGateTx({
      member: state.tokenMember.publicKey,
      poolAddress: tokenGatePool.poolAddress,
      tokenGateAccount,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const tokenEnrollResult = await harness.send(
      "enroll_member_token_gate",
      enrollTokenGateTx,
      [state.tokenMember],
    );
    scenario.recordSuccess(tokenEnrollResult);
    assertChanged(
      tokenMembershipBefore,
      await harness.snapshotAccount(tokenMembershipAddress),
      "enroll_member_token_gate",
    );
    assert.equal(
      (await decodeMembership(harness.connection, tokenMembershipAddress)).member,
      state.tokenMember.publicKey.toBase58(),
    );

    const invitePool = await createPoolOnly({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "surface-invite",
      organizationRef: "surface-invite-org",
      payoutLamportsPerPass: 150_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_INVITE_ONLY,
      inviteIssuer: state.guardianAuthority.publicKey,
    });
    scenario.recordSuccess(invitePool.createResult);
    const inviteMembershipAddress = protocol.deriveMembershipPda({
      programId: harness.programId,
      poolAddress: invitePool.poolAddress,
      member: state.inviteMember.publicKey,
    });
    const inviteMembershipBefore = await harness.snapshotAccount(inviteMembershipAddress);
    const enrollInviteTx = protocol.buildEnrollMemberInvitePermitTx({
      member: state.inviteMember.publicKey,
      poolAddress: invitePool.poolAddress,
      issuer: state.guardianAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      nonceHashHex: createHash("sha256").update("invite-nonce").digest("hex"),
      inviteIdHashHex: createHash("sha256").update("invite-id").digest("hex"),
      expiresAtTs: BigInt(Math.floor(Date.now() / 1000) + 3600),
    });
    const inviteEnrollResult = await harness.send(
      "enroll_member_invite_permit",
      enrollInviteTx,
      [state.inviteMember, state.guardianAuthority],
    );
    scenario.recordSuccess(inviteEnrollResult);
    assertChanged(
      inviteMembershipBefore,
      await harness.snapshotAccount(inviteMembershipAddress),
      "enroll_member_invite_permit",
    );
    assert.equal(
      (await decodeMembership(harness.connection, inviteMembershipAddress)).member,
      state.inviteMember.publicKey.toBase58(),
    );

    const fundSolBefore = await harness.snapshotAccount(mainPool.poolAddress);
    const fundSolTx = protocol.buildFundPoolSolTx({
      funder: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      lamports: 400_000n,
    });
    const fundSolResult = await harness.send("fund_pool_sol", fundSolTx, [state.governanceAuthority]);
    scenario.recordSuccess(fundSolResult);
    assertChanged(fundSolBefore, await harness.snapshotAccount(mainPool.poolAddress), "fund_pool_sol");

    const poolAssetVault = protocol.derivePoolAssetVaultPda({
      programId: harness.programId,
      poolAddress: mainPool.poolAddress,
      payoutMint,
    });
    const poolVaultTokenAccount = Keypair.generate();
    const fundSplBefore = await harness.snapshotTokenAccount(poolVaultTokenAccount.publicKey);
    const fundSplTx = protocol.buildFundPoolSplTx({
      funder: state.governanceAuthority.publicKey,
      poolAddress: mainPool.poolAddress,
      payoutMint,
      poolVaultTokenAccount: poolVaultTokenAccount.publicKey,
      poolVaultTokenAccountSigner: true,
      funderTokenAccount: payoutAuthorityTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      amount: 2_000_000n,
    });
    const fundSplResult = await harness.send(
      "fund_pool_spl",
      fundSplTx,
      [state.governanceAuthority, poolVaultTokenAccount],
    );
    scenario.recordSuccess(fundSplResult);
    assertTokenChanged(
      fundSplBefore,
      await harness.snapshotTokenAccount(poolVaultTokenAccount.publicKey),
      "fund_pool_spl",
    );
  } finally {
    scenario.finish();
  }
}

async function scenarioDirectLiquidityLifecycle(harness: LocalnetHarness, state: GlobalState) {
  const scenario = harness.beginScenario("direct-liquidity-lifecycle");
  try {
    await ensureProtocolBootstrapped(harness, state);

    const solPool = await createPoolOnly({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "liq-sol",
      organizationRef: "liq-sol-org",
      payoutLamportsPerPass: 100_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      poolType: protocol.POOL_TYPE_REWARD,
    });
    scenario.recordSuccess(solPool.createResult);

    const solLiquidityConfigAddress = protocol.derivePoolLiquidityConfigPda({
      programId: harness.programId,
      poolAddress: solPool.poolAddress,
    });
    const solShareMint = protocol.derivePoolShareMintPda({
      programId: harness.programId,
      poolAddress: solPool.poolAddress,
    });
    const solAuthorityShareTokenAccount = getAssociatedTokenAddressSync(
      solShareMint,
      state.governanceAuthority.publicKey,
    );
    const solInitBefore = await harness.snapshotAccount(solLiquidityConfigAddress);
    const initializeSolTx = protocol.buildInitializePoolLiquiditySolTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      initialLamports: 2_000_000n,
    });
    const initializeSolResult = await harness.send(
      "initialize_pool_liquidity_sol",
      initializeSolTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(initializeSolResult);
    assertChanged(
      solInitBefore,
      await harness.snapshotAccount(solLiquidityConfigAddress),
      "initialize_pool_liquidity_sol",
    );
    const solLiquidityConfig = await decodePoolLiquidityConfig(harness.connection, solLiquidityConfigAddress);
    assert.equal(solLiquidityConfig.depositsEnabled, true);
    assert.equal(solLiquidityConfig.shareMint, solShareMint.toBase58());

    const disableLiquidityTx = protocol.buildSetPoolLiquidityEnabledTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      enabled: false,
    });
    const disableLiquidityResult = await harness.send(
      "set_pool_liquidity_enabled",
      disableLiquidityTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(disableLiquidityResult);
    assert.equal(
      (await decodePoolLiquidityConfig(harness.connection, solLiquidityConfigAddress)).depositsEnabled,
      false,
    );

    const enableLiquidityTx = protocol.buildSetPoolLiquidityEnabledTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      enabled: true,
    });
    const enableLiquidityResult = await harness.send(
      "set_pool_liquidity_enabled",
      enableLiquidityTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(enableLiquidityResult);
    assert.equal(
      (await decodePoolLiquidityConfig(harness.connection, solLiquidityConfigAddress)).depositsEnabled,
      true,
    );

    const solCapitalClassAddress = protocol.derivePoolCapitalClassPda({
      programId: harness.programId,
      poolAddress: solPool.poolAddress,
      shareMint: solShareMint,
    });
    const solCapitalClassBefore = await harness.snapshotAccount(solCapitalClassAddress);
    const solCapitalClassTx = protocol.buildRegisterPoolCapitalClassTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      classIdHashHex: createHash("sha256").update("sol-capital-class").digest("hex"),
      classMode: protocol.CAPITAL_CLASS_MODE_NAV,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
      restricted: false,
      redemptionQueueEnabled: false,
      ringFenced: false,
      lockupSecs: 0n,
      redemptionNoticeSecs: 0n,
      vintageIndex: 0,
    });
    const solCapitalClassResult = await harness.send(
      "register_pool_capital_class",
      solCapitalClassTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(solCapitalClassResult);
    assertChanged(
      solCapitalClassBefore,
      await harness.snapshotAccount(solCapitalClassAddress),
      "register_pool_capital_class sol",
    );
    assert.equal(
      (await decodePoolCapitalClass(harness.connection, solCapitalClassAddress)).redemptionQueueEnabled,
      false,
    );

    const solDepositorShareTokenAccount = getAssociatedTokenAddressSync(
      solShareMint,
      state.openMember.publicKey,
    );
    const solDepositBefore = await harness.snapshotTokenAccount(solDepositorShareTokenAccount);
    const depositSolTx = protocol.buildDepositPoolLiquiditySolTx({
      depositor: state.openMember.publicKey,
      poolAddress: solPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      amountIn: 500_000n,
      minSharesOut: 1n,
      includePoolCapitalClass: true,
    });
    const depositSolResult = await harness.send(
      "deposit_pool_liquidity_sol",
      depositSolTx,
      [state.openMember],
    );
    scenario.recordSuccess(depositSolResult);
    assertTokenChanged(
      solDepositBefore,
      await harness.snapshotTokenAccount(solDepositorShareTokenAccount),
      "deposit_pool_liquidity_sol",
    );

    const pauseRedemptionsTx = protocol.buildSetPoolRiskControlsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solPool.poolAddress,
      payoutMint: ZERO_PUBKEY,
      recentBlockhash: await harness.latestBlockhash(),
      redemptionMode: protocol.POOL_REDEMPTION_MODE_PAUSED,
      claimMode: protocol.POOL_CLAIM_MODE_OPEN,
      impaired: false,
      impairmentAmount: 0n,
    });
    await harness.send("set_pool_risk_controls", pauseRedemptionsTx, [state.governanceAuthority]);
    const pausedRedeemTx = protocol.buildRedeemPoolLiquiditySolTx({
      redeemer: state.openMember.publicKey,
      poolAddress: solPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      sharesIn: 50_000n,
      minAmountOut: 1n,
      includePoolCapitalClass: true,
    });
    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.PoolRedemptionsPaused ?? "paused-direct-redemption",
      expectedErrorName: "PoolRedemptionsPaused",
      tx: pausedRedeemTx,
      signers: [state.openMember],
      unchangedAddresses: [solPool.poolAddress, solDepositorShareTokenAccount],
    });
    scenario.recordFailure(COVERED_ERROR_CASES.PoolRedemptionsPaused ?? "paused-direct-redemption");
    const reopenRedemptionsTx = protocol.buildSetPoolRiskControlsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solPool.poolAddress,
      payoutMint: ZERO_PUBKEY,
      recentBlockhash: await harness.latestBlockhash(),
      redemptionMode: protocol.POOL_REDEMPTION_MODE_OPEN,
      claimMode: protocol.POOL_CLAIM_MODE_OPEN,
      impaired: false,
      impairmentAmount: 0n,
    });
    await harness.send("set_pool_risk_controls", reopenRedemptionsTx, [state.governanceAuthority]);

    const redeemSolShareBefore = await harness.snapshotTokenAccount(solDepositorShareTokenAccount);
    const redeemSolPoolBefore = await harness.snapshotAccount(solPool.poolAddress);
    const redeemSolTx = protocol.buildRedeemPoolLiquiditySolTx({
      redeemer: state.openMember.publicKey,
      poolAddress: solPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      sharesIn: 150_000n,
      minAmountOut: 1n,
      includePoolCapitalClass: true,
    });
    const redeemSolResult = await harness.send(
      "redeem_pool_liquidity_sol",
      redeemSolTx,
      [state.openMember],
    );
    scenario.recordSuccess(redeemSolResult);
    assertTokenChanged(
      redeemSolShareBefore,
      await harness.snapshotTokenAccount(solDepositorShareTokenAccount),
      "redeem_pool_liquidity_sol shares",
    );
    assertChanged(
      redeemSolPoolBefore,
      await harness.snapshotAccount(solPool.poolAddress),
      "redeem_pool_liquidity_sol pool",
    );

    const splMint = await harness.createMint(state.governanceAuthority, 6);
    const splAuthorityPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: splMint,
        owner: state.governanceAuthority.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: splMint,
      destination: splAuthorityPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 10_000_000n,
    });
    const splDepositorPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: splMint,
        owner: state.alternateMember.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: splMint,
      destination: splDepositorPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 4_000_000n,
    });

    const splPool = await createPoolOnly({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "liq-spl",
      organizationRef: "liq-spl-org",
      payoutLamportsPerPass: 100_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: splMint,
      poolType: protocol.POOL_TYPE_REWARD,
    });
    scenario.recordSuccess(splPool.createResult);

    const splLiquidityConfigAddress = protocol.derivePoolLiquidityConfigPda({
      programId: harness.programId,
      poolAddress: splPool.poolAddress,
    });
    const splShareMint = protocol.derivePoolShareMintPda({
      programId: harness.programId,
      poolAddress: splPool.poolAddress,
    });
    const initializeSplBefore = await harness.snapshotAccount(splLiquidityConfigAddress);
    const initializeSplTx = protocol.buildInitializePoolLiquiditySplTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: splPool.poolAddress,
      payoutMint: splMint,
      authorityPayoutTokenAccount: splAuthorityPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      initialAmount: 2_500_000n,
    });
    const initializeSplResult = await harness.send(
      "initialize_pool_liquidity_spl",
      initializeSplTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(initializeSplResult);
    assertChanged(
      initializeSplBefore,
      await harness.snapshotAccount(splLiquidityConfigAddress),
      "initialize_pool_liquidity_spl",
    );
    assert.equal(
      (await decodePoolLiquidityConfig(harness.connection, splLiquidityConfigAddress)).shareMint,
      splShareMint.toBase58(),
    );

    const splDepositorShareTokenAccount = getAssociatedTokenAddressSync(
      splShareMint,
      state.alternateMember.publicKey,
    );
    const depositSplBefore = await harness.snapshotTokenAccount(splDepositorShareTokenAccount);
    const depositSplPayoutBefore = await harness.snapshotTokenAccount(splDepositorPayoutTokenAccount);
    const depositSplTx = protocol.buildDepositPoolLiquiditySplTx({
      depositor: state.alternateMember.publicKey,
      poolAddress: splPool.poolAddress,
      payoutMint: splMint,
      depositorPayoutTokenAccount: splDepositorPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      amountIn: 1_000_000n,
      minSharesOut: 1n,
    });
    const depositSplResult = await harness.send(
      "deposit_pool_liquidity_spl",
      depositSplTx,
      [state.alternateMember],
    );
    scenario.recordSuccess(depositSplResult);
    assertTokenChanged(
      depositSplBefore,
      await harness.snapshotTokenAccount(splDepositorShareTokenAccount),
      "deposit_pool_liquidity_spl shares",
    );
    assertTokenChanged(
      depositSplPayoutBefore,
      await harness.snapshotTokenAccount(splDepositorPayoutTokenAccount),
      "deposit_pool_liquidity_spl payout",
    );

    const redeemSplShareBefore = await harness.snapshotTokenAccount(splDepositorShareTokenAccount);
    const redeemSplPayoutBefore = await harness.snapshotTokenAccount(splDepositorPayoutTokenAccount);
    const redeemSplTx = protocol.buildRedeemPoolLiquiditySplTx({
      redeemer: state.alternateMember.publicKey,
      poolAddress: splPool.poolAddress,
      payoutMint: splMint,
      redeemerPayoutTokenAccount: splDepositorPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      sharesIn: 250_000n,
      minAmountOut: 1n,
    });
    const redeemSplResult = await harness.send(
      "redeem_pool_liquidity_spl",
      redeemSplTx,
      [state.alternateMember],
    );
    scenario.recordSuccess(redeemSplResult);
    assertTokenChanged(
      redeemSplShareBefore,
      await harness.snapshotTokenAccount(splDepositorShareTokenAccount),
      "redeem_pool_liquidity_spl shares",
    );
    assertTokenChanged(
      redeemSplPayoutBefore,
      await harness.snapshotTokenAccount(splDepositorPayoutTokenAccount),
      "redeem_pool_liquidity_spl payout",
    );
  } finally {
    scenario.finish();
  }
}

async function scenarioQueuedLiquidityLifecycle(harness: LocalnetHarness, state: GlobalState) {
  const scenario = harness.beginScenario("queued-liquidity-lifecycle");
  try {
    await ensureProtocolBootstrapped(harness, state);

    const solQueuePool = await createPoolOnly({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "queue-sol",
      organizationRef: "queue-sol-org",
      payoutLamportsPerPass: 100_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      poolType: protocol.POOL_TYPE_REWARD,
    });
    scenario.recordSuccess(solQueuePool.createResult);

    const solControlTx = protocol.buildSetPoolControlAuthoritiesTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      operatorAuthority: state.operator.publicKey,
      riskManagerAuthority: state.riskManager.publicKey,
      complianceAuthority: state.complianceAuthority.publicKey,
      guardianAuthority: state.guardianAuthority.publicKey,
    });
    await harness.send("set_pool_control_authorities", solControlTx, [state.governanceAuthority]);

    const initializeSolQueueTx = protocol.buildInitializePoolLiquiditySolTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      initialLamports: 2_500_000n,
    });
    await harness.send("initialize_pool_liquidity_sol", initializeSolQueueTx, [state.governanceAuthority]);

    const solQueueShareMint = protocol.derivePoolShareMintPda({
      programId: harness.programId,
      poolAddress: solQueuePool.poolAddress,
    });
    const solQueueCapitalClassTx = protocol.buildRegisterPoolCapitalClassTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: solQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      classIdHashHex: createHash("sha256").update("queue-sol-class").digest("hex"),
      classMode: protocol.CAPITAL_CLASS_MODE_NAV,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
      restricted: false,
      redemptionQueueEnabled: true,
      ringFenced: false,
      lockupSecs: 0n,
      redemptionNoticeSecs: 0n,
      vintageIndex: 0,
    });
    await harness.send("register_pool_capital_class", solQueueCapitalClassTx, [state.governanceAuthority]);

    const solQueueMemberShareTokenAccount = getAssociatedTokenAddressSync(
      solQueueShareMint,
      state.openMember.publicKey,
    );
    const depositSolQueueTx = protocol.buildDepositPoolLiquiditySolTx({
      depositor: state.openMember.publicKey,
      poolAddress: solQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      amountIn: 600_000n,
      minSharesOut: 1n,
      includePoolCapitalClass: true,
    });
    await harness.send("deposit_pool_liquidity_sol", depositSolQueueTx, [state.openMember]);

    const cancelRequestHashHex = createHash("sha256").update("queue-cancel").digest("hex");
    const cancelRequestAddress = protocol.deriveRedemptionRequestPda({
      programId: harness.programId,
      poolAddress: solQueuePool.poolAddress,
      redeemer: state.openMember.publicKey,
      requestHash: Buffer.from(cancelRequestHashHex, "hex"),
    });
    const requestCancelTx = protocol.buildRequestPoolLiquidityRedemptionTx({
      redeemer: state.openMember.publicKey,
      poolAddress: solQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      requestHashHex: cancelRequestHashHex,
      sharesIn: 120_000n,
      minAmountOut: 1n,
      includePoolCapitalClass: true,
    });
    const requestCancelResult = await harness.send(
      "request_pool_liquidity_redemption",
      requestCancelTx,
      [state.openMember],
    );
    scenario.recordSuccess(requestCancelResult);
    assert.equal(
      (await decodeRedemptionRequest(harness.connection, cancelRequestAddress)).status,
      protocol.REDEMPTION_REQUEST_STATUS_PENDING,
    );

    const scheduleCancelTx = protocol.buildSchedulePoolLiquidityRedemptionTx({
      authority: state.riskManager.publicKey,
      poolAddress: solQueuePool.poolAddress,
      redemptionRequest: cancelRequestAddress,
      recentBlockhash: await harness.latestBlockhash(),
      includePoolControlAuthority: true,
    });
    const scheduleCancelResult = await harness.send(
      "schedule_pool_liquidity_redemption",
      scheduleCancelTx,
      [state.riskManager],
    );
    scenario.recordSuccess(scheduleCancelResult);
    assert.equal(
      (await decodeRedemptionRequest(harness.connection, cancelRequestAddress)).status,
      protocol.REDEMPTION_REQUEST_STATUS_SCHEDULED,
    );

    const doubleScheduleTx = protocol.buildSchedulePoolLiquidityRedemptionTx({
      authority: state.riskManager.publicKey,
      poolAddress: solQueuePool.poolAddress,
      redemptionRequest: cancelRequestAddress,
      recentBlockhash: await harness.latestBlockhash(),
      includePoolControlAuthority: true,
    });
    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.InvalidRedemptionRequestState ?? "redemption-invalid-state-double-schedule",
      expectedErrorName: "InvalidRedemptionRequestState",
      tx: doubleScheduleTx,
      signers: [state.riskManager],
      unchangedAddresses: [cancelRequestAddress],
    });
    scenario.recordFailure(
      COVERED_ERROR_CASES.InvalidRedemptionRequestState ?? "redemption-invalid-state-double-schedule",
    );

    const cancelShareBefore = await harness.snapshotTokenAccount(solQueueMemberShareTokenAccount);
    const cancelTx = protocol.buildCancelPoolLiquidityRedemptionTx({
      redeemer: state.openMember.publicKey,
      poolAddress: solQueuePool.poolAddress,
      redemptionRequest: cancelRequestAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const cancelResult = await harness.send(
      "cancel_pool_liquidity_redemption",
      cancelTx,
      [state.openMember],
    );
    scenario.recordSuccess(cancelResult);
    assert.equal(
      (await decodeRedemptionRequest(harness.connection, cancelRequestAddress)).status,
      protocol.REDEMPTION_REQUEST_STATUS_CANCELLED,
    );
    assertTokenChanged(
      cancelShareBefore,
      await harness.snapshotTokenAccount(solQueueMemberShareTokenAccount),
      "cancel_pool_liquidity_redemption",
    );

    const failRequestHashHex = createHash("sha256").update("queue-fail").digest("hex");
    const failRequestAddress = protocol.deriveRedemptionRequestPda({
      programId: harness.programId,
      poolAddress: solQueuePool.poolAddress,
      redeemer: state.openMember.publicKey,
      requestHash: Buffer.from(failRequestHashHex, "hex"),
    });
    const requestFailTx = protocol.buildRequestPoolLiquidityRedemptionTx({
      redeemer: state.openMember.publicKey,
      poolAddress: solQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      requestHashHex: failRequestHashHex,
      sharesIn: 100_000n,
      minAmountOut: 1n,
      includePoolCapitalClass: true,
    });
    await harness.send("request_pool_liquidity_redemption", requestFailTx, [state.openMember]);
    const scheduleFailTx = protocol.buildSchedulePoolLiquidityRedemptionTx({
      authority: state.riskManager.publicKey,
      poolAddress: solQueuePool.poolAddress,
      redemptionRequest: failRequestAddress,
      recentBlockhash: await harness.latestBlockhash(),
      includePoolControlAuthority: true,
    });
    await harness.send("schedule_pool_liquidity_redemption", scheduleFailTx, [state.riskManager]);
    const failTx = protocol.buildFailPoolLiquidityRedemptionTx({
      authority: state.riskManager.publicKey,
      poolAddress: solQueuePool.poolAddress,
      redemptionRequest: failRequestAddress,
      redeemer: state.openMember.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      failureCode: 77,
      includePoolControlAuthority: true,
    });
    const failResult = await harness.send("fail_pool_liquidity_redemption", failTx, [state.riskManager]);
    scenario.recordSuccess(failResult);
    const failedRequest = await decodeRedemptionRequest(harness.connection, failRequestAddress);
    assert.equal(failedRequest.status, protocol.REDEMPTION_REQUEST_STATUS_FAILED);
    assert.equal(failedRequest.failureCode, 77);

    const fulfillRequestHashHex = createHash("sha256").update("queue-fulfill-sol").digest("hex");
    const fulfillRequestAddress = protocol.deriveRedemptionRequestPda({
      programId: harness.programId,
      poolAddress: solQueuePool.poolAddress,
      redeemer: state.openMember.publicKey,
      requestHash: Buffer.from(fulfillRequestHashHex, "hex"),
    });
    const requestFulfillTx = protocol.buildRequestPoolLiquidityRedemptionTx({
      redeemer: state.openMember.publicKey,
      poolAddress: solQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      requestHashHex: fulfillRequestHashHex,
      sharesIn: 80_000n,
      minAmountOut: 1n,
      includePoolCapitalClass: true,
    });
    await harness.send("request_pool_liquidity_redemption", requestFulfillTx, [state.openMember]);
    const fulfillShareEscrow = getAssociatedTokenAddressSync(
      solQueueShareMint,
      fulfillRequestAddress,
      true,
    );
    const fulfillShareBefore = await harness.snapshotTokenAccount(fulfillShareEscrow);
    const fulfillSolTx = protocol.buildFulfillPoolLiquidityRedemptionSolTx({
      authority: state.riskManager.publicKey,
      poolAddress: solQueuePool.poolAddress,
      redemptionRequest: fulfillRequestAddress,
      redeemerSystemAccount: state.openMember.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      includePoolControlAuthority: true,
    });
    const fulfillSolResult = await harness.send(
      "fulfill_pool_liquidity_redemption_sol",
      fulfillSolTx,
      [state.riskManager],
    );
    scenario.recordSuccess(fulfillSolResult);
    assert.equal(
      (await decodeRedemptionRequest(harness.connection, fulfillRequestAddress)).status,
      protocol.REDEMPTION_REQUEST_STATUS_FULFILLED,
    );
    assertTokenChanged(
      fulfillShareBefore,
      await harness.snapshotTokenAccount(fulfillShareEscrow),
      "fulfill_pool_liquidity_redemption_sol escrow",
    );

    const splQueueMint = await harness.createMint(state.governanceAuthority, 6);
    const splQueueAuthorityPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: splQueueMint,
        owner: state.governanceAuthority.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: splQueueMint,
      destination: splQueueAuthorityPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 9_000_000n,
    });
    const splQueueMemberPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: splQueueMint,
        owner: state.alternateMember.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: splQueueMint,
      destination: splQueueMemberPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 3_000_000n,
    });

    const splQueuePool = await createPoolOnly({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "queue-spl",
      organizationRef: "queue-spl-org",
      payoutLamportsPerPass: 100_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: splQueueMint,
      poolType: protocol.POOL_TYPE_REWARD,
    });
    scenario.recordSuccess(splQueuePool.createResult);

    const splControlTx = protocol.buildSetPoolControlAuthoritiesTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: splQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      operatorAuthority: state.operator.publicKey,
      riskManagerAuthority: state.riskManager.publicKey,
      complianceAuthority: state.complianceAuthority.publicKey,
      guardianAuthority: state.guardianAuthority.publicKey,
    });
    await harness.send("set_pool_control_authorities", splControlTx, [state.governanceAuthority]);

    const initializeSplQueueTx = protocol.buildInitializePoolLiquiditySplTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: splQueuePool.poolAddress,
      payoutMint: splQueueMint,
      authorityPayoutTokenAccount: splQueueAuthorityPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      initialAmount: 2_000_000n,
    });
    await harness.send("initialize_pool_liquidity_spl", initializeSplQueueTx, [state.governanceAuthority]);

    const splQueueShareMint = protocol.derivePoolShareMintPda({
      programId: harness.programId,
      poolAddress: splQueuePool.poolAddress,
    });
    const splQueueCapitalClassTx = protocol.buildRegisterPoolCapitalClassTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: splQueuePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      classIdHashHex: createHash("sha256").update("queue-spl-class").digest("hex"),
      classMode: protocol.CAPITAL_CLASS_MODE_NAV,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
      restricted: false,
      redemptionQueueEnabled: true,
      ringFenced: false,
      lockupSecs: 0n,
      redemptionNoticeSecs: 0n,
      vintageIndex: 0,
    });
    await harness.send("register_pool_capital_class", splQueueCapitalClassTx, [state.governanceAuthority]);

    const splQueueMemberShareTokenAccount = getAssociatedTokenAddressSync(
      splQueueShareMint,
      state.alternateMember.publicKey,
    );
    const depositSplQueueTx = protocol.buildDepositPoolLiquiditySplTx({
      depositor: state.alternateMember.publicKey,
      poolAddress: splQueuePool.poolAddress,
      payoutMint: splQueueMint,
      depositorPayoutTokenAccount: splQueueMemberPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      amountIn: 800_000n,
      minSharesOut: 1n,
      includePoolCapitalClass: true,
    });
    await harness.send("deposit_pool_liquidity_spl", depositSplQueueTx, [state.alternateMember]);

    const splRequestHashHex = createHash("sha256").update("queue-fulfill-spl").digest("hex");
    const splRequestAddress = protocol.deriveRedemptionRequestPda({
      programId: harness.programId,
      poolAddress: splQueuePool.poolAddress,
      redeemer: state.alternateMember.publicKey,
      requestHash: Buffer.from(splRequestHashHex, "hex"),
    });
    const requestSplTx = protocol.buildRequestPoolLiquidityRedemptionTx({
      redeemer: state.alternateMember.publicKey,
      poolAddress: splQueuePool.poolAddress,
      payoutMint: splQueueMint,
      recentBlockhash: await harness.latestBlockhash(),
      requestHashHex: splRequestHashHex,
      sharesIn: 120_000n,
      minAmountOut: 1n,
      includePoolCapitalClass: true,
    });
    await harness.send("request_pool_liquidity_redemption", requestSplTx, [state.alternateMember]);
    const scheduleSplTx = protocol.buildSchedulePoolLiquidityRedemptionTx({
      authority: state.riskManager.publicKey,
      poolAddress: splQueuePool.poolAddress,
      redemptionRequest: splRequestAddress,
      recentBlockhash: await harness.latestBlockhash(),
      includePoolControlAuthority: true,
    });
    await harness.send("schedule_pool_liquidity_redemption", scheduleSplTx, [state.riskManager]);
    const fulfillSplPayoutBefore = await harness.snapshotTokenAccount(splQueueMemberPayoutTokenAccount);
    const fulfillSplTx = protocol.buildFulfillPoolLiquidityRedemptionSplTx({
      authority: state.riskManager.publicKey,
      poolAddress: splQueuePool.poolAddress,
      payoutMint: splQueueMint,
      redemptionRequest: splRequestAddress,
      redeemerPayoutTokenAccount: splQueueMemberPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      includePoolControlAuthority: true,
    });
    const fulfillSplResult = await harness.send(
      "fulfill_pool_liquidity_redemption_spl",
      fulfillSplTx,
      [state.riskManager],
    );
    scenario.recordSuccess(fulfillSplResult);
    assert.equal(
      (await decodeRedemptionRequest(harness.connection, splRequestAddress)).status,
      protocol.REDEMPTION_REQUEST_STATUS_FULFILLED,
    );
    assertTokenChanged(
      fulfillSplPayoutBefore,
      await harness.snapshotTokenAccount(splQueueMemberPayoutTokenAccount),
      "fulfill_pool_liquidity_redemption_spl payout",
    );
  } finally {
    scenario.finish();
  }
}

async function scenarioRewardAttestationDisputeLifecycle(
  harness: LocalnetHarness,
  state: GlobalState,
) {
  const scenario = harness.beginScenario("reward-attestation-dispute-lifecycle");
  try {
    await ensureMainOracleReady(harness, state);

    const secondOracle = await fundedSigner(harness);
    const secondOracleRegisterTx = protocol.buildRegisterOracleTx({
      oracle: secondOracle.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      metadataUri: "https://oracle.local/reward-secondary",
    });
    await harness.send("register_oracle", secondOracleRegisterTx, [secondOracle]);

    const payoutMint = await harness.createMint(state.governanceAuthority, 6);
    const governancePayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.governanceAuthority.publicKey,
      })
    ).address;
    const memberPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.openMember.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: payoutMint,
      destination: governancePayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 12_000_000n,
    });

    const rewardPool = await createPool({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "reward-attest",
      organizationRef: "reward-attest-org",
      payoutLamportsPerPass: 400_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: payoutMint,
      poolType: protocol.POOL_TYPE_REWARD,
    });
    scenario.recordSuccess(rewardPool.createResult);
    scenario.recordSuccess(rewardPool.statusResult);

    await harness.send(
      "set_pool_control_authorities",
      protocol.buildSetPoolControlAuthoritiesTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: rewardPool.poolAddress,
        operatorAuthority: state.operator.publicKey,
        riskManagerAuthority: state.riskManager.publicKey,
        complianceAuthority: state.complianceAuthority.publicKey,
        guardianAuthority: state.guardianAuthority.publicKey,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    await harness.send(
      "set_pool_compliance_policy",
      protocol.buildSetPoolCompliancePolicyTx({
        authority: state.complianceAuthority.publicKey,
        poolAddress: rewardPool.poolAddress,
        recentBlockhash: await harness.latestBlockhash(),
        providerRefHashHex: harness.sha256Hex("reward-compliance-provider"),
        credentialTypeHashHex: harness.sha256Hex("reward-compliance-credential"),
        revocationListHashHex: harness.sha256Hex("reward-compliance-revocations"),
        actionsMask: protocol.COMPLIANCE_ACTION_PAYOUT,
        bindingMode: protocol.COMPLIANCE_BINDING_MODE_NONE,
        providerMode: protocol.COMPLIANCE_PROVIDER_MODE_NATIVE,
        capitalRailMode: protocol.RAIL_MODE_ANY,
        payoutRailMode: protocol.RAIL_MODE_ANY,
        active: true,
        includePoolControlAuthority: true,
      }),
      [state.complianceAuthority],
    );

    const oraclePolicyAddress = protocol.derivePoolOraclePolicyPda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
    });
    const policyBefore = await harness.snapshotAccount(oraclePolicyAddress);
    const oraclePolicyTx = protocol.buildSetPoolOraclePolicyTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      quorumM: 2,
      quorumN: 2,
      requireVerifiedSchema: false,
      oracleFeeBps: 100,
      allowDelegateClaim: true,
      challengeWindowSecs: 3_600n,
    });
    const oraclePolicyResult = await harness.send(
      "set_pool_oracle_policy",
      oraclePolicyTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(oraclePolicyResult);
    assertChanged(
      policyBefore,
      await harness.snapshotAccount(oraclePolicyAddress),
      "reward attestation oracle policy",
    );

    const mainApproval = await approveOracleForPool({
      harness,
      authority: state.governanceAuthority,
      poolAddress: rewardPool.poolAddress,
      oracle: state.oracle.publicKey,
    });
    scenario.recordSuccess(mainApproval);
    const secondApproval = await approveOracleForPool({
      harness,
      authority: state.governanceAuthority,
      poolAddress: rewardPool.poolAddress,
      oracle: secondOracle.publicKey,
    });
    scenario.recordSuccess(secondApproval);

    const rewardSeriesRefHashHex = harness.sha256Hex("reward-attestation-series");
    const createRewardSeriesResult = await createPolicySeriesForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: rewardPool.poolAddress,
      seriesRefHashHex: rewardSeriesRefHashHex,
      planMode: protocol.PLAN_MODE_REWARD,
      displayName: "Reward Attestation Series",
      metadataUri: "https://reward.local/series",
      termsHashHex: harness.sha256Hex("reward-attestation-series-terms"),
      durationSecs: 30n * 24n * 3_600n,
      premiumDueEverySecs: 24n * 3_600n,
      premiumGraceSecs: 3_600n,
      premiumAmount: 1n,
      interopProfileHashHex: harness.sha256Hex("reward-attest-interop"),
      oracleProfileHashHex: harness.sha256Hex("reward-attest-oracle"),
      riskFamilyHashHex: harness.sha256Hex("reward-attest-risk"),
      issuanceTemplateHashHex: harness.sha256Hex("reward-attest-issuance"),
      comparabilityHashHex: harness.sha256Hex("reward-attest-compare"),
      renewalOfHashHex: "00".repeat(32),
    });
    scenario.recordSuccess(createRewardSeriesResult);

    const schemaKeyHashHex = harness.sha256Hex("reward-attestation-schema");
    const registerSchemaTx = protocol.buildRegisterOutcomeSchemaTx({
      publisher: state.governanceAuthority.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      schemaKeyHashHex,
      schemaKey: "reward.schema",
      version: 1,
      schemaHashHex: harness.sha256Hex("reward-attestation-schema-hash"),
      schemaFamily: protocol.SCHEMA_FAMILY_KERNEL,
      visibility: protocol.SCHEMA_VISIBILITY_PUBLIC,
      interopProfileHashHex: harness.sha256Hex("reward-attest-interop"),
      codeSystemFamilyHashHex: harness.sha256Hex("reward-attest-code-system"),
      mappingVersion: 1,
      metadataUri: "https://schema.local/reward-attestation",
    });
    await harness.send("register_outcome_schema", registerSchemaTx, [state.governanceAuthority]);

    const ruleHashHex = harness.sha256Hex("reward-attestation-rule");
    const setRuleTx = protocol.buildSetPolicySeriesOutcomeRuleTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      seriesRefHashHex: rewardSeriesRefHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      ruleHashHex,
      schemaKeyHashHex,
      ruleId: "reward.attest.rule",
      schemaKey: "reward.schema",
      schemaVersion: 1,
      interopProfileHashHex: harness.sha256Hex("reward-attest-interop"),
      codeSystemFamilyHashHex: harness.sha256Hex("reward-attest-code-system"),
      mappingVersion: 1,
      payoutHashHex: harness.sha256Hex("reward-attestation-payout"),
      enabled: true,
    });
    await harness.send("set_policy_series_outcome_rule", setRuleTx, [state.governanceAuthority]);

    const membershipAddress = protocol.deriveMembershipPda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
      member: state.openMember.publicKey,
    });
    const enrollOpenTx = protocol.buildEnrollMemberOpenTx({
      member: state.openMember.publicKey,
      poolAddress: rewardPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const enrollResult = await harness.send("enroll_member_open", enrollOpenTx, [state.openMember]);
    scenario.recordSuccess(enrollResult);
    assert.equal(
      (await decodeMembership(harness.connection, membershipAddress)).status,
      protocol.MEMBERSHIP_STATUS_ACTIVE,
    );

    const rewardClaimDelegateAddress = protocol.deriveClaimDelegatePda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
      member: state.openMember.publicKey,
    });
    await harness.send(
      "set_claim_delegate",
      protocol.buildSetClaimDelegateTx({
        member: state.openMember.publicKey,
        poolAddress: rewardPool.poolAddress,
        delegate: state.delegate.publicKey,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.openMember],
    );

    const poolVaultTokenAccount = Keypair.generate();
    const fundPoolSplTx = protocol.buildFundPoolSplTx({
      funder: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      payoutMint,
      poolVaultTokenAccount: poolVaultTokenAccount.publicKey,
      poolVaultTokenAccountSigner: true,
      funderTokenAccount: governancePayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      amount: 3_000_000n,
    });
    const fundPoolSplResult = await harness.send(
      "fund_pool_spl",
      fundPoolSplTx,
      [state.governanceAuthority, poolVaultTokenAccount],
    );
    scenario.recordSuccess(fundPoolSplResult);

    const deniedCycleHashHex = harness.sha256Hex("reward-attestation-denied-cycle");
    const deniedAggregateAddress = protocol.deriveOutcomeAggregatePda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
      seriesRefHash: Buffer.from(rewardSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
      cycleHash: Buffer.from(deniedCycleHashHex, "hex"),
      ruleHash: Buffer.from(ruleHashHex, "hex"),
    });
    const deniedVoteAddress = protocol.deriveAttestationVotePda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
      seriesRefHash: Buffer.from(rewardSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
      cycleHash: Buffer.from(deniedCycleHashHex, "hex"),
      ruleHash: Buffer.from(ruleHashHex, "hex"),
      oracle: state.oracle.publicKey,
    });
    const zeroPermissionsTx = protocol.buildSetPoolOraclePermissionsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      oracle: state.oracle.publicKey,
      permissions: 0,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.send("set_pool_oracle_permissions", zeroPermissionsTx, [state.governanceAuthority]);
    const deniedVoteTx = protocol.buildSubmitOutcomeAttestationVoteTx({
      oracle: state.oracle.publicKey,
      poolAddress: rewardPool.poolAddress,
      payoutMint,
      seriesRefHashHex: rewardSeriesRefHashHex,
      member: state.openMember.publicKey,
      cycleHashHex: deniedCycleHashHex,
      ruleHashHex,
      schemaKeyHashHex,
      attestationDigestHex: harness.sha256Hex("reward-attestation-denied-digest"),
      observedValueHashHex: harness.sha256Hex("reward-attestation-denied-observed"),
      evidenceHashHex: harness.sha256Hex("reward-attestation-denied-evidence"),
      externalAttestationRefHashHex: harness.sha256Hex("reward-attestation-denied-external"),
      asOfTs: nowTs(),
      passed: true,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.OraclePermissionDenied ?? "oracle-permission-denied-attestation",
      expectedErrorName: "OraclePermissionDenied",
      tx: deniedVoteTx,
      signers: [state.oracle],
      unchangedAddresses: [deniedAggregateAddress, deniedVoteAddress],
    });
    scenario.recordFailure(
      COVERED_ERROR_CASES.OraclePermissionDenied ?? "oracle-permission-denied-attestation",
    );
    const mainPermissionsTx = protocol.buildSetPoolOraclePermissionsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      oracle: state.oracle.publicKey,
      permissions: ORACLE_PERMISSION_DATA_ATTEST,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const secondPermissionsTx = protocol.buildSetPoolOraclePermissionsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      oracle: secondOracle.publicKey,
      permissions: ORACLE_PERMISSION_DATA_ATTEST,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.send("set_pool_oracle_permissions", mainPermissionsTx, [state.governanceAuthority]);
    await harness.send("set_pool_oracle_permissions", secondPermissionsTx, [state.governanceAuthority]);

    const cycleHashHex = harness.sha256Hex("reward-attestation-cycle");
    const aggregateAddress = protocol.deriveOutcomeAggregatePda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
      seriesRefHash: Buffer.from(rewardSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
      cycleHash: Buffer.from(cycleHashHex, "hex"),
      ruleHash: Buffer.from(ruleHashHex, "hex"),
    });
    const reserveAddress = protocol.derivePoolTreasuryReservePda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
      paymentMint: payoutMint,
    });
    const firstVoteTx = protocol.buildSubmitOutcomeAttestationVoteTx({
      oracle: state.oracle.publicKey,
      poolAddress: rewardPool.poolAddress,
      payoutMint,
      seriesRefHashHex: rewardSeriesRefHashHex,
      member: state.openMember.publicKey,
      cycleHashHex,
      ruleHashHex,
      schemaKeyHashHex,
      attestationDigestHex: harness.sha256Hex("reward-attestation-digest-main"),
      observedValueHashHex: harness.sha256Hex("reward-attestation-observed"),
      evidenceHashHex: harness.sha256Hex("reward-attestation-evidence"),
      externalAttestationRefHashHex: harness.sha256Hex("reward-attestation-external"),
      asOfTs: nowTs(),
      passed: true,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const firstVoteResult = await harness.send(
      "submit_outcome_attestation_vote",
      firstVoteTx,
      [state.oracle],
    );
    scenario.recordSuccess(firstVoteResult);
    assert.ok(
      firstVoteResult.events.includes("OutcomeAttestationSubmittedEvent"),
      "submit_outcome_attestation_vote must emit OutcomeAttestationSubmittedEvent",
    );
    let aggregateState = await decodeOutcomeAggregate(harness.connection, aggregateAddress);
    assert.equal(aggregateState.passVotes, 1);
    assert.equal(aggregateState.finalized, false);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, reserveAddress)).reservedRewardAmount,
      0n,
    );

    const secondVoteTx = protocol.buildSubmitOutcomeAttestationVoteTx({
      oracle: secondOracle.publicKey,
      poolAddress: rewardPool.poolAddress,
      payoutMint,
      seriesRefHashHex: rewardSeriesRefHashHex,
      member: state.openMember.publicKey,
      cycleHashHex,
      ruleHashHex,
      schemaKeyHashHex,
      attestationDigestHex: harness.sha256Hex("reward-attestation-digest-secondary"),
      observedValueHashHex: harness.sha256Hex("reward-attestation-observed"),
      evidenceHashHex: harness.sha256Hex("reward-attestation-evidence"),
      externalAttestationRefHashHex: harness.sha256Hex("reward-attestation-external"),
      asOfTs: nowTs(),
      passed: true,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const secondVoteResult = await harness.send(
      "submit_outcome_attestation_vote",
      secondVoteTx,
      [secondOracle],
    );
    scenario.recordSuccess(secondVoteResult);
    aggregateState = await decodeOutcomeAggregate(harness.connection, aggregateAddress);
    assert.equal(aggregateState.finalized, true);
    assert.equal(aggregateState.passed, true);
    assert.equal(aggregateState.reviewStatus, protocol.OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE);
    assert.equal(aggregateState.rewardLiabilityReserved, true);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, reserveAddress)).reservedRewardAmount,
      400_000n,
    );

    const finalizeAggregateTx = protocol.buildFinalizeCycleOutcomeTx({
      feePayer: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      payoutMint,
      seriesRefHashHex: rewardSeriesRefHashHex,
      member: state.openMember.publicKey,
      cycleHashHex,
      ruleHashHex,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const finalizeResult = await harness.send(
      "finalize_cycle_outcome",
      finalizeAggregateTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(finalizeResult);
    aggregateState = await decodeOutcomeAggregate(harness.connection, aggregateAddress);
    assert.equal(aggregateState.finalized, true);
    assert.equal(aggregateState.passVotes, 2);

    const resolveWithoutDisputeTx = protocol.buildResolveCycleOutcomeDisputeTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      payoutMint,
      aggregate: aggregateAddress,
      sustainOriginalOutcome: true,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.OutcomeDisputeNotOpen ?? "resolve-outcome-without-dispute",
      expectedErrorName: "OutcomeDisputeNotOpen",
      tx: resolveWithoutDisputeTx,
      signers: [state.governanceAuthority],
      unchangedAddresses: [aggregateAddress, reserveAddress],
    });
    scenario.recordFailure(COVERED_ERROR_CASES.OutcomeDisputeNotOpen ?? "resolve-outcome-without-dispute");

    const earlyRewardClaimTx = protocol.buildSubmitRewardClaimTx({
      claimant: state.openMember.publicKey,
      poolAddress: rewardPool.poolAddress,
      member: state.openMember.publicKey,
      seriesRefHashHex: rewardSeriesRefHashHex,
      cycleHashHex,
      ruleHashHex,
      intentHashHex: harness.sha256Hex("reward-claim-early"),
      payoutAmount: 400_000n,
      payoutMint,
      recipient: state.openMember.publicKey,
      recipientSystemAccount: state.openMember.publicKey,
      claimDelegate: rewardClaimDelegateAddress,
      poolAssetVault: protocol.derivePoolAssetVaultPda({
        programId: harness.programId,
        poolAddress: rewardPool.poolAddress,
        payoutMint,
      }),
      poolVaultTokenAccount: poolVaultTokenAccount.publicKey,
      recipientTokenAccount: memberPayoutTokenAccount,
      includePoolCompliancePolicy: true,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.expectCustomError({
      caseId:
        COVERED_ERROR_CASES.OutcomeChallengeWindowActive
        ?? "reward-claim-before-challenge-window-clears",
      expectedErrorName: "OutcomeChallengeWindowActive",
      tx: earlyRewardClaimTx,
      signers: [state.openMember],
      unchangedAddresses: [aggregateAddress, reserveAddress],
    });
    scenario.recordFailure(
      COVERED_ERROR_CASES.OutcomeChallengeWindowActive
      ?? "reward-claim-before-challenge-window-clears",
    );

    const openDisputeTx = protocol.buildOpenCycleOutcomeDisputeTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      aggregate: aggregateAddress,
      disputeReasonHashHex: harness.sha256Hex("reward-attestation-dispute"),
      recentBlockhash: await harness.latestBlockhash(),
    });
    const openDisputeResult = await harness.send(
      "open_cycle_outcome_dispute",
      openDisputeTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(openDisputeResult);
    aggregateState = await decodeOutcomeAggregate(harness.connection, aggregateAddress);
    assert.equal(aggregateState.reviewStatus, protocol.OUTCOME_REVIEW_STATUS_CHALLENGED);

    const resolveDisputeTx = protocol.buildResolveCycleOutcomeDisputeTx({
      governanceAuthority: state.governanceAuthority.publicKey,
      poolAddress: rewardPool.poolAddress,
      payoutMint,
      aggregate: aggregateAddress,
      sustainOriginalOutcome: true,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const resolveResult = await harness.send(
      "resolve_cycle_outcome_dispute",
      resolveDisputeTx,
      [state.governanceAuthority],
    );
    scenario.recordSuccess(resolveResult);
    aggregateState = await decodeOutcomeAggregate(harness.connection, aggregateAddress);
    assert.equal(aggregateState.reviewStatus, protocol.OUTCOME_REVIEW_STATUS_CLEAR);
    assert.equal(aggregateState.resolvedBy, state.governanceAuthority.publicKey.toBase58());

    const claimRecordAddress = protocol.deriveClaimV2Pda({
      programId: harness.programId,
      poolAddress: rewardPool.poolAddress,
      seriesRefHash: Buffer.from(rewardSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
      cycleHash: Buffer.from(cycleHashHex, "hex"),
      ruleHash: Buffer.from(ruleHashHex, "hex"),
    });
    const rewardClaimTx = protocol.buildSubmitRewardClaimTx({
      claimant: state.openMember.publicKey,
      poolAddress: rewardPool.poolAddress,
      member: state.openMember.publicKey,
      seriesRefHashHex: rewardSeriesRefHashHex,
      cycleHashHex,
      ruleHashHex,
      intentHashHex: harness.sha256Hex("reward-claim-success"),
      payoutAmount: 400_000n,
      payoutMint,
      recipient: state.openMember.publicKey,
      recipientSystemAccount: state.openMember.publicKey,
      claimDelegate: rewardClaimDelegateAddress,
      poolAssetVault: protocol.derivePoolAssetVaultPda({
        programId: harness.programId,
        poolAddress: rewardPool.poolAddress,
        payoutMint,
      }),
      poolVaultTokenAccount: poolVaultTokenAccount.publicKey,
      recipientTokenAccount: memberPayoutTokenAccount,
      includePoolCompliancePolicy: true,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const rewardPayoutBefore = await harness.snapshotTokenAccount(memberPayoutTokenAccount);
    const rewardClaimResult = await harness.send("submit_reward_claim", rewardClaimTx, [state.openMember]);
    scenario.recordSuccess(rewardClaimResult);
    assert.ok(
      rewardClaimResult.events.includes("RewardClaimSubmittedEvent"),
      "submit_reward_claim must emit RewardClaimSubmittedEvent",
    );
    assertTokenChanged(
      rewardPayoutBefore,
      await harness.snapshotTokenAccount(memberPayoutTokenAccount),
      "submit_reward_claim payout",
    );
    aggregateState = await decodeOutcomeAggregate(harness.connection, aggregateAddress);
    assert.equal(aggregateState.claimed, true);
    assert.equal(aggregateState.rewardLiabilityReserved, false);
    const claimRecordState = await decodeClaimRecordV2(harness.connection, claimRecordAddress);
    assert.equal(claimRecordState.payoutAmount, 400_000n);
    assert.equal(claimRecordState.claimant, state.openMember.publicKey.toBase58());
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, reserveAddress)).reservedRewardAmount,
      0n,
    );
  } finally {
    scenario.finish();
  }
}

async function scenarioCoverageProductPolicyPremiumLifecycle(
  harness: LocalnetHarness,
  state: GlobalState,
) {
  const scenario = harness.beginScenario("coverage-product-policy-premium-lifecycle");
  try {
    await ensureProtocolBootstrapped(harness, state);

    const payoutMint = await harness.createMint(state.governanceAuthority, 6);
    const openMemberPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.openMember.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: payoutMint,
      destination: openMemberPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 6_000_000n,
    });

    const directPool = await createPool({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "coverage-direct",
      organizationRef: "coverage-direct-org",
      payoutLamportsPerPass: 250_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: payoutMint,
      poolType: protocol.POOL_TYPE_COVERAGE,
    });
    scenario.recordSuccess(directPool.createResult);
    scenario.recordSuccess(directPool.statusResult);

    const enrollCoverageMemberDirectTx = protocol.buildEnrollMemberOpenTx({
      member: state.coverageMember.publicKey,
      poolAddress: directPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.send("enroll_member_open", enrollCoverageMemberDirectTx, [state.coverageMember]);

    const directSeriesRefHashHex = harness.sha256Hex("direct-policy-series");
    const directTermsHashHex = harness.sha256Hex("direct-policy-series-terms");
    const directPolicyAddress = protocol.derivePolicyPositionPda({
      programId: harness.programId,
      poolAddress: directPool.poolAddress,
      seriesRefHash: Buffer.from(directSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
    });
    const directPolicyBefore = await harness.snapshotAccount(directPolicyAddress);
    const directStartsAt = nowTs() - 120n;
    const createDirectSeriesResult = await createPolicySeriesForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: directPool.poolAddress,
      seriesRefHashHex: directSeriesRefHashHex,
      planMode: protocol.PLAN_MODE_PROTECTION,
      displayName: "Direct Protect Series",
      metadataUri: "https://policy.local/direct-series",
      termsHashHex: directTermsHashHex,
      durationSecs: 7_200n,
      premiumDueEverySecs: 600n,
      premiumGraceSecs: 300n,
      premiumAmount: 1_500n,
    });
    scenario.recordSuccess(createDirectSeriesResult);
    const directPolicyTx = protocol.buildIssuePolicyPositionTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: directPool.poolAddress,
      member: state.coverageMember.publicKey,
      seriesRefHashHex: directSeriesRefHashHex,
      startsAtTs: directStartsAt,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const directPolicyResult = await harness.send("issue_policy_position", directPolicyTx, [state.governanceAuthority]);
    scenario.recordSuccess(directPolicyResult);
    assertChanged(
      directPolicyBefore,
      await harness.snapshotAccount(directPolicyAddress),
      "issue_policy_position",
    );
    const directPolicyState = await decodePolicyPosition(harness.connection, directPolicyAddress);
    assert.equal(directPolicyState.termsHashHex, directTermsHashHex);
    assert.equal(directPolicyState.member, state.coverageMember.publicKey.toBase58());
    assert.equal(directPolicyState.seriesRefHashHex, directSeriesRefHashHex);

    const directPolicyNftAddress = protocol.derivePolicyPositionNftPda({
      programId: harness.programId,
      poolAddress: directPool.poolAddress,
      seriesRefHash: Buffer.from(directSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
    });
    const mintPolicyTx = protocol.buildMintPolicyNftTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: directPool.poolAddress,
      member: state.coverageMember.publicKey,
      seriesRefHashHex: directSeriesRefHashHex,
      nftMint: Keypair.generate().publicKey,
      metadataUri: "https://policy.local/direct-nft",
      recentBlockhash: await harness.latestBlockhash(),
    });
    const mintPolicyResult = await harness.send("mint_policy_nft", mintPolicyTx, [state.governanceAuthority]);
    scenario.recordSuccess(mintPolicyResult);
    const directPolicyNftState = await decodePolicyPositionNft(harness.connection, directPolicyNftAddress);
    assert.equal(directPolicyNftState.metadataUri, "https://policy.local/direct-nft");
    assert.equal(
      (await decodePolicyPosition(harness.connection, directPolicyAddress)).nftMint,
      directPolicyNftState.nftMint,
    );

    const productPool = await createPool({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "coverage-product",
      organizationRef: "coverage-product-org",
      payoutLamportsPerPass: 250_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: payoutMint,
      poolType: protocol.POOL_TYPE_COVERAGE,
    });
    scenario.recordSuccess(productPool.createResult);
    scenario.recordSuccess(productPool.statusResult);

    const enrollOpenMemberTx = protocol.buildEnrollMemberOpenTx({
      member: state.openMember.publicKey,
      poolAddress: productPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const enrollAlternateMemberTx = protocol.buildEnrollMemberOpenTx({
      member: state.alternateMember.publicKey,
      poolAddress: productPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.send("enroll_member_open", enrollOpenMemberTx, [state.openMember]);
    await harness.send("enroll_member_open", enrollAlternateMemberTx, [state.alternateMember]);

    const coverageSeriesRefHashHex = harness.sha256Hex("coverage-product-series");
    const productAddress = protocol.derivePolicySeriesPda({
      programId: harness.programId,
      poolAddress: productPool.poolAddress,
      seriesRefHash: Buffer.from(coverageSeriesRefHashHex, "hex"),
    });
    const productBefore = await harness.snapshotAccount(productAddress);
    const registerProductResult = await createPolicySeriesForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: productPool.poolAddress,
      seriesRefHashHex: coverageSeriesRefHashHex,
      planMode: protocol.PLAN_MODE_PROTECTION,
      displayName: "Localnet Coverage Product",
      metadataUri: "https://coverage.local/product-v1",
      termsHashHex: harness.sha256Hex("coverage-product-terms-v1"),
      durationSecs: 7_200n,
      premiumDueEverySecs: 600n,
      premiumGraceSecs: 300n,
      premiumAmount: 1_500n,
    });
    scenario.recordSuccess(registerProductResult);
    assertChanged(
      productBefore,
      await harness.snapshotAccount(productAddress),
      "create_policy_series",
    );

    const updateProductTx = protocol.buildUpdatePolicySeriesTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: productPool.poolAddress,
      seriesRefHashHex: coverageSeriesRefHashHex,
      status: protocol.POLICY_SERIES_STATUS_ACTIVE,
      planMode: protocol.PLAN_MODE_PROTECTION,
      sponsorMode: protocol.SPONSOR_MODE_DIRECT,
      displayName: "Localnet Coverage Product Updated",
      metadataUri: "https://coverage.local/product-v2",
      termsHashHex: harness.sha256Hex("coverage-product-terms-v2"),
      durationSecs: 10_800n,
      premiumDueEverySecs: 600n,
      premiumGraceSecs: 300n,
      premiumAmount: 1_500n,
      interopProfileHashHex: "00".repeat(32),
      oracleProfileHashHex: "00".repeat(32),
      riskFamilyHashHex: "00".repeat(32),
      issuanceTemplateHashHex: "00".repeat(32),
      comparabilityHashHex: "00".repeat(32),
      renewalOfHashHex: "00".repeat(32),
      termsVersion: 1,
      mappingVersion: 1,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const updateProductResult = await harness.send("update_policy_series", updateProductTx, [state.governanceAuthority]);
    scenario.recordSuccess(updateProductResult);
    const productState = await decodePolicySeries(harness.connection, productAddress);
    assert.equal(productState.displayName, "Localnet Coverage Product Updated");
    assert.equal(productState.metadataUri, "https://coverage.local/product-v2");
    assert.equal(productState.durationSecs, 10_800n);

    const splPaymentOptionAddress = protocol.derivePolicySeriesPaymentOptionPda({
      programId: harness.programId,
      poolAddress: productPool.poolAddress,
      seriesRefHash: Buffer.from(coverageSeriesRefHashHex, "hex"),
      paymentMint: payoutMint,
    });
    const upsertSplOptionResult = await upsertPolicySeriesPaymentOptionForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: productPool.poolAddress,
      seriesRefHashHex: coverageSeriesRefHashHex,
      paymentMint: payoutMint,
      paymentAmount: 1_500n,
    });
    scenario.recordSuccess(upsertSplOptionResult);
    assert.equal(
      (await decodePolicySeriesPaymentOption(harness.connection, splPaymentOptionAddress)).paymentAmount,
      1_500n,
    );

    const upsertSolOptionResult = await upsertPolicySeriesPaymentOptionForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: productPool.poolAddress,
      seriesRefHashHex: coverageSeriesRefHashHex,
      paymentMint: ZERO_PUBKEY,
      paymentAmount: 1_500n,
    });
    scenario.recordSuccess(upsertSolOptionResult);

    const subscribePolicyAddress = protocol.derivePolicyPositionPda({
      programId: harness.programId,
      poolAddress: productPool.poolAddress,
      seriesRefHash: Buffer.from(coverageSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
    });
    const subscribeTx = protocol.buildSubscribePolicySeriesTx({
      member: state.openMember.publicKey,
      poolAddress: productPool.poolAddress,
      seriesRefHashHex: coverageSeriesRefHashHex,
      startsAtTs: nowTs() - 60n,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const subscribeResult = await harness.send("subscribe_policy_series", subscribeTx, [state.openMember]);
    scenario.recordSuccess(subscribeResult);
    const subscribePolicyState = await decodePolicyPosition(harness.connection, subscribePolicyAddress);
    assert.equal(subscribePolicyState.member, state.openMember.publicKey.toBase58());
    assert.equal(subscribePolicyState.termsHashHex, productState.termsHashHex);
    assert.equal(subscribePolicyState.seriesRefHashHex, coverageSeriesRefHashHex);

    const issuedPolicyAddress = protocol.derivePolicyPositionPda({
      programId: harness.programId,
      poolAddress: productPool.poolAddress,
      seriesRefHash: Buffer.from(coverageSeriesRefHashHex, "hex"),
      member: state.alternateMember.publicKey,
    });
    const issueTx = protocol.buildIssuePolicyPositionTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: productPool.poolAddress,
      member: state.alternateMember.publicKey,
      seriesRefHashHex: coverageSeriesRefHashHex,
      startsAtTs: nowTs() - 30n,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const issueResult = await harness.send("issue_policy_position", issueTx, [state.governanceAuthority]);
    scenario.recordSuccess(issueResult);
    const issuedPolicyState = await decodePolicyPosition(harness.connection, issuedPolicyAddress);
    assert.equal(issuedPolicyState.member, state.alternateMember.publicKey.toBase58());
    assert.equal(issuedPolicyState.termsHashHex, productState.termsHashHex);

    const openMemberLedgerAddress = protocol.derivePremiumLedgerPda({
      programId: harness.programId,
      poolAddress: productPool.poolAddress,
      seriesRefHash: Buffer.from(coverageSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
    });
    const productPoolAssetVaultAddress = protocol.derivePoolAssetVaultPda({
      programId: harness.programId,
      poolAddress: productPool.poolAddress,
      payoutMint,
    });
    const productPoolVaultTokenAccount = getAssociatedTokenAddressSync(
      payoutMint,
      productPoolAssetVaultAddress,
      true,
    );
    const payPremiumSplTx = protocol.buildPayPremiumSplV2Tx({
      payer: state.openMember.publicKey,
      poolAddress: productPool.poolAddress,
      member: state.openMember.publicKey,
      seriesRefHashHex: coverageSeriesRefHashHex,
      paymentMint: payoutMint,
      periodIndex: 0n,
      payerTokenAccount: openMemberPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const openMemberLedgerBefore = await harness.snapshotAccount(openMemberLedgerAddress);
    const openMemberTokenBefore = await harness.snapshotTokenAccount(openMemberPayoutTokenAccount);
    const payPremiumSplResult = await harness.send(
      "pay_premium_spl_v2",
      payPremiumSplTx,
      [state.openMember],
    );
    scenario.recordSuccess(payPremiumSplResult);
    assertChanged(
      openMemberLedgerBefore,
      await harness.snapshotAccount(openMemberLedgerAddress),
      "pay_premium_spl_v2 ledger",
    );
    assertTokenChanged(
      openMemberTokenBefore,
      await harness.snapshotTokenAccount(openMemberPayoutTokenAccount),
      "pay_premium_spl_v2 payer",
    );
    const openMemberLedgerState = await decodePremiumLedger(harness.connection, openMemberLedgerAddress);
    assert.equal(openMemberLedgerState.periodIndex, 0n);
    assert.equal(openMemberLedgerState.amount, 1_500n);
    assert.equal(
      (await decodePoolAssetVault(harness.connection, productPoolAssetVaultAddress)).vaultTokenAccount,
      productPoolVaultTokenAccount.toBase58(),
    );

    const alternateLedgerAddress = protocol.derivePremiumLedgerPda({
      programId: harness.programId,
      poolAddress: productPool.poolAddress,
      seriesRefHash: Buffer.from(coverageSeriesRefHashHex, "hex"),
      member: state.alternateMember.publicKey,
    });
    const payPremiumSolTx = protocol.buildPayPremiumSolV2Tx({
      payer: state.alternateMember.publicKey,
      poolAddress: productPool.poolAddress,
      member: state.alternateMember.publicKey,
      seriesRefHashHex: coverageSeriesRefHashHex,
      periodIndex: 0n,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const poolLamportsBefore = await harness.snapshotAccount(productPool.poolAddress);
    const payPremiumSolResult = await harness.send(
      "pay_premium_sol_v2",
      payPremiumSolTx,
      [state.alternateMember],
    );
    scenario.recordSuccess(payPremiumSolResult);
    assertChanged(
      poolLamportsBefore,
      await harness.snapshotAccount(productPool.poolAddress),
      "pay_premium_sol_v2 pool",
    );
    const alternateLedgerState = await decodePremiumLedger(harness.connection, alternateLedgerAddress);
    assert.equal(alternateLedgerState.periodIndex, 0n);
    assert.equal(alternateLedgerState.amount, 1_500n);
  } finally {
    scenario.finish();
  }
}

async function scenarioQuotedCycleActivationSettlementCohortLifecycle(
  harness: LocalnetHarness,
  state: GlobalState,
) {
  const scenario = harness.beginScenario("quoted-cycle-activation-settlement-cohort-lifecycle");
  try {
    await ensureMainOracleReady(harness, state);

    const payoutMint = await harness.createMint(state.governanceAuthority, 6);
    const openMemberPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.openMember.publicKey,
      })
    ).address;
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: payoutMint,
      destination: openMemberPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 8_000_000n,
    });

    const cyclePool = await createPool({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "cycle-quote",
      organizationRef: "cycle-quote-org",
      payoutLamportsPerPass: 300_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: payoutMint,
      poolType: protocol.POOL_TYPE_COVERAGE,
    });
    scenario.recordSuccess(cyclePool.createResult);
    scenario.recordSuccess(cyclePool.statusResult);

    const oraclePolicyTx = protocol.buildSetPoolOraclePolicyTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: cyclePool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
      quorumM: 1,
      quorumN: 1,
      requireVerifiedSchema: false,
      oracleFeeBps: 100,
      allowDelegateClaim: false,
      challengeWindowSecs: 0n,
    });
    await harness.send("set_pool_oracle_policy", oraclePolicyTx, [state.governanceAuthority]);
    const poolApproval = await approveOracleForPool({
      harness,
      authority: state.governanceAuthority,
      poolAddress: cyclePool.poolAddress,
      oracle: state.oracle.publicKey,
    });
    scenario.recordSuccess(poolApproval);
    const permissionsTx = protocol.buildSetPoolOraclePermissionsTx({
      authority: state.governanceAuthority.publicKey,
      poolAddress: cyclePool.poolAddress,
      oracle: state.oracle.publicKey,
      permissions: ORACLE_PERMISSION_QUOTE | ORACLE_PERMISSION_CYCLE_SETTLE,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.send("set_pool_oracle_permissions", permissionsTx, [state.governanceAuthority]);

    const cycleSeriesRefHashHex = harness.sha256Hex("cycle-quote-series");
    await createPolicySeriesForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: cyclePool.poolAddress,
      seriesRefHashHex: cycleSeriesRefHashHex,
      planMode: protocol.PLAN_MODE_REWARD,
      displayName: "Cycle Quote Series",
      metadataUri: "https://cycle.local/series",
      termsHashHex: harness.sha256Hex("cycle-quote-terms"),
      durationSecs: 14_400n,
      premiumDueEverySecs: 3_600n,
      premiumGraceSecs: 600n,
      premiumAmount: 1_000n,
    });
    await upsertPolicySeriesPaymentOptionForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: cyclePool.poolAddress,
      seriesRefHashHex: cycleSeriesRefHashHex,
      paymentMint: payoutMint,
      paymentAmount: 1_000n,
    });
    await upsertPolicySeriesPaymentOptionForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: cyclePool.poolAddress,
      seriesRefHashHex: cycleSeriesRefHashHex,
      paymentMint: ZERO_PUBKEY,
      paymentAmount: 1_000n,
    });

    const invalidSigNonceHashHex = harness.sha256Hex("cycle-quote-invalid-signature-nonce");
    const invalidSigQuoteMetaHashHex = harness.sha256Hex("cycle-quote-invalid-signature-meta");
    const invalidSigCohortHashHex = harness.sha256Hex("cycle-quote-invalid-signature-cohort");
    const invalidSigFees = computeCycleFeeBreakdown({
      premiumAmountRaw: 1_000n,
      bondAmountRaw: 125n,
      shieldFeeRaw: 0n,
      protocolFeeBps: 300,
      oracleFeeBps: 100,
    });
    const invalidSigOracle = Keypair.generate();
    const invalidSigQuoteInstruction = await harness.quoteVerificationInstruction({
      oracle: invalidSigOracle,
      poolAddress: cyclePool.poolAddress,
      member: state.coverageMember.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      periodIndex: 7n,
      commitmentEnabled: true,
      bondAmountRaw: 125n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: invalidSigFees.protocolFeeRaw,
      oracleFeeRaw: invalidSigFees.oracleFeeRaw,
      netPoolPremiumRaw: invalidSigFees.netPoolPremiumRaw,
      totalAmountRaw: invalidSigFees.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 0,
      outcomeThresholdScore: 725,
      cohortHashHex: invalidSigCohortHashHex,
      expiresAtTs: nowTs() + 3_600n,
      nonceHashHex: invalidSigNonceHashHex,
      quoteMetaHashHex: invalidSigQuoteMetaHashHex,
    });
    const invalidSigMemberCycleAddress = protocol.deriveMemberCyclePda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
      periodIndex: 7n,
    });
    const invalidSigPremiumLedgerAddress = protocol.derivePremiumLedgerPda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
    });
    const invalidSigTx = addComputeBudget(protocol.buildActivateCycleWithQuoteSolTx({
      payer: state.coverageMember.publicKey,
      poolAddress: cyclePool.poolAddress,
      oracle: state.oracle.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      periodIndex: 7n,
      nonceHashHex: invalidSigNonceHashHex,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      commitmentEnabled: true,
      bondAmountRaw: 125n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: invalidSigFees.protocolFeeRaw,
      oracleFeeRaw: invalidSigFees.oracleFeeRaw,
      netPoolPremiumRaw: invalidSigFees.netPoolPremiumRaw,
      totalAmountRaw: invalidSigFees.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 0,
      outcomeThresholdScore: 725,
      cohortHashHex: invalidSigCohortHashHex,
      expiresAtTs: nowTs() + 3_600n,
      quoteMetaHashHex: invalidSigQuoteMetaHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      quoteVerificationInstruction: invalidSigQuoteInstruction,
    }));
    const invalidSigLookupTable = await harness.createLookupTable(
      state.governanceAuthority,
      lookupAddressesForTransaction(invalidSigTx),
    );
    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.InvalidQuoteSignatureInstruction ?? "quote-invalid-signature-layout",
      expectedErrorName: "InvalidQuoteSignatureInstruction",
      tx: invalidSigTx,
      signers: [state.coverageMember],
      unchangedAddresses: [invalidSigMemberCycleAddress, invalidSigPremiumLedgerAddress],
      lookupTables: [invalidSigLookupTable],
    });
    scenario.recordFailure(
      COVERED_ERROR_CASES.InvalidQuoteSignatureInstruction ?? "quote-invalid-signature-layout",
    );

    const expiredNonceHashHex = harness.sha256Hex("cycle-quote-expired-nonce");
    const expiredQuoteMetaHashHex = harness.sha256Hex("cycle-quote-expired-meta");
    const expiredQuoteFees = computeCycleFeeBreakdown({
      premiumAmountRaw: 1_000n,
      bondAmountRaw: 150n,
      shieldFeeRaw: 0n,
      protocolFeeBps: 300,
      oracleFeeBps: 100,
    });
    const expiredQuoteInstruction = await harness.quoteVerificationInstruction({
      oracle: state.oracle,
      poolAddress: cyclePool.poolAddress,
      member: state.coverageMember.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      periodIndex: 0n,
      commitmentEnabled: true,
      bondAmountRaw: 150n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: expiredQuoteFees.protocolFeeRaw,
      oracleFeeRaw: expiredQuoteFees.oracleFeeRaw,
      netPoolPremiumRaw: expiredQuoteFees.netPoolPremiumRaw,
      totalAmountRaw: expiredQuoteFees.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 0,
      outcomeThresholdScore: 720,
      cohortHashHex: harness.sha256Hex("cycle-quote-expired-cohort"),
      expiresAtTs: nowTs() - 1n,
      nonceHashHex: expiredNonceHashHex,
      quoteMetaHashHex: expiredQuoteMetaHashHex,
    });
    const expiredMemberCycleAddress = protocol.deriveMemberCyclePda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
      periodIndex: 0n,
    });
    const expiredPremiumLedgerAddress = protocol.derivePremiumLedgerPda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
    });
    const expiredQuoteTx = addComputeBudget(protocol.buildActivateCycleWithQuoteSolTx({
      payer: state.coverageMember.publicKey,
      poolAddress: cyclePool.poolAddress,
      oracle: state.oracle.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      periodIndex: 0n,
      nonceHashHex: expiredNonceHashHex,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      commitmentEnabled: true,
      bondAmountRaw: 150n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: expiredQuoteFees.protocolFeeRaw,
      oracleFeeRaw: expiredQuoteFees.oracleFeeRaw,
      netPoolPremiumRaw: expiredQuoteFees.netPoolPremiumRaw,
      totalAmountRaw: expiredQuoteFees.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 0,
      outcomeThresholdScore: 720,
      cohortHashHex: harness.sha256Hex("cycle-quote-expired-cohort"),
      expiresAtTs: nowTs() - 1n,
      quoteMetaHashHex: expiredQuoteMetaHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      quoteVerificationInstruction: expiredQuoteInstruction,
    }));
    const expiredLookupTable = await harness.createLookupTable(
      state.governanceAuthority,
      lookupAddressesForTransaction(expiredQuoteTx),
    );
    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.QuoteExpired ?? "quote-expired-sol",
      expectedErrorName: "QuoteExpired",
      tx: expiredQuoteTx,
      signers: [state.coverageMember],
      unchangedAddresses: [expiredMemberCycleAddress, expiredPremiumLedgerAddress],
      lookupTables: [expiredLookupTable],
    });
    scenario.recordFailure(COVERED_ERROR_CASES.QuoteExpired ?? "quote-expired-sol");

    const splNonceHashHex = harness.sha256Hex("cycle-quote-spl-nonce");
    const splQuoteMetaHashHex = harness.sha256Hex("cycle-quote-spl-meta");
    const splCohortHashHex = harness.sha256Hex("cycle-quote-spl-cohort");
    const splQuoteFees = computeCycleFeeBreakdown({
      premiumAmountRaw: 1_000n,
      bondAmountRaw: 200n,
      shieldFeeRaw: 0n,
      protocolFeeBps: 300,
      oracleFeeBps: 100,
    });
    const splQuoteInstruction = await harness.quoteVerificationInstruction({
      oracle: state.oracle,
      poolAddress: cyclePool.poolAddress,
      member: state.openMember.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      paymentMint: payoutMint,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      periodIndex: 0n,
      commitmentEnabled: true,
      bondAmountRaw: 200n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: splQuoteFees.protocolFeeRaw,
      oracleFeeRaw: splQuoteFees.oracleFeeRaw,
      netPoolPremiumRaw: splQuoteFees.netPoolPremiumRaw,
      totalAmountRaw: splQuoteFees.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 0,
      outcomeThresholdScore: 700,
      cohortHashHex: splCohortHashHex,
      expiresAtTs: nowTs() + 3_600n,
      nonceHashHex: splNonceHashHex,
      quoteMetaHashHex: splQuoteMetaHashHex,
    });
    const splMemberCycleAddress = protocol.deriveMemberCyclePda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
      periodIndex: 0n,
    });
    const splReserveAddress = protocol.derivePoolTreasuryReservePda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      paymentMint: payoutMint,
    });
    const splPremiumLedgerAddress = protocol.derivePremiumLedgerPda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
    });
    const activateSplTx = addComputeBudget(protocol.buildActivateCycleWithQuoteSplTx({
      payer: state.openMember.publicKey,
      poolAddress: cyclePool.poolAddress,
      oracle: state.oracle.publicKey,
      paymentMint: payoutMint,
      payerTokenAccount: openMemberPayoutTokenAccount,
      seriesRefHashHex: cycleSeriesRefHashHex,
      periodIndex: 0n,
      nonceHashHex: splNonceHashHex,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      commitmentEnabled: true,
      bondAmountRaw: 200n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: splQuoteFees.protocolFeeRaw,
      oracleFeeRaw: splQuoteFees.oracleFeeRaw,
      netPoolPremiumRaw: splQuoteFees.netPoolPremiumRaw,
      totalAmountRaw: splQuoteFees.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 0,
      outcomeThresholdScore: 700,
      cohortHashHex: splCohortHashHex,
      expiresAtTs: nowTs() + 3_600n,
      quoteMetaHashHex: splQuoteMetaHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      quoteVerificationInstruction: splQuoteInstruction,
    }));
    const splLookupTable = await harness.createLookupTable(
      state.governanceAuthority,
      lookupAddressesForTransaction(activateSplTx),
    );
    const activateSplResult = await harness.send(
      "activate_cycle_with_quote_spl",
      activateSplTx,
      [state.openMember],
      [splLookupTable],
    );
    scenario.recordSuccess(activateSplResult);
    const splMemberCycleState = await decodeMemberCycle(harness.connection, splMemberCycleAddress);
    assert.equal(splMemberCycleState.paymentMint, payoutMint.toBase58());
    assert.equal(splMemberCycleState.periodIndex, 0n);
    assert.equal(splMemberCycleState.bondAmountRaw, 200n);
    assert.equal(splMemberCycleState.outcomeThresholdScore, 700);
    assert.equal(
      (await decodePremiumLedger(harness.connection, splPremiumLedgerAddress)).amount,
      1_000n,
    );
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, splReserveAddress)).reservedRefundAmount,
      200n,
    );

    const splCohortRootAddress = protocol.deriveCohortSettlementRootPda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      cohortHash: Buffer.from(splCohortHashHex, "hex"),
    });
    const settleSplRefundBefore = await harness.snapshotTokenAccount(openMemberPayoutTokenAccount);
    const settleSplTx = protocol.buildSettleCycleCommitmentTx({
      oracle: state.oracle.publicKey,
      poolAddress: cyclePool.poolAddress,
      member: state.openMember.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      paymentMint: payoutMint,
      periodIndex: 0n,
      passed: true,
      shieldConsumed: false,
      settledHealthAlphaScore: 740,
      recipientTokenAccount: openMemberPayoutTokenAccount,
      recentBlockhash: await harness.latestBlockhash(),
      cohortHashHex: splCohortHashHex,
    });
    const settleSplResult = await harness.send(
      "settle_cycle_commitment",
      settleSplTx,
      [state.oracle],
    );
    scenario.recordSuccess(settleSplResult);
    assertTokenChanged(
      settleSplRefundBefore,
      await harness.snapshotTokenAccount(openMemberPayoutTokenAccount),
      "settle_cycle_commitment refund",
    );
    const settledSplCycleState = await decodeMemberCycle(harness.connection, splMemberCycleAddress);
    assert.equal(settledSplCycleState.status, 2);
    assert.equal(settledSplCycleState.passed, true);
    assert.equal(settledSplCycleState.settledHealthAlphaScore, 740);
    const splCohortRootState = await decodeCohortSettlementRoot(harness.connection, splCohortRootAddress);
    assert.equal(splCohortRootState.cohortHashHex, settledSplCycleState.cohortHashHex);
    assert.equal(splCohortRootState.successfulMemberCount, 1);
    assert.equal(splCohortRootState.successfulHealthAlphaScoreSum, 740n);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, splReserveAddress)).reservedRefundAmount,
      0n,
    );

    const finalizeCohortTx = protocol.buildFinalizeCohortSettlementRootTx({
      oracle: state.oracle.publicKey,
      poolAddress: cyclePool.poolAddress,
      payoutMint,
      seriesRefHashHex: cycleSeriesRefHashHex,
      cohortHashHex: settledSplCycleState.cohortHashHex,
      recentBlockhash: await harness.latestBlockhash(),
    });
    assert.equal(
      finalizeCohortTx.instructions[0]?.keys[8]?.pubkey.toBase58(),
      splCohortRootAddress.toBase58(),
    );
    const finalizeCohortResult = await harness.send(
      "finalize_cohort_settlement_root",
      finalizeCohortTx,
      [state.oracle],
    );
    scenario.recordSuccess(finalizeCohortResult);
    assert.equal(
      (await decodeCohortSettlementRoot(harness.connection, splCohortRootAddress)).finalized,
      true,
    );

    const solNonceHashHex = harness.sha256Hex("cycle-quote-sol-nonce");
    const solQuoteMetaHashHex = harness.sha256Hex("cycle-quote-sol-meta");
    const solQuoteFees = computeCycleFeeBreakdown({
      premiumAmountRaw: 1_000n,
      bondAmountRaw: 300n,
      shieldFeeRaw: 0n,
      protocolFeeBps: 300,
      oracleFeeBps: 100,
    });
    const solQuoteInstruction = await harness.quoteVerificationInstruction({
      oracle: state.oracle,
      poolAddress: cyclePool.poolAddress,
      member: state.alternateMember.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      periodIndex: 0n,
      commitmentEnabled: true,
      bondAmountRaw: 300n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: solQuoteFees.protocolFeeRaw,
      oracleFeeRaw: solQuoteFees.oracleFeeRaw,
      netPoolPremiumRaw: solQuoteFees.netPoolPremiumRaw,
      totalAmountRaw: solQuoteFees.totalAmountRaw,
      includedShieldCount: 1,
      thresholdBps: 500,
      outcomeThresholdScore: 0,
      cohortHashHex: "00".repeat(32),
      expiresAtTs: nowTs() + 3_600n,
      nonceHashHex: solNonceHashHex,
      quoteMetaHashHex: solQuoteMetaHashHex,
    });
    const solMemberCycleAddress = protocol.deriveMemberCyclePda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      seriesRefHash: Buffer.from(cycleSeriesRefHashHex, "hex"),
      member: state.alternateMember.publicKey,
      periodIndex: 0n,
    });
    const solReserveAddress = protocol.derivePoolTreasuryReservePda({
      programId: harness.programId,
      poolAddress: cyclePool.poolAddress,
      paymentMint: ZERO_PUBKEY,
    });
    const activateSolTx = addComputeBudget(protocol.buildActivateCycleWithQuoteSolTx({
      payer: state.alternateMember.publicKey,
      poolAddress: cyclePool.poolAddress,
      oracle: state.oracle.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      periodIndex: 0n,
      nonceHashHex: solNonceHashHex,
      premiumAmountRaw: 1_000n,
      canonicalPremiumAmount: 1_000n,
      commitmentEnabled: true,
      bondAmountRaw: 300n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: solQuoteFees.protocolFeeRaw,
      oracleFeeRaw: solQuoteFees.oracleFeeRaw,
      netPoolPremiumRaw: solQuoteFees.netPoolPremiumRaw,
      totalAmountRaw: solQuoteFees.totalAmountRaw,
      includedShieldCount: 1,
      thresholdBps: 500,
      outcomeThresholdScore: 0,
      cohortHashHex: "00".repeat(32),
      expiresAtTs: nowTs() + 3_600n,
      quoteMetaHashHex: solQuoteMetaHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      quoteVerificationInstruction: solQuoteInstruction,
    }));
    const solLookupTable = await harness.createLookupTable(
      state.governanceAuthority,
      lookupAddressesForTransaction(activateSolTx),
    );
    const activateSolResult = await harness.send(
      "activate_cycle_with_quote_sol",
      activateSolTx,
      [state.alternateMember],
      [solLookupTable],
    );
    scenario.recordSuccess(activateSolResult);
    const solMemberCycleState = await decodeMemberCycle(harness.connection, solMemberCycleAddress);
    assert.equal(solMemberCycleState.paymentMint, ZERO_PUBKEY.toBase58());
    assert.equal(solMemberCycleState.includedShieldCount, 1);
    assert.equal(solMemberCycleState.thresholdBps, 500);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, solReserveAddress)).reservedRefundAmount,
      300n,
    );

    const settleSolTx = protocol.buildSettleCycleCommitmentSolTx({
      oracle: state.oracle.publicKey,
      poolAddress: cyclePool.poolAddress,
      member: state.alternateMember.publicKey,
      seriesRefHashHex: cycleSeriesRefHashHex,
      periodIndex: 0n,
      passed: false,
      shieldConsumed: true,
      settledHealthAlphaScore: 0,
      recipientSystemAccount: state.alternateMember.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
      cohortHashHex: "00".repeat(32),
    });
    const poolLamportsBefore = await harness.snapshotAccount(cyclePool.poolAddress);
    const settleSolResult = await harness.send(
      "settle_cycle_commitment_sol",
      settleSolTx,
      [state.oracle],
    );
    scenario.recordSuccess(settleSolResult);
    assertChanged(
      poolLamportsBefore,
      await harness.snapshotAccount(cyclePool.poolAddress),
      "settle_cycle_commitment_sol pool",
    );
    const settledSolCycleState = await decodeMemberCycle(harness.connection, solMemberCycleAddress);
    assert.equal(settledSolCycleState.status, 2);
    assert.equal(settledSolCycleState.passed, false);
    assert.equal(settledSolCycleState.shieldConsumed, true);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, solReserveAddress)).reservedRefundAmount,
      0n,
    );
  } finally {
    scenario.finish();
  }
}

async function scenarioTreasuryWithdrawalAndCoverageClaimLifecycle(
  harness: LocalnetHarness,
  state: GlobalState,
) {
  const scenario = harness.beginScenario("treasury-withdrawal-and-coverage-claim-lifecycle");
  try {
    await ensureMainOracleReady(harness, state);

    const payoutMint = await harness.createMint(state.governanceAuthority, 6);
    const governancePayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.governanceAuthority.publicKey,
      })
    ).address;
    const oraclePayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.oracle.publicKey,
      })
    ).address;
    const coverageMemberPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.coverageMember.publicKey,
      })
    ).address;
    const alternateMemberPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.alternateMember.publicKey,
      })
    ).address;
    const openMemberPayoutTokenAccount = (
      await harness.getOrCreateAta({
        payer: state.governanceAuthority,
        mint: payoutMint,
        owner: state.openMember.publicKey,
      })
    ).address;

    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: payoutMint,
      destination: governancePayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 40_000_000n,
    });
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: payoutMint,
      destination: coverageMemberPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 8_000_000n,
    });
    await harness.mintTo({
      payer: state.governanceAuthority,
      mint: payoutMint,
      destination: openMemberPayoutTokenAccount,
      authority: state.governanceAuthority,
      amount: 8_000_000n,
    });

    const claimPool = await createPool({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "claim-flow",
      organizationRef: "claim-flow-org",
      payoutLamportsPerPass: 250_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: payoutMint,
      poolType: protocol.POOL_TYPE_COVERAGE,
    });
    scenario.recordSuccess(claimPool.createResult);
    scenario.recordSuccess(claimPool.statusResult);

    await approveOracleForPool({
      harness,
      authority: state.governanceAuthority,
      poolAddress: claimPool.poolAddress,
      oracle: state.oracle.publicKey,
    });
    await harness.send(
      "set_pool_oracle_permissions",
      protocol.buildSetPoolOraclePermissionsTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        oracle: state.oracle.publicKey,
        permissions: ORACLE_PERMISSION_ALL,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    await harness.send(
      "set_pool_automation_policy",
      protocol.buildSetPoolAutomationPolicyTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        recentBlockhash: await harness.latestBlockhash(),
        oracleAutomationMode: protocol.AUTOMATION_MODE_ATTESTED,
        claimAutomationMode: protocol.AUTOMATION_MODE_ATTESTED,
        allowedAiRolesMask: 1 << protocol.AI_ROLE_CLAIM_PROCESSOR,
        maxAutoClaimAmount: 1_000_000n,
        requiredAttestationProviderRefHashHex: "00".repeat(32),
      }),
      [state.governanceAuthority],
    );

    const claimPoolAssetVault = protocol.derivePoolAssetVaultPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      payoutMint,
    });
    const claimPoolVaultTokenAccount = Keypair.generate();
    await harness.send(
      "fund_pool_spl",
      protocol.buildFundPoolSplTx({
        funder: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        payoutMint,
        poolVaultTokenAccount: claimPoolVaultTokenAccount.publicKey,
        poolVaultTokenAccountSigner: true,
        funderTokenAccount: governancePayoutTokenAccount,
        recentBlockhash: await harness.latestBlockhash(),
        amount: 6_000_000n,
      }),
      [state.governanceAuthority, claimPoolVaultTokenAccount],
    );

    const claimSeriesRefHashHex = harness.sha256Hex("claim-flow-series");
    const enrollCoverageClaimMemberTx = protocol.buildEnrollMemberOpenTx({
      member: state.coverageMember.publicKey,
      poolAddress: claimPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const enrollAlternateClaimMemberTx = protocol.buildEnrollMemberOpenTx({
      member: state.alternateMember.publicKey,
      poolAddress: claimPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    const enrollOpenClaimMemberTx = protocol.buildEnrollMemberOpenTx({
      member: state.openMember.publicKey,
      poolAddress: claimPool.poolAddress,
      recentBlockhash: await harness.latestBlockhash(),
    });
    await harness.send("enroll_member_open", enrollCoverageClaimMemberTx, [state.coverageMember]);
    await harness.send("enroll_member_open", enrollAlternateClaimMemberTx, [state.alternateMember]);
    await harness.send("enroll_member_open", enrollOpenClaimMemberTx, [state.openMember]);
    await createPolicySeriesForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: claimPool.poolAddress,
      seriesRefHashHex: claimSeriesRefHashHex,
      planMode: protocol.PLAN_MODE_REIMBURSEMENT,
      displayName: "Claim Flow Series",
      metadataUri: "https://claim-flow.local/series",
      termsHashHex: harness.sha256Hex("claim-flow-series-terms"),
      durationSecs: 14_400n,
      premiumDueEverySecs: 3_600n,
      premiumGraceSecs: 3_600n,
      premiumAmount: 2_400n,
    });

    const policyStartsAt = nowTs() - 120n;
    const issuePolicyPosition = async (member: PublicKey) => {
      const tx = protocol.buildIssuePolicyPositionTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member,
        seriesRefHashHex: claimSeriesRefHashHex,
        startsAtTs: policyStartsAt,
        recentBlockhash: await harness.latestBlockhash(),
      });
      await harness.send("issue_policy_position", tx, [state.governanceAuthority]);
    };
    await issuePolicyPosition(state.coverageMember.publicKey);
    await issuePolicyPosition(state.alternateMember.publicKey);
    await issuePolicyPosition(state.openMember.publicKey);

    const coverageMemberPolicyAddress = protocol.derivePolicyPositionPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
    });
    const coverageMemberLedgerAddress = protocol.derivePremiumLedgerPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
    });
    const coverageMemberPolicyState = await decodePolicyPosition(
      harness.connection,
      coverageMemberPolicyAddress,
    );
    assert.equal(coverageMemberPolicyState.pool, claimPool.poolAddress.toBase58());
    assert.equal(coverageMemberPolicyState.member, state.coverageMember.publicKey.toBase58());
    assert.equal(coverageMemberPolicyState.seriesRefHashHex, claimSeriesRefHashHex);
    const claimSeriesAddress = protocol.derivePolicySeriesPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
    });
    const payPremiumOnchainTx = protocol.buildPayPremiumOnchainTx({
      payer: state.coverageMember.publicKey,
      poolAddress: claimPool.poolAddress,
      member: state.coverageMember.publicKey,
      seriesRefHashHex: claimSeriesRefHashHex,
      payoutMint,
      periodIndex: 0n,
      amount: 2_400n,
      payerTokenAccount: coverageMemberPayoutTokenAccount,
      poolVaultTokenAccount: claimPoolVaultTokenAccount.publicKey,
      recentBlockhash: await harness.latestBlockhash(),
    });
    assert.equal(
      payPremiumOnchainTx.instructions[0]?.keys[2]?.pubkey.toBase58(),
      claimPool.poolAddress.toBase58(),
    );
    assert.equal(
      payPremiumOnchainTx.instructions[0]?.keys[4]?.pubkey.toBase58(),
      claimSeriesAddress.toBase58(),
    );
    assert.equal(
      payPremiumOnchainTx.instructions[0]?.keys[5]?.pubkey.toBase58(),
      coverageMemberPolicyAddress.toBase58(),
    );
    assert.equal(
      payPremiumOnchainTx.instructions[0]?.keys[6]?.pubkey.toBase58(),
      state.coverageMember.publicKey.toBase58(),
    );
    const payPremiumOnchainResult = await harness.send(
      "pay_premium_onchain",
      payPremiumOnchainTx,
      [state.coverageMember],
    );
    scenario.recordSuccess(payPremiumOnchainResult);
    const coverageMemberLedgerState = await decodePremiumLedger(harness.connection, coverageMemberLedgerAddress);
    assert.equal(coverageMemberLedgerState.periodIndex, 0n);
    assert.equal(coverageMemberLedgerState.amount, 2_400n);
    assert.equal(
      (await decodePolicyPosition(harness.connection, coverageMemberPolicyAddress)).nextDueAt > policyStartsAt,
      true,
    );

    const alternateMemberLedgerAddress = protocol.derivePremiumLedgerPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
      member: state.alternateMember.publicKey,
    });
    const premiumReplayHashHex = harness.sha256Hex("claim-flow-offchain-premium");
    const premiumReplayAddress = protocol.derivePremiumReplayPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
      member: state.alternateMember.publicKey,
      replayHash: Buffer.from(premiumReplayHashHex, "hex"),
    });
    const premiumReplayBefore = await harness.snapshotAccount(premiumReplayAddress);
    const attestPremiumResult = await harness.send(
      "attest_premium_paid_offchain",
      protocol.buildAttestPremiumPaidOffchainTx({
        oracle: state.oracle.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.alternateMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        periodIndex: 0n,
        replayHashHex: premiumReplayHashHex,
        amount: 2_200n,
        paidAtTs: nowTs() - 30n,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.oracle],
    );
    scenario.recordSuccess(attestPremiumResult);
    assert.equal(
      (await decodePremiumLedger(harness.connection, alternateMemberLedgerAddress)).amount,
      2_200n,
    );
    assertChanged(
      premiumReplayBefore,
      await harness.snapshotAccount(premiumReplayAddress),
      "attest_premium_paid_offchain replay",
    );

    const claimOneIntentHashHex = harness.sha256Hex("claim-flow-intent-1");
    const claimOneAddress = protocol.deriveCoverageClaimPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
      member: state.coverageMember.publicKey,
      intentHash: Buffer.from(claimOneIntentHashHex, "hex"),
    });
    const submitClaimOneResult = await harness.send(
      "submit_coverage_claim",
      protocol.buildSubmitCoverageClaimTx({
        claimant: state.coverageMember.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.coverageMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimOneIntentHashHex,
        eventHashHex: harness.sha256Hex("claim-flow-event-1"),
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.coverageMember],
    );
    scenario.recordSuccess(submitClaimOneResult);
    assert.ok(
      submitClaimOneResult.events.includes("CoverageClaimStatusChangedEvent"),
      "submit_coverage_claim must emit CoverageClaimStatusChangedEvent",
    );
    assert.equal(
      (await decodeCoverageClaim(harness.connection, claimOneAddress)).status,
      protocol.COVERAGE_CLAIM_STATUS_SUBMITTED,
    );

    await harness.expectCustomError({
      caseId: COVERED_ERROR_CASES.InvalidCoverageClaimStateTransition ?? "coverage-claim-close-before-decision",
      expectedErrorName: "InvalidCoverageClaimStateTransition",
      tx: protocol.buildCloseCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.coverageMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimOneIntentHashHex,
        payoutMint,
        recoveryAmount: 0n,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      signers: [state.governanceAuthority],
      unchangedAddresses: [claimOneAddress],
    });
    scenario.recordFailure(
      COVERED_ERROR_CASES.InvalidCoverageClaimStateTransition ?? "coverage-claim-close-before-decision",
    );

    const reviewClaimOneResult = await harness.send(
      "review_coverage_claim",
      protocol.buildReviewCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.coverageMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimOneIntentHashHex,
        requestedAmount: 500_000n,
        evidenceHashHex: harness.sha256Hex("claim-flow-evidence-1"),
        interopRefHashHex: harness.sha256Hex("claim-flow-interop-1"),
        claimFamily: protocol.COVERAGE_CLAIM_FAMILY_REIMBURSEMENT,
        interopProfileHashHex: harness.sha256Hex("claim-flow-profile-1"),
        codeSystemFamilyHashHex: harness.sha256Hex("claim-flow-codes-1"),
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(reviewClaimOneResult);
    assert.equal(
      (await decodeCoverageClaim(harness.connection, claimOneAddress)).status,
      protocol.COVERAGE_CLAIM_STATUS_UNDER_REVIEW,
    );

    const attachDecisionSupportResult = await harness.send(
      "attach_coverage_claim_decision_support",
      protocol.buildAttachCoverageClaimDecisionSupportTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.coverageMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimOneIntentHashHex,
        aiDecisionHashHex: harness.sha256Hex("claim-flow-ai-decision-1"),
        aiPolicyHashHex: harness.sha256Hex("claim-flow-ai-policy-1"),
        aiExecutionEnvironmentHashHex: harness.sha256Hex("claim-flow-ai-env-1"),
        aiAttestationRefHashHex: harness.sha256Hex("claim-flow-ai-attestation-1"),
        aiRole: protocol.AI_ROLE_CLAIM_PROCESSOR,
        automationMode: protocol.AUTOMATION_MODE_ATTESTED,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(attachDecisionSupportResult);
    const attachedClaimState = await decodeCoverageClaim(harness.connection, claimOneAddress);
    assert.equal(attachedClaimState.aiAutomationMode, protocol.AUTOMATION_MODE_ATTESTED);
    assert.equal(
      attachedClaimState.aiDecisionHashHex,
      harness.sha256Hex("claim-flow-ai-decision-1"),
    );

    const claimReserveAddress = protocol.derivePoolTreasuryReservePda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      paymentMint: payoutMint,
    });
    const approveClaimResult = await harness.send(
      "approve_coverage_claim",
      protocol.buildApproveCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.coverageMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimOneIntentHashHex,
        approvedAmount: 300_000n,
        payoutMint,
        poolAssetVault: claimPoolAssetVault,
        poolVaultTokenAccount: claimPoolVaultTokenAccount.publicKey,
        decisionReasonHashHex: harness.sha256Hex("claim-flow-approve-reason-1"),
        adjudicationRefHashHex: harness.sha256Hex("claim-flow-adjudication-1"),
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(approveClaimResult);
    const approvedClaimState = await decodeCoverageClaim(harness.connection, claimOneAddress);
    assert.equal(approvedClaimState.status, protocol.COVERAGE_CLAIM_STATUS_APPROVED);
    assert.equal(approvedClaimState.reservedAmount, 300_000n);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, claimReserveAddress)).reservedCoverageClaimAmount,
      300_000n,
    );

    const claimOneRecipientBefore = await harness.snapshotTokenAccount(coverageMemberPayoutTokenAccount);
    const payClaimResult = await harness.send(
      "pay_coverage_claim",
      protocol.buildPayCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        claimant: state.coverageMember.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.coverageMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimOneIntentHashHex,
        payoutAmount: 300_000n,
        payoutMint,
        recipientSystemAccount: state.coverageMember.publicKey,
        poolAssetVault: claimPoolAssetVault,
        poolVaultTokenAccount: claimPoolVaultTokenAccount.publicKey,
        recipientTokenAccount: coverageMemberPayoutTokenAccount,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(payClaimResult);
    assert.ok(
      payClaimResult.events.includes("CoverageClaimPayoutCompletedEvent"),
      "pay_coverage_claim must emit CoverageClaimPayoutCompletedEvent",
    );
    assertTokenChanged(
      claimOneRecipientBefore,
      await harness.snapshotTokenAccount(coverageMemberPayoutTokenAccount),
      "pay_coverage_claim recipient",
    );
    const paidClaimState = await decodeCoverageClaim(harness.connection, claimOneAddress);
    assert.equal(paidClaimState.status, protocol.COVERAGE_CLAIM_STATUS_PAID);
    assert.equal(paidClaimState.paidAmount, 300_000n);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, claimReserveAddress)).reservedCoverageClaimAmount,
      0n,
    );

    const closeClaimResult = await harness.send(
      "close_coverage_claim",
      protocol.buildCloseCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.coverageMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimOneIntentHashHex,
        payoutMint,
        recoveryAmount: 25_000n,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(closeClaimResult);
    const closedClaimState = await decodeCoverageClaim(harness.connection, claimOneAddress);
    assert.equal(closedClaimState.status, protocol.COVERAGE_CLAIM_STATUS_CLOSED);
    assert.equal(closedClaimState.recoveryAmount, 25_000n);
    assert.equal(
      (await decodePoolTreasuryReserve(harness.connection, claimReserveAddress)).recoveredCoverageClaimAmount,
      25_000n,
    );

    const claimTwoIntentHashHex = harness.sha256Hex("claim-flow-intent-2");
    const claimTwoAddress = protocol.deriveCoverageClaimPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
      member: state.alternateMember.publicKey,
      intentHash: Buffer.from(claimTwoIntentHashHex, "hex"),
    });
    const submitClaimTwoResult = await harness.send(
      "submit_coverage_claim",
      protocol.buildSubmitCoverageClaimTx({
        claimant: state.alternateMember.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.alternateMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimTwoIntentHashHex,
        eventHashHex: harness.sha256Hex("claim-flow-event-2"),
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.alternateMember],
    );
    scenario.recordSuccess(submitClaimTwoResult);
    await harness.send(
      "review_coverage_claim",
      protocol.buildReviewCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.alternateMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimTwoIntentHashHex,
        requestedAmount: 180_000n,
        evidenceHashHex: harness.sha256Hex("claim-flow-evidence-2"),
        interopRefHashHex: harness.sha256Hex("claim-flow-interop-2"),
        claimFamily: protocol.COVERAGE_CLAIM_FAMILY_FAST,
        interopProfileHashHex: harness.sha256Hex("claim-flow-profile-2"),
        codeSystemFamilyHashHex: harness.sha256Hex("claim-flow-codes-2"),
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    const denyClaimResult = await harness.send(
      "deny_coverage_claim",
      protocol.buildDenyCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.alternateMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimTwoIntentHashHex,
        payoutMint,
        decisionReasonHashHex: harness.sha256Hex("claim-flow-deny-reason-2"),
        adjudicationRefHashHex: harness.sha256Hex("claim-flow-deny-adjudication-2"),
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(denyClaimResult);
    assert.equal(
      (await decodeCoverageClaim(harness.connection, claimTwoAddress)).status,
      protocol.COVERAGE_CLAIM_STATUS_DENIED,
    );

    const claimThreeIntentHashHex = harness.sha256Hex("claim-flow-intent-3");
    const claimThreeAddress = protocol.deriveCoverageClaimPda({
      programId: harness.programId,
      poolAddress: claimPool.poolAddress,
      seriesRefHash: Buffer.from(claimSeriesRefHashHex, "hex"),
      member: state.openMember.publicKey,
      intentHash: Buffer.from(claimThreeIntentHashHex, "hex"),
    });
    const submitClaimThreeResult = await harness.send(
      "submit_coverage_claim",
      protocol.buildSubmitCoverageClaimTx({
        claimant: state.openMember.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.openMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimThreeIntentHashHex,
        eventHashHex: harness.sha256Hex("claim-flow-event-3"),
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.openMember],
    );
    scenario.recordSuccess(submitClaimThreeResult);
    const claimThreeRecipientBefore = await harness.snapshotTokenAccount(openMemberPayoutTokenAccount);
    const settleClaimResult = await harness.send(
      "settle_coverage_claim",
      protocol.buildSettleCoverageClaimTx({
        authority: state.governanceAuthority.publicKey,
        claimant: state.openMember.publicKey,
        poolAddress: claimPool.poolAddress,
        member: state.openMember.publicKey,
        seriesRefHashHex: claimSeriesRefHashHex,
        intentHashHex: claimThreeIntentHashHex,
        payoutAmount: 200_000n,
        payoutMint,
        recipientSystemAccount: state.openMember.publicKey,
        poolAssetVault: claimPoolAssetVault,
        poolVaultTokenAccount: claimPoolVaultTokenAccount.publicKey,
        recipientTokenAccount: openMemberPayoutTokenAccount,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority, state.openMember],
    );
    scenario.recordSuccess(settleClaimResult);
    assertTokenChanged(
      claimThreeRecipientBefore,
      await harness.snapshotTokenAccount(openMemberPayoutTokenAccount),
      "settle_coverage_claim recipient",
    );
    const settledClaimState = await decodeCoverageClaim(harness.connection, claimThreeAddress);
    assert.equal(settledClaimState.status, protocol.COVERAGE_CLAIM_STATUS_PAID);
    assert.equal(settledClaimState.paidAmount, 200_000n);

    const feePool = await createPool({
      harness,
      authority: state.governanceAuthority,
      poolIdPrefix: "fee-flow",
      organizationRef: "fee-flow-org",
      payoutLamportsPerPass: 150_000n,
      membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
      payoutAssetMint: payoutMint,
      poolType: protocol.POOL_TYPE_COVERAGE,
    });
    scenario.recordSuccess(feePool.createResult);
    scenario.recordSuccess(feePool.statusResult);

    await harness.send(
      "set_pool_oracle_policy",
      protocol.buildSetPoolOraclePolicyTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: feePool.poolAddress,
        recentBlockhash: await harness.latestBlockhash(),
        quorumM: 1,
        quorumN: 1,
        requireVerifiedSchema: false,
        oracleFeeBps: 100,
        allowDelegateClaim: false,
        challengeWindowSecs: 0n,
      }),
      [state.governanceAuthority],
    );
    await approveOracleForPool({
      harness,
      authority: state.governanceAuthority,
      poolAddress: feePool.poolAddress,
      oracle: state.oracle.publicKey,
    });
    await harness.send(
      "set_pool_oracle_permissions",
      protocol.buildSetPoolOraclePermissionsTx({
        authority: state.governanceAuthority.publicKey,
        poolAddress: feePool.poolAddress,
        oracle: state.oracle.publicKey,
        permissions: ORACLE_PERMISSION_ALL,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );

    const feeSeriesRefHashHex = harness.sha256Hex("fee-flow-series");
    await createPolicySeriesForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: feePool.poolAddress,
      seriesRefHashHex: feeSeriesRefHashHex,
      planMode: protocol.PLAN_MODE_REWARD,
      displayName: "Fee Flow Series",
      metadataUri: "https://fee-flow.local/series",
      termsHashHex: harness.sha256Hex("fee-flow-series-terms"),
      durationSecs: 10_800n,
      premiumDueEverySecs: 3_600n,
      premiumGraceSecs: 600n,
      premiumAmount: 2_500n,
    });
    await upsertPolicySeriesPaymentOptionForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: feePool.poolAddress,
      seriesRefHashHex: feeSeriesRefHashHex,
      paymentMint: payoutMint,
      paymentAmount: 2_500n,
    });
    await upsertPolicySeriesPaymentOptionForScenario({
      harness,
      authority: state.governanceAuthority,
      poolAddress: feePool.poolAddress,
      seriesRefHashHex: feeSeriesRefHashHex,
      paymentMint: ZERO_PUBKEY,
      paymentAmount: 2_500n,
    });

    const splFeeNonceHashHex = harness.sha256Hex("fee-flow-spl-nonce");
    const splFeeQuoteMetaHashHex = harness.sha256Hex("fee-flow-spl-meta");
    const splFeeQuoteBreakdown = computeCycleFeeBreakdown({
      premiumAmountRaw: 2_500n,
      bondAmountRaw: 250n,
      shieldFeeRaw: 0n,
      protocolFeeBps: 300,
      oracleFeeBps: 100,
    });
    const splFeeQuoteInstruction = await harness.quoteVerificationInstruction({
      oracle: state.oracle,
      poolAddress: feePool.poolAddress,
      member: state.openMember.publicKey,
      seriesRefHashHex: feeSeriesRefHashHex,
      paymentMint: payoutMint,
      premiumAmountRaw: 2_500n,
      canonicalPremiumAmount: 2_500n,
      periodIndex: 0n,
      commitmentEnabled: true,
      bondAmountRaw: 250n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: splFeeQuoteBreakdown.protocolFeeRaw,
      oracleFeeRaw: splFeeQuoteBreakdown.oracleFeeRaw,
      netPoolPremiumRaw: splFeeQuoteBreakdown.netPoolPremiumRaw,
      totalAmountRaw: splFeeQuoteBreakdown.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 500,
      outcomeThresholdScore: 0,
      cohortHashHex: "00".repeat(32),
      expiresAtTs: nowTs() + 3_600n,
      nonceHashHex: splFeeNonceHashHex,
      quoteMetaHashHex: splFeeQuoteMetaHashHex,
    });
    const activateFeeSplTx = addComputeBudget(protocol.buildActivateCycleWithQuoteSplTx({
      payer: state.openMember.publicKey,
      poolAddress: feePool.poolAddress,
      oracle: state.oracle.publicKey,
      paymentMint: payoutMint,
      payerTokenAccount: openMemberPayoutTokenAccount,
      seriesRefHashHex: feeSeriesRefHashHex,
      periodIndex: 0n,
      nonceHashHex: splFeeNonceHashHex,
      premiumAmountRaw: 2_500n,
      canonicalPremiumAmount: 2_500n,
      commitmentEnabled: true,
      bondAmountRaw: 250n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: splFeeQuoteBreakdown.protocolFeeRaw,
      oracleFeeRaw: splFeeQuoteBreakdown.oracleFeeRaw,
      netPoolPremiumRaw: splFeeQuoteBreakdown.netPoolPremiumRaw,
      totalAmountRaw: splFeeQuoteBreakdown.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 500,
      outcomeThresholdScore: 0,
      cohortHashHex: "00".repeat(32),
      expiresAtTs: nowTs() + 3_600n,
      quoteMetaHashHex: splFeeQuoteMetaHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      quoteVerificationInstruction: splFeeQuoteInstruction,
    }));
    const splFeeLookupTable = await harness.createLookupTable(
      state.governanceAuthority,
      lookupAddressesForTransaction(activateFeeSplTx),
    );
    await harness.send(
      "activate_cycle_with_quote_spl",
      activateFeeSplTx,
      [state.openMember],
      [splFeeLookupTable],
    );
    await harness.send(
      "settle_cycle_commitment",
      protocol.buildSettleCycleCommitmentTx({
        oracle: state.oracle.publicKey,
        poolAddress: feePool.poolAddress,
        member: state.openMember.publicKey,
        seriesRefHashHex: feeSeriesRefHashHex,
        paymentMint: payoutMint,
        periodIndex: 0n,
        passed: true,
        shieldConsumed: false,
        settledHealthAlphaScore: 0,
        recipientTokenAccount: openMemberPayoutTokenAccount,
        recentBlockhash: await harness.latestBlockhash(),
        cohortHashHex: "00".repeat(32),
      }),
      [state.oracle],
    );

    const solFeeNonceHashHex = harness.sha256Hex("fee-flow-sol-nonce");
    const solFeeQuoteMetaHashHex = harness.sha256Hex("fee-flow-sol-meta");
    const solFeeQuoteBreakdown = computeCycleFeeBreakdown({
      premiumAmountRaw: 2_500n,
      bondAmountRaw: 250n,
      shieldFeeRaw: 0n,
      protocolFeeBps: 300,
      oracleFeeBps: 100,
    });
    const solFeeQuoteInstruction = await harness.quoteVerificationInstruction({
      oracle: state.oracle,
      poolAddress: feePool.poolAddress,
      member: state.alternateMember.publicKey,
      seriesRefHashHex: feeSeriesRefHashHex,
      premiumAmountRaw: 2_500n,
      canonicalPremiumAmount: 2_500n,
      periodIndex: 0n,
      commitmentEnabled: true,
      bondAmountRaw: 250n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: solFeeQuoteBreakdown.protocolFeeRaw,
      oracleFeeRaw: solFeeQuoteBreakdown.oracleFeeRaw,
      netPoolPremiumRaw: solFeeQuoteBreakdown.netPoolPremiumRaw,
      totalAmountRaw: solFeeQuoteBreakdown.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 500,
      outcomeThresholdScore: 0,
      cohortHashHex: "00".repeat(32),
      expiresAtTs: nowTs() + 3_600n,
      nonceHashHex: solFeeNonceHashHex,
      quoteMetaHashHex: solFeeQuoteMetaHashHex,
    });
    const activateFeeSolTx = addComputeBudget(protocol.buildActivateCycleWithQuoteSolTx({
      payer: state.alternateMember.publicKey,
      poolAddress: feePool.poolAddress,
      oracle: state.oracle.publicKey,
      seriesRefHashHex: feeSeriesRefHashHex,
      periodIndex: 0n,
      nonceHashHex: solFeeNonceHashHex,
      premiumAmountRaw: 2_500n,
      canonicalPremiumAmount: 2_500n,
      commitmentEnabled: true,
      bondAmountRaw: 250n,
      shieldFeeRaw: 0n,
      protocolFeeRaw: solFeeQuoteBreakdown.protocolFeeRaw,
      oracleFeeRaw: solFeeQuoteBreakdown.oracleFeeRaw,
      netPoolPremiumRaw: solFeeQuoteBreakdown.netPoolPremiumRaw,
      totalAmountRaw: solFeeQuoteBreakdown.totalAmountRaw,
      includedShieldCount: 0,
      thresholdBps: 500,
      outcomeThresholdScore: 0,
      cohortHashHex: "00".repeat(32),
      expiresAtTs: nowTs() + 3_600n,
      quoteMetaHashHex: solFeeQuoteMetaHashHex,
      recentBlockhash: await harness.latestBlockhash(),
      quoteVerificationInstruction: solFeeQuoteInstruction,
    }));
    const solFeeLookupTable = await harness.createLookupTable(
      state.governanceAuthority,
      lookupAddressesForTransaction(activateFeeSolTx),
    );
    await harness.send(
      "activate_cycle_with_quote_sol",
      activateFeeSolTx,
      [state.alternateMember],
      [solFeeLookupTable],
    );
    await harness.send(
      "settle_cycle_commitment_sol",
      protocol.buildSettleCycleCommitmentSolTx({
        oracle: state.oracle.publicKey,
        poolAddress: feePool.poolAddress,
        member: state.alternateMember.publicKey,
        seriesRefHashHex: feeSeriesRefHashHex,
        periodIndex: 0n,
        passed: true,
        shieldConsumed: false,
        settledHealthAlphaScore: 0,
        recipientSystemAccount: state.alternateMember.publicKey,
        recentBlockhash: await harness.latestBlockhash(),
        cohortHashHex: "00".repeat(32),
      }),
      [state.oracle],
    );

    const feePoolAssetVault = protocol.derivePoolAssetVaultPda({
      programId: harness.programId,
      poolAddress: feePool.poolAddress,
      payoutMint,
    });
    const feePoolVaultTokenAccount = getAssociatedTokenAddressSync(payoutMint, feePoolAssetVault, true);

    const poolTreasurySplRecipientBefore = await harness.snapshotTokenAccount(governancePayoutTokenAccount);
    const withdrawPoolTreasurySplResult = await harness.send(
      "withdraw_pool_treasury_spl",
      protocol.buildWithdrawPoolTreasurySplTx({
        oracle: state.oracle.publicKey,
        poolAddress: feePool.poolAddress,
        paymentMint: payoutMint,
        recipientTokenAccount: governancePayoutTokenAccount,
        amount: splFeeQuoteBreakdown.netPoolPremiumRaw,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.oracle],
    );
    scenario.recordSuccess(withdrawPoolTreasurySplResult);
    assertTokenChanged(
      poolTreasurySplRecipientBefore,
      await harness.snapshotTokenAccount(governancePayoutTokenAccount),
      "withdraw_pool_treasury_spl recipient",
    );

    const poolTreasurySolRecipientBefore = await harness.snapshotAccount(state.governanceAuthority.publicKey);
    const withdrawPoolTreasurySolResult = await harness.send(
      "withdraw_pool_treasury_sol",
      protocol.buildWithdrawPoolTreasurySolTx({
        oracle: state.oracle.publicKey,
        poolAddress: feePool.poolAddress,
        recipientSystemAccount: state.governanceAuthority.publicKey,
        amount: solFeeQuoteBreakdown.netPoolPremiumRaw,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.oracle],
    );
    scenario.recordSuccess(withdrawPoolTreasurySolResult);
    assertChanged(
      poolTreasurySolRecipientBefore,
      await harness.snapshotAccount(state.governanceAuthority.publicKey),
      "withdraw_pool_treasury_sol recipient",
    );

    const protocolFeeSplRecipientBefore = await harness.snapshotTokenAccount(governancePayoutTokenAccount);
    const withdrawProtocolFeeSplResult = await harness.send(
      "withdraw_protocol_fee_spl",
      protocol.buildWithdrawProtocolFeeSplTx({
        governanceAuthority: state.governanceAuthority.publicKey,
        paymentMint: payoutMint,
        recipientTokenAccount: governancePayoutTokenAccount,
        amount: splFeeQuoteBreakdown.protocolFeeRaw,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(withdrawProtocolFeeSplResult);
    assertTokenChanged(
      protocolFeeSplRecipientBefore,
      await harness.snapshotTokenAccount(governancePayoutTokenAccount),
      "withdraw_protocol_fee_spl recipient",
    );

    const protocolFeeSolRecipientBefore = await harness.snapshotAccount(state.governanceAuthority.publicKey);
    const withdrawProtocolFeeSolResult = await harness.send(
      "withdraw_protocol_fee_sol",
      protocol.buildWithdrawProtocolFeeSolTx({
        governanceAuthority: state.governanceAuthority.publicKey,
        recipientSystemAccount: state.governanceAuthority.publicKey,
        amount: solFeeQuoteBreakdown.protocolFeeRaw,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.governanceAuthority],
    );
    scenario.recordSuccess(withdrawProtocolFeeSolResult);
    assertChanged(
      protocolFeeSolRecipientBefore,
      await harness.snapshotAccount(state.governanceAuthority.publicKey),
      "withdraw_protocol_fee_sol recipient",
    );

    const oracleFeeSplRecipientBefore = await harness.snapshotTokenAccount(oraclePayoutTokenAccount);
    const withdrawOracleFeeSplResult = await harness.send(
      "withdraw_pool_oracle_fee_spl",
      protocol.buildWithdrawPoolOracleFeeSplTx({
        oracle: state.oracle.publicKey,
        poolAddress: feePool.poolAddress,
        paymentMint: payoutMint,
        recipientTokenAccount: oraclePayoutTokenAccount,
        amount: splFeeQuoteBreakdown.oracleFeeRaw,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.oracle],
    );
    scenario.recordSuccess(withdrawOracleFeeSplResult);
    assertTokenChanged(
      oracleFeeSplRecipientBefore,
      await harness.snapshotTokenAccount(oraclePayoutTokenAccount),
      "withdraw_pool_oracle_fee_spl recipient",
    );

    const oracleFeeSolRecipientBefore = await harness.snapshotAccount(state.oracle.publicKey);
    const withdrawOracleFeeSolResult = await harness.send(
      "withdraw_pool_oracle_fee_sol",
      protocol.buildWithdrawPoolOracleFeeSolTx({
        oracle: state.oracle.publicKey,
        poolAddress: feePool.poolAddress,
        recipientSystemAccount: state.oracle.publicKey,
        amount: solFeeQuoteBreakdown.oracleFeeRaw,
        recentBlockhash: await harness.latestBlockhash(),
      }),
      [state.oracle],
    );
    scenario.recordSuccess(withdrawOracleFeeSolResult);
    assertChanged(
      oracleFeeSolRecipientBefore,
      await harness.snapshotAccount(state.oracle.publicKey),
      "withdraw_pool_oracle_fee_sol recipient",
    );

    const feePoolVaultState = await getAccount(harness.connection, feePoolVaultTokenAccount, "confirmed");
    assert.equal(
      (await decodePoolAssetVault(harness.connection, feePoolAssetVault)).vaultTokenAccount,
      feePoolVaultTokenAccount.toBase58(),
    );
    assert.ok(feePoolVaultState.amount >= 0n);
  } finally {
    scenario.finish();
  }
}

test("localnet protocol surface matrix", async () => {
  const harness = new LocalnetHarness();
  const state = await createGlobalState(harness);
  const liveInstructionNames = instructionSurface().map((instruction) => instruction.name).sort();
  const manifestInstructions = manifestInstructionAssignments().sort();
  const duplicateManifestInstructions = manifestInstructions.filter(
    (name, index) => manifestInstructions.indexOf(name) !== index,
  );
  const instructionExceptionNames = Object.keys(INSTRUCTION_EXCEPTION_REASONS).sort();
  const unexpectedInstructionExceptions = instructionExceptionNames.filter(
    (name) => !liveInstructionNames.includes(name),
  );
  const liveErrorNames = idlErrors().map((entry) => entry.name).sort();

  assert.deepEqual(duplicateManifestInstructions, [], "manifest lists duplicate instructions");
  assert.deepEqual(manifestInstructions, liveInstructionNames, "manifest instruction assignment drifted from contract surface");
  assert.deepEqual(
    unexpectedInstructionExceptions,
    [],
    "instruction exception manifest references unknown instructions",
  );
  assert.deepEqual([...KNOWN_ERROR_NAMES].sort(), liveErrorNames, "tracked error list drifted from the live IDL");

  try {
    for (const scenarioName of SCENARIO_ORDER) {
      if (!scenarioEnabled(harness, scenarioName)) {
        continue;
      }
      if (scenarioName === "protocol-governance-oracle-lifecycle") {
        await scenarioProtocolGovernanceOracleLifecycle(harness, state);
        continue;
      }
      if (scenarioName === "legacy-registry-compatibility") {
        await scenarioLegacyRegistryCompatibility(harness, state);
        continue;
      }
      if (scenarioName === "pool-schema-member-lifecycle") {
        await scenarioPoolSchemaMemberLifecycle(harness, state);
        continue;
      }
      if (scenarioName === "direct-liquidity-lifecycle") {
        await scenarioDirectLiquidityLifecycle(harness, state);
        continue;
      }
      if (scenarioName === "queued-liquidity-lifecycle") {
        await scenarioQueuedLiquidityLifecycle(harness, state);
        continue;
      }
      if (scenarioName === "reward-attestation-dispute-lifecycle") {
        await scenarioRewardAttestationDisputeLifecycle(harness, state);
        continue;
      }
      if (scenarioName === "coverage-product-policy-premium-lifecycle") {
        await scenarioCoverageProductPolicyPremiumLifecycle(harness, state);
        continue;
      }
      if (scenarioName === "quoted-cycle-activation-settlement-cohort-lifecycle") {
        await scenarioQuotedCycleActivationSettlementCohortLifecycle(harness, state);
        continue;
      }
      if (scenarioName === "treasury-withdrawal-and-coverage-claim-lifecycle") {
        await scenarioTreasuryWithdrawalAndCoverageClaimLifecycle(harness, state);
        continue;
      }
      throw new Error(`Scenario ${scenarioName} is not implemented yet in the localnet matrix`);
    }

    if (!harness.selectedScenario) {
      harness.assertAllInstructionsCovered(manifestInstructionExceptions());
      harness.assertExpectedFailureCasesObserved(
        manifestCoveredErrorCases().map(({ errorName, caseId }) => ({
          caseId,
          errorName,
          errorCode: null,
        })),
      );
    }
  } finally {
    await harness.writeSummary({
      expectedErrorCases: manifestCoveredErrorCases().map(({ errorName, caseId }) => ({
        caseId,
        errorName,
        errorCode: null,
      })),
      instructionExceptions: manifestInstructionExceptions(),
      errorExceptions: manifestErrorExceptions(),
    });
  }
});
