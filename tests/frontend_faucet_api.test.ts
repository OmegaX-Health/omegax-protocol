// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";

import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

import challengeRoute from "../frontend/app/api/faucet/challenge/route";
import requestRoute from "../frontend/app/api/faucet/request/route";

const getFaucetChallenge = challengeRoute.GET;
const postFaucetRequest = requestRoute.POST;

type EnvSnapshot = Record<string, string | undefined>;

function snapshotEnv(keys: string[]): EnvSnapshot {
  const snapshot: EnvSnapshot = {};
  for (const key of keys) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === "undefined") {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

function extractCookiePair(setCookieHeader: string): string {
  const [pair] = setCookieHeader.split(";");
  return (pair || "").trim();
}

const ENV_KEYS = [
  "NEXT_PUBLIC_FAUCET_ENABLED",
  "FAUCET_CHALLENGE_SECRET",
  "TURNSTILE_SECRET_KEY",
  "FAUCET_INTERNAL_BASE_URL",
  "FAUCET_INTERNAL_BASE_URL_V2",
  "FAUCET_INTERNAL_API_TOKEN",
  "FAUCET_INTERNAL_API_TOKEN_V2",
  "NODE_ENV",
];

test("GET /api/faucet/challenge sets signed cookie and message payload", async () => {
  const snapshot = snapshotEnv(ENV_KEYS);
  try {
    process.env.NEXT_PUBLIC_FAUCET_ENABLED = "true";
    process.env.FAUCET_CHALLENGE_SECRET = "test-challenge-secret";
    process.env.NODE_ENV = "test";

    const wallet = Keypair.generate().publicKey.toBase58();
    const response = await getFaucetChallenge(
      new Request(`http://localhost/api/faucet/challenge?walletAddress=${encodeURIComponent(wallet)}`),
    );

    assert.equal(response.status, 200);
    const body = await response.json() as { walletAddress: string; message: string };
    assert.equal(body.walletAddress, wallet);

    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.match(setCookie, /faucet_challenge=/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(body.message, /^OmegaX Devnet Faucet Request/m);
    assert.match(body.message, new RegExp(`^Wallet:\\s+${wallet}$`, "m"));
    assert.match(body.message, /^Nonce:\s+[a-f0-9]{32}$/m);
    assert.match(body.message, /^Issued At:\s+\d{4}-\d{2}-\d{2}T/m);
    assert.match(body.message, /^Expires At:\s+\d{4}-\d{2}-\d{2}T/m);
  } finally {
    restoreEnv(snapshot);
  }
});

test("POST /api/faucet/request rejects when challenge cookie is missing", async () => {
  const snapshot = snapshotEnv(ENV_KEYS);
  try {
    process.env.NEXT_PUBLIC_FAUCET_ENABLED = "true";
    process.env.FAUCET_CHALLENGE_SECRET = "test-challenge-secret";

    const wallet = Keypair.generate().publicKey.toBase58();
    const response = await postFaucetRequest(new Request("http://localhost/api/faucet/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        walletAddress: wallet,
        signatureBase58: "11111111111111111111111111111111",
        captchaToken: "captcha-token",
      }),
    }));

    assert.equal(response.status, 400);
    const body = await response.json() as { code: string };
    assert.equal(body.code, "challenge_missing");
  } finally {
    restoreEnv(snapshot);
  }
});

test("POST /api/faucet/request rejects bad wallet signatures", async () => {
  const snapshot = snapshotEnv(ENV_KEYS);
  try {
    process.env.NEXT_PUBLIC_FAUCET_ENABLED = "true";
    process.env.FAUCET_CHALLENGE_SECRET = "test-challenge-secret";

    const wallet = Keypair.generate().publicKey.toBase58();
    const challengeResponse = await getFaucetChallenge(
      new Request(`http://localhost/api/faucet/challenge?walletAddress=${encodeURIComponent(wallet)}`),
    );
    const setCookie = challengeResponse.headers.get("set-cookie");
    const cookiePair = extractCookiePair(setCookie || "");

    const response = await postFaucetRequest(new Request("http://localhost/api/faucet/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookiePair,
      },
      body: JSON.stringify({
        walletAddress: wallet,
        signatureBase58: "11111111111111111111111111111111",
        captchaToken: "captcha-token",
      }),
    }));

    assert.equal(response.status, 400);
    const body = await response.json() as { code: string };
    assert.equal(body.code, "invalid_signature");
  } finally {
    restoreEnv(snapshot);
  }
});

test("POST /api/faucet/request rejects invalid captcha", async () => {
  const snapshot = snapshotEnv(ENV_KEYS);
  const originalFetch = global.fetch;
  try {
    process.env.NEXT_PUBLIC_FAUCET_ENABLED = "true";
    process.env.FAUCET_CHALLENGE_SECRET = "test-challenge-secret";
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    process.env.FAUCET_INTERNAL_BASE_URL = "http://oracle.local";
    process.env.FAUCET_INTERNAL_API_TOKEN = "internal-token";

    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();

    const challengeResponse = await getFaucetChallenge(
      new Request(`http://localhost/api/faucet/challenge?walletAddress=${encodeURIComponent(wallet)}`),
    );
    const challengeBody = await challengeResponse.json() as { message: string };
    const setCookie = challengeResponse.headers.get("set-cookie");
    const cookiePair = extractCookiePair(setCookie || "");
    const signature = nacl.sign.detached(new TextEncoder().encode(challengeBody.message), keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);

    let upstreamCalls = 0;
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("challenges.cloudflare.com/turnstile")) {
        return Response.json({ success: false }, { status: 200 });
      }
      upstreamCalls += 1;
      return Response.json({}, { status: 500 });
    }) as typeof fetch;

    const response = await postFaucetRequest(new Request("http://localhost/api/faucet/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookiePair,
      },
      body: JSON.stringify({
        walletAddress: wallet,
        signatureBase58,
        captchaToken: "captcha-token",
      }),
    }));

    assert.equal(response.status, 400);
    const body = await response.json() as { code: string };
    assert.equal(body.code, "captcha_failed");
    assert.equal(upstreamCalls, 0);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

