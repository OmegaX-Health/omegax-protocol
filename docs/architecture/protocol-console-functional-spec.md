# Protocol Console Functional Specification

This document is the target-state functional brief for the public OmegaX protocol console.

It is intentionally future-state:

- it describes what the console should do, not only what the current build already does
- it stays public-safe and does not assume private backend services
- it uses the canonical protocol nouns from the rearchitecture
- it defines functional and UX behavior, not final visual styling

Use this together with:

- [`frontend-information-architecture.md`](./frontend-information-architecture.md)
- [`solana-instruction-map.md`](./solana-instruction-map.md)
- the OmegaX design system references in the separate design-system repo

## 1. Product Rules

- The console must organize around `HealthPlan`, `PolicySeries`, `ClaimCase`, `Obligation`, `LiquidityPool`, `CapitalClass`, `AllocationPosition`, and `ReserveDomain`.
- Sponsor budgets, member rights, claims, and LP capital must remain visibly separated in both copy and workflow.
- Every route must be useful in observer mode and become action-capable only when a connected wallet has the right scope.
- Off-chain medical payloads must never be uploaded directly into protocol state. The UI may capture references, hashes, manifests, and public proof pointers only.
- All writable actions must expose protocol consequences before signature: affected object, derived PDA or account, economic effect, and irreversible side effects.
- Every page must support loading, empty, and failure states without collapsing the layout or hiding context.

## 2. Global Experience Requirements

### 2.1 App Shell

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Brand mark | Link | Always returns the user to `/plans` as the default home surface. | Focusable, keyboard accessible, screen-reader label for home. |
| Primary navigation | Route tabs | Expose `Plans`, `Capital`, `Claims`, `Members`, `Governance`, `Oracles`, `Schemas`, and external `Docs`. | Active route state, hover state, keyboard navigation, external-link treatment for `Docs`. |
| Overflow navigation | `More` menu | Move lower-priority tabs into an overflow menu on narrower desktop widths without removing access. | Active-state inheritance, close on outside click, close on `Esc`. |
| Theme toggle | Button | Toggle light/dark mode and persist user choice locally. | Works on desktop and mobile; label reflects next theme. |
| Network selector | Button + menu | Show current cluster and allow switching between supported public networks. | Disabled options must remain visible with `Coming soon`; switching updates connection context and URL-safe explorer behavior. |
| Wallet control | Button + menu | Connect wallet, show connected address, copy address, switch wallet, disconnect. | Observer, connecting, connected, disconnecting, copied-address success, menu open/close. |
| Mobile nav trigger | Button | Open and close the mobile menu. | Must not trap users; close on route change, outside click, and `Esc`. |
| Mobile menu | Drawer/panel | Re-expose route links, theme action, wallet control, and network options in a stacked mobile layout. | Keep the same route coverage as desktop. |
| Status bar | Read-only operations strip | Show sync posture, cluster, epoch, and slot. | `Live`, `Retrying`, stale/unavailable states; auto-refresh without manual reload. |
| Main content frame | Layout | Keep a consistent hero, workspace, and rail structure across routes. | Must support dense data on desktop and single-column flow on mobile. |

### 2.2 Global Interaction Rules

- URL state:
  - Canonical routes may use query parameters such as `pool` and `panel`.
  - Deep links must be shareable and recreate the same selected context on load.
  - Missing or invalid query values must fall back to the first valid record without breaking the page.
- Wallet posture:
  - Observer mode must show all public read models.
  - Connected mode must add role-aware affordances, never silently hide write restrictions.
  - Unmapped wallets must stay connected but clearly labeled as lacking known role scope.
- Search and filtering:
  - Selector filters must search by human label, canonical id, and address when relevant.
  - Empty filter results must produce a clear message, not an empty blank region.
- Address and hash handling:
  - Long addresses must middle-truncate in high-density UI and reveal full values in detail states.
  - Any copied identifier must have a clear success acknowledgement.
- Progressive disclosure:
  - Human-readable summaries come first.
  - Raw hashes, addresses, basis points, and derived protocol values belong in a disclosure or detail surface.
- Cross-route stitching:
  - Routes must link to adjacent canonical surfaces instead of duplicating whole workspaces.
  - A pool or plan selected on one route should be easy to reopen on the related route.
- State handling:
  - Loading must preserve page structure with skeleton copy or placeholders.
  - Empty states must explain what is missing and what the user can do next.
  - Failure states must show a retry action where retry is safe.
- Accessibility:
  - Every interactive control must be keyboard reachable.
  - Menus, drawers, disclosures, and tabs must expose correct ARIA semantics.
  - Status-only information must not rely on color alone.

### 2.3 Common Component Contract

| Element | Required functionality |
| --- | --- |
| `ProtocolSummaryRail` | Show 2-4 route-level summary cards with label, value, and optional explanatory copy. |
| `SearchableSelect` | Combine a canonical selector with optional filter input, option count text, selected hint, empty message, and selector error. |
| `FieldHint` | Show inline help on hover, focus, and tap/click; close on outside interaction and `Esc`. |
| `ProtocolDetailDisclosure` | Collapse raw protocol values, manual overrides, hashes, and advanced accounting details until requested. |
| Status pill | Represent lifecycle, readiness, scope, warning, success, and error tones in a compact, reusable format. |
| Segment button group | Switch between mutually exclusive modes, panels, or workflows; always show which option is active. |
| Register row | Present one canonical object with primary label, address/id, short description, and 2-3 compact metrics. |
| Data row | Present one key-value fact pair with strong visual separation between label and value. |
| Cross-route button | Open the related canonical route with preserved context where possible. |

