<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# Anchor to Quasar Migration

This note tracks the public protocol program migration from Anchor to Quasar.
Quasar documentation: <https://quasar-lang.com/docs>.

## Current Migration State

The branch is intentionally staged. The default build path still compiles the
existing Anchor program while the Quasar feature path exposes the remaining
source-port work.

Completed setup:

- Root `Quasar.toml` declares the protocol project for the Quasar CLI.
- `rust-toolchain.toml` and CI Rust pins are bumped to `1.89.0`, which is the
  current compiler floor required by the Quasar dependency graph.
- `programs/omegax_protocol/src/platform.rs` centralizes framework imports so
  implementation modules no longer import Anchor preludes directly.
- `programs/omegax_protocol/src/quasar_discriminators.rs` preserves the current
  checked-in IDL instruction, account, and event discriminator bytes.
- `npm run quasar:discriminators` regenerates those constants from
  `idl/omegax_protocol.json`.
- `tests/quasar_discriminators.test.ts` verifies instruction, account, and
  event discriminator parity against the checked-in IDL.
- Quasar account definitions now have explicit account discriminators. Dynamic
  account-state structs are split from the Anchor Borsh definitions behind
  `cfg(feature = "quasar")`, with fixed fields first and bounded Quasar
  `String`/`Vec` fields at the tail so the zero-copy account macro accepts the
  layout.
- The Quasar platform seam aliases `Pubkey` to Quasar `Address` for account
  state during the staged port, and state accounts expose a Quasar `INIT_SPACE`
  compatibility constant for existing init-site expressions.
- Anchor-only error messages, compatibility macros, instruction-arg derives,
  and `#[max_len]` helper attributes are gated off the Quasar path so the
  remaining Quasar compile output focuses on facade, context, and POD layout
  work.
- The root instruction facade is split by feature flag. The Anchor path keeps
  forwarding to the existing handlers, while the Quasar path declares all 62
  public instructions with literal Quasar discriminator bytes and fail-closed
  handler bodies until their account contexts and instruction arguments are
  fully ported.
- Anchor-only generated `__client_accounts_*` reexports are gated off the
  Quasar path, and the Quasar platform seam now preserves the existing
  `Result<T>` spelling as `core::result::Result<T, ProgramError>`.
- Dynamic account data now flows through feature-gated `*AccountData<'info>`
  aliases. Anchor resolves those aliases back to the existing Borsh account
  structs, while Quasar resolves them to the borrowed dynamic account views,
  letting shared helpers and most account wrappers carry the required lifetime
  without changing default-path behavior.

The active Quasar compile inventory is:

```bash
npm run quasar:check
```

As of this migration checkpoint, that command reaches `omegax_protocol` under
Rust 1.89 and then fails on source-port work. The dynamic account lifetime
bucket is reduced from 189 diagnostics to 173 by moving shared helpers and
Quasar-only reference fields onto account-data aliases; the remaining lifetime
errors are inside still-Anchor-shaped `#[derive(Accounts)]` contexts that
Quasar must parse as reference-wrapper contexts. The failure buckets are:

- instruction handlers: the Quasar facade is declared and dispatches fail
  closed, but each public handler still needs its real body ported from Anchor
  `Context<T>` plus args structs into Quasar `Ctx<T>` plus POD/dynamic
  instruction parameters.
- account contexts: Quasar account fields use reference-shaped wrappers such as
  `&'info Signer`, `&'info mut Account<T>`, `&'info Program<System>`, and
  `&'info InterfaceAccount<T>`, not Anchor `Signer<'info>`,
  `Account<'info, T>`, `Program<'info, T>`, or `Box<Account<'info, T>>`.
- instruction args: Quasar account-context `#[instruction(...)]` attributes
  expect field lists such as `#[instruction(domain_id: String<u32, 32>, ...)]`,
  not Anchor's `#[instruction(args: CreateReserveDomainArgs)]`. The public
  handlers likewise need Quasar `#[instruction(discriminator = [...])]`
  wrappers and direct POD/dynamic parameters.
- account state follow-up: ledger accounts that embed `ReserveBalanceSheet`
  still need a Quasar POD layout instead of a nested native-`u64` helper before
  the zero-copy companion alignment check can pass.
- events: Quasar `#[event]` requires explicit discriminators and only supports
  primitive integer, bool, and `Address` fields without padding.
- args and IDs: Quasar uses `Address` and POD/dynamic instruction parameters;
  Anchor `AnchorSerialize`, `AnchorDeserialize`, `InitSpace`, `#[max_len]`, and
  `Pubkey` references need framework-specific replacements or removal from the
  Quasar path.
- sysvars and CPI helpers: `Clock::get`, SPL token helpers, and PDA bump access
  must use Quasar imports and `ctx.bumps` from `Ctx<T>`.

## Port Order

1. Port the Quasar facade handlers from fail-closed placeholders to real
   implementations after each account-context and instruction-argument family
   has been converted.
2. Rewrite `#[derive(Accounts)]` contexts by domain module, preserving PDA
   seeds, constraints, and writability exactly. Start with governance and
   reserve custody because they exercise init, update, and token-custody paths.
3. Convert account state structs to Quasar account layouts with explicit
   account discriminators from `quasar_discriminators::account`. Preserve the
   public wire shape where possible; any layout break requires regenerated IDL,
   contract artifacts, frontend builders, and release docs.
4. Convert instruction args from Anchor-serialized structs to Quasar instruction
   parameters. For dynamic strings, use Quasar's Borsh-compatible `u32` length
   prefix unless a public surface change is intentional.
5. Convert events to Quasar event discriminators or replace unsupported event
   shapes with explicit primitive-only public events.
6. Replace Anchor/Anchor SPL CPI calls with Quasar and `quasar-spl` calls.
7. Regenerate IDL and protocol contract artifacts with the documented Quasar
   flow once the Quasar program compiles.

## Optimization Rules

- Prefer Quasar's zero-copy account access for hot read/update paths after the
  account layout is ported.
- Keep checked arithmetic in reserve, fee, and claim settlement kernels; do not
  trade accounting safety for compute-unit reductions.
- Preserve discriminator bytes during the migration so external builders can be
  updated deliberately rather than by surprise.
- Use `quasar profile` after the Quasar build succeeds to compare compute-unit
  changes against the Anchor baseline.
