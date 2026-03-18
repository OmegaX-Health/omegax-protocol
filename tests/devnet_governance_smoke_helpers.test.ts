// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import test from "node:test";

import { InstructionExecutionStatus } from "@solana/spl-governance";

import * as helpers from "../scripts/devnet_governance_smoke_helpers.ts";

const SMOKE_SCHEMA_HASH = "aa".repeat(32);

test("readGovernanceWriteSmokeConfig applies defaults for create-vote mode", () => {
  const env: NodeJS.ProcessEnv = {
    GOVERNANCE_CONFIG: "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP",
    GOVERNANCE_REALM: "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA",
    GOVERNANCE_SECRET_KEY_BASE58: "smoke-secret",
    GOVERNANCE_SMOKE_SCHEMA_KEY_HASH_HEX: SMOKE_SCHEMA_HASH,
    GOVERNANCE_TOKEN_MINT: "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf",
    SOLANA_RPC_URL: "https://api.devnet.solana.com",
  };

  const config = helpers.readGovernanceWriteSmokeConfig({
    argv: ["create-vote"],
    env,
  });

  assert.equal(config.mode, "create-vote");
  assert.equal(config.smokeSchemaKeyHashHex, SMOKE_SCHEMA_HASH);
  assert.equal(config.smokeProposalAddress, null);
  assert.equal(config.depositTargetRaw, 1n);
  assert.equal(config.minFeeBalanceLamports, 250_000_000n);
  assert.equal(config.airdropLamports, 1_000_000_000n);
  assert.equal(config.descriptionOrigin, "https://protocol.omegax.health");
  assert.equal(config.governanceProgramId, helpers.DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID);
});

test("readGovernanceWriteSmokeConfig requires proposal address for execute mode", () => {
  const env: NodeJS.ProcessEnv = {
    GOVERNANCE_CONFIG: "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP",
    GOVERNANCE_REALM: "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA",
    GOVERNANCE_SECRET_KEY_BASE58: "smoke-secret",
    GOVERNANCE_SMOKE_PROPOSAL_ADDRESS: "7gY6i8ATug8qWaTgbEbf1fypoLxPEwcxY9E8QrbePKxK",
    GOVERNANCE_TOKEN_MINT: "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf",
    SOLANA_RPC_URL: "https://api.devnet.solana.com",
  };

  const config = helpers.readGovernanceWriteSmokeConfig({
    argv: ["execute"],
    env,
  });

  assert.equal(config.mode, "execute");
  assert.equal(config.smokeProposalAddress, env.GOVERNANCE_SMOKE_PROPOSAL_ADDRESS);
  assert.equal(config.smokeSchemaKeyHashHex, null);
});

test("assertDisposableSmokeSchemaKeyHash rejects the checked-in standard schema hash", () => {
  assert.throws(
    () => helpers.assertDisposableSmokeSchemaKeyHash(helpers.STANDARD_OUTCOMES_SCHEMA_KEY_HASH_HEX),
    /Refusing to use the checked-in standard outcomes schema hash/,
  );
  assert.equal(
    helpers.assertDisposableSmokeSchemaKeyHash(`0x${SMOKE_SCHEMA_HASH}`),
    SMOKE_SCHEMA_HASH,
  );
});

test("applyGovernanceSmokeFrontendEnv maps shared governance env to NEXT_PUBLIC vars", () => {
  const env: NodeJS.ProcessEnv = {};

  helpers.applyGovernanceSmokeFrontendEnv(env, {
    governanceAddress: "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP",
    governanceCluster: "devnet",
    governanceProgramId: helpers.DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID,
    governanceProgramVersion: 3,
    governanceTokenMint: "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf",
    realmAddress: "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA",
    rpcUrl: "https://api.devnet.solana.com",
  });

  assert.equal(env.NEXT_PUBLIC_REALMS_CLUSTER, "devnet");
  assert.equal(env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER, "devnet");
  assert.equal(env.NEXT_PUBLIC_SOLANA_RPC_URL, "https://api.devnet.solana.com");
  assert.equal(env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL, "https://api.devnet.solana.com");
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_REALM, "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA");
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_CONFIG, "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP");
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT, "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf");
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID, helpers.DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID);
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_VERSION, "3");
});

