// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX } from "./devnet_governance_smoke_helpers.ts";
import { loadEnvFile } from "./support/load_env_file.ts";
import { wrapConnectionWithRpcRetry } from "./support/rpc_retry.ts";

type ProtocolModule = typeof import("../frontend/lib/protocol.ts");
type FixturesModule = typeof import("../frontend/lib/devnet-fixtures.ts");

type ProtocolInstructionAccountInput = {
  pubkey?: PublicKey | string | null;
  isSigner?: boolean;
  isWritable?: boolean;
};

type RoleWallets = {
  governance: Keypair;
  oracle: Keypair;
  member: Keypair;
  memberDelegate: Keypair;
  secondMember: Keypair;
  lpProvider: Keypair;
  wrapperProvider: Keypair;
};

const FRONTEND_ENV_PATH = resolve(process.cwd(), "frontend/.env.local");
const GOVERNANCE_KEYPAIR_PATH = resolve(homedir(), ".config/solana/id.json");
const LOCAL_ROLE_DIR = resolve(homedir(), ".config/solana/omegax-devnet");
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const ROLE_MIN_LAMPORTS = 75_000_000n;

const MEMBERSHIP_MODE_OPEN = 0;
const MEMBERSHIP_MODE_INVITE_ONLY = 2;
const MEMBERSHIP_GATE_KIND_OPEN = 0;
const MEMBERSHIP_GATE_KIND_INVITE_ONLY = 1;
const MEMBERSHIP_PROOF_MODE_OPEN = 0;
const MEMBERSHIP_PROOF_MODE_INVITE_PERMIT = 2;

const RIGHT_CLAIM_REWARD = 1 << 0;
const RIGHT_VIEW_PAYOUT_HISTORY = 1 << 1;
const RIGHT_OPEN_CLAIM_CASE = 1 << 2;
const RIGHT_APPOINT_DELEGATE = 1 << 3;
const STANDARD_SCHEMA_KEY_HASH_BYTES = [...Buffer.from(STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX, "hex")];

function sha256Bytes(label: string): number[] {
  return [...createHash("sha256").update(label).digest()];
}

function keypairFromFile(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function ensureRoleKeypair(name: string): Keypair {
  const path = resolve(LOCAL_ROLE_DIR, `${name}.json`);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    return keypairFromFile(path);
  }
  const keypair = Keypair.generate();
  writeFileSync(path, `${JSON.stringify([...keypair.secretKey])}\n`);
  return keypair;
}

function configuredGovernanceControlAddress(): string | null {
  const raw = process.env.GOVERNANCE_CONFIG
    || process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG
    || "";
  const normalized = raw.trim();
  if (!normalized) return null;
  try {
    return new PublicKey(normalized).toBase58();
  } catch {
    throw new Error(`Invalid governance config address: ${normalized}`);
  }
}

function upsertEnvFile(path: string, updates: Record<string, string>): void {
  const existing = new Map<string, string>();
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const separator = trimmed.indexOf("=");
      existing.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    existing.set(key, value);
    process.env[key] = value;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${[...existing.entries()].map(([key, value]) => `${key}=${value}`).join("\n")}\n`,
  );
}

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, {
    cwd: resolve(process.cwd()),
    encoding: "utf8",
    env: process.env,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed:\n${output}`);
  }
  process.stdout.write(output);
}

async function importFresh<T>(path: string): Promise<T> {
  const url = `${pathToFileURL(resolve(process.cwd(), path)).href}?v=${Date.now()}`;
  return import(url) as Promise<T>;
}

function findRequired<T>(rows: T[], predicate: (row: T) => boolean, label: string): T {
  const row = rows.find(predicate);
  if (!row) {
    throw new Error(`Missing required fixture row: ${label}`);
  }
  return row;
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
  const { blockhash, lastValidBlockHeight } = await params.connection.getLatestBlockhash("confirmed");
  const transaction = params.protocol.buildProtocolTransactionFromInstruction({
    feePayer: params.feePayer.publicKey,
    recentBlockhash: blockhash,
    instructionName: params.instructionName,
    args: params.args,
    accounts: params.accounts,
  });
  transaction.sign(params.feePayer, ...(params.signers ?? []));
  const signature = await params.connection.sendRawTransaction(transaction.serialize(), {
    maxRetries: 5,
    skipPreflight: false,
  });
  const confirmation = await params.connection.confirmTransaction(
    {
      blockhash,
      lastValidBlockHeight,
      signature,
    },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`${params.label} failed during confirmation.`);
  }
  console.log(`[live-bootstrap] ${params.label}: ${signature}`);
  return signature;
}

async function sendLamportsIfNeeded(params: {
  connection: Connection;
  governance: Keypair;
  minimumLamports: bigint;
  recipient: PublicKey;
  label: string;
}): Promise<void> {
  const current = BigInt(await params.connection.getBalance(params.recipient, "confirmed"));
  if (current >= params.minimumLamports) {
    return;
  }
  const delta = params.minimumLamports - current;
  const { blockhash, lastValidBlockHeight } = await params.connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({
    feePayer: params.governance.publicKey,
    recentBlockhash: blockhash,
  }).add(SystemProgram.transfer({
    fromPubkey: params.governance.publicKey,
    toPubkey: params.recipient,
    lamports: Number(delta),
  }));
  transaction.sign(params.governance);
  const signature = await params.connection.sendRawTransaction(transaction.serialize(), {
    maxRetries: 5,
    skipPreflight: false,
  });
  const confirmation = await params.connection.confirmTransaction(
    { blockhash, lastValidBlockHeight, signature },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`Failed to seed lamports for ${params.label}.`);
  }
  console.log(`[live-bootstrap] funded ${params.label}: ${signature}`);
}

function currentValue(
  snapshot: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>,
  address: string,
) {
  return {
    fundingLine: snapshot.fundingLines.find((row) => row.address === address),
    claimCase: snapshot.claimCases.find((row) => row.address === address),
    obligation: snapshot.obligations.find((row) => row.address === address),
    lpPosition: snapshot.lpPositions.find((row) => row.address === address),
    allocationPosition: snapshot.allocationPositions.find((row) => row.address === address),
    protocolGovernance: snapshot.protocolGovernance?.address === address ? snapshot.protocolGovernance : null,
    memberPosition: snapshot.memberPositions.find((row) => row.address === address),
    oracleProfile: snapshot.oracleProfiles.find((row) => row.address === address),
    poolOraclePolicy: snapshot.poolOraclePolicies.find((row) => row.address === address),
    poolOracleApproval: snapshot.poolOracleApprovals.find((row) => row.address === address),
    poolOraclePermissionSet: snapshot.poolOraclePermissionSets.find((row) => row.address === address),
    schema: snapshot.outcomeSchemas.find((row) => row.address === address),
  };
}

