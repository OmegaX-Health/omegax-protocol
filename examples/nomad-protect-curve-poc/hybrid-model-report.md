# Hybrid Insurance + Prediction Market Models

Generated: 2026-05-01T00:00:00.000Z

## Decision

A mix is viable, but not as one undifferentiated pool. The first-principles split is:

- Member side: insurance-grade coverage promise with a signed quote, fixed cap, defined window, waiting periods, exclusions, and claims adjudication.
- Market side: prediction/capital mechanism that prices aggregate risk, supplies backstop capital, or distributes surplus, without deciding individual claims.
- Protocol side: reserve gates, p99.5 stress checks, capital release rules, fraud controls, and regulatory wrapper boundaries.

The best product shape is not "prediction market replaces insurance." It is "insurance entitlement plus market-priced risk capital."

## Model Scoreboard

| Model | Verdict | Gate | Members | Avg Premium | Avg Cap | Expected Loss Ratio | p99.5 Claims | Reserve |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Separated Backstop Curve | ship_candidate | healthy | 500 | 65.88 | 1001 | 37.94% | 22626 | 114646 |
| Loss-Ratio Signal Market | needs_wrapper | healthy | 1000 | 63.32 | 809 | 36.93% | 36087 | 201991.6 |
| Collateralized Sidecar Vault | needs_wrapper | healthy | 1500 | 59.84 | 723 | 34.27% | 44438 | 285782.15 |
| Parametric Fast-Cash Overlay | ship_candidate | healthy | 1200 | 15 | 250 | 99.72% | 23250 | 91200 |
| Member Mutual Rebate Pool | ship_candidate | healthy | 800 | 67.17 | 925 | 34.82% | 30344 | 158361.68 |
| Pure Pay-Anything Pool | reject | pause | 500 | 29.5 | 3000 | 155.59% | 40431 | 63273.2 |

## Scale Checks

| Model | Scale | Gate | Members | Backer Capital | Active Cover Limit | p99.5 Claims | Reserve | Reserve / Active Limit |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Separated Backstop Curve | launch scale | healthy | 500 | 60000 | 472397 | 21950 | 112647.99 | 23.85% |
| Separated Backstop Curve | 3x demand with matching capital | healthy | 1500 | 180000 | 1095641 | 44670 | 286939.08 | 26.19% |
| Separated Backstop Curve | 3x demand with launch capital | healthy | 1500 | 60000 | 1073115 | 44487 | 164595.37 | 15.34% |
| Loss-Ratio Signal Market | launch scale | healthy | 1000 | 120000 | 828965 | 36352 | 203881.6 | 24.59% |
| Loss-Ratio Signal Market | 3x demand with matching capital | healthy | 3000 | 360000 | 1764929 | 74750 | 558836.8 | 31.66% |
| Loss-Ratio Signal Market | 3x demand with launch capital | healthy | 3000 | 120000 | 1783717 | 75276 | 321731.2 | 18.04% |
| Collateralized Sidecar Vault | launch scale | healthy | 1500 | 180000 | 1094107 | 44381 | 286777.6 | 26.21% |
| Collateralized Sidecar Vault | 3x demand with matching capital | healthy | 4500 | 540000 | 2261817 | 90635 | 811260.16 | 35.87% |
| Collateralized Sidecar Vault | 3x demand with launch capital | healthy | 4500 | 180000 | 2278342 | 90781 | 454231.01 | 19.94% |
| Parametric Fast-Cash Overlay | launch scale | healthy | 1200 | 50000 | 300000 | 23250 | 91200 | 30.4% |
| Parametric Fast-Cash Overlay | 3x demand with matching capital | healthy | 3600 | 150000 | 900000 | 63000 | 223600 | 24.84% |
| Parametric Fast-Cash Overlay | 3x demand with launch capital | caution | 3600 | 50000 | 900000 | 63000 | 123600 | 13.73% |
| Member Mutual Rebate Pool | launch scale | healthy | 800 | 85000 | 714600 | 29795 | 156212.4 | 21.86% |
| Member Mutual Rebate Pool | 3x demand with matching capital | healthy | 2400 | 255000 | 1610653 | 61594 | 423811.66 | 26.31% |
| Member Mutual Rebate Pool | 3x demand with launch capital | healthy | 2400 | 85000 | 1600204 | 61547 | 252398 | 15.77% |
| Pure Pay-Anything Pool | launch scale | pause | 500 | 25000 | 1500000 | 40270 | 62711.6 | 4.18% |
| Pure Pay-Anything Pool | 3x demand with matching capital | pause | 1500 | 75000 | 4500000 | 98617 | 140867.2 | 3.13% |
| Pure Pay-Anything Pool | 3x demand with launch capital | pause | 1500 | 25000 | 4500000 | 97810 | 91191.2 | 2.03% |

