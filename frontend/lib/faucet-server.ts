// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export const FAUCET_CHALLENGE_COOKIE = "faucet_challenge";
export const FAUCET_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type FaucetChallengePayload = {
  walletAddress: string;
  nonce: string;
  issuedAtMs: number;
  expiresAtMs: number;
};

function base64UrlEncode(value: Buffer): string {
  return value.toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeCompare(a: string, b: string): boolean {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  if (aBytes.length !== bBytes.length) return false;
  return timingSafeEqual(aBytes, bBytes);
}

export function normalizeWalletAddress(value: string): string | null {
  try {
    return new PublicKey(value.trim()).toBase58();
  } catch {
    return null;
  }
}

export function buildChallengeMessage(payload: FaucetChallengePayload): string {
  return [
    "OmegaX Devnet Faucet Request",
    `Wallet: ${payload.walletAddress}`,
    `Nonce: ${payload.nonce}`,
    `Issued At: ${new Date(payload.issuedAtMs).toISOString()}`,
    `Expires At: ${new Date(payload.expiresAtMs).toISOString()}`,
  ].join("\n");
}

export function createChallengePayload(walletAddress: string, nowMs = Date.now()): FaucetChallengePayload {
  return {
    walletAddress,
    nonce: randomBytes(16).toString("hex"),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + FAUCET_CHALLENGE_TTL_MS,
  };
}

export function encodeSignedChallenge(payload: FaucetChallengePayload, secret: string): string {
  const payloadJson = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(Buffer.from(payloadJson, "utf8"));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function decodeSignedChallenge(token: string, secret: string): FaucetChallengePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = signValue(encodedPayload, secret);
  if (!safeCompare(expectedSig, signature)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as Partial<FaucetChallengePayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.walletAddress !== "string") return null;
    if (typeof parsed.nonce !== "string") return null;
    if (typeof parsed.issuedAtMs !== "number") return null;
    if (typeof parsed.expiresAtMs !== "number") return null;
    return {
      walletAddress: parsed.walletAddress,
      nonce: parsed.nonce,
      issuedAtMs: parsed.issuedAtMs,
      expiresAtMs: parsed.expiresAtMs,
    };
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (!cookieHeader) return parsed;
  const entries = cookieHeader.split(";");
  for (const entry of entries) {
    const [rawName, ...rest] = entry.trim().split("=");
    if (!rawName || rest.length === 0) continue;
    parsed[rawName] = rest.join("=");
  }
  return parsed;
}

export function serializeCookie(params: {
  name: string;
  value: string;
  maxAgeSeconds: number;
  secure: boolean;
}): string {
  const attributes = [
    `${params.name}=${params.value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(params.maxAgeSeconds))}`,
  ];
  if (params.secure) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function verifyWalletSignature(params: {
  walletAddress: string;
  message: string;
  signatureBase58: string;
}): boolean {
  try {
    const signature = bs58.decode(params.signatureBase58.trim());
    const publicKey = new PublicKey(params.walletAddress);
    const messageBytes = new TextEncoder().encode(params.message);
    return nacl.sign.detached.verify(messageBytes, signature, publicKey.toBytes());
  } catch {
    return false;
  }
}

export function getRequiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}
