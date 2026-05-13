# Genesis Protect Acute v1 — Claims Processing Specification

> **Version**: 1.1  
> **Author**: Manuel Soldatini — Protocol Verification & Claims  
> **Status**: Draft — Internal  
> **Date**: May 2026  
> **Changelog**: v1.1 — updated to reflect multi-asset payout rails and MagicBlock private claim review path (protocol v0.3.2, May 2026 pull)  
> **Companion docs**:
> [`genesis-protect-claim-trace.md`](./genesis-protect-claim-trace.md) (onchain truth chain),
> [`genesis-protect-acute-full-protect-flow.md`](./genesis-protect-acute-full-protect-flow.md) (operational flow — KR 1.1),
> [`magicblock-private-claim-room.md`](./magicblock-private-claim-room.md) (private review adjunct),
> [`decentralized-coverage-claims.md`](./decentralized-coverage-claims.md) (abstract model),
> [`../../frontend/public/schemas/genesis-protect-acute-claim-v1.json`](../../frontend/public/schemas/genesis-protect-acute-claim-v1.json) (evidence schema)

---

## 1. Purpose and Scope

This document specifies the full operational and technical claims-processing workflow for
**Genesis Protect Acute v1** — covering Event 7 and Travel 30 policy SKUs.

It defines:

- what evidence members must submit and how it is validated
- what eligibility checks are performed before and during intake
- what signals trigger fraud review or escalation
- the complete settlement state machine (onchain and operator-layer)
- escalation rules and the human escalation hierarchy
- the full audit trail that must exist for every claim, verifiable by third parties

This spec governs the **Phase 0 launch posture** (operator-backed oracle, human review, offchain
dispute resolution). Phase 1 extensions (onchain dispute-case state, multi-attestation finality,
`protocol-oracle-service`) are noted where they change behavior but are not in scope for this release.

---

## 2. Roles and Authorities

| Role | Who | What they can do | What they cannot do |
|---|---|---|---|
| **Member** | Enrolled wallet (MemberPosition) | Open claim case, submit evidence via oracle portal, authorize payout recipient, check claim status | Adjudicate their own claim, mutate evidence after attestation |
| **Claims Operator** | OmegaX ops team (claims_operator key) | Attach evidence hash, adjudicate, reserve obligation, settle claim | Move funds outside claim-linked liabilities, override oracle attestation |
| **Oracle Authority** | Designated oracle profile | Attest claim case against verified evidence schema | Adjudicate or settle claim unilaterally |
| **Plan Admin** | OmegaX admin key (plan_admin) | Pause plan, set operational controls, open claim on behalf of incapacitated member | Rewrite approved or settled liabilities |
| **LP / Sponsor** | Capital providers | Monitor reserve exposure, fund FundingLine | Intervene in individual claim decisions |
| **TEE Reviewer** | MagicBlock private review path (Phase 0 demo) | Inspect private evidence in TEE, emit hash-bounded review artifact | Access raw PHI outside TEE, adjudicate or settle claim |

---

## 3. Product Reference

| Parameter | Event 7 | Travel 30 |
|---|---|---|
| Premium | $39 USDC | $99 USDC |
| Coverage duration | 7 days | 30 days |
| Benefit mode | Fixed only | Hybrid: fixed tier + UCR reimbursement top-up |
| Max benefit | $3,000 | $5,000 |
| Tier 1 — ER same-day | $150 fixed | $250 fixed |
| Tier 2 — Overnight | $500 fixed | $1,000 fixed |
| Tier 3 — Surgery + ICU (2+ nights) | $3,000 fixed | $2,500 fixed + reimbursement top-up to $5,000 aggregate |
| Waiting period (illness onset) | 7 days pre-enrollment | 7 days pre-enrollment |
| Internal claim review target | 24 hours | 24 hours |
| Internal settlement target | 48 hours post-approval | 48 hours post-approval |

---

## 4. Pre-Claim Eligibility Checks

These checks are performed **before** a `ClaimCase` is opened or accepted for review.
Failure at any of these gates results in an immediate denial without entering the claims queue.

### 4.1 Policy Validity

