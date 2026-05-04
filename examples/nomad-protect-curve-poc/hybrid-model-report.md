# Hybrid Insurance + Prediction Market Models

Generated: 2026-05-01T00:00:00.000Z

## Decision

A mix is viable, but not as one undifferentiated pool. The first-principles split is:

- Member side: insurance-grade coverage promise with a signed quote, fixed cap, defined window, waiting periods, exclusions, and claims adjudication.
- Market side: prediction/capital mechanism that prices aggregate risk, supplies backstop capital, or distributes surplus, separate from individual claim adjudication.
- Protocol side: reserve gates, p99.5 stress checks, capital release rules, fraud controls, and regulatory wrapper boundaries.

The best product shape is not "prediction market replaces insurance." It is "insurance entitlement plus market-priced risk capital."

## Model Scoreboard

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

## Scale Checks

| Model | Scale | Gate | Members | Backer Capital | Active Cover Limit | p99.5 Claims | Reserve | Reserve / Active Limit |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Separated Backstop Curve | launch scale | healthy | 500 | 60000 | 417497 | 20810 | 108868 | 26.08% |
| Separated Backstop Curve | 3x demand with matching capital | healthy | 1500 | 180000 | 974437 | 42750 | 274681.6 | 28.19% |
| Separated Backstop Curve | 3x demand with launch capital | healthy | 1500 | 60000 | 973672 | 43021 | 154606 | 15.88% |
| Calibrated Pay-Anything Curve | launch scale | healthy | 650 | 70000 | 549980 | 25812 | 128256.8 | 23.32% |
| Calibrated Pay-Anything Curve | 3x demand with matching capital | healthy | 1950 | 210000 | 1231226 | 53967 | 331666.3 | 26.94% |
| Calibrated Pay-Anything Curve | 3x demand with launch capital | healthy | 1950 | 70000 | 1242848 | 53898 | 192980.3 | 15.53% |
| Loss-Ratio Signal Market | launch scale | healthy | 1000 | 120000 | 735500 | 34438 | 195360.4 | 26.56% |
| Loss-Ratio Signal Market | 3x demand with matching capital | healthy | 3000 | 360000 | 1603572 | 72036 | 534990.4 | 33.36% |
| Loss-Ratio Signal Market | 3x demand with launch capital | healthy | 3000 | 120000 | 1617984 | 73077 | 297053.2 | 18.36% |
| Underwriting Prediction Tranche | launch scale | healthy | 1000 | 137576 | 753390 | 33730 | 213044.4 | 28.28% |
| Underwriting Prediction Tranche | 3x demand with matching capital | healthy | 3000 | 267576 | 1632942 | 69797 | 442372 | 27.09% |
| Underwriting Prediction Tranche | 3x demand with launch capital | healthy | 3000 | 137576 | 1652671 | 70315 | 315147.6 | 19.07% |
| Collateralized Sidecar Vault | launch scale | healthy | 1500 | 180000 | 958655 | 42531 | 273148 | 28.49% |
| Collateralized Sidecar Vault | 3x demand with matching capital | healthy | 4500 | 540000 | 2068127 | 88041 | 777835.6 | 37.61% |
| Collateralized Sidecar Vault | 3x demand with launch capital | healthy | 4500 | 180000 | 2029588 | 86655 | 411485.2 | 20.27% |
| Parametric Fast-Cash Overlay | launch scale | healthy | 1200 | 50000 | 300000 | 23250 | 91200 | 30.4% |
| Parametric Fast-Cash Overlay | 3x demand with matching capital | healthy | 3600 | 150000 | 900000 | 63000 | 223600 | 24.84% |
| Parametric Fast-Cash Overlay | 3x demand with launch capital | caution | 3600 | 50000 | 900000 | 63000 | 123600 | 13.73% |
| Member Mutual Rebate Pool | launch scale | healthy | 800 | 85000 | 667107 | 29056 | 152325.2 | 22.83% |
| Member Mutual Rebate Pool | 3x demand with matching capital | healthy | 2400 | 255000 | 1451376 | 59469 | 402936.4 | 27.76% |
| Member Mutual Rebate Pool | 3x demand with launch capital | healthy | 2400 | 85000 | 1470280 | 60305 | 235334 | 16.01% |
| Member Health Bond | launch scale | healthy | 850 | 80000 | 657763 | 27547 | 146574.6 | 22.28% |
| Member Health Bond | 3x demand with matching capital | healthy | 2550 | 240000 | 1483183 | 57051 | 391981 | 26.43% |
| Member Health Bond | 3x demand with launch capital | healthy | 2550 | 80000 | 1491628 | 56738 | 233061 | 15.62% |
| Full Stack Market Mutual | launch scale | healthy | 1500 | 230000 | 950471 | 39031 | 324379.2 | 34.13% |
| Full Stack Market Mutual | 3x demand with matching capital | healthy | 4500 | 410000 | 2005638 | 77618 | 643666.8 | 32.09% |
| Full Stack Market Mutual | 3x demand with launch capital | healthy | 4500 | 230000 | 2021197 | 78555 | 466269.6 | 23.07% |
| Flat-Promise Pay-Anything Failure Case | launch scale | pause | 500 | 25000 | 1500000 | 40611 | 62225.6 | 4.15% |
| Flat-Promise Pay-Anything Failure Case | 3x demand with matching capital | pause | 1500 | 75000 | 4500000 | 98361 | 138512.8 | 3.08% |
| Flat-Promise Pay-Anything Failure Case | 3x demand with launch capital | pause | 1500 | 25000 | 4500000 | 98304 | 87638 | 1.95% |

