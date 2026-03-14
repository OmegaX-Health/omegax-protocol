// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";
import { Eye } from "lucide-react";

import { Hero } from "@/components/hero";
import { OracleRegistryVerificationPanel } from "@/components/oracle-registry-verification-panel";

export default function OraclesPage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Oracle Registry & Verification"
        subtitle="Register professional oracle profiles, claim oracle signing keys, and run readiness checks across Health Plans."
        icon={Eye}
      />

      <Suspense fallback={<div className="surface-card text-sm text-[var(--muted-foreground)]">Loading oracle workspace...</div>}>
        <OracleRegistryVerificationPanel />
      </Suspense>
    </div>
  );
}
