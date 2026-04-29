// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  ClaimDelegateAuthorizationSummary,
  CoverageClaimSummary,
  MembershipSummary,
  OracleSummary,
  OutcomeAggregateSummary,
  PoolControlAuthoritySummary,
  PoolRedemptionRequestSummary,
  PoolSummary,
  ProtocolConfigSummary,
  ProtocolReadiness,
  WalletPoolPositionSummary,
} from "@/lib/protocol";

export type PoolWorkspaceSection =
  | "members"
  | "coverage"
  | "claims"
  | "liquidity"
  | "oracles"
  | "schemas"
  | "treasury"
  | "governance"
  | "settings";

export const POOL_WORKSPACE_SECTIONS: ReadonlyArray<PoolWorkspaceSection> = [
  "members",
  "coverage",
  "claims",
  "liquidity",
  "oracles",
  "schemas",
  "treasury",
  "governance",
  "settings",
];

export type WorkspaceSectionGroup = "primary" | "protocol-tools";

export type PoolWorkspacePanel =
  | "enrollment"
  | "delegation"
  | "series"
  | "positions"
  | "payments"
  | "activation"
  | "member"
  | "operator"
  | "capital"
  | "direct"
  | "queue"
  | "policy"
  | "staking"
  | "attestations"
  | "settlements"
  | "disputes"
  | "registry"
  | "vaults"
  | "protocol"
  | "readiness"
  | "controls"
  | "lifecycle";

export type WorkspacePanelPresentation = "wizard" | "list-detail" | "form" | "details-only";

export const WORKSPACE_SECTION_PANELS: Readonly<Record<PoolWorkspaceSection, ReadonlyArray<PoolWorkspacePanel>>> = {
  members: ["enrollment", "delegation"],
  coverage: ["series", "positions", "payments", "activation"],
  claims: ["member", "operator"],
  liquidity: ["capital", "direct", "queue"],
  oracles: ["policy", "staking", "attestations", "settlements", "disputes"],
  schemas: ["registry"],
  treasury: ["vaults"],
  governance: ["protocol"],
  settings: ["readiness", "controls", "lifecycle"],
};

export type WalletRole =
  | "observer"
  | "governance_authority"
  | "protocol_admin"
  | "pool_authority"
  | "pool_operator"
  | "risk_manager"
  | "compliance_authority"
  | "guardian"
  | "oracle"
  | "oracle_admin"
  | "member"
  | "claim_delegate"
  | "capital_provider";

export type WorkspaceSectionMeta = {
  label: string;
  group: WorkspaceSectionGroup;
  defaultPanel: PoolWorkspacePanel | null;
  allowedRoles: WalletRole[];
  showInNav: boolean;
};

export const POOL_WORKSPACE_SECTION_META: Readonly<Record<PoolWorkspaceSection, WorkspaceSectionMeta>> = {
  members: {
    label: "Members",
    group: "protocol-tools",
    defaultPanel: "enrollment",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
      "risk_manager",
      "compliance_authority",
      "guardian",
      "member",
      "claim_delegate",
    ],
    showInNav: true,
  },
  coverage: {
    label: "Coverage",
    group: "primary",
    defaultPanel: "series",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
      "member",
      "claim_delegate",
    ],
    showInNav: true,
  },
  claims: {
    label: "Claims",
    group: "primary",
    defaultPanel: "member",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
      "risk_manager",
      "compliance_authority",
      "guardian",
      "member",
      "claim_delegate",
    ],
    showInNav: true,
  },
  liquidity: {
    label: "Liquidity",
    group: "primary",
    defaultPanel: "direct",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
      "risk_manager",
      "capital_provider",
    ],
    showInNav: true,
  },
  oracles: {
    label: "Oracles",
    group: "protocol-tools",
    defaultPanel: "policy",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
      "oracle",
      "oracle_admin",
    ],
    showInNav: true,
  },
  schemas: {
    label: "Schemas",
    group: "protocol-tools",
    defaultPanel: "registry",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
    ],
    showInNav: true,
  },
  treasury: {
    label: "Treasury",
    group: "protocol-tools",
    defaultPanel: "vaults",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
      "risk_manager",
      "oracle",
      "oracle_admin",
    ],
    showInNav: true,
  },
  governance: {
    label: "Governance",
    group: "protocol-tools",
    defaultPanel: "protocol",
    allowedRoles: ["governance_authority", "protocol_admin"],
    showInNav: true,
  },
  settings: {
    label: "Settings",
    group: "protocol-tools",
    defaultPanel: "readiness",
    allowedRoles: [
      "governance_authority",
      "protocol_admin",
      "pool_authority",
      "pool_operator",
      "risk_manager",
    ],
    showInNav: true,
  },
};

