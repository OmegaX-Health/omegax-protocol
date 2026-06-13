import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const protocolWorkbenchShell = readFileSync("frontend/components/protocol-workbench-shell.tsx", "utf8");
const workbenchModel = readFileSync("frontend/lib/workbench.ts", "utf8");

test("primary workbench navigation exposes plans, governance, and docs", () => {
  // The /capital, /oracles, /schemas surfaces were trimmed with the program; nav
  // now exposes only the kept overview/plans/governance sections plus external Docs.
  assert.match(workbenchModel, /href: "\/plans", label: "Plans"/);
  assert.match(workbenchModel, /href: "\/governance", label: "Governance"/);
  assert.doesNotMatch(workbenchModel, /href: "\/(capital|oracles|schemas)"/);
  assert.match(protocolWorkbenchShell, /className="protocol-topbar-tab protocol-topbar-tab-external"/);
  assert.match(protocolWorkbenchShell, />\s*Docs\s*</);
});

test("compact workbench navigation closes on outside click and Escape", () => {
  assert.match(protocolWorkbenchShell, /const mobileNavButtonRef = useRef<HTMLButtonElement \| null>\(null\)/);
  assert.match(protocolWorkbenchShell, /const mobileNavRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(protocolWorkbenchShell, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(protocolWorkbenchShell, /!mobileNavRef\.current\.contains\(target\)/);
  assert.match(protocolWorkbenchShell, /!mobileNavButtonRef\.current\?\.contains\(target\)/);
  assert.match(protocolWorkbenchShell, /event\.key === "Escape"[\s\S]*setIsMobileNavOpen\(false\)/);
});
