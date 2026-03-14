// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import bs58 from 'bs58';
import { Keypair, PublicKey, type Connection } from '@solana/web3.js';

import protocolModule from '../frontend/lib/protocol.ts';

const protocol = protocolModule as unknown as typeof import('../frontend/lib/protocol.ts');
const contract = JSON.parse(
  readFileSync(new URL('../shared/protocol_contract.json', import.meta.url), 'utf8'),
) as { accountDiscriminators: Record<string, number[]> };

type ProgramAccountEntry = {
  pubkey: PublicKey;
  account: {
    data: Uint8Array;
  };
};

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u8(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff]);
}

function bool(value: boolean): Uint8Array {
  return u8(value ? 1 : 0);
}

function u16(value: number): Uint8Array {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function u64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, true);
  return out;
}

function i64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, value, true);
  return out;
}

function pubkey(value: PublicKey): Uint8Array {
  return value.toBytes();
}

function borshString(value: string): Uint8Array {
  const text = new TextEncoder().encode(value);
  return concat([u32(text.length), text]);
}

function bytes32(fill: number): Uint8Array {
  return new Uint8Array(32).fill(fill & 0xff);
}

function discriminator(accountName: string): Uint8Array {
  const value = contract.accountDiscriminators[accountName];
  if (!value) {
    throw new Error(`Missing discriminator for ${accountName}`);
  }
  return Uint8Array.from(value);
}

function poolAccount(params: {
  authority: PublicKey;
  poolId: string;
  organizationRef: string;
  payoutLamportsPerPass: bigint;
  membershipMode: number;
  tokenGateMint: PublicKey;
  tokenGateMinBalance: bigint;
  inviteIssuer: PublicKey;
  status: number;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('Pool'),
    pubkey(params.authority),
    borshString(params.poolId),
    borshString(params.organizationRef),
    u64(params.payoutLamportsPerPass),
    u8(params.membershipMode),
    pubkey(params.tokenGateMint),
    u64(params.tokenGateMinBalance),
    pubkey(params.inviteIssuer),
    u8(params.status),
    u8(params.bump),
  ]);
}

function oracleAccount(params: {
  oracle: PublicKey;
  active: boolean;
  bump: number;
  metadataUri: string;
}): Uint8Array {
  return concat([
    discriminator('OracleRegistryEntry'),
    pubkey(params.oracle),
    bool(params.active),
    u8(params.bump),
    borshString(params.metadataUri),
  ]);
}

function poolOracleApprovalAccount(params: {
  pool: PublicKey;
  oracle: PublicKey;
  active: boolean;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolOracleApproval'),
    pubkey(params.pool),
    pubkey(params.oracle),
    bool(params.active),
    u8(params.bump),
  ]);
}

function poolOraclePolicyAccount(params: {
  pool: PublicKey;
  quorumM: number;
  quorumN: number;
  requireVerifiedSchema: boolean;
  oracleFeeBps?: number;
  allowDelegateClaim: boolean;
  challengeWindowSecs?: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolOraclePolicy'),
    pubkey(params.pool),
    u8(params.quorumM),
    u8(params.quorumN),
    bool(params.requireVerifiedSchema),
    u16(params.oracleFeeBps ?? 0),
    bool(params.allowDelegateClaim),
    i64(params.challengeWindowSecs ?? 0n),
    u8(params.bump),
  ]);
}

function poolTermsAccount(params: {
  pool: PublicKey;
  poolType: number;
  payoutAssetMint: PublicKey;
  termsHash: Uint8Array;
  payoutPolicyHash: Uint8Array;
  cycleMode: number;
  metadataUri: string;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolTerms'),
    pubkey(params.pool),
    u8(params.poolType),
    pubkey(params.payoutAssetMint),
    params.termsHash,
    params.payoutPolicyHash,
    u8(params.cycleMode),
    borshString(params.metadataUri),
    u8(params.bump),
  ]);
}

function poolAssetVaultAccount(params: {
  pool: PublicKey;
  payoutMint: PublicKey;
  vaultTokenAccount: PublicKey;
  active: boolean;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolAssetVault'),
    pubkey(params.pool),
    pubkey(params.payoutMint),
    pubkey(params.vaultTokenAccount),
    bool(params.active),
    u8(params.bump),
  ]);
}

