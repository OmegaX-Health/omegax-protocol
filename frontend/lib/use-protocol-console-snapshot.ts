// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { useNetworkContext } from "@/components/network-context";
import { loadProtocolConsoleSnapshot, type ProtocolConsoleSnapshot } from "@/lib/protocol";
import { formatRpcError, isRpcRateLimitError } from "@/lib/rpc-errors";

const POLL_INTERVAL_MS = 20_000;
const SNAPSHOT_CACHE_TTL_MS = 1_000;
const RATE_LIMIT_BACKOFF_MS = 12_000;
const RATE_LIMIT_BACKOFF_STORAGE_KEY = "omegax-rpc-rate-limit-backoffs";
const STORED_RATE_LIMIT_MESSAGE = "429 RPC rate limit; waiting before retrying protocol snapshot loads.";
const PUBLIC_MAINNET_SNAPSHOT_DISABLED_MESSAGE = "Mainnet protocol snapshots require a configured RPC profile.";

const EMPTY_PROTOCOL_CONSOLE_SNAPSHOT: ProtocolConsoleSnapshot = {
  protocolGovernance: null,
  reserveDomains: [],
  domainAssetVaults: [],
  reserveAssetRails: [],
  domainAssetLedgers: [],
  healthPlans: [],
  policySeries: [],
  memberPositions: [],
  fundingLines: [],
  claimCases: [],
  obligations: [],
  liquidityPools: [],
  capitalClasses: [],
  lpPositions: [],
  allocationPositions: [],
  planReserveLedgers: [],
  seriesReserveLedgers: [],
  fundingLineLedgers: [],
  poolClassLedgers: [],
  allocationLedgers: [],
  outcomesBySeries: {},
  oracleProfiles: [],
  poolOracleApprovals: [],
  poolOraclePolicies: [],
  poolOraclePermissionSets: [],
  outcomeSchemas: [],
  schemaDependencyLedgers: [],
  claimAttestations: [],
  protocolFeeVaults: [],
  poolTreasuryVaults: [],
  poolOracleFeeVaults: [],
};

type SnapshotCacheEntry = {
  loadedAt: number;
  snapshot: ProtocolConsoleSnapshot;
};

type RateLimitBackoffEntry = {
  cause: unknown;
  until: number;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();
const snapshotLoads = new Map<string, Promise<ProtocolConsoleSnapshot>>();
const rateLimitBackoffs = new Map<string, RateLimitBackoffEntry>();

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readStoredBackoffs(): Record<string, { until: number; message?: string }> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(RATE_LIMIT_BACKOFF_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, { until: number; message?: string }>
      : {};
  } catch {
    return {};
  }
}

function writeStoredBackoffs(backoffs: Record<string, { until: number; message?: string }>): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(RATE_LIMIT_BACKOFF_STORAGE_KEY, JSON.stringify(backoffs));
  } catch {
    // Local storage is only a cross-page throttle hint; ignore quota/privacy failures.
  }
}

function readStoredRateLimitBackoff(key: string, now: number): RateLimitBackoffEntry | null {
  const backoffs = readStoredBackoffs();
  const entry = backoffs[key];
  if (!entry || typeof entry.until !== "number") return null;
  if (now >= entry.until) {
    delete backoffs[key];
    writeStoredBackoffs(backoffs);
    return null;
  }
  return {
    cause: new Error(entry.message || STORED_RATE_LIMIT_MESSAGE),
    until: entry.until,
  };
}

function storeRateLimitBackoff(key: string, cause: unknown, until: number): void {
  const backoffs = readStoredBackoffs();
  backoffs[key] = {
    until,
    message: cause instanceof Error && cause.message ? cause.message : STORED_RATE_LIMIT_MESSAGE,
  };
  writeStoredBackoffs(backoffs);
}

function clearStoredRateLimitBackoff(key: string): void {
  const backoffs = readStoredBackoffs();
  if (!(key in backoffs)) return;
  delete backoffs[key];
  writeStoredBackoffs(backoffs);
}

