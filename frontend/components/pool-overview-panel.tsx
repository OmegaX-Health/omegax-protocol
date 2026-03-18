// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";

import { configuredDevnetWallets } from "@/lib/devnet-fixtures";
import type {
  ClaimDelegateAuthorizationSummary,
  PoolControlAuthoritySummary,
  ProtocolConfigSummary,
  ProtocolReadiness,
  WalletPoolPositionSummary,
} from "@/lib/protocol";
import type {
  PoolWorkspacePanel,
  PoolWorkspaceSection,
  PoolDashboardSnapshot,
  WalletCapabilities,
} from "@/lib/ui-capabilities";

type PoolOverviewPanelProps = {
  poolAddress: string;
  readiness: ProtocolReadiness | null;
  protocolConfig: ProtocolConfigSummary | null;
  poolControlAuthority: PoolControlAuthoritySummary | null;
  walletClaimDelegate: ClaimDelegateAuthorizationSummary | null;
  walletCapitalPosition: WalletPoolPositionSummary | null;
  capabilities: WalletCapabilities;
  dashboard: PoolDashboardSnapshot;
  lastUpdatedAt: number | null;
  onOpenSection: (section: PoolWorkspaceSection, panel?: PoolWorkspacePanel | null) => void;
};

function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "n/a";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function boolLabel(value: boolean): string {
  return value ? "Yes" : "No";
}

function toneClass(tone: "ok" | "warn" | "neutral"): string {
  if (tone === "ok") return "status-ok";
  if (tone === "warn") return "status-off";
  return "status-off";
}

