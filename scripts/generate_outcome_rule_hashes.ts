// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type OutcomeRow = {
  outcomeId: string;
  ruleId: string;
  ruleHashHex: string;
  payoutHashHex: string;
};

function parseArgs(argv: string[]): { file: string; schemaKey: string; prefix: string } {
  let file = '';
  let schemaKey = '';
  let prefix = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      file = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--schema-key') {
      schemaKey = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--prefix') {
      prefix = String(argv[i + 1] || '').trim();
      i += 1;
    }
  }

  if (!file) {
    throw new Error(
      'Usage: node --import tsx scripts/generate_outcome_rule_hashes.ts --file <schema-metadata.json> [--schema-key <key>] [--prefix <rule-prefix>]',
    );
  }

  return { file, schemaKey, prefix };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function main() {
  const { file, schemaKey, prefix } = parseArgs(process.argv.slice(2));
  const path = resolve(process.cwd(), file);
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const outcomesRaw = parsed.outcomes;
  if (!Array.isArray(outcomesRaw)) {
    throw new Error('Schema metadata must include outcomes[]');
  }

  const rows: OutcomeRow[] = [];
  for (const entry of outcomesRaw) {
    const row = asRecord(entry);
    if (!row) continue;
    const outcomeId = typeof row.id === 'string' ? row.id.trim() : '';
    if (!outcomeId) continue;
    const ruleId = prefix ? `${prefix}${outcomeId}` : outcomeId;
    const payoutSeed = schemaKey ? `${schemaKey}:${ruleId}:payout` : `${ruleId}:payout`;
    rows.push({
      outcomeId,
      ruleId,
      ruleHashHex: sha256Hex(ruleId),
      payoutHashHex: sha256Hex(payoutSeed),
    });
  }

  console.log(`[outcome-rule-hashes] file=${path}`);
  console.log(`[outcome-rule-hashes] rows=${rows.length}`);
  console.log(JSON.stringify(rows, null, 2));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[outcome-rule-hashes] failed: ${message}`);
  process.exit(1);
}

