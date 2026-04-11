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
  defaultMemberWalletAddress,
  plansForPool,
  seriesForPlan,
  walletFixtureFor,
  walletReadModel,
} from "@/lib/canonical-ui";
import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { describeSeriesMode, deriveMemberPositionPda, shortenAddress } from "@/lib/protocol";

const MEMBER_PANELS = [
  { id: "enroll", label: "Enrollment" },
  { id: "delegate", label: "Delegation" },
] as const;

type MemberPanel = (typeof MEMBER_PANELS)[number]["id"];

function defaultRightsForMode(mode?: number): string[] {
  if (mode === 0) {
    return ["claim_reward", "view_payout_history"];
  }
  return ["open_claim_case", "appoint_delegate", "review_decisions"];
}

export function CanonicalMembersSurface() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();
  const [hydrated, setHydrated] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [seriesSearch, setSeriesSearch] = useState("");
  const [delegateWallet, setDelegateWallet] = useState(
    DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "member_delegate")?.address ?? "",
  );
  const [selectedPlanAddress, setSelectedPlanAddress] = useState("");
  const [selectedSeriesAddress, setSelectedSeriesAddress] = useState("");

  const poolAddress = searchParams.get("pool")?.trim() ?? "";
  const activePanel = useMemo<MemberPanel>(() => {
    const candidate = searchParams.get("panel");
    return candidate === "delegate" ? "delegate" : "enroll";
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
    const rows = seriesForPlan(selectedPlan?.address);
    if (!query) return rows;
    return rows.filter((series) =>
      [series.displayName, series.seriesId, series.comparabilityKey, series.address].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [selectedPlan, seriesSearch]);
  const selectedSeries = useMemo(
    () => DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === selectedSeriesAddress) ?? availableSeries[0] ?? null,
    [availableSeries, selectedSeriesAddress],
  );
  const matchingPosition = useMemo(
    () =>
      DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.find((position) =>
        position.wallet === walletAddress
        && position.healthPlan === selectedPlan?.address
        && position.policySeries === selectedSeries?.address)
      ?? null,
    [selectedPlan, selectedSeries, walletAddress],
  );

  const derivedMemberPosition = useMemo(() => {
    if (!selectedPlan || !selectedSeries || !walletAddress) return "";
    return deriveMemberPositionPda({
      healthPlan: selectedPlan.address,
      wallet: walletAddress,
      seriesScope: selectedSeries.address,
    }).toBase58();
  }, [selectedPlan, selectedSeries, walletAddress]);

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
          <p className="protocol-kicker">Canonical member surface</p>
          <h2 className="protocol-section-title">Enrollment and delegation stay on the member route instead of leaking into pool-first workspaces.</h2>
        </div>
        <span className={`status-pill ${connected ? "status-ok" : "status-off"}`}>
          {connected ? "Connected wallet" : "Devnet preview"}
        </span>
      </div>

      <div className="protocol-workspace-panel space-y-4">
        <div className="protocol-grid-2">
          <div className="protocol-data-card">
            <p className="protocol-metric-label">Member posture</p>
            <div className="protocol-data-list">
              <div className="protocol-data-row">
                <span>Wallet</span>
                <span className="protocol-address">{walletAddress ? shortenAddress(walletAddress, 6) : "observer"}</span>
              </div>
              <div className="protocol-data-row">
                <span>Role</span>
                <span className="protocol-meta">{walletFixture?.label ?? "Devnet member"}</span>
              </div>
              <div className="protocol-data-row">
                <span>Current participations</span>
                <span className="protocol-meta">{memberModel?.planParticipations.length ?? 0}</span>
              </div>
            </div>
            {!connected ? <WalletButton className="wallet-button-compact mt-3" /> : null}
          </div>

          <div className="protocol-data-card">
            <p className="protocol-metric-label">Cross-route</p>
            <div className="protocol-actions">
              <Link className="secondary-button" href={poolAddress ? buildCanonicalPoolHref(poolAddress, { section: "claims" }) : "/claims"}>
                Claims
              </Link>
              <Link className="secondary-button" href={poolAddress ? buildCanonicalPoolHref(poolAddress, { section: "liquidity" }) : "/capital"}>
                Capital context
              </Link>
            </div>
            <p className="protocol-section-copy">
              Pool context, when present, only narrows which plans are funded by that sleeve. It does not change who
              owns member rights.
            </p>
          </div>
        </div>

        <div className="protocol-route-tabs">
          {MEMBER_PANELS.map((panel) => (
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

        {activePanel === "enroll" ? (
          <div className="protocol-grid-2">
            <div className="space-y-4">
              <SearchableSelect
                label="Health plan"
                value={selectedPlan?.address ?? ""}
                options={availablePlans.map((plan) => ({
                  value: plan.address,
                  label: `${plan.displayName} (${plan.planId})`,
                  hint: `${plan.membershipModel} // ${plan.sponsorLabel}`,
                }))}
                onChange={(value) => {
                  setSelectedPlanAddress(value);
                  setSelectedSeriesAddress("");
                }}
                searchValue={planSearch}
                onSearchChange={setPlanSearch}
                placeholder="Choose plan"
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
                placeholder="Choose series"
              />
            </div>

            <div className="protocol-data-card">
              <p className="protocol-metric-label">Derived enrollment state</p>
              <div className="protocol-data-list">
                <div className="protocol-data-row">
                  <span>Member position PDA</span>
                  <span className="protocol-address">{derivedMemberPosition || "Awaiting plan + series"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Membership model</span>
                  <span className="protocol-meta">{selectedPlan?.membershipModel ?? "unknown"}</span>
                </div>
                <div className="protocol-data-row">
                  <span>Existing position</span>
                  <span className="protocol-address">{matchingPosition ? shortenAddress(matchingPosition.address, 8) : "New enrollment draft"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {defaultRightsForMode(selectedSeries?.mode).map((right) => (
                  <span key={right} className="status-pill status-off">{right}</span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activePanel === "delegate" ? (
          <div className="protocol-grid-2">
            <div className="protocol-data-card">
              <p className="protocol-metric-label">Delegation draft</p>
              <label className="field-label">
                Delegate wallet
                <input className="field-input" value={delegateWallet} onChange={(event) => setDelegateWallet(event.target.value)} />
              </label>
              <p className="protocol-section-copy">
                Delegate scope should follow the selected member position rather than broad pool authority. Keep the
                rights list narrow and explicit.
              </p>
            </div>

            <div className="protocol-data-card">
              <p className="protocol-metric-label">Current rights</p>
              <div className="protocol-data-list">
                {(matchingPosition?.delegatedRights ?? defaultRightsForMode(selectedSeries?.mode)).map((right) => (
                  <div key={right} className="protocol-data-row">
                    <span>{right}</span>
                    <span className="protocol-address">{shortenAddress(delegateWallet || walletAddress, 6)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
