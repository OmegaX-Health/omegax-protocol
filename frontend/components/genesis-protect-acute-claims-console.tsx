// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";

import { formatAmount } from "@/lib/canonical-ui";
import {
  CLAIM_ATTESTATION_DECISION_ABSTAIN,
  CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW,
} from "@/lib/protocol";
import {
  type GenesisProtectAcuteClaimActionPanel,
  type GenesisProtectAcuteClaimConsoleModel,
  type GenesisProtectAcuteClaimQueueFilter,
  type GenesisProtectAcuteClaimQueueRow,
} from "@/lib/genesis-protect-acute-console";
import { cn } from "@/lib/cn";
import { shortenAddress } from "@/lib/protocol";

type GenesisProtectAcuteClaimsConsolePanelProps = {
  model: GenesisProtectAcuteClaimConsoleModel;
  onSelectFilter?: (filter: GenesisProtectAcuteClaimQueueFilter) => void;
  onSelectClaim?: (address: string, panel: GenesisProtectAcuteClaimActionPanel) => void;
  poolAddress?: string | null;
};

const CLAIM_FILTER_LABELS: Record<GenesisProtectAcuteClaimQueueFilter, string> = {
  all: "All",
  operator_review: "Operator review",
  attestation_ready: "Attestation ready",
  reserve_active: "Reserve active",
  payout_active: "Payout active",
  closed: "Closed",
};

function statusPillClass(stage: GenesisProtectAcuteClaimQueueRow["stage"]): string {
  switch (stage) {
    case "operator_review":
      return "status-off";
    case "attestation_ready":
      return "status-off";
    case "reserve_active":
      return "status-off";
    case "payout_active":
      return "status-ok";
    default:
      return "status-ok";
  }
}

function attestationHref(poolAddress: string | null | undefined, row: GenesisProtectAcuteClaimQueueRow): string {
  const params = new URLSearchParams({
    tab:
      row.attestationDecision === CLAIM_ATTESTATION_DECISION_REQUEST_REVIEW
      || row.attestationDecision === CLAIM_ATTESTATION_DECISION_ABSTAIN
        ? "disputes"
        : "attestations",
  });
  if (poolAddress) params.set("pool", poolAddress);
  if (row.seriesAddress) params.set("series", row.seriesAddress);
  return `/oracles?${params.toString()}`;
}

function operatorActionLabel(panel: GenesisProtectAcuteClaimActionPanel): string {
  switch (panel) {
    case "adjudication":
      return "Open adjudication";
    case "impairment":
      return "Open impairment";
    default:
      return "Open reserve actions";
  }
}

