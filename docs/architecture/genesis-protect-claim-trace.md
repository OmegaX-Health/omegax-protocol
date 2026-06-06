# Genesis Protect Acute — End-to-End Claim Truth Chain

> **What this is**: a deterministic narrative walkthrough of one Genesis Protect Acute claim from member intake through final payout, mapping every public-facing state transition to the on-chain instruction that produces it. The aim is to let a sponsor, LP, auditor, or member follow the truth chain without reading the whole program.
>
> **Companion docs**: [`./decentralized-coverage-claims.md`](./decentralized-coverage-claims.md) (abstract model), [`../security/mainnet-privileged-role-controls.md`](../security/mainnet-privileged-role-controls.md) (who can sign what), [`../../e2e/localnet_protocol_surface.test.ts`](../../e2e/localnet_protocol_surface.test.ts) (`protection_claim_lifecycle` scenario — the test that mechanically traces the same flow).
>
> **What this is NOT**: a substitute for the operator runbook. The runbook covers operator UX and tooling — this doc covers the **state truth chain**, i.e. exactly what changes on-chain at each step.

> **Founder cap note**: Travel 30 Founder reservations are not active cover. The public Founder cohort targets a reserve-indexed cap up to USD 250,000 for the first 100 seats, but the exact active cap, terms hash, reserve snapshot, waiting periods, and exclusions lock only at activation.

## Pre-conditions (already on-chain at claim time)

The following objects exist before the first claim is opened. Their addresses, owners, and economic parameters are recorded in [`frontend/lib/devnet-fixtures.ts`](../../frontend/lib/devnet-fixtures.ts) (devnet) and produced by `scripts/bootstrap_genesis_live_protocol.ts` (mainnet via Genesis live bootstrap).

| Object | Identity | Why it matters at claim time |
|--------|----------|-----|
| `ReserveDomain` | `open-health-usdc` | Custody boundary; the domain's asset vault is the **only** source of payout funds |
| `HealthPlan` | `genesis-protect-acute-v1` | Owns plan-level pause flags and the `claims_operator` / `plan_admin` keys |
| `PolicySeries` (Event 7) | `genesis-event-7-v1` | 7-day acute event cover; tier benefits up to USD 3,000; fixed-only |
| `PolicySeries` (Travel 30) | `genesis-travel-30-v1` | 30-day acute travel cover; tier benefits + reimbursement top-up up to the cap locked at activation; hybrid |
| Schema hash | `genesis-protect-acute-claim` v1 | Off-chain evidence schema used by the OmegaX Health/oracle review workflow |
| `FundingLine` (premium) | `genesis-event7-premium` / `genesis-travel30-premium` | Member premium income; reduces claims-paying floor when reserved against |
| `FundingLine` (sponsor budget) | `genesis-event7-sponsor` (Event 7 only) | Sponsor backstop; secondary reserve lane |
| `FundingLine` (LP allocation) | `genesis-event7-liquidity` / `genesis-travel30-liquidity` | LP capital, reserved against by allocations |
| `LiquidityPool` + `CapitalClass` (senior, junior) | `genesis-protect-acute-pool` | Junior absorbs first impairment; senior is queue-only redemption |

## The happy path — one Travel 30 claim, end to end

Member: `M_wallet`. OmegaX Health activated Travel 30 coverage for that wallet 12 days ago, recorded premium proof, enforced the 7-day illness wait, and the member was hospitalized for 2 nights with an acute illness covered under the policy.

### Step 1 — `open_claim_case`

| Signer | Authority check | What changes |
|--------|------------------|----|
| Member (or claims operator if member-incapacitated) | Protocol emergency pause is clear; `args.claimant` is nonzero and either signs directly **or** `(authority == plan.claims_operator || authority == plan.plan_admin)` opens through the operator workflow | New `ClaimCase` PDA materialized with `state = proposed`, `claimant = M_wallet`, `policy_series = travel30`, `funding_line = travel30_premium` |

**Member-visible**: the claim shows up in the member's claim list with `state = proposed`. No money has moved.

**Truth chain**: the chain now records that someone enrolled on this plan opened a claim against this series at this slot. PT-04 closed the spoof-claimant gap; PT-04 defense test in `tests/security/program_authorization_gaps.test.ts` regresses the constraint.

### Step 2 (optional) — `authorize_claim_recipient`

| Signer | Authority check | What changes |
|--------|------------------|----|
| Member | signer == `claim_case.claimant` | Sets `claim_case.delegate_recipient = R_wallet` |

