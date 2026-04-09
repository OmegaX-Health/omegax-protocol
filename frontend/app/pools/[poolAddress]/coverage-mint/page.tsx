// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

import { buildCanonicalPoolHref } from "@/lib/canonical-routes";

type LegacyCoverageMintPageProps = {
  params: { poolAddress: string };
};

export default function LegacyCoverageMintPage({ params }: LegacyCoverageMintPageProps) {
  redirect(buildCanonicalPoolHref(params.poolAddress, { section: "claims" }));
}
