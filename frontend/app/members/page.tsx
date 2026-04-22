// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { type RouteSearchParams, toURLSearchParams } from "@/lib/search-params";

type MembersPageProps = {
  searchParams?: RouteSearchParams;
};

export default function MembersPage({ searchParams = {} }: MembersPageProps) {
  const params = toURLSearchParams(searchParams);
  params.set("tab", "members");
  redirect(`/plans?${params.toString()}`);
}
