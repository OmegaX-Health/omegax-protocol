// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { PoolOverviewPanel } from "@/components/pool-overview-panel";
import { PoolWorkspaceProvider } from "@/components/pool-workspace-context";
import { SearchableSelect } from "@/components/searchable-select";
import { cn } from "@/lib/cn";
import { buildBusinessContextHref, getBusinessEntryContext } from "@/lib/business-entry-context";
import {
  fetchProtocolReadiness,
  listClaimDelegateAuthorizations,
  listCoverageClaims,
  listMemberships,
  listOracles,
  listPoolOracleApprovals,
  listPoolControlAuthorities,
  listPoolRedemptionRequests,
  listProtocolConfig,
  listOutcomeAggregates,
  listPools,
  toExplorerAddressLink,
  type ClaimDelegateAuthorizationSummary,
  type CoverageClaimSummary,
  type MembershipSummary,
  type OracleSummary,
  type OutcomeAggregateSummary,
  type PoolControlAuthoritySummary,
  type PoolRedemptionRequestSummary,
  type PoolSummary,
  type ProtocolConfigSummary,
  type ProtocolReadiness,
  type WalletPoolPositionSummary,
} from "@/lib/protocol";
import {
  formatApyBps,
  formatPoolTvl,
  listPoolDefiMetrics,
  type PoolDefiMetrics,
} from "@/lib/pool-defi-metrics";
import { formatRpcError } from "@/lib/rpc-errors";
import {
  buildPoolDashboardSnapshot,
  defaultWorkspacePanel,
  deriveWalletCapabilities,
  POOL_WORKSPACE_SECTION_META,
  type PoolWorkspacePanel,
  parseWorkspaceSection,
  PRIMARY_WORKSPACE_SECTIONS,
  PROTOCOL_TOOL_WORKSPACE_SECTIONS,
  type PoolWorkspaceSection,
} from "@/lib/ui-capabilities";

type PoolWorkspaceShellProps = {
  poolAddress: string;
  sections: Partial<Record<PoolWorkspaceSection, ReactNode>>;
};

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function resolveWorkspaceNetwork(endpoint: string): string {
  const normalized = endpoint.toLowerCase();
  if (normalized.includes("mainnet")) return "Mainnet";
  if (normalized.includes("testnet")) return "Testnet";
  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) return "Localnet";
  return "Devnet";
}

function parseStoredWorkspaceSection(value: string | null): PoolWorkspaceSection | null {
  const normalized = (value ?? "").trim();
  if (!normalized) return null;
  return parseWorkspaceSection(normalized);
}

function formatRoleLabel(role: string): string {
  return role.replaceAll("_", " ");
}

function resolvePoolStatus(readiness: ProtocolReadiness | null, protocolConfig: ProtocolConfigSummary | null): {
  label: string;
  tone: "status-ok" | "status-off" | "status-error";
} {
  if (protocolConfig?.emergencyPaused) {
    return { label: "Paused", tone: "status-error" };
  }
  if (readiness?.poolExists && readiness.poolTermsConfigured && readiness.poolOraclePolicyConfigured) {
    return { label: "Operational", tone: "status-ok" };
  }
  if (readiness?.poolExists) {
    return { label: "Setup in progress", tone: "status-off" };
  }
  return { label: "Uninitialized", tone: "status-off" };
}

const SECTION_LEADS: Record<PoolWorkspaceSection, string> = {
  overview: "Review plan health, key risks, and the next action for this wallet.",
  members: "Manage enrollment and delegation for people participating in this plan.",
  coverage: "Review coverage tracks, cycle state, and payout setup for this plan.",
  claims: "Track submitted claims and the operator actions that can move them forward.",
  liquidity: "Manage capital setup, direct liquidity flows, and queued redemptions.",
  oracles: "Review oracle approvals, staking, attestations, settlements, and disputes.",
  schemas: "Review schema coverage for this plan and run registry maintenance only when needed.",
  treasury: "Monitor reserve rails, fee balances, and authorized treasury withdrawals.",
  governance: "Review DAO activity and submit governance actions for protocol-level changes.",
  settings: "Update plan controls, delegated authorities, readiness items, and lifecycle actions.",
};

