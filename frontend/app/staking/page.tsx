// SPDX-License-Identifier: AGPL-3.0-or-later

import { Activity } from "lucide-react";

import { Hero } from "@/components/hero";
import { PoolWorkspaceLauncher } from "@/components/pool-workspace-launcher";

export default function StakingPage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Verifier Operations"
        subtitle="Oracle staking and related verifier operations are now part of the shared pool workspace and governance/oracle surfaces."
        icon={Activity}
      />

      <PoolWorkspaceLauncher
        targetSection="oracles"
        targetPanel="staking"
        title="Open Oracle Operations In Pool Workspace"
        description="Pick a health plan and jump into the oracle section for approvals, network policy, and verifier operations."
        actionLabel="Open oracle workspace"
      />
    </div>
  );
}
