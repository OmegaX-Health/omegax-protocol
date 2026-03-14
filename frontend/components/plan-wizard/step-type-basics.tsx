// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

type PlanType = "rewards" | "insurance" | "hybrid";
type PayoutAssetMode = "sol" | "spl";
type CoveragePathway = "" | "defi_native" | "rwa_policy";
type DefiSettlementMode = "" | "onchain_programmatic" | "hybrid_rails";
const ENABLE_RWA_POLICY = process.env.NEXT_PUBLIC_ENABLE_RWA_POLICY === "true";

type StepTypeBasicsProps = {
  planType: PlanType;
  onPlanTypeChange: (value: PlanType) => void;
  poolId: string;
  onPoolIdChange: (value: string) => void;
  poolIdBytes: number;
  organizationRef: string;
  onOrganizationRefChange: (value: string) => void;
  metadataUri: string;
  onMetadataUriChange: (value: string) => void;
  payoutAssetMode: PayoutAssetMode;
  onPayoutAssetModeChange: (value: PayoutAssetMode) => void;
  payoutMint: string;
  onPayoutMintChange: (value: string) => void;
  onUseDefaultPayoutMint: () => void;
  payoutTokens: string;
  onPayoutTokensChange: (value: string) => void;
  expertMode: boolean;
  termsHashHex: string;
  onTermsHashHexChange: (value: string) => void;
  payoutPolicyHashHex: string;
  onPayoutPolicyHashHexChange: (value: string) => void;
  coveragePathway: CoveragePathway;
  onCoveragePathwayChange: (value: CoveragePathway) => void;
  defiSettlementMode: DefiSettlementMode;
  onDefiSettlementModeChange: (value: DefiSettlementMode) => void;
  defiTechnicalTermsUri: string;
  onDefiTechnicalTermsUriChange: (value: string) => void;
  defiRiskDisclosureUri: string;
  onDefiRiskDisclosureUriChange: (value: string) => void;
  rwaLegalEntityName: string;
  onRwaLegalEntityNameChange: (value: string) => void;
  rwaJurisdiction: string;
  onRwaJurisdictionChange: (value: string) => void;
  rwaPolicyTermsUri: string;
  onRwaPolicyTermsUriChange: (value: string) => void;
  rwaRegulatoryLicenseRef: string;
  onRwaRegulatoryLicenseRefChange: (value: string) => void;
  rwaComplianceContact: string;
  onRwaComplianceContactChange: (value: string) => void;
  predictedPoolAddress: string | null;
};

