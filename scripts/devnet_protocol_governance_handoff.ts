// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { loadEnvFile } from "./support/load_env_file.ts";
import { wrapConnectionWithRpcRetry } from "./support/rpc_retry.ts";
import { keypairFromFile } from "./support/script_helpers.ts";

type ProtocolModule = typeof import("../frontend/lib/protocol.ts");
type Snapshot = Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>;

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_FUNDER_KEYPAIR_PATH = resolve(homedir(), ".config/solana/id.json");
const LOCAL_ROLE_DIR = resolve(homedir(), ".config/solana/omegax-devnet");
const DEFAULT_NEW_GOVERNANCE_KEYPAIR_PATH = resolve(
  LOCAL_ROLE_DIR,
  "protocol-governance-canary.json",
);

const ROLE_WALLETS = [
  "lp-provider",
  "oracle-operator",
  "claim-member",
  "member-delegate",
  "second-member",
  "wrapper-provider",
] as const;

function expandHome(path: string): string {
  return path.replace(/^~(?=\/|$)/, homedir());
}

function loadLocalEnv(): void {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), "frontend/.env.local"));
}

async function importFreshProtocol(): Promise<ProtocolModule> {
  const url = `${pathToFileURL(resolve(process.cwd(), "frontend/lib/protocol.ts")).href}?v=${Date.now()}`;
  const module = (await import(url)) as { default?: ProtocolModule } & ProtocolModule;
  return (module.default ?? module) as ProtocolModule;
}

function keypairPathFromEnv(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return expandHome(value);
  }
  return null;
}

function optionalKeypair(path?: string | null): Keypair | null {
  if (!path || !existsSync(path)) return null;
  return keypairFromFile(path);
}

function loadFunder(): Keypair {
  const path = keypairPathFromEnv(
    "OMEGAX_DEVNET_CANARY_FUNDER_KEYPAIR_PATH",
    "OMEGAX_DEVNET_CANARY_OPERATOR_KEYPAIR_PATH",
    "SOLANA_KEYPAIR",
  ) ?? DEFAULT_FUNDER_KEYPAIR_PATH;
  return keypairFromFile(path);
}

function loadOrCreateKeypair(path: string): Keypair {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path)) return keypairFromFile(path);
  const keypair = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)), { mode: 0o600 });
  chmodSync(path, 0o600);
  return keypair;
}

function roleKeypairPath(name: string): string {
  return resolve(LOCAL_ROLE_DIR, `${name}.json`);
}

async function sendTransaction(params: {
  connection: Connection;
  feePayer: Keypair;
  label: string;
  tx: Transaction;
  signers?: Keypair[];
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
  if (confirmation.value.err) {
    throw new Error(`${params.label} failed during confirmation.`);
  }
  console.log(`[governance-handoff] ${params.label}: ${signature}`);
  return signature;
}

async function fundIfNeeded(params: {
  connection: Connection;
  funder: Keypair;
  recipient: PublicKey;
  minimumLamports: bigint;
  label: string;
}): Promise<void> {
  const balance = BigInt(await params.connection.getBalance(params.recipient, "confirmed"));
  if (balance >= params.minimumLamports) {
    console.log(`[governance-handoff] fund:${params.label}: ready ${params.recipient.toBase58()}`);
    return;
  }
  await sendTransaction({
    connection: params.connection,
    feePayer: params.funder,
    label: `fund:${params.label}`,
    tx: new Transaction().add(SystemProgram.transfer({
      fromPubkey: params.funder.publicKey,
      toPubkey: params.recipient,
      lamports: Number(params.minimumLamports - balance),
    })),
    signers: [params.funder],
  });
}

function readEnvLines(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.length > 0);
}

