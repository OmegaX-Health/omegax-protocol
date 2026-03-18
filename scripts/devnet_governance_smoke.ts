// SPDX-License-Identifier: AGPL-3.0-or-later

import bs58 from "bs58";
import { InstructionExecutionStatus, ProposalState } from "@solana/spl-governance";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";

import governanceModule from "../frontend/lib/governance.ts";
import protocolModule from "../frontend/lib/protocol.ts";
import {
  applyGovernanceSmokeFrontendEnv,
  computeCreateVoteEarliestExecutionIso,
  computePendingExecutionReadyAtIso,
  readGovernanceWriteSmokeConfig,
  shouldRequestGovernanceSmokeAirdrop,
  timestampedGovernanceSmokeProposalName,
} from "./devnet_governance_smoke_helpers.ts";

const governance = governanceModule as typeof import("../frontend/lib/governance.ts");
const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
type SchemaStateProposalDraft = import("../frontend/lib/governance.ts").SchemaStateProposalDraft;

function usage(): string {
  return [
    "Usage:",
    "  node --import tsx scripts/devnet_governance_smoke.ts create-vote",
    "  node --import tsx scripts/devnet_governance_smoke.ts execute",
    "",
    "Required env:",
    "  SOLANA_RPC_URL",
    "  GOVERNANCE_REALM",
    "  GOVERNANCE_CONFIG",
    "  GOVERNANCE_TOKEN_MINT",
    "  GOVERNANCE_SECRET_KEY_BASE58",
    "",
    "Additional env:",
    "  GOVERNANCE_SMOKE_SCHEMA_KEY_HASH_HEX   required for create-vote",
    "  GOVERNANCE_SMOKE_PROPOSAL_ADDRESS      required for execute",
  ].join("\n");
}

async function sendAndConfirmTransaction(
  connection: Connection,
  signer: Keypair,
  tx: Transaction,
  label: string,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = signer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(signer);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    maxRetries: 5,
    skipPreflight: false,
  });
  const confirmation = await connection.confirmTransaction(
    {
      blockhash,
      lastValidBlockHeight,
      signature,
    },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`${label} failed during confirmation.`);
  }
  console.log(`[governance-smoke] ${label}: ${signature}`);
  return signature;
}

async function maybeAirdropFees(
  connection: Connection,
  signer: Keypair,
  params: {
    airdropLamports: bigint;
    minFeeBalanceLamports: bigint;
  },
): Promise<bigint> {
  const currentLamports = BigInt(await connection.getBalance(signer.publicKey, "confirmed"));
  if (!shouldRequestGovernanceSmokeAirdrop(currentLamports, params.minFeeBalanceLamports)) {
    return currentLamports;
  }

  const signature = await connection.requestAirdrop(
    signer.publicKey,
    Number(params.airdropLamports),
  );
  await connection.confirmTransaction(signature, "confirmed");
  const nextLamports = BigInt(await connection.getBalance(signer.publicKey, "confirmed"));
  console.log(
    `[governance-smoke] fee_airdrop=${signature} balance_lamports=${nextLamports.toString()}`,
  );
  return nextLamports;
}

function assertDashboardMatchesConfig(
  dashboard: NonNullable<Awaited<ReturnType<typeof governance.loadGovernanceDashboard>>>,
  config: ReturnType<typeof readGovernanceWriteSmokeConfig>,
): void {
  if (dashboard.realmAddress !== config.realmAddress) {
    throw new Error(`Realm mismatch: ${dashboard.realmAddress} !== ${config.realmAddress}`);
  }
  if (dashboard.governanceAddress !== config.governanceAddress) {
    throw new Error(
      `Governance mismatch: ${dashboard.governanceAddress} !== ${config.governanceAddress}`,
    );
  }
  if (dashboard.tokenMintAddress !== config.governanceTokenMint) {
    throw new Error(
      `Governance token mint mismatch: ${dashboard.tokenMintAddress} !== ${config.governanceTokenMint}`,
    );
  }
  if (dashboard.governanceProgramId !== config.governanceProgramId) {
    throw new Error(
      `Governance program mismatch: ${dashboard.governanceProgramId} !== ${config.governanceProgramId}`,
    );
  }
  if (config.governanceProgramVersion != null
    && dashboard.governanceProgramVersion !== config.governanceProgramVersion) {
    throw new Error(
      `Governance program version mismatch: ${dashboard.governanceProgramVersion} !== ${config.governanceProgramVersion}`,
    );
  }
  if (dashboard.rules.pluginEnabled) {
    throw new Error("This DAO uses a governance plugin. The smoke script only supports standard token voting.");
  }
}

