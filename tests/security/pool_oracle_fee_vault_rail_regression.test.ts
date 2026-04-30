// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regression: pool-oracle fee vaults must not be initialized
// against arbitrary SPL mints. They accrue against the same pool rail that
// backs claim settlement, plus the explicit SOL rail.

import test from "node:test";
import assert from "node:assert/strict";
import { extractRustFunctionBody } from "./program_source.ts";

const extractInstructionBody = extractRustFunctionBody;

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
