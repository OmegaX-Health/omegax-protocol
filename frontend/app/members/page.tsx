// SPDX-License-Identifier: AGPL-3.0-or-later

import { Users } from "lucide-react";

import { Hero } from "@/components/hero";
import { PoolWorkspaceLauncher } from "@/components/pool-workspace-launcher";

export default function MembersPage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Participant Enrollment"
        subtitle="Enrollment, membership context, and delegation now open inside the shared pool workspace instead of a standalone silo."
        icon={Users}
      />

      <PoolWorkspaceLauncher
        targetSection="members"
        targetPanel="enrollment"
        title="Open Members In Pool Workspace"
        description="Pick a health plan and jump straight into membership enrollment and delegation flows."
        actionLabel="Open members workspace"
      />
    </div>
  );
}
