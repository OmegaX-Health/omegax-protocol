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

The launch workspace should support both a quick draft mode and a full on-chain creation wizard. Quick preview alone is not sufficient for the target product.

##### Step 1: plan basics and settlement posture

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Plan style | Segmented control | Choose `Rewards`, `Insurance`, or `Hybrid`. | Changing plan style updates downstream required fields and summary language. |
| Coverage path | Segmented control | For `Insurance` and `Hybrid`, choose `DeFi native` or `RWA policy` when enabled. | Hidden for pure rewards plans; required for coverage-bearing plans. |
| Settlement style | Segmented control | For DeFi coverage, choose `On-chain programmatic` or `Hybrid rails`. | Required only when DeFi coverage is selected. |
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
| DeFi technical terms URL | Text input | Capture the public technical terms reference. | Required for DeFi coverage. |
| DeFi risk disclosure URL | Text input | Capture the public risk disclosure reference. | Required for DeFi coverage. |
| RWA issuer legal name | Text input | Capture the legal issuer name for RWA coverage. | Required only when RWA coverage is enabled and selected. |
| RWA jurisdiction | Text input | Capture governing jurisdiction. | Required only for RWA coverage. |
| RWA policy terms URI | Text input | Capture the public policy terms reference. | Required only for RWA coverage. |
| RWA regulatory/license reference | Text input | Capture regulatory or license reference. | Required only for RWA coverage. |
| RWA compliance contact | Text input | Capture public contact for compliance follow-up. | Must accept email or public URI only. |
| Derived PDA preview | Read-only card | Show predicted `HealthPlan`, initial `PolicySeries`, and default funding-line addresses before signature. | Must update live as form values change. |

##### Step 1b: membership eligibility and initial creation

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Membership mode | Segmented control | Choose `Open`, `Token-gated`, or `Invite-only`. | Changes downstream required fields. |
| Token gate mint | Text input | Capture qualifying token mint for gated enrollment. | Required only in token-gated mode. |
| Token gate minimum balance | Numeric input | Set the minimum qualifying balance. | Required only in token-gated mode; must be greater than zero. |
| Invite issuer wallet | Text input | Capture the wallet allowed to issue invites. | Required only in invite-only mode; must be a valid public key. |
| `Register invite issuer` | Secondary button | Register the invite issuer before invite-only enrollment goes live. | Disabled until the current wallet is valid for the action. |
| Invite issuer readiness badge | Status pill | Show whether the issuer is registered and ready. | Must update after registration. |
| `Create plan on-chain` | Primary button | Create the plan and primary policy series. | Disabled until all required Step 1 inputs are valid and a wallet is connected. |
| Create-plan helper text | Inline helper/error text | Explain why the action is blocked or what it will do. | Must be explicit and actionable. |

##### Step 2: verification network and payout rules

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Oracle search | Text input | Filter oracle candidates by address, metadata, or status. | Keep selected values visible when filtered out. |
| Oracle picker list | Selectable list | Select one or more oracle wallets allowed to confirm outcomes. | Show `Active`, `Inactive`, and `Required` states; support locked required oracle. |
| Selected oracle chips | Status chip row | Show all currently selected verifiers. | Required oracle must remain visually distinct. |
| Required confirmations | Numeric input | Set quorum `M`. | Must be `>= 1` and `<= N`. |
| Selected verifier count | Disabled numeric field | Show derived quorum `N` from current selection. | Updates automatically. |
| `Only use verified schemas` | Toggle | Restrict payout rules to governance-verified schemas. | Defaults on. |
| `Allow delegated reward claims` | Toggle | Permit sponsor/service agents to submit reward claims on behalf of members. | Must remain explicit because it changes who can initiate claims. |
| `Save verification network` | Secondary/primary action | Persist verifier set and quorum. | Disabled until inputs are valid and plan exists. |
| Schema selector | Select | Choose the schema that defines payout outcomes. | Required before rule creation. |
| Schema metadata loading state | Inline state | Indicate when schema metadata and outcome definitions are being loaded. | Must not block the entire page. |
| Schema warning note | Inline note | Explain missing metadata, unverifiable schema state, or other setup issues. | Must remain visible until resolved. |
| Outcome filter | Text input | Filter outcome list by id or human label. | Preserve selections across filtering. |
| Outcome list | Selectable list | Select all outcomes that should unlock payouts. | Selected rows must remain obvious and count toward rule creation. |
| Rule ID input | Text input | Define a stable rule id for each selected outcome. | Must reject duplicates at submission time. |
| `Protocol details` per rule | Disclosure | Show derived rule hash, payout hash, and manual overrides. | Keep expert-only details out of the main flow. |
| Rule hash override | Text input | Allow exact 32-byte override for rule hash. | Optional, validated. |
| Payout hash override | Text input | Allow exact 32-byte override for payout hash. | Optional, validated. |
| `Save outcome rules` | Primary action | Persist payout rules for the selected schema outcomes. | Disabled until schema, outcomes, and rule ids are valid. |

