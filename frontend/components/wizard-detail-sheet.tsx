// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import type { ReactNode, Ref } from "react";
import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/cn";

export type WizardDetailMetaItem = {
  label: string;
  tone?: "default" | "accent" | "muted";
};

type WizardDetailTriggerRowProps = {
  title: string;
  summary: string;
  meta?: WizardDetailMetaItem[];
  actionLabel?: string;
  className?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  onOpen: (trigger: HTMLButtonElement) => void;
};

type WizardDetailSheetProps = {
  title: string;
  summary?: string;
  meta?: WizardDetailMetaItem[];
  open: boolean;
  size?: "default" | "wide";
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

export function WizardDetailTriggerRow({
  title,
  summary,
  meta = [],
  actionLabel = "Open details",
  className,
  triggerRef,
  onOpen,
}: WizardDetailTriggerRowProps) {
  return (
    <button
      type="button"
      ref={triggerRef}
      className={cn("wizard-detail-trigger", className)}
      aria-haspopup="dialog"
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span className="wizard-detail-trigger-copy">
        <span className="wizard-detail-trigger-title">{title}</span>
        <span className="wizard-detail-trigger-summary">{summary}</span>
      </span>
      <span className="wizard-detail-trigger-actions">
        {meta.length > 0 ? (
          <span className="wizard-detail-trigger-meta" aria-hidden="true">
            {meta.map((item) => (
              <span
                key={`${item.label}-${item.tone ?? "default"}`}
                className={cn(
                  "wizard-detail-chip",
                  item.tone === "accent" && "wizard-detail-chip-accent",
                  item.tone === "muted" && "wizard-detail-chip-muted",
                )}
              >
                {item.label}
              </span>
            ))}
          </span>
        ) : null}
        <span className="wizard-detail-trigger-open">
          <span>{actionLabel}</span>
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_right
          </span>
        </span>
      </span>
    </button>
  );
}

export function WizardDetailSheet({
  title,
  summary,
  meta = [],
  open,
  size = "default",
  children,
  onOpenChange,
}: WizardDetailSheetProps) {
  const titleId = useId();
  const summaryId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="wizard-detail-sheet-root" role="presentation">
      <div
        className="wizard-detail-sheet-scrim"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn("wizard-detail-sheet-panel", size === "wide" && "wizard-detail-sheet-panel-wide")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={summary ? summaryId : undefined}
      >
        <header className="wizard-detail-sheet-header">
          <div className="wizard-detail-sheet-header-copy">
            <div className="wizard-detail-sheet-heading-row">
              <div className="wizard-detail-sheet-heading">
                <p className="wizard-detail-sheet-eyebrow">DETAIL_SURFACE</p>
                <h2 id={titleId} className="wizard-detail-sheet-title">
                  {title}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="wizard-detail-sheet-close"
                onClick={() => onOpenChange(false)}
                aria-label="Close details panel"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            {summary ? (
              <p id={summaryId} className="wizard-detail-sheet-summary">
                {summary}
              </p>
            ) : null}
            {meta.length > 0 ? (
              <div className="wizard-detail-sheet-meta">
                {meta.map((item) => (
                  <span
                    key={`${item.label}-${item.tone ?? "default"}`}
                    className={cn(
                      "wizard-detail-chip",
                      item.tone === "accent" && "wizard-detail-chip-accent",
                      item.tone === "muted" && "wizard-detail-chip-muted",
                    )}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </header>
        <div className="wizard-detail-sheet-body">{children}</div>
      </aside>
    </div>
  );
}
