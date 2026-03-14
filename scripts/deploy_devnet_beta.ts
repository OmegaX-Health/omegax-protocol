// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import bs58 from 'bs58';

type RunResult = {
  status: number | null;
  output: string;
};

function runCommand(cmd: string, args: string[], options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowFailure?: boolean;
}): RunResult {
  const result = spawnSync(cmd, args, {
    cwd: options?.cwd,
    env: options?.env,
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (!options?.allowFailure && result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${result.status ?? 'unknown'}):\n${output}`);
  }
  return {
    status: result.status,
    output,
  };
}

function ensureKeypairFile(path: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  runCommand('solana-keygen', ['new', '--no-bip39-passphrase', '--silent', '-o', path]);
}

function keypairPubkey(path: string): string {
  const result = runCommand('solana-keygen', ['pubkey', path]);
  return result.output.trim();
}

function keypairFileToBase58(path: string): string {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as number[];
  return bs58.encode(Uint8Array.from(raw));
}

function parseTaggedValues(output: string, tag: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = line.match(new RegExp(`^\\[${tag}\\]\\s+([a-z0-9_]+)=(.+)$`));
    if (match) {
      values[match[1]!] = match[2]!.trim();
    }
  }
  return values;
}

function readEnvValue(filePath: string, key: string): string {
  if (!existsSync(filePath)) return '';
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (k === key) return v;
  }
  return '';
}

function required(values: Record<string, string>, key: string): string {
  const value = values[key];
  if (!value) throw new Error(`Missing bootstrap output key: ${key}`);
  return value;
}

function main() {
  const repoRoot = resolve(process.cwd());
  const configuredServicesRoot = String(process.env.PROTOCOL_ORACLE_SERVICE_ROOT || '').trim();
  const servicesRoot = configuredServicesRoot ? resolve(repoRoot, configuredServicesRoot) : '';

  const rpcUrl = String(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  ).trim();
  const programId = String(process.env.PROTOCOL_PROGRAM_ID || 'Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B').trim();
  const schemaKey = String(process.env.SCHEMA_KEY || 'omegax.standard.health_outcomes').trim();
  const schemaVersion = String(process.env.SCHEMA_VERSION || '2').trim();
  const schemaMetadataUri = String(
    process.env.SCHEMA_METADATA_URI || 'https://protocol.omegax.health/schemas/health_outcomes.json',
  ).trim();
  const ruleId = String(process.env.RULE_ID || 'health_alpha_score_ge_70').trim();
  const seekerCanonicalRuleIds = String(
    process.env.SEEKER_CANONICAL_RULE_IDS ||
      'health_alpha_score_ge_60,health_alpha_score_ge_70,health_alpha_score_ge_80',
  ).trim();
  const governanceProgramVersion = String(process.env.GOVERNANCE_PROGRAM_VERSION || '3').trim();
  const internalApiToken = String(process.env.INTERNAL_API_TOKEN || randomBytes(24).toString('hex')).trim();
  const faucetChallengeSecret = String(process.env.FAUCET_CHALLENGE_SECRET || randomBytes(32).toString('hex')).trim();
  const governancePath = resolve(String(process.env.GOVERNANCE_KEYPAIR_PATH || join(homedir(), '.config/solana/id.json')).trim());
  const oraclePath = resolve(String(process.env.ORACLE_KEYPAIR_PATH || join(repoRoot, '.keys/devnet-oracle.json')).trim());
  const memberPath = resolve(String(process.env.MEMBER_KEYPAIR_PATH || join(repoRoot, '.keys/devnet-member.json')).trim());
  const skipDeploy = ['1', 'true', 'yes'].includes(String(process.env.SKIP_DEPLOY || '').trim().toLowerCase());

  ensureKeypairFile(oraclePath);
  ensureKeypairFile(memberPath);

  const governancePubkey = keypairPubkey(governancePath);
  const governanceSecret = keypairFileToBase58(governancePath);
  const oracleSecret = keypairFileToBase58(oraclePath);
  const memberSecret = keypairFileToBase58(memberPath);

  if (skipDeploy) {
    console.log('[devnet-beta] SKIP_DEPLOY=true, using existing devnet deployment.');
  } else {
    console.log('[devnet-beta] Deploying program to devnet...');
    const deploy = runCommand('anchor', [
      'deploy',
      '--provider.cluster',
      'devnet',
      '--provider.wallet',
      governancePath,
    ], {
      cwd: repoRoot,
    });
    process.stdout.write(deploy.output);
  }

  console.log('[devnet-beta] Bootstrapping Realms governance...');
  const governanceBootstrap = runCommand('npm', ['run', 'governance:bootstrap'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SOLANA_RPC_URL: rpcUrl,
      PROTOCOL_PROGRAM_ID: programId,
      GOVERNANCE_SECRET_KEY_BASE58: governanceSecret,
      GOVERNANCE_PROGRAM_VERSION: governanceProgramVersion,
    },
    allowFailure: true,
  });
  process.stdout.write(governanceBootstrap.output);
  if (governanceBootstrap.status !== 0 && !governanceBootstrap.output.includes('[governance-bootstrap] Complete')) {
    throw new Error('Governance bootstrap failed before completion.');
  }
  const governanceValues = parseTaggedValues(governanceBootstrap.output, 'governance-bootstrap');
  const governanceRealm = required(governanceValues, 'governance_realm');
  const governanceConfig = required(governanceValues, 'governance_config');
  const governanceAuthorityTarget = String(process.env.ROTATE_GOVERNANCE_TO || governanceConfig).trim();
  const governanceTokenMintFromRealm = required(governanceValues, 'governance_token_mint');

  console.log('[devnet-beta] Running bootstrap...');
  const bootstrap = runCommand('npm', ['run', 'protocol:bootstrap'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SOLANA_RPC_URL: rpcUrl,
      PROTOCOL_PROGRAM_ID: programId,
      GOVERNANCE_SECRET_KEY_BASE58: governanceSecret,
      ORACLE_SECRET_KEY_BASE58: oracleSecret,
      MEMBER_SECRET_KEY_BASE58: memberSecret,
      GOVERNANCE_REALM: governanceRealm,
      GOVERNANCE_CONFIG: governanceConfig,
      ROTATE_GOVERNANCE_TO: governanceAuthorityTarget,
      GOVERNANCE_TOKEN_MINT: governanceTokenMintFromRealm,
      SCHEMA_KEY: schemaKey,
      SCHEMA_VERSION: schemaVersion,
      SCHEMA_METADATA_URI: schemaMetadataUri,
      RULE_ID: ruleId,
      SEEKER_CANONICAL_RULE_IDS: seekerCanonicalRuleIds,
    },
    allowFailure: true,
  });
  process.stdout.write(bootstrap.output);
  if (bootstrap.status !== 0 && !bootstrap.output.includes('[bootstrap-v2] Complete')) {
    throw new Error('Bootstrap failed before completion.');
  }

  const values = parseTaggedValues(bootstrap.output, 'bootstrap-v2');
  const poolAddress = required(values, 'pool_pda');
  const oracleAddress = required(values, 'oracle');
  const membershipMode = Number.parseInt(String(values.membership_mode || '').trim(), 10);
  const existingFrontendEnvPath = resolve(repoRoot, 'frontend/.env.local');
  const tokenGateMint = values.token_gate_mint
    || String(process.env.TOKEN_GATE_MINT || '').trim()
    || readEnvValue(existingFrontendEnvPath, 'NEXT_PUBLIC_DEFAULT_TOKEN_GATE_MINT');
  if (!tokenGateMint && membershipMode === 1) {
    throw new Error('Missing token gate mint. Set TOKEN_GATE_MINT and rerun.');
  }
  const governanceTokenMint = values.governance_token_mint
    || String(process.env.GOVERNANCE_TOKEN_MINT || '').trim()
    || governanceTokenMintFromRealm;
  const faucetMint = governanceTokenMint;
  const ruleHashHex = required(values, 'rule_hash_hex');
  const schemaKeyHashHex = required(values, 'schema_key_hash_hex');

  const frontendEnvPath = resolve(repoRoot, 'frontend/.env.local');
  const frontendEnv = [
    `NEXT_PUBLIC_SOLANA_RPC_URL=${rpcUrl}`,
    'NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER=devnet',
    `NEXT_PUBLIC_PROTOCOL_PROGRAM_ID=${programId}`,
    `NEXT_PUBLIC_DEFAULT_POOL_ADDRESS=${poolAddress}`,
    `NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS=${oracleAddress}`,
    `NEXT_PUBLIC_DEFAULT_TOKEN_GATE_MINT=${tokenGateMint}`,
    `NEXT_PUBLIC_GOVERNANCE_REALM=${governanceRealm}`,
    `NEXT_PUBLIC_GOVERNANCE_CONFIG=${governanceConfig}`,
    `NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT=${governanceTokenMint}`,
    'NEXT_PUBLIC_FAUCET_ENABLED=true',
    `NEXT_PUBLIC_FAUCET_MINT=${faucetMint}`,
    'NEXT_PUBLIC_TURNSTILE_SITE_KEY=',
    'FAUCET_SKIP_CAPTCHA=true',
    'FAUCET_INTERNAL_BASE_URL=http://localhost:8080',
    `FAUCET_INTERNAL_API_TOKEN=${internalApiToken}`,
    `FAUCET_CHALLENGE_SECRET=${faucetChallengeSecret}`,
    'TURNSTILE_SECRET_KEY=',
    '',
  ].join('\n');
  writeFileSync(frontendEnvPath, frontendEnv);

  let serviceEnvPath = '';
  if (servicesRoot && existsSync(servicesRoot)) {
    serviceEnvPath = resolve(servicesRoot, '.env.devnet.local');
    const serviceEnv = [
      'PORT=8080',
      'NODE_ENV=development',
      '',
      `SOLANA_RPC_URL=${rpcUrl}`,
      'RPC_COMMITMENT=confirmed',
      `PROTOCOL_PROGRAM_ID=${programId}`,
      `PROTOCOL_DEFAULT_POOL_ADDRESS=${poolAddress}`,
      `PROTOCOL_DEFAULT_RULE_HASH_HEX=${ruleHashHex}`,
      `PROTOCOL_DEFAULT_SCHEMA_KEY_HASH_HEX=${schemaKeyHashHex}`,
      'PROTOCOL_OUTCOME_RULE_MODE=composable',
      'SOLANA_EXPLORER_BASE_URL=https://explorer.solana.com',
      'SOLANA_EXPLORER_CLUSTER=devnet',
      '',
      'CLAIM_INTENT_TTL_SECONDS=900',
      'REWARD_ASSET_SYMBOL=OMEGAX',
      'REWARD_UNITS_PER_PASS=1',
      'REWARD_UI_DECIMALS=0',
      'RECONCILE_SUBMITTED_MIN_AGE_SECONDS=60',
      'RECONCILE_DEFAULT_LIMIT=100',
      '',
      `INTERNAL_API_TOKEN=${internalApiToken}`,
      'ATTEST_PENDING_TTL_SECONDS=600',
      '',
      'ORACLE_SIGNER_KEY_ID=oracle-dev-key',
      `ORACLE_SIGNER_SECRET_KEY_BASE58=${oracleSecret}`,
      '',
      'OMEGAX_FAUCET_ENABLED=true',
      `OMEGAX_FAUCET_MINT=${faucetMint}`,
      'OMEGAX_FAUCET_AMOUNT_RAW=5',
      'OMEGAX_FAUCET_COOLDOWN_SECONDS=21600',
      'OMEGAX_FAUCET_MAX_REQUESTS_PER_DAY=10',
      `OMEGAX_FAUCET_AUTHORITY_SECRET_KEY_BASE58=${oracleSecret}`,
      '',
    ].join('\n');
    writeFileSync(serviceEnvPath, serviceEnv);
  }

  console.log('');
  console.log('[devnet-beta] Complete');
  console.log(`[devnet-beta] governance_signer=${governancePubkey}`);
  console.log(`[devnet-beta] governance_realm=${governanceRealm}`);
  console.log(`[devnet-beta] governance_config=${governanceConfig}`);
  console.log(`[devnet-beta] governance_authority=${values.governance_authority_rotated_to || governanceAuthorityTarget || governancePubkey}`);
  console.log(`[devnet-beta] oracle=${oracleAddress}`);
  console.log(`[devnet-beta] member=${required(values, 'member')}`);
  console.log(`[devnet-beta] pool=${poolAddress}`);
  console.log(`[devnet-beta] token_gate_mint=${tokenGateMint}`);
  console.log(`[devnet-beta] governance_token_mint=${governanceTokenMint}`);
  console.log(`[devnet-beta] rule_hash_hex=${ruleHashHex}`);
  console.log(`[devnet-beta] frontend_env=${frontendEnvPath}`);
  if (serviceEnvPath) {
    console.log(`[devnet-beta] service_env=${serviceEnvPath}`);
  } else {
    console.log('[devnet-beta] service_env=skipped (set PROTOCOL_ORACLE_SERVICE_ROOT to enable)');
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[devnet-beta] failed: ${message}`);
  process.exit(1);
}
