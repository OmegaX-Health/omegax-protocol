// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";

import { loadGenesisLiveBootstrapConfig, schemaKeyHashHex } from "../scripts/support/genesis_live_bootstrap_config.ts";

const GOVERNANCE = "BGN6pVpuD9GPSsExtBi7pe4RLCJrkFVsQd9mw7ZdH8Ez";
const ORACLE = "G4FmvnAEjfoRf26oezPzFQDUtuKFBikMKv2UjAMuBcPb";

test("Genesis live bootstrap config derives canonical Genesis addresses and defaults", () => {
  const config = loadGenesisLiveBootstrapConfig({
    governanceAuthority: GOVERNANCE,
    env: {
      OMEGAX_LIVE_SETTLEMENT_MINT: "So11111111111111111111111111111111111111112",
      OMEGAX_LIVE_ORACLE_WALLET: ORACLE,
      OMEGAX_LIVE_ORACLE_KEYPAIR_PATH: "/tmp/genesis-oracle.json",
      OMEGAX_LIVE_CLUSTER_OVERRIDE: "devnet",
    },
  });

  assert.equal(config.reserveDomain.id, "open-health-usdc");
  assert.equal(config.healthPlan.planId, "genesis-protect-acute-v1");
  assert.equal(config.roles.sponsor, GOVERNANCE);
  assert.equal(config.roles.claimsOperator, GOVERNANCE);
  assert.equal(config.policySeries.event7.seriesId, "genesis-event-7-v1");
  assert.equal(config.policySeries.travel30.seriesId, "genesis-travel-30-v1");
  assert.equal(config.fundingLines.event7Sponsor.lineId, "genesis-event7-sponsor");
  assert.equal(config.fundingLines.travel30Liquidity.lineId, "genesis-travel30-liquidity");
  assert.equal(config.schema.keyHashHex, schemaKeyHashHex("genesis-protect-acute-claim", 1));
  assert.equal(
    config.schema.metadataUri,
    "https://protocol.omegax.health/schemas/genesis-protect-acute-claim-v1.json",
  );
});

test("Genesis live bootstrap config requires LP keypair paths when deposit amounts are set", () => {
  assert.throws(
    () => loadGenesisLiveBootstrapConfig({
      governanceAuthority: GOVERNANCE,
      env: {
        OMEGAX_LIVE_SETTLEMENT_MINT: "So11111111111111111111111111111111111111112",
        OMEGAX_LIVE_ORACLE_WALLET: ORACLE,
        OMEGAX_LIVE_ORACLE_KEYPAIR_PATH: "/tmp/genesis-oracle.json",
        OMEGAX_LIVE_SENIOR_CLASS_DEPOSIT_AMOUNT: "25000",
        OMEGAX_LIVE_CLUSTER_OVERRIDE: "devnet",
      },
    }),
    /OMEGAX_LIVE_SENIOR_LP_KEYPAIR_PATH/,
  );
});

// PT-2026-04-27-05 defense: distinct-operator-keys validation is opt-in via
// OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS. Off by default to preserve existing
// devnet flows; required for mainnet bootstrap.

test("Genesis live bootstrap config rejects role collapse when distinct keys are required", () => {
  // The default config collapses sponsor + claimsOperator + reserveDomainAdmin
  // + pool roles onto governanceAuthority. With the guard set, this must throw.
  assert.throws(
    () => loadGenesisLiveBootstrapConfig({
      governanceAuthority: GOVERNANCE,
      env: {
        OMEGAX_LIVE_SETTLEMENT_MINT: "So11111111111111111111111111111111111111112",
        OMEGAX_LIVE_ORACLE_WALLET: ORACLE,
        OMEGAX_LIVE_ORACLE_KEYPAIR_PATH: "/tmp/genesis-oracle.json",
        OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS: "1",
        OMEGAX_LIVE_CLUSTER_OVERRIDE: "devnet",
      },
    }),
    /OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1.*both resolve to/,
  );
});

