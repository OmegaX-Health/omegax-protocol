// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useSolUsdPrice } from "@/lib/use-token-price";

/**
 * Render a SOL amount with consistent precision and an optional USD twin.
 *
 * Use this in place of inline `value / 1e9` divisions, ad-hoc `toFixed(...)`
 * calls, and template strings like `${n} SOL`. One render path means one
 * decimal-precision rule, one thousand-separators rule, one USD price source,
 * and one place to add an insufficient-balance warning later.
 *
 * The USD label is hidden when the price feed is unreachable rather than
 * shown as "$0.00", so users never read a stale or wrong fiat value.
 */

const SOL_DECIMALS = 9;
const SOL_DEFAULT_DISPLAY_DECIMALS = 4;
const USD_DISPLAY_DECIMALS = 2;

export type AmountUnit = "SOL" | "lamports";

export type AmountProps = {
  /**
   * The numeric value. When `unit` is `"lamports"` (default) the value is
   * interpreted as integer lamports and converted to SOL for display.
   * When `unit` is `"SOL"` the value is interpreted as already-converted SOL.
   */
  value: number | bigint | string | null | undefined;
  unit?: AmountUnit;
  /** Override the SOL display precision. Defaults to 4 decimals. */
  decimals?: number;
  /** When true, render the USD-equivalent in a muted secondary label. */
  showUsd?: boolean;
  /** Optional className applied to the wrapping span. */
  className?: string;
  /** When true, render a single line; when false, allow wrap (rare). */
  compact?: boolean;
};

export function Amount({
  value,
  unit = "lamports",
  decimals,
  showUsd = false,
  className,
  compact = true,
}: AmountProps) {
  const { price: solUsdPrice } = useSolUsdPrice();
  const sol = toSol(value, unit);
  const displayDecimals = decimals ?? SOL_DEFAULT_DISPLAY_DECIMALS;

  const tokenLabel = sol === null ? "—" : `${formatToken(sol, displayDecimals)} SOL`;

  let usdLabel: string | null = null;
  if (showUsd && sol !== null && solUsdPrice !== null) {
    const usd = sol * solUsdPrice;
    usdLabel = `$${formatUsd(usd)}`;
  }

  return (
    <span className={className} style={{ whiteSpace: compact ? "nowrap" : undefined }}>
      <span>{tokenLabel}</span>
      {usdLabel ? (
        <span
          aria-label="USD equivalent"
          style={{
            color: "var(--muted-foreground)",
            marginLeft: "0.4rem",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ({usdLabel})
        </span>
      ) : null}
    </span>
  );
}

function toSol(value: AmountProps["value"], unit: AmountUnit): number | null {
  if (value === null || value === undefined) return null;
  let raw: number;
  if (typeof value === "bigint") {
    raw = Number(value);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    raw = Number(trimmed);
  } else {
    raw = value;
  }
  if (!Number.isFinite(raw)) return null;
  return unit === "lamports" ? raw / Math.pow(10, SOL_DECIMALS) : raw;
}

function formatToken(value: number, maxDecimals: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: USD_DISPLAY_DECIMALS,
    maximumFractionDigits: USD_DISPLAY_DECIMALS,
  }).format(value);
}
