// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Humanize raw transaction error strings into actionable messages.
 *
 * Inputs are typically already RPC-error-formatted by `formatRpcError`, but
 * may still surface raw simulation errors (e.g. `Custom error: 0x1771`),
 * insufficient-funds messages, or unbounded provider strings. This helper
 * trims the most common patterns and falls back to the original message
 * when no rule matches.
 *
 * Extend this map as protocol-specific error codes accumulate. Keep the
 * messages short, action-oriented, and sponsor-readable; never reference
 * internal account names or instruction handlers.
 */

export type HumanizedProtocolError = {
  message: string;
  hint: string | null;
  retryable: boolean;
};

const INSUFFICIENT_FUNDS_RX = /insufficient (?:funds|lamports|balance)/i;
const SIMULATION_FAILED_RX = /simulation failed/i;
const RATE_LIMIT_RX = /(429|too many requests|rate limit)/i;
const BLOCKHASH_NOT_FOUND_RX = /blockhash not found|block height exceeded/i;
const USER_REJECTED_RX = /user rejected|wallet adapter user rejected|approval was declined/i;
const PROGRAM_HEX_RX = /(?:custom error|program error)[:\s]*0x([0-9a-f]+)/i;

export function humanizeProtocolError(raw: string | null | undefined): HumanizedProtocolError {
  const message = (raw ?? "").trim();

  if (!message) {
    return {
      message: "The transaction failed without a specific reason from the wallet or RPC endpoint.",
      hint: "Retry, or open the console and check the RPC endpoint health.",
      retryable: true,
    };
  }

  if (USER_REJECTED_RX.test(message)) {
    return {
      message: "The wallet rejected the signature request.",
      hint: "Reopen the action and approve in your wallet to try again.",
      retryable: true,
    };
  }

  if (INSUFFICIENT_FUNDS_RX.test(message)) {
    return {
      message: "Not enough SOL in the fee payer account to cover network fees.",
      hint: "Top up the fee payer with SOL on the configured network and retry.",
      retryable: true,
    };
  }

  if (RATE_LIMIT_RX.test(message)) {
    return {
      message: "The configured RPC endpoint rate-limited this request.",
      hint: "Wait a few seconds and retry, or switch to a dedicated RPC endpoint in wallet settings.",
      retryable: true,
    };
  }

  if (BLOCKHASH_NOT_FOUND_RX.test(message)) {
    return {
      message: "The recent blockhash expired before confirmation completed.",
      hint: "Retry the action — the wrapper builds a fresh blockhash on each attempt.",
      retryable: true,
    };
  }

  const programMatch = message.match(PROGRAM_HEX_RX);
  if (programMatch) {
    return {
      message: `Protocol returned program error 0x${programMatch[1]}.`,
      hint: "Check the action's preconditions (authority, capacity, schema) and retry.",
      retryable: true,
    };
  }

  if (SIMULATION_FAILED_RX.test(message)) {
    return {
      message,
      hint: "Simulation rejected the action before signing — adjust the inputs and retry.",
      retryable: true,
    };
  }

  return {
    message,
    hint: null,
    retryable: true,
  };
}
