// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

import protocolModule from '../frontend/lib/protocol.ts';

const {
  buildCreatePoolV2Tx,
  buildCreatePolicySeriesTx,
  buildEnrollMemberInvitePermitTx,
  buildEnrollMemberOpenTx,
  buildEnrollMemberTokenGateTx,
  buildFundPoolSolTx,
  buildInitializeProtocolV2Tx,
  buildRegisterOracleTx,
  buildRegisterInviteIssuerTx,
  buildRegisterOutcomeSchemaTx,
  buildRotateGovernanceAuthorityTx,
  buildSetPoolOraclePolicyTx,
  buildSetPoolOracleTx,
  buildSetPolicySeriesOutcomeRuleTx,
  buildVerifyOutcomeSchemaTx,
  MEMBERSHIP_MODE_INVITE_ONLY,
  MEMBERSHIP_MODE_OPEN,
  MEMBERSHIP_MODE_TOKEN_GATE,
  PLAN_MODE_REWARD,
  POLICY_SERIES_STATUS_ACTIVE,
  SPONSOR_MODE_DIRECT,
  deriveConfigV2Pda,
  deriveInviteIssuerPda,
  deriveMembershipPda,
  deriveOraclePda,
  derivePoolOraclePda,
  derivePoolOraclePolicyPda,
  derivePoolPda,
  derivePolicySeriesPda,
  derivePoolRulePda,
  deriveSchemaPda,
  getProgramId,
  hashStringTo32Hex,
} = protocolModule as unknown as typeof import('../frontend/lib/protocol.ts');

type BoolLike = string | undefined;
const ZERO_PUBKEY = '11111111111111111111111111111111';

function asBool(value: BoolLike, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
}

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseCsvList(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readConfigGovernanceAuthority(data: Buffer): PublicKey | null {
  // Anchor account layout: 8 discriminator + 32 admin + 32 governance_authority + ...
  if (data.length < 72) return null;
  return new PublicKey(data.subarray(40, 72));
}

function parseU16(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid ${name}: expected integer 0..65535`);
  }
  return parsed;
}

function parseU8(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 255) {
    throw new Error(`Invalid ${name}: expected integer 0..255`);
  }
  return parsed;
}

function parseU64(name: string, fallback: bigint): bigint {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    if (parsed < 0n) throw new Error('negative');
    return parsed;
  } catch {
    throw new Error(`Invalid ${name}: expected unsigned integer`);
  }
}

function parseI64(name: string, fallback: bigint): bigint {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    if (parsed < BigInt('-9223372036854775808') || parsed > BigInt('9223372036854775807')) {
      throw new Error('out-of-range');
    }
    return parsed;
  } catch {
    throw new Error(`Invalid ${name}: expected signed 64-bit integer`);
  }
}

function parseMembershipMode(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === '0' || normalized === 'open') return MEMBERSHIP_MODE_OPEN;
  if (normalized === '1' || normalized === 'token' || normalized === 'token_gate') return MEMBERSHIP_MODE_TOKEN_GATE;
  if (normalized === '2' || normalized === 'invite' || normalized === 'invite_only') return MEMBERSHIP_MODE_INVITE_ONLY;
  throw new Error(`Invalid MEMBERSHIP_MODE: ${value}`);
}

function keypairFromBase58Env(name: string): Keypair {
  const encoded = requireEnv(name);
  const bytes = bs58.decode(encoded);
  return Keypair.fromSecretKey(bytes);
}

function parseNonZeroPubkey(raw: string, label: string): PublicKey {
  let parsed: PublicKey;
  try {
    parsed = new PublicKey(raw.trim());
  } catch {
    throw new Error(`${label} must be a valid public key.`);
  }
  if (parsed.equals(PublicKey.default)) {
    throw new Error(`${label} must be a non-zero public key.`);
  }
  return parsed;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(source[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function schemaMetadataFilePath(explicit: string): string | null {
  const candidates = [
    explicit ? resolve(process.cwd(), explicit) : '',
    resolve(process.cwd(), 'frontend/public/schemas/health_outcomes.json'),
    resolve(process.cwd(), 'public/schemas/health_outcomes.json'),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function schemaHashHexFromFile(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return sha256Hex(stableStringify(parsed));
}

async function sendAndConfirm(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
  label: string,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.partialSign(...signers);
  const signature = await connection.sendRawTransaction(
    tx.serialize({ requireAllSignatures: true, verifySignatures: true }),
    { skipPreflight: false, maxRetries: 3 },
  );
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log(`[bootstrap-v2] ${label}: ${signature}`);
  return signature;
}

async function ensureSignerFunding(params: {
  connection: Connection;
  payer: Keypair;
  target: PublicKey;
  minLamports: bigint;
  label: string;
}): Promise<void> {
  if (params.minLamports <= 0n) return;
  const current = BigInt(await params.connection.getBalance(params.target, 'confirmed'));
  if (current >= params.minLamports) return;

  const delta = params.minLamports - current;
  if (delta > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Funding delta for ${params.label} exceeds safe transaction range`);
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: params.payer.publicKey,
      toPubkey: params.target,
      lamports: Number(delta),
    }),
  );
  tx.feePayer = params.payer.publicKey;
  await sendAndConfirm(params.connection, tx, [params.payer], `fund_${params.label}`);
}

