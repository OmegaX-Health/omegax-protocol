# Public Release Gate

Use this checklist before merging or publishing protocol-facing changes from the public repository.

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

Treat that command as an additional maintainer sign-off step, not as a per-PR or public-CI requirement. Review the latest summary and exception policy in [`../testing/protocol-surface-audit.md`](../testing/protocol-surface-audit.md).

## Protocol-surface changes

If you changed instructions, account layouts, PDA seeds, required account metas, or generated protocol artifacts:

- run `npm run anchor:idl`
- run `npm run protocol:contract`
- rerun `npm run verify:public`
- update the Solana architecture and instruction map docs
- note any downstream follow-up in the PR when relevant

## Reviewer usability gate

From the checked-in docs alone, a reviewer should be able to find:

- where `create_pool_v2` is routed and which accounts it creates
- where cycle activation verifies quotes and moves funds
- where cycle settlement finalizes outcomes and treasury effects
- where coverage claims are submitted and settled

If that path is hard to follow, update docs or module comments as part of the same change.

For this repository, public readiness ends at `npm run verify:public`.
