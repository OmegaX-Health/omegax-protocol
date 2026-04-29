// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regression: fee withdrawals must be pinned to configured
// recipients, not arbitrary accounts supplied by a privileged signer.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const programSource = readFileSync(
  new URL("../../programs/omegax_protocol/src/lib.rs", import.meta.url),
  "utf8",
);

function extractInstructionBody(name: string): string {
  const startIdx = programSource.indexOf(`pub fn ${name}(`);
  assert.notEqual(startIdx, -1, `instruction ${name} should exist`);

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

test("[CSO-2026-04-29] fee vault accounts store configured fee recipients", () => {
  for (const accountName of ["ProtocolFeeVault", "PoolTreasuryVault", "PoolOracleFeeVault"]) {
    const accountIdx = programSource.indexOf(`pub struct ${accountName}`);
    assert.notEqual(accountIdx, -1, `${accountName} should exist`);
    const accountBody = programSource.slice(accountIdx, programSource.indexOf("\n}\n", accountIdx));
    assert.match(accountBody, /pub fee_recipient: Pubkey/);
  }
});

test("[CSO-2026-04-29] SPL and SOL fee withdrawals validate configured recipients", () => {
  for (const handler of [
    "withdraw_protocol_fee_spl",
    "withdraw_pool_treasury_spl",
    "withdraw_pool_oracle_fee_spl",
  ]) {
    assert.match(
      extractInstructionBody(handler),
      /require_fee_recipient_token_owner\s*\(/,
      `${handler} must validate recipient token account owner`,
    );
  }

  for (const handler of [
    "withdraw_protocol_fee_sol",
    "withdraw_pool_treasury_sol",
    "withdraw_pool_oracle_fee_sol",
  ]) {
    assert.match(
      extractInstructionBody(handler),
      /require_fee_recipient_owner\s*\(/,
      `${handler} must validate SOL recipient address`,
    );
  }
});
