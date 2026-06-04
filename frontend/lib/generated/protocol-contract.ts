// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// source: shared/protocol_contract.json
// contract_sha256: 84c34b8f960d5e114c53ac8e1020b02c9863cf35d56d0f885497164dda6ec7bf

export type ProtocolInstructionName =
  | "adjudicate_claim_case"
  | "authorize_claim_recipient"
  | "create_domain_asset_vault"
  | "create_health_plan"
  | "create_obligation"
  | "create_policy_series"
  | "create_reserve_domain"
  | "fund_sponsor_budget"
  | "open_claim_case"
  | "open_funding_line"
  | "record_premium_payment"
  | "release_reserve"
  | "reserve_obligation"
  | "settle_claim_case"
  | "settle_obligation"
  | "update_health_plan_controls"
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
  "authorize_claim_recipient": Uint8Array.from([112, 97, 129, 42, 125, 165, 226, 163]),
  "create_domain_asset_vault": Uint8Array.from([31, 13, 112, 128, 23, 164, 26, 108]),
  "create_health_plan": Uint8Array.from([136, 7, 197, 134, 241, 206, 83, 171]),
  "create_obligation": Uint8Array.from([216, 144, 172, 223, 19, 106, 220, 54]),
  "create_policy_series": Uint8Array.from([70, 162, 231, 218, 211, 136, 110, 176]),
  "create_reserve_domain": Uint8Array.from([222, 2, 8, 218, 45, 157, 193, 246]),
  "fund_sponsor_budget": Uint8Array.from([150, 210, 161, 31, 50, 12, 224, 32]),
  "open_claim_case": Uint8Array.from([151, 125, 231, 211, 63, 132, 248, 184]),
  "open_funding_line": Uint8Array.from([231, 140, 66, 127, 163, 1, 197, 9]),
  "record_premium_payment": Uint8Array.from([196, 182, 182, 56, 146, 87, 170, 29]),
  "release_reserve": Uint8Array.from([170, 102, 52, 144, 33, 176, 41, 60]),
  "reserve_obligation": Uint8Array.from([48, 113, 133, 225, 40, 36, 197, 86]),
  "settle_claim_case": Uint8Array.from([178, 123, 229, 204, 50, 204, 91, 71]),
  "settle_obligation": Uint8Array.from([209, 166, 218, 35, 147, 139, 238, 208]),
  "update_health_plan_controls": Uint8Array.from([108, 11, 28, 140, 226, 164, 239, 113]),
  "update_reserve_domain_controls": Uint8Array.from([3, 60, 38, 233, 198, 167, 116, 197]),
  "version_policy_series": Uint8Array.from([64, 76, 132, 253, 41, 220, 169, 146]),
};

