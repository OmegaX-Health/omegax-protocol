import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PublicKey } from "@solana/web3.js";

const anchorToml = readFileSync("Anchor.toml", "utf8");
const cargoToml = readFileSync("programs/omegax_private_claim_review/Cargo.toml", "utf8");
const programSource = readFileSync("programs/omegax_private_claim_review/src/lib.rs", "utf8");
const privateReviewIdl = JSON.parse(readFileSync("idl/omegax_private_claim_review.json", "utf8"));
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
    "session_authority",
    "review_operator",
    "reviewer_authority",
    "payment_attestor",
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

test("MagicBlock adjunct uses an authority registry for review sessions", () => {
  assert.match(programSource, /pub struct PrivateReviewRegistry/);
  assert.match(programSource, /pub struct PrivateReviewOperator/);
  assert.match(programSource, /pub fn initialize_review_registry/);
  assert.match(programSource, /pub fn upsert_review_operator/);
  assert.match(programSource, /SEED_REVIEW_REGISTRY/);
  assert.match(programSource, /SEED_REVIEW_OPERATOR/);
  assert.match(programSource, /registry\.session_authority == payer\.key\(\)/);
  assert.match(programSource, /operator\.active @ PrivateClaimReviewError::OperatorInactive/);
});

test("review registry initialization is anchored to the program upgrade authority", () => {
  assert.match(programSource, /pub program: Program<'info, OmegaxPrivateClaimReview>/);
  assert.match(programSource, /pub program_data: Account<'info, ProgramData>/);
  assert.match(
    programSource,
    /program\.programdata_address\(\)\? == Some\(program_data\.key\(\)\)/,
  );
  assert.match(
    programSource,
    /program_data\.upgrade_authority_address == Some\(authority\.key\(\)\)/,
  );
  assert.match(programSource, /UnauthorizedRegistryInitializer/);

  const initializeInstruction = privateReviewIdl.instructions.find(
    (instruction: { name: string }) => instruction.name === "initialize_review_registry",
  );
  assert.ok(initializeInstruction);
  assert.deepEqual(
    initializeInstruction.accounts.map((account: { name: string }) => account.name),
    ["authority", "registry", "program", "program_data", "system_program"],
  );
});

test("review session PDA seeds bind session authority and claim case", () => {
  assert.match(
    programSource,
    /seeds = \[SEED_REVIEW_SESSION, payer\.key\(\)\.as_ref\(\), args\.claim_case\.as_ref\(\), args\.session_id\.as_bytes\(\)\]/,
  );
  assert.match(
    programSource,
    /review_session\.session_authority\.as_ref\(\),\s+review_session\.claim_case\.as_ref\(\),\s+review_session\.session_id\.as_bytes\(\),/s,
  );
});

test("private review, payment, failure, and commit transitions are authority-gated", () => {
  assert.match(programSource, /session\.status == REVIEW_STATUS_DELEGATED/);
  assert.match(programSource, /ReviewBinaryHashMismatch/);
  assert.match(programSource, /UnauthorizedReviewer/);
  assert.match(programSource, /UnauthorizedPaymentAttestor/);
  assert.match(programSource, /session\.status == REVIEW_STATUS_APPROVED/);
  assert.match(programSource, /ApprovedReviewMissingPaymentRef/);
  assert.match(programSource, /TerminalReviewCannotFail/);
  assert.match(programSource, /actor == session\.session_authority \|\| actor == session\.reviewer_authority/);
});

test("delegate writes lifecycle state before ER delegation", () => {
  assert.match(programSource, /session\.status = REVIEW_STATUS_DELEGATED/);
  assert.match(programSource, /session\.delegated_at = now_ts/);
  assert.match(programSource, /PrivateClaimReviewSession::try_deserialize/);
  assert.match(programSource, /session\.try_serialize/);
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
