// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { loadEnvFile } from "./support/load_env_file.ts";
import { wrapConnectionWithRpcRetry } from "./support/rpc_retry.ts";
import { keypairFromFile } from "./support/script_helpers.ts";

type ProtocolModule = typeof import("../frontend/lib/protocol.ts");

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_FUNDER_KEYPAIR_PATH = resolve(homedir(), ".config/solana/id.json");
const LOCAL_DEVNET_DIR = resolve(homedir(), ".config/solana/omegax-devnet");
const ANCHOR_TOML_PATH = resolve(process.cwd(), "Anchor.toml");
const PROGRAM_LIB_PATH = resolve(process.cwd(), "programs/omegax_protocol/src/lib.rs");
const TARGET_PROGRAM_KEYPAIR_PATH = resolve(process.cwd(), "target/deploy/omegax_protocol-keypair.json");
const PROGRAM_SO_PATH = resolve(process.cwd(), "target/deploy/omegax_protocol.so");
const CANONICAL_PROGRAM_ID = "Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B";

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function expandHome(path: string): string {
  return path.replace(/^~(?=\/|$)/, homedir());
}

function configuredKeypairPath(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return expandHome(value);
  }
  return null;
}

function loadLocalEnv(): void {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), "frontend/.env.local"));
}

function writeKeypairIfMissing(path: string): Keypair {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path)) return keypairFromFile(path);
  const keypair = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  chmodSync(path, 0o600);
  return keypair;
}

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function restoreFile(path: string, content: string | null): void {
  if (content === null) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  writeFileSync(path, content);
}

