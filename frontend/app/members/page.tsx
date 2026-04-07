// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { linkedContextForPool } from "@/lib/workbench";

type MembersShimPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function MembersShimPage({ searchParams }: MembersShimPageProps) {
  const plan = firstValue(searchParams?.plan);
  const series = firstValue(searchParams?.series);
  const pool = firstValue(searchParams?.pool);
  const linked = linkedContextForPool(pool);
  const params = new URLSearchParams();

  params.set("tab", "members");
  if (plan || linked.plan) params.set("plan", plan || linked.plan || "");
  if (series || linked.series) params.set("series", series || linked.series || "");

  redirect(`/plans?${params.toString()}`);
}

