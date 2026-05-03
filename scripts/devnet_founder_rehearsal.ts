// SPDX-License-Identifier: AGPL-3.0-or-later

import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  getMint,
  MINT_SIZE,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import contractModule from "../frontend/lib/generated/protocol-contract.ts";
import { STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX } from "./devnet_governance_smoke_helpers.ts";
import {
  CANONICAL_FOUNDER_REHEARSAL_IDS,
  FOUNDER_ASSET_RAILS,
  type FounderAssetRail,
  type FounderAssetSymbol,
  assertCanonicalAccountMatches,
  assertMaySend,
  assertProtocolGovernanceAuthorityMatches,
  chainInputsFromSnapshot,
  evaluateChainActuarialGate,
  fundingLineIdForAsset,
  parseRehearsalArgs,
  rawAmountForUsd,
  redactEvidence,
  requireClassicTokenProgramId,
  sha256Hex,
} from "./support/devnet_founder_rehearsal_core.ts";
import { loadEnvFile } from "./support/load_env_file.ts";
import { wrapConnectionWithRpcRetry } from "./support/rpc_retry.ts";
import { keypairFromFile } from "./support/script_helpers.ts";

type ProtocolModule = typeof import("../frontend/lib/protocol.ts");
const { PROTOCOL_PROGRAM_ID } =
  contractModule as typeof import("../frontend/lib/generated/protocol-contract.ts");

type EvidenceTransaction = {
  label: string;
  signature: string;
  slot: number;
  signer: string;
  accounts: string[];
  postStateHash: string;
};

type NegativeSimulation = {
  label: string;
  expectedFailure: string;
  err: unknown;
  logs: string[];
};

type AssetRuntime = FounderAssetRail & {
  mint: PublicKey;
  depositAmount: bigint;
  claimAmount: bigint;
  fundingLineId: string;
  fundingLine: PublicKey;
  reserveAssetRail: PublicKey;
  vaultTokenAccount: PublicKey;
};

type RehearsalContext = {
  protocol: ProtocolModule;
  connection: Connection;
  governance: Keypair;
  oracle: Keypair;
  protocolGovernanceAuthority: PublicKey | null;
  mode: "plan" | "execute";
  resume: boolean;
  evidenceDir: string;
  transactions: EvidenceTransaction[];
  negativeSimulations: NegativeSimulation[];
};

type MemberSet = {
  pending: Keypair;
  refund: Keypair;
  activate: Keypair;
};

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const LOCAL_REHEARSAL_DIR = resolve(
  homedir(),
  ".config/solana/omegax-devnet/founder-rehearsal",
);
const GOVERNANCE_KEYPAIR_PATH = resolve(homedir(), ".config/solana/id.json");
const ROLE_MIN_LAMPORTS = 150_000_000n;
const GOVERNANCE_MIN_LAMPORTS = 2n * BigInt(LAMPORTS_PER_SOL);
const FOUNDER_DEPOSIT_USD = 159;
const CLAIM_REHEARSAL_USD = 25;
const TERMS_HASH = sha256Hex("founder-travel30-devnet-rehearsal-terms-v1");

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

async function importFreshProtocol(): Promise<ProtocolModule> {
  const url = `${pathToFileURL(resolve(process.cwd(), "frontend/lib/protocol.ts")).href}?v=${Date.now()}`;
  const module = (await import(url)) as {
    default?: ProtocolModule;
  } & ProtocolModule;
  return (module.default ?? module) as ProtocolModule;
}

function loadLocalEnv(): void {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), "frontend/.env.local"));
}

function keypairPath(label: string): string {
  return resolve(LOCAL_REHEARSAL_DIR, `${label}.json`);
}

function ensureLocalKeypair(label: string, mode: "plan" | "execute"): Keypair {
  assertMaySend(mode);
  const path = keypairPath(label);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    return keypairFromFile(path);
  }
  const keypair = Keypair.generate();
  writeFileSync(path, `${JSON.stringify([...keypair.secretKey])}\n`);
  return keypair;
}

function loadGovernanceKeypair(mode: "plan" | "execute"): Keypair | null {
  if (mode !== "execute") return null;
  const configuredPath =
    process.env.SOLANA_KEYPAIR?.trim() || GOVERNANCE_KEYPAIR_PATH;
  return keypairFromFile(configuredPath);
}

function configuredGovernanceControlAddress(): string | null {
  const raw =
    process.env.GOVERNANCE_CONFIG ||
    process.env.NEXT_PUBLIC_GOVERNANCE_CONFIG ||
    "";
  const normalized = raw.trim();
  if (!normalized) return null;
  return new PublicKey(normalized).toBase58();
}

function protocolGovernanceSource(
  ctx: RehearsalContext,
  governanceAuthority: string,
): "local" | "configured" {
  return assertProtocolGovernanceAuthorityMatches({
    actualGovernanceAuthority: governanceAuthority,
    localOperator: ctx.governance.publicKey.toBase58(),
    configuredGovernanceAuthority: configuredGovernanceControlAddress(),
  });
}

async function preflightProtocolGovernance(
  ctx: RehearsalContext,
): Promise<void> {
  const snapshot = await ctx.protocol.loadProtocolConsoleSnapshot(
    ctx.connection,
  );
  if (!snapshot.protocolGovernance) {
    ctx.protocolGovernanceAuthority = ctx.governance.publicKey;
    return;
  }
  const source = protocolGovernanceSource(
    ctx,
    snapshot.protocolGovernance.governanceAuthority,
  );
  ctx.protocolGovernanceAuthority = new PublicKey(
    snapshot.protocolGovernance.governanceAuthority,
  );
  if (source === "configured") {
    console.log(
      `[founder-rehearsal] protocol_governance authority is configured governance ${ctx.protocolGovernanceAuthority.toBase58()}; operator-scoped launch controls will be used where already delegated.`,
    );
  }
}

function requireLocalProtocolGovernanceAuthority(
  ctx: RehearsalContext,
  label: string,
): void {
  const authority = ctx.protocolGovernanceAuthority;
  if (!authority || authority.equals(ctx.governance.publicKey)) return;
  throw new Error(
    `${label} requires the protocol governance signer ${authority.toBase58()}, but this runner only has the operator signer ${ctx.governance.publicKey.toBase58()}. Execute through governance or bootstrap the required account before rerunning.`,
  );
}

async function ensureFeeBalance(
  ctx: RehearsalContext,
  wallet: PublicKey,
  label: string,
  minimumLamports = ROLE_MIN_LAMPORTS,
): Promise<void> {
  const current = BigInt(await ctx.connection.getBalance(wallet, "confirmed"));
  if (current >= minimumLamports) return;
  assertMaySend(ctx.mode);
  const delta = Number(minimumLamports - current);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: ctx.governance.publicKey,
      toPubkey: wallet,
      lamports: delta,
    }),
  );
  await sendSignedTransaction(ctx, {
    label: `fund-fees:${label}`,
    tx,
    signer: ctx.governance,
    signers: [ctx.governance],
  });
}

async function ensureGovernanceHasDevnetSol(
  ctx: RehearsalContext,
): Promise<void> {
  const current = BigInt(
    await ctx.connection.getBalance(ctx.governance.publicKey, "confirmed"),
  );
  if (current >= GOVERNANCE_MIN_LAMPORTS) return;
  assertMaySend(ctx.mode);
  const signature = await ctx.connection.requestAirdrop(
    ctx.governance.publicKey,
    Number(GOVERNANCE_MIN_LAMPORTS - current),
  );
  const latest = await ctx.connection.getLatestBlockhash("confirmed");
  await ctx.connection.confirmTransaction(
    { ...latest, signature },
    "confirmed",
  );
  ctx.transactions.push({
    label: "airdrop:governance-fees",
    signature,
    slot: latest.lastValidBlockHeight,
    signer: ctx.governance.publicKey.toBase58(),
    accounts: [ctx.governance.publicKey.toBase58()],
    postStateHash: await postStateHash(ctx.connection, [
      ctx.governance.publicKey,
    ]),
  });
}

async function sendSignedTransaction(
  ctx: RehearsalContext,
  params: {
    label: string;
    tx: Transaction;
    signer: Keypair;
    signers: Keypair[];
  },
): Promise<string> {
  assertMaySend(ctx.mode);
  const latest = await ctx.connection.getLatestBlockhash("confirmed");
  params.tx.feePayer = params.tx.feePayer ?? params.signer.publicKey;
  params.tx.recentBlockhash = latest.blockhash;
  const uniqueSigners = uniqueKeypairs(params.signers);
  params.tx.sign(...uniqueSigners);
  const signature = await ctx.connection.sendRawTransaction(
    params.tx.serialize(),
    {
      maxRetries: 5,
      skipPreflight: false,
    },
  );
  const confirmation = await ctx.connection.confirmTransaction(
    { ...latest, signature },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(
      `${params.label} failed during confirmation: ${JSON.stringify(confirmation.value.err)}`,
    );
  }
  const accounts = transactionAccounts(params.tx);
  ctx.transactions.push({
    label: params.label,
    signature,
    slot: confirmation.context.slot,
    signer: params.signer.publicKey.toBase58(),
    accounts: accounts.map((account) => account.toBase58()),
    postStateHash: await postStateHash(ctx.connection, accounts),
  });
  console.log(`[founder-rehearsal] ${params.label}: ${signature}`);
  return signature;
}

