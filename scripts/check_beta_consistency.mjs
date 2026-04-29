// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';

const SEARCH_TARGETS = [
  'README.md',
  'programs/omegax_protocol/src',
  'frontend',
  'idl/omegax_protocol.json',
  'shared/protocol_contract.json',
  'scripts/bootstrap_protocol.ts',
  'scripts/generate_protocol_contract.ts',
];

const SHARED_GLOBS = [
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
    label: 'legacy public instruction name',
    pattern: '\\b(initialize_protocol_v2|create_pool_v2|register_oracle_v2|claim_oracle_v2|update_oracle_profile_v2|pay_premium_sol_v2|pay_premium_spl_v2|pay_premium_onchain|set_protocol_pause|set_cycle_window|fund_pool|enroll_member|submit_claim)\\b',
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
