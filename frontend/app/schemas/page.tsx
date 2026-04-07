// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { linkedContextForPool, planAddressForSeries } from "@/lib/workbench";

type SchemasShimPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function SchemasShimPage({ searchParams }: SchemasShimPageProps) {
  const pool = firstValue(searchParams?.pool);
  const series = firstValue(searchParams?.series);
  const linked = linkedContextForPool(pool);
  const resolvedSeries = series || linked.series || "";
  const plan = firstValue(searchParams?.plan) || planAddressForSeries(resolvedSeries) || linked.plan || "";
  const params = new URLSearchParams();

  params.set("tab", "schemas");
  if (plan) params.set("plan", plan);
  if (resolvedSeries) params.set("series", resolvedSeries);

  redirect(`/plans?${params.toString()}`);
}
