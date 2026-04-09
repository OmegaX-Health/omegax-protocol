// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchableSelect } from "@/components/searchable-select";
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
import { cn } from "@/lib/cn";

/* ── Constants ── */

const SERIES_OPTIONAL_TABS = new Set<PlanTabId>(["claims", "members", "schemas"]);

const TAB_ICONS: Record<PlanTabId, string> = {
  overview: "dashboard",
  series: "category",
  members: "group",
  claims: "gavel",
  schemas: "schema",
  funding: "account_balance",
  settings: "settings",
};

/* ── Helpers ── */

function formatControlLaneAddress(address?: string | null, size = 6) {
  return isUnsetDevnetWalletAddress(address) ? "Not configured" : shortenAddress(address ?? "", size);
}

function statusVariant(described: string): "success" | "warning" | "danger" | "info" | "muted" {
  const l = described.toLowerCase();
  if (l.includes("active") || l.includes("eligible") || l.includes("approved") || l.includes("open")) return "success";
  if (l.includes("pending") || l.includes("review") || l.includes("paused")) return "warning";
  if (l.includes("denied") || l.includes("closed") || l.includes("sunset") || l.includes("ineligible")) return "danger";
  if (l.includes("reserved") || l.includes("processing") || l.includes("submitted")) return "info";
  return "muted";
}

