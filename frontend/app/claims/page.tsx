// SPDX-License-Identifier: AGPL-3.0-or-later

import { FileText } from "lucide-react";
import Link from "next/link";

import { Hero } from "@/components/hero";
import { MemberClaimsPanel } from "@/components/member-claims-panel";

export default function ClaimsPage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Health Claims"
        subtitle="Build and submit verified health outcome claims for reward payouts or insurance settlements."
        icon={FileText}
      />

      <MemberClaimsPanel />
    </div>
  );
}
