// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { buildCanonicalPoolHref } from "@/lib/canonical-routes";

type LegacyCoverageMintPageProps = {
  params: Promise<{ poolAddress: string }>;
};

export default async function LegacyCoverageMintPage({ params }: LegacyCoverageMintPageProps) {
  const { poolAddress } = await params;
  redirect(buildCanonicalPoolHref(poolAddress, { section: "claims" }));
}
