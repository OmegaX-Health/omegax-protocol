// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { extractRustFunctionBody, programSource } from "./program_source.ts";

const frontendProtocolSource = readFileSync(
  new URL("../../frontend/lib/protocol.ts", import.meta.url),
  "utf8",
);
const idl = JSON.parse(
  readFileSync(new URL("../../idl/omegax_protocol.json", import.meta.url), "utf8"),
) as { errors?: Array<{ name: string }> };

test("[CSO-2026-05-04] claim recipients lock after approval or payout", () => {
  const body = extractRustFunctionBody("authorize_claim_recipient");
  assert.match(body, /ClaimRecipientLocked/);
  assert.match(body, /claim_case\.intake_status\s*<\s*CLAIM_INTAKE_APPROVED/);
  assert.match(body, /claim_case\.paid_amount\s*==\s*0/);
});

test("[CSO-2026-05-04] LP allocation is same-asset only in v1", () => {
  assert.match(extractRustFunctionBody("create_allocation_position"), /require_allocator\(/);
  assert.match(extractRustFunctionBody("create_allocation_position"), /AllocationAssetMismatch/);
  assert.match(extractRustFunctionBody("allocate_capital"), /AllocationAssetMismatch/);
  assert.match(extractRustFunctionBody("deallocate_capital"), /AllocationAssetMismatch/);
});

test("[ALMANAX-d333108a] capital class update keeps pool queue-only policy as a floor", () => {
  const deriveQueueOnly =
    /derive_queue_only_redemptions\(\s*args\.pause_flags,\s*ctx\.accounts\.liquidity_pool\.redemption_policy,\s*\)/;

  assert.match(extractRustFunctionBody("create_capital_class"), deriveQueueOnly);
  assert.match(extractRustFunctionBody("update_capital_class_controls"), deriveQueueOnly);
  assert.doesNotMatch(
    extractRustFunctionBody("update_capital_class_controls"),
    /queue_only_redemptions\s*=\s*args\.queue_only_redemptions/,
  );
});

test("[ALMANAX-e529c167] capital class lockups cannot be negative", () => {
  const createBody = extractRustFunctionBody("create_capital_class");
  const depositBody = extractRustFunctionBody("apply_lp_position_deposit");

  assert.match(createBody, /args\.min_lockup_seconds >= 0[\s\S]+InvalidLockupSeconds/);
  assert.match(depositBody, /min_lockup_seconds >= 0[\s\S]+InvalidLockupSeconds/);
  assert.ok(idl.errors?.some((error) => error.name === "InvalidLockupSeconds"));
});

test("[ALMANAX-0bc4e15d] impairment PnL debits avoid lossy u64 to i64 casts", () => {
  const body = extractRustFunctionBody("mark_impairment");

  assert.doesNotMatch(body, /amount\s+as\s+i64/);
  assert.match(body, /debit_realized_pnl_for_loss\(allocation_position\.realized_pnl,\s*amount\)/);
  assert.match(body, /debit_realized_pnl_for_loss\(allocation_ledger\.realized_pnl,\s*amount\)/);
  assert.match(extractRustFunctionBody("debit_realized_pnl_for_loss"), /i64::try_from\(amount\)/);
  assert.match(extractRustFunctionBody("debit_realized_pnl_for_loss"), /checked_sub\(amount\)/);
});

test("[ALMANAX-675488d9] allocation creation binds plan, pool, funding line, and series", () => {
  const body = extractRustFunctionBody("create_allocation_position");

  assert.match(body, /capital_class\.reserve_domain[\s\S]+liquidity_pool\.reserve_domain[\s\S]+ReserveDomainMismatch/);
  assert.match(body, /health_plan\.reserve_domain[\s\S]+liquidity_pool\.reserve_domain[\s\S]+ReserveDomainMismatch/);
  assert.match(body, /funding_line\.reserve_domain[\s\S]+health_plan\.reserve_domain[\s\S]+ReserveDomainMismatch/);
  assert.match(body, /funding_line\.health_plan[\s\S]+health_plan\.key\(\)[\s\S]+HealthPlanMismatch/);
  assert.match(body, /funding_line\.policy_series[\s\S]+args\.policy_series[\s\S]+PolicySeriesMismatch/);
});

test("[ALMANAX-c46c7b81/5a8f554b] nonzero policy series must be canonical for members and funding lines", () => {
  assert.match(
    extractRustFunctionBody("open_member_position"),
    /validate_optional_policy_series\([\s\S]+args\.series_scope[\s\S]+true/,
  );
  assert.match(
    extractRustFunctionBody("open_funding_line"),
    /validate_optional_policy_series\([\s\S]+args\.policy_series[\s\S]+false/,
  );
  assert.match(
    extractRustFunctionBody("open_funding_line"),
    /args\.policy_series == ZERO_PUBKEY[\s\S]+series_reserve_ledger\.is_none\(\)/,
  );
  assert.match(
    extractRustFunctionBody("open_funding_line"),
    /series_reserve_ledger[\s\S]+ok_or\(OmegaXProtocolError::PolicySeriesMissing\)/,
  );
  assert.match(
    extractRustFunctionBody("create_obligation"),
    /funding_line\.policy_series[\s\S]+args\.policy_series[\s\S]+PolicySeriesMismatch/,
  );
});

test("[QEDGEN-2026-05-07] inactive plans and classes reject fresh intake before exposure", () => {
  assert.match(
    extractRustFunctionBody("open_member_position"),
    /require_health_plan_active\(&ctx\.accounts\.health_plan\)\?/,
  );
  assert.match(
    extractRustFunctionBody("open_claim_case"),
    /require_health_plan_active\(&ctx\.accounts\.health_plan\)\?/,
  );

  const depositBody = extractRustFunctionBody("deposit_into_capital_class");
  const activeGuardIndex = depositBody.indexOf("require_capital_class_active");
  const transferIndex = depositBody.indexOf("transfer_to_domain_vault");
  assert.notEqual(activeGuardIndex, -1);
  assert.notEqual(transferIndex, -1);
  assert.ok(
    activeGuardIndex < transferIndex,
    "capital class active guard must run before any SPL transfer",
  );

  const errorNames = new Set((idl.errors ?? []).map((error) => error.name));
  assert.ok(errorNames.has("HealthPlanInactive"), "IDL must expose HealthPlanInactive");
  assert.ok(errorNames.has("CapitalClassInactive"), "IDL must expose CapitalClassInactive");
});

test("[CSO-2026-05-10] inactive allocation scopes reject fresh capital allocation", () => {
  const allocateBody = extractRustFunctionBody("allocate_capital");
  const allocatorIndex = allocateBody.indexOf("require_allocator(");
  const poolGuardIndex = allocateBody.indexOf("require_liquidity_pool_active");
  const classGuardIndex = allocateBody.indexOf("require_capital_class_active");
  const allocationGuardIndex = allocateBody.indexOf("require_allocation_position_allocatable");
  const mutationIndex = allocateBody.indexOf("ctx.accounts.allocation_position.allocated_amount");

  for (const [label, index] of [
    ["allocator", allocatorIndex],
    ["pool guard", poolGuardIndex],
    ["class guard", classGuardIndex],
    ["allocation guard", allocationGuardIndex],
    ["mutation", mutationIndex],
  ] as const) {
    assert.notEqual(index, -1, `${label} must exist in allocate_capital`);
  }

  assert.ok(allocatorIndex < poolGuardIndex, "authorization must happen before active-state checks");
  assert.ok(poolGuardIndex < mutationIndex, "liquidity pool active guard must run before mutation");
  assert.ok(classGuardIndex < mutationIndex, "capital class active guard must run before mutation");
  assert.ok(allocationGuardIndex < mutationIndex, "allocation active guard must run before mutation");
  assert.match(programSource, /fn require_liquidity_pool_active\(/);
  assert.match(programSource, /fn require_allocation_position_allocatable\(/);

  const errorNames = new Set((idl.errors ?? []).map((error) => error.name));
  assert.ok(errorNames.has("LiquidityPoolInactive"), "IDL must expose LiquidityPoolInactive");
  assert.ok(errorNames.has("AllocationPositionInactive"), "IDL must expose AllocationPositionInactive");
});

test("[CSO-2026-05-04] allocation and reserve booking require free capacity", () => {
  assert.match(extractRustFunctionBody("allocate_capital"), /require_allocatable_reserve_capacity\(/);
  assert.match(extractRustFunctionBody("reserve_obligation"), /require_obligation_reserve_capacity\(/);
  assert.match(programSource, /fn require_obligation_reserve_capacity\(/);
  assert.match(programSource, /InsufficientFreeReserveCapacity/);
});

test("[CSO-2026-05-05] linked obligations require linked claim accounts before settlement mutation", () => {
  const body = extractRustFunctionBody("settle_obligation");
  const linkedFlagIndex = body.indexOf("let obligation_is_linked = obligation_has_linked_claim_case(obligation)");
  const claimBranchIndex = body.indexOf("if let Some(claim_case)");
  const settlementMutationIndex = body.indexOf("settle_delivery");
  assert.notEqual(linkedFlagIndex, -1);
  assert.notEqual(claimBranchIndex, -1);
  assert.notEqual(settlementMutationIndex, -1);
  assert.ok(
    linkedFlagIndex < claimBranchIndex,
    "linked obligation detection must run before optional claim-account routing",
  );
  assert.ok(
    linkedFlagIndex < settlementMutationIndex,
    "linked obligation detection must run before settlement balance mutation",
  );
  assert.match(body, /if obligation_is_linked[\s\S]+claim_case\.is_some\(\)[\s\S]+member_position\.is_some\(\)/);
  assert.match(body, /else if obligation_is_linked[\s\S]+SettlementOutflowAccountsRequired/);
});

test("[CSO-2026-05-04] asset-backed obligation settlement always requires outflow", () => {
  const body = extractRustFunctionBody("settle_obligation");
  assert.match(body, /else if args\.next_status == OBLIGATION_STATUS_SETTLED/);
  assert.match(body, /SettlementOutflowAccountsRequired/);
  assert.match(body, /recipient_ta\.owner,\s*ctx\.accounts\.authority\.key\(\)/);
  assert.match(body, /transfer_from_domain_vault\(/);
  assert.match(frontendProtocolSource, /const includeSettlementOutflow = Boolean\(\s*params\.vaultTokenAccountAddress\s*&&\s*params\.recipientTokenAccountAddress/s);
  assert.match(frontendProtocolSource, /optionalProtocolAccount\(params\.memberPositionAddress\)/);
});

test("[CSO-2026-05-04] broad pool authority helper is removed from mutation paths", () => {
  assert.doesNotMatch(programSource, /fn require_pool_control\(/);
  assert.match(extractRustFunctionBody("create_capital_class"), /require_curator_control\(/);
  assert.match(extractRustFunctionBody("update_capital_class_controls"), /require_curator_control\(/);
  assert.doesNotMatch(programSource, /set_pool_oracle/);
  assert.match(extractRustFunctionBody("update_allocation_caps"), /require_allocator\(/);
});

test("[CSO-2026-05-06] allocation cap updates bind authorization to the allocation pool", () => {
  const body = extractRustFunctionBody("update_allocation_caps");
  const poolBindingIndex = body.indexOf("ctx.accounts.allocation_position.liquidity_pool");
  const authIndex = body.indexOf("require_allocator(");
  const mutationIndex = body.indexOf("allocation.cap_amount");

  assert.notEqual(poolBindingIndex, -1);
  assert.notEqual(authIndex, -1);
  assert.notEqual(mutationIndex, -1);
  assert.ok(
    poolBindingIndex < authIndex,
    "allocation position must be bound to the provided pool before allocator authorization",
  );
  assert.ok(
    poolBindingIndex < mutationIndex,
    "allocation position must be bound to the provided pool before cap mutation",
  );
  assert.match(
    body,
    /require_keys_eq!\([\s\S]*ctx\.accounts\.allocation_position\.liquidity_pool[\s\S]*ctx\.accounts\.liquidity_pool\.key\(\)[\s\S]*OmegaXProtocolError::LiquidityPoolMismatch/,
  );
});

test("[CSO-2026-05-05] obligation lifecycle transitions reject partial amounts before mutation", () => {
  const body = extractRustFunctionBody("settle_obligation");
  const guardIndex = body.indexOf("require_full_obligation_transition_amount");
  assert.notEqual(guardIndex, -1);
  for (const mutation of [
    "release_reserved_to_delivery",
    "settle_delivery",
    "cancel_outstanding",
  ]) {
    const mutationIndex = body.indexOf(mutation);
    assert.notEqual(mutationIndex, -1);
    assert.ok(guardIndex < mutationIndex, `${mutation} must be after the full-transition guard`);
  }
  assert.match(programSource, /PartialObligationTransitionUnsupported/);
});

test("[CSO-2026-05-05] obligation delivery mode is validated before ledger booking", () => {
  const body = extractRustFunctionBody("create_obligation");
  const guardIndex = body.indexOf("require_supported_obligation_delivery_mode");
  const bookIndex = body.indexOf("book_owed");
  assert.notEqual(guardIndex, -1);
  assert.notEqual(bookIndex, -1);
  assert.ok(guardIndex < bookIndex, "delivery mode must be checked before owed ledger mutation");
  assert.match(programSource, /InvalidObligationDeliveryMode/);
});

test("[CSO-2026-05-05] claim adjudication locks after payout or terminal state before rewrites", () => {
  const body = extractRustFunctionBody("adjudicate_claim_case");
  const guardIndex = body.indexOf("require_claim_adjudication_mutable");
  const rewriteIndex = body.indexOf("claim_case.adjudicator");
  assert.notEqual(guardIndex, -1);
  assert.notEqual(rewriteIndex, -1);
  assert.ok(guardIndex < rewriteIndex, "adjudication lock must run before claim fields are rewritten");
  assert.match(programSource, /ClaimAdjudicationLocked/);
});

test("[CSO-2026-05-05] IDL exposes pre-mainnet liability-state error codes", () => {
  const errorNames = new Set((idl.errors ?? []).map((error) => error.name));
  for (const expected of [
    "PartialObligationTransitionUnsupported",
    "InvalidObligationDeliveryMode",
    "ClaimAdjudicationLocked",
  ]) {
    assert.ok(errorNames.has(expected), `IDL must expose ${expected}`);
  }
});
