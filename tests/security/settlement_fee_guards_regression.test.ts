// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";

import fixturesModule from "../../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../../frontend/lib/protocol.ts";
import { extractRustFunctionBody, programSource } from "./program_source.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../../frontend/lib/devnet-fixtures.ts");

const {
  OBLIGATION_STATUS_SETTLED,
  buildSettleClaimCaseTx,
  buildSettleObligationTx,
  deriveReserveAssetRailPda,
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

test("[CSO-2026-04-29] linked obligation settlement requires SPL outflow accounts", () => {
  const body = extractInstructionBody("settle_obligation");

  assert.match(body, /SettlementOutflowAccountsRequired/);
  assert.match(body, /member_position\.is_some\(\)/);
  assert.match(body, /vault_token_account\.is_some\(\)/);
  assert.match(body, /recipient_token_account\.is_some\(\)/);
  assert.match(body, /token_program\.is_some\(\)/);
});

test("[CSO-2026-05-06] claim and obligation settlement require payout-enabled reserve rails", () => {
  const claimBody = extractInstructionBody("settle_claim_case");
  const selectedClaimBody = extractInstructionBody("settle_claim_case_selected_asset");
  const obligationBody = extractInstructionBody("settle_obligation");

  assert.match(claimBody, /require_reserve_asset_rail_payout_enabled/);
  assert.match(selectedClaimBody, /require_reserve_asset_rail_payout_enabled/);
  assert.match(selectedClaimBody, /require_selected_asset_payout_value/);
  assert.match(selectedClaimBody, /book_selected_asset_claim_payout/);
  assert.match(selectedClaimBody, /SelectedAssetPayoutSameMint/);
  assert.match(obligationBody, /require_reserve_asset_rail_payout_enabled/);
  assert.match(programSource, /pub\(crate\) fn require_reserve_asset_rail_payout_enabled/);
  assert.match(programSource, /ReserveAssetRailPayoutDisabled/);
  assert.match(programSource, /require_fresh_reserve_asset_price/);
});

test("[CSO-2026-05-10] direct claim settlement consumes free reserve, not delivery buckets", () => {
  const claimBody = extractInstructionBody("settle_claim_case");
  const liabilityBody = extractRustFunctionBody("sync_adjudicated_claim_liability");

  assert.match(claimBody, /book_direct_claim_payout/);
  assert.doesNotMatch(claimBody, /book_settlement_from_delivery/);
  assert.match(liabilityBody, /DirectClaimReserveUnsupported/);
});

test("[CSO-2026-06-04] settlement fee-vault surface is removed", () => {
  const claimBody = extractInstructionBody("settle_claim_case");
  const obligationBody = extractInstructionBody("settle_obligation");
  const redemptionBody = extractInstructionBody("process_redemption_queue");

  for (const source of [claimBody, obligationBody, redemptionBody, programSource]) {
    assert.doesNotMatch(source, /protocol_fee_bps/);
    assert.doesNotMatch(source, /oracle_fee_bps/);
    assert.doesNotMatch(source, /pool_oracle_fee_vault/);
    assert.doesNotMatch(source, /protocol_fee_vault/);
    assert.doesNotMatch(source, /pool_treasury_vault/);
    assert.doesNotMatch(source, /MAX_CONFIGURED_FEE_BPS/);
  }
});

test("[ALAMANX-509b8643] protocol governance init surface is removed", () => {
  assert.doesNotMatch(programSource, /initialize_protocol_governance/);
  assert.doesNotMatch(programSource, /set_protocol_emergency_pause/);
  assert.doesNotMatch(programSource, /ProtocolGovernance/);
});

test("[CSO-2026-04-29] settlement builders preserve outflow account slots", () => {
  const claim = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.find((row) => row.linkedObligation)
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.claimCases[0]!;
  const obligation = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.find((row) => row.claimCase === claim.address)
    ?? DEVNET_PROTOCOL_FIXTURE_STATE.obligations[0]!;
  const fundingLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find((row) => row.address === claim.fundingLine)!;
  const vault = DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetVaults.find(
    (row) => row.reserveDomain === claim.reserveDomain && row.assetMint === fundingLine.assetMint,
  )!;
  const vaultTokenAccount = vault.address;
  const recipientTokenAccount = DEVNET_PROTOCOL_FIXTURE_STATE.wallets[1]!.address;
  const recentBlockhash = "11111111111111111111111111111111";

  const settleClaim = buildSettleClaimCaseTx({
    authority: DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0]!.address,
    healthPlanAddress: claim.healthPlan,
    reserveDomainAddress: claim.reserveDomain,
    fundingLineAddress: claim.fundingLine,
    assetMint: fundingLine.assetMint,
    claimCaseAddress: claim.address,
    recentBlockhash,
    amount: 1n,
    policySeriesAddress: claim.policySeries ?? null,
    obligationAddress: obligation.address,
    capitalClassAddress: obligation.capitalClass ?? null,
    allocationPositionAddress: obligation.allocationPosition ?? null,
    poolAssetMint: fundingLine.assetMint,
    memberPositionAddress: claim.memberPosition,
    vaultTokenAccountAddress: vaultTokenAccount,
    recipientTokenAccountAddress: recipientTokenAccount,
  });
  assertAccountCount("settle_claim_case", settleClaim.instructions[0]!.keys.length);
  const reserveAssetRailIndex = listProtocolInstructionAccounts("settle_claim_case")
    .findIndex((account) => account.name === "reserve_asset_rail");
  assert.equal(
    settleClaim.instructions[0]!.keys[reserveAssetRailIndex]!.pubkey.toBase58(),
    deriveReserveAssetRailPda({
      reserveDomain: claim.reserveDomain,
      assetMint: fundingLine.assetMint,
    }).toBase58(),
  );
  assert.equal(settleClaim.instructions[0]!.keys.at(-4)!.pubkey.toBase58(), fundingLine.assetMint);
  assert.equal(settleClaim.instructions[0]!.keys.at(-3)!.pubkey.toBase58(), vaultTokenAccount);
  assert.equal(settleClaim.instructions[0]!.keys.at(-2)!.pubkey.toBase58(), recipientTokenAccount);

  const settleObligation = buildSettleObligationTx({
    authority: DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0]!.address,
    healthPlanAddress: obligation.healthPlan,
    reserveDomainAddress: obligation.reserveDomain,
    fundingLineAddress: obligation.fundingLine,
    assetMint: obligation.assetMint,
    obligationAddress: obligation.address,
    recentBlockhash,
    nextStatus: OBLIGATION_STATUS_SETTLED,
    amount: 1n,
    claimCaseAddress: claim.address,
    policySeriesAddress: obligation.policySeries ?? null,
    capitalClassAddress: obligation.capitalClass ?? null,
    allocationPositionAddress: obligation.allocationPosition ?? null,
    poolAssetMint: obligation.assetMint,
    memberPositionAddress: claim.memberPosition,
    vaultTokenAccountAddress: vaultTokenAccount,
    recipientTokenAccountAddress: recipientTokenAccount,
  });
  assertAccountCount("settle_obligation", settleObligation.instructions[0]!.keys.length);
  assert.equal(settleObligation.instructions[0]!.keys.at(-5)!.pubkey.toBase58(), claim.memberPosition);
  assert.equal(settleObligation.instructions[0]!.keys.at(-4)!.pubkey.toBase58(), obligation.assetMint);
  assert.equal(settleObligation.instructions[0]!.keys.at(-3)!.pubkey.toBase58(), vaultTokenAccount);
  assert.equal(settleObligation.instructions[0]!.keys.at(-2)!.pubkey.toBase58(), recipientTokenAccount);
});
