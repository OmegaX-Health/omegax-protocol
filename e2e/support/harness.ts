// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  ACCOUNT_SIZE,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { blake3 } from "@noble/hashes/blake3";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Connection,
  Ed25519Program,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  SystemProgram,
  Transaction,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";

import protocolModule from "../../frontend/lib/protocol.ts";
import { decodeAnchorEventsFromLogs } from "./events.ts";
import { hex, idlErrors, instructionNameByDiscriminatorHex, instructionSurface } from "./surface.ts";

const protocol = protocolModule as typeof import("../../frontend/lib/protocol.ts");

export const ZERO_PUBKEY = new PublicKey(protocol.ZERO_PUBKEY);
export const ORACLE_PERMISSION_DATA_ATTEST = 1 << 0;
export const ORACLE_PERMISSION_QUOTE = 1 << 1;
export const ORACLE_PERMISSION_CYCLE_SETTLE = 1 << 2;
export const ORACLE_PERMISSION_CLAIM_SETTLE = 1 << 3;
export const ORACLE_PERMISSION_TREASURY_WITHDRAW = 1 << 4;
export const ORACLE_PERMISSION_FEE_WITHDRAW = 1 << 5;
export const ORACLE_PERMISSION_ALL =
  ORACLE_PERMISSION_DATA_ATTEST
  | ORACLE_PERMISSION_QUOTE
  | ORACLE_PERMISSION_CYCLE_SETTLE
  | ORACLE_PERMISSION_CLAIM_SETTLE
  | ORACLE_PERMISSION_TREASURY_WITHDRAW
  | ORACLE_PERMISSION_FEE_WITHDRAW;

type AccountSnapshot = {
  address: string;
  exists: boolean;
  lamports: bigint;
  owner: string | null;
  dataHash: string | null;
};

type TokenSnapshot = {
  address: string;
  exists: boolean;
  amount: bigint;
  owner: string | null;
  mint: string | null;
};

type SuccessRecord = {
  label: string;
  signature: string;
  instructions: string[];
  events: string[];
  logs: string[];
};

type FailureRecord = {
  caseId: string;
  errorName: string;
  errorCode: number | null;
};

type ScenarioRecord = {
  name: string;
  durationMs: number;
  instructions: string[];
  events: string[];
  successes: string[];
  failures: string[];
};

type SummaryDocument = {
  generatedAt: string;
  rpcUrl: string;
  programId: string;
  selectedScenario: string | null;
  validator: {
    rpcPort: number | null;
    faucetPort: number | null;
    dynamicPortRange: string | null;
    logPath: string | null;
  };
  instructionCoverage: {
    expectedTotal: number;
    covered: string[];
    missing: string[];
    exceptions: Array<{ instruction: string; reason: string }>;
  };
  errorCoverage: {
    expected: FailureRecord[];
    observed: FailureRecord[];
    missing: FailureRecord[];
    exceptions: Array<{ errorName: string; reason: string }>;
  };
  scenarios: ScenarioRecord[];
};

