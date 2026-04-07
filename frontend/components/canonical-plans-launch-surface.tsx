// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";

import { WalletButton } from "@/components/wallet-providers";
import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import { walletFixtureFor } from "@/lib/canonical-ui";
import { buildCanonicalConsoleState } from "@/lib/console-model";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import {
  deriveFundingLinePda,
  deriveHealthPlanPda,
  derivePolicySeriesPda,
  describeSeriesMode,
  shortenAddress,
} from "@/lib/protocol";

const SERIES_MODES = [
  { value: 0, label: "Reward" },
  { value: 1, label: "Protection" },
] as const;

function seedId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return (normalized || fallback).slice(0, 32);
}

function fundingLineSeed(planSeed: string, suffix: string): string {
  const suffixBlock = `-${suffix}`;
  const room = Math.max(1, 32 - suffixBlock.length);
  return `${planSeed.slice(0, room)}${suffixBlock}`;
}

export function CanonicalPlansLaunchSurface() {
  const { publicKey, connected } = useWallet();
  const [reserveDomain, setReserveDomain] = useState(DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains[0]?.address ?? "");
  const [planId, setPlanId] = useState("omegax-population-health");
  const [displayName, setDisplayName] = useState("OmegaX Population Health");
  const [sponsorLabel, setSponsorLabel] = useState("Population Health Sponsor");
  const [seriesId, setSeriesId] = useState("population-rewards-2026");
  const [seriesMode, setSeriesMode] = useState<number>(0);

  const consoleState = useMemo(() => buildCanonicalConsoleState(), []);
  const walletFixture = walletFixtureFor(publicKey?.toBase58());
  const planSeed = useMemo(() => seedId(planId, "draft-plan"), [planId]);
  const seriesSeed = useMemo(() => seedId(seriesId, "draft-series"), [seriesId]);
  const proposedPlanAddress = useMemo(
    () => deriveHealthPlanPda({ reserveDomain, planId: planSeed }).toBase58(),
    [planSeed, reserveDomain],
  );
  const proposedSeriesAddress = useMemo(
    () => derivePolicySeriesPda({ healthPlan: proposedPlanAddress, seriesId: seriesSeed }).toBase58(),
    [proposedPlanAddress, seriesSeed],
  );
  const sponsorFundingLine = useMemo(
    () => deriveFundingLinePda({ healthPlan: proposedPlanAddress, lineId: fundingLineSeed(planSeed, "sponsor") }).toBase58(),
    [planSeed, proposedPlanAddress],
  );
  const capitalFundingLine = useMemo(
    () => deriveFundingLinePda({ healthPlan: proposedPlanAddress, lineId: fundingLineSeed(planSeed, "capital") }).toBase58(),
    [planSeed, proposedPlanAddress],
  );
  const firstPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0];

  return (
    <div className="protocol-workspace-panel space-y-4">
      <div className="protocol-grid-2">
        <div className="space-y-4">
          <label className="field-label">
            Reserve domain
            <select className="field-input" value={reserveDomain} onChange={(event) => setReserveDomain(event.target.value)}>
              {DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.map((domain) => (
                <option key={domain.address} value={domain.address}>
                  {domain.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Plan id
            <input className="field-input" value={planId} onChange={(event) => setPlanId(event.target.value)} />
          </label>

          <label className="field-label">
            Display name
            <input className="field-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>

          <label className="field-label">
            Sponsor label
            <input className="field-input" value={sponsorLabel} onChange={(event) => setSponsorLabel(event.target.value)} />
          </label>

          <label className="field-label">
            Initial series id
            <input className="field-input" value={seriesId} onChange={(event) => setSeriesId(event.target.value)} />
          </label>

          <label className="field-label">
            Initial series mode
            <select className="field-input" value={seriesMode} onChange={(event) => setSeriesMode(Number(event.target.value))}>
              {SERIES_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="protocol-data-card">
          <p className="protocol-metric-label">Launch output</p>
          <div className="protocol-data-list">
            <div className="protocol-data-row">
              <span>Connected wallet</span>
              <span className="protocol-address">{connected ? shortenAddress(publicKey?.toBase58() ?? "", 6) : "observer"}</span>
            </div>
            <div className="protocol-data-row">
              <span>Recognized role</span>
              <span className="protocol-meta">{walletFixture?.label ?? (connected ? "Unmapped wallet" : "Wallet offline")}</span>
            </div>
            <div className="protocol-data-row">
              <span>Health plan PDA</span>
              <span className="protocol-address">{proposedPlanAddress}</span>
            </div>
            <div className="protocol-data-row">
              <span>Policy series PDA</span>
              <span className="protocol-address">{proposedSeriesAddress}</span>
            </div>
            <div className="protocol-data-row">
              <span>Sponsor funding line</span>
              <span className="protocol-address">{shortenAddress(sponsorFundingLine, 8)}</span>
            </div>
            <div className="protocol-data-row">
              <span>Capital funding line</span>
              <span className="protocol-address">{shortenAddress(capitalFundingLine, 8)}</span>
            </div>
          </div>
          {!connected ? <WalletButton className="wallet-button-compact mt-3" /> : null}
        </div>
      </div>

      <div className="protocol-data-list">
        <article className="protocol-register-row">
          <div>
            <p className="protocol-metric-label">Step 01</p>
            <strong>Boundary first</strong>
            <p className="protocol-section-copy">
              Plan creation starts at the reserve-domain boundary so sponsor liabilities, rails, and operator scopes stay explicit from day one.
            </p>
          </div>
          <div className="protocol-register-metrics">
            <span>{shortenAddress(reserveDomain, 6)}</span>
            <span>Reserve anchored</span>
          </div>
        </article>

        <article className="protocol-register-row">
          <div>
            <p className="protocol-metric-label">Step 02</p>
            <strong>Series semantics</strong>
            <p className="protocol-section-copy">
              Initial lane: {describeSeriesMode(seriesMode).replaceAll("_", " ")}. Terms versioning and comparability should remain attached to the policy-series layer.
            </p>
          </div>
          <div className="protocol-register-metrics">
            <span>{seriesSeed}</span>
            <span>{describeSeriesMode(seriesMode).replaceAll("_", " ")}</span>
          </div>
        </article>

        <article className="protocol-register-row">
          <div>
            <p className="protocol-metric-label">Step 03</p>
            <strong>Capital handoff</strong>
            <p className="protocol-section-copy">
              External liquidity enters later through an explicit funding line and pool allocation, not by turning the plan itself into an LP primitive.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="protocol-register-metrics">
              <span>{shortenAddress(capitalFundingLine, 6)}</span>
              <span>Capital line ready</span>
            </div>
            {firstPool ? (
              <Link className="secondary-button inline-flex w-fit" href={buildCanonicalPoolHref(firstPool.address, { section: "liquidity" })}>
                Open capital route
              </Link>
            ) : null}
          </div>
        </article>
      </div>

      <div className="protocol-data-card">
        <p className="protocol-metric-label">Current sponsor lanes</p>
        <div className="protocol-data-list">
          {consoleState.sponsors.map((sponsor) => (
            <div key={sponsor.healthPlanAddress} className="protocol-data-row">
              <div>
                <strong>{sponsor.planId}</strong>
                <p className="protocol-address">{shortenAddress(sponsor.healthPlanAddress, 8)}</p>
              </div>
              <p className="protocol-meta">
                {sponsor.perSeriesPerformance.length} series lanes // {Object.values(sponsor.claimCounts).reduce((sum, count) => sum + count, 0)} claim cases
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
