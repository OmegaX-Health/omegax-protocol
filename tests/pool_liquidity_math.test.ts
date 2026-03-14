// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import protocolModule from "../frontend/lib/protocol.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");

test("computePoolLiquidityDepositSharesOut handles bootstrap and proportional math", () => {
  const bootstrap = protocol.computePoolLiquidityDepositSharesOut({
    amountIn: 1_000_000n,
    sharesSupply: 0n,
    reservesBefore: 0n,
  });
  assert.equal(bootstrap, 1_000_000n);

  const proportional = protocol.computePoolLiquidityDepositSharesOut({
    amountIn: 250n,
    sharesSupply: 1_000n,
    reservesBefore: 2_000n,
  });
  assert.equal(proportional, 125n);

  const blocked = protocol.computePoolLiquidityDepositSharesOut({
    amountIn: 100n,
    sharesSupply: 0n,
    reservesBefore: 10n,
  });
  assert.equal(blocked, 0n);
});

test("computePoolLiquidityRedeemAmountOut returns floored proportional amount", () => {
  const amountOut = protocol.computePoolLiquidityRedeemAmountOut({
    sharesIn: 125n,
    sharesSupply: 1_000n,
    reservesBefore: 2_000n,
  });
  assert.equal(amountOut, 250n);

  const zero = protocol.computePoolLiquidityRedeemAmountOut({
    sharesIn: 0n,
    sharesSupply: 1_000n,
    reservesBefore: 2_000n,
  });
  assert.equal(zero, 0n);
});

test("computePoolEncumberedCapital and free-capital-aware redemption respect liabilities", () => {
  const encumbered = protocol.computePoolEncumberedCapital({
    reservedRefundAmount: 100n,
    reservedRewardAmount: 200n,
    reservedRedistributionAmount: 50n,
    manualCoverageReserveAmount: 150n,
    reservedCoverageClaimAmount: 75n,
    impairedAmount: 25n,
  });
  assert.equal(encumbered, 600n);

  const freeCapital = protocol.computePoolFreeCapital({
    reservesBefore: 2_000n,
    encumberedCapital: encumbered,
  });
  assert.equal(freeCapital, 1_400n);

  const redeemable = protocol.computePoolLiquidityRedeemAmountOut({
    sharesIn: 100n,
    sharesSupply: 1_000n,
    reservesBefore: 2_000n,
    encumberedCapital: encumbered,
  });
  assert.equal(redeemable, 140n);
});

test("capital metrics make the transitional share path explicit and expose reference NAV", () => {
  const metrics = protocol.buildPoolCapitalMetrics({
    capitalClass: null,
    riskConfig: null,
    treasuryReserve: {
      address: "reserve",
      pool: "pool",
      paymentMint: "mint",
      reservedRefundAmount: 100n,
      reservedRewardAmount: 200n,
      reservedRedistributionAmount: 50n,
      manualCoverageReserveAmount: 150n,
      reservedCoverageClaimAmount: 75n,
      paidCoverageClaimAmount: 0n,
      recoveredCoverageClaimAmount: 0n,
      impairedAmount: 25n,
      lastLiabilityUpdateTs: 0n,
      bump: 1,
    },
    reservesRaw: 2_000n,
    shareSupplyRaw: 1_000n,
  });

  assert.equal(metrics.transitionalSharePath, true);
  assert.equal(metrics.classMode, protocol.CAPITAL_CLASS_MODE_NAV);
  assert.equal(metrics.transferMode, protocol.CAPITAL_TRANSFER_MODE_PERMISSIONLESS);
  assert.equal(metrics.freeCapitalRaw, 1_400n);
  assert.equal(metrics.availableRedemptionRaw, 1_400n);
  assert.equal(metrics.referenceNavScaled, 1_400_000_000n);
  assert.equal(metrics.utilizationBps, 3_000);
});

