# Frontend Information Architecture

The public protocol console is now organized around the canonical health-capital-markets nouns instead of a single overloaded pool workspace.

## Primary UI primitives

The public UI should treat these as first-order objects:

1. `HealthPlan`
2. `PolicySeries`
3. `ClaimCase`
4. `Obligation`
5. `LiquidityPool`
6. `CapitalClass`
7. `AllocationPosition`
8. `ReserveDomain`

## Navigation model

- `/overview` is the editorial systems-map entrypoint for the protocol workbench
- `/plans` is the sponsor/operator view
- `/plans/new?template=genesis-protect-acute` is the canonical Genesis bootstrap entrypoint
- `/plans?...&setup=genesis-protect-acute` is the bounded Genesis setup, reserve-warning, and issuance-posture view inside the mounted plan workspace
- `/capital` is the LP and capital-markets view
- `/claims` is the member claim-intake plus operator liability and adjudication view
- `/members` is the self-serve enrollment and member-rights posture view
- `/governance` is the scoped-control, bootstrap, and authority view
- `/oracles` is the oracle registry, readiness, and pool-binding dashboard
- `/oracles/register` and `/oracles/[oracleAddress]/update` are the dedicated oracle profile authoring flows
- `/schemas` explains comparability and series versioning

Legacy `/pools/*` routes are retained only as redirects to avoid carrying pool-first concepts forward in the main UX.

Mounted canonical routes should resolve their primary data from the live protocol snapshot adapter rather than from checked-in fixture state. Fixtures remain valid for tests, docs, bootstrap generation, and local previews, but they should not be the default operator truth surface for the mounted workbenches.

## Genesis operator mode

Genesis Protect Acute uses the same mounted `/plans` workspace rather than a separate launch console.

- `/plans/new?template=genesis-protect-acute` seeds the canonical plan, pool, class, series, funding-line, and allocation shell for Event 7 and Travel 30.
- `/plans?...&setup=genesis-protect-acute` keeps the operator on the live plan workspace while exposing the Genesis checklist, reserve-warning posture, and per-SKU launch truth.
- Travel 30 is the primary launch SKU and Event 7 remains the fast demo SKU when no explicit Genesis series is selected.
- This mounted mode must speak in launch-readiness language: end-of-month mainnet target, not broadly live insurance today, and Phase 0 operator-backed claim review with later AI and decentralized steps framed as roadmap.

## Overview route

The overview route is not a generic dashboard. It is the protocol entry composition: a sticky editorial hero rail on the left and a flowing access stream on the right.

- The left rail establishes protocol mood and orientation through one large headline, one aggregate network value, a signal-wave moment, and compact metric chips.
- The right rail is the navigation surface. It stages the major workbench destinations as staggered route cards, then closes with a live field log.
- Desktop keeps the hero rail visually stable while the document scroll moves the access stream beneath the floating top and bottom chrome.
- Mobile collapses to one column, but keeps the same sequence and hierarchy instead of inventing a separate dashboard layout.

The approved visual grammar for this route lives in the OmegaX design-system file `references/DESIGN_PROTOCOL_FRONTEND.md`. Treat that document as the source of truth when extending or redesigning `/overview`.

## Naming rules

- Use `HealthPlan` as the canonical protocol noun.
- Sponsor-facing copy may say `Program` where it improves comprehension, but it should still map to `HealthPlan`.
- Use `LiquidityPool` and `CapitalClass` explicitly for investor-facing surfaces.
- Do not use one generic `pool` label for both sponsor programs and LP vaults.

## Read-model rules

The frontend should answer different questions for different audiences:

- sponsors need funded budget, remaining budget, accrued obligations, paid outcomes, and claim status
- members need series rights, delegated rights, claim state, and payout history
- capital providers need NAV, reserved liabilities, pending queue pressure, impairment state, and exposure mix

Those views should be derived from the same canonical reserve kernel rather than from disconnected UI-specific math.
