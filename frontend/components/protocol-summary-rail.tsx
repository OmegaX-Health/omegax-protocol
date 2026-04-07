// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

type ProtocolSummaryRailItem = {
  id?: string;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

type ProtocolSummaryRailProps = {
  title?: string;
  note?: ReactNode;
  items: ProtocolSummaryRailItem[];
  className?: string;
};

export function ProtocolSummaryRail({
  title,
  note,
  items,
  className,
}: ProtocolSummaryRailProps) {
  const railClassName = className ? `protocol-summary-rail ${className}` : "protocol-summary-rail";

  return (
    <aside className={railClassName}>
      {title ? (
        <div className="protocol-summary-head">
          <p className="protocol-metric-label">{title}</p>
        </div>
      ) : null}

      <div className="protocol-summary-grid">
        {items.map((item) => (
          <article key={item.id ?? item.label} className="protocol-summary-card">
            <span className="protocol-meta">{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail ? <p className="protocol-section-copy">{item.detail}</p> : null}
          </article>
        ))}
      </div>

      {note ? <p className="protocol-summary-note">{note}</p> : null}
    </aside>
  );
}
