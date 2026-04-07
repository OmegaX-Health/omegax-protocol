// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { SearchableSelect } from "@/components/searchable-select";
import { WalletButton } from "@/components/wallet-providers";
import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import {
  claimsForPool,
  defaultMemberWalletAddress,
  obligationsForPool,
  plansForPool,
  seriesForPlan,
  walletFixtureFor,
  walletReadModel,
} from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import {
  describeClaimStatus,
  describeObligationStatus,
  describeSeriesMode,
  deriveClaimCasePda,
  shortenAddress,
} from "@/lib/protocol";

const CLAIMS_PANELS = [
  { id: "draft", label: "Claim draft" },
  { id: "ledger", label: "Liability register" },
] as const;

type ClaimsPanel = (typeof CLAIMS_PANELS)[number]["id"];

export function CanonicalClaimsSurface() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();
  const [hydrated, setHydrated] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [seriesSearch, setSeriesSearch] = useState("");
  const [claimId, setClaimId] = useState("claim-draft-003");
  const [evidenceRef, setEvidenceRef] = useState("ipfs://clinical-episode-manifest");
  const [selectedPlanAddress, setSelectedPlanAddress] = useState("");
  const [selectedSeriesAddress, setSelectedSeriesAddress] = useState("");

  const poolAddress = searchParams.get("pool")?.trim() ?? "";
  const activePanel = useMemo<ClaimsPanel>(() => {
    const candidate = searchParams.get("panel");
    return candidate === "ledger" ? "ledger" : "draft";
  }, [searchParams]);

  const walletAddress = publicKey?.toBase58() ?? (hydrated ? defaultMemberWalletAddress() : "");
  const walletFixture = walletFixtureFor(walletAddress);
  const memberModel = walletReadModel(walletAddress);

  useEffect(() => {
    setHydrated(true);
  }, []);
  const availablePlans = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    const plans = plansForPool(poolAddress);
    if (!query) return plans;
    return plans.filter((plan) =>
      [plan.displayName, plan.planId, plan.sponsorLabel, plan.address].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [planSearch, poolAddress]);

  const selectedPlan = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.address === selectedPlanAddress) ?? availablePlans[0] ?? null,
    [availablePlans, selectedPlanAddress],
  );
  const availableSeries = useMemo(() => {
    const query = seriesSearch.trim().toLowerCase();
    const series = seriesForPlan(selectedPlan?.address);
    if (!query) return series;
    return series.filter((entry) =>
      [entry.displayName, entry.seriesId, entry.comparabilityKey, entry.address].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [selectedPlan, seriesSearch]);
  const selectedSeries = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === selectedSeriesAddress) ?? availableSeries[0] ?? null,
    [availableSeries, selectedSeriesAddress],
  );

  const derivedClaimAddress = useMemo(() => {
    if (!selectedPlan || !claimId.trim()) return "";
    return deriveClaimCasePda({
      healthPlan: selectedPlan.address,
      claimId: claimId.trim(),
    }).toBase58();
  }, [claimId, selectedPlan]);

  const memberPosition = useMemo(
    () =>
      DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.find((position) =>
        position.wallet === walletAddress
        && position.healthPlan === selectedPlan?.address
        && position.policySeries === selectedSeries?.address)
      ?? null,
    [selectedPlan, selectedSeries, walletAddress],
  );

  const filteredClaims = useMemo(() => {
    return claimsForPool(poolAddress).filter((claim) => {
      if (selectedPlan && claim.healthPlan !== selectedPlan.address) return false;
      if (selectedSeries && claim.policySeries !== selectedSeries.address) return false;
      return true;
    });
  }, [poolAddress, selectedPlan, selectedSeries]);

  const filteredObligations = useMemo(() => {
    return obligationsForPool(poolAddress).filter((obligation) => {
      if (selectedPlan && obligation.healthPlan !== selectedPlan.address) return false;
      if (selectedSeries && obligation.policySeries !== selectedSeries.address) return false;
      return true;
    });
  }, [poolAddress, selectedPlan, selectedSeries]);

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
    if (selectedPlan && selectedPlan.address === selectedPlanAddress) return;
    setSelectedPlanAddress(availablePlans[0]?.address ?? "");
  }, [availablePlans, selectedPlan, selectedPlanAddress]);

  useEffect(() => {
    if (selectedSeries && selectedSeries.address === selectedSeriesAddress) return;
    setSelectedSeriesAddress(availableSeries[0]?.address ?? "");
  }, [availableSeries, selectedSeries, selectedSeriesAddress]);

  return (
    <section className="protocol-section">
      <div className="protocol-section-head">
        <div>
          <p className="protocol-kicker">Wallet-aware claims console</p>
          <h2 className="protocol-section-title">Prepare canonical claim-case identifiers and inspect the matching obligation ledger.</h2>
        </div>
        <span className={`status-pill ${connected ? "status-ok" : "status-off"}`}>
          {connected ? "Connected wallet" : "Devnet preview"}
        </span>
      </div>

      <div className="protocol-workspace-panel space-y-4">
        <div className="protocol-grid-2">
          <div className="protocol-data-card">
            <p className="protocol-metric-label">Claimant posture</p>
            <div className="protocol-data-list">
              <div className="protocol-data-row">
                <span>Wallet</span>
                <span className="protocol-address">{walletAddress ? shortenAddress(walletAddress, 6) : "observer"}</span>
              </div>
              <div className="protocol-data-row">
                <span>Recognized role</span>
                <span className="protocol-meta">{walletFixture?.label ?? "Devnet member"}</span>
              </div>
              <div className="protocol-data-row">
                <span>Existing participations</span>
                <span className="protocol-meta">{memberModel?.planParticipations.length ?? 0}</span>
              </div>
            </div>
            {!connected ? <WalletButton className="wallet-button-compact mt-3" /> : null}
          </div>

          <div className="protocol-data-card">
            <p className="protocol-metric-label">Context</p>
            <div className="protocol-data-list">
              <div className="protocol-data-row">
                <span>Pool filter</span>
                <span className="protocol-address">{poolAddress ? shortenAddress(poolAddress, 6) : "all pools"}</span>
              </div>
              <div className="protocol-data-row">
                <span>Canonical route</span>
                <span className="protocol-address">{`${pathname}?panel=${activePanel}`}</span>
              </div>
              <div className="protocol-data-row">
                <span>Cross-route</span>
                <Link className="secondary-button" href={poolAddress ? buildCanonicalPoolHref(poolAddress, { section: "members" }) : "/members"}>
                  Member rights
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="protocol-route-tabs">
          {CLAIMS_PANELS.map((panel) => (
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

        {activePanel === "draft" ? (
          <div className="protocol-grid-2">
            <div className="space-y-4">
              <SearchableSelect
                label="Health plan"
                value={selectedPlan?.address ?? ""}
                options={availablePlans.map((plan) => ({
                  value: plan.address,
                  label: `${plan.displayName} (${plan.planId})`,
                  hint: `${plan.sponsorLabel} // ${plan.membershipModel}`,
                }))}
                onChange={(value) => {
                  setSelectedPlanAddress(value);
                  setSelectedSeriesAddress("");
                }}
                searchValue={planSearch}
                onSearchChange={setPlanSearch}
                placeholder="Choose plan"
                emptyMessage="No canonical plans match this filter."
              />

              <SearchableSelect
                label="Policy series"
                value={selectedSeries?.address ?? ""}
                options={availableSeries.map((series) => ({
                  value: series.address,
                  label: `${series.displayName} (${series.seriesId})`,
                  hint: `${describeSeriesMode(series.mode)} // ${series.comparabilityKey}`,
                }))}
                onChange={setSelectedSeriesAddress}
                searchValue={seriesSearch}
                onSearchChange={setSeriesSearch}
                placeholder="Choose policy series"
                emptyMessage="No policy series for this plan and pool context."
              />

              <label className="field-label">
                Claim case id
                <input className="field-input" value={claimId} onChange={(event) => setClaimId(event.target.value)} />
              </label>

              <label className="field-label">
                Evidence reference
                <input className="field-input" value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} />
              </label>
            </div>

            <div className="protocol-data-card">
              <p className="protocol-metric-label">Draft output</p>
              <div className="protocol-data-list">
                <div className="protocol-data-row">
                  <span>Derived claim case</span>
                  <span className="protocol-address">{derivedClaimAddress || "Awaiting plan + id"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Member position</span>
                  <span className="protocol-address">{memberPosition ? shortenAddress(memberPosition.address, 8) : "No matching position"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Evidence pointer</span>
                  <span className="protocol-address">{evidenceRef}</span>
                </div>
              </div>
              <p className="protocol-section-copy">
                Claim-case state remains public and economically meaningful. Sensitive source material stays offchain
                and is referenced by stable evidence pointers instead of being pushed into the protocol account set.
              </p>
            </div>
          </div>
        ) : null}

        {activePanel === "ledger" ? (
          <div className="protocol-data-list">
            {filteredClaims.map((claim) => (
              <article key={claim.address} className="protocol-data-card">
                <div className="protocol-data-row">
                  <div>
                    <p className="protocol-metric-label">{describeClaimStatus(claim.intakeStatus)}</p>
                    <h3 className="text-xl font-semibold">{claim.claimId}</h3>
                    <p className="protocol-address">{shortenAddress(claim.address, 8)}</p>
                  </div>
                  <span className="status-pill status-off">{describeClaimStatus(claim.intakeStatus).replaceAll("_", " ")}</span>
                </div>
                <div className="protocol-data-list">
                  <div className="protocol-data-row">
                    <span>Paid state</span>
                    <strong>{claim.paidAmount ? "recorded" : "pending"}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Reserve state</span>
                    <strong>{claim.reservedAmount ? "booked" : "open"}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Claimant</span>
                    <span className="protocol-address">{shortenAddress(claim.claimant, 8)}</span>
                  </div>
                </div>
              </article>
            ))}

            {filteredObligations.map((obligation) => (
              <article key={obligation.address} className="protocol-data-card">
                <div className="protocol-data-row">
                  <div>
                    <p className="protocol-metric-label">Linked obligation</p>
                    <h3 className="text-xl font-semibold">{obligation.obligationId}</h3>
                    <p className="protocol-address">{shortenAddress(obligation.address, 8)}</p>
                  </div>
                  <span className="status-pill status-ok">{describeObligationStatus(obligation.status).replaceAll("_", " ")}</span>
                </div>
                <div className="protocol-data-list">
                  <div className="protocol-data-row">
                    <span>Health plan</span>
                    <strong>{shortenAddress(obligation.healthPlan, 8)}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Policy series</span>
                    <strong>{shortenAddress(obligation.policySeries ?? "", 8)}</strong>
                  </div>
                  <div className="protocol-data-row">
                    <span>Claim case</span>
                    <strong>{obligation.claimCase ? shortenAddress(obligation.claimCase, 8) : "Direct obligation"}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
