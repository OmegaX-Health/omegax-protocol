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

- `/plans` is the sponsor/operator view
- `/capital` is the LP and capital-markets view
- `/claims` is the liability and adjudication view
- `/members` is the member-rights view
- `/governance` is the scoped-control and authority view
- `/oracles` explains the OmegaX Health event-production boundary
- `/schemas` explains comparability and series versioning

Legacy `/pools/*` routes are retained only as redirects to avoid carrying pool-first concepts forward in the main UX.

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
