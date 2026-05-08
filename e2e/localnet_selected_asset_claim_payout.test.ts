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
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

import protocolModule from "../frontend/lib/protocol.ts";

const {
  CAPITAL_CLASS_RESTRICTION_OPEN,
  CLAIM_INTAKE_SETTLED,
  ELIGIBILITY_ELIGIBLE,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  MEMBERSHIP_GATE_KIND_OPEN,
  MEMBERSHIP_MODE_OPEN,
  OBLIGATION_DELIVERY_MODE_PAYABLE,
  REDEMPTION_POLICY_OPEN,
  RESERVE_ASSET_ROLE_PRIMARY_STABLE,
  RESERVE_ASSET_ROLE_SECONDARY_STABLE,
  RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED,
  ZERO_PUBKEY,
  accountExists,
  buildAdjudicateClaimCaseTx,
  buildConfigureReserveAssetRailTx,
  buildCreateAllocationPositionTx,
  buildCreateCapitalClassTx,
  buildCreateDomainAssetVaultTx,
  buildCreateLiquidityPoolTx,
  buildCreateObligationTx,
  buildCreateReserveDomainTx,
  buildFundSponsorBudgetTx,
  buildInitializeProtocolGovernanceTx,
  buildOpenClaimCaseTx,
  buildOpenFundingLineTx,
  buildOpenMemberPositionTx,
  buildProtocolTransactionFromInstruction,
  buildPublishReserveAssetRailPriceTx,
  buildSettleClaimCaseSelectedAssetTx,
  deriveAllocationLedgerPda,
  deriveAllocationPositionPda,
  deriveCapitalClassPda,
  deriveClaimCasePda,
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultPda,
  deriveDomainAssetVaultTokenAccountPda,
  deriveFundingLineLedgerPda,
  deriveFundingLinePda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  deriveMemberPositionPda,
  derivePlanReserveLedgerPda,
  derivePoolClassLedgerPda,
  deriveProtocolGovernancePda,
  deriveReserveDomainPda,
  loadProtocolConsoleSnapshot,
  recomputeReserveBalanceSheet,
  toBigIntAmount,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const RECENT_BLOCKHASH_PLACEHOLDER = "11111111111111111111111111111111";
const HASH_HEX = "55".repeat(32);
const CLAIM_CREDIT_AMOUNT = 25_000_000n;
const PAYOUT_AMOUNT = 25_000_000n;
const PAYOUT_FUND_AMOUNT = 100_000_000n;

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
      display_name: "Selected-asset localnet claim plan",
      organization_ref: "OMEGAX",
      metadata_uri: "ipfs://selected-asset-localnet-claim-plan",
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

function loadProgramUpgradeAuthority(): Keypair | null {
  const raw = process.env.OMEGAX_E2E_ORIGINAL_GOVERNANCE_SECRET_KEY_JSON?.trim();
  if (!raw) return null;
  const parsed = JSON.parse(raw) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

test("localnet selected-asset payout settles and obligation creation rejects foreign allocation scope", async () => {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim();
  if (!rpcUrl) return;
  const governance = loadProgramUpgradeAuthority();
  if (!governance) return;

  const connection = new Connection(rpcUrl, "confirmed");
  const member = Keypair.generate();

  await Promise.all([
    airdrop(connection, governance.publicKey),
    airdrop(connection, member.publicKey),
  ]);

  if (!await accountExists(connection, deriveProtocolGovernancePda())) {
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
  }

  const domainId = `selected-asset-${Date.now().toString(36)}`;
  const reserveDomain = deriveReserveDomainPda({ domainId });
  const planId = "selected-asset-claim-plan";
  const healthPlan = deriveHealthPlanPda({ reserveDomain, planId });
  const claimMint = await createMint(
    connection,
    governance,
    governance.publicKey,
    null,
    6,
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const payoutMint = await createMint(
    connection,
    governance,
    governance.publicKey,
    null,
    6,
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const payoutSource = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    payoutMint,
    governance.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const payoutRecipient = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    payoutMint,
    member.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );

  await sendBuiltTransaction(
    connection,
    buildCreateReserveDomainTx({
      authority: governance.publicKey,
      domainId,
      displayName: "Selected-asset claim payout",
      domainAdmin: governance.publicKey,
      settlementMode: 0,
      allowedRailMask: 0,
      pauseFlags: 0,
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

  async function createVault(assetMint: PublicKey): Promise<void> {
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

  async function configureRail(assetMint: PublicKey, symbol: string, payoutEnabled: boolean): Promise<void> {
    await sendBuiltTransaction(
      connection,
      buildConfigureReserveAssetRailTx({
        authority: governance.publicKey,
        reserveDomainAddress: reserveDomain,
        assetMint,
        assetSymbol: symbol,
        role: payoutEnabled ? RESERVE_ASSET_ROLE_SECONDARY_STABLE : RESERVE_ASSET_ROLE_PRIMARY_STABLE,
        payoutPriority: payoutEnabled ? 2 : 1,
        oracleSource: RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED,
        maxStalenessSeconds: 86_400n,
        maxConfidenceBps: 50,
        haircutBps: 0,
        maxExposureBps: 10_000,
        depositEnabled: true,
        payoutEnabled,
        capacityEnabled: true,
        active: true,
        reasonHashHex: HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    await sendBuiltTransaction(
      connection,
      buildPublishReserveAssetRailPriceTx({
        authority: governance.publicKey,
        reserveDomainAddress: reserveDomain,
        assetMint,
        priceUsd1e8: 100_000_000n,
        confidenceBps: 50,
        publishedAtTs: BigInt(Math.floor(Date.now() / 1000)),
        proofHashHex: HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
  }

  async function openFundingLine(assetMint: PublicKey, lineId: string, lineType: number): Promise<PublicKey> {
    const fundingLine = deriveFundingLinePda({ healthPlan, lineId });
    await sendBuiltTransaction(
      connection,
      buildOpenFundingLineTx({
        authority: governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        assetMint,
        lineId,
        lineType,
        fundingPriority: 1,
        committedAmount: PAYOUT_FUND_AMOUNT * 10n,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    return fundingLine;
  }

  await createVault(claimMint);
  await createVault(payoutMint);
  await configureRail(claimMint, "CLMX", false);
  await configureRail(payoutMint, "PAYX", true);

  const claimLine = await openFundingLine(claimMint, "claim-line", FUNDING_LINE_TYPE_SPONSOR_BUDGET);
  const payoutLine = await openFundingLine(payoutMint, "payout-line", FUNDING_LINE_TYPE_SPONSOR_BUDGET);
  await mintTo(
    connection,
    governance,
    payoutMint,
    payoutSource.address,
    governance,
    PAYOUT_FUND_AMOUNT,
    [],
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  await sendBuiltTransaction(
    connection,
    buildFundSponsorBudgetTx({
      authority: governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: payoutLine,
      assetMint: payoutMint,
      sourceTokenAccountAddress: payoutSource.address,
      vaultTokenAccountAddress: deriveDomainAssetVaultTokenAccountPda({
        reserveDomain,
        assetMint: payoutMint,
      }),
      amount: PAYOUT_FUND_AMOUNT,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );

  const memberPosition = deriveMemberPositionPda({ healthPlan, wallet: member.publicKey });
  await sendBuiltTransaction(
    connection,
    buildOpenMemberPositionTx({
      wallet: member.publicKey,
      healthPlanAddress: healthPlan,
      eligibilityStatus: ELIGIBILITY_ELIGIBLE,
      delegatedRightsMask: 0,
      proofMode: 0,
      tokenGateAmountSnapshot: 0n,
      inviteExpiresAt: 0n,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [member],
  );
  const claimId = "selected-asset-claim";
  const claimCase = deriveClaimCasePda({ healthPlan, claimId });
  await sendBuiltTransaction(
    connection,
    buildOpenClaimCaseTx({
      authority: member.publicKey,
      healthPlanAddress: healthPlan,
      memberPositionAddress: memberPosition,
      fundingLineAddress: claimLine,
      claimId,
      claimantAddress: member.publicKey,
      evidenceRefHashHex: HASH_HEX,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [member],
  );
  await sendBuiltTransaction(
    connection,
    buildAdjudicateClaimCaseTx({
      authority: governance.publicKey,
      healthPlanAddress: healthPlan,
      claimCaseAddress: claimCase,
      reviewState: 1,
      approvedAmount: CLAIM_CREDIT_AMOUNT,
      deniedAmount: 0n,
      reserveAmount: 0n,
      decisionSupportHashHex: HASH_HEX,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );

  const payoutVaultTokenAccount = deriveDomainAssetVaultTokenAccountPda({
    reserveDomain,
    assetMint: payoutMint,
  });
  const recipientBefore = (await getAccount(connection, payoutRecipient.address, "confirmed", TOKEN_PROGRAM_ID)).amount;
  const vaultBefore = (await getAccount(connection, payoutVaultTokenAccount, "confirmed", TOKEN_PROGRAM_ID)).amount;

  await sendBuiltTransaction(
    connection,
    buildSettleClaimCaseSelectedAssetTx({
      authority: governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      payoutFundingLineAddress: payoutLine,
      claimAssetMint: claimMint,
      payoutAssetMint: payoutMint,
      claimCaseAddress: claimCase,
      memberPositionAddress: memberPosition,
      payoutVaultTokenAccountAddress: payoutVaultTokenAccount,
      recipientTokenAccountAddress: payoutRecipient.address,
      claimCreditAmount: CLAIM_CREDIT_AMOUNT,
      payoutAmount: PAYOUT_AMOUNT,
      settlementReasonHashHex: HASH_HEX,
      tokenProgramId: TOKEN_PROGRAM_ID,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );

  const recipientAfter = (await getAccount(connection, payoutRecipient.address, "confirmed", TOKEN_PROGRAM_ID)).amount;
  const vaultAfter = (await getAccount(connection, payoutVaultTokenAccount, "confirmed", TOKEN_PROGRAM_ID)).amount;
  assert.equal(recipientAfter - recipientBefore, PAYOUT_AMOUNT);
  assert.equal(vaultBefore - vaultAfter, PAYOUT_AMOUNT);

  const payoutSnapshot = await loadProtocolConsoleSnapshot(connection);
  const settledClaim = payoutSnapshot.claimCases.find((row) => row.address === claimCase.toBase58());
  assert(settledClaim, "settled selected-asset claim should be indexed");
  assert.equal(settledClaim.intakeStatus, CLAIM_INTAKE_SETTLED);
  assert.equal(toBigIntAmount(settledClaim.paidAmount), CLAIM_CREDIT_AMOUNT);

  const payoutVault = payoutSnapshot.domainAssetVaults.find(
    (row) => row.reserveDomain === reserveDomain.toBase58() && row.assetMint === payoutMint.toBase58(),
  );
  assert.equal(toBigIntAmount(payoutVault?.totalAssets), PAYOUT_FUND_AMOUNT - PAYOUT_AMOUNT);

  const payoutDomainLedger = payoutSnapshot.domainAssetLedgers.find(
    (row) => row.address === deriveDomainAssetLedgerPda({ reserveDomain, assetMint: payoutMint }).toBase58(),
  );
  const payoutPlanLedger = payoutSnapshot.planReserveLedgers.find(
    (row) => row.address === derivePlanReserveLedgerPda({ healthPlan, assetMint: payoutMint }).toBase58(),
  );
  const payoutLineLedger = payoutSnapshot.fundingLineLedgers.find(
    (row) => row.address === deriveFundingLineLedgerPda({ fundingLine: payoutLine, assetMint: payoutMint }).toBase58(),
  );
  for (const [label, ledger] of [
    ["domain", payoutDomainLedger],
    ["plan", payoutPlanLedger],
    ["line", payoutLineLedger],
  ] as const) {
    assert(ledger, `${label} payout ledger should exist`);
    const sheet = recomputeReserveBalanceSheet(ledger.sheet);
    assert.equal(sheet.funded, PAYOUT_FUND_AMOUNT - PAYOUT_AMOUNT, `${label} funded`);
    assert.equal(sheet.settled, PAYOUT_AMOUNT, `${label} settled`);
  }

  const poolId = "foreign-allocation-pool";
  const classId = "foreign-allocation-class";
  const pool = deriveLiquidityPoolPda({ reserveDomain, poolId });
  const capitalClass = deriveCapitalClassPda({ liquidityPool: pool, classId });
  const lpLineA = await openFundingLine(payoutMint, "lp-line-a", FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION);
  const lpLineB = await openFundingLine(payoutMint, "lp-line-b", FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION);
  await sendBuiltTransaction(
    connection,
    buildCreateLiquidityPoolTx({
      authority: governance.publicKey,
      reserveDomainAddress: reserveDomain,
      poolId,
      displayName: "Foreign allocation pool",
      depositAssetMint: payoutMint,
      feeBps: 0,
      redemptionPolicy: REDEMPTION_POLICY_OPEN,
      pauseFlags: 0,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  await sendBuiltTransaction(
    connection,
    buildCreateCapitalClassTx({
      authority: governance.publicKey,
      poolAddress: pool,
      poolDepositAssetMint: payoutMint,
      classId,
      displayName: "Foreign allocation class",
      priority: 1,
      impairmentRank: 1,
      restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
      redemptionTermsMode: REDEMPTION_POLICY_OPEN,
      feeBps: 0,
      minLockupSeconds: 0n,
      pauseFlags: 0,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );
  const foreignAllocation = deriveAllocationPositionPda({
    capitalClass,
    fundingLine: lpLineB,
  });
  await sendBuiltTransaction(
    connection,
    buildCreateAllocationPositionTx({
      authority: governance.publicKey,
      poolAddress: pool,
      capitalClassAddress: capitalClass,
      healthPlanAddress: healthPlan,
      fundingLineAddress: lpLineB,
      fundingLineAssetMint: payoutMint,
      capAmount: 50_000_000n,
      weightBps: 10_000,
      allocationMode: 0,
      deallocationOnly: false,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
  );

  const beforeRejectedObligation = await loadProtocolConsoleSnapshot(connection);
  const trackedOwedBefore = new Map([
    [
      "domain",
      recomputeReserveBalanceSheet(beforeRejectedObligation.domainAssetLedgers.find(
        (row) => row.address === deriveDomainAssetLedgerPda({ reserveDomain, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "plan",
      recomputeReserveBalanceSheet(beforeRejectedObligation.planReserveLedgers.find(
        (row) => row.address === derivePlanReserveLedgerPda({ healthPlan, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "funding-line",
      recomputeReserveBalanceSheet(beforeRejectedObligation.fundingLineLedgers.find(
        (row) => row.address === deriveFundingLineLedgerPda({ fundingLine: lpLineA, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "pool-class",
      recomputeReserveBalanceSheet(beforeRejectedObligation.poolClassLedgers.find(
        (row) => row.address === derivePoolClassLedgerPda({ capitalClass, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "allocation",
      recomputeReserveBalanceSheet(beforeRejectedObligation.allocationLedgers.find(
        (row) => row.address === deriveAllocationLedgerPda({ allocationPosition: foreignAllocation, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
  ]);

  await assertBuiltTransactionRejected(
    connection,
    buildCreateObligationTx({
      authority: governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: lpLineA,
      assetMint: payoutMint,
      obligationId: "foreign-allocation-obligation",
      liquidityPoolAddress: pool,
      capitalClassAddress: capitalClass,
      allocationPositionAddress: foreignAllocation,
      poolAssetMint: payoutMint,
      deliveryMode: OBLIGATION_DELIVERY_MODE_PAYABLE,
      amount: 1_000_000n,
      creationReasonHashHex: HASH_HEX,
      recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
    }),
    [governance],
    "foreign allocation create_obligation must fail before owed ledgers mutate",
  );

  const afterRejectedObligation = await loadProtocolConsoleSnapshot(connection);
  const trackedOwedAfter = new Map([
    [
      "domain",
      recomputeReserveBalanceSheet(afterRejectedObligation.domainAssetLedgers.find(
        (row) => row.address === deriveDomainAssetLedgerPda({ reserveDomain, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "plan",
      recomputeReserveBalanceSheet(afterRejectedObligation.planReserveLedgers.find(
        (row) => row.address === derivePlanReserveLedgerPda({ healthPlan, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "funding-line",
      recomputeReserveBalanceSheet(afterRejectedObligation.fundingLineLedgers.find(
        (row) => row.address === deriveFundingLineLedgerPda({ fundingLine: lpLineA, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "pool-class",
      recomputeReserveBalanceSheet(afterRejectedObligation.poolClassLedgers.find(
        (row) => row.address === derivePoolClassLedgerPda({ capitalClass, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
    [
      "allocation",
      recomputeReserveBalanceSheet(afterRejectedObligation.allocationLedgers.find(
        (row) => row.address === deriveAllocationLedgerPda({ allocationPosition: foreignAllocation, assetMint: payoutMint }).toBase58(),
      )?.sheet).owed,
    ],
  ]);

  for (const [label, before] of trackedOwedBefore) {
    assert.equal(trackedOwedAfter.get(label), before, `${label} owed must not change after rejected obligation`);
  }
});