## Model 1: Separated Backstop Curve

**Verdict:** ship_candidate. **Launch gate:** healthy.

Members buy capped cover from the curve while backers freely supply junior reserve capital.

### Offering

- 30-day acute emergency cover; choose any budget from 15 USD upward; quote returns a fixed cap up to 3000 USD.
- Members modeled: 500.
- Average premium: 55.8 USD.
- Average coverage cap: 872 USD.
- Active coverage limit: 435792 USD.
- Budget range: 15-99 USD.

### Market Design

Prediction-market feeling lives in open backer deposits and visible reserve depth, not in member claim promises.

Production boundary: Insurance-grade member entitlement; market-grade capital supply; no trader decides an individual claim.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 60000 |
| effectiveClaimsCapitalUsd | 60000 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 27900 |
| Expected claims | 12090 |
| Expected loss ratio | 43.33% |
| p95 claims | 17699 |
| p99 claims | 20286 |
| p99.5 claims | 21314 |
| Claims-paying reserve | 110110 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 15810 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.

### Policy Design

- Member policy: choose budget, receive capped quote, activate entitlement.
- Backer policy: deposit any amount into junior backstop capital.
- Issuance rule: pause or reprice when reserve depth falls below target.


## Model 2: Calibrated Pay-Anything Curve

**Verdict:** ship_candidate. **Launch gate:** healthy.

Members can enter with any amount, but the curve converts that amount into an exact capped entitlement.

### Offering

- 30-day acute emergency cover; any budget above 15 USD is accepted and converted into a fixed cap before purchase.
- Members modeled: 650.
- Average premium: 54.22 USD.
- Average coverage cap: 814 USD.
- Active coverage limit: 529171 USD.
- Budget range: 15-99 USD.

### Market Design

The bonding-curve output is coverage capacity, not a token; thin reserves or higher risk quote less cover per dollar.

Production boundary: This is the good pay-anything version: flexible budget, fixed cap, reserve-gated issuance.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 70000 |
| effectiveClaimsCapitalUsd | 70000 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 35246 |
| Expected claims | 15350 |
| Expected loss ratio | 43.55% |
| p95 claims | 21384 |
| p99 claims | 24178 |
| p99.5 claims | 25218 |
| Claims-paying reserve | 126721.4 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 19896 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- Pay-anything is viable when the curve converts every dollar into an exact cap using current reserve depth.
- The member budget is flexible, but the coverage promise is not flexible after purchase.

### Policy Design

- Member policy: pay any amount above the floor and receive a signed, fixed cap from the curve.
- Pricing rule: the same 15 USD buys less cover when reserve depth is thin or cohort risk is higher.
- Issuance rule: no entitlement mints unless p99.5 and reserve-floor gates pass after the quote.


