// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { RefreshCw, Settings2 } from "lucide-react";

import { buildCanonicalPoolHref } from "@/lib/canonical-routes";
import { OperatorVisibilityPanel } from "@/components/operator-visibility-panel";
import { PoolLifecyclePanel } from "@/components/pool-lifecycle-panel";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { usePoolWorkspaceContext } from "@/components/pool-workspace-context";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  AI_ROLE_ALL_MASK,
  AUTOMATION_MODE_ADVISORY,
  AUTOMATION_MODE_ATTESTED,
  AUTOMATION_MODE_BOUNDED_AUTONOMOUS,
  AUTOMATION_MODE_DISABLED,
  COMPLIANCE_ACTION_CLAIM,
  COMPLIANCE_ACTION_DEPOSIT,
  COMPLIANCE_ACTION_ENROLL,
  COMPLIANCE_ACTION_PAYOUT,
  COMPLIANCE_ACTION_REDEEM,
  COMPLIANCE_BINDING_MODE_NONE,
  COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT,
  COMPLIANCE_BINDING_MODE_TOKEN_GATE,
  COMPLIANCE_BINDING_MODE_WALLET,
  COMPLIANCE_PROVIDER_MODE_EXTERNAL,
  COMPLIANCE_PROVIDER_MODE_NATIVE,
  COMPLIANCE_PROVIDER_MODE_SOLANA_ATTEST,
  RAIL_MODE_ANY,
  RAIL_MODE_PERMISSIONED_SPL,
  RAIL_MODE_SPL_ONLY,
  ZERO_PUBKEY,
  buildSetPoolAutomationPolicyTx,
  buildSetPoolCompliancePolicyTx,
  buildSetPoolControlAuthoritiesTx,
  buildSetPoolCoverageReserveFloorTx,
  buildSetPoolTermsHashTx,
  fetchProtocolReadiness,
  listPoolAutomationPolicies,
  listPoolCompliancePolicies,
  listPoolControlAuthorities,
  listPoolTerms,
  type PoolAutomationPolicySummary,
  type PoolCompliancePolicySummary,
  type PoolControlAuthoritySummary,
  type PoolTermsSummary,
  type ProtocolReadiness,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import {
  parseWorkspacePanel,
  type PoolWorkspacePanel,
  visibleWorkspacePanels,
} from "@/lib/ui-capabilities";

type PoolSettingsPanelProps = {
  poolAddress: string;
  sectionMode?: "standalone" | "embedded";
};

type ReadinessRow = {
  id: string;
  label: string;
  value: boolean;
};

const SETTINGS_PANELS: ReadonlyArray<{ value: PoolWorkspacePanel; label: string }> = [
  { value: "readiness", label: "Readiness" },
  { value: "controls", label: "Controls" },
  { value: "lifecycle", label: "Lifecycle" },
];

const COMPLIANCE_BINDING_OPTIONS = [
  { value: String(COMPLIANCE_BINDING_MODE_NONE), label: "No binding" },
  { value: String(COMPLIANCE_BINDING_MODE_WALLET), label: "Wallet-bound" },
  { value: String(COMPLIANCE_BINDING_MODE_SUBJECT_COMMITMENT), label: "Subject commitment" },
  { value: String(COMPLIANCE_BINDING_MODE_TOKEN_GATE), label: "Token-gated" },
];

const COMPLIANCE_PROVIDER_OPTIONS = [
  { value: String(COMPLIANCE_PROVIDER_MODE_NATIVE), label: "Native provider" },
  { value: String(COMPLIANCE_PROVIDER_MODE_EXTERNAL), label: "External provider" },
  { value: String(COMPLIANCE_PROVIDER_MODE_SOLANA_ATTEST), label: "Solana attest" },
];

const RAIL_MODE_OPTIONS = [
  { value: String(RAIL_MODE_ANY), label: "Any rail" },
  { value: String(RAIL_MODE_SPL_ONLY), label: "SPL only" },
  { value: String(RAIL_MODE_PERMISSIONED_SPL), label: "Permissioned SPL" },
];

