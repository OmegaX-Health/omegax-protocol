// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const trackedFiles = [
  'shared/protocol_contract.json',
  'frontend/lib/generated/protocol-contract.ts',
  'android-native/protocol/src/main/java/com/omegax/protocol/ProtocolContract.kt',
];

const before = new Map(
  trackedFiles.map((path) => [path, readFileSync(path, 'utf8')]),
);

run('node', ['--import', 'tsx', 'scripts/generate_protocol_contract.ts']);

const changed = trackedFiles.filter((path) => {
  const previous = before.get(path) ?? '';
  const current = readFileSync(path, 'utf8');
  return previous !== current;
});

if (changed.length > 0) {
  process.stderr.write('[protocol:contract:check] generated files are out of date:\n');
  for (const path of changed) {
    process.stderr.write(`- ${path}\n`);
  }
  process.stderr.write(
    '[protocol:contract:check] generated files are out of date. Run `npm run protocol:contract` and commit the results.\n',
  );
  process.exit(1);
}

process.stdout.write('[protocol:contract:check] contract files are in sync.\n');
