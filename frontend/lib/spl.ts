// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

function normalize(value: string): string {
  return value.trim();
}

export async function getMintDecimals(connection: Connection, mintPk: PublicKey): Promise<number> {
  const mint = await getMint(connection, mintPk, "confirmed");
  return mint.decimals;
}

export function getAssociatedTokenAddress(mintPk: PublicKey, ownerPk: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mintPk, ownerPk, false);
}

export function parseUiAmountToBaseUnits(uiAmount: string, decimals: number): bigint {
  const cleaned = normalize(uiAmount);
  if (!cleaned) throw new Error("Amount is required.");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) throw new Error("Amount must be numeric.");
  const [wholePart, fractionalPart = ""] = cleaned.split(".");
  if (fractionalPart.length > decimals) {
    throw new Error(`Amount has too many decimal places for this mint (max ${decimals}).`);
  }
  const whole = BigInt(wholePart || "0");
  const fractional = BigInt((fractionalPart + "0".repeat(decimals)).slice(0, decimals) || "0");
  const base = 10n ** BigInt(decimals);
  return whole * base + fractional;
}

export function formatBaseUnitsToUi(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fractional = amount % base;
  if (decimals === 0) return whole.toString();
  const fractionalRaw = fractional.toString().padStart(decimals, "0");
  const fractionalTrimmed = fractionalRaw.replace(/0+$/, "");
  return fractionalTrimmed.length > 0 ? `${whole}.${fractionalTrimmed}` : whole.toString();
}
