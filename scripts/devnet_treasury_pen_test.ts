// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";

import protocol from "../frontend/lib/protocol.ts";

const DEVNET_RPC_URL =
  process.env.SOLANA_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
  "https://api.devnet.solana.com";

const ZERO_PUBKEY = "11111111111111111111111111111111";
const CLI_ARGS = process.argv.slice(2);
const STRICT_MODE = CLI_ARGS.includes("--strict");

type ProbeStatus = "blocked" | "vulnerable" | "skipped" | "inconclusive";

type ProbeResult = {
  name: string;
  target: string;
  status: ProbeStatus;
  expected: string;
  detail: string;
  err?: unknown;
  logs?: string[];
};

type ConsoleSnapshot = Awaited<ReturnType<typeof protocol.loadProtocolConsoleSnapshot>>;

type RequiredCanary = {
  name: string;
  ready: boolean;
  detail: string;
};

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cliValue(name: string): string | null {
  const index = CLI_ARGS.indexOf(name);
  if (index === -1) return null;
  return CLI_ARGS[index + 1] ?? null;
}

function stringifyWithBigints(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

function nonZeroAddress(value?: string | null): value is string {
  return Boolean(value && value !== ZERO_PUBKEY);
}

function redactRpcUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.search) url.search = "?...";
    if (url.username || url.password) {
      url.username = "...";
      url.password = "";
    }
    return url.toString();
  } catch {
    return value.includes("?") ? `${value.slice(0, value.indexOf("?"))}?...` : value;
  }
}

function hasWithdrawableSplFees<T extends { assetMint: string; accruedFees: bigint; withdrawnFees: bigint }>(
  rows: T[],
): boolean {
  return rows.some((row) =>
    row.assetMint !== protocol.NATIVE_SOL_MINT && row.accruedFees > row.withdrawnFees
  );
}

function hasLinkedClaimCandidate(snapshot: ConsoleSnapshot): boolean {
  return snapshot.obligations.some((obligation) => {
    if (!obligation.claimCase || obligation.status === protocol.OBLIGATION_STATUS_SETTLED) return false;
    if (obligation.outstandingAmount <= 0n) return false;
    const claim = snapshot.claimCases.find((row) => row.address === obligation.claimCase);
    const vault = snapshot.domainAssetVaults.find((row) =>
      row.reserveDomain === obligation.reserveDomain &&
      row.assetMint === obligation.assetMint &&
      nonZeroAddress(row.vaultTokenAccount)
    );
    return Boolean(claim && vault);
  });
}

function hasLpRedemptionCandidate(snapshot: ConsoleSnapshot): boolean {
  return snapshot.lpPositions.some((position) => {
    if (position.pendingRedemptionShares <= 0n) return false;
    const capitalClass = snapshot.capitalClasses.find((row) => row.address === position.capitalClass);
    const pool = capitalClass
      ? snapshot.liquidityPools.find((row) => row.address === capitalClass.liquidityPool)
      : null;
    const vault = pool
      ? snapshot.domainAssetVaults.find((row) =>
        row.reserveDomain === pool.reserveDomain &&
        row.assetMint === pool.depositAssetMint &&
        nonZeroAddress(row.vaultTokenAccount)
      )
      : null;
    return Boolean(capitalClass && pool && vault);
  });
}

function hasAllocationObligationCandidate(snapshot: ConsoleSnapshot): boolean {
  return snapshot.obligations.some((obligation) => {
    if (!nonZeroAddress(obligation.allocationPosition) || !nonZeroAddress(obligation.capitalClass)) return false;
    if (obligation.status === protocol.OBLIGATION_STATUS_SETTLED || obligation.outstandingAmount <= 0n) return false;
    const vault = snapshot.domainAssetVaults.find((row) =>
      row.reserveDomain === obligation.reserveDomain &&
      row.assetMint === obligation.assetMint &&
      nonZeroAddress(row.vaultTokenAccount)
    );
    return Boolean(vault);
  });
}

