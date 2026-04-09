// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";
import { firstSeriesAddressForPlan, linkedContextForPool, planAddressForSeries } from "@/lib/workbench";

type SchemasShimPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function SchemasShimPage({ searchParams }: SchemasShimPageProps) {
  const pool = firstValue(searchParams?.pool);
  const requestedSeries = firstValue(searchParams?.series);
  const linked = linkedContextForPool(pool);
  const plan = firstValue(searchParams?.plan)
    || planAddressForSeries(requestedSeries)
    || linked.plan
    || DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]?.address
    || "";
  const resolvedSeries = requestedSeries || linked.series || firstSeriesAddressForPlan(plan) || "";
  const params = new URLSearchParams();

  params.set("tab", "overview");
  if (plan) params.set("plan", plan);
  if (resolvedSeries) params.set("series", resolvedSeries);

  redirect(`/plans?${params.toString()}`);
}
