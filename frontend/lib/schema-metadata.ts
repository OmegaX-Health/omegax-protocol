// SPDX-License-Identifier: AGPL-3.0-or-later

export type SchemaOutcomeOption = {
  id: string;
  label: string;
  description?: string;
  valueHashHex?: string;
  domain?: string;
  kind?: "metric_threshold";
  metricId?: string;
  metricWindow?: "latest" | "7d" | "14d" | "28d";
  comparator?: ">=" | "<=" | ">" | "<" | "==";
  threshold?: number;
  unit?: string;
  severity?: "primary" | "secondary" | "informational";
  tags?: string[];
  deprecated?: boolean;
  replacedBy?: string;
  evidence?: {
    minSamples?: number | null;
    minDaysCovered?: number | null;
    minQuality?: "ok" | "good" | null;
    requiredProofMetricIds?: string[];
  };
};

export type SchemaOutcomeTemplateOption = {
  id: string;
  label: string;
  description?: string;
  domain?: string;
  kind: "metric_threshold";
  metricId: string;
  metricWindow: "latest" | "7d" | "14d" | "28d";
  unit: string;
  comparators: Array<">=" | "<=" | ">" | "<" | "==">;
  tags?: string[];
  severityDefault?: "primary" | "secondary" | "informational";
  evidenceDefault?: SchemaOutcomeOption["evidence"];
  thresholdPolicy: {
    suggested: number[];
    min: number | null;
    max: number | null;
    step: number | null;
    decimals: number | null;
  };
};

export type SchemaMetadataFetchErrorCode =
  | "invalid_uri"
  | "unsupported_protocol"
  | "fetch_failed"
  | "http_error"
  | "non_json_content_type"
  | "invalid_json";

export type SchemaMetadataFetchError = {
  code: SchemaMetadataFetchErrorCode;
  message: string;
  status?: number;
  contentType?: string;
};

export type SchemaMetadataFetchResult = {
  metadata: unknown | null;
  error: SchemaMetadataFetchError | null;
};

export type ParsedSchemaOutcomes = {
  outcomes: SchemaOutcomeOption[];
  outcomeTemplates: SchemaOutcomeTemplateOption[];
  warnings: string[];
};

const SUPPORTED_SCHEMA_METADATA_VERSIONS = new Set(["omegax.schema", "1", "omegax.schema.v2", "2"]);
const COMPARATORS = new Set([">=", "<=", ">", "<", "=="]);
const METRIC_WINDOWS = new Set(["latest", "7d", "14d", "28d"]);
const SEVERITIES = new Set(["primary", "secondary", "informational"]);
const EVIDENCE_QUALITIES = new Set(["ok", "good"]);
const DEFAULT_IPFS_GATEWAY_BASES = [
  "https://ipfs.io/ipfs",
  "https://gateway.pinata.cloud/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
  "https://dweb.link/ipfs",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalize(value: string): string {
  return value.trim();
}

function isHex32(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim().replace(/^0x/, ""));
}

function splitGatewayBases(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((entry) => normalize(entry).replace(/\/+$/, ""))
    .map((entry) => entry.trim())
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

function parseIpfsGatewayHttpUri(uri: string): string[] {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(uri);
  } catch {
    return [];
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) return [];

  const pathname = parsedUrl.pathname.replace(/^\/+/, "");
  let cidPath = "";
  if (pathname.toLowerCase().startsWith("ipfs/")) {
    cidPath = pathname.slice("ipfs/".length);
  } else {
    const hostParts = parsedUrl.hostname.split(".");
    const ipfsIndex = hostParts.findIndex((part) => part.toLowerCase() === "ipfs");
    if (ipfsIndex > 0) {
      const cid = hostParts[0]?.trim() ?? "";
      const suffixPath = pathname ? `/${pathname}` : "";
      cidPath = `${cid}${suffixPath}`;
    }
  }

  const sanitized = cidPath.replace(/^\/+/, "");
  if (!sanitized) return [];

  const configured = splitGatewayBases(process.env.NEXT_PUBLIC_IPFS_GATEWAY_BASE || "");
  const gatewayBases = dedupe(
    configured.length > 0 ? [...configured, ...DEFAULT_IPFS_GATEWAY_BASES] : DEFAULT_IPFS_GATEWAY_BASES,
  );
  const suffix = `${sanitized}${parsedUrl.search || ""}${parsedUrl.hash || ""}`;
  return dedupe([parsedUrl.toString(), ...gatewayBases.map((gatewayBase) => `${gatewayBase}/${suffix}`)]);
}