export const PRIMARY_WORKSPACE_SECTIONS: ReadonlyArray<PoolWorkspaceSection> = POOL_WORKSPACE_SECTIONS.filter(
  (section) => POOL_WORKSPACE_SECTION_META[section].group === "primary" && POOL_WORKSPACE_SECTION_META[section].showInNav,
);

export const PROTOCOL_TOOL_WORKSPACE_SECTIONS: ReadonlyArray<PoolWorkspaceSection> = POOL_WORKSPACE_SECTIONS.filter(
  (section) => POOL_WORKSPACE_SECTION_META[section].group === "protocol-tools" && POOL_WORKSPACE_SECTION_META[section].showInNav,
);

export const WORKSPACE_PANEL_META: Readonly<Record<PoolWorkspacePanel, { presentation: WorkspacePanelPresentation }>> = {
  enrollment: { presentation: "form" },
  delegation: { presentation: "form" },
  series: { presentation: "list-detail" },
  positions: { presentation: "list-detail" },
  payments: { presentation: "form" },
  activation: { presentation: "form" },
  member: { presentation: "list-detail" },
  operator: { presentation: "list-detail" },
  capital: { presentation: "form" },
  direct: { presentation: "form" },
  queue: { presentation: "list-detail" },
  policy: { presentation: "list-detail" },
  staking: { presentation: "form" },
  attestations: { presentation: "form" },
  settlements: { presentation: "list-detail" },
  disputes: { presentation: "list-detail" },
  registry: { presentation: "list-detail" },
  vaults: { presentation: "details-only" },
  protocol: { presentation: "details-only" },
  readiness: { presentation: "details-only" },
  controls: { presentation: "form" },
  lifecycle: { presentation: "form" },
};

export type WalletCapabilities = {
  isConnected: boolean;
  roles: WalletRole[];
  primaryRole: WalletRole;
  isGovernanceAuthority: boolean;
  isProtocolAdmin: boolean;
  isPoolAuthority: boolean;
  isPoolOperator: boolean;
  isRiskManager: boolean;
  isComplianceAuthority: boolean;
  isGuardian: boolean;
  isRegisteredMember: boolean;
  isRegisteredOracle: boolean;
  isOracleAdmin: boolean;
  isClaimDelegate: boolean;
  hasCapitalPosition: boolean;
  canCreatePool: boolean;
  canSubmitClaims: boolean;
  canSettleCoverage: boolean;
  canManageOracleStaking: boolean;
  canManageGovernance: boolean;
  canManageSettings: boolean;
  canManageTreasury: boolean;
  canManageSchemas: boolean;
  canManageOracles: boolean;
  canManageLiquidity: boolean;
  canManageClaims: boolean;
  canManageCoverage: boolean;
  canManagePolicySeries: boolean;
  canManagePaymentOptions: boolean;
  canActivateCycles: boolean;
  canReviewCoverageClaims: boolean;
  canAdjudicateCoverageClaims: boolean;
  canRunRedemptionQueue: boolean;
  canManageCapitalClasses: boolean;
  canManageOracleStake: boolean;
  canRegisterOracle: boolean;
  canManageOracleProfile: boolean;
  canSlashOracle: boolean;
  canSubmitOracleVotes: boolean;
  canSettleCycles: boolean;
  canOpenDisputes: boolean;
  canResolveDisputes: boolean;
  canWithdrawPoolTreasury: boolean;
  canWithdrawProtocolFees: boolean;
  canWithdrawOracleFees: boolean;
  canOperateOwnedRedemptionQueue: boolean;
  canOperateQueueAsOperator: boolean;
  canUseExpertTools: boolean;
};

export type PoolActionQueueItem = {
  id: string;
  title: string;
  detail: string;
  section: PoolWorkspaceSection;
  panel?: PoolWorkspacePanel | null;
  priority: "high" | "medium" | "low";
};

export type NextActionSummary = PoolActionQueueItem;

export type CompactStatusSummary = {
  id: string;
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
};

export type PoolDashboardSnapshot = {
  membersActive: number;
  claimsPending: number;
  readinessChecksPassing: number;
  readinessChecksTotal: number;
  riskFlags: string[];
  queue: PoolActionQueueItem[];
  nextAction: NextActionSummary | null;
  compactStatus: CompactStatusSummary[];
  recentActivity: PoolActionQueueItem[];
};

