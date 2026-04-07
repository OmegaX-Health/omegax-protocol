// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";

import { GovernanceWorkbench } from "@/components/governance-workbench";

export default function GovernancePage() {
  return (
    <Suspense fallback={<div className="workbench-page"><section className="workbench-main-column"><div className="workbench-inline-card glass-panel"><strong>Loading governance workbench...</strong></div></section></div>}>
      <GovernanceWorkbench />
    </Suspense>
  );
}
