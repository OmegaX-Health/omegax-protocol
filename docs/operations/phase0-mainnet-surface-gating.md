# Phase 0 Mainnet Surface Gating

Phase 0 keeps the on-chain OmegaX program broad and permissioned, but narrows the public mainnet console and bootstrap paths to the conservative live surface.

There is no on-chain `phase0` switch, no deleted instruction set, and no duplicated Founder checkout in this repository. The public console is the reserve, liability, LP, operator, and auditor surface. The consumer Founder commitment flow remains outside this repository in the OmegaX website and OmegaX Health protocol oracle service.

## Mainnet Profile

The frontend and bootstrap scripts share `GenesisPhase0LaunchProfile` from `frontend/lib/genesis-phase0-launch-profile.ts`.

Mainnet defaults:

- LP deposit actions are live.
- LP redemption requests are live.
- Capital, reserve, claims, oracle, and commitment dashboards are read-only.
- Operator settlement visibility is read-only.
- Rewards, RWA policy launch, hybrid launch, DAO fallback, and future launch choices render as disabled previews.
- Capital admin and policy admin actions are hidden unless operator execution is explicitly enabled.

The on-chain program still enforces the actual security boundary: signer authority, PDA/account binding, custody mint/program validation, Token-2022 rejection, no implicit cross-asset accounting, claim and obligation locks, and role-specific permissions.

## Devnet Profile

Devnet exposes the same code paths, but preview and rehearsal surfaces can become live behind explicit flags. This keeps the public branch identical while allowing devnet rehearsal without a staging-only fork.

Frontend flags:

| Flag | Effect |
|------|--------|
| `NEXT_PUBLIC_ENABLE_REWARD_LAUNCH=1` | Makes reward launch preview actionable on devnet. |
| `NEXT_PUBLIC_ENABLE_RWA_POLICY=1` | Makes RWA policy preview actionable on devnet. |
| `NEXT_PUBLIC_ENABLE_HYBRID_LAUNCH=1` | Makes hybrid launch preview actionable on devnet. |
| `NEXT_PUBLIC_ENABLE_DAO_FALLBACK=1` | Makes DAO fallback preview actionable on devnet. |
| `NEXT_PUBLIC_ENABLE_PROTOCOL_OPERATOR_ACTIONS=1` | Shows operator/admin execution surfaces. |
| `NEXT_PUBLIC_ALLOW_MAINNET_FUTURE_SURFACES=1` | Required in addition to the specific product flag before a future surface can become actionable on mainnet. |

## Bootstrap Guards

The Genesis live bootstrap maps operator environment variables into the same launch profile and refuses accidental mainnet creation of future or admin surfaces before any send path.

Mainnet product/admin allowlist variables:

| Attempted surface | Required product flag | Required mainnet allow flag |
|-------------------|-----------------------|-----------------------------|
| Reward launch | `OMEGAX_LIVE_ENABLE_REWARD_LAUNCH=1` | `OMEGAX_ALLOW_MAINNET_REWARD_LAUNCH=1` |
| RWA policy launch | `OMEGAX_LIVE_ENABLE_RWA_POLICY=1` | `OMEGAX_ALLOW_MAINNET_RWA_LAUNCH=1` |
| Hybrid launch | `OMEGAX_LIVE_ENABLE_HYBRID_LAUNCH=1` | `OMEGAX_ALLOW_MAINNET_HYBRID_LAUNCH=1` |
| Extra admin bootstrap | `OMEGAX_LIVE_ENABLE_ADMIN_BOOTSTRAP=1` | `OMEGAX_ALLOW_MAINNET_ADMIN_BOOTSTRAP=1` |

`npm run protocol:bootstrap:genesis-live -- --plan` must print:

- launch profile id, network, disabled surfaces, and hidden surfaces;
- LP class posture: open classes, 30-day lockup, queue-only redemption, classic SPL-only;
- redemption posture: public request surface and operator-processed queue;
- preferred settlement mint, role map, and no-send status.

## Multi-Asset Claim Payouts

Phase 0 supports automated multi-asset payout selection without silently mixing
ledger units. A claim or obligation settlement is still denominated in the
selected payout asset mint. The off-chain settlement router or oracle service
chooses the asset from the approved waterfall before building the transaction.

The on-chain program now requires `settle_claim_case` and `settle_obligation`
to include the matching `ReserveAssetRail` for that asset. Settlement fails
unless the rail is:

- bound to the same reserve domain and asset mint as the claim or obligation;
- active;
- payout-enabled;
- backed by a non-zero fresh published price under the rail's freshness window;
- backed by a price confidence value at or below the rail's `max_confidence_bps`.

Unsafe oracle quality fails closed: the asset counts as zero claims-paying
capacity and cannot be selected for payout. Frontend and backend services may
route candidate assets, but the Solana program enforces freshness and
confidence before value leaves custody.

This makes USDC the preferred Genesis settlement rail while still allowing an
approved fallback rail such as PUSD, USDT, SOL, WBTC, or WETH to pay a claim
when the router selects it. The program does not swap assets, does not mutate a
USDC claim ledger while draining a WBTC vault, and does not treat pending
commitment custody as claims-paying reserve until activation/posting rules have
made that true.

Selected-asset payouts additionally require both the claim-denomination rail
and the selected payout rail to pass the same freshness and confidence checks
before the value-comparison bounds run.

## Commitment Visibility

The protocol dapp shows Founder commitments as plan and policy-series state. It must not become the consumer purchase flow.

The Genesis setup dashboard separates:

- campaign status;
- accepted rails;
- pending, activated, and refunded counts;
- terms hash;
- linked policy series;
- linked funding line;
- pending custody;
- pending coverage;
- treasury inventory;
- claims-paying reserve impact.

Copy must stay explicit: pending commitments are refundable holds. They are not active cover, not LP deposits, and not claims-paying reserve until activation and posting rules are satisfied.

Production website and oracle-service fallbacks must fail closed if the Founder campaign cannot be read. They should show a paused or unavailable campaign instead of implying deposits are open.

## Validation

Minimum checks for Phase 0 surface work:

```bash
npm run test:node
npm run verify:public
OMEGAX_E2E_KEEP_ARTIFACTS=1 npm run test:e2e:localnet
npm run protocol:bootstrap:genesis-live -- --plan
```

Strict devnet treasury pen-test is required after program or treasury-flow changes. For frontend/bootstrap-only Phase 0 gating changes, document why it was not rerun.
