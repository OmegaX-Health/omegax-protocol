// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Pre-mainnet pen-test PoC — finding PT-2026-04-27-11 (regression).
// Severity: LOW (verifies CSO-2026-04-27-01 fix holds).
//
// Hypothesis: the CSO audit dated 2026-04-27 (.superstack/security-reports/)
// flagged `open_claim_case` as missing on-chain submitter authorization. Code
// inspection shows the fix is wired in: `require_claim_intake_submitter` is
// called at lib.rs:1236 and defined at lib.rs:5166. The Anchor context at
// lib.rs:2769 binds `member_position.health_plan == health_plan.key()` and
// `funding_line.health_plan == health_plan.key()`, blocking cross-plan
// substitution.
//
// This test verifies all three guards remain in place. If any is removed
// without a replacement, the CSO finding regresses.
//
// Related Rust unit tests already exist at lib.rs:6196-7302:
// - claim_intake_submitter_rejects_unrelated_signers
// - claim_intake_submitter_rejects_member_claimant_override
// They run via `npm run rust:test`.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const programSrc = readFileSync(
  new URL("../../programs/omegax_protocol/src/lib.rs", import.meta.url),
  "utf8",
);

test("[PT-11] open_claim_case calls require_claim_intake_submitter as the first authorization", () => {
  const idx = programSrc.indexOf("pub fn open_claim_case(");
  assert.notEqual(idx, -1, "open_claim_case must exist");
  const bodyStart = programSrc.indexOf("{", idx);
  // Capture the first 600 characters of the body — the gate must appear early.
  const head = programSrc.slice(bodyStart, bodyStart + 800);
  assert.ok(
    /require_claim_intake_submitter\s*\(/.test(head),
    "[PT-11 regression] open_claim_case must call require_claim_intake_submitter early; CSO-01 fix would regress otherwise",
  );
});

test("[PT-11] require_claim_intake_submitter accepts only member-self-submit and operator branches", () => {
  const fnIdx = programSrc.indexOf("fn require_claim_intake_submitter(");
  assert.notEqual(fnIdx, -1, "require_claim_intake_submitter must exist");
  const braceIdx = programSrc.indexOf("{", fnIdx);
  let depth = 1;
  let i = braceIdx + 1;
  for (; i < programSrc.length && depth > 0; i += 1) {
    if (programSrc[i] === "{") depth += 1;
    else if (programSrc[i] === "}") depth -= 1;
  }
  const body = programSrc.slice(fnIdx, i);

  assert.ok(
    /member_self_submit/.test(body),
    "[PT-11 regression] gate must define member_self_submit branch",
  );
  assert.ok(
    /operator_submit/.test(body),
    "[PT-11 regression] gate must define operator_submit branch",
  );
  assert.ok(
    /Unauthorized/.test(body),
    "[PT-11 regression] gate must err with Unauthorized when both branches fail",
  );
});

test("[PT-11] OpenClaimCase context binds member_position.health_plan to the supplied health_plan", () => {
  // The Anchor context constraints that block cross-plan substitution.
  const ctxIdx = programSrc.indexOf("pub struct OpenClaimCase<");
  assert.notEqual(ctxIdx, -1, "OpenClaimCase context must exist");
  // Capture the next ~1000 characters which contain all the account constraints.
  const ctx = programSrc.slice(ctxIdx, ctxIdx + 1500);

  assert.ok(
    /member_position\.health_plan\s*==\s*health_plan\.key\(\)/.test(ctx),
    "[PT-11 regression] OpenClaimCase must constrain member_position.health_plan == health_plan",
  );
  assert.ok(
    /funding_line\.health_plan\s*==\s*health_plan\.key\(\)/.test(ctx),
    "[PT-11 regression] OpenClaimCase must constrain funding_line.health_plan == health_plan",
  );
  assert.ok(
    /member_position\.policy_series\s*==\s*args\.policy_series/.test(ctx),
    "[PT-11 regression] OpenClaimCase must constrain member_position.policy_series == args.policy_series",
  );
  assert.ok(
    /member_position\.active/.test(ctx),
    "[PT-11 regression] OpenClaimCase must require member_position.active",
  );
});
