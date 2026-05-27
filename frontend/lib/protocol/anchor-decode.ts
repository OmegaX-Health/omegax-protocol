// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";

import { PROTOCOL_ACCOUNT_DISCRIMINATORS } from "../generated/protocol-contract";
import { ZERO_PUBKEY } from "./constants";

const PROTOCOL_ACCOUNT_NAME_BY_DISCRIMINATOR = new Map<string, string>(
  Object.entries(PROTOCOL_ACCOUNT_DISCRIMINATORS).map(([name, discriminator]) => [
    Array.from(discriminator).join(","),
    name,
  ]),
);

function accountDiscriminatorKey(data: Uint8Array): string | null {
  if (data.length < 8) return null;
  return Array.from(data.subarray(0, 8)).join(",");
}

function snakeCaseKey(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

export function decodedField<T = unknown>(
  decoded: Record<string, unknown>,
  key: string,
  alternateKey?: string,
): T | undefined {
  const snakeKey = alternateKey ?? snakeCaseKey(key);
  return (decoded[key] ?? decoded[snakeKey]) as T | undefined;
}

export function resolveProtocolAccountName(data: Uint8Array): string | null {
  const key = accountDiscriminatorKey(data);
  if (!key) return null;
  return PROTOCOL_ACCOUNT_NAME_BY_DISCRIMINATOR.get(key) ?? null;
}

export function asPublicKey(value: unknown): PublicKey {
  if (value instanceof PublicKey) return value;
  if (typeof value === "string") return new PublicKey(value);
  if (value instanceof Uint8Array || Array.isArray(value)) return new PublicKey(value);
  if (value && typeof value === "object" && "toBase58" in value && typeof value.toBase58 === "function") {
    return new PublicKey(value.toBase58());
  }
  throw new Error("Invalid public key value.");
}

export function asAddress(value: unknown): string {
  return asPublicKey(value).toBase58();
}

export function asOptionalAddress(value: unknown): string | null {
  const address = asAddress(value);
  return address === ZERO_PUBKEY ? null : address;
}

export function bigintFromAnchorValue(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return BigInt(value.toString());
  }
  return 0n;
}

export function numberFromAnchorValue(value: unknown): number {
  return Number(bigintFromAnchorValue(value));
}

export function stringFromAnchorValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return "";
}
