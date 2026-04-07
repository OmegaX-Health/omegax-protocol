// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";

import { WorkbenchRailCard } from "@/components/workbench-ui";
import { buildCanonicalConsoleState } from "@/lib/console-model";
import { formatAmount } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { loadGovernanceProposalQueue } from "@/lib/governance-readonly";
import { formatRpcError } from "@/lib/rpc-errors";
import {
  buildAuditTrail,
  buildGovernanceQueue,
  computeWorkbenchMetrics,
  describeGovernanceQueueStatus,
} from "@/lib/workbench";
import { useWorkspacePersona } from "@/components/workspace-persona";

type FocusRow = {
  id: string;
  title: string;
  meta: string;
  detail: string;
  href: string;
};

function quickActionsForPersona(persona: string, selectedRow: FocusRow | null, sponsorClaimsHref: string) {
  const selectedAddress = selectedRow?.id ? encodeURIComponent(selectedRow.id) : "";
  switch (persona) {
    case "capital":
      if (selectedAddress) {
        return [
          { href: `/capital?pool=${selectedAddress}&tab=queue`, label: "Review queue posture" },
          { href: `/capital?pool=${selectedAddress}&tab=allocations`, label: "Inspect allocations" },
          { href: `/oracles?pool=${selectedAddress}&tab=bindings`, label: "Check settlement bindings" },
        ];
      }
      return [
        { href: "/capital?tab=queue", label: "Review queue posture" },
        { href: "/capital?tab=allocations", label: "Inspect allocations" },
        { href: "/oracles?tab=bindings", label: "Check settlement bindings" },
      ];
    case "governance":
      if (selectedRow) {
        return [
          { href: selectedRow.href, label: "Open proposal queue" },
          { href: "/governance?tab=templates", label: "Review templates" },
          { href: "/oracles?tab=attestations", label: "Watch attestation feed" },
        ];
      }
      return [
        { href: "/governance?tab=queue", label: "Open proposal queue" },
        { href: "/governance?tab=templates", label: "Review templates" },
        { href: "/oracles?tab=attestations", label: "Watch attestation feed" },
      ];
    case "sponsor":
      if (selectedAddress) {
        return [
          { href: `/plans?plan=${selectedAddress}&tab=claims`, label: "Resolve active claims" },
          { href: `/plans?plan=${selectedAddress}&tab=funding`, label: "Review funding lines" },
          { href: `/plans?plan=${selectedAddress}&tab=series`, label: "Inspect policy series" },
        ];
      }
      return [
        { href: sponsorClaimsHref, label: "Resolve active claims" },
        { href: "/plans?tab=funding", label: "Review funding lines" },
        { href: "/plans?tab=series", label: "Inspect policy series" },
      ];
    default:
      if (selectedRow) {
        return [
          { href: selectedRow.href, label: "Open plans" },
          { href: "/capital", label: "Open capital" },
          { href: "/governance", label: "Open governance" },
        ];
      }
      return [
        { href: "/plans", label: "Open plans" },
        { href: "/capital", label: "Open capital" },
        { href: "/governance", label: "Open governance" },
      ];
  }
}