export function GenesisProtectAcuteClaimsConsolePanel(props: GenesisProtectAcuteClaimsConsolePanelProps) {
  const selected = props.model.selectedClaim;

  return (
    <section className="plans-stack">
      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">GENESIS_CLAIM_CONSOLE</p>
            <h2 className="plans-card-title plans-card-title-display">
              Operator claim <em>queue</em>
            </h2>
          </div>
          <span className="plans-card-meta">
            {props.model.visibleRows.length} visible
          </span>
        </div>
        <p className="plans-card-body">
          This queue stays operator-first: intake, attestation posture, linked obligation state, and reserve follow-through all stay visible before the raw transaction forms below.
        </p>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">Submitted or review</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {props.model.summary.submittedClaims}
            </strong>
            <p className="plans-wizard-support-note">Open or under-review claims still waiting for a first operator decision.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">Operator review load</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {props.model.summary.operatorReviewLoad}
            </strong>
            <p className="plans-wizard-support-note">Claims with open review, review-requested attestations, or missing linked context.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">Attestation ready</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {props.model.summary.attestationReadyClaims}
            </strong>
            <p className="plans-wizard-support-note">Approved claims that still need the oracle attestation feed to catch up.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">Reserved exposure</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {formatAmount(props.model.summary.reservedExposure)}
            </strong>
            <p className="plans-wizard-support-note">Capital already held against the currently visible Genesis claim queue.</p>
          </article>
          <article className="plans-wizard-support-card">
            <p className="plans-card-eyebrow">Payout in flight</p>
            <strong className="text-2xl font-semibold text-[var(--foreground)]">
              {formatAmount(props.model.summary.payoutInFlightAmount)}
            </strong>
            <p className="plans-wizard-support-note">
              {props.model.summary.payoutInFlightCount} case{props.model.summary.payoutInFlightCount === 1 ? "" : "s"} still claimable or payable.
            </p>
          </article>
        </div>

        <div className="plans-members-toolbar">
          <div className="plans-members-chips">
            {(Object.keys(CLAIM_FILTER_LABELS) as GenesisProtectAcuteClaimQueueFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={cn("plans-chip", props.model.queueFilter === filter && "plans-chip-active")}
                onClick={() => props.onSelectFilter?.(filter)}
              >
                {CLAIM_FILTER_LABELS[filter]}
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
              <p className="plans-card-eyebrow">Claim register</p>
              <h2 className="plans-card-title plans-card-title-display">
                Claim <em>routing</em>
              </h2>
            </div>
            <span className="plans-card-meta">{props.model.visibleRows.length} rows</span>
          </div>
          {props.model.visibleRows.length > 0 ? (
            <div className="plans-table-wrap">
              <table className="plans-table">
                <thead>
                  <tr>
                    <th>Claim</th>
                    <th>SKU</th>
                    <th>Case status</th>
                    <th>Attestation</th>
                    <th>Liability</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {props.model.visibleRows.map((row) => {
                    const isActive = row.claimAddress === selected?.claimAddress;
                    return (
                      <tr key={row.claimAddress} className={cn(isActive && "bg-[color-mix(in_oklab,var(--signal-soft)_18%,transparent)]")}>
                        <td data-label="Claim">
                          <button
                            type="button"
                            className="plans-table-link"
                            onClick={() => props.onSelectClaim?.(row.claimAddress, row.recommendedPanel)}
                          >
                            {row.claimId}
                          </button>
                        </td>
                        <td data-label="SKU">
                          <span className="plans-table-mono">{row.skuDisplayName}</span>
                        </td>
                        <td data-label="Case status">
                          <span className={`status-pill ${statusPillClass(row.stage)}`}>{row.claimStatusLabel}</span>
                        </td>
                        <td data-label="Attestation">
                          <span className="plans-table-mono">{row.attestationStatusLabel}</span>
                        </td>
                        <td data-label="Liability">
                          <span className="plans-table-mono">{row.obligationStatusLabel}</span>
                        </td>
                        <td data-label="Next step">
                          <span className={`status-pill ${statusPillClass(row.stage)}`}>{row.stageLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="plans-card-body">
              No Genesis claims match this queue filter yet. Change the filter or select a different Genesis series to widen the operator view.
            </p>
          )}
        </article>

        <article className="plans-card heavy-glass">
          <div className="plans-card-head">
            <div>
              <p className="plans-card-eyebrow">Selected claim</p>
              <h2 className="plans-card-title plans-card-title-display">
                {selected ? selected.claimId : <>Awaiting <em>selection</em></>}
              </h2>
            </div>
            {selected ? <span className={`status-pill ${statusPillClass(selected.stage)}`}>{selected.stageLabel}</span> : null}
          </div>

          {selected ? (
            <div className="space-y-4">
              <p className="plans-card-body">{selected.stageReason}</p>
              <div className="plans-settings-grid">
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">CLAIMANT</span>
                    <span className="plans-settings-lane">Submitting wallet</span>
                  </div>
                  <span className="plans-settings-address">{shortenAddress(selected.claimant, 6)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">MEMBER_POSITION</span>
                    <span className="plans-settings-lane">Member and register context</span>
                  </div>
                  <span className="plans-settings-address">
                    {selected.memberWallet ? shortenAddress(selected.memberWallet, 6) : shortenAddress(selected.memberPositionAddress, 6)}
                  </span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">Reserve lane</span>
                    <span className="plans-settings-lane">{selected.fundingLineDisplayName} FundingLine</span>
                  </div>
                  <span className="plans-settings-address">{selected.fundingLaneType.toUpperCase()}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">ATTESTATION</span>
                    <span className="plans-settings-lane">Latest visible oracle posture</span>
                  </div>
                  <span className="plans-settings-address">{selected.attestationStatusLabel}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">Payout/liability</span>
                    <span className="plans-settings-lane">Linked Obligation path</span>
                  </div>
                  <span className="plans-settings-address">{selected.obligationStatusLabel}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">APPROVED</span>
                    <span className="plans-settings-lane">Decisioned claim amount</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(selected.approvedAmount)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">RESERVED</span>
                    <span className="plans-settings-lane">Capital still encumbered</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(selected.reservedAmount)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">PAYOUT_IN_FLIGHT</span>
                    <span className="plans-settings-lane">Claimable or payable amount still outstanding</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(selected.payoutInFlightAmount)}</span>
                </div>
              </div>

              {selected.dataWarning ? (
                <div className="plans-notice liquid-glass" role="status">
                  <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">warning</span>
                  <p>{selected.dataWarning}</p>
                </div>
              ) : null}

              <div className="plans-wizard-support-actions">
                <button
                  type="button"
                  className="plans-primary-cta"
                  onClick={() => props.onSelectClaim?.(selected.claimAddress, selected.recommendedPanel)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
                  {operatorActionLabel(selected.recommendedPanel)}
                </button>
                <Link href={attestationHref(props.poolAddress, selected)} className="plans-secondary-cta">
                  <span className="material-symbols-outlined" aria-hidden="true">verified</span>
                  Open oracle feed
                </Link>
              </div>
              <p className="field-help">
                Selecting a case here scopes the low-level transaction actions below, so operators only open adjudication, reserve, or impairment controls when the selected claim actually needs them.
              </p>
            </div>
          ) : (
            <p className="plans-card-body">
              Pick a Genesis claim row to load the selected-case detail and the contextual action panel beneath it.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}
