// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";

import { formatAmount } from "@/lib/canonical-ui";
import { loadGovernanceProposalQueue } from "@/lib/governance-readonly";
import { buildOverviewStats, overviewStatsModeFromDemoFlag, resolveOverviewStatsSource } from "@/lib/overview-metrics";
import { formatRpcError } from "@/lib/rpc-errors";
import {
  buildAuditTrail,
  buildGovernanceQueue,
  describeGovernanceQueueStatus,
} from "@/lib/workbench";
import { useProtocolConsoleSnapshot } from "@/lib/use-protocol-console-snapshot";
import { useWorkspacePersona } from "@/components/workspace-persona";

function formatCompact(value: bigint): string {
  const num = Number(value);
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function SignalWave() {
  return (
    <svg className="ov-wave-svg" viewBox="0 0 1000 120" aria-hidden="true" preserveAspectRatio="none">
      <path
        className="ov-wave-path ov-wave-path-primary"
        d="M0,60 Q125,100 250,60 T500,60 T750,60 T1000,60"
      >
        <animate
          attributeName="d"
          dur="10s"
          repeatCount="indefinite"
          values={[
            "M0,60 Q125,100 250,60 T500,60 T750,60 T1000,60",
            "M0,60 Q125,18 250,60 T500,60 T750,60 T1000,60",
            "M0,60 Q125,100 250,60 T500,60 T750,60 T1000,60",
          ].join(";")}
        />
      </path>
      <path
        className="ov-wave-path ov-wave-path-secondary"
        d="M0,66 Q150,20 300,66 T600,66 T1000,66"
      >
        <animate
          attributeName="d"
          dur="13s"
          repeatCount="indefinite"
          values={[
            "M0,66 Q150,20 300,66 T600,66 T1000,66",
            "M0,66 Q150,100 300,66 T600,66 T1000,66",
            "M0,66 Q150,20 300,66 T600,66 T1000,66",
          ].join(";")}
        />
      </path>
    </svg>
  );
}

/** Humanize raw status enum labels */
function cleanLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOr\b/g, "/")
    .replace("Claimable / Payable", "Claimable");
}

type OverviewCardMetric = {
  label: string;
  value: string;
};

type OverviewCardDetail = {
  label: string;
  value: string;
};