| Check | Pass condition | Failure action |
|---|---|---|
| Active MemberPosition exists | `member_position.wallet == claimant` and position is in an active state | Deny: no valid policy |
| Policy is within coverage window | Incident date falls within the 7-day (Event 7) or 30-day (Travel 30) coverage period from activation | Deny: outside coverage window |
| Premium payment confirmed | `record_premium_payment` instruction has been executed for this member position | Deny: unpaid policy |
| Protocol is not paused | `HealthPlan.emergency_pause == false` | Hold: system pause — re-queue when cleared |
| FundingLine is open | The relevant FundingLine is active and not exhausted | Hold: funding suspension — escalate to Plan Admin |

### 4.2 Incident Eligibility

| Check | Pass condition | Failure action |
|---|---|---|
| Incident is within covered travel context | Evidence confirms care occurred outside member's home country or at covered event venue | Deny: not a covered travel context |
| Condition is an acute emergency | Clinical summary confirms unplanned acute event (not pre-scheduled, not elective) | Deny: non-acute / elective — see Exclusion §8 |
| Waiting period satisfied | Illness onset is not within the 7-day pre-enrollment waiting period | Deny: waiting period not satisfied |
| Single claim per coverage period | No prior settled or approved `ClaimCase` exists for this `MemberPosition` in the same policy window | Deny: duplicate claim |

### 4.3 Member Identity Verification

| Check | Pass condition | Failure action |
|---|---|---|
| Claimant wallet matches MemberPosition | `args.claimant == member_position.wallet` | Reject at intake (PT-04 constraint — protocol-enforced) |
| Operator submission is authorized | If operator opens on behalf of member, authority is `claims_operator` or `plan_admin` | Reject at intake (protocol-enforced) |

---

## 5. Required Evidence

All evidence is submitted **offchain** through the OmegaX Health oracle portal. The operator
attaches a SHA-256 hash of the evidence packet to the `ClaimCase` via `attach_claim_evidence_ref`.
Raw medical documents are never stored onchain or published publicly.

### 5.1 Mandatory Documents (all claims)

| Document | Accepted formats | Minimum content |
|---|---|---|
| **Discharge summary or doctor note** | PDF, scanned image (min 300 DPI), hospital letterhead preferred | Diagnosis, treatment dates, treating physician name and signature |
| **Itemized invoice or bill** | PDF, hospital-issued format | Line-item charges, facility name, patient name matching policy, dates |
| **Proof of payment** | Bank receipt, credit card statement, payment confirmation | Amount paid, currency, date, payee |
| **Location and date proof** | Boarding pass, hotel receipt, conference badge, visa stamp | Confirms member was present in covered travel context on incident date |

### 5.2 Additional Documents — Tier 3 Claims (Surgery + ICU)

| Document | Accepted formats | Minimum content |
|---|---|---|
| **Operative or procedure report** | PDF, hospital-issued | Procedure performed, surgeon name, anaesthetic record if applicable |
| **ICU admission and discharge record** | PDF, hospital-issued | Admission date, discharge date, treating consultant |
| **Anaesthesiologist report** (if applicable) | PDF | Confirms inpatient surgical anaesthesia |

### 5.3 Additional Documents — Travel 30 Reimbursement Top-Up

| Document | Accepted formats | Minimum content |
|---|---|---|
| **Itemized bill with UCR annotation** | PDF | Each line item with corresponding UCR ceiling noted by operator |
| **Receipts for all charged line items** | PDF, bank statement | Individual line-item payments matching the invoice |

### 5.4 Document Quality Standards

- All documents must be in English, or accompanied by a certified translation.
- Translated documents must include the translator's name, credentials, and date.
- Handwritten notes are accepted only if on official facility letterhead and countersigned.
- Blurred, cropped, or partially obscured documents are rejected — member must resubmit.
- Documents dated after the claim submission window trigger a fraud flag (see §7.2).

---

## 6. Evidence Review Checklist

The claims operator performs the following checks before attaching the evidence hash and
triggering oracle attestation.

### 6.1 Clinical Review

- [ ] Diagnosis is consistent with an acute emergency (ICD-10 code review)
- [ ] Treatment dates fall within the active coverage window
- [ ] Treating facility is a licensed hospital, clinic, or emergency care provider
- [ ] Clinical narrative is internally consistent (onset → treatment → discharge sequence is logical)
- [ ] No mention of pre-existing chronic condition management as primary diagnosis
- [ ] No mention of elective, pre-scheduled, or cosmetic procedure

### 6.2 Financial Review

