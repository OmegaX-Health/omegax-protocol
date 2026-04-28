import assert from "node:assert/strict";
import test from "node:test";

import shortLivedPromiseCacheModule from "../frontend/lib/short-lived-promise-cache.ts";

const { createShortLivedPromiseCache } = shortLivedPromiseCacheModule;

// Mock only `Date` so the cache's `Date.now()` is controllable; leave the
// real microtask queue and `setImmediate` alone so deferred loaders flush
// naturally. This keeps the test instant and removes the prior dependency
// on a 50ms wall-clock margin.

function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("short-lived promise cache coalesces inflight loads and reuses fresh values", async (t) => {
  t.mock.timers.enable({ apis: ["Date"] });

  const cache = createShortLivedPromiseCache<string>({ ttlMs: 40 });
  let calls = 0;
  let pendingDeferred = createDeferred<string>();

  const loader = async () => {
    calls += 1;
    pendingDeferred = createDeferred<string>();
    const value = await pendingDeferred.promise;
    return value;
  };

  const first = cache.getOrLoad("queue", loader);
  const second = cache.getOrLoad("queue", loader);

  // Yield once so the loader started by `first` has registered itself in the
  // pending map before `second` looks it up. After this point `second` should
  // see the inflight promise and skip starting a second loader.
  await flushMicrotasks();
  pendingDeferred.resolve("value-1");

  assert.equal(await first, "value-1");
  assert.equal(await second, "value-1");
  assert.equal(calls, 1);

  // Within TTL: cached.
  pendingDeferred.resolve("ignored");
  const cached = await cache.getOrLoad("queue", loader);
  assert.equal(cached, "value-1");
  assert.equal(calls, 1);

  // Advance mocked clock past TTL — next call should refetch.
  t.mock.timers.tick(50);

  const refresh = cache.getOrLoad("queue", loader);
  await flushMicrotasks();
  pendingDeferred.resolve("value-2");
  assert.equal(await refresh, "value-2");
  assert.equal(calls, 2);
});

test("short-lived promise cache backs off briefly after failures", async (t) => {
  t.mock.timers.enable({ apis: ["Date"] });

  const cache = createShortLivedPromiseCache<string>({ errorTtlMs: 40, ttlMs: 40 });
  let calls = 0;

  const loader = async () => {
    calls += 1;
    throw new Error(`boom-${calls}`);
  };

  await assert.rejects(() => cache.getOrLoad("detail", loader), /boom-1/);
  await assert.rejects(() => cache.getOrLoad("detail", loader), /boom-1/);
  assert.equal(calls, 1);

  t.mock.timers.tick(50);

  await assert.rejects(() => cache.getOrLoad("detail", loader), /boom-2/);
  assert.equal(calls, 2);
});