type WalletCapabilityInput = {
  walletAddress: string | null;
  pool: PoolSummary | null;
  protocolConfig?: ProtocolConfigSummary | null;
  poolControlAuthority?: PoolControlAuthoritySummary | null;
  walletMembership: MembershipSummary | null;
  walletOracle: OracleSummary | null;
  walletClaimDelegate?: ClaimDelegateAuthorizationSummary | null;
  walletCapitalPosition?: WalletPoolPositionSummary | null;
};

type DashboardSnapshotInput = {
  readiness: ProtocolReadiness | null;
  protocolConfig?: ProtocolConfigSummary | null;
  activeMemberships: MembershipSummary[];
  finalizedAggregates: OutcomeAggregateSummary[];
  pendingCoverageClaims?: CoverageClaimSummary[];
  pendingRedemptions?: PoolRedemptionRequestSummary[];
  capabilities: WalletCapabilities;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function sameAddress(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return Boolean(normalizedLeft) && Boolean(normalizedRight) && normalizedLeft === normalizedRight;
}

export function parseWorkspaceSection(value: string | null | undefined): PoolWorkspaceSection {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "oracle") {
    return "oracles";
  }
  if (normalized === "overview") {
    return "coverage";
  }
  return (POOL_WORKSPACE_SECTIONS.find((section) => section === normalized) ?? "coverage") as PoolWorkspaceSection;
}

export function defaultWorkspacePanel(section: PoolWorkspaceSection): PoolWorkspacePanel | null {
  return POOL_WORKSPACE_SECTION_META[section].defaultPanel ?? WORKSPACE_SECTION_PANELS[section][0] ?? null;
}

export function parseWorkspacePanel(
  section: PoolWorkspaceSection,
  value: string | null | undefined,
): PoolWorkspacePanel | null {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) {
    return defaultWorkspacePanel(section);
  }
  if (section === "coverage") {
    if (normalized === "products") return "series";
    if (normalized === "premium") return "payments";
    if (normalized === "subscribe" || normalized === "issue") return "positions";
  }
  if (section === "claims" && normalized === "casework") {
    return "operator";
  }
  const validPanels = WORKSPACE_SECTION_PANELS[section];
  return (validPanels.find((panel) => panel === normalized) ?? defaultWorkspacePanel(section)) as PoolWorkspacePanel | null;
}

