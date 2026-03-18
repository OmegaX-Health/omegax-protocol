// SPDX-License-Identifier: AGPL-3.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

type ContractInstruction = {
  name: string;
  discriminator: number[];
  accounts: Array<{ name: string }>;
};

type ProtocolContract = {
  instructions: ContractInstruction[];
  pdaSeeds: Record<string, string[]>;
  accountDiscriminators: Record<string, number[]>;
};

type AnchorIdlError = {
  name: string;
  code: number;
};

type AnchorIdl = {
  errors?: AnchorIdlError[];
  events?: Array<{
    name: string;
    type?: {
      fields?: Array<{ name: string }>;
    };
  }>;
  types?: Array<{
    name: string;
    type?: {
      fields?: Array<{ name: string }>;
    };
  }>;
};

function canonicalDiscriminator(name: string): number[] {
  return Array.from(createHash('sha256').update(`global:${name}`).digest()).slice(0, 8);
}

function canonicalAccountDiscriminator(name: string): number[] {
  return Array.from(createHash('sha256').update(`account:${name}`).digest()).slice(0, 8);
}

const contract = JSON.parse(
  readFileSync(new URL('../shared/protocol_contract.json', import.meta.url), 'utf8'),
) as ProtocolContract;

const builtIdlUrl = new URL('../target/idl/omegax_protocol.json', import.meta.url);
const checkedInIdlUrl = new URL('../idl/omegax_protocol.json', import.meta.url);
const idl = JSON.parse(
  readFileSync(existsSync(builtIdlUrl) ? builtIdlUrl : checkedInIdlUrl, 'utf8'),
) as AnchorIdl;

function idlErrorCode(name: string): number {
  const entry = idl.errors?.find((row) => row.name === name);
  assert.ok(entry, `missing idl error ${name}`);
  return entry.code;
}

test('contract instruction discriminators are canonical anchor global discriminators', () => {
  for (const ix of contract.instructions) {
    const expected = canonicalDiscriminator(ix.name);
    assert.deepEqual(ix.discriminator, expected, `mismatch for ${ix.name}`);
  }
});

test('contract includes set_pool_status instruction', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(names.has('set_pool_status'), 'missing set_pool_status in protocol contract surface');
});

test('contract includes close_outcome_schema instruction', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(names.has('close_outcome_schema'), 'missing close_outcome_schema in protocol contract surface');
});

test('contract includes backfill_schema_dependency_ledger instruction', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(
    names.has('backfill_schema_dependency_ledger'),
    'missing backfill_schema_dependency_ledger in protocol contract surface',
  );
});

test('contract includes set_pool_risk_controls instruction', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(names.has('set_pool_risk_controls'), 'missing set_pool_risk_controls in protocol contract surface');
});

test('contract includes register_pool_capital_class instruction', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(names.has('register_pool_capital_class'), 'missing register_pool_capital_class');
});

test('contract includes coverage claim case-management instructions', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(names.has('review_coverage_claim'), 'missing review_coverage_claim');
  assert.ok(
    names.has('attach_coverage_claim_decision_support'),
    'missing attach_coverage_claim_decision_support',
  );
  assert.ok(names.has('approve_coverage_claim'), 'missing approve_coverage_claim');
  assert.ok(names.has('deny_coverage_claim'), 'missing deny_coverage_claim');
  assert.ok(names.has('pay_coverage_claim'), 'missing pay_coverage_claim');
  assert.ok(
    names.has('claim_approved_coverage_payout'),
    'missing claim_approved_coverage_payout',
  );
  assert.ok(names.has('close_coverage_claim'), 'missing close_coverage_claim');
});

test('coverage claim adjudication instructions require pool oracle permission accounts', () => {
  const names = [
    'review_coverage_claim',
    'attach_coverage_claim_decision_support',
    'approve_coverage_claim',
    'deny_coverage_claim',
    'settle_coverage_claim',
  ];
  for (const name of names) {
    const instruction = contract.instructions.find((ix) => ix.name === name);
    assert.ok(instruction, `missing ${name}`);
    assert.ok(
      instruction.accounts.some((account) => account.name === 'oracle_entry'),
      `${name} must include oracle_entry`,
    );
    assert.ok(
      instruction.accounts.some((account) => account.name === 'pool_oracle'),
      `${name} must include pool_oracle`,
    );
    assert.ok(
      instruction.accounts.some((account) => account.name === 'pool_oracle_permissions'),
      `${name} must include pool_oracle_permissions`,
    );
  }
});

