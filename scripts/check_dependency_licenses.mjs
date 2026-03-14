// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';

const blockedLicenseFragments = ['GPL-2.0', 'UNKNOWN', 'UNLICENSED'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: 'utf8',
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function assertAllowedLicenses(entries, label) {
  const issues = [];

  for (const entry of entries) {
    const license = String(entry.license ?? '').trim();
    const normalized = license.toUpperCase();
    const blocked = blockedLicenseFragments.find((fragment) => normalized.includes(fragment));
    if (blocked) {
      issues.push(`${label}: ${entry.name} -> ${license}`);
    }
  }

  if (issues.length > 0) {
    throw new Error(issues.join('\n'));
  }
}

function collectNodeLicenses(cwd, label) {
  const result = run(
    'npm',
    ['exec', '--yes', '--package=license-checker', '--', 'license-checker', '--json', '--production'],
    { cwd },
  );

  if (result.status !== 0) {
    throw new Error(`${label}: license-checker failed\n${result.stderr || result.stdout}`);
  }

  const raw = JSON.parse(result.stdout);
  const entries = Object.entries(raw).map(([name, meta]) => ({
    name,
    path: meta.path,
    license: Array.isArray(meta.licenses) ? meta.licenses.join(' OR ') : meta.licenses,
  })).filter((entry) => entry.path !== cwd);

  assertAllowedLicenses(entries, label);
  return `${label}: checked ${entries.length} production npm dependencies.`;
}

function cargoLicenseAvailable() {
  const result = run('cargo', ['license', '--help']);
  return result.status === 0;
}

function collectCargoLicenses() {
  if (!cargoLicenseAvailable()) {
    if (String(process.env.CI || '').trim() === 'true' || String(process.env.CI || '').trim() === '1') {
      throw new Error('cargo-license is required in CI but is not installed.');
    }
    return '[license:audit] cargo-license not installed locally; skipping Cargo dependency audit.';
  }

  const result = run('cargo', ['license', '--json']);
  if (result.status !== 0) {
    throw new Error(`cargo license --json failed\n${result.stderr || result.stdout}`);
  }

  const raw = JSON.parse(result.stdout);
  const entries = raw.map((entry) => ({
    name: `${entry.name}@${entry.version}`,
    license: entry.license ?? entry.licenses ?? '',
  }));

  assertAllowedLicenses(entries, 'cargo');
  return `cargo: checked ${entries.length} Rust dependencies.`;
}

const messages = [];

try {
  messages.push(collectNodeLicenses(process.cwd(), 'root npm'));
  messages.push(collectNodeLicenses(`${process.cwd()}/frontend`, 'frontend npm'));
  messages.push(collectCargoLicenses());
} catch (error) {
  process.stderr.write(`[license:audit] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

for (const message of messages) {
  process.stdout.write(`${message}\n`);
}
