// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regression: a configured pool entry fee must fail closed
// when the caller omits the matching pool_treasury_vault account.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const programSource = readFileSync(
  new URL("../../programs/omegax_protocol/src/lib.rs", import.meta.url),
  "utf8",
);

function extractInstructionBody(name: string): string {
  const startIdx = programSource.indexOf(`pub fn ${name}(`);
  assert.notEqual(startIdx, -1, `instruction ${name} should exist in program source`);

  let i = programSource.indexOf("{", startIdx);
  assert.notEqual(i, -1, `instruction ${name} should have a body`);

  let depth = 1;
  i += 1;
  for (; i < programSource.length && depth > 0; i += 1) {
    if (programSource[i] === "{") depth += 1;
    else if (programSource[i] === "}") depth -= 1;
  }

  return programSource.slice(startIdx, i);
}

test("[CSO-2026-04-29] deposit entry fees require the pool treasury vault when fee_bps is nonzero", () => {
  const body = extractInstructionBody("deposit_into_capital_class");
  const missingVaultBranch = /let\s+entry_fee\s*=\s*if\s+let\s+Some\(vault\)[\s\S]+?\}\s+else\s+\{([\s\S]+?)\};/.exec(body);

  assert.ok(missingVaultBranch, "deposit_into_capital_class must keep an explicit missing-vault branch");
  assert.match(
    missingVaultBranch[1],
    /class_fee_bps\s*==\s*0/,
    "missing pool_treasury_vault must only be allowed when class_fee_bps is zero",
  );
  assert.match(
    missingVaultBranch[1],
    /FeeVaultRequiredForConfiguredFee/,
    "missing pool_treasury_vault with nonzero entry fee must return the dedicated fee-vault error",
  );
});
