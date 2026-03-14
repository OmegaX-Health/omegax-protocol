// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';

const SEARCH_TARGETS = [
  'README.md',
  'programs/omegax_protocol/src',
  'frontend',
  'tests',
  'idl/omegax_protocol.json',
  'shared/protocol_contract.json',
  'scripts/bootstrap_protocol.ts',
  'scripts/generate_protocol_contract.ts',
];

const SHARED_GLOBS = [
  '--glob',
  '!android-native/**',
  '--glob',
  '!**/node_modules/**',
  '--glob',
  '!**/target/**',
  '--glob',
  '!**/.next/**',
];

const CHECKS = [
  {
    label: 'old program id',
    pattern: '6SmJvZYWtQSbcEjhKi1bhtS4fA8QfV5rQdZPqfCbXj6f',
  },
  {
    label: 'legacy instruction name',
    pattern: '\\b(initialize_protocol|set_protocol_pause|create_pool|set_cycle_window|fund_pool|enroll_member|submit_claim)\\b',
  },
];

function runRg(pattern) {
  return spawnSync(
    'rg',
    ['-n', pattern, ...SHARED_GLOBS, ...SEARCH_TARGETS],
    { encoding: 'utf8' },
  );
}

let failed = false;

for (const check of CHECKS) {
  const result = runRg(check.pattern);
  if (result.status === 0) {
    failed = true;
    process.stderr.write(`[beta:consistency] found forbidden ${check.label} references:\n`);
    process.stderr.write(result.stdout);
    continue;
  }
  if (result.status !== 1) {
    process.stderr.write(`[beta:consistency] rg failed while checking ${check.label}.\n`);
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }
}

if (failed) {
  process.stderr.write('[beta:consistency] check failed.\n');
  process.exit(1);
}

process.stdout.write('[beta:consistency] check passed.\n');