function poolRiskConfigAccount(params: {
  pool: PublicKey;
  redemptionMode: number;
  claimMode: number;
  impaired: boolean;
  updatedBy: PublicKey;
  updatedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolRiskConfig'),
    pubkey(params.pool),
    u8(params.redemptionMode),
    u8(params.claimMode),
    bool(params.impaired),
    pubkey(params.updatedBy),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

function poolCapitalClassAccount(params: {
  pool: PublicKey;
  shareMint: PublicKey;
  payoutMint: PublicKey;
  classIdHash: Uint8Array;
  seriesRefHash: Uint8Array;
  complianceProfileHash: Uint8Array;
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
}): Uint8Array {
  return concat([
    discriminator('PoolCapitalClass'),
    pubkey(params.pool),
    pubkey(params.shareMint),
    pubkey(params.payoutMint),
    params.classIdHash,
    params.seriesRefHash,
    params.complianceProfileHash,
    u8(params.classMode),
    u8(params.classPriority),
    u8(params.transferMode),
    bool(params.restricted),
    bool(params.redemptionQueueEnabled),
    bool(params.ringFenced),
    i64(params.lockupSecs),
    i64(params.redemptionNoticeSecs),
    u16(params.vintageIndex),
    i64(params.issuedAt),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

function policySeriesAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  status: number;
  displayName: string;
  metadataUri: string;
  termsHash?: Uint8Array;
  durationSecs?: bigint;
  premiumDueEverySecs?: bigint;
  premiumGraceSecs?: bigint;
  premiumAmount?: bigint;
  interopProfileHash?: Uint8Array;
  oracleProfileHash?: Uint8Array;
  riskFamilyHash?: Uint8Array;
  issuanceTemplateHash?: Uint8Array;
  comparabilityHash?: Uint8Array;
  renewalOfHash?: Uint8Array;
  planMode: number;
  sponsorMode: number;
  termsVersion: number;
  mappingVersion: number;
  createdAtTs?: bigint;
  updatedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PolicySeries'),
    pubkey(params.pool),
    params.seriesRefHash,
    u8(params.status),
    u8(params.planMode),
    u8(params.sponsorMode),
    borshString(params.displayName),
    borshString(params.metadataUri),
    params.termsHash ?? bytes32(0),
    i64(params.durationSecs ?? 0n),
    i64(params.premiumDueEverySecs ?? 0n),
    i64(params.premiumGraceSecs ?? 0n),
    u64(params.premiumAmount ?? 0n),
    params.interopProfileHash ?? bytes32(0),
    params.oracleProfileHash ?? bytes32(0),
    params.riskFamilyHash ?? bytes32(0),
    params.issuanceTemplateHash ?? bytes32(0),
    params.comparabilityHash ?? bytes32(0),
    params.renewalOfHash ?? bytes32(0),
    u16(params.termsVersion),
    u16(params.mappingVersion),
    i64(params.createdAtTs ?? 0n),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

function poolCompliancePolicyAccount(params: {
  pool: PublicKey;
  providerRefHash?: Uint8Array;
  credentialTypeHash?: Uint8Array;
  revocationListHash?: Uint8Array;
  actionsMask: number;
  bindingMode: number;
  providerMode: number;
  capitalRailMode: number;
  payoutRailMode: number;
  active: boolean;
  updatedBy: PublicKey;
  updatedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolCompliancePolicy'),
    pubkey(params.pool),
    params.providerRefHash ?? bytes32(0),
    params.credentialTypeHash ?? bytes32(0),
    params.revocationListHash ?? bytes32(0),
    u16(params.actionsMask),
    u8(params.bindingMode),
    u8(params.providerMode),
    u8(params.capitalRailMode),
    u8(params.payoutRailMode),
    bool(params.active),
    pubkey(params.updatedBy),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

function poolControlAuthorityAccount(params: {
  pool: PublicKey;
  operatorAuthority: PublicKey;
  riskManagerAuthority: PublicKey;
  complianceAuthority: PublicKey;
  guardianAuthority: PublicKey;
  updatedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolControlAuthority'),
    pubkey(params.pool),
    pubkey(params.operatorAuthority),
    pubkey(params.riskManagerAuthority),
    pubkey(params.complianceAuthority),
    pubkey(params.guardianAuthority),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

function poolAutomationPolicyAccount(params: {
  pool: PublicKey;
  oracleAutomationMode: number;
  claimAutomationMode: number;
  allowedAiRolesMask: number;
  maxAutoClaimAmount: bigint;
  requiredAttestationProviderRefHash?: Uint8Array;
  updatedBy: PublicKey;
  updatedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolAutomationPolicy'),
    pubkey(params.pool),
    u8(params.oracleAutomationMode),
    u8(params.claimAutomationMode),
    u16(params.allowedAiRolesMask),
    u64(params.maxAutoClaimAmount),
    params.requiredAttestationProviderRefHash ?? bytes32(0),
    pubkey(params.updatedBy),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

function redemptionRequestAccount(params: {
  pool: PublicKey;
  redeemer: PublicKey;
  shareMint: PublicKey;
  payoutMint: PublicKey;
  requestHash: Uint8Array;
  shareEscrow: PublicKey;
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
}): Uint8Array {
  return concat([
    discriminator('PoolRedemptionRequest'),
    pubkey(params.pool),
    pubkey(params.redeemer),
    pubkey(params.shareMint),
    pubkey(params.payoutMint),
    params.requestHash,
    pubkey(params.shareEscrow),
    u8(params.status),
    u64(params.sharesRequested),
    u64(params.minAmountOut),
    u64(params.expectedAmountOut),
    i64(params.noticeMaturesAt),
    i64(params.requestedAt),
    i64(params.scheduledAt),
    i64(params.fulfilledAt),
    i64(params.cancelledAt),
    i64(params.failedAt),
    u16(params.failureCode),
    u8(params.bump),
  ]);
}

function attestationVoteAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  cycleHash: Uint8Array;
  ruleHash: Uint8Array;
  oracle: PublicKey;
  passed: boolean;
  attestationDigest: Uint8Array;
  observedValueHash: Uint8Array;
  evidenceHash?: Uint8Array;
  externalAttestationRefHash?: Uint8Array;
  aiRole?: number;
  automationMode?: number;
  modelVersionHash?: Uint8Array;
  policyVersionHash?: Uint8Array;
  executionEnvironmentHash?: Uint8Array;
  attestationProviderRefHash?: Uint8Array;
  asOfTs: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('AttestationVote'),
    pubkey(params.pool),
    params.seriesRefHash,
    pubkey(params.member),
    params.cycleHash,
    params.ruleHash,
    pubkey(params.oracle),
    bool(params.passed),
    params.attestationDigest,
    params.observedValueHash,
    params.evidenceHash ?? bytes32(0),
    params.externalAttestationRefHash ?? bytes32(0),
    u8(params.aiRole ?? protocol.AI_ROLE_NONE),
    u8(params.automationMode ?? protocol.AUTOMATION_MODE_DISABLED),
    params.modelVersionHash ?? bytes32(0),
    params.policyVersionHash ?? bytes32(0),
    params.executionEnvironmentHash ?? bytes32(0),
    params.attestationProviderRefHash ?? bytes32(0),
    i64(params.asOfTs),
    u8(params.bump),
  ]);
}

function outcomeAggregateAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  cycleHash: Uint8Array;
  ruleHash: Uint8Array;
  passVotes: number;
  failVotes: number;
  quorumM: number;
  quorumN: number;
  finalized: boolean;
  passed: boolean;
  claimed: boolean;
  rewardLiabilityReserved: boolean;
  evidenceHash?: Uint8Array;
  externalAttestationRefHash?: Uint8Array;
  reviewStatus?: number;
  challengeWindowEndsAt?: bigint;
  disputeReasonHash?: Uint8Array;
  disputedBy?: PublicKey;
  resolvedBy?: PublicKey;
  resolvedAt?: bigint;
  aiRole?: number;
  automationMode?: number;
  modelVersionHash?: Uint8Array;
  policyVersionHash?: Uint8Array;
  executionEnvironmentHash?: Uint8Array;
  attestationProviderRefHash?: Uint8Array;
  latestAsOfTs: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('CycleOutcomeAggregate'),
    pubkey(params.pool),
    params.seriesRefHash,
    pubkey(params.member),
    params.cycleHash,
    params.ruleHash,
    u16(params.passVotes),
    u16(params.failVotes),
    u8(params.quorumM),
    u8(params.quorumN),
    bool(params.finalized),
    bool(params.passed),
    bool(params.claimed),
    bool(params.rewardLiabilityReserved),
    params.evidenceHash ?? bytes32(0),
    params.externalAttestationRefHash ?? bytes32(0),
    u8(params.reviewStatus ?? protocol.OUTCOME_REVIEW_STATUS_CLEAR),
    i64(params.challengeWindowEndsAt ?? 0n),
    params.disputeReasonHash ?? bytes32(0),
    pubkey(params.disputedBy ?? new PublicKey(protocol.ZERO_PUBKEY)),
    pubkey(params.resolvedBy ?? new PublicKey(protocol.ZERO_PUBKEY)),
    i64(params.resolvedAt ?? 0n),
    u8(params.aiRole ?? protocol.AI_ROLE_NONE),
    u8(params.automationMode ?? protocol.AUTOMATION_MODE_DISABLED),
    params.modelVersionHash ?? bytes32(0),
    params.policyVersionHash ?? bytes32(0),
    params.executionEnvironmentHash ?? bytes32(0),
    params.attestationProviderRefHash ?? bytes32(0),
    i64(params.latestAsOfTs),
    u8(params.bump),
  ]);
}

function coverageClaimAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  claimant: PublicKey;
  intentHash: Uint8Array;
  eventHash: Uint8Array;
  evidenceHash?: Uint8Array;
  interopRefHash?: Uint8Array;
  interopProfileHash?: Uint8Array;
  codeSystemFamilyHash?: Uint8Array;
  decisionReasonHash?: Uint8Array;
  adjudicationRefHash?: Uint8Array;
  status: number;
  claimFamily: number;
  appealCount: number;
  requestedAmount: bigint;
  approvedAmount: bigint;
  paidAmount: bigint;
  reservedAmount: bigint;
  recoveryAmount: bigint;
  aiDecisionHash?: Uint8Array;
  aiPolicyHash?: Uint8Array;
  aiExecutionEnvironmentHash?: Uint8Array;
  aiAttestationRefHash?: Uint8Array;
  aiAutomationMode?: number;
  submittedAt: bigint;
  reviewedAt: bigint;
  settledAt: bigint;
  closedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('CoverageClaimRecord'),
    pubkey(params.pool),
    params.seriesRefHash,
    pubkey(params.member),
    pubkey(params.claimant),
    params.intentHash,
    params.eventHash,
    params.evidenceHash ?? bytes32(0),
    params.interopRefHash ?? bytes32(0),
    params.interopProfileHash ?? bytes32(0),
    params.codeSystemFamilyHash ?? bytes32(0),
    params.decisionReasonHash ?? bytes32(0),
    params.adjudicationRefHash ?? bytes32(0),
    u8(params.status),
    u8(params.claimFamily),
    u16(params.appealCount),
    u64(params.requestedAmount),
    u64(params.approvedAmount),
    u64(params.paidAmount),
    u64(params.reservedAmount),
    u64(params.recoveryAmount),
    params.aiDecisionHash ?? bytes32(0),
    params.aiPolicyHash ?? bytes32(0),
    params.aiExecutionEnvironmentHash ?? bytes32(0),
    params.aiAttestationRefHash ?? bytes32(0),
    u8(params.aiAutomationMode ?? protocol.AUTOMATION_MODE_DISABLED),
    i64(params.submittedAt),
    i64(params.reviewedAt),
    i64(params.settledAt),
    i64(params.closedAt),
    u8(params.bump),
  ]);
}

function rewardClaimAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  member: PublicKey;
  claimant: PublicKey;
  cycleHash: Uint8Array;
  ruleHash: Uint8Array;
  intentHash: Uint8Array;
  payoutMint: PublicKey;
  payoutAmount: bigint;
  recipient: PublicKey;
  submittedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('ClaimRecordV2'),
    pubkey(params.pool),
    params.seriesRefHash,
    pubkey(params.member),
    pubkey(params.claimant),
    params.cycleHash,
    params.ruleHash,
    params.intentHash,
    pubkey(params.payoutMint),
    u64(params.payoutAmount),
    pubkey(params.recipient),
    i64(params.submittedAt),
    u8(params.bump),
  ]);
}

