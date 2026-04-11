// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function cadenceLabel(cycleSeconds?: number): string {
  if (!cycleSeconds || cycleSeconds <= 0) return "Not published";
  const cycleDays = Math.round(cycleSeconds / 86_400);
  return `${cycleDays} day${cycleDays === 1 ? "" : "s"}`;
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
              <p className="plans-card-eyebrow">COVERAGE_WORKSPACE</p>
              <h2 className="plans-card-title plans-card-title-display">
                No <em>protection lanes</em>
              </h2>
            </div>
          </div>
          <p className="plans-card-body">
            This plan does not currently expose a protection `PolicySeries`, so the coverage workspace stays hidden until one exists.
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
            <p className="plans-card-eyebrow">PROTECTION_SERIES</p>
            <h2 className="plans-card-title plans-card-title-display">
              {activeSeries?.displayName ?? "Coverage lane"}
            </h2>
          </div>
          <span className="plans-card-meta">{describeSeriesStatus(activeSeries?.status ?? 0)}</span>
        </div>
        <div className="plans-wizard-review-grid">
          <div className="plans-review-row">
            <span className="plans-review-label">SERIES_ID</span>
            <span className="plans-review-value">{activeSeries?.seriesId ?? "—"}</span>
          </div>
          <div className="plans-review-row">
            <span className="plans-review-label">SERIES_ADDRESS</span>
            <span className="plans-review-value">{shortenAddress(activeSeries?.address ?? "", 6)}</span>
          </div>
          <div className="plans-review-row">
            <span className="plans-review-label">PLAN</span>
            <span className="plans-review-value">{shortenAddress(planAddress, 6)}</span>
          </div>
          <div className="plans-review-row">
            <span className="plans-review-label">PREMIUM_CADENCE</span>
            <span className="plans-review-value">{cadenceLabel(activeSeries?.cycleSeconds)}</span>
          </div>
        </div>
      </article>

      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">PUBLIC_PROTECTION_METADATA</p>
            <h2 className="plans-card-title plans-card-title-display">
              Coverage <em>posture</em>
            </h2>
          </div>
          <span className="plans-card-meta">{activeSeries?.metadataUri ?? "No URI"}</span>
        </div>
        {metadataLoading ? (
          <p className="plans-card-body">Loading structured protection metadata…</p>
        ) : metadataError ? (
          <p className="plans-card-body">{metadataError}</p>
        ) : metadataDocument ? (
          <div className="plans-wizard-review-grid">
            <div className="plans-review-row">
              <span className="plans-review-label">PATHWAY</span>
              <span className="plans-review-value">{metadataDocument.coveragePathway}</span>
            </div>
            <div className="plans-review-row">
              <span className="plans-review-label">METADATA_URI</span>
              <span className="plans-review-value">{metadataDocument.metadataUri}</span>
            </div>
            {metadataDocument.defi ? (
              <>
                <div className="plans-review-row">
                  <span className="plans-review-label">SETTLEMENT</span>
                  <span className="plans-review-value">{metadataDocument.defi.settlementStyle}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">TECHNICAL_TERMS</span>
                  <span className="plans-review-value">{metadataDocument.defi.technicalTermsUri}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">RISK_DISCLOSURE</span>
                  <span className="plans-review-value">{metadataDocument.defi.riskDisclosureUri}</span>
                </div>
              </>
            ) : null}
            {metadataDocument.rwa ? (
              <>
                <div className="plans-review-row">
                  <span className="plans-review-label">LEGAL_ENTITY</span>
                  <span className="plans-review-value">{metadataDocument.rwa.legalEntityName}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">JURISDICTION</span>
                  <span className="plans-review-value">{metadataDocument.rwa.jurisdiction}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">POLICY_TERMS</span>
                  <span className="plans-review-value">{metadataDocument.rwa.policyTermsUri}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">LICENSE_REF</span>
                  <span className="plans-review-value">{metadataDocument.rwa.regulatoryLicenseRef}</span>
                </div>
                <div className="plans-review-row">
                  <span className="plans-review-label">COMPLIANCE_CONTACT</span>
                  <span className="plans-review-value">{metadataDocument.rwa.complianceContact}</span>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <p className="plans-card-body">No structured protection metadata could be read for this series.</p>
        )}
      </article>

      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">PREMIUM_INCOME_LINES</p>
            <h2 className="plans-card-title plans-card-title-display">
              Premium <em>rails</em>
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
                    <td data-label="Type">{describeFundingLineType(line.lineType)}</td>
                    <td data-label="Funded">{formatAmount(line.fundedAmount)}</td>
                    <td data-label="Available">{formatAmount(availableFundingLineBalance(line))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="plans-card-body">No premium-income funding line is currently linked to this protection series.</p>
        )}
      </article>

      <article className="plans-card heavy-glass">
        <div className="plans-card-head">
          <div>
            <p className="plans-card-eyebrow">LINKED_CAPITAL_CONTEXT</p>
            <h2 className="plans-card-title plans-card-title-display">
              Pool and capital <em>support</em>
            </h2>
          </div>
          <span className="plans-card-meta">{linkedPools.length} pool{linkedPools.length === 1 ? "" : "s"}</span>
        </div>
        {linkedPools.length === 0 ? (
          <p className="plans-card-body">No capital pool linkage is currently recorded for this protection series.</p>
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
                      Open pool coverage tools
                    </Link>
                  ) : (
                    <span className="plans-lane-mode">Multiple linked pools; choose pool-specific tooling explicitly.</span>
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
