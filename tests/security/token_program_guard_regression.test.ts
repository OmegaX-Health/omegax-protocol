// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-04-29 regression: the public builders should not construct
// Token-2022 custody transactions for the v1 protocol surface.

import test from "node:test";
import assert from "node:assert/strict";

import { SystemProgram } from "@solana/web3.js";

import fixturesModule from "../../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../../frontend/lib/protocol.ts";

const { DEVNET_PROTOCOL_FIXTURE_STATE } =
  fixturesModule as typeof import("../../frontend/lib/devnet-fixtures.ts");

const {
  buildCreateDomainAssetVaultTx,
  buildDepositIntoCapitalClassTx,
  buildWithdrawProtocolFeeSplTx,
} = protocolModule as typeof import("../../frontend/lib/protocol.ts");

const recentBlockhash = "11111111111111111111111111111111";
const wallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets[0]!.address;
const recipient = DEVNET_PROTOCOL_FIXTURE_STATE.wallets[1]!.address;
const reserveDomain = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains[0]!.address;
const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
const capitalClass = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.find((row) => row.liquidityPool === pool.address)
  ?? DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses[0]!;

test("[CSO-2026-04-29] custody builders reject non-classic token program ids", () => {
  assert.throws(
    () => buildCreateDomainAssetVaultTx({
      authority: wallet,
      reserveDomainAddress: reserveDomain,
      assetMint: pool.depositAssetMint,
      recentBlockhash,
      tokenProgramId: SystemProgram.programId,
    }),
    /classic SPL Token program/,
  );

  assert.throws(
    () => buildDepositIntoCapitalClassTx({
      owner: wallet,
      reserveDomainAddress: pool.reserveDomain,
      poolAddress: pool.address,
      poolDepositAssetMint: pool.depositAssetMint,
      capitalClassAddress: capitalClass.address,
      sourceTokenAccountAddress: wallet,
      vaultTokenAccountAddress: recipient,
      recentBlockhash,
      amount: 1n,
      shares: 0n,
      tokenProgramId: SystemProgram.programId,
    }),
    /classic SPL Token program/,
  );

  assert.throws(
    () => buildWithdrawProtocolFeeSplTx({
      governanceAuthority: wallet,
      reserveDomainAddress: reserveDomain,
      paymentMint: pool.depositAssetMint,
      recipientTokenAccount: recipient,
      amount: 1n,
      recentBlockhash,
      tokenProgramId: SystemProgram.programId,
    }),
    /classic SPL Token program/,
  );
});
