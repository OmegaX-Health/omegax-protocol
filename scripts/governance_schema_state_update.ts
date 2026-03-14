// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  AccountMetaData,
  InstructionData,
  YesNoVote,
  Vote,
  VoteType,
  getGovernance,
  getGovernanceProgramVersion,
  getProposal,
  getTokenOwnerRecordAddress,
  getTokenOwnerRecordForRealm,
  withCastVote,
  withCreateProposal,
  withDepositGoverningTokens,
  withExecuteTransaction,
  withInsertTransaction,
  withSignOffProposal,
} from "@solana/spl-governance";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";

import protocolModule from "../frontend/lib/protocol.ts";

const DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";

const {
  buildBackfillSchemaDependencyLedgerTx,
  buildCloseOutcomeSchemaTx,
  buildVerifyOutcomeSchemaTx,
  listSchemas,
  listPoolRules,
} = protocolModule as unknown as typeof import("../frontend/lib/protocol.ts");

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parsePositiveU64(name: string, fallback: bigint): bigint {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    if (parsed <= 0n) throw new Error("non-positive");
    return parsed;
  } catch {
    throw new Error(`Invalid ${name}: expected positive integer`);
  }
}

function parseHex32List(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/^0x/, ""))
    .filter(Boolean)
    .map((entry) => {
      if (!/^[0-9a-f]{64}$/.test(entry)) {
        throw new Error(`Invalid 32-byte hex value: ${entry}`);
      }
      return entry;
    });
}

function dedupeHex32(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase().replace(/^0x/, "")).filter(Boolean))];
}

function keypairFromBase58(raw: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(raw));
}

function toInstructionData(ix: TransactionInstruction): InstructionData {
  return new InstructionData({
    programId: ix.programId,
    accounts: ix.keys.map((meta) =>
      new AccountMetaData({
        pubkey: meta.pubkey,
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      })),
    data: Uint8Array.from(ix.data),
  });
}

