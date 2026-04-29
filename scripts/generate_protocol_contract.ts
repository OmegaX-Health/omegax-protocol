// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type IdlType =
  | string
  | { option: IdlType }
  | { vec: IdlType }
  | { array: [IdlType, number] }
  | { defined: string };

type IdlArg = {
  name: string;
  type: IdlType;
};

type IdlSeed = {
  kind: 'const' | 'arg' | 'account';
  path?: string;
  value?: number[];
};

type IdlInstructionAccount = {
  name: string;
  writable?: boolean;
  signer?: boolean;
  optional?: boolean;
  pda?: {
    seeds: IdlSeed[];
  };
  address?: string;
  accounts?: IdlInstructionAccount[];
};

type IdlInstruction = {
  name: string;
  discriminator: number[];
  accounts: IdlInstructionAccount[];
  args: IdlArg[];
};

type Idl = {
  address: string;
  instructions: IdlInstruction[];
  accounts?: Array<{
    name: string;
    discriminator: number[];
  }>;
};

type ProtocolContractInstruction = {
  name: string;
  discriminator: number[];
  args: IdlArg[];
  accounts: IdlInstructionAccount[];
};

type ProtocolContract = {
  sourceIdlPath: string;
  programId: string;
  instructionSetVersion: number;
  instructions: ProtocolContractInstruction[];
  accountDiscriminators: Record<string, number[]>;
  pdaSeeds: Record<string, string[]>;
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const TARGET_IDL_PATH = resolve(REPO_ROOT, 'target/idl/omegax_protocol.json');
const CHECKED_IN_IDL_PATH = resolve(REPO_ROOT, 'idl/omegax_protocol.json');
const CONTRACT_JSON_PATH = resolve(REPO_ROOT, 'shared/protocol_contract.json');
const FRONTEND_GENERATED_PATH = resolve(REPO_ROOT, 'frontend/lib/generated/protocol-contract.ts');
const FRONTEND_GENERATED_JS_PATH = resolve(REPO_ROOT, 'frontend/lib/generated/protocol-contract.js');

const PDA_SEEDS: Record<string, string[]> = {
  protocol_governance: ['protocol_governance'],
  reserve_domain: ['reserve_domain', '<domain_id>'],
  domain_asset_vault: ['domain_asset_vault', '<reserve_domain>', '<asset_mint>'],
  domain_asset_ledger: ['domain_asset_ledger', '<reserve_domain>', '<asset_mint>'],
  health_plan: ['health_plan', '<reserve_domain>', '<plan_id>'],
  plan_reserve_ledger: ['plan_reserve_ledger', '<health_plan>', '<asset_mint>'],
  policy_series: ['policy_series', '<health_plan>', '<series_id>'],
  series_reserve_ledger: ['series_reserve_ledger', '<policy_series>', '<asset_mint>'],
  member_position: ['member_position', '<health_plan>', '<wallet>', '<series_scope>'],
  membership_anchor_seat: ['membership_anchor_seat', '<health_plan>', '<anchor_ref>'],
  funding_line: ['funding_line', '<health_plan>', '<line_id>'],
  funding_line_ledger: ['funding_line_ledger', '<funding_line>', '<asset_mint>'],
  claim_case: ['claim_case', '<health_plan>', '<claim_id>'],
  obligation: ['obligation', '<funding_line>', '<obligation_id>'],
  liquidity_pool: ['liquidity_pool', '<reserve_domain>', '<pool_id>'],
  capital_class: ['capital_class', '<liquidity_pool>', '<class_id>'],
  pool_class_ledger: ['pool_class_ledger', '<capital_class>', '<asset_mint>'],
  lp_position: ['lp_position', '<capital_class>', '<owner>'],
  allocation_position: ['allocation_position', '<capital_class>', '<funding_line>'],
  allocation_ledger: ['allocation_ledger', '<allocation_position>', '<asset_mint>'],
  oracle_profile: ['oracle_profile', '<oracle>'],
  pool_oracle_approval: ['pool_oracle_approval', '<liquidity_pool>', '<oracle>'],
  pool_oracle_policy: ['pool_oracle_policy', '<liquidity_pool>'],
  pool_oracle_permission_set: ['pool_oracle_permission_set', '<liquidity_pool>', '<oracle>'],
  outcome_schema: ['outcome_schema', '<schema_key_hash>'],
  schema_dependency_ledger: ['schema_dependency_ledger', '<schema_key_hash>'],
  claim_attestation: ['claim_attestation', '<claim_case>', '<oracle>'],
};

function canonicalDiscriminator(name: string): number[] {
  return Array.from(createHash('sha256').update(`global:${name}`).digest()).slice(0, 8);
}

function normalizeType(type: IdlType): IdlType {
  if (typeof type === 'string') return type;
  if ('option' in type) return { option: normalizeType(type.option) };
  if ('vec' in type) return { vec: normalizeType(type.vec) };
  if ('array' in type) return { array: [normalizeType(type.array[0]), type.array[1]] };
  if ('defined' in type) return { defined: type.defined };
  return type;
}

function flattenInstructionAccounts(
  accounts: IdlInstructionAccount[],
  prefix?: string,
): IdlInstructionAccount[] {
  return accounts.flatMap((account) => {
    const qualifiedName = prefix ? `${prefix}.${account.name}` : account.name;
    if (Array.isArray(account.accounts) && account.accounts.length > 0) {
      return flattenInstructionAccounts(account.accounts, qualifiedName);
    }

    const pda = account.pda
      ? {
          seeds: account.pda.seeds.map((seed) => {
            if (seed.kind !== 'account' || !seed.path || !prefix || seed.path.includes('.')) {
              return seed;
            }
            return {
              ...seed,
              path: `${prefix}.${seed.path}`,
            };
          }),
        }
      : undefined;

    return [
      {
        name: qualifiedName,
        writable: account.writable,
        signer: account.signer,
        optional: account.optional,
        pda,
        address: account.address,
      },
    ];
  });
}

function renderTs(contract: ProtocolContract, sha256: string): string {
  const instructionMapEntries = contract.instructions
    .map(
      (ix) => `  ${JSON.stringify(ix.name)}: Uint8Array.from([${ix.discriminator.join(', ')}]),`,
    )
    .join('\n');

  const argsByInstruction = contract.instructions
    .map((ix) => {
      const args = ix.args
        .map((arg) => `      { name: ${JSON.stringify(arg.name)}, type: ${JSON.stringify(arg.type)} },`)
        .join('\n');
      return `  ${JSON.stringify(ix.name)}: [\n${args}\n  ],`;
    })
    .join('\n');

  const accountsByInstruction = contract.instructions
    .map((ix) => {
      const accounts = ix.accounts
        .map((acct) => {
          const pdaSeeds = acct.pda?.seeds
            ? `[${acct.pda.seeds
                .map((seed) => {
                  const pieces = [
                    `kind: ${JSON.stringify(seed.kind)}`,
                    seed.path ? `path: ${JSON.stringify(seed.path)}` : null,
                    seed.value ? `value: [${seed.value.join(', ')}]` : null,
                  ].filter(Boolean);
                  return `{ ${pieces.join(', ')} }`;
                })
                .join(', ')}]`
            : 'undefined';
          return `      { name: ${JSON.stringify(acct.name)}, writable: ${Boolean(acct.writable)}, signer: ${Boolean(acct.signer)}, optional: ${Boolean(acct.optional)}, address: ${acct.address ? JSON.stringify(acct.address) : 'undefined'}, pdaSeeds: ${pdaSeeds} },`;
        })
        .join('\n');
      return `  ${JSON.stringify(ix.name)}: [\n${accounts}\n  ],`;
    })
    .join('\n');

  const pdaSeedsEntries = Object.entries(contract.pdaSeeds)
    .map(([name, seeds]) => `  ${JSON.stringify(name)}: [${seeds.map((seed) => JSON.stringify(seed)).join(', ')}],`)
    .join('\n');

  const accountDiscriminatorEntries = Object.entries(contract.accountDiscriminators)
    .map(
      ([name, discriminator]) =>
        `  ${JSON.stringify(name)}: Uint8Array.from([${discriminator.join(', ')}]),`,
    )
    .join('\n');

  return `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// source: shared/protocol_contract.json
// contract_sha256: ${sha256}

export type ProtocolInstructionName =
${contract.instructions.map((ix) => `  | ${JSON.stringify(ix.name)}`).join('\n')};

export type ProtocolInstructionArg = {
  name: string;
  type: unknown;
};

export type ProtocolInstructionAccount = {
  name: string;
  writable: boolean;
  signer: boolean;
  optional: boolean;
  address?: string;
  pdaSeeds?: Array<{ kind: string; path?: string; value?: number[] }>;
};

export const PROTOCOL_PROGRAM_ID = ${JSON.stringify(contract.programId)} as const;

export const PROTOCOL_INSTRUCTION_DISCRIMINATORS: Record<ProtocolInstructionName, Uint8Array> = {
${instructionMapEntries}
};

export const PROTOCOL_INSTRUCTION_ARGS: Record<ProtocolInstructionName, ProtocolInstructionArg[]> = {
${argsByInstruction}
};

export const PROTOCOL_INSTRUCTION_ACCOUNTS: Record<ProtocolInstructionName, ProtocolInstructionAccount[]> = {
${accountsByInstruction}
};

export const PROTOCOL_ACCOUNT_DISCRIMINATORS: Record<string, Uint8Array> = {
${accountDiscriminatorEntries}
};

export const PROTOCOL_PDA_SEEDS: Record<string, string[]> = {
${pdaSeedsEntries}
};
`;
}

function renderJs(contract: ProtocolContract, sha256: string): string {
  const instructionMapEntries = contract.instructions
    .map(
      (ix) => `    ${JSON.stringify(ix.name)}: Uint8Array.from([${ix.discriminator.join(', ')}]),`,
    )
    .join('\n');

  const argsByInstruction = contract.instructions
    .map((ix) => {
      const args = ix.args
        .map((arg) => `        { name: ${JSON.stringify(arg.name)}, type: ${JSON.stringify(arg.type)} },`)
        .join('\n');
      return `    ${JSON.stringify(ix.name)}: [\n${args}\n    ],`;
    })
    .join('\n');

  const accountsByInstruction = contract.instructions
    .map((ix) => {
      const accounts = ix.accounts
        .map((acct) => {
          const pdaSeeds = acct.pda?.seeds
            ? `[${acct.pda.seeds
                .map((seed) => {
                  const pieces = [
                    `kind: ${JSON.stringify(seed.kind)}`,
                    seed.path ? `path: ${JSON.stringify(seed.path)}` : null,
                    seed.value ? `value: [${seed.value.join(', ')}]` : null,
                  ].filter(Boolean);
                  return `{ ${pieces.join(', ')} }`;
                })
                .join(', ')}]`
            : 'undefined';
          return `        { name: ${JSON.stringify(acct.name)}, writable: ${Boolean(acct.writable)}, signer: ${Boolean(acct.signer)}, optional: ${Boolean(acct.optional)}, address: ${acct.address ? JSON.stringify(acct.address) : 'undefined'}, pdaSeeds: ${pdaSeeds} },`;
        })
        .join('\n');
      return `    ${JSON.stringify(ix.name)}: [\n${accounts}\n    ],`;
    })
    .join('\n');

  const pdaSeedsEntries = Object.entries(contract.pdaSeeds)
    .map(([name, seeds]) => `    ${JSON.stringify(name)}: [${seeds.map((seed) => JSON.stringify(seed)).join(', ')}],`)
    .join('\n');

  const accountDiscriminatorEntries = Object.entries(contract.accountDiscriminators)
    .map(
      ([name, discriminator]) =>
        `    ${JSON.stringify(name)}: Uint8Array.from([${discriminator.join(', ')}]),`,
    )
    .join('\n');

  return `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// source: shared/protocol_contract.json
// contract_sha256: ${sha256}
export const PROTOCOL_PROGRAM_ID = ${JSON.stringify(contract.programId)};
export const PROTOCOL_INSTRUCTION_DISCRIMINATORS = {
${instructionMapEntries}
};
export const PROTOCOL_INSTRUCTION_ARGS = {
${argsByInstruction}
};
export const PROTOCOL_INSTRUCTION_ACCOUNTS = {
${accountsByInstruction}
};
export const PROTOCOL_ACCOUNT_DISCRIMINATORS = {
${accountDiscriminatorEntries}
};
export const PROTOCOL_PDA_SEEDS = {
${pdaSeedsEntries}
};
`;
}

function ensureParent(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function main() {
  const sourceIdlPath = (() => {
    try {
      const parsed = JSON.parse(readFileSync(TARGET_IDL_PATH, 'utf8')) as Idl;
      if (Array.isArray(parsed.instructions) && parsed.instructions.length > 0) {
        return TARGET_IDL_PATH;
      }
    } catch {
      // fallback to checked-in idl
    }
    return CHECKED_IN_IDL_PATH;
  })();

  const idl = JSON.parse(readFileSync(sourceIdlPath, 'utf8')) as Idl;

  const instructions: ProtocolContractInstruction[] = idl.instructions.map((ix) => {
    const expected = canonicalDiscriminator(ix.name);
    const actual = ix.discriminator;
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new Error(
        `Instruction ${ix.name} discriminator mismatch. expected=${expected.join(',')} actual=${actual.join(',')}`,
      );
    }

    return {
      name: ix.name,
      discriminator: actual,
      args: ix.args.map((arg) => ({ name: arg.name, type: normalizeType(arg.type) })),
      accounts: flattenInstructionAccounts(ix.accounts).map((account) => ({
        name: account.name,
        writable: Boolean(account.writable),
        signer: Boolean(account.signer),
        optional: Boolean(account.optional),
        pda: account.pda,
        address: account.address,
      })),
    };
  });

  const accountDiscriminators: Record<string, number[]> = Object.fromEntries(
    (idl.accounts ?? [])
      .filter((account) => Array.isArray(account.discriminator) && account.discriminator.length === 8)
      .map((account) => [account.name, account.discriminator])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  const contract: ProtocolContract = {
    sourceIdlPath: 'idl/omegax_protocol.json',
    programId: idl.address,
    instructionSetVersion: 1,
    instructions,
    accountDiscriminators,
    pdaSeeds: PDA_SEEDS,
  };

  const contractJson = `${JSON.stringify(contract, null, 2)}\n`;
  const contractSha = createHash('sha256').update(contractJson).digest('hex');

  ensureParent(CONTRACT_JSON_PATH);
  writeFileSync(CONTRACT_JSON_PATH, contractJson, 'utf8');

  ensureParent(FRONTEND_GENERATED_PATH);
  writeFileSync(FRONTEND_GENERATED_PATH, renderTs(contract, contractSha), 'utf8');

  ensureParent(FRONTEND_GENERATED_JS_PATH);
  writeFileSync(FRONTEND_GENERATED_JS_PATH, renderJs(contract, contractSha), 'utf8');

  process.stdout.write(
    [
      `[protocol:contract] wrote ${resolve(CONTRACT_JSON_PATH)}`,
      `[protocol:contract] wrote ${resolve(FRONTEND_GENERATED_PATH)}`,
      `[protocol:contract] wrote ${resolve(FRONTEND_GENERATED_JS_PATH)}`,
      `[protocol:contract] contract_sha256=${contractSha}`,
    ].join('\n') + '\n',
  );
}

main();
