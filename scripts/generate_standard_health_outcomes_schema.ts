// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type MetricDirection = "higher_is_better" | "lower_is_better" | "neutral";

type MetricDefinition = {
  id: string;
  label: string;
  description: string;
  domain: string;
  kind: string;
  unit: string;
  direction: MetricDirection;
  window: "latest" | "7d" | "14d" | "28d";
  quality?: {
    minSamples?: number;
    minDaysCovered?: number;
  };
};

type MetricRegistry = {
  registryVersion?: string;
  metrics: MetricDefinition[];
};

type GoalCatalog = {
  version?: number;
  goals: Array<{
    id: string;
    mapping?: {
      kpiMetricId?: string;
      driverMetricIds?: string[];
      proofMetricIds?: string[];
    };
    targetDefaults?: Array<{
      metricId?: string;
    }>;
    outcomeSpecDefaults?: Array<{
      id: string;
      metricId: string;
      metricWindow: string;
      comparator: ">=" | "<=" | ">" | "<" | "==";
      threshold: number;
      unit: string;
    }>;
  }>;
};

type Comparator = ">=" | "<=";

type OutcomeRecord = {
  id: string;
  label: string;
  description: string;
  domain: string;
  kind: "metric_threshold";
  metricId: string;
  metricWindow: MetricDefinition["window"];
  comparator: Comparator;
  threshold: number;
  unit: string;
  severity: "primary" | "secondary";
  tags: string[];
  evidence: {
    minSamples: number | null;
    minDaysCovered: number | null;
    minQuality: "ok";
    requiredProofMetricIds: string[];
  };
  valueHashHex: string;
};

type OutcomeTemplateRecord = {
  id: string;
  label: string;
  description: string;
  domain: string;
  kind: "metric_threshold";
  metricId: string;
  metricWindow: MetricDefinition["window"];
  unit: string;
  comparators: Comparator[];
  severityDefault: "primary" | "secondary";
  tags: string[];
  evidenceDefault: {
    minSamples: number | null;
    minDaysCovered: number | null;
    minQuality: "ok";
    requiredProofMetricIds: string[];
  };
  thresholdPolicy: {
    suggested: number[];
    min: number | null;
    max: number | null;
    step: number | null;
    decimals: number | null;
  };
};

type ParsedArgs = {
  schemaKey: string;
  schemaVersion: number;
  metricRegistryPath: string;
  goalCatalogPath: string;
  outputPath: string;
  outputVersionedPath: string;
};

const DEFAULT_METRIC_REGISTRY_PATH = "../omegaxhealth_agent/src/services/metrics/metric_registry_v1.ts";
const DEFAULT_GOAL_CATALOG_PATH = "../omegaxhealth_agent/src/services/goal_catalog.ts";
const DEFAULT_OUTPUT_PATH = "frontend/public/schemas/health_outcomes.json";
const DEFAULT_OUTPUT_VERSIONED_PATH = "frontend/public/schemas/omegax-standard-health-outcomes-v<version>.json";

const PRIMARY_METRICS = new Set([
  "bp_systolic_avg_7d",
  "hba1c_latest",
  "ldl_latest",
  "cgm_mean_glucose_avg_14d",
  "health_alpha_score",
]);

const DEFAULT_LABEL_BY_OUTCOME_ID: Record<string, string> = {
  bp_systolic_control: "Blood Pressure Managed",
  a1c_control: "Diabetes HbA1c Managed",
  wl_steps_on_track: "Sustained Weight Loss Activity",
  sleep_duration_at_least_7h: "Better Sleep & Recovery",
  ldl_control: "LDL Cholesterol Managed",
};

