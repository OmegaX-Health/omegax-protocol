// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { homedir } from "node:os";

import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import tweetnacl from "tweetnacl";

type ReviewStatusName =
  | "reviewed"
  | "approved"
  | "needs_more_info"
  | "escalated"
  | "failed";

type RawFixture = {
  fixtureId?: string;
  sourceCaseId?: string;
  sessionId?: string;
  skuKey?: string;
  status?: ReviewStatusName | number;
  claimCase?: string;
  healthPlan?: string;
  policySeries?: string;
  evidenceRefHash?: string;
  decisionSupportHash?: string;
  schemaKeyHash?: string;
  schemaHash?: string;
  reviewResultHash?: string;
  reviewArtifactHash?: string;
  reviewBinaryHash?: string;
  teeAttestationDigest?: string;
  privatePaymentRefHash?: string;
};

type SmokeFixture = {
  fixtureId: string;
  sessionId: string;
  statusName: ReviewStatusName;
  statusCode: number;
  claimCase: PublicKey;
  healthPlan: PublicKey;
  policySeries: PublicKey;
  evidenceRefHash: Buffer;
  decisionSupportHash: Buffer;
  schemaKeyHash: Buffer;
  schemaHash: Buffer;
  reviewResultHash: Buffer;
  reviewArtifactHash: Buffer;
  reviewBinaryHash: Buffer;
  teeAttestationDigest: Buffer;
  privatePaymentRefHash: Buffer;
};

type DecodedReviewSession = {
  sessionId: string;
  sessionAuthority: PublicKey;
  claimCase: PublicKey;
  healthPlan: PublicKey;
  policySeries: PublicKey;
  reviewOperator: PublicKey;
  reviewerAuthority: PublicKey;
  paymentAttestor: PublicKey;
  status: number;
  openedAt: number;
  delegatedAt: number;
  reviewedAt: number;
  paymentRecordedAt: number;
  committedAt: number;
  failedAt: number;
};

type CliOptions = {
  count: number;
  fixturesPath?: string;
  outPath?: string;
  runId: string;
  baseRpcUrl: string;
  teeRpcUrl: string;
  teeWsUrl: string;
  keypairPath: string;
  naturalStatuses: boolean;
  teeIntegrity: "warn" | "strict" | "skip";
};

