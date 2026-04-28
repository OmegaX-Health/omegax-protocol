// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Pre-mainnet pen-test PoC — finding PT-2026-04-27-03 (partially remediated).
// Severity: HIGH (build integrity).
//
// Original hypothesis: `frontend/components/pool-treasury-panel.tsx:14-19`
// imports six `buildWithdraw*Tx` builders from `@/lib/protocol`, but none of
// those names is exported by `frontend/lib/protocol.ts`. The IDL also had no
// withdraw instruction (see no_money_out_path.test.ts), so even if the builders
// existed they would have no on-chain instruction to call.
//
// PR3 status (2026-04-29): both the on-chain IDL and the frontend builders
// have shipped. The 6 `buildWithdraw*Tx` exports in `frontend/lib/protocol.ts`
// resolve every panel import. The remaining VULN piece is the tsconfig
// exclusion of `components/**/*` from typecheck (PT-13) — that closes in
// PR4 alongside the panel re-mount.
//
// Two of this file's three "vulnerability-confirming" tests have been
// flipped to defense regressions (IDL ix presence in PR2; builder exports
// in PR3). The remaining VULN_CONFIRMED test (test 4 below) flips when
// PR4 removes `components/**/*` from tsconfig.exclude.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panelSrc = readFileSync(
  new URL("../../frontend/components/pool-treasury-panel.tsx", import.meta.url),
  "utf8",
);
const protocolSrc = readFileSync(
  new URL("../../frontend/lib/protocol.ts", import.meta.url),
  "utf8",
);

const expectedDeadImports = [
  "buildWithdrawPoolOracleFeeSolTx",
  "buildWithdrawPoolOracleFeeSplTx",
  "buildWithdrawPoolTreasurySolTx",
  "buildWithdrawPoolTreasurySplTx",
  "buildWithdrawProtocolFeeSolTx",
  "buildWithdrawProtocolFeeSplTx",
];

test("[PT-03] pool-treasury-panel imports the documented dead builder names", () => {
  for (const name of expectedDeadImports) {
    assert.ok(
      panelSrc.includes(name),
      `pool-treasury-panel.tsx must reference ${name} for this finding to apply`,
    );
  }
});

test("[PT-03 defense regression] All six builder names are exported by frontend/lib/protocol.ts", () => {
  // Phase 1.7 PR3 shipped the six builders; the panel imports now resolve.
  // This assertion was flipped from VULN_CONFIRMED to a defense regression:
  // if any builder export is removed or renamed, the panel reverts to the
  // dead-import state and PT-03 partially regresses.
  const unresolved: string[] = [];
  for (const name of expectedDeadImports) {
    const exportPatterns = [
      new RegExp(String.raw`^export\s+(?:async\s+)?function\s+${name}\b`, "m"),
      new RegExp(String.raw`^export\s+const\s+${name}\b`, "m"),
      new RegExp(String.raw`^export\s*\{[^}]*\b${name}\b[^}]*\}`, "m"),
    ];
    const isExported = exportPatterns.some((rx) => rx.test(protocolSrc));
    if (!isExported) unresolved.push(name);
  }

  assert.deepEqual(
    unresolved,
    [],
    `[PT-03 defense] All six panel-imported builders must remain exported. Currently missing: ${JSON.stringify(unresolved, null, 2)}`,
  );
});

test("[PT-03 defense regression] IDL exposes the 6 withdraw instructions PR2 shipped", () => {
  // Phase 1.7 (PR2) landed the on-chain withdraw instructions, closing
  // half of PT-03. This test flipped from VULN_CONFIRMED to a defense
  // regression: if any of the six are removed, the dead-builder problem
  // would re-emerge as soon as the frontend builders ship in PR3.
  const idl = JSON.parse(
    readFileSync(new URL("../../idl/omegax_protocol.json", import.meta.url), "utf8"),
  ) as { instructions: Array<{ name: string }> };
  const names = idl.instructions.map((i) => i.name.toLowerCase());

  const expectedInstructions = [
    "withdraw_protocol_fee_sol",
    "withdraw_protocol_fee_spl",
    "withdraw_pool_treasury_sol",
    "withdraw_pool_treasury_spl",
    "withdraw_pool_oracle_fee_sol",
    "withdraw_pool_oracle_fee_spl",
  ];
  for (const expected of expectedInstructions) {
    assert.ok(
      names.includes(expected),
      `[PT-03 defense] IDL must expose ${expected}; if removed the dead-builder vulnerability re-emerges once PR3 lands.`,
    );
  }
});

test("[PT-03] frontend/tsconfig.json excludes components/ from typecheck — explains why dead imports ship unflagged", () => {
  const tsconfig = JSON.parse(
    readFileSync(new URL("../../frontend/tsconfig.json", import.meta.url), "utf8"),
  ) as {
    include?: string[];
    exclude?: string[];
  };

  assert.ok(
    Array.isArray(tsconfig.exclude),
    "tsconfig.json must have an exclude array for this finding to apply",
  );
  assert.ok(
    tsconfig.exclude!.includes("components/**/*"),
    "[PT-03 root cause] tsconfig.json excludes components/**/* from typecheck — why the dead imports in pool-treasury-panel.tsx are not caught at build time",
  );

  // Sanity: confirm components/ is also not pulled back in via include.
  const include = tsconfig.include ?? [];
  const componentsInclude = include.filter((pattern) =>
    /components/.test(pattern),
  );
  assert.deepEqual(
    componentsInclude,
    [],
    "[PT-03 root cause] tsconfig include must not silently re-enable components/",
  );

  // Higher-order finding: lib/ coverage is tiny — only 4 specific files.
  // Document this in the assertion so audit readers see the structural gap.
  const libIncluded = include.filter((pattern) => /^lib\//.test(pattern));
  assert.ok(
    libIncluded.length > 0,
    "lib must have at least one explicit include for this audit observation",
  );
  // Capture the audit data: which lib files ARE typechecked.
  // eslint-disable-next-line no-console
  console.log(`[PT-03] tsconfig include for lib/: ${JSON.stringify(libIncluded)}`);
  // eslint-disable-next-line no-console
  console.log(`[PT-03] tsconfig exclude: ${JSON.stringify(tsconfig.exclude)}`);
});