## 3. Route Specifications

### 3.1 `/`

Purpose:

- Resolve the console entrypoint to the sponsor/operator landing route.

Required behavior:

- Immediately redirect to `/plans`.
- Preserve query parameters only if a future canonical mapping explicitly supports them.

### 3.2 `/plans`

Purpose:

- Primary sponsor/operator route for launching and managing `HealthPlan`, `PolicySeries`, and `FundingLine` setup.

Primary users:

- sponsor operator
- plan administrator
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Plan launch workspace
4. Sponsor register
5. Reserve posture rail

#### `/plans` hero and summary

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Page title | Hero heading | Explain that sponsor budgets and policy series start here. | Must stay in canonical language. |
| Route lead | Hero copy | Summarize the route as the launch and sponsor-control surface. | No LP language here. |
| Route snapshot cards | Summary rail | Show active plan count, policy-series count, and sponsor record count. | Values must come from canonical read models. |

#### `/plans` launch workspace

The launch workspace must be a single canonical on-chain launch wizard. The UI may use `Rewards`, `Insurance`, and `Hybrid` as launch-intent language, but the protocol root remains a neutral `HealthPlan`; product semantics are expressed only by the `PolicySeries` lanes created under it.

Genesis Protect Acute is a required mounted variant of this same workspace, not a separate console. The mounted rules for that template are:

- `/plans/new?template=genesis-protect-acute` must prefill and lock the canonical Genesis shell ids, metadata URIs, and launch SKU definitions.
- the template flow must bootstrap the public-safe Genesis plan, pool, capital classes, protection series, funding lines, and allocation positions in place by orchestrating existing builders rather than introducing a parallel launch surface
- after bootstrap, the operator must land back in `/plans?...&setup=genesis-protect-acute` so the live checklist and issuance posture remain visible until launch readiness is complete
- `/plans?...&setup=genesis-protect-acute&tab=claims` must become the mounted Genesis operator claim queue, with summary cards, queue filters, selected-case detail, and only contextual action handoff into adjudication, reserve, impairment, or oracle follow-through
- `/plans?...&setup=genesis-protect-acute&tab=treasury` must become the mounted Genesis reserve console, with per-lane reserve attribution, degraded-visibility warnings, and treasury actions scoped from the selected live funding lane
- all mounted Genesis copy must describe a bounded launch-readiness posture: end-of-month mainnet target, not broadly live insurance today, and Phase 0 operator-backed claim review
- any later AI recommendation or decentralized review language must be explicitly framed as roadmap or next phase rather than current fact

##### Step 1: neutral plan root

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Launch intent | Segmented control | Choose `Rewards`, `Insurance`, or `Hybrid`. | This is a UI-only selector; it drives which lane steps are required, but it must not create any root product-type field or equivalent protocol surface. |
| Plan id | Text input | Capture the canonical seed-safe plan identifier. | Show byte-length validation and seed safety constraints. |
| Display name | Text input | Capture the human-readable plan name. | Required before final creation. |
| Sponsor label / organization reference | Text input | Identify the sponsor/operator organization responsible for the plan. | Required before final creation. |
| Reserve domain | Selector | Choose the hard custody and legal segregation boundary. | Must drive derived PDA previews. |
| Metadata URI | Text input | Store the public metadata entrypoint for the plan. | Validate URI format when provided. |
| Payout asset mode | Segmented control | Choose `SOL` or `SPL token` for payout rail. | Changes funding input type later in the flow. |
| Payout mint | Text input | Capture the SPL mint when token mode is selected. | Hidden or disabled in SOL mode; validate public key in SPL mode. |
| `Use default payout mint` | Secondary button | Populate the recommended default mint for the selected plan type. | Available only when a default exists. |
| Reward payout amount | Numeric input | Set the default reward payout for reward-bearing flows. | Required for rewards and hybrid reward lanes; not required for pure insurance. |
| Terms hash | Text input | Accept or display the 32-byte hash for plan terms. | Must support manual override and validation. |
| Payout policy hash | Text input | Accept or display the 32-byte hash for payout policy logic. | Must support manual override and validation. |
| Derived PDA preview | Read-only card | Show predicted `HealthPlan`, initial reward `PolicySeries`, initial protection `PolicySeries`, and first funding-line addresses before signature. | Must update live as form values change. |

##### Step 2: membership posture

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Membership mode | Segmented control | Choose `Open`, `Token-gated`, or `Invite-only`. | Changes downstream required fields and the proof mode used later during member enrollment. |
| Token gate class | Segmented control | Choose `Fungible snapshot`, `NFT anchor`, or `Stake anchor` when token-gated enrollment is selected. | Required only in token-gated mode. `Fungible snapshot` is valid for reward-only launches but must be rejected for launches that include a protection lane. Anchor-backed classes define one active protection seat per anchor, not live claim-time possession checks. |
| Token gate mint | Text input | Capture the qualifying mint or anchor mint for gated enrollment. | Required only in token-gated mode. |
| Token gate minimum balance | Numeric input | Set the qualifying balance threshold used by the selected token-gate class. | Required only in token-gated mode; must be greater than zero. |
| Invite issuer wallet | Text input | Capture the wallet allowed to issue invites. | Required only in invite-only mode; must be a valid public key. |
| Membership helper text | Inline helper/error text | Explain the selected enrollment posture, gate-class semantics, and why the current step is blocked if invalid. | Must be explicit and actionable, and must explain that protection seats rely on enrollment and coverage status rather than live possession checks at claim time. |

