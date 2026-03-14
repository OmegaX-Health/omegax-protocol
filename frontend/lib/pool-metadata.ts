// SPDX-License-Identifier: AGPL-3.0-or-later

type PoolMetadataRecord = Record<string, unknown>;

export type PoolMetadataFetchErrorCode =
  | "invalid_uri"
  | "unsupported_protocol"
  | "fetch_failed"
  | "http_error"
  | "non_json_content_type"
  | "invalid_json";

export type PoolMetadataFetchError = {
  code: PoolMetadataFetchErrorCode;
  message: string;
  status?: number;
  contentType?: string;
};

export type PoolMetadataFetchResult = {
  metadata: unknown | null;
  error: PoolMetadataFetchError | null;
};

export type PoolDefiMetadataParseErrorCode =
  | "invalid_metadata"
  | "invalid_schema"
  | "invalid_version"
  | "invalid_apy_bps"
  | "invalid_apy_window_days"
  | "invalid_apy_as_of_ts"
  | "invalid_apy_methodology_uri";

export type PoolDefiMetadataParseError = {
  code: PoolDefiMetadataParseErrorCode;
  message: string;
};

export type ParsedPoolDefiMetadata = {
  apyBps: number;
  windowDays: number;
  asOfTs: number | null;
  methodologyUri: string | null;
};

export type PoolDefiMetadataParseResult = {
  defi: ParsedPoolDefiMetadata | null;
  error: PoolDefiMetadataParseError | null;
};

const METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_IPFS_GATEWAY_BASES = [
  "https://ipfs.io/ipfs",
  "https://gateway.pinata.cloud/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://dweb.link/ipfs",
];

const metadataCache = new Map<string, { expiresAt: number; value: PoolMetadataFetchResult }>();
const inflightFetches = new Map<string, Promise<PoolMetadataFetchResult>>();

function asRecord(value: unknown): PoolMetadataRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as PoolMetadataRecord;
}

function normalize(value: string): string {
  return value.trim();
}

function splitGatewayBases(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((entry) => normalize(entry).replace(/\/+$/, ""))
    .filter(Boolean);
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = value.trim().replace(/\/+$/, "");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
  }
  return next;
}

function parseIpfsUri(uri: string): string[] {
  const trimmed = normalize(uri);
  if (!trimmed.toLowerCase().startsWith("ipfs://")) return [];
  const withoutScheme = trimmed.slice("ipfs://".length).replace(/^\/+/, "");
  if (!withoutScheme) return [];
  const cidPath = withoutScheme.toLowerCase().startsWith("ipfs/")
    ? withoutScheme.slice("ipfs/".length)
    : withoutScheme;
  const sanitized = cidPath.replace(/^\/+/, "");
  if (!sanitized) return [];

  const configured = splitGatewayBases(process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE || "");
  const gatewayBases = dedupe(
    configured.length > 0 ? [...configured, ...DEFAULT_IPFS_GATEWAY_BASES] : DEFAULT_IPFS_GATEWAY_BASES,
  );
  return gatewayBases.map((gatewayBase) => `${gatewayBase}/${sanitized}`);
}

function resolveMetadataFetchUrl(metadataUri: string): { urls: string[]; error: PoolMetadataFetchError | null } {
  const uri = normalize(metadataUri);
  if (!uri) {
    return {
      urls: [],
      error: {
        code: "invalid_uri",
        message: "Pool metadata URI is missing or empty.",
      },
    };
  }

  const ipfsResolved = parseIpfsUri(uri);
  if (ipfsResolved.length > 0) {
    return { urls: ipfsResolved, error: null };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(uri);
  } catch {
    return {
      urls: [],
      error: {
        code: "invalid_uri",
        message: "Pool metadata URI is invalid.",
      },
    };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return {
      urls: [],
      error: {
        code: "unsupported_protocol",
        message: `Unsupported pool metadata URI protocol: ${parsedUrl.protocol}`,
      },
    };
  }

  return { urls: [parsedUrl.toString()], error: null };
}

async function fetchMetadataFromUrl(url: string): Promise<PoolMetadataFetchResult> {
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return {
        metadata: null,
        error: {
          code: "http_error",
          message: `Pool metadata request failed with HTTP ${response.status}.`,
          status: response.status,
        },
      };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("+json")) {
      return {
        metadata: null,
        error: {
          code: "non_json_content_type",
          message: `Pool metadata endpoint returned non-JSON content type: ${contentType || "unknown"}.`,
          status: response.status,
          contentType,
        },
      };
    }

    try {
      return {
        metadata: await response.json(),
        error: null,
      };
    } catch {
      return {
        metadata: null,
        error: {
          code: "invalid_json",
          message: "Pool metadata response body is not valid JSON.",
          status: response.status,
          contentType,
        },
      };
    }
  } catch {
    return {
      metadata: null,
      error: {
        code: "fetch_failed",
        message: "Pool metadata request failed due to network or CORS restrictions.",
      },
    };
  }
}

