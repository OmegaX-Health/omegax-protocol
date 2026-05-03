# Scripts

This directory contains the repository's command-line helpers.

## Categories

### Verification

- `check_public_repo_hygiene.mjs` blocks tracked secrets, local artifacts, and private references
- `check_semantic_readiness.mjs` blocks retired pool-era language from active protocol, audit, script, and documentation surfaces
- `check_dependency_licenses.mjs` audits npm and Cargo dependency licenses
- `check_protocol_contract.mjs` verifies that generated protocol artifacts are in sync
- `protocol_workbench_mobile_sidebar_smoke.ts` boots the local frontend and verifies the closed mobile workbench drawer stays out of tab order while the open drawer traps focus and makes the workbench frame inert
- `check_beta_consistency.mjs` and `check_mvp_consistency.mjs` validate protocol consistency assumptions
- `doctor.mjs` runs local environment sanity checks

### Localnet E2E

- `run_localnet_e2e.mjs` boots a fresh local validator and runs the deterministic localnet scenario audit

### Generation

- `generate_protocol_contract.ts` regenerates checked-in shared artifacts
- `generate_schema_metadata_hash.ts` and `generate_outcome_rule_hashes.ts` regenerate deterministic schema-related outputs
- `generate_standard_health_outcomes_schema.ts` rebuilds the standard schema definition

### Program build helpers

- `anchor_build_with_stack_gate.mjs` wraps program builds with stack-usage checks
- `anchor_test_with_stack_gate.mjs` does the same for Anchor tests

### Devnet and operator workflows

- `bootstrap_governance_realms.ts` provisions governance state
- `bootstrap_protocol.ts` writes the canonical hard-break devnet migration manifest and env exports
- `bootstrap_devnet_live_protocol.ts` seeds the canonical shared-devnet plan/capital/oracle/schema graph, then hands protocol governance over to the configured governance PDA when one is present, and syncs the resulting env addresses back into the frontend bootstrap files
- `bootstrap_genesis_live_protocol.ts` seeds the real Genesis Protect Acute launch surface from explicit live inputs instead of the baked devnet fixture matrix
- `bootstrap_devnet_frontend_parity.ts` syncs canonical fixture env values and writes `frontend/public/devnet-fixtures.json`
- `devnet_beta_observability.ts` collects structured devnet observability output
- `devnet_frontend_role_smoke.ts` validates the canonical fixture matrix in smoke or strict mode
- `devnet_governance_smoke.ts` runs the shared-devnet native governance smoke in `create-vote` and `execute` phases
- `devnet_governance_ui_readonly.ts` boots the local frontend and verifies readonly governance routes against devnet data
- `devnet_operator_drawer_sim.ts` simulates the mounted operator drawer transactions against devnet and fails on real builder/wiring mismatches such as membership proof-mode or gate-configuration errors
- `deploy_devnet_beta.ts` runs the checked build, artifact parity, and canonical manifest/bootstrap preparation for the hard-break migration
- `governance_schema_state_update.ts` updates governance-controlled schema state, including historical schema-dependency backfills when older accounts must be retired safely
## Usage guidance

- Prefer package scripts from the repository root when they exist.
- Use `npm run verify:public` for the public release gate.
- Use `npm run frontend:workbench:mobile-sidebar:smoke` for the targeted mobile drawer accessibility smoke.
- Use `npm run devnet:operator:drawer:sim` for the targeted plan/governance operator drawer transaction smoke.
- Use `npm run test:e2e:localnet` as an additional release-candidate sign-off step when the public protocol surface changes.
- Use `npm run semantic:readiness:check` when you want the canonical-surface wording guard on its own.
- Treat deployment and bootstrap helpers as operator tooling, not general contributor entry points.
- Review required environment variables before running any script that changes on-chain state.
- The hard-break devnet migration now centers on the manifest emitted by `npm run protocol:bootstrap`.
- The shared-devnet release sign-off path now typically runs `npm run protocol:bootstrap:devnet-live`, `npm run devnet:frontend:bootstrap`, `npm run devnet:frontend:signoff`, the governance smoke pair, and `npm run devnet:beta:observe` in one tracked rollout window.
- Use [`../docs/operations/genesis-live-bootstrap.md`](../docs/operations/genesis-live-bootstrap.md) for the Genesis mainnet-ready bootstrap path and its required env inputs.
- The governance smoke uses the existing `GOVERNANCE_SECRET_KEY_BASE58` signer or the local Solana keypair fallback, requires pre-existing DAO tokens, only SOL-airdrops fee balance when the signer drops below the configured threshold, and expects the protocol governance authority handoff to match `GOVERNANCE_CONFIG`.
- The readonly governance UI smoke requires Playwright Chromium locally: `npx playwright install chromium`.