const PROGRAM_ID = new PublicKey("FADqaRcJHERauzMo3BRzXZVY2qvrpPqg1ie2FGqACCVn");
const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");
const BPF_UPGRADEABLE_LOADER_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const STATUS_CODES: Record<ReviewStatusName, number> = {
  reviewed: 2,
  approved: 3,
  needs_more_info: 4,
  escalated: 5,
  failed: 6,
};
const STATUS_MATRIX: ReviewStatusName[] = [
  "reviewed",
  "approved",
  "needs_more_info",
  "escalated",
  "failed",
];
const SESSION_ACCOUNT_DISCRIMINATOR = accountDiscriminator("PrivateClaimReviewSession");
const REGISTRY_ACCOUNT_DISCRIMINATOR = accountDiscriminator("PrivateReviewRegistry");
const SEED_REGISTRY = Buffer.from("private_review_registry", "utf8");
const SEED_OPERATOR = Buffer.from("private_review_operator", "utf8");
const SEED_SESSION = Buffer.from("private_claim_review", "utf8");
const BASE_RPC_DEFAULT = "https://api.devnet.solana.com";
const TEE_RPC_DEFAULT = "https://devnet-tee.magicblock.app";
const TEE_WS_DEFAULT = "wss://tee.magicblock.app";

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    count: 5,
    runId: `mbdev-${Date.now().toString(36)}`,
    baseRpcUrl: process.env.SOLANA_RPC_URL ?? BASE_RPC_DEFAULT,
    teeRpcUrl: process.env.MAGICBLOCK_TEE_RPC_URL ?? TEE_RPC_DEFAULT,
    teeWsUrl: process.env.MAGICBLOCK_TEE_WS_URL ?? TEE_WS_DEFAULT,
    keypairPath: process.env.ANCHOR_WALLET ?? process.env.SOLANA_KEYPAIR ?? "~/.config/solana/id.json",
    naturalStatuses: false,
    teeIntegrity: "warn",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--count") {
      options.count = parsePositiveInteger(readFlagValue(args, index, arg), arg);
      index += 1;
    } else if (arg === "--fixtures") {
      options.fixturesPath = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === "--out") {
      options.outPath = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === "--run-id") {
      options.runId = canonicalRunId(readFlagValue(args, index, arg));
      index += 1;
    } else if (arg === "--base-rpc") {
      options.baseRpcUrl = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === "--tee-rpc") {
      options.teeRpcUrl = readFlagValue(args, index, arg).replace(/\?token=.*$/, "");
      index += 1;
    } else if (arg === "--tee-ws") {
      options.teeWsUrl = readFlagValue(args, index, arg).replace(/\?token=.*$/, "");
      index += 1;
    } else if (arg === "--keypair") {
      options.keypairPath = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === "--natural-statuses") {
      options.naturalStatuses = true;
    } else if (arg === "--strict-tee-quote" || arg === "--strict-tee-integrity") {
      options.teeIntegrity = "strict";
    } else if (arg === "--skip-tee-quote" || arg === "--skip-tee-integrity") {
      options.teeIntegrity = "skip";
    } else if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage: npm run devnet:magicblock:claim-review -- [--count N] [--fixtures FILE]",
        "       [--out FILE] [--run-id VALUE] [--base-rpc URL] [--tee-rpc URL]",
        "       [--tee-ws URL] [--keypair FILE] [--natural-statuses]",
        "       [--strict-tee-quote|--skip-tee-quote]",
        "",
        "Runs the MagicBlock private-claim review flow on devnet:",
        "base open/delegate -> authenticated TEE review/payment/commit -> base finalize.",
      ].join("\n"));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function readFlagValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function canonicalRunId(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!normalized) throw new Error("--run-id must not be empty");
  if (normalized.length > 16) throw new Error("--run-id must be 16 characters or fewer");
  return normalized;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const payer = loadKeypair(options.keypairPath);
  const baseConnection = new Connection(options.baseRpcUrl, "confirmed");
  const fixtures = loadFixtures(options);
  const registry = derivePda([SEED_REGISTRY], PROGRAM_ID);
  const operator = derivePda([SEED_OPERATOR, payer.publicKey.toBuffer()], PROGRAM_ID);
  const programData = await readProgramDataAddress(baseConnection);
  const firstReviewBinaryHash = fixtures[0]?.reviewBinaryHash ?? hash32("fallback-review-binary");

  await ensureRegistryAndOperator({
    baseConnection,
    payer,
    registry,
    operator,
    programData,
    reviewBinaryHash: firstReviewBinaryHash,
  });

  await ensureTeeIntegrity(options);
  const teeConnection = await buildAuthenticatedTeeConnection(options, payer);

  const results = [];
  for (const [index, fixture] of fixtures.entries()) {
    const sessionPda = deriveSessionPda(payer.publicKey, fixture.claimCase, fixture.sessionId);
    console.log(`\n[${index + 1}/${fixtures.length}] ${fixture.sessionId} status=${fixture.statusName}`);

    const openSignature = await sendTransaction({
      connection: baseConnection,
      payer,
      label: "open_review_session",
      instructions: [openReviewSessionIx({
        payer: payer.publicKey,
        registry,
        operator,
        reviewSession: sessionPda,
        fixture,
      })],
    });
    const delegateSignature = await sendTransaction({
      connection: baseConnection,
      payer,
      label: "delegate_review_session",
      instructions: [delegateReviewSessionIx({
        payer: payer.publicKey,
        reviewSession: sessionPda,
        fixture,
      })],
    });
    await waitForOwner(baseConnection, sessionPda, DELEGATION_PROGRAM_ID, "base delegated owner");
    await waitForSessionStatus(teeConnection, sessionPda, 1, "TEE delegated session");

    const reviewSignature = await sendTransaction({
      connection: teeConnection,
      payer,
      label: "record_private_review",
      skipPreflight: true,
      instructions: [recordPrivateReviewIx({
        reviewer: payer.publicKey,
        registry,
        operator,
        reviewSession: sessionPda,
        fixture,
      })],
    });

    let paymentSignature: string | null = null;
    if (fixture.statusName === "approved") {
      paymentSignature = await sendTransaction({
        connection: teeConnection,
        payer,
        label: "record_private_payment_ref",
        skipPreflight: true,
        instructions: [recordPrivatePaymentRefIx({
          paymentAttestor: payer.publicKey,
          registry,
          reviewSession: sessionPda,
          fixture,
        })],
      });
    }

    const commitSignature = await sendTransaction({
      connection: teeConnection,
      payer,
      label: "commit_and_close_review_session",
      skipPreflight: true,
      instructions: [commitAndCloseReviewSessionIx({
        payer: payer.publicKey,
        reviewSession: sessionPda,
      })],
    });

    await waitForOwner(baseConnection, sessionPda, PROGRAM_ID, "base program owner after commit");
    await waitForSessionStatus(baseConnection, sessionPda, fixture.statusCode, "base committed status");

    const finalizeSignature = await sendTransaction({
      connection: baseConnection,
      payer,
      label: "finalize_committed_review_session",
      instructions: [finalizeCommittedReviewSessionIx({
        payer: payer.publicKey,
        reviewSession: sessionPda,
      })],
    });
    const finalSession = await waitForCommittedAt(baseConnection, sessionPda);

    results.push({
      fixtureId: fixture.fixtureId,
      sessionId: fixture.sessionId,
      status: fixture.statusName,
      reviewSession: sessionPda.toBase58(),
      claimCase: fixture.claimCase.toBase58(),
      openSignature,
      delegateSignature,
      reviewSignature,
      paymentSignature,
      commitSignature,
      finalizeSignature,
      finalStatus: finalSession.status,
      committedAt: finalSession.committedAt,
    });
  }

  const summary = {
    runId: options.runId,
    generatedAt: new Date().toISOString(),
    programId: PROGRAM_ID.toBase58(),
    baseRpcUrl: options.baseRpcUrl,
    teeRpcUrl: options.teeRpcUrl,
    sessionAuthority: payer.publicKey.toBase58(),
    registry: registry.toBase58(),
    operator: operator.toBase58(),
    caseCount: results.length,
    results,
  };

  if (options.outPath) {
    const outPath = resolvePath(options.outPath);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  }

  console.log("\nMagicBlock devnet claim-review smoke complete:");
  console.log(JSON.stringify(summary, null, 2));
}

