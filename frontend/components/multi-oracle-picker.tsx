// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useMemo } from "react";

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
  const filtered = useMemo(() => {
    const needle = normalize(search);
    if (!needle) return options;
    return options.filter((entry) =>
      [entry.oracle, entry.metadataUri, entry.active ? "active" : "inactive"].some((value) =>
        normalize(value).includes(needle),
      ),
    );
  }, [options, search]);

  return (
    <div className="surface-card-soft space-y-3">
      <p className="metric-label">Verification Network (multi-select)</p>
      <input
        className="field-input"
        placeholder="Filter oracle addresses or metadata"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        disabled={disabled}
      />
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {filtered.length === 0 ? <p className="field-help">No matching oracles.</p> : null}
        {filtered.map((entry) => {
          const isSelected = selectedSet.has(entry.oracle);
          const isRequired = Boolean(requiredOracle) && entry.oracle === requiredOracle;
          const toggleDisabled = Boolean(disabled) || Boolean(lockRequiredOracle && isRequired && isSelected);
          return (
            <button
              key={entry.oracle}
              type="button"
              className={cn(
                "w-full rounded-2xl border p-3 text-left transition-colors",
                isSelected ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)]/60 bg-transparent",
                isRequired && "border-emerald-400/60",
                toggleDisabled && "cursor-not-allowed opacity-90",
              )}
              onClick={() => onToggle(entry.oracle)}
              disabled={toggleDisabled}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">{shortAddress(entry.oracle)}</p>
                <div className="flex items-center gap-1.5">
                  {isRequired ? <span className="status-pill status-ok">Required</span> : null}
                  <span className={`status-pill ${entry.active ? "status-ok" : "status-off"}`}>{entry.active ? "Active" : "Inactive"}</span>
                </div>
              </div>
              <p className="field-help mt-1 break-all">{entry.metadataUri || "No metadata URI"}</p>
            </button>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((oracle) => (
            <span key={oracle} className={`status-pill ${oracle === requiredOracle ? "status-ok" : "status-off"}`}>
              {shortAddress(oracle)}
              {oracle === requiredOracle ? " (required)" : ""}
            </span>
          ))}
        </div>
      ) : (
        <p className="field-help">No verifiers selected yet.</p>
      )}
      {lockRequiredOracle && requiredOracle ? (
        <p className="field-help">The required verifier is locked for Business-origin plans.</p>
      ) : null}
    </div>
  );
}