##### Step 3: verification network

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Oracle search | Text input | Filter oracle candidates by address, metadata, or status. | Keep selected values visible when filtered out. |
| Oracle picker list | Selectable list | Select one or more oracle wallets allowed to confirm outcomes. | Show `Active`, `Inactive`, and manual-entry states. |
| Selected oracle chips | Status chip row | Show all currently selected verifiers. | Selected values must remain clearly removable and count toward quorum. |
| Required confirmations | Numeric input | Set quorum `M`. | Must be `>= 1` and `<= N`. |
| Selected verifier count | Disabled numeric field | Show derived quorum `N` from current selection. | Updates automatically. |
| `Only use verified schemas` | Toggle | Restrict reward-lane rule building to governance-verified schemas. | Defaults on. |
| `Allow delegated reward claims` | Toggle | Permit sponsor/service agents to submit reward claims on behalf of members. | Must remain explicit because it changes who can initiate claims. |

##### Step 4: reward lane setup

This step is required only for `Rewards` and `Hybrid` launches.

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Reward series id | Text input | Define the seed-safe id for the initial reward `PolicySeries`. | Required only when a reward lane is part of the launch. |
| Reward series display name | Text input | Capture the human-readable label for the reward lane. | Required only when a reward lane is part of the launch. |
| Reward metadata URI | Text input | Store the public metadata entrypoint for the reward lane. | Required only when a reward lane is part of the launch. |
| Sponsor funding line id | Text input | Define the seed-safe id for the sponsor-budget funding line that supports the reward lane. | Required only when a reward lane is part of the launch. |
| Schema selector | Select | Choose the schema that defines reward payout outcomes. | Required before rule creation. |
| Schema metadata loading state | Inline state | Indicate when schema metadata and outcome definitions are being loaded. | Must not block the entire page. |
| Schema warning note | Inline note | Explain missing metadata, unverifiable schema state, or other setup issues. | Must remain visible until resolved. |
| Outcome filter | Text input | Filter outcome list by id or human label. | Preserve selections across filtering. |
| Outcome list | Selectable list | Select all outcomes that should unlock payouts. | Selected rows must remain obvious and count toward rule creation. |
| Rule ID input | Text input | Define a stable rule id for each selected outcome. | Must reject duplicates at submission time. |
| `Protocol details` per rule | Disclosure | Show derived rule hash, payout hash, and manual overrides. | Keep expert-only details out of the main flow. |
| Rule hash override | Text input | Allow exact 32-byte override for rule hash. | Optional, validated. |
| Payout hash override | Text input | Allow exact 32-byte override for payout hash. | Optional, validated. |
| Committed sponsor budget | Numeric input | Set the initial committed amount for the reward sponsor-budget line. | Required only when a reward lane is part of the launch. |

##### Step 5: protection lane setup

This step is required only for `Insurance` and `Hybrid` launches.

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Coverage path | Segmented control | Choose `DeFi native` or `RWA policy` when coverage is part of the launch. | Hidden for pure reward launches; required for protection-bearing launches. |
| Settlement style | Segmented control | For DeFi coverage, choose `On-chain programmatic` or `Hybrid rails`. | Required only when DeFi coverage is selected. |
| DeFi technical terms URL | Text input | Capture the public technical terms reference. | Required for DeFi coverage. |
| DeFi risk disclosure URL | Text input | Capture the public risk disclosure reference. | Required for DeFi coverage. |
| RWA issuer legal name | Text input | Capture the legal issuer name for RWA coverage. | Required only when RWA coverage is enabled and selected. |
| RWA jurisdiction | Text input | Capture governing jurisdiction. | Required only for RWA coverage. |
| RWA policy terms URI | Text input | Capture the public policy terms reference. | Required only for RWA coverage. |
| RWA regulatory/license reference | Text input | Capture regulatory or license reference. | Required only for RWA coverage. |
| RWA compliance contact | Text input | Capture public contact for compliance follow-up. | Must accept email or public URI only. |
| Protection series id | Text input | Define the seed-safe id for the initial protection `PolicySeries`. | Required only when a protection lane is part of the launch. |
| Protection series display name | Text input | Capture the human-readable label for the protection lane. | Required only when a protection lane is part of the launch. |
| Protection metadata URI | Text input | Store the public metadata entrypoint for the protection lane. | Required only when a protection lane is part of the launch. The URI must resolve to a structured public JSON document that matches the selected protection posture before launch is allowed to proceed. |
| Premium funding line id | Text input | Define the seed-safe id for the initial premium-income funding line. | Required only when a protection lane is part of the launch. |
| Premium cadence | Numeric input | Capture the expected cadence for premium collection. | Required only when a protection lane is part of the launch. |
| Expected first-cycle premium volume | Numeric input | Set the initial committed amount for the premium-income line. | Required only when a protection lane is part of the launch. |
| Protection posture disclosure | Disclosure | Show the structured public metadata document that will be committed for coverage posture. | Must summarize coverage path, settlement style, and public legal/disclosure references; the fetched document must remain readable after launch and the committed hashes must derive from this validated document rather than transient local state alone. |

