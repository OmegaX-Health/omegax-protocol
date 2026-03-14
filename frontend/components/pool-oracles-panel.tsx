// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

import {
  clearProtocolDiscoveryCache,
  listOraclesWithProfiles,
  listPoolOracleApprovals,
  listPoolOraclePolicies,
  toExplorerAddressLink,
  type OracleWithProfileSummary,
  type PoolOracleApprovalSummary,
  type PoolOraclePolicySummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type PoolOraclesPanelProps = {
  poolAddress: string;
  sectionMode?: "standalone" | "embedded";
};

type ApprovedOracleRow = {
  oracle: string;
  approvalActive: boolean;
  registryActive: boolean | null;
  displayName: string;
  websiteUrl: string;
  metadataUri: string;
};

function shortAddress(value: string): string {
  if (!value) return value;
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function PoolOraclesPanel({ poolAddress, sectionMode = "standalone" }: PoolOraclesPanelProps) {
  const { connection } = useConnection();
  const embedded = sectionMode === "embedded";

  const [oracles, setOracles] = useState<OracleWithProfileSummary[]>([]);
  const [approvals, setApprovals] = useState<PoolOracleApprovalSummary[]>([]);
  const [policy, setPolicy] = useState<PoolOraclePolicySummary | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      clearProtocolDiscoveryCache();
      const [nextOracles, nextApprovals, nextPolicies] = await Promise.all([
        listOraclesWithProfiles({ connection, activeOnly: false }),
        listPoolOracleApprovals({ connection, poolAddress, activeOnly: false }),
        listPoolOraclePolicies({ connection, poolAddress }),
      ]);

      setOracles(nextOracles);
      setApprovals(nextApprovals);
      setPolicy(nextPolicies[0] ?? null);
      setLastUpdatedAt(Date.now());
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load pool oracle network.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, poolAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const oracleByAddress = useMemo(() => {
    const map = new Map<string, OracleWithProfileSummary>();
    for (const oracle of oracles) {
      map.set(oracle.oracle, oracle);
    }
    return map;
  }, [oracles]);

  const approvedOracles = useMemo((): ApprovedOracleRow[] => {
    const query = normalize(search);
    const rows = approvals.map((approval) => {
      const oracle = oracleByAddress.get(approval.oracle);
      const profile = oracle?.profile;
      return {
        oracle: approval.oracle,
        approvalActive: approval.active,
        registryActive: oracle ? oracle.active : null,
        displayName: profile?.displayName || "",
        websiteUrl: profile?.websiteUrl || "",
        metadataUri: oracle?.metadataUri || "",
      };
    });

    const filtered = query
      ? rows.filter((row) =>
        [
          row.oracle,
          row.displayName,
          row.websiteUrl,
          row.metadataUri,
          row.approvalActive ? "approved" : "inactive",
          row.registryActive === null ? "unregistered" : row.registryActive ? "active" : "inactive",
        ].some((value) => normalize(value).includes(query)),
      )
      : rows;

    return filtered.sort((a, b) => {
      if (a.approvalActive !== b.approvalActive) return a.approvalActive ? -1 : 1;
      if (a.registryActive !== b.registryActive) return a.registryActive ? -1 : 1;
      return a.oracle.localeCompare(b.oracle);
    });
  }, [approvals, oracleByAddress, search]);

  const approvalsActiveCount = useMemo(
    () => approvals.filter((row) => row.active).length,
    [approvals],
  );
  const registryActiveCount = useMemo(
    () => oracles.filter((row) => row.active).length,
    [oracles],
  );

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="hero-title">Oracle Network</h2>
          <p className="hero-copy">
            Oracles verify pool outcomes. This view shows the pool policy (quorum + requirements) and which oracles are approved to participate.
          </p>
        </div>
      ) : null}

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Pool oracle network</p>
          </div>
          <button
            type="button"
            className="secondary-button inline-flex items-center gap-1.5"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <p className="field-help">
          Approvals + quorum determine who can vote on outcomes and settle claims for this pool.
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-off">Approved: {approvalsActiveCount}/{approvals.length}</span>
          <span className="status-pill status-off">Registry active: {registryActiveCount}/{oracles.length}</span>
          {policy ? (
            <span className="status-pill status-off">Quorum: {policy.quorumM}/{policy.quorumN}</span>
          ) : (
            <span className="status-pill status-error">Policy: missing</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            className="secondary-button inline-flex items-center gap-2"
            href={toExplorerAddressLink(poolAddress)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Pool on Explorer
          </a>
          <Link href="/oracles" className="secondary-button inline-flex">
            Open oracle registry
          </Link>
        </div>

        {error ? <p className="field-error">{error}</p> : null}
        {lastUpdatedAt ? <p className="field-help">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</p> : null}
      </section>

      <section className="surface-card-soft space-y-2">
        <p className="metric-label">Policy</p>
        {policy ? (
          <div className="flex flex-wrap gap-2">
            <span className="status-pill status-off">Quorum {policy.quorumM}/{policy.quorumN}</span>
            <span className={`status-pill ${policy.requireVerifiedSchema ? "status-ok" : "status-off"}`}>
              Verified schemas {policy.requireVerifiedSchema ? "required" : "optional"}
            </span>
            <span className={`status-pill ${policy.allowDelegateClaim ? "status-ok" : "status-off"}`}>
              Delegate claims {policy.allowDelegateClaim ? "allowed" : "not allowed"}
            </span>
          </div>
        ) : (
          <p className="field-help">No oracle policy found for this pool yet. Configure it in Settings.</p>
        )}
      </section>

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="metric-label">Approved oracles</p>
          <span className="status-pill status-off">{approvals.length} total</span>
        </div>

        <input
          className="field-input"
          placeholder="Search approved oracles..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {approvals.length === 0 ? (
          <p className="field-help">No oracle approvals found for this pool.</p>
        ) : approvedOracles.length === 0 ? (
          <p className="field-help">No approved oracles match that search.</p>
        ) : (
          <ul className="space-y-2">
            {approvedOracles.map((row) => (
              <li
                key={row.oracle}
                className="rounded-2xl border border-[var(--border)]/60 bg-[color-mix(in_oklab,var(--surface-strong)_88%,transparent)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {row.displayName || shortAddress(row.oracle)}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono break-all">{row.oracle}</p>
                    {row.websiteUrl ? (
                      <a
                        className="text-xs text-[var(--primary)] hover:underline break-all"
                        href={row.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {row.websiteUrl}
                      </a>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`status-pill ${row.approvalActive ? "status-ok" : "status-off"}`}>
                      {row.approvalActive ? "Approved" : "Inactive"}
                    </span>
                    <span
                      className={`status-pill ${
                        row.registryActive === null ? "status-error" : row.registryActive ? "status-ok" : "status-off"
                      }`}
                    >
                      {row.registryActive === null
                        ? "Unregistered"
                        : row.registryActive
                          ? "Registry active"
                          : "Registry inactive"}
                    </span>
                    <a
                      className="secondary-button inline-flex items-center gap-1.5 py-1.5 text-xs"
                      href={toExplorerAddressLink(row.oracle)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Explorer
                    </a>
                  </div>
                </div>

                {row.metadataUri ? (
                  <p className="field-help mt-2 break-all">Metadata: {row.metadataUri}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

