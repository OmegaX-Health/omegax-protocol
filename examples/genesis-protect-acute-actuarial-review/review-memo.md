# Genesis Protect Acute End-to-End Actuarial Workbook

Generated: 2026-04-27T00:00:00.000Z

## Headline

- Target solvency gate: p99.5.
- Public-open ceiling remains 1000 Event 7 + 500 Travel 30 at baseline.
- Event 7 same-venue cap remains 50.
- Travel 30 sponsor/backstop review threshold remains 100.
- Canonical updates are not applied automatically; see canonical-update-plan.md.

## Scenario Gates

| Scenario | Gate | Premium | p99.5 Claims | Reserve | Extra Reserve |
| --- | --- | --- | --- | --- | --- |
| bootstrap-50-e7-20-t30 | healthy | 3930 | 8671 | 88300 | 0 |
| phase2-200-e7-60-t30 | healthy | 13740 | 16508 | 88300 | 0 |
| table-safe-500-e7-200-t30 | healthy | 39300 | 35227 | 88300 | 0 |
| public-open-1000-e7-500-t30 | healthy | 88500 | 66890 | 88300 | 0 |
| adverse-1000-e7-500-t30 | pause | 88500 | 98927 | 88300 | 10627 |
| severe-adverse-1000-e7-500-t30 | pause | 88500 | 114101 | 88300 | 25801 |
| sponsor-cohort-100-e7-250-t30 | healthy | 28650 | 38742 | 113300 | 0 |
| founders-pass-12x-100-t30 | pause | 118800 | 130460 | 54900 | 75560 |
| country-tier-sponsor-only-300-t30 | healthy | 29700 | 48185 | 79900 | 0 |
| country-tier-waitlist-100-t30 | healthy | 9900 | 27622 | 54900 | 0 |
| travel30-only-500 | caution | 49500 | 52411 | 54900 | 0 |
| travel30-only-adverse-500 | pause | 49500 | 76394 | 54900 | 21494 |
| lp-exit-1000-e7 | pause | 39000 | 21184 | 13400 | 7784 |

## Pricing Recommendations

| SKU | Current Premium | Current Gate | Recommended Premium | Recommended Cap | Recommended Gate |
| --- | --- | --- | --- | --- | --- |
| event7 | 39 | caution | 39 | 1000 | healthy |
| travel30 | 99 | pause | 159 | 3000 | healthy |

## Limits

- This is an internal launch-gate and pricing-redesign workbook, not an external actuarial opinion.
- Claim frequency and loss ratio assumptions come from the April 2026 internal actuarial reserve analysis.
- Severity distributions are modeled from current caps and claim examples; they are not fitted from paid-claim triangles.
- Claim simulation cases are used as scenario coverage evidence, not as country-level pricing credibility.
- Country posture is an operational gating taxonomy, not a regulatory legal opinion.
