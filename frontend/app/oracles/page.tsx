// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";

import { OraclesWorkbench } from "@/components/oracles-workbench";

export default function OraclesPage() {
  return (
    <Suspense fallback={<div className="workbench-page"><section className="workbench-main-column"><div className="workbench-inline-card glass-panel"><strong>Loading oracle workbench...</strong></div></section></div>}>
      <OraclesWorkbench />
    </Suspense>
  );
}
