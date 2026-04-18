# Devnet Beta Runbook

This runbook covers shared-devnet rollout for the current canonical OmegaX protocol surface, including the mounted console, governance smoke, oracle/schema registry visibility, and observability sign-off.

## Go / No-Go Gate

All of the following should be green before a public devnet beta event:

- `npm run anchor:idl`
- `npm run protocol:contract`
- `npm run verify:public`
- `npm run test:e2e:localnet`
- `npm run beta:consistency:check`
- `npm run protocol:contract:check`
- `npm run frontend:build`
- `npm run devnet:beta:deploy`
- `npm run protocol:bootstrap:devnet-live`
- `npm run devnet:frontend:bootstrap`
- `npm run devnet:frontend:signoff`
- `npm run devnet:beta:observe` with no unexplained high-severity failures
- `npm run devnet:governance:smoke:create-vote`, then `npm run devnet:governance:smoke:execute` after the shared DAO voting and hold-up windows expire
- `npm run devnet:governance:ui:readonly` against the resulting proposal address

If the launch window requires a rehearsal deployment, run the same sequence against the rehearsal program id before upgrading the canonical shared devnet.

## Launch Sequence

1. Re-lock the checked artifacts with `npm run anchor:idl` and `npm run protocol:contract`, then rerun `npm run verify:public` and `npm run test:e2e:localnet`.
2. Run `npm run devnet:beta:deploy` to rebuild the checked deploy artifact and refresh the canonical bootstrap bundle under `devnet/` and `frontend/`.
3. Upgrade the canonical shared-devnet program id explicitly with the checked `target/deploy/omegax_protocol.so`.
   Use the canonical program id from `Anchor.toml` / `frontend/lib/protocol.ts`, not the raw `target/deploy/omegax_protocol-keypair.json` address if those ever drift.
   The helper now prints the exact canonical command:
   `solana program deploy --program-id Bn6eixac1QEEVErGBvBjxAd6pgB9e2q4XHvAkinQ5y1B --upgrade-authority ~/.config/solana/id.json target/deploy/omegax_protocol.so`
4. Run `npm run protocol:bootstrap:devnet-live` to seed or refresh the canonical plan/capital/oracle/schema graph on shared devnet.
5. Run `npm run devnet:frontend:bootstrap` and `npm run devnet:frontend:signoff` so the mounted console is validated against the refreshed shared-devnet fixture/env set.
6. Run `npm run devnet:governance:smoke:create-vote` and record the resulting proposal address.
7. After the DAO voting and hold-up windows expire, run `npm run devnet:governance:smoke:execute`.
8. Run `npm run devnet:governance:ui:readonly` against the created proposal.
9. Capture observability with `OBSERVABILITY_OUTPUT_JSON=artifacts/devnet_observability.json npm run devnet:beta:observe` and archive the output with the rollout notes.
10. Keep a structured monitoring window for the first 24 hours after rollout.

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
- missing or zeroed canonical fixture addresses after shared-devnet bootstrap
- readonly governance route failures or frontend parity regressions

## Incident Runbooks

### Governance authority recovery

Trigger: governance authority cannot execute required safety actions.

Steps:
1. Confirm the current protocol governance PDA, expected Realms governance address, and the signer currently capable of creating or executing proposals.
2. If the required safety action is an emergency stop, use the current `set_protocol_emergency_pause` path through the authorized governance signer or approved proposal flow.
3. Validate the resulting authority and pause state through on-chain readback plus the readonly governance UI.
4. Execute a low-risk follow-up governance action before resuming normal operations.
5. Resume only after authority checks, pause posture, and proposal execution are green.

### Emergency pause

Trigger: abnormal claim settlement failures, replay anomalies, or governance compromise suspicion.

Steps:
1. Execute `set_protocol_emergency_pause` through the authorized governance path.
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
