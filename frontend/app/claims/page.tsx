// SPDX-License-Identifier: AGPL-3.0-or-later

import { FileText } from "lucide-react";

import { Hero } from "@/components/hero";
import { PoolWorkspaceLauncher } from "@/components/pool-workspace-launcher";

export default function ClaimsPage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Health Claims"
        subtitle="Claims now live in the canonical pool workspace so members, delegates, operators, and oracle participants share one context."
        icon={FileText}
      />

      <PoolWorkspaceLauncher
        targetSection="claims"
        targetPanel="member"
        title="Open Claims In Pool Workspace"
        description="Pick a health plan and jump straight into the claims section for participant submission or operator review."
        actionLabel="Open claims workspace"
      />
    </div>
  );
}
