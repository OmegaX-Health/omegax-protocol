// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Pre-mainnet pen-test PoC — finding PT-2026-04-27-06.
// Severity: MEDIUM.
//
// Hypothesis: the pre-sign review gate must be default-on. This test
// enumerates mounted component callsites and fails if a callsite can reach the
// wallet without either a confirmation prompt or an explicit skipReview hatch.
//
// Source trace:
// - frontend/lib/protocol-action.ts — gate requires confirmReview unless
//   params.skipReview is set.
// - Mounted components that import executeProtocolTransaction are enumerated
//   dynamically below so legacy cleanup does not leave stale fixture lists.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const componentsDir = path.resolve(
  new URL("../../frontend/components/", import.meta.url).pathname,
);

interface Callsite {
  file: string;
  startLine: number;
  endLine: number;
  hasReviewGate: boolean;
}

function scanCallsites(): Callsite[] {
  const results: Callsite[] = [];
  const files = readdirSync(componentsDir).filter((f) => f.endsWith(".tsx"));
  for (const file of files) {
    const src = readFileSync(path.join(componentsDir, file), "utf8");
    if (!src.includes("executeProtocolTransaction")) continue;
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (!/executeProtocolTransaction(?:WithToast)?\s*\(/.test(lines[i] ?? "")) continue;
      // Walk forward, tracking paren depth, to find the matching close paren.
      let depth = 0;
      let started = false;
      let endLine = i;
      let body = "";
      for (let j = i; j < lines.length; j += 1) {
        const line = lines[j] ?? "";
        body += line + "\n";
        for (const ch of line) {
          if (ch === "(") {
            depth += 1;
            started = true;
          } else if (ch === ")") {
            depth -= 1;
          }
        }
        if (started && depth === 0) {
          endLine = j;
          break;
        }
      }
      results.push({
        file,
        startLine: i + 1,
        endLine: endLine + 1,
        hasReviewGate: /\bconfirmReview\b/.test(body) || /\bskipReview\s*:\s*true\b/.test(body),
      });
    }
  }
  return results;
}

test("[PT-06] Pre-sign review coverage map across executeProtocolTransaction callsites", () => {
  const callsites = scanCallsites();
  assert.ok(callsites.length >= 25, `expected ≥25 callsites; got ${callsites.length}`);

  const withReviewGate = callsites.filter((c) => c.hasReviewGate);
  const withoutReviewGate = callsites.filter((c) => !c.hasReviewGate);

  // eslint-disable-next-line no-console
  console.log(
    `[PT-06] coverage: ${withReviewGate.length}/${callsites.length} callsites pass review gate`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[PT-06] without review gate:\n${withoutReviewGate
      .map((c) => `  - ${c.file}:${c.startLine}-${c.endLine}`)
      .join("\n")}`,
  );

  assert.equal(
    withoutReviewGate.length,
    0,
    `All mounted protocol transaction callsites must pass confirmReview or explicit skipReview; missing:\n${withoutReviewGate
      .map((c) => `${c.file}:${c.startLine}-${c.endLine}`)
      .join("\n")}`,
  );
});

test("[PT-06] Frontend gate logic is default-on unless explicit skipReview is provided", () => {
  const actionSrc = readFileSync(
    new URL("../../frontend/lib/protocol-action.ts", import.meta.url),
    "utf8",
  );

  assert.ok(
    /if\s*\(\s*!\s*params\.skipReview\s*\)/.test(actionSrc),
    "[PT-06 evidence] gate must be default-on unless params.skipReview is true",
  );
  assert.ok(
    /if\s*\(\s*!params\.confirmReview\s*\)/.test(actionSrc),
    "[PT-06 evidence] gate rejects missing confirmation callbacks",
  );
  assert.ok(
    /params\.confirmReview\s*\(\s*review\s*\)/.test(actionSrc),
    "[PT-06 evidence] gate awaits confirmReview(review) for approval",
  );
});
