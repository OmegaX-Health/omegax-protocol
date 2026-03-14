// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv: string[]): { file: string } {
  let file = '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      file = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
  }
  if (!file) {
    throw new Error('Usage: node --import tsx scripts/generate_schema_metadata_hash.ts --file <schema-metadata.json>');
  }
  return { file };
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function main() {
  const { file } = parseArgs(process.argv.slice(2));
  const path = resolve(process.cwd(), file);
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  const canonical = stableStringify(parsed);
  const schemaHashHex = sha256Hex(canonical);

  console.log(`[schema-metadata-hash] file=${path}`);
  console.log(`[schema-metadata-hash] schema_hash_hex=${schemaHashHex}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[schema-metadata-hash] failed: ${message}`);
  process.exit(1);
}

