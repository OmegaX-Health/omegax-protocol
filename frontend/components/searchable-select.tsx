// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useMemo } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type SearchableSelectProps = {
  label: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  error?: string | null;
  emptyMessage?: string;
  showOptionCount?: boolean;
  showSelectedHint?: boolean;
};

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  searchValue,
  onSearchChange,
  placeholder,
  loading,
  disabled,
  disabledHint,
  error,
  emptyMessage,
  showOptionCount = true,
  showSelectedHint = true,
}: SearchableSelectProps) {
  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);
  const blocked = Boolean(disabled);
  const selectedMissing = value.trim().length > 0 && !selected;
  const filterAvailable = options.length > 8 || searchValue.trim().length > 0;

  return (
    <div className="space-y-2">
      <label className="field-label">
        {label}
        <select
          className="field-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={blocked}
        >
          <option value="">{placeholder ?? `Choose ${label.toLowerCase()}`}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {filterAvailable ? (
        <input
          className="field-input"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={`Filter ${label.toLowerCase()} (optional)`}
          disabled={blocked}
        />
      ) : null}

      {loading ? <p className="field-help">Loading options from chain...</p> : null}
      {!loading && showOptionCount ? <p className="field-help">{options.length} option{options.length === 1 ? "" : "s"} loaded.</p> : null}
      {!loading && options.length === 0 ? (
        <p className="field-help">{emptyMessage ?? "No matching options found on chain."}</p>
      ) : null}
      {blocked && disabledHint ? <p className="field-help">{disabledHint}</p> : null}
      {showSelectedHint && selected?.hint ? <p className="field-help">{selected.hint}</p> : null}
      {selectedMissing ? <p className="field-error">Selected value is not present in current selector results.</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
