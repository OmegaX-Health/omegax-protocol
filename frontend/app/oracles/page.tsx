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
        subtitle="Register or update oracle profiles with a simple default flow, then claim signer activation and run readiness checks when needed."
        icon={Eye}
      />

      <Suspense fallback={<div className="surface-card text-sm text-[var(--muted-foreground)]">Loading oracle workspace...</div>}>
        <OracleRegistryVerificationPanel />
      </Suspense>
    </div>
  );
}