function resolveKnownSchemaMirrorUrls(uri: URL): string[] {
  const host = uri.hostname.toLowerCase();
  const path = uri.pathname || "";
  if ((host === "omegax.health" || host === "www.omegax.health") && path.toLowerCase().startsWith("/schemas/")) {
    const mirror = new URL(uri.toString());
    mirror.hostname = "protocol.omegax.health";
    return dedupe([uri.toString(), mirror.toString()]);
  }
  return [];
}

function resolveMetadataFetchUrl(metadataUri: string): { urls: string[]; error: SchemaMetadataFetchError | null } {
  const uri = normalize(metadataUri);
  if (!uri) {
    return {
      urls: [],
      error: {
        code: "invalid_uri",
        message: "Schema metadata URI is missing or empty.",
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
        message: "Schema metadata URI is invalid.",
      },
    };
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return {
      urls: [],
      error: {
        code: "unsupported_protocol",
        message: `Unsupported schema metadata URI protocol: ${parsedUrl.protocol}`,
      },
    };
  }

  const ipfsGatewayResolved = parseIpfsGatewayHttpUri(parsedUrl.toString());
  if (ipfsGatewayResolved.length > 0) {
    return { urls: ipfsGatewayResolved, error: null };
  }

  const knownMirrors = resolveKnownSchemaMirrorUrls(parsedUrl);
  if (knownMirrors.length > 0) {
    return { urls: knownMirrors, error: null };
  }

  return { urls: [parsedUrl.toString()], error: null };
}

