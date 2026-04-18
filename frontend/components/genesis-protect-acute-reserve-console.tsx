// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { formatAmount } from "@/lib/canonical-ui";
import {
  type GenesisProtectAcuteReserveConsoleModel,
  type GenesisProtectAcuteReserveLaneFilter,
} from "@/lib/genesis-protect-acute-console";
import { cn } from "@/lib/cn";

type GenesisProtectAcuteReserveConsolePanelProps = {
  model: GenesisProtectAcuteReserveConsoleModel;
  onSelectFilter?: (filter: GenesisProtectAcuteReserveLaneFilter) => void;
  onSelectLane?: (fundingLineAddress: string) => void;
};

const RESERVE_FILTER_LABELS: Record<GenesisProtectAcuteReserveLaneFilter, string> = {
  all: "ALL_LANES",
  premium: "PREMIUM",
  sponsor: "SPONSOR",
  liquidity: "LIQUIDITY",
};

function postureClass(state: GenesisProtectAcuteReserveConsoleModel["setupModel"]["posture"]["state"]): string {
  switch (state) {
    case "healthy":
      return "status-ok";
    case "paused":
      return "status-error";
    default:
      return "status-off";
  }
}

function utilizationLabel(bps: bigint | null): string {
  if (bps === null) return "N/A";
  return `${Number(bps) / 100}%`;
}

