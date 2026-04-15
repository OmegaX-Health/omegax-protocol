# Release `v0.3.0`

`v0.3.0` is the first publishable canonical OmegaX health-capital-markets release.

## Release meaning

This release retires the earlier pool-first devnet surface and publishes one coherent model for sponsor programs, liabilities, claims, reserve accounting, and LP-facing capital.

It is intentionally a hard-break devnet migration rather than a compatibility release.

## Canonical nouns

- `ReserveDomain`: hard settlement, custody, and legal segregation boundary
- `DomainAssetVault`: custody per `[reserve_domain, asset_mint]`
- `HealthPlan`: sponsor/member/liability root
- `PolicySeries`: versioned product lane
- `FundingLine`: plan-side funding source
- `ClaimCase`: explicit claim lifecycle for reviewed flows
- `Obligation`: canonical liability unit
- `LiquidityPool`: LP-facing capital sleeve
- `CapitalClass`: investor instrument inside a pool
- `AllocationPosition`: capital-to-plan bridge

## Economic release notes

- sponsor budgets are explicit funding lines and do not mint LP exposure
- premiums, reserve booking, claims, and payouts reconcile through one reserve kernel
- shared capital inside a reserve domain is allowed only with explicit ledger attribution
- yield and impairment attribution live at the pool, class, and allocation level
- wrapper-mediated or regulated participation layers through reserve domains and capital classes instead of a forked protocol

## On-chain release notes

- the canonical public program now includes first-class oracle registry state: `OracleProfile`, `PoolOracleApproval`, `PoolOraclePolicy`, and `PoolOraclePermissionSet`
- the canonical public program now includes first-class schema registry state: `OutcomeSchema` and `SchemaDependencyLedger`
- the canonical public program now includes `attest_claim_case`, which anchors schema-bound oracle attestations directly against live `ClaimCase` state
- checked-in generated artifacts in `idl/`, `shared/`, `frontend/lib/generated/`, and `android-native/protocol/` are aligned with the current public program surface

## Console release notes

- the public console now mounts canonical routes for `/plans`, `/capital`, `/claims`, `/members`, `/governance`, `/oracles`, and `/schemas`
- mounted workbenches read live protocol snapshot data rather than depending on fixture-only preview state
- `/plans/new` now sources reserve domains, domain asset vault rails, claimed oracle profiles, and registry schemas from the live canonical snapshot
- `/governance` now includes mounted bootstrap actions for `initialize_protocol_governance`, `create_reserve_domain`, and `create_domain_asset_vault`
- `/members` now mounts self-serve `open_member_position` enrollment ahead of the existing operator/member register
- `/claims` now mounts self-serve `open_claim_case` intake ahead of the operator liability register
- mounted plan and capital workbenches now include sponsor-side `create_policy_series` and `open_funding_line`, `update_lp_position_credentialing`, and `mark_impairment`
- `/oracles` now renders live registry, claim/profile readiness, pool approval, permission, and policy binding posture in one mounted route
- the oracles workbench now renders live on-chain claim-case attestations instead of synthetic placeholder rows
- oracle profile authoring now runs through dedicated `/oracles/register` and `/oracles/[oracleAddress]/update` wizard flows, while `/oracles` stays focused on registry and readiness operations
- `/schemas` now renders the live versioned schema registry, dependency posture, and shared binding context for policy series
- the launch flow continues to create plans, policy series, and funding lines through the canonical launch wizard instead of the retired pool-first workspace

## Frontend release notes

- the protocol console governance workspace now uses the plans-language redesign, including a telemetry-first KPI strip, asymmetric overview layout, and refreshed notice states
- the oracles workspace now matches the same plans and overview visual system so governance and oracle operations read as one shared control surface
- the oracle register/update flows now share the same full-page wizard grammar as `/plans/new`, including guarded bootstrap handling when live schema reads degrade
- the hosted frontend keeps the canonical `v0.3.0` surface while improving workbench readability, queue visibility, and operator-facing chrome for the public deployment
- publish the matching docs update alongside the frontend deployment so [docs.omegax.health](https://docs.omegax.health/docs) reflects the current console experience

## Operations release notes

- shared-devnet bootstrap now includes `npm run protocol:bootstrap:devnet-live` to seed the canonical plan/capital/oracle/schema graph
- frontend parity sign-off now runs through `npm run devnet:frontend:bootstrap` and `npm run devnet:frontend:signoff`
- governance rollout sign-off now records a created proposal, a post-execution readonly governance check, and structured observability output

## Known follow-up work

`v0.3.0` now has the canonical read surface and the core self-serve and operator write paths mounted in the canonical workbench shells.

The most important follow-ups after this release candidate are:

- deepen inline detail/history views for member participation, claims, and obligations without reviving retired legacy route patterns
- expand mounted schema-maintenance and governance-template authoring flows beyond the current registry and proposal coverage
- continue localnet and devnet persona sign-off for broader sponsor, oracle, reviewer, and LP operational sequences

This patch updates the mounted console behavior and verification coverage without introducing a public contract-surface delta unless regenerated artifacts in this release package say otherwise.

## Reviewer checklist

Before treating `v0.3.0` as publish-ready, confirm:

- `npm run anchor:idl`
- `npm run protocol:contract`
- `npm run verify:public`
- `npm run test:e2e:localnet`
- `npm run devnet:beta:deploy`
- `npm run protocol:bootstrap:devnet-live`
- `npm run devnet:frontend:bootstrap`
- `npm run devnet:frontend:signoff`
- `npm run devnet:governance:smoke:create-vote`
- `npm run devnet:governance:smoke:execute` after the required voting and hold-up windows expire
- `npm run devnet:governance:ui:readonly`
- `npm run devnet:beta:observe`

Then confirm that the SDK and [docs.omegax.health](https://docs.omegax.health/docs) describe the same canonical surface before tagging or public announcement.