test("applyGovernanceSmokeFrontendEnv overrides stale NEXT_PUBLIC governance config", () => {
  const env: NodeJS.ProcessEnv = {
    NEXT_PUBLIC_GOVERNANCE_CONFIG: "stale-governance",
    NEXT_PUBLIC_GOVERNANCE_REALM: "stale-realm",
    NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT: "stale-mint",
    NEXT_PUBLIC_REALMS_CLUSTER: "mainnet-beta",
    NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL: "https://stale.example.invalid",
    NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER: "mainnet-beta",
    NEXT_PUBLIC_SOLANA_RPC_URL: "https://stale.example.invalid",
  };

  helpers.applyGovernanceSmokeFrontendEnv(env, {
    governanceAddress: "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP",
    governanceCluster: "devnet",
    governanceProgramId: helpers.DEFAULT_REALMS_GOVERNANCE_PROGRAM_ID,
    governanceProgramVersion: null,
    governanceTokenMint: "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf",
    realmAddress: "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA",
    rpcUrl: "https://api.devnet.solana.com",
  });

  assert.equal(env.NEXT_PUBLIC_REALMS_CLUSTER, "devnet");
  assert.equal(env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER, "devnet");
  assert.equal(env.NEXT_PUBLIC_SOLANA_RPC_URL, "https://api.devnet.solana.com");
  assert.equal(env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL, "https://api.devnet.solana.com");
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_REALM, "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA");
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_CONFIG, "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP");
  assert.equal(env.NEXT_PUBLIC_GOVERNANCE_TOKEN_MINT, "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf");
});

test("computeCreateVoteEarliestExecutionIso adds voting time and max hold-up", () => {
  const createdAtMs = Date.UTC(2026, 2, 18, 12, 0, 0);
  const iso = helpers.computeCreateVoteEarliestExecutionIso({
    createdAtMs,
    proposalTransactions: [{ holdUpTimeSeconds: 900 }, { holdUpTimeSeconds: 1200 }],
    rules: {
      baseVotingTimeSeconds: 3600,
      instructionHoldUpTimeSeconds: 900,
    },
  });

  assert.equal(iso, "2026-03-18T13:20:00.000Z");
});

test("computePendingExecutionReadyAtIso waits for voting completion plus pending hold-up", () => {
  const iso = helpers.computePendingExecutionReadyAtIso({
    proposalTransactions: [
      { executionStatus: InstructionExecutionStatus.Success, holdUpTimeSeconds: 900 },
      { executionStatus: InstructionExecutionStatus.None, holdUpTimeSeconds: 1200 },
    ],
    votingCompletedAtIso: "2026-03-18T12:00:00.000Z",
  });

  assert.equal(iso, "2026-03-18T12:20:00.000Z");
  assert.equal(
    helpers.computePendingExecutionReadyAtIso({
      proposalTransactions: [{ executionStatus: InstructionExecutionStatus.None, holdUpTimeSeconds: 900 }],
      votingCompletedAtIso: null,
    }),
    null,
  );
});

test("readGovernanceUiReadonlyConfig only requires shared governance env and proposal address", () => {
  const env: NodeJS.ProcessEnv = {
    GOVERNANCE_CONFIG: "27AFKaBMMPYzSBxBR24hyVDZE7GDYBFE7ae1hrYWBPFP",
    GOVERNANCE_REALM: "4ESvrUJ9bjyykG6gkR51qUDPQREJKJMmZ7gkv1E7q6QA",
    GOVERNANCE_SMOKE_PROPOSAL_ADDRESS: "7gY6i8ATug8qWaTgbEbf1fypoLxPEwcxY9E8QrbePKxK",
    GOVERNANCE_TOKEN_MINT: "8sz6kowsPjiLtCrdgcva8mS1CMZdZ9ZBFNzgEfpLoJxf",
    SOLANA_RPC_URL: "https://api.devnet.solana.com",
  };

  const config = helpers.readGovernanceUiReadonlyConfig(env);

  assert.equal(config.proposalAddress, env.GOVERNANCE_SMOKE_PROPOSAL_ADDRESS);
  assert.equal(config.governanceAddress, env.GOVERNANCE_CONFIG);
  assert.equal(config.realmAddress, env.GOVERNANCE_REALM);
});