##### Step 6: final review and launch

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Launch summary list | Read-only summary | Show launch intent, membership posture, verification policy, reward-lane state, protection-lane state, and workspace links. | Must stay human-readable first and clearly separate plan-root facts from lane-specific facts. |
| `Create canonical launch` | Primary button | Submit the neutral `HealthPlan`, each required `PolicySeries`, and the initial reward/protection funding lines. | Disabled until every required step is valid and a wallet is connected. |
| Created artifact list | Read-only summary | Show the resulting `HealthPlan`, reward `PolicySeries`, protection `PolicySeries`, sponsor-budget line, and premium-income line addresses when created. | Must update after signature confirmation and expose explorer links. |
| `Open workspace` | Secondary button | Open the new plan in its canonical route context after creation. | Hidden until launch succeeds. |
| `Open Genesis workspace` | Secondary button | For the Genesis template, open `/plans?...&setup=genesis-protect-acute` with the created primary Travel 30 series in context. | Hidden until the template bootstrap succeeds. |
| Protocol and accounting details disclosure | Disclosure | Show payout mint, base-unit previews, PDA derivations, and hash commitments. | Must stay collapsed by default and must not describe any retired root product-type field. |
| Coverage references disclosure | Disclosure | Show the structured protection posture metadata and link into the post-launch coverage tab. | Only for launches with a protection lane. The post-launch link must open `/plans?...&tab=coverage`, not a generic overview route. |
| Recent transactions disclosure | Disclosure | Show create/configure transaction history with explorer links. | Append-only for the current session. |
| `Refresh on-chain choices` | Secondary button | Reload oracle and schema selectors. | Safe retry action. |
| Step tabs | Tab group | Jump between steps while preserving draft state. | Show active step, completed step, and total progress. |
| `Back` / `Next step` | Secondary buttons | Move between steps without losing form state. | Hidden or disabled at flow edges. |
| Mobile sticky action bar | Sticky action region | Surface the primary action for the current step on small screens. | Must mirror desktop action availability. |

#### `/plans` sponsor register and reserve rail

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Sponsor register | List | Show each existing plan, canonical id, sponsor label, status, series count, and claim count. | Must support empty state if no plans exist. |
| Reserve posture rail | Rail card | Show reserve-domain count, policy-series count, current claims, and capital-connected pools. | Read-only summary only; no capital actions here. |
| `Open capital route` | Cross-route button | Move from plan launch into the relevant capital route once the capital funding line matters. | Preserve pool context when available. |

Genesis setup mode on `/plans` must also expose:

- one checklist card set covering plan shell, Event 7 and Travel 30 series, canonical funding lines, pool shell, capital classes, allocations, authorities, reserve review, pool terms, and oracle policy
- one issuance posture readout with `healthy`, `caution`, and `paused` states derived from live reserve, queue-only, impairment, and pause-flag signals
- one per-SKU summary for Event 7 and Travel 30 showing cover window, reimbursement posture, claims-paying capital, pending payout, and the frozen `issueWhen` / `pauseWhen` rules from the canonical Genesis metadata
- direct handoff links from checklist items and per-SKU cards into the mounted claim queue or reserve console with the correct `tab`, `series`, and filter state already in the URL
- one claim-queue register showing submitted, operator-review, attestation-ready, reserve-active, payout-in-flight, and closed Genesis claims without exposing raw action forms until a case is selected
- one reserve-console register showing premium, sponsor, and liquidity lanes with claims-paying capital, reserved amount, pending payout, queue-only posture, impairment signals, and explicit degraded-visibility messaging when live snapshot context is incomplete

### 3.3 `/capital`

Purpose:

- LP and capital-markets route for `LiquidityPool`, `CapitalClass`, `AllocationPosition`, and redemption queue behavior.

Primary users:

- capital provider
- risk manager
- pool operator
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Pool context selector
4. Capital panels
5. Pool register rail

#### `/capital` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Liquidity pool selector | Searchable selector | Choose the active `LiquidityPool` context. | Reads/writes `pool` in the URL. |
| Pool filter input | Text input | Filter pools by display name, id, address, or thesis. | Empty-match message required. |
| Panel tabs | Segment buttons | Switch between `Capital classes`, `Direct liquidity`, and `Queue state`. | Reads/writes `panel` in the URL. |
| Operator posture card | Read-only card | Show wallet state, mapped role, and the currently shareable canonical route. | Observer mode must still expose route string. |
| Pool signal card | Read-only card | Show deposit rail, class count, allocation-link count, queue state, and strategy thesis. | Must update when pool changes. |
| Cross-route buttons | Link buttons | Open `Claims`, `Members`, and `Oracle policy` for the active pool. | Preserve pool context. |

