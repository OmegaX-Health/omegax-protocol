// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import {
  FOUNDER_ASSET_RAILS,
  assertCanonicalAccountMatches,
  assertMaySend,
  chainInputsFromSnapshot,
  evaluateChainActuarialGate,
  fundingLineIdForAsset,
  parseRehearsalArgs,
  rawAmountForUsd,
  redactEvidence,
  requireClassicTokenProgramId,
} from "../scripts/support/devnet_founder_rehearsal_core.ts";
const COMMITMENT_POSITION_PENDING = 0;
const COMMITMENT_POSITION_REFUNDED = 3;
const COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED = 4;
const OBLIGATION_STATUS_RESERVED = 1;

test("devnet founder rehearsal defaults to read-only plan mode and refuses sends", () => {
  assert.deepEqual(parseRehearsalArgs([]), {
    mode: "plan",
    resume: false,
    actuarialOnly: false,
  });
  assert.deepEqual(parseRehearsalArgs(["--execute", "--resume"]), {
    mode: "execute",
    resume: true,
    actuarialOnly: false,
  });
  assert.throws(() => parseRehearsalArgs(["--plan", "--execute"]), /exactly one/i);
  assert.throws(() => assertMaySend("plan"), /without --execute/i);
  assert.doesNotThrow(() => assertMaySend("execute"));
});

test("devnet founder rehearsal hard-fails canonical account mismatches", () => {
  assert.doesNotThrow(() =>
    assertCanonicalAccountMatches("campaign", {
      campaignId: "founder-travel30",
      mode: 2,
      active: true,
    }, {
      campaignId: "founder-travel30",
      mode: 2,
    })
  );
  assert.throws(() =>
    assertCanonicalAccountMatches("campaign", {
      campaignId: "founder-travel30",
      mode: 0,
    }, {
      campaignId: "founder-travel30",
      mode: 2,
    }), /Canonical devnet account mismatch.*mode/i);
});

test("devnet founder rehearsal accepts only classic SPL token program IDs", () => {
  assert.equal(requireClassicTokenProgramId(null).toBase58(), TOKEN_PROGRAM_ID.toBase58());
  assert.equal(requireClassicTokenProgramId(TOKEN_PROGRAM_ID).toBase58(), TOKEN_PROGRAM_ID.toBase58());
  assert.throws(
    () => requireClassicTokenProgramId(TOKEN_2022_PROGRAM_ID),
    /classic SPL Token.*Token-2022/i,
  );
});

test("devnet founder rehearsal maps one UI campaign to per-asset funding lines under one treasury domain", () => {
  const ids = FOUNDER_ASSET_RAILS.map((asset) => fundingLineIdForAsset(asset.symbol));
  assert.deepEqual(ids, [
    "genesis-travel30-premiums-usdc",
    "genesis-travel30-premiums-pusd",
    "genesis-travel30-premiums-wsol",
    "genesis-travel30-premiums-wbtc",
    "genesis-travel30-premiums-weth",
    "genesis-travel30-premiums-omegax",
  ]);
  assert.equal(new Set(ids).size, FOUNDER_ASSET_RAILS.length);
});

test("devnet founder rehearsal redacts evidence without hiding public addresses", () => {
  const redacted = redactEvidence({
    signer: "oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h",
    privateKeyPath: "local-operator-keypair.json",
    nested: {
      rawHealthData: "raw health data with diagnosis",
      tx: "5hJ8SomePublicSignature",
    },
  });
  assert.equal(redacted.signer, "oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h");
  assert.equal(redacted.privateKeyPath, "<redacted>");
  assert.equal(redacted.nested.rawHealthData, "<redacted>");
  assert.equal(redacted.nested.tx, "5hJ8SomePublicSignature");
});

test("devnet founder chain actuarial capacity excludes pending and refunded commitments", () => {
  const usdc = FOUNDER_ASSET_RAILS.find((asset) => asset.symbol === "USDC")!;
  const nowTs = 1_777_000_000;
  const report = evaluateChainActuarialGate({
    nowTs,
    activatedTravel30Members: 10,
    assets: [
      {
        symbol: "USDC",
        mint: "USDC111111111111111111111111111111111111111",
        decimals: usdc.decimals,
        payoutPriority: usdc.payoutPriority,
        haircutBps: usdc.haircutBps,
        maxExposureBps: usdc.maxExposureBps,
        priceUsd1e8: usdc.priceUsd1e8,
        fundedRaw: 10_000_000_000n,
        pendingRaw: 1_000_000_000_000n,
        refundedRaw: 1_000_000_000_000n,
        reservedRaw: 1_000_000_000n,
        active: true,
        capacityEnabled: true,
        pricePublishedAtTs: nowTs,
        maxStalenessSeconds: 86_400,
      },
      {
        symbol: "OMEGAX",
        mint: "OMEGAX1111111111111111111111111111111111111",
        decimals: 6,
        payoutPriority: 6,
        haircutBps: 7_500,
        maxExposureBps: 2_000,
        priceUsd1e8: 10_000_000n,
        fundedRaw: 1_000_000_000_000n,
        active: true,
        capacityEnabled: false,
        pricePublishedAtTs: nowTs,
        maxStalenessSeconds: 86_400,
      },
    ],
    assumptions: {
      seed: 7,
      trials: 1_000,
      baselineClaimFrequency: 0.04,
      maxPayoutUsd: 3_000,
      severityMinUsd: 75,
      severityModeUsd: 650,
      severityP95Usd: 2_250,
      severityMaxUsd: 3_000,
    },
  });
  assert.equal(report.grossReserveUsd, 10_000);
  assert.equal(report.freeReserveUsd, 9_000);
  assert.deepEqual(report.countedAssets, ["USDC"]);
  assert.deepEqual(report.excludedAssets, [{ symbol: "OMEGAX", reason: "capacity disabled" }]);
  assert.match(report.notes.join("\n"), /Pending commitments are excluded/);
});

