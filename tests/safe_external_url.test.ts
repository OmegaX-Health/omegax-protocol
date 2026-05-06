import assert from "node:assert/strict";
import test from "node:test";

import safeExternalUrl from "../frontend/lib/safe-external-url.ts";

const { resolveSafeExternalHref } = safeExternalUrl;
const { resolveSafeDocumentHref } = safeExternalUrl;

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

test("safe document href accepts relative and HTTPS/IPFS document links only", (t) => {
  const previous = process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE;
  t.after(() => {
    if (previous == null) {
      delete process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE;
      return;
    }
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = previous;
  });

  process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";

  assert.equal(resolveSafeDocumentHref("/coverage/technical-terms?view=full#terms"), "/coverage/technical-terms?view=full#terms");
  assert.equal(resolveSafeDocumentHref("https://protocol.omegax.health/coverage/risk-disclosures"), "https://protocol.omegax.health/coverage/risk-disclosures");
  assert.equal(resolveSafeDocumentHref("ipfs://bafybeiabcdef1234567890/terms.json"), "https://gateway.pinata.cloud/ipfs/bafybeiabcdef1234567890/terms.json");
});

test("safe document href rejects unsafe schemes, protocol-relative URLs, and plain HTTP", () => {
  assert.equal(resolveSafeDocumentHref("javascript:alert('owned')"), null);
  assert.equal(resolveSafeDocumentHref("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(resolveSafeDocumentHref("//evil.example/terms"), null);
  assert.equal(resolveSafeDocumentHref("http://example.com/terms"), null);
  assert.equal(resolveSafeDocumentHref("not-a-url"), null);
});
