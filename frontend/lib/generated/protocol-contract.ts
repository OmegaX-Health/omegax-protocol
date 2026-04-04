// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// source: shared/protocol_contract.json
// contract_sha256: 10cf548fd9221511a40aafb2952640e41d16ce2c7e28b89a3f4acaf11613947b

export type ProtocolInstructionName =
  | "adjudicate_claim_case"
  | "allocate_capital"
  | "attach_claim_evidence_ref"
  | "create_allocation_position"
  | "create_capital_class"
  | "create_domain_asset_vault"
  | "create_health_plan"
  | "create_liquidity_pool"
  | "create_obligation"
  | "create_policy_series"
  | "create_reserve_domain"
  | "deallocate_capital"
  | "deposit_into_capital_class"
  | "fund_sponsor_budget"
  | "initialize_protocol_governance"
  | "mark_impairment"
  | "open_claim_case"
  | "open_funding_line"
  | "open_member_position"
  | "process_redemption_queue"
  | "record_premium_payment"
  | "release_reserve"
  | "request_redemption"
  | "reserve_obligation"
  | "set_protocol_emergency_pause"
  | "settle_claim_case"
  | "settle_obligation"
  | "update_allocation_caps"
  | "update_capital_class_controls"
  | "update_health_plan_controls"
  | "update_member_eligibility"
  | "update_reserve_domain_controls"
  | "version_policy_series";

export type ProtocolInstructionArg = {
  name: string;
  type: unknown;
};

export type ProtocolInstructionAccount = {
  name: string;
  writable: boolean;
  signer: boolean;
  optional: boolean;
  address?: string;
  pdaSeeds?: Array<{ kind: string; path?: string; value?: number[] }>;
};

export const PROTOCOL_PROGRAM_ID = "Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B" as const;

export const PROTOCOL_INSTRUCTION_DISCRIMINATORS: Record<ProtocolInstructionName, Uint8Array> = {
  "adjudicate_claim_case": Uint8Array.from([146, 99, 255, 26, 223, 88, 235, 114]),
  "allocate_capital": Uint8Array.from([146, 129, 60, 205, 88, 225, 60, 183]),
  "attach_claim_evidence_ref": Uint8Array.from([52, 246, 203, 87, 244, 143, 132, 131]),
  "create_allocation_position": Uint8Array.from([165, 80, 76, 13, 12, 202, 112, 31]),
  "create_capital_class": Uint8Array.from([0, 161, 244, 112, 151, 137, 35, 221]),
  "create_domain_asset_vault": Uint8Array.from([31, 13, 112, 128, 23, 164, 26, 108]),
  "create_health_plan": Uint8Array.from([136, 7, 197, 134, 241, 206, 83, 171]),
  "create_liquidity_pool": Uint8Array.from([175, 75, 181, 165, 224, 254, 6, 131]),
  "create_obligation": Uint8Array.from([216, 144, 172, 223, 19, 106, 220, 54]),
  "create_policy_series": Uint8Array.from([70, 162, 231, 218, 211, 136, 110, 176]),
  "create_reserve_domain": Uint8Array.from([222, 2, 8, 218, 45, 157, 193, 246]),
  "deallocate_capital": Uint8Array.from([10, 97, 97, 189, 60, 170, 102, 29]),
  "deposit_into_capital_class": Uint8Array.from([40, 215, 33, 115, 185, 101, 196, 167]),
  "fund_sponsor_budget": Uint8Array.from([150, 210, 161, 31, 50, 12, 224, 32]),
  "initialize_protocol_governance": Uint8Array.from([220, 188, 231, 198, 20, 71, 42, 123]),
  "mark_impairment": Uint8Array.from([58, 97, 30, 157, 211, 45, 174, 238]),
  "open_claim_case": Uint8Array.from([151, 125, 231, 211, 63, 132, 248, 184]),
  "open_funding_line": Uint8Array.from([231, 140, 66, 127, 163, 1, 197, 9]),
  "open_member_position": Uint8Array.from([161, 42, 115, 196, 30, 87, 104, 236]),
  "process_redemption_queue": Uint8Array.from([244, 120, 208, 73, 216, 200, 158, 93]),
  "record_premium_payment": Uint8Array.from([196, 182, 182, 56, 146, 87, 170, 29]),
  "release_reserve": Uint8Array.from([170, 102, 52, 144, 33, 176, 41, 60]),
  "request_redemption": Uint8Array.from([14, 62, 182, 237, 59, 79, 149, 22]),
  "reserve_obligation": Uint8Array.from([48, 113, 133, 225, 40, 36, 197, 86]),
  "set_protocol_emergency_pause": Uint8Array.from([180, 209, 92, 144, 227, 14, 97, 94]),
  "settle_claim_case": Uint8Array.from([178, 123, 229, 204, 50, 204, 91, 71]),
  "settle_obligation": Uint8Array.from([209, 166, 218, 35, 147, 139, 238, 208]),
  "update_allocation_caps": Uint8Array.from([224, 101, 103, 146, 78, 5, 48, 132]),
  "update_capital_class_controls": Uint8Array.from([34, 4, 113, 70, 79, 197, 244, 109]),
  "update_health_plan_controls": Uint8Array.from([108, 11, 28, 140, 226, 164, 239, 113]),
  "update_member_eligibility": Uint8Array.from([254, 66, 68, 244, 98, 157, 111, 191]),
  "update_reserve_domain_controls": Uint8Array.from([3, 60, 38, 233, 198, 167, 116, 197]),
  "version_policy_series": Uint8Array.from([64, 76, 132, 253, 41, 220, 169, 146]),
};