test("capital metrics distinguish distribution semantics and queue-gated redemption", () => {
  const metrics = protocol.buildPoolCapitalMetrics({
    capitalClass: {
      address: "class",
      pool: "pool",
      shareMint: "share-mint",
      payoutMint: "mint",
      classIdHashHex: "11".repeat(32),
      seriesRefHashHex: "22".repeat(32),
      complianceProfileHashHex: "33".repeat(32),
      classMode: protocol.CAPITAL_CLASS_MODE_DISTRIBUTION,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_RESTRICTED,
      restricted: true,
      redemptionQueueEnabled: true,
      ringFenced: true,
      lockupSecs: 86_400n,
      redemptionNoticeSecs: 3_600n,
      vintageIndex: 7,
      issuedAt: 10n,
      updatedAt: 20n,
      bump: 2,
    },
    riskConfig: {
      address: "risk",
      pool: "pool",
      redemptionMode: protocol.POOL_REDEMPTION_MODE_QUEUE_ONLY,
      claimMode: protocol.POOL_CLAIM_MODE_PAUSED,
      impaired: false,
      updatedBy: "updater",
      updatedAt: 30n,
      bump: 3,
    },
    treasuryReserve: {
      address: "reserve",
      pool: "pool",
      paymentMint: "mint",
      reservedRefundAmount: 100n,
      reservedRewardAmount: 200n,
      reservedRedistributionAmount: 50n,
      manualCoverageReserveAmount: 150n,
      reservedCoverageClaimAmount: 75n,
      paidCoverageClaimAmount: 0n,
      recoveredCoverageClaimAmount: 0n,
      impairedAmount: 25n,
      lastLiabilityUpdateTs: 0n,
      bump: 1,
    },
    reservesRaw: 2_000n,
    shareSupplyRaw: 1_000n,
  });

  assert.equal(metrics.transitionalSharePath, false);
  assert.equal(metrics.classMode, protocol.CAPITAL_CLASS_MODE_DISTRIBUTION);
  assert.equal(metrics.transferMode, protocol.CAPITAL_TRANSFER_MODE_RESTRICTED);
  assert.equal(metrics.availableRedemptionRaw, 0n);
  assert.equal(metrics.distributionLockedRaw, 50n);
  assert.equal(metrics.claimMode, protocol.POOL_CLAIM_MODE_PAUSED);
  assert.equal(metrics.restricted, true);
  assert.equal(metrics.ringFenced, true);
});

test("wallet pool position summary separates member rights from capital exposure", () => {
  const capitalMetrics = protocol.buildPoolCapitalMetrics({
    capitalClass: {
      address: "class",
      pool: "pool",
      shareMint: "share-mint",
      payoutMint: "mint",
      classIdHashHex: "11".repeat(32),
      seriesRefHashHex: "22".repeat(32),
      complianceProfileHashHex: "33".repeat(32),
      classMode: protocol.CAPITAL_CLASS_MODE_NAV,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
      restricted: false,
      redemptionQueueEnabled: false,
      ringFenced: false,
      lockupSecs: 0n,
      redemptionNoticeSecs: 0n,
      vintageIndex: 1,
      issuedAt: 10n,
      updatedAt: 20n,
      bump: 2,
    },
    riskConfig: {
      address: "risk",
      pool: "pool",
      redemptionMode: protocol.POOL_REDEMPTION_MODE_OPEN,
      claimMode: protocol.POOL_CLAIM_MODE_OPEN,
      impaired: false,
      updatedBy: "updater",
      updatedAt: 30n,
      bump: 3,
    },
    treasuryReserve: {
      address: "reserve",
      pool: "pool",
      paymentMint: "mint",
      reservedRefundAmount: 100n,
      reservedRewardAmount: 200n,
      reservedRedistributionAmount: 0n,
      manualCoverageReserveAmount: 150n,
      reservedCoverageClaimAmount: 75n,
      paidCoverageClaimAmount: 0n,
      recoveredCoverageClaimAmount: 0n,
      impairedAmount: 25n,
      lastLiabilityUpdateTs: 0n,
      bump: 1,
    },
    reservesRaw: 2_000n,
    shareSupplyRaw: 1_000n,
  });

  const walletPosition = protocol.buildWalletPoolPositionSummary({
    ownerAddress: "wallet",
    membership: {
      address: "membership",
      pool: "pool",
      member: "wallet",
      subjectCommitmentHex: "44".repeat(32),
      status: protocol.MEMBERSHIP_STATUS_ACTIVE,
      enrolledAt: 1n,
      updatedAt: 2n,
      bump: 4,
    },
    capitalMetrics,
    shareBalanceRaw: 250n,
    shareSupplyRaw: 1_000n,
    coverageClaims: [
      {
        address: "coverage-1",
        pool: "pool",
        member: "wallet",
        claimant: "wallet",
        intentHashHex: "55".repeat(32),
        eventHashHex: "66".repeat(32),
        evidenceHashHex: "00".repeat(32),
        interopRefHashHex: "00".repeat(32),
        interopProfileHashHex: "00".repeat(32),
        codeSystemFamilyHashHex: "00".repeat(32),
        decisionReasonHashHex: "00".repeat(32),
        adjudicationRefHashHex: "00".repeat(32),
        status: protocol.COVERAGE_CLAIM_STATUS_APPROVED,
        claimFamily: protocol.COVERAGE_CLAIM_FAMILY_FAST,
        appealCount: 0,
        requestedAmount: 100n,
        approvedAmount: 80n,
        paidAmount: 10n,
        reservedAmount: 70n,
        recoveryAmount: 0n,
        submittedAt: 1n,
        reviewedAt: 2n,
        settledAt: 3n,
        closedAt: 0n,
        bump: 5,
      },
    ],
    rewardClaims: [
      {
        address: "reward-1",
        pool: "pool",
        member: "wallet",
        claimant: "wallet",
        cycleHashHex: "77".repeat(32),
        ruleHashHex: "88".repeat(32),
        intentHashHex: "99".repeat(32),
        payoutMint: "mint",
        payoutAmount: 42n,
        recipient: "wallet",
        submittedAt: 4n,
        bump: 6,
      },
    ],
  });

  assert.equal(walletPosition.memberPositionActive, true);
  assert.equal(walletPosition.capitalPositionActive, true);
  assert.equal(walletPosition.capitalExposureRaw, 362n);
  assert.equal(walletPosition.currentlyRedeemableRaw, 362n);
  assert.equal(walletPosition.pendingCoverageClaimCount, 1);
  assert.equal(walletPosition.pendingCoverageExposureRaw, 70n);
  assert.equal(walletPosition.pendingRewardClaimCount, 1);
  assert.equal(walletPosition.pendingRewardPayoutRaw, 42n);
});

