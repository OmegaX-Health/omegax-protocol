// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchableSelect } from "@/components/searchable-select";
import { WorkbenchEmptyState, WorkbenchRailCard, WorkbenchTabs } from "@/components/workbench-ui";
import { useWorkspacePersona } from "@/components/workspace-persona";
import { buildCanonicalConsoleState } from "@/lib/console-model";
import { formatAmount, seriesOutcomeCount } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE, isUnsetDevnetWalletAddress } from "@/lib/devnet-fixtures";
import {
  buildAuditTrail,
  defaultTabForPersona,
  PLAN_TABS,
  type PlanTabId,
} from "@/lib/workbench";
import {
  availableFundingLineBalance,
  describeClaimStatus,
  describeEligibilityStatus,
  describeFundingLineType,
  describeObligationStatus,
  describeSeriesMode,
  describeSeriesStatus,
  shortenAddress,
} from "@/lib/protocol";

const SERIES_OPTIONAL_TABS = new Set<PlanTabId>(["claims", "members", "schemas"]);

function formatControlLaneAddress(address?: string | null, size = 6) {
  return isUnsetDevnetWalletAddress(address) ? "Not configured" : shortenAddress(address ?? "", size);
}

function claimsEmptyCopy(selectedSeries: boolean, planHasClaims: boolean): string {
  if (!selectedSeries) return "This plan does not currently expose claim cases.";
  if (planHasClaims) return "This series filter does not contain the plan's live claims. Choose another series or clear the series filter.";
  return "This series does not currently expose claim cases.";
}

function obligationsEmptyCopy(selectedSeries: boolean, planHasObligations: boolean): string {
  if (!selectedSeries) return "This plan does not currently expose obligations.";
  if (planHasObligations) return "This series filter does not contain the plan's obligations. Choose another series or clear the series filter.";
  return "This series does not currently expose obligations.";
}

