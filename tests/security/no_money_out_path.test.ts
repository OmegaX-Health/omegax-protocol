// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Pre-mainnet pen-test PoC — finding PT-2026-04-27-01 / PT-2026-04-27-02.
// Severity: CRITICAL.
//
// Hypothesis: the on-chain program accepts SPL token deposits but has no
// instruction that releases tokens back out. All "settle / process / release"
// instructions update ledger state but call no `transfer_checked` CPI.
//
// Source trace:
// - lib.rs:5408-5459 — `transfer_to_domain_vault`, the ONLY token CPI in the program.
// - lib.rs:1354-1416 — `settle_claim_case` (no CPI; ledger only).
// - lib.rs:1696-1764 — `process_redemption_queue` (no CPI; ledger only).
// - lib.rs:1159 — `release_reserve` (no CPI; ledger only).
// - lib.rs:997 — `settle_obligation` (no CPI; ledger only).
//
// This test PASSES when the vulnerability is present. When the team adds an
// outflow CPI in any of these handlers, this test should fail and be flipped
// into a defense test that asserts the CPI exists with proper authorization.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const programSource = readFileSync(
  new URL("../../programs/omegax_protocol/src/lib.rs", import.meta.url),
  "utf8",
);
const idl = JSON.parse(
  readFileSync(new URL("../../idl/omegax_protocol.json", import.meta.url), "utf8"),
) as { instructions: Array<{ name: string }> };

function extractInstructionBody(name: string): string {
  // Match `pub fn <name>(...` and capture until the matching closing brace at indent level 1.
  const startIdx = programSource.indexOf(`pub fn ${name}(`);
  assert.notEqual(startIdx, -1, `instruction ${name} should exist in program source`);
  // Walk forward, tracking brace depth. Function body starts at first `{`.
  let i = programSource.indexOf("{", startIdx);
  let depth = 1;
  i += 1;
  for (; i < programSource.length && depth > 0; i += 1) {
    if (programSource[i] === "{") depth += 1;
    else if (programSource[i] === "}") depth -= 1;
  }
  return programSource.slice(startIdx, i);
}

test("[PT-01] IDL exposes no withdraw / sweep / fee-collection instruction", () => {
  const drainPatterns = /^(withdraw|sweep|collect_fee|reclaim|payout)/i;
  const matches = idl.instructions
    .map((ix) => ix.name)
    .filter((name) => drainPatterns.test(name));

  // PASSES when there is no withdrawal instruction (vulnerability present).
  // FAILS once the team adds one — at that point, flip to a defense test.
  assert.deepEqual(
    matches,
    [],
    "Expected no on-chain withdrawal instruction; finding PT-01 would be remediated if any exists",
  );
});

test("[PT-02 defense partial] settle_claim_case + process_redemption_queue call transfer_from_domain_vault", () => {
  // Wired in plan section 1.5 (first increment).
  const wired = ["settle_claim_case", "process_redemption_queue"];
  for (const handler of wired) {
    const body = extractInstructionBody(handler);
    assert.ok(
      /transfer_from_domain_vault\s*\(/.test(body),
      `[PT-02 regression] ${handler} must call transfer_from_domain_vault`,
    );
  }
});

test("[PT-02 partial gap] settle_obligation + release_reserve still pending outflow CPI wiring", () => {
  // These have linked-vs-direct branching that needs optional outflow accounts;
  // wiring deferred to a follow-up increment. When wired, this test should be
  // flipped (or merged with the defense test above).
  const pending = ["settle_obligation", "release_reserve"];
  for (const handler of pending) {
    const body = extractInstructionBody(handler);
    assert.ok(
      !/transfer_from_domain_vault\s*\(/.test(body),
      `${handler} now calls transfer_from_domain_vault — flip this test to a defense regression`,
    );
  }
});

test("[PT-02] The only token CPI lives in transfer_to_domain_vault and is inflow-only", () => {
  // Locate the helper.
  assert.ok(
    /fn\s+transfer_to_domain_vault\s*</.test(programSource),
    "transfer_to_domain_vault helper must exist",
  );

  // Locate every callsite of transfer_to_domain_vault. Expect they live only in
  // inflow handlers: fund_sponsor_budget, record_premium_payment, deposit_into_capital_class.
  const callsiteLines = programSource
    .split("\n")
    .map((line, idx) => ({ line, lineno: idx + 1 }))
    .filter(({ line }) => /transfer_to_domain_vault\s*\(/.test(line))
    // Filter out the function definition itself.
    .filter(({ line }) => !/fn\s+transfer_to_domain_vault/.test(line));

  // Group callsites by enclosing handler by walking back to the nearest `pub fn ...`.
  const expectedInflowHandlers = new Set([
    "fund_sponsor_budget",
    "record_premium_payment",
    "deposit_into_capital_class",
  ]);
  const lines = programSource.split("\n");
  const violations: Array<{ lineno: number; handler: string }> = [];
  for (const callsite of callsiteLines) {
    let handler = "<unknown>";
    for (let i = callsite.lineno - 1; i >= 0; i -= 1) {
      const m = /pub fn (\w+)\s*\(/.exec(lines[i] ?? "");
      if (m) {
        handler = m[1];
        break;
      }
    }
    if (!expectedInflowHandlers.has(handler)) {
      violations.push({ lineno: callsite.lineno, handler });
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Token CPI must only appear in inflow handlers; finding PT-02 would change if otherwise. Got: ${JSON.stringify(violations, null, 2)}`,
  );

  // Sanity: all three expected inflow handlers must in fact use the helper.
  const handlersWithCpi = new Set(
    callsiteLines.map(({ lineno }) => {
      for (let i = lineno - 1; i >= 0; i -= 1) {
        const m = /pub fn (\w+)\s*\(/.exec(lines[i] ?? "");
        if (m) return m[1];
      }
      return "<unknown>";
    }),
  );
  for (const h of expectedInflowHandlers) {
    assert.ok(
      handlersWithCpi.has(h),
      `Expected inflow handler ${h} to call transfer_to_domain_vault`,
    );
  }
});