async function sendAndConfirm(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  label: string,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: blockhash,
  }).add(...instructions);
  tx.sign(payer);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 5,
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  console.log(`[schema-governance] ${label}: ${signature}`);
  return signature;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rpcUrl =
    String(process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "").trim()
    || "https://api.devnet.solana.com";
  const governanceProgramId = new PublicKey(
    String(process.env.GOVERNANCE_PROGRAM_ID || DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID).trim(),
  );
  const governanceCluster = String(process.env.GOVERNANCE_CLUSTER || "devnet").trim();
  const governanceAddress = new PublicKey(requireEnv("GOVERNANCE_CONFIG"));
  const governanceRealm = new PublicKey(requireEnv("GOVERNANCE_REALM"));
  const governanceTokenMint = new PublicKey(requireEnv("GOVERNANCE_TOKEN_MINT"));
  const governanceSecret = requireEnv("GOVERNANCE_SECRET_KEY_BASE58");
  const holdUpSeconds = Number.parseInt(String(process.env.GOVERNANCE_HOLD_UP_SECONDS || "900").trim(), 10);
  if (!Number.isFinite(holdUpSeconds) || holdUpSeconds < 0) {
    throw new Error("Invalid GOVERNANCE_HOLD_UP_SECONDS: expected integer >= 0");
  }
  const targetDepositAmount = parsePositiveU64("GOVERNANCE_TARGET_DEPOSIT_AMOUNT", 700_000n);

  const verifySchemaHashHex =
    String(
      process.env.VERIFY_SCHEMA_KEY_HASH_HEX || "57690ad212710f5a11f98dc908868c017cb60d36e503cb6db01b463b0f845fa7",
    )
      .trim()
      .toLowerCase()
      .replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(verifySchemaHashHex)) {
    throw new Error("VERIFY_SCHEMA_KEY_HASH_HEX must be a 32-byte hex value");
  }

  const unverifySchemaHashesRaw =
    String(
      process.env.UNVERIFY_SCHEMA_KEY_HASHES
      || "087d73448b5edfabb2fca3f20c88e826f87a944dd26a944a0328ea9dea4eac8e,5fbefd09e88651c0df8683cf1cf022bcc9cd66d76b7afe2cb20d0fbc800cb1f2",
    ).trim();
  const closeSchemaHashesRaw = String(process.env.CLOSE_SCHEMA_KEY_HASHES || "").trim();
  const closeSchemaHashes = parseHex32List(closeSchemaHashesRaw).filter((value) => value !== verifySchemaHashHex);
  const backfillSchemaHashesRaw = String(process.env.BACKFILL_SCHEMA_KEY_HASHES || "").trim();
  const backfillSchemaHashes = parseHex32List(backfillSchemaHashesRaw).filter((value) => value !== verifySchemaHashHex);
  const unverifySchemaHashes = dedupeHex32(
    parseHex32List(unverifySchemaHashesRaw)
      .filter((value) => value !== verifySchemaHashHex)
      .concat(closeSchemaHashes),
  );
  const effectiveBackfillHashes = dedupeHex32([...backfillSchemaHashes, ...closeSchemaHashes]);

  const governanceSigner = keypairFromBase58(governanceSecret);
  const connection = new Connection(rpcUrl, "confirmed");

  let governanceProgramVersion = await getGovernanceProgramVersion(connection, governanceProgramId, governanceCluster);
  if (
    governanceProgramVersion === 1
    && governanceProgramId.toBase58() === DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID
  ) {
    governanceProgramVersion = 3;
  }

  const governance = await getGovernance(connection, governanceAddress);
  const tokenOwnerRecordAddress = await getTokenOwnerRecordAddress(
    governanceProgramId,
    governanceRealm,
    governanceTokenMint,
    governanceSigner.publicKey,
  );
  const tokenOwnerRecordInfo = await connection.getAccountInfo(tokenOwnerRecordAddress, "confirmed");
  const tokenOwnerRecordExists = tokenOwnerRecordInfo != null;

  console.log(`[schema-governance] rpc_url=${rpcUrl}`);
  console.log(`[schema-governance] governance_program_id=${governanceProgramId.toBase58()}`);
  console.log(`[schema-governance] governance_program_version=${governanceProgramVersion}`);
  console.log(`[schema-governance] governance_address=${governanceAddress.toBase58()}`);
  console.log(`[schema-governance] governance_realm=${governanceRealm.toBase58()}`);
  console.log(`[schema-governance] governance_signer=${governanceSigner.publicKey.toBase58()}`);
  console.log(`[schema-governance] token_owner_record=${tokenOwnerRecordAddress.toBase58()}`);
  console.log(`[schema-governance] token_owner_record_exists=${tokenOwnerRecordExists}`);
  console.log(`[schema-governance] verify_schema_key_hash=${verifySchemaHashHex}`);
  console.log(`[schema-governance] unverify_schema_key_hashes=${unverifySchemaHashes.join(",") || "(none)"}`);
  console.log(`[schema-governance] backfill_schema_key_hashes=${effectiveBackfillHashes.join(",") || "(none)"}`);
  console.log(`[schema-governance] close_schema_key_hashes=${closeSchemaHashes.join(",") || "(none)"}`);
  console.log(
    `[schema-governance] min_instruction_hold_up_time=${governance.account.config.minInstructionHoldUpTime}`,
  );
  console.log(`[schema-governance] base_voting_time=${governance.account.config.baseVotingTime}`);
  const signerTokenAta = await getAssociatedTokenAddress(governanceTokenMint, governanceSigner.publicKey, false);
  const signerTokenAccount = await getAccount(connection, signerTokenAta, "confirmed");
  let currentDeposit = 0n;
  if (tokenOwnerRecordExists) {
    const tokenOwnerRecord = await getTokenOwnerRecordForRealm(
      connection,
      governanceProgramId,
      governanceRealm,
      governanceTokenMint,
      governanceSigner.publicKey,
    );
    currentDeposit = BigInt(tokenOwnerRecord.account.governingTokenDepositAmount.toString());
  }
  console.log(`[schema-governance] signer_token_ata=${signerTokenAta.toBase58()}`);
  console.log(`[schema-governance] signer_wallet_tokens=${signerTokenAccount.amount.toString()}`);
  console.log(`[schema-governance] signer_deposited_tokens=${currentDeposit.toString()}`);

  if (currentDeposit < targetDepositAmount) {
    const delta = targetDepositAmount - currentDeposit;
    if (BigInt(signerTokenAccount.amount.toString()) < delta) {
      throw new Error(
        `Insufficient wallet tokens for governance deposit top-up. need=${delta.toString()} available=${signerTokenAccount.amount.toString()}`,
      );
    }
    const depositInstructions: TransactionInstruction[] = [];
    await withDepositGoverningTokens(
      depositInstructions,
      governanceProgramId,
      governanceProgramVersion,
      governanceRealm,
      signerTokenAta,
      governanceTokenMint,
      governanceSigner.publicKey,
      governanceSigner.publicKey,
      governanceSigner.publicKey,
      new BN(delta.toString()),
      true,
    );
    await sendAndConfirm(connection, governanceSigner, depositInstructions, "deposit_governing_tokens");
  } else {
    console.log("[schema-governance] deposit_governing_tokens: already sufficient");
  }

  const tokenOwnerRecord = await getTokenOwnerRecordForRealm(
    connection,
    governanceProgramId,
    governanceRealm,
    governanceTokenMint,
    governanceSigner.publicKey,
  );
  currentDeposit = BigInt(tokenOwnerRecord.account.governingTokenDepositAmount.toString());
  console.log(`[schema-governance] signer_deposited_tokens_post_topup=${currentDeposit.toString()}`);

  const noopRecentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  const verifyInstruction = buildVerifyOutcomeSchemaTx({
    governanceAuthority: governanceAddress,
    recentBlockhash: noopRecentBlockhash,
    schemaKeyHashHex: verifySchemaHashHex,
    verified: true,
  }).instructions[0];
  if (!verifyInstruction) {
    throw new Error("Failed to build verify instruction.");
  }

  const unverifyInstructions = unverifySchemaHashes.map((schemaKeyHashHex) =>
    buildVerifyOutcomeSchemaTx({
      governanceAuthority: governanceAddress,
      recentBlockhash: noopRecentBlockhash,
      schemaKeyHashHex,
      verified: false,
    }).instructions[0],
  );
  if (unverifyInstructions.some((instruction) => !instruction)) {
    throw new Error("Failed to build one or more unverify instructions.");
  }

  const backfillInstructionEntries = await Promise.all(
    effectiveBackfillHashes.map(async (schemaKeyHashHex) => {
      const enabledRules = await listPoolRules({
        connection,
        schemaKeyHashHex,
        enabledOnly: true,
      });
      if (closeSchemaHashes.includes(schemaKeyHashHex) && enabledRules.length > 0) {
        throw new Error(
          `Cannot close schema ${schemaKeyHashHex}: ${enabledRules.length} enabled pool rule(s) still reference it.`,
        );
      }
      const instruction = buildBackfillSchemaDependencyLedgerTx({
        governanceAuthority: governanceAddress,
        recentBlockhash: noopRecentBlockhash,
        schemaKeyHashHex,
        poolRuleAddresses: enabledRules.map((row) => new PublicKey(row.address)),
      }).instructions[0];
      if (!instruction) {
        throw new Error(`Failed to build backfill instruction for schema ${schemaKeyHashHex}.`);
      }
      return { schemaKeyHashHex, instruction, enabledRuleCount: enabledRules.length };
    }),
  );
  for (const entry of backfillInstructionEntries) {
    console.log(
      `[schema-governance] backfill_schema_dependency_ledger ${entry.schemaKeyHashHex}: enabled_rules=${entry.enabledRuleCount}`,
    );
  }

  const closeInstructions = closeSchemaHashes.map((schemaKeyHashHex) =>
    buildCloseOutcomeSchemaTx({
      governanceAuthority: governanceAddress,
      recipientSystemAccount: governanceAddress,
      recentBlockhash: noopRecentBlockhash,
      schemaKeyHashHex,
    }).instructions[0],
  );
  if (closeInstructions.some((instruction) => !instruction)) {
    throw new Error("Failed to build one or more close instructions.");
  }
  const proposalName = `Schema state update ${new Date().toISOString().slice(0, 10)}`;
  const proposalDescription =
    "https://protocol.omegax.health/governance/schema-state-update";

  const createProposalIxs: TransactionInstruction[] = [];
  const proposalAddress = await withCreateProposal(
    createProposalIxs,
    governanceProgramId,
    governanceProgramVersion,
    governanceRealm,
    governanceAddress,
    tokenOwnerRecord.pubkey,
    proposalName,
    proposalDescription,
    governanceTokenMint,
    governanceSigner.publicKey,
    undefined,
    VoteType.SINGLE_CHOICE,
    ["Approve"],
    true,
    governanceSigner.publicKey,
  );
  await sendAndConfirm(connection, governanceSigner, createProposalIxs, "create_proposal");
  console.log(`[schema-governance] proposal=${proposalAddress.toBase58()}`);

  const insertedTransactions: Array<{ address: PublicKey; instructions: TransactionInstruction[] }> = [];
  const allProposalInstructions: TransactionInstruction[] = [
    verifyInstruction,
    ...unverifyInstructions,
    ...backfillInstructionEntries.map((entry) => entry.instruction),
    ...closeInstructions,
  ];
  for (let index = 0; index < allProposalInstructions.length; index += 1) {
    const instruction = allProposalInstructions[index]!;
    const insertIxs: TransactionInstruction[] = [];
    const proposalTransactionAddress = await withInsertTransaction(
      insertIxs,
      governanceProgramId,
      governanceProgramVersion,
      governanceAddress,
      proposalAddress,
      tokenOwnerRecord.pubkey,
      governanceSigner.publicKey,
      index,
      0,
      holdUpSeconds,
      [toInstructionData(instruction)],
      governanceSigner.publicKey,
    );
    await sendAndConfirm(connection, governanceSigner, insertIxs, `insert_transaction_${index}`);
    insertedTransactions.push({ address: proposalTransactionAddress, instructions: [instruction] });
  }

  const signOffIxs: TransactionInstruction[] = [];
  withSignOffProposal(
    signOffIxs,
    governanceProgramId,
    governanceProgramVersion,
    governanceRealm,
    governanceAddress,
    proposalAddress,
    governanceSigner.publicKey,
    undefined,
    tokenOwnerRecord.pubkey,
  );
  await sendAndConfirm(connection, governanceSigner, signOffIxs, "sign_off_proposal");

  const voteIxs: TransactionInstruction[] = [];
  await withCastVote(
    voteIxs,
    governanceProgramId,
    governanceProgramVersion,
    governanceRealm,
    governanceAddress,
    proposalAddress,
    tokenOwnerRecord.pubkey,
    tokenOwnerRecord.pubkey,
    governanceSigner.publicKey,
    governanceTokenMint,
    Vote.fromYesNoVote(YesNoVote.Yes),
    governanceSigner.publicKey,
  );
  await sendAndConfirm(connection, governanceSigner, voteIxs, "cast_vote_yes");

  let latestProposal = await getProposal(connection, proposalAddress);
  console.log(`[schema-governance] proposal_state_after_vote=${latestProposal.account.state}`);

  const waitForSucceededDeadline = Date.now() + 180_000;
  while (latestProposal.account.state === 2 && Date.now() < waitForSucceededDeadline) {
    await sleep(5000);
    latestProposal = await getProposal(connection, proposalAddress);
    console.log(`[schema-governance] proposal_state_poll=${latestProposal.account.state}`);
  }

  if (latestProposal.account.state !== 3 && latestProposal.account.state !== 4 && latestProposal.account.state !== 5) {
    throw new Error(
      `Proposal did not reach executable state. current_state=${latestProposal.account.state}. Wait for vote finalization and execute later.`,
    );
  }

  for (let index = 0; index < insertedTransactions.length; index += 1) {
    const item = insertedTransactions[index]!;
    let executed = false;
    const executeDeadline = Date.now() + 1_800_000; // 30 min safety window for hold-up.

    while (!executed && Date.now() < executeDeadline) {
      const executeIxs: TransactionInstruction[] = [];
      await withExecuteTransaction(
        executeIxs,
        governanceProgramId,
        governanceProgramVersion,
        governanceAddress,
        proposalAddress,
        item.address,
        item.instructions.map((ix) => toInstructionData(ix)),
      );
      try {
        await sendAndConfirm(connection, governanceSigner, executeIxs, `execute_transaction_${index}`);
        executed = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const holdUpBlocked =
          message.includes("CannotExecuteTransactionWithinHoldUpTime")
          || message.includes("cannot execute transaction within hold up time")
          || message.includes("hold up");
        if (!holdUpBlocked) {
          throw error;
        }
        console.log(`[schema-governance] execute_transaction_${index}: waiting for hold-up window...`);
        await sleep(15_000);
      }
    }

    if (!executed) {
      throw new Error(`Timed out waiting to execute proposal transaction index=${index}.`);
    }
  }

  const finalSchemas = await listSchemas({ connection, verifiedOnly: false });
  console.log("[schema-governance] Final schema states:");
  for (const row of finalSchemas) {
    console.log(
      `[schema-governance] ${row.verified ? "verified" : "draft"}\t${row.schemaKey}\tv${row.version}\t${row.schemaKeyHashHex}`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[schema-governance] failed: ${message}`);
  process.exit(1);
});
