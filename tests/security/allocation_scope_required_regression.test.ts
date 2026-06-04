// SPDX-License-Identifier: AGPL-3.0-or-later
//
// CSO-2026-05-04 follow-up: the LP allocation surface was removed from the
// live protocol. These regressions now pin the smaller sponsor/premium/backstop
// reserve path instead of preserving allocation-scoped accounts.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { extractRustFunctionBody, programSource } from "./program_source.ts";

const idl = JSON.parse(
  readFileSync(new URL("../../idl/omegax_protocol.json", import.meta.url), "utf8"),
) as {
  instructions: Array<{ name: string }>;
  accounts?: Array<{ name: string }>;
};

const removedInstructionNames = [
  "create_liquidity_pool",
  "create_capital_class",
  "update_capital_class_controls",
  "deposit_into_capital_class",
  "update_lp_position_credentialing",
  "request_redemption",
  "process_redemption_queue",
  "create_allocation_position",
  "update_allocation_caps",
  "allocate_capital",
  "deallocate_capital",
  "mark_impairment",
];

const removedAccountNames = [
  "LiquidityPool",
  "CapitalClass",
  "LPPosition",
  "PoolClassLedger",
  "AllocationPosition",
  "AllocationLedger",
];

test("[CSO-2026-05-04] LP allocation instructions and accounts stay removed", () => {
  const instructionNames = new Set(idl.instructions.map((instruction) => instruction.name));
  const accountNames = new Set((idl.accounts ?? []).map((account) => account.name));

  for (const name of removedInstructionNames) {
    assert(!instructionNames.has(name), `${name} must stay out of the IDL`);
  }
  for (const name of removedAccountNames) {
    assert(!accountNames.has(name), `${name} must stay out of the IDL`);
  }
});

test("[CSO-2026-05-04] treasury mutation bindings are sponsor-reserve scoped only", () => {
  const body = extractRustFunctionBody("validate_treasury_mutation_bindings");

  assert.match(body, /obligation\.funding_line[\s\S]+funding_line_key[\s\S]+FundingLineMismatch/);
  assert.match(body, /obligation\.asset_mint[\s\S]+funding_line_asset_mint[\s\S]+AssetMintMismatch/);
  assert.doesNotMatch(body, /validate_optional_series_ledger/);
  assert.doesNotMatch(body, /liquidity_pool/);
  assert.doesNotMatch(body, /capital_class/);
  assert.doesNotMatch(body, /allocation_position/);
});

test("[CSO-2026-05-06] retired series reserve ledger stays out of the treasury path", () => {
  assert.doesNotMatch(programSource, /validate_optional_series_ledger/);
  assert.doesNotMatch(programSource, /SEED_SERIES_RESERVE_LEDGER/);
  assert.doesNotMatch(programSource, /SeriesReserveLedger/);
  assert.doesNotMatch(programSource, /validate_optional_pool_class_ledger/);
  assert.doesNotMatch(programSource, /validate_optional_allocation_position/);
  assert.doesNotMatch(programSource, /validate_optional_allocation_ledger/);
});

test("[CSO-2026-05-07] obligation creation validates plan and funding line before owed booking", () => {
  const createBody = extractRustFunctionBody("create_obligation");
  const scopeBody = extractRustFunctionBody("validate_obligation_creation_scope");
  const scopeIndex = createBody.indexOf("validate_obligation_creation_scope(");
  const persistIndex = createBody.indexOf("let obligation = &mut ctx.accounts.obligation");
  const bookIndex = createBody.indexOf("book_owed(");

  assert(scopeIndex > 0, "create_obligation should call the scope validator");
  assert(persistIndex > scopeIndex, "scope should be validated before obligation persistence");
  assert(bookIndex > scopeIndex, "scope should be validated before any owed ledger mutation");
  assert.match(scopeBody, /funding_line\.reserve_domain[\s\S]+health_plan\.reserve_domain[\s\S]+ReserveDomainMismatch/);
  assert.match(scopeBody, /funding_line\.health_plan[\s\S]+health_plan\.key\(\)[\s\S]+HealthPlanMismatch/);
  assert.match(scopeBody, /is_supported_funding_line_type\(funding_line\.line_type\)/);
  assert.doesNotMatch(scopeBody, /liquidity_pool/);
  assert.doesNotMatch(scopeBody, /capital_class/);
  assert.doesNotMatch(scopeBody, /allocation_position/);
});

test("[CSO-2026-05-07] create obligation account context carries no LP scope accounts", () => {
  const context = programSource.match(/pub struct CreateObligation<'info>[\s\S]+?pub system_program: Program<'info, System>/);
  assert(context, "CreateObligation context should exist");
  assert.doesNotMatch(context![0], /LiquidityPool/);
  assert.doesNotMatch(context![0], /CapitalClass/);
  assert.doesNotMatch(context![0], /PoolClassLedger/);
  assert.doesNotMatch(context![0], /AllocationPosition/);
  assert.doesNotMatch(context![0], /AllocationLedger/);
});

test("[CSO-2026-05-04] reserve, release, and settlement share the strict binding gate", () => {
  assert.match(extractRustFunctionBody("reserve_obligation"), /validate_treasury_mutation_bindings\(/);
  assert.match(extractRustFunctionBody("release_reserve"), /validate_treasury_mutation_bindings\(/);
  assert.match(extractRustFunctionBody("settle_obligation"), /validate_treasury_mutation_bindings\(/);
});

test("[CSO-2026-05-04] settlement debits only reserve ledgers and vault totals", () => {
  const body = extractRustFunctionBody("settle_delivery");

  assert.match(body, /settle_from_sheet\(domain_sheet/);
  assert.match(body, /settle_from_sheet\(plan_sheet/);
  assert.match(body, /settle_from_sheet\(line_sheet/);
  assert.doesNotMatch(body, /series/);
  assert.match(body, /\*domain_assets\s*=\s*checked_sub\(\*domain_assets,\s*amount\)\?/);
  assert.doesNotMatch(body, /settle_from_allocation_sheet/);
  assert.doesNotMatch(body, /allocation_position/);
  assert.doesNotMatch(body, /allocation_sheet/);
});
