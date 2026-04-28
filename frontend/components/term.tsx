// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { getGlossaryEntry, type GlossaryKey } from "@/lib/glossary";

/**
 * Inline tooltip primitive for canonical protocol nouns. Wrap any user-visible
 * canonical noun (capital class, funding line, obligation, …) so that hovering
 * or focusing the term reveals a short definition + a "Learn more" link to
 * the disclosure pages, without sending the reader away from the workbench.
 *
 * Behavior mirrors `components/field-hint.tsx`:
 *   - Hover or focus opens the tooltip.
 *   - Click pins it open until Escape, outside-click, or another click.
 *   - Trigger has `aria-describedby` pointed at the tooltip for screen readers.
 *
 * Accessibility:
 *   - Trigger is a real `<button>` so keyboard users can Tab to it and read
 *     the definition with their screen reader of choice.
 *   - Visual cue is a subtle dotted underline in the cyan ink token; the
 *     trigger itself is text-styled to keep prose flow intact.
 */

export type TermProps = {
  name: GlossaryKey;
  /**
   * Optional override for the visible text. Defaults to the glossary label
   * (e.g. "capital class"). Useful when copy needs a different inflection
   * ("capital classes" plural, "Capital Class" sentence-case start, etc.).
   */
  children?: ReactNode;
};

export function Term({ name, children }: TermProps) {
  const entry = getGlossaryEntry(name);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open && !pinned) return;

    function closeIfOutside(target: EventTarget | null) {
      if (!rootRef.current) return;
      if (target instanceof Node && rootRef.current.contains(target)) return;
      setOpen(false);
      setPinned(false);
    }

    function handlePointer(event: MouseEvent | TouchEvent) {
      closeIfOutside(event.target);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, pinned]);

  function closeIfUnpinned() {
    if (!pinned) setOpen(false);
  }

  const label = children ?? entry.label;

  return (
    <span
      ref={rootRef}
      className="omegax-term"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={closeIfUnpinned}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) {
          closeIfUnpinned();
        }
      }}
    >
      <button
        type="button"
        className="omegax-term-trigger"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          setPinned((current) => {
            const next = !current;
            setOpen(next);
            return next;
          });
        }}
      >
        {label}
      </button>

      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="omegax-term-popover"
        >
          <span className="omegax-term-popover-eyebrow">{entry.label}</span>
          <span className="omegax-term-popover-body">{entry.shortDefinition}</span>
          {entry.learnMoreHref ? (
            <Link href={entry.learnMoreHref} className="omegax-term-popover-link">
              Learn more →
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
