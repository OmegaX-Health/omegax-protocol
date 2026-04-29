// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useState } from "react";

/**
 * Fetch the current SOL/USD spot price from Pyth Hermes for USD-equivalent
 * displays in the console. Cached in `localStorage` for 60s so most pageloads
 * resolve instantly; returns `null` while loading or when both the cache and
 * the network fetch fail (UI should hide the USD label, not show "$0.00").
 *
 * Pyth Hermes is a mainnet feed; the SOL/USD market price is the same number
 * regardless of which Solana cluster the console is configured against, so we
 * always hit the mainnet feed for USD display purposes.
 */

const SOL_USD_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const PYTH_HERMES_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_USD_PRICE_FEED_ID}`;
const CACHE_KEY = "omegax.solUsdPrice.v1";
const CACHE_TTL_MS = 60_000;

type CachedPrice = {
  price: number;
  ts: number;
};

type UseSolUsdPriceResult = {
  price: number | null;
  loading: boolean;
  error: string | null;
};

// Module-scope in-flight fetch shared by every concurrent useSolUsdPrice
// caller, so a workbench rendering 30 <Amount> components fires exactly one
// network request, not 30. The promise is cleared once it resolves so the
// next 60s-cache miss starts a fresh fetch.
let inflightFetch: Promise<number> | null = null;

async function fetchSolUsdPrice(): Promise<number> {
  if (inflightFetch) return inflightFetch;
  inflightFetch = (async () => {
    try {
      const response = await fetch(PYTH_HERMES_URL);
      if (!response.ok) throw new Error(`Pyth Hermes returned HTTP ${response.status}`);
      const payload = (await response.json()) as PythLatestPriceResponse;
      const parsed = payload?.parsed?.[0]?.price;
      if (!parsed) throw new Error("Malformed Pyth response: missing parsed.price");
      const value = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Invalid price value from Pyth");
      }
      writeCache({ price: value, ts: Date.now() });
      return value;
    } finally {
      inflightFetch = null;
    }
  })();
  return inflightFetch;
}

export function useSolUsdPrice(): UseSolUsdPriceResult {
  const [price, setPrice] = useState<number | null>(() => readFreshCache()?.price ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = readFreshCache();
    if (cached) {
      setPrice(cached.price);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const value = await fetchSolUsdPrice();
        if (cancelled) return;
        setPrice(value);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "SOL price fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { price, loading, error };
}

type PythLatestPriceResponse = {
  parsed?: Array<{
    id?: string;
    price?: {
      price?: string | number;
      expo?: string | number;
    };
  }>;
};

function readCache(): CachedPrice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPrice;
    if (
      typeof parsed?.price !== "number" ||
      typeof parsed?.ts !== "number" ||
      !Number.isFinite(parsed.price) ||
      !Number.isFinite(parsed.ts)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readFreshCache(): CachedPrice | null {
  const cached = readCache();
  if (!cached) return null;
  return Date.now() - cached.ts < CACHE_TTL_MS ? cached : null;
}

function writeCache(cached: CachedPrice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Storage may be disabled (private browsing, quota exceeded). The price
    // hook degrades gracefully to in-memory state for the session.
  }
}
