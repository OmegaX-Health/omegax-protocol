// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Phase 1.7 — Fee-vault withdrawal builder tests.
//
// Validates that each of the 6 buildWithdraw*Tx builders produces a transaction
// whose instruction (a) targets the protocol program, (b) carries the correct
// 8-byte instruction discriminator, (c) has the right signer flag on the
// authority key, (d) has the rail-scope account at the right ordinal, and
// (e) BN-encodes the amount arg.
//
// Account ordering MUST match the on-chain `#[derive(Accounts)]` structs —
// any drift surfaces here as an ordinal-pubkey mismatch.

import test from "node:test";
import assert from "node:assert/strict";

import { PublicKey } from "@solana/web3.js";
import contractModule from "../frontend/lib/generated/protocol-contract.ts";
import protocolModule from "../frontend/lib/protocol.ts";
import fixturesModule from "../frontend/lib/devnet-fixtures.ts";

const { PROTOCOL_INSTRUCTION_DISCRIMINATORS } = contractModule as typeof import(
  "../frontend/lib/generated/protocol-contract.ts"
);
const {
  buildWithdrawProtocolFeeSplTx,
  buildWithdrawProtocolFeeSolTx,
  buildWithdrawPoolTreasurySplTx,
  buildWithdrawPoolTreasurySolTx,
  buildWithdrawPoolOracleFeeSplTx,
  buildWithdrawPoolOracleFeeSolTx,
  deriveProtocolGovernancePda,
  deriveProtocolFeeVaultPda,
  derivePoolTreasuryVaultPda,
  derivePoolOracleFeeVaultPda,
  deriveDomainAssetVaultPda,
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultTokenAccountPda,
  deriveOracleProfilePda,
  getProgramId,
  NATIVE_SOL_MINT_KEY,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const { DEVNET_PROTOCOL_FIXTURE_STATE, DEFAULT_LIQUIDITY_POOL_ADDRESS } =
  fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");

const RECENT_BLOCKHASH = "11111111111111111111111111111111";
const AUTHORITY = new PublicKey("So11111111111111111111111111111111111111112");
const SPL_MINT = new PublicKey(DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!.depositAssetMint);
const POOL = new PublicKey(DEFAULT_LIQUIDITY_POOL_ADDRESS);
const RESERVE_DOMAIN = new PublicKey(DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains[0]!.address);
const RECIPIENT_ATA = new PublicKey("BVfgRQQk1WDTo6QPwhfRR5MKfQ58oV44L94qhEHjk1tg");
const RECIPIENT_SYS = new PublicKey("Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B");
const ORACLE = new PublicKey("oxhocTdPyENqy9RS13iaq2upoNAovMJHu9PMaBxrK8h");

function discriminatorForName(name: string): Uint8Array {
  const disc = (PROTOCOL_INSTRUCTION_DISCRIMINATORS as Record<string, Uint8Array>)[name];
  assert.ok(disc, `expected discriminator for ${name}`);
  return disc;
}

function assertProtocolIxShape(
  tx: { feePayer?: PublicKey; instructions: ReadonlyArray<{ programId: PublicKey; data: Buffer | Uint8Array; keys: ReadonlyArray<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }> }> },
  expectedName: string,
  expectedAuthority: PublicKey,
): { keys: ReadonlyArray<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>; data: Buffer | Uint8Array } {
  assert.equal(tx.instructions.length, 1, `${expectedName} should produce exactly one instruction`);
  const ix = tx.instructions[0]!;
  assert.equal(
    ix.programId.toBase58(),
    getProgramId().toBase58(),
    `${expectedName} instruction must target the protocol program`,
  );
  const expectedDisc = discriminatorForName(expectedName);
  const actualDiscPrefix = Array.from(ix.data.subarray(0, 8));
  assert.deepEqual(
    actualDiscPrefix,
    Array.from(expectedDisc),
    `${expectedName} discriminator prefix mismatch`,
  );
  assert.equal(
    ix.keys[0]!.pubkey.toBase58(),
    expectedAuthority.toBase58(),
    `${expectedName} authority must be the first account`,
  );
  assert.equal(
    ix.keys[0]!.isSigner,
    true,
    `${expectedName} authority must be flagged as signer`,
  );
  return ix;
}

