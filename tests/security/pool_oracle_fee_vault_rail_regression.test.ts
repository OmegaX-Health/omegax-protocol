// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regression: pool-oracle fee vaults must not be initialized
// against arbitrary SPL mints. They accrue against the same pool rail that
// backs claim settlement, plus the explicit SOL rail.

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

test("[CSO-2026-04-29] pool oracle fee vault init is pinned to SOL or the pool deposit mint", () => {
  const body = extractInstructionBody("init_pool_oracle_fee_vault");

  assert.match(
    body,
    /args\.asset_mint\s*==\s*NATIVE_SOL_MINT[\s\S]+args\.asset_mint\s*==\s*ctx\.accounts\.liquidity_pool\.deposit_asset_mint/,
    "init_pool_oracle_fee_vault must reject arbitrary SPL fee rails outside the pool deposit mint",
  );
  assert.match(
    body,
    /OmegaXProtocolError::AssetMintMismatch/,
    "oracle fee vault rail mismatch must fail with the asset-mint mismatch error",
  );
});
