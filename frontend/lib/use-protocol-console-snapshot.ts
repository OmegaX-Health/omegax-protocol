// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { loadProtocolConsoleSnapshot, type ProtocolConsoleSnapshot } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

const EMPTY_PROTOCOL_CONSOLE_SNAPSHOT: ProtocolConsoleSnapshot = {
  protocolGovernance: null,
  reserveDomains: [],
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
};

export function useProtocolConsoleSnapshot() {
  const { connection } = useConnection();
  const [snapshot, setSnapshot] = useState<ProtocolConsoleSnapshot>(EMPTY_PROTOCOL_CONSOLE_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSnapshot = await loadProtocolConsoleSnapshot(connection);
      setSnapshot(nextSnapshot);
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

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection]);

  return {
    snapshot,
    loading,
    error,
    refresh,
  };
}
