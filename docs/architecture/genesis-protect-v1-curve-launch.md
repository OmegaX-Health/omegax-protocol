# Genesis Protect V1 Curve Launch Plan

Status: accepted launch recommendation
Date: 2026-05-03
Audience: founders, product, protocol, claims operators, reserve operators, app/backend implementers
Source-of-truth record: internal decision log; public repo copy intentionally omits workspace URLs.

## Decision

Ship Genesis Protect Acute V1 on mainnet as a working coverage and claims product with:

- Travel 30 Founder access as the primary member offer: 100 seats at 99 USD, targeting a reserve-indexed cap up to 250,000 USD at activation.
- Event 7 fixed cover as the short-window demo/cohort SKU if it is already operationally ready.
- Explicit claims-paying reserve from opening reserve, collected premiums, and private/operator backstop capital.
- AI/operator-assisted offchain claim processing in Phase 0.
- Onchain claim truth chain for evidence references, attestation, adjudication, reserve booking, and settlement.

Do not ship the public prediction market, predictor rewards, health bonds, self-betting, or transferable risk positions in V1. Those are later market layers.

The simplest accurate description is:

```text
Member reserves Founder access
-> reserve/backstop proof unlocks a cap ladder
-> activation quote returns the exact locked cap and terms
-> member activates capped acute cover
-> AI/operator processes claim offchain
-> protocol records claim truth and reserve consequence
-> claim settles from claims-paying reserve
```

## Why this is the V1

The public Founder V1 is now a fixed 99 USD reservation for Travel 30 access, but the cap must stay reserve-gated. The better launch promise is not "99 USD buys 250,000 USD live coverage today." It is "99 USD reserves access; the activation quote locks the cap that the posted reserve/backstop can actually support."

The later full-stack market design is strategically stronger, but it is too much surface area for the first mainnet launch. It adds public market rules, settlement logic, predictor onboarding, collateral accounting, reward waterfalls, market integrity risk, and legal review.

The V1 compromise is better:

- keep the coverage promise boring and claimable
- let reserve-indexed activation make the benefit flexible
- keep capital accounting explicit
- ship real claims before shipping a public underwriting market

This keeps the useful dynamic behavior without pretending prediction-market volume, waitlist deposits, or pending reservations are claims-paying reserve.

## V1 offer

### Primary SKU: Travel 30 Founder access

- Cover window: 30 days.
- Scope: acute, unplanned emergency medical care during the cover window.
- Founder reservation price: 99 USD.
- Founder cohort: first 100 seats.
- Target max benefit: up to 250,000 USD.
- Cap mode: reserve-indexed until activation.
- Illness waiting period: 7 days.
- Accident waiting period: 24 hours.
- Coverage cap is fixed only at activation, not at reservation.
- Terms hash, cap ladder hash, reserve snapshot/hash, exclusions, waiting periods, and quote TTL must be attached to the activation quote receipt.

Public copy:

> $99 Travel 30 Founder access. First cohort: 100 seats. Target cap up to $250k, unlocked only when posted claims-paying reserve/backstop reaches the required threshold. Exact cap and terms lock at activation.

Reserve-indexed cap ladder for launch copy:

| Posted claims-paying reserve/backstop floor | Travel 30 activation cap |
| ---: | ---: |
| 250,000 USD | 25,000 USD |
| 750,000 USD | 75,000 USD |
| 1,500,000 USD | 150,000 USD |
| 2,000,000 USD | 200,000 USD |
| 2,500,000 USD | 250,000 USD |

The ladder is campaign metadata and activation gating guidance, not active cover. If reserve/backstop proof is unavailable, activation copy must fail closed and show no live 250,000 USD coverage claim.

The `/protect/devnet` website simulator may use the 2,000,000 USD row to show a 200,000 USD locked Travel 30 demo cap with simulated reserve and terms hashes. That is QA/demo state only: it is not public mainnet cover, not a licensed insurance policy, and not a real payout obligation.

### Optional V1 SKU: Event 7 fixed cover

Event 7 can remain the short trip, conference, or sponsor demo SKU:

- 7-day cover window.
- 39 USD retail.
- 3,000 USD max cap after the May 11 cap increase.
- Fixed benefit only in V1.
- Same anti-selection posture: 24-hour accident wait; illness cover only if bought at least 7 days before the window unless a prefunded sponsor roster explicitly waives it.

Do not block V1 on Event 7 if Travel 30 Founder access and claims operations are ready first.

## Member language

Use plain product language:

> Reserve Travel 30 Founder access now. We quote the exact active cap before you activate.

For the 99 USD Founder offer:

> Your 99 USD reserves access to the first 100-seat Travel 30 cohort. The target cap is up to 250,000 USD, but only if posted reserve/backstop proof supports it before activation.

Avoid:

