# Public Release Gate

Use this checklist before merging or publishing protocol-facing changes from the public repository.

Current target release: `0.3.0`

## Baseline commands

Run from the repository root:

```bash
npm run verify:public
```

This is the baseline repo-only release gate for `omegax-protocol`. It is expected to pass from a fresh clone without any sibling repositories present.

This gate covers:

- Rust formatting
- Solana program unit tests
- Anchor-compatible Rust linting
- generated protocol contract parity
- Node-based protocol and frontend API tests
- frontend production build
- canonical-surface semantic readiness
- tracked-file hygiene
- dependency license policy

Note: `npm run protocol:contract:check` currently normalizes the generated protocol artifacts before it verifies parity. Run it as a deliberate validation step, not as a background watcher.

For full local parity with CI on dependency licensing, install `cargo-license` once:

```bash
cargo install cargo-license --locked
```

## Additional release-candidate sign-off

The fast public gate intentionally does **not** include the heavier localnet protocol-surface matrix.

For public release candidates, public tags, or other protocol-surface publication points, also run:

```bash
npm run test:e2e:localnet
```

Treat that command as an additional maintainer sign-off step, not as a per-PR or public-CI requirement. Review the latest scenario-ownership policy in [`../testing/protocol-surface-audit.md`](../testing/protocol-surface-audit.md).

## Devnet rollout sign-off

For `0.3.0`, repo readiness ends at the public gate plus localnet sign-off. This is the first publishable canonical health-capital-markets release and a hard-break devnet migration from the retired pool-first surface.

Release notes to verify in the checked-in docs:

- reserve domains and domain asset vaults are the hard settlement and custody boundary
- health plans and policy series replace the overloaded pool/program root
- funding lines separate sponsor budgets, premiums, LP allocations, backstops, and subsidies
- obligations and claim cases reconcile reward and protection flows through one reserve kernel
- liquidity pools, capital classes, and allocation positions carry LP-facing rights and attribution

Operational rollout still requires a two-step devnet sequence:

1. rehearse the current checked build on devnet with a non-canonical program id and fresh rehearsal wallets
2. upgrade the canonical shared devnet only after the rehearsal matrix is clean

For each devnet stage, rerun:

- `npm run anchor:test`
- `npm run beta:consistency:check`
- `npm run protocol:contract:check`
- `npm run frontend:build`
- `npm run devnet:frontend:bootstrap`
- `npm run devnet:frontend:signoff`
- `npm run devnet:governance:smoke:create-vote`
- `npm run devnet:governance:smoke:execute` after the required voting and hold-up windows
- `npm run devnet:governance:ui:readonly`
- `npm run devnet:beta:observe`

## Protocol-surface changes

If you changed instructions, account layouts, PDA seeds, required account metas, or generated protocol artifacts:

- run `npm run anchor:idl`
- run `npm run protocol:contract`
- rerun `npm run verify:public`
- update the Solana architecture and instruction map docs
- note any downstream follow-up in the PR when relevant

## Reviewer usability gate

From the checked-in docs alone, a reviewer should be able to find:

- where reserve domains and domain asset vaults are created
- where health plans and policy series are created or versioned
- where funding lines are opened, funded, and reserved against obligations
- where claim cases are opened, adjudicated, and settled
- where liquidity pools, capital classes, allocations, and redemption queues are handled

If that path is hard to follow, update docs or module comments as part of the same change.

For this repository, public readiness ends at `npm run verify:public`.