## Model 1: Separated Backstop Curve

**Verdict:** ship_candidate. **Launch gate:** healthy.

Members buy capped cover from the curve while backers freely supply junior reserve capital.

### Offering

- 30-day acute emergency cover; choose any budget from 15 USD upward; quote returns a fixed cap up to 3000 USD.
- Members modeled: 500.
- Average premium: 65.88 USD.
- Average coverage cap: 1001 USD.
- Active coverage limit: 500538 USD.
- Budget range: 15-159 USD.

### Market Design

Prediction-market feeling lives in open backer deposits and visible reserve depth, not in member claim promises.

Production boundary: Insurance-grade member entitlement; market-grade capital supply; no trader decides an individual claim.

| Market Field | Value |
| --- | ---: |
| riskBackerCapitalUsd | 60000 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 32940 |
| Expected claims | 12497 |
| Expected loss ratio | 37.94% |
| p95 claims | 18583 |
| p99 claims | 21536 |
| p99.5 claims | 22626 |
| Claims-paying reserve | 114646 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 20443 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Risk capital can be market-priced, but claims cannot be crowdsourced popularity contests.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.

### Policy Design

- Member policy: choose budget, receive capped quote, activate entitlement.
- Backer policy: deposit any amount into junior backstop capital.
- Issuance rule: pause or reprice when reserve depth falls below target.


## Model 2: Loss-Ratio Signal Market

**Verdict:** needs_wrapper. **Launch gate:** healthy.

Members still buy capped insurance; traders separately price whether the pool loss ratio breaches a threshold.

### Offering

- Same 30-day acute cover, with the pool quote curve nudged by a public aggregate-loss signal.
- Members modeled: 1000.
- Average premium: 63.32 USD.
- Average coverage cap: 809 USD.
- Active coverage limit: 808718 USD.
- Budget range: 15-159 USD.

### Market Design

A yes/no market on aggregate loss ratio above 65%; it produces a pricing signal but does not pay claims.

Production boundary: The event market must settle on aggregate pool data only and be legally separate from the insurance promise.

| Market Field | Value |
| --- | ---: |
| riskBackerCapitalUsd | 120000 |
| eventThresholdLossRatioPct | 65 |
| thresholdClaimsUsd | 41160.6 |
| fairProbabilityPct | 0.01 |
| marketProbabilityPct | 3.51 |
| yesPriceCents | 3.51 |
| liquidityUsd | 75000 |
| quoteAdjustmentPct | 0.7 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 63324 |
| Expected claims | 23386 |
| Expected loss ratio | 36.93% |
| p95 claims | 30944 |
| p99 claims | 34650 |
| p99.5 claims | 36087 |
| Claims-paying reserve | 201991.6 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 39938 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Risk capital can be market-priced, but claims cannot be crowdsourced popularity contests.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- A prediction market is useful as an aggregate signal only if it cannot alter individual claim outcomes.
- The event must be objective: for example, pool loss ratio above a published threshold after claim close.

### Policy Design

- Member policy: fixed 30-day acute emergency entitlement with signed quote receipt.
- Market contract: aggregate pool loss ratio above threshold, settled after claim runout.
- Firewall: market traders cannot approve, deny, delay, or see raw member medical evidence.

### Notes

- Prediction market is modeled as a pricing and monitoring signal, not as claims-paying capital.

## Model 3: Collateralized Sidecar Vault

**Verdict:** needs_wrapper. **Launch gate:** healthy.

Backers buy tranche-like risk shares that absorb pool losses in a transparent waterfall.

### Offering

- 30-day acute cover sold through the same quote curve; capacity expands when tranche capital clears.
- Members modeled: 1500.
- Average premium: 59.84 USD.
- Average coverage cap: 723 USD.
- Active coverage limit: 1084538 USD.
- Budget range: 15-159 USD.

### Market Design

Capital-market sidecar: junior and senior backers earn premium share for absorbing modeled claim volatility.

Production boundary: Closest to insurance-linked securities or collateralized reinsurance; requires strong offering restrictions.

