// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, SystemProgram } from "@solana/web3.js";

import cycleQuoteModule from "../frontend/lib/cycle-quote.ts";
import mapperModule from "../frontend/lib/protocol-workspace-mappers.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const cycleQuote = cycleQuoteModule as typeof import("../frontend/lib/cycle-quote.ts");
const mappers = mapperModule as typeof import("../frontend/lib/protocol-workspace-mappers.ts");
const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");

test("parseCycleQuotePayload normalizes nested quote payloads and verification instructions", () => {
  const payload = {
    quote: {
      oracle: Keypair.generate().publicKey.toBase58(),
      member: Keypair.generate().publicKey.toBase58(),
      paymentMint: protocol.ZERO_PUBKEY,
      seriesRefHashHex: "11".repeat(32),
      periodIndex: "4",
      nonceHashHex: "22".repeat(32),
      premiumAmountRaw: "500",
      canonicalPremiumAmount: "500",
      commitmentEnabled: true,
      bondAmountRaw: "50",
      shieldFeeRaw: "0",
      protocolFeeRaw: "5",
      oracleFeeRaw: "3",
      netPoolPremiumRaw: "492",
      totalAmountRaw: "550",
      includedShieldCount: 0,
      thresholdBps: 1000,
      outcomeThresholdScore: 720,
      cohortHashHex: "33".repeat(32),
      expiresAtTs: "1700000000",
      quoteMetaHashHex: "44".repeat(32),
      verificationInstruction: {
        programId: SystemProgram.programId.toBase58(),
        dataHex: "07",
      },
    },
  };

  const normalized = cycleQuote.normalizeCycleQuotePayload(payload);

  assert.equal(normalized.paymentMint, protocol.ZERO_PUBKEY);
  assert.equal(normalized.periodIndex, 4n);
  assert.equal(normalized.quoteVerificationInstruction?.programId.toBase58(), SystemProgram.programId.toBase58());
  assert.equal(cycleQuote.quoteUsesSolRail(normalized), true);
});

test("workspace mappers derive claim, redemption, and settlement defaults from indexed records", () => {
  const claimDraft = mappers.deriveCoverageClaimActionDraft({
    claim: {
      claimant: "claimant",
      requestedAmount: 99n,
      approvedAmount: 0n,
      recoveryAmount: 7n,
      status: protocol.COVERAGE_CLAIM_STATUS_UNDER_REVIEW,
    } as never,
    poolTerms: {
      payoutAssetMint: protocol.ZERO_PUBKEY,
    } as never,
    poolAssetVault: null,
  });
  assert.equal(claimDraft.recommendedOperatorAction, "support");
  assert.equal(claimDraft.payoutAmount, 99n);

  const redemptionDraft = mappers.deriveRedemptionQueueActionDraft({
    request: {
      payoutMint: protocol.ZERO_PUBKEY,
      status: protocol.REDEMPTION_REQUEST_STATUS_SCHEDULED,
    } as never,
    capitalClass: {
      classIdHashHex: "aa".repeat(32),
      classPriority: 2,
      redemptionQueueEnabled: true,
      redemptionNoticeSecs: 604800n,
      payoutMint: protocol.ZERO_PUBKEY,
    } as never,
  });
  assert.equal(redemptionDraft.recommendedAction, "fulfill");
  assert.equal(redemptionDraft.canFulfill, true);

  const settlementDraft = mappers.deriveOracleSettlementActionDraft({
    memberCycle: {
      paymentMint: protocol.ZERO_PUBKEY,
      passed: true,
      settledAt: 0n,
    } as never,
    aggregate: {
      finalized: true,
      reviewStatus: protocol.OUTCOME_REVIEW_STATUS_CLEAR,
      passed: true,
    } as never,
    poolTerms: {
      payoutAssetMint: protocol.ZERO_PUBKEY,
    } as never,
    settlementRootFinalized: false,
  });
  assert.equal(settlementDraft.payoutRail, "sol");
  assert.equal(settlementDraft.recommendedAction, "settle");
});
