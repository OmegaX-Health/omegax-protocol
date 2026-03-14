// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";

type ValidationResult = { ok: true; message?: undefined } | { ok: false; message: string };

function isHex32(value: string): boolean {
  const normalized = value.trim().replace(/^0x/, "");
  return /^[0-9a-fA-F]{64}$/.test(normalized);
}

export function validatePublicKey(value: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) {
    return { ok: false, message: "Wallet address is required." };
  }

  try {
    new PublicKey(normalized);
    return { ok: true };
  } catch {
    return { ok: false, message: "Enter a valid Solana public key." };
  }
}

export function validateLamports(value: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) {
    return { ok: false, message: "Lamports amount is required." };
  }

  if (!/^\d+$/.test(normalized)) {
    return { ok: false, message: "Lamports must be a non-negative integer." };
  }

  try {
    const parsed = BigInt(normalized);
    if (parsed < 0n) {
      return { ok: false, message: "Lamports must be greater than or equal to zero." };
    }
  } catch {
    return { ok: false, message: "Lamports value is invalid." };
  }

  return { ok: true };
}

export function validateCycleWindow(openIso: string, closeIso: string): ValidationResult {
  const openMs = Date.parse(openIso.trim());
  const closeMs = Date.parse(closeIso.trim());

  if (!Number.isFinite(openMs) || !Number.isFinite(closeMs)) {
    return { ok: false, message: "Open and close times must be valid date-time values." };
  }

  if (closeMs <= openMs) {
    return { ok: false, message: "Close time must be after open time." };
  }

  return { ok: true };
}

export function validateOptionalHex32(value: string, label: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) return { ok: true };
  if (isHex32(normalized)) return { ok: true };
  return { ok: false, message: `${label} must be 32-byte hex (64 chars).` };
}

export function validateRequiredHex32(value: string, label: string): ValidationResult {
  const normalized = value.trim();
  if (!normalized) return { ok: false, message: `${label} is required.` };
  if (isHex32(normalized)) return { ok: true };
  return { ok: false, message: `${label} must be 32-byte hex (64 chars).` };
}

export type { ValidationResult };