export const PROTOCOL_INSTRUCTION_ARGS: Record<ProtocolInstructionName, ProtocolInstructionArg[]> = {
  "adjudicate_claim_case": [
      { name: "args", type: {"defined":{"name":"AdjudicateClaimCaseArgs"}} },
  ],
  "allocate_capital": [
      { name: "args", type: {"defined":{"name":"AllocateCapitalArgs"}} },
  ],
  "attach_claim_evidence_ref": [
      { name: "args", type: {"defined":{"name":"AttachClaimEvidenceRefArgs"}} },
  ],
  "create_allocation_position": [
      { name: "args", type: {"defined":{"name":"CreateAllocationPositionArgs"}} },
  ],
  "create_capital_class": [
      { name: "args", type: {"defined":{"name":"CreateCapitalClassArgs"}} },
  ],
  "create_domain_asset_vault": [
      { name: "args", type: {"defined":{"name":"CreateDomainAssetVaultArgs"}} },
  ],
  "create_health_plan": [
      { name: "args", type: {"defined":{"name":"CreateHealthPlanArgs"}} },
  ],
  "create_liquidity_pool": [
      { name: "args", type: {"defined":{"name":"CreateLiquidityPoolArgs"}} },
  ],
  "create_obligation": [
      { name: "args", type: {"defined":{"name":"CreateObligationArgs"}} },
  ],
  "create_policy_series": [
      { name: "args", type: {"defined":{"name":"CreatePolicySeriesArgs"}} },
  ],
  "create_reserve_domain": [
      { name: "args", type: {"defined":{"name":"CreateReserveDomainArgs"}} },
  ],
  "deallocate_capital": [
      { name: "args", type: {"defined":{"name":"DeallocateCapitalArgs"}} },
  ],
  "deposit_into_capital_class": [
      { name: "args", type: {"defined":{"name":"DepositIntoCapitalClassArgs"}} },
  ],
  "fund_sponsor_budget": [
      { name: "args", type: {"defined":{"name":"FundSponsorBudgetArgs"}} },
  ],
  "initialize_protocol_governance": [
      { name: "args", type: {"defined":{"name":"InitializeProtocolGovernanceArgs"}} },
  ],
  "mark_impairment": [
      { name: "args", type: {"defined":{"name":"MarkImpairmentArgs"}} },
  ],
  "open_claim_case": [
      { name: "args", type: {"defined":{"name":"OpenClaimCaseArgs"}} },
  ],
  "open_funding_line": [
      { name: "args", type: {"defined":{"name":"OpenFundingLineArgs"}} },
  ],
  "open_member_position": [
      { name: "args", type: {"defined":{"name":"OpenMemberPositionArgs"}} },
  ],
  "process_redemption_queue": [
      { name: "args", type: {"defined":{"name":"ProcessRedemptionQueueArgs"}} },
  ],
  "record_premium_payment": [
      { name: "args", type: {"defined":{"name":"RecordPremiumPaymentArgs"}} },
  ],
  "release_reserve": [
      { name: "args", type: {"defined":{"name":"ReleaseReserveArgs"}} },
  ],
  "request_redemption": [
      { name: "args", type: {"defined":{"name":"RequestRedemptionArgs"}} },
  ],
  "reserve_obligation": [
      { name: "args", type: {"defined":{"name":"ReserveObligationArgs"}} },
  ],
  "set_protocol_emergency_pause": [
      { name: "args", type: {"defined":{"name":"SetProtocolEmergencyPauseArgs"}} },
  ],
  "settle_claim_case": [
      { name: "args", type: {"defined":{"name":"SettleClaimCaseArgs"}} },
  ],
  "settle_obligation": [
      { name: "args", type: {"defined":{"name":"SettleObligationArgs"}} },
  ],
  "update_allocation_caps": [
      { name: "args", type: {"defined":{"name":"UpdateAllocationCapsArgs"}} },
  ],
  "update_capital_class_controls": [
      { name: "args", type: {"defined":{"name":"UpdateCapitalClassControlsArgs"}} },
  ],
  "update_health_plan_controls": [
      { name: "args", type: {"defined":{"name":"UpdateHealthPlanControlsArgs"}} },
  ],
  "update_member_eligibility": [
      { name: "args", type: {"defined":{"name":"UpdateMemberEligibilityArgs"}} },
  ],
  "update_reserve_domain_controls": [
      { name: "args", type: {"defined":{"name":"UpdateReserveDomainControlsArgs"}} },
  ],
  "version_policy_series": [
      { name: "args", type: {"defined":{"name":"VersionPolicySeriesArgs"}} },
  ],
};

