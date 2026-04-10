// SPDX-License-Identifier: AGPL-3.0-or-later

export const SCENARIO_ORDER = [
  "governance_and_scoped_controls",
  "reserve_domain_and_vault_setup",
  "sponsor_funded_plan_lifecycle",
  "reward_obligation_lifecycle",
  "protection_claim_lifecycle",
  "liquidity_pool_and_capital_class_lifecycle",
  "allocation_and_deallocation_lifecycle",
  "impairment_and_redemption_queue_lifecycle",
] as const;

export type ScenarioName = (typeof SCENARIO_ORDER)[number];

export type ScenarioDefinition = {
  title: string;
  focus: string;
  instructions: readonly string[];
};

export const SCENARIO_DEFINITIONS: Record<ScenarioName, ScenarioDefinition> = {
  governance_and_scoped_controls: {
    title: "Governance and Scoped Controls",
    focus: "Protocol-wide, domain-scoped, plan-scoped, and class-scoped safety controls stay explicit and local.",
    instructions: [
      "initialize_protocol_governance",
      "set_protocol_emergency_pause",
      "update_reserve_domain_controls",
      "update_health_plan_controls",
      "update_capital_class_controls",
    ],
  },
  reserve_domain_and_vault_setup: {
    title: "Reserve Domain and Vault Setup",
    focus: "Settlement segregation, custody mapping, and domain ledgers remain explicit per [reserve_domain, asset_mint].",
    instructions: [
      "create_reserve_domain",
      "create_domain_asset_vault",
    ],
  },
  sponsor_funded_plan_lifecycle: {
    title: "Sponsor-Funded Plan Lifecycle",
    focus: "Sponsors create plans, version product lanes, enroll members, and fund plan-side lines without minting LP exposure.",
    instructions: [
      "create_health_plan",
      "create_policy_series",
      "version_policy_series",
      "open_member_position",
      "update_member_eligibility",
      "open_funding_line",
      "fund_sponsor_budget",
    ],
  },
  reward_obligation_lifecycle: {
    title: "Reward Obligation Lifecycle",
    focus: "Rewards reconcile through the same obligation and reserve kernel used by protection products.",
    instructions: [
      "create_obligation",
      "reserve_obligation",
      "settle_obligation",
      "release_reserve",
    ],
  },
  protection_claim_lifecycle: {
    title: "Protection Claim Lifecycle",
    focus: "Protection flows record premium income, explicit claim cases, adjudication, and settlement consequences.",
    instructions: [
      "record_premium_payment",
      "open_claim_case",
      "attach_claim_evidence_ref",
      "adjudicate_claim_case",
      "settle_claim_case",
    ],
  },
  liquidity_pool_and_capital_class_lifecycle: {
    title: "Liquidity Pool and Capital Class Lifecycle",
    focus: "LP capital enters through explicit pools, classes, managed credentialing, and LP positions rather than plan-side sponsor budgets.",
    instructions: [
      "create_liquidity_pool",
      "create_capital_class",
      "update_lp_position_credentialing",
      "deposit_into_capital_class",
      "request_redemption",
      "process_redemption_queue",
    ],
  },
  allocation_and_deallocation_lifecycle: {
    title: "Allocation and Deallocation Lifecycle",
    focus: "Capital exposure into plans and series is explicit, many-to-many, and bounded by allocation policy.",
    instructions: [
      "create_allocation_position",
      "update_allocation_caps",
      "allocate_capital",
      "deallocate_capital",
    ],
  },
  impairment_and_redemption_queue_lifecycle: {
    title: "Impairment and Redemption Queue Lifecycle",
    focus: "Impairment, restricted capital, and redemption queue pressure remain visible in class and allocation ledgers.",
    instructions: [
      "mark_impairment",
    ],
  },
};

export const INSTRUCTION_EXCEPTION_REASONS: Partial<Record<string, string>> = {};

export const RETIRED_LEGACY_INSTRUCTIONS = [
  "create_pool",
  "set_pool_status",
  "fund_pool_sol",
  "fund_pool_spl",
  "initialize_pool_liquidity_sol",
  "initialize_pool_liquidity_spl",
  "request_pool_liquidity_redemption",
  "submit_reward_claim",
  "submit_coverage_claim",
  "settle_coverage_claim",
] as const;

export function scenarioNames(): ScenarioName[] {
  return [...SCENARIO_ORDER];
}

export function instructionsForScenario(name: ScenarioName): string[] {
  return [...SCENARIO_DEFINITIONS[name].instructions];
}

export function allOwnedInstructions(): string[] {
  return SCENARIO_ORDER.flatMap((name) => SCENARIO_DEFINITIONS[name].instructions);
}

export function blankInstructionExceptionReasons(): string[] {
  return Object.entries(INSTRUCTION_EXCEPTION_REASONS)
    .filter(([, reason]) => !reason || !reason.trim())
    .map(([instruction]) => instruction)
    .sort((left, right) => left.localeCompare(right));
}

export function duplicateOwnedInstructions(): string[] {
  const counts = new Map<string, number>();
  for (const instruction of allOwnedInstructions()) {
    counts.set(instruction, (counts.get(instruction) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([instruction]) => instruction)
    .sort((left, right) => left.localeCompare(right));
}
