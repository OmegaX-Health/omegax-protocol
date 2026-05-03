// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

import type {
  BigNumberish,
  CommitmentPositionSnapshot,
  ObligationSnapshot,
  PartialReserveBalanceSheet,
  ReserveAssetRailSnapshot,
  ReserveScopedSnapshot,
} from "../../frontend/lib/protocol.ts";

const COMMITMENT_POSITION_PENDING = 0;
const COMMITMENT_POSITION_REFUNDED = 3;
const COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED = 4;
const OBLIGATION_STATUS_RESERVED = 1;
const OBLIGATION_STATUS_CLAIMABLE_PAYABLE = 2;
const RESERVE_ASSET_ROLE_PRIMARY_STABLE = 0;
const RESERVE_ASSET_ROLE_SECONDARY_STABLE = 1;
const RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL = 2;
const RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT = 3;

export const CANONICAL_FOUNDER_REHEARSAL_IDS = {
  reserveDomainId: "open-health-usdc",
  planId: "genesis-protect-acute-v1",
  seriesId: "genesis-travel-30-v1",
  campaignId: "founder-travel30",
  poolId: "omega-health-income",
} as const;

export type FounderAssetSymbol =
  | "USDC"
  | "PUSD"
  | "WSOL"
  | "WBTC"
  | "WETH"
  | "OMEGAX";

export type FounderAssetRail = {
  symbol: FounderAssetSymbol;
  decimals: number;
  payoutPriority: number;
  haircutBps: number;
  maxExposureBps: number;
  role: number;
  priceUsd1e8: bigint;
  depositEnabled: boolean;
  payoutEnabled: boolean;
  capacityEnabled: boolean;
  mintEnv: string;
  localMintLabel?: string;
  isNativeSol?: boolean;
};

export const FOUNDER_ASSET_RAILS: readonly FounderAssetRail[] = [
  {
    symbol: "USDC",
    decimals: 6,
    payoutPriority: 1,
    haircutBps: 0,
    maxExposureBps: 10_000,
    role: RESERVE_ASSET_ROLE_PRIMARY_STABLE,
    priceUsd1e8: 100_000_000n,
    depositEnabled: true,
    payoutEnabled: true,
    capacityEnabled: true,
    mintEnv: "OMEGAX_DEVNET_USDC_MINT",
    localMintLabel: "usdc-mint",
  },
  {
    symbol: "PUSD",
    decimals: 6,
    payoutPriority: 2,
    haircutBps: 50,
    maxExposureBps: 9_000,
    role: RESERVE_ASSET_ROLE_SECONDARY_STABLE,
    priceUsd1e8: 100_000_000n,
    depositEnabled: true,
    payoutEnabled: true,
    capacityEnabled: true,
    mintEnv: "OMEGAX_DEVNET_PUSD_MINT",
    localMintLabel: "pusd-mint",
  },
  {
    symbol: "WSOL",
    decimals: 9,
    payoutPriority: 3,
    haircutBps: 2_000,
    maxExposureBps: 5_000,
    role: RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL,
    priceUsd1e8: 15_000_000_000n,
    depositEnabled: true,
    payoutEnabled: true,
    capacityEnabled: true,
    mintEnv: "OMEGAX_DEVNET_WSOL_MINT",
    isNativeSol: true,
  },
  {
    symbol: "WBTC",
    decimals: 8,
    payoutPriority: 4,
    haircutBps: 2_500,
    maxExposureBps: 4_000,
    role: RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL,
    priceUsd1e8: 10_000_000_000_000n,
    depositEnabled: true,
    payoutEnabled: true,
    capacityEnabled: true,
    mintEnv: "OMEGAX_DEVNET_WBTC_MINT",
    localMintLabel: "wbtc-mint",
  },
  {
    symbol: "WETH",
    decimals: 8,
    payoutPriority: 5,
    haircutBps: 2_500,
    maxExposureBps: 4_000,
    role: RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL,
    priceUsd1e8: 300_000_000_000n,
    depositEnabled: true,
    payoutEnabled: true,
    capacityEnabled: true,
    mintEnv: "OMEGAX_DEVNET_WETH_MINT",
    localMintLabel: "weth-mint",
  },
  {
    symbol: "OMEGAX",
    decimals: 6,
    payoutPriority: 6,
    haircutBps: 7_500,
    maxExposureBps: 2_000,
    role: RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT,
    priceUsd1e8: 10_000_000n,
    depositEnabled: true,
    payoutEnabled: true,
    capacityEnabled: true,
    mintEnv: "OMEGAX_DEVNET_OMEGAX_MINT",
    localMintLabel: "omegax-mint",
  },
] as const;

