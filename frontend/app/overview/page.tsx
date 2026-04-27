// SPDX-License-Identifier: AGPL-3.0-or-later

import { OverviewWorkbench } from "@/components/overview-workbench";
import { firstSearchParamValue, type RouteSearchParams } from "@/lib/search-params";

type OverviewPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const demo = firstSearchParamValue(resolvedSearchParams.demo) === "1";
  return <OverviewWorkbench demo={demo} />;
}