export function PlansWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { effectivePersona } = useWorkspacePersona();
  const consoleState = useMemo(() => buildCanonicalConsoleState(), []);
  const [planSearch, setPlanSearch] = useState("");
  const [seriesSearch, setSeriesSearch] = useState("");

  const requestedTab = searchParams.get("tab");
  const activeTab = (PLAN_TABS.find((tab) => tab.id === requestedTab)?.id
    ?? defaultTabForPersona("plans", effectivePersona)) as PlanTabId;

  const allPlans = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans;
  const filteredPlans = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    if (!query) return allPlans;
    return allPlans.filter((plan) =>
      [plan.displayName, plan.planId, plan.sponsorLabel, plan.address].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [allPlans, planSearch]);

  const queryPlan = searchParams.get("plan")?.trim() ?? "";
  const selectedPlan = useMemo(
    () => allPlans.find((plan) => plan.address === queryPlan) ?? filteredPlans[0] ?? allPlans[0] ?? null,
    [allPlans, filteredPlans, queryPlan],
  );

  const planSeries = useMemo(() => {
    if (!selectedPlan) return [];
    return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) => series.healthPlan === selectedPlan.address);
  }, [selectedPlan]);
  const filteredSeries = useMemo(() => {
    const query = seriesSearch.trim().toLowerCase();
    if (!query) return planSeries;
    return planSeries.filter((series) =>
      [series.displayName, series.seriesId, series.comparabilityKey, series.address].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [planSeries, seriesSearch]);
  const querySeries = searchParams.get("series")?.trim() ?? "";
  const seriesSelectionOptional = SERIES_OPTIONAL_TABS.has(activeTab);
  const selectedSeries = useMemo(
    () => {
      const explicitSeries = planSeries.find((series) => series.address === querySeries) ?? null;
      if (explicitSeries) return explicitSeries;
      if (seriesSelectionOptional) return null;
      return filteredSeries[0] ?? planSeries[0] ?? null;
    },
    [filteredSeries, planSeries, querySeries, seriesSelectionOptional],
  );

  const sponsorView = useMemo(
    () => consoleState.sponsors.find((entry) => entry.healthPlanAddress === selectedPlan?.address) ?? null,
    [consoleState.sponsors, selectedPlan],
  );
  const planFundingLines = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.filter((line) => line.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const planClaims = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter((claim) => claim.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const filteredClaims = useMemo(
    () => (selectedSeries ? planClaims.filter((claim) => claim.policySeries === selectedSeries.address) : planClaims),
    [planClaims, selectedSeries],
  );
  const planObligations = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter((obligation) => obligation.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const filteredObligations = useMemo(
    () => (selectedSeries ? planObligations.filter((obligation) => obligation.policySeries === selectedSeries.address) : planObligations),
    [planObligations, selectedSeries],
  );
  const planMembers = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.filter((position) => position.healthPlan === selectedPlan?.address),
    [selectedPlan],
  );
  const filteredMembers = useMemo(
    () => (selectedSeries ? planMembers.filter((position) => position.policySeries === selectedSeries.address) : planMembers),
    [planMembers, selectedSeries],
  );
  const auditTrail = useMemo(
    () => buildAuditTrail({
      section: "plans",
      planAddress: selectedPlan?.address,
      seriesAddress: selectedSeries?.address,
    }),
    [selectedPlan, selectedSeries],
  );

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
    const nextUpdates: Record<string, string | null> = {};
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedPlan && queryPlan !== selectedPlan.address) nextUpdates.plan = selectedPlan.address;
    if (selectedSeries && querySeries !== selectedSeries.address) nextUpdates.series = selectedSeries.address;
    if (!selectedSeries && querySeries) nextUpdates.series = null;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, queryPlan, querySeries, requestedTab, selectedPlan, selectedSeries, updateParams]);

  const planClaimCount = sponsorView?.activeClaimCount ?? 0;
  const primaryActionLabel =
    effectivePersona === "capital"
      ? "Inspect how pool allocations support this plan."
      : effectivePersona === "governance"
        ? "Review operational history before approving new controls."
        : "Manage the full plan lifecycle here.";

  return (
    <div className="workbench-page">
      <section className="workbench-main-column">
        <div className="workbench-toolbar workbench-toolbar-compact">
          <SearchableSelect
            label="Health plan"
            value={selectedPlan?.address ?? ""}
            options={filteredPlans.map((plan) => ({
              value: plan.address,
              label: `${plan.displayName} (${plan.planId})`,
              hint: `${plan.sponsorLabel} // ${plan.membershipModel}`,
            }))}
            onChange={(value) => updateParams({ plan: value, series: null })}
            searchValue={planSearch}
            onSearchChange={setPlanSearch}
            placeholder="Choose plan"
            showOptionCount={false}
            showSelectedHint={false}
          />

          <SearchableSelect
            label="Policy series"
            value={selectedSeries?.address ?? ""}
            options={filteredSeries.map((series) => ({
              value: series.address,
              label: `${series.displayName} (${series.seriesId})`,
              hint: `${series.termsVersion} // ${describeSeriesMode(series.mode)}`,
            }))}
            onChange={(value) => updateParams({ series: value })}
            searchValue={seriesSearch}
            onSearchChange={setSeriesSearch}
            placeholder="Choose series"
            emptyMessage="No policy series match this plan filter."
            showOptionCount={false}
            showSelectedHint={false}
          />
        </div>

        <section className="workbench-panel heavy-glass brackets workbench-primary-surface">
          <div className="workbench-panel-head">
            <div>
              <p className="workbench-panel-eyebrow">Selected plan</p>
              <h2 className="workbench-panel-title">{selectedPlan?.displayName ?? "Awaiting plan selection"}</h2>
              <p className="workbench-body-copy">{primaryActionLabel}</p>
            </div>
            {selectedSeries ? <span className="workbench-card-meta">{selectedSeries.termsVersion}</span> : null}
          </div>

          <div className="workbench-summary-strip">
            <div className="workbench-summary-metric">
              <span>Available sponsor budget</span>
              <strong>{formatAmount(sponsorView?.remainingSponsorBudget ?? 0)}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Series lanes</span>
              <strong>{planSeries.length}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Claims pressure</span>
              <strong>{planClaimCount}</strong>
            </div>
            <div className="workbench-summary-metric">
              <span>Funding lines</span>
              <strong>{planFundingLines.length}</strong>
            </div>
          </div>

          <WorkbenchTabs tabs={PLAN_TABS} active={activeTab} onChange={(tab) => updateParams({ tab })} />

          {activeTab === "overview" ? (
            <div className="workbench-content-split">
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Plan summary</p>
                    <h2 className="workbench-panel-title">{selectedPlan?.displayName ?? "Awaiting plan selection"}</h2>
                  </div>
                  {selectedPlan ? <span className="workbench-card-meta">{selectedPlan.planId}</span> : null}
                </div>
                <p className="workbench-body-copy">
                  {selectedPlan
                    ? `${selectedPlan.sponsorLabel} runs this plan under ${selectedPlan.membershipModel}. Claims, members, schemas, and funding remain under one plan context.`
                    : "Choose a plan to inspect overview posture."}
                </p>
                <div className="workbench-list">
                  {planSeries.map((series) => (
                    <article key={series.address} className="workbench-list-row workbench-list-row-static">
                      <div>
                        <strong>{series.displayName}</strong>
                        <p>{series.comparabilityKey}</p>
                      </div>
                      <div className="workbench-list-row-meta">
                        <span>{describeSeriesMode(series.mode)}</span>
                        <span>{describeSeriesStatus(series.status)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Series performance</p>
                    <h2 className="workbench-panel-title">Reward, protection, and claim outcomes by lane.</h2>
                  </div>
                </div>
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Series</th>
                      <th>Mode</th>
                      <th>Claims</th>
                      <th>Reserved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sponsorView?.perSeriesPerformance ?? []).map((series) => (
                      <tr key={series.policySeries}>
                        <td data-label="Series">{series.seriesId}</td>
                        <td data-label="Mode">{series.mode}</td>
                        <td data-label="Claims">{series.claimCount}</td>
                        <td data-label="Reserved">{formatAmount(series.reserved)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "series" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Series</th>
                    <th>Version</th>
                    <th>Comparability</th>
                    <th>Outcomes</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {planSeries.map((series) => (
                    <tr key={series.address}>
                      <td data-label="Series">
                        <button type="button" className="workbench-inline-button" onClick={() => updateParams({ series: series.address })}>
                          {series.displayName}
                        </button>
                      </td>
                      <td data-label="Version">{series.termsVersion}</td>
                      <td data-label="Comparability">{series.comparabilityKey}</td>
                      <td data-label="Outcomes">{formatAmount(seriesOutcomeCount(series.address))}</td>
                      <td data-label="Status">{describeSeriesStatus(series.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "members" ? (
            filteredMembers.length > 0 ? (
              <div className="workbench-table-card">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Wallet</th>
                      <th>Eligibility</th>
                      <th>Delegated rights</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr key={member.address}>
                        <td data-label="Wallet">{shortenAddress(member.wallet, 6)}</td>
                        <td data-label="Eligibility">{describeEligibilityStatus(member.eligibilityStatus)}</td>
                        <td data-label="Delegated rights">{member.delegatedRights.join(", ") || "None"}</td>
                        <td data-label="Position">{shortenAddress(member.address, 6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <WorkbenchEmptyState
                title="No member positions in this filter"
                copy={effectivePersona === "sponsor" ? "Choose another series or plan to inspect member rights." : "This plan filter does not currently expose member positions."}
              />
            )
          ) : null}

          {activeTab === "claims" ? (
            <div className="workbench-content-split">
              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Claim cases</p>
                    <h2 className="workbench-panel-title">Intake and adjudication stay attached to the plan and series lane.</h2>
                  </div>
                </div>
                {filteredClaims.length > 0 ? (
                  <table className="workbench-table">
                    <thead>
                      <tr>
                        <th>Claim</th>
                        <th>Status</th>
                        <th>Approved</th>
                        <th>Reserved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClaims.map((claim) => (
                        <tr key={claim.address}>
                          <td data-label="Claim">{claim.claimId}</td>
                          <td data-label="Status">{describeClaimStatus(claim.intakeStatus)}</td>
                          <td data-label="Approved">{formatAmount(claim.approvedAmount)}</td>
                          <td data-label="Reserved">{formatAmount(claim.reservedAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <WorkbenchEmptyState
                    title="No claim cases in this filter"
                    copy={claimsEmptyCopy(Boolean(selectedSeries), planClaims.length > 0)}
                  />
                )}
              </div>

              <div className="workbench-content-pane">
                <div className="workbench-content-pane-head">
                  <div>
                    <p className="workbench-panel-eyebrow">Obligation register</p>
                    <h2 className="workbench-panel-title">Liabilities stay auditable without leaving the selected plan.</h2>
                  </div>
                </div>
                {filteredObligations.length > 0 ? (
                  <table className="workbench-table">
                    <thead>
                      <tr>
                        <th>Obligation</th>
                        <th>Status</th>
                        <th>Principal</th>
                        <th>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredObligations.map((obligation) => (
                        <tr key={obligation.address}>
                          <td data-label="Obligation">{obligation.obligationId}</td>
                          <td data-label="Status">{describeObligationStatus(obligation.status)}</td>
                          <td data-label="Principal">{formatAmount(obligation.principalAmount)}</td>
                          <td data-label="Outstanding">{formatAmount(obligation.outstandingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <WorkbenchEmptyState
                    title="No obligations in this filter"
                    copy={obligationsEmptyCopy(Boolean(selectedSeries), planObligations.length > 0)}
                  />
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "schemas" ? (
            selectedSeries ? (
              <div className="workbench-content-split">
                <div className="workbench-content-pane">
                  <div className="workbench-content-pane-head">
                    <div>
                      <p className="workbench-panel-eyebrow">Schema inspector</p>
                      <h2 className="workbench-panel-title">{selectedSeries.displayName}</h2>
                    </div>
                    <span className="workbench-card-meta">{selectedSeries.termsVersion}</span>
                  </div>
                  <div className="workbench-data-list">
                    <div className="workbench-data-row">
                      <span>Comparability key</span>
                      <strong>{selectedSeries.comparabilityKey}</strong>
                    </div>
                    <div className="workbench-data-row">
                      <span>Outcome count</span>
                      <strong>{formatAmount(seriesOutcomeCount(selectedSeries.address))}</strong>
                    </div>
                    <div className="workbench-data-row">
                      <span>Status</span>
                      <strong>{describeSeriesStatus(selectedSeries.status)}</strong>
                    </div>
                  </div>
                </div>

                <div className="workbench-content-pane">
                  <table className="workbench-table">
                    <thead>
                      <tr>
                        <th>Series id</th>
                        <th>Mode</th>
                        <th>Terms version</th>
                        <th>Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td data-label="Series id">{selectedSeries.seriesId}</td>
                        <td data-label="Mode">{describeSeriesMode(selectedSeries.mode)}</td>
                        <td data-label="Terms version">{selectedSeries.termsVersion}</td>
                        <td data-label="Address">{shortenAddress(selectedSeries.address, 8)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <WorkbenchEmptyState title="No schema context" copy="Choose a plan and series to inspect comparability posture." />
            )
          ) : null}

          {activeTab === "funding" ? (
            <div className="workbench-table-card">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>Funding line</th>
                    <th>Type</th>
                    <th>Funded</th>
                    <th>Reserved</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {planFundingLines.map((line) => (
                    <tr key={line.address}>
                      <td data-label="Funding line">{line.displayName}</td>
                      <td data-label="Type">{describeFundingLineType(line.lineType)}</td>
                      <td data-label="Funded">{formatAmount(line.fundedAmount)}</td>
                      <td data-label="Reserved">{formatAmount(line.reservedAmount)}</td>
                      <td data-label="Status">{line.status === 0 ? "open" : "managed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="workbench-stack">
              <p className="workbench-body-copy">
                Advanced addresses stay in settings so the main claims, member, and funding flows remain readable.
              </p>
              <div className="workbench-table-card">
                <table className="workbench-table">
                  <thead>
                    <tr>
                      <th>Control lane</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td data-label="Control lane">Reserve domain</td>
                      <td data-label="Address">{formatControlLaneAddress(selectedPlan?.reserveDomain, 6)}</td>
                    </tr>
                    <tr>
                      <td data-label="Control lane">Plan admin</td>
                      <td data-label="Address">{formatControlLaneAddress(selectedPlan?.planAdmin, 6)}</td>
                    </tr>
                    <tr>
                      <td data-label="Control lane">Sponsor operator</td>
                      <td data-label="Address">{formatControlLaneAddress(selectedPlan?.sponsorOperator, 6)}</td>
                    </tr>
                    <tr>
                      <td data-label="Control lane">Claims operator</td>
                      <td data-label="Address">{formatControlLaneAddress(selectedPlan?.claimsOperator, 6)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <aside className="workbench-rail">
        <WorkbenchRailCard title="Plan summary" meta="LIVE">
          <div className="workbench-stack">
            <strong>{selectedPlan?.displayName ?? "Awaiting selection"}</strong>
            <p>{selectedPlan?.sponsorLabel ?? "Choose a health plan to inspect sponsor posture."}</p>
            <div className="workbench-mini-stat">
              <span>Budget committed</span>
              <strong>{formatAmount(sponsorView?.committedSponsorBudget ?? 0)}</strong>
            </div>
            <div className="workbench-mini-stat">
              <span>Reserve coverage</span>
              <strong>{formatAmount(sponsorView?.reserveCoverageBps ?? 0)} bps</strong>
            </div>
          </div>
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Available funding" meta="PLAN">
          <div className="workbench-stack">
            {planFundingLines.map((line) => (
              <div key={line.address} className="workbench-mini-stat">
                <span>{line.displayName}</span>
                <strong>{formatAmount(availableFundingLineBalance(line))}</strong>
              </div>
            ))}
          </div>
        </WorkbenchRailCard>

        <WorkbenchRailCard title="Recent events" meta="AUDIT">
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
