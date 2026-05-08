// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import { Keypair } from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
type DomainAssetVaultSnapshot = import("../frontend/lib/protocol.ts").DomainAssetVaultSnapshot;
type ProtocolConsoleSnapshot = import("../frontend/lib/protocol.ts").ProtocolConsoleSnapshot;
type ReserveAssetRailSnapshot = import("../frontend/lib/protocol.ts").ReserveAssetRailSnapshot;

const nowTs = 1_777_777_777;
const reserveDomain = pk();
const settlementMint = pk();
const wbtcMint = pk();
const wethMint = pk();
const healthPlan = pk();
const policySeries = pk();
const fundingLine = pk();
const pool = pk();
const capitalClass = pk();

function pk(): string {
  return Keypair.generate().publicKey.toBase58();
}

function emptySnapshot(overrides: Partial<ProtocolConsoleSnapshot> = {}): ProtocolConsoleSnapshot {
  return {
    protocolGovernance: null,
    reserveDomains: [],
    domainAssetVaults: [],
    reserveAssetRails: [],
    domainAssetLedgers: [],
    healthPlans: [],
    policySeries: [],
    memberPositions: [],
    commitmentCampaigns: [],
    commitmentPaymentRails: [],
    commitmentLedgers: [],
    commitmentPositions: [],
    fundingLines: [],
    claimCases: [],
    obligations: [],
    liquidityPools: [],
    capitalClasses: [],
    lpPositions: [],
    allocationPositions: [],
    planReserveLedgers: [],
    seriesReserveLedgers: [],
    fundingLineLedgers: [],
    poolClassLedgers: [],
    allocationLedgers: [],
    outcomesBySeries: {},
    oracleProfiles: [],
    poolOracleApprovals: [],
    poolOraclePolicies: [],
    poolOraclePermissionSets: [],
    outcomeSchemas: [],
    schemaDependencyLedgers: [],
    claimAttestations: [],
    protocolFeeVaults: [],
    poolTreasuryVaults: [],
    poolOracleFeeVaults: [],
    ...overrides,
  };
}

function vault(assetMint: string, totalAssets: bigint): DomainAssetVaultSnapshot {
  return {
    address: pk(),
    reserveDomain,
    assetMint,
    vaultTokenAccount: pk(),
    totalAssets,
    bump: 255,
  };
}

function rail(params: {
  assetMint: string;
  symbol: string;
  priceUsd1e8?: bigint;
  haircutBps?: number;
  publishedAtTs?: number;
  maxStalenessSeconds?: number;
  maxConfidenceBps?: number;
  lastPriceConfidenceBps?: number;
  payoutEnabled?: boolean;
  capacityEnabled?: boolean;
}): ReserveAssetRailSnapshot {
  return {
    address: pk(),
    reserveDomain,
    assetMint: params.assetMint,
    oracleAuthority: pk(),
    assetSymbol: params.symbol,
    role: 0,
    payoutPriority: 0,
    oracleSource: 0,
    oracleFeedIdHex: "11".repeat(32),
    maxStalenessSeconds: params.maxStalenessSeconds ?? 3_600,
    maxConfidenceBps: params.maxConfidenceBps ?? 50,
    haircutBps: params.haircutBps ?? 0,
    maxExposureBps: 10_000,
    depositEnabled: true,
    payoutEnabled: params.payoutEnabled ?? true,
    capacityEnabled: params.capacityEnabled ?? true,
    active: true,
    lastPriceUsd1e8: params.priceUsd1e8 ?? 100_000_000n,
    lastPriceConfidenceBps: params.lastPriceConfidenceBps ?? 25,
    lastPricePublishedAtTs: params.publishedAtTs ?? nowTs,
    lastPriceSlot: 1n,
    lastPriceProofHashHex: "22".repeat(32),
    auditNonce: 0n,
    bump: 254,
  };
}

test("claim funding readiness settles now when settlement-mint reserve capacity is enough", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      domainAssetLedgers: [{ address: pk(), reserveDomain, assetMint: settlementMint, sheet: { funded: 1_000n } }],
      reserveAssetRails: [rail({ assetMint: settlementMint, symbol: "USDC" })],
    }),
    reserveDomainAddress: reserveDomain,
    settlementMint,
    requestedAmount: 600n,
    assetDecimalsByMint: { [settlementMint]: 0 },
    nowTs,
  });

  assert.equal(model.readiness, "settle_now");
  assert.equal(model.immediatelySettleableAmount, 1_000n);
  assert.equal(model.otherReserveAssets.length, 0);
});

