// SPDX-License-Identifier: AGPL-3.0-or-later

import { InstructionExecutionStatus } from "@solana/spl-governance";

export const DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw";
export const STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX =
  "57690ad212710f5a11f98dc908868c017cb60d36e503cb6db01b463b0f845fa7";
export const DEFAULT_GOVERNANCE_SMOKE_DEPOSIT_TARGET_RAW = 1n;
export const DEFAULT_GOVERNANCE_SMOKE_MIN_FEE_BALANCE_LAMPORTS = 250_000_000n;
export const DEFAULT_GOVERNANCE_SMOKE_AIRDROP_LAMPORTS = 1_000_000_000n;
export const DEFAULT_GOVERNANCE_SMOKE_DESCRIPTION_ORIGIN = "https://protocol.omegax.health";

export type GovernanceSmokeMode = "create-vote" | "execute";

export type GovernanceSharedConfig = {
  governanceAddress: string;
  governanceCluster: string;
  governanceProgramId: string;
  governanceProgramVersion: number | null;
  governanceTokenMint: string;
  realmAddress: string;
  rpcUrl: string;
};

export type GovernanceWriteSmokeConfig = GovernanceSharedConfig & {
  airdropLamports: bigint;
  depositTargetRaw: bigint;
  descriptionOrigin: string;
  governanceSecretKeyBase58: string;
  minFeeBalanceLamports: bigint;
  mode: GovernanceSmokeMode;
  smokeProposalAddress: string | null;
  smokeSchemaKeyHashHex: string | null;
};

export type GovernanceUiReadonlyConfig = GovernanceSharedConfig & {
  proposalAddress: string;
};

type ProposalExecutionTiming = {
  proposalTransactions: Array<{
    executionStatus: number;
    holdUpTimeSeconds: number;
  }>;
  votingCompletedAtIso: string | null;
};

