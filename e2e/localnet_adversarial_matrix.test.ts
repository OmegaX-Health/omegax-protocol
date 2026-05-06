// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import test from "node:test";

import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import protocolModule from "../frontend/lib/protocol.ts";
import {
  INSTRUCTION_EXCEPTION_REASONS,
  SCENARIO_DEFINITIONS,
  blankInstructionExceptionReasons,
  duplicateOwnedInstructions,
  scenarioNames,
} from "./support/surface_manifest.ts";
import { instructionSurface } from "./support/surface.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const STATIC_BLOCKHASH = "11111111111111111111111111111111";
const SAMPLE_HASH_HEX = "ab".repeat(32);

const governanceAuthority = Keypair.generate().publicKey;
const operator = Keypair.generate().publicKey;
const attackerKeypair = Keypair.generate();
const attacker = attackerKeypair.publicKey;
const oracle = Keypair.generate().publicKey;
const lpOwner = Keypair.generate().publicKey;
const member = Keypair.generate().publicKey;
const assetMint = Keypair.generate().publicKey;
const fallbackAssetMint = Keypair.generate().publicKey;
const reserveDomain = protocol.deriveReserveDomainPda({ domainId: "adv-matrix" });
const healthPlan = protocol.deriveHealthPlanPda({
  reserveDomain,
  planId: "adv-plan",
});
const policySeries = protocol.derivePolicySeriesPda({
  healthPlan,
  seriesId: "adv-series",
});
const fundingLine = protocol.deriveFundingLinePda({
  healthPlan,
  lineId: "adv-line",
});
const pool = protocol.deriveLiquidityPoolPda({
  reserveDomain,
  poolId: "adv-pool",
});
const capitalClass = protocol.deriveCapitalClassPda({
  liquidityPool: pool,
  classId: "adv-class",
});
const claimCase = protocol.deriveClaimCasePda({
  healthPlan,
  claimId: "adv-claim",
});
const obligation = protocol.deriveObligationPda({
  fundingLine,
  obligationId: "adv-obligation",
});
const allocationPosition = protocol.deriveAllocationPositionPda({
  capitalClass,
  fundingLine,
});
const lpPosition = protocol.deriveLpPositionPda({
  capitalClass,
  owner: lpOwner,
});
const vaultTokenAccount = protocol.deriveDomainAssetVaultTokenAccountPda({
  reserveDomain,
  assetMint,
});
const fallbackVaultTokenAccount = protocol.deriveDomainAssetVaultTokenAccountPda({
  reserveDomain,
  assetMint: fallbackAssetMint,
});
const attackerAta = getAssociatedTokenAddressSync(assetMint, attacker, true, TOKEN_PROGRAM_ID);
const fallbackAttackerAta = getAssociatedTokenAddressSync(fallbackAssetMint, attacker, true, TOKEN_PROGRAM_ID);
const memberAta = getAssociatedTokenAddressSync(assetMint, member, true, TOKEN_PROGRAM_ID);
const sourceAta = getAssociatedTokenAddressSync(assetMint, operator, true, TOKEN_PROGRAM_ID);
const poolOracleFeeVault = protocol.derivePoolOracleFeeVaultPda({
  liquidityPool: pool,
  oracle,
  assetMint,
});
const poolOraclePolicy = protocol.derivePoolOraclePolicyPda({ liquidityPool: pool });
const oracleFeeAttestation = protocol.deriveClaimAttestationPda({
  claimCase,
  oracle,
});

type MatrixRow = {
  area: string;
  instruction: string;
  attack: string;
  expectedGuard: string;
  tx: Transaction;
  mustInclude?: PublicKey[];
};

type RuntimeProbe = {
  area: string;
  instruction: string;
  attack: string;
  expectedGuard: string;
  tx: Transaction;
  category: string;
};

type RuntimeProbeResult = ReturnType<typeof rowSummary> & {
  category: string;
  runtimeStatus: "blocked" | "unexpected_success" | "inconclusive";
  rejectionReason: string;
  logs: string[];
};

