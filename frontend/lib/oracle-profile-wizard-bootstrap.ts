// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatRpcError } from "@/lib/rpc-errors";
import type { OracleWithProfileSummary, SchemaSummary } from "@/lib/protocol";

export type OracleWizardMode = "register" | "update";
export type OracleWizardLoadedProfile = OracleWithProfileSummary & {
  profile: NonNullable<OracleWithProfileSummary["profile"]>;
};

export type OracleWizardBlockingErrorKind = "invalid_route" | "profile_missing" | "network";

export type OracleWizardBlockingError = {
  kind: OracleWizardBlockingErrorKind;
  message: string;
};

export type OracleWizardBootstrapState = {
  blockingError: OracleWizardBlockingError | null;
  schemaCatalogWarning: string | null;
  schemas: SchemaSummary[];
  profile: OracleWizardLoadedProfile | null;
};

type ResolveOracleWizardBootstrapParams = {
  mode: OracleWizardMode;
  normalizedRouteOracle: string;
  routeOracleValid: boolean;
  rpcEndpoint: string;
  schemasResult: PromiseSettledResult<SchemaSummary[]>;
  oraclesResult: PromiseSettledResult<OracleWithProfileSummary[]>;
};

export function resolveOracleWizardBootstrapState(
  params: ResolveOracleWizardBootstrapParams,
): OracleWizardBootstrapState {
  if (params.mode === "update" && !params.routeOracleValid) {
    return {
      blockingError: {
        kind: "invalid_route",
        message: "This oracle address is not a valid Solana public key.",
      },
      schemaCatalogWarning: null,
      schemas: [],
      profile: null,
    };
  }

  const schemaCatalogWarning = params.schemasResult.status === "fulfilled"
    ? null
    : formatRpcError(params.schemasResult.reason, {
      fallback: "Schema catalog is temporarily unavailable. You can still continue and add schema hashes manually.",
      rpcEndpoint: params.rpcEndpoint,
    });

  const schemas = params.schemasResult.status === "fulfilled"
    ? params.schemasResult.value
    : [];

  if (params.mode === "register") {
    return {
      blockingError: null,
      schemaCatalogWarning,
      schemas,
      profile: null,
    };
  }

  if (params.oraclesResult.status === "rejected") {
    return {
      blockingError: {
        kind: "network",
        message: formatRpcError(params.oraclesResult.reason, {
          fallback: "Failed to load the selected oracle profile.",
          rpcEndpoint: params.rpcEndpoint,
        }),
      },
      schemaCatalogWarning,
      schemas,
      profile: null,
    };
  }

  const matched = params.oraclesResult.value.find((row) => row.oracle === params.normalizedRouteOracle) ?? null;
  if (!matched?.profile) {
    return {
      blockingError: {
        kind: "profile_missing",
        message: "No structured oracle profile is published for this signer on the current network.",
      },
      schemaCatalogWarning,
      schemas,
      profile: null,
    };
  }

  return {
    blockingError: null,
    schemaCatalogWarning,
    schemas,
    profile: matched as OracleWizardLoadedProfile,
  };
}
