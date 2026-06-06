# Genesis Protect Acute v1 — Full Protect Flow (Operational)

> **Version**: 1.0  
> **Author**: Manuel Soldatini — Protocol Verification & Claims  
> **Status**: Draft — Internal  
> **Date**: May 2026  
> **Scope**: End-to-end operational flow from member onboarding through Phase 0 member payout, with provider settlement noted as a Phase 1 target.
> This document is the **operational complement** to the onchain truth chain.
> The onchain truth chain (what changes on Solana at each step) is documented separately in
> [`genesis-protect-claim-trace.md`](./genesis-protect-claim-trace.md).  
> The claims-processing specification (evidence requirements, fraud flags, escalation rules) is in
> [`genesis-protect-acute-claims-processing-spec.md`](./genesis-protect-acute-claims-processing-spec.md).

---

## How to Read This Document

The founder's `genesis-protect-claim-trace.md` answers: *"what changes onchain at each step?"*

This document answers: *"what do the member, operator, oracle, and AI-assisted review tools do at each step,
in what sequence, with what internal operating target, and what happens when things go wrong?"*

Together they form the complete picture of the Genesis Protect Acute claim lifecycle — technical
truth chain on one side, operational workflow on the other.

Travel 30 Founder reservations are not active cover. The first 100-seat Founder cohort targets a
reserve-indexed cap up to $250,000 only when posted claims-paying reserve/backstop proof supports
it before activation. This flow begins once a member activates cover and receives a quote receipt
with exact cap, terms hash, reserve snapshot, waiting periods, exclusions, and quote expiry.

---

## 1. Overview: The Protect Flow in One View

```
MEMBER JOURNEY                    OPERATOR / ORACLE WORKFLOW               ONCHAIN EVENTS
──────────────                    ──────────────────────────               ──────────────
1. Onboarding & activation   ───► Policy series check + premium           PolicySeries,
   (wallet + USDC payment)         confirmation                             record_premium_payment

2. Incident occurs           ───► [no operator action at this stage]       —

3. Evidence upload           ───► Oracle portal receipt + auto-checks       —  (offchain)
   (oracle portal)                 (completeness, format, language)

4. Claim intake              ───► Operator opens ClaimCase                  open_claim_case
                                   (or member self-submits)

5. Automated review          ───► AI pre-screening of documents             —  (offchain)
   (AI pre-screening)              Flags anomalies → operator queue

6. Human review trigger      ───► Operator receives flagged or              —  (offchain)
                                   standard review item in queue

7. Evidence review          ───► Offchain or adjunct review artifact        —
   (standard or MagicBlock)        supports the operator decision

8. Adjudication              ───► Operator approves/denies +                adjudicate_claim_case
                                   tier classification                       obligation → reserved

9. Reserve booking           ───► Obligation reserved against               reserve_obligation
                                   FundingLine

10. Payout / Settlement      ───► Asset rail selected → USDC                settle_claim_case /
                                   (or fallback) transferred                  settle_obligation

11. Provider settlement      ───► Direct provider payment workflow           —  (Phase 1 target)
    (Phase 0: member wallet)       (Phase 0: member receives funds)
```

---

## 2. Stage 1 — Member Onboarding and Policy Mint

### 2.1 Member actions

1. Member connects wallet to the OmegaX Health portal (or Breakpoint registration flow).
2. Member selects a product SKU: **Event 7** ($39 / 7 days) or activates reserved **Travel 30** Founder access ($99 / 30 days; exact cap locked at activation).
3. Member reviews coverage terms and exclusion schedule (Phase 0: mandatory pre-sign review via
   `protocol-transaction-review` frontend component).
4. Member pays premium in USDC — the `record_premium_payment` instruction is executed.
5. OmegaX Health records the activated coverage window offchain and keeps the claimant wallet bound to the issued terms.

### 2.2 Operator checks at onboarding