export const PROTOCOL_INSTRUCTION_ARGS: Record<ProtocolInstructionName, ProtocolInstructionArg[]> = {
  "adjudicate_claim_case": [
      { name: "args", type: {"defined":{"name":"AdjudicateClaimCaseArgs"}} },
  ],
  "authorize_claim_recipient": [
      { name: "args", type: {"defined":{"name":"AuthorizeClaimRecipientArgs"}} },
  ],
  "create_domain_asset_vault": [
      { name: "args", type: {"defined":{"name":"CreateDomainAssetVaultArgs"}} },
  ],
  "create_health_plan": [
      { name: "args", type: {"defined":{"name":"CreateHealthPlanArgs"}} },
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
  "fund_sponsor_budget": [
      { name: "args", type: {"defined":{"name":"FundSponsorBudgetArgs"}} },
  ],
  "open_claim_case": [
      { name: "args", type: {"defined":{"name":"OpenClaimCaseArgs"}} },
  ],
  "open_funding_line": [
      { name: "args", type: {"defined":{"name":"OpenFundingLineArgs"}} },
  ],
  "record_premium_payment": [
      { name: "args", type: {"defined":{"name":"RecordPremiumPaymentArgs"}} },
  ],
  "release_reserve": [
      { name: "args", type: {"defined":{"name":"ReleaseReserveArgs"}} },
  ],
  "reserve_obligation": [
      { name: "args", type: {"defined":{"name":"ReserveObligationArgs"}} },
  ],
  "settle_claim_case": [
      { name: "args", type: {"defined":{"name":"SettleClaimCaseArgs"}} },
  ],
  "settle_obligation": [
      { name: "args", type: {"defined":{"name":"SettleObligationArgs"}} },
  ],
  "update_health_plan_controls": [
      { name: "args", type: {"defined":{"name":"UpdateHealthPlanControlsArgs"}} },
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
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
      { name: "obligation", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
  ],
  "authorize_claim_recipient": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "claim_case.health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
  ],
  "create_domain_asset_vault": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "reserve_domain", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "account", path: "reserve_domain.domain_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "asset_mint", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "vault_token_account", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116, 95, 116, 111, 107, 101, 110] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "token_program", writable: false, signer: false, optional: false, address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", pdaSeeds: undefined },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_health_plan": [
      { name: "plan_admin", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "reserve_domain", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "account", path: "reserve_domain.domain_id" }] },
      { name: "health_plan", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "reserve_domain" }, { kind: "arg", path: "args.plan_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_obligation": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "arg", path: "args.obligation_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_policy_series": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "policy_series", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 108, 105, 99, 121, 95, 115, 101, 114, 105, 101, 115] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.series_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "create_reserve_domain": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "reserve_domain", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "arg", path: "args.domain_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "fund_sponsor_budget": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "source_token_account", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "asset_mint", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "vault_token_account", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "token_program", writable: false, signer: false, optional: false, address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", pdaSeeds: undefined },
  ],
  "open_claim_case": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "funding_line", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.claim_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "open_funding_line": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.asset_mint" }] },
      { name: "policy_series", writable: false, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
  "record_premium_payment": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "source_token_account", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "asset_mint", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "vault_token_account", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "token_program", writable: false, signer: false, optional: false, address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", pdaSeeds: undefined },
  ],
  "release_reserve": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "obligation.obligation_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
  ],
  "reserve_obligation": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "obligation.obligation_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
  ],
  "settle_claim_case": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "claim_case", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
      { name: "obligation", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "asset_mint", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "vault_token_account", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "recipient_token_account", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "token_program", writable: false, signer: false, optional: false, address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", pdaSeeds: undefined },
  ],
  "settle_obligation": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "domain_asset_vault", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 118, 97, 117, 108, 116] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "domain_asset_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [100, 111, 109, 97, 105, 110, 95, 97, 115, 115, 101, 116, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "funding_line", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "funding_line.line_id" }] },
      { name: "funding_line_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [102, 117, 110, 100, 105, 110, 103, 95, 108, 105, 110, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "funding_line.asset_mint" }] },
      { name: "plan_reserve_ledger", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 108, 97, 110, 95, 114, 101, 115, 101, 114, 118, 101, 95, 108, 101, 100, 103, 101, 114] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "obligation.asset_mint" }] },
      { name: "obligation", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [111, 98, 108, 105, 103, 97, 116, 105, 111, 110] }, { kind: "account", path: "funding_line" }, { kind: "account", path: "obligation.obligation_id" }] },
      { name: "claim_case", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: [{ kind: "const", value: [99, 108, 97, 105, 109, 95, 99, 97, 115, 101] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "claim_case.claim_id" }] },
      { name: "asset_mint", writable: false, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "vault_token_account", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "recipient_token_account", writable: true, signer: false, optional: true, address: undefined, pdaSeeds: undefined },
      { name: "token_program", writable: false, signer: false, optional: true, address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", pdaSeeds: undefined },
  ],
  "update_health_plan_controls": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
  ],
  "update_reserve_domain_controls": [
      { name: "authority", writable: false, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "reserve_domain", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [114, 101, 115, 101, 114, 118, 101, 95, 100, 111, 109, 97, 105, 110] }, { kind: "account", path: "reserve_domain.domain_id" }] },
  ],
  "version_policy_series": [
      { name: "authority", writable: true, signer: true, optional: false, address: undefined, pdaSeeds: undefined },
      { name: "health_plan", writable: false, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [104, 101, 97, 108, 116, 104, 95, 112, 108, 97, 110] }, { kind: "account", path: "health_plan.reserve_domain" }, { kind: "account", path: "health_plan.health_plan_id" }] },
      { name: "current_policy_series", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 108, 105, 99, 121, 95, 115, 101, 114, 105, 101, 115] }, { kind: "account", path: "health_plan" }, { kind: "account", path: "current_policy_series.series_id" }] },
      { name: "next_policy_series", writable: true, signer: false, optional: false, address: undefined, pdaSeeds: [{ kind: "const", value: [112, 111, 108, 105, 99, 121, 95, 115, 101, 114, 105, 101, 115] }, { kind: "account", path: "health_plan" }, { kind: "arg", path: "args.series_id" }] },
      { name: "system_program", writable: false, signer: false, optional: false, address: "11111111111111111111111111111111", pdaSeeds: undefined },
  ],
};

export const PROTOCOL_ACCOUNT_DISCRIMINATORS: Record<string, Uint8Array> = {
  "ClaimCase": Uint8Array.from([7, 178, 225, 1, 54, 47, 117, 180]),
  "DomainAssetLedger": Uint8Array.from([82, 42, 164, 106, 70, 160, 154, 99]),
  "DomainAssetVault": Uint8Array.from([105, 110, 75, 179, 247, 58, 135, 229]),
  "FundingLine": Uint8Array.from([112, 72, 52, 244, 254, 229, 217, 235]),
  "FundingLineLedger": Uint8Array.from([233, 46, 244, 60, 190, 65, 156, 68]),
  "HealthPlan": Uint8Array.from([66, 134, 136, 77, 63, 55, 103, 191]),
  "Obligation": Uint8Array.from([168, 206, 141, 106, 88, 76, 172, 167]),
  "PlanReserveLedger": Uint8Array.from([243, 245, 230, 224, 27, 105, 48, 128]),
  "PolicySeries": Uint8Array.from([196, 117, 121, 249, 37, 71, 245, 23]),
  "ReserveDomain": Uint8Array.from([119, 76, 223, 192, 177, 116, 88, 178]),
};

export const PROTOCOL_PDA_SEEDS: Record<string, string[]> = {
  "reserve_domain": ["reserve_domain", "<domain_id>"],
  "domain_asset_vault": ["domain_asset_vault", "<reserve_domain>", "<asset_mint>"],
  "domain_asset_vault_token": ["domain_asset_vault_token", "<reserve_domain>", "<asset_mint>"],
  "domain_asset_ledger": ["domain_asset_ledger", "<reserve_domain>", "<asset_mint>"],
  "health_plan": ["health_plan", "<reserve_domain>", "<plan_id>"],
  "plan_reserve_ledger": ["plan_reserve_ledger", "<health_plan>", "<asset_mint>"],
  "policy_series": ["policy_series", "<health_plan>", "<series_id>"],
  "funding_line": ["funding_line", "<health_plan>", "<line_id>"],
  "funding_line_ledger": ["funding_line_ledger", "<funding_line>", "<asset_mint>"],
  "claim_case": ["claim_case", "<health_plan>", "<claim_id>"],
  "obligation": ["obligation", "<funding_line>", "<obligation_id>"],
  "oracle_profile": ["oracle_profile", "<oracle>"],
};
