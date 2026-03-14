// SPDX-License-Identifier: AGPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey } from '@solana/web3.js';

import protocolModule from '../frontend/lib/protocol.ts';

const {
  buildCreatePoolV2Tx,
  buildEnrollMemberOpenTx,
  buildRegisterPoolCapitalClassTx,
  buildSetPoolRiskControlsTx,
  buildSetPoolStatusTx,
  buildSetClaimDelegateTx,
  deriveClaimDelegatePda,
  derivePolicyPositionPda,
  derivePoolCapitalClassPda,
  derivePoolPda,
  derivePoolRiskConfigPda,
  derivePoolTreasuryReservePda,
  getProgramId,
  isPoolIdSeedSafe,
  POOL_CLAIM_MODE_PAUSED,
  POOL_REDEMPTION_MODE_QUEUE_ONLY,
  POOL_STATUS_CLOSED,
  poolIdByteLength,
} = protocolModule as unknown as typeof import('../frontend/lib/protocol.ts');

test('poolIdByteLength counts UTF-8 bytes', () => {
  assert.equal(poolIdByteLength('abc'), 3);
  assert.equal(poolIdByteLength('🙂'), 4);
});

test('isPoolIdSeedSafe enforces 32-byte max', () => {
  assert.equal(isPoolIdSeedSafe('a'.repeat(32)), true);
  assert.equal(isPoolIdSeedSafe('a'.repeat(33)), false);
});

test('derivePoolPda is deterministic', () => {
  const authority = new PublicKey('11111111111111111111111111111112');
  const programId = getProgramId();

  const a = derivePoolPda({
    programId,
    authority,
    poolId: 'omegax-test-pool',
  });
  const b = derivePoolPda({
    programId,
    authority,
    poolId: 'omegax-test-pool',
  });

  assert.equal(a.toBase58(), b.toBase58());
});

test('buildCreatePoolV2Tx builds a transaction with one instruction', () => {
  const authority = Keypair.generate().publicKey;
  const recentBlockhash = '11111111111111111111111111111111';

  const { tx, poolAddress } = buildCreatePoolV2Tx({
    authority,
    recentBlockhash,
    poolId: 'omegax-test-pool',
    organizationRef: 'omegax',
    payoutLamportsPerPass: 1_000_000n,
    membershipMode: 1,
    tokenGateMint: '11111111111111111111111111111111',
    tokenGateMinBalance: 1n,
    metadataUri: 'https://example.com/pool-metadata.json',
    termsHashHex: '11'.repeat(32),
    payoutPolicyHashHex: '22'.repeat(32),
  });

  assert.equal(typeof (poolAddress as PublicKey).toBase58, 'function');
  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.programId.toBase58(), getProgramId().toBase58());
});

