// SPDX-License-Identifier: AGPL-3.0-or-later

import { PlansWorkbench } from "@/components/plans-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type ClaimsPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  return <PlansWorkbench searchParams={(await searchParams) ?? {}} />;
}
