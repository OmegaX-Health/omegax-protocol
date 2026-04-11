// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";

import { GovernanceConsole } from "@/components/governance-console";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { GovernanceQueueSkeleton } from "@/components/governance-queue-skeleton";
import { loadGovernanceProposalQueue } from "@/lib/governance-readonly";
import { formatRpcError } from "@/lib/rpc-errors";
import { firstSearchParamValue, type RouteSearchParams, toURLSearchParams } from "@/lib/search-params";
import { useProtocolConsoleSnapshot } from "@/lib/use-protocol-console-snapshot";
import {
  buildAuditTrail,
  buildGovernanceQueue,
  canonicalizeGovernanceWorkbenchParams,
  defaultTabForPersona,
  describeGovernanceQueueStatus,
  GOVERNANCE_TABS,
  GOVERNANCE_TEMPLATE_ROWS,
  governanceStatusVariant,
  resolveGovernanceProposalSelection,
  type GovernanceQueueItem,
  type GovernanceTabId,
} from "@/lib/workbench";
import { shortenAddress, ZERO_PUBKEY } from "@/lib/protocol";
import { cn } from "@/lib/cn";

/* ── Constants ──────────────────────────────────────── */

const TAB_ICONS: Record<GovernanceTabId, string> = {
  overview: "dashboard",
  queue: "list_alt",
  authorities: "shield_person",
  templates: "hub",
};

const TAB_NUMBERS: Record<GovernanceTabId, string> = {
  overview: "01",
  queue: "02",
  authorities: "03",
  templates: "04",
};

/* ── Helpers ────────────────────────────────────────── */

function personaHeroCopy(persona: string): { eyebrow: string; subtitle: string } {
  switch (persona) {
    case "sponsor":
      return {
        eyebrow: "PROTOCOL_CONSOLE // SPONSOR_WORKSPACE",
        subtitle: "Track plan and series controls under governance review before they reach the operational rail.",
      };
    case "capital":
      return {
        eyebrow: "PROTOCOL_CONSOLE // CAPITAL_WORKSPACE",
        subtitle: "Inspect protocol controls and authority posture that shape the capital lanes you're allocated to.",
      };
    case "governance":
      return {
        eyebrow: "PROTOCOL_CONSOLE // GOVERNANCE_WORKSPACE",
        subtitle: "Operate the proposal queue, control authorities, and template surface for the shared protocol shell.",
      };
    default:
      return {
        eyebrow: "PROTOCOL_CONSOLE // OBSERVER_WORKSPACE",
        subtitle: "Live proposals, control authorities, and operational templates exposed by the OmegaX protocol shell.",
      };
  }
}

function StatusBadge({ label }: { label: string }) {
  return <span className={`plans-badge plans-badge-${governanceStatusVariant(label)}`}>{label}</span>;
}

