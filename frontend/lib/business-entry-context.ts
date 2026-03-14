// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";

type SearchParamsLike = {
  get(name: string): string | null;
} | null | undefined;

export const BUSINESS_SOURCE = "nexus";
export const BUSINESS_ENTRY_MODAL_SESSION_KEY = "omegax:business-oracle-policy-modal-dismissed:v1";

export type BusinessEntryContext = {
  source: string | null;
  entry: string | null;
  orgId: string | null;
  defaultPoolId: string | null;
  requiredOracle: string | null;
  isBusinessOrigin: boolean;
  requiredOracleResolved: string | null;
  requiredOracleFromAllowlistEnv: string | null;
  requiredOracleFromDefaultEnv: string | null;
  missingRequiredOracle: boolean;
};

function normalizeValue(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

export function normalizePublicKey(value: string | null | undefined): string | null {
  const normalized = normalizeValue(value);
  if (!normalized) return null;
  try {
    return new PublicKey(normalized).toBase58();
  } catch {
    return null;
  }
}

export function getBusinessEntryContext(searchParams: SearchParamsLike): BusinessEntryContext {
  const sourceRaw = normalizeValue(searchParams?.get("source"));
  const sourceNormalized = sourceRaw?.toLowerCase() ?? null;
  const isBusinessOrigin = sourceNormalized === BUSINESS_SOURCE;
  const entry = normalizeValue(searchParams?.get("entry"));
  const orgId = normalizeValue(searchParams?.get("orgId"));
  const defaultPoolId = normalizePublicKey(searchParams?.get("defaultPoolId"));
  const requiredOracleFromQuery = normalizePublicKey(searchParams?.get("requiredOracle"));
  const requiredOracleFromAllowlistEnv = normalizePublicKey(
    process.env.NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS,
  );
  const requiredOracleFromDefaultEnv = normalizePublicKey(process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS);

  let requiredOracleResolved: string | null = null;
  if (requiredOracleFromAllowlistEnv) {
    requiredOracleResolved =
      requiredOracleFromQuery === requiredOracleFromAllowlistEnv
        ? requiredOracleFromQuery
        : requiredOracleFromAllowlistEnv;
  } else {
    requiredOracleResolved = requiredOracleFromQuery ?? requiredOracleFromDefaultEnv;
  }

  return {
    source: sourceRaw,
    entry,
    orgId,
    defaultPoolId,
    requiredOracle: requiredOracleFromQuery,
    isBusinessOrigin,
    requiredOracleResolved,
    requiredOracleFromAllowlistEnv,
    requiredOracleFromDefaultEnv,
    missingRequiredOracle: isBusinessOrigin && !requiredOracleResolved,
  };
}

export function buildBusinessContextHref(
  href: string,
  context: BusinessEntryContext,
  extras?: Record<string, string | number | boolean | null | undefined>,
): string {
  const [pathname, query = ""] = href.split("?", 2);
  const params = new URLSearchParams(query);

  if (context.isBusinessOrigin) {
    params.set("source", BUSINESS_SOURCE);
    if (context.entry) params.set("entry", context.entry);
    if (context.orgId) params.set("orgId", context.orgId);
    if (context.defaultPoolId) params.set("defaultPoolId", context.defaultPoolId);
    if (context.requiredOracleResolved) {
      params.set("requiredOracle", context.requiredOracleResolved);
    }
  }

  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value == null || `${value}`.trim() === "") {
      params.delete(key);
      continue;
    }
    params.set(key, `${value}`);
  }

  const encoded = params.toString();
  return encoded ? `${pathname}?${encoded}` : pathname;
}
