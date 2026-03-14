// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { RefreshCw, ShieldAlert } from "lucide-react";

import {
  buildSetPoolStatusTx,
  clearProtocolDiscoveryCache,
  listPools,
  POOL_STATUS_ACTIVE,
  POOL_STATUS_CLOSED,
  POOL_STATUS_DRAFT,
  toExplorerLink,
  type PoolSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function statusLabel(status: number): string {
  switch (status) {
    case POOL_STATUS_DRAFT:
      return "Draft";
    case POOL_STATUS_ACTIVE:
      return "Active";
    case POOL_STATUS_CLOSED:
      return "Closed";
    default:
      return `Unknown (${status})`;
  }
}

function statusClass(status: number): string {
  switch (status) {
    case POOL_STATUS_DRAFT:
      return "status-off";
    case POOL_STATUS_ACTIVE:
      return "status-ok";
    case POOL_STATUS_CLOSED:
      return "status-error";
    default:
      return "status-off";
  }
}

type PoolLifecyclePanelProps = {
  poolAddress: string;
};

export function PoolLifecyclePanel({ poolAddress }: PoolLifecyclePanelProps) {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();

  const [pool, setPool] = useState<PoolSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"close" | "reopen" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txSig, setTxSig] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const walletAddress = publicKey?.toBase58() ?? "";
  const isAuthority = Boolean(pool && walletAddress && pool.authority === walletAddress);
  const isClosed = pool?.status === POOL_STATUS_CLOSED;

  const statusText = useMemo(() => statusLabel(pool?.status ?? -1), [pool?.status]);
  const statusPillClass = useMemo(() => statusClass(pool?.status ?? -1), [pool?.status]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      clearProtocolDiscoveryCache();
      const pools = await listPools({ connection, search: null });
      setPool(pools.find((row) => row.address === poolAddress) ?? null);
      setLastUpdatedAt(Date.now());
    } catch (cause) {
      setLoadError(
        formatRpcError(cause, {
          fallback: "Failed to load pool lifecycle state.",
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

  async function submitStatus(nextStatus: number, action: "close" | "reopen") {
    if (!publicKey || !pool || !isAuthority) return;

    const confirmCopy = action === "close"
      ? "Close this health plan? This is a soft-close status update (archive-style), not account deletion."
      : "Reopen this health plan and return it to Active status?";
    if (!window.confirm(confirmCopy)) {
      return;
    }

    setBusy(action);
    setStatus("");
    setStatusTone(null);
    setTxSig("");

    try {
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const tx = buildSetPoolStatusTx({
        authority: publicKey,
        poolAddress: new PublicKey(pool.address),
        recentBlockhash: latestBlockhash.blockhash,
        status: nextStatus,
      });
      const signature = await sendTransaction(tx, connection);
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      setTxSig(signature);
      setStatusTone("ok");
      setStatus(action === "close" ? "Plan closed successfully." : "Plan reopened and set to Active.");

      clearProtocolDiscoveryCache();
      await refresh();
    } catch (cause) {
      setStatusTone("error");
      setStatus(
        formatRpcError(cause, {
          fallback: action === "close" ? "Close plan failed." : "Reopen plan failed.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="surface-card-soft space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[var(--accent-strong)]" />
          <p className="metric-label">Plan lifecycle (soft close)</p>
        </div>
        <button type="button" className="secondary-button inline-flex items-center gap-1.5" onClick={() => void refresh()} disabled={loading || Boolean(busy)}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <p className="field-help">
        Closing is an archive-style status update. Pool accounts and on-chain history are preserved; this is not deletion.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`status-pill ${statusPillClass}`}>Status: {statusText}</span>
        <span className="status-pill status-off">Authority: {pool ? shortAddress(pool.authority) : "Unknown"}</span>
        <span className="status-pill status-off">Wallet: {connected ? shortAddress(walletAddress) : "Not connected"}</span>
      </div>

      {pool ? (
        isAuthority ? (
          <div className="flex flex-wrap gap-2">
            {isClosed ? (
              <button
                type="button"
                className="action-button"
                onClick={() => void submitStatus(POOL_STATUS_ACTIVE, "reopen")}
                disabled={Boolean(busy)}
              >
                {busy === "reopen" ? "Reopening..." : "Reopen plan"}
              </button>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={() => void submitStatus(POOL_STATUS_CLOSED, "close")}
                disabled={Boolean(busy)}
              >
                {busy === "close" ? "Closing..." : "Close plan"}
              </button>
            )}
          </div>
        ) : (
          <p className="field-help">
            Read-only lifecycle view. Connect the pool authority wallet to close or reopen this plan.
          </p>
        )
      ) : (
        <p className="field-help">Pool account not found from current discovery set.</p>
      )}

      {loadError ? <p className="field-error">{loadError}</p> : null}

      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txSig ? (
            <a className="secondary-button inline-flex w-fit" href={toExplorerLink(txSig)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          ) : null}
        </section>
      ) : null}

      {lastUpdatedAt ? <p className="field-help">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</p> : null}
    </section>
  );
}