#### `/capital` panel: Capital classes

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Capital class card | Data card | Show class id, address, restriction, allocation-link count, LP-position count, and queue posture. | One card per class. |
| Restriction badge | Status/meta | Show open, restricted, wrapper, or other class restriction clearly. | Must not be inferred from color alone. |
| `View class details` | Secondary button | Open an expanded or modal detail surface for class rights, waterfall, redemption policy, and wrapper semantics. | Target-state requirement even if not yet implemented. |
| `Subscribe` amount input | Numeric input | Capture subscription size for the selected class. | Connected and authorized wallets only. |
| `Subscribe` | Primary button | Mint LP exposure into the selected class. | Must disclose funding rail, slippage/fees if applicable, and resulting class. |
| `Redeem` amount input | Numeric input | Capture shares or value to redeem. | Input mode should be explicit. |
| `Redeem now` / `Queue redemption` | Primary/secondary action | If policy is open, redeem directly; if queue-only, submit to queue instead. | Action label must follow class redemption policy. |

#### `/capital` panel: Direct liquidity

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Allocation position card | Data card | Show funding line, capital class, weight basis points, and linked pool. | One card per allocation position. |
| `Edit allocation` | Secondary button | For authorized operators, modify weights or open a proposal path to change them. | Must route through governance if direct editing is not allowed. |
| `Add allocation` | Primary button | Create a new allocation link between class and funding line. | Only for authorized pool/plan operators. |
| Exposure summary | Summary strip | Show total funded weight, unused capacity, and any over-allocation warning. | Target-state requirement. |

#### `/capital` panel: Queue state

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Queue operator note | Inline note | Explain why queue-only redemptions matter and what users are seeing. | Always visible at top of panel. |
| LP position row/card | Data card | Show owner, class, share balance, pending redemption amount, and queue status. | Must distinguish `clear`, `pending`, and `processed`. |
| Queue filter | Optional filter | Filter queue by class, owner, or status. | Target-state requirement. |
| `Cancel request` | Secondary button | Cancel a pending redemption request when policy allows it. | Must be disabled with explanation when cancellation is blocked. |
| `Process queue` | Primary operator action | Advance eligible queue items when an operator is authorized to do so. | Must show impacted positions before signature. |
| Impairment / pause banner | Alert | Explain when queue processing is blocked by impairment, pause, or governance controls. | Required when route-level blocking state exists. |

### 3.4 `/claims`

Purpose:

- Liability and adjudication route for `ClaimCase` and `Obligation`.

Primary users:

- member
- member delegate
- claims operator
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Self-serve claim-intake workspace
4. Operator adjudication and liability workspace
5. Claim and obligation side rails

#### `/claims` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Plan selector | Searchable selector | Select the active `HealthPlan` in the current pool context. | Must react to `pool` filtering when present. |
| Series selector | Searchable selector | Select the active `PolicySeries` for the selected plan. | Reset when plan changes. |
| Operator panel tabs | Segment buttons | Switch the operator workspace between `Intake`, `Adjudication`, `Reserve`, and `Impairment`. | Reads/writes `panel` in the URL without hiding the self-serve intake card. |
| Claimant posture card | Read-only card | Show wallet, recognized role, and current participation count. | Observer mode must remain useful. |
| Context card | Read-only card | Show pool filter, canonical route, and cross-link to member rights. | Pool filter should say `all pools` when unset. |

#### `/claims` panel: Claim intake

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Claim case id | Text input | Capture the canonical `ClaimCase` id seed. | Required before final submission; may be preseeded locally for convenience. |
| Claimant field | Read-only field | Show the connected wallet that will own the submission. | Read-only for the self-serve flow. |
| Member position selector | Select | Choose one of the connected wallet's enrolled `MemberPosition` records. | Must show an empty state when no self-owned member position exists for the selected plan context. |
| Funding line selector | Select | Choose the plan-side `FundingLine` the claim should open against. | Must be drawn from the selected plan context. |
| Initial evidence reference | Text input | Capture a public pointer such as `ipfs://...`, URI, CID, or digest seed. | Must reject raw file uploads to chain-bound state. |
| Eligibility notice | Inline notice | Explain when the connected wallet cannot submit because no eligible member position exists. | Must remain visible before the primary action. |
| `Open claim case` | Primary button | Create the claim on-chain with the selected plan, member position, funding line, claimant, and evidence reference. | Must be blocked until wallet, member position, and funding line are all present. |

#### `/claims` panel: Operator liability workspace

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Claim card | Data card | Show claim id, claim address, intake status, paid state, reserve state, and claimant. | One card per filtered claim. |
| Obligation card | Data card | Show obligation id, status, health plan, policy series, and linked claim case when present. | One card per filtered obligation. |
| Claim selection control | Selectable row | Drive the active operator subform from the selected claim case. | Must preserve route state in the URL when possible. |
| Intake form | Operator action form | Attach evidence references and set intake review posture. | Must support controlled review-state changes before adjudication. |
| Adjudication form | Operator action form | Approve or deny amounts and create the linked obligation when warranted. | Must surface the beneficiary, obligation id, and delivery mode before signature. |
| Reserve and settlement form | Operator action form | Reserve liabilities, release reserve, settle claim cases, and settle obligations. | Must make irreversible economic actions explicit before signature. |
| Impairment form | Operator action form | Mark impairment against the selected funding-line or obligation context. | Must stay claim-operator scoped and explain the linked liability consequence. |

### 3.5 `/members`

Purpose:

- Member-rights route for self-serve enrollment, active rights, and operator review.

Primary users:

- member
- member delegate
- sponsor/member operations
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Self-serve enrollment workspace
4. Member review and eligibility workspace
5. Rights posture rail

