# Frontend Information Architecture

The protocol console is organized around a pool-scoped operating model.

## Primary product primitives

The public UI should treat the following as first-order objects in navigation, state, and permissions:

1. `Pool`
2. `Member`
3. `Coverage Position`
4. `Claim`
5. `Oracle Operator`
6. `Attestation`
7. `Settlement`

Everything else should be presented as configuration or metadata attached to one of those primitives.

## Navigation model

- `Pool` is the primary workspace root.
- Member, claim, coverage, and settlement actions should appear in the context of a selected pool whenever possible.
- Oracle-specific visibility should remain wallet-aware and only surface advanced controls when the connected wallet has the relevant protocol role.
- Legacy direct routes may remain for deep links, but primary navigation should stay concise and operator-oriented.

## Conceptual distinction

`Pool` and `Coverage Position` are related, but they are not interchangeable:

- `Pool` is the shared capital, rule, and governance container.
- `Coverage Position` represents a member's active participation inside a pool.
- Reward and coverage flows can share pool rails without collapsing into the same user concept.

## Current implementation direction

The frontend currently reflects this model by:
- using pool-scoped workspace routes
- centering pool operations in the main navigation
- gating oracle-staking visibility to applicable wallets
- treating claims and coverage actions as pool-context operations rather than top-level app silos
