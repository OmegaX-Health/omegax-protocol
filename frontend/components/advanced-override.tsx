// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useState } from "react";

type AdvancedOverrideProps = {
  title?: string;
  enabled?: boolean;
  onToggle?: (value: boolean) => void;
  children: React.ReactNode;
};

export function AdvancedOverride({ title, enabled, onToggle, children }: AdvancedOverrideProps) {
  const toggleable = typeof enabled === "boolean" && typeof onToggle === "function";
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = toggleable ? enabled : localOpen;
  const actionLabel = isOpen ? "Hide advanced settings" : "Show advanced settings";

  return (
    <div className="surface-card-soft space-y-3 p-3 sm:p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="metric-label">{title ?? "Advanced override"}</p>
        <button
          type="button"
          className="secondary-button py-2"
          onClick={() => (toggleable ? onToggle(!enabled) : setLocalOpen((prev) => !prev))}
        >
          {toggleable ? (enabled ? "Hide raw inputs" : "Use raw inputs") : actionLabel}
        </button>
      </div>
      {isOpen ? <div className="space-y-3">{children}</div> : <p className="field-help">Advanced settings are hidden.</p>}
    </div>
  );
}
