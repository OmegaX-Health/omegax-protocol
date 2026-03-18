// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import uiCapabilitiesModule from "../frontend/lib/ui-capabilities.ts";

const uiCapabilities = uiCapabilitiesModule as typeof import("../frontend/lib/ui-capabilities.ts");

test("parseWorkspaceSection normalizes compatibility aliases and unknown values", () => {
  assert.equal(uiCapabilities.parseWorkspaceSection("oracle"), "oracles");
  assert.equal(uiCapabilities.parseWorkspaceSection("coverage"), "coverage");
  assert.equal(uiCapabilities.parseWorkspaceSection("  GOVERNANCE "), "governance");
  assert.equal(uiCapabilities.parseWorkspaceSection("missing-section"), "overview");
});

test("parseWorkspacePanel normalizes compatibility subview aliases and defaults by section", () => {
  assert.equal(uiCapabilities.parseWorkspacePanel("coverage", "products"), "series");
  assert.equal(uiCapabilities.parseWorkspacePanel("coverage", "premium"), "payments");
  assert.equal(uiCapabilities.parseWorkspacePanel("coverage", "issue"), "positions");
  assert.equal(uiCapabilities.parseWorkspacePanel("claims", "casework"), "operator");
  assert.equal(uiCapabilities.parseWorkspacePanel("oracles", "unknown"), "policy");
  assert.equal(uiCapabilities.parseWorkspacePanel("liquidity", null), "direct");
});

test("deriveWalletCapabilities produces a multi-role capability matrix for protocol operators", () => {
  const wallet = "wallet-operator";

  const capabilities = uiCapabilities.deriveWalletCapabilities({
    walletAddress: wallet,
    pool: {
      authority: wallet,
    } as never,
    protocolConfig: {
      governanceAuthority: wallet,
      admin: wallet,
    } as never,
    poolControlAuthority: {
      operatorAuthority: wallet,
      riskManagerAuthority: "wallet-risk",
      complianceAuthority: "wallet-compliance",
      guardianAuthority: wallet,
    } as never,
    walletMembership: {
      member: wallet,
      status: 1,
    } as never,
    walletOracle: {
      oracle: wallet,
    } as never,
    walletClaimDelegate: {
      delegate: wallet,
      active: true,
    } as never,
    walletCapitalPosition: {
      capitalPositionActive: true,
      pendingRedemptionRequestCount: 1,
      pendingCoverageClaimCount: 0,
    } as never,
  });

  assert.deepEqual(capabilities.roles, [
    "governance_authority",
    "protocol_admin",
    "pool_authority",
    "pool_operator",
    "guardian",
    "oracle",
    "member",
    "claim_delegate",
    "capital_provider",
  ]);
  assert.equal(capabilities.primaryRole, "governance_authority");
  assert.equal(capabilities.canManageGovernance, true);
  assert.equal(capabilities.canManageOracles, true);
  assert.equal(capabilities.canManageTreasury, true);
  assert.equal(capabilities.canManageLiquidity, true);
  assert.equal(capabilities.canSubmitClaims, true);
  assert.equal(capabilities.canManagePolicySeries, true);
  assert.equal(capabilities.canManagePaymentOptions, true);
  assert.equal(capabilities.canActivateCycles, true);
  assert.equal(capabilities.canAdjudicateCoverageClaims, true);
  assert.equal(capabilities.canRunRedemptionQueue, true);
  assert.equal(capabilities.canManageCapitalClasses, true);
  assert.equal(capabilities.canManageOracleStake, true);
  assert.equal(capabilities.canRegisterOracle, true);
  assert.equal(capabilities.canManageOracleProfile, true);
  assert.equal(capabilities.canSlashOracle, true);
  assert.equal(capabilities.canSubmitOracleVotes, true);
  assert.equal(capabilities.canSettleCycles, true);
  assert.equal(capabilities.canOpenDisputes, true);
  assert.equal(capabilities.canResolveDisputes, true);
  assert.equal(capabilities.canWithdrawPoolTreasury, true);
  assert.equal(capabilities.canWithdrawProtocolFees, true);
  assert.equal(capabilities.canWithdrawOracleFees, true);
  assert.equal(capabilities.canOperateOwnedRedemptionQueue, true);
  assert.equal(capabilities.canOperateQueueAsOperator, true);
  assert.equal(capabilities.canUseExpertTools, true);
});

test("deriveWalletCapabilities falls back to observer mode for disconnected wallets", () => {
  const capabilities = uiCapabilities.deriveWalletCapabilities({
    walletAddress: null,
    pool: null,
    walletMembership: null,
    walletOracle: null,
  });

  assert.deepEqual(capabilities.roles, ["observer"]);
  assert.equal(capabilities.isConnected, false);
  assert.equal(capabilities.canSubmitClaims, false);
  assert.equal(capabilities.canManageGovernance, false);
});

