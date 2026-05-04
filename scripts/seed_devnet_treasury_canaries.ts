// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";

import { loadEnvFile } from "./support/load_env_file.ts";
import { STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX } from "./devnet_governance_smoke_helpers.ts";
import { wrapConnectionWithRpcRetry } from "./support/rpc_retry.ts";
import { keypairFromFile, sha256Bytes } from "./support/script_helpers.ts";

type ProtocolModule = typeof import("../frontend/lib/protocol.ts");
type Snapshot = Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>;
type ProtocolInstructionAccountInput = {
  pubkey?: PublicKey | string | null;
  isSigner?: boolean;
  isWritable?: boolean;
};

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const LOCAL_ROLE_DIR = resolve(homedir(), ".config/solana/omegax-devnet");
const DEFAULT_OPERATOR_KEYPAIR_PATH = resolve(homedir(), ".config/solana/id.json");
const ZERO_PUBKEY = "11111111111111111111111111111111";
const ROLE_MIN_LAMPORTS = BigInt(process.env.OMEGAX_DEVNET_ROLE_MIN_LAMPORTS ?? "75000000");

const CANARY_CLAIM_ID = "pt-usdc-premium-claim-001";
const CANARY_OBLIGATION_ID = "pt-usdc-premium-oblig-001";
const CANARY_ORACLE_FEE_CLAIM_ID = "pt-oracle-fee-lp-002";
const CANARY_ORACLE_FEE_OBLIGATION_ID = "pt-oracle-fee-lp-oblig-002";
const CANARY_ALLOCATION_LINE_ID = "pt-usdc-lp-line-001";
const CANARY_ALLOCATION_OBLIGATION_ID = "pt-lp-alloc-oblig-001";
const CANARY_POOL_ID = "pt-usdc-treasury-pool";
const CANARY_CLASS_ID = "pt-usdc-canary-class";
const CANARY_DEPOSIT_AMOUNT = 10_000n;
const CANARY_REDEMPTION_SHARES = 100n;
const CANARY_CLAIM_AMOUNT = 1_000n;
const CANARY_ORACLE_FEE_CLAIM_AMOUNT = 500n;
const CANARY_ALLOCATION_AMOUNT = 1_000n;
const CANARY_ALLOCATION_OBLIGATION_AMOUNT = 250n;
const CANARY_SCHEMA_KEY_HASH_HEX = STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX;

function loadLocalEnv(): void {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), "frontend/.env.local"));
}

async function importFreshProtocol(): Promise<ProtocolModule> {
  const url = `${pathToFileURL(resolve(process.cwd(), "frontend/lib/protocol.ts")).href}?v=${Date.now()}`;
  const module = (await import(url)) as { default?: ProtocolModule } & ProtocolModule;
  return (module.default ?? module) as ProtocolModule;
}

function configuredOperatorPath(): string {
  return (
    process.env.OMEGAX_DEVNET_CANARY_OPERATOR_KEYPAIR_PATH?.trim()
    || process.env.SOLANA_KEYPAIR?.trim()
    || DEFAULT_OPERATOR_KEYPAIR_PATH
  );
}

function optionalKeypair(path?: string | null): Keypair | null {
  const normalized = path?.trim().replace(/^~(?=\/|$)/, homedir());
  if (!normalized || !existsSync(normalized)) return null;
  return keypairFromFile(normalized);
}

function loadProtocolGovernanceSigner(snapshot: Snapshot, operator: Keypair): Keypair | null {
  const expected = snapshot.protocolGovernance?.governanceAuthority;
  if (!expected) return operator;
  if (operator.publicKey.toBase58() === expected) return operator;

  const configured = optionalKeypair(process.env.OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH);
  if (configured?.publicKey.toBase58() === expected) return configured;

  return null;
}

function loadRoleKeypair(name: string): Keypair | null {
  return optionalKeypair(resolve(LOCAL_ROLE_DIR, `${name}.json`));
}

function loadKeypairForWallet(wallet: PublicKey | string, operator: Keypair): Keypair | null {
  const expected = new PublicKey(wallet).toBase58();
  if (operator.publicKey.toBase58() === expected) return operator;

  const candidates = [
    optionalKeypair(process.env.OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH),
    loadRoleKeypair("member"),
    loadRoleKeypair("second-member"),
    loadRoleKeypair("member-delegate"),
    loadRoleKeypair("lp-provider"),
    loadRoleKeypair("wrapper-provider"),
    loadRoleKeypair("oracle-operator"),
  ];
  return candidates.find((candidate) => candidate?.publicKey.toBase58() === expected) ?? null;
}

function requireKeypairForWallet(wallet: PublicKey | string, operator: Keypair, label: string): Keypair {
  const keypair = loadKeypairForWallet(wallet, operator);
  if (!keypair) {
    throw new Error(`Missing local keypair for ${label}: ${new PublicKey(wallet).toBase58()}`);
  }
  return keypair;
}

function findRequired<T>(rows: T[], predicate: (row: T) => boolean, label: string): T {
  const row = rows.find(predicate);
  if (!row) throw new Error(`Missing required devnet account for ${label}.`);
  return row;
}

function nonZeroAddress(value?: string | null): value is string {
  return Boolean(value && value !== ZERO_PUBKEY);
}

function fundingLineFreeCapacity(line: Snapshot["fundingLines"][number]): bigint {
  return BigInt(String(line.fundedAmount ?? 0))
    - BigInt(String(line.reservedAmount ?? 0))
    - BigInt(String(line.spentAmount ?? 0));
}