function schemaAccount(params: {
  schemaKeyHash: Uint8Array;
  schemaKey: string;
  version: number;
  schemaHash: Uint8Array;
  publisher: PublicKey;
  verified: boolean;
  schemaFamily?: number;
  visibility?: number;
  interopProfileHash?: Uint8Array;
  codeSystemFamilyHash?: Uint8Array;
  mappingVersion?: number;
  metadataUri: string;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('OutcomeSchemaRegistryEntry'),
    params.schemaKeyHash,
    borshString(params.schemaKey),
    u16(params.version),
    params.schemaHash,
    pubkey(params.publisher),
    bool(params.verified),
    u8(params.schemaFamily ?? protocol.SCHEMA_FAMILY_KERNEL),
    u8(params.visibility ?? protocol.SCHEMA_VISIBILITY_PUBLIC),
    params.interopProfileHash ?? bytes32(0),
    params.codeSystemFamilyHash ?? bytes32(0),
    u16(params.mappingVersion ?? 0),
    borshString(params.metadataUri),
    u8(params.bump),
  ]);
}

function ruleAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  ruleHash: Uint8Array;
  schemaKeyHash: Uint8Array;
  ruleId: string;
  schemaKey: string;
  schemaVersion: number;
  interopProfileHash?: Uint8Array;
  codeSystemFamilyHash?: Uint8Array;
  mappingVersion?: number;
  payoutHash: Uint8Array;
  enabled: boolean;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('PoolOutcomeRule'),
    pubkey(params.pool),
    params.seriesRefHash,
    params.ruleHash,
    params.schemaKeyHash,
    borshString(params.ruleId),
    borshString(params.schemaKey),
    u16(params.schemaVersion),
    params.interopProfileHash ?? bytes32(0),
    params.codeSystemFamilyHash ?? bytes32(0),
    u16(params.mappingVersion ?? 0),
    params.payoutHash,
    bool(params.enabled),
    u8(params.bump),
  ]);
}