| Check | How it is enforced |
|---|---|
| Reserve pool has sufficient capacity | Frontend reads `FundingLine.free_balance` — mint is blocked if VaR 99.5% ceiling would be breached |
| Policy series is not paused | `HealthPlan.emergency_pause == false` — protocol-enforced |
| Member wallet not on sanctions list | Offchain pre-mint check by oracle service before `record_premium_payment` is submitted |
| Venue cap (Event 7 only) | Operator monitors per-venue policy count — hard cap of 50 policies per named event/venue |

### 2.3 What the member receives

- Solana wallet confirmation for the premium-payment transaction
- Coverage window start and end dates
- Summary of benefit schedule and exclusion categories
- Link to oracle portal for claim submission

**Internal target**: onboarding is automated, and policy mint confirmation should complete after normal Solana confirmation.

---

## 3. Stage 2 — Incident Occurs

No operator action is required or possible at this stage. The member experiences a medical event
and seeks care at any licensed facility.

### 3.1 What the member should do immediately

1. Seek care — coverage is in effect once the offchain activation record is active.
2. Request an **itemized invoice** from the facility (not a summary bill).
3. Request a **discharge summary or doctor note** before leaving the facility.
4. Keep all receipts and payment proofs.
5. Keep location evidence: boarding pass, hotel receipt, event badge, or equivalent.

### 3.2 What the member should NOT do

- Do not self-diagnose and choose a facility based on the benefit schedule — seek appropriate care first.
- Do not request that the facility omit or alter any diagnosis from the record.
- Do not wait until the coverage window expires to submit — the claim must be **opened within
  the coverage window or within 14 days of expiry**, whichever is later.

**Note on incapacity**: If the member is incapacitated and cannot self-submit, the `plan_admin`
or `claims_operator` can open the claim case on their behalf, with the member's wallet address
as the claimant. The operator cannot change the beneficiary wallet at this stage.

---

## 4. Stage 3 — Evidence Upload via Oracle Portal

### 4.1 Portal submission flow

The OmegaX Health oracle portal is the **only authorized channel** for claim evidence submission.
Evidence submitted via email, social media, or any other channel is not accepted.

| Step | Member action | System action |
|---|---|---|
| 1 | Logs in to oracle portal with claim wallet | Session verified against the offchain activation record |
| 2 | Selects "Submit new claim" | Pulls active coverage details |
| 3 | Uploads mandatory documents (see §5 of claims spec) | Auto-format check: PDF/image, min resolution, file size limit |
| 4 | Fills in basic claim form: incident date, facility name, country, type of care | Pre-populates from uploaded document OCR (AI-assisted, human-verified) |
| 5 | Confirms submission | Claim record created in operator queue; member receives confirmation |

### 4.2 Automated pre-checks at upload (AI layer)

Before the claim enters the human review queue, the following automated checks run:

| Check | Tool | Outcome on failure |
|---|---|---|
| **Document completeness** | Schema validator against `genesis-protect-acute-claim-v1.json` | Member prompted to resubmit missing document |
| **Incident date extraction** | OCR + date parser | Flagged for human verification if date is ambiguous |
| **Facility name and country extraction** | OCR + entity recognition | Flagged for human verification if unclear |
| **Language detection** | Language classifier | If not English: translation required flag → queue paused |
| **Duplicate hash detection** | SHA-256 of document set vs prior submissions | If match: automatic fraud flag — senior review triggered |
| **Exclusion keyword scan** | NLP classifier against exclusion schedule | Soft flag: operator sees highlighted terms in review queue |
| **Invoice format check** | Structure validator | If no itemization: member notified to request itemized bill |

AI pre-screening is **advisory only**. No AI flag alone triggers a denial. All flags are reviewed
by a human operator before any adjudication decision is made.

### 4.3 Evidence that cannot be accepted

- Documents in languages other than English without a certified translation
- Handwritten invoices not on official facility letterhead
- PDFs with password protection or corrupted files
- Screenshots of documents (printable PDF or scan required)
- Documents with visible redactions over clinically relevant fields

---

## 5. Stage 4 — Claim Intake