##### Step 3: funding and final review

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Launch summary list | Read-only summary | Show plan type, eligibility, verification, outcomes, funding mode, and workspace link. | Must stay human-readable first. |
| `Open workspace` | Secondary button | Open the new plan in its canonical route context after creation. | Hidden until the plan exists. |
| Funding amount input | Numeric input | Capture starting SOL or SPL amount for the launch vault. | Input type depends on payout mode. |
| Mint decimals readout | Inline text | Show token mint decimals for SPL funding. | Loading state required while mint metadata resolves. |
| `Fund launch vault` | Primary button | Seed the initial vault balance. | Disabled until plan exists, funding input is valid, and wallet is connected. |
| Protocol and accounting details disclosure | Disclosure | Show pool type, payout mint, base-unit preview, and plan address. | Must stay collapsed by default. |
| Coverage references disclosure | Disclosure | Show coverage-path references and link into follow-on setup. | Only for plans with coverage posture. |
| Recent transactions disclosure | Disclosure | Show create/configure/fund transaction history with explorer links. | Append-only for the current session. |
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
3. Claim draft workspace
4. Liability register
5. Claim and obligation side rails

#### `/claims` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Plan selector | Searchable selector | Select the active `HealthPlan` in the current pool context. | Must react to `pool` filtering when present. |
| Series selector | Searchable selector | Select the active `PolicySeries` for the selected plan. | Reset when plan changes. |
| Panel tabs | Segment buttons | Switch between `Claim draft` and `Liability register`. | Reads/writes `panel` in the URL. |
| Claimant posture card | Read-only card | Show wallet, recognized role, and current participation count. | Observer mode must remain useful. |
| Context card | Read-only card | Show pool filter, canonical route, and cross-link to member rights. | Pool filter should say `all pools` when unset. |

#### `/claims` panel: Claim draft

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Claim case id | Text input | Capture the canonical `ClaimCase` id seed. | Required before final submission. |
| Evidence reference | Text input | Capture a public pointer such as `ipfs://...` or another stable off-chain manifest reference. | Must reject raw file uploads to chain-bound state. |
| Derived claim case address | Read-only field | Show the derived PDA before submission. | Updates live from plan + claim id. |
| Matching member position | Read-only field | Show whether the selected wallet already has a member position for the selected plan/series. | Must warn when no matching position exists. |
| Evidence pointer preview | Read-only field | Echo the evidence reference that will be recorded. | Must support long-value wrapping. |
| `Save draft` | Secondary button | Save a local or session draft without sending a transaction. | Target-state requirement. |
| `Submit claim` | Primary button | Create the claim on-chain with the selected plan, series, claimant, and evidence reference. | Must be blocked until the wallet is eligible and required fields are present. |
| `Open related member rights` | Cross-route button | Take the user to the relevant member surface. | Preserve plan/pool context when possible. |

#### `/claims` panel: Liability register

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Claim card | Data card | Show claim id, claim address, intake status, paid state, reserve state, and claimant. | One card per filtered claim. |
| Obligation card | Data card | Show obligation id, status, health plan, policy series, and linked claim case when present. | One card per filtered obligation. |
| Claim status filter | Filter | Narrow the register by status. | Target-state requirement. |
| `Open obligation detail` | Secondary button | Expand or route to a detailed liability view. | Target-state requirement. |
| `Reserve liability` | Operator action | For authorized operators, book reserve against the obligation. | Must be explicit about economic consequence. |
| `Record payout` | Operator action | Record payout completion against the obligation/claim path. | Must expose irreversible effects before signature. |

### 3.5 `/members`

Purpose:

- Member-rights route for enrollment, active rights, and delegation.

Primary users:

- member
- member delegate
- sponsor/member operations
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Enrollment workspace
4. Delegation workspace
5. Rights posture rail