function onlyProgramInstruction(tx: Transaction) {
  const instructions = tx.instructions.filter((ix) => ix.programId.equals(protocol.getProgramId()));
  assert.equal(instructions.length, 1, "expected exactly one OmegaX instruction");
  return instructions[0]!;
}

function assertSigner(tx: Transaction, signer: PublicKey): void {
  const ix = onlyProgramInstruction(tx);
  assert(
    ix.keys.some((key) => key.pubkey.equals(signer) && key.isSigner),
    `expected ${signer.toBase58()} to be a signer`,
  );
}

function assertWritableAccount(tx: Transaction, account: PublicKey): void {
  const ix = onlyProgramInstruction(tx);
  assert(
    ix.keys.some((key) => key.pubkey.equals(account) && key.isWritable),
    `expected ${account.toBase58()} to be writable`,
  );
}

function assertAccount(tx: Transaction, account: PublicKey): void {
  const ix = onlyProgramInstruction(tx);
  assert(
    ix.keys.some((key) => key.pubkey.equals(account)),
    `expected ${account.toBase58()} to be present`,
  );
}

function rowSummary(row: MatrixRow) {
  const ix = onlyProgramInstruction(row.tx);
  return {
    area: row.area,
    instruction: row.instruction,
    attack: row.attack,
    expectedGuard: row.expectedGuard,
    accountCount: ix.keys.length,
    signerCount: ix.keys.filter((key) => key.isSigner).length,
    writableCount: ix.keys.filter((key) => key.isWritable).length,
  };
}

const fakePda = Keypair.generate().publicKey;
const fakeMint = Keypair.generate().publicKey;
const fakeRecipient = getAssociatedTokenAddressSync(assetMint, Keypair.generate().publicKey, true, TOKEN_PROGRAM_ID);
const fakeLedger = Keypair.generate().publicKey;
const fakeAttestation = Keypair.generate().publicKey;
const knownLedgerAccounts = [
  protocol.deriveFundingLineLedgerPda({ fundingLine, assetMint }),
  protocol.derivePoolClassLedgerPda({ capitalClass, assetMint }),
  protocol.deriveAllocationLedgerPda({ allocationPosition, assetMint }),
];

function cloneTxWithReplacement(row: MatrixRow, replacements: Map<string, PublicKey>): Transaction | null {
  let mutated = false;
  const tx = new Transaction();
  for (const ix of row.tx.instructions) {
    tx.add(new TransactionInstruction({
      programId: ix.programId,
      data: ix.data,
      keys: ix.keys.map((key) => {
        const replacement = replacements.get(key.pubkey.toBase58());
        if (!replacement) return key;
        mutated = true;
        return { ...key, pubkey: replacement };
      }),
    }));
  }
  return mutated ? tx : null;
}

