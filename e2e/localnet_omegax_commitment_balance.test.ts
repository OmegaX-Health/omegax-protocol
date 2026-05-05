// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import protocolModule from "../frontend/lib/protocol.ts";

const {
  COMMITMENT_MODE_WATERFALL_RESERVE,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  MEMBERSHIP_GATE_KIND_OPEN,
  MEMBERSHIP_MODE_OPEN,
  RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT,
  RESERVE_ORACLE_SOURCE_NONE,
  ZERO_PUBKEY,
  buildConfigureReserveAssetRailTx,
  buildCreateCommitmentCampaignTx,
  buildCreateDomainAssetVaultTx,
  buildCreateReserveDomainTx,
  buildDepositCommitmentTx,
  buildInitializeProtocolGovernanceTx,
  buildOpenFundingLineTx,
  buildProtocolTransactionFromInstruction,
  buildRefundCommitmentTx,
  buildWithdrawProtocolFeeSplTx,
  deriveCommitmentCampaignPda,
  deriveCommitmentLedgerPda,
  deriveCommitmentPositionPda,
  deriveDomainAssetVaultPda,
  deriveDomainAssetVaultTokenAccountPda,
  deriveFundingLinePda,
  deriveHealthPlanPda,
  deriveProtocolFeeVaultPda,
  deriveProtocolGovernancePda,
  deriveReserveDomainPda,
  loadProtocolConsoleSnapshot,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const RECENT_BLOCKHASH_PLACEHOLDER = "11111111111111111111111111111111";
const TERMS_HASH_HEX = "ab".repeat(32);
const REASON_HASH_HEX = "cd".repeat(32);
const COMMITMENT_AMOUNT = 240_000n;
const USER_COUNT = 100;

async function airdrop(connection: Connection, recipient: PublicKey): Promise<void> {
  const latest = await connection.getLatestBlockhash("confirmed");
  const signature = await connection.requestAirdrop(recipient, 5 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction({ signature, ...latest }, "confirmed");
}

async function sendBuiltTransaction(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
): Promise<string> {
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  tx.feePayer = tx.feePayer ?? signers[0]!.publicKey;
  return sendAndConfirmTransaction(connection, tx, signers, { commitment: "confirmed" });
}

async function assertBuiltTransactionRejected(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[],
  message: string,
): Promise<void> {
  try {
    await sendBuiltTransaction(connection, tx, signers);
  } catch {
    return;
  }
  assert.fail(message);
}

function buildCreateHealthPlanTx(params: {
  planAdmin: PublicKey;
  reserveDomain: PublicKey;
  healthPlan: PublicKey;
  planId: string;
  recentBlockhash: string;
}): Transaction {
  return buildProtocolTransactionFromInstruction({
    feePayer: params.planAdmin,
    recentBlockhash: params.recentBlockhash,
    instructionName: "create_health_plan",
    args: {
      plan_id: params.planId,
      display_name: "OMEGAX preorder balance plan",
      organization_ref: "OMEGAX",
      metadata_uri: "ipfs://omegax-preorder-balance-plan",
      sponsor: params.planAdmin,
      sponsor_operator: params.planAdmin,
      claims_operator: params.planAdmin,
      oracle_authority: params.planAdmin,
      membership_mode: MEMBERSHIP_MODE_OPEN,
      membership_gate_kind: MEMBERSHIP_GATE_KIND_OPEN,
      membership_gate_mint: new PublicKey(ZERO_PUBKEY),
      membership_gate_min_amount: 0n,
      membership_invite_authority: new PublicKey(ZERO_PUBKEY),
      allowed_rail_mask: 0,
      default_funding_priority: 1,
      oracle_policy_hash: Array(32).fill(0),
      schema_binding_hash: Array(32).fill(0),
      compliance_baseline_hash: Array(32).fill(0),
      pause_flags: 0,
    },
    accounts: [
      { pubkey: params.planAdmin, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.reserveDomain },
      { pubkey: params.healthPlan, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  });
}

function buildInitProtocolFeeVaultTx(params: {
  authority: PublicKey;
  reserveDomain: PublicKey;
  assetMint: PublicKey;
  feeRecipient: PublicKey;
  recentBlockhash: string;
}): Transaction {
  return buildProtocolTransactionFromInstruction({
    feePayer: params.authority,
    recentBlockhash: params.recentBlockhash,
    instructionName: "init_protocol_fee_vault",
    args: {
      asset_mint: params.assetMint,
      fee_recipient: params.feeRecipient,
    },
    accounts: [
      { pubkey: params.authority, isSigner: true, isWritable: true },
      { pubkey: deriveProtocolGovernancePda() },
      { pubkey: params.reserveDomain },
      {
        pubkey: deriveDomainAssetVaultPda({
          reserveDomain: params.reserveDomain,
          assetMint: params.assetMint,
        }),
      },
      {
        pubkey: deriveProtocolFeeVaultPda({
          reserveDomain: params.reserveDomain,
          assetMint: params.assetMint,
        }),
        isWritable: true,
      },
      { pubkey: SystemProgram.programId },
    ],
  });
}

test("localnet OMEGAX commitment preorder exact-balance invariant", async () => {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim();
  if (!rpcUrl) return;

  const connection = new Connection(rpcUrl, "confirmed");
  const governance = Keypair.generate();
  const attacker = Keypair.generate();
  const depositors = Array.from({ length: USER_COUNT }, () => Keypair.generate());

  await Promise.all([
    airdrop(connection, governance.publicKey),
    airdrop(connection, attacker.publicKey),
    ...depositors.map((depositor) => airdrop(connection, depositor.publicKey)),
  ]);

  const omegaxMint = await createMint(
    connection,
    governance,
    governance.publicKey,
    null,
    0,
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const coverageMint = await createMint(
    connection,
    governance,
    governance.publicKey,
    null,
    0,
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );

  const domainId = `omegax-preorder-${Date.now().toString(36)}`;
  const reserveDomain = deriveReserveDomainPda({ domainId });
  const planId = "omegax-preorder-plan";
  const healthPlan = deriveHealthPlanPda({ reserveDomain, planId });
  const campaignId = "omegax-preorder";
  const campaign = deriveCommitmentCampaignPda({ healthPlan, campaignId });
  const fundingLine = deriveFundingLinePda({ healthPlan, lineId: "coverage-premium" });
  const vaultTokenAccount = deriveDomainAssetVaultTokenAccountPda({
    reserveDomain,
    assetMint: omegaxMint,
  });

  await sendBuiltTransaction(
    connection,
    buildInitializeProtocolGovernanceTx({
      governanceAuthority: governance.publicKey,
      protocolFeeBps: 0,
      emergencyPaused: false,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  await sendBuiltTransaction(
    connection,
    buildCreateReserveDomainTx({
      authority: governance.publicKey,
      domainId,
      displayName: "OMEGAX preorder custody",
      domainAdmin: governance.publicKey,
      settlementMode: 0,
      allowedRailMask: 0,
      pauseFlags: 0,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  for (const assetMint of [omegaxMint, coverageMint]) {
    await sendBuiltTransaction(
      connection,
      buildCreateDomainAssetVaultTx({
        authority: governance.publicKey,
        reserveDomainAddress: reserveDomain,
        assetMint,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
  }
  await sendBuiltTransaction(
    connection,
    buildConfigureReserveAssetRailTx({
      authority: governance.publicKey,
      reserveDomainAddress: reserveDomain,
      assetMint: omegaxMint,
      assetSymbol: "OMEGAX",
      role: RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT,
      payoutPriority: 99,
      oracleSource: RESERVE_ORACLE_SOURCE_NONE,
      maxStalenessSeconds: 0n,
      haircutBps: 0,
      maxExposureBps: 10_000,
      depositEnabled: true,
      payoutEnabled: false,
      capacityEnabled: false,
      active: true,
      reasonHashHex: REASON_HASH_HEX,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  await sendBuiltTransaction(
    connection,
    buildCreateHealthPlanTx({
      planAdmin: governance.publicKey,
      reserveDomain,
      healthPlan,
      planId,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  await sendBuiltTransaction(
    connection,
    buildOpenFundingLineTx({
      authority: governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      assetMint: coverageMint,
      lineId: "coverage-premium",
      lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
      fundingPriority: 1,
      committedAmount: 1_000_000_000n,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  await sendBuiltTransaction(
    connection,
    buildCreateCommitmentCampaignTx({
      authority: governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      coverageFundingLineAddress: fundingLine,
      paymentAssetMint: omegaxMint,
      coverageAssetMint: coverageMint,
      activationAuthority: governance.publicKey,
      campaignId,
      displayName: "OMEGAX preorder",
      metadataUri: "ipfs://omegax-preorder",
      mode: COMMITMENT_MODE_WATERFALL_RESERVE,
      depositAmount: COMMITMENT_AMOUNT,
      coverageAmount: 99n,
      hardCapAmount: COMMITMENT_AMOUNT * 100n,
      startsAtTs: 0n,
      refundAfterTs: 1n,
      expiresAtTs: 0n,
      termsHashHex: TERMS_HASH_HEX,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );

  const depositorTokenAccounts = [];
  for (const depositor of depositors) {
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      governance,
      omegaxMint,
      depositor.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );
    await mintTo(
      connection,
      governance,
      omegaxMint,
      tokenAccount.address,
      governance,
      COMMITMENT_AMOUNT,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );
    depositorTokenAccounts.push(tokenAccount.address);
  }
  const attackerTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    omegaxMint,
    attacker.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const governanceTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    omegaxMint,
    governance.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );

  for (const [index, depositor] of depositors.entries()) {
    await sendBuiltTransaction(
      connection,
      buildDepositCommitmentTx({
        depositor: depositor.publicKey,
        healthPlanAddress: healthPlan,
        campaignId,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: omegaxMint,
        sourceTokenAccountAddress: depositorTokenAccounts[index]!,
        beneficiary: depositor.publicKey,
        acceptedTermsHashHex: TERMS_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [depositor],
    );
  }

  async function assertCommitmentCustody(expectedPending: bigint, label: string): Promise<void> {
    const vaultAccount = await getAccount(connection, vaultTokenAccount, "confirmed", TOKEN_PROGRAM_ID);
    assert.equal(vaultAccount.amount, expectedPending, `${label}: SPL vault token balance`);

    const snapshot = await loadProtocolConsoleSnapshot(connection);
    const vault = snapshot.domainAssetVaults.find(
      (candidate) => candidate.reserveDomain === reserveDomain.toBase58()
        && candidate.assetMint === omegaxMint.toBase58(),
    );
    assert.equal(vault?.totalAssets, expectedPending, `${label}: DomainAssetVault.totalAssets`);

    const ledger = snapshot.commitmentLedgers.find(
      (candidate) => candidate.campaign === campaign.toBase58()
        && candidate.paymentAssetMint === omegaxMint.toBase58(),
    );
    assert.equal(ledger?.pendingAmount, expectedPending, `${label}: CommitmentLedger.pendingAmount`);
  }

  const fullPending = COMMITMENT_AMOUNT * BigInt(USER_COUNT);
  await assertCommitmentCustody(fullPending, "after deposits");

  await sendBuiltTransaction(
    connection,
    buildInitProtocolFeeVaultTx({
      authority: governance.publicKey,
      reserveDomain,
      assetMint: omegaxMint,
      feeRecipient: governance.publicKey,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  await assertBuiltTransactionRejected(
    connection,
    buildWithdrawProtocolFeeSplTx({
      governanceAuthority: governance.publicKey,
      reserveDomainAddress: reserveDomain,
      paymentMint: omegaxMint,
      recipientTokenAccount: governanceTokenAccount.address,
      amount: 1n,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
    "governance-created zero-accrual OMEGAX fee vault must not withdraw preorder tokens",
  );
  await assertCommitmentCustody(fullPending, "after blocked zero-accrual fee withdrawal");

  const firstDepositor = depositors[0]!;
  const firstPosition = deriveCommitmentPositionPda({
    campaign,
    depositor: firstDepositor.publicKey,
    beneficiary: firstDepositor.publicKey,
  });
  await assertBuiltTransactionRejected(
    connection,
    buildRefundCommitmentTx({
      depositor: attacker.publicKey,
      campaignAddress: campaign,
      positionAddress: firstPosition,
      beneficiary: firstDepositor.publicKey,
      reserveDomainAddress: reserveDomain,
      paymentAssetMint: omegaxMint,
      recipientTokenAccountAddress: attackerTokenAccount.address,
      refundReasonHashHex: REASON_HASH_HEX,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [attacker],
    "attacker must not refund another depositor's OMEGAX position",
  );
  await assertCommitmentCustody(fullPending, "after blocked attacker refund");

  for (const [index, depositor] of depositors.entries()) {
    const expectedAfterRefund = COMMITMENT_AMOUNT * BigInt(USER_COUNT - index - 1);
    await sendBuiltTransaction(
      connection,
      buildRefundCommitmentTx({
        depositor: depositor.publicKey,
        campaignAddress: campaign,
        beneficiary: depositor.publicKey,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: omegaxMint,
        recipientTokenAccountAddress: depositorTokenAccounts[index]!,
        refundReasonHashHex: REASON_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [depositor],
    );
    await assertCommitmentCustody(expectedAfterRefund, `after depositor ${index + 1} refund`);
    const depositorAccount = await getAccount(
      connection,
      depositorTokenAccounts[index]!,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
    assert.equal(depositorAccount.amount, COMMITMENT_AMOUNT, `depositor ${index + 1} exact refund`);
  }

  const finalSnapshot = await loadProtocolConsoleSnapshot(connection);
  const refundedPositions = finalSnapshot.commitmentPositions.filter(
    (position) => position.campaign === campaign.toBase58()
      && position.paymentAssetMint === omegaxMint.toBase58(),
  );
  assert.equal(refundedPositions.length, USER_COUNT);
  assert.equal(
    refundedPositions.reduce((sum, position) => sum + position.amount, 0n),
    fullPending,
    "refunded position amounts preserve the original OMEGAX liability total",
  );
});