function membershipAccount(params: {
  pool: PublicKey;
  member: PublicKey;
  subjectCommitment: Uint8Array;
  status: number;
  enrolledAt: bigint;
  updatedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator('MembershipRecord'),
    pubkey(params.pool),
    pubkey(params.member),
    params.subjectCommitment,
    u8(params.status),
    i64(params.enrolledAt),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

class MockConnection {
  rpcEndpoint = 'mock://rpc';

  constructor(
    private readonly entries: ProgramAccountEntry[],
    private readonly options: { failProgramAccounts?: boolean } = {},
  ) {}

  async getProgramAccounts(_programId: PublicKey, config?: { filters?: Array<{ memcmp: { offset: number; bytes: string } }> }) {
    if (this.options.failProgramAccounts) {
      throw new Error('program account query failed');
    }
    const filters = config?.filters ?? [];
    return this.entries.filter((entry) =>
      filters.every((filter) => {
        const expected = bs58.decode(filter.memcmp.bytes);
        const offset = filter.memcmp.offset;
        if (offset + expected.length > entry.account.data.length) {
          return false;
        }
        const actual = entry.account.data.slice(offset, offset + expected.length);
        return Buffer.from(actual).equals(Buffer.from(expected));
      }),
    );
  }
}

function entry(data: Uint8Array): ProgramAccountEntry {
  return {
    pubkey: Keypair.generate().publicKey,
    account: { data },
  };
}

test.beforeEach(() => {
  protocol.clearProtocolDiscoveryCache();
});

test('discriminator-based discovery returns typed pool/oracle/schema/rule lists with deterministic filtering', async () => {
  const authorityA = Keypair.generate().publicKey;
  const authorityB = Keypair.generate().publicKey;
  const poolA = Keypair.generate().publicKey;
  const poolB = Keypair.generate().publicKey;
  const oracleA = Keypair.generate().publicKey;
  const oracleB = Keypair.generate().publicKey;
  const inviteIssuer = Keypair.generate().publicKey;
  const mint = Keypair.generate().publicKey;

  const schemaHashA = bytes32(9);
  const schemaHashB = bytes32(10);
  const ruleHashA = bytes32(11);
  const ruleHashB = bytes32(12);

  const connection = new MockConnection([
    entry(
      poolAccount({
        authority: authorityA,
        poolId: 'beta',
        organizationRef: 'org-b',
        payoutLamportsPerPass: 2_000_000n,
        membershipMode: 1,
        tokenGateMint: mint,
        tokenGateMinBalance: 3n,
        inviteIssuer,
        status: 1,
        bump: 255,
      }),
    ),
    entry(
      poolAccount({
        authority: authorityB,
        poolId: 'alpha',
        organizationRef: 'org-a',
        payoutLamportsPerPass: 1_000_000n,
        membershipMode: 0,
        tokenGateMint: mint,
        tokenGateMinBalance: 1n,
        inviteIssuer,
        status: 1,
        bump: 254,
      }),
    ),
    // malformed pool account should be skipped by the parser
    entry(concat([discriminator('Pool'), u8(1), u8(2), u8(3)])),

    entry(oracleAccount({ oracle: oracleA, active: true, bump: 1, metadataUri: 'https://oracle-a.json' })),
    entry(oracleAccount({ oracle: oracleB, active: false, bump: 1, metadataUri: 'https://oracle-b.json' })),

    entry(
      schemaAccount({
        schemaKeyHash: schemaHashA,
        schemaKey: 'daily.streak',
        version: 1,
        schemaHash: bytes32(20),
        publisher: authorityA,
        verified: true,
        metadataUri: 'https://schema-a.json',
        bump: 1,
      }),
    ),
    entry(
      schemaAccount({
        schemaKeyHash: schemaHashB,
        schemaKey: 'risk.coverage',
        version: 1,
        schemaHash: bytes32(21),
        publisher: authorityB,
        verified: false,
        metadataUri: 'https://schema-b.json',
        bump: 2,
      }),
    ),

    entry(
      ruleAccount({
        pool: poolA,
        seriesRefHash: bytes32(13),
        ruleHash: ruleHashA,
        schemaKeyHash: schemaHashA,
        ruleId: 'rule-a',
        schemaKey: 'daily.streak',
        schemaVersion: 1,
        payoutHash: bytes32(30),
        enabled: true,
        bump: 1,
      }),
    ),
    entry(
      ruleAccount({
        pool: poolB,
        seriesRefHash: bytes32(14),
        ruleHash: ruleHashB,
        schemaKeyHash: schemaHashB,
        ruleId: 'rule-b',
        schemaKey: 'risk.coverage',
        schemaVersion: 1,
        payoutHash: bytes32(31),
        enabled: false,
        bump: 1,
      }),
    ),
  ]);

  const pools = await protocol.listPools({ connection: connection as unknown as Connection });
  assert.equal(pools.length, 2);
  assert.equal(pools[0]?.poolId, 'alpha');
  assert.equal(pools[1]?.poolId, 'beta');

  const poolsBySearch = await protocol.listPools({
    connection: connection as unknown as Connection,
    search: 'beta',
  });
  assert.equal(poolsBySearch.length, 1);
  assert.equal(poolsBySearch[0]?.organizationRef, 'org-b');

  const oracles = await protocol.listOracles({
    connection: connection as unknown as Connection,
    activeOnly: true,
  });
  assert.equal(oracles.length, 1);
  assert.equal(oracles[0]?.oracle, oracleA.toBase58());

  const schemas = await protocol.listSchemas({
    connection: connection as unknown as Connection,
    verifiedOnly: true,
  });
  assert.equal(schemas.length, 1);
  assert.equal(schemas[0]?.schemaKey, 'daily.streak');

  const rules = await protocol.listPoolRules({
    connection: connection as unknown as Connection,
    poolAddress: poolA.toBase58(),
    enabledOnly: true,
  });
  assert.equal(rules.length, 1);
  assert.equal(rules[0]?.ruleId, 'rule-a');
});

test('decoders parse variable-length string fields and pool-oracle account layouts', async () => {
  const pool = Keypair.generate().publicKey;
  const authority = Keypair.generate().publicKey;
  const oracle = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const mint = Keypair.generate().publicKey;
  const inviteIssuer = Keypair.generate().publicKey;

  const connection = new MockConnection([
    entry(
      poolAccount({
        authority,
        poolId: 'unicode-🙂-pool',
        organizationRef: 'org-unicode',
        payoutLamportsPerPass: 5n,
        membershipMode: 2,
        tokenGateMint: mint,
        tokenGateMinBalance: 1n,
        inviteIssuer,
        status: 1,
        bump: 1,
      }),
    ),
    entry(poolOracleApprovalAccount({ pool, oracle, active: true, bump: 7 })),
    entry(poolOracleApprovalAccount({ pool, oracle: Keypair.generate().publicKey, active: false, bump: 8 })),
    entry(
      poolOraclePolicyAccount({
        pool,
        quorumM: 2,
        quorumN: 3,
        requireVerifiedSchema: true,
        allowDelegateClaim: false,
        bump: 9,
      }),
    ),
    entry(
      membershipAccount({
        pool,
        member,
        subjectCommitment: bytes32(77),
        status: protocol.MEMBERSHIP_STATUS_ACTIVE,
        enrolledAt: 1n,
        updatedAt: 2n,
        bump: 1,
      }),
    ),
  ]);

  const pools = await protocol.listPools({ connection: connection as unknown as Connection });
  assert.equal(pools.length, 1);
  assert.equal(pools[0]?.poolId, 'unicode-🙂-pool');

  const approvals = await protocol.listPoolOracleApprovals({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    activeOnly: true,
  });
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0]?.oracle, oracle.toBase58());

  const policies = await protocol.listPoolOraclePolicies({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
  });
  assert.equal(policies.length, 1);
  assert.equal(policies[0]?.quorumM, 2);
  assert.equal(policies[0]?.quorumN, 3);
  assert.equal(policies[0]?.requireVerifiedSchema, true);
  assert.equal(policies[0]?.allowDelegateClaim, false);

  const memberships = await protocol.listMemberships({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    activeOnly: true,
  });
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0]?.member, member.toBase58());
});