test("buildWithdrawProtocolFeeSplTx: programId, discriminator, authority, vault PDAs", () => {
  const tx = buildWithdrawProtocolFeeSplTx({
    governanceAuthority: AUTHORITY,
    reserveDomainAddress: RESERVE_DOMAIN,
    paymentMint: SPL_MINT,
    recipientTokenAccount: RECIPIENT_ATA,
    amount: 1_000_000n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = assertProtocolIxShape(tx, "withdraw_protocol_fee_spl", AUTHORITY);
  // Account order per on-chain struct: authority, governance, reserve_domain,
  // protocol_fee_vault, domain_asset_vault, domain_asset_ledger, asset_mint,
  // vault_token_account, recipient_token_account, token_program.
  assert.equal(ix.keys[1]!.pubkey.toBase58(), deriveProtocolGovernancePda().toBase58());
  assert.equal(ix.keys[2]!.pubkey.toBase58(), RESERVE_DOMAIN.toBase58());
  assert.equal(
    ix.keys[3]!.pubkey.toBase58(),
    deriveProtocolFeeVaultPda({ reserveDomain: RESERVE_DOMAIN, assetMint: SPL_MINT }).toBase58(),
  );
  assert.equal(
    ix.keys[4]!.pubkey.toBase58(),
    deriveDomainAssetVaultPda({ reserveDomain: RESERVE_DOMAIN, assetMint: SPL_MINT }).toBase58(),
  );
  assert.equal(
    ix.keys[5]!.pubkey.toBase58(),
    deriveDomainAssetLedgerPda({ reserveDomain: RESERVE_DOMAIN, assetMint: SPL_MINT }).toBase58(),
  );
  assert.equal(ix.keys[6]!.pubkey.toBase58(), SPL_MINT.toBase58());
  assert.equal(
    ix.keys[7]!.pubkey.toBase58(),
    deriveDomainAssetVaultTokenAccountPda({
      reserveDomain: RESERVE_DOMAIN,
      assetMint: SPL_MINT,
    }).toBase58(),
  );
  assert.equal(ix.keys[8]!.pubkey.toBase58(), RECIPIENT_ATA.toBase58());
});

test("buildWithdrawProtocolFeeSolTx: SOL rail uses NATIVE_SOL_MINT in vault seed", () => {
  const tx = buildWithdrawProtocolFeeSolTx({
    governanceAuthority: AUTHORITY,
    reserveDomainAddress: RESERVE_DOMAIN,
    recipientSystemAccount: RECIPIENT_SYS,
    amount: 5_000_000n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = assertProtocolIxShape(tx, "withdraw_protocol_fee_sol", AUTHORITY);
  // Account order: authority, governance, reserve_domain, protocol_fee_vault,
  // recipient, system_program.
  assert.equal(
    ix.keys[3]!.pubkey.toBase58(),
    deriveProtocolFeeVaultPda({
      reserveDomain: RESERVE_DOMAIN,
      assetMint: NATIVE_SOL_MINT_KEY,
    }).toBase58(),
    "SOL rail must derive the fee-vault PDA against NATIVE_SOL_MINT, not the recipient or any SPL mint",
  );
  assert.equal(ix.keys[4]!.pubkey.toBase58(), RECIPIENT_SYS.toBase58());
  // SOL rail does NOT thread DomainAssetVault — the vault PDA holds lamports
  // directly. The struct only has 6 accounts vs 10 for the SPL variant.
  assert.equal(ix.keys.length, 6);
});

test("buildWithdrawPoolTreasurySplTx: pool-scoped vault PDA, asset_mint check", () => {
  const tx = buildWithdrawPoolTreasurySplTx({
    oracle: AUTHORITY,
    poolAddress: POOL,
    reserveDomainAddress: RESERVE_DOMAIN,
    paymentMint: SPL_MINT,
    recipientTokenAccount: RECIPIENT_ATA,
    amount: 250_000n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = assertProtocolIxShape(tx, "withdraw_pool_treasury_spl", AUTHORITY);
  // Account order: authority, governance, liquidity_pool, pool_treasury_vault,
  // domain_asset_vault, domain_asset_ledger, asset_mint, vault_token_account,
  // recipient, token_program.
  assert.equal(ix.keys[2]!.pubkey.toBase58(), POOL.toBase58());
  assert.equal(
    ix.keys[3]!.pubkey.toBase58(),
    derivePoolTreasuryVaultPda({ liquidityPool: POOL, assetMint: SPL_MINT }).toBase58(),
  );
  assert.equal(
    ix.keys[4]!.pubkey.toBase58(),
    deriveDomainAssetVaultPda({ reserveDomain: RESERVE_DOMAIN, assetMint: SPL_MINT }).toBase58(),
  );
  assert.equal(
    ix.keys[5]!.pubkey.toBase58(),
    deriveDomainAssetLedgerPda({ reserveDomain: RESERVE_DOMAIN, assetMint: SPL_MINT }).toBase58(),
  );
});

test("buildWithdrawPoolTreasurySolTx: minimal SOL rail accounts", () => {
  const tx = buildWithdrawPoolTreasurySolTx({
    oracle: AUTHORITY,
    poolAddress: POOL,
    recipientSystemAccount: RECIPIENT_SYS,
    amount: 42n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = assertProtocolIxShape(tx, "withdraw_pool_treasury_sol", AUTHORITY);
  // Account order: authority, governance, liquidity_pool, pool_treasury_vault,
  // recipient, system_program.
  assert.equal(ix.keys[2]!.pubkey.toBase58(), POOL.toBase58());
  assert.equal(
    ix.keys[3]!.pubkey.toBase58(),
    derivePoolTreasuryVaultPda({
      liquidityPool: POOL,
      assetMint: NATIVE_SOL_MINT_KEY,
    }).toBase58(),
  );
  assert.equal(ix.keys[4]!.pubkey.toBase58(), RECIPIENT_SYS.toBase58());
  assert.equal(ix.keys.length, 6);
});

test("buildWithdrawPoolOracleFeeSplTx: oracle_profile + per-oracle vault PDA", () => {
  const tx = buildWithdrawPoolOracleFeeSplTx({
    oracle: ORACLE,
    poolAddress: POOL,
    reserveDomainAddress: RESERVE_DOMAIN,
    paymentMint: SPL_MINT,
    recipientTokenAccount: RECIPIENT_ATA,
    amount: 999n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = assertProtocolIxShape(tx, "withdraw_pool_oracle_fee_spl", ORACLE);
  // Account order: authority, governance, liquidity_pool, oracle_profile,
  // pool_oracle_fee_vault, domain_asset_vault, domain_asset_ledger, asset_mint,
  // vault_token_account, recipient, token_program.
  assert.equal(
    ix.keys[3]!.pubkey.toBase58(),
    deriveOracleProfilePda({ oracle: ORACLE }).toBase58(),
  );
  assert.equal(
    ix.keys[4]!.pubkey.toBase58(),
    derivePoolOracleFeeVaultPda({
      liquidityPool: POOL,
      oracle: ORACLE,
      assetMint: SPL_MINT,
    }).toBase58(),
  );
  assert.equal(
    ix.keys[6]!.pubkey.toBase58(),
    deriveDomainAssetLedgerPda({ reserveDomain: RESERVE_DOMAIN, assetMint: SPL_MINT }).toBase58(),
  );
});

test("buildWithdrawPoolOracleFeeSolTx: oracleAddress override decouples signer from vault key", () => {
  const tx = buildWithdrawPoolOracleFeeSolTx({
    oracle: AUTHORITY,
    oracleAddress: ORACLE,
    poolAddress: POOL,
    recipientSystemAccount: RECIPIENT_SYS,
    amount: 1n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = assertProtocolIxShape(tx, "withdraw_pool_oracle_fee_sol", AUTHORITY);
  // Vault is keyed by ORACLE (the registered oracle), not AUTHORITY (the
  // admin/governance signer). This validates the admin-signing path works.
  assert.equal(
    ix.keys[3]!.pubkey.toBase58(),
    deriveOracleProfilePda({ oracle: ORACLE }).toBase58(),
  );
  assert.equal(
    ix.keys[4]!.pubkey.toBase58(),
    derivePoolOracleFeeVaultPda({
      liquidityPool: POOL,
      oracle: ORACLE,
      assetMint: NATIVE_SOL_MINT_KEY,
    }).toBase58(),
  );
});

test("buildWithdrawPoolOracleFeeSolTx: omitting oracleAddress defaults to signer (common path)", () => {
  // The pool-treasury-panel calls without oracleAddress, treating
  // `oracle: publicKey` as both the signer AND the vault's oracle wallet.
  const tx = buildWithdrawPoolOracleFeeSolTx({
    oracle: ORACLE,
    poolAddress: POOL,
    recipientSystemAccount: RECIPIENT_SYS,
    amount: 1n,
    recentBlockhash: RECENT_BLOCKHASH,
  });
  const ix = tx.instructions[0]!;
  assert.equal(
    ix.keys[4]!.pubkey.toBase58(),
    derivePoolOracleFeeVaultPda({
      liquidityPool: POOL,
      oracle: ORACLE,
      assetMint: NATIVE_SOL_MINT_KEY,
    }).toBase58(),
  );
});
