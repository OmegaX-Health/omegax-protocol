// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regression: capital-class fee flows must always carry the
// canonical pool_treasury_vault account. No legacy omission branch is allowed.

import test from "node:test";
import assert from "node:assert/strict";
import { extractRustFunctionBody, programSource } from "./program_source.ts";

const extractInstructionBody = extractRustFunctionBody;

test("[CSO-2026-04-29] deposit entry fees require the pool treasury vault account unconditionally", () => {
  const body = extractInstructionBody("deposit_into_capital_class");

  assert.doesNotMatch(body, /if\s+let\s+Some\(vault\)\s*=\s*ctx\.accounts\.pool_treasury_vault/);
  assert.doesNotMatch(body, /class_fee_bps\s*==\s*0/);
  assert.match(
    programSource,
    /pub pool_treasury_vault: Box<Account<'info, PoolTreasuryVault>>/,
    "pool_treasury_vault must be a required Anchor account, not an optional legacy slot",
  );
  assert.match(
    programSource,
    /seeds = \[SEED_POOL_TREASURY_VAULT, liquidity_pool\.key\(\)\.as_ref\(\), liquidity_pool\.deposit_asset_mint\.as_ref\(\)\]/,
    "pool_treasury_vault must be the canonical pool+asset PDA",
  );
});