export function PoolOverviewPanel({
  poolAddress,
  readiness,
  protocolConfig,
  poolControlAuthority,
  walletClaimDelegate,
  walletCapitalPosition,
  capabilities,
  dashboard,
  lastUpdatedAt,
  onOpenSection,
}: PoolOverviewPanelProps) {
  const fixtureWallets = configuredDevnetWallets();

  return (
    <div className="space-y-4">
      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="metric-label">Next action</p>
            <p className="field-help">Start with the clearest next task for this wallet, then open details only if you need them.</p>
          </div>
          {lastUpdatedAt ? <span className="status-pill status-off">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</span> : null}
        </div>

        {dashboard.nextAction ? (
          <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{dashboard.nextAction.title}</p>
                <p className="field-help">{dashboard.nextAction.detail}</p>
              </div>
              <span className={`status-pill ${dashboard.nextAction.priority === "high" ? "status-error" : dashboard.nextAction.priority === "medium" ? "status-off" : "status-ok"}`}>
                {dashboard.nextAction.priority}
              </span>
            </div>
            <button
              type="button"
              className="action-button inline-flex w-fit"
              onClick={() => onOpenSection(dashboard.nextAction!.section, dashboard.nextAction!.panel ?? undefined)}
            >
              Open task
            </button>
          </article>
        ) : (
          <p className="field-help">No urgent task is queued for this wallet right now.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {dashboard.compactStatus.map((item) => (
            <span key={item.id} className={`status-pill ${toneClass(item.tone)}`}>
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      </section>

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="metric-label">Recent activity</p>
            <p className="field-help">Use recent follow-ups as quick shortcuts into the plan workspace.</p>
          </div>
          <Link href="/governance" className="secondary-button inline-flex">
            Open governance
          </Link>
        </div>

        {dashboard.recentActivity.length === 0 ? (
          <p className="field-help">No follow-up items are queued right now.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.recentActivity.map((item) => (
              <li key={item.id} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                    <p className="field-help">{item.detail}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button py-1.5"
                    onClick={() => onOpenSection(item.section, item.panel ?? undefined)}
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="surface-card-soft">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
          Protocol details
        </summary>

        <div className="mt-4 space-y-4">
          <section className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Wallet context</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {capabilities.roles.map((role) => (
                  <span key={role} className="status-pill status-off">
                    {role.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-[var(--muted-foreground)]">
                <li>Claim delegate: {walletClaimDelegate?.active ? shortAddress(walletClaimDelegate.delegate) : "No"}</li>
                <li>Capital provider: {walletCapitalPosition?.capitalPositionActive ? "Active" : "No active share balance"}</li>
                <li>Pending redemptions: {walletCapitalPosition?.pendingRedemptionRequestCount ?? 0}</li>
                <li>Pending coverage claims: {walletCapitalPosition?.pendingCoverageClaimCount ?? 0}</li>
                <li>Pending reward claims: {walletCapitalPosition?.pendingRewardClaimCount ?? 0}</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
              <p className="metric-label">Control plane</p>
              {protocolConfig ? (
                <ul className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
                  <li>Admin: {shortAddress(protocolConfig.admin)}</li>
                  <li>Governance authority: {shortAddress(protocolConfig.governanceAuthority)}</li>
                  <li>Governance realm: {shortAddress(protocolConfig.governanceRealm)}</li>
                  <li>Protocol fee: {protocolConfig.protocolFeeBps} bps</li>
                  <li>Emergency pause: {boolLabel(protocolConfig.emergencyPaused)}</li>
                </ul>
              ) : (
                <p className="field-help mt-2">Protocol config account is not initialized yet.</p>
              )}
              {poolControlAuthority ? (
                <ul className="mt-3 space-y-1 text-sm text-[var(--muted-foreground)]">
                  <li>Operator: {shortAddress(poolControlAuthority.operatorAuthority)}</li>
                  <li>Risk manager: {shortAddress(poolControlAuthority.riskManagerAuthority)}</li>
                  <li>Compliance: {shortAddress(poolControlAuthority.complianceAuthority)}</li>
                  <li>Guardian: {shortAddress(poolControlAuthority.guardianAuthority)}</li>
                </ul>
              ) : (
                <p className="field-help mt-3">No pool-specific control authorities have been configured yet.</p>
              )}
            </article>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="metric-label">Readiness</p>
                <p className="field-help">Detailed protocol diagnostics stay tucked away here until you need them.</p>
              </div>
              <span className="status-pill status-off">{shortAddress(poolAddress)}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                <p className="metric-label">Config</p>
                <p className={`text-sm ${readiness?.configInitialized ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
                  {boolLabel(Boolean(readiness?.configInitialized))}
                </p>
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                <p className="metric-label">Terms</p>
                <p className={`text-sm ${readiness?.poolTermsConfigured ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
                  {boolLabel(Boolean(readiness?.poolTermsConfigured))}
                </p>
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                <p className="metric-label">Oracle policy</p>
                <p className={`text-sm ${readiness?.poolOraclePolicyConfigured ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
                  {boolLabel(Boolean(readiness?.poolOraclePolicyConfigured))}
                </p>
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                <p className="metric-label">Vault</p>
                <p className={`text-sm ${readiness?.poolAssetVaultConfigured ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
                  {boolLabel(Boolean(readiness?.poolAssetVaultConfigured))}
                </p>
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                <p className="metric-label">Coverage position</p>
                <p className={`text-sm ${readiness?.coveragePolicyExists ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
                  {boolLabel(Boolean(readiness?.coveragePolicyExists))}
                </p>
              </article>
              <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                <p className="metric-label">Premium ledger</p>
                <p className={`text-sm ${readiness?.premiumLedgerTracked ? "text-[var(--accent-strong)]" : "text-[var(--danger)]"}`}>
                  {boolLabel(Boolean(readiness?.premiumLedgerTracked))}
                </p>
              </article>
            </div>
          </section>

          {dashboard.riskFlags.length > 0 ? (
            <section className="space-y-2">
              <p className="metric-label">Risk flags</p>
              <ul className="space-y-2">
                {dashboard.riskFlags.map((flag) => (
                  <li key={flag} className="field-error">
                    {flag}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2">
            <p className="metric-label">Devnet fixtures</p>
            {fixtureWallets.length === 0 ? (
              <p className="field-help">No devnet fixture wallets are configured in the current environment.</p>
            ) : (
              <ul className="space-y-2">
                {fixtureWallets.map((wallet) => (
                  <li key={`${wallet.role}:${wallet.address}`} className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{wallet.label}</p>
                    <p className="field-help">{wallet.role.replaceAll("_", " ")}</p>
                    <p className="field-help font-mono break-all">{wallet.address}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </details>
    </div>
  );
}