### 5.1 Who opens the ClaimCase

| Scenario | Who calls `open_claim_case` | Signer check |
|---|---|---|
| Standard self-submission | Member via oracle portal UI (portal submits on behalf) | `args.claimant == member_position.wallet` |
| Incapacitated member | Claims operator | `authority == claims_operator` AND `args.claimant == member_position.wallet` |
| Operator batch intake | Claims operator | Same as above |

### 5.2 Intake validation (protocol-enforced)

At the moment `open_claim_case` is submitted, the Solana program checks:

- Protocol emergency pause is clear
- Claimant wallet is nonzero and authorized, and offchain coverage is active for the selected policy window
- FundingLine is open
- No duplicate ClaimCase for the same claimant and policy window

If any check fails, the instruction reverts — no ClaimCase is created.

### 5.3 Member notification at intake

Member receives an oracle portal notification:
- Claim reference number (derived from ClaimCase PDA address)
- Confirmation that the claim is under review
- Internal review target (24 hours)
- List of any documents still awaited

---

## 6. Stage 5 — Automated Review and AI Pre-Screening

After intake, the claim enters the automated review pipeline before any human operator touches it.

### 6.1 AI pre-screening checks (expanded)

| Check | Input | Output |
|---|---|---|
| **Eligibility gate** | Incident date vs activation date and coverage window | Pass / Fail with reason |
| **Waiting period check** | Illness onset date vs enrollment date | Pass / Fail |
| **Tier classification suggestion** | Clinical summary + invoice | Suggested tier (T1/T2/T3) with confidence score |
| **UCR benchmark** (Travel 30 only) | Invoice line items vs UCR database for care country | Line-item UCR flags |
| **Duplicate claim detection** | Evidence hashes vs all prior claims | Match / No match |
| **Exclusion screen** | Full clinical text vs exclusion taxonomy | Flagged exclusions with confidence scores |
| **Fraud signal scoring** | All documents + claim metadata | Fraud risk score (Low / Medium / High) |

### 6.2 AI output routing

| AI risk score | Queue destination | Human review target |
|---|---|---|
| Low — no flags | Standard review queue | 24 hours |
| Medium — soft flags | Enhanced review queue (senior operator) | 12 hours |
| High — hard flags | Fraud hold queue | 2 hours (senior) |
| Critical — known exclusion | Auto-hold for human confirmation before denial | 4 hours |

**The AI never adjudicates.** It sorts, flags, and pre-fills the operator review interface.

---

## 7. Stage 6 — Human Review Trigger and Oracle Workflow

### 7.1 Standard human review (Phase 0 — operator-backed oracle)

The claims operator receives the claim in their review queue with:
- Pre-filled claim form from AI (incident date, facility, country, tier suggestion)
- All uploaded documents with AI highlights on flagged sections
- Checklist auto-populated from `genesis-protect-acute-claim-v1.json` schema
- Fraud risk score and individual flag details

The operator works through the checklist (see §6 of claims spec). If all items pass:
1. Operator confirms the evidence packet is complete and accurate
2. System assembles the **evidence packet** (all documents + AI review log + operator checklist)
3. System computes SHA-256 hash of the full packet
4. Operator reviews the hash and records the evidence-review result in the offchain claim manifest

### 7.2 MagicBlock private review path (optional — Phase 0 demo)

For high-sensitivity claims or when TEE-verified AI processing is required:

1. Claims operator prepares a **redacted claim packet** (hashed, not plaintext onchain)
2. `open_review_session` creates a review session PDA on base Solana
3. `delegate_review_session` delegates the PDA to MagicBlock Ephemeral Rollup
4. TEE reviewer inspects the private packet inside the TEE — raw PHI is not written to Solana or public endpoints
5. TEE emits a **hash-bounded review artifact** (no clinical content)
6. `record_private_review` records only hashes and status — only the registered reviewer can write
7. `record_private_payment_ref` stores the private payment reference hash (if reimbursement applies)
8. `commit_and_close_review_session` commits and undelegates back to base Solana
9. The committed review artifact supports the operator/oracle decision handoff before base-program adjudication

