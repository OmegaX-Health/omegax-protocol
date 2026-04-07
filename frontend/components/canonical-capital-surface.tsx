// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { SearchableSelect } from "@/components/searchable-select";
import { WalletButton } from "@/components/wallet-providers";
import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import { formatAmount, walletFixtureFor } from "@/lib/canonical-ui";
import { buildCanonicalConsoleState } from "@/lib/console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import {
  LP_QUEUE_STATUS_NONE,
  LP_QUEUE_STATUS_PENDING,
  LP_QUEUE_STATUS_PROCESSED,
  REDEMPTION_POLICY_OPEN,
  REDEMPTION_POLICY_PAUSED,
  REDEMPTION_POLICY_QUEUE_ONLY,
  shortenAddress,
  toBigIntAmount,
} from "@/lib/protocol";

const CAPITAL_PANELS = [
  { id: "capital", label: "Capital classes" },
  { id: "direct", label: "Direct liquidity" },
  { id: "queue", label: "Queue state" },
] as const;

type CapitalPanel = (typeof CAPITAL_PANELS)[number]["id"];

function describeRedemptionPolicy(policy: number): string {
  switch (policy) {
    case REDEMPTION_POLICY_OPEN:
      return "open";
    case REDEMPTION_POLICY_PAUSED:
      return "paused";
    case REDEMPTION_POLICY_QUEUE_ONLY:
    default:
      return "queue_only";
  }
}

function describeQueueStatus(status?: number): string {
  switch (status) {
    case LP_QUEUE_STATUS_PENDING:
      return "pending";
    case LP_QUEUE_STATUS_PROCESSED:
      return "processed";
    case LP_QUEUE_STATUS_NONE:
    default:
      return "clear";
  }
}