function buildQueueStateCounts(queue: GovernanceQueueItem[]) {
  const counts = new Map<string, number>();
  for (const item of queue) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

function humanizeRole(role: string): string {
  return role
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

type GovernanceAuthorityRole =
  | "protocol_governance"
  | "domain_admin"
  | "plan_admin"
  | "sponsor_operator"
  | "claims_operator"
  | "oracle_authority"
  | "pool_curator"
  | "pool_allocator"
  | "pool_sentinel";

type GovernanceAuthorityLane = {
  key: string;
  role: GovernanceAuthorityRole;
  label: string;
  lane: string;
  address: string;
  actions: string[];
  configured: boolean;
};

const GOVERNANCE_ROLE_ACTIONS: Record<GovernanceAuthorityRole, string[]> = {
  protocol_governance: ["set_protocol_emergency_pause", "governance_execute"],
  domain_admin: ["update_reserve_domain_controls", "rail_posture"],
  plan_admin: ["update_health_plan_controls", "update_policy_series_controls"],
  sponsor_operator: ["create_funding_line", "fund_plan_liabilities"],
  claims_operator: ["adjudicate_claim_case", "settle_claim_case"],
  oracle_authority: ["reserve_obligation", "release_reserve"],
  pool_curator: ["update_liquidity_pool_controls", "update_capital_class_controls"],
  pool_allocator: ["create_allocation_position", "allocate_capital"],
  pool_sentinel: ["queue_only_controls", "capital_pause"],
};

function isConfiguredAuthority(address?: string | null): address is string {
  return Boolean(address && address !== ZERO_PUBKEY);
}

function compareAuthorityLanes(left: GovernanceAuthorityLane, right: GovernanceAuthorityLane): number {
  const byRole = left.role.localeCompare(right.role);
  if (byRole !== 0) return byRole;
  const byLane = left.lane.localeCompare(right.lane);
  if (byLane !== 0) return byLane;
  return left.address.localeCompare(right.address);
}

/* ── Component ──────────────────────────────────────── */

type GovernanceWorkbenchProps = {
  searchParams?: RouteSearchParams;
};

export function GovernanceWorkbench({ searchParams = {} }: GovernanceWorkbenchProps) {
  const { connection } = useConnection();
  const router = useRouter();
  const pathname = usePathname();
  const { effectivePersona } = useWorkspacePersona();
  const { snapshot, loading: protocolLoading, error: protocolError } = useProtocolConsoleSnapshot();
  const [governanceProposalRows, setGovernanceProposalRows] = useState<Parameters<typeof buildGovernanceQueue>[0]>([]);
  const [proposalQueueLoaded, setProposalQueueLoaded] = useState(false);
  const [proposalQueueError, setProposalQueueError] = useState<string | null>(null);
  const queue = useMemo(() => buildGovernanceQueue(governanceProposalRows), [governanceProposalRows]);

  /* ── Selection state ── */

  const requestedTab = firstSearchParamValue(searchParams.tab);
  const activeTab = (GOVERNANCE_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("governance", effectivePersona)) as GovernanceTabId;
  const queryProposal = firstSearchParamValue(searchParams.proposal)?.trim() ?? "";
  const selectedProposal = useMemo(
    () => resolveGovernanceProposalSelection(queue, queryProposal),
    [queue, queryProposal],
  );

  /* ── Derived data ── */

  const auditTrail = useMemo(
    () => buildAuditTrail({ section: "governance", queue, proposal: selectedProposal }),
    [queue, selectedProposal],
  );
  const queueStatus = useMemo(
    () => describeGovernanceQueueStatus({
      count: queue.length,
      failed: Boolean(proposalQueueError),
      failureDetail: proposalQueueError,
      loaded: proposalQueueLoaded,
    }),
    [proposalQueueError, proposalQueueLoaded, queue.length],
  );
  const queueStatusBanner = proposalQueueError && queue.length > 0
    ? `Showing the last loaded governance queue. ${proposalQueueError}`
    : null;
  const authorityWallets = useMemo<GovernanceAuthorityLane[]>(() => {
    const rows: GovernanceAuthorityLane[] = [];

    if (isConfiguredAuthority(snapshot.protocolGovernance?.governanceAuthority)) {
      rows.push({
        key: `protocol_governance:${snapshot.protocolGovernance.governanceAuthority}`,
        role: "protocol_governance",
        label: "Shared protocol timelock",
        lane: "Protocol shell",
        address: snapshot.protocolGovernance.governanceAuthority,
        actions: GOVERNANCE_ROLE_ACTIONS.protocol_governance,
        configured: true,
      });
    }

    for (const domain of snapshot.reserveDomains) {
      if (!isConfiguredAuthority(domain.domainAdmin)) continue;
      rows.push({
        key: `domain_admin:${domain.address}:${domain.domainAdmin}`,
        role: "domain_admin",
        label: domain.displayName || domain.domainId,
        lane: "Reserve domain",
        address: domain.domainAdmin,
        actions: GOVERNANCE_ROLE_ACTIONS.domain_admin,
        configured: true,
      });
    }

    for (const plan of snapshot.healthPlans) {
      if (isConfiguredAuthority(plan.planAdmin)) {
        rows.push({
          key: `plan_admin:${plan.address}:${plan.planAdmin}`,
          role: "plan_admin",
          label: plan.displayName || plan.planId,
          lane: "Health plan",
          address: plan.planAdmin,
          actions: GOVERNANCE_ROLE_ACTIONS.plan_admin,
          configured: true,
        });
      }
      if (isConfiguredAuthority(plan.sponsorOperator)) {
        rows.push({
          key: `sponsor_operator:${plan.address}:${plan.sponsorOperator}`,
          role: "sponsor_operator",
          label: plan.displayName || plan.planId,
          lane: "Sponsor lane",
          address: plan.sponsorOperator,
          actions: GOVERNANCE_ROLE_ACTIONS.sponsor_operator,
          configured: true,
        });
      }
      if (isConfiguredAuthority(plan.claimsOperator)) {
        rows.push({
          key: `claims_operator:${plan.address}:${plan.claimsOperator}`,
          role: "claims_operator",
          label: plan.displayName || plan.planId,
          lane: "Claims lane",
          address: plan.claimsOperator,
          actions: GOVERNANCE_ROLE_ACTIONS.claims_operator,
          configured: true,
        });
      }
      if (isConfiguredAuthority(plan.oracleAuthority)) {
        rows.push({
          key: `oracle_authority:${plan.address}:${plan.oracleAuthority}`,
          role: "oracle_authority",
          label: plan.displayName || plan.planId,
          lane: "Oracle lane",
          address: plan.oracleAuthority,
          actions: GOVERNANCE_ROLE_ACTIONS.oracle_authority,
          configured: true,
        });
      }
    }

    for (const pool of snapshot.liquidityPools) {
      if (isConfiguredAuthority(pool.curator)) {
        rows.push({
          key: `pool_curator:${pool.address}:${pool.curator}`,
          role: "pool_curator",
          label: pool.displayName || pool.poolId,
          lane: "Liquidity pool",
          address: pool.curator,
          actions: GOVERNANCE_ROLE_ACTIONS.pool_curator,
          configured: true,
        });
      }
      if (isConfiguredAuthority(pool.allocator)) {
        rows.push({
          key: `pool_allocator:${pool.address}:${pool.allocator}`,
          role: "pool_allocator",
          label: pool.displayName || pool.poolId,
          lane: "Allocation lane",
          address: pool.allocator,
          actions: GOVERNANCE_ROLE_ACTIONS.pool_allocator,
          configured: true,
        });
      }
      if (isConfiguredAuthority(pool.sentinel)) {
        rows.push({
          key: `pool_sentinel:${pool.address}:${pool.sentinel}`,
          role: "pool_sentinel",
          label: pool.displayName || pool.poolId,
          lane: "Sentinel lane",
          address: pool.sentinel,
          actions: GOVERNANCE_ROLE_ACTIONS.pool_sentinel,
          configured: true,
        });
      }
    }

    return [...rows].sort(compareAuthorityLanes);
  }, [snapshot.healthPlans, snapshot.liquidityPools, snapshot.protocolGovernance, snapshot.reserveDomains]);
  const configuredAuthorityWallets = authorityWallets.filter((wallet) => wallet.configured);
  const reserveDomains = snapshot.reserveDomains;
  const queueStateCounts = useMemo(() => buildQueueStateCounts(queue), [queue]);

  /* ── URL sync ── */

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = toURLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleTabChange = useCallback((tab: string) => {
    const nextTab = tab as GovernanceTabId;
    const nextProposal = selectedProposal?.proposal || queryProposal || null;
    updateParams({
      tab: nextTab,
      proposal: nextProposal,
    });
  }, [queryProposal, selectedProposal, updateParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadProposalQueue() {
      setProposalQueueLoaded(false);
      setProposalQueueError(null);
      try {
        const proposals = await loadGovernanceProposalQueue({ connection });
        if (cancelled) return;
        setGovernanceProposalRows(proposals ?? []);
      } catch (cause) {
        if (cancelled) return;
        setProposalQueueError(formatRpcError(cause, {
          fallback: "Failed to load the governance queue.",
          rpcEndpoint: connection.rpcEndpoint,
        }));
      } finally {
        if (!cancelled) {
          setProposalQueueLoaded(true);
        }
      }
    }

    void loadProposalQueue();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    const nextUpdates = canonicalizeGovernanceWorkbenchParams({
      activeTab,
      loaded: proposalQueueLoaded,
      queryProposal,
      requestedTab,
      selectedProposal,
    });
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, proposalQueueLoaded, queryProposal, requestedTab, selectedProposal, updateParams]);

  /* ── Scroll tab into view ── */

  const tabBarRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const activeButton = bar.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`);
    if (activeButton) activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTab]);

  /* ── Derived display ── */

  const { eyebrow: heroEyebrow, subtitle: heroSubtitle } = personaHeroCopy(effectivePersona);
  const queueLoading = !proposalQueueLoaded;
  const queueFailed = Boolean(proposalQueueError);
  const showQueueSkeleton = queueLoading && queue.length === 0;
  const queueLiveLabel = queueLoading
    ? "Syncing"
    : queueFailed
      ? "RPC failed"
      : queue.length === 0
        ? "Queue clear"
        : "Live";
  const queueIsLive = !queueLoading && !queueFailed;

  /* ── Main render ── */

  return (
    <div className="plans-shell">
      <div className="plans-scroll">

        {/* ── Hero ──────────────────────────── */}
        <header className="plans-hero">
          <div className="plans-hero-glow" aria-hidden="true" />
          <div className="plans-hero-head">
            <div className="plans-hero-copy">
              <span className="plans-hero-eyebrow">{heroEyebrow}</span>
              <h1 className="plans-hero-title">
                Control <em>plane</em>
              </h1>
              <p className="plans-hero-subtitle">{heroSubtitle}</p>
            </div>
          </div>
        </header>

        {protocolLoading || protocolError ? (
          <div className="plans-stack">
            <article className="plans-card liquid-glass">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">LIVE_PROTOCOL_STATE</p>
                  <h2 className="plans-card-title plans-card-title-display">
                    {protocolLoading ? <>Syncing <em>authorities</em></> : <>RPC <em>attention</em></>}
                  </h2>
                </div>
              </div>
              <p className="plans-card-body">
                {protocolLoading
                  ? "Loading live governance authorities, reserve domains, plan controls, and pool control lanes from the configured RPC endpoint."
                  : protocolError}
              </p>
            </article>
          </div>
        ) : null}

        {/* ── Context bar ────────────────────── */}
        <div className="plans-context-bar">
          <div className="plans-context-selectors liquid-glass">
            <label
              className={cn(
                "plans-hero-select",
                (queue.length === 0 || showQueueSkeleton) && "plans-hero-select-disabled",
              )}
            >
              <span className="plans-hero-select-eyebrow">ACTIVE_PROPOSAL</span>
              <div className="plans-hero-select-body">
                <div className="plans-hero-select-copy">
                  <span className="plans-hero-select-label">
                    {showQueueSkeleton ? "Loading proposal queue" : selectedProposal?.title ?? queueStatus.emptyTitle}
                  </span>
                  <span className="plans-hero-select-meta">
                    {showQueueSkeleton
                      ? "Fetching current governance proposals"
                      : selectedProposal
                      ? `${selectedProposal.template} · ${selectedProposal.status}`
                      : queueStatus.emptyMeta}
                  </span>
                </div>
                <span className="material-symbols-outlined plans-hero-select-caret" aria-hidden="true">unfold_more</span>
              </div>
              <select
                className="plans-hero-select-native"
                value={selectedProposal?.proposal ?? ""}
                disabled={queue.length === 0 || showQueueSkeleton}
                onChange={(event) => updateParams({ proposal: event.target.value || null })}
                aria-label="Active proposal"
              >
                {selectedProposal ? null : <option value="">{queueStatus.emptyTitle}</option>}
                {queue.map((proposal) => (
                  <option key={proposal.proposal} value={proposal.proposal}>
                    {proposal.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ── KPI strip ─────────────────────── */}
        <section className="plans-kpi-strip" aria-label="Governance workspace telemetry">
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">PROPOSAL_QUEUE</span>
            <span className="plans-kpi-value" aria-live="polite" aria-label={queueStatus.metricAriaLabel}>
              {showQueueSkeleton ? <span className="governance-queue-skeleton-line governance-queue-skeleton-line-kpi" aria-hidden="true" /> : (
                <>
                  {queueIsLive ? <span className="plans-kpi-pulse" aria-hidden="true" /> : null}
                  {queueStatus.metricValue}
                </>
              )}
            </span>
            <span className="plans-kpi-meta">
              {showQueueSkeleton ? <span className="governance-queue-skeleton-line governance-queue-skeleton-line-kpi-meta" aria-hidden="true" /> : queueLiveLabel}
            </span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">AUTHORITIES</span>
            <span className="plans-kpi-value">{configuredAuthorityWallets.length}</span>
            <span className="plans-kpi-meta">{authorityWallets.length} live lanes</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">TEMPLATES</span>
            <span className="plans-kpi-value">{GOVERNANCE_TEMPLATE_ROWS.length}</span>
            <span className="plans-kpi-meta">scoped controls</span>
          </div>
          <div className="plans-kpi-metric">
            <span className="plans-kpi-label">RESERVE_DOMAINS</span>
            <span className="plans-kpi-value">{reserveDomains.length}</span>
            <span className="plans-kpi-meta">{reserveDomains.filter((domain) => domain.active).length} active</span>
          </div>
        </section>

        {/* ── Tab bar ───────────────────────── */}
        <nav className="plans-tabs liquid-glass" aria-label="Governance workspace sections">
          <div ref={tabBarRef} className="plans-tabs-inner">
            {GOVERNANCE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-tab-id={tab.id}
                  className={cn("plans-tab", isActive && "plans-tab-active")}
                  onClick={() => handleTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="plans-tab-number">{TAB_NUMBERS[tab.id as GovernanceTabId]}</span>
                  <span className="material-symbols-outlined plans-tab-icon">{TAB_ICONS[tab.id as GovernanceTabId]}</span>
                  <span className="plans-tab-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {queueStatusBanner ? (
          <div className="plans-notice liquid-glass" role="status">
            <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">sync_problem</span>
            <p>{queueStatusBanner}</p>
          </div>
        ) : null}

        {/* ── Body ──────────────────────────── */}
        <div className="plans-body">
          <section className="plans-main">

            {/* ── Overview tab ── */}
            {activeTab === "overview" ? (
              <div className="plans-overview-grid">
                <article className="plans-card plans-vitality heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">PROPOSAL_PULSE</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        {showQueueSkeleton ? "Loading proposal pulse" : selectedProposal?.title ?? queueStatus.emptyTitle}
                      </h2>
                    </div>
                    {showQueueSkeleton ? (
                      <span className="plans-card-meta">SYNCING</span>
                    ) : selectedProposal ? (
                      <span className="plans-card-meta">
                        <span className="plans-live-dot" aria-hidden="true" />
                        {selectedProposal.status}
                      </span>
                    ) : (
                      <span className="plans-card-meta">{queueStatus.emptyMeta}</span>
                    )}
                  </div>
                  {showQueueSkeleton ? (
                    <GovernanceQueueSkeleton shape="card" />
                  ) : (
                    <>
                      <p className="plans-card-body">
                        {selectedProposal
                          ? `${selectedProposal.stage}. Authority routes through ${selectedProposal.authority} under the ${selectedProposal.template} template.`
                          : queueStatus.emptyDetail}
                      </p>

                      <div className="plans-vitality-stats">
                        <div className="plans-vitality-stat">
                          <span className="plans-vitality-stat-value">{queueStatus.metricValue}</span>
                          <span className="plans-vitality-stat-label">Live proposals</span>
                        </div>
                        <div className="plans-vitality-stat">
                          <span className="plans-vitality-stat-value">{configuredAuthorityWallets.length}</span>
                          <span className="plans-vitality-stat-label">Authorities</span>
                        </div>
                        <div className="plans-vitality-stat">
                          <span className="plans-vitality-stat-value plans-vitality-stat-value-accent">
                            {GOVERNANCE_TEMPLATE_ROWS.length}
                          </span>
                          <span className="plans-vitality-stat-label">Templates</span>
                        </div>
                      </div>
                    </>
                  )}

                  {!showQueueSkeleton && queueStateCounts.length > 0 ? (
                    <div className="plans-vitality-chart" aria-label="Proposal queue state distribution">
                      <div className="plans-vitality-chart-head">
                        <span className="plans-chart-label">QUEUE_STATE</span>
                        <span className="plans-chart-legend">Status · Share</span>
                      </div>
                      <div className="plans-vitality-bars">
                        {queueStateCounts.map((entry) => {
                          const ratio = queue.length > 0 ? entry.count / queue.length : 0;
                          return (
                            <div key={entry.label} className="plans-vitality-bar">
                              <div className="plans-vitality-bar-head">
                                <span className="plans-vitality-bar-name">{entry.label}</span>
                                <span className="plans-vitality-bar-val">{entry.count}</span>
                              </div>
                              <div className="plans-vitality-bar-track">
                                <div
                                  className="plans-vitality-bar-fill"
                                  style={{ width: `${Math.max(4, ratio * 100)}%` }}
                                />
                              </div>
                              <span className="plans-vitality-bar-claims">
                                {Math.round(ratio * 100)}% of queue
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </article>

                <article className="plans-card plans-pressure heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">EXECUTION_POSTURE</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Timelock<span className="plans-pressure-unit"> · on</span>
                      </h2>
                    </div>
                    <span className="plans-card-meta">SEQUENTIAL</span>
                  </div>
                  <div className="plans-data-grid">
                    <div className="plans-data-row">
                      <span className="plans-data-label">REVIEW</span>
                      <span className="plans-data-value">Timelock active</span>
                    </div>
                    <div className="plans-data-row">
                      <span className="plans-data-label">EXECUTION</span>
                      <span className="plans-data-value">Sequential</span>
                    </div>
                    <div className="plans-data-row">
                      <span className="plans-data-label">AUDIT</span>
                      <span className="plans-data-value">On-chain</span>
                    </div>
                  </div>
                </article>

                <article className="plans-card plans-velocity heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">CONTROL_SCOPE</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        {GOVERNANCE_TEMPLATE_ROWS.length} <em>templates</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">BOUNDED</span>
                  </div>
                  <p className="plans-card-body">
                    Every governance action is bounded by a published template — no untyped instructions reach the protocol.
                  </p>
                  <button
                    type="button"
                    className="plans-inline-action"
                    onClick={() => handleTabChange("templates")}
                  >
                    INSPECT_TEMPLATES
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </button>
                </article>

                <article className="plans-card plans-lanes heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">PROPOSAL_LANES</p>
                      <h2 className="plans-card-title">Live queue</h2>
                    </div>
                    <span className="plans-card-meta">{queue.length} {queue.length === 1 ? "proposal" : "proposals"}</span>
                  </div>
                  {showQueueSkeleton ? (
                    <GovernanceQueueSkeleton shape="list" rows={4} />
                  ) : queue.length > 0 ? (
                    <div className="plans-lane-stack">
                      {queue.map((proposal) => {
                        const isSelected = selectedProposal?.proposal === proposal.proposal;
                        return (
                          <button
                            type="button"
                            key={proposal.proposal}
                            className={cn("plans-lane", isSelected && "plans-lane-active")}
                            onClick={() => updateParams({ proposal: proposal.proposal, tab: "overview" })}
                          >
                            <div className="plans-lane-info">
                              <span className="plans-lane-name">{proposal.title}</span>
                              <span className="plans-lane-key">{proposal.template}</span>
                            </div>
                            <div className="plans-lane-meta">
                              <span className="plans-lane-mode">{proposal.authority}</span>
                              <StatusBadge label={proposal.status} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="plans-card-body">{queueStatus.emptyMessage}</p>
                  )}
                </article>
              </div>
            ) : null}

            {/* ── Queue tab ── */}
            {activeTab === "queue" ? (
              <article className="plans-card heavy-glass">
                <div className="plans-card-head">
                  <div>
                    <p className="plans-card-eyebrow">PROPOSAL_REGISTER</p>
                    <h2 className="plans-card-title plans-card-title-display">
                      {showQueueSkeleton ? <>Loading <em>proposals</em></> : <>{queue.length} live <em>{queue.length === 1 ? "proposal" : "proposals"}</em></>}
                    </h2>
                  </div>
                  <span className="plans-card-meta">
                    <span className="plans-live-dot" aria-hidden="true" />
                    {queueLiveLabel}
                  </span>
                </div>
                {showQueueSkeleton ? (
                  <GovernanceQueueSkeleton shape="table" rows={5} />
                ) : queue.length > 0 ? (
                  <div className="plans-table-wrap">
                    <table className="plans-table">
                      <thead>
                        <tr>
                          <th>Proposal</th>
                          <th>Template</th>
                          <th>Authority</th>
                          <th>Status</th>
                          <th>Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((proposal) => {
                          const isSelected = selectedProposal?.proposal === proposal.proposal;
                          return (
                            <tr key={proposal.proposal} className={cn(isSelected && "plans-table-row-active")}>
                              <td data-label="Proposal">
                                <button
                                  type="button"
                                  className="plans-table-link"
                                  onClick={() => updateParams({ proposal: proposal.proposal })}
                                >
                                  {proposal.title}
                                </button>
                              </td>
                              <td data-label="Template"><span className="plans-table-mono">{proposal.template}</span></td>
                              <td data-label="Authority"><span className="plans-table-mono">{proposal.authority}</span></td>
                              <td data-label="Status"><StatusBadge label={proposal.status} /></td>
                              <td data-label="Open">
                                <Link
                                  href={`/governance/proposals/${encodeURIComponent(proposal.proposal)}`}
                                  className="plans-table-link"
                                >
                                  Detail →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="plans-empty">
                    <strong>{queueStatus.emptyTitle}</strong>
                    <p>{queueStatus.emptyMessage}</p>
                  </div>
                )}
              </article>
            ) : null}

            {/* ── Authorities tab ── */}
            {activeTab === "authorities" ? (
              <article className="plans-card heavy-glass">
                <div className="plans-card-head">
                  <div>
                    <p className="plans-card-eyebrow">AUTHORITY_MATRIX</p>
                    <h2 className="plans-card-title plans-card-title-display">
                      Control <em>wallets</em>
                    </h2>
                  </div>
                  <span className="plans-card-meta">{authorityWallets.length} live lanes</span>
                </div>
                <p className="plans-card-body">
                  Wallets with live on-chain control of the protocol shell. Every authority row below is derived from the currently loaded reserve-domain, health-plan, and liquidity-pool state.
                </p>
                {authorityWallets.length > 0 ? (
                  <div className="plans-settings-grid">
                    {authorityWallets.map((wallet) => (
                      <div key={wallet.key} className="plans-settings-row">
                        <div>
                          <span className="plans-settings-label">{humanizeRole(wallet.role).toUpperCase()}</span>
                          <span className="plans-settings-lane">{wallet.label} · {wallet.lane}</span>
                          {wallet.actions.length > 0 ? (
                            <span className="plans-lane-key">{wallet.actions.join(" · ")}</span>
                          ) : null}
                        </div>
                        <span className="plans-settings-address">
                          {wallet.configured ? shortenAddress(wallet.address, 6) : "Not configured"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="plans-empty">
                    <strong>No live authorities</strong>
                    <p>No control lanes are currently visible from the loaded protocol snapshot.</p>
                  </div>
                )}
              </article>
            ) : null}

            {/* ── Templates tab ── */}
            {activeTab === "templates" ? (
              <div className="plans-stack">
                <GovernanceConsole sectionMode="embedded" />
                <article className="plans-card heavy-glass">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">CONTROL_TEMPLATES</p>
                      <h2 className="plans-card-title plans-card-title-display">
                        Bounded <em>actions</em>
                      </h2>
                    </div>
                    <span className="plans-card-meta">{GOVERNANCE_TEMPLATE_ROWS.length} active</span>
                  </div>
                  <div className="plans-table-wrap">
                    <table className="plans-table">
                      <thead>
                        <tr>
                          <th>Template</th>
                          <th>Authority</th>
                          <th>Blast radius</th>
                          <th>Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {GOVERNANCE_TEMPLATE_ROWS.map((template) => (
                          <tr key={template.id}>
                            <td data-label="Template">{template.label}</td>
                            <td data-label="Authority"><span className="plans-table-mono">{template.authority}</span></td>
                            <td data-label="Blast radius">{template.blastRadius}</td>
                            <td data-label="Open">
                              <Link href={`/governance/descriptions/${template.id}`} className="plans-table-link">
                                Detail →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            ) : null}
          </section>

          {/* ── Rail ───────────────────────── */}
          <aside className="plans-rail">
            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">SELECTED_PROPOSAL</span>
                <span className="plans-rail-subtag">
                  <span className="plans-live-dot" aria-hidden="true" />
                  {showQueueSkeleton ? "SYNCING" : selectedProposal ? selectedProposal.status : queueLiveLabel}
                </span>
              </div>
              {showQueueSkeleton ? (
                <GovernanceQueueSkeleton shape="card" className="governance-queue-skeleton-rail" />
              ) : selectedProposal ? (
                <>
                  <div className="plans-rail-hero">
                    <span className="plans-rail-hero-val">{selectedProposal.title}</span>
                    <span className="plans-rail-hero-sub">{selectedProposal.stage}</span>
                  </div>
                  <div className="plans-rail-row">
                    <span>Authority</span>
                    <strong>{selectedProposal.authority}</strong>
                  </div>
                  <div className="plans-rail-row">
                    <span>Template</span>
                    <strong>{selectedProposal.template}</strong>
                  </div>
                  <Link
                    href={`/governance/proposals/${encodeURIComponent(selectedProposal.proposal)}`}
                    className="plans-inline-action"
                  >
                    OPEN_PROPOSAL
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Link>
                </>
              ) : (
                <p className="plans-rail-hero-sub">{queueStatus.emptyDetail}</p>
              )}
            </section>

            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">AUTHORITY_ALERTS</span>
                <span className="plans-rail-subtag">CONTROL</span>
              </div>
              <div className="plans-rail-row">
                <span>Protocol governance</span>
                <strong>Timelock review</strong>
              </div>
              <div className="plans-rail-row">
                <span>Pool sentinel</span>
                <strong>Queue-only live</strong>
              </div>
              <div className="plans-rail-row">
                <span>Plan admin</span>
                <strong>Series controls</strong>
              </div>
            </section>

            <section className="plans-rail-card heavy-glass">
              <div className="plans-rail-head">
                <span className="plans-rail-tag">FIELD_LOG</span>
                <span className="plans-rail-subtag">LIVE_AUDIT</span>
              </div>
              <div className="plans-rail-trail">
                {auditTrail.map((item) => (
                  <div key={item.id} className={`plans-rail-event plans-rail-event-${item.tone}`}>
                    <span className="plans-rail-event-dot" aria-hidden="true" />
                    <div className="plans-rail-event-copy">
                      <div className="plans-rail-event-row">
                        <strong className="plans-rail-event-label">{item.label}</strong>
                        <time className="plans-rail-event-time">{item.timestamp}</time>
                      </div>
                      <p className="plans-rail-event-detail">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
