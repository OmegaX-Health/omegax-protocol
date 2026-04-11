// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import test from "node:test";

import consoleModelModule from "../frontend/lib/console-model.ts";
import fixturesModule from "../frontend/lib/devnet-fixtures.ts";
import protocolModule from "../frontend/lib/protocol.ts";
import {
  INSTRUCTION_EXCEPTION_REASONS,
  RETIRED_LEGACY_INSTRUCTIONS,
  SCENARIO_DEFINITIONS,
  blankInstructionExceptionReasons,
  duplicateOwnedInstructions,
  scenarioNames,
  type ScenarioName,
} from "./support/surface_manifest.ts";
import { instructionSurface } from "./support/surface.ts";

const { buildCanonicalConsoleState } = consoleModelModule as typeof import("../frontend/lib/console-model.ts");
const { DEVNET_PROTOCOL_FIXTURE_STATE } = fixturesModule as typeof import("../frontend/lib/devnet-fixtures.ts");
const {
  CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY,
  CLAIM_INTAKE_APPROVED,
  CLAIM_INTAKE_SETTLED,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RESERVED,
  OBLIGATION_STATUS_SETTLED,
  SERIES_MODE_PROTECTION,
  SERIES_MODE_REWARD,
  buildBackfillSchemaDependencyLedgerTx,
  buildClaimOracleTx,
  buildCloseOutcomeSchemaTx,
  buildRegisterOracleTx,
  buildRegisterOutcomeSchemaTx,
  buildSetPoolOraclePermissionsTx,
  buildSetPoolOraclePolicyTx,
  buildSetPoolOracleTx,
  buildUpdateOracleProfileTx,
  buildVerifyOutcomeSchemaTx,
  deriveOracleProfilePda,
  deriveOutcomeSchemaPda,
  derivePoolOracleApprovalPda,
  derivePoolOraclePermissionSetPda,
  derivePoolOraclePolicyPda,
  deriveSchemaDependencyLedgerPda,
  getProgramId,
  recomputeReserveBalanceSheet,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const consoleState = buildCanonicalConsoleState();
const selectedScenario = String(process.env.OMEGAX_E2E_SCENARIO ?? "").trim() || null;
const orderedScenarios = scenarioNames();
const STATIC_BLOCKHASH = "11111111111111111111111111111111";
const SAMPLE_SCHEMA_KEY_HASH_HEX = "11".repeat(32);
const SAMPLE_SCHEMA_HASH_HEX = "22".repeat(32);

if (selectedScenario && !orderedScenarios.includes(selectedScenario as ScenarioName)) {
  throw new Error(
    `Unknown OMEGAX_E2E_SCENARIO "${selectedScenario}". Expected one of: ${orderedScenarios.join(", ")}`,
  );
}

function stableSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

const liveInstructionNames = stableSorted(instructionSurface().map((instruction) => instruction.name));
const ownedInstructionNames = stableSorted([
  ...orderedScenarios.flatMap((name) => SCENARIO_DEFINITIONS[name].instructions),
  ...Object.keys(INSTRUCTION_EXCEPTION_REASONS),
]);
const duplicateAssignments = duplicateOwnedInstructions();
const blankExceptionReasons = blankInstructionExceptionReasons();
const missingInstructions = liveInstructionNames.filter((name) => !ownedInstructionNames.includes(name));
const unexpectedOwnedInstructions = ownedInstructionNames.filter((name) => !liveInstructionNames.includes(name));
const retiredLegacyPresent = RETIRED_LEGACY_INSTRUCTIONS.filter((name) => liveInstructionNames.includes(name));

function writeSummary() {
  const summaryPath = process.env.OMEGAX_E2E_SUMMARY_PATH;
  if (!summaryPath) return;

  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        programId: getProgramId().toBase58(),
        selectedScenario,
        scenarioFamilies: orderedScenarios.map((name) => ({
          name,
          title: SCENARIO_DEFINITIONS[name].title,
          instructionCount: SCENARIO_DEFINITIONS[name].instructions.length,
        })),
        instructionCoverage: {
          liveCount: liveInstructionNames.length,
          ownedCount: ownedInstructionNames.length,
          missingInstructions,
          unexpectedOwnedInstructions,
          duplicateAssignments,
          blankExceptionReasons,
          retiredLegacyPresent,
        },
        reserveDomains: DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.length,
        healthPlans: DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.length,
        policySeries: DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.length,
        liquidityPools: DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.length,
        capitalClasses: DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.length,
        obligations: DEVNET_PROTOCOL_FIXTURE_STATE.obligations.length,
        claims: DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.length,
      },
      null,
      2,
    )}\n`,
  );
}

writeSummary();

test("localnet surface audit: canonical instruction ownership matches the live surface", () => {
  assert.deepEqual(duplicateAssignments, []);
  assert.deepEqual(blankExceptionReasons, []);
  assert.deepEqual(missingInstructions, []);
  assert.deepEqual(unexpectedOwnedInstructions, []);
  assert.deepEqual(retiredLegacyPresent, []);
});

const scenarioAssertions: Record<ScenarioName, () => void> = {
  governance_and_scoped_controls: () => {
    const roles = new Set(DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.map((row) => row.role));

    assert(roles.has("protocol_governance"));
    assert(roles.has("domain_admin"));
    assert(roles.has("plan_admin"));
    assert(roles.has("pool_sentinel"));
    assert(consoleState.glossary.some((row) => row.noun === "ReserveDomain"));
    assert(consoleState.glossary.some((row) => row.noun === "HealthPlan"));
    assert(consoleState.glossary.some((row) => row.noun === "CapitalClass"));
    assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.every((domain) => typeof domain.pauseFlags === "number"), true);
    assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.every((plan) => typeof plan.pauseFlags === "number"), true);
  },
  oracle_registry_and_pool_control_lifecycle: () => {
    const governanceWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "protocol_governance")!;
    const oracleWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "oracle_operator")!;
    const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
    const oracleRole = DEVNET_PROTOCOL_FIXTURE_STATE.roleMatrix.find((row) => row.role === "oracle_operator")!;
    const oracleProfile = deriveOracleProfilePda({ oracle: oracleWallet.address }).toBase58();
    const approval = derivePoolOracleApprovalPda({
      liquidityPool: pool.address,
      oracle: oracleWallet.address,
    }).toBase58();
    const permissionSet = derivePoolOraclePermissionSetPda({
      liquidityPool: pool.address,
      oracle: oracleWallet.address,
    }).toBase58();
    const policy = derivePoolOraclePolicyPda({ liquidityPool: pool.address }).toBase58();
    const registerTx = buildRegisterOracleTx({
      admin: governanceWallet.address,
      oracle: oracleWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      oracleType: 1,
      displayName: "Canonical Oracle Operator",
      legalName: "Canonical Oracle Operator LLC",
      websiteUrl: "https://protocol.omegax.health/oracles",
      appUrl: "https://protocol.omegax.health/oracles/app",
      logoUri: "https://protocol.omegax.health/oracles/logo.svg",
      webhookUrl: "https://protocol.omegax.health/oracles/webhook",
      supportedSchemaKeyHashesHex: [SAMPLE_SCHEMA_KEY_HASH_HEX],
    });
    const claimTx = buildClaimOracleTx({
      oracle: oracleWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
    });
    const updateTx = buildUpdateOracleProfileTx({
      authority: governanceWallet.address,
      oracle: oracleWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      oracleType: 2,
      displayName: "Canonical Oracle Operator",
      legalName: "Canonical Oracle Operator LLC",
      websiteUrl: "https://protocol.omegax.health/oracles",
      appUrl: "https://protocol.omegax.health/oracles/app",
      logoUri: "https://protocol.omegax.health/oracles/logo.svg",
      webhookUrl: "https://protocol.omegax.health/oracles/webhook",
      supportedSchemaKeyHashesHex: [SAMPLE_SCHEMA_KEY_HASH_HEX],
    });
    const setOracleTx = buildSetPoolOracleTx({
      authority: governanceWallet.address,
      poolAddress: pool.address,
      oracle: oracleWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      active: true,
    });
    const setPermissionsTx = buildSetPoolOraclePermissionsTx({
      authority: governanceWallet.address,
      poolAddress: pool.address,
      oracle: oracleWallet.address,
      permissions: 0b111,
      recentBlockhash: STATIC_BLOCKHASH,
    });
    const setPolicyTx = buildSetPoolOraclePolicyTx({
      authority: governanceWallet.address,
      poolAddress: pool.address,
      recentBlockhash: STATIC_BLOCKHASH,
      quorumM: 2,
      quorumN: 3,
      requireVerifiedSchema: true,
      oracleFeeBps: 25,
      allowDelegateClaim: true,
      challengeWindowSecs: 86_400,
    });

    assert(oracleRole.actions.some((action) => action.includes("attest")));
    assert.equal(registerTx.instructions[0]!.keys[1]!.pubkey.toBase58(), oracleProfile);
    assert.equal(claimTx.instructions[0]!.keys[1]!.pubkey.toBase58(), oracleProfile);
    assert.equal(updateTx.instructions[0]!.keys[2]!.pubkey.toBase58(), oracleProfile);
    assert.equal(setOracleTx.instructions[0]!.keys[2]!.pubkey.toBase58(), pool.address);
    assert.equal(setOracleTx.instructions[0]!.keys[4]!.pubkey.toBase58(), approval);
    assert.equal(setPermissionsTx.instructions[0]!.keys[5]!.pubkey.toBase58(), permissionSet);
    assert.equal(setPolicyTx.instructions[0]!.keys[3]!.pubkey.toBase58(), policy);
  },
  schema_registry_and_binding_lifecycle: () => {
    const governanceWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "protocol_governance")!;
    const protectionSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.mode === SERIES_MODE_PROTECTION)!;
    const outcomeSchema = deriveOutcomeSchemaPda({ schemaKeyHashHex: SAMPLE_SCHEMA_KEY_HASH_HEX }).toBase58();
    const dependencyLedger = deriveSchemaDependencyLedgerPda({
      schemaKeyHashHex: SAMPLE_SCHEMA_KEY_HASH_HEX,
    }).toBase58();
    const registerTx = buildRegisterOutcomeSchemaTx({
      publisher: governanceWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      schemaKeyHashHex: SAMPLE_SCHEMA_KEY_HASH_HEX,
      schemaKey: protectionSeries.comparabilityKey,
      version: 1,
      schemaHashHex: SAMPLE_SCHEMA_HASH_HEX,
      schemaFamily: 1,
      visibility: 1,
      metadataUri: protectionSeries.metadataUri,
    });
    const verifyTx = buildVerifyOutcomeSchemaTx({
      governanceAuthority: governanceWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      schemaKeyHashHex: SAMPLE_SCHEMA_KEY_HASH_HEX,
      verified: true,
    });
    const backfillTx = buildBackfillSchemaDependencyLedgerTx({
      governanceAuthority: governanceWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      schemaKeyHashHex: SAMPLE_SCHEMA_KEY_HASH_HEX,
      poolRuleAddresses: [DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!.address],
    });
    const closeTx = buildCloseOutcomeSchemaTx({
      governanceAuthority: governanceWallet.address,
      recipientSystemAccount: governanceWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      schemaKeyHashHex: SAMPLE_SCHEMA_KEY_HASH_HEX,
    });

    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.every((series) => Boolean(series.termsVersion && series.comparabilityKey)),
      true,
    );
    assert.equal(registerTx.instructions[0]!.keys[1]!.pubkey.toBase58(), outcomeSchema);
    assert.equal(registerTx.instructions[0]!.keys[2]!.pubkey.toBase58(), dependencyLedger);
    assert.equal(verifyTx.instructions[0]!.keys[2]!.pubkey.toBase58(), outcomeSchema);
    assert.equal(backfillTx.instructions[0]!.keys[2]!.pubkey.toBase58(), outcomeSchema);
    assert.equal(backfillTx.instructions[0]!.keys[3]!.pubkey.toBase58(), dependencyLedger);
    assert.equal(closeTx.instructions[0]!.keys[2]!.pubkey.toBase58(), outcomeSchema);
    assert.equal(closeTx.instructions[0]!.keys[3]!.pubkey.toBase58(), dependencyLedger);
  },
  reserve_domain_and_vault_setup: () => {
    const reserveDomainAddresses = new Set(DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.map((domain) => domain.address));
    const openDomainSheet = recomputeReserveBalanceSheet(DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetLedgers[0]!.sheet);
    const wrapperDomainSheet = recomputeReserveBalanceSheet(DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetLedgers[1]!.sheet);

    assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains.length, 2);
    assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetVaults.length, 2);
    assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetLedgers.length, 2);
    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetVaults.every((vault) => reserveDomainAddresses.has(vault.reserveDomain)),
      true,
    );
    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetLedgers.every((ledger) => reserveDomainAddresses.has(ledger.reserveDomain)),
      true,
    );
    assert(openDomainSheet.funded > 0n);
    assert(wrapperDomainSheet.restricted > 0n);
  },
  sponsor_funded_plan_lifecycle: () => {
    const seekerPlan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((plan) => plan.planId === "nexus-seeker-rewards")!;
    const seekerPlanLines = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.filter((line) => line.healthPlan === seekerPlan.address);
    const seekerMembers = DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.filter((position) => position.healthPlan === seekerPlan.address);
    const seekerSponsorModel = consoleState.sponsors.find((model) => model.planId === seekerPlan.planId)!;

    assert(seekerMembers.length > 0);
    assert.equal(seekerPlanLines.length, 1);
    assert.equal(seekerPlanLines[0]!.lineType, FUNDING_LINE_TYPE_SPONSOR_BUDGET);
    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.some(
        (series) => series.healthPlan === seekerPlan.address && series.mode === SERIES_MODE_REWARD,
      ),
      true,
    );
    assert(seekerSponsorModel.fundedSponsorBudget > 0n);
    assert(seekerSponsorModel.remainingSponsorBudget > 0n);
  },
  reward_obligation_lifecycle: () => {
    const rewardSeriesAddresses = new Set(
      DEVNET_PROTOCOL_FIXTURE_STATE.policySeries
        .filter((series) => series.mode === SERIES_MODE_REWARD)
        .map((series) => series.address),
    );
    const rewardObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter(
      (obligation) => obligation.policySeries && rewardSeriesAddresses.has(obligation.policySeries),
    );

    assert(rewardObligations.length >= 3);
    assert.equal(rewardObligations.every((obligation) => !obligation.claimCase), true);
    assert(rewardObligations.some((obligation) => obligation.status === OBLIGATION_STATUS_RESERVED));
    assert(rewardObligations.some((obligation) => obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE));
    assert(rewardObligations.some((obligation) => obligation.status === OBLIGATION_STATUS_SETTLED));
  },
  protection_claim_lifecycle: () => {
    const protectionSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.mode === SERIES_MODE_PROTECTION)!;
    const premiumLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find(
      (line) =>
        line.policySeries === protectionSeries.address
        && line.lineType === FUNDING_LINE_TYPE_PREMIUM_INCOME,
    );
    const protectionClaims = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.filter(
      (claimCase) => claimCase.policySeries === protectionSeries.address,
    );
    const protectionObligations = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.filter(
      (obligation) => obligation.policySeries === protectionSeries.address && Boolean(obligation.claimCase),
    );

    assert(premiumLine);
    assert.equal(protectionClaims.length, 2);
    assert(protectionClaims.some((claimCase) => claimCase.intakeStatus === CLAIM_INTAKE_APPROVED));
    assert(protectionClaims.some((claimCase) => claimCase.intakeStatus === CLAIM_INTAKE_SETTLED));
    assert.equal(protectionClaims.every((claimCase) => Boolean(claimCase.linkedObligation)), true);
    assert(protectionObligations.some((obligation) => obligation.status === OBLIGATION_STATUS_CLAIMABLE_PAYABLE));
    assert(protectionObligations.some((obligation) => obligation.status === OBLIGATION_STATUS_SETTLED));
  },
  liquidity_pool_and_capital_class_lifecycle: () => {
    const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
    const classes = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.filter(
      (capitalClass) => capitalClass.liquidityPool === pool.address,
    );
    const lpPositions = DEVNET_PROTOCOL_FIXTURE_STATE.lpPositions.filter((position) =>
      classes.some((capitalClass) => capitalClass.address === position.capitalClass)
    );

    assert.equal(consoleState.capital.length, DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.length);
    assert.equal(classes.length, 2);
    assert(lpPositions.length >= 2);
    assert(classes.some((capitalClass) => capitalClass.restrictionMode === CAPITAL_CLASS_RESTRICTION_WRAPPER_ONLY));
    assert(classes.every((capitalClass) => capitalClass.queueOnlyRedemptions), true);
  },
  allocation_and_deallocation_lifecycle: () => {
    const openClass = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.find((capitalClass) => capitalClass.classId === "open-usdc-class")!;
    const openClassAllocations = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
      (allocation) => allocation.capitalClass === openClass.address,
    );

    assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.length, 3);
    assert.equal(openClassAllocations.length, 2);
    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.every(
        (allocation) => allocation.allocatedAmount <= allocation.capAmount,
      ),
      true,
    );
    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.some(
        (allocation) =>
          DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === allocation.policySeries)?.mode === SERIES_MODE_REWARD,
      ),
      true,
    );
    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
        (allocation) =>
          DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === allocation.policySeries)?.mode === SERIES_MODE_PROTECTION,
      ).length,
      2,
    );
  },
  impairment_and_redemption_queue_lifecycle: () => {
    const openClassLedger = DEVNET_PROTOCOL_FIXTURE_STATE.poolClassLedgers.find(
      (ledger) => ledger.capitalClass === DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses[0]!.address,
    )!;
    const openSheet = recomputeReserveBalanceSheet(openClassLedger.sheet);
    const impairedAllocation = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.find(
      (allocation) => allocation.impairedAmount > 0n,
    )!;
    const impairedLedger = DEVNET_PROTOCOL_FIXTURE_STATE.allocationLedgers.find(
      (ledger) => ledger.allocationPosition === impairedAllocation.address,
    )!;

    assert(openSheet.pendingRedemption > 0n);
    assert(openSheet.redeemable < openSheet.funded);
    assert(impairedAllocation.impairedAmount > 0n);
    assert((impairedLedger.sheet.impaired ?? 0n) > 0n);
    assert(DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!.totalPendingRedemptions > 0n);
  },
};

for (const scenarioName of orderedScenarios) {
  if (selectedScenario && scenarioName !== selectedScenario) {
    continue;
  }

  const definition = SCENARIO_DEFINITIONS[scenarioName];
  test(`localnet surface audit: ${definition.title}`, () => {
    scenarioAssertions[scenarioName]();
  });
}
