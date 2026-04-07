// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";

import { CapitalWorkbench } from "@/components/capital-workbench";

export default function CapitalPage() {
  return (
    <Suspense fallback={<div className="workbench-page"><section className="workbench-main-column"><div className="workbench-inline-card glass-panel"><strong>Loading capital workbench...</strong></div></section></div>}>
      <CapitalWorkbench />
    </Suspense>
  );
}