## Model 3: Loss-Ratio Signal Market

**Verdict:** needs_wrapper. **Launch gate:** healthy.

Members still buy capped insurance; traders separately price whether the pool loss ratio breaches a threshold.

### Offering

- Same 30-day acute cover, with the pool quote curve nudged by a public aggregate-loss signal.
- Members modeled: 1000.
- Average premium: 54.71 USD.
- Average coverage cap: 723 USD.
- Active coverage limit: 722746 USD.
- Budget range: 15-99 USD.

### Market Design

A yes/no market on aggregate loss ratio above 65%; it produces a pricing signal but does not pay claims.

Production boundary: The event market must settle on aggregate pool data only and be legally separate from the insurance promise.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 120000 |
| effectiveClaimsCapitalUsd | 120000 |
| eventThresholdLossRatioPct | 65 |
| thresholdClaimsUsd | 35560.2 |
| fairProbabilityPct | 0.21 |
| marketProbabilityPct | 3.71 |
| yesPriceCents | 3.71 |
| liquidityUsd | 75000 |
| quoteAdjustmentPct | 0.7 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 54708 |
| Expected claims | 22865 |
| Expected loss ratio | 41.79% |
| p95 claims | 29884 |
| p99 claims | 33141 |
| p99.5 claims | 34301 |
| Claims-paying reserve | 194237.2 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 31843 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- A prediction market is useful when it predicts aggregate pool risk instead of individual claim validity.
- The event must be objective: for example, pool loss ratio above a published threshold after claim close.

### Policy Design

- Member policy: fixed 30-day acute emergency entitlement with signed quote receipt.
- Market contract: aggregate pool loss ratio above threshold, settled after claim runout.
- Claims boundary: AI processors and operators handle claims offchain; market data is aggregate only.

### Notes

- Prediction market is modeled as a pricing and monitoring signal unless collateral is explicitly locked into a claims tranche.

## Model 4: Underwriting Prediction Tranche

**Verdict:** needs_wrapper. **Launch gate:** healthy.

Predictors stake on aggregate pool risk, and a defined share of that stake becomes junior claims capital.

### Offering

- Same 30-day acute cover from the quote curve; members never interact with individual claim markets.
- Members modeled: 1000.
- Average premium: 52.78 USD.
- Average coverage cap: 719 USD.
- Active coverage limit: 718859 USD.
- Budget range: 15-99 USD.

### Market Design

Predictors forecast whether cohort loss ratio breaches a threshold; correct predictors earn yield, fees, surplus, and wrong-side penalties after claims gates.

Production boundary: Prediction collateral counts as reserve only for the explicitly locked claims tranche.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 65000 |
| effectiveClaimsCapitalUsd | 137576 |
| totalPredictionCollateralUsd | 100800 |
| predictionClaimsTrancheUsd | 72576 |
| traderPayoutLiabilityUsd | 28224 |
| eventThresholdLossRatioPct | 60 |
| fairThresholdProbabilityPct | 0.77 |
| signalAccuracyPct | 61 |
| rewardPoolBeforeWrongStakeUsd | 8088.24 |
| wrongStakePenaltyPoolUsd | 11007.36 |
| expectedCorrectPredictorRoiPct | 31.06 |
| expectedWrongPredictorPenaltyPct | 28 |
| rewardFunding | reserve_yield_plus_pricing_fees_plus_surplus_plus_wrong_stake_penalties_after_claims |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 52776 |
| Expected claims | 21392 |
| Expected loss ratio | 40.53% |
| p95 claims | 28172 |
| p99 claims | 31240 |
| p99.5 claims | 32321 |
| Claims-paying reserve | 210074.4 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 31384 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- Prediction collateral can count as claims capital only for the slice explicitly locked into the claims waterfall.
- Correct predictors should earn from yield, fees, surplus, and wrong-side penalties only after claims reserves clear.

### Policy Design

- Member policy: same capped acute cover.
- Market policy: predictors stake on aggregate loss-ratio bands; a fixed share of stake is posted as junior claims capital.
- Reward rule: correct predictors earn only after claims, reserve margin, and capital replenishment are satisfied.

### Notes