function uniqueKeypairs(signers: Keypair[]): Keypair[] {
  const seen = new Set<string>();
  return signers.filter((signer) => {
    const address = signer.publicKey.toBase58();
    if (seen.has(address)) return false;
    seen.add(address);
    return true;
  });
}

function transactionAccounts(tx: Transaction): PublicKey[] {
  const addresses = new Map<string, PublicKey>();
  if (tx.feePayer) addresses.set(tx.feePayer.toBase58(), tx.feePayer);
  for (const ix of tx.instructions) {
    addresses.set(ix.programId.toBase58(), ix.programId);
    for (const key of ix.keys) addresses.set(key.pubkey.toBase58(), key.pubkey);
  }
  return [...addresses.values()];
}

async function postStateHash(
  connection: Connection,
  accounts: PublicKey[],
): Promise<string> {
  const unique = [
    ...new Map(
      accounts.map((account) => [account.toBase58(), account]),
    ).values(),
  ];
  const infos = await connection.getMultipleAccountsInfo(unique, "confirmed");
  const hash = Buffer.concat(
    unique.map((account, index) => {
      const info = infos[index];
      const digest = sha256Hex(
        info?.data ? Buffer.from(info.data).toString("hex") : "missing",
      );
      return Buffer.from(
        `${account.toBase58()}:${info?.owner.toBase58() ?? "missing"}:${info?.lamports ?? 0}:${digest}\n`,
      );
    }),
  );
  return sha256Hex(hash.toString("hex"));
}

async function buildAssets(ctx: RehearsalContext): Promise<AssetRuntime[]> {
  const assets: AssetRuntime[] = [];
  for (const rail of FOUNDER_ASSET_RAILS) {
    const mint = rail.isNativeSol
      ? NATIVE_MINT
      : await ensureControlledClassicMint(ctx, rail);
    const depositAmount = rawAmountForUsd({
      usd: FOUNDER_DEPOSIT_USD,
      decimals: rail.decimals,
      priceUsd1e8: rail.priceUsd1e8,
    });
    const claimAmount = rawAmountForUsd({
      usd: CLAIM_REHEARSAL_USD,
      decimals: rail.decimals,
      priceUsd1e8: rail.priceUsd1e8,
    });
    const reserveDomain = ctx.protocol.deriveReserveDomainPda({
      domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
    });
    const healthPlan = ctx.protocol.deriveHealthPlanPda({
      reserveDomain,
      planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
    });
    const fundingLineId = fundingLineIdForAsset(rail.symbol);
    const fundingLine = ctx.protocol.deriveFundingLinePda({
      healthPlan,
      lineId: fundingLineId,
    });
    assets.push({
      ...rail,
      mint,
      depositAmount,
      claimAmount,
      fundingLineId,
      fundingLine,
      reserveAssetRail: ctx.protocol.deriveReserveAssetRailPda({
        reserveDomain,
        assetMint: mint,
      }),
      vaultTokenAccount: ctx.protocol.deriveDomainAssetVaultTokenAccountPda({
        reserveDomain,
        assetMint: mint,
      }),
    });
  }
  return assets;
}

async function ensureControlledClassicMint(
  ctx: RehearsalContext,
  asset: FounderAssetRail,
): Promise<PublicKey> {
  const envMint = process.env[asset.mintEnv]?.trim();
  if (envMint) {
    const mint = new PublicKey(envMint);
    const info = await getMint(
      ctx.connection,
      mint,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
    if (info.decimals !== asset.decimals) {
      throw new Error(
        `${asset.symbol} mint ${mint.toBase58()} has ${info.decimals} decimals; expected ${asset.decimals}.`,
      );
    }
    requireClassicTokenProgramId(TOKEN_PROGRAM_ID);
    return mint;
  }
  if (ctx.mode !== "execute") {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("founder-rehearsal-plan-mint"), Buffer.from(asset.symbol)],
      new PublicKey(PROTOCOL_PROGRAM_ID),
    )[0];
  }
  const mintKeypair = ensureLocalKeypair(
    asset.localMintLabel ?? `${asset.symbol.toLowerCase()}-mint`,
    ctx.mode,
  );
  const existing = await ctx.connection.getAccountInfo(
    mintKeypair.publicKey,
    "confirmed",
  );
  if (existing) {
    if (!existing.owner.equals(TOKEN_PROGRAM_ID)) {
      throw new Error(
        `${asset.symbol} controlled mint exists but is not owned by classic SPL Token.`,
      );
    }
    const info = await getMint(
      ctx.connection,
      mintKeypair.publicKey,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
    if (info.decimals !== asset.decimals) {
      throw new Error(
        `${asset.symbol} controlled mint decimals mismatch: expected ${asset.decimals}, got ${info.decimals}.`,
      );
    }
    return mintKeypair.publicKey;
  }
  const rent = await ctx.connection.getMinimumBalanceForRentExemption(
    MINT_SIZE,
    "confirmed",
  );
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: ctx.governance.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: rent,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      asset.decimals,
      ctx.governance.publicKey,
      null,
      TOKEN_PROGRAM_ID,
    ),
  );
  await sendSignedTransaction(ctx, {
    label: `create-classic-mint:${asset.symbol}`,
    tx,
    signer: ctx.governance,
    signers: [ctx.governance, mintKeypair],
  });
  return mintKeypair.publicKey;
}

async function ensureAta(
  ctx: RehearsalContext,
  owner: PublicKey,
  mint: PublicKey,
  label: string,
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    true,
    TOKEN_PROGRAM_ID,
  );
  const existing = await ctx.connection.getAccountInfo(ata, "confirmed");
  if (existing) return ata;
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      ctx.governance.publicKey,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
    ),
  );
  await sendSignedTransaction(ctx, {
    label: `create-ata:${label}`,
    tx,
    signer: ctx.governance,
    signers: [ctx.governance],
  });
  return ata;
}

async function mintOrWrapForMember(
  ctx: RehearsalContext,
  asset: AssetRuntime,
  owner: PublicKey,
  amount: bigint,
  label: string,
): Promise<PublicKey> {
  const ata = await ensureAta(
    ctx,
    owner,
    asset.mint,
    `${asset.symbol}:${label}`,
  );
  if (asset.isNativeSol) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: ctx.governance.publicKey,
        toPubkey: ata,
        lamports: Number(amount),
      }),
      createSyncNativeInstruction(ata),
    );
    await sendSignedTransaction(ctx, {
      label: `wrap-sol:${asset.symbol}:${label}`,
      tx,
      signer: ctx.governance,
      signers: [ctx.governance],
    });
    return ata;
  }
  const tx = new Transaction().add(
    createMintToInstruction(
      asset.mint,
      ata,
      ctx.governance.publicKey,
      amount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );
  await sendSignedTransaction(ctx, {
    label: `mint-payment:${asset.symbol}:${label}`,
    tx,
    signer: ctx.governance,
    signers: [ctx.governance],
  });
  return ata;
}

