// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { SearchableSelect } from "@/components/searchable-select";
import { cn } from "@/lib/cn";
import { buildBusinessContextHref, getBusinessEntryContext } from "@/lib/business-entry-context";
import {
  fetchProtocolReadiness,
  listMemberships,
  listOracles,
  listPoolOracleApprovals,
  listOutcomeAggregates,
  listPools,
  toExplorerAddressLink,
  type MembershipSummary,
  type OracleSummary,
  type OutcomeAggregateSummary,
  type PoolSummary,
  type ProtocolReadiness,
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
  deriveWalletCapabilities,
  parseWorkspaceSection,
  POOL_WORKSPACE_SECTIONS,
  type PoolWorkspaceSection,
} from "@/lib/ui-capabilities";

const SECTION_LABELS: Record<PoolWorkspaceSection, string> = {
  members: "Members",
  claims: "Claims",
  coverage: "Coverage",
  liquidity: "Liquidity",
  oracle: "Oracles",
  settings: "Settings",
};

type PoolWorkspaceShellProps = {
  poolAddress: string;
  sections: Partial<Record<PoolWorkspaceSection, ReactNode>>;
};

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function queuePriorityClass(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "status-error";
  if (priority === "medium") return "status-off";
  return "status-ok";
}

function resolveWorkspaceNetwork(endpoint: string): string {
  const normalized = endpoint.toLowerCase();
  if (normalized.includes("mainnet")) return "Mainnet";
  if (normalized.includes("testnet")) return "Testnet";
  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) return "Localnet";
  return "Devnet";
}

