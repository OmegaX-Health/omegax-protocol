// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Regression coverage for emergency-pause enforcement on public commitment
// custody deposits.

import test from "node:test";
import assert from "node:assert/strict";

import fixturesModule from "../../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../../frontend/lib/protocol.ts";
import { extractRustFunctionBody, programSource } from "./program_source.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../../frontend/lib/devnet-fixtures.ts");

const {
  buildDepositCommitmentTx,
  deriveProtocolGovernancePda,
  listProtocolInstructionAccounts,
} = protocolModule as typeof import("../../frontend/lib/protocol.ts");

test("[CSO-2026-05-04] commitment deposits check global emergency pause", () => {
  const body = extractRustFunctionBody("deposit_commitment");

  assert.match(body, /require_protocol_not_paused\(&ctx\.accounts\.protocol_governance\)\?/);
  assert.match(
    programSource,
    /pub struct DepositCommitment<'info>[\s\S]+pub protocol_governance: Box<Account<'info, ProtocolGovernance>>/,
  );
});

test("[CSO-2026-05-04] deposit commitment builder carries protocol governance", () => {
  const fixture = DEVNET_PROTOCOL_FIXTURE_STATE;
  const plan = fixture.healthPlans[0]!;
  const fundingLine = fixture.fundingLines.find((row) => row.healthPlan === plan.address)
    ?? fixture.fundingLines[0]!;
  const depositor = fixture.wallets[0]!.address;
  const tx = buildDepositCommitmentTx({
    depositor,
    healthPlanAddress: plan.address,
    campaignId: "security-pause-regression",
    reserveDomainAddress: plan.reserveDomain,
    paymentAssetMint: fundingLine.assetMint,
    sourceTokenAccountAddress: depositor,
    beneficiary: fixture.wallets[1]!.address,
    recentBlockhash: "11111111111111111111111111111111",
  });

  assert.equal(tx.instructions[0]!.keys.length, listProtocolInstructionAccounts("deposit_commitment").length);
  assert.equal(tx.instructions[0]!.keys[1]!.pubkey.toBase58(), deriveProtocolGovernancePda().toBase58());
});
