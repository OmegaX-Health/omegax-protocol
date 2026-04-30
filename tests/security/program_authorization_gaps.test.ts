// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Defense regression tests for PT-2026-04-27-04 and PT-2026-04-27-07.
//
// Both findings shipped fixes in the on-chain program:
//   PT-04 — `require_claim_intake_submitter` (lib.rs:5166-) now requires
//           `args.claimant == member_position.wallet` in BOTH the member
//           self-submit and operator-submit branches. Recipient routing is
//           handled by the new ClaimCase.delegate_recipient field.
//   PT-07 — `register_oracle` (lib.rs:1989-) now requires
//           `require_keys_eq!(args.oracle, ctx.accounts.admin.key())`, so an
//           attacker cannot pre-register an oracle profile under a key they
//           do not control.
//
// These tests now act as defense regressions: each one PASSES while the
// defense remains in place and FAILS if the constraint is removed or
// regressed. Originally these were "vulnerability present" tests; flipped
// post-fix per the remediation plan.

import test from "node:test";
import assert from "node:assert/strict";
import { extractRustFunctionBody, programSource as programSrc } from "./program_source.ts";

function extractFunctionBody(signaturePrefix: string): string {
  const match = /(?:pub\s+)?fn\s+(\w+)\s*\(/.exec(signaturePrefix);
  assert.ok(match, `signature ${signaturePrefix} should include a function name`);
  return extractRustFunctionBody(match[1]!);
}

test("[PT-04 defense] require_claim_intake_submitter operator branch constrains args.claimant", () => {
  const body = extractFunctionBody("fn require_claim_intake_submitter(");

  // Both branches must compare args.claimant to member_position.wallet so
  // operator-routed claim diversion is impossible by construction.
  assert.ok(
    /args\.claimant\s*==\s*member_position\.wallet/.test(body),
    "[PT-04 regression] gate must compare args.claimant to member_position.wallet",
  );

  assert.ok(
    /plan\.claims_operator/.test(body) && /plan\.plan_admin/.test(body),
    "[PT-04 regression] operator branch must reference claims_operator and plan_admin",
  );

  // Defense: the operator_submit boolean must reference the claimant
  // constraint either inline or via an extracted local. If a future change
  // removes claimant reference from the operator branch, this fails.
  const operatorLineMatch =
    /let\s+operator_submit\s*=\s*([\s\S]+?);/.exec(body);
  assert.ok(
    operatorLineMatch,
    "[PT-04 regression] operator_submit boolean must be defined",
  );
  const operatorExpr = operatorLineMatch[1];
  assert.ok(
    /claimant/.test(operatorExpr),
    `[PT-04 regression] operator_submit must reference claimant constraint. Got: ${operatorExpr.trim()}`,
  );
});

test("[PT-04] open_claim_case persists args.claimant verbatim onto claim_case state", () => {
  // From lib.rs:1251 — `claim_case.claimant = args.claimant;`
  // This is the data path that primes the diversion when settlement transfers
  // are added: a claims_operator submits with attacker `args.claimant`, the
  // ClaimCase records that pubkey, and any future SPL CPI keyed off that
  // field would route funds to the attacker.
  const body = extractFunctionBody("pub fn open_claim_case(");
  assert.ok(
    /claim_case\.claimant\s*=\s*args\.claimant\s*;/.test(body),
    "PT-04 evidence: open_claim_case must assign claim_case.claimant = args.claimant",
  );
});

test("[PT-07 defense] register_oracle requires the signer to equal args.oracle", () => {
  const body = extractFunctionBody("pub fn register_oracle(");

  // Sanity: profile.oracle and profile.admin assignments still in place.
  assert.ok(
    /profile\.oracle\s*=\s*args\.oracle\s*;/.test(body),
    "[PT-07 regression] register_oracle must assign profile.oracle = args.oracle",
  );
  assert.ok(
    /profile\.admin\s*=\s*ctx\.accounts\.admin\.key\(\)\s*;/.test(body),
    "[PT-07 regression] register_oracle must assign profile.admin = signer",
  );

  // Defense: there must be a require_keys_eq!/require! that ties admin to
  // args.oracle. Without this, an attacker could pre-register an oracle
  // profile under any pubkey and control the metadata until the rightful
  // oracle ran claim_oracle.
  const hasSignerEqualityCheck =
    /require_keys_eq!\([\s\S]*?ctx\.accounts\.admin\.key\(\)[\s\S]*?args\.oracle/s.test(body) ||
    /require_keys_eq!\([\s\S]*?args\.oracle[\s\S]*?ctx\.accounts\.admin\.key\(\)/s.test(body) ||
    /require!\([\s\S]*?ctx\.accounts\.admin\.key\(\)\s*==\s*args\.oracle/s.test(body);
  assert.ok(
    hasSignerEqualityCheck,
    "[PT-07 regression] register_oracle must require_keys_eq the signer against args.oracle",
  );
});

test("[PT-07] claim_oracle exists as the recovery path for spoofed profiles", () => {
  // The recovery path that limits PT-07's blast radius: the rightful oracle
  // calls claim_oracle, which sets admin = oracle. Confirm it's intact.
  const body = extractFunctionBody("pub fn claim_oracle(");
  assert.ok(
    /require_keys_eq!\(\s*ctx\.accounts\.oracle\.key\(\)\s*,\s*ctx\.accounts\.oracle_profile\.oracle/.test(
      body,
    ),
    "PT-07 mitigation: claim_oracle must require_keys_eq the signer against profile.oracle",
  );
  assert.ok(
    /profile\.admin\s*=\s*ctx\.accounts\.oracle\.key\(\)\s*;/.test(body),
    "PT-07 mitigation: claim_oracle must reassign profile.admin to the signing oracle",
  );
});
