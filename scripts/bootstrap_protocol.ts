// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE, DEFAULT_HEALTH_PLAN_ADDRESS, DEFAULT_LIQUIDITY_POOL_ADDRESS } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultPda,
  getProgramId,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const OUTPUT_DIR = resolve(process.cwd(), "devnet");
const MANIFEST_PATH = resolve(OUTPUT_DIR, "health-capital-markets-manifest.json");
const ENV_PATH = resolve(OUTPUT_DIR, "health-capital-markets.env");

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, currentValue) => (typeof currentValue === "bigint" ? currentValue.toString() : currentValue),
    2,
  );
}

function envLines(): string[] {
  const primaryPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const primaryPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
  return [
    `NEXT_PUBLIC_PROTOCOL_PROGRAM_ID=${getProgramId().toBase58()}`,
    `NEXT_PUBLIC_DEVNET_SETTLEMENT_MINT=${DEVNET_PROTOCOL_FIXTURE_STATE.settlementMint}`,
    `NEXT_PUBLIC_DEVNET_REWARD_MINT=${DEVNET_PROTOCOL_FIXTURE_STATE.rewardMint}`,
    `NEXT_PUBLIC_DEVNET_WRAPPER_SETTLEMENT_MINT=${DEVNET_PROTOCOL_FIXTURE_STATE.wrapperSettlementMint}`,
    `NEXT_PUBLIC_DEFAULT_HEALTH_PLAN_ADDRESS=${DEFAULT_HEALTH_PLAN_ADDRESS}`,
    `NEXT_PUBLIC_DEFAULT_LIQUIDITY_POOL_ADDRESS=${DEFAULT_LIQUIDITY_POOL_ADDRESS}`,
    `NEXT_PUBLIC_PRIMARY_RESERVE_DOMAIN=${DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains[0]!.address}`,
    `NEXT_PUBLIC_PRIMARY_HEALTH_PLAN_ID=${primaryPlan.planId}`,
    `NEXT_PUBLIC_PRIMARY_LIQUIDITY_POOL_ID=${primaryPool.poolId}`,
  ];
}

function derivedDomainAssetScopes() {
  const keyedScopes = new Map<string, {
    address: string;
    assetMint: string;
    reserveDomain: string;
  }>();

  const addScope = (reserveDomain: string, assetMint: string) => {
    const key = `${reserveDomain}:${assetMint}`;
    if (keyedScopes.has(key)) return;
    keyedScopes.set(key, {
      reserveDomain,
      assetMint,
      address: deriveDomainAssetVaultPda({ reserveDomain, assetMint }).toBase58(),
    });
  };

  for (const scope of DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetVaults) {
    addScope(scope.reserveDomain, scope.assetMint);
  }
  for (const line of DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines) {
    addScope(line.reserveDomain, line.assetMint);
  }
  for (const pool of DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools) {
    addScope(pool.reserveDomain, pool.depositAssetMint);
  }

  return [...keyedScopes.values()].sort((left, right) =>
    `${left.reserveDomain}:${left.assetMint}`.localeCompare(`${right.reserveDomain}:${right.assetMint}`),
  );
}

function derivedDomainAssetLedgers() {
  return derivedDomainAssetScopes().map((scope) => {
    const existing = DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetLedgers.find((row) =>
      row.reserveDomain === scope.reserveDomain && row.assetMint === scope.assetMint
    );
    return {
      address: deriveDomainAssetLedgerPda({
        reserveDomain: scope.reserveDomain,
        assetMint: scope.assetMint,
      }).toBase58(),
      reserveDomain: scope.reserveDomain,
      assetMint: scope.assetMint,
      ...(existing?.sheet ? { sheet: existing.sheet } : {}),
    };
  });
}

function manifest() {
  return {
    generatedAt: new Date().toISOString(),
    programId: getProgramId().toBase58(),
    migrationMode: "hard_break_devnet",
    retiredLegacySeedsToIgnore: [
      "pool",
      "pool_terms",
      "pool_liquidity_config",
      "pool_capital_class",
      "pool_treasury_reserve",
      "pool_oracle_policy",
      "pool_control_authority",
      "pool_automation_policy",
    ],
    steps: [
      "Ignore or archive retired pre-rearchitecture devnet accounts by retired seed prefix.",
      "Create reserve domains before any plan, pool, or liability state.",
      "Create domain asset vaults and ledgers per [reserve_domain, asset_mint].",
      "Create health plans and policy series with immutable live economic semantics.",
      "Open funding lines for sponsor budgets, premiums, and liquidity allocations.",
      "Create liquidity pools, capital classes, and allocation positions.",
      "Use the fixture ids below as stable demo and smoke-test anchors.",
    ],
    reserveDomains: DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains,
    domainAssetVaults: derivedDomainAssetScopes(),
    domainAssetLedgers: derivedDomainAssetLedgers(),
    healthPlans: DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans,
    policySeries: DEVNET_PROTOCOL_FIXTURE_STATE.policySeries,
    fundingLines: DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines,
    liquidityPools: DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools,
    capitalClasses: DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses,
    allocationPositions: DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions,
    obligations: DEVNET_PROTOCOL_FIXTURE_STATE.obligations,
    claimCases: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases,
    legacyArtifactsRetired: DEVNET_PROTOCOL_FIXTURE_STATE.legacyArtifactsRetired,
  };
}

function main() {
  writeFile(MANIFEST_PATH, `${stringify(manifest())}\n`);
  writeFile(ENV_PATH, `${envLines().join("\n")}\n`);

  console.log(`[bootstrap] manifest=${MANIFEST_PATH}`);
  console.log(`[bootstrap] env=${ENV_PATH}`);
  console.log(`[bootstrap] default_health_plan=${DEFAULT_HEALTH_PLAN_ADDRESS}`);
  console.log(`[bootstrap] default_liquidity_pool=${DEFAULT_LIQUIDITY_POOL_ADDRESS}`);
}

main();
