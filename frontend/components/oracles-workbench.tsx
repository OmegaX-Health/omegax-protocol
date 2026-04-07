// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchableSelect } from "@/components/searchable-select";
import { WorkbenchEmptyState, WorkbenchRailCard, WorkbenchTabs } from "@/components/workbench-ui";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { formatAmount, seriesForPool } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { buildAuditTrail, defaultTabForPersona, ORACLE_TABS, type OracleTabId } from "@/lib/workbench";
import { describeClaimStatus, describeSeriesMode, shortenAddress } from "@/lib/protocol";

type OracleAttestation = {
  id: string;
  series: string;
  operator: string;
  status: string;
  reference: string;
};

export function OraclesWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { effectivePersona } = useWorkspacePersona();
  const auditTrail = useMemo(() => buildAuditTrail(), []);
  const [poolSearch, setPoolSearch] = useState("");

  const requestedTab = searchParams.get("tab");
  const activeTab = (ORACLE_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("oracles", effectivePersona)) as OracleTabId;

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

  const queryPool = searchParams.get("pool")?.trim() ?? "";
  const selectedPool = useMemo(
    () => allPools.find((pool) => pool.address === queryPool) ?? filteredPools[0] ?? allPools[0] ?? null,
    [allPools, filteredPools, queryPool],
  );
  const boundSeries = useMemo(() => seriesForPool(selectedPool?.address), [selectedPool]);
  const querySeries = searchParams.get("series")?.trim() ?? "";
  const selectedSeries = useMemo(
    () => boundSeries.find((series) => series.address === querySeries) ?? boundSeries[0] ?? null,
    [boundSeries, querySeries],
  );

  const operatorWallets = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.filter(
    (wallet) => wallet.role === "oracle_operator" || wallet.role === "claims_operator",
  );
  const attestations = useMemo<OracleAttestation[]>(() => {
    return DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.slice(0, 4).map((claim, index) => {
      const series = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((entry) => entry.address === claim.policySeries);
      const operator = operatorWallets[index % operatorWallets.length];
      return {
        id: claim.address,
        series: series?.displayName ?? claim.claimId,
        operator: operator?.label ?? "Oracle operator",
        status: describeClaimStatus(claim.intakeStatus),
        reference: claim.claimId,
      };
    });
  }, [operatorWallets]);

  const disputes = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) => obligation.impairedAmount || obligation.reservedAmount);

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const nextUpdates: Record<string, string> = {};
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedPool && queryPool !== selectedPool.address) nextUpdates.pool = selectedPool.address;
    if (selectedSeries && querySeries !== selectedSeries.address) nextUpdates.series = selectedSeries.address;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, queryPool, querySeries, requestedTab, selectedPool, selectedSeries, updateParams]);

  return (
    <div className="workbench-page">
      <section className="workbench-main-column">
        <div className="workbench-toolbar workbench-toolbar-compact">
          <SearchableSelect
            label="Pool context"
            value={selectedPool?.address ?? ""}
            options={filteredPools.map((pool) => ({
              value: pool.address,
              label: `${pool.displayName} (${pool.poolId})`,
              hint: pool.strategyThesis,
            }))}
            onChange={(value) => updateParams({ pool: value, series: null })}
            searchValue={poolSearch}
            onSearchChange={setPoolSearch}
            placeholder="Choose pool"
            showOptionCount={false}
            showSelectedHint={false}
          />

          <SearchableSelect
            label="Policy series"
            value={selectedSeries?.address ?? ""}
            options={boundSeries.map((series) => ({
              value: series.address,
              label: `${series.displayName} (${series.seriesId})`,
              hint: `${series.termsVersion} // ${describeSeriesMode(series.mode)}`,
            }))}
            onChange={(value) => updateParams({ series: value })}
            searchValue=""
            onSearchChange={() => {}}
            placeholder="Choose series"
            emptyMessage="No bound series are linked to this pool."
            showOptionCount={false}
            showSelectedHint={false}
          />
        </div>

        <section className="workbench-panel heavy-glass brackets workbench-primary-surface">
          <div className="workbench-panel-head">
            <div>
              <p className="workbench-panel-eyebrow">Verification lane</p>
              <h2 className="workbench-panel-title">{selectedPool?.displayName ?? "Awaiting pool selection"}</h2>
              <p className="workbench-body-copy">Operators can attest, dispute, and delay finality, but they do not move protocol funds.</p>
            </div>
            {selectedSeries ? <span className="workbench-card-meta">{selectedSeries.termsVersion}</span> : null}
          </div>

          <div className="workbench-summary-strip">
            <div className="workbench-summary-metric">
              <span>Operator wallets</span>
              <strong>{operatorWallets.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Bound series</span>
              <strong>{boundSeries.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Attestations</span>
              <strong>{attestations.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Disputes</span>
              <strong>{disputes.length}</strong>
            </div>
          </div>

          <WorkbenchTabs tabs={ORACLE_TABS} active={activeTab} onChange={(tab) => updateParams({ tab })} />

          {activeTab === "registry" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Operator</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {operatorWallets.map((wallet) => (
                    <tr key={wallet.address}>
                      <td>{wallet.role}</td>
                      <td>{wallet.label}</td>
                      <td>{shortenAddress(wallet.address, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "bindings" ? (
            boundSeries.length > 0 ? (
              <div className="workbench-table-card">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Series</th>
                      <th>Mode</th>
                      <th>Version</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boundSeries.map((series) => (
                      <tr key={series.address}>
                        <td>{series.displayName}</td>
                        <td>{describeSeriesMode(series.mode)}</td>
                        <td>{series.termsVersion}</td>
                        <td>{shortenAddress(series.address, 8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <WorkbenchEmptyState title="No oracle bindings" copy="This pool does not currently bind any policy series." />
            )
          ) : null}

          {activeTab === "attestations" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Series</th>
                    <th>Operator</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {attestations.map((attestation) => (
                    <tr key={attestation.id}>
                      <td>{attestation.series}</td>
                      <td>{attestation.operator}</td>
                      <td>{attestation.status}</td>
                      <td>{attestation.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "disputes" ? (
            disputes.length > 0 ? (
              <div className="workbench-table-card">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Obligation</th>
                      <th>Reserved</th>
                      <th>Impaired</th>
                      <th>Series</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disputes.map((obligation) => {
                      const series = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((entry) => entry.address === obligation.policySeries);
                      return (
                        <tr key={obligation.address}>
                          <td>{obligation.obligationId}</td>
                          <td>{formatAmount(obligation.reservedAmount)}</td>
                          <td>{formatAmount(obligation.impairedAmount)}</td>
                          <td>{series?.displayName ?? "Pool-wide"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <WorkbenchEmptyState title="No disputes" copy="No current obligations are flagged as dispute or impairment-sensitive." />
            )
          ) : null}

          {activeTab === "staking" ? (
            <div className="workbench-content-split">
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Access posture</p>
                    <h2 className="workbench-panel-title">Oracle operators stay scoped to evidence and finality lanes.</h2>
                  </div>
                </div>
                <p className="workbench-body-copy">
                  Connected operators should hold attestation rights without acquiring broad treasury or payout powers.
                </p>
              </div>
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Coverage</p>
                    <h2 className="workbench-panel-title">{boundSeries.length} bound series across {allPools.length} visible pools.</h2>
                  </div>
                </div>
                <p className="workbench-body-copy">
                  Each binding keeps the series context visible to claims and capital operators on the same workbench shell.
                </p>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <aside className="workbench-rail">
        <WorkbenchRailCard title="Selected binding" meta="SERIES">
          {selectedSeries ? (
            <div className="workbench-stack">
              <strong>{selectedSeries.displayName}</strong>
              <p>{selectedSeries.comparabilityKey}</p>
              <div className="workbench-mini-stat">
                <span>Terms version</span>
                <strong>{selectedSeries.termsVersion}</strong>
              </div>
              <div className="workbench-mini-stat">
                <span>Series address</span>
                <strong>{shortenAddress(selectedSeries.address, 8)}</strong>
              </div>
            </div>
          ) : (
            <WorkbenchEmptyState title="No series selected" copy="Choose a bound series to inspect the current oracle context." />
          )}
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Attestation feed" meta="LIVE">
          <div className="workbench-stack">
            {attestations.slice(0, 3).map((attestation) => (
              <div key={attestation.id} className="workbench-mini-stat">
                <span>{attestation.series}</span>
                <strong>{attestation.status}</strong>
              </div>
            ))}
          </div>
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Audit trail" meta="AUDIT">
          <div className="workbench-timeline">
            {auditTrail.map((item) => (
              <article key={item.id} className={`workbench-timeline-item workbench-timeline-item-${item.tone}`}>
                <div className="workbench-timeline-head">
                  <strong>{item.label}</strong>
                  <span>{item.timestamp}</span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </WorkbenchRailCard>
      </aside>
    </div>
  );
}
