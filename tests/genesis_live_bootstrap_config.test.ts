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
      },
    }),
    /OMEGAX_LIVE_SENIOR_LP_KEYPAIR_PATH/,
  );
});
