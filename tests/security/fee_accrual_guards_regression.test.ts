// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regressions for fee accrual:
// configured premium and LP exit fees must fail closed when callers omit the
// matching fee-vault account, and builders must preserve optional-account slots.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import fixturesModule from "../../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../../frontend/lib/protocol.ts";

const programSource = readFileSync(
  new URL("../../programs/omegax_protocol/src/lib.rs", import.meta.url),
  "utf8",
);

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../../frontend/lib/devnet-fixtures.ts");

const {
  buildDepositIntoCapitalClassTx,
  buildProcessRedemptionQueueTx,
  buildRecordPremiumPaymentTx,
  getProgramId,
  listProtocolInstructionAccounts,
} = protocolModule as typeof import("../../frontend/lib/protocol.ts");

function extractInstructionBody(name: string): string {
  const startIdx = programSource.indexOf(`pub fn ${name}(`);
  assert.notEqual(startIdx, -1, `instruction ${name} should exist in program source`);

  let i = programSource.indexOf("{", startIdx);
  assert.notEqual(i, -1, `instruction ${name} should have a body`);

  let depth = 1;
  i += 1;
  for (; i < programSource.length && depth > 0; i += 1) {
    if (programSource[i] === "{") depth += 1;
    else if (programSource[i] === "}") depth -= 1;
  }

  return programSource.slice(startIdx, i);
}

function assertAccountCount(name: Parameters<typeof listProtocolInstructionAccounts>[0], actual: number) {
  assert.equal(
    actual,
    listProtocolInstructionAccounts(name).length,
    `${name} builder must emit one key for every Anchor account, including optional placeholders`,
  );
}

test("[CSO-2026-04-29] configured premium and LP exit fees require fee vault accounts", () => {
  const premiumBody = extractInstructionBody("record_premium_payment");
  const redemptionBody = extractInstructionBody("process_redemption_queue");

  assert.match(premiumBody, /protocol_fee_bps\s*==\s*0/);
  assert.match(premiumBody, /FeeVaultRequiredForConfiguredFee/);
  assert.match(redemptionBody, /class_fee_bps\s*==\s*0/);
  assert.match(redemptionBody, /FeeVaultRequiredForConfiguredFee/);
});

test("[CSO-2026-04-29] fee-accrual builders preserve optional fee-vault slots", () => {
  const programId = getProgramId().toBase58();
  const recentBlockhash = "11111111111111111111111111111111";
  const authority = DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0]!.address;
  const recipient = DEVNET_PROTOCOL_FIXTURE_STATE.wallets[1]!.address;
  const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const fundingLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find((line) => line.healthPlan === plan.address)
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines[0]!;
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
  const capitalClass = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.find((entry) => entry.liquidityPool === pool.address)
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses[0]!;
  const lpPosition = DEVNET_PROTOCOL_FIXTURE_STATE.lpPositions.find((entry) => entry.capitalClass === capitalClass.address)
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.lpPositions[0]!;

  const recordPremium = buildRecordPremiumPaymentTx({
    authority,
    healthPlanAddress: plan.address,
    reserveDomainAddress: plan.reserveDomain,
    fundingLineAddress: fundingLine.address,
    assetMint: fundingLine.assetMint,
    sourceTokenAccountAddress: authority,
    vaultTokenAccountAddress: recipient,
    recentBlockhash,
    amount: 1n,
    policySeriesAddress: fundingLine.policySeries ?? null,
  });
  assertAccountCount("record_premium_payment", recordPremium.instructions[0]!.keys.length);
  assert.equal(recordPremium.instructions[0]!.keys[9]!.pubkey.toBase58(), programId);

  const recordPremiumWithVault = buildRecordPremiumPaymentTx({
    authority,
    healthPlanAddress: plan.address,
    reserveDomainAddress: plan.reserveDomain,
    fundingLineAddress: fundingLine.address,
    assetMint: fundingLine.assetMint,
    sourceTokenAccountAddress: authority,
    vaultTokenAccountAddress: recipient,
    recentBlockhash,
    amount: 1n,
    policySeriesAddress: fundingLine.policySeries ?? null,
    protocolFeeVaultAddress: recipient,
  });
  assert.equal(recordPremiumWithVault.instructions[0]!.keys[9]!.pubkey.toBase58(), recipient);

  const deposit = buildDepositIntoCapitalClassTx({
    owner: authority,
    reserveDomainAddress: pool.reserveDomain,
    poolAddress: pool.address,
    poolDepositAssetMint: pool.depositAssetMint,
    capitalClassAddress: capitalClass.address,
    sourceTokenAccountAddress: authority,
    vaultTokenAccountAddress: recipient,
    recentBlockhash,
    amount: 1n,
    shares: 1n,
  });
  assertAccountCount("deposit_into_capital_class", deposit.instructions[0]!.keys.length);
  assert.equal(deposit.instructions[0]!.keys[8]!.pubkey.toBase58(), programId);

  const redemption = buildProcessRedemptionQueueTx({
    authority,
    reserveDomainAddress: pool.reserveDomain,
    poolAddress: pool.address,
    poolDepositAssetMint: pool.depositAssetMint,
    capitalClassAddress: capitalClass.address,
    lpOwnerAddress: lpPosition.owner,
    recentBlockhash,
    shares: 1n,
    vaultTokenAccountAddress: pool.address,
    recipientTokenAccountAddress: recipient,
  });
  assertAccountCount("process_redemption_queue", redemption.instructions[0]!.keys.length);
  assert.equal(redemption.instructions[0]!.keys[8]!.pubkey.toBase58(), programId);
  assert.equal(redemption.instructions[0]!.keys[10]!.pubkey.toBase58(), pool.address);
  assert.equal(redemption.instructions[0]!.keys[11]!.pubkey.toBase58(), recipient);
});
