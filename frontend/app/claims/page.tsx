// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { linkedContextForPool, planAddressForSeries } from "@/lib/workbench";

type ClaimsShimPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function ClaimsShimPage({ searchParams }: ClaimsShimPageProps) {
  const plan = firstValue(searchParams?.plan);
  const series = firstValue(searchParams?.series);
  const pool = firstValue(searchParams?.pool);
  const linked = linkedContextForPool(pool);
  const resolvedSeries = series || linked.series || "";
  const resolvedPlan = plan || planAddressForSeries(resolvedSeries) || linked.plan || "";
  const params = new URLSearchParams();

  params.set("tab", "claims");
  if (resolvedPlan) params.set("plan", resolvedPlan);
  if (resolvedSeries) params.set("series", resolvedSeries);

  redirect(`/plans?${params.toString()}`);
}