test("POST /api/faucet/request forwards valid signed request to oracle internal faucet", async () => {
  const snapshot = snapshotEnv(ENV_KEYS);
  const originalFetch = global.fetch;
  try {
    process.env.NEXT_PUBLIC_FAUCET_ENABLED = "true";
    process.env.FAUCET_CHALLENGE_SECRET = "test-challenge-secret";
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    process.env.FAUCET_INTERNAL_BASE_URL = "http://oracle.local";
    process.env.FAUCET_INTERNAL_API_TOKEN = "internal-token";

    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();
    const challengeResponse = await getFaucetChallenge(
      new Request(`http://localhost/api/faucet/challenge?walletAddress=${encodeURIComponent(wallet)}`),
    );
    const challengeBody = await challengeResponse.json() as { message: string };
    const setCookie = challengeResponse.headers.get("set-cookie");
    const cookiePair = extractCookiePair(setCookie || "");
    const signature = nacl.sign.detached(new TextEncoder().encode(challengeBody.message), keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);

    const fetchCalls: string[] = [];
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      fetchCalls.push(url);

      if (url.includes("challenges.cloudflare.com/turnstile")) {
        return Response.json({ success: true }, { status: 200 });
      }

      assert.equal(url, "http://oracle.local/v1/internal/faucet/request");
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string> | undefined)?.authorization, "Bearer internal-token");

      return Response.json({
        walletAddress: wallet,
        mint: "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf",
        amountRaw: "5",
        tokenAccount: "88MMBLcwRQZbQunjKJjAJP8ZoTtkHJ62hdAw5DkLaKKz",
        txSignature: "faucet-signature-1",
        txExplorerUrl: "https://explorer.solana.com/tx/faucet-signature-1?cluster=devnet",
        cooldownSeconds: 21600,
      }, { status: 200 });
    }) as typeof fetch;

    const response = await postFaucetRequest(new Request("http://localhost/api/faucet/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookiePair,
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({
        walletAddress: wallet,
        signatureBase58,
        captchaToken: "captcha-token",
      }),
    }));

    assert.equal(response.status, 200);
    const body = await response.json() as { txSignature: string; amountRaw: string };
    assert.equal(body.txSignature, "faucet-signature-1");
    assert.equal(body.amountRaw, "5");
    assert.equal(fetchCalls.length, 2);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});

test("POST /api/faucet/request prefers *_V2 internal faucet env vars when present", async () => {
  const snapshot = snapshotEnv(ENV_KEYS);
  const originalFetch = global.fetch;
  try {
    process.env.NEXT_PUBLIC_FAUCET_ENABLED = "true";
    process.env.FAUCET_CHALLENGE_SECRET = "test-challenge-secret";
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret";
    process.env.FAUCET_INTERNAL_BASE_URL = "http://oracle-old.local";
    process.env.FAUCET_INTERNAL_API_TOKEN = "internal-token-old";
    process.env.FAUCET_INTERNAL_BASE_URL_V2 = "http://oracle-v2.local";
    process.env.FAUCET_INTERNAL_API_TOKEN_V2 = "internal-token-v2";

    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();
    const challengeResponse = await getFaucetChallenge(
      new Request(`http://localhost/api/faucet/challenge?walletAddress=${encodeURIComponent(wallet)}`),
    );
    const challengeBody = await challengeResponse.json() as { message: string };
    const setCookie = challengeResponse.headers.get("set-cookie");
    const cookiePair = extractCookiePair(setCookie || "");
    const signature = nacl.sign.detached(new TextEncoder().encode(challengeBody.message), keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("challenges.cloudflare.com/turnstile")) {
        return Response.json({ success: true }, { status: 200 });
      }

      assert.equal(url, "http://oracle-v2.local/v1/internal/faucet/request");
      assert.equal((init?.headers as Record<string, string> | undefined)?.authorization, "Bearer internal-token-v2");

      return Response.json({
        walletAddress: wallet,
        mint: "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf",
        amountRaw: "5",
        tokenAccount: "88MMBLcwRQZbQunjKJjAJP8ZoTtkHJ62hdAw5DkLaKKz",
        txSignature: "faucet-signature-v2",
        txExplorerUrl: "https://explorer.solana.com/tx/faucet-signature-v2?cluster=devnet",
        cooldownSeconds: 21600,
      }, { status: 200 });
    }) as typeof fetch;

    const response = await postFaucetRequest(new Request("http://localhost/api/faucet/request", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookiePair,
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({
        walletAddress: wallet,
        signatureBase58,
        captchaToken: "captcha-token",
      }),
    }));

    assert.equal(response.status, 200);
    const body = await response.json() as { txSignature: string };
    assert.equal(body.txSignature, "faucet-signature-v2");
  } finally {
    global.fetch = originalFetch;
    restoreEnv(snapshot);
  }
});
