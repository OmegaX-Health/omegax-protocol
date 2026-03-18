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
const KOTLIN_GENERATED_PATH = resolve(
  REPO_ROOT,
  'android-native/protocol/src/main/java/com/omegax/protocol/ProtocolContract.kt',
);

const PDA_SEEDS: Record<string, string[]> = {
  config: ['config'],
  pool: ['pool', '<authority>', '<pool_id>'],
  oracle: ['oracle', '<oracle>'],
  oracle_profile: ['oracle_profile', '<oracle>'],
  oracle_stake: ['oracle_stake', '<oracle>', '<staker>'],
  pool_oracle: ['pool_oracle', '<pool>', '<oracle>'],
  pool_oracle_policy: ['pool_oracle_policy', '<pool>'],
  pool_oracle_permissions: ['pool_oracle_permissions', '<pool>', '<oracle>'],
  pool_terms: ['pool_terms', '<pool>'],
  pool_asset_vault: ['pool_asset_vault', '<pool>', '<payout_mint>'],
  pool_risk_config: ['pool_risk_config', '<pool>'],
  pool_capital_class: ['pool_capital_class', '<pool>', '<share_mint>'],
  policy_series: ['policy_series', '<pool>', '<series_ref_hash>'],
  pool_compliance_policy: ['pool_compliance_policy', '<pool>'],
  pool_control_authority: ['pool_control_authority', '<pool>'],
  pool_automation_policy: ['pool_automation_policy', '<pool>'],
  pool_liquidity_config: ['pool_liquidity_config', '<pool>'],
  pool_share_mint: ['pool_share_mint', '<pool>'],
  membership: ['membership', '<pool>', '<member>'],
  member_cycle: ['member_cycle', '<pool>', '<series_ref_hash>', '<member>', '<period_index>'],
  cycle_quote_replay: ['cycle_quote_replay', '<pool>', '<series_ref_hash>', '<member>', '<nonce_hash>'],
  pool_treasury_reserve: ['pool_treasury_reserve', '<pool>', '<payment_mint>'],
  schema: ['schema', '<schema_key_hash>'],
  schema_dependency: ['schema_dependency', '<schema_key_hash>'],
  pool_rule: ['pool_rule', '<pool>', '<series_ref_hash>', '<rule_hash>'],
  invite_issuer: ['invite_issuer', '<issuer>'],
  enrollment_replay: ['enrollment_replay', '<pool>', '<member>', '<nonce_hash>'],
  attestation_vote: ['attestation_vote', '<pool>', '<series_ref_hash>', '<member>', '<cycle_hash>', '<rule_hash>', '<oracle>'],
  outcome_aggregate: ['outcome_agg', '<pool>', '<series_ref_hash>', '<member>', '<cycle_hash>', '<rule_hash>'],
  claim_delegate: ['claim_delegate', '<pool>', '<member>'],
  claim: ['claim', '<pool>', '<series_ref_hash>', '<member>', '<cycle_hash>', '<rule_hash>'],
  policy_position: ['policy_position', '<pool>', '<series_ref_hash>', '<member>'],
  policy_position_nft: ['policy_position_nft', '<pool>', '<series_ref_hash>', '<member>'],
  premium_ledger: ['premium_ledger', '<pool>', '<series_ref_hash>', '<member>'],
  premium_replay: ['premium_replay', '<pool>', '<series_ref_hash>', '<member>', '<replay_hash>'],
  coverage_claim: ['coverage_claim', '<pool>', '<series_ref_hash>', '<member>', '<intent_hash>'],
  policy_series_payment_option: [
    'policy_series_payment_option',
    '<pool>',
    '<series_ref_hash>',
    '<payment_mint>',
  ],
  redemption_request: ['redemption_request', '<pool>', '<redeemer>', '<request_hash>'],
  cohort_settlement_root: ['cohort_settlement_root', '<pool>', '<series_ref_hash>', '<cohort_hash>'],
  protocol_fee_vault: ['protocol_fee_vault', '<payment_mint>'],
  pool_oracle_fee_vault: ['pool_oracle_fee_vault', '<pool>', '<oracle>', '<payment_mint>'],
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

function renderKotlin(contract: ProtocolContract, sha256: string): string {
  const discriminatorEntries = contract.instructions
    .map(
      (ix) =>
        `        ${kotlinString(ix.name)} to byteArrayOf(${ix.discriminator
          .map((it) => `${it.toString()}u.toByte()`)
          .join(', ')}),`,
    )
    .join('\n');

  const pdaSeedsEntries = Object.entries(contract.pdaSeeds)
    .map(
      ([seedName, seeds]) =>
        `        ${kotlinString(seedName)} to listOf(${seeds.map((seed) => kotlinString(seed)).join(', ')}),`,
    )
    .join('\n');

  const accountDiscriminatorEntries = Object.entries(contract.accountDiscriminators)
    .map(
      ([name, discriminator]) =>
        `        ${kotlinString(name)} to byteArrayOf(${discriminator
          .map((it) => `${it.toString()}u.toByte()`)
          .join(', ')}),`,
    )
    .join('\n');

  return `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// source: shared/protocol_contract.json
// contract_sha256: ${sha256}

package com.omegax.protocol

object ProtocolContract {
    const val PROGRAM_ID: String = ${kotlinString(contract.programId)}

    val instructionDiscriminators: Map<String, ByteArray> = mapOf(
${discriminatorEntries}
    )

    val pdaSeeds: Map<String, List<String>> = mapOf(
${pdaSeedsEntries}
    )

    val accountDiscriminators: Map<String, ByteArray> = mapOf(
${accountDiscriminatorEntries}
    )
}
`;
}

function kotlinString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
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
    sourceIdlPath:
      sourceIdlPath === TARGET_IDL_PATH
        ? 'target/idl/omegax_protocol.json'
        : 'idl/omegax_protocol.json',
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

  ensureParent(KOTLIN_GENERATED_PATH);
  writeFileSync(KOTLIN_GENERATED_PATH, renderKotlin(contract, contractSha), 'utf8');

  process.stdout.write(
    [
      `[protocol:contract] wrote ${resolve(CONTRACT_JSON_PATH)}`,
      `[protocol:contract] wrote ${resolve(FRONTEND_GENERATED_PATH)}`,
      `[protocol:contract] wrote ${resolve(KOTLIN_GENERATED_PATH)}`,
      `[protocol:contract] contract_sha256=${contractSha}`,
    ].join('\n') + '\n',
  );
}

main();
