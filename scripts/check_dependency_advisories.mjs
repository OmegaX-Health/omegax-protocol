// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const acceptedDoc = readFileSync(
  new URL('../docs/operations/dependency-advisory-risk-acceptance.md', import.meta.url),
  'utf8',
);

const acceptedAdvisory = 'GHSA-3gc7-fjrx-p6mg';
const acceptedPackages = new Set([
  '@solana/buffer-layout-utils',
  '@solana/spl-token',
  'bigint-buffer',
]);

function runAudit(cwd, label) {
  const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    cwd,
    encoding: 'utf8',
  });
  const raw = result.stdout || result.stderr;
  if (!raw.trim()) {
    throw new Error(`${label}: npm audit produced no JSON output`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label}: npm audit JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const auditVulnerabilities = parsed.vulnerabilities ?? {};
  const vulnerabilities = Object.entries(auditVulnerabilities);
  const isAccepted = (name, vulnerability, seen = new Set()) => {
    if (seen.has(name)) {
      return false;
    }
    seen.add(name);

    if (!acceptedPackages.has(name) || !acceptedDoc.includes(name) || !acceptedDoc.includes(acceptedAdvisory)) {
      return false;
    }

    const blob = JSON.stringify(vulnerability);
    if (blob.includes(acceptedAdvisory) || blob.includes('bigint-buffer')) {
      return true;
    }

    for (const via of vulnerability.via ?? []) {
      if (typeof via !== 'string') {
        continue;
      }
      const viaVulnerability = auditVulnerabilities[via];
      if (viaVulnerability && isAccepted(via, viaVulnerability, seen)) {
        return true;
      }
    }

    return false;
  };

  const unaccepted = vulnerabilities.filter(([name, vulnerability]) => {
    return !isAccepted(name, vulnerability);
  });

  if (unaccepted.length > 0) {
    const details = unaccepted
      .map(([name, vulnerability]) => `${name}: ${vulnerability.severity ?? 'unknown severity'}`)
      .join('\n');
    throw new Error(`${label}: unaccepted npm advisories found\n${details}`);
  }

  return `${label}: ${vulnerabilities.length} npm advisories; all are covered by dependency-advisory-risk-acceptance.md.`;
}

const root = process.cwd();
const messages = [];

try {
  messages.push(runAudit(root, 'root npm'));
  messages.push(runAudit(`${root}/frontend`, 'frontend npm'));
} catch (error) {
  process.stderr.write(`[security:audit:deps] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

for (const message of messages) {
  process.stdout.write(`${message}\n`);
}