test('pool terms, pool asset vault, and risk config discovery decoders parse expected layouts', async () => {
  const poolA = Keypair.generate().publicKey;
  const poolB = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const vaultTokenAccount = Keypair.generate().publicKey;
  const riskUpdater = Keypair.generate().publicKey;
  const shareMint = Keypair.generate().publicKey;

  const connection = new MockConnection([
    entry(
      poolTermsAccount({
        pool: poolA,
        poolType: 1,
        payoutAssetMint: payoutMint,
        termsHash: bytes32(41),
        payoutPolicyHash: bytes32(42),
        cycleMode: 2,
        metadataUri: 'https://pool-a.json',
        bump: 7,
      }),
    ),
    entry(
      poolTermsAccount({
        pool: poolB,
        poolType: 0,
        payoutAssetMint: Keypair.generate().publicKey,
        termsHash: bytes32(43),
        payoutPolicyHash: bytes32(44),
        cycleMode: 1,
        metadataUri: 'https://pool-b.json',
        bump: 8,
      }),
    ),
    entry(
      poolAssetVaultAccount({
        pool: poolA,
        payoutMint,
        vaultTokenAccount,
        active: true,
        bump: 5,
      }),
    ),
    entry(
      poolRiskConfigAccount({
        pool: poolA,
        redemptionMode: protocol.POOL_REDEMPTION_MODE_QUEUE_ONLY,
        claimMode: protocol.POOL_CLAIM_MODE_PAUSED,
        impaired: true,
        updatedBy: riskUpdater,
        updatedAt: 1234n,
        bump: 6,
      }),
    ),
    entry(
      poolCapitalClassAccount({
        pool: poolA,
        shareMint,
        payoutMint,
        classIdHash: bytes32(45),
        seriesRefHash: bytes32(46),
        complianceProfileHash: bytes32(47),
        classMode: protocol.CAPITAL_CLASS_MODE_NAV,
        classPriority: 2,
        transferMode: protocol.CAPITAL_TRANSFER_MODE_RESTRICTED,
        restricted: true,
        redemptionQueueEnabled: true,
        ringFenced: true,
        lockupSecs: 86_400n,
        redemptionNoticeSecs: 3_600n,
        vintageIndex: 4,
        issuedAt: 123n,
        updatedAt: 456n,
        bump: 7,
      }),
    ),
  ]);

  const poolTerms = await protocol.listPoolTerms({
    connection: connection as unknown as Connection,
    poolAddress: poolA.toBase58(),
  });
  assert.equal(poolTerms.length, 1);
  assert.equal(poolTerms[0]?.pool, poolA.toBase58());
  assert.equal(poolTerms[0]?.poolType, 1);
  assert.equal(poolTerms[0]?.payoutAssetMint, payoutMint.toBase58());
  assert.equal(poolTerms[0]?.metadataUri, 'https://pool-a.json');
  assert.equal(poolTerms[0]?.termsHashHex, Buffer.from(bytes32(41)).toString('hex'));
  assert.equal(poolTerms[0]?.payoutPolicyHashHex, Buffer.from(bytes32(42)).toString('hex'));

  const poolAssetVaults = await protocol.listPoolAssetVaults({
    connection: connection as unknown as Connection,
    poolAddress: poolA.toBase58(),
  });
  assert.equal(poolAssetVaults.length, 1);
  assert.equal(poolAssetVaults[0]?.pool, poolA.toBase58());
  assert.equal(poolAssetVaults[0]?.payoutMint, payoutMint.toBase58());
  assert.equal(poolAssetVaults[0]?.vaultTokenAccount, vaultTokenAccount.toBase58());
  assert.equal(poolAssetVaults[0]?.active, true);

  const riskConfigs = await protocol.listPoolRiskConfigs({
    connection: connection as unknown as Connection,
    poolAddress: poolA.toBase58(),
  });
  assert.equal(riskConfigs.length, 1);
  assert.equal(riskConfigs[0]?.pool, poolA.toBase58());
  assert.equal(riskConfigs[0]?.redemptionMode, protocol.POOL_REDEMPTION_MODE_QUEUE_ONLY);
  assert.equal(riskConfigs[0]?.claimMode, protocol.POOL_CLAIM_MODE_PAUSED);
  assert.equal(riskConfigs[0]?.impaired, true);
  assert.equal(riskConfigs[0]?.updatedBy, riskUpdater.toBase58());
  assert.equal(riskConfigs[0]?.updatedAt, 1234n);

  const capitalClasses = await protocol.listPoolCapitalClasses({
    connection: connection as unknown as Connection,
    poolAddress: poolA.toBase58(),
  });
  assert.equal(capitalClasses.length, 1);
  assert.equal(capitalClasses[0]?.pool, poolA.toBase58());
  assert.equal(capitalClasses[0]?.shareMint, shareMint.toBase58());
  assert.equal(capitalClasses[0]?.payoutMint, payoutMint.toBase58());
  assert.equal(capitalClasses[0]?.classMode, protocol.CAPITAL_CLASS_MODE_NAV);
  assert.equal(capitalClasses[0]?.transferMode, protocol.CAPITAL_TRANSFER_MODE_RESTRICTED);
  assert.equal(capitalClasses[0]?.restricted, true);
  assert.equal(capitalClasses[0]?.redemptionQueueEnabled, true);
  assert.equal(capitalClasses[0]?.ringFenced, true);
  assert.equal(capitalClasses[0]?.vintageIndex, 4);
  assert.equal(capitalClasses[0]?.classIdHashHex, Buffer.from(bytes32(45)).toString('hex'));
  assert.equal(capitalClasses[0]?.complianceProfileHashHex, Buffer.from(bytes32(47)).toString('hex'));
});