test("buildPoolDashboardSnapshot flags missing controls and queues operational work", () => {
  const observer = uiCapabilities.deriveWalletCapabilities({
    walletAddress: null,
    pool: null,
    walletMembership: null,
    walletOracle: null,
  });

  const snapshot = uiCapabilities.buildPoolDashboardSnapshot({
    readiness: {
      configInitialized: true,
      poolExists: true,
      poolTermsConfigured: false,
      poolAssetVaultConfigured: true,
      oracleRegistered: false,
      oracleProfileExists: false,
      poolOracleApproved: false,
      poolOraclePolicyConfigured: false,
      oracleStakePositionExists: false,
      inviteIssuerRegistered: false,
      memberEnrolled: false,
      claimDelegateConfigured: false,
      schemaRegistered: false,
      ruleRegistered: false,
      coveragePolicyExists: true,
      coveragePolicyNftExists: false,
      premiumLedgerTracked: true,
      derived: {
        configAddress: "config",
        poolAddress: "pool",
        poolTermsAddress: "terms",
        poolAssetVaultAddress: "vault",
        oracleEntryAddress: null,
        oracleProfileAddress: null,
        poolOracleAddress: null,
        poolOraclePolicyAddress: null,
        oracleStakeAddress: null,
        inviteIssuerAddress: null,
        membershipAddress: null,
        claimDelegateAddress: null,
        schemaAddress: null,
        ruleAddress: null,
        coveragePolicyAddress: "coverage",
        coverageNftAddress: null,
        premiumLedgerAddress: "premium",
      },
    },
    protocolConfig: {
      emergencyPaused: true,
    } as never,
    activeMemberships: [],
    finalizedAggregates: [
      {
        passed: true,
        claimed: false,
      },
    ] as never,
    pendingCoverageClaims: [
      {
        requestedAmount: 25n,
      },
    ] as never,
    pendingRedemptions: [
      {
        sharesRequested: 10n,
      },
    ] as never,
    capabilities: observer,
  });

  assert.equal(snapshot.membersActive, 0);
  assert.equal(snapshot.claimsPending, 2);
  assert.equal(snapshot.readinessChecksPassing, 5);
  assert.equal(snapshot.readinessChecksTotal, 7);
  assert.deepEqual(snapshot.queue.map((item) => item.id), [
    "governance-pause",
    "configure-policy",
    "coverage-claims",
    "reward-claims",
    "liquidity-redemptions",
    "no-members",
  ]);
  assert.deepEqual(snapshot.queue.map((item) => item.panel), [
    "protocol",
    "controls",
    "member",
    "member",
    "queue",
    "enrollment",
  ]);
  assert.equal(snapshot.nextAction?.id, "governance-pause");
  assert.deepEqual(snapshot.compactStatus.map((item) => item.label), [
    "Members",
    "Claims",
    "Readiness",
    "Liquidity",
  ]);
  assert.deepEqual(snapshot.riskFlags, [
    "Protocol is emergency paused.",
    "Oracle policy is not configured.",
    "Plan terms are not configured.",
    "Coverage claims are waiting, but this wallet cannot adjudicate them.",
    "Queued redemptions exist, but this wallet cannot operate liquidity controls.",
    "Connect wallet for operational actions.",
  ]);
});

test("visibleWorkspacePanels hides impossible settings and operator panels for observers", () => {
  const observer = uiCapabilities.deriveWalletCapabilities({
    walletAddress: null,
    pool: null,
    walletMembership: null,
    walletOracle: null,
  });

  assert.deepEqual(uiCapabilities.visibleWorkspacePanels("settings", observer), ["readiness"]);
  assert.deepEqual(uiCapabilities.visibleWorkspacePanels("claims", observer), ["member"]);
  assert.equal(uiCapabilities.hasWorkspacePanelAccess("settings", "controls", observer), false);
  assert.equal(uiCapabilities.POOL_WORKSPACE_SECTION_META.overview.group, "primary");
  assert.equal(uiCapabilities.POOL_WORKSPACE_SECTION_META.governance.group, "protocol-tools");
});

test("visibleWorkspacePanels exposes oracle and queue panels only when role-compatible", () => {
  const oracle = uiCapabilities.deriveWalletCapabilities({
    walletAddress: "wallet-oracle",
    pool: null,
    walletMembership: null,
    walletOracle: {
      oracle: "wallet-oracle",
    } as never,
  });

  const poolOperator = uiCapabilities.deriveWalletCapabilities({
    walletAddress: "wallet-operator",
    pool: {
      authority: "wallet-authority",
    } as never,
    poolControlAuthority: {
      operatorAuthority: "wallet-operator",
      riskManagerAuthority: "wallet-risk",
      complianceAuthority: "wallet-compliance",
      guardianAuthority: "wallet-guardian",
    } as never,
    walletMembership: null,
    walletOracle: null,
  });

  assert.deepEqual(uiCapabilities.visibleWorkspacePanels("oracles", oracle), [
    "policy",
    "staking",
    "attestations",
    "settlements",
  ]);
  assert.deepEqual(uiCapabilities.visibleWorkspacePanels("liquidity", poolOperator), [
    "capital",
    "direct",
    "queue",
  ]);
  assert.equal(uiCapabilities.hasWorkspacePanelAccess("oracles", "disputes", oracle), false);
  assert.equal(uiCapabilities.hasWorkspacePanelAccess("liquidity", "queue", poolOperator), true);
});

test("visibleWorkspacePanels default coverage and claims ordering matches the active role", () => {
  const member = uiCapabilities.deriveWalletCapabilities({
    walletAddress: "wallet-member",
    pool: null,
    walletMembership: {
      member: "wallet-member",
      status: 1,
    } as never,
    walletOracle: null,
  });

  const operator = uiCapabilities.deriveWalletCapabilities({
    walletAddress: "wallet-operator",
    pool: {
      authority: "wallet-authority",
    } as never,
    poolControlAuthority: {
      operatorAuthority: "wallet-operator",
      riskManagerAuthority: "wallet-risk",
      complianceAuthority: "wallet-compliance",
      guardianAuthority: "wallet-guardian",
    } as never,
    walletMembership: null,
    walletOracle: null,
  });

  assert.deepEqual(uiCapabilities.visibleWorkspacePanels("coverage", member), [
    "positions",
    "activation",
    "payments",
    "series",
  ]);
  assert.deepEqual(uiCapabilities.visibleWorkspacePanels("claims", operator), [
    "operator",
    "member",
  ]);
});