export const PROTOCOL_INSTRUCTION_ACCOUNTS: Record<ProtocolInstructionName, ProtocolInstructionAccount[]> = {
  "adjudicate_claim_case": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
      { name: "obligation", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
  ],
  "allocate_capital": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "liquidity_pool", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "account", path: "capital_class.class_id" }] },
      { name: "pool_class_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 111, 108, 95, 99, 108, 97, 115, 115, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "funding_line", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "allocation_position.health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "allocation_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [97, 108, 108, 111, 99, 97, 116, 105, 111, 110, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "funding_line" }] },
      { name: "allocation_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [97, 108, 108, 111, 99, 97, 116, 105, 111, 110, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "allocation_position" }, { kind: "account", path: "funding_line.asset_mint" }] },
  ],
  "attach_claim_evidence_ref": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
  ],
  "create_allocation_position": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "liquidity_pool", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "account", path: "capital_class.class_id" }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "funding_line", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "allocation_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [97, 108, 108, 111, 99, 97, 116, 105, 111, 110, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "funding_line" }] },
      { name: "allocation_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [97, 108, 108, 111, 99, 97, 116, 105, 111, 110, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "allocation_position" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_capital_class": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "liquidity_pool", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "arg", path: "args.class_id" }] },
      { name: "pool_class_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 111, 108, 95, 99, 108, 97, 115, 115, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_domain_asset_vault": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "reserve_domain", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "account", path: "reserve_domain.domain_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_health_plan": [
      { name: "plan_admin", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "reserve_domain", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "account", path: "reserve_domain.domain_id" }] },
      { name: "health_plan", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.plan_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_liquidity_pool": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "reserve_domain", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "account", path: "reserve_domain.domain_id" }] },
      { name: "domain_asset_vault", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.deposit_asset_mint" }] },
      { name: "liquidity_pool", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.pool_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_obligation": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "pool_class_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "arg", path: "args.obligation_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_policy_series": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "policy_series", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 108, 105, 99, 121, 95, 115, 101, 114, 105, 101, 115] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.series_id" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [115, 101, 114, 105, 101, 115, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "policy_series" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_reserve_domain": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "reserve_domain", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "arg", path: "args.domain_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "deallocate_capital": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "liquidity_pool", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "account", path: "capital_class.class_id" }] },
      { name: "pool_class_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 111, 108, 95, 99, 108, 97, 115, 115, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "funding_line", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "allocation_position.health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "allocation_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [97, 108, 108, 111, 99, 97, 116, 105, 111, 110, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "funding_line" }] },
      { name: "allocation_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [97, 108, 108, 111, 99, 97, 116, 105, 111, 110, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "allocation_position" }, { kind: "account", path: "funding_line.asset_mint" }] },
  ],
  "deposit_into_capital_class": [
      { name: "owner", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "liquidity_pool", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "account", path: "capital_class.class_id" }] },
      { name: "pool_class_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 111, 108, 95, 99, 108, 97, 115, 115, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "lp_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 112, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "owner" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "fund_sponsor_budget": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
  ],
  "initialize_protocol_governance": [
      { name: "governance_authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "mark_impairment": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "pool_class_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_position", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "obligation", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
  ],
  "open_claim_case": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "member_position", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [109, 101, 109, 98, 101, 114, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "member_position.wallet" }, { kind: "account", path: "member_position.policy_series" }] },
      { name: "funding_line", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.claim_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "open_funding_line": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "open_member_position": [
      { name: "wallet", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "member_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [109, 101, 109, 98, 101, 114, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "wallet" }, { kind: "arg", path: "args.series_scope" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "process_redemption_queue": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "liquidity_pool", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "account", path: "capital_class.class_id" }] },
      { name: "pool_class_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 111, 108, 95, 99, 108, 97, 115, 115, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "lp_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 112, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "lp_position.owner" }] },
  ],
  "record_premium_payment": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "pool_class_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
  ],
  "release_reserve": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "pool_class_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_position", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "obligation.obligation_id" }] },
  ],
  "request_redemption": [
      { name: "owner", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "liquidity_pool", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "account", path: "capital_class.class_id" }] },
      { name: "pool_class_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 111, 108, 95, 99, 108, 97, 115, 115, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.deposit_asset_mint" }] },
      { name: "lp_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 112, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "capital_class" }, { kind: "account", path: "owner" }] },
  ],
  "reserve_obligation": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "pool_class_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_position", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "obligation.obligation_id" }] },
  ],
  "set_protocol_emergency_pause": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
  ],
  "settle_claim_case": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "pool_class_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_position", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
      { name: "obligation", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
  ],
  "settle_obligation": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "series_reserve_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "pool_class_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_position", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "allocation_ledger", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "obligation.obligation_id" }] },
  ],
  "update_allocation_caps": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "liquidity_pool", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "allocation_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [97, 108, 108, 111, 99, 97, 116, 105, 111, 110, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "allocation_position.capital_class" }, { kind: "account", path: "allocation_position.funding_line" }] },
  ],
  "update_capital_class_controls": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "liquidity_pool", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [108, 105, 113, 117, 105, 100, 105, 116, 121, 95, 112, 111, 111, 108] }, { kind: "account", path: "liquidity_pool.reserve_domain" }, { kind: "account", path: "liquidity_pool.pool_id" }] },
      { name: "capital_class", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 97, 112, 105, 116, 97, 108, 95, 99, 108, 97, 115, 115] }, { kind: "account", path: "liquidity_pool" }, { kind: "account", path: "capital_class.class_id" }] },
  ],
  "update_health_plan_controls": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
  ],
  "update_member_eligibility": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "member_position", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [109, 101, 109, 98, 101, 114, 95, 112, 111, 115, 105, 116, 105, 111, 110] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "member_position.wallet" }, { kind: "account", path: "member_position.policy_series" }] },
  ],
  "update_reserve_domain_controls": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "reserve_domain", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "account", path: "reserve_domain.domain_id" }] },
  ],
  "version_policy_series": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "protocol_governance", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 114, 111, 116, 111, 99, 111, 108, 95, 103, 111, 118, 101, 114, 110, 97, 110, 99, 101] }] },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "current_policy_series", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 108, 105, 99, 121, 95, 115, 101, 114, 105, 101, 115] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "current_policy_series.series_id" }] },
      { name: "next_policy_series", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 108, 105, 99, 121, 95, 115, 101, 114, 105, 101, 115] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.series_id" }] },
      { name: "next_series_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [115, 101, 114, 105, 101, 115, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "next_policy_series" }, { kind: "account", path: "current_policy_series.asset_mint" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
};