const AUTOMATION_MODE_OPTIONS = [
  { value: String(AUTOMATION_MODE_DISABLED), label: "Disabled" },
  { value: String(AUTOMATION_MODE_ADVISORY), label: "Advisory" },
  { value: String(AUTOMATION_MODE_ATTESTED), label: "Attested" },
  { value: String(AUTOMATION_MODE_BOUNDED_AUTONOMOUS), label: "Bounded autonomous" },
];

const READINESS_ACTIONS: Record<ReadinessRow["id"], { label: string; resolveHref: (poolAddress: string) => string }> = {
  poolExists: {
    label: "Open setup wizard",
    resolveHref: () => "/pools/create",
  },
  poolTermsConfigured: {
    label: "Open pool controls",
    resolveHref: (poolAddress) => buildCanonicalPoolHref(poolAddress, { section: "settings" }),
  },
  poolOraclePolicyConfigured: {
    label: "Open oracle policy",
    resolveHref: (poolAddress) => buildCanonicalPoolHref(poolAddress, { section: "oracles", panel: "registry" }),
  },
  poolAssetVaultConfigured: {
    label: "Open treasury rails",
    resolveHref: (poolAddress) => buildCanonicalPoolHref(poolAddress, { section: "treasury", panel: "queue" }),
  },
  coveragePolicyExists: {
    label: "Open coverage",
    resolveHref: (poolAddress) => buildCanonicalPoolHref(poolAddress, { section: "coverage" }),
  },
  premiumLedgerTracked: {
    label: "Open coverage payments",
    resolveHref: (poolAddress) => buildCanonicalPoolHref(poolAddress, { section: "coverage" }),
  },
};

function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "n/a";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function resolveComplianceActions(maskValue: string): string[] {
  const mask = Number.parseInt(maskValue, 10) || 0;
  const labels: string[] = [];
  if (mask & COMPLIANCE_ACTION_ENROLL) labels.push("enrollment");
  if (mask & COMPLIANCE_ACTION_CLAIM) labels.push("claims");
  if (mask & COMPLIANCE_ACTION_REDEEM) labels.push("redemptions");
  if (mask & COMPLIANCE_ACTION_DEPOSIT) labels.push("deposits");
  if (mask & COMPLIANCE_ACTION_PAYOUT) labels.push("payouts");
  return labels;
}

function toReadinessRows(readiness: ProtocolReadiness | null): ReadinessRow[] {
  if (!readiness) {
    return [];
  }
  return [
    { id: "poolExists", label: "Pool account exists", value: readiness.poolExists },
    { id: "poolTermsConfigured", label: "Pool terms configured", value: readiness.poolTermsConfigured },
    { id: "poolOraclePolicyConfigured", label: "Oracle policy configured", value: readiness.poolOraclePolicyConfigured },
    { id: "poolAssetVaultConfigured", label: "Asset vault configured", value: readiness.poolAssetVaultConfigured },
    { id: "coveragePolicyExists", label: "Coverage policy exists", value: readiness.coveragePolicyExists },
    { id: "premiumLedgerTracked", label: "Premium ledger tracked", value: readiness.premiumLedgerTracked },
  ];
}