const THRESHOLD_PRESETS: Record<string, number[]> = {
  body_fat_percentage_latest: [30, 25, 20],
  sleep_duration_avg_7d: [360, 420, 480],
  hydration_ml_sum_7d: [10500, 14000, 17500],
  hydration_ml_avg_per_day_7d: [1500, 2000, 2500],
  bp_systolic_avg_7d: [140, 130, 120],
  bp_diastolic_avg_7d: [90, 80, 70],
  hba1c_latest: [7, 6.5, 5.7],
  ldl_latest: [130, 100, 70],
  hdl_latest: [40, 50, 60],
  triglycerides_latest: [200, 150, 100],
  total_cholesterol_latest: [240, 200, 180],
  apob_latest: [120, 90, 70],
  lpa_latest: [50, 30, 20],
  cgm_mean_glucose_avg_14d: [154, 140, 110],
  cgm_time_in_range_pct_14d: [70, 80, 90],
  cgm_time_above_range_pct_14d: [25, 15, 5],
  cgm_time_below_range_pct_14d: [4, 2, 1],
  cgm_glucose_cv_14d: [36, 33, 30],
  gmi_14d: [7, 6.5, 5.7],
  resting_heart_rate_latest: [80, 70, 60],
  resting_heart_rate_avg_7d: [80, 70, 60],
  heart_rate_variability_avg_7d: [20, 30, 50],
  blood_oxygen_avg_7d: [95, 97, 98],
  sleep_sessions_count_14d: [10, 12, 14],
  bp_readings_count_14d: [6, 10, 14],
  workout_sessions_count_7d: [3, 5, 7],
  workout_minutes_sum_7d: [90, 150, 300],
  workout_energy_burned_sum_7d: [500, 1000, 2000],
  active_energy_burned_sum_7d: [1500, 2500, 3500],
  active_energy_burned_avg_per_day_7d: [200, 300, 500],
  distance_meters_sum_7d: [10000, 20000, 40000],
  distance_meters_avg_per_day_7d: [1500, 3000, 6000],
  steps_avg_7d: [5000, 7000, 10000],
  steps_sum_7d: [35000, 49000, 70000],
  weighin_count_14d: [4, 6, 10],
  adherence_7d: [0.6, 0.7, 0.8],
  health_alpha_score: [60, 70, 80],
  mindfulness_minutes_avg_7d: [5, 10, 20],
  mood_rating_avg_7d: [3, 3.5, 4],
  stress_level_avg_7d: [3, 2.5, 2],
  energy_level_avg_7d: [3, 3.5, 4],
  focus_level_avg_7d: [3, 3.5, 4],
  sleep_quality_rating_avg_7d: [3, 3.5, 4],
  data_completeness_14d: [0.6, 0.75, 0.9],
};

const STEP_PRESETS_BY_UNIT: Record<string, { step: number | null; decimals: number | null }> = {
  rating: { step: 0.5, decimals: 1 },
  "%": { step: 0.1, decimals: 1 },
  ratio: { step: 0.05, decimals: 2 },
  "mg/dL": { step: 1, decimals: 0 },
  mmHg: { step: 1, decimals: 0 },
  bpm: { step: 1, decimals: 0 },
  count: { step: 1, decimals: 0 },
  steps: { step: 1, decimals: 0 },
  "steps/day": { step: 1, decimals: 0 },
  ml: { step: 1, decimals: 0 },
  "ml/day": { step: 1, decimals: 0 },
  min: { step: 1, decimals: 0 },
  kcal: { step: 1, decimals: 0 },
  "kcal/day": { step: 1, decimals: 0 },
  m: { step: 1, decimals: 0 },
  "m/day": { step: 1, decimals: 0 },
};

