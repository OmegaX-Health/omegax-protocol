// SPDX-License-Identifier: AGPL-3.0-or-later

import { CapitalWorkbench } from "@/components/capital-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type CapitalPageProps = {
  searchParams?: RouteSearchParams;
};

export default function CapitalPage({ searchParams = {} }: CapitalPageProps) {
  return <CapitalWorkbench searchParams={searchParams} />;
}
