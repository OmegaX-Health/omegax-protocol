// SPDX-License-Identifier: AGPL-3.0-or-later

import type { WalletContextState } from "@solana/wallet-adapter-react";
import { PublicKey, type Connection, type Signer, type Transaction } from "@solana/web3.js";

import { toExplorerLink } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

export type ProtocolTransactionSimulationReview = {
  ok: boolean;
  error: string | null;
  logs: string[];
};

export type ProtocolTransactionReviewMetadata = {
  authority?: string | null;
  feePayer?: string | null;
  affectedObject?: string | null;
  economicEffect?: string | null;
  warnings?: string[];
};

export type ProtocolTransactionReview = {
  label: string;
  authority: string;
  feePayer: string;
  affectedObject: string;
  economicEffect: string;
  estimatedFeeLamports: number | null;
  simulation: ProtocolTransactionSimulationReview;
  warnings: string[];
  explorerUrl: string | null;
};

export type ProtocolActionSuccess = {
  ok: true;
  signature: string;
  explorerUrl: string;
  message: string;
  review?: ProtocolTransactionReview;
};

export type ProtocolActionFailure = {
  ok: false;
  error: string;
  review?: ProtocolTransactionReview;
};

export type ProtocolActionResult = ProtocolActionSuccess | ProtocolActionFailure;

export async function executeProtocolTransaction(params: {
  connection: Connection;
  sendTransaction: WalletContextState["sendTransaction"];
  tx: Transaction;
  label: string;
  signers?: Signer[];
  explorerCluster?: string | null;
  review?: ProtocolTransactionReviewMetadata;
}): Promise<ProtocolActionResult> {
  let review: ProtocolTransactionReview | undefined;
  try {
    const latestBlockhash = await params.connection.getLatestBlockhash("confirmed");
    params.tx.recentBlockhash = latestBlockhash.blockhash;
    applyReviewFeePayer(params.tx, params.review?.feePayer);
    review = await buildProtocolTransactionReview({
      connection: params.connection,
      tx: params.tx,
      label: params.label,
      metadata: params.review,
    });
    if (!review.simulation.ok) {
      return {
        ok: false,
        error: review.simulation.error ?? `${params.label} simulation failed.`,
        review,
      };
    }
    const signature = await params.sendTransaction(
      params.tx,
      params.connection,
      params.signers?.length ? { signers: params.signers } : undefined,
    );
    const confirmation = await params.connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed",
    );
    if (confirmation.value.err) {
      throw new Error(`${params.label} transaction failed during confirmation.`);
    }
    return {
      ok: true,
      signature,
      explorerUrl: toExplorerLink(signature, params.explorerCluster ?? undefined),
      message: `${params.label} confirmed.`,
      review: {
        ...review,
        explorerUrl: toExplorerLink(signature, params.explorerCluster ?? undefined),
      },
    };
  } catch (cause) {
    return {
      ok: false,
      error: formatRpcError(cause, {
        fallback: `${params.label} failed.`,
        rpcEndpoint: params.connection.rpcEndpoint,
      }),
      review,
    };
  }
}

export async function buildProtocolTransactionReview(params: {
  connection: Connection;
  tx: Transaction;
  label: string;
  metadata?: ProtocolTransactionReviewMetadata | null;
}): Promise<ProtocolTransactionReview> {
  const warnings = [...(params.metadata?.warnings ?? [])];
  applyReviewFeePayer(params.tx, params.metadata?.feePayer);

  let estimatedFeeLamports: number | null = null;
  try {
    estimatedFeeLamports = (await params.connection.getFeeForMessage(params.tx.compileMessage(), "confirmed")).value;
  } catch (cause) {
    warnings.push(
      formatRpcError(cause, {
        fallback: "Fee estimate unavailable.",
        rpcEndpoint: params.connection.rpcEndpoint,
      }),
    );
  }

  const simulation = await simulateForReview(params.connection, params.tx, params.label);

  return {
    label: params.label,
    authority: params.metadata?.authority?.trim() || "Not provided",
    feePayer: params.metadata?.feePayer?.trim() || params.tx.feePayer?.toBase58() || "Wallet adapter",
    affectedObject: params.metadata?.affectedObject?.trim() || "Protocol transaction",
    economicEffect: params.metadata?.economicEffect?.trim() || "Review the instruction payload before signing.",
    estimatedFeeLamports,
    simulation,
    warnings,
    explorerUrl: null,
  };
}

function applyReviewFeePayer(tx: Transaction, feePayer?: string | null): void {
  if (tx.feePayer || !feePayer?.trim()) return;
  try {
    tx.feePayer = new PublicKey(feePayer.trim());
  } catch {
    // Keep the review non-blocking; invalid fee payer strings are surfaced as fee/simulation warnings.
  }
}

async function simulateForReview(
  connection: Connection,
  tx: Transaction,
  label: string,
): Promise<ProtocolTransactionSimulationReview> {
  try {
    const result = await connection.simulateTransaction(tx);
    const logs = result.value.logs ?? [];
    if (result.value.err) {
      return {
        ok: false,
        error: `${label} simulation failed: ${formatSimulationError(result.value.err)}`,
        logs,
      };
    }
    return {
      ok: true,
      error: null,
      logs,
    };
  } catch (cause) {
    return {
      ok: false,
      error: formatRpcError(cause, {
        fallback: `${label} simulation failed.`,
        rpcEndpoint: connection.rpcEndpoint,
      }),
      logs: [],
    };
  }
}

function formatSimulationError(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