**Phase 0 status**: Demo-grade. The reserve kernel (obligation, settlement) is not routed through
this path in Phase 0. It demonstrates the privacy architecture for investor/partner audiences.

### 7.3 When a human escalates mid-review

If the operator discovers an issue that was not caught by the AI:

| Issue found | Operator action | Internal target |
|---|---|---|
| Document quality insufficient | Contacts member via portal — requests resubmission | Member has 7 days |
| Translation missing | Requests certified translation | 5 business days |
| Fraud suspicion (manual) | Moves to fraud hold; notifies senior operator | Senior review: 72 hours |
| High-value claim (above threshold) | Escalates to senior operator for co-review | Senior decision: 48 hours |
| Legal ambiguity (e.g., exclusion borderline) | Escalates to claims team lead | Team lead: 48 hours |
| Incapacity or emergency (member unreachable) | Documents and proceeds with available evidence | No additional delay |

---

## 8. Stage 7 — Oracle / Operator Decision Handoff

After evidence review, the oracle/operator workflow produces a decision artifact for internal audit
and hands the decision to the base-program adjudication path. The base `omegax_protocol` program no
longer stores `ClaimAttestation` accounts; it stores only evidence and decision proof fingerprints
on the claim case.

### 8.1 Decision-handoff requirements

| Requirement | Enforcement |
|---|---|
| Evidence packet reviewed against the published schema | Offchain OmegaX Health/oracle workflow |
| MagicBlock receipt verified when the adjunct path is used | Offchain consumer verifies registry, reviewer, expected hashes, payment reference, and committed ownership |
| Correct plan-level operator signs adjudication | `adjudicate_claim_case` requires the plan's claims operator or plan admin |
| Reserve and settlement remain base-program controlled | `reserve_obligation`, `settle_claim_case`, and `settle_obligation` enforce reserve-domain custody |

### 8.2 What the decision handoff records onchain

The base program records only:
- the claim decision and reason hash on `ClaimCase`
- reserve booking on `Obligation` / `FundingLine`
- payout through the reserve-domain vault when the claim settles

If the member needs to submit materially new evidence after a decision, a **new ClaimCase** should be opened. The original decided
claim is not modified.

---

## 9. Stage 8 — Adjudication (Decision)

### 9.1 Decision types

| Decision | Instruction | Onchain result |
|---|---|---|
| **Approve — full amount** | `adjudicate_claim_case` | `state = approved`, tier and amount recorded |
| **Approve — partial (over-cap)** | `adjudicate_claim_case` | Approved amount = tier cap; excess recorded as denied |
| **Deny — exclusion** | `adjudicate_claim_case` | `state = denied`, exclusion reason hash recorded |
| **Deny — fraud** | `adjudicate_claim_case` | `state = denied`, fraud reason hash recorded |
| **Deny — insufficient evidence** | `adjudicate_claim_case` | `state = denied`, reason hash recorded |
| **Hold — more info needed** | No onchain action yet | Claim stays `proposed`; operator waits for new evidence |

### 9.2 Tier classification at adjudication

The operator confirms (or overrides) the AI-suggested tier classification based on the full evidence review:

| Tier | Event 7 benefit | Travel 30 fixed | Travel 30 top-up |
|---|---|---|---|
| T1 — ER same-day | $150 | $250 | UCR-benchmarked top-up, total capped at locked aggregate cap |
| T2 — Overnight | $500 | $1,000 | UCR-benchmarked top-up, total capped at locked aggregate cap |
| T3 — Surgery + ICU | $3,000 | $2,500 | UCR-benchmarked top-up, total capped at locked aggregate cap |

For Travel 30 reimbursement top-up: the operator calculates
`min(UCR_eligible_itemized_cost - fixed_tier_benefit, locked_cap - fixed_tier_benefit)` so the
total approved amount remains within the aggregate cap locked at activation.

