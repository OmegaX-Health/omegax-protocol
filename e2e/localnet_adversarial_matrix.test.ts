// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import test from "node:test";

import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

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
const attacker = Keypair.generate().publicKey;
const oracle = Keypair.generate().publicKey;
const lpOwner = Keypair.generate().publicKey;
const member = Keypair.generate().publicKey;
const assetMint = Keypair.generate().publicKey;
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
const attackerAta = getAssociatedTokenAddressSync(assetMint, attacker, true, TOKEN_PROGRAM_ID);
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
  assert.equal(live.length, 67);
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

test("adversarial matrix writes an evidence summary when requested", () => {
  const path = process.env.OMEGAX_E2E_ADVERSARIAL_SUMMARY_PATH?.trim();
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rows: matrixRows.map(rowSummary),
      },
      null,
      2,
    ),
  );
});