function OverviewFieldLogCard(props: {
  items: ReturnType<typeof buildAuditTrail>;
  mode: "live" | "demo";
}) {
  return (
    <section className="ov-log-card liquid-glass" aria-label={props.mode === "demo" ? "Field log demo audit" : "Field log live audit"}>
      <div className="ov-log-card-head">
        <span className="ov-panel-tag">FIELD_LOG</span>
        <span className="ov-panel-subtag">{props.mode === "demo" ? "DEMO_AUDIT" : "LIVE_AUDIT"}</span>
      </div>

      <div className="ov-audit-list" role="list" aria-label="Field log events">
        {props.items.map((item) => (
          <article key={item.id} className="ov-audit-item" role="listitem">
            <span className={`ov-audit-dot ov-audit-dot-${item.tone}`} aria-hidden="true" />
            <div className="ov-audit-copy">
              <div className="ov-audit-row">
                <strong className="ov-audit-title">{item.label}</strong>
                <span className="ov-audit-time">{item.timestamp}</span>
              </div>
              <p className="ov-audit-detail">{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OverviewEntryCard(props: {
  align: "start" | "end";
  entry: string;
  href: string;
  status: string;
  title: string;
  summary: string;
  highlightLabel: string;
  highlightValue: string;
  metrics: OverviewCardMetric[];
  details: OverviewCardDetail[];
  note: string;
}) {
  const wrapClassName = props.align === "end" ? "ov-entry-wrap ov-entry-wrap-end" : "ov-entry-wrap ov-entry-wrap-start";

  return (
    <div className={wrapClassName}>
      <Link href={props.href} className="ov-entry heavy-glass">
        <div className="ov-entry-bracket ov-entry-bracket-tl" aria-hidden="true" />
        <div className="ov-entry-bracket ov-entry-bracket-br" aria-hidden="true" />

        <div className="ov-entry-head">
          <span className="ov-entry-tag">{props.entry}</span>
          <span className="ov-entry-status">{props.status}</span>
        </div>

        <h2 className="ov-entry-title">{props.title}</h2>
        <p className="ov-entry-summary">{props.summary}</p>

        <div className="ov-entry-preview" aria-hidden="true">
          <span className="ov-entry-preview-label">Inspect surface</span>
          <span className="material-symbols-outlined ov-entry-preview-icon">south</span>
        </div>

        <div className="ov-entry-reveal">
          <div className="ov-entry-reveal-inner">
            <div className="ov-entry-reveal-top">
              <div className="ov-entry-highlight">
                <span className="ov-entry-highlight-value">{props.highlightValue}</span>
                <span className="ov-entry-highlight-label">{props.highlightLabel}</span>
              </div>

              <div className="ov-entry-metrics" role="list" aria-label={`${props.title} metrics`}>
                {props.metrics.map((metric) => (
                  <div key={metric.label} className="ov-entry-metric" role="listitem">
                    <span className="ov-entry-metric-value">{metric.value}</span>
                    <span className="ov-entry-metric-label">{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ov-entry-details" role="list" aria-label={`${props.title} details`}>
              {props.details.map((detail) => (
                <div key={`${detail.label}-${detail.value}`} className="ov-entry-detail" role="listitem">
                  <span className="ov-entry-detail-label">{detail.label}</span>
                  <span className="ov-entry-detail-value">{detail.value}</span>
                </div>
              ))}
            </div>

            <div className="ov-entry-footer">
              <span className="ov-entry-note">{props.note}</span>
              <span className="ov-entry-link">
                Access surface
                <span className="material-symbols-outlined ov-entry-link-icon" aria-hidden="true">north_east</span>
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ── Main component ─────────────────────────────────── */

type OverviewWorkbenchProps = {
  demo?: boolean;
};

export function OverviewWorkbench({ demo = false }: OverviewWorkbenchProps) {
  const { connection } = useConnection();
  const { effectivePersona } = useWorkspacePersona();
  const { snapshot, loading, error } = useProtocolConsoleSnapshot();
  const statsMode = overviewStatsModeFromDemoFlag(demo);
  const statsSource = useMemo(() => resolveOverviewStatsSource({ demo, snapshot }), [demo, snapshot]);
  const stats = useMemo(() => buildOverviewStats(statsSource), [statsSource]);

  const [governanceProposalRows, setGovernanceProposalRows] = useState<Parameters<typeof buildGovernanceQueue>[0]>([]);
  const [governanceQueueLoaded, setGovernanceQueueLoaded] = useState(false);
  const [governanceQueueError, setGovernanceQueueError] = useState<string | null>(null);
  const governanceQueue = useMemo(() => buildGovernanceQueue(governanceProposalRows), [governanceProposalRows]);
  const governanceQueueStatus = useMemo(
    () => describeGovernanceQueueStatus({
      count: governanceQueue.length,
      failed: Boolean(governanceQueueError),
      failureDetail: governanceQueueError,
      loaded: governanceQueueLoaded,
    }),
    [governanceQueue.length, governanceQueueError, governanceQueueLoaded],
  );
  const auditTrail = useMemo(
    () => buildAuditTrail({
      section: "overview",
      persona: effectivePersona,
      queue: governanceQueue,
      source: statsSource,
      demo,
    }),
    [demo, effectivePersona, governanceQueue, statsSource],
  );
  const overviewCards = useMemo(() => {
    const topClasses = [...stats.classBreakdown]
      .sort((left, right) => Number(right.nav - left.nav))
      .slice(0, 2)
      .map((item) => ({
        label: item.name,
        value: `${formatCompact(item.nav)} NAV`,
      }));
    const topPlans = stats.plans.slice(0, 2).map((plan) => ({
      label: plan.name,
      value: plan.sponsor,
    }));
    const governanceDetails = governanceQueue.length > 0
      ? governanceQueue.slice(0, 2).map((item) => ({
        label: item.status,
        value: item.title,
      }))
      : [{
        label: governanceQueueStatus.emptyTitle,
        value: governanceQueueError ?? governanceQueueStatus.emptyMeta,
      }];
    const obligationDetails = Object.entries(stats.obligationStatuses)
      .filter(([, value]) => value > 0)
      .slice(0, 2)
      .map(([label, value]) => ({
        label: cleanLabel(label),
        value: `${value} lane${value === 1 ? "" : "s"}`,
      }));

    return [
      {
        align: "start" as const,
        entry: "ENTRY_01",
        href: "/plans",
        status: `${stats.planCount} plans`,
        title: "Plans",
        summary: "Coverage series, member exposure, and sponsor operations across the public OmegaX protocol surface.",
        highlightLabel: "Claim-active coverage lanes",
        highlightValue: String(stats.activeClaimCount),
        metrics: [
          { label: "Plans", value: String(stats.planCount) },
          { label: "Series", value: String(stats.seriesCount) },
          { label: "Members", value: String(stats.memberCount) },
        ],
        details: topPlans,
        note: "Sponsor and member coverage telemetry",
      },
      {
        align: "end" as const,
        entry: "ENTRY_02",
        href: "/capital",
        status: `${stats.poolCount} pools`,
        title: "Capital",
        summary: "Liquidity routing, class depth, and redemption pressure across the reserve-backed treasury rail.",
        highlightLabel: "Aggregate value locked",
        highlightValue: formatCompact(stats.tvl),
        metrics: [
          { label: "Utilization", value: `${stats.utilization}%` },
          { label: "Classes", value: String(stats.classCount) },
          { label: "Pending", value: formatCompact(stats.pendingRedemptions) },
        ],
        details: topClasses,
        note: "Pool capital, queue, and class allocation routing",
      },
      {
        align: "start" as const,
        entry: "ENTRY_03",
        href: "/governance",
        status: governanceQueueError ? "degraded" : governanceQueueLoaded ? "live" : "syncing",
        title: "Governance",
        summary: "Proposal movement, reserve domains, and operational approvals for the shared protocol control plane.",
        highlightLabel: "Proposal queue",
        highlightValue: governanceQueueStatus.metricValue,
        metrics: [
          { label: "Domains", value: String(stats.domainCount) },
          { label: "Loaded", value: governanceQueueLoaded ? "YES" : "WAIT" },
          { label: "Reserve", value: String(stats.reservedObligationCount) },
        ],
        details: governanceDetails,
        note: governanceQueueError ? governanceQueueError : "Proposal execution and queue visibility",
      },
      {
        align: "end" as const,
        entry: "ENTRY_04",
        href: "/oracles",
        status: `${stats.oracleCount} operators`,
        title: "Oracles",
        summary: "Operator coverage, reserve obligations, and public proof telemetry across the protocol attestation mesh.",
        highlightLabel: "Protected principal",
        highlightValue: formatCompact(stats.totalObligationPrincipal),
        metrics: [
          { label: "Operators", value: String(stats.oracleCount) },
          { label: "Obligations", value: String(stats.obligationCount) },
          { label: "Approved", value: formatCompact(stats.totalApprovedAmount) },
        ],
        details: obligationDetails,
        note: "Attestation operators and reserve-obligation integrity",
      },
    ];
  }, [
    governanceQueue,
    governanceQueueError,
    governanceQueueLoaded,
    governanceQueueStatus.emptyMeta,
    governanceQueueStatus.emptyTitle,
    governanceQueueStatus.metricValue,
    stats.activeClaimCount,
    stats.classBreakdown,
    stats.classCount,
    stats.domainCount,
    stats.memberCount,
    stats.obligationCount,
    stats.obligationStatuses,
    stats.oracleCount,
    stats.pendingRedemptions,
    stats.planCount,
    stats.plans,
    stats.poolCount,
    stats.reservedObligationCount,
    stats.seriesCount,
    stats.totalApprovedAmount,
    stats.totalObligationPrincipal,
    stats.tvl,
    stats.utilization,
  ]);
  const signalMetrics = useMemo(() => [
    { label: "Utilization", value: `${stats.utilization}%` },
    { label: "Capacity", value: formatCompact(stats.available) },
    { label: "Queue", value: governanceQueueStatus.metricValue },
    { label: "Reserves", value: String(stats.reservedObligationCount) },
  ], [
    stats.available,
    governanceQueueStatus.metricValue,
    stats.reservedObligationCount,
    stats.utilization,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadProposalQueue() {
      setGovernanceQueueLoaded(false);
      setGovernanceQueueError(null);
      try {
        const proposals = await loadGovernanceProposalQueue({ connection });
        if (cancelled) return;
        setGovernanceProposalRows(proposals ?? []);
      } catch (cause) {
        if (cancelled) return;
        setGovernanceQueueError(formatRpcError(cause, {
          fallback: "Failed to load the governance queue.",
          rpcEndpoint: connection.rpcEndpoint,
        }));
      } finally {
        if (!cancelled) setGovernanceQueueLoaded(true);
      }
    }
    void loadProposalQueue();
    return () => { cancelled = true; };
  }, [connection]);

  return (
    <div className="ov">
      <div className="ov-layout">
        <aside className="ov-hero-column">
          <div className="ov-hero-stack">
            <section className="ov-hero">
              <div className="ov-hero-glow" aria-hidden="true" />
              <span className="ov-eyebrow">Overview</span>
              <h1 className="ov-hero-title">Health Capital Markets</h1>

              <div className="ov-wave-panel">
                <div className="ov-wave-scan" aria-hidden="true" />
                <SignalWave />
              </div>

              <div className="ov-total-stack">
                <span className="ov-total-value">${formatAmount(stats.tvl)}</span>
                <span className="ov-total-label">
                  {statsMode === "demo"
                    ? "Demo fixture value locked"
                    : loading
                      ? "Syncing live network value locked"
                      : error
                        ? "Live RPC unavailable; no fixture fallback"
                        : "Live network value locked"}
                </span>
              </div>

              <div className="ov-signal-grid" role="list" aria-label="Overview system metrics">
                {signalMetrics.map((metric) => (
                  <div key={metric.label} className="ov-signal-card" role="listitem">
                    <span className="ov-signal-value" aria-live={metric.label === "Queue" ? "polite" : undefined}>
                      {metric.value}
                    </span>
                    <span className="ov-signal-label">{metric.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <section className="ov-stream" aria-label="Overview surfaces and field log">
          {statsMode === "demo" || loading || error ? (
            <div className="plans-notice liquid-glass" role="status">
              <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">
                {statsMode === "demo" ? "science" : error ? "warning" : "sync"}
              </span>
              <p>
                {statsMode === "demo"
                  ? "Demo mode is explicit. These overview metrics come from checked-in devnet fixtures because ?demo=1 is set."
                  : error
                    ? error
                    : "Live protocol metrics are loading from the configured RPC endpoint."}
              </p>
            </div>
          ) : null}

          <div className="ov-stream-group">
            <span className="ov-stream-label">ACCESS_SURFACES</span>
            <div className="ov-stream-stack">
              {overviewCards.map((card) => (
                <OverviewEntryCard key={card.href} {...card} />
              ))}
            </div>
          </div>

          <div className="ov-stream-group">
            <span className="ov-stream-label">FIELD_LOG</span>
            <OverviewFieldLogCard items={auditTrail} mode={statsMode} />
          </div>
        </section>
      </div>
    </div>
  );
}
