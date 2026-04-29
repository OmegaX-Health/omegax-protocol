// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
import { usePoolWorkspaceContext } from "@/components/pool-workspace-context";
import { SearchableSelect } from "@/components/searchable-select";
import { executeProtocolTransactionWithToast } from "@/lib/protocol-action-toast";
import {
  buildWithdrawPoolOracleFeeSolTx,
  buildWithdrawPoolOracleFeeSplTx,
  buildWithdrawPoolTreasurySolTx,
  buildWithdrawPoolTreasurySplTx,
  buildWithdrawProtocolFeeSolTx,
  buildWithdrawProtocolFeeSplTx,
  listPoolOracleFeeVaults,
  listPoolTreasuryReserves,
  listProtocolFeeVaults,
  type PoolOracleFeeVaultSummary,
  type PoolTreasuryReserveSummary,
  type ProtocolFeeVaultSummary,
  ZERO_PUBKEY,
} from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

type PoolTreasuryPanelProps = {
  poolAddress: string;
};

function shortAddress(value: string): string {
  if (!value || value.length < 12) return value || "n/a";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function PoolTreasuryPanel({ poolAddress }: PoolTreasuryPanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { capabilities } = usePoolWorkspaceContext();
  const [reserves, setReserves] = useState<PoolTreasuryReserveSummary[]>([]);
  const [protocolFeeVaults, setProtocolFeeVaults] = useState<ProtocolFeeVaultSummary[]>([]);
  const [oracleFeeVaults, setOracleFeeVaults] = useState<PoolOracleFeeVaultSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | null>(null);
  const [txUrl, setTxUrl] = useState<string | null>(null);
  const [reserveSearch, setReserveSearch] = useState("");
  const [protocolFeeSearch, setProtocolFeeSearch] = useState("");
  const [oracleFeeSearch, setOracleFeeSearch] = useState("");
  const [selectedReserveAddress, setSelectedReserveAddress] = useState("");
  const [selectedProtocolFeeVaultAddress, setSelectedProtocolFeeVaultAddress] = useState("");
  const [selectedOracleFeeVaultAddress, setSelectedOracleFeeVaultAddress] = useState("");
  const [treasuryAmount, setTreasuryAmount] = useState("0");
  const [treasuryRecipient, setTreasuryRecipient] = useState("");
  const [treasuryRecipientTokenAccount, setTreasuryRecipientTokenAccount] = useState("");
  const [protocolFeeAmount, setProtocolFeeAmount] = useState("0");
  const [protocolFeeRecipient, setProtocolFeeRecipient] = useState("");
  const [protocolFeeRecipientTokenAccount, setProtocolFeeRecipientTokenAccount] = useState("");
  const [oracleFeeAmount, setOracleFeeAmount] = useState("0");
  const [oracleFeeRecipient, setOracleFeeRecipient] = useState("");
  const [oracleFeeRecipientTokenAccount, setOracleFeeRecipientTokenAccount] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextReserves, nextProtocolFeeVaults, nextOracleFeeVaults] = await Promise.all([
        listPoolTreasuryReserves({ connection, poolAddress }),
        listProtocolFeeVaults({ connection }),
        listPoolOracleFeeVaults({ connection, poolAddress }),
      ]);
      setReserves(nextReserves);
      setProtocolFeeVaults(nextProtocolFeeVaults);
      setOracleFeeVaults(nextOracleFeeVaults);
      setSelectedReserveAddress((prev) => (prev && nextReserves.some((row) => row.address === prev) ? prev : (nextReserves[0]?.address ?? "")));
      setSelectedProtocolFeeVaultAddress((prev) => (
        prev && nextProtocolFeeVaults.some((row) => row.address === prev) ? prev : (nextProtocolFeeVaults[0]?.address ?? "")
      ));
      setSelectedOracleFeeVaultAddress((prev) => (
        prev && nextOracleFeeVaults.some((row) => row.address === prev) ? prev : (nextOracleFeeVaults[0]?.address ?? "")
      ));
    } catch (cause) {
      setError(
        formatRpcError(cause, {
          fallback: "Failed to load treasury and fee vault state.",
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
    if (!publicKey) return;
    const walletAddress = publicKey.toBase58();
    if (!treasuryRecipient) setTreasuryRecipient(walletAddress);
    if (!protocolFeeRecipient) setProtocolFeeRecipient(walletAddress);
    if (!oracleFeeRecipient) setOracleFeeRecipient(walletAddress);
  }, [oracleFeeRecipient, protocolFeeRecipient, publicKey, treasuryRecipient]);

  const selectedReserve = useMemo(
    () => reserves.find((row) => row.address === selectedReserveAddress) ?? null,
    [reserves, selectedReserveAddress],
  );
  const selectedProtocolFeeVault = useMemo(
    () => protocolFeeVaults.find((row) => row.address === selectedProtocolFeeVaultAddress) ?? null,
    [protocolFeeVaults, selectedProtocolFeeVaultAddress],
  );
  const selectedOracleFeeVault = useMemo(
    () => oracleFeeVaults.find((row) => row.address === selectedOracleFeeVaultAddress) ?? null,
    [oracleFeeVaults, selectedOracleFeeVaultAddress],
  );

  useEffect(() => {
    if (selectedReserve?.paymentMint === ZERO_PUBKEY) {
      setTreasuryRecipient(selectedReserve.feeRecipient);
    }
  }, [selectedReserve?.address, selectedReserve?.feeRecipient, selectedReserve?.paymentMint]);

  useEffect(() => {
    if (selectedProtocolFeeVault?.paymentMint === ZERO_PUBKEY) {
      setProtocolFeeRecipient(selectedProtocolFeeVault.feeRecipient);
    }
  }, [selectedProtocolFeeVault?.address, selectedProtocolFeeVault?.feeRecipient, selectedProtocolFeeVault?.paymentMint]);

  useEffect(() => {
    if (selectedOracleFeeVault?.paymentMint === ZERO_PUBKEY) {
      setOracleFeeRecipient(selectedOracleFeeVault.feeRecipient);
    }
  }, [selectedOracleFeeVault?.address, selectedOracleFeeVault?.feeRecipient, selectedOracleFeeVault?.paymentMint]);

  const poolTreasuryGuard = useMemo(() => {
    if (!capabilities.canWithdrawPoolTreasury) {
      return "Pool treasury withdrawals require an active oracle signer with treasury-withdraw permissions on this pool.";
    }
    if (!publicKey || !sendTransaction) {
      return "Connect the authorized oracle wallet to submit treasury withdrawals.";
    }
    if (!selectedReserve) {
      return "Select a reserve before submitting a withdrawal.";
    }
    if (selectedReserve.paymentMint === ZERO_PUBKEY && treasuryRecipient.trim() !== selectedReserve.feeRecipient) {
      return "SOL withdrawals must use the configured pool treasury fee recipient.";
    }
    return null;
  }, [capabilities.canWithdrawPoolTreasury, publicKey, selectedReserve, sendTransaction, treasuryRecipient]);
  const protocolFeeGuard = useMemo(() => {
    if (!capabilities.canWithdrawProtocolFees) {
      return "Protocol fee withdrawals require the governance authority or protocol admin wallet.";
    }
    if (!publicKey || !sendTransaction) {
      return "Connect the governance authority wallet to withdraw protocol fees.";
    }
    if (!selectedProtocolFeeVault) {
      return "Select a protocol fee vault before submitting a withdrawal.";
    }
    if (selectedProtocolFeeVault.paymentMint === ZERO_PUBKEY && protocolFeeRecipient.trim() !== selectedProtocolFeeVault.feeRecipient) {
      return "SOL withdrawals must use the configured protocol fee recipient.";
    }
    return null;
  }, [capabilities.canWithdrawProtocolFees, protocolFeeRecipient, publicKey, selectedProtocolFeeVault, sendTransaction]);
  const oracleFeeGuard = useMemo(() => {
    if (!capabilities.canWithdrawOracleFees) {
      return "Oracle fee withdrawals require the matching oracle wallet, oracle admin, or governance authority.";
    }
    if (!publicKey || !sendTransaction) {
      return "Connect an authorized oracle or governance wallet to withdraw oracle fees.";
    }
    if (!selectedOracleFeeVault) {
      return "Select an oracle fee vault before submitting a withdrawal.";
    }
    if (selectedOracleFeeVault.paymentMint === ZERO_PUBKEY && oracleFeeRecipient.trim() !== selectedOracleFeeVault.feeRecipient) {
      return "SOL withdrawals must use the configured oracle fee recipient.";
    }
    return null;
  }, [capabilities.canWithdrawOracleFees, oracleFeeRecipient, publicKey, selectedOracleFeeVault, sendTransaction]);

  async function onWithdrawPoolTreasury() {
    if (!publicKey || !sendTransaction || !selectedReserve) return;
    setBusy("pool-treasury");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const amount = BigInt(treasuryAmount || "0");
      const tx = selectedReserve.paymentMint === ZERO_PUBKEY
        ? buildWithdrawPoolTreasurySolTx({
            oracle: publicKey,
            poolAddress: new PublicKey(poolAddress),
            recipientSystemAccount: new PublicKey(treasuryRecipient.trim()),
            amount,
            recentBlockhash: blockhash,
          })
        : buildWithdrawPoolTreasurySplTx({
            oracle: publicKey,
            poolAddress: new PublicKey(poolAddress),
            reserveDomainAddress: new PublicKey(selectedReserve.reserveDomain),
            paymentMint: new PublicKey(selectedReserve.paymentMint),
            recipientTokenAccount: new PublicKey(treasuryRecipientTokenAccount.trim()),
            amount,
            recentBlockhash: blockhash,
          });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Withdraw pool treasury",
        onConfirmed: async () => {
          await refresh();
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
      setStatus(cause instanceof Error ? cause.message : "Pool treasury withdrawal inputs are invalid.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onWithdrawProtocolFees() {
    if (!publicKey || !sendTransaction || !selectedProtocolFeeVault) return;
    setBusy("protocol-fee");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const amount = BigInt(protocolFeeAmount || "0");
      const tx = selectedProtocolFeeVault.paymentMint === ZERO_PUBKEY
        ? buildWithdrawProtocolFeeSolTx({
            governanceAuthority: publicKey,
            reserveDomainAddress: new PublicKey(selectedProtocolFeeVault.reserveDomain),
            recipientSystemAccount: new PublicKey(protocolFeeRecipient.trim()),
            amount,
            recentBlockhash: blockhash,
          })
        : buildWithdrawProtocolFeeSplTx({
            governanceAuthority: publicKey,
            reserveDomainAddress: new PublicKey(selectedProtocolFeeVault.reserveDomain),
            paymentMint: new PublicKey(selectedProtocolFeeVault.paymentMint),
            recipientTokenAccount: new PublicKey(protocolFeeRecipientTokenAccount.trim()),
            amount,
            recentBlockhash: blockhash,
          });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Withdraw protocol fees",
        onConfirmed: async () => {
          await refresh();
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
      setStatus(cause instanceof Error ? cause.message : "Protocol fee withdrawal inputs are invalid.");
      setStatusTone("error");
    } finally {
      setBusy(null);
    }
  }

  async function onWithdrawOracleFees() {
    if (!publicKey || !sendTransaction || !selectedOracleFeeVault) return;
    setBusy("oracle-fee");
    setStatus(null);
    setTxUrl(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const amount = BigInt(oracleFeeAmount || "0");
      const tx = selectedOracleFeeVault.paymentMint === ZERO_PUBKEY
        ? buildWithdrawPoolOracleFeeSolTx({
            oracle: publicKey,
            oracleAddress: new PublicKey(selectedOracleFeeVault.oracle),
            poolAddress: new PublicKey(poolAddress),
            recipientSystemAccount: new PublicKey(oracleFeeRecipient.trim()),
            amount,
            recentBlockhash: blockhash,
          })
        : buildWithdrawPoolOracleFeeSplTx({
            oracle: publicKey,
            oracleAddress: new PublicKey(selectedOracleFeeVault.oracle),
            poolAddress: new PublicKey(poolAddress),
            reserveDomainAddress: new PublicKey(selectedOracleFeeVault.reserveDomain),
            paymentMint: new PublicKey(selectedOracleFeeVault.paymentMint),
            recipientTokenAccount: new PublicKey(oracleFeeRecipientTokenAccount.trim()),
            amount,
            recentBlockhash: blockhash,
          });
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label: "Withdraw pool oracle fees",
        onConfirmed: async () => {
          await refresh();
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
      setStatus(cause instanceof Error ? cause.message : "Oracle fee withdrawal inputs are invalid.");
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
            <p className="metric-label">Treasury and fee rails</p>
            <p className="field-help">Pool reserves, protocol fees, and oracle fee vaults are visible and operable inline.</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? <p className="field-error">{error}</p> : null}
        {status ? <p className={statusTone === "error" ? "field-error" : "field-help"}>{status}</p> : null}
        {txUrl ? (
          <a className="secondary-button inline-flex w-fit" href={txUrl} target="_blank" rel="noreferrer">
            View transaction
          </a>
        ) : null}
      </section>

      <section className="surface-card-soft space-y-3">
        <p className="metric-label">Pool treasury reserves</p>
        <SearchableSelect
          label="Reserve"
          value={selectedReserveAddress}
          options={reserves.map((reserve) => ({
            value: reserve.address,
            label: reserve.paymentMint === ZERO_PUBKEY ? "SOL reserve" : `${shortAddress(reserve.paymentMint)} reserve`,
            hint: `Claims reserved ${reserve.reservedCoverageClaimAmount.toString()} | Rewards reserved ${reserve.reservedRewardAmount.toString()}`,
          }))}
          onChange={setSelectedReserveAddress}
          searchValue={reserveSearch}
          onSearchChange={setReserveSearch}
          loading={loading}
          placeholder="Select reserve"
        />
        {selectedReserve ? (
          <div className="grid gap-3 md:grid-cols-2">
            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Selected reserve</h3>
                <p className="operator-task-copy">Review reserved balances first, then withdraw only if this wallet is authorized.</p>
              </div>
              <ul className="operator-summary-list">
                <li>Reward reserved: {selectedReserve.reservedRewardAmount.toString()}</li>
                <li>Coverage reserved: {selectedReserve.reservedCoverageClaimAmount.toString()}</li>
                <li>Coverage paid: {selectedReserve.paidCoverageClaimAmount.toString()}</li>
                <li>Impaired: {selectedReserve.impairedAmount.toString()}</li>
              </ul>
              <ProtocolDetailDisclosure title="Reserve addresses" summary="Mint and vault address details stay collapsed unless you need to audit them.">
                <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                  <p>Reserve account: <span className="break-all font-mono">{selectedReserve.address}</span></p>
                  <p>Payment mint: <span className="break-all font-mono">{selectedReserve.paymentMint === ZERO_PUBKEY ? "SOL" : selectedReserve.paymentMint}</span></p>
                  <p>Fee recipient: <span className="break-all font-mono">{selectedReserve.feeRecipient}</span></p>
                </div>
              </ProtocolDetailDisclosure>
            </article>
            {capabilities.canWithdrawPoolTreasury ? (
              <article className="operator-task-card">
                <div className="operator-task-head">
                  <h3 className="operator-task-title">Withdraw from pool reserve</h3>
                  <p className="operator-task-copy">Send funds to the correct recipient account for the selected rail.</p>
                </div>
                <label className="space-y-1">
                  <span className="metric-label">Amount</span>
                  <input className="field-input" value={treasuryAmount} onChange={(event) => setTreasuryAmount(event.target.value)} />
                </label>
                {selectedReserve.paymentMint === ZERO_PUBKEY ? (
                  <label className="space-y-1">
                    <span className="metric-label">Recipient system account</span>
                    <input className="field-input" value={treasuryRecipient} onChange={(event) => setTreasuryRecipient(event.target.value)} disabled />
                  </label>
                ) : (
                  <label className="space-y-1">
                    <span className="metric-label">Recipient token account owned by {shortAddress(selectedReserve.feeRecipient)}</span>
                    <input className="field-input" value={treasuryRecipientTokenAccount} onChange={(event) => setTreasuryRecipientTokenAccount(event.target.value)} />
                  </label>
                )}
                <button type="button" className="action-button" onClick={() => void onWithdrawPoolTreasury()} disabled={Boolean(poolTreasuryGuard) || busy === "pool-treasury"}>
                  {busy === "pool-treasury" ? "Submitting..." : "Withdraw pool treasury"}
                </button>
                {poolTreasuryGuard ? <p className="field-help">{poolTreasuryGuard}</p> : null}
              </article>
            ) : (
              <article className="operator-task-card">
                <p className="metric-label">Withdrawal access</p>
                <p className="field-help mt-2">{poolTreasuryGuard}</p>
              </article>
            )}
          </div>
        ) : (
          <p className="field-help">No treasury reserve found for this pool yet.</p>
        )}
      </section>

      <section className="surface-card-soft space-y-3">
        <p className="metric-label">Protocol fee vaults</p>
        <SearchableSelect
          label="Protocol fee vault"
          value={selectedProtocolFeeVaultAddress}
          options={protocolFeeVaults.map((vault) => ({
            value: vault.address,
            label: vault.paymentMint === ZERO_PUBKEY ? "SOL protocol fees" : shortAddress(vault.paymentMint),
            hint: vault.address,
          }))}
          onChange={setSelectedProtocolFeeVaultAddress}
          searchValue={protocolFeeSearch}
          onSearchChange={setProtocolFeeSearch}
          loading={loading}
          placeholder="Select protocol fee vault"
        />
        {selectedProtocolFeeVault ? (
          <div className="grid gap-3 md:grid-cols-2">
            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Selected protocol fee rail</h3>
                <p className="operator-task-copy">Use this rail to withdraw accumulated protocol fees when this signer is authorized.</p>
              </div>
              <p className="field-help">Payment mint: {selectedProtocolFeeVault.paymentMint === ZERO_PUBKEY ? "SOL" : shortAddress(selectedProtocolFeeVault.paymentMint)}</p>
              <ProtocolDetailDisclosure title="Vault addresses" summary="Full protocol fee vault details are available here when you need to inspect them.">
                <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                  <p>Vault account: <span className="break-all font-mono">{selectedProtocolFeeVault.address}</span></p>
                  <p>Payment mint: <span className="break-all font-mono">{selectedProtocolFeeVault.paymentMint === ZERO_PUBKEY ? "SOL" : selectedProtocolFeeVault.paymentMint}</span></p>
                  <p>Fee recipient: <span className="break-all font-mono">{selectedProtocolFeeVault.feeRecipient}</span></p>
                </div>
              </ProtocolDetailDisclosure>
            </article>
            {capabilities.canWithdrawProtocolFees ? (
              <article className="operator-task-card">
                <div className="operator-task-head">
                  <h3 className="operator-task-title">Withdraw protocol fees</h3>
                  <p className="operator-task-copy">Choose the recipient for the selected SOL or SPL fee rail before submitting.</p>
                </div>
                <label className="space-y-1">
                  <span className="metric-label">Amount</span>
                  <input className="field-input" value={protocolFeeAmount} onChange={(event) => setProtocolFeeAmount(event.target.value)} />
                </label>
                {selectedProtocolFeeVault.paymentMint === ZERO_PUBKEY ? (
                  <label className="space-y-1">
                    <span className="metric-label">Recipient system account</span>
                    <input className="field-input" value={protocolFeeRecipient} onChange={(event) => setProtocolFeeRecipient(event.target.value)} disabled />
                  </label>
                ) : (
                  <label className="space-y-1">
                    <span className="metric-label">Recipient token account owned by {shortAddress(selectedProtocolFeeVault.feeRecipient)}</span>
                    <input className="field-input" value={protocolFeeRecipientTokenAccount} onChange={(event) => setProtocolFeeRecipientTokenAccount(event.target.value)} />
                  </label>
                )}
                <button type="button" className="action-button" onClick={() => void onWithdrawProtocolFees()} disabled={Boolean(protocolFeeGuard) || busy === "protocol-fee"}>
                  {busy === "protocol-fee" ? "Submitting..." : "Withdraw protocol fees"}
                </button>
                {protocolFeeGuard ? <p className="field-help">{protocolFeeGuard}</p> : null}
              </article>
            ) : (
              <article className="operator-task-card">
                <p className="metric-label">Withdrawal access</p>
                <p className="field-help mt-2">{protocolFeeGuard}</p>
              </article>
            )}
          </div>
        ) : (
          <p className="field-help">No protocol fee vaults discovered on this network.</p>
        )}
      </section>

      <section className="surface-card-soft space-y-3">
        <p className="metric-label">Oracle fee vaults</p>
        <SearchableSelect
          label="Oracle fee vault"
          value={selectedOracleFeeVaultAddress}
          options={oracleFeeVaults.map((vault) => ({
            value: vault.address,
            label: `${shortAddress(vault.oracle)} • ${vault.paymentMint === ZERO_PUBKEY ? "SOL" : shortAddress(vault.paymentMint)}`,
            hint: `Pool ${shortAddress(vault.pool)}`,
          }))}
          onChange={setSelectedOracleFeeVaultAddress}
          searchValue={oracleFeeSearch}
          onSearchChange={setOracleFeeSearch}
          loading={loading}
          placeholder="Select oracle fee vault"
        />
        {selectedOracleFeeVault ? (
          <div className="grid gap-3 md:grid-cols-2">
            <article className="operator-task-card">
              <div className="operator-task-head">
                <h3 className="operator-task-title">Selected oracle fee rail</h3>
                <p className="operator-task-copy">Review the matching oracle and mint before moving fee balances.</p>
              </div>
              <ul className="operator-summary-list">
                <li>Oracle: {shortAddress(selectedOracleFeeVault.oracle)}</li>
                <li>Payment mint: {selectedOracleFeeVault.paymentMint === ZERO_PUBKEY ? "SOL" : shortAddress(selectedOracleFeeVault.paymentMint)}</li>
                <li>Fee recipient: {shortAddress(selectedOracleFeeVault.feeRecipient)}</li>
              </ul>
              <ProtocolDetailDisclosure title="Vault addresses" summary="Full oracle fee vault details stay collapsed unless you are auditing the rail.">
                <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                  <p>Vault account: <span className="break-all font-mono">{selectedOracleFeeVault.address}</span></p>
                  <p>Oracle: <span className="break-all font-mono">{selectedOracleFeeVault.oracle}</span></p>
                  <p>Pool: <span className="break-all font-mono">{selectedOracleFeeVault.pool}</span></p>
                  <p>Fee recipient: <span className="break-all font-mono">{selectedOracleFeeVault.feeRecipient}</span></p>
                </div>
              </ProtocolDetailDisclosure>
            </article>
            {capabilities.canWithdrawOracleFees ? (
              <article className="operator-task-card">
                <div className="operator-task-head">
                  <h3 className="operator-task-title">Withdraw oracle fees</h3>
                  <p className="operator-task-copy">Use the matching signer and recipient account for the selected oracle fee rail.</p>
                </div>
                <label className="space-y-1">
                  <span className="metric-label">Amount</span>
                  <input className="field-input" value={oracleFeeAmount} onChange={(event) => setOracleFeeAmount(event.target.value)} />
                </label>
                {selectedOracleFeeVault.paymentMint === ZERO_PUBKEY ? (
                  <label className="space-y-1">
                    <span className="metric-label">Recipient system account</span>
                    <input className="field-input" value={oracleFeeRecipient} onChange={(event) => setOracleFeeRecipient(event.target.value)} disabled />
                  </label>
                ) : (
                  <label className="space-y-1">
                    <span className="metric-label">Recipient token account owned by {shortAddress(selectedOracleFeeVault.feeRecipient)}</span>
                    <input className="field-input" value={oracleFeeRecipientTokenAccount} onChange={(event) => setOracleFeeRecipientTokenAccount(event.target.value)} />
                  </label>
                )}
                <button type="button" className="action-button" onClick={() => void onWithdrawOracleFees()} disabled={Boolean(oracleFeeGuard) || busy === "oracle-fee"}>
                  {busy === "oracle-fee" ? "Submitting..." : "Withdraw oracle fees"}
                </button>
                {oracleFeeGuard ? <p className="field-help">{oracleFeeGuard}</p> : null}
              </article>
            ) : (
              <article className="operator-task-card">
                <p className="metric-label">Withdrawal access</p>
                <p className="field-help mt-2">{oracleFeeGuard}</p>
              </article>
            )}
          </div>
        ) : (
          <p className="field-help">No oracle fee vaults found for this pool yet.</p>
        )}
      </section>
    </div>
  );
}
