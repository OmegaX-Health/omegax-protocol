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
  const plan = firstValue(searchParams?.plan) || planAddressForSeries(series) || linked.plan || "";
  const params = new URLSearchParams();

  params.set("tab", "schemas");
  if (plan) params.set("plan", plan);
  if (series || linked.series) params.set("series", series || linked.series || "");

  redirect(`/plans?${params.toString()}`);
}
