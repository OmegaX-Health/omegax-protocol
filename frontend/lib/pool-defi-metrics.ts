// SPDX-License-Identifier: AGPL-3.0-or-later

import { Connection, PublicKey } from "@solana/web3.js";

import {
  listPoolAssetVaults,
  listPoolTerms,
  type PoolAssetVaultSummary,
  type PoolSummary,
  type PoolTermsSummary,
} from "./protocol";
import {
  fetchPoolMetadata,
  parsePoolDefiMetadata,
  type PoolDefiMetadataParseErrorCode,
  type PoolMetadataFetchErrorCode,
} from "./pool-metadata";

const ZERO_PUBKEY = "11111111111111111111111111111111";
const SOL_DECIMALS = 9;
const SPL_TOKEN_ACCOUNT_AMOUNT_OFFSET = 64;
const SPL_TOKEN_ACCOUNT_AMOUNT_BYTES = 8;
const SPL_MINT_DECIMALS_OFFSET = 44;
const SPL_MINT_MIN_BYTES = 45;
const RPC_BATCH_SIZE = 100;
const TVL_CACHE_TTL_MS = 30_000;

type TvlCacheEntry = {
  expiresAt: number;
  value: PoolTvlMetric | null;
};

const tvlCache = new Map<string, TvlCacheEntry>();

export type PoolTvlMetric = {
  kind: "sol" | "spl";
  amountRaw: bigint;
  decimals: number;
  mint: string | null;
};

export type PoolApyMetric = {
  apyBps: number;
  windowDays: number;
  asOfTs: number | null;
  methodologyUri: string | null;
};

export type PoolDefiMetrics = {
  tvl: PoolTvlMetric | null;
  apy: PoolApyMetric | null;
  metadataUri: string | null;
  apyErrorCode: PoolMetadataFetchErrorCode | PoolDefiMetadataParseErrorCode | null;
};

export type PoolDefiMetricsByPool = Record<string, PoolDefiMetrics>;

type SplPoolTarget = {
  poolAddress: string;
  mint: string;
  vaultTokenAccount: string | null;
};