#### `/members` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Plan selector | Searchable selector | Choose the active `HealthPlan` context. | Respect optional pool filter. |
| Series selector | Searchable selector | Choose the active `PolicySeries`. | Reset when plan changes. |
| Panel tabs | Segment buttons | Switch between `Enrollment` and `Delegation`. | Reads/writes `panel` in the URL. |
| Member posture card | Read-only card | Show wallet, role, and current participation count. | Observer mode supported. |
| Cross-route card | Action card | Link to `Claims` and `Capital context` for the same pool when applicable. | Must explain that pool context does not own member rights. |

#### `/members` panel: Enrollment

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Derived member position address | Read-only field | Show the predicted `MemberPosition` PDA for the current wallet, plan, and series. | Updates live. |
| Membership model | Read-only/meta field | Show the selected plan's enrollment rule. | Must match plan configuration. |
| Existing position field | Read-only field | Show whether the enrollment already exists. | Distinguish new draft vs existing position. |
| Rights chips | Status chips | Show the default rights implied by the selected series mode. | Example: reward claim vs claim review rights. |
| `Enroll member` | Primary button | Create the member position when the wallet and enrollment rule allow it. | Disabled with reason when blocked by token gate, invite-only, or missing wallet. |
| `View participation history` | Secondary button | Open a history/detail view for prior plan participations. | Target-state requirement. |

#### `/members` panel: Delegation

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Delegate wallet | Text input | Capture the wallet to receive delegated rights. | Validate as a public key before submission. |
| Current rights list | Data list | Show the rights that will be delegated or are already delegated for the selected member position. | Must stay narrow and explicit. |
| Rights checklist | Checklist | Allow the delegator to select which rights to grant or revoke. | Target-state requirement; do not assume full delegation. |
| `Grant delegation` | Primary button | Grant selected rights to the delegate wallet. | Must show selected rights and affected member position before signature. |
| `Revoke delegation` | Secondary/destructive button | Remove delegated rights. | Must support partial or full revoke. |
| Delegate status badge | Status pill | Show whether a delegation already exists and whether it matches the draft. | Target-state requirement. |

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
3. Scoped controls / authorities / templates tabs
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

- Verification and settlement-gating route for oracle operators and policy bindings.

Primary users:

- oracle operator
- claims operator
- risk manager
- observer/reviewer

Required page sections:

1. Hero with route narrative
2. Route snapshot rail
3. Pool context selector
4. Oracle panels
5. Operator register rail

#### `/oracles` route-level controls

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Pool selector | Searchable selector | Choose the active pool context. | Reads/writes `pool` in URL. |
| Pool search input | Text input | Filter pools by id, address, or thesis. | Empty-match message required. |
| Panel tabs | Segment buttons | Switch between `Registry`, `Staking access`, and `Policy bindings` in the current build, with room for `Attestations` and `Disputes` in the target state. | Reads/writes `panel` in URL. |
| Oracle boundary card | Read-only card | Show selected pool, bound series count, and settlement-linked lane count. | Public-safe summary. |
| Connected-role badge | Status pill | Show connected wallet or observer posture. | Must not imply write access without real authorization. |

#### `/oracles` panel: Registry

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Operator card | Data card | Show oracle or claims operator wallet, role, status, and allowed actions. | Connected wallet should highlight if it matches a listed operator. |
| `View operator detail` | Secondary button | Open a detail view for metadata URI, historical attestations, and policy bindings. | Target-state requirement. |

#### `/oracles` panel: Staking access

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Access checklist | Data card | Show role gate, pool scope, and schema coverage. | Read-only. |
| Finality note | Informational card | Explain how oracle participation affects settlement and why it does not imply broad spend rights. | Required explanatory copy. |
| `Review claims impact` | Cross-route button | Open the claims route in the same pool context. | Required. |
| `Stake / top up stake` | Primary button | Allow authorized oracle operators to lock required stake. | Target-state requirement. |
| `Unstake request` | Secondary button | Start an unstake flow if protocol rules allow it. | Target-state requirement. |

#### `/oracles` panel: Policy bindings

| Element | Type | Required functionality | Required states / rules |
| --- | --- | --- | --- |
| Bound-series card | Data card | Show mode, series display name, address, terms version, comparability key, and linked pool. | One card per bound series. |
| `Open schema` | Secondary button | Open the schema inspector for the selected series. | Target-state requirement. |
| `Open claim rules` | Secondary button | Open related claim or payout rule context. | Target-state requirement. |

#### Target-state additions for `/oracles`

- `Attestations` panel:
  - list pending verification tasks
  - collect public proof reference or hash
  - submit attestation
  - revoke/correct attestation if protocol rules allow
- `Disputes` panel:
  - show contested attestations
  - show current dispute stage
  - route to governance or claims review when escalation is required

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
