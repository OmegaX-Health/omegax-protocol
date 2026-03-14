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
- `devnet_beta_observability.ts` collects structured devnet observability output
- `deploy_devnet_beta.ts` and `deploy_devnet_mvp.ts` handle devnet deployment flows
- `governance_schema_state_update.ts` updates governance-controlled schema state, including legacy schema-dependency backfills before close proposals
- `upload_schema_to_ipfs.ts` publishes schema content to IPFS

## Usage guidance

- Prefer package scripts from the repository root when they exist.
- Use `npm run verify:public` for the public release gate.
- Use `npm run test:e2e:localnet` as an additional release-candidate sign-off step when the public protocol surface changes.
- Treat deployment and bootstrap helpers as operator tooling, not general contributor entry points.
- Review required environment variables before running any script that changes on-chain state.