| Market Field | Value |
| --- | ---: |
| riskBackerCapitalUsd | 180000 |
| trancheCount | 3 |
| juniorExpectedLossPct | 0.9 |
| seniorExpectedLossPct | 0 |
| maxTrancheP995LossPct | 100 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 89757.94 |
| Expected claims | 30758 |
| Expected loss ratio | 34.27% |
| p95 claims | 39266 |
| p99 claims | 42891 |
| p99.5 claims | 44438 |
| Claims-paying reserve | 285782.15 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 59000 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Risk capital can be market-priced, but claims cannot be crowdsourced popularity contests.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- Backers should know exactly which layer of loss they absorb and when their capital can be released.
- This is a capital-markets wrapper around insurance risk, not consumer gambling.

### Policy Design

- Member policy: same capped acute cover.
- Capital policy: first-loss sponsor layer, junior sidecar layer, senior sidecar layer.
- Release rule: capital unlocks only after claim runout, dispute window, and reserve reconciliation.

### Notes

- Sponsor first loss: attaches at 0 USD, expected loss 86.21%, p99.5 impairment 100%.
- Junior sidecar: attaches at 35000 USD, expected loss 0.9%, p99.5 impairment 14.52%.
- Senior sidecar: attaches at 100000 USD, expected loss 0%, p99.5 impairment 0%.

## Model 4: Parametric Fast-Cash Overlay

**Verdict:** ship_candidate. **Launch gate:** healthy.

A small fixed cash benefit pays quickly when an independently verifiable acute event trigger fires.

### Offering

- 15 USD buys a 250 USD fast-cash benefit for ER admission or qualifying urgent-care trigger.
- Members modeled: 1200.
- Average premium: 15 USD.
- Average coverage cap: 250 USD.
- Active coverage limit: 300000 USD.
- Budget range: 15-15 USD.

### Market Design

Backers price trigger frequency instead of open-ended medical bills; settlement is faster but has basis risk.

Production boundary: Can sit beside indemnity cover; trigger design must be explicit and not pretend to reimburse all losses.

| Market Field | Value |
| --- | ---: |
| riskBackerCapitalUsd | 50000 |
| triggerFrequencyPct | 5.98 |
| benefitUsd | 250 |
| premiumPerMemberUsd | 15 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 18000 |
| Expected claims | 17949 |
| Expected loss ratio | 99.72% |
| p95 claims | 21250 |
| p99 claims | 22750 |
| p99.5 claims | 23250 |
| Claims-paying reserve | 91200 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 51 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Risk capital can be market-priced, but claims cannot be crowdsourced popularity contests.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- A fixed benefit is easier to price than open-ended reimbursement, but creates basis risk for members.
- The trigger must be independently verifiable and hard to manipulate.

### Policy Design

- Member policy: small fixed cash benefit for a named urgent-care or ER trigger.
- Claim rule: verified trigger pays fixed benefit without itemized bill reimbursement.
- Disclosure: fast cash may be less than the medical bill and is not full health cover.

### Notes

- Parametric benefit pays fast, but may underpay or overpay relative to the actual medical bill.

## Model 5: Member Mutual Rebate Pool

**Verdict:** ship_candidate. **Launch gate:** healthy.

Members buy capped cover and receive surplus rebates when the cohort has a good claims month.

### Offering

- 30-day capped cover with visible cohort economics; expected surplus funds member rebates and backer yield.
- Members modeled: 800.
- Average premium: 67.17 USD.
- Average coverage cap: 925 USD.
- Active coverage limit: 740235 USD.
- Budget range: 15-159 USD.

### Market Design

The market element is a transparent surplus/rebate scoreboard, not speculative trading on claims.

Production boundary: More consumer-friendly than a prediction market; still needs insurance-grade claim handling and rebate rules.

| Market Field | Value |
| --- | ---: |
| riskBackerCapitalUsd | 85000 |
| memberRebatePoolUsd | 12259.45 |
| expectedRebatePerMemberUsd | 15.32 |
| backerSurplusSharePct | 45 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 53735.2 |
| Expected claims | 18708 |
| Expected loss ratio | 34.82% |
| p95 claims | 25677 |
| p99 claims | 29168 |
| p99.5 claims | 30344 |
| Claims-paying reserve | 158361.68 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 35027 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Risk capital can be market-priced, but claims cannot be crowdsourced popularity contests.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- Members can share upside from good claims experience without betting against sick members.
- Rebates should be discretionary surplus distributions after reserves are satisfied.

