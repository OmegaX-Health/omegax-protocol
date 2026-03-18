# Solana Instruction Map

This map is a reviewer aid, not a formal call graph. It shows where each public instruction enters the program, which handler owns the logic, which Anchor context validates accounts, and which state/helper areas matter most when you need to trace behavior.

## Compatibility admin

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `set_pool_oracle` | `src/lib.rs` inline | `SetPoolOracle` in `src/core_accounts.rs` | `Pool`, `OracleRegistryEntry`, `PoolOracleApproval` | compatibility pool-to-oracle approval path |

## Governance and oracle lifecycle

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `initialize_protocol` | `src/surface/admin.rs` | `InitializeProtocol` in `contexts/protocol.rs` | `ProtocolConfig` | governance bootstrap |
| `set_protocol_params` | `src/surface/admin.rs` | `SetProtocolParams` in `contexts/protocol.rs` | `ProtocolConfig` | emergency pause and fee configuration |
| `rotate_governance_authority` | `src/surface/admin.rs` | `RotateGovernanceAuthority` in `contexts/protocol.rs` | `ProtocolConfig` | governance rotation |
| `register_oracle` | `src/surface/admin.rs` | `RegisterOracle` in `contexts/oracles.rs` | `OracleRegistryEntry`, `OracleProfile` | `shared/oracle.rs` validation |
| `claim_oracle` | `src/surface/admin.rs` | `ClaimOracle` in `contexts/oracles.rs` | `OracleRegistryEntry`, `OracleProfile` | oracle profile claim |
| `update_oracle_profile` | `src/surface/admin.rs` | `UpdateOracleProfile` in `contexts/oracles.rs` | `OracleProfile` | `shared/oracle.rs` validation |
| `update_oracle_metadata` | `src/surface/admin.rs` | `UpdateOracleMetadata` in `contexts/oracles.rs` | `OracleRegistryEntry` | metadata-only update |
| `stake_oracle` | `src/surface/admin.rs` | `StakeOracle` in `contexts/oracles.rs` | `ProtocolConfig`, `OracleRegistryEntry`, `OracleStakePosition` | token vault setup |
| `request_unstake` | `src/surface/admin.rs` | `RequestUnstake` in `contexts/oracles.rs` | `OracleStakePosition` | cooldown staging |
| `finalize_unstake` | `src/surface/admin.rs` | `FinalizeUnstake` in `contexts/oracles.rs` | `OracleStakePosition` | SPL transfer from stake vault |
| `slash_oracle` | `src/surface/admin.rs` | `SlashOracle` in `contexts/oracles.rs` | `ProtocolConfig`, `OracleStakePosition` | governance-enforced stake slash |