export const PROTOCOL_ACCOUNT_DISCRIMINATORS: Record<string, Uint8Array> = {
  "AllocationLedger": Uint8Array.from([53, 81, 62, 163, 68, 200, 187, 50]),
  "AllocationPosition": Uint8Array.from([243, 106, 252, 36, 249, 56, 227, 55]),
  "CapitalClass": Uint8Array.from([161, 52, 78, 54, 200, 103, 206, 252]),
  "ClaimCase": Uint8Array.from([7, 178, 225, 1, 54, 47, 117, 180]),
  "DomainAssetLedger": Uint8Array.from([82, 42, 164, 106, 70, 160, 154, 99]),
  "DomainAssetVault": Uint8Array.from([105, 110, 75, 179, 247, 58, 135, 229]),
  "FundingLine": Uint8Array.from([112, 72, 52, 244, 254, 229, 217, 235]),
  "FundingLineLedger": Uint8Array.from([233, 46, 244, 60, 190, 65, 156, 68]),
  "HealthPlan": Uint8Array.from([66, 134, 136, 77, 63, 55, 103, 191]),
  "LiquidityPool": Uint8Array.from([66, 38, 17, 64, 188, 80, 68, 129]),
  "LPPosition": Uint8Array.from([196, 56, 115, 198, 14, 117, 32, 224]),
  "MemberPosition": Uint8Array.from([88, 118, 224, 251, 240, 186, 123, 175]),
  "Obligation": Uint8Array.from([168, 206, 141, 106, 88, 76, 172, 167]),
  "PlanReserveLedger": Uint8Array.from([243, 245, 230, 224, 27, 105, 48, 128]),
  "PolicySeries": Uint8Array.from([196, 117, 121, 249, 37, 71, 245, 23]),
  "PoolClassLedger": Uint8Array.from([147, 125, 17, 88, 188, 78, 109, 204]),
  "ProtocolGovernance": Uint8Array.from([71, 235, 253, 251, 202, 254, 132, 177]),
  "ReserveDomain": Uint8Array.from([119, 76, 223, 192, 177, 116, 88, 178]),
  "SeriesReserveLedger": Uint8Array.from([0, 109, 195, 30, 140, 79, 210, 234]),
};

