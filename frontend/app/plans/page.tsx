// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";

import { PlansWorkbench } from "@/components/plans-workbench";

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="workbench-page"><section className="workbench-main-column"><div className="workbench-inline-card glass-panel"><strong>Loading plans workbench...</strong></div></section></div>}>
      <PlansWorkbench />
    </Suspense>
  );
}
