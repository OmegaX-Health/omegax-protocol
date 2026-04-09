// SPDX-License-Identifier: AGPL-3.0-or-later

import { firstSeriesAddressForPlan, linkedContextForPool } from "@/lib/workbench";

export type CanonicalPoolSection =
  | "coverage"
  | "claims"
  | "governance"
  | "liquidity"
  | "members"
  | "oracles"
  | "schemas"
  | "settings"
  | "treasury";

type CanonicalPoolHrefOptions = {
  panel?: string | null;
  section?: CanonicalPoolSection | null;
};

export function buildCanonicalPoolHref(
  poolAddress: string,
  { panel, section }: CanonicalPoolHrefOptions = {},
): string {
  const params = new URLSearchParams();
  const linked = linkedContextForPool(poolAddress);

  let pathname = "/capital";
  let resolvedPanel = panel?.trim() || "";

  switch (section) {
    case "oracles":
      pathname = "/oracles";
      params.set("pool", poolAddress);
      resolvedPanel ||= "registry";
      break;
    case "claims":
      pathname = "/plans";
      resolvedPanel ||= "claims";
      break;
    case "governance":
      pathname = "/governance";
      resolvedPanel ||= "queue";
      break;
    case "schemas":
      pathname = "/plans";
      resolvedPanel ||= "schemas";
      break;
    case "members":
      pathname = "/plans";
      resolvedPanel ||= "members";
      break;
    case "coverage":
    case "settings":
      pathname = "/plans";
      resolvedPanel ||= section === "coverage" ? "series" : "settings";
      break;
    case "treasury":
      pathname = "/capital";
      params.set("pool", poolAddress);
      resolvedPanel ||= "queue";
      break;
    case "liquidity":
    default:
      pathname = "/capital";
      params.set("pool", poolAddress);
      resolvedPanel ||= "overview";
      break;
  }

  if (resolvedPanel) {
    params.set("tab", resolvedPanel);
  }

  if (pathname === "/plans") {
    if (linked.plan) params.set("plan", linked.plan);
    const resolvedSeries = linked.series || (resolvedPanel === "schemas" ? firstSeriesAddressForPlan(linked.plan) : null);
    if (resolvedSeries) params.set("series", resolvedSeries);
  }

  return `${pathname}?${params.toString()}`;
}
