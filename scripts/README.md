# Scripts

This directory contains the repository's command-line helpers.

## Categories

### Verification

- `check_public_repo_hygiene.mjs` blocks tracked secrets, local artifacts, and private references
- `check_semantic_readiness.mjs` blocks retired pool-era language from active protocol, audit, script, and documentation surfaces
- `check_dependency_licenses.mjs` audits npm and Cargo dependency licenses
- `check_protocol_contract.mjs` verifies that generated protocol artifacts are in sync
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
- `bootstrap_devnet_frontend_parity.ts` syncs canonical fixture env values and writes `frontend/public/devnet-fixtures.json`
- `devnet_beta_observability.ts` collects structured devnet observability output
- `devnet_frontend_role_smoke.ts` validates the canonical fixture matrix in smoke or strict mode
- `devnet_governance_smoke.ts` runs the shared-devnet native governance smoke in `create-vote` and `execute` phases
- `devnet_governance_ui_readonly.ts` boots the local frontend and verifies readonly governance routes against devnet data
- `deploy_devnet_beta.ts` runs the checked build, artifact parity, and canonical manifest/bootstrap preparation for the hard-break migration
- `governance_schema_state_update.ts` updates governance-controlled schema state, including historical schema-dependency backfills when older accounts must be retired safely
- `upload_schema_to_ipfs.ts` publishes schema content to IPFS

## Usage guidance

- Prefer package scripts from the repository root when they exist.
- Use `npm run verify:public` for the public release gate.
- Use `npm run test:e2e:localnet` as an additional release-candidate sign-off step when the public protocol surface changes.
- Use `npm run semantic:readiness:check` when you want the canonical-surface wording guard on its own.
- Treat deployment and bootstrap helpers as operator tooling, not general contributor entry points.
- Review required environment variables before running any script that changes on-chain state.
- The hard-break devnet migration now centers on the manifest emitted by `npm run protocol:bootstrap`.
- The governance smoke uses the existing `GOVERNANCE_SECRET_KEY_BASE58` signer, requires pre-existing DAO tokens, and only SOL-airdrops fee balance when the signer drops below the configured threshold.
- The readonly governance UI smoke requires Playwright Chromium locally: `npx playwright install chromium`.
