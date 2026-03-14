// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { OperatorVisibilityPanel } from "@/components/operator-visibility-panel";
import { listOracles, type OracleSummary } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function OracleStakingAccessPanel() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const [oracles, setOracles] = useState<OracleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() ?? "";
  const registeredOracle = useMemo(
    () => (walletAddress ? oracles.find((oracle) => oracle.oracle === walletAddress) ?? null : null),
    [oracles, walletAddress],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextOracles = await listOracles({ connection, activeOnly: false });
      setOracles(nextOracles);
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load oracle registrations.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!connected || !publicKey) {
    return (
      <section className="surface-card space-y-3">
        <h2 className="hero-title">Oracle Wallet Required</h2>
        <p className="field-help">Connect the oracle wallet to open verifier diagnostics.</p>
      </section>
    );
  }

  if (!registeredOracle) {
    return (
      <section className="surface-card space-y-3">
        <h2 className="hero-title">Wallet Is Not a Registered Oracle</h2>
        <p className="field-help">
          Connected wallet: <span className="font-mono">{shortAddress(walletAddress)}</span>
        </p>
        <p className="field-help">Verifier diagnostics are shown only for wallets with an oracle registry entry.</p>
        {error ? <p className="field-error">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh oracle registry"}
          </button>
          <Link href="/oracles" className="secondary-button inline-flex">
            Register verifier to continue
          </Link>
          <Link href="/oracles" className="secondary-button inline-flex">
            Open oracle registry
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="surface-card-soft space-y-1">
        <p className="metric-label">Registered oracle wallet</p>
        <p className="field-help font-mono">{walletAddress}</p>
      </section>
      <OperatorVisibilityPanel
        lens="oracles"
        initialOracleAddress={walletAddress}
        lockOracleSelection
      />
    </div>
  );
}
