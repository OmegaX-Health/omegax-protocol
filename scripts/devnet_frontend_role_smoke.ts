// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";

function loadLocalEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  const source = readFileSync(path, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key]?.trim()) {
      continue;
    }
    const value = trimmed.slice(separator + 1).trim();
    process.env[key] = value;
  }
}

function loadFrontendEnv(): void {
  loadLocalEnvFile(new URL("../frontend/.env.local", import.meta.url).pathname);
  loadLocalEnvFile(new URL("../.env.local", import.meta.url).pathname);
}

function fail(message: string): never {
  throw new Error(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRpcRateLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("429 Too Many Requests") || message.includes("Too many requests");
}

async function withRpcRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let delayMs = 1_000;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!isRpcRateLimit(error) || attempt === 5) {
        throw error;
      }
      console.warn(`[devnet-smoke] ${label} hit RPC rate limits, retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
  throw new Error(`Unreachable retry state for ${label}`);
}

function configured(value: string | null | undefined): boolean {
  return Boolean(value && value.trim() && value.trim() !== "11111111111111111111111111111111");
}

function requireBaseEnv(name: string, value: string | null | undefined, missing: string[]): void {
  if (!configured(value)) {
    missing.push(name);
  }
}

function assertIncludesConfiguredAddresses(label: string, expected: string[], discovered: string[]): void {
  const missing = expected.filter((value) => !discovered.includes(value));
  if (missing.length > 0) {
    fail(`${label} missing on-chain entries for: ${missing.join(", ")}`);
  }
}

async function main() {
  loadFrontendEnv();

  const strict = process.env.DEVNET_FIXTURE_STRICT === "1";
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    || process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT
    || clusterApiUrl("devnet");
  const connection = new Connection(endpoint, "confirmed");

  const fixtures = await import("../frontend/lib/devnet-fixtures.ts");
  const protocol = await import("../frontend/lib/protocol.ts");

  const {
    DEVNET_NATIVE_SOL_RAIL,
    DEVNET_FIXTURES,
    configuredDevnetClaimCases,
    configuredDevnetPaymentRails,
    configuredDevnetPolicySeries,
    configuredDevnetRedemptionCases,
    configuredDevnetWallets,
    isFixtureConfigured,
  } = fixtures;
  const {
    fetchProtocolConfig,
    listCoverageClaims,
    listMemberCycles,
    listOracleStakePositions,
    listOraclesWithProfiles,
    listOutcomeAggregates,
    listPolicyPositions,
    listPolicySeries,
    listPolicySeriesPaymentOptions,
    listPoolCapitalClasses,
    listPoolControlAuthorities,
    ZERO_PUBKEY,
    listPoolRedemptionRequests,
    listPoolTerms,
  } = protocol;

  const missingBaseEnv: string[] = [];
  requireBaseEnv("NEXT_PUBLIC_PROTOCOL_PROGRAM_ID", process.env.NEXT_PUBLIC_PROTOCOL_PROGRAM_ID, missingBaseEnv);
  requireBaseEnv("NEXT_PUBLIC_DEFAULT_POOL_ADDRESS", DEVNET_FIXTURES.defaultPoolAddress, missingBaseEnv);
  requireBaseEnv("NEXT_PUBLIC_DEFAULT_ORACLE_ADDRESS", DEVNET_FIXTURES.requiredOracleAddress, missingBaseEnv);
  requireBaseEnv("NEXT_PUBLIC_GOVERNANCE_REALM", DEVNET_FIXTURES.governanceRealm, missingBaseEnv);
  requireBaseEnv("NEXT_PUBLIC_GOVERNANCE_CONFIG", DEVNET_FIXTURES.governanceConfig, missingBaseEnv);
  if (missingBaseEnv.length > 0) {
    fail(`Missing base frontend devnet env:\n- ${missingBaseEnv.join("\n- ")}`);
  }

  const governanceRealmInfo = await withRpcRetry("governance realm lookup", () =>
    connection.getAccountInfo(new PublicKey(DEVNET_FIXTURES.governanceRealm), "confirmed"));
  const governanceConfigInfo = await withRpcRetry("governance config lookup", () =>
    connection.getAccountInfo(new PublicKey(DEVNET_FIXTURES.governanceConfig), "confirmed"));
  const poolInfo = await withRpcRetry("default pool lookup", () =>
    connection.getAccountInfo(new PublicKey(DEVNET_FIXTURES.defaultPoolAddress), "confirmed"));
  const oracleInfo = await withRpcRetry("default oracle lookup", () =>
    connection.getAccountInfo(new PublicKey(DEVNET_FIXTURES.requiredOracleAddress), "confirmed"));
  const protocolConfig = await withRpcRetry("protocol config lookup", () => fetchProtocolConfig({ connection }));

  if (!governanceRealmInfo) {
    fail(`Governance realm ${DEVNET_FIXTURES.governanceRealm} was not found on the configured RPC.`);
  }
  if (!governanceConfigInfo) {
    fail(`Governance config ${DEVNET_FIXTURES.governanceConfig} was not found on the configured RPC.`);
  }
  if (!poolInfo) {
    fail(`Default pool ${DEVNET_FIXTURES.defaultPoolAddress} was not found on the configured RPC.`);
  }
  if (!oracleInfo) {
    fail(`Default oracle ${DEVNET_FIXTURES.requiredOracleAddress} was not found on the configured RPC.`);
  }
  if (!protocolConfig) {
    fail(
      "Protocol config PDA was not found on the configured RPC. "
      + `This usually means the live program at ${process.env.NEXT_PUBLIC_PROTOCOL_PROGRAM_ID} is not initialized or does not match the current repo client surface. `
      + "Frontend parity signoff cannot succeed until the devnet program and repo contract are aligned.",
    );
  }

  console.log(strict ? "Frontend devnet parity signoff" : "Frontend devnet smoke");
  console.log(`RPC: ${endpoint}`);
  console.log(`Protocol config: ${protocolConfig.address}`);
  console.log(`Configured wallets: ${configuredDevnetWallets().length}`);
  console.log(`Configured payment rails: ${configuredDevnetPaymentRails().length}`);
  console.log(`Configured policy series: ${configuredDevnetPolicySeries().length}`);
  console.log(`Configured claim cases: ${configuredDevnetClaimCases().length}`);
  console.log(`Configured redemption cases: ${configuredDevnetRedemptionCases().length}`);

  console.log("\nManual role/action matrix:");
  for (const row of DEVNET_FIXTURES.roleMatrix) {
    console.log(`- ${row.role}: ${row.actions.join(", ")}`);
  }

  if (!strict) {
    console.log("\nRole-matrix fixtures are optional in smoke mode. Set DEVNET_FIXTURE_STRICT=1 for full parity signoff.");
  }

  if (strict) {
    const missingStrictEnv: string[] = [];
    for (const wallet of DEVNET_FIXTURES.wallets) {
      if (!isFixtureConfigured(wallet.address) && wallet.envVar) {
        missingStrictEnv.push(wallet.envVar);
      }
    }
    for (const rail of DEVNET_FIXTURES.paymentRails) {
      if (rail.envVar && !isFixtureConfigured(rail.mint)) {
        missingStrictEnv.push(rail.envVar);
      }
    }
    for (const series of DEVNET_FIXTURES.policySeries) {
      if (!isFixtureConfigured(series.address) && series.envVar) {
        missingStrictEnv.push(series.envVar);
      }
    }
    if (!isFixtureConfigured(DEVNET_FIXTURES.oracleStake.stakeMint)) {
      missingStrictEnv.push("NEXT_PUBLIC_DEVNET_STAKE_MINT");
    }
    if (!isFixtureConfigured(DEVNET_FIXTURES.oracleStake.stakeVault)) {
      missingStrictEnv.push("NEXT_PUBLIC_DEVNET_STAKE_VAULT");
    }
    if (!isFixtureConfigured(DEVNET_FIXTURES.oracleStake.stakePosition)) {
      missingStrictEnv.push("NEXT_PUBLIC_DEVNET_STAKE_POSITION");
    }
    if (!isFixtureConfigured(DEVNET_FIXTURES.oracleStake.slashTreasuryTokenAccount)) {
      missingStrictEnv.push("NEXT_PUBLIC_DEVNET_SLASH_TREASURY_TOKEN_ACCOUNT");
    }
    for (const claimCase of DEVNET_FIXTURES.claimCases) {
      if (!isFixtureConfigured(claimCase.claimAddress)) {
        missingStrictEnv.push("NEXT_PUBLIC_DEVNET_CLAIM_CASE_PRIMARY");
      }
    }
    for (const redemptionCase of DEVNET_FIXTURES.redemptionCases) {
      if (!isFixtureConfigured(redemptionCase.requestAddress)) {
        missingStrictEnv.push("NEXT_PUBLIC_DEVNET_REDEMPTION_REQUEST_PRIMARY");
      }
    }
    if (missingStrictEnv.length > 0) {
      fail(`Missing required devnet signoff fixtures:\n- ${Array.from(new Set(missingStrictEnv)).join("\n- ")}`);
    }
  }

  const poolAddress = DEVNET_FIXTURES.defaultPoolAddress;
  const terms = await withRpcRetry("listPoolTerms", () =>
    listPoolTerms({ connection, poolAddress, search: null }));
  const controls = await withRpcRetry("listPoolControlAuthorities", () =>
    listPoolControlAuthorities({ connection, poolAddress, search: null }));
  const series = await withRpcRetry("listPolicySeries", () =>
    listPolicySeries({ connection, poolAddress, activeOnly: false, search: null }));
  const claims = await withRpcRetry("listCoverageClaims", () =>
    listCoverageClaims({ connection, poolAddress, search: null }));
  const redemptions = await withRpcRetry("listPoolRedemptionRequests", () =>
    listPoolRedemptionRequests({ connection, poolAddress, search: null }));
  const capitalClasses = await withRpcRetry("listPoolCapitalClasses", () =>
    listPoolCapitalClasses({ connection, poolAddress, search: null }));
  const aggregates = await withRpcRetry("listOutcomeAggregates", () =>
    listOutcomeAggregates({ connection, poolAddress, search: null }));
  const cycles = await withRpcRetry("listMemberCycles", () =>
    listMemberCycles({ connection, poolAddress, search: null }));
  const oracles = await withRpcRetry("listOraclesWithProfiles", () =>
    listOraclesWithProfiles({ connection, activeOnly: false }));
  const stakePositions = await withRpcRetry("listOracleStakePositions", () =>
    listOracleStakePositions({ connection, search: null }));
  const policyPositions = await withRpcRetry("listPolicyPositions", () =>
    listPolicyPositions({ connection, poolAddress, search: null }));
  const paymentOptions = await withRpcRetry("listPolicySeriesPaymentOptions", () =>
    listPolicySeriesPaymentOptions({
      connection,
      poolAddress,
      activeOnly: false,
      search: null,
    }));

  console.log(`\nPool ${poolAddress}`);
  console.log(`- terms: ${terms.length}`);
  console.log(`- control authorities: ${controls.length}`);
  console.log(`- policy series: ${series.length}`);
  console.log(`- policy positions: ${policyPositions.length}`);
  console.log(`- payment options: ${paymentOptions.length}`);
  console.log(`- coverage claims: ${claims.length}`);
  console.log(`- redemption requests: ${redemptions.length}`);
  console.log(`- capital classes: ${capitalClasses.length}`);
  console.log(`- outcome aggregates: ${aggregates.length}`);
  console.log(`- member cycles: ${cycles.length}`);
  console.log(`- registry oracles: ${oracles.length}`);
  console.log(`- oracle stake positions: ${stakePositions.length}`);
  console.log(`- protocol governance authority: ${protocolConfig.governanceAuthority}`);
  console.log(`- stake mint: ${protocolConfig.defaultStakeMint}`);

  if (terms.length === 0) {
    fail("Devnet smoke requires at least one pool terms account for the default pool.");
  }
  if (oracles.length === 0) {
    fail("Devnet smoke requires at least one registered oracle profile.");
  }
  if (!oracles.some((entry) => entry.oracle === DEVNET_FIXTURES.requiredOracleAddress)) {
    fail(`Required oracle ${DEVNET_FIXTURES.requiredOracleAddress} was not found in the registry.`);
  }

  const warnings: string[] = [];
  if (controls.length === 0) {
    warnings.push("No pool control authorities found for the default pool.");
  }
  if (series.length === 0) {
    warnings.push("No policy series found for the default pool.");
  }
  if (capitalClasses.length === 0) {
    warnings.push("No capital classes found for the default pool.");
  }
  if (paymentOptions.length === 0) {
    warnings.push("No policy-series payment options are indexed for the default pool.");
  }
  if (stakePositions.length === 0) {
    warnings.push("No oracle stake positions are indexed for the deployment.");
  }
  if (policyPositions.length === 0) {
    warnings.push("No policy positions are indexed for the default pool.");
  }
  if (claims.length === 0) {
    warnings.push("No coverage claims are indexed for the default pool.");
  }
  if (redemptions.length === 0) {
    warnings.push("No redemption requests are indexed for the default pool.");
  }
  if (warnings.length > 0) {
    console.log("\nReadiness gaps:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
    if (strict) {
      fail(`Strict signoff blocked by readiness gaps:\n- ${warnings.join("\n- ")}`);
    }
  }

  if (strict) {
    const configuredWallets = new Map(
      configuredDevnetWallets().map((wallet) => [wallet.role, wallet.address]),
    );
    const control = controls[0] ?? null;
    if (!control) {
      fail("Strict signoff requires a pool control-authority account.");
    }
    if (configuredWallets.get("pool_operator") && control.operatorAuthority !== configuredWallets.get("pool_operator")) {
      fail(`Pool operator mismatch: expected ${configuredWallets.get("pool_operator")} got ${control.operatorAuthority}`);
    }
    if (configuredWallets.get("risk_manager") && control.riskManagerAuthority !== configuredWallets.get("risk_manager")) {
      fail(`Risk manager mismatch: expected ${configuredWallets.get("risk_manager")} got ${control.riskManagerAuthority}`);
    }
    if (configuredWallets.get("compliance_authority") && control.complianceAuthority !== configuredWallets.get("compliance_authority")) {
      fail(`Compliance authority mismatch: expected ${configuredWallets.get("compliance_authority")} got ${control.complianceAuthority}`);
    }
    if (configuredWallets.get("guardian") && control.guardianAuthority !== configuredWallets.get("guardian")) {
      fail(`Guardian mismatch: expected ${configuredWallets.get("guardian")} got ${control.guardianAuthority}`);
    }

    assertIncludesConfiguredAddresses(
      "Policy series",
      configuredDevnetPolicySeries().map((entry) => entry.address),
      series.map((entry) => entry.address),
    );
    assertIncludesConfiguredAddresses(
      "Coverage claim cases",
      configuredDevnetClaimCases().map((entry) => entry.claimAddress),
      claims.map((entry) => entry.address),
    );
    assertIncludesConfiguredAddresses(
      "Redemption requests",
      configuredDevnetRedemptionCases().map((entry) => entry.requestAddress),
      redemptions.map((entry) => entry.address),
    );

    const expectedStake = DEVNET_FIXTURES.oracleStake;
    if (!stakePositions.some((entry) =>
      entry.address === expectedStake.stakePosition
      && entry.stakeMint === expectedStake.stakeMint
      && entry.stakeVault === expectedStake.stakeVault)) {
      fail(`Configured oracle stake position ${expectedStake.stakePosition} was not found with the expected mint/vault.`);
    }

    const slashTreasuryInfo = await connection.getAccountInfo(
      new PublicKey(expectedStake.slashTreasuryTokenAccount),
      "confirmed",
    );
    if (!slashTreasuryInfo) {
      fail(`Configured slash treasury token account ${expectedStake.slashTreasuryTokenAccount} does not exist.`);
    }

    for (const fixtureSeries of configuredDevnetPolicySeries()) {
      const seriesPaymentOptions = paymentOptions.filter(
        (row) => row.seriesRefHashHex === fixtureSeries.seriesRefHashHex && row.active,
      );
      if (fixtureSeries.address === process.env.NEXT_PUBLIC_DEVNET_POLICY_SERIES_PRIMARY) {
        const hasSolRail = seriesPaymentOptions.some((row) => row.paymentMint === ZERO_PUBKEY);
        if (!hasSolRail) {
          fail("Strict signoff requires an active SOL payment rail on the primary policy series.");
        }
      }
      const expectedPaymentMint = fixtureSeries.paymentMint;
      if (expectedPaymentMint && expectedPaymentMint !== DEVNET_NATIVE_SOL_RAIL) {
        const hasExpectedRail = seriesPaymentOptions.some((row) => row.paymentMint === expectedPaymentMint);
        if (!hasExpectedRail) {
          fail(`Strict signoff requires payment mint ${expectedPaymentMint} on policy series ${fixtureSeries.address}.`);
        }
      }
    }

    const configuredClaim = configuredDevnetClaimCases()[0] ?? null;
    if (configuredClaim) {
      const claimRow = claims.find((row) => row.address === configuredClaim.claimAddress);
      if (!claimRow) {
        fail(`Configured claim case ${configuredClaim.claimAddress} was not indexed.`);
      }
      if (claimRow.member !== configuredClaim.member) {
        fail(`Claim member mismatch for ${configuredClaim.claimAddress}: expected ${configuredClaim.member} got ${claimRow.member}`);
      }
      if (claimRow.claimant !== configuredClaim.claimant) {
        fail(`Claim claimant mismatch for ${configuredClaim.claimAddress}: expected ${configuredClaim.claimant} got ${claimRow.claimant}`);
      }
    }

    const configuredRedemption = configuredDevnetRedemptionCases()[0] ?? null;
    if (configuredRedemption) {
      const redemptionRow = redemptions.find((row) => row.address === configuredRedemption.requestAddress);
      if (!redemptionRow) {
        fail(`Configured redemption request ${configuredRedemption.requestAddress} was not indexed.`);
      }
      if (redemptionRow.redeemer !== configuredRedemption.redeemer) {
        fail(`Redemption redeemer mismatch for ${configuredRedemption.requestAddress}: expected ${configuredRedemption.redeemer} got ${redemptionRow.redeemer}`);
      }
      if (redemptionRow.payoutMint !== configuredRedemption.payoutMint) {
        fail(`Redemption payout mint mismatch for ${configuredRedemption.requestAddress}: expected ${configuredRedemption.payoutMint} got ${redemptionRow.payoutMint}`);
      }
    }
  }
}

void main().catch((error) => {
  console.error(process.env.DEVNET_FIXTURE_STRICT === "1"
    ? "Frontend devnet parity signoff failed."
    : "Frontend devnet smoke failed.");
  console.error(error);
  process.exitCode = 1;
});
