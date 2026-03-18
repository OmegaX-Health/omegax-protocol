// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const RECENT_BLOCKHASH = "11111111111111111111111111111111";
const ZERO_PUBKEY = new PublicKey(protocol.ZERO_PUBKEY);

test("frontend protocol module exports canonical builder names only", () => {
  const exportedNames = Object.keys(protocol);
  assert.ok(!exportedNames.includes("buildPayPremiumOnchainTx"));
  assert.ok(!exportedNames.some((name) => name.endsWith("V2Tx")));
  assert.ok(!exportedNames.some((name) => name.includes("ProtocolConfigV2")));
});

test("cycle quote builders derive replay, fee, and sysvar accounts", () => {
  const payer = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const oracle = Keypair.generate().publicKey;
  const paymentMint = Keypair.generate().publicKey;
  const payerTokenAccount = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();
  const quoteVerificationInstruction = new TransactionInstruction({
    programId: SystemProgram.programId,
    keys: [],
    data: Buffer.from([7]),
  });
  const seriesRefHash = Buffer.from("22".repeat(32), "hex");

  const memberCycle = protocol.deriveMemberCyclePda({
    programId,
    poolAddress,
    seriesRefHash,
    member: payer,
    periodIndex: 4n,
  });
  const cycleQuoteReplay = protocol.deriveCycleQuoteReplayPda({
    programId,
    poolAddress,
    seriesRefHash,
    member: payer,
    nonceHash: Buffer.from("11".repeat(32), "hex"),
  });
  const poolAssetVault = protocol.derivePoolAssetVaultPda({
    programId,
    poolAddress,
    payoutMint: paymentMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(paymentMint, poolAssetVault, true);
  const protocolFeeVault = protocol.deriveProtocolFeeVaultPda({
    programId,
    paymentMint,
  });
  const poolOracleFeeVault = protocol.derivePoolOracleFeeVaultPda({
    programId,
    poolAddress,
    oracle,
    paymentMint,
  });

  const solTx = protocol.buildActivateCycleWithQuoteSolTx({
    payer,
    poolAddress,
    oracle,
    seriesRefHashHex: "22".repeat(32),
    periodIndex: 4n,
    nonceHashHex: "11".repeat(32),
    premiumAmountRaw: 500n,
    canonicalPremiumAmount: 500n,
    commitmentEnabled: true,
    bondAmountRaw: 50n,
    shieldFeeRaw: 0n,
    protocolFeeRaw: 5n,
    oracleFeeRaw: 3n,
    netPoolPremiumRaw: 492n,
    totalAmountRaw: 550n,
    includedShieldCount: 0,
    thresholdBps: 0,
    outcomeThresholdScore: 720,
    cohortHashHex: "33".repeat(32),
    expiresAtTs: 1_700_000_000n,
    quoteMetaHashHex: "44".repeat(32),
    recentBlockhash: RECENT_BLOCKHASH,
    quoteVerificationInstruction,
  });

  assert.equal(solTx.instructions.length, 2);
  assert.equal(solTx.instructions[0]?.programId.toBase58(), SystemProgram.programId.toBase58());
  assert.equal(solTx.instructions[1]?.keys[15]?.pubkey.toBase58(), protocol.deriveProtocolFeeVaultPda({
    programId,
    paymentMint: ZERO_PUBKEY,
  }).toBase58());
  assert.equal(solTx.instructions[1]?.keys[18]?.pubkey.toBase58(), memberCycle.toBase58());
  assert.equal(solTx.instructions[1]?.keys[19]?.pubkey.toBase58(), cycleQuoteReplay.toBase58());
  assert.equal(solTx.instructions[1]?.keys[21]?.pubkey.toBase58(), SYSVAR_INSTRUCTIONS_PUBKEY.toBase58());

  const splTx = protocol.buildActivateCycleWithQuoteSplTx({
    payer,
    poolAddress,
    oracle,
    paymentMint,
    payerTokenAccount,
    seriesRefHashHex: "22".repeat(32),
    periodIndex: 4n,
    nonceHashHex: "11".repeat(32),
    premiumAmountRaw: 500n,
    canonicalPremiumAmount: 500n,
    commitmentEnabled: true,
    bondAmountRaw: 50n,
    shieldFeeRaw: 0n,
    protocolFeeRaw: 5n,
    oracleFeeRaw: 3n,
    netPoolPremiumRaw: 492n,
    totalAmountRaw: 550n,
    includedShieldCount: 0,
    thresholdBps: 0,
    outcomeThresholdScore: 720,
    cohortHashHex: "33".repeat(32),
    expiresAtTs: 1_700_000_000n,
    quoteMetaHashHex: "44".repeat(32),
    recentBlockhash: RECENT_BLOCKHASH,
    quoteVerificationInstruction,
  });

  assert.equal(splTx.instructions.length, 2);
  assert.equal(splTx.instructions[1]?.keys[16]?.pubkey.toBase58(), poolAssetVault.toBase58());
  assert.equal(splTx.instructions[1]?.keys[17]?.pubkey.toBase58(), poolVaultTokenAccount.toBase58());
  assert.equal(splTx.instructions[1]?.keys[19]?.pubkey.toBase58(), protocolFeeVault.toBase58());
  assert.equal(splTx.instructions[1]?.keys[21]?.pubkey.toBase58(), poolOracleFeeVault.toBase58());
  assert.equal(splTx.instructions[1]?.keys[24]?.pubkey.toBase58(), memberCycle.toBase58());
  assert.equal(splTx.instructions[1]?.keys[25]?.pubkey.toBase58(), cycleQuoteReplay.toBase58());
  assert.equal(splTx.instructions[1]?.keys[29]?.pubkey.toBase58(), SYSVAR_INSTRUCTIONS_PUBKEY.toBase58());
});

test("cycle settlement builders derive member-cycle and cohort settlement accounts", () => {
  const oracle = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const paymentMint = Keypair.generate().publicKey;
  const recipientTokenAccount = Keypair.generate().publicKey;
  const recipientSystemAccount = Keypair.generate().publicKey;
  const cohortHashHex = "55".repeat(32);
  const programId = protocol.getProgramId();
  const seriesRefHash = Buffer.from("66".repeat(32), "hex");

  const memberCycle = protocol.deriveMemberCyclePda({
    programId,
    poolAddress,
    seriesRefHash,
    member,
    periodIndex: 6n,
  });
  const cohortSettlementRoot = protocol.deriveCohortSettlementRootPda({
    programId,
    poolAddress,
    seriesRefHash,
    cohortHash: Buffer.from(cohortHashHex, "hex"),
  });
  const splReserve = protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint,
  });
  const solReserve = protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint: ZERO_PUBKEY,
  });

  const splTx = protocol.buildSettleCycleCommitmentTx({
    oracle,
    poolAddress,
    member,
    seriesRefHashHex: "66".repeat(32),
    paymentMint,
    periodIndex: 6n,
    passed: true,
    shieldConsumed: false,
    settledHealthAlphaScore: 810,
    recipientTokenAccount,
    recentBlockhash: RECENT_BLOCKHASH,
    cohortHashHex,
  });
  assert.equal(splTx.instructions[0]?.keys[8]?.pubkey.toBase58(), splReserve.toBase58());
  assert.equal(splTx.instructions[0]?.keys[12]?.pubkey.toBase58(), memberCycle.toBase58());
  assert.equal(splTx.instructions[0]?.keys[13]?.pubkey.toBase58(), cohortSettlementRoot.toBase58());

  const solTx = protocol.buildSettleCycleCommitmentSolTx({
    oracle,
    poolAddress,
    member,
    seriesRefHashHex: "66".repeat(32),
    periodIndex: 6n,
    passed: false,
    shieldConsumed: true,
    settledHealthAlphaScore: 200,
    recipientSystemAccount,
    recentBlockhash: RECENT_BLOCKHASH,
    cohortHashHex,
  });
  assert.equal(solTx.instructions[0]?.keys[7]?.pubkey.toBase58(), solReserve.toBase58());
  assert.equal(solTx.instructions[0]?.keys[9]?.pubkey.toBase58(), memberCycle.toBase58());
  assert.equal(solTx.instructions[0]?.keys[10]?.pubkey.toBase58(), cohortSettlementRoot.toBase58());

  const finalizeTx = protocol.buildFinalizeCohortSettlementRootTx({
    oracle,
    poolAddress,
    payoutMint: paymentMint,
    seriesRefHashHex: "66".repeat(32),
    cohortHashHex,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(finalizeTx.instructions[0]?.keys[6]?.pubkey.toBase58(), protocol.derivePoolTermsPda({
    programId,
    poolAddress,
  }).toBase58());
  assert.equal(finalizeTx.instructions[0]?.keys[7]?.pubkey.toBase58(), splReserve.toBase58());
  assert.equal(finalizeTx.instructions[0]?.keys[8]?.pubkey.toBase58(), cohortSettlementRoot.toBase58());
});

