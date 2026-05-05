import assert from "node:assert/strict";
import test from "node:test";

import rpcErrorsModule from "../frontend/lib/rpc-errors.ts";

const {
  formatRpcError,
  isRpcAccessForbiddenError,
  isRpcRateLimitError,
} = rpcErrorsModule as typeof import("../frontend/lib/rpc-errors.ts");

test("RPC errors format public rate-limit responses without raw JSON", () => {
  const cause = new Error("Server responded with 429. Retrying after 1000ms delay...");

  assert.equal(isRpcRateLimitError(cause), true);
  assert.match(
    formatRpcError(cause, { rpcEndpoint: "https://api.devnet.solana.com" }),
    /RPC endpoint is rate-limiting requests/i,
  );
});

test("RPC errors format forbidden responses as a recovery path", () => {
  const cause = {
    jsonrpc: "2.0",
    error: {
      code: 403,
      message: "Access forbidden",
    },
  };
  const message = formatRpcError(cause, { rpcEndpoint: "https://api.mainnet-beta.solana.com" });

  assert.equal(isRpcAccessForbiddenError(cause), true);
  assert.match(message, /RPC endpoint rejected this request/i);
  assert.match(message, /connection settings/i);
  assert.doesNotMatch(message, /\{"jsonrpc"/i);
});
