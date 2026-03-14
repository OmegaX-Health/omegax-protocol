// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings2 } from "lucide-react";
import { useConnection } from "@solana/wallet-adapter-react";

import { OperatorVisibilityPanel } from "@/components/operator-visibility-panel";
import { PoolLifecyclePanel } from "@/components/pool-lifecycle-panel";
import { fetchProtocolReadiness, type ProtocolReadiness } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type PoolSettingsPanelProps = {
  poolAddress: string;
  sectionMode?: "standalone" | "embedded";
};

type ReadinessRow = {
  id: string;
  label: string;
  value: boolean;
};

function toReadinessRows(readiness: ProtocolReadiness | null): ReadinessRow[] {
  if (!readiness) {
    return [];
  }
  return [
    { id: "poolExists", label: "Plan account exists", value: readiness.poolExists },
    { id: "poolTermsConfigured", label: "Plan terms configured", value: readiness.poolTermsConfigured },
    { id: "poolOraclePolicyConfigured", label: "Oracle policy configured", value: readiness.poolOraclePolicyConfigured },
    { id: "poolAssetVaultConfigured", label: "Asset vault configured", value: readiness.poolAssetVaultConfigured },
    { id: "coveragePolicyExists", label: "Coverage policy exists", value: readiness.coveragePolicyExists },
    { id: "premiumLedgerTracked", label: "Premium ledger tracked", value: readiness.premiumLedgerTracked },
  ];
}

export function PoolSettingsPanel({ poolAddress, sectionMode = "standalone" }: PoolSettingsPanelProps) {
  const { connection } = useConnection();
  const embedded = sectionMode === "embedded";
  const [readiness, setReadiness] = useState<ProtocolReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const refreshReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchProtocolReadiness({
        connection,
        poolAddress,
      });
      setReadiness(next);
      setLastUpdatedAt(Date.now());
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load plan settings readiness.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
      setReadiness(null);
    } finally {
      setLoading(false);
    }
  }, [connection, poolAddress]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  const readinessRows = useMemo(() => toReadinessRows(readiness), [readiness]);
  const checksPassing = useMemo(
    () => readinessRows.filter((row) => row.value).length,
    [readinessRows],
  );
  const missingRows = useMemo(
    () => readinessRows.filter((row) => !row.value),
    [readinessRows],
  );

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="hero-title">Health Plan Settings</h2>
          <p className="hero-copy">Control lifecycle actions and policy configuration for this plan.</p>
        </div>
      ) : null}

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Health plan settings</p>
          </div>
          <button
            type="button"
            className="secondary-button inline-flex items-center gap-1.5"
            onClick={() => void refreshReadiness()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <p className="field-help">
          Policy, rules, and lifecycle controls are scoped to this health plan.
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-off">
            Readiness {checksPassing}/{readinessRows.length || 0}
          </span>
          {missingRows.length > 0 ? (
            <span className="status-pill status-error">{missingRows.length} checks missing</span>
          ) : (
            <span className="status-pill status-ok">All core checks passing</span>
          )}
        </div>

        {missingRows.length > 0 ? (
          <p className="field-help">
            Missing: {missingRows.map((row) => row.label).join(", ")}.
          </p>
        ) : null}

        <Link href="/pools/create" className="secondary-button inline-flex w-fit">
          Open create/policy wizard
        </Link>
        {error ? <p className="field-error">{error}</p> : null}
        {lastUpdatedAt ? <p className="field-help">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</p> : null}
      </section>

      <PoolLifecyclePanel poolAddress={poolAddress} />

      <details className="surface-card-soft">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
          Advanced schema/rule diagnostics
        </summary>
        <div className="pt-3">
          <OperatorVisibilityPanel
            lens="schemas"
            initialPoolAddress={poolAddress}
            lockPoolSelection
            sectionMode="embedded"
          />
        </div>
      </details>
    </section>
  );
}

