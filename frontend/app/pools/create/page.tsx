// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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
    <div className="space-y-4">
      <section className="create-flow-intro">
        <Link href={backToPoolsHref} className="secondary-button inline-flex w-fit items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to pools hub
        </Link>
        <div className="space-y-2">
          <p className="metric-label">Create Health Plan</p>
          <h1 className="create-flow-title">Launch a plan in three clear steps.</h1>
          <p className="create-flow-copy">
            Set the launch terms, choose how outcomes are verified, then review and fund the plan when you&apos;re ready.
          </p>
        </div>
      </section>

      <Suspense
        fallback={(
          <section className="wizard-stage-shell">
            <p className="field-help">Loading create-plan workflow…</p>
          </section>
        )}
      >
        <CreateHealthPlanWizard />
      </Suspense>
    </div>
  );
}
