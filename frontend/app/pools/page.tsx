// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Building2, Coins, ExternalLink, HeartPulse, Plus, RefreshCw, Search, ShieldCheck, Users, WalletCards } from "lucide-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { Hero } from "@/components/hero";
import {
  listPoolOracleApprovals,
  listPoolsWithPolicySeries,
  POOL_STATUS_ACTIVE,
  POOL_STATUS_CLOSED,
  POOL_STATUS_DRAFT,
  type PoolWithPolicySeriesSummary,
} from "@/lib/protocol";
import {
  buildBusinessContextHref,
  BUSINESS_ENTRY_MODAL_SESSION_KEY,
  getBusinessEntryContext,
} from "@/lib/business-entry-context";
import {
  formatApyBps,
  formatPoolTvl,
  listPoolDefiMetrics,
  type PoolDefiMetricsByPool,
} from "@/lib/pool-defi-metrics";
import { formatRpcError } from "@/lib/rpc-errors";

function shortAddr(v: string) {
  return v.length < 10 ? v : `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function statusLabel(status: number) {
  switch (status) {
    case POOL_STATUS_DRAFT:
      return { text: "Draft", color: "status-off" };
    case POOL_STATUS_ACTIVE:
      return { text: "Active", color: "status-ok" };
    case POOL_STATUS_CLOSED:
      return { text: "Closed", color: "status-error" };
    default:
      return { text: `Unknown (${status})`, color: "status-off" };
  }
}

function formatReward(lamports: bigint) {
  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  if (sol >= 1) return `${sol.toLocaleString()} tokens`;
  if (sol > 0) return `${(sol * 1000).toFixed(1)}m tokens`;
  return "—";
}

function formatMemberMode(mode: number) {
  if (mode === 0) return "Open enrollment";
  if (mode === 1) return "Token-gated";
  return "Invite-only";
}

function PoolsPageClient() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const searchParams = useSearchParams();
  const businessEntry = useMemo(() => getBusinessEntryContext(searchParams), [searchParams]);
  const requiredBusinessOracle = businessEntry.requiredOracleResolved;

  const [pools, setPools] = useState<PoolWithPolicySeriesSummary[]>([]);
  const [metricsByPool, setMetricsByPool] = useState<PoolDefiMetricsByPool>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [businessPolicyWarning, setBusinessPolicyWarning] = useState<string | null>(null);
  const [defaultPoolWarning, setDefaultPoolWarning] = useState<string | null>(null);
  const [showBusinessPolicyModal, setShowBusinessPolicyModal] = useState(false);
  const refreshSeq = useRef(0);

  const createPoolHref = useMemo(
    () => buildBusinessContextHref("/pools/create", businessEntry),
    [businessEntry],
  );

  const buildPoolHref = useCallback(
    (poolAddress: string, section?: string) =>
      buildBusinessContextHref(`/pools/${poolAddress}`, businessEntry, section ? { section } : undefined),
    [businessEntry],
  );

  const dismissBusinessPolicyModal = useCallback(() => {
    setShowBusinessPolicyModal(false);
    try {
      window.sessionStorage.setItem(BUSINESS_ENTRY_MODAL_SESSION_KEY, "1");
    } catch {
      // Ignore storage failures and keep UI functional.
    }
  }, []);

  useEffect(() => {
    if (!businessEntry.isBusinessOrigin) {
      setShowBusinessPolicyModal(false);
      return;
    }
    try {
      if (window.sessionStorage.getItem(BUSINESS_ENTRY_MODAL_SESSION_KEY) === "1") return;
    } catch {
      // Ignore storage failures and default to showing once for this load.
    }
    setShowBusinessPolicyModal(true);
  }, [businessEntry.isBusinessOrigin]);

  const refresh = useCallback(async () => {
    const requestId = refreshSeq.current + 1;
    refreshSeq.current = requestId;
    setLoading(true);
    setError(null);
    setMetricsError(null);
    setBusinessPolicyWarning(null);
    setDefaultPoolWarning(null);
    try {
      const allPools = await listPoolsWithPolicySeries({ connection, search: null });
      if (refreshSeq.current !== requestId) return;

      let filteredPools = allPools;
      let shouldLoadMetrics = true;

      if (businessEntry.isBusinessOrigin) {
        if (!requiredBusinessOracle) {
          filteredPools = [];
          shouldLoadMetrics = false;
          setBusinessPolicyWarning(
            "Business-origin policy is active, but no valid required oracle is configured. Configure required oracle and refresh.",
          );
        } else {
          const approvals = await listPoolOracleApprovals({
            connection,
            oracleAddress: requiredBusinessOracle,
            activeOnly: true,
          });
          if (refreshSeq.current !== requestId) return;
          const eligiblePools = new Set(approvals.map((row) => row.pool));
          filteredPools = allPools.filter((pool) => eligiblePools.has(pool.address));
          if (businessEntry.defaultPoolId && !eligiblePools.has(businessEntry.defaultPoolId)) {
            setDefaultPoolWarning(
              `Default pool ${shortAddr(businessEntry.defaultPoolId)} is not approved for required oracle ${shortAddr(requiredBusinessOracle)}.`,
            );
          }
          if (filteredPools.length === 0) {
            setBusinessPolicyWarning(
              `No health plans are currently approved for required oracle ${shortAddr(requiredBusinessOracle)}.`,
            );
          }
        }
      }

      setPools(filteredPools);
      setMetricsByPool({});
      if (!shouldLoadMetrics) {
        setMetricsLoading(false);
        return;
      }

      setMetricsLoading(true);
      void listPoolDefiMetrics({ connection, pools: filteredPools })
        .then((metrics) => {
          if (refreshSeq.current !== requestId) return;
          setMetricsByPool(metrics);
        })
        .catch((err) => {
          if (refreshSeq.current !== requestId) return;
          setMetricsError(
            formatRpcError(err, {
              fallback: "Failed to load APY/TVL metrics.",
              rpcEndpoint: connection.rpcEndpoint,
            }),
          );
        })
        .finally(() => {
          if (refreshSeq.current !== requestId) return;
          setMetricsLoading(false);
        });
    } catch (err) {
      if (refreshSeq.current !== requestId) return;
      setError(
        formatRpcError(err, {
          fallback: "Failed to load health plans.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      if (refreshSeq.current !== requestId) return;
      setLoading(false);
    }
  }, [businessEntry.defaultPoolId, businessEntry.isBusinessOrigin, connection, requiredBusinessOracle]);

  useEffect(() => { void refresh(); }, [refresh]);

  const walletAddress = publicKey?.toBase58() ?? "";
  const visiblePools = pools.filter((pool) => {
    if (pool.status !== POOL_STATUS_CLOSED) return true;
    return Boolean(walletAddress) && walletAddress === pool.authority;
  });

  const filteredPools = search.trim()
    ? visiblePools.filter((p) =>
      p.poolId.toLowerCase().includes(search.toLowerCase()) ||
      p.organizationRef.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase())
    )
    : visiblePools;

  return (
    <div className="space-y-5">
      {showBusinessPolicyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(61,72,82,0.18)] p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Business-origin verification policy"
            className="modal-shell w-full max-w-xl p-6"
          >
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Business-origin verification policy</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              This session was opened from OmegaX Business. Eligible plans must include the required OmegaX Health oracle verifier.
              New plans created here will lock that verifier into the verification network.
            </p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Required oracle: {requiredBusinessOracle ? shortAddr(requiredBusinessOracle) : "Not configured"}
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" className="action-button" onClick={dismissBusinessPolicyModal}>
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Hero
        title="Health Plans"
        subtitle="Browse public, permissionless health plans. Deposit liquidity as a yield farmer, enroll as a member, or create your own plan for wellness rewards and insurance coverage."
        icon={HeartPulse}
      />

      {/* Actions Bar */}
      <section className="surface-card">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search by plan name, organization, or address..."
              className="field-input w-full pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="secondary-button inline-flex items-center gap-1.5 text-sm"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading…" : "Refresh"}
            </button>
            <Link href={createPoolHref} className="action-button inline-flex items-center gap-1.5 text-sm">
              <Plus className="h-4 w-4" />
              Create Health Plan
            </Link>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && <p className="field-error surface-card">{error}</p>}
      {metricsError && <p className="field-help surface-card">{metricsError}</p>}
      {businessPolicyWarning && (
        <p className={`${businessEntry.missingRequiredOracle ? "field-error" : "field-help"} surface-card`}>
          {businessPolicyWarning}
        </p>
      )}
      {defaultPoolWarning && <p className="field-help surface-card">{defaultPoolWarning}</p>}

      {/* Plans List */}
      {!loading && filteredPools.length === 0 ? (
        <section className="surface-card text-center py-12 space-y-3">
          <HeartPulse className="h-10 w-10 mx-auto text-[var(--muted-foreground)]/50" />
          <h3 className="text-lg font-semibold text-[var(--foreground)]">No Health Plans Found</h3>
          <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
            {search
              ? "No plans match your search. Try a different keyword or clear the search."
              : "There are no public health plans yet on this network. Be the first to create one!"}
          </p>
          {!search && (
            <Link href={createPoolHref} className="action-button inline-flex items-center gap-1.5 text-sm mt-2">
              <Plus className="h-4 w-4" /> Create First Health Plan
            </Link>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          {filteredPools.map((pool) => {
            const status = statusLabel(pool.status);
            const metrics = metricsByPool[pool.address] ?? null;
            const tokenGate = pool.membershipMode === 1
              ? shortAddr(pool.tokenGateMint)
              : "—";
            const tokenGateMin = pool.membershipMode === 1
              ? `${pool.tokenGateMinBalance.toLocaleString()} units`
              : "—";
            const inviteIssuer = pool.inviteIssuer ? shortAddr(pool.inviteIssuer) : "Not set";
            const coverageCountLabel = pool.policySeriesCount === 1
              ? "1 policy series"
              : `${pool.policySeriesCount} policy series`;
            const tvlLabel = metricsLoading && !metrics ? "..." : formatPoolTvl(metrics?.tvl ?? null);
            const apyLabel = metricsLoading && !metrics ? "..." : formatApyBps(metrics?.apy ?? null);
            const membershipLabel = formatMemberMode(pool.membershipMode);
            return (
              <article
                key={pool.address}
                className="health-plan-card group p-0"
              >
                <div className="relative space-y-5 p-5 sm:p-6">
                  {/* Header + KPI strip */}
                  <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="neumo-chip text-[10px] uppercase tracking-[0.09em] text-[var(--muted-foreground)]">
                          Health plan
                        </span>
                        <span className={`status-pill shrink-0 ${status.color}`}>
                          {status.text}
                        </span>
                        <span className={`status-pill shrink-0 ${pool.policySeriesCount > 0 ? "status-ok" : "status-off"}`}>
                          {coverageCountLabel}
                        </span>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate font-display text-xl font-bold leading-tight tracking-tight text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)] sm:text-[1.6rem]">
                          {pool.poolId || "Unnamed Plan"}
                        </h3>
                        <p className="truncate font-mono text-xs text-[var(--muted-foreground)]" title={pool.address}>
                          {pool.address}
                        </p>
                      </div>
                      <div className="neumo-chip inline-flex max-w-full items-center gap-2 px-3 py-2 text-sm text-[var(--foreground)]">
                        <Building2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        <span className="truncate">{pool.organizationRef || "Organization not specified"}</span>
                      </div>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-3 xl:w-[30rem]">
                      <div className="neumo-kpi-card">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Reward per pass</div>
                        <div className="mt-2 flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
                          <Coins className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span>{formatReward(pool.payoutLamportsPerPass)}</span>
                        </div>
                      </div>
                      <div className="neumo-kpi-card">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">TVL</div>
                        <div className="mt-2 flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
                          <WalletCards className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                          <span>{tvlLabel}</span>
                        </div>
                      </div>
                      <div className="neumo-kpi-card">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Est. APY (30d)</div>
                        <div className="mt-2 text-base font-semibold text-[var(--foreground)]">{apyLabel}</div>
                      </div>
                    </div>
                  </div>

                  {/* Protocol metadata */}
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="neumo-meta-card">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Authority</div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--foreground)]">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        <span className="truncate font-mono">{shortAddr(pool.authority)}</span>
                      </div>
                    </div>
                    <div className="neumo-meta-card">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Membership</div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--foreground)]">
                        <Users className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        <span className="truncate">{membershipLabel}</span>
                      </div>
                    </div>
                    <div className="neumo-meta-card">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">{pool.membershipMode === 1 ? "Gate token" : "Invite issuer"}</div>
                      <div className="mt-2 text-sm text-[var(--foreground)] truncate" title={pool.membershipMode === 1 ? `${tokenGate} • ${tokenGateMin}` : inviteIssuer}>
                        {pool.membershipMode === 1 ? `${tokenGate} • ${tokenGateMin}` : inviteIssuer}
                      </div>
                    </div>
                    <div className="neumo-meta-card">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">Plan address</div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--foreground)]">
                        <ExternalLink className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                        <span className="truncate font-mono">{shortAddr(pool.address)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Template pack: <span className="font-semibold text-[var(--foreground)]">{coverageCountLabel}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href={buildPoolHref(pool.address)} className="secondary-button inline-flex items-center gap-1.5 py-2 text-xs">
                        Open workspace
                      </Link>
                      <Link href={buildPoolHref(pool.address, "liquidity")} className="secondary-button inline-flex items-center gap-1.5 py-2 text-xs">
                        Deposit liquidity
                      </Link>
                      <Link href={buildPoolHref(pool.address, "coverage")} className="action-button inline-flex items-center gap-1.5 py-2 text-xs">
                        Open coverage
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Loading skeleton */}
      {loading && filteredPools.length === 0 && (
        <section className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface-card animate-pulse space-y-4 p-5 sm:p-6">
              <div className="h-3.5 w-28 rounded-full bg-[var(--muted-foreground)]/10" />
              <div className="h-7 w-2/3 rounded-xl bg-[var(--muted-foreground)]/10" />
              <div className="h-3 w-1/2 rounded-xl bg-[var(--muted-foreground)]/10" />
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="h-16 rounded-2xl bg-[var(--muted-foreground)]/5" />
                <div className="h-16 rounded-2xl bg-[var(--muted-foreground)]/5" />
                <div className="h-16 rounded-2xl bg-[var(--muted-foreground)]/5" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="h-14 rounded-2xl bg-[var(--muted-foreground)]/5" />
                <div className="h-14 rounded-2xl bg-[var(--muted-foreground)]/5" />
                <div className="h-14 rounded-2xl bg-[var(--muted-foreground)]/5" />
                <div className="h-14 rounded-2xl bg-[var(--muted-foreground)]/5" />
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default function PoolsPage() {
  return (
    <Suspense
      fallback={(
        <div className="space-y-5">
          <section className="surface-card">
            <p className="field-help">Loading health plans…</p>
          </section>
        </div>
      )}
    >
      <PoolsPageClient />
    </Suspense>
  );
}