function base58Candidate(output: string): string {
  const candidates = output.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? [];
  if (candidates.length === 0) {
    throw new Error(`Unable to parse public key from command output: ${output}`);
  }
  return candidates[0]!;
}

function runSplToken(args: string[]): string {
  return execFileSync('spl-token', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function splTokenAccountAddress(params: { mint: string; owner: string }): string {
  const out = runSplToken([
    'address',
    '--verbose',
    '--token',
    params.mint,
    '--owner',
    params.owner,
  ]);
  const match = out.match(/Associated token address:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/);
  if (!match) {
    throw new Error(`Unable to parse associated token address from output: ${out}`);
  }
  return match[1]!;
}

function ensureSplTokenAccount(params: {
  mint: string;
  owner: string;
  rpcUrl: string;
  feePayerPath: string;
}): { account: string; created: boolean } {
  const ata = splTokenAccountAddress({
    mint: params.mint,
    owner: params.owner,
  });
  try {
    const out = runSplToken([
      'create-account',
      params.mint,
      '--url',
      params.rpcUrl,
      '--fee-payer',
      params.feePayerPath,
      '--owner',
      params.owner,
    ]);
    return {
      account: base58Candidate(out),
      created: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('already exists')) {
      return {
        account: ata,
        created: false,
      };
    }
    throw error;
  }
}

function createTempKeypairFile(keypair: Keypair, prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'omegax-protocol-'));
  const file = join(dir, `${prefix}.json`);
  writeFileSync(file, JSON.stringify(Array.from(keypair.secretKey)));
  return file;
}

async function createDevnetTokenGateMint(params: {
  rpcUrl: string;
  governance: Keypair;
  member: PublicKey;
  providedMint?: string;
  initialMemberAmount: string;
}): Promise<{
  mint: string;
  memberTokenAccount: string;
  governanceTokenAccount: string;
  tempFiles: string[];
}> {
  const tempFiles: string[] = [];
  const governancePath = createTempKeypairFile(params.governance, 'governance');
  tempFiles.push(governancePath);

  const mint = params.providedMint || (() => {
    const out = runSplToken([
      'create-token',
      '--url',
      params.rpcUrl,
      '--fee-payer',
      governancePath,
      '--mint-authority',
      params.governance.publicKey.toBase58(),
      '--decimals',
      '0',
    ]);
    return base58Candidate(out);
  })();

  const governanceTokenAccountInfo = ensureSplTokenAccount({
    mint,
    owner: params.governance.publicKey.toBase58(),
    rpcUrl: params.rpcUrl,
    feePayerPath: governancePath,
  });

  const memberTokenAccountInfo = ensureSplTokenAccount({
    mint,
    owner: params.member.toBase58(),
    rpcUrl: params.rpcUrl,
    feePayerPath: governancePath,
  });

  if (!params.providedMint || memberTokenAccountInfo.created) {
    runSplToken([
      'mint',
      mint,
      params.initialMemberAmount,
      memberTokenAccountInfo.account,
      '--url',
      params.rpcUrl,
      '--fee-payer',
      governancePath,
      '--mint-authority',
      governancePath,
    ]);
  }

  return {
    mint,
    memberTokenAccount: memberTokenAccountInfo.account,
    governanceTokenAccount: governanceTokenAccountInfo.account,
    tempFiles,
  };
}

