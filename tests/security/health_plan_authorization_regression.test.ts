// SPDX-License-Identifier: AGPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";

import { extractRustFunctionBody } from "./program_source.ts";

test("[CSO-2026-05-10] health plan creation requires reserve-domain control", () => {
  const body = extractRustFunctionBody("create_health_plan");

  assert.match(body, /require_domain_control\(/);
  assert.match(body, /plan_admin\.key\(\)/);
  assert.doesNotMatch(body, /protocol_governance/);
  assert.match(body, /reserve_domain/);
});