function readEnvValue(env: NodeJS.ProcessEnv, names: string[]): string | null {
  for (const name of names) {
    const value = String(env[name] ?? "").trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function requireEnvValue(env: NodeJS.ProcessEnv, names: string[], label: string): string {
  const value = readEnvValue(env, names);
  if (!value) {
    throw new Error(`Missing required env var: ${label}`);
  }
  return value;
}

function parseOptionalPositiveInteger(raw: string | null, label: string): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: expected a positive integer`);
  }
  return parsed;
}

function parsePositiveBigInt(value: string | null, label: string, fallback: bigint): bigint {
  if (!value) return fallback;
  try {
    const parsed = BigInt(value);
    if (parsed <= 0n) {
      throw new Error("non-positive");
    }
    return parsed;
  } catch {
    throw new Error(`Invalid ${label}: expected a positive integer`);
  }
}

function parseSharedConfig(env: NodeJS.ProcessEnv): GovernanceSharedConfig {
  return {
    governanceAddress: requireEnvValue(
      env,
      ["GOVERNANCE_CONFIG", "NEXT_PUBLIC_GOVERNANCE_CONFIG"],
      "GOVERNANCE_CONFIG",
    ),
    governanceCluster:
      readEnvValue(env, [
        "GOVERNANCE_CLUSTER",
        "NEXT_PUBLIC_REALMS_CLUSTER",
        "NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER",
      ]) ?? "devnet",
    governanceProgramId:
      readEnvValue(env, [
        "GOVERNANCE_PROGRAM_ID",
        "NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID",
      ]) ?? DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID,
    governanceProgramVersion: parseOptionalPositiveInteger(
      readEnvValue(env, [
        "GOVERNANCE_PROGRAM_VERSION",
        "NEXT_PUBLIC_GOVERNANCE_PROGRAM_VERSION",
      ]),
      "GOVERNANCE_PROGRAM_VERSION",
    ),
    governanceTokenMint: requireEnvValue(
      env,
      ["GOVERNANCE_TOKEN_MINT", "NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT"],
      "GOVERNANCE_TOKEN_MINT",
    ),
    realmAddress: requireEnvValue(
      env,
      ["GOVERNANCE_REALM", "NEXT_PUBLIC_GOVERNANCE_REALM"],
      "GOVERNANCE_REALM",
    ),
    rpcUrl:
      readEnvValue(env, [
        "SOLANA_RPC_URL",
        "NEXT_PUBLIC_SOLANA_RPC_URL",
        "NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL",
      ]) ?? "https://api.devnet.solana.com",
  };
}

export function normalizeSmokeSchemaKeyHash(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("GOVERNANCE_SMOKE_SCHEMA_KEY_HASH_HEX must be a 32-byte hex value");
  }
  return normalized;
}

export function assertDisposableSmokeSchemaKeyHash(value: string): string {
  const normalized = normalizeSmokeSchemaKeyHash(value);
  if (normalized === STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX) {
    throw new Error(
      `Refusing to use the checked-in standard outcomes schema hash (${STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX}) for governance smoke writes.`,
    );
  }
  return normalized;
}

export function parseGovernanceSmokeMode(argv: string[] = process.argv.slice(2)): GovernanceSmokeMode {
  const mode = argv[0]?.trim().toLowerCase();
  if (mode === "create-vote" || mode === "execute") {
    return mode;
  }
  throw new Error("Usage: devnet_governance_smoke.ts <create-vote|execute>");
}

export function readGovernanceWriteSmokeConfig(params?: {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
}): GovernanceWriteSmokeConfig {
  const env = params?.env ?? process.env;
  const mode = parseGovernanceSmokeMode(params?.argv ?? process.argv.slice(2));
  const shared = parseSharedConfig(env);

  return {
    ...shared,
    airdropLamports: parsePositiveBigInt(
      readEnvValue(env, ["GOVERNANCE_SMOKE_AIRDROP_LAMPORTS"]),
      "GOVERNANCE_SMOKE_AIRDROP_LAMPORTS",
      DEFAULT_GOVERNANCE_SMOKE_AIRDROP_LAMPORTS,
    ),
    depositTargetRaw: parsePositiveBigInt(
      readEnvValue(env, ["GOVERNANCE_SMOKE_DEPOSIT_TARGET_RAW"]),
      "GOVERNANCE_SMOKE_DEPOSIT_TARGET_RAW",
      DEFAULT_GOVERNANCE_SMOKE_DEPOSIT_TARGET_RAW,
    ),
    descriptionOrigin:
      readEnvValue(env, ["GOVERNANCE_SMOKE_DESCRIPTION_ORIGIN"])
      ?? DEFAULT_GOVERNANCE_SMOKE_DESCRIPTION_ORIGIN,
    governanceSecretKeyBase58: requireEnvValue(
      env,
      ["GOVERNANCE_SECRET_KEY_BASE58"],
      "GOVERNANCE_SECRET_KEY_BASE58",
    ),
    minFeeBalanceLamports: parsePositiveBigInt(
      readEnvValue(env, ["GOVERNANCE_SMOKE_MIN_FEE_BALANCE_LAMPORTS"]),
      "GOVERNANCE_SMOKE_MIN_FEE_BALANCE_LAMPORTS",
      DEFAULT_GOVERNANCE_SMOKE_MIN_FEE_BALANCE_LAMPORTS,
    ),
    mode,
    smokeProposalAddress:
      mode === "execute"
        ? requireEnvValue(
            env,
            ["GOVERNANCE_SMOKE_PROPOSAL_ADDRESS"],
            "GOVERNANCE_SMOKE_PROPOSAL_ADDRESS",
          )
        : (readEnvValue(env, ["GOVERNANCE_SMOKE_PROPOSAL_ADDRESS"]) ?? null),
    smokeSchemaKeyHashHex:
      mode === "create-vote"
        ? assertDisposableSmokeSchemaKeyHash(
            requireEnvValue(
              env,
              ["GOVERNANCE_SMOKE_SCHEMA_KEY_HASH_HEX"],
              "GOVERNANCE_SMOKE_SCHEMA_KEY_HASH_HEX",
            ),
          )
        : (readEnvValue(env, ["GOVERNANCE_SMOKE_SCHEMA_KEY_HASH_HEX"]) ?? null),
  };
}

export function readGovernanceUiReadonlyConfig(
  env: NodeJS.ProcessEnv = process.env,
): GovernanceUiReadonlyConfig {
  return {
    ...parseSharedConfig(env),
    proposalAddress: requireEnvValue(
      env,
      ["GOVERNANCE_SMOKE_PROPOSAL_ADDRESS"],
      "GOVERNANCE_SMOKE_PROPOSAL_ADDRESS",
    ),
  };
}

export function applyGovernanceSmokeFrontendEnv(
  env: NodeJS.ProcessEnv,
  config: GovernanceSharedConfig,
): void {
  // Smoke runs should use the explicitly configured governance target even when
  // a developer has different local NEXT_PUBLIC_* values in frontend/.env.local.
  env.NEXT_PUBLIC_REALMS_CLUSTER = config.governanceCluster;
  env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER = config.governanceCluster;
  env.NEXT_PUBLIC_SOLANA_RPC_URL = config.rpcUrl;
  env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL = config.rpcUrl;
  env.NEXT_PUBLIC_GOVERNANCE_REALM = config.realmAddress;
  env.NEXT_PUBLIC_GOVERNANCE_CONFIG = config.governanceAddress;
  env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT = config.governanceTokenMint;
  env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID = config.governanceProgramId;
  if (config.governanceProgramVersion != null) {
    env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_VERSION = String(config.governanceProgramVersion);
  }
}

export function shouldRequestGovernanceSmokeAirdrop(
  balanceLamports: bigint,
  minFeeBalanceLamports: bigint,
): boolean {
  return balanceLamports < minFeeBalanceLamports;
}

export function timestampedGovernanceSmokeProposalName(now = new Date()): string {
  return `Governance smoke schema state ${now.toISOString()}`;
}

export function computeCreateVoteEarliestExecutionIso(params: {
  createdAtMs: number;
  proposalTransactions: Array<{ holdUpTimeSeconds: number }>;
  rules: {
    baseVotingTimeSeconds: number;
    instructionHoldUpTimeSeconds: number;
  };
}): string {
  const transactionHoldUpSeconds = params.proposalTransactions.reduce(
    (max, row) => Math.max(max, row.holdUpTimeSeconds),
    params.rules.instructionHoldUpTimeSeconds,
  );
  const earliestMs =
    params.createdAtMs
    + (params.rules.baseVotingTimeSeconds + transactionHoldUpSeconds) * 1000;
  return new Date(earliestMs).toISOString();
}

export function computePendingExecutionReadyAtIso(
  proposal: ProposalExecutionTiming,
): string | null {
  if (!proposal.votingCompletedAtIso) {
    return null;
  }
  const votingCompletedAtMs = Date.parse(proposal.votingCompletedAtIso);
  if (!Number.isFinite(votingCompletedAtMs)) {
    return null;
  }
  const pendingTransactions = proposal.proposalTransactions.filter(
    (row) => row.executionStatus !== InstructionExecutionStatus.Success,
  );
  if (pendingTransactions.length === 0) {
    return new Date(votingCompletedAtMs).toISOString();
  }
  const holdUpSeconds = pendingTransactions.reduce(
    (max, row) => Math.max(max, row.holdUpTimeSeconds),
    0,
  );
  return new Date(votingCompletedAtMs + holdUpSeconds * 1000).toISOString();
}
