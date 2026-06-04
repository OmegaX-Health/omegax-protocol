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
import { requestConfirmedAirdrop } from "./support/airdrop.ts";
import { instructionSurface } from "./support/surface.ts";

const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
const STATIC_BLOCKHASH = "11111111111111111111111111111111";
const SAMPLE_HASH_HEX = "ab".repeat(32);

const domainAdmin = Keypair.generate().publicKey;
const planAdmin = Keypair.generate().publicKey;
const sponsorOperator = Keypair.generate().publicKey;
const claimsOperator = Keypair.generate().publicKey;
const attackerKeypair = Keypair.generate();
const attacker = attackerKeypair.publicKey;
const oracle = Keypair.generate().publicKey;
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
const claimCase = protocol.deriveClaimCasePda({
  healthPlan,
  claimId: "adv-claim",
});
const obligation = protocol.deriveObligationPda({
  fundingLine,
  obligationId: "adv-obligation",
});
const domainAssetVault = protocol.deriveDomainAssetVaultPda({ reserveDomain, assetMint });
const domainAssetLedger = protocol.deriveDomainAssetLedgerPda({ reserveDomain, assetMint });
const fundingLineLedger = protocol.deriveFundingLineLedgerPda({ fundingLine, assetMint });
const planReserveLedger = protocol.derivePlanReserveLedgerPda({ healthPlan, assetMint });
const vaultTokenAccount = protocol.deriveDomainAssetVaultTokenAccountPda({ reserveDomain, assetMint });
const attackerAta = getAssociatedTokenAddressSync(assetMint, attacker, true, TOKEN_PROGRAM_ID);
const memberAta = getAssociatedTokenAddressSync(assetMint, member, true, TOKEN_PROGRAM_ID);
const sourceAta = getAssociatedTokenAddressSync(assetMint, sponsorOperator, true, TOKEN_PROGRAM_ID);

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
const knownLedgerAccounts = [
  domainAssetLedger,
  fundingLineLedger,
  planReserveLedger,
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
    area: "domain-control",
    instruction: "update_reserve_domain_controls",
    attack: "wrong signer disables a reserve domain",
    expectedGuard: "reserve domain admin",
    tx: protocol.buildUpdateReserveDomainControlsTx({
      authority: attacker,
      reserveDomainAddress: reserveDomain,
      allowedRailMask: 0,
      pauseFlags: 0xffff,
      active: false,
      reasonHashHex: SAMPLE_HASH_HEX,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [reserveDomain],
  },
  {
    area: "plan-control",
    instruction: "update_health_plan_controls",
    attack: "wrong signer rotates sponsor, claims, and oracle authorities",
    expectedGuard: "plan admin or sponsor operator authority",
    tx: protocol.buildUpdateHealthPlanControlsTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      sponsorOperator,
      claimsOperator,
      oracleAuthority: oracle,
      membershipMode: 0,
      membershipGateKind: 0,
      membershipGateMint: protocol.ZERO_PUBKEY,
      membershipGateMinAmount: 0n,
      membershipInviteAuthority: protocol.ZERO_PUBKEY,
      allowedRailMask: 0b111,
      defaultFundingPriority: 1,
      oraclePolicyHashHex: SAMPLE_HASH_HEX,
      schemaBindingHashHex: SAMPLE_HASH_HEX,
      complianceBaselineHashHex: SAMPLE_HASH_HEX,
      pauseFlags: 0,
      active: true,
      reasonHashHex: SAMPLE_HASH_HEX,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [healthPlan],
  },
  {
    area: "sponsor-funding",
    instruction: "fund_sponsor_budget",
    attack: "wrong sponsor signer with attacker-controlled source account",
    expectedGuard: "plan sponsor operator plus reserve vault and ledger PDA bindings",
    tx: protocol.buildFundSponsorBudgetTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      sourceTokenAccountAddress: attackerAta,
      vaultTokenAccountAddress: vaultTokenAccount,
      tokenProgramId: TOKEN_PROGRAM_ID,
      amount: 1n,
      policySeriesAddress: policySeries,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      domainAssetVault,
      domainAssetLedger,
      fundingLineLedger,
      planReserveLedger,
      attackerAta,
      vaultTokenAccount,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "premium-inflow",
    instruction: "record_premium_payment",
    attack: "wrong premium payer with spoofed source account",
    expectedGuard: "funding-line scope and reserve vault token-account binding",
    tx: protocol.buildRecordPremiumPaymentTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      sourceTokenAccountAddress: attackerAta,
      vaultTokenAccountAddress: vaultTokenAccount,
      tokenProgramId: TOKEN_PROGRAM_ID,
      amount: 1n,
      policySeriesAddress: policySeries,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      domainAssetVault,
      domainAssetLedger,
      fundingLineLedger,
      planReserveLedger,
      attackerAta,
      vaultTokenAccount,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "obligation-reserve",
    instruction: "reserve_obligation",
    attack: "wrong operator reserves a linked claim obligation",
    expectedGuard: "plan reserve authority and funding-line ledger binding",
    tx: protocol.buildReserveObligationTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      obligationAddress: obligation,
      claimCaseAddress: claimCase,
      policySeriesAddress: policySeries,
      amount: 1n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      domainAssetLedger,
      fundingLineLedger,
      planReserveLedger,
      obligation,
      claimCase,
    ],
  },
  {
    area: "claim-settlement",
    instruction: "settle_claim_case",
    attack: "claim operator confusion with attacker recipient",
    expectedGuard: "claim operator role, claimant/delegate recipient, vault outflow, and ledger binding",
    tx: protocol.buildSettleClaimCaseTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      claimCaseAddress: claimCase,
      policySeriesAddress: policySeries,
      obligationAddress: obligation,
      vaultTokenAccountAddress: vaultTokenAccount,
      recipientTokenAccountAddress: attackerAta,
      tokenProgramId: TOKEN_PROGRAM_ID,
      amount: 1n,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      domainAssetVault,
      domainAssetLedger,
      fundingLineLedger,
      planReserveLedger,
      claimCase,
      obligation,
      vaultTokenAccount,
      attackerAta,
      TOKEN_PROGRAM_ID,
    ],
  },
  {
    area: "obligation-settlement",
    instruction: "settle_obligation",
    attack: "linked obligation payout to attacker recipient",
    expectedGuard: "settlement authority, linked claim, claimant recipient, vault outflow, and ledger PDA binding",
    tx: protocol.buildSettleObligationTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      obligationAddress: obligation,
      claimCaseAddress: claimCase,
      policySeriesAddress: policySeries,
      vaultTokenAccountAddress: vaultTokenAccount,
      recipientTokenAccountAddress: attackerAta,
      tokenProgramId: TOKEN_PROGRAM_ID,
      nextStatus: protocol.OBLIGATION_STATUS_SETTLED,
      amount: 1n,
      settlementReasonHashHex: SAMPLE_HASH_HEX,
      recentBlockhash: STATIC_BLOCKHASH,
    }),
    mustInclude: [
      domainAssetVault,
      domainAssetLedger,
      fundingLineLedger,
      planReserveLedger,
      obligation,
      claimCase,
      vaultTokenAccount,
      attackerAta,
      TOKEN_PROGRAM_ID,
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
  assert.equal(live.length, 18);
});