function sha256Hex(value: Uint8Array | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableSorted(values: Iterable<string>) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function parseSendTransactionError(error: unknown): { code: number | null; name: string | null; logs: string[] } {
  const idlByCode = new Map(idlErrors().map((entry) => [entry.code, entry.name]));
  const message = error instanceof Error ? error.message : String(error);
  const logs =
    error instanceof SendTransactionError
      ? error.logs ?? []
      : Array.isArray((error as { logs?: string[] } | undefined)?.logs)
        ? (((error as { logs?: string[] }).logs) ?? [])
        : Array.isArray((error as { transactionLogs?: string[] } | undefined)?.transactionLogs)
          ? (((error as { transactionLogs?: string[] }).transactionLogs) ?? [])
        : [];

  const anchorMatch = /custom program error: 0x([0-9a-f]+)/i.exec(message);
  if (anchorMatch) {
    const code = Number.parseInt(anchorMatch[1], 16);
    return {
      code,
      name: idlByCode.get(code) ?? null,
      logs,
    };
  }

  const explicitName = /Error Code: ([A-Za-z0-9_]+)/.exec(message)?.[1] ?? null;
  const explicitNumber = /Error Number: (\d+)/.exec(message)?.[1];
  if (explicitName || explicitNumber) {
    const code = explicitNumber ? Number.parseInt(explicitNumber, 10) : null;
    return {
      code,
      name: explicitName ?? (code != null ? idlByCode.get(code) ?? null : null),
      logs,
    };
  }

  for (const line of logs) {
    const logName = /Error Code: ([A-Za-z0-9_]+)/.exec(line)?.[1] ?? null;
    const logNumber = /Error Number: (\d+)/.exec(line)?.[1];
    if (logName || logNumber) {
      const code = logNumber ? Number.parseInt(logNumber, 10) : null;
      return {
        code,
        name: logName ?? (code != null ? idlByCode.get(code) ?? null : null),
        logs,
      };
    }
    const logHex = /custom program error: 0x([0-9a-f]+)/i.exec(line);
    if (logHex) {
      const code = Number.parseInt(logHex[1], 16);
      return {
        code,
        name: idlByCode.get(code) ?? null,
        logs,
      };
    }
  }

  return { code: null, name: null, logs };
}

export class LocalnetHarness {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly instructionByDiscriminator = instructionNameByDiscriminatorHex();
  readonly expectedInstructions = stableSorted(instructionSurface().map((instruction) => instruction.name));
  readonly coveredInstructions = new Set<string>();
  readonly observedFailures: FailureRecord[] = [];
  readonly scenarioRecords: ScenarioRecord[] = [];
  readonly selectedScenario = String(process.env.OMEGAX_E2E_SCENARIO ?? "").trim() || null;
  readonly summaryPath = resolve(
    process.env.OMEGAX_E2E_SUMMARY_PATH ?? "artifacts/localnet-e2e-summary.json",
  );

  constructor() {
    const rpcUrl = String(process.env.SOLANA_RPC_URL ?? "").trim();
    const wsEndpoint = String(process.env.OMEGAX_E2E_WS_URL ?? "").trim() || undefined;
    if (!rpcUrl) {
      throw new Error("SOLANA_RPC_URL is required for the localnet E2E harness");
    }
    this.connection = new Connection(rpcUrl, {
      commitment: "confirmed",
      wsEndpoint,
      disableRetryOnRateLimit: true,
    });
    this.programId = protocol.getProgramId();
  }

  async fundedKeypair(lamports = 25n * BigInt(LAMPORTS_PER_SOL)) {
    const signer = Keypair.generate();
    await this.airdrop(signer.publicKey, lamports);
    return signer;
  }

  async airdrop(address: PublicKey, lamports: bigint) {
    if (lamports <= 0n) {
      return;
    }
    const signature = await this.connection.requestAirdrop(address, Number(lamports));
    await this.waitForSignature(signature);
  }

  async latestBlockhash() {
    return (await this.connection.getLatestBlockhash("confirmed")).blockhash;
  }

  async send(
    label: string,
    tx: Transaction,
    signers: Keypair[],
    lookupTables: AddressLookupTableAccount[] = [],
  ): Promise<SuccessRecord> {
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");
    const signature = await this.connection.sendRawTransaction(
      this.serializeTransaction(tx, signers, blockhash, lookupTables),
      { skipPreflight: false, maxRetries: 20 },
    );
    const confirmation = await this.waitForSignature(signature, lastValidBlockHeight);
    if (confirmation.value.err) {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      const error = new Error(`${label} failed to confirm: ${JSON.stringify(confirmation.value.err)}`) as Error & {
        logs?: string[];
      };
      error.logs = transaction?.meta?.logMessages ?? [];
      throw error;
    }
    const transaction = await this.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const logs = transaction?.meta?.logMessages ?? [];
    const events = decodeAnchorEventsFromLogs(logs);
    const instructionNames = tx.instructions
      .filter((instruction) => instruction.programId.equals(this.programId))
      .map((instruction) => {
        const discriminatorHex = hex(instruction.data.subarray(0, 8));
        const instructionName = this.instructionByDiscriminator.get(discriminatorHex);
        if (!instructionName) {
          throw new Error(`Unknown protocol discriminator ${discriminatorHex} for ${label}`);
        }
        this.coveredInstructions.add(instructionName);
        return instructionName;
      });
    return {
      label,
      signature,
      instructions: instructionNames,
      events: events.map((event) => event.name),
      logs,
    };
  }

  async expectCustomError(params: {
    caseId: string;
    expectedErrorName: string;
    tx: Transaction;
    signers: Keypair[];
    unchangedAddresses?: PublicKey[];
    lookupTables?: AddressLookupTableAccount[];
  }) {
    const before = params.unchangedAddresses
      ? await Promise.all(params.unchangedAddresses.map((address) => this.snapshotAccount(address)))
      : [];

    try {
      await this.send(params.caseId, params.tx, params.signers, params.lookupTables ?? []);
      throw new Error(`Expected ${params.expectedErrorName} for ${params.caseId}, but transaction succeeded`);
    } catch (error) {
      const parsed = parseSendTransactionError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      assert.equal(
        parsed.name,
        params.expectedErrorName,
        `${params.caseId} returned ${parsed.name ?? "unknown"} instead of ${params.expectedErrorName}\n${errorMessage}\n${parsed.logs.join("\n")}`,
      );
      this.observedFailures.push({
        caseId: params.caseId,
        errorName: params.expectedErrorName,
        errorCode: parsed.code,
      });
      if (params.unchangedAddresses && params.unchangedAddresses.length > 0) {
        const after = await Promise.all(params.unchangedAddresses.map((address) => this.snapshotAccount(address)));
        assert.deepEqual(after, before, `${params.caseId} mutated state on expected failure`);
      }
    }
  }

  async snapshotAccount(address: PublicKey): Promise<AccountSnapshot> {
    const info = await this.connection.getAccountInfo(address, "confirmed");
    if (!info) {
      return {
        address: address.toBase58(),
        exists: false,
        lamports: 0n,
        owner: null,
        dataHash: null,
      };
    }
    return {
      address: address.toBase58(),
      exists: true,
      lamports: BigInt(info.lamports),
      owner: info.owner.toBase58(),
      dataHash: sha256Hex(info.data),
    };
  }

  async snapshotTokenAccount(address: PublicKey): Promise<TokenSnapshot> {
    try {
      const account = await getAccount(this.connection, address, "confirmed");
      return {
        address: address.toBase58(),
        exists: true,
        amount: account.amount,
        owner: account.owner.toBase58(),
        mint: account.mint.toBase58(),
      };
    } catch {
      return {
        address: address.toBase58(),
        exists: false,
        amount: 0n,
        owner: null,
        mint: null,
      };
    }
  }

  async createMint(authority: Keypair, decimals = 6) {
    const mint = Keypair.generate();
    const lamports = await this.connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        authority.publicKey,
        null,
        TOKEN_PROGRAM_ID,
      ),
    );
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = await this.latestBlockhash();
    tx.sign(authority, mint);
    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await this.waitForSignature(signature);
    return mint.publicKey;
  }

  async getOrCreateAta(params: { payer: Keypair; mint: PublicKey; owner: PublicKey }) {
    const address = getAssociatedTokenAddressSync(params.mint, params.owner, true);
    const existing = await this.connection.getAccountInfo(address, "confirmed");
    if (!existing) {
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          params.payer.publicKey,
          address,
          params.owner,
          params.mint,
        ),
      );
      tx.feePayer = params.payer.publicKey;
      tx.recentBlockhash = await this.latestBlockhash();
      tx.sign(params.payer);
      const signature = await this.connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await this.waitForSignature(signature);
    }
    return { address };
  }

  async mintTo(params: {
    payer: Keypair;
    mint: PublicKey;
    destination: PublicKey;
    authority: Keypair;
    amount: bigint;
  }) {
    const tx = new Transaction().add(
      createMintToInstruction(
        params.mint,
        params.destination,
        params.authority.publicKey,
        Number(params.amount),
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
    tx.feePayer = params.payer.publicKey;
    tx.recentBlockhash = await this.latestBlockhash();
    if (params.payer.publicKey.equals(params.authority.publicKey)) {
      tx.sign(params.payer);
    } else {
      tx.sign(params.payer, params.authority);
    }
    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await this.waitForSignature(signature);
  }

  associatedTokenAddress(mint: PublicKey, authority: PublicKey, allowOwnerOffCurve = false) {
    return getAssociatedTokenAddressSync(mint, authority, allowOwnerOffCurve);
  }

  async createLookupTable(authority: Keypair, addresses: PublicKey[]) {
    const uniqueAddresses = stableSorted(addresses.map((address) => address.toBase58()))
      .map((address) => new PublicKey(address))
      .filter((address) => !address.equals(authority.publicKey));
    const recentSlot = Math.max(
      (await this.connection.getLatestBlockhashAndContext("confirmed")).context.slot - 1,
      0,
    );
    const [createIx, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
      authority: authority.publicKey,
      payer: authority.publicKey,
      recentSlot,
    });
    await this.sendRawLegacy(authority, [createIx]);

    for (let index = 0; index < uniqueAddresses.length; index += 20) {
      const extendIx = AddressLookupTableProgram.extendLookupTable({
        authority: authority.publicKey,
        payer: authority.publicKey,
        lookupTable: lookupTableAddress,
        addresses: uniqueAddresses.slice(index, index + 20),
      });
      await this.sendRawLegacy(authority, [extendIx]);
    }
    await this.waitForSlotAfter((await this.connection.getLatestBlockhashAndContext("confirmed")).context.slot);

    for (let attempts = 0; attempts < 20; attempts += 1) {
      const lookup = (await this.connection.getAddressLookupTable(lookupTableAddress)).value;
      if (lookup && lookup.state.addresses.length >= uniqueAddresses.length) {
        return lookup;
      }
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
    }
    throw new Error(`lookup table ${lookupTableAddress.toBase58()} was not ready in time`);
  }

  sha256Hex(label: string) {
    return createHash("sha256").update(label).digest("hex");
  }

  async quoteVerificationInstruction(params: {
    oracle: Keypair;
    poolAddress: PublicKey;
    member: PublicKey;
    seriesRefHashHex: string;
    paymentMint?: PublicKey;
    premiumAmountRaw: bigint;
    canonicalPremiumAmount: bigint;
    periodIndex: bigint;
    commitmentEnabled: boolean;
    bondAmountRaw: bigint;
    shieldFeeRaw: bigint;
    protocolFeeRaw: bigint;
    oracleFeeRaw: bigint;
    netPoolPremiumRaw: bigint;
    totalAmountRaw: bigint;
    includedShieldCount: number;
    thresholdBps: number;
    outcomeThresholdScore: number;
    cohortHashHex: string;
    expiresAtTs: bigint;
    nonceHashHex: string;
    quoteMetaHashHex: string;
  }) {
    const message = Buffer.concat([
      Buffer.from("omegax:cycle_quote:v2"),
      params.poolAddress.toBuffer(),
      params.member.toBuffer(),
      Buffer.from(params.seriesRefHashHex, "hex"),
      (params.paymentMint ?? ZERO_PUBKEY).toBuffer(),
      this.encodeU64(params.premiumAmountRaw),
      this.encodeU64(params.canonicalPremiumAmount),
      this.encodeU64(params.periodIndex),
      Buffer.from([params.commitmentEnabled ? 1 : 0]),
      this.encodeU64(params.bondAmountRaw),
      this.encodeU64(params.shieldFeeRaw),
      this.encodeU64(params.protocolFeeRaw),
      this.encodeU64(params.oracleFeeRaw),
      this.encodeU64(params.netPoolPremiumRaw),
      this.encodeU64(params.totalAmountRaw),
      Buffer.from([params.includedShieldCount & 0xff]),
      this.encodeU16(params.thresholdBps),
      this.encodeU16(params.outcomeThresholdScore),
      Buffer.from(params.cohortHashHex, "hex"),
      this.encodeI64(params.expiresAtTs),
      Buffer.from(params.nonceHashHex, "hex"),
      Buffer.from(params.quoteMetaHashHex, "hex"),
    ]);
    const quoteHash = Buffer.from(blake3(message, { dkLen: 32 }));
    const signatureMessage = Buffer.concat([
      Buffer.from("omegax:cycle_quote_sig:v2"),
      quoteHash,
    ]);
    const signature = nacl.sign.detached(signatureMessage, params.oracle.secretKey);
    return Ed25519Program.createInstructionWithPublicKey({
      publicKey: params.oracle.publicKey.toBytes(),
      message: signatureMessage,
      signature,
    });
  }

  beginScenario(name: string) {
    const startedAt = Date.now();
    const record: ScenarioRecord = {
      name,
      durationMs: 0,
      instructions: [],
      events: [],
      successes: [],
      failures: [],
    };
    this.scenarioRecords.push(record);
    return {
      record,
      finish: () => {
        record.durationMs = Date.now() - startedAt;
        record.instructions = stableSorted(record.instructions);
        record.events = stableSorted(record.events);
      },
      recordSuccess: (result: SuccessRecord) => {
        record.instructions.push(...result.instructions);
        record.events.push(...result.events);
        record.successes.push(result.label);
      },
      recordFailure: (caseId: string) => {
        record.failures.push(caseId);
      },
    };
  }

  async writeSummary(params: {
    expectedErrorCases: FailureRecord[];
    instructionExceptions: Array<{ instruction: string; reason: string }>;
    errorExceptions: Array<{ errorName: string; reason: string }>;
  }) {
    const covered = stableSorted(this.coveredInstructions);
    const exceptedInstructions = new Set(params.instructionExceptions.map((entry) => entry.instruction));
    const missing = this.expectedInstructions.filter(
      (instruction) => !this.coveredInstructions.has(instruction) && !exceptedInstructions.has(instruction),
    );
    const observedFailureKeys = new Set(
      this.observedFailures.map((failure) => `${failure.caseId}:${failure.errorName}`),
    );
    const missingExpectedFailures = params.expectedErrorCases.filter(
      (failure) => !observedFailureKeys.has(`${failure.caseId}:${failure.errorName}`),
    );
    const document: SummaryDocument = {
      generatedAt: new Date().toISOString(),
      rpcUrl: this.connection.rpcEndpoint,
      programId: this.programId.toBase58(),
      selectedScenario: this.selectedScenario,
      validator: {
        rpcPort: Number.parseInt(process.env.OMEGAX_E2E_RPC_PORT ?? "", 10) || null,
        faucetPort: Number.parseInt(process.env.OMEGAX_E2E_FAUCET_PORT ?? "", 10) || null,
        dynamicPortRange: process.env.OMEGAX_E2E_DYNAMIC_PORT_RANGE ?? null,
        logPath: process.env.OMEGAX_E2E_VALIDATOR_LOG ?? null,
      },
      instructionCoverage: {
        expectedTotal: this.expectedInstructions.length,
        covered,
        missing,
        exceptions: params.instructionExceptions,
      },
      errorCoverage: {
        expected: params.expectedErrorCases,
        observed: this.observedFailures,
        missing: missingExpectedFailures,
        exceptions: params.errorExceptions,
      },
      scenarios: this.scenarioRecords,
    };

    mkdirSync(dirname(this.summaryPath), { recursive: true });
    writeFileSync(
      this.summaryPath,
      JSON.stringify(
        document,
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      ),
      "utf8",
    );
  }

  assertAllInstructionsCovered(instructionExceptions: Array<{ instruction: string; reason: string }>) {
    const exceptedInstructions = new Set(instructionExceptions.map((entry) => entry.instruction));
    const missing = this.expectedInstructions.filter(
      (instruction) => !this.coveredInstructions.has(instruction) && !exceptedInstructions.has(instruction),
    );
    assert.deepEqual(missing, [], `Missing successful instruction coverage: ${missing.join(", ")}`);
  }

  assertExpectedFailureCasesObserved(expectedFailures: FailureRecord[]) {
    const observedFailureKeys = new Set(
      this.observedFailures.map((failure) => `${failure.caseId}:${failure.errorName}`),
    );
    const missing = expectedFailures.filter(
      (failure) => !observedFailureKeys.has(`${failure.caseId}:${failure.errorName}`),
    );
    assert.deepEqual(
      missing,
      [],
      `Missing expected custom-error coverage: ${missing.map((failure) => `${failure.caseId}:${failure.errorName}`).join(", ")}`,
    );
  }

  private encodeU16(value: number) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value, 0);
    return buffer;
  }

  private encodeU64(value: bigint) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(value, 0);
    return buffer;
  }

  private encodeI64(value: bigint) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64LE(value, 0);
    return buffer;
  }

  private serializeTransaction(
    tx: Transaction,
    signers: Keypair[],
    blockhash: string,
    lookupTables: AddressLookupTableAccount[],
  ) {
    if (lookupTables.length === 0) {
      tx.recentBlockhash = blockhash;
      tx.partialSign(...signers);
      return tx.serialize({ requireAllSignatures: true, verifySignatures: true });
    }

    const payerKey = tx.feePayer ?? signers[0]?.publicKey;
    if (!payerKey) {
      throw new Error("cannot compile versioned transaction without a fee payer");
    }
    const message = new TransactionMessage({
      payerKey,
      recentBlockhash: blockhash,
      instructions: tx.instructions,
    }).compileToV0Message(lookupTables);
    const versioned = new VersionedTransaction(message);
    versioned.sign(signers);
    return versioned.serialize();
  }

  private async sendRawLegacy(authority: Keypair, instructions: TransactionInstruction[]) {
    const tx = new Transaction().add(...instructions);
    tx.feePayer = authority.publicKey;
    tx.recentBlockhash = await this.latestBlockhash();
    tx.sign(authority);
    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await this.waitForSignature(signature);
  }

  private async waitForSignature(signature: string, lastValidBlockHeight?: number) {
    const startedAt = Date.now();
    for (;;) {
      const statuses = await this.connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const status = statuses.value[0];
      if (status) {
        if (status.err) {
          return { value: { err: status.err } };
        }
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          return { value: { err: null } };
        }
      }
      if (lastValidBlockHeight != null) {
        const currentBlockHeight = await this.connection.getBlockHeight("confirmed");
        if (currentBlockHeight > lastValidBlockHeight) {
          throw new Error(`Signature ${signature} expired before confirmation`);
        }
      }
      if (Date.now() - startedAt > 90_000) {
        throw new Error(`Timed out waiting for signature ${signature}`);
      }
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 400));
    }
  }

  private async waitForSlotAfter(minSlot: number) {
    for (let attempts = 0; attempts < 20; attempts += 1) {
      const currentSlot = (await this.connection.getLatestBlockhashAndContext("confirmed")).context.slot;
      if (currentSlot > minSlot) {
        return;
      }
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
    }
    throw new Error(`slot did not advance past ${minSlot} in time for lookup-table warmup`);
  }
}

export function assertChanged(before: AccountSnapshot, after: AccountSnapshot, label: string) {
  assert.notDeepEqual(after, before, `${label} did not mutate the expected account state`);
}

export function assertTokenChanged(before: TokenSnapshot, after: TokenSnapshot, label: string) {
  assert.notDeepEqual(after, before, `${label} did not mutate the expected token account state`);
}

export function hashHex(label: string) {
  return createHash("sha256").update(label).digest("hex");
}

export async function ensureFundedTransfer(
  connection: Connection,
  payer: Keypair,
  recipient: PublicKey,
  lamports: bigint,
) {
  if (lamports <= 0n) {
    return;
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports: Number(lamports),
    }),
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(payer);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  const startedAt = Date.now();
  for (;;) {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = statuses.value[0];
    if (status?.err) {
      throw new Error(`transfer ${signature} failed: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return;
    }
    const currentBlockHeight = await connection.getBlockHeight("confirmed");
    if (currentBlockHeight > lastValidBlockHeight) {
      throw new Error(`transfer ${signature} expired before confirmation`);
    }
    if (Date.now() - startedAt > 30_000) {
      throw new Error(`Timed out waiting for transfer ${signature}`);
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 400));
  }
}