- [ ] Requested approval amount is capped by the applicable benefit schedule
- [ ] All invoice line items are medically relevant to the acute diagnosis
- [ ] UCR comparison completed for Travel 30 reimbursement line items
- [ ] Proof of payment matches invoice amounts (no unexplained delta)
- [ ] Payment currency and date are consistent with the care timeline

### 6.3 Identity and Location Review

- [ ] Patient name on medical documents matches the wallet holder's identity record
- [ ] Care location is consistent with member's stated travel itinerary
- [ ] Location and date proof confirms member was physically present at the care location
- [ ] No conflict between boarding pass dates and incident dates

### 6.4 Tier Classification Decision

| Tier | Classification criteria |
|---|---|
| Tier 1 — ER Same-Day | ER attendance confirmed, discharged same calendar day, no admission |
| Tier 2 — Overnight | Hospital admission confirmed, 1–2 nights, no surgery or ICU |
| Tier 3 — Surgery + ICU | Surgical procedure confirmed OR ICU admission confirmed, 2+ nights |

For Travel 30, after tier classification, the reimbursement top-up is calculated from
UCR-benchmarked line items and capped so the total approved amount never exceeds $5,000.

---

## 6b. MagicBlock Private Claim Review Path (Optional Oracle Path)

As of protocol v0.3.2, a **MagicBlock Ephemeral Rollup adjunct** (`omegax_private_claim_review`) is
available as an optional oracle attestation adjunct for cases where standard human review would
benefit from stronger privacy boundaries — for example, when evidence is inspected by a Trusted
Execution Environment (TEE) reviewer without placing raw PHI on the Solana base layer.

### When this path applies

- High-sensitivity Tier 3 claims (surgery, ICU) where OCR processing of medical records is needed
- Claims involving third-party reimbursement where private payment reference must be attested
- Pilot / hackathon demo contexts (current Phase 0 status: demo-grade, not production settlement)

### Flow (adjunct path)

| Step | Action | What is recorded |
|---|---|---|
| 1 | Claims operator prepares redacted claim packet and hashes the evidence bundle | Hash only — raw PHI stays offchain |
| 2 | `open_review_session` creates a public review-session PDA on base Solana | Session PDA seeded by authority + claim case + session ID (prevents squatting) |
| 3 | `delegate_review_session` delegates the PDA to MagicBlock ER | Session marked `delegated` |
| 4 | TEE/private reviewer inspects private packet, emits hash-bounded review artifact | Review result and binary hash — not raw content |
| 5 | `record_private_review` records review hashes and status on the delegated session | Only the registered reviewer can write; binary hash must match operator registry |
| 6 | `record_private_payment_ref` stores private payment reference hash (if applicable) | Reference hash only — payment details never onchain |
| 7 | `commit_and_close_review_session` commits and undelegates back to Solana | Approved sessions require payment ref before commit |
| 8 | `omegax_protocol::attest_claim_case` consumes the committed review artifact hash via normal attestation path | Onchain attestation proceeds as in standard flow |

### Boundaries (must not be crossed)

- The main `omegax_protocol` program is **not** delegated to MagicBlock — only the adjunct session PDA is.
- `ClaimCase`, reserves, vaults, FundingLines, Obligations, and payout accounts are never delegated.
- The adjunct is **not authoritative by itself** — consumers must verify registry binding, reviewer
  binding, expected hashes, payment reference, and committed ownership before treating the result
  as valid attestation input.
- Phase 0 MagicBlock status: **demo-grade**. The production reserve kernel (USDC settlement, obligation
  reservation, claim adjudication) is not routed through this path in Phase 0. It demonstrates the
  privacy architecture for investor and partner audiences.

---

## 7. Fraud Flags and Escalation Triggers

### 7.1 Automatic Fraud Flags (block approval, require senior review)

These signals automatically place the claim in a **fraud hold** state. Senior operator review
is required before adjudication can proceed.

| Flag | Trigger condition |
|---|---|
| **Date inconsistency** | Document date precedes policy activation date, or discharge date is after the current date |
| **Location mismatch** | Care facility country does not match the location proof submitted |
| **Document anachronism** | Invoice or doctor note bears a date that post-dates the claim submission timestamp |
| **Duplicate evidence hash** | `evidence_ref_hash` matches a hash from a previously submitted claim (same or different member) |
| **Policy-period overlap** | Member has another open or recently settled claim within the same coverage window |
| **Velocity flag** | Member has submitted 2+ claims across separate policy periods within 90 days |
| **Known exclusion keyword** | Clinical narrative contains terms triggering a mandatory exclusion review (see §8) |
| **Invoice-to-payment mismatch** | Invoice total and proof-of-payment total differ by more than 10% without explanation |
| **UCR outlier** | Any single line item on a Travel 30 claim exceeds UCR ceiling by more than 200% |

