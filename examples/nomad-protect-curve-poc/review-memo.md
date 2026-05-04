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

## Scenario Gates

| Scenario | Gate | Members | Premium | Active Cover Limit | p99.5 or Stress Claims | Reserve | Extra Reserve |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| micro-bootstrap-200 | healthy | 200 | 3000 | 55636 | 4430 | 52700 | 0 |
| mixed-nomad-launch-500 | healthy | 500 | 27960 | 436583 | 21578 | 110164 | 0 |
| market-backed-growth-1500 | healthy | 1500 | 77448 | 974669 | 42748 | 274703.2 | 0 |
| thin-market-growth-1500 | caution | 1500 | 79320 | 947251 | 42105 | 121388 | 20700 |
| expensive-region-adverse-600 | healthy | 600 | 38748 | 446303 | 31413 | 134873.2 | 0 |
| nomad-hub-cluster-600 | pause | 600 | 41940 | 544131 | 130591 | 122746 | 7845 |

## Hybrid Model Snapshot

| Model | Verdict | Gate | Members | Avg Premium | Avg Cap | Expected Loss Ratio | p99.5 Claims | Reserve |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Separated Backstop Curve | ship_candidate | healthy | 500 | 55.8 | 872 | 43.33% | 21314 | 110110 |
| Calibrated Pay-Anything Curve | ship_candidate | healthy | 650 | 54.22 | 814 | 43.55% | 25218 | 126721.4 |
| Loss-Ratio Signal Market | needs_wrapper | healthy | 1000 | 54.71 | 723 | 41.79% | 34301 | 194237.2 |
| Underwriting Prediction Tranche | needs_wrapper | healthy | 1000 | 52.78 | 719 | 40.53% | 32321 | 210074.4 |
| Collateralized Sidecar Vault | needs_wrapper | healthy | 1500 | 52.48 | 658 | 38.57% | 43163 | 275848 |
| Parametric Fast-Cash Overlay | ship_candidate | healthy | 1200 | 15 | 250 | 99.62% | 23250 | 91200 |
| Member Mutual Rebate Pool | ship_candidate | healthy | 800 | 56.4 | 807 | 39.79% | 28453 | 150608 |
| Member Health Bond | ship_candidate | healthy | 850 | 55.98 | 792 | 36.8% | 27830 | 147827.4 |
| Full Stack Market Mutual | needs_wrapper | healthy | 1500 | 50.24 | 623 | 35.2% | 38273 | 322824 |
| Flat-Promise Pay-Anything Failure Case | reject | pause | 500 | 27.84 | 3000 | 164.81% | 40494 | 62528 |

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
| nomad_standard | 99 | 1883 | 99 | quote_nomad_standard_072f0546 |
| nomad_budget | 39 | 644 | 39 | quote_nomad_budget_90dea56c |

### Activated Entitlements

| Member | Coverage Cap | Remaining Cap | Accident Active | Illness Active | Status |
| --- | ---: | ---: | --- | --- | --- |
| nomad_micro | 286 | 0 | 2026-05-02T00:00:00.000Z | 2026-05-08T00:00:00.000Z | exhausted |
| nomad_standard | 1883 | 233 | 2026-05-02T00:00:00.000Z | 2026-05-08T00:00:00.000Z | active |
| nomad_budget | 644 | 644 | 2026-05-02T00:00:00.000Z | 2026-05-08T00:00:00.000Z | active |

### Claim Decisions

| Claim | Member | Decision | Reason | Approved | Denied Over Cap | Remaining Cap |
| --- | --- | --- | --- | ---: | ---: | ---: |
| claim_micro_accident_over_cap | nomad_micro | approved | none | 286 | 134 | 0 |
| claim_standard_illness_wait | nomad_standard | denied | illness_waiting_period | 0 | 0 | 1883 |
| claim_standard_covered_illness | nomad_standard | approved | none | 1650 | 0 | 233 |
| claim_budget_routine_denial | nomad_budget | denied | not_covered | 0 | 0 | 644 |

Final reserve after the drill: 38366.7 USD. Paid claims: 1936 USD.

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