### Policy Design

- Member policy: capped acute cover plus possible end-of-window surplus rebate.
- Rebate rule: paid only after p99.5 reserve, claims runout, and fraud holds are cleared.
- Backer rule: backers earn a defined surplus share before protocol margin.

### Notes

- Rebate is modeled only from expected surplus; production would pay it after claim runout and reserve lock.

## Model 6: Pure Pay-Anything Pool

**Verdict:** reject. **Launch gate:** pause.

Everyone pays any amount and receives the same broad cover promise.

### Offering

- Any payment from 15 USD upward is treated as full 3000 USD acute cover.
- Members modeled: 500.
- Average premium: 29.5 USD.
- Average coverage cap: 3000 USD.
- Active coverage limit: 1500000 USD.
- Budget range: 15-159 USD.

### Market Design

Feels viral but collapses pricing: low-budget members buy the same liability as high-budget members.

Production boundary: Use only as a red-team failure case; do not ship this as insurance.

| Market Field | Value |
| --- | ---: |
| riskBackerCapitalUsd | 25000 |
| promisedCapUsd | 3000 |
| averagePremiumRatePct | 0.98 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 14748 |
| Expected claims | 22946 |
| Expected loss ratio | 155.59% |
| p95 claims | 33601 |
| p99 claims | 38502 |
| p99.5 claims | 40431 |
| Claims-paying reserve | 63273.2 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 161727 |
| Expected surplus | -8198 |

### First Principles

- If every budget receives the same liability, low-budget demand dominates and premium no longer tracks risk.
- A viral pool is not the same thing as a solvent insurance product.
- The failure is structural, not a tuning problem.

### Policy Design

- Do not ship.
- If used as an onboarding metaphor, immediately convert payment into a capped quote before activation.
- Never represent arbitrary payment as broad, uncapped health insurance.

### Notes

- This intentionally fails because pricing is no longer risk-proportional.


## Simple Language Summary

1. The cleanest viable version is: users buy capped cover; backers can deposit any amount; the curve adjusts how much cover a budget buys.
2. A prediction market can help if it predicts aggregate pool losses, reserve stress, or backer pricing. It should not vote on whether Josip's hospital bill gets paid.
3. The sidecar vault is the most finance-native model. It can scale capital, but it needs the strongest legal wrapper.
4. Parametric fast cash is the simplest consumer product: 15 USD buys a small fixed payout if a clear trigger happens. It is fast, but not full health insurance.
5. Mutual rebates are friendlier than speculation: members get upside when the month is healthy, after reserves are safe.
6. The pure pay-anything pool fails. It grows fast in a pitch, then breaks because the same 3000 USD promise is sold for 15 USD and 159 USD.

## Source Notes

- NAIC risk-based capital: insurers should hold capital in proportion to size and risk, and capital requirements exist so policyholder promises can be paid.
- NAIC consumer health guidance: health insurance is a premium-for-benefits arrangement, not a promise that every bill is fully paid.
- CFTC prediction-market guidance: event contracts are generally yes/no or outcome-linked contracts whose prices express perceived probabilities; regulated markets are expected to be neutral platforms, not counterparties taking the other side of users.
- CFTC 2026 prediction-market releases: the event-contract framework is actively evolving, so any real deployment needs current legal review.

## Sources

- NAIC Risk-Based Capital: https://content.naic.org/insurance-topics/risk-based-capital
- NAIC Health Insurance Consumer Guide: https://content.naic.org/consumer/health-insurance.htm
- CFTC Prediction Markets and Event Contracts: https://www.cftc.gov/LearnandProtect/PredictionMarkets
- CFTC Prediction Markets Advisory, March 12, 2026: https://www.cftc.gov/PressRoom/PressReleases/9193-26
- CFTC Prediction Markets ANPRM, March 12, 2026: https://www.cftc.gov/PressRoom/PressReleases/9194-26

## Limits

- This is a product-design and actuarial PoC, not an external actuarial opinion.
- The model tests whether a low-budget quote curve can coexist with reserve-aware pricing and open risk-backer deposits.
- Risk-backer deposits are modeled as junior/backstop reserve capital; they are not treated as member coverage purchases.
- The member quote curve is an issuance and pricing model, not a commitment to offer blind pay-anything insurance.
- Backer yield outputs are simple one-window surplus-share diagnostics, not promised returns.
- Severity distributions are synthetic and should be replaced with credible paid-claim data before production.
