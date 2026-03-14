// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import bs58 from "bs58";
import Script from "next/script";
import { useWallet } from "@solana/wallet-adapter-react";

type FaucetResponse = {
  walletAddress: string;
  mint: string;
  amountRaw: string;
  tokenAccount: string;
  txSignature: string;
  txExplorerUrl: string;
  cooldownSeconds: number;
};

type TurnstileRenderResult = string | number;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => TurnstileRenderResult;
  reset: (widgetId?: TurnstileRenderResult) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return fallback;
}

function shortAddress(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
}

export function FaucetPanel() {
  const { connected, publicKey, signMessage } = useWallet();
  const walletAddress = publicKey?.toBase58() || "";

  const faucetEnabled = parseBool(process.env.NEXT_PUBLIC_FAUCET_ENABLED, false);
  const explorerCluster = String(process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER || "devnet").trim() || "devnet";
  const turnstileSiteKey = String(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim();
  const turnstileEnabled = turnstileSiteKey.length > 0;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<FaucetResponse | null>(null);
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false);
  const [turnstileLoadFailed, setTurnstileLoadFailed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<TurnstileRenderResult | null>(null);

  const disabledReason = useMemo(() => {
    if (!faucetEnabled) return "Faucet is currently disabled by configuration.";
    if (!connected || !publicKey) return "Connect your wallet to request devnet tokens.";
    if (!signMessage) return "Active wallet does not support message signing.";
    if (turnstileEnabled && turnstileLoadFailed) return "Captcha failed to load. Refresh and try again.";
    if (turnstileEnabled && !turnstileScriptReady) return "Captcha is loading...";
    if (turnstileEnabled && !captchaToken) return "Complete captcha verification to request tokens.";
    return "";
  }, [captchaToken, connected, faucetEnabled, publicKey, signMessage, turnstileEnabled, turnstileLoadFailed, turnstileScriptReady]);

  const canSubmit = !disabledReason && !busy;

  const resetTurnstile = useCallback(() => {
    setCaptchaToken("");
    if (turnstileWidgetIdRef.current !== null) {
      window.turnstile?.reset(turnstileWidgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!turnstileEnabled) {
      return;
    }
    if (!turnstileScriptReady || !turnstileContainerRef.current) {
      return;
    }
    if (!window.turnstile || turnstileWidgetIdRef.current !== null) {
      return;
    }

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        setCaptchaToken(token);
      },
      "expired-callback": () => {
        setCaptchaToken("");
      },
      "error-callback": () => {
        setCaptchaToken("");
      },
      theme: "auto",
    });
  }, [turnstileEnabled, turnstileScriptReady, turnstileSiteKey]);

  useEffect(() => {
    return () => {
      if (turnstileWidgetIdRef.current !== null) {
        window.turnstile?.reset(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, []);

  async function claim() {
    if (!publicKey || !signMessage) return;
    if (turnstileEnabled && !captchaToken) {
      setError("Complete captcha verification before requesting tokens.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess(null);

    try {
      const challengeResponse = await fetch(`/api/faucet/challenge?walletAddress=${encodeURIComponent(walletAddress)}`, {
        method: "GET",
        cache: "no-store",
      });
      const challengeBody = await challengeResponse.json();
      if (!challengeResponse.ok) {
        throw new Error(String(challengeBody?.error || "Failed to create faucet challenge."));
      }

      const message = String(challengeBody?.message || "").trim();
      if (!message) {
        throw new Error("Challenge payload is missing message.");
      }

      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const signatureBase58 = bs58.encode(signatureBytes);

      const requestResponse = await fetch("/api/faucet/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          signatureBase58,
          captchaToken: captchaToken || "bypassed",
        }),
      });
      const requestBody = await requestResponse.json();
      if (!requestResponse.ok) {
        const retryAfter = Number(requestBody?.retryAfterSeconds || 0);
        if (requestBody?.code === "faucet_cooldown" && retryAfter > 0) {
          throw new Error(`Faucet cooldown active. Try again in ${formatSeconds(retryAfter)}.`);
        }
        if (requestBody?.code === "faucet_daily_limit" && retryAfter > 0) {
          throw new Error(`Daily limit reached. Try again in ${formatSeconds(retryAfter)}.`);
        }
        throw new Error(String(requestBody?.error || "Faucet request failed."));
      }

      setSuccess(requestBody as FaucetResponse);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : String(claimError));
    } finally {
      if (turnstileEnabled) {
        resetTurnstile();
      }
      setBusy(false);
    }
  }

  return (
    <section className="surface-card space-y-4">
      {turnstileEnabled ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => {
            setTurnstileScriptReady(true);
            setTurnstileLoadFailed(false);
          }}
          onError={() => {
            setTurnstileLoadFailed(true);
            setTurnstileScriptReady(false);
          }}
        />
      ) : null}

      <div className="flex flex-col items-center justify-center space-y-4 py-4 text-center">
        <div className="space-y-1">
          <p className="metric-label uppercase tracking-wider text-[var(--accent)]">Devnet Faucet</p>
          <p className="hero-copy mt-0 text-lg font-medium">
            Get OMEGAX tokens for governance testing.
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Network: <span className="font-mono">{explorerCluster}</span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className="action-button px-8 py-3 text-base shadow-lg shadow-[color:color-mix(in_oklab,var(--accent)_20%,transparent)]"
            disabled={!canSubmit}
            onClick={() => void claim()}
          >
            {busy ? "Requesting Tokens..." : "Request 10,000 OMEGAX Tokens"}
          </button>
          {disabledReason ? (
            <p className="text-xs text-[var(--muted-foreground)]">{disabledReason}</p>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)]">
              Sign a quick wallet message to verify ownership.
            </p>
          )}
          {turnstileEnabled ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div ref={turnstileContainerRef} />
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Complete captcha to prove you are human.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="status-pill status-error mx-auto w-fit">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="surface-card-soft animate-in fade-in slide-in-from-top-2 duration-300 space-y-3 p-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="status-pill status-ok">Tokens Dispatched</span>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              10,000 OMEGAX have been sent to your wallet.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <a
              className="secondary-button text-xs"
              href={success.txExplorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on Explorer
            </a>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              Tx: {shortAddress(success.txSignature)}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
