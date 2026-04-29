// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { PublicKey } from "@solana/web3.js";

import genesisModule from "../../frontend/lib/genesis-protect-acute.ts";
import protocolModule from "../../frontend/lib/protocol.ts";

const {
  GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_KEY,
  GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_VERSION,
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_PLAN_ID,
  GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI,
  GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_POOL_ID,
  GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS,
  GENESIS_PROTECT_ACUTE_PUBLIC_DISCLOSURE_BASE_URL,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_DISPLAY_NAME,
  GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
  GENESIS_PROTECT_ACUTE_SKUS,
  GENESIS_PROTECT_ACUTE_SPONSOR_LABEL,
} = genesisModule as typeof import("../../frontend/lib/genesis-protect-acute.ts");

const {
  CAPITAL_CLASS_RESTRICTION_OPEN,
  FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  REDEMPTION_POLICY_QUEUE_ONLY,
  SERIES_MODE_PROTECTION,
  SERIES_STATUS_ACTIVE,
  deriveAllocationPositionPda,
  deriveCapitalClassPda,
  deriveFundingLinePda,
  deriveHealthPlanPda,
  deriveLiquidityPoolPda,
  derivePolicySeriesPda,
  deriveReserveDomainPda,
} = protocolModule as typeof import("../../frontend/lib/protocol.ts");

type GenesisLiveBootstrapEnv = NodeJS.ProcessEnv;