- 72576 USD of predictor collateral is treated as junior claims capital; 28224 USD remains trader payout liability.
- Correct predictors are paid only after claims, reserve margin, and capital replenishment gates clear.

## Model 5: Collateralized Sidecar Vault

**Verdict:** needs_wrapper. **Launch gate:** healthy.

Backers buy tranche-like risk shares that absorb pool losses in a transparent waterfall.

### Offering

- 30-day acute cover sold through the same quote curve; capacity expands when tranche capital clears.
- Members modeled: 1500.
- Average premium: 52.48 USD.
- Average coverage cap: 658 USD.
- Active coverage limit: 986327 USD.
- Budget range: 15-99 USD.

### Market Design

Capital-market sidecar: junior and senior backers earn premium share for absorbing modeled claim volatility.

Production boundary: Closest to insurance-linked securities or collateralized reinsurance; requires strong offering restrictions.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 180000 |
| effectiveClaimsCapitalUsd | 180000 |
| trancheCount | 3 |
| juniorExpectedLossPct | 0.65 |
| seniorExpectedLossPct | 0 |
| maxTrancheP995LossPct | 100 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 78720 |
| Expected claims | 30362 |
| Expected loss ratio | 38.57% |
| p95 claims | 38214 |
| p99 claims | 41816 |
| p99.5 claims | 43163 |
| Claims-paying reserve | 275848 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 48358 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- Backers should know exactly which layer of loss they absorb and when their capital can be released.
- This is a capital-markets wrapper around insurance risk, not consumer gambling.

### Policy Design

- Member policy: same capped acute cover.
- Capital policy: first-loss sponsor layer, junior sidecar layer, senior sidecar layer.
- Release rule: capital unlocks only after claim runout, dispute window, and reserve reconciliation.

### Notes

- Sponsor first loss: attaches at 0 USD, expected loss 85.55%, p99.5 impairment 100%.
- Junior sidecar: attaches at 35000 USD, expected loss 0.65%, p99.5 impairment 12.56%.
- Senior sidecar: attaches at 100000 USD, expected loss 0%, p99.5 impairment 0%.

## Model 6: Parametric Fast-Cash Overlay

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
| baseRiskBackerCapitalUsd | 50000 |
| effectiveClaimsCapitalUsd | 50000 |
| triggerFrequencyPct | 5.98 |
| benefitUsd | 250 |
| premiumPerMemberUsd | 15 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 18000 |
| Expected claims | 17932 |
| Expected loss ratio | 99.62% |
| p95 claims | 21250 |
| p99 claims | 22750 |
| p99.5 claims | 23250 |
| Claims-paying reserve | 91200 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 68 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- A fixed benefit is easier to price than open-ended reimbursement, but creates basis risk for members.
- The trigger must be independently verifiable and hard to manipulate.

### Policy Design

- Member policy: small fixed cash benefit for a named urgent-care or ER trigger.
- Claim rule: verified trigger pays fixed benefit without itemized bill reimbursement.
- Disclosure: fast cash may be less than the medical bill and is not full health cover.

### Notes

- Parametric benefit pays fast, but may underpay or overpay relative to the actual medical bill.

## Model 7: Member Mutual Rebate Pool

**Verdict:** ship_candidate. **Launch gate:** healthy.

Members buy capped cover and receive surplus rebates when the cohort has a good claims month.

### Offering

- 30-day capped cover with visible cohort economics; expected surplus funds member rebates and backer yield.
- Members modeled: 800.
- Average premium: 56.4 USD.
- Average coverage cap: 807 USD.
- Active coverage limit: 645639 USD.
- Budget range: 15-99 USD.

### Market Design

The market element is a transparent surplus/rebate scoreboard, not speculative trading on claims.

Production boundary: More consumer-friendly than a prediction market; still needs insurance-grade claim handling and rebate rules.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 85000 |
| effectiveClaimsCapitalUsd | 85000 |
| memberRebatePoolUsd | 9507.75 |
| expectedRebatePerMemberUsd | 11.88 |
| backerSurplusSharePct | 45 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 45120 |
| Expected claims | 17955 |
| Expected loss ratio | 39.79% |
| p95 claims | 24408 |
| p99 claims | 27295 |
| p99.5 claims | 28453 |
| Claims-paying reserve | 150608 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 27165 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- Members can share upside from good claims experience without betting against sick members.
- Rebates should be discretionary surplus distributions after reserves are satisfied.

