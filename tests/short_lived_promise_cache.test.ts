import assert from "node:assert/strict";
import test from "node:test";

import shortLivedPromiseCacheModule from "../frontend/lib/short-lived-promise-cache.ts";

const { createShortLivedPromiseCache } = shortLivedPromiseCacheModule;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("short-lived promise cache coalesces inflight loads and reuses fresh values", async () => {
  const cache = createShortLivedPromiseCache<string>({ ttlMs: 40 });
  let calls = 0;

  const loader = async () => {
    calls += 1;
    await sleep(10);
    return `value-${calls}`;
  };

  const [first, second] = await Promise.all([
    cache.getOrLoad("queue", loader),
    cache.getOrLoad("queue", loader),
  ]);

  assert.equal(first, "value-1");
  assert.equal(second, "value-1");
  assert.equal(calls, 1);

  const cached = await cache.getOrLoad("queue", loader);
  assert.equal(cached, "value-1");
  assert.equal(calls, 1);

  await sleep(50);

  const refreshed = await cache.getOrLoad("queue", loader);
  assert.equal(refreshed, "value-2");
  assert.equal(calls, 2);
});

test("short-lived promise cache backs off briefly after failures", async () => {
  const cache = createShortLivedPromiseCache<string>({ errorTtlMs: 40, ttlMs: 40 });
  let calls = 0;

  const loader = async () => {
    calls += 1;
    throw new Error(`boom-${calls}`);
  };

  await assert.rejects(() => cache.getOrLoad("detail", loader), /boom-1/);
  await assert.rejects(() => cache.getOrLoad("detail", loader), /boom-1/);
  assert.equal(calls, 1);

  await sleep(50);

  await assert.rejects(() => cache.getOrLoad("detail", loader), /boom-2/);
  assert.equal(calls, 2);
});
