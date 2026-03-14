# E2E Matrix

This directory contains the heavier localnet end-to-end protocol-surface matrix for `omegax-protocol`.

## Purpose

- prove the checked public instruction surface against a fresh local validator
- validate instruction-to-scenario coverage through `support/surface_manifest.ts`
- capture release-candidate evidence beyond the faster repo-level CI gate

## Main entrypoints

- `localnet_protocol_surface.test.ts` defines the sequential localnet matrix
- `support/harness.ts` manages the validator lifecycle, logs, and summary output
- `support/surface_manifest.ts` maps public instructions and documented exceptions to scenarios
- `support/events.ts` and `support/surface.ts` provide shared assertions and protocol-surface helpers

## Run it

From the repository root:

```bash
npm run test:e2e:localnet
```

The runner performs a checked build, boots a fresh `solana-test-validator`, executes the matrix, and writes a timestamped JSON summary under `artifacts/`.

Useful environment variables:

- `OMEGAX_E2E_SKIP_BUILD=1` reuses the current checked build
- `OMEGAX_E2E_KEEP_ARTIFACTS=1` preserves validator logs and the JSON summary
- `OMEGAX_E2E_SCENARIO=<name>` reruns a single scenario family against a fresh validator

## When to use it

- before public release candidates or tags
- when protocol-surface behavior, error coverage, or scenario mapping changed
- when you need stronger evidence than the faster `npm run verify:public` gate

See [../docs/testing/protocol-surface-audit.md](../docs/testing/protocol-surface-audit.md) for the latest recorded audit and artifact notes.
