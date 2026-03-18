// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { FieldHint } from "@/components/field-hint";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";

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

function planTypeLabel(planType: PlanType): string {
  if (planType === "rewards") return "Rewards";
  if (planType === "insurance") return "Insurance";
  return "Hybrid";
}

function planTypeDescription(planType: PlanType): string {
  if (planType === "rewards") return "Rewards plans pay incentives only.";
  if (planType === "insurance") return "Insurance plans need a coverage path before launch.";
  return "Hybrid plans combine rewards with a coverage path.";
}

function coveragePathLabel(pathway: CoveragePathway): string {
  if (pathway === "defi_native") return "DeFi native";
  if (pathway === "rwa_policy") return "RWA policy";
  return "Choose a coverage path";
}

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
    <section className="wizard-section">
      <div className="wizard-section-heading">
        <div className="space-y-1">
          <p className="wizard-section-kicker">Step 1</p>
          <h3 className="wizard-section-title">What kind of plan are you launching?</h3>
        </div>
        <FieldHint
          content="Pick the closest launch type first. You can still preview later steps before connecting a wallet."
          side="end"
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="wizard-section-label">Plan style</p>
          <span className="status-pill status-off">{planTypeLabel(planType)}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            className={`segment-button ${planType === "rewards" ? "segment-button-active" : ""}`}
            onClick={() => onPlanTypeChange("rewards")}
          >
            Rewards
          </button>
          <button
            type="button"
            className={`segment-button ${planType === "insurance" ? "segment-button-active" : ""}`}
            onClick={() => onPlanTypeChange("insurance")}
          >
            Insurance
          </button>
          <button
            type="button"
            className={`segment-button ${planType === "hybrid" ? "segment-button-active" : ""}`}
            onClick={() => onPlanTypeChange("hybrid")}
          >
            Hybrid
          </button>
        </div>
        <p className="wizard-inline-copy">{planTypeDescription(planType)}</p>
      </div>

      {requiresCoveragePathway ? (
        <div className="wizard-section-block">
          <div className="wizard-inline-head">
            <div className="flex flex-wrap items-center gap-2">
              <p className="wizard-section-label">Coverage path</p>
              <span className="status-pill status-off">{coveragePathLabel(coveragePathway)}</span>
            </div>
            <FieldHint
              content="This launch step only records the public settlement path and references. Detailed coverage products are configured later in the workspace."
              side="end"
            />
          </div>

          <div className={`grid gap-2 ${ENABLE_RWA_POLICY ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
            <button
              type="button"
              className={`segment-button ${coveragePathway === "defi_native" ? "segment-button-active" : ""}`}
              onClick={() => onCoveragePathwayChange("defi_native")}
            >
              DeFi native
            </button>
            {ENABLE_RWA_POLICY ? (
              <button
                type="button"
                className={`segment-button ${coveragePathway === "rwa_policy" ? "segment-button-active" : ""}`}
                onClick={() => onCoveragePathwayChange("rwa_policy")}
              >
                RWA policy
              </button>
            ) : null}
          </div>

          {!coveragePathway ? (
            <p className="wizard-inline-copy">Choose a coverage path to finish the launch setup.</p>
          ) : null}

          {coveragePathway === "defi_native" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <div className="wizard-inline-head">
                  <p className="wizard-section-label">Settlement style</p>
                  <FieldHint
                    content="Use the style that matches how claims and coverage payouts will be operationally settled after launch."
                    side="end"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`segment-button ${defiSettlementMode === "onchain_programmatic" ? "segment-button-active" : ""}`}
                    onClick={() => onDefiSettlementModeChange("onchain_programmatic")}
                  >
                    On-chain programmatic
                  </button>
                  <button
                    type="button"
                    className={`segment-button ${defiSettlementMode === "hybrid_rails" ? "segment-button-active" : ""}`}
                    onClick={() => onDefiSettlementModeChange("hybrid_rails")}
                  >
                    Hybrid rails
                  </button>
                </div>
              </div>
              <label className="field-label">
                Technical terms URL
                <input
                  className="field-input mt-1"
                  value={defiTechnicalTermsUri}
                  onChange={(event) => onDefiTechnicalTermsUriChange(event.target.value)}
                  placeholder="https://plan.yourorg.com/technical-terms"
                />
              </label>
              <label className="field-label">
                Risk disclosure URL
                <input
                  className="field-input mt-1"
                  value={defiRiskDisclosureUri}
                  onChange={(event) => onDefiRiskDisclosureUriChange(event.target.value)}
                  placeholder="https://plan.yourorg.com/risk-disclosures"
                />
              </label>
            </div>
          ) : null}

          {ENABLE_RWA_POLICY && coveragePathway === "rwa_policy" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field-label">
                Issuer legal name
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
                Policy terms URL
                <input
                  className="field-input mt-1"
                  value={rwaPolicyTermsUri}
                  onChange={(event) => onRwaPolicyTermsUriChange(event.target.value)}
                  placeholder="https://issuer.yourorg.com/policy-terms"
                />
              </label>
              <label className="field-label">
                License reference
                <input
                  className="field-input mt-1"
                  value={rwaRegulatoryLicenseRef}
                  onChange={(event) => onRwaRegulatoryLicenseRefChange(event.target.value)}
                  placeholder="License or registration ID"
                />
              </label>
              <label className="field-label">
                Compliance contact
                <input
                  className="field-input mt-1"
                  value={rwaComplianceContact}
                  onChange={(event) => onRwaComplianceContactChange(event.target.value)}
                  placeholder="compliance@yourorg.com"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="wizard-section-block">
        <div className="wizard-inline-head">
          <p className="wizard-section-label">How should people recognize this plan?</p>
          <FieldHint
            content="These are the public-facing identifiers and links that appear in the workspace once the plan is live."
            side="end"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Organization name
            <input
              className="field-input"
              value={organizationRef}
              onChange={(event) => onOrganizationRefChange(event.target.value)}
            />
          </label>
          <label className="field-label">
            <span className="inline-flex items-center gap-1.5">
              Plan ID ({poolIdBytes}/32 bytes)
              <FieldHint
                content="Keep this short and stable. It becomes the plan's unique on-chain seed."
                label="About plan ID"
              />
            </span>
            <input
              className="field-input"
              value={poolId}
              onChange={(event) => onPoolIdChange(event.target.value)}
            />
          </label>
          <label className="field-label sm:col-span-2">
            <span className="inline-flex items-center gap-1.5">
              Public details URL
              <FieldHint
                content="Share the overview, policy page, or docs people should land on from the workspace."
                label="About public details URL"
              />
            </span>
            <input
              className="field-input"
              value={metadataUri}
              onChange={(event) => onMetadataUriChange(event.target.value)}
              placeholder="https://plan.yourorg.com/overview"
            />
          </label>
        </div>
      </div>

      <div className="wizard-section-block">
        <div className="wizard-inline-head">
          <p className="wizard-section-label">How will payouts be funded?</p>
          <FieldHint
            content="Choose the asset the launch vault will hold. Reward payout amount only matters for rewards and hybrid plans."
            side="end"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="wizard-section-label">Payout asset</p>
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
                SPL token
              </button>
            </div>
          </div>

          {planType === "rewards" || planType === "hybrid" ? (
            <label className="field-label">
              <span className="inline-flex items-center gap-1.5">
                Reward payout amount
                <FieldHint
                  content="This amount is used whenever a reward rule resolves successfully."
                  label="About reward payout amount"
                />
              </span>
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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="field-label">
              Payout token mint
              <input
                className="field-input"
                value={payoutMint}
                onChange={(event) => onPayoutMintChange(event.target.value)}
              />
            </label>
            <button type="button" className="secondary-button" onClick={onUseDefaultPayoutMint}>
              Use default mint
            </button>
          </div>
        ) : null}
      </div>

      <ProtocolDetailDisclosure
        title="Protocol details"
        summary="Raw hashes and the predicted plan address stay tucked away unless you need to inspect them."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Terms hash override
            <input
              className="field-input"
              value={termsHashHex}
              onChange={(event) => onTermsHashHexChange(event.target.value)}
              placeholder="Optional 32-byte hex"
            />
          </label>
          <label className="field-label">
            Payout policy hash override
            <input
              className="field-input"
              value={payoutPolicyHashHex}
              onChange={(event) => onPayoutPolicyHashHexChange(event.target.value)}
              placeholder="Optional 32-byte hex"
            />
          </label>
        </div>
        {predictedPoolAddress ? (
          <div className="monitor-row">
            <span>Predicted plan address</span>
            <span className="break-all text-right">{predictedPoolAddress}</span>
          </div>
        ) : null}
      </ProtocolDetailDisclosure>
    </section>
  );
}