async function ensureDepositedVotingPower(params: {
  config: ReturnType<typeof readGovernanceWriteSmokeConfig>;
  connection: Connection;
  dashboard: NonNullable<Awaited<ReturnType<typeof governance.loadGovernanceDashboard>>>;
  signer: Keypair;
  signatures: string[];
}): Promise<NonNullable<Awaited<ReturnType<typeof governance.loadGovernanceDashboard>>>> {
  const wallet = params.dashboard.wallet;
  if (!wallet) {
    throw new Error("The governance signer wallet state could not be loaded.");
  }

  if (wallet.depositedVotesRaw >= params.config.depositTargetRaw) {
    return params.dashboard;
  }

  const delta = params.config.depositTargetRaw - wallet.depositedVotesRaw;
  if (wallet.governingTokenBalanceRaw < delta) {
    throw new Error(
      `Governance signer lacks enough DAO tokens. need=${delta.toString()} available=${wallet.governingTokenBalanceRaw.toString()}`,
    );
  }

  const depositTx = await governance.buildDepositGoverningTokensTx({
    amountRaw: delta,
    connection: params.connection,
    owner: params.signer.publicKey,
  });
  params.signatures.push(
    await sendAndConfirmTransaction(
      params.connection,
      params.signer,
      depositTx,
      "deposit_governing_tokens",
    ),
  );

  const refreshedDashboard = await governance.loadGovernanceDashboard({
    connection: params.connection,
    walletAddress: params.signer.publicKey,
  });
  if (!refreshedDashboard?.wallet) {
    throw new Error("Failed to reload governance wallet state after deposit.");
  }
  if (refreshedDashboard.wallet.depositedVotesRaw < params.config.depositTargetRaw) {
    throw new Error("Deposit completed, but voting power is still below the required smoke threshold.");
  }
  return refreshedDashboard;
}

async function selectSchemaDraft(params: {
  connection: Connection;
  schemaKeyHashHex: string;
}): Promise<SchemaStateProposalDraft> {
  const target = (await protocol.listSchemas({
    connection: params.connection,
    search: params.schemaKeyHashHex,
  })).find((row) => row.schemaKeyHashHex === params.schemaKeyHashHex);

  if (!target) {
    throw new Error(
      `Disposable schema target ${params.schemaKeyHashHex} was not found on-chain. Create it first and rerun the smoke.`,
    );
  }

  return target.verified
    ? {
        closeSchemaHashes: [],
        unverifySchemaHashes: [params.schemaKeyHashHex],
        verifySchemaHashHex: null,
      }
    : {
        closeSchemaHashes: [],
        unverifySchemaHashes: [],
        verifySchemaHashHex: params.schemaKeyHashHex,
      };
}