function stableHash(label: string): string {
  return Buffer.from(sha256Bytes(label)).toString("hex");
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

async function sendTransaction(params: {
  connection: Connection;
  feePayer: Keypair;
  label: string;
  tx: Transaction;
  signers?: Keypair[];
}): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await params.connection.getLatestBlockhash("confirmed");
  params.tx.feePayer = params.feePayer.publicKey;
  params.tx.recentBlockhash = blockhash;
  params.tx.sign(params.feePayer, ...(params.signers ?? []).filter((signer) => signer.publicKey.toBase58() !== params.feePayer.publicKey.toBase58()));
  const signature = await params.connection.sendRawTransaction(params.tx.serialize(), {
    maxRetries: 5,
    skipPreflight: false,
  });
  const confirmation = await params.connection.confirmTransaction(
    { blockhash, lastValidBlockHeight, signature },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`${params.label} failed during confirmation.`);
  }
  console.log(`[treasury-canary] ${params.label}: ${signature}`);
  return signature;
}

async function sendProtocolInstruction(params: {
  accounts: ProtocolInstructionAccountInput[];
  args: Record<string, unknown>;
  connection: Connection;
  feePayer: Keypair;
  instructionName: string;
  label: string;
  protocol: ProtocolModule;
  signers?: Keypair[];
}): Promise<string> {
  const tx = params.protocol.buildProtocolTransactionFromInstruction({
    feePayer: params.feePayer.publicKey,
    recentBlockhash: ZERO_PUBKEY,
    instructionName: params.instructionName,
    args: params.args,
    accounts: params.accounts,
  });
  return sendTransaction({
    connection: params.connection,
    feePayer: params.feePayer,
    label: params.label,
    tx,
    signers: params.signers,
  });
}

async function sendLamportsIfNeeded(params: {
  connection: Connection;
  payer: Keypair;
  recipient: PublicKey;
  minimumLamports: bigint;
  label: string;
}): Promise<void> {
  const current = BigInt(await params.connection.getBalance(params.recipient, "confirmed"));
  if (current >= params.minimumLamports) return;
  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: params.payer.publicKey,
    toPubkey: params.recipient,
    lamports: Number(params.minimumLamports - current),
  }));
  await sendTransaction({
    connection: params.connection,
    feePayer: params.payer,
    label: `fund:${params.label}`,
    tx,
    signers: [params.payer],
  });
}

async function ensureAtaAndMint(params: {
  amount: bigint;
  connection: Connection;
  mint: PublicKey;
  owner: PublicKey;
  payer: Keypair;
  mintAuthority: Keypair;
  label: string;
}): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(params.mint, params.owner, true, TOKEN_PROGRAM_ID);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      params.payer.publicKey,
      ata,
      params.owner,
      params.mint,
      TOKEN_PROGRAM_ID,
    ),
  );
  if (params.amount > 0n) {
    tx.add(createMintToInstruction(
      params.mint,
      ata,
      params.mintAuthority.publicKey,
      params.amount,
      [],
      TOKEN_PROGRAM_ID,
    ));
  }
  await sendTransaction({
    connection: params.connection,
    feePayer: params.payer,
    label: `mint:${params.label}`,
    tx,
    signers: params.amount > 0n ? [params.payer, params.mintAuthority] : [params.payer],
  });
  return ata;
}

function chooseUsdcCanaryRail(snapshot: Snapshot): {
  vault: Snapshot["domainAssetVaults"][number];
  fundingLine: Snapshot["fundingLines"][number];
  memberPosition: Snapshot["memberPositions"][number];
} {
  const candidates = snapshot.domainAssetVaults
    .filter((row) => nonZeroAddress(row.vaultTokenAccount))
    .flatMap((vault) =>
      snapshot.fundingLines
        .filter((line) =>
          line.reserveDomain === vault.reserveDomain
          && line.assetMint === vault.assetMint
          && Boolean(line.policySeries)
        )
        .map((fundingLine) => ({ vault, fundingLine }))
    )
    .filter((row): row is {
      vault: Snapshot["domainAssetVaults"][number];
      fundingLine: Snapshot["fundingLines"][number];
    } => Boolean(row.fundingLine) && fundingLineFreeCapacity(row.fundingLine) >= CANARY_CLAIM_AMOUNT)
    .sort((left, right) => {
      const score = (line: Snapshot["fundingLines"][number]) => {
        const haystack = `${line.lineId ?? ""} ${line.displayName ?? ""}`.toLowerCase();
        if (fundingLineFreeCapacity(line) <= 0n) return 100;
        if (haystack.includes("premium")) return 0;
        if (haystack.includes("usdc")) return 0;
        if (haystack.includes("pusd")) return 1;
        return 2;
      };
      return score(left.fundingLine) - score(right.fundingLine)
        || Number(fundingLineFreeCapacity(right.fundingLine) - fundingLineFreeCapacity(left.fundingLine));
    });
  const { vault, fundingLine } = candidates[0] ?? {};
  if (!vault || !fundingLine) {
    throw new Error("Missing required devnet account for usable SPL DomainAssetVault.");
  }
  const memberPosition = findRequired(
    snapshot.memberPositions,
    (row) => row.healthPlan === fundingLine.healthPlan
      && row.policySeries === fundingLine.policySeries
      && row.active,
    "active member position for canary claim",
  );
  return { vault, fundingLine, memberPosition };
}

