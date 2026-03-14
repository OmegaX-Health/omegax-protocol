// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");

test("buildSubmitOutcomeAttestationVoteTx derives required attestation accounts", () => {
  const oracle = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();
  const recentBlockhash = "11111111111111111111111111111111";
  const cycleHashHex = "11".repeat(32);
  const ruleHashHex = "22".repeat(32);
  const schemaKeyHashHex = "33".repeat(32);
  const seriesRefHashHex = "99".repeat(32);

  const poolTerms = protocol.derivePoolTermsPda({ programId, poolAddress });
  const poolOraclePolicy = protocol.derivePoolOraclePolicyPda({ programId, poolAddress });
  const poolTreasuryReserve = protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint: payoutMint,
  });
  const poolOraclePermissions = protocol.derivePoolOraclePermissionsPda({
    programId,
    poolAddress,
    oracle,
  });

  const tx = protocol.buildSubmitOutcomeAttestationVoteTx({
    oracle,
    poolAddress,
    payoutMint,
    seriesRefHashHex,
    member,
    cycleHashHex,
    ruleHashHex,
    schemaKeyHashHex,
    attestationDigestHex: "44".repeat(32),
    observedValueHashHex: "55".repeat(32),
    evidenceHashHex: "66".repeat(32),
    externalAttestationRefHashHex: "77".repeat(32),
    asOfTs: 123n,
    passed: true,
    recentBlockhash,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.keys[4]?.pubkey.toBase58(), poolAddress.toBase58());
  assert.equal(tx.instructions[0]?.keys[5]?.pubkey.toBase58(), poolTerms.toBase58());
  assert.equal(tx.instructions[0]?.keys[7]?.pubkey.toBase58(), poolTreasuryReserve.toBase58());
  assert.equal(tx.instructions[0]?.keys[9]?.pubkey.toBase58(), poolOraclePermissions.toBase58());
});

test("buildFinalizeCycleOutcomeTx derives aggregate and reserve from pool scope", () => {
  const feePayer = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();
  const recentBlockhash = "11111111111111111111111111111111";
  const cycleHashHex = "88".repeat(32);
  const ruleHashHex = "99".repeat(32);
  const seriesRefHashHex = "aa".repeat(32);

  const poolTerms = protocol.derivePoolTermsPda({ programId, poolAddress });
  const poolOraclePolicy = protocol.derivePoolOraclePolicyPda({ programId, poolAddress });
  const poolTreasuryReserve = protocol.derivePoolTreasuryReservePda({
    programId,
    poolAddress,
    paymentMint: payoutMint,
  });
  const aggregate = protocol.deriveOutcomeAggregatePda({
    programId,
    poolAddress,
    seriesRefHash: Buffer.from(seriesRefHashHex, "hex"),
    member,
    cycleHash: Buffer.from(cycleHashHex, "hex"),
    ruleHash: Buffer.from(ruleHashHex, "hex"),
  });

  const tx = protocol.buildFinalizeCycleOutcomeTx({
    feePayer,
    poolAddress,
    payoutMint,
    seriesRefHashHex,
    member,
    cycleHashHex,
    ruleHashHex,
    recentBlockhash,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.keys[1]?.pubkey.toBase58(), poolAddress.toBase58());
  assert.equal(tx.instructions[0]?.keys[2]?.pubkey.toBase58(), poolTerms.toBase58());
  assert.equal(tx.instructions[0]?.keys[3]?.pubkey.toBase58(), poolOraclePolicy.toBase58());
  assert.equal(tx.instructions[0]?.keys[4]?.pubkey.toBase58(), poolTreasuryReserve.toBase58());
  assert.equal(tx.instructions[0]?.keys[5]?.pubkey.toBase58(), aggregate.toBase58());
});

test("buildSubmitOutcomeAttestationVoteTx preserves the optional automation slot", () => {
  const oracle = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const payoutMint = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const programId = protocol.getProgramId();
  const recentBlockhash = "11111111111111111111111111111111";
  const seriesRefHashHex = "55".repeat(32);

  const tx = protocol.buildSubmitOutcomeAttestationVoteTx({
    oracle,
    poolAddress,
    payoutMint,
    seriesRefHashHex,
    member,
    cycleHashHex: "aa".repeat(32),
    ruleHashHex: "bb".repeat(32),
    schemaKeyHashHex: "cc".repeat(32),
    attestationDigestHex: "dd".repeat(32),
    observedValueHashHex: "ee".repeat(32),
    asOfTs: 321n,
    passed: true,
    recentBlockhash,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.keys[15]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(
    tx.instructions[0]?.keys[16]?.pubkey.toBase58(),
    "11111111111111111111111111111111",
  );
});

test("buildSubmitRewardClaimTx preserves the optional compliance slot", () => {
  const claimant = Keypair.generate().publicKey;
  const poolAddress = Keypair.generate().publicKey;
  const member = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;
  const recentBlockhash = "11111111111111111111111111111111";
  const programId = protocol.getProgramId();
  const seriesRefHashHex = "44".repeat(32);

  const tx = protocol.buildSubmitRewardClaimTx({
    claimant,
    poolAddress,
    member,
    seriesRefHashHex,
    cycleHashHex: "11".repeat(32),
    ruleHashHex: "22".repeat(32),
    intentHashHex: "33".repeat(32),
    payoutAmount: 99n,
    recipient,
    recipientSystemAccount: recipient,
    recentBlockhash,
  });

  assert.equal(tx.instructions.length, 1);
  assert.equal(tx.instructions[0]?.keys[8]?.pubkey.toBase58(), programId.toBase58());
  assert.equal(tx.instructions[0]?.keys[9]?.pubkey.toBase58(), poolAddress.toBase58());
  assert.equal(tx.instructions[0]?.keys[17]?.pubkey.toBase58(), "11111111111111111111111111111111");
  assert.equal(tx.instructions[0]?.keys[18]?.pubkey.toBase58(), programId.toBase58());
});
