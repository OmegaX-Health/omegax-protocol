// SPDX-License-Identifier: AGPL-3.0-or-later

import { OverviewWorkbench } from "@/components/overview-workbench";
import { firstSearchParamValue, type RouteSearchParams } from "@/lib/search-params";

type OverviewPageProps = {
  searchParams?: RouteSearchParams;
};

export default function OverviewPage({ searchParams = {} }: OverviewPageProps) {
  const demo = firstSearchParamValue(searchParams.demo) === "1";
  return <OverviewWorkbench demo={demo} />;
}