### 9.3 Denial notification timing

Within 2 hours of adjudication, the member receives:
- Denial reason category (not raw clinical detail or fraud flag language)
- Information on the Phase 0 appeal process (new ClaimCase with additional evidence)

---

## 10. Stage 9 — Reserve Booking and Settlement

### 10.1 Reserve booking (`reserve_obligation`)

After approval, the obligation is reserved against the appropriate FundingLine(s):

| Funding source | Reserve routing |
|---|---|
| Event 7 (sponsor lane) | Split: premium FundingLine first, then sponsor backstop FundingLine |
| Travel 30 (LP-backed) | Split: premium FundingLine + LP allocation (junior class first) |

`FundingLine.reserved_amount` increases. The encumbered reserve figure visible on the
public protocol console moves up. No USDC has moved yet.

### 10.2 Payout settlement (`settle_claim_case` / `settle_obligation`)

The settlement path pays the approved liability in the same configured asset:

```
Preferred: USDC
Fallback assets: operator rebalancing only; not direct cross-asset payout
```

For each settlement, the Solana program checks the domain vault, domain asset
ledger, funding line, funding-line ledger, plan ledger, optional series ledger,
and SPL outflow accounts all bind to the same reserve domain and asset mint.

If the matching same-asset settlement path is unavailable, settlement is
deferred and the Plan Admin is notified immediately.

Settlement transfers atomically via `transfer_from_domain_vault`:
- Net payout to member wallet (or `delegate_recipient` if set)
- Protocol fee carved out to protocol fee vault
- Oracle fee carved out to oracle fee vault when a configured oracle fee applies

### 10.3 Internal Settlement Targets

These timings are internal operating targets for staffing and queue design, not member-facing guarantees.

| Step | Internal target |
|---|---|
| Evidence uploaded → review complete | 24 hours |
| Approval decision → reserve booked | 2 hours |
| Reserve booked → USDC settlement | 48 hours |
| Total: evidence upload → payout | **≤ 74 hours** (standard path) |
| Total: evidence upload → payout (Tier 3 / senior review) | **≤ 120 hours** |

---

## 11. Stage 10 — Provider Settlement (Phase 0 → Phase 1)

### 11.1 Phase 0 posture: member-wallet settlement

In Phase 0, **all payouts go directly to the member's wallet** (or a delegated recipient wallet
set by the member via `authorize_claim_recipient`). The member is responsible for paying the
provider directly, or the payout supplements a payment the member has already made.

This is the correct conservative posture for Phase 0:
- No legal relationship between OmegaX and the provider is required
- No provider onboarding is needed to launch
- Settlement can proceed through the existing member-recipient rail once approved and once reserve,
  oracle-quality, fee, and rail checks pass

### 11.2 Phase 1 target: direct provider settlement

In Phase 1, the oracle service (`protocol-oracle-service`) may introduce direct provider
settlement, where the member authorizes routing to a provider wallet rather than the member wallet.

Requirements before Phase 1 provider settlement can launch:
- Provider has completed OmegaX KYB (Know Your Business) process
- Provider wallet is registered in the OmegaX provider registry
- Member has authorized provider as `delegate_recipient` during claim submission
- Provider has agreed to accept USDC as payment for the specific claim

### 11.3 Provider partnership pipeline (current status)

The Phase 1 provider settlement path requires an active provider outreach program (KR 2.4 / KR 2.5).
Target markets: UAE, Malaysia/Singapore, Web3 travel hubs. See `docs/operations/` for provider
partnership runbooks as they are developed.

---

## 12. Internal Target Matrix (Complete Reference)

These targets are for operational readiness. They should not be copied into public member-facing
copy as guaranteed service levels.