test("coverage payment-option and premium builders derive product-scoped PDAs", () => {
  const authority = Keypair.generate().publicKey;
  const payer = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const paymentMint = Keypair.generate().publicKey;
  const payerTokenAccount = Keypair.generate().publicKey;
  const seriesRefHashHex = "77".repeat(32);
  const programId = protocol.getProgramId();

  const coverageProduct = protocol.derivePolicySeriesPda({
    programId,
    poolAddress,
    seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
  });
  const paymentOption = protocol.derivePolicySeriesPaymentOptionPda({
    programId,
    poolAddress,
    seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
    paymentMint,
  });
  const solPaymentOption = protocol.derivePolicySeriesPaymentOptionPda({
    programId,
    poolAddress,
    seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
    paymentMint: ZERO_PUBKEY,
  });
  const premiumLedger = protocol.derivePremiumLedgerPda({
    programId,
    poolAddress,
    seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
    member,
  });
  const poolAssetVault = protocol.derivePoolAssetVaultPda({
    programId,
    poolAddress,
    payoutMint: paymentMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(paymentMint, poolAssetVault, true);

  const upsertTx = protocol.buildUpsertPolicySeriesPaymentOptionTx({
    authority,
    poolAddress,
    seriesRefHashHex,
    paymentMint,
    paymentAmount: 1_250n,
    active: true,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(upsertTx.instructions[0]?.keys[3]?.pubkey.toBase58(), coverageProduct.toBase58());
  assert.equal(upsertTx.instructions[0]?.keys[5]?.pubkey.toBase58(), paymentOption.toBase58());

  const splTx = protocol.buildPayPremiumSplTx({
    payer,
    poolAddress,
    member,
    seriesRefHashHex,
    paymentMint,
    periodIndex: 2n,
    payerTokenAccount,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(splTx.instructions[0]?.keys[6]?.pubkey.toBase58(), paymentOption.toBase58());
  assert.equal(splTx.instructions[0]?.keys[8]?.pubkey.toBase58(), premiumLedger.toBase58());
  assert.equal(splTx.instructions[0]?.keys[9]?.pubkey.toBase58(), poolAssetVault.toBase58());
  assert.equal(splTx.instructions[0]?.keys[10]?.pubkey.toBase58(), poolVaultTokenAccount.toBase58());

  const solTx = protocol.buildPayPremiumSolTx({
    payer,
    poolAddress,
    member,
    seriesRefHashHex,
    periodIndex: 2n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(solTx.instructions[0]?.keys[6]?.pubkey.toBase58(), solPaymentOption.toBase58());
  assert.equal(solTx.instructions[0]?.keys[7]?.pubkey.toBase58(), premiumLedger.toBase58());
});

test("optional pool-control-authority builders preserve trailing account order with sentinels", () => {
  const authority = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const redeemer = Keypair.generate().publicKey;
  const redemptionRequest = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();

  const riskTx = protocol.buildSetPoolRiskControlsTx({
    authority,
    poolAddress,
    payoutMint,
    recentBlockhash: RECENT_BLOCKHASH,
    redemptionMode: protocol.POOL_REDEMPTION_MODE_OPEN,
    claimMode: protocol.POOL_CLAIM_MODE_OPEN,
    impaired: false,
    impairmentAmount: 0n,
  });
  assert.equal(riskTx.instructions[0]?.keys[6]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(riskTx.instructions[0]?.keys[7]?.pubkey.toBase58(), SystemProgram.programId.toBase58());

  const seriesTx = protocol.buildCreatePolicySeriesTx({
    authority,
    poolAddress,
    recentBlockhash: RECENT_BLOCKHASH,
    seriesRefHashHex: "11".repeat(32),
    status: protocol.POLICY_SERIES_STATUS_ACTIVE,
    planMode: protocol.PLAN_MODE_PROTECTION,
    sponsorMode: protocol.SPONSOR_MODE_DIRECT,
    displayName: "Protect",
    metadataUri: "https://example.com/series.json",
    termsHashHex: "22".repeat(32),
    durationSecs: 30n,
    premiumDueEverySecs: 10n,
    premiumGraceSecs: 5n,
    premiumAmount: 100n,
    termsVersion: 1,
    mappingVersion: 1,
  });
  assert.equal(seriesTx.instructions[0]?.keys[4]?.pubkey.toBase58(), SystemProgram.programId.toBase58());

  const complianceTx = protocol.buildSetPoolCompliancePolicyTx({
    authority,
    poolAddress,
    recentBlockhash: RECENT_BLOCKHASH,
    actionsMask: protocol.COMPLIANCE_ACTION_ENROLL,
    bindingMode: protocol.COMPLIANCE_BINDING_MODE_NONE,
    providerMode: protocol.COMPLIANCE_PROVIDER_MODE_NATIVE,
    capitalRailMode: protocol.RAIL_MODE_ANY,
    payoutRailMode: protocol.RAIL_MODE_ANY,
    active: true,
  });
  assert.equal(complianceTx.instructions[0]?.keys[4]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(complianceTx.instructions[0]?.keys[5]?.pubkey.toBase58(), SystemProgram.programId.toBase58());

  const automationTx = protocol.buildSetPoolAutomationPolicyTx({
    authority,
    poolAddress,
    recentBlockhash: RECENT_BLOCKHASH,
    oracleAutomationMode: protocol.AUTOMATION_MODE_DISABLED,
    claimAutomationMode: protocol.AUTOMATION_MODE_DISABLED,
    allowedAiRolesMask: 0,
    maxAutoClaimAmount: 0n,
  });
  assert.equal(automationTx.instructions[0]?.keys[4]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(automationTx.instructions[0]?.keys[5]?.pubkey.toBase58(), SystemProgram.programId.toBase58());

  const failTx = protocol.buildFailPoolLiquidityRedemptionTx({
    authority,
    poolAddress,
    redemptionRequest,
    redeemer,
    recentBlockhash: RECENT_BLOCKHASH,
    failureCode: 7,
  });
  assert.equal(failTx.instructions[0]?.keys[7]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(failTx.instructions[0]?.keys[8]?.pubkey.toBase58(), TOKEN_PROGRAM_ID.toBase58());
});

test("optional compliance builders preserve trailing system account order with sentinels", () => {
  const member = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const tokenGateAccount = Keypair.generate().publicKey;
  const issuer = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();

  const openTx = protocol.buildEnrollMemberOpenTx({
    member,
    poolAddress,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(openTx.instructions[0]?.keys[3]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(openTx.instructions[0]?.keys[4]?.pubkey.toBase58(), SystemProgram.programId.toBase58());

  const tokenGateTx = protocol.buildEnrollMemberTokenGateTx({
    member,
    poolAddress,
    tokenGateAccount,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(tokenGateTx.instructions[0]?.keys[4]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(tokenGateTx.instructions[0]?.keys[5]?.pubkey.toBase58(), SystemProgram.programId.toBase58());

  const inviteTx = protocol.buildEnrollMemberInvitePermitTx({
    member,
    poolAddress,
    issuer,
    recentBlockhash: RECENT_BLOCKHASH,
    nonceHashHex: "11".repeat(32),
    inviteIdHashHex: "22".repeat(32),
    expiresAtTs: 123n,
  });
  assert.equal(inviteTx.instructions[0]?.keys[5]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(inviteTx.instructions[0]?.keys[7]?.pubkey.toBase58(), SystemProgram.programId.toBase58());

  const submitClaimTx = protocol.buildSubmitCoverageClaimTx({
    claimant: member,
    poolAddress,
    member,
    seriesRefHashHex: "33".repeat(32),
    intentHashHex: "33".repeat(32),
    eventHashHex: "44".repeat(32),
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(submitClaimTx.instructions[0]?.keys[8]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(submitClaimTx.instructions[0]?.keys[9]?.pubkey.toBase58(), SystemProgram.programId.toBase58());
});

test("offchain premium attestation builder derives oracle permission and replay accounts", () => {
  const oracle = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const replayHashHex = "aa".repeat(32);
  const programId = protocol.getProgramId();

  const tx = protocol.buildAttestPremiumPaidOffchainTx({
    oracle,
    poolAddress,
    member,
    seriesRefHashHex: "77".repeat(32),
    periodIndex: 3n,
    replayHashHex,
    amount: 250n,
    paidAtTs: 1_700_000_111n,
    recentBlockhash: RECENT_BLOCKHASH,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(
    tx.instructions[0]?.keys[5]?.pubkey.toBase58(),
    protocol.derivePoolOraclePermissionsPda({
      programId,
      poolAddress,
      oracle,
    }).toBase58(),
  );
  assert.equal(
    tx.instructions[0]?.keys[9]?.pubkey.toBase58(),
    protocol.derivePremiumReplayPda({
      programId,
      poolAddress,
      seriesRefHash: Buffer.from("77".repeat(32), "hex"),
      member,
      replayHash: Buffer.from(replayHashHex, "hex"),
    }).toBase58(),
  );
});

test("treasury withdrawal builders derive reserve and fee vault accounts", () => {
  const oracle = Keypair.generate().publicKey;
  const governanceAuthority = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const paymentMint = Keypair.generate().publicKey;
  const recipientTokenAccount = Keypair.generate().publicKey;
  const recipientSystemAccount = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();

  const poolAssetVault = protocol.derivePoolAssetVaultPda({
    programId,
    poolAddress,
    payoutMint: paymentMint,
  });
  const poolVaultTokenAccount = getAssociatedTokenAddressSync(paymentMint, poolAssetVault, true);
  const poolTreasuryReserve = protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint,
  });
  const protocolFeeVault = protocol.deriveProtocolFeeVaultPda({
    programId,
    paymentMint,
  });
  const protocolFeeVaultTokenAccount = getAssociatedTokenAddressSync(paymentMint, protocolFeeVault, true);
  const poolOracleFeeVault = protocol.derivePoolOracleFeeVaultPda({
    programId,
    poolAddress,
    oracle,
    paymentMint,
  });
  const poolOracleFeeVaultTokenAccount = getAssociatedTokenAddressSync(paymentMint, poolOracleFeeVault, true);

  const withdrawPoolSplTx = protocol.buildWithdrawPoolTreasurySplTx({
    oracle,
    poolAddress,
    paymentMint,
    recipientTokenAccount,
    amount: 10n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(withdrawPoolSplTx.instructions[0]?.keys[7]?.pubkey.toBase58(), poolTreasuryReserve.toBase58());
  assert.equal(withdrawPoolSplTx.instructions[0]?.keys[8]?.pubkey.toBase58(), poolAssetVault.toBase58());
  assert.equal(withdrawPoolSplTx.instructions[0]?.keys[9]?.pubkey.toBase58(), poolVaultTokenAccount.toBase58());

  const withdrawPoolSolTx = protocol.buildWithdrawPoolTreasurySolTx({
    oracle,
    poolAddress,
    recipientSystemAccount,
    amount: 10n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(withdrawPoolSolTx.instructions[0]?.keys[6]?.pubkey.toBase58(), protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint: ZERO_PUBKEY,
  }).toBase58());

  const withdrawProtocolSplTx = protocol.buildWithdrawProtocolFeeSplTx({
    governanceAuthority,
    paymentMint,
    recipientTokenAccount,
    amount: 11n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(withdrawProtocolSplTx.instructions[0]?.keys[3]?.pubkey.toBase58(), protocolFeeVault.toBase58());
  assert.equal(withdrawProtocolSplTx.instructions[0]?.keys[4]?.pubkey.toBase58(), protocolFeeVaultTokenAccount.toBase58());

  const withdrawProtocolSolTx = protocol.buildWithdrawProtocolFeeSolTx({
    governanceAuthority,
    recipientSystemAccount,
    amount: 12n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(withdrawProtocolSolTx.instructions[0]?.keys[2]?.pubkey.toBase58(), protocol.deriveProtocolFeeVaultPda({
    programId,
    paymentMint: ZERO_PUBKEY,
  }).toBase58());

  const withdrawOracleSplTx = protocol.buildWithdrawPoolOracleFeeSplTx({
    oracle,
    poolAddress,
    paymentMint,
    recipientTokenAccount,
    amount: 13n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(withdrawOracleSplTx.instructions[0]?.keys[6]?.pubkey.toBase58(), poolOracleFeeVault.toBase58());
  assert.equal(withdrawOracleSplTx.instructions[0]?.keys[7]?.pubkey.toBase58(), poolOracleFeeVaultTokenAccount.toBase58());

  const withdrawOracleSolTx = protocol.buildWithdrawPoolOracleFeeSolTx({
    oracle,
    poolAddress,
    recipientSystemAccount,
    amount: 14n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  assert.equal(withdrawOracleSolTx.instructions[0]?.keys[5]?.pubkey.toBase58(), protocol.derivePoolOracleFeeVaultPda({
    programId,
    poolAddress,
    oracle,
    paymentMint: ZERO_PUBKEY,
  }).toBase58());
});
