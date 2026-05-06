# 002 Write-Only Lifecycle Active Flag

## Pattern

A control handler writes an `active` lifecycle field, but user-facing intake or subscription handlers do not read the same field before creating new state or accepting funds.

## Where It Fires

- `update_health_plan_controls` writes `health_plan.active`.
- `open_member_position` does not require the health plan to be active.
- `open_claim_case` does not require the health plan to be active.
- `update_capital_class_controls` writes `capital_class.active`.
- `deposit_into_capital_class` does not require the capital class to be active before transferring SPL tokens into the domain vault.

## Current Interpretation

The protocol has separate pause flags that can still block these paths. The bug is that `active = false` looks like a lifecycle shutdown control but is not itself enforced on fresh intake or new deposits. That makes deactivation operationally fragile and easy to misread from frontend or incident-response code.

## QEDGen Gap

The raw checker already emits that `active` is written in effects but never referenced in any guard or property. The committed wrapper currently treats that as informational and also masks non-severity handler-coverage docs. A dedicated lifecycle-control lint should escalate when a field named `active`, `disabled`, `closed`, or `paused` is written by a control handler and no create/intake/deposit path reads it.

## Expected Guard Shape

- Health plans: require active for new membership, claim-intake, and other new-business paths unless an explicit wind-down exception is documented.
- Capital classes: require active for new deposits before token transfer occurs.
- Redemptions: decide separately whether inactive means wind-down-only or fully closed.