function requiredCanaries(snapshot: ConsoleSnapshot): RequiredCanary[] {
  return [
    {
      name: "domain-asset-vault-spl-balance",
      ready: snapshot.domainAssetVaults.some((vault) =>
        vault.totalAssets > 0n && nonZeroAddress(vault.vaultTokenAccount)
      ),
      detail: "At least one SPL DomainAssetVault must hold assets for raw vault-drain probes.",
    },
    {
      name: "protocol-fee-vault-accrual",
      ready: hasWithdrawableSplFees(snapshot.protocolFeeVaults),
      detail: "A protocol fee vault must exist with withdrawable accrued SPL fees.",
    },
    {
      name: "pool-treasury-vault-accrual",
      ready: hasWithdrawableSplFees(snapshot.poolTreasuryVaults),
      detail: "A pool treasury vault must exist with withdrawable accrued SPL fees.",
    },
    {
      name: "pool-oracle-fee-vault-accrual",
      ready: hasWithdrawableSplFees(snapshot.poolOracleFeeVaults),
      detail: "A pool oracle fee vault must exist with withdrawable accrued SPL fees.",
    },
    {
      name: "linked-claim-obligation",
      ready: hasLinkedClaimCandidate(snapshot),
      detail: "An unsettled linked-claim obligation must exist with usable SPL outflow accounts.",
    },
    {
      name: "pending-lp-redemption",
      ready: hasLpRedemptionCandidate(snapshot),
      detail: "An LP position must have pending redemption shares and usable vault custody.",
    },
    {
      name: "lp-allocation-obligation",
      ready: hasAllocationObligationCandidate(snapshot),
      detail: "An unsettled allocation-scoped obligation must exist for allocation/PDA binding probes.",
    },
  ];
}

function probeSkipped(name: string, target: string, expected: string, detail: string): ProbeResult {
  return { name, target, status: "skipped", expected, detail };
}