function upsertEnvFile(path: string, updates: Record<string, string>): void {
  mkdirSync(dirname(path), { recursive: true });
  const next = new Map<string, string>();
  const passthrough: string[] = [];
  for (const line of readEnvLines(path)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) {
      passthrough.push(line);
      continue;
    }
    const key = line.slice(0, line.indexOf("="));
    if (Object.prototype.hasOwnProperty.call(updates, key)) continue;
    next.set(key, line.slice(line.indexOf("=") + 1));
  }
  for (const [key, value] of Object.entries(updates)) {
    next.set(key, value);
  }
  const body = [
    ...passthrough,
    ...Array.from(next.entries()).map(([key, value]) => `${key}=${value}`),
  ].join("\n");
  writeFileSync(path, `${body}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function currentGovernanceSigner(snapshot: Snapshot, funder: Keypair): Keypair | null {
  const expected = snapshot.protocolGovernance?.governanceAuthority;
  if (!expected) return funder;
  if (funder.publicKey.toBase58() === expected) return funder;
  const candidates = [
    keypairPathFromEnv("OMEGAX_DEVNET_CURRENT_PROTOCOL_GOVERNANCE_KEYPAIR_PATH"),
    keypairPathFromEnv("OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH"),
  ];
  for (const path of candidates) {
    const keypair = optionalKeypair(path);
    if (keypair?.publicKey.toBase58() === expected) return keypair;
  }
  return null;
}

function redactRpcUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.search) url.search = "?...";
    if (url.username || url.password) {
      url.username = "...";
      url.password = "";
    }
    return url.toString();
  } catch {
    return value.includes("?") ? `${value.slice(0, value.indexOf("?"))}?...` : value;
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const protocol = await importFreshProtocol();
  const rpcUrl =
    process.env.SOLANA_RPC_URL?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL?.trim()
    || DEFAULT_RPC_URL;
  const connection = wrapConnectionWithRpcRetry(new Connection(rpcUrl, "confirmed"), {
    labelPrefix: "governance-handoff",
    logPrefix: "governance-handoff",
  });
  const funder = loadFunder();
  const newGovernancePath = keypairPathFromEnv("OMEGAX_DEVNET_NEW_PROTOCOL_GOVERNANCE_KEYPAIR_PATH")
    ?? DEFAULT_NEW_GOVERNANCE_KEYPAIR_PATH;
  const newGovernance = loadOrCreateKeypair(newGovernancePath);

  const governanceMinimumLamports = BigInt(
    process.env.OMEGAX_DEVNET_GOVERNANCE_MIN_LAMPORTS?.trim()
      ?? String(LAMPORTS_PER_SOL),
  );
  const roleMinimumLamports = BigInt(
    process.env.OMEGAX_DEVNET_ROLE_MIN_LAMPORTS?.trim()
      ?? String(Math.floor(0.25 * LAMPORTS_PER_SOL)),
  );

  console.log(`[governance-handoff] rpc=${redactRpcUrl(rpcUrl)}`);
  console.log(`[governance-handoff] funder=${funder.publicKey.toBase58()}`);
  console.log(`[governance-handoff] pendingGovernance=${newGovernance.publicKey.toBase58()}`);

  await fundIfNeeded({
    connection,
    funder,
    recipient: newGovernance.publicKey,
    minimumLamports: governanceMinimumLamports,
    label: "pending-protocol-governance",
  });
  for (const role of ROLE_WALLETS) {
    const keypair = loadOrCreateKeypair(roleKeypairPath(role));
    await fundIfNeeded({
      connection,
      funder,
      recipient: keypair.publicKey,
      minimumLamports: roleMinimumLamports,
      label: role,
    });
  }

  const localEnvPath = resolve(process.cwd(), "frontend/.env.local");
  upsertEnvFile(localEnvPath, {
    OMEGAX_DEVNET_PENDING_PROTOCOL_GOVERNANCE_WALLET: newGovernance.publicKey.toBase58(),
    OMEGAX_DEVNET_PENDING_PROTOCOL_GOVERNANCE_KEYPAIR_PATH: newGovernancePath,
  });

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveAuthority = snapshot.protocolGovernance?.governanceAuthority ?? "";
  if (liveAuthority === newGovernance.publicKey.toBase58()) {
    upsertEnvFile(localEnvPath, {
      NEXT_PUBLIC_GOVERNANCE_CONFIG: newGovernance.publicKey.toBase58(),
      NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET: newGovernance.publicKey.toBase58(),
      OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH: newGovernancePath,
      OMEGAX_DEVNET_PENDING_PROTOCOL_GOVERNANCE_WALLET: newGovernance.publicKey.toBase58(),
      OMEGAX_DEVNET_PENDING_PROTOCOL_GOVERNANCE_KEYPAIR_PATH: newGovernancePath,
    });
    console.log("[governance-handoff] on-chain authority already matches pending governance.");
    return;
  }

  const currentSigner = currentGovernanceSigner(snapshot, funder);
  if (!currentSigner) {
    console.error(
      `[governance-handoff] BLOCKED: on-chain protocol governance is ${liveAuthority || "unset"}, but no matching local signer is configured. ` +
      "Provide OMEGAX_DEVNET_CURRENT_PROTOCOL_GOVERNANCE_KEYPAIR_PATH or execute an approved governance proposal, then rerun this script.",
    );
    process.exitCode = 3;
    return;
  }

  await sendTransaction({
    connection,
    feePayer: currentSigner,
    label: "rotate_protocol_governance_authority:devnet-rehearsal",
    tx: protocol.buildRotateGovernanceAuthorityTx({
      governanceAuthority: currentSigner.publicKey,
      newAuthority: newGovernance.publicKey,
      recentBlockhash: "11111111111111111111111111111111",
    }),
    signers: [currentSigner],
  });

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const afterAuthority = snapshot.protocolGovernance?.governanceAuthority ?? "";
  if (afterAuthority !== newGovernance.publicKey.toBase58()) {
    throw new Error(`Governance rotation did not take effect. Live authority is ${afterAuthority}.`);
  }

  upsertEnvFile(localEnvPath, {
    NEXT_PUBLIC_GOVERNANCE_CONFIG: newGovernance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET: newGovernance.publicKey.toBase58(),
    OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH: newGovernancePath,
    OMEGAX_DEVNET_PENDING_PROTOCOL_GOVERNANCE_WALLET: newGovernance.publicKey.toBase58(),
    OMEGAX_DEVNET_PENDING_PROTOCOL_GOVERNANCE_KEYPAIR_PATH: newGovernancePath,
  });
  console.log(`[governance-handoff] rotated on-chain authority to ${afterAuthority}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
