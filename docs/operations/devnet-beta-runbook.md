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
- `npm run devnet:beta:deploy` on a clean wallet set
- `npm run devnet:beta:observe` with no unexplained high-severity failures

## Launch Sequence

1. Internal dry run on devnet with a fresh governance signer and fresh member wallet.
2. Limited partner dry run with issue triage and rollback time reserved.
3. Single public launch event with the intended protocol surface enabled.
4. Structured post-launch monitoring window for the first 24 hours.

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
1. Confirm the current authority in `config_v2` and the expected Realms governance PDA.
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

### Faucet abuse response

Trigger: unusual faucet volume, sybil drain patterns, or captcha bypass.

Steps:
1. Disable faucet flags in the service environment:
   - `OMEGAX_FAUCET_ENABLED=false`
2. Rotate faucet authority if leakage is suspected.
3. Raise cooldown and reduce amount before re-enabling.
4. Enforce request-per-day and captcha gates before reopening.
5. Record the abuse window and corrective controls.

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
