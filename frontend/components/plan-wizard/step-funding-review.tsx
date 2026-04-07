// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";

import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import { FieldHint } from "@/components/field-hint";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";

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
  fundLabel: string;
  fundHelp?: string | null;
  splDecimals: number | null;
  splAmountPreview: string;
};

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function membershipLabel(mode: MembershipMode): string {
  if (mode === "open") return "Open enrollment";
  if (mode === "token_gate") return "Token-gated access";
  return "Invite-only access";
}

function membershipDetail(
  mode: MembershipMode,
  tokenGateMint: string,
  tokenGateMinBalance: string,
  inviteIssuer: string,
): string {
  if (mode === "token_gate") {
    return `Mint ${shortAddress(tokenGateMint)} with balance ${tokenGateMinBalance}.`;
  }
  if (mode === "invite_only") {
    return `Invite issuer ${shortAddress(inviteIssuer)}.`;
  }
  return "Anyone can enroll after launch.";
}

function coveragePathLabel(pathway: CoveragePathway): string {
  if (pathway === "defi_native") return "DeFi native";
  if (pathway === "rwa_policy") return "RWA policy";
  return "No coverage path";
}

function fundingSummary(planType: PlanType, payoutAssetMode: PayoutAssetMode, payoutTokens: string): string {
  const asset = payoutAssetMode === "sol" ? "SOL vault" : "Token vault";
  if (planType === "rewards" || planType === "hybrid") {
    return `${asset} · reward payout ${payoutTokens || "0"}`;
  }
  return `${asset} · claim amounts come from coverage products`;
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
  fundLabel,
  fundHelp,
  splDecimals,
  splAmountPreview,
}: StepFundingReviewProps) {
  const requiresCoveragePathway = planType === "insurance" || planType === "hybrid";
  const workspaceHref = activePoolAddress
    ? (buildPoolHref ? buildPoolHref(activePoolAddress) : buildCanonicalPoolHref(activePoolAddress))
    : "";
  const coverageHref = activePoolAddress
    ? (buildPoolHref ? buildPoolHref(activePoolAddress, "coverage") : buildCanonicalPoolHref(activePoolAddress, { section: "coverage" }))
    : "";

  return (
    <section className="wizard-section">
      <div className="wizard-section-heading">
        <div className="space-y-1">
          <p className="wizard-section-kicker">Step 3</p>
          <h3 className="wizard-section-title">Does the launch summary look right?</h3>
        </div>
        <FieldHint
          content="This is the final pass before funding. Review the human-readable summary first, then open protocol details only if you need exact addresses or hashes."
          side="end"
        />
      </div>

      <div className="wizard-summary-list">
        <div className="wizard-summary-row">
          <div>
            <p className="wizard-summary-label">Plan</p>
            <p className="wizard-summary-value capitalize">{planType}</p>
          </div>
          <p className="wizard-inline-copy">
            {requiresCoveragePathway ? coveragePathLabel(coveragePathway) : "Rewards only"}
          </p>
        </div>

        <div className="wizard-summary-row">
          <div>
            <p className="wizard-summary-label">Eligibility</p>
            <p className="wizard-summary-value">{membershipLabel(membershipMode)}</p>
          </div>
          <p className="wizard-inline-copy">
            {membershipDetail(membershipMode, tokenGateMint, tokenGateMinBalance, inviteIssuer)}
          </p>
        </div>

        <div className="wizard-summary-row">
          <div>
            <p className="wizard-summary-label">Verification</p>
            <p className="wizard-summary-value">{selectedOraclesCount} verifiers selected</p>
          </div>
          <p className="wizard-inline-copy">Quorum {quorumM}-of-{quorumN}</p>
        </div>

        <div className="wizard-summary-row">
          <div>
            <p className="wizard-summary-label">Outcomes</p>
            <p className="wizard-summary-value">{selectedOutcomesCount} configured</p>
          </div>
          <p className="wizard-inline-copy">{selectedSchemaLabel || "No schema selected yet."}</p>
        </div>

        <div className="wizard-summary-row">
          <div>
            <p className="wizard-summary-label">Funding</p>
            <p className="wizard-summary-value">{payoutAssetMode === "sol" ? "SOL" : "SPL token"}</p>
          </div>
          <p className="wizard-inline-copy">{fundingSummary(planType, payoutAssetMode, payoutTokens)}</p>
        </div>

        <div className="wizard-summary-row">
          <div>
            <p className="wizard-summary-label">Workspace</p>
            <p className="wizard-summary-value">
              {activePoolAddress ? shortAddress(activePoolAddress) : "Appears after creation"}
            </p>
          </div>
          {activePoolAddress ? (
            <Link href={workspaceHref} className="secondary-button inline-flex w-fit py-1.5 text-xs">
              Open workspace
            </Link>
          ) : (
            <p className="wizard-inline-copy">Links appear after the plan is created on-chain.</p>
          )}
        </div>
      </div>

      <div className="wizard-funding-panel">
        <div className="wizard-inline-head">
          <div className="space-y-1">
            <p className="wizard-section-label">Seed the launch vault</p>
            <p className="wizard-inline-copy">Add the starting balance the plan should have immediately after launch.</p>
          </div>
          <FieldHint
            content="Funding is the only irreversible step in this screen. You can review the disclosures below before sending assets."
            side="end"
          />
        </div>

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
              Token amount
              <input
                className="field-input"
                type="number"
                min="0"
                step="0.000001"
                value={fundSpl}
                onChange={(event) => onFundSplChange(event.target.value)}
              />
            </label>
            <p className="wizard-inline-copy">Mint decimals: {splDecimals ?? "loading..."}</p>
          </div>
        )}

        <button
          type="button"
          className="action-button hidden w-full sm:inline-flex sm:w-auto"
          onClick={onFundPlan}
          disabled={fundDisabled}
        >
          {fundLabel}
        </button>

        {fundHelp ? (
          <p className={fundDisabled ? "field-error" : "wizard-inline-copy"}>{fundHelp}</p>
        ) : null}
      </div>

      <ProtocolDetailDisclosure
        title="Protocol and accounting details"
        summary="Pool type, addresses, mint details, and base-unit previews stay collapsed until you need them."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="monitor-row">
            <span>On-chain pool type</span>
            <span>{poolTypeLabel}</span>
          </div>
          <div className="monitor-row">
            <span>Payout asset mode</span>
            <span className="uppercase">{payoutAssetMode}</span>
          </div>
          {payoutAssetMode === "spl" ? (
            <>
              <div className="monitor-row sm:col-span-2">
                <span>Payout mint</span>
                <span className="break-all text-right">{payoutMint}</span>
              </div>
              <div className="monitor-row">
                <span>Mint decimals</span>
                <span>{splDecimals ?? "loading..."}</span>
              </div>
              <div className="monitor-row">
                <span>Base units preview</span>
                <span>{splAmountPreview || "n/a"}</span>
              </div>
            </>
          ) : null}
          {activePoolAddress ? (
            <div className="monitor-row sm:col-span-2">
              <span>Plan address</span>
              <span className="break-all text-right">{activePoolAddress}</span>
            </div>
          ) : null}
        </div>
      </ProtocolDetailDisclosure>

      {requiresCoveragePathway ? (
        <ProtocolDetailDisclosure
          title="Coverage references"
          summary="Coverage setup continues in the workspace after launch."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="monitor-row">
              <span>Coverage pathway</span>
              <span>{coveragePathLabel(coveragePathway)}</span>
            </div>
            {coveragePathway === "defi_native" ? (
              <>
                <div className="monitor-row">
                  <span>Settlement style</span>
                  <span>
                    {defiSettlementMode === "onchain_programmatic"
                      ? "On-chain programmatic"
                      : defiSettlementMode === "hybrid_rails"
                        ? "Hybrid rails"
                        : "Not selected"}
                  </span>
                </div>
                <div className="monitor-row sm:col-span-2">
                  <span>Technical terms URL</span>
                  <span className="break-all text-right">{defiTechnicalTermsUri || "Not provided"}</span>
                </div>
                <div className="monitor-row sm:col-span-2">
                  <span>Risk disclosure URL</span>
                  <span className="break-all text-right">{defiRiskDisclosureUri || "Not provided"}</span>
                </div>
              </>
            ) : null}
            {ENABLE_RWA_POLICY && coveragePathway === "rwa_policy" ? (
              <>
                <div className="monitor-row">
                  <span>Issuer</span>
                  <span>{rwaLegalEntityName || "Not provided"}</span>
                </div>
                <div className="monitor-row">
                  <span>Jurisdiction</span>
                  <span>{rwaJurisdiction || "Not provided"}</span>
                </div>
                <div className="monitor-row sm:col-span-2">
                  <span>Policy terms</span>
                  <span className="break-all text-right">{rwaPolicyTermsUri || "Not provided"}</span>
                </div>
                <div className="monitor-row">
                  <span>License reference</span>
                  <span>{rwaRegulatoryLicenseRef || "Not provided"}</span>
                </div>
                <div className="monitor-row">
                  <span>Compliance contact</span>
                  <span className="break-all text-right">{rwaComplianceContact || "Not provided"}</span>
                </div>
              </>
            ) : null}
          </div>
        </ProtocolDetailDisclosure>
      ) : null}

      {activePoolAddress ? (
        <div className="flex flex-wrap gap-2">
          <Link href={workspaceHref} className="secondary-button inline-flex">
            Open pool dashboard
          </Link>
          {planType === "insurance" || planType === "hybrid" ? (
            <Link href={coverageHref} className="secondary-button inline-flex">
              Open coverage module
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
