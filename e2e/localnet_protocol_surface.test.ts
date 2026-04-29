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
  ELIGIBILITY_ELIGIBLE,
  FUNDING_LINE_TYPE_PREMIUM_INCOME,
  FUNDING_LINE_TYPE_SPONSOR_BUDGET,
  OBLIGATION_STATUS_CANCELED,
  OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
  OBLIGATION_STATUS_RESERVED,
  OBLIGATION_STATUS_SETTLED,
  SERIES_MODE_PROTECTION,
  SERIES_MODE_REWARD,
  buildAdjudicateClaimCaseTx,
  buildAttestClaimCaseTx,
  buildCreateObligationTx,
  buildBackfillSchemaDependencyLedgerTx,
  buildClaimOracleTx,
  buildCloseOutcomeSchemaTx,
  buildCreateDomainAssetVaultTx,
  buildCreatePolicySeriesTx,
  buildCreateReserveDomainTx,
  buildInitializeProtocolGovernanceTx,
  buildMarkImpairmentTx,
  buildOpenClaimCaseTx,
  buildOpenFundingLineTx,
  buildOpenMemberPositionTx,
  buildRegisterOracleTx,
  buildReleaseReserveTx,
  buildReserveObligationTx,
  buildRegisterOutcomeSchemaTx,
  buildSetPoolOraclePermissionsTx,
  buildSetPoolOraclePolicyTx,
  buildSetPoolOracleTx,
  buildSettleObligationTx,
  buildUpdateLpPositionCredentialingTx,
  buildUpdateOracleProfileTx,
  buildVerifyOutcomeSchemaTx,
  deriveClaimAttestationPda,
  deriveDomainAssetLedgerPda,
  deriveDomainAssetVaultPda,
  deriveFundingLineLedgerPda,
  deriveFundingLinePda,
  deriveLpPositionPda,
  deriveOracleProfilePda,
  deriveOutcomeSchemaPda,
  derivePlanReserveLedgerPda,
  derivePolicySeriesPda,
  deriveProtocolGovernancePda,
  derivePoolOracleApprovalPda,
  derivePoolOraclePermissionSetPda,
  derivePoolOraclePolicyPda,
  deriveReserveDomainPda,
  deriveSchemaDependencyLedgerPda,
  deriveSeriesReserveLedgerPda,
  getProgramId,
  recomputeReserveBalanceSheet,
} = protocolModule as typeof import("../frontend/lib/protocol.ts");