export function CanonicalCapitalSurface() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();
  const [poolSearch, setPoolSearch] = useState("");

  const consoleState = useMemo(() => buildCanonicalConsoleState(), []);
  const allPools = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools;
  const filteredPools = useMemo(() => {
    const query = poolSearch.trim().toLowerCase();
    if (!query) return allPools;
    return allPools.filter((pool) =>
      [pool.displayName, pool.poolId, pool.address, pool.strategyThesis].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [allPools, poolSearch]);

  const selectedPoolAddress = searchParams.get("pool")?.trim() ?? "";
  const selectedPool = useMemo(
    () => allPools.find((pool) => pool.address === selectedPoolAddress) ?? filteredPools[0] ?? allPools[0] ?? null,
    [allPools, filteredPools, selectedPoolAddress],
  );
  const activePanel = useMemo<CapitalPanel>(() => {
    const candidate = searchParams.get("panel");
    return candidate === "direct" || candidate === "queue" ? candidate : "capital";
  }, [searchParams]);

  const selectedCapitalView = useMemo(
    () => consoleState.capital.find((entry) => entry.liquidityPoolAddress === selectedPool?.address) ?? null,
    [consoleState.capital, selectedPool],
  );
  const selectedClasses = selectedCapitalView?.classes ?? [];
  const selectedClassAddresses = useMemo(
    () => new Set(selectedClasses.map((capitalClass) => capitalClass.capitalClass)),
    [selectedClasses],
  );
  const poolAllocations = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter((allocation) => allocation.liquidityPool === selectedPool?.address),
    [selectedPool],
  );
  const lpPositions = useMemo(
    () =>
      DEVNET_PROTOCOL_FIXTURE_STATE.lpPositions.filter((position) => selectedClassAddresses.has(position.capitalClass)),
    [selectedClassAddresses],
  );

  const walletAddress = publicKey?.toBase58() ?? "";
  const walletFixture = walletFixtureFor(walletAddress);

  const updateParams = useCallback(
    ({ pool, panel }: { pool?: string | null; panel?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (typeof pool !== "undefined") {
        if (pool) params.set("pool", pool);
        else params.delete("pool");
      }
      if (typeof panel !== "undefined") {
        if (panel) params.set("panel", panel);
        else params.delete("panel");
      }
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!selectedPool?.address) return;
    if (selectedPool.address !== selectedPoolAddress) {
      updateParams({ pool: selectedPool.address });
    }
  }, [selectedPool, selectedPoolAddress, updateParams]);

  return (
    <section className="protocol-section">
      <div className="protocol-section-head">
        <div>
          <p className="protocol-kicker">Canonical capital surface</p>
          <h2 className="protocol-section-title">Liquidity pools now open on the canonical route with `pool` and `panel` deep links.</h2>
        </div>
        <span className="status-pill status-off">Devnet preview</span>
      </div>

      <div className="protocol-workspace-panel space-y-4">
        <div className="protocol-grid-2">
          <SearchableSelect
            label="Liquidity pool"
            value={selectedPool?.address ?? ""}
            options={filteredPools.map((pool) => ({
              value: pool.address,
              label: `${pool.displayName} (${pool.poolId})`,
              hint: `${shortenAddress(pool.depositAssetMint)} // ${describeRedemptionPolicy(pool.redemptionPolicy)}`,
            }))}
            onChange={(value) => updateParams({ pool: value })}
            searchValue={poolSearch}
            onSearchChange={setPoolSearch}
            placeholder="Choose canonical pool"
            emptyMessage="No devnet pools match this search."
          />

          <div className="protocol-data-card">
            <p className="protocol-metric-label">Operator posture</p>
            <div className="protocol-data-list">
              <div className="protocol-data-row">
                <span>Connected wallet</span>
                <span className="protocol-address">{connected ? shortenAddress(walletAddress, 6) : "observer"}</span>
              </div>
              <div className="protocol-data-row">
                <span>Recognized role</span>
                <span className="protocol-meta">{walletFixture?.label ?? (connected ? "Unmapped wallet" : "Wallet offline")}</span>
              </div>
              <div className="protocol-data-row">
                <span>Canonical route</span>
                <span className="protocol-address">
                  {selectedPool ? `${pathname}?pool=${selectedPool.address}&panel=${activePanel}` : pathname}
                </span>
              </div>
            </div>
            {!connected ? <WalletButton className="wallet-button-compact mt-3" /> : null}
          </div>
        </div>

        <div className="protocol-route-tabs">
          {CAPITAL_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`segment-button ${activePanel === panel.id ? "segment-button-active" : ""}`}
              onClick={() => updateParams({ panel: panel.id })}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {selectedPool ? (
          <div className="protocol-grid-2">
            <div className="protocol-data-card">
              <p className="protocol-metric-label">Pool signal</p>
              <div className="protocol-data-list">
                <div className="protocol-data-row">
                  <span>Deposit rail</span>
                  <strong>{shortenAddress(selectedPool.depositAssetMint, 6)}</strong>
                </div>
                <div className="protocol-data-row">
                  <span>Capital classes</span>
                  <strong>{selectedClasses.length}</strong>
                </div>
                <div className="protocol-data-row">
                  <span>Allocation links</span>
                  <strong>{poolAllocations.length}</strong>
                </div>
                <div className="protocol-data-row">
                  <span>Queue state</span>
                  <strong>{lpPositions.some((position) => toBigIntAmount(position.pendingRedemptionShares) > 0n) ? "pending" : "clear"}</strong>
                </div>
              </div>
              <p className="protocol-section-copy">{selectedPool.strategyThesis}</p>
            </div>

            <div className="protocol-data-card">
              <p className="protocol-metric-label">Cross-route links</p>
              <div className="protocol-actions">
                <Link className="secondary-button" href={buildCanonicalPoolHref(selectedPool.address, { section: "claims" })}>
                  Claims
                </Link>
                <Link className="secondary-button" href={buildCanonicalPoolHref(selectedPool.address, { section: "members" })}>
                  Members
                </Link>
                <Link className="secondary-button" href={buildCanonicalPoolHref(selectedPool.address, { section: "oracles", panel: "policy" })}>
                  Oracle policy
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {activePanel === "capital" && selectedPool ? (
          <div className="protocol-data-list">
            {selectedClasses.map((capitalClass) => {
              const classLpPositions = lpPositions.filter((position) => position.capitalClass === capitalClass.capitalClass);
              const classAllocations = poolAllocations.filter((allocation) => allocation.capitalClass === capitalClass.capitalClass);
              const queueState = classLpPositions.some((position) => toBigIntAmount(position.pendingRedemptionShares) > 0n) ? "pending" : "clear";

              return (
                <article key={capitalClass.capitalClass} className="protocol-data-card">
                  <div className="protocol-data-row">
                    <div>
                      <p className="protocol-metric-label">{capitalClass.restriction}</p>
                      <h3 className="text-xl font-semibold">{capitalClass.classId}</h3>
                      <p className="protocol-address">{shortenAddress(capitalClass.capitalClass, 8)}</p>
                    </div>
                    <span className="status-pill status-ok">{classLpPositions.length} LP positions</span>
                  </div>
                  <div className="protocol-data-list">
                    <div className="protocol-data-row">
                      <span>Restriction</span>
                      <strong>{capitalClass.restriction}</strong>
                    </div>
                    <div className="protocol-data-row">
                      <span>Allocation links</span>
                      <strong>{classAllocations.length}</strong>
                    </div>
                    <div className="protocol-data-row">
                      <span>Queue state</span>
                      <strong>{queueState}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {activePanel === "direct" && selectedPool ? (
          <div className="protocol-data-list">
            {poolAllocations.map((allocation) => (
              <article key={allocation.address} className="protocol-data-card">
                <div className="protocol-data-row">
                  <div>
                    <p className="protocol-metric-label">Allocation position</p>
                    <h3 className="text-xl font-semibold">{shortenAddress(allocation.fundingLine, 8)}</h3>
                    <p className="protocol-address">{shortenAddress(allocation.capitalClass, 8)} // {allocation.weightBps} bps</p>
                  </div>
                  <span className="status-pill status-off">{allocation.weightBps} bps</span>
                </div>
                <div className="protocol-data-list">
                  <div className="protocol-data-row">
                    <span>Funding line</span>
                    <strong>{shortenAddress(allocation.fundingLine, 8)}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Capital class</span>
                    <strong>{shortenAddress(allocation.capitalClass, 8)}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Weight</span>
                    <strong>{allocation.weightBps} bps</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activePanel === "queue" && selectedPool ? (
          <div className="protocol-data-list">
            <article className="protocol-data-card">
              <p className="protocol-metric-label">Queue operator note</p>
              <p className="protocol-section-copy">
                Queue-only redemptions stay explicit on the capital route. Pool sentiment, impairment state, and LP
                exits remain visible before they hit settlement.
              </p>
            </article>
            {lpPositions.map((position) => (
              <article key={position.address} className="protocol-data-card">
                <div className="protocol-data-row">
                  <div>
                    <p className="protocol-metric-label">LP position</p>
                    <h3 className="text-xl font-semibold">{shortenAddress(position.owner, 8)}</h3>
                    <p className="protocol-address">{shortenAddress(position.capitalClass, 8)}</p>
                  </div>
                  <span className={`status-pill ${position.pendingRedemptionShares ? "status-off" : "status-ok"}`}>
                    {describeQueueStatus(position.queueStatus)}
                  </span>
                </div>
                <div className="protocol-data-list">
                  <div className="protocol-data-row">
                    <span>Shares</span>
                    <strong>{formatAmount(position.shares)}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Pending redemption</span>
                    <strong>{formatAmount(position.pendingRedemptionShares)}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Capital class</span>
                    <strong>{shortenAddress(position.capitalClass, 8)}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
