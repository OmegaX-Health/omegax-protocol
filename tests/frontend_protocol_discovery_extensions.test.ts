// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import bs58 from "bs58";
import { Keypair, PublicKey, type Connection } from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const contract = JSON.parse(
  readFileSync(new URL("../shared/protocol_contract.json", import.meta.url), "utf8"),
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

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function discriminator(accountName: string): Uint8Array {
  const value = contract.accountDiscriminators[accountName];
  if (!value) {
    throw new Error(`Missing discriminator for ${accountName}`);
  }
  return Uint8Array.from(value);
}

function protocolConfigAccount(params: {
  admin: PublicKey;
  governanceAuthority: PublicKey;
  governanceRealm: PublicKey;
  governanceConfig: PublicKey;
  defaultStakeMint: PublicKey;
  protocolFeeBps: number;
  minOracleStake: bigint;
  emergencyPaused: boolean;
  allowedPayoutMintsHash: Uint8Array;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("ProtocolConfig"),
    pubkey(params.admin),
    pubkey(params.governanceAuthority),
    pubkey(params.governanceRealm),
    pubkey(params.governanceConfig),
    pubkey(params.defaultStakeMint),
    u16(params.protocolFeeBps),
    u64(params.minOracleStake),
    bool(params.emergencyPaused),
    params.allowedPayoutMintsHash,
    u8(params.bump),
  ]);
}

function oracleStakePositionAccount(params: {
  oracle: PublicKey;
  staker: PublicKey;
  stakeMint: PublicKey;
  stakeVault: PublicKey;
  stakedAmount: bigint;
  pendingUnstakeAmount: bigint;
  canFinalizeUnstakeAt: bigint;
  slashPending: boolean;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("OracleStakePosition"),
    pubkey(params.oracle),
    pubkey(params.staker),
    pubkey(params.stakeMint),
    pubkey(params.stakeVault),
    u64(params.stakedAmount),
    u64(params.pendingUnstakeAmount),
    i64(params.canFinalizeUnstakeAt),
    bool(params.slashPending),
    u8(params.bump),
  ]);
}

function poolOraclePermissionSetAccount(params: {
  pool: PublicKey;
  oracle: PublicKey;
  permissions: number;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("PoolOraclePermissionSet"),
    pubkey(params.pool),
    pubkey(params.oracle),
    u32(params.permissions),
    u8(params.bump),
  ]);
}

function policySeriesPaymentOptionAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  paymentMint: PublicKey;
  paymentAmount: bigint;
  active: boolean;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("PolicySeriesPaymentOption"),
    pubkey(params.pool),
    params.seriesRefHash,
    pubkey(params.paymentMint),
    u64(params.paymentAmount),
    bool(params.active),
    u8(params.bump),
  ]);
}

function policyPositionAccount(params: {
  pool: PublicKey;
  member: PublicKey;
  seriesRefHash: Uint8Array;
  termsHash: Uint8Array;
  status: number;
  startsAt: bigint;
  endsAt: bigint;
  premiumDueEverySecs: bigint;
  premiumGraceSecs: bigint;
  nextDueAt: bigint;
  nftMint: PublicKey;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("PolicyPosition"),
    pubkey(params.pool),
    pubkey(params.member),
    params.seriesRefHash,
    params.termsHash,
    u8(params.status),
    i64(params.startsAt),
    i64(params.endsAt),
    i64(params.premiumDueEverySecs),
    i64(params.premiumGraceSecs),
    i64(params.nextDueAt),
    pubkey(params.nftMint),
    u8(params.bump),
  ]);
}

function policyPositionNftAccount(params: {
  pool: PublicKey;
  member: PublicKey;
  seriesRefHash: Uint8Array;
  nftMint: PublicKey;
  metadataUri: string;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("PolicyPositionNft"),
    pubkey(params.pool),
    pubkey(params.member),
    params.seriesRefHash,
    pubkey(params.nftMint),
    borshString(params.metadataUri),
    u8(params.bump),
  ]);
}

function claimDelegateAuthorizationAccount(params: {
  pool: PublicKey;
  member: PublicKey;
  delegate: PublicKey;
  active: boolean;
  updatedAt: bigint;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("ClaimDelegateAuthorization"),
    pubkey(params.pool),
    pubkey(params.member),
    pubkey(params.delegate),
    bool(params.active),
    i64(params.updatedAt),
    u8(params.bump),
  ]);
}

