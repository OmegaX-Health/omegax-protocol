// SPDX-License-Identifier: AGPL-3.0-or-later

import { redirect } from "next/navigation";

type CoverageMintRedirectPageProps = {
  params: { poolAddress: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function mapLegacyMode(mode: string): string {
  const normalized = mode.trim().toLowerCase();
  if (normalized === "products") return "series";
  if (normalized === "premium") return "payments";
  if (normalized === "subscribe" || normalized === "issue") return "positions";
  return "series";
}

export default function CoverageMintRedirectPage({ params, searchParams }: CoverageMintRedirectPageProps) {
  const panel = mapLegacyMode(pick(searchParams?.mode));
  redirect(`/pools/${encodeURIComponent(params.poolAddress)}?section=coverage&panel=${encodeURIComponent(panel)}`);
}
