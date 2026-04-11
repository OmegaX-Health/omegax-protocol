# E2E Matrix

This directory contains the heavier localnet audit entrypoint for `omegax-protocol`.

## Purpose

- boot a fresh validator against the checked program build
- run a deterministic audit of the canonical health-capital-markets fixture state and scenario manifest
- verify the cross-scenario bootstrap-to-self-serve journey that ties governance bootstrap, launch, oracle setup, member actions, claims, and capital together
- capture release-candidate evidence beyond the faster repo-level CI gate

## Main entrypoints

- `localnet_protocol_surface.test.ts` defines the deterministic localnet audit
- `../scripts/run_localnet_e2e.mjs` manages validator lifecycle, logs, and summary output

## Run it

From the repository root:

```bash
npm run test:e2e:localnet
```

The runner performs a checked build, boots a fresh `solana-test-validator`, executes the audit, and writes a timestamped JSON summary under `artifacts/`.

Useful environment variables:

- `OMEGAX_E2E_SKIP_BUILD=1` reuses the current checked build
- `OMEGAX_E2E_KEEP_ARTIFACTS=1` preserves validator logs and the JSON summary
- `OMEGAX_E2E_SCENARIO=<name>` reruns a single canonical scenario family against a fresh validator
  - `bootstrap_to_self_serve_plan_journey` is the focused end-to-end persona audit

## When to use it

- before public release candidates or tags
- when protocol-surface ownership or scenario mapping changed
- when you need stronger evidence than the faster `npm run verify:public` gate

See [../docs/testing/protocol-surface-audit.md](../docs/testing/protocol-surface-audit.md) for the latest recorded audit and artifact notes.
