# `omegax_protocol`

This crate contains the canonical OmegaX Protocol onchain program.

## Current shape

The canonical Anchor facade lives in [`src/lib.rs`](./src/lib.rs). It declares
the program id, re-exports the public protocol types, and keeps every public
instruction present in `#[program] pub mod omegax_protocol`.

The Anchor-to-Quasar migration is staged through
[`src/platform.rs`](./src/platform.rs). Protocol implementation modules should
import `crate::platform::*` instead of framework preludes directly, so the
remaining Quasar swap is constrained to the platform seam plus the account,
instruction, and CPI ports. Quasar discriminator constants live in
[`src/quasar_discriminators.rs`](./src/quasar_discriminators.rs) and preserve
the current IDL instruction, account, and event byte prefixes. The live
migration checklist is
[`../../docs/architecture/quasar-migration.md`](../../docs/architecture/quasar-migration.md).

Instruction implementation now sits next to its account validation context in
audit-domain modules:

- [`src/reserve_custody.rs`](./src/reserve_custody.rs)
- [`src/plans_membership.rs`](./src/plans_membership.rs) for health plans and policy series
- [`src/funding_obligations/`](./src/funding_obligations/)
- [`src/claims.rs`](./src/claims.rs)
- [`src/oracle_schema.rs`](./src/oracle_schema.rs)
- [`src/kernel.rs`](./src/kernel.rs) and [`src/kernel/`](./src/kernel/) for shared authorization, math, transfer, and reserve-accounting helpers

Shared public surface types live in explicit modules:

- [`src/state.rs`](./src/state.rs) for account state and reserve-accounting structs
- [`src/args.rs`](./src/args.rs) for instruction args
- [`src/events.rs`](./src/events.rs) for events
- [`src/errors.rs`](./src/errors.rs) for errors
- [`src/constants.rs`](./src/constants.rs) for seeds, limits, modes, and flags

The active public object model is:

- `ReserveDomain`
- `DomainAssetVault`
- `DomainAssetLedger`
- `HealthPlan`
- `PlanReserveLedger`
- `PolicySeries`
- `FundingLine`
- `FundingLineLedger`
- `ClaimCase`
- `Obligation`

The former governance, fee-vault, liquidity-pool, capital-class, LP-position,
allocation, redemption, impairment, member-position, and outcome-schema
registry accounts have been removed from the live program surface. Reserve
movement now flows through reserve domains, health plans, policy series,
funding lines, obligations, and claim cases. Claim cases keep only proof
fingerprints for evidence and decision packages; raw evidence review and oracle
attestations stay off-chain or in adjunct programs instead of the base protocol.

Founder reservations are off-chain payment reservations into Squads custody,
not on-chain protocol accounts. They do not increase claims-paying reserve,
create active cover, or change policy state until an activation/posting flow
books reserve through the existing reserve, premium, and claim controls.
The base program now enforces same-asset settlement through domain asset vaults,
domain/funding/plan/series ledgers, funding-line asset binding, and SPL outflow
accounts instead of a separate reserve-asset rail and price feed layer.

## Important reviewer rule

Treat `src/lib.rs` as the instruction/IDL facade and the domain modules above as
the implementation truth. Historical `core_accounts.rs` types have been removed
from the live program source so stale account layouts are not mistaken for the
current protocol surface.

## Orientation docs

- [`../../docs/adr/0001-health-capital-markets-rearchitecture.md`](../../docs/adr/0001-health-capital-markets-rearchitecture.md)
- [`../../docs/architecture/solana-program-architecture.md`](../../docs/architecture/solana-program-architecture.md)
- [`../../docs/architecture/solana-instruction-map.md`](../../docs/architecture/solana-instruction-map.md)
- [`../../docs/MIGRATION_MATRIX.md`](../../docs/MIGRATION_MATRIX.md)

## Common commands

From the repository root:

```bash
npm run rust:fmt:check
npm run rust:test
npm run rust:lint
npm run anchor:idl
npm run quasar:check
npm run quasar:discriminators
npm run protocol:contract
```

## QEDGen onboarding

The repo now has a brownfield QEDGen spec at
[`../../omegax_protocol.qedspec`](../../omegax_protocol.qedspec), with
project metadata in [`../../.qed/config.json`](../../.qed/config.json).

Run the current spec sanity check from the repository root:

```bash
qedgen check --anchor-project programs/omegax_protocol --coverage --json
```

The current pass records the public handler surface, program id, selected
constants, account contexts, source-derived signer bindings, an abstract
aggregate `State.Live`, first-order handler effects, initial properties, and
the obvious SPL transfer directions. Remaining modeling work is deliberately
called out inline as `SPEC-REFINE` comments where exact per-account right-hand
sides, fee carve-outs, PDA derivations, emitted events, and deeper conservation
equations still need to be tightened.

The current QEDGen check is expected to report one token-CPI warning for
`create_domain_asset_vault`: that handler accepts `token_program` for vault
account initialization but does not move tokens.

## Certora Solana lane

The optional Certora Solana lane lives in
[`../../formal_verification/certora/`](../../formal_verification/certora/).
It is a manual maintainer lane for narrow symbolic checks against high-value
kernel/scalar properties, not part of `npm run verify:public` and not an audit
claim.

Run the local prerequisite check from the repository root:

```bash
npm run certora:solana:check
```

Only submit a remote prover job when `CERTORAKEY` is set and the operator has
confirmed that the configured sources may be sent to Certora's service:

```bash
npm run certora:solana:sanity
```

The sanity config currently runs constrained CVLR rules for selected-asset
payout bounds, fee-recipient binding, fee-vault withdrawal bounds, and reserve
capacity non-overflow. These are useful formal-verification evidence, but they
are not full Anchor handler/account-flow proofs.

Record any run result in the release-candidate evidence file with the exact
rule name, command, result, and Certora job URL. Do not commit access keys,
generated job archives, or wording that implies Certora performed a third-party
audit unless that review actually exists.
