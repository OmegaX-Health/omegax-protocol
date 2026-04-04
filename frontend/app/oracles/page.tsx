// SPDX-License-Identifier: AGPL-3.0-or-later

export default function OraclesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/80">OmegaX Health</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Oracle operators produce attestations. They do not get arbitrary money-moving power.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Onchain state stores evidence references, permissions, and settlement consequences. Raw health data and raw
          claim packets remain offchain.
        </p>
      </section>
    </div>
  );
}
