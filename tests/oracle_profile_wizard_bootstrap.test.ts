import assert from "node:assert/strict";
import test from "node:test";

import wizardBootstrapModule from "../frontend/lib/oracle-profile-wizard-bootstrap.ts";
import type { OracleWithProfileSummary, SchemaSummary } from "../frontend/lib/protocol.ts";

const { resolveOracleWizardBootstrapState } =
  wizardBootstrapModule as typeof import("../frontend/lib/oracle-profile-wizard-bootstrap.ts");

const schemaFixture: SchemaSummary = {
  address: "schema-address",
  schemaKey: "lab.results",
  schemaKeyHashHex: "a".repeat(64),
  schemaHashHex: "b".repeat(64),
  version: 1,
  metadataUri: "https://example.com/schema.json",
  authority: "authority",
  verified: true,
  bump: 1,
};

const oracleProfileFixture: OracleWithProfileSummary = {
  address: "oracle-registry-address",
  oracle: "oracle-signer",
  active: true,
  claimed: false,
  admin: "admin-wallet",
  bump: 1,
  metadataUri: "",
  profile: {
    oracle: "oracle-signer",
    admin: "admin-wallet",
    oracleType: 0,
    displayName: "Regional Care Diagnostics",
    legalName: "Regional Care Diagnostics LLC",
    websiteUrl: "https://example.com",
    appUrl: "",
    logoUri: "",
    webhookUrl: "",
    supportedSchemaCount: 1,
    supportedSchemaKeyHashesHex: ["a".repeat(64)],
    claimed: false,
  },
};

test("register mode stays usable when only the schema catalog fails", () => {
  const state = resolveOracleWizardBootstrapState({
    mode: "register",
    normalizedRouteOracle: "",
    routeOracleValid: true,
    rpcEndpoint: "https://rpc.example",
    schemasResult: {
      status: "rejected",
      reason: new Error("schema fetch failed"),
    },
    oraclesResult: {
      status: "fulfilled",
      value: [],
    },
  });

  assert.equal(state.blockingError, null);
  assert.equal(state.schemas.length, 0);
  assert.equal(typeof state.schemaCatalogWarning, "string");
  assert.equal(state.profile, null);
});

test("update mode blocks invalid route parameters before profile lookup", () => {
  const state = resolveOracleWizardBootstrapState({
    mode: "update",
    normalizedRouteOracle: "not-a-pubkey",
    routeOracleValid: false,
    rpcEndpoint: "https://rpc.example",
    schemasResult: {
      status: "fulfilled",
      value: [schemaFixture],
    },
    oraclesResult: {
      status: "fulfilled",
      value: [oracleProfileFixture],
    },
  });

  assert.equal(state.blockingError?.kind, "invalid_route");
  assert.equal(state.profile, null);
});

test("update mode reports missing profiles without losing the loaded schema catalog", () => {
  const state = resolveOracleWizardBootstrapState({
    mode: "update",
    normalizedRouteOracle: "missing-signer",
    routeOracleValid: true,
    rpcEndpoint: "https://rpc.example",
    schemasResult: {
      status: "fulfilled",
      value: [schemaFixture],
    },
    oraclesResult: {
      status: "fulfilled",
      value: [],
    },
  });

  assert.equal(state.blockingError?.kind, "profile_missing");
  assert.equal(state.schemas.length, 1);
  assert.equal(state.schemaCatalogWarning, null);
});

test("update mode can still load a profile when the schema catalog is temporarily unavailable", () => {
  const state = resolveOracleWizardBootstrapState({
    mode: "update",
    normalizedRouteOracle: "oracle-signer",
    routeOracleValid: true,
    rpcEndpoint: "https://rpc.example",
    schemasResult: {
      status: "rejected",
      reason: new Error("schema fetch failed"),
    },
    oraclesResult: {
      status: "fulfilled",
      value: [oracleProfileFixture],
    },
  });

  assert.equal(state.blockingError, null);
  assert.equal(state.profile?.oracle, "oracle-signer");
  assert.equal(typeof state.schemaCatalogWarning, "string");
});