test('buildSetPoolStatusTx builds a close-status transaction with one instruction', () => {
  const authority = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const recentBlockhash = '11111111111111111111111111111111';

  const tx = buildSetPoolStatusTx({
    authority,
    poolAddress,
    recentBlockhash,
    status: POOL_STATUS_CLOSED,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.programId.toBase58(), getProgramId().toBase58());
  assert.equal(tx.instructions[0]?.keys.length, 2);
  assert.equal(tx.instructions[0]?.keys[0]?.pubkey.toBase58(), authority.toBase58());
  assert.equal(tx.instructions[0]?.keys[1]?.pubkey.toBase58(), poolAddress.toBase58());
});

test('buildSetPoolStatusTx rejects unsupported status values', () => {
  const authority = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const recentBlockhash = '11111111111111111111111111111111';

  assert.throws(
    () => buildSetPoolStatusTx({
      authority,
      poolAddress,
      recentBlockhash,
      status: 2,
    }),
    /Pool status must be one of DRAFT\(0\), ACTIVE\(1\), or CLOSED\(3\)\./,
  );
});

test('derivePolicyPositionPda and deriveClaimDelegatePda are deterministic', () => {
  const programId = getProgramId();
  const poolAddress = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const seriesRefHash = Buffer.from('11'.repeat(32), 'hex');

  const coverageA = derivePolicyPositionPda({ programId, poolAddress, seriesRefHash, member });
  const coverageB = derivePolicyPositionPda({ programId, poolAddress, seriesRefHash, member });
  assert.equal(coverageA.toBase58(), coverageB.toBase58());

  const delegateA = deriveClaimDelegatePda({ programId, poolAddress, member });
  const delegateB = deriveClaimDelegatePda({ programId, poolAddress, member });
  assert.equal(delegateA.toBase58(), delegateB.toBase58());
});

test('derivePoolRiskConfigPda and derivePoolTreasuryReservePda are deterministic', () => {
  const programId = getProgramId();
  const poolAddress = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const shareMint = Keypair.generate().publicKey;

  const riskConfigA = derivePoolRiskConfigPda({ programId, poolAddress });
  const riskConfigB = derivePoolRiskConfigPda({ programId, poolAddress });
  assert.equal(riskConfigA.toBase58(), riskConfigB.toBase58());

  const capitalClassA = derivePoolCapitalClassPda({ programId, poolAddress, shareMint });
  const capitalClassB = derivePoolCapitalClassPda({ programId, poolAddress, shareMint });
  assert.equal(capitalClassA.toBase58(), capitalClassB.toBase58());

  const reserveA = derivePoolTreasuryReservePda({ programId, poolAddress, paymentMint: payoutMint });
  const reserveB = derivePoolTreasuryReservePda({ programId, poolAddress, paymentMint: payoutMint });
  assert.equal(reserveA.toBase58(), reserveB.toBase58());
});

test('buildSetPoolRiskControlsTx emits a single instruction with derived risk accounts', () => {
  const authority = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const recentBlockhash = '11111111111111111111111111111111';
  const programId = getProgramId();
  const poolRiskConfig = derivePoolRiskConfigPda({ programId, poolAddress });
  const poolTreasuryReserve = derivePoolTreasuryReservePda({ programId, poolAddress, paymentMint: payoutMint });

  const tx = buildSetPoolRiskControlsTx({
    authority,
    poolAddress,
    payoutMint,
    recentBlockhash,
    redemptionMode: POOL_REDEMPTION_MODE_QUEUE_ONLY,
    claimMode: POOL_CLAIM_MODE_PAUSED,
    impaired: true,
    impairmentAmount: 42n,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.programId.toBase58(), programId.toBase58());
  assert.equal(tx.instructions[0]?.keys[4]?.pubkey.toBase58(), poolRiskConfig.toBase58());
  assert.equal(tx.instructions[0]?.keys[5]?.pubkey.toBase58(), poolTreasuryReserve.toBase58());
});

test('buildRegisterPoolCapitalClassTx emits a single instruction with derived class accounts', () => {
  const authority = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const recentBlockhash = '11111111111111111111111111111111';
  const programId = getProgramId();
  const poolShareMint = protocolModule.derivePoolShareMintPda({ programId, poolAddress });
  const poolCapitalClass = derivePoolCapitalClassPda({ programId, poolAddress, shareMint: poolShareMint });

  const tx = buildRegisterPoolCapitalClassTx({
    authority,
    poolAddress,
    recentBlockhash,
    classIdHashHex: '11'.repeat(32),
    classMode: 0,
    classPriority: 1,
    transferMode: 1,
    restricted: true,
    redemptionQueueEnabled: true,
    ringFenced: true,
    lockupSecs: 86_400n,
    redemptionNoticeSecs: 3_600n,
    complianceProfileHashHex: '22'.repeat(32),
    seriesRefHashHex: '33'.repeat(32),
    vintageIndex: 7,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.programId.toBase58(), programId.toBase58());
  assert.equal(tx.instructions[0]?.keys[5]?.pubkey.toBase58(), poolShareMint.toBase58());
  assert.equal(tx.instructions[0]?.keys[6]?.pubkey.toBase58(), poolCapitalClass.toBase58());
});

test('member enrollment and delegate builders emit single-instruction transactions', () => {
  const member = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const recentBlockhash = '11111111111111111111111111111111';

  const enrollTx = buildEnrollMemberOpenTx({
    member,
    poolAddress,
    recentBlockhash,
  });
  assert.equal(enrollTx.instructions.length, 1);
  assert.equal(enrollTx.instructions[0]?.programId.toBase58(), getProgramId().toBase58());

  const setDelegateTx = buildSetClaimDelegateTx({
    member,
    poolAddress,
    recentBlockhash,
    delegate: Keypair.generate().publicKey,
    active: true,
  });
  assert.equal(setDelegateTx.instructions.length, 1);
  assert.equal(setDelegateTx.instructions[0]?.programId.toBase58(), getProgramId().toBase58());
});
