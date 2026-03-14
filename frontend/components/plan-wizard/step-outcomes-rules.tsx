// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import type { SchemaOutcomeOption } from "@/lib/schema-metadata";
import type { SchemaSummary } from "@/lib/protocol";

export type OutcomeRuleRow = {
  outcomeId: string;
  outcomeLabel: string;
  ruleId: string;
  derivedRuleHashHex: string;
  derivedPayoutHashHex: string;
  ruleHashOverride: string;
  payoutHashOverride: string;
};

type StepOutcomesRulesProps = {
  schemas: SchemaSummary[];
  selectedSchemaAddress: string;
  onSelectedSchemaAddressChange: (value: string) => void;
  schemaOutcomes: SchemaOutcomeOption[];
  selectedOutcomeIds: string[];
  onToggleOutcome: (outcomeId: string) => void;
  ruleRows: OutcomeRuleRow[];
  onRuleIdChange: (outcomeId: string, value: string) => void;
  onRuleHashOverrideChange: (outcomeId: string, value: string) => void;
  onPayoutHashOverrideChange: (outcomeId: string, value: string) => void;
  expertMode: boolean;
  onCreateOrUpdateRules: () => void;
  disabledInputs?: boolean;
  actionDisabled?: boolean;
};

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function StepOutcomesRules({
  schemas,
  selectedSchemaAddress,
  onSelectedSchemaAddressChange,
  schemaOutcomes,
  selectedOutcomeIds,
  onToggleOutcome,
  ruleRows,
  onRuleIdChange,
  onRuleHashOverrideChange,
  onPayoutHashOverrideChange,
  expertMode,
  onCreateOrUpdateRules,
  disabledInputs,
  actionDisabled,
}: StepOutcomesRulesProps) {
  return (
    <section className="surface-card step-card space-y-4">
      <div className="step-head">
        <h3 className="step-title">4. Outcomes & Rules</h3>
      </div>

      <label className="field-label">
        Verified schema
        <select
          className="field-input"
          value={selectedSchemaAddress}
          onChange={(event) => onSelectedSchemaAddressChange(event.target.value)}
          disabled={disabledInputs}
        >
          <option value="">Select verified schema</option>
          {schemas.map((schema) => (
            <option key={schema.address} value={schema.address}>
              {schema.schemaKey} v{schema.version} ({shortAddress(schema.address)})
            </option>
          ))}
        </select>
      </label>

      <div className="surface-card-soft space-y-3">
        <p className="metric-label">Outcomes (multi-select)</p>
        {schemaOutcomes.length === 0 ? <p className="field-help">No outcomes loaded from selected schema metadata.</p> : null}
        <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
          {schemaOutcomes.map((outcome) => {
            const isSelected = selectedOutcomeIds.includes(outcome.id);
            return (
              <button
                key={outcome.id}
                type="button"
                className={`w-full rounded-2xl border p-3 text-left ${isSelected ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)]/60"}`}
                onClick={() => onToggleOutcome(outcome.id)}
                disabled={disabledInputs}
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">{outcome.label}</p>
                <p className="field-help mt-1">{outcome.id}</p>
              </button>
            );
          })}
        </div>
      </div>

      {ruleRows.length > 0 ? (
        <div className="space-y-3">
          <p className="metric-label">Rule builder</p>
          <p className="field-help">All rules share the reward payout configured in Step 1.</p>
          <div className="space-y-3">
            {ruleRows.map((rule) => (
              <div key={rule.outcomeId} className="surface-card-soft space-y-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {rule.outcomeLabel} <span className="text-[var(--muted-foreground)]">({rule.outcomeId})</span>
                </p>
                <label className="field-label">
                  Rule ID
                  <input
                    className="field-input"
                    value={rule.ruleId}
                    onChange={(event) => onRuleIdChange(rule.outcomeId, event.target.value)}
                    disabled={disabledInputs}
                  />
                </label>
                <p className="field-help break-all">Rule hash: {rule.derivedRuleHashHex || "pending"}</p>
                <p className="field-help break-all">Payout hash: {rule.derivedPayoutHashHex || "pending"}</p>
                {expertMode ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field-label">
                      Rule hash override
                      <input
                        className="field-input"
                        value={rule.ruleHashOverride}
                        onChange={(event) => onRuleHashOverrideChange(rule.outcomeId, event.target.value)}
                        disabled={disabledInputs}
                      />
                    </label>
                    <label className="field-label">
                      Payout hash override
                      <input
                        className="field-input"
                        value={rule.payoutHashOverride}
                        onChange={(event) => onPayoutHashOverrideChange(rule.outcomeId, event.target.value)}
                        disabled={disabledInputs}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button type="button" className="action-button" onClick={onCreateOrUpdateRules} disabled={actionDisabled}>
        Create / update rules
      </button>
    </section>
  );
}
