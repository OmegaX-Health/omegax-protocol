// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

const fixtureModuleUrl = new URL("../frontend/lib/devnet-fixtures.ts", import.meta.url);

async function loadFixturesModule(tag: string) {
  return import(`${fixtureModuleUrl.href}?case=${tag}`) as Promise<typeof import("../frontend/lib/devnet-fixtures.ts")>;
}

test("configuredDevnetWallets only returns explicitly configured fixture wallets", async (t) => {
  const keys = [
    "NEXT_PUBLIC_DEVNET_OBSERVER_WALLET",
    "NEXT_PUBLIC_DEVNET_GOVERNANCE_WALLET",
    "NEXT_PUBLIC_DEVNET_POOL_AUTHORITY_WALLET",
    "NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET",
    "NEXT_PUBLIC_DEVNET_RISK_MANAGER_WALLET",
    "NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET",
    "NEXT_PUBLIC_DEVNET_GUARDIAN_WALLET",
    "NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET",
    "NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET",
    "NEXT_PUBLIC_DEVNET_MEMBER_WALLET",
    "NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET",
    "NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET",
    "NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_SOL",
    "NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_REWARD_SPL",
    "NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_COVERAGE_SPL",
    "NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY",
    "NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY_REF_HASH",
    "NEXT_PUBLIC_DEVNET_CLAIM_CASE_PRIMARY",
    "NEXT_PUBLIC_DEVNET_REDEMPTION_REQUEST_PRIMARY",
  ] as const;
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  t.after(() => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  for (const key of keys) {
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_DEVNET_OBSERVER_WALLET = "fixture-observer";
  process.env.NEXT_PUBLIC_DEVNET_MEMBER_WALLET = "fixture-member";
  process.env.NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET = "fixture-capital";
  process.env.NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_SOL = "SOL";
  process.env.NEXT_PUBLIC_DEVNET_PAYMENT_RAIL_COVERAGE_SPL = "fixture-coverage-mint";
  process.env.NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY = "fixture-series";
  process.env.NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY_REF_HASH = "fixture-series-hash";
  process.env.NEXT_PUBLIC_DEVNET_CLAIM_CASE_PRIMARY = "fixture-claim";
  process.env.NEXT_PUBLIC_DEVNET_REDEMPTION_REQUEST_PRIMARY = "fixture-redemption";

  const fixtures = await loadFixturesModule(`configured-${Date.now()}`);
  const configured = fixtures.configuredDevnetWallets();

  assert.deepEqual(
    configured.map((wallet) => wallet.role),
    ["observer", "member", "capital_provider"],
  );
  assert.deepEqual(
    configured.map((wallet) => wallet.address),
    ["fixture-observer", "fixture-member", "fixture-capital"],
  );
  assert.deepEqual(
    fixtures.configuredDevnetPaymentRails().map((rail) => rail.mint),
    ["SOL", "fixture-coverage-mint"],
  );
  assert.deepEqual(
    fixtures.configuredDevnetPolicySeries().map((series) => series.address),
    ["fixture-series"],
  );
  assert.deepEqual(
    fixtures.configuredDevnetClaimCases().map((claimCase) => claimCase.claimAddress),
    ["fixture-claim"],
  );
  assert.deepEqual(
    fixtures.configuredDevnetRedemptionCases().map((request) => request.requestAddress),
    ["fixture-redemption"],
  );
});

test("isFixtureConfigured rejects blanks and the unset placeholder", async () => {
  const fixtures = await loadFixturesModule(`predicate-${Date.now()}`);

  assert.equal(fixtures.isFixtureConfigured(undefined), false);
  assert.equal(fixtures.isFixtureConfigured(""), false);
  assert.equal(fixtures.isFixtureConfigured("11111111111111111111111111111111"), false);
  assert.equal(fixtures.isFixtureConfigured("SOL"), true);
  assert.equal(fixtures.isFixtureConfigured("configured-wallet"), true);
});
