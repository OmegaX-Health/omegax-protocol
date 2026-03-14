// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';

process.stderr.write(
  '[devnet-mvp] deprecated: forwarding to full beta deploy (`scripts/deploy_devnet_beta.ts`).\n',
);

const result = spawnSync(
  'node',
  ['--import', 'tsx', 'scripts/deploy_devnet_beta.ts'],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
