import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import contractModule from "../frontend/lib/generated/protocol-contract.ts";

const {
  PROTOCOL_INSTRUCTION_ARGS,
  PROTOCOL_ACCOUNT_DISCRIMINATORS,
  PROTOCOL_INSTRUCTION_ACCOUNTS,
  PROTOCOL_INSTRUCTION_DISCRIMINATORS,
} = contractModule as typeof import("../frontend/lib/generated/protocol-contract.ts");

test("canonical contract exposes the health-capital-markets surface", () => {
  const instructionNames = Object.keys(PROTOCOL_INSTRUCTION_DISCRIMINATORS);
  const accountNames = Object.keys(PROTOCOL_ACCOUNT_DISCRIMINATORS);
  const serializedAccounts = JSON.stringify(PROTOCOL_INSTRUCTION_ACCOUNTS);
  const idl = JSON.parse(readFileSync(new URL("../idl/omegax_protocol.json", import.meta.url), "utf8")) as {
    instructions: Array<{ name: string }>;
    types: Array<{ name: string; type: { kind: string; fields?: Array<{ name: string }> } }>;
  };
  const depositArgs = idl.types.find((entry) => entry.name === "DepositIntoCapitalClassArgs");
  const initProtocolFeeVaultArgs = idl.types.find((entry) => entry.name === "InitProtocolFeeVaultArgs");
  const initPoolTreasuryVaultArgs = idl.types.find((entry) => entry.name === "InitPoolTreasuryVaultArgs");
  const initPoolOracleFeeVaultArgs = idl.types.find((entry) => entry.name === "InitPoolOracleFeeVaultArgs");
  const requestRedemptionArgs = idl.types.find((entry) => entry.name === "RequestRedemptionArgs");
  const processRedemptionArgs = idl.types.find((entry) => entry.name === "ProcessRedemptionQueueArgs");
  const claimCaseAccount = idl.types.find((entry) => entry.name === "ClaimCase");
  const claimAttestationAccount = idl.types.find((entry) => entry.name === "ClaimAttestation");

  assert(instructionNames.includes("initialize_protocol_governance"));
  assert(instructionNames.includes("rotate_protocol_governance_authority"));
  assert(instructionNames.includes("create_reserve_domain"));
  assert(instructionNames.includes("create_health_plan"));
  assert(instructionNames.includes("create_policy_series"));
  assert(instructionNames.includes("initialize_series_reserve_ledger"));
  assert(instructionNames.includes("open_funding_line"));
  assert(instructionNames.includes("create_liquidity_pool"));
  assert(instructionNames.includes("create_capital_class"));
  assert(instructionNames.includes("update_lp_position_credentialing"));
  assert(instructionNames.includes("create_allocation_position"));
  assert(instructionNames.includes("mark_impairment"));
  assert(instructionNames.includes("register_oracle"));
  assert(instructionNames.includes("claim_oracle"));
  assert(instructionNames.includes("set_pool_oracle_policy"));
  assert(instructionNames.includes("register_outcome_schema"));
  assert(instructionNames.includes("verify_outcome_schema"));
  assert(instructionNames.includes("close_outcome_schema"));
  assert(instructionNames.includes("attest_claim_case"));

  // Phase 1.6 — fee-vault init instructions
  assert(instructionNames.includes("init_protocol_fee_vault"));
  assert(instructionNames.includes("init_pool_treasury_vault"));
  assert(instructionNames.includes("init_pool_oracle_fee_vault"));

  // Phase 1.7 — fee-vault withdraw instructions (SOL + SPL × 3 rails)
  assert(instructionNames.includes("withdraw_protocol_fee_sol"));
  assert(instructionNames.includes("withdraw_protocol_fee_spl"));
  assert(instructionNames.includes("withdraw_pool_treasury_sol"));
  assert(instructionNames.includes("withdraw_pool_treasury_spl"));
  assert(instructionNames.includes("withdraw_pool_oracle_fee_sol"));
  assert(instructionNames.includes("withdraw_pool_oracle_fee_spl"));

  assert(accountNames.includes("ReserveDomain"));
  assert(accountNames.includes("HealthPlan"));
  assert(accountNames.includes("PolicySeries"));
  assert(accountNames.includes("MembershipAnchorSeat"));
  assert(accountNames.includes("FundingLine"));
  assert(accountNames.includes("LiquidityPool"));
  assert(accountNames.includes("CapitalClass"));
  assert(accountNames.includes("AllocationPosition"));
  assert(accountNames.includes("Obligation"));
  assert(accountNames.includes("OracleProfile"));
  assert(accountNames.includes("PoolOracleApproval"));
  assert(accountNames.includes("PoolOraclePolicy"));
  assert(accountNames.includes("PoolOraclePermissionSet"));
  assert(accountNames.includes("OutcomeSchema"));
  assert(accountNames.includes("SchemaDependencyLedger"));
  assert(accountNames.includes("ClaimAttestation"));

  // Phase 1.6 — fee-vault account types (declared on-chain, exposed via IDL)
  assert(accountNames.includes("ProtocolFeeVault"));
  assert(accountNames.includes("PoolTreasuryVault"));
  assert(accountNames.includes("PoolOracleFeeVault"));

  // Phase 1.6 — optional fee accounts on the inflow handlers we wired accrual into
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.record_premium_payment.some(
      (account) => account.name === "protocol_fee_vault",
    ),
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.deposit_into_capital_class.some(
      (account) => account.name === "pool_treasury_vault",
    ),
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.process_redemption_queue.some(
      (account) => account.name === "pool_treasury_vault",
    ),
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.settle_claim_case.some(
      (account) => account.name === "protocol_fee_vault",
    ),
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.settle_claim_case.some(
      (account) => account.name === "pool_oracle_fee_vault",
    ),
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.settle_claim_case.some(
      (account) => account.name === "pool_oracle_policy",
    ),
  );
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.open_claim_case.some((account) => account.name === "protocol_governance"));
  for (const accountName of [
    "protocol_governance",
    "health_plan",
    "funding_line",
    "liquidity_pool",
    "capital_class",
    "allocation_position",
    "pool_oracle_approval",
    "pool_oracle_permission_set",
    "pool_oracle_policy",
  ]) {
    assert(
      PROTOCOL_INSTRUCTION_ACCOUNTS.attest_claim_case.some((account) => account.name === accountName),
      `attest_claim_case missing ${accountName}`,
    );
  }

  // Phase 1.7 — withdraw ix account lists encode per-rail authority and
  // physical-custody routing.
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.withdraw_protocol_fee_spl.some(
      (account) => account.name === "domain_asset_vault",
    ),
    "protocol-fee SPL withdraw must thread DomainAssetVault for PDA-signed CPI",
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.withdraw_protocol_fee_sol.some(
      (account) => account.name === "recipient",
    ),
    "protocol-fee SOL withdraw must take a system-account recipient",
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.withdraw_pool_treasury_spl.some(
      (account) => account.name === "liquidity_pool",
    ),
    "pool-treasury withdraw must thread LiquidityPool for curator authority",
  );
  assert(
    PROTOCOL_INSTRUCTION_ACCOUNTS.withdraw_pool_oracle_fee_spl.some(
      (account) => account.name === "oracle_profile",
    ),
    "pool-oracle-fee withdraw must thread OracleProfile for oracle authority",
  );

  // Phase 1.7 PR3 — withdraw ix args matrix. All 6 ix share WithdrawArgs { amount: u64 }.
  for (const name of [
    "withdraw_protocol_fee_sol",
    "withdraw_protocol_fee_spl",
    "withdraw_pool_treasury_sol",
    "withdraw_pool_treasury_spl",
    "withdraw_pool_oracle_fee_sol",
    "withdraw_pool_oracle_fee_spl",
  ] as const) {
    const args = PROTOCOL_INSTRUCTION_ARGS[name];
    assert(args, `expected args for ${name}`);
    assert.equal(
      args.length,
      1,
      `${name} should take exactly one args struct (WithdrawArgs)`,
    );
  }

  assert(!instructionNames.includes("create_pool"));
  assert(!instructionNames.includes("set_pool_status"));
  assert(!serializedAccounts.includes("pool_type"));
  assert(serializedAccounts.includes("membership_anchor_seat"));
  assert(PROTOCOL_INSTRUCTION_ARGS.deposit_into_capital_class.length === 1);
  assert(idl.instructions.some((instruction) => instruction.name === "update_lp_position_credentialing"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.reserve_obligation.some((account) => account.name === "claim_case"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.release_reserve.some((account) => account.name === "claim_case"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.settle_obligation.some((account) => account.name === "claim_case"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.reserve_obligation.find((account) => account.name === "claim_case")?.pdaSeeds);
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.release_reserve.find((account) => account.name === "claim_case")?.pdaSeeds);
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.settle_obligation.find((account) => account.name === "claim_case")?.pdaSeeds);
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.fund_sponsor_budget.some((account) => account.name === "source_token_account"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.fund_sponsor_budget.some((account) => account.name === "vault_token_account"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.record_premium_payment.some((account) => account.name === "token_program"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.deposit_into_capital_class.some((account) => account.name === "source_token_account"));
  assert(PROTOCOL_INSTRUCTION_ACCOUNTS.request_redemption.some((account) => account.name === "protocol_governance"));
  assert.equal(depositArgs?.type.kind, "struct");
  assert.deepEqual(
    depositArgs?.type.fields?.map((field) => field.name),
    ["amount", "shares"],
  );
  assert.deepEqual(
    initProtocolFeeVaultArgs?.type.fields?.map((field) => field.name),
    ["asset_mint", "fee_recipient"],
  );
  assert.deepEqual(
    initPoolTreasuryVaultArgs?.type.fields?.map((field) => field.name),
    ["asset_mint", "fee_recipient"],
  );
  assert.deepEqual(
    initPoolOracleFeeVaultArgs?.type.fields?.map((field) => field.name),
    ["oracle", "asset_mint", "fee_recipient"],
  );
  assert.deepEqual(
    requestRedemptionArgs?.type.fields?.map((field) => field.name),
    ["shares"],
  );
  assert.deepEqual(
    processRedemptionArgs?.type.fields?.map((field) => field.name),
    ["shares"],
  );
  assert(claimCaseAccount?.type.fields?.some((field) => field.name === "attestation_count"));
  for (const fieldName of [
    "evidence_ref_hash",
    "decision_support_hash",
    "schema_hash",
    "schema_version",
    "liquidity_pool",
    "allocation_position",
  ]) {
    assert(
      claimAttestationAccount?.type.fields?.some((field) => field.name === fieldName),
      `ClaimAttestation missing ${fieldName}`,
    );
  }
});
