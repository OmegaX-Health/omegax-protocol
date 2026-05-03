## Summary

- What changed?
- Why was it needed?

## Validation

- [ ] `npm run rust:fmt:check`
- [ ] `npm run rust:test`
- [ ] `npm run rust:lint`
- [ ] `npm run test:node`
- [ ] `npm run frontend:build`
- [ ] `npm run protocol:contract:check`
- [ ] `npm run public:hygiene:check`
- [ ] additional validation noted below when relevant

## Documentation

- [ ] README or docs updated where behavior, structure, or contributor workflow changed
- [ ] no public docs or templates were left inconsistent with the code
- [ ] Solana architecture/instruction docs updated if protocol routing, state, or reviewer read paths changed

## Protocol surface changes

If this PR touches `programs/omegax_protocol/`, `idl/`, `shared/protocol_contract.json`, `frontend/lib/protocol.ts`, or shared protocol builders, complete this section. Otherwise mark `n/a`.

- [ ] `npm run anchor:idl` ran and `idl/omegax_protocol.json` reflects current sources
- [ ] `npm run protocol:contract` ran and `shared/protocol_contract.json`, `frontend/lib/generated/` reflect current IDL
- [ ] `npm run test:e2e:localnet` passed locally — see [public release gate](../docs/operations/public-release-gate.md)

## Review Checklist

- [ ] commits are signed off with DCO (`git commit -s`)
- [ ] no secrets, private keys, or deployment-only config were committed
- [ ] generated artifacts were updated if protocol surfaces changed

## Notes for reviewers

- Any special setup, migration, or follow-up
