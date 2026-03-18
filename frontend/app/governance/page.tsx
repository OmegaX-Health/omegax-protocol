// SPDX-License-Identifier: AGPL-3.0-or-later

import { Landmark } from "lucide-react";

import { GovernanceConsole } from "@/components/governance-console";
import { Hero } from "@/components/hero";

export default function GovernancePage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Governance"
        subtitle="Review DAO state, move voting power, create proposals, vote, and execute approved transactions without dropping into raw protocol forms unless you intentionally need them."
        icon={Landmark}
      />
      <GovernanceConsole sectionMode="full" />
    </div>
  );
}
