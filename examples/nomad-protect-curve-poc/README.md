# Nomad Protect Curve PoC

This folder contains an experimental actuarial and product PoC for a nomad acute-emergency cover market with:

- member-side quote curve for low-budget coverage selection
- prediction-market-style open risk backing, where anyone can deposit capital in any amount
- reserve-aware issuance gates
- deterministic Monte Carlo stress checks

This does not replace the approved Genesis Protect Acute v1 pricing. It is a design exploration for a future curve-priced product.

## Product Split

The key split is:

- Members buy priced cover. A `15 USD` budget can buy micro-cover, but only through a quote curve that returns a bounded cover amount.
- Risk backers deposit any amount into the backstop market. Their capital supports issuance and earns premium surplus only if claims stay below modeled stress.

That keeps the prediction-market intuition while avoiding blind pay-anything insurance.

## Regenerate

```sh
npm run nomad:curve:poc
```

The generator writes:

- `review-output.json`
- `review-memo.md`
- an end-to-end production-logic drill inside both generated artifacts: open risk-backer deposits, signed quote receipts, activated coverage entitlements, and claim decisions.

## Curve

The PoC uses a pump.fun-style increasing quote curve over active issued coverage units:

```text
unit_price(u) = base_unit_premium * risk_multiplier * reserve_stress * (1 + u / curve_depth) ^ gamma
```

The buyer's quote integrates over the curve from current active units to the new issued units. Thin reserve states increase `reserve_stress`, so the same `15 USD` budget buys less cover when risk capital is scarce.

## Production Logic Drill

The PoC now models the full product path:

1. Risk backers deposit any amount into junior/backstop capital.
2. Members request signed quote receipts from the curve and reserve snapshot.
3. Purchases activate coverage entitlements with fixed caps, windows, and waiting periods.
4. Claim decisions enforce evidence, covered scope, waiting periods, remaining cap, and claims-paying reserve.
5. Approved claims reduce both the member's remaining cap and the market reserve.

The generated memo intentionally includes one capped micro-cover payout, one waiting-period denial, one ordinary approved illness claim, and one not-covered denial.

## Boundaries

- Experimental only.
- Not an external actuarial opinion.
- Not a regulatory opinion.
- Raw medical evidence stays offchain.
- Risk-backer capital is modeled as junior/backstop reserve, not as member premium.
