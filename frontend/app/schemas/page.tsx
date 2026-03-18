// SPDX-License-Identifier: AGPL-3.0-or-later

import { Network } from "lucide-react";
import Link from "next/link";

import { Hero } from "@/components/hero";
import { SchemaRegistryInspector } from "@/components/schema-registry-inspector";
import { StandardSchemaRegistry } from "@/components/standard-schema-registry";

export default function SchemasPage() {
  return (
    <div className="space-y-6">
      <Hero
        title="Health Outcomes Registry"
        subtitle="The canonical registry of health conditions, biometric goals, and actionable outcomes that can be incentivized or insured."
        icon={Network}
      />

      <StandardSchemaRegistry />

      <section className="surface-card space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--foreground)]">On-Chain Schema Explorer</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Browse all published schema entries and rule mappings from chain state, including governance-verified and draft versions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/pools" className="action-button inline-flex w-fit">
            Create Health Plan
          </Link>
          <Link
            className="secondary-button inline-flex w-fit items-center justify-center"
            href="/governance"
          >
            Manage Schema Proposals
          </Link>
        </div>
      </section>

      <SchemaRegistryInspector />
    </div>
  );
}
