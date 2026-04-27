// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect } from "react";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RouteError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[omegax-protocol] route error", {
        message: error.message,
        digest: error.digest,
      });
    }
  }, [error]);

  return (
    <div
      className="workbench-panel workbench-primary-surface"
      role="alert"
      aria-live="polite"
      style={{ maxWidth: "36rem" }}
    >
      <div className="workbench-panel-head">
        <div>
          <h1 className="workbench-panel-title">This panel hit an unexpected error.</h1>
        </div>
      </div>
      <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
        Try this section again. If the issue persists, reload the page or check the network
        health view to confirm the configured RPC endpoint is reachable.
      </p>
      {error.digest ? (
        <p
          style={{
            margin: 0,
            color: "var(--muted-foreground)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono)",
          }}
        >
          Reference: {error.digest}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={reset}
          className="wallet-control-button wallet-control-button-connected"
        >
          Try this section again
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          }}
          className="wallet-control-button"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
