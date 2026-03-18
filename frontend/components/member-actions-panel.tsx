// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { AdvancedOverride } from "@/components/advanced-override";
import { SearchableSelect } from "@/components/searchable-select";
import {
  buildEnrollMemberInvitePermitTx,
  buildEnrollMemberOpenTx,
  buildEnrollMemberTokenGateTx,
  buildSetClaimDelegateTx,
  hashStringTo32Hex,
  listInviteIssuers,
  listPools,
  listWalletTokenAccountsForMint,
  toExplorerLink,
  type InviteIssuerSummary,
  type PoolSummary,
  type TokenAccountSummary,
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

type Mode = "open" | "token_gate" | "invite";
type StepId = "step-pool" | "step-mode" | "step-submit" | "step-delegate";

const MODE_LABEL: Record<Mode, string> = {
  open: "Open",
  token_gate: "Token gate",
  invite: "Invite permit",
};

function isHex32(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(normalize(value).replace(/^0x/, ""));
}

function isUnixTimestamp(value: string): boolean {
  try {
    return BigInt(normalize(value)) > 0n;
  } catch {
    return false;
  }
}

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

type MemberActionsPanelProps = {
  initialPoolAddress?: string;
  lockPoolSelection?: boolean;
  sectionMode?: "standalone" | "embedded";
};

export function MemberActionsPanel({
  initialPoolAddress,
  lockPoolSelection = false,
  sectionMode = "standalone",
}: MemberActionsPanelProps) {
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const normalizedInitialPoolAddress = normalize(initialPoolAddress ?? "");
  const poolLocked = lockPoolSelection && isPubkey(normalizedInitialPoolAddress);
  const embedded = sectionMode === "embedded";

  const [mode, setMode] = useState<Mode>("open");
  const [focusMode] = useState(false);
  const [openStepId, setOpenStepId] = useState<StepId>("step-pool");
  const [subjectCommitmentHex, setSubjectCommitmentHex] = useState("");
  const [delegateAddress, setDelegateAddress] = useState("");

  const [nonceHashHex, setNonceHashHex] = useState("");
  const [inviteIdHashHex, setInviteIdHashHex] = useState("");
  const [inviteIdSeed, setInviteIdSeed] = useState("beta-invite");
  const [expiresAtTs, setExpiresAtTs] = useState(String(Math.floor(Date.now() / 1000) + 3600));

  const [search, setSearch] = useState({ pools: "", issuers: "", tokenAccounts: "" });
  const [loadingSelectors, setLoadingSelectors] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [issuers, setIssuers] = useState<InviteIssuerSummary[]>([]);
  const [tokenAccounts, setTokenAccounts] = useState<TokenAccountSummary[]>([]);

  const [selectedPoolAddress, setSelectedPoolAddress] = useState(poolLocked ? normalizedInitialPoolAddress : "");
  const [selectedIssuerAddress, setSelectedIssuerAddress] = useState("");
  const [selectedTokenGateAccount, setSelectedTokenGateAccount] = useState("");

  const [manualPoolAddress, setManualPoolAddress] = useState(poolLocked ? normalizedInitialPoolAddress : "");
  const [manualIssuerAddress, setManualIssuerAddress] = useState("");
  const [manualTokenGateAccount, setManualTokenGateAccount] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txSig, setTxSig] = useState<string>("");
  const [completedActions, setCompletedActions] = useState({ enroll: false, delegate: false });

  const memberAddress = publicKey?.toBase58() ?? "";
  const explorerLink = txSig ? toExplorerLink(txSig) : "";

  const selectedPool = useMemo(
    () => pools.find((row) => row.address === selectedPoolAddress) ?? null,
    [pools, selectedPoolAddress],
  );

  const effectiveOverrideEnabled = !poolLocked && overrideEnabled;
  const activePoolAddress = normalize(
    effectiveOverrideEnabled
      ? manualPoolAddress
      : selectedPoolAddress || manualPoolAddress || (poolLocked ? normalizedInitialPoolAddress : ""),
  );
  const activeIssuerAddress = normalize(
    effectiveOverrideEnabled ? manualIssuerAddress : selectedIssuerAddress || manualIssuerAddress,
  );
  const activeTokenGateAccount = normalize(
    effectiveOverrideEnabled ? manualTokenGateAccount : selectedTokenGateAccount || manualTokenGateAccount,
  );

  const refreshSelectors = useCallback(async () => {
    setLoadingSelectors(true);
    setSelectorError(null);
    try {
      const [nextPools, nextIssuers] = await Promise.all([
        listPools({ connection, search: search.pools || null }),
        listInviteIssuers({ connection, activeOnly: true, search: search.issuers || null }),
      ]);

      setPools(nextPools);
      setIssuers(nextIssuers);

      if (poolLocked) {
        setSelectedPoolAddress(normalizedInitialPoolAddress);
      } else if (!selectedPoolAddress && nextPools.length > 0) {
        setSelectedPoolAddress(nextPools[0]!.address);
      }
      if (!selectedIssuerAddress && nextIssuers.length > 0) {
        setSelectedIssuerAddress(nextIssuers[0]!.issuer);
      }

      if (publicKey && selectedPool?.tokenGateMint && mode === "token_gate") {
        const nextTokenAccounts = await listWalletTokenAccountsForMint({
          connection,
          owner: publicKey.toBase58(),
          mint: selectedPool.tokenGateMint,
          search: search.tokenAccounts || null,
        });
        setTokenAccounts(nextTokenAccounts);
        if (!selectedTokenGateAccount && nextTokenAccounts.length > 0) {
          setSelectedTokenGateAccount(nextTokenAccounts[0]!.address);
        }
      } else {
        setTokenAccounts([]);
      }
    } catch (error) {
      setSelectorError(
        formatRpcError(error, {
          fallback: "Failed to load selector data from chain.",
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
    } finally {
      setLoadingSelectors(false);
    }
  }, [
    connection,
    mode,
    publicKey,
    search.issuers,
    search.pools,
    search.tokenAccounts,
    normalizedInitialPoolAddress,
    poolLocked,
    selectedIssuerAddress,
    selectedPool,
    selectedPoolAddress,
    selectedTokenGateAccount,
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

  const baseGuard = useMemo(() => {
    if (!connected || !publicKey) return "Connect your wallet first.";
    if (!isPubkey(activePoolAddress)) return "Select a valid pool address.";
    return "";
  }, [activePoolAddress, connected, publicKey]);

  const enrollGuard = useMemo(() => {
    if (baseGuard) return baseGuard;
    if (mode === "token_gate" && !isPubkey(activeTokenGateAccount)) {
      return "Select a valid token gate account.";
    }
    if (mode === "invite") {
      if (!isPubkey(activeIssuerAddress)) return "Select a valid invite issuer.";
      if (publicKey && normalize(activeIssuerAddress) !== publicKey.toBase58()) {
        return "Invite permit enrollment requires issuer signer. Switch wallet to issuer or set issuer = connected member wallet.";
      }
      if (!isUnixTimestamp(expiresAtTs)) return "Expires at must be a valid unix timestamp.";
      if (normalize(nonceHashHex) && !isHex32(nonceHashHex)) return "Nonce hash must be 32-byte hex.";
      if (normalize(inviteIdHashHex) && !isHex32(inviteIdHashHex)) return "Invite ID hash must be 32-byte hex.";
    }
    if (normalize(subjectCommitmentHex) && !isHex32(subjectCommitmentHex)) {
      return "Subject commitment hash must be 32-byte hex.";
    }
    return "";
  }, [
    activeIssuerAddress,
    activeTokenGateAccount,
    baseGuard,
    expiresAtTs,
    inviteIdHashHex,
    mode,
    nonceHashHex,
    publicKey,
    subjectCommitmentHex,
  ]);

  const delegateGuard = useMemo(() => {
    if (baseGuard) return baseGuard;
    if (!isPubkey(delegateAddress)) return "Delegate address must be a valid public key.";
    return "";
  }, [baseGuard, delegateAddress]);

  async function submit(action: string, run: () => Promise<void>) {
    setBusy(action);
    setStatus("");
    setStatusTone(null);
    setTxSig("");
    try {
      await run();
      await refreshSelectors();
    } catch (error) {
      setStatus(
        formatRpcError(error, {
          fallback: `${action} failed. Please retry.`,
          rpcEndpoint: connection.rpcEndpoint,
        }),
      );
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function sendTx(
    action: string,
    stage: "enroll" | "delegate",
    txFactory: (recentBlockhash: string) => Promise<ReturnType<typeof buildEnrollMemberOpenTx>>,
  ) {
    if (!publicKey) return;
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = await txFactory(blockhash);
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    setTxSig(signature);
    setStatus(`${action} confirmed on-chain.`);
    setStatusTone("ok");
    setCompletedActions((prev) => ({ ...prev, [stage]: true }));
  }

  const modeHelp =
    mode === "open"
      ? "Open mode enrolls directly with member signer."
      : mode === "token_gate"
        ? "Token gate mode requires a wallet-owned token account matching the pool mint."
        : "Invite mode requires issuer signer and permit hash inputs.";

  const modeReady =
    mode === "open"
      ? true
      : mode === "token_gate"
        ? isPubkey(activeTokenGateAccount)
        : isPubkey(activeIssuerAddress) && isUnixTimestamp(expiresAtTs);

  const stepStatus = {
    "step-pool": isPubkey(activePoolAddress),
    "step-mode": modeReady,
    "step-submit": completedActions.enroll,
    "step-delegate": completedActions.delegate,
  } as const;
  const stepLabels: Record<StepId, string> = {
    "step-pool": "Select pool context",
    "step-mode": "Configure enrollment mode",
    "step-submit": "Submit enrollment",
    "step-delegate": "Optional delegate setup",
  };

  const nextStep: StepId = !stepStatus["step-pool"]
    ? "step-pool"
    : !stepStatus["step-mode"]
      ? "step-mode"
      : !stepStatus["step-submit"]
        ? "step-submit"
        : "step-delegate";

  useEffect(() => {
    if (!focusMode) return;
    if (stepStatus[openStepId]) {
      setOpenStepId(nextStep);
    }
  }, [focusMode, nextStep, openStepId, stepStatus]);

  const stepPoolOpen = !focusMode || openStepId === "step-pool";
  const stepModeOpen = !focusMode || openStepId === "step-mode";
  const stepSubmitOpen = !focusMode || openStepId === "step-submit";
  const stepDelegateOpen = !focusMode || openStepId === "step-delegate";

  const guideItems = [
    { label: "Select pool", done: isPubkey(activePoolAddress) },
    { label: "Submit enrollment", done: completedActions.enroll },
    { label: "Set delegate (optional)", done: completedActions.delegate },
  ];

  return (
    <section className={embedded ? "space-y-4" : "surface-card space-y-4"}>
      {!embedded ? <h2 className="hero-title">Enrollment + Delegation</h2> : null}
      {!embedded ? (
        <p className="hero-copy">Enrollment defaults to chain-discovered pool, issuer, and token account selectors.</p>
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
        <p className="field-help">Connected wallet: {memberAddress || "not connected"}</p>
        <p className="field-help">Active pool: {activePoolAddress || "not selected"}</p>
        <p className="field-help">Next step: {stepLabels[nextStep]}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="secondary-button" onClick={() => void refreshSelectors()} disabled={loadingSelectors || Boolean(busy)}>
            {loadingSelectors ? "Refreshing..." : "Refresh selectors"}
          </button>
        </div>
      </div>

      <section id="step-pool" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">1. Select pool context</h3>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${stepStatus["step-pool"] ? "status-ok" : "status-off"}`}>
              {stepStatus["step-pool"] ? "Ready" : "Open"}
            </span>
            {focusMode ? (
              <button
                type="button"
                className="secondary-button py-1.5"
                onClick={() => setOpenStepId("step-pool")}
                disabled={stepPoolOpen}
              >
                {stepPoolOpen ? "Focused" : "Review"}
              </button>
            ) : null}
          </div>
        </div>
        {!stepPoolOpen ? (
          <p className="field-help">
            {poolLocked ? "Pool context is locked by workspace." : "Choose pool from chain, or switch to manual inputs if discovery is incomplete."}
          </p>
        ) : null}
        {stepPoolOpen ? (
          <>
            {poolLocked ? (
              <div className="surface-card-soft space-y-1">
                <p className="metric-label">Pool</p>
                <p className="field-help font-mono">{normalizedInitialPoolAddress}</p>
              </div>
            ) : (
              <>
                <SearchableSelect
                  label="Pool"
                  value={selectedPoolAddress}
                  options={pools.map((pool) => ({
                    value: pool.address,
                    label: `${pool.poolId} (${shortAddress(pool.address)})`,
                    hint: `Mint ${shortAddress(pool.tokenGateMint)} | Org ${pool.organizationRef}`,
                  }))}
                  onChange={setSelectedPoolAddress}
                  searchValue={search.pools}
                  onSearchChange={(value) => setSearch((prev) => ({ ...prev, pools: value }))}
                  loading={loadingSelectors}
                  disabled={effectiveOverrideEnabled}
                  disabledHint="Selector is disabled while manual inputs are active."
                  placeholder="Select pool"
                />

                <AdvancedOverride
                  title="Manual pool inputs"
                  description="Use this only when chain discovery is incomplete or you need to paste exact addresses for enrollment."
                  enabled={effectiveOverrideEnabled}
                  onToggle={setOverrideEnabled}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field-label">
                      Pool address override
                      <input className="field-input" value={manualPoolAddress} onChange={(event) => setManualPoolAddress(event.target.value)} />
                    </label>
                    <label className="field-label">
                      Token gate account override
                      <input
                        className="field-input"
                        value={manualTokenGateAccount}
                        onChange={(event) => setManualTokenGateAccount(event.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      Invite issuer override
                      <input className="field-input" value={manualIssuerAddress} onChange={(event) => setManualIssuerAddress(event.target.value)} />
                    </label>
                  </div>
                </AdvancedOverride>
              </>
            )}
          </>
        ) : null}
      </section>

      <section id="step-mode" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">2. Configure enrollment mode</h3>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${stepStatus["step-mode"] ? "status-ok" : "status-off"}`}>
              {stepStatus["step-mode"] ? "Ready" : "Open"}
            </span>
            {focusMode ? (
              <button
                type="button"
                className="secondary-button py-1.5"
                onClick={() => setOpenStepId("step-mode")}
                disabled={stepModeOpen}
              >
                {stepModeOpen ? "Focused" : "Review"}
              </button>
            ) : null}
          </div>
        </div>
        {!stepModeOpen ? <p className="field-help">{modeHelp}</p> : null}
        {stepModeOpen ? (
          <>
            <div className="space-y-2">
              <p className="metric-label">Enrollment mode</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["open", "token_gate", "invite"] as Mode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`segment-button ${mode === value ? "segment-button-active" : ""}`}
                    onClick={() => setMode(value)}
                    disabled={Boolean(busy)}
                  >
                    {MODE_LABEL[value]}
                  </button>
                ))}
              </div>
              <p className="field-help">{modeHelp}</p>
            </div>

            {mode === "token_gate" ? (
              <SearchableSelect
                label="Token gate account"
                value={selectedTokenGateAccount}
                options={tokenAccounts.map((account) => ({
                  value: account.address,
                  label: `${shortAddress(account.address)} (${account.uiAmountString})`,
                  hint: `Mint ${shortAddress(account.mint)}`,
                }))}
                onChange={setSelectedTokenGateAccount}
                searchValue={search.tokenAccounts}
                onSearchChange={(value) => setSearch((prev) => ({ ...prev, tokenAccounts: value }))}
                loading={loadingSelectors}
                disabled={effectiveOverrideEnabled}
                disabledHint="Selector is disabled while manual inputs are active."
                placeholder="Select token account"
                emptyMessage={
                  selectedPool?.tokenGateMint
                    ? "No wallet-owned token accounts found for this pool mint."
                    : "Select a pool first to load token accounts."
                }
              />
            ) : null}

            {mode === "invite" ? (
              <div className="space-y-3">
                <SearchableSelect
                  label="Invite issuer"
                  value={selectedIssuerAddress}
                  options={issuers.map((issuer) => ({
                    value: issuer.issuer,
                    label: `${issuer.organizationRef} (${shortAddress(issuer.issuer)})`,
                    hint: issuer.metadataUri || "No metadata URI",
                  }))}
                  onChange={setSelectedIssuerAddress}
                  searchValue={search.issuers}
                  onSearchChange={(value) => setSearch((prev) => ({ ...prev, issuers: value }))}
                  loading={loadingSelectors}
                  disabled={effectiveOverrideEnabled}
                  disabledHint="Selector is disabled while manual inputs are active."
                  placeholder="Select invite issuer"
                />

                <label className="field-label">
                  Expires at (unix ts)
                  <input className="field-input" value={expiresAtTs} onChange={(event) => setExpiresAtTs(event.target.value)} />
                </label>

                <details className="surface-card-soft p-3 sm:p-3.5">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Advanced invite hashes (optional)</summary>
                  <div className="grid gap-3 pt-3 sm:grid-cols-2">
                    <label className="field-label">
                      Invite seed (hash fallback)
                      <input className="field-input" value={inviteIdSeed} onChange={(event) => setInviteIdSeed(event.target.value)} />
                    </label>
                    <label className="field-label">
                      Nonce hash override
                      <input className="field-input font-mono" value={nonceHashHex} onChange={(event) => setNonceHashHex(event.target.value)} />
                    </label>
                    <label className="field-label sm:col-span-2">
                      Invite ID hash override
                      <input
                        className="field-input font-mono"
                        value={inviteIdHashHex}
                        onChange={(event) => setInviteIdHashHex(event.target.value)}
                      />
                    </label>
                  </div>
                </details>
              </div>
            ) : null}

            <details className="surface-card-soft p-3 sm:p-3.5">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Optional privacy commitment</summary>
              <div className="pt-3">
                <label className="field-label">
                  Subject commitment hash
                  <input
                    className="field-input font-mono"
                    value={subjectCommitmentHex}
                    onChange={(event) => setSubjectCommitmentHex(event.target.value)}
                    placeholder="64-char hex"
                  />
                </label>
              </div>
            </details>
          </>
        ) : null}
      </section>

      <section id="step-submit" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">3. Submit enrollment</h3>
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
        {!stepSubmitOpen ? <p className="field-help">Send the selected enrollment transaction.</p> : null}
        {stepSubmitOpen ? (
          <>
            <button
              className="action-button"
              disabled={Boolean(enrollGuard) || Boolean(busy)}
              onClick={() =>
                void submit("enroll", async () => {
                  if (!publicKey) return;
                  if (mode === "open") {
                    await sendTx("Enroll (open)", "enroll", async (blockhash) =>
                      buildEnrollMemberOpenTx({
                        member: publicKey,
                        poolAddress: new PublicKey(normalize(activePoolAddress)),
                        recentBlockhash: blockhash,
                        subjectCommitmentHex: normalize(subjectCommitmentHex) || undefined,
                      }),
                    );
                    return;
                  }
                  if (mode === "token_gate") {
                    await sendTx("Enroll (token gate)", "enroll", async (blockhash) =>
                      buildEnrollMemberTokenGateTx({
                        member: publicKey,
                        poolAddress: new PublicKey(normalize(activePoolAddress)),
                        tokenGateAccount: new PublicKey(normalize(activeTokenGateAccount)),
                        recentBlockhash: blockhash,
                        subjectCommitmentHex: normalize(subjectCommitmentHex) || undefined,
                      }),
                    );
                    return;
                  }
                  const nonce = normalize(nonceHashHex) || (await hashStringTo32Hex(`${memberAddress}:${Date.now()}`));
                  const invite = normalize(inviteIdHashHex) || (await hashStringTo32Hex(normalize(inviteIdSeed) || "beta-invite"));
                  const parsedExpires = BigInt(normalize(expiresAtTs));
                  await sendTx("Enroll (invite permit)", "enroll", async (blockhash) =>
                    buildEnrollMemberInvitePermitTx({
                      member: publicKey,
                      poolAddress: new PublicKey(normalize(activePoolAddress)),
                      issuer: new PublicKey(normalize(activeIssuerAddress)),
                      recentBlockhash: blockhash,
                      subjectCommitmentHex: normalize(subjectCommitmentHex) || undefined,
                      nonceHashHex: nonce,
                      inviteIdHashHex: invite,
                      expiresAtTs: parsedExpires,
                    }),
                  );
                })
              }
            >
              {busy === "enroll" ? "Submitting..." : `Submit ${MODE_LABEL[mode].toLowerCase()} enrollment`}
            </button>
            {enrollGuard ? <p className="field-error">{enrollGuard}</p> : null}
          </>
        ) : null}
      </section>

      <section id="step-delegate" className="surface-card-soft step-card space-y-3">
        <div className="step-head">
          <h3 className="step-title">4. Optional delegate setup</h3>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${stepStatus["step-delegate"] ? "status-ok" : "status-off"}`}>
              {stepStatus["step-delegate"] ? "Configured" : "Optional"}
            </span>
            {focusMode ? (
              <button
                type="button"
                className="secondary-button py-1.5"
                onClick={() => setOpenStepId("step-delegate")}
                disabled={stepDelegateOpen}
              >
                {stepDelegateOpen ? "Focused" : "Review"}
              </button>
            ) : null}
          </div>
        </div>
        {!stepDelegateOpen ? <p className="field-help">Set a claim delegate if member operations are delegated.</p> : null}
        {stepDelegateOpen ? (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="field-label">
                Delegate address
                <input
                  className="field-input"
                  value={delegateAddress}
                  onChange={(event) => setDelegateAddress(event.target.value)}
                  placeholder="Delegate pubkey"
                />
              </label>
              <div className="flex items-end">
                <button
                  className="secondary-button"
                  disabled={Boolean(delegateGuard) || Boolean(busy)}
                  onClick={() =>
                    void submit("delegate", async () => {
                      if (!publicKey) return;
                      await sendTx("Set delegate", "delegate", async (blockhash) =>
                        buildSetClaimDelegateTx({
                          member: publicKey,
                          poolAddress: new PublicKey(normalize(activePoolAddress)),
                          recentBlockhash: blockhash,
                          delegate: new PublicKey(normalize(delegateAddress)),
                          active: true,
                        }),
                      );
                    })
                  }
                >
                  {busy === "delegate" ? "Submitting..." : "Set delegate"}
                </button>
              </div>
            </div>
            {delegateGuard && !enrollGuard ? <p className="field-error">{delegateGuard}</p> : null}
          </>
        ) : null}
      </section>

      {status ? (
        <div className="surface-card-soft space-y-2">
          <span className={`status-pill ${statusTone === "error" ? "status-error" : "status-ok"}`}>
            {statusTone === "error" ? "Action failed" : "Action confirmed"}
          </span>
          <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p>
          {explorerLink ? (
            <a className="secondary-button inline-flex w-fit" href={explorerLink} target="_blank" rel="noreferrer">
              Open transaction
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
