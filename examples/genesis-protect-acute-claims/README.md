# Genesis Protect Acute — Claim Simulations

Realistic claim simulation scenarios for **Genesis Protect Acute v1**, the first
OmegaX protocol product targeting mainnet launch.

## What this is

This directory contains a structured JSON file (`genesis-acute-claim-simulations-v1.json`)
with **32 simulated claim cases** spanning both Genesis Protect Acute product SKUs:

| Product | Coverage | Premium | Max Benefit | Benefit Mode |
|---|---|---|---|---|
| **Event 7** | 7 days | $39 | $1,000 | Fixed-benefit only |
| **Travel 30** | 30 days | $99 | $3,000 | Hybrid fixed + reimbursement |

## Scenario structure

Each scenario is modelled across 7 dimensions:

1. **Patient profile** — age, sex, nationality, pre-existing conditions
2. **Clinical setting** — country, city, facility, event context
3. **Diagnosis** — primary diagnosis, ICD-10 code, clinical narrative
4. **Claim financials** — invoiced cost, approved amount, denied amount, UCR notes
5. **Oracle review flow** — Phase 0 human operator review, documents, SLA
6. **On-chain outcome** — `intakeStatus`, USDC settled, FundingLine charged
7. **Denial / in-flight metadata** — exclusion clause, fraud flags, blocking reason

## Distribution (32 total)

|  | Tier 1 ER Same-Day | Tier 2 Overnight | Tier 3 Surgery+ICU | Denial | Under Review | Total |
|---|---|---|---|---|---|---|
| **Event 7** | 4 | 4 | 4 | 3 | 1 | **16** |
| **Travel 30** | 4 | 4 | 4 | 3 | 1 | **16** |

### Clinical tier benefit schedule

| Tier | Event 7 (fixed) | Travel 30 (hybrid UCR) |
|---|---|---|
| Tier 1 — ER same-day | $150 | $400 – $850 |
| Tier 2 — Overnight | $500 | $1,200 – $2,500 |
| Tier 3 — Surgery + ICU + 2 nights | $1,000 | $2,500 – $3,000 |

### Denial exclusion categories covered

- Dental and oral conditions (Section 5.3)
- Substance dependence treatment (Section 5.6)
- Elective pre-planned procedures (Section 5.1)
- Chronic disease management / prescription refills (Section 5.4)
- Intentional self-harm (Section 5.2 — absolute exclusion)
- Obesity and weight-loss surgery (Section 5.5) + fraud / misrepresentation (Section 8.2)

### Under-review (in-flight) scenarios

Two scenarios are frozen at `intakeStatus: 1` (UNDER_REVIEW) with reserved USDC
on the respective FundingLine, to support frontend console testing and operator training:

- `EVT7-T3-REVIEW-001` — Traumatic splenic rupture, Cape Town. Blocked: ICU charts pending from hospital IT outage.
- `TRV30-T3-REVIEW-001` — Small bowel obstruction, Bali. Blocked: CT report in Bahasa Indonesia (translation pending) + lump-sum invoice requiring itemization.

## Protocol references

These scenarios reference live devnet fixture addresses:

- **Program ID**: `Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B`
- **Health Plan (Genesis Protect Acute)**: `D38bBYTWAkcyJZHFaZLRYRJErwLNB45YKJPfxU4PL5F6`
- **Event 7 PolicySeries**: `6ZfyGQUcW132mEmYBmT5RtoagZyTHi2gTuGQUHW2qTLX`
- **Travel 30 PolicySeries**: `29XmfdaHceAeAvtiESAcNDXLsJxEqW2RBa3DttTUUcco`
- **Reserve Domain**: `WfQ7PjCTwuTCn3KM4mxUmyjQSw3RvcnyT3Gfdg2WUoq`
- **Settlement currency**: USDC (`hWMfBLfo8EBaRTCcrWV33xaUR8gK2iTtqPoQvEMHmvu`)

> **Not canonical devnet state.** These are simulation fixtures for testing,
> operator training, and product documentation. They do not represent real
> on-chain claim accounts.