### Policy Design

- Member policy: capped acute cover plus possible end-of-window surplus rebate.
- Rebate rule: paid only after p99.5 reserve, claims runout, and fraud holds are cleared.
- Backer rule: backers earn a defined surplus share before protocol margin.

### Notes

- Rebate is modeled only from expected surplus; production would pay it after claim runout and reserve lock.

## Model 8: Member Health Bond

**Verdict:** ship_candidate. **Launch gate:** healthy.

Members can back themselves to avoid claims through an optional no-claim bond and rebate.

### Offering

- 30-day capped acute cover plus optional health bond; no claim returns the bond and can earn a small rebate.
- Members modeled: 850.
- Average premium: 55.98 USD.
- Average coverage cap: 792 USD.
- Active coverage limit: 673322 USD.
- Budget range: 15-99 USD.

### Market Design

The member is not betting to become sick; the bond reduces moral hazard and claim cost if a claim occurs.

Production boundary: The bond is a member-aligned deductible/rebate layer, not a speculative market on individual sickness.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 80000 |
| effectiveClaimsCapitalUsd | 80000 |
| healthBondAdoptedMembers | 357 |
| lockedHealthBondUsd | 35700 |
| perClaimForfeitureUsd | 70 |
| modeledFrequencyReductionPct | 4.2 |
| expectedBondForfeitureUsd | 938.46 |
| noClaimRewardPoolUsd | 5413.32 |
| expectedNoClaimRewardPerHealthyStakerUsd | 15.76 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 47586 |
| Expected claims | 17512 |
| Expected loss ratio | 36.8% |
| p95 claims | 23880 |
| p99 claims | 26691 |
| p99.5 claims | 27830 |
| Claims-paying reserve | 147827.4 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 30074 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- A member can back themselves to avoid claims through a no-claim bond without profiting from being sick.
- The bond should reduce net claim cost through forfeiture or deductible mechanics, not replace the coverage promise.

### Policy Design

- Member policy: capped cover plus optional no-claim bond.
- Bond rule: no claim returns bond plus rebate; a covered claim forfeits the agreed amount into the pool.
- Safety rule: members cannot buy uncapped upside from becoming sick.

### Notes

- Health bonds are modeled as claim-cost mitigation and no-claim rebates, not as a way to profit from illness.

## Model 9: Full Stack Market Mutual

**Verdict:** needs_wrapper. **Launch gate:** healthy.

Combines pay-anything coverage, sidecar reserve, predictor collateral, and optional member health bonds.

### Offering

- Any budget above 15 USD quotes capped acute cover; members can optionally stake a no-claim bond.
- Members modeled: 1500.
- Average premium: 50.24 USD.
- Average coverage cap: 623 USD.
- Active coverage limit: 934724 USD.
- Budget range: 15-99 USD.

### Market Design

Backers and predictors supply junior claims capital; correct predictors are paid from yield, fees, surplus, and wrong-side penalties after reserves clear.

Production boundary: Best long-term design, but only production-safe if reward and reserve waterfalls are separated in accounting.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 90000 |
| effectiveClaimsCapitalUsd | 230000 |
| totalPredictionCollateralUsd | 200000 |
| predictionClaimsTrancheUsd | 140000 |
| traderPayoutLiabilityUsd | 60000 |
| eventThresholdLossRatioPct | 58 |
| fairThresholdProbabilityPct | 0 |
| signalAccuracyPct | 63 |
| rewardPoolBeforeWrongStakeUsd | 11460.72 |
| wrongStakePenaltyPoolUsd | 22200 |
| expectedCorrectPredictorRoiPct | 26.71 |
| expectedWrongPredictorPenaltyPct | 30 |
| rewardFunding | reserve_yield_plus_pricing_fees_plus_surplus_plus_wrong_stake_penalties_after_claims |
| healthBondAdoptedMembers | 570 |
| lockedHealthBondUsd | 57000 |
| perClaimForfeitureUsd | 70 |
| modeledFrequencyReductionPct | 3.42 |
| expectedBondForfeitureUsd | 1541.42 |
| noClaimRewardPoolUsd | 6836.76 |
| expectedNoClaimRewardPerHealthyStakerUsd | 12.48 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 75360 |
| Expected claims | 26526 |
| Expected loss ratio | 35.2% |
| p95 claims | 33882 |
| p99 claims | 37006 |
| p99.5 claims | 38273 |
| Claims-paying reserve | 322824 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 0 |
| Expected surplus | 48834 |

