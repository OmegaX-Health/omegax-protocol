// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { RefreshCw } from "lucide-react";

import { useNetworkContext } from "@/components/network-context";
import { NETWORK_OPTIONS } from "@/lib/network-config";
import { useProtocolConsoleSnapshot } from "@/lib/use-protocol-console-snapshot";

function formatUpdatedAt(value: Date | null): string {
  if (!value) return "Not loaded";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusClass(error: string | null, loading: boolean, loaded: boolean): string {
  if (error) return "status-error";
  if (loading && !loaded) return "status-off";
  return "status-ok";
}

export function NetworkHealthWorkbench() {
  const { selectedNetwork } = useNetworkContext();
  const {
    snapshot,
    loading,
    error,
    refresh,
    lastUpdatedAt,
    hasCurrentSnapshot,
  } = useProtocolConsoleSnapshot();
  const networkLabel = NETWORK_OPTIONS.find((option) => option.id === selectedNetwork)?.label ?? selectedNetwork;
  const activePlans = snapshot.healthPlans.filter((plan) => plan.active).length;
  const totalRecords =
    snapshot.reserveDomains.length
    + snapshot.healthPlans.length
    + snapshot.policySeries.length
    + snapshot.claimCases.length
    + snapshot.obligations.length;
  const healthLabel = error ? "Degraded" : hasCurrentSnapshot ? "Synced" : loading ? "Checking" : "Standby";

  const cards = [
    {
      label: "Protocol records",
      value: String(totalRecords),
      detail: `${activePlans} active plans, ${snapshot.policySeries.length} series, ${snapshot.reserveDomains.length} domains`,
    },
    {
      label: "Reserve domains",
      value: String(snapshot.reserveDomains.length),
      detail: `${snapshot.fundingLines.length} funding lines across the reserve-backed treasury rail`,
    },
    {
      label: "Claims watch",
      value: String(snapshot.claimCases.length),
      detail: `${snapshot.obligations.length} reserve obligations visible in the console snapshot`,
    },
  ];

  return (
    <div className="workbench-grid" style={{ maxWidth: "72rem", margin: "0 auto" }}>
      <section className="workbench-panel workbench-primary-surface">
        <div className="workbench-panel-head">
          <div>
            <p className="workbench-panel-eyebrow">{networkLabel}</p>
            <h1 className="workbench-panel-title">Network Health</h1>
          </div>
          <span className={`status-pill ${statusClass(error, loading, hasCurrentSnapshot)}`}>
            {healthLabel}
          </span>
        </div>
        <div className="workbench-grid workbench-grid-2">
          <div>
            <p className="workbench-card-meta">Snapshot</p>
            <p className="workbench-body-copy" style={{ marginTop: "0.55rem" }}>
              Last update: {formatUpdatedAt(lastUpdatedAt)}
            </p>
          </div>
          <div>
            <p className="workbench-card-meta">RPC</p>
            <p className="workbench-body-copy" style={{ marginTop: "0.55rem" }}>
              {error ?? (hasCurrentSnapshot ? "Live snapshot is current for the selected network." : "Waiting for the first live snapshot.")}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => { void refresh(); }}
          disabled={loading}
          style={{ gap: "0.45rem", marginTop: "1rem" }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </section>

      <section className="workbench-grid workbench-grid-2" aria-label="Network health metrics">
        {cards.map((card) => (
          <article key={card.label} className="workbench-panel">
            <p className="workbench-kpi-label">{card.label}</p>
            <p className="workbench-kpi-value" style={{ margin: "0.45rem 0 0.55rem" }}>
              {card.value}
            </p>
            <p className="workbench-kpi-detail">{card.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
