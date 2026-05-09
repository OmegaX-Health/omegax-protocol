// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function runWithFakeQEDGen(stdoutLine: string, exitCode: number, command = "check") {
  const tempDir = mkdtempSync(join(tmpdir(), "omegax-qedgen-wrapper-"));
  const fakeQEDGen = join(tempDir, "qedgen");
  writeFileSync(
    fakeQEDGen,
    [
      "#!/bin/sh",
      `printf '%s\\n' '${stdoutLine}'`,
      `exit ${exitCode}`,
      "",
    ].join("\n"),
  );
  chmodSync(fakeQEDGen, 0o755);

  try {
    const result = spawnSync("node", ["scripts/run_qedgen.mjs", command], {
      cwd: repoRoot,
      env: {
        ...process.env,
        QEDGEN: fakeQEDGen,
      },
      encoding: "utf8",
    });
    return result;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("QEDGen wrapper fails handler coverage docs that lack rule/severity", () => {
  const result = runWithFakeQEDGen(
    "{\"handler_coverage\":{\"kind\":\"ProgramInstructionNotInSpec\",\"instruction\":\"accept_protocol_governance_authority\"}}",
    1,
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /ProgramInstructionNotInSpec/);
});

test("QEDGen wrapper fails unknown nonzero checker status docs", () => {
  const result = runWithFakeQEDGen("{\"status\":\"failed_without_rule\"}", 1);

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Unaccepted QEDGen status docs/);
});

test("QEDGen reconcile fails when Lean proof obligations are missing", () => {
  const result = runWithFakeQEDGen(
    "{\"rust_drift\":[],\"lean_orphans\":[],\"lean_missing\":[\"SelectedAssetPayoutGuard\"]}",
    0,
    "reconcile",
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /missing Lean proof obligation/);
});
