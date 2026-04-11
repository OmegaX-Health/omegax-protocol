// SPDX-License-Identifier: AGPL-3.0-or-later

import { PlansWorkbench } from "@/components/plans-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type ClaimsPageProps = {
  searchParams?: RouteSearchParams;
};

export default function ClaimsPage({ searchParams = {} }: ClaimsPageProps) {
  return <PlansWorkbench searchParams={searchParams} />;
}