test('contract includes series, compliance, queue, and dispute instructions', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(names.has('create_policy_series'), 'missing create_policy_series');
  assert.ok(names.has('update_policy_series'), 'missing update_policy_series');
  assert.ok(
    names.has('upsert_policy_series_payment_option'),
    'missing upsert_policy_series_payment_option',
  );
  assert.ok(names.has('subscribe_policy_series'), 'missing subscribe_policy_series');
  assert.ok(names.has('issue_policy_position'), 'missing issue_policy_position');
  assert.ok(names.has('set_policy_series_outcome_rule'), 'missing set_policy_series_outcome_rule');
  assert.ok(names.has('set_pool_compliance_policy'), 'missing set_pool_compliance_policy');
  assert.ok(names.has('set_pool_control_authorities'), 'missing set_pool_control_authorities');
  assert.ok(names.has('set_pool_automation_policy'), 'missing set_pool_automation_policy');
  assert.ok(names.has('request_pool_liquidity_redemption'), 'missing request_pool_liquidity_redemption');
  assert.ok(names.has('schedule_pool_liquidity_redemption'), 'missing schedule_pool_liquidity_redemption');
  assert.ok(names.has('cancel_pool_liquidity_redemption'), 'missing cancel_pool_liquidity_redemption');
  assert.ok(names.has('fail_pool_liquidity_redemption'), 'missing fail_pool_liquidity_redemption');
  assert.ok(names.has('fulfill_pool_liquidity_redemption_sol'), 'missing fulfill_pool_liquidity_redemption_sol');
  assert.ok(names.has('fulfill_pool_liquidity_redemption_spl'), 'missing fulfill_pool_liquidity_redemption_spl');
  assert.ok(names.has('open_cycle_outcome_dispute'), 'missing open_cycle_outcome_dispute');
  assert.ok(names.has('resolve_cycle_outcome_dispute'), 'missing resolve_cycle_outcome_dispute');
});

test('contract includes seeker cycle activation and treasury lifecycle instructions', () => {
  const names = new Set(contract.instructions.map((ix) => ix.name));
  assert.ok(names.has('activate_cycle_with_quote_sol'), 'missing activate_cycle_with_quote_sol');
  assert.ok(names.has('activate_cycle_with_quote_spl'), 'missing activate_cycle_with_quote_spl');
  assert.ok(names.has('settle_cycle_commitment'), 'missing settle_cycle_commitment');
  assert.ok(names.has('settle_cycle_commitment_sol'), 'missing settle_cycle_commitment_sol');
  assert.ok(names.has('withdraw_pool_treasury_spl'), 'missing withdraw_pool_treasury_spl');
  assert.ok(names.has('withdraw_pool_treasury_sol'), 'missing withdraw_pool_treasury_sol');
});

test('contract removes deprecated instructions and public versioned naming', () => {
  const instructionNames = contract.instructions.map((ix) => ix.name);
  const deprecatedInstructionSuffix = ['_', 'v', '2'].join('');
  const deprecatedAccountToken = ['V', '2'].join('');
  assert.ok(
    !instructionNames.includes('pay_premium_onchain'),
    'deprecated pay_premium_onchain should not be public',
  );
  assert.ok(
    !instructionNames.some((name) => name.endsWith(deprecatedInstructionSuffix)),
    'public instruction names must not expose deprecated version suffixes',
  );
  const accountNames = Object.keys(contract.accountDiscriminators);
  assert.ok(
    !accountNames.some((name) => name.includes(deprecatedAccountToken)),
    'public account names must not expose deprecated version tokens',
  );
});

test('oracle data attestation instructions require oracle permission accounts', () => {
  const vote = contract.instructions.find((ix) => ix.name === 'submit_outcome_attestation_vote');
  const premium = contract.instructions.find((ix) => ix.name === 'attest_premium_paid_offchain');
  assert.ok(vote, 'missing submit_outcome_attestation_vote');
  assert.ok(premium, 'missing attest_premium_paid_offchain');
  assert.ok(
    vote.accounts.some((account) => account.name === 'pool_oracle_permissions'),
    'submit_outcome_attestation_vote must include pool_oracle_permissions',
  );
  assert.ok(
    premium.accounts.some((account) => account.name === 'pool_oracle_permissions'),
    'attest_premium_paid_offchain must include pool_oracle_permissions',
  );
});

test('contract account discriminators are canonical anchor account discriminators', () => {
  const required = [
    'Pool',
    'OracleRegistryEntry',
    'PoolOracleApproval',
    'PoolOraclePolicy',
    'PoolOraclePermissionSet',
    'PoolLiquidityConfig',
    'PoolRiskConfig',
    'PoolCapitalClass',
    'PolicySeries',
    'PoolCompliancePolicy',
    'PoolControlAuthority',
    'PoolAutomationPolicy',
    'OutcomeSchemaRegistryEntry',
    'SchemaDependencyLedger',
    'PoolOutcomeRule',
    'MembershipRecord',
    'MemberCycleState',
    'CycleQuoteReplay',
    'CohortSettlementRoot',
    'PoolTreasuryReserve',
    'InviteIssuerRegistryEntry',
    'AttestationVote',
    'CycleOutcomeAggregate',
    'ClaimRecord',
    'PolicySeriesPaymentOption',
    'PolicyPosition',
    'PolicyPositionNft',
    'CoverageClaimRecord',
    'ProtocolFeeVault',
    'PoolOracleFeeVault',
    'PoolRedemptionRequest',
  ];
  for (const accountName of required) {
    const actual = contract.accountDiscriminators[accountName];
    assert.ok(actual, `missing account discriminator for ${accountName}`);
    assert.deepEqual(actual, canonicalAccountDiscriminator(accountName), `mismatch for ${accountName}`);
  }
});

