// SPDX-License-Identifier: AGPL-3.0-or-later

import { PlansWorkbench } from "@/components/plans-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type MembersPageProps = {
  searchParams?: RouteSearchParams;
};

export default function MembersPage({ searchParams = {} }: MembersPageProps) {
  return <PlansWorkbench searchParams={searchParams} />;
}
