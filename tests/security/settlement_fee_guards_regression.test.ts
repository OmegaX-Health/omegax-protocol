// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regressions for claim settlement:
// - linked obligations cannot be marked settled without an SPL outflow
// - settlement must carry the canonical protocol fee vault account
// - public builders must keep optional account placeholders in order

import test from "node:test";
import assert from "node:assert/strict";

import fixturesModule from "../../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../../frontend/lib/protocol.ts";
import { extractRustFunctionBody, programSource } from "./program_source.ts";

const {
  DEVNET_PROTOCOL_FIXTURE_STATE,
} = fixturesModule as typeof import("../../frontend/lib/devnet-fixtures.ts");

const {
  OBLIGATION_STATUS_SETTLED,
  buildSettleClaimCaseTx,
  buildSettleClaimCaseSelectedAssetTx,
  buildSettleObligationTx,
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultPda,
  deriveProtocolFeeVaultPda,
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

test("[CSO-2026-04-29] claim settlement removed fee-vault omission compatibility branches", () => {
  const body = extractInstructionBody("settle_claim_case");

  assert.doesNotMatch(body, /protocol_fee_bps\s*==\s*0/);
  assert.doesNotMatch(body, /policy\.oracle_fee_bps\s*==\s*0/);
  assert.match(body, /let protocol_fee_vault = &ctx\.accounts\.protocol_fee_vault/);
  assert.match(body, /oracle_fee_attestation\.as_deref\(\)/);
  assert.match(body, /vault\.oracle[\s\S]+attestation\.oracle/);
  assert.doesNotMatch(body, /vault\.oracle[\s\S]+ctx\.accounts\.claim_case\.adjudicator/);
  assert.match(body, /ClaimAttestationRequiredForOracleFee/);
  assert.match(body, /\(None, Some\(_\), _\)[\s\S]+FeeVaultRequiredForConfiguredFee/);
});

test("[CSO-2026-05-04] claim settlement rejects zero-net fee outcomes", () => {
  const body = extractInstructionBody("settle_claim_case");

  assert.match(body, /let total_fee = checked_add\(protocol_fee, oracle_fee\)\?/);
  assert.match(body, /total_fee < amount[\s\S]+FeeVaultBpsMisconfigured/);
  assert.match(body, /let net_to_recipient = checked_sub\(amount, total_fee\)\?/);
  assert.match(body, /require_positive_amount\(net_to_recipient\)\?/);
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

test("[CSO-2026-05-06] payout-only rails can publish prices but zero staleness is rejected", () => {
  const configureBody = extractInstructionBody("configure_reserve_asset_rail");
  const publishBody = extractInstructionBody("publish_reserve_asset_rail_price");
  const freshnessBody = extractInstructionBody("require_fresh_reserve_asset_price_at");

  assert.match(configureBody, /let price_required = args\.capacity_enabled \|\| args\.payout_enabled/);
  assert.match(configureBody, /args\.max_staleness_seconds > 0/);
  assert.match(publishBody, /capacity_enabled[\s\S]+\|\|[\s\S]+payout_enabled/);
  assert.match(freshnessBody, /rail\.max_staleness_seconds > 0/);
});

test("[CSO-2026-05-04] redemption settlement rejects zero-net LP payouts", () => {
  const body = extractInstructionBody("process_redemption_queue");

  assert.match(body, /let exit_fee = fee_share_from_bps\(asset_amount, class_fee_bps\)\?/);
  assert.match(body, /exit_fee < asset_amount[\s\S]+FeeVaultBpsMisconfigured/);
  assert.match(body, /let net_to_lp = checked_sub\(asset_amount, exit_fee\)\?/);
  assert.match(body, /require_positive_amount\(net_to_lp\)\?/);
});

test("[CSO-2026-05-04] configured fee bps cannot be 100 percent", () => {
  assert.match(programSource, /pub const MAX_CONFIGURED_FEE_BPS: u16 = BASIS_POINTS_DENOMINATOR - 1;/);
  assert.match(
    extractInstructionBody("initialize_protocol_governance"),
    /args\.protocol_fee_bps <= MAX_CONFIGURED_FEE_BPS/,
  );
  assert.match(extractInstructionBody("set_pool_oracle_policy"), /args\.oracle_fee_bps <= MAX_CONFIGURED_FEE_BPS/);
  assert.match(extractInstructionBody("create_liquidity_pool"), /args\.fee_bps <= MAX_CONFIGURED_FEE_BPS/);
  assert.match(extractInstructionBody("create_capital_class"), /args\.fee_bps <= MAX_CONFIGURED_FEE_BPS/);
});

test("[CSO-2026-04-29] settlement builders preserve fee and outflow account slots", () => {
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
  assert.equal(
    settleClaim.instructions[0]!.keys[3]!.pubkey.toBase58(),
    deriveReserveAssetRailPda({
      reserveDomain: claim.reserveDomain,
      assetMint: fundingLine.assetMint,
    }).toBase58(),
  );
  assert.equal(
    settleClaim.instructions[0]!.keys[15]!.pubkey.toBase58(),
    deriveProtocolFeeVaultPda({
      reserveDomain: claim.reserveDomain,
      assetMint: fundingLine.assetMint,
    }).toBase58(),
  );
  assert.equal(settleClaim.instructions[0]!.keys[19]!.pubkey.toBase58(), claim.memberPosition);
  assert.equal(settleClaim.instructions[0]!.keys[21]!.pubkey.toBase58(), vaultTokenAccount);
  assert.equal(settleClaim.instructions[0]!.keys[22]!.pubkey.toBase58(), recipientTokenAccount);

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
    poolAssetMint: fundingLine.assetMint,
    memberPositionAddress: claim.memberPosition,
    vaultTokenAccountAddress: vaultTokenAccount,
    recipientTokenAccountAddress: recipientTokenAccount,
  });
  assertAccountCount("settle_obligation", settleObligation.instructions[0]!.keys.length);
  assert.equal(
    settleObligation.instructions[0]!.keys[3]!.pubkey.toBase58(),
    deriveReserveAssetRailPda({
      reserveDomain: obligation.reserveDomain,
      assetMint: obligation.assetMint,
    }).toBase58(),
  );
  assert.equal(settleObligation.instructions[0]!.keys[15]!.pubkey.toBase58(), claim.memberPosition);
  assert.equal(settleObligation.instructions[0]!.keys[17]!.pubkey.toBase58(), vaultTokenAccount);
  assert.equal(settleObligation.instructions[0]!.keys[18]!.pubkey.toBase58(), recipientTokenAccount);

  const payoutAssetMint = DEVNET_PROTOCOL_FIXTURE_STATE.wallets[2]!.address;
  const payoutFundingLine = DEVNET_PROTOCOL_FIXTURE_STATE.wallets[3]!.address;
  const selectedAssetSettlement = buildSettleClaimCaseSelectedAssetTx({
    authority: DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0]!.address,
    healthPlanAddress: claim.healthPlan,
    reserveDomainAddress: claim.reserveDomain,
    payoutFundingLineAddress: payoutFundingLine,
    claimAssetMint: fundingLine.assetMint,
    payoutAssetMint,
    claimCaseAddress: claim.address,
    memberPositionAddress: claim.memberPosition,
    payoutVaultTokenAccountAddress: vaultTokenAccount,
    recipientTokenAccountAddress: recipientTokenAccount,
    recentBlockhash,
    claimCreditAmount: 1n,
    payoutAmount: 1n,
    policySeriesAddress: claim.policySeries ?? null,
  });
  assertAccountCount("settle_claim_case_selected_asset", selectedAssetSettlement.instructions[0]!.keys.length);
  assert.equal(
    selectedAssetSettlement.instructions[0]!.keys[3]!.pubkey.toBase58(),
    deriveReserveAssetRailPda({
      reserveDomain: claim.reserveDomain,
      assetMint: fundingLine.assetMint,
    }).toBase58(),
  );
  assert.equal(
    selectedAssetSettlement.instructions[0]!.keys[4]!.pubkey.toBase58(),
    deriveReserveAssetRailPda({
      reserveDomain: claim.reserveDomain,
      assetMint: payoutAssetMint,
    }).toBase58(),
  );
  assert.equal(
    selectedAssetSettlement.instructions[0]!.keys[5]!.pubkey.toBase58(),
    deriveDomainAssetVaultPda({
      reserveDomain: claim.reserveDomain,
      assetMint: payoutAssetMint,
    }).toBase58(),
  );
  assert.equal(
    selectedAssetSettlement.instructions[0]!.keys[6]!.pubkey.toBase58(),
    deriveDomainAssetLedgerPda({
      reserveDomain: claim.reserveDomain,
      assetMint: payoutAssetMint,
    }).toBase58(),
  );
  assert.equal(selectedAssetSettlement.instructions[0]!.keys[11]!.pubkey.toBase58(), claim.address);
  assert.equal(selectedAssetSettlement.instructions[0]!.keys[12]!.pubkey.toBase58(), claim.memberPosition);
  assert.equal(selectedAssetSettlement.instructions[0]!.keys[15]!.pubkey.toBase58(), vaultTokenAccount);
  assert.equal(selectedAssetSettlement.instructions[0]!.keys[16]!.pubkey.toBase58(), recipientTokenAccount);
});
