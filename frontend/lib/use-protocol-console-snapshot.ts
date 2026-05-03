// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { loadProtocolConsoleSnapshot, type ProtocolConsoleSnapshot } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

const POLL_INTERVAL_MS = 20_000;

const EMPTY_PROTOCOL_CONSOLE_SNAPSHOT: ProtocolConsoleSnapshot = {
  protocolGovernance: null,
  reserveDomains: [],
  domainAssetVaults: [],
  reserveAssetRails: [],
  domainAssetLedgers: [],
  healthPlans: [],
  policySeries: [],
  memberPositions: [],
  commitmentCampaigns: [],
  commitmentPaymentRails: [],
  commitmentLedgers: [],
  commitmentPositions: [],
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

export function useProtocolConsoleSnapshot() {
  const { connection } = useConnection();
  const [snapshot, setSnapshot] = useState<ProtocolConsoleSnapshot>(EMPTY_PROTOCOL_CONSOLE_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSnapshot = await loadProtocolConsoleSnapshot(connection);
      setSnapshot(nextSnapshot);
      setLastUpdatedAt(new Date());
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
  }, [connection]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextSnapshot = await loadProtocolConsoleSnapshot(connection);
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setLastUpdatedAt(new Date());
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
  }, [connection]);

  return {
    snapshot,
    loading,
    error,
    refresh,
    lastUpdatedAt,
  };
}
