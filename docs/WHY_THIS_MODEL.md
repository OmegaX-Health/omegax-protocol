# Why This Model

OmegaX is not building a closed rewards app and it is not building a private insurance admin database with a token attached. It is building public infrastructure for health capital markets.

That means the protocol has to tell the truth about three different constituencies at the same time:

- sponsors need to understand budgets, claims, burn, and outcomes
- members need to understand rights, claims, and payouts
- capital providers need to understand exposure, yield, impairment, and exits

The previous pool-centric shape could not do that honestly because one noun tried to represent product, treasury, funding source, and LP sleeve all at once.

The new model fixes that by separating what was previously mixed together:

- `HealthPlan` is the sponsor/member/liability root
- `PolicySeries` is the product lane
- `FundingLine` is the plan-side source of money
- `LiquidityPool` is the LP sleeve
- `CapitalClass` is the investor instrument
- `AllocationPosition` is the explicit bridge from investor capital into plan liabilities
- `ReserveDomain` is the real custody or legal segregation boundary

This produces better protocol behavior in every important direction.

## Better sponsor truth

Sponsors can now run a program with nothing more than:

- one `HealthPlan`
- one reward `PolicySeries`
- one sponsor-budget `FundingLine`

No LP plumbing is required just to pay for outcomes.

## Better member truth

Members can verify:

- what plan they are in
- what series they are subscribed to
- what claims exist
- what obligations are owed to them
- what has already been paid

Without pretending they own a capital position.

## Better capital truth

LPs can now answer:

- which capital class they own
- which plans and series their class funds
- what liabilities are reserved ahead of them
- what queue obligations and impairments exist
- what yield has actually been realized

Without reading sponsor-program objects and guessing where the money really sits.

## Better market structure

This model supports both:

- open DeFi participation
- wrapper-mediated or regulated participation

On one settlement foundation.

The key is layered constraints rather than separate protocols:

- `ReserveDomain` for hard segregation
- `HealthPlan` for sponsor and product baseline rules
- `PolicySeries` for product-specific tightening
- `CapitalClass` for investor restrictions and wrapper logic

## Better auditability

All materially relevant money transitions reconcile through scoped reserve ledgers.

That means the protocol can explain:

- funded amounts
- allocated amounts
- reserved liabilities
- claimable and payable balances
- impairments
- pending redemptions
- genuinely free capital

That is the minimum viable honesty standard for an onchain health capital market.