test('series, compliance, control, automation, and redemption discovery decoders preserve policy surfaces', async () => {
  const pool = Keypair.generate().publicKey;
  const redeemer = Keypair.generate().publicKey;
  const shareMint = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const shareEscrow = Keypair.generate().publicKey;
  const authorityA = Keypair.generate().publicKey;
  const authorityB = Keypair.generate().publicKey;
  const authorityC = Keypair.generate().publicKey;
  const authorityD = Keypair.generate().publicKey;

  const connection = new MockConnection([
    entry(
      policySeriesAccount({
        pool,
        seriesRefHash: bytes32(100),
        status: protocol.POLICY_SERIES_STATUS_ACTIVE,
        displayName: 'Regulated Series',
        metadataUri: 'https://series.json',
        termsHash: bytes32(99),
        durationSecs: 30n * 24n * 60n * 60n,
        premiumDueEverySecs: 7n * 24n * 60n * 60n,
        premiumGraceSecs: 2n * 24n * 60n * 60n,
        premiumAmount: 125_000n,
        interopProfileHash: bytes32(101),
        oracleProfileHash: bytes32(102),
        riskFamilyHash: bytes32(103),
        issuanceTemplateHash: bytes32(104),
        comparabilityHash: bytes32(105),
        renewalOfHash: bytes32(106),
        planMode: protocol.PLAN_MODE_REGULATED,
        sponsorMode: protocol.SPONSOR_MODE_CARRIER,
        termsVersion: 7,
        mappingVersion: 9,
        createdAtTs: 122n,
        updatedAt: 123n,
        bump: 1,
      }),
    ),
    entry(
      poolCompliancePolicyAccount({
        pool,
        providerRefHash: bytes32(107),
        credentialTypeHash: bytes32(108),
        revocationListHash: bytes32(109),
        actionsMask:
          protocol.COMPLIANCE_ACTION_ENROLL
          | protocol.COMPLIANCE_ACTION_DEPOSIT
          | protocol.COMPLIANCE_ACTION_REDEEM,
        bindingMode: protocol.COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT,
        providerMode: protocol.COMPLIANCE_PROVIDER_MODE_EXTERNAL,
        capitalRailMode: protocol.RAIL_MODE_PERMISSIONED_SPL,
        payoutRailMode: protocol.RAIL_MODE_SPL_ONLY,
        active: true,
        updatedBy: authorityA,
        updatedAt: 456n,
        bump: 2,
      }),
    ),
    entry(
      poolControlAuthorityAccount({
        pool,
        operatorAuthority: authorityA,
        riskManagerAuthority: authorityB,
        complianceAuthority: authorityC,
        guardianAuthority: authorityD,
        updatedAt: 789n,
        bump: 3,
      }),
    ),
    entry(
      poolAutomationPolicyAccount({
        pool,
        oracleAutomationMode: protocol.AUTOMATION_MODE_ATTESTED,
        claimAutomationMode: protocol.AUTOMATION_MODE_ADVISORY,
        allowedAiRolesMask: protocol.AI_ROLE_ALL_MASK,
        maxAutoClaimAmount: 5_000n,
        requiredAttestationProviderRefHash: bytes32(110),
        updatedBy: authorityB,
        updatedAt: 1_234n,
        bump: 4,
      }),
    ),
    entry(
      redemptionRequestAccount({
        pool,
        redeemer,
        shareMint,
        payoutMint,
        requestHash: bytes32(111),
        shareEscrow,
        status: protocol.REDEMPTION_REQUEST_STATUS_SCHEDULED,
        sharesRequested: 77n,
        minAmountOut: 88n,
        expectedAmountOut: 99n,
        noticeMaturesAt: 1_500n,
        requestedAt: 1_400n,
        scheduledAt: 1_450n,
        fulfilledAt: 0n,
        cancelledAt: 0n,
        failedAt: 0n,
        failureCode: 0,
        bump: 5,
      }),
    ),
  ]);

  const [series, compliance, controls, automation, redemptions] = await Promise.all([
    protocol.listPolicySeries({ connection: connection as unknown as Connection, poolAddress: pool.toBase58() }),
    protocol.listPoolCompliancePolicies({ connection: connection as unknown as Connection, poolAddress: pool.toBase58() }),
    protocol.listPoolControlAuthorities({ connection: connection as unknown as Connection, poolAddress: pool.toBase58() }),
    protocol.listPoolAutomationPolicies({ connection: connection as unknown as Connection, poolAddress: pool.toBase58() }),
    protocol.listPoolRedemptionRequests({
      connection: connection as unknown as Connection,
      poolAddress: pool.toBase58(),
      redeemerAddress: redeemer.toBase58(),
    }),
  ]);

  assert.equal(series.length, 1);
  assert.equal(series[0]?.planMode, protocol.PLAN_MODE_REGULATED);
  assert.equal(series[0]?.sponsorMode, protocol.SPONSOR_MODE_CARRIER);
  assert.equal(series[0]?.comparabilityHashHex, Buffer.from(bytes32(105)).toString('hex'));

  assert.equal(compliance.length, 1);
  assert.equal(compliance[0]?.bindingMode, protocol.COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT);
  assert.equal(compliance[0]?.capitalRailMode, protocol.RAIL_MODE_PERMISSIONED_SPL);
  assert.equal(compliance[0]?.payoutRailMode, protocol.RAIL_MODE_SPL_ONLY);

  assert.equal(controls.length, 1);
  assert.equal(controls[0]?.operatorAuthority, authorityA.toBase58());
  assert.equal(controls[0]?.guardianAuthority, authorityD.toBase58());

  assert.equal(automation.length, 1);
  assert.equal(automation[0]?.oracleAutomationMode, protocol.AUTOMATION_MODE_ATTESTED);
  assert.equal(automation[0]?.allowedAiRolesMask, protocol.AI_ROLE_ALL_MASK);

  assert.equal(redemptions.length, 1);
  assert.equal(redemptions[0]?.status, protocol.REDEMPTION_REQUEST_STATUS_SCHEDULED);
  assert.equal(redemptions[0]?.sharesRequested, 77n);
  assert.equal(redemptions[0]?.expectedAmountOut, 99n);
});

