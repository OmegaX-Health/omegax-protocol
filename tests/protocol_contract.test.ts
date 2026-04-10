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

  assert(instructionNames.includes("create_reserve_domain"));
  assert(instructionNames.includes("create_health_plan"));
  assert(instructionNames.includes("create_policy_series"));
  assert(instructionNames.includes("open_funding_line"));
  assert(instructionNames.includes("create_liquidity_pool"));
  assert(instructionNames.includes("create_capital_class"));
  assert(instructionNames.includes("update_lp_position_credentialing"));
  assert(instructionNames.includes("create_allocation_position"));
  assert(instructionNames.includes("mark_impairment"));

  assert(accountNames.includes("ReserveDomain"));
  assert(accountNames.includes("HealthPlan"));
  assert(accountNames.includes("PolicySeries"));
  assert(accountNames.includes("FundingLine"));
  assert(accountNames.includes("LiquidityPool"));
  assert(accountNames.includes("CapitalClass"));
  assert(accountNames.includes("AllocationPosition"));
  assert(accountNames.includes("Obligation"));

  assert(!instructionNames.includes("create_pool"));
  assert(!instructionNames.includes("set_pool_status"));
  assert(!serializedAccounts.includes("pool_type"));
  assert(PROTOCOL_INSTRUCTION_ARGS.deposit_into_capital_class.length === 1);
  assert(idl.instructions.some((instruction) => instruction.name === "update_lp_position_credentialing"));
  assert.equal(depositArgs?.type.kind, "struct");
  assert.deepEqual(
    depositArgs?.type.fields?.map((field) => field.name),
    ["amount", "shares"],
  );
});