### 7.2 Soft Fraud Signals (flag for enhanced review, do not auto-block)

| Signal | Operator action |
|---|---|
| Handwritten invoice from unlicensed provider | Request facility license documentation |
| Cash payment with no bank trail | Request secondary documentation (e.g., witness statement, facility receipt) |
| Diagnosis inconsistent with reported symptoms | Request clarifying note from treating physician |
| Member contacted claims team before the policy activation | Document and flag — no action unless combined with other signals |
| Invoice issued in a currency unusual for the care country | Verify exchange rate and independent receipt |
| Unusual tier escalation (e.g., Tier 3 with minimal clinical record) | Request full surgical or ICU admission records before classification |

### 7.3 Fraud Referral Procedure

When 2 or more automatic fraud flags are triggered on a single claim:

1. Claims operator places the claim in `fraud_hold` (offchain state, claim remains `proposed` onchain)
2. Senior operator is notified within 2 hours
3. Member is notified that additional documentation is required (no disclosure of fraud suspicion)
4. Senior operator has 72 hours to complete fraud review
5. If fraud is confirmed: claim is denied with reason code `FRAUD_MISREPRESENTATION` (Section 8.2)
6. If fraud is confirmed and evidence is strong: referral to legal team + account suspension
7. If fraud is cleared: claim re-enters normal review queue

---

## 8. Exclusion Schedule

Claims meeting any of the following criteria are denied. Denial reason codes are recorded in
the `adjudicate_claim_case` instruction and hashed as the denial reason in the audit trail.

| Code | Exclusion category | Trigger |
|---|---|---|
| `EXCL_5_1` | Elective / pre-planned procedure | Procedure was scheduled before policy activation, or is cosmetic, or is not medically urgent |
| `EXCL_5_2` | Intentional self-harm | Clinical record contains evidence of self-inflicted injury (absolute exclusion — no appeal) |
| `EXCL_5_3` | Dental and oral conditions | Primary diagnosis is dental, periodontal, or orthodontic in nature |
| `EXCL_5_4` | Chronic disease management | Visit is for routine management, prescription refill, or monitoring of a pre-existing chronic condition |
| `EXCL_5_5` | Obesity / weight-loss surgery | Procedure is bariatric or weight-management in nature |
| `EXCL_5_6` | Substance dependence treatment | Admission is for detox, rehabilitation, or management of substance dependence |
| `EXCL_8_2` | Fraud / misrepresentation | Evidence of deliberate falsification, document manipulation, or identity misrepresentation |
| `EXCL_PRE` | Pre-existing condition (waiting period) | Condition onset is within the 7-day pre-enrollment waiting period |
| `EXCL_WIN` | Outside coverage window | Incident date is outside the active policy window |
| `EXCL_CTX` | Non-covered travel context | Care did not occur during covered travel or event |

---

## 9. Claim State Machine

### 9.1 Onchain States (ClaimCase / Obligation)

```
                          ┌─────────────────────────────────┐
                          │         CLAIM LIFECYCLE          │
                          └─────────────────────────────────┘

   open_claim_case                    adjudicate_claim_case
        │                                     │
        ▼                                     ▼
  [PROPOSED] ──────────── evidence ────────► [APPROVED] ──► reserve_obligation ──► [RESERVED]
      │                    review                │                                       │
      │                                          │                                       ▼
      │                                    [DENIED] ◄──────────────────────────── settle_obligation
      │                                          │                                       │
      │                                    (end state)                                   ▼
      │                                                                           [SETTLED / IMPAIRED]
      │
      └────────────────────────────────────────► [CANCELED] (operator void before adjudication)
```

