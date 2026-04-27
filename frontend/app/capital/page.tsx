// SPDX-License-Identifier: AGPL-3.0-or-later

import { CapitalWorkbench } from "@/components/capital-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type CapitalPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function CapitalPage({ searchParams }: CapitalPageProps) {
  return <CapitalWorkbench searchParams={(await searchParams) ?? {}} />;
}
