// SPDX-License-Identifier: AGPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B');

test('pool PDA derivation is deterministic', () => {
  const authority = new PublicKey('11111111111111111111111111111112');
  const poolId = 'omega-holder-pool';

  const [a] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), authority.toBuffer(), Buffer.from(poolId, 'utf8')],
    PROGRAM_ID,
  );
  const [b] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), authority.toBuffer(), Buffer.from(poolId, 'utf8')],
    PROGRAM_ID,
  );

  assert.equal(a.toBase58(), b.toBase58());
});

test('pool liquidity config PDA derivation is deterministic', () => {
  const pool = new PublicKey('11111111111111111111111111111113');

  const [a] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_liquidity_config'), pool.toBuffer()],
    PROGRAM_ID,
  );
  const [b] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_liquidity_config'), pool.toBuffer()],
    PROGRAM_ID,
  );

  assert.equal(a.toBase58(), b.toBase58());
});

test('pool share mint PDA derivation is deterministic', () => {
  const pool = new PublicKey('11111111111111111111111111111113');

  const [a] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_share_mint'), pool.toBuffer()],
    PROGRAM_ID,
  );
  const [b] = PublicKey.findProgramAddressSync(
    [Buffer.from('pool_share_mint'), pool.toBuffer()],
    PROGRAM_ID,
  );

  assert.equal(a.toBase58(), b.toBase58());
});
