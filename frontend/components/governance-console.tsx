// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Landmark, LoaderCircle, RefreshCcw, Users, Vote as VoteIcon, WalletCards } from "lucide-react";

import { GovernanceProposalDetailPanel } from "@/components/governance-proposal-detail-panel";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { RealmsActionsPanel } from "@/components/realms-actions-panel";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import {
  buildDepositGoverningTokensTx,
  buildSchemaStateProposalPlan,
  buildWithdrawGoverningTokensTx,
  formatGovernanceAmount,
  getGovernanceRuntimeConfig,
  loadDefaultProtocolConfig,
  loadGovernanceDashboard,
  parseGovernanceAmountInput,
  type GovernanceDashboardSummary,
} from "@/lib/governance";
import {
  buildSetProtocolEmergencyPauseTx,
  listSchemas,
  type ProtocolConfigSummary,
  type SchemaSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type GovernanceConsoleProps = {
  initialProtocolConfig?: ProtocolConfigSummary | null;
  sectionMode?: "full" | "embedded";
};

type ProposalGroupKey = keyof GovernanceDashboardSummary["proposalCounts"];
type ProposalPlan = Awaited<ReturnType<typeof buildSchemaStateProposalPlan>>;

const GROUP_LABELS: Record<ProposalGroupKey, string> = {
  active: "Active",
  completed: "Completed",
  executable: "Executable",
  failed: "Failed / cancelled",
};

function shortAddress(value: string | null | undefined): string {
  if (!value) return "n/a";
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function explorerClusterLabel(): string {
  return (
    process.env.NEXT_PUBLIC_REALMS_CLUSTER?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER?.trim()
    || "devnet"
  );
}

function combineSchemaHashes(selected: Array<string | null | undefined>, manual: string): string[] {
  return [...new Set(
    [
      ...selected.map((value) => value?.trim() ?? "").filter(Boolean),
      ...manual
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ],
  )];
}

function schemaOptionLabel(schema: SchemaSummary): string {
  return `${schema.schemaKey} v${schema.version}${schema.verified ? " • verified" : " • draft"}`;
}

export function GovernanceConsole({
  initialProtocolConfig = null,
  sectionMode = "full",
}: GovernanceConsoleProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const router = useRouter();
  const runtime = useMemo(() => getGovernanceRuntimeConfig(), []);
  const [dashboard, setDashboard] = useState<GovernanceDashboardSummary | null>(null);
  const [protocolConfig, setProtocolConfig] = useState<ProtocolConfigSummary | null>(initialProtocolConfig);
  const [schemas, setSchemas] = useState<SchemaSummary[]>([]);
  const [selectedProposalAddress, setSelectedProposalAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("1");

  const [emergencyPaused, setEmergencyPaused] = useState(false);

  const [selectedVerifySchemaAddress, setSelectedVerifySchemaAddress] = useState("");
  const [selectedUnverifySchemaAddress, setSelectedUnverifySchemaAddress] = useState("");
  const [selectedCloseSchemaAddress, setSelectedCloseSchemaAddress] = useState("");
  const [manualVerifySchemaHashHex, setManualVerifySchemaHashHex] = useState("");
  const [manualUnverifySchemaHashes, setManualUnverifySchemaHashes] = useState("");
  const [manualCloseSchemaHashes, setManualCloseSchemaHashes] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDashboard, nextProtocolConfig, nextSchemas] = await Promise.all([
        loadGovernanceDashboard({
          connection,
          walletAddress: publicKey ?? null,
        }),
        loadDefaultProtocolConfig(connection).catch(() => initialProtocolConfig),
        listSchemas({ connection, verifiedOnly: false }),
      ]);
      setDashboard(nextDashboard);
      setProtocolConfig(nextProtocolConfig ?? initialProtocolConfig);
      setSchemas(nextSchemas);
    } catch (cause) {
      setStatus(formatRpcError(cause, {
        fallback: "Failed to load governance state.",
        rpcEndpoint: connection.rpcEndpoint,
      }));
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  }, [connection, initialProtocolConfig, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!protocolConfig) return;
    setEmergencyPaused(protocolConfig.emergencyPaused);
  }, [protocolConfig]);

  useEffect(() => {
    if (!dashboard?.proposals.length) {
      setSelectedProposalAddress(null);
      return;
    }
    if (!selectedProposalAddress || !dashboard.proposals.some((proposal) => proposal.address === selectedProposalAddress)) {
      setSelectedProposalAddress(dashboard.proposals[0]?.address ?? null);
    }
  }, [dashboard?.proposals, selectedProposalAddress]);

  useEffect(() => {
    if (selectedVerifySchemaAddress && !schemas.some((schema) => schema.address === selectedVerifySchemaAddress)) {
      setSelectedVerifySchemaAddress("");
    }
    if (selectedUnverifySchemaAddress && !schemas.some((schema) => schema.address === selectedUnverifySchemaAddress)) {
      setSelectedUnverifySchemaAddress("");
    }
    if (selectedCloseSchemaAddress && !schemas.some((schema) => schema.address === selectedCloseSchemaAddress)) {
      setSelectedCloseSchemaAddress("");
    }
  }, [schemas, selectedCloseSchemaAddress, selectedUnverifySchemaAddress, selectedVerifySchemaAddress]);

  const groupedProposals = useMemo(() => {
    return {
      active: dashboard?.proposals.filter((proposal) => proposal.group === "active") ?? [],
      executable: dashboard?.proposals.filter((proposal) => proposal.group === "executable") ?? [],
      completed: dashboard?.proposals.filter((proposal) => proposal.group === "completed") ?? [],
      failed: dashboard?.proposals.filter((proposal) => proposal.group === "failed") ?? [],
    };
  }, [dashboard?.proposals]);

  const walletGuard = useMemo(() => {
    if (!publicKey || !sendTransaction) {
      return "Connect a wallet to deposit governance tokens, create proposals, or vote.";
    }
    return null;
  }, [publicKey, sendTransaction]);

  const structuredComposerDisabledReason = useMemo(() => {
    if (dashboard?.rules.pluginEnabled) {
      return "This DAO uses a governance plugin. Start from the Realms fallback below until plugin-specific native flows are added.";
    }
    if (!dashboard?.wallet?.tokenOwnerRecordAddress || dashboard.wallet.depositedVotesRaw === 0n) {
      return "Deposit governance tokens before creating a proposal.";
    }
    return walletGuard;
  }, [dashboard?.rules.pluginEnabled, dashboard?.wallet?.depositedVotesRaw, dashboard?.wallet?.tokenOwnerRecordAddress, walletGuard]);

  const protocolPauseGuard = useMemo(() => {
    if (!publicKey || !sendTransaction) {
      return "Connect the governance authority wallet to change protocol pause state.";
    }
    if (!protocolConfig) {
      return "Protocol governance is not visible on this RPC endpoint yet.";
    }
    if (publicKey.toBase58() !== protocolConfig.governanceAuthority) {
      return "Only the current protocol governance authority can change protocol pause state directly.";
    }
    return null;
  }, [protocolConfig, publicKey, sendTransaction]);

  const selectedVerifySchema = useMemo(
    () => schemas.find((schema) => schema.address === selectedVerifySchemaAddress) ?? null,
    [schemas, selectedVerifySchemaAddress],
  );
  const selectedUnverifySchema = useMemo(
    () => schemas.find((schema) => schema.address === selectedUnverifySchemaAddress) ?? null,
    [schemas, selectedUnverifySchemaAddress],
  );
  const selectedCloseSchema = useMemo(
    () => schemas.find((schema) => schema.address === selectedCloseSchemaAddress) ?? null,
    [schemas, selectedCloseSchemaAddress],
  );
  const schemaComposerHasAction = Boolean(
    selectedVerifySchema
    || selectedUnverifySchema
    || selectedCloseSchema
    || manualVerifySchemaHashHex.trim()
    || manualUnverifySchemaHashes.trim()
    || manualCloseSchemaHashes.trim(),
  );

  async function onDeposit() {
    if (!publicKey || !sendTransaction || !dashboard) return;
    setBusy("deposit");
    setStatus(null);
    setTxUrl(null);
    try {
      const amountRaw = parseGovernanceAmountInput(depositAmount, dashboard.tokenDecimals);
      if (amountRaw <= 0n) {
        throw new Error("Deposit amount must be greater than zero.");
      }
      const tx = await buildDepositGoverningTokensTx({
        amountRaw,
        connection,
        owner: publicKey,
      });
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: "Deposit governance tokens",
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Deposit failed.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onWithdraw() {
    if (!publicKey || !sendTransaction) return;
    setBusy("withdraw");
    setStatus(null);
    setTxUrl(null);
    try {
      const tx = await buildWithdrawGoverningTokensTx({
        connection,
        owner: publicKey,
      });
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: "Withdraw governance tokens",
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Withdraw failed.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function submitPlan(label: string, planBuilder: () => Promise<ProposalPlan>) {
    if (!publicKey || !sendTransaction) return;
    setBusy(label);
    setStatus(null);
    setTxUrl(null);
    try {
      const plan = await planBuilder();
      let lastExplorerUrl: string | null = null;
      for (const step of plan.steps) {
        const result = await executeProtocolTransaction({
          connection,
          sendTransaction,
          tx: step.tx,
          label: step.label,
        });
        if (!result.ok) {
          setStatus(result.error);
          setStatusTone("error");
          return;
        }
        lastExplorerUrl = result.explorerUrl;
      }
      setStatus(`${label} proposal ${shortAddress(plan.proposalAddress)} submitted and signed off.`);
      setStatusTone("ok");
      setTxUrl(lastExplorerUrl);
      await refresh();
      setSelectedProposalAddress(plan.proposalAddress);
      router.push(`/governance/proposals/${plan.proposalAddress}`);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : `${label} proposal failed.`);
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onApplyProtocolPause() {
    if (!publicKey || !sendTransaction || protocolPauseGuard) return;
    setBusy("Protocol pause");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildSetProtocolEmergencyPauseTx({
        authority: publicKey,
        recentBlockhash: blockhash,
        emergencyPaused,
      });
      const result = await executeProtocolTransaction({
        connection,
        sendTransaction,
        tx,
        label: emergencyPaused ? "Enable protocol pause" : "Resume protocol",
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "Protocol pause update failed.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onSubmitSchemaStateProposal() {
    if (!publicKey || structuredComposerDisabledReason) return;
    await submitPlan("Schema maintenance", async () =>
      buildSchemaStateProposalPlan({
        connection,
        draft: {
          closeSchemaHashes: combineSchemaHashes(
            [selectedCloseSchema?.schemaKeyHashHex],
            manualCloseSchemaHashes,
          ),
          unverifySchemaHashes: combineSchemaHashes(
            [selectedUnverifySchema?.schemaKeyHashHex],
            manualUnverifySchemaHashes,
          ),
          verifySchemaHashHex: manualVerifySchemaHashHex.trim() || selectedVerifySchema?.schemaKeyHashHex || null,
        },
        origin: window.location.origin,
        walletAddress: publicKey,
      }));
  }

  if (loading) {
    return (
      <section className="surface-card space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading governance operations...
        </div>
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className="surface-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="metric-label">Governance</p>
          <button type="button" className="secondary-button inline-flex w-fit items-center gap-2" onClick={() => void refresh()}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Reload
          </button>
        </div>
        <p className="field-help">
          Configure `NEXT_PUBLIC_GOVERNANCE_REALM`, `NEXT_PUBLIC_GOVERNANCE_CONFIG`, and `NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT` to enable native governance.
        </p>
        {status ? <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p> : null}
      </section>
    );
  }

  const sectionTitle = sectionMode === "full" ? "DAO Operations" : "Governance operations";
  const subtitle =
    sectionMode === "full"
      ? "Review DAO health, move voting power, and package governance work without dropping into raw protocol forms."
      : "Use the workspace to review DAO state first, then open the proposal or fallback path that matches this environment.";

  return (
    <div className="space-y-5">
      <section className="surface-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-[var(--accent)]" />
              <p className="metric-label">{sectionTitle}</p>
              <span className={`status-pill ${dashboard.rules.pluginEnabled ? "status-error" : "status-ok"}`}>
                {dashboard.rules.pluginEnabled ? "Realms fallback" : `Native token voting • ${explorerClusterLabel()}`}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{dashboard.realmName}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{subtitle}</p>
          </div>

          <button
            type="button"
            className="secondary-button inline-flex w-fit items-center gap-2"
            onClick={() => void refresh()}
            disabled={busy != null}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="operator-summary-card">
            <p className="metric-label">Realm</p>
            <p className="text-sm font-semibold text-[var(--foreground)] break-all">{dashboard.realmAddress}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Authority {shortAddress(dashboard.realmAuthorityAddress)}</p>
          </article>

          <article className="operator-summary-card">
            <p className="metric-label">Voting rules</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {dashboard.rules.communityVoteThresholdPct != null ? `${dashboard.rules.communityVoteThresholdPct}% yes threshold` : "Threshold unavailable"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {dashboard.rules.instructionHoldUpTimeSeconds}s hold-up • {dashboard.rules.baseVotingTimeSeconds}s voting
            </p>
          </article>

          <article className="operator-summary-card">
            <p className="metric-label">Native treasury</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{Number(dashboard.nativeTreasuryLamports) / 1e9} SOL</p>
            <p className="text-xs text-[var(--muted-foreground)] break-all">{dashboard.nativeTreasuryAddress}</p>
          </article>

          <article className="operator-summary-card">
            <p className="metric-label">DAO activity</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {dashboard.proposals.length} proposals • {dashboard.memberCount} members
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Governed account {shortAddress(dashboard.governedAccountAddress)}
            </p>
          </article>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="surface-card space-y-4">
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-[var(--accent)]" />
            <p className="metric-label">Voting power</p>
          </div>
          <div className="operator-summary-grid">
            <article className="operator-summary-card">
              <p className="metric-label">Wallet balance</p>
              <p className="metric-value">
                {formatGovernanceAmount(dashboard.wallet?.governingTokenBalanceRaw ?? 0n, dashboard.tokenDecimals)}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] break-all">
                {dashboard.wallet?.tokenAccountAddress ?? "Connect a wallet to inspect wallet balance"}
              </p>
            </article>
            <article className="operator-summary-card">
              <p className="metric-label">Deposited voting power</p>
              <p className="metric-value">
                {formatGovernanceAmount(dashboard.wallet?.depositedVotesRaw ?? 0n, dashboard.tokenDecimals)}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Token owner record {shortAddress(dashboard.wallet?.tokenOwnerRecordAddress)}
              </p>
            </article>
          </div>

          {!dashboard.rules.pluginEnabled ? (
            <div className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Move voting power</h3>
                <p className="operator-task-copy">Deposit tokens when you need to create or vote on proposals, then withdraw when you are done.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr,auto,auto] md:items-end">
                <label className="space-y-1">
                  <span className="metric-label">Deposit amount</span>
                  <input
                    className="field-input"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => void onDeposit()}
                  disabled={Boolean(walletGuard) || busy != null}
                >
                  {busy === "deposit" ? "Depositing..." : "Deposit voting power"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void onWithdraw()}
                  disabled={Boolean(walletGuard) || busy != null || (dashboard.wallet?.depositedVotesRaw ?? 0n) === 0n}
                >
                  {busy === "withdraw" ? "Withdrawing..." : "Withdraw all"}
                </button>
              </div>
              {walletGuard ? <p className="field-help">{walletGuard}</p> : null}
            </div>
          ) : (
            <section className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Voting power stays in the Realms flow for this DAO</h3>
                <p className="operator-task-copy">
                  Plugin-based governance deposits and withdrawals are not yet available in the native console. Use the fallback panel below for those actions.
                </p>
              </div>
            </section>
          )}
        </section>

        <section className="surface-card space-y-4">
          <div className="flex items-center gap-2">
            <VoteIcon className="h-4 w-4 text-[var(--accent)]" />
            <p className="metric-label">Create proposal</p>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Schema-state governance stays proposal-driven. Protocol-wide pause is exposed as a live authority control because that is the scoped on-chain surface available today.
          </p>

          <div className="grid gap-4">
            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Control protocol pause</h3>
                <p className="operator-task-copy">
                  Review the live protocol-governance account, then apply the current emergency-pause target directly when you hold the governance authority wallet.
                </p>
              </div>

              <div className="operator-summary-grid">
                <article className="operator-summary-card">
                  <p className="metric-label">Governance authority</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{shortAddress(protocolConfig?.governanceAuthority)}</p>
                </article>
                <article className="operator-summary-card">
                  <p className="metric-label">Protocol fee</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{protocolConfig?.protocolFeeBps ?? 0} bps</p>
                </article>
              </div>

              <div className="grid gap-3">
                <label className="toggle-card">
                  <div>
                    <p className="toggle-card-title">Emergency pause</p>
                    <p className="field-help">This toggles the live protocol-wide pause bit that gates new activity across the public program surface.</p>
                  </div>
                  <input type="checkbox" checked={emergencyPaused} onChange={(event) => setEmergencyPaused(event.target.checked)} />
                </label>
              </div>

              <ProtocolDetailDisclosure
                title="Surface note"
                summary="The broader protocol settings proposal bundle is intentionally not exposed here."
                description="The current public protocol surface supports live protocol-governance review plus scoped emergency pause. Schema verification and closure remain governance-proposal flows below."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <article className="operator-summary-card">
                    <p className="metric-label">Governance account</p>
                    <p className="text-sm font-semibold text-[var(--foreground)] break-all">{protocolConfig?.address ?? "Unavailable"}</p>
                  </article>
                  <article className="operator-summary-card">
                    <p className="metric-label">Emergency state</p>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{protocolConfig?.emergencyPaused ? "Paused" : "Operational"}</p>
                  </article>
                </div>
              </ProtocolDetailDisclosure>

              <button
                type="button"
                className="action-button"
                onClick={() => void onApplyProtocolPause()}
                disabled={Boolean(protocolPauseGuard) || busy != null}
              >
                {busy === "Protocol pause"
                  ? "Submitting..."
                  : emergencyPaused
                    ? "Enable emergency pause"
                    : "Resume protocol"}
              </button>
              {protocolPauseGuard ? <p className="field-help">{protocolPauseGuard}</p> : null}
            </article>

            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Maintain schema state</h3>
                <p className="operator-task-copy">
                  Choose the schema you want to verify, unverify, or close from the registry first. Manual hashes are still available for batch or recovery cases.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="metric-label">Verify schema</span>
                  <select className="field-input" value={selectedVerifySchemaAddress} onChange={(event) => setSelectedVerifySchemaAddress(event.target.value)}>
                    <option value="">No verify action</option>
                    {schemas.map((schema) => (
                      <option key={schema.address} value={schema.address}>
                        {schemaOptionLabel(schema)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Mark unverified</span>
                  <select className="field-input" value={selectedUnverifySchemaAddress} onChange={(event) => setSelectedUnverifySchemaAddress(event.target.value)}>
                    <option value="">No unverify action</option>
                    {schemas.map((schema) => (
                      <option key={schema.address} value={schema.address}>
                        {schemaOptionLabel(schema)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Close schema</span>
                  <select className="field-input" value={selectedCloseSchemaAddress} onChange={(event) => setSelectedCloseSchemaAddress(event.target.value)}>
                    <option value="">No close action</option>
                    {schemas.map((schema) => (
                      <option key={schema.address} value={schema.address}>
                        {schemaOptionLabel(schema)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="operator-summary-grid">
                {selectedVerifySchema ? (
                  <article className="operator-summary-card">
                    <p className="metric-label">Verify target</p>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{schemaOptionLabel(selectedVerifySchema)}</p>
                    <p className="text-xs text-[var(--muted-foreground)] break-all">{selectedVerifySchema.schemaKeyHashHex}</p>
                  </article>
                ) : null}
                {selectedUnverifySchema ? (
                  <article className="operator-summary-card">
                    <p className="metric-label">Unverify target</p>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{schemaOptionLabel(selectedUnverifySchema)}</p>
                    <p className="text-xs text-[var(--muted-foreground)] break-all">{selectedUnverifySchema.schemaKeyHashHex}</p>
                  </article>
                ) : null}
                {selectedCloseSchema ? (
                  <article className="operator-summary-card">
                    <p className="metric-label">Close target</p>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{schemaOptionLabel(selectedCloseSchema)}</p>
                    <p className="text-xs text-[var(--muted-foreground)] break-all">{selectedCloseSchema.schemaKeyHashHex}</p>
                  </article>
                ) : null}
              </div>

              <ProtocolDetailDisclosure
                title="Manual protocol values"
                summary="Use manual hashes for batch updates, missing registry entries, or recovery work."
                description="Manual values are combined with any schema selected above, with duplicate hashes removed."
              >
                <div className="grid gap-3">
                  <label className="space-y-1">
                    <span className="metric-label">Manual verify schema hash</span>
                    <input className="field-input font-mono" value={manualVerifySchemaHashHex} onChange={(event) => setManualVerifySchemaHashHex(event.target.value)} placeholder="Optional 32-byte schema key hash" />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Additional unverify hashes</span>
                    <textarea className="field-input min-h-24 font-mono" value={manualUnverifySchemaHashes} onChange={(event) => setManualUnverifySchemaHashes(event.target.value)} placeholder="Comma-separated schema key hashes" />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Additional close hashes</span>
                    <textarea className="field-input min-h-24 font-mono" value={manualCloseSchemaHashes} onChange={(event) => setManualCloseSchemaHashes(event.target.value)} placeholder="Comma-separated schema key hashes" />
                  </label>
                </div>
              </ProtocolDetailDisclosure>

              <button
                type="button"
                className="action-button"
                onClick={() => void onSubmitSchemaStateProposal()}
                disabled={Boolean(structuredComposerDisabledReason) || !schemaComposerHasAction || busy != null}
              >
                {busy === "Schema maintenance" ? "Submitting..." : "Create schema proposal"}
              </button>
              {structuredComposerDisabledReason ? <p className="field-help">{structuredComposerDisabledReason}</p> : null}
              {!schemaComposerHasAction ? <p className="field-help">Choose at least one schema action or add a manual hash before submitting.</p> : null}
            </article>
          </div>
        </section>
      </div>

      <section className="surface-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <VoteIcon className="h-4 w-4 text-[var(--accent)]" />
            <p className="metric-label">Proposal queue</p>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Pick a proposal to review, vote on, or execute.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {(Object.keys(groupedProposals) as ProposalGroupKey[]).map((groupKey) => (
            <article key={groupKey} className="operator-task-card-soft">
              <div className="flex items-center justify-between gap-2">
                <p className="metric-label">{GROUP_LABELS[groupKey]}</p>
                <span className="status-pill status-ok">{dashboard.proposalCounts[groupKey]}</span>
              </div>
              {groupedProposals[groupKey].length > 0 ? (
                <div className="space-y-2">
                  {groupedProposals[groupKey].map((proposal) => (
                    <button
                      key={proposal.address}
                      type="button"
                      onClick={() => setSelectedProposalAddress(proposal.address)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        selectedProposalAddress === proposal.address
                          ? "border-[var(--accent)] bg-[var(--surface-elevated)]"
                          : "border-[var(--border)]/60 bg-transparent hover:bg-[var(--surface-elevated)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--foreground)]">{proposal.name}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {proposal.stateLabel} • {shortAddress(proposal.ownerWalletAddress)}
                          </p>
                        </div>
                        <Link
                          href={`/governance/proposals/${proposal.address}`}
                          className="shrink-0 text-xs text-[var(--accent)] hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Open
                        </Link>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="field-help">No proposals are currently in this state.</p>
              )}
            </article>
          ))}
        </div>
      </section>

      {selectedProposalAddress ? (
        <GovernanceProposalDetailPanel
          proposalAddress={selectedProposalAddress}
          sectionMode="inline"
        />
      ) : null}

      <section className="surface-card space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--accent)]" />
          <p className="metric-label">Member snapshot</p>
        </div>
        {dashboard.members.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)]/60">
            <div className="grid grid-cols-[minmax(0,1.5fr),minmax(0,1fr),minmax(0,1fr)] gap-3 bg-[var(--surface-elevated)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              <span>Member</span>
              <span>Deposited votes</span>
              <span>Activity</span>
            </div>
            <div className="divide-y divide-[var(--border)]/60">
              {dashboard.members.map((member) => (
                <div key={member.address} className="grid grid-cols-[minmax(0,1.5fr),minmax(0,1fr),minmax(0,1fr)] gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[var(--foreground)]">{member.governingTokenOwner}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">Record {shortAddress(member.address)}</p>
                  </div>
                  <div className="text-[var(--foreground)]">
                    {formatGovernanceAmount(member.depositedVotesRaw, dashboard.tokenDecimals)}
                  </div>
                  <div className="text-[var(--muted-foreground)]">
                    {member.totalVotesCount} votes • {member.outstandingProposalCount} open
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="field-help">No token owner records are visible for the configured realm yet.</p>
        )}
      </section>

      <RealmsActionsPanel
        cluster={runtime.cluster}
        realmAddress={dashboard.realmAddress}
      />

      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txUrl ? (
            <a href={txUrl} target="_blank" rel="noreferrer" className="secondary-button inline-flex w-fit">
              View latest transaction
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
