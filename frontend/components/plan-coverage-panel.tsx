// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { formatAmount } from "@/lib/canonical-ui";
import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import {
  type AllocationPositionSnapshot,
  availableFundingLineBalance,
  describeFundingLineType,
  describeSeriesStatus,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  type LiquidityPoolSnapshot,
  SERIES_MODE_PROTECTION,
  shortenAddress,
  type FundingLineSnapshot,
  type PolicySeriesSnapshot,
} from "@/lib/protocol";
import {
  fetchProtectionMetadataDocument,
  type ProtectionMetadataDocument,
} from "@/lib/protection-metadata";

type PlanCoveragePanelProps = {
  activeSeriesAddress?: string | null;
  allocationPositions: AllocationPositionSnapshot[];
  fundingLines: FundingLineSnapshot[];
  liquidityPools: LiquidityPoolSnapshot[];
  planAddress: string;
  policySeries: PolicySeriesSnapshot[];
};

function humanizeFundingLineType(lineType: number): string {
  const raw = describeFundingLineType(lineType);
  if (raw.startsWith("unknown")) return raw;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizePathway(value?: string): string {
  if (!value) return "—";
  switch (value) {
    case "defi_native": return "DeFi native";
    case "traditional": return "Traditional";
    case "hybrid": return "Hybrid";
    default: return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function humanizeSettlement(value?: string): string {
  if (!value) return "—";
  switch (value) {
    case "onchain_programmatic": return "On-chain programmatic";
    case "onchain_attested": return "On-chain attested";
    case "offchain_manual": return "Off-chain manual";
    default: return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function cadenceLabel(cycleSeconds?: number): string {
  if (!cycleSeconds || cycleSeconds <= 0) return "—";
  const cycleDays = Math.round(cycleSeconds / 86_400);
  return `Every ${cycleDays} day${cycleDays === 1 ? "" : "s"}`;
}

export function PlanCoveragePanel({
  activeSeriesAddress,
  allocationPositions,
  fundingLines,
  liquidityPools,
  planAddress,
  policySeries,
}: PlanCoveragePanelProps) {
  const protectionSeries = useMemo(
    () => policySeries.filter((series) => series.mode === SERIES_MODE_PROTECTION),
    [policySeries],
  );
  const activeSeries = useMemo(
    () =>
      protectionSeries.find((series) => series.address === (activeSeriesAddress ?? ""))
      ?? protectionSeries[0]
      ?? null,
    [activeSeriesAddress, protectionSeries],
  );
  const [metadataDocument, setMetadataDocument] = useState<ProtectionMetadataDocument | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!activeSeries?.metadataUri) {
      setMetadataDocument(null);
      setMetadataError("This protection series does not publish a metadata URI yet.");
      setMetadataLoading(false);
      return;
    }

    setMetadataLoading(true);
    setMetadataError(null);
    void (async () => {
      const result = await fetchProtectionMetadataDocument(activeSeries.metadataUri ?? "");
      if (cancelled) return;
      setMetadataDocument(result.document);
      setMetadataError(result.error?.message ?? null);
      setMetadataLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSeries?.metadataUri]);

  const premiumLines = useMemo(
    () =>
      fundingLines.filter(
        (line) =>
          line.policySeries === activeSeries?.address
          && line.lineType === FUNDING_LINE_TYPE_PREMIUM_INCOME,
      ),
    [activeSeries?.address, fundingLines],
  );

  const linkedAllocations = useMemo(
    () => allocationPositions.filter((row) => row.policySeries === activeSeries?.address),
    [activeSeries?.address, allocationPositions],
  );
  const linkedPools = useMemo(() => {
    const seen = new Set<string>();
    return linkedAllocations
      .map((allocation) => allocation.liquidityPool)
      .filter((poolAddress): poolAddress is string => Boolean(poolAddress))
      .filter((poolAddress) => {
        if (seen.has(poolAddress)) return false;
        seen.add(poolAddress);
        return true;
      })
      .map((poolAddress) => liquidityPools.find((pool) => pool.address === poolAddress) ?? null)
      .filter((pool): pool is NonNullable<typeof pool> => Boolean(pool));
  }, [liquidityPools, linkedAllocations]);

  if (protectionSeries.length === 0) {
    return (
      <div className="plans-stack">
        <article className="plans-card heavy-glass">
          <div className="plans-card-head">
            <div>
              <p className="plans-card-eyebrow">Coverage</p>
              <h2 className="plans-card-title plans-card-title-display">
                No <em>coverage</em> configured
              </h2>
            </div>
          </div>
          <p className="plans-card-body">
            This plan doesn’t have any protection lanes yet. Add one from the creation wizard when you’re ready.
          </p>
        </article>
      </div>
    );
  }

  return (
    <div className="plans-stack">
      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">Coverage</p>
            <h2 className="plans-card-title plans-card-title-display">
              {activeSeries?.displayName ?? "Coverage lane"}
            </h2>
          </div>
          <span className="plans-card-meta">{describeSeriesStatus(activeSeries?.status ?? 0)}</span>
        </div>
        <div className="plans-wizard-review-grid">
          <div className="plans-review-row">
            <span className="plans-review-label">Premium schedule</span>
            <span className="plans-review-value">{cadenceLabel(activeSeries?.cycleSeconds)}</span>
          </div>
          <div className="plans-review-row">
            <span className="plans-review-label">Series</span>
            <span className="plans-review-value">{activeSeries?.seriesId ?? "—"}</span>
          </div>
        </div>
        {activeSeries ? (
          <ProtocolDetailDisclosure
            title="Protocol details"
            summary="On-chain addresses for this series."
          >
            <div className="plans-wizard-review-grid">
              <div className="plans-review-row">
                <span className="plans-review-label">Series address</span>
                <span className="plans-review-value break-all">{shortenAddress(activeSeries.address, 6)}</span>
              </div>
              <div className="plans-review-row">
                <span className="plans-review-label">Plan address</span>
                <span className="plans-review-value break-all">{shortenAddress(planAddress, 6)}</span>
              </div>
            </div>
          </ProtocolDetailDisclosure>
        ) : null}
      </article>

      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">Coverage details</p>
            <h2 className="plans-card-title plans-card-title-display">
              Public <em>terms</em>
            </h2>
          </div>
        </div>
        {metadataLoading ? (
          <p className="plans-card-body">Loading coverage details…</p>
        ) : metadataError ? (
          <p className="plans-card-body">{metadataError}</p>
        ) : metadataDocument ? (
          <div className="plans-wizard-review-grid">
            <div className="plans-review-row">
              <span className="plans-review-label">Pathway</span>
              <span className="plans-review-value">{humanizePathway(metadataDocument.coveragePathway)}</span>
            </div>
            {metadataDocument.defi ? (
              <>
                <div className="plans-review-row">
                  <span className="plans-review-label">Settlement</span>
                  <span className="plans-review-value">{humanizeSettlement(metadataDocument.defi.settlementStyle)}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">Technical terms</span>
                  <span className="plans-review-value break-all">
                    <a href={metadataDocument.defi.technicalTermsUri} target="_blank" rel="noreferrer">
                      {metadataDocument.defi.technicalTermsUri}
                    </a>
                  </span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">Risk disclosure</span>
                  <span className="plans-review-value break-all">
                    <a href={metadataDocument.defi.riskDisclosureUri} target="_blank" rel="noreferrer">
                      {metadataDocument.defi.riskDisclosureUri}
                    </a>
                  </span>
                </div>
              </>
            ) : null}
            {metadataDocument.rwa ? (
              <>
                <div className="plans-review-row">
                  <span className="plans-review-label">Legal entity</span>
                  <span className="plans-review-value">{metadataDocument.rwa.legalEntityName}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">Jurisdiction</span>
                  <span className="plans-review-value">{metadataDocument.rwa.jurisdiction}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">Policy terms</span>
                  <span className="plans-review-value break-all">
                    <a href={metadataDocument.rwa.policyTermsUri} target="_blank" rel="noreferrer">
                      {metadataDocument.rwa.policyTermsUri}
                    </a>
                  </span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">License reference</span>
                  <span className="plans-review-value">{metadataDocument.rwa.regulatoryLicenseRef}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">Compliance contact</span>
                  <span className="plans-review-value">{metadataDocument.rwa.complianceContact}</span>
                </div>
              </>
            ) : null}
            <ProtocolDetailDisclosure
              title="Protocol details"
              summary="Raw metadata URI."
            >
              <div className="plans-review-row">
                <span className="plans-review-label">Metadata URI</span>
                <span className="plans-review-value break-all">{metadataDocument.metadataUri}</span>
              </div>
            </ProtocolDetailDisclosure>
          </div>
        ) : (
          <p className="plans-card-body">No public coverage details have been published for this series.</p>
        )}
      </article>

      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">Premium</p>
            <h2 className="plans-card-title plans-card-title-display">
              Premium <em>funding</em>
            </h2>
          </div>
          <span className="plans-card-meta">{premiumLines.length} tracked</span>
        </div>
        {premiumLines.length > 0 ? (
          <div className="plans-table-wrap">
            <table className="plans-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Type</th>
                  <th>Funded</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {premiumLines.map((line) => (
                  <tr key={line.address}>
                    <td data-label="Line">{line.displayName}</td>
                    <td data-label="Type">{humanizeFundingLineType(line.lineType)}</td>
                    <td data-label="Funded">{formatAmount(line.fundedAmount)}</td>
                    <td data-label="Available">{formatAmount(availableFundingLineBalance(line))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="plans-card-body">No premium funding line is linked to this coverage yet.</p>
        )}
      </article>

      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">Capital</p>
            <h2 className="plans-card-title plans-card-title-display">
              Linked <em>pools</em>
            </h2>
          </div>
          <span className="plans-card-meta">{linkedPools.length} pool{linkedPools.length === 1 ? "" : "s"}</span>
        </div>
        {linkedPools.length === 0 ? (
          <p className="plans-card-body">No capital pool is linked to this coverage yet.</p>
        ) : (
          <div className="plans-lane-stack">
            {linkedPools.map((pool) => (
              <div key={pool.address} className="plans-lane">
                <div className="plans-lane-info">
                  <span className="plans-lane-name">{pool.displayName}</span>
                  <span className="plans-lane-key">{pool.poolId}</span>
                </div>
                <div className="plans-lane-meta">
                  {linkedPools.length === 1 ? (
                    <Link href={buildCanonicalPoolHref(pool.address, { section: "coverage" })} className="secondary-button inline-flex">
                      Open pool
                    </Link>
                  ) : (
                    <span className="plans-lane-mode">Multiple pools — pick one explicitly.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
