// SPDX-License-Identifier: AGPL-3.0-or-later

import { SchemasWorkbench } from "@/components/schemas-workbench";
import { type RouteSearchParams } from "@/lib/search-params";

type SchemasPageProps = {
  searchParams?: RouteSearchParams;
};

export default function SchemasPage({ searchParams = {} }: SchemasPageProps) {
  return <SchemasWorkbench searchParams={searchParams} />;
}