#### `/members` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Plan selector | Searchable selector | Choose the active `HealthPlan` context. | Respect optional pool filter. |
| Series selector | Searchable selector | Choose the active `PolicySeries`. | Reset when plan changes. |
| Member posture card | Read-only card | Show wallet, role, and current participation count. | Observer mode supported. |
| Selected member control | Route state | Focus the operator review workspace on one `MemberPosition` when applicable. | Reads/writes `member` and supporting panel state in the URL. |
| Cross-route card | Action card | Link to `Claims` and `Capital context` for the same pool when applicable. | Must explain that pool context does not own member rights. |

#### `/members` panel: Enrollment

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Connected wallet | Read-only field | Show the wallet that will own the member position. | Required for self-serve clarity. |
| Series scope | Read-only/meta field | Show the selected lane or `plan root` when no series is selected. | Must match the plan/series context used by the transaction. |
| Membership model | Read-only/meta field | Show the selected plan's enrollment rule. | Must match plan configuration. |
| Existing position field | Read-only field | Show whether the enrollment already exists. | Distinguish new draft vs existing position. |
| Enrollment proof mode | Read-only/meta field | Show whether the current enrollment posture resolves to `open`, `token_gate`, or `invite_permit`. | Must stay aligned with the selected plan configuration and the proof accounts required by the protocol surface. |
| Subject commitment | Text input | Capture an optional subject commitment or digest seed for the new position. | Optional; must normalize digest input before send. |
| Token-gate evidence fields | Conditional inputs | Capture token-account and observed balance context when the selected plan is token-gated. | Visible only for token-gated membership models. |
| Invite fields | Conditional inputs | Capture invite reference and expiry when the selected plan is invite-gated. | Visible only for invite-only membership models. |
| Delegated-rights posture | Status chips / register field | Show any delegated rights already recorded on existing member positions. | Read-only on this route for the current canonical model. |
| `Open member position` | Primary button | Create the member position when the wallet and enrollment rule allow it. | Disabled with reason when blocked by token gate, invite-only authority mismatch, missing wallet, or duplicate member position. |

Standalone grant/revoke delegation is not part of the current mounted self-serve route because the live canonical program does not expose that as a separate member-facing transaction surface.

### 3.6 `/governance`

Purpose:

- Governance route for scoped controls, authority visibility, proposal creation, voting power management, and proposal queue review.

Primary users:

- governance authority
- protocol admin
- scoped operator/reviewer
- observer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Bootstrap and scoped controls / authorities / templates tabs
4. DAO operations workspace
5. Proposal queue

#### `/governance` scoped-control surface

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Panel tabs | Segment buttons | Switch between `Scoped controls`, `Authorities`, and `Templates`. | Reads/writes `panel` in the URL. |
| Scoped control rows | Register rows | Show each control family, blast radius, responsible authority family, and leading action. | Must reinforce bounded authority, not generic mutability. |
| Review grid card | Summary card | Show authority-family count, template count, and current viewer posture. | Read-only. |
| Linked-record buttons | Link buttons | Open template records and the current proposal route. | Must route to canonical governance detail pages. |
| Authority cards | Data cards | Show each operator wallet, role, address, and allowed action chips. | Connected wallet should be visually highlighted when it matches an authority. |
| Template rows | Register rows | Show available governance templates and buttons to open template/proposal pages. | One row per canonical template. |

#### `/governance` bootstrap workspace

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Governance readiness card | Summary card | Show whether protocol governance is initialized plus reserve-domain and domain-vault counts. | Read-only posture summary for fresh and already-bootstrapped environments. |
| Protocol fee field | Numeric input | Capture the initial protocol fee basis points for governance bootstrap. | Used only when governance is missing. |
| Emergency pause toggle | Toggle | Set the initial emergency pause posture during governance bootstrap. | Must mirror the canonical governance initializer fields. |
| `Initialize governance` | Primary / secondary button | Run `initialize_protocol_governance` when the protocol governance account is absent. | Must be disabled once governance is already initialized. |
| Reserve-domain form | Structured form | Capture domain id, display name, admin, settlement mode, rail mask, pause flags, and optional legal/compliance hashes. | Enabled only after governance exists. |
| `Create reserve domain` | Primary button | Run `create_reserve_domain` for a new settlement domain. | Must not require rerunning governance bootstrap. |
| Domain-vault selector | Select | Choose an existing reserve domain for a new rail. | Must be driven from live snapshot state. |
| Asset mint field | Text input | Capture the mint for the new `DomainAssetVault`. | Required before creating the rail. |
| Existing rail notice | Inline notice | Show the currently configured vault rails for the selected domain and warn on duplicates. | Must prevent duplicate domain/mint rails. |
| `Create domain asset vault` | Primary button | Run `create_domain_asset_vault` for the selected reserve domain and mint. | Enabled only when governance exists and the domain/mint pair is missing. |

#### `/governance` DAO operations workspace

