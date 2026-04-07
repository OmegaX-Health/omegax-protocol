// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

type LegacyStakingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function LegacyStakingPage({ searchParams }: LegacyStakingPageProps) {
  const params = new URLSearchParams();
  const pool = firstValue(searchParams?.pool);
  const series = firstValue(searchParams?.series);

  params.set("tab", "staking");
  if (pool) params.set("pool", pool);
  if (series) params.set("series", series);

  redirect(`/oracles?${params.toString()}`);
}