The default recipient is the member's own wallet. This step lets the member route the payout to a trusted custodian, hospital, or family-member wallet without giving the claims operator unilateral authority to do that. PT-04 again — operator cannot set the delegate.

### Step 3 — off-chain or adjunct evidence review

Raw medical content, AI review output, and optional MagicBlock private-review receipts stay outside the base `omegax_protocol` account surface. The operator/oracle workflow verifies the packet and produces evidence and decision fingerprints for the claim case, but the base program still does not store `ClaimAttestation` accounts.

**Member-visible**: the claim shows review progress through OmegaX Health/operator systems. The public protocol console should not imply that raw evidence or attestation state lives in the base program.

**Truth chain**: the base chain records the claim identity, evidence/decision fingerprints, and later adjudication, reserve, and settlement consequences. Evidence provenance is auditable through authorized off-chain manifests or adjunct receipt verification.

### Step 4 — `adjudicate_claim_case`

| Signer | Authority check | What changes |
|--------|------------------|----|
| Claims operator | `require_claim_operator` | `claim_case.intake_status` moves to `approved` or `denied`; adjudicator, approved/denied amounts, and decision metadata are persisted |

**Member-visible**: claim shows `approved at tier 2 (overnight admission), USD 1,000 fixed benefit + reimbursement top-up inside the locked aggregate cap` — or `denied with reason hash <hex>` for unhappy paths.

**Truth chain**: the protocol now has a final claim decision. The decision is the input to the next step — reserve booking against an `Obligation`.

### Step 5 — `reserve_obligation` (linked protection liability)

| Signer | Authority check | What changes |
|--------|------------------|----|
| Claims operator (or oracle authority for the linked-protection lane) | `require_claim_operator` (or oracle linkage) | Existing `Obligation` PDA moves from proposed to reserved; `obligation.reserved_amount` and `funding_line.reserved_amount` increase by the reserved amount |

**Truth chain**: the reserve is now booked against the appropriate funding line. The premium funding line and the LP-allocation funding line each take their share according to the allocation cap and weight (see `frontend/lib/protocol.ts` reserve math). The encumbered-reserve number visible in the public console moves up.

### Step 6 — `settle_claim_case` / `settle_obligation`

| Signer | Authority check | What changes |
|--------|------------------|----|
| Claims operator | `require_claim_operator` + positive net payout after configured fees + `transfer_from_domain_vault` PDA-signs the SPL transfer | `obligation.state = settled`; `domain_asset_vault.balance -= net payout`; member's payout wallet balance += net payout; configured fee vault counters accrue the carve-out |

The `transfer_from_domain_vault` helper is the only path money leaves the reserve domain. PT-01 / PT-02 closed the no-money-out-CPI gap (vault PDA-custody) and the missing-PDA-signature gap; both have defense regression tests in `tests/security/no_money_out_path.test.ts`.

**Member-visible**: claim shows `settled`; payout transaction signature visible; payout amount in member's wallet (or delegated recipient's wallet).

**Truth chain**: every public-facing economic state has a corresponding signed on-chain transaction. The full base-program chain from member intake → adjudication → reserve booking → payout is now a deterministic transaction graph that anyone can replay.

## Sponsor reserve impact

For Event 7 (sponsor-backstopped), the same flow uses the `genesis-event7-sponsor` funding line as a secondary reserve lane. The sponsor's funding budget `reserved` field increases at step 6; the sponsor's free-budget reading on the public console drops. The sponsor is contractually obligated to top up the funding line if the reserved share crosses the issuance floor.

For Travel 30 (no sponsor lane in v1), reserve impact is split between premium income and LP allocations. Junior class absorbs first impairment; senior class is shielded behind the junior layer plus the LP allocation cap.

## Final member status

After settle:

| Field | Value |
|-------|-------|
| `claim_case.state` | `settled` |
| `obligation.state` | `settled` |
| `funding_line.reserved` | decreased by the settled amount |
| `domain_asset_vault.balance` | decreased by the payout |
| Member wallet balance (or delegated recipient) | increased by the payout |
| Audit URI | The full transaction signature graph is replayable from any RPC; the public protocol console renders the timeline |

## Messy paths (truth chain when things go wrong)

The Notion task explicitly calls out **incomplete evidence / more-info-needed / partial approval / denial-over-cap / final-payout-or-denial** as states a real claim drill must cover. Some live on-chain; others are operator-workflow concerns that map to existing on-chain states. This split is the honest truth — pretending more lives on-chain than really does is a release-candidate risk.