async function ensureTeeIntegrity(options: CliOptions): Promise<void> {
  if (options.teeIntegrity === "skip") return;
  try {
    const challenge = randomBytes(64).toString("base64");
    const response = await fetch(
      `${options.teeRpcUrl}/quote?challenge=${encodeURIComponent(challenge)}`,
    );
    const body = await response.json();
    if (response.status !== 200 || typeof body.quote !== "string" || body.quote.length === 0) {
      throw new Error(body.error ?? "TEE quote endpoint did not return a quote");
    }
    console.warn(
      "TEE quote endpoint is reachable; cryptographic DCAP verification is not bundled in this public-repo runner.",
    );
  } catch (cause) {
    if (options.teeIntegrity === "strict") throw cause;
    console.warn(`TEE quote check warning: ${messageFromError(cause)}`);
  }
}

async function buildAuthenticatedTeeConnection(
  options: CliOptions,
  payer: Keypair,
): Promise<Connection> {
  const authToken = await getTeeAuthToken(options.teeRpcUrl, payer);
  return new Connection(`${options.teeRpcUrl}?token=${authToken.token}`, {
    commitment: "confirmed",
    wsEndpoint: `${options.teeWsUrl}?token=${authToken.token}`,
  });
}

async function getTeeAuthToken(
  teeRpcUrl: string,
  payer: Keypair,
): Promise<{ token: string; expiresAt: number }> {
  const challengeResponse = await fetch(
    `${teeRpcUrl}/auth/challenge?pubkey=${payer.publicKey.toBase58()}`,
  );
  const challengeJson = await challengeResponse.json();
  if (typeof challengeJson.error === "string" && challengeJson.error.length > 0) {
    throw new Error(`Failed to get TEE auth challenge: ${challengeJson.error}`);
  }
  if (typeof challengeJson.challenge !== "string" || challengeJson.challenge.length === 0) {
    throw new Error("TEE auth challenge response did not include a challenge");
  }

  const signature = nacl.sign.detached(
    Buffer.from(challengeJson.challenge, "utf8"),
    payer.secretKey,
  );
  const authResponse = await fetch(`${teeRpcUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pubkey: payer.publicKey.toBase58(),
      challenge: challengeJson.challenge,
      signature: bs58.encode(signature),
    }),
  });
  const authJson = await authResponse.json();
  if (authResponse.status !== 200) {
    throw new Error(`Failed to authenticate with TEE RPC: ${authJson.error ?? authResponse.status}`);
  }
  if (typeof authJson.token !== "string" || authJson.token.length === 0) {
    throw new Error("TEE auth response did not include a token");
  }
  return {
    token: authJson.token,
    expiresAt: typeof authJson.expiresAt === "number"
      ? authJson.expiresAt
      : Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
}

const nacl = tweetnacl;

async function ensureRegistryAndOperator(params: {
  baseConnection: Connection;
  payer: Keypair;
  registry: PublicKey;
  operator: PublicKey;
  programData: PublicKey;
  reviewBinaryHash: Buffer;
}): Promise<void> {
  const registryInfo = await params.baseConnection.getAccountInfo(params.registry, "confirmed");
  if (!registryInfo) {
    await sendTransaction({
      connection: params.baseConnection,
      payer: params.payer,
      label: "initialize_review_registry",
      instructions: [initializeReviewRegistryIx({
        authority: params.payer.publicKey,
        registry: params.registry,
        programData: params.programData,
      })],
    });
  } else {
    const registry = decodeRegistry(registryInfo.data);
    if (
      !registry.authority.equals(params.payer.publicKey) ||
      !registry.sessionAuthority.equals(params.payer.publicKey) ||
      !registry.paymentAttestor.equals(params.payer.publicKey) ||
      !registry.active
    ) {
      throw new Error(
        `Existing review registry ${params.registry.toBase58()} is not active for this signer.`,
      );
    }
  }

  await sendTransaction({
    connection: params.baseConnection,
    payer: params.payer,
    label: "upsert_review_operator",
    instructions: [upsertReviewOperatorIx({
      authority: params.payer.publicKey,
      registry: params.registry,
      operator: params.operator,
      reviewBinaryHash: params.reviewBinaryHash,
    })],
  });
}

async function readProgramDataAddress(connection: Connection): Promise<PublicKey> {
  const info = await connection.getAccountInfo(PROGRAM_ID, "confirmed");
  if (!info) throw new Error(`Program ${PROGRAM_ID.toBase58()} is not deployed on devnet`);
  if (!info.owner.equals(BPF_UPGRADEABLE_LOADER_ID)) {
    throw new Error(`Program ${PROGRAM_ID.toBase58()} is not upgradeable-loader owned`);
  }
  if (info.data.length < 36 || info.data.readUInt32LE(0) !== 2) {
    throw new Error("Program account does not contain an upgradeable Program state");
  }
  return new PublicKey(info.data.subarray(4, 36));
}

function initializeReviewRegistryIx(params: {
  authority: PublicKey;
  registry: PublicKey;
  programData: PublicKey;
}): TransactionInstruction {
  return instruction("initialize_review_registry", Buffer.concat([
    publicKeyBytes(params.authority),
    publicKeyBytes(params.authority),
    Buffer.from([1]),
  ]), [
    writableSigner(params.authority),
    writable(params.registry),
    readonly(PROGRAM_ID),
    readonly(params.programData),
    readonly(SystemProgram.programId),
  ]);
}

function upsertReviewOperatorIx(params: {
  authority: PublicKey;
  registry: PublicKey;
  operator: PublicKey;
  reviewBinaryHash: Buffer;
}): TransactionInstruction {
  return instruction("upsert_review_operator", Buffer.concat([
    publicKeyBytes(params.authority),
    params.reviewBinaryHash,
    Buffer.from([1]),
  ]), [
    writableSigner(params.authority),
    writable(params.registry),
    writable(params.operator),
    readonly(SystemProgram.programId),
  ]);
}

function openReviewSessionIx(params: {
  payer: PublicKey;
  registry: PublicKey;
  operator: PublicKey;
  reviewSession: PublicKey;
  fixture: SmokeFixture;
}): TransactionInstruction {
  return instruction("open_review_session", Buffer.concat([
    encodeString(params.fixture.sessionId),
    publicKeyBytes(params.fixture.claimCase),
    publicKeyBytes(params.fixture.healthPlan),
    publicKeyBytes(params.fixture.policySeries),
    params.fixture.evidenceRefHash,
    params.fixture.decisionSupportHash,
    params.fixture.schemaKeyHash,
    params.fixture.schemaHash,
  ]), [
    writableSigner(params.payer),
    readonly(params.registry),
    readonly(params.operator),
    writable(params.reviewSession),
    readonly(SystemProgram.programId),
  ]);
}

function delegateReviewSessionIx(params: {
  payer: PublicKey;
  reviewSession: PublicKey;
  fixture: SmokeFixture;
}): TransactionInstruction {
  const bufferReviewSession = derivePda([
    Buffer.from("buffer", "utf8"),
    params.reviewSession.toBuffer(),
  ], PROGRAM_ID);
  const delegationRecord = derivePda([
    Buffer.from("delegation", "utf8"),
    params.reviewSession.toBuffer(),
  ], DELEGATION_PROGRAM_ID);
  const delegationMetadata = derivePda([
    Buffer.from("delegation-metadata", "utf8"),
    params.reviewSession.toBuffer(),
  ], DELEGATION_PROGRAM_ID);

  return instruction("delegate_review_session", Buffer.concat([
    encodeString(params.fixture.sessionId),
    publicKeyBytes(params.fixture.claimCase),
  ]), [
    writableSigner(params.payer),
    writable(bufferReviewSession),
    writable(delegationRecord),
    writable(delegationMetadata),
    writable(params.reviewSession),
    readonly(PROGRAM_ID),
    readonly(DELEGATION_PROGRAM_ID),
    readonly(SystemProgram.programId),
  ]);
}

function recordPrivateReviewIx(params: {
  reviewer: PublicKey;
  registry: PublicKey;
  operator: PublicKey;
  reviewSession: PublicKey;
  fixture: SmokeFixture;
}): TransactionInstruction {
  return instruction("record_private_review", Buffer.concat([
    Buffer.from([params.fixture.statusCode]),
    params.fixture.reviewResultHash,
    params.fixture.reviewArtifactHash,
    params.fixture.reviewBinaryHash,
    params.fixture.teeAttestationDigest,
  ]), [
    writableSigner(params.reviewer),
    readonly(params.registry),
    readonly(params.operator),
    writable(params.reviewSession),
  ]);
}

function recordPrivatePaymentRefIx(params: {
  paymentAttestor: PublicKey;
  registry: PublicKey;
  reviewSession: PublicKey;
  fixture: SmokeFixture;
}): TransactionInstruction {
  return instruction("record_private_payment_ref", params.fixture.privatePaymentRefHash, [
    writableSigner(params.paymentAttestor),
    readonly(params.registry),
    writable(params.reviewSession),
  ]);
}

function commitAndCloseReviewSessionIx(params: {
  payer: PublicKey;
  reviewSession: PublicKey;
}): TransactionInstruction {
  return instruction("commit_and_close_review_session", Buffer.alloc(0), [
    writableSigner(params.payer),
    writable(params.reviewSession),
    readonly(MAGIC_PROGRAM_ID),
    writable(MAGIC_CONTEXT_ID),
  ]);
}

function finalizeCommittedReviewSessionIx(params: {
  payer: PublicKey;
  reviewSession: PublicKey;
}): TransactionInstruction {
  return instruction("finalize_committed_review_session", Buffer.alloc(0), [
    writableSigner(params.payer),
    writable(params.reviewSession),
  ]);
}

async function sendTransaction(params: {
  connection: Connection;
  payer: Keypair;
  label: string;
  instructions: TransactionInstruction[];
  skipPreflight?: boolean;
}): Promise<string> {
  const latestBlockhash = await params.connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction();
  transaction.feePayer = params.payer.publicKey;
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.add(...params.instructions);
  transaction.sign(params.payer);

  let signature: string | null = null;
  try {
    signature = await params.connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: params.skipPreflight ?? false,
      maxRetries: 5,
    });
    const confirmation = await params.connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }, "confirmed");
    if (confirmation.value.err) {
      throw new Error(JSON.stringify(confirmation.value.err));
    }
    console.log(`${params.label}: ${signature}`);
    return signature;
  } catch (cause) {
    const logs = await logsFromSendError(params.connection, cause);
    throw new Error([
      `${params.label} failed${signature ? ` (${signature})` : ""}: ${messageFromError(cause)}`,
      logs.length > 0 ? logs.join("\n") : null,
    ].filter(Boolean).join("\n"));
  }
}

async function logsFromSendError(connection: Connection, cause: unknown): Promise<string[]> {
  if (cause instanceof SendTransactionError) {
    if (cause.logs && cause.logs.length > 0) return cause.logs;
    try {
      const logs = await cause.getLogs(connection);
      return logs ?? [];
    } catch {
      return [];
    }
  }
  return [];
}

async function waitForOwner(
  connection: Connection,
  account: PublicKey,
  owner: PublicKey,
  label: string,
): Promise<void> {
  await waitFor(async () => {
    const info = await connection.getAccountInfo(account, "confirmed");
    return info?.owner.equals(owner) ?? false;
  }, label);
}

async function waitForSessionStatus(
  connection: Connection,
  account: PublicKey,
  status: number,
  label: string,
): Promise<DecodedReviewSession> {
  return waitFor(async () => {
    const session = await readReviewSession(connection, account);
    return session.status === status ? session : null;
  }, label);
}

async function waitForCommittedAt(
  connection: Connection,
  account: PublicKey,
): Promise<DecodedReviewSession> {
  return waitFor(async () => {
    const session = await readReviewSession(connection, account);
    return session.committedAt > 0 ? session : null;
  }, "base committed_at");
}

async function waitFor<T>(
  load: () => Promise<T | false | null>,
  label: string,
  timeoutMs = 90_000,
): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await load();
      if (value) return value;
    } catch (cause) {
      lastError = cause;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${messageFromError(lastError)}` : ""}`);
}

async function readReviewSession(
  connection: Connection,
  account: PublicKey,
): Promise<DecodedReviewSession> {
  const info = await connection.getAccountInfo(account, "confirmed");
  if (!info) throw new Error(`Review session ${account.toBase58()} not found`);
  return decodeReviewSession(info.data);
}

function decodeReviewSession(data: Buffer | Uint8Array): DecodedReviewSession {
  const buffer = Buffer.from(data);
  if (!buffer.subarray(0, 8).equals(SESSION_ACCOUNT_DISCRIMINATOR)) {
    throw new Error("Account is not a PrivateClaimReviewSession");
  }
  const reader = new BinaryReader(buffer, 8);
  const sessionId = reader.string();
  const sessionAuthority = reader.publicKey();
  const claimCase = reader.publicKey();
  const healthPlan = reader.publicKey();
  const policySeries = reader.publicKey();
  reader.bytes(32);
  reader.bytes(32);
  reader.bytes(32);
  reader.bytes(32);
  const reviewOperator = reader.publicKey();
  const reviewerAuthority = reader.publicKey();
  const paymentAttestor = reader.publicKey();
  reader.bytes(32);
  reader.bytes(32);
  reader.bytes(32);
  reader.bytes(32);
  reader.publicKey();
  reader.bytes(32);
  const status = reader.u8();
  const openedAt = reader.i64();
  const delegatedAt = reader.i64();
  const reviewedAt = reader.i64();
  const paymentRecordedAt = reader.i64();
  const committedAt = reader.i64();
  const failedAt = reader.i64();
  return {
    sessionId,
    sessionAuthority,
    claimCase,
    healthPlan,
    policySeries,
    reviewOperator,
    reviewerAuthority,
    paymentAttestor,
    status,
    openedAt,
    delegatedAt,
    reviewedAt,
    paymentRecordedAt,
    committedAt,
    failedAt,
  };
}

function decodeRegistry(data: Buffer | Uint8Array): {
  authority: PublicKey;
  sessionAuthority: PublicKey;
  paymentAttestor: PublicKey;
  active: boolean;
} {
  const buffer = Buffer.from(data);
  if (!buffer.subarray(0, 8).equals(REGISTRY_ACCOUNT_DISCRIMINATOR)) {
    throw new Error("Account is not a PrivateReviewRegistry");
  }
  const reader = new BinaryReader(buffer, 8);
  const authority = reader.publicKey();
  const sessionAuthority = reader.publicKey();
  const paymentAttestor = reader.publicKey();
  const active = reader.u8() === 1;
  return { authority, sessionAuthority, paymentAttestor, active };
}

class BinaryReader {
  private offset: number;

  constructor(private readonly buffer: Buffer, offset: number) {
    this.offset = offset;
  }

  string(): string {
    const length = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    const value = this.buffer.subarray(this.offset, this.offset + length).toString("utf8");
    this.offset += length;
    return value;
  }

  publicKey(): PublicKey {
    return new PublicKey(this.bytes(32));
  }

  bytes(length: number): Buffer {
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  u8(): number {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  i64(): number {
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return Number(value);
  }
}

function loadFixtures(options: CliOptions): SmokeFixture[] {
  const rawFixtures = options.fixturesPath
    ? readFixtureFile(resolvePath(options.fixturesPath))
    : Array.from({ length: options.count }, (_, index) => ({ fixtureId: `local-${index + 1}` }));
  return rawFixtures.slice(0, options.count).map((fixture, index) =>
    normalizeFixture(fixture, index, options),
  );
}

function readFixtureFile(path: string): RawFixture[] {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const fixtures = Array.isArray(parsed) ? parsed : parsed.fixtures;
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error(`No fixtures found in ${path}`);
  }
  return fixtures as RawFixture[];
}

function normalizeFixture(
  raw: RawFixture,
  index: number,
  options: CliOptions,
): SmokeFixture {
  const fixtureId = raw.fixtureId ?? raw.sourceCaseId ?? `fixture-${index + 1}`;
  const statusName = options.naturalStatuses
    ? normalizeStatus(raw.status, index)
    : STATUS_MATRIX[index % STATUS_MATRIX.length]!;
  const sessionId = canonicalSessionId(options.runId, index, raw.sessionId ?? fixtureId);
  return {
    fixtureId,
    sessionId,
    statusName,
    statusCode: STATUS_CODES[statusName],
    claimCase: publicKeyFromRaw(raw.claimCase, `claim-case:${fixtureId}`),
    healthPlan: publicKeyFromRaw(raw.healthPlan, `health-plan:${raw.skuKey ?? "genesis"}`),
    policySeries: publicKeyFromRaw(raw.policySeries, `policy-series:${raw.skuKey ?? "genesis"}`),
    evidenceRefHash: hashFromRaw(raw.evidenceRefHash, `evidence:${fixtureId}`),
    decisionSupportHash: hashFromRaw(raw.decisionSupportHash, `decision:${fixtureId}`),
    schemaKeyHash: hashFromRaw(raw.schemaKeyHash, `schema-key:${fixtureId}`),
    schemaHash: hashFromRaw(raw.schemaHash, `schema:${fixtureId}`),
    reviewResultHash: hashFromRaw(raw.reviewResultHash, `result:${fixtureId}:${statusName}`),
    reviewArtifactHash: hashFromRaw(raw.reviewArtifactHash, `artifact:${fixtureId}:${statusName}`),
    reviewBinaryHash: hashFromRaw(raw.reviewBinaryHash, "review-binary:protocol-oracle-service"),
    teeAttestationDigest: hashFromRaw(raw.teeAttestationDigest, `tee:${fixtureId}`),
    privatePaymentRefHash: hashFromRaw(raw.privatePaymentRefHash, `payment:${fixtureId}`),
  };
}

function normalizeStatus(value: RawFixture["status"], index: number): ReviewStatusName {
  if (typeof value === "number") {
    const match = Object.entries(STATUS_CODES).find(([, code]) => code === value);
    if (match) return match[0] as ReviewStatusName;
  }
  if (
    value === "reviewed" ||
    value === "approved" ||
    value === "needs_more_info" ||
    value === "escalated" ||
    value === "failed"
  ) {
    return value;
  }
  return STATUS_MATRIX[index % STATUS_MATRIX.length]!;
}

function canonicalSessionId(runId: string, index: number, source: string): string {
  const safeSource = source.trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  const sourceHash = createHash("sha256").update(safeSource).digest("hex").slice(0, 8);
  const sessionId = `${runId}-${index + 1}-${sourceHash}`.slice(0, 32);
  if (!sessionId || sessionId.trim() !== sessionId) {
    throw new Error(`Generated non-canonical session id for ${source}`);
  }
  return sessionId;
}

function publicKeyFromRaw(value: string | undefined, seed: string): PublicKey {
  if (value) return new PublicKey(value);
  return derivePda([
    Buffer.from("magicblock_smoke", "utf8"),
    hash32(seed),
  ], PROGRAM_ID);
}

function hashFromRaw(value: string | undefined, seed: string): Buffer {
  if (value) {
    const normalized = value.trim().replace(/^0x/, "");
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      throw new Error(`Expected 32-byte hex hash for ${seed}`);
    }
    const buffer = Buffer.from(normalized, "hex");
    if (buffer.every((byte) => byte === 0)) {
      throw new Error(`Zero hash is not allowed for ${seed}`);
    }
    return buffer;
  }
  return hash32(seed);
}

function loadKeypair(path: string): Keypair {
  const resolvedPath = resolvePath(path);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Keypair file not found: ${resolvedPath}`);
  }
  const secretKey = Uint8Array.from(JSON.parse(readFileSync(resolvedPath, "utf8")));
  return Keypair.fromSecretKey(secretKey);
}

