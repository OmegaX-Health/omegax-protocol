// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regression: fee withdrawals must be pinned to configured
// recipients, not arbitrary accounts supplied by a privileged signer.

import test from "node:test";
import assert from "node:assert/strict";
import { extractRustFunctionBody, programSource } from "./program_source.ts";

const extractInstructionBody = extractRustFunctionBody;

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

test("[CSO-2026-04-29] SPL fee withdrawals debit domain vault accounting", () => {
  assert.match(programSource, /fn book_fee_withdrawal\s*\(/);

  for (const handler of [
    "withdraw_protocol_fee_spl",
    "withdraw_pool_treasury_spl",
    "withdraw_pool_oracle_fee_spl",
  ]) {
    assert.match(
      extractInstructionBody(handler),
      /book_fee_withdrawal\s*\(/,
      `${handler} must debit DomainAssetVault and DomainAssetLedger funded balances after SPL fee outflow`,
    );
  }
});
