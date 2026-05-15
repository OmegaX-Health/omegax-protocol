import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Keypair, PublicKey, SystemProgram, type Connection } from "@solana/web3.js";

import privateClaimReviewModule from "../frontend/lib/private-claim-review.ts";

const {
  derivePrivateClaimReviewSessionPda,
  describePrivateClaimReviewStatus,
  loadPrivateClaimReviewReceipt,
  PRIVATE_CLAIM_REVIEW_PROGRAM_ID,
  SEED_PRIVATE_CLAIM_REVIEW_SESSION,
} = privateClaimReviewModule as typeof import("../frontend/lib/private-claim-review.ts");

const anchorToml = readFileSync("Anchor.toml", "utf8");
const cargoToml = readFileSync("programs/omegax_private_claim_review/Cargo.toml", "utf8");
const programSource = readFileSync("programs/omegax_private_claim_review/src/lib.rs", "utf8");
const privateReviewIdl = JSON.parse(readFileSync("idl/omegax_private_claim_review.json", "utf8"));
const architectureDoc = readFileSync(
  "docs/architecture/magicblock-private-claim-room.md",
  "utf8",
);
const claimRoomPage = readFileSync("frontend/app/magicblock-claim-room/page.tsx", "utf8");
const claimRoomWorkbench = readFileSync(
  "frontend/components/magicblock-claim-room-workbench.tsx",
  "utf8",
);
const claimReviewClient = readFileSync("frontend/lib/private-claim-review.ts", "utf8");

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
  assert.match(programSource, /fn require_canonical_session_id\(/);
  assert.match(programSource, /NonCanonicalSessionId/);
  assert.match(
    programSource,
    /pub fn open_review_session[\s\S]+require_canonical_session_id\(&args\.session_id\)\?/,
  );
  assert.match(
    programSource,
    /pub fn delegate_review_session[\s\S]+require_canonical_session_id\(&args\.session_id\)\?/,
  );
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

test("MagicBlock commit schedules undelegation before base-layer finalization", () => {
  assert.match(programSource, /pub fn finalize_committed_review_session/);
  assert.match(programSource, /pub struct FinalizeCommittedReviewSession/);
  assert.match(programSource, /ReviewSessionCommitFinalized/);
  assert.doesNotMatch(
    programSource,
    /session\.committed_at = Clock::get\(\)\?\.unix_timestamp;\s+emit!\(ReviewSessionCommitted/,
  );
  assert.match(
    architectureDoc,
    /commit_and_close_review_session` schedules the MagicBlock commit and undelegates/,
  );
  assert.match(
    architectureDoc,
    /finalize_committed_review_session` stamps `committed_at`/,
  );

  const commitInstruction = privateReviewIdl.instructions.find(
    (instruction: { name: string }) => instruction.name === "commit_and_close_review_session",
  );
  assert.ok(commitInstruction);
  assert.deepEqual(
    commitInstruction.accounts.map((account: { name: string }) => account.name),
    ["payer", "review_session", "magic_program", "magic_context"],
  );

  const finalizeInstruction = privateReviewIdl.instructions.find(
    (instruction: { name: string }) => instruction.name === "finalize_committed_review_session",
  );
  assert.ok(finalizeInstruction);
  assert.deepEqual(
    finalizeInstruction.accounts.map((account: { name: string }) => account.name),
    ["payer", "review_session"],
  );
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

test("MagicBlock claim room frontend is a read-only receipt verifier", () => {
  assert.match(claimRoomPage, /read-only MagicBlock private-review receipt verifier/);
  assert.match(claimReviewClient, /omegax_private_claim_review\.json/);
  assert.match(claimReviewClient, /BorshCoder/);
  assert.match(claimReviewClient, /PRIVATE_CLAIM_REVIEW_PROGRAM_ID/);
  assert.match(claimReviewClient, /PrivateClaimReviewSession/);
  assert.match(claimReviewClient, /accountInfo\.owner\.toBase58\(\)/);
  assert.match(claimRoomWorkbench, /Review session PDA/);
  assert.match(claimRoomWorkbench, /Seed-derived lookup/);
  assert.match(claimRoomWorkbench, /Session authority/);
  assert.match(claimRoomWorkbench, /Claim case/);
  assert.match(claimRoomWorkbench, /What this proves/);
  assert.match(claimRoomWorkbench, /What it does not prove/);
  assert.doesNotMatch(
    claimRoomWorkbench,
    /storage_path|evidence_url|ocr_text|medical_narrative|encrypted_evidence_payload/i,
  );
});

test("MagicBlock receipt verifier fails closed outside the devnet adjunct", () => {
  assert.match(claimRoomWorkbench, /selectedNetwork === "mainnet-beta"/);
  assert.match(claimRoomWorkbench, /Receipt verification is unavailable on mainnet/);
  assert.match(claimRoomWorkbench, /No mainnet MagicBlock receipt program is configured/);
  assert.match(claimRoomWorkbench, /No mainnet delegation/);
  assert.match(claimRoomWorkbench, /No mainnet ER/);
  assert.match(claimRoomWorkbench, /claim-room-posture-badge/);
  assert.match(claimRoomWorkbench, /Production reimbursement still uses the normal reserve and claim-settlement kernel/);
  assert.doesNotMatch(claimRoomWorkbench, /mainnet.*FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn/is);
});

test("MagicBlock receipt status labels cover every public review state", () => {
  assert.deepEqual(describePrivateClaimReviewStatus(0), { status: "opened", label: "Opened" });
  assert.deepEqual(describePrivateClaimReviewStatus(1), { status: "delegated", label: "Delegated" });
  assert.deepEqual(describePrivateClaimReviewStatus(2), { status: "reviewed", label: "Reviewed" });
  assert.deepEqual(describePrivateClaimReviewStatus(3), { status: "approved", label: "Approved" });
  assert.deepEqual(describePrivateClaimReviewStatus(4), { status: "needs_more_info", label: "Needs more info" });
  assert.deepEqual(describePrivateClaimReviewStatus(5), { status: "escalated", label: "Escalated" });
  assert.deepEqual(describePrivateClaimReviewStatus(6), { status: "failed", label: "Failed" });
  assert.deepEqual(describePrivateClaimReviewStatus(255), { status: "unknown", label: "Unknown (255)" });
});

test("MagicBlock review session PDA derivation uses the public program seeds", () => {
  const sessionAuthority = Keypair.generate().publicKey;
  const claimCase = Keypair.generate().publicKey;
  const sessionId = "claim-protect-001-review";
  const derived = derivePrivateClaimReviewSessionPda({
    sessionAuthority,
    claimCase,
    sessionId,
  });
  const expected = PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEED_PRIVATE_CLAIM_REVIEW_SESSION),
      sessionAuthority.toBuffer(),
      claimCase.toBuffer(),
      Buffer.from(sessionId),
    ],
    PRIVATE_CLAIM_REVIEW_PROGRAM_ID,
  )[0];

  assert.equal(derived.toBase58(), expected.toBase58());
  assert.throws(
    () => derivePrivateClaimReviewSessionPda({ sessionAuthority, claimCase, sessionId: "" }),
    /Session ID is required/,
  );
  assert.throws(
    () => derivePrivateClaimReviewSessionPda({ sessionAuthority, claimCase, sessionId: " claim-protect-001-review " }),
    /leading or trailing whitespace/,
  );
  assert.throws(
    () => derivePrivateClaimReviewSessionPda({ sessionAuthority, claimCase, sessionId: "x".repeat(33) }),
    /32 bytes or fewer/,
  );
});

test("MagicBlock receipt lookup rejects invalid addresses and non-session accounts", async () => {
  const invalidResult = await loadPrivateClaimReviewReceipt({} as Connection, "not a public key");
  assert.equal(invalidResult.kind, "invalid-address");

  const wrongOwnerConnection = {
    getAccountInfo: async () => ({
      data: Buffer.from([65, 251, 196, 172, 246, 214, 222, 202]),
      executable: false,
      lamports: 1,
      owner: SystemProgram.programId,
      rentEpoch: 0,
    }),
  } as unknown as Connection;
  const wrongOwnerResult = await loadPrivateClaimReviewReceipt(
    wrongOwnerConnection,
    Keypair.generate().publicKey,
  );
  assert.equal(wrongOwnerResult.kind, "wrong-owner");

  const wrongTypeConnection = {
    getAccountInfo: async () => ({
      data: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
      executable: false,
      lamports: 1,
      owner: PRIVATE_CLAIM_REVIEW_PROGRAM_ID,
      rentEpoch: 0,
    }),
  } as unknown as Connection;
  const wrongTypeResult = await loadPrivateClaimReviewReceipt(
    wrongTypeConnection,
    Keypair.generate().publicKey,
  );
  assert.equal(wrongTypeResult.kind, "wrong-account-type");
});