async function runCreateVote(): Promise<void> {
  const config = readGovernanceWriteSmokeConfig();
  applyGovernanceSmokeFrontendEnv(process.env, config);

  const signer = Keypair.fromSecretKey(bs58.decode(config.governanceSecretKeyBase58));
  const connection = new Connection(config.rpcUrl, "confirmed");
  const signatures: string[] = [];

  await maybeAirdropFees(connection, signer, config);

  let dashboard = await governance.loadGovernanceDashboard({
    connection,
    walletAddress: signer.publicKey,
  });
  if (!dashboard) {
    throw new Error("Failed to load the native governance dashboard from shared frontend helpers.");
  }
  assertDashboardMatchesConfig(dashboard, config);

  dashboard = await ensureDepositedVotingPower({
    config,
    connection,
    dashboard,
    signer,
    signatures,
  });

  const schemaDraft = await selectSchemaDraft({
    connection,
    schemaKeyHashHex: config.smokeSchemaKeyHashHex!,
  });
  const recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  const instructions = await governance.buildSchemaStateProposalInstructions({
    closeSchemaHashes: schemaDraft.closeSchemaHashes,
    connection,
    governanceAuthority: new PublicKey(config.governanceAddress),
    recentBlockhash,
    unverifySchemaHashes: schemaDraft.unverifySchemaHashes,
    verifySchemaHashHex: schemaDraft.verifySchemaHashHex,
  });
  const descriptionLink = governance.buildGovernanceDescriptionLink({
    origin: config.descriptionOrigin,
    payload: {
      closeSchemaHashes: schemaDraft.closeSchemaHashes,
      template: "schema-state",
      unverifySchemaHashes: schemaDraft.unverifySchemaHashes,
      verifySchemaHashHex: schemaDraft.verifySchemaHashHex,
    },
  });
  const proposalName = timestampedGovernanceSmokeProposalName();
  const proposalCreatedAtMs = Date.now();
  const proposalPlan = await governance.buildGovernanceProposalPlan({
    connection,
    descriptionLink,
    instructions,
    proposalName,
    template: "schema-state",
    walletAddress: signer.publicKey,
  });

  for (const step of proposalPlan.steps) {
    signatures.push(await sendAndConfirmTransaction(connection, signer, step.tx, step.label));
  }

  const voteTx = await governance.buildCastGovernanceVoteTx({
    approve: true,
    connection,
    owner: signer.publicKey,
    proposalAddress: new PublicKey(proposalPlan.proposalAddress),
  });
  signatures.push(await sendAndConfirmTransaction(connection, signer, voteTx, "cast_vote_yes"));

  const detail = await governance.loadGovernanceProposalDetail({
    connection,
    proposalAddress: new PublicKey(proposalPlan.proposalAddress),
    walletAddress: signer.publicKey,
  });
  if (!detail) {
    throw new Error("Failed to reload proposal detail after create-vote.");
  }
  if (detail.proposal.currentWalletVote?.choice !== "yes") {
    throw new Error("Expected the governance signer to have a recorded YES vote on the smoke proposal.");
  }

  const refreshedDashboard = await governance.loadGovernanceDashboard({
    connection,
    walletAddress: signer.publicKey,
  });
  if (!refreshedDashboard?.proposals.some((row) => row.address === proposalPlan.proposalAddress)) {
    throw new Error("The new smoke proposal did not appear in the native governance dashboard.");
  }

  const earliestExecutionAtIso = computeCreateVoteEarliestExecutionIso({
    createdAtMs: proposalCreatedAtMs,
    proposalTransactions: detail.proposalTransactions,
    rules: detail.proposalTransactions.length > 0
      ? {
          baseVotingTimeSeconds: refreshedDashboard.rules.baseVotingTimeSeconds,
          instructionHoldUpTimeSeconds: refreshedDashboard.rules.instructionHoldUpTimeSeconds,
        }
      : {
          baseVotingTimeSeconds: refreshedDashboard.rules.baseVotingTimeSeconds,
          instructionHoldUpTimeSeconds: refreshedDashboard.rules.instructionHoldUpTimeSeconds,
        },
  });

  console.log(`[governance-smoke] mode=create-vote`);
  console.log(`[governance-smoke] signer=${signer.publicKey.toBase58()}`);
  console.log(`[governance-smoke] proposal_address=${proposalPlan.proposalAddress}`);
  console.log(`[governance-smoke] proposal_name=${proposalName}`);
  console.log(`[governance-smoke] proposal_state=${detail.proposal.stateLabel}`);
  console.log(`[governance-smoke] vote_choice=${detail.proposal.currentWalletVote?.choice ?? "none"}`);
  console.log(`[governance-smoke] description_link=${proposalPlan.descriptionLink}`);
  console.log(`[governance-smoke] earliest_execution_at=${earliestExecutionAtIso}`);
  console.log(`[governance-smoke] transaction_signatures=${signatures.join(",")}`);
}