The target governance route should also expose the richer governance operations currently represented by the native governance components.

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Governance refresh | Secondary button | Reload DAO, proposal, token, and schema state. | Must not clear selected context. |
| Realm summary cards | Summary cards | Show realm, voting rules, native treasury, DAO activity, and governed account. | Read-only observer surface. |
| Wallet voting-power cards | Summary cards | Show wallet balance and deposited voting power. | Must tell disconnected users how to unlock actions. |
| Deposit amount | Numeric input | Capture governance-token deposit amount. | Uses DAO token decimals. |
| `Deposit voting power` | Primary button | Deposit governance tokens into the DAO voting flow. | Disabled until wallet is connected and input is valid. |
| `Withdraw all` | Secondary button | Withdraw deposited governance tokens. | Disabled when nothing is deposited or plugin rules forbid it. |
| Plugin fallback notice | Info panel | Explain when Realms/plugin fallback is required. | Required when native flow is unavailable. |
| Protocol settings form | Structured form | Draft a proposal to change protocol fee, default stake mint, minimum oracle stake, emergency pause, or authority rotation. | Must show current values before draft values. |
| `Emergency pause` | Toggle | Draft whether new protocol activity should pause after approval. | Must be explicit because it changes global operability. |
| Manual protocol values disclosure | Disclosure | Accept expert-only values such as payout-mint hash and governance-authority rotation. | Collapsed by default. |
| `Create settings proposal` | Primary button | Create the protocol-settings proposal. | Disabled until wallet, voting power, and required form values are ready. |
| Schema maintenance selectors | Selects | Choose schema to verify, unverify, or close. | Must be driven from the registry first. |
| Manual schema-hash inputs | Text input / textarea | Add manual hash-based maintenance actions for recovery or batch work. | Duplicate hashes must be deduplicated before submission. |
| `Create schema proposal` | Primary button | Create the schema-maintenance proposal. | Disabled until at least one action is selected. |
| Proposal queue columns | Grouped lists | Group proposals by `Active`, `Executable`, `Completed`, and `Failed / cancelled`. | Counts must stay visible even when groups are empty. |
| Proposal list item | Selectable row | Select a proposal to preview inline. | Show proposal name, state, owner, and open-link. |
| `Open` proposal link | Inline link | Open the dedicated proposal page. | Must not lose the queue selection unless navigation occurs. |
| Embedded proposal detail | Inline detail panel | Show vote split, description, actions, execution queue, and explorer links for the selected proposal. | Should mirror the dedicated proposal page behavior. |
| Realms fallback panel | Embedded external-action panel | Provide exact fallback links/actions when the DAO must use Realms or a plugin flow instead of native console actions. | Required whenever plugin mode is active. |

### 3.7 `/governance/proposals/[proposalAddress]`

Purpose:

- Dedicated operational inspector for one governance proposal.

Required page sections:

1. Proposal hero
2. Route snapshot rail
3. Review record
4. Execution path
5. Authority and linked-record rails
6. Live governance action block

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Back to governance | Secondary button | Return to the governance route. | Must preserve mental model and not strand the user. |
| `Open template` | Primary/secondary button | Open the linked governance template. | Must use the canonical template page. |
| Proposal metric band | Read-only strip | Show proposal address, execution stage, review window/epoch, and observed slot. | Public-safe metadata only. |
| Vote split bars | Data visualization | Show `% for` and `% against/unresolved`. | Must show numeric labels as well as bar lengths. |
| Review record rows | Register rows | Show authority fit, blast radius, execution boundary, and fallback posture checks. | Target-state review checklist. |
| Execution-step cards | Cards | Show the ordered operational steps expected after approval. | One card per step. |
| Scope doctrine card | Signal card | Restate the proposal's scoped blast radius. | Persistent reinforcement element. |
| Authority map | Rail card | Show executing wallet and action family. | Read-only. |
| Linked records | Rail links | Link back to template and governance console. | Required. |
| Explorer link | External button | Open the proposal on the block explorer. | New tab. |
| Description link | External/text link | Open the full proposal description when available. | Hide if unavailable. |
| `Vote yes` | Primary button | Cast an approval vote. | Enabled only during voting and only for eligible wallets. |
| `Vote no` | Secondary button | Cast a deny/reject vote. | Same eligibility as yes vote. |
| `Relinquish vote` | Secondary button | Relinquish a previously cast vote when allowed. | Hidden or disabled if no current vote exists. |
| Execution queue rows | Action rows | Show each pending proposal transaction or instruction. | Must surface execution status clearly. |
| `Execute` | Secondary button | Execute an eligible proposal instruction. | Enabled only for authorized wallets and executable instructions. |
| Status banner | Inline helper/error | Show pending, success, or failure state for vote/execution actions. | Must include explorer link when a tx is produced. |
| Proposal transactions list | Detailed list | Show all proposal transactions with index and execution status. | Required for auditability. |

### 3.8 `/governance/descriptions/[template]`

Purpose:

- Canonical policy-description page for one governance template.

Required page sections:

1. Template hero
2. Route snapshot rail
3. Policy record sections
4. Guardrail language
5. Authority map rail

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Back to governance | Secondary button | Return to the governance route. | Required. |
| `Open linked route` | Primary button | Open the proposal route most closely associated with the template's owner lane. | Required. |
| Template metric band | Read-only strip | Show template id, review lane, blast radius, and owner wallet. | Public-safe only. |
| Policy record rows | Register rows | Show the required sections that must be present in proposal text. | One row per required section. |
| Guardrail cards | Cards | Show protected-scope language reviewers must enforce. | One card per guardrail. |
| Record posture signal card | Signal card | Restate the template blast radius. | Persistent side-rail reinforcement. |
| Authority map card | Rail card | Show owner wallet and action family for the template. | Read-only. |