test("capital class integration policy keeps reference NAV authoritative and collateral disabled", () => {
  const directPolicy = protocol.buildCapitalClassIntegrationPolicy({
    capitalMetrics: {
      transitionalSharePath: false,
      pool: "pool",
      shareMint: "share-mint",
      payoutMint: "mint",
      classIdHashHex: "11".repeat(32),
      seriesRefHashHex: "22".repeat(32),
      complianceProfileHashHex: "33".repeat(32),
      classMode: protocol.CAPITAL_CLASS_MODE_NAV,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_PERMISSIONLESS,
      restricted: false,
      redemptionQueueEnabled: false,
      ringFenced: false,
      vintageIndex: 1,
      redemptionMode: protocol.POOL_REDEMPTION_MODE_OPEN,
      claimMode: protocol.POOL_CLAIM_MODE_OPEN,
      impaired: false,
      reservesRaw: 2_000n,
      encumberedCapitalRaw: 600n,
      freeCapitalRaw: 1_400n,
      availableRedemptionRaw: 1_400n,
      distributionLockedRaw: 0n,
      referenceNavScaled: 1_400_000_000n,
      utilizationBps: 3_000,
    },
  });
  assert.equal(directPolicy.marketParticipationMode, "direct");
  assert.equal(directPolicy.directSecondaryTransfersAllowed, true);
  assert.equal(directPolicy.collateralEligible, false);
  assert.equal(directPolicy.marketPriceAuthoritative, false);

  const wrapperPolicy = protocol.buildCapitalClassIntegrationPolicy({
    capitalMetrics: {
      transitionalSharePath: false,
      pool: "pool",
      shareMint: "share-mint",
      payoutMint: "mint",
      classIdHashHex: "11".repeat(32),
      seriesRefHashHex: "22".repeat(32),
      complianceProfileHashHex: "33".repeat(32),
      classMode: protocol.CAPITAL_CLASS_MODE_HYBRID,
      classPriority: 1,
      transferMode: protocol.CAPITAL_TRANSFER_MODE_WRAPPER_ONLY,
      restricted: true,
      redemptionQueueEnabled: true,
      ringFenced: true,
      vintageIndex: 2,
      redemptionMode: protocol.POOL_REDEMPTION_MODE_QUEUE_ONLY,
      claimMode: protocol.POOL_CLAIM_MODE_PAUSED,
      impaired: true,
      reservesRaw: 2_000n,
      encumberedCapitalRaw: 600n,
      freeCapitalRaw: 1_400n,
      availableRedemptionRaw: 0n,
      distributionLockedRaw: 50n,
      referenceNavScaled: 1_400_000_000n,
      utilizationBps: 3_000,
    },
  });
  assert.equal(wrapperPolicy.marketParticipationMode, "wrapper-mediated");
  assert.equal(wrapperPolicy.wrapperRequired, true);
  assert.equal(wrapperPolicy.restrictionSurvivesTransfer, true);
  assert.equal(wrapperPolicy.externalYieldAuthoritative, false);
});

test("computePoolLiquidityMinOut applies slippage tolerance floor", () => {
  assert.equal(protocol.computePoolLiquidityMinOut(1_000n, 50), 995n);
  assert.equal(protocol.computePoolLiquidityMinOut(1_000n, 0), 1_000n);
  assert.equal(protocol.computePoolLiquidityMinOut(1_000n, 10_000), 0n);
});
