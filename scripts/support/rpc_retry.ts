// SPDX-License-Identifier: AGPL-3.0-or-later

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: expected a positive integer.`);
  }
  return parsed;
}

export function isRpcRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b/.test(message) || /too many requests/i.test(message);
}

export async function withRpcRetry<T>(
  label: string,
  fn: () => Promise<T> | T,
  options?: {
    attempts?: number;
    baseDelayMs?: number;
    logPrefix?: string;
  },
): Promise<T> {
  const attempts = options?.attempts ?? parsePositiveIntEnv("RPC_RETRY_ATTEMPTS", 8);
  const baseDelayMs = options?.baseDelayMs ?? parsePositiveIntEnv("RPC_RETRY_BASE_DELAY_MS", 500);
  const logPrefix = options?.logPrefix ?? "rpc";

  let delayMs = baseDelayMs;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (!isRpcRateLimit(error) || attempt >= attempts) {
        throw error;
      }
      console.warn(
        `[${logPrefix}] rpc rate limited during ${label}; retrying in ${delayMs}ms (${attempt}/${attempts})`,
      );
      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  throw new Error(`Unreachable retry state for ${label}.`);
}

export function wrapConnectionWithRpcRetry<T extends object>(
  connection: T,
  options?: {
    attempts?: number;
    baseDelayMs?: number;
    logPrefix?: string;
    labelPrefix?: string;
  },
): T {
  const attempts = options?.attempts ?? parsePositiveIntEnv("RPC_RETRY_ATTEMPTS", 8);
  const baseDelayMs = options?.baseDelayMs ?? parsePositiveIntEnv("RPC_RETRY_BASE_DELAY_MS", 500);
  const logPrefix = options?.logPrefix ?? "rpc";
  const labelPrefix = options?.labelPrefix ?? "rpc";

  return new Proxy(connection, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => withRpcRetry(
        `${labelPrefix}:${String(prop)}`,
        () => Reflect.apply(value, target, args),
        { attempts, baseDelayMs, logPrefix },
      );
    },
  });
}
