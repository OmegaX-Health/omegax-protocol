import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PublicKey } from "@solana/web3.js";

const anchorToml = readFileSync("Anchor.toml", "utf8");
const cargoToml = readFileSync("programs/omegax_private_claim_review/Cargo.toml", "utf8");
const programSource = readFileSync("programs/omegax_private_claim_review/src/lib.rs", "utf8");
const architectureDoc = readFileSync(
  "docs/architecture/magicblock-private-claim-room.md",
  "utf8",
);

test("MagicBlock adjunct program is registered as a separate Anchor program", () => {
  assert.match(anchorToml, /programs\/omegax_private_claim_review/);
  assert.match(anchorToml, /omegax_private_claim_review = "[1-9A-HJ-NP-Za-km-z]+"/);
  assert.match(cargoToml, /name = "omegax_private_claim_review"/);
  assert.match(cargoToml, /ephemeral-rollups-sdk/);
});

test("MagicBlock adjunct uses ER delegation and commit macros", () => {
  assert.match(programSource, /#\[ephemeral\]\s*#\[program\]/);
  assert.match(programSource, /#\[delegate\]/);
  assert.match(programSource, /#\[commit\]/);
  assert.match(programSource, /commit_and_undelegate_accounts/);
  assert.match(programSource, /DelegateConfig::default\(\)/);
});

test("PrivateClaimReviewSession stores only public-safe hashes and session state", () => {
  const expectedFields = [
    "evidence_ref_hash",
    "decision_support_hash",
    "schema_key_hash",
    "schema_hash",
    "review_result_hash",
    "review_artifact_hash",
    "review_binary_hash",
    "tee_attestation_digest",
    "private_payment_ref_hash",
    "status",
  ];

  for (const field of expectedFields) {
    assert.match(programSource, new RegExp(`pub ${field}:`));
  }

  assert.doesNotMatch(programSource, /storage_path|evidence_url|ocr_text|medical_narrative|firebase/i);
});

test("MagicBlock adjunct keeps the main settlement kernel out of delegation scope", () => {
  assert.match(architectureDoc, /main `omegax_protocol` program remains/);
  assert.match(architectureDoc, /ClaimCase`, reserves, vaults, funding lines, obligations, and payout accounts are not delegated/);
  assert.doesNotMatch(programSource, /omegax_protocol::/);
});

test("MagicBlock private claim review program id is valid", () => {
  const match = anchorToml.match(/omegax_private_claim_review = "([^"]+)"/);
  assert.ok(match?.[1]);
  assert.doesNotThrow(() => new PublicKey(match[1]));
});
