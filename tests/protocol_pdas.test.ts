import test from "node:test";
import assert from "node:assert/strict";

import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../frontend/lib/protocol.ts";

const {
  DEVNET_PROTOCOL_FIXTURE_STATE,
  DEFAULT_HEALTH_PLAN_ADDRESS,
  DEFAULT_LIQUIDITY_POOL_ADDRESS,
} = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  buildAttestClaimCaseTx,
  deriveAllocationPositionPda,
  buildOpenMemberPositionTx,
  deriveClaimAttestationPda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  deriveMembershipAnchorSeatPda,
  deriveOracleProfilePda,
  deriveOutcomeSchemaPda,
  derivePoolOracleApprovalPda,
  derivePoolOraclePolicyPda,
  derivePoolOraclePermissionSetPda,
  deriveProtocolGovernancePda,
  deriveReserveDomainPda,
  deriveSchemaDependencyLedgerPda,
  deriveProtocolFeeVaultPda,
  derivePoolTreasuryVaultPda,
  derivePoolOracleFeeVaultPda,
  MEMBERSHIP_PROOF_MODE_INVITE_PERMIT,
  NATIVE_SOL_MINT,
  NATIVE_SOL_MINT_KEY,
  ZERO_PUBKEY,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

test("fixture addresses stay deterministic under canonical seeds", () => {
  const [openDomain, wrapperDomain] = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains;
  const seekerPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
  const oracleAddress = DEFAULT_HEALTH_PLAN_ADDRESS;

  assert.equal(
    deriveReserveDomainPda({ domainId: openDomain.domainId }).toBase58(),
    openDomain.address,
  );
  assert.equal(
    deriveReserveDomainPda({ domainId: wrapperDomain.domainId }).toBase58(),
    wrapperDomain.address,
  );
  assert.equal(
    deriveHealthPlanPda({ reserveDomain: seekerPlan.reserveDomain, planId: seekerPlan.planId }).toBase58(),
    DEFAULT_HEALTH_PLAN_ADDRESS,
  );
  assert.equal(
    deriveLiquidityPoolPda({ reserveDomain: pool.reserveDomain, poolId: pool.poolId }).toBase58(),
    DEFAULT_LIQUIDITY_POOL_ADDRESS,
  );
  assert.match(
    deriveMembershipAnchorSeatPda({
      healthPlan: seekerPlan.address,
      anchorRef: seekerPlan.address,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveOracleProfilePda({ oracle: oracleAddress }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    derivePoolOracleApprovalPda({
      liquidityPool: pool.address,
      oracle: oracleAddress,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    derivePoolOraclePolicyPda({ liquidityPool: pool.address }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    derivePoolOraclePermissionSetPda({
      liquidityPool: pool.address,
      oracle: oracleAddress,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveOutcomeSchemaPda({
      schemaKeyHashHex: "11".repeat(32),
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveSchemaDependencyLedgerPda({
      schemaKeyHashHex: "11".repeat(32),
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(
    deriveClaimAttestationPda({
      claimCase: seekerPlan.address,
      oracle: oracleAddress,
    }).toBase58(),
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  );
  assert.match(deriveProtocolGovernancePda().toBase58(), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
});

test("claim attestation builders reject unsupported decisions before chain submission", () => {
  assert.throws(
    () =>
      buildAttestClaimCaseTx({
        oracle: DEFAULT_HEALTH_PLAN_ADDRESS,
        claimCaseAddress: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases[0]!.address,
        recentBlockhash: "11111111111111111111111111111111",
        decision: 99,
        attestationHashHex: "11".repeat(32),
        attestationRefHashHex: "22".repeat(32),
        schemaKeyHashHex: "33".repeat(32),
      }),
    /claim attestation decision must be one of 0/,
  );
});

test("claim attestation builder wires governance, funding, and LP oracle accounts", () => {
  const claim = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases[0]!;
  const fundingLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find((row) => row.address === claim.fundingLine)!;
  const allocation = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.find(
    (row) => row.fundingLine === fundingLine.address,
  )!;
  const oracle = DEFAULT_HEALTH_PLAN_ADDRESS;
  const tx = buildAttestClaimCaseTx({
    oracle,
    healthPlanAddress: claim.healthPlan,
    claimCaseAddress: claim.address,
    fundingLineAddress: fundingLine.address,
    recentBlockhash: "11111111111111111111111111111111",
    decision: 0,
    attestationHashHex: "11".repeat(32),
    attestationRefHashHex: "22".repeat(32),
    schemaKeyHashHex: "33".repeat(32),
    liquidityPoolAddress: allocation.liquidityPool,
    capitalClassAddress: allocation.capitalClass,
  });
  const keys = tx.instructions[0]!.keys;

  assert.equal(keys[1]!.pubkey.toBase58(), deriveProtocolGovernancePda().toBase58());
  assert.equal(keys[2]!.pubkey.toBase58(), claim.healthPlan);
  assert.equal(keys[4]!.pubkey.toBase58(), claim.address);
  assert.equal(keys[4]!.isWritable, true);
  assert.equal(keys[5]!.pubkey.toBase58(), fundingLine.address);
  assert.equal(keys[7]!.pubkey.toBase58(), allocation.liquidityPool);
  assert.equal(keys[8]!.pubkey.toBase58(), allocation.capitalClass);
  assert.equal(
    keys[9]!.pubkey.toBase58(),
    deriveAllocationPositionPda({
      capitalClass: allocation.capitalClass,
      fundingLine: fundingLine.address,
    }).toBase58(),
  );
  assert.equal(
    keys[10]!.pubkey.toBase58(),
    derivePoolOracleApprovalPda({ liquidityPool: allocation.liquidityPool, oracle }).toBase58(),
  );
  assert.equal(
    keys[11]!.pubkey.toBase58(),
    derivePoolOraclePermissionSetPda({ liquidityPool: allocation.liquidityPool, oracle }).toBase58(),
  );
  assert.equal(
    keys[12]!.pubkey.toBase58(),
    derivePoolOraclePolicyPda({ liquidityPool: allocation.liquidityPool }).toBase58(),
  );
});

test("Phase 1.7 fee-vault PDA derivers are deterministic and rail-aware", () => {
  const [openDomain] = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains;
  const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
  const oracleAddress = DEFAULT_HEALTH_PLAN_ADDRESS;
  const splMint = pool.depositAssetMint;

  // Sanity: all 9 derivers (3 vaults × {SOL, SPL, distinct-seed-input}) return
  // valid base58 PDA addresses.
  const protocolFeeSpl = deriveProtocolFeeVaultPda({
    reserveDomain: openDomain.address,
    assetMint: splMint,
  });
  const protocolFeeSol = deriveProtocolFeeVaultPda({
    reserveDomain: openDomain.address,
    assetMint: NATIVE_SOL_MINT_KEY,
  });
  const poolTreasurySpl = derivePoolTreasuryVaultPda({
    liquidityPool: pool.address,
    assetMint: splMint,
  });
  const poolTreasurySol = derivePoolTreasuryVaultPda({
    liquidityPool: pool.address,
    assetMint: NATIVE_SOL_MINT_KEY,
  });
  const poolOracleSpl = derivePoolOracleFeeVaultPda({
    liquidityPool: pool.address,
    oracle: oracleAddress,
    assetMint: splMint,
  });
  const poolOracleSol = derivePoolOracleFeeVaultPda({
    liquidityPool: pool.address,
    oracle: oracleAddress,
    assetMint: NATIVE_SOL_MINT_KEY,
  });

  for (const pda of [
    protocolFeeSpl,
    protocolFeeSol,
    poolTreasurySpl,
    poolTreasurySol,
    poolOracleSpl,
    poolOracleSol,
  ]) {
    assert.match(pda.toBase58(), /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  }

  // SOL and SPL rails of the same vault scope MUST produce different PDAs —
  // otherwise the rail-mismatch guard wouldn't be necessary on-chain.
  assert.notEqual(protocolFeeSpl.toBase58(), protocolFeeSol.toBase58());
  assert.notEqual(poolTreasurySpl.toBase58(), poolTreasurySol.toBase58());
  assert.notEqual(poolOracleSpl.toBase58(), poolOracleSol.toBase58());

  // Different rails (protocol/treasury/oracle) MUST produce different PDAs
  // for the same (scope, mint) — they use different seed prefixes.
  assert.notEqual(protocolFeeSpl.toBase58(), poolTreasurySpl.toBase58());
  assert.notEqual(poolTreasurySpl.toBase58(), poolOracleSpl.toBase58());

  // Determinism: re-deriving with the same inputs returns the same PDA.
  assert.equal(
    deriveProtocolFeeVaultPda({
      reserveDomain: openDomain.address,
      assetMint: splMint,
    }).toBase58(),
    protocolFeeSpl.toBase58(),
  );

  // NATIVE_SOL_MINT string and NATIVE_SOL_MINT_KEY (PublicKey) produce the
  // same PDA — both forms are accepted via toPublicKey coercion.
  assert.equal(
    deriveProtocolFeeVaultPda({
      reserveDomain: openDomain.address,
      assetMint: NATIVE_SOL_MINT,
    }).toBase58(),
    protocolFeeSol.toBase58(),
  );

  // ZERO_PUBKEY (the panel's UI sentinel) is NOT the same as NATIVE_SOL_MINT
  // and would derive a different PDA — confirm the listers are responsible
  // for translating UI sentinel to on-chain mint, not the derivers.
  assert.notEqual(ZERO_PUBKEY, NATIVE_SOL_MINT);
});

test("member enrollment builder marks invite authority as a signer", () => {
  const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans[0]!;
  const memberWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "member")!.address;
  const inviteAuthority = plan.membershipInviteAuthority!;
  const tx = buildOpenMemberPositionTx({
    wallet: memberWallet,
    healthPlanAddress: plan.address,
    recentBlockhash: "11111111111111111111111111111111",
    seriesScopeAddress: ZERO_PUBKEY,
    subjectCommitmentHashHex: "11".repeat(32),
    eligibilityStatus: 0,
    delegatedRightsMask: 0,
    proofMode: MEMBERSHIP_PROOF_MODE_INVITE_PERMIT,
    tokenGateAmountSnapshot: 0n,
    inviteIdHashHex: "22".repeat(32),
    inviteExpiresAt: 0n,
    inviteAuthorityAddress: inviteAuthority,
  });

  const keys = tx.instructions[0]!.keys;
  assert.equal(keys.find((key) => key.pubkey.toBase58() === memberWallet)?.isSigner, true);
  assert.equal(keys.find((key) => key.pubkey.toBase58() === inviteAuthority)?.isSigner, true);
});
