// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Provider-agnostic error reporting wrapper. Today this is a no-op that just
// logs to the console — the same behavior the route error boundaries had
// before. A real provider (Sentry, Highlight, Datadog RUM, etc.) is wired in
// here, behind the same `reportError` call sites, when the launch operations
// team picks one. Until then, this gives error boundaries a single seam so
// flipping providers does not require touching every boundary.

export type ErrorContext = {
  scope?: string;
  digest?: string | null;
  extras?: Record<string, unknown>;
};

export function reportError(error: unknown, context: ErrorContext = {}): void {
  if (typeof console === "undefined") return;
  const payload: Record<string, unknown> = {
    scope: context.scope ?? "unknown",
    message: error instanceof Error ? error.message : String(error),
  };
  if (context.digest) payload.digest = context.digest;
  if (context.extras) Object.assign(payload, context.extras);
  if (error instanceof Error && error.stack) payload.stack = error.stack;
  console.error("[omegax-protocol] reportError", payload);

  // TODO(launch-ops): once a provider is selected, forward `error` and
  // `payload` here. Keep the console.error above so on-page debugging during
  // local development continues to work without DSN.
}