async function simulateAttack(
  connection: Connection,
  simulationFeePayer: PublicKey,
  name: string,
  target: string,
  expected: string,
  transaction: Transaction,
): Promise<ProbeResult> {
  transaction.feePayer = simulationFeePayer;
  try {
    // Intentionally no signer array: this keeps the run non-mutating and
    // avoids devnet faucet flakiness while still executing the instruction
    // path against live accounts. Instruction-level signer bits are preserved,
    // so auth checks still see the attacker authority as a signer.
    const simulation = await connection.simulateTransaction(transaction);
    const { err, logs } = simulation.value;
    if (!err) {
      return {
        name,
        target,
        status: "vulnerable",
        expected,
        detail: "Simulation succeeded. Treat this as a real drain path until disproven.",
        logs: logs ?? undefined,
      };
    }
    return {
      name,
      target,
      status: "blocked",
      expected,
      detail: "Simulation failed before funds could move.",
      err,
      logs: logs ?? undefined,
    };
  } catch (error) {
    return {
      name,
      target,
      status: "inconclusive",
      expected,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function rawSplVaultDrainProbes(
  connection: Connection,
  attacker: Keypair,
  simulationFeePayer: PublicKey,
  snapshot: ConsoleSnapshot,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  const liveVaults = snapshot.domainAssetVaults.filter((vault) =>
    vault.totalAssets > 0n && nonZeroAddress(vault.vaultTokenAccount)
  );

  if (liveVaults.length === 0) {
    return [
      probeSkipped(
        "raw-spl-vault-drain",
        "DomainAssetVault",
        "Live vault token accounts should reject attacker-authorized transfers.",
        "No live DomainAssetVault with a non-zero vault token account and non-zero totalAssets was found.",
      ),
    ];
  }

  for (const vault of liveVaults) {
    const mintAddress = new PublicKey(vault.assetMint);
    const vaultTokenAccount = new PublicKey(vault.vaultTokenAccount);
    try {
      const [mint, tokenAccount] = await Promise.all([
        getMint(connection, mintAddress, "confirmed", TOKEN_PROGRAM_ID),
        getAccount(connection, vaultTokenAccount, "confirmed", TOKEN_PROGRAM_ID),
      ]);
      if (tokenAccount.amount === 0n) {
        results.push({
          name: "raw-spl-vault-drain",
          target: `${vault.address}:${vault.vaultTokenAccount}`,
          status: "skipped",
          expected: "A live vault token balance is needed to test raw SPL theft.",
          detail: "Vault state has totalAssets, but the token account amount is zero.",
        });
        continue;
      }

      const attackerAta = getAssociatedTokenAddressSync(mintAddress, attacker.publicKey);
      const transaction = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          simulationFeePayer,
          attackerAta,
          attacker.publicKey,
          mintAddress,
        ),
        createTransferCheckedInstruction(
          vaultTokenAccount,
          mintAddress,
          attackerAta,
          attacker.publicKey,
          1n,
          mint.decimals,
        ),
      );
      results.push(
        await simulateAttack(
          connection,
          simulationFeePayer,
          "raw-spl-vault-drain",
          `${vault.address}:${vault.vaultTokenAccount}`,
          "SPL Token should reject because the attacker is not the vault token-account authority.",
          transaction,
        ),
      );
    } catch (error) {
      results.push({
        name: "raw-spl-vault-drain",
        target: `${vault.address}:${vault.vaultTokenAccount}`,
        status: "inconclusive",
        expected: "Vault token account and mint should be readable on devnet.",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function feeVaultWithdrawProbes(
  connection: Connection,
  attacker: Keypair,
  simulationFeePayer: PublicKey,
  snapshot: ConsoleSnapshot,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const feeVaults = [
    ...snapshot.protocolFeeVaults.map((vault) => ({ rail: "protocol-fee", vault })),
    ...snapshot.poolTreasuryVaults.map((vault) => ({ rail: "pool-treasury", vault })),
    ...snapshot.poolOracleFeeVaults.map((vault) => ({ rail: "pool-oracle-fee", vault })),
  ].filter(({ vault }) => vault.assetMint !== protocol.NATIVE_SOL_MINT && vault.accruedFees > vault.withdrawnFees);

  if (feeVaults.length === 0) {
    return [
      probeSkipped(
        "omegax-fee-withdraw-to-attacker",
        "fee-vault rails",
        "Initialized fee vaults should reject attacker signers and attacker-owned recipients.",
        "No live SPL fee vault with withdrawable accrued fees was initialized on devnet.",
      ),
    ];
  }

  for (const { rail, vault } of feeVaults) {
    const mint = new PublicKey(vault.assetMint);
    const attackerAta = getAssociatedTokenAddressSync(mint, attacker.publicKey);
    const setup = createAssociatedTokenAccountIdempotentInstruction(
      simulationFeePayer,
      attackerAta,
      attacker.publicKey,
      mint,
    );
    const amount = vault.accruedFees - vault.withdrawnFees > 0n ? 1n : 0n;
    if (amount === 0n) continue;

    let attackTx: Transaction | null = null;
    if (rail === "protocol-fee") {
      attackTx = protocol.buildWithdrawProtocolFeeSplTx({
        governanceAuthority: attacker.publicKey,
        reserveDomainAddress: vault.reserveDomain,
        paymentMint: vault.assetMint,
        recipientTokenAccount: attackerAta,
        amount,
        recentBlockhash: ZERO_PUBKEY,
      });
    } else if (rail === "pool-treasury") {
      const poolVault = vault as ConsoleSnapshot["poolTreasuryVaults"][number];
      const pool = snapshot.liquidityPools.find((row) => row.address === poolVault.liquidityPool);
      if (!pool) {
        results.push(
          probeSkipped(
            "omegax-fee-withdraw-to-attacker",
            vault.address,
            "A matching liquidity pool is required to build the withdraw probe.",
            "PoolTreasuryVault references a liquidity pool missing from the live snapshot.",
          ),
        );
        continue;
      }
      attackTx = protocol.buildWithdrawPoolTreasurySplTx({
        oracle: attacker.publicKey,
        poolAddress: poolVault.liquidityPool,
        reserveDomainAddress: pool.reserveDomain,
        paymentMint: poolVault.assetMint,
        recipientTokenAccount: attackerAta,
        amount,
        recentBlockhash: ZERO_PUBKEY,
      });
    } else {
      const oracleVault = vault as ConsoleSnapshot["poolOracleFeeVaults"][number];
      const pool = snapshot.liquidityPools.find((row) => row.address === oracleVault.liquidityPool);
      if (!pool) {
        results.push(
          probeSkipped(
            "omegax-fee-withdraw-to-attacker",
            vault.address,
            "A matching liquidity pool is required to build the withdraw probe.",
            "PoolOracleFeeVault references a liquidity pool missing from the live snapshot.",
          ),
        );
        continue;
      }
      attackTx = protocol.buildWithdrawPoolOracleFeeSplTx({
        oracle: attacker.publicKey,
        oracleAddress: oracleVault.oracle,
        poolAddress: oracleVault.liquidityPool,
        reserveDomainAddress: pool.reserveDomain,
        paymentMint: oracleVault.assetMint,
        recipientTokenAccount: attackerAta,
        amount,
        recentBlockhash: ZERO_PUBKEY,
      });
    }

    const transaction = new Transaction().add(setup, ...attackTx.instructions);
    results.push(
      await simulateAttack(
        connection,
        simulationFeePayer,
        "omegax-fee-withdraw-to-attacker",
        `${rail}:${vault.address}`,
        "OmegaX should reject the attacker signer and attacker-owned recipient.",
        transaction,
      ),
    );
  }

  return results;
}

async function claimObligationSettlementProbes(
  connection: Connection,
  attacker: Keypair,
  simulationFeePayer: PublicKey,
  snapshot: ConsoleSnapshot,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  const candidate = snapshot.obligations.find((obligation) => {
    if (!obligation.claimCase || obligation.status === protocol.OBLIGATION_STATUS_SETTLED) return false;
    if (obligation.outstandingAmount <= 0n) return false;
    const claim = snapshot.claimCases.find((row) => row.address === obligation.claimCase);
    const vault = snapshot.domainAssetVaults.find((row) =>
      row.reserveDomain === obligation.reserveDomain &&
      row.assetMint === obligation.assetMint &&
      nonZeroAddress(row.vaultTokenAccount)
    );
    return Boolean(claim && vault);
  });

  if (!candidate?.claimCase) {
    return [
      probeSkipped(
        "omegax-linked-claim-settle-to-attacker",
        "settle_obligation",
        "Linked claim settlements should reject an attacker signer or attacker-owned recipient.",
        "No live unsettled linked-claim obligation with a usable vault token account was found.",
      ),
    ];
  }

  const claim = snapshot.claimCases.find((row) => row.address === candidate.claimCase)!;
  const vault = snapshot.domainAssetVaults.find((row) =>
    row.reserveDomain === candidate.reserveDomain &&
    row.assetMint === candidate.assetMint &&
    nonZeroAddress(row.vaultTokenAccount)
  )!;
  const mint = new PublicKey(candidate.assetMint);
  const attackerAta = getAssociatedTokenAddressSync(mint, attacker.publicKey);
  const setup = createAssociatedTokenAccountIdempotentInstruction(
    simulationFeePayer,
    attackerAta,
    attacker.publicKey,
    mint,
  );
  const attackTx = protocol.buildSettleObligationTx({
    authority: attacker.publicKey,
    healthPlanAddress: candidate.healthPlan,
    reserveDomainAddress: candidate.reserveDomain,
    fundingLineAddress: candidate.fundingLine,
    assetMint: candidate.assetMint,
    obligationAddress: candidate.address,
    recentBlockhash: ZERO_PUBKEY,
    nextStatus: protocol.OBLIGATION_STATUS_SETTLED,
    amount: 1n,
    claimCaseAddress: candidate.claimCase,
    policySeriesAddress: candidate.policySeries,
    capitalClassAddress: candidate.capitalClass,
    allocationPositionAddress: candidate.allocationPosition,
    poolAssetMint: candidate.assetMint,
    memberPositionAddress: claim.memberPosition,
    vaultTokenAccountAddress: vault.vaultTokenAccount,
    recipientTokenAccountAddress: attackerAta,
  });

  results.push(
    await simulateAttack(
      connection,
      simulationFeePayer,
      "omegax-linked-claim-settle-to-attacker",
      candidate.address,
      "OmegaX should reject because the attacker is not the claim/operator authority and the recipient is not the member/delegate.",
      new Transaction().add(setup, ...attackTx.instructions),
    ),
  );

  return results;
}

async function redemptionProbes(
  connection: Connection,
  attacker: Keypair,
  simulationFeePayer: PublicKey,
  snapshot: ConsoleSnapshot,
): Promise<ProbeResult[]> {
  const candidate = snapshot.lpPositions.find((position) => {
    if (position.pendingRedemptionShares <= 0n) return false;
    const capitalClass = snapshot.capitalClasses.find((row) => row.address === position.capitalClass);
    const pool = capitalClass
      ? snapshot.liquidityPools.find((row) => row.address === capitalClass.liquidityPool)
      : null;
    const vault = pool
      ? snapshot.domainAssetVaults.find((row) =>
        row.reserveDomain === pool.reserveDomain &&
        row.assetMint === pool.depositAssetMint &&
        nonZeroAddress(row.vaultTokenAccount)
      )
      : null;
    return Boolean(capitalClass && pool && vault);
  });

  if (!candidate) {
    return [
      probeSkipped(
        "omegax-redemption-process-to-attacker",
        "process_redemption_queue",
        "LP redemptions should reject attacker signer/recipient routing.",
        "No live LP position with pending redemption shares and a usable vault token account was found.",
      ),
    ];
  }

  const capitalClass = snapshot.capitalClasses.find((row) => row.address === candidate.capitalClass)!;
  const pool = snapshot.liquidityPools.find((row) => row.address === capitalClass.liquidityPool)!;
  const vault = snapshot.domainAssetVaults.find((row) =>
    row.reserveDomain === pool.reserveDomain &&
    row.assetMint === pool.depositAssetMint &&
    nonZeroAddress(row.vaultTokenAccount)
  )!;
  const mint = new PublicKey(pool.depositAssetMint);
  const attackerAta = getAssociatedTokenAddressSync(mint, attacker.publicKey);
  const setup = createAssociatedTokenAccountIdempotentInstruction(
    simulationFeePayer,
    attackerAta,
    attacker.publicKey,
    mint,
  );
  const attackTx = protocol.buildProcessRedemptionQueueTx({
    authority: attacker.publicKey,
    reserveDomainAddress: pool.reserveDomain,
    poolAddress: pool.address,
    poolDepositAssetMint: pool.depositAssetMint,
    capitalClassAddress: capitalClass.address,
    lpOwnerAddress: candidate.owner,
    recentBlockhash: ZERO_PUBKEY,
    shares: 1n,
    vaultTokenAccountAddress: vault.vaultTokenAccount,
    recipientTokenAccountAddress: attackerAta,
  });

  return [
    await simulateAttack(
      connection,
      simulationFeePayer,
      "omegax-redemption-process-to-attacker",
      candidate.address,
      "OmegaX should reject because the attacker is not curator/governance and the recipient is not the LP owner.",
      new Transaction().add(setup, ...attackTx.instructions),
    ),
  ];
}

async function allocationObligationSettlementProbes(
  connection: Connection,
  attacker: Keypair,
  simulationFeePayer: PublicKey,
  snapshot: ConsoleSnapshot,
): Promise<ProbeResult[]> {
  const candidate = snapshot.obligations.find((obligation) => {
    if (!nonZeroAddress(obligation.allocationPosition) || !nonZeroAddress(obligation.capitalClass)) return false;
    if (obligation.status === protocol.OBLIGATION_STATUS_SETTLED || obligation.outstandingAmount <= 0n) return false;
    const vault = snapshot.domainAssetVaults.find((row) =>
      row.reserveDomain === obligation.reserveDomain &&
      row.assetMint === obligation.assetMint &&
      nonZeroAddress(row.vaultTokenAccount)
    );
    return Boolean(vault);
  });

  if (!candidate) {
    return [
      probeSkipped(
        "omegax-allocation-obligation-settle-to-attacker",
        "settle_obligation",
        "Allocation-scoped obligations should reject attacker signer/recipient routing.",
        "No live unsettled allocation-scoped obligation with a usable vault token account was found.",
      ),
    ];
  }

  const vault = snapshot.domainAssetVaults.find((row) =>
    row.reserveDomain === candidate.reserveDomain &&
    row.assetMint === candidate.assetMint &&
    nonZeroAddress(row.vaultTokenAccount)
  )!;
  const mint = new PublicKey(candidate.assetMint);
  const attackerAta = getAssociatedTokenAddressSync(mint, attacker.publicKey);
  const setup = createAssociatedTokenAccountIdempotentInstruction(
    simulationFeePayer,
    attackerAta,
    attacker.publicKey,
    mint,
  );
  const attackTx = protocol.buildSettleObligationTx({
    authority: attacker.publicKey,
    healthPlanAddress: candidate.healthPlan,
    reserveDomainAddress: candidate.reserveDomain,
    fundingLineAddress: candidate.fundingLine,
    assetMint: candidate.assetMint,
    obligationAddress: candidate.address,
    recentBlockhash: ZERO_PUBKEY,
    nextStatus: protocol.OBLIGATION_STATUS_SETTLED,
    amount: 1n,
    policySeriesAddress: candidate.policySeries,
    capitalClassAddress: candidate.capitalClass,
    allocationPositionAddress: candidate.allocationPosition,
    poolAssetMint: candidate.assetMint,
    vaultTokenAccountAddress: vault.vaultTokenAccount,
    recipientTokenAccountAddress: attackerAta,
    tokenProgramId: TOKEN_PROGRAM_ID,
  });

  return [
    await simulateAttack(
      connection,
      simulationFeePayer,
      "omegax-allocation-obligation-settle-to-attacker",
      candidate.address,
      "OmegaX should reject because the attacker is not an authorized settlement controller and allocation ledgers must bind to the obligation.",
      new Transaction().add(setup, ...attackTx.instructions),
    ),
  ];
}

async function chooseSimulationFeePayer(
  connection: Connection,
  snapshot: ConsoleSnapshot,
): Promise<PublicKey> {
  const candidates = [
    snapshot.protocolGovernance?.governanceAuthority,
    ...snapshot.reserveDomains.map((row) => row.domainAdmin),
    ...snapshot.healthPlans.map((row) => row.planAdmin),
  ].filter((value): value is string => Boolean(value));

  for (const address of [...new Set(candidates)]) {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey, "confirmed");
    if (balance > 10_000_000) return publicKey;
  }

  throw new Error("No funded public devnet account found for non-mutating simulation fee payer.");
}

function writeEvidenceReport(params: {
  attacker: PublicKey;
  counts: Record<ProbeStatus, number>;
  required: RequiredCanary[];
  results: ProbeResult[];
  simulationFeePayer: PublicKey;
  snapshot: ConsoleSnapshot;
}): { jsonPath: string; markdownPath: string } {
  const outDir = resolve(cliValue("--out-dir") ?? process.env.OMEGAX_TREASURY_PEN_TEST_OUT_DIR ?? "artifacts");
  mkdirSync(outDir, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = resolve(outDir, `devnet-treasury-pen-test-${stamp}.json`);
  const markdownPath = resolve(outDir, `devnet-treasury-pen-test-${stamp}.md`);
  const missing = params.required.filter((item) => !item.ready);
  const evidence = {
    generatedAt: new Date().toISOString(),
    strictMode: STRICT_MODE,
    rpc: redactRpcUrl(DEVNET_RPC_URL),
    attacker: params.attacker.toBase58(),
    simulationFeePayer: params.simulationFeePayer.toBase58(),
    counts: params.counts,
    requiredCanaries: params.required,
    liveSnapshot: {
      domainAssetVaults: params.snapshot.domainAssetVaults.length,
      protocolFeeVaults: params.snapshot.protocolFeeVaults.length,
      poolTreasuryVaults: params.snapshot.poolTreasuryVaults.length,
      poolOracleFeeVaults: params.snapshot.poolOracleFeeVaults.length,
      claimCases: params.snapshot.claimCases.length,
      obligations: params.snapshot.obligations.length,
      lpPositions: params.snapshot.lpPositions.length,
      allocationPositions: params.snapshot.allocationPositions.length,
    },
    acceptedSkipReasons: [
      {
        name: "sol-only-fee-rails",
        reason: "Strict rehearsal requires SPL canaries. SOL-only rails remain unsupported by the current devnet seed plan and must be justified separately before release sign-off.",
      },
    ],
    results: params.results,
  };
  writeFileSync(jsonPath, stringifyWithBigints(evidence));

  const markdown = [
    "# Devnet Treasury Pen-Test Evidence",
    "",
    `Generated: ${evidence.generatedAt}`,
    `Strict mode: ${STRICT_MODE ? "yes" : "no"}`,
    `RPC: ${evidence.rpc}`,
    `Attacker: ${evidence.attacker}`,
    `Simulation fee payer: ${evidence.simulationFeePayer}`,
    "",
    "## Counts",
    "",
    `- blocked: ${params.counts.blocked}`,
    `- vulnerable: ${params.counts.vulnerable}`,
    `- skipped: ${params.counts.skipped}`,
    `- inconclusive: ${params.counts.inconclusive}`,
    "",
    "## Required Canaries",
    "",
    ...params.required.map((item) => `- ${item.ready ? "ready" : "missing"}: ${item.name} - ${item.detail}`),
    "",
    "## Probe Results",
    "",
    ...params.results.map((result) => [
      `### ${result.name}`,
      "",
      `- status: ${result.status}`,
      `- target: ${result.target}`,
      `- expected: ${result.expected}`,
      `- detail: ${result.detail}`,
      "",
    ].join("\n")),
    missing.length > 0 ? "## Strict Blockers" : "",
    missing.length > 0 ? "" : "",
    ...missing.map((item) => `- ${item.name}: ${item.detail}`),
    "",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
  writeFileSync(markdownPath, markdown);
  return { jsonPath, markdownPath };
}

async function main(): Promise<void> {
  const connection = new Connection(DEVNET_RPC_URL, "confirmed");
  const attacker = Keypair.generate();

  console.log(`RPC: ${redactRpcUrl(DEVNET_RPC_URL)}`);
  console.log(`Attacker: ${attacker.publicKey.toBase58()}`);

  const snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const simulationFeePayer = await chooseSimulationFeePayer(connection, snapshot);
  const required = requiredCanaries(snapshot);
  console.log(`Simulation fee payer: ${simulationFeePayer.toBase58()} (no transaction is sent)`);
  console.log(
    stringifyWithBigints({
      liveSnapshot: {
        domainAssetVaults: snapshot.domainAssetVaults.length,
        protocolFeeVaults: snapshot.protocolFeeVaults.length,
        poolTreasuryVaults: snapshot.poolTreasuryVaults.length,
        poolOracleFeeVaults: snapshot.poolOracleFeeVaults.length,
        claimCases: snapshot.claimCases.length,
        obligations: snapshot.obligations.length,
        lpPositions: snapshot.lpPositions.length,
        allocationPositions: snapshot.allocationPositions.length,
      },
      requiredCanaries: required,
    }),
  );

  const results = [
    ...(await rawSplVaultDrainProbes(connection, attacker, simulationFeePayer, snapshot)),
    ...(await feeVaultWithdrawProbes(connection, attacker, simulationFeePayer, snapshot)),
    ...(await claimObligationSettlementProbes(connection, attacker, simulationFeePayer, snapshot)),
    ...(await redemptionProbes(connection, attacker, simulationFeePayer, snapshot)),
    ...(await allocationObligationSettlementProbes(connection, attacker, simulationFeePayer, snapshot)),
  ];

  const counts = results.reduce<Record<ProbeStatus, number>>(
    (accumulator, result) => {
      accumulator[result.status] += 1;
      return accumulator;
    },
    { blocked: 0, vulnerable: 0, skipped: 0, inconclusive: 0 },
  );

  console.log(stringifyWithBigints({ counts, results }));
  const evidence = writeEvidenceReport({
    attacker: attacker.publicKey,
    counts,
    required,
    results,
    simulationFeePayer,
    snapshot,
  });
  console.log(`Evidence JSON: ${evidence.jsonPath}`);
  console.log(`Evidence Markdown: ${evidence.markdownPath}`);

  if (counts.vulnerable > 0) {
    process.exitCode = 2;
  } else if (
    STRICT_MODE
    && (counts.skipped > 0 || counts.inconclusive > 0 || required.some((item) => !item.ready))
  ) {
    process.exitCode = 3;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
