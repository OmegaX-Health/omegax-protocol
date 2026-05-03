// SPDX-License-Identifier: AGPL-3.0-or-later

export const SCENARIO_ORDER = [
  "governance_and_scoped_controls",
  "oracle_registry_and_pool_control_lifecycle",
  "schema_registry_and_binding_lifecycle",
  "reserve_domain_and_vault_setup",
  "bootstrap_to_self_serve_plan_journey",
  "founder_commitment_waterfall_lifecycle",
  "sponsor_funded_plan_lifecycle",
  "reward_obligation_lifecycle",
  "protection_claim_lifecycle",
  "liquidity_pool_and_capital_class_lifecycle",
  "allocation_and_deallocation_lifecycle",
  "impairment_and_redemption_queue_lifecycle",
  "fee_vault_lifecycle",
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
      "rotate_protocol_governance_authority",
      "set_protocol_emergency_pause",
      "update_reserve_domain_controls",
      "update_health_plan_controls",
      "update_capital_class_controls",
    ],
  },
  oracle_registry_and_pool_control_lifecycle: {
    title: "Oracle Registry and Pool Controls",
    focus: "Oracle operators register once, then receive explicit pool-scoped approval, permission bits, and policy posture.",
    instructions: [
      "register_oracle",
      "claim_oracle",
      "update_oracle_profile",
      "set_pool_oracle",
      "set_pool_oracle_permissions",
      "set_pool_oracle_policy",
    ],
  },
  schema_registry_and_binding_lifecycle: {
    title: "Schema Registry and Binding",
    focus: "Outcome schemas are published, verified, bound into pool rule dependencies, and retired through canonical governance paths.",
    instructions: [
      "register_outcome_schema",
      "verify_outcome_schema",
      "backfill_schema_dependency_ledger",
      "close_outcome_schema",
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
  bootstrap_to_self_serve_plan_journey: {
    title: "Bootstrap to Self-Serve Plan Journey",
    focus:
      "Fresh bootstrap state, canonical launch rails, oracle onboarding, member enrollment, claim intake, and LP capital all stay connected as one end-to-end operating path.",
    instructions: [],
  },
  founder_commitment_waterfall_lifecycle: {
    title: "Founder Commitment Waterfall Lifecycle",
    focus:
      "Founder Travel30 stays one public campaign with multiple payment rails, pending custody outside claims-paying reserve, waterfall activation only after rail pricing/freshness controls, and explicit refund/pause controls.",
    instructions: [
      "configure_reserve_asset_rail",
      "publish_reserve_asset_rail_price",
      "create_commitment_campaign",
      "create_commitment_payment_rail",
      "deposit_commitment",
      "activate_direct_premium_commitment",
      "activate_treasury_credit_commitment",
      "activate_waterfall_commitment",
      "refund_commitment",
      "pause_commitment_campaign",
    ],
  },
  sponsor_funded_plan_lifecycle: {
    title: "Sponsor-Funded Plan Lifecycle",
    focus: "Sponsors create plans, version product lanes, enroll members, and fund plan-side lines without minting LP exposure.",
    instructions: [
      "create_health_plan",
      "create_policy_series",
      "initialize_series_reserve_ledger",
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
    focus: "Protection flows record premium income, explicit claim cases, attestation-ready adjudication, and linked obligation reserve and settlement consequences.",
    instructions: [
      "record_premium_payment",
      "open_claim_case",
      "authorize_claim_recipient",
      "attach_claim_evidence_ref",
      "attest_claim_case",
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
  fee_vault_lifecycle: {
    title: "Fee Vault Lifecycle",
    focus:
      "Phase 1.6/1.7 fee accumulation + withdrawal infrastructure: governance-init fee vaults per rail, accrual hooks on the inflow handlers (premium / deposit / redemption / claim settle), and per-rail-authority withdrawals across SOL and SPL.",
    instructions: [
      "init_protocol_fee_vault",
      "init_pool_treasury_vault",
      "init_pool_oracle_fee_vault",
      "withdraw_protocol_fee_sol",
      "withdraw_protocol_fee_spl",
      "withdraw_pool_treasury_sol",
      "withdraw_pool_treasury_spl",
      "withdraw_pool_oracle_fee_sol",
      "withdraw_pool_oracle_fee_spl",
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