function runtimeProbes(): RuntimeProbe[] {
  const probes: RuntimeProbe[] = matrixRows.map((row) => ({
    ...row,
    category: "wrong_signer_or_role_confusion",
  }));
  for (const row of matrixRows) {
    const pdaCandidate = row.mustInclude?.find((account) =>
      !account.equals(TOKEN_PROGRAM_ID)
      && !account.equals(attackerAta)
      && !account.equals(sourceAta)
      && !account.equals(memberAta)
      && !account.equals(assetMint),
    );
    if (pdaCandidate) {
      const tx = cloneTxWithReplacement(row, new Map([[pdaCandidate.toBase58(), fakePda]]));
      if (tx) probes.push({ ...row, tx, category: "wrong_pda_binding", attack: `${row.attack} + wrong PDA binding` });
    }

    const wrongMintTx = cloneTxWithReplacement(row, new Map([[assetMint.toBase58(), fakeMint]]));
    if (wrongMintTx) {
      probes.push({ ...row, tx: wrongMintTx, category: "wrong_mint", attack: `${row.attack} + wrong mint` });
    }

    const wrongRecipientTx = cloneTxWithReplacement(row, new Map([[attackerAta.toBase58(), fakeRecipient]]));
    if (wrongRecipientTx) {
      probes.push({ ...row, tx: wrongRecipientTx, category: "wrong_recipient", attack: `${row.attack} + alternate attacker recipient` });
    }

    const wrongTokenProgramTx = cloneTxWithReplacement(row, new Map([[TOKEN_PROGRAM_ID.toBase58(), protocol.getProgramId()]]));
    if (wrongTokenProgramTx) {
      probes.push({ ...row, tx: wrongTokenProgramTx, category: "wrong_token_program", attack: `${row.attack} + Token-2022/program substitution` });
    }

    const ledgerTarget = knownLedgerAccounts.find((ledger) => onlyProgramInstruction(row.tx).keys.some((key) => key.pubkey.equals(ledger)));
    if (ledgerTarget) {
      const tx = cloneTxWithReplacement(row, new Map([[ledgerTarget.toBase58(), fakeLedger]]));
      if (tx) probes.push({ ...row, tx, category: "fake_ledger", attack: `${row.attack} + fake ledger` });
    }

    if (onlyProgramInstruction(row.tx).keys.some((key) => key.pubkey.equals(oracleFeeAttestation))) {
      const tx = cloneTxWithReplacement(row, new Map([[oracleFeeAttestation.toBase58(), fakeAttestation]]));
      if (tx) probes.push({ ...row, tx, category: "fake_attestation", attack: `${row.attack} + fake claim attestation` });
    }

    probes.push({
      ...row,
      category: "replay_or_double_settle",
      attack: `${row.attack} + replay/double-settle attempt`,
    });
  }
  return probes;
}

function rowLikeSummary(row: RuntimeProbe) {
  const base = rowSummary(row);
  return {
    ...base,
    category: row.category,
  };
}

function writeAdversarialSummary(runtimeRows: RuntimeProbeResult[] | null): void {
  const path = process.env.OMEGAX_E2E_ADVERSARIAL_SUMMARY_PATH?.trim();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  const runtimeCounts = runtimeRows
    ? runtimeRows.reduce(
        (counts, row) => {
          counts[row.runtimeStatus] += 1;
          return counts;
        },
        { blocked: 0, unexpected_success: 0, inconclusive: 0 },
      )
    : { blocked: 0, unexpected_success: 0, inconclusive: 0 };
  writeFileSync(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        executable: Boolean(runtimeRows),
        requiredRuntimeProbeCount: runtimeRows?.length ?? 0,
        totals: {
          blocked: runtimeCounts.blocked,
          unexpectedSuccess: runtimeCounts.unexpected_success,
          inconclusive: runtimeCounts.inconclusive,
        },
        rows: matrixRows.map(rowSummary),
        runtimeRows: runtimeRows ?? [],
      },
      null,
      2,
    ),
  );
}