test('attestation vote and outcome aggregate discovery decoders preserve evidence commitments', async () => {
  const pool = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const oracle = Keypair.generate().publicKey;
  const cycleHash = bytes32(51);
  const ruleHash = bytes32(52);
  const evidenceHash = bytes32(53);
  const externalRefHash = bytes32(54);
  const modelVersionHash = bytes32(57);
  const providerRefHash = bytes32(58);

  const connection = new MockConnection([
    entry(
      attestationVoteAccount({
        pool,
        seriesRefHash: bytes32(50),
        member,
        cycleHash,
        ruleHash,
        oracle,
        passed: true,
        attestationDigest: bytes32(55),
        observedValueHash: bytes32(56),
        evidenceHash,
        externalAttestationRefHash: externalRefHash,
        aiRole: protocol.AI_ROLE_ORACLE,
        automationMode: protocol.AUTOMATION_MODE_ATTESTED,
        modelVersionHash,
        policyVersionHash: bytes32(59),
        executionEnvironmentHash: bytes32(60),
        attestationProviderRefHash: providerRefHash,
        asOfTs: 777n,
        bump: 3,
      }),
    ),
    entry(
      outcomeAggregateAccount({
        pool,
        seriesRefHash: bytes32(50),
        member,
        cycleHash,
        ruleHash,
        passVotes: 2,
        failVotes: 0,
        quorumM: 2,
        quorumN: 2,
        finalized: true,
        passed: true,
        claimed: false,
        rewardLiabilityReserved: true,
        evidenceHash,
        externalAttestationRefHash: externalRefHash,
        reviewStatus: protocol.OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE,
        challengeWindowEndsAt: 999n,
        disputeReasonHash: bytes32(91),
        disputedBy: oracle,
        resolvedBy: member,
        resolvedAt: 1_000n,
        aiRole: protocol.AI_ROLE_ORACLE,
        automationMode: protocol.AUTOMATION_MODE_ATTESTED,
        modelVersionHash,
        policyVersionHash: bytes32(59),
        executionEnvironmentHash: bytes32(60),
        attestationProviderRefHash: providerRefHash,
        latestAsOfTs: 888n,
        bump: 4,
      }),
    ),
  ]);

  const votes = await protocol.listAttestationVotes({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
  });
  assert.equal(votes.length, 1);
  assert.equal(votes[0]?.pool, pool.toBase58());
  assert.equal(votes[0]?.member, member.toBase58());
  assert.equal(votes[0]?.oracle, oracle.toBase58());
  assert.equal(votes[0]?.evidenceHashHex, Buffer.from(evidenceHash).toString('hex'));
  assert.equal(votes[0]?.externalAttestationRefHashHex, Buffer.from(externalRefHash).toString('hex'));
  assert.equal(votes[0]?.aiRole, protocol.AI_ROLE_ORACLE);
  assert.equal(votes[0]?.automationMode, protocol.AUTOMATION_MODE_ATTESTED);
  assert.equal(votes[0]?.modelVersionHashHex, Buffer.from(modelVersionHash).toString('hex'));
  assert.equal(votes[0]?.attestationProviderRefHashHex, Buffer.from(providerRefHash).toString('hex'));

  const aggregates = await protocol.listOutcomeAggregates({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    finalizedOnly: true,
  });
  assert.equal(aggregates.length, 1);
  assert.equal(aggregates[0]?.pool, pool.toBase58());
  assert.equal(aggregates[0]?.rewardLiabilityReserved, true);
  assert.equal(aggregates[0]?.evidenceHashHex, Buffer.from(evidenceHash).toString('hex'));
  assert.equal(aggregates[0]?.reviewStatus, protocol.OUTCOME_REVIEW_STATUS_PENDING_CHALLENGE);
  assert.equal(aggregates[0]?.challengeWindowEndsAt, 999n);
  assert.equal(aggregates[0]?.aiRole, protocol.AI_ROLE_ORACLE);
  assert.equal(
    aggregates[0]?.externalAttestationRefHashHex,
    Buffer.from(externalRefHash).toString('hex'),
  );
});

