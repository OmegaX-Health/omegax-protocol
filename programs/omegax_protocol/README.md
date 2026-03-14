# `omegax_protocol`

This crate contains the on-chain OmegaX Protocol program.

## Key files

- `src/lib.rs` contains the main Anchor entrypoints and delegates into the v2 domain modules
- `src/core_accounts.rs` contains root account types and the legacy oracle/pool approval contexts shared by the v2 surface
- `src/v2.rs` is the top-level module for the v2 protocol surface
- `src/v2/` contains the v2 implementation split by concern:
  - `admin.rs` for governance and oracle-admin handlers
  - `pools.rs` for pool, enrollment, and liquidity handlers
  - `rewards.rs` for attestation and reward-claim handlers
  - `coverage.rs` for coverage-product and policy handlers
  - `cycles.rs` as the module index for cycle activation and settlement handlers
  - `treasury.rs` for treasury, fee, premium, and payout flows
  - `contexts.rs` as the module index for Anchor account contexts
  - `contexts/` for context definitions grouped by protocol area
  - `cycles/` for cycle activation vs settlement flows
  - `state.rs` and `errors.rs` for core v2 account/state types
  - `shared.rs` as the module index for internal helper logic
  - `shared/` for helper logic grouped by guards, coverage, liquidity, treasury, and membership concerns
- `Cargo.toml` defines crate metadata and dependencies

## Orientation docs

- [`../../docs/architecture/solana-program-architecture.md`](../../docs/architecture/solana-program-architecture.md) explains the module boundaries and review order
- [`../../docs/architecture/solana-instruction-map.md`](../../docs/architecture/solana-instruction-map.md) maps entrypoints to handlers, contexts, and helper modules
- [`../../docs/reviews/solana-public-readiness-review.md`](../../docs/reviews/solana-public-readiness-review.md) records the current organization audit and cleanup backlog

## Common commands

From the repository root:

```bash
npm run rust:fmt:check
npm run rust:test
npm run rust:lint
npm run anchor:build
npm run anchor:test
```

For artifact sync:

```bash
npm run anchor:idl
npm run protocol:contract
```
