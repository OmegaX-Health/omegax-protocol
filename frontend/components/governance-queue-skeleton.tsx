// SPDX-License-Identifier: AGPL-3.0-or-later

import { cn } from "@/lib/cn";

type GovernanceQueueSkeletonProps = {
  className?: string;
  rows?: number;
  shape: "card" | "list" | "table";
};

export function GovernanceQueueSkeleton({ className, rows = 4, shape }: GovernanceQueueSkeletonProps) {
  if (shape === "card") {
    return (
      <div className={cn("governance-queue-skeleton", className)} aria-hidden="true">
        <span className="governance-queue-skeleton-line governance-queue-skeleton-line-title" />
        <span className="governance-queue-skeleton-line governance-queue-skeleton-line-copy" />
        <span className="governance-queue-skeleton-line governance-queue-skeleton-line-copy governance-queue-skeleton-line-copy-short" />
        <div className="governance-queue-skeleton-metrics">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="governance-queue-skeleton-metric">
              <span className="governance-queue-skeleton-line governance-queue-skeleton-line-label" />
              <span className="governance-queue-skeleton-line governance-queue-skeleton-line-value" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (shape === "list") {
    return (
      <div className={cn("governance-queue-skeleton-list", className)} aria-hidden="true">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="governance-queue-skeleton-list-row">
            <div className="governance-queue-skeleton-list-copy">
              <span className="governance-queue-skeleton-line governance-queue-skeleton-line-title" />
              <span className="governance-queue-skeleton-line governance-queue-skeleton-line-copy governance-queue-skeleton-line-copy-short" />
            </div>
            <span className="governance-queue-skeleton-pill" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("governance-queue-skeleton-table", className)} aria-hidden="true">
      <div className="governance-queue-skeleton-table-head">
        <span className="governance-queue-skeleton-line governance-queue-skeleton-line-header" />
        <span className="governance-queue-skeleton-line governance-queue-skeleton-line-header" />
        <span className="governance-queue-skeleton-line governance-queue-skeleton-line-header" />
        <span className="governance-queue-skeleton-line governance-queue-skeleton-line-header governance-queue-skeleton-line-header-short" />
      </div>
      <div className="governance-queue-skeleton-table-body">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="governance-queue-skeleton-table-row">
            <span className="governance-queue-skeleton-line governance-queue-skeleton-line-title" />
            <span className="governance-queue-skeleton-line governance-queue-skeleton-line-copy governance-queue-skeleton-line-copy-short" />
            <span className="governance-queue-skeleton-line governance-queue-skeleton-line-copy governance-queue-skeleton-line-copy-short" />
            <span className="governance-queue-skeleton-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}
