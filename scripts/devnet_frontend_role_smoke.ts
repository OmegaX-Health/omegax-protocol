// SPDX-License-Identifier: AGPL-3.0-or-later

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";

const {
  DEVNET_PROTOCOL_FIXTURE_STATE,
  configuredDevnetPaymentRails,
  configuredDevnetWallets,
} = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");

function fail(message: string): never {
  throw new Error(message);
}

function main() {
  const strict = process.env.DEVNET_FIXTURE_STRICT === "1";

  console.log(strict ? "Frontend devnet parity signoff" : "Frontend devnet smoke");
  console.log(`Reserve domains: ${DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.length}`);
  console.log(`Health plans: ${DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.length}`);
  console.log(`Policy series: ${DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.length}`);
  console.log(`Funding lines: ${DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.length}`);
  console.log(`Liquidity pools: ${DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.length}`);
  console.log(`Capital classes: ${DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.length}`);
  console.log(`Configured wallets: ${configuredDevnetWallets().length}`);
  console.log(`Configured payment rails: ${configuredDevnetPaymentRails().length}`);

  console.log("\nRole matrix:");
  for (const row of DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix) {
    console.log(`- ${row.role}: ${row.actions.join(", ")}`);
  }

  if (strict) {
    const missing = [];
    if (configuredDevnetWallets().length < 6) {
      missing.push("at least 6 non-zero devnet wallet roles");
    }
    if (configuredDevnetPaymentRails().length < 2) {
      missing.push("at least 2 configured devnet payment rails");
    }
    if (DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.length < 2) {
      missing.push("two canonical health plan fixtures");
    }
    if (DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.length < 1) {
      missing.push("one canonical liquidity pool fixture");
    }
    if (missing.length > 0) {
      fail(`Strict frontend signoff failed:\n- ${missing.join("\n- ")}`);
    }
  }
}

main();
