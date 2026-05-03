// SPDX-License-Identifier: AGPL-3.0-or-later

import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Connection, Signer, Transaction } from "@solana/web3.js";
import { toast } from "sonner";

import {
  executeProtocolTransaction,
  type ProtocolActionResult,
  type ProtocolActionSuccess,
  type ProtocolTransactionReviewConfirmation,
  type ProtocolTransactionReviewMetadata,
} from "@/lib/protocol-action";
import { humanizeProtocolError } from "@/lib/protocol-error-map";

/**
 * Wrap `executeProtocolTransaction` with the post-sign transaction lifecycle:
 *
 *   submitting (loading)
 *     → submitted   (loading, with truncated signature + explorer link)
 *       → confirmed (success)  +  optional snapshot refetch via `onConfirmed`
 *       → failed    (error, with humanized cause + optional retry action)
 *
 * Caller-supplied `onConfirmed` should trigger snapshot refetch — the
 * wrapper does NOT introspect application state. The pure helper
 * `executeProtocolTransaction` remains side-effect free and is still
 * the right primitive for non-UI call sites (tests, server-side flows).
 */

const TOAST_LOADING_DURATION_MS = 30_000;
const TOAST_SUCCESS_DURATION_MS = 8_000;
const TOAST_ERROR_DURATION_MS = 12_000;

export type ProtocolActionToastParams = {
  connection: Connection;
  sendTransaction: WalletContextState["sendTransaction"];
  tx: Transaction;
  label: string;
  signers?: Signer[];
  explorerCluster?: string | null;
  review?: ProtocolTransactionReviewMetadata;
  skipReview?: true;
  /**
   * Pre-sign review confirmation. Required by default for protocol
   * transactions; `skipReview: true` is the explicit escape hatch for
   * non-wallet or test-only callers. The toast wrapper forwards this
   * verbatim; UI surfaces should provide `useProtocolTransactionReviewPrompt`.
   */
  confirmReview?: ProtocolTransactionReviewConfirmation;
  onConfirmed?: (result: ProtocolActionSuccess) => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
};

export async function executeProtocolTransactionWithToast(
  params: ProtocolActionToastParams,
): Promise<ProtocolActionResult> {
  const toastId = toast.loading(`Submitting ${params.label}…`, {
    description: "Building blockhash and simulating the transaction.",
    duration: TOAST_LOADING_DURATION_MS,
  });

  try {
    const result = await executeProtocolTransaction({
      connection: params.connection,
      sendTransaction: params.sendTransaction,
      tx: params.tx,
      label: params.label,
      signers: params.signers,
      explorerCluster: params.explorerCluster ?? null,
      review: params.review,
      confirmReview: params.confirmReview,
      skipReview: params.skipReview,
      onLifecycle: (event) => {
        if (event.phase !== "submitted") return;
        toast.loading(`${params.label} submitted`, {
          id: toastId,
          description: `Awaiting confirmation · ${shortSignature(event.signature)}`,
          duration: TOAST_LOADING_DURATION_MS,
        });
      },
    });

    if (result.ok) {
      toast.success(`${params.label} confirmed`, {
        id: toastId,
        description: shortSignature(result.signature),
        action: {
          label: "View",
          onClick: () => openExplorer(result.explorerUrl),
        },
        duration: TOAST_SUCCESS_DURATION_MS,
      });

      if (params.onConfirmed) {
        try {
          await params.onConfirmed(result);
        } catch {
          // Snapshot refetch failures are surfaced through their own paths;
          // never let them mask the confirmed-tx success state.
        }
      }

      return result;
    }

    const humanized = humanizeProtocolError(result.error);
    const retryAction = params.onRetry
      ? {
          label: "Retry",
          onClick: () => {
            void params.onRetry?.();
          },
        }
      : undefined;

    toast.error(`${params.label} failed`, {
      id: toastId,
      description: humanized.hint ? `${humanized.message} ${humanized.hint}` : humanized.message,
      action: retryAction,
      duration: TOAST_ERROR_DURATION_MS,
    });

    return result;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : `${params.label} failed.`;
    const humanized = humanizeProtocolError(message);
    toast.error(`${params.label} failed`, {
      id: toastId,
      description: humanized.hint ? `${humanized.message} ${humanized.hint}` : humanized.message,
      duration: TOAST_ERROR_DURATION_MS,
    });
    return { ok: false, error: message };
  }
}

function shortSignature(signature: string): string {
  if (signature.length <= 16) return signature;
  return `${signature.slice(0, 8)}…${signature.slice(-8)}`;
}

function openExplorer(url: string | null): void {
  if (!url) return;
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}