function replaceProgramId(content: string, nextProgramId: string): string {
  return content.replaceAll(CANONICAL_PROGRAM_ID, nextProgramId);
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    maxBuffer: 1024 * 1024 * 64,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${output}`);
  }
  process.stdout.write(output);
  return output;
}

function deployTransportArgs(): string[] {
  const transport = (process.env.OMEGAX_DEVNET_REDEPLOY_TRANSPORT?.trim() || "tpu-client").toLowerCase();
  switch (transport) {
    case "default":
    case "none":
      return [];
    case "quic":
      return ["--use-quic"];
    case "rpc":
      return ["--use-rpc"];
    case "tpu":
    case "tpu-client":
      return ["--use-tpu-client"];
    case "udp":
      return ["--use-udp"];
    default:
      throw new Error(`Invalid OMEGAX_DEVNET_REDEPLOY_TRANSPORT: ${transport}`);
  }
}

async function sendTransaction(params: {
  connection: Connection;
  feePayer: Keypair;
  label: string;
  signers?: Keypair[];
  tx: Transaction;
}): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await params.connection.getLatestBlockhash("confirmed");
  params.tx.feePayer = params.feePayer.publicKey;
  params.tx.recentBlockhash = blockhash;
  params.tx.sign(
    params.feePayer,
    ...(params.signers ?? []).filter((signer) => !signer.publicKey.equals(params.feePayer.publicKey)),
  );
  const signature = await params.connection.sendRawTransaction(params.tx.serialize(), {
    maxRetries: 5,
    skipPreflight: false,
  });
  const confirmation = await params.connection.confirmTransaction(
    { blockhash, lastValidBlockHeight, signature },
    "confirmed",
  );
  if (confirmation.value.err) throw new Error(`${params.label} failed during confirmation.`);
  console.log(`[fresh-devnet] ${params.label}: ${signature}`);
  return signature;
}

async function fundIfNeeded(params: {
  connection: Connection;
  funder: Keypair;
  label: string;
  minimumLamports: bigint;
  recipient: Keypair;
}): Promise<void> {
  const balance = BigInt(await params.connection.getBalance(params.recipient.publicKey, "confirmed"));
  if (balance >= params.minimumLamports) {
    console.log(`[fresh-devnet] fund:${params.label}: ready ${params.recipient.publicKey.toBase58()}`);
    return;
  }
  await sendTransaction({
    connection: params.connection,
    feePayer: params.funder,
    label: `fund:${params.label}`,
    tx: new Transaction().add(SystemProgram.transfer({
      fromPubkey: params.funder.publicKey,
      toPubkey: params.recipient.publicKey,
      lamports: Number(params.minimumLamports - balance),
    })),
    signers: [params.funder],
  });
}

function upsertEnvFile(path: string, updates: Record<string, string>): void {
  const existing = new Map<string, string>();
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
      const separator = line.indexOf("=");
      existing.set(line.slice(0, separator), line.slice(separator + 1));
    }
  }
  for (const [key, value] of Object.entries(updates)) existing.set(key, value);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${[...existing.entries()].map(([key, value]) => `${key}=${value}`).join("\n")}\n`, {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

async function importFreshProtocol(programId: string): Promise<ProtocolModule> {
  process.env.NEXT_PUBLIC_PROTOCOL_PROGRAM_ID = programId;
  process.env.PROTOCOL_PROGRAM_ID = programId;
  const url = `${pathToFileURL(resolve(process.cwd(), "frontend/lib/protocol.ts")).href}?v=${Date.now()}`;
  const module = (await import(url)) as { default?: ProtocolModule } & ProtocolModule;
  return (module.default ?? module) as ProtocolModule;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const stamp = nowStamp();
  const rpcUrl =
    process.env.SOLANA_RPC_URL?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL?.trim()
    || DEFAULT_RPC_URL;
  const funderPath = configuredKeypairPath(
    "OMEGAX_DEVNET_REDEPLOY_FUNDER_KEYPAIR_PATH",
    "OMEGAX_DEVNET_CANARY_FUNDER_KEYPAIR_PATH",
    "SOLANA_KEYPAIR",
  ) ?? DEFAULT_FUNDER_KEYPAIR_PATH;
  const programKeypairPath = configuredKeypairPath("OMEGAX_DEVNET_REDEPLOY_PROGRAM_KEYPAIR_PATH")
    ?? resolve(LOCAL_DEVNET_DIR, `omegax-protocol-program-${stamp}.json`);
  const governanceKeypairPath = configuredKeypairPath("OMEGAX_DEVNET_REDEPLOY_GOVERNANCE_KEYPAIR_PATH")
    ?? configuredKeypairPath("OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH")
    ?? resolve(LOCAL_DEVNET_DIR, `omegax-protocol-governance-${stamp}.json`);
  const bufferKeypairPath = configuredKeypairPath("OMEGAX_DEVNET_REDEPLOY_BUFFER_KEYPAIR_PATH")
    ?? resolve(LOCAL_DEVNET_DIR, `omegax-protocol-buffer-${stamp}.json`);

  const funder = keypairFromFile(funderPath);
  const program = writeKeypairIfMissing(programKeypairPath);
  const governance = writeKeypairIfMissing(governanceKeypairPath);
  writeKeypairIfMissing(bufferKeypairPath);
  const programId = program.publicKey.toBase58();
  const governanceAuthority = governance.publicKey.toBase58();
  const connection = wrapConnectionWithRpcRetry(new Connection(rpcUrl, "confirmed"), {
    labelPrefix: "fresh-devnet",
    logPrefix: "fresh-devnet",
  });

  console.log(`[fresh-devnet] rpc=${rpcUrl.includes("?") ? `${rpcUrl.slice(0, rpcUrl.indexOf("?"))}?...` : rpcUrl}`);
  console.log(`[fresh-devnet] funder=${funder.publicKey.toBase58()}`);
  console.log(`[fresh-devnet] programId=${programId}`);
  console.log(`[fresh-devnet] governanceAuthority=${governanceAuthority}`);

  await fundIfNeeded({
    connection,
    funder,
    recipient: governance,
    minimumLamports: BigInt(process.env.OMEGAX_DEVNET_GOVERNANCE_MIN_LAMPORTS ?? String(LAMPORTS_PER_SOL)),
    label: "protocol-governance",
  });

  const anchorBackup = readIfExists(ANCHOR_TOML_PATH);
  const libBackup = readIfExists(PROGRAM_LIB_PATH);
  const targetKeypairBackup = readIfExists(TARGET_PROGRAM_KEYPAIR_PATH);
  if (anchorBackup === null || libBackup === null) {
    throw new Error("Missing Anchor.toml or program lib.rs; cannot build fresh devnet binary.");
  }

  try {
    writeFileSync(ANCHOR_TOML_PATH, replaceProgramId(anchorBackup, programId));
    writeFileSync(PROGRAM_LIB_PATH, replaceProgramId(libBackup, programId));
    mkdirSync(dirname(TARGET_PROGRAM_KEYPAIR_PATH), { recursive: true });
    writeFileSync(TARGET_PROGRAM_KEYPAIR_PATH, JSON.stringify(Array.from(program.secretKey)), { mode: 0o600 });
    chmodSync(TARGET_PROGRAM_KEYPAIR_PATH, 0o600);

    run("npm", ["run", "anchor:build:checked"], {
      ...process.env,
      NEXT_PUBLIC_PROTOCOL_PROGRAM_ID: programId,
      PROTOCOL_PROGRAM_ID: programId,
    });

    const deployArgs = [
      "program",
      "deploy",
      PROGRAM_SO_PATH,
      "--buffer",
      bufferKeypairPath,
      "--program-id",
      programKeypairPath,
      "--upgrade-authority",
      governanceKeypairPath,
      "--fee-payer",
      funderPath,
      "--keypair",
      funderPath,
      "--url",
      rpcUrl,
      "--max-sign-attempts",
      process.env.OMEGAX_DEVNET_REDEPLOY_MAX_SIGN_ATTEMPTS?.trim() || "12",
      ...deployTransportArgs(),
    ];
    const computeUnitPrice = process.env.OMEGAX_DEVNET_REDEPLOY_COMPUTE_UNIT_PRICE?.trim();
    if (computeUnitPrice) {
      deployArgs.push("--with-compute-unit-price", computeUnitPrice);
    }

    run("solana", deployArgs);
  } finally {
    restoreFile(ANCHOR_TOML_PATH, anchorBackup);
    restoreFile(PROGRAM_LIB_PATH, libBackup);
    restoreFile(TARGET_PROGRAM_KEYPAIR_PATH, targetKeypairBackup);
  }

  const protocol = await importFreshProtocol(programId);
  const governanceAddress = protocol.deriveProtocolGovernancePda();
  const liveGovernance = await connection.getAccountInfo(governanceAddress, "confirmed");
  if (!liveGovernance) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "initialize_protocol_governance:fresh-devnet",
      tx: protocol.buildInitializeProtocolGovernanceTx({
        governanceAuthority: governance.publicKey,
        protocolFeeBps: 50,
        emergencyPaused: false,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signers: [governance],
    });
  }

  const envUpdates = {
    NEXT_PUBLIC_PROTOCOL_PROGRAM_ID: programId,
    PROTOCOL_PROGRAM_ID: programId,
    NEXT_PUBLIC_GOVERNANCE_CONFIG: governanceAuthority,
    NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET: governanceAuthority,
    OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH: governanceKeypairPath,
    OMEGAX_DEVNET_REDEPLOY_PROGRAM_ID: programId,
    OMEGAX_DEVNET_REDEPLOY_PROGRAM_KEYPAIR_PATH: programKeypairPath,
    OMEGAX_DEVNET_REDEPLOY_BUFFER_KEYPAIR_PATH: bufferKeypairPath,
  };
  upsertEnvFile(resolve(process.cwd(), ".env.local"), envUpdates);
  upsertEnvFile(resolve(process.cwd(), "frontend/.env.local"), envUpdates);
  writeFileSync(
    resolve(LOCAL_DEVNET_DIR, "latest-fresh-devnet.env"),
    `${Object.entries(envUpdates).map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
    { mode: 0o600 },
  );

  const snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  console.log(JSON.stringify({
    programId,
    protocolGovernance: snapshot.protocolGovernance?.address ?? null,
    governanceAuthority: snapshot.protocolGovernance?.governanceAuthority ?? null,
    nextCommands: [
      "npm run protocol:bootstrap:devnet-live",
      "npm run devnet:treasury:seed-canaries",
      "npm run devnet:treasury:pen-test -- --strict",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
