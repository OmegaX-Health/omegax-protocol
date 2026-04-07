// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { SearchableSelect } from "@/components/searchable-select";
import { WalletButton } from "@/components/wallet-providers";
import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import { poolAddressForSeries, seriesForPool, walletFixtureFor } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { describeSeriesMode, shortenAddress } from "@/lib/protocol";

const ORACLE_PANELS = [
  { id: "registry", label: "Registry" },
  { id: "staking", label: "Staking access" },
  { id: "policy", label: "Policy bindings" },
] as const;

type OraclePanel = (typeof ORACLE_PANELS)[number]["id"];

export function CanonicalOraclesSurface() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();
  const [poolSearch, setPoolSearch] = useState("");

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
  const selectedPoolAddress = searchParams.get("pool")?.trim() ?? filteredPools[0]?.address ?? "";
  const selectedPool = useMemo(
    () => allPools.find((pool) => pool.address === selectedPoolAddress) ?? filteredPools[0] ?? allPools[0] ?? null,
    [allPools, filteredPools, selectedPoolAddress],
  );
  const activePanel = useMemo<OraclePanel>(() => {
    const candidate = searchParams.get("panel");
    return candidate === "staking" || candidate === "policy" ? candidate : "registry";
  }, [searchParams]);
  const walletFixture = walletFixtureFor(publicKey?.toBase58());
  const operatorWallets = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.wallets.filter((wallet) => wallet.role === "oracle_operator" || wallet.role === "claims_operator"),
    [],
  );
  const boundSeries = useMemo(() => seriesForPool(selectedPool?.address), [selectedPool]);

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
          <p className="protocol-kicker">Verification console</p>
          <h2 className="protocol-section-title">Oracle posture, staking access, and policy bindings stay public on the canonical route.</h2>
        </div>
        <span className={`status-pill ${connected ? "status-ok" : "status-off"}`}>
          {walletFixture?.label ?? (connected ? "Connected wallet" : "Devnet preview")}
        </span>
      </div>

      <div className="protocol-workspace-panel space-y-4">
        <div className="protocol-grid-2">
          <SearchableSelect
            label="Pool context"
            value={selectedPool?.address ?? ""}
            options={filteredPools.map((pool) => ({
              value: pool.address,
              label: `${pool.displayName} (${pool.poolId})`,
              hint: pool.strategyThesis,
            }))}
            onChange={(value) => updateParams({ pool: value })}
            searchValue={poolSearch}
            onSearchChange={setPoolSearch}
            placeholder="Choose pool context"
          />

          <div className="protocol-data-card">
            <p className="protocol-metric-label">Oracle boundary</p>
            <div className="protocol-data-list">
              <div className="protocol-data-row">
                <span>Selected pool</span>
                <span className="protocol-address">{selectedPool ? shortenAddress(selectedPool.address, 6) : "none"}</span>
              </div>
              <div className="protocol-data-row">
                <span>Bound policy series</span>
                <span className="protocol-meta">{boundSeries.length}</span>
              </div>
              <div className="protocol-data-row">
                <span>Settlement-linked lanes</span>
                <strong>{boundSeries.length}</strong>
              </div>
            </div>
            {!connected ? <WalletButton className="wallet-button-compact mt-3" /> : null}
          </div>
        </div>

        <div className="protocol-route-tabs">
          {ORACLE_PANELS.map((panel) => (
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

        {activePanel === "registry" ? (
          <div className="protocol-data-list">
            {operatorWallets.map((wallet) => {
              const actions = DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.find((row) => row.role === wallet.role)?.actions ?? [];
              return (
                <article key={wallet.address} className="protocol-data-card">
                  <div className="protocol-data-row">
                    <div>
                      <p className="protocol-metric-label">{wallet.role}</p>
                      <h3 className="text-xl font-semibold">{wallet.label}</h3>
                      <p className="protocol-address">{shortenAddress(wallet.address, 8)}</p>
                  </div>
                  <span className={`status-pill ${publicKey?.toBase58() === wallet.address ? "status-ok" : "status-off"}`}>
                      {publicKey?.toBase58() === wallet.address ? "connected" : "devnet"}
                  </span>
                </div>
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                      <span key={action} className="status-pill status-off">{action}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {activePanel === "staking" ? (
          <div className="protocol-grid-2">
            <div className="protocol-data-card">
              <p className="protocol-metric-label">Access checklist</p>
              <div className="protocol-data-list">
                <div className="protocol-data-row">
                  <span>Role gate</span>
                  <span className="protocol-meta">oracle_operator</span>
                </div>
                <div className="protocol-data-row">
                  <span>Scope</span>
                  <span className="protocol-meta">{selectedPool?.poolId ?? "Global"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Schema coverage</span>
                  <span className="protocol-meta">{boundSeries.length} series lanes</span>
                </div>
              </div>
            </div>

            <div className="protocol-data-card">
              <p className="protocol-metric-label">Finality note</p>
              <p className="protocol-section-copy">
                Oracle participation should be able to delay final settlement when evidence integrity is in doubt, but
                it should not create broad spending rights. Pool context only scopes where attestations matter.
              </p>
              <Link className="secondary-button mt-3 inline-flex" href={selectedPool ? buildCanonicalPoolHref(selectedPool.address, { section: "claims" }) : "/claims"}>
                Review claims impact
              </Link>
            </div>
          </div>
        ) : null}

        {activePanel === "policy" ? (
          <div className="protocol-data-list">
            {boundSeries.map((series) => (
              <article key={series.address} className="protocol-data-card">
                <div className="protocol-data-row">
                  <div>
                    <p className="protocol-metric-label">{describeSeriesMode(series.mode)}</p>
                    <h3 className="text-xl font-semibold">{series.displayName}</h3>
                    <p className="protocol-address">{shortenAddress(series.address, 8)}</p>
                  </div>
                  <span className="status-pill status-ok">{series.termsVersion}</span>
                </div>
                <div className="protocol-data-list">
                  <div className="protocol-data-row">
                    <span>Comparability key</span>
                    <span className="protocol-meta">{series.comparabilityKey}</span>
                  </div>
                  <div className="protocol-data-row">
                    <span>Linked pool</span>
                    <span className="protocol-address">{shortenAddress(poolAddressForSeries(series.address) ?? "", 6)}</span>
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
