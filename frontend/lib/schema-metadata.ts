// SPDX-License-Identifier: AGPL-3.0-or-later

import genesisProtectAcuteClaimV1 from "../public/schemas/genesis-protect-acute-claim-v1.json";
import healthOutcomes from "../public/schemas/health_outcomes.json";
import standardHealthOutcomesV1 from "../public/schemas/omegax-standard-health-outcomes-v1.json";
import standardHealthOutcomesV2 from "../public/schemas/omegax-standard-health-outcomes-v2.json";

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
  | "unsupported_host"
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
const LOCAL_SCHEMA_METADATA_BY_PATH: Record<string, unknown> = {
  "/schemas/genesis-protect-acute-claim-v1.json": genesisProtectAcuteClaimV1,
  "/schemas/health_outcomes.json": healthOutcomes,
  "/schemas/omegax-standard-health-outcomes-v1.json": standardHealthOutcomesV1,
  "/schemas/omegax-standard-health-outcomes-v2.json": standardHealthOutcomesV2,
  "/schemas/standard-health-outcomes-v1.json": standardHealthOutcomesV1,
  "/schemas/standard-health-outcomes-v2.json": standardHealthOutcomesV2,
};

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

function localSchemaPathFromMetadataUri(metadataUri: string): string | null {
  const uri = normalize(metadataUri);
  if (!uri) return null;

  let parsed: URL;
  try {
    parsed = uri.startsWith("/")
      ? new URL(uri, "https://protocol.omegax.health")
      : new URL(uri);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "protocol.omegax.health" && host !== "omegax.health" && host !== "www.omegax.health") {
    return null;
  }

  const pathname = parsed.pathname;
  if (!pathname.toLowerCase().startsWith("/schemas/")) return null;
  if (pathname.includes("..") || !/^\/schemas\/[A-Za-z0-9._/-]+$/.test(pathname)) return null;
  return pathname;
}

function bundledSchemaMetadataForUri(metadataUri: string): SchemaMetadataFetchResult | null {
  const schemaPath = localSchemaPathFromMetadataUri(metadataUri);
  if (!schemaPath) return null;
  if (!Object.prototype.hasOwnProperty.call(LOCAL_SCHEMA_METADATA_BY_PATH, schemaPath)) {
    return {
      metadata: null,
      error: {
        code: "invalid_uri",
        message: "Schema metadata URI is not bundled in this console build.",
      },
    };
  }
  return {
    metadata: LOCAL_SCHEMA_METADATA_BY_PATH[schemaPath],
    error: null,
  };
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
  const bundled = bundledSchemaMetadataForUri(metadataUri);
  if (bundled) return bundled;
  return {
    metadata: null,
    error: {
      code: "unsupported_host",
      message: "Server-side schema metadata fetches are limited to bundled OmegaX schemas.",
    },
  };
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
      // Fall through to bundled metadata for local/dev resilience.
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
