// SPDX-License-Identifier: AGPL-3.0-or-later

import { GovernanceWorkbench } from "@/components/governance-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type GovernancePageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function GovernancePage({ searchParams }: GovernancePageProps) {
  return <GovernanceWorkbench searchParams={(await searchParams) ?? {}} />;
}
