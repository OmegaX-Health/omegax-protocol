// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { linkedContextForPool } from "@/lib/workbench";

type LegacyCoverageMintPageProps = {
  params: { poolAddress: string };
};

export default function LegacyCoverageMintPage({ params }: LegacyCoverageMintPageProps) {
  const linked = linkedContextForPool(params.poolAddress);
  const nextParams = new URLSearchParams({
    tab: "schemas",
  });
  if (linked.plan) nextParams.set("plan", linked.plan);
  if (linked.series) nextParams.set("series", linked.series);

  redirect(`/plans?${nextParams.toString()}`);
}