test('coverage claim discovery decoders preserve claim-case, interop, and recovery fields', async () => {
  const pool = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const claimant = Keypair.generate().publicKey;
  const intentHash = bytes32(61);
  const eventHash = bytes32(62);
  const evidenceHash = bytes32(63);
  const interopRefHash = bytes32(64);
  const interopProfileHash = bytes32(65);
  const codeSystemFamilyHash = bytes32(66);
  const decisionReasonHash = bytes32(67);
  const adjudicationRefHash = bytes32(68);
  const aiDecisionHash = bytes32(69);

  const connection = new MockConnection([
    entry(
      coverageClaimAccount({
        pool,
        seriesRefHash: bytes32(60),
        member,
        claimant,
        intentHash,
        eventHash,
        evidenceHash,
        interopRefHash,
        interopProfileHash,
        codeSystemFamilyHash,
        decisionReasonHash,
        adjudicationRefHash,
        status: protocol.COVERAGE_CLAIM_STATUS_PARTIALLY_PAID,
        claimFamily: protocol.COVERAGE_CLAIM_FAMILY_REIMBURSEMENT,
        appealCount: 2,
        requestedAmount: 900n,
        approvedAmount: 750n,
        paidAmount: 500n,
        reservedAmount: 250n,
        recoveryAmount: 100n,
        aiDecisionHash,
        aiPolicyHash: bytes32(70),
        aiExecutionEnvironmentHash: bytes32(71),
        aiAttestationRefHash: bytes32(72),
        aiAutomationMode: protocol.AUTOMATION_MODE_ADVISORY,
        submittedAt: 11n,
        reviewedAt: 22n,
        settledAt: 33n,
        closedAt: 44n,
        bump: 5,
      }),
    ),
  ]);

  const claims = await protocol.listCoverageClaims({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    memberAddress: member.toBase58(),
  });
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.pool, pool.toBase58());
  assert.equal(claims[0]?.member, member.toBase58());
  assert.equal(claims[0]?.claimant, claimant.toBase58());
  assert.equal(claims[0]?.status, protocol.COVERAGE_CLAIM_STATUS_PARTIALLY_PAID);
  assert.equal(claims[0]?.claimFamily, protocol.COVERAGE_CLAIM_FAMILY_REIMBURSEMENT);
  assert.equal(claims[0]?.appealCount, 2);
  assert.equal(claims[0]?.requestedAmount, 900n);
  assert.equal(claims[0]?.approvedAmount, 750n);
  assert.equal(claims[0]?.paidAmount, 500n);
  assert.equal(claims[0]?.reservedAmount, 250n);
  assert.equal(claims[0]?.recoveryAmount, 100n);
  assert.equal(claims[0]?.evidenceHashHex, Buffer.from(evidenceHash).toString('hex'));
  assert.equal(claims[0]?.interopProfileHashHex, Buffer.from(interopProfileHash).toString('hex'));
  assert.equal(claims[0]?.codeSystemFamilyHashHex, Buffer.from(codeSystemFamilyHash).toString('hex'));
  assert.equal(claims[0]?.adjudicationRefHashHex, Buffer.from(adjudicationRefHash).toString('hex'));
  assert.equal(claims[0]?.aiDecisionHashHex, Buffer.from(aiDecisionHash).toString('hex'));
  assert.equal(claims[0]?.aiAutomationMode, protocol.AUTOMATION_MODE_ADVISORY);
});

test('reward claim discovery decoders preserve claimant and payout routing fields', async () => {
  const pool = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const claimant = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;
  const cycleHash = bytes32(71);
  const ruleHash = bytes32(72);
  const intentHash = bytes32(73);

  const connection = new MockConnection([
    entry(
      rewardClaimAccount({
        pool,
        seriesRefHash: bytes32(70),
        member,
        claimant,
        cycleHash,
        ruleHash,
        intentHash,
        payoutMint,
        payoutAmount: 321n,
        recipient,
        submittedAt: 55n,
        bump: 6,
      }),
    ),
  ]);

  const claims = await protocol.listRewardClaims({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    memberAddress: member.toBase58(),
    claimantAddress: claimant.toBase58(),
  });

  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.pool, pool.toBase58());
  assert.equal(claims[0]?.member, member.toBase58());
  assert.equal(claims[0]?.claimant, claimant.toBase58());
  assert.equal(claims[0]?.payoutMint, payoutMint.toBase58());
  assert.equal(claims[0]?.payoutAmount, 321n);
  assert.equal(claims[0]?.recipient, recipient.toBase58());
  assert.equal(claims[0]?.cycleHashHex, Buffer.from(cycleHash).toString('hex'));
  assert.equal(claims[0]?.ruleHashHex, Buffer.from(ruleHash).toString('hex'));
  assert.equal(claims[0]?.intentHashHex, Buffer.from(intentHash).toString('hex'));
});
