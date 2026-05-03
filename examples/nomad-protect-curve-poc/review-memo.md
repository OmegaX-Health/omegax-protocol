# Nomad Protect Curve PoC

Generated: 2026-05-01T00:00:00.000Z

## Headline

- Status: experimental_poc_not_genesis_v1_pricing.
- This PoC keeps the useful prediction-market idea on the risk-backer side: anyone can deposit any amount into backstop capital.
- Member coverage is still quoted, capped, and reserve-gated. A 15 USD member budget buys about 286 USD of cover in a fresh market, not unlimited insurance.
- Curve: base 5.25 USD per 100 USD cover unit, depth 15000 units, gamma 1.45.
- Solvency gate: p99.5.

## Fresh-Market Quote Table

| Member Budget | Coverage Cap | Premium Used | Premium / Cap |
| --- | ---: | ---: | ---: |
| 15 | 286 | 15 | 5.25% |
| 39 | 743 | 39 | 5.25% |
| 99 | 1884 | 99 | 5.25% |
| 159 | 3000 | 157.73 | 5.26% |

## Scenario Gates

| Scenario | Gate | Members | Premium | Active Cover Limit | p99.5 or Stress Claims | Reserve | Extra Reserve |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| micro-bootstrap-200 | healthy | 200 | 3000 | 55636 | 4430 | 52700 | 0 |
| mixed-nomad-launch-500 | healthy | 500 | 33479.84 | 507295 | 22941 | 115131.86 | 0 |
| market-backed-growth-1500 | healthy | 1500 | 92506.84 | 1108181 | 44517 | 288256.16 | 0 |
| thin-market-growth-1500 | caution | 1500 | 92398.52 | 1046118 | 43682 | 133158.67 | 23759 |
| expensive-region-adverse-600 | healthy | 600 | 47928 | 532304 | 34307 | 143135.2 | 0 |
| nomad-hub-cluster-600 | pause | 600 | 49080 | 617687 | 148245 | 129172 | 19073 |

## Hybrid Model Snapshot

| Model | Verdict | Gate | Members | Avg Premium | Avg Cap | Expected Loss Ratio | p99.5 Claims | Reserve |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Separated Backstop Curve | ship_candidate | healthy | 500 | 65.88 | 1001 | 37.94% | 22626 | 114646 |
| Calibrated Pay-Anything Curve | ship_candidate | healthy | 650 | 63.48 | 925 | 38.22% | 26964 | 132137.6 |
| Loss-Ratio Signal Market | needs_wrapper | healthy | 1000 | 62.33 | 799 | 37.4% | 35774 | 201095.2 |
| Underwriting Prediction Tranche | needs_wrapper | healthy | 1000 | 60.46 | 798 | 36.07% | 33874 | 216986.4 |
| Collateralized Sidecar Vault | needs_wrapper | healthy | 1500 | 61.48 | 737 | 33.7% | 44874 | 287997.15 |
| Parametric Fast-Cash Overlay | ship_candidate | healthy | 1200 | 15 | 250 | 99.62% | 23250 | 91200 |
| Member Mutual Rebate Pool | ship_candidate | healthy | 800 | 64.28 | 894 | 35.8% | 29598 | 156278 |
| Member Health Bond | ship_candidate | healthy | 850 | 64.52 | 885 | 32.7% | 29161 | 154360.55 |
| Full Stack Market Mutual | needs_wrapper | healthy | 1500 | 58.36 | 695 | 30.93% | 40023 | 333786 |
| Flat-Promise Pay-Anything Failure Case | reject | pause | 500 | 28.92 | 3000 | 158.66% | 40494 | 63014 |

See `hybrid-model-report.md` for the full first-principles model comparison, scale checks, and plain-language explanation.

## End-to-End Production Logic Drill

### Risk Backers

| Backer | Deposit | Shares | Share |
| --- | ---: | ---: | ---: |
| backer_micro_15 | 15 | 15 | 0.1% |
| backer_small_150 | 150 | 150 | 0.99% |
| backer_anchor_15000 | 15000 | 15000 | 98.91% |

### Signed Quotes

| Member | Budget | Coverage Cap | Premium Used | Quote ID |
| --- | ---: | ---: | ---: | --- |
| nomad_micro | 15 | 286 | 15 | quote_nomad_micro_75e730be |
| nomad_standard | 159 | 3000 | 157.77 | quote_nomad_standard_a305352b |
| nomad_budget | 39 | 644 | 39 | quote_nomad_budget_90dea56c |

### Activated Entitlements

| Member | Coverage Cap | Remaining Cap | Accident Active | Illness Active | Status |
| --- | ---: | ---: | --- | --- | --- |
| nomad_micro | 286 | 0 | 2026-05-02T00:00:00.000Z | 2026-05-08T00:00:00.000Z | exhausted |
| nomad_standard | 3000 | 1350 | 2026-05-02T00:00:00.000Z | 2026-05-08T00:00:00.000Z | active |
| nomad_budget | 644 | 644 | 2026-05-02T00:00:00.000Z | 2026-05-08T00:00:00.000Z | active |

### Claim Decisions

| Claim | Member | Decision | Reason | Approved | Denied Over Cap | Remaining Cap |
| --- | --- | --- | --- | ---: | ---: | ---: |
| claim_micro_accident_over_cap | nomad_micro | approved | none | 286 | 134 | 0 |
| claim_standard_illness_wait | nomad_standard | denied | illness_waiting_period | 0 | 0 | 3000 |
| claim_standard_covered_illness | nomad_standard | approved | none | 1650 | 0 | 1350 |
| claim_budget_routine_denial | nomad_budget | denied | not_covered | 0 | 0 | 644 |

Final reserve after the drill: 38419.59 USD. Paid claims: 1936 USD.

## Product Rule

Do not sell this as "put any amount into a pool and you are insured." Sell it as:

> Choose a cover budget. The curve returns the cover cap available at current reserve and demand. Anyone can separately back the market with any amount of risk capital.

## Limits

- This is a product-design and actuarial PoC, not an external actuarial opinion.
- The model tests whether a low-budget quote curve can coexist with reserve-aware pricing and open risk-backer deposits.
- Risk-backer deposits are modeled as junior/backstop reserve capital; they are not treated as member coverage purchases.
- The member quote curve is an issuance and pricing model, not a commitment to offer blind pay-anything insurance.
- Backer yield outputs are simple one-window surplus-share diagnostics, not promised returns.
- Severity distributions are synthetic and should be replaced with credible paid-claim data before production.
