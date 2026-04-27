// SPDX-License-Identifier: AGPL-3.0-or-later

import { PlansWorkbench } from "@/components/plans-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type PlansPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function PlansPage({ searchParams }: PlansPageProps) {
  return <PlansWorkbench searchParams={(await searchParams) ?? {}} />;
}
