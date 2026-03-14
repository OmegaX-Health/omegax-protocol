// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  buildChallengeMessage,
  createChallengePayload,
  encodeSignedChallenge,
  getRequiredEnv,
  normalizeWalletAddress,
  serializeCookie,
} from "../../../../lib/faucet-server";

function jsonResponse(status: number, body: unknown, setCookie?: string): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (setCookie) {
    headers.set("set-cookie", setCookie);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function faucetEnabled(): boolean {
  const value = String(process.env.NEXT_PUBLIC_FAUCET_ENABLED || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function GET(request: Request): Promise<Response> {
  if (!faucetEnabled()) {
    return jsonResponse(503, {
      error: "faucet unavailable",
      code: "faucet_unavailable",
    });
  }

  const url = new URL(request.url);
  const walletAddressRaw = url.searchParams.get("walletAddress") || "";
  const walletAddress = normalizeWalletAddress(walletAddressRaw);
  if (!walletAddress) {
    return jsonResponse(400, {
      error: "invalid wallet address",
      code: "invalid_wallet_address",
    });
  }

  let challengeSecret: string;
  try {
    challengeSecret = getRequiredEnv("FAUCET_CHALLENGE_SECRET");
  } catch {
    return jsonResponse(503, {
      error: "faucet challenge unavailable",
      code: "faucet_unavailable",
    });
  }

  const payload = createChallengePayload(walletAddress);
  const message = buildChallengeMessage(payload);
  const token = encodeSignedChallenge(payload, challengeSecret);
  const secureCookie = String(process.env.NODE_ENV || "").trim() === "production";
  const cookie = serializeCookie({
    name: "faucet_challenge",
    value: token,
    maxAgeSeconds: Math.ceil((payload.expiresAtMs - payload.issuedAtMs) / 1000),
    secure: secureCookie,
  });

  return jsonResponse(200, {
    walletAddress,
    message,
    expiresAtMs: payload.expiresAtMs,
    expiresAtIso: new Date(payload.expiresAtMs).toISOString(),
  }, cookie);
}
