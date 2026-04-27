// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

type LegacyPoolsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LegacyPoolsPage({ searchParams }: LegacyPoolsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const params = new URLSearchParams();
  const pool = firstValue(resolvedSearchParams.pool);
  const capitalClass = firstValue(resolvedSearchParams.class);

  params.set("tab", "overview");
  if (pool) params.set("pool", pool);
  if (capitalClass) params.set("class", capitalClass);

  redirect(`/capital?${params.toString()}`);
}
