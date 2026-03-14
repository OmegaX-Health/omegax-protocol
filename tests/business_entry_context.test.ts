// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";

import businessEntryModule from "../frontend/lib/business-entry-context.ts";

const {
  buildBusinessContextHref,
  BUSINESS_SOURCE,
  getBusinessEntryContext,
} = businessEntryModule as unknown as typeof import("../frontend/lib/business-entry-context.ts");

const ORACLE_A = "FFmj5G6RGDKxptWMr2aZBgBLSX2rZCzMZ5t7bwgVmRZw";
const ORACLE_B = "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf";

function withOracleEnv(
  vars: {
    required?: string | null;
    defaultOracle?: string | null;
  },
  run: () => void,
): void {
  const prevRequired = process.env.NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS;
  const prevDefault = process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS;

  if (vars.required == null) delete process.env.NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS;
  else process.env.NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS = vars.required;

  if (vars.defaultOracle == null) delete process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS;
  else process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS = vars.defaultOracle;

  try {
    run();
  } finally {
    if (prevRequired == null) delete process.env.NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS;
    else process.env.NEXT_PUBLIC_REQUIRED_BUSINESS_ORACLE_ADDRESS = prevRequired;

    if (prevDefault == null) delete process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS;
    else process.env.NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS = prevDefault;
  }
}

test("valid query oracle resolves when allowlist env is not set", () => {
  withOracleEnv({ required: null, defaultOracle: null }, () => {
    const params = new URLSearchParams({
      source: BUSINESS_SOURCE,
      requiredOracle: ORACLE_A,
      entry: "reward-pools",
    });
    const ctx = getBusinessEntryContext(params);
    assert.equal(ctx.isBusinessOrigin, true);
    assert.equal(ctx.requiredOracleResolved, ORACLE_A);
    assert.equal(ctx.missingRequiredOracle, false);
  });
});

test("query oracle mismatching allowlist resolves to allowlist env oracle", () => {
  withOracleEnv({ required: ORACLE_B, defaultOracle: ORACLE_A }, () => {
    const params = new URLSearchParams({
      source: BUSINESS_SOURCE,
      requiredOracle: ORACLE_A,
    });
    const ctx = getBusinessEntryContext(params);
    assert.equal(ctx.requiredOracleResolved, ORACLE_B);
    assert.equal(ctx.requiredOracleFromAllowlistEnv, ORACLE_B);
  });
});

test("invalid query oracle falls back to default oracle env when allowlist is unset", () => {
  withOracleEnv({ required: null, defaultOracle: ORACLE_B }, () => {
    const params = new URLSearchParams({
      source: BUSINESS_SOURCE,
      requiredOracle: "not-a-pubkey",
    });
    const ctx = getBusinessEntryContext(params);
    assert.equal(ctx.requiredOracleResolved, ORACLE_B);
    assert.equal(ctx.requiredOracle, null);
  });
});

test("missing all sources in business context yields unresolved required oracle", () => {
  withOracleEnv({ required: null, defaultOracle: null }, () => {
    const params = new URLSearchParams({
      source: BUSINESS_SOURCE,
      entry: "reward-pools",
    });
    const ctx = getBusinessEntryContext(params);
    assert.equal(ctx.requiredOracleResolved, null);
    assert.equal(ctx.missingRequiredOracle, true);
  });
});

test("buildBusinessContextHref preserves business context and applies extras", () => {
  withOracleEnv({ required: ORACLE_A, defaultOracle: null }, () => {
    const ctx = getBusinessEntryContext(
      new URLSearchParams({
        source: BUSINESS_SOURCE,
        entry: "reward-pools",
        orgId: "org_123",
        defaultPoolId: "36mWBmjuKrYmdtnB8nbAD9pbGpzm9yr4E6ecQKiNjw7F",
      }),
    );

    const href = buildBusinessContextHref("/pools/example?section=members", ctx, { section: "coverage" });
    const parsed = new URLSearchParams(href.split("?")[1]);
    assert.equal(parsed.get("source"), BUSINESS_SOURCE);
    assert.equal(parsed.get("entry"), "reward-pools");
    assert.equal(parsed.get("orgId"), "org_123");
    assert.equal(parsed.get("requiredOracle"), ORACLE_A);
    assert.equal(parsed.get("section"), "coverage");
  });
});
