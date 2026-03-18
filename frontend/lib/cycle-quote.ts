// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey, TransactionInstruction } from "@solana/web3.js";

import { ZERO_PUBKEY } from "@/lib/protocol";

export type SerializedInstructionAccount = {
  pubkey: string;
  isSigner?: boolean;
  isWritable?: boolean;
};

export type SerializedVerificationInstruction = {
  programId: string;
  dataBase64?: string;
  dataHex?: string;
  keys?: SerializedInstructionAccount[];
};

export type NormalizedCycleQuote = {
  member: string | null;
  oracle: string;
  paymentMint: string;
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
  cohortHashHex: string | null;
  expiresAtTs: bigint;
  quoteMetaHashHex: string;
  quoteVerificationInstruction?: TransactionInstruction;
  raw: unknown;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Quote payload must be a JSON object.");
  }
  return value as JsonObject;
}

function normalizeHex32(value: unknown, field: string, required = true): string {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/^0x/, "");
  if (!normalized) {
    if (required) {
      throw new Error(`${field} is required.`);
    }
    return "";
  }
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(`${field} must be a 32-byte hex string.`);
  }
  return normalized;
}

function normalizePubkey(value: unknown, field: string, required = true): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) {
      throw new Error(`${field} is required.`);
    }
    return "";
  }
  try {
    return new PublicKey(normalized).toBase58();
  } catch {
    throw new Error(`${field} must be a valid Solana public key.`);
  }
}

function normalizeBigInt(value: unknown, field: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  try {
    return BigInt(normalized);
  } catch {
    throw new Error(`${field} must be an integer string.`);
  }
}

function normalizeNumber(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = String(value ?? "").trim();
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a number.`);
  }
  return parsed;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function resolveVerificationInstruction(value: unknown): TransactionInstruction | undefined {
  if (!value) return undefined;
  const record = asObject(value);
  const programId = normalizePubkey(record.programId, "verificationInstruction.programId");
  const keys = Array.isArray(record.keys)
    ? record.keys.map((key, index) => {
      const account = asObject(key);
      return {
        pubkey: new PublicKey(normalizePubkey(account.pubkey, `verificationInstruction.keys[${index}].pubkey`)),
        isSigner: Boolean(account.isSigner),
        isWritable: Boolean(account.isWritable),
      };
    })
    : [];
  let data = Buffer.alloc(0);
  if (typeof record.dataBase64 === "string" && record.dataBase64.trim()) {
    data = Buffer.from(record.dataBase64.trim(), "base64");
  } else if (typeof record.dataHex === "string" && record.dataHex.trim()) {
    data = Buffer.from(record.dataHex.trim().replace(/^0x/, ""), "hex");
  }
  return new TransactionInstruction({
    programId: new PublicKey(programId),
    keys,
    data,
  });
}

function unwrapCandidate(value: unknown): JsonObject {
  const record = asObject(value);
  const nested = record.quote ?? record.activation ?? record.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as JsonObject;
  }
  return record;
}

export function normalizeCycleQuotePayload(value: unknown): NormalizedCycleQuote {
  const record = unwrapCandidate(value);
  const verificationInstruction =
    record.quoteVerificationInstruction ?? record.verificationInstruction ?? null;
  return {
    member: record.member ? normalizePubkey(record.member, "member") : null,
    oracle: normalizePubkey(record.oracle, "oracle"),
    paymentMint: record.paymentMint
      ? normalizePubkey(record.paymentMint, "paymentMint")
      : ZERO_PUBKEY,
    seriesRefHashHex: normalizeHex32(record.seriesRefHashHex ?? record.seriesRefHash, "seriesRefHashHex"),
    periodIndex: normalizeBigInt(record.periodIndex, "periodIndex"),
    nonceHashHex: normalizeHex32(record.nonceHashHex ?? record.nonceHash, "nonceHashHex"),
    premiumAmountRaw: normalizeBigInt(record.premiumAmountRaw, "premiumAmountRaw"),
    canonicalPremiumAmount: normalizeBigInt(record.canonicalPremiumAmount, "canonicalPremiumAmount"),
    commitmentEnabled: normalizeBoolean(record.commitmentEnabled),
    bondAmountRaw: normalizeBigInt(record.bondAmountRaw, "bondAmountRaw"),
    shieldFeeRaw: normalizeBigInt(record.shieldFeeRaw, "shieldFeeRaw"),
    protocolFeeRaw: normalizeBigInt(record.protocolFeeRaw, "protocolFeeRaw"),
    oracleFeeRaw: normalizeBigInt(record.oracleFeeRaw, "oracleFeeRaw"),
    netPoolPremiumRaw: normalizeBigInt(record.netPoolPremiumRaw, "netPoolPremiumRaw"),
    totalAmountRaw: normalizeBigInt(record.totalAmountRaw, "totalAmountRaw"),
    includedShieldCount: normalizeNumber(record.includedShieldCount, "includedShieldCount"),
    thresholdBps: normalizeNumber(record.thresholdBps, "thresholdBps"),
    outcomeThresholdScore: normalizeNumber(record.outcomeThresholdScore, "outcomeThresholdScore"),
    cohortHashHex: record.cohortHashHex || record.cohortHash
      ? normalizeHex32(record.cohortHashHex ?? record.cohortHash, "cohortHashHex")
      : null,
    expiresAtTs: normalizeBigInt(record.expiresAtTs, "expiresAtTs"),
    quoteMetaHashHex: normalizeHex32(record.quoteMetaHashHex ?? record.quoteMetaHash, "quoteMetaHashHex"),
    quoteVerificationInstruction: resolveVerificationInstruction(verificationInstruction),
    raw: value,
  };
}

export function parseCycleQuotePayload(text: string): NormalizedCycleQuote {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error("Paste a signed quote payload to continue.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("Quote payload must be valid JSON.");
  }
  return normalizeCycleQuotePayload(parsed);
}

export function quoteUsesSolRail(quote: Pick<NormalizedCycleQuote, "paymentMint">): boolean {
  return quote.paymentMint === ZERO_PUBKEY;
}