function parseArgs(argv: string[]): ParsedArgs {
  const options: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part?.startsWith("--")) continue;
    const key = part.slice(2);
    options[key] = String(argv[index + 1] || "").trim();
    index += 1;
  }

  const schemaKey = options["schema-key"] || "omegax.standard.health_outcomes";
  const schemaVersionRaw = options["schema-version"] || "1";
  const schemaVersion = Number.parseInt(schemaVersionRaw, 10);
  if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
    throw new Error(`Invalid --schema-version "${schemaVersionRaw}". Expected a positive integer.`);
  }

  const metricRegistryPath = resolve(process.cwd(), options["metric-registry"] || DEFAULT_METRIC_REGISTRY_PATH);
  const goalCatalogPath = resolve(process.cwd(), options["goal-catalog"] || DEFAULT_GOAL_CATALOG_PATH);
  const outputPath = resolve(process.cwd(), options.out || DEFAULT_OUTPUT_PATH);
  const outputVersionedPathTemplate = options["out-versioned"] || DEFAULT_OUTPUT_VERSIONED_PATH;
  const outputVersionedPath = resolve(
    process.cwd(),
    outputVersionedPathTemplate.includes("<version>")
      ? outputVersionedPathTemplate.replace("<version>", String(schemaVersion))
      : outputVersionedPathTemplate,
  );

  return { schemaKey, schemaVersion, metricRegistryPath, goalCatalogPath, outputPath, outputVersionedPath };
}