export function PoolSettingsPanel({ poolAddress, sectionMode = "standalone" }: PoolSettingsPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { capabilities } = usePoolWorkspaceContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const embedded = sectionMode === "embedded";
  const activePanel = parseWorkspacePanel("settings", searchParams.get("panel"));
  const visiblePanels = useMemo(
    () => visibleWorkspacePanels("settings", capabilities),
    [capabilities],
  );
  const resolvedPanel = useMemo(
    () => (activePanel && visiblePanels.includes(activePanel) ? activePanel : (visiblePanels[0] ?? "readiness")),
    [activePanel, visiblePanels],
  );

  const [readiness, setReadiness] = useState<ProtocolReadiness | null>(null);
  const [poolTerms, setPoolTerms] = useState<PoolTermsSummary | null>(null);
  const [compliancePolicy, setCompliancePolicy] = useState<PoolCompliancePolicySummary | null>(null);
  const [controlAuthority, setControlAuthority] = useState<PoolControlAuthoritySummary | null>(null);
  const [automationPolicy, setAutomationPolicy] = useState<PoolAutomationPolicySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const [reserveFloorInput, setReserveFloorInput] = useState("0");
  const [providerRefHashInput, setProviderRefHashInput] = useState("");
  const [credentialTypeHashInput, setCredentialTypeHashInput] = useState("");
  const [revocationListHashInput, setRevocationListHashInput] = useState("");
  const [actionsMaskInput, setActionsMaskInput] = useState("0");
  const [bindingModeInput, setBindingModeInput] = useState("0");
  const [providerModeInput, setProviderModeInput] = useState("0");
  const [capitalRailModeInput, setCapitalRailModeInput] = useState("0");
  const [payoutRailModeInput, setPayoutRailModeInput] = useState("0");
  const [complianceActiveInput, setComplianceActiveInput] = useState(true);
  const [operatorAuthorityInput, setOperatorAuthorityInput] = useState(ZERO_PUBKEY);
  const [riskAuthorityInput, setRiskAuthorityInput] = useState(ZERO_PUBKEY);
  const [complianceAuthorityInput, setComplianceAuthorityInput] = useState(ZERO_PUBKEY);
  const [guardianAuthorityInput, setGuardianAuthorityInput] = useState(ZERO_PUBKEY);
  const [oracleAutomationModeInput, setOracleAutomationModeInput] = useState("0");
  const [claimAutomationModeInput, setClaimAutomationModeInput] = useState("0");
  const [allowedAiRolesMaskInput, setAllowedAiRolesMaskInput] = useState(String(AI_ROLE_ALL_MASK));
  const [maxAutoClaimAmountInput, setMaxAutoClaimAmountInput] = useState("0");
  const [requiredAttestationProviderInput, setRequiredAttestationProviderInput] = useState("");
  const [termsHashInput, setTermsHashInput] = useState("");
  const [payoutPolicyHashInput, setPayoutPolicyHashInput] = useState("");
  const [cycleModeInput, setCycleModeInput] = useState("0");
  const [metadataUriInput, setMetadataUriInput] = useState("");

  const setPanel = useCallback((nextPanel: PoolWorkspacePanel) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "settings");
    params.set("panel", nextPanel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (resolvedPanel !== activePanel) {
      setPanel(resolvedPanel);
    }
  }, [activePanel, resolvedPanel, setPanel]);

  const refreshReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextReadiness, nextTerms, nextCompliancePolicies, nextControlAuthorities, nextAutomationPolicies] = await Promise.all([
        fetchProtocolReadiness({
          connection,
          poolAddress,
        }),
        listPoolTerms({ connection, poolAddress, search: null }),
        listPoolCompliancePolicies({ connection, poolAddress, search: null }),
        listPoolControlAuthorities({ connection, poolAddress, search: null }),
        listPoolAutomationPolicies({ connection, poolAddress, search: null }),
      ]);
      setReadiness(nextReadiness);
      setPoolTerms(nextTerms[0] ?? null);
      setCompliancePolicy(nextCompliancePolicies[0] ?? null);
      setControlAuthority(nextControlAuthorities[0] ?? null);
      setAutomationPolicy(nextAutomationPolicies[0] ?? null);
      setLastUpdatedAt(Date.now());
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load pool settings readiness.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
      setReadiness(null);
    } finally {
      setLoading(false);
    }
  }, [connection, poolAddress]);

  useEffect(() => {
    void refreshReadiness();
  }, [refreshReadiness]);

  useEffect(() => {
    if (!poolTerms) return;
    setTermsHashInput(poolTerms.termsHashHex);
    setPayoutPolicyHashInput(poolTerms.payoutPolicyHashHex);
    setCycleModeInput(String(poolTerms.cycleMode));
    setMetadataUriInput(poolTerms.metadataUri);
  }, [poolTerms]);

  useEffect(() => {
    if (!compliancePolicy) return;
    setProviderRefHashInput(compliancePolicy.providerRefHashHex);
    setCredentialTypeHashInput(compliancePolicy.credentialTypeHashHex);
    setRevocationListHashInput(compliancePolicy.revocationListHashHex);
    setActionsMaskInput(String(compliancePolicy.actionsMask));
    setBindingModeInput(String(compliancePolicy.bindingMode));
    setProviderModeInput(String(compliancePolicy.providerMode));
    setCapitalRailModeInput(String(compliancePolicy.capitalRailMode));
    setPayoutRailModeInput(String(compliancePolicy.payoutRailMode));
    setComplianceActiveInput(compliancePolicy.active);
  }, [compliancePolicy]);

  useEffect(() => {
    if (!controlAuthority) return;
    setOperatorAuthorityInput(controlAuthority.operatorAuthority);
    setRiskAuthorityInput(controlAuthority.riskManagerAuthority);
    setComplianceAuthorityInput(controlAuthority.complianceAuthority);
    setGuardianAuthorityInput(controlAuthority.guardianAuthority);
  }, [controlAuthority]);

  useEffect(() => {
    if (!automationPolicy) return;
    setOracleAutomationModeInput(String(automationPolicy.oracleAutomationMode));
    setClaimAutomationModeInput(String(automationPolicy.claimAutomationMode));
    setAllowedAiRolesMaskInput(String(automationPolicy.allowedAiRolesMask));
    setMaxAutoClaimAmountInput(automationPolicy.maxAutoClaimAmount.toString());
    setRequiredAttestationProviderInput(automationPolicy.requiredAttestationProviderRefHashHex);
  }, [automationPolicy]);

  const readinessRows = useMemo(() => toReadinessRows(readiness), [readiness]);
  const checksPassing = useMemo(
    () => readinessRows.filter((row) => row.value).length,
    [readinessRows],
  );
  const missingRows = useMemo(
    () => readinessRows.filter((row) => !row.value),
    [readinessRows],
  );
  const complianceActionLabels = useMemo(
    () => resolveComplianceActions(actionsMaskInput),
    [actionsMaskInput],
  );
  const settingsActionGuard = useMemo(() => {
    if (!capabilities.canManageSettings) {
      return "Pool control changes require the pool authority or delegated operator wallet.";
    }
    if (!publicKey || !sendTransaction) {
      return "Connect the authorized wallet to submit pool control changes.";
    }
    return null;
  }, [capabilities.canManageSettings, publicKey, sendTransaction]);
  const reserveFloorGuard = useMemo(() => {
    if (settingsActionGuard) return settingsActionGuard;
    if (!poolTerms) {
      return "Pool terms must be configured before saving the reserve floor.";
    }
    return null;
  }, [poolTerms, settingsActionGuard]);

  async function runAction(
    label: string,
    buildTx: (recentBlockhash: string) => ReturnType<typeof buildSetPoolCoverageReserveFloorTx>,
  ) {
    if (!sendTransaction) return;
    setBusyAction(label);
    setStatus(null);
    setStatusTone(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildTx(blockhash);
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label,
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
      await refreshReadiness();
    } finally {
      setBusyAction(null);
    }
  }

  async function onSaveReserveFloor() {
    if (!publicKey || !poolTerms) return;
    await runAction("Set coverage reserve floor", (recentBlockhash) =>
      buildSetPoolCoverageReserveFloorTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        paymentMint: new PublicKey(poolTerms.payoutAssetMint),
        amount: BigInt(reserveFloorInput || "0"),
        recentBlockhash,
      }));
  }

  async function onSaveCompliancePolicy() {
    if (!publicKey) return;
    await runAction("Set compliance policy", (recentBlockhash) =>
      buildSetPoolCompliancePolicyTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        providerRefHashHex: providerRefHashInput || undefined,
        credentialTypeHashHex: credentialTypeHashInput || undefined,
        revocationListHashHex: revocationListHashInput || undefined,
        actionsMask: Number.parseInt(actionsMaskInput, 10) || 0,
        bindingMode: Number.parseInt(bindingModeInput, 10) || 0,
        providerMode: Number.parseInt(providerModeInput, 10) || 0,
        capitalRailMode: Number.parseInt(capitalRailModeInput, 10) || 0,
        payoutRailMode: Number.parseInt(payoutRailModeInput, 10) || 0,
        active: complianceActiveInput,
        recentBlockhash,
        includePoolControlAuthority: true,
      }));
  }

  async function onSaveControlAuthorities() {
    if (!publicKey) return;
    await runAction("Set control authorities", (recentBlockhash) =>
      buildSetPoolControlAuthoritiesTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        operatorAuthority: new PublicKey(operatorAuthorityInput),
        riskManagerAuthority: new PublicKey(riskAuthorityInput),
        complianceAuthority: new PublicKey(complianceAuthorityInput),
        guardianAuthority: new PublicKey(guardianAuthorityInput),
        recentBlockhash,
      }));
  }

  async function onSaveAutomationPolicy() {
    if (!publicKey) return;
    await runAction("Set automation policy", (recentBlockhash) =>
      buildSetPoolAutomationPolicyTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        oracleAutomationMode: Number.parseInt(oracleAutomationModeInput, 10) || 0,
        claimAutomationMode: Number.parseInt(claimAutomationModeInput, 10) || 0,
        allowedAiRolesMask: Number.parseInt(allowedAiRolesMaskInput, 10) || 0,
        maxAutoClaimAmount: BigInt(maxAutoClaimAmountInput || "0"),
        requiredAttestationProviderRefHashHex: requiredAttestationProviderInput || undefined,
        recentBlockhash,
        includePoolControlAuthority: true,
      }));
  }

  async function onSaveTermsHash() {
    if (!publicKey) return;
    await runAction("Set pool terms hash", (recentBlockhash) =>
      buildSetPoolTermsHashTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        termsHashHex: termsHashInput,
        payoutPolicyHashHex: payoutPolicyHashInput,
        cycleMode: Number.parseInt(cycleModeInput, 10) || 0,
        metadataUri: metadataUriInput,
        recentBlockhash,
      }));
  }

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="hero-title">Pool Settings</h2>
          <p className="hero-copy">Control lifecycle actions and policy configuration for this pool.</p>
        </div>
      ) : null}

      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Pool settings</p>
          </div>
          <button
            type="button"
            className="secondary-button inline-flex items-center gap-1.5"
            onClick={() => void refreshReadiness()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {SETTINGS_PANELS.filter((panel) => visiblePanels.includes(panel.value)).map((panel) => (
            <button
              key={panel.value}
              type="button"
              className={`segment-button ${resolvedPanel === panel.value ? "segment-button-active" : ""}`}
              onClick={() => setPanel(panel.value)}
            >
              {panel.label}
            </button>
          ))}
        </div>
      </section>

      {resolvedPanel === "readiness" ? (
        <section className="surface-card-soft space-y-3">
          <div className="operator-task-head">
            <h3 className="operator-task-title">Pool readiness checklist</h3>
            <p className="operator-task-copy">
              Use this checklist to see which setup areas still need attention, then jump straight to the matching tool.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="status-pill status-off">
              Readiness {checksPassing}/{readinessRows.length || 0}
            </span>
            {missingRows.length > 0 ? (
              <span className="status-pill status-error">{missingRows.length} checks missing</span>
            ) : (
              <span className="status-pill status-ok">All core checks passing</span>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {readinessRows.map((row) => {
              const action = READINESS_ACTIONS[row.id];
              return (
                <article key={row.id} className="operator-summary-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{row.label}</p>
                      <p className="field-help">{row.value ? "Ready" : "Still needs setup"}</p>
                    </div>
                    <span className={`status-pill ${row.value ? "status-ok" : "status-off"}`}>
                      {row.value ? "Ready" : "Action needed"}
                    </span>
                  </div>
                  <Link href={action.resolveHref(poolAddress)} className="secondary-button inline-flex w-fit">
                    {action.label}
                  </Link>
                </article>
              );
            })}
          </div>

          <Link href="/pools/create" className="secondary-button inline-flex w-fit">
            Open create wizard
          </Link>
          {error ? <p className="field-error">{error}</p> : null}
          {lastUpdatedAt ? <p className="field-help">Updated {new Date(lastUpdatedAt).toLocaleTimeString()}</p> : null}
        </section>
      ) : null}

      {resolvedPanel === "controls" ? (
        <section className="surface-card-soft space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Public pool details</h3>
                <p className="operator-task-copy">Keep the operator-facing metadata and public terms entrypoint easy to understand.</p>
              </div>
              <div className="operator-summary-row">
                <span>Current metadata URI</span>
                <strong className="break-all text-right">{metadataUriInput || "Not set"}</strong>
              </div>
              <label className="space-y-1">
                <span className="metric-label">Public metadata URI</span>
                <input className="field-input" value={metadataUriInput} onChange={(event) => setMetadataUriInput(event.target.value)} />
              </label>
              <button type="button" className="action-button" onClick={() => void onSaveTermsHash()} disabled={Boolean(busyAction) || Boolean(settingsActionGuard)}>
                {busyAction === "Set pool terms hash" ? "Saving..." : "Save public pool details"}
              </button>
              <ProtocolDetailDisclosure
                title="Manual protocol terms"
                summary="Keep the raw term, payout, and cycle values secondary unless you are intentionally changing them."
              >
                <div className="grid gap-3">
                  <label className="space-y-1">
                    <span className="metric-label">Terms hash</span>
                    <input className="field-input font-mono" value={termsHashInput} onChange={(event) => setTermsHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Payout policy hash</span>
                    <input className="field-input font-mono" value={payoutPolicyHashInput} onChange={(event) => setPayoutPolicyHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Cycle mode</span>
                    <input className="field-input" value={cycleModeInput} onChange={(event) => setCycleModeInput(event.target.value)} />
                  </label>
                </div>
              </ProtocolDetailDisclosure>
              {settingsActionGuard ? <p className="field-help">{settingsActionGuard}</p> : null}
            </article>

            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Reserve target</h3>
                <p className="operator-task-copy">Set the reserve floor used to protect coverage obligations for this pool.</p>
              </div>
              <div className="operator-summary-row">
                <span>Payout asset</span>
                <strong>{poolTerms ? shortAddress(poolTerms.payoutAssetMint) : "Configure terms first"}</strong>
              </div>
              <label className="space-y-1">
                <span className="metric-label">Reserve floor amount</span>
                <input className="field-input" value={reserveFloorInput} onChange={(event) => setReserveFloorInput(event.target.value)} />
              </label>
              <button type="button" className="action-button" onClick={() => void onSaveReserveFloor()} disabled={Boolean(busyAction) || Boolean(reserveFloorGuard)}>
                {busyAction === "Set coverage reserve floor" ? "Saving..." : "Save reserve target"}
              </button>
              {reserveFloorGuard ? <p className="field-help">{reserveFloorGuard}</p> : null}
            </article>

            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Delegated authorities</h3>
                <p className="operator-task-copy">Assign the operator and oversight wallets that can act on behalf of the pool.</p>
              </div>
              <label className="space-y-1">
                <span className="metric-label">Operator authority</span>
                <input className="field-input font-mono" value={operatorAuthorityInput} onChange={(event) => setOperatorAuthorityInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Risk manager</span>
                <input className="field-input font-mono" value={riskAuthorityInput} onChange={(event) => setRiskAuthorityInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Compliance authority</span>
                <input className="field-input font-mono" value={complianceAuthorityInput} onChange={(event) => setComplianceAuthorityInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Guardian</span>
                <input className="field-input font-mono" value={guardianAuthorityInput} onChange={(event) => setGuardianAuthorityInput(event.target.value)} />
              </label>
              <button type="button" className="action-button" onClick={() => void onSaveControlAuthorities()} disabled={Boolean(busyAction) || Boolean(settingsActionGuard)}>
                {busyAction === "Set control authorities" ? "Saving..." : "Save delegated authorities"}
              </button>
              {settingsActionGuard ? <p className="field-help">{settingsActionGuard}</p> : null}
            </article>

            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Compliance controls</h3>
                <p className="operator-task-copy">Choose the compliance model and rail limits that apply to enrollment, claims, and payouts.</p>
              </div>
              <label className="toggle-card">
                <div>
                  <p className="toggle-card-title">Compliance policy active</p>
                  <p className="field-help">Turn the configured compliance controls on or off.</p>
                </div>
                <input type="checkbox" checked={complianceActiveInput} onChange={(event) => setComplianceActiveInput(event.target.checked)} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="metric-label">Binding mode</span>
                  <select className="field-input" value={bindingModeInput} onChange={(event) => setBindingModeInput(event.target.value)}>
                    {COMPLIANCE_BINDING_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Provider mode</span>
                  <select className="field-input" value={providerModeInput} onChange={(event) => setProviderModeInput(event.target.value)}>
                    {COMPLIANCE_PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Capital rail</span>
                  <select className="field-input" value={capitalRailModeInput} onChange={(event) => setCapitalRailModeInput(event.target.value)}>
                    {RAIL_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Payout rail</span>
                  <select className="field-input" value={payoutRailModeInput} onChange={(event) => setPayoutRailModeInput(event.target.value)}>
                    {RAIL_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="operator-summary-row">
                <span>Actions requiring compliance</span>
                <strong>{complianceActionLabels.length > 0 ? complianceActionLabels.join(", ") : "none selected"}</strong>
              </div>
              <button type="button" className="action-button" onClick={() => void onSaveCompliancePolicy()} disabled={Boolean(busyAction) || Boolean(settingsActionGuard)}>
                {busyAction === "Set compliance policy" ? "Saving..." : "Save compliance controls"}
              </button>
              <ProtocolDetailDisclosure
                title="Manual compliance values"
                summary="Use raw hashes and action masks only when you are intentionally changing the underlying protocol references."
              >
                <div className="grid gap-3">
                  <label className="space-y-1">
                    <span className="metric-label">Provider ref hash</span>
                    <input className="field-input font-mono" value={providerRefHashInput} onChange={(event) => setProviderRefHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Credential type hash</span>
                    <input className="field-input font-mono" value={credentialTypeHashInput} onChange={(event) => setCredentialTypeHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Revocation list hash</span>
                    <input className="field-input font-mono" value={revocationListHashInput} onChange={(event) => setRevocationListHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Actions mask</span>
                    <input className="field-input" value={actionsMaskInput} onChange={(event) => setActionsMaskInput(event.target.value)} />
                  </label>
                </div>
              </ProtocolDetailDisclosure>
              {settingsActionGuard ? <p className="field-help">{settingsActionGuard}</p> : null}
            </article>

            <article className="operator-task-card xl:col-span-2">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Automation controls</h3>
                <p className="operator-task-copy">Choose how much automation the pool allows for oracle and claim workflows.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1">
                  <span className="metric-label">Oracle automation</span>
                  <select className="field-input" value={oracleAutomationModeInput} onChange={(event) => setOracleAutomationModeInput(event.target.value)}>
                    {AUTOMATION_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Claim automation</span>
                  <select className="field-input" value={claimAutomationModeInput} onChange={(event) => setClaimAutomationModeInput(event.target.value)}>
                    {AUTOMATION_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Max auto-claim amount</span>
                  <input className="field-input" value={maxAutoClaimAmountInput} onChange={(event) => setMaxAutoClaimAmountInput(event.target.value)} />
                </label>
              </div>
              <button type="button" className="action-button" onClick={() => void onSaveAutomationPolicy()} disabled={Boolean(busyAction) || Boolean(settingsActionGuard)}>
                {busyAction === "Set automation policy" ? "Saving..." : "Save automation controls"}
              </button>
              <ProtocolDetailDisclosure
                title="Manual automation values"
                summary="Use protocol-level attestation references or AI role masks only when the default controls are not enough."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="metric-label">Allowed AI roles mask</span>
                    <input className="field-input" value={allowedAiRolesMaskInput} onChange={(event) => setAllowedAiRolesMaskInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Required attestation provider ref</span>
                    <input className="field-input font-mono" value={requiredAttestationProviderInput} onChange={(event) => setRequiredAttestationProviderInput(event.target.value)} />
                  </label>
                </div>
              </ProtocolDetailDisclosure>
              {allowedAiRolesMaskInput !== String(AI_ROLE_ALL_MASK) ? (
                <p className="field-help">This pool is using a restricted AI role mask instead of the default all-roles setting.</p>
              ) : null}
              {settingsActionGuard ? <p className="field-help">{settingsActionGuard}</p> : null}
            </article>
          </div>
        </section>
      ) : null}

      {resolvedPanel === "lifecycle" ? (
        <>
          <PoolLifecyclePanel poolAddress={poolAddress} />

          <ProtocolDetailDisclosure
            title="Schema and rule diagnostics"
            summary="Use this only when you need the lower-level schema/rule visibility tools during lifecycle work."
          >
            <OperatorVisibilityPanel
              lens="schemas"
              initialPoolAddress={poolAddress}
              lockPoolSelection
              sectionMode="embedded"
            />
          </ProtocolDetailDisclosure>
        </>
      ) : null}

      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txUrl ? (
            <a className="secondary-button inline-flex w-fit" href={txUrl} target="_blank" rel="noreferrer">
              View transaction
            </a>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
