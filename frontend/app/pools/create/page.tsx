// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";
import { WandSparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Hero } from "@/components/hero";
import { CreateHealthPlanWizard } from "@/components/create-health-plan-wizard";
import { buildBusinessContextHref, getBusinessEntryContext } from "@/lib/business-entry-context";

type CreatePoolPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }
  return value?.trim() || null;
}

function toBusinessSearchParams(input: CreatePoolPageProps["searchParams"]): URLSearchParams {
  const params = new URLSearchParams();
  const keys = ["source", "entry", "orgId", "defaultPoolId", "requiredOracle"] as const;
  for (const key of keys) {
    const value = firstQueryValue(input?.[key]);
    if (value) params.set(key, value);
  }
  return params;
}

export default function CreatePoolPage({ searchParams }: CreatePoolPageProps) {
  const businessEntry = getBusinessEntryContext(toBusinessSearchParams(searchParams));
  const backToPoolsHref = buildBusinessContextHref("/pools", businessEntry);

  return (
    <div className="space-y-5">
      <Hero
        title="Create Health Plan"
        subtitle="Follow the guided 5-step setup: choose plan type, configure eligibility, verify with oracle quorum, set outcomes and rules, then fund and review before launch."
        icon={WandSparkles}
      />

      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 surface-card-soft">
        <div className="flex items-center gap-4">
          <Link href={backToPoolsHref} className="secondary-button inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to pools hub
          </Link>
          <div className="h-6 w-px bg-[var(--border)] hidden sm:block"></div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Operator Launch Flow</h2>
        </div>
        <p className="field-help m-0">Simple mode is default; Expert mode reveals raw hashes and advanced overrides.</p>
      </section>

      <Suspense
        fallback={(
          <section className="surface-card">
            <p className="field-help">Loading create-plan workflow…</p>
          </section>
        )}
      >
        <CreateHealthPlanWizard />
      </Suspense>
    </div>
  );
}
