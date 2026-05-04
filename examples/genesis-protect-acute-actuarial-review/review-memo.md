# Genesis Protect Acute End-to-End Actuarial Workbook

Generated: 2026-05-04T00:00:00.000Z

## Headline

- Target solvency gate: p99.5.
- Public-open ceiling remains 1000 Event 7 + 500 Travel 30 at baseline.
- Event 7 same-venue cap remains 50.
- Travel 30 sponsor/backstop review threshold remains 100.
- Canonical redesign status: approved_applied_in_repo; see canonical-update-plan.md.

## Scenario Gates

| Scenario | Gate | Premium | p99.5 Claims | Reserve | Extra Reserve |
| --- | --- | --- | --- | --- | --- |
| bootstrap-50-e7-20-t30 | healthy | 3930 | 6315 | 118300 | 0 |
| phase2-200-e7-60-t30 | healthy | 13740 | 12699 | 118300 | 0 |
| table-safe-500-e7-200-t30 | healthy | 39300 | 27870 | 118300 | 0 |
| public-open-1000-e7-500-t30 | healthy | 88500 | 53762 | 118300 | 0 |
| adverse-1000-e7-500-t30 | healthy | 88500 | 79482 | 118300 | 0 |
| severe-adverse-1000-e7-500-t30 | healthy | 88500 | 91977 | 118300 | 0 |
| sponsor-cohort-100-e7-250-t30 | healthy | 28650 | 29941 | 143300 | 0 |
| founders-pass-12x-100-t30 | pause | 118800 | 103856 | 84900 | 18956 |
| country-tier-sponsor-only-300-t30 | healthy | 29700 | 37233 | 109900 | 0 |
| country-tier-waitlist-100-t30 | healthy | 9900 | 21085 | 84900 | 0 |
| travel30-only-500 | healthy | 49500 | 40894 | 84900 | 0 |
| travel30-only-adverse-500 | healthy | 49500 | 59925 | 84900 | 0 |
| lp-exit-1000-e7 | pause | 39000 | 18117 | 13400 | 4717 |

## Pricing Recommendations

| SKU | Current Premium | Current Gate | Recommended Premium | Recommended Cap | Recommended Gate |
| --- | --- | --- | --- | --- | --- |
| event7 | 39 | healthy | 39 | 1000 | healthy |
| travel30 | 99 | healthy | 99 | 3000 | healthy |

## Limits

- This is an internal launch-gate and pricing-redesign workbook, not an external actuarial opinion.
- Claim frequency and loss ratio assumptions come from the April 2026 internal actuarial reserve analysis.
- Severity distributions are modeled from current caps and claim examples; they are not fitted from paid-claim triangles.
- Claim simulation cases are used as scenario coverage evidence, not as country-level pricing credibility.
- Country posture is an operational gating taxonomy, not a regulatory legal opinion.
