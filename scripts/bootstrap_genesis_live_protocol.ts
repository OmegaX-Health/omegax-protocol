// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import protocolModule from "../frontend/lib/protocol.ts";
import { loadEnvFile } from "./support/load_env_file.ts";
import {
  loadGenesisLiveBootstrapConfig,
  stableStringify,
} from "./support/genesis_live_bootstrap_config.ts";
import { wrapConnectionWithRpcRetry } from "./support/rpc_retry.ts";
import { keypairFromFile, requiredPublicKeyEnv, sha256Bytes } from "./support/script_helpers.ts";

type ProtocolModule = typeof import("../frontend/lib/protocol.ts");

type ProtocolInstructionAccountInput = {
  pubkey?: PublicKey | string | null;
  isSigner?: boolean;
  isWritable?: boolean;
};

type CurrentValue = {
  fundingLine: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["fundingLines"][number] | undefined;
  allocationPosition: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["allocationPositions"][number] | undefined;
  schema: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["outcomeSchemas"][number] | undefined;
  oracleProfile: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["oracleProfiles"][number] | undefined;
  poolOraclePolicy: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["poolOraclePolicies"][number] | undefined;
  poolOracleApproval: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["poolOracleApprovals"][number] | undefined;
  poolOraclePermissionSet: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["poolOraclePermissionSets"][number] | undefined;
  lpPosition: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>["lpPositions"][number] | undefined;
};

const FRONTEND_ENV_PATH = resolve(process.cwd(), "frontend/.env.local");
const DEFAULT_GOVERNANCE_KEYPAIR_PATH = resolve(homedir(), ".config/solana/id.json");

function schemaMetadataHashHex(path: string): string {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  return createHash("sha256").update(stableStringify(parsed)).digest("hex");
}

function parseArgs(argv: string[]): { planOnly: boolean } {
  return {
    planOnly: argv.includes("--plan"),
  };
}

function currentValue(
  snapshot: Awaited<ReturnType<ProtocolModule["loadProtocolConsoleSnapshot"]>>,
  address: string,
): CurrentValue {
  return {
    fundingLine: snapshot.fundingLines.find((row) => row.address === address),
    allocationPosition: snapshot.allocationPositions.find((row) => row.address === address),
    schema: snapshot.outcomeSchemas.find((row) => row.address === address),
    oracleProfile: snapshot.oracleProfiles.find((row) => row.address === address),
    poolOraclePolicy: snapshot.poolOraclePolicies.find((row) => row.address === address),
    poolOracleApproval: snapshot.poolOracleApprovals.find((row) => row.address === address),
    poolOraclePermissionSet: snapshot.poolOraclePermissionSets.find((row) => row.address === address),
    lpPosition: snapshot.lpPositions.find((row) => row.address === address),
  };
}

async function directProtocolGovernanceAuthority(
  protocol: ProtocolModule,
  connection: Connection,
): Promise<string | null> {
  const protocolConfig = await protocol.fetchProtocolConfig({ connection });
  return protocolConfig?.governanceAuthority ?? null;
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
    { blockhash, lastValidBlockHeight, signature },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(`${params.label} failed during confirmation.`);
  }
  console.log(`[genesis-live] ${params.label}: ${signature}`);
  return signature;
}

function planSummary(
  protocol: ProtocolModule,
  config: ReturnType<typeof loadGenesisLiveBootstrapConfig>,
) {
  return {
    rpcUrl: config.rpcUrl,
    programId: protocol.getProgramId().toBase58(),
    governanceAuthority: config.governanceAuthority,
    governanceConfigAddress: config.governanceConfigAddress,
    settlementMint: config.settlementMint,
    reserveDomain: config.reserveDomain,
    roles: {
      sponsor: config.roles.sponsor,
      sponsorOperator: config.roles.sponsorOperator,
      claimsOperator: config.roles.claimsOperator,
      oracleAuthority: config.roles.oracleAuthority,
      poolCurator: config.roles.poolCurator,
      poolAllocator: config.roles.poolAllocator,
      poolSentinel: config.roles.poolSentinel,
    },
    schema: {
      key: config.schema.key,
      version: config.schema.version,
      keyHashHex: config.schema.keyHashHex,
      metadataUri: config.schema.metadataUri,
      metadataLocalPath: config.schema.metadataLocalPath,
    },
    plan: config.healthPlan,
    series: config.policySeries,
    fundingLines: config.fundingLines,
    pool: config.liquidityPool,
    capitalClasses: config.capitalClasses,
    allocations: config.allocations,
    fundingAmounts: config.fundingAmounts,
  };
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, currentValue) => (typeof currentValue === "bigint" ? currentValue.toString() : currentValue),
    2,
  );
}