test("claim funding readiness shows other priced assets without treating them as settlement capacity", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      domainAssetLedgers: [
        { address: pk(), reserveDomain, assetMint: settlementMint, sheet: { funded: 250n } },
        { address: pk(), reserveDomain, assetMint: wbtcMint, sheet: { funded: 1n } },
      ],
      reserveAssetRails: [
        rail({ assetMint: settlementMint, symbol: "USDC" }),
        rail({ assetMint: wbtcMint, symbol: "WBTC", priceUsd1e8: 5_000_000_000_000n, haircutBps: 5_000 }),
      ],
    }),
    reserveDomainAddress: reserveDomain,
    settlementMint,
    requestedAmount: 1_000n,
    assetDecimalsByMint: { [settlementMint]: 0, [wbtcMint]: 0 },
    nowTs,
  });

  assert.equal(model.immediatelySettleableAmount, 250n);
  assert.equal(model.readiness, "operator_action_required");
  assert.equal(model.otherReserveAssets.length, 1);
  assert.equal(model.otherReserveAssets[0]!.assetMint, wbtcMint);
  assert.equal(model.otherReserveAssets[0]!.immediatelySettleable, false);
  assert.equal(model.otherReserveAssets[0]!.selectedForPayout, true);
  assert.equal(model.selectedPayoutAsset?.assetMint, wbtcMint);
  assert.equal(model.estimatedSelectedPayoutAmountRaw, 1n);
  assert(model.warnings.some((warning) => warning.includes("selected-asset payout")));
  assert(model.warnings.some((warning) => warning.includes("not a swap")));
});

test("claim funding readiness refuses to count non-settlement assets without a fresh price", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      domainAssetLedgers: [
        { address: pk(), reserveDomain, assetMint: settlementMint, sheet: { funded: 100n } },
        { address: pk(), reserveDomain, assetMint: wethMint, sheet: { funded: 10n } },
      ],
      reserveAssetRails: [
        rail({ assetMint: settlementMint, symbol: "USDC" }),
        rail({ assetMint: wethMint, symbol: "WETH", priceUsd1e8: 0n }),
      ],
    }),
    reserveDomainAddress: reserveDomain,
    settlementMint,
    requestedAmount: 500n,
    assetDecimalsByMint: { [settlementMint]: 0, [wethMint]: 0 },
    nowTs,
  });

  assert.equal(model.readiness, "queue_or_refund");
  assert.equal(model.otherReserveAssets[0]!.haircutAdjustedValueUsd1e8, null);
  assert(model.otherReserveAssets[0]!.warnings.some((warning) => warning.includes("No fresh published price")));
});

test("claim funding readiness rejects zero-staleness fallback prices", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      domainAssetLedgers: [
        { address: pk(), reserveDomain, assetMint: settlementMint, sheet: { funded: 100n } },
        { address: pk(), reserveDomain, assetMint: wbtcMint, sheet: { funded: 1n } },
      ],
      reserveAssetRails: [
        rail({ assetMint: settlementMint, symbol: "USDC" }),
        rail({ assetMint: wbtcMint, symbol: "WBTC", priceUsd1e8: 5_000_000_000_000n, maxStalenessSeconds: 0 }),
      ],
    }),
    reserveDomainAddress: reserveDomain,
    settlementMint,
    requestedAmount: 500n,
    assetDecimalsByMint: { [settlementMint]: 0, [wbtcMint]: 0 },
    nowTs,
  });

  assert.equal(model.readiness, "queue_or_refund");
  assert.equal(model.selectedPayoutAsset, null);
  assert.equal(model.otherReserveAssets[0]!.priceFresh, false);
});

test("claim funding readiness rejects unsafe reserve price confidence", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      domainAssetLedgers: [
        { address: pk(), reserveDomain, assetMint: settlementMint, sheet: { funded: 100n } },
        { address: pk(), reserveDomain, assetMint: wbtcMint, sheet: { funded: 1n } },
      ],
      reserveAssetRails: [
        rail({ assetMint: settlementMint, symbol: "USDC" }),
        rail({
          assetMint: wbtcMint,
          symbol: "WBTC",
          priceUsd1e8: 5_000_000_000_000n,
          maxConfidenceBps: 50,
          lastPriceConfidenceBps: 51,
        }),
      ],
    }),
    reserveDomainAddress: reserveDomain,
    settlementMint,
    requestedAmount: 500n,
    assetDecimalsByMint: { [settlementMint]: 0, [wbtcMint]: 0 },
    nowTs,
  });

  assert.equal(model.readiness, "queue_or_refund");
  assert.equal(model.selectedPayoutAsset, null);
  assert.equal(model.otherReserveAssets[0]!.priceFresh, false);
});