export function GenesisProtectAcuteReserveConsolePanel(props: GenesisProtectAcuteReserveConsolePanelProps) {
  const selected = props.model.selectedLane;

  return (
    <section className="plans-stack">
      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">GENESIS_RESERVE_CONSOLE</p>
            <h2 className="plans-card-title plans-card-title-display">
              Reserve lane <em>monitor</em>
            </h2>
          </div>
          <span className={`status-pill ${postureClass(props.model.setupModel.posture.state)}`}>
            {props.model.setupModel.posture.state.toUpperCase()}
          </span>
        </div>
        <p className="plans-card-body">
          Treasury actions stay in the same mounted workspace, but the live reserve posture comes first: premium, sponsor, and liquidity lanes all stay visible before the mutation forms below.
        </p>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">CLAIMS_PAYING_CAPITAL</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {formatAmount(props.model.summary.claimsPayingCapital)}
            </strong>
            <p className="plans-wizard-support-note">Posted premium, sponsor, and liquidity capital visible across Genesis reserve lanes.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">RESERVED_AMOUNT</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {formatAmount(props.model.summary.reservedAmount)}
            </strong>
            <p className="plans-wizard-support-note">Reserve already encumbered against currently visible Genesis liabilities.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">PENDING_PAYOUT</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {formatAmount(props.model.summary.pendingPayoutAmount)}
            </strong>
            <p className="plans-wizard-support-note">Claimable and payable exposure still waiting for delivery or settlement.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">RESERVE_UTILIZATION</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {utilizationLabel(props.model.summary.reserveUtilizationBps)}
            </strong>
            <p className="plans-wizard-support-note">Current reserved plus pending payout as a share of visible claims-paying capital.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">VISIBILITY_FLAGS</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {props.model.summary.visibilityGapCount}
            </strong>
            <p className="plans-wizard-support-note">
              {props.model.summary.impairedLaneCount} impaired lane{props.model.summary.impairedLaneCount === 1 ? "" : "s"} · {props.model.summary.queueOnlyLaneCount} queue-only lane{props.model.summary.queueOnlyLaneCount === 1 ? "" : "s"}
            </p>
          </article>
        </div>

        <div className="plans-members-toolbar">
          <div className="plans-members-chips">
            {(Object.keys(RESERVE_FILTER_LABELS) as GenesisProtectAcuteReserveLaneFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={cn("plans-chip", props.model.laneFilter === filter && "plans-chip-active")}
                onClick={() => props.onSelectFilter?.(filter)}
              >
                {RESERVE_FILTER_LABELS[filter]}
              </button>
            ))}
          </div>
        </div>

        {props.model.warnings.length > 0 ? (
          <div className="space-y-2">
            {props.model.warnings.map((warning) => (
              <div key={warning} className="plans-notice liquid-glass" role="status">
                <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">info</span>
                <p>{warning}</p>
              </div>
            ))}
          </div>
        ) : null}
      </article>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <article className="plans-card heavy-glass">
          <div className="plans-card-head">
            <div>
              <p className="plans-card-eyebrow">LANE_REGISTER</p>
              <h2 className="plans-card-title plans-card-title-display">
                Reserve <em>lanes</em>
              </h2>
            </div>
            <span className="plans-card-meta">{props.model.visibleLanes.length} visible</span>
          </div>
          {props.model.visibleLanes.length > 0 ? (
            <ul className="plans-funding-list">
              {props.model.visibleLanes.map((lane) => {
                const isSelected = lane.fundingLineAddress === selected?.fundingLineAddress;
                return (
                  <li key={lane.fundingLineAddress} className={cn("plans-funding-row", isSelected && "ring-1 ring-[color-mix(in_oklab,var(--accent)_32%,transparent)]")}>
                    <button
                      type="button"
                      className="grid gap-3 text-left"
                      onClick={() => props.onSelectLane?.(lane.fundingLineAddress)}
                    >
                      <div className="plans-funding-row-head">
                        <div>
                          <span className="plans-funding-name">{lane.displayName}</span>
                          <span className="plans-funding-type">
                            {lane.skuDisplayName} · {lane.lineTypeLabel}
                          </span>
                        </div>
                        <span className="plans-funding-amount">{formatAmount(lane.claimsPayingCapital)}</span>
                      </div>
                      <div className="plans-rail-bar plans-rail-bar-sm">
                        <div
                          className="plans-rail-bar-fill"
                          style={{
                            width: `${Math.max(
                              4,
                              Math.min(
                                100,
                                lane.claimsPayingCapital > 0n
                                  ? Number((lane.reservedAmount + lane.pendingPayoutAmount) * 10000n / lane.claimsPayingCapital) / 100
                                  : 0,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="plans-funding-meta">
                        <span>{formatAmount(lane.reservedAmount)} reserved</span>
                        <span>{formatAmount(lane.pendingPayoutAmount)} payout</span>
                        <span>{lane.laneType.toUpperCase()}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="plans-card-body">
              No Genesis reserve lanes match this filter yet. Switch the lane filter or widen the series scope to see the full launch reserve surface.
            </p>
          )}
        </article>

        <article className="plans-card heavy-glass">
          <div className="plans-card-head">
            <div>
              <p className="plans-card-eyebrow">SELECTED_LANE</p>
              <h2 className="plans-card-title plans-card-title-display">
                {selected ? selected.displayName : <>Awaiting <em>selection</em></>}
              </h2>
            </div>
            {selected ? <span className={`status-pill ${selected.warningReasons.length > 0 ? "status-off" : "status-ok"}`}>{selected.laneType.toUpperCase()}</span> : null}
          </div>

          {selected ? (
            <div className="space-y-4">
              <div className="plans-settings-grid">
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">SKU</span>
                    <span className="plans-settings-lane">Launch posture context</span>
                  </div>
                  <span className="plans-settings-address">{selected.skuDisplayName}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">AVAILABLE</span>
                    <span className="plans-settings-lane">Currently free reserve on this lane</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(selected.availableAmount)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">RESERVED</span>
                    <span className="plans-settings-lane">Still encumbered against linked liabilities</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(selected.reservedAmount)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">PENDING_PAYOUT</span>
                    <span className="plans-settings-lane">Claimable or payable exposure</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(selected.pendingPayoutAmount)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">IMPAIRED</span>
                    <span className="plans-settings-lane">Current impairment carried by this lane</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(selected.impairedAmount)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">LINKED_CAPITAL</span>
                    <span className="plans-settings-lane">Pool and class path currently funding the lane</span>
                  </div>
                  <span className="plans-settings-address">
                    {selected.linkedPoolDisplayName ? `${selected.linkedPoolDisplayName} · ${selected.linkedCapitalClasses.join(", ") || "No class"}` : "No capital linkage"}
                  </span>
                </div>
              </div>

              {selected.warningReasons.length > 0 ? (
                <div className="space-y-2">
                  {selected.warningReasons.map((warning) => (
                    <div key={warning} className="plans-notice liquid-glass" role="status">
                      <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">warning</span>
                      <p>{warning}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <p className="field-help">
                The treasury action panel below is scoped to this funding line, so reserve posting, premium recording, and control changes stay anchored to the live lane you selected here.
              </p>
            </div>
          ) : (
            <p className="plans-card-body">
              Pick a reserve lane to keep the detailed reserve readout and treasury actions aligned.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