| Onchain state | Instruction | Economic consequence |
|---|---|---|
| `proposed` | `open_claim_case` | No money moved. Claim identity recorded. |
| `evidence_attached` | `attach_claim_evidence_ref` | Evidence hash locked onchain. No money moved. |
| `attested` | `attest_claim_case` | Oracle has signed the evidence hash. No money moved. |
| `approved` | `adjudicate_claim_case` (approve) | Decision recorded. Tier and amount confirmed. No money moved yet. |
| `denied` | `adjudicate_claim_case` (deny) | Denial reason hash recorded. No money moved. End state. |
| `reserved` | `reserve_obligation` | USDC reserved on FundingLine. Encumbered reserve increases. |
| `claimable` | `reserve_obligation` → settlement pending | Approved and reserved, awaiting settlement signer. |
| `settled` | `settle_claim_case` / `settle_obligation` | USDC transferred to member (or delegate recipient). |
| `impaired` | `mark_impairment` | Settled at less than booked amount. LP junior class absorbs delta. |
| `canceled` | Operator void | Claim voided before adjudication. No economic impact. |

### 9.2 Operator-Layer States (Offchain Workflow)

These states exist in the operator review queue only. The onchain `ClaimCase` remains in
`proposed` until the operator is ready to proceed.

| Operator state | Meaning | Next action |
|---|---|---|
| `awaiting_evidence` | Member has not yet submitted documents | Await member submission (max 14 days, then deny) |
| `evidence_review` | Operator is reviewing documents | Complete checklist within 24h internal target |
| `fraud_hold` | Automatic or manual fraud flag triggered | Senior review within 72h |
| `translation_pending` | Documents are not in English; awaiting certified translation | Await translation (max 5 business days) |
| `additional_docs_required` | Checklist incomplete; member contacted for more documents | Await member response (max 7 days, then deny) |
| `senior_review` | Complex case escalated to senior operator | Senior decision within 48h |
| `legal_escalation` | Fraud confirmed or complex legal issue | Legal team engagement; no time cap |
| `ready_to_adjudicate` | All checklist items complete; decision can be made | Proceed to `adjudicate_claim_case` |

---

## 10. Escalation Rules and Hierarchy

### 10.1 Automatic Escalation Triggers

| Condition | Escalation level |
|---|---|
| Event 7 Tier 3 or near-cap claim | Senior operator review required before approval |
| Claim amount > $2,000 (Travel 30) | Senior operator review required before approval |
| Any Tier 3 claim (Surgery + ICU) | Senior operator review required before approval |
| 2+ automatic fraud flags | Senior operator review required before any action |
| Member disputes a denial | Senior operator re-opens review (Phase 0: offchain; Phase 1: new ClaimCase) |
| Operator checklist incomplete after 24h internal target | Escalate to claims team lead |
| Translation pending > 5 business days | Escalate to claims team lead; consider requesting alternative documentation |
| FundingLine free balance < 120% of reserved amount | Escalate to Plan Admin for reserve top-up |

### 10.2 Escalation Hierarchy

```
Level 1 — Claims Operator (standard review)
   ↓  [triggers above or 24h internal-target miss]
Level 2 — Senior Claims Operator (enhanced review)
   ↓  [fraud confirmed, legal question, member dispute unresolved]
Level 3 — Claims Team Lead (final operational decision)
   ↓  [confirmed fraud, litigation risk, policy ambiguity requiring legal input]
Level 4 — Legal / Compliance Team
```

### 10.3 Member Dispute Process (Phase 0)

In Phase 0, there is no onchain dispute-case state. Member appeals are handled as follows:

1. Member notifies OmegaX Health via the oracle portal within 14 days of denial.
2. Claims operator opens a **new** `ClaimCase` PDA with updated or additional evidence.
3. Senior operator reviews the appeal claim independently of the original decision.
4. The original denied `ClaimCase` is not modified — both the original denial and the appeal
   result are recorded separately onchain. An external reviewer can correlate them via
   the offchain claim manifest.
5. Appeal decision is final in Phase 0. Phase 1 will add onchain dispute-case state.

---

## 11. Settlement States and Timing

### 11.1 Internal Settlement Targets

These are operating targets for staffing and queue design. They are not member-facing guarantees.

| Stage | Internal target |
|---|---|
| Evidence review complete → adjudication | 24 hours from evidence submission |
| Approval → reserve booking | 2 hours |
| Reserve booked → USDC settlement | 48 hours |
| Fraud hold → senior review decision | 72 hours |
| Additional docs requested → timeout denial | 7 days from member notification |
| Evidence awaited → timeout denial | 14 days from claim opening |

