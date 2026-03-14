// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Keypair, PublicKey, type Connection } from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const contract = JSON.parse(
  readFileSync(new URL("../shared/protocol_contract.json", import.meta.url), "utf8"),
) as {
  accountDiscriminators: Record<string, number[]>;
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

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function borshString(value: string): Uint8Array {
  const text = new TextEncoder().encode(value);
  return concat([u32(text.length), text]);
}

function discriminator(accountName: string): Uint8Array {
  const value = contract.accountDiscriminators[accountName];
  if (!value) {
    throw new Error(`Missing discriminator for ${accountName}`);
  }
  return Uint8Array.from(value);
}

function poolTermsAccount(params: {
  pool: PublicKey;
  payoutMint: PublicKey;
}): Uint8Array {
  return concat([
    discriminator("PoolTerms"),
    params.pool.toBytes(),
    u8(0),
    params.payoutMint.toBytes(),
    new Uint8Array(32),
    new Uint8Array(32),
    u8(0),
    borshString("https://example.com/pool.json"),
    u8(1),
  ]);
}

function dummyAccount(data = new Uint8Array([1])) {
  return {
    data,
    executable: false,
    lamports: 1,
    owner: Keypair.generate().publicKey,
    rentEpoch: 0,
  };
}

class MockConnection {
  rpcEndpoint = "mock://rpc";
  private readonly accounts = new Map<string, ReturnType<typeof dummyAccount>>();

  set(address: PublicKey, account: ReturnType<typeof dummyAccount>) {
    this.accounts.set(address.toBase58(), account);
  }

  async getAccountInfo(address: PublicKey): Promise<ReturnType<typeof dummyAccount> | null> {
    return this.accounts.get(address.toBase58()) ?? null;
  }
}

test("fetchProtocolReadiness treats SOL payout pools as vault-configured", async () => {
  const connection = new MockConnection();
  const programId = protocol.getProgramId();
  const pool = Keypair.generate().publicKey;
  const configV2 = protocol.deriveConfigV2Pda(programId);
  const poolTerms = protocol.derivePoolTermsPda({ programId, poolAddress: pool });

  connection.set(configV2, dummyAccount());
  connection.set(pool, dummyAccount());
  connection.set(
    poolTerms,
    dummyAccount(poolTermsAccount({ pool, payoutMint: new PublicKey(protocol.ZERO_PUBKEY) })),
  );

  const readiness = await protocol.fetchProtocolReadiness({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
  });

  assert.equal(readiness.poolTermsConfigured, true);
  assert.equal(readiness.poolAssetVaultConfigured, true);
  assert.equal(readiness.derived.poolAssetVaultAddress, null);
});

test("fetchProtocolReadiness derives SPL vault PDA from pool terms payout mint", async () => {
  const connection = new MockConnection();
  const programId = protocol.getProgramId();
  const pool = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const configV2 = protocol.deriveConfigV2Pda(programId);
  const poolTerms = protocol.derivePoolTermsPda({ programId, poolAddress: pool });
  const poolAssetVault = protocol.derivePoolAssetVaultPda({
    programId,
    poolAddress: pool,
    payoutMint,
  });

  connection.set(configV2, dummyAccount());
  connection.set(pool, dummyAccount());
  connection.set(poolTerms, dummyAccount(poolTermsAccount({ pool, payoutMint })));
  connection.set(poolAssetVault, dummyAccount());

  const readiness = await protocol.fetchProtocolReadiness({
    connection: connection as unknown as Connection,
    poolAddress: pool.toBase58(),
  });

  assert.equal(readiness.poolTermsConfigured, true);
  assert.equal(readiness.poolAssetVaultConfigured, true);
  assert.equal(readiness.derived.poolAssetVaultAddress, poolAssetVault.toBase58());
});