## Pool, schema, and member lifecycle

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `create_pool` | `src/surface/pools.rs` | `CreatePool` in `contexts/pools.rs` | `Pool`, `PoolTerms`, `PoolOraclePolicy` | pool bootstrap |
| `set_pool_status` | `src/surface/pools.rs` | `SetPoolStatus` in `contexts/pools.rs` | `Pool` | active / closed lifecycle |
| `set_pool_oracle_policy` | `src/surface/pools.rs` | `SetPoolOraclePolicy` in `contexts/pools.rs` | `PoolOraclePolicy` | oracle quorum, fee, and challenge-window policy |
| `set_pool_coverage_reserve_floor` | `src/surface/pools.rs` | `SetPoolCoverageReserveFloor` in `contexts/pools.rs` | `PoolTreasuryReserve` | reserve floor bookkeeping |
| `set_pool_risk_controls` | `src/surface/pools.rs` | `SetPoolRiskControls` in `contexts/pools.rs` | `PoolRiskConfig`, `PoolTreasuryReserve` | `shared/risk.rs` scoped redemption / claim pause and impairment booking |
| `create_policy_series` | `src/surface/coverage.rs` | `CreatePolicySeries` in `contexts/coverage.rs` | `PolicySeries` | series-native product root under the pool capital and governance shell |
| `update_policy_series` | `src/surface/coverage.rs` | `UpdatePolicySeries` in `contexts/coverage.rs` | `PolicySeries` | updates the active series terms, metadata, and comparability/oracle/risk refs |
| `set_pool_compliance_policy` | `src/surface/pools.rs` | `SetPoolCompliancePolicy` in `contexts/pools.rs` | `PoolCompliancePolicy` | credential-provider, action-mask, and rail-mode policy |
| `set_pool_control_authorities` | `src/surface/pools.rs` | `SetPoolControlAuthorities` in `contexts/pools.rs` | `PoolControlAuthority` | separates operator, risk-manager, compliance, and guardian lanes |
| `set_pool_automation_policy` | `src/surface/pools.rs` | `SetPoolAutomationPolicy` in `contexts/pools.rs` | `PoolAutomationPolicy` | bounded-autonomy policy for oracle and claim support |
| `set_pool_oracle_permissions` | `src/surface/pools.rs` | `SetPoolOraclePermissions` in `contexts/pools.rs` | `PoolOracleApproval`, `PoolOraclePermissionSet` | `shared/oracle.rs` permission model |
| `set_pool_terms_hash` | `src/surface/pools.rs` | `SetPoolTermsHash` in `contexts/pools.rs` | `PoolTerms` | terms and payout policy hashes |
| `register_outcome_schema` | `src/surface/pools.rs` | `RegisterOutcomeSchema` in `contexts/schemas.rs` | `OutcomeSchemaRegistryEntry` | schema registry with family/version/interop metadata |
| `verify_outcome_schema` | `src/surface/pools.rs` | `VerifyOutcomeSchema` in `contexts/schemas.rs` | `OutcomeSchemaRegistryEntry` | governance / authority verification |
| `backfill_schema_dependency_ledger` | `src/surface/pools.rs` | `BackfillSchemaDependencyLedger` in `contexts/schemas.rs` | `OutcomeSchemaRegistryEntry`, `SchemaDependencyLedger` | governance migration path for pre-dependency schemas using supplied `PoolOutcomeRule` accounts |
| `close_outcome_schema` | `src/surface/pools.rs` | `CloseOutcomeSchema` in `contexts/schemas.rs` | `OutcomeSchemaRegistryEntry`, `SchemaDependencyLedger` | governance close path after dependency refcount reaches zero |
| `set_policy_series_outcome_rule` | `src/surface/pools.rs` | `SetPolicySeriesOutcomeRule` in `contexts/schemas.rs` | `PoolOutcomeRule` | `shared/rules.rs` schema binding plus series-scoped interop/code-family validation |
| `register_invite_issuer` | `src/surface/pools.rs` | `RegisterInviteIssuer` in `contexts/members.rs` | `InviteIssuerRegistryEntry` | invite-only enrollment support |
| `enroll_member_open` | `src/surface/pools.rs` | `EnrollMemberOpen` in `contexts/members.rs` | `MembershipRecord` | open enrollment with optional compliance-policy gating |
| `enroll_member_token_gate` | `src/surface/pools.rs` | `EnrollMemberTokenGate` in `contexts/members.rs` | `MembershipRecord` | token-gated enrollment with optional compliance-policy gating |
| `enroll_member_invite_permit` | `src/surface/pools.rs` | `EnrollMemberInvitePermit` in `contexts/members.rs` | `MembershipRecord`, `EnrollmentPermitReplay` | signed invite replay protection with optional compliance-policy gating |
| `set_claim_delegate` | `src/surface/pools.rs` | `SetClaimDelegate` in `contexts/members.rs` | `ClaimDelegate` | delegated reward claims |
| `fund_pool_sol` | `src/surface/pools.rs` | `FundPoolSol` in `contexts/pools.rs` | `Pool` | direct lamport funding |
| `fund_pool_spl` | `src/surface/pools.rs` | `FundPoolSpl` in `contexts/pools.rs` | `PoolTerms`, `PoolAssetVault` | pool vault bootstrap for SPL payouts |

