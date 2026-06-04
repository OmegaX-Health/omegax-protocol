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

test("[CSO-2026-05-04] LP allocation surface is removed instead of cross-asset scoped", () => {
  assert.doesNotMatch(programSource, /create_allocation_position/);
  assert.doesNotMatch(programSource, /allocate_capital/);
  assert.doesNotMatch(programSource, /deallocate_capital/);
  assert.doesNotMatch(programSource, /AllocationAssetMismatch/);
});

test("[ALMANAX-d333108a] capital class controls are removed with redemption queues", () => {
  assert.doesNotMatch(programSource, /create_capital_class/);
  assert.doesNotMatch(programSource, /update_capital_class_controls/);
  assert.doesNotMatch(programSource, /derive_queue_only_redemptions/);
});

test("[ALMANAX-e529c167] capital class lockups are not part of the live surface", () => {
  const errorNames = new Set((idl.errors ?? []).map((error) => error.name));
  assert.doesNotMatch(programSource, /min_lockup_seconds/);
  assert(!errorNames.has("InvalidLockupSeconds"), "lockup-only error should stay removed");
});

test("[ALMANAX-0bc4e15d] standalone impairment PnL path is removed", () => {
  assert.doesNotMatch(programSource, /mark_impairment/);
  assert.doesNotMatch(programSource, /debit_realized_pnl_for_loss/);
});

test("[ALMANAX-675488d9] funding-line scope stays bound without allocation creation", () => {
  const body = extractRustFunctionBody("validate_obligation_creation_scope");

  assert.match(body, /funding_line\.reserve_domain[\s\S]+health_plan\.reserve_domain[\s\S]+ReserveDomainMismatch/);
  assert.match(body, /funding_line\.health_plan[\s\S]+health_plan\.key\(\)[\s\S]+HealthPlanMismatch/);
  assert.doesNotMatch(programSource, /create_allocation_position/);
});

test("[ALMANAX-c46c7b81/5a8f554b] nonzero policy series must be canonical for claims and funding lines", () => {
  const openClaimContextIndex = programSource.indexOf("pub struct OpenClaimCase<");
  assert.notEqual(openClaimContextIndex, -1, "OpenClaimCase context must exist");
  const openClaimContextEnd = programSource.indexOf("pub struct AuthorizeClaimRecipient<", openClaimContextIndex);
  assert.notEqual(openClaimContextEnd, -1, "AuthorizeClaimRecipient context must follow OpenClaimCase");
  const openClaimContext = programSource.slice(openClaimContextIndex, openClaimContextEnd);

  assert.match(openClaimContext, /funding_line\.policy_series\s*==\s*args\.policy_series/);
  assert.match(
    extractRustFunctionBody("open_funding_line"),
    /validate_optional_policy_series\([\s\S]+args\.policy_series[\s\S]+false/,
  );
  assert.doesNotMatch(programSource, /series_reserve_ledger/);
  assert.doesNotMatch(programSource, /SEED_SERIES_RESERVE_LEDGER/);
  assert.match(
    extractRustFunctionBody("create_obligation"),
    /funding_line\.policy_series[\s\S]+args\.policy_series[\s\S]+PolicySeriesMismatch/,
  );
});

test("[QEDGEN-2026-05-07] inactive plans reject fresh intake before exposure", () => {
  assert.match(
    extractRustFunctionBody("open_claim_case"),
    /require_health_plan_active\(&ctx\.accounts\.health_plan\)\?/,
  );

  const errorNames = new Set((idl.errors ?? []).map((error) => error.name));
  assert.ok(errorNames.has("HealthPlanInactive"), "IDL must expose HealthPlanInactive");
  assert(!errorNames.has("CapitalClassInactive"), "capital class inactive error should stay removed");
});

test("[CSO-2026-05-10] inactive allocation-scope risk is removed with allocation instructions", () => {
  assert.doesNotMatch(programSource, /fn require_liquidity_pool_active\(/);
  assert.doesNotMatch(programSource, /fn require_allocation_position_allocatable\(/);
  assert.doesNotMatch(programSource, /allocate_capital/);

  const errorNames = new Set((idl.errors ?? []).map((error) => error.name));
  assert(!errorNames.has("LiquidityPoolInactive"), "LP inactive error should stay removed");
  assert(!errorNames.has("AllocationPositionInactive"), "allocation inactive error should stay removed");
});

test("[CSO-2026-05-04] allocation and reserve booking require free capacity", () => {
  assert.doesNotMatch(programSource, /require_allocatable_reserve_capacity/);
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
  assert.match(body, /if obligation_is_linked[\s\S]+claim_case\.is_some\(\)/);
  assert.match(body, /else if obligation_is_linked[\s\S]+SettlementOutflowAccountsRequired/);
});

test("[CSO-2026-05-04] asset-backed obligation settlement always requires outflow", () => {
  const body = extractRustFunctionBody("settle_obligation");
  assert.match(body, /else if args\.next_status == OBLIGATION_STATUS_SETTLED/);
  assert.match(body, /SettlementOutflowAccountsRequired/);
  assert.match(body, /recipient_ta\.owner,\s*ctx\.accounts\.authority\.key\(\)/);
  assert.match(body, /transfer_from_domain_vault\(/);
  assert.match(frontendProtocolSource, /const includeSettlementOutflow = Boolean\(\s*params\.vaultTokenAccountAddress\s*&&\s*params\.recipientTokenAccountAddress/s);
  assert.doesNotMatch(frontendProtocolSource, /optionalProtocolAccount\(params\.memberPositionAddress\)/);
});

test("[CSO-2026-05-04] broad pool authority helper is removed from mutation paths", () => {
  assert.doesNotMatch(programSource, /fn require_pool_control\(/);
  assert.doesNotMatch(programSource, /fn require_curator_control\(/);
  assert.doesNotMatch(programSource, /fn require_allocator\(/);
  assert.doesNotMatch(programSource, /set_pool_oracle/);
});

test("[CSO-2026-05-06] allocation cap update instruction stays removed", () => {
  assert.doesNotMatch(programSource, /update_allocation_caps/);
  assert.doesNotMatch(programSource, /allocation\.cap_amount/);
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
