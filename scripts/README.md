# Scripts

This directory contains the repository's command-line helpers.

## Categories

### Verification

- `check_public_repo_hygiene.mjs` blocks tracked secrets, local artifacts, and private references
- `check_dependency_licenses.mjs` audits npm and Cargo dependency licenses
- `check_protocol_contract.mjs` verifies that generated protocol artifacts are in sync
- `check_beta_consistency.mjs` and `check_mvp_consistency.mjs` validate protocol consistency assumptions
- `doctor.mjs` runs local environment sanity checks

### Localnet E2E

- `run_localnet_e2e.mjs` boots a fresh local validator, runs the sequential protocol-surface matrix, and writes a timestamped JSON summary under `artifacts/`

### Generation

- `generate_protocol_contract.ts` regenerates checked-in shared artifacts
- `generate_schema_metadata_hash.ts` and `generate_outcome_rule_hashes.ts` regenerate deterministic schema-related outputs
- `generate_standard_health_outcomes_schema.ts` rebuilds the standard schema definition

### Program build helpers

- `anchor_build_with_stack_gate.mjs` wraps program builds with stack-usage checks
- `anchor_test_with_stack_gate.mjs` does the same for Anchor tests

### Devnet and operator workflows

- `bootstrap_governance_realms.ts` provisions governance state
- `bootstrap_protocol.ts` provisions protocol state
- `bootstrap_devnet_frontend_parity.ts` seeds a dedicated devnet parity pool, writes frontend fixture env, and can read ignored local override env files or a `DEVNET_FRONTEND_BOOTSTRAP_ENV_FILE`
- `devnet_beta_observability.ts` collects structured devnet observability output
- `devnet_frontend_role_smoke.ts` runs the frontend smoke and strict sign-off flows against the configured devnet fixture matrix
- `devnet_governance_smoke.ts` runs the shared-devnet native governance smoke in `create-vote` and `execute` phases
- `devnet_governance_ui_readonly.ts` boots the local frontend and verifies readonly governance routes against devnet data
- `deploy_devnet_beta.ts` and `deploy_devnet_mvp.ts` handle devnet deployment flows; the beta deploy upgrades the canonical configured program id explicitly instead of trusting the local `target/deploy/*-keypair.json` address
- `governance_schema_state_update.ts` updates governance-controlled schema state, including legacy schema-dependency backfills before close proposals
- `upload_schema_to_ipfs.ts` publishes schema content to IPFS

## Usage guidance

- Prefer package scripts from the repository root when they exist.
- Use `npm run verify:public` for the public release gate.
- Use `npm run test:e2e:localnet` as an additional release-candidate sign-off step when the public protocol surface changes.
- Treat deployment and bootstrap helpers as operator tooling, not general contributor entry points.
- Review required environment variables before running any script that changes on-chain state.
- For public release rehearsal, use a fresh non-canonical devnet program id and fresh wallets first; reserve the canonical shared-devnet upgrade for the final sign-off pass.
- The governance smoke uses the existing `GOVERNANCE_SECRET_KEY_BASE58` signer, requires pre-existing DAO tokens, and only SOL-airdrops fee balance when the signer drops below the configured threshold.
- The readonly governance UI smoke requires Playwright Chromium locally: `npx playwright install chromium`.
