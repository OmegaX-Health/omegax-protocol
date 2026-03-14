// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";

type PlanType = "rewards" | "insurance" | "hybrid";
type MembershipMode = "open" | "token_gate" | "invite_only";
type PayoutAssetMode = "sol" | "spl";
type CoveragePathway = "" | "defi_native" | "rwa_policy";
type DefiSettlementMode = "" | "onchain_programmatic" | "hybrid_rails";
const ENABLE_RWA_POLICY = process.env.NEXT_PUBLIC_ENABLE_RWA_POLICY === "true";

type StepFundingReviewProps = {
  planType: PlanType;
  coveragePathway: CoveragePathway;
  defiSettlementMode: DefiSettlementMode;
  defiTechnicalTermsUri: string;
  defiRiskDisclosureUri: string;
  rwaLegalEntityName: string;
  rwaJurisdiction: string;
  rwaPolicyTermsUri: string;
  rwaRegulatoryLicenseRef: string;
  rwaComplianceContact: string;
  poolTypeLabel: string;
  payoutAssetMode: PayoutAssetMode;
  payoutMint: string;
  payoutTokens: string;
  membershipMode: MembershipMode;
  tokenGateMint: string;
  tokenGateMinBalance: string;
  inviteIssuer: string;
  selectedOraclesCount: number;
  quorumM: string;
  quorumN: string;
  selectedSchemaLabel: string;
  selectedOutcomesCount: number;
  activePoolAddress: string;
  buildPoolHref?: (poolAddress: string, section?: string) => string;
  fundSol: string;
  onFundSolChange: (value: string) => void;
  fundSpl: string;
  onFundSplChange: (value: string) => void;
  onFundPlan: () => void;
  fundDisabled: boolean;
  splDecimals: number | null;
  splAmountPreview: string;
};

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function StepFundingReview({
  planType,
  coveragePathway,
  defiSettlementMode,
  defiTechnicalTermsUri,
  defiRiskDisclosureUri,
  rwaLegalEntityName,
  rwaJurisdiction,
  rwaPolicyTermsUri,
  rwaRegulatoryLicenseRef,
  rwaComplianceContact,
  poolTypeLabel,
  payoutAssetMode,
  payoutMint,
  payoutTokens,
  membershipMode,
  tokenGateMint,
  tokenGateMinBalance,
  inviteIssuer,
  selectedOraclesCount,
  quorumM,
  quorumN,
  selectedSchemaLabel,
  selectedOutcomesCount,
  activePoolAddress,
  buildPoolHref,
  fundSol,
  onFundSolChange,
  fundSpl,
  onFundSplChange,
  onFundPlan,
  fundDisabled,
  splDecimals,
  splAmountPreview,
}: StepFundingReviewProps) {
  const requiresCoveragePathway = planType === "insurance" || planType === "hybrid";
  const workspaceHref = activePoolAddress
    ? (buildPoolHref ? buildPoolHref(activePoolAddress) : `/pools/${activePoolAddress}`)
    : "";
  const coverageHref = activePoolAddress
    ? (buildPoolHref ? buildPoolHref(activePoolAddress, "coverage") : `/pools/${activePoolAddress}?section=coverage`)
    : "";

  return (
    <section className="surface-card step-card space-y-4">
      <div className="step-head">
        <h3 className="step-title">5. Funding & Review</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="surface-card-soft space-y-1">
          <p className="metric-label">Plan Type</p>
          <p className="text-sm font-semibold text-[var(--foreground)] capitalize">{planType}</p>
          <p className="field-help">{poolTypeLabel}</p>
        </div>
        <div className="surface-card-soft space-y-1">
          <p className="metric-label">Payout Asset</p>
          <p className="text-sm font-semibold text-[var(--foreground)] uppercase">{payoutAssetMode}</p>
          {payoutAssetMode === "spl" ? <p className="field-help break-all">{payoutMint}</p> : null}
          {(planType === "rewards" || planType === "hybrid") ? <p className="field-help">Reward payout: {payoutTokens}</p> : null}
        </div>
        <div className="surface-card-soft space-y-1">
          <p className="metric-label">Eligibility</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">{membershipMode.replace("_", "-")}</p>
          {membershipMode === "token_gate" ? <p className="field-help">Mint {shortAddress(tokenGateMint)} | Min {tokenGateMinBalance}</p> : null}
          {membershipMode === "invite_only" ? <p className="field-help">Issuer {shortAddress(inviteIssuer)}</p> : null}
        </div>
        <div className="surface-card-soft space-y-1">
          <p className="metric-label">Verification</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">{selectedOraclesCount} selected verifiers</p>
          <p className="field-help">Quorum {quorumM}-of-{quorumN}</p>
        </div>
        <div className="surface-card-soft space-y-1">
          <p className="metric-label">Schema</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">{selectedSchemaLabel || "Not selected"}</p>
          <p className="field-help">{selectedOutcomesCount} outcomes configured</p>
        </div>
        <div className="surface-card-soft space-y-1">
          <p className="metric-label">Pool Workspace</p>
          <p className="text-sm font-semibold text-[var(--foreground)]">{activePoolAddress ? shortAddress(activePoolAddress) : "Pending creation"}</p>
          {activePoolAddress ? (
            <Link href={workspaceHref} className="secondary-button inline-flex w-fit py-1.5 text-xs">
              Open pool workspace
            </Link>
          ) : null}
        </div>
        {requiresCoveragePathway ? (
          <div className="surface-card-soft space-y-1">
            <p className="metric-label">Coverage Pathway</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {coveragePathway === "defi_native" ? "DeFi Native" : ENABLE_RWA_POLICY && coveragePathway === "rwa_policy" ? "RWA Policy" : "Not selected"}
            </p>
            {coveragePathway === "defi_native" ? (
              <>
                <p className="field-help">
                  Settlement: {defiSettlementMode === "onchain_programmatic" ? "On-chain Programmatic" : defiSettlementMode === "hybrid_rails" ? "Hybrid Rails" : "Not selected"}
                </p>
                <p className="field-help break-all">Technical terms: {defiTechnicalTermsUri || "Not provided"}</p>
                <p className="field-help break-all">Risk disclosure: {defiRiskDisclosureUri || "Not provided"}</p>
              </>
            ) : null}
            {ENABLE_RWA_POLICY && coveragePathway === "rwa_policy" ? (
              <>
                <p className="field-help">Entity: {rwaLegalEntityName || "Not provided"}</p>
                <p className="field-help">Jurisdiction: {rwaJurisdiction || "Not provided"}</p>
                <p className="field-help break-all">Policy terms: {rwaPolicyTermsUri || "Not provided"}</p>
                <p className="field-help">License ref: {rwaRegulatoryLicenseRef || "Not provided"}</p>
                <p className="field-help break-all">Compliance: {rwaComplianceContact || "Not provided"}</p>
              </>
            ) : null}
            {!ENABLE_RWA_POLICY ? (
              <p className="field-help">RWA policy details are intentionally hidden from the mainnet workflow.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="surface-card-soft space-y-3">
        <p className="metric-label">Fund plan vault</p>
        {payoutAssetMode === "sol" ? (
          <label className="field-label">
            SOL amount
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.000001"
              value={fundSol}
              onChange={(event) => onFundSolChange(event.target.value)}
            />
          </label>
        ) : (
          <div className="space-y-2">
            <label className="field-label">
              SPL token amount
              <input
                className="field-input"
                type="number"
                min="0"
                step="0.000001"
                value={fundSpl}
                onChange={(event) => onFundSplChange(event.target.value)}
              />
            </label>
            <p className="field-help">Mint decimals: {splDecimals ?? "loading..."}</p>
            <p className="field-help">Base units preview: {splAmountPreview || "n/a"}</p>
          </div>
        )}
        <button type="button" className="action-button" onClick={onFundPlan} disabled={fundDisabled}>
          Fund plan vault
        </button>
      </div>

      {activePoolAddress ? (
        <div className="flex flex-wrap gap-2">
          <Link href={workspaceHref} className="secondary-button inline-flex">
            Open pool dashboard
          </Link>
          {(planType === "insurance" || planType === "hybrid") ? (
            <>
              <Link href={coverageHref} className="secondary-button inline-flex">
                Open coverage module
              </Link>
              <p className="field-help w-full">
                Coverage policy positions are created per member from reusable coverage products in this pool.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
