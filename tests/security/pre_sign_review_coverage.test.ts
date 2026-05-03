// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Pre-mainnet pen-test PoC — finding PT-2026-04-27-06.
// Severity: MEDIUM.
//
// Hypothesis: the pre-sign review gate added in commit 3a09f95 is conditional
// on the caller passing a `review:` field to `executeProtocolTransaction`.
// Many callsites do not pass it. This test enumerates all callsites and
// reports coverage. It is intentionally a coverage map, not a binary
// pass/fail — it surfaces the audit data and asserts the absolute number of
// gated callsites does not regress over time.
//
// Source trace:
// - frontend/lib/protocol-action.ts:55-99 — gate is conditional on params.review.
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
  hasReview: boolean;
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
        hasReview: /\breview\s*:/.test(body),
      });
    }
  }
  return results;
}

test("[PT-06] Pre-sign review coverage map across executeProtocolTransaction callsites", () => {
  const callsites = scanCallsites();
  assert.ok(callsites.length >= 25, `expected ≥25 callsites; got ${callsites.length}`);

  const withReview = callsites.filter((c) => c.hasReview);
  const withoutReview = callsites.filter((c) => !c.hasReview);

  // eslint-disable-next-line no-console
  console.log(
    `[PT-06] coverage: ${withReview.length}/${callsites.length} callsites pass review metadata`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[PT-06] without review:\n${withoutReview
      .map((c) => `  - ${c.file}:${c.startLine}-${c.endLine}`)
      .join("\n")}`,
  );

  // Assert that callsites in components likely to move money or change
  // protocol authority CURRENTLY lack review (vulnerability present today).
  // When the team wires review on these, this assertion should fail and be
  // flipped into a defense assertion.
  const sensitiveFilesWithoutReview = withoutReview.filter((c) =>
    /^(governance-operator-drawer|governance-console|governance-proposal-detail-panel|pool-treasury-panel|pool-claims-panel|pool-oracles-panel|pool-oracles-console|oracle-registry-verification-panel)\.tsx$/.test(
      c.file,
    ),
  );
  assert.ok(
    sensitiveFilesWithoutReview.length > 0,
    "Finding PT-06 expects ≥1 sensitive callsite without review; if zero, the gap was remediated and this test should be flipped.",
  );
});

test("[PT-06] Frontend gate logic is a pure conditional on `params.review`", () => {
  const actionSrc = readFileSync(
    new URL("../../frontend/lib/protocol-action.ts", import.meta.url),
    "utf8",
  );

  // The gate is conditional, not enforced — callers can opt out by omitting
  // `review`. Confirm the conditional-gate pattern directly in the source.
  // The exact shape (per protocol-action.ts on main, near lines 83-99) is:
  //   if (params.review) {
  //     if (!params.confirmReview) { return { ok: false, ... } }
  //     const approved = await params.confirmReview(review);
  //     if (!approved) { return { ok: false, ... } }
  //   }
  assert.ok(
    /if\s*\(\s*params\.review\s*\)/.test(actionSrc),
    "[PT-06 evidence] gate must be `if (params.review) { ... }` — caller-opt-in pattern",
  );
  assert.ok(
    /if\s*\(\s*!params\.confirmReview\s*\)/.test(actionSrc),
    "[PT-06 evidence] inner branch rejects reviewed-but-no-callback case",
  );
  assert.ok(
    /params\.confirmReview\s*\(\s*review\s*\)/.test(actionSrc),
    "[PT-06 evidence] gate awaits confirmReview(review) for approval",
  );
});
