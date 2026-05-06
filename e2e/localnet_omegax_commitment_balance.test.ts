// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

import protocolModule from "../frontend/lib/protocol.ts";

const {
  COMMITMENT_MODE_DIRECT_PREMIUM,
  COMMITMENT_MODE_TREASURY_CREDIT,
  COMMITMENT_MODE_WATERFALL_RESERVE,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  MEMBERSHIP_GATE_KIND_OPEN,
  MEMBERSHIP_MODE_OPEN,
  OBLIGATION_STATUS_SETTLED,
  RESERVE_ASSET_ROLE_PRIMARY_STABLE,
  RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT,
  RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL,
  RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED,
  ZERO_PUBKEY,
  buildActivateDirectPremiumCommitmentTx,
  buildActivateTreasuryCreditCommitmentTx,
  buildActivateWaterfallCommitmentTx,
  buildConfigureReserveAssetRailTx,
  buildCreateCommitmentCampaignTx,
  buildCreateDomainAssetVaultTx,
  buildCreateReserveDomainTx,
  buildDepositCommitmentTx,
  buildInitializeProtocolGovernanceTx,
  buildOpenFundingLineTx,
  buildProcessRedemptionQueueTx,
  buildProtocolTransactionFromInstruction,
  buildPublishReserveAssetRailPriceTx,
  buildRecordPremiumPaymentTx,
  buildRefundCommitmentTx,
  buildSettleClaimCaseTx,
  buildSettleObligationTx,
  buildWithdrawProtocolFeeSplTx,
  deriveCapitalClassPda,
  deriveClaimCasePda,
  deriveCommitmentCampaignPda,
  deriveCommitmentPositionPda,
  deriveDomainAssetVaultPda,
  deriveDomainAssetVaultTokenAccountPda,
  deriveFundingLineLedgerPda,
  deriveFundingLinePda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  deriveObligationPda,
  derivePlanReserveLedgerPda,
  deriveProtocolFeeVaultPda,
  deriveProtocolGovernancePda,
  deriveReserveDomainPda,
  loadProtocolConsoleSnapshot,
  getProgramId,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const RECENT_BLOCKHASH_PLACEHOLDER = "11111111111111111111111111111111";
const TERMS_HASH_HEX = "ab".repeat(32);
const REASON_HASH_HEX = "cd".repeat(32);
const USER_COUNT = 100;
const BASIS_POINTS_DENOMINATOR = 10_000n;

type AssetScenario = {
  key: string;
  symbol: string;
  decimals: number;
  depositAmount: bigint;
  role: number;
  payoutPriority: number;
  haircutBps: number;
};

const ASSET_SCENARIOS: AssetScenario[] = [
  {
    key: "omegax",
    symbol: "OMEGAX",
    decimals: 0,
    depositAmount: 240_000n,
    role: RESERVE_ASSET_ROLE_TREASURY_LAST_RESORT,
    payoutPriority: 99,
    haircutBps: 2_500,
  },
  {
    key: "stable",
    symbol: "USDCX",
    decimals: 6,
    depositAmount: 99_000_000n,
    role: RESERVE_ASSET_ROLE_PRIMARY_STABLE,
    payoutPriority: 1,
    haircutBps: 500,
  },
  {
    key: "volatile",
    symbol: "WBTCX",
    decimals: 8,
    depositAmount: 5_000_000n,
    role: RESERVE_ASSET_ROLE_VOLATILE_COLLATERAL,
    payoutPriority: 50,
    haircutBps: 5_000,
  },
];

type CustodyAssetResult = {
  asset: string;
  decimals: number;
  depositAmount: string;
  refundUsers: number;
  blockedProbeCount: number;
  activationModes: string[];
  waterfallHaircutBps: number;
  waterfallCapacity: string;
};

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
      display_name: "Asset-agnostic preorder custody plan",
      organization_ref: "OMEGAX",
      metadata_uri: "ipfs://asset-agnostic-preorder-custody-plan",
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

function toBigIntValue(value: unknown): bigint {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(String(value));
}

function reserveCapacityAmount(amount: bigint, haircutBps: number): bigint {
  return amount * (BASIS_POINTS_DENOMINATOR - BigInt(haircutBps)) / BASIS_POINTS_DENOMINATOR;
}

function writeCommitmentCustodySummary(results: CustodyAssetResult[]): void {
  const basePath = process.env.OMEGAX_E2E_SUMMARY_PATH?.trim();
  if (!basePath) return;
  const outputPath = basePath.replace("localnet-e2e-summary-", "localnet-commitment-custody-");
  mkdirSync(dirname(outputPath), { recursive: true });
  const totals = results.reduce(
    (acc, result) => {
      acc.refundUsers += result.refundUsers;
      acc.blockedProbeCount += result.blockedProbeCount;
      acc.activationModeCount += result.activationModes.length;
      return acc;
    },
    { refundUsers: 0, blockedProbeCount: 0, activationModeCount: 0 },
  );
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        assetCount: results.length,
        userCountPerAsset: USER_COUNT,
        totals,
        assets: results,
      },
      null,
      2,
    )}\n`,
  );
}

test("localnet commitment custody is asset-agnostic across payment rails", async () => {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim();
  if (!rpcUrl) return;

  const connection = new Connection(rpcUrl, "confirmed");
  const governance = Keypair.generate();
  const attacker = Keypair.generate();
  const depositors = Array.from({ length: USER_COUNT }, () => Keypair.generate());
  const expectedVaultTotals = new Map<string, bigint>();
  const initializedVaults = new Set<string>();
  const initializedFeeVaults = new Set<string>();
  const custodyResults: CustodyAssetResult[] = [];

  await Promise.all([
    airdrop(connection, governance.publicKey),
    airdrop(connection, attacker.publicKey),
    ...depositors.map((depositor) => airdrop(connection, depositor.publicKey)),
  ]);

  const domainId = `commitment-custody-${Date.now().toString(36)}`;
  const reserveDomain = deriveReserveDomainPda({ domainId });
  const planId = "asset-agnostic-preorder-plan";
  const healthPlan = deriveHealthPlanPda({ reserveDomain, planId });
  const coverageReserveMint = await createMint(
    connection,
    governance,
    governance.publicKey,
    null,
    6,
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );
  const coverageReserveSource = await getOrCreateAssociatedTokenAccount(
    connection,
    governance,
    coverageReserveMint,
    governance.publicKey,
    false,
    "confirmed",
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID,
  );

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
      displayName: "Asset-agnostic commitment custody",
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

  async function ensureVault(assetMint: PublicKey): Promise<void> {
    const key = assetMint.toBase58();
    if (initializedVaults.has(key)) return;
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
    initializedVaults.add(key);
    expectedVaultTotals.set(key, 0n);
  }

  async function ensureProtocolFeeVault(assetMint: PublicKey): Promise<void> {
    const key = assetMint.toBase58();
    if (initializedFeeVaults.has(key)) return;
    await sendBuiltTransaction(
      connection,
      buildInitProtocolFeeVaultTx({
        authority: governance.publicKey,
        reserveDomain,
        assetMint,
        feeRecipient: governance.publicKey,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    initializedFeeVaults.add(key);
  }

  async function configureReserveRail(asset: AssetScenario, assetMint: PublicKey): Promise<void> {
    await sendBuiltTransaction(
      connection,
      buildConfigureReserveAssetRailTx({
        authority: governance.publicKey,
        reserveDomainAddress: reserveDomain,
        assetMint,
        assetSymbol: asset.symbol,
        role: asset.role,
        payoutPriority: asset.payoutPriority,
        oracleSource: RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED,
        maxStalenessSeconds: 0n,
        haircutBps: asset.haircutBps,
        maxExposureBps: 10_000,
        depositEnabled: true,
        payoutEnabled: false,
        capacityEnabled: true,
        active: true,
        reasonHashHex: REASON_HASH_HEX,
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
        confidenceBps: 100,
        publishedAtTs: 1n,
        proofHashHex: REASON_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
  }

  async function openPremiumFundingLine(assetMint: PublicKey, lineId: string, committedAmount: bigint): Promise<PublicKey> {
    const fundingLine = deriveFundingLinePda({ healthPlan, lineId });
    await sendBuiltTransaction(
      connection,
      buildOpenFundingLineTx({
        authority: governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        assetMint,
        lineId,
        lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
        fundingPriority: 1,
        committedAmount,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    return fundingLine;
  }

  async function createCampaign(params: {
    asset: AssetScenario;
    paymentMint: PublicKey;
    coverageMint: PublicKey;
    fundingLine: PublicKey;
    campaignId: string;
    mode: number;
    coverageAmount: bigint;
    hardCapMultiplier?: bigint;
  }): Promise<PublicKey> {
    const campaign = deriveCommitmentCampaignPda({ healthPlan, campaignId: params.campaignId });
    await sendBuiltTransaction(
      connection,
      buildCreateCommitmentCampaignTx({
        authority: governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        coverageFundingLineAddress: params.fundingLine,
        paymentAssetMint: params.paymentMint,
        coverageAssetMint: params.coverageMint,
        activationAuthority: governance.publicKey,
        campaignId: params.campaignId,
        displayName: `${params.asset.symbol} ${params.campaignId}`,
        metadataUri: `ipfs://${params.campaignId}`,
        mode: params.mode,
        depositAmount: params.asset.depositAmount,
        coverageAmount: params.coverageAmount,
        hardCapAmount: params.asset.depositAmount * (params.hardCapMultiplier ?? 10n),
        startsAtTs: 0n,
        refundAfterTs: 1n,
        expiresAtTs: 0n,
        termsHashHex: TERMS_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    return campaign;
  }

  async function assertVaultBalance(assetMint: PublicKey, expected: bigint, label: string): Promise<void> {
    const vaultTokenAccount = deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint });
    const vaultAccount = await getAccount(connection, vaultTokenAccount, "confirmed", TOKEN_PROGRAM_ID);
    assert.equal(vaultAccount.amount, expected, `${label}: SPL vault token balance`);

    const snapshot = await loadProtocolConsoleSnapshot(connection);
    const vault = snapshot.domainAssetVaults.find(
      (candidate) => candidate.reserveDomain === reserveDomain.toBase58()
        && candidate.assetMint === assetMint.toBase58(),
    );
    assert.equal(toBigIntValue(vault?.totalAssets), expected, `${label}: DomainAssetVault.totalAssets`);
  }

  async function assertCommitmentLedger(params: {
    campaign: PublicKey;
    paymentMint: PublicKey;
    pending: bigint;
    activated?: bigint;
    treasuryLocked?: bigint;
    refunded?: bigint;
    label: string;
  }): Promise<void> {
    const snapshot = await loadProtocolConsoleSnapshot(connection);
    const ledger = snapshot.commitmentLedgers.find(
      (candidate) => candidate.campaign === params.campaign.toBase58()
        && candidate.paymentAssetMint === params.paymentMint.toBase58(),
    );
    assert(ledger, `${params.label}: commitment ledger exists`);
    assert.equal(toBigIntValue(ledger.pendingAmount), params.pending, `${params.label}: pendingAmount`);
    assert.equal(toBigIntValue(ledger.activatedAmount), params.activated ?? 0n, `${params.label}: activatedAmount`);
    assert.equal(toBigIntValue(ledger.treasuryLockedAmount), params.treasuryLocked ?? 0n, `${params.label}: treasuryLockedAmount`);
    assert.equal(toBigIntValue(ledger.refundedAmount), params.refunded ?? 0n, `${params.label}: refundedAmount`);
  }

  async function assertFundingLineAccounting(params: {
    fundingLine: PublicKey;
    assetMint: PublicKey;
    funded: bigint;
    restricted?: bigint;
    label: string;
  }): Promise<void> {
    const snapshot = await loadProtocolConsoleSnapshot(connection);
    const line = snapshot.fundingLines.find((candidate) => candidate.address === params.fundingLine.toBase58());
    assert(line, `${params.label}: funding line exists`);
    assert.equal(toBigIntValue(line.fundedAmount), params.funded, `${params.label}: fundingLine.fundedAmount`);
    const lineLedger = snapshot.fundingLineLedgers.find(
      (candidate) => candidate.address === deriveFundingLineLedgerPda({
        fundingLine: params.fundingLine,
        assetMint: params.assetMint,
      }).toBase58(),
    );
    assert(lineLedger, `${params.label}: funding line ledger exists`);
    assert.equal(toBigIntValue(lineLedger.sheet?.funded), params.funded, `${params.label}: line ledger funded`);
    assert.equal(toBigIntValue(lineLedger.sheet?.restricted), params.restricted ?? 0n, `${params.label}: line ledger restricted`);
    const planLedger = snapshot.planReserveLedgers.find(
      (candidate) => candidate.address === derivePlanReserveLedgerPda({
        healthPlan,
        assetMint: params.assetMint,
      }).toBase58(),
    );
    assert(planLedger, `${params.label}: plan reserve ledger exists`);
    assert(
      toBigIntValue(planLedger.sheet?.funded) >= params.funded,
      `${params.label}: plan reserve funded includes funding line amount`,
    );
    assert(
      toBigIntValue(planLedger.sheet?.restricted) >= (params.restricted ?? 0n),
      `${params.label}: plan reserve restricted includes funding line amount`,
    );
  }

  async function depositCommitment(params: {
    depositor: Keypair;
    depositorTokenAccount: PublicKey;
    paymentMint: PublicKey;
    campaignId: string;
    campaign: PublicKey;
    beneficiary?: PublicKey;
  }): Promise<PublicKey> {
    const beneficiary = params.beneficiary ?? params.depositor.publicKey;
    await sendBuiltTransaction(
      connection,
      buildDepositCommitmentTx({
        depositor: params.depositor.publicKey,
        healthPlanAddress: healthPlan,
        campaignId: params.campaignId,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: params.paymentMint,
        sourceTokenAccountAddress: params.depositorTokenAccount,
        beneficiary,
        acceptedTermsHashHex: TERMS_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [params.depositor],
    );
    const key = params.paymentMint.toBase58();
    expectedVaultTotals.set(key, (expectedVaultTotals.get(key) ?? 0n) + ASSET_SCENARIOS.find((asset) => asset.key === params.campaignId.split("-")[0])!.depositAmount);
    return deriveCommitmentPositionPda({
      campaign: params.campaign,
      depositor: params.depositor.publicKey,
      beneficiary,
    });
  }

  async function addVaultExpectation(assetMint: PublicKey, amount: bigint): Promise<void> {
    const key = assetMint.toBase58();
    expectedVaultTotals.set(key, (expectedVaultTotals.get(key) ?? 0n) + amount);
  }

  async function subtractVaultExpectation(assetMint: PublicKey, amount: bigint): Promise<void> {
    const key = assetMint.toBase58();
    expectedVaultTotals.set(key, (expectedVaultTotals.get(key) ?? 0n) - amount);
  }

  async function assertExpectedVault(assetMint: PublicKey, label: string): Promise<void> {
    await assertVaultBalance(assetMint, expectedVaultTotals.get(assetMint.toBase58()) ?? 0n, label);
  }

  await ensureVault(coverageReserveMint);
  await ensureProtocolFeeVault(coverageReserveMint);

  for (const asset of ASSET_SCENARIOS) {
    const paymentMint = await createMint(
      connection,
      governance,
      governance.publicKey,
      null,
      asset.decimals,
      undefined,
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );
    await ensureVault(paymentMint);
    await ensureProtocolFeeVault(paymentMint);
    await configureReserveRail(asset, paymentMint);

    const depositorTokenAccounts: PublicKey[] = [];
    for (const depositor of depositors) {
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        governance,
        paymentMint,
        depositor.publicKey,
        false,
        "confirmed",
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
      );
      await mintTo(
        connection,
        governance,
        paymentMint,
        tokenAccount.address,
        governance,
        asset.depositAmount,
        [],
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
      );
      depositorTokenAccounts.push(tokenAccount.address);
    }

    const attackerTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      governance,
      paymentMint,
      attacker.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );
    const governanceTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      governance,
      paymentMint,
      governance.publicKey,
      false,
      "confirmed",
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );

    const refundLine = await openPremiumFundingLine(
      paymentMint,
      `${asset.key}-refund-line`,
      asset.depositAmount * 200n,
    );
    const refundCampaignId = `${asset.key}-refund`;
    const refundCampaign = await createCampaign({
      asset,
      paymentMint,
      coverageMint: paymentMint,
      fundingLine: refundLine,
      campaignId: refundCampaignId,
      mode: COMMITMENT_MODE_WATERFALL_RESERVE,
      coverageAmount: asset.depositAmount,
      hardCapMultiplier: 100n,
    });

    const firstPosition = deriveCommitmentPositionPda({
      campaign: refundCampaign,
      depositor: depositors[0]!.publicKey,
      beneficiary: depositors[0]!.publicKey,
    });
    for (const [index, depositor] of depositors.entries()) {
      await sendBuiltTransaction(
        connection,
        buildDepositCommitmentTx({
          depositor: depositor.publicKey,
          healthPlanAddress: healthPlan,
          campaignId: refundCampaignId,
          reserveDomainAddress: reserveDomain,
          paymentAssetMint: paymentMint,
          sourceTokenAccountAddress: depositorTokenAccounts[index]!,
          beneficiary: depositor.publicKey,
          acceptedTermsHashHex: TERMS_HASH_HEX,
          recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
        }),
        [depositor],
      );
    }
    await addVaultExpectation(paymentMint, asset.depositAmount * BigInt(USER_COUNT));
    const fullPending = asset.depositAmount * BigInt(USER_COUNT);
    await assertExpectedVault(paymentMint, `${asset.symbol} after deposits`);
    await assertCommitmentLedger({
      campaign: refundCampaign,
      paymentMint,
      pending: fullPending,
      label: `${asset.symbol} after deposits`,
    });

    await assertBuiltTransactionRejected(
      connection,
      buildWithdrawProtocolFeeSplTx({
        governanceAuthority: governance.publicKey,
        reserveDomainAddress: reserveDomain,
        paymentMint,
        recipientTokenAccount: governanceTokenAccount.address,
        amount: 1n,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
      `${asset.symbol}: zero-accrual fee withdrawal must not touch pending commitments`,
    );
    await assertExpectedVault(paymentMint, `${asset.symbol} after blocked zero-accrual fee withdrawal`);

    await assertBuiltTransactionRejected(
      connection,
      buildRefundCommitmentTx({
        depositor: attacker.publicKey,
        campaignAddress: refundCampaign,
        positionAddress: firstPosition,
        beneficiary: depositors[0]!.publicKey,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: paymentMint,
        recipientTokenAccountAddress: attackerTokenAccount.address,
        refundReasonHashHex: REASON_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [attacker],
      `${asset.symbol}: attacker must not refund another depositor position`,
    );

    await assertBuiltTransactionRejected(
      connection,
      buildRefundCommitmentTx({
        depositor: depositors[0]!.publicKey,
        campaignAddress: refundCampaign,
        positionAddress: firstPosition,
        beneficiary: depositors[0]!.publicKey,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: paymentMint,
        recipientTokenAccountAddress: attackerTokenAccount.address,
        refundReasonHashHex: REASON_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [depositors[0]!],
      `${asset.symbol}: depositor refund must not pay an attacker-owned recipient`,
    );

    await assertBuiltTransactionRejected(
      connection,
      buildRefundCommitmentTx({
        depositor: depositors[0]!.publicKey,
        campaignAddress: refundCampaign,
        positionAddress: firstPosition,
        beneficiary: depositors[0]!.publicKey,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: paymentMint,
        vaultTokenAccountAddress: attackerTokenAccount.address,
        recipientTokenAccountAddress: depositorTokenAccounts[0]!,
        refundReasonHashHex: REASON_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [depositors[0]!],
      `${asset.symbol}: fake vault token account must reject`,
    );

    await assertBuiltTransactionRejected(
      connection,
      buildRefundCommitmentTx({
        depositor: depositors[0]!.publicKey,
        campaignAddress: refundCampaign,
        positionAddress: firstPosition,
        beneficiary: depositors[0]!.publicKey,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: coverageReserveMint,
        recipientTokenAccountAddress: depositorTokenAccounts[0]!,
        refundReasonHashHex: REASON_HASH_HEX,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [depositors[0]!],
      `${asset.symbol}: wrong payment mint must reject`,
    );

    assert.throws(
      () => buildRefundCommitmentTx({
        depositor: depositors[0]!.publicKey,
        campaignAddress: refundCampaign,
        positionAddress: firstPosition,
        beneficiary: depositors[0]!.publicKey,
        reserveDomainAddress: reserveDomain,
        paymentAssetMint: paymentMint,
        recipientTokenAccountAddress: depositorTokenAccounts[0]!,
        refundReasonHashHex: REASON_HASH_HEX,
        tokenProgramId: TOKEN_2022_PROGRAM_ID,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      /classic SPL Token program/,
      `${asset.symbol}: Token-2022 refund builder must fail closed`,
    );

    const pendingOutflowProbes = [
      {
        label: "claim settlement",
        tx: buildSettleClaimCaseTx({
          authority: governance.publicKey,
          healthPlanAddress: healthPlan,
          reserveDomainAddress: reserveDomain,
          fundingLineAddress: refundLine,
          assetMint: paymentMint,
          claimCaseAddress: deriveClaimCasePda({ healthPlan, claimId: `${asset.key}-pending-claim` }),
          amount: 1n,
          vaultTokenAccountAddress: deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint: paymentMint }),
          recipientTokenAccountAddress: governanceTokenAccount.address,
          tokenProgramId: TOKEN_PROGRAM_ID,
          recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
        }),
      },
      {
        label: "obligation settlement",
        tx: buildSettleObligationTx({
          authority: governance.publicKey,
          healthPlanAddress: healthPlan,
          reserveDomainAddress: reserveDomain,
          fundingLineAddress: refundLine,
          assetMint: paymentMint,
          obligationAddress: deriveObligationPda({
            fundingLine: refundLine,
            obligationId: `${asset.key}-pending-obligation`,
          }),
          nextStatus: OBLIGATION_STATUS_SETTLED,
          amount: 1n,
          vaultTokenAccountAddress: deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint: paymentMint }),
          recipientTokenAccountAddress: governanceTokenAccount.address,
          tokenProgramId: TOKEN_PROGRAM_ID,
          recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
        }),
      },
      {
        label: "LP redemption",
        tx: buildProcessRedemptionQueueTx({
          authority: governance.publicKey,
          reserveDomainAddress: reserveDomain,
          poolAddress: deriveLiquidityPoolPda({ reserveDomain, poolId: `${asset.key}-pending-pool` }),
          poolDepositAssetMint: paymentMint,
          capitalClassAddress: deriveCapitalClassPda({
            liquidityPool: deriveLiquidityPoolPda({ reserveDomain, poolId: `${asset.key}-pending-pool` }),
            classId: `${asset.key}-pending-class`,
          }),
          lpOwnerAddress: governance.publicKey,
          shares: 1n,
          vaultTokenAccountAddress: deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint: paymentMint }),
          recipientTokenAccountAddress: governanceTokenAccount.address,
          tokenProgramId: TOKEN_PROGRAM_ID,
          recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
        }),
      },
    ];
    for (const probe of pendingOutflowProbes) {
      await assertBuiltTransactionRejected(
        connection,
        probe.tx,
        [governance],
        `${asset.symbol}: pending-only vault must reject unrelated ${probe.label}`,
      );
      await assertExpectedVault(paymentMint, `${asset.symbol} after blocked ${probe.label}`);
    }

    for (const [index, depositor] of depositors.entries()) {
      const expectedAfterRefund = asset.depositAmount * BigInt(USER_COUNT - index - 1);
      await sendBuiltTransaction(
        connection,
        buildRefundCommitmentTx({
          depositor: depositor.publicKey,
          campaignAddress: refundCampaign,
          beneficiary: depositor.publicKey,
          reserveDomainAddress: reserveDomain,
          paymentAssetMint: paymentMint,
          recipientTokenAccountAddress: depositorTokenAccounts[index]!,
          refundReasonHashHex: REASON_HASH_HEX,
          recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
        }),
        [depositor],
      );
      await subtractVaultExpectation(paymentMint, asset.depositAmount);
      await assertExpectedVault(paymentMint, `${asset.symbol} after depositor ${index + 1} refund`);
      await assertCommitmentLedger({
        campaign: refundCampaign,
        paymentMint,
        pending: expectedAfterRefund,
        refunded: asset.depositAmount * BigInt(index + 1),
        label: `${asset.symbol} after depositor ${index + 1} refund`,
      });
      const depositorAccount = await getAccount(
        connection,
        depositorTokenAccounts[index]!,
        "confirmed",
        TOKEN_PROGRAM_ID,
      );
      assert.equal(depositorAccount.amount, asset.depositAmount, `${asset.symbol}: depositor ${index + 1} exact refund`);
    }

    const directLine = await openPremiumFundingLine(
      paymentMint,
      `${asset.key}-direct-line`,
      asset.depositAmount * 10n,
    );
    const directCampaignId = `${asset.key}-direct`;
    const directCampaign = await createCampaign({
      asset,
      paymentMint,
      coverageMint: paymentMint,
      fundingLine: directLine,
      campaignId: directCampaignId,
      mode: COMMITMENT_MODE_DIRECT_PREMIUM,
      coverageAmount: asset.depositAmount,
    });
    const directPosition = await depositCommitment({
      depositor: depositors[0]!,
      depositorTokenAccount: depositorTokenAccounts[0]!,
      paymentMint,
      campaignId: directCampaignId,
      campaign: directCampaign,
    });
    await sendBuiltTransaction(
      connection,
      buildActivateDirectPremiumCommitmentTx({
        activationAuthority: governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        coverageFundingLineAddress: directLine,
        paymentAssetMint: paymentMint,
        coverageAssetMint: paymentMint,
        campaignAddress: directCampaign,
        positionAddress: directPosition,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    await assertExpectedVault(paymentMint, `${asset.symbol} after direct activation`);
    await assertCommitmentLedger({
      campaign: directCampaign,
      paymentMint,
      pending: 0n,
      activated: asset.depositAmount,
      label: `${asset.symbol} direct activation`,
    });
    await assertFundingLineAccounting({
      fundingLine: directLine,
      assetMint: paymentMint,
      funded: asset.depositAmount,
      label: `${asset.symbol} direct activation`,
    });

    const treasuryCoverageAmount = asset.depositAmount;
    const treasuryLine = await openPremiumFundingLine(
      coverageReserveMint,
      `${asset.key}-treasury-line`,
      treasuryCoverageAmount * 10n,
    );
    await mintTo(
      connection,
      governance,
      coverageReserveMint,
      coverageReserveSource.address,
      governance,
      treasuryCoverageAmount,
      [],
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID,
    );
    await sendBuiltTransaction(
      connection,
      buildRecordPremiumPaymentTx({
        authority: governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        fundingLineAddress: treasuryLine,
        assetMint: coverageReserveMint,
        sourceTokenAccountAddress: coverageReserveSource.address,
        vaultTokenAccountAddress: deriveDomainAssetVaultTokenAccountPda({
          reserveDomain,
          assetMint: coverageReserveMint,
        }),
        amount: treasuryCoverageAmount,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    await addVaultExpectation(coverageReserveMint, treasuryCoverageAmount);
    const treasuryCampaignId = `${asset.key}-treasury`;
    const treasuryCampaign = await createCampaign({
      asset,
      paymentMint,
      coverageMint: coverageReserveMint,
      fundingLine: treasuryLine,
      campaignId: treasuryCampaignId,
      mode: COMMITMENT_MODE_TREASURY_CREDIT,
      coverageAmount: treasuryCoverageAmount,
    });
    const treasuryPosition = await depositCommitment({
      depositor: depositors[1]!,
      depositorTokenAccount: depositorTokenAccounts[1]!,
      paymentMint,
      campaignId: treasuryCampaignId,
      campaign: treasuryCampaign,
    });
    await sendBuiltTransaction(
      connection,
      buildActivateTreasuryCreditCommitmentTx({
        activationAuthority: governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        coverageFundingLineAddress: treasuryLine,
        paymentAssetMint: paymentMint,
        coverageAssetMint: coverageReserveMint,
        campaignAddress: treasuryCampaign,
        positionAddress: treasuryPosition,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    await assertExpectedVault(paymentMint, `${asset.symbol} after treasury-credit activation payment asset`);
    await assertExpectedVault(coverageReserveMint, `${asset.symbol} after treasury-credit activation coverage asset`);
    await assertCommitmentLedger({
      campaign: treasuryCampaign,
      paymentMint,
      pending: 0n,
      treasuryLocked: asset.depositAmount,
      label: `${asset.symbol} treasury-credit activation`,
    });
    await assertFundingLineAccounting({
      fundingLine: treasuryLine,
      assetMint: coverageReserveMint,
      funded: treasuryCoverageAmount,
      restricted: treasuryCoverageAmount,
      label: `${asset.symbol} treasury-credit activation`,
    });

    const waterfallLine = await openPremiumFundingLine(
      paymentMint,
      `${asset.key}-waterfall-line`,
      asset.depositAmount * 10n,
    );
    const waterfallCampaignId = `${asset.key}-waterfall`;
    const waterfallCampaign = await createCampaign({
      asset,
      paymentMint,
      coverageMint: paymentMint,
      fundingLine: waterfallLine,
      campaignId: waterfallCampaignId,
      mode: COMMITMENT_MODE_WATERFALL_RESERVE,
      coverageAmount: asset.depositAmount,
    });
    const waterfallPosition = await depositCommitment({
      depositor: depositors[2]!,
      depositorTokenAccount: depositorTokenAccounts[2]!,
      paymentMint,
      campaignId: waterfallCampaignId,
      campaign: waterfallCampaign,
    });
    const waterfallCapacity = reserveCapacityAmount(asset.depositAmount, asset.haircutBps);
    await sendBuiltTransaction(
      connection,
      buildActivateWaterfallCommitmentTx({
        activationAuthority: governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        coverageFundingLineAddress: waterfallLine,
        paymentAssetMint: paymentMint,
        coverageAssetMint: paymentMint,
        campaignAddress: waterfallCampaign,
        positionAddress: waterfallPosition,
        recentBlockhash: RECENT_BLOCKHASH_PLACEHOLDER,
      }),
      [governance],
    );
    await assertExpectedVault(paymentMint, `${asset.symbol} after waterfall activation`);
    await assertCommitmentLedger({
      campaign: waterfallCampaign,
      paymentMint,
      pending: 0n,
      activated: asset.depositAmount,
      label: `${asset.symbol} waterfall activation`,
    });
    await assertFundingLineAccounting({
      fundingLine: waterfallLine,
      assetMint: paymentMint,
      funded: waterfallCapacity,
      label: `${asset.symbol} waterfall activation`,
    });
    custodyResults.push({
      asset: asset.symbol,
      decimals: asset.decimals,
      depositAmount: asset.depositAmount.toString(),
      refundUsers: USER_COUNT,
      blockedProbeCount: 9,
      activationModes: ["direct_premium", "treasury_credit", "waterfall_reserve"],
      waterfallHaircutBps: asset.haircutBps,
      waterfallCapacity: waterfallCapacity.toString(),
    });
  }

  const snapshot = await loadProtocolConsoleSnapshot(connection);
  for (const asset of ASSET_SCENARIOS) {
    const positions = snapshot.commitmentPositions.filter(
      (position) => position.campaign.includes(deriveCommitmentCampaignPda({
        healthPlan,
        campaignId: `${asset.key}-refund`,
      }).toBase58()),
    );
    assert.equal(positions.length, USER_COUNT, `${asset.symbol}: all refund positions remain inspectable`);
  }

  assert.equal(getProgramId().toBase58(), process.env.PROTOCOL_PROGRAM_ID || getProgramId().toBase58());
  writeCommitmentCustodySummary(custodyResults);
});
