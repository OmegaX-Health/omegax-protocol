// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CheckCircle2, RefreshCw, Waves } from "lucide-react";

import { PoolLiquidityPanel as PoolLiquidityDirectPanel } from "@/components/pool-liquidity-panel";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { usePoolWorkspaceContext } from "@/components/pool-workspace-context";
import { SearchableSelect } from "@/components/searchable-select";
import { executeProtocolTransaction } from "@/lib/protocol-action";
import { deriveRedemptionQueueActionDraft } from "@/lib/protocol-workspace-mappers";
import {
  CAPITAL_CLASS_MODE_HYBRID,
  CAPITAL_TRANSFER_MODE_RESTRICTED,
  REDEMPTION_REQUEST_STATUS_PENDING,
  REDEMPTION_REQUEST_STATUS_SCHEDULED,
  ZERO_PUBKEY,
  buildCancelPoolLiquidityRedemptionTx,
  buildFailPoolLiquidityRedemptionTx,
  buildFulfillPoolLiquidityRedemptionSolTx,
  buildFulfillPoolLiquidityRedemptionSplTx,
  buildRegisterPoolCapitalClassTx,
  buildRequestPoolLiquidityRedemptionTx,
  buildSchedulePoolLiquidityRedemptionTx,
  hashStringTo32Hex,
  listPoolCapitalClasses,
  listPoolRedemptionRequests,
  listPoolTerms,
  listWalletTokenAccountsForMint,
  toExplorerLink,
  type PoolCapitalClassSummary,
  type PoolRedemptionRequestSummary,
  type PoolTermsSummary,
  type TokenAccountSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";
import { parseWorkspacePanel, visibleWorkspacePanels, type PoolWorkspacePanel } from "@/lib/ui-capabilities";

type PoolLiquidityConsoleProps = {
  poolAddress: string;
  syncSectionParam?: boolean;
  visiblePanelsOverride?: ReadonlyArray<PoolWorkspacePanel>;
};

const LIQUIDITY_PANELS: ReadonlyArray<{ value: PoolWorkspacePanel; label: string }> = [
  { value: "capital", label: "Capital" },
  { value: "direct", label: "Direct" },
  { value: "queue", label: "Queue" },
];

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function parseDaysToSeconds(value: string): bigint {
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0n;
  return BigInt(Math.round(parsed * 86_400));
}

export function PoolLiquidityConsole({
  poolAddress,
  syncSectionParam = true,
  visiblePanelsOverride,
}: PoolLiquidityConsoleProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { capabilities } = usePoolWorkspaceContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedPanel = parseWorkspacePanel("liquidity", searchParams.get("panel"));
  const [capitalClasses, setCapitalClasses] = useState<PoolCapitalClassSummary[]>([]);
  const [redemptionRequests, setRedemptionRequests] = useState<PoolRedemptionRequestSummary[]>([]);
  const [poolTerms, setPoolTerms] = useState<PoolTermsSummary | null>(null);
  const [redeemerTokenAccounts, setRedeemerTokenAccounts] = useState<TokenAccountSummary[]>([]);
  const [selectedCapitalClassAddress, setSelectedCapitalClassAddress] = useState("");
  const [selectedRequestAddress, setSelectedRequestAddress] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);

  const [classIdSeed, setClassIdSeed] = useState("growth-class");
  const [classModeInput, setClassModeInput] = useState(String(CAPITAL_CLASS_MODE_HYBRID));
  const [classPriorityInput, setClassPriorityInput] = useState("1");
  const [transferModeInput, setTransferModeInput] = useState(String(CAPITAL_TRANSFER_MODE_RESTRICTED));
  const [restrictedInput, setRestrictedInput] = useState(true);
  const [queueEnabledInput, setQueueEnabledInput] = useState(true);
  const [ringFencedInput, setRingFencedInput] = useState(false);
  const [lockupDaysInput, setLockupDaysInput] = useState("30");
  const [noticeDaysInput, setNoticeDaysInput] = useState("7");
  const [complianceProfileHashInput, setComplianceProfileHashInput] = useState("");
  const [seriesRefHashInput, setSeriesRefHashInput] = useState("");
  const [vintageIndexInput, setVintageIndexInput] = useState("1");
  const [requestSeedInput, setRequestSeedInput] = useState("member-redemption-1");
  const [sharesInInput, setSharesInInput] = useState("0");
  const [minAmountOutInput, setMinAmountOutInput] = useState("0");
  const [failureCodeInput, setFailureCodeInput] = useState("1");
  const [selectedRedeemerTokenAccount, setSelectedRedeemerTokenAccount] = useState("");

  const visiblePanels = useMemo(
    () => visiblePanelsOverride ?? visibleWorkspacePanels("liquidity", capabilities),
    [capabilities, visiblePanelsOverride],
  );
  const activePanel = useMemo<PoolWorkspacePanel>(
    () => (requestedPanel && visiblePanels.includes(requestedPanel) ? requestedPanel : visiblePanels[0] ?? "direct"),
    [requestedPanel, visiblePanels],
  );
  const panelLead = useMemo(() => {
    if (activePanel === "capital") return "Define capital classes only when the connected wallet is allowed to manage them.";
    if (activePanel === "queue") return "Select a queued request first, then schedule, cancel, fail, or fulfill from that discovered row.";
    return "Use the direct liquidity surface for deposits and redemptions, while queue actions stay one tab away when needed.";
  }, [activePanel]);

  const selectedCapitalClass = useMemo(
    () => capitalClasses.find((row) => row.address === selectedCapitalClassAddress) ?? capitalClasses[0] ?? null,
    [capitalClasses, selectedCapitalClassAddress],
  );
  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return redemptionRequests;
    return redemptionRequests.filter((row) =>
      [row.redeemer, row.requestHashHex, row.shareMint, row.payoutMint, row.address].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [redemptionRequests, search]);
  const selectedRequest = useMemo(
    () => filteredRequests.find((row) => row.address === selectedRequestAddress) ?? redemptionRequests.find((row) => row.address === selectedRequestAddress) ?? null,
    [filteredRequests, redemptionRequests, selectedRequestAddress],
  );
  const requestDraft = useMemo(
    () => deriveRedemptionQueueActionDraft({ request: selectedRequest, capitalClass: selectedCapitalClass }),
    [selectedCapitalClass, selectedRequest],
  );

  const setPanel = useCallback((nextPanel: PoolWorkspacePanel) => {
    const params = new URLSearchParams(searchParams.toString());
    if (syncSectionParam) {
      params.set("section", "liquidity");
    } else {
      params.delete("section");
    }
    params.set("panel", nextPanel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, syncSectionParam]);

  useEffect(() => {
    if (requestedPanel === activePanel) return;
    setPanel(activePanel);
  }, [activePanel, requestedPanel, setPanel]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextCapitalClasses, nextRequests, nextPoolTerms] = await Promise.all([
        listPoolCapitalClasses({ connection, poolAddress, search: null }),
        listPoolRedemptionRequests({ connection, poolAddress, search: null }),
        listPoolTerms({ connection, poolAddress, search: null }),
      ]);
      setCapitalClasses(nextCapitalClasses);
      setRedemptionRequests(nextRequests);
      setPoolTerms(nextPoolTerms[0] ?? null);
      setSelectedCapitalClassAddress((current) =>
        current && nextCapitalClasses.some((row) => row.address === current) ? current : nextCapitalClasses[0]?.address ?? "");
      setSelectedRequestAddress((current) =>
        current && nextRequests.some((row) => row.address === current) ? current : nextRequests[0]?.address ?? "");
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load liquidity queue data.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [connection, poolAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (filteredRequests.length === 0) {
      setSelectedRequestAddress("");
      return;
    }
    setSelectedRequestAddress((current) =>
      current && filteredRequests.some((row) => row.address === current) ? current : filteredRequests[0]!.address);
  }, [filteredRequests]);

  useEffect(() => {
    if (!selectedRequest || selectedRequest.payoutMint === ZERO_PUBKEY) {
      setRedeemerTokenAccounts([]);
      setSelectedRedeemerTokenAccount("");
      return;
    }
    let cancelled = false;
    void listWalletTokenAccountsForMint({
      connection,
      owner: selectedRequest.redeemer,
      mint: selectedRequest.payoutMint,
      search: null,
    }).then((rows) => {
      if (cancelled) return;
      setRedeemerTokenAccounts(rows);
      setSelectedRedeemerTokenAccount((current) =>
        current && rows.some((row) => row.address === current) ? current : rows[0]?.address ?? "");
    }).catch(() => {
      if (cancelled) return;
      setRedeemerTokenAccounts([]);
      setSelectedRedeemerTokenAccount("");
    });
    return () => {
      cancelled = true;
    };
  }, [connection, selectedRequest]);

  const capitalClassOptions = useMemo(
    () =>
      capitalClasses.map((row) => ({
        value: row.address,
        label: `${shortAddress(row.classIdHashHex)} • priority ${row.classPriority}`,
        hint: `${row.redemptionQueueEnabled ? "Queue enabled" : "Direct redeem"} • notice ${row.redemptionNoticeSecs.toString()}s`,
      })),
    [capitalClasses],
  );
  const requestOptions = useMemo(
    () =>
      filteredRequests.map((row) => ({
        value: row.address,
        label: `${shortAddress(row.redeemer)} • ${shortAddress(row.requestHashHex)}`,
        hint: `${row.sharesRequested.toString()} shares • status ${row.status}`,
      })),
    [filteredRequests],
  );

  const walletAddress = publicKey?.toBase58() ?? "";
  const capitalClassGuard = useMemo(
    () => (!capabilities.canManageCapitalClasses ? "Capital-class management is limited to operator or risk wallets." : ""),
    [capabilities.canManageCapitalClasses],
  );
  const requestGuard = useMemo(() => {
    if (!capabilities.canOperateOwnedRedemptionQueue) {
      return "Queued redemption requests require a capital-provider or operator wallet.";
    }
    if (!requestDraft.canRequest) {
      return "The selected capital class is not ready for a new queued redemption request.";
    }
    return "";
  }, [capabilities.canOperateOwnedRedemptionQueue, requestDraft.canRequest]);
  const operatorQueueGuard = useMemo(
    () => (!capabilities.canOperateQueueAsOperator ? "Scheduling, failing, and fulfilling requests is limited to queue-operator wallets." : ""),
    [capabilities.canOperateQueueAsOperator],
  );
  const cancelGuard = useMemo(() => {
    if (!selectedRequest) return "Select a queued redemption first.";
    if (walletAddress !== selectedRequest.redeemer) {
      return "Cancel requires the queued redeemer wallet.";
    }
    return "";
  }, [selectedRequest, walletAddress]);
  const fulfillGuard = useMemo(() => {
    if (operatorQueueGuard) return operatorQueueGuard;
    if (!requestDraft.canFulfill) return "The selected queued redemption is not ready to fulfill.";
    if (selectedRequest?.payoutMint !== ZERO_PUBKEY && !selectedRedeemerTokenAccount) {
      return "Select the redeemer payout token account before fulfilling the SPL request.";
    }
    return "";
  }, [operatorQueueGuard, requestDraft.canFulfill, selectedRedeemerTokenAccount, selectedRequest?.payoutMint]);

  async function runAction(
    label: string,
    buildTx: (recentBlockhash: string) => ReturnType<typeof buildRegisterPoolCapitalClassTx>,
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
      await refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function onRegisterCapitalClass() {
    if (!publicKey) return;
    const classIdHashHex = await hashStringTo32Hex(classIdSeed.trim() || "capital-class");
    await runAction("Register capital class", (recentBlockhash) =>
      buildRegisterPoolCapitalClassTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        recentBlockhash,
        classIdHashHex,
        classMode: Number.parseInt(classModeInput, 10) || 0,
        classPriority: Number.parseInt(classPriorityInput, 10) || 0,
        transferMode: Number.parseInt(transferModeInput, 10) || 0,
        restricted: restrictedInput,
        redemptionQueueEnabled: queueEnabledInput,
        ringFenced: ringFencedInput,
        lockupSecs: parseDaysToSeconds(lockupDaysInput),
        redemptionNoticeSecs: parseDaysToSeconds(noticeDaysInput),
        complianceProfileHashHex: complianceProfileHashInput || undefined,
        seriesRefHashHex: seriesRefHashInput || undefined,
        vintageIndex: Number.parseInt(vintageIndexInput, 10) || 0,
      }));
  }

  async function onRequestRedemption() {
    if (!publicKey) return;
    const requestHashHex = await hashStringTo32Hex(requestSeedInput.trim() || "redemption-request");
    await runAction("Request queued redemption", (recentBlockhash) =>
      buildRequestPoolLiquidityRedemptionTx({
        redeemer: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: poolTerms ? new PublicKey(poolTerms.payoutAssetMint) : undefined,
        requestHashHex,
        sharesIn: BigInt(sharesInInput || "0"),
        minAmountOut: BigInt(minAmountOutInput || "0"),
        recentBlockhash,
        includePoolCapitalClass: true,
        includePoolCompliancePolicy: true,
        includeMembership: true,
      }));
  }

  async function onScheduleRequest() {
    if (!publicKey || !selectedRequest) return;
    await runAction("Schedule redemption request", (recentBlockhash) =>
      buildSchedulePoolLiquidityRedemptionTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        redemptionRequest: new PublicKey(selectedRequest.address),
        recentBlockhash,
        includePoolControlAuthority: true,
      }));
  }

  async function onCancelRequest() {
    if (!publicKey || !selectedRequest) return;
    await runAction("Cancel redemption request", (recentBlockhash) =>
      buildCancelPoolLiquidityRedemptionTx({
        redeemer: publicKey,
        poolAddress: new PublicKey(poolAddress),
        redemptionRequest: new PublicKey(selectedRequest.address),
        recentBlockhash,
      }));
  }

  async function onFailRequest() {
    if (!publicKey || !selectedRequest) return;
    await runAction("Fail redemption request", (recentBlockhash) =>
      buildFailPoolLiquidityRedemptionTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        redemptionRequest: new PublicKey(selectedRequest.address),
        redeemer: new PublicKey(selectedRequest.redeemer),
        failureCode: Number.parseInt(failureCodeInput, 10) || 0,
        recentBlockhash,
        includePoolControlAuthority: true,
      }));
  }

  async function onFulfillRequest() {
    if (!publicKey || !selectedRequest) return;
    await runAction("Fulfill redemption request", (recentBlockhash) => {
      if (selectedRequest.payoutMint === ZERO_PUBKEY) {
        return buildFulfillPoolLiquidityRedemptionSolTx({
          authority: publicKey,
          poolAddress: new PublicKey(poolAddress),
          redemptionRequest: new PublicKey(selectedRequest.address),
          redeemerSystemAccount: new PublicKey(selectedRequest.redeemer),
          recentBlockhash,
          includePoolControlAuthority: true,
        });
      }
      return buildFulfillPoolLiquidityRedemptionSplTx({
        authority: publicKey,
        poolAddress: new PublicKey(poolAddress),
        payoutMint: new PublicKey(selectedRequest.payoutMint),
        redemptionRequest: new PublicKey(selectedRequest.address),
        redeemerPayoutTokenAccount: new PublicKey(selectedRedeemerTokenAccount),
        recentBlockhash,
        includePoolControlAuthority: true,
      });
    });
  }

  return (
    <section className="space-y-4">
      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Waves className="h-4 w-4 text-[var(--accent-strong)]" />
            <p className="metric-label">Liquidity workspace</p>
          </div>
          <button
            type="button"
            className="secondary-button inline-flex items-center gap-1.5"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <p className="field-help">{panelLead}</p>
        <div className="flex flex-wrap gap-2">
          <span className="status-pill status-off">{capitalClasses.length} capital classes</span>
          <span className="status-pill status-off">{redemptionRequests.length} queued requests</span>
        </div>
      </section>

      {visiblePanels.length > 1 ? (
        <section className="surface-card-soft space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {LIQUIDITY_PANELS.filter((panel) => visiblePanels.includes(panel.value)).map((panel) => (
              <button
                key={panel.value}
                type="button"
                className={`segment-button ${activePanel === panel.value ? "segment-button-active" : ""}`}
                onClick={() => setPanel(panel.value)}
              >
                {panel.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activePanel === "capital" ? (
        <section className="surface-card-soft space-y-4">
          <SearchableSelect
            label="Capital class"
            value={selectedCapitalClassAddress}
            options={capitalClassOptions}
            onChange={setSelectedCapitalClassAddress}
            searchValue=""
            onSearchChange={() => {}}
            placeholder="Select capital class"
            disabled={!capitalClassOptions.length}
            disabledHint="No capital class is registered for this pool yet."
            emptyMessage="No capital classes were discovered."
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Selected capital class</h3>
                <p className="operator-task-copy">Review the current class before registering a new one or adjusting how redemptions should behave.</p>
              </div>
              {selectedCapitalClass ? (
                <div className="space-y-2">
                  <div className="operator-summary-row">
                    <span>Class mode</span>
                    <strong>{selectedCapitalClass.classMode === 0 ? "NAV" : selectedCapitalClass.classMode === 1 ? "Distribution" : "Hybrid"}</strong>
                  </div>
                  <div className="operator-summary-row">
                    <span>Queue status</span>
                    <strong>{selectedCapitalClass.redemptionQueueEnabled ? "Enabled" : "Disabled"}</strong>
                  </div>
                  <div className="operator-summary-row">
                    <span>Notice window</span>
                    <strong>{selectedCapitalClass.redemptionNoticeSecs.toString()}s</strong>
                  </div>
                  <ProtocolDetailDisclosure title="Protocol class details" summary="Series and compliance hashes stay tucked away unless you need to inspect them.">
                    <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                      <p>Class address: <span className="break-all font-mono">{selectedCapitalClass.address}</span></p>
                      <p>Class id hash: <span className="break-all font-mono">{selectedCapitalClass.classIdHashHex}</span></p>
                      <p>Series ref hash: <span className="break-all font-mono">{selectedCapitalClass.seriesRefHashHex}</span></p>
                      <p>Compliance profile hash: <span className="break-all font-mono">{selectedCapitalClass.complianceProfileHashHex}</span></p>
                    </div>
                  </ProtocolDetailDisclosure>
                </div>
              ) : (
                <p className="field-help">No capital class is registered for this pool yet.</p>
              )}
            </article>

            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Register capital class</h3>
                <p className="operator-task-copy">Set the class behavior first, then open protocol details only for raw hashes.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="metric-label">Class seed</span>
                  <input className="field-input" value={classIdSeed} onChange={(event) => setClassIdSeed(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Class mode</span>
                  <select className="field-input" value={classModeInput} onChange={(event) => setClassModeInput(event.target.value)}>
                    <option value="0">NAV</option>
                    <option value="1">Distribution</option>
                    <option value="2">Hybrid</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Priority</span>
                  <input className="field-input" value={classPriorityInput} onChange={(event) => setClassPriorityInput(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Transfer mode</span>
                  <select className="field-input" value={transferModeInput} onChange={(event) => setTransferModeInput(event.target.value)}>
                    <option value="0">Permissionless</option>
                    <option value="1">Restricted</option>
                    <option value="2">Wrapper-only</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Lockup (days)</span>
                  <input className="field-input" value={lockupDaysInput} onChange={(event) => setLockupDaysInput(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Notice window (days)</span>
                  <input className="field-input" value={noticeDaysInput} onChange={(event) => setNoticeDaysInput(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Vintage index</span>
                  <input className="field-input" value={vintageIndexInput} onChange={(event) => setVintageIndexInput(event.target.value)} />
                </label>
                <label className="toggle-card md:col-span-2">
                  <div>
                    <p className="toggle-card-title">Class restrictions</p>
                    <p className="field-help">Choose whether transfers are restricted, queued redemptions are enabled, and capital is ring-fenced.</p>
                  </div>
                  <div className="flex gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                      <input type="checkbox" checked={restrictedInput} onChange={(event) => setRestrictedInput(event.target.checked)} />
                      Restricted
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                      <input type="checkbox" checked={queueEnabledInput} onChange={(event) => setQueueEnabledInput(event.target.checked)} />
                      Queue redemptions
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
                      <input type="checkbox" checked={ringFencedInput} onChange={(event) => setRingFencedInput(event.target.checked)} />
                      Ring-fenced
                    </label>
                  </div>
                </label>
              </div>
              <ProtocolDetailDisclosure title="Manual protocol values" summary="Series and compliance hashes stay available here for expert setup cases.">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="metric-label">Series ref hash</span>
                    <input className="field-input font-mono" value={seriesRefHashInput} onChange={(event) => setSeriesRefHashInput(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="metric-label">Compliance profile hash</span>
                    <input className="field-input font-mono" value={complianceProfileHashInput} onChange={(event) => setComplianceProfileHashInput(event.target.value)} />
                  </label>
                </div>
              </ProtocolDetailDisclosure>
              {capabilities.canManageCapitalClasses ? (
                <button type="button" className="action-button" onClick={() => void onRegisterCapitalClass()} disabled={Boolean(busyAction) || Boolean(capitalClassGuard)}>
                  {busyAction === "Register capital class" ? "Registering..." : "Register capital class"}
                </button>
              ) : (
                <p className="field-help">{capitalClassGuard}</p>
              )}
            </article>
          </div>
        </section>
      ) : null}

      {activePanel === "direct" ? (
        <PoolLiquidityDirectPanel poolAddress={poolAddress} sectionMode="embedded" />
      ) : null}

      {activePanel === "queue" ? (
        <section className="surface-card-soft space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
              <p className="metric-label">Request redemption</p>
              <p className="field-help">
                Class-aware request flow. Queue enablement and notice semantics come from the selected capital class.
              </p>
              <label className="space-y-1">
                <span className="metric-label">Request seed</span>
                <input className="field-input" value={requestSeedInput} onChange={(event) => setRequestSeedInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Shares in</span>
                <input className="field-input" value={sharesInInput} onChange={(event) => setSharesInInput(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="metric-label">Min amount out</span>
                <input className="field-input" value={minAmountOutInput} onChange={(event) => setMinAmountOutInput(event.target.value)} />
              </label>
              <button type="button" className="action-button" onClick={() => void onRequestRedemption()} disabled={Boolean(busyAction) || Boolean(requestGuard)}>
                {busyAction === "Request queued redemption" ? "Submitting..." : "Request queued redemption"}
              </button>
              <p className="field-help">
                Queue {requestDraft.queueEnabled ? "enabled" : "disabled"} • notice {requestDraft.noticeWindowSecs.toString()}s • class {requestDraft.classLabel}
              </p>
              {requestGuard ? <p className="field-help">{requestGuard}</p> : null}
            </article>

            <article className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 space-y-3">
              <SearchableSelect
                label="Queued redemption"
                value={selectedRequestAddress}
                options={requestOptions}
                onChange={setSelectedRequestAddress}
                searchValue={search}
                onSearchChange={setSearch}
                loading={loading}
                placeholder="Select request"
                emptyMessage="No queued redemptions match the current search."
              />
              {selectedRequest ? (
                <>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="monitor-row">
                      <span>Status</span>
                      <span>{requestDraft.requestStatusLabel}</span>
                    </div>
                    <div className="monitor-row">
                      <span>Redeemer</span>
                      <span>{shortAddress(selectedRequest.redeemer)}</span>
                    </div>
                    <div className="monitor-row">
                      <span>Shares</span>
                      <span>{selectedRequest.sharesRequested.toString()}</span>
                    </div>
                    <div className="monitor-row">
                      <span>Expected out</span>
                      <span>{selectedRequest.expectedAmountOut.toString()}</span>
                    </div>
                  </div>
                  {selectedRequest.payoutMint !== ZERO_PUBKEY ? (
                    <label className="space-y-1">
                      <span className="metric-label">Redeemer payout token account</span>
                      <select className="field-input" value={selectedRedeemerTokenAccount} onChange={(event) => setSelectedRedeemerTokenAccount(event.target.value)}>
                        <option value="">Select token account</option>
                        {redeemerTokenAccounts.map((row) => (
                          <option key={row.address} value={row.address}>
                            {shortAddress(row.address)} • balance {row.amount}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="secondary-button" onClick={() => void onScheduleRequest()} disabled={Boolean(busyAction) || Boolean(operatorQueueGuard) || !requestDraft.canSchedule}>
                      {busyAction === "Schedule redemption request" ? "Scheduling..." : "Schedule"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void onCancelRequest()} disabled={Boolean(busyAction) || Boolean(cancelGuard) || !requestDraft.canCancel}>
                      {busyAction === "Cancel redemption request" ? "Cancelling..." : "Cancel"}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void onFailRequest()} disabled={Boolean(busyAction) || Boolean(operatorQueueGuard) || !requestDraft.canFail}>
                      {busyAction === "Fail redemption request" ? "Failing..." : "Fail"}
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      onClick={() => void onFulfillRequest()}
                      disabled={Boolean(busyAction) || Boolean(fulfillGuard)}
                    >
                      {busyAction === "Fulfill redemption request" ? "Fulfilling..." : "Fulfill"}
                    </button>
                  </div>
                  <p className="field-help">
                    Recommended next action: {requestDraft.recommendedAction}. Pending requests can be scheduled; scheduled requests can be fulfilled or failed.
                  </p>
                  <ProtocolDetailDisclosure title="Operator resolution details" summary="Failure codes stay collapsed until an operator actually needs to fail a queued request.">
                    <label className="space-y-1">
                      <span className="metric-label">Failure code</span>
                      <input className="field-input" value={failureCodeInput} onChange={(event) => setFailureCodeInput(event.target.value)} />
                    </label>
                  </ProtocolDetailDisclosure>
                  {operatorQueueGuard || cancelGuard || fulfillGuard ? (
                    <p className="field-help">{fulfillGuard || cancelGuard || operatorQueueGuard}</p>
                  ) : null}
                </>
              ) : (
                <p className="field-help">Select a queued redemption to drive schedule/fail/fulfill actions from the discovered case row.</p>
              )}
            </article>
          </div>
        </section>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}
      {status ? (
        <section className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txUrl ? (
            <a className="secondary-button inline-flex w-fit items-center gap-2" href={txUrl} target="_blank" rel="noreferrer">
              <CheckCircle2 className="h-4 w-4" />
              View transaction
            </a>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
