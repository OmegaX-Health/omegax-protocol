// SPDX-License-Identifier: AGPL-3.0-or-later

import { firstProtectionSeriesAddressForPlan, firstSeriesAddressForPlan, linkedContextForPool } from "@/lib/workbench";

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

  if (poolAddress) params.set("pool", poolAddress);

  switch (section) {
    case "claims":
      pathname = "/claims";
      params.set("panel", panel?.trim() || "ledger");
      if (linked.plan) params.set("plan", linked.plan);
      if (linked.series) params.set("series", linked.series);
      break;
    case "members":
      pathname = "/members";
      params.set("panel", panel?.trim() || "enroll");
      if (linked.plan) params.set("plan", linked.plan);
      if (linked.series) params.set("series", linked.series);
      break;
    case "schemas":
      pathname = "/schemas";
      params.set("panel", panel?.trim() || "registry");
      if (linked.series) params.set("series", linked.series);
      else if (linked.plan) {
        const fallbackSeries = firstSeriesAddressForPlan(linked.plan);
        if (fallbackSeries) params.set("series", fallbackSeries);
      }
      break;
    case "oracles":
      pathname = "/oracles";
      params.set("tab", panel?.trim() || "registry");
      break;
    case "governance":
      pathname = "/governance";
      params.set("tab", panel?.trim() || "queue");
      break;
    case "coverage":
      pathname = "/plans";
      params.set("tab", "coverage");
      if (linked.plan) params.set("plan", linked.plan);
      if (linked.plan) {
        const protectionSeries = linked.series || firstProtectionSeriesAddressForPlan(linked.plan);
        if (protectionSeries) params.set("series", protectionSeries);
      }
      break;
    case "settings":
      pathname = "/capital";
      params.set("tab", "classes");
      break;
    case "treasury":
      pathname = "/capital";
      params.set("tab", panel?.trim() || "queue");
      break;
    case "liquidity":
    default:
      pathname = "/capital";
      params.set("tab", panel?.trim() || "overview");
      break;
  }

  return `${pathname}?${params.toString()}`;
}
