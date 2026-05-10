import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const protocolWorkbenchShell = readFileSync("frontend/components/protocol-workbench-shell.tsx", "utf8");

test("schemas route uses fullscreen workbench chrome", () => {
  // Regression: ISSUE-001 - /schemas kept the default inner-scroll shell, so the footer consumed viewport space and hid the lower registry rail.
  // Found by /qa on 2026-05-11.
  // Report: .gstack/qa-reports/qa-report-127-0-0-1-3001-2026-05-11.md
  assert.match(protocolWorkbenchShell, /"\/schemas"/);
});