### 11.2 Settlement Mechanics

**Preferred settlement asset**: USDC (SPL token, `hWMfBLfo8EBaRTCcrWV33xaUR8gK2iTtqPoQvEMHmvu` on devnet).

**Multi-asset payout rails (protocol v0.3.2+)**: `settle_claim_case` and `settle_obligation` now
require a matching `ReserveAssetRail` for the selected payout asset. The off-chain settlement router
or oracle service selects the asset from the approved waterfall. The Solana program enforces the
following before any value leaves custody:

| Rail check | Requirement | Failure behaviour |
|---|---|---|
| Domain and mint binding | Rail must be bound to the same reserve domain and asset mint as the claim | Settlement fails |
| Rail active | `rail.active == true` | Settlement fails |
| Payout enabled | `rail.payout_enabled == true` | Settlement fails |
| Oracle price freshness | Published price must be within the rail's freshness window | Asset counted as zero capacity — cannot be selected |
| Oracle confidence | Price confidence must be ≤ `rail.max_confidence_bps` | Asset counted as zero capacity — cannot be selected |

Approved fallback rails (where configured): PUSD, USDT, SOL, WBTC, WETH.
The program **does not swap assets** and does not treat pending reservation custody as
claims-paying reserve until activation/posting rules have made that true.

Other settlement mechanics:
- Payout is transferred atomically via `transfer_from_domain_vault` — the only authorized path
  money leaves the reserve domain (PT-01/PT-02 — protocol-enforced).
- Default payout wallet: `MemberPosition.wallet`.
- Delegated payout wallet: `ClaimCase.delegate_recipient` if set via `authorize_claim_recipient`
  before settlement. The delegate can only be set by the member, not by the operator (PT-04).
- Protocol fee and oracle fee are carved out at settlement according to the fee vault configuration.
- Net payout = approved amount − protocol fee − oracle fee.

### 11.3 Partial Settlement and Impairment

- **Partial approval**: adjudication records both the requested amount and the approved capped amount.
  The obligation is booked and settled at the approved cap, never at the requested amount.
- **Over-cap denial**: if invoiced amount exceeds the applicable benefit cap, the excess is denied.
  The cap amount is approved and settled; the excess is recorded as `denied (over-cap)`.
- **Impairment**: if the FundingLine cannot cover the full approved amount at settlement time,
  `mark_impairment` records the shortfall. Junior capital class absorbs the impairment first;
  senior class is shielded. The member receives the available amount, not the full approved amount.
  Impairment is an exceptional state and triggers immediate Plan Admin notification.

---

## 12. Audit Trail Requirements

Every claim must produce a complete, replayable audit trail satisfying the following requirements.

### 12.1 Onchain Audit Trail (mandatory for all claims)

An external reviewer must be able to answer all of the following from onchain state alone:

| Question | Source |
|---|---|
| Who opened the claim and when? | `ClaimCase.claimant` + opening transaction signer + slot timestamp |
| What was the policy series and coverage window? | `ClaimCase.policy_series` + `MemberPosition` |
| What evidence was attached? | `ClaimCase.evidence_ref_hash` (immutable after first attestation) |
| Who attested the evidence? | `ClaimAttestation` — oracle profile, attestation hash, schema hash/version |
| Who adjudicated and what was the decision? | Adjudication transaction signer + `ClaimCase.state` + reason hash |
| How much was approved and from which FundingLine? | `Obligation.reserved_amount` + `FundingLine` reference |
| Was the payout recipient changed between approval and settlement? | `ClaimCase.delegate_recipient` history (recoverable from transaction logs) |
| What was paid, to whom, and when? | Settlement transaction signature + vault balance delta + recipient wallet |
| Were any fees collected? | Fee vault accrual counters in settlement transaction |

### 12.2 Offchain Audit Trail (operator-maintained)

The following should be retained in the operator's offchain claim manifest and made available only
through authorized internal audit or third-party review processes:

| Record | Retention period |
|---|---|
| Raw evidence documents (PHI) | Per approved compliance-retention policy, encrypted at rest, access-logged |
| Operator review checklist completion record | Per approved compliance-retention policy |
| Decision rationale note (for every denial or escalation) | Per approved compliance-retention policy |
| Fraud review notes and outcome | Per approved compliance-retention policy |
| Member communications log (portal messages, email) | Per approved compliance-retention policy |
| Translation records (if applicable) | Per approved compliance-retention policy |
| Appeal and dispute records | Per approved compliance-retention policy |