function chunk<T>(rows: T[], size: number): T[][] {
  if (size <= 0 || rows.length === 0) return rows.length ? [rows] : [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

function endpointKey(connection: Connection): string {
  return (connection as Connection & { rpcEndpoint?: string }).rpcEndpoint ?? "rpc";
}

function tvlCacheKey(connection: Connection, poolAddress: string): string {
  return `${endpointKey(connection)}|${poolAddress}`;
}

function readU64LE(bytes: Uint8Array, offset: number): bigint {
  if (offset + 8 > bytes.length) {
    throw new Error(`Unable to read u64 at offset ${offset}`);
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 8).getBigUint64(0, true);
}

export function parseSplTokenAccountAmount(data: Uint8Array): bigint {
  if (data.length < SPL_TOKEN_ACCOUNT_AMOUNT_OFFSET + SPL_TOKEN_ACCOUNT_AMOUNT_BYTES) {
    throw new Error("SPL token account data is too short.");
  }
  return readU64LE(data, SPL_TOKEN_ACCOUNT_AMOUNT_OFFSET);
}

export function parseSplMintDecimals(data: Uint8Array): number {
  if (data.length < SPL_MINT_MIN_BYTES) {
    throw new Error("SPL mint account data is too short.");
  }
  return data[SPL_MINT_DECIMALS_OFFSET] ?? 0;
}

function toPublicKeys(values: string[]): PublicKey[] {
  const out: PublicKey[] = [];
  for (const value of values) {
    try {
      out.push(new PublicKey(value));
    } catch {
      // Skip malformed addresses from stale metadata.
    }
  }
  return out;
}

async function fetchAccountInfoMap(
  connection: Connection,
  addresses: string[],
): Promise<Map<string, Awaited<ReturnType<Connection["getMultipleAccountsInfo"]>>[number]>> {
  const entries = new Map<string, Awaited<ReturnType<Connection["getMultipleAccountsInfo"]>>[number]>();
  const publicKeys = toPublicKeys(addresses);
  for (const slice of chunk(publicKeys, RPC_BATCH_SIZE)) {
    const infos = await connection.getMultipleAccountsInfo(slice, "confirmed");
    slice.forEach((publicKey, index) => {
      entries.set(publicKey.toBase58(), infos[index] ?? null);
    });
  }
  return entries;
}

function poolTermsByPoolAddress(rows: PoolTermsSummary[]): Map<string, PoolTermsSummary> {
  const out = new Map<string, PoolTermsSummary>();
  for (const row of rows) {
    if (!out.has(row.pool)) {
      out.set(row.pool, row);
    }
  }
  return out;
}

function poolVaultByPoolAddress(rows: PoolAssetVaultSummary[]): Map<string, PoolAssetVaultSummary> {
  const out = new Map<string, PoolAssetVaultSummary>();
  for (const row of rows) {
    const existing = out.get(row.pool);
    if (!existing || (!existing.active && row.active)) {
      out.set(row.pool, row);
    }
  }
  return out;
}

function cachedTvl(connection: Connection, poolAddress: string): PoolTvlMetric | null | undefined {
  const key = tvlCacheKey(connection, poolAddress);
  const existing = tvlCache.get(key);
  if (!existing) return undefined;
  if (existing.expiresAt <= Date.now()) {
    tvlCache.delete(key);
    return undefined;
  }
  return existing.value;
}

function writeTvlCache(connection: Connection, poolAddress: string, value: PoolTvlMetric | null): void {
  tvlCache.set(tvlCacheKey(connection, poolAddress), {
    expiresAt: Date.now() + TVL_CACHE_TTL_MS,
    value,
  });
}

async function hydrateSolTvls(
  connection: Connection,
  poolAddresses: string[],
): Promise<Map<string, PoolTvlMetric>> {
  const accountInfoByAddress = await fetchAccountInfoMap(connection, poolAddresses);
  const out = new Map<string, PoolTvlMetric>();
  for (const poolAddress of poolAddresses) {
    const lamports = BigInt(accountInfoByAddress.get(poolAddress)?.lamports ?? 0);
    out.set(poolAddress, {
      kind: "sol",
      amountRaw: lamports,
      decimals: SOL_DECIMALS,
      mint: null,
    });
  }
  return out;
}

async function hydrateSplTvls(
  connection: Connection,
  targets: SplPoolTarget[],
): Promise<Map<string, PoolTvlMetric>> {
  const tokenAccountAddresses = Array.from(
    new Set(targets.map((target) => target.vaultTokenAccount).filter((value): value is string => Boolean(value))),
  );
  const mintAddresses = Array.from(new Set(targets.map((target) => target.mint)));
  const [tokenInfos, mintInfos] = await Promise.all([
    fetchAccountInfoMap(connection, tokenAccountAddresses),
    fetchAccountInfoMap(connection, mintAddresses),
  ]);

  const decimalsByMint = new Map<string, number>();
  for (const mintAddress of mintAddresses) {
    const info = mintInfos.get(mintAddress);
    if (!info?.data) {
      decimalsByMint.set(mintAddress, 0);
      continue;
    }
    try {
      decimalsByMint.set(mintAddress, parseSplMintDecimals(info.data));
    } catch {
      decimalsByMint.set(mintAddress, 0);
    }
  }

  const out = new Map<string, PoolTvlMetric>();
  for (const target of targets) {
    let amountRaw = 0n;
    if (target.vaultTokenAccount) {
      const info = tokenInfos.get(target.vaultTokenAccount);
      if (info?.data) {
        try {
          amountRaw = parseSplTokenAccountAmount(info.data);
        } catch {
          amountRaw = 0n;
        }
      }
    }
    out.set(target.poolAddress, {
      kind: "spl",
      amountRaw,
      decimals: decimalsByMint.get(target.mint) ?? 0,
      mint: target.mint,
    });
  }
  return out;
}

type MetadataLookup = {
  apy: PoolApyMetric | null;
  errorCode: PoolMetadataFetchErrorCode | PoolDefiMetadataParseErrorCode | null;
};

async function loadMetadataByUri(metadataUris: string[]): Promise<Map<string, MetadataLookup>> {
  const out = new Map<string, MetadataLookup>();
  await Promise.all(
    metadataUris.map(async (metadataUri) => {
      const fetched = await fetchPoolMetadata(metadataUri);
      if (fetched.error) {
        out.set(metadataUri, { apy: null, errorCode: fetched.error.code });
        return;
      }
      const parsed = parsePoolDefiMetadata(fetched.metadata);
      if (parsed.error) {
        out.set(metadataUri, { apy: null, errorCode: parsed.error.code });
        return;
      }
      out.set(metadataUri, {
        apy: parsed.defi
          ? {
            apyBps: parsed.defi.apyBps,
            windowDays: parsed.defi.windowDays,
            asOfTs: parsed.defi.asOfTs,
            methodologyUri: parsed.defi.methodologyUri,
          }
          : null,
        errorCode: null,
      });
    }),
  );
  return out;
}

export async function listPoolDefiMetrics(params: {
  connection: Connection;
  pools: PoolSummary[];
}): Promise<PoolDefiMetricsByPool> {
  const byPool: PoolDefiMetricsByPool = {};
  if (!params.pools.length) return byPool;

  const [terms, vaults] = await Promise.all([
    listPoolTerms({ connection: params.connection, search: null }),
    listPoolAssetVaults({ connection: params.connection, search: null }),
  ]);

  const termsByPool = poolTermsByPoolAddress(terms);
  const vaultByPool = poolVaultByPoolAddress(vaults);

  const solTargets: string[] = [];
  const splTargets: SplPoolTarget[] = [];
  for (const pool of params.pools) {
    byPool[pool.address] = {
      tvl: null,
      apy: null,
      metadataUri: termsByPool.get(pool.address)?.metadataUri ?? null,
      apyErrorCode: null,
    };

    const cached = cachedTvl(params.connection, pool.address);
    if (cached !== undefined) {
      byPool[pool.address]!.tvl = cached;
      continue;
    }

    const termsForPool = termsByPool.get(pool.address);
    if (!termsForPool) {
      writeTvlCache(params.connection, pool.address, null);
      continue;
    }

    if (termsForPool.payoutAssetMint === ZERO_PUBKEY) {
      solTargets.push(pool.address);
      continue;
    }

    const assetVault = vaultByPool.get(pool.address);
    splTargets.push({
      poolAddress: pool.address,
      mint: termsForPool.payoutAssetMint,
      vaultTokenAccount: assetVault?.vaultTokenAccount ?? null,
    });
  }

  const [solTvls, splTvls] = await Promise.all([
    hydrateSolTvls(params.connection, solTargets),
    hydrateSplTvls(params.connection, splTargets),
  ]);

  for (const [poolAddress, tvl] of solTvls) {
    if (!byPool[poolAddress]) continue;
    byPool[poolAddress]!.tvl = tvl;
    writeTvlCache(params.connection, poolAddress, tvl);
  }
  for (const [poolAddress, tvl] of splTvls) {
    if (!byPool[poolAddress]) continue;
    byPool[poolAddress]!.tvl = tvl;
    writeTvlCache(params.connection, poolAddress, tvl);
  }

  const metadataUris = Array.from(
    new Set(
      Object.values(byPool)
        .map((row) => row.metadataUri?.trim() ?? "")
        .filter(Boolean),
    ),
  );
  const metadataByUri = await loadMetadataByUri(metadataUris);
  for (const [poolAddress, metrics] of Object.entries(byPool)) {
    if (!metrics.metadataUri) continue;
    const metadata = metadataByUri.get(metrics.metadataUri);
    if (!metadata) continue;
    metrics.apy = metadata.apy;
    metrics.apyErrorCode = metadata.errorCode;
  }

  return byPool;
}

export function formatPoolTvl(metric: PoolTvlMetric | null): string {
  if (!metric) return "—";
  const numeric = formatBigIntUnits(metric.amountRaw, metric.decimals, 4);
  if (metric.kind === "sol") return `${numeric} SOL`;
  return `${numeric} SPL`;
}

export function formatApyBps(apy: PoolApyMetric | null): string {
  if (!apy) return "—";
  const percent = apy.apyBps / 100;
  return `${percent.toLocaleString(undefined, {
    minimumFractionDigits: percent % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function clearPoolDefiMetricCache(): void {
  tvlCache.clear();
}

function formatBigIntUnits(value: bigint, decimals: number, maxFractionDigits: number): string {
  if (decimals <= 0) {
    return value.toLocaleString();
  }

  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) {
    return whole.toLocaleString();
  }

  const fractionRaw = fraction.toString().padStart(decimals, "0");
  const clipped = fractionRaw.slice(0, Math.max(0, maxFractionDigits));
  const fractionTrimmed = clipped.replace(/0+$/, "");
  if (!fractionTrimmed) {
    return whole.toLocaleString();
  }
  return `${whole.toLocaleString()}.${fractionTrimmed}`;
}