async function main() {
  const rpcUrl = String(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  ).trim();
  const programIdRaw = String(process.env.PROTOCOL_PROGRAM_ID || 'Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B').trim();
  process.env.NEXT_PUBLIC_PROTOCOL_PROGRAM_ID = programIdRaw;

  const poolId = String(process.env.POOL_ID || 'omegax-holder-pool').trim();
  const organizationRef = String(process.env.ORG_REF || 'omegax').trim();
  const membershipMode = parseMembershipMode(String(process.env.MEMBERSHIP_MODE || 'token_gate'));
  const protocolFeeBps = parseU16('PROTOCOL_FEE_BPS', 0);
  const payoutLamportsPerPass = parseU64('PAYOUT_LAMPORTS_PER_PASS', 1_000_000n);
  const tokenGateMinBalance = parseU64('TOKEN_GATE_MIN_BALANCE', 1n);
  const fundLamports = parseU64('FUND_POOL_LAMPORTS', 10_000_000n);
  const oracleMetadataUri = String(process.env.ORACLE_METADATA_URI || 'https://oracle.omegax.health/metadata').trim();
  const inviteIssuerMetadataUri = String(process.env.INVITE_ISSUER_METADATA_URI || 'https://protocol.omegax.health/invite-issuer').trim();
  const inviteId = String(process.env.INVITE_ID || `${poolId}:invite`).trim();
  const invitePermitWindowSeconds = parseI64('INVITE_PERMIT_WINDOW_SECS', 3600n);

  const schemaKey = String(process.env.SCHEMA_KEY || 'omegax.standard.health_outcomes').trim();
  const schemaVersion = parseU16('SCHEMA_VERSION', 1);
  const schemaMetadataUri = String(process.env.SCHEMA_METADATA_URI || 'https://omegax.health/schemas/health_outcomes.json').trim();
  const schemaMetadataFile = schemaMetadataFilePath(String(process.env.SCHEMA_METADATA_FILE || '').trim());
  const ruleId = String(process.env.RULE_ID || 'steps_avg_7d_ge_7000').trim();
  const canonicalRuleIds = Array.from(
    new Set([ruleId, ...parseCsvList(process.env.SEEKER_CANONICAL_RULE_IDS)]),
  );
  const policySeriesRefHashHex = String(process.env.POLICY_SERIES_REF_HASH_HEX || '').trim()
    || await hashStringTo32Hex(`${poolId}:primary-series`);
  const policySeriesDisplayName = String(
    process.env.POLICY_SERIES_DISPLAY_NAME || `${organizationRef} Primary Series`,
  ).trim();
  const policySeriesMetadataUri = String(
    process.env.POLICY_SERIES_METADATA_URI || 'https://protocol.omegax.health/policy-series/default',
  ).trim();
  const policySeriesStatus = parseU8('POLICY_SERIES_STATUS', POLICY_SERIES_STATUS_ACTIVE);
  const policySeriesPlanMode = parseU8('POLICY_SERIES_PLAN_MODE', PLAN_MODE_REWARD);
  const policySeriesSponsorMode = parseU8('POLICY_SERIES_SPONSOR_MODE', SPONSOR_MODE_DIRECT);
  const policySeriesDurationSecs = parseI64('POLICY_SERIES_DURATION_SECS', 365n * 86_400n);
  const policySeriesPremiumDueEverySecs = parseI64('POLICY_SERIES_PREMIUM_DUE_EVERY_SECS', 30n * 86_400n);
  const policySeriesPremiumGraceSecs = parseI64('POLICY_SERIES_PREMIUM_GRACE_SECS', 7n * 86_400n);
  const policySeriesPremiumAmount = parseU64('POLICY_SERIES_PREMIUM_AMOUNT', 1n);
  const policySeriesTermsVersion = parseU16('POLICY_SERIES_TERMS_VERSION', 1);
  const policySeriesMappingVersion = parseU16('POLICY_SERIES_MAPPING_VERSION', 0);

  const governanceRealm = String(process.env.GOVERNANCE_REALM || '11111111111111111111111111111111').trim();
  const governanceConfig = String(process.env.GOVERNANCE_CONFIG || '11111111111111111111111111111111').trim();
  const governanceTokenMint = String(process.env.GOVERNANCE_TOKEN_MINT || '').trim();
  const governanceAuthorityOverride = String(process.env.ROTATE_GOVERNANCE_TO || '').trim();
  const autoRotateToGovernanceConfig = asBool(process.env.AUTO_ROTATE_TO_GOVERNANCE_CONFIG, true);
  const requireGovernanceHandoff = asBool(process.env.REQUIRE_GOVERNANCE_HANDOFF, true);

  const shouldInitialize = asBool(process.env.INITIALIZE_PROTOCOL, true);
  const shouldRegisterOracle = asBool(process.env.REGISTER_ORACLE, true);
  const shouldRegisterInviteIssuer = asBool(process.env.REGISTER_INVITE_ISSUER, membershipMode === MEMBERSHIP_MODE_INVITE_ONLY);
  const shouldCreatePool = asBool(process.env.CREATE_POOL, true);
  const shouldApproveOracle = asBool(process.env.APPROVE_ORACLE, true);
  const shouldSetPolicy = asBool(process.env.SET_ORACLE_POLICY, true);
  const shouldRegisterSchema = asBool(process.env.REGISTER_SCHEMA, true);
  const shouldVerifySchema = asBool(process.env.VERIFY_SCHEMA, true);
  const shouldCreatePolicySeries = asBool(process.env.CREATE_POLICY_SERIES, true);
  const shouldSetRule = asBool(process.env.SET_RULE, true);
  const shouldEnrollMember = asBool(process.env.ENROLL_MEMBER, true);
  const shouldFundPool = asBool(process.env.FUND_POOL, true);
  const oracleMinLamports = parseU64('ORACLE_MIN_LAMPORTS', 5_000_000n);
  const memberMinLamports = parseU64('MEMBER_MIN_LAMPORTS', 5_000_000n);

  const governance = keypairFromBase58Env('GOVERNANCE_SECRET_KEY_BASE58');
  const oracle = keypairFromBase58Env('ORACLE_SECRET_KEY_BASE58');
  const member = keypairFromBase58Env('MEMBER_SECRET_KEY_BASE58');

  const connection = new Connection(rpcUrl, 'confirmed');
  const programId = getProgramId();

  if (programId.toBase58() !== programIdRaw) {
    throw new Error(`Program id mismatch between env and frontend contract: ${programIdRaw} vs ${programId.toBase58()}`);
  }

  const configV2Pda = deriveConfigV2Pda(programId);
  const poolPda = derivePoolPda({
    programId,
    authority: governance.publicKey,
    poolId,
  });
  const oracleEntryPda = deriveOraclePda({ programId, oracle: oracle.publicKey });
  const poolOraclePda = derivePoolOraclePda({ programId, poolAddress: poolPda, oracle: oracle.publicKey });
  const oraclePolicyPda = derivePoolOraclePolicyPda({ programId, poolAddress: poolPda });

  const schemaKeyHashSeed = `schema:${schemaKey}:v${schemaVersion}`;
  const schemaKeyHashHex = String(process.env.SCHEMA_KEY_HASH_HEX || '').trim() || await hashStringTo32Hex(schemaKeyHashSeed);
  const schemaHashHex = String(process.env.SCHEMA_HASH_HEX || '').trim()
    || (schemaMetadataFile ? schemaHashHexFromFile(schemaMetadataFile) : await hashStringTo32Hex(`${schemaKey}:${schemaVersion}`));
  const ruleDefinitions = await Promise.all(
    canonicalRuleIds.map(async (candidateRuleId, index) => ({
      ruleId: candidateRuleId,
      ruleHashHex:
        index === 0
          ? String(process.env.RULE_HASH_HEX || '').trim() || await hashStringTo32Hex(candidateRuleId)
          : await hashStringTo32Hex(candidateRuleId),
      payoutHashHex:
        index === 0
          ? String(process.env.PAYOUT_HASH_HEX || '').trim() || await hashStringTo32Hex(`${candidateRuleId}:payout`)
          : await hashStringTo32Hex(`${candidateRuleId}:payout`),
    })),
  );
  const primaryRule = ruleDefinitions[0]!;
  const ruleHashHex = primaryRule.ruleHashHex;
  const payoutHashHex = primaryRule.payoutHashHex;

  if (!process.env.SCHEMA_HASH_HEX && !schemaMetadataFile) {
    console.warn('[bootstrap] SCHEMA_METADATA_FILE not found; falling back to sha256(schema_key:schema_version).');
  }
  if (!process.env.SCHEMA_HASH_HEX && schemaMetadataFile) {
    console.log(`[bootstrap] schema hash computed from metadata file: ${schemaMetadataFile}`);
  }

  const schemaPda = deriveSchemaPda({
    programId,
    schemaKeyHash: Buffer.from(schemaKeyHashHex, 'hex'),
  });
  const rulePda = derivePoolRulePda({
    programId,
    poolAddress: poolPda,
    seriesRefHash: Buffer.from(policySeriesRefHashHex, 'hex'),
    ruleHash: Buffer.from(ruleHashHex, 'hex'),
  });
  const policySeriesPda = derivePolicySeriesPda({
    programId,
    poolAddress: poolPda,
    seriesRefHash: Buffer.from(policySeriesRefHashHex, 'hex'),
  });
  const membershipPda = deriveMembershipPda({
    programId,
    poolAddress: poolPda,
    member: member.publicKey,
  });
  const inviteIssuerPda = deriveInviteIssuerPda({
    programId,
    issuer: governance.publicKey,
  });
  const governanceConfigTarget = governanceConfig !== ZERO_PUBKEY
    ? parseNonZeroPubkey(governanceConfig, 'GOVERNANCE_CONFIG')
    : null;
  const governanceAuthorityTarget = governanceAuthorityOverride
    ? parseNonZeroPubkey(governanceAuthorityOverride, 'ROTATE_GOVERNANCE_TO')
    : (autoRotateToGovernanceConfig ? governanceConfigTarget : null);

  if (requireGovernanceHandoff) {
    if (!governanceAuthorityTarget) {
      throw new Error(
        'Governance handoff target is missing. Set non-zero GOVERNANCE_CONFIG or ROTATE_GOVERNANCE_TO, or disable REQUIRE_GOVERNANCE_HANDOFF for local-only testing.',
      );
    }
    if (governanceConfigTarget && !governanceAuthorityTarget.equals(governanceConfigTarget)) {
      throw new Error(
        `Governance handoff target (${governanceAuthorityTarget.toBase58()}) must match GOVERNANCE_CONFIG (${governanceConfigTarget.toBase58()}) while REQUIRE_GOVERNANCE_HANDOFF=true.`,
      );
    }
  }

  const tempFiles: string[] = [];
  let tokenGateMint = String(process.env.TOKEN_GATE_MINT || '').trim();
  let memberTokenAccount = String(process.env.TOKEN_GATE_MEMBER_ACCOUNT || '').trim();
  let governanceTokenAccount = String(process.env.TOKEN_GATE_GOVERNANCE_ACCOUNT || '').trim();
  try {
    if (shouldInitialize) {
      // Prevent initializing governance metadata with zeroed placeholders.
      parseNonZeroPubkey(governanceRealm, 'GOVERNANCE_REALM');
      parseNonZeroPubkey(governanceConfig, 'GOVERNANCE_CONFIG');
    }

    await ensureSignerFunding({
      connection,
      payer: governance,
      target: oracle.publicKey,
      minLamports: oracleMinLamports,
      label: 'oracle_signer',
    });
    await ensureSignerFunding({
      connection,
      payer: governance,
      target: member.publicKey,
      minLamports: memberMinLamports,
      label: 'member_signer',
    });

    const existingPoolBeforeBootstrap = await connection.getAccountInfo(poolPda, 'confirmed');
    const existingMembershipBeforeBootstrap = await connection.getAccountInfo(membershipPda, 'confirmed');
    const tokenGateMode = membershipMode === MEMBERSHIP_MODE_TOKEN_GATE;
    const needsTokenGate = tokenGateMode && (
      (shouldCreatePool && !existingPoolBeforeBootstrap)
      || (shouldEnrollMember && !existingMembershipBeforeBootstrap)
    );

    if ((needsTokenGate || tokenGateMint) && tokenGateMode) {
      const tokenGate = await createDevnetTokenGateMint({
        rpcUrl,
        governance,
        member: member.publicKey,
        providedMint: tokenGateMint || undefined,
        initialMemberAmount: String(process.env.TOKEN_GATE_MEMBER_AMOUNT || '1000').trim(),
      });
      tempFiles.push(...tokenGate.tempFiles);
      tokenGateMint = tokenGate.mint;
      memberTokenAccount = tokenGate.memberTokenAccount;
      governanceTokenAccount = tokenGate.governanceTokenAccount;
    }

    if (shouldInitialize) {
      const existingConfig = await connection.getAccountInfo(configV2Pda, 'confirmed');
      if (!existingConfig) {
        const tx = buildInitializeProtocolV2Tx({
          admin: governance.publicKey,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
          protocolFeeBps,
          governanceRealm,
          governanceConfig,
          defaultStakeMint: ZERO_PUBKEY,
          minOracleStake: 0n,
        });
        await sendAndConfirm(connection, tx, [governance], 'initialize_protocol_v2');
      } else {
        console.log('[bootstrap-v2] initialize_protocol_v2: already initialized');
      }
    }

    if (shouldRegisterOracle) {
      const existingOracle = await connection.getAccountInfo(oracleEntryPda, 'confirmed');
      if (!existingOracle) {
        const tx = buildRegisterOracleTx({
          oracle: oracle.publicKey,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
          metadataUri: oracleMetadataUri,
        });
        await sendAndConfirm(connection, tx, [oracle], 'register_oracle');
      } else {
        console.log('[bootstrap-v2] register_oracle: already exists');
      }
    }

    if (shouldRegisterInviteIssuer && membershipMode === MEMBERSHIP_MODE_INVITE_ONLY) {
      const existingInviteIssuer = await connection.getAccountInfo(inviteIssuerPda, 'confirmed');
      if (!existingInviteIssuer) {
        const tx = buildRegisterInviteIssuerTx({
          issuer: governance.publicKey,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
          organizationRef,
          metadataUri: inviteIssuerMetadataUri,
          active: true,
        });
        await sendAndConfirm(connection, tx, [governance], 'register_invite_issuer');
      } else {
        console.log('[bootstrap-v2] register_invite_issuer: already exists');
      }
    }

    if (shouldCreatePool) {
      const existingPool = await connection.getAccountInfo(poolPda, 'confirmed');
      if (!existingPool) {
        const built = buildCreatePoolV2Tx({
          authority: governance.publicKey,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
          poolId,
          organizationRef,
          payoutLamportsPerPass,
          membershipMode,
          tokenGateMint: tokenGateMint || ZERO_PUBKEY,
          tokenGateMinBalance: membershipMode === MEMBERSHIP_MODE_TOKEN_GATE ? tokenGateMinBalance : 0n,
          inviteIssuer: membershipMode === MEMBERSHIP_MODE_INVITE_ONLY ? governance.publicKey.toBase58() : ZERO_PUBKEY,
          metadataUri: String(process.env.POOL_METADATA_URI || 'https://protocol.omegax.health/pools/holder').trim(),
          termsHashHex: String(process.env.TERMS_HASH_HEX || '').trim() || await hashStringTo32Hex(`${poolId}:terms`),
          payoutPolicyHashHex: String(process.env.PAYOUT_POLICY_HASH_HEX || '').trim() || await hashStringTo32Hex(`${poolId}:payout-policy`),
        });
        await sendAndConfirm(connection, built.tx, [governance], 'create_pool_v2');
      } else {
        console.log('[bootstrap-v2] create_pool_v2: pool already exists');
      }
    }

    if (shouldApproveOracle) {
      const existingApproval = await connection.getAccountInfo(poolOraclePda, 'confirmed');
      if (!existingApproval) {
        const tx = buildSetPoolOracleTx({
          authority: governance.publicKey,
          poolAddress: poolPda,
          oracle: oracle.publicKey,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
          active: true,
        });
        await sendAndConfirm(connection, tx, [governance], 'set_pool_oracle(active=true)');
      } else {
        console.log('[bootstrap-v2] set_pool_oracle: already approved');
      }
    }

    if (shouldSetPolicy) {
      const tx = buildSetPoolOraclePolicyTx({
        authority: governance.publicKey,
        poolAddress: poolPda,
        recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
        quorumM: 1,
        quorumN: 1,
        requireVerifiedSchema: true,
        allowDelegateClaim: false,
      });
      await sendAndConfirm(connection, tx, [governance], 'set_pool_oracle_policy');
    }

    if (shouldRegisterSchema) {
      const existingSchema = await connection.getAccountInfo(schemaPda, 'confirmed');
      if (!existingSchema) {
        const tx = buildRegisterOutcomeSchemaTx({
          publisher: governance.publicKey,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
          schemaKeyHashHex,
          schemaKey,
          version: schemaVersion,
          schemaHashHex,
          metadataUri: schemaMetadataUri,
        });
        await sendAndConfirm(connection, tx, [governance], 'register_outcome_schema');
      } else {
        console.log('[bootstrap-v2] register_outcome_schema: already exists');
      }
    }

    if (shouldVerifySchema) {
      const tx = buildVerifyOutcomeSchemaTx({
        governanceAuthority: governance.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
        schemaKeyHashHex,
        verified: true,
      });
      try {
        await sendAndConfirm(connection, tx, [governance], 'verify_outcome_schema');
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (message.includes('GovernanceUnauthorized')) {
          console.log('[bootstrap-v2] verify_outcome_schema: skipped (governance authority is no longer deploy signer)');
        } else {
          throw cause;
        }
      }
    }

    if (shouldCreatePolicySeries) {
      const existingPolicySeries = await connection.getAccountInfo(policySeriesPda, 'confirmed');
      if (!existingPolicySeries) {
        const policySeriesTermsHashHex = String(process.env.TERMS_HASH_HEX || '').trim()
          || await hashStringTo32Hex(`${poolId}:terms`);
        const tx = buildCreatePolicySeriesTx({
          authority: governance.publicKey,
          poolAddress: poolPda,
          seriesRefHashHex: policySeriesRefHashHex,
          status: policySeriesStatus,
          planMode: policySeriesPlanMode,
          sponsorMode: policySeriesSponsorMode,
          displayName: policySeriesDisplayName,
          metadataUri: policySeriesMetadataUri,
          termsHashHex: policySeriesTermsHashHex,
          durationSecs: policySeriesDurationSecs,
          premiumDueEverySecs: policySeriesPremiumDueEverySecs,
          premiumGraceSecs: policySeriesPremiumGraceSecs,
          premiumAmount: policySeriesPremiumAmount,
          termsVersion: policySeriesTermsVersion,
          mappingVersion: policySeriesMappingVersion,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
        });
        await sendAndConfirm(connection, tx, [governance], 'create_policy_series');
      } else {
        console.log('[bootstrap-v2] create_policy_series: already exists');
      }
    }

    if (shouldSetRule) {
      for (const ruleDefinition of ruleDefinitions) {
        const candidateRulePda = derivePoolRulePda({
          programId,
          poolAddress: poolPda,
          seriesRefHash: Buffer.from(policySeriesRefHashHex, 'hex'),
          ruleHash: Buffer.from(ruleDefinition.ruleHashHex, 'hex'),
        });
        const existingRule = await connection.getAccountInfo(candidateRulePda, 'confirmed');
        if (!existingRule) {
          const tx = buildSetPolicySeriesOutcomeRuleTx({
            authority: governance.publicKey,
            poolAddress: poolPda,
            seriesRefHashHex: policySeriesRefHashHex,
            recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
            ruleHashHex: ruleDefinition.ruleHashHex,
            schemaKeyHashHex,
            ruleId: ruleDefinition.ruleId,
            schemaKey,
            schemaVersion,
            payoutHashHex: ruleDefinition.payoutHashHex,
            enabled: true,
          });
          await sendAndConfirm(
            connection,
            tx,
            [governance],
            `set_policy_series_outcome_rule_${ruleDefinition.ruleId}`,
          );
        } else {
          console.log(`[bootstrap-v2] set_policy_series_outcome_rule_${ruleDefinition.ruleId}: already exists`);
        }
      }
    }

    if (shouldEnrollMember) {
      const existingMembership = await connection.getAccountInfo(membershipPda, 'confirmed');
      if (!existingMembership) {
        if (membershipMode === MEMBERSHIP_MODE_OPEN) {
          const tx = buildEnrollMemberOpenTx({
            member: member.publicKey,
            poolAddress: poolPda,
            recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
            subjectCommitmentHex: String(process.env.SUBJECT_COMMITMENT_HEX || '').trim() || undefined,
          });
          await sendAndConfirm(connection, tx, [member], 'enroll_member_open');
        } else if (membershipMode === MEMBERSHIP_MODE_TOKEN_GATE) {
          if (!memberTokenAccount) {
            throw new Error('Missing member token account. Set TOKEN_GATE_MEMBER_ACCOUNT or allow bootstrap mint creation.');
          }
          const tx = buildEnrollMemberTokenGateTx({
            member: member.publicKey,
            poolAddress: poolPda,
            tokenGateAccount: new PublicKey(memberTokenAccount),
            recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
            subjectCommitmentHex: String(process.env.SUBJECT_COMMITMENT_HEX || '').trim() || undefined,
          });
          await sendAndConfirm(connection, tx, [member], 'enroll_member_token_gate');
        } else {
          const nonceHashHex = String(process.env.INVITE_NONCE_HASH_HEX || '').trim()
            || await hashStringTo32Hex(`${member.publicKey.toBase58()}:${Date.now()}:invite_nonce`);
          const inviteIdHashHex = String(process.env.INVITE_ID_HASH_HEX || '').trim()
            || await hashStringTo32Hex(inviteId);
          const nowTs = BigInt(Math.floor(Date.now() / 1000));
          const expiresAtTs = parseI64('INVITE_EXPIRES_AT_TS', nowTs + invitePermitWindowSeconds);
          const tx = buildEnrollMemberInvitePermitTx({
            member: member.publicKey,
            poolAddress: poolPda,
            issuer: governance.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
            subjectCommitmentHex: String(process.env.SUBJECT_COMMITMENT_HEX || '').trim() || undefined,
            nonceHashHex,
            inviteIdHashHex,
            expiresAtTs,
          });
          await sendAndConfirm(connection, tx, [member, governance], 'enroll_member_invite_permit');
        }
      } else {
        console.log('[bootstrap-v2] member_enrollment: already enrolled');
      }
    }

    if (shouldFundPool && fundLamports > 0n) {
      const tx = buildFundPoolSolTx({
        funder: governance.publicKey,
        poolAddress: poolPda,
        recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
        lamports: fundLamports,
      });
      await sendAndConfirm(connection, tx, [governance], 'fund_pool_sol');
    }

    if (governanceAuthorityTarget) {
      const configInfo = await connection.getAccountInfo(configV2Pda, 'confirmed');
      const currentAuthority = configInfo?.data ? readConfigGovernanceAuthority(configInfo.data) : null;
      if (!currentAuthority) {
        throw new Error('Unable to read governance authority from config account.');
      }
      if (!currentAuthority.equals(governanceAuthorityTarget)) {
        const tx = buildRotateGovernanceAuthorityTx({
          governanceAuthority: governance.publicKey,
          newAuthority: governanceAuthorityTarget,
          recentBlockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
        });
        await sendAndConfirm(connection, tx, [governance], 'rotate_governance_authority');
      } else {
        console.log('[bootstrap-v2] rotate_governance_authority: already configured');
      }
    }

    console.log('');
    console.log('[bootstrap-v2] Complete');
    console.log(`[bootstrap-v2] rpc_url=${rpcUrl}`);
    console.log(`[bootstrap-v2] program_id=${programId.toBase58()}`);
    console.log(`[bootstrap-v2] governance=${governance.publicKey.toBase58()}`);
    console.log(`[bootstrap-v2] governance_realm=${governanceRealm}`);
    console.log(`[bootstrap-v2] governance_config=${governanceConfig}`);
    console.log(`[bootstrap-v2] require_governance_handoff=${requireGovernanceHandoff}`);
    console.log(`[bootstrap-v2] auto_rotate_to_governance_config=${autoRotateToGovernanceConfig}`);
    console.log(`[bootstrap-v2] oracle=${oracle.publicKey.toBase58()}`);
    console.log(`[bootstrap-v2] member=${member.publicKey.toBase58()}`);
    console.log(`[bootstrap-v2] config_v2_pda=${configV2Pda.toBase58()}`);
    console.log(`[bootstrap-v2] pool_pda=${poolPda.toBase58()}`);
    console.log(`[bootstrap-v2] oracle_entry_pda=${oracleEntryPda.toBase58()}`);
    console.log(`[bootstrap-v2] pool_oracle_pda=${poolOraclePda.toBase58()}`);
    console.log(`[bootstrap-v2] oracle_policy_pda=${oraclePolicyPda.toBase58()}`);
    console.log(`[bootstrap-v2] schema_pda=${schemaPda.toBase58()}`);
    console.log(`[bootstrap-v2] rule_pda=${rulePda.toBase58()}`);
    console.log(`[bootstrap-v2] invite_issuer_pda=${inviteIssuerPda.toBase58()}`);
    console.log(`[bootstrap-v2] membership_mode=${membershipMode}`);
    console.log(`[bootstrap-v2] token_gate_mint=${tokenGateMint}`);
    console.log(`[bootstrap-v2] governance_token_mint=${governanceTokenMint || tokenGateMint}`);
    console.log(`[bootstrap-v2] member_token_account=${memberTokenAccount}`);
    console.log(`[bootstrap-v2] governance_token_account=${governanceTokenAccount}`);
    console.log(`[bootstrap-v2] schema_key_hash_hex=${schemaKeyHashHex}`);
    console.log(`[bootstrap-v2] rule_hash_hex=${ruleHashHex}`);
    console.log(`[bootstrap-v2] canonical_rule_ids=${canonicalRuleIds.join(',')}`);
    if (governanceAuthorityTarget) {
      console.log(`[bootstrap-v2] governance_authority_rotated_to=${governanceAuthorityTarget.toBase58()}`);
    }
  } finally {
    for (const file of tempFiles) {
      try {
        rmSync(file, { force: true });
      } catch {
        // ignore cleanup errors
      }
      try {
        rmSync(dirname(file), { force: true, recursive: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[bootstrap-v2] failed: ${message}`);
  process.exit(1);
});
