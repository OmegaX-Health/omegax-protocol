// SPDX-License-Identifier: AGPL-3.0-or-later

import Link from "next/link";

export default function NetworkHealthPage() {
  return (
    <div className="workbench-panel workbench-primary-surface" style={{ maxWidth: "36rem" }}>
      <div className="workbench-panel-head">
        <div>
          <h1 className="workbench-panel-title">Network Health</h1>
        </div>
      </div>
      <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
        Cluster status, protocol liveliness, and operational posture will be available here.
      </p>
      <Link href="/overview" className="workbench-inline-link">
        Back to overview
      </Link>
    </div>
  );
}