export function deriveWalletCapabilities(input: WalletCapabilityInput): WalletCapabilities {
  const walletAddress = normalize(input.walletAddress);
  const isConnected = Boolean(walletAddress);
  const isGovernanceAuthority = sameAddress(walletAddress, input.protocolConfig?.governanceAuthority);
  const isProtocolAdmin = sameAddress(walletAddress, input.protocolConfig?.admin);
  const isPoolAuthority = sameAddress(walletAddress, input.pool?.authority);
  const isPoolOperator = sameAddress(walletAddress, input.poolControlAuthority?.operatorAuthority);
  const isRiskManager = sameAddress(walletAddress, input.poolControlAuthority?.riskManagerAuthority);
  const isComplianceAuthority = sameAddress(walletAddress, input.poolControlAuthority?.complianceAuthority);
  const isGuardian = sameAddress(walletAddress, input.poolControlAuthority?.guardianAuthority);
  const isRegisteredMember = Boolean(input.walletMembership);
  const isRegisteredOracle = sameAddress(walletAddress, input.walletOracle?.oracle);
  const isOracleAdmin = sameAddress(walletAddress, input.walletOracle?.admin);
  const isClaimDelegate =
    Boolean(input.walletClaimDelegate?.active)
    && sameAddress(walletAddress, input.walletClaimDelegate?.delegate);
  const walletCapitalPosition = input.walletCapitalPosition;
  const hasCapitalPosition = walletCapitalPosition
    ? (
      walletCapitalPosition.capitalPositionActive
      || walletCapitalPosition.pendingRedemptionRequestCount > 0
      || walletCapitalPosition.pendingCoverageClaimCount > 0
    )
    : false;

  const roles: WalletRole[] = [];
  if (!isConnected) {
    roles.push("observer");
  } else {
    if (isGovernanceAuthority) roles.push("governance_authority");
    if (isProtocolAdmin) roles.push("protocol_admin");
    if (isPoolAuthority) roles.push("pool_authority");
    if (isPoolOperator) roles.push("pool_operator");
    if (isRiskManager) roles.push("risk_manager");
    if (isComplianceAuthority) roles.push("compliance_authority");
    if (isGuardian) roles.push("guardian");
    if (isRegisteredOracle) roles.push("oracle");
    if (isOracleAdmin) roles.push("oracle_admin");
    if (isRegisteredMember) roles.push("member");
    if (isClaimDelegate) roles.push("claim_delegate");
    if (hasCapitalPosition) roles.push("capital_provider");
    if (roles.length === 0) roles.push("observer");
  }

  const canManageProtocolConfig = isGovernanceAuthority || isProtocolAdmin;
  const canManagePoolControls = isPoolAuthority || isPoolOperator;
  const canReviewCoverageClaims =
    isPoolAuthority || isPoolOperator || isRiskManager || isComplianceAuthority || isGuardian;
  const canAdjudicateCoverageClaims = canReviewCoverageClaims;
  const canOperateQueueAsOperator = isPoolAuthority || isPoolOperator || isRiskManager;
  const canOperateOwnedRedemptionQueue = isConnected && (hasCapitalPosition || isPoolAuthority || isPoolOperator);
  const canManageOracleStake = isConnected && (isRegisteredOracle || canManageProtocolConfig);
  const canManageOracleProfile = isRegisteredOracle || isOracleAdmin || canManageProtocolConfig;
  const canOpenDisputes =
    isPoolAuthority || isPoolOperator || isRiskManager || isGuardian || canManageProtocolConfig;

  return {
    isConnected,
    roles,
    primaryRole: roles[0] ?? "observer",
    isGovernanceAuthority,
    isProtocolAdmin,
    isPoolAuthority,
    isPoolOperator,
    isRiskManager,
    isComplianceAuthority,
    isGuardian,
    isRegisteredMember,
    isRegisteredOracle,
    isOracleAdmin,
    isClaimDelegate,
    hasCapitalPosition,
    canCreatePool: isConnected,
    canSubmitClaims: isConnected && (isRegisteredMember || isClaimDelegate),
    canSettleCoverage: isPoolAuthority || isPoolOperator || isRiskManager,
    canManageOracleStaking: canManageOracleStake,
    canManageGovernance: canManageProtocolConfig,
    canManageSettings: canManagePoolControls,
    canManageTreasury: isPoolAuthority || isPoolOperator || isRiskManager || canManageProtocolConfig,
    canManageSchemas: isPoolAuthority || isPoolOperator || canManageProtocolConfig,
    canManageOracles: isPoolAuthority || isPoolOperator || isGovernanceAuthority || isRegisteredOracle || isOracleAdmin,
    canManageLiquidity: isPoolAuthority || isPoolOperator || isRiskManager || hasCapitalPosition,
    canManageClaims: canReviewCoverageClaims,
    canManageCoverage: isPoolAuthority || isPoolOperator || isRegisteredMember || isClaimDelegate,
    canManagePolicySeries: isPoolAuthority || isPoolOperator || isGovernanceAuthority,
    canManagePaymentOptions: isPoolAuthority || isPoolOperator || isGovernanceAuthority,
    canActivateCycles: isPoolAuthority || isPoolOperator || isRegisteredMember || isClaimDelegate,
    canReviewCoverageClaims,
    canAdjudicateCoverageClaims,
    canRunRedemptionQueue: canOperateQueueAsOperator,
    canManageCapitalClasses: isPoolAuthority || isPoolOperator || isRiskManager,
    canManageOracleStake,
    canRegisterOracle: canManageProtocolConfig,
    canManageOracleProfile,
    canSlashOracle: canManageProtocolConfig,
    canSubmitOracleVotes: isRegisteredOracle,
    canSettleCycles: isRegisteredOracle,
    canOpenDisputes,
    canResolveDisputes: canManageProtocolConfig,
    // Phase 1.7 — Per-rail authority for the on-chain withdraw_*_fee_* ix:
    //   protocol_fee  → governance authority (require_governance)
    //   pool_treasury → pool curator OR governance (require_curator_control)
    //   pool_oracle   → registered oracle OR oracle admin OR governance
    //                   (require_oracle_profile_control)
    // Pool treasury was previously gated on isRegisteredOracle by mistake;
    // now matches the on-chain require_curator_control. The UI hint surfaces
    // disabled/enabled state before the chain rejects.
    canWithdrawPoolTreasury: isPoolAuthority || isPoolOperator || canManageProtocolConfig,
    canWithdrawProtocolFees: canManageProtocolConfig,
    canWithdrawOracleFees: isRegisteredOracle || isOracleAdmin || canManageProtocolConfig,
    canOperateOwnedRedemptionQueue,
    canOperateQueueAsOperator,
    canUseExpertTools:
      isGovernanceAuthority
      || isProtocolAdmin
      || isPoolAuthority
      || isPoolOperator
      || isRiskManager
      || isComplianceAuthority
      || isGuardian
      || isRegisteredOracle
      || isOracleAdmin,
  };
}