| Messy state | Where it lives | What an external reviewer sees |
|-------------|----------------|----|
| **Incomplete evidence** | Off-chain (operator review queue) — no base-program state beyond the proposed claim | Claim shows `awaiting evidence` in the public timeline; no funding-line reserve change |
| **More-info-needed before decision** | Off-chain. The claim stays in `proposed` until the member supplies more evidence and the operator can adjudicate | Reviewer sees the proposed claim and the off-chain manifest trail, not mutable evidence accounts |
| **More-info-needed after decision** | Off-chain plus a new on-chain claim case when the revised packet materially changes the request | Reviewer sees the old decided claim and the new claim case rather than a mutable evidence overwrite |
| **Partial approval** | On-chain via the tier system. `adjudicate_claim_case` records the approved tier; tier amount is the cap; reimbursement top-up requires a separate adjudication round | Claim shows `tier 2 approved, top-up review pending` |
| **Denial over cap** | On-chain. Adjudication records the requested amount and the approved amount separately; `obligation.amount` is the approved cap, never the requested amount | Claim shows `requested $X, approved $cap (over-cap)` |
| **Final denial** | On-chain. `adjudicate_claim_case` transitions `proposed → denied`; no obligation is ever booked | Claim timeline ends at `denied with reason hash`; no money moves |
| **Settlement deferred / payout-in-flight** | On-chain. `obligation.state = claimable` records the moment the obligation is payable but not yet paid (e.g. waiting on a multisig settlement signer) | Encumbered reserve increased but vault balance not yet reduced; member sees `approved, awaiting payout` |
| **Recipient address change after approval** | On-chain via `authorize_claim_recipient` if the member updates `delegate_recipient` post-approval but pre-settlement | Audit shows the delegate change between adjudication and settlement |
| **Impairment** | On-chain. `mark_impairment` records that the obligation was settled at less than booked (LP loss). Junior class absorbs first | Public reserve-class APR readings drop; senior class is shielded |

## Dispute / appeal path (Phase 0 → Phase 1)

In **Phase 0** (the launch posture), denial appeals are off-chain. A denied claim's truth chain ends at the denial; if the member appeals, the operator opens a **new** claim case (different PDA) with the appeal evidence attached. Reviewers can correlate appeals to original claims via the off-chain claim manifest, not via on-chain state.

In **Phase 1** (post-launch), `protocol-oracle-service` adds dispute-case state and links appeals on-chain. Until that ships, appeals are operator-resolved.

## Reviewer's audit checklist

For each Genesis claim, a reviewer should be able to answer:

1. **Who opened it?** → `claim_case.claimant` and the opening transaction's signer
2. **What off-chain review artifact supports it?** → authorized OmegaX Health/oracle manifest or adjunct receipt, not base-program account data
3. **Who adjudicated?** → adjudication transaction signer (must be `claims_operator`)
4. **What was the decision and why?** → `claim_case.state` + reason hash
5. **What was reserved and from where?** → `obligation` + `funding_line.reserved` deltas
6. **What was paid, when, and to whom?** → settlement transaction; vault balance delta; recipient
7. **Was the recipient changed between adjudication and settlement?** → `claim_case.delegate_recipient` history (recoverable from transaction logs)

If any of these can't be answered from on-chain state alone for a real claim, the public posture statement must say "operator-workflow Phase 0" rather than "decentralized claims".

## Mapping to existing tests

The deterministic happy-path of this trace is mechanically exercised by the `protection_claim_lifecycle` scenario in [`e2e/localnet_protocol_surface.test.ts`](../../e2e/localnet_protocol_surface.test.ts) (instructions: `record_premium_payment`, `open_claim_case`, `authorize_claim_recipient`, `adjudicate_claim_case`, `settle_claim_case`). PT-04 / PT-07 / PT-01 / PT-02 defenses cover the spoof-claimant, removed oracle-profile/attestation surface, missing-money-out-CPI, and PDA-custody constraints respectively. The claim security hardening is covered by Rust unit tests plus frontend transaction-builder and pre-sign-review tests.

The unhappy paths above currently rely on operator workflow rather than first-class on-chain state for the soft cases (incomplete evidence, more-info-needed, deferred settlement). When `protocol-oracle-service` adds dispute-case state, this trace should be updated to point at the new on-chain entries.