const matrixRows: MatrixRow[] = [
  {
    area: "fee-vault",
    instruction: "withdraw_protocol_fee_spl",
    attack: "wrong governance signer and attacker-owned recipient",
    expectedGuard: "require_governance and fee vault recipient binding",
    tx: protocol.buildWithdrawProtocolFeeSplTx({
      governanceAuthority: attacker,
      reserveDomainAddress: reserveDomain,
      paymentMint: assetMint,
      recipientTokenAccount: attackerAta,
      amount: 1n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      protocol.deriveProtocolGovernancePda(),
      protocol.deriveProtocolFeeVaultPda({ reserveDomain, assetMint }),
      attackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "fee-vault",
    instruction: "withdraw_pool_treasury_spl",
    attack: "wrong pool authority and attacker-owned recipient",
    expectedGuard: "pool oracle/curator authority and treasury fee vault binding",
    tx: protocol.buildWithdrawPoolTreasurySplTx({
      oracle: attacker,
      poolAddress: pool,
      reserveDomainAddress: reserveDomain,
      paymentMint: assetMint,
      recipientTokenAccount: attackerAta,
      amount: 1n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      protocol.derivePoolTreasuryVaultPda({ liquidityPool: pool, assetMint }),
      attackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "fee-vault",
    instruction: "withdraw_pool_oracle_fee_spl",
    attack: "wrong oracle signer and attacker-owned recipient",
    expectedGuard: "oracle profile, approved oracle, and fee recipient binding",
    tx: protocol.buildWithdrawPoolOracleFeeSplTx({
      oracle: attacker,
      oracleAddress: oracle,
      poolAddress: pool,
      reserveDomainAddress: reserveDomain,
      paymentMint: assetMint,
      recipientTokenAccount: attackerAta,
      amount: 1n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      poolOracleFeeVault,
      protocol.deriveOracleProfilePda({ oracle }),
      attackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "claim-settlement",
    instruction: "settle_claim_case",
    attack: "claim operator confusion with attacker recipient and oracle-fee accounts",
    expectedGuard: "claim operator role, member/delegate recipient, fee vault, attestation, and policy binding",
    tx: protocol.buildSettleClaimCaseTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      claimCaseAddress: claimCase,
      policySeriesAddress: policySeries,
      poolOracleFeeVaultAddress: poolOracleFeeVault,
      poolOraclePolicyAddress: poolOraclePolicy,
      oracleFeeAttestationAddress: oracleFeeAttestation,
      oracleFeeAddress: oracle,
      memberPositionAddress: protocol.deriveMemberPositionPda({ healthPlan, wallet: member }),
      vaultTokenAccountAddress: vaultTokenAccount,
      recipientTokenAccountAddress: attackerAta,
      tokenProgramId: TOKEN_PROGRAM_ID,
      amount: 1n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      protocol.deriveProtocolFeeVaultPda({ reserveDomain, assetMint }),
      poolOracleFeeVault,
      poolOraclePolicy,
      oracleFeeAttestation,
      vaultTokenAccount,
      attackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "claim-settlement",
    instruction: "settle_claim_case_selected_asset",
    attack: "selected fallback payout asset with attacker-owned payout account",
    expectedGuard: "claim operator role, explicit payout rail, selected mint, fresh price, and member/delegate owner binding",
    tx: protocol.buildSettleClaimCaseSelectedAssetTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      payoutFundingLineAddress: fundingLine,
      claimAssetMint: assetMint,
      payoutAssetMint: fallbackAssetMint,
      claimCaseAddress: claimCase,
      memberPositionAddress: protocol.deriveMemberPositionPda({ healthPlan, wallet: member }),
      payoutVaultTokenAccountAddress: fallbackVaultTokenAccount,
      recipientTokenAccountAddress: fallbackAttackerAta,
      tokenProgramId: TOKEN_PROGRAM_ID,
      claimCreditAmount: 1n,
      payoutAmount: 1n,
      policySeriesAddress: policySeries,
      settlementReasonHashHex: SAMPLE_HASH_HEX,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      protocol.deriveReserveAssetRailPda({ reserveDomain, assetMint }),
      protocol.deriveReserveAssetRailPda({ reserveDomain, assetMint: fallbackAssetMint }),
      protocol.deriveDomainAssetVaultPda({ reserveDomain, assetMint: fallbackAssetMint }),
      fallbackVaultTokenAccount,
      fallbackAttackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "obligation-settlement",
    instruction: "settle_obligation",
    attack: "linked claim payout to attacker with allocation PDA substitution pressure",
    expectedGuard: "settlement authority, linked claim, member recipient, allocation, and ledger PDA binding",
    tx: protocol.buildSettleObligationTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      obligationAddress: obligation,
      claimCaseAddress: claimCase,
      policySeriesAddress: policySeries,
      capitalClassAddress: capitalClass,
      allocationPositionAddress: allocationPosition,
      poolAssetMint: assetMint,
      memberPositionAddress: protocol.deriveMemberPositionPda({ healthPlan, wallet: member }),
      vaultTokenAccountAddress: vaultTokenAccount,
      recipientTokenAccountAddress: attackerAta,
      tokenProgramId: TOKEN_PROGRAM_ID,
      nextStatus: protocol.OBLIGATION_STATUS_SETTLED,
      amount: 1n,
      settlementReasonHashHex: SAMPLE_HASH_HEX,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      protocol.deriveDomainAssetVaultPda({ reserveDomain, assetMint }),
      protocol.derivePoolClassLedgerPda({ capitalClass, assetMint }),
      protocol.deriveAllocationLedgerPda({ allocationPosition, assetMint }),
      vaultTokenAccount,
      attackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "lp-redemption",
    instruction: "process_redemption_queue",
    attack: "wrong processor and attacker-owned redemption recipient",
    expectedGuard: "curator/governance authority and LP owner recipient binding",
    tx: protocol.buildProcessRedemptionQueueTx({
      authority: attacker,
      reserveDomainAddress: reserveDomain,
      poolAddress: pool,
      poolDepositAssetMint: assetMint,
      capitalClassAddress: capitalClass,
      lpOwnerAddress: lpOwner,
      shares: 1n,
      vaultTokenAccountAddress: vaultTokenAccount,
      recipientTokenAccountAddress: attackerAta,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      lpPosition,
      protocol.derivePoolClassLedgerPda({ capitalClass, assetMint }),
      vaultTokenAccount,
      attackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "allocation-reserve",
    instruction: "reserve_obligation",
    attack: "fake allocation-capacity routing across pool class and allocation ledgers",
    expectedGuard: "funding line, capital class, allocation position, and allocation ledger PDA binding",
    tx: protocol.buildReserveObligationTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      obligationAddress: obligation,
      policySeriesAddress: policySeries,
      capitalClassAddress: capitalClass,
      allocationPositionAddress: allocationPosition,
      poolAssetMint: assetMint,
      amount: 1n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      protocol.derivePoolClassLedgerPda({ capitalClass, assetMint }),
      allocationPosition,
      protocol.deriveAllocationLedgerPda({ allocationPosition, assetMint }),
    ],
  },
  {
    area: "governance-control",
    instruction: "rotate_protocol_governance_authority",
    attack: "wrong signer rotates governance to attacker",
    expectedGuard: "current protocol governance authority",
    tx: protocol.buildRotateGovernanceAuthorityTx({
      governanceAuthority: attacker,
      newAuthority: attacker,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [protocol.deriveProtocolGovernancePda()],
  },
  {
    area: "oracle-control",
    instruction: "set_pool_oracle_policy",
    attack: "non-curator loosens pool oracle fee and quorum policy",
    expectedGuard: "pool curator/allocator/governance authority",
    tx: protocol.buildSetPoolOraclePolicyTx({
      authority: attacker,
      poolAddress: pool,
      quorumM: 1,
      quorumN: 1,
      requireVerifiedSchema: false,
      oracleFeeBps: 999,
      allowDelegateClaim: true,
      challengeWindowSecs: 0,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [poolOraclePolicy, protocol.deriveProtocolGovernancePda()],
  },
  {
    area: "deposit-custody",
    instruction: "deposit_into_capital_class",
    attack: "fake vault token account route",
    expectedGuard: "pool deposit mint and vault token-account binding",
    tx: protocol.buildDepositIntoCapitalClassTx({
      owner: attacker,
      reserveDomainAddress: reserveDomain,
      poolAddress: pool,
      poolDepositAssetMint: assetMint,
      capitalClassAddress: capitalClass,
      sourceTokenAccountAddress: sourceAta,
      vaultTokenAccountAddress: attackerAta,
      tokenProgramId: TOKEN_PROGRAM_ID,
      amount: 1n,
      shares: 0n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      sourceAta,
      attackerAta,
      TOKEN_PROGRAM_ID,
      protocol.deriveDomainAssetVaultPda({ reserveDomain, assetMint }),
    ],
  },
];

test("adversarial matrix owns all live instructions through the surface manifest", () => {
  const live = instructionSurface().map((instruction) => instruction.name).sort();
  const owned = [
    ...scenarioNames().flatMap((name) => SCENARIO_DEFINITIONS[name].instructions),
    ...Object.keys(INSTRUCTION_EXCEPTION_REASONS),
  ].sort();
  const missing = live.filter((name) => !owned.includes(name));
  assert.deepEqual(duplicateOwnedInstructions(), []);
  assert.deepEqual(blankInstructionExceptionReasons(), []);
  assert.deepEqual(missing, []);
  assert.equal(live.length, 68);
});

test("money and control paths include adversarial signer and account-binding probes", () => {
  assert(matrixRows.length >= 10, "expected broad money/control path coverage");
  const coveredAreas = new Set(matrixRows.map((row) => row.area));
  for (const area of [
    "fee-vault",
    "claim-settlement",
    "obligation-settlement",
    "lp-redemption",
    "allocation-reserve",
    "governance-control",
    "oracle-control",
    "deposit-custody",
  ]) {
    assert(coveredAreas.has(area), `missing adversarial matrix area ${area}`);
  }

  for (const row of matrixRows) {
    assertSigner(row.tx, attacker);
    for (const account of row.mustInclude ?? []) {
      assertAccount(row.tx, account);
    }
    if (row.attack.includes("recipient") || row.attack.includes("vault")) {
      assertWritableAccount(row.tx, attackerAta);
    }
  }
});

test("builder rejects wrong token program before localnet execution", () => {
  assert.throws(
    () => protocol.buildDepositIntoCapitalClassTx({
      owner: attacker,
      reserveDomainAddress: reserveDomain,
      poolAddress: pool,
      poolDepositAssetMint: assetMint,
      capitalClassAddress: capitalClass,
      sourceTokenAccountAddress: sourceAta,
      vaultTokenAccountAddress: attackerAta,
      tokenProgramId: protocol.getProgramId(),
      amount: 1n,
      shares: 0n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    /classic SPL Token program/,
  );
});

test("executable adversarial matrix probes are blocked on localnet", async () => {
  const rpcUrl = process.env.SOLANA_RPC_URL?.trim();
  if (!rpcUrl) {
    writeAdversarialSummary(null);
    return;
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const latestForAirdrop = await connection.getLatestBlockhash("confirmed");
  const airdropSignature = await connection.requestAirdrop(attacker, 2_000_000_000);
  await connection.confirmTransaction(
    { signature: airdropSignature, ...latestForAirdrop },
    "confirmed",
  );

  const probes = runtimeProbes();
  assert(probes.length >= matrixRows.length * 4, "expected runtime variants beyond the static row set");
  const results: RuntimeProbeResult[] = [];
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  for (const probe of probes) {
    try {
      const message = new TransactionMessage({
        payerKey: attacker,
        recentBlockhash: blockhash,
        instructions: probe.tx.instructions,
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);
      tx.sign([attackerKeypair]);
      const result = await connection.simulateTransaction(tx, {
        commitment: "confirmed",
        sigVerify: false,
      });
      const logs = result.value.logs ?? [];
      results.push({
        ...rowLikeSummary(probe),
        runtimeStatus: result.value.err ? "blocked" : "unexpected_success",
        rejectionReason: result.value.err ? JSON.stringify(result.value.err) : "simulation succeeded",
        logs,
      });
    } catch (error) {
      results.push({
        ...rowLikeSummary(probe),
        runtimeStatus: "inconclusive",
        rejectionReason: error instanceof Error ? error.message : String(error),
        logs: [],
      });
    }
  }

  writeAdversarialSummary(results);
  const unexpectedSuccess = results.filter((row) => row.runtimeStatus === "unexpected_success");
  const inconclusive = results.filter((row) => row.runtimeStatus === "inconclusive");
  assert.deepEqual(unexpectedSuccess, []);
  assert.deepEqual(inconclusive, []);
  assert.equal(results.filter((row) => row.runtimeStatus === "blocked").length, results.length);
});
