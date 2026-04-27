# Tests

This directory contains the fast Node-based verification suite for the canonical OmegaX health-capital-markets redesign.

## Fast suite coverage areas

- canonical contract surface integrity
- deterministic PDA derivation for stable devnet fixture IDs
- reserve-kernel arithmetic and read-model behavior
- scenario coverage for sponsor budgets, mixed reward/protection plans, LP allocation attribution, restricted classes, separate reserve domains, impairment pressure, scoped pauses, and migration smoke
- frontend bootstrap regressions for mounted wizard and workbench state resolution
- pen-test PoCs in [`security/`](security/) backing [`docs/security/pre-mainnet-pen-test-2026-04-27.md`](../docs/security/pre-mainnet-pen-test-2026-04-27.md)

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

Use that heavier matrix as release-candidate sign-off for protocol-surface changes. It is intentionally outside fast public CI.