test('contract includes required pda seed schemas', () => {
  const required = [
    'config',
    'pool',
    'oracle',
    'oracle_stake',
    'pool_oracle',
    'pool_oracle_policy',
    'pool_oracle_permissions',
    'pool_terms',
    'pool_asset_vault',
    'pool_risk_config',
    'pool_capital_class',
    'policy_series',
    'pool_compliance_policy',
    'pool_control_authority',
    'pool_automation_policy',
    'pool_liquidity_config',
    'pool_share_mint',
    'membership',
    'member_cycle',
    'cycle_quote_replay',
    'pool_treasury_reserve',
    'schema',
    'schema_dependency',
    'pool_rule',
    'invite_issuer',
    'enrollment_replay',
    'attestation_vote',
    'outcome_aggregate',
    'claim_delegate',
    'claim',
    'policy_position',
    'policy_position_nft',
    'premium_ledger',
    'premium_replay',
    'coverage_claim',
    'policy_series_payment_option',
    'redemption_request',
    'cohort_settlement_root',
    'protocol_fee_vault',
    'pool_oracle_fee_vault',
  ];
  for (const key of required) {
    assert.ok(contract.pdaSeeds[key], `missing pda seed schema: ${key}`);
    assert.ok(contract.pdaSeeds[key].length > 0, `empty pda seed schema: ${key}`);
  }
});

test('pool lifecycle errors preserve existing idl error code compatibility', () => {
  // Existing codes remain stable to avoid regressions in clients that match on numeric error codes.
  assert.equal(idlErrorCode('InvalidPoolType'), 6020);
  assert.equal(idlErrorCode('InvalidQuorum'), 6021);
  assert.equal(idlErrorCode('PoolNotActive'), 6033);
  assert.equal(idlErrorCode('OracleKeyMismatch'), 6084);

  // New lifecycle errors are appended after existing surface.
  assert.equal(idlErrorCode('InvalidPoolStatus'), 6085);
  assert.equal(idlErrorCode('PoolClosed'), 6086);
});

test('idl includes governance, liquidity, and claims events for downstream consumers', () => {
  const names = new Set((idl.events ?? []).map((event) => event.name));
  assert.ok(names.has('PolicySeriesUpdatedEvent'), 'missing PolicySeriesUpdatedEvent');
  assert.ok(names.has('PoolCompliancePolicyUpdatedEvent'), 'missing PoolCompliancePolicyUpdatedEvent');
  assert.ok(names.has('PoolControlAuthoritiesUpdatedEvent'), 'missing PoolControlAuthoritiesUpdatedEvent');
  assert.ok(names.has('PoolAutomationPolicyUpdatedEvent'), 'missing PoolAutomationPolicyUpdatedEvent');
  assert.ok(names.has('PoolLiquidityDepositedEvent'), 'missing PoolLiquidityDepositedEvent');
  assert.ok(names.has('PoolLiquidityRedeemedEvent'), 'missing PoolLiquidityRedeemedEvent');
  assert.ok(names.has('PoolRedemptionRequestedEvent'), 'missing PoolRedemptionRequestedEvent');
  assert.ok(names.has('PoolRedemptionStatusChangedEvent'), 'missing PoolRedemptionStatusChangedEvent');
  assert.ok(names.has('OutcomeAttestationSubmittedEvent'), 'missing OutcomeAttestationSubmittedEvent');
  assert.ok(names.has('OutcomeReviewStatusChangedEvent'), 'missing OutcomeReviewStatusChangedEvent');
  assert.ok(names.has('CoverageClaimStatusChangedEvent'), 'missing CoverageClaimStatusChangedEvent');
  assert.ok(names.has('CoverageClaimPayoutCompletedEvent'), 'missing CoverageClaimPayoutCompletedEvent');
});

function eventFieldNames(name: string): string[] {
  const event = idl.events?.find((entry) => entry.name === name);
  assert.ok(event, `missing idl event ${name}`);
  const fields =
    event.type?.fields
    ?? idl.types?.find((entry) => entry.name === name)?.type?.fields
    ?? [];
  return fields.map((field) => field.name);
}

test('idl event payloads expose canonical wallet and reporting fields', () => {
  assert.deepEqual(eventFieldNames('PoolRedemptionStatusChangedEvent'), [
    'pool',
    'redeemer',
    'request_hash',
    'status',
    'amount_out',
    'failure_code',
  ]);
  assert.deepEqual(eventFieldNames('CoverageClaimStatusChangedEvent'), [
    'pool',
    'member',
    'claimant',
    'intent_hash',
    'status',
    'claim_family',
    'requested_amount',
    'approved_amount',
    'reserved_amount',
    'ai_automation_mode',
  ]);
  assert.deepEqual(eventFieldNames('OutcomeReviewStatusChangedEvent'), [
    'pool',
    'member',
    'cycle_hash',
    'rule_hash',
    'review_status',
    'challenge_window_ends_at',
    'dispute_reason_hash',
    'acted_by',
  ]);
});
