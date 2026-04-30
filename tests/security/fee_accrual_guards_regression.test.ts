// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regressions for fee accrual:
// configured premium and LP entry/exit flows must always carry the canonical
// fee-vault PDA instead of preserving legacy omission paths.

import test from "node:test";
import assert from "node:assert/strict";

import fixturesModule from "../../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../../frontend/lib/protocol.ts";
import { extractRustFunctionBody } from "./program_source.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../../frontend/lib/devnet-fixtures.ts");

const {
  buildDepositIntoCapitalClassTx,
  buildProcessRedemptionQueueTx,
  buildRecordPremiumPaymentTx,
  derivePoolTreasuryVaultPda,
  deriveProtocolFeeVaultPda,
  listProtocolInstructionAccounts,
} = protocolModule as typeof import("../../frontend/lib/protocol.ts");

const extractInstructionBody = extractRustFunctionBody;

function assertAccountCount(name: Parameters<typeof listProtocolInstructionAccounts>[0], actual: number) {
  assert.equal(
    actual,
    listProtocolInstructionAccounts(name).length,
    `${name} builder must emit one key for every Anchor account, including optional placeholders`,
  );
}

test("[CSO-2026-04-29] fee-accrual handlers removed missing-vault compatibility branches", () => {
  const premiumBody = extractInstructionBody("record_premium_payment");
  const depositBody = extractInstructionBody("deposit_into_capital_class");
  const redemptionBody = extractInstructionBody("process_redemption_queue");

  assert.doesNotMatch(premiumBody, /protocol_fee_vault\.as_deref/);
  assert.doesNotMatch(premiumBody, /protocol_fee_bps\s*==\s*0/);
  assert.doesNotMatch(depositBody, /pool_treasury_vault\.as_deref/);
  assert.doesNotMatch(depositBody, /class_fee_bps\s*==\s*0/);
  assert.doesNotMatch(redemptionBody, /pool_treasury_vault\.as_deref/);
  assert.doesNotMatch(redemptionBody, /class_fee_bps\s*==\s*0/);
});

test("[CSO-2026-04-29] fee-accrual builders derive canonical fee-vault PDAs", () => {
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
  assert.equal(
    recordPremium.instructions[0]!.keys[9]!.pubkey.toBase58(),
    deriveProtocolFeeVaultPda({
      reserveDomain: plan.reserveDomain,
      assetMint: fundingLine.assetMint,
    }).toBase58(),
  );

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
  assert.equal(
    deposit.instructions[0]!.keys[8]!.pubkey.toBase58(),
    derivePoolTreasuryVaultPda({
      liquidityPool: pool.address,
      assetMint: pool.depositAssetMint,
    }).toBase58(),
  );

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
  assert.equal(
    redemption.instructions[0]!.keys[8]!.pubkey.toBase58(),
    derivePoolTreasuryVaultPda({
      liquidityPool: pool.address,
      assetMint: pool.depositAssetMint,
    }).toBase58(),
  );
  assert.equal(redemption.instructions[0]!.keys[10]!.pubkey.toBase58(), pool.address);
  assert.equal(redemption.instructions[0]!.keys[11]!.pubkey.toBase58(), recipient);
});
