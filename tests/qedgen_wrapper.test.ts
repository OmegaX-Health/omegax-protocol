// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function runWithFakeQEDGen(stdoutLine: string, exitCode: number) {
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
    const result = spawnSync("node", ["scripts/run_qedgen.mjs", "check"], {
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

function runPrivateClaimReviewWithFakeQEDGen(stdoutLine: string, exitCode: number) {
  const tempDir = mkdtempSync(join(tmpdir(), "omegax-private-qedgen-wrapper-"));
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
    return spawnSync("node", ["scripts/check_private_claim_review_qedgen.mjs"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        QEDGEN: fakeQEDGen,
      },
      encoding: "utf8",
    });
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

test("private claim-review QEDGen wrapper fails raw auth and no-property warnings", () => {
  const result = runPrivateClaimReviewWithFakeQEDGen(
    '[{"rule":"unbound_auth","severity":"warning","subject":"mark_review_failed"},{"rule":"no_properties","severity":"warning"}]',
    0,
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /unexpected QEDGen findings/);
  assert.match(`${result.stdout}\n${result.stderr}`, /unbound_auth/);
  assert.match(`${result.stdout}\n${result.stderr}`, /no_properties/);
});

test("private claim-review QEDGen wrapper fails summary output with no properties", () => {
  const result = runPrivateClaimReviewWithFakeQEDGen(
    '{"effect_coverage":[],"handler_coverage":[]}\n{"operations":["mark_review_failed"],"properties":[],"cells":[]}',
    0,
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /spec has no properties/);
});