async function ensureProtocolGraph(
  ctx: RehearsalContext,
  assets: AssetRuntime[],
): Promise<void> {
  const protocol = ctx.protocol;
  const reserveDomain = protocol.deriveReserveDomainPda({
    domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
  });
  const healthPlan = protocol.deriveHealthPlanPda({
    reserveDomain,
    planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
  });
  const policySeries = protocol.derivePolicySeriesPda({
    healthPlan,
    seriesId: CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId,
  });
  const usdc = requireAsset(assets, "USDC");
  let snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);

  const governanceAddress = protocol.deriveProtocolGovernancePda();
  if (!snapshot.protocolGovernance) {
    const tx = protocol.buildInitializeProtocolGovernanceTx({
      governanceAuthority: ctx.governance.publicKey,
      protocolFeeBps: 0,
      emergencyPaused: false,
      recentBlockhash: "11111111111111111111111111111111",
    });
    await sendSignedTransaction(ctx, {
      label: "initialize_protocol_governance",
      tx,
      signer: ctx.governance,
      signers: [ctx.governance],
    });
    snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  }
  if (snapshot.protocolGovernance) {
    protocolGovernanceSource(
      ctx,
      snapshot.protocolGovernance.governanceAuthority,
    );
    ctx.protocolGovernanceAuthority = new PublicKey(
      snapshot.protocolGovernance.governanceAuthority,
    );
  }

  const domain = snapshot.reserveDomains.find(
    (row) => row.address === reserveDomain.toBase58(),
  );
  assertCanonicalAccountMatches(
    "reserve_domain:open-health-usdc",
    domain as Record<string, unknown> | null,
    {
      domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
      settlementMode: 0,
      active: true,
    },
  );
  if (!domain) {
    requireLocalProtocolGovernanceAuthority(
      ctx,
      `create_reserve_domain:${CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId}`,
    );
    await sendSignedTransaction(ctx, {
      label: `create_reserve_domain:${CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId}`,
      tx: protocol.buildCreateReserveDomainTx({
        authority: ctx.governance.publicKey,
        domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
        displayName: "Open onchain reserve domain",
        domainAdmin: ctx.governance.publicKey,
        settlementMode: 0,
        allowedRailMask: 0xffff,
        pauseFlags: 0,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const plan = snapshot.healthPlans.find(
    (row) => row.address === healthPlan.toBase58(),
  );
  assertCanonicalAccountMatches(
    "health_plan:genesis-protect-acute-v1",
    plan as Record<string, unknown> | null,
    {
      planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
      reserveDomain: reserveDomain.toBase58(),
      active: true,
    },
  );
  if (!plan) {
    const tx = protocol.buildProtocolTransactionFromInstruction({
      feePayer: ctx.governance.publicKey,
      recentBlockhash: "11111111111111111111111111111111",
      instructionName: "create_health_plan",
      args: {
        plan_id: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
        display_name: "Genesis Protect Acute",
        organization_ref: "OmegaX Health",
        metadata_uri:
          "https://protocol.omegax.health/plans/genesis-protect-acute-v1",
        sponsor: ctx.governance.publicKey,
        sponsor_operator: ctx.governance.publicKey,
        claims_operator: ctx.governance.publicKey,
        oracle_authority: ctx.oracle.publicKey,
        membership_mode: protocol.MEMBERSHIP_MODE_OPEN,
        membership_gate_kind: protocol.MEMBERSHIP_GATE_KIND_OPEN,
        membership_gate_mint: protocol.ZERO_PUBKEY_KEY,
        membership_gate_min_amount: 0n,
        membership_invite_authority: protocol.ZERO_PUBKEY_KEY,
        allowed_rail_mask: 0xffff,
        default_funding_priority: 0,
        oracle_policy_hash: [
          ...Buffer.from(sha256Hex("plan:genesis:oracle-policy"), "hex"),
        ],
        schema_binding_hash: [
          ...Buffer.from(sha256Hex("plan:genesis:schema-binding"), "hex"),
        ],
        compliance_baseline_hash: [
          ...Buffer.from(sha256Hex("plan:genesis:compliance"), "hex"),
        ],
        pause_flags: 0,
      },
      accounts: [
        { pubkey: ctx.governance.publicKey, isSigner: true, isWritable: true },
        { pubkey: governanceAddress },
        { pubkey: reserveDomain },
        { pubkey: healthPlan, isWritable: true },
        { pubkey: SystemProgram.programId },
      ],
    });
    await sendSignedTransaction(ctx, {
      label: `create_health_plan:${CANONICAL_FOUNDER_REHEARSAL_IDS.planId}`,
      tx,
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }

  for (const asset of assets) {
    await ensureDomainAssetVault(ctx, reserveDomain, asset);
    await ensureReserveAssetRail(ctx, reserveDomain, asset);
  }

  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const series = snapshot.policySeries.find(
    (row) => row.address === policySeries.toBase58(),
  );
  assertCanonicalAccountMatches(
    "policy_series:genesis-travel-30-v1",
    series as Record<string, unknown> | null,
    {
      seriesId: CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId,
      healthPlan: healthPlan.toBase58(),
      status: protocol.SERIES_STATUS_ACTIVE,
    },
  );
  if (!series) {
    await sendSignedTransaction(ctx, {
      label: `create_policy_series:${CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId}`,
      tx: protocol.buildCreatePolicySeriesTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        assetMint: usdc.mint,
        seriesId: CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId,
        displayName: "Genesis Travel 30",
        metadataUri:
          "https://protocol.omegax.health/products/genesis-travel-30-v1.json",
        mode: protocol.SERIES_MODE_PROTECTION,
        status: protocol.SERIES_STATUS_ACTIVE,
        adjudicationMode: 0,
        termsHashHex: sha256Hex("genesis-travel-30-terms-v1"),
        pricingHashHex: sha256Hex("genesis-travel-30-pricing-v1"),
        payoutHashHex: sha256Hex("genesis-travel-30-payout-v1"),
        reserveModelHashHex: sha256Hex("genesis-travel-30-waterfall-v1"),
        evidenceRequirementsHashHex: sha256Hex("genesis-travel-30-evidence-v1"),
        comparabilityHashHex: STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX,
        policyOverridesHashHex: sha256Hex("genesis-travel-30-overrides-v1"),
        cycleSeconds: 30n * 86_400n,
        termsVersion: 1,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }

  for (const asset of assets) {
    await ensureFundingLine(
      ctx,
      reserveDomain,
      healthPlan,
      policySeries,
      asset,
    );
  }

  await ensureLiquidityPool(ctx, reserveDomain, usdc);
  await ensureOracleAndSchema(ctx);
  await ensureCommitmentCampaign(
    ctx,
    reserveDomain,
    healthPlan,
    policySeries,
    assets,
  );
}

async function ensureDomainAssetVault(
  ctx: RehearsalContext,
  reserveDomain: PublicKey,
  asset: AssetRuntime,
): Promise<void> {
  const protocol = ctx.protocol;
  const address = protocol.deriveDomainAssetVaultPda({
    reserveDomain,
    assetMint: asset.mint,
  });
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existing = snapshot.domainAssetVaults.find(
    (row) => row.address === address.toBase58(),
  );
  assertCanonicalAccountMatches(
    `domain_asset_vault:${asset.symbol}`,
    existing as Record<string, unknown> | null,
    {
      reserveDomain: reserveDomain.toBase58(),
      assetMint: asset.mint.toBase58(),
    },
  );
  if (existing) return;
  await sendSignedTransaction(ctx, {
    label: `create_domain_asset_vault:${asset.symbol}`,
    tx: protocol.buildCreateDomainAssetVaultTx({
      authority: ctx.governance.publicKey,
      reserveDomainAddress: reserveDomain,
      assetMint: asset.mint,
      tokenProgramId: TOKEN_PROGRAM_ID,
      recentBlockhash: "11111111111111111111111111111111",
    }),
    signer: ctx.governance,
    signers: [ctx.governance],
  });
}

async function ensureReserveAssetRail(
  ctx: RehearsalContext,
  reserveDomain: PublicKey,
  asset: AssetRuntime,
): Promise<void> {
  const protocol = ctx.protocol;
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existing = snapshot.reserveAssetRails.find(
    (row) => row.address === asset.reserveAssetRail.toBase58(),
  );
  assertCanonicalAccountMatches(
    `reserve_asset_rail:${asset.symbol}`,
    existing as Record<string, unknown> | null,
    {
      reserveDomain: reserveDomain.toBase58(),
      assetMint: asset.mint.toBase58(),
      payoutPriority: asset.payoutPriority,
      haircutBps: asset.haircutBps,
      maxExposureBps: asset.maxExposureBps,
      capacityEnabled: asset.capacityEnabled,
      active: true,
    },
  );
  if (!existing) {
    await sendSignedTransaction(ctx, {
      label: `configure_reserve_asset_rail:${asset.symbol}`,
      tx: protocol.buildConfigureReserveAssetRailTx({
        authority: ctx.governance.publicKey,
        reserveDomainAddress: reserveDomain,
        assetMint: asset.mint,
        assetSymbol: asset.symbol,
        oracleAuthority: ctx.governance.publicKey,
        role: asset.role,
        payoutPriority: asset.payoutPriority,
        oracleSource: protocol.RESERVE_ORACLE_SOURCE_GOVERNANCE_ATTESTED,
        oracleFeedIdHex: sha256Hex(
          `devnet-rehearsal-price-feed:${asset.symbol}`,
        ),
        maxStalenessSeconds: 7n * 86_400n,
        haircutBps: asset.haircutBps,
        maxExposureBps: asset.maxExposureBps,
        depositEnabled: asset.depositEnabled,
        payoutEnabled: asset.payoutEnabled,
        capacityEnabled: asset.capacityEnabled,
        active: true,
        reasonHashHex: sha256Hex(`founder-rehearsal-rail:${asset.symbol}`),
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  const refreshed = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const rail = refreshed.reserveAssetRails.find(
    (row) => row.address === asset.reserveAssetRail.toBase58(),
  );
  const nowTs = Math.floor(Date.now() / 1000);
  const needsPrice =
    !rail ||
    BigInt(String(rail.lastPriceUsd1e8 ?? 0)) !== asset.priceUsd1e8 ||
    nowTs - Number(rail.lastPricePublishedAtTs ?? 0) > 86_400;
  if (needsPrice) {
    await sendSignedTransaction(ctx, {
      label: `publish_reserve_asset_rail_price:${asset.symbol}`,
      tx: protocol.buildPublishReserveAssetRailPriceTx({
        authority: ctx.governance.publicKey,
        reserveDomainAddress: reserveDomain,
        assetMint: asset.mint,
        priceUsd1e8: asset.priceUsd1e8,
        confidenceBps:
          asset.symbol === "USDC" || asset.symbol === "PUSD" ? 5 : 250,
        publishedAtTs: BigInt(nowTs),
        proofHashHex: sha256Hex(
          `devnet rehearsal price evidence:${asset.symbol}:${asset.priceUsd1e8}`,
        ),
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
}

async function ensureFundingLine(
  ctx: RehearsalContext,
  reserveDomain: PublicKey,
  healthPlan: PublicKey,
  policySeries: PublicKey,
  asset: AssetRuntime,
): Promise<void> {
  const protocol = ctx.protocol;
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existing = snapshot.fundingLines.find(
    (row) => row.address === asset.fundingLine.toBase58(),
  );
  assertCanonicalAccountMatches(
    `funding_line:${asset.fundingLineId}`,
    existing as Record<string, unknown> | null,
    {
      lineId: asset.fundingLineId,
      reserveDomain: reserveDomain.toBase58(),
      healthPlan: healthPlan.toBase58(),
      policySeries: policySeries.toBase58(),
      assetMint: asset.mint.toBase58(),
      lineType: protocol.FUNDING_LINE_TYPE_PREMIUM_INCOME,
    },
  );
  if (existing) return;
  await ensureSeriesReserveLedger(ctx, healthPlan, policySeries, asset);
  await sendSignedTransaction(ctx, {
    label: `open_funding_line:${asset.symbol}`,
    tx: protocol.buildOpenFundingLineTx({
      authority: ctx.governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      assetMint: asset.mint,
      lineId: asset.fundingLineId,
      policySeriesAddress: policySeries,
      lineType: protocol.FUNDING_LINE_TYPE_PREMIUM_INCOME,
      fundingPriority: asset.payoutPriority,
      committedAmount: 0n,
      capsHashHex: sha256Hex(`founder-travel30-funding-line:${asset.symbol}`),
      recentBlockhash: "11111111111111111111111111111111",
    }),
    signer: ctx.governance,
    signers: [ctx.governance],
  });
}

async function ensureSeriesReserveLedger(
  ctx: RehearsalContext,
  healthPlan: PublicKey,
  policySeries: PublicKey,
  asset: AssetRuntime,
): Promise<void> {
  const protocol = ctx.protocol;
  const address = protocol.deriveSeriesReserveLedgerPda({
    policySeries,
    assetMint: asset.mint,
  });
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existing = snapshot.seriesReserveLedgers.find(
    (row) => row.address === address.toBase58(),
  );
  assertCanonicalAccountMatches(
    `series_reserve_ledger:${asset.symbol}`,
    existing as Record<string, unknown> | null,
    {
      assetMint: asset.mint.toBase58(),
    },
  );
  if (existing) return;
  await sendSignedTransaction(ctx, {
    label: `initialize_series_reserve_ledger:${asset.symbol}`,
    tx: protocol.buildInitializeSeriesReserveLedgerTx({
      authority: ctx.governance.publicKey,
      healthPlanAddress: healthPlan,
      policySeriesAddress: policySeries,
      assetMint: asset.mint,
      recentBlockhash: "11111111111111111111111111111111",
    }),
    signer: ctx.governance,
    signers: [ctx.governance],
  });
}

async function ensureLiquidityPool(
  ctx: RehearsalContext,
  reserveDomain: PublicKey,
  usdc: AssetRuntime,
): Promise<void> {
  const protocol = ctx.protocol;
  const pool = protocol.deriveLiquidityPoolPda({
    reserveDomain,
    poolId: CANONICAL_FOUNDER_REHEARSAL_IDS.poolId,
  });
  const classId = "founder-travel30-waterfall";
  const capitalClass = protocol.deriveCapitalClassPda({
    liquidityPool: pool,
    classId,
  });
  let snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existingPool = snapshot.liquidityPools.find(
    (row) => row.address === pool.toBase58(),
  );
  assertCanonicalAccountMatches(
    "liquidity_pool:omega-health-income",
    existingPool as Record<string, unknown> | null,
    {
      poolId: CANONICAL_FOUNDER_REHEARSAL_IDS.poolId,
      reserveDomain: reserveDomain.toBase58(),
    },
  );
  const poolDepositAssetMint = existingPool
    ? new PublicKey(existingPool.depositAssetMint)
    : usdc.mint;
  if (!existingPool) {
    await sendSignedTransaction(ctx, {
      label: `create_liquidity_pool:${CANONICAL_FOUNDER_REHEARSAL_IDS.poolId}`,
      tx: protocol.buildCreateLiquidityPoolTx({
        authority: ctx.governance.publicKey,
        reserveDomainAddress: reserveDomain,
        poolId: CANONICAL_FOUNDER_REHEARSAL_IDS.poolId,
        displayName: "Omega Health Income",
        curator: ctx.governance.publicKey,
        allocator: ctx.governance.publicKey,
        sentinel: ctx.governance.publicKey,
        depositAssetMint: usdc.mint,
        strategyHashHex: sha256Hex(
          "omega-health-income-founder-rehearsal-strategy",
        ),
        allowedExposureHashHex: sha256Hex(
          "omega-health-income-founder-rehearsal-exposure",
        ),
        externalYieldAdapterHashHex: sha256Hex(
          "omega-health-income-no-yield-adapter",
        ),
        feeBps: 0,
        redemptionPolicy: protocol.REDEMPTION_POLICY_QUEUE_ONLY,
        pauseFlags: 0,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existingClass = snapshot.capitalClasses.find(
    (row) => row.address === capitalClass.toBase58(),
  );
  if (!existingClass) {
    await sendSignedTransaction(ctx, {
      label: `create_capital_class:${classId}`,
      tx: protocol.buildCreateCapitalClassTx({
        authority: ctx.governance.publicKey,
        poolAddress: pool,
        poolDepositAssetMint,
        classId,
        displayName: "Founder Travel30 Waterfall Class",
        shareMint: null,
        priority: 1,
        impairmentRank: 1,
        restrictionMode: protocol.CAPITAL_CLASS_RESTRICTION_RESTRICTED,
        redemptionTermsMode: 1,
        wrapperMetadataHashHex: sha256Hex("founder-travel30-class-wrapper"),
        permissioningHashHex: sha256Hex("founder-travel30-class-permissioning"),
        feeBps: 0,
        minLockupSeconds: 0n,
        pauseFlags: 0,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
}

async function ensureOracleAndSchema(ctx: RehearsalContext): Promise<void> {
  const protocol = ctx.protocol;
  const schema = protocol.deriveOutcomeSchemaPda({
    schemaKeyHashHex: STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX,
  });
  const oracleProfile = protocol.deriveOracleProfilePda({
    oracle: ctx.oracle.publicKey,
  });
  let snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  if (
    !snapshot.outcomeSchemas.find((row) => row.address === schema.toBase58())
  ) {
    await sendSignedTransaction(ctx, {
      label: "register_outcome_schema:standard-health-outcomes",
      tx: protocol.buildRegisterOutcomeSchemaTx({
        publisher: ctx.governance.publicKey,
        schemaKeyHashHex: STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX,
        schemaKey: "standard.health.outcomes",
        version: 1,
        schemaHashHex: sha256Hex("standard-health-outcomes-schema-v1"),
        schemaFamily: protocol.SCHEMA_FAMILY_KERNEL,
        visibility: protocol.SCHEMA_VISIBILITY_PUBLIC,
        metadataUri:
          "https://protocol.omegax.health/schemas/standard-health-outcomes-v1.json",
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const liveSchema = snapshot.outcomeSchemas.find(
    (row) => row.address === schema.toBase58(),
  );
  if (!liveSchema?.verified) {
    requireLocalProtocolGovernanceAuthority(
      ctx,
      "verify_outcome_schema:standard-health-outcomes",
    );
    await sendSignedTransaction(ctx, {
      label: "verify_outcome_schema:standard-health-outcomes",
      tx: protocol.buildVerifyOutcomeSchemaTx({
        governanceAuthority: ctx.governance.publicKey,
        schemaKeyHashHex: STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX,
        verified: true,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  if (
    !snapshot.oracleProfiles.find(
      (row) => row.address === oracleProfile.toBase58(),
    )
  ) {
    await sendSignedTransaction(ctx, {
      label: "register_oracle:founder-rehearsal",
      tx: protocol.buildRegisterOracleTx({
        admin: ctx.oracle.publicKey,
        oracle: ctx.oracle.publicKey,
        oracleType: protocol.ORACLE_TYPE_HEALTH_APP,
        displayName: "OmegaX Founder Rehearsal Oracle",
        legalName: "OmegaX Founder Rehearsal Oracle",
        websiteUrl: "https://protocol.omegax.health",
        appUrl: "https://protocol.omegax.health/oracles",
        logoUri: "https://protocol.omegax.health/icon.png",
        webhookUrl:
          "https://protocol.omegax.health/api/oracles/founder-rehearsal",
        supportedSchemaKeyHashesHex: [STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX],
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.oracle,
      signers: [ctx.oracle],
    });
  }
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const liveOracle = snapshot.oracleProfiles.find(
    (row) => row.address === oracleProfile.toBase58(),
  );
  if (!liveOracle?.claimed) {
    await sendSignedTransaction(ctx, {
      label: "claim_oracle:founder-rehearsal",
      tx: protocol.buildClaimOracleTx({
        oracle: ctx.oracle.publicKey,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.oracle,
      signers: [ctx.oracle],
    });
  }
}

async function ensureCommitmentCampaign(
  ctx: RehearsalContext,
  reserveDomain: PublicKey,
  healthPlan: PublicKey,
  policySeries: PublicKey,
  assets: AssetRuntime[],
): Promise<void> {
  const protocol = ctx.protocol;
  const usdc = requireAsset(assets, "USDC");
  const campaign = protocol.deriveCommitmentCampaignPda({
    healthPlan,
    campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
  });
  let snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existingCampaign = snapshot.commitmentCampaigns.find(
    (row) => row.address === campaign.toBase58(),
  );
  assertCanonicalAccountMatches(
    "commitment_campaign:founder-travel30",
    existingCampaign as Record<string, unknown> | null,
    {
      campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
      reserveDomain: reserveDomain.toBase58(),
      healthPlan: healthPlan.toBase58(),
      paymentAssetMint: usdc.mint.toBase58(),
      coverageAssetMint: usdc.mint.toBase58(),
      coverageFundingLine: usdc.fundingLine.toBase58(),
      mode: protocol.COMMITMENT_MODE_WATERFALL_RESERVE,
    },
  );
  const nowTs = Math.floor(Date.now() / 1000);
  if (!existingCampaign) {
    await sendSignedTransaction(ctx, {
      label: `create_commitment_campaign:${CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId}`,
      tx: protocol.buildCreateCommitmentCampaignTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        coverageFundingLineAddress: usdc.fundingLine,
        paymentAssetMint: usdc.mint,
        coverageAssetMint: usdc.mint,
        reserveAssetRailAddress: usdc.reserveAssetRail,
        activationAuthority: ctx.governance.publicKey,
        campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
        displayName: "Founder Travel30",
        metadataUri: "https://protect.omegax.health/protect/founder",
        mode: protocol.COMMITMENT_MODE_WATERFALL_RESERVE,
        depositAmount: usdc.depositAmount,
        coverageAmount: rawAmountForUsd({
          usd: 3_000,
          decimals: usdc.decimals,
          priceUsd1e8: usdc.priceUsd1e8,
        }),
        hardCapAmount: usdc.depositAmount * 10_000n,
        startsAtTs: BigInt(nowTs - 3_600),
        refundAfterTs: BigInt(nowTs - 60),
        expiresAtTs: BigInt(nowTs + 90 * 86_400),
        termsHashHex: TERMS_HASH,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  for (const asset of assets) {
    const rail = protocol.deriveCommitmentPaymentRailPda({
      campaign,
      paymentAssetMint: asset.mint,
    });
    const existing = snapshot.commitmentPaymentRails.find(
      (row) => row.address === rail.toBase58(),
    );
    assertCanonicalAccountMatches(
      `commitment_payment_rail:${asset.symbol}`,
      existing as Record<string, unknown> | null,
      {
        campaign: campaign.toBase58(),
        reserveDomain: reserveDomain.toBase58(),
        paymentAssetMint: asset.mint.toBase58(),
        coverageAssetMint: asset.mint.toBase58(),
        reserveAssetRail: asset.reserveAssetRail.toBase58(),
        coverageFundingLine: asset.fundingLine.toBase58(),
        mode: protocol.COMMITMENT_MODE_WATERFALL_RESERVE,
      },
    );
    if (existing) continue;
    if (asset.symbol === "USDC" && existingCampaign) continue;
    await sendSignedTransaction(ctx, {
      label: `create_commitment_payment_rail:${asset.symbol}`,
      tx: protocol.buildCreateCommitmentPaymentRailTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        campaignAddress: campaign,
        coverageFundingLineAddress: asset.fundingLine,
        paymentAssetMint: asset.mint,
        coverageAssetMint: asset.mint,
        reserveAssetRailAddress: asset.reserveAssetRail,
        mode: protocol.COMMITMENT_MODE_WATERFALL_RESERVE,
        depositAmount: asset.depositAmount,
        coverageAmount: rawAmountForUsd({
          usd: 3_000,
          decimals: asset.decimals,
          priceUsd1e8: asset.priceUsd1e8,
        }),
        hardCapAmount: asset.depositAmount * 10_000n,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
}

async function runCommitmentsAndClaims(
  ctx: RehearsalContext,
  assets: AssetRuntime[],
): Promise<void> {
  const protocol = ctx.protocol;
  const reserveDomain = protocol.deriveReserveDomainPda({
    domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
  });
  const healthPlan = protocol.deriveHealthPlanPda({
    reserveDomain,
    planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
  });
  const policySeries = protocol.derivePolicySeriesPda({
    healthPlan,
    seriesId: CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId,
  });
  const campaign = protocol.deriveCommitmentCampaignPda({
    healthPlan,
    campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
  });

  for (const asset of assets) {
    const members = await memberSetForAsset(ctx, asset.symbol);
    await ensureFeeBalance(
      ctx,
      members.pending.publicKey,
      `${asset.symbol}:pending`,
    );
    await ensureFeeBalance(
      ctx,
      members.refund.publicKey,
      `${asset.symbol}:refund`,
    );
    await ensureFeeBalance(
      ctx,
      members.activate.publicKey,
      `${asset.symbol}:activate`,
    );

    await depositPosition(
      ctx,
      asset,
      campaign,
      reserveDomain,
      healthPlan,
      members.pending,
      "pending",
    );
    await depositPosition(
      ctx,
      asset,
      campaign,
      reserveDomain,
      healthPlan,
      members.refund,
      "refund",
    );
    await refundPosition(ctx, asset, campaign, reserveDomain, members.refund);
    await depositPosition(
      ctx,
      asset,
      campaign,
      reserveDomain,
      healthPlan,
      members.activate,
      "activate",
    );
    await activatePosition(
      ctx,
      asset,
      campaign,
      reserveDomain,
      healthPlan,
      policySeries,
      members.activate,
    );
    await claimAndSettle(
      ctx,
      asset,
      reserveDomain,
      healthPlan,
      policySeries,
      campaign,
      members.activate,
    );
  }
}

async function memberSetForAsset(
  ctx: RehearsalContext,
  symbol: FounderAssetSymbol,
): Promise<MemberSet> {
  return {
    pending: ensureLocalKeypair(
      `member-${symbol.toLowerCase()}-pending`,
      ctx.mode,
    ),
    refund: ensureLocalKeypair(
      `member-${symbol.toLowerCase()}-refund`,
      ctx.mode,
    ),
    activate: ensureLocalKeypair(
      `member-${symbol.toLowerCase()}-activate`,
      ctx.mode,
    ),
  };
}

async function depositPosition(
  ctx: RehearsalContext,
  asset: AssetRuntime,
  campaign: PublicKey,
  reserveDomain: PublicKey,
  healthPlan: PublicKey,
  member: Keypair,
  kind: "pending" | "refund" | "activate",
): Promise<void> {
  const protocol = ctx.protocol;
  const position = protocol.deriveCommitmentPositionPda({
    campaign,
    depositor: member.publicKey,
    beneficiary: member.publicKey,
  });
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existing = snapshot.commitmentPositions.find(
    (row) => row.address === position.toBase58(),
  );
  if (existing) {
    if (!ctx.resume) {
      throw new Error(
        `Commitment position already exists for ${asset.symbol}:${kind}; rerun with --resume to continue.`,
      );
    }
    return;
  }
  const sourceAta = await mintOrWrapForMember(
    ctx,
    asset,
    member.publicKey,
    asset.depositAmount,
    `${kind}:deposit`,
  );
  await sendSignedTransaction(ctx, {
    label: `deposit_commitment:${asset.symbol}:${kind}`,
    tx: protocol.buildDepositCommitmentTx({
      depositor: member.publicKey,
      healthPlanAddress: healthPlan,
      campaignAddress: campaign,
      reserveDomainAddress: reserveDomain,
      paymentAssetMint: asset.mint,
      sourceTokenAccountAddress: sourceAta,
      beneficiary: member.publicKey,
      reserveAssetRailAddress: asset.reserveAssetRail,
      acceptedTermsHashHex: TERMS_HASH,
      tokenProgramId: TOKEN_PROGRAM_ID,
      recentBlockhash: "11111111111111111111111111111111",
    }),
    signer: member,
    signers: [member],
  });
}

async function refundPosition(
  ctx: RehearsalContext,
  asset: AssetRuntime,
  campaign: PublicKey,
  reserveDomain: PublicKey,
  member: Keypair,
): Promise<void> {
  const protocol = ctx.protocol;
  const position = protocol.deriveCommitmentPositionPda({
    campaign,
    depositor: member.publicKey,
    beneficiary: member.publicKey,
  });
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existing = snapshot.commitmentPositions.find(
    (row) => row.address === position.toBase58(),
  );
  if (existing?.state === protocol.COMMITMENT_POSITION_REFUNDED) return;
  const recipientAta = await ensureAta(
    ctx,
    member.publicKey,
    asset.mint,
    `${asset.symbol}:refund-recipient`,
  );
  await sendSignedTransaction(ctx, {
    label: `refund_commitment:${asset.symbol}`,
    tx: protocol.buildRefundCommitmentTx({
      depositor: member.publicKey,
      campaignAddress: campaign,
      positionAddress: position,
      reserveDomainAddress: reserveDomain,
      paymentAssetMint: asset.mint,
      recipientTokenAccountAddress: recipientAta,
      beneficiary: member.publicKey,
      refundReasonHashHex: sha256Hex(
        `refund:${asset.symbol}:same-token-same-amount`,
      ),
      tokenProgramId: TOKEN_PROGRAM_ID,
      recentBlockhash: "11111111111111111111111111111111",
    }),
    signer: member,
    signers: [member],
  });
}

async function activatePosition(
  ctx: RehearsalContext,
  asset: AssetRuntime,
  campaign: PublicKey,
  reserveDomain: PublicKey,
  healthPlan: PublicKey,
  policySeries: PublicKey,
  member: Keypair,
): Promise<void> {
  const protocol = ctx.protocol;
  const position = protocol.deriveCommitmentPositionPda({
    campaign,
    depositor: member.publicKey,
    beneficiary: member.publicKey,
  });
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const existing = snapshot.commitmentPositions.find(
    (row) => row.address === position.toBase58(),
  );
  if (
    existing?.state === protocol.COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED
  )
    return;
  await sendSignedTransaction(ctx, {
    label: `activate_waterfall_commitment:${asset.symbol}`,
    tx: protocol.buildActivateWaterfallCommitmentTx({
      activationAuthority: ctx.governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      campaignAddress: campaign,
      paymentAssetMint: asset.mint,
      coverageAssetMint: asset.mint,
      coverageFundingLineAddress: asset.fundingLine,
      reserveAssetRailAddress: asset.reserveAssetRail,
      policySeriesAddress: policySeries,
      positionAddress: position,
      activationReasonHashHex: sha256Hex(`activate:${asset.symbol}:waterfall`),
      recentBlockhash: "11111111111111111111111111111111",
    }),
    signer: ctx.governance,
    signers: [ctx.governance],
  });
}

async function claimAndSettle(
  ctx: RehearsalContext,
  asset: AssetRuntime,
  reserveDomain: PublicKey,
  healthPlan: PublicKey,
  policySeries: PublicKey,
  campaign: PublicKey,
  member: Keypair,
): Promise<void> {
  const protocol = ctx.protocol;
  const memberPosition = protocol.deriveMemberPositionPda({
    healthPlan,
    wallet: member.publicKey,
    seriesScope: policySeries,
  });
  let snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  if (
    !snapshot.memberPositions.find(
      (row) => row.address === memberPosition.toBase58(),
    )
  ) {
    await sendSignedTransaction(ctx, {
      label: `open_member_position:${asset.symbol}`,
      tx: protocol.buildOpenMemberPositionTx({
        wallet: member.publicKey,
        healthPlanAddress: healthPlan,
        seriesScopeAddress: policySeries,
        subjectCommitmentHashHex: sha256Hex(
          `member-position:${campaign.toBase58()}:${member.publicKey.toBase58()}`,
        ),
        eligibilityStatus: protocol.ELIGIBILITY_ELIGIBLE,
        delegatedRightsMask: 0,
        proofMode: protocol.MEMBERSHIP_PROOF_MODE_OPEN,
        tokenGateAmountSnapshot: 0n,
        inviteExpiresAt: 0n,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: member,
      signers: [member],
    });
  }

  const claimId = `founder-${asset.symbol.toLowerCase()}-claim`;
  const obligationId = `founder-${asset.symbol.toLowerCase()}-obligation`;
  const claimCase = protocol.deriveClaimCasePda({ healthPlan, claimId });
  const obligation = protocol.deriveObligationPda({
    fundingLine: asset.fundingLine,
    obligationId,
  });
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  if (
    !snapshot.claimCases.find((row) => row.address === claimCase.toBase58())
  ) {
    await sendSignedTransaction(ctx, {
      label: `open_claim_case:${asset.symbol}`,
      tx: protocol.buildOpenClaimCaseTx({
        authority: member.publicKey,
        healthPlanAddress: healthPlan,
        memberPositionAddress: memberPosition,
        fundingLineAddress: asset.fundingLine,
        claimId,
        policySeriesAddress: policySeries,
        claimantAddress: member.publicKey,
        evidenceRefHashHex: sha256Hex(
          `devnet-rehearsal-claim-evidence:${asset.symbol}`,
        ),
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: member,
      signers: [member],
    });
  }
  await maybeSendClaimEvidenceAndAttestation(
    ctx,
    healthPlan,
    claimCase,
    policySeries,
    asset,
  );

  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  if (
    !snapshot.obligations.find((row) => row.address === obligation.toBase58())
  ) {
    await sendSignedTransaction(ctx, {
      label: `create_obligation:${asset.symbol}`,
      tx: protocol.buildCreateObligationTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        fundingLineAddress: asset.fundingLine,
        assetMint: asset.mint,
        obligationId,
        policySeriesAddress: policySeries,
        memberWalletAddress: member.publicKey,
        beneficiaryAddress: member.publicKey,
        claimCaseAddress: claimCase,
        deliveryMode: protocol.OBLIGATION_DELIVERY_MODE_PAYABLE,
        amount: asset.claimAmount,
        creationReasonHashHex: sha256Hex(`claim-obligation:${asset.symbol}`),
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const liveObligation = snapshot.obligations.find(
    (row) => row.address === obligation.toBase58(),
  );
  const liveClaim = snapshot.claimCases.find(
    (row) => row.address === claimCase.toBase58(),
  );
  if (
    liveClaim?.intakeStatus !== protocol.CLAIM_INTAKE_APPROVED &&
    liveClaim?.intakeStatus !== protocol.CLAIM_INTAKE_SETTLED
  ) {
    await sendSignedTransaction(ctx, {
      label: `adjudicate_claim_case:${asset.symbol}`,
      tx: protocol.buildAdjudicateClaimCaseTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        claimCaseAddress: claimCase,
        reviewState: protocol.CLAIM_INTAKE_APPROVED,
        approvedAmount: asset.claimAmount,
        deniedAmount: 0n,
        reserveAmount: asset.claimAmount,
        decisionSupportHashHex: sha256Hex(
          `claim-decision-support:${asset.symbol}`,
        ),
        obligationAddress: obligation,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  if (
    !liveObligation ||
    liveObligation.status === protocol.OBLIGATION_STATUS_PROPOSED
  ) {
    await sendSignedTransaction(ctx, {
      label: `reserve_obligation:${asset.symbol}`,
      tx: protocol.buildReserveObligationTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        fundingLineAddress: asset.fundingLine,
        assetMint: asset.mint,
        obligationAddress: obligation,
        claimCaseAddress: claimCase,
        policySeriesAddress: policySeries,
        amount: asset.claimAmount,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  const recipientAta = await ensureAta(
    ctx,
    member.publicKey,
    asset.mint,
    `${asset.symbol}:claim-recipient`,
  );
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const refreshedObligation = snapshot.obligations.find(
    (row) => row.address === obligation.toBase58(),
  );
  if (
    refreshedObligation?.status === protocol.OBLIGATION_STATUS_RESERVED ||
    refreshedObligation?.status === protocol.OBLIGATION_STATUS_CLAIMABLE_PAYABLE
  ) {
    await sendSignedTransaction(ctx, {
      label: `settle_obligation:${asset.symbol}`,
      tx: protocol.buildSettleObligationTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        fundingLineAddress: asset.fundingLine,
        assetMint: asset.mint,
        obligationAddress: obligation,
        claimCaseAddress: claimCase,
        policySeriesAddress: policySeries,
        nextStatus: protocol.OBLIGATION_STATUS_SETTLED,
        amount: asset.claimAmount,
        settlementReasonHashHex: sha256Hex(`settle-obligation:${asset.symbol}`),
        memberPositionAddress: memberPosition,
        vaultTokenAccountAddress: asset.vaultTokenAccount,
        recipientTokenAccountAddress: recipientAta,
        tokenProgramId: TOKEN_PROGRAM_ID,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
  snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const settledClaim = snapshot.claimCases.find(
    (row) => row.address === claimCase.toBase58(),
  );
  if (settledClaim?.intakeStatus !== protocol.CLAIM_INTAKE_SETTLED) {
    await sendSignedTransaction(ctx, {
      label: `settle_claim_case:${asset.symbol}`,
      tx: protocol.buildSettleClaimCaseTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        reserveDomainAddress: reserveDomain,
        fundingLineAddress: asset.fundingLine,
        assetMint: asset.mint,
        claimCaseAddress: claimCase,
        policySeriesAddress: policySeries,
        obligationAddress: obligation,
        amount: asset.claimAmount,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
  }
}

async function maybeSendClaimEvidenceAndAttestation(
  ctx: RehearsalContext,
  healthPlan: PublicKey,
  claimCase: PublicKey,
  policySeries: PublicKey,
  asset: AssetRuntime,
): Promise<void> {
  const protocol = ctx.protocol;
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  if (
    !snapshot.claimAttestations.find(
      (row) =>
        row.claimCase === claimCase.toBase58() &&
        row.oracle === ctx.oracle.publicKey.toBase58(),
    )
  ) {
    await sendSignedTransaction(ctx, {
      label: `attach_claim_evidence_ref:${asset.symbol}`,
      tx: protocol.buildAttachClaimEvidenceRefTx({
        authority: ctx.governance.publicKey,
        healthPlanAddress: healthPlan,
        claimCaseAddress: claimCase,
        evidenceRefHashHex: sha256Hex(`evidence-ref:${asset.symbol}`),
        decisionSupportHashHex: sha256Hex(`decision-support:${asset.symbol}`),
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.governance,
      signers: [ctx.governance],
    });
    await sendSignedTransaction(ctx, {
      label: `attest_claim_case:${asset.symbol}`,
      tx: protocol.buildAttestClaimCaseTx({
        oracle: ctx.oracle.publicKey,
        healthPlanAddress: healthPlan,
        claimCaseAddress: claimCase,
        fundingLineAddress: asset.fundingLine,
        decision: protocol.CLAIM_ATTESTATION_DECISION_SUPPORT_APPROVE,
        attestationHashHex: sha256Hex(`attestation:${asset.symbol}:approve`),
        attestationRefHashHex: sha256Hex(`attestation-ref:${asset.symbol}`),
        schemaKeyHashHex: STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX,
        recentBlockhash: "11111111111111111111111111111111",
      }),
      signer: ctx.oracle,
      signers: [ctx.oracle],
    });
  }
  const updated = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const attestation = updated.claimAttestations.find(
    (row) => row.claimCase === claimCase.toBase58(),
  );
  if (
    attestation &&
    attestation.policySeries !== null &&
    attestation.policySeries !== policySeries.toBase58()
  ) {
    throw new Error(
      `Claim attestation policy series mismatch for ${asset.symbol}.`,
    );
  }
}

async function runNegativeSimulations(
  ctx: RehearsalContext,
  assets: AssetRuntime[],
): Promise<void> {
  const protocol = ctx.protocol;
  const reserveDomain = protocol.deriveReserveDomainPda({
    domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
  });
  const healthPlan = protocol.deriveHealthPlanPda({
    reserveDomain,
    planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
  });
  const policySeries = protocol.derivePolicySeriesPda({
    healthPlan,
    seriesId: CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId,
  });
  const campaign = protocol.deriveCommitmentCampaignPda({
    healthPlan,
    campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
  });
  const usdc = requireAsset(assets, "USDC");
  const member = ensureLocalKeypair("member-usdc-refund", ctx.mode);
  const wrong = ensureLocalKeypair("member-usdc-wrong-wallet", ctx.mode);
  await ensureFeeBalance(ctx, wrong.publicKey, "wrong-wallet");
  const position = protocol.deriveCommitmentPositionPda({
    campaign,
    depositor: member.publicKey,
    beneficiary: member.publicKey,
  });
  const recipientAta = await ensureAta(
    ctx,
    member.publicKey,
    usdc.mint,
    "USDC:negative-recipient",
  );
  await simulateExpectedFailure(
    ctx,
    "double_refund",
    protocol.buildRefundCommitmentTx({
      depositor: member.publicKey,
      campaignAddress: campaign,
      positionAddress: position,
      reserveDomainAddress: reserveDomain,
      paymentAssetMint: usdc.mint,
      recipientTokenAccountAddress: recipientAta,
      beneficiary: member.publicKey,
      refundReasonHashHex: sha256Hex("negative:double-refund"),
      tokenProgramId: TOKEN_PROGRAM_ID,
      recentBlockhash: "11111111111111111111111111111111",
    }),
    [member],
  );
  await simulateExpectedFailure(
    ctx,
    "wrong_wallet_refund",
    protocol.buildRefundCommitmentTx({
      depositor: wrong.publicKey,
      campaignAddress: campaign,
      positionAddress: position,
      reserveDomainAddress: reserveDomain,
      paymentAssetMint: usdc.mint,
      recipientTokenAccountAddress: recipientAta,
      beneficiary: member.publicKey,
      refundReasonHashHex: sha256Hex("negative:wrong-wallet"),
      tokenProgramId: TOKEN_PROGRAM_ID,
      recentBlockhash: "11111111111111111111111111111111",
    }),
    [wrong],
  );
  await simulateExpectedFailure(
    ctx,
    "double_activation",
    protocol.buildActivateWaterfallCommitmentTx({
      activationAuthority: ctx.governance.publicKey,
      healthPlanAddress: healthPlan,
      reserveDomainAddress: reserveDomain,
      campaignAddress: campaign,
      paymentAssetMint: usdc.mint,
      coverageAssetMint: usdc.mint,
      coverageFundingLineAddress: usdc.fundingLine,
      reserveAssetRailAddress: usdc.reserveAssetRail,
      policySeriesAddress: policySeries,
      positionAddress: protocol.deriveCommitmentPositionPda({
        campaign,
        depositor: ensureLocalKeypair("member-usdc-activate", ctx.mode)
          .publicKey,
        beneficiary: ensureLocalKeypair("member-usdc-activate", ctx.mode)
          .publicKey,
      }),
      activationReasonHashHex: sha256Hex("negative:double-activation"),
      recentBlockhash: "11111111111111111111111111111111",
    }),
    [ctx.governance],
  );
  await simulateExpectedFailure(
    ctx,
    "duplicate_claim",
    protocol.buildOpenClaimCaseTx({
      authority: ensureLocalKeypair("member-usdc-activate", ctx.mode).publicKey,
      healthPlanAddress: healthPlan,
      memberPositionAddress: protocol.deriveMemberPositionPda({
        healthPlan,
        wallet: ensureLocalKeypair("member-usdc-activate", ctx.mode).publicKey,
        seriesScope: policySeries,
      }),
      fundingLineAddress: usdc.fundingLine,
      claimId: "founder-usdc-claim",
      policySeriesAddress: policySeries,
      claimantAddress: ensureLocalKeypair("member-usdc-activate", ctx.mode)
        .publicKey,
      evidenceRefHashHex: sha256Hex("negative:duplicate-claim"),
      recentBlockhash: "11111111111111111111111111111111",
    }),
    [ensureLocalKeypair("member-usdc-activate", ctx.mode)],
  );
  await simulateExpectedFailure(
    ctx,
    "unauthorized_claim_operator",
    protocol.buildAdjudicateClaimCaseTx({
      authority: wrong.publicKey,
      healthPlanAddress: healthPlan,
      claimCaseAddress: protocol.deriveClaimCasePda({
        healthPlan,
        claimId: "founder-usdc-claim",
      }),
      reviewState: protocol.CLAIM_INTAKE_APPROVED,
      approvedAmount: usdc.claimAmount,
      deniedAmount: 0n,
      reserveAmount: usdc.claimAmount,
      decisionSupportHashHex: sha256Hex("negative:unauthorized-claim-operator"),
      obligationAddress: protocol.deriveObligationPda({
        fundingLine: usdc.fundingLine,
        obligationId: "founder-usdc-obligation",
      }),
      recentBlockhash: "11111111111111111111111111111111",
    }),
    [wrong],
  );
  try {
    requireClassicTokenProgramId("TokenzQdBNbLqP5VEhdkAS6EPFbkETHTc8KAh6AL7g");
    throw new Error("Token-2022 rejection guard did not throw.");
  } catch (error) {
    ctx.negativeSimulations.push({
      label: "token2022_rejection",
      expectedFailure: "classic SPL token guard",
      err: error instanceof Error ? error.message : String(error),
      logs: [],
    });
  }
}

async function simulateExpectedFailure(
  ctx: RehearsalContext,
  label: string,
  tx: Transaction,
  signers: Keypair[],
): Promise<void> {
  const latest = await ctx.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;
  tx.sign(...uniqueKeypairs(signers));
  const result = await ctx.connection.simulateTransaction(tx, signers);
  if (!result.value.err) {
    throw new Error(`Negative simulation unexpectedly passed: ${label}`);
  }
  ctx.negativeSimulations.push({
    label,
    expectedFailure: "program/client rejection",
    err: result.value.err,
    logs: result.value.logs ?? [],
  });
  console.log(`[founder-rehearsal] negative:${label}: expected failure`);
}

async function runActuarial(ctx: RehearsalContext, assets: AssetRuntime[]) {
  const protocol = ctx.protocol;
  const reserveDomain = protocol.deriveReserveDomainPda({
    domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
  });
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const nowTs = Math.floor(Date.now() / 1000);
  const chainInputs = chainInputsFromSnapshot({
    assets: assets.map((asset) => ({ ...asset, mint: asset.mint.toBase58() })),
    reserveDomain: reserveDomain.toBase58(),
    ledgers: snapshot.domainAssetLedgers,
    rails: snapshot.reserveAssetRails,
    commitmentPositions: snapshot.commitmentPositions,
    obligations: snapshot.obligations,
    nowTs,
  });
  const activatedTravel30Members = snapshot.commitmentPositions.filter(
    (position) =>
      position.campaign ===
        protocol
          .deriveCommitmentCampaignPda({
            healthPlan: protocol.deriveHealthPlanPda({
              reserveDomain,
              planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
            }),
            campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
          })
          .toBase58() &&
      position.state ===
        protocol.COMMITMENT_POSITION_WATERFALL_RESERVE_ACTIVATED,
  ).length;
  return evaluateChainActuarialGate({
    nowTs,
    activatedTravel30Members,
    assets: chainInputs,
    assumptions: {
      seed: 20260503,
      trials: 12_000,
      baselineClaimFrequency: 0.04,
      maxPayoutUsd: 3_000,
      severityMinUsd: 75,
      severityModeUsd: 650,
      severityP95Usd: 2_250,
      severityMaxUsd: 3_000,
    },
  });
}

function requireAsset(
  assets: AssetRuntime[],
  symbol: FounderAssetSymbol,
): AssetRuntime {
  const asset = assets.find((row) => row.symbol === symbol);
  if (!asset) throw new Error(`Missing asset ${symbol}.`);
  return asset;
}

function planSummary(
  protocol: ProtocolModule,
  assets: AssetRuntime[],
): Record<string, unknown> {
  const reserveDomain = protocol.deriveReserveDomainPda({
    domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
  });
  const healthPlan = protocol.deriveHealthPlanPda({
    reserveDomain,
    planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
  });
  const policySeries = protocol.derivePolicySeriesPda({
    healthPlan,
    seriesId: CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId,
  });
  const campaign = protocol.deriveCommitmentCampaignPda({
    healthPlan,
    campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
  });
  return {
    mode: "plan",
    sendsTransactions: false,
    programId: protocol.getProgramId().toBase58(),
    canonicalIds: CANONICAL_FOUNDER_REHEARSAL_IDS,
    addresses: {
      reserveDomain: reserveDomain.toBase58(),
      healthPlan: healthPlan.toBase58(),
      policySeries: policySeries.toBase58(),
      campaign: campaign.toBase58(),
      pool: protocol
        .deriveLiquidityPoolPda({
          reserveDomain,
          poolId: CANONICAL_FOUNDER_REHEARSAL_IDS.poolId,
        })
        .toBase58(),
    },
    assets: assets.map((asset) => ({
      symbol: asset.symbol,
      mint: asset.mint.toBase58(),
      decimals: asset.decimals,
      fundingLineId: asset.fundingLineId,
      fundingLine: asset.fundingLine.toBase58(),
      depositAmountRaw: asset.depositAmount,
      claimAmountRaw: asset.claimAmount,
      payoutPriority: asset.payoutPriority,
      haircutBps: asset.haircutBps,
      maxExposureBps: asset.maxExposureBps,
      priceEvidence:
        "devnet rehearsal price evidence; not live Chainlink truth",
    })),
  };
}

async function writeEvidence(
  ctx: RehearsalContext,
  assets: AssetRuntime[],
  actuarial: unknown,
): Promise<void> {
  assertMaySend(ctx.mode);
  mkdirSync(ctx.evidenceDir, { recursive: true });
  const protocol = ctx.protocol;
  const reserveDomain = protocol.deriveReserveDomainPda({
    domainId: CANONICAL_FOUNDER_REHEARSAL_IDS.reserveDomainId,
  });
  const healthPlan = protocol.deriveHealthPlanPda({
    reserveDomain,
    planId: CANONICAL_FOUNDER_REHEARSAL_IDS.planId,
  });
  const policySeries = protocol.derivePolicySeriesPda({
    healthPlan,
    seriesId: CANONICAL_FOUNDER_REHEARSAL_IDS.seriesId,
  });
  const campaign = protocol.deriveCommitmentCampaignPda({
    healthPlan,
    campaignId: CANONICAL_FOUNDER_REHEARSAL_IDS.campaignId,
  });
  const snapshot = await protocol.loadProtocolConsoleSnapshot(ctx.connection);
  const bundle = redactEvidence({
    generatedAt: new Date().toISOString(),
    programId: protocol.getProgramId().toBase58(),
    canonicalIds: CANONICAL_FOUNDER_REHEARSAL_IDS,
    transactions: ctx.transactions,
    negativeSimulations: ctx.negativeSimulations,
    addresses: {
      reserveDomain: reserveDomain.toBase58(),
      healthPlan: healthPlan.toBase58(),
      policySeries: policySeries.toBase58(),
      campaign: campaign.toBase58(),
      assets: assets.map((asset) => ({
        symbol: asset.symbol,
        mint: asset.mint.toBase58(),
        fundingLine: asset.fundingLine.toBase58(),
        reserveAssetRail: asset.reserveAssetRail.toBase58(),
        vaultTokenAccount: asset.vaultTokenAccount.toBase58(),
      })),
    },
    reserveSnapshots: {
      domainAssetLedgers: snapshot.domainAssetLedgers.filter(
        (row) => row.reserveDomain === reserveDomain.toBase58(),
      ),
      reserveAssetRails: snapshot.reserveAssetRails.filter(
        (row) => row.reserveDomain === reserveDomain.toBase58(),
      ),
      commitmentLedgers: snapshot.commitmentLedgers.filter(
        (row) => row.campaign === campaign.toBase58(),
      ),
      obligations: snapshot.obligations.filter(
        (row) => row.healthPlan === healthPlan.toBase58(),
      ),
    },
    actuarial,
  });
  writeFileSync(
    join(ctx.evidenceDir, "summary.json"),
    `${JSON.stringify(bundle, jsonReplacer, 2)}\n`,
  );
  writeFileSync(
    join(ctx.evidenceDir, "transactions.json"),
    `${JSON.stringify(redactEvidence(ctx.transactions), jsonReplacer, 2)}\n`,
  );
  writeFileSync(
    join(ctx.evidenceDir, "negative-simulations.json"),
    `${JSON.stringify(redactEvidence(ctx.negativeSimulations), jsonReplacer, 2)}\n`,
  );
  writeFileSync(
    join(ctx.evidenceDir, "actuarial-report.json"),
    `${JSON.stringify(redactEvidence(actuarial), jsonReplacer, 2)}\n`,
  );
}

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseRehearsalArgs(process.argv.slice(2));
  const protocol = await importFreshProtocol();
  if (protocol.getProgramId().toBase58() !== PROTOCOL_PROGRAM_ID) {
    throw new Error(
      `Canonical program id mismatch: expected ${PROTOCOL_PROGRAM_ID}, got ${protocol.getProgramId().toBase58()}.`,
    );
  }
  const rpcUrl =
    process.env.OMEGAX_DEVNET_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ||
    DEFAULT_RPC_URL;
  const connection = wrapConnectionWithRpcRetry(
    new Connection(rpcUrl, "confirmed"),
    {
      labelPrefix: "founder-rehearsal",
      logPrefix: "founder-rehearsal",
    },
  );
  const governance = loadGovernanceKeypair(args.mode) ?? Keypair.generate();
  const oracle =
    args.mode === "execute"
      ? ensureLocalKeypair("oracle-operator", args.mode)
      : Keypair.generate();
  const evidenceDir = resolve(
    process.cwd(),
    "artifacts",
    `devnet-founder-rehearsal-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
  const ctx: RehearsalContext = {
    protocol,
    connection,
    governance,
    oracle,
    protocolGovernanceAuthority: null,
    mode: args.mode,
    resume: args.resume,
    evidenceDir,
    transactions: [],
    negativeSimulations: [],
  };

  if (args.mode === "execute") {
    await preflightProtocolGovernance(ctx);
  }
  const assets = await buildAssets(ctx);
  if (args.mode === "plan") {
    console.log(JSON.stringify(planSummary(protocol, assets), jsonReplacer, 2));
    return;
  }

  await ensureGovernanceHasDevnetSol(ctx);
  await ensureFeeBalance(ctx, oracle.publicKey, "oracle");
  if (!args.actuarialOnly) {
    await ensureProtocolGraph(ctx, assets);
    await runCommitmentsAndClaims(ctx, assets);
    await runNegativeSimulations(ctx, assets);
  }
  const actuarial = await runActuarial(ctx, assets);
  await writeEvidence(ctx, assets, actuarial);
  console.log(`[founder-rehearsal] evidence: ${ctx.evidenceDir}`);
  console.log(`[founder-rehearsal] launch_gate: ${actuarial.launchGate}`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
