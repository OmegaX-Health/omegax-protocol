// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchableSelect } from "@/components/searchable-select";
import { WorkbenchEmptyState, WorkbenchRailCard, WorkbenchTabs } from "@/components/workbench-ui";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { buildCanonicalConsoleState } from "@/lib/console-model";
import { formatAmount } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import {
  buildAuditTrail,
  CAPITAL_TABS,
  defaultTabForPersona,
  linkedContextForPool,
  type CapitalTabId,
} from "@/lib/workbench";
import {
  describeCapitalRestriction,
  describeLpQueueStatus,
  hasPendingRedemptionQueue,
  shortenAddress,
} from "@/lib/protocol";

function describeRedemptionPolicyInline(queueOnly?: boolean) {
  return queueOnly ? "queue_only" : "open";
}

export function CapitalWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { effectivePersona } = useWorkspacePersona();
  const consoleState = useMemo(() => buildCanonicalConsoleState(), []);
  const [poolSearch, setPoolSearch] = useState("");

  const requestedTab = searchParams.get("tab");
  const activeTab = (CAPITAL_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("capital", effectivePersona)) as CapitalTabId;

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
  const matchedPool = useMemo(() => allPools.find((pool) => pool.address === queryPool) ?? null, [allPools, queryPool]);
  const hasInvalidPool = Boolean(queryPool) && !matchedPool;
  const selectedPool = useMemo(() => {
    if (hasInvalidPool) return null;
    return matchedPool ?? filteredPools[0] ?? allPools[0] ?? null;
  }, [allPools, filteredPools, hasInvalidPool, matchedPool]);
  const poolClasses = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.filter((capitalClass) => capitalClass.liquidityPool === selectedPool?.address),
    [selectedPool],
  );
  const queryClass = searchParams.get("class")?.trim() ?? "";
  const matchedClass = useMemo(() => poolClasses.find((capitalClass) => capitalClass.address === queryClass) ?? null, [poolClasses, queryClass]);
  const hasInvalidClass = Boolean(queryClass) && !matchedClass;
  const selectedClass = useMemo(() => {
    if (hasInvalidClass) return null;
    return matchedClass ?? poolClasses[0] ?? null;
  }, [hasInvalidClass, matchedClass, poolClasses]);
  const capitalView = useMemo(
    () => consoleState.capital.find((entry) => entry.liquidityPoolAddress === selectedPool?.address) ?? null,
    [consoleState.capital, selectedPool],
  );
  const poolAllocations = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter((allocation) => allocation.liquidityPool === selectedPool?.address),
    [selectedPool],
  );
  const queueRows = useMemo(() => {
    const classAddresses = new Set(poolClasses.map((capitalClass) => capitalClass.address));
    return DEVNET_PROTOCOL_FIXTURE_STATE.lpPositions.filter(
      (position) => classAddresses.has(position.capitalClass) && hasPendingRedemptionQueue(position),
    );
  }, [poolClasses]);

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
    if (hasInvalidPool || hasInvalidClass) return;
    const nextUpdates: Record<string, string> = {};
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedPool && queryPool !== selectedPool.address) nextUpdates.pool = selectedPool.address;
    if (selectedClass && queryClass !== selectedClass.address) nextUpdates.class = selectedClass.address;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, hasInvalidClass, hasInvalidPool, queryClass, queryPool, requestedTab, selectedClass, selectedPool, updateParams]);

  const linkedPlanContext = linkedContextForPool(selectedPool?.address);
  const linkedPlans = useMemo(() => {
    const ids = new Set(poolAllocations.map((allocation) => allocation.healthPlan));
    return DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.filter((plan) => ids.has(plan.address));
  }, [poolAllocations]);
  const auditTrail = useMemo(
    () => buildAuditTrail({
      section: "capital",
      poolAddress: selectedPool?.address,
      classAddress: selectedClass?.address,
    }),
    [selectedClass, selectedPool],
  );
  const selectionToolbar = (
    <div className="workbench-toolbar workbench-toolbar-compact">
      <SearchableSelect
        label="Liquidity pool"
        value={selectedPool?.address ?? ""}
        options={filteredPools.map((pool) => ({
          value: pool.address,
          label: `${pool.displayName} (${pool.poolId})`,
          hint: pool.strategyThesis,
        }))}
        onChange={(value) => updateParams({ pool: value, class: null })}
        searchValue={poolSearch}
        onSearchChange={setPoolSearch}
        placeholder="Choose pool"
        error={hasInvalidPool ? "Requested liquidity pool was not found in the current fixture set." : null}
        showOptionCount={false}
        showSelectedHint={false}
      />

      <SearchableSelect
        label="Capital class"
        value={selectedClass?.address ?? ""}
        options={poolClasses.map((capitalClass) => ({
          value: capitalClass.address,
          label: `${capitalClass.displayName} (${capitalClass.classId})`,
          hint: `${describeCapitalRestriction(capitalClass.restrictionMode)} // priority ${capitalClass.priority}`,
        }))}
        onChange={(value) => updateParams({ class: value })}
        searchValue=""
        onSearchChange={() => {}}
        placeholder="Choose capital class"
        disabled={!selectedPool}
        disabledHint="Choose a valid liquidity pool before selecting a capital class."
        error={hasInvalidClass ? "Requested capital class is not linked to the selected pool." : null}
        emptyMessage="No capital classes are linked to this pool."
        showOptionCount={false}
        showSelectedHint={false}
      />
    </div>
  );
  const invalidSelection = hasInvalidPool
    ? {
        title: "Pool not found",
        copy: "The requested liquidity pool is not present in the current fixture set. Choose another pool to continue.",
      }
    : hasInvalidClass
      ? {
          title: "Capital class not found",
          copy: "The requested capital class is not linked to the selected pool. Choose another class or clear the class filter.",
        }
      : null;

  if (invalidSelection) {
    return (
      <div className="workbench-page">
        <section className="workbench-main-column">
          {selectionToolbar}

          <section className="workbench-panel heavy-glass brackets workbench-primary-surface">
            <div className="workbench-panel-head">
              <div>
                <p className="workbench-panel-eyebrow">Capital workspace</p>
                <h2 className="workbench-panel-title">{invalidSelection.title}</h2>
                <p className="workbench-body-copy">This deep link does not match the current visible capital context.</p>
              </div>
              <span className="workbench-card-meta">INVALID</span>
            </div>

            <WorkbenchEmptyState title={invalidSelection.title} copy={invalidSelection.copy} />
          </section>
        </section>

        <aside className="workbench-rail">
          <WorkbenchRailCard title="Selection status" meta="INVALID">
            <WorkbenchEmptyState title={invalidSelection.title} copy="Use the selectors above to restore a valid capital view." />
          </WorkbenchRailCard>
        </aside>
      </div>
    );
  }

  return (
    <div className="workbench-page">
      <section className="workbench-main-column">
        {selectionToolbar}

        <section className="workbench-panel heavy-glass brackets workbench-primary-surface">
          <div className="workbench-panel-head">
            <div>
              <p className="workbench-panel-eyebrow">Selected pool</p>
              <h2 className="workbench-panel-title">{selectedPool?.displayName ?? "Awaiting pool selection"}</h2>
              <p className="workbench-body-copy">{selectedPool?.strategyThesis ?? "Choose a pool to inspect class posture and queue controls."}</p>
            </div>
            {selectedClass ? <span className="workbench-card-meta">{selectedClass.classId}</span> : null}
          </div>

          <div className="workbench-summary-strip">
            <div className="workbench-summary-metric">
              <span>Pool TVL</span>
              <strong>{formatAmount(selectedPool?.totalValueLocked ?? 0)}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Capital classes</span>
              <strong>{poolClasses.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Allocations</span>
              <strong>{poolAllocations.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Queue records</span>
              <strong>{queueRows.length}</strong>
            </div>
          </div>

          <WorkbenchTabs tabs={CAPITAL_TABS} active={activeTab} onChange={(tab) => updateParams({ tab })} />

          {activeTab === "overview" ? (
            <div className="workbench-content-split">
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Pool overview</p>
                    <h2 className="workbench-panel-title">{selectedPool?.displayName ?? "Awaiting pool selection"}</h2>
                  </div>
                  {selectedPool ? <span className="workbench-card-meta">{selectedPool.poolId}</span> : null}
                </div>
                <p className="workbench-body-copy">
                  {selectedPool?.strategyThesis ?? "Choose a pool to inspect the current capital posture."}
                </p>
                <div className="workbench-data-list">
                  <div className="workbench-data-row">
                    <span>Total allocated</span>
                    <strong>{formatAmount(selectedPool?.totalAllocated ?? 0)}</strong>
                  </div>
                  <div className="workbench-data-row">
                    <span>Pending redemptions</span>
                    <strong>{formatAmount(selectedPool?.totalPendingRedemptions ?? 0)}</strong>
                  </div>
                  <div className="workbench-data-row">
                    <span>Linked plans</span>
                    <strong>{linkedPlans.length}</strong>
                  </div>
                </div>
                {linkedPlanContext.plan ? (
                  <Link href={`/plans?plan=${encodeURIComponent(linkedPlanContext.plan)}&series=${encodeURIComponent(linkedPlanContext.series ?? "")}&tab=funding`} className="workbench-inline-link">
                    Open linked plan funding
                  </Link>
                ) : null}
              </div>

              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Class register</p>
                    <h2 className="workbench-panel-title">Classes remain inside the selected pool context.</h2>
                  </div>
                </div>
                <div className="workbench-list">
                  {poolClasses.map((capitalClass) => (
                    <button
                      key={capitalClass.address}
                      type="button"
                      className={`workbench-list-row ${selectedClass?.address === capitalClass.address ? "workbench-list-row-active" : ""}`}
                      onClick={() => updateParams({ class: capitalClass.address, tab: "classes" })}
                    >
                      <div>
                        <strong>{capitalClass.displayName}</strong>
                        <p>{describeCapitalRestriction(capitalClass.restrictionMode)}</p>
                      </div>
                      <div className="workbench-list-row-meta">
                        <span>{formatAmount(capitalClass.navAssets)} NAV</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "classes" ? (
            poolClasses.length > 0 ? (
              <div className="workbench-table-card">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Restriction</th>
                      <th>NAV</th>
                      <th>Pending</th>
                      <th>Lockup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolClasses.map((capitalClass) => (
                      <tr key={capitalClass.address}>
                        <td data-label="Class">
                          <button type="button" className="workbench-inline-button" onClick={() => updateParams({ class: capitalClass.address })}>
                            {capitalClass.displayName}
                          </button>
                        </td>
                        <td data-label="Restriction">{describeCapitalRestriction(capitalClass.restrictionMode)}</td>
                        <td data-label="NAV">{formatAmount(capitalClass.navAssets)}</td>
                        <td data-label="Pending">{formatAmount(capitalClass.pendingRedemptions)}</td>
                        <td data-label="Lockup">{capitalClass.minLockupSeconds ? `${Math.round(capitalClass.minLockupSeconds / 86400)}d` : "n/a"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <WorkbenchEmptyState title="No capital classes" copy="Choose another pool or provision a class before continuing." />
            )
          ) : null}

          {activeTab === "allocations" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Series</th>
                    <th>Class</th>
                    <th>Allocated</th>
                    <th>Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {poolAllocations.map((allocation) => {
                    const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((entry) => entry.address === allocation.healthPlan);
                    const series = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((entry) => entry.address === allocation.policySeries);
                    const capitalClass = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.find((entry) => entry.address === allocation.capitalClass);
                    return (
                      <tr key={allocation.address}>
                        <td data-label="Plan">{plan?.displayName ?? shortenAddress(allocation.healthPlan, 6)}</td>
                        <td data-label="Series">{series?.displayName ?? "Pool-wide"}</td>
                        <td data-label="Class">{capitalClass?.classId ?? shortenAddress(allocation.capitalClass, 6)}</td>
                        <td data-label="Allocated">{formatAmount(allocation.allocatedAmount)}</td>
                        <td data-label="Reserved">{formatAmount(allocation.reservedCapacity)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "queue" ? (
            queueRows.length > 0 ? (
              <div className="workbench-table-card">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>Class</th>
                      <th>Shares</th>
                      <th>Pending redemption</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueRows.map((position) => {
                      const capitalClass = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.find((entry) => entry.address === position.capitalClass);
                      return (
                        <tr key={position.address}>
                          <td data-label="Owner">{shortenAddress(position.owner, 6)}</td>
                          <td data-label="Class">{capitalClass?.displayName ?? shortenAddress(position.capitalClass, 6)}</td>
                          <td data-label="Shares">{formatAmount(position.shares)}</td>
                          <td data-label="Pending redemption">{formatAmount(position.pendingRedemptionShares)}</td>
                          <td data-label="Status">{describeLpQueueStatus(position)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <WorkbenchEmptyState title="No queue records" copy="No LP positions currently need redemption queue review." />
            )
          ) : null}

          {activeTab === "linked-plans" ? (
            linkedPlans.length > 0 ? (
              <div className="workbench-table-card">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Plan id</th>
                      <th>Series lanes</th>
                      <th>Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedPlans.map((plan) => (
                      <tr key={plan.address}>
                        <td data-label="Plan">{plan.displayName}</td>
                        <td data-label="Plan id">{plan.planId}</td>
                        <td data-label="Series lanes">{DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => series.healthPlan === plan.address).length}</td>
                        <td data-label="Open">
                          <Link href={`/plans?plan=${encodeURIComponent(plan.address)}&tab=overview`} className="workbench-inline-link">
                            Open plan
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <WorkbenchEmptyState title="No linked plans" copy="This pool does not currently fund any plan lanes." />
            )
          ) : null}
        </section>
      </section>

      <aside className="workbench-rail">
        <WorkbenchRailCard title="Pool health" meta="POOL">
          <div className="workbench-stack">
            <strong>{selectedPool?.displayName ?? "Awaiting selection"}</strong>
            <p>{selectedPool?.strategyThesis ?? "Choose a pool to inspect live capital posture."}</p>
            <div className="workbench-mini-stat">
              <span>Total NAV</span>
              <strong>{formatAmount(capitalView?.totalNav ?? 0)}</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Unallocated</span>
              <strong>{formatAmount(capitalView?.totalUnallocated ?? 0)}</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Redemption policy</span>
              <strong>{describeRedemptionPolicyInline(selectedClass?.queueOnlyRedemptions)}</strong>
            </div>
          </div>
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Selected class" meta="CLASS">
          {selectedClass ? (
            <div className="workbench-stack">
              <strong>{selectedClass.displayName}</strong>
              <div className="workbench-mini-stat">
                <span>Restriction</span>
                <strong>{describeCapitalRestriction(selectedClass.restrictionMode)}</strong>
              </div>
              <div className="workbench-mini-stat">
                <span>Allocated assets</span>
                <strong>{formatAmount(selectedClass.allocatedAssets)}</strong>
              </div>
              <div className="workbench-mini-stat">
                <span>Pending redemptions</span>
                <strong>{formatAmount(selectedClass.pendingRedemptions)}</strong>
              </div>
            </div>
          ) : (
            <WorkbenchEmptyState title="No class selected" copy="Choose a capital class to inspect class posture." />
          )}
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Recent capital events" meta="AUDIT">
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