export type RehearsalMode = "plan" | "execute";

export type RehearsalArgs = {
  mode: RehearsalMode;
  resume: boolean;
  actuarialOnly: boolean;
};

export function parseRehearsalArgs(argv: readonly string[]): RehearsalArgs {
  const flags = new Set(argv);
  if (flags.has("--plan") && flags.has("--execute")) {
    throw new Error("Use exactly one of --plan or --execute.");
  }
  for (const flag of flags) {
    if (
      !["--plan", "--execute", "--resume", "--actuarial-only"].includes(flag)
    ) {
      throw new Error(`Unknown devnet founder rehearsal flag: ${flag}`);
    }
  }
  return {
    mode: flags.has("--execute") ? "execute" : "plan",
    resume: flags.has("--resume"),
    actuarialOnly: flags.has("--actuarial-only"),
  };
}

export function assertMaySend(mode: RehearsalMode): void {
  if (mode !== "execute") {
    throw new Error("Refusing to send devnet transactions without --execute.");
  }
}

export function requireClassicTokenProgramId(
  tokenProgramId: PublicKey | string | null | undefined,
): PublicKey {
  const resolved = tokenProgramId
    ? new PublicKey(tokenProgramId)
    : TOKEN_PROGRAM_ID;
  if (!resolved.equals(TOKEN_PROGRAM_ID)) {
    const detail = resolved.equals(TOKEN_2022_PROGRAM_ID)
      ? "Token-2022"
      : resolved.toBase58();
    throw new Error(
      `Founder rehearsal only accepts classic SPL Token accounts; rejected ${detail}.`,
    );
  }
  return resolved;
}

export function assertProtocolGovernanceAuthorityMatches(params: {
  actualGovernanceAuthority: string;
  localOperator: string;
  configuredGovernanceAuthority?: string | null;
}): "local" | "configured" {
  const actual = new PublicKey(params.actualGovernanceAuthority).toBase58();
  const local = new PublicKey(params.localOperator).toBase58();
  if (actual === local) return "local";
  if (params.configuredGovernanceAuthority) {
    const configured = new PublicKey(
      params.configuredGovernanceAuthority,
    ).toBase58();
    if (actual === configured) return "configured";
  }
  const expected = params.configuredGovernanceAuthority
    ? `${local} or configured governance ${new PublicKey(params.configuredGovernanceAuthority).toBase58()}`
    : local;
  throw new Error(
    `Canonical devnet account mismatch for protocol_governance: governanceAuthority expected ${expected}, got ${actual}.`,
  );
}

export function fundingLineIdForAsset(symbol: FounderAssetSymbol): string {
  return `genesis-travel30-premiums-${symbol.toLowerCase()}`;
}

export function rawAmountForUsd(params: {
  usd: number;
  decimals: number;
  priceUsd1e8: bigint;
}): bigint {
  if (!Number.isFinite(params.usd) || params.usd <= 0) {
    throw new Error("usd must be positive.");
  }
  if (params.priceUsd1e8 <= 0n) {
    throw new Error("priceUsd1e8 must be positive.");
  }
  const scale = 10n ** BigInt(params.decimals);
  const usd1e8 = BigInt(Math.round(params.usd * 100_000_000));
  return (usd1e8 * scale + params.priceUsd1e8 / 2n) / params.priceUsd1e8;
}