async function fetchPoolMetadataDirect(metadataUri: string): Promise<PoolMetadataFetchResult> {
  const resolved = resolveMetadataFetchUrl(metadataUri);
  if (resolved.error) {
    return { metadata: null, error: resolved.error };
  }

  let lastError: PoolMetadataFetchError | null = null;
  for (const url of resolved.urls) {
    const result = await fetchMetadataFromUrl(url);
    if (!result.error) return result;
    lastError = result.error;
  }
  return {
    metadata: null,
    error: lastError ?? {
      code: "fetch_failed",
      message: "Pool metadata request failed.",
    },
  };
}

export async function fetchPoolMetadata(metadataUri: string): Promise<PoolMetadataFetchResult> {
  const key = normalize(metadataUri);
  if (!key) {
    return {
      metadata: null,
      error: {
        code: "invalid_uri",
        message: "Pool metadata URI is missing or empty.",
      },
    };
  }

  const now = Date.now();
  const cached = metadataCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const pending = inflightFetches.get(key);
  if (pending) {
    return pending;
  }

  const request = fetchPoolMetadataDirect(key).then((result) => {
    metadataCache.set(key, { expiresAt: Date.now() + METADATA_CACHE_TTL_MS, value: result });
    inflightFetches.delete(key);
    return result;
  });

  inflightFetches.set(key, request);
  return request;
}

function asSafeInteger(
  value: unknown,
  errorCode: PoolDefiMetadataParseErrorCode,
  fieldLabel: string,
): { value: number; error: PoolDefiMetadataParseError | null } {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      value: 0,
      error: {
        code: errorCode,
        message: `${fieldLabel} must be a finite integer.`,
      },
    };
  }
  return { value, error: null };
}

function validateMethodologyUri(value: string): boolean {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (normalized.toLowerCase().startsWith("ipfs://")) {
    return normalized.length > "ipfs://".length;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function parsePoolDefiMetadata(metadata: unknown): PoolDefiMetadataParseResult {
  const root = asRecord(metadata);
  if (!root) {
    return {
      defi: null,
      error: {
        code: "invalid_metadata",
        message: "Pool metadata JSON must be an object.",
      },
    };
  }

  if (root.schema != null && root.schema !== "omegax.pool") {
    return {
      defi: null,
      error: {
        code: "invalid_schema",
        message: "Pool metadata schema must be \"omegax.pool\" when provided.",
      },
    };
  }

  if (root.version != null && root.version !== 1) {
    return {
      defi: null,
      error: {
        code: "invalid_version",
        message: "Pool metadata version must be 1 when provided.",
      },
    };
  }

  const defi = asRecord(root.defi);
  if (!defi || defi.apyBps == null) {
    return { defi: null, error: null };
  }

  const apyBpsParsed = asSafeInteger(defi.apyBps, "invalid_apy_bps", "defi.apyBps");
  if (apyBpsParsed.error) return { defi: null, error: apyBpsParsed.error };
  if (apyBpsParsed.value < 0 || apyBpsParsed.value > 1_000_000) {
    return {
      defi: null,
      error: {
        code: "invalid_apy_bps",
        message: "defi.apyBps must be between 0 and 1,000,000 bps.",
      },
    };
  }

  let windowDays = DEFAULT_WINDOW_DAYS;
  if (defi.apyWindowDays != null) {
    const parsed = asSafeInteger(defi.apyWindowDays, "invalid_apy_window_days", "defi.apyWindowDays");
    if (parsed.error) return { defi: null, error: parsed.error };
    if (parsed.value <= 0 || parsed.value > 3650) {
      return {
        defi: null,
        error: {
          code: "invalid_apy_window_days",
          message: "defi.apyWindowDays must be between 1 and 3650.",
        },
      };
    }
    windowDays = parsed.value;
  }

  let asOfTs: number | null = null;
  if (defi.apyAsOfTs != null) {
    const parsed = asSafeInteger(defi.apyAsOfTs, "invalid_apy_as_of_ts", "defi.apyAsOfTs");
    if (parsed.error) return { defi: null, error: parsed.error };
    if (parsed.value <= 0) {
      return {
        defi: null,
        error: {
          code: "invalid_apy_as_of_ts",
          message: "defi.apyAsOfTs must be greater than zero.",
        },
      };
    }
    asOfTs = parsed.value;
  }

  let methodologyUri: string | null = null;
  if (defi.apyMethodologyUri != null) {
    if (typeof defi.apyMethodologyUri !== "string" || !validateMethodologyUri(defi.apyMethodologyUri)) {
      return {
        defi: null,
        error: {
          code: "invalid_apy_methodology_uri",
          message: "defi.apyMethodologyUri must be a valid http(s) or ipfs:// URI.",
        },
      };
    }
    methodologyUri = normalize(defi.apyMethodologyUri);
  }

  return {
    defi: {
      apyBps: apyBpsParsed.value,
      windowDays,
      asOfTs,
      methodologyUri,
    },
    error: null,
  };
}

export function clearPoolMetadataCache(): void {
  metadataCache.clear();
  inflightFetches.clear();
}
