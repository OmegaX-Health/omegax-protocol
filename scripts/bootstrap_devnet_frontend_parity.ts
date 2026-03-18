// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  mintTo,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const DEVNET_NATIVE_SOL_RAIL = "SOL";

const FRONTEND_ENV_PATH = resolve(process.cwd(), "frontend/.env.local");
const ROOT_ENV_PATH = resolve(process.cwd(), ".env.local");
const LOCAL_BOOTSTRAP_ENV_PATHS = [
  resolve(process.cwd(), ".env.devnet-frontend-bootstrap.local"),
  resolve(process.cwd(), "frontend/.env.devnet-bootstrap.local"),
];
const EXTRA_BOOTSTRAP_ENV_FILE_ENV = "DEVNET_FRONTEND_BOOTSTRAP_ENV_FILE";
const KEY_DIR = resolve(process.cwd(), ".keys/devnet-parity");
const ZERO_PUBKEY = new PublicKey(protocol.ZERO_PUBKEY);
const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_MIN_ROLE_LAMPORTS = 0.4 * LAMPORTS_PER_SOL;
const DEFAULT_PROTOCOL_FEE_BPS = 300;
const DEFAULT_MIN_ORACLE_STAKE = 1_000_000n;
const DEFAULT_STAKE_MINT_DECIMALS = 6;
const DEFAULT_PAYOUT_MINT_DECIMALS = 6;

type EnvMap = Record<string, string>;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function loadEnvFile(path: string): EnvMap {
  if (!existsSync(path)) {
    return {};
  }
  const source = readFileSync(path, "utf8");
  const out: EnvMap = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    out[key] = value;
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  return out;
}

function updateEnvFile(path: string, updates: EnvMap): void {
  const existing = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
  const lines = [...existing];
  const seen = new Set<string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (!(key in updates)) {
      continue;
    }
    lines[index] = `${key}=${updates[key]}`;
    seen.add(key);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key)) {
      continue;
    }
    lines.push(`${key}=${value}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.filter((line, index, array) => !(line === "" && array[index - 1] === "")).join("\n").trim()}\n`);
}

function loadOptionalEnvFiles(paths: string[]): void {
  for (const path of paths) {
    if (!path || !existsSync(path)) {
      continue;
    }
    loadEnvFile(path);
  }
}

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseOptionalPubkey(value: string | undefined): PublicKey | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === protocol.ZERO_PUBKEY || trimmed === DEVNET_NATIVE_SOL_RAIL) {
    return null;
  }
  return new PublicKey(trimmed);
}

function readKeypairFile(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function writeKeypairFile(path: string, keypair: Keypair): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
}

function keypairFromBase58(encoded: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(encoded.trim()));
}

function defaultGovernanceKeypair(): Keypair {
  return readKeypairFile(resolve(homedir(), ".config/solana/id.json"));
}

function ensurePersistentKeypair(name: string): { keypair: Keypair; path: string } {
  const path = join(KEY_DIR, `${name}.json`);
  if (existsSync(path)) {
    return { keypair: readKeypairFile(path), path };
  }
  const keypair = Keypair.generate();
  writeKeypairFile(path, keypair);
  return { keypair, path };
}

async function sendAndConfirm(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
  label: string,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.partialSign(...signers);
  try {
    const signature = await connection.sendRawTransaction(
      tx.serialize({ requireAllSignatures: true, verifySignatures: true }),
      { skipPreflight: false, maxRetries: 5 },
    );
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    console.log(`[parity-bootstrap] ${label}: ${signature}`);
    return signature;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const logs = typeof error === "object" && error && "transactionLogs" in error
      ? String((error as { transactionLogs?: string[] }).transactionLogs?.join("\n") ?? "")
      : "";
    if (message.includes("InstructionFallbackNotFound") || logs.includes("InstructionFallbackNotFound")) {
      throw new Error(
        `The live devnet program ${protocol.getProgramId().toBase58()} rejected ${label} with InstructionFallbackNotFound. `
        + "That means the deployed binary does not match this repo's current frontend/IDL surface. "
        + "Frontend parity signoff cannot complete until devnet is updated to the current protocol build or the frontend is pointed at the matching program ID.",
      );
    }
    throw error;
  }
}

async function ensureLamports(
  connection: Connection,
  payer: Keypair,
  target: PublicKey,
  minLamports: number,
  label: string,
): Promise<void> {
  const current = await connection.getBalance(target, "confirmed");
  if (current >= minLamports) {
    return;
  }
  const delta = minLamports - current;
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: target,
      lamports: delta,
    }),
  );
  tx.feePayer = payer.publicKey;
  await sendAndConfirm(connection, tx, [payer], `fund_${label}`);
}

async function ensureGovernanceBalance(connection: Connection, governance: Keypair, minLamports: number): Promise<void> {
  const current = await connection.getBalance(governance.publicKey, "confirmed");
  if (current >= minLamports) {
    return;
  }
  const signature = await connection.requestAirdrop(governance.publicKey, minLamports - current);
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  console.log(`[parity-bootstrap] airdrop_governance: ${signature}`);
}

