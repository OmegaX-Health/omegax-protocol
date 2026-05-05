// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey, type Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { useProtocolTransactionReviewPrompt } from "@/components/protocol-transaction-review";
import { executeProtocolTransactionWithToast } from "@/lib/protocol-action-toast";
import {
  buildDepositIntoCapitalClassTx,
  buildRequestRedemptionTx,
  type CapitalClassSnapshot,
  type DomainAssetVaultSnapshot,
  type LiquidityPoolSnapshot,
  type LPPositionSnapshot,
} from "@/lib/protocol";
import { formatAmount } from "@/lib/canonical-ui";

type Status = {
  tone: "ok" | "error";
  message: string;
} | null;

type CapitalLpSelfServicePanelProps = {
  selectedPool: LiquidityPoolSnapshot | null;
  selectedClass: CapitalClassSnapshot | null;
  domainAssetVaults: DomainAssetVaultSnapshot[];
  lpPositions: LPPositionSnapshot[];
  onRefresh?: () => Promise<void> | void;
};

function parseBigIntInput(value: string): bigint {
  const normalized = value.trim().replace(/[_ ,]/g, "");
  if (!normalized) return 0n;
  try {
    return BigInt(normalized);
  } catch {
    return 0n;
  }
}

function deriveOwnerAta(owner: PublicKey | null, mint: string | null): string {
  if (!owner || !mint) return "";
  try {
    return getAssociatedTokenAddressSync(new PublicKey(mint), owner, false).toBase58();
  } catch {
    return "";
  }
}