export function StepTypeBasics({
  planType,
  onPlanTypeChange,
  poolId,
  onPoolIdChange,
  poolIdBytes,
  organizationRef,
  onOrganizationRefChange,
  metadataUri,
  onMetadataUriChange,
  payoutAssetMode,
  onPayoutAssetModeChange,
  payoutMint,
  onPayoutMintChange,
  onUseDefaultPayoutMint,
  payoutTokens,
  onPayoutTokensChange,
  expertMode,
  termsHashHex,
  onTermsHashHexChange,
  payoutPolicyHashHex,
  onPayoutPolicyHashHexChange,
  coveragePathway,
  onCoveragePathwayChange,
  defiSettlementMode,
  onDefiSettlementModeChange,
  defiTechnicalTermsUri,
  onDefiTechnicalTermsUriChange,
  defiRiskDisclosureUri,
  onDefiRiskDisclosureUriChange,
  rwaLegalEntityName,
  onRwaLegalEntityNameChange,
  rwaJurisdiction,
  onRwaJurisdictionChange,
  rwaPolicyTermsUri,
  onRwaPolicyTermsUriChange,
  rwaRegulatoryLicenseRef,
  onRwaRegulatoryLicenseRefChange,
  rwaComplianceContact,
  onRwaComplianceContactChange,
  predictedPoolAddress,
}: StepTypeBasicsProps) {
  const requiresCoveragePathway = planType === "insurance" || planType === "hybrid";

  return (
    <section className="surface-card step-card space-y-4">
      <div className="step-head">
        <h3 className="step-title">1. Type & Basics</h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          className={`segment-button ${planType === "rewards" ? "segment-button-active" : ""}`}
          onClick={() => onPlanTypeChange("rewards")}
        >
          <span className="font-semibold">Rewards</span>
          <span className="block text-xs font-normal text-[var(--muted-foreground)]">Rewards-only settlement.</span>
        </button>
        <button
          type="button"
          className={`segment-button ${planType === "insurance" ? "segment-button-active" : ""}`}
          onClick={() => onPlanTypeChange("insurance")}
        >
          <span className="font-semibold">Insurance</span>
          <span className="block text-xs font-normal text-[var(--muted-foreground)]">Coverage-first with pathway-gated setup.</span>
        </button>
        <button
          type="button"
          className={`segment-button ${planType === "hybrid" ? "segment-button-active" : ""}`}
          onClick={() => onPlanTypeChange("hybrid")}
        >
          <span className="font-semibold">Hybrid</span>
          <span className="block text-xs font-normal text-[var(--muted-foreground)]">Rewards plus coverage pathway setup.</span>
        </button>
      </div>

      {requiresCoveragePathway ? (
        <p className="field-help">
          Coverage products are configured after plan creation in the pool Coverage module, then issued/subscribed per member.
        </p>
      ) : null}

      {requiresCoveragePathway ? (
        <div className="surface-card-soft space-y-3">
          <p className="metric-label">Coverage pathway (required)</p>
          <div className={`grid gap-2 ${ENABLE_RWA_POLICY ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
            <button
              type="button"
              className={`segment-button ${coveragePathway === "defi_native" ? "segment-button-active" : ""}`}
              onClick={() => onCoveragePathwayChange("defi_native")}
            >
              <span className="font-semibold">DeFi Native</span>
              <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                Contract-native coverage with programmatic settlement controls.
              </span>
            </button>
            {ENABLE_RWA_POLICY ? (
              <button
                type="button"
                className={`segment-button ${coveragePathway === "rwa_policy" ? "segment-button-active" : ""}`}
                onClick={() => onCoveragePathwayChange("rwa_policy")}
              >
                <span className="font-semibold">RWA Policy</span>
                <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                  Institution-backed policy configuration with legal/compliance references.
                </span>
              </button>
            ) : null}
          </div>
          {!ENABLE_RWA_POLICY ? (
            <p className="field-help">Mainnet path is DeFi Native for now. RWA policy setup stays internal-only until it is production-ready.</p>
          ) : null}
          {!coveragePathway ? <p className="field-help">Choose one pathway to continue with insurance/hybrid setup.</p> : null}

          {coveragePathway === "defi_native" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <p className="metric-label">DeFi settlement mode</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`segment-button ${defiSettlementMode === "onchain_programmatic" ? "segment-button-active" : ""}`}
                    onClick={() => onDefiSettlementModeChange("onchain_programmatic")}
                  >
                    On-chain Programmatic
                  </button>
                  <button
                    type="button"
                    className={`segment-button ${defiSettlementMode === "hybrid_rails" ? "segment-button-active" : ""}`}
                    onClick={() => onDefiSettlementModeChange("hybrid_rails")}
                  >
                    Hybrid Rails
                  </button>
                </div>
              </div>
              <label className="field-label">
                Technical terms URI
                <input
                  className="field-input mt-1"
                  value={defiTechnicalTermsUri}
                  onChange={(event) => onDefiTechnicalTermsUriChange(event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className="field-label">
                Risk disclosure URI
                <input
                  className="field-input mt-1"
                  value={defiRiskDisclosureUri}
                  onChange={(event) => onDefiRiskDisclosureUriChange(event.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>
          ) : null}

          {ENABLE_RWA_POLICY && coveragePathway === "rwa_policy" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Legal entity name
                <input
                  className="field-input mt-1"
                  value={rwaLegalEntityName}
                  onChange={(event) => onRwaLegalEntityNameChange(event.target.value)}
                  placeholder="Issuer legal name"
                />
              </label>
              <label className="field-label">
                Jurisdiction
                <input
                  className="field-input mt-1"
                  value={rwaJurisdiction}
                  onChange={(event) => onRwaJurisdictionChange(event.target.value)}
                  placeholder="US-DE, UK, SG, etc."
                />
              </label>
              <label className="field-label sm:col-span-2">
                Policy terms URI
                <input
                  className="field-input mt-1"
                  value={rwaPolicyTermsUri}
                  onChange={(event) => onRwaPolicyTermsUriChange(event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className="field-label">
                Regulatory/license reference
                <input
                  className="field-input mt-1"
                  value={rwaRegulatoryLicenseRef}
                  onChange={(event) => onRwaRegulatoryLicenseRefChange(event.target.value)}
                  placeholder="License/registration ID"
                />
              </label>
              <label className="field-label">
                Compliance contact (email or URL)
                <input
                  className="field-input mt-1"
                  value={rwaComplianceContact}
                  onChange={(event) => onRwaComplianceContactChange(event.target.value)}
                  placeholder="compliance@example.com"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label">
          Health Plan ID ({poolIdBytes}/32 bytes)
          <input className="field-input" value={poolId} onChange={(event) => onPoolIdChange(event.target.value)} />
        </label>
        <label className="field-label">
          Organization / Sponsor Name
          <input className="field-input" value={organizationRef} onChange={(event) => onOrganizationRefChange(event.target.value)} />
        </label>
        <label className="field-label sm:col-span-2">
          Plan metadata URI
          <input className="field-input" value={metadataUri} onChange={(event) => onMetadataUriChange(event.target.value)} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="metric-label">Payout asset</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`segment-button ${payoutAssetMode === "sol" ? "segment-button-active" : ""}`}
              onClick={() => onPayoutAssetModeChange("sol")}
            >
              SOL
            </button>
            <button
              type="button"
              className={`segment-button ${payoutAssetMode === "spl" ? "segment-button-active" : ""}`}
              onClick={() => onPayoutAssetModeChange("spl")}
            >
              SPL Token
            </button>
          </div>
        </div>
        {(planType === "rewards" || planType === "hybrid") ? (
          <label className="field-label">
            Reward payout per success (tokens)
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.000001"
              value={payoutTokens}
              onChange={(event) => onPayoutTokensChange(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      {payoutAssetMode === "spl" ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="field-label">
            Payout mint address
            <input className="field-input" value={payoutMint} onChange={(event) => onPayoutMintChange(event.target.value)} />
          </label>
          <button type="button" className="secondary-button" onClick={onUseDefaultPayoutMint}>
            Use default mint
          </button>
        </div>
      ) : null}

      {expertMode ? (
        <div className="surface-card-soft space-y-3">
          <p className="metric-label">Expert settings</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-label">
              Terms hash override
              <input className="field-input" value={termsHashHex} onChange={(event) => onTermsHashHexChange(event.target.value)} />
            </label>
            <label className="field-label">
              Payout policy hash override
              <input className="field-input" value={payoutPolicyHashHex} onChange={(event) => onPayoutPolicyHashHexChange(event.target.value)} />
            </label>
          </div>
          {planType === "insurance" ? (
            <p className="field-help">
              Reward payout remains an internal required contract field for insurance-first plans.
            </p>
          ) : null}
        </div>
      ) : null}

      {predictedPoolAddress ? <p className="field-help">Predicted pool PDA: {predictedPoolAddress}</p> : null}
    </section>
  );
}
