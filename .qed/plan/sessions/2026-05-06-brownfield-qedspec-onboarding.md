# 2026-05-06 Brownfield QEDGen onboarding

## What We Tried

- Installed QEDGen and ran `qedgen adapt --program programs/omegax_protocol`.
- The adapter discovered all public `#[program]` handlers and the
  `OmegaXProtocolError` variants.
- The adapter did not resolve this repo's `crate::<module>::<handler>` facade
  forwarders into implementation files, so the committed spec records the
  forwarder target explicitly in handler comments.

## What Worked

- `.qed/config.json` pins `omegax_protocol.qedspec`.
- `qedgen check --spec omegax_protocol.qedspec --anchor-project programs/omegax_protocol --coverage --json`
  confirms the spec handler set matches the Anchor program handler set.
- The spec now captures the program id, selected constants, all public
  handlers, coarse account contexts, source-derived `auth` clauses, an
  aggregate `State.Live`, first-order guard/effect clauses, initial properties,
  and the obvious SPL transfer directions.
- `qedgen check --anchor-project programs/omegax_protocol --json` no longer
  reports the initial `no_access_control`, `missing_effect`, `no_lifecycle`, or
  `no_properties` findings.

## What Needs The Next Pass

- Tighten `SPEC-REFINE` comments into exact account-field right-hand sides for
  each lane, especially claim/obligation settlement fees, LP redemption fees,
  allocation capacity, and commitment activation accounting.
- Expand the initial properties into lane-specific conservation invariants and
  property coverage for the handlers that are currently only covered by
  authority/effect modeling.
- Model PDA derivations, emitted events, optional-account branches, and
  selected-account constraints where the first pass currently keeps an
  aggregate field.
- Decide how to represent `create_domain_asset_vault` in QEDGen. It uses
  `token_program` for token-account initialization, not a token transfer, so the
  current token-CPI lint is an expected modeling gap rather than a missing
  payout/deposit transfer.