async function seedLinkedClaimCanary(params: {
  connection: Connection;
  operator: Keypair;
  protocol: ProtocolModule;
  snapshot: Snapshot;
}): Promise<void> {
  const { protocol, connection, operator } = params;
  const { fundingLine, memberPosition, vault } = chooseUsdcCanaryRail(params.snapshot);
  const authority = loadProtocolGovernanceSigner(params.snapshot, operator) ?? operator;
  const memberSigner = requireKeypairForWallet(memberPosition.wallet, operator, "linked claim member");
  const claimCase = protocol.deriveClaimCasePda({
    healthPlan: fundingLine.healthPlan,
    claimId: CANARY_CLAIM_ID,
  });
  const obligation = protocol.deriveObligationPda({
    fundingLine: fundingLine.address,
    obligationId: CANARY_OBLIGATION_ID,
  });

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.claimCases.find((row) => row.address === claimCase.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: memberSigner,
      label: `open_claim_case:${CANARY_CLAIM_ID}`,
      tx: protocol.buildOpenClaimCaseTx({
        authority: memberSigner.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        memberPositionAddress: memberPosition.address,
        fundingLineAddress: fundingLine.address,
        claimId: CANARY_CLAIM_ID,
        policySeriesAddress: fundingLine.policySeries,
        claimantAddress: memberPosition.wallet,
        evidenceRefHashHex: stableHash("treasury-canary:linked-claim:evidence"),
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [memberSigner],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.obligations.find((row) => row.address === obligation.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: authority,
      label: `create_obligation:${CANARY_OBLIGATION_ID}`,
      tx: protocol.buildCreateObligationTx({
        authority: authority.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: fundingLine.address,
        assetMint: fundingLine.assetMint,
        obligationId: CANARY_OBLIGATION_ID,
        policySeriesAddress: fundingLine.policySeries,
        memberWalletAddress: memberPosition.wallet,
        beneficiaryAddress: memberPosition.wallet,
        claimCaseAddress: claimCase,
        deliveryMode: protocol.OBLIGATION_DELIVERY_MODE_PAYABLE,
        amount: CANARY_CLAIM_AMOUNT,
        creationReasonHashHex: stableHash("treasury-canary:linked-claim:obligation"),
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [authority],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveClaim = snapshot.claimCases.find((row) => row.address === claimCase.toBase58());
  const liveObligation = snapshot.obligations.find((row) => row.address === obligation.toBase58());
  if (liveClaim && liveClaim.intakeStatus < protocol.CLAIM_INTAKE_APPROVED) {
    await sendTransaction({
      connection,
      feePayer: authority,
      label: `adjudicate_claim_case:${CANARY_CLAIM_ID}`,
      tx: protocol.buildAdjudicateClaimCaseTx({
        authority: authority.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        claimCaseAddress: claimCase,
        reviewState: protocol.CLAIM_INTAKE_APPROVED,
        approvedAmount: CANARY_CLAIM_AMOUNT,
        deniedAmount: 0n,
        reserveAmount: CANARY_CLAIM_AMOUNT,
        decisionSupportHashHex: stableHash("treasury-canary:linked-claim:decision"),
        obligationAddress: obligation,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [authority],
    });
  }

  if (!liveObligation || liveObligation.status === protocol.OBLIGATION_STATUS_PROPOSED) {
    await sendTransaction({
      connection,
      feePayer: authority,
      label: `reserve_obligation:${CANARY_OBLIGATION_ID}`,
      tx: protocol.buildReserveObligationTx({
        authority: authority.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: fundingLine.address,
        assetMint: fundingLine.assetMint,
        obligationAddress: obligation,
        claimCaseAddress: claimCase,
        policySeriesAddress: fundingLine.policySeries,
        amount: CANARY_CLAIM_AMOUNT,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [authority],
    });
  }

  console.log(
    `[treasury-canary] linked-claim ready: obligation=${obligation.toBase58()} mint=${fundingLine.assetMint} vaultToken=${vault.vaultTokenAccount}`,
  );
}

async function ensureOracleCanary(params: {
  connection: Connection;
  governance: Keypair;
  operator: Keypair;
  oracle: Keypair;
  pool: PublicKey;
  protocol: ProtocolModule;
}): Promise<void> {
  const { connection, governance, operator, oracle, pool, protocol } = params;
  const oracleProfile = protocol.deriveOracleProfilePda({ oracle: oracle.publicKey });
  const approval = protocol.derivePoolOracleApprovalPda({ liquidityPool: pool, oracle: oracle.publicKey });
  const permissionSet = protocol.derivePoolOraclePermissionSetPda({ liquidityPool: pool, oracle: oracle.publicKey });
  const policy = protocol.derivePoolOraclePolicyPda({ liquidityPool: pool });
  const outcomeSchema = protocol.deriveOutcomeSchemaPda({ schemaKeyHashHex: CANARY_SCHEMA_KEY_HASH_HEX });

  await sendLamportsIfNeeded({
    connection,
    payer: operator,
    recipient: oracle.publicKey,
    minimumLamports: ROLE_MIN_LAMPORTS,
    label: "oracle-operator",
  });

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.outcomeSchemas.find((row) => row.address === outcomeSchema.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "register_outcome_schema:treasury-canary",
      tx: protocol.buildRegisterOutcomeSchemaTx({
        publisher: governance.publicKey,
        schemaKeyHashHex: CANARY_SCHEMA_KEY_HASH_HEX,
        schemaKey: "omegax.treasury.canary.claim.v1",
        version: 1,
        schemaHashHex: stableHash("treasury-canary:oracle-schema:body"),
        schemaFamily: protocol.SCHEMA_FAMILY_CLAIMS_CODING,
        visibility: protocol.SCHEMA_VISIBILITY_PUBLIC,
        metadataUri: "ipfs://omegax-devnet-treasury-canary",
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.outcomeSchemas.find((row) => row.address === outcomeSchema.toBase58() && row.verified)) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "verify_outcome_schema:treasury-canary",
      tx: protocol.buildVerifyOutcomeSchemaTx({
        governanceAuthority: governance.publicKey,
        schemaKeyHashHex: CANARY_SCHEMA_KEY_HASH_HEX,
        verified: true,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveProfile = snapshot.oracleProfiles.find((row) => row.address === oracleProfile.toBase58());
  if (!liveProfile) {
    await sendTransaction({
      connection,
      feePayer: oracle,
      label: "register_oracle:treasury-canary",
      tx: protocol.buildRegisterOracleTx({
        admin: oracle.publicKey,
        oracle: oracle.publicKey,
        oracleType: protocol.ORACLE_TYPE_HEALTH_APP,
        displayName: "PT Devnet Canary Oracle",
        legalName: "OmegaX Devnet Canary Oracle",
        websiteUrl: "https://omegax.health",
        appUrl: "https://protocol.omegax.health",
        logoUri: "https://omegax.health/favicon.ico",
        webhookUrl: "https://protocol.omegax.health/devnet-canary",
        supportedSchemaKeyHashesHex: [CANARY_SCHEMA_KEY_HASH_HEX],
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [oracle],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const refreshedProfile = snapshot.oracleProfiles.find((row) => row.address === oracleProfile.toBase58());
  if (refreshedProfile && !refreshedProfile.claimed) {
    await sendTransaction({
      connection,
      feePayer: oracle,
      label: "claim_oracle:treasury-canary",
      tx: protocol.buildClaimOracleTx({
        oracle: oracle.publicKey,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [oracle],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.poolOraclePolicies.find((row) => row.address === policy.toBase58() && row.oracleFeeBps === 25)) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "set_pool_oracle_policy:treasury-canary",
      tx: protocol.buildSetPoolOraclePolicyTx({
        authority: governance.publicKey,
        poolAddress: pool,
        quorumM: 1,
        quorumN: 1,
        requireVerifiedSchema: false,
        oracleFeeBps: 25,
        allowDelegateClaim: true,
        challengeWindowSecs: 0,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.poolOracleApprovals.find((row) => row.address === approval.toBase58() && row.active)) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "set_pool_oracle:treasury-canary",
      tx: protocol.buildSetPoolOracleTx({
        authority: governance.publicKey,
        poolAddress: pool,
        oracle: oracle.publicKey,
        active: true,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.poolOraclePermissionSets.find((row) =>
    row.address === permissionSet.toBase58()
    && (row.permissions & protocol.POOL_ORACLE_PERMISSION_ATTEST_CLAIM) !== 0
  )) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "set_pool_oracle_permissions:treasury-canary",
      tx: protocol.buildSetPoolOraclePermissionsTx({
        authority: governance.publicKey,
        poolAddress: pool,
        oracle: oracle.publicKey,
        permissions: protocol.POOL_ORACLE_PERMISSION_ATTEST_CLAIM,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }
}

async function ensurePoolOracleFeeVaultCanary(params: {
  assetMint: PublicKey;
  connection: Connection;
  domainAssetVault: PublicKey;
  governance: Keypair;
  operator: Keypair;
  oracle: Keypair;
  pool: PublicKey;
  protocol: ProtocolModule;
}): Promise<PublicKey> {
  const { assetMint, connection, domainAssetVault, governance, operator, oracle, pool, protocol } = params;
  await ensureOracleCanary({ connection, governance, operator, oracle, pool, protocol });

  const poolOracleFeeVault = protocol.derivePoolOracleFeeVaultPda({
    liquidityPool: pool,
    oracle: oracle.publicKey,
    assetMint,
  });
  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.poolOracleFeeVaults.find((row) => row.address === poolOracleFeeVault.toBase58())) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "init_pool_oracle_fee_vault:treasury-canary",
      instructionName: "init_pool_oracle_fee_vault",
      args: {
        oracle: oracle.publicKey,
        asset_mint: assetMint,
        fee_recipient: oracle.publicKey,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: protocol.deriveProtocolGovernancePda() },
        { pubkey: pool },
        { pubkey: protocol.deriveOracleProfilePda({ oracle: oracle.publicKey }) },
        { pubkey: protocol.derivePoolOracleApprovalPda({ liquidityPool: pool, oracle: oracle.publicKey }) },
        { pubkey: domainAssetVault },
        { pubkey: poolOracleFeeVault, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const live = snapshot.poolOracleFeeVaults.find((row) => row.address === poolOracleFeeVault.toBase58());
  if (!live) throw new Error("Pool oracle fee vault was not initialized.");
  return poolOracleFeeVault;
}

async function seedPoolOracleFeeAccrualCanary(params: {
  assetMint: PublicKey;
  allocationPosition: PublicKey;
  capitalClass: PublicKey;
  connection: Connection;
  fundingLine: Snapshot["fundingLines"][number];
  governance: Keypair;
  memberPosition: Snapshot["memberPositions"][number];
  operator: Keypair;
  oracle: Keypair;
  pool: PublicKey;
  poolOracleFeeVault: PublicKey;
  protocol: ProtocolModule;
  vaultTokenAccount: string;
}): Promise<void> {
  const {
    assetMint,
    allocationPosition,
    capitalClass,
    connection,
    fundingLine,
    governance,
    memberPosition,
    operator,
    oracle,
    pool,
    poolOracleFeeVault,
    protocol,
    vaultTokenAccount,
  } = params;
  const memberSigner = requireKeypairForWallet(memberPosition.wallet, operator, "oracle-fee claim member");
  const claimCase = protocol.deriveClaimCasePda({
    healthPlan: fundingLine.healthPlan,
    claimId: CANARY_ORACLE_FEE_CLAIM_ID,
  });
  const attestation = protocol.deriveClaimAttestationPda({
    claimCase,
    oracle: oracle.publicKey,
  });
  const obligation = protocol.deriveObligationPda({
    fundingLine: fundingLine.address,
    obligationId: CANARY_ORACLE_FEE_OBLIGATION_ID,
  });
  const policy = protocol.derivePoolOraclePolicyPda({ liquidityPool: pool });

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.claimCases.find((row) => row.address === claimCase.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: memberSigner,
      label: `open_claim_case:${CANARY_ORACLE_FEE_CLAIM_ID}`,
      tx: protocol.buildOpenClaimCaseTx({
        authority: memberSigner.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        memberPositionAddress: memberPosition.address,
        fundingLineAddress: fundingLine.address,
        claimId: CANARY_ORACLE_FEE_CLAIM_ID,
        policySeriesAddress: fundingLine.policySeries,
        claimantAddress: memberPosition.wallet,
        evidenceRefHashHex: stableHash("treasury-canary:oracle-fee:evidence"),
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [memberSigner],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.obligations.find((row) => row.address === obligation.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `create_obligation:${CANARY_ORACLE_FEE_OBLIGATION_ID}`,
      tx: protocol.buildCreateObligationTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: fundingLine.address,
        assetMint,
        obligationId: CANARY_ORACLE_FEE_OBLIGATION_ID,
        policySeriesAddress: fundingLine.policySeries,
        memberWalletAddress: memberPosition.wallet,
        beneficiaryAddress: memberPosition.wallet,
        claimCaseAddress: claimCase,
        liquidityPoolAddress: pool,
        capitalClassAddress: capitalClass,
        allocationPositionAddress: allocationPosition,
        poolAssetMint: assetMint,
        deliveryMode: protocol.OBLIGATION_DELIVERY_MODE_PAYABLE,
        amount: CANARY_ORACLE_FEE_CLAIM_AMOUNT,
        creationReasonHashHex: stableHash("treasury-canary:oracle-fee:obligation"),
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.claimAttestations.find((row) => row.address === attestation.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: oracle,
      label: `attest_claim_case:${CANARY_ORACLE_FEE_CLAIM_ID}`,
      tx: protocol.buildAttestClaimCaseTx({
        oracle: oracle.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        claimCaseAddress: claimCase,
        fundingLineAddress: fundingLine.address,
        decision: protocol.CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE,
        attestationHashHex: stableHash("treasury-canary:oracle-fee:attestation"),
        attestationRefHashHex: stableHash("treasury-canary:oracle-fee:evidence"),
        schemaKeyHashHex: CANARY_SCHEMA_KEY_HASH_HEX,
        liquidityPoolAddress: pool,
        capitalClassAddress: capitalClass,
        allocationPositionAddress: allocationPosition,
        poolOracleApprovalAddress: protocol.derivePoolOracleApprovalPda({ liquidityPool: pool, oracle: oracle.publicKey }),
        poolOraclePermissionSetAddress: protocol.derivePoolOraclePermissionSetPda({ liquidityPool: pool, oracle: oracle.publicKey }),
        poolOraclePolicyAddress: policy,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [oracle],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveClaim = snapshot.claimCases.find((row) => row.address === claimCase.toBase58());
  if (liveClaim && liveClaim.intakeStatus < protocol.CLAIM_INTAKE_APPROVED) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `adjudicate_claim_case:${CANARY_ORACLE_FEE_CLAIM_ID}`,
      tx: protocol.buildAdjudicateClaimCaseTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        claimCaseAddress: claimCase,
        reviewState: protocol.CLAIM_INTAKE_APPROVED,
        approvedAmount: CANARY_ORACLE_FEE_CLAIM_AMOUNT,
        deniedAmount: 0n,
        reserveAmount: CANARY_ORACLE_FEE_CLAIM_AMOUNT,
        decisionSupportHashHex: stableHash("treasury-canary:oracle-fee:decision"),
        obligationAddress: obligation,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveObligation = snapshot.obligations.find((row) => row.address === obligation.toBase58());
  if (!liveObligation || liveObligation.status === protocol.OBLIGATION_STATUS_PROPOSED) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `reserve_obligation:${CANARY_ORACLE_FEE_OBLIGATION_ID}`,
      tx: protocol.buildReserveObligationTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: fundingLine.address,
        assetMint,
        obligationAddress: obligation,
        claimCaseAddress: claimCase,
        policySeriesAddress: fundingLine.policySeries,
        capitalClassAddress: capitalClass,
        allocationPositionAddress: allocationPosition,
        poolAssetMint: assetMint,
        amount: CANARY_ORACLE_FEE_CLAIM_AMOUNT,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const refreshedClaim = snapshot.claimCases.find((row) => row.address === claimCase.toBase58());
  const refreshedObligation = snapshot.obligations.find((row) => row.address === obligation.toBase58());
  if (
    refreshedClaim
    && refreshedObligation
    && refreshedClaim.paidAmount < CANARY_ORACLE_FEE_CLAIM_AMOUNT
    && refreshedObligation.status !== protocol.OBLIGATION_STATUS_SETTLED
  ) {
    const recipientAta = await ensureAtaAndMint({
      connection,
      payer: memberSigner,
      mintAuthority: operator,
      owner: new PublicKey(memberPosition.wallet),
      mint: assetMint,
      amount: 0n,
      label: "oracle-fee-claim-recipient",
    });
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `settle_obligation:${CANARY_ORACLE_FEE_OBLIGATION_ID}`,
      tx: protocol.buildSettleObligationTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: fundingLine.address,
        assetMint,
        obligationAddress: obligation,
        nextStatus: protocol.OBLIGATION_STATUS_SETTLED,
        policySeriesAddress: fundingLine.policySeries,
        claimCaseAddress: claimCase,
        capitalClassAddress: capitalClass,
        allocationPositionAddress: allocationPosition,
        poolAssetMint: assetMint,
        poolOracleFeeVaultAddress: poolOracleFeeVault,
        poolOraclePolicyAddress: policy,
        oracleFeeAddress: oracle.publicKey,
        memberPositionAddress: memberPosition.address,
        vaultTokenAccountAddress: vaultTokenAccount,
        recipientTokenAccountAddress: recipientAta,
        tokenProgramId: TOKEN_PROGRAM_ID,
        amount: CANARY_ORACLE_FEE_CLAIM_AMOUNT,
        settlementReasonHashHex: stableHash("treasury-canary:oracle-fee:settlement"),
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }
}

async function seedAllocationObligationCanary(params: {
  assetMint: PublicKey;
  capitalClass: PublicKey;
  connection: Connection;
  fundingLine: Snapshot["fundingLines"][number];
  governance: Keypair;
  memberPosition: Snapshot["memberPositions"][number];
  operator: Keypair;
  pool: PublicKey;
  protocol: ProtocolModule;
}): Promise<void> {
  const { assetMint, capitalClass, connection, fundingLine, governance, memberPosition, operator, pool, protocol } = params;
  const allocationLine = protocol.deriveFundingLinePda({
    healthPlan: fundingLine.healthPlan,
    lineId: CANARY_ALLOCATION_LINE_ID,
  });
  const allocationPosition = protocol.deriveAllocationPositionPda({
    capitalClass,
    fundingLine: allocationLine,
  });
  const obligation = protocol.deriveObligationPda({
    fundingLine: allocationLine,
    obligationId: CANARY_ALLOCATION_OBLIGATION_ID,
  });

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.fundingLines.find((row) => row.address === allocationLine.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `open_funding_line:${CANARY_ALLOCATION_LINE_ID}`,
      tx: protocol.buildOpenFundingLineTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        assetMint,
        lineId: CANARY_ALLOCATION_LINE_ID,
        policySeriesAddress: fundingLine.policySeries,
        lineType: protocol.FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
        fundingPriority: 10,
        committedAmount: CANARY_ALLOCATION_AMOUNT,
        capsHashHex: stableHash("treasury-canary:allocation-line:caps"),
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveLine = snapshot.fundingLines.find((row) => row.address === allocationLine.toBase58());
  if (!liveLine) throw new Error("Allocation canary funding line was not initialized.");
  if (liveLine.assetMint !== assetMint.toBase58()) {
    throw new Error(`Allocation canary funding line asset mismatch: ${liveLine.assetMint}`);
  }

  if (!snapshot.allocationPositions.find((row) => row.address === allocationPosition.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "create_allocation_position:treasury-canary",
      tx: protocol.buildCreateAllocationPositionTx({
        authority: governance.publicKey,
        poolAddress: pool,
        capitalClassAddress: capitalClass,
        healthPlanAddress: fundingLine.healthPlan,
        fundingLineAddress: allocationLine,
        fundingLineAssetMint: assetMint,
        policySeriesAddress: fundingLine.policySeries,
        capAmount: CANARY_ALLOCATION_AMOUNT,
        weightBps: 1_000,
        allocationMode: 0,
        deallocationOnly: false,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveAllocation = snapshot.allocationPositions.find((row) => row.address === allocationPosition.toBase58());
  if (!liveAllocation || liveAllocation.allocatedAmount < CANARY_ALLOCATION_AMOUNT) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "allocate_capital:treasury-canary",
      tx: protocol.buildAllocateCapitalTx({
        authority: governance.publicKey,
        poolAddress: pool,
        capitalClassAddress: capitalClass,
        poolDepositAssetMint: assetMint,
        fundingLineAddress: allocationLine,
        fundingLineAssetMint: assetMint,
        amount: CANARY_ALLOCATION_AMOUNT,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.obligations.find((row) => row.address === obligation.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `create_obligation:${CANARY_ALLOCATION_OBLIGATION_ID}`,
      tx: protocol.buildCreateObligationTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: allocationLine,
        assetMint,
        obligationId: CANARY_ALLOCATION_OBLIGATION_ID,
        policySeriesAddress: fundingLine.policySeries,
        memberWalletAddress: memberPosition.wallet,
        beneficiaryAddress: memberPosition.wallet,
        liquidityPoolAddress: pool,
        capitalClassAddress: capitalClass,
        allocationPositionAddress: allocationPosition,
        poolAssetMint: assetMint,
        deliveryMode: protocol.OBLIGATION_DELIVERY_MODE_PAYABLE,
        amount: CANARY_ALLOCATION_OBLIGATION_AMOUNT,
        creationReasonHashHex: stableHash("treasury-canary:allocation-obligation"),
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveObligation = snapshot.obligations.find((row) => row.address === obligation.toBase58());
  if (!liveObligation || liveObligation.status === protocol.OBLIGATION_STATUS_PROPOSED) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `reserve_obligation:${CANARY_ALLOCATION_OBLIGATION_ID}`,
      tx: protocol.buildReserveObligationTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: allocationLine,
        assetMint,
        obligationAddress: obligation,
        policySeriesAddress: fundingLine.policySeries,
        capitalClassAddress: capitalClass,
        allocationPositionAddress: allocationPosition,
        poolAssetMint: assetMint,
        amount: CANARY_ALLOCATION_OBLIGATION_AMOUNT,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }
}

async function ensureFeeVaultsAndLpCanaries(params: {
  connection: Connection;
  governance: Keypair;
  operator: Keypair;
  protocol: ProtocolModule;
  snapshot: Snapshot;
}): Promise<void> {
  const { connection, governance, operator, protocol } = params;
  const { fundingLine, memberPosition, vault } = chooseUsdcCanaryRail(params.snapshot);
  const assetMint = new PublicKey(fundingLine.assetMint);
  const reserveDomain = new PublicKey(fundingLine.reserveDomain);
  const domainAssetVault = protocol.deriveDomainAssetVaultPda({ reserveDomain, assetMint });
  const protocolFeeVault = protocol.deriveProtocolFeeVaultPda({ reserveDomain, assetMint });
  const pool = protocol.deriveLiquidityPoolPda({ reserveDomain, poolId: CANARY_POOL_ID });
  const capitalClass = protocol.deriveCapitalClassPda({ liquidityPool: pool, classId: CANARY_CLASS_ID });
  const poolTreasuryVault = protocol.derivePoolTreasuryVaultPda({ liquidityPool: pool, assetMint });
  const lpProvider = loadRoleKeypair("lp-provider") ?? operator;
  const oracle = loadRoleKeypair("oracle-operator") ?? operator;

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.protocolFeeVaults.find((row) => row.address === protocolFeeVault.toBase58())) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "init_protocol_fee_vault:treasury-canary",
      instructionName: "init_protocol_fee_vault",
      args: { asset_mint: assetMint, fee_recipient: governance.publicKey },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: protocol.deriveProtocolGovernancePda() },
        { pubkey: reserveDomain },
        { pubkey: domainAssetVault },
        { pubkey: protocolFeeVault, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.liquidityPools.find((row) => row.address === pool.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `create_liquidity_pool:${CANARY_POOL_ID}`,
      tx: protocol.buildCreateLiquidityPoolTx({
        authority: governance.publicKey,
        reserveDomainAddress: reserveDomain,
        poolId: CANARY_POOL_ID,
        displayName: "PT USDC Treasury Canary",
        curator: governance.publicKey,
        allocator: governance.publicKey,
        sentinel: governance.publicKey,
        depositAssetMint: assetMint,
        strategyHashHex: stableHash("treasury-canary:pool:strategy"),
        allowedExposureHashHex: stableHash("treasury-canary:pool:exposure"),
        externalYieldAdapterHashHex: stableHash("treasury-canary:no-yield-adapter"),
        feeBps: 0,
        redemptionPolicy: protocol.REDEMPTION_POLICY_QUEUE_ONLY,
        pauseFlags: 0,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.capitalClasses.find((row) => row.address === capitalClass.toBase58())) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: `create_capital_class:${CANARY_CLASS_ID}`,
      tx: protocol.buildCreateCapitalClassTx({
        authority: governance.publicKey,
        poolAddress: pool,
        poolDepositAssetMint: assetMint,
        classId: CANARY_CLASS_ID,
        displayName: "PT USDC Canary Class",
        shareMint: null,
        priority: 1,
        impairmentRank: 1,
        restrictionMode: protocol.CAPITAL_CLASS_RESTRICTION_OPEN,
        redemptionTermsMode: 1,
        wrapperMetadataHashHex: stableHash("treasury-canary:class:wrapper"),
        permissioningHashHex: stableHash("treasury-canary:class:permissioning"),
        feeBps: 100,
        minLockupSeconds: 0n,
        pauseFlags: 0,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!snapshot.poolTreasuryVaults.find((row) => row.address === poolTreasuryVault.toBase58())) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "init_pool_treasury_vault:treasury-canary",
      instructionName: "init_pool_treasury_vault",
      args: { asset_mint: assetMint, fee_recipient: operator.publicKey },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: protocol.deriveProtocolGovernancePda() },
        { pubkey: pool },
        { pubkey: domainAssetVault },
        { pubkey: poolTreasuryVault, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
      signers: [governance],
    });
  }

  await sendLamportsIfNeeded({
    connection,
    payer: operator,
    recipient: lpProvider.publicKey,
    minimumLamports: ROLE_MIN_LAMPORTS,
    label: "lp-provider",
  });
  const mintInfo = await getMint(connection, assetMint, "confirmed", TOKEN_PROGRAM_ID);
  if (!mintInfo.mintAuthority?.equals(operator.publicKey)) {
    throw new Error(`Cannot mint canary LP source tokens; mint authority is ${mintInfo.mintAuthority?.toBase58() ?? "disabled"}.`);
  }
  const lpSourceAta = await ensureAtaAndMint({
    connection,
    payer: operator,
    mintAuthority: operator,
    owner: lpProvider.publicKey,
    mint: assetMint,
    amount: CANARY_DEPOSIT_AMOUNT,
    label: "lp-provider-usdc",
  });

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const lpPosition = protocol.deriveLpPositionPda({ capitalClass, owner: lpProvider.publicKey });
  const liveLp = snapshot.lpPositions.find((row) => row.address === lpPosition.toBase58());
  const livePoolTreasuryVault = snapshot.poolTreasuryVaults.find((row) => row.address === poolTreasuryVault.toBase58());
  if (
    !liveLp
    || BigInt(String(liveLp.subscriptionBasis ?? 0)) === 0n
    || !livePoolTreasuryVault
    || BigInt(String(livePoolTreasuryVault.accruedFees ?? 0)) === 0n
  ) {
    await sendTransaction({
      connection,
      feePayer: lpProvider,
      label: "deposit_into_capital_class:treasury-canary",
      tx: protocol.buildDepositIntoCapitalClassTx({
        owner: lpProvider.publicKey,
        reserveDomainAddress: reserveDomain,
        poolAddress: pool,
        poolDepositAssetMint: assetMint,
        capitalClassAddress: capitalClass,
        sourceTokenAccountAddress: lpSourceAta,
        vaultTokenAccountAddress: vault.vaultTokenAccount,
        tokenProgramId: TOKEN_PROGRAM_ID,
        amount: CANARY_DEPOSIT_AMOUNT,
        shares: 0n,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [lpProvider],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const refreshedLp = snapshot.lpPositions.find((row) => row.address === lpPosition.toBase58());
  if (!refreshedLp || BigInt(String(refreshedLp.pendingRedemptionShares ?? 0)) === 0n) {
    await sendTransaction({
      connection,
      feePayer: lpProvider,
      label: "request_redemption:treasury-canary",
      tx: protocol.buildRequestRedemptionTx({
        owner: lpProvider.publicKey,
        reserveDomainAddress: reserveDomain,
        poolAddress: pool,
        poolDepositAssetMint: assetMint,
        capitalClassAddress: capitalClass,
        shares: CANARY_REDEMPTION_SHARES,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [lpProvider],
    });
  }

  const premiumSourceAta = await ensureAtaAndMint({
    connection,
    payer: operator,
    mintAuthority: operator,
    owner: governance.publicKey,
    mint: assetMint,
    amount: CANARY_DEPOSIT_AMOUNT,
    label: "governance-premium-usdc",
  });
  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const feeVault = snapshot.protocolFeeVaults.find((row) => row.address === protocolFeeVault.toBase58());
  if (!feeVault || BigInt(String(feeVault.accruedFees ?? 0)) === 0n) {
    await sendTransaction({
      connection,
      feePayer: governance,
      label: "record_premium_payment:treasury-canary",
      tx: protocol.buildRecordPremiumPaymentTx({
        authority: governance.publicKey,
        healthPlanAddress: fundingLine.healthPlan,
        reserveDomainAddress: fundingLine.reserveDomain,
        fundingLineAddress: fundingLine.address,
        assetMint,
        policySeriesAddress: fundingLine.policySeries,
        sourceTokenAccountAddress: premiumSourceAta,
        vaultTokenAccountAddress: vault.vaultTokenAccount,
        tokenProgramId: TOKEN_PROGRAM_ID,
        amount: CANARY_DEPOSIT_AMOUNT,
        recentBlockhash: ZERO_PUBKEY,
      }),
      signers: [governance],
    });
  }

  const poolOracleFeeVault = await ensurePoolOracleFeeVaultCanary({
    assetMint,
    connection,
    domainAssetVault,
    governance,
    operator,
    oracle,
    pool,
    protocol,
  });
  await seedAllocationObligationCanary({
    assetMint,
    capitalClass,
    connection,
    fundingLine,
    governance,
    memberPosition,
    operator,
    pool,
    protocol,
  });
  const allocationLine = protocol.deriveFundingLinePda({
    healthPlan: fundingLine.healthPlan,
    lineId: CANARY_ALLOCATION_LINE_ID,
  });
  const allocationPosition = protocol.deriveAllocationPositionPda({
    capitalClass,
    fundingLine: allocationLine,
  });
  const afterAllocation = await protocol.loadProtocolConsoleSnapshot(connection);
  const oracleFeeFundingLine = findRequired(
    afterAllocation.fundingLines,
    (row) => row.address === allocationLine.toBase58(),
    "oracle-fee allocation funding line",
  );
  await seedPoolOracleFeeAccrualCanary({
    assetMint,
    allocationPosition,
    capitalClass,
    connection,
    fundingLine: oracleFeeFundingLine,
    governance,
    memberPosition,
    operator,
    oracle,
    pool,
    poolOracleFeeVault,
    protocol,
    vaultTokenAccount: vault.vaultTokenAccount,
  });
}

async function main(): Promise<void> {
  loadLocalEnv();
  const protocol = await importFreshProtocol();
  const rpcUrl =
    process.env.SOLANA_RPC_URL?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim()
    || process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL?.trim()
    || DEFAULT_RPC_URL;
  const connection = wrapConnectionWithRpcRetry(new Connection(rpcUrl, "confirmed"), {
    labelPrefix: "treasury-canary",
    logPrefix: "treasury-canary",
  });
  const operator = keypairFromFile(configuredOperatorPath());

  console.log(`[treasury-canary] rpc=${redactRpcUrl(rpcUrl)}`);
  console.log(`[treasury-canary] operator=${operator.publicKey.toBase58()}`);

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  await seedLinkedClaimCanary({ connection, operator, protocol, snapshot });

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const governance = loadProtocolGovernanceSigner(snapshot, operator);
  if (!governance) {
    console.log(
      `[treasury-canary] skipped governance-gated canaries: local signer ${operator.publicKey.toBase58()} does not match protocol governance ${snapshot.protocolGovernance?.governanceAuthority ?? "unset"}. Set OMEGAX_DEVNET_PROTOCOL_GOVERNANCE_KEYPAIR_PATH to seed fee-vault and LP-redemption canaries.`,
    );
  } else {
    await ensureFeeVaultsAndLpCanaries({ connection, governance, operator, protocol, snapshot });
  }

  const after = await protocol.loadProtocolConsoleSnapshot(connection);
  const counts = {
    protocolFeeVaults: after.protocolFeeVaults.length,
    poolTreasuryVaults: after.poolTreasuryVaults.length,
    poolOracleFeeVaults: after.poolOracleFeeVaults.length,
    claimCases: after.claimCases.length,
    obligations: after.obligations.length,
    lpPositions: after.lpPositions.length,
  };
  console.log(`[treasury-canary] snapshot=${JSON.stringify(counts)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