async function importModule(modulePath: string): Promise<Record<string, unknown>> {
  return import(pathToFileURL(modulePath).href);
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(source[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function normalizeThresholdValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const raw = value.toFixed(6);
  return raw.replace(/\.?0+$/, "");
}

function thresholdToken(value: number): string {
  const prefix = value < 0 ? "m" : "";
  const normalized = normalizeThresholdValue(Math.abs(value)).replace(".", "p");
  return `${prefix}${normalized}`;
}

function comparatorToken(comparator: Comparator): string {
  return comparator === ">=" ? "ge" : "le";
}

function metricDirectionComparator(direction: MetricDirection): Comparator {
  return direction === "higher_is_better" ? ">=" : "<=";
}

function ensureOutcomeId(id: string, usedIds: Set<string>): string {
  const normalized = id.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  const candidate = normalized.length <= 64
    ? normalized
    : `${normalized.slice(0, 55)}_${sha256Hex(normalized).slice(0, 8)}`;
  let next = candidate;
  let counter = 2;
  while (usedIds.has(next)) {
    const suffix = `_${counter}`;
    next = `${candidate.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
    counter += 1;
  }
  usedIds.add(next);
  return next;
}

function metricDisplayLabel(metric: MetricDefinition): string {
  return metric.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function formatThresholdForLabel(threshold: number): string {
  return normalizeThresholdValue(threshold);
}

function buildOutcomeLabel(metric: MetricDefinition, comparator: Comparator, threshold: number): string {
  return `${metricDisplayLabel(metric)} ${comparator} ${formatThresholdForLabel(threshold)} ${metric.unit}`;
}

function buildGoalIndex(goalCatalog: GoalCatalog): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const collect = (metricId?: string, goalId?: string) => {
    if (!metricId || !goalId) return;
    const next = map.get(metricId) || new Set<string>();
    next.add(goalId);
    map.set(metricId, next);
  };

  for (const goal of goalCatalog.goals) {
    collect(goal.mapping?.kpiMetricId, goal.id);
    for (const metricId of goal.mapping?.driverMetricIds || []) {
      collect(metricId, goal.id);
    }
    for (const metricId of goal.mapping?.proofMetricIds || []) {
      collect(metricId, goal.id);
    }
    for (const target of goal.targetDefaults || []) {
      collect(target.metricId, goal.id);
    }
    for (const outcome of goal.outcomeSpecDefaults || []) {
      collect(outcome.metricId, goal.id);
    }
  }

  return map;
}

function buildOutcomeIdOverrideMap(goalCatalog: GoalCatalog): Map<string, string> {
  const map = new Map<string, string>();
  for (const goal of goalCatalog.goals) {
    for (const outcome of goal.outcomeSpecDefaults || []) {
      const threshold = normalizeThresholdValue(outcome.threshold);
      const key = `${outcome.metricId}|${outcome.comparator}|${threshold}`;
      map.set(key, outcome.id);
    }
  }
  return map;
}

function machineDefinitionHash(params: {
  metric: MetricDefinition;
  comparator: Comparator;
  threshold: number;
  evidence: OutcomeRecord["evidence"];
}): string {
  return sha256Hex(stableStringify({
    kind: "metric_threshold",
    metricId: params.metric.id,
    metricWindow: params.metric.window,
    comparator: params.comparator,
    threshold: params.threshold,
    unit: params.metric.unit,
    evidence: params.evidence,
  }));
}

function evidenceDefaults(metric: MetricDefinition): OutcomeRecord["evidence"] {
  return {
    minSamples: Number.isInteger(metric.quality?.minSamples) ? metric.quality?.minSamples ?? null : null,
    minDaysCovered: Number.isInteger(metric.quality?.minDaysCovered) ? metric.quality?.minDaysCovered ?? null : null,
    minQuality: "ok",
    requiredProofMetricIds: [],
  };
}

function templateStepPolicy(unit: string): { step: number | null; decimals: number | null } {
  const preset = STEP_PRESETS_BY_UNIT[unit];
  if (preset) return preset;
  return { step: null, decimals: null };
}

function buildTemplateId(metricId: string, usedIds: Set<string>): string {
  const candidate = `${metricId}_threshold`;
  return ensureOutcomeId(candidate, usedIds);
}

function assertThresholdCoverage(metrics: MetricDefinition[]): void {
  const directionalIds = metrics
    .filter((metric) => metric.direction === "higher_is_better" || metric.direction === "lower_is_better")
    .map((metric) => metric.id);

  const missing = directionalIds.filter((id) => !THRESHOLD_PRESETS[id]);
  if (missing.length > 0) {
    throw new Error(
      `Missing threshold presets for directional metrics: ${missing.join(", ")}`,
    );
  }
}

function sortedUnique(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const metricRegistryModule = await importModule(args.metricRegistryPath);
  const goalCatalogModule = await importModule(args.goalCatalogPath);

  const metricRegistry = metricRegistryModule.METRIC_REGISTRY_V1 as MetricRegistry | undefined;
  const goalCatalog = goalCatalogModule.GOAL_CATALOG_V1 as GoalCatalog | undefined;
  if (!metricRegistry || !Array.isArray(metricRegistry.metrics)) {
    throw new Error(`METRIC_REGISTRY_V1 not found in ${args.metricRegistryPath}`);
  }
  if (!goalCatalog || !Array.isArray(goalCatalog.goals)) {
    throw new Error(`GOAL_CATALOG_V1 not found in ${args.goalCatalogPath}`);
  }

  assertThresholdCoverage(metricRegistry.metrics);
  const goalIndex = buildGoalIndex(goalCatalog);
  const outcomeIdOverrides = buildOutcomeIdOverrideMap(goalCatalog);
  const usedOutcomeIds = new Set<string>();
  const usedTemplateIds = new Set<string>();

  const directionalMetrics = metricRegistry.metrics
    .filter((metric) => metric.direction === "higher_is_better" || metric.direction === "lower_is_better")
    .sort((a, b) => a.id.localeCompare(b.id));

  const outcomes: OutcomeRecord[] = [];
  const templates: OutcomeTemplateRecord[] = [];

  for (const metric of directionalMetrics) {
    const comparator = metricDirectionComparator(metric.direction);
    const suggestedThresholds = THRESHOLD_PRESETS[metric.id] || [];
    const goalsForMetric = sortedUnique(goalIndex.get(metric.id) || []);
    const baseTags = sortedUnique([
      "metric_threshold",
      metric.domain,
      metric.kind,
      ...goalsForMetric.map((goalId) => `goal:${goalId}`),
    ]);

    for (const threshold of suggestedThresholds) {
      const thresholdKey = normalizeThresholdValue(threshold);
      const overrideKey = `${metric.id}|${comparator}|${thresholdKey}`;
      const preferredId = outcomeIdOverrides.get(overrideKey)
        || `${metric.id}_${comparatorToken(comparator)}_${thresholdToken(threshold)}`;
      const id = ensureOutcomeId(preferredId, usedOutcomeIds);
      const label = DEFAULT_LABEL_BY_OUTCOME_ID[id] || buildOutcomeLabel(metric, comparator, threshold);
      const evidence = evidenceDefaults(metric);
      const severity = PRIMARY_METRICS.has(metric.id) ? "primary" : "secondary";
      const description = `${metric.description} Target condition: ${comparator} ${formatThresholdForLabel(threshold)} ${metric.unit}.`;
      const valueHashHex = machineDefinitionHash({
        metric,
        comparator,
        threshold,
        evidence,
      });

      outcomes.push({
        id,
        label,
        description,
        domain: metric.domain,
        kind: "metric_threshold",
        metricId: metric.id,
        metricWindow: metric.window,
        comparator,
        threshold,
        unit: metric.unit,
        severity,
        tags: baseTags,
        evidence,
        valueHashHex,
      });
    }

    const severityDefault = PRIMARY_METRICS.has(metric.id) ? "primary" : "secondary";
    const stepPolicy = templateStepPolicy(metric.unit);
    templates.push({
      id: buildTemplateId(metric.id, usedTemplateIds),
      label: `${metricDisplayLabel(metric)} threshold template`,
      description: `Parameterized threshold template derived from metric "${metric.id}".`,
      domain: metric.domain,
      kind: "metric_threshold",
      metricId: metric.id,
      metricWindow: metric.window,
      unit: metric.unit,
      comparators: [comparator],
      severityDefault,
      tags: baseTags,
      evidenceDefault: evidenceDefaults(metric),
      thresholdPolicy: {
        suggested: suggestedThresholds,
        min: comparator === ">=" ? Math.min(...suggestedThresholds) : null,
        max: comparator === "<=" ? Math.max(...suggestedThresholds) : null,
        step: stepPolicy.step,
        decimals: stepPolicy.decimals,
      },
    });
  }

  outcomes.sort((a, b) => a.id.localeCompare(b.id));
  templates.sort((a, b) => a.id.localeCompare(b.id));

  const document = {
    specVersion: "omegax.schema.v2",
    name: "OmegaX Standard Health Outcomes",
    publisher: "OmegaX Health",
    schemaKey: args.schemaKey,
    schemaVersion: args.schemaVersion,
    metricsRegistry: {
      source: "omegaxhealth_agent",
      registryVersion: metricRegistry.registryVersion || "unknown",
    },
    goalCatalog: {
      source: "omegaxhealth_agent",
      version: goalCatalog.version ?? null,
    },
    outcomes,
    outcomeTemplates: templates,
  };

  const schemaHashHex = sha256Hex(stableStringify(document));
  const schemaKeyHashHex = sha256Hex(`schema:${args.schemaKey}:v${args.schemaVersion}`);

  const payload = {
    ...document,
    schemaHashHex,
    schemaKeyHashHex,
  };

  mkdirSync(dirname(args.outputPath), { recursive: true });
  writeFileSync(args.outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  mkdirSync(dirname(args.outputVersionedPath), { recursive: true });
  writeFileSync(args.outputVersionedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`[schema:generate-standard] metrics=${directionalMetrics.length}`);
  console.log(`[schema:generate-standard] outcomes=${outcomes.length}`);
  console.log(`[schema:generate-standard] templates=${templates.length}`);
  console.log(`[schema:generate-standard] schema_key_hash_hex=${schemaKeyHashHex}`);
  console.log(`[schema:generate-standard] schema_hash_hex=${schemaHashHex}`);
  console.log(`[schema:generate-standard] wrote=${args.outputPath}`);
  console.log(`[schema:generate-standard] wrote=${args.outputVersionedPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[schema:generate-standard] failed: ${message}`);
  process.exit(1);
});
