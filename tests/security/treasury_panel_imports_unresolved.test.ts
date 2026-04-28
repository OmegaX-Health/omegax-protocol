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
// PR4 status (2026-04-29): full PT-03 closure. The on-chain IDL (PR2),
// frontend builder exports (PR3), and panel typecheck enrollment (PR4)
// have all shipped. All three originally-VULN-CONFIRMED checks in this
// file are now defense regressions:
//   - IDL ix presence (PR2-flipped)
//   - Builder exports (PR3-flipped)
//   - tsconfig include of pool-treasury-panel.tsx (this commit)
//
// The broad `components/**/*` exclude that originally hid the dead
// imports has been removed; pool-treasury-panel.tsx is now in the
// explicit include list. Other dead components in the directory are
// quarantined separately (tracked as a follow-up cleanup task) but the
// panel-specific gap that PT-03 originally documented is closed.

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

test("[PT-03 defense regression] frontend/tsconfig.json typechecks pool-treasury-panel.tsx", () => {
  // Phase 1.7 PR4 removed the broad `components/**/*` exclusion that
  // shielded dead imports from build-time detection, AND added
  // `components/pool-treasury-panel.tsx` to the explicit include list.
  // This regression test pins both halves of the closure: if the broad
  // exclude returns or the panel's explicit include is dropped, the
  // dead-import vulnerability re-emerges.
  const tsconfig = JSON.parse(
    readFileSync(new URL("../../frontend/tsconfig.json", import.meta.url), "utf8"),
  ) as {
    include?: string[];
    exclude?: string[];
  };

  assert.ok(
    Array.isArray(tsconfig.exclude),
    "tsconfig.json must have an exclude array",
  );
  assert.ok(
    !tsconfig.exclude!.includes("components/**/*"),
    "[PT-03 defense] tsconfig.json must NOT re-add a broad components/**/* exclusion (would re-shield the panel from typecheck).",
  );

  const include = tsconfig.include ?? [];
  assert.ok(
    include.includes("components/pool-treasury-panel.tsx"),
    "[PT-03 defense] tsconfig.json must explicitly include components/pool-treasury-panel.tsx so its imports are typechecked. If it is removed, the dead-import vulnerability returns.",
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
