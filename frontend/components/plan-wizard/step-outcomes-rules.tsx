// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { FieldHint } from "@/components/field-hint";
import { ProtocolDetailDisclosure } from "@/components/protocol-detail-disclosure";
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
  schemaWarnings: string[];
  schemaMetadataLoading: boolean;
  onCreateOrUpdateRules: () => void;
  actionLabel: string;
  actionHelp?: string | null;
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
  schemaWarnings,
  schemaMetadataLoading,
  onCreateOrUpdateRules,
  actionLabel,
  actionHelp,
  disabledInputs,
  actionDisabled,
}: StepOutcomesRulesProps) {
  const [outcomeSearch, setOutcomeSearch] = useState("");
  const deferredSearch = useDeferredValue(outcomeSearch);
  const visibleOutcomes = useMemo(() => {
    const normalizedNeedle = deferredSearch.trim().toLowerCase();
    if (!normalizedNeedle) return schemaOutcomes;
    return schemaOutcomes.filter((outcome) =>
      [outcome.label, outcome.id].some((value) => value.toLowerCase().includes(normalizedNeedle)),
    );
  }, [deferredSearch, schemaOutcomes]);

  return (
    <section className="wizard-section">
      <div className="wizard-section-heading">
        <div className="space-y-1">
          <p className="wizard-section-kicker">Outcomes</p>
          <h3 className="wizard-section-title">Which outcomes should unlock payouts?</h3>
        </div>
        <FieldHint
          content="Choose the outcome schema first, then select the outcomes that matter and give each one a rule ID."
          side="end"
        />
      </div>

      <div className="wizard-section-block">
        <div className="wizard-inline-head">
          <p className="wizard-section-label">Outcome schema</p>
          <FieldHint
            content="Use the schema that matches the outcomes this plan should pay on. The rules below are generated from that schema."
            side="end"
          />
        </div>
        <label className="field-label">
          Select schema
          <select
            className="field-input"
            value={selectedSchemaAddress}
            onChange={(event) => onSelectedSchemaAddressChange(event.target.value)}
            disabled={disabledInputs}
          >
            <option value="">Select a schema</option>
            {schemas.map((schema) => (
              <option key={schema.address} value={schema.address}>
                {schema.schemaKey} v{schema.version} ({shortAddress(schema.address)})
              </option>
            ))}
          </select>
        </label>

        {schemaMetadataLoading ? (
          <p className="wizard-inline-copy">Loading outcome definitions from schema metadata…</p>
        ) : null}

        {schemaWarnings.length > 0 ? (
          <div className="wizard-note">
            {schemaWarnings.map((warning) => (
              <p key={warning} className="wizard-inline-copy">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="wizard-section-block">
        <div className="wizard-inline-head">
          <p className="wizard-section-label">Choose outcomes</p>
          <FieldHint
            content="Select every outcome that should create or unlock a payout path in this plan."
            side="end"
          />
        </div>

        {schemaOutcomes.length > 0 ? (
          <input
            className="field-input"
            value={outcomeSearch}
            onChange={(event) => setOutcomeSearch(event.target.value)}
            placeholder="Filter outcomes by name or ID"
            disabled={disabledInputs}
          />
        ) : null}

        {schemaOutcomes.length === 0 ? (
          <p className="wizard-inline-copy">No outcomes are loaded for the selected schema yet.</p>
        ) : null}

        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
          {schemaOutcomes.length > 0 && visibleOutcomes.length === 0 ? (
            <p className="wizard-inline-copy">No outcomes match the current filter.</p>
          ) : null}
          {visibleOutcomes.map((outcome) => {
            const isSelected = selectedOutcomeIds.includes(outcome.id);
            return (
              <button
                key={outcome.id}
                type="button"
                className={`wizard-select-row ${isSelected ? "wizard-select-row-active" : ""}`}
                onClick={() => onToggleOutcome(outcome.id)}
                disabled={disabledInputs}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{outcome.label}</p>
                  {isSelected ? <span className="status-pill status-ok">Selected</span> : null}
                </div>
                <p className="wizard-inline-copy mt-1">{outcome.id}</p>
              </button>
            );
          })}
        </div>
      </div>

      {ruleRows.length > 0 ? (
        <div className="wizard-section-block">
          <div className="wizard-inline-head">
            <p className="wizard-section-label">Name the payout rules</p>
            <FieldHint
              content="Each selected outcome needs a stable rule ID. Reward payout amount still comes from the launch settings in step 1."
              side="end"
            />
          </div>

          <div className="space-y-3">
            {ruleRows.map((rule) => (
              <div key={rule.outcomeId} className="wizard-rule-row">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{rule.outcomeLabel}</p>
                  <p className="wizard-inline-copy">{rule.outcomeId}</p>
                </div>

                <label className="field-label">
                  Rule ID
                  <input
                    className="field-input"
                    value={rule.ruleId}
                    onChange={(event) => onRuleIdChange(rule.outcomeId, event.target.value)}
                    disabled={disabledInputs}
                  />
                </label>

                <ProtocolDetailDisclosure
                  title="Protocol details"
                  summary="Derived hashes and manual overrides stay here when you need exact protocol values."
                >
                  <p className="wizard-inline-copy break-all">
                    Derived rule hash: {rule.derivedRuleHashHex || "pending"}
                  </p>
                  <p className="wizard-inline-copy break-all">
                    Derived payout hash: {rule.derivedPayoutHashHex || "pending"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="field-label">
                      Rule hash override
                      <input
                        className="field-input"
                        value={rule.ruleHashOverride}
                        onChange={(event) => onRuleHashOverrideChange(rule.outcomeId, event.target.value)}
                        disabled={disabledInputs}
                        placeholder="Optional 32-byte hex"
                      />
                    </label>
                    <label className="field-label">
                      Payout hash override
                      <input
                        className="field-input"
                        value={rule.payoutHashOverride}
                        onChange={(event) => onPayoutHashOverrideChange(rule.outcomeId, event.target.value)}
                        disabled={disabledInputs}
                        placeholder="Optional 32-byte hex"
                      />
                    </label>
                  </div>
                </ProtocolDetailDisclosure>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="wizard-action-block">
        <div className="space-y-2">
          <p className="wizard-section-label">Save outcome rules</p>
          <p className="wizard-inline-copy">Once saved, the plan knows which verified outcomes should trigger payouts.</p>
        </div>
        <button
          type="button"
          className="action-button hidden w-full sm:inline-flex sm:w-auto"
          onClick={onCreateOrUpdateRules}
          disabled={actionDisabled}
        >
          {actionLabel}
        </button>
        {actionHelp ? (
          <p className={actionDisabled ? "field-error" : "wizard-inline-copy"}>
            {actionHelp}
          </p>
        ) : null}
      </div>
    </section>
  );
}
