// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const repoRoot = process.cwd();

const targetPathMatchers = [
  /^README\.md$/,
  /^frontend\/README\.md$/,
  /^programs\/omegax_protocol\/README\.md$/,
  /^docs\/(?!adr\/|reviews\/)(?!MIGRATION_MATRIX\.md$)(?!WHY_THIS_MODEL\.md$).+\.md$/,
  /^e2e\/.+\.(?:ts|md)$/,
  /^scripts\/.+\.(?:mjs|js|ts|md)$/,
  /^programs\/omegax_protocol\/src\/.+\.rs$/,
  /^frontend\/app\/.+\.(?:ts|tsx)$/,
];

const excludedPaths = new Set([
  "scripts/check_semantic_readiness.mjs",
  "e2e/support/surface_manifest.ts",
]);

const contentRules = [
  { label: "retired instruction", matcher: /\bcreate_pool\b/g },
  { label: "retired control", matcher: /\bset_pool_status\b/g },
  { label: "retired field", matcher: /\bpool_type\b/g },
  { label: "hybrid-pool wording", matcher: /\bhybrid[- ]pool\b/gi },
  { label: "reward-pool wording", matcher: /\breward pool\b/gi },
  { label: "coverage-pool wording", matcher: /\bcoverage pool\b/gi },
  { label: "legacy pool-first wording", matcher: /\blegacy pool(?:-wide|-first)?\b/gi },
];

function listRepoFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repoRoot },
  );

  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
}

function shouldScan(path) {
  return !excludedPaths.has(path) && targetPathMatchers.some((matcher) => matcher.test(path));
}

function collectLineIssues(path, content) {
  const issues = [];

  for (const [index, rawLine] of content.split("\n").entries()) {
    for (const rule of contentRules) {
      rule.matcher.lastIndex = 0;
      if (rule.matcher.test(rawLine)) {
        issues.push(`${path}:${index + 1} contains ${rule.label}.`);
      }
    }
  }

  return issues;
}

const issues = [];

for (const path of listRepoFiles()) {
  if (!shouldScan(path)) {
    continue;
  }

  if (!existsSync(path)) {
    continue;
  }

  const content = readFileSync(path, "utf8");
  issues.push(...collectLineIssues(path, content));
}

if (issues.length > 0) {
  process.stderr.write("[semantic:readiness] canonical-surface violations detected:\n");
  for (const issue of issues) {
    process.stderr.write(`- ${issue}\n`);
  }
  process.exit(1);
}

process.stdout.write("[semantic:readiness] canonical-surface check passed.\n");
