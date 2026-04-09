// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Info } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

type FieldHintProps = {
  content: ReactNode;
  label?: string;
  side?: "start" | "end";
  className?: string;
};

export function FieldHint({
  content,
  label = "More information",
  side = "start",
  className,
}: FieldHintProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const popoverId = useId();

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

  return (
    <span
      ref={rootRef}
      className={cn(
        "field-hint-wrap",
        side === "end" && "field-hint-wrap-end",
        className,
      )}
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
        className="field-hint-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={(event) => {
          event.preventDefault();
          setPinned((current) => {
            const next = !current;
            setOpen(next);
            return next;
          });
        }}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {open ? (
        <span
          id={popoverId}
          role="note"
          className={cn(
            "field-hint-popover",
            side === "end" && "field-hint-popover-end",
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