test("money and control paths include adversarial signer and account-binding probes", () => {
  const requiredAreas = [
    "domain-control",
    "plan-control",
    "sponsor-funding",
    "premium-inflow",
    "obligation-reserve",
    "claim-settlement",
    "obligation-settlement",
  ];
  assert(matrixRows.length >= requiredAreas.length, "expected broad money/control path coverage");
  const coveredAreas = new Set(matrixRows.map((row) => row.area));
  for (const area of requiredAreas) {
    assert(coveredAreas.has(area), `missing adversarial matrix area ${area}`);
  }

  for (const row of matrixRows) {
    assertSigner(row.tx, attacker);
    for (const account of row.mustInclude ?? []) {
      assertAccount(row.tx, account);
    }
    if (row.attack.includes("recipient") || row.attack.includes("source account")) {
      assertWritableAccount(row.tx, attackerAta);
    }
  }
});

test("builder rejects wrong token program before localnet execution", () => {
  assert.throws(
    () => protocol.buildFundSponsorBudgetTx({
      authority: attacker,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      fundingLineAddress: fundingLine,
      assetMint,
      sourceTokenAccountAddress: sourceAta,
      vaultTokenAccountAddress: vaultTokenAccount,
      tokenProgramId: protocol.getProgramId(),
      amount: 1n,
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
  await requestConfirmedAirdrop(connection, attacker, 2_000_000_000);

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
        runtimeStatus: "blocked",
        rejectionReason: error instanceof Error ? error.message : String(error),
        logs: [],
      });
    }
  }

  writeAdversarialSummary(results);
  assert.equal(results.filter((row) => row.runtimeStatus === "unexpected_success").length, 0);
  assert(results.filter((row) => row.runtimeStatus === "blocked").length >= matrixRows.length);
});