function decodeProtocolConfigRaw(data: Buffer) {
  let offset = 8;
  const readPubkey = () => {
    const value = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    return value;
  };
  const readU16 = () => {
    const value = data.readUInt16LE(offset);
    offset += 2;
    return value;
  };
  const readU64 = () => {
    const value = data.readBigUInt64LE(offset);
    offset += 8;
    return value;
  };
  const readBool = () => {
    const value = data[offset] !== 0;
    offset += 1;
    return value;
  };
  const readBytes = (length: number) => {
    const value = data.subarray(offset, offset + length);
    offset += length;
    return value;
  };
  const readU8 = () => {
    const value = data[offset] ?? 0;
    offset += 1;
    return value;
  };
  return {
    admin: readPubkey(),
    governanceAuthority: readPubkey(),
    governanceRealm: readPubkey(),
    governanceConfig: readPubkey(),
    defaultStakeMint: readPubkey(),
    protocolFeeBps: readU16(),
    minOracleStake: readU64(),
    emergencyPaused: readBool(),
    allowedPayoutMintsHashHex: Buffer.from(readBytes(32)).toString("hex"),
    bump: readU8(),
  };
}

async function assertUsableProtocolConfig(
  connection: Connection,
  protocolConfig: ReturnType<typeof decodeProtocolConfigRaw>,
): Promise<void> {
  const problems: string[] = [];
  if (protocolConfig.governanceRealm.equals(ZERO_PUBKEY)) {
    problems.push("governance realm is still zero");
  }
  if (protocolConfig.governanceConfig.equals(ZERO_PUBKEY)) {
    problems.push("governance config is still zero");
  }
  if (protocolConfig.defaultStakeMint.equals(ZERO_PUBKEY)) {
    problems.push("default stake mint is still zero");
  }
  if (protocolConfig.minOracleStake === 0n) {
    problems.push("minimum oracle stake is still zero");
  }

  if (!protocolConfig.defaultStakeMint.equals(ZERO_PUBKEY)) {
    const stakeMintInfo = await connection.getAccountInfo(protocolConfig.defaultStakeMint, "confirmed");
    if (!stakeMintInfo) {
      problems.push(`default stake mint account ${protocolConfig.defaultStakeMint.toBase58()} is missing`);
    } else if (!stakeMintInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      problems.push(
        `default stake mint account ${protocolConfig.defaultStakeMint.toBase58()} is owned by ${stakeMintInfo.owner.toBase58()} instead of the SPL Token program`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      "Protocol config exists on devnet but is not bootstrapped for parity flows:\n"
      + `- ${problems.join("\n- ")}\n`
      + "Repair the shared devnet config before rerunning parity bootstrap, or rehearse against a fresh non-canonical program id with a newly initialized config.",
    );
  }
}

function protocolConfigNeedsRepair(protocolConfig: ReturnType<typeof decodeProtocolConfigRaw>): boolean {
  return protocolConfig.defaultStakeMint.equals(ZERO_PUBKEY) || protocolConfig.minOracleStake === 0n;
}

async function ensureMintMinimum(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  authority: Keypair,
  minimum: bigint,
  label: string,
): Promise<void> {
  const account = await getAccount(connection, destination, "confirmed");
  if (account.amount >= minimum) {
    return;
  }
  const delta = minimum - account.amount;
  await mintTo(connection, payer, mint, destination, authority, Number(delta));
  console.log(`[parity-bootstrap] mint_${label}: ${delta.toString()}`);
}

async function ensureMintAddress(
  connection: Connection,
  payer: Keypair,
  envVar: string,
  decimals: number,
  stableName?: string,
): Promise<PublicKey> {
  const existing = parseOptionalPubkey(process.env[envVar]);
  if (existing) {
    const info = await connection.getAccountInfo(existing, "confirmed");
    if (info) {
      return existing;
    }
  }
  const mintKeypair = stableName ? ensurePersistentKeypair(`mint-${stableName}`).keypair : null;
  if (mintKeypair) {
    const info = await connection.getAccountInfo(mintKeypair.publicKey, "confirmed");
    if (info) {
      process.env[envVar] = mintKeypair.publicKey.toBase58();
      return mintKeypair.publicKey;
    }
  }
  const mint = await createMint(connection, payer, payer.publicKey, null, decimals, mintKeypair ?? undefined);
  console.log(`[parity-bootstrap] create_mint ${envVar}: ${mint.toBase58()}`);
  process.env[envVar] = mint.toBase58();
  return mint;
}

async function ensureOracleRegistered(params: {
  connection: Connection;
  governance: Keypair;
  oracleSigner: Keypair;
  oracleAdmin: Keypair;
}): Promise<PublicKey> {
  const oracleEntry = protocol.deriveOraclePda({
    programId: protocol.getProgramId(),
    oracle: params.oracleSigner.publicKey,
  });
  const oracleProfile = protocol.deriveOracleProfilePda({
    programId: protocol.getProgramId(),
    oracle: params.oracleSigner.publicKey,
  });
  const [entryInfo, profileInfo] = await Promise.all([
    params.connection.getAccountInfo(oracleEntry, "confirmed"),
    params.connection.getAccountInfo(oracleProfile, "confirmed"),
  ]);
  if (!entryInfo || !profileInfo) {
    const registerTx = protocol.buildRegisterOracleTx({
      admin: params.oracleAdmin.publicKey,
      oracle: params.oracleSigner.publicKey,
      recentBlockhash: (await params.connection.getLatestBlockhash("confirmed")).blockhash,
      oracleType: protocol.ORACLE_TYPE_OTHER,
      displayName: "Frontend Devnet Oracle",
      legalName: "OmegaX Frontend Oracle",
      websiteUrl: "https://omegax.health/oracle",
      appUrl: "https://omegax.health/oracle",
      logoUri: "",
      webhookUrl: "",
      supportedSchemaKeyHashesHex: [],
    });
    await sendAndConfirm(params.connection, registerTx, [params.oracleAdmin], "register_oracle");
    const claimTx = protocol.buildClaimOracleTx({
      oracle: params.oracleSigner.publicKey,
      recentBlockhash: (await params.connection.getLatestBlockhash("confirmed")).blockhash,
    });
    await sendAndConfirm(params.connection, claimTx, [params.oracleSigner], "claim_oracle");
    return params.oracleAdmin.publicKey;
  }
  const metadataTx = protocol.buildUpdateOracleMetadataTx({
    oracle: params.oracleSigner.publicKey,
    recentBlockhash: (await params.connection.getLatestBlockhash("confirmed")).blockhash,
    metadataUri: "https://omegax.health/oracle/frontend-devnet",
    active: true,
  });
  await sendAndConfirm(params.connection, metadataTx, [params.oracleSigner], "update_oracle_metadata");
  return params.oracleSigner.publicKey;
}

async function maybeSend(
  connection: Connection,
  label: string,
  exists: PublicKey,
  txFactory: () => Promise<{ tx: Transaction; signers: Keypair[] }>,
): Promise<void> {
  const info = await connection.getAccountInfo(exists, "confirmed");
  if (info) {
    return;
  }
  const built = await txFactory();
  await sendAndConfirm(connection, built.tx, built.signers, label);
}

async function main() {
  loadEnvFile(FRONTEND_ENV_PATH);
  loadEnvFile(ROOT_ENV_PATH);
  const extraBootstrapEnvFile = String(process.env[EXTRA_BOOTSTRAP_ENV_FILE_ENV] ?? "").trim();
  loadOptionalEnvFiles([
    ...LOCAL_BOOTSTRAP_ENV_PATHS,
    ...(extraBootstrapEnvFile ? [resolve(process.cwd(), extraBootstrapEnvFile)] : []),
  ]);

  const rpcUrl = String(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL
      || process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT
      || DEFAULT_RPC,
  ).trim();
  const connection = new Connection(rpcUrl, "confirmed");

  const governanceRealm = requireEnv("NEXT_PUBLIC_GOVERNANCE_REALM");
  const governanceConfig = requireEnv("NEXT_PUBLIC_GOVERNANCE_CONFIG");

  const governance = process.env.GOVERNANCE_SECRET_KEY_BASE58
    ? keypairFromBase58(process.env.GOVERNANCE_SECRET_KEY_BASE58)
    : defaultGovernanceKeypair();
  const oracleSigner = process.env.ORACLE_SIGNER_SECRET_KEY_BASE58
    ? keypairFromBase58(process.env.ORACLE_SIGNER_SECRET_KEY_BASE58)
    : ensurePersistentKeypair("oracle-signer").keypair;

  const observer = ensurePersistentKeypair("observer").keypair;
  const poolAuthority = ensurePersistentKeypair("pool-authority").keypair;
  const poolOperator = ensurePersistentKeypair("pool-operator").keypair;
  const riskManager = ensurePersistentKeypair("risk-manager").keypair;
  const complianceAuthority = ensurePersistentKeypair("compliance-authority").keypair;
  const guardian = ensurePersistentKeypair("guardian").keypair;
  const oracleAdmin = ensurePersistentKeypair("oracle-admin").keypair;
  const member = ensurePersistentKeypair("member").keypair;
  const claimDelegate = ensurePersistentKeypair("claim-delegate").keypair;
  const capitalProvider = ensurePersistentKeypair("capital-provider").keypair;
  const stakeVault = ensurePersistentKeypair("oracle-stake-vault").keypair;

  const configPda = protocol.deriveConfigPda(protocol.getProgramId());
  const configInfoBefore = await connection.getAccountInfo(configPda, "confirmed");
  let protocolConfig: ReturnType<typeof decodeProtocolConfigRaw> | null = null;
  if (configInfoBefore) {
    protocolConfig = decodeProtocolConfigRaw(Buffer.from(configInfoBefore.data));
  }

  await ensureGovernanceBalance(connection, governance, 4 * LAMPORTS_PER_SOL);
  for (const [label, keypair] of [
    ["oracle-signer", oracleSigner],
    ["observer", observer],
    ["pool-authority", poolAuthority],
    ["pool-operator", poolOperator],
    ["risk-manager", riskManager],
    ["compliance-authority", complianceAuthority],
    ["guardian", guardian],
    ["oracle-admin", oracleAdmin],
    ["member", member],
    ["claim-delegate", claimDelegate],
    ["capital-provider", capitalProvider],
  ] as const) {
    await ensureLamports(connection, governance, keypair.publicKey, DEFAULT_MIN_ROLE_LAMPORTS, label);
  }

  const bootstrapStakeMint = protocolConfig?.defaultStakeMint && !protocolConfig.defaultStakeMint.equals(ZERO_PUBKEY)
    ? protocolConfig.defaultStakeMint
    : await ensureMintAddress(connection, governance, "NEXT_PUBLIC_DEVNET_STAKE_MINT", DEFAULT_STAKE_MINT_DECIMALS, "devnet-stake");
  const coverageMint = await ensureMintAddress(
    connection,
    governance,
    "NEXT_PUBLIC_DEFAULT_INSURANCE_PAYOUT_MINT",
    DEFAULT_PAYOUT_MINT_DECIMALS,
    "coverage-payout",
  );
  const rewardMint = await ensureMintAddress(
    connection,
    governance,
    "NEXT_PUBLIC_DEFAULT_REWARD_PAYOUT_MINT",
    DEFAULT_PAYOUT_MINT_DECIMALS,
    "reward-payout",
  );

  if (!configInfoBefore) {
    const initializeTx = protocol.buildInitializeProtocolTx({
      admin: governance.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      protocolFeeBps: DEFAULT_PROTOCOL_FEE_BPS,
      governanceRealm,
      governanceConfig,
      defaultStakeMint: bootstrapStakeMint.toBase58(),
      minOracleStake: DEFAULT_MIN_ORACLE_STAKE,
    });
    await sendAndConfirm(connection, initializeTx, [governance], "initialize_protocol");
  } else if (protocolConfig && protocolConfigNeedsRepair(protocolConfig)) {
    const repairTx = protocol.buildSetProtocolParamsTx({
      governanceAuthority: governance.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      protocolFeeBps: protocolConfig.protocolFeeBps,
      allowedPayoutMintsHashHex: protocolConfig.allowedPayoutMintsHashHex,
      defaultStakeMint: protocolConfig.defaultStakeMint.equals(ZERO_PUBKEY)
        ? bootstrapStakeMint.toBase58()
        : protocolConfig.defaultStakeMint.toBase58(),
      minOracleStake: protocolConfig.minOracleStake === 0n
        ? DEFAULT_MIN_ORACLE_STAKE
        : protocolConfig.minOracleStake,
      emergencyPaused: protocolConfig.emergencyPaused,
    });
    await sendAndConfirm(connection, repairTx, [governance], "repair_protocol_stake_config");
  }
  const configInfo = await connection.getAccountInfo(configPda, "confirmed");
  if (!configInfo) {
    throw new Error("Protocol config is still missing after initialization.");
  }
  protocolConfig = decodeProtocolConfigRaw(Buffer.from(configInfo.data));
  await assertUsableProtocolConfig(connection, protocolConfig);
  if (!protocolConfig) {
    throw new Error("Protocol config is unavailable after bootstrap.");
  }
  process.env.NEXT_PUBLIC_DEVNET_STAKE_MINT = protocolConfig.defaultStakeMint.toBase58();
  const stakeMint = protocolConfig.defaultStakeMint;

  const oracleAdminWallet = await ensureOracleRegistered({
    connection,
    governance,
    oracleSigner,
    oracleAdmin,
  });

  const slashTreasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    stakeMint,
    governance.publicKey,
  );
  const oracleStakeAta = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    stakeMint,
    oracleSigner.publicKey,
  );
  await ensureMintMinimum(
    connection,
    governance,
    stakeMint,
    oracleStakeAta.address,
    governance,
    protocolConfig.minOracleStake + 500_000n,
    "oracle_stake_balance",
  );

  const stakePosition = protocol.deriveOracleStakePda({
    programId: protocol.getProgramId(),
    oracle: oracleSigner.publicKey,
    staker: oracleSigner.publicKey,
  });
  await maybeSend(connection, "stake_oracle", stakePosition, async () => ({
    tx: protocol.buildStakeOracleTx({
      staker: oracleSigner.publicKey,
      oracle: oracleSigner.publicKey,
      stakeMint: protocolConfig.defaultStakeMint,
      stakeVault: stakeVault.publicKey,
      stakerTokenAccount: oracleStakeAta.address,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      amount: protocolConfig.minOracleStake,
    }),
    signers: [oracleSigner, stakeVault],
  }));

  const poolAuthorityCoverageAta = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    coverageMint,
    poolAuthority.publicKey,
  );
  const memberCoverageAta = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    coverageMint,
    member.publicKey,
  );
  const capitalProviderCoverageAta = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    coverageMint,
    capitalProvider.publicKey,
  );
  await ensureMintMinimum(connection, governance, coverageMint, poolAuthorityCoverageAta.address, governance, 8_000_000n, "pool_authority_coverage");
  await ensureMintMinimum(connection, governance, coverageMint, memberCoverageAta.address, governance, 6_000_000n, "member_coverage");
  await ensureMintMinimum(connection, governance, coverageMint, capitalProviderCoverageAta.address, governance, 6_000_000n, "capital_provider_coverage");

  const poolId = String(process.env.DEVNET_FRONTEND_PARITY_POOL_ID || "frontend-parity-devnet").trim();
  const createPool = protocol.buildCreatePoolTx({
    authority: poolAuthority.publicKey,
    recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    poolId,
    organizationRef: "omegax-frontend-parity",
    payoutLamportsPerPass: 250_000n,
    membershipMode: protocol.MEMBERSHIP_MODE_OPEN,
    tokenGateMint: protocol.ZERO_PUBKEY,
    tokenGateMinBalance: 0n,
    metadataUri: "https://omegax.health/pools/frontend-parity-devnet",
    poolType: protocol.POOL_TYPE_COVERAGE,
    cycleMode: 0,
    termsHashHex: sha256Hex("frontend-parity-devnet:terms"),
    payoutPolicyHashHex: sha256Hex("frontend-parity-devnet:payout-policy"),
    payoutAssetMint: coverageMint.toBase58(),
  });
  const parityPoolAddress = createPool.poolAddress;
  await maybeSend(connection, "create_pool", parityPoolAddress, async () => ({
    tx: createPool.tx,
    signers: [poolAuthority],
  }));

  const controlAuthority = protocol.derivePoolControlAuthorityPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
  });
  await maybeSend(connection, "set_pool_control_authorities", controlAuthority, async () => ({
    tx: protocol.buildSetPoolControlAuthoritiesTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      operatorAuthority: poolOperator.publicKey,
      riskManagerAuthority: riskManager.publicKey,
      complianceAuthority: complianceAuthority.publicKey,
      guardianAuthority: guardian.publicKey,
    }),
    signers: [poolAuthority],
  }));

  const poolOracleApproval = protocol.derivePoolOraclePda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    oracle: oracleSigner.publicKey,
  });
  await maybeSend(connection, "set_pool_oracle", poolOracleApproval, async () => ({
    tx: protocol.buildSetPoolOracleTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      oracle: oracleSigner.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      active: true,
    }),
    signers: [poolAuthority],
  }));

  const poolOraclePolicy = protocol.derivePoolOraclePolicyPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
  });
  await sendAndConfirm(
    connection,
    protocol.buildSetPoolOraclePolicyTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      quorumM: 1,
      quorumN: 1,
      requireVerifiedSchema: false,
      oracleFeeBps: 100,
      allowDelegateClaim: true,
      challengeWindowSecs: 3_600n,
    }),
    [poolAuthority],
    "set_pool_oracle_policy",
  );

  const poolOraclePermissions = protocol.derivePoolOraclePermissionsPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    oracle: oracleSigner.publicKey,
  });
  await sendAndConfirm(
    connection,
    protocol.buildSetPoolOraclePermissionsTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      oracle: oracleSigner.publicKey,
      permissions: protocol.ORACLE_PERMISSION_ALL,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    [poolAuthority],
    "set_pool_oracle_permissions",
  );

  await sendAndConfirm(
    connection,
    protocol.buildSetPoolCoverageReserveFloorTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      paymentMint: coverageMint,
      amount: 100_000n,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    [poolAuthority],
    "set_pool_coverage_reserve_floor",
  );

  await sendAndConfirm(
    connection,
    protocol.buildSetPoolRiskControlsTx({
      authority: riskManager.publicKey,
      poolAddress: parityPoolAddress,
      payoutMint: coverageMint,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      redemptionMode: protocol.POOL_REDEMPTION_MODE_QUEUE_ONLY,
      claimMode: protocol.POOL_CLAIM_MODE_OPEN,
      impaired: false,
      impairmentAmount: 0n,
      includePoolControlAuthority: true,
    }),
    [riskManager],
    "set_pool_risk_controls",
  );

  const providerRefHashHex = sha256Hex("frontend-parity-provider-ref");
  const credentialTypeHashHex = sha256Hex("frontend-parity-credential-type");
  const revocationListHashHex = sha256Hex("frontend-parity-revocations");
  await sendAndConfirm(
    connection,
    protocol.buildSetPoolCompliancePolicyTx({
      authority: complianceAuthority.publicKey,
      poolAddress: parityPoolAddress,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      providerRefHashHex,
      credentialTypeHashHex,
      revocationListHashHex,
      actionsMask:
        protocol.COMPLIANCE_ACTION_ENROLL
        | protocol.COMPLIANCE_ACTION_DEPOSIT
        | protocol.COMPLIANCE_ACTION_REDEEM
        | protocol.COMPLIANCE_ACTION_CLAIM
        | protocol.COMPLIANCE_ACTION_PAYOUT,
      bindingMode: protocol.COMPLIANCE_BINDING_MODE_NONE,
      providerMode: protocol.COMPLIANCE_PROVIDER_MODE_NATIVE,
      capitalRailMode: protocol.RAIL_MODE_ANY,
      payoutRailMode: protocol.RAIL_MODE_ANY,
      active: true,
      includePoolControlAuthority: true,
    }),
    [complianceAuthority],
    "set_pool_compliance_policy",
  );

  await sendAndConfirm(
    connection,
    protocol.buildSetPoolAutomationPolicyTx({
      authority: complianceAuthority.publicKey,
      poolAddress: parityPoolAddress,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      oracleAutomationMode: protocol.AUTOMATION_MODE_ATTESTED,
      claimAutomationMode: protocol.AUTOMATION_MODE_ATTESTED,
      allowedAiRolesMask: protocol.AI_ROLE_ALL_MASK,
      maxAutoClaimAmount: 250_000n,
      requiredAttestationProviderRefHashHex: sha256Hex("frontend-parity-attestation-provider"),
      includePoolControlAuthority: true,
    }),
    [complianceAuthority],
    "set_pool_automation_policy",
  );

  const liquidityConfig = protocol.derivePoolLiquidityConfigPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
  });
  await maybeSend(connection, "initialize_pool_liquidity_spl", liquidityConfig, async () => ({
    tx: protocol.buildInitializePoolLiquiditySplTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      payoutMint: coverageMint,
      authorityPayoutTokenAccount: poolAuthorityCoverageAta.address,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      initialAmount: 5_000_000n,
    }),
    signers: [poolAuthority],
  }));

  const shareMint = protocol.derivePoolShareMintPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
  });
  const capitalClass = protocol.derivePoolCapitalClassPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    shareMint,
  });
  await maybeSend(connection, "register_pool_capital_class", capitalClass, async () => ({
    tx: protocol.buildRegisterPoolCapitalClassTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      classIdHashHex: sha256Hex("frontend-parity-capital-class"),
      classMode: protocol.CAPITAL_CLASS_MODE_NAV,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
      restricted: false,
      redemptionQueueEnabled: true,
      ringFenced: false,
      lockupSecs: 0n,
      redemptionNoticeSecs: 0n,
      vintageIndex: 0,
    }),
    signers: [poolAuthority],
  }));

  for (const [label, wallet] of [
    ["member", member],
    ["capital-provider-member", capitalProvider],
  ] as const) {
    const membership = protocol.deriveMembershipPda({
      programId: protocol.getProgramId(),
      poolAddress: parityPoolAddress,
      member: wallet.publicKey,
    });
    await maybeSend(connection, `enroll_member_open_${label}`, membership, async () => ({
      tx: protocol.buildEnrollMemberOpenTx({
        member: wallet.publicKey,
        poolAddress: parityPoolAddress,
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      }),
      signers: [wallet],
    }));
  }

  const claimDelegateAuth = protocol.deriveClaimDelegatePda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    member: member.publicKey,
  });
  await maybeSend(connection, "set_claim_delegate", claimDelegateAuth, async () => ({
    tx: protocol.buildSetClaimDelegateTx({
      member: member.publicKey,
      poolAddress: parityPoolAddress,
      delegate: claimDelegate.publicKey,
      active: true,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [member],
  }));

  const primarySeriesRefHashHex = sha256Hex("frontend-parity-primary-coverage-series");
  const rewardsSeriesRefHashHex = sha256Hex("frontend-parity-rewards-series");
  const primarySeries = protocol.derivePolicySeriesPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    seriesRefHash: Buffer.from(primarySeriesRefHashHex, "hex"),
  });
  const rewardsSeries = protocol.derivePolicySeriesPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    seriesRefHash: Buffer.from(rewardsSeriesRefHashHex, "hex"),
  });

  await maybeSend(connection, "create_policy_series_primary", primarySeries, async () => ({
    tx: protocol.buildCreatePolicySeriesTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      seriesRefHashHex: primarySeriesRefHashHex,
      status: protocol.POLICY_SERIES_STATUS_ACTIVE,
      planMode: protocol.PLAN_MODE_PROTECTION,
      sponsorMode: protocol.SPONSOR_MODE_DIRECT,
      displayName: "Frontend Parity Coverage",
      metadataUri: "https://omegax.health/policy-series/frontend-parity-coverage",
      termsHashHex: sha256Hex("frontend-parity-primary-coverage-terms"),
      durationSecs: 30n * 86_400n,
      premiumDueEverySecs: 3_600n,
      premiumGraceSecs: 600n,
      premiumAmount: 2_400n,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [poolAuthority],
  }));

  await maybeSend(connection, "create_policy_series_rewards", rewardsSeries, async () => ({
    tx: protocol.buildCreatePolicySeriesTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      seriesRefHashHex: rewardsSeriesRefHashHex,
      status: protocol.POLICY_SERIES_STATUS_ACTIVE,
      planMode: protocol.PLAN_MODE_REWARD,
      sponsorMode: protocol.SPONSOR_MODE_DIRECT,
      displayName: "Frontend Parity Rewards",
      metadataUri: "https://omegax.health/policy-series/frontend-parity-rewards",
      termsHashHex: sha256Hex("frontend-parity-rewards-terms"),
      durationSecs: 30n * 86_400n,
      premiumDueEverySecs: 3_600n,
      premiumGraceSecs: 600n,
      premiumAmount: 1_200n,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [poolAuthority],
  }));

  for (const [label, seriesRefHashHex, paymentMint, paymentAmount] of [
    ["coverage-sol", primarySeriesRefHashHex, ZERO_PUBKEY, 1_000_000n],
    ["coverage-spl", primarySeriesRefHashHex, coverageMint, 2_400n],
    ["rewards-spl", rewardsSeriesRefHashHex, rewardMint, 1_200n],
  ] as const) {
    await sendAndConfirm(
      connection,
      protocol.buildUpsertPolicySeriesPaymentOptionTx({
        authority: poolAuthority.publicKey,
        poolAddress: parityPoolAddress,
        seriesRefHashHex,
        paymentMint,
        paymentAmount,
        active: true,
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      }),
      [poolAuthority],
      `upsert_policy_series_payment_option_${label}`,
    );
  }

  const memberPolicyPosition = protocol.derivePolicyPositionPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    seriesRefHash: Buffer.from(primarySeriesRefHashHex, "hex"),
    member: member.publicKey,
  });
  const policyStartTs = BigInt(Math.floor(Date.now() / 1000));
  await maybeSend(connection, "subscribe_policy_series_member", memberPolicyPosition, async () => ({
    tx: protocol.buildSubscribePolicySeriesTx({
      member: member.publicKey,
      poolAddress: parityPoolAddress,
      seriesRefHashHex: primarySeriesRefHashHex,
      startsAtTs: policyStartTs,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [member],
  }));

  const capitalProviderPolicyPosition = protocol.derivePolicyPositionPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    seriesRefHash: Buffer.from(primarySeriesRefHashHex, "hex"),
    member: capitalProvider.publicKey,
  });
  await maybeSend(connection, "subscribe_policy_series_capital_provider", capitalProviderPolicyPosition, async () => ({
    tx: protocol.buildSubscribePolicySeriesTx({
      member: capitalProvider.publicKey,
      poolAddress: parityPoolAddress,
      seriesRefHashHex: primarySeriesRefHashHex,
      startsAtTs: policyStartTs,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [capitalProvider],
  }));

  const nftMint = await createMint(connection, governance, governance.publicKey, null, 0);
  await sendAndConfirm(
    connection,
    protocol.buildMintPolicyNftTx({
      authority: poolAuthority.publicKey,
      poolAddress: parityPoolAddress,
      member: member.publicKey,
      seriesRefHashHex: primarySeriesRefHashHex,
      nftMint,
      metadataUri: "https://omegax.health/policies/frontend-parity-member",
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    [poolAuthority],
    "mint_policy_nft",
  );

  const memberLedger = protocol.derivePremiumLedgerPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    seriesRefHash: Buffer.from(primarySeriesRefHashHex, "hex"),
    member: member.publicKey,
  });
  await maybeSend(connection, "pay_premium_spl_member", memberLedger, async () => ({
    tx: protocol.buildPayPremiumSplTx({
      payer: member.publicKey,
      poolAddress: parityPoolAddress,
      member: member.publicKey,
      seriesRefHashHex: primarySeriesRefHashHex,
      paymentMint: coverageMint,
      periodIndex: 0n,
      payerTokenAccount: memberCoverageAta.address,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [member],
  }));

  const capitalProviderLedger = protocol.derivePremiumLedgerPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    seriesRefHash: Buffer.from(primarySeriesRefHashHex, "hex"),
    member: capitalProvider.publicKey,
  });
  await maybeSend(connection, "pay_premium_sol_capital_provider", capitalProviderLedger, async () => ({
    tx: protocol.buildPayPremiumSolTx({
      payer: capitalProvider.publicKey,
      poolAddress: parityPoolAddress,
      member: capitalProvider.publicKey,
      seriesRefHashHex: primarySeriesRefHashHex,
      periodIndex: 0n,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [capitalProvider],
  }));

  const claimIntentHashHex = sha256Hex("frontend-parity-claim-primary");
  const claimAddress = protocol.deriveCoverageClaimPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    seriesRefHash: Buffer.from(primarySeriesRefHashHex, "hex"),
    member: member.publicKey,
    intentHash: Buffer.from(claimIntentHashHex, "hex"),
  });
  await maybeSend(connection, "submit_coverage_claim", claimAddress, async () => ({
    tx: protocol.buildSubmitCoverageClaimTx({
      claimant: claimDelegate.publicKey,
      poolAddress: parityPoolAddress,
      member: member.publicKey,
      seriesRefHashHex: primarySeriesRefHashHex,
      intentHashHex: claimIntentHashHex,
      eventHashHex: sha256Hex("frontend-parity-claim-primary-event"),
      claimDelegate: claimDelegateAuth,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
    }),
    signers: [claimDelegate],
  }));

  const claimRows = await protocol.listCoverageClaims({
    connection,
    poolAddress: parityPoolAddress.toBase58(),
    search: claimAddress.toBase58(),
  });
  const claim = claimRows.find((row) => row.address === claimAddress.toBase58()) ?? null;
  if (claim && claim.status === protocol.COVERAGE_CLAIM_STATUS_SUBMITTED) {
    await sendAndConfirm(
      connection,
      protocol.buildReviewCoverageClaimTx({
        oracle: oracleSigner.publicKey,
        poolAddress: parityPoolAddress,
        member: member.publicKey,
        seriesRefHashHex: primarySeriesRefHashHex,
        intentHashHex: claimIntentHashHex,
        requestedAmount: 200_000n,
        evidenceHashHex: sha256Hex("frontend-parity-claim-evidence"),
        interopRefHashHex: sha256Hex("frontend-parity-claim-interop"),
        claimFamily: protocol.COVERAGE_CLAIM_FAMILY_REIMBURSEMENT,
        interopProfileHashHex: sha256Hex("frontend-parity-claim-profile"),
        codeSystemFamilyHashHex: sha256Hex("frontend-parity-claim-code-system"),
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      }),
      [oracleSigner],
      "review_coverage_claim",
    );
    await sendAndConfirm(
      connection,
      protocol.buildApproveCoverageClaimTx({
        oracle: oracleSigner.publicKey,
        poolAddress: parityPoolAddress,
        member: member.publicKey,
        seriesRefHashHex: primarySeriesRefHashHex,
        intentHashHex: claimIntentHashHex,
        approvedAmount: 100_000n,
        payoutMint: coverageMint,
        poolAssetVault: protocol.derivePoolAssetVaultPda({
          programId: protocol.getProgramId(),
          poolAddress: parityPoolAddress,
          payoutMint: coverageMint,
        }),
        poolVaultTokenAccount: await getOrCreateAssociatedTokenAccount(
          connection,
          governance,
          coverageMint,
          protocol.derivePoolAssetVaultPda({
            programId: protocol.getProgramId(),
            poolAddress: parityPoolAddress,
            payoutMint: coverageMint,
          }),
          true,
        ).then((ata) => ata.address),
        decisionReasonHashHex: sha256Hex("frontend-parity-claim-approve-reason"),
        adjudicationRefHashHex: sha256Hex("frontend-parity-claim-adjudication-ref"),
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      }),
      [oracleSigner],
      "approve_coverage_claim",
    );
  }

  const capitalProviderShareAta = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    shareMint,
    capitalProvider.publicKey,
  );
  const shareAccount = await getAccount(connection, capitalProviderShareAta.address, "confirmed");
  if (shareAccount.amount === 0n) {
    await sendAndConfirm(
      connection,
      protocol.buildDepositPoolLiquiditySplTx({
        depositor: capitalProvider.publicKey,
        poolAddress: parityPoolAddress,
        payoutMint: coverageMint,
        depositorPayoutTokenAccount: capitalProviderCoverageAta.address,
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
        amountIn: 800_000n,
        minSharesOut: 1n,
        includePoolCapitalClass: true,
        includePoolCompliancePolicy: true,
      }),
      [capitalProvider],
      "deposit_pool_liquidity_spl",
    );
  }

  const redemptionRequestHashHex = sha256Hex("frontend-parity-redemption-primary");
  const redemptionRequest = protocol.deriveRedemptionRequestPda({
    programId: protocol.getProgramId(),
    poolAddress: parityPoolAddress,
    redeemer: capitalProvider.publicKey,
    requestHash: Buffer.from(redemptionRequestHashHex, "hex"),
  });
  await maybeSend(connection, "request_pool_liquidity_redemption", redemptionRequest, async () => ({
    tx: protocol.buildRequestPoolLiquidityRedemptionTx({
      redeemer: capitalProvider.publicKey,
      poolAddress: parityPoolAddress,
      payoutMint: coverageMint,
      recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
      requestHashHex: redemptionRequestHashHex,
      sharesIn: 100_000n,
      minAmountOut: 1n,
      includePoolCapitalClass: true,
      includePoolCompliancePolicy: true,
    }),
    signers: [capitalProvider],
  }));

  const redemptionRows = await protocol.listPoolRedemptionRequests({
    connection,
    poolAddress: parityPoolAddress.toBase58(),
    search: redemptionRequest.toBase58(),
  });
  const redemption = redemptionRows.find((row) => row.address === redemptionRequest.toBase58()) ?? null;
  if (redemption && redemption.status === protocol.REDEMPTION_REQUEST_STATUS_PENDING) {
    await sendAndConfirm(
      connection,
      protocol.buildSchedulePoolLiquidityRedemptionTx({
        authority: riskManager.publicKey,
        poolAddress: parityPoolAddress,
        redemptionRequest,
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
        includePoolControlAuthority: true,
      }),
      [riskManager],
      "schedule_pool_liquidity_redemption",
    );
  }

  const envUpdates: EnvMap = {
    NEXT_PUBLIC_SOLANA_RPC_URL: rpcUrl,
    NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL: rpcUrl,
    NEXT_PUBLIC_PROTOCOL_PROGRAM_ID: protocol.getProgramId().toBase58(),
    NEXT_PUBLIC_DEFAULT_POOL_ADDRESS: parityPoolAddress.toBase58(),
    NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS: oracleSigner.publicKey.toBase58(),
    NEXT_PUBLIC_REQUIRED_ORACLE_ADDRESS: oracleSigner.publicKey.toBase58(),
    NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS: oracleSigner.publicKey.toBase58(),
    NEXT_PUBLIC_DEFAULT_REWARD_PAYOUT_MINT: rewardMint.toBase58(),
    NEXT_PUBLIC_DEFAULT_INSURANCE_PAYOUT_MINT: coverageMint.toBase58(),
    NEXT_PUBLIC_DEVNET_OBSERVER_WALLET: observer.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_GOVERNANCE_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_POOL_AUTHORITY_WALLET: poolAuthority.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET: poolOperator.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_RISK_MANAGER_WALLET: riskManager.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET: complianceAuthority.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_GUARDIAN_WALLET: guardian.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET: oracleSigner.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET: oracleAdminWallet.toBase58(),
    NEXT_PUBLIC_DEVNET_MEMBER_WALLET: member.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET: claimDelegate.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET: capitalProvider.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_SOL: DEVNET_NATIVE_SOL_RAIL,
    NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_REWARD_SPL: rewardMint.toBase58(),
    NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_COVERAGE_SPL: coverageMint.toBase58(),
    NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY: primarySeries.toBase58(),
    NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY_REF_HASH: primarySeriesRefHashHex,
    NEXT_PUBLIC_DEVNET_POLICY_SERIES_REWARDS: rewardsSeries.toBase58(),
    NEXT_PUBLIC_DEVNET_POLICY_SERIES_REWARDS_REF_HASH: rewardsSeriesRefHashHex,
    NEXT_PUBLIC_DEVNET_STAKE_MINT: protocolConfig.defaultStakeMint.toBase58(),
    NEXT_PUBLIC_DEVNET_STAKE_VAULT: stakeVault.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_STAKE_POSITION: stakePosition.toBase58(),
    NEXT_PUBLIC_DEVNET_SLASH_TREASURY_TOKEN_ACCOUNT: slashTreasuryAta.address.toBase58(),
    NEXT_PUBLIC_DEVNET_CLAIM_CASE_PRIMARY: claimAddress.toBase58(),
    NEXT_PUBLIC_DEVNET_CLAIM_CASE_PRIMARY_INTENT_HASH: claimIntentHashHex,
    NEXT_PUBLIC_DEVNET_REDEMPTION_REQUEST_PRIMARY: redemptionRequest.toBase58(),
  };
  updateEnvFile(FRONTEND_ENV_PATH, envUpdates);

  console.log("");
  console.log("[parity-bootstrap] Complete");
  console.log(`[parity-bootstrap] rpc_url=${rpcUrl}`);
  console.log(`[parity-bootstrap] governance=${governance.publicKey.toBase58()}`);
  console.log(`[parity-bootstrap] protocol_config=${configPda.toBase58()}`);
  console.log(`[parity-bootstrap] parity_pool=${parityPoolAddress.toBase58()}`);
  console.log(`[parity-bootstrap] oracle=${oracleSigner.publicKey.toBase58()}`);
  console.log(`[parity-bootstrap] oracle_admin=${oracleAdminWallet.toBase58()}`);
  console.log(`[parity-bootstrap] coverage_mint=${coverageMint.toBase58()}`);
  console.log(`[parity-bootstrap] reward_mint=${rewardMint.toBase58()}`);
  console.log(`[parity-bootstrap] stake_mint=${protocolConfig.defaultStakeMint.toBase58()}`);
  console.log(`[parity-bootstrap] claim_case_primary=${claimAddress.toBase58()}`);
  console.log(`[parity-bootstrap] redemption_request_primary=${redemptionRequest.toBase58()}`);
  console.log(`[parity-bootstrap] frontend_env=${FRONTEND_ENV_PATH}`);
}

void main().catch((error) => {
  console.error("[parity-bootstrap] failed");
  console.error(error);
  process.exitCode = 1;
});
