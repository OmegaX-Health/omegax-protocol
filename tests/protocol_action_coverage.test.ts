// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type ProtocolContract = {
  instructions: Array<{ name: string }>;
};

const programSource = readFileSync(
  new URL('../programs/omegax_protocol/src/lib.rs', import.meta.url),
  'utf8',
);
const instructionMap = readFileSync(
  new URL('../docs/architecture/solana-instruction-map.md', import.meta.url),
  'utf8',
);
const contract = JSON.parse(
  readFileSync(new URL('../shared/protocol_contract.json', import.meta.url), 'utf8'),
) as ProtocolContract;

function sorted(values: Iterable<string>): string[] {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function diff(left: Iterable<string>, right: Iterable<string>): string[] {
  const rightSet = new Set(right);
  return sorted(Array.from(left).filter((value) => !rightSet.has(value)));
}

function programEntrypoints(): string[] {
  return sorted(
    [...programSource.matchAll(/^\s*pub fn ([a-z0-9_]+)\(/gm)].map((match) => match[1]),
  );
}

function documentedInstructionFlows(): Map<string, string[]> {
  const flows = new Map<string, string[]>();
  let currentSection: string | null = null;

  for (const line of instructionMap.split('\n')) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      currentSection = heading[1].trim();
      continue;
    }

    const row = /^\| `([a-z0-9_]+)` \|/.exec(line);
    if (!row) {
      continue;
    }

    assert.ok(currentSection, `instruction row ${row[1]} must belong to a flow section`);
    const section = currentSection as string;
    flows.set(section, [...(flows.get(section) ?? []), row[1]]);
  }

  return flows;
}

test('instruction map groups every public entrypoint into a documented flow exactly once', () => {
  const entrypoints = programEntrypoints();
  const documented = Array.from(documentedInstructionFlows().values()).flat();
  const duplicates = documented.filter((name, index) => documented.indexOf(name) !== index);

  assert.deepEqual(sorted(new Set(duplicates)), [], 'duplicate instruction rows in instruction map');
  assert.deepEqual(diff(entrypoints, documented), [], 'undocumented public entrypoints in lib.rs');
  assert.deepEqual(diff(documented, entrypoints), [], 'instruction map lists unknown entrypoints');
});

test('generated protocol contract covers every documented public instruction', () => {
  const documented = Array.from(documentedInstructionFlows().values()).flat();
  const contractInstructions = contract.instructions.map((instruction) => instruction.name);

  assert.deepEqual(
    diff(documented, contractInstructions),
    [],
    'documented instructions missing from generated protocol contract',
  );
  assert.deepEqual(
    diff(contractInstructions, documented),
    [],
    'generated protocol contract contains undocumented instructions',
  );
});
