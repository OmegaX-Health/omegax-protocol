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

The active Quasar compile inventory is:

```bash
npm run quasar:check
```

As of this migration checkpoint, that command reaches `omegax_protocol` under
Rust 1.89 and then fails on source-port work. The failure buckets are:

- instruction facade: Quasar `#[program]` dispatch requires each public
  instruction to be marked with `#[instruction(discriminator = [...])]` and to
  accept `Ctx<T>` or `CtxWithRemaining<T>`, not Anchor `Context<T>`.
- account contexts: Quasar account fields use reference-shaped wrappers such as
  `&'info Signer`, `&'info mut Account<T>`, `&'info Program<System>`, and
  `&'info InterfaceAccount<T>`, not Anchor `Signer<'info>`,
  `Account<'info, T>`, `Program<'info, T>`, or `Box<Account<'info, T>>`.
- account state: Quasar `#[account]` requires explicit discriminators and
  zero-copy-compatible layouts. Existing Borsh `String` fields must be mapped
  deliberately to Quasar dynamic `String<u32, MAX>` fields to preserve the
  current length-prefix shape.
- events: Quasar `#[event]` requires explicit discriminators and only supports
  primitive integer, bool, and `Address` fields without padding.
- args and IDs: Quasar uses `Address` and POD/dynamic instruction parameters;
  Anchor `AnchorSerialize`, `AnchorDeserialize`, `InitSpace`, `#[max_len]`, and
  `Pubkey` references need framework-specific replacements or removal from the
  Quasar path.
- sysvars and CPI helpers: `Clock::get`, SPL token helpers, and PDA bump access
  must use Quasar imports and `ctx.bumps` from `Ctx<T>`.

## Port Order

1. Replace the root Anchor facade with a Quasar facade behind the Quasar path:
   add instruction discriminators from `quasar_discriminators::instruction`,
   switch handler signatures to `Ctx<T>`, and keep instruction names identical.
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