test("Genesis live bootstrap config accepts distinct keys when guard is set", () => {
  // Provide distinct keys for every role and verify the config loads cleanly.
  const RESERVE_DOMAIN_ADMIN = "5VPPmSnQzG1ZUyL4f7e6dEsoeQAMFkBs9Pc4FLpEymny";
  const SPONSOR = "EJqzv8aFvK5HxTcJsWejDU6t2Cvz3enNqKZ7VRWkLhvK";
  const SPONSOR_OPERATOR = "5dMXTaepnvLctdXX9awkFfCUDqJobmm2KYi8r5VbyiKy";
  const CLAIMS_OPERATOR = "GkJZRfV4u4qyqQrFt3npJpDrMfbS9KdsfAh9TfFb1zvR";
  const POOL_CURATOR = "8ZWLRpyhLNLBcsRsiX25h5d8GxTW85cCQUsh5wDiSDD3";
  const POOL_ALLOCATOR = "FxWXWk8a9KDTMqcCaWpFfaXNDWhNTRwnAtdb1Q9Eivkc";
  const POOL_SENTINEL = "Bvx7XMRQVe7zP6XW9qBzBjLEr9YDpuAyR1ZKDrn5K2hk";

  const config = loadGenesisLiveBootstrapConfig({
    governanceAuthority: GOVERNANCE,
    env: {
      OMEGAX_LIVE_SETTLEMENT_MINT: "So11111111111111111111111111111111111111112",
      OMEGAX_LIVE_ORACLE_WALLET: ORACLE,
      OMEGAX_LIVE_ORACLE_KEYPAIR_PATH: "/tmp/genesis-oracle.json",
      OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN: RESERVE_DOMAIN_ADMIN,
      OMEGAX_LIVE_SPONSOR_WALLET: SPONSOR,
      OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET: SPONSOR_OPERATOR,
      OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET: CLAIMS_OPERATOR,
      OMEGAX_LIVE_POOL_CURATOR_WALLET: POOL_CURATOR,
      OMEGAX_LIVE_POOL_ALLOCATOR_WALLET: POOL_ALLOCATOR,
      OMEGAX_LIVE_POOL_SENTINEL_WALLET: POOL_SENTINEL,
      OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS: "1",
      // No cluster override needed: with all distinct keys + flag set, this
      // config is mainnet-clean and exercises both the new mainnet guard and
      // the older distinct-keys check.
    },
  });

  assert.equal(config.roles.sponsor, SPONSOR);
  assert.equal(config.roles.claimsOperator, CLAIMS_OPERATOR);
});

// Mainnet privileged-role guard. See
// docs/security/mainnet-privileged-role-controls.md §4 for the policy.

const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const RESERVE_DOMAIN_ADMIN = "5VPPmSnQzG1ZUyL4f7e6dEsoeQAMFkBs9Pc4FLpEymny";
const SPONSOR = "EJqzv8aFvK5HxTcJsWejDU6t2Cvz3enNqKZ7VRWkLhvK";
const SPONSOR_OPERATOR = "5dMXTaepnvLctdXX9awkFfCUDqJobmm2KYi8r5VbyiKy";
const CLAIMS_OPERATOR = "GkJZRfV4u4qyqQrFt3npJpDrMfbS9KdsfAh9TfFb1zvR";
const POOL_CURATOR = "8ZWLRpyhLNLBcsRsiX25h5d8GxTW85cCQUsh5wDiSDD3";
const POOL_ALLOCATOR = "FxWXWk8a9KDTMqcCaWpFfaXNDWhNTRwnAtdb1Q9Eivkc";
const POOL_SENTINEL = "Bvx7XMRQVe7zP6XW9qBzBjLEr9YDpuAyR1ZKDrn5K2hk";

const baseMainnetEnv = () => ({
  OMEGAX_LIVE_SETTLEMENT_MINT: "So11111111111111111111111111111111111111112",
  OMEGAX_LIVE_ORACLE_WALLET: ORACLE,
  OMEGAX_LIVE_ORACLE_KEYPAIR_PATH: "/tmp/genesis-oracle.json",
  SOLANA_RPC_URL: MAINNET_RPC,
});