function memberCycleStateAccount(params: {
  pool: PublicKey;
  member: PublicKey;
  seriesRefHash: Uint8Array;
  periodIndex: bigint;
  paymentMint: PublicKey;
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
  cohortHash: Uint8Array;
  settledHealthAlphaScore: number;
  includedShieldCount: number;
  shieldConsumed: boolean;
  status: number;
  passed: boolean;
  activatedAt: bigint;
  settledAt: bigint;
  quoteHash: Uint8Array;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("MemberCycleState"),
    pubkey(params.pool),
    pubkey(params.member),
    params.seriesRefHash,
    u64(params.periodIndex),
    pubkey(params.paymentMint),
    u64(params.premiumAmountRaw),
    u64(params.bondAmountRaw),
    u64(params.shieldFeeRaw),
    u64(params.protocolFeeRaw),
    u64(params.oracleFeeRaw),
    u64(params.netPoolPremiumRaw),
    u64(params.totalAmountRaw),
    u64(params.canonicalPremiumAmount),
    bool(params.commitmentEnabled),
    u16(params.thresholdBps),
    u16(params.outcomeThresholdScore),
    params.cohortHash,
    u16(params.settledHealthAlphaScore),
    u8(params.includedShieldCount),
    bool(params.shieldConsumed),
    u8(params.status),
    bool(params.passed),
    i64(params.activatedAt),
    i64(params.settledAt),
    params.quoteHash,
    u8(params.bump),
  ]);
}

function cohortSettlementRootAccount(params: {
  pool: PublicKey;
  seriesRefHash: Uint8Array;
  paymentMint: PublicKey;
  cohortHash: Uint8Array;
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
}): Uint8Array {
  return concat([
    discriminator("CohortSettlementRoot"),
    pubkey(params.pool),
    params.seriesRefHash,
    pubkey(params.paymentMint),
    params.cohortHash,
    u16(params.outcomeThresholdScore),
    u32(params.successfulMemberCount),
    u64(params.successfulHealthAlphaScoreSum),
    u64(params.redistributableFailedBondsTotal),
    u64(params.redistributionClaimedAmount),
    u32(params.successfulClaimCount),
    bool(params.finalized),
    bool(params.zeroSuccessReleased),
    i64(params.finalizedAt),
    u8(params.bump),
  ]);
}

function protocolFeeVaultAccount(params: {
  paymentMint: PublicKey;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("ProtocolFeeVault"),
    pubkey(params.paymentMint),
    u8(params.bump),
  ]);
}

function poolOracleFeeVaultAccount(params: {
  pool: PublicKey;
  oracle: PublicKey;
  paymentMint: PublicKey;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("PoolOracleFeeVault"),
    pubkey(params.pool),
    pubkey(params.oracle),
    pubkey(params.paymentMint),
    u8(params.bump),
  ]);
}

function schemaDependencyLedgerAccount(params: {
  schemaKeyHash: Uint8Array;
  activeRuleRefcount: number;
  bump: number;
}): Uint8Array {
  return concat([
    discriminator("SchemaDependencyLedger"),
    params.schemaKeyHash,
    u32(params.activeRuleRefcount),
    u8(params.bump),
  ]);
}

class MockConnection {
  rpcEndpoint = "mock://frontend-protocol-discovery";

  constructor(private readonly entries: ProgramAccountEntry[]) {}

