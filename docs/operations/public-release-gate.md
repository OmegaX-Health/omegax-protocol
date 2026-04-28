# Public Release Gate

Use this checklist before merging or publishing protocol-facing changes from the public repository.

Current target release: `0.3.1`

> **Two gates, not one.** `npm run verify:public` is the **repo baseline health** gate — it certifies that a working tree compiles, tests pass, and generated artifacts are in sync. It does **not** certify that a commit is fit for production promotion. Promotion to a public tag, mainnet seeding, or any live-cluster surface requires the **release-candidate evidence** described in [`./release-candidate-evidence-template.md`](./release-candidate-evidence-template.md), which captures CI run IDs, branch-protection state, localnet audit output, operator-drawer simulation, dependency scan, actuarial gate (where applicable), and external-audit / bug-bounty posture for that specific commit. Treat this distinction as load-bearing: a green `verify:public` is necessary but not sufficient for promotion.

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
npm run devnet:operator:drawer:sim
npm run test:e2e:localnet
```

Treat these commands as additional maintainer sign-off steps, not as per-PR or public-CI requirements. The operator drawer smoke is simulate-only and should fail on real builder/wiring mistakes such as membership proof-mode or gate-configuration mismatches. Review the latest scenario-ownership policy in [`../testing/protocol-surface-audit.md`](../testing/protocol-surface-audit.md).

## Main-branch prep

Before merging a release candidate to `main`, confirm:

- `npm run anchor:idl`
- `npm run protocol:contract`
- `npm run verify:public`
- `npm run devnet:operator:drawer:sim`
- `npm run test:e2e:localnet`
- the checked-in docs describe the same public surface as the code and generated artifacts
- [`./release-v0.3.1.md`](./release-v0.3.1.md) reflects the current release notes and known follow-up work

For this release train, reviewers should be able to discover from the checked-in docs that:

- the canonical console mounts `/plans`, `/capital`, `/claims`, `/members`, `/governance`, `/oracles`, and `/schemas`
- the mounted workbenches read live protocol snapshot data rather than fixture-only state
- the oracle and outcome-schema registries are part of the current public protocol surface
- member enrollment and claim intake are operator-mediated in the mounted protocol console rather than standalone self-serve dapp actions
- the shared-devnet sign-off flow includes frontend parity, governance smoke, and observability

## Shared-devnet sign-off

Shared-devnet rollout remains an operator-mediated sign-off step even after the repo-only gate is green.

Recommended sequence:

1. `npm run devnet:beta:deploy`
2. upgrade the canonical shared-devnet program id with the checked `target/deploy/omegax_protocol.so`
   Use the canonical `Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B` program id directly if the checked deploy keypair file has drifted.
3. `npm run protocol:bootstrap:devnet-live`
4. `npm run devnet:frontend:bootstrap`
5. `npm run devnet:frontend:signoff`
6. `npm run devnet:governance:smoke:create-vote`
7. `npm run devnet:governance:smoke:execute` after the required voting and hold-up windows expire
8. `npm run devnet:governance:ui:readonly`
9. `OBSERVABILITY_OUTPUT_JSON=artifacts/devnet_observability.json npm run devnet:beta:observe`

Record the resulting outputs in the rollout summary:

- upgraded program id and slot
- proposal address used for governance smoke
- observability artifact path
- frontend bootstrap artifacts refreshed under `devnet/` and `frontend/public/`

If a rehearsal deployment is required for your launch window, run the same sequence against the rehearsal program id before touching the shared canonical devnet.

## Production prep

Before any broader production promotion outside devnet:

- **Fill in [`./release-candidate-evidence-template.md`](./release-candidate-evidence-template.md) for the candidate commit.** Every section is required. Empty sections are blockers, not formalities. The template is what records the exact commit, generated artifact hashes, CI run IDs, branch-protection state, localnet/operator-drawer outputs, dependency scan, actuarial gate (where applicable), and the truthful external-audit / bug-bounty posture for the release.
- confirm the release notes match the generated artifacts and public docs
- confirm downstream SDK and public docs consumers have the regenerated protocol contract
- explicitly review any remaining canonical-console action gaps so production claims/capital/governance workflows are not overstated
- run the operator drawer simulate-only smoke before presenting membership, claim, reserve, or plan-control actions as usable from the public console
- for Genesis Protect Acute live seeding, use [`./genesis-live-bootstrap.md`](./genesis-live-bootstrap.md) so the launch bootstrap takes explicit cluster, oracle, schema, and reserve-lane inputs instead of the shared devnet fixture matrix

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

For this repository, **repo baseline health** ends at `npm run verify:public`. **Production promotion** ends at a fully-filled [release-candidate evidence document](./release-candidate-evidence-template.md) for the candidate commit.