export function usd1e8ForRaw(params: {
  amountRaw: BigNumberish;
  decimals: number;
  priceUsd1e8: BigNumberish;
}): bigint {
  const raw = toBigInt(params.amountRaw);
  const price = toBigInt(params.priceUsd1e8);
  if (raw <= 0n || price <= 0n) return 0n;
  return (raw * price) / 10n ** BigInt(params.decimals);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function assertCanonicalAccountMatches(
  label: string,
  actual: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown>,
): void {
  if (!actual) return;
  const mismatches: string[] = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = normalizeComparable(actual[key]);
    const normalizedExpected = normalizeComparable(expectedValue);
    if (actualValue !== normalizedExpected) {
      mismatches.push(
        `${key}: expected ${normalizedExpected}, got ${actualValue}`,
      );
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Canonical devnet account mismatch for ${label}: ${mismatches.join("; ")}`,
    );
  }
}

function normalizeComparable(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof PublicKey) return value.toBase58();
  if (value === null || value === undefined) return "";
  return String(value);
}

const SENSITIVE_KEY_PATTERN =
  /(secret|private|mnemonic|seed_phrase|seedPhrase|keypairPath|privateKeyPath|rawHealth|patient|diagnosis|symptom|evidencePayload|evidenceData)/i;

export function redactEvidence<T>(value: T): T {
  return redact(value) as T;
}

function redact(value: unknown, keyHint = ""): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry, keyHint));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "<redacted>" : redact(nested, key),
      ]),
    );
  }
  if (typeof value === "string") {
    if (SENSITIVE_KEY_PATTERN.test(keyHint)) return "<redacted>";
    if (/\/Users\/[^/\s]+\/\.config\/solana\//.test(value))
      return "<redacted-local-path>";
    if (/\b(raw health data|diagnosis|patient)\b/i.test(value))
      return "<redacted>";
  }
  return value;
}

export type ChainAssetCapacityInput = {
  symbol: FounderAssetSymbol;
  mint: string;
  decimals: number;
  payoutPriority: number;
  haircutBps: number;
  maxExposureBps: number;
  priceUsd1e8: BigNumberish;
  fundedRaw: BigNumberish;
  pendingRaw?: BigNumberish;
  refundedRaw?: BigNumberish;
  reservedRaw?: BigNumberish;
  claimableRaw?: BigNumberish;
  payableRaw?: BigNumberish;
  settledRaw?: BigNumberish;
  active: boolean;
  capacityEnabled: boolean;
  pricePublishedAtTs: number;
  maxStalenessSeconds: number;
};

export type AssetCapacityRow = ChainAssetCapacityInput & {
  counted: boolean;
  exclusionReason?: string;
  grossUsd: number;
  encumberedUsd: number;
  freeUsd: number;
  haircutAdjustedUsd: number;
  cappedCapacityUsd: number;
};

export type GenesisActuarialAssumptions = {
  seed: number;
  trials: number;
  baselineClaimFrequency: number;
  maxPayoutUsd: number;
  severityMinUsd: number;
  severityModeUsd: number;
  severityP95Usd: number;
  severityMaxUsd: number;
};

export type ChainActuarialGateInput = {
  nowTs: number;
  assets: ChainAssetCapacityInput[];
  activatedTravel30Members: number;
  assumptions: GenesisActuarialAssumptions;
};

export type ChainActuarialGate = {
  grossReserveUsd: number;
  haircutAdjustedReserveUsd: number;
  freeReserveUsd: number;
  p95ClaimsUsd: number;
  p99ClaimsUsd: number;
  p995ClaimsUsd: number;
  reserveBreachProbability: number;
  safeConcurrentTravel30Members: number;
  launchGate: "healthy" | "caution" | "pause";
  countedAssets: string[];
  excludedAssets: Array<{ symbol: string; reason: string }>;
  assetRows: AssetCapacityRow[];
  notes: string[];
};

export function evaluateChainActuarialGate(
  input: ChainActuarialGateInput,
): ChainActuarialGate {
  const rows = input.assets
    .slice()
    .sort((left, right) => left.payoutPriority - right.payoutPriority)
    .map((asset) => assetCapacity(asset, input.nowTs));
  const countedBeforeCaps = rows.filter((row) => row.counted);
  const haircutTotal = countedBeforeCaps.reduce(
    (sum, row) => sum + row.haircutAdjustedUsd,
    0,
  );

  for (const row of rows) {
    if (!row.counted) {
      row.cappedCapacityUsd = 0;
      continue;
    }
    const capUsd = haircutTotal * (row.maxExposureBps / 10_000);
    row.cappedCapacityUsd = Math.min(row.haircutAdjustedUsd, capUsd);
  }

  const grossReserveUsd = roundMoney(
    rows.reduce((sum, row) => sum + (row.counted ? row.grossUsd : 0), 0),
  );
  const haircutAdjustedReserveUsd = roundMoney(
    rows.reduce((sum, row) => sum + row.cappedCapacityUsd, 0),
  );
  const freeReserveUsd = haircutAdjustedReserveUsd;
  const members = Math.max(1, input.activatedTravel30Members);
  const claims = simulateTravel30Claims({
    members,
    assumptions: input.assumptions,
  });
  const p95ClaimsUsd = roundMoney(quantile(claims, 0.95));
  const p99ClaimsUsd = roundMoney(quantile(claims, 0.99));
  const p995ClaimsUsd = roundMoney(quantile(claims, 0.995));
  const reserveBreachProbability =
    claims.filter((value) => value > freeReserveUsd).length / claims.length;
  const safeConcurrentTravel30Members = findSafeMembers(
    input.assumptions,
    freeReserveUsd,
  );
  const launchGate =
    p995ClaimsUsd <= freeReserveUsd && reserveBreachProbability <= 0.005
      ? "healthy"
      : p99ClaimsUsd <= freeReserveUsd
        ? "caution"
        : "pause";

  return {
    grossReserveUsd,
    haircutAdjustedReserveUsd,
    freeReserveUsd,
    p95ClaimsUsd,
    p99ClaimsUsd,
    p995ClaimsUsd,
    reserveBreachProbability,
    safeConcurrentTravel30Members,
    launchGate,
    countedAssets: rows.filter((row) => row.counted).map((row) => row.symbol),
    excludedAssets: rows
      .filter((row) => !row.counted)
      .map((row) => ({
        symbol: row.symbol,
        reason: row.exclusionReason ?? "excluded",
      })),
    assetRows: rows,
    notes: [
      "Pending commitments are excluded from claims-paying reserve.",
      "Refunded commitments are excluded from claims-paying reserve.",
      "Capacity uses on-chain reserve rail prices, freshness, haircuts, and exposure caps.",
      "OMEGAX counts only when active, capacity-enabled, fresh-priced, haircut-adjusted, and cap-compliant.",
    ],
  };
}

function assetCapacity(
  asset: ChainAssetCapacityInput,
  nowTs: number,
): AssetCapacityRow {
  const price = toBigInt(asset.priceUsd1e8);
  const fundedRaw = toBigInt(asset.fundedRaw);
  const reservedRaw = toBigInt(asset.reservedRaw);
  const claimableRaw = toBigInt(asset.claimableRaw);
  const payableRaw = toBigInt(asset.payableRaw);
  const settledRaw = toBigInt(asset.settledRaw);
  const stale =
    asset.maxStalenessSeconds > 0 &&
    nowTs - asset.pricePublishedAtTs > asset.maxStalenessSeconds;
  const base = {
    ...asset,
    grossUsd: 0,
    encumberedUsd: 0,
    freeUsd: 0,
    haircutAdjustedUsd: 0,
    cappedCapacityUsd: 0,
  };
  if (!asset.active)
    return { ...base, counted: false, exclusionReason: "rail inactive" };
  if (!asset.capacityEnabled)
    return { ...base, counted: false, exclusionReason: "capacity disabled" };
  if (price <= 0n)
    return { ...base, counted: false, exclusionReason: "missing price" };
  if (stale) return { ...base, counted: false, exclusionReason: "stale price" };

  const encumberedRaw = reservedRaw + claimableRaw + payableRaw + settledRaw;
  const freeRaw = fundedRaw > encumberedRaw ? fundedRaw - encumberedRaw : 0n;
  const grossUsd = usdNumber(
    usd1e8ForRaw({
      amountRaw: fundedRaw,
      decimals: asset.decimals,
      priceUsd1e8: price,
    }),
  );
  const encumberedUsd = usdNumber(
    usd1e8ForRaw({
      amountRaw: encumberedRaw,
      decimals: asset.decimals,
      priceUsd1e8: price,
    }),
  );
  const freeUsd = usdNumber(
    usd1e8ForRaw({
      amountRaw: freeRaw,
      decimals: asset.decimals,
      priceUsd1e8: price,
    }),
  );
  const haircutAdjustedUsd =
    (freeUsd * Math.max(0, 10_000 - asset.haircutBps)) / 10_000;
  return {
    ...base,
    counted: freeUsd > 0,
    exclusionReason: freeUsd > 0 ? undefined : "no free activated reserve",
    grossUsd: roundMoney(grossUsd),
    encumberedUsd: roundMoney(encumberedUsd),
    freeUsd: roundMoney(freeUsd),
    haircutAdjustedUsd: roundMoney(haircutAdjustedUsd),
  };
}

export function chainInputsFromSnapshot(params: {
  assets: Array<FounderAssetRail & { mint: string }>;
  reserveDomain: string;
  ledgers: ReserveScopedSnapshot[];
  rails: ReserveAssetRailSnapshot[];
  commitmentPositions: CommitmentPositionSnapshot[];
  obligations: ObligationSnapshot[];
  nowTs: number;
}): ChainAssetCapacityInput[] {
  return params.assets.map((asset) => {
    const ledger = params.ledgers.find(
      (row) =>
        row.reserveDomain === params.reserveDomain &&
        row.assetMint === asset.mint,
    );
    const rail = params.rails.find(
      (row) =>
        row.reserveDomain === params.reserveDomain &&
        row.assetMint === asset.mint,
    );
    const sheet = ledger?.sheet ?? {};
    const positions = params.commitmentPositions.filter(
      (position) => position.paymentAssetMint === asset.mint,
    );
    const pendingRaw = positions
      .filter((position) => position.state === COMMITMENT_POSITION_PENDING)
      .reduce((sum, position) => sum + toBigInt(position.amount), 0n);
    const refundedRaw = positions
      .filter((position) => position.state === COMMITMENT_POSITION_REFUNDED)
      .reduce((sum, position) => sum + toBigInt(position.amount), 0n);
    const activatedRaw = positions
      .filter(
        (position) =>
          position.state === COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED,
      )
      .reduce((sum, position) => sum + toBigInt(position.amount), 0n);
    const obligations = params.obligations.filter(
      (row) => row.assetMint === asset.mint,
    );
    const reservedRaw = obligations
      .filter((row) => row.status === OBLIGATION_STATUS_RESERVED)
      .reduce(
        (sum, row) => sum + toBigInt(row.reservedAmount ?? row.principalAmount),
        0n,
      );
    const claimableRaw = obligations
      .filter((row) => row.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE)
      .reduce(
        (sum, row) =>
          sum +
          toBigInt(
            row.claimableAmount ?? row.payableAmount ?? row.principalAmount,
          ),
        0n,
      );
    return {
      symbol: asset.symbol,
      mint: asset.mint,
      decimals: asset.decimals,
      payoutPriority: rail?.payoutPriority ?? asset.payoutPriority,
      haircutBps: rail?.haircutBps ?? asset.haircutBps,
      maxExposureBps: rail?.maxExposureBps ?? asset.maxExposureBps,
      priceUsd1e8: rail?.lastPriceUsd1e8 ?? asset.priceUsd1e8,
      fundedRaw: maxBigInt(toBigInt(sheetField(sheet, "funded")), activatedRaw),
      pendingRaw,
      refundedRaw,
      reservedRaw: maxBigInt(
        toBigInt(sheetField(sheet, "reserved")),
        reservedRaw,
      ),
      claimableRaw: maxBigInt(
        toBigInt(sheetField(sheet, "claimable")),
        claimableRaw,
      ),
      payableRaw: toBigInt(sheetField(sheet, "payable")),
      settledRaw: toBigInt(sheetField(sheet, "settled")),
      active: rail?.active ?? asset.capacityEnabled,
      capacityEnabled: rail?.capacityEnabled ?? asset.capacityEnabled,
      pricePublishedAtTs: rail?.lastPricePublishedAtTs ?? params.nowTs,
      maxStalenessSeconds: rail?.maxStalenessSeconds ?? 86_400,
    };
  });
}

function sheetField(
  sheet: PartialReserveBalanceSheet,
  key: keyof PartialReserveBalanceSheet,
): BigNumberish {
  const value = sheet[key];
  return value ?? 0n;
}

function toBigInt(value: BigNumberish | null | undefined): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string" && value.trim()) return BigInt(value);
  if (
    value &&
    typeof value === "object" &&
    value.constructor?.name === "BN" &&
    typeof (value as { toString?: unknown }).toString === "function"
  ) {
    return BigInt((value as { toString(): string }).toString());
  }
  return 0n;
}

function maxBigInt(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function usdNumber(usd1e8: bigint): number {
  return Number(usd1e8) / 100_000_000;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function simulateTravel30Claims(params: {
  members: number;
  assumptions: GenesisActuarialAssumptions;
}): number[] {
  const rng = createRng(params.assumptions.seed + params.members);
  const values: number[] = [];
  for (let trial = 0; trial < params.assumptions.trials; trial += 1) {
    const claims = claimCount(
      params.members,
      params.assumptions.baselineClaimFrequency,
      rng,
    );
    let total = 0;
    for (let index = 0; index < claims; index += 1) {
      total += sampleSeverity(params.assumptions, rng);
    }
    values.push(
      Math.min(total, params.members * params.assumptions.maxPayoutUsd),
    );
  }
  return values;
}

function findSafeMembers(
  assumptions: GenesisActuarialAssumptions,
  reserveUsd: number,
): number {
  if (reserveUsd <= 0) return 0;
  let low = 0;
  let high = 1;
  while (
    high < 50_000 &&
    quantile(simulateTravel30Claims({ members: high, assumptions }), 0.995) <=
      reserveUsd
  ) {
    high *= 2;
  }
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    const p995 = quantile(
      simulateTravel30Claims({ members: mid, assumptions }),
      0.995,
    );
    if (p995 <= reserveUsd) low = mid;
    else high = mid;
  }
  return low;
}

function sampleSeverity(
  assumptions: GenesisActuarialAssumptions,
  rng: () => number,
): number {
  const p = rng();
  const max = assumptions.maxPayoutUsd;
  if (p < 0.75) {
    return triangular(
      assumptions.severityMinUsd,
      assumptions.severityModeUsd,
      assumptions.severityP95Usd,
      rng,
    );
  }
  return Math.min(
    max,
    triangular(
      assumptions.severityModeUsd,
      assumptions.severityP95Usd,
      assumptions.severityMaxUsd,
      rng,
    ),
  );
}

function triangular(
  min: number,
  mode: number,
  max: number,
  rng: () => number,
): number {
  const u = rng();
  const c = (mode - min) / (max - min);
  if (u < c) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function claimCount(n: number, p: number, rng: () => number): number {
  let count = 0;
  for (let index = 0; index < n; index += 1) {
    if (rng() < p) count += 1;
  }
  return count;
}

function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.floor(p * (sorted.length - 1)),
  );
  return sorted[index] ?? 0;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