## Liquidity lifecycle

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `initialize_pool_liquidity_sol` | `src/surface/pools.rs` | `InitializePoolLiquiditySol` in `contexts/liquidity.rs` | `PoolLiquidityConfig` | `shared/liquidity.rs` math and bootstrap checks |
| `initialize_pool_liquidity_spl` | `src/surface/pools.rs` | `InitializePoolLiquiditySpl` in `contexts/liquidity.rs` | `PoolLiquidityConfig`, `PoolAssetVault` | SPL liquidity bootstrap |
| `set_pool_liquidity_enabled` | `src/surface/pools.rs` | `SetPoolLiquidityEnabled` in `contexts/liquidity.rs` | `PoolLiquidityConfig` | liquidity pause toggle |
| `register_pool_capital_class` | `src/surface/pools.rs` | `RegisterPoolCapitalClass` in `contexts/liquidity.rs` | `PoolCapitalClass`, `PoolLiquidityConfig`, `PoolTerms` | records the capital-class wrapper around the compatibility share mint, including restriction, compliance-profile, queue, and vintage semantics |
| `deposit_pool_liquidity_sol` | `src/surface/pools.rs` | `DepositPoolLiquiditySol` in `contexts/liquidity.rs` | `PoolLiquidityConfig`, `PoolShareMint` | `shared/liquidity.rs` share issuance with optional compliance gating |
| `deposit_pool_liquidity_spl` | `src/surface/pools.rs` | `DepositPoolLiquiditySpl` in `contexts/liquidity.rs` | `PoolLiquidityConfig`, `PoolAssetVault`, `PoolShareMint` | SPL liquidity deposit with optional compliance gating |
| `redeem_pool_liquidity_sol` | `src/surface/pools.rs` | `RedeemPoolLiquiditySol` in `contexts/liquidity.rs` | `PoolLiquidityConfig`, `PoolRiskConfig`, `PoolTreasuryReserve`, `PoolShareMint` | direct SOL redemption using free-capital math and pool risk controls |
| `redeem_pool_liquidity_spl` | `src/surface/pools.rs` | `RedeemPoolLiquiditySpl` in `contexts/liquidity.rs` | `PoolLiquidityConfig`, `PoolRiskConfig`, `PoolAssetVault`, `PoolTreasuryReserve`, `PoolShareMint` | direct SPL redemption with free-capital math, rail checks, and pool risk controls |
| `request_pool_liquidity_redemption` | `src/surface/pools.rs` | `RequestPoolLiquidityRedemption` in `contexts/liquidity.rs` | `PoolRedemptionRequest`, `PoolCapitalClass`, `PoolRiskConfig`, `PoolTreasuryReserve` | escrows shares into a queue-aware redemption request with notice window metadata |
| `schedule_pool_liquidity_redemption` | `src/surface/pools.rs` | `SchedulePoolLiquidityRedemption` in `contexts/liquidity.rs` | `PoolRedemptionRequest`, `PoolControlAuthority` | risk-authority scheduling once the notice window matures |
| `cancel_pool_liquidity_redemption` | `src/surface/pools.rs` | `CancelPoolLiquidityRedemption` in `contexts/liquidity.rs` | `PoolRedemptionRequest` | returns escrowed shares and closes the request path back to the redeemer |
| `fail_pool_liquidity_redemption` | `src/surface/pools.rs` | `FailPoolLiquidityRedemption` in `contexts/liquidity.rs` | `PoolRedemptionRequest`, `PoolControlAuthority` | marks an explicit failed request state and returns the escrowed shares |
| `fulfill_pool_liquidity_redemption_sol` | `src/surface/pools.rs` | `FulfillPoolLiquidityRedemptionSol` in `contexts/liquidity.rs` | `PoolRedemptionRequest`, `PoolTreasuryReserve`, `PoolShareMint` | burns queued shares and pays SOL only from genuinely free capital |
| `fulfill_pool_liquidity_redemption_spl` | `src/surface/pools.rs` | `FulfillPoolLiquidityRedemptionSpl` in `contexts/liquidity.rs` | `PoolRedemptionRequest`, `PoolAssetVault`, `PoolTreasuryReserve`, `PoolShareMint` | burns queued shares and pays SPL only from genuinely free capital |