export type GenesisLiveBootstrapConfig = {
  rpcUrl: string;
  governanceAuthority: string;
  governanceConfigAddress: string | null;
  settlementMint: string;
  reserveDomain: {
    id: string;
    displayName: string;
    address: string;
    admin: string;
  };
  roles: {
    sponsor: string;
    sponsorOperator: string;
    claimsOperator: string;
    oracleAuthority: string;
    oracleKeypairPath: string;
    poolCurator: string;
    poolAllocator: string;
    poolSentinel: string;
  };
  schema: {
    key: string;
    version: number;
    keyHashHex: string;
    metadataLocalPath: string;
    metadataUri: string;
  };
  healthPlan: {
    planId: string;
    address: string;
    displayName: string;
    metadataUri: string;
    sponsorLabel: string;
    membershipMode: number;
    membershipGateKind: number;
    membershipInviteAuthority: string | null;
  };
  policySeries: {
    event7: {
      address: string;
      seriesId: string;
      displayName: string;
      metadataUri: string;
      assetMint: string;
      mode: number;
      status: number;
      comparabilityKey: string;
    };
    travel30: {
      address: string;
      seriesId: string;
      displayName: string;
      metadataUri: string;
      assetMint: string;
      mode: number;
      status: number;
      comparabilityKey: string;
    };
  };
  fundingLines: {
    event7Sponsor: {
      address: string;
      lineId: string;
      displayName: string;
      lineType: number;
      fundingPriority: number;
    };
    event7Premium: {
      address: string;
      lineId: string;
      displayName: string;
      lineType: number;
      fundingPriority: number;
    };
    event7Liquidity: {
      address: string;
      lineId: string;
      displayName: string;
      lineType: number;
      fundingPriority: number;
    };
    travel30Premium: {
      address: string;
      lineId: string;
      displayName: string;
      lineType: number;
      fundingPriority: number;
    };
    travel30Liquidity: {
      address: string;
      lineId: string;
      displayName: string;
      lineType: number;
      fundingPriority: number;
    };
  };
  liquidityPool: {
    address: string;
    poolId: string;
    displayName: string;
    strategyThesis: string;
    redemptionPolicy: number;
  };
  capitalClasses: {
    senior: {
      address: string;
      classId: string;
      displayName: string;
      priority: number;
      restrictionMode: number;
      minLockupSeconds: bigint;
      depositAmount: bigint;
      lpKeypairPath: string | null;
    };
    junior: {
      address: string;
      classId: string;
      displayName: string;
      priority: number;
      restrictionMode: number;
      minLockupSeconds: bigint;
      depositAmount: bigint;
      lpKeypairPath: string | null;
    };
  };
  allocations: {
    event7Junior: {
      address: string;
      capAmount: bigint;
      weightBps: number;
      allocationAmount: bigint;
    };
    travel30Senior: {
      address: string;
      capAmount: bigint;
      weightBps: number;
      allocationAmount: bigint;
    };
    travel30Junior: {
      address: string;
      capAmount: bigint;
      weightBps: number;
      allocationAmount: bigint;
    };
  };
  fundingAmounts: {
    event7SponsorBudget: bigint;
    event7Premium: bigint;
    travel30Premium: bigint;
  };
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function requiredEnv(env: GenesisLiveBootstrapEnv, name: string): string {
  const value = String(env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function optionalEnv(env: GenesisLiveBootstrapEnv, name: string): string | null {
  const value = String(env[name] ?? "").trim();
  return value || null;
}

function parsePubkey(value: string, label: string): string {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

/**
 * Returns true when the resolved RPC URL should be treated as Solana mainnet.
 * Conservative: only explicit non-mainnet markers (devnet/testnet/localnet)
 * disable the guard; anything else is treated as mainnet to avoid custom-
 * domain bypasses.
 *
 * See docs/security/mainnet-privileged-role-controls.md §4 for the policy
 * this guard enforces.
 */
function isMainnetCluster(rpcUrl: string): boolean {
  const normalized = rpcUrl.trim().toLowerCase();
  if (!normalized) return true;

  // Explicit non-mainnet markers disable the guard for rehearsals/localnet.
  if (
    normalized.includes("devnet")
    || normalized.includes("testnet")
    || normalized.includes("localhost")
    || normalized.includes("127.0.0.1")
  ) {
    return false;
  }

  // Mainnet endpoints can be hosted behind custom domains without the
  // literal "mainnet" in the URL; default to mainnet unless clearly non-mainnet.
  return true;
}

function optionalPubkey(
  env: GenesisLiveBootstrapEnv,
  name: string,
  fallback: string | null,
  label: string,
): string | null {
  const raw = optionalEnv(env, name);
  if (!raw) return fallback;
  return parsePubkey(raw, label);
}

function parseBigIntEnv(env: GenesisLiveBootstrapEnv, name: string, fallback: bigint): bigint {
  const raw = optionalEnv(env, name);
  if (!raw) return fallback;
  try {
    const value = BigInt(raw);
    if (value < 0n) {
      throw new Error("negative");
    }
    return value;
  } catch {
    throw new Error(`Invalid ${name}: expected a non-negative integer base-unit amount.`);
  }
}

function absolutePublicUri(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const normalized = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${GENESIS_PROTECT_ACUTE_PUBLIC_DISCLOSURE_BASE_URL}${normalized}`;
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function schemaKeyHashHex(schemaKey: string, schemaVersion: number): string {
  return sha256Hex(`schema:${schemaKey}:v${schemaVersion}`);
}

export function loadGenesisLiveBootstrapConfig(params: {
  env?: GenesisLiveBootstrapEnv;
  governanceAuthority: string;
}): GenesisLiveBootstrapConfig {
  const env = params.env ?? process.env;
  const governanceAuthority = parsePubkey(params.governanceAuthority, "governance authority");
  const settlementMint = parsePubkey(
    requiredEnv(env, "OMEGAX_LIVE_SETTLEMENT_MINT"),
    "OMEGAX_LIVE_SETTLEMENT_MINT",
  );
  const reserveDomainId = optionalEnv(env, "OMEGAX_LIVE_RESERVE_DOMAIN_ID") ?? "open-health-usdc";
  const reserveDomainDisplayName =
    optionalEnv(env, "OMEGAX_LIVE_RESERVE_DOMAIN_DISPLAY_NAME") ?? "Open Health USDC";
  const reserveDomainAdmin = optionalPubkey(
    env,
    "OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN",
    governanceAuthority,
    "OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN",
  )!;
  const sponsor = optionalPubkey(
    env,
    "OMEGAX_LIVE_SPONSOR_WALLET",
    governanceAuthority,
    "OMEGAX_LIVE_SPONSOR_WALLET",
  )!;
  const sponsorOperator = optionalPubkey(
    env,
    "OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET",
    governanceAuthority,
    "OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET",
  )!;
  const claimsOperator = optionalPubkey(
    env,
    "OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET",
    governanceAuthority,
    "OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET",
  )!;
  const oracleAuthority = optionalPubkey(
    env,
    "OMEGAX_LIVE_ORACLE_WALLET",
    null,
    "OMEGAX_LIVE_ORACLE_WALLET",
  );
  const oracleKeypairPath = requiredEnv(env, "OMEGAX_LIVE_ORACLE_KEYPAIR_PATH");
  if (!oracleAuthority) {
    throw new Error("Missing required environment variable OMEGAX_LIVE_ORACLE_WALLET.");
  }
  const poolCurator = optionalPubkey(
    env,
    "OMEGAX_LIVE_POOL_CURATOR_WALLET",
    governanceAuthority,
    "OMEGAX_LIVE_POOL_CURATOR_WALLET",
  )!;
  const poolAllocator = optionalPubkey(
    env,
    "OMEGAX_LIVE_POOL_ALLOCATOR_WALLET",
    governanceAuthority,
    "OMEGAX_LIVE_POOL_ALLOCATOR_WALLET",
  )!;
  const poolSentinel = optionalPubkey(
    env,
    "OMEGAX_LIVE_POOL_SENTINEL_WALLET",
    governanceAuthority,
    "OMEGAX_LIVE_POOL_SENTINEL_WALLET",
  )!;

  const membershipInviteAuthority = optionalPubkey(
    env,
    "OMEGAX_LIVE_MEMBERSHIP_INVITE_AUTHORITY",
    null,
    "OMEGAX_LIVE_MEMBERSHIP_INVITE_AUTHORITY",
  );

  // Mainnet privileged-role guard. See
  // docs/security/mainnet-privileged-role-controls.md §4 for the full policy.
  //
  // PT-2026-04-27-05 closed the silent role-collapse case via the opt-in
  // OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 flag. The guard below tightens
  // that into a hard-fail: any bootstrap that resolves to a mainnet RPC URL
  // (or sets OMEGAX_LIVE_CLUSTER_OVERRIDE=mainnet) must (a) set the distinct-
  // keys flag explicitly, and (b) provide explicit env vars for every
  // operational role so none default to the governance signer. The break-
  // glass override OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1 exists for
  // documented rehearsal or emergency recovery and emits a loud warning to
  // stderr so it appears in the release-candidate evidence trail.
  const rpcUrlForGuard =
    optionalEnv(env, "SOLANA_RPC_URL")
    ?? optionalEnv(env, "NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL")
    ?? optionalEnv(env, "NEXT_PUBLIC_SOLANA_RPC_URL")
    ?? "https://api.mainnet-beta.solana.com";
  const clusterOverride = optionalEnv(env, "OMEGAX_LIVE_CLUSTER_OVERRIDE")?.toLowerCase() ?? null;
  const targetingMainnet =
    clusterOverride === "mainnet"
    || (clusterOverride !== "devnet" && clusterOverride !== "localnet" && isMainnetCluster(rpcUrlForGuard));
  const breakGlass = env.OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET === "1";

  if (targetingMainnet && !breakGlass) {
    if (env.OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS !== "1") {
      throw new Error(
        "Mainnet bootstrap blocked: OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 is required for live cluster bootstraps. "
          + "Set it explicitly, or set OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1 as a documented break-glass override "
          + "(record the override in the release-candidate evidence template). "
          + "See docs/security/mainnet-privileged-role-controls.md §3-4.",
      );
    }
    const requiredRoleEnvVars = [
      "OMEGAX_LIVE_RESERVE_DOMAIN_ADMIN",
      "OMEGAX_LIVE_SPONSOR_WALLET",
      "OMEGAX_LIVE_SPONSOR_OPERATOR_WALLET",
      "OMEGAX_LIVE_CLAIMS_OPERATOR_WALLET",
      "OMEGAX_LIVE_POOL_CURATOR_WALLET",
      "OMEGAX_LIVE_POOL_ALLOCATOR_WALLET",
      "OMEGAX_LIVE_POOL_SENTINEL_WALLET",
    ];
    const missingRoleEnvVars = requiredRoleEnvVars.filter((name) => !optionalEnv(env, name));
    if (missingRoleEnvVars.length > 0) {
      throw new Error(
        `Mainnet bootstrap blocked: ${missingRoleEnvVars.length} privileged role(s) would default to the governance signer: `
          + `${missingRoleEnvVars.join(", ")}. Set each to an explicit, distinct wallet (multisig PDA strongly recommended for governance and high-value roles), `
          + "or set OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1 as a documented break-glass override. "
          + "See docs/security/mainnet-privileged-role-controls.md §1-4.",
      );
    }
  } else if (targetingMainnet && breakGlass) {
    process.stderr.write(
      "[bootstrap] BREAK-GLASS: OMEGAX_ALLOW_LOCAL_SIGNER_FOR_MAINNET=1 active. "
        + "Privileged roles may default to the governance signer; record this override in the release-candidate evidence template.\n",
    );
  }

  // PT-2026-04-27-05 fix: opt-in validation that operator roles are distinct
  // pubkeys. Set OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 in the operator
  // environment for mainnet bootstrap to refuse a config where governance,
  // sponsor, claims_operator, oracle, pool curator/allocator/sentinel, etc.
  // collapse onto a single keypair. Without this guard the defaults silently
  // route every role through governanceAuthority — a single compromise drains
  // the whole protocol.
  if (env.OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS === "1") {
    const toBase58 = (value: PublicKey | string): string =>
      typeof value === "string" ? value : value.toBase58();
    const roleKeys: Array<[string, PublicKey | string]> = [
      ["governance", governanceAuthority],
      ["reserveDomainAdmin", reserveDomainAdmin],
      ["sponsor", sponsor],
      ["sponsorOperator", sponsorOperator],
      ["claimsOperator", claimsOperator],
      ["oracle", oracleAuthority],
      ["poolCurator", poolCurator],
      ["poolAllocator", poolAllocator],
      ["poolSentinel", poolSentinel],
    ];
    if (membershipInviteAuthority) {
      roleKeys.push(["membershipInviteAuthority", membershipInviteAuthority]);
    }
    const seen = new Map<string, string>();
    for (const [role, key] of roleKeys) {
      const k = toBase58(key);
      const prior = seen.get(k);
      if (prior) {
        throw new Error(
          `OMEGAX_REQUIRE_DISTINCT_OPERATOR_KEYS=1 but roles "${prior}" and "${role}" both resolve to ${k}`,
        );
      }
      seen.set(k, role);
    }
  }
  const membershipMode = membershipInviteAuthority ? 2 : 0;
  const membershipGateKind = membershipInviteAuthority ? 1 : 0;

  const reserveDomainAddress = deriveReserveDomainPda({ domainId: reserveDomainId }).toBase58();
  const healthPlanAddress = deriveHealthPlanPda({
    reserveDomain: reserveDomainAddress,
    planId: GENESIS_PROTECT_ACUTE_PLAN_ID,
  }).toBase58();
  const event7SeriesAddress = derivePolicySeriesPda({
    healthPlan: healthPlanAddress,
    seriesId: GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId,
  }).toBase58();
  const travel30SeriesAddress = derivePolicySeriesPda({
    healthPlan: healthPlanAddress,
    seriesId: GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
  }).toBase58();

  const event7SponsorLineAddress = deriveFundingLinePda({
    healthPlan: healthPlanAddress,
    lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.sponsor!,
  }).toBase58();
  const event7PremiumLineAddress = deriveFundingLinePda({
    healthPlan: healthPlanAddress,
    lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.premium,
  }).toBase58();
  const event7LiquidityLineAddress = deriveFundingLinePda({
    healthPlan: healthPlanAddress,
    lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.liquidity,
  }).toBase58();
  const travel30PremiumLineAddress = deriveFundingLinePda({
    healthPlan: healthPlanAddress,
    lineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium,
  }).toBase58();
  const travel30LiquidityLineAddress = deriveFundingLinePda({
    healthPlan: healthPlanAddress,
    lineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity,
  }).toBase58();

  const poolAddress = deriveLiquidityPoolPda({
    reserveDomain: reserveDomainAddress,
    poolId: GENESIS_PROTECT_ACUTE_POOL_ID,
  }).toBase58();
  const seniorClassAddress = deriveCapitalClassPda({
    liquidityPool: poolAddress,
    classId: GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
  }).toBase58();
  const juniorClassAddress = deriveCapitalClassPda({
    liquidityPool: poolAddress,
    classId: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
  }).toBase58();

  const schemaKey = optionalEnv(env, "OMEGAX_LIVE_SCHEMA_KEY") ?? GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_KEY;
  const schemaVersionRaw = optionalEnv(env, "OMEGAX_LIVE_SCHEMA_VERSION");
  const schemaVersion = schemaVersionRaw ? Number.parseInt(schemaVersionRaw, 10) : GENESIS_PROTECT_ACUTE_EVIDENCE_SCHEMA_VERSION;
  if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
    throw new Error("Invalid OMEGAX_LIVE_SCHEMA_VERSION: expected a positive integer.");
  }
  const schemaMetadataLocalPath = resolve(
    process.cwd(),
    optionalEnv(env, "OMEGAX_LIVE_SCHEMA_METADATA_FILE")
      ?? "frontend/public/schemas/genesis-protect-acute-claim-v1.json",
  );
  const schemaMetadataUri = absolutePublicUri(
    optionalEnv(env, "OMEGAX_LIVE_SCHEMA_METADATA_URI") ?? "/schemas/genesis-protect-acute-claim-v1.json",
  );

  const seniorDepositAmount = parseBigIntEnv(env, "OMEGAX_LIVE_SENIOR_CLASS_DEPOSIT_AMOUNT", 0n);
  const juniorDepositAmount = parseBigIntEnv(env, "OMEGAX_LIVE_JUNIOR_CLASS_DEPOSIT_AMOUNT", 0n);
  const seniorLpKeypairPath = optionalEnv(env, "OMEGAX_LIVE_SENIOR_LP_KEYPAIR_PATH");
  const juniorLpKeypairPath = optionalEnv(env, "OMEGAX_LIVE_JUNIOR_LP_KEYPAIR_PATH");
  if (seniorDepositAmount > 0n && !seniorLpKeypairPath) {
    throw new Error("OMEGAX_LIVE_SENIOR_LP_KEYPAIR_PATH is required when OMEGAX_LIVE_SENIOR_CLASS_DEPOSIT_AMOUNT is set.");
  }
  if (juniorDepositAmount > 0n && !juniorLpKeypairPath) {
    throw new Error("OMEGAX_LIVE_JUNIOR_LP_KEYPAIR_PATH is required when OMEGAX_LIVE_JUNIOR_CLASS_DEPOSIT_AMOUNT is set.");
  }

  return {
    rpcUrl:
      optionalEnv(env, "SOLANA_RPC_URL")
      ?? optionalEnv(env, "NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL")
      ?? optionalEnv(env, "NEXT_PUBLIC_SOLANA_RPC_URL")
      ?? "https://api.mainnet-beta.solana.com",
    governanceAuthority,
    governanceConfigAddress: optionalPubkey(
      env,
      "GOVERNANCE_CONFIG",
      optionalPubkey(env, "NEXT_PUBLIC_GOVERNANCE_CONFIG", null, "NEXT_PUBLIC_GOVERNANCE_CONFIG"),
      "GOVERNANCE_CONFIG",
    ),
    settlementMint,
    reserveDomain: {
      id: reserveDomainId,
      displayName: reserveDomainDisplayName,
      address: reserveDomainAddress,
      admin: reserveDomainAdmin,
    },
    roles: {
      sponsor,
      sponsorOperator,
      claimsOperator,
      oracleAuthority,
      oracleKeypairPath,
      poolCurator,
      poolAllocator,
      poolSentinel,
    },
    schema: {
      key: schemaKey,
      version: schemaVersion,
      keyHashHex: schemaKeyHashHex(schemaKey, schemaVersion),
      metadataLocalPath: schemaMetadataLocalPath,
      metadataUri: schemaMetadataUri,
    },
    healthPlan: {
      planId: GENESIS_PROTECT_ACUTE_PLAN_ID,
      address: healthPlanAddress,
      displayName: GENESIS_PROTECT_ACUTE_PLAN_DISPLAY_NAME,
      metadataUri: absolutePublicUri(GENESIS_PROTECT_ACUTE_PLAN_METADATA_URI),
      sponsorLabel: GENESIS_PROTECT_ACUTE_SPONSOR_LABEL,
      membershipMode,
      membershipGateKind,
      membershipInviteAuthority,
    },
    policySeries: {
      event7: {
        address: event7SeriesAddress,
        seriesId: GENESIS_PROTECT_ACUTE_SKUS.event7.seriesId,
        displayName: GENESIS_PROTECT_ACUTE_SKUS.event7.displayName,
        metadataUri: absolutePublicUri(GENESIS_PROTECT_ACUTE_SKUS.event7.metadataUri),
        assetMint: settlementMint,
        mode: SERIES_MODE_PROTECTION,
        status: SERIES_STATUS_ACTIVE,
        comparabilityKey: GENESIS_PROTECT_ACUTE_SKUS.event7.comparabilityKey,
      },
      travel30: {
        address: travel30SeriesAddress,
        seriesId: GENESIS_PROTECT_ACUTE_SKUS.travel30.seriesId,
        displayName: GENESIS_PROTECT_ACUTE_SKUS.travel30.displayName,
        metadataUri: absolutePublicUri(GENESIS_PROTECT_ACUTE_SKUS.travel30.metadataUri),
        assetMint: settlementMint,
        mode: SERIES_MODE_PROTECTION,
        status: SERIES_STATUS_ACTIVE,
        comparabilityKey: GENESIS_PROTECT_ACUTE_SKUS.travel30.comparabilityKey,
      },
    },
    fundingLines: {
      event7Sponsor: {
        address: event7SponsorLineAddress,
        lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.sponsor!,
        displayName: "Genesis Event 7 sponsor backstop",
        lineType: FUNDING_LINE_TYPE_SPONSOR_BUDGET,
        fundingPriority: 0,
      },
      event7Premium: {
        address: event7PremiumLineAddress,
        lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.premium,
        displayName: "Genesis Event 7 member premiums",
        lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
        fundingPriority: 1,
      },
      event7Liquidity: {
        address: event7LiquidityLineAddress,
        lineId: GENESIS_PROTECT_ACUTE_SKUS.event7.fundingLineIds.liquidity,
        displayName: "Genesis Event 7 LP reserve lane",
        lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
        fundingPriority: 2,
      },
      travel30Premium: {
        address: travel30PremiumLineAddress,
        lineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.premium,
        displayName: "Genesis Travel 30 member premiums",
        lineType: FUNDING_LINE_TYPE_PREMIUM_INCOME,
        fundingPriority: 3,
      },
      travel30Liquidity: {
        address: travel30LiquidityLineAddress,
        lineId: GENESIS_PROTECT_ACUTE_SKUS.travel30.fundingLineIds.liquidity,
        displayName: "Genesis Travel 30 LP reserve lane",
        lineType: FUNDING_LINE_TYPE_LIQUIDITY_POOL_ALLOCATION,
        fundingPriority: 4,
      },
    },
    liquidityPool: {
      address: poolAddress,
      poolId: GENESIS_PROTECT_ACUTE_POOL_ID,
      displayName: GENESIS_PROTECT_ACUTE_POOL_DISPLAY_NAME,
      strategyThesis: GENESIS_PROTECT_ACUTE_POOL_STRATEGY_THESIS,
      redemptionPolicy: REDEMPTION_POLICY_QUEUE_ONLY,
    },
    capitalClasses: {
      senior: {
        address: seniorClassAddress,
        classId: GENESIS_PROTECT_ACUTE_SENIOR_CLASS_ID,
        displayName: GENESIS_PROTECT_ACUTE_SENIOR_CLASS_DISPLAY_NAME,
        priority: 0,
        restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
        minLockupSeconds: 30n * 86_400n,
        depositAmount: seniorDepositAmount,
        lpKeypairPath: seniorLpKeypairPath,
      },
      junior: {
        address: juniorClassAddress,
        classId: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_ID,
        displayName: GENESIS_PROTECT_ACUTE_JUNIOR_CLASS_DISPLAY_NAME,
        priority: 1,
        restrictionMode: CAPITAL_CLASS_RESTRICTION_OPEN,
        minLockupSeconds: 30n * 86_400n,
        depositAmount: juniorDepositAmount,
        lpKeypairPath: juniorLpKeypairPath,
      },
    },
    allocations: {
      event7Junior: {
        address: deriveAllocationPositionPda({
          capitalClass: juniorClassAddress,
          fundingLine: event7LiquidityLineAddress,
        }).toBase58(),
        capAmount: parseBigIntEnv(env, "OMEGAX_LIVE_EVENT7_JUNIOR_CAP_AMOUNT", 15_000n),
        weightBps: Number.parseInt(optionalEnv(env, "OMEGAX_LIVE_EVENT7_JUNIOR_WEIGHT_BPS") ?? "2175", 10),
        allocationAmount: parseBigIntEnv(env, "OMEGAX_LIVE_EVENT7_JUNIOR_ALLOCATION_AMOUNT", 0n),
      },
      travel30Senior: {
        address: deriveAllocationPositionPda({
          capitalClass: seniorClassAddress,
          fundingLine: travel30LiquidityLineAddress,
        }).toBase58(),
        capAmount: parseBigIntEnv(env, "OMEGAX_LIVE_TRAVEL30_SENIOR_CAP_AMOUNT", 27_500n),
        weightBps: Number.parseInt(optionalEnv(env, "OMEGAX_LIVE_TRAVEL30_SENIOR_WEIGHT_BPS") ?? "4350", 10),
        allocationAmount: parseBigIntEnv(env, "OMEGAX_LIVE_TRAVEL30_SENIOR_ALLOCATION_AMOUNT", 0n),
      },
      travel30Junior: {
        address: deriveAllocationPositionPda({
          capitalClass: juniorClassAddress,
          fundingLine: travel30LiquidityLineAddress,
        }).toBase58(),
        capAmount: parseBigIntEnv(env, "OMEGAX_LIVE_TRAVEL30_JUNIOR_CAP_AMOUNT", 22_500n),
        weightBps: Number.parseInt(optionalEnv(env, "OMEGAX_LIVE_TRAVEL30_JUNIOR_WEIGHT_BPS") ?? "3475", 10),
        allocationAmount: parseBigIntEnv(env, "OMEGAX_LIVE_TRAVEL30_JUNIOR_ALLOCATION_AMOUNT", 0n),
      },
    },
    fundingAmounts: {
      event7SponsorBudget: parseBigIntEnv(env, "OMEGAX_LIVE_EVENT7_SPONSOR_BUDGET_AMOUNT", 0n),
      event7Premium: parseBigIntEnv(env, "OMEGAX_LIVE_EVENT7_PREMIUM_AMOUNT", 0n),
      travel30Premium: parseBigIntEnv(env, "OMEGAX_LIVE_TRAVEL30_PREMIUM_AMOUNT", 0n),
    },
  };
}
