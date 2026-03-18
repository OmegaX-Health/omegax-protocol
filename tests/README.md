# Tests

This directory contains the fast Node-based test suite for the public protocol repository.

## Fast suite coverage areas

- protocol builders and account readers
- generated contract parity
- discovery and readiness helpers
- schema and pool metadata handling
- frontend deployment wiring and public hosting config

## Run the fast suite

```bash
npm run test:node
```

## Heavy localnet matrix

The repository also ships a separate sequential localnet E2E harness under `../e2e/`.

Run it from the repository root with:

```bash
npm run test:e2e:localnet
```

Use that heavier matrix as release-candidate sign-off for protocol-surface changes. It is intentionally outside fast public CI. For scope, scenario coverage, exception policy, and the latest recorded run, see [`../docs/testing/protocol-surface-audit.md`](../docs/testing/protocol-surface-audit.md).

## Conventions

- keep the fast suite deterministic and self-contained
- prefer fixture-based or mocked protocol state for public CI
- keep the localnet matrix focused on end-to-end protocol surface coverage rather than general unit-level assertions
- update generated artifacts before changing parity assertions
