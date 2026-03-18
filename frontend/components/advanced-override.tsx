// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useState } from "react";

type AdvancedOverrideProps = {
  title?: string;
  description?: string;
  openDescription?: string;
  closedActionLabel?: string;
  openActionLabel?: string;
  enabled?: boolean;
  onToggle?: (value: boolean) => void;
  children: React.ReactNode;
};

export function AdvancedOverride({
  title,
  description,
  openDescription,
  closedActionLabel,
  openActionLabel,
  enabled,
  onToggle,
  children,
}: AdvancedOverrideProps) {
  const toggleable = typeof enabled === "boolean" && typeof onToggle === "function";
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = toggleable ? enabled : localOpen;
  const closedLabel = closedActionLabel ?? "Use manual protocol inputs";
  const resolvedOpenLabel = toggleable
    ? (openActionLabel ?? "Use discovered values")
    : (openActionLabel ?? "Hide manual inputs");
  const closedCopy =
    description
    ?? "Only switch to manual inputs when selector-driven values are missing or you need to paste exact protocol values.";
  const openCopy =
    openDescription
    ?? "Manual inputs are active. Selector-driven values stay ignored until you switch back.";

  return (
    <div className="surface-card-soft manual-override-shell space-y-3 p-3 sm:p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="metric-label">{title ?? "Manual protocol inputs"}</p>
          <p className="field-help">{isOpen ? openCopy : closedCopy}</p>
        </div>
        <button
          type="button"
          className="secondary-button py-2"
          onClick={() => (toggleable ? onToggle(!enabled) : setLocalOpen((prev) => !prev))}
        >
          {isOpen ? resolvedOpenLabel : closedLabel}
        </button>
      </div>
      {isOpen ? <div className="space-y-3">{children}</div> : null}
    </div>
  );
}
