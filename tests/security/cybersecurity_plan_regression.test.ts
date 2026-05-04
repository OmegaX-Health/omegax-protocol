// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { extractRustFunctionBody, programSource } from "./program_source.ts";

const frontendProtocolSource = readFileSync(
  new URL("../../frontend/lib/protocol.ts", import.meta.url),
  "utf8",
);

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

test("[CSO-2026-05-04] allocation and reserve booking require free capacity", () => {
  assert.match(extractRustFunctionBody("allocate_capital"), /require_allocatable_reserve_capacity\(/);
  assert.match(extractRustFunctionBody("reserve_obligation"), /require_obligation_reserve_capacity\(/);
  assert.match(programSource, /fn require_obligation_reserve_capacity\(/);
  assert.match(programSource, /InsufficientFreeReserveCapacity/);
});

test("[CSO-2026-05-04] commitment activation requires active campaign and rail", () => {
  for (const fnName of [
    "activate_direct_premium_commitment",
    "activate_treasury_credit_commitment",
    "activate_waterfall_commitment",
  ]) {
    assert.match(
      extractRustFunctionBody(fnName),
      /require_commitment_activation_window\(/,
      `${fnName} must reject canceled, paused, expired, or rail-paused campaigns`,
    );
  }
  assert.match(programSource, /fn require_commitment_activation_window\(/);
  assert.match(programSource, /require_commitment_campaign_active\(campaign\)\?/);
  assert.match(programSource, /require_commitment_payment_rail_active\(payment_rail\)/);
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
  assert.match(extractRustFunctionBody("set_pool_oracle"), /require_curator_control\(/);
  assert.match(extractRustFunctionBody("set_pool_oracle_permissions"), /require_curator_control\(/);
  assert.match(extractRustFunctionBody("set_pool_oracle_policy"), /require_curator_control\(/);
  assert.match(extractRustFunctionBody("update_allocation_caps"), /require_allocator\(/);
});