async function loadSharedProtocolConsoleSnapshot(
  connection: Parameters<typeof loadProtocolConsoleSnapshot>[0],
): Promise<ProtocolConsoleSnapshot> {
  const key = connection.rpcEndpoint;
  const now = Date.now();
  const cached = snapshotCache.get(key);
  if (cached && now - cached.loadedAt <= SNAPSHOT_CACHE_TTL_MS) {
    return cached.snapshot;
  }

  const backoff = rateLimitBackoffs.get(key);
  if (backoff) {
    if (now < backoff.until) throw backoff.cause;
    rateLimitBackoffs.delete(key);
  }

  const storedBackoff = readStoredRateLimitBackoff(key, now);
  if (storedBackoff) {
    rateLimitBackoffs.set(key, storedBackoff);
    throw storedBackoff.cause;
  }

  const current = snapshotLoads.get(key);
  if (current) return current;

  const load = loadProtocolConsoleSnapshot(connection)
    .then((snapshot) => {
      snapshotCache.set(key, { loadedAt: Date.now(), snapshot });
      rateLimitBackoffs.delete(key);
      clearStoredRateLimitBackoff(key);
      return snapshot;
    })
    .catch((cause) => {
      if (isRpcRateLimitError(cause)) {
        const until = Date.now() + RATE_LIMIT_BACKOFF_MS;
        rateLimitBackoffs.set(key, { cause, until });
        storeRateLimitBackoff(key, cause, until);
      }
      throw cause;
    })
    .finally(() => {
      snapshotLoads.delete(key);
    });
  snapshotLoads.set(key, load);
  return load;
}

export function useProtocolConsoleSnapshot() {
  const { connection } = useConnection();
  const { selectedNetwork, resolvedRpcProfile } = useNetworkContext();
  const [snapshot, setSnapshot] = useState<ProtocolConsoleSnapshot>(EMPTY_PROTOCOL_CONSOLE_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [snapshotEndpoint, setSnapshotEndpoint] = useState<string | null>(null);
  const isPublicMainnetSnapshotDisabled = selectedNetwork === "mainnet-beta" && resolvedRpcProfile === "public";

  const refresh = useCallback(async () => {
    if (isPublicMainnetSnapshotDisabled) {
      setSnapshot(EMPTY_PROTOCOL_CONSOLE_SNAPSHOT);
      setLastUpdatedAt(null);
      setSnapshotEndpoint(null);
      setLoading(false);
      setError(PUBLIC_MAINNET_SNAPSHOT_DISABLED_MESSAGE);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextSnapshot = await loadSharedProtocolConsoleSnapshot(connection);
      setSnapshot(nextSnapshot);
      setLastUpdatedAt(new Date());
      setSnapshotEndpoint(connection.rpcEndpoint);
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load live protocol state.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, isPublicMainnetSnapshotDisabled]);

  useEffect(() => {
    let cancelled = false;

    setSnapshot(EMPTY_PROTOCOL_CONSOLE_SNAPSHOT);
    setLastUpdatedAt(null);
    setSnapshotEndpoint(null);

    if (isPublicMainnetSnapshotDisabled) {
      setLoading(false);
      setError(PUBLIC_MAINNET_SNAPSHOT_DISABLED_MESSAGE);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextSnapshot = await loadSharedProtocolConsoleSnapshot(connection);
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setLastUpdatedAt(new Date());
        setSnapshotEndpoint(connection.rpcEndpoint);
      } catch (cause) {
        if (cancelled) return;
        setError(
          formatRpcError(cause, {
            fallback: "Failed to load live protocol state.",
            rpcEndpoint: connection.rpcEndpoint,
          }),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    function isHidden(): boolean {
      return typeof document !== "undefined" && document.visibilityState === "hidden";
    }

    function handleVisibilityChange() {
      if (cancelled) return;
      // Force a fresh load when the tab becomes visible again so users do not
      // act on data that staled while they were away.
      if (document.visibilityState === "visible") {
        void load();
      }
    }

    void load();

    // Periodic poll, but only fires the network call when the tab is visible.
    // The setInterval keeps ticking while hidden so that the moment the tab
    // returns we already know we should load - but the actual RPC call is
    // gated by document.visibilityState. Returning to visibility also triggers
    // an immediate load via the visibilitychange handler so the user does not
    // have to wait up to 20s for the next tick.
    const interval = window.setInterval(() => {
      if (cancelled) return;
      if (isHidden()) return;
      void load();
    }, POLL_INTERVAL_MS);

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [connection, isPublicMainnetSnapshotDisabled]);

  return {
    snapshot,
    loading,
    error,
    refresh,
    lastUpdatedAt,
    hasCurrentSnapshot: Boolean(lastUpdatedAt && snapshotEndpoint === connection.rpcEndpoint),
    snapshotEndpoint,
  };
}
