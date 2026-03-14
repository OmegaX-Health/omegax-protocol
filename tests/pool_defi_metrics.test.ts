// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import bs58 from "bs58";
import { Keypair, PublicKey, type Connection } from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";
import poolMetadataModule from "../frontend/lib/pool-metadata.ts";
import poolDefiMetricsModule from "../frontend/lib/pool-defi-metrics.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const poolMetadata = poolMetadataModule as typeof import("../frontend/lib/pool-metadata.ts");
const poolDefiMetrics = poolDefiMetricsModule as typeof import("../frontend/lib/pool-defi-metrics.ts");
const contract = JSON.parse(
  readFileSync(new URL("../shared/protocol_contract.json", import.meta.url), "utf8"),
) as { accountDiscriminators: Record<string, number[]> };

type ProgramAccountEntry = {
  pubkey: PublicKey;
  account: ReturnType<typeof dummyAccount>;
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

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
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

function poolTermsAccount(params: {
  pool: PublicKey;
  poolType: number;
  payoutAssetMint: PublicKey;
  metadataUri: string;
}): Uint8Array {
  return concat([
    discriminator("PoolTerms"),
    pubkey(params.pool),
    u8(params.poolType),
    pubkey(params.payoutAssetMint),
    bytes32(11),
    bytes32(22),
    u8(0),
    borshString(params.metadataUri),
    u8(1),
  ]);
}

function poolAssetVaultAccount(params: {
  pool: PublicKey;
  payoutMint: PublicKey;
  vaultTokenAccount: PublicKey;
  active: boolean;
}): Uint8Array {
  return concat([
    discriminator("PoolAssetVault"),
    pubkey(params.pool),
    pubkey(params.payoutMint),
    pubkey(params.vaultTokenAccount),
    bool(params.active),
    u8(1),
  ]);
}

function tokenAccountData(amount: bigint): Uint8Array {
  const data = new Uint8Array(165);
  new DataView(data.buffer).setBigUint64(64, amount, true);
  return data;
}

function mintAccountData(decimals: number): Uint8Array {
  const data = new Uint8Array(82);
  data[44] = decimals & 0xff;
  return data;
}

function dummyAccount(data = new Uint8Array([1]), lamports = 1) {
  return {
    data,
    executable: false,
    lamports,
    owner: Keypair.generate().publicKey,
    rentEpoch: 0,
  };
}

function matchesFilters(entry: ProgramAccountEntry, filters: Array<{ memcmp?: { offset: number; bytes: string } }>): boolean {
  for (const filter of filters) {
    if (!filter.memcmp) continue;
    const expected = bs58.decode(filter.memcmp.bytes);
    const actual = entry.account.data.subarray(filter.memcmp.offset, filter.memcmp.offset + expected.length);
    if (!Buffer.from(actual).equals(Buffer.from(expected))) {
      return false;
    }
  }
  return true;
}

class MockMetricsConnection {
  rpcEndpoint = "mock://pool-defi-metrics";
  programAccountCalls = 0;
  multipleAccountCalls = 0;
  private readonly programAccounts: ProgramAccountEntry[] = [];
  private readonly accounts = new Map<string, ReturnType<typeof dummyAccount>>();

  addProgramAccount(address: PublicKey, data: Uint8Array) {
    this.programAccounts.push({
      pubkey: address,
      account: dummyAccount(data),
    });
  }

  setAccount(address: PublicKey, account: ReturnType<typeof dummyAccount>) {
    this.accounts.set(address.toBase58(), account);
  }

  async getProgramAccounts(
    _programId: PublicKey,
    options?: { filters?: Array<{ memcmp?: { offset: number; bytes: string } }> },
  ): Promise<ProgramAccountEntry[]> {
    this.programAccountCalls += 1;
    const filters = options?.filters ?? [];
    return this.programAccounts.filter((entry) => matchesFilters(entry, filters));
  }

  async getMultipleAccountsInfo(
    addresses: PublicKey[],
  ): Promise<Array<ReturnType<typeof dummyAccount> | null>> {
    this.multipleAccountCalls += 1;
    return addresses.map((address) => this.accounts.get(address.toBase58()) ?? null);
  }
}

test("parsePoolDefiMetadata returns expected APY fields for valid payload", () => {
  const parsed = poolMetadata.parsePoolDefiMetadata({
    schema: "omegax.pool",
    version: 1,
    defi: {
      apyBps: 1250,
      apyWindowDays: 30,
      apyAsOfTs: 1_730_000_000,
      apyMethodologyUri: "https://example.com/methodology",
    },
  });

  assert.equal(parsed.error, null);
  assert.deepEqual(parsed.defi, {
    apyBps: 1250,
    windowDays: 30,
    asOfTs: 1_730_000_000,
    methodologyUri: "https://example.com/methodology",
  });
});

test("parsePoolDefiMetadata returns null APY when defi block is absent", () => {
  const parsed = poolMetadata.parsePoolDefiMetadata({
    schema: "omegax.pool",
    version: 1,
  });

  assert.equal(parsed.error, null);
  assert.equal(parsed.defi, null);
});

test("parsePoolDefiMetadata rejects invalid APY values with stable error codes", () => {
  const parsed = poolMetadata.parsePoolDefiMetadata({
    schema: "omegax.pool",
    version: 1,
    defi: {
      apyBps: "12.5%",
    },
  });

  assert.equal(parsed.defi, null);
  assert.equal(parsed.error?.code, "invalid_apy_bps");
});

test("parseSplTokenAccountAmount reads little-endian amount at SPL offset 64", () => {
  const tokenAccount = new Uint8Array(165);
  new DataView(tokenAccount.buffer).setBigUint64(64, 9_876_543_210n, true);

  const amount = poolDefiMetrics.parseSplTokenAccountAmount(tokenAccount);
  assert.equal(amount, 9_876_543_210n);
});

test("parseSplMintDecimals reads decimals byte at mint offset 44", () => {
  const mintAccount = new Uint8Array(82);
  mintAccount[44] = 6;

  const decimals = poolDefiMetrics.parseSplMintDecimals(mintAccount);
  assert.equal(decimals, 6);
});

test("formatPoolTvl preserves bigint precision for very large values", () => {
  const formatted = poolDefiMetrics.formatPoolTvl({
    kind: "sol",
    amountRaw: 9007199254740993000000000n,
    decimals: 9,
    mint: null,
  });

  assert.equal(formatted.endsWith(" SOL"), true);
  assert.equal(formatted.replace(/[^\d]/g, ""), "9007199254740993");
});

test("formatPoolTvl trims fractional precision without Number conversion", () => {
  const formatted = poolDefiMetrics.formatPoolTvl({
    kind: "spl",
    amountRaw: 1_234_567n,
    decimals: 6,
    mint: "mint",
  });

  assert.equal(formatted, "1.2345 SPL");
});

test("listPoolDefiMetrics hydrates SOL and SPL pools and reuses caches across repeated calls", async () => {
  poolDefiMetrics.clearPoolDefiMetricCache();
  poolMetadata.clearPoolMetadataCache();
  protocol.clearProtocolDiscoveryCache();

  const connection = new MockMetricsConnection();
  const solPool = Keypair.generate().publicKey;
  const splPool = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const vaultTokenAccount = Keypair.generate().publicKey;

  connection.addProgramAccount(
    Keypair.generate().publicKey,
    poolTermsAccount({
      pool: solPool,
      poolType: 0,
      payoutAssetMint: new PublicKey(protocol.ZERO_PUBKEY),
      metadataUri: "https://example.com/pools/sol.json",
    }),
  );
  connection.addProgramAccount(
    Keypair.generate().publicKey,
    poolTermsAccount({
      pool: splPool,
      poolType: 1,
      payoutAssetMint: payoutMint,
      metadataUri: "https://example.com/pools/spl.json",
    }),
  );
  connection.addProgramAccount(
    Keypair.generate().publicKey,
    poolAssetVaultAccount({
      pool: splPool,
      payoutMint,
      vaultTokenAccount,
      active: true,
    }),
  );

  connection.setAccount(solPool, dummyAccount(new Uint8Array([1]), 2_500_000_000));
  connection.setAccount(vaultTokenAccount, dummyAccount(tokenAccountData(987_654_321n)));
  connection.setAccount(payoutMint, dummyAccount(mintAccountData(6)));

  const originalFetch = globalThis.fetch;
  const fetchCalls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url.endsWith("/sol.json")) {
      return new Response(
        JSON.stringify({
          schema: "omegax.pool",
          version: 1,
          defi: { apyBps: 250, apyWindowDays: 14 },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    return new Response(
      JSON.stringify({
        schema: "omegax.pool",
        version: 1,
        defi: { apyBps: 875, apyAsOfTs: 1_730_000_000, apyMethodologyUri: "https://example.com/method" },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const pools = [
      { address: solPool.toBase58() },
      { address: splPool.toBase58() },
    ] as Array<Pick<import("../frontend/lib/protocol.ts").PoolSummary, "address">>;

    const first = await poolDefiMetrics.listPoolDefiMetrics({
      connection: connection as unknown as Connection,
      pools: pools as import("../frontend/lib/protocol.ts").PoolSummary[],
    });

    assert.deepEqual(first[solPool.toBase58()], {
      tvl: {
        kind: "sol",
        amountRaw: 2_500_000_000n,
        decimals: 9,
        mint: null,
      },
      apy: {
        apyBps: 250,
        windowDays: 14,
        asOfTs: null,
        methodologyUri: null,
      },
      metadataUri: "https://example.com/pools/sol.json",
      apyErrorCode: null,
    });

    assert.deepEqual(first[splPool.toBase58()], {
      tvl: {
        kind: "spl",
        amountRaw: 987_654_321n,
        decimals: 6,
        mint: payoutMint.toBase58(),
      },
      apy: {
        apyBps: 875,
        windowDays: 30,
        asOfTs: 1_730_000_000,
        methodologyUri: "https://example.com/method",
      },
      metadataUri: "https://example.com/pools/spl.json",
      apyErrorCode: null,
    });

    assert.equal(connection.programAccountCalls, 2);
    assert.equal(connection.multipleAccountCalls, 3);
    assert.deepEqual(fetchCalls, [
      "https://example.com/pools/sol.json",
      "https://example.com/pools/spl.json",
    ]);

    const second = await poolDefiMetrics.listPoolDefiMetrics({
      connection: connection as unknown as Connection,
      pools: pools as import("../frontend/lib/protocol.ts").PoolSummary[],
    });

    assert.deepEqual(second, first);
    assert.equal(connection.programAccountCalls, 2);
    assert.equal(connection.multipleAccountCalls, 3);
    assert.deepEqual(fetchCalls, [
      "https://example.com/pools/sol.json",
      "https://example.com/pools/spl.json",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    poolDefiMetrics.clearPoolDefiMetricCache();
    poolMetadata.clearPoolMetadataCache();
    protocol.clearProtocolDiscoveryCache();
  }
});