## Reward lifecycle

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `submit_outcome_attestation_vote` | `src/surface/rewards.rs` | `SubmitOutcomeAttestationVote` in `contexts/rewards.rs` | `AttestationVote`, `CycleOutcomeAggregate`, `PoolTreasuryReserve` | `shared/oracle.rs` and `shared/rules.rs` validation plus evidence, AI, execution, and external-attestation commitments |
| `finalize_cycle_outcome` | `src/surface/rewards.rs` | `FinalizeCycleOutcome` in `contexts/rewards.rs` | `CycleOutcomeAggregate`, `PoolTreasuryReserve` | quorum finalization, reward-liability booking, and challenge-window initialization |
| `open_cycle_outcome_dispute` | `src/surface/rewards.rs` | `OpenCycleOutcomeDispute` in `contexts/rewards.rs` | `CycleOutcomeAggregate` | challenge-window-aware dispute opening by pool/governance/emergency authority |
| `resolve_cycle_outcome_dispute` | `src/surface/rewards.rs` | `ResolveCycleOutcomeDispute` in `contexts/rewards.rs` | `CycleOutcomeAggregate`, `PoolTreasuryReserve` | governance-only sustain/overturn flow that can release reserved reward liability |
| `finalize_cohort_settlement_root` | `src/surface/cycles/settlement.rs` | `FinalizeCohortSettlementRoot` in `contexts/cycles.rs` | `CohortSettlementRoot`, `MemberCycle` | health-alpha cohort settlement |
| `submit_reward_claim` | `src/surface/rewards.rs` | `SubmitRewardClaim` in `contexts/rewards.rs` | `RewardClaim`, `CycleOutcomeAggregate`, `MemberCycle` | reward payout release with claimable review-state and optional compliance checks |

## Policy series and position lifecycle

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `upsert_policy_series_payment_option` | `src/surface/coverage.rs` | `UpsertPolicySeriesPaymentOption` in `contexts/coverage.rs` | `PolicySeriesPaymentOption` | SOL or SPL payment rails bound to a concrete series |
| `subscribe_policy_series` | `src/surface/coverage.rs` | `SubscribePolicySeries` in `contexts/coverage.rs` | `PolicyPosition`, `PolicyPositionNft`, `PremiumLedger` | member self-service position creation under one series |
| `issue_policy_position` | `src/surface/coverage.rs` | `IssuePolicyPosition` in `contexts/coverage.rs` | `PolicyPosition`, `PolicyPositionNft`, `PremiumLedger` | authority-issued position using the series terms |
| `mint_policy_nft` | `src/surface/coverage.rs` | `MintPolicyNft` in `contexts/coverage.rs` | `PolicyPositionNft` | policy NFT minting |
| `pay_premium_spl` | `src/surface/coverage.rs` | `PayPremiumSpl` in `contexts/coverage.rs` | `PolicyPosition`, `PremiumLedger`, `PoolAssetVault` | `shared/premium.rs` ledger writes |
| `pay_premium_sol` | `src/surface/coverage.rs` | `PayPremiumSol` in `contexts/coverage.rs` | `PolicyPosition`, `PremiumLedger` | SOL premium payment path |

## Quoted cycle activation and settlement

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `activate_cycle_with_quote_sol` | `src/surface/cycles/activation.rs` | `ActivateCycleWithQuoteSol` in `contexts/cycles.rs` | `MembershipRecord`, `PolicyPosition`, `PremiumLedger`, `MemberCycle`, fee vault PDAs | `shared/quotes.rs`, `shared/guards.rs`, `shared/treasury.rs` |
| `activate_cycle_with_quote_spl` | `src/surface/cycles/activation.rs` | `ActivateCycleWithQuoteSpl` in `contexts/cycles.rs` | `MembershipRecord`, `PolicyPosition`, `PremiumLedger`, `MemberCycle`, fee vault PDAs | `shared/quotes.rs`, `shared/guards.rs`, `shared/treasury.rs` |
| `settle_cycle_commitment` | `src/surface/cycles/settlement.rs` | `SettleCycleCommitment` in `contexts/cycles.rs` | `MemberCycle`, `PolicyPosition`, `PoolTreasuryReserve` | settlement for SPL-backed cycles |
| `settle_cycle_commitment_sol` | `src/surface/cycles/settlement.rs` | `SettleCycleCommitmentSol` in `contexts/cycles.rs` | `MemberCycle`, `PolicyPosition`, `PoolTreasuryReserve` | settlement for SOL-backed cycles |

## Treasury, premiums, and claims

