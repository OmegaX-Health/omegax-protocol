import assert from "node:assert/strict";
import test from "node:test";

import safeExternalUrl from "../frontend/lib/safe-external-url.ts";

const { resolveSafeExternalHref } = safeExternalUrl;

test("safe external href accepts http and https URLs", () => {
  assert.equal(resolveSafeExternalHref("https://protocol.omegax.health/governance/descriptions/schema-state"), "https://protocol.omegax.health/governance/descriptions/schema-state");
  assert.equal(resolveSafeExternalHref("http://example.com/proposal"), "http://example.com/proposal");
});

test("safe external href rejects dangerous or malformed schemes", () => {
  assert.equal(resolveSafeExternalHref("javascript:alert('owned')"), null);
  assert.equal(resolveSafeExternalHref("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(resolveSafeExternalHref("/governance/descriptions/schema-state"), null);
  assert.equal(resolveSafeExternalHref("not-a-url"), null);
});

test("safe external href resolves ipfs URIs through the configured gateway", (t) => {
  const previous = process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE;
  t.after(() => {
    if (previous == null) {
      delete process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE;
      return;
    }
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = previous;
  });

  process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";

  assert.equal(
    resolveSafeExternalHref("ipfs://bafybeiabcdef1234567890/proposals/1"),
    "https://gateway.pinata.cloud/ipfs/bafybeiabcdef1234567890/proposals/1",
  );
});
