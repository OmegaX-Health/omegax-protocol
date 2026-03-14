// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { AdvancedOverride } from "@/components/advanced-override";
import { SearchableSelect } from "@/components/searchable-select";
import {
  buildSubmitCoverageClaimTx,
  buildSubmitRewardClaimTx,
  hashStringTo32Hex,
  listOutcomeAggregates,
  listPools,
  toExplorerLink,
  type OutcomeAggregateSummary,
  type PoolSummary,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

function normalize(value: string): string {
  return value.trim();
}

function isPubkey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function isHex32(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(normalize(value).replace(/^0x/, ""));
}

function isPositiveBigInt(value: string): boolean {
  try {
    return BigInt(normalize(value)) > 0n;
  } catch {
    return false;
  }
}

function parseBigInt(value: string): bigint | null {
  try {
    return BigInt(normalize(value));
  } catch {
    return null;
  }
}

type ClaimType = "reward" | "coverage";
type StepId = "step-context" | "step-record" | "step-payload" | "step-submit";

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

type MemberClaimsPanelProps = {
  initialPoolAddress?: string;
  lockPoolSelection?: boolean;
  sectionMode?: "standalone" | "embedded";
};

export function MemberClaimsPanel({
  initialPoolAddress,
  lockPoolSelection = false,
  sectionMode = "standalone",
}: MemberClaimsPanelProps) {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const normalizedInitialPoolAddress = normalize(initialPoolAddress ?? "");
  const poolLocked = lockPoolSelection && isPubkey(normalizedInitialPoolAddress);
  const embedded = sectionMode === "embedded";

  const [claimType, setClaimType] = useState<ClaimType>("reward");
  const [focusMode] = useState(false);
  const [openStepId, setOpenStepId] = useState<StepId>("step-context");
  const [memberAddress, setMemberAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [intentHashHex, setIntentHashHex] = useState("");
  const [eventHashHex, setEventHashHex] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("1000000");

  const [search, setSearch] = useState({ pools: "", aggregates: "" });
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [showAllRewardAggregates, setShowAllRewardAggregates] = useState(false);

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [aggregates, setAggregates] = useState<OutcomeAggregateSummary[]>([]);
  const [selectedPoolAddress, setSelectedPoolAddress] = useState(poolLocked ? normalizedInitialPoolAddress : "");
  const [selectedAggregateAddress, setSelectedAggregateAddress] = useState("");

  const [manualPoolAddress, setManualPoolAddress] = useState(poolLocked ? normalizedInitialPoolAddress : "");
  const [manualCycleHashHex, setManualCycleHashHex] = useState("");
  const [manualRuleHashHex, setManualRuleHashHex] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txSig, setTxSig] = useState("");

  const selectedAggregate = useMemo(
    () => aggregates.find((row) => row.address === selectedAggregateAddress) ?? null,
    [aggregates, selectedAggregateAddress],
  );
  const actionableAggregates = useMemo(
    () => aggregates.filter((aggregate) => aggregate.passed && !aggregate.claimed),
    [aggregates],
  );
  const visibleAggregates = useMemo(
    () => (showAllRewardAggregates ? aggregates : actionableAggregates),
    [actionableAggregates, aggregates, showAllRewardAggregates],
  );

  const effectiveMember = normalize(memberAddress) || publicKey?.toBase58() || "";
  const effectiveRecipient = normalize(recipientAddress) || publicKey?.toBase58() || "";
  const effectiveOverrideEnabled = !poolLocked && overrideEnabled;
  const effectivePoolAddress = normalize(
    effectiveOverrideEnabled
      ? manualPoolAddress
      : selectedPoolAddress || manualPoolAddress || (poolLocked ? normalizedInitialPoolAddress : ""),
  );
  const effectiveCycleHash = normalize(
    effectiveOverrideEnabled ? manualCycleHashHex : selectedAggregate?.cycleHashHex || manualCycleHashHex,
  );
  const effectiveRuleHash = normalize(
    effectiveOverrideEnabled ? manualRuleHashHex : selectedAggregate?.ruleHashHex || manualRuleHashHex,
  );

  const payoutSol = Number(normalize(payoutAmount) || "0") / 1_000_000_000;
  const selectedPool = useMemo(
    () => pools.find((pool) => pool.address === effectivePoolAddress) ?? null,
    [effectivePoolAddress, pools],
  );
  const expectedPayout = selectedPool?.payoutLamportsPerPass.toString() ?? null;
  const parsedPayoutAmount = parseBigInt(payoutAmount);

  const refreshSelectors = useCallback(async () => {
    setSelectorLoading(true);
    setSelectorError(null);
    try {
      const nextPools = await listPools({ connection, search: search.pools || null });
      setPools(nextPools);
      const resolvedPoolAddress = normalize(
        poolLocked
          ? normalizedInitialPoolAddress
          : effectiveOverrideEnabled
            ? manualPoolAddress
            : selectedPoolAddress || nextPools[0]?.address || "",
      );
      if (poolLocked) {
        setSelectedPoolAddress(normalizedInitialPoolAddress);
      } else if (!effectiveOverrideEnabled && !selectedPoolAddress && resolvedPoolAddress) {
        setSelectedPoolAddress(resolvedPoolAddress);
      }

      if (resolvedPoolAddress) {
        const nextAggregates = await listOutcomeAggregates({
          connection,
          poolAddress: resolvedPoolAddress,
          memberAddress: effectiveMember || null,
          finalizedOnly: true,
          search: search.aggregates || null,
        });
        setAggregates(nextAggregates);
        if (!selectedAggregateAddress && nextAggregates.length > 0) {
          setSelectedAggregateAddress(nextAggregates[0]!.address);
        }
      } else {
        setAggregates([]);
      }
    } catch (error) {
      setSelectorError(
        formatRpcError(error, {
          fallback: "Failed to load selector data from chain.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setSelectorLoading(false);
    }
  }, [
    connection,
    effectiveOverrideEnabled,
    effectiveMember,
    manualPoolAddress,
    normalizedInitialPoolAddress,
    poolLocked,
    search.aggregates,
    search.pools,
    selectedAggregateAddress,
    selectedPoolAddress,
  ]);

  useEffect(() => {
    void refreshSelectors();
  }, [refreshSelectors]);

  useEffect(() => {
    if (!poolLocked) return;
    setOverrideEnabled(false);
    setSelectedPoolAddress(normalizedInitialPoolAddress);
    setManualPoolAddress(normalizedInitialPoolAddress);
  }, [normalizedInitialPoolAddress, poolLocked]);

  useEffect(() => {
    if (claimType !== "reward" || effectiveOverrideEnabled) return;
    if (visibleAggregates.length === 0) {
      setSelectedAggregateAddress("");
      return;
    }
    if (!visibleAggregates.some((aggregate) => aggregate.address === selectedAggregateAddress)) {
      setSelectedAggregateAddress(visibleAggregates[0]!.address);
    }
  }, [claimType, effectiveOverrideEnabled, selectedAggregateAddress, visibleAggregates]);

  useEffect(() => {
    if (!publicKey) return;
    const wallet = publicKey.toBase58();
    if (!memberAddress) {
      setMemberAddress(wallet);
    }
    if (claimType === "reward" && !recipientAddress) {
      setRecipientAddress(wallet);
    }
  }, [claimType, memberAddress, publicKey, recipientAddress]);

  const baseGuard = useMemo(() => {
    if (!connected || !publicKey) return "Connect your wallet first.";
    if (!isPubkey(effectivePoolAddress)) return "Pool address must be valid.";
    if (!isPubkey(effectiveMember)) return "Member address must be valid.";
    return "";
  }, [connected, effectiveMember, effectivePoolAddress, publicKey]);

  const claimGuard = useMemo(() => {
    if (baseGuard) return baseGuard;
    if (claimType === "reward") {
      if (!isPubkey(effectiveRecipient)) return "Recipient must be valid.";
      if (!isPositiveBigInt(payoutAmount)) return "Payout amount must be greater than zero.";
      if (selectedPool && parsedPayoutAmount !== null && parsedPayoutAmount !== selectedPool.payoutLamportsPerPass) {
        return `Payout amount must match pool payout (${selectedPool.payoutLamportsPerPass.toString()} lamports).`;
      }
      if (!effectiveOverrideEnabled && !selectedAggregate) {
        return "Select a finalized passed aggregate (or enable advanced override).";
      }
      if (!effectiveOverrideEnabled && selectedAggregate?.claimed) {
        return "Selected aggregate is already claimed.";
      }
      if (!effectiveOverrideEnabled && selectedAggregate && !selectedAggregate.passed) {
        return "Selected aggregate did not pass oracle quorum.";
      }
      if (!isHex32(effectiveCycleHash)) return "Cycle hash must be 32-byte hex.";
      if (!isHex32(effectiveRuleHash)) return "Rule hash must be 32-byte hex.";
      if (!isHex32(intentHashHex)) return "Intent hash must be 32-byte hex.";
      return "";
    }
    if (!isHex32(intentHashHex)) return "Intent hash must be 32-byte hex.";
    if (!isHex32(eventHashHex)) return "Coverage event hash must be 32-byte hex.";
    return "";
  }, [
    baseGuard,
    claimType,
    effectiveCycleHash,
    effectiveRecipient,
    effectiveRuleHash,
    eventHashHex,
    intentHashHex,
    effectiveOverrideEnabled,
    payoutAmount,
    parsedPayoutAmount,
    selectedAggregate,
    selectedPool,
  ]);

  const contextReady = isPubkey(effectivePoolAddress);
  const recordReady =
    claimType === "reward"
      ? Boolean(selectedAggregate && selectedAggregate.passed && !selectedAggregate.claimed) || effectiveOverrideEnabled
      : true;
  const payloadReady =
    claimType === "reward"
      ? isPubkey(effectiveRecipient) && isPositiveBigInt(payoutAmount) && isHex32(intentHashHex)
      : isHex32(intentHashHex) && isHex32(eventHashHex);

  const stepStatus = {
    "step-context": contextReady,
    "step-record": recordReady,
    "step-payload": payloadReady,
    "step-submit": Boolean(txSig),
  } as const;
  const stepLabels: Record<StepId, string> = {
    "step-context": "Claim context",
    "step-record": "Claim record source",
    "step-payload": "Claim payload",
    "step-submit": "Submit claim",
  };

  const nextStep: StepId = !stepStatus["step-context"]
    ? "step-context"
    : !stepStatus["step-record"]
      ? "step-record"
      : !stepStatus["step-payload"]
        ? "step-payload"
        : "step-submit";

  useEffect(() => {
    if (!focusMode) return;
    if (stepStatus[openStepId]) {
      setOpenStepId(nextStep);
    }
  }, [focusMode, nextStep, openStepId, stepStatus]);

  const stepContextOpen = !focusMode || openStepId === "step-context";
  const stepRecordOpen = !focusMode || openStepId === "step-record";
  const stepPayloadOpen = !focusMode || openStepId === "step-payload";
  const stepSubmitOpen = !focusMode || openStepId === "step-submit";

  const guideItems = [
    { label: "Select pool", done: isPubkey(effectivePoolAddress) },
    {
      label: claimType === "reward" ? "Select passed aggregate" : "Set claim hashes",
      done:
        claimType === "reward"
          ? Boolean(selectedAggregate && selectedAggregate.passed && !selectedAggregate.claimed) || effectiveOverrideEnabled
          : isHex32(intentHashHex) && isHex32(eventHashHex),
    },
    { label: "Submit claim", done: Boolean(txSig) },
  ];

  async function submit(label: string, run: () => Promise<void>) {
    setBusy(label);
    setStatus("");
    setStatusTone(null);
    setTxSig("");
    try {
      await run();
      await refreshSelectors();
    } catch (error) {
      setStatus(
        formatRpcError(error, {
          fallback: `${label} failed. Please retry.`,
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function sendTx(
    label: string,
    txFactory: (recentBlockhash: string) => Promise<ReturnType<typeof buildSubmitCoverageClaimTx>>,
  ) {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = await txFactory(blockhash);
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    setTxSig(signature);
    setStatus(`${label} confirmed on-chain.`);
    setStatusTone("ok");
  }

  async function generateHash(
    setHash: (value: string) => void,
    seed: string,
  ) {
    const nextHash = await hashStringTo32Hex(seed);
    setHash(nextHash);
  }

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? <h2 className="hero-title">Claim Builder</h2> : null}
      {!embedded ? (
        <p className="hero-copy">Choose pool and finalized aggregate records from chain instead of typing cycle/rule hashes.</p>
      ) : null}

      {selectorError ? <p className="field-error">{selectorError}</p> : null}

      <div className="progress-shell space-y-3">
        <p className="metric-label">Guided path</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {guideItems.map((item) => (
            <div key={item.label} className="monitor-row">
              <span>{item.label}</span>
              <span className={`status-pill ${item.done ? "status-ok" : "status-off"}`}>{item.done ? "Done" : "Open"}</span>
            </div>
          ))}
        </div>
        <p className="field-help">Connected wallet: {publicKey?.toBase58() || "not connected"}</p>
        <p className="field-help">Active pool: {effectivePoolAddress || "not selected"}</p>
        <p className="field-help">Next step: {stepLabels[nextStep]}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="secondary-button" onClick={() => void refreshSelectors()} disabled={Boolean(busy)}>
            Refresh selectors
          </button>
        </div>
      </div>

      <section id="step-context" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">1. Claim context</h3>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${stepStatus["step-context"] ? "status-ok" : "status-off"}`}>
              {stepStatus["step-context"] ? "Ready" : "Open"}
            </span>
            {focusMode ? (
              <button
                type="button"
                className="secondary-button py-1.5"
                onClick={() => setOpenStepId("step-context")}
                disabled={stepContextOpen}
              >
                {stepContextOpen ? "Focused" : "Review"}
              </button>
            ) : null}
          </div>
        </div>
        {!stepContextOpen ? (
          <p className="field-help">
            {poolLocked ? "Pool context is locked by workspace." : "Choose claim type and pool."}
          </p>
        ) : null}
        {stepContextOpen ? (
          <>
            <div className="space-y-2">
              <p className="metric-label">Claim type</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`segment-button ${claimType === "reward" ? "segment-button-active" : ""}`}
                  onClick={() => setClaimType("reward")}
                  disabled={Boolean(busy)}
                >
                  Reward claim
                </button>
                <button
                  type="button"
                  className={`segment-button ${claimType === "coverage" ? "segment-button-active" : ""}`}
                  onClick={() => setClaimType("coverage")}
                  disabled={Boolean(busy)}
                >
                  Coverage claim
                </button>
              </div>
              <p className="field-help">
                {claimType === "reward"
                  ? "Reward claim uses finalized oracle aggregate cycle/rule hashes."
                  : "Coverage claim uses member-supplied intent + event hashes."}
              </p>
            </div>

            {poolLocked ? (
              <div className="surface-card-soft space-y-1">
                <p className="metric-label">Pool</p>
                <p className="field-help font-mono">{normalizedInitialPoolAddress}</p>
              </div>
            ) : (
              <SearchableSelect
                label="Pool"
                value={selectedPoolAddress}
                options={pools.map((pool) => ({
                  value: pool.address,
                  label: `${pool.poolId} (${shortAddress(pool.address)})`,
                  hint: `${pool.organizationRef} | Mint ${shortAddress(pool.tokenGateMint)}`,
                }))}
                onChange={setSelectedPoolAddress}
                searchValue={search.pools}
                onSearchChange={(value) => setSearch((prev) => ({ ...prev, pools: value }))}
                loading={selectorLoading}
                disabled={effectiveOverrideEnabled}
                disabledHint="Selector is disabled while advanced override is enabled."
                placeholder="Select pool"
              />
            )}
          </>
        ) : null}
      </section>

      <section id="step-record" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">2. Claim record source</h3>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${stepStatus["step-record"] ? "status-ok" : "status-off"}`}>
              {stepStatus["step-record"] ? "Ready" : "Open"}
            </span>
            {focusMode ? (
              <button
                type="button"
                className="secondary-button py-1.5"
                onClick={() => setOpenStepId("step-record")}
                disabled={stepRecordOpen}
              >
                {stepRecordOpen ? "Focused" : "Review"}
              </button>
            ) : null}
          </div>
        </div>
        {!stepRecordOpen ? (
          <p className="field-help">
            {claimType === "reward" ? "Select finalized aggregate (or advanced override)." : "Coverage does not require aggregate selection."}
          </p>
        ) : null}
        {stepRecordOpen ? (
          <>
            {claimType === "reward" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="metric-label">Finalized aggregate</p>
                  <button
                    type="button"
                    className="secondary-button py-2"
                    onClick={() => setShowAllRewardAggregates((prev) => !prev)}
                    disabled={effectiveOverrideEnabled || Boolean(busy)}
                  >
                    {showAllRewardAggregates ? "Show actionable only" : "Show all finalized"}
                  </button>
                </div>
                <SearchableSelect
                  label="Finalized outcome aggregate"
                  value={selectedAggregateAddress}
                  options={visibleAggregates.map((aggregate) => ({
                    value: aggregate.address,
                    label: `${shortAddress(aggregate.cycleHashHex)} • ${shortAddress(aggregate.ruleHashHex)}`,
                    hint: `Pass ${aggregate.passVotes}/${aggregate.quorumM} | ${aggregate.passed ? "passed" : "not passed"} | ${aggregate.claimed ? "claimed" : "unclaimed"}`,
                  }))}
                  onChange={setSelectedAggregateAddress}
                  searchValue={search.aggregates}
                  onSearchChange={(value) => setSearch((prev) => ({ ...prev, aggregates: value }))}
                  loading={selectorLoading}
                  disabled={effectiveOverrideEnabled}
                  disabledHint="Selector is disabled while advanced override is enabled."
                  placeholder="Select finalized aggregate"
                  emptyMessage={
                    showAllRewardAggregates
                      ? "No finalized aggregates found for selected pool/member."
                      : "No actionable aggregates (passed + unclaimed) found. Use 'Show all finalized' to inspect others."
                  }
                />
              </div>
            ) : (
              <p className="field-help">Coverage claim skips aggregate selection and uses provided intent/event hashes.</p>
            )}

            {poolLocked ? null : (
              <AdvancedOverride enabled={effectiveOverrideEnabled} onToggle={setOverrideEnabled}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-label">
                    Pool address override
                    <input className="field-input" value={manualPoolAddress} onChange={(event) => setManualPoolAddress(event.target.value)} />
                  </label>
                  <label className="field-label">
                    Cycle hash override
                    <input className="field-input font-mono" value={manualCycleHashHex} onChange={(event) => setManualCycleHashHex(event.target.value)} />
                  </label>
                  <label className="field-label">
                    Rule hash override
                    <input className="field-input font-mono" value={manualRuleHashHex} onChange={(event) => setManualRuleHashHex(event.target.value)} />
                  </label>
                </div>
              </AdvancedOverride>
            )}
          </>
        ) : null}
      </section>

      <section id="step-payload" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">3. Claim payload</h3>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${stepStatus["step-payload"] ? "status-ok" : "status-off"}`}>
              {stepStatus["step-payload"] ? "Ready" : "Open"}
            </span>
            {focusMode ? (
              <button
                type="button"
                className="secondary-button py-1.5"
                onClick={() => setOpenStepId("step-payload")}
                disabled={stepPayloadOpen}
              >
                {stepPayloadOpen ? "Focused" : "Review"}
              </button>
            ) : null}
          </div>
        </div>
        {!stepPayloadOpen ? <p className="field-help">Fill claim fields and generate hashes.</p> : null}
        {stepPayloadOpen ? (
          <>
            {claimType === "reward" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-label">
                    Recipient
                    <input
                      className="field-input"
                      value={recipientAddress}
                      onChange={(event) => setRecipientAddress(event.target.value)}
                      placeholder="Recipient pubkey"
                    />
                  </label>
                  <label className="field-label">
                    Payout amount (lamports)
                    <input className="field-input" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} />
                    <span className="field-help">Approx. SOL: {Number.isFinite(payoutSol) ? payoutSol.toFixed(6) : "0.000000"}</span>
                    {expectedPayout ? <span className="field-help">Pool expected payout: {expectedPayout} lamports</span> : null}
                  </label>
                </div>
                <p className="field-help font-mono">
                  Resolved cycle hash: {effectiveCycleHash || "n/a"}
                  <br />
                  Resolved rule hash: {effectiveRuleHash || "n/a"}
                </p>
                <label className="field-label">
                  Intent hash
                  <input className="field-input font-mono" value={intentHashHex} onChange={(event) => setIntentHashHex(event.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={Boolean(busy)}
                    onClick={() => void generateHash(setIntentHashHex, `${effectivePoolAddress}:${effectiveMember}:reward:${Date.now()}`)}
                  >
                    Generate intent hash
                  </button>
                  {expectedPayout ? (
                    <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => setPayoutAmount(expectedPayout)}>
                      Use pool payout
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-label">
                    Intent hash
                    <input className="field-input font-mono" value={intentHashHex} onChange={(event) => setIntentHashHex(event.target.value)} />
                  </label>
                  <label className="field-label">
                    Coverage event hash
                    <input className="field-input font-mono" value={eventHashHex} onChange={(event) => setEventHashHex(event.target.value)} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={Boolean(busy)}
                    onClick={() => void generateHash(setIntentHashHex, `${effectivePoolAddress}:${effectiveMember}:coverage:intent:${Date.now()}`)}
                  >
                    Generate intent hash
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={Boolean(busy)}
                    onClick={() => void generateHash(setEventHashHex, `${effectivePoolAddress}:${effectiveMember}:coverage:event:${Date.now()}`)}
                  >
                    Generate event hash
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="secondary-button"
                disabled={!publicKey || Boolean(busy)}
                onClick={() => {
                  if (!publicKey) return;
                  const wallet = publicKey.toBase58();
                  setMemberAddress(wallet);
                  setRecipientAddress(wallet);
                }}
              >
                Use connected wallet for member/recipient
              </button>
            </div>

            {claimType === "reward" && selectedAggregate ? (
              <div className="surface-card-soft space-y-1">
                <p className="metric-label">Selected aggregate status</p>
                <p className="field-help">Pass votes: {selectedAggregate.passVotes}</p>
                <p className="field-help">Quorum M/N: {selectedAggregate.quorumM}/{selectedAggregate.quorumN}</p>
                <p className="field-help">Outcome: {selectedAggregate.passed ? "passed" : "not passed"}</p>
                <p className="field-help">Claimed: {selectedAggregate.claimed ? "yes" : "no"}</p>
              </div>
            ) : null}

            <details className="surface-card-soft p-3 sm:p-3.5">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Advanced member override</summary>
              <div className="grid gap-3 pt-3 sm:grid-cols-2">
                <label className="field-label">
                  Member address override
                  <input className="field-input" value={memberAddress} onChange={(event) => setMemberAddress(event.target.value)} />
                </label>
                <p className="field-help self-end">Leave blank to use connected wallet as claimant/member.</p>
              </div>
            </details>
          </>
        ) : null}
      </section>

      <section id="step-submit" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">4. Submit claim</h3>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${stepStatus["step-submit"] ? "status-ok" : "status-off"}`}>
              {stepStatus["step-submit"] ? "Submitted" : "Open"}
            </span>
            {focusMode ? (
              <button
                type="button"
                className="secondary-button py-1.5"
                onClick={() => setOpenStepId("step-submit")}
                disabled={stepSubmitOpen}
              >
                {stepSubmitOpen ? "Focused" : "Review"}
              </button>
            ) : null}
          </div>
        </div>
        {!stepSubmitOpen ? <p className="field-help">Send the selected claim transaction.</p> : null}
        {stepSubmitOpen ? (
          <>
            <button
              className="action-button"
              disabled={Boolean(claimGuard) || Boolean(busy)}
              onClick={() =>
                void submit(claimType, async () => {
                  if (!publicKey) return;
                  const seriesRefHashHex = selectedAggregate?.seriesRefHashHex
                    || await hashStringTo32Hex(`${effectivePoolAddress}:${claimType}:series`);
                  if (claimType === "reward") {
                    const memberPubkey = new PublicKey(effectiveMember);
                    const recipientPubkey = new PublicKey(effectiveRecipient);
                    await sendTx("Reward claim", async (blockhash) =>
                      buildSubmitRewardClaimTx({
                        claimant: publicKey,
                        poolAddress: new PublicKey(effectivePoolAddress),
                        member: memberPubkey,
                        seriesRefHashHex,
                        cycleHashHex: effectiveCycleHash,
                        ruleHashHex: effectiveRuleHash,
                        intentHashHex: normalize(intentHashHex),
                        payoutAmount: BigInt(normalize(payoutAmount) || "0"),
                        recipient: recipientPubkey,
                        recipientSystemAccount: recipientPubkey,
                        recentBlockhash: blockhash,
                      }),
                    );
                    return;
                  }
                  await sendTx("Coverage claim", async (blockhash) =>
                    buildSubmitCoverageClaimTx({
                      claimant: publicKey,
                      poolAddress: new PublicKey(effectivePoolAddress),
                      member: new PublicKey(effectiveMember),
                      seriesRefHashHex,
                      intentHashHex: normalize(intentHashHex),
                      eventHashHex: normalize(eventHashHex),
                      recentBlockhash: blockhash,
                    }),
                  );
                })
              }
            >
              {busy ? "Submitting..." : claimType === "reward" ? "Submit reward claim" : "Submit coverage claim"}
            </button>
            {claimGuard ? <p className="field-error">{claimGuard}</p> : null}
          </>
        ) : null}
      </section>
      {status ? (
        <div className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {txSig ? (
            <a className="secondary-button inline-flex w-fit" href={toExplorerLink(txSig)} target="_blank" rel="noreferrer">
              Open transaction
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
