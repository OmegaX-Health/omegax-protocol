// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { type RouteSearchParams, toURLSearchParams } from "@/lib/search-params";

type MembersPageProps = {
  searchParams?: Promise<RouteSearchParams>;
};

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const params = toURLSearchParams((await searchParams) ?? {});
  params.set("tab", "members");
  redirect(`/plans?${params.toString()}`);
}
