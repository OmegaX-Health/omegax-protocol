// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchableSelect } from "@/components/searchable-select";
import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import { formatAmount, poolAddressForSeries, seriesOutcomeCount } from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { describeSeriesMode, describeSeriesStatus, shortenAddress } from "@/lib/protocol";

const SCHEMA_PANELS = [
  { id: "registry", label: "Registry" },
  { id: "inspector", label: "Inspector" },
] as const;

type SchemaPanel = (typeof SCHEMA_PANELS)[number]["id"];

export function CanonicalSchemasSurface() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [seriesSearch, setSeriesSearch] = useState("");
  const [selectedSeriesAddress, setSelectedSeriesAddress] = useState("");

  const activePanel = useMemo<SchemaPanel>(() => {
    const candidate = searchParams.get("panel");
    return candidate === "inspector" ? "inspector" : "registry";
  }, [searchParams]);
  const filteredSeries = useMemo(() => {
    const query = seriesSearch.trim().toLowerCase();
    if (!query) return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries;
    return DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.filter((series) =>
      [series.displayName, series.seriesId, series.comparabilityKey, series.termsVersion, series.address].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [seriesSearch]);
  const selectedSeries = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === selectedSeriesAddress) ?? filteredSeries[0] ?? null,
    [filteredSeries, selectedSeriesAddress],
  );

  const updateParams = useCallback(
    ({ panel }: { panel?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (typeof panel !== "undefined") {
        if (panel) params.set("panel", panel);
        else params.delete("panel");
      }
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (selectedSeries && selectedSeries.address === selectedSeriesAddress) return;
    setSelectedSeriesAddress(filteredSeries[0]?.address ?? "");
  }, [filteredSeries, selectedSeries, selectedSeriesAddress]);

  return (
    <section className="protocol-section">
      <div className="protocol-section-head">
        <div>
          <p className="protocol-kicker">Canonical schema surface</p>
          <h2 className="protocol-section-title">Comparability lives with policy series and terms versions, not hidden behind generic metadata fetches.</h2>
        </div>
        {selectedSeries ? <span className="status-pill status-ok">{selectedSeries.termsVersion}</span> : null}
      </div>

      <div className="protocol-workspace-panel space-y-4">
        <div className="protocol-route-tabs">
          {SCHEMA_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`segment-button ${activePanel === panel.id ? "segment-button-active" : ""}`}
              onClick={() => updateParams({ panel: panel.id })}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {activePanel === "registry" ? (
          <div className="protocol-register">
            {DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.map((series) => (
              <article key={series.address} className="protocol-register-row">
                <div>
                  <p className="protocol-metric-label">{series.termsVersion}</p>
                  <strong>{series.displayName}</strong>
                  <p className="protocol-address">{shortenAddress(series.address, 8)}</p>
                  <p className="protocol-section-copy">{series.comparabilityKey}</p>
                </div>
                <div className="protocol-register-metrics">
                  <span>{describeSeriesMode(series.mode)}</span>
                  <span>{describeSeriesStatus(series.status)}</span>
                  <span>{seriesOutcomeCount(series.address).toString()} outcomes</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {activePanel === "inspector" ? (
          <div className="protocol-grid-2">
            <div className="space-y-4">
              <SearchableSelect
                label="Policy series"
                value={selectedSeries?.address ?? ""}
                options={filteredSeries.map((series) => ({
                  value: series.address,
                  label: `${series.displayName} (${series.seriesId})`,
                  hint: `${series.termsVersion} // ${series.comparabilityKey}`,
                }))}
                onChange={setSelectedSeriesAddress}
                searchValue={seriesSearch}
                onSearchChange={setSeriesSearch}
                placeholder="Choose policy series"
              />

              <div className="protocol-data-card">
                <p className="protocol-metric-label">Series posture</p>
                <div className="protocol-data-list">
                  <div>
                    <strong>{selectedSeries?.displayName ?? "Awaiting selection"}</strong>
                    <p className="protocol-section-copy">{selectedSeries?.comparabilityKey ?? "Choose a policy series to inspect comparability posture."}</p>
                  </div>
                  <div className="protocol-data-row">
                    <span>Terms version</span>
                    <span className="protocol-meta">{selectedSeries?.termsVersion ?? "n/a"}</span>
                  </div>
                  <div className="protocol-data-row">
                    <span>Series id</span>
                    <span className="protocol-meta">{selectedSeries?.seriesId ?? "n/a"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="protocol-data-card">
              <p className="protocol-metric-label">Inspector output</p>
              <div className="protocol-data-list">
                <div className="protocol-data-row">
                  <span>Series address</span>
                  <span className="protocol-address">{selectedSeries?.address ?? "Awaiting selection"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Comparability key</span>
                  <span className="protocol-meta">{selectedSeries?.comparabilityKey ?? "n/a"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Status</span>
                  <span className="protocol-meta">{selectedSeries ? describeSeriesStatus(selectedSeries.status) : "n/a"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Outcome count</span>
                  <strong>{formatAmount(seriesOutcomeCount(selectedSeries?.address))}</strong>
                </div>
              </div>
              {selectedSeries && poolAddressForSeries(selectedSeries.address) ? (
                <Link
                  className="secondary-button mt-3 inline-flex"
                  href={buildCanonicalPoolHref(poolAddressForSeries(selectedSeries.address) ?? "", { section: "oracles", panel: "bindings" })}
                >
                  Open oracle bindings
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