async function main() {
  const governance = keypairFromFile(GOVERNANCE_KEYPAIR_PATH);
  const roleWallets: RoleWallets = {
    governance,
    oracle: ensureRoleKeypair("oracle-operator"),
    member: ensureRoleKeypair("member"),
    memberDelegate: ensureRoleKeypair("member-delegate"),
    secondMember: ensureRoleKeypair("second-member"),
    lpProvider: ensureRoleKeypair("lp-provider"),
    wrapperProvider: ensureRoleKeypair("wrapper-provider"),
  };

  upsertEnvFile(FRONTEND_ENV_PATH, {
    NEXT_PUBLIC_DEVNET_PROTOCOL_GOVERNANCE_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_DOMAIN_ADMIN_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_PLAN_ADMIN_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_SPONSOR_OPERATOR_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_CLAIMS_OPERATOR_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_POOL_CURATOR_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_POOL_ALLOCATOR_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_POOL_SENTINEL_WALLET: governance.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_ORACLE_OPERATOR_WALLET: roleWallets.oracle.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_MEMBER_WALLET: roleWallets.member.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_MEMBER_DELEGATE_WALLET: roleWallets.memberDelegate.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_SECOND_MEMBER_WALLET: roleWallets.secondMember.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_LP_PROVIDER_WALLET: roleWallets.lpProvider.publicKey.toBase58(),
    NEXT_PUBLIC_DEVNET_WRAPPER_PROVIDER_WALLET: roleWallets.wrapperProvider.publicKey.toBase58(),
  });
  loadEnvFile(FRONTEND_ENV_PATH);

  const protocol = await importFresh<ProtocolModule>("frontend/lib/protocol.ts");
  const fixtures = await importFresh<FixturesModule>("frontend/lib/devnet-fixtures.ts");

  const rpcUrl = process.env.SOLANA_RPC_URL
    || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    || process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL
    || DEFAULT_RPC_URL;
  const connection = wrapConnectionWithRpcRetry(new Connection(rpcUrl, "confirmed"), {
    labelPrefix: "live-bootstrap",
    logPrefix: "live-bootstrap",
  });

  for (const [label, wallet] of Object.entries({
    oracle: roleWallets.oracle,
    member: roleWallets.member,
    member_delegate: roleWallets.memberDelegate,
    second_member: roleWallets.secondMember,
    lp_provider: roleWallets.lpProvider,
    wrapper_provider: roleWallets.wrapperProvider,
  })) {
    await sendLamportsIfNeeded({
      connection,
      governance,
      minimumLamports: ROLE_MIN_LAMPORTS,
      recipient: wallet.publicKey,
      label,
    });
  }

  const fixtureState = fixtures.DEVNET_PROTOCOL_FIXTURE_STATE;
  const openReserveDomain = findRequired(
    fixtureState.reserveDomains,
    (row) => row.domainId === "open-health-usdc",
    "open reserve domain",
  );
  const wrapperReserveDomain = findRequired(
    fixtureState.reserveDomains,
    (row) => row.domainId === "wrapper-health-rwa",
    "wrapper reserve domain",
  );
  const seekerPlan = findRequired(
    fixtureState.healthPlans,
    (row) => row.planId === "nexus-seeker-rewards",
    "seeker plan",
  );
  const blendedPlan = findRequired(
    fixtureState.healthPlans,
    (row) => row.planId === "nexus-protect-plus",
    "blended plan",
  );
  const seekerRewardSeries = findRequired(
    fixtureState.policySeries,
    (row) => row.seriesId === "daily-activity-rewards",
    "seeker reward series",
  );
  const blendedRewardSeries = findRequired(
    fixtureState.policySeries,
    (row) => row.seriesId === "preventive-adherence-rewards",
    "blended reward series",
  );
  const blendedProtectionSeries = findRequired(
    fixtureState.policySeries,
    (row) => row.seriesId === "catastrophic-protection-2026",
    "blended protection series",
  );
  const seekerSponsorLine = findRequired(
    fixtureState.fundingLines,
    (row) => row.lineId === "seeker-sponsor-budget",
    "seeker sponsor line",
  );
  const blendedSponsorLine = findRequired(
    fixtureState.fundingLines,
    (row) => row.lineId === "blended-sponsor-budget",
    "blended sponsor line",
  );
  const blendedPremiumLine = findRequired(
    fixtureState.fundingLines,
    (row) => row.lineId === "blended-member-premiums",
    "blended premium line",
  );
  const blendedProtectionLiquidityLine = findRequired(
    fixtureState.fundingLines,
    (row) => row.lineId === "blended-protection-liquidity",
    "blended protection liquidity line",
  );
  const blendedRewardLiquidityLine = findRequired(
    fixtureState.fundingLines,
    (row) => row.lineId === "blended-reward-liquidity",
    "blended reward liquidity line",
  );
  const pool = findRequired(
    fixtureState.liquidityPools,
    (row) => row.poolId === "omega-health-income",
    "omega health income pool",
  );
  const openClass = findRequired(
    fixtureState.capitalClasses,
    (row) => row.classId === "open-usdc-class",
    "open capital class",
  );
  const wrapperClass = findRequired(
    fixtureState.capitalClasses,
    (row) => row.classId === "wrapper-usdc-class",
    "wrapper capital class",
  );

  const openRewardDomainVault = protocol.deriveDomainAssetVaultPda({
    reserveDomain: openReserveDomain.address,
    assetMint: fixtureState.rewardMint,
  }).toBase58();
  const openRewardDomainLedger = protocol.deriveDomainAssetLedgerPda({
    reserveDomain: openReserveDomain.address,
    assetMint: fixtureState.rewardMint,
  }).toBase58();
  const openClassLedger = protocol.derivePoolClassLedgerPda({
    capitalClass: openClass.address,
    assetMint: fixtureState.settlementMint,
  }).toBase58();
  const wrapperClassLedger = protocol.derivePoolClassLedgerPda({
    capitalClass: wrapperClass.address,
    assetMint: fixtureState.settlementMint,
  }).toBase58();
  const rewardAllocation = protocol.deriveAllocationPositionPda({
    capitalClass: openClass.address,
    fundingLine: blendedRewardLiquidityLine.address,
  }).toBase58();
  const protectionOpenAllocation = protocol.deriveAllocationPositionPda({
    capitalClass: openClass.address,
    fundingLine: blendedProtectionLiquidityLine.address,
  }).toBase58();
  const protectionWrapperAllocation = protocol.deriveAllocationPositionPda({
    capitalClass: wrapperClass.address,
    fundingLine: blendedProtectionLiquidityLine.address,
  }).toBase58();
  const rewardAllocationLedger = protocol.deriveAllocationLedgerPda({
    allocationPosition: rewardAllocation,
    assetMint: fixtureState.rewardMint,
  }).toBase58();
  const protectionOpenAllocationLedger = protocol.deriveAllocationLedgerPda({
    allocationPosition: protectionOpenAllocation,
    assetMint: fixtureState.settlementMint,
  }).toBase58();
  const protectionWrapperAllocationLedger = protocol.deriveAllocationLedgerPda({
    allocationPosition: protectionWrapperAllocation,
    assetMint: fixtureState.settlementMint,
  }).toBase58();
  const seekerMemberPosition = protocol.deriveMemberPositionPda({
    healthPlan: seekerPlan.address,
    wallet: roleWallets.member.publicKey,
    seriesScope: seekerRewardSeries.address,
  }).toBase58();
  const blendedRewardMemberPosition = protocol.deriveMemberPositionPda({
    healthPlan: blendedPlan.address,
    wallet: roleWallets.member.publicKey,
    seriesScope: blendedRewardSeries.address,
  }).toBase58();
  const blendedProtectionMemberPosition = protocol.deriveMemberPositionPda({
    healthPlan: blendedPlan.address,
    wallet: roleWallets.secondMember.publicKey,
    seriesScope: blendedProtectionSeries.address,
  }).toBase58();
  const seekerSettledObligation = protocol.deriveObligationPda({
    fundingLine: seekerSponsorLine.address,
    obligationId: "reward-obligation-001",
  }).toBase58();
  const seekerClaimableObligation = protocol.deriveObligationPda({
    fundingLine: seekerSponsorLine.address,
    obligationId: "reward-obligation-002",
  }).toBase58();
  const protectionReservedClaim = protocol.deriveClaimCasePda({
    healthPlan: blendedPlan.address,
    claimId: "claim-protect-001",
  }).toBase58();
  const protectionSettledClaim = protocol.deriveClaimCasePda({
    healthPlan: blendedPlan.address,
    claimId: "claim-protect-002",
  }).toBase58();
  const protectionReservedObligation = protocol.deriveObligationPda({
    fundingLine: blendedPremiumLine.address,
    obligationId: "protection-obligation-001",
  }).toBase58();
  const protectionSettledObligation = protocol.deriveObligationPda({
    fundingLine: blendedPremiumLine.address,
    obligationId: "protection-obligation-002",
  }).toBase58();
  const standardSchemaAddress = protocol.deriveOutcomeSchemaPda({
    schemaKeyHashHex: STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX,
  }).toBase58();
  const standardSchemaDependencyLedger = protocol.deriveSchemaDependencyLedgerPda({
    schemaKeyHashHex: STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX,
  }).toBase58();
  const oracleProfileAddress = protocol.deriveOracleProfilePda({
    oracle: roleWallets.oracle.publicKey,
  }).toBase58();
  const poolOraclePolicyAddress = protocol.derivePoolOraclePolicyPda({
    liquidityPool: pool.address,
  }).toBase58();
  const poolOracleApprovalAddress = protocol.derivePoolOracleApprovalPda({
    liquidityPool: pool.address,
    oracle: roleWallets.oracle.publicKey,
  }).toBase58();
  const poolOraclePermissionSetAddress = protocol.derivePoolOraclePermissionSetPda({
    liquidityPool: pool.address,
    oracle: roleWallets.oracle.publicKey,
  }).toBase58();

  const governanceAddress = protocol.deriveProtocolGovernancePda().toBase58();
  if (!await protocol.accountExists(connection, governanceAddress)) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "initialize_protocol_governance",
      instructionName: "initialize_protocol_governance",
      args: {
        protocol_fee_bps: 50,
        emergency_pause: false,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const reserveDomainSpecs = [
    openReserveDomain,
    wrapperReserveDomain,
  ];
  for (const domain of reserveDomainSpecs) {
    if (await protocol.accountExists(connection, domain.address)) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_reserve_domain:${domain.domainId}`,
      instructionName: "create_reserve_domain",
      args: {
        domain_id: domain.domainId,
        display_name: domain.displayName,
        domain_admin: governance.publicKey,
        settlement_mode: domain.settlementMode,
        legal_structure_hash: sha256Bytes(`reserve-domain:${domain.domainId}:legal`),
        compliance_baseline_hash: sha256Bytes(`reserve-domain:${domain.domainId}:compliance`),
        allowed_rail_mask: 0xffff,
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: domain.address, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const assetVaultSpecs = [
    {
      label: "open:settlement",
      reserveDomain: openReserveDomain.address,
      assetMint: fixtureState.settlementMint,
      vault: fixtureState.domainAssetVaults[0]!.address,
      ledger: fixtureState.domainAssetLedgers[0]!.address,
    },
    {
      label: "open:reward",
      reserveDomain: openReserveDomain.address,
      assetMint: fixtureState.rewardMint,
      vault: openRewardDomainVault,
      ledger: openRewardDomainLedger,
    },
    {
      label: "wrapper:settlement",
      reserveDomain: wrapperReserveDomain.address,
      assetMint: fixtureState.wrapperSettlementMint,
      vault: fixtureState.domainAssetVaults[1]!.address,
      ledger: fixtureState.domainAssetLedgers[1]!.address,
    },
  ];
  for (const assetVault of assetVaultSpecs) {
    const vaultExists = await protocol.accountExists(connection, assetVault.vault);
    const ledgerExists = await protocol.accountExists(connection, assetVault.ledger);
    if (vaultExists && ledgerExists) continue;
    if (vaultExists !== ledgerExists) {
      throw new Error(`Partial domain asset bootstrap exists for ${assetVault.label}.`);
    }
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_domain_asset_vault:${assetVault.label}`,
      instructionName: "create_domain_asset_vault",
      args: {
        asset_mint: new PublicKey(assetVault.assetMint),
        vault_token_account: protocol.ZERO_PUBKEY_KEY,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: assetVault.reserveDomain, isWritable: true },
        { pubkey: assetVault.vault, isWritable: true },
        { pubkey: assetVault.ledger, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const planSpecs = [
    {
      fixture: seekerPlan,
      sponsor: governance.publicKey,
      sponsorOperator: governance.publicKey,
      claimsOperator: governance.publicKey,
      oracleAuthority: roleWallets.oracle.publicKey,
      membershipMode: MEMBERSHIP_MODE_INVITE_ONLY,
      membershipGateKind: MEMBERSHIP_GATE_KIND_INVITE_ONLY,
      membershipInviteAuthority: governance.publicKey,
    },
    {
      fixture: blendedPlan,
      sponsor: governance.publicKey,
      sponsorOperator: governance.publicKey,
      claimsOperator: governance.publicKey,
      oracleAuthority: roleWallets.oracle.publicKey,
      membershipMode: MEMBERSHIP_MODE_OPEN,
      membershipGateKind: MEMBERSHIP_GATE_KIND_OPEN,
      membershipInviteAuthority: protocol.ZERO_PUBKEY_KEY,
    },
  ];
  for (const planSpec of planSpecs) {
    if (await protocol.accountExists(connection, planSpec.fixture.address)) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_health_plan:${planSpec.fixture.planId}`,
      instructionName: "create_health_plan",
      args: {
        plan_id: planSpec.fixture.planId,
        display_name: planSpec.fixture.displayName,
        organization_ref: planSpec.fixture.sponsorLabel,
        metadata_uri: `https://protocol.omegax.health/plans/${planSpec.fixture.planId}`,
        sponsor: planSpec.sponsor,
        sponsor_operator: planSpec.sponsorOperator,
        claims_operator: planSpec.claimsOperator,
        oracle_authority: planSpec.oracleAuthority,
        membership_mode: planSpec.membershipMode,
        membership_gate_kind: planSpec.membershipGateKind,
        membership_gate_mint: protocol.ZERO_PUBKEY_KEY,
        membership_gate_min_amount: 0n,
        membership_invite_authority: planSpec.membershipInviteAuthority,
        allowed_rail_mask: 0xffff,
        default_funding_priority: 0,
        oracle_policy_hash: sha256Bytes(`plan:${planSpec.fixture.planId}:oracle-policy`),
        schema_binding_hash: sha256Bytes(`plan:${planSpec.fixture.planId}:schema-binding`),
        compliance_baseline_hash: sha256Bytes(`plan:${planSpec.fixture.planId}:compliance`),
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: planSpec.fixture.reserveDomain },
        { pubkey: planSpec.fixture.address, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const seriesSpecs = [
    seekerRewardSeries,
    blendedRewardSeries,
    blendedProtectionSeries,
  ];
  for (const series of seriesSpecs) {
    if (await protocol.accountExists(connection, series.address)) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_policy_series:${series.seriesId}`,
      instructionName: "create_policy_series",
      args: {
        series_id: series.seriesId,
        display_name: series.displayName,
        metadata_uri: series.metadataUri ?? "",
        asset_mint: new PublicKey(series.assetMint),
        mode: series.mode,
        status: series.status,
        adjudication_mode: 0,
        terms_hash: sha256Bytes(`series:${series.seriesId}:terms`),
        pricing_hash: sha256Bytes(`series:${series.seriesId}:pricing`),
        payout_hash: sha256Bytes(`series:${series.seriesId}:payout`),
        reserve_model_hash: sha256Bytes(`series:${series.seriesId}:reserve-model`),
        evidence_requirements_hash: sha256Bytes(`series:${series.seriesId}:evidence`),
        comparability_hash: sha256Bytes(`series:${series.seriesId}:${series.comparabilityKey}`),
        policy_overrides_hash: sha256Bytes(`series:${series.seriesId}:policy-overrides`),
        cycle_seconds: BigInt(series.cycleSeconds ?? 30 * 86_400),
        terms_version: 1,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: series.healthPlan },
        { pubkey: series.address, isWritable: true },
        { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: series.address, assetMint: series.assetMint }), isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const fundingLineSpecs = [
    seekerSponsorLine,
    blendedSponsorLine,
    blendedPremiumLine,
    blendedProtectionLiquidityLine,
    blendedRewardLiquidityLine,
  ];
  for (const line of fundingLineSpecs) {
    if (await protocol.accountExists(connection, line.address)) continue;
    const seriesLedger = line.policySeries
      ? protocol.deriveSeriesReserveLedgerPda({ policySeries: line.policySeries, assetMint: line.assetMint })
      : null;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `open_funding_line:${line.lineId}`,
      instructionName: "open_funding_line",
      args: {
        line_id: line.lineId,
        policy_series: new PublicKey(line.policySeries ?? protocol.ZERO_PUBKEY),
        asset_mint: new PublicKey(line.assetMint),
        line_type: line.lineType,
        funding_priority: line.fundingPriority,
        committed_amount: protocol.toBigIntAmount(line.fundedAmount),
        caps_hash: sha256Bytes(`funding-line:${line.lineId}:caps`),
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: line.healthPlan },
        { pubkey: protocol.deriveDomainAssetVaultPda({ reserveDomain: line.reserveDomain, assetMint: line.assetMint }) },
        { pubkey: protocol.deriveDomainAssetLedgerPda({ reserveDomain: line.reserveDomain, assetMint: line.assetMint }), isWritable: true },
        { pubkey: line.address, isWritable: true },
        { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: line.address, assetMint: line.assetMint }), isWritable: true },
        { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: line.healthPlan, assetMint: line.assetMint }), isWritable: true },
        { pubkey: seriesLedger, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  if (!await protocol.accountExists(connection, pool.address)) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_liquidity_pool:${pool.poolId}`,
      instructionName: "create_liquidity_pool",
      args: {
        pool_id: pool.poolId,
        display_name: pool.displayName,
        curator: governance.publicKey,
        allocator: governance.publicKey,
        sentinel: governance.publicKey,
        deposit_asset_mint: new PublicKey(pool.depositAssetMint),
        strategy_hash: sha256Bytes(`pool:${pool.poolId}:strategy`),
        allowed_exposure_hash: sha256Bytes(`pool:${pool.poolId}:allowed-exposure`),
        external_yield_adapter_hash: sha256Bytes(`pool:${pool.poolId}:yield-adapter`),
        fee_bps: 50,
        redemption_policy: pool.redemptionPolicy,
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: pool.reserveDomain },
        { pubkey: protocol.deriveDomainAssetVaultPda({ reserveDomain: pool.reserveDomain, assetMint: pool.depositAssetMint }) },
        { pubkey: pool.address, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const capitalClassSpecs = [
    {
      fixture: openClass,
      ledger: openClassLedger,
      minLockupSeconds: 0n,
    },
    {
      fixture: wrapperClass,
      ledger: wrapperClassLedger,
      minLockupSeconds: 30n * 86_400n,
    },
  ];
  for (const capitalClassSpec of capitalClassSpecs) {
    if (await protocol.accountExists(connection, capitalClassSpec.fixture.address)) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_capital_class:${capitalClassSpec.fixture.classId}`,
      instructionName: "create_capital_class",
      args: {
        class_id: capitalClassSpec.fixture.classId,
        display_name: capitalClassSpec.fixture.displayName,
        share_mint: protocol.ZERO_PUBKEY_KEY,
        priority: capitalClassSpec.fixture.priority,
        impairment_rank: capitalClassSpec.fixture.priority,
        restriction_mode: capitalClassSpec.fixture.restrictionMode,
        redemption_terms_mode: 0,
        wrapper_metadata_hash: sha256Bytes(`capital-class:${capitalClassSpec.fixture.classId}:wrapper`),
        permissioning_hash: sha256Bytes(`capital-class:${capitalClassSpec.fixture.classId}:permissioning`),
        fee_bps: 0,
        min_lockup_seconds: capitalClassSpec.minLockupSeconds,
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: pool.address },
        { pubkey: capitalClassSpec.fixture.address, isWritable: true },
        { pubkey: capitalClassSpec.ledger, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);

  const standardSchema = currentValue(snapshot, standardSchemaAddress).schema;
  if (!standardSchema) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "register_outcome_schema:standard",
      instructionName: "register_outcome_schema",
      args: {
        schema_key_hash: STANDARD_SCHEMA_KEY_HASH_BYTES,
        schema_key: "standard.health.outcomes",
        version: 1,
        schema_hash: sha256Bytes("standard-health-outcomes-schema-v1"),
        schema_family: protocol.SCHEMA_FAMILY_KERNEL,
        visibility: protocol.SCHEMA_VISIBILITY_PUBLIC,
        metadata_uri: "https://protocol.omegax.health/schemas/standard-health-outcomes-v1.json",
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: standardSchemaAddress, isWritable: true },
        { pubkey: standardSchemaDependencyLedger, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveStandardSchema = currentValue(snapshot, standardSchemaAddress).schema;
  if (!liveStandardSchema?.verified) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "verify_outcome_schema:standard",
      instructionName: "verify_outcome_schema",
      args: { verified: true },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: standardSchemaAddress, isWritable: true },
      ],
    });
  }

  await sendProtocolInstruction({
    protocol,
    connection,
    feePayer: governance,
    label: "backfill_schema_dependency_ledger:standard",
    instructionName: "backfill_schema_dependency_ledger",
    args: {
      schema_key_hash: STANDARD_SCHEMA_KEY_HASH_BYTES,
      pool_rule_addresses: [new PublicKey(pool.address)],
    },
    accounts: [
      { pubkey: governance.publicKey, isSigner: true, isWritable: true },
      { pubkey: governanceAddress },
      { pubkey: standardSchemaAddress },
      { pubkey: standardSchemaDependencyLedger, isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already in use")) {
      throw error;
    }
  });

  if (!currentValue(snapshot, oracleProfileAddress).oracleProfile) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "register_oracle:canonical",
      instructionName: "register_oracle",
      args: {
        oracle: roleWallets.oracle.publicKey,
        oracle_type: protocol.ORACLE_TYPE_HEALTH_APP,
        display_name: "OmegaX Canonical Oracle",
        legal_name: "OmegaX Canonical Oracle Operator",
        website_url: "https://protocol.omegax.health",
        app_url: "https://protocol.omegax.health/oracles",
        logo_uri: "https://protocol.omegax.health/icon.png",
        webhook_url: "https://protocol.omegax.health/api/oracles/canonical",
        supported_schema_key_hashes: [[...Buffer.from(STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX, "hex")]],
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: oracleProfileAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!currentValue(snapshot, oracleProfileAddress).oracleProfile?.claimed) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: roleWallets.oracle,
      label: "claim_oracle:canonical",
      instructionName: "claim_oracle",
      args: {},
      accounts: [
        { pubkey: roleWallets.oracle.publicKey, isSigner: true },
        { pubkey: oracleProfileAddress, isWritable: true },
      ],
    });
  }

  if (!currentValue(snapshot, poolOraclePolicyAddress).poolOraclePolicy) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "set_pool_oracle_policy:canonical",
      instructionName: "set_pool_oracle_policy",
      args: {
        quorum_m: 1,
        quorum_n: 1,
        require_verified_schema: true,
        oracle_fee_bps: 25,
        allow_delegate_claim: true,
        challenge_window_secs: 86_400,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: pool.address },
        { pubkey: poolOraclePolicyAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  if (!currentValue(snapshot, poolOracleApprovalAddress).poolOracleApproval?.active) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "set_pool_oracle:canonical",
      instructionName: "set_pool_oracle",
      args: { active: true },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: pool.address },
        { pubkey: oracleProfileAddress },
        { pubkey: poolOracleApprovalAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  if (!currentValue(snapshot, poolOraclePermissionSetAddress).poolOraclePermissionSet) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "set_pool_oracle_permissions:canonical",
      instructionName: "set_pool_oracle_permissions",
      args: { permissions: 7 },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: pool.address },
        { pubkey: oracleProfileAddress },
        { pubkey: poolOracleApprovalAddress },
        { pubkey: poolOraclePermissionSetAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const memberPositionSpecs = [
    {
      address: seekerMemberPosition,
      wallet: roleWallets.member,
      healthPlan: seekerPlan.address,
      policySeries: seekerRewardSeries.address,
      rights: RIGHT_CLAIM_REWARD | RIGHT_VIEW_PAYOUT_HISTORY,
      proofMode: MEMBERSHIP_PROOF_MODE_INVITE_PERMIT,
      inviteAuthority: governance,
      inviteIdHash: sha256Bytes("invite:seeker:member"),
    },
    {
      address: blendedRewardMemberPosition,
      wallet: roleWallets.member,
      healthPlan: blendedPlan.address,
      policySeries: blendedRewardSeries.address,
      rights: RIGHT_CLAIM_REWARD,
      proofMode: MEMBERSHIP_PROOF_MODE_OPEN,
      inviteAuthority: null,
      inviteIdHash: Array(32).fill(0),
    },
    {
      address: blendedProtectionMemberPosition,
      wallet: roleWallets.secondMember,
      healthPlan: blendedPlan.address,
      policySeries: blendedProtectionSeries.address,
      rights: RIGHT_OPEN_CLAIM_CASE | RIGHT_APPOINT_DELEGATE,
      proofMode: MEMBERSHIP_PROOF_MODE_OPEN,
      inviteAuthority: null,
      inviteIdHash: Array(32).fill(0),
    },
  ];
  for (const memberPosition of memberPositionSpecs) {
    if (await protocol.accountExists(connection, memberPosition.address)) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: memberPosition.wallet,
      signers: memberPosition.inviteAuthority ? [memberPosition.inviteAuthority] : [],
      label: `open_member_position:${memberPosition.address.slice(0, 8)}`,
      instructionName: "open_member_position",
      args: {
        series_scope: new PublicKey(memberPosition.policySeries),
        subject_commitment: sha256Bytes(`member:${memberPosition.wallet.publicKey.toBase58()}`),
        eligibility_status: protocol.ELIGIBILITY_ELIGIBLE,
        delegated_rights: memberPosition.rights,
        proof_mode: memberPosition.proofMode,
        token_gate_amount_snapshot: 0n,
        invite_id_hash: memberPosition.inviteIdHash,
        invite_expires_at: 0n,
        anchor_ref: protocol.ZERO_PUBKEY_KEY,
      },
      accounts: [
        { pubkey: memberPosition.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: memberPosition.healthPlan },
        { pubkey: memberPosition.address, isWritable: true },
        { pubkey: null },
        { pubkey: null },
        { pubkey: memberPosition.inviteAuthority?.publicKey ?? null, isSigner: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const currentSeekerSponsorLine = currentValue(snapshot, seekerSponsorLine.address).fundingLine;
  const currentBlendedSponsorLine = currentValue(snapshot, blendedSponsorLine.address).fundingLine;
  const currentBlendedPremiumLine = currentValue(snapshot, blendedPremiumLine.address).fundingLine;

  if (protocol.toBigIntAmount(currentSeekerSponsorLine?.fundedAmount) < 250_000n) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "fund_sponsor_budget:seeker",
      instructionName: "fund_sponsor_budget",
      args: {
        amount: 250_000n - protocol.toBigIntAmount(currentSeekerSponsorLine?.fundedAmount),
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: seekerPlan.address },
        { pubkey: openRewardDomainVault, isWritable: true },
        { pubkey: openRewardDomainLedger, isWritable: true },
        { pubkey: seekerSponsorLine.address, isWritable: true },
        { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: seekerSponsorLine.address, assetMint: fixtureState.rewardMint }), isWritable: true },
        { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: seekerPlan.address, assetMint: fixtureState.rewardMint }), isWritable: true },
        { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: seekerRewardSeries.address, assetMint: fixtureState.rewardMint }), isWritable: true },
      ],
    });
  }

  if (protocol.toBigIntAmount(currentBlendedSponsorLine?.fundedAmount) < 120_000n) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "fund_sponsor_budget:blended",
      instructionName: "fund_sponsor_budget",
      args: {
        amount: 120_000n - protocol.toBigIntAmount(currentBlendedSponsorLine?.fundedAmount),
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: blendedPlan.address },
        { pubkey: openRewardDomainVault, isWritable: true },
        { pubkey: openRewardDomainLedger, isWritable: true },
        { pubkey: blendedSponsorLine.address, isWritable: true },
        { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: blendedSponsorLine.address, assetMint: fixtureState.rewardMint }), isWritable: true },
        { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: blendedPlan.address, assetMint: fixtureState.rewardMint }), isWritable: true },
        { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: blendedRewardSeries.address, assetMint: fixtureState.rewardMint }), isWritable: true },
      ],
    });
  }

  if (protocol.toBigIntAmount(currentBlendedPremiumLine?.fundedAmount) < 480_000n) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "record_premium_payment:blended",
      instructionName: "record_premium_payment",
      args: {
        amount: 480_000n - protocol.toBigIntAmount(currentBlendedPremiumLine?.fundedAmount),
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: blendedPlan.address },
        { pubkey: fixtureState.domainAssetVaults[0]!.address, isWritable: true },
        { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
        { pubkey: blendedPremiumLine.address, isWritable: true },
        { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: blendedPremiumLine.address, assetMint: fixtureState.settlementMint }), isWritable: true },
        { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: blendedPlan.address, assetMint: fixtureState.settlementMint }), isWritable: true },
        { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: blendedProtectionSeries.address, assetMint: fixtureState.settlementMint }), isWritable: true },
        { pubkey: openClassLedger, isWritable: true },
      ],
    });
  }

  if (!await protocol.accountExists(connection, protocol.deriveLpPositionPda({
    capitalClass: openClass.address,
    owner: roleWallets.lpProvider.publicKey,
  }))) {
    // Let the first deposit create the LP position.
  }

  await sendProtocolInstruction({
    protocol,
    connection,
    feePayer: governance,
    label: "update_lp_position_credentialing:wrapper",
    instructionName: "update_lp_position_credentialing",
    args: {
      owner: roleWallets.wrapperProvider.publicKey,
      credentialed: true,
      reason_hash: sha256Bytes("credentialing:wrapper-provider"),
    },
    accounts: [
      { pubkey: governance.publicKey, isSigner: true, isWritable: true },
      { pubkey: governanceAddress },
      { pubkey: pool.address },
      { pubkey: wrapperClass.address },
      { pubkey: protocol.deriveLpPositionPda({ capitalClass: wrapperClass.address, owner: roleWallets.wrapperProvider.publicKey }), isWritable: true },
      { pubkey: SystemProgram.programId },
    ],
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already in use")) {
      throw error;
    }
  });

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const openLpPosition = protocol.deriveLpPositionPda({
    capitalClass: openClass.address,
    owner: roleWallets.lpProvider.publicKey,
  }).toBase58();
  const wrapperLpPosition = protocol.deriveLpPositionPda({
    capitalClass: wrapperClass.address,
    owner: roleWallets.wrapperProvider.publicKey,
  }).toBase58();
  const currentOpenLp = currentValue(snapshot, openLpPosition).lpPosition;
  const currentWrapperLp = currentValue(snapshot, wrapperLpPosition).lpPosition;

  if (protocol.toBigIntAmount(currentOpenLp?.subscriptionBasis) < 1_500_000n) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: roleWallets.lpProvider,
      label: "deposit_into_capital_class:open",
      instructionName: "deposit_into_capital_class",
      args: {
        amount: 1_500_000n - protocol.toBigIntAmount(currentOpenLp?.subscriptionBasis),
        shares: 0n,
      },
      accounts: [
        { pubkey: roleWallets.lpProvider.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: fixtureState.domainAssetVaults[0]!.address, isWritable: true },
        { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
        { pubkey: pool.address, isWritable: true },
        { pubkey: openClass.address, isWritable: true },
        { pubkey: openClassLedger, isWritable: true },
        { pubkey: openLpPosition, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  if (protocol.toBigIntAmount(currentWrapperLp?.subscriptionBasis) < 400_000n) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: roleWallets.wrapperProvider,
      label: "deposit_into_capital_class:wrapper",
      instructionName: "deposit_into_capital_class",
      args: {
        amount: 400_000n - protocol.toBigIntAmount(currentWrapperLp?.subscriptionBasis),
        shares: 0n,
      },
      accounts: [
        { pubkey: roleWallets.wrapperProvider.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: fixtureState.domainAssetVaults[0]!.address, isWritable: true },
        { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
        { pubkey: pool.address, isWritable: true },
        { pubkey: wrapperClass.address, isWritable: true },
        { pubkey: wrapperClassLedger, isWritable: true },
        { pubkey: wrapperLpPosition, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const allocationSpecs = [
    {
      address: rewardAllocation,
      ledger: rewardAllocationLedger,
      capitalClass: openClass.address,
      healthPlan: blendedPlan.address,
      fundingLine: blendedRewardLiquidityLine.address,
      policySeries: blendedRewardSeries.address,
      capAmount: 200_000n,
      weightBps: 1500,
      allocationAmount: 150_000n,
    },
    {
      address: protectionOpenAllocation,
      ledger: protectionOpenAllocationLedger,
      capitalClass: openClass.address,
      healthPlan: blendedPlan.address,
      fundingLine: blendedProtectionLiquidityLine.address,
      policySeries: blendedProtectionSeries.address,
      capAmount: 900_000n,
      weightBps: 7500,
      allocationAmount: 750_000n,
    },
    {
      address: protectionWrapperAllocation,
      ledger: protectionWrapperAllocationLedger,
      capitalClass: wrapperClass.address,
      healthPlan: blendedPlan.address,
      fundingLine: blendedProtectionLiquidityLine.address,
      policySeries: blendedProtectionSeries.address,
      capAmount: 300_000n,
      weightBps: 2500,
      allocationAmount: 250_000n,
    },
  ];
  for (const allocation of allocationSpecs) {
    if (!await protocol.accountExists(connection, allocation.address)) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `create_allocation_position:${allocation.address.slice(0, 8)}`,
        instructionName: "create_allocation_position",
        args: {
          policy_series: new PublicKey(allocation.policySeries),
          cap_amount: allocation.capAmount,
          weight_bps: allocation.weightBps,
          allocation_mode: 0,
          deallocation_only: false,
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true, isWritable: true },
          { pubkey: governanceAddress },
          { pubkey: pool.address },
          { pubkey: allocation.capitalClass },
          { pubkey: allocation.healthPlan },
          { pubkey: allocation.fundingLine },
          { pubkey: allocation.address, isWritable: true },
          { pubkey: allocation.ledger, isWritable: true },
          { pubkey: SystemProgram.programId },
        ],
      });
    }
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  for (const allocation of allocationSpecs) {
    const currentAllocation = currentValue(snapshot, allocation.address).allocationPosition;
    if (protocol.toBigIntAmount(currentAllocation?.allocatedAmount) >= allocation.allocationAmount) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `allocate_capital:${allocation.address.slice(0, 8)}`,
      instructionName: "allocate_capital",
      args: {
        amount: allocation.allocationAmount - protocol.toBigIntAmount(currentAllocation?.allocatedAmount),
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: pool.address, isWritable: true },
        { pubkey: allocation.capitalClass, isWritable: true },
        { pubkey: allocation.capitalClass === openClass.address ? openClassLedger : wrapperClassLedger, isWritable: true },
        { pubkey: allocation.fundingLine },
        { pubkey: allocation.address, isWritable: true },
        { pubkey: allocation.ledger, isWritable: true },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  const liveOpenLp = currentValue(snapshot, openLpPosition).lpPosition;
  if (protocol.toBigIntAmount(liveOpenLp?.pendingRedemptionShares) < 25_000n) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: roleWallets.lpProvider,
      label: "request_redemption:open",
      instructionName: "request_redemption",
      args: {
        shares: 25_000n,
        asset_amount: 25_000n,
      },
      accounts: [
        { pubkey: roleWallets.lpProvider.publicKey, isSigner: true },
        { pubkey: pool.address, isWritable: true },
        { pubkey: openClass.address, isWritable: true },
        { pubkey: openClassLedger, isWritable: true },
        { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
        { pubkey: openLpPosition, isWritable: true },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);

  const createRewardObligationIfMissing = async (
    address: string,
    obligationId: string,
    amount: bigint,
    settleMode: "claimable" | "settled",
  ) => {
    if (!await protocol.accountExists(connection, address)) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `create_obligation:${obligationId}`,
        instructionName: "create_obligation",
        args: {
          obligation_id: obligationId,
          asset_mint: new PublicKey(fixtureState.rewardMint),
          policy_series: new PublicKey(seekerRewardSeries.address),
          member_wallet: roleWallets.member.publicKey,
          beneficiary: roleWallets.member.publicKey,
          claim_case: protocol.ZERO_PUBKEY_KEY,
          liquidity_pool: protocol.ZERO_PUBKEY_KEY,
          capital_class: protocol.ZERO_PUBKEY_KEY,
          allocation_position: protocol.ZERO_PUBKEY_KEY,
          delivery_mode: protocol.OBLIGATION_DELIVERY_MODE_CLAIMABLE,
          amount,
          creation_reason_hash: sha256Bytes(`obligation:${obligationId}:create`),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true, isWritable: true },
          { pubkey: governanceAddress },
          { pubkey: seekerPlan.address },
          { pubkey: openRewardDomainLedger, isWritable: true },
          { pubkey: seekerSponsorLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: seekerSponsorLine.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: seekerPlan.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: seekerRewardSeries.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: address, isWritable: true },
          { pubkey: SystemProgram.programId },
        ],
      });
    }

    const refreshed = await protocol.loadProtocolConsoleSnapshot(connection);
    const obligation = currentValue(refreshed, address).obligation;
    if (!obligation) {
      throw new Error(`Missing reward obligation after create: ${obligationId}`);
    }
    if (obligation.status === protocol.OBLIGATION_STATUS_PROPOSED) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `reserve_obligation:${obligationId}`,
        instructionName: "reserve_obligation",
        args: { amount },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: seekerPlan.address },
          { pubkey: openRewardDomainLedger, isWritable: true },
          { pubkey: seekerSponsorLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: seekerSponsorLine.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: seekerPlan.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: seekerRewardSeries.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: null },
          { pubkey: address, isWritable: true },
        ],
      });
    }

    const reserved = currentValue(await protocol.loadProtocolConsoleSnapshot(connection), address).obligation;
    if (!reserved) return;
    if (settleMode === "claimable" && reserved.status === protocol.OBLIGATION_STATUS_RESERVED) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `settle_obligation_claimable:${obligationId}`,
        instructionName: "settle_obligation",
        args: {
          next_status: protocol.OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
          amount,
          settlement_reason_hash: sha256Bytes(`obligation:${obligationId}:claimable`),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: seekerPlan.address },
          { pubkey: openRewardDomainVault, isWritable: true },
          { pubkey: openRewardDomainLedger, isWritable: true },
          { pubkey: seekerSponsorLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: seekerSponsorLine.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: seekerPlan.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: seekerRewardSeries.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: null },
          { pubkey: address, isWritable: true },
        ],
      });
    }
    if (settleMode === "settled" && (
      reserved.status === protocol.OBLIGATION_STATUS_RESERVED
      || reserved.status === protocol.OBLIGATION_STATUS_CLAIMABLE_PAYABLE
    )) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `settle_obligation_settled:${obligationId}`,
        instructionName: "settle_obligation",
        args: {
          next_status: protocol.OBLIGATION_STATUS_SETTLED,
          amount,
          settlement_reason_hash: sha256Bytes(`obligation:${obligationId}:settled`),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: seekerPlan.address },
          { pubkey: openRewardDomainVault, isWritable: true },
          { pubkey: openRewardDomainLedger, isWritable: true },
          { pubkey: seekerSponsorLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: seekerSponsorLine.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: seekerPlan.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: seekerRewardSeries.address, assetMint: fixtureState.rewardMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: null },
          { pubkey: address, isWritable: true },
        ],
      });
    }
  };

  await createRewardObligationIfMissing(seekerSettledObligation, "reward-obligation-001", 20_000n, "settled");
  await createRewardObligationIfMissing(seekerClaimableObligation, "reward-obligation-002", 8_000n, "claimable");

  const protectionClaimSpecs = [
    {
      claimAddress: protectionReservedClaim,
      claimId: "claim-protect-001",
      obligationAddress: protectionReservedObligation,
      obligationId: "protection-obligation-001",
      amount: 30_000n,
      settle: false,
    },
    {
      claimAddress: protectionSettledClaim,
      claimId: "claim-protect-002",
      obligationAddress: protectionSettledObligation,
      obligationId: "protection-obligation-002",
      amount: 50_000n,
      settle: true,
    },
  ];

  for (const claimSpec of protectionClaimSpecs) {
    if (!await protocol.accountExists(connection, claimSpec.claimAddress)) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: roleWallets.memberDelegate,
        label: `open_claim_case:${claimSpec.claimId}`,
        instructionName: "open_claim_case",
        args: {
          claim_id: claimSpec.claimId,
          policy_series: new PublicKey(blendedProtectionSeries.address),
          claimant: roleWallets.secondMember.publicKey,
          evidence_ref_hash: sha256Bytes(`claim:${claimSpec.claimId}:evidence`),
        },
        accounts: [
          { pubkey: roleWallets.memberDelegate.publicKey, isSigner: true, isWritable: true },
          { pubkey: blendedPlan.address },
          { pubkey: blendedProtectionMemberPosition },
          { pubkey: blendedPremiumLine.address },
          { pubkey: claimSpec.claimAddress, isWritable: true },
          { pubkey: SystemProgram.programId },
        ],
      });
    }

    if (!await protocol.accountExists(connection, claimSpec.obligationAddress)) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `create_obligation:${claimSpec.obligationId}`,
        instructionName: "create_obligation",
        args: {
          obligation_id: claimSpec.obligationId,
          asset_mint: new PublicKey(fixtureState.settlementMint),
          policy_series: new PublicKey(blendedProtectionSeries.address),
          member_wallet: roleWallets.secondMember.publicKey,
          beneficiary: roleWallets.secondMember.publicKey,
          claim_case: new PublicKey(claimSpec.claimAddress),
          liquidity_pool: protocol.ZERO_PUBKEY_KEY,
          capital_class: protocol.ZERO_PUBKEY_KEY,
          allocation_position: protocol.ZERO_PUBKEY_KEY,
          delivery_mode: protocol.OBLIGATION_DELIVERY_MODE_PAYABLE,
          amount: claimSpec.amount,
          creation_reason_hash: sha256Bytes(`obligation:${claimSpec.obligationId}:create`),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true, isWritable: true },
          { pubkey: governanceAddress },
          { pubkey: blendedPlan.address },
          { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
          { pubkey: blendedPremiumLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: blendedPremiumLine.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: blendedPlan.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: blendedProtectionSeries.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: claimSpec.obligationAddress, isWritable: true },
          { pubkey: SystemProgram.programId },
        ],
      });
    }

    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const liveClaim = currentValue(snapshot, claimSpec.claimAddress).claimCase;
    if (!liveClaim || protocol.toBigIntAmount(liveClaim.approvedAmount) < claimSpec.amount) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `adjudicate_claim_case:${claimSpec.claimId}`,
        instructionName: "adjudicate_claim_case",
        args: {
          review_state: 1,
          approved_amount: claimSpec.amount,
          denied_amount: 0n,
          reserve_amount: claimSpec.amount,
          decision_support_hash: sha256Bytes(`claim:${claimSpec.claimId}:decision`),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: blendedPlan.address },
          { pubkey: claimSpec.claimAddress, isWritable: true },
          { pubkey: claimSpec.obligationAddress, isWritable: true },
        ],
      });
    }

    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const liveProtectionObligation = currentValue(snapshot, claimSpec.obligationAddress).obligation;
    if (liveProtectionObligation?.status === protocol.OBLIGATION_STATUS_PROPOSED) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `reserve_obligation:${claimSpec.obligationId}`,
        instructionName: "reserve_obligation",
        args: { amount: claimSpec.amount },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: blendedPlan.address },
          { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
          { pubkey: blendedPremiumLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: blendedPremiumLine.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: blendedPlan.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: blendedProtectionSeries.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: null },
          { pubkey: claimSpec.obligationAddress, isWritable: true },
        ],
      });
    }

    if (!claimSpec.settle) continue;
    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const reservedObligation = currentValue(snapshot, claimSpec.obligationAddress).obligation;
    if (reservedObligation?.status === protocol.OBLIGATION_STATUS_RESERVED) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `settle_obligation:${claimSpec.obligationId}`,
        instructionName: "settle_obligation",
        args: {
          next_status: protocol.OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
          amount: claimSpec.amount,
          settlement_reason_hash: sha256Bytes(`obligation:${claimSpec.obligationId}:payable`),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: blendedPlan.address },
          { pubkey: fixtureState.domainAssetVaults[0]!.address, isWritable: true },
          { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
          { pubkey: blendedPremiumLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: blendedPremiumLine.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: blendedPlan.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: blendedProtectionSeries.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: null },
          { pubkey: claimSpec.obligationAddress, isWritable: true },
        ],
      });
    }

    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const settledClaim = currentValue(snapshot, claimSpec.claimAddress).claimCase;
    if (protocol.toBigIntAmount(settledClaim?.paidAmount) < claimSpec.amount) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: `settle_claim_case:${claimSpec.claimId}`,
        instructionName: "settle_claim_case",
        args: {
          amount: claimSpec.amount - protocol.toBigIntAmount(settledClaim?.paidAmount),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: blendedPlan.address },
          { pubkey: fixtureState.domainAssetVaults[0]!.address, isWritable: true },
          { pubkey: fixtureState.domainAssetLedgers[0]!.address, isWritable: true },
          { pubkey: blendedPremiumLine.address, isWritable: true },
          { pubkey: protocol.deriveFundingLineLedgerPda({ fundingLine: blendedPremiumLine.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: blendedPlan.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: protocol.deriveSeriesReserveLedgerPda({ policySeries: blendedProtectionSeries.address, assetMint: fixtureState.settlementMint }), isWritable: true },
          { pubkey: null },
          { pubkey: null },
          { pubkey: null },
          { pubkey: claimSpec.claimAddress, isWritable: true },
          { pubkey: claimSpec.obligationAddress, isWritable: true },
        ],
      });
    }
  }

  const configuredGovernanceControl = configuredGovernanceControlAddress();
  if (configuredGovernanceControl) {
    const protocolConfig = await protocol.fetchProtocolConfig({ connection });
    if (!protocolConfig) {
      throw new Error("Protocol governance config could not be loaded after live bootstrap.");
    }
    if (protocolConfig.governanceAuthority !== configuredGovernanceControl) {
      if (protocolConfig.governanceAuthority !== governance.publicKey.toBase58()) {
        throw new Error(
          `Protocol governance authority is ${protocolConfig.governanceAuthority}, but live bootstrap can only hand off from ${governance.publicKey.toBase58()} to ${configuredGovernanceControl}.`,
        );
      }
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: "rotate_protocol_governance_authority",
        instructionName: "rotate_protocol_governance_authority",
        args: {
          new_governance_authority: new PublicKey(configuredGovernanceControl),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true, isWritable: true },
          { pubkey: governanceAddress, isWritable: true },
        ],
      });
    }
  }

  run("npm", ["run", "protocol:bootstrap"]);
  run("npm", ["run", "devnet:frontend:bootstrap"]);

  const finalSnapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  console.log(
    JSON.stringify(
      {
        protocolGovernance: finalSnapshot.protocolGovernance?.address ?? null,
        reserveDomains: finalSnapshot.reserveDomains.length,
        domainAssetLedgers: finalSnapshot.domainAssetLedgers.length,
        healthPlans: finalSnapshot.healthPlans.length,
        policySeries: finalSnapshot.policySeries.length,
        memberPositions: finalSnapshot.memberPositions.length,
        fundingLines: finalSnapshot.fundingLines.length,
        claimCases: finalSnapshot.claimCases.length,
        obligations: finalSnapshot.obligations.length,
        liquidityPools: finalSnapshot.liquidityPools.length,
        capitalClasses: finalSnapshot.capitalClasses.length,
        lpPositions: finalSnapshot.lpPositions.length,
        allocationPositions: finalSnapshot.allocationPositions.length,
        oracleProfiles: finalSnapshot.oracleProfiles.length,
        poolOracleApprovals: finalSnapshot.poolOracleApprovals.length,
        poolOraclePolicies: finalSnapshot.poolOraclePolicies.length,
        poolOraclePermissionSets: finalSnapshot.poolOraclePermissionSets.length,
        outcomeSchemas: finalSnapshot.outcomeSchemas.length,
        schemaDependencyLedgers: finalSnapshot.schemaDependencyLedgers.length,
      },
      null,
      2,
    ),
  );
}

await main();
