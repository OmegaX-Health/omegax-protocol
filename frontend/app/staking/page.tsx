// SPDX-License-Identifier: AGPL-3.0-or-later

import { Activity } from "lucide-react";

import { Hero } from "@/components/hero";
import { OracleStakingAccessPanel } from "@/components/oracle-staking-access-panel";

export default function StakingPage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Verifier Diagnostics"
        subtitle="Read-only oracle verification diagnostics. Visible only to registered verifier (oracle) wallets."
        icon={Activity}
      />
      <OracleStakingAccessPanel />
    </div>
  );
}