async function runExecute(): Promise<void> {
  const config = readGovernanceWriteSmokeConfig();
  applyGovernanceSmokeFrontendEnv(process.env, config);

  const signer = Keypair.fromSecretKey(bs58.decode(config.governanceSecretKeyBase58));
  const connection = new Connection(config.rpcUrl, "confirmed");
  const proposalAddress = new PublicKey(config.smokeProposalAddress!);
  const signatures: string[] = [];

  await maybeAirdropFees(connection, signer, config);

  const dashboard = await governance.loadGovernanceDashboard({
    connection,
    walletAddress: signer.publicKey,
  });
  if (!dashboard) {
    throw new Error("Failed to load the native governance dashboard from shared frontend helpers.");
  }
  assertDashboardMatchesConfig(dashboard, config);

  const detail = await governance.loadGovernanceProposalDetail({
    connection,
    proposalAddress,
    walletAddress: signer.publicKey,
  });
  if (!detail) {
    throw new Error(`Proposal ${proposalAddress.toBase58()} is not visible through the native governance detail loader.`);
  }

  const pendingTransactions = detail.proposalTransactions.filter(
    (row) => row.executionStatus !== InstructionExecutionStatus.Success,
  );
  if (detail.proposal.proposalState === ProposalState.Voting || detail.proposal.votingCompletedAtIso == null) {
    throw new Error("Proposal is still in the voting window. Rerun execute after voting completes.");
  }

  const pendingExecutionAtIso = computePendingExecutionReadyAtIso({
    proposalTransactions: detail.proposalTransactions,
    votingCompletedAtIso: detail.proposal.votingCompletedAtIso,
  });
  if (pendingExecutionAtIso && Date.now() < Date.parse(pendingExecutionAtIso) && pendingTransactions.length > 0) {
    throw new Error(`Proposal is still in the hold-up window. Earliest execution time is ${pendingExecutionAtIso}.`);
  }

  for (const transaction of pendingTransactions) {
    const tx = await governance.buildExecuteGovernanceTransactionTx({
      connection,
      proposalAddress,
      proposalTransactionAddress: new PublicKey(transaction.address),
      rawInstructions: transaction.rawInstructions,
      walletAddress: signer.publicKey,
    });
    signatures.push(
      await sendAndConfirmTransaction(
        connection,
        signer,
        tx,
        `execute_instruction_${transaction.instructionIndex + 1}`,
      ),
    );
  }

  const refreshedDetail = await governance.loadGovernanceProposalDetail({
    connection,
    proposalAddress,
    walletAddress: signer.publicKey,
  });
  if (!refreshedDetail) {
    throw new Error("Failed to reload proposal detail after execution.");
  }
  const pendingAfter = refreshedDetail.proposalTransactions.filter(
    (row) => row.executionStatus !== InstructionExecutionStatus.Success,
  );
  if (
    refreshedDetail.proposal.proposalState !== ProposalState.Completed
    && pendingAfter.length > 0
  ) {
    throw new Error("Proposal execution completed, but the proposal still has pending execution steps.");
  }

  console.log(`[governance-smoke] mode=execute`);
  console.log(`[governance-smoke] signer=${signer.publicKey.toBase58()}`);
  console.log(`[governance-smoke] proposal_address=${proposalAddress.toBase58()}`);
  console.log(`[governance-smoke] proposal_state=${refreshedDetail.proposal.stateLabel}`);
  console.log(`[governance-smoke] pending_transactions_remaining=${pendingAfter.length}`);
  console.log(`[governance-smoke] transaction_signatures=${signatures.join(",")}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const mode = readGovernanceWriteSmokeConfig({ argv }).mode;
  if (mode === "create-vote") {
    await runCreateVote();
    return;
  }
  await runExecute();
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[governance-smoke] failed: ${message}`);
  process.exitCode = 1;
});
