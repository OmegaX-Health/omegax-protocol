// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function walkFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, out);
      continue;
    }
    if (!/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      continue;
    }
    out.push(fullPath);
  }
}

test("every frontend transaction builder is surfaced in app or component code", () => {
  const protocolSource = readFileSync(
    new URL("../frontend/lib/protocol.ts", import.meta.url),
    "utf8",
  );
  const builderNames = Array.from(
    new Set(
      [...protocolSource.matchAll(/export\s+(?:async\s+)?function\s+(build[A-Za-z0-9_]+)\s*\(/g)].map(
        (match) => match[1],
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const sourceFiles: string[] = [];
  walkFiles(new URL("../frontend/app", import.meta.url).pathname, sourceFiles);
  walkFiles(new URL("../frontend/components", import.meta.url).pathname, sourceFiles);

  const sources = sourceFiles.map((filePath) => readFileSync(filePath, "utf8"));
  const missing = builderNames.filter((builderName) => !sources.some((source) => source.includes(builderName)));

  assert.deepEqual(missing, []);
});

test("frontend protocol module exports oracle permission masks used by parity tooling", async () => {
  const protocol = await import("../frontend/lib/protocol.ts");

  assert.equal(protocol.ORACLE_PERMISSION_DATA_ATTEST, 1 << 0);
  assert.equal(protocol.ORACLE_PERMISSION_QUOTE, 1 << 1);
  assert.equal(protocol.ORACLE_PERMISSION_CYCLE_SETTLE, 1 << 2);
  assert.equal(protocol.ORACLE_PERMISSION_CLAIM_SETTLE, 1 << 3);
  assert.equal(protocol.ORACLE_PERMISSION_TREASURY_WITHDRAW, 1 << 4);
  assert.equal(protocol.ORACLE_PERMISSION_FEE_WITHDRAW, 1 << 5);
  assert.equal(protocol.ORACLE_PERMISSION_ALL, 0b11_1111);
});
