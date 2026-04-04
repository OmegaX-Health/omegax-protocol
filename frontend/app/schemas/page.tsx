// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEVNET_PROTOCOL_FIXTURE_STATE } from "@/lib/devnet-fixtures";

export default function SchemasPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-lime-200/80">Schema and outcome bindings</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Comparability belongs at the PolicySeries layer.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Series terms versioning and comparability keys make product economics legible across sponsor programs
          without silently mutating live semantics.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {DEVNET_PROTOCOL_FIXTURE_STATE.policySeries.map((series) => (
          <article key={series.address} className="rounded-[1.8rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-lime-200/70">{series.termsVersion}</p>
            <h3 className="mt-2 text-xl font-semibold">{series.displayName}</h3>
            <p className="mt-2 text-sm text-slate-400">{series.comparabilityKey}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
