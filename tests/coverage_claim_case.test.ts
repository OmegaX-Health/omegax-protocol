// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");

test("coverage claim case builders derive review and reserve-scoped accounts", () => {
  const authority = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const poolAssetVault = Keypair.generate().publicKey;
  const poolVaultTokenAccount = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();
  const recentBlockhash = "11111111111111111111111111111111";
  const intentHashHex = "11".repeat(32);
  const seriesRefHashHex = "aa".repeat(32);

  const coverageClaim = protocol.deriveCoverageClaimPda({
    programId,
    poolAddress,
    seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
    member,
    intentHash: Buffer.from(intentHashHex, "hex"),
  });
  const poolTerms = protocol.derivePoolTermsPda({ programId, poolAddress });
  const poolTreasuryReserve = protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint: payoutMint,
  });

  const reviewTx = protocol.buildReviewCoverageClaimTx({
    authority,
    poolAddress,
    member,
    seriesRefHashHex,
    intentHashHex,
    requestedAmount: 500n,
    evidenceHashHex: "22".repeat(32),
    interopRefHashHex: "33".repeat(32),
    claimFamily: protocol.COVERAGE_CLAIM_FAMILY_REIMBURSEMENT,
    interopProfileHashHex: "44".repeat(32),
    codeSystemFamilyHashHex: "55".repeat(32),
    recentBlockhash,
  });
  assert.equal(reviewTx.instructions.length, 1);
  assert.equal(reviewTx.instructions[0]?.keys[3]?.pubkey.toBase58(), coverageClaim.toBase58());

  const approveTx = protocol.buildApproveCoverageClaimTx({
    authority,
    poolAddress,
    member,
    seriesRefHashHex,
    intentHashHex,
    approvedAmount: 250n,
    payoutMint,
    poolAssetVault,
    poolVaultTokenAccount,
    decisionReasonHashHex: "66".repeat(32),
    adjudicationRefHashHex: "77".repeat(32),
    recentBlockhash,
  });
  assert.equal(approveTx.instructions.length, 1);
  assert.equal(approveTx.instructions[0]?.keys[3]?.pubkey.toBase58(), poolTerms.toBase58());
  assert.equal(approveTx.instructions[0]?.keys[4]?.pubkey.toBase58(), coverageClaim.toBase58());
  assert.equal(approveTx.instructions[0]?.keys[5]?.pubkey.toBase58(), poolTreasuryReserve.toBase58());
});

test("coverage claim payout and close builders derive the expected treasury accounts", () => {
  const authority = Keypair.generate().publicKey;
  const claimant = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const recipientSystemAccount = Keypair.generate().publicKey;
  const poolAssetVault = Keypair.generate().publicKey;
  const poolVaultTokenAccount = Keypair.generate().publicKey;
  const recipientTokenAccount = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();
  const recentBlockhash = "11111111111111111111111111111111";
  const intentHashHex = "88".repeat(32);
  const seriesRefHashHex = "bb".repeat(32);

  const coverageClaim = protocol.deriveCoverageClaimPda({
    programId,
    poolAddress,
    seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
    member,
    intentHash: Buffer.from(intentHashHex, "hex"),
  });
  const poolTerms = protocol.derivePoolTermsPda({ programId, poolAddress });
  const poolTreasuryReserve = protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint: payoutMint,
  });

  const payTx = protocol.buildPayCoverageClaimTx({
    authority,
    claimant,
    poolAddress,
    member,
    seriesRefHashHex,
    intentHashHex,
    payoutAmount: 99n,
    payoutMint,
    recipientSystemAccount,
    poolAssetVault,
    poolVaultTokenAccount,
    recipientTokenAccount,
    recentBlockhash,
  });
  assert.equal(payTx.instructions.length, 1);
  assert.equal(payTx.instructions[0]?.keys[3]?.pubkey.toBase58(), poolTerms.toBase58());
  assert.equal(payTx.instructions[0]?.keys[4]?.pubkey.toBase58(), coverageClaim.toBase58());
  assert.equal(payTx.instructions[0]?.keys[6]?.pubkey.toBase58(), poolTreasuryReserve.toBase58());

  const closeTx = protocol.buildCloseCoverageClaimTx({
    authority,
    poolAddress,
    member,
    seriesRefHashHex,
    intentHashHex,
    payoutMint,
    recoveryAmount: 10n,
    recentBlockhash,
  });
  assert.equal(closeTx.instructions.length, 1);
  assert.equal(closeTx.instructions[0]?.keys[3]?.pubkey.toBase58(), poolTerms.toBase58());
  assert.equal(closeTx.instructions[0]?.keys[4]?.pubkey.toBase58(), coverageClaim.toBase58());
  assert.equal(closeTx.instructions[0]?.keys[5]?.pubkey.toBase58(), poolTreasuryReserve.toBase58());
});
