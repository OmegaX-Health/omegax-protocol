import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PublicKey } from "@solana/web3.js";
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
];
function address(seed) {
    return new PublicKey(Uint8Array.from({ length: 32 }, () => seed)).toBase58();
}
function loadFixtureSnapshot(envUpdates) {
    const script = `
    import fixturesModule from "./frontend/lib/devnet-fixtures.ts";

    const {
      DEVNET_PROTOCOL_FIXTURE_STATE,
      configuredControlDevnetWallets,
      controlDevnetWallets,
      isUnsetDevnetWalletAddress,
    } = fixturesModule;

    console.log(JSON.stringify({
      wallets: DEVNET_PROTOCOL_FIXTURE_STATE.wallets.map(({ role, address }) => ({ role, address })),
      healthPlans: DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.map(
        ({ planAdmin, sponsorOperator, claimsOperator }) => ({ planAdmin, sponsorOperator, claimsOperator }),
      ),
      controlWalletRoles: controlDevnetWallets().map(({ role }) => role),
      configuredControlWalletCount: configuredControlDevnetWallets().length,
      hasUnsetPlanAdmin: isUnsetDevnetWalletAddress(DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]?.planAdmin),
    }));
  `;
    const neutralizedEnv = Object.fromEntries(FIXTURE_ENV_KEYS.map((key) => [key, ""]));
    const output = execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
        cwd: REPO_ROOT,
        env: { ...process.env, ...neutralizedEnv, ...envUpdates },
        encoding: "utf8",
    });
    return JSON.parse(output);
}
function walletAddress(snapshot, role) {
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
test("control-wallet helpers only surface privileged roles and treat unset placeholders as unconfigured", () => {
    const snapshot = loadFixtureSnapshot({
        NEXT_PUBLIC_DEVNET_MEMBER_WALLET: address(15),
        NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET: address(16),
        NEXT_PUBLIC_DEVNET_PLAN_ADMIN_WALLET: address(17),
    });
    assert.deepEqual(snapshot.controlWalletRoles, [
        "protocol_governance",
        "domain_admin",
        "plan_admin",
        "sponsor_operator",
        "claims_operator",
        "oracle_operator",
        "pool_curator",
        "pool_allocator",
        "pool_sentinel",
    ]);
    assert.equal(snapshot.configuredControlWalletCount, 2);
    assert.equal(snapshot.hasUnsetPlanAdmin, false);
});