- "Pay anything and you are insured" without the quoted cap.
- "250,000 USD coverage is live" before the reserve threshold is met and terms are frozen.
- "Prediction-market insurance" for V1.
- "Fully decentralized claims" while Phase 0 uses AI/operator-assisted review.
- "Yield-backed insurance" unless rewards and reserve waterfalls are actually live.
- "Comprehensive travel insurance" unless a licensed wrapper and matching benefits are in force.

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
- waitlist deposits or pending Founder reservations

Issuance must pause or reprice when free reserve after the quote would breach the SKU floor.

## Actuarial evidence

The repo contains two relevant workbooks:

- Genesis Protect Acute fixed SKU launch review: `examples/genesis-protect-acute-actuarial-review/review-memo.md`
- Nomad curve and market-structure PoC: `examples/nomad-protect-curve-poc/hybrid-model-report.md`

### Historical Genesis fixed SKU launch gate

The May 11 Genesis workbook was the fixed-cap basis before the Founder cohort target changed: Event 7 carried a 3,000 USD fixed-benefit cap, and Travel 30 carried a 5,000 USD aggregate cap. It remains useful as the conservative Phase 0 claims-processing baseline, but it no longer defines the public Travel 30 Founder headline. A 250,000 USD target cap requires the reserve/backstop ladder above, fresh actuarial review, and final activation terms before any member receives active cover.

| Scenario | Gate | Premium | p99.5 claims | Reserve |
| --- | --- | ---: | ---: | ---: |
| public-open 1000 Event 7 + 500 Travel 30 | healthy | 88,500 USD | 76,806 USD | 118,300 USD |
| adverse 1000 Event 7 + 500 Travel 30 | caution | 88,500 USD | 113,081 USD | 118,300 USD |
| severe adverse 1000 Event 7 + 500 Travel 30 | pause | 88,500 USD | 130,573 USD | 118,300 USD |
| travel30-only 500 | healthy | 49,500 USD | 53,064 USD | 84,900 USD |
| travel30-only adverse 500 | caution | 49,500 USD | 76,888 USD | 84,900 USD |

This is retained as repo evidence for the earlier fixed-cap gate. Do not use it to claim that the 250,000 USD Founder target is actuarially approved or active.

### Curve and market-structure simulations

The updated Nomad curve PoC tested multiple models:

| Model | Verdict | Gate | Members | Avg premium | Avg cap | Expected loss ratio | p99.5 claims | Reserve |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Calibrated Pay-Anything Curve | ship candidate | healthy | 650 | 54.22 USD | 814 USD | 43.55% | 25,218 USD | 126,721.40 USD |
| Underwriting Prediction Tranche | needs wrapper | healthy | 1000 | 52.78 USD | 719 USD | 40.53% | 32,321 USD | 210,074.40 USD |
| Member Health Bond | ship candidate | healthy | 850 | 55.98 USD | 792 USD | 36.80% | 27,830 USD | 147,827.40 USD |
| Full Stack Market Mutual | needs wrapper | healthy | 1500 | 50.24 USD | 623 USD | 35.20% | 38,273 USD | 322,824 USD |
| Flat-Promise Pay-Anything Failure Case | reject | pause | 500 | 27.84 USD | 3,000 USD | 164.81% | 40,494 USD | 62,528 USD |

Main finding:

- "Pay anything" is viable when the amount paid maps to a fixed reserve-gated cap.
- "Pay anything for the same fixed cap promise" fails.
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
- `adjudicate_claim_case`
- `reserve_obligation`
- `settle_claim_case` / `settle_obligation`

Raw medical payloads and oracle review artifacts remain offchain or in adjunct receipt systems. The base chain records claim intake, evidence/decision proof fingerprints, adjudication, reserve effect, and settlement.

The detailed truth-chain walkthrough is in `docs/architecture/genesis-protect-claim-trace.md`.

## Policy and operational boundaries

V1 should include:

- acute-only emergency medical scope
- offchain coverage certificates anchored to active claimant wallet, `PolicySeries`, terms hash, reserve/pool metadata, and premium proof
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
- visa-compliance claims unless a legal insurance wrapper and matching medical evacuation/repatriation benefits are in force
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

- Travel 30 Founder terms frozen for the activated cohort.
- 100-seat Founder cohort metadata published.
- Reserve-indexed cap ladder published and hashable.
- Cap, waiting periods, exclusions, terms hash, reserve snapshot/hash, and quote TTL returned by activation quote.
- Reserve floor and issuance pause logic implemented.
- Opening reserve posted.
- Backstop capital posted or explicitly documented.
- Existing active terms protected from later reserve changes; reserve changes affect only new activations or renewals.
- AI/operator claim intake ready.
- Offchain evidence review path and claim-decision handoff ready.
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
- Travel 30 Founder access as the main offer
- 100 seats at 99 USD
- reserve-indexed target cap up to 250,000 USD
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

This is the fastest credible mainnet path because it ships real reserved access, real activation gates, real claims, and flexible benefit limits without turning launch into a capital-markets release or overstating inactive cover.
