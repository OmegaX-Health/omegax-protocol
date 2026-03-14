// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  buildChallengeMessage,
  decodeSignedChallenge,
  FAUCET_CHALLENGE_COOKIE,
  getRequiredEnv,
  normalizeWalletAddress,
  parseCookieHeader,
  serializeCookie,
  verifyWalletSignature,
} from "../../../../lib/faucet-server";

type FaucetRequestBody = {
  walletAddress?: unknown;
  signatureBase58?: unknown;
  captchaToken?: unknown;
};

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

function captchaSkipEnabled(): boolean {
  const value = String(process.env.FAUCET_SKIP_CAPTCHA || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getFirstPresentEnv(names: string[]): string {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  throw new Error(`missing required env (${names.join(" or ")})`);
}

async function parseJsonBody(request: Request): Promise<FaucetRequestBody | null> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as FaucetRequestBody;
  } catch {
    return null;
  }
}

async function verifyTurnstile(params: { token: string; remoteIp: string | null }): Promise<boolean> {
  const secret = getRequiredEnv("TURNSTILE_SECRET_KEY");
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", params.token);
  if (params.remoteIp) {
    form.set("remoteip", params.remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { success?: unknown };
  return payload?.success === true;
}

function clearChallengeCookie(): string {
  const secureCookie = String(process.env.NODE_ENV || "").trim() === "production";
  return serializeCookie({
    name: FAUCET_CHALLENGE_COOKIE,
    value: "",
    maxAgeSeconds: 0,
    secure: secureCookie,
  });
}

function firstForwardedFor(value: string | null): string | null {
  if (!value) return null;
  const [first] = value.split(",");
  const trimmed = first?.trim();
  return trimmed || null;
}

export async function POST(request: Request): Promise<Response> {
  if (!faucetEnabled()) {
    return jsonResponse(503, {
      error: "faucet unavailable",
      code: "faucet_unavailable",
    });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonResponse(400, {
      error: "invalid request body",
      code: "invalid_request",
    });
  }

  const walletAddress = normalizeWalletAddress(asString(body.walletAddress));
  const signatureBase58 = asString(body.signatureBase58);
  const captchaToken = asString(body.captchaToken);

  if (!walletAddress || !signatureBase58) {
    return jsonResponse(400, {
      error: "walletAddress and signatureBase58 are required",
      code: "invalid_request",
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

  const cookieHeader = request.headers.get("cookie");
  const cookieMap = parseCookieHeader(cookieHeader);
  const challengeToken = cookieMap[FAUCET_CHALLENGE_COOKIE] || "";
  if (!challengeToken) {
    return jsonResponse(400, {
      error: "missing faucet challenge",
      code: "challenge_missing",
    }, clearChallengeCookie());
  }

  const challengePayload = decodeSignedChallenge(challengeToken, challengeSecret);
  if (!challengePayload) {
    return jsonResponse(400, {
      error: "invalid faucet challenge",
      code: "challenge_invalid",
    }, clearChallengeCookie());
  }

  if (Date.now() > challengePayload.expiresAtMs) {
    return jsonResponse(400, {
      error: "faucet challenge expired",
      code: "challenge_expired",
    }, clearChallengeCookie());
  }

  if (challengePayload.walletAddress !== walletAddress) {
    return jsonResponse(400, {
      error: "wallet address does not match challenge",
      code: "challenge_wallet_mismatch",
    }, clearChallengeCookie());
  }

  const message = buildChallengeMessage(challengePayload);
  const signatureValid = verifyWalletSignature({
    walletAddress,
    message,
    signatureBase58,
  });
  if (!signatureValid) {
    return jsonResponse(400, {
      error: "invalid wallet signature",
      code: "invalid_signature",
    }, clearChallengeCookie());
  }

  if (!captchaSkipEnabled()) {
    const turnstileSecretConfigured = String(process.env.TURNSTILE_SECRET_KEY || "").trim().length > 0;
    if (!turnstileSecretConfigured) {
      return jsonResponse(503, {
        error: "captcha verification unavailable",
        code: "captcha_unavailable",
      }, clearChallengeCookie());
    }

    try {
      const remoteIp = firstForwardedFor(request.headers.get("x-forwarded-for"));
      const captchaValid = await verifyTurnstile({
        token: captchaToken,
        remoteIp,
      });
      if (!captchaValid) {
        return jsonResponse(400, {
          error: "captcha verification failed",
          code: "captcha_failed",
        }, clearChallengeCookie());
      }
    } catch {
      return jsonResponse(503, {
        error: "captcha verification unavailable",
        code: "captcha_unavailable",
      }, clearChallengeCookie());
    }
  }

  let internalBaseUrl: string;
  let internalApiToken: string;
  try {
    internalBaseUrl = getFirstPresentEnv([
      "FAUCET_INTERNAL_BASE_URL_V2",
      "FAUCET_INTERNAL_BASE_URL",
    ]).replace(/\/+$/, "");
    internalApiToken = getFirstPresentEnv([
      "FAUCET_INTERNAL_API_TOKEN_V2",
      "FAUCET_INTERNAL_API_TOKEN",
    ]);
  } catch {
    return jsonResponse(503, {
      error: "faucet backend unavailable",
      code: "faucet_unavailable",
    }, clearChallengeCookie());
  }

  try {
    const upstream = await fetch(`${internalBaseUrl}/v1/internal/faucet/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${internalApiToken}`,
      },
      body: JSON.stringify({ walletAddress }),
    });
    const upstreamText = await upstream.text();
    let upstreamJson: unknown = null;
    try {
      upstreamJson = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      upstreamJson = { error: upstreamText || "upstream response was not valid json" };
    }

    return jsonResponse(upstream.status, upstreamJson, clearChallengeCookie());
  } catch {
    return jsonResponse(502, {
      error: "faucet backend request failed",
      code: "faucet_upstream_failed",
    }, clearChallengeCookie());
  }
}