const consoleState = buildCanonicalConsoleState();
const selectedScenario = String(process.env.OMEGAX_E2E_SCENARIO ?? "").trim() || null;
const orderedScenarios = scenarioNames();
const STATIC_BLOCKHASH = "11111111111111111111111111111111";
const SAMPLE_SCHEMA_KEY_HASH_HEX = "11".repeat(32);
const SAMPLE_SCHEMA_HASH_HEX = "22".repeat(32);
const SAMPLE_REASON_HASH_HEX = "33".repeat(32);
const SAMPLE_EVIDENCE_HASH_HEX = "44".repeat(32);

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
  bootstrap_to_self_serve_plan_journey: () => {
    const governanceWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "protocol_governance")!;
    const oracleWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "oracle_operator")!;
    const planAdminWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "plan_admin")!;
    const sponsorOperatorWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "sponsor_operator")!;
    const claimsOperatorWallet = DEVNET_PROTOCOL_FIXTURE_STATE.wallets.find((wallet) => wallet.role === "claims_operator")!;
    const reserveDomain = DEVNET_PROTOCOL_FIXTURE_STATE.reserveDomains[0]!;
    const domainAssetVault = DEVNET_PROTOCOL_FIXTURE_STATE.domainAssetVaults.find(
      (vault) => vault.reserveDomain === reserveDomain.address,
    )!;
    const pool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools[0]!;
    const plan = DEVNET_PROTOCOL_FIXTURE_STATE.healthPlans.find((entry) => entry.planId === "nexus-protect-plus")!;
    const protectionSeries = DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find(
      (series) => series.healthPlan === plan.address && series.mode === SERIES_MODE_PROTECTION,
    )!;
    const protectionMember = DEVNET_PROTOCOL_FIXTURE_STATE.memberPositions.find(
      (position) => position.healthPlan === plan.address && position.policySeries === protectionSeries.address,
    )!;
    const protectionClaim = DEVNET_PROTOCOL_FIXTURE_STATE.claimCases.find(
      (claimCase) => claimCase.healthPlan === plan.address && claimCase.policySeries === protectionSeries.address,
    )!;
    const protectionLine = DEVNET_PROTOCOL_FIXTURE_STATE.fundingLines.find(
      (line) => line.address === protectionClaim.fundingLine,
    )!;
    const openClass = DEVNET_PROTOCOL_FIXTURE_STATE.capitalClasses.find((capitalClass) => capitalClass.classId === "open-usdc-class")!;
    const credentialedLp = DEVNET_PROTOCOL_FIXTURE_STATE.lpPositions.find(
      (position) => position.capitalClass === openClass.address && position.credentialed,
    )!;
    const impairedAllocation = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.find(
      (allocation) =>
        allocation.fundingLine === protectionLine.address
        && allocation.capitalClass === openClass.address
        && allocation.impairedAmount > 0n,
    )!;
    const linkedObligation = DEVNET_PROTOCOL_FIXTURE_STATE.obligations.find(
      (obligation) => obligation.address === protectionClaim.linkedObligation,
    )!;
    const sponsorModel = consoleState.sponsors.find((model) => model.healthPlanAddress === plan.address)!;
    const memberModel = consoleState.members.find((model) => model.wallet === protectionMember.wallet)!;
    const memberParticipation = memberModel.planParticipations.find(
      (participation) => participation.policySeries === protectionSeries.address,
    )!;
    const capitalModel = consoleState.capital.find((model) => model.liquidityPoolAddress === pool.address)!;
    const openClassModel = capitalModel.classes.find((capitalClass) => capitalClass.capitalClass === openClass.address)!;

    const initializeGovernanceTx = buildInitializeProtocolGovernanceTx({
      governanceAuthority: governanceWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      protocolFeeBps: 50,
      emergencyPaused: false,
    });
    const createReserveDomainTx = buildCreateReserveDomainTx({
      authority: governanceWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      domainId: reserveDomain.domainId,
      displayName: reserveDomain.displayName,
      domainAdmin: reserveDomain.domainAdmin ?? governanceWallet.address,
      settlementMode: reserveDomain.settlementMode,
      legalStructureHashHex: SAMPLE_REASON_HASH_HEX,
      complianceBaselineHashHex: SAMPLE_SCHEMA_HASH_HEX,
      allowedRailMask: 0b111,
      pauseFlags: reserveDomain.pauseFlags ?? 0,
    });
    const createDomainAssetVaultTx = buildCreateDomainAssetVaultTx({
      authority: governanceWallet.address,
      reserveDomainAddress: reserveDomain.address,
      assetMint: domainAssetVault.assetMint,
      vaultTokenAccountAddress:
        (domainAssetVault as { vaultTokenAccount?: string }).vaultTokenAccount
        ?? domainAssetVault.address,
      recentBlockhash: STATIC_BLOCKHASH,
    });
    const registerOracleTx = buildRegisterOracleTx({
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
    const claimOracleTx = buildClaimOracleTx({
      oracle: oracleWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
    });
    const setPoolOracleTx = buildSetPoolOracleTx({
      authority: governanceWallet.address,
      poolAddress: pool.address,
      oracle: oracleWallet.address,
      recentBlockhash: STATIC_BLOCKHASH,
      active: true,
    });
    const setPoolOraclePolicyTx = buildSetPoolOraclePolicyTx({
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
    const createPolicySeriesTx = buildCreatePolicySeriesTx({
      authority: planAdminWallet.address,
      healthPlanAddress: plan.address,
      assetMint: protectionSeries.assetMint,
      recentBlockhash: STATIC_BLOCKHASH,
      seriesId: protectionSeries.seriesId,
      displayName: protectionSeries.displayName,
      metadataUri: protectionSeries.metadataUri ?? "",
      mode: protectionSeries.mode,
      status: protectionSeries.status,
      adjudicationMode: 0,
      comparabilityHashHex: protectionSeries.comparabilityHashHex,
      cycleSeconds: BigInt(protectionSeries.cycleSeconds ?? 0),
      termsVersion: 1,
    });
    const openFundingLineTx = buildOpenFundingLineTx({
      authority: sponsorOperatorWallet.address,
      healthPlanAddress: plan.address,
      reserveDomainAddress: plan.reserveDomain,
      assetMint: protectionLine.assetMint,
      recentBlockhash: STATIC_BLOCKHASH,
      lineId: protectionLine.lineId,
      policySeriesAddress: protectionSeries.address,
      lineType: protectionLine.lineType,
      fundingPriority: protectionLine.fundingPriority,
      committedAmount: 250_000n,
      capsHashHex: SAMPLE_REASON_HASH_HEX,
    });
    const openMemberPositionTx = buildOpenMemberPositionTx({
      wallet: protectionMember.wallet,
      healthPlanAddress: plan.address,
      recentBlockhash: STATIC_BLOCKHASH,
      seriesScopeAddress: protectionSeries.address,
      eligibilityStatus: ELIGIBILITY_ELIGIBLE,
      delegatedRightsMask: 0,
      proofMode: 0,
      tokenGateAmountSnapshot: 0n,
      inviteExpiresAt: 0n,
    });
    const openClaimCaseTx = buildOpenClaimCaseTx({
      authority: protectionClaim.claimant,
      healthPlanAddress: plan.address,
      memberPositionAddress: protectionMember.address,
      fundingLineAddress: protectionLine.address,
      recentBlockhash: STATIC_BLOCKHASH,
      claimId: protectionClaim.claimId,
      policySeriesAddress: protectionSeries.address,
      claimantAddress: protectionClaim.claimant,
      evidenceRefHashHex: SAMPLE_EVIDENCE_HASH_HEX,
    });
    const attestClaimCaseTx = buildAttestClaimCaseTx({
      oracle: oracleWallet.address,
      claimCaseAddress: protectionClaim.address,
      recentBlockhash: STATIC_BLOCKHASH,
      decision: 0,
      attestationHashHex: SAMPLE_REASON_HASH_HEX,
      attestationRefHashHex: SAMPLE_EVIDENCE_HASH_HEX,
      schemaKeyHashHex: SAMPLE_SCHEMA_KEY_HASH_HEX,
    });
    const createObligationTx = buildCreateObligationTx({
      authority: claimsOperatorWallet.address,
      healthPlanAddress: plan.address,
      reserveDomainAddress: plan.reserveDomain,
      fundingLineAddress: protectionLine.address,
      assetMint: protectionLine.assetMint,
      recentBlockhash: STATIC_BLOCKHASH,
      obligationId: linkedObligation.obligationId,
      policySeriesAddress: protectionSeries.address,
      memberWalletAddress: protectionClaim.claimant,
      beneficiaryAddress: protectionClaim.claimant,
      claimCaseAddress: protectionClaim.address,
      liquidityPoolAddress: pool.address,
      capitalClassAddress: openClass.address,
      allocationPositionAddress: impairedAllocation.address,
      deliveryMode: linkedObligation.deliveryMode,
      amount: linkedObligation.principalAmount,
      creationReasonHashHex: SAMPLE_REASON_HASH_HEX,
      poolAssetMint: pool.depositAssetMint,
    });
    const adjudicateClaimCaseTx = buildAdjudicateClaimCaseTx({
      authority: claimsOperatorWallet.address,
      healthPlanAddress: plan.address,
      claimCaseAddress: protectionClaim.address,
      recentBlockhash: STATIC_BLOCKHASH,
      reviewState: 1,
      approvedAmount: protectionClaim.approvedAmount,
      deniedAmount: protectionClaim.deniedAmount,
      reserveAmount: linkedObligation.outstandingAmount,
      decisionSupportHashHex: SAMPLE_REASON_HASH_HEX,
      obligationAddress: linkedObligation.address,
    });
    const reserveObligationTx = buildReserveObligationTx({
      authority: claimsOperatorWallet.address,
      healthPlanAddress: plan.address,
      reserveDomainAddress: plan.reserveDomain,
      fundingLineAddress: protectionLine.address,
      assetMint: protectionLine.assetMint,
      obligationAddress: linkedObligation.address,
      recentBlockhash: STATIC_BLOCKHASH,
      amount: linkedObligation.outstandingAmount,
      claimCaseAddress: protectionClaim.address,
      policySeriesAddress: protectionSeries.address,
      capitalClassAddress: openClass.address,
      allocationPositionAddress: impairedAllocation.address,
      poolAssetMint: pool.depositAssetMint,
    });
    const releaseReserveTx = buildReleaseReserveTx({
      authority: claimsOperatorWallet.address,
      healthPlanAddress: plan.address,
      reserveDomainAddress: plan.reserveDomain,
      fundingLineAddress: protectionLine.address,
      assetMint: protectionLine.assetMint,
      obligationAddress: linkedObligation.address,
      recentBlockhash: STATIC_BLOCKHASH,
      amount: linkedObligation.outstandingAmount,
      claimCaseAddress: protectionClaim.address,
      policySeriesAddress: protectionSeries.address,
      capitalClassAddress: openClass.address,
      allocationPositionAddress: impairedAllocation.address,
      poolAssetMint: pool.depositAssetMint,
    });
    const settleObligationToDeliveryTx = buildSettleObligationTx({
      authority: claimsOperatorWallet.address,
      healthPlanAddress: plan.address,
      reserveDomainAddress: plan.reserveDomain,
      fundingLineAddress: protectionLine.address,
      assetMint: protectionLine.assetMint,
      obligationAddress: linkedObligation.address,
      recentBlockhash: STATIC_BLOCKHASH,
      nextStatus: OBLIGATION_STATUS_CLAIMABLE_PAYABLE,
      amount: linkedObligation.outstandingAmount,
      settlementReasonHashHex: SAMPLE_REASON_HASH_HEX,
      claimCaseAddress: protectionClaim.address,
      policySeriesAddress: protectionSeries.address,
      capitalClassAddress: openClass.address,
      allocationPositionAddress: impairedAllocation.address,
      poolAssetMint: pool.depositAssetMint,
    });
    const settleObligationFinalTx = buildSettleObligationTx({
      authority: claimsOperatorWallet.address,
      healthPlanAddress: plan.address,
      reserveDomainAddress: plan.reserveDomain,
      fundingLineAddress: protectionLine.address,
      assetMint: protectionLine.assetMint,
      obligationAddress: linkedObligation.address,
      recentBlockhash: STATIC_BLOCKHASH,
      nextStatus: OBLIGATION_STATUS_SETTLED,
      amount: linkedObligation.outstandingAmount,
      settlementReasonHashHex: SAMPLE_REASON_HASH_HEX,
      claimCaseAddress: protectionClaim.address,
      policySeriesAddress: protectionSeries.address,
      capitalClassAddress: openClass.address,
      allocationPositionAddress: impairedAllocation.address,
      poolAssetMint: pool.depositAssetMint,
    });
    const updateCredentialingTx = buildUpdateLpPositionCredentialingTx({
      authority: governanceWallet.address,
      poolAddress: pool.address,
      capitalClassAddress: openClass.address,
      ownerAddress: credentialedLp.owner,
      recentBlockhash: STATIC_BLOCKHASH,
      credentialed: true,
      reasonHashHex: SAMPLE_REASON_HASH_HEX,
    });
    const markImpairmentTx = buildMarkImpairmentTx({
      authority: claimsOperatorWallet.address,
      healthPlanAddress: plan.address,
      reserveDomainAddress: plan.reserveDomain,
      fundingLineAddress: protectionLine.address,
      assetMint: protectionLine.assetMint,
      recentBlockhash: STATIC_BLOCKHASH,
      amount: impairedAllocation.impairedAmount,
      reasonHashHex: SAMPLE_REASON_HASH_HEX,
      policySeriesAddress: protectionSeries.address,
      capitalClassAddress: openClass.address,
      allocationPositionAddress: impairedAllocation.address,
      obligationAddress: linkedObligation.address,
      poolAssetMint: pool.depositAssetMint,
    });

    assert.equal(initializeGovernanceTx.instructions[0]!.keys[1]!.pubkey.toBase58(), deriveProtocolGovernancePda().toBase58());
    assert.equal(createReserveDomainTx.instructions[0]!.keys[2]!.pubkey.toBase58(), deriveReserveDomainPda({ domainId: reserveDomain.domainId }).toBase58());
    assert.equal(createDomainAssetVaultTx.instructions[0]!.keys[3]!.pubkey.toBase58(), deriveDomainAssetVaultPda({
      reserveDomain: reserveDomain.address,
      assetMint: domainAssetVault.assetMint,
    }).toBase58());
    assert.equal(createDomainAssetVaultTx.instructions[0]!.keys[4]!.pubkey.toBase58(), deriveDomainAssetLedgerPda({
      reserveDomain: reserveDomain.address,
      assetMint: domainAssetVault.assetMint,
    }).toBase58());
    assert.equal(registerOracleTx.instructions[0]!.keys[1]!.pubkey.toBase58(), deriveOracleProfilePda({ oracle: oracleWallet.address }).toBase58());
    assert.equal(claimOracleTx.instructions[0]!.keys[1]!.pubkey.toBase58(), deriveOracleProfilePda({ oracle: oracleWallet.address }).toBase58());
    assert.equal(setPoolOracleTx.instructions[0]!.keys[4]!.pubkey.toBase58(), derivePoolOracleApprovalPda({
      liquidityPool: pool.address,
      oracle: oracleWallet.address,
    }).toBase58());
    assert.equal(setPoolOraclePolicyTx.instructions[0]!.keys[3]!.pubkey.toBase58(), derivePoolOraclePolicyPda({
      liquidityPool: pool.address,
    }).toBase58());
    assert.equal(createPolicySeriesTx.instructions[0]!.keys[3]!.pubkey.toBase58(), derivePolicySeriesPda({
      healthPlan: plan.address,
      seriesId: protectionSeries.seriesId,
    }).toBase58());
    assert.equal(createPolicySeriesTx.instructions[0]!.keys[4]!.pubkey.toBase58(), deriveSeriesReserveLedgerPda({
      policySeries: protectionSeries.address,
      assetMint: protectionSeries.assetMint,
    }).toBase58());
    assert.equal(openFundingLineTx.instructions[0]!.keys[3]!.pubkey.toBase58(), deriveDomainAssetVaultPda({
      reserveDomain: plan.reserveDomain,
      assetMint: protectionLine.assetMint,
    }).toBase58());
    assert.equal(openFundingLineTx.instructions[0]!.keys[5]!.pubkey.toBase58(), deriveFundingLinePda({
      healthPlan: plan.address,
      lineId: protectionLine.lineId,
    }).toBase58());
    assert.equal(openFundingLineTx.instructions[0]!.keys[6]!.pubkey.toBase58(), deriveFundingLineLedgerPda({
      fundingLine: protectionLine.address,
      assetMint: protectionLine.assetMint,
    }).toBase58());
    assert.equal(openFundingLineTx.instructions[0]!.keys[7]!.pubkey.toBase58(), derivePlanReserveLedgerPda({
      healthPlan: plan.address,
      assetMint: protectionLine.assetMint,
    }).toBase58());
    assert.equal(openFundingLineTx.instructions[0]!.keys[8]!.pubkey.toBase58(), deriveSeriesReserveLedgerPda({
      policySeries: protectionSeries.address,
      assetMint: protectionLine.assetMint,
    }).toBase58());
    assert.equal(openMemberPositionTx.instructions[0]!.keys[3]!.pubkey.toBase58(), protectionMember.address);
    assert.equal(openClaimCaseTx.instructions[0]!.keys[4]!.pubkey.toBase58(), protectionClaim.address);
    assert.equal(attestClaimCaseTx.instructions[0]!.keys[2]!.pubkey.toBase58(), protectionClaim.address);
    assert.equal(
      attestClaimCaseTx.instructions[0]!.keys[4]!.pubkey.toBase58(),
      deriveClaimAttestationPda({
        claimCase: protectionClaim.address,
        oracle: oracleWallet.address,
      }).toBase58(),
    );
    assert.equal(adjudicateClaimCaseTx.instructions[0]!.keys[4]!.pubkey.toBase58(), linkedObligation.address);
    assert.equal(reserveObligationTx.instructions[0]!.keys[12]!.pubkey.toBase58(), protectionClaim.address);
    assert.equal(releaseReserveTx.instructions[0]!.keys[12]!.pubkey.toBase58(), protectionClaim.address);
    assert.equal(settleObligationToDeliveryTx.instructions[0]!.keys[13]!.pubkey.toBase58(), protectionClaim.address);
    assert.equal(settleObligationFinalTx.instructions[0]!.keys[13]!.pubkey.toBase58(), protectionClaim.address);
    assert.equal(createObligationTx.instructions[0]!.keys[10]!.pubkey.toBase58(), linkedObligation.address);
    assert.equal(updateCredentialingTx.instructions[0]!.keys[4]!.pubkey.toBase58(), deriveLpPositionPda({
      capitalClass: openClass.address,
      owner: credentialedLp.owner,
    }).toBase58());
    assert.equal(markImpairmentTx.instructions[0]!.keys[3]!.pubkey.toBase58(), deriveDomainAssetLedgerPda({
      reserveDomain: plan.reserveDomain,
      assetMint: protectionLine.assetMint,
    }).toBase58());
    assert.equal(markImpairmentTx.instructions[0]!.keys[5]!.pubkey.toBase58(), deriveFundingLineLedgerPda({
      fundingLine: protectionLine.address,
      assetMint: protectionLine.assetMint,
    }).toBase58());
    assert.equal(markImpairmentTx.instructions[0]!.keys[6]!.pubkey.toBase58(), derivePlanReserveLedgerPda({
      healthPlan: plan.address,
      assetMint: protectionLine.assetMint,
    }).toBase58());
    assert.equal(markImpairmentTx.instructions[0]!.keys[9]!.pubkey.toBase58(), impairedAllocation.address);
    assert.equal(markImpairmentTx.instructions[0]!.keys[11]!.pubkey.toBase58(), linkedObligation.address);

    assert.equal(reserveDomain.address, deriveReserveDomainPda({ domainId: reserveDomain.domainId }).toBase58());
    assert.equal(domainAssetVault.address, deriveDomainAssetVaultPda({
      reserveDomain: reserveDomain.address,
      assetMint: domainAssetVault.assetMint,
    }).toBase58());
    assert.equal(protectionSeries.address, derivePolicySeriesPda({
      healthPlan: plan.address,
      seriesId: protectionSeries.seriesId,
    }).toBase58());
    assert.equal(protectionLine.address, deriveFundingLinePda({
      healthPlan: plan.address,
      lineId: protectionLine.lineId,
    }).toBase58());
    assert.equal(protectionMember.address, protectionClaim.memberPosition);
    assert.equal(linkedObligation.fundingLine, protectionLine.address);
    assert.equal(linkedObligation.allocationPosition, impairedAllocation.address);
    assert.equal(linkedObligation.capitalClass, openClass.address);
    assert.equal(linkedObligation.claimCase, protectionClaim.address);

    assert(sponsorModel.perSeriesPerformance.some((series) => series.policySeries === protectionSeries.address));
    assert.equal(sponsorModel.claimCounts.approved >= 1, true);
    assert.equal(sponsorModel.claimCounts.settled >= 1, true);
    assert(memberParticipation.delegatedRights.includes("open_claim_case"));
    assert.equal(memberParticipation.claimStatusCounts.approved >= 1, true);
    assert.equal(memberParticipation.claimStatusCounts.settled >= 1, true);
    assert(openClassModel.exposureMix.some((allocation) =>
      allocation.healthPlan === plan.address
      && allocation.policySeries === protectionSeries.address
      && allocation.fundingLine === protectionLine.address
    ));
    assert(openClassModel.reservedLiabilities > 0n);
    assert.equal(credentialedLp.credentialed, true);
    assert(impairedAllocation.impairedAmount > 0n);
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
    assert.equal(
      protectionClaims.every((claimCase) => {
        const linkedObligation = protectionObligations.find(
          (obligation) => obligation.address === claimCase.linkedObligation,
        );
        return Boolean(linkedObligation)
          && claimCase.reservedAmount === linkedObligation!.reservedAmount
          && claimCase.paidAmount === linkedObligation!.settledAmount;
      }),
      true,
    );
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
    const protectionAllocations = DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
      (allocation) =>
        DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.find((series) => series.address === allocation.policySeries)?.mode === SERIES_MODE_PROTECTION,
    );
    const genesisPool = DEVNET_PROTOCOL_FIXTURE_STATE.liquidityPools.find(
      (liquidityPool) => liquidityPool.poolId === "genesis-protect-acute-pool",
    )!;

    assert.equal(DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.length, 6);
    assert.equal(openClassAllocations.length, 2);
    assert.equal(
      DEVNET_PROTOCOL_FIXTURE_STATE.allocationPositions.filter(
        (allocation) => allocation.liquidityPool === genesisPool.address,
      ).length,
      3,
    );
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
      protectionAllocations.length,
      5,
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
  fee_vault_lifecycle: () => {
    // Phase 1.6/1.7 — Surface-ownership only. The 9 fee-vault instructions
    // (3 init + 6 withdraw) are pinned by the canonical-instruction-ownership
    // test above; deeper localnet-execution coverage (init → accrue →
    // withdraw round-trip on the rails) lands in a follow-up that builds the
    // matching fixture state. Until then this scenario is pure surface
    // coverage so the manifest stays consistent.
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
