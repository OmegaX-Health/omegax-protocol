// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { SearchableSelect } from "@/components/searchable-select";
import { listPools, type PoolSummary } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import type { PoolWorkspacePanel, PoolWorkspaceSection } from "@/lib/ui-capabilities";

type PoolWorkspaceLauncherProps = {
  targetSection?: PoolWorkspaceSection;
  targetPanel?: PoolWorkspacePanel;
  title?: string;
  description?: string;
  actionLabel?: string;
};

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function PoolWorkspaceLauncher({
  targetSection,
  targetPanel,
  title = "Open Existing Pool",
  description = "Use one pool-scoped dashboard for members, claims, coverage, oracle, and settings workflows.",
  actionLabel = "Open workspace",
}: PoolWorkspaceLauncherProps) {
  const { connection } = useConnection();
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [selectedPoolAddress, setSelectedPoolAddress] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextPools = await listPools({ connection, search: search || null });
      setPools(nextPools);
      if (!selectedPoolAddress && nextPools.length > 0) {
        setSelectedPoolAddress(nextPools[0]!.address);
      }
      if (selectedPoolAddress && !nextPools.some((pool) => pool.address === selectedPoolAddress)) {
        setSelectedPoolAddress(nextPools[0]?.address ?? "");
      }
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load pools.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, search, selectedPoolAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="surface-card space-y-3">
      <div className="space-y-1">
        <h2 className="step-title">{title}</h2>
        <p className="field-help">{description}</p>
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      <SearchableSelect
        label="Pool"
        value={selectedPoolAddress}
        options={pools.map((pool) => ({
          value: pool.address,
          label: `${pool.poolId} (${shortAddress(pool.address)})`,
          hint: `Org ${pool.organizationRef} | Authority ${shortAddress(pool.authority)}`,
        }))}
        onChange={setSelectedPoolAddress}
        searchValue={search}
        onSearchChange={setSearch}
        loading={loading}
        placeholder="Select pool"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh pools"}
        </button>
        {selectedPoolAddress ? (
          <Link
            href={`/pools/${selectedPoolAddress}${
              targetSection
                ? `?section=${encodeURIComponent(targetSection)}${targetPanel ? `&panel=${encodeURIComponent(targetPanel)}` : ""}`
                : ""
            }`}
            className="action-button inline-flex"
          >
            {actionLabel}
          </Link>
        ) : (
          <button type="button" className="action-button" disabled>
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