| Entrypoint | Handler | Context | Primary state | Helpers / notes |
| --- | --- | --- | --- | --- |
| `withdraw_pool_treasury_spl` | `src/surface/treasury.rs` | `WithdrawPoolTreasurySpl` in `contexts/treasury.rs` | `PoolAssetVault`, `PoolTreasuryReserve` | `shared/treasury.rs` reserve accounting |
| `withdraw_pool_treasury_sol` | `src/surface/treasury.rs` | `WithdrawPoolTreasurySol` in `contexts/treasury.rs` | `Pool`, `PoolTreasuryReserve` | lamport treasury withdrawal |
| `withdraw_protocol_fee_spl` | `src/surface/treasury.rs` | `WithdrawProtocolFeeSpl` in `contexts/treasury.rs` | `ProtocolFeeVault` | protocol fee sweep |
| `withdraw_protocol_fee_sol` | `src/surface/treasury.rs` | `WithdrawProtocolFeeSol` in `contexts/treasury.rs` | `ProtocolFeeVault` | SOL fee sweep |
| `withdraw_pool_oracle_fee_spl` | `src/surface/treasury.rs` | `WithdrawPoolOracleFeeSpl` in `contexts/treasury.rs` | `PoolOracleFeeVault` | oracle fee sweep |
| `withdraw_pool_oracle_fee_sol` | `src/surface/treasury.rs` | `WithdrawPoolOracleFeeSol` in `contexts/treasury.rs` | `PoolOracleFeeVault` | SOL oracle fee sweep |
| `attest_premium_paid_offchain` | `src/surface/treasury.rs` | `AttestPremiumPaidOffchain` in `contexts/coverage.rs` | `PolicyPosition`, `PremiumLedger`, `PremiumReplay` | off-chain payment attestation |
| `submit_coverage_claim` | `src/surface/treasury.rs` | `SubmitCoverageClaim` in `contexts/coverage.rs` | `CoverageClaim`, `PolicyPosition`, `PoolRiskConfig` | initializes the case-style coverage claim record, enforces claim-intake mode, and can apply compliance gating |
| `review_coverage_claim` | `src/surface/treasury.rs` | `ReviewCoverageClaim` in `contexts/coverage.rs` | `CoverageClaim` | attaches evidence, interop references, coding-family context, and appeal-aware review state |
| `attach_coverage_claim_decision_support` | `src/surface/treasury.rs` | `AttachCoverageClaimDecisionSupport` in `contexts/coverage.rs` | `CoverageClaim`, `PoolAutomationPolicy` | records AI decision, policy, execution, and attestation commitments under bounded-autonomy policy |
| `approve_coverage_claim` | `src/surface/treasury.rs` | `ApproveCoverageClaim` in `contexts/coverage.rs` | `CoverageClaim`, `PoolTreasuryReserve`, `PoolAssetVault` | books case-linked liability against free capital before approval |
| `deny_coverage_claim` | `src/surface/treasury.rs` | `DenyCoverageClaim` in `contexts/coverage.rs` | `CoverageClaim`, `PoolTreasuryReserve` | releases remaining reserved liability and records adjudication commitments |
| `pay_coverage_claim` | `src/surface/treasury.rs` | `PayCoverageClaim` in `contexts/coverage.rs` | `CoverageClaim`, `PoolAssetVault`, `PoolTreasuryReserve` | supports partial or full payout against pre-booked claim reserves |
| `claim_approved_coverage_payout` | `src/surface/treasury.rs` | `ClaimApprovedCoveragePayout` in `contexts/coverage.rs` | `CoverageClaim`, `PoolAssetVault`, `PoolTreasuryReserve` | claimant or delegate pull-based payout path for already approved claim liability |
| `close_coverage_claim` | `src/surface/treasury.rs` | `CloseCoverageClaim` in `contexts/coverage.rs` | `CoverageClaim`, `PoolTreasuryReserve` | finalizes denied or paid cases and records recovery history where present |
| `settle_coverage_claim` | `src/surface/treasury.rs` | `SettleCoverageClaim` in `contexts/coverage.rs` | `CoverageClaim`, `PoolAssetVault`, `PoolTreasuryReserve` | reserve-aware claim payout that books and releases coverage-case liability |

## Review shortcuts

For the most important public flows, start here:

- `create_pool` -> `src/surface/pools.rs` + `contexts/pools.rs`
- `activate_cycle_with_quote_sol` / `activate_cycle_with_quote_spl` -> `src/surface/cycles/activation.rs` + `contexts/cycles.rs`
- `settle_cycle_commitment` / `settle_cycle_commitment_sol` -> `src/surface/cycles/settlement.rs` + `contexts/cycles.rs`
- `submit_coverage_claim` / `review_coverage_claim` / `approve_coverage_claim` / `claim_approved_coverage_payout` / `settle_coverage_claim` -> `src/surface/treasury.rs` + `contexts/coverage.rs`