export function OverviewWorkbench() {
  const { connection } = useConnection();
  const { effectivePersona } = useWorkspacePersona();
  const consoleState = useMemo(() => buildCanonicalConsoleState(), []);
  const metrics = useMemo(() => computeWorkbenchMetrics(), []);
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
    () => buildAuditTrail({ section: "overview", persona: effectivePersona, queue: governanceQueue }),
    [effectivePersona, governanceQueue],
  );

  const focusRows = useMemo<FocusRow[]>(() => {
    if (effectivePersona === "capital") {
      return DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.map((pool) => ({
        id: pool.address,
        title: pool.displayName,
        meta: `${formatAmount(pool.totalValueLocked)} TVL`,
        detail: `${DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.filter((entry) => entry.liquidityPool === pool.address).length} classes linked to ${DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter((entry) => entry.liquidityPool === pool.address).length} active allocations.`,
        href: `/capital?pool=${encodeURIComponent(pool.address)}&tab=overview`,
      }));
    }

    if (effectivePersona === "governance") {
      if (governanceQueue.length === 0) {
        return [
          {
            id: "governance-live-queue",
            title: governanceQueueStatus.emptyTitle,
            meta: governanceQueueStatus.emptyMeta,
            detail: governanceQueueStatus.emptyDetail,
            href: "/governance?tab=queue",
          },
        ];
      }

      return governanceQueue.map((proposal) => ({
        id: proposal.proposal,
        title: proposal.title,
        meta: proposal.status,
        detail: `${proposal.stage} · ${proposal.authority}`,
        href: `/governance?proposal=${encodeURIComponent(proposal.proposal)}&tab=queue`,
      }));
    }

    return DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.map((plan) => {
      const sponsor = consoleState.sponsors.find((entry) => entry.healthPlanAddress === plan.address);
      const claimCount = sponsor?.activeClaimCount ?? 0;
      return {
        id: plan.address,
        title: plan.displayName,
        meta: `${sponsor?.perSeriesPerformance.length ?? 0} series`,
        detail: `${claimCount} active claim lanes and ${formatAmount(sponsor?.remainingSponsorBudget ?? 0)} remaining sponsor budget.`,
        href: `/plans?plan=${encodeURIComponent(plan.address)}&tab=overview`,
      };
    });
  }, [consoleState.sponsors, effectivePersona, governanceQueue, governanceQueueStatus]);

  const [selectedFocus, setSelectedFocus] = useState<string>("");
  const sponsorClaimsPlanAddress = useMemo(
    () =>
      consoleState.sponsors.find((entry) => entry.activeClaimCount > 0)?.healthPlanAddress
      ?? DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]?.address
      ?? "",
    [consoleState.sponsors],
  );
  const sponsorClaimsHref = sponsorClaimsPlanAddress
    ? `/plans?plan=${encodeURIComponent(sponsorClaimsPlanAddress)}&tab=claims`
    : "/plans?tab=claims";
  const preferredFocusId = useMemo(() => {
    if ((effectivePersona === "sponsor" || effectivePersona === "observer") && sponsorClaimsPlanAddress) {
      return sponsorClaimsPlanAddress;
    }
    return focusRows[0]?.id ?? "";
  }, [effectivePersona, focusRows, sponsorClaimsPlanAddress]);

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
        if (!cancelled) {
          setGovernanceQueueLoaded(true);
        }
      }
    }

    void loadProposalQueue();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    if (focusRows.length === 0) {
      if (selectedFocus) {
        setSelectedFocus("");
      }
      return;
    }
    if (!selectedFocus || !focusRows.some((row) => row.id === selectedFocus)) {
      setSelectedFocus(preferredFocusId);
    }
  }, [focusRows, preferredFocusId, selectedFocus]);

  const selectedRow =
    focusRows.find((row) => row.id === selectedFocus)
    ?? focusRows.find((row) => row.id === preferredFocusId)
    ?? focusRows[0]
    ?? null;
  const quickActions = quickActionsForPersona(effectivePersona, selectedRow, sponsorClaimsHref);
  return (
    <div className="workbench-page">
      <section className="workbench-main-column">
        <section className="workbench-panel heavy-glass brackets workbench-primary-surface">
          <div className="workbench-panel-head">
            <div>
              <p className="workbench-panel-eyebrow">Operations register</p>
              <h2 className="workbench-panel-title">Track plans, pools, and proposals in one shared workspace.</h2>
              <p className="workbench-body-copy">Review active plan, capital, and governance work in one place before opening a specific lane.</p>
            </div>
            <span className="workbench-card-meta">{effectivePersona.toUpperCase()}</span>
          </div>

          <div className="workbench-summary-strip">
            <div className="workbench-summary-metric">
              <span>Active claims</span>
              <strong>{metrics.activeClaims}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Pending queue</span>
              <strong>{metrics.pendingRedemptions}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Governance queue</span>
              <strong aria-live="polite" aria-label={governanceQueueStatus.metricAriaLabel}>{governanceQueueStatus.metricValue}</strong>
            </div>
          </div>

          <div className="workbench-table-card workbench-table-card-embedded milled-ceramic overview-register-table-card">
            <table className="workbench-table overview-register-table">
              <thead>
                <tr>
                  <th scope="col">Focus</th>
                  <th scope="col">Context</th>
                  <th scope="col">State</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {focusRows.map((row) => (
                  <tr key={row.id} className={selectedRow?.id === row.id ? "workbench-table-row-active" : undefined}>
                    <td data-label="Focus">
                      <button type="button" className="workbench-inline-button" onClick={() => setSelectedFocus(row.id)}>
                        {row.title}
                      </button>
                    </td>
                    <td data-label="Context">{row.meta}</td>
                    <td data-label="State">{row.detail}</td>
                    <td data-label="Action">
                      <Link href={row.href} className="workbench-inline-link">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <aside className="workbench-rail">
        <WorkbenchRailCard title="Selected context" meta="DETAIL">
          {selectedRow ? (
            <div className="workbench-stack">
              <strong>{selectedRow.title}</strong>
              <p>{selectedRow.detail}</p>
              <p className="workbench-inline-meta">{selectedRow.meta}</p>
              <Link href={selectedRow.href} className="workbench-inline-link">
                Open workbench
              </Link>
            </div>
          ) : null}
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Audit trail" meta="LIVE">
          <div className="workbench-timeline">
            {auditTrail.map((item) => (
              <article key={item.id} className={`workbench-timeline-item workbench-timeline-item-${item.tone}`}>
                <div className="workbench-timeline-head">
                  <strong>{item.label}</strong>
                  <span>{item.timestamp}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Quick actions" meta="TASKS">
          <div className="workbench-stack">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="workbench-inline-link">
                {action.label}
              </Link>
            ))}
          </div>
        </WorkbenchRailCard>

        <WorkbenchRailCard title="System watch" meta="HEALTH">
          <div className="workbench-stack">
            <div className="workbench-mini-stat">
              <span>Health plans</span>
              <strong>{DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.length}</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Policy series</span>
              <strong>{DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.length}</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Reserve domains</span>
              <strong>{DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.length}</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Oracle operators</span>
              <strong>{DEVNET_PROTOCOL_FIXTURE_STATE.wallets.filter((wallet) => wallet.role === "oracle_operator").length}</strong>
            </div>
          </div>
        </WorkbenchRailCard>
      </aside>
    </div>
  );
}
