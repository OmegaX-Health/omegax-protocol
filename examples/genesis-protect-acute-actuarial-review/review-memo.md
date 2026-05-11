# Genesis Protect Acute End-to-End Actuarial Workbook

Generated: 2026-05-11T00:00:00.000Z

## Headline

- Target solvency gate: p99.5.
- Public-open ceiling remains 1000 Event 7 + 500 Travel 30 at baseline.
- Event 7 same-venue cap remains 30.
- Travel 30 sponsor/backstop review threshold remains 100.
- Canonical redesign status: approved_applied_in_repo; see canonical-update-plan.md.

## Scenario Gates

| Scenario | Gate | Premium | p99.5 Claims | Reserve | Extra Reserve |
| --- | --- | --- | --- | --- | --- |
| bootstrap-50-e7-20-t30 | healthy | 3930 | 9656 | 118300 | 0 |
| phase2-200-e7-60-t30 | healthy | 13740 | 19482 | 118300 | 0 |
| table-safe-500-e7-200-t30 | healthy | 39300 | 40984 | 118300 | 0 |
| public-open-1000-e7-500-t30 | healthy | 88500 | 76806 | 118300 | 0 |
| adverse-1000-e7-500-t30 | caution | 88500 | 113081 | 118300 | 0 |
| severe-adverse-1000-e7-500-t30 | pause | 88500 | 130573 | 118300 | 12273 |
| sponsor-cohort-100-e7-250-t30 | healthy | 28650 | 40638 | 143300 | 0 |
| founders-pass-12x-100-t30 | pause | 118800 | 131887 | 84900 | 46987 |
| country-tier-sponsor-only-300-t30 | healthy | 29700 | 48719 | 109900 | 0 |
| country-tier-waitlist-100-t30 | healthy | 9900 | 27846 | 84900 | 0 |
| travel30-only-500 | healthy | 49500 | 53064 | 84900 | 0 |
| travel30-only-adverse-500 | caution | 49500 | 76888 | 84900 | 0 |
| lp-exit-1000-e7 | pause | 39000 | 35377 | 13400 | 21977 |

## Pricing Recommendations

| SKU | Current Premium | Current Gate | Recommended Premium | Recommended Cap | Recommended Gate |
| --- | --- | --- | --- | --- | --- |
| event7 | 39 | pause | 79 | 3000 | healthy |
| travel30 | 99 | caution | 139 | 5000 | healthy |

## Limits

- This is an internal launch-gate and pricing-redesign workbook, not an external actuarial opinion.
- Claim frequency and loss ratio assumptions come from the April 2026 internal actuarial reserve analysis.
- Severity distributions are modeled from current caps and claim examples; they are not fitted from paid-claim triangles.
- Claim simulation cases are used as scenario coverage evidence, not as country-level pricing credibility.
- Country posture is an operational gating taxonomy, not a regulatory legal opinion.