export function visibleWorkspacePanels(
  section: PoolWorkspaceSection,
  capabilities: WalletCapabilities,
): ReadonlyArray<PoolWorkspacePanel> {
  switch (section) {
    case "coverage":
      if (capabilities.canManagePolicySeries || capabilities.canManagePaymentOptions) {
        return ["series", "positions", "payments", "activation"];
      }
      if (capabilities.isRegisteredMember || capabilities.isClaimDelegate || capabilities.canActivateCycles) {
        return ["positions", "activation", "payments", "series"];
      }
      return ["series", "positions", "payments", "activation"];
    case "claims":
      return capabilities.canReviewCoverageClaims || capabilities.canAdjudicateCoverageClaims
        ? ["operator", "member"]
        : ["member"];
    case "liquidity": {
      const panels: PoolWorkspacePanel[] = [];
      if (capabilities.canManageCapitalClasses) {
        panels.push("capital");
      }
      if (capabilities.canManageLiquidity || capabilities.hasCapitalPosition || capabilities.isConnected) {
        panels.push("direct");
      }
      if (capabilities.canRunRedemptionQueue || capabilities.canOperateOwnedRedemptionQueue) {
        panels.push("queue");
      }
      return panels.length > 0 ? panels : ["direct"];
    }
    case "oracles": {
      const panels: PoolWorkspacePanel[] = ["policy"];
      if (capabilities.canManageOracleStake || capabilities.canManageOracleProfile || capabilities.canSlashOracle) {
        panels.push("staking");
      }
      if (capabilities.canSubmitOracleVotes) {
        panels.push("attestations");
      }
      if (capabilities.canSettleCycles) {
        panels.push("settlements");
      }
      if (capabilities.canOpenDisputes || capabilities.canResolveDisputes) {
        panels.push("disputes");
      }
      return panels;
    }
    case "settings":
      return capabilities.canManageSettings ? ["readiness", "controls", "lifecycle"] : ["readiness"];
    default:
      return WORKSPACE_SECTION_PANELS[section];
  }
}

export function hasWorkspacePanelAccess(
  section: PoolWorkspaceSection,
  panel: PoolWorkspacePanel | null,
  capabilities: WalletCapabilities,
): boolean {
  if (!panel) return true;
  return visibleWorkspacePanels(section, capabilities).includes(panel);
}

