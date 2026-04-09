// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useMemo, useState } from "react";

import { FieldHint } from "@/components/field-hint";
import { cn } from "@/lib/cn";

export type MultiOracleOption = {
  oracle: string;
  active: boolean;
  metadataUri: string;
};

type MultiOraclePickerProps = {
  options: MultiOracleOption[];
  search: string;
  onSearchChange: (value: string) => void;
  selected: string[];
  onToggle: (oracle: string) => void;
  requiredOracle?: string | null;
  lockRequiredOracle?: boolean;
  disabled?: boolean;
};

function shortAddress(value: string): string {
  if (value.length < 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function MultiOraclePicker({
  options,
  search,
  onSearchChange,
  selected,
  onToggle,
  requiredOracle,
  lockRequiredOracle,
  disabled,
}: MultiOraclePickerProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [candidateOracle, setCandidateOracle] = useState("");
  const filtered = useMemo(() => {
    const needle = normalize(search);
    if (!needle) return options;
    return options.filter((entry) =>
      [entry.oracle, entry.metadataUri, entry.active ? "active" : "inactive"].some((value) =>
        normalize(value).includes(needle),
      ),
    );
  }, [options, search]);
  const available = useMemo(
    () => filtered.filter((entry) => !selectedSet.has(entry.oracle)),
    [filtered, selectedSet],
  );

  useEffect(() => {
    if (candidateOracle && available.some((entry) => entry.oracle === candidateOracle)) return;
    setCandidateOracle(available[0]?.oracle ?? "");
  }, [available, candidateOracle]);

  function handleAddCandidate() {
    if (!candidateOracle) return;
    onToggle(candidateOracle);
  }

  return (
    <div className="space-y-3">
      <div className="wizard-inline-head">
        <p className="wizard-section-label">Which verifiers can confirm outcomes?</p>
        <FieldHint
          content="Choose the oracle wallets that should be able to confirm outcomes for this plan. You can revise the verifier set later in the pool workspace."
          side="end"
        />
      </div>
      <div className="wizard-oracle-picker">
        <div className="wizard-oracle-picker-toolbar">
          <label className="field-label">
            Add verifier from registry
            <select
              className="field-input"
              value={candidateOracle}
              onChange={(event) => setCandidateOracle(event.target.value)}
              disabled={disabled || available.length === 0}
            >
              <option value="">
                {available.length > 0 ? "Choose verifier" : "All listed verifiers already selected"}
              </option>
              {available.map((entry) => (
                <option key={entry.oracle} value={entry.oracle}>
                  {shortAddress(entry.oracle)} · {entry.metadataUri || (entry.active ? "Active registry profile" : "Registry entry")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button w-fit"
            onClick={handleAddCandidate}
            disabled={disabled || !candidateOracle}
          >
            Add verifier
          </button>
        </div>
        <input
          className="field-input"
          placeholder="Filter registry by address or metadata"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          disabled={disabled}
        />
        {filtered.length === 0 ? <p className="field-help">No matching verifiers in the registry.</p> : null}
        {available.length === 0 && filtered.length > 0 ? (
          <p className="field-help">Every verifier in the current filter is already selected.</p>
        ) : null}
      </div>
      <div className="space-y-2">
        {selected.length === 0 ? <p className="field-help">No verifiers selected yet.</p> : null}
        {selected.map((oracle) => {
          const entry = options.find((option) => option.oracle === oracle);
          const isRequired = Boolean(requiredOracle) && oracle === requiredOracle;
          const toggleDisabled = Boolean(disabled) || Boolean(lockRequiredOracle && isRequired);
          return (
            <div
              key={oracle}
              className={cn(
                "wizard-select-row",
                "wizard-select-row-active",
                isRequired && "wizard-select-row-required",
                toggleDisabled && "opacity-90",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">{shortAddress(oracle)}</p>
                <div className="flex items-center gap-1.5">
                  {isRequired ? <span className="status-pill status-ok">Required</span> : null}
                  <span className={`status-pill ${entry?.active ? "status-ok" : "status-off"}`}>
                    {entry?.active ? "Active" : "Manual"}
                  </span>
                </div>
              </div>
              <p className="wizard-inline-copy mt-1 break-all">
                {entry?.metadataUri || "Selected verifier"}
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="secondary-button w-fit"
                  onClick={() => onToggle(oracle)}
                  disabled={toggleDisabled}
                >
                  {isRequired && lockRequiredOracle ? "Locked verifier" : "Remove verifier"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <details className="wizard-oracle-registry">
        <summary className="wizard-oracle-registry-summary">Preview registry entries</summary>
        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
          {filtered.map((entry) => {
          const isSelected = selectedSet.has(entry.oracle);
          const isRequired = Boolean(requiredOracle) && entry.oracle === requiredOracle;
          return (
            <div
              key={entry.oracle}
              className={cn(
                "wizard-select-row",
                isSelected && "wizard-select-row-active",
                isRequired && "wizard-select-row-required",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">{shortAddress(entry.oracle)}</p>
                <div className="flex items-center gap-1.5">
                  {isRequired ? <span className="status-pill status-ok">Required</span> : null}
                  <span className={`status-pill ${entry.active ? "status-ok" : "status-off"}`}>{entry.active ? "Active" : "Inactive"}</span>
                </div>
              </div>
              <p className="wizard-inline-copy mt-1 break-all">
                {entry.metadataUri || "No metadata URI"}
              </p>
            </div>
          );
        })}
        </div>
      </details>
      {lockRequiredOracle && requiredOracle ? <p className="wizard-inline-copy">The required verifier stays locked for this launch path.</p> : null}
    </div>
  );
}
