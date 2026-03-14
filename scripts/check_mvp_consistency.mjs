// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';

process.stderr.write(
  '[mvp:consistency] deprecated: forwarding to beta consistency check.\n',
);

const result = spawnSync('node', ['scripts/check_beta_consistency.mjs'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