export function buildPoolDashboardSnapshot(input: DashboardSnapshotInput): PoolDashboardSnapshot {
  const pendingCoverageClaims = input.pendingCoverageClaims ?? [];
  const pendingRedemptions = input.pendingRedemptions ?? [];
  const membersActive = input.activeMemberships.length;
  const rewardClaimsPending = input.finalizedAggregates.filter((row) => row.passed && !row.claimed).length;
  const claimsPending = rewardClaimsPending + pendingCoverageClaims.length;

  const readinessRows = input.readiness
    ? [
        input.readiness.configInitialized,
        input.readiness.poolExists,
        input.readiness.poolTermsConfigured,
        input.readiness.poolOraclePolicyConfigured,
        input.readiness.poolAssetVaultConfigured,
        input.readiness.coveragePolicyExists,
        input.readiness.premiumLedgerTracked,
      ]
    : [];
  const readinessChecksPassing = readinessRows.filter(Boolean).length;
  const readinessChecksTotal = readinessRows.length;

  const riskFlags: string[] = [];
  if (input.protocolConfig?.emergencyPaused) {
    riskFlags.push("Protocol is emergency paused.");
  }
  if (!input.readiness?.poolOraclePolicyConfigured) {
    riskFlags.push("Oracle policy is not configured.");
  }
  if (!input.readiness?.poolTermsConfigured) {
    riskFlags.push("Plan terms are not configured.");
  }
  if (pendingCoverageClaims.length > 0 && !input.capabilities.canManageClaims) {
    riskFlags.push("Coverage claims are waiting, but this wallet cannot adjudicate them.");
  }
  if (pendingRedemptions.length > 0 && !input.capabilities.canManageLiquidity) {
    riskFlags.push("Queued redemptions exist, but this wallet cannot operate liquidity controls.");
  }
  if (!input.capabilities.isConnected) {
    riskFlags.push("Connect wallet for operational actions.");
  }

  const queue: PoolActionQueueItem[] = [];

  if (input.protocolConfig?.emergencyPaused) {
    queue.push({
      id: "governance-pause",
      title: "Review emergency pause",
      detail: "Protocol-wide pause is active and may block participant actions.",
      section: "governance",
      panel: "protocol",
      priority: "high",
    });
  }

  if (!input.readiness?.poolOraclePolicyConfigured) {
    queue.push({
      id: "configure-policy",
      title: "Configure oracle policy",
      detail: "Plan oracle policy and permissions still need to be finalized.",
      section: "settings",
      panel: "controls",
      priority: "high",
    });
  }

  if (pendingCoverageClaims.length > 0) {
    queue.push({
      id: "coverage-claims",
      title: "Process coverage claims",
      detail: `${pendingCoverageClaims.length} coverage claim records need review or payout actions.`,
      section: "claims",
      panel: input.capabilities.canAdjudicateCoverageClaims ? "operator" : "member",
      priority: "high",
    });
  }

  if (rewardClaimsPending > 0) {
    queue.push({
      id: "reward-claims",
      title: "Finalize reward claims",
      detail: `${rewardClaimsPending} finalized outcome aggregates are still unclaimed.`,
      section: "claims",
      panel: "member",
      priority: "high",
    });
  }

  if (pendingRedemptions.length > 0) {
    queue.push({
      id: "liquidity-redemptions",
      title: "Review queued redemptions",
      detail: `${pendingRedemptions.length} liquidity redemption requests are pending action.`,
      section: "liquidity",
      panel: "queue",
      priority: "medium",
    });
  }

  if (membersActive === 0) {
    queue.push({
      id: "no-members",
      title: "Enroll first member",
      detail: "No active memberships were found for this pool yet.",
      section: "members",
      panel: "enrollment",
      priority: "medium",
    });
  }

  const nextAction: NextActionSummary | null = queue[0] ?? (
    input.capabilities.isConnected
      ? input.capabilities.canManageCoverage
        ? {
            id: "coverage-review",
            title: "Review coverage setup",
            detail: "Check products, positions, and premium rails before opening more participant actions.",
            section: "coverage",
            panel: input.capabilities.canManagePolicySeries ? "series" : "positions",
            priority: "low",
          }
        : {
            id: "coverage-observer-review",
            title: "Review coverage state",
            detail: "Use the plan workspace to inspect current coverage positions and available actions for this wallet.",
            section: "coverage",
            panel: "positions",
            priority: "low",
          }
      : {
          id: "connect-wallet",
          title: "Connect a wallet",
          detail: "Connecting a wallet reveals the participant or operator actions that are valid for this plan.",
          section: "coverage",
          panel: "positions",
          priority: "low",
        }
  );

  const compactStatus: CompactStatusSummary[] = [
    {
      id: "members",
      label: "Members",
      value: membersActive > 0 ? `${membersActive} active` : "No active members",
      tone: membersActive > 0 ? "ok" : "neutral",
    },
    {
      id: "claims",
      label: "Claims",
      value: claimsPending > 0 ? `${claimsPending} pending` : "No pending claims",
      tone: claimsPending > 0 ? "warn" : "ok",
    },
    {
      id: "readiness",
      label: "Readiness",
      value: readinessChecksTotal > 0 ? `${readinessChecksPassing}/${readinessChecksTotal} checks` : "No checks yet",
      tone:
        readinessChecksTotal === 0
          ? "neutral"
          : readinessChecksPassing === readinessChecksTotal
            ? "ok"
            : "warn",
    },
    {
      id: "liquidity",
      label: "Liquidity",
      value: pendingRedemptions.length > 0 ? `${pendingRedemptions.length} queued` : "Queue clear",
      tone: pendingRedemptions.length > 0 ? "warn" : "ok",
    },
  ];

  return {
    membersActive,
    claimsPending,
    readinessChecksPassing,
    readinessChecksTotal,
    riskFlags,
    queue,
    nextAction,
    compactStatus,
    recentActivity: queue.slice(0, 4),
  };
}