function StatusBadge({ label }: { label: string }) {
  return <span className={`plans-badge plans-badge-${statusVariant(label)}`}>{label}</span>;
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

function PlansEmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="plans-empty">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

/* ── Component ── */

export function PlansWorkbench() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { effectivePersona } = useWorkspacePersona();
  const consoleState = useMemo(() => buildCanonicalConsoleState(), []);
  const [planSearch, setPlanSearch] = useState("");
  const [seriesSearch, setSeriesSearch] = useState("");

  /* ── Selection state ── */

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
  const matchedPlan = useMemo(() => allPlans.find((plan) => plan.address === queryPlan) ?? null, [allPlans, queryPlan]);
  const hasInvalidPlan = Boolean(queryPlan) && !matchedPlan;
  const selectedPlan = useMemo(() => {
    if (hasInvalidPlan) return null;
    return matchedPlan ?? filteredPlans[0] ?? allPlans[0] ?? null;
  }, [allPlans, filteredPlans, hasInvalidPlan, matchedPlan]);

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
  const matchedSeries = useMemo(() => planSeries.find((series) => series.address === querySeries) ?? null, [planSeries, querySeries]);
  const hasInvalidSeries = Boolean(querySeries) && !matchedSeries;
  const selectedSeries = useMemo(() => {
    if (hasInvalidSeries) return null;
    if (matchedSeries) return matchedSeries;
    if (seriesSelectionOptional) return null;
    return filteredSeries[0] ?? planSeries[0] ?? null;
  }, [filteredSeries, hasInvalidSeries, matchedSeries, planSeries, seriesSelectionOptional]);

  /* ── Derived data ── */

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

  /* ── URL sync ── */

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
    if (hasInvalidPlan || hasInvalidSeries) return;
    const nextUpdates: Record<string, string | null> = {};
    if (requestedTab !== activeTab) nextUpdates.tab = activeTab;
    if (selectedPlan && queryPlan !== selectedPlan.address) nextUpdates.plan = selectedPlan.address;
    if (selectedSeries && querySeries !== selectedSeries.address) nextUpdates.series = selectedSeries.address;
    if (!selectedSeries && querySeries) nextUpdates.series = null;
    if (Object.keys(nextUpdates).length > 0) updateParams(nextUpdates);
  }, [activeTab, hasInvalidPlan, hasInvalidSeries, queryPlan, querySeries, requestedTab, selectedPlan, selectedSeries, updateParams]);

  /* ── Persona copy ── */

  const planClaimCount = sponsorView?.activeClaimCount ?? 0;
  const primaryActionLabel =
    effectivePersona === "capital"
      ? "Inspect how pool allocations support this plan."
      : effectivePersona === "governance"
        ? "Review operational history before approving new controls."
        : "Manage the full plan lifecycle here.";

  /* ── Invalid selection guard ── */

  const invalidSelection = hasInvalidPlan
    ? { title: "Plan not found", copy: "The requested health plan is not present in the current fixture set. Choose another plan to continue." }
    : hasInvalidSeries
      ? { title: "Series not found", copy: "The requested policy series is not linked to the selected plan. Choose another series or clear the series filter." }
      : null;

  if (invalidSelection) {
    return (
      <div className="plans-dashboard">
        <section className="plans-header">
          <div className="plans-selector-row">
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
              error={hasInvalidPlan ? "Requested health plan was not found in the current fixture set." : null}
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
              disabled={!selectedPlan}
              disabledHint="Choose a valid health plan before selecting a policy series."
              error={hasInvalidSeries ? "Requested policy series is not linked to the selected plan." : null}
              emptyMessage="No policy series match this plan filter."
              showOptionCount={false}
              showSelectedHint={false}
            />
          </div>
        </section>

        <PlansEmptyState title={invalidSelection.title} copy={invalidSelection.copy} />
      </div>
    );
  }

  /* ── Main render ── */

  return (
    <div className="plans-dashboard">
      {/* ── Header ── */}
      <section className="plans-header">
        <div className="plans-selector-row">
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
            disabled={!selectedPlan}
            disabledHint="Choose a valid health plan before selecting a policy series."
            emptyMessage="No policy series match this plan filter."
            showOptionCount={false}
            showSelectedHint={false}
          />
        </div>

        <div className="plans-metrics-strip">
          <div className="plans-strip-metric plans-strip-metric-primary">
            <span className="plans-strip-metric-val">{formatAmount(sponsorView?.remainingSponsorBudget ?? 0)}</span>
            <span className="plans-strip-metric-label">Budget</span>
          </div>
          <div className="plans-strip-metric">
            <span className="plans-strip-metric-val">{planSeries.length}</span>
            <span className="plans-strip-metric-label">Series</span>
          </div>
          <div className="plans-strip-metric">
            <span className="plans-strip-metric-val">{planClaimCount}</span>
            <span className="plans-strip-metric-label">Claims</span>
          </div>
          <div className="plans-strip-metric">
            <span className="plans-strip-metric-val">{planFundingLines.length}</span>
            <span className="plans-strip-metric-label">Funding</span>
          </div>
        </div>
      </section>

      {/* ── Tab bar ── */}
      <nav className="plans-tab-bar">
        {PLAN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn("plans-tab", activeTab === tab.id && "plans-tab-active")}
            onClick={() => updateParams({ tab: tab.id })}
          >
            <span className="material-symbols-outlined plans-tab-icon">{TAB_ICONS[tab.id as PlanTabId]}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Content grid ── */}
      <div className="plans-content-grid">
        <section className="plans-main">
          {/* ── Overview tab ── */}
          {activeTab === "overview" ? (
            <div className="plans-split">
              <div className="plans-card">
                <div className="plans-card-head">
                  <div>
                    <p className="plans-card-eyebrow">Plan overview</p>
                    <h2 className="plans-card-title">{selectedPlan?.displayName ?? "Awaiting selection"}</h2>
                  </div>
                  {selectedPlan ? <span className="plans-card-meta">{selectedPlan.planId}</span> : null}
                </div>
                <div className="plans-card-stats">
                  <div className="plans-stat">
                    <span className="plans-stat-value">{planSeries.length}</span>
                    <span className="plans-stat-key">Series</span>
                  </div>
                  <div className="plans-stat">
                    <span className="plans-stat-value">{planMembers.length}</span>
                    <span className="plans-stat-key">Members</span>
                  </div>
                  <div className="plans-stat">
                    <span className="plans-stat-value plans-stat-value-accent">{planClaimCount}</span>
                    <span className="plans-stat-key">Claims</span>
                  </div>
                  <div className="plans-stat">
                    <span className="plans-stat-value">{planFundingLines.length}</span>
                    <span className="plans-stat-key">Funding</span>
                  </div>
                </div>
                <div className="plans-rail-stack">
                  {planSeries.map((series) => (
                    <article key={series.address} className="plans-series-row">
                      <div className="plans-series-row-info">
                        <span className="plans-series-row-name">{series.displayName}</span>
                        <span className="plans-series-row-key">{series.comparabilityKey}</span>
                      </div>
                      <div className="plans-series-row-meta">
                        <span className="plans-series-row-mode">{describeSeriesMode(series.mode)}</span>
                        <StatusBadge label={describeSeriesStatus(series.status)} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="plans-card">
                <div className="plans-card-head">
                  <div>
                    <p className="plans-card-eyebrow">Performance</p>
                    <h2 className="plans-card-title">Outcomes by lane</h2>
                  </div>
                </div>
                <div className="plans-table-wrap">
                  <table className="plans-table">
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
                          <td data-label="Series"><span className="plans-table-mono">{series.seriesId}</span></td>
                          <td data-label="Mode">{series.mode}</td>
                          <td data-label="Claims"><span className="plans-table-mono">{series.claimCount}</span></td>
                          <td data-label="Reserved"><span className="plans-table-mono">{formatAmount(series.reserved)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Series tab ── */}
          {activeTab === "series" ? (
            <div className="plans-card">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">Series</p>
                  <h2 className="plans-card-title">Series lanes</h2>
                </div>
                <span className="plans-card-meta">
                  <span className="plans-live-dot" />
                  {planSeries.length} active
                </span>
              </div>
              <div className="plans-table-wrap">
                <table className="plans-table">
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
                          <button type="button" className="plans-table-link" onClick={() => updateParams({ series: series.address })}>
                            {series.displayName}
                          </button>
                        </td>
                        <td data-label="Version"><span className="plans-table-mono">{series.termsVersion}</span></td>
                        <td data-label="Comparability"><span className="plans-table-mono">{series.comparabilityKey}</span></td>
                        <td data-label="Outcomes"><span className="plans-table-mono">{formatAmount(seriesOutcomeCount(series.address))}</span></td>
                        <td data-label="Status"><StatusBadge label={describeSeriesStatus(series.status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* ── Members tab ── */}
          {activeTab === "members" ? (
            filteredMembers.length > 0 ? (
              <div className="plans-card">
                <div className="plans-card-head">
                  <div>
                    <p className="plans-card-eyebrow">Members</p>
                    <h2 className="plans-card-title">Eligibility register</h2>
                  </div>
                  <span className="plans-card-meta">{filteredMembers.length} positions</span>
                </div>
                <div className="plans-table-wrap">
                  <table className="plans-table">
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
                          <td data-label="Wallet"><span className="plans-table-mono">{shortenAddress(member.wallet, 6)}</span></td>
                          <td data-label="Eligibility"><StatusBadge label={describeEligibilityStatus(member.eligibilityStatus)} /></td>
                          <td data-label="Delegated rights">{member.delegatedRights.join(", ") || "None"}</td>
                          <td data-label="Position"><span className="plans-table-mono">{shortenAddress(member.address, 6)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <PlansEmptyState
                title="No member positions in this filter"
                copy={effectivePersona === "sponsor" ? "Choose another series or plan to inspect member rights." : "This plan filter does not currently expose member positions."}
              />
            )
          ) : null}

          {/* ── Claims tab ── */}
          {activeTab === "claims" ? (
            <div className="plans-split">
              <div className="plans-card">
                <div className="plans-card-head">
                  <div>
                    <p className="plans-card-eyebrow">Claims</p>
                    <h2 className="plans-card-title">Adjudication register</h2>
                  </div>
                </div>
                {filteredClaims.length > 0 ? (
                  <div className="plans-table-wrap">
                    <table className="plans-table">
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
                            <td data-label="Claim"><span className="plans-table-mono">{claim.claimId}</span></td>
                            <td data-label="Status"><StatusBadge label={describeClaimStatus(claim.intakeStatus)} /></td>
                            <td data-label="Approved"><span className="plans-table-mono">{formatAmount(claim.approvedAmount)}</span></td>
                            <td data-label="Reserved"><span className="plans-table-mono">{formatAmount(claim.reservedAmount)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <PlansEmptyState
                    title="No claim cases in this filter"
                    copy={claimsEmptyCopy(Boolean(selectedSeries), planClaims.length > 0)}
                  />
                )}
              </div>

              <div className="plans-card">
                <div className="plans-card-head">
                  <div>
                    <p className="plans-card-eyebrow">Obligations</p>
                    <h2 className="plans-card-title">Outstanding liabilities</h2>
                  </div>
                </div>
                {filteredObligations.length > 0 ? (
                  <div className="plans-table-wrap">
                    <table className="plans-table">
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
                            <td data-label="Obligation"><span className="plans-table-mono">{obligation.obligationId}</span></td>
                            <td data-label="Status"><StatusBadge label={describeObligationStatus(obligation.status)} /></td>
                            <td data-label="Principal"><span className="plans-table-mono">{formatAmount(obligation.principalAmount)}</span></td>
                            <td data-label="Outstanding"><span className="plans-table-mono">{formatAmount(obligation.outstandingAmount)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <PlansEmptyState
                    title="No obligations in this filter"
                    copy={obligationsEmptyCopy(Boolean(selectedSeries), planObligations.length > 0)}
                  />
                )}
              </div>
            </div>
          ) : null}

          {/* ── Schemas tab ── */}
          {activeTab === "schemas" ? (
            selectedSeries ? (
              <div className="plans-split">
                <div className="plans-card">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">Schema</p>
                      <h2 className="plans-card-title">{selectedSeries.displayName}</h2>
                    </div>
                    <span className="plans-card-meta">{selectedSeries.termsVersion}</span>
                  </div>
                  <div className="plans-data-grid">
                    <div className="plans-data-row">
                      <span className="plans-data-label">Comparability_Key</span>
                      <strong className="plans-data-value">{selectedSeries.comparabilityKey}</strong>
                    </div>
                    <div className="plans-data-row">
                      <span className="plans-data-label">Outcome_Count</span>
                      <strong className="plans-data-value">{formatAmount(seriesOutcomeCount(selectedSeries.address))}</strong>
                    </div>
                    <div className="plans-data-row">
                      <span className="plans-data-label">Status</span>
                      <StatusBadge label={describeSeriesStatus(selectedSeries.status)} />
                    </div>
                  </div>
                </div>

                <div className="plans-card">
                  <div className="plans-card-head">
                    <div>
                      <p className="plans-card-eyebrow">Detail</p>
                      <h2 className="plans-card-title">On-chain state</h2>
                    </div>
                  </div>
                  <div className="plans-data-grid">
                    <div className="plans-data-row">
                      <span className="plans-data-label">Series_ID</span>
                      <span className="plans-data-value plans-table-mono">{selectedSeries.seriesId}</span>
                    </div>
                    <div className="plans-data-row">
                      <span className="plans-data-label">Mode</span>
                      <span className="plans-data-value">{describeSeriesMode(selectedSeries.mode)}</span>
                    </div>
                    <div className="plans-data-row">
                      <span className="plans-data-label">Terms_Version</span>
                      <span className="plans-data-value plans-table-mono">{selectedSeries.termsVersion}</span>
                    </div>
                    <div className="plans-data-row">
                      <span className="plans-data-label">Address</span>
                      <span className="plans-data-value plans-table-mono">{shortenAddress(selectedSeries.address, 8)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <PlansEmptyState title="No schema context" copy="Choose a plan and series to inspect comparability posture." />
            )
          ) : null}

          {/* ── Funding tab ── */}
          {activeTab === "funding" ? (
            <div className="plans-card">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">Funding</p>
                  <h2 className="plans-card-title">Balances and reserves</h2>
                </div>
                <span className="plans-card-meta">
                  <span className="plans-live-dot" />
                  {planFundingLines.length} lines
                </span>
              </div>
              <div className="plans-table-wrap">
                <table className="plans-table">
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
                        <td data-label="Funded"><span className="plans-table-mono">{formatAmount(line.fundedAmount)}</span></td>
                        <td data-label="Reserved"><span className="plans-table-mono">{formatAmount(line.reservedAmount)}</span></td>
                        <td data-label="Status"><StatusBadge label={line.status === 0 ? "Open" : "Managed"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* ── Settings tab ── */}
          {activeTab === "settings" ? (
            <div className="plans-card">
              <div className="plans-card-head">
                <div>
                  <p className="plans-card-eyebrow">Settings</p>
                  <h2 className="plans-card-title">Administration addresses</h2>
                </div>
                <span className="plans-card-meta">Settings</span>
              </div>
              <div className="plans-settings-grid">
                <div className="plans-settings-row">
                  <span className="plans-settings-lane">Reserve domain</span>
                  <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.reserveDomain, 6)}</span>
                </div>
                <div className="plans-settings-row">
                  <span className="plans-settings-lane">Plan admin</span>
                  <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.planAdmin, 6)}</span>
                </div>
                <div className="plans-settings-row">
                  <span className="plans-settings-lane">Sponsor operator</span>
                  <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.sponsorOperator, 6)}</span>
                </div>
                <div className="plans-settings-row">
                  <span className="plans-settings-lane">Claims operator</span>
                  <span className="plans-settings-address">{formatControlLaneAddress(selectedPlan?.claimsOperator, 6)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* ── Rail ── */}
        <aside className="plans-rail">
          <div className="plans-rail-panel">
            {/* Sponsor */}
            <section className="plans-rp-section">
              <div className="plans-rp-head">
                <h3 className="plans-rp-title">Sponsor</h3>
                <span className="plans-rp-tag"><span className="plans-live-dot" /> Live</span>
              </div>
              {(() => {
                const committed = Number(sponsorView?.committedSponsorBudget ?? 0);
                const remaining = Number(sponsorView?.remainingSponsorBudget ?? 0);
                const usedPct = committed > 0 ? Math.round(((committed - remaining) / committed) * 100) : 0;
                return (
                  <>
                    <div className="plans-rp-hero">
                      <span className="plans-rp-hero-val">{formatAmount(remaining)}</span>
                      <span className="plans-rp-hero-sub">remaining of {formatAmount(committed)}</span>
                    </div>
                    <div className="plans-rp-bar">
                      <div className="plans-rp-bar-fill" style={{ width: `${usedPct}%` }} />
                    </div>
                    <div className="plans-rp-row">
                      <span>Reserve coverage</span>
                      <strong>{formatAmount(sponsorView?.reserveCoverageBps ?? 0)} bps</strong>
                    </div>
                  </>
                );
              })()}
            </section>

            {/* Funding */}
            <section className="plans-rp-section">
              <div className="plans-rp-head">
                <h3 className="plans-rp-title">Funding</h3>
                <span className="plans-rp-tag">{planFundingLines.length} active</span>
              </div>
              {planFundingLines.map((line) => {
                const funded = Number(line.fundedAmount);
                const reserved = Number(line.reservedAmount);
                const available = availableFundingLineBalance(line);
                const usedPct = funded > 0 ? Math.round((reserved / funded) * 100) : 0;
                return (
                  <div key={line.address} className="plans-rp-fund">
                    <div className="plans-rp-row">
                      <span>{line.displayName}</span>
                      <strong>{formatAmount(available)}</strong>
                    </div>
                    <div className="plans-rp-bar plans-rp-bar-sm">
                      <div className="plans-rp-bar-fill" style={{ width: `${usedPct}%` }} />
                    </div>
                    <div className="plans-rp-fund-meta">
                      <span>{formatAmount(reserved)} reserved</span>
                      <span>{formatAmount(funded)} funded</span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Audit trail */}
            <section className="plans-rp-section">
              <div className="plans-rp-head">
                <h3 className="plans-rp-title">Audit trail</h3>
              </div>
              <div className="plans-rp-trail">
                {auditTrail.map((item) => (
                  <div key={item.id} className={`plans-rp-event plans-rp-event-${item.tone}`}>
                    <span className="plans-rp-event-dot" />
                    <strong className="plans-rp-event-label">{item.label}</strong>
                    <time className="plans-rp-event-time">{item.timestamp}</time>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