export function CapitalLpSelfServicePanel(props: CapitalLpSelfServicePanelProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { confirmReview, reviewPrompt } = useProtocolTransactionReviewPrompt();
  const [depositAmount, setDepositAmount] = useState("");
  const [minimumShares, setMinimumShares] = useState("0");
  const [sourceTokenAccount, setSourceTokenAccount] = useState("");
  const [redemptionShares, setRedemptionShares] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const selectedVault = useMemo(
    () =>
      props.domainAssetVaults.find(
        (vault) =>
          vault.reserveDomain === props.selectedPool?.reserveDomain &&
          vault.assetMint === props.selectedPool?.depositAssetMint,
      ) ?? null,
    [props.domainAssetVaults, props.selectedPool?.depositAssetMint, props.selectedPool?.reserveDomain],
  );
  const ownerPosition = useMemo(
    () =>
      props.lpPositions.find(
        (position) =>
          position.capitalClass === props.selectedClass?.address &&
          position.owner === publicKey?.toBase58(),
      ) ?? null,
    [props.lpPositions, props.selectedClass?.address, publicKey],
  );

  useEffect(() => {
    const derived = deriveOwnerAta(publicKey ?? null, props.selectedPool?.depositAssetMint ?? null);
    if (derived) setSourceTokenAccount(derived);
  }, [props.selectedPool?.depositAssetMint, publicKey]);

  async function run(label: string, factory: () => Promise<Transaction>) {
    if (!publicKey || !sendTransaction) return;
    setBusy(label);
    setStatus(null);
    try {
      const tx = await factory();
      const result = await executeProtocolTransactionWithToast({
        connection,
        sendTransaction,
        tx,
        label,
        confirmReview,
        review: {
          authority: publicKey.toBase58(),
          feePayer: publicKey.toBase58(),
          affectedObject: props.selectedClass
            ? `${props.selectedClass.displayName} (${props.selectedClass.address})`
            : "LP self-service",
          economicEffect:
            label === "Deposit LP capital"
              ? "Deposits SPL assets into the selected capital class and mints LP shares under the pool accounting rules."
              : "Queues LP shares for operator-processed redemption; it does not withdraw assets immediately.",
          warnings: [
            "Phase 0 LP exits are queue-only; redemption processing remains operator-reviewed.",
            "Use the token account for the pool deposit mint only.",
          ],
        },
        onConfirmed: async () => {
          await props.onRefresh?.();
        },
        onRetry: () => {
          void run(label, factory);
        },
      });
      setStatus({
        tone: result.ok ? "ok" : "error",
        message: result.ok ? result.message : result.error,
      });
    } catch (cause) {
      setStatus({
        tone: "error",
        message: cause instanceof Error ? cause.message : `${label} failed.`,
      });
    } finally {
      setBusy(null);
    }
  }

  const canSubmit =
    Boolean(publicKey)
    && Boolean(props.selectedPool)
    && Boolean(props.selectedClass)
    && Boolean(selectedVault?.vaultTokenAccount);

  return (
    <article className="plans-card heavy-glass">
      {reviewPrompt}
      <div className="plans-card-head">
        <div>
          <p className="plans-card-eyebrow">LP self-service</p>
          <h2 className="plans-card-title plans-card-title-display">
            Deposit or queue <em>redemption</em>
          </h2>
        </div>
        <span className="plans-card-meta">Queue-only exit</span>
      </div>

      <div className="plans-notice liquid-glass" role="status">
        <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">info</span>
        <p>
          Public LP deposits and redemption requests are live. Redemption processing stays operator-reviewed and pays the LP owner route enforced on-chain.
        </p>
      </div>

      {status ? (
        <div className="plans-notice liquid-glass" role="status">
          <span className="material-symbols-outlined plans-notice-icon" aria-hidden="true">
            {status.tone === "ok" ? "verified" : "error"}
          </span>
          <p>{status.message}</p>
        </div>
      ) : null}

      <div className="plans-settings-grid">
        <div className="plans-settings-row">
          <div>
            <span className="plans-settings-label">Selected class</span>
            <span className="plans-settings-lane">Choose the pool and class in the context bar above</span>
          </div>
          <span className="plans-settings-address">{props.selectedClass?.displayName ?? "None"}</span>
        </div>
        <div className="plans-settings-row">
          <div>
            <span className="plans-settings-label">Your LP shares</span>
            <span className="plans-settings-lane">Connected wallet position in this class</span>
          </div>
          <span className="plans-settings-address">{formatAmount(ownerPosition?.shares ?? 0n)}</span>
        </div>
      </div>

      <div className="plans-wizard-row">
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">Deposit amount (base units)</span>
          <span className="plans-wizard-field-bar">
            <input
              type="text"
              inputMode="numeric"
              className="plans-wizard-input"
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
              placeholder="0"
            />
          </span>
        </label>
        <label className="plans-wizard-field-group">
          <span className="plans-wizard-field-label">Minimum shares</span>
          <span className="plans-wizard-field-bar">
            <input
              type="text"
              inputMode="numeric"
              className="plans-wizard-input"
              value={minimumShares}
              onChange={(event) => setMinimumShares(event.target.value)}
              placeholder="0"
            />
          </span>
        </label>
      </div>

      <label className="plans-wizard-field-group">
        <span className="plans-wizard-field-label">Source token account</span>
        <span className="plans-wizard-field-bar">
          <input
            type="text"
            className="plans-wizard-input"
            value={sourceTokenAccount}
            onChange={(event) => setSourceTokenAccount(event.target.value)}
            placeholder="Associated token account for the pool mint"
          />
        </span>
      </label>

      <div className="operator-drawer-actions">
        <button
          type="button"
          className="plans-primary-cta"
          disabled={!canSubmit || !sourceTokenAccount.trim() || !depositAmount.trim() || busy === "Deposit LP capital"}
          onClick={() =>
            run("Deposit LP capital", async () => {
              const { blockhash } = await connection.getLatestBlockhash("confirmed");
              return buildDepositIntoCapitalClassTx({
                owner: publicKey!,
                reserveDomainAddress: props.selectedPool!.reserveDomain,
                poolAddress: props.selectedPool!.address,
                poolDepositAssetMint: props.selectedPool!.depositAssetMint,
                capitalClassAddress: props.selectedClass!.address,
                sourceTokenAccountAddress: sourceTokenAccount.trim(),
                vaultTokenAccountAddress: selectedVault!.vaultTokenAccount,
                recentBlockhash: blockhash,
                amount: parseBigIntInput(depositAmount),
                shares: parseBigIntInput(minimumShares),
              });
            })
          }
        >
          Deposit
        </button>
      </div>

      <div className="plans-wizard-divider" aria-hidden="true" />

      <label className="plans-wizard-field-group">
        <span className="plans-wizard-field-label">Shares to queue for redemption</span>
        <span className="plans-wizard-field-bar">
          <input
            type="text"
            inputMode="numeric"
            className="plans-wizard-input"
            value={redemptionShares}
            onChange={(event) => setRedemptionShares(event.target.value)}
            placeholder="0"
          />
        </span>
      </label>
      <div className="operator-drawer-actions">
        <button
          type="button"
          className="plans-secondary-cta"
          disabled={!canSubmit || !redemptionShares.trim() || busy === "Request LP redemption"}
          onClick={() =>
            run("Request LP redemption", async () => {
              const { blockhash } = await connection.getLatestBlockhash("confirmed");
              return buildRequestRedemptionTx({
                owner: publicKey!,
                reserveDomainAddress: props.selectedPool!.reserveDomain,
                poolAddress: props.selectedPool!.address,
                poolDepositAssetMint: props.selectedPool!.depositAssetMint,
                capitalClassAddress: props.selectedClass!.address,
                recentBlockhash: blockhash,
                shares: parseBigIntInput(redemptionShares),
              });
            })
          }
        >
          Request redemption
        </button>
      </div>
    </article>
  );
}