  async getProgramAccounts(
    _programId: PublicKey,
    config?: { filters?: Array<{ memcmp?: { offset: number; bytes: string } }> },
  ): Promise<ProgramAccountEntry[]> {
    const filters = config?.filters ?? [];
    return this.entries.filter((entry) =>
      filters.every((filter) => {
        if (!filter.memcmp) return true;
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

function entry(pubkey: PublicKey, data: Uint8Array): ProgramAccountEntry {
  return {
    pubkey,
    account: { data },
  };
}

test.beforeEach(() => {
  protocol.clearProtocolDiscoveryCache();
});

test("expanded protocol discovery decodes protocol config, oracle stake, and fee vault accounts", async () => {
  const admin = Keypair.generate().publicKey;
  const governanceAuthority = Keypair.generate().publicKey;
  const governanceRealm = Keypair.generate().publicKey;
  const governanceConfig = Keypair.generate().publicKey;
  const defaultStakeMint = Keypair.generate().publicKey;
  const oracle = Keypair.generate().publicKey;
  const otherOracle = Keypair.generate().publicKey;
  const staker = Keypair.generate().publicKey;
  const pool = Keypair.generate().publicKey;
  const paymentMint = Keypair.generate().publicKey;
  const otherMint = Keypair.generate().publicKey;

  const connection = new MockConnection([
    entry(
      Keypair.generate().publicKey,
      protocolConfigAccount({
        admin,
        governanceAuthority,
        governanceRealm,
        governanceConfig,
        defaultStakeMint,
        protocolFeeBps: 175,
        minOracleStake: 5_000_000n,
        emergencyPaused: true,
        allowedPayoutMintsHash: bytes32(31),
        bump: 9,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      oracleStakePositionAccount({
        oracle,
        staker,
        stakeMint: defaultStakeMint,
        stakeVault: Keypair.generate().publicKey,
        stakedAmount: 4_200n,
        pendingUnstakeAmount: 200n,
        canFinalizeUnstakeAt: 123n,
        slashPending: false,
        bump: 4,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      oracleStakePositionAccount({
        oracle: otherOracle,
        staker: Keypair.generate().publicKey,
        stakeMint: Keypair.generate().publicKey,
        stakeVault: Keypair.generate().publicKey,
        stakedAmount: 999n,
        pendingUnstakeAmount: 0n,
        canFinalizeUnstakeAt: 0n,
        slashPending: true,
        bump: 5,
      }),
    ),
    entry(Keypair.generate().publicKey, protocolFeeVaultAccount({ paymentMint, bump: 1 })),
    entry(Keypair.generate().publicKey, protocolFeeVaultAccount({ paymentMint: otherMint, bump: 2 })),
    entry(
      Keypair.generate().publicKey,
      poolOracleFeeVaultAccount({
        pool,
        oracle,
        paymentMint,
        bump: 6,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      poolOracleFeeVaultAccount({
        pool: Keypair.generate().publicKey,
        oracle: otherOracle,
        paymentMint: otherMint,
        bump: 7,
      }),
    ),
  ]);

  const protocolConfigRow = await protocol.fetchProtocolConfig({
    connection: connection as unknown as Connection,
  });
  assert.ok(protocolConfigRow);
  assert.equal(protocolConfigRow.governanceAuthority, governanceAuthority.toBase58());
  assert.equal(protocolConfigRow.protocolFeeBps, 175);
  assert.equal(protocolConfigRow.minOracleStake, 5_000_000n);
  assert.equal(protocolConfigRow.emergencyPaused, true);
  assert.equal(protocolConfigRow.allowedPayoutMintsHashHex, hex(bytes32(31)));

  const stakes = await protocol.listOracleStakePositions({
    connection: connection as unknown as Connection,
    oracleAddress: oracle.toBase58(),
  });
  assert.equal(stakes.length, 1);
  assert.equal(stakes[0]?.staker, staker.toBase58());
  assert.equal(stakes[0]?.stakedAmount, 4_200n);
  assert.equal(stakes[0]?.pendingUnstakeAmount, 200n);

  const protocolFeeVaults = await protocol.listProtocolFeeVaults({
    connection: connection as unknown as Connection,
    paymentMint: paymentMint.toBase58(),
  });
  assert.equal(protocolFeeVaults.length, 1);
  assert.equal(protocolFeeVaults[0]?.paymentMint, paymentMint.toBase58());

  const oracleFeeVaults = await protocol.listPoolOracleFeeVaults({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    oracleAddress: oracle.toBase58(),
  });
  assert.equal(oracleFeeVaults.length, 1);
  assert.equal(oracleFeeVaults[0]?.paymentMint, paymentMint.toBase58());
});

test("member-facing policy and cycle discovery decodes expanded account layouts", async () => {
  const pool = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const paymentMint = Keypair.generate().publicKey;
  const nftMint = Keypair.generate().publicKey;
  const seriesRefHash = bytes32(41);
  const termsHash = bytes32(42);
  const cohortHash = bytes32(43);
  const quoteHash = bytes32(44);

  const connection = new MockConnection([
    entry(
      Keypair.generate().publicKey,
      policySeriesPaymentOptionAccount({
        pool,
        seriesRefHash,
        paymentMint,
        paymentAmount: 125_000n,
        active: true,
        bump: 1,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      policySeriesPaymentOptionAccount({
        pool: Keypair.generate().publicKey,
        seriesRefHash: bytes32(40),
        paymentMint: Keypair.generate().publicKey,
        paymentAmount: 5n,
        active: false,
        bump: 2,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      policyPositionAccount({
        pool,
        member,
        seriesRefHash,
        termsHash,
        status: 2,
        startsAt: 10n,
        endsAt: 20n,
        premiumDueEverySecs: 30n,
        premiumGraceSecs: 40n,
        nextDueAt: 50n,
        nftMint,
        bump: 3,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      policyPositionNftAccount({
        pool,
        member,
        seriesRefHash,
        nftMint,
        metadataUri: "https://example.com/policy-position.json",
        bump: 4,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      memberCycleStateAccount({
        pool,
        member,
        seriesRefHash,
        periodIndex: 7n,
        paymentMint,
        premiumAmountRaw: 100n,
        bondAmountRaw: 20n,
        shieldFeeRaw: 10n,
        protocolFeeRaw: 5n,
        oracleFeeRaw: 2n,
        netPoolPremiumRaw: 83n,
        totalAmountRaw: 120n,
        canonicalPremiumAmount: 100n,
        commitmentEnabled: true,
        thresholdBps: 9000,
        outcomeThresholdScore: 70,
        cohortHash,
        settledHealthAlphaScore: 81,
        includedShieldCount: 3,
        shieldConsumed: false,
        status: 1,
        passed: true,
        activatedAt: 1000n,
        settledAt: 2000n,
        quoteHash,
        bump: 5,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      cohortSettlementRootAccount({
        pool,
        seriesRefHash,
        paymentMint,
        cohortHash,
        outcomeThresholdScore: 70,
        successfulMemberCount: 12,
        successfulHealthAlphaScoreSum: 999n,
        redistributableFailedBondsTotal: 75n,
        redistributionClaimedAmount: 25n,
        successfulClaimCount: 9,
        finalized: true,
        zeroSuccessReleased: false,
        finalizedAt: 3000n,
        bump: 6,
      }),
    ),
  ]);

  const paymentOptions = await protocol.listPolicySeriesPaymentOptions({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    seriesRefHashHex: hex(seriesRefHash),
    activeOnly: true,
  });
  assert.equal(paymentOptions.length, 1);
  assert.equal(paymentOptions[0]?.paymentAmount, 125_000n);

  const positions = await protocol.listPolicyPositions({
    connection: connection as unknown as Connection,
    memberAddress: member.toBase58(),
    seriesRefHashHex: hex(seriesRefHash),
  });
  assert.equal(positions.length, 1);
  assert.equal(positions[0]?.nftMint, nftMint.toBase58());
  assert.equal(positions[0]?.nextDueAt, 50n);

  const positionNfts = await protocol.listPolicyPositionNfts({
    connection: connection as unknown as Connection,
    memberAddress: member.toBase58(),
    search: "policy-position",
  });
  assert.equal(positionNfts.length, 1);
  assert.equal(positionNfts[0]?.metadataUri, "https://example.com/policy-position.json");

  const memberCycles = await protocol.listMemberCycles({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    memberAddress: member.toBase58(),
  });
  assert.equal(memberCycles.length, 1);
  assert.equal(memberCycles[0]?.totalAmountRaw, 120n);
  assert.equal(memberCycles[0]?.quoteHashHex, hex(quoteHash));

  const cohortRoots = await protocol.listCohortSettlementRoots({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    finalizedOnly: true,
  });
  assert.equal(cohortRoots.length, 1);
  assert.equal(cohortRoots[0]?.successfulMemberCount, 12);
  assert.equal(cohortRoots[0]?.redistributableFailedBondsTotal, 75n);
});

test("permission, delegate, and schema dependency discovery filters rows and skips malformed accounts", async () => {
  const pool = Keypair.generate().publicKey;
  const otherPool = Keypair.generate().publicKey;
  const oracle = Keypair.generate().publicKey;
  const otherOracle = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const delegate = Keypair.generate().publicKey;
  const schemaKeyHash = bytes32(55);

  const connection = new MockConnection([
    entry(
      Keypair.generate().publicKey,
      poolOraclePermissionSetAccount({
        pool,
        oracle,
        permissions: 7,
        bump: 1,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      poolOraclePermissionSetAccount({
        pool: otherPool,
        oracle: otherOracle,
        permissions: 2,
        bump: 2,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      claimDelegateAuthorizationAccount({
        pool,
        member,
        delegate,
        active: true,
        updatedAt: 500n,
        bump: 3,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      claimDelegateAuthorizationAccount({
        pool,
        member: Keypair.generate().publicKey,
        delegate,
        active: false,
        updatedAt: 100n,
        bump: 4,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      schemaDependencyLedgerAccount({
        schemaKeyHash,
        activeRuleRefcount: 11,
        bump: 5,
      }),
    ),
    entry(
      Keypair.generate().publicKey,
      schemaDependencyLedgerAccount({
        schemaKeyHash: bytes32(56),
        activeRuleRefcount: 1,
        bump: 6,
      }),
    ),
    entry(Keypair.generate().publicKey, concat([discriminator("PoolOraclePermissionSet"), u8(1), u8(2)])),
  ]);

  const permissionSets = await protocol.listPoolOraclePermissionSets({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    oracleAddress: oracle.toBase58(),
  });
  assert.equal(permissionSets.length, 1);
  assert.equal(permissionSets[0]?.permissions, 7);

  const delegates = await protocol.listClaimDelegateAuthorizations({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
    delegateAddress: delegate.toBase58(),
    activeOnly: true,
  });
  assert.equal(delegates.length, 1);
  assert.equal(delegates[0]?.member, member.toBase58());
  assert.equal(delegates[0]?.updatedAt, 500n);

  const ledgers = await protocol.listSchemaDependencyLedgers({
    connection: connection as unknown as Connection,
    schemaKeyHashHex: hex(schemaKeyHash),
  });
  assert.equal(ledgers.length, 1);
  assert.equal(ledgers[0]?.activeRuleRefcount, 11);
});