### 12.3 Onchain / Offchain Boundary

This boundary is a critical security and privacy design choice. It must not be blurred.

| What lives onchain | What stays offchain |
|---|---|
| Claim identity, state, and lifecycle | Raw medical documents (PHI) |
| Evidence hash (SHA-256 of full packet) | Actual invoice content, diagnoses, clinical notes |
| Decision result and reason hash | Decision rationale narrative |
| Reserve and settlement amounts | Member identity documents |
| Transaction signatures (full audit graph) | Operator review notes |
| Fee vault accrual | Fraud investigation records |

Any document published to a public endpoint must never contain raw PHI.
The `evidence_ref_hash` onchain is a tamper-evident commitment to the offchain packet — not a link to the content.

### 12.4 Third-Party Audit Path

An authorized third-party reviewer (for example, an LP, sponsor, or independent reviewer) can verify
claim integrity without access to PHI using the following steps:

1. Retrieve the `ClaimCase` PDA from any Solana RPC using the claim's transaction signature.
2. Verify `ClaimCase.evidence_ref_hash` matches the hash of the full evidence packet (provided
   by OmegaX Health under NDA with auditor).
3. Verify `ClaimAttestation.evidence_ref_hash` matches the same hash — confirming the oracle
   attested to an unmodified packet.
4. Verify the adjudication transaction signer matches the registered `claims_operator` key.
5. Verify settlement transaction via `transfer_from_domain_vault` — net payout, fee vaults, recipient.
6. Cross-check `FundingLine.reserved` and `domain_asset_vault.balance` deltas.

All six steps can be performed without accessing any PHI.

---

## 13. Denial Notification to Member

When a claim is denied, the member receives:

1. A notification via the OmegaX Health oracle portal within 2 hours of adjudication.
2. The denial reason category (from §8 — no raw clinical language disclosed).
3. Information on the appeal process (see §10.3).
4. Confirmation that no money has moved and no reserve has been booked.

Denial notifications must not:
- Disclose the specific fraud flags that triggered a fraud hold.
- Reference internal operator notes or checklist items.
- Make representations about future policy eligibility.

---

## 14. Phase 0 vs Phase 1 Posture

This spec governs Phase 0 launch. The following behaviors change in Phase 1:

| Behavior | Phase 0 (this spec) | Phase 1 (future) |
|---|---|---|
| Dispute handling | Offchain — new ClaimCase opened for appeal | Onchain dispute-case state via `protocol-oracle-service` |
| Oracle quorum | Single oracle authority per HealthPlan | Multi-attestation finality gate |
| Fraud referral state | Offchain hold, ClaimCase stays `proposed` | Dedicated onchain `fraud_hold` state |
| Operator audit trail | Offchain manifest maintained by OmegaX Health | Protocol-level operator action log |

Any public-facing claim posture statement in Phase 0 must accurately represent the above. Specifically:
appeals, disputes, and fraud holds are operator-workflow concerns in Phase 0, not decentralized
on-chain state. Misrepresenting these as "decentralized claims adjudication" is a release-candidate
risk and is explicitly prohibited.

---

## 15. References

| Document | Path |
|---|---|
| Onchain claim truth chain | `docs/architecture/genesis-protect-claim-trace.md` |
| Abstract claims model | `docs/architecture/decentralized-coverage-claims.md` |
| Evidence schema (JSON) | `frontend/public/schemas/genesis-protect-acute-claim-v1.json` |
| Actuarial workbook (updated May 2026) | `examples/genesis-protect-acute-actuarial-review/review-memo.md` |
| 32 claim simulation scenarios | `examples/genesis-protect-acute-claims/genesis-acute-claim-simulations-v1.json` |
| Mainnet privileged role controls | `docs/security/mainnet-privileged-role-controls.md` |
| Operator runbook index | `docs/operations/runbooks.md` |
| Protocol surface audit | `docs/testing/protocol-surface-audit.md` |
| MagicBlock private claim room | `docs/architecture/magicblock-private-claim-room.md` |
| Phase 0 mainnet surface gating | `docs/operations/phase0-mainnet-surface-gating.md` |
| Full operational protect flow (KR 1.1) | `docs/architecture/genesis-protect-acute-full-protect-flow.md` |
