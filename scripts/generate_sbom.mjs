// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const outDir = new URL('../artifacts/sbom/', import.meta.url);
mkdirSync(outDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

try {
  writeFileSync(
    new URL('root-npm-sbom.json', outDir),
    run('npm', ['sbom', '--omit=dev', '--sbom-format', 'cyclonedx', '--json']),
  );
  writeFileSync(
    new URL('frontend-npm-sbom.json', outDir),
    run('npm', ['--prefix', 'frontend', 'sbom', '--omit=dev', '--sbom-format', 'cyclonedx', '--json']),
  );
  writeFileSync(new URL('cargo-tree.txt', outDir), run('cargo', ['tree', '--locked']));
} catch (error) {
  process.stderr.write(`[sbom] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

process.stdout.write(`[sbom] wrote SBOM artifacts to ${outDir.pathname}\n`);