export function PoolWorkspaceShell({ poolAddress, sections }: PoolWorkspaceShellProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const businessEntry = useMemo(() => getBusinessEntryContext(searchParams), [searchParams]);
  const requiredBusinessOracle = businessEntry.requiredOracleResolved;

  const [sectionSearch, setSectionSearch] = useState("");
  const [activeSection, setActiveSection] = useState<PoolWorkspaceSection>(
    parseWorkspaceSection(searchParams.get("section")),
  );
  const [protocolToolsExpanded, setProtocolToolsExpanded] = useState(
    POOL_WORKSPACE_SECTION_META[parseWorkspaceSection(searchParams.get("section"))].group === "protocol-tools",
  );
  const storedSectionKey = useMemo(() => `pool-workspace:last-section:${poolAddress}`, [poolAddress]);

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [poolSummary, setPoolSummary] = useState<PoolSummary | null>(null);
  const [protocolConfig, setProtocolConfig] = useState<ProtocolConfigSummary | null>(null);
  const [oracles, setOracles] = useState<OracleSummary[]>([]);
  const [poolControlAuthority, setPoolControlAuthority] = useState<PoolControlAuthoritySummary | null>(null);
  const [activeMemberships, setActiveMemberships] = useState<MembershipSummary[]>([]);
  const [walletMembership, setWalletMembership] = useState<MembershipSummary | null>(null);
  const [walletOracle, setWalletOracle] = useState<OracleSummary | null>(null);
  const [walletClaimDelegate, setWalletClaimDelegate] = useState<ClaimDelegateAuthorizationSummary | null>(null);
  const [aggregates, setAggregates] = useState<OutcomeAggregateSummary[]>([]);
  const [coverageClaims, setCoverageClaims] = useState<CoverageClaimSummary[]>([]);
  const [redemptionRequests, setRedemptionRequests] = useState<PoolRedemptionRequestSummary[]>([]);
  const [readiness, setReadiness] = useState<ProtocolReadiness | null>(null);
  const [poolMetrics, setPoolMetrics] = useState<PoolDefiMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [headerNotice, setHeaderNotice] = useState<string | null>(null);
  const [businessOracleWarning, setBusinessOracleWarning] = useState<string | null>(null);
  const headerNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const walletAddress = publicKey?.toBase58() ?? null;
  const networkLabel = useMemo(() => resolveWorkspaceNetwork(connection.rpcEndpoint), [connection.rpcEndpoint]);
  const backToPoolsHref = useMemo(
    () => buildBusinessContextHref("/pools", businessEntry),
    [businessEntry],
  );

  const walletCapitalPosition = useMemo<WalletPoolPositionSummary | null>(() => {
    if (!walletAddress) return null;
    const walletCoverageClaims = coverageClaims.filter(
      (row) => row.claimant === walletAddress || row.member === walletAddress,
    );
    const walletRewardClaims = aggregates.filter((row) => row.member === walletAddress && row.passed && !row.claimed);
    const walletRedemptions = redemptionRequests.filter((row) => row.redeemer === walletAddress);
    const pendingCoverageExposureRaw = walletCoverageClaims.reduce((sum, row) => sum + row.requestedAmount, 0n);
    return {
      owner: walletAddress,
      pool: poolSummary?.address ?? poolAddress,
      memberAddress: walletMembership?.member ?? null,
      memberPositionActive: walletMembership?.status === 1,
      capitalPositionActive: walletRedemptions.length > 0,
      transitionalSharePath: true,
      classMode: 0,
      transferMode: 0,
      restricted: false,
      redemptionMode: 0,
      claimMode: 0,
      shareBalanceRaw: 0n,
      capitalExposureRaw: 0n,
      currentlyRedeemableRaw: 0n,
      pendingRedemptionRequestCount: walletRedemptions.length,
      scheduledRedemptionRequestCount: walletRedemptions.filter((row) => row.status === 2).length,
      pendingRedemptionSharesRaw: walletRedemptions.reduce((sum, row) => sum + row.sharesRequested, 0n),
      pendingRedemptionExpectedRaw: walletRedemptions.reduce((sum, row) => sum + row.expectedAmountOut, 0n),
      pendingCoverageClaimCount: walletCoverageClaims.length,
      pendingCoverageExposureRaw,
      pendingRewardClaimCount: walletRewardClaims.length,
      pendingRewardPayoutRaw: 0n,
    };
  }, [aggregates, coverageClaims, poolAddress, poolSummary?.address, redemptionRequests, walletAddress, walletMembership?.member, walletMembership?.status]);

  const capabilities = useMemo(
    () =>
      deriveWalletCapabilities({
        walletAddress,
        pool: poolSummary,
        protocolConfig,
        poolControlAuthority,
        walletMembership,
        walletOracle,
        walletClaimDelegate,
        walletCapitalPosition,
      }),
    [poolControlAuthority, poolSummary, protocolConfig, walletAddress, walletCapitalPosition, walletClaimDelegate, walletMembership, walletOracle],
  );

  const dashboard = useMemo(
    () =>
      buildPoolDashboardSnapshot({
        readiness,
        protocolConfig,
        activeMemberships,
        finalizedAggregates: aggregates,
        pendingCoverageClaims: coverageClaims,
        pendingRedemptions: redemptionRequests,
        capabilities,
      }),
    [activeMemberships, aggregates, capabilities, coverageClaims, protocolConfig, readiness, redemptionRequests],
  );

  const capabilityNote = useMemo(() => {
    if (!capabilities.isConnected) {
      return "Connect a wallet to unlock the participant or operator actions that apply to this plan.";
    }
    if (capabilities.isGovernanceAuthority || capabilities.isProtocolAdmin) {
      return "This wallet can manage governance, emergency controls, and protocol-level treasury actions.";
    }
    if (capabilities.isPoolAuthority) {
      return "This wallet controls the plan and can run pool setup, treasury, and policy actions.";
    }
    if (capabilities.isPoolOperator || capabilities.isRiskManager || capabilities.isComplianceAuthority || capabilities.isGuardian) {
      return "This wallet has delegated operator controls for the plan.";
    }
    if (capabilities.isRegisteredOracle && capabilities.isRegisteredMember) {
      return "This wallet participates as both an oracle and a member in this plan.";
    }
    if (capabilities.isClaimDelegate) {
      return "This wallet can act as a claim delegate for enrolled members.";
    }
    if (capabilities.hasCapitalPosition) {
      return "This wallet has capital-provider context and can monitor redemption exposure.";
    }
    if (capabilities.isRegisteredMember) {
      return "This wallet is enrolled in the plan and can use participant actions.";
    }
    if (capabilities.isRegisteredOracle) {
      return "This wallet is a registered verifier and can use oracle operations.";
    }
    return "This wallet is in observer mode for the plan. Shared state stays visible, while gated actions stay hidden or disabled.";
  }, [capabilities]);

  const sectionBlockers = useMemo(
    () => ({
      overview: null,
      members: capabilities.isConnected ? null : "Connect a wallet to run enrollment or delegation actions.",
      coverage: capabilities.canManageCoverage ? null : "Coverage tools are viewable, but actions require a member, delegate, or operator wallet.",
      claims: capabilities.canSubmitClaims || capabilities.canManageClaims
        ? null
        : "Claims tools are viewable, but actions require a member, delegate, or operator wallet.",
      liquidity: capabilities.canManageLiquidity ? null : "Liquidity state is visible, but actions require a capital-provider or operator wallet.",
      oracles: capabilities.canManageOracles ? null : "Oracle state is visible, but actions require an oracle or operator wallet.",
      schemas: capabilities.canManageSchemas ? null : "Schema state is visible, but governance/operator wallets are required for mutations.",
      treasury: capabilities.canManageTreasury ? null : "Treasury state is visible, but withdrawals require an authorized signer wallet.",
      governance: capabilities.canManageGovernance ? null : "Governance is visible, but protocol mutations require the governance authority wallet.",
      settings: capabilities.canManageSettings ? null : "Settings are visible, but pool mutations require an authority or operator wallet.",
    }),
    [capabilities],
  );

  const applySection = useCallback(
    (nextSection: PoolWorkspaceSection, nextPanel?: PoolWorkspacePanel | null) => {
      setActiveSection(nextSection);
      try {
        window.localStorage.setItem(storedSectionKey, nextSection);
      } catch {
        // Ignore storage failures and continue URL-driven navigation.
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("section", nextSection);
      const resolvedPanel =
        nextPanel === undefined
          ? nextSection === activeSection
            ? searchParams.get("panel")
            : defaultWorkspacePanel(nextSection)
          : nextPanel;
      if (resolvedPanel) {
        params.set("panel", resolvedPanel);
      } else {
        params.delete("panel");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [activeSection, pathname, router, searchParams, storedSectionKey],
  );

  useEffect(() => {
    if (POOL_WORKSPACE_SECTION_META[activeSection].group === "protocol-tools") {
      setProtocolToolsExpanded(true);
    }
  }, [activeSection]);

  useEffect(() => {
    const querySectionValue = searchParams.get("section");
    if (querySectionValue) {
      const querySection = parseWorkspaceSection(querySectionValue);
      const queryPanelValue = searchParams.get("panel");
      if (querySection !== activeSection) {
        setActiveSection(querySection);
      }
      try {
        window.localStorage.setItem(storedSectionKey, querySection);
      } catch {
        // Ignore storage failures and continue URL-driven navigation.
      }
      if (!queryPanelValue) {
        const params = new URLSearchParams(searchParams.toString());
        const fallbackPanel = defaultWorkspacePanel(querySection);
        if (fallbackPanel) {
          params.set("panel", fallbackPanel);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
      }
      return;
    }

    const storedSection = parseStoredWorkspaceSection(window.localStorage.getItem(storedSectionKey));
    if (!storedSection || storedSection === activeSection) return;
    setActiveSection(storedSection);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", storedSection);
    const fallbackPanel = defaultWorkspacePanel(storedSection);
    if (fallbackPanel) {
      params.set("panel", fallbackPanel);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeSection, pathname, router, searchParams, storedSectionKey]);

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        protocolConfigs,
        poolsResult,
        nextOracles,
        nextMemberships,
        nextAggregates,
        nextControlAuthorities,
        nextClaimDelegates,
        nextCoverageClaims,
        nextRedemptionRequests,
      ] = await Promise.all([
        listProtocolConfig({ connection }),
        listPools({ connection, search: sectionSearch || null }),
        listOracles({ connection, activeOnly: false }),
        listMemberships({ connection, poolAddress, activeOnly: true }),
        listOutcomeAggregates({ connection, poolAddress, finalizedOnly: true }),
        listPoolControlAuthorities({ connection, poolAddress }),
        listClaimDelegateAuthorizations({ connection, poolAddress, activeOnly: true }),
        listCoverageClaims({ connection, poolAddress }),
        listPoolRedemptionRequests({ connection, poolAddress }),
      ]);

      let nextPools = poolsResult;
      let resolvedPool = nextPools.find((row) => row.address === poolAddress) ?? null;
      if (!resolvedPool && sectionSearch.trim().length > 0) {
        const fallbackPools = await listPools({ connection, search: null });
        resolvedPool = fallbackPools.find((row) => row.address === poolAddress) ?? null;
        if (resolvedPool) {
          const resolvedPoolAddress = resolvedPool.address;
          if (!nextPools.some((row) => row.address === resolvedPoolAddress)) {
            nextPools = [resolvedPool, ...nextPools];
          }
        }
      }

      setPools(nextPools);
      setProtocolConfig(protocolConfigs[0] ?? null);
      setOracles(nextOracles);
      setActiveMemberships(nextMemberships);
      setAggregates(nextAggregates);
      setPoolControlAuthority(nextControlAuthorities[0] ?? null);
      setCoverageClaims(nextCoverageClaims);
      setRedemptionRequests(nextRedemptionRequests);
      setPoolSummary(resolvedPool);

      const nextWalletMembership = walletAddress
        ? nextMemberships.find((row) => row.member === walletAddress) ?? null
        : null;
      const nextWalletOracle = walletAddress
        ? nextOracles.find((row) => row.oracle === walletAddress) ?? null
        : null;

      setWalletMembership(nextWalletMembership);
      setWalletOracle(nextWalletOracle);
      setWalletClaimDelegate(
        walletAddress
          ? nextClaimDelegates.find((row) => row.delegate === walletAddress && row.active) ?? null
          : null,
      );

      const nextReadiness = await fetchProtocolReadiness({
        connection,
        poolAddress,
        memberAddress: walletAddress,
        oracleAddress: walletAddress,
      });
      setReadiness(nextReadiness);
      setLastUpdatedAt(Date.now());

      if (!businessEntry.isBusinessOrigin) {
        setBusinessOracleWarning(null);
      } else if (!requiredBusinessOracle) {
        setBusinessOracleWarning(
          "Business-origin policy is active, but no valid required oracle is configured for compliance validation.",
        );
      } else {
        try {
          const approvals = await listPoolOracleApprovals({
            connection,
            poolAddress,
            oracleAddress: requiredBusinessOracle,
            activeOnly: true,
          });
          if (approvals.length === 0) {
            setBusinessOracleWarning(
              `Business policy warning: required oracle ${shortAddress(requiredBusinessOracle)} is not approved for this plan. Access remains available.`,
            );
          } else {
            setBusinessOracleWarning(null);
          }
        } catch {
          setBusinessOracleWarning(
            `Business policy warning: unable to verify required oracle ${shortAddress(requiredBusinessOracle)} approval state right now.`,
          );
        }
      }
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to refresh workspace state.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
      if (businessEntry.isBusinessOrigin) {
        setBusinessOracleWarning(
          "Business policy warning: workspace data refresh failed before required oracle compliance could be rechecked.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [businessEntry.isBusinessOrigin, connection, poolAddress, requiredBusinessOracle, sectionSearch, walletAddress]);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!poolSummary) {
      setPoolMetrics(null);
      setMetricsError(null);
      setMetricsLoading(false);
      return;
    }

    let canceled = false;
    setMetricsLoading(true);
    setMetricsError(null);
    void listPoolDefiMetrics({ connection, pools: [poolSummary] })
      .then((byPool) => {
        if (canceled) return;
        setPoolMetrics(byPool[poolSummary.address] ?? null);
      })
      .catch((cause) => {
        if (canceled) return;
        setPoolMetrics(null);
        setMetricsError(
          formatRpcError(cause, {
            fallback: "Failed to load APY/TVL metrics.",
            rpcEndpoint: connection.rpcEndpoint,
          }),
        );
      })
      .finally(() => {
        if (canceled) return;
        setMetricsLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [connection, poolSummary]);

  const selectedPoolAddress = poolSummary?.address ?? poolAddress;
  const tvlLabel = metricsLoading ? "..." : formatPoolTvl(poolMetrics?.tvl ?? null);
  const apyLabel = metricsLoading ? "..." : formatApyBps(poolMetrics?.apy ?? null);
  const poolStatus = useMemo(() => resolvePoolStatus(readiness, protocolConfig), [protocolConfig, readiness]);
  const walletRoleLabel = useMemo(
    () => (capabilities.isConnected ? formatRoleLabel(capabilities.primaryRole) : "observer"),
    [capabilities.isConnected, capabilities.primaryRole],
  );

  const setTransientHeaderNotice = useCallback((message: string) => {
    setHeaderNotice(message);
    if (headerNoticeTimeoutRef.current) {
      clearTimeout(headerNoticeTimeoutRef.current);
    }
    headerNoticeTimeoutRef.current = setTimeout(() => {
      setHeaderNotice(null);
    }, 2200);
  }, []);

  useEffect(
    () => () => {
      if (headerNoticeTimeoutRef.current) {
        clearTimeout(headerNoticeTimeoutRef.current);
      }
    },
    [],
  );

  const onCopyPoolAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedPoolAddress);
      setTransientHeaderNotice("Plan address copied.");
    } catch {
      setTransientHeaderNotice("Copy failed. Clipboard is unavailable.");
    }
  }, [selectedPoolAddress, setTransientHeaderNotice]);

  const onCopySectionLink = useCallback(async () => {
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("section", activeSection);
      const activePanel = searchParams.get("panel");
      if (activePanel) {
        params.set("panel", activePanel);
      }
      const shareUrl = `${window.location.origin}/pools/${encodeURIComponent(selectedPoolAddress)}?${params.toString()}`;
      await navigator.clipboard.writeText(shareUrl);
      setTransientHeaderNotice("Section link copied.");
    } catch {
      setTransientHeaderNotice("Copy failed. Clipboard is unavailable.");
    }
  }, [activeSection, searchParams, selectedPoolAddress, setTransientHeaderNotice]);

  const selectedSectionNode = activeSection === "overview" ? (
    <PoolOverviewPanel
      poolAddress={selectedPoolAddress}
      readiness={readiness}
      protocolConfig={protocolConfig}
      poolControlAuthority={poolControlAuthority}
      walletClaimDelegate={walletClaimDelegate}
      walletCapitalPosition={walletCapitalPosition}
      capabilities={capabilities}
      dashboard={dashboard}
      lastUpdatedAt={lastUpdatedAt}
      onOpenSection={applySection}
    />
  ) : sections[activeSection] ?? (
    <section className="workspace-section-shell">
      <p className="field-help">This section is not configured yet.</p>
    </section>
  );

  const activeSectionBlocker = sectionBlockers[activeSection];

  return (
    <PoolWorkspaceProvider capabilities={capabilities}>
      <div className="workspace-root space-y-5">
        <section className="workspace-header-band">
          <div className="workspace-header-copy">
            <p className="workspace-eyebrow">Health Plan Workspace</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="workspace-title">
                {poolSummary ? poolSummary.poolId : shortAddress(poolAddress)}
              </h1>
              <span className={cn("status-pill", poolStatus.tone)}>{poolStatus.label}</span>
              <span className={cn("status-pill", capabilities.isConnected ? "status-ok" : "status-off")}>
                {walletRoleLabel}
              </span>
            </div>
            <p className="workspace-subtitle">{capabilityNote}</p>

            <div className="flex flex-wrap gap-2">
              {dashboard.compactStatus.map((item) => (
                <span
                  key={item.id}
                  className={cn(
                    "status-pill",
                    item.tone === "ok" ? "status-ok" : item.tone === "warn" ? "status-off" : "status-off",
                  )}
                >
                  {item.label}: {item.value}
                </span>
              ))}
              <span className="status-pill status-off">TVL {tvlLabel}</span>
              <span className="status-pill status-off">APY {apyLabel}</span>
            </div>
          </div>

          <div className="workspace-header-meta">
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-2">
              <p className="metric-label">Next action</p>
              {dashboard.nextAction ? (
                <>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{dashboard.nextAction.title}</p>
                  <p className="field-help">{dashboard.nextAction.detail}</p>
                  <button
                    type="button"
                    className="action-button inline-flex w-fit"
                    onClick={() => {
                      if (!dashboard.nextAction) return;
                      applySection(dashboard.nextAction.section, dashboard.nextAction.panel ?? undefined);
                    }}
                  >
                    Open task
                  </button>
                </>
              ) : (
                <p className="field-help">No urgent follow-up is queued for this wallet right now.</p>
              )}
            </article>

            <div className="flex flex-wrap gap-2">
              <Link href={backToPoolsHref} className="secondary-button inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to pools
              </Link>
              <button type="button" className="secondary-button" onClick={() => void refreshWorkspace()} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh workspace"}
              </button>
              <Link href="/pools/create" className="action-button inline-flex">
                Create new plan
              </Link>
            </div>

            <details className="surface-card-soft">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
                Plan details
              </summary>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <a
                    className="secondary-button inline-flex items-center gap-2"
                    href={toExplorerAddressLink(selectedPoolAddress)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Explorer
                  </a>
                  <button type="button" className="secondary-button" onClick={() => void onCopyPoolAddress()}>
                    Copy address
                  </button>
                  <button type="button" className="secondary-button" onClick={() => void onCopySectionLink()}>
                    Copy section link
                  </button>
                </div>

                <SearchableSelect
                  label="Quick switch plan"
                  value={selectedPoolAddress}
                  options={pools.map((row) => ({
                    value: row.address,
                    label: `${row.poolId} (${shortAddress(row.address)})`,
                    hint: `Org ${row.organizationRef} | Authority ${shortAddress(row.authority)}`,
                  }))}
                  onChange={(value) => {
                    if (!value) return;
                    router.push(
                      buildBusinessContextHref(
                        `/pools/${value}`,
                        businessEntry,
                        {
                          section: activeSection,
                          panel: searchParams.get("panel") ?? undefined,
                        },
                      ),
                    );
                  }}
                  searchValue={sectionSearch}
                  onSearchChange={setSectionSearch}
                  loading={loading}
                  placeholder="Select plan"
                />

                <div className="flex flex-wrap gap-2">
                  <span className="status-pill status-off">Plan {shortAddress(selectedPoolAddress)}</span>
                  <span className="status-pill status-off">
                    Wallet {walletAddress ? shortAddress(walletAddress) : "not connected"}
                  </span>
                  <span className="status-pill status-off">Network {networkLabel}</span>
                </div>

                {headerNotice ? <p className="field-help">{headerNotice}</p> : null}
                {businessOracleWarning ? <p className="field-help">{businessOracleWarning}</p> : null}
                {metricsError ? <p className="field-help">{metricsError}</p> : null}
              </div>
            </details>

            {error ? <p className="field-error">{error}</p> : null}
          </div>
        </section>

      <div className="workspace-shell-layout">
        <aside className="workspace-rail">
          <nav aria-label="Pool workspace sections" className="workspace-rail-nav">
            <div className="space-y-2">
              {PRIMARY_WORKSPACE_SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => applySection(section)}
                  className={cn("workspace-rail-link", activeSection === section && "workspace-rail-link-active")}
                  aria-current={activeSection === section ? "page" : undefined}
                >
                  {POOL_WORKSPACE_SECTION_META[section].label}
                </button>
              ))}
            </div>

            <div className="space-y-2 border-t border-[var(--border)]/35 pt-2">
              <button
                type="button"
                className="secondary-button inline-flex w-full items-center justify-between"
                onClick={() => setProtocolToolsExpanded((current) => !current)}
              >
                <span>Administration</span>
                <span>{protocolToolsExpanded ? "Hide" : "Show"}</span>
              </button>
              {protocolToolsExpanded ? (
                <div className="space-y-2">
                  {PROTOCOL_TOOL_WORKSPACE_SECTIONS.map((section) => (
                    <button
                      key={section}
                      type="button"
                      onClick={() => applySection(section)}
                      className={cn("workspace-rail-link", activeSection === section && "workspace-rail-link-active")}
                      aria-current={activeSection === section ? "page" : undefined}
                    >
                      {POOL_WORKSPACE_SECTION_META[section].label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>
        </aside>

        <div className="workspace-mobile-chips">
          {PRIMARY_WORKSPACE_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => applySection(section)}
              className={cn("segment-button", activeSection === section && "segment-button-active")}
            >
              {POOL_WORKSPACE_SECTION_META[section].label}
            </button>
          ))}
          <button
            type="button"
            className={cn("segment-button", protocolToolsExpanded && "segment-button-active")}
            onClick={() => setProtocolToolsExpanded((current) => !current)}
          >
            Administration
          </button>
          {protocolToolsExpanded
            ? PROTOCOL_TOOL_WORKSPACE_SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => applySection(section)}
                  className={cn("segment-button", activeSection === section && "segment-button-active")}
                >
                  {POOL_WORKSPACE_SECTION_META[section].label}
                </button>
              ))
            : null}
        </div>

        <section id={activeSection} className="workspace-section-shell">
          <div className="workspace-section-head">
            <div className="space-y-1">
              <h2 className="step-title">{POOL_WORKSPACE_SECTION_META[activeSection].label}</h2>
              <p className="text-sm text-[var(--muted-foreground)]">{SECTION_LEADS[activeSection]}</p>
            </div>
            {activeSectionBlocker ? <span className="status-pill status-off">Limited</span> : null}
          </div>
          {activeSectionBlocker ? <p className="field-help">{activeSectionBlocker}</p> : null}
          {selectedSectionNode}
        </section>
      </div>
      </div>
    </PoolWorkspaceProvider>
  );
}
