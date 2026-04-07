import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PublicKey } from "@solana/web3.js";

type FixtureSnapshot = {
  wallets: Array<{ role: string; address: string }>;
  healthPlans: Array<{ planAdmin: string; sponsorOperator: string; claimsOperator: string }>;
};

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURE_ENV_KEYS = [
  "NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET",
  "NEXT_PUBLIC_DEVNET_DOMAIN_ADMIN_WALLET",
  "NEXT_PUBLIC_DEVNET_PLAN_ADMIN_WALLET",
  "NEXT_PUBLIC_DEVNET_SPONSOR_OPERATOR_WALLET",
  "NEXT_PUBLIC_DEVNET_CLAIMS_OPERATOR_WALLET",
  "NEXT_PUBLIC_DEVNET_ORACLE_OPERATOR_WALLET",
  "NEXT_PUBLIC_DEVNET_POOL_CURATOR_WALLET",
  "NEXT_PUBLIC_DEVNET_POOL_ALLOCATOR_WALLET",
  "NEXT_PUBLIC_DEVNET_POOL_SENTINEL_WALLET",
  "NEXT_PUBLIC_DEVNET_MEMBER_DELEGATE_WALLET",
  "NEXT_PUBLIC_DEVNET_SECOND_MEMBER_WALLET",
  "NEXT_PUBLIC_DEVNET_LP_PROVIDER_WALLET",
  "NEXT_PUBLIC_DEVNET_WRAPPER_PROVIDER_WALLET",
] as const;

function address(seed: number): string {
  return new PublicKey(Uint8Array.from({ length: 32 }, () => seed)).toBase58();
}

function loadFixtureSnapshot(envUpdates: Record<string, string>): FixtureSnapshot {
  const script = `
    import fixturesModule from "./frontend/lib/devnet-fixtures.ts";

    const { DEVNET_PROTOCOL_FIXTURE_STATE } = fixturesModule;

    console.log(JSON.stringify({
      wallets: DEVNET_PROTOCOL_FIXTURE_STATE.wallets.map(({ role, address }) => ({ role, address })),
      healthPlans: DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.map(
        ({ planAdmin, sponsorOperator, claimsOperator }) => ({ planAdmin, sponsorOperator, claimsOperator }),
      ),
    }));
  `;

  const neutralizedEnv = Object.fromEntries(FIXTURE_ENV_KEYS.map((key) => [key, ""]));
  const output = execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...neutralizedEnv, ...envUpdates },
    encoding: "utf8",
  });

  return JSON.parse(output) as FixtureSnapshot;
}

function walletAddress(snapshot: FixtureSnapshot, role: string): string {
  const wallet = snapshot.wallets.find((candidate) => candidate.role === role);
  assert(wallet, `expected wallet fixture for role ${role}`);
  return wallet.address;
}

test("legacy wallet aliases still populate canonical devnet fixture roles", () => {
  const legacyValues = {
    NEXT_PUBLIC_DEVNET_GOVERNANCE_WALLET: address(1),
    NEXT_PUBLIC_DEVNET_POOL_AUTHORITY_WALLET: address(2),
    NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET: address(3),
    NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET: address(4),
    NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET: address(5),
    NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET: address(6),
    NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET: address(7),
    NEXT_PUBLIC_DEVNET_RISK_MANAGER_WALLET: address(8),
    NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET: address(9),
    NEXT_PUBLIC_DEVNET_GUARDIAN_WALLET: address(10),
  };

  const snapshot = loadFixtureSnapshot(legacyValues);

  assert.equal(walletAddress(snapshot, "protocol_governance"), legacyValues.NEXT_PUBLIC_DEVNET_GOVERNANCE_WALLET);
  assert.equal(walletAddress(snapshot, "domain_admin"), legacyValues.NEXT_PUBLIC_DEVNET_POOL_AUTHORITY_WALLET);
  assert.equal(walletAddress(snapshot, "plan_admin"), legacyValues.NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET);
  assert.equal(walletAddress(snapshot, "sponsor_operator"), legacyValues.NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET);
  assert.equal(walletAddress(snapshot, "claims_operator"), legacyValues.NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET);
  assert.equal(walletAddress(snapshot, "oracle_operator"), legacyValues.NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET);
  assert.equal(walletAddress(snapshot, "pool_curator"), legacyValues.NEXT_PUBLIC_DEVNET_COMPLIANCE_WALLET);
  assert.equal(walletAddress(snapshot, "pool_allocator"), legacyValues.NEXT_PUBLIC_DEVNET_RISK_MANAGER_WALLET);
  assert.equal(walletAddress(snapshot, "pool_sentinel"), legacyValues.NEXT_PUBLIC_DEVNET_GUARDIAN_WALLET);
  assert.equal(walletAddress(snapshot, "member_delegate"), legacyValues.NEXT_PUBLIC_DEVNET_CLAIM_DELEGATE_WALLET);
  assert.equal(walletAddress(snapshot, "lp_provider"), legacyValues.NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET);
  assert.equal(walletAddress(snapshot, "wrapper_provider"), legacyValues.NEXT_PUBLIC_DEVNET_CAPITAL_PROVIDER_WALLET);
  assert(snapshot.healthPlans.every((plan) => plan.planAdmin === legacyValues.NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET));
  assert(snapshot.healthPlans.every((plan) => plan.sponsorOperator === legacyValues.NEXT_PUBLIC_DEVNET_POOL_OPERATOR_WALLET));
  assert(snapshot.healthPlans.every((plan) => plan.claimsOperator === legacyValues.NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET));
});

test("canonical wallet vars win when both canonical and legacy names are present", () => {
  const snapshot = loadFixtureSnapshot({
    NEXT_PUBLIC_DEVNET_CLAIMS_OPERATOR_WALLET: address(11),
    NEXT_PUBLIC_DEVNET_ORACLE_OPERATOR_WALLET: address(12),
    NEXT_PUBLIC_DEVNET_ORACLE_ADMIN_WALLET: address(13),
    NEXT_PUBLIC_DEVNET_ORACLE_SIGNER_WALLET: address(14),
  });

  assert.equal(walletAddress(snapshot, "claims_operator"), address(11));
  assert.equal(walletAddress(snapshot, "oracle_operator"), address(12));
});
