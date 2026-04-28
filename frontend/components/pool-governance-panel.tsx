// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { GovernanceConsole } from "@/components/governance-console";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { usePoolWorkspaceContext } from "@/components/pool-workspace-context";
import { executeProtocolTransactionWithToast } from "@/lib/protocol-action-toast";
import {
  buildInitializeProtocolTx,
  buildRotateGovernanceAuthorityTx,
  buildSetProtocolParamsTx,
  defaultGovernanceConfigFromEnv,
  defaultGovernanceRealmFromEnv,
  fetchProtocolConfig,
  type ProtocolConfigSummary,
} from "@/lib/protocol";

type PoolGovernancePanelProps = {
  protocolConfig?: ProtocolConfigSummary | null;
  onRefresh?: () => void;
};

const ZERO_PUBKEY = "11111111111111111111111111111111";

function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "n/a";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function PoolGovernancePanel({ protocolConfig, onRefresh }: PoolGovernancePanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { capabilities } = usePoolWorkspaceContext();
  const [currentProtocolConfig, setCurrentProtocolConfig] = useState<ProtocolConfigSummary | null>(protocolConfig ?? null);
  const [protocolFeeBps, setProtocolFeeBps] = useState("150");
  const [minOracleStake, setMinOracleStake] = useState("1000000");
  const [governanceRealm, setGovernanceRealm] = useState(defaultGovernanceRealmFromEnv() ?? "");
  const [governanceConfig, setGovernanceConfig] = useState(defaultGovernanceConfigFromEnv() ?? "");
  const [defaultStakeMint, setDefaultStakeMint] = useState("");
  const [allowedPayoutMintsHashHex, setAllowedPayoutMintsHashHex] = useState("00".repeat(32));
  const [emergencyPaused, setEmergencyPaused] = useState(false);
  const [newGovernanceAuthority, setNewGovernanceAuthority] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);

  const refreshConfig = useCallback(async () => {
    const nextConfig = await fetchProtocolConfig({ connection });
    setCurrentProtocolConfig(nextConfig);
    onRefresh?.();
  }, [connection, onRefresh]);

  useEffect(() => {
    setCurrentProtocolConfig(protocolConfig ?? null);
  }, [protocolConfig]);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    if (!currentProtocolConfig) return;
    setProtocolFeeBps(String(currentProtocolConfig.protocolFeeBps));
    setMinOracleStake(currentProtocolConfig.minOracleStake.toString());
    setGovernanceRealm(currentProtocolConfig.governanceRealm);
    setGovernanceConfig(currentProtocolConfig.governanceConfig);
    setDefaultStakeMint(currentProtocolConfig.defaultStakeMint === ZERO_PUBKEY ? "" : currentProtocolConfig.defaultStakeMint);
    setAllowedPayoutMintsHashHex(currentProtocolConfig.allowedPayoutMintsHashHex);
    setEmergencyPaused(currentProtocolConfig.emergencyPaused);
  }, [currentProtocolConfig]);

  const directGovernanceSignerTarget = useMemo(() => {
    const candidate = currentProtocolConfig?.governanceAuthority
      || governanceConfig
      || currentProtocolConfig?.governanceConfig
      || "";
    if (!candidate || candidate === ZERO_PUBKEY) return false;
    try {
      return PublicKey.isOnCurve(new PublicKey(candidate).toBytes());
    } catch {
      return false;
    }
  }, [currentProtocolConfig?.governanceAuthority, currentProtocolConfig?.governanceConfig, governanceConfig]);
  const canRepairBrokenConfigAsAdmin = useMemo(() => {
    if (!currentProtocolConfig || !publicKey) return false;
    const configBroken =
      currentProtocolConfig.defaultStakeMint === ZERO_PUBKEY
      || currentProtocolConfig.minOracleStake === 0n;
    return configBroken && currentProtocolConfig.admin === publicKey.toBase58();
  }, [currentProtocolConfig, publicKey]);
  const canAct = capabilities.canManageGovernance
    && Boolean(publicKey && sendTransaction)
    && (directGovernanceSignerTarget || canRepairBrokenConfigAsAdmin);
  const mutationGuard = useMemo(() => {
    if (canRepairBrokenConfigAsAdmin) {
      return null;
    }
    if (currentProtocolConfig && !directGovernanceSignerTarget) {
      return "This deployment routes protocol config changes through governance proposals. Use the native governance console below to submit and approve updates.";
    }
    if (!capabilities.canManageGovernance) {
      return "Protocol config changes require the governance authority or protocol admin wallet.";
    }
    if (!publicKey || !sendTransaction) {
      return "Connect the governance wallet to submit protocol actions.";
    }
    return null;
  }, [canRepairBrokenConfigAsAdmin, capabilities.canManageGovernance, currentProtocolConfig, directGovernanceSignerTarget, publicKey, sendTransaction]);

  async function onInitializeProtocol() {
    if (!publicKey || !sendTransaction) return;
    setBusy("initialize");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildInitializeProtocolTx({
        admin: publicKey,
        recentBlockhash: blockhash,
        protocolFeeBps: Number.parseInt(protocolFeeBps, 10) || 0,
        governanceRealm,
        governanceConfig,
        defaultStakeMint,
        minOracleStake: BigInt(minOracleStake || "0"),
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Initialize protocol",
        onConfirmed: async () => {
          await refreshConfig();
        },
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
    } finally {
      setBusy(null);
    }
  }

  async function onUpdateProtocolParams() {
    if (!publicKey || !sendTransaction) return;
    setBusy("params");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildSetProtocolParamsTx({
        governanceAuthority: publicKey,
        recentBlockhash: blockhash,
        protocolFeeBps: Number.parseInt(protocolFeeBps, 10) || 0,
        allowedPayoutMintsHashHex: allowedPayoutMintsHashHex.trim() || "00".repeat(32),
        defaultStakeMint: defaultStakeMint.trim() || ZERO_PUBKEY,
        minOracleStake: BigInt(minOracleStake || "0"),
        emergencyPaused,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Update protocol params",
        onConfirmed: async () => {
          await refreshConfig();
        },
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
    } finally {
      setBusy(null);
    }
  }

  async function onRotateGovernanceAuthority() {
    if (!publicKey || !sendTransaction) return;
    setBusy("rotate");
    setStatus(null);
    setTxUrl(null);
    try {
      const nextAuthority = new PublicKey(newGovernanceAuthority.trim());
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = buildRotateGovernanceAuthorityTx({
        governanceAuthority: publicKey,
        newAuthority: nextAuthority,
        recentBlockhash: blockhash,
      });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Rotate governance authority",
        onConfirmed: async () => {
          await refreshConfig();
        },
      });
      if (!result.ok) {
        setStatus(result.error);
        setStatusTone("error");
        return;
      }
      setStatus(result.message);
      setStatusTone("ok");
      setTxUrl(result.explorerUrl);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "New governance authority is invalid.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="surface-card-soft space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="metric-label">Protocol governance</p>
            <p className="field-help">
              Review the current governance setup first. Proposal-based changes stay in the native governance console below, while direct signer maintenance only appears when this environment genuinely supports it.
            </p>
          </div>
          <span className={`status-pill ${currentProtocolConfig ? (canRepairBrokenConfigAsAdmin ? "status-error" : "status-ok") : "status-error"}`}>
            {currentProtocolConfig
              ? canRepairBrokenConfigAsAdmin
                ? "Config needs repair"
                : directGovernanceSignerTarget
                  ? "Direct signer path"
                  : "Proposal path"
              : "Config missing"}
          </span>
        </div>

        <div className="operator-summary-grid">
          <article className="operator-summary-card">
            <p className="metric-label">Current config</p>
            {currentProtocolConfig ? (
              <ul className="operator-summary-list">
                <li>Admin: {shortAddress(currentProtocolConfig.admin)}</li>
                <li>Governance authority: {shortAddress(currentProtocolConfig.governanceAuthority)}</li>
                <li>Governance realm: {shortAddress(currentProtocolConfig.governanceRealm)}</li>
                <li>Default stake mint: {shortAddress(currentProtocolConfig.defaultStakeMint)}</li>
                <li>Protocol fee: {currentProtocolConfig.protocolFeeBps} bps</li>
                <li>Min oracle stake: {currentProtocolConfig.minOracleStake.toString()}</li>
                <li>Emergency pause: {currentProtocolConfig.emergencyPaused ? "Enabled" : "Disabled"}</li>
              </ul>
            ) : (
              <p className="field-help mt-2">No protocol config account is visible on the selected network yet.</p>
            )}
          </article>

          <article className="operator-summary-card">
            <p className="metric-label">Change path</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {directGovernanceSignerTarget
                ? "Direct signer maintenance is available in this environment."
                : "Governance changes are proposal-based in this environment."}
            </p>
            <p className="field-help break-all font-mono">{publicKey?.toBase58() ?? "Wallet not connected"}</p>
            {canRepairBrokenConfigAsAdmin ? (
              <p className="field-help">This signer can repair a broken config as the protocol admin.</p>
            ) : null}
          </article>
        </div>

        {canAct ? (
          <ProtocolDetailDisclosure
            title={!currentProtocolConfig ? "Initialize protocol config" : "Direct signer maintenance"}
            summary={
              !currentProtocolConfig
                ? "Use this only when this environment allows direct signer initialization."
                : canRepairBrokenConfigAsAdmin
                  ? "This signer can repair a broken config directly."
                  : "Use direct signer updates only for environments that bypass proposal-based governance."
            }
            description="The main governance path remains proposal-first. This maintenance form is intentionally collapsed unless direct signer actions are the real path for this environment."
          >
            {!currentProtocolConfig ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="space-y-1">
                  <span className="metric-label">Governance realm</span>
                  <input className="field-input" value={governanceRealm} onChange={(event) => setGovernanceRealm(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Governance config</span>
                  <input className="field-input" value={governanceConfig} onChange={(event) => setGovernanceConfig(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Default stake mint</span>
                  <input className="field-input font-mono" value={defaultStakeMint} onChange={(event) => setDefaultStakeMint(event.target.value)} placeholder="Stake mint pubkey" />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Protocol fee basis points</span>
                  <input className="field-input" value={protocolFeeBps} onChange={(event) => setProtocolFeeBps(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Minimum oracle stake</span>
                  <input className="field-input" value={minOracleStake} onChange={(event) => setMinOracleStake(event.target.value)} />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <label className="space-y-1">
                  <span className="metric-label">Protocol fee basis points</span>
                  <input className="field-input" value={protocolFeeBps} onChange={(event) => setProtocolFeeBps(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="metric-label">Minimum oracle stake</span>
                  <input className="field-input" value={minOracleStake} onChange={(event) => setMinOracleStake(event.target.value)} />
                </label>
                <label className="space-y-1 lg:col-span-2">
                  <span className="metric-label">Default stake mint</span>
                  <input className="field-input font-mono" value={defaultStakeMint} onChange={(event) => setDefaultStakeMint(event.target.value)} placeholder="Stake mint pubkey" />
                </label>
                <label className="toggle-card lg:col-span-2">
                  <div>
                    <p className="toggle-card-title">Emergency pause</p>
                    <p className="field-help">Direct signer environments can pause new protocol activity here.</p>
                  </div>
                  <input type="checkbox" checked={emergencyPaused} onChange={(event) => setEmergencyPaused(event.target.checked)} />
                </label>
                <label className="space-y-1 lg:col-span-2">
                  <span className="metric-label">Allowed payout mints hash</span>
                  <input className="field-input font-mono" value={allowedPayoutMintsHashHex} onChange={(event) => setAllowedPayoutMintsHashHex(event.target.value)} />
                </label>
                <label className="space-y-1 lg:col-span-2">
                  <span className="metric-label">Rotate governance authority</span>
                  <input className="field-input font-mono" value={newGovernanceAuthority} onChange={(event) => setNewGovernanceAuthority(event.target.value)} placeholder="New authority pubkey" />
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!currentProtocolConfig ? (
                <button type="button" className="action-button" onClick={() => void onInitializeProtocol()} disabled={!canAct || !defaultStakeMint.trim() || busy === "initialize"}>
                  {busy === "initialize" ? "Initializing..." : "Initialize protocol config"}
                </button>
              ) : (
                <>
                  <button type="button" className="action-button" onClick={() => void onUpdateProtocolParams()} disabled={!canAct || !defaultStakeMint.trim() || busy === "params"}>
                    {busy === "params" ? "Updating..." : "Update protocol params"}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => void onRotateGovernanceAuthority()} disabled={!canAct || !newGovernanceAuthority || busy === "rotate"}>
                    {busy === "rotate" ? "Rotating..." : "Rotate governance authority"}
                  </button>
                </>
              )}
            </div>
          </ProtocolDetailDisclosure>
        ) : mutationGuard ? (
          <p className="field-help">
            {mutationGuard}
          </p>
        ) : null}
        {status ? <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p> : null}
        {txUrl ? (
          <a className="secondary-button inline-flex w-fit" href={txUrl} target="_blank" rel="noreferrer">
            View transaction
          </a>
        ) : null}
      </section>

      <GovernanceConsole
        initialProtocolConfig={currentProtocolConfig}
        sectionMode="embedded"
      />
    </div>
  );
}