### 3.9 `/oracles`

Purpose:

- Registry, readiness, and settlement-gating route for oracle operators and pool policy bindings.

Primary users:

- oracle operator
- claims operator
- risk manager
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Pool context selector
4. Registry, binding, and posture panels
5. Operator register rail

#### `/oracles` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Pool selector | Searchable selector | Choose the active pool context. | Reads/writes `pool` in URL. |
| Pool search input | Text input | Filter pools by id, address, or thesis. | Empty-match message required. |
| Panel tabs | Segment buttons | Switch between `Registry`, `Bindings`, `Attestations`, `Disputes`, and `Posture`. | Reads/writes `panel` in URL. |
| Oracle boundary card | Read-only card | Show selected pool, bound series count, and settlement-linked lane count. | Public-safe summary. |
| Connected-role badge | Status pill | Show connected wallet or observer posture. | Must not imply write access without real authorization. |

#### `/oracles` panel: Registry

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Registry verification panel | Embedded action panel | Support register, claim, and profile/readiness maintenance for oracle operators. | Must stay mounted above pool-specific approval and policy posture. |
| Pool approval panel | Embedded action panel | Support approval, permissions, and policy binding for the selected pool. | Must use the current pool context instead of reviving standalone pool pages. |
| Operator card | Data card | Show oracle wallet, claim/readiness posture, approval status, permissions, and address. | Connected wallet should highlight if it matches a listed operator. |

#### `/oracles` panel: Posture

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Access checklist | Data card | Show role gate, pool scope, and schema coverage. | Read-only. |
| Finality note | Informational card | Explain how oracle participation affects settlement and why it does not imply broad spend rights. | Required explanatory copy. |
| `Review claims impact` | Cross-route button | Open the claims route in the same pool context. | Required. |
| Staking and external posture note | Informational card | Explain where staking or external participation requirements still sit outside the mounted route when applicable. | Must not imply a native on-route stake composer if the live program does not expose one here. |

#### `/oracles` panel: Policy bindings

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Approved-operator register | Register rows | Show pool approvals, claimed-profile posture, permission masks, and schema-gate posture for each visible oracle. | Must stay consistent with the registry tab's approval state. |
| Empty-state notice | Inline empty state | Explain when the selected pool has no pool-level oracle approvals yet. | Must keep the current pool context visible. |

The mounted route also includes `Attestations` and `Disputes` tabs for live telemetry and watch-state review, even when specific write actions still depend on narrower operator authority or future expansions.

### 3.10 `/schemas`

Purpose:

- Comparability and terms-version route anchored at the `PolicySeries` layer.

Primary users:

- schema/governance reviewer
- plan operator
- oracle operator
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Registry panel
4. Inspector panel
5. Priority schema rail

#### `/schemas` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Panel tabs | Segment buttons | Switch between `Registry` and `Inspector`. | Reads/writes `panel` in the URL. |
| Series selector | Searchable selector | Choose the active `PolicySeries` for inspection. | Required in inspector mode. |
| Series search | Text input | Filter by display name, series id, comparability key, version, or address. | Empty-match message required. |

#### `/schemas` panel: Registry

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Schema/series register row | Register row | Show terms version, display name, address, comparability key, mode, status, and outcome count. | One row per policy series. |
| `Open inspector` | Secondary button | Open the inspector on the selected series. | Target-state requirement. |
| `Compare version` | Secondary button | Compare the selected series against another version or comparability sibling. | Target-state requirement. |

#### `/schemas` panel: Inspector

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Series posture card | Data card | Show selected series name, comparability key, terms version, and series id. | Empty-state message when nothing is selected. |
| Inspector output card | Data card | Show full series address, comparability key, status, outcome count, and linked pool. | Must surface raw values clearly. |
| `Open oracle bindings` | Cross-route button | Open the oracles route on the related pool and policy-binding context. | Required when a linked pool exists. |
| `Open metadata` | Secondary button | Open the schema metadata or source JSON when publicly available. | Target-state requirement. |

### 3.11 Legacy routes and redirect behavior

Legacy pre-canonical routes should remain accessible long enough to avoid dead links, but they must redirect into the canonical health-capital-markets information architecture.

| Legacy route | Required target behavior |
| --- | --- |
| `/pools` | Redirect to `/capital`. |
| `/pools/create` | Redirect to `/plans`. |
| `/pools/[poolAddress]` | Redirect to `/capital?pool=<poolAddress>` when the address is valid. |
| `/pools/[poolAddress]/coverage-mint` | Redirect to `/claims?pool=<poolAddress>` when the address is valid. |
| `/staking` | Redirect to `/oracles`. |

## 4. Cross-Screen Acceptance Criteria

- Every primary route is useful with no wallet connected.
- Every action-capable control explains why it is disabled when blocked.
- Every route exposes canonical nouns and avoids collapsing into generic `pool` language.
- Every claim, plan, schema, pool, and governance view links cleanly into the adjacent canonical route that owns the next action.
- Every advanced protocol value is available, but only after intentional disclosure.
- Mobile and desktop both expose the full route set, network switcher, theme action, and wallet control.
- Legacy pre-canonical routes redirect without leaving users on stale concepts.
