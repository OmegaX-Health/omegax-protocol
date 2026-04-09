// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: "primary" | "success" | "warning";
};

export function WorkbenchKpiCard({ label, value, detail, accent = "primary" }: KpiCardProps) {
  return (
    <article className={cn("workbench-kpi-card", `workbench-kpi-card-${accent}`)}>
      <span className="workbench-kpi-label">{label}</span>
      <strong className="workbench-kpi-value">{value}</strong>
      {detail ? <p className="workbench-kpi-detail">{detail}</p> : null}
    </article>
  );
}

export function WorkbenchRailCard({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("workbench-rail-card", className)}>
      <div className="workbench-rail-card-head">
        <h3 className="workbench-rail-title">{title}</h3>
        {meta ? <span className="workbench-card-meta">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function WorkbenchTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: ReadonlyArray<{ id: string; label: string }>;
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="workbench-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={cn("workbench-tab", active === tab.id && "workbench-tab-active")}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function WorkbenchEmptyState({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="workbench-empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
