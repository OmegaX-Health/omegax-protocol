// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/error-tracking";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    reportError(error, { scope: "root", digest: error.digest ?? null });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a1525",
          color: "#f0f1f2",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: "1.5rem",
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          style={{
            maxWidth: "32rem",
            background: "rgba(12, 22, 38, 0.92)",
            border: "1px solid rgba(0, 229, 255, 0.24)",
            borderRadius: "1rem",
            padding: "1.75rem",
            boxShadow: "0 28px 64px rgba(0, 0, 0, 0.38)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            The console hit an unexpected error.
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.875rem", lineHeight: 1.5 }}>
            Reload to recover. If the issue persists, the configured RPC endpoint may be
            unreachable.
          </p>
          {error.digest ? (
            <p
              style={{
                margin: 0,
                color: "#94a3b8",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(0, 229, 255, 0.4)",
                background: "rgba(0, 229, 255, 0.14)",
                color: "#00e5ff",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(148, 163, 184, 0.24)",
                background: "transparent",
                color: "#f0f1f2",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