export const PROTOCOL_PDA_SEEDS: Record<string, string[]> = {
  "protocol_governance": ["protocol_governance"],
  "reserve_domain": ["reserve_domain", "<domain_id>"],
  "domain_asset_vault": ["domain_asset_vault", "<reserve_domain>", "<asset_mint>"],
  "domain_asset_ledger": ["domain_asset_ledger", "<reserve_domain>", "<asset_mint>"],
  "health_plan": ["health_plan", "<reserve_domain>", "<plan_id>"],
  "plan_reserve_ledger": ["plan_reserve_ledger", "<health_plan>", "<asset_mint>"],
  "policy_series": ["policy_series", "<health_plan>", "<series_id>"],
  "series_reserve_ledger": ["series_reserve_ledger", "<policy_series>", "<asset_mint>"],
  "member_position": ["member_position", "<health_plan>", "<wallet>", "<series_scope>"],
  "funding_line": ["funding_line", "<health_plan>", "<line_id>"],
  "funding_line_ledger": ["funding_line_ledger", "<funding_line>", "<asset_mint>"],
  "claim_case": ["claim_case", "<health_plan>", "<claim_id>"],
  "obligation": ["obligation", "<funding_line>", "<obligation_id>"],
  "liquidity_pool": ["liquidity_pool", "<reserve_domain>", "<pool_id>"],
  "capital_class": ["capital_class", "<liquidity_pool>", "<class_id>"],
  "pool_class_ledger": ["pool_class_ledger", "<capital_class>", "<asset_mint>"],
  "lp_position": ["lp_position", "<capital_class>", "<owner>"],
  "allocation_position": ["allocation_position", "<capital_class>", "<funding_line>"],
  "allocation_ledger": ["allocation_ledger", "<allocation_position>", "<asset_mint>"],
};
