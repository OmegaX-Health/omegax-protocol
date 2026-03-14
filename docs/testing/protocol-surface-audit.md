<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Protocol Surface Audit

Audit date: 2026-03-14

## Scope

- Public instruction surface: `85` entrypoints from `programs/omegax_protocol/src/lib.rs`
- Surface definitions cross-checked against:
  - `docs/architecture/solana-instruction-map.md`
  - `shared/protocol_contract.json`
  - `idl/omegax_protocol.json`
- Heavy localnet harness:
  - `scripts/run_localnet_e2e.mjs`
  - `e2e/localnet_protocol_surface.test.ts`
  - `e2e/support/surface_manifest.ts`

## Commands Executed

- `npm run anchor:build:checked`
- `cp target/idl/omegax_protocol.json idl/omegax_protocol.json`
- `npm run protocol:contract`
- `npm run protocol:contract:check`
- `npm run test:node`
- `OMEGAX_E2E_SCENARIO=legacy-registry-compatibility npm run test:e2e:localnet`
- `OMEGAX_E2E_SCENARIO=reward-attestation-dispute-lifecycle npm run test:e2e:localnet`
- `OMEGAX_E2E_KEEP_ARTIFACTS=1 OMEGAX_E2E_SKIP_BUILD=1 npm run test:e2e:localnet`

## Verified Result

- The full localnet protocol-surface matrix passed on March 14, 2026.
- The latest summary artifact is `artifacts/localnet-e2e-summary-2026-03-14T07-33-23-745Z.json`.
- The harness executed `9` fixed-order scenario suites against a fresh local validator.
- Instruction coverage summary from that artifact:
  - `expectedTotal=85`
  - `covered=85`
  - `missing=0`
  - `instruction exceptions=0`
- `backfill_schema_dependency_ledger` is now part of the public surface and is exercised against a genuinely legacy schema account that is preloaded into the local validator without a dependency ledger.
- `close_outcome_schema` is now executable on localnet for both:
  - modern post-upgrade schemas after active rules are disabled
  - preloaded legacy schemas after governance backfills the dependency ledger
- Error coverage summary from that artifact:
  - expected custom error cases: `10`
  - observed custom error cases: `10`
  - missing expected custom error cases: `0`
  - explicit error exceptions: `158`
- The suite enforces completeness rules:
  - a new public instruction fails the run unless it is assigned to a scenario or exception-listed with a reason
  - a new surfaced custom error fails the run unless it is observed or exception-listed with a reason
  - any expected-success instruction that never confirms fails the run
  - any expected-failure case that returns the wrong custom error fails the run

## Harness Behavior

- `npm run test:e2e:localnet` runs `anchor:build:checked` unless `OMEGAX_E2E_SKIP_BUILD=1`.
- It boots a fresh `solana-test-validator` on dynamic ports, preloading `target/deploy/omegax_protocol.so` at the local program id.
- It also preloads one legacy `OutcomeSchemaRegistryEntry` account without a `SchemaDependencyLedger` so the migration path is proven during the matrix run.
- It exports validator RPC and program-id environment variables to the test process.
- It runs one sequential Node test file with `node --import tsx --test --test-concurrency=1`.
- It writes a timestamped JSON summary under `artifacts/`.
- With `OMEGAX_E2E_KEEP_ARTIFACTS=1`, it preserves both the runner log and the validator ledger log under `artifacts/localnet-e2e-*/`.
- Without `OMEGAX_E2E_KEEP_ARTIFACTS=1`, it removes the temporary ledger and validator logs after the run.

## Scenario Matrix

- `protocol-governance-oracle-lifecycle`
- `legacy-registry-compatibility`
- `pool-schema-member-lifecycle`
- `direct-liquidity-lifecycle`
- `queued-liquidity-lifecycle`
- `reward-attestation-dispute-lifecycle`
- `coverage-product-policy-premium-lifecycle`
- `quoted-cycle-activation-settlement-cohort-lifecycle`
- `treasury-withdrawal-and-coverage-claim-lifecycle`

Each scenario uses fresh pools, mints, and signers so mutually exclusive or terminal flows do not poison later coverage.

## Key Fixes Landed

- Added the dedicated localnet runner at `scripts/run_localnet_e2e.mjs`.
- Added the sequential master suite at `e2e/localnet_protocol_surface.test.ts` with support modules under `e2e/support/`.
- Added surface-manifest enforcement so instruction coverage and error coverage are checked against tracked expectations.
- Tightened the harness so manifest-declared negative cases must actually be observed; the suite now fails if an expected custom-error fixture never runs.
- Implemented schema dependency tracking so `close_outcome_schema` can succeed safely when no enabled rule still references the schema.
- Added `backfill_schema_dependency_ledger` as the explicit governance migration path for legacy schemas that predate schema dependency tracking.
- Added transaction-log and event decoding, account snapshot assertions, quote-signature composition, and validator-summary export to the harness.
- Updated governance operator tooling so `governance_schema_state_update.ts` can backfill legacy schema dependency ledgers and refuses close proposals when enabled rules still reference the target schema.
- Fixed stale builder/account-surface bugs that blocked localnet execution, including:
  - missing optional-account placeholders in shared builders
  - reward-claim sentinel account alignment for `member_cycle`
  - cohort settlement-root bump handling in the on-chain settlement flow
  - schema close being permanently hard-disabled despite being exposed as a public instruction

## Runtime Expectations

- Full localnet runtime is materially heavier than `test:node`; the passing run on March 14, 2026 completed in about three minutes.
- The heavy matrix remains separate from `test:node`, `anchor:test`, and public CI so the fast verification path stays stable.
- `OMEGAX_E2E_SCENARIO=<name>` reruns one scenario family against a fresh validator for targeted debugging.

## Exception Policy

- Instruction exceptions live in `e2e/support/surface_manifest.ts` and must include a concrete reason.
- Error exceptions also live in `e2e/support/surface_manifest.ts` and must include a concrete reason.
- Exception-listing is allowed only for intentionally unreachable, intentionally disabled, or not-yet-modeled surfaces. It is not allowed as a silent bypass for missing test ownership.

## Remaining Honest Limitations

- The matrix now proves the full public instruction surface on localnet, but it does not claim that every custom error is currently observed in a concrete fixture; most error names are still exception-listed rather than actively exercised.
- Legacy schema migration still depends on governance supplying the complete set of enabled historical `PoolOutcomeRule` accounts to `backfill_schema_dependency_ledger`; the governance helper discovers those accounts off-chain, but the on-chain program cannot independently prove that an operator omitted none.
- Devnet observability remains a smoke/inspection surface, not the source of completeness proof.
- Quoted cycle activation still depends on caller-supplied detached quote-signature material; the harness builds and verifies those signatures for localnet tests, while the shared builders only compose the transaction shape.