test("claim funding readiness reduces fallback vault capacity by pending obligations", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      domainAssetVaults: [vault(settlementMint, 1_000n)],
      reserveAssetRails: [rail({ assetMint: settlementMint, symbol: "USDC" })],
      obligations: [{
        address: pk(),
        reserveDomain,
        assetMint: settlementMint,
        healthPlan,
        policySeries,
        fundingLine,
        obligationId: "pending-claim",
        status: protocol.OBLIGATION_STATUS_RESERVED,
        deliveryMode: protocol.OBLIGATION_DELIVERY_MODE_PAYABLE,
        principalAmount: 600n,
        reservedAmount: 600n,
      }],
    }),
    reserveDomainAddress: reserveDomain,
    healthPlanAddress: healthPlan,
    policySeriesAddress: policySeries,
    fundingLineAddress: fundingLine,
    settlementMint,
    requestedAmount: 500n,
    nowTs,
  });

  assert.equal(model.pendingObligationsAmount, 600n);
  assert.equal(model.reservedOrPayableAmount, 600n);
  assert.equal(model.directSettlementAssetCapacityAmount, 400n);
  assert.equal(model.readiness, "queue_or_refund");
});

test("claim funding readiness reduces fallback vault capacity by queued LP redemptions", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      domainAssetVaults: [vault(settlementMint, 1_000n)],
      reserveAssetRails: [rail({ assetMint: settlementMint, symbol: "USDC" })],
      liquidityPools: [{
        address: pool,
        reserveDomain,
        poolId: "income",
        displayName: "Income",
        depositAssetMint: settlementMint,
        strategyThesis: "test",
        redemptionPolicy: protocol.REDEMPTION_POLICY_QUEUE_ONLY,
        totalValueLocked: 1_000n,
        active: true,
      }],
      capitalClasses: [{
        address: capitalClass,
        liquidityPool: pool,
        classId: "senior",
        displayName: "Senior",
        priority: 0,
        restrictionMode: protocol.CAPITAL_CLASS_RESTRICTION_OPEN,
        totalShares: 1_000n,
        navAssets: 1_000n,
        pendingRedemptions: 300n,
        active: true,
      }],
      lpPositions: [{
        address: pk(),
        owner: pk(),
        capitalClass,
        shares: 1_000n,
        subscriptionBasis: 1_000n,
        pendingRedemptionAssets: 300n,
        queueStatus: protocol.LP_QUEUE_STATUS_PENDING,
      }],
    }),
    reserveDomainAddress: reserveDomain,
    settlementMint,
    requestedAmount: 800n,
    nowTs,
  });

  assert.equal(model.queuedRedemptionsAmount, 300n);
  assert.equal(model.directSettlementAssetCapacityAmount, 700n);
  assert.equal(model.readiness, "queue_or_refund");
});

test("claim approval evidence stays separate from settlement funding readiness", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      claimCases: [{
        address: pk(),
        reserveDomain,
        healthPlan,
        policySeries,
        fundingLine,
        memberPosition: pk(),
        claimant: pk(),
        claimId: "approved-but-unfunded",
        intakeStatus: protocol.CLAIM_INTAKE_APPROVED,
        approvedAmount: 10_000n,
      }],
      domainAssetVaults: [vault(settlementMint, 100n)],
      reserveAssetRails: [rail({ assetMint: settlementMint, symbol: "USDC" })],
    }),
    reserveDomainAddress: reserveDomain,
    healthPlanAddress: healthPlan,
    policySeriesAddress: policySeries,
    fundingLineAddress: fundingLine,
    settlementMint,
    requestedAmount: 1_000n,
    nowTs,
  });

  assert.equal(model.requestedAmount, 1_000n);
  assert.equal(model.immediatelySettleableAmount, 100n);
  assert.notEqual(model.readiness, "settle_now");
});

test("claim funding readiness does not treat allocation cap headroom as reserve capacity", () => {
  const model = protocol.buildClaimFundingReadiness({
    snapshot: emptySnapshot({
      allocationPositions: [{
        address: pk(),
        reserveDomain,
        healthPlan,
        policySeries,
        fundingLine,
        liquidityPool: pool,
        capitalClass,
        capAmount: 1_000n,
        allocatedAmount: 0n,
        reservedCapacity: 0n,
        utilizedAmount: 0n,
        active: true,
      }],
      fundingLines: [{
        address: fundingLine,
        reserveDomain,
        healthPlan,
        policySeries,
        lineId: "line-1",
        assetMint: settlementMint,
        lpPolicyId: "policy",
        maxNotional: 1_000n,
        utilizedNotional: 0n,
        status: protocol.FUNDING_LINE_STATUS_OPEN,
      }],
    }),
    reserveDomainAddress: reserveDomain,
    healthPlanAddress: healthPlan,
    policySeriesAddress: policySeries,
    fundingLineAddress: fundingLine,
    settlementMint,
    requestedAmount: 500n,
    nowTs,
  });

  assert.equal(model.availableLpAllocationCapacityAmount, 0n);
  assert.equal(model.readiness, "queue_or_refund");
});
