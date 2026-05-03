# Genesis Protect V1 Curve Launch Plan

Status: accepted launch recommendation
Date: 2026-05-03
Audience: founders, product, protocol, claims operators, reserve operators, app/backend implementers
Notion record: https://www.notion.so/355e7028cbb981a6b001fcb6b755ee91

## Decision

Ship Genesis Protect Acute V1 on mainnet as a working coverage and claims product with:

- Travel 30 Curve as the primary member offer.
- Event 7 fixed cover as the short-window demo/cohort SKU if it is already operationally ready.
- Explicit claims-paying reserve from opening reserve, collected premiums, and private/operator backstop capital.
- AI/operator-assisted offchain claim processing in Phase 0.
- Onchain claim truth chain for evidence references, attestation, adjudication, reserve booking, and settlement.

Do not ship the public prediction market, predictor rewards, health bonds, self-betting, or transferable risk positions in V1. Those are later market layers.

The simplest accurate description is:

```text
Member chooses budget
-> quote curve returns a fixed cap
-> member buys capped acute cover
-> AI/operator processes claim offchain
-> protocol records claim truth and reserve consequence
-> claim settles from claims-paying reserve
```

## Why this is the V1

The prior fixed-price V1 was actuarially clear but left a product gap: some users will not buy a 159 USD Travel 30 policy, while they may buy 15 to 99 USD of protection.

The later full-stack market design is strategically stronger, but it is too much surface area for the first mainnet launch. It adds public market rules, settlement logic, predictor onboarding, collateral accounting, reward waterfalls, market integrity risk, and legal review.

The V1 compromise is better:

- keep the coverage promise boring and claimable
- let the quote curve make entry flexible
- keep capital accounting explicit
- ship real claims before shipping a public underwriting market

This gives the product the useful "put in what you want" behavior without pretending prediction-market volume is reserve.

## V1 offer

### Primary SKU: Travel 30 Curve

- Cover window: 30 days.
- Scope: acute, unplanned emergency medical care during the cover window.
- Minimum member budget: 15 USD.
- Maximum member cap: 3,000 USD.
- Illness waiting period: 7 days.
- Accident waiting period: 24 hours.
- Coverage cap is fixed at purchase.
- Terms hash, pricing curve hash, reserve snapshot, and quote TTL must be attached to the quote receipt.

Fresh-market quote examples from the Nomad Protect Curve PoC:

| Member budget | Coverage cap | Premium / cap |
| ---: | ---: | ---: |
| 15 USD | 286 USD | 5.25% |
| 39 USD | 743 USD | 5.25% |
| 99 USD | 1,884 USD | 5.25% |
| 159 USD | 3,000 USD | 5.26% |

Warm and stressed markets quote less cover per dollar. That is intentional. The curve should protect reserve health rather than preserve a marketing cap.

### Optional V1 SKU: Event 7 fixed cover

Event 7 can remain the short trip, conference, or sponsor demo SKU:

- 7-day cover window.
- 39 USD retail.
- 1,000 USD max cap.
- Fixed benefit only in V1.
- Same anti-selection posture: 24-hour accident wait; illness cover only if bought at least 7 days before the window unless a prefunded sponsor roster explicitly waives it.

Do not block V1 on Event 7 if Travel 30 Curve and claims operations are ready first.

## Member language

Use plain product language:

> Choose your protection budget. We quote exactly how much acute emergency cover it buys before you join.

For a 39 USD quote:

> Your 39 USD buys up to 743 USD of acute emergency cover for 30 days.

Avoid:

- "Pay anything and you are insured" without the quoted cap.
- "Prediction-market insurance" for V1.
- "Fully decentralized claims" while Phase 0 uses AI/operator-assisted review.
- "Yield-backed insurance" unless rewards and reserve waterfalls are actually live.

## Reserve model

V1 claims-paying reserve is:

```text
opening protocol reserve
+ 90% of collected member premiums
+ explicit sponsor/backstop/LP capital posted for claims
```

Only those amounts count as V1 claims-paying reserve.

Do not count:

- prediction-market trading volume
- non-locked market liquidity
- expected future yield
- token collateral without explicit haircuts and disclosure
- member budgets before purchase finality

Issuance must pause or reprice when free reserve after the quote would breach the SKU floor.

## Actuarial evidence

The repo contains two relevant workbooks:

- Genesis Protect Acute fixed SKU launch review: `examples/genesis-protect-acute-actuarial-review/review-memo.md`
- Nomad curve and market-structure PoC: `examples/nomad-protect-curve-poc/hybrid-model-report.md`

### Existing Genesis fixed SKU launch gate

The April 27 Genesis workbook keeps the current fixed SKU launch healthy:

| Scenario | Gate | Premium | p99.5 claims | Reserve |
| --- | --- | ---: | ---: | ---: |
| public-open 1000 Event 7 + 500 Travel 30 | healthy | 118,500 USD | 53,762 USD | 118,300 USD |
| adverse 1000 Event 7 + 500 Travel 30 | healthy | 118,500 USD | 79,482 USD | 118,300 USD |
| severe adverse 1000 Event 7 + 500 Travel 30 | healthy | 118,500 USD | 91,977 USD | 118,300 USD |
| travel30-only 500 | healthy | 79,500 USD | 40,894 USD | 84,900 USD |
| travel30-only adverse 500 | healthy | 79,500 USD | 59,925 USD | 84,900 USD |

