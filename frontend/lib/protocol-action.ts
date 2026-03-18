// SPDX-License-Identifier: AGPL-3.0-or-later

import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Connection, Signer, Transaction } from "@solana/web3.js";

import { toExplorerLink } from "@/lib/protocol";
import { formatRpcError } from "@/lib/rpc-errors";

export type ProtocolActionSuccess = {
  ok: true;
  signature: string;
  explorerUrl: string;
  message: string;
};

export type ProtocolActionFailure = {
  ok: false;
  error: string;
};

export type ProtocolActionResult = ProtocolActionSuccess | ProtocolActionFailure;

export async function executeProtocolTransaction(params: {
  connection: Connection;
  sendTransaction: WalletContextState["sendTransaction"];
  tx: Transaction;
  label: string;
  signers?: Signer[];
  explorerCluster?: string | null;
}): Promise<ProtocolActionResult> {
  try {
    const latestBlockhash = await params.connection.getLatestBlockhash("confirmed");
    params.tx.recentBlockhash = latestBlockhash.blockhash;
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
    };
  } catch (cause) {
    return {
      ok: false,
      error: formatRpcError(cause, {
        fallback: `${params.label} failed.`,
        rpcEndpoint: params.connection.rpcEndpoint,
      }),
    };
  }
}