### First Principles

- A member promise must be fixed before the loss happens: named scope, window, cap, waits, and exclusions.
- Claims stay in the AI/operator evidence workflow; markets price aggregate pool risk and reserve capacity.
- Capacity is sold only while claims-paying reserve clears both stochastic loss and reserve-floor gates.
- The strongest architecture combines flexible member pricing, explicit junior capital, predictor scoring, and no-claim incentives.
- The UI can stay simple while the protocol separately accounts for reserve, market collateral, and member bond economics.

### Policy Design

- Member policy: pay-anything quote curve plus optional no-claim bond.
- Capital policy: sidecar and prediction collateral form explicit junior reserve layers.
- Settlement policy: claims first, reserve margin second, capital replenishment third, predictor/member rewards fourth.

### Notes

- 140000 USD of predictor collateral is treated as junior claims capital; 60000 USD remains trader payout liability.
- Correct predictors are paid only after claims, reserve margin, and capital replenishment gates clear.
- Health bonds are modeled as claim-cost mitigation and no-claim rebates, not as a way to profit from illness.

## Model 10: Flat-Promise Pay-Anything Failure Case

**Verdict:** reject. **Launch gate:** pause.

Bad curve red-team case: everyone pays any amount and receives the same broad cover promise.

### Offering

- Any payment from 15 USD upward is treated as full 3000 USD acute cover.
- Members modeled: 500.
- Average premium: 27.84 USD.
- Average coverage cap: 3000 USD.
- Active coverage limit: 1500000 USD.
- Budget range: 15-99 USD.

### Market Design

Feels viral but collapses pricing: low-budget members buy the same liability as high-budget members.

Production boundary: Use only as a red-team failure case; pay-anything must be calibrated into a fixed cap.

| Market Field | Value |
| --- | ---: |
| baseRiskBackerCapitalUsd | 25000 |
| effectiveClaimsCapitalUsd | 25000 |
| promisedCapUsd | 3000 |
| averagePremiumRatePct | 0.93 |

### Actuarial Output

| Metric | Value |
| --- | ---: |
| Gross premium | 13920 |
| Expected claims | 22942 |
| Expected loss ratio | 164.81% |
| p95 claims | 33551 |
| p99 claims | 38437 |
| p99.5 claims | 40494 |
| Claims-paying reserve | 62528 |
| Reserve breach probability | 0 |
| Extra p99.5 reserve needed | 0 |
| Extra reserve-floor capital needed | 162472 |
| Expected surplus | -9022 |

### First Principles

- This failure case is a bad curve: every budget receives the same liability, so premium no longer tracks risk.
- A viral pool is not the same thing as a solvent insurance product.
- Pay-anything can work only when the amount paid maps to a fixed, reserve-gated cap before activation.

### Policy Design

- Do not ship this flat-promise version.
- Use it only as a red-team case proving that the curve must bind budget to cap.
- Never represent arbitrary payment as broad 3000 USD cover unless that cap is actually priced and reserved.

### Notes

- This intentionally fails because pricing is no longer risk-proportional.


## Simple Language Summary

1. Pay-anything can work if the curve converts every budget into an exact cap before purchase.
2. The bad version is not "pay anything." The bad version is "pay anything and receive the same 3000 USD promise."
3. Predictor collateral can support claims when a defined slice is locked into the junior claims tranche.
4. Correct predictors can be paid from reserve yield, pricing fees, surplus, and wrong-side penalties after claims and reserve gates clear.
5. A member can back themselves through a no-claim health bond. That should reward staying healthy, not create uncapped upside from being sick.
6. The full-stack model is the most powerful, but the production accounting must separate claims reserve, trader payout liability, predictor rewards, and member rebates.

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
