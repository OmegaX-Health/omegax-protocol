// SPDX-License-Identifier: AGPL-3.0-or-later

import { OraclesWorkbench } from "@/components/oracles-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type OraclesPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function OraclesPage({ searchParams }: OraclesPageProps) {
  return <OraclesWorkbench searchParams={(await searchParams) ?? {}} />;
}