test("Mainnet bootstrap blocked when OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS is unset", () => {
  assert.throws(
    () => loadGenesisLiveBootstrapConfig({
      governanceAuthority: GOVERNANCE,
      env: baseMainnetEnv(),
    }),
    /Mainnet bootstrap blocked.*OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 is required/,
  );
});

test("Mainnet guard still blocks custom-domain RPC URLs when distinct-keys flag is unset", () => {
  assert.throws(
    () => loadGenesisLiveBootstrapConfig({
      governanceAuthority: GOVERNANCE,
      env: {
        ...baseMainnetEnv(),
        SOLANA_RPC_URL: "https://rpc.omegax.health/solana",
      },
    }),
    /Mainnet bootstrap blocked.*OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 is required/,
  );
});

test("Mainnet bootstrap blocked when role wallets default to governance signer", () => {
  // Distinct-keys flag is set but no per-role wallets; every operational role
  // would silently default to governanceAuthority.
  assert.throws(
    () => loadGenesisLiveBootstrapConfig({
      governanceAuthority: GOVERNANCE,
      env: {
        ...baseMainnetEnv(),
        OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS: "1",
      },
    }),
    /Mainnet bootstrap blocked.*privileged role\(s\) would default to the governance signer.*OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN/,
  );
});

test("Mainnet bootstrap loads cleanly when every privileged role has a distinct wallet", () => {
  const config = loadGenesisLiveBootstrapConfig({
    governanceAuthority: GOVERNANCE,
    env: {
      ...baseMainnetEnv(),
      OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS: "1",
      OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN: RESERVE_DOMAIN_ADMIN,
      OMEGAX_LIVE_SPONSOR_WALLET: SPONSOR,
      OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET: SPONSOR_OPERATOR,
      OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET: CLAIMS_OPERATOR,
      OMEGAX_LIVE_POOL_CURATOR_WALLET: POOL_CURATOR,
      OMEGAX_LIVE_POOL_ALLOCATOR_WALLET: POOL_ALLOCATOR,
      OMEGAX_LIVE_POOL_SENTINEL_WALLET: POOL_SENTINEL,
    },
  });

  assert.equal(config.rpcUrl, MAINNET_RPC);
  assert.equal(config.roles.sponsor, SPONSOR);
  assert.equal(config.roles.claimsOperator, CLAIMS_OPERATOR);
  assert.equal(config.roles.poolSentinel, POOL_SENTINEL);
});

test("Mainnet bootstrap break-glass override allows local-signer defaults but warns to stderr", () => {
  // Capture stderr to verify the BREAK-GLASS warning is emitted.
  const originalWrite = process.stderr.write.bind(process.stderr);
  let captured = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr as any).write = (chunk: any) => {
    captured += String(chunk);
    return true;
  };
  try {
    const config = loadGenesisLiveBootstrapConfig({
      governanceAuthority: GOVERNANCE,
      env: {
        ...baseMainnetEnv(),
        OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET: "1",
      },
    });
    // Roles default to governance under break-glass — that is the documented
    // exception, not a bug. This is what the BREAK-GLASS warning is for.
    assert.equal(config.roles.sponsor, GOVERNANCE);
    assert.equal(config.roles.claimsOperator, GOVERNANCE);
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = originalWrite;
  }
  assert.match(captured, /BREAK-GLASS.*OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1 active/);
});

test("OMEGAX_LIVE_CLUSTER_OVERRIDE=devnet bypasses the mainnet guard even on a mainnet RPC URL", () => {
  // Operator running an isolated rehearsal against a private mainnet-beta-
  // like cluster can opt out via the cluster override. The older opt-in
  // distinct-keys check still fires only when its flag is set, so this
  // call must succeed without per-role env vars.
  const config = loadGenesisLiveBootstrapConfig({
    governanceAuthority: GOVERNANCE,
    env: {
      ...baseMainnetEnv(),
      OMEGAX_LIVE_CLUSTER_OVERRIDE: "devnet",
    },
  });
  assert.equal(config.roles.sponsor, GOVERNANCE);
});