test("devnet founder chain inputs derive activated reserve while leaving pending/refunded out", () => {
  const nowTs = 1_777_000_000;
  const usdcMint = "USDC111111111111111111111111111111111111111";
  const campaign = "Campaign111111111111111111111111111111111111";
  const inputs = chainInputsFromSnapshot({
    nowTs,
    reserveDomain: "Reserve111111111111111111111111111111111111",
    assets: [{
      ...FOUNDER_ASSET_RAILS[0]!,
      mint: usdcMint,
    }],
    ledgers: [{
      address: "Ledger1111111111111111111111111111111111111",
      reserveDomain: "Reserve111111111111111111111111111111111111",
      assetMint: usdcMint,
      sheet: { funded: 0n },
    }],
    rails: [{
      address: "Rail111111111111111111111111111111111111111",
      reserveDomain: "Reserve111111111111111111111111111111111111",
      assetMint: usdcMint,
      oracleAuthority: "Oracle111111111111111111111111111111111111",
      assetSymbol: "USDC",
      role: 0,
      payoutPriority: 1,
      oracleSource: 3,
      oracleFeedIdHex: "11".repeat(32),
      maxStalenessSeconds: 86_400,
      haircutBps: 0,
      maxExposureBps: 10_000,
      depositEnabled: true,
      payoutEnabled: true,
      capacityEnabled: true,
      active: true,
      lastPriceUsd1e8: 100_000_000n,
      lastPriceConfidenceBps: 5,
      lastPricePublishedAtTs: nowTs,
      lastPriceSlot: 1n,
      lastPriceProofHashHex: "22".repeat(32),
      auditNonce: 1n,
      bump: 255,
    }],
    commitmentPositions: [
      commitmentPosition(campaign, usdcMint, 159_000_000n, COMMITMENT_POSITION_PENDING),
      commitmentPosition(campaign, usdcMint, 159_000_000n, COMMITMENT_POSITION_REFUNDED),
      commitmentPosition(campaign, usdcMint, 159_000_000n, COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED),
    ],
    obligations: [{
      address: "Obligation111111111111111111111111111111111",
      reserveDomain: "Reserve111111111111111111111111111111111111",
      assetMint: usdcMint,
      healthPlan: "Plan1111111111111111111111111111111111111111",
      fundingLine: "Funding11111111111111111111111111111111111",
      obligationId: "claim-1",
      status: OBLIGATION_STATUS_RESERVED,
      deliveryMode: 1,
      principalAmount: 25_000_000n,
      reservedAmount: 25_000_000n,
    }],
  });

  assert.equal(inputs[0]!.fundedRaw, 159_000_000n);
  assert.equal(inputs[0]!.pendingRaw, 159_000_000n);
  assert.equal(inputs[0]!.refundedRaw, 159_000_000n);
  assert.equal(inputs[0]!.reservedRaw, 25_000_000n);
});

test("devnet founder raw amount conversion handles stable, SOL, BTC, ETH, and OMEGAX rails", () => {
  const bySymbol = Object.fromEntries(FOUNDER_ASSET_RAILS.map((asset) => [asset.symbol, asset]));
  assert.equal(rawAmountForUsd({ usd: 159, decimals: bySymbol.USDC.decimals, priceUsd1e8: bySymbol.USDC.priceUsd1e8 }), 159_000_000n);
  assert.equal(rawAmountForUsd({ usd: 159, decimals: bySymbol.PUSD.decimals, priceUsd1e8: bySymbol.PUSD.priceUsd1e8 }), 159_000_000n);
  assert.equal(rawAmountForUsd({ usd: 159, decimals: bySymbol.WSOL.decimals, priceUsd1e8: bySymbol.WSOL.priceUsd1e8 }), 1_060_000_000n);
  assert.equal(rawAmountForUsd({ usd: 159, decimals: bySymbol.WBTC.decimals, priceUsd1e8: bySymbol.WBTC.priceUsd1e8 }), 159_000n);
  assert.equal(rawAmountForUsd({ usd: 159, decimals: bySymbol.WETH.decimals, priceUsd1e8: bySymbol.WETH.priceUsd1e8 }), 5_300_000n);
  assert.equal(rawAmountForUsd({ usd: 159, decimals: bySymbol.OMEGAX.decimals, priceUsd1e8: bySymbol.OMEGAX.priceUsd1e8 }), 1_590_000_000n);
});

function commitmentPosition(campaign: string, mint: string, amount: bigint, state: number) {
  return {
    address: `${state}111111111111111111111111111111111111111`,
    campaign,
    ledger: "Ledger1111111111111111111111111111111111111",
    depositor: "Depositor111111111111111111111111111111111",
    beneficiary: "Beneficiary1111111111111111111111111111111",
    paymentAssetMint: mint,
    coverageAssetMint: mint,
    amount,
    coverageAmount: amount,
    queueIndex: BigInt(state),
    state,
    acceptedTermsHashHex: "33".repeat(32),
    paidAt: 1,
    activatedAt: state === COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED ? 2 : 0,
    refundedAt: state === COMMITMENT_POSITION_REFUNDED ? 3 : 0,
    bump: 255,
  };
}
