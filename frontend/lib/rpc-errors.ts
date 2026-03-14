// SPDX-License-Identifier: AGPL-3.0-or-later

type RpcErrorFormatOptions = {
  fallback?: string;
  rpcEndpoint?: string;
};

const RATE_LIMIT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b429\b/i,
  /too many requests/i,
  /\brate[-\s]?limit(?:ed|ing)?\b/i,
  /\bthrottl(?:e|ed|ing)\b/i,
  /\bquota(?:\s+exceeded)?\b/i,
];

const RETRY_AFTER_KEYS = new Set([
  "retryafter",
  "retry_after",
  "retry-after",
  "retryafterseconds",
  "retry_after_seconds",
  "retry-after-seconds",
  "retryafterms",
  "retry_after_ms",
  "retry-after-ms",
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asPositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function toErrorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) {
    return normalizeWhitespace(cause.message);
  }
  if (typeof cause === "string") {
    return normalizeWhitespace(cause);
  }
  if (cause == null) return "";
  try {
    return normalizeWhitespace(JSON.stringify(cause));
  } catch {
    return normalizeWhitespace(String(cause));
  }
}

function retryAfterFromMessage(message: string): number | null {
  const normalized = normalizeWhitespace(message);
  if (!normalized) return null;

  const headerStyle = normalized.match(/retry-after[:=]\s*(\d+(?:\.\d+)?)/i);
  if (headerStyle) {
    return Number.parseFloat(headerStyle[1]!);
  }

  const phraseStyle = normalized.match(
    /(?:retry[-\s]?after|retry in|try again in)[^0-9]*(\d+(?:\.\d+)?)\s*(ms|msec|milliseconds|s|sec|secs|seconds|m|min|mins|minutes)?/i,
  );
  if (!phraseStyle) return null;

  const amount = Number.parseFloat(phraseStyle[1]!);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = phraseStyle[2]?.toLowerCase() ?? "s";
  if (unit.startsWith("ms")) return amount / 1000;
  if (unit.startsWith("m") && unit !== "ms" && unit !== "msec" && unit !== "milliseconds") return amount * 60;
  return amount;
}

function retryAfterFromCause(cause: unknown, depth = 0): number | null {
  if (depth > 4 || cause == null) return null;

  const direct = asPositiveNumber(cause);
  if (direct) return direct;

  if (Array.isArray(cause)) {
    for (const entry of cause) {
      const nested = retryAfterFromCause(entry, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  const record = asRecord(cause);
  if (!record) return null;

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, "");
    if (!RETRY_AFTER_KEYS.has(normalizedKey)) continue;
    const parsed = asPositiveNumber(value);
    if (!parsed) continue;
    if (normalizedKey.includes("ms")) return parsed / 1000;
    return parsed;
  }

  const nestedKeys = ["data", "details", "error", "cause", "response", "headers"];
  for (const key of nestedKeys) {
    if (!(key in record)) continue;
    const nested = retryAfterFromCause(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function formatRetryDelay(seconds: number): string {
  const rounded = Math.max(1, Math.ceil(seconds));
  if (rounded < 60) {
    return `${rounded} second${rounded === 1 ? "" : "s"}`;
  }
  const minutes = Math.ceil(rounded / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function rpcEndpointLabel(endpoint?: string): string | null {
  const normalized = (endpoint ?? "").trim();
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return parsed.host || normalized;
  } catch {
    return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
  }
}

export function isRpcRateLimitError(cause: unknown): boolean {
  const message = toErrorMessage(cause);
  return RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(message));
}

export function formatRpcError(cause: unknown, options: RpcErrorFormatOptions = {}): string {
  if (!isRpcRateLimitError(cause)) {
    const message = toErrorMessage(cause);
    return message || options.fallback || "RPC request failed. Please retry.";
  }

  const retryAfterSeconds = retryAfterFromCause(cause) ?? retryAfterFromMessage(toErrorMessage(cause));
  const endpoint = rpcEndpointLabel(options.rpcEndpoint);
  const retryHint = retryAfterSeconds
    ? `Please retry in about ${formatRetryDelay(retryAfterSeconds)}.`
    : "Please retry in a few moments.";
  const endpointHint = endpoint ? ` Endpoint: ${endpoint}.` : "";
  return `RPC endpoint is rate-limiting requests. ${retryHint}${endpointHint} If this persists, switch to another RPC endpoint.`;
}
