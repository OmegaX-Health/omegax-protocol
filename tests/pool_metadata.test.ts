// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import poolMetadataModule from "../frontend/lib/pool-metadata.ts";

const poolMetadata = poolMetadataModule as typeof import("../frontend/lib/pool-metadata.ts");

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("parsePoolDefiMetadata applies defaults and normalizes methodology URIs", () => {
  const parsed = poolMetadata.parsePoolDefiMetadata({
    schema: "omegax.pool",
    version: 1,
    defi: {
      apyBps: 875,
      apyMethodologyUri: "  ipfs://QmPoolMetadata/methodology.json  ",
    },
  });

  assert.equal(parsed.error, null);
  assert.deepEqual(parsed.defi, {
    apyBps: 875,
    windowDays: 30,
    asOfTs: null,
    methodologyUri: "ipfs://QmPoolMetadata/methodology.json",
  });
});

test("parsePoolDefiMetadata rejects invalid methodology URIs with a stable code", () => {
  const parsed = poolMetadata.parsePoolDefiMetadata({
    schema: "omegax.pool",
    version: 1,
    defi: {
      apyBps: 875,
      apyMethodologyUri: "ftp://example.com/methodology",
    },
  });

  assert.equal(parsed.defi, null);
  assert.equal(parsed.error?.code, "invalid_apy_methodology_uri");
});

test("fetchPoolMetadata reuses inflight requests, caches results, and clears cleanly", async () => {
  poolMetadata.clearPoolMetadataCache();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  let resolveFirstFetch: ((response: Response) => void) | null = null;

  globalThis.fetch = ((input) => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return new Promise<Response>((resolve) => {
        resolveFirstFetch = resolve;
      });
    }

    return Promise.resolve(
      jsonResponse({
        schema: "omegax.pool",
        version: 1,
        defi: { apyBps: 910 },
      }),
    );
  }) as typeof fetch;

  try {
    const first = poolMetadata.fetchPoolMetadata("https://example.com/pool.json");
    const second = poolMetadata.fetchPoolMetadata("https://example.com/pool.json");

    assert.equal(fetchCalls, 1);
    assert.ok(resolveFirstFetch);
    resolveFirstFetch!(
      jsonResponse({
        schema: "omegax.pool",
        version: 1,
        defi: { apyBps: 875 },
      }),
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.equal(firstResult.error, null);
    assert.deepEqual(secondResult, firstResult);

    const cached = await poolMetadata.fetchPoolMetadata("https://example.com/pool.json");
    assert.equal(fetchCalls, 1);
    assert.deepEqual(cached, firstResult);

    poolMetadata.clearPoolMetadataCache();

    const afterClear = await poolMetadata.fetchPoolMetadata("https://example.com/pool.json");
    assert.equal(fetchCalls, 2);
    assert.equal(afterClear.error, null);
    assert.equal((afterClear.metadata as { defi?: { apyBps?: number } })?.defi?.apyBps, 910);
  } finally {
    globalThis.fetch = originalFetch;
    poolMetadata.clearPoolMetadataCache();
  }
});

test("fetchPoolMetadata retries configured IPFS gateways in order", async () => {
  poolMetadata.clearPoolMetadataCache();
  const originalGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE;
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE =
    "https://gateway-one.example/ipfs, https://gateway-two.example/ipfs";
  globalThis.fetch = (async (input) => {
    const url = String(input);
    seenUrls.push(url);
    if (url.startsWith("https://gateway-one.example/ipfs/")) {
      return new Response("retry", {
        status: 503,
        headers: { "content-type": "text/plain" },
      });
    }

    return jsonResponse({
      schema: "omegax.pool",
      version: 1,
      defi: { apyBps: 1025 },
    });
  }) as typeof fetch;

  try {
    const fetched = await poolMetadata.fetchPoolMetadata("ipfs://QmPoolMetadata/pool.json");
    assert.equal(fetched.error, null);
    assert.deepEqual(seenUrls.slice(0, 2), [
      "https://gateway-one.example/ipfs/QmPoolMetadata/pool.json",
      "https://gateway-two.example/ipfs/QmPoolMetadata/pool.json",
    ]);
  } finally {
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = originalGateway;
    globalThis.fetch = originalFetch;
    poolMetadata.clearPoolMetadataCache();
  }
});
