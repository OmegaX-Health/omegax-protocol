import assert from "node:assert/strict";
import test from "node:test";

import schemaMetadataModule from "../frontend/lib/schema-metadata.ts";

const { fetchSchemaMetadata } =
  schemaMetadataModule as typeof import("../frontend/lib/schema-metadata.ts");

test("browser schema metadata fetch uses the same-origin proxy response", async () => {
  const globals = globalThis as typeof globalThis & { window?: unknown };
  const previousWindow = globals.window;
  const previousFetch = globalThis.fetch;
  const calls: string[] = [];

  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({
      metadata: { specVersion: "omegax.schema", outcomes: [] },
      error: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await fetchSchemaMetadata("https://protocol.omegax.health/schemas/standard-health-outcomes-v1.json");

    assert.deepEqual(result, {
      metadata: { specVersion: "omegax.schema", outcomes: [] },
      error: null,
    });
    assert.deepEqual(calls, [
      "/api/schema-metadata?uri=https%3A%2F%2Fprotocol.omegax.health%2Fschemas%2Fstandard-health-outcomes-v1.json",
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow === undefined) {
      delete globals.window;
    } else {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
  }
});
