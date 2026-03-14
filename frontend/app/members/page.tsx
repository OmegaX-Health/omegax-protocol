// SPDX-License-Identifier: AGPL-3.0-or-later

import { Users } from "lucide-react";
import Link from "next/link";

import { Hero } from "@/components/hero";
import { MemberActionsPanel } from "@/components/member-actions-panel";

export default function MembersPage() {
  return (
    <div className="space-y-5">
      <Hero
        title="Participant Enrollment"
        subtitle="Enroll patients, employees, or members into health plans and configure claim delegation."
        icon={Users}
      />

      <MemberActionsPanel />
    </div>
  );
}
