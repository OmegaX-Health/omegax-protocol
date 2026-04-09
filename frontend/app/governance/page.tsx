// SPDX-License-Identifier: AGPL-3.0-or-later

import { GovernanceWorkbench } from "@/components/governance-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type GovernancePageProps = {
  searchParams?: RouteSearchParams;
};

export default function GovernancePage({ searchParams = {} }: GovernancePageProps) {
  return <GovernanceWorkbench searchParams={searchParams} />;
}
