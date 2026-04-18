// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";

import { formatAmount } from "@/lib/canonical-ui";
import type { GenesisProtectAcuteSkuKey } from "@/lib/genesis-protect-acute";
import {
  GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU,
  GENESIS_PROTECT_ACUTE_PRIMARY_SKU,
  GENESIS_PROTECT_ACUTE_TEMPLATE_KEY,
  type GenesisProtectAcuteSetupModel,
} from "@/lib/genesis-protect-acute-operator";

type GenesisProtectAcuteSetupPanelProps = {
  model: GenesisProtectAcuteSetupModel;
  planAddress: string | null;
  treasuryHref: string;
  capitalClassesHref: string;
  capitalAllocationsHref: string;
  bootstrapHref: string;
  oracleBindingsHref: string;
  claimsHref: string;
  skuConsoleHrefs: Record<GenesisProtectAcuteSkuKey, {
    claims: string;
    treasury: string;
  }>;
};

function posturePillClass(state: GenesisProtectAcuteSetupModel["posture"]["state"]): string {
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

function checklistRows(props: GenesisProtectAcuteSetupPanelProps) {
  return [
    {
      key: "planShellReady",
      title: "Plan shell exists",
      detail: "Genesis Protect Acute is present with the canonical plan id and sponsor label.",
      ready: props.model.checklist.planShellReady,
      href: props.bootstrapHref,
      action: "Rerun template bootstrap",
    },
    {
      key: "event7SeriesReady",
      title: "Event 7 series exists",
      detail: "The fast demo SKU stays wired to the canonical metadata URI and protection mode.",
      ready: props.model.checklist.event7SeriesReady,
      href: props.bootstrapHref,
      action: "Restore launch SKU",
    },
    {
      key: "travel30SeriesReady",
      title: "Travel 30 series exists",
      detail: "The primary launch SKU stays wired to the canonical metadata URI and protection mode.",
      ready: props.model.checklist.travel30SeriesReady,
      href: props.bootstrapHref,
      action: "Restore launch SKU",
    },
    {
      key: "fundingLinesReady",
      title: "Canonical funding lines exist",
      detail: "Event 7 keeps premium, sponsor, and liquidity lanes while Travel 30 keeps premium and liquidity.",
      ready: props.model.checklist.fundingLinesReady,
      href: props.bootstrapHref,
      action: "Restore funding lanes",
    },
    {
      key: "poolReady",
      title: "Pool shell exists",
      detail: "The Genesis reserve pool is present with the canonical display name and strategy thesis.",
      ready: props.model.checklist.poolReady,
      href: props.bootstrapHref,
      action: "Restore pool shell",
    },
    {
      key: "capitalClassesReady",
      title: "Senior and junior classes exist",
      detail: "Both capital sleeves are present so Travel 30 and Event 7 can keep distinct reserve attribution.",
      ready: props.model.checklist.capitalClassesReady,
      href: props.capitalClassesHref,
      action: "Open capital classes",
    },
    {
      key: "allocationsReady",
      title: "Launch allocation positions exist",
      detail: "The canonical junior Event 7 lane plus senior/junior Travel 30 lanes are registered.",
      ready: props.model.checklist.allocationsReady,
      href: props.capitalAllocationsHref,
      action: "Open allocations",
    },
    {
      key: "planAuthoritiesReady",
      title: "Sponsor, claims, and oracle authorities are configured",
      detail: "The plan root must already expose real operator wallets before the launch window opens.",
      ready: props.model.checklist.planAuthoritiesReady,
      href: props.treasuryHref,
      action: "Open treasury controls",
    },
    {
      key: "reserveTargetReviewReady",
      title: "Reserve target review is live",
      detail: "Pool terms are present and at least one claims-paying reserve lane is funded for operator review.",
      ready: props.model.checklist.reserveTargetReviewReady,
      href: props.treasuryHref,
      action: "Open reserve settings",
    },
    {
      key: "poolTermsReady",
      title: "Pool terms are configured",
      detail: "Terms and payout metadata must be present before reserve-target review can be considered complete.",
      ready: props.model.checklist.poolTermsReady,
      href: props.treasuryHref,
      action: "Open pool settings",
    },
    {
      key: "poolOraclePolicyReady",
      title: "Pool oracle policy is configured",
      detail: "The pool-facing oracle policy must be bound before the Genesis posture can move out of setup mode.",
      ready: props.model.checklist.poolOraclePolicyReady,
      href: props.oracleBindingsHref,
      action: "Open oracle bindings",
    },
  ] as const;
}

export function GenesisProtectAcuteSetupPanel(props: GenesisProtectAcuteSetupPanelProps) {
  const primarySku = props.model.perSkuPosture.find((entry) => entry.skuKey === GENESIS_PROTECT_ACUTE_PRIMARY_SKU.key) ?? null;
  const demoSku = props.model.perSkuPosture.find((entry) => entry.skuKey === GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU.key) ?? null;
  const rows = checklistRows(props);

  return (
    <section className="plans-stack">
      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">GENESIS_SETUP_MODE</p>
            <h2 className="plans-card-title plans-card-title-display">
              Genesis launch-readiness <em>checklist</em>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`status-pill ${posturePillClass(props.model.posture.state)}`}>
              {props.model.posture.state.toUpperCase()}
            </span>
            <span className="status-pill status-off">
              {props.model.checklistCompleted}/{props.model.checklistTotal} items ready
            </span>
            <span className="status-pill status-ok">
              {GENESIS_PROTECT_ACUTE_PRIMARY_SKU.displayName}
            </span>
            <span className="status-pill status-off">
              {GENESIS_PROTECT_ACUTE_FAST_DEMO_SKU.displayName}
            </span>
          </div>
        </div>

        <p className="plans-card-body">
          The Genesis template creates the canonical two-SKU shell in place.
          Current public posture: bounded end-of-month mainnet target, not broadly live insurance today, with Phase 0 operator-backed claim review while reserve, oracle, and pool controls finish operator sign-off.
        </p>

        <div className="plans-settings-grid">
          <div className="plans-settings-row">
            <div>
              <span className="plans-settings-label">CLAIM_COUNT</span>
              <span className="plans-settings-lane">Claim cases currently linked to the Genesis plan</span>
            </div>
            <span className="plans-settings-address">{formatAmount(props.model.claimCount)}</span>
          </div>
          <div className="plans-settings-row">
            <div>
              <span className="plans-settings-label">RESERVED_AMOUNT</span>
              <span className="plans-settings-lane">Current reserve already encumbered across Genesis funding lines</span>
            </div>
            <span className="plans-settings-address">{formatAmount(props.model.reservedAmount)}</span>
          </div>
          <div className="plans-settings-row">
            <div>
              <span className="plans-settings-label">PENDING_PAYOUT</span>
              <span className="plans-settings-lane">Claimable or payable exposure visible on the live reserve lanes</span>
            </div>
            <span className="plans-settings-address">{formatAmount(props.model.pendingPayoutAmount)}</span>
          </div>
          <div className="plans-settings-row">
            <div>
              <span className="plans-settings-label">RESERVE_UTILIZATION</span>
              <span className="plans-settings-lane">Reserved plus pending payout as a share of currently posted claims-paying capital</span>
            </div>
            <span className="plans-settings-address">{utilizationLabel(props.model.reserveUtilizationBps)}</span>
          </div>
          <div className="plans-settings-row">
            <div>
              <span className="plans-settings-label">CLAIMS_PAYING_CAPITAL</span>
              <span className="plans-settings-lane">Premium, sponsor, and LP-backed capital currently posted to Genesis reserve lanes</span>
            </div>
            <span className="plans-settings-address">{formatAmount(props.model.claimsPayingCapital)}</span>
          </div>
          <div className="plans-settings-row">
            <div>
              <span className="plans-settings-label">LIVE_STRESS_FLAGS</span>
              <span className="plans-settings-lane">Queue-only capital sleeves and impairment stay visible while the bounded launch window remains under operator review</span>
            </div>
            <span className="plans-settings-address">
              {props.model.impairmentActive ? "IMPAIRMENT" : props.model.queueOnlyRedemptionsActive ? "QUEUE_ONLY" : "CLEAR"}
            </span>
          </div>
        </div>

        {props.model.posture.reasons.length > 0 ? (
          <div className="space-y-2">
            {props.model.posture.reasons.map((reason) => (
              <div key={reason} className="plans-notice liquid-glass" role="status">
                <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">info</span>
                <p>{reason}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="plans-wizard-support-grid">
          {[primarySku, demoSku].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).map((sku) => (
            <section key={sku.skuKey} className="plans-wizard-support-card">
              <div className="space-y-1">
                <h3 className="plans-wizard-support-title">{sku.displayName}</h3>
                <p className="plans-wizard-support-copy">
                  {sku.publicStatusRule}
                </p>
              </div>
              <div className="plans-settings-grid">
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">COVER_WINDOW</span>
                    <span className="plans-settings-lane">Published launch posture</span>
                  </div>
                  <span className="plans-settings-address">{sku.coverWindowDays} days</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">REIMBURSEMENT_MODE</span>
                    <span className="plans-settings-lane">Member-facing claims posture</span>
                  </div>
                  <span className="plans-settings-address">{sku.reimbursementMode}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">CLAIMS_PAYING_CAPITAL</span>
                    <span className="plans-settings-lane">Posted capital currently attributed to this SKU</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(sku.claimsPayingCapital)}</span>
                </div>
                <div className="plans-settings-row">
                  <div>
                    <span className="plans-settings-label">PENDING_PAYOUT</span>
                    <span className="plans-settings-lane">Claimable or payable exposure for this SKU</span>
                  </div>
                  <span className="plans-settings-address">{formatAmount(sku.pendingPayoutAmount)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="plans-card-eyebrow">ISSUE_WHEN</p>
                  <ul className="list-disc pl-5 text-sm text-[var(--muted)]">
                    {sku.issueWhen.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="plans-card-eyebrow">PAUSE_WHEN</p>
                  <ul className="list-disc pl-5 text-sm text-[var(--muted)]">
                    {sku.pauseWhen.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="plans-wizard-support-actions">
                <Link href={props.skuConsoleHrefs[sku.skuKey].claims} className="secondary-button inline-flex w-fit">
                  Open claim console
                </Link>
                <Link href={props.skuConsoleHrefs[sku.skuKey].treasury} className="secondary-button inline-flex w-fit">
                  Open reserve console
                </Link>
              </div>
            </section>
          ))}
        </div>

        <div className="plans-wizard-support-actions">
          <Link href={props.bootstrapHref} className="secondary-button inline-flex w-fit">
            Rerun Genesis template
          </Link>
          {props.planAddress ? (
            <Link href={props.claimsHref} className="secondary-button inline-flex w-fit">
              Open claim console
            </Link>
          ) : null}
          {props.planAddress ? (
            <Link href={props.treasuryHref} className="secondary-button inline-flex w-fit">
              Open Genesis treasury
            </Link>
          ) : null}
        </div>
      </article>

      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">CHECKLIST</p>
            <h2 className="plans-card-title plans-card-title-display">
              Bounded launch <em>items</em>
            </h2>
          </div>
          <span className="plans-card-meta">
            template={GENESIS_PROTECT_ACUTE_TEMPLATE_KEY}
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <article key={row.key} className="operator-summary-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{row.title}</p>
                  <p className="field-help">{row.detail}</p>
                </div>
                <span className={`status-pill ${row.ready ? "status-ok" : "status-off"}`}>
                  {row.ready ? "Ready" : "Action needed"}
                </span>
              </div>
              <Link href={row.href} className="secondary-button inline-flex w-fit">
                {row.action}
              </Link>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}