| Touchpoint | Internal target | Responsible party | Escalation if missed |
|---|---|---|---|
| Policy mint confirmation | Normal Solana confirmation | Protocol (automated) | — |
| Oracle portal: upload confirmation | < 30 seconds | Oracle service | Engineering on-call |
| AI pre-screening | < 5 minutes | Oracle service | Engineering on-call |
| Standard review queue: operator picks up | < 2 hours from upload | Claims operator | Claims team lead |
| Standard review: complete and attach hash | < 24 hours from upload | Claims operator | Claims team lead |
| Enhanced review (medium AI flag) | < 12 hours from upload | Senior operator | Claims team lead |
| Fraud hold: senior review decision | < 72 hours | Senior operator | Claims team lead + legal |
| High-value claim (senior co-review) | < 48 hours | Senior operator | Claims team lead |
| Translation pending | < 5 business days | Member (action) | Deny after deadline |
| Additional docs requested | < 7 days | Member (action) | Deny after deadline |
| Evidence awaited (no submission) | < 14 days | Member (action) | Deny after deadline |
| Adjudication → reserve booking | < 2 hours | Claims operator | Claims team lead |
| Reserve booked → settlement | < 48 hours | Claims operator + settlement router | Claims team lead |
| Denial notification to member | < 2 hours post-adjudication | Oracle service (automated) | Claims operator manual |
| Appeal acknowledgment | < 24 hours | Claims operator | Claims team lead |

---

## 13. Operator Staffing and Availability (Phase 0)

Phase 0 launch requires the following minimum operator coverage to meet the above internal targets:

| Role | Coverage | Responsibilities |
|---|---|---|
| **Claims Operator** | Business hours (5 days/week) + on-call | Standard review, evidence hash attachment, adjudication, settlement |
| **Senior Claims Operator** | Business hours + on-call (24h for fraud hold) | Enhanced review, fraud holds, high-value approvals, member disputes |
| **Claims Team Lead** | Business hours (available for escalations) | Target misses, policy ambiguities, team oversight |
| **Oracle Authority (signing key)** | Automated (key management system) | Attestation signing (must not require human intervention per claim) |
| **Plan Admin** | On-call (for emergency pauses, reserve alerts) | Emergency pause, FundingLine monitoring, reserve top-up |

**Oracle key custody production requirement**: before production automation, the oracle authority
signing key should be held in an HSM/KMS or equivalent secure key management system rather than a
claims-operator hot wallet. The target workflow is that operators submit attestation requests to an
oracle service that signs through the managed key boundary.

---

## 14. Onchain / Offchain Boundary Summary

| What lives on Solana | What lives offchain |
|---|---|
| PolicySeries and premium/payment record | Raw member identity documents and activation records |
| ClaimCase PDA (claim identity and state) | Raw medical evidence (PHI) |
| Obligation PDA (reserve amount, FundingLine reference) | AI pre-screening logs |
| Settlement transaction (vault delta, recipient, fees) | Fraud investigation notes |
| Fee vault accruals | Member communications |
| MagicBlock: review session hashes only | MagicBlock demo: private evidence packet handled by TEE/private reviewer adapter |

The onchain record is the **truth** about what was decided and what was paid.
The offchain record is the **evidence** supporting that truth.
Neither is sufficient alone — both must be retained.

---

## 15. References

| Document | Path |
|---|---|
| Onchain claim truth chain | `docs/architecture/genesis-protect-claim-trace.md` |
| Claims processing specification (KR 1.2) | `docs/architecture/genesis-protect-acute-claims-processing-spec.md` |
| MagicBlock private claim room | `docs/architecture/magicblock-private-claim-room.md` |
| Abstract claims model | `docs/architecture/decentralized-coverage-claims.md` |
| Phase 0 mainnet surface gating | `docs/operations/phase0-mainnet-surface-gating.md` |
| Evidence schema (JSON) | `frontend/public/schemas/genesis-protect-acute-claim-v1.json` |
| Actuarial workbook (May 2026) | `examples/genesis-protect-acute-actuarial-review/review-memo.md` |
| 32 claim simulation scenarios | `examples/genesis-protect-acute-claims/genesis-acute-claim-simulations-v1.json` |
| Solana instruction map | `docs/architecture/solana-instruction-map.md` |