function instruction(name: string, args: Buffer, keys: TransactionInstruction["keys"]): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.concat([globalDiscriminator(name), args]),
  });
}

function writableSigner(pubkey: PublicKey) {
  return { pubkey, isSigner: true, isWritable: true };
}

function writable(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: true };
}

function readonly(pubkey: PublicKey) {
  return { pubkey, isSigner: false, isWritable: false };
}

function encodeString(value: string): Buffer {
  const text = Buffer.from(value, "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(text.length, 0);
  return Buffer.concat([length, text]);
}

function publicKeyBytes(pubkey: PublicKey): Buffer {
  return Buffer.from(pubkey.toBytes());
}

function deriveSessionPda(
  sessionAuthority: PublicKey,
  claimCase: PublicKey,
  sessionId: string,
): PublicKey {
  return derivePda([
    SEED_SESSION,
    sessionAuthority.toBuffer(),
    claimCase.toBuffer(),
    Buffer.from(sessionId, "utf8"),
  ], PROGRAM_ID);
}

function derivePda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function globalDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function accountDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
}

function hash32(value: unknown): Buffer {
  return createHash("sha256").update(String(value)).digest();
}

function resolvePath(path: string): string {
  const expanded = path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : path;
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

function messageFromError(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : String(cause);
}

main().catch((cause) => {
  console.error(messageFromError(cause));
  process.exitCode = 1;
});
