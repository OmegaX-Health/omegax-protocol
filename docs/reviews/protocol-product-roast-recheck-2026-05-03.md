# OmegaX Protocol Product Roast Recheck

Date: May 3, 2026

Scope: repo-grounded product critique after the latest protocol changes on
`main`. This note captures the finding and discussion from the roast pass so it
can be linked from Notion without turning transient critique into architecture
doctrine.

## Verdict

The protocol is materially stronger than the previous roast, but it still does
not read cleanly as a product.

Score moved from roughly `52/100` to `57/100`.

That is real progress, not a pass. The technical foundation is getting sharper,
but the public shape still makes a user work too hard to understand what they
can buy, why it matters, and which parts are live versus planned.

## What improved

- Founder Travel30 commitments are now a concrete launch-money primitive instead
  of only a story. Pending commitments are explicitly separate from
  claims-paying reserve until activation.
- The Nomad Protect curve proof of concept gives the future product a sharper
  underwriting and risk-backer model, while clearly labeling it experimental and
  not Genesis v1 behavior.
- The Genesis Protect V1 curve launch plan turns that research into a narrower
  accepted recommendation: Travel 30 Curve first, Event 7 only if ready, and no
  public prediction market in V1.
- Reserve productivity is framed as a future, gated adapter surface rather than
  pretending that live reserve yield is already implemented.
- Validation coverage for the current repo state passed across Node tests, Rust
  tests, frontend build, generated artifact checks, formatting, linting, and diff
  whitespace checks.

## Main findings

### 1. The public story is still too abstract

`README.md` still opens as a settlement-layer description for builders creating
health apps, oracle services, sponsor programs, and outcome-triggered capital
flows. That may be technically accurate, but it is not the first thing a buyer,
judge, sponsor, or outside reviewer needs.

The sharper public story now exists in the repo: Founder Travel30 and Genesis
Protect Acute. The protocol should lead with that proof, then explain the
settlement layer behind it.

### 2. The first screen still points at setup

`frontend/app/page.tsx` still redirects the root route to
`/plans?setup=genesis-protect-acute`. That keeps the first impression anchored
in operator setup rather than the buyer-facing or proof-facing experience.

The repo now has enough Founder Travel30 and Genesis Protect machinery to make
the first screen feel like a real product proof. Keeping setup as the front door
makes the whole protocol feel unfinished even when the internals have improved.

### 3. PT-06 is still the clearest launch-readiness gap

`npm run test:node` passed, but the PT-06 report still says only `4/33`
transaction callsites pass pre-sign review metadata coverage. For a protocol
that moves reserves, treasury capacity, claims, and authority changes, that is
the most important non-story gap.

This should be treated as a mainnet-posture blocker, not polish.

### 4. Future-surface creep is still a product risk

ADR 0002 correctly says reserve productivity has no executable live strategy
surface yet. The related console and instruction-map docs also label the surface
as planned. That boundary is healthy.

The risk is messaging drift: if the protocol starts sounding like it already has
active yield deployment before reviewed adapters exist, it will undermine trust.
Deployed principal, unrealized APY, and adapter-reported rewards must not be
presented as free claims-paying reserve.

## Evidence

- `docs/operations/founder-commitment-runbook.md` documents Founder Travel30 as
  a temporary launch commitment flow, with pending deposits staying out of
  claims-paying reserve until activation.
- `programs/omegax_protocol/src/commitments.rs` implements commitment deposit,
  activation, treasury-credit activation, and refund accounting.
- `frontend/components/genesis-protect-acute-setup-panel.tsx` shows pending
  commitment accounting and reserve impact separately in the console.
- `examples/nomad-protect-curve-poc/review-memo.md` labels the curve work as an
  experimental future path, not Genesis v1.
- `docs/architecture/genesis-protect-v1-curve-launch.md` captures the accepted
  V1 recommendation: flexible Travel 30 curve pricing, explicit
  claims-paying reserve, Phase 0 AI/operator claim processing, and deferral of
  public prediction markets or health bonds.
- `docs/adr/0002-reserve-productivity-and-strategy-adapters.md` sets the reserve
  productivity boundary: no executable strategy surface exists today, yield only
  counts when realized, liquid, and reconciled, and adapters require public
  review.
- `docs/architecture/protocol-console-functional-spec.md` and
  `docs/architecture/solana-instruction-map.md` now describe reserve
  productivity as a planned surface, not a live IDL surface.

## Validation

Checks run during the recheck:

- `npm run test:node` - passed, `188` tests.
- `npm run rust:test` - passed, `60` tests.
- `npm run frontend:build` - passed.
- `npm run idl:freshness:check` - passed.
- `npm run protocol:contract:check` - passed.
- `npm run rust:fmt:check` - passed.
- `npm run rust:lint` - passed.
- `git diff --check` - passed.

## Follow-up priorities

1. Make Founder Travel30 the public entry story before the generic settlement
   layer story.
2. Change `/` away from operator setup toward a Founder Travel30 or Genesis
   Protect proof surface.
3. Close PT-06 by requiring pre-sign review metadata for all money-moving,
   reserve-changing, and authority-changing transaction callsites.

## Repo state at review time

The recheck was run with local `main` ahead of `origin/main` by six commits and
with uncommitted ADR and architecture documentation updates present. Those
uncommitted docs were included in the review because they change the planned
reserve-productivity story.
