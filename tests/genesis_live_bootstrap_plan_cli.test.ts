// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { Keypair } from "@solana/web3.js";

const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const NON_SETTLEMENT_MINT = "So11111111111111111111111111111111111111112";

function writeKeypair(path: string): Keypair {
  const keypair = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

function role(): string {
  return Keypair.generate().publicKey.toBase58();
}

function runPlan(overrides: Record<string, string | undefined>) {
  const dir = mkdtempSync(join(tmpdir(), "omegax-genesis-plan-test-"));
  const governancePath = join(dir, "governance.json");
  const oraclePath = join(dir, "oracle.json");
  const governance = writeKeypair(governancePath);
  const oracle = writeKeypair(oraclePath);
  const env = {
    ...process.env,
    SOLANA_KEYPAIR: governancePath,
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
    OMEGAX_LIVE_CLUSTER_OVERRIDE: "mainnet",
    OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS: "1",
    OMEGAX_LIVE_SETTLEMENT_MINT: MAINNET_USDC,
    OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN: role(),
    OMEGAX_LIVE_SPONSOR_WALLET: role(),
    OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET: role(),
    OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET: role(),
    OMEGAX_LIVE_ORACLE_WALLET: oracle.publicKey.toBase58(),
    OMEGAX_LIVE_ORACLE_KEYPAIR_PATH: oraclePath,
    OMEGAX_LIVE_POOL_CURATOR_WALLET: role(),
    OMEGAX_LIVE_POOL_ALLOCATOR_WALLET: role(),
    OMEGAX_LIVE_POOL_SENTINEL_WALLET: role(),
    ...overrides,
  };
  return {
    governance,
    oracle,
    oraclePath,
    result: spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/bootstrap_genesis_live_protocol.ts", "--plan"],
      {
        cwd: process.cwd(),
        env,
        encoding: "utf8",
      },
    ),
  };
}

test("Genesis live plan mode validates oracle keypair before no-send output", () => {
  const { result, oracle } = runPlan({});
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.roles.oracleAuthority, oracle.publicKey.toBase58());
  assert.equal(parsed.settlementMint, MAINNET_USDC);
});

test("release evidence uses USDC as preferred mainnet settlement mint", () => {
  const evidence = readFileSync(
    new URL("../docs/operations/release-v0.3.2-evidence.md", import.meta.url),
    "utf8",
  );
  assert.match(evidence, new RegExp(`OMEGAX_LIVE_SETTLEMENT_MINT=${MAINNET_USDC}`));
  assert.match(evidence, /not the\s+default claims settlement mint/);
  assert.doesNotMatch(evidence, new RegExp(`OMEGAX_LIVE_SETTLEMENT_MINT=${NON_SETTLEMENT_MINT}`));
});

test("Genesis live plan mode rejects a missing oracle keypair before any send path", () => {
  const { result } = runPlan({
    OMEGAX_LIVE_ORACLE_KEYPAIR_PATH: "/tmp/omegax-missing-oracle-keypair.json",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /oracle keypair file was not found/);
});

test("Genesis live plan mode rejects an oracle wallet/keypair mismatch before any send path", () => {
  const { result } = runPlan({
    OMEGAX_LIVE_ORACLE_WALLET: role(),
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /OMEGAX_LIVE_ORACLE_WALLET .* does not match the configured oracle keypair/);
});
