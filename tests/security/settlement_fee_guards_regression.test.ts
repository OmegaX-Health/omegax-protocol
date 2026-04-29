// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regressions for claim settlement:
// - linked obligations cannot be marked settled without an SPL outflow
// - settlement must carry the canonical protocol fee vault account
// - public builders must keep optional account placeholders in order

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import fixturesModule from "../../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../../frontend/lib/protocol.ts";

const programSource = readFileSync(
  new URL("../../programs/omegax_protocol/src/lib.rs", import.meta.url),
  "utf8",
);

const {
  DEVNET_PROTOCOL_FIXTURE_STATE,
} = fixturesModule as typeof import("../../frontend/lib/devnet-fixtures.ts");

const {
  OBLIGATION_STATUS_SETTLED,
  buildSettleClaimCaseTx,
  buildSettleObligationTx,
  deriveProtocolFeeVaultPda,
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
  assert.match(body, /vault\.oracle[\s\S]+ctx\.accounts\.claim_case\.adjudicator/);
  assert.match(body, /\(None, Some\(_\)\)[\s\S]+FeeVaultRequiredForConfiguredFee/);
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
    settleClaim.instructions[0]!.keys[14]!.pubkey.toBase58(),
    deriveProtocolFeeVaultPda({
      reserveDomain: claim.reserveDomain,
      assetMint: fundingLine.assetMint,
    }).toBase58(),
  );
  assert.equal(settleClaim.instructions[0]!.keys[17]!.pubkey.toBase58(), claim.memberPosition);
  assert.equal(settleClaim.instructions[0]!.keys[19]!.pubkey.toBase58(), vaultTokenAccount);
  assert.equal(settleClaim.instructions[0]!.keys[20]!.pubkey.toBase58(), recipientTokenAccount);

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
  assert.equal(settleObligation.instructions[0]!.keys[14]!.pubkey.toBase58(), claim.memberPosition);
  assert.equal(settleObligation.instructions[0]!.keys[16]!.pubkey.toBase58(), vaultTokenAccount);
  assert.equal(settleObligation.instructions[0]!.keys[17]!.pubkey.toBase58(), recipientTokenAccount);
});
