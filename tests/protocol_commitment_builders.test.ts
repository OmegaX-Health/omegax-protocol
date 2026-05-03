// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";

import { PublicKey, SystemProgram } from "@solana/web3.js";
import contractModule from "../frontend/lib/generated/protocol-contract.ts";
import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import genesisCatalogModule from "../frontend/lib/genesis-protect-acute.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const { PROTOCOL_INSTRUCTION_DISCRIMINATORS } = contractModule as typeof import(
  "../frontend/lib/generated/protocol-contract.ts"
);
const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const { GENESIS_PROTECT_ACUTE_PLAN_ID, GENESIS_PROTECT_ACUTE_SKUS } =
  genesisCatalogModule as typeof import("../frontend/lib/genesis-protect-acute.ts");
const {
  COMMITMENT_CAMPAIGN_STATUS_PAUSED,
  COMMITMENT_MODE_DIRECT_PREMIUM,
  COMMITMENT_MODE_TREASURY_CREDIT,
  COMMITMENT_MODE_WATERFALL_RESERVE,
  RESERVE_ASSET_ROLE_PRIMARY_STABLE,
  RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_STREAM,
  buildActivateDirectPremiumCommitmentTx,
  buildActivateTreasuryCreditCommitmentTx,
  buildActivateWaterfallCommitmentTx,
  buildConfigureReserveAssetRailTx,
  buildCreateCommitmentCampaignTx,
  buildCreateCommitmentPaymentRailTx,
  buildDepositCommitmentTx,
  buildInitializeSeriesReserveLedgerTx,
  buildPauseCommitmentCampaignTx,
  buildPublishReserveAssetRailPriceTx,
  buildRefundCommitmentTx,
  deriveCommitmentCampaignPda,
  deriveCommitmentLedgerPda,
  deriveCommitmentPaymentRailPda,
  deriveCommitmentPositionPda,
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultPda,
  deriveDomainAssetVaultTokenAccountPda,
  deriveFundingLineLedgerPda,
  derivePlanReserveLedgerPda,
  deriveProtocolGovernancePda,
  deriveReserveAssetRailPda,
  deriveSeriesReserveLedgerPda,
  getProgramId,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const RECENT_BLOCKHASH = "11111111111111111111111111111111";
const AUTHORITY = new PublicKey("So11111111111111111111111111111111111111112");
const DEPOSITOR = new PublicKey("oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h");
const BENEFICIARY = new PublicKey("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");
const SOURCE_TOKEN_ACCOUNT = new PublicKey("BVfgRQQk1WDTo6QPwhfRR5MKfQ58oV44L94qhEHjk1tg");
const RECIPIENT_TOKEN_ACCOUNT = new PublicKey("9mDzJ7ELwPnoY6p4XbdqfUkVf4ZzsyP6pi97RuPzbrRA");
const CAMPAIGN_ID = "founder-travel30";
const TERMS_HASH = "11".repeat(32);

const genesisPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find(
  (plan) => plan.planId === GENESIS_PROTECT_ACUTE_PLAN_ID,
)!;
const travel30Series = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find(
  (series) => series.seriesId === GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
)!;
const travel30PremiumLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find(
  (line) => line.lineId === GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium,
)!;
const paymentMint = new PublicKey(travel30PremiumLine.assetMint);
const coverageMint = new PublicKey(travel30PremiumLine.assetMint);
const campaign = deriveCommitmentCampaignPda({
  healthPlan: genesisPlan.address,
  campaignId: CAMPAIGN_ID,
});
const ledger = deriveCommitmentLedgerPda({
  campaign,
  paymentAssetMint: paymentMint,
});
const paymentRail = deriveCommitmentPaymentRailPda({
  campaign,
  paymentAssetMint: paymentMint,
});
const reserveAssetRail = deriveReserveAssetRailPda({
  reserveDomain: genesisPlan.reserveDomain,
  assetMint: paymentMint,
});
const position = deriveCommitmentPositionPda({
  campaign,
  depositor: DEPOSITOR,
  beneficiary: BENEFICIARY,
});

function discriminatorForName(name: string): Uint8Array {
  const discriminator = (PROTOCOL_INSTRUCTION_DISCRIMINATORS as Record<string, Uint8Array>)[name];
  assert.ok(discriminator, `expected discriminator for ${name}`);
  return discriminator;
}

function assertProtocolIxShape(
  tx: {
    feePayer?: PublicKey;
    instructions: ReadonlyArray<{
      programId: PublicKey;
      data: Buffer | Uint8Array;
      keys: ReadonlyArray<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;
    }>;
  },
  expectedName: string,
  expectedAuthority: PublicKey,
) {
  assert.equal(tx.instructions.length, 1, `${expectedName} should produce one instruction`);
  const ix = tx.instructions[0]!;
  assert.equal(ix.programId.toBase58(), getProgramId().toBase58());
  assert.deepEqual(Array.from(ix.data.subarray(0, 8)), Array.from(discriminatorForName(expectedName)));
  assert.equal(ix.keys[0]!.pubkey.toBase58(), expectedAuthority.toBase58());
  assert.equal(ix.keys[0]!.isSigner, true);
  return ix;
}

test("commitment PDA helpers mirror the Founder Travel30 account seeds", () => {
  assert.match(campaign.toBase58(), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.match(ledger.toBase58(), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.match(position.toBase58(), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.notEqual(campaign.toBase58(), ledger.toBase58());
  assert.notEqual(ledger.toBase58(), position.toBase58());
  assert.notEqual(paymentRail.toBase58(), ledger.toBase58());
  assert.notEqual(reserveAssetRail.toBase58(), paymentRail.toBase58());
});

test("reserve asset rail builders expose the mixed-treasury oracle controls", () => {
  const configureTx = buildConfigureReserveAssetRailTx({
    authority: AUTHORITY,
    reserveDomainAddress: genesisPlan.reserveDomain,
    assetMint: paymentMint,
    assetSymbol: "USDC",
    role: RESERVE_ASSET_ROLE_PRIMARY_STABLE,
    payoutPriority: 1,
    oracleSource: RESERVE_ORACLE_SOURCE_CHAINLINK_DATA_STREAM,
    oracleFeedIdHex: "aa".repeat(32),
    maxStalenessSeconds: 300n,
    haircutBps: 0,
    maxExposureBps: 10_000,
    depositEnabled: true,
    payoutEnabled: true,
    capacityEnabled: true,
    active: true,
    recentBlockhash: RECENT_BLOCKHASH,
    reasonHashHex: "ab".repeat(32),
  });
  const configureIx = assertProtocolIxShape(configureTx, "configure_reserve_asset_rail", AUTHORITY);
  assert.equal(configureIx.keys.length, 5);
  assert.equal(configureIx.keys[3]!.pubkey.toBase58(), reserveAssetRail.toBase58());

  const publishTx = buildPublishReserveAssetRailPriceTx({
    authority: AUTHORITY,
    reserveDomainAddress: genesisPlan.reserveDomain,
    assetMint: paymentMint,
    priceUsd1e8: 100_000_000n,
    confidenceBps: 5,
    publishedAtTs: 1_770_000_000n,
    proofHashHex: "cd".repeat(32),
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const publishIx = assertProtocolIxShape(publishTx, "publish_reserve_asset_rail_price", AUTHORITY);
  assert.equal(publishIx.keys.length, 3);
  assert.equal(publishIx.keys[2]!.pubkey.toBase58(), reserveAssetRail.toBase58());
});

test("create commitment campaign builder uses the canonical campaign and reserve accounts", () => {
  const tx = buildCreateCommitmentCampaignTx({
    authority: AUTHORITY,
    healthPlanAddress: genesisPlan.address,
    reserveDomainAddress: genesisPlan.reserveDomain,
    coverageFundingLineAddress: travel30PremiumLine.address,
    paymentAssetMint: paymentMint,
    coverageAssetMint: coverageMint,
    activationAuthority: AUTHORITY,
    recentBlockhash: RECENT_BLOCKHASH,
    campaignId: CAMPAIGN_ID,
    displayName: "Founder Travel30",
    metadataUri: "ipfs://founder-travel30",
    mode: COMMITMENT_MODE_DIRECT_PREMIUM,
    depositAmount: 159_000_000n,
    coverageAmount: 1_000_000_000n,
    hardCapAmount: 159_000_000_000n,
    startsAtTs: 1_770_000_000n,
    refundAfterTs: 1_777_776_000n,
    expiresAtTs: 1_780_000_000n,
    termsHashHex: TERMS_HASH,
  });

  const ix = assertProtocolIxShape(tx, "create_commitment_campaign", AUTHORITY);
  assert.equal(ix.keys.length, 13);
  assert.equal(ix.keys[1]!.pubkey.toBase58(), deriveProtocolGovernancePda().toBase58());
  assert.equal(ix.keys[2]!.pubkey.toBase58(), genesisPlan.address);
  assert.equal(
    ix.keys[3]!.pubkey.toBase58(),
      deriveDomainAssetVaultPda({ reserveDomain: genesisPlan.reserveDomain, assetMint: paymentMint }).toBase58(),
  );
  assert.equal(ix.keys[4]!.pubkey.toBase58(), reserveAssetRail.toBase58());
  assert.equal(
    ix.keys[5]!.pubkey.toBase58(),
    deriveDomainAssetLedgerPda({ reserveDomain: genesisPlan.reserveDomain, assetMint: coverageMint }).toBase58(),
  );
  assert.equal(ix.keys[6]!.pubkey.toBase58(), travel30PremiumLine.address);
  assert.equal(
    ix.keys[7]!.pubkey.toBase58(),
    deriveFundingLineLedgerPda({ fundingLine: travel30PremiumLine.address, assetMint: coverageMint }).toBase58(),
  );
  assert.equal(
    ix.keys[8]!.pubkey.toBase58(),
    derivePlanReserveLedgerPda({ healthPlan: genesisPlan.address, assetMint: coverageMint }).toBase58(),
  );
  assert.equal(ix.keys[9]!.pubkey.toBase58(), campaign.toBase58());
  assert.equal(ix.keys[10]!.pubkey.toBase58(), paymentRail.toBase58());
  assert.equal(ix.keys[11]!.pubkey.toBase58(), ledger.toBase58());
  assert.equal(ix.keys[12]!.pubkey.toBase58(), SystemProgram.programId.toBase58());
});

test("additional commitment payment rail builder adds assets without splitting campaigns", () => {
  const tx = buildCreateCommitmentPaymentRailTx({
    authority: AUTHORITY,
    healthPlanAddress: genesisPlan.address,
    reserveDomainAddress: genesisPlan.reserveDomain,
    campaignAddress: campaign,
    coverageFundingLineAddress: travel30PremiumLine.address,
    paymentAssetMint: paymentMint,
    coverageAssetMint: coverageMint,
    recentBlockhash: RECENT_BLOCKHASH,
    mode: COMMITMENT_MODE_WATERFALL_RESERVE,
    depositAmount: 159_000_000n,
    coverageAmount: 1_000_000_000n,
    hardCapAmount: 159_000_000_000n,
  });
  const ix = assertProtocolIxShape(tx, "create_commitment_payment_rail", AUTHORITY);
  assert.equal(ix.keys.length, 10);
  assert.equal(ix.keys[3]!.pubkey.toBase58(), campaign.toBase58());
  assert.equal(ix.keys[6]!.pubkey.toBase58(), travel30PremiumLine.address);
  assert.equal(ix.keys[7]!.pubkey.toBase58(), paymentRail.toBase58());
  assert.equal(ix.keys[8]!.pubkey.toBase58(), ledger.toBase58());
});

test("series reserve ledger builder initializes extra asset accounting for an existing series", () => {
  const tx = buildInitializeSeriesReserveLedgerTx({
    authority: AUTHORITY,
    healthPlanAddress: genesisPlan.address,
    policySeriesAddress: travel30Series.address,
    assetMint: paymentMint,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = assertProtocolIxShape(tx, "initialize_series_reserve_ledger", AUTHORITY);
  assert.equal(ix.keys.length, 6);
  assert.equal(ix.keys[2]!.pubkey.toBase58(), genesisPlan.address);
  assert.equal(ix.keys[3]!.pubkey.toBase58(), travel30Series.address);
  assert.equal(
    ix.keys[4]!.pubkey.toBase58(),
    deriveSeriesReserveLedgerPda({ policySeries: travel30Series.address, assetMint: paymentMint }).toBase58(),
  );
});

test("deposit, refund, and pause commitment builders keep commitment custody outside reserve accounting", () => {
  const depositTx = buildDepositCommitmentTx({
    depositor: DEPOSITOR,
    healthPlanAddress: genesisPlan.address,
    campaignId: CAMPAIGN_ID,
    reserveDomainAddress: genesisPlan.reserveDomain,
    paymentAssetMint: paymentMint,
    sourceTokenAccountAddress: SOURCE_TOKEN_ACCOUNT,
    beneficiary: BENEFICIARY,
    recentBlockhash: RECENT_BLOCKHASH,
    acceptedTermsHashHex: TERMS_HASH,
  });
  const depositIx = assertProtocolIxShape(depositTx, "deposit_commitment", DEPOSITOR);
  assert.equal(depositIx.keys.length, 12);
  assert.equal(depositIx.keys[1]!.pubkey.toBase58(), campaign.toBase58());
  assert.equal(depositIx.keys[2]!.pubkey.toBase58(), paymentRail.toBase58());
  assert.equal(depositIx.keys[3]!.pubkey.toBase58(), reserveAssetRail.toBase58());
  assert.equal(depositIx.keys[4]!.pubkey.toBase58(), ledger.toBase58());
  assert.equal(depositIx.keys[5]!.pubkey.toBase58(), position.toBase58());
  assert.equal(
    depositIx.keys[6]!.pubkey.toBase58(),
    deriveDomainAssetVaultPda({ reserveDomain: genesisPlan.reserveDomain, assetMint: paymentMint }).toBase58(),
  );
  assert.equal(depositIx.keys[7]!.pubkey.toBase58(), SOURCE_TOKEN_ACCOUNT.toBase58());
  assert.equal(
    depositIx.keys[9]!.pubkey.toBase58(),
    deriveDomainAssetVaultTokenAccountPda({ reserveDomain: genesisPlan.reserveDomain, assetMint: paymentMint }).toBase58(),
  );

  const refundTx = buildRefundCommitmentTx({
    depositor: DEPOSITOR,
    campaignAddress: campaign,
    ledgerAddress: ledger,
    positionAddress: position,
    reserveDomainAddress: genesisPlan.reserveDomain,
    paymentAssetMint: paymentMint,
    recipientTokenAccountAddress: RECIPIENT_TOKEN_ACCOUNT,
    recentBlockhash: RECENT_BLOCKHASH,
    refundReasonHashHex: "22".repeat(32),
  });
  const refundIx = assertProtocolIxShape(refundTx, "refund_commitment", DEPOSITOR);
  assert.equal(refundIx.keys.length, 10);
  assert.equal(refundIx.keys[1]!.pubkey.toBase58(), campaign.toBase58());
  assert.equal(refundIx.keys[2]!.pubkey.toBase58(), paymentRail.toBase58());
  assert.equal(refundIx.keys[3]!.pubkey.toBase58(), ledger.toBase58());
  assert.equal(refundIx.keys[4]!.pubkey.toBase58(), position.toBase58());
  assert.equal(refundIx.keys[8]!.pubkey.toBase58(), RECIPIENT_TOKEN_ACCOUNT.toBase58());

  const pauseTx = buildPauseCommitmentCampaignTx({
    authority: AUTHORITY,
    healthPlanAddress: genesisPlan.address,
    campaignId: CAMPAIGN_ID,
    recentBlockhash: RECENT_BLOCKHASH,
    status: COMMITMENT_CAMPAIGN_STATUS_PAUSED,
    reasonHashHex: "33".repeat(32),
  });
  const pauseIx = assertProtocolIxShape(pauseTx, "pause_commitment_campaign", AUTHORITY);
  assert.equal(pauseIx.keys.length, 4);
  assert.equal(pauseIx.keys[1]!.pubkey.toBase58(), deriveProtocolGovernancePda().toBase58());
  assert.equal(pauseIx.keys[2]!.pubkey.toBase58(), genesisPlan.address);
  assert.equal(pauseIx.keys[3]!.pubkey.toBase58(), campaign.toBase58());
});

test("activation builders expose direct-premium and treasury-credit flows with optional series reserve accounting", () => {
  const directTx = buildActivateDirectPremiumCommitmentTx({
    activationAuthority: AUTHORITY,
    healthPlanAddress: genesisPlan.address,
    reserveDomainAddress: genesisPlan.reserveDomain,
    campaignAddress: campaign,
    ledgerAddress: ledger,
    paymentAssetMint: paymentMint,
    coverageAssetMint: coverageMint,
    coverageFundingLineAddress: travel30PremiumLine.address,
    policySeriesAddress: travel30Series.address,
    positionAddress: position,
    recentBlockhash: RECENT_BLOCKHASH,
    activationReasonHashHex: "44".repeat(32),
  });
  const directIx = assertProtocolIxShape(directTx, "activate_direct_premium_commitment", AUTHORITY);
  assert.equal(directIx.keys.length, 12);
  assert.equal(directIx.keys[3]!.pubkey.toBase58(), campaign.toBase58());
  assert.equal(directIx.keys[4]!.pubkey.toBase58(), paymentRail.toBase58());
  assert.equal(directIx.keys[5]!.pubkey.toBase58(), ledger.toBase58());
  assert.equal(directIx.keys[6]!.pubkey.toBase58(), position.toBase58());
  assert.equal(
    directIx.keys[11]!.pubkey.toBase58(),
    deriveSeriesReserveLedgerPda({ policySeries: travel30Series.address, assetMint: coverageMint }).toBase58(),
  );

  const treasuryTx = buildActivateTreasuryCreditCommitmentTx({
    activationAuthority: AUTHORITY,
    healthPlanAddress: genesisPlan.address,
    reserveDomainAddress: genesisPlan.reserveDomain,
    campaignAddress: campaign,
    paymentAssetMint: paymentMint,
    coverageAssetMint: coverageMint,
    coverageFundingLineAddress: travel30PremiumLine.address,
    positionAddress: position,
    recentBlockhash: RECENT_BLOCKHASH,
    activationReasonHashHex: "55".repeat(32),
  });
  const treasuryIx = assertProtocolIxShape(treasuryTx, "activate_treasury_credit_commitment", AUTHORITY);
  assert.equal(treasuryIx.keys.length, 12);
  assert.equal(treasuryIx.keys[0]!.isSigner, true);
  assert.equal(treasuryIx.keys[3]!.pubkey.toBase58(), campaign.toBase58());
  assert.equal(treasuryIx.keys[4]!.pubkey.toBase58(), paymentRail.toBase58());
  assert.equal(treasuryIx.keys[5]!.pubkey.toBase58(), ledger.toBase58());
  assert.equal(treasuryIx.keys[11]!.pubkey.toBase58(), getProgramId().toBase58());
  assert.equal(COMMITMENT_MODE_TREASURY_CREDIT, 1);

  const waterfallTx = buildActivateWaterfallCommitmentTx({
    activationAuthority: AUTHORITY,
    healthPlanAddress: genesisPlan.address,
    reserveDomainAddress: genesisPlan.reserveDomain,
    campaignAddress: campaign,
    ledgerAddress: ledger,
    paymentAssetMint: paymentMint,
    coverageAssetMint: coverageMint,
    coverageFundingLineAddress: travel30PremiumLine.address,
    policySeriesAddress: travel30Series.address,
    positionAddress: position,
    recentBlockhash: RECENT_BLOCKHASH,
    activationReasonHashHex: "66".repeat(32),
  });
  const waterfallIx = assertProtocolIxShape(waterfallTx, "activate_waterfall_commitment", AUTHORITY);
  assert.equal(waterfallIx.keys.length, 13);
  assert.equal(waterfallIx.keys[4]!.pubkey.toBase58(), paymentRail.toBase58());
  assert.equal(waterfallIx.keys[5]!.pubkey.toBase58(), reserveAssetRail.toBase58());
  assert.equal(waterfallIx.keys[6]!.pubkey.toBase58(), ledger.toBase58());
});