This remains the conservative basis for mainnet launch.

### Curve and market-structure simulations

The updated Nomad curve PoC tested multiple models:

| Model | Verdict | Gate | Members | Avg premium | Avg cap | Expected loss ratio | p99.5 claims | Reserve |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Calibrated Pay-Anything Curve | ship candidate | healthy | 650 | 63.48 USD | 925 USD | 38.22% | 26,964 USD | 132,137.60 USD |
| Underwriting Prediction Tranche | needs wrapper | healthy | 1000 | 60.46 USD | 798 USD | 36.07% | 33,874 USD | 216,986.40 USD |
| Member Health Bond | ship candidate | healthy | 850 | 64.52 USD | 885 USD | 32.70% | 29,161 USD | 154,360.55 USD |
| Full Stack Market Mutual | needs wrapper | healthy | 1500 | 58.36 USD | 695 USD | 30.93% | 40,023 USD | 333,786 USD |
| Flat-Promise Pay-Anything Failure Case | reject | pause | 500 | 28.92 USD | 3,000 USD | 158.66% | 40,494 USD | 63,014 USD |

Main finding:

- "Pay anything" is viable when the amount paid maps to a fixed reserve-gated cap.
- "Pay anything for the same 3,000 USD promise" fails.
- Predictor collateral can become useful claims capital later, but only for the slice explicitly locked into the claims waterfall.
- Health bonds are promising later because they align members around no-claim behavior, but they should not be in the first public mainnet launch.

## Claims model

V1 claims are Phase 0 AI/operator-assisted, not fully decentralized.

Offchain:

- member claim intake
- AI claim processor recommendation
- evidence normalization
- human/operator review
- appeals and more-info-needed workflow
- raw medical document storage

Onchain:

- `open_claim_case`
- `attach_claim_evidence_ref`
- `attest_claim_case`
- `adjudicate_claim_case`
- `reserve_obligation`
- `settle_claim_case` / `settle_obligation`

Raw medical payloads remain offchain. The chain records evidence references, attestation, adjudication, reserve effect, and settlement.

The detailed truth-chain walkthrough is in `docs/architecture/genesis-protect-claim-trace.md`.

## Policy and operational boundaries

V1 should include:

- acute-only emergency medical scope
- explicit exclusions
- hard coverage caps
- waiting periods
- quote TTL
- signed quote receipts
- reserve snapshot hash
- SKU-scoped issuance gates
- claim evidence requirements
- operator override and hold states
- public claim status and payout timeline

V1 should not include:

- broad annual health insurance
- chronic care
- routine outpatient care
- maternity/fertility
- evacuation/baggage/trip cancellation
- public prediction markets
- self-betting on sickness
- public predictor reward markets
- health bonds
- secondary liquidity for risk positions

## Why not ship the full market now

The full-stack model is economically interesting, but it is a second product surface.

It requires:

- market contracts
- objective aggregate settlement rules
- market participation rules
- collateral tranche accounting
- predictor reputation
- reward waterfall
- manipulation and insider controls
- regulatory review
- public explanations for traders and members

The first mainnet launch should prove the hardest thing first: a member can buy coverage, submit a claim, and receive a payout from a visible reserve.

Once that is live, market capital can graduate through:

1. private/operator backstop sidecar
2. invite-only underwriting prediction tranche in shadow mode
3. live predictor collateral as junior claims capital
4. public aggregate loss-ratio markets
5. optional member no-claim health bonds

## Production acceptance checklist

Before public mainnet activation, the launch surface should have:

- Travel 30 Curve terms frozen.
- Cap and premium curve published.
- Reserve floor and issuance pause logic implemented.
- Opening reserve posted.
- Backstop capital posted or explicitly documented.
- AI/operator claim intake ready.
- Evidence reference and claim attestation path ready.
- Settlement path tested with real payout rail assumptions.
- Public copy says "AI-assisted under operator oversight."
- Terms, exclusions, waiting periods, and evidence requirements resolve from public links.
- Release evidence captured with commit, artifact hash, bootstrap output, and test output.

## Repo artifacts

Primary artifacts:

- `examples/genesis-protect-acute-actuarial-review/review-memo.md`
- `examples/nomad-protect-curve-poc/hybrid-model-report.md`
- `examples/nomad-protect-curve-poc/review-output.json`
- `docs/architecture/genesis-protect-claim-trace.md`
- `docs/architecture/decentralized-coverage-claims.md`

The underwriting-market simulation expansion was committed as:

```text
bc6a11e Extend nomad underwriting market simulations
```

## Final V1 recommendation

Ship:

```text
Genesis Protect Acute V1
- Travel 30 Curve as the main offer
- Event 7 fixed cover only if operationally ready
- private/operator backstop sidecar
- signed quote receipts
- AI/operator claim processing
- onchain claim truth chain
- p99.5 reserve gate
- hard issuance caps
```

Defer:

```text
public prediction market
predictor yield
self-betting
health bonds
transferable risk positions
full public backer marketplace
complex yield waterfall
```

This is the fastest credible mainnet path because it ships real coverage, real claims, and flexible pricing without turning launch into a capital-markets release.