async function fetchMetadataFromUrl(url: string): Promise<SchemaMetadataFetchResult> {
  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    if (!response.ok) {
      return {
        metadata: null,
        error: {
          code: "http_error",
          message: `Schema metadata request failed with HTTP ${response.status}.`,
          status: response.status,
        },
      };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const hasJsonContentType = contentType.includes("application/json") || contentType.includes("+json");
    const body = await response.text();

    try {
      return {
        metadata: JSON.parse(body) as unknown,
        error: null,
      };
    } catch {
      if (!hasJsonContentType) {
        return {
          metadata: null,
          error: {
            code: "non_json_content_type",
            message: `Schema metadata endpoint returned non-JSON content type: ${contentType || "unknown"}.`,
            status: response.status,
            contentType,
          },
        };
      }
      return {
        metadata: null,
        error: {
          code: "invalid_json",
          message: "Schema metadata response body is not valid JSON.",
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
        message: "Schema metadata request failed before receiving a response.",
      },
    };
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalize(entry))
    .filter(Boolean);
}

function parseEvidence(
  value: unknown,
): { evidence: SchemaOutcomeOption["evidence"] | undefined; warnings: string[] } {
  const warnings: string[] = [];
  const record = asRecord(value);
  if (!record) {
    return { evidence: undefined, warnings };
  }

  const requiredProofMetricIds = asStringArray(record.requiredProofMetricIds);
  const minSamplesRaw = record.minSamples;
  const minDaysCoveredRaw = record.minDaysCovered;
  const minQualityRaw = record.minQuality;

  const minSamples =
    minSamplesRaw === null
      ? null
      : typeof minSamplesRaw === "number" && Number.isInteger(minSamplesRaw)
        ? minSamplesRaw
        : undefined;
  const minDaysCovered =
    minDaysCoveredRaw === null
      ? null
      : typeof minDaysCoveredRaw === "number" && Number.isInteger(minDaysCoveredRaw)
        ? minDaysCoveredRaw
        : undefined;
  const minQuality =
    minQualityRaw === null
      ? null
      : typeof minQualityRaw === "string" && EVIDENCE_QUALITIES.has(normalize(minQualityRaw))
        ? (normalize(minQualityRaw) as "ok" | "good")
        : undefined;

  if (minSamplesRaw !== undefined && minSamples === undefined) {
    warnings.push("evidence.minSamples is invalid and was ignored.");
  }
  if (minDaysCoveredRaw !== undefined && minDaysCovered === undefined) {
    warnings.push("evidence.minDaysCovered is invalid and was ignored.");
  }
  if (minQualityRaw !== undefined && minQuality === undefined) {
    warnings.push("evidence.minQuality is invalid and was ignored.");
  }

  const evidence: SchemaOutcomeOption["evidence"] = {};
  if (minSamples !== undefined) evidence.minSamples = minSamples;
  if (minDaysCovered !== undefined) evidence.minDaysCovered = minDaysCovered;
  if (minQuality !== undefined) evidence.minQuality = minQuality;
  if (requiredProofMetricIds.length > 0) {
    evidence.requiredProofMetricIds = requiredProofMetricIds;
  }

  const hasFields =
    evidence.minSamples !== undefined
    || evidence.minDaysCovered !== undefined
    || evidence.minQuality !== undefined
    || (evidence.requiredProofMetricIds?.length ?? 0) > 0;

  return {
    evidence: hasFields ? evidence : undefined,
    warnings,
  };
}

function parseMetricWindow(value: unknown): SchemaOutcomeOption["metricWindow"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normalize(value);
  if (!METRIC_WINDOWS.has(normalized)) return undefined;
  return normalized as SchemaOutcomeOption["metricWindow"];
}

function parseComparator(value: unknown): SchemaOutcomeOption["comparator"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normalize(value);
  if (!COMPARATORS.has(normalized)) return undefined;
  return normalized as SchemaOutcomeOption["comparator"];
}

function parseSeverity(value: unknown): SchemaOutcomeOption["severity"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normalize(value);
  if (!SEVERITIES.has(normalized)) return undefined;
  return normalized as SchemaOutcomeOption["severity"];
}

async function fetchSchemaMetadataDirect(metadataUri: string): Promise<SchemaMetadataFetchResult> {
  const resolved = resolveMetadataFetchUrl(metadataUri);
  if (resolved.error || resolved.urls.length === 0) {
    return { metadata: null, error: resolved.error };
  }

  let lastError: SchemaMetadataFetchError | null = null;
  for (const currentUrl of resolved.urls) {
    const result = await fetchMetadataFromUrl(currentUrl);
    if (!result.error) return result;
    lastError = result.error;
  }

  return {
    metadata: null,
    error:
      lastError
      ?? { code: "fetch_failed", message: "Schema metadata request failed for all candidate endpoints." },
  }
}

export async function fetchSchemaMetadata(metadataUri: string): Promise<SchemaMetadataFetchResult> {
  const uri = normalize(metadataUri);
  if (!uri) {
    return {
      metadata: null,
      error: {
        code: "invalid_uri",
        message: "Schema metadata URI is missing or empty.",
      },
    };
  }

  // In browsers, use a same-origin proxy route to avoid CORS/network ambiguity.
  if (typeof window !== "undefined") {
    try {
      const response = await fetch(`/api/schema-metadata?uri=${encodeURIComponent(uri)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (response.ok) {
        const payload = (await response.json()) as SchemaMetadataFetchResult;
        if (
          payload
          && typeof payload === "object"
          && Object.prototype.hasOwnProperty.call(payload, "metadata")
          && Object.prototype.hasOwnProperty.call(payload, "error")
        ) {
          return payload;
        }
      }
    } catch {
      // Fall through to direct fetch for local/dev resilience.
    }
  }

  return fetchSchemaMetadataDirect(uri);
}

export function parseSchemaOutcomes(metadata: unknown): ParsedSchemaOutcomes {
  const warnings: string[] = [];
  const root = asRecord(metadata);
  if (!root) {
    return {
      outcomes: [],
      outcomeTemplates: [],
      warnings: ["Schema metadata is missing or invalid JSON."],
    };
  }

  const rawVersion = root.specVersion ?? root.version;
  const version =
    typeof rawVersion === "string"
      ? normalize(rawVersion)
      : typeof rawVersion === "number"
        ? String(rawVersion)
        : "";
  if (!SUPPORTED_SCHEMA_METADATA_VERSIONS.has(version)) {
    warnings.push(
      `Unsupported schema metadata version${version ? ` (${version})` : ""}. Expected one of: ${Array.from(
        SUPPORTED_SCHEMA_METADATA_VERSIONS,
      ).join(", ")}.`,
    );
  }

  const rawOutcomes = root.outcomes;
  const rawTemplates = root.outcomeTemplates;
  if (!Array.isArray(rawOutcomes)) {
    warnings.push("Schema metadata does not define an outcomes array.");
    return { outcomes: [], outcomeTemplates: [], warnings };
  }

  const outcomes: SchemaOutcomeOption[] = [];
  const seenIds = new Set<string>();

  for (const entry of rawOutcomes) {
    const outcome = asRecord(entry);
    if (!outcome) continue;

    const id = typeof outcome.id === "string" ? normalize(outcome.id) : "";
    const label = typeof outcome.label === "string" ? normalize(outcome.label) : "";
    if (!id || !label || seenIds.has(id)) {
      continue;
    }

    const next: SchemaOutcomeOption = { id, label };

    if (typeof outcome.description === "string" && normalize(outcome.description)) {
      next.description = normalize(outcome.description);
    }
    if (typeof outcome.domain === "string" && normalize(outcome.domain)) {
      next.domain = normalize(outcome.domain);
    }
    if (typeof outcome.kind === "string" && normalize(outcome.kind) === "metric_threshold") {
      next.kind = "metric_threshold";
    } else if (outcome.kind !== undefined) {
      warnings.push(`Outcome "${id}" has unsupported kind; ignoring it.`);
    }
    if (typeof outcome.metricId === "string" && normalize(outcome.metricId)) {
      next.metricId = normalize(outcome.metricId);
    }
    const metricWindow = parseMetricWindow(outcome.metricWindow);
    if (metricWindow) {
      next.metricWindow = metricWindow;
    } else if (outcome.metricWindow !== undefined) {
      warnings.push(`Outcome "${id}" has unsupported metricWindow; ignoring it.`);
    }
    const comparator = parseComparator(outcome.comparator);
    if (comparator) {
      next.comparator = comparator;
    } else if (outcome.comparator !== undefined) {
      warnings.push(`Outcome "${id}" has unsupported comparator; ignoring it.`);
    }
    const threshold = asNumber(outcome.threshold);
    if (threshold !== null) {
      next.threshold = threshold;
    } else if (outcome.threshold !== undefined) {
      warnings.push(`Outcome "${id}" has invalid threshold; ignoring it.`);
    }
    if (typeof outcome.unit === "string" && normalize(outcome.unit)) {
      next.unit = normalize(outcome.unit);
    }
    const severity = parseSeverity(outcome.severity);
    if (severity) {
      next.severity = severity;
    } else if (outcome.severity !== undefined) {
      warnings.push(`Outcome "${id}" has unsupported severity; ignoring it.`);
    }
    const tags = asStringArray(outcome.tags);
    if (tags.length > 0) {
      next.tags = Array.from(new Set(tags));
    }
    if (typeof outcome.deprecated === "boolean") {
      next.deprecated = outcome.deprecated;
    }
    if (typeof outcome.replacedBy === "string" && normalize(outcome.replacedBy)) {
      next.replacedBy = normalize(outcome.replacedBy);
    }
    const parsedEvidence = parseEvidence(outcome.evidence);
    if (parsedEvidence.evidence) {
      next.evidence = parsedEvidence.evidence;
    }
    for (const evidenceWarning of parsedEvidence.warnings) {
      warnings.push(`Outcome "${id}" ${evidenceWarning}`);
    }

    if (typeof outcome.valueHashHex === "string" && normalize(outcome.valueHashHex)) {
      const normalized = normalize(outcome.valueHashHex).replace(/^0x/, "").toLowerCase();
      if (isHex32(normalized)) {
        next.valueHashHex = normalized;
      } else {
        warnings.push(`Outcome \"${id}\" has invalid valueHashHex; ignoring it.`);
      }
    }

    seenIds.add(id);
    outcomes.push(next);
  }

  if (outcomes.length === 0) {
    warnings.push("No valid outcomes were found in schema metadata.");
  }

  const outcomeTemplates: SchemaOutcomeTemplateOption[] = [];
  const seenTemplateIds = new Set<string>();

  if (Array.isArray(rawTemplates)) {
    for (const entry of rawTemplates) {
      const template = asRecord(entry);
      if (!template) continue;

      const id = typeof template.id === "string" ? normalize(template.id) : "";
      const label = typeof template.label === "string" ? normalize(template.label) : "";
      if (!id || !label || seenTemplateIds.has(id)) continue;

      const kind = typeof template.kind === "string" ? normalize(template.kind) : "";
      if (kind !== "metric_threshold") {
        warnings.push(`Outcome template "${id}" has unsupported kind; skipping template.`);
        continue;
      }

      const metricId = typeof template.metricId === "string" ? normalize(template.metricId) : "";
      const unit = typeof template.unit === "string" ? normalize(template.unit) : "";
      const metricWindow = parseMetricWindow(template.metricWindow);
      const comparatorsRaw = Array.isArray(template.comparators) ? template.comparators : [];
      const comparators = Array.from(new Set(
        comparatorsRaw
          .filter((value): value is string => typeof value === "string")
          .map((value) => normalize(value))
          .filter((value) => COMPARATORS.has(value)),
      )) as SchemaOutcomeTemplateOption["comparators"];
      const thresholdPolicy = asRecord(template.thresholdPolicy);
      const suggested = Array.isArray(thresholdPolicy?.suggested)
        ? thresholdPolicy.suggested
          .map((value) => asNumber(value))
          .filter((value): value is number => value !== null)
        : [];
      const min = thresholdPolicy?.min === null ? null : asNumber(thresholdPolicy?.min) ?? null;
      const max = thresholdPolicy?.max === null ? null : asNumber(thresholdPolicy?.max) ?? null;
      const step = thresholdPolicy?.step === null ? null : asNumber(thresholdPolicy?.step) ?? null;
      const decimals = thresholdPolicy?.decimals === null
        ? null
        : (typeof thresholdPolicy?.decimals === "number" && Number.isInteger(thresholdPolicy.decimals)
          ? thresholdPolicy.decimals
          : null);

      if (!metricId || !unit || !metricWindow || comparators.length === 0) {
        warnings.push(`Outcome template "${id}" is missing required fields; skipping template.`);
        continue;
      }

      if (!thresholdPolicy || suggested.length === 0) {
        warnings.push(`Outcome template "${id}" has invalid thresholdPolicy.suggested; skipping template.`);
        continue;
      }

      const nextTemplate: SchemaOutcomeTemplateOption = {
        id,
        label,
        kind: "metric_threshold",
        metricId,
        metricWindow,
        unit,
        comparators,
        thresholdPolicy: {
          suggested,
          min,
          max,
          step,
          decimals,
        },
      };

      if (typeof template.description === "string" && normalize(template.description)) {
        nextTemplate.description = normalize(template.description);
      }
      if (typeof template.domain === "string" && normalize(template.domain)) {
        nextTemplate.domain = normalize(template.domain);
      }
      const tags = asStringArray(template.tags);
      if (tags.length > 0) {
        nextTemplate.tags = Array.from(new Set(tags));
      }
      const severityDefault = parseSeverity(template.severityDefault);
      if (severityDefault) {
        nextTemplate.severityDefault = severityDefault;
      } else if (template.severityDefault !== undefined) {
        warnings.push(`Outcome template "${id}" has invalid severityDefault; ignoring it.`);
      }
      const evidenceDefaultParsed = parseEvidence(template.evidenceDefault);
      if (evidenceDefaultParsed.evidence) {
        nextTemplate.evidenceDefault = evidenceDefaultParsed.evidence;
      }
      for (const evidenceWarning of evidenceDefaultParsed.warnings) {
        warnings.push(`Outcome template "${id}" ${evidenceWarning}`);
      }

      outcomeTemplates.push(nextTemplate);
      seenTemplateIds.add(id);
    }
  } else if (rawTemplates !== undefined) {
    warnings.push("Schema metadata outcomeTemplates is present but not an array.");
  }

  return { outcomes, outcomeTemplates, warnings };
}
