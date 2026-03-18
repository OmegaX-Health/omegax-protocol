# Devnet Beta Runbook

This runbook covers public devnet beta operations for the protocol surface, including governance, pools, staking, coverage, and claims.

## Go / No-Go Gate

All of the following should be green before a public devnet beta event:

- `anchor build`
- `anchor test`
- `npm run test:node`
- `npm run beta:consistency:check`
- `npm run protocol:contract:check`
- `npm run frontend:build`
- rehearsal deploy/bootstrap/sign-off on a non-canonical devnet program id with fresh rehearsal wallets
- canonical `npm run devnet:beta:deploy` only after rehearsal is clean
- `npm run devnet:beta:observe` with no unexplained high-severity failures
- `npm run devnet:governance:smoke:create-vote`, then `npm run devnet:governance:smoke:execute` after the shared DAO voting and hold-up windows expire
- `npm run devnet:governance:ui:readonly` against the resulting proposal address

## Launch Sequence

1. Rehearse on devnet with a non-canonical program id, fresh rehearsal wallets, and a fresh parity-pool bootstrap.
2. Run the full frontend parity, governance smoke, readonly governance UI, and observability suite against that rehearsal deployment.
3. Upgrade the canonical shared devnet only after the rehearsal matrix is clean.
4. Rerun the same sign-off suite against the canonical shared devnet.
5. Reserve rollback time and keep a structured post-launch monitoring window for the first 24 hours.

## Observability

### Quick snapshot

```bash
npm run devnet:beta:observe
```

### Save structured output

```bash
OBSERVABILITY_OUTPUT_JSON=artifacts/devnet_observability.json npm run devnet:beta:observe
```

### Signals to review

- instruction success and failure counts
- dominant failure reasons from program logs
- governance proposal state distribution

## Incident Runbooks

### Governance authority recovery

Trigger: governance authority cannot execute required safety actions.

Steps:
1. Confirm the current authority in `config` and the expected Realms governance PDA.
2. If the protocol is not paused and governance is unavailable, use the emergency admin pause path through `set_protocol_params(..., emergency_paused=true)`.
3. Rotate authority using `rotate_governance_authority` to the recovery governance signer or PDA.
4. Validate with on-chain readback and execute a low-risk governance action.
5. Resume only after authority checks are green.

### Emergency pause

Trigger: abnormal claim settlement failures, replay anomalies, or governance compromise suspicion.

Steps:
1. Execute `set_protocol_params` with unchanged numeric params and `emergency_paused=true`.
2. Announce the pause and investigation window in operator channels.
3. Run an observability snapshot and collect affected signatures.
4. Validate the remediation on a dry-run wallet set.
5. Unpause only through an approved governance action.

### Failed proposal remediation

Trigger: proposal execution fails or remains stuck in a non-final state.

Steps:
1. Inspect proposal state in Realms and transaction logs.
2. If the failure was caused by invalid instructions or accounts, create a replacement proposal with corrected payloads.
3. If quorum was not met, re-propose with an updated communication and voting window.
4. If a proposal partially executed, verify on-chain idempotency before retrying.
5. Capture the root cause and update the proposal checklist.

## Ownership

- Governance operations owner: protocol core team
- Oracle operations owner: oracle service team
- Frontend and operator support owner: protocol web team
- Incident commander: assigned per launch window
