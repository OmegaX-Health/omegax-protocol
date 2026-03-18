// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

type ProtocolDetailDisclosureProps = {
  title: string;
  summary?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export function ProtocolDetailDisclosure({
  title,
  summary,
  description,
  children,
  className,
  defaultOpen = false,
}: ProtocolDetailDisclosureProps) {
  return (
    <details className={cn("protocol-detail-disclosure", className)} open={defaultOpen || undefined}>
      <summary className="protocol-detail-summary">
        <div className="min-w-0 space-y-1">
          <p className="protocol-detail-title">{title}</p>
          {summary ? <p className="protocol-detail-copy">{summary}</p> : null}
        </div>
        <span className="protocol-detail-toggle">Protocol details</span>
      </summary>
      <div className="mt-3 space-y-3">
        {description ? <p className="field-help">{description}</p> : null}
        {children}
      </div>
    </details>
  );
}