async function main() {
  const { planOnly } = parseArgs(process.argv.slice(2));
  loadEnvFile(FRONTEND_ENV_PATH);

  const governanceKeypairPath = process.env.SOLANA_KEYPAIR?.trim() || DEFAULT_GOVERNANCE_KEYPAIR_PATH;
  const governance = keypairFromFile(governanceKeypairPath);
  const protocol = protocolModule as typeof import("../frontend/lib/protocol.ts");
  const config = loadGenesisLiveBootstrapConfig({
    governanceAuthority: governance.publicKey.toBase58(),
  });

  if (planOnly) {
    console.log(stringifyJson(planSummary(protocol, config)));
    return;
  }

  if (!existsSync(config.schema.metadataLocalPath)) {
    throw new Error(`Genesis schema metadata file not found: ${config.schema.metadataLocalPath}`);
  }

  const oracle = keypairFromFile(config.roles.oracleKeypairPath);
  if (oracle.publicKey.toBase58() !== config.roles.oracleAuthority) {
    throw new Error(
      `OMEGAX_LIVE_ORACLE_WALLET (${config.roles.oracleAuthority}) does not match ${config.roles.oracleKeypairPath} (${oracle.publicKey.toBase58()}).`,
    );
  }

  const seniorLp = config.capitalClasses.senior.lpKeypairPath
    ? keypairFromFile(config.capitalClasses.senior.lpKeypairPath)
    : null;
  const juniorLp = config.capitalClasses.junior.lpKeypairPath
    ? keypairFromFile(config.capitalClasses.junior.lpKeypairPath)
    : null;

  const connection = wrapConnectionWithRpcRetry(new Connection(config.rpcUrl, "confirmed"), {
    labelPrefix: "genesis-live",
    logPrefix: "genesis-live",
  });

  if (!await protocol.accountExists(connection, protocol.getProgramId().toBase58())) {
    throw new Error(
      `Program ${protocol.getProgramId().toBase58()} is not deployed on ${config.rpcUrl}. Deploy it before running the Genesis live bootstrap.`,
    );
  }

  const governanceBalance = await connection.getBalance(governance.publicKey, "confirmed");
  if (governanceBalance <= 0) {
    throw new Error(
      `Governance wallet ${governance.publicKey.toBase58()} has 0 lamports on ${config.rpcUrl}. Fund it before running live bootstrap.`,
    );
  }

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

  if (!await protocol.accountExists(connection, config.reserveDomain.address)) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_reserve_domain:${config.reserveDomain.id}`,
      instructionName: "create_reserve_domain",
      args: {
        domain_id: config.reserveDomain.id,
        display_name: config.reserveDomain.displayName,
        domain_admin: new PublicKey(config.reserveDomain.admin),
        settlement_mode: 0,
        legal_structure_hash: sha256Bytes(`reserve-domain:${config.reserveDomain.id}:legal`),
        compliance_baseline_hash: sha256Bytes(`reserve-domain:${config.reserveDomain.id}:compliance`),
        allowed_rail_mask: 0xffff,
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.reserveDomain.address, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const domainAssetVault = protocol.deriveDomainAssetVaultPda({
    reserveDomain: config.reserveDomain.address,
    assetMint: config.settlementMint,
  }).toBase58();
  const domainAssetLedger = protocol.deriveDomainAssetLedgerPda({
    reserveDomain: config.reserveDomain.address,
    assetMint: config.settlementMint,
  }).toBase58();
  // PT-2026-04-27-01/02 fix: vault token account is now PDA-owned and the
  // program initializes it inline. Operators no longer pre-create the token
  // account or pass `OMEGAX_GENESIS_SETTLEMENT_VAULT_TOKEN_ACCOUNT`.
  const vaultTokenAccountAddress = protocol
    .deriveDomainAssetVaultTokenAccountPda({
      reserveDomain: config.reserveDomain.address,
      assetMint: config.settlementMint,
    })
    .toBase58();
  const vaultExists = await protocol.accountExists(connection, domainAssetVault);
  const ledgerExists = await protocol.accountExists(connection, domainAssetLedger);
  if (!vaultExists || !ledgerExists) {
    if (vaultExists !== ledgerExists) {
      throw new Error("Partial domain asset bootstrap exists for the Genesis settlement rail.");
    }
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "create_domain_asset_vault:genesis-settlement",
      instructionName: "create_domain_asset_vault",
      args: {
        asset_mint: new PublicKey(config.settlementMint),
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.reserveDomain.address, isWritable: true },
        { pubkey: domainAssetVault, isWritable: true },
        { pubkey: domainAssetLedger, isWritable: true },
        { pubkey: new PublicKey(config.settlementMint) },
        { pubkey: vaultTokenAccountAddress, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  if (!await protocol.accountExists(connection, config.healthPlan.address)) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_health_plan:${config.healthPlan.planId}`,
      instructionName: "create_health_plan",
      args: {
        plan_id: config.healthPlan.planId,
        display_name: config.healthPlan.displayName,
        organization_ref: config.healthPlan.sponsorLabel,
        metadata_uri: config.healthPlan.metadataUri,
        sponsor: new PublicKey(config.roles.sponsor),
        sponsor_operator: new PublicKey(config.roles.sponsorOperator),
        claims_operator: new PublicKey(config.roles.claimsOperator),
        oracle_authority: new PublicKey(config.roles.oracleAuthority),
        membership_mode: config.healthPlan.membershipMode,
        membership_gate_kind: config.healthPlan.membershipGateKind,
        membership_gate_mint: protocol.ZERO_PUBKEY_KEY,
        membership_gate_min_amount: 0n,
        membership_invite_authority: config.healthPlan.membershipInviteAuthority
          ? new PublicKey(config.healthPlan.membershipInviteAuthority)
          : protocol.ZERO_PUBKEY_KEY,
        allowed_rail_mask: 0xffff,
        default_funding_priority: 0,
        oracle_policy_hash: sha256Bytes(`plan:${config.healthPlan.planId}:oracle-policy`),
        schema_binding_hash: sha256Bytes(`plan:${config.healthPlan.planId}:schema-binding`),
        compliance_baseline_hash: sha256Bytes(`plan:${config.healthPlan.planId}:compliance`),
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.reserveDomain.address },
        { pubkey: config.healthPlan.address, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  for (const series of [config.policySeries.event7, config.policySeries.travel30]) {
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
        metadata_uri: series.metadataUri,
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
        cycle_seconds: BigInt(30 * 86_400),
        terms_version: 1,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.healthPlan.address },
        { pubkey: series.address, isWritable: true },
        {
          pubkey: protocol.deriveSeriesReserveLedgerPda({
            policySeries: series.address,
            assetMint: series.assetMint,
          }),
          isWritable: true,
        },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  for (const line of Object.values(config.fundingLines)) {
    if (await protocol.accountExists(connection, line.address)) continue;
    const policySeries = line.lineId.startsWith("genesis-travel30")
      ? config.policySeries.travel30.address
      : config.policySeries.event7.address;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `open_funding_line:${line.lineId}`,
      instructionName: "open_funding_line",
      args: {
        line_id: line.lineId,
        policy_series: new PublicKey(policySeries),
        asset_mint: new PublicKey(config.settlementMint),
        line_type: line.lineType,
        funding_priority: line.fundingPriority,
        committed_amount: 0n,
        caps_hash: sha256Bytes(`funding-line:${line.lineId}:caps`),
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.healthPlan.address },
        { pubkey: domainAssetVault },
        { pubkey: domainAssetLedger, isWritable: true },
        { pubkey: line.address, isWritable: true },
        {
          pubkey: protocol.deriveFundingLineLedgerPda({
            fundingLine: line.address,
            assetMint: config.settlementMint,
          }),
          isWritable: true,
        },
        {
          pubkey: protocol.derivePlanReserveLedgerPda({
            healthPlan: config.healthPlan.address,
            assetMint: config.settlementMint,
          }),
          isWritable: true,
        },
        {
          pubkey: protocol.deriveSeriesReserveLedgerPda({
            policySeries,
            assetMint: config.settlementMint,
          }),
          isWritable: true,
        },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  if (!await protocol.accountExists(connection, config.liquidityPool.address)) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_liquidity_pool:${config.liquidityPool.poolId}`,
      instructionName: "create_liquidity_pool",
      args: {
        pool_id: config.liquidityPool.poolId,
        display_name: config.liquidityPool.displayName,
        curator: new PublicKey(config.roles.poolCurator),
        allocator: new PublicKey(config.roles.poolAllocator),
        sentinel: new PublicKey(config.roles.poolSentinel),
        deposit_asset_mint: new PublicKey(config.settlementMint),
        strategy_hash: sha256Bytes(`pool:${config.liquidityPool.poolId}:strategy`),
        allowed_exposure_hash: sha256Bytes(`pool:${config.liquidityPool.poolId}:allowed-exposure`),
        external_yield_adapter_hash: sha256Bytes(`pool:${config.liquidityPool.poolId}:yield-adapter`),
        fee_bps: 50,
        redemption_policy: config.liquidityPool.redemptionPolicy,
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.reserveDomain.address },
        { pubkey: domainAssetVault },
        { pubkey: config.liquidityPool.address, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  for (const capitalClass of [config.capitalClasses.senior, config.capitalClasses.junior]) {
    if (await protocol.accountExists(connection, capitalClass.address)) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `create_capital_class:${capitalClass.classId}`,
      instructionName: "create_capital_class",
      args: {
        class_id: capitalClass.classId,
        display_name: capitalClass.displayName,
        share_mint: protocol.ZERO_PUBKEY_KEY,
        priority: capitalClass.priority,
        impairment_rank: capitalClass.priority,
        restriction_mode: capitalClass.restrictionMode,
        redemption_terms_mode: 0,
        wrapper_metadata_hash: sha256Bytes(`capital-class:${capitalClass.classId}:wrapper`),
        permissioning_hash: sha256Bytes(`capital-class:${capitalClass.classId}:permissioning`),
        fee_bps: 0,
        min_lockup_seconds: capitalClass.minLockupSeconds,
        pause_flags: 0,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.liquidityPool.address },
        { pubkey: capitalClass.address, isWritable: true },
        {
          pubkey: protocol.derivePoolClassLedgerPda({
            capitalClass: capitalClass.address,
            assetMint: config.settlementMint,
          }),
          isWritable: true,
        },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const outcomeSchemaAddress = protocol.deriveOutcomeSchemaPda({
    schemaKeyHashHex: config.schema.keyHashHex,
  }).toBase58();
  const schemaDependencyLedger = protocol.deriveSchemaDependencyLedgerPda({
    schemaKeyHashHex: config.schema.keyHashHex,
  }).toBase58();

  let snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!currentValue(snapshot, outcomeSchemaAddress).schema) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "register_outcome_schema:genesis",
      instructionName: "register_outcome_schema",
      args: {
        schema_key_hash: [...Buffer.from(config.schema.keyHashHex, "hex")],
        schema_key: config.schema.key,
        version: config.schema.version,
        schema_hash: [...Buffer.from(schemaMetadataHashHex(config.schema.metadataLocalPath), "hex")],
        schema_family: protocol.SCHEMA_FAMILY_KERNEL,
        visibility: protocol.SCHEMA_VISIBILITY_PUBLIC,
        metadata_uri: config.schema.metadataUri,
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: outcomeSchemaAddress, isWritable: true },
        { pubkey: schemaDependencyLedger, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!currentValue(snapshot, outcomeSchemaAddress).schema?.verified) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "verify_outcome_schema:genesis",
      instructionName: "verify_outcome_schema",
      args: { verified: true },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: outcomeSchemaAddress, isWritable: true },
      ],
    });
  }

  const directGovernanceAuthority = await directProtocolGovernanceAuthority(protocol, connection);
  if (directGovernanceAuthority === governance.publicKey.toBase58()) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "backfill_schema_dependency_ledger:genesis",
      instructionName: "backfill_schema_dependency_ledger",
      args: {
        schema_key_hash: [...Buffer.from(config.schema.keyHashHex, "hex")],
        pool_rule_addresses: [new PublicKey(config.liquidityPool.address)],
      },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: outcomeSchemaAddress },
        { pubkey: schemaDependencyLedger, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("already in use")) {
        throw error;
      }
    });
  } else {
    console.log(
      `[genesis-live] skipping direct schema backfill because protocol governance authority is ${directGovernanceAuthority ?? "(unset)"} instead of ${governance.publicKey.toBase58()}; use governance proposal flow if a schema dependency backfill is still required.`,
    );
  }

  const oracleProfileAddress = protocol.deriveOracleProfilePda({
    oracle: config.roles.oracleAuthority,
  }).toBase58();
  const poolOraclePolicyAddress = protocol.derivePoolOraclePolicyPda({
    liquidityPool: config.liquidityPool.address,
  }).toBase58();
  const poolOracleApprovalAddress = protocol.derivePoolOracleApprovalPda({
    liquidityPool: config.liquidityPool.address,
    oracle: config.roles.oracleAuthority,
  }).toBase58();
  const poolOraclePermissionSetAddress = protocol.derivePoolOraclePermissionSetPda({
    liquidityPool: config.liquidityPool.address,
    oracle: config.roles.oracleAuthority,
  }).toBase58();

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!currentValue(snapshot, oracleProfileAddress).oracleProfile) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "register_oracle:genesis",
      instructionName: "register_oracle",
      args: {
        oracle: oracle.publicKey,
        oracle_type: protocol.ORACLE_TYPE_HEALTH_APP,
        display_name: "OmegaX Genesis Protect Oracle",
        legal_name: "OmegaX Genesis Protect Oracle Operator",
        website_url: "https://protocol.omegax.health",
        app_url: "https://protocol.omegax.health/oracles",
        logo_uri: "https://protocol.omegax.health/icon.png",
        webhook_url: "https://protocol.omegax.health/api/oracles/genesis-protect-acute",
        supported_schema_key_hashes: [[...Buffer.from(config.schema.keyHashHex, "hex")]],
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
      feePayer: oracle,
      label: "claim_oracle:genesis",
      instructionName: "claim_oracle",
      args: {},
      accounts: [
        { pubkey: oracle.publicKey, isSigner: true },
        { pubkey: oracleProfileAddress, isWritable: true },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!currentValue(snapshot, poolOraclePolicyAddress).poolOraclePolicy) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "set_pool_oracle_policy:genesis",
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
        { pubkey: config.liquidityPool.address },
        { pubkey: poolOraclePolicyAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!currentValue(snapshot, poolOracleApprovalAddress).poolOracleApproval?.active) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "set_pool_oracle:genesis",
      instructionName: "set_pool_oracle",
      args: { active: true },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.liquidityPool.address },
        { pubkey: oracleProfileAddress },
        { pubkey: poolOracleApprovalAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  if (!currentValue(snapshot, poolOraclePermissionSetAddress).poolOraclePermissionSet) {
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: "set_pool_oracle_permissions:genesis",
      instructionName: "set_pool_oracle_permissions",
      args: { permissions: 7 },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: config.liquidityPool.address },
        { pubkey: oracleProfileAddress },
        { pubkey: poolOracleApprovalAddress },
        { pubkey: poolOraclePermissionSetAddress, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  const classLedgerFor = (capitalClassAddress: string) => protocol.derivePoolClassLedgerPda({
    capitalClass: capitalClassAddress,
    assetMint: config.settlementMint,
  }).toBase58();
  const seriesReserveLedgerFor = (policySeriesAddress: string) => protocol.deriveSeriesReserveLedgerPda({
    policySeries: policySeriesAddress,
    assetMint: config.settlementMint,
  }).toBase58();
  const fundingLineLedgerFor = (fundingLineAddress: string) => protocol.deriveFundingLineLedgerPda({
    fundingLine: fundingLineAddress,
    assetMint: config.settlementMint,
  }).toBase58();

  for (const allocation of [
    {
      ...config.allocations.event7Junior,
      capitalClass: config.capitalClasses.junior.address,
      policySeries: config.policySeries.event7.address,
      fundingLine: config.fundingLines.event7Liquidity.address,
    },
    {
      ...config.allocations.travel30Senior,
      capitalClass: config.capitalClasses.senior.address,
      policySeries: config.policySeries.travel30.address,
      fundingLine: config.fundingLines.travel30Liquidity.address,
    },
    {
      ...config.allocations.travel30Junior,
      capitalClass: config.capitalClasses.junior.address,
      policySeries: config.policySeries.travel30.address,
      fundingLine: config.fundingLines.travel30Liquidity.address,
    },
  ]) {
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
          { pubkey: config.liquidityPool.address },
          { pubkey: allocation.capitalClass },
          { pubkey: config.healthPlan.address },
          { pubkey: allocation.fundingLine },
          { pubkey: allocation.address, isWritable: true },
          {
            pubkey: protocol.deriveAllocationLedgerPda({
              allocationPosition: allocation.address,
              assetMint: config.settlementMint,
            }),
            isWritable: true,
          },
          { pubkey: SystemProgram.programId },
        ],
      });
    }
  }

  if (config.fundingAmounts.event7SponsorBudget > 0n) {
    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const currentSponsorBudget = currentValue(snapshot, config.fundingLines.event7Sponsor.address).fundingLine;
    const currentAmount = protocol.toBigIntAmount(currentSponsorBudget?.fundedAmount);
    if (currentAmount < config.fundingAmounts.event7SponsorBudget) {
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: "fund_sponsor_budget:event7",
        instructionName: "fund_sponsor_budget",
        args: { amount: config.fundingAmounts.event7SponsorBudget - currentAmount },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true },
          { pubkey: governanceAddress },
          { pubkey: config.healthPlan.address },
          { pubkey: domainAssetVault, isWritable: true },
          { pubkey: domainAssetLedger, isWritable: true },
          { pubkey: config.fundingLines.event7Sponsor.address, isWritable: true },
          { pubkey: fundingLineLedgerFor(config.fundingLines.event7Sponsor.address), isWritable: true },
          { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: config.healthPlan.address, assetMint: config.settlementMint }), isWritable: true },
          { pubkey: seriesReserveLedgerFor(config.policySeries.event7.address), isWritable: true },
          { pubkey: requiredPublicKeyEnv("OMEGAX_GENESIS_GOVERNANCE_SETTLEMENT_SOURCE_TOKEN_ACCOUNT"), isWritable: true },
          { pubkey: config.settlementMint },
          { pubkey: vaultTokenAccountAddress, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID },
        ],
      });
    }
  }

  for (const premium of [
    {
      label: "event7",
      amount: config.fundingAmounts.event7Premium,
      fundingLine: config.fundingLines.event7Premium.address,
      policySeries: config.policySeries.event7.address,
    },
    {
      label: "travel30",
      amount: config.fundingAmounts.travel30Premium,
      fundingLine: config.fundingLines.travel30Premium.address,
      policySeries: config.policySeries.travel30.address,
    },
  ]) {
    if (premium.amount <= 0n) continue;
    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const currentPremium = currentValue(snapshot, premium.fundingLine).fundingLine;
    const currentAmount = protocol.toBigIntAmount(currentPremium?.fundedAmount);
    if (currentAmount >= premium.amount) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `record_premium_payment:${premium.label}`,
      instructionName: "record_premium_payment",
      args: { amount: premium.amount - currentAmount },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: config.healthPlan.address },
        { pubkey: domainAssetVault, isWritable: true },
        { pubkey: domainAssetLedger, isWritable: true },
        { pubkey: premium.fundingLine, isWritable: true },
        { pubkey: fundingLineLedgerFor(premium.fundingLine), isWritable: true },
        { pubkey: protocol.derivePlanReserveLedgerPda({ healthPlan: config.healthPlan.address, assetMint: config.settlementMint }), isWritable: true },
        { pubkey: seriesReserveLedgerFor(premium.policySeries), isWritable: true },
        { pubkey: requiredPublicKeyEnv("OMEGAX_GENESIS_GOVERNANCE_SETTLEMENT_SOURCE_TOKEN_ACCOUNT"), isWritable: true },
        { pubkey: config.settlementMint },
        { pubkey: vaultTokenAccountAddress, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID },
      ],
    });
  }

  for (const lpSeed of [
    {
      label: "senior",
      keypair: seniorLp,
      amount: config.capitalClasses.senior.depositAmount,
      capitalClass: config.capitalClasses.senior.address,
    },
    {
      label: "junior",
      keypair: juniorLp,
      amount: config.capitalClasses.junior.depositAmount,
      capitalClass: config.capitalClasses.junior.address,
    },
  ]) {
    if (!lpSeed.keypair || lpSeed.amount <= 0n) continue;
    const lpPosition = protocol.deriveLpPositionPda({
      capitalClass: lpSeed.capitalClass,
      owner: lpSeed.keypair.publicKey,
    }).toBase58();
    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const currentLp = currentValue(snapshot, lpPosition).lpPosition;
    const currentBasis = protocol.toBigIntAmount(currentLp?.subscriptionBasis);
    if (currentBasis >= lpSeed.amount) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: lpSeed.keypair,
      label: `deposit_into_capital_class:${lpSeed.label}`,
      instructionName: "deposit_into_capital_class",
      args: {
        amount: lpSeed.amount - currentBasis,
        shares: 0n,
      },
      accounts: [
        { pubkey: lpSeed.keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: domainAssetVault, isWritable: true },
        { pubkey: domainAssetLedger, isWritable: true },
        { pubkey: config.liquidityPool.address, isWritable: true },
        { pubkey: lpSeed.capitalClass, isWritable: true },
        { pubkey: classLedgerFor(lpSeed.capitalClass), isWritable: true },
        { pubkey: lpPosition, isWritable: true },
        {
          pubkey: requiredPublicKeyEnv(
            lpSeed.label === "senior"
              ? "OMEGAX_GENESIS_SENIOR_LP_SETTLEMENT_SOURCE_TOKEN_ACCOUNT"
              : "OMEGAX_GENESIS_JUNIOR_LP_SETTLEMENT_SOURCE_TOKEN_ACCOUNT",
          ),
          isWritable: true,
        },
        { pubkey: config.settlementMint },
        { pubkey: vaultTokenAccountAddress, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID },
        { pubkey: SystemProgram.programId },
      ],
    });
  }

  for (const allocation of [
    {
      label: "event7-junior",
      amount: config.allocations.event7Junior.allocationAmount,
      address: config.allocations.event7Junior.address,
      capitalClass: config.capitalClasses.junior.address,
      fundingLine: config.fundingLines.event7Liquidity.address,
    },
    {
      label: "travel30-senior",
      amount: config.allocations.travel30Senior.allocationAmount,
      address: config.allocations.travel30Senior.address,
      capitalClass: config.capitalClasses.senior.address,
      fundingLine: config.fundingLines.travel30Liquidity.address,
    },
    {
      label: "travel30-junior",
      amount: config.allocations.travel30Junior.allocationAmount,
      address: config.allocations.travel30Junior.address,
      capitalClass: config.capitalClasses.junior.address,
      fundingLine: config.fundingLines.travel30Liquidity.address,
    },
  ]) {
    if (allocation.amount <= 0n) continue;
    snapshot = await protocol.loadProtocolConsoleSnapshot(connection);
    const currentAllocation = currentValue(snapshot, allocation.address).allocationPosition;
    const currentAmount = protocol.toBigIntAmount(currentAllocation?.allocatedAmount);
    if (currentAmount >= allocation.amount) continue;
    await sendProtocolInstruction({
      protocol,
      connection,
      feePayer: governance,
      label: `allocate_capital:${allocation.label}`,
      instructionName: "allocate_capital",
      args: { amount: allocation.amount - currentAmount },
      accounts: [
        { pubkey: governance.publicKey, isSigner: true },
        { pubkey: governanceAddress },
        { pubkey: config.liquidityPool.address, isWritable: true },
        { pubkey: allocation.capitalClass, isWritable: true },
        { pubkey: classLedgerFor(allocation.capitalClass), isWritable: true },
        { pubkey: allocation.fundingLine },
        { pubkey: allocation.address, isWritable: true },
        {
          pubkey: protocol.deriveAllocationLedgerPda({
            allocationPosition: allocation.address,
            assetMint: config.settlementMint,
          }),
          isWritable: true,
        },
      ],
    });
  }

  if (config.governanceConfigAddress) {
    const protocolConfig = await protocol.fetchProtocolConfig({ connection });
    if (!protocolConfig) {
      throw new Error("Protocol governance config could not be loaded after Genesis live bootstrap.");
    }
    if (protocolConfig.governanceAuthority !== config.governanceConfigAddress) {
      if (protocolConfig.governanceAuthority !== governance.publicKey.toBase58()) {
        throw new Error(
          `Protocol governance authority is ${protocolConfig.governanceAuthority}, but Genesis live bootstrap can only hand off from ${governance.publicKey.toBase58()} to ${config.governanceConfigAddress}.`,
        );
      }
      await sendProtocolInstruction({
        protocol,
        connection,
        feePayer: governance,
        label: "rotate_protocol_governance_authority",
        instructionName: "rotate_protocol_governance_authority",
        args: {
          new_governance_authority: new PublicKey(config.governanceConfigAddress),
        },
        accounts: [
          { pubkey: governance.publicKey, isSigner: true, isWritable: true },
          { pubkey: governanceAddress, isWritable: true },
        ],
      });
    }
  }

  const finalSnapshot = await protocol.loadProtocolConsoleSnapshot(connection);
  console.log(stringifyJson({
    protocolGovernance: finalSnapshot.protocolGovernance?.address ?? null,
    reserveDomain: config.reserveDomain.address,
    healthPlan: config.healthPlan.address,
    policySeries: [
      config.policySeries.event7.address,
      config.policySeries.travel30.address,
    ],
    fundingLines: [
      config.fundingLines.event7Sponsor.address,
      config.fundingLines.event7Premium.address,
      config.fundingLines.event7Liquidity.address,
      config.fundingLines.travel30Premium.address,
      config.fundingLines.travel30Liquidity.address,
    ],
    liquidityPool: config.liquidityPool.address,
    capitalClasses: [
      config.capitalClasses.senior.address,
      config.capitalClasses.junior.address,
    ],
    allocations: [
      config.allocations.event7Junior.address,
      config.allocations.travel30Senior.address,
      config.allocations.travel30Junior.address,
    ],
    schemaKeyHashHex: config.schema.keyHashHex,
    oracleProfile: oracleProfileAddress,
  }));
}

await main();