function parseStoredWorkspaceSection(value: string | null): PoolWorkspaceSection | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return (POOL_WORKSPACE_SECTIONS.find((section) => section === normalized) ?? null) as PoolWorkspaceSection | null;
}

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
  const storedSectionKey = useMemo(() => `pool-workspace:last-section:${poolAddress}`, [poolAddress]);

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [poolSummary, setPoolSummary] = useState<PoolSummary | null>(null);
  const [oracles, setOracles] = useState<OracleSummary[]>([]);
  const [activeMemberships, setActiveMemberships] = useState<MembershipSummary[]>([]);
  const [walletMembership, setWalletMembership] = useState<MembershipSummary | null>(null);
  const [walletOracle, setWalletOracle] = useState<OracleSummary | null>(null);
  const [aggregates, setAggregates] = useState<OutcomeAggregateSummary[]>([]);
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

  const capabilities = useMemo(
    () =>
      deriveWalletCapabilities({
        walletAddress,
        pool: poolSummary,
        walletMembership,
        walletOracle,
      }),
    [poolSummary, walletAddress, walletMembership, walletOracle],
  );

  const dashboard = useMemo(
    () =>
      buildPoolDashboardSnapshot({
        readiness,
        activeMemberships,
        finalizedAggregates: aggregates,
        capabilities,
      }),
    [activeMemberships, aggregates, capabilities, readiness],
  );

  const capabilityNote = useMemo(() => {
    if (!capabilities.isConnected) {
      return "Connect wallet to unlock plan actions.";
    }
    if (capabilities.isPoolAuthority) {
      return "Connected wallet controls this plan and can run admin actions.";
    }
    if (capabilities.isRegisteredMember && capabilities.isRegisteredOracle) {
      return "Connected wallet is both an enrolled member and a registered verifier.";
    }
    if (capabilities.isRegisteredMember) {
      return "Connected wallet is enrolled in this plan and can submit claims.";
    }
    if (capabilities.isRegisteredOracle) {
      return "Connected wallet is a registered verifier.";
    }
    return "Connected wallet is in observer mode for this plan. You can still join or switch context.";
  }, [capabilities]);

  const sectionBlockers = useMemo(
    () => ({
      claims: capabilities.canSubmitClaims
        ? null
        : "Claims actions are hidden. Use an enrolled member wallet to submit claims.",
      settings: capabilities.isPoolAuthority
        ? null
        : "Settings actions are hidden. Use the plan authority wallet.",
      oracle: null,
    }),
    [capabilities.canSubmitClaims, capabilities.isPoolAuthority],
  );

  const applySection = useCallback(
    (nextSection: PoolWorkspaceSection) => {
      setActiveSection(nextSection);
      try {
        window.localStorage.setItem(storedSectionKey, nextSection);
      } catch {
        // Ignore storage failures and continue URL-driven navigation.
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("section", nextSection);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, storedSectionKey],
  );

  useEffect(() => {
    const querySectionValue = searchParams.get("section");
    if (querySectionValue) {
      const querySection = parseWorkspaceSection(querySectionValue);
      if (querySection !== activeSection) {
        setActiveSection(querySection);
      }
      try {
        window.localStorage.setItem(storedSectionKey, querySection);
      } catch {
        // Ignore storage failures and continue URL-driven navigation.
      }
      return;
    }

    const storedSection = parseStoredWorkspaceSection(window.localStorage.getItem(storedSectionKey));
    if (!storedSection || storedSection === activeSection) return;
    setActiveSection(storedSection);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", storedSection);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeSection, pathname, router, searchParams, storedSectionKey]);

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [poolsResult, nextOracles, nextMemberships, nextAggregates] = await Promise.all([
        listPools({ connection, search: sectionSearch || null }),
        listOracles({ connection, activeOnly: false }),
        listMemberships({ connection, poolAddress, activeOnly: true }),
        listOutcomeAggregates({ connection, poolAddress, finalizedOnly: true }),
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
      setOracles(nextOracles);
      setActiveMemberships(nextMemberships);
      setAggregates(nextAggregates);
      setPoolSummary(resolvedPool);

      const nextWalletMembership = walletAddress
        ? nextMemberships.find((row) => row.member === walletAddress) ?? null
        : null;
      const nextWalletOracle = walletAddress
        ? nextOracles.find((row) => row.oracle === walletAddress) ?? null
        : null;

      setWalletMembership(nextWalletMembership);
      setWalletOracle(nextWalletOracle);

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
      const shareUrl = `${window.location.origin}/pools/${encodeURIComponent(selectedPoolAddress)}?${params.toString()}`;
      await navigator.clipboard.writeText(shareUrl);
      setTransientHeaderNotice("Section link copied.");
    } catch {
      setTransientHeaderNotice("Copy failed. Clipboard is unavailable.");
    }
  }, [activeSection, searchParams, selectedPoolAddress, setTransientHeaderNotice]);

  const selectedSectionNode = sections[activeSection] ?? (
    <section className="workspace-section-shell">
      <p className="field-help">This section is not configured yet.</p>
    </section>
  );

  const activeSectionBlocker =
    activeSection === "claims"
      ? sectionBlockers.claims
      : activeSection === "settings"
        ? sectionBlockers.settings
        : activeSection === "oracle"
          ? sectionBlockers.oracle
          : null;

  const allowRenderSectionContent = !(
    (activeSection === "claims" && sectionBlockers.claims)
    || (activeSection === "settings" && sectionBlockers.settings)
    || (activeSection === "oracle" && sectionBlockers.oracle)
  );

  return (
    <div className="workspace-root space-y-5">
      <section className="workspace-header-band">
        <div className="workspace-header-copy">
          <p className="workspace-eyebrow">Health Plan Workspace</p>
          <h1 className="workspace-title">
            {poolSummary ? poolSummary.poolId : shortAddress(poolAddress)}
          </h1>
          <p className="workspace-subtitle">{capabilityNote}</p>
        </div>

        <div className="workspace-header-meta">
          <div className="flex flex-wrap gap-2">
            <Link href={backToPoolsHref} className="secondary-button inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to pools
            </Link>
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
          {headerNotice ? <p className="field-help">{headerNotice}</p> : null}
          {businessOracleWarning ? <p className="field-help">{businessOracleWarning}</p> : null}
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
                  { section: activeSection },
                ),
              );
            }}
            searchValue={sectionSearch}
            onSearchChange={setSectionSearch}
            loading={loading}
            placeholder="Select plan"
          />

          <div className="flex flex-wrap gap-2">
            <span className={cn("status-pill", capabilities.isConnected ? "status-ok" : "status-off")}>
              {capabilities.isConnected ? "Wallet connected" : "Wallet disconnected"}
            </span>
            <span className={cn("status-pill", capabilities.isPoolAuthority ? "status-ok" : "status-off")}>
              {capabilities.isPoolAuthority ? "Authority" : "Non-authority"}
            </span>
            <span className={cn("status-pill", capabilities.isRegisteredMember ? "status-ok" : "status-off")}>
              {capabilities.isRegisteredMember ? "Member" : "Not member"}
            </span>
            <span className={cn("status-pill", capabilities.isRegisteredOracle ? "status-ok" : "status-off")}>
              {capabilities.isRegisteredOracle ? "Oracle" : "Not oracle"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="status-pill status-off">Plan {shortAddress(selectedPoolAddress)}</span>
            <span className="status-pill status-off">
              Wallet {walletAddress ? shortAddress(walletAddress) : "not connected"}
            </span>
            <span className="status-pill status-off">Network {networkLabel}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={() => void refreshWorkspace()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh workspace"}
            </button>
            <Link href="/pools/create" className="action-button inline-flex">
              Create new plan
            </Link>
          </div>
          {error ? <p className="field-error">{error}</p> : null}
        </div>
      </section>

      <section className="workspace-kpi-grid">
        <article className="workspace-kpi-card">
          <p className="metric-label">Members active</p>
          <p className="workspace-kpi-value">{dashboard.membersActive}</p>
        </article>
        <article className="workspace-kpi-card">
          <p className="metric-label">Claims pending</p>
          <p className="workspace-kpi-value">{dashboard.claimsPending}</p>
        </article>
        <article className="workspace-kpi-card">
          <p className="metric-label">Readiness checks</p>
          <p className="workspace-kpi-value">
            {dashboard.readinessChecksPassing}/{dashboard.readinessChecksTotal}
          </p>
        </article>
        <article className="workspace-kpi-card">
          <p className="metric-label">TVL</p>
          <p className="workspace-kpi-value">{tvlLabel}</p>
        </article>
        <article className="workspace-kpi-card">
          <p className="metric-label">Est. APY (30d)</p>
          <p className="workspace-kpi-value">{apyLabel}</p>
          {poolMetrics?.apy?.methodologyUri ? (
            <a
              href={poolMetrics.apy.methodologyUri}
              className="field-help underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Methodology
            </a>
          ) : null}
        </article>
      </section>
      {metricsError ? <p className="field-help">{metricsError}</p> : null}

      <section className="workspace-top-grid">
        <article className="workspace-queue-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="step-title">Action Queue</h2>
            {lastUpdatedAt ? <p className="field-help">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</p> : null}
          </div>
          {dashboard.queue.length === 0 ? (
            <p className="field-help">No pending actions.</p>
          ) : (
            <ul className="workspace-queue-list">
              {dashboard.queue.map((item) => (
                <li key={item.id} className="workspace-queue-item">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{item.title}</p>
                    <p className="field-help">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("status-pill", queuePriorityClass(item.priority))}>{item.priority}</span>
                    <button type="button" className="secondary-button py-1.5" onClick={() => applySection(item.section)}>
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="workspace-risk-card">
          <h2 className="step-title">Risk Flags</h2>
          {dashboard.riskFlags.length === 0 ? (
            <p className="field-help">No critical flags detected.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.riskFlags.map((flag) => (
                <li key={flag} className="field-error">
                  {flag}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <div className="workspace-shell-layout">
        <aside className="workspace-rail">
          <nav aria-label="Pool workspace sections" className="workspace-rail-nav">
            {POOL_WORKSPACE_SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => applySection(section)}
                className={cn("workspace-rail-link", activeSection === section && "workspace-rail-link-active")}
                aria-current={activeSection === section ? "page" : undefined}
              >
                {SECTION_LABELS[section]}
              </button>
            ))}
          </nav>
        </aside>

        <div className="workspace-mobile-chips">
          {POOL_WORKSPACE_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => applySection(section)}
              className={cn("segment-button", activeSection === section && "segment-button-active")}
            >
              {SECTION_LABELS[section]}
            </button>
          ))}
        </div>

        <section id={activeSection} className="workspace-section-shell">
          <div className="workspace-section-head">
            <h2 className="step-title">{SECTION_LABELS[activeSection]}</h2>
            {activeSectionBlocker ? <span className="status-pill status-off">Limited</span> : null}
          </div>
          {activeSectionBlocker ? <p className="field-help">{activeSectionBlocker}</p> : null}
          {allowRenderSectionContent ? selectedSectionNode : null}
        </section>
      </div>
    </div>
  );
}
